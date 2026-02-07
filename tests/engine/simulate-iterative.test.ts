import { describe, expect, it } from "vitest";
import type {
  Circuit,
  CircuitNode,
  Edge,
  Pin,
} from "../../src/engine/types.ts";
import { BUILTIN_NAND_MODULE_ID } from "../../src/engine/simulate.ts";
import {
  evaluateCircuitIterative,
  MAX_ITERATIONS,
} from "../../src/engine/simulate-iterative.ts";
import { evaluateCircuitFull, pinKey } from "../../src/engine/simulate.ts";

// === Test helpers ===

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

function makeOutputNode(id: string, pinId: string, name: string): CircuitNode {
  return {
    id,
    type: "output",
    position: { x: 0, y: 0 },
    rotation: 0,
    pins: [makePin(pinId, name, "input")],
  };
}

function makeClockNode(id: string, pinId: string): CircuitNode {
  return {
    id,
    type: "clock",
    position: { x: 0, y: 0 },
    rotation: 0,
    pins: [makePin(pinId, "CLK", "output")],
  };
}

function makeNandNode(
  id: string,
  inAId: string,
  inBId: string,
  outId: string,
): CircuitNode {
  return {
    id,
    type: "module",
    moduleId: BUILTIN_NAND_MODULE_ID,
    position: { x: 0, y: 0 },
    rotation: 0,
    pins: [
      makePin(inAId, "A", "input"),
      makePin(inBId, "B", "input"),
      makePin(outId, "Out", "output"),
    ],
  };
}

function makeEdge(
  id: string,
  fromNodeId: string,
  fromPinId: string,
  toNodeId: string,
  toPinId: string,
): Edge {
  return { id, fromNodeId, fromPinId, toNodeId, toPinId };
}

function makeCircuit(name: string, nodes: CircuitNode[], edges: Edge[]): Circuit {
  return { id: `circuit-${name}`, name, nodes, edges };
}

// === SR NAND Latch ===
//
// S_input → NAND1.A
// NAND2.Out → NAND1.B (feedback)
// NAND1.Out → Q_output + NAND2.A (feedback)
// R_input → NAND2.B
// NAND2.Out → Q_bar_output
// CLK (present — enables cycle wiring, not necessarily connected)

function makeSRLatch() {
  const nodes: CircuitNode[] = [
    makeInputNode("s_node", "s", "S"),
    makeInputNode("r_node", "r", "R"),
    makeNandNode("nand1", "n1a", "n1b", "n1out"),
    makeNandNode("nand2", "n2a", "n2b", "n2out"),
    makeOutputNode("q_node", "q", "Q"),
    makeOutputNode("qbar_node", "qbar", "Q_bar"),
    makeClockNode("clk_node", "clk"),
  ];

  const edges: Edge[] = [
    // S → NAND1.A
    makeEdge("e1", "s_node", "s", "nand1", "n1a"),
    // R → NAND2.B
    makeEdge("e2", "r_node", "r", "nand2", "n2b"),
    // NAND1.Out → Q
    makeEdge("e3", "nand1", "n1out", "q_node", "q"),
    // NAND2.Out → Q_bar
    makeEdge("e4", "nand2", "n2out", "qbar_node", "qbar"),
    // NAND1.Out → NAND2.A (feedback)
    makeEdge("e5", "nand1", "n1out", "nand2", "n2a"),
    // NAND2.Out → NAND1.B (feedback)
    makeEdge("e6", "nand2", "n2out", "nand1", "n1b"),
  ];

  return makeCircuit("sr-latch", nodes, edges);
}

describe("evaluateCircuitIterative", () => {
  describe("SR NAND Latch", () => {
    it("Set (S=0, R=1) → Q=1, Q_bar=0, stable", () => {
      const circuit = makeSRLatch();
      const result = evaluateCircuitIterative(
        circuit,
        { s: false, r: true, clk: false },
        undefined,
        new Map(),
      );

      expect(result.stable).toBe(true);
      expect(result.pinValues.get(pinKey("q_node", "q"))).toBe(true);
      expect(result.pinValues.get(pinKey("qbar_node", "qbar"))).toBe(false);
    });

    it("Reset (S=1, R=0) → Q=0, Q_bar=1, stable", () => {
      const circuit = makeSRLatch();
      const result = evaluateCircuitIterative(
        circuit,
        { s: true, r: false, clk: false },
        undefined,
        new Map(),
      );

      expect(result.stable).toBe(true);
      expect(result.pinValues.get(pinKey("q_node", "q"))).toBe(false);
      expect(result.pinValues.get(pinKey("qbar_node", "qbar"))).toBe(true);
    });

    it("Hold after Set (S=1, R=1) — retains Q=1 from previous Set state", () => {
      const circuit = makeSRLatch();

      // First: Set state
      const setResult = evaluateCircuitIterative(
        circuit,
        { s: false, r: true, clk: false },
        undefined,
        new Map(),
      );
      expect(setResult.stable).toBe(true);

      // Then: Hold (S=1, R=1) with previous pin values
      const holdResult = evaluateCircuitIterative(
        circuit,
        { s: true, r: true, clk: false },
        undefined,
        setResult.pinValues,
      );

      expect(holdResult.stable).toBe(true);
      expect(holdResult.pinValues.get(pinKey("q_node", "q"))).toBe(true);
      expect(holdResult.pinValues.get(pinKey("qbar_node", "qbar"))).toBe(false);
    });

    it("Hold after Reset (S=1, R=1) — retains Q=0 from previous Reset state", () => {
      const circuit = makeSRLatch();

      // First: Reset state
      const resetResult = evaluateCircuitIterative(
        circuit,
        { s: true, r: false, clk: false },
        undefined,
        new Map(),
      );
      expect(resetResult.stable).toBe(true);

      // Then: Hold (S=1, R=1) with previous pin values
      const holdResult = evaluateCircuitIterative(
        circuit,
        { s: true, r: true, clk: false },
        undefined,
        resetResult.pinValues,
      );

      expect(holdResult.stable).toBe(true);
      expect(holdResult.pinValues.get(pinKey("q_node", "q"))).toBe(false);
      expect(holdResult.pinValues.get(pinKey("qbar_node", "qbar"))).toBe(true);
    });
  });

  describe("Ring oscillator", () => {
    it("single NAND with output→both inputs does not converge", () => {
      // NAND with output fed back to both inputs → NOT of itself → oscillates
      const nodes: CircuitNode[] = [
        makeNandNode("nand", "a", "b", "out"),
        makeClockNode("clk", "clk_pin"),
      ];
      const edges: Edge[] = [
        makeEdge("fb1", "nand", "out", "nand", "a"),
        makeEdge("fb2", "nand", "out", "nand", "b"),
      ];
      const circuit = makeCircuit("ring-osc", nodes, edges);

      const result = evaluateCircuitIterative(
        circuit,
        { clk_pin: false },
        undefined,
        new Map(),
      );

      expect(result.stable).toBe(false);
      expect(result.unstableKeys.size).toBeGreaterThan(0);
      expect(result.iterations).toBe(MAX_ITERATIONS);
    });
  });

  describe("Acyclic sanity check", () => {
    it("iterative evaluator matches topological for acyclic NOT circuit", () => {
      // NOT(A) = NAND(A, A)
      const nodes: CircuitNode[] = [
        makeInputNode("n1", "in", "A"),
        makeNandNode("nand", "a", "b", "q"),
        makeOutputNode("n3", "out", "Out"),
      ];
      const edges: Edge[] = [
        makeEdge("e1", "n1", "in", "nand", "a"),
        makeEdge("e2", "n1", "in", "nand", "b"),
        makeEdge("e3", "nand", "q", "n3", "out"),
      ];
      const circuit = makeCircuit("not", nodes, edges);

      // Topological evaluation
      const topoResult = evaluateCircuitFull(circuit, { in: true });
      const topoOut = topoResult.get(pinKey("n3", "out"));

      // Iterative evaluation
      const iterResult = evaluateCircuitIterative(
        circuit,
        { in: true },
        undefined,
        new Map(),
      );
      const iterOut = iterResult.pinValues.get(pinKey("n3", "out"));

      expect(iterResult.stable).toBe(true);
      expect(iterOut).toBe(topoOut);
      expect(iterOut).toBe(false); // NOT(true) = false
    });
  });
});
