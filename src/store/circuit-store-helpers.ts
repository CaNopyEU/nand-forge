import type { Edge as RFEdge } from "@xyflow/react";
import type { Pin } from "../engine/types.ts";
import type { AppNode, InputNodeData, OutputNodeData, Snapshot } from "./circuit-store-types.ts";

// === History ===

export const MAX_HISTORY = 50;

export function pushSnapshot(state: { nodes: AppNode[]; edges: RFEdge[]; past: Snapshot[] }): {
  past: Snapshot[];
  future: Snapshot[];
} {
  return {
    past: [...state.past.slice(-(MAX_HISTORY - 1)), { nodes: state.nodes, edges: state.edges }],
    future: [],
  };
}

// === Interface extraction ===

export function extractInterface(
  nodes: AppNode[],
  existingOrder?: { inputIds: string[]; outputIds: string[] },
): { inputs: Pin[]; outputs: Pin[] } {
  // Sort input/output nodes by Y position (top to bottom) for consistent pin order
  const inputNodes = nodes
    .filter((n) => n.type === "circuitInput")
    .sort((a, b) => (a.position.y ?? 0) - (b.position.y ?? 0));
  const outputNodes = nodes
    .filter((n) => n.type === "circuitOutput")
    .sort((a, b) => (a.position.y ?? 0) - (b.position.y ?? 0));

  const inputs: Pin[] = inputNodes.map((node) => ({
    id: node.data.pinId,
    name: node.data.label,
    direction: "input" as const,
    bits: (node.data as InputNodeData).bits ?? 1,
  }));
  const outputs: Pin[] = outputNodes.map((node) => ({
    id: node.data.pinId,
    name: node.data.label,
    direction: "output" as const,
    bits: (node.data as OutputNodeData).bits ?? 1,
  }));

  if (existingOrder) {
    const sortByOrder = (pins: Pin[], order: string[]): Pin[] => {
      const indexMap = new Map(order.map((id, i) => [id, i]));
      const ordered: Pin[] = [];
      const remaining: Pin[] = [];
      for (const pin of pins) {
        const idx = indexMap.get(pin.id);
        if (idx !== undefined) {
          ordered[idx] = pin;
        } else {
          remaining.push(pin);
        }
      }
      return [...ordered.filter(Boolean), ...remaining];
    };
    return {
      inputs: sortByOrder(inputs, existingOrder.inputIds),
      outputs: sortByOrder(outputs, existingOrder.outputIds),
    };
  }

  return { inputs, outputs };
}
