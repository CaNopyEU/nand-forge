import { useEffect } from "react";
import { useCircuitStore } from "../store/circuit-store.ts";
import { useSimulationStore } from "../store/simulation-store.ts";

/**
 * Hook that triggers circuit simulation whenever the circuit changes.
 * Watches `simulationVersion` (bumped only on simulation-relevant mutations)
 * and reads nodes/edges via getState() to avoid subscribing to drag/pan updates.
 *
 * Call once in the Canvas component.
 */
export function useSimulation() {
  const simulationVersion = useCircuitStore((s) => s.simulationVersion);
  const runSimulation = useSimulationStore((s) => s.runSimulation);

  useEffect(() => {
    const { nodes, edges } = useCircuitStore.getState();
    runSimulation(nodes, edges);
  }, [simulationVersion, runSimulation]);
}
