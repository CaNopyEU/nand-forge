import { describe, expect, it } from "vitest";
import type {
  Circuit,
  CircuitNode,
  Edge,
  Pin,
  PinId,
} from "../../src/engine/types.ts";
import {
  BUILTIN_NAND_MODULE_ID,
  buildAdjacencyList,
  evaluateCircuit,
  evaluateNand,
  pinKey,
  topologicalSort,
} from "../../src/engine/simulate.ts";

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

// === evaluateNand ===

describe("evaluateNand", () => {
  it("returns true for (false, false)", () => {
    expect(evaluateNand(false, false)).toBe(true);
  });

  it("returns true for (false, true)", () => {
    expect(evaluateNand(false, true)).toBe(true);
  });

  it("returns true for (true, false)", () => {
    expect(evaluateNand(true, false)).toBe(true);
  });

  it("returns false for (true, true)", () => {
    expect(evaluateNand(true, true)).toBe(false);
  });
});

// === pinKey ===

describe("pinKey", () => {
  it("produces composite key", () => {
    expect(pinKey("node1", "pin1")).toBe("node1:pin1");
  });
});

// === buildAdjacencyList ===

describe("buildAdjacencyList", () => {
  it("builds forward and reverse maps from edges", () => {
    const nodes = [
      makeInputNode("n1", "p1", "A"),
      makeNandNode("n2", "p2a", "p2b", "p2out"),
    ];
    const edges = [makeEdge("e1", "n1", "p1", "n2", "p2a")];
    const circuit = makeCircuit("test", nodes, edges);

    const adj = buildAdjacencyList(circuit);

    expect(adj.forward.get("n1:p1")).toEqual([
      { nodeId: "n2", pinId: "p2a" },
    ]);
    expect(adj.reverse.get("n2:p2a")).toEqual({
      nodeId: "n1",
      pinId: "p1",
    });
    expect(adj.nodeIds).toEqual(["n1", "n2"]);
  });

  it("supports fan-out (one output to multiple inputs)", () => {
    const nodes = [
      makeInputNode("n1", "p1", "A"),
      makeNandNode("n2", "p2a", "p2b", "p2out"),
    ];
    const edges = [
      makeEdge("e1", "n1", "p1", "n2", "p2a"),
      makeEdge("e2", "n1", "p1", "n2", "p2b"),
    ];
    const circuit = makeCircuit("fanout", nodes, edges);
    const adj = buildAdjacencyList(circuit);

    expect(adj.forward.get("n1:p1")).toHaveLength(2);
  });
});

// === topologicalSort ===

describe("topologicalSort", () => {
  it("returns nodes in dependency order", () => {
    const nodes = [
      makeInputNode("n1", "p1", "A"),
      makeNandNode("n2", "p2a", "p2b", "p2out"),
      makeOutputNode("n3", "p3", "Out"),
    ];
    const edges = [
      makeEdge("e1", "n1", "p1", "n2", "p2a"),
      makeEdge("e2", "n1", "p1", "n2", "p2b"),
      makeEdge("e3", "n2", "p2out", "n3", "p3"),
    ];
    const circuit = makeCircuit("topo", nodes, edges);
    const order = topologicalSort(circuit);

    expect(order.indexOf("n1")).toBeLessThan(order.indexOf("n2"));
    expect(order.indexOf("n2")).toBeLessThan(order.indexOf("n3"));
  });
});

// === evaluateCircuit ===

describe("evaluateCircuit", () => {
  it("evaluates empty circuit to {}", () => {
    const circuit = makeCircuit("empty", [], []);
    expect(evaluateCircuit(circuit, {})).toEqual({});
  });

  it("evaluates pass-through (input → output)", () => {
    const nodes = [
      makeInputNode("n1", "in", "A"),
      makeOutputNode("n2", "out", "Out"),
    ];
    const edges = [makeEdge("e1", "n1", "in", "n2", "out")];
    const circuit = makeCircuit("passthrough", nodes, edges);

    expect(evaluateCircuit(circuit, { in: true })).toEqual({ out: true });
    expect(evaluateCircuit(circuit, { in: false })).toEqual({ out: false });
  });

  describe("NOT circuit (1x NAND, both inputs from same source)", () => {
    // NOT(A) = NAND(A, A)
    const nodes = [
      makeInputNode("n1", "in", "A"),
      makeNandNode("nand", "a", "b", "q"),
      makeOutputNode("n3", "out", "Out"),
    ];
    const edges = [
      makeEdge("e1", "n1", "in", "nand", "a"),
      makeEdge("e2", "n1", "in", "nand", "b"),
      makeEdge("e3", "nand", "q", "n3", "out"),
    ];
    const circuit = makeCircuit("not", nodes, edges);

    it("NOT(true) = false", () => {
      expect(evaluateCircuit(circuit, { in: true })).toEqual({ out: false });
    });

    it("NOT(false) = true", () => {
      expect(evaluateCircuit(circuit, { in: false })).toEqual({ out: true });
    });
  });

  describe("AND circuit (NAND + NOT)", () => {
    // AND(A, B) = NOT(NAND(A, B)) = NAND(NAND(A, B), NAND(A, B))
    const nodes = [
      makeInputNode("inA", "a", "A"),
      makeInputNode("inB", "b", "B"),
      makeNandNode("nand1", "n1a", "n1b", "n1q"),
      makeNandNode("nand2", "n2a", "n2b", "n2q"),
      makeOutputNode("out", "out", "Out"),
    ];
    const edges = [
      makeEdge("e1", "inA", "a", "nand1", "n1a"),
      makeEdge("e2", "inB", "b", "nand1", "n1b"),
      makeEdge("e3", "nand1", "n1q", "nand2", "n2a"),
      makeEdge("e4", "nand1", "n1q", "nand2", "n2b"),
      makeEdge("e5", "nand2", "n2q", "out", "out"),
    ];
    const circuit = makeCircuit("and", nodes, edges);

    const cases: Array<[boolean, boolean, boolean]> = [
      [false, false, false],
      [false, true, false],
      [true, false, false],
      [true, true, true],
    ];

    for (const [a, b, expected] of cases) {
      it(`AND(${a}, ${b}) = ${expected}`, () => {
        expect(evaluateCircuit(circuit, { a, b })).toEqual({
          out: expected,
        });
      });
    }
  });

  it("unconnected output defaults to false", () => {
    const nodes = [makeOutputNode("n1", "out", "Out")];
    const circuit = makeCircuit("unconnected", nodes, []);

    expect(evaluateCircuit(circuit, {})).toEqual({ out: false });
  });
});
