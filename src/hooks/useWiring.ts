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

