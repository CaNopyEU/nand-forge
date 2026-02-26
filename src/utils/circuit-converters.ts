import type { Edge as RFEdge } from "@xyflow/react";
import type { CircuitNode, Edge as EngineEdge, Module } from "../engine/types.ts";
import type { AppNode } from "../store/circuit-store.ts";
import { getEngineNodeConverter } from "./node-converters.ts";

/**
 * Convert engine CircuitNodes back to React Flow AppNodes.
 * Used when loading a saved module's circuit onto the canvas.
 */
export function circuitNodesToAppNodes(
  nodes: CircuitNode[],
  modules: Module[],
): AppNode[] {
  return nodes.map((node) =>
    getEngineNodeConverter(node.type, node.variant).fromCircuitNode(node, modules),
  );
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
    ...(e.color ? { data: { color: e.color } } : {}),
  }));
}
