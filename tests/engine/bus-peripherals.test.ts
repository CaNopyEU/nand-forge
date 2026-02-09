import { describe, expect, it } from "vitest";
import type { BitWidth, Circuit, CircuitNode, Edge, Pin } from "../../src/engine/types.ts";
import {
  evaluateCircuit,
  evaluateCircuitFull,
  pinKey,
  resolveTunnels,
} from "../../src/engine/simulate.ts";
import { circuitNodesToAppNodes } from "../../src/utils/circuit-converters.ts";

// === Helpers ===

function makePin(id: string, name: string, direction: "input" | "output", bits: BitWidth = 1): Pin {
  return { id, name, direction, bits };
}

function makeDipSwitchNode(id: string, pinId: string, name: string, bits: BitWidth = 8): CircuitNode {
  return {
    id,
    type: "input",
    variant: "dip-switch",
    position: { x: 0, y: 0 },
    rotation: 0,
    pins: [makePin(pinId, name, "output", bits)],
  };
}

function makeHexDisplayNode(id: string, pinId: string, bits: BitWidth = 8): CircuitNode {
  return {
    id,
    type: "output",
    variant: "hex-display",
    position: { x: 0, y: 0 },
    rotation: 0,
    pins: [makePin(pinId, "HEX", "input", bits)],
  };
}

function makeLedBarNode(id: string, pinId: string, bits: BitWidth = 8): CircuitNode {
  return {
    id,
    type: "output",
    variant: "led-bar",
    position: { x: 0, y: 0 },
    rotation: 0,
    pins: [makePin(pinId, "LEDs", "input", bits)],
  };
}

function makeTunnelIn(id: string, visiblePinId: string, internalPinId: string, name: string, bits: BitWidth = 1): CircuitNode {
  return {
    id,
    type: "tunnel",
    variant: "in",
    position: { x: 0, y: 0 },
    rotation: 0,
    pins: [
      makePin(visiblePinId, name, "input", bits),
      makePin(internalPinId, name, "output", bits),
    ],
  };
}

function makeTunnelOut(id: string, internalPinId: string, visiblePinId: string, name: string, bits: BitWidth = 1): CircuitNode {
  return {
    id,
    type: "tunnel",
    variant: "out",
    position: { x: 0, y: 0 },
    rotation: 0,
    pins: [
      makePin(internalPinId, name, "input", bits),
      makePin(visiblePinId, name, "output", bits),
    ],
  };
}

function makeInputNode(id: string, pinId: string, name: string, bits: BitWidth = 1): CircuitNode {
  return {
    id,
    type: "input",
    position: { x: 0, y: 0 },
    rotation: 0,
    pins: [makePin(pinId, name, "output", bits)],
  };
}

function makeOutputNode(id: string, pinId: string, name: string, bits: BitWidth = 1): CircuitNode {
  return {
    id,
    type: "output",
    position: { x: 0, y: 0 },
    rotation: 0,
    pins: [makePin(pinId, name, "input", bits)],
  };
}

function makeEdge(id: string, fromNodeId: string, fromPinId: string, toNodeId: string, toPinId: string): Edge {
  return { id, fromNodeId, fromPinId, toNodeId, toPinId };
}

// === Tests ===

describe("DIP Switch", () => {
  it("outputs the correct 8-bit value", () => {
    const dip = makeDipSwitchNode("dip1", "dp1", "DIP");
    const hex = makeHexDisplayNode("hex1", "hp1");
    const circuit: Circuit = {
      id: "test",
      name: "test",
      nodes: [dip, hex],
      edges: [makeEdge("e1", "dip1", "dp1", "hex1", "hp1")],
    };

    const result = evaluateCircuitFull(circuit, { dp1: 0xA5 });
    expect(result.get(pinKey("hex1", "hp1"))).toBe(0xA5);
  });

  it("output defaults to 0 when no input provided", () => {
    const dip = makeDipSwitchNode("dip1", "dp1", "DIP");
    const hex = makeHexDisplayNode("hex1", "hp1");
    const circuit: Circuit = {
      id: "test",
      name: "test",
      nodes: [dip, hex],
      edges: [makeEdge("e1", "dip1", "dp1", "hex1", "hp1")],
    };

    const result = evaluateCircuitFull(circuit, {});
    expect(result.get(pinKey("hex1", "hp1"))).toBe(0);
  });
});

describe("Hex Display", () => {
  it("reads 8-bit input correctly", () => {
    const input = makeInputNode("in1", "ip1", "Data", 8);
    const hex = makeHexDisplayNode("hex1", "hp1");
    const circuit: Circuit = {
      id: "test",
      name: "test",
      nodes: [input, hex],
      edges: [makeEdge("e1", "in1", "ip1", "hex1", "hp1")],
    };

    const result = evaluateCircuitFull(circuit, { ip1: 0xFF });
    expect(result.get(pinKey("hex1", "hp1"))).toBe(0xFF);
  });
});

describe("LED Bar", () => {
  it("reads 8-bit input correctly", () => {
    const input = makeInputNode("in1", "ip1", "Data", 8);
    const leds = makeLedBarNode("led1", "lp1");
    const circuit: Circuit = {
      id: "test",
      name: "test",
      nodes: [input, leds],
      edges: [makeEdge("e1", "in1", "ip1", "led1", "lp1")],
    };

    const result = evaluateCircuitFull(circuit, { ip1: 0b10101010 });
    expect(result.get(pinKey("led1", "lp1"))).toBe(0b10101010);
  });
});

describe("Tunnel", () => {
  it("passes signal from tunnelIn to tunnelOut with same name", () => {
    const input = makeInputNode("in1", "ip1", "A");
    const tunIn = makeTunnelIn("ti1", "tip1", "tio1", "SIG");
    const tunOut = makeTunnelOut("to1", "toi1", "top1", "SIG");
    const output = makeOutputNode("out1", "op1", "Y");

    const circuit: Circuit = {
      id: "test",
      name: "test",
      nodes: [input, tunIn, tunOut, output],
      edges: [
        makeEdge("e1", "in1", "ip1", "ti1", "tip1"),
        makeEdge("e2", "to1", "top1", "out1", "op1"),
      ],
    };

    const result = evaluateCircuit(circuit, { ip1: 1 });
    expect(result["op1"]).toBe(1);
  });

  it("does not connect tunnels with different names", () => {
    const input = makeInputNode("in1", "ip1", "A");
    const tunIn = makeTunnelIn("ti1", "tip1", "tio1", "SIG_A");
    const tunOut = makeTunnelOut("to1", "toi1", "top1", "SIG_B");
    const output = makeOutputNode("out1", "op1", "Y");

    const circuit: Circuit = {
      id: "test",
      name: "test",
      nodes: [input, tunIn, tunOut, output],
      edges: [
        makeEdge("e1", "in1", "ip1", "ti1", "tip1"),
        makeEdge("e2", "to1", "top1", "out1", "op1"),
      ],
    };

    const result = evaluateCircuit(circuit, { ip1: 1 });
    expect(result["op1"]).toBe(0);
  });

  it("supports multiple tunnelOuts receiving from one tunnelIn", () => {
    const input = makeInputNode("in1", "ip1", "A");
    const tunIn = makeTunnelIn("ti1", "tip1", "tio1", "BUS");
    const tunOut1 = makeTunnelOut("to1", "toi1", "top1", "BUS");
    const tunOut2 = makeTunnelOut("to2", "toi2", "top2", "BUS");
    const out1 = makeOutputNode("out1", "op1", "Y1");
    const out2 = makeOutputNode("out2", "op2", "Y2");

    const circuit: Circuit = {
      id: "test",
      name: "test",
      nodes: [input, tunIn, tunOut1, tunOut2, out1, out2],
      edges: [
        makeEdge("e1", "in1", "ip1", "ti1", "tip1"),
        makeEdge("e2", "to1", "top1", "out1", "op1"),
        makeEdge("e3", "to2", "top2", "out2", "op2"),
      ],
    };

    const result = evaluateCircuit(circuit, { ip1: 1 });
    expect(result["op1"]).toBe(1);
    expect(result["op2"]).toBe(1);
  });

  it("passes 8-bit bus value through tunnel", () => {
    const input = makeInputNode("in1", "ip1", "Data", 8);
    const tunIn = makeTunnelIn("ti1", "tip1", "tio1", "BUS8", 8);
    const tunOut = makeTunnelOut("to1", "toi1", "top1", "BUS8", 8);
    const output = makeOutputNode("out1", "op1", "Y", 8);

    const circuit: Circuit = {
      id: "test",
      name: "test",
      nodes: [input, tunIn, tunOut, output],
      edges: [
        makeEdge("e1", "in1", "ip1", "ti1", "tip1"),
        makeEdge("e2", "to1", "top1", "out1", "op1"),
      ],
    };

    const result = evaluateCircuit(circuit, { ip1: 0xCA });
    expect(result["op1"]).toBe(0xCA);
  });

  it("resolveTunnels adds virtual edges for matching names", () => {
    const tunIn = makeTunnelIn("ti1", "tip1", "tio1", "NET");
    const tunOut = makeTunnelOut("to1", "toi1", "top1", "NET");

    const circuit: Circuit = {
      id: "test",
      name: "test",
      nodes: [tunIn, tunOut],
      edges: [],
    };

    const resolved = resolveTunnels(circuit);
    expect(resolved.edges.length).toBe(1);
    expect(resolved.edges[0]!.fromNodeId).toBe("ti1");
    expect(resolved.edges[0]!.fromPinId).toBe("tio1");
    expect(resolved.edges[0]!.toNodeId).toBe("to1");
    expect(resolved.edges[0]!.toPinId).toBe("toi1");
  });

  it("resolveTunnels returns original circuit when no tunnels", () => {
    const circuit: Circuit = {
      id: "test",
      name: "test",
      nodes: [makeInputNode("in1", "ip1", "A")],
      edges: [],
    };

    const resolved = resolveTunnels(circuit);
    expect(resolved).toBe(circuit);
  });
});

describe("Round-trip (variant preservation)", () => {
  it("preserves dip-switch variant through circuitNodesToAppNodes", () => {
    const node = makeDipSwitchNode("dip1", "dp1", "MY_DIP");
    const appNodes = circuitNodesToAppNodes([node], []);
    expect(appNodes[0]!.type).toBe("dipSwitch");
    expect(appNodes[0]!.data).toHaveProperty("label", "MY_DIP");
  });

  it("preserves hex-display variant through circuitNodesToAppNodes", () => {
    const node = makeHexDisplayNode("hex1", "hp1");
    const appNodes = circuitNodesToAppNodes([node], []);
    expect(appNodes[0]!.type).toBe("hexDisplay");
  });

  it("preserves led-bar variant through circuitNodesToAppNodes", () => {
    const node = makeLedBarNode("led1", "lp1");
    const appNodes = circuitNodesToAppNodes([node], []);
    expect(appNodes[0]!.type).toBe("ledBar");
  });

  it("preserves tunnel variant through circuitNodesToAppNodes", () => {
    const nodeIn = makeTunnelIn("ti1", "tip1", "tio1", "CLK");
    const nodeOut = makeTunnelOut("to1", "toi1", "top1", "CLK");
    const appNodes = circuitNodesToAppNodes([nodeIn, nodeOut], []);
    expect(appNodes[0]!.type).toBe("tunnel");
    expect(appNodes[0]!.data).toHaveProperty("direction", "in");
    expect(appNodes[0]!.data).toHaveProperty("label", "CLK");
    expect(appNodes[1]!.type).toBe("tunnel");
    expect(appNodes[1]!.data).toHaveProperty("direction", "out");
  });
});
