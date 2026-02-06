import type { Circuit, Module, ModuleId, NodeId, Pin } from "./types.ts";

// === Interface diff ===

export interface InterfaceDiff {
  added: Pin[];
  removed: Pin[];
  renamed: Array<{ pin: Pin; oldName: string }>;
  isBreaking: boolean;
}

export function diffInterface(
  oldModule: Module,
  newInterface: { inputs: Pin[]; outputs: Pin[] },
): InterfaceDiff {
  const oldPins = [...oldModule.inputs, ...oldModule.outputs];
  const newPins = [...newInterface.inputs, ...newInterface.outputs];

  const oldById = new Map(oldPins.map((p) => [p.id, p]));
  const newById = new Map(newPins.map((p) => [p.id, p]));

  const added: Pin[] = [];
  const removed: Pin[] = [];
  const renamed: Array<{ pin: Pin; oldName: string }> = [];

  for (const pin of newPins) {
    const old = oldById.get(pin.id);
    if (!old) {
      added.push(pin);
    } else if (old.name !== pin.name) {
      renamed.push({ pin, oldName: old.name });
    }
  }

  for (const pin of oldPins) {
    if (!newById.has(pin.id)) {
      removed.push(pin);
    }
  }

  return { added, removed, renamed, isBreaking: removed.length > 0 };
}

// === Cycle detection (DFS three-color algorithm) ===

const WHITE = 0;
const GRAY = 1;
const BLACK = 2;

export function hasCycle(circuit: Circuit): boolean {
  // Build node-level adjacency
  const adj = new Map<NodeId, Set<NodeId>>();
  for (const node of circuit.nodes) {
    adj.set(node.id, new Set());
  }
  for (const edge of circuit.edges) {
    adj.get(edge.fromNodeId)?.add(edge.toNodeId);
  }

  const color = new Map<NodeId, number>();
  for (const node of circuit.nodes) {
    color.set(node.id, WHITE);
  }

  function dfs(nodeId: NodeId): boolean {
    color.set(nodeId, GRAY);
    const neighbors = adj.get(nodeId);
    if (neighbors) {
      for (const neighbor of neighbors) {
        const c = color.get(neighbor);
        if (c === GRAY) return true;
        if (c === WHITE && dfs(neighbor)) return true;
      }
    }
    color.set(nodeId, BLACK);
    return false;
  }

  for (const node of circuit.nodes) {
    if (color.get(node.id) === WHITE) {
      if (dfs(node.id)) return true;
    }
  }

  return false;
}

// === Forbidden module IDs (prevents circular dependencies on canvas) ===

/**
 * Returns the set of module IDs that cannot be placed inside `moduleId`
 * without creating a circular dependency. This includes `moduleId` itself
 * plus all modules that transitively depend on it (ancestors in the
 * dependency graph).
 */
export function getForbiddenModuleIds(
  moduleId: ModuleId,
  modules: Module[],
): Set<ModuleId> {
  const forbidden = new Set<ModuleId>([moduleId]);

  // BFS: find all modules whose circuit (transitively) uses moduleId
  // i.e., ancestors — modules that depend on moduleId
  const queue: ModuleId[] = [moduleId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    for (const mod of modules) {
      if (forbidden.has(mod.id)) continue;
      const usesCurrentId = mod.circuit.nodes.some(
        (n) => n.type === "module" && n.moduleId === currentId,
      );
      if (usesCurrentId) {
        forbidden.add(mod.id);
        queue.push(mod.id);
      }
    }
  }

  return forbidden;
}

// === Transitive self-reference detection ===

export function hasTransitiveSelfReference(
  moduleId: ModuleId,
  modules: Module[],
): boolean {
  const moduleMap = new Map<ModuleId, Module>();
  for (const mod of modules) {
    moduleMap.set(mod.id, mod);
  }

  const rootModule = moduleMap.get(moduleId);
  if (!rootModule) return false;

  // BFS through modules referenced by circuit nodes
  const visited = new Set<ModuleId>();
  const queue: ModuleId[] = [moduleId];
  visited.add(moduleId);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentModule = moduleMap.get(currentId);
    if (!currentModule) continue;

    for (const node of currentModule.circuit.nodes) {
      if (node.type === "module" && node.moduleId) {
        // Direct or transitive self-reference
        if (node.moduleId === moduleId) return true;

        if (!visited.has(node.moduleId)) {
          visited.add(node.moduleId);
          queue.push(node.moduleId);
        }
      }
    }
  }

  return false;
}
