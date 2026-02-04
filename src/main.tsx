import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { useModuleStore } from "./store/module-store.ts";
import { useCircuitStore } from "./store/circuit-store.ts";
import { loadModules, loadCanvasState, initAutosave } from "./utils/persistence.ts";

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

initAutosave();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
