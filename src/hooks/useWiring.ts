import { useCallback } from "react";
import type { Connection, Edge as RFEdge, IsValidConnection } from "@xyflow/react";
import { useCircuitStore } from "../store/circuit-store.ts";
import { generateId } from "../utils/id.ts";

/**
 * Wiring hook — provides onConnect handler and isValidConnection checker.
 *
 * Validation rules:
 * 1. No self-connections (source node === target node)
 * 2. No duplicate edges (same source+sourceHandle → target+targetHandle)
 * 3. Each input pin can only have one incoming wire
 * 4. No cycles — adding this edge must not create a directed cycle
 */
export function useWiring() {
  const addEdge = useCircuitStore((s) => s.addEdge);

  const isValidConnection = useCallback<IsValidConnection>(
    (connection) => {
      const { source, target, sourceHandle, targetHandle } = connection;

      // 1. No self-connections
      if (source === target) return false;

      // 2. Handles must be specified
      if (!sourceHandle || !targetHandle) return false;

      const edges = useCircuitStore.getState().edges;

      // 3. No duplicate edges
      const duplicate = edges.some(
        (e) =>
          e.source === source &&
          e.target === target &&
          e.sourceHandle === sourceHandle &&
          e.targetHandle === targetHandle,
      );
      if (duplicate) return false;

      // 4. Input pin already has a wire → reject (one driver per input)
      const inputOccupied = edges.some(
        (e) => e.target === target && e.targetHandle === targetHandle,
      );
      if (inputOccupied) return false;

      // 5. Cycle detection — can we reach source from target via existing edges?
      if (wouldCreateCycle(source, target, edges)) return false;

      return true;
    },
    [],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!isValidConnection(connection)) return;

      const edge: RFEdge = {
        id: generateId(),
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        type: "manhattan",
      };
      addEdge(edge);
    },
    [addEdge, isValidConnection],
  );

  return { onConnect, isValidConnection };
}

/**
 * Check if adding an edge from `source` to `target` would create a cycle.
 * Uses BFS: traverse forward from `target` — if we can reach `source`, it's a cycle.
 */
function wouldCreateCycle(
  source: string,
  target: string,
  edges: RFEdge[],
): boolean {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  }

  const visited = new Set<string>();
  const queue = [target];
  visited.add(target);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === source) return true;
    const neighbors = adj.get(current);
    if (neighbors) {
      for (const n of neighbors) {
        if (!visited.has(n)) {
          visited.add(n);
          queue.push(n);
        }
      }
    }
  }

  return false;
}
