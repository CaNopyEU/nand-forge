import { create } from "zustand";
import type { Edge as RFEdge } from "@xyflow/react";
import { evaluateCircuitFull, pinKey } from "../engine/simulate.ts";
import { evaluateCircuitIterative } from "../engine/simulate-iterative.ts";
import { canvasToCircuit } from "../utils/canvas-to-circuit.ts";
import { useModuleStore } from "./module-store.ts";
import { useCircuitStore, type AppNode } from "./circuit-store.ts";

// === Store ===

interface SimulationStore {
  /** All computed pin values, keyed by "nodeId:pinId" */
  pinValues: Record<string, boolean>;
  /** Signal value per edge, keyed by edge ID */
  edgeSignals: Record<string, boolean>;
  /** Pin values from previous tick (for iterative delay model) */
  prevPinValues: Map<string, boolean>;
  /** Whether the circuit is oscillating (did not converge) */
  oscillating: boolean;
  /** Edges that are unstable (oscillating), keyed by edge ID */
  unstableEdges: Record<string, boolean>;
  /** Whether the clock is running */
  running: boolean;
  /** Ticks per second */
  tickRate: number;

  runSimulation: (nodes: AppNode[], edges: RFEdge[]) => void;
  play: () => void;
  pause: () => void;
  step: () => void;
  setTickRate: (hz: number) => void;
}

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  pinValues: {},
  edgeSignals: {},
  prevPinValues: new Map(),
  oscillating: false,
  unstableEdges: {},
  running: false,
  tickRate: 2,

  play: () => set({ running: true }),
  pause: () => set({ running: false }),
  step: () => {
    const circuitStore = useCircuitStore.getState();
    circuitStore.tickClocks();
    // Simulation will re-run via useSimulation hook reacting to simulationVersion bump
  },
  setTickRate: (hz) => set({ tickRate: hz }),

  runSimulation: (nodes, edges) => {
    const { circuit, inputValues } = canvasToCircuit(nodes, edges);

    if (circuit.nodes.length === 0) {
      set({ pinValues: {}, edgeSignals: {}, oscillating: false, unstableEdges: {} });
      return;
    }

    const modules = useModuleStore.getState().modules;
    let pinMap: Map<string, boolean>;
    let stable = true;
    let unstableKeys = new Set<string>();

    try {
      pinMap = evaluateCircuitFull(circuit, inputValues, modules);
    } catch {
      // Cycle detected — try iterative evaluation if clock is present
      const hasClock = circuit.nodes.some((n) => n.type === "clock");
      if (hasClock) {
        const result = evaluateCircuitIterative(
          circuit,
          inputValues,
          modules,
          get().prevPinValues,
        );
        pinMap = result.pinValues;
        stable = result.stable;
        unstableKeys = result.unstableKeys;
      } else {
        set({ pinValues: {}, edgeSignals: {}, oscillating: false, unstableEdges: {} });
        return;
      }
    }

    const pinValues: Record<string, boolean> = {};
    for (const [key, value] of pinMap) {
      pinValues[key] = value;
    }

    // Derive edge signals: each edge carries the value of its source output pin
    const edgeSignals: Record<string, boolean> = {};
    const unstableEdges: Record<string, boolean> = {};
    for (const edge of edges) {
      if (edge.sourceHandle) {
        const key = pinKey(edge.source, edge.sourceHandle);
        edgeSignals[edge.id] = pinValues[key] ?? false;
        if (unstableKeys.has(key)) {
          unstableEdges[edge.id] = true;
        }
      }
    }

    set({
      pinValues,
      edgeSignals,
      prevPinValues: pinMap,
      oscillating: !stable,
      unstableEdges,
    });
  },
}));
