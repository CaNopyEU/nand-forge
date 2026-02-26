import type { CircuitNode, BitWidth } from "../../engine/types.ts";
import type { AppNode } from "../../store/circuit-store.ts";
import type { Rotation } from "../layout.ts";
import type { NodeConverter } from "../node-converters.ts";

export const circuitInputConverter: NodeConverter = {
  toCircuitNode: (node: AppNode) => {
    const n = node as AppNode & { type: "circuitInput" };
    return {
      id: n.id,
      type: "input" as const,
      position: n.position,
      rotation: n.data.rotation ?? 0,
      pins: [{
        id: n.data.pinId,
        name: n.data.label,
        direction: "output" as const,
        bits: n.data.bits ?? 1,
      }],
    };
  },
  fromCircuitNode: (node: CircuitNode) => ({
    id: node.id,
    type: "circuitInput" as const,
    position: node.position,
    data: {
      label: node.pins[0]?.name ?? "Input",
      pinId: node.pins[0]?.id ?? node.id,
      value: 0,
      bits: (node.pins[0]?.bits ?? 1) as BitWidth,
      rotation: (node.rotation ?? 0) as Rotation,
    },
  }),
  extractInputValue: (node: AppNode) => {
    const n = node as AppNode & { type: "circuitInput" };
    return { [n.data.pinId]: n.data.value };
  },
  getPinBits: (node: AppNode) => (node as AppNode & { type: "circuitInput" }).data.bits ?? 1,
};

export const circuitOutputConverter: NodeConverter = {
  toCircuitNode: (node: AppNode) => {
    const n = node as AppNode & { type: "circuitOutput" };
    return {
      id: n.id,
      type: "output" as const,
      position: n.position,
      rotation: n.data.rotation ?? 0,
      pins: [{
        id: n.data.pinId,
        name: n.data.label,
        direction: "input" as const,
        bits: n.data.bits ?? 1,
      }],
    };
  },
  fromCircuitNode: (node: CircuitNode) => ({
    id: node.id,
    type: "circuitOutput" as const,
    position: node.position,
    data: {
      label: node.pins[0]?.name ?? "Output",
      pinId: node.pins[0]?.id ?? node.id,
      bits: (node.pins[0]?.bits ?? 1) as BitWidth,
      rotation: (node.rotation ?? 0) as Rotation,
    },
  }),
  getPinBits: (node: AppNode) => (node as AppNode & { type: "circuitOutput" }).data.bits ?? 1,
};

export const constantConverter: NodeConverter = {
  toCircuitNode: (node: AppNode) => {
    const n = node as AppNode & { type: "constant" };
    return {
      id: n.id,
      type: "constant" as const,
      position: n.position,
      rotation: n.data.rotation ?? 0,
      pins: [{
        id: n.data.pinId,
        name: n.data.label,
        direction: "output" as const,
        bits: 1 as const,
      }],
    };
  },
  fromCircuitNode: (node: CircuitNode) => {
    const pinName = node.pins[0]?.name ?? "0";
    const value = pinName === "1" ? 1 : 0;
    return {
      id: node.id,
      type: "constant" as const,
      position: node.position,
      data: {
        label: pinName,
        pinId: node.pins[0]?.id ?? node.id,
        value,
        rotation: (node.rotation ?? 0) as Rotation,
      },
    };
  },
  extractInputValue: (node: AppNode) => {
    const n = node as AppNode & { type: "constant" };
    return { [n.data.pinId]: n.data.value };
  },
  getPinBits: () => 1,
};

export const probeConverter: NodeConverter = {
  toCircuitNode: (node: AppNode) => {
    const n = node as AppNode & { type: "probe" };
    return {
      id: n.id,
      type: "probe" as const,
      position: n.position,
      rotation: n.data.rotation ?? 0,
      pins: [{
        id: n.data.pinId,
        name: "P",
        direction: "input" as const,
        bits: 1 as const,
      }],
    };
  },
  fromCircuitNode: (node: CircuitNode) => ({
    id: node.id,
    type: "probe" as const,
    position: node.position,
    data: {
      pinId: node.pins[0]?.id ?? node.id,
      rotation: (node.rotation ?? 0) as Rotation,
    },
  }),
  getPinBits: () => 1,
};

export const clockConverter: NodeConverter = {
  toCircuitNode: (node: AppNode) => {
    const n = node as AppNode & { type: "clock" };
    return {
      id: n.id,
      type: "clock" as const,
      position: n.position,
      rotation: n.data.rotation ?? 0,
      pins: [{
        id: n.data.pinId,
        name: "CLK",
        direction: "output" as const,
        bits: 1 as const,
      }],
    };
  },
  fromCircuitNode: (node: CircuitNode) => ({
    id: node.id,
    type: "clock" as const,
    position: node.position,
    data: {
      pinId: node.pins[0]?.id ?? node.id,
      value: 0,
      rotation: (node.rotation ?? 0) as Rotation,
    },
  }),
  extractInputValue: (node: AppNode) => {
    const n = node as AppNode & { type: "clock" };
    return { [n.data.pinId]: n.data.value };
  },
  getPinBits: () => 1,
};

export const buttonConverter: NodeConverter = {
  toCircuitNode: (node: AppNode) => {
    const n = node as AppNode & { type: "button" };
    return {
      id: n.id,
      type: "button" as const,
      position: n.position,
      rotation: n.data.rotation ?? 0,
      pins: [{
        id: n.data.pinId,
        name: n.data.label,
        direction: "output" as const,
        bits: 1 as const,
      }],
    };
  },
  fromCircuitNode: (node: CircuitNode) => ({
    id: node.id,
    type: "button" as const,
    position: node.position,
    data: {
      label: node.pins[0]?.name ?? "BTN",
      pinId: node.pins[0]?.id ?? node.id,
      pressed: 0,
      rotation: (node.rotation ?? 0) as Rotation,
    },
  }),
  extractInputValue: (node: AppNode) => {
    const n = node as AppNode & { type: "button" };
    return { [n.data.pinId]: n.data.pressed };
  },
  getPinBits: () => 1,
};
