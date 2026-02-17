import { describe, expect, it } from "vitest";
import type { Circuit, CircuitNode, Edge } from "../../src/engine/types.ts";
import { evaluateCircuitFull, pinKey, Z_VALUE, WEAK_1, WEAK_0, CONFLICT, resolveBus, type InstanceState } from "../../src/engine/simulate.ts";

// === Helpers ===

function makeInputNode(id: string, pinId: string, bits: number = 1): CircuitNode {
  return {
    id, type: "input",
    position: { x: 0, y: 0 }, rotation: 0,
    pins: [{ id: pinId, name: "In", direction: "output", bits: bits as 1 | 4 | 8 | 16 }],
  };
}

function makeOutputNode(id: string, pinId: string, bits: number = 1): CircuitNode {
  return {
    id, type: "output",
    position: { x: 0, y: 0 }, rotation: 0,
    pins: [{ id: pinId, name: "Out", direction: "input", bits: bits as 1 | 4 | 8 | 16 }],
  };
}

function makeTristateNode(id: string, dataPinId: string, enablePinId: string, outPinId: string, bits: 1 | 8 = 1): CircuitNode {
  return {
    id, type: "tristate",
    position: { x: 0, y: 0 }, rotation: 0,
    pins: [
      { id: dataPinId,   name: "D",  direction: "input",  bits },
      { id: enablePinId, name: "EN", direction: "input",  bits: 1 },
      { id: outPinId,    name: "Y",  direction: "output", bits },
    ],
  };
}

function makePullNode(id: string, outPinId: string, variant: "pullup" | "pulldown"): CircuitNode {
  return {
    id, type: variant,
    position: { x: 0, y: 0 }, rotation: 0,
    pins: [{ id: outPinId, name: "Y", direction: "output", bits: 1 }],
  };
}

function makeEdge(id: string, fromNodeId: string, fromPinId: string, toNodeId: string, toPinId: string): Edge {
  return { id, fromNodeId, fromPinId, toNodeId, toPinId };
}

// === resolveBus unit tests ===

describe("resolveBus", () => {
  it("all-Z → Z", () => {
    expect(resolveBus([Z_VALUE, Z_VALUE])).toBe(Z_VALUE);
  });

  it("single non-Z → that value", () => {
    expect(resolveBus([Z_VALUE, 1])).toBe(1);
    expect(resolveBus([0, Z_VALUE])).toBe(0);
  });

  it("multiple same strong → that value (no conflict)", () => {
    expect(resolveBus([1, 1, 1])).toBe(1);
    expect(resolveBus([0, 0])).toBe(0);
  });

  it("multiple differing strong → CONFLICT", () => {
    expect(resolveBus([0, 1])).toBe(CONFLICT);
    expect(resolveBus([1, 0, 1])).toBe(CONFLICT);
  });

  it("only WEAK_1 → 1", () => {
    expect(resolveBus([WEAK_1, WEAK_1])).toBe(1);
  });

  it("only WEAK_0 → 0", () => {
    expect(resolveBus([WEAK_0, WEAK_0])).toBe(0);
  });

  it("WEAK_1 + WEAK_0 → CONFLICT", () => {
    expect(resolveBus([WEAK_1, WEAK_0])).toBe(CONFLICT);
  });

  it("strong beats weak — strong 1 beats WEAK_0", () => {
    expect(resolveBus([1, WEAK_0])).toBe(1);
    expect(resolveBus([0, WEAK_1])).toBe(0);
  });
});

// === Tri-state buffer simulation tests ===

describe("Tristate buffer simulation", () => {
  it("passes data when EN=1", () => {
    const circuit: Circuit = {
      id: "test", name: "tristate-on",
      nodes: [
        makeInputNode("data", "dataPin"),
        makeInputNode("en",   "enPin"),
        makeTristateNode("ts", "tsData", "tsEn", "tsOut"),
        makeOutputNode("out", "outPin"),
      ],
      edges: [
        makeEdge("e1", "data", "dataPin", "ts", "tsData"),
        makeEdge("e2", "en",   "enPin",   "ts", "tsEn"),
        makeEdge("e3", "ts",   "tsOut",   "out", "outPin"),
      ],
    };
    const iStates = new Map<string, InstanceState>();

    // EN=1, D=1 → Y=1
    let pv = evaluateCircuitFull(circuit, { dataPin: 1, enPin: 1 }, [], iStates);
    expect(pv.get(pinKey("ts", "tsOut"))).toBe(1);
    expect(pv.get(pinKey("out", "outPin"))).toBe(1);

    // EN=1, D=0 → Y=0
    pv = evaluateCircuitFull(circuit, { dataPin: 0, enPin: 1 }, [], iStates);
    expect(pv.get(pinKey("ts", "tsOut"))).toBe(0);
  });

  it("outputs Z when EN=0", () => {
    const circuit: Circuit = {
      id: "test", name: "tristate-off",
      nodes: [
        makeInputNode("data", "dataPin"),
        makeInputNode("en",   "enPin"),
        makeTristateNode("ts", "tsData", "tsEn", "tsOut"),
        makeOutputNode("out", "outPin"),
      ],
      edges: [
        makeEdge("e1", "data", "dataPin", "ts", "tsData"),
        makeEdge("e2", "en",   "enPin",   "ts", "tsEn"),
        makeEdge("e3", "ts",   "tsOut",   "out", "outPin"),
      ],
    };
    const iStates = new Map<string, InstanceState>();

    // EN=0, D=1 → Y=Z
    const pv = evaluateCircuitFull(circuit, { dataPin: 1, enPin: 0 }, [], iStates);
    expect(pv.get(pinKey("ts", "tsOut"))).toBe(Z_VALUE);
    // Output node sees Z
    expect(pv.get(pinKey("out", "outPin"))).toBe(Z_VALUE);
  });

  it("8-bit tristate passes multi-bit data when enabled", () => {
    const circuit: Circuit = {
      id: "test", name: "tristate-8bit",
      nodes: [
        makeInputNode("data", "dataPin", 8),
        makeInputNode("en",   "enPin"),
        makeTristateNode("ts", "tsData", "tsEn", "tsOut", 8),
        makeOutputNode("out", "outPin", 8),
      ],
      edges: [
        makeEdge("e1", "data", "dataPin", "ts", "tsData"),
        makeEdge("e2", "en",   "enPin",   "ts", "tsEn"),
        makeEdge("e3", "ts",   "tsOut",   "out", "outPin"),
      ],
    };
    const iStates = new Map<string, InstanceState>();

    const pv = evaluateCircuitFull(circuit, { dataPin: 0xAB, enPin: 1 }, [], iStates);
    expect(pv.get(pinKey("ts", "tsOut"))).toBe(0xAB);
  });

  it("two tristates sharing bus — one enabled → that value", () => {
    // ts1 (EN=1, D=0) + ts2 (EN=0, D=1) → bus = 0
    const circuit: Circuit = {
      id: "test", name: "bus-one-driver",
      nodes: [
        makeInputNode("d1",  "d1Pin"),
        makeInputNode("en1", "en1Pin"),
        makeInputNode("d2",  "d2Pin"),
        makeInputNode("en2", "en2Pin"),
        makeTristateNode("ts1", "ts1d", "ts1e", "ts1out"),
        makeTristateNode("ts2", "ts2d", "ts2e", "ts2out"),
        makeOutputNode("out", "outPin"),
      ],
      edges: [
        makeEdge("e1", "d1",  "d1Pin",  "ts1", "ts1d"),
        makeEdge("e2", "en1", "en1Pin", "ts1", "ts1e"),
        makeEdge("e3", "d2",  "d2Pin",  "ts2", "ts2d"),
        makeEdge("e4", "en2", "en2Pin", "ts2", "ts2e"),
        makeEdge("e5", "ts1", "ts1out", "out", "outPin"),
        makeEdge("e6", "ts2", "ts2out", "out", "outPin"),
      ],
    };
    const iStates = new Map<string, InstanceState>();

    const pv = evaluateCircuitFull(circuit, { d1Pin: 0, en1Pin: 1, d2Pin: 1, en2Pin: 0 }, [], iStates);
    expect(pv.get(pinKey("out", "outPin"))).toBe(0);
  });

  it("two tristates both enabled with same data → that value (no conflict)", () => {
    const circuit: Circuit = {
      id: "test", name: "bus-agree",
      nodes: [
        makeInputNode("d1",  "d1Pin"),
        makeInputNode("en1", "en1Pin"),
        makeInputNode("d2",  "d2Pin"),
        makeInputNode("en2", "en2Pin"),
        makeTristateNode("ts1", "ts1d", "ts1e", "ts1out"),
        makeTristateNode("ts2", "ts2d", "ts2e", "ts2out"),
        makeOutputNode("out", "outPin"),
      ],
      edges: [
        makeEdge("e1", "d1",  "d1Pin",  "ts1", "ts1d"),
        makeEdge("e2", "en1", "en1Pin", "ts1", "ts1e"),
        makeEdge("e3", "d2",  "d2Pin",  "ts2", "ts2d"),
        makeEdge("e4", "en2", "en2Pin", "ts2", "ts2e"),
        makeEdge("e5", "ts1", "ts1out", "out", "outPin"),
        makeEdge("e6", "ts2", "ts2out", "out", "outPin"),
      ],
    };
    const iStates = new Map<string, InstanceState>();

    const pv = evaluateCircuitFull(circuit, { d1Pin: 1, en1Pin: 1, d2Pin: 1, en2Pin: 1 }, [], iStates);
    expect(pv.get(pinKey("out", "outPin"))).toBe(1);
  });

  it("two tristates both enabled with conflicting data → CONFLICT", () => {
    const circuit: Circuit = {
      id: "test", name: "bus-conflict",
      nodes: [
        makeInputNode("d1",  "d1Pin"),
        makeInputNode("en1", "en1Pin"),
        makeInputNode("d2",  "d2Pin"),
        makeInputNode("en2", "en2Pin"),
        makeTristateNode("ts1", "ts1d", "ts1e", "ts1out"),
        makeTristateNode("ts2", "ts2d", "ts2e", "ts2out"),
        makeOutputNode("out", "outPin"),
      ],
      edges: [
        makeEdge("e1", "d1",  "d1Pin",  "ts1", "ts1d"),
        makeEdge("e2", "en1", "en1Pin", "ts1", "ts1e"),
        makeEdge("e3", "d2",  "d2Pin",  "ts2", "ts2d"),
        makeEdge("e4", "en2", "en2Pin", "ts2", "ts2e"),
        makeEdge("e5", "ts1", "ts1out", "out", "outPin"),
        makeEdge("e6", "ts2", "ts2out", "out", "outPin"),
      ],
    };
    const iStates = new Map<string, InstanceState>();

    const pv = evaluateCircuitFull(circuit, { d1Pin: 0, en1Pin: 1, d2Pin: 1, en2Pin: 1 }, [], iStates);
    expect(pv.get(pinKey("out", "outPin"))).toBe(CONFLICT);
  });

  it("both tristates disabled → bus is Z", () => {
    const circuit: Circuit = {
      id: "test", name: "bus-z",
      nodes: [
        makeInputNode("d1",  "d1Pin"),
        makeInputNode("en1", "en1Pin"),
        makeInputNode("d2",  "d2Pin"),
        makeInputNode("en2", "en2Pin"),
        makeTristateNode("ts1", "ts1d", "ts1e", "ts1out"),
        makeTristateNode("ts2", "ts2d", "ts2e", "ts2out"),
        makeOutputNode("out", "outPin"),
      ],
      edges: [
        makeEdge("e1", "d1",  "d1Pin",  "ts1", "ts1d"),
        makeEdge("e2", "en1", "en1Pin", "ts1", "ts1e"),
        makeEdge("e3", "d2",  "d2Pin",  "ts2", "ts2d"),
        makeEdge("e4", "en2", "en2Pin", "ts2", "ts2e"),
        makeEdge("e5", "ts1", "ts1out", "out", "outPin"),
        makeEdge("e6", "ts2", "ts2out", "out", "outPin"),
      ],
    };
    const iStates = new Map<string, InstanceState>();

    const pv = evaluateCircuitFull(circuit, { d1Pin: 1, en1Pin: 0, d2Pin: 1, en2Pin: 0 }, [], iStates);
    expect(pv.get(pinKey("out", "outPin"))).toBe(Z_VALUE);
  });
});

// === Pull-up / Pull-down tests ===

describe("Pull-up / Pull-down simulation", () => {
  it("pull-up alone → output reads as 1 (WEAK_1 → resolved to 1)", () => {
    const circuit: Circuit = {
      id: "test", name: "pullup",
      nodes: [
        makePullNode("pu", "puOut", "pullup"),
        makeOutputNode("out", "outPin"),
      ],
      edges: [
        makeEdge("e1", "pu", "puOut", "out", "outPin"),
      ],
    };
    const iStates = new Map<string, InstanceState>();
    const pv = evaluateCircuitFull(circuit, {}, [], iStates);
    // Single WEAK_1 driver → resolves to 1
    expect(pv.get(pinKey("out", "outPin"))).toBe(1);
  });

  it("pull-down alone → output reads as 0 (WEAK_0 → resolved to 0)", () => {
    const circuit: Circuit = {
      id: "test", name: "pulldown",
      nodes: [
        makePullNode("pd", "pdOut", "pulldown"),
        makeOutputNode("out", "outPin"),
      ],
      edges: [
        makeEdge("e1", "pd", "pdOut", "out", "outPin"),
      ],
    };
    const iStates = new Map<string, InstanceState>();
    const pv = evaluateCircuitFull(circuit, {}, [], iStates);
    expect(pv.get(pinKey("out", "outPin"))).toBe(0);
  });

  it("strong driver overrides pull-up", () => {
    const circuit: Circuit = {
      id: "test", name: "strong-beats-pullup",
      nodes: [
        makeInputNode("in", "inPin"),
        makePullNode("pu", "puOut", "pullup"),
        makeOutputNode("out", "outPin"),
      ],
      edges: [
        makeEdge("e1", "in", "inPin",  "out", "outPin"),
        makeEdge("e2", "pu", "puOut",  "out", "outPin"),
      ],
    };
    const iStates = new Map<string, InstanceState>();

    // Strong 0 overrides pull-up (WEAK_1)
    let pv = evaluateCircuitFull(circuit, { inPin: 0 }, [], iStates);
    expect(pv.get(pinKey("out", "outPin"))).toBe(0);

    // Strong 1 agrees with pull-up → 1
    pv = evaluateCircuitFull(circuit, { inPin: 1 }, [], iStates);
    expect(pv.get(pinKey("out", "outPin"))).toBe(1);
  });

  it("tristate disabled + pull-up → pull-up wins (1)", () => {
    const circuit: Circuit = {
      id: "test", name: "tristate-pullup",
      nodes: [
        makeInputNode("data", "dataPin"),
        makeInputNode("en",   "enPin"),
        makeTristateNode("ts", "tsData", "tsEn", "tsOut"),
        makePullNode("pu", "puOut", "pullup"),
        makeOutputNode("out", "outPin"),
      ],
      edges: [
        makeEdge("e1", "data", "dataPin", "ts", "tsData"),
        makeEdge("e2", "en",   "enPin",   "ts", "tsEn"),
        makeEdge("e3", "ts",   "tsOut",   "out", "outPin"),
        makeEdge("e4", "pu",   "puOut",   "out", "outPin"),
      ],
    };
    const iStates = new Map<string, InstanceState>();

    // Tristate off (EN=0) + pull-up → bus pulled to 1
    const pv = evaluateCircuitFull(circuit, { dataPin: 0, enPin: 0 }, [], iStates);
    expect(pv.get(pinKey("out", "outPin"))).toBe(1);
  });

  it("tristate enabled + pull-up — strong wins over weak", () => {
    const circuit: Circuit = {
      id: "test", name: "tristate-strong-beats-pullup",
      nodes: [
        makeInputNode("data", "dataPin"),
        makeInputNode("en",   "enPin"),
        makeTristateNode("ts", "tsData", "tsEn", "tsOut"),
        makePullNode("pu", "puOut", "pullup"),
        makeOutputNode("out", "outPin"),
      ],
      edges: [
        makeEdge("e1", "data", "dataPin", "ts", "tsData"),
        makeEdge("e2", "en",   "enPin",   "ts", "tsEn"),
        makeEdge("e3", "ts",   "tsOut",   "out", "outPin"),
        makeEdge("e4", "pu",   "puOut",   "out", "outPin"),
      ],
    };
    const iStates = new Map<string, InstanceState>();

    // Tristate ON with D=0 → strong 0 beats WEAK_1 pull-up → 0
    const pv = evaluateCircuitFull(circuit, { dataPin: 0, enPin: 1 }, [], iStates);
    expect(pv.get(pinKey("out", "outPin"))).toBe(0);
  });
});

// === Backward compatibility: existing circuits unaffected ===

describe("Backward compatibility", () => {
  it("single-driver 1-bit wire works as before", () => {
    const circuit: Circuit = {
      id: "test", name: "compat-1bit",
      nodes: [
        makeInputNode("in", "inPin"),
        makeOutputNode("out", "outPin"),
      ],
      edges: [
        makeEdge("e1", "in", "inPin", "out", "outPin"),
      ],
    };
    const iStates = new Map<string, InstanceState>();
    let pv = evaluateCircuitFull(circuit, { inPin: 1 }, [], iStates);
    expect(pv.get(pinKey("out", "outPin"))).toBe(1);
    pv = evaluateCircuitFull(circuit, { inPin: 0 }, [], iStates);
    expect(pv.get(pinKey("out", "outPin"))).toBe(0);
  });
});
