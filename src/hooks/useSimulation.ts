import { useEffect } from "react";
import { useCircuitStore } from "../store/circuit-store.ts";
import { useSimulationStore } from "../store/simulation-store.ts";
import { pinKey } from "../engine/simulate.ts";

/**
 * Hook that triggers circuit simulation whenever the circuit changes.
 * Watches `simulationVersion` (bumped only on simulation-relevant mutations)
 * and reads nodes/edges via getState() to avoid subscribing to drag/pan updates.
 *
 * In drill-down mode, simulates the **root** circuit and then extracts
 * pinValues/edgeSignals for the drilled-down sub-module from instanceStates.
 *
 * Call once in the Canvas component.
 */
export function useSimulation() {
  const simulationVersion = useCircuitStore((s) => s.simulationVersion);
  const runSimulation = useSimulationStore((s) => s.runSimulation);

  useEffect(() => {
    const circuitState = useCircuitStore.getState();
    const { drilldownRoot, drilldownStack, nodes, edges } = circuitState;

    if (!drilldownRoot || drilldownStack.length === 0) {
      // Normal mode: simulate the canvas circuit
      runSimulation(nodes, edges);
      return;
    }

    // Drill-down mode: simulate the root circuit
    runSimulation(drilldownRoot.nodes, drilldownRoot.edges);

    // Traverse instanceStates hierarchy following the drilldownStack
    const simState = useSimulationStore.getState();
    let currentStates = simState.instanceStates;
    let targetInstance = currentStates.get(drilldownStack[0]!.instanceNodeId);

    for (let i = 1; i < drilldownStack.length && targetInstance; i++) {
      targetInstance = targetInstance.children.get(drilldownStack[i]!.instanceNodeId);
    }

    if (!targetInstance) {
      // No instance state found — show zeroes
      useSimulationStore.setState({ pinValues: {}, edgeSignals: {} });
      return;
    }

    // Convert the target instance's pinValues to Record<string, number>
    const pinValues: Record<string, number> = {};
    for (const [key, value] of targetInstance.pinValues) {
      pinValues[key] = value;
    }

    // Derive edge signals from the canvas edges (the drilled-down view)
    const edgeSignals: Record<string, number> = {};
    for (const edge of edges) {
      if (edge.sourceHandle) {
        const key = pinKey(edge.source, edge.sourceHandle);
        edgeSignals[edge.id] = pinValues[key] ?? 0;
      }
    }

    useSimulationStore.setState({ pinValues, edgeSignals });
  }, [simulationVersion, runSimulation]);
}
