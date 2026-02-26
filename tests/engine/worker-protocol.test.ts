import { describe, expect, it } from "vitest";
import type { Circuit, CircuitNode, Edge, Pin } from "../../src/engine/types.ts";
import { evaluateCircuitFull, BUILTIN_NAND_MODULE_ID } from "../../src/engine/simulate.ts";
import type {
  SimulateRequest,
  SimulateResponse,
  ErrorResponse,
} from "../../src/engine/worker-protocol.ts";

// === Helpers ===

function makePin(id: string, name: string, direction: "input" | "output"): Pin {
  return { id, name, direction, bits: 1 };
}

function makeInputNode(id: string, pinId: string, name: string): CircuitNode {
  return {
    id,
    type: "input",
    position: { x: 0, y: 0 },
    rotation: 0,
    pins: [makePin(pinId, name, "output")],
  };
}

function makeNandNode(id: string, inA: string, inB: string, out: string): CircuitNode {
  return {
    id,
    type: "module",
    moduleId: BUILTIN_NAND_MODULE_ID,
    position: { x: 0, y: 0 },
    rotation: 0,
    pins: [
      makePin(inA, "A", "input"),
      makePin(inB, "B", "input"),
      makePin(out, "Out", "output"),
    ],
  };
}

function makeOutputNode(id: string, pinId: string, name: string): CircuitNode {
  return {
    id,
    type: "output",
    position: { x: 0, y: 0 },
    rotation: 0,
    pins: [makePin(pinId, name, "input")],
  };
}

function makeEdge(id: string, fromNode: string, fromPin: string, toNode: string, toPin: string): Edge {
  return { id, fromNodeId: fromNode, fromPinId: fromPin, toNodeId: toNode, toPinId: toPin };
}

function makeCircuit(name: string, nodes: CircuitNode[], edges: Edge[]): Circuit {
  return { id: "test", name, nodes, edges };
}

// === Tests ===

describe("Worker protocol types", () => {
  it("SimulateRequest has correct shape", () => {
    const req: SimulateRequest = {
      type: "simulate",
      requestId: 1,
      circuit: makeCircuit("empty", [], []),
      inputValues: {},
      modules: [],
      instanceStates: new Map(),
      prevPinValues: new Map(),
    };
    expect(req.type).toBe("simulate");
    expect(req.requestId).toBe(1);
  });

  it("SimulateResponse has correct shape", () => {
    const res: SimulateResponse = {
      type: "result",
      requestId: 1,
      pinValues: new Map([["n1:p1", 1]]),
      instanceStates: new Map(),
      stable: true,
      unstableKeys: new Set(),
    };
    expect(res.type).toBe("result");
    expect(res.pinValues.get("n1:p1")).toBe(1);
    expect(res.stable).toBe(true);
  });

  it("ErrorResponse has correct shape", () => {
    const err: ErrorResponse = {
      type: "error",
      requestId: 1,
      message: "boom",
    };
    expect(err.type).toBe("error");
    expect(err.message).toBe("boom");
  });
});

describe("Worker evaluation logic (same as worker uses)", () => {
  it("evaluates NAND inverter correctly", () => {
    // NOT gate: NAND with both inputs tied to the same source
    const inNode = makeInputNode("in", "pin_in", "A");
    const nand = makeNandNode("nand", "a", "b", "out");
    const outNode = makeOutputNode("out", "pin_out", "Y");

    const circuit = makeCircuit("inverter", [inNode, nand, outNode], [
      makeEdge("e1", "in", "pin_in", "nand", "a"),
      makeEdge("e2", "in", "pin_in", "nand", "b"),
      makeEdge("e3", "nand", "out", "out", "pin_out"),
    ]);

    // Input 1 → NAND(1,1) = 0
    const pinValues1 = evaluateCircuitFull(circuit, { pin_in: 1 }, [], new Map());
    expect(pinValues1.get("out:pin_out")).toBe(0);

    // Input 0 → NAND(0,0) = 1
    const pinValues0 = evaluateCircuitFull(circuit, { pin_in: 0 }, [], new Map());
    expect(pinValues0.get("out:pin_out")).toBe(1);
  });

  it("passes through instance states without modification", () => {
    const instanceStates = new Map();
    instanceStates.set("node1", {
      pinValues: new Map([["a:b", 1]]),
      children: new Map(),
    });

    const circuit = makeCircuit("empty-ish", [makeInputNode("in", "p", "X")], []);
    evaluateCircuitFull(circuit, { p: 1 }, [], instanceStates);

    // instanceStates map reference should still be intact
    expect(instanceStates.has("node1")).toBe(true);
  });
});
