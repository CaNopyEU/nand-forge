import type { CircuitNode, BitWidth } from "../../engine/types.ts";
import type { AppNode } from "../../store/circuit-store.ts";
import type { Rotation } from "../layout.ts";
import type { NodeConverter } from "../node-converters.ts";

export const dipSwitchConverter: NodeConverter = {
  toCircuitNode: (node: AppNode) => {
    const n = node as AppNode & { type: "dipSwitch" };
    return {
      id: n.id,
      type: "input" as const,
      variant: "dip-switch",
      position: n.position,
      rotation: n.data.rotation ?? 0,
      pins: [{
        id: n.data.pinId,
        name: n.data.label,
        direction: "output" as const,
        bits: n.data.bits ?? 8,
      }],
    };
  },
  fromCircuitNode: (node: CircuitNode) => ({
    id: node.id,
    type: "dipSwitch" as const,
    position: node.position,
    data: {
      label: node.pins[0]?.name ?? "DIP",
      pinId: node.pins[0]?.id ?? node.id,
      value: 0,
      bits: (node.pins[0]?.bits ?? 8) as BitWidth,
      rotation: (node.rotation ?? 0) as Rotation,
    },
  }),
  extractInputValue: (node: AppNode) => {
    const n = node as AppNode & { type: "dipSwitch" };
    return { [n.data.pinId]: n.data.value };
  },
  getPinBits: (node: AppNode) => (node as AppNode & { type: "dipSwitch" }).data.bits ?? 8,
};

export const hexDisplayConverter: NodeConverter = {
  toCircuitNode: (node: AppNode) => {
    const n = node as AppNode & { type: "hexDisplay" };
    return {
      id: n.id,
      type: "output" as const,
      variant: "hex-display",
      position: n.position,
      rotation: n.data.rotation ?? 0,
      pins: [{
        id: n.data.pinId,
        name: "HEX",
        direction: "input" as const,
        bits: n.data.bits ?? 8,
      }],
    };
  },
  fromCircuitNode: (node: CircuitNode) => ({
    id: node.id,
    type: "hexDisplay" as const,
    position: node.position,
    data: {
      pinId: node.pins[0]?.id ?? node.id,
      bits: (node.pins[0]?.bits ?? 8) as BitWidth,
      rotation: (node.rotation ?? 0) as Rotation,
    },
  }),
  getPinBits: (node: AppNode) => (node as AppNode & { type: "hexDisplay" }).data.bits ?? 8,
};

export const ledBarConverter: NodeConverter = {
  toCircuitNode: (node: AppNode) => {
    const n = node as AppNode & { type: "ledBar" };
    return {
      id: n.id,
      type: "output" as const,
      variant: "led-bar",
      position: n.position,
      rotation: n.data.rotation ?? 0,
      pins: [{
        id: n.data.pinId,
        name: "LEDs",
        direction: "input" as const,
        bits: n.data.bits ?? 8,
      }],
    };
  },
  fromCircuitNode: (node: CircuitNode) => ({
    id: node.id,
    type: "ledBar" as const,
    position: node.position,
    data: {
      pinId: node.pins[0]?.id ?? node.id,
      bits: (node.pins[0]?.bits ?? 8) as BitWidth,
      rotation: (node.rotation ?? 0) as Rotation,
    },
  }),
  getPinBits: (node: AppNode) => (node as AppNode & { type: "ledBar" }).data.bits ?? 8,
};
