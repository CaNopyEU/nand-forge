import { describe, expect, it } from "vitest";
import type { Edge as RFEdge } from "@xyflow/react";
import type { AppNode } from "../../src/store/circuit-store-types.ts";
import type { BitWidth, Pin } from "../../src/engine/types.ts";
import { canvasToCircuit } from "../../src/utils/canvas-to-circuit.ts";
import { getAppNodeConverter, getEngineNodeConverter } from "../../src/utils/node-converters.ts";

// === Factory helpers ===

const pos = { x: 0, y: 0 };

function makeInputNode(id: string, pinId: string, value = 0, bits: BitWidth = 1): AppNode {
  return { id, type: "circuitInput", position: pos, data: { label: "In", pinId, value, bits, rotation: 0 } };
}

function makeOutputNode(id: string, pinId: string, bits: BitWidth = 1): AppNode {
  return { id, type: "circuitOutput", position: pos, data: { label: "Out", pinId, bits, rotation: 0 } };
}

function makeConstantNode(id: string, pinId: string, value = 0): AppNode {
  return { id, type: "constant", position: pos, data: { label: String(value), pinId, value, rotation: 0 } };
}

function makeProbeNode(id: string, pinId: string): AppNode {
  return { id, type: "probe", position: pos, data: { pinId, rotation: 0 } };
}

function makeClockNode(id: string, pinId: string, value = 0): AppNode {
  return { id, type: "clock", position: pos, data: { pinId, value, rotation: 0 } };
}

function makeButtonNode(id: string, pinId: string, pressed = 0): AppNode {
  return { id, type: "button", position: pos, data: { label: "BTN", pinId, pressed, rotation: 0 } };
}

function makeDipSwitchNode(id: string, pinId: string, value = 0, bits: BitWidth = 8): AppNode {
  return { id, type: "dipSwitch", position: pos, data: { label: "DIP", pinId, value, bits, rotation: 0 } };
}

function makeHexDisplayNode(id: string, pinId: string, bits: BitWidth = 8): AppNode {
  return { id, type: "hexDisplay", position: pos, data: { pinId, bits, rotation: 0 } };
}

function makeLedBarNode(id: string, pinId: string, bits: BitWidth = 8): AppNode {
  return { id, type: "ledBar", position: pos, data: { pinId, bits, rotation: 0 } };
}

function makeTunnelNode(id: string, pinId: string, direction: "in" | "out" = "in", bits: BitWidth = 1): AppNode {
  return { id, type: "tunnel", position: pos, data: { label: "T", pinId, bits, direction, rotation: 0 } };
}

function makeRomNode(id: string, addrPinId: string, dataPinId: string, addressBits: 4 | 8 = 4): AppNode {
  return { id, type: "rom", position: pos, data: { addrPinId, dataPinId, addressBits, romData: new Array(1 << addressBits).fill(0) as number[], rotation: 0 } };
}

function makeRamNode(id: string): AppNode {
  return { id, type: "ram", position: pos, data: { addrPinId: "a1", dataInPinId: "d1", writePinId: "w1", clockPinId: "c1", dataOutPinId: "o1", addressBits: 4 as const, initialData: new Array(16).fill(0) as number[], rotation: 0 } };
}

function makeTristateNode(id: string, dataPinId: string, enablePinId: string, outputPinId: string, bits: 1 | 8 = 1): AppNode {
  return { id, type: "tristate", position: pos, data: { dataPinId, enablePinId, outputPinId, bits, rotation: 0 } };
}

function makePullNode(id: string, outputPinId: string, variant: "pullup" | "pulldown" = "pullup"): AppNode {
  return { id, type: "pull", position: pos, data: { outputPinId, variant, rotation: 0 } };
}

function makeModuleNode(id: string, moduleId: string, pins: Pin[]): AppNode {
  return { id, type: "module", position: pos, data: { label: "Mod", moduleId, pins, rotation: 0 } };
}

function makeRFEdge(id: string, source: string, sourceHandle: string, target: string, targetHandle: string, color?: string): RFEdge {
  return { id, source, sourceHandle, target, targetHandle, ...(color ? { data: { color } } : {}) };
}

// === Node conversion (toCircuitNode) ===

describe("node conversion", () => {
  it("converts circuitInput", () => {
    const node = makeInputNode("n1", "p1", 1, 4);
    const cn = getAppNodeConverter("circuitInput").toCircuitNode(node);
    expect(cn.type).toBe("input");
    expect(cn.id).toBe("n1");
    expect(cn.pins).toHaveLength(1);
    expect(cn.pins[0]!.id).toBe("p1");
    expect(cn.pins[0]!.direction).toBe("output");
    expect(cn.pins[0]!.bits).toBe(4);
  });

  it("converts circuitOutput", () => {
    const cn = getAppNodeConverter("circuitOutput").toCircuitNode(makeOutputNode("n1", "p1", 8));
    expect(cn.type).toBe("output");
    expect(cn.pins[0]!.direction).toBe("input");
    expect(cn.pins[0]!.bits).toBe(8);
  });

  it("converts constant", () => {
    const cn = getAppNodeConverter("constant").toCircuitNode(makeConstantNode("n1", "p1", 1));
    expect(cn.type).toBe("constant");
    expect(cn.pins[0]!.direction).toBe("output");
    expect(cn.pins[0]!.bits).toBe(1);
  });

  it("converts probe", () => {
    const cn = getAppNodeConverter("probe").toCircuitNode(makeProbeNode("n1", "p1"));
    expect(cn.type).toBe("probe");
    expect(cn.pins[0]!.direction).toBe("input");
  });

  it("converts clock", () => {
    const cn = getAppNodeConverter("clock").toCircuitNode(makeClockNode("n1", "p1"));
    expect(cn.type).toBe("clock");
    expect(cn.pins[0]!.direction).toBe("output");
  });

  it("converts button", () => {
    const cn = getAppNodeConverter("button").toCircuitNode(makeButtonNode("n1", "p1"));
    expect(cn.type).toBe("button");
    expect(cn.pins[0]!.direction).toBe("output");
  });

  it("converts dipSwitch", () => {
    const cn = getAppNodeConverter("dipSwitch").toCircuitNode(makeDipSwitchNode("n1", "p1", 0, 8));
    expect(cn.type).toBe("input");
    expect(cn.variant).toBe("dip-switch");
    expect(cn.pins[0]!.bits).toBe(8);
  });

  it("converts hexDisplay", () => {
    const cn = getAppNodeConverter("hexDisplay").toCircuitNode(makeHexDisplayNode("n1", "p1"));
    expect(cn.type).toBe("output");
    expect(cn.variant).toBe("hex-display");
  });

  it("converts ledBar", () => {
    const cn = getAppNodeConverter("ledBar").toCircuitNode(makeLedBarNode("n1", "p1"));
    expect(cn.type).toBe("output");
    expect(cn.variant).toBe("led-bar");
  });

  it("converts tunnel (in)", () => {
    const cn = getAppNodeConverter("tunnel").toCircuitNode(makeTunnelNode("n1", "p1", "in", 4));
    expect(cn.type).toBe("tunnel");
    expect(cn.variant).toBe("in");
    expect(cn.pins).toHaveLength(2);
    expect(cn.pins[0]!.direction).toBe("input");
    expect(cn.pins[0]!.id).toBe("p1");
    expect(cn.pins[1]!.direction).toBe("output");
  });

  it("converts tunnel (out)", () => {
    const cn = getAppNodeConverter("tunnel").toCircuitNode(makeTunnelNode("n1", "p1", "out"));
    expect(cn.variant).toBe("out");
    expect(cn.pins[0]!.direction).toBe("input");
    expect(cn.pins[1]!.direction).toBe("output");
    expect(cn.pins[1]!.id).toBe("p1");
  });

  it("converts rom", () => {
    const cn = getAppNodeConverter("rom").toCircuitNode(makeRomNode("n1", "a1", "d1", 4));
    expect(cn.type).toBe("rom");
    expect(cn.pins).toHaveLength(2);
    expect(cn.pins[0]!.name).toBe("Addr");
    expect(cn.pins[1]!.name).toBe("Data");
    expect(cn.romData).toEqual(new Array(16).fill(0));
  });

  it("converts ram", () => {
    const cn = getAppNodeConverter("ram").toCircuitNode(makeRamNode("n1"));
    expect(cn.type).toBe("ram");
    expect(cn.pins).toHaveLength(5);
  });

  it("converts tristate", () => {
    const cn = getAppNodeConverter("tristate").toCircuitNode(makeTristateNode("n1", "dp", "ep", "op"));
    expect(cn.type).toBe("tristate");
    expect(cn.pins).toHaveLength(3);
    expect(cn.pins[0]!.name).toBe("D");
    expect(cn.pins[1]!.name).toBe("EN");
    expect(cn.pins[2]!.name).toBe("Y");
  });

  it("converts pull (pullup)", () => {
    const cn = getAppNodeConverter("pull").toCircuitNode(makePullNode("n1", "op", "pullup"));
    expect(cn.type).toBe("pullup");
    expect(cn.pins).toHaveLength(1);
  });

  it("converts pull (pulldown)", () => {
    const cn = getAppNodeConverter("pull").toCircuitNode(makePullNode("n1", "op", "pulldown"));
    expect(cn.type).toBe("pulldown");
  });

  it("converts module", () => {
    const pins: Pin[] = [
      { id: "i1", name: "A", direction: "input", bits: 1 },
      { id: "o1", name: "Out", direction: "output", bits: 1 },
    ];
    const cn = getAppNodeConverter("module").toCircuitNode(makeModuleNode("n1", "my-mod", pins));
    expect(cn.type).toBe("module");
    expect(cn.moduleId).toBe("my-mod");
    expect(cn.pins).toHaveLength(2);
  });
});

// === Edge conversion ===

describe("edge conversion", () => {
  it("converts RF edges to engine edges", () => {
    const node = makeInputNode("n1", "p1");
    const node2 = makeOutputNode("n2", "p2");
    const edge = makeRFEdge("e1", "n1", "p1", "n2", "p2");
    const { circuit } = canvasToCircuit([node, node2], [edge]);
    expect(circuit.edges).toHaveLength(1);
    expect(circuit.edges[0]!.fromNodeId).toBe("n1");
    expect(circuit.edges[0]!.fromPinId).toBe("p1");
    expect(circuit.edges[0]!.toNodeId).toBe("n2");
    expect(circuit.edges[0]!.toPinId).toBe("p2");
  });

  it("skips edges without handles", () => {
    const edge: RFEdge = { id: "e1", source: "n1", target: "n2" };
    const { circuit } = canvasToCircuit([], [edge]);
    expect(circuit.edges).toHaveLength(0);
  });

  it("preserves edge color", () => {
    const edge = makeRFEdge("e1", "n1", "p1", "n2", "p2", "#ff0000");
    const { circuit } = canvasToCircuit([], [edge]);
    expect(circuit.edges[0]!.color).toBe("#ff0000");
  });
});

// === Input values extraction ===

describe("inputValues extraction", () => {
  it("collects values from circuitInput nodes", () => {
    const node = makeInputNode("n1", "p1", 1);
    const { inputValues } = canvasToCircuit([node], []);
    expect(inputValues["p1"]).toBe(1);
  });

  it("collects values from constant nodes", () => {
    const node = makeConstantNode("n1", "p1", 1);
    const { inputValues } = canvasToCircuit([node], []);
    expect(inputValues["p1"]).toBe(1);
  });

  it("collects values from clock nodes", () => {
    const node = makeClockNode("n1", "p1", 1);
    const { inputValues } = canvasToCircuit([node], []);
    expect(inputValues["p1"]).toBe(1);
  });

  it("collects values from button nodes", () => {
    const node = makeButtonNode("n1", "p1", 1);
    const { inputValues } = canvasToCircuit([node], []);
    expect(inputValues["p1"]).toBe(1);
  });

  it("collects values from dipSwitch nodes", () => {
    const node = makeDipSwitchNode("n1", "p1", 42);
    const { inputValues } = canvasToCircuit([node], []);
    expect(inputValues["p1"]).toBe(42);
  });

  it("does not extract values from output nodes", () => {
    const node = makeOutputNode("n1", "p1");
    const { inputValues } = canvasToCircuit([node], []);
    expect(Object.keys(inputValues)).toHaveLength(0);
  });
});

// === Round-trip: AppNode → CircuitNode → AppNode ===

describe("round-trip", () => {
  it("round-trips circuitInput", () => {
    const original = makeInputNode("n1", "p1", 0, 4);
    const cn = getAppNodeConverter("circuitInput").toCircuitNode(original);
    const restored = getEngineNodeConverter(cn.type, cn.variant).fromCircuitNode(cn);
    const d = restored.data as Record<string, unknown>;
    expect(restored.type).toBe("circuitInput");
    expect(restored.id).toBe("n1");
    expect(d["pinId"]).toBe("p1");
    expect(d["bits"]).toBe(4);
  });

  it("round-trips circuitOutput", () => {
    const original = makeOutputNode("n1", "p1", 8);
    const cn = getAppNodeConverter("circuitOutput").toCircuitNode(original);
    const restored = getEngineNodeConverter(cn.type, cn.variant).fromCircuitNode(cn);
    const d = restored.data as Record<string, unknown>;
    expect(restored.type).toBe("circuitOutput");
    expect(d["pinId"]).toBe("p1");
  });

  it("round-trips module", () => {
    const pins: Pin[] = [
      { id: "i1", name: "A", direction: "input", bits: 1 },
      { id: "o1", name: "Out", direction: "output", bits: 1 },
    ];
    const original = makeModuleNode("n1", "my-mod", pins);
    const cn = getAppNodeConverter("module").toCircuitNode(original);
    const restored = getEngineNodeConverter(cn.type, cn.variant).fromCircuitNode(cn);
    const d = restored.data as Record<string, unknown>;
    expect(restored.type).toBe("module");
    expect(d["moduleId"]).toBe("my-mod");
    expect(d["pins"]).toEqual(pins);
  });

  it("round-trips rom", () => {
    const original = makeRomNode("n1", "a1", "d1", 4);
    const cn = getAppNodeConverter("rom").toCircuitNode(original);
    const restored = getEngineNodeConverter(cn.type, cn.variant).fromCircuitNode(cn);
    const d = restored.data as Record<string, unknown>;
    expect(restored.type).toBe("rom");
    expect(d["addrPinId"]).toBe("a1");
    expect(d["dataPinId"]).toBe("d1");
  });

  it("round-trips tunnel (in)", () => {
    const original = makeTunnelNode("n1", "p1", "in", 4);
    const cn = getAppNodeConverter("tunnel").toCircuitNode(original);
    const restored = getEngineNodeConverter(cn.type, cn.variant).fromCircuitNode(cn);
    const d = restored.data as Record<string, unknown>;
    expect(restored.type).toBe("tunnel");
    expect(d["pinId"]).toBe("p1");
    expect(d["direction"]).toBe("in");
  });
});
