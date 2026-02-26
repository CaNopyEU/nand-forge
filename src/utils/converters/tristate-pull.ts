import type { CircuitNode, BitWidth } from "../../engine/types.ts";
import type { AppNode, TristateNodeData } from "../../store/circuit-store.ts";
import type { Rotation } from "../layout.ts";
import type { NodeConverter } from "../node-converters.ts";

export const tristateConverter: NodeConverter = {
  toCircuitNode: (node: AppNode) => {
    const n = node as AppNode & { type: "tristate" };
    return {
      id: n.id,
      type: "tristate" as const,
      position: n.position,
      rotation: n.data.rotation ?? 0,
      pins: [
        { id: n.data.dataPinId, name: "D", direction: "input" as const, bits: n.data.bits },
        { id: n.data.enablePinId, name: "EN", direction: "input" as const, bits: 1 as const },
        { id: n.data.outputPinId, name: "Y", direction: "output" as const, bits: n.data.bits },
      ],
    };
  },
  fromCircuitNode: (node: CircuitNode) => {
    const dataPin = node.pins.find((p) => p.name === "D");
    const enablePin = node.pins.find((p) => p.name === "EN");
    const outPin = node.pins.find((p) => p.direction === "output");
    const tsBits = (dataPin?.bits ?? 1) as 1 | 8;
    return {
      id: node.id,
      type: "tristate" as const,
      position: node.position,
      data: {
        dataPinId: dataPin?.id ?? node.id,
        enablePinId: enablePin?.id ?? node.id,
        outputPinId: outPin?.id ?? node.id,
        bits: tsBits,
        rotation: (node.rotation ?? 0) as Rotation,
      },
    };
  },
  getPinBits: (node: AppNode, pinId?: string) => {
    const tsData = (node as AppNode & { type: "tristate" }).data as TristateNodeData;
    if (pinId === tsData.enablePinId) return 1 as BitWidth;
    return tsData.bits as BitWidth;
  },
};

export const pullConverter: NodeConverter = {
  toCircuitNode: (node: AppNode) => {
    const n = node as AppNode & { type: "pull" };
    return {
      id: n.id,
      type: n.data.variant as "pullup" | "pulldown",
      position: n.position,
      rotation: n.data.rotation ?? 0,
      pins: [
        { id: n.data.outputPinId, name: "Y", direction: "output" as const, bits: 1 as const },
      ],
    };
  },
  fromCircuitNode: (node: CircuitNode) => {
    const outPin = node.pins.find((p) => p.direction === "output");
    return {
      id: node.id,
      type: "pull" as const,
      position: node.position,
      data: {
        outputPinId: outPin?.id ?? node.id,
        variant: node.type as "pullup" | "pulldown",
        rotation: (node.rotation ?? 0) as Rotation,
      },
    };
  },
  getPinBits: () => 1 as BitWidth,
};
