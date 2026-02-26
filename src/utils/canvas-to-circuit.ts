import type { Edge as RFEdge } from "@xyflow/react";
import type { Circuit, Edge as EngineEdge } from "../engine/types.ts";
import type { AppNode } from "../store/circuit-store.ts";
import { getAppNodeConverter } from "./node-converters.ts";

export function canvasToCircuit(
  nodes: AppNode[],
  edges: RFEdge[],
): { circuit: Circuit; inputValues: Record<string, number> } {
  const circuitNodes = nodes.map((node) =>
    getAppNodeConverter(node.type).toCircuitNode(node),
  );

  const circuitEdges: EngineEdge[] = edges
    .filter((e) => e.sourceHandle && e.targetHandle)
    .map((e) => ({
      id: e.id,
      fromNodeId: e.source,
      fromPinId: e.sourceHandle!,
      toNodeId: e.target,
      toPinId: e.targetHandle!,
      ...(e.data?.["color"] ? { color: e.data["color"] as string } : {}),
    }));

  const inputValues: Record<string, number> = {};
  for (const node of nodes) {
    const converter = getAppNodeConverter(node.type);
    if (converter.extractInputValue) {
      Object.assign(inputValues, converter.extractInputValue(node));
    }
  }

  return {
    circuit: {
      id: "canvas",
      name: "canvas",
      nodes: circuitNodes,
      edges: circuitEdges,
    },
    inputValues,
  };
}
