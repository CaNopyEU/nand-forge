import { useEffect, useCallback } from "react";
import { useCircuitStore } from "../store/circuit-store.ts";
import { useSimulationStore } from "../store/simulation-store.ts";
import { useModuleStore } from "../store/module-store.ts";
import { pinKey } from "../engine/simulate.ts";
import { canvasToCircuit } from "../utils/canvas-to-circuit.ts";
import { useSimulationWorker } from "./useSimulationWorker.ts";
import type { AppNode } from "../store/circuit-store.ts";
import type { Edge as RFEdge } from "@xyflow/react";
import type { WorkerResponse } from "../engine/worker-protocol.ts";

/**
 * Applies drill-down overlay: extracts pinValues/edgeSignals
 * for the drilled-down sub-module from instanceStates.
 */
function applyDrilldownOverlay() {
  const circuitState = useCircuitStore.getState();
  const { drilldownStack, edges } = circuitState;

  const simState = useSimulationStore.getState();
  let targetInstance = simState.instanceStates.get(drilldownStack[0]!.instanceNodeId);

  for (let i = 1; i < drilldownStack.length && targetInstance; i++) {
    targetInstance = targetInstance.children.get(drilldownStack[i]!.instanceNodeId);
  }

  if (!targetInstance) {
    useSimulationStore.setState({ pinValues: {}, edgeSignals: {} });
    return;
  }

  const pinValues: Record<string, number> = {};
  for (const [key, value] of targetInstance.pinValues) {
    pinValues[key] = value;
  }

  const edgeSignals: Record<string, number> = {};
  for (const edge of edges) {
    if (edge.sourceHandle) {
      const key = pinKey(edge.source, edge.sourceHandle);
      edgeSignals[edge.id] = pinValues[key] ?? 0;
    }
  }

  useSimulationStore.setState({ pinValues, edgeSignals });
}

/**
 * Hook that triggers circuit simulation whenever the circuit changes.
 * Watches `simulationVersion` (bumped only on simulation-relevant mutations)
 * and reads nodes/edges via getState() to avoid subscribing to drag/pan updates.
 *
 * Uses a Web Worker for evaluation when available, falling back to synchronous
 * evaluation on the main thread.
 *
 * In drill-down mode, simulates the **root** circuit and then extracts
 * pinValues/edgeSignals for the drilled-down sub-module from instanceStates.
 *
 * Call once in the Canvas component.
 */
export function useSimulation() {
  const simulationVersion = useCircuitStore((s) => s.simulationVersion);
  const runSimulation = useSimulationStore((s) => s.runSimulation);
  const applyResult = useSimulationStore((s) => s.applyResult);

  const onWorkerResult = useCallback(
    (response: WorkerResponse) => {
      if (response.type === "error") {
        console.error("[SimWorker]", response.message);
        return;
      }

      const { requestId, pinValues, instanceStates, stable, unstableKeys } = response;

      // Discard stale responses
      if (requestId !== worker.pendingRequestId()) return;

      const circuitState = useCircuitStore.getState();
      const { drilldownRoot, drilldownStack } = circuitState;
      const rfEdges =
        drilldownRoot && drilldownStack.length > 0
          ? drilldownRoot.edges
          : circuitState.edges;

      applyResult(pinValues, instanceStates, stable, unstableKeys, rfEdges);

      // Drill-down overlay
      if (drilldownRoot && drilldownStack.length > 0) {
        applyDrilldownOverlay();
      }
    },
    // applyResult is stable (Zustand action)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const worker = useSimulationWorker(onWorkerResult);

  useEffect(() => {
    const circuitState = useCircuitStore.getState();
    const { drilldownRoot, drilldownStack } = circuitState;

    // Determine which nodes/edges to simulate
    let simNodes: AppNode[];
    let simEdges: RFEdge[];
    if (drilldownRoot && drilldownStack.length > 0) {
      simNodes = drilldownRoot.nodes;
      simEdges = drilldownRoot.edges;
    } else {
      simNodes = circuitState.nodes;
      simEdges = circuitState.edges;
    }

    // Try worker path
    const { circuit, inputValues } = canvasToCircuit(simNodes, simEdges);

    if (circuit.nodes.length === 0) {
      useSimulationStore.setState({
        pinValues: {},
        edgeSignals: {},
        oscillating: false,
        unstableEdges: {},
        conflictEdges: {},
        zEdges: {},
        instanceStates: new Map(),
        ramStates: {},
      });
      return;
    }

    const modules = useModuleStore.getState().modules;
    const simState = useSimulationStore.getState();

    const requestId = worker.nextRequestId();
    const sent = worker.postSimulate({
      type: "simulate",
      requestId,
      circuit,
      inputValues,
      modules,
      instanceStates: simState.instanceStates,
      prevPinValues: simState.prevPinValues,
    });

    if (!sent) {
      // Fallback: synchronous simulation on main thread
      runSimulation(simNodes, simEdges);

      if (drilldownRoot && drilldownStack.length > 0) {
        applyDrilldownOverlay();
      }
    }
  }, [simulationVersion, runSimulation, worker]);
}
