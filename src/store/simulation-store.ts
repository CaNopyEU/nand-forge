import { create } from "zustand";
import type { Edge as RFEdge } from "@xyflow/react";
import { evaluateCircuitFull, pinKey, Z_VALUE, CONFLICT, type InstanceState } from "../engine/simulate.ts";
import { evaluateCircuitIterative } from "../engine/simulate-iterative.ts";
import { canvasToCircuit } from "../utils/canvas-to-circuit.ts";
import { useModuleStore } from "./module-store.ts";
import { useCircuitStore, type AppNode } from "./circuit-store.ts";

// === Store ===

export interface RamState {
  data: number[];
  lastWriteAddr: number | null;
}

interface SimulationStore {
  /** All computed pin values, keyed by "nodeId:pinId" */
  pinValues: Record<string, number>;
  /** Signal value per edge, keyed by edge ID */
  edgeSignals: Record<string, number>;
  /** Pin values from previous tick (for iterative delay model) */
  prevPinValues: Map<string, number>;
  /** Per-instance state for cyclic sub-modules (hierarchical) */
  instanceStates: Map<string, InstanceState>;
  /** Live RAM contents per RAM node ID */
  ramStates: Record<string, RamState>;
  /** Whether the circuit is oscillating (did not converge) */
  oscillating: boolean;
  /** Edges that are unstable (oscillating), keyed by edge ID */
  unstableEdges: Record<string, boolean>;
  /** Edges carrying a bus conflict (multiple strong drivers disagree) */
  conflictEdges: Record<string, boolean>;
  /** Edges carrying Z (high-impedance, no active driver) */
  zEdges: Record<string, boolean>;
  /** Whether the clock is running */
  running: boolean;
  /** Ticks per second */
  tickRate: number;
  /** Signal history for timing diagram */
  signalHistory: Array<Record<string, number>>;
  /** Maximum number of ticks to record */
  maxHistoryLength: number;
  /** Whether recording is active */
  recording: boolean;

  runSimulation: (nodes: AppNode[], edges: RFEdge[]) => void;
  applyResult: (
    pinMap: Map<string, number>,
    instanceStates: Map<string, InstanceState>,
    stable: boolean,
    unstableKeys: Set<string>,
    rfEdges: RFEdge[],
  ) => void;
  clearRamState: (nodeId: string, data: number[]) => void;
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
  ramStates: {},
  oscillating: false,
  unstableEdges: {},
  conflictEdges: {},
  zEdges: {},
  running: false,
  tickRate: 2,
  signalHistory: [],
  maxHistoryLength: 128,
  recording: false,

  clearRamState: (nodeId, data) =>
    set((state) => {
      const newInstanceStates = new Map(state.instanceStates);
      newInstanceStates.delete(nodeId); // forces re-init from initialData next tick
      const newRamStates = { ...state.ramStates, [nodeId]: { data, lastWriteAddr: null } };
      return { instanceStates: newInstanceStates, ramStates: newRamStates };
    }),

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
      set({ pinValues: {}, edgeSignals: {}, oscillating: false, unstableEdges: {}, conflictEdges: {}, zEdges: {}, instanceStates: new Map(), ramStates: {} });
      return;
    }

    const modules = useModuleStore.getState().modules;
    const instanceStates = get().instanceStates;
    let pinMap: Map<string, number>;
    let stable = true;
    let unstableKeys = new Set<string>();

    try {
      pinMap = evaluateCircuitFull(circuit, inputValues, modules, instanceStates);
    } catch {
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

    get().applyResult(pinMap, instanceStates, stable, unstableKeys, edges);
  },

  applyResult: (pinMap, instanceStates, stable, unstableKeys, rfEdges) => {
    const pinValues: Record<string, number> = {};
    for (const [key, value] of pinMap) {
      pinValues[key] = value;
    }

    // Derive edge signals and state flags from source pin values
    const edgeSignals: Record<string, number> = {};
    const unstableEdges: Record<string, boolean> = {};
    const conflictEdges: Record<string, boolean> = {};
    const zEdges: Record<string, boolean> = {};
    for (const edge of rfEdges) {
      if (edge.sourceHandle) {
        const key = pinKey(edge.source, edge.sourceHandle);
        const val = pinValues[key] ?? 0;
        edgeSignals[edge.id] = val;
        if (unstableKeys.has(key)) unstableEdges[edge.id] = true;
        if (val === CONFLICT) conflictEdges[edge.id] = true;
        if (val === Z_VALUE) zEdges[edge.id] = true;
      }
    }

    // Extract RAM states for reactive viewer access
    const ramStates: Record<string, RamState> = {};
    for (const [nodeId, iState] of instanceStates) {
      if (iState.ramData !== undefined) {
        ramStates[nodeId] = {
          data: iState.ramData,
          lastWriteAddr: iState.lastWriteAddr ?? null,
        };
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
      ramStates,
      oscillating: !stable,
      unstableEdges,
      conflictEdges,
      zEdges,
      signalHistory: nextHistory,
    });
  },
}));
