import type { Edge as RFEdge } from "@xyflow/react";
import type { CircuitNode, Edge as EngineEdge, Module } from "../engine/types.ts";
import type { AppNode } from "../store/circuit-store.ts";
import { BUILTIN_NAND_MODULE_ID } from "../engine/simulate.ts";

/**
 * Convert engine CircuitNodes back to React Flow AppNodes.
 * Used when loading a saved module's circuit onto the canvas.
 */
export function circuitNodesToAppNodes(
  nodes: CircuitNode[],
  modules: Module[],
): AppNode[] {
  const moduleMap = new Map(modules.map((m) => [m.id, m]));

  return nodes.map((node) => {
    switch (node.type) {
      case "input":
        return {
          id: node.id,
          type: "circuitInput" as const,
          position: node.position,
          data: {
            label: node.pins[0]?.name ?? "Input",
            pinId: node.pins[0]?.id ?? node.id,
            value: false,
          },
        };
      case "output":
        return {
          id: node.id,
          type: "circuitOutput" as const,
          position: node.position,
          data: {
            label: node.pins[0]?.name ?? "Output",
            pinId: node.pins[0]?.id ?? node.id,
          },
        };
      case "constant": {
        const pinName = node.pins[0]?.name ?? "0";
        const value = pinName === "1";
        return {
          id: node.id,
          type: "constant" as const,
          position: node.position,
          data: {
            label: pinName,
            pinId: node.pins[0]?.id ?? node.id,
            value,
          },
        };
      }
      case "probe":
        return {
          id: node.id,
          type: "probe" as const,
          position: node.position,
          data: {
            pinId: node.pins[0]?.id ?? node.id,
          },
        };
      case "module": {
        const mid = node.moduleId ?? "";
        const mod = moduleMap.get(mid);
        const label = mid === BUILTIN_NAND_MODULE_ID
          ? "NAND"
          : mod?.name ?? "Module";
        return {
          id: node.id,
          type: "module" as const,
          position: node.position,
          data: {
            label,
            moduleId: mid,
            pins: node.pins,
          },
        };
      }
    }
  });
}

/**
 * Convert engine Edges back to React Flow Edges.
 */
export function circuitEdgesToRFEdges(edges: EngineEdge[]): RFEdge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.fromNodeId,
    sourceHandle: e.fromPinId,
    target: e.toNodeId,
    targetHandle: e.toPinId,
    type: "manhattan" as const,
  }));
}
