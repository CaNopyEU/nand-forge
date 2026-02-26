import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  saveModules,
  loadModules,
  saveCanvasState,
  loadCanvasState,
  saveLibraryTree,
  loadLibraryTree,
  importFromJson,
} from "../../src/utils/persistence.ts";
import type { Module, Pin, Circuit } from "../../src/engine/types.ts";
import type { CanvasState } from "../../src/utils/persistence.ts";
import type { LibraryNode } from "../../src/store/library-store.ts";

// === In-memory localStorage stub ===

let storage: Record<string, string>;

beforeEach(() => {
  storage = {};
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, value: string) => { storage[key] = value; },
    removeItem: (key: string) => { delete storage[key]; },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// === Factory helpers ===

function makePin(id: string, name: string, direction: "input" | "output"): Pin {
  return { id, name, direction, bits: 1 };
}

function makeCircuit(): Circuit {
  return { id: "c", name: "c", nodes: [], edges: [] };
}

function makeModule(id: string): Module {
  return {
    id,
    name: id,
    inputs: [makePin("in", "In", "input")],
    outputs: [makePin("out", "Out", "output")],
    circuit: makeCircuit(),
    createdAt: "",
    updatedAt: "",
  };
}

function makeFile(content: string): File {
  return { text: () => Promise.resolve(content) } as unknown as File;
}

// === saveModules / loadModules ===

describe("saveModules / loadModules", () => {
  it("roundtrips modules", () => {
    const modules = [makeModule("m1"), makeModule("m2")];
    saveModules(modules);
    const loaded = loadModules();
    expect(loaded).toHaveLength(2);
    expect(loaded[0]!.id).toBe("m1");
    expect(loaded[1]!.id).toBe("m2");
  });

  it("returns empty array when nothing saved", () => {
    expect(loadModules()).toEqual([]);
  });

  it("returns empty array on corrupted JSON", () => {
    storage["nandforge:modules"] = "{{{invalid";
    expect(loadModules()).toEqual([]);
  });

  it("returns empty array when stored value is not an array", () => {
    storage["nandforge:modules"] = JSON.stringify({ not: "array" });
    expect(loadModules()).toEqual([]);
  });
});

// === saveCanvasState / loadCanvasState ===

describe("saveCanvasState / loadCanvasState", () => {
  it("roundtrips canvas state", () => {
    const state: CanvasState = {
      nodes: [{ id: "n1", type: "circuitInput", position: { x: 0, y: 0 }, data: { label: "In", pinId: "p1", value: 0, bits: 1, rotation: 0 } }] as CanvasState["nodes"],
      edges: [],
      activeModuleId: "mod-1",
    };
    saveCanvasState(state);
    const loaded = loadCanvasState();
    expect(loaded).not.toBeNull();
    expect(loaded!.nodes).toHaveLength(1);
    expect(loaded!.activeModuleId).toBe("mod-1");
  });

  it("returns null when nothing saved", () => {
    expect(loadCanvasState()).toBeNull();
  });

  it("returns null on corrupted JSON", () => {
    storage["nandforge:canvas"] = "not-json!!!";
    expect(loadCanvasState()).toBeNull();
  });

  it("migrates boolean value to number", () => {
    const state = {
      nodes: [{ id: "n1", type: "circuitInput", position: { x: 0, y: 0 }, data: { label: "In", pinId: "p1", value: true, bits: 1, rotation: 0 } }],
      edges: [],
      activeModuleId: null,
    };
    storage["nandforge:canvas"] = JSON.stringify(state);
    const loaded = loadCanvasState();
    const d = loaded!.nodes[0]!.data as Record<string, unknown>;
    expect(d["value"]).toBe(1);
  });

  it("migrates boolean pressed to number", () => {
    const state = {
      nodes: [{ id: "n1", type: "button", position: { x: 0, y: 0 }, data: { label: "BTN", pinId: "p1", pressed: false, rotation: 0 } }],
      edges: [],
      activeModuleId: null,
    };
    storage["nandforge:canvas"] = JSON.stringify(state);
    const loaded = loadCanvasState();
    const d = loaded!.nodes[0]!.data as Record<string, unknown>;
    expect(d["pressed"]).toBe(0);
  });
});

// === saveLibraryTree / loadLibraryTree ===

describe("saveLibraryTree / loadLibraryTree", () => {
  it("roundtrips library tree", () => {
    const tree: LibraryNode[] = [
      { type: "folder", id: "f1", name: "Gates", children: [{ type: "module", moduleId: "m1" }], collapsed: false },
    ];
    saveLibraryTree(tree);
    const loaded = loadLibraryTree();
    expect(loaded).toHaveLength(1);
    expect(loaded![0]!.type).toBe("folder");
  });

  it("returns null when nothing saved", () => {
    expect(loadLibraryTree()).toBeNull();
  });

  it("returns null on corrupted JSON", () => {
    storage["nandforge:library"] = "bad-json";
    expect(loadLibraryTree()).toBeNull();
  });

  it("returns null when stored value is not an array", () => {
    storage["nandforge:library"] = JSON.stringify({ obj: true });
    expect(loadLibraryTree()).toBeNull();
  });
});

// === importFromJson ===

describe("importFromJson", () => {
  it("imports valid v2 file", async () => {
    const payload = {
      version: 2,
      modules: [makeModule("m1")],
      library: [{ type: "module", moduleId: "m1" }],
    };
    const result = await importFromJson(makeFile(JSON.stringify(payload)));
    expect(result.modules).toHaveLength(1);
    expect(result.library).toHaveLength(1);
  });

  it("imports valid v1 file (no library)", async () => {
    const payload = {
      version: 1,
      modules: [makeModule("m1")],
    };
    const result = await importFromJson(makeFile(JSON.stringify(payload)));
    expect(result.modules).toHaveLength(1);
    expect(result.library).toBeUndefined();
  });

  it("throws on invalid JSON", async () => {
    await expect(importFromJson(makeFile("not-json!!!"))).rejects.toThrow("Invalid JSON file.");
  });

  it("throws on non-object value", async () => {
    await expect(importFromJson(makeFile('"just a string"'))).rejects.toThrow("Invalid export file format.");
  });

  it("throws when modules is not an array", async () => {
    await expect(importFromJson(makeFile(JSON.stringify({ modules: "nope" })))).rejects.toThrow('Export file must contain a "modules" array.');
  });

  it("throws when module is missing id", async () => {
    const payload = { modules: [{ name: "x", inputs: [], outputs: [], circuit: { nodes: [], edges: [] } }] };
    await expect(importFromJson(makeFile(JSON.stringify(payload)))).rejects.toThrow('Module at index 0 is missing "id".');
  });

  it("throws when module circuit is missing nodes", async () => {
    const payload = { modules: [{ id: "m", name: "x", inputs: [], outputs: [], circuit: { edges: [] } }] };
    await expect(importFromJson(makeFile(JSON.stringify(payload)))).rejects.toThrow('Module at index 0: circuit is missing "nodes".');
  });

  it("throws when module circuit is missing edges", async () => {
    const payload = { modules: [{ id: "m", name: "x", inputs: [], outputs: [], circuit: { nodes: [] } }] };
    await expect(importFromJson(makeFile(JSON.stringify(payload)))).rejects.toThrow('Module at index 0: circuit is missing "edges".');
  });
});
