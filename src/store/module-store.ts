import { create } from "zustand";
import type { Module, ModuleId, Pin, PinId } from "../engine/types.ts";
import { hasTransitiveSelfReference, diffInterface, type InterfaceDiff } from "../engine/validate.ts";
import { canvasToCircuit } from "../utils/canvas-to-circuit.ts";
import { useCircuitStore, extractInterface } from "./circuit-store.ts";
import { generateId } from "../utils/id.ts";

// === Types ===

export interface SaveResult {
  success: boolean;
  warnings: string[];
  errors: string[];
}

export interface SaveAnalysis {
  success: boolean;
  warnings: string[];
  errors: string[];
  needsConfirmation: boolean;
  diff?: InterfaceDiff;
  affectedModules?: Module[];
  preparedModule?: Module;
}

// === Store ===

interface ModuleStore {
  modules: Module[];
  addModule: (module: Module) => void;
  updateModule: (id: ModuleId, module: Module) => void;
  deleteModule: (id: ModuleId) => void;
  reorderPins: (moduleId: ModuleId, direction: "input" | "output", orderedIds: PinId[]) => void;
  prepareSave: () => SaveAnalysis;
  executeSave: (analysis: SaveAnalysis) => SaveResult;
  saveCurrentModule: () => SaveResult;
  executeModuleDelete: (moduleId: ModuleId) => void;
}

export function getModuleById(id: ModuleId): Module | undefined {
  return useModuleStore.getState().modules.find((m) => m.id === id);
}

// === Dependency lookup (standalone pure functions) ===

/** Direct dependents — modules whose circuit contains an instance of moduleId */
export function getModulesDependingOn(moduleId: ModuleId, modules: Module[]): Module[] {
  return modules.filter((m) =>
    m.circuit.nodes.some((n) => n.type === "module" && n.moduleId === moduleId),
  );
}

/** Transitive dependents in dependency order — direct dependents first,
 *  then their dependents, etc. (BFS). This ensures each module is processed
 *  before modules that depend on it during cascading regeneration. */
export function getTransitiveDependentsInOrder(moduleId: ModuleId, modules: Module[]): Module[] {
  const moduleMap = new Map(modules.map((m) => [m.id, m]));
  const visited = new Set<ModuleId>([moduleId]);
  const order: Module[] = [];
  const queue: ModuleId[] = [moduleId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const dependents = modules.filter((m) =>
      m.circuit.nodes.some((n) => n.type === "module" && n.moduleId === currentId),
    );
    for (const dep of dependents) {
      if (visited.has(dep.id)) continue;
      visited.add(dep.id);
      const mod = moduleMap.get(dep.id);
      if (mod) {
        order.push(mod);
        queue.push(dep.id);
      }
    }
  }

  return order;
}

// === Instance synchronization ===

/**
 * Update all instance nodes of a changed module within a parent module's circuit.
 * Returns updated circuit (nodes + edges with broken wires removed).
 */
export function synchronizeInstancesInCircuit(
  parentModule: Module,
  changedModuleId: ModuleId,
  oldDefinition: Module,
  newDefinition: Module,
): { nodes: typeof parentModule.circuit.nodes; edges: typeof parentModule.circuit.edges; removedInstancePinIds: string[] } {
  const oldDefPins = [...oldDefinition.inputs, ...oldDefinition.outputs];
  const newDefPins = [...newDefinition.inputs, ...newDefinition.outputs];
  const removedInstancePinIds: string[] = [];

  const updatedNodes = parentModule.circuit.nodes.map((node) => {
    if (node.type !== "module" || node.moduleId !== changedModuleId) return node;

    // Build mapping: old definition pin index → instance pin
    const oldInstancePins = node.pins;
    const oldDefToInstance = new Map<string, Pin>();
    for (let i = 0; i < oldDefPins.length; i++) {
      const defPin = oldDefPins[i]!;
      const instPin = oldInstancePins[i];
      if (instPin) {
        oldDefToInstance.set(defPin.id, instPin);
      }
    }

    // Build new instance pins
    const newInstancePins: Pin[] = newDefPins.map((defPin) => {
      const existing = oldDefToInstance.get(defPin.id);
      if (existing) {
        // Reuse instance pin ID (preserves wires), update name/direction
        return { ...existing, name: defPin.name, direction: defPin.direction };
      }
      // New pin — fresh ID
      return { id: generateId(), name: defPin.name, direction: defPin.direction, bits: 1 as const };
    });

    // Find removed instance pins
    const newDefPinIds = new Set(newDefPins.map((p) => p.id));
    for (const [defPinId, instPin] of oldDefToInstance) {
      if (!newDefPinIds.has(defPinId)) {
        removedInstancePinIds.push(instPin.id);
      }
    }

    return { ...node, pins: newInstancePins };
  });

  // Remove edges connected to removed instance pins
  const removedSet = new Set(removedInstancePinIds);
  const updatedEdges = parentModule.circuit.edges.filter(
    (e) => !removedSet.has(e.fromPinId) && !removedSet.has(e.toPinId),
  );

  return { nodes: updatedNodes, edges: updatedEdges, removedInstancePinIds };
}

export const useModuleStore = create<ModuleStore>((set, get) => ({
  modules: [],

  addModule: (module) =>
    set((state) => ({ modules: [...state.modules, module] })),

  updateModule: (id, module) =>
    set((state) => ({
      modules: state.modules.map((m) => (m.id === id ? module : m)),
    })),

  deleteModule: (id) =>
    set((state) => ({
      modules: state.modules.filter((m) => m.id !== id),
    })),

  reorderPins: (moduleId, direction, orderedIds) => {
    const modules = get().modules;
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;

    const pinMap = new Map(
      (direction === "input" ? mod.inputs : mod.outputs).map((p) => [p.id, p]),
    );
    const reordered = orderedIds
      .map((id) => pinMap.get(id))
      .filter((p): p is Pin => p !== undefined);

    const pinOrder = mod.pinOrder ?? {
      inputIds: mod.inputs.map((p) => p.id),
      outputIds: mod.outputs.map((p) => p.id),
    };

    const updatedModule: Module = direction === "input"
      ? { ...mod, inputs: reordered, pinOrder: { ...pinOrder, inputIds: orderedIds } }
      : { ...mod, outputs: reordered, pinOrder: { ...pinOrder, outputIds: orderedIds } };

    // Update definition + synchronize instances in all dependent modules
    let updatedModules = modules.map((m) => (m.id === moduleId ? updatedModule : m));

    const dependents = getModulesDependingOn(moduleId, updatedModules);
    for (const parent of dependents) {
      const latestParent = updatedModules.find((m) => m.id === parent.id);
      if (!latestParent) continue;

      const { nodes, edges } = synchronizeInstancesInCircuit(
        latestParent,
        moduleId,
        mod,
        updatedModule,
      );

      updatedModules = updatedModules.map((m) =>
        m.id === parent.id
          ? { ...m, circuit: { ...m.circuit, nodes, edges } }
          : m,
      );
    }

    set({ modules: updatedModules });
  },

  prepareSave: () => {
    const { activeModuleId, nodes, edges } = useCircuitStore.getState();
    const warnings: string[] = [];
    const errors: string[] = [];

    // Validate activeModuleId
    if (!activeModuleId) {
      errors.push("No active module to save. Create a new module first.");
      return { success: false, warnings, errors, needsConfirmation: false };
    }

    // Find existing module
    const existingModule = get().modules.find((m) => m.id === activeModuleId);
    if (!existingModule) {
      errors.push("Active module not found in store.");
      return { success: false, warnings, errors, needsConfirmation: false };
    }

    // Validate name is not NAND
    if (existingModule.name.toUpperCase() === "NAND") {
      errors.push('Module name cannot be "NAND" — it is a built-in gate.');
      return { success: false, warnings, errors, needsConfirmation: false };
    }

    // Validate min 1 input and 1 output
    const inputNodes = nodes.filter((n) => n.type === "circuitInput");
    const outputNodes = nodes.filter((n) => n.type === "circuitOutput");

    if (inputNodes.length === 0) {
      errors.push("Module must have at least one Input node.");
    }
    if (outputNodes.length === 0) {
      errors.push("Module must have at least one Output node.");
    }
    if (errors.length > 0) {
      return { success: false, warnings, errors, needsConfirmation: false };
    }

    // Check for unconnected input/output nodes (warning, not error)
    const connectedTargets = new Set(edges.map((e) => e.target));
    const connectedSources = new Set(edges.map((e) => e.source));

    for (const node of inputNodes) {
      if (!connectedSources.has(node.id)) {
        warnings.push(`Input "${node.data.label}" is not connected.`);
      }
    }
    for (const node of outputNodes) {
      if (!connectedTargets.has(node.id)) {
        warnings.push(`Output "${node.data.label}" is not connected.`);
      }
    }

    // Convert canvas to circuit
    const { circuit } = canvasToCircuit(nodes, edges);

    // Check transitive self-reference (using the circuit we're about to save)
    const modulesWithUpdatedCircuit = get().modules.map((m) =>
      m.id === activeModuleId ? { ...m, circuit } : m,
    );
    if (hasTransitiveSelfReference(activeModuleId, modulesWithUpdatedCircuit)) {
      errors.push("Module contains a transitive self-reference (uses itself).");
      return { success: false, warnings, errors, needsConfirmation: false };
    }

    // Extract interface (respecting existing pin order)
    const { inputs, outputs } = extractInterface(nodes, existingModule.pinOrder);

    // Preserve/update pinOrder
    const pinOrder = {
      inputIds: inputs.map((p) => p.id),
      outputIds: outputs.map((p) => p.id),
    };

    // Build prepared module (truth table computed async post-save)
    const preparedModule: Module = {
      ...existingModule,
      inputs,
      outputs,
      circuit,
      pinOrder,
      updatedAt: new Date().toISOString(),
    };

    // Diff interface for breaking change detection
    const diff = diffInterface(existingModule, { inputs, outputs });
    const dependents = getModulesDependingOn(activeModuleId, get().modules);
    const needsConfirmation = diff.isBreaking && dependents.length > 0;

    return {
      success: true,
      warnings,
      errors,
      needsConfirmation,
      diff,
      affectedModules: dependents,
      preparedModule,
    };
  },

  executeSave: (analysis) => {
    const warnings = [...analysis.warnings];
    const errors = [...analysis.errors];

    if (!analysis.success || !analysis.preparedModule) {
      return { success: false, warnings, errors };
    }

    const preparedModule = analysis.preparedModule;
    const moduleId = preparedModule.id;
    const existingModule = get().modules.find((m) => m.id === moduleId);
    if (!existingModule) {
      errors.push("Module no longer exists.");
      return { success: false, warnings, errors };
    }

    // 1. Update module definition
    let updatedModules = get().modules.map((m) =>
      m.id === moduleId ? preparedModule : m,
    );

    // 2. Synchronize instances in all parent modules
    const dependents = getModulesDependingOn(moduleId, updatedModules);
    for (const parent of dependents) {
      const latestParent = updatedModules.find((m) => m.id === parent.id);
      if (!latestParent) continue;

      const { nodes, edges } = synchronizeInstancesInCircuit(
        latestParent,
        moduleId,
        existingModule,
        preparedModule,
      );

      updatedModules = updatedModules.map((m) =>
        m.id === parent.id
          ? { ...m, circuit: { ...m.circuit, nodes, edges } }
          : m,
      );
    }

    // 3. Apply to store immediately (optimistic save)
    set({ modules: updatedModules });

    // 4. Mark canvas as clean
    useCircuitStore.getState().markClean();

    return { success: true, warnings, errors };
  },

  saveCurrentModule: () => {
    const analysis = get().prepareSave();
    if (!analysis.success) {
      return { success: false, warnings: analysis.warnings, errors: analysis.errors };
    }
    // If breaking changes with dependents, still save (backward-compat — no UI confirmation)
    return get().executeSave(analysis);
  },

  executeModuleDelete: (moduleId) => {
    const modules = get().modules;
    const dependents = getModulesDependingOn(moduleId, modules);

    // Remove all instances of deleted module from parent circuits
    let updatedModules = modules.map((parent) => {
      if (!dependents.some((d) => d.id === parent.id)) return parent;

      const filteredNodes = parent.circuit.nodes.filter(
        (n) => !(n.type === "module" && n.moduleId === moduleId),
      );
      const removedNodeIds = new Set(
        parent.circuit.nodes
          .filter((n) => n.type === "module" && n.moduleId === moduleId)
          .map((n) => n.id),
      );
      // Also remove edges connected to removed instance pins
      const removedPinIds = new Set(
        parent.circuit.nodes
          .filter((n) => n.type === "module" && n.moduleId === moduleId)
          .flatMap((n) => n.pins.map((p) => p.id)),
      );
      const filteredEdges = parent.circuit.edges.filter(
        (e) =>
          !removedNodeIds.has(e.fromNodeId) &&
          !removedNodeIds.has(e.toNodeId) &&
          !removedPinIds.has(e.fromPinId) &&
          !removedPinIds.has(e.toPinId),
      );

      return {
        ...parent,
        circuit: { ...parent.circuit, nodes: filteredNodes, edges: filteredEdges },
      };
    });

    // Remove the module itself
    updatedModules = updatedModules.filter((m) => m.id !== moduleId);

    set({ modules: updatedModules });

    // If currently editing the deleted module, clear canvas
    const { activeModuleId } = useCircuitStore.getState();
    if (activeModuleId === moduleId) {
      useCircuitStore.getState().setActiveModuleId(null);
      useCircuitStore.getState().clearCanvas();
    }
  },
}));
