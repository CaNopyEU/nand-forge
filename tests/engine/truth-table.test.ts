import { describe, expect, it } from "vitest";
import type {
  Circuit,
  CircuitNode,
  Edge,
  Pin,
} from "../../src/engine/types.ts";
import { BUILTIN_NAND_MODULE_ID } from "../../src/engine/simulate.ts";
import {
  generateTruthTable,
  lookupTruthTable,
} from "../../src/engine/truth-table.ts";

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

// === Circuits ===

function buildNotCircuit(): Circuit {
  return makeCircuit("not", [
    makeInputNode("n1", "in", "A"),
    makeNandNode("nand", "a", "b", "q"),
    makeOutputNode("n3", "out", "Out"),
  ], [
    makeEdge("e1", "n1", "in", "nand", "a"),
    makeEdge("e2", "n1", "in", "nand", "b"),
    makeEdge("e3", "nand", "q", "n3", "out"),
  ]);
}

// XOR from 4 NANDs:
// NAND1(A, B) → W1
// NAND2(A, W1) → W2
// NAND3(B, W1) → W3
// NAND4(W2, W3) → Out
function buildXorCircuit(): Circuit {
  return makeCircuit("xor", [
    makeInputNode("inA", "a", "A"),
    makeInputNode("inB", "b", "B"),
    makeNandNode("nand1", "n1a", "n1b", "n1q"),
    makeNandNode("nand2", "n2a", "n2b", "n2q"),
    makeNandNode("nand3", "n3a", "n3b", "n3q"),
    makeNandNode("nand4", "n4a", "n4b", "n4q"),
    makeOutputNode("out", "out", "Out"),
  ], [
    makeEdge("e1", "inA", "a", "nand1", "n1a"),
    makeEdge("e2", "inB", "b", "nand1", "n1b"),
    makeEdge("e3", "inA", "a", "nand2", "n2a"),
    makeEdge("e4", "nand1", "n1q", "nand2", "n2b"),
    makeEdge("e5", "inB", "b", "nand3", "n3a"),
    makeEdge("e6", "nand1", "n1q", "nand3", "n3b"),
    makeEdge("e7", "nand2", "n2q", "nand4", "n4a"),
    makeEdge("e8", "nand3", "n3q", "nand4", "n4b"),
    makeEdge("e9", "nand4", "n4q", "out", "out"),
  ]);
}

// === generateTruthTable ===

describe("generateTruthTable", () => {
  it("generates NOT truth table (2 rows)", () => {
    const table = generateTruthTable(buildNotCircuit(), []);

    expect(table).not.toBeNull();
    expect(table!.inputNames).toEqual(["in"]);
    expect(table!.outputNames).toEqual(["out"]);
    expect(table!.rows).toEqual({
      "0": "1",
      "1": "0",
    });
  });

  it("generates XOR truth table (4 rows)", () => {
    const table = generateTruthTable(buildXorCircuit(), []);

    expect(table).not.toBeNull();
    expect(table!.inputNames).toEqual(["a", "b"]);
    expect(table!.outputNames).toEqual(["out"]);
    expect(table!.rows).toEqual({
      "00": "0",
      "01": "1",
      "10": "1",
      "11": "0",
    });
  });

  it("returns null when inputs exceed threshold (> 16)", () => {
    const nodes: CircuitNode[] = [];
    for (let i = 0; i < 17; i++) {
      nodes.push(makeInputNode(`in${i}`, `p${i}`, `Input${i}`));
    }
    const circuit = makeCircuit("big", nodes, []);

    expect(generateTruthTable(circuit, [])).toBeNull();
  });

  it("generates truth table for circuit with no inputs/outputs", () => {
    const circuit = makeCircuit("empty", [], []);
    const table = generateTruthTable(circuit, []);

    expect(table).not.toBeNull();
    expect(table!.inputNames).toEqual([]);
    expect(table!.outputNames).toEqual([]);
    expect(table!.rows).toEqual({ "": "" });
  });

  it("accepts exactly 16 inputs", () => {
    const nodes: CircuitNode[] = [];
    for (let i = 0; i < 16; i++) {
      nodes.push(makeInputNode(`in${i}`, `p${i}`, `Input${i}`));
    }
    const circuit = makeCircuit("max", nodes, []);

    expect(generateTruthTable(circuit, [])).not.toBeNull();
  });
});

// === lookupTruthTable ===

describe("lookupTruthTable", () => {
  it("looks up correct output for NOT", () => {
    const table = {
      inputNames: ["in"],
      outputNames: ["out"],
      rows: { "0": "1", "1": "0" } as Record<string, string>,
    };

    expect(lookupTruthTable(table, { in: false })).toEqual({ out: true });
    expect(lookupTruthTable(table, { in: true })).toEqual({ out: false });
  });

  it("looks up correct output for XOR", () => {
    const table = {
      inputNames: ["a", "b"],
      outputNames: ["out"],
      rows: { "00": "0", "01": "1", "10": "1", "11": "0" } as Record<string, string>,
    };

    expect(lookupTruthTable(table, { a: false, b: false })).toEqual({ out: false });
    expect(lookupTruthTable(table, { a: false, b: true })).toEqual({ out: true });
    expect(lookupTruthTable(table, { a: true, b: false })).toEqual({ out: true });
    expect(lookupTruthTable(table, { a: true, b: true })).toEqual({ out: false });
  });

  it("returns false for missing row", () => {
    const table = {
      inputNames: ["a"],
      outputNames: ["out"],
      rows: { "0": "1" } as Record<string, string>,
    };

    // Row "1" missing → output defaults to false
    expect(lookupTruthTable(table, { a: true })).toEqual({ out: false });
  });
});
