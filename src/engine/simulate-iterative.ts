import type { Circuit, Module, PinId } from "./types.ts";
import { buildAdjacencyList, evaluateNode, pinKey } from "./simulate.ts";

// === Constants ===

export const MAX_ITERATIONS = 100;

// === Types ===

export interface IterativeResult {
  pinValues: Map<string, boolean>;
  stable: boolean;
  unstableKeys: Set<string>;
  iterations: number;
}

// === Iterative evaluator for cyclic circuits ===

export function evaluateCircuitIterative(
  circuit: Circuit,
  inputs: Record<PinId, boolean>,
  modules: Module[] | undefined,
  prevPinValues: Map<string, boolean>,
): IterativeResult {
  const adj = buildAdjacencyList(circuit);
  const currentValues = new Map(prevPinValues);

  // Seed source nodes (input/constant/clock/button) with current inputs
  for (const node of circuit.nodes) {
    if (
      node.type === "input" ||
      node.type === "constant" ||
      node.type === "clock" ||
      node.type === "button"
    ) {
      for (const pin of node.pins) {
        if (pin.direction === "output") {
          currentValues.set(
            pinKey(node.id, pin.id),
            inputs[pin.id] ?? false,
          );
        }
      }
    }
  }

  // Iterative convergence loop (Gauss-Seidel style)
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const snapshot = new Map(currentValues);

    for (const node of circuit.nodes) {
      evaluateNode(node, adj, currentValues, modules);
    }

    // Check convergence
    let converged = true;
    for (const [key, value] of currentValues) {
      if (snapshot.get(key) !== value) {
        converged = false;
        break;
      }
    }
    // Also check for new keys added during evaluation
    if (converged && currentValues.size !== snapshot.size) {
      converged = false;
    }

    if (converged) {
      return {
        pinValues: currentValues,
        stable: true,
        unstableKeys: new Set(),
        iterations: iter + 1,
      };
    }
  }

  // Did not converge — find unstable keys
  const beforeLast = new Map(currentValues);
  for (const node of circuit.nodes) {
    evaluateNode(node, adj, currentValues, modules);
  }

  const unstableKeys = new Set<string>();
  for (const [key, value] of currentValues) {
    if (beforeLast.get(key) !== value) {
      unstableKeys.add(key);
    }
  }

  return {
    pinValues: currentValues,
    stable: false,
    unstableKeys,
    iterations: MAX_ITERATIONS,
  };
}
