import { create } from "zustand";
import type { Edge as RFEdge } from "@xyflow/react";
import { evaluateCircuitFull, pinKey, type InstanceState } from "../engine/simulate.ts";
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
  /** Per-instance state for cyclic sub-modules (hierarchical) */
  instanceStates: Map<string, InstanceState>;
  /** Whether the circuit is oscillating (did not converge) */
  oscillating: boolean;
  /** Edges that are unstable (oscillating), keyed by edge ID */
  unstableEdges: Record<string, boolean>;
  /** Whether the clock is running */
  running: boolean;
  /** Ticks per second */
  tickRate: number;
  /** Signal history for timing diagram */
  signalHistory: Array<Record<string, boolean>>;
  /** Maximum number of ticks to record */
  maxHistoryLength: number;
  /** Whether recording is active */
  recording: boolean;

  runSimulation: (nodes: AppNode[], edges: RFEdge[]) => void;
  play: () => void;
  pause: () => void;
  step: () => void;
  setTickRate: (hz: number) => void;
  toggleRecording: () => void;
  clearHistory: () => void;
}

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  pinValues: {},
  edgeSignals: {},
  prevPinValues: new Map(),
  instanceStates: new Map(),
  oscillating: false,
  unstableEdges: {},
  running: false,
  tickRate: 2,
  signalHistory: [],
  maxHistoryLength: 128,
  recording: false,

  play: () => set({ running: true }),
  pause: () => set({ running: false }),
  step: () => {
    const circuitStore = useCircuitStore.getState();
    circuitStore.tickClocks();
    // Simulation will re-run via useSimulation hook reacting to simulationVersion bump
  },
  setTickRate: (hz) => set({ tickRate: hz }),
  toggleRecording: () => set((s) => ({ recording: !s.recording })),
  clearHistory: () => set({ signalHistory: [] }),

  runSimulation: (nodes, edges) => {
    const { circuit, inputValues } = canvasToCircuit(nodes, edges);

    if (circuit.nodes.length === 0) {
      set({ pinValues: {}, edgeSignals: {}, oscillating: false, unstableEdges: {}, instanceStates: new Map() });
      return;
    }

    const modules = useModuleStore.getState().modules;
    const instanceStates = get().instanceStates;
    let pinMap: Map<string, boolean>;
    let stable = true;
    let unstableKeys = new Set<string>();

    try {
      pinMap = evaluateCircuitFull(circuit, inputValues, modules, instanceStates);
    } catch {
      // Cycle detected — use iterative evaluation with delay model
      const result = evaluateCircuitIterative(
        circuit,
        inputValues,
        modules,
        get().prevPinValues,
        instanceStates,
      );
      pinMap = result.pinValues;
      stable = result.stable;
      unstableKeys = result.unstableKeys;
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

    const state = get();
    const nextHistory = state.recording
      ? [...state.signalHistory.slice(-(state.maxHistoryLength - 1)), pinValues]
      : state.signalHistory;

    set({
      pinValues,
      edgeSignals,
      prevPinValues: pinMap,
      instanceStates,
      oscillating: !stable,
      unstableEdges,
      signalHistory: nextHistory,
    });
  },
}));
