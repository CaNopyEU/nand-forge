import type { Circuit, Module, ModuleId, NodeId } from "./types.ts";

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
