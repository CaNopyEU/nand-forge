import type { CircuitNode, BitWidth } from "../../engine/types.ts";
import type { AppNode, RomNodeData, RamNodeData } from "../../store/circuit-store.ts";
import type { Rotation } from "../layout.ts";
import type { NodeConverter } from "../node-converters.ts";

export const romConverter: NodeConverter = {
  toCircuitNode: (node: AppNode) => {
    const n = node as AppNode & { type: "rom" };
    return {
      id: n.id,
      type: "rom" as const,
      position: n.position,
      rotation: n.data.rotation ?? 0,
      romData: n.data.romData,
      pins: [
        { id: n.data.addrPinId, name: "Addr", direction: "input" as const, bits: n.data.addressBits },
        { id: n.data.dataPinId, name: "Data", direction: "output" as const, bits: 8 as const },
      ],
    };
  },
  fromCircuitNode: (node: CircuitNode) => {
    const addrPin = node.pins.find((p) => p.direction === "input");
    const dataPin = node.pins.find((p) => p.direction === "output");
    const addrBits = (addrPin?.bits ?? 4) as 4 | 8;
    return {
      id: node.id,
      type: "rom" as const,
      position: node.position,
      data: {
        addrPinId: addrPin?.id ?? node.id,
        dataPinId: dataPin?.id ?? node.id,
        addressBits: addrBits,
        romData: node.romData ?? (new Array(1 << addrBits).fill(0) as number[]),
        rotation: (node.rotation ?? 0) as Rotation,
      },
    };
  },
  getPinBits: (node: AppNode, pinId?: string) => {
    const romData = (node as AppNode & { type: "rom" }).data as RomNodeData;
    if (pinId === romData.addrPinId) return romData.addressBits;
    return 8 as BitWidth;
  },
};

export const ramConverter: NodeConverter = {
  toCircuitNode: (node: AppNode) => {
    const n = node as AppNode & { type: "ram" };
    return {
      id: n.id,
      type: "ram" as const,
      position: n.position,
      rotation: n.data.rotation ?? 0,
      initialData: n.data.initialData,
      pins: [
        { id: n.data.addrPinId, name: "Addr", direction: "input" as const, bits: n.data.addressBits },
        { id: n.data.dataInPinId, name: "DIn", direction: "input" as const, bits: 8 as const },
        { id: n.data.writePinId, name: "WE", direction: "input" as const, bits: 1 as const },
        { id: n.data.clockPinId, name: "CLK", direction: "input" as const, bits: 1 as const },
        { id: n.data.dataOutPinId, name: "DOut", direction: "output" as const, bits: 8 as const },
      ],
    };
  },
  fromCircuitNode: (node: CircuitNode) => {
    const addrPin = node.pins.find((p) => p.name === "Addr");
    const dataInPin = node.pins.find((p) => p.name === "DIn");
    const wePin = node.pins.find((p) => p.name === "WE");
    const clkPin = node.pins.find((p) => p.name === "CLK");
    const dataOutPin = node.pins.find((p) => p.direction === "output");
    const addrBits = (addrPin?.bits ?? 4) as 4 | 8;
    return {
      id: node.id,
      type: "ram" as const,
      position: node.position,
      data: {
        addrPinId: addrPin?.id ?? node.id,
        dataInPinId: dataInPin?.id ?? node.id,
        writePinId: wePin?.id ?? node.id,
        clockPinId: clkPin?.id ?? node.id,
        dataOutPinId: dataOutPin?.id ?? node.id,
        addressBits: addrBits,
        initialData: node.initialData ?? (new Array(1 << addrBits).fill(0) as number[]),
        rotation: (node.rotation ?? 0) as Rotation,
      },
    };
  },
  getPinBits: (node: AppNode, pinId?: string) => {
    const ramData = (node as AppNode & { type: "ram" }).data as RamNodeData;
    if (pinId === ramData.addrPinId) return ramData.addressBits;
    if (pinId === ramData.writePinId) return 1 as BitWidth;
    if (pinId === ramData.clockPinId) return 1 as BitWidth;
    return 8 as BitWidth;
  },
};
