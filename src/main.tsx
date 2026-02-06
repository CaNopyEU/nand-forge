import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { useModuleStore } from "./store/module-store.ts";
import { useCircuitStore } from "./store/circuit-store.ts";
import { useLibraryStore } from "./store/library-store.ts";
import { loadModules, loadCanvasState, loadLibraryTree, initAutosave } from "./utils/persistence.ts";

// Restore persisted state before rendering
const modules = loadModules();
if (modules.length > 0) {
  useModuleStore.setState({ modules });
}

const canvas = loadCanvasState();
if (canvas) {
  useCircuitStore.setState({
    nodes: canvas.nodes,
    edges: canvas.edges,
    activeModuleId: canvas.activeModuleId,
    isDirty: false,
  });
}

// Restore library tree (or auto-generate flat tree from modules)
const libraryTree = loadLibraryTree();
if (libraryTree) {
  useLibraryStore.setState({ tree: libraryTree });
} else if (modules.length > 0) {
  // Auto-generate flat tree from existing modules
  useLibraryStore.setState({
    tree: modules.map((m) => ({ type: "module" as const, moduleId: m.id })),
  });
}

initAutosave();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
