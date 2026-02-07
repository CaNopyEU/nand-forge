import type { Edge as RFEdge } from "@xyflow/react";
import type { Circuit, CircuitNode, Edge as EngineEdge } from "../engine/types.ts";
import type { AppNode } from "../store/circuit-store.ts";

export function canvasToCircuit(
  nodes: AppNode[],
  edges: RFEdge[],
): { circuit: Circuit; inputValues: Record<string, boolean> } {
  const circuitNodes: CircuitNode[] = nodes.map((node) => {
    switch (node.type) {
      case "circuitInput":
        return {
          id: node.id,
          type: "input" as const,
          position: node.position,
          rotation: node.data.rotation ?? 0,
          pins: [
            {
              id: node.data.pinId,
              name: node.data.label,
              direction: "output" as const,
              bits: 1 as const,
            },
          ],
        };
      case "circuitOutput":
        return {
          id: node.id,
          type: "output" as const,
          position: node.position,
          rotation: node.data.rotation ?? 0,
          pins: [
            {
              id: node.data.pinId,
              name: node.data.label,
              direction: "input" as const,
              bits: 1 as const,
            },
          ],
        };
      case "constant":
        return {
          id: node.id,
          type: "constant" as const,
          position: node.position,
          rotation: node.data.rotation ?? 0,
          pins: [
            {
              id: node.data.pinId,
              name: node.data.label,
              direction: "output" as const,
              bits: 1 as const,
            },
          ],
        };
      case "probe":
        return {
          id: node.id,
          type: "probe" as const,
          position: node.position,
          rotation: node.data.rotation ?? 0,
          pins: [
            {
              id: node.data.pinId,
              name: "P",
              direction: "input" as const,
              bits: 1 as const,
            },
          ],
        };
      case "clock":
        return {
          id: node.id,
          type: "clock" as const,
          position: node.position,
          rotation: node.data.rotation ?? 0,
          pins: [
            {
              id: node.data.pinId,
              name: "CLK",
              direction: "output" as const,
              bits: 1 as const,
            },
          ],
        };
      case "button":
        return {
          id: node.id,
          type: "button" as const,
          position: node.position,
          rotation: node.data.rotation ?? 0,
          pins: [
            {
              id: node.data.pinId,
              name: node.data.label,
              direction: "output" as const,
              bits: 1 as const,
            },
          ],
        };
      case "module":
        return {
          id: node.id,
          type: "module" as const,
          moduleId: node.data.moduleId,
          position: node.position,
          rotation: node.data.rotation ?? 0,
          pins: node.data.pins,
        };
    }
  });

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

  const inputValues: Record<string, boolean> = {};
  for (const node of nodes) {
    if (node.type === "circuitInput") {
      inputValues[node.data.pinId] = node.data.value;
    } else if (node.type === "constant") {
      inputValues[node.data.pinId] = node.data.value;
    } else if (node.type === "clock") {
      inputValues[node.data.pinId] = node.data.value;
    } else if (node.type === "button") {
      inputValues[node.data.pinId] = node.data.pressed;
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
