import { useEffect } from "react";
import { useCircuitStore } from "../store/circuit-store.ts";
import { useSimulationStore } from "../store/simulation-store.ts";

/**
 * Hook that drives clock nodes at the configured tick rate.
 * When running=true, toggles all clock node values on each tick.
 * Call once in the Canvas component.
 */
export function useClockTick() {
  const running = useSimulationStore((s) => s.running);
  const tickRate = useSimulationStore((s) => s.tickRate);

  useEffect(() => {
    if (!running) return;

    const interval = setInterval(() => {
      useCircuitStore.getState().tickClocks();
    }, 1000 / tickRate);

    return () => clearInterval(interval);
  }, [running, tickRate]);
}
