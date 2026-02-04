import { describe, expect, it } from "vitest";
import type {
  Circuit,
  CircuitNode,
  Edge,
  Module,
  Pin,
} from "../../src/engine/types.ts";
import { hasCycle, hasTransitiveSelfReference, diffInterface } from "../../src/engine/validate.ts";

// === Test helpers ===

function makePin(id: string, name: string, direction: "input" | "output"): Pin {
  return { id, name, direction, bits: 1 };
}

function makeNode(id: string, type: CircuitNode["type"], moduleId?: string): CircuitNode {
  return {
    id,
    type,
    moduleId,
    position: { x: 0, y: 0 },
    rotation: 0,
    pins: [],
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

function makeCircuit(nodes: CircuitNode[], edges: Edge[]): Circuit {
  return { id: "test", name: "test", nodes, edges };
}

function makeModule(id: string, circuit: Circuit): Module {
  return {
    id,
    name: id,
    inputs: [makePin("in", "In", "input")],
    outputs: [makePin("out", "Out", "output")],
    circuit,
    createdAt: "",
    updatedAt: "",
  };
}

// === hasCycle ===

describe("hasCycle", () => {
  it("returns false for acyclic graph", () => {
    const nodes = [makeNode("a", "input"), makeNode("b", "module"), makeNode("c", "output")];
    const edges = [
      makeEdge("e1", "a", "p1", "b", "p2"),
      makeEdge("e2", "b", "p3", "c", "p4"),
    ];
    expect(hasCycle(makeCircuit(nodes, edges))).toBe(false);
  });

  it("returns true for cyclic graph (A → B → C → A)", () => {
    const nodes = [makeNode("a", "module"), makeNode("b", "module"), makeNode("c", "module")];
    const edges = [
      makeEdge("e1", "a", "p1", "b", "p2"),
      makeEdge("e2", "b", "p3", "c", "p4"),
      makeEdge("e3", "c", "p5", "a", "p6"),
    ];
    expect(hasCycle(makeCircuit(nodes, edges))).toBe(true);
  });

  it("returns true for self-loop (A → A)", () => {
    const nodes = [makeNode("a", "module")];
    const edges = [makeEdge("e1", "a", "p1", "a", "p2")];
    expect(hasCycle(makeCircuit(nodes, edges))).toBe(true);
  });

  it("returns false for empty circuit", () => {
    expect(hasCycle(makeCircuit([], []))).toBe(false);
  });

  it("returns false for disconnected acyclic nodes", () => {
    const nodes = [makeNode("a", "input"), makeNode("b", "input")];
    expect(hasCycle(makeCircuit(nodes, []))).toBe(false);
  });
});

// === hasTransitiveSelfReference ===

describe("hasTransitiveSelfReference", () => {
  it("returns true when module A uses B and B uses A", () => {
    const circuitA = makeCircuit(
      [makeNode("n1", "module", "modB")],
      [],
    );
    const circuitB = makeCircuit(
      [makeNode("n1", "module", "modA")],
      [],
    );
    const modules = [makeModule("modA", circuitA), makeModule("modB", circuitB)];

    expect(hasTransitiveSelfReference("modA", modules)).toBe(true);
    expect(hasTransitiveSelfReference("modB", modules)).toBe(true);
  });

  it("returns true for direct self-reference", () => {
    const circuit = makeCircuit(
      [makeNode("n1", "module", "modA")],
      [],
    );
    const modules = [makeModule("modA", circuit)];

    expect(hasTransitiveSelfReference("modA", modules)).toBe(true);
  });

  it("returns false for module without self-reference", () => {
    const circuitA = makeCircuit(
      [makeNode("n1", "module", "modB")],
      [],
    );
    const circuitB = makeCircuit(
      [makeNode("n1", "input")],
      [],
    );
    const modules = [makeModule("modA", circuitA), makeModule("modB", circuitB)];

    expect(hasTransitiveSelfReference("modA", modules)).toBe(false);
  });

  it("returns false for non-existent module", () => {
    expect(hasTransitiveSelfReference("nonexistent", [])).toBe(false);
  });

  it("returns true for transitive chain A → B → C → A", () => {
    const circuitA = makeCircuit([makeNode("n1", "module", "modB")], []);
    const circuitB = makeCircuit([makeNode("n1", "module", "modC")], []);
    const circuitC = makeCircuit([makeNode("n1", "module", "modA")], []);
    const modules = [
      makeModule("modA", circuitA),
      makeModule("modB", circuitB),
      makeModule("modC", circuitC),
    ];

    expect(hasTransitiveSelfReference("modA", modules)).toBe(true);
  });
});

// === diffInterface ===

describe("diffInterface", () => {
  function makeModuleWithPins(
    inputs: Pin[],
    outputs: Pin[],
  ): Module {
    return {
      id: "mod",
      name: "Mod",
      inputs,
      outputs,
      circuit: makeCircuit([], []),
      createdAt: "",
      updatedAt: "",
    };
  }

  it("returns empty diff when interface is unchanged", () => {
    const mod = makeModuleWithPins(
      [makePin("i1", "A", "input")],
      [makePin("o1", "Out", "output")],
    );
    const diff = diffInterface(mod, {
      inputs: [makePin("i1", "A", "input")],
      outputs: [makePin("o1", "Out", "output")],
    });
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.renamed).toHaveLength(0);
    expect(diff.isBreaking).toBe(false);
  });

  it("detects added pins", () => {
    const mod = makeModuleWithPins(
      [makePin("i1", "A", "input")],
      [makePin("o1", "Out", "output")],
    );
    const diff = diffInterface(mod, {
      inputs: [makePin("i1", "A", "input"), makePin("i2", "B", "input")],
      outputs: [makePin("o1", "Out", "output")],
    });
    expect(diff.added).toHaveLength(1);
    expect(diff.added[0]!.id).toBe("i2");
    expect(diff.removed).toHaveLength(0);
    expect(diff.isBreaking).toBe(false);
  });

  it("detects removed pins (breaking)", () => {
    const mod = makeModuleWithPins(
      [makePin("i1", "A", "input"), makePin("i2", "B", "input")],
      [makePin("o1", "Out", "output")],
    );
    const diff = diffInterface(mod, {
      inputs: [makePin("i1", "A", "input")],
      outputs: [makePin("o1", "Out", "output")],
    });
    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0]!.id).toBe("i2");
    expect(diff.isBreaking).toBe(true);
  });

  it("detects renamed pins", () => {
    const mod = makeModuleWithPins(
      [makePin("i1", "A", "input")],
      [makePin("o1", "Out", "output")],
    );
    const diff = diffInterface(mod, {
      inputs: [makePin("i1", "X", "input")],
      outputs: [makePin("o1", "Out", "output")],
    });
    expect(diff.renamed).toHaveLength(1);
    expect(diff.renamed[0]!.oldName).toBe("A");
    expect(diff.renamed[0]!.pin.name).toBe("X");
    expect(diff.isBreaking).toBe(false);
  });

  it("detects mixed changes: add + remove + rename", () => {
    const mod = makeModuleWithPins(
      [makePin("i1", "A", "input"), makePin("i2", "B", "input")],
      [makePin("o1", "Out", "output")],
    );
    const diff = diffInterface(mod, {
      inputs: [makePin("i1", "Alpha", "input"), makePin("i3", "C", "input")],
      outputs: [makePin("o1", "Out", "output")],
    });
    expect(diff.added).toHaveLength(1);
    expect(diff.added[0]!.id).toBe("i3");
    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0]!.id).toBe("i2");
    expect(diff.renamed).toHaveLength(1);
    expect(diff.renamed[0]!.oldName).toBe("A");
    expect(diff.isBreaking).toBe(true);
  });
});
