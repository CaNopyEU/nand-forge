import type { CircuitNode, Module } from "../types.ts";
import type { AdjacencyList, InstanceState } from "../simulate.ts";

/**
 * No-op evaluator for source nodes that are seeded before evaluation:
 * input, constant, clock, button, pullup, pulldown.
 */
export function evaluateSeeded(
  _node: CircuitNode,
  _adj: AdjacencyList,
  _pinValues: Map<string, number>,
  _modules?: Module[],
  _instanceStates?: Map<string, InstanceState>,
): void {
  // Already seeded — nothing to do
}
