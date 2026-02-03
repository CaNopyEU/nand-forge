import { create } from "zustand";
import type { Module, ModuleId } from "../engine/types.ts";
import { hasTransitiveSelfReference } from "../engine/validate.ts";
import { generateTruthTable } from "../engine/truth-table.ts";
import { canvasToCircuit } from "../utils/canvas-to-circuit.ts";
import { useCircuitStore, extractInterface } from "./circuit-store.ts";

// === Types ===

export interface SaveResult {
  success: boolean;
  warnings: string[];
  errors: string[];
}

// === Store ===

interface ModuleStore {
  modules: Module[];
  addModule: (module: Module) => void;
  updateModule: (id: ModuleId, module: Module) => void;
  deleteModule: (id: ModuleId) => void;
  saveCurrentModule: () => SaveResult;
}

export function getModuleById(id: ModuleId): Module | undefined {
  return useModuleStore.getState().modules.find((m) => m.id === id);
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

  saveCurrentModule: () => {
    const { activeModuleId, nodes, edges } = useCircuitStore.getState();
    const warnings: string[] = [];
    const errors: string[] = [];

    // Validate activeModuleId
    if (!activeModuleId) {
      errors.push("No active module to save. Create a new module first.");
      return { success: false, warnings, errors };
    }

    // Find existing module
    const existingModule = get().modules.find((m) => m.id === activeModuleId);
    if (!existingModule) {
      errors.push("Active module not found in store.");
      return { success: false, warnings, errors };
    }

    // Validate name is not NAND
    if (existingModule.name.toUpperCase() === "NAND") {
      errors.push('Module name cannot be "NAND" — it is a built-in gate.');
      return { success: false, warnings, errors };
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
      return { success: false, warnings, errors };
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
      return { success: false, warnings, errors };
    }

    // Extract interface
    const { inputs, outputs } = extractInterface(nodes);

    // Generate truth table if small enough (<=16 inputs)
    let truthTable = undefined;
    if (inputs.length <= 16) {
      truthTable = generateTruthTable(circuit, get().modules) ?? undefined;
    }

    // Update module
    const updatedModule: Module = {
      ...existingModule,
      inputs,
      outputs,
      circuit,
      truthTable,
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      modules: state.modules.map((m) =>
        m.id === activeModuleId ? updatedModule : m,
      ),
    }));

    return { success: true, warnings, errors };
  },
}));
