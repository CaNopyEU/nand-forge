import { create } from "zustand";
import type { Edge as RFEdge } from "@xyflow/react";
import { evaluateCircuitFull, pinKey } from "../engine/simulate.ts";
import { canvasToCircuit } from "../utils/canvas-to-circuit.ts";
import { useModuleStore } from "./module-store.ts";
import type { AppNode } from "./circuit-store.ts";

// === Store ===

interface SimulationStore {
  /** All computed pin values, keyed by "nodeId:pinId" */
  pinValues: Record<string, boolean>;
  /** Signal value per edge, keyed by edge ID */
  edgeSignals: Record<string, boolean>;

  runSimulation: (nodes: AppNode[], edges: RFEdge[]) => void;
}

export const useSimulationStore = create<SimulationStore>((set) => ({
  pinValues: {},
  edgeSignals: {},

  runSimulation: (nodes, edges) => {
    const { circuit, inputValues } = canvasToCircuit(nodes, edges);

    if (circuit.nodes.length === 0) {
      set({ pinValues: {}, edgeSignals: {} });
      return;
    }

    try {
      const modules = useModuleStore.getState().modules;
      const pinMap = evaluateCircuitFull(circuit, inputValues, modules);

      const pinValues: Record<string, boolean> = {};
      for (const [key, value] of pinMap) {
        pinValues[key] = value;
      }

      // Derive edge signals: each edge carries the value of its source output pin
      const edgeSignals: Record<string, boolean> = {};
      for (const edge of edges) {
        if (edge.sourceHandle) {
          const key = pinKey(edge.source, edge.sourceHandle);
          edgeSignals[edge.id] = pinValues[key] ?? false;
        }
      }

      set({ pinValues, edgeSignals });
    } catch {
      // Circuit has a cycle or other evaluation error — clear values
      set({ pinValues: {}, edgeSignals: {} });
    }
  },
}));
