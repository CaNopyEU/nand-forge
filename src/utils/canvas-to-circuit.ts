import type { Edge as RFEdge } from "@xyflow/react";
import type { Circuit, CircuitNode, Edge as EngineEdge } from "../engine/types.ts";
import type { AppNode } from "../store/circuit-store.ts";

export function canvasToCircuit(
  nodes: AppNode[],
  edges: RFEdge[],
): { circuit: Circuit; inputValues: Record<string, number> } {
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
              bits: node.data.bits ?? 1,
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
              bits: node.data.bits ?? 1,
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
      case "dipSwitch":
        return {
          id: node.id,
          type: "input" as const,
          variant: "dip-switch",
          position: node.position,
          rotation: node.data.rotation ?? 0,
          pins: [
            {
              id: node.data.pinId,
              name: node.data.label,
              direction: "output" as const,
              bits: node.data.bits ?? 8,
            },
          ],
        };
      case "hexDisplay":
        return {
          id: node.id,
          type: "output" as const,
          variant: "hex-display",
          position: node.position,
          rotation: node.data.rotation ?? 0,
          pins: [
            {
              id: node.data.pinId,
              name: "HEX",
              direction: "input" as const,
              bits: node.data.bits ?? 8,
            },
          ],
        };
      case "ledBar":
        return {
          id: node.id,
          type: "output" as const,
          variant: "led-bar",
          position: node.position,
          rotation: node.data.rotation ?? 0,
          pins: [
            {
              id: node.data.pinId,
              name: "LEDs",
              direction: "input" as const,
              bits: node.data.bits ?? 8,
            },
          ],
        };
      case "tunnel": {
        const dir = node.data.direction;
        const visiblePinId = node.data.pinId;
        const internalPinId = `${visiblePinId}_int`;
        const tunnelName = node.data.label;
        return {
          id: node.id,
          type: "tunnel" as const,
          variant: dir,
          position: node.position,
          rotation: node.data.rotation ?? 0,
          pins: dir === "in"
            ? [
                { id: visiblePinId, name: tunnelName, direction: "input" as const, bits: node.data.bits ?? 1 },
                { id: internalPinId, name: tunnelName, direction: "output" as const, bits: node.data.bits ?? 1 },
              ]
            : [
                { id: internalPinId, name: tunnelName, direction: "input" as const, bits: node.data.bits ?? 1 },
                { id: visiblePinId, name: tunnelName, direction: "output" as const, bits: node.data.bits ?? 1 },
              ],
        };
      }
      case "rom":
        return {
          id: node.id,
          type: "rom" as const,
          position: node.position,
          rotation: node.data.rotation ?? 0,
          romData: node.data.romData,
          pins: [
            { id: node.data.addrPinId, name: "Addr", direction: "input" as const, bits: node.data.addressBits },
            { id: node.data.dataPinId, name: "Data", direction: "output" as const, bits: 8 as const },
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

  const inputValues: Record<string, number> = {};
  for (const node of nodes) {
    if (node.type === "circuitInput") {
      inputValues[node.data.pinId] = node.data.value;
    } else if (node.type === "dipSwitch") {
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
