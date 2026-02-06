import type { Module } from "../engine/types.ts";
import type { AppNode } from "../store/circuit-store.ts";
import type { Edge as RFEdge } from "@xyflow/react";
import type { LibraryNode } from "../store/library-store.ts";
import { useModuleStore } from "../store/module-store.ts";
import { useCircuitStore } from "../store/circuit-store.ts";
import { useLibraryStore } from "../store/library-store.ts";

// === Types ===

export interface CanvasState {
  nodes: AppNode[];
  edges: RFEdge[];
  activeModuleId: string | null;
}

// === Storage keys ===

const STORAGE_KEYS = {
  modules: "nandforge:modules",
  canvas: "nandforge:canvas",
  library: "nandforge:library",
} as const;

// === localStorage helpers ===

export function saveModules(modules: Module[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.modules, JSON.stringify(modules));
  } catch {
    // Silently fail — localStorage may be full or unavailable
  }
}

export function loadModules(): Module[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.modules);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveCanvasState(state: CanvasState): void {
  try {
    localStorage.setItem(STORAGE_KEYS.canvas, JSON.stringify(state));
  } catch {
    // Silently fail
  }
}

export function loadCanvasState(): CanvasState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.canvas);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as CanvasState;
  } catch {
    return null;
  }
}

export function saveLibraryTree(tree: LibraryNode[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.library, JSON.stringify(tree));
  } catch {
    // Silently fail
  }
}

export function loadLibraryTree(): LibraryNode[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.library);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as LibraryNode[];
  } catch {
    return null;
  }
}

// === Debounce ===

function debounce(fn: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setTimeout>;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}

// === Autosave ===

export function initAutosave(): void {
  const debouncedSaveModules = debounce(() => {
    saveModules(useModuleStore.getState().modules);
  }, 500);

  const debouncedSaveCanvas = debounce(() => {
    const { nodes, edges, activeModuleId } = useCircuitStore.getState();
    saveCanvasState({ nodes, edges, activeModuleId });
  }, 500);

  const debouncedSaveLibrary = debounce(() => {
    saveLibraryTree(useLibraryStore.getState().tree);
  }, 500);

  useModuleStore.subscribe(debouncedSaveModules);
  useCircuitStore.subscribe(debouncedSaveCanvas);
  useLibraryStore.subscribe(debouncedSaveLibrary);
}

// === Export ===

export function exportToJson(modules: Module[]): void {
  const library = useLibraryStore.getState().tree;
  const payload = { version: 2, modules, library };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "nandforge-export.json";
  a.click();

  URL.revokeObjectURL(url);
}

// === Import ===

export async function importFromJson(file: File): Promise<{ modules: Module[]; library?: LibraryNode[] }> {
  const text = await file.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON file.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid export file format.");
  }

  const data = parsed as Record<string, unknown>;
  const modulesArr = data["modules"];

  if (!Array.isArray(modulesArr)) {
    throw new Error('Export file must contain a "modules" array.');
  }

  for (let i = 0; i < modulesArr.length; i++) {
    const m = modulesArr[i] as Record<string, unknown>;
    if (typeof m["id"] !== "string") throw new Error(`Module at index ${i} is missing "id".`);
    if (typeof m["name"] !== "string") throw new Error(`Module at index ${i} is missing "name".`);
    if (!Array.isArray(m["inputs"])) throw new Error(`Module at index ${i} is missing "inputs".`);
    if (!Array.isArray(m["outputs"])) throw new Error(`Module at index ${i} is missing "outputs".`);
    if (!m["circuit"] || typeof m["circuit"] !== "object") throw new Error(`Module at index ${i} is missing "circuit".`);
    const circuit = m["circuit"] as Record<string, unknown>;
    if (!Array.isArray(circuit["nodes"])) throw new Error(`Module at index ${i}: circuit is missing "nodes".`);
    if (!Array.isArray(circuit["edges"])) throw new Error(`Module at index ${i}: circuit is missing "edges".`);
  }

  // Library tree (optional, backward-compatible)
  const libraryArr = data["library"];
  const library = Array.isArray(libraryArr) ? (libraryArr as LibraryNode[]) : undefined;

  return { modules: modulesArr as Module[], library };
}
