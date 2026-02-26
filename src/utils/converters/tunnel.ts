import type { CircuitNode, BitWidth } from "../../engine/types.ts";
import type { AppNode } from "../../store/circuit-store.ts";
import type { Rotation } from "../layout.ts";
import type { NodeConverter } from "../node-converters.ts";

export const tunnelConverter: NodeConverter = {
  toCircuitNode: (node: AppNode) => {
    const n = node as AppNode & { type: "tunnel" };
    const dir = n.data.direction;
    const visiblePinId = n.data.pinId;
    const internalPinId = `${visiblePinId}_int`;
    const tunnelName = n.data.label;
    return {
      id: n.id,
      type: "tunnel" as const,
      variant: dir,
      position: n.position,
      rotation: n.data.rotation ?? 0,
      pins: dir === "in"
        ? [
            { id: visiblePinId, name: tunnelName, direction: "input" as const, bits: n.data.bits ?? 1 },
            { id: internalPinId, name: tunnelName, direction: "output" as const, bits: n.data.bits ?? 1 },
          ]
        : [
            { id: internalPinId, name: tunnelName, direction: "input" as const, bits: n.data.bits ?? 1 },
            { id: visiblePinId, name: tunnelName, direction: "output" as const, bits: n.data.bits ?? 1 },
          ],
    };
  },
  fromCircuitNode: (node: CircuitNode) => {
    const dir = (node.variant ?? "in") as "in" | "out";
    const visiblePin = dir === "in"
      ? node.pins.find((p) => p.direction === "input")
      : node.pins.find((p) => p.direction === "output");
    return {
      id: node.id,
      type: "tunnel" as const,
      position: node.position,
      data: {
        label: node.pins[0]?.name ?? "T",
        pinId: visiblePin?.id ?? node.id,
        bits: (visiblePin?.bits ?? 1) as BitWidth,
        direction: dir,
        rotation: (node.rotation ?? 0) as Rotation,
      },
    };
  },
  getPinBits: (node: AppNode) => (node as AppNode & { type: "tunnel" }).data.bits ?? 1,
};
