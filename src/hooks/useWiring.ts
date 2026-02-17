import { useCallback } from "react";
import type { Connection, Edge as RFEdge, IsValidConnection } from "@xyflow/react";
import { useCircuitStore, type AppNode, type InputNodeData, type OutputNodeData, type DipSwitchNodeData, type HexDisplayNodeData, type LedBarNodeData, type TunnelNodeData, type RomNodeData, type RamNodeData, type TristateNodeData } from "../store/circuit-store.ts";
import { generateId } from "../utils/id.ts";
import type { BitWidth } from "../engine/types.ts";

/**
 * Get bit width for a pin on a node.
 * Module nodes carry pin metadata; Input/Output nodes carry bits in data.
 */
function getPinBits(nodes: AppNode[], nodeId: string, pinId: string): BitWidth {
  const node = nodes.find((n) => n.id === nodeId);
  if (node?.type === "module") {
    return node.data.pins.find((p) => p.id === pinId)?.bits ?? 1;
  }
  if (node?.type === "circuitInput") return (node.data as InputNodeData).bits ?? 1;
  if (node?.type === "circuitOutput") return (node.data as OutputNodeData).bits ?? 1;
  if (node?.type === "dipSwitch") return (node.data as DipSwitchNodeData).bits ?? 8;
  if (node?.type === "hexDisplay") return (node.data as HexDisplayNodeData).bits ?? 8;
  if (node?.type === "ledBar") return (node.data as LedBarNodeData).bits ?? 8;
  if (node?.type === "tunnel") return (node.data as TunnelNodeData).bits ?? 1;
  if (node?.type === "rom") {
    const romData = node.data as RomNodeData;
    if (pinId === romData.addrPinId) return romData.addressBits;
    return 8 as BitWidth;
  }
  if (node?.type === "ram") {
    const ramData = node.data as RamNodeData;
    if (pinId === ramData.addrPinId) return ramData.addressBits;
    if (pinId === ramData.writePinId) return 1 as BitWidth;
    if (pinId === ramData.clockPinId) return 1 as BitWidth;
    return 8 as BitWidth; // dataIn, dataOut
  }
  if (node?.type === "tristate") {
    const tsData = node.data as TristateNodeData;
    if (pinId === tsData.enablePinId) return 1 as BitWidth;
    return tsData.bits as BitWidth;
  }
  if (node?.type === "pull") return 1 as BitWidth;
  return 1;
}

/**
 * Wiring hook — provides onConnect handler and isValidConnection checker.
 *
 * Validation rules:
 * 1. No self-connections (source node === target node)
 * 2. No duplicate edges (same source+sourceHandle → target+targetHandle)
 * 3. Bit width must match between source and target pins
 * Multiple drivers per input are allowed (bus resolution handles them).
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

      const { edges, nodes } = useCircuitStore.getState();

      // 3. No duplicate edges
      const duplicate = edges.some(
        (e) =>
          e.source === source &&
          e.target === target &&
          e.sourceHandle === sourceHandle &&
          e.targetHandle === targetHandle,
      );
      if (duplicate) return false;

      // 4. Bit width must match
      const sourceBits = getPinBits(nodes, source, sourceHandle);
      const targetBits = getPinBits(nodes, target, targetHandle);
      if (sourceBits !== targetBits) return false;

      return true;
    },
    [],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!isValidConnection(connection)) return;

      const { nodes } = useCircuitStore.getState();
      const bits = getPinBits(nodes, connection.source, connection.sourceHandle!);

      const edge: RFEdge = {
        id: generateId(),
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        type: "manhattan",
        data: { bits },
      };
      addEdge(edge);
    },
    [addEdge, isValidConnection],
  );

  return { onConnect, isValidConnection };
}

