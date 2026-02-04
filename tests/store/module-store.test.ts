import { describe, expect, it } from "vitest";
import type {
  Circuit,
  CircuitNode,
  Edge,
  Module,
  Pin,
} from "../../src/engine/types.ts";
import {
  getModulesDependingOn,
  getTransitiveDependentsInOrder,
  synchronizeInstancesInCircuit,
} from "../../src/store/module-store.ts";

// === Test helpers ===

function makePin(id: string, name: string, direction: "input" | "output"): Pin {
  return { id, name, direction, bits: 1 };
}

function makeNode(
  id: string,
  type: CircuitNode["type"],
  moduleId?: string,
  pins: Pin[] = [],
): CircuitNode {
  return {
    id,
    type,
    moduleId,
    position: { x: 0, y: 0 },
    rotation: 0,
    pins,
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

function makeModule(
  id: string,
  circuit: Circuit,
  inputs: Pin[] = [makePin("in", "In", "input")],
  outputs: Pin[] = [makePin("out", "Out", "output")],
): Module {
  return {
    id,
    name: id,
    inputs,
    outputs,
    circuit,
    createdAt: "",
    updatedAt: "",
  };
}

// === getModulesDependingOn ===

describe("getModulesDependingOn", () => {
  it("returns empty for module with no dependents", () => {
    const modA = makeModule("A", makeCircuit([], []));
    const modB = makeModule("B", makeCircuit([], []));
    expect(getModulesDependingOn("A", [modA, modB])).toEqual([]);
  });

  it("returns direct dependents", () => {
    const modA = makeModule("A", makeCircuit([], []));
    const modB = makeModule(
      "B",
      makeCircuit([makeNode("n1", "module", "A")], []),
    );
    const modC = makeModule(
      "C",
      makeCircuit([makeNode("n1", "module", "A")], []),
    );
    const result = getModulesDependingOn("A", [modA, modB, modC]);
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.id).sort()).toEqual(["B", "C"]);
  });

  it("does not return transitive dependents", () => {
    const modA = makeModule("A", makeCircuit([], []));
    const modB = makeModule(
      "B",
      makeCircuit([makeNode("n1", "module", "A")], []),
    );
    const modC = makeModule(
      "C",
      makeCircuit([makeNode("n1", "module", "B")], []),
    );
    const result = getModulesDependingOn("A", [modA, modB, modC]);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("B");
  });
});

// === getTransitiveDependentsInOrder ===

describe("getTransitiveDependentsInOrder", () => {
  it("returns empty for module with no dependents", () => {
    const modA = makeModule("A", makeCircuit([], []));
    expect(getTransitiveDependentsInOrder("A", [modA])).toEqual([]);
  });

  it("returns transitive dependents in topological order", () => {
    const modA = makeModule("A", makeCircuit([], []));
    const modB = makeModule(
      "B",
      makeCircuit([makeNode("n1", "module", "A")], []),
    );
    const modC = makeModule(
      "C",
      makeCircuit([makeNode("n1", "module", "B")], []),
    );
    const result = getTransitiveDependentsInOrder("A", [modA, modB, modC]);
    expect(result).toHaveLength(2);
    // C depends on B, so B should come before C in topological order (leaves first)
    const ids = result.map((m) => m.id);
    expect(ids.indexOf("B")).toBeLessThan(ids.indexOf("C"));
  });

  it("does not include the root module itself", () => {
    const modA = makeModule("A", makeCircuit([], []));
    const modB = makeModule(
      "B",
      makeCircuit([makeNode("n1", "module", "A")], []),
    );
    const result = getTransitiveDependentsInOrder("A", [modA, modB]);
    expect(result.map((m) => m.id)).toEqual(["B"]);
  });
});

// === synchronizeInstancesInCircuit ===

describe("synchronizeInstancesInCircuit", () => {
  it("preserves instance pin IDs for surviving definition pins", () => {
    const oldDef = makeModule(
      "child",
      makeCircuit([], []),
      [makePin("di1", "A", "input")],
      [makePin("do1", "Out", "output")],
    );
    const newDef = makeModule(
      "child",
      makeCircuit([], []),
      [makePin("di1", "A-renamed", "input")],
      [makePin("do1", "Out", "output")],
    );

    const instanceNode = makeNode("inst1", "module", "child", [
      makePin("ip1", "A", "input"),
      makePin("op1", "Out", "output"),
    ]);
    const parent = makeModule(
      "parent",
      makeCircuit(
        [instanceNode, makeNode("inp", "input", undefined, [makePin("src", "In", "output")])],
        [makeEdge("e1", "inp", "src", "inst1", "ip1")],
      ),
    );

    const result = synchronizeInstancesInCircuit(parent, "child", oldDef, newDef);

    // Instance pin IDs should be preserved
    const updatedInstance = result.nodes.find((n) => n.id === "inst1")!;
    expect(updatedInstance.pins[0]!.id).toBe("ip1"); // preserved
    expect(updatedInstance.pins[0]!.name).toBe("A-renamed"); // name updated
    expect(updatedInstance.pins[1]!.id).toBe("op1"); // preserved
    // Edge should survive (pin ID ip1 still exists)
    expect(result.edges).toHaveLength(1);
    expect(result.removedInstancePinIds).toHaveLength(0);
  });

  it("removes edges connected to removed instance pins", () => {
    const oldDef = makeModule(
      "child",
      makeCircuit([], []),
      [makePin("di1", "A", "input"), makePin("di2", "B", "input")],
      [makePin("do1", "Out", "output")],
    );
    const newDef = makeModule(
      "child",
      makeCircuit([], []),
      [makePin("di1", "A", "input")],
      [makePin("do1", "Out", "output")],
    );

    const instanceNode = makeNode("inst1", "module", "child", [
      makePin("ip1", "A", "input"),
      makePin("ip2", "B", "input"),
      makePin("op1", "Out", "output"),
    ]);
    const parent = makeModule(
      "parent",
      makeCircuit(
        [
          instanceNode,
          makeNode("inp", "input", undefined, [makePin("src", "In", "output")]),
        ],
        [
          makeEdge("e1", "inp", "src", "inst1", "ip1"),
          makeEdge("e2", "inp", "src", "inst1", "ip2"),
        ],
      ),
    );

    const result = synchronizeInstancesInCircuit(parent, "child", oldDef, newDef);

    // Instance should now have 2 pins (A + Out), not 3
    const updatedInstance = result.nodes.find((n) => n.id === "inst1")!;
    expect(updatedInstance.pins).toHaveLength(2);

    // Edge to ip2 should be removed, edge to ip1 preserved
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]!.toPinId).toBe("ip1");

    // ip2 should be in removed list
    expect(result.removedInstancePinIds).toContain("ip2");
  });

  it("generates fresh IDs for newly added definition pins", () => {
    const oldDef = makeModule(
      "child",
      makeCircuit([], []),
      [makePin("di1", "A", "input")],
      [makePin("do1", "Out", "output")],
    );
    const newDef = makeModule(
      "child",
      makeCircuit([], []),
      [makePin("di1", "A", "input"), makePin("di2", "B", "input")],
      [makePin("do1", "Out", "output")],
    );

    const instanceNode = makeNode("inst1", "module", "child", [
      makePin("ip1", "A", "input"),
      makePin("op1", "Out", "output"),
    ]);
    const parent = makeModule(
      "parent",
      makeCircuit([instanceNode], []),
    );

    const result = synchronizeInstancesInCircuit(parent, "child", oldDef, newDef);

    const updatedInstance = result.nodes.find((n) => n.id === "inst1")!;
    expect(updatedInstance.pins).toHaveLength(3);
    expect(updatedInstance.pins[0]!.id).toBe("ip1"); // preserved
    // New pin should have a fresh generated ID (not "di2")
    expect(updatedInstance.pins[1]!.name).toBe("B");
    expect(updatedInstance.pins[1]!.id).not.toBe("di2");
    expect(updatedInstance.pins[2]!.id).toBe("op1"); // preserved
  });

  it("does not modify nodes that are not instances of the changed module", () => {
    const oldDef = makeModule("child", makeCircuit([], []), [], []);
    const newDef = makeModule("child", makeCircuit([], []), [], []);

    const otherNode = makeNode("other", "module", "different-module", [
      makePin("p1", "X", "input"),
    ]);
    const parent = makeModule(
      "parent",
      makeCircuit([otherNode], []),
    );

    const result = synchronizeInstancesInCircuit(parent, "child", oldDef, newDef);
    const unchanged = result.nodes.find((n) => n.id === "other")!;
    expect(unchanged.pins[0]!.id).toBe("p1");
    expect(unchanged.pins[0]!.name).toBe("X");
  });
});
