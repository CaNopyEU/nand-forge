import { describe, expect, it, vi, beforeEach } from "vitest";
import type { BitWidth, Pin, Module, Circuit } from "../../src/engine/types.ts";
import { useCircuitStore } from "../../src/store/circuit-store.ts";
import type { AppNode } from "../../src/store/circuit-store-types.ts";
import { MAX_HISTORY } from "../../src/store/circuit-store-helpers.ts";
import { useModuleStore } from "../../src/store/module-store.ts";

// Mock generateId with a counter
let idCounter = 0;
vi.mock("../../src/utils/id.ts", () => ({
  generateId: () => `id-${++idCounter}`,
}));

const pos = { x: 100, y: 200 };

function getState() {
  return useCircuitStore.getState();
}

/** Access node data as a generic record (avoids TS union narrowing issues). */
function d(index: number): Record<string, unknown> {
  return getState().nodes[index]!.data as Record<string, unknown>;
}

function makePin(id: string, name: string, direction: "input" | "output", bits: BitWidth = 1): Pin {
  return { id, name, direction, bits };
}

function makeCircuit(nodes: Circuit["nodes"] = [], edges: Circuit["edges"] = []): Circuit {
  return { id: "c", name: "c", nodes, edges };
}

function makeModule(id: string, circuit: Circuit = makeCircuit()): Module {
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

const initialState = {
  nodes: [] as AppNode[],
  edges: [],
  activeModuleId: null,
  simulationVersion: 0,
  isDirty: false,
  past: [],
  future: [],
  stampModuleId: null,
  drilldownStack: [],
  drilldownRoot: null,
  readOnly: false,
};

beforeEach(() => {
  idCounter = 0;
  useCircuitStore.setState(initialState);
  useModuleStore.setState({ modules: [] });
});

// === addNode ===

describe("addNode", () => {
  it("adds circuitInput node", () => {
    getState().addNode("circuitInput", pos);
    expect(getState().nodes).toHaveLength(1);
    expect(getState().nodes[0]!.type).toBe("circuitInput");
    expect(d(0)["label"]).toBe("Input");
    expect(d(0)["value"]).toBe(0);
  });

  it("adds circuitOutput node", () => {
    getState().addNode("circuitOutput", pos);
    expect(getState().nodes[0]!.type).toBe("circuitOutput");
    expect(d(0)["label"]).toBe("Output");
  });

  it("adds constant node", () => {
    getState().addNode("constant", pos);
    expect(getState().nodes[0]!.type).toBe("constant");
    expect(d(0)["value"]).toBe(0);
    expect(d(0)["label"]).toBe("0");
  });

  it("adds clock node", () => {
    getState().addNode("clock", pos);
    expect(getState().nodes[0]!.type).toBe("clock");
    expect(d(0)["value"]).toBe(0);
  });

  it("adds button node", () => {
    getState().addNode("button", pos);
    expect(getState().nodes[0]!.type).toBe("button");
    expect(d(0)["pressed"]).toBe(0);
  });

  it("adds NAND module node (default)", () => {
    getState().addNode("module", pos);
    expect(getState().nodes[0]!.type).toBe("module");
    expect(d(0)["moduleId"]).toBe("builtin:nand");
    expect(d(0)["label"]).toBe("NAND");
    expect(d(0)["pins"]).toHaveLength(3);
  });

  it("adds rom node", () => {
    getState().addNode("rom", pos);
    expect(getState().nodes[0]!.type).toBe("rom");
    expect(d(0)["addressBits"]).toBe(4);
    expect(d(0)["romData"]).toHaveLength(16);
  });

  it("adds ram node", () => {
    getState().addNode("ram", pos);
    expect(getState().nodes[0]!.type).toBe("ram");
    expect(d(0)["addressBits"]).toBe(4);
  });

  it("adds tristate node", () => {
    getState().addNode("tristate", pos);
    expect(getState().nodes[0]!.type).toBe("tristate");
    expect(d(0)["bits"]).toBe(1);
  });

  it("adds pull node", () => {
    getState().addNode("pull", pos);
    expect(getState().nodes[0]!.type).toBe("pull");
    expect(d(0)["variant"]).toBe("pullup");
  });

  it("bumps simulationVersion", () => {
    expect(getState().simulationVersion).toBe(0);
    getState().addNode("circuitInput", pos);
    expect(getState().simulationVersion).toBe(1);
  });

  it("sets isDirty", () => {
    expect(getState().isDirty).toBe(false);
    getState().addNode("circuitInput", pos);
    expect(getState().isDirty).toBe(true);
  });

  it("pushes snapshot for undo", () => {
    getState().addNode("circuitInput", pos);
    expect(getState().past).toHaveLength(1);
    expect(getState().past[0]!.nodes).toEqual([]);
  });
});

// === removeNode ===

describe("removeNode", () => {
  it("removes node and connected edges", () => {
    getState().addNode("circuitInput", pos);
    const nodeId = getState().nodes[0]!.id;
    getState().addNode("circuitOutput", pos);
    const outNodeId = getState().nodes[1]!.id;
    const edge = { id: "e1", source: nodeId, sourceHandle: "h1", target: outNodeId, targetHandle: "h2" };
    getState().addEdge(edge);
    expect(getState().edges).toHaveLength(1);

    getState().removeNode(nodeId);
    expect(getState().nodes).toHaveLength(1);
    expect(getState().edges).toHaveLength(0);
  });

  it("bumps simulationVersion", () => {
    getState().addNode("circuitInput", pos);
    const v = getState().simulationVersion;
    getState().removeNode(getState().nodes[0]!.id);
    expect(getState().simulationVersion).toBe(v + 1);
  });
});

// === toggleInputValue ===

describe("toggleInputValue", () => {
  it("toggles 0 to 1 and back", () => {
    getState().addNode("circuitInput", pos);
    const nodeId = getState().nodes[0]!.id;
    expect(d(0)["value"]).toBe(0);

    getState().toggleInputValue(nodeId);
    expect(d(0)["value"]).toBe(1);

    getState().toggleInputValue(nodeId);
    expect(d(0)["value"]).toBe(0);
  });
});

// === setInputValue ===

describe("setInputValue", () => {
  it("sets value on circuitInput", () => {
    getState().addNode("circuitInput", pos, undefined, undefined, 4);
    const nodeId = getState().nodes[0]!.id;
    getState().setInputValue(nodeId, 5);
    expect(d(0)["value"]).toBe(5);
  });

  it("clamps to bitWidth max", () => {
    getState().addNode("circuitInput", pos, undefined, undefined, 4);
    const nodeId = getState().nodes[0]!.id;
    getState().setInputValue(nodeId, 999);
    // 4-bit max = 15
    expect(d(0)["value"]).toBe(15);
  });
});

// === rotateNode ===

describe("rotateNode", () => {
  it("cycles rotation 0 → 90 → 180 → 270 → 0", () => {
    getState().addNode("circuitInput", pos);
    const nodeId = getState().nodes[0]!.id;
    expect(d(0)["rotation"]).toBe(0);

    getState().rotateNode(nodeId);
    expect(d(0)["rotation"]).toBe(90);

    getState().rotateNode(nodeId);
    expect(d(0)["rotation"]).toBe(180);

    getState().rotateNode(nodeId);
    expect(d(0)["rotation"]).toBe(270);

    getState().rotateNode(nodeId);
    expect(d(0)["rotation"]).toBe(0);
  });
});

// === tickClocks ===

describe("tickClocks", () => {
  it("toggles all clock values", () => {
    getState().addNode("clock", pos);
    getState().addNode("clock", pos);
    expect(d(0)["value"]).toBe(0);
    expect(d(1)["value"]).toBe(0);

    getState().tickClocks();
    expect(d(0)["value"]).toBe(1);
    expect(d(1)["value"]).toBe(1);

    getState().tickClocks();
    expect(d(0)["value"]).toBe(0);
    expect(d(1)["value"]).toBe(0);
  });

  it("bumps simulationVersion", () => {
    getState().addNode("clock", pos);
    const v = getState().simulationVersion;
    getState().tickClocks();
    expect(getState().simulationVersion).toBe(v + 1);
  });
});

// === undo / redo ===

describe("undo / redo", () => {
  it("restores state after addNode", () => {
    getState().addNode("circuitInput", pos);
    expect(getState().nodes).toHaveLength(1);

    getState().undo();
    expect(getState().nodes).toHaveLength(0);
  });

  it("redo restores undone state", () => {
    getState().addNode("circuitInput", pos);
    getState().undo();
    expect(getState().nodes).toHaveLength(0);

    getState().redo();
    expect(getState().nodes).toHaveLength(1);
  });

  it("undo on empty stack is a no-op", () => {
    const vBefore = getState().simulationVersion;
    getState().undo();
    expect(getState().simulationVersion).toBe(vBefore);
  });

  it("redo on empty stack is a no-op", () => {
    const vBefore = getState().simulationVersion;
    getState().redo();
    expect(getState().simulationVersion).toBe(vBefore);
  });

  it("supports multiple undo steps", () => {
    getState().addNode("circuitInput", pos);
    getState().addNode("circuitOutput", pos);
    getState().addNode("constant", pos);
    expect(getState().nodes).toHaveLength(3);

    getState().undo();
    expect(getState().nodes).toHaveLength(2);

    getState().undo();
    expect(getState().nodes).toHaveLength(1);

    getState().undo();
    expect(getState().nodes).toHaveLength(0);
  });

  it("caps history at MAX_HISTORY", () => {
    for (let i = 0; i < MAX_HISTORY + 10; i++) {
      getState().addNode("circuitInput", pos);
    }
    expect(getState().past.length).toBeLessThanOrEqual(MAX_HISTORY);
  });
});

// === clearCanvas / loadCircuit ===

describe("clearCanvas / loadCircuit", () => {
  it("clearCanvas resets state", () => {
    getState().addNode("circuitInput", pos);
    getState().addNode("circuitOutput", pos);
    getState().clearCanvas();
    expect(getState().nodes).toHaveLength(0);
    expect(getState().edges).toHaveLength(0);
    expect(getState().past).toHaveLength(0);
    expect(getState().future).toHaveLength(0);
    expect(getState().isDirty).toBe(false);
  });

  it("loadCircuit replaces state and clears history", () => {
    getState().addNode("circuitInput", pos);
    const newNodes: AppNode[] = [{
      id: "x1",
      type: "circuitInput",
      position: pos,
      data: { label: "X", pinId: "xp", value: 1, bits: 1, rotation: 0 },
    }];
    getState().loadCircuit(newNodes, []);
    expect(getState().nodes).toHaveLength(1);
    expect(getState().nodes[0]!.id).toBe("x1");
    expect(getState().past).toHaveLength(0);
    expect(getState().isDirty).toBe(false);
  });
});

// === drillDown ===

describe("drillDown", () => {
  it("loads module circuit into canvas and sets readOnly", () => {
    const moduleCircuit = makeCircuit(
      [{ id: "in1", type: "input", position: pos, rotation: 0, pins: [makePin("p1", "In", "output")] }],
      [],
    );
    const mod = makeModule("test-mod", moduleCircuit);
    useModuleStore.setState({ modules: [mod] });

    const moduleNode: AppNode = {
      id: "inst1",
      type: "module",
      position: pos,
      data: { label: "test-mod", moduleId: "test-mod", pins: [makePin("i1", "In", "input"), makePin("o1", "Out", "output")], rotation: 0 },
    };
    useCircuitStore.setState({ ...initialState, nodes: [moduleNode] });

    getState().drillDown("inst1");

    expect(getState().readOnly).toBe(true);
    expect(getState().drilldownStack).toHaveLength(1);
    expect(getState().drilldownStack[0]!.moduleId).toBe("test-mod");
    expect(getState().drilldownRoot).not.toBeNull();
    expect(getState().nodes).toHaveLength(1);
    expect(getState().nodes[0]!.type).toBe("circuitInput");
  });

  it("is a no-op for NAND module", () => {
    const nandNode: AppNode = {
      id: "nand1",
      type: "module",
      position: pos,
      data: { label: "NAND", moduleId: "builtin:nand", pins: [], rotation: 0 },
    };
    useCircuitStore.setState({ ...initialState, nodes: [nandNode] });

    getState().drillDown("nand1");
    expect(getState().drilldownStack).toHaveLength(0);
    expect(getState().readOnly).toBe(false);
  });

  it("is a no-op for splitter module", () => {
    const node: AppNode = {
      id: "sp1",
      type: "module",
      position: pos,
      data: { label: "Split", moduleId: "builtin:splitter", pins: [], rotation: 0 },
    };
    useCircuitStore.setState({ ...initialState, nodes: [node] });

    getState().drillDown("sp1");
    expect(getState().drilldownStack).toHaveLength(0);
  });

  it("is a no-op for merger module", () => {
    const node: AppNode = {
      id: "mg1",
      type: "module",
      position: pos,
      data: { label: "Merge", moduleId: "builtin:merger", pins: [], rotation: 0 },
    };
    useCircuitStore.setState({ ...initialState, nodes: [node] });

    getState().drillDown("mg1");
    expect(getState().drilldownStack).toHaveLength(0);
  });
});

// === navigateToLevel ===

describe("navigateToLevel", () => {
  it("level=0 restores root context", () => {
    const moduleCircuit = makeCircuit(
      [{ id: "in1", type: "input", position: pos, rotation: 0, pins: [makePin("p1", "In", "output")] }],
      [],
    );
    const mod = makeModule("test-mod", moduleCircuit);
    useModuleStore.setState({ modules: [mod] });

    const rootNode: AppNode = {
      id: "inst1",
      type: "module",
      position: pos,
      data: { label: "test-mod", moduleId: "test-mod", pins: [makePin("i1", "In", "input"), makePin("o1", "Out", "output")], rotation: 0 },
    };
    useCircuitStore.setState({ ...initialState, nodes: [rootNode] });

    getState().drillDown("inst1");
    expect(getState().readOnly).toBe(true);

    getState().navigateToLevel(0);
    expect(getState().readOnly).toBe(false);
    expect(getState().drilldownStack).toHaveLength(0);
    expect(getState().drilldownRoot).toBeNull();
    expect(getState().nodes).toHaveLength(1);
    expect(getState().nodes[0]!.id).toBe("inst1");
  });

  it("is a no-op without drilldownRoot", () => {
    const v = getState().simulationVersion;
    getState().navigateToLevel(0);
    expect(getState().simulationVersion).toBe(v);
  });
});

// === enterEditMode ===

describe("enterEditMode", () => {
  it("sets activeModuleId and clears drill-down", () => {
    const moduleCircuit = makeCircuit(
      [{ id: "in1", type: "input", position: pos, rotation: 0, pins: [makePin("p1", "In", "output")] }],
      [],
    );
    const mod = makeModule("test-mod", moduleCircuit);
    useModuleStore.setState({ modules: [mod] });

    const rootNode: AppNode = {
      id: "inst1",
      type: "module",
      position: pos,
      data: { label: "test-mod", moduleId: "test-mod", pins: [makePin("i1", "In", "input"), makePin("o1", "Out", "output")], rotation: 0 },
    };
    useCircuitStore.setState({ ...initialState, nodes: [rootNode] });

    getState().drillDown("inst1");
    expect(getState().drilldownStack).toHaveLength(1);

    getState().enterEditMode();
    expect(getState().activeModuleId).toBe("test-mod");
    expect(getState().drilldownStack).toHaveLength(0);
    expect(getState().drilldownRoot).toBeNull();
    expect(getState().readOnly).toBe(false);
  });

  it("is a no-op when drilldownStack is empty", () => {
    getState().enterEditMode();
    expect(getState().activeModuleId).toBeNull();
  });
});
