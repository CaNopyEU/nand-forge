import { describe, expect, it } from "vitest";
import type {
  Circuit,
  CircuitNode,
  Edge,
  Module,
  Pin,
} from "../../src/engine/types.ts";
import {
  BUILTIN_NAND_MODULE_ID,
  BUILTIN_SPLITTER_MODULE_ID,
  BUILTIN_MERGER_MODULE_ID,
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
  it("returns 1 for (0, 0)", () => {
    expect(evaluateNand(0, 0)).toBe(1);
  });

  it("returns 1 for (0, 1)", () => {
    expect(evaluateNand(0, 1)).toBe(1);
  });

  it("returns 1 for (1, 0)", () => {
    expect(evaluateNand(1, 0)).toBe(1);
  });

  it("returns 0 for (1, 1)", () => {
    expect(evaluateNand(1, 1)).toBe(0);
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

    expect(evaluateCircuit(circuit, { in: 1 })).toEqual({ out: 1 });
    expect(evaluateCircuit(circuit, { in: 0 })).toEqual({ out: 0 });
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

    it("NOT(1) = 0", () => {
      expect(evaluateCircuit(circuit, { in: 1 })).toEqual({ out: 0 });
    });

    it("NOT(0) = 1", () => {
      expect(evaluateCircuit(circuit, { in: 0 })).toEqual({ out: 1 });
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

    const cases: Array<[number, number, number]> = [
      [0, 0, 0],
      [0, 1, 0],
      [1, 0, 0],
      [1, 1, 1],
    ];

    for (const [a, b, expected] of cases) {
      it(`AND(${a}, ${b}) = ${expected}`, () => {
        expect(evaluateCircuit(circuit, { a, b })).toEqual({
          out: expected,
        });
      });
    }
  });

  it("unconnected output defaults to 0", () => {
    const nodes = [makeOutputNode("n1", "out", "Out")];
    const circuit = makeCircuit("unconnected", nodes, []);

    expect(evaluateCircuit(circuit, {})).toEqual({ out: 0 });
  });

  describe("module with truth table cache", () => {
    // NOT module with pre-computed truth table
    const notCircuit = makeCircuit("not-internal", [
      makeInputNode("n1", "in", "A"),
      makeNandNode("nand", "a", "b", "q"),
      makeOutputNode("n3", "out", "Out"),
    ], [
      makeEdge("e1", "n1", "in", "nand", "a"),
      makeEdge("e2", "n1", "in", "nand", "b"),
      makeEdge("e3", "nand", "q", "n3", "out"),
    ]);

    const notModule: Module = {
      id: "mod-not",
      name: "NOT",
      inputs: [makePin("in", "In", "input")],
      outputs: [makePin("out", "Out", "output")],
      circuit: notCircuit,
      createdAt: "",
      updatedAt: "",
    };

    it("evaluates circuit using sub-module evaluation", () => {
      // Circuit: Input → NOT module → Output
      const nodes: CircuitNode[] = [
        makeInputNode("input", "x", "X"),
        {
          id: "not-node",
          type: "module",
          moduleId: "mod-not",
          position: { x: 0, y: 0 },
          rotation: 0,
          pins: [
            makePin("in", "In", "input"),
            makePin("out", "Out", "output"),
          ],
        },
        makeOutputNode("output", "y", "Y"),
      ];
      const edges = [
        makeEdge("e1", "input", "x", "not-node", "in"),
        makeEdge("e2", "not-node", "out", "output", "y"),
      ];
      const circuit = makeCircuit("with-module", nodes, edges);

      expect(evaluateCircuit(circuit, { x: 1 }, [notModule])).toEqual({ y: 0 });
      expect(evaluateCircuit(circuit, { x: 0 }, [notModule])).toEqual({ y: 1 });
    });

    it("evaluates double NOT (module used twice) back to identity", () => {
      const nodes: CircuitNode[] = [
        makeInputNode("input", "x", "X"),
        {
          id: "not1",
          type: "module",
          moduleId: "mod-not",
          position: { x: 0, y: 0 },
          rotation: 0,
          pins: [
            makePin("in", "In", "input"),
            makePin("out", "Out", "output"),
          ],
        },
        {
          id: "not2",
          type: "module",
          moduleId: "mod-not",
          position: { x: 0, y: 0 },
          rotation: 0,
          pins: [
            makePin("in", "In", "input"),
            makePin("out", "Out", "output"),
          ],
        },
        makeOutputNode("output", "y", "Y"),
      ];
      const edges = [
        makeEdge("e1", "input", "x", "not1", "in"),
        makeEdge("e2", "not1", "out", "not2", "in"),
        makeEdge("e3", "not2", "out", "output", "y"),
      ];
      const circuit = makeCircuit("double-not", nodes, edges);

      expect(evaluateCircuit(circuit, { x: 1 }, [notModule])).toEqual({ y: 1 });
      expect(evaluateCircuit(circuit, { x: 0 }, [notModule])).toEqual({ y: 0 });
    });
  });
});

// === Splitter / Merger ===

function makeSplitterNode(
  id: string,
  inputPinId: string,
  outputPinIds: string[],
  inputBits: 1 | 4 | 8 | 16 = 8,
): CircuitNode {
  return {
    id,
    type: "module",
    moduleId: BUILTIN_SPLITTER_MODULE_ID,
    position: { x: 0, y: 0 },
    rotation: 0,
    pins: [
      { id: inputPinId, name: "In", direction: "input", bits: inputBits },
      ...outputPinIds.map((pid, i) => ({
        id: pid,
        name: String(i),
        direction: "output" as const,
        bits: 1 as const,
      })),
    ],
  };
}

function makeMergerNode(
  id: string,
  inputPinIds: string[],
  outputPinId: string,
  outputBits: 1 | 4 | 8 | 16 = 8,
): CircuitNode {
  return {
    id,
    type: "module",
    moduleId: BUILTIN_MERGER_MODULE_ID,
    position: { x: 0, y: 0 },
    rotation: 0,
    pins: [
      ...inputPinIds.map((pid, i) => ({
        id: pid,
        name: String(i),
        direction: "input" as const,
        bits: 1 as const,
      })),
      { id: outputPinId, name: "Out", direction: "output", bits: outputBits },
    ],
  };
}

describe("Splitter", () => {
  it("splits 8-bit 0xA5 into individual bits", () => {
    // 0xA5 = 10100101 → bits [1,0,1,0,0,1,0,1]
    const outPins = ["b0", "b1", "b2", "b3", "b4", "b5", "b6", "b7"];
    const nodes: CircuitNode[] = [
      makeInputNode("in", "x", "X"),
      makeSplitterNode("split", "si", outPins),
      ...outPins.map((_pid, i) => makeOutputNode(`o${i}`, `op${i}`, `O${i}`)),
    ];
    const edges: Edge[] = [
      makeEdge("e0", "in", "x", "split", "si"),
      ...outPins.map((pid, i) => makeEdge(`eo${i}`, "split", pid, `o${i}`, `op${i}`)),
    ];
    const circuit = makeCircuit("split-8", nodes, edges);

    const result = evaluateCircuit(circuit, { x: 0xa5 });
    // 0xA5 = 10100101 → LSB first: [1,0,1,0,0,1,0,1]
    expect(result["op0"]).toBe(1);
    expect(result["op1"]).toBe(0);
    expect(result["op2"]).toBe(1);
    expect(result["op3"]).toBe(0);
    expect(result["op4"]).toBe(0);
    expect(result["op5"]).toBe(1);
    expect(result["op6"]).toBe(0);
    expect(result["op7"]).toBe(1);
  });

  it("splits 4-bit 0xF into individual bits", () => {
    const outPins = ["b0", "b1", "b2", "b3"];
    const nodes: CircuitNode[] = [
      makeInputNode("in", "x", "X"),
      makeSplitterNode("split", "si", outPins, 4),
      ...outPins.map((_pid, i) => makeOutputNode(`o${i}`, `op${i}`, `O${i}`)),
    ];
    const edges: Edge[] = [
      makeEdge("e0", "in", "x", "split", "si"),
      ...outPins.map((pid, i) => makeEdge(`eo${i}`, "split", pid, `o${i}`, `op${i}`)),
    ];
    const circuit = makeCircuit("split-4", nodes, edges);

    const result = evaluateCircuit(circuit, { x: 0xf });
    expect(result["op0"]).toBe(1);
    expect(result["op1"]).toBe(1);
    expect(result["op2"]).toBe(1);
    expect(result["op3"]).toBe(1);
  });
});

describe("Merger", () => {
  it("merges 8 individual bits into 0xA5", () => {
    const inPins = ["b0", "b1", "b2", "b3", "b4", "b5", "b6", "b7"];
    const bits = [1, 0, 1, 0, 0, 1, 0, 1]; // 0xA5 LSB-first
    const nodes: CircuitNode[] = [
      ...inPins.map((_pid, i) => makeInputNode(`i${i}`, `ip${i}`, `I${i}`)),
      makeMergerNode("merge", inPins, "mo"),
      makeOutputNode("out", "op", "Out"),
    ];
    const edges: Edge[] = [
      ...inPins.map((pid, i) => makeEdge(`ei${i}`, `i${i}`, `ip${i}`, "merge", pid)),
      makeEdge("eo", "merge", "mo", "out", "op"),
    ];
    const circuit = makeCircuit("merge-8", nodes, edges);

    const inputValues: Record<string, number> = {};
    for (let i = 0; i < bits.length; i++) {
      inputValues[`ip${i}`] = bits[i]!;
    }

    const result = evaluateCircuit(circuit, inputValues);
    expect(result["op"]).toBe(0xa5);
  });

  it("merges 4 individual bits into 0x05", () => {
    const inPins = ["b0", "b1", "b2", "b3"];
    const bits = [1, 0, 1, 0]; // 0x05 = 0101 LSB-first
    const nodes: CircuitNode[] = [
      ...inPins.map((_pid, i) => makeInputNode(`i${i}`, `ip${i}`, `I${i}`)),
      makeMergerNode("merge", inPins, "mo", 4),
      makeOutputNode("out", "op", "Out"),
    ];
    const edges: Edge[] = [
      ...inPins.map((pid, i) => makeEdge(`ei${i}`, `i${i}`, `ip${i}`, "merge", pid)),
      makeEdge("eo", "merge", "mo", "out", "op"),
    ];
    const circuit = makeCircuit("merge-4", nodes, edges);

    const inputValues: Record<string, number> = {};
    for (let i = 0; i < bits.length; i++) {
      inputValues[`ip${i}`] = bits[i]!;
    }

    const result = evaluateCircuit(circuit, inputValues);
    expect(result["op"]).toBe(0x05);
  });
});

describe("Splitter → Merger roundtrip", () => {
  it("split then merge preserves the original value", () => {
    const splitOuts = ["s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7"];
    const mergeIns = ["m0", "m1", "m2", "m3", "m4", "m5", "m6", "m7"];
    const nodes: CircuitNode[] = [
      makeInputNode("in", "x", "X"),
      makeSplitterNode("split", "si", splitOuts),
      makeMergerNode("merge", mergeIns, "mo"),
      makeOutputNode("out", "op", "Out"),
    ];
    const edges: Edge[] = [
      makeEdge("e0", "in", "x", "split", "si"),
      ...splitOuts.map((_, i) =>
        makeEdge(`em${i}`, "split", splitOuts[i]!, "merge", mergeIns[i]!),
      ),
      makeEdge("eo", "merge", "mo", "out", "op"),
    ];
    const circuit = makeCircuit("roundtrip", nodes, edges);

    for (const val of [0x00, 0xff, 0xa5, 0x3c, 0x01]) {
      expect(evaluateCircuit(circuit, { x: val })).toEqual({ op: val });
    }
  });
});
