import type { CircuitNode, Module } from "../types.ts";
import type { AdjacencyList, InstanceState } from "../simulate.ts";
import { pinKey, resolveInputInternal } from "../simulate.ts";

/**
 * Evaluator for output and probe nodes: reads upstream values into input pins.
 */
export function evaluateOutput(
  node: CircuitNode,
  adj: AdjacencyList,
  pinValues: Map<string, number>,
  _modules?: Module[],
  _instanceStates?: Map<string, InstanceState>,
): void {
  for (const pin of node.pins) {
    if (pin.direction === "input") {
      const key = pinKey(node.id, pin.id);
      pinValues.set(key, resolveInputInternal(adj, key, pinValues));
    }
  }
}

/**
 * Tunnel evaluator: reads input pin, copies value to output pin.
 */
export function evaluateTunnel(
  node: CircuitNode,
  adj: AdjacencyList,
  pinValues: Map<string, number>,
  _modules?: Module[],
  _instanceStates?: Map<string, InstanceState>,
): void {
  const tInPin = node.pins.find((p) => p.direction === "input");
  const tOutPin = node.pins.find((p) => p.direction === "output");
  if (tInPin) {
    const key = pinKey(node.id, tInPin.id);
    const val = resolveInputInternal(adj, key, pinValues);
    pinValues.set(key, val);
    if (tOutPin) {
      pinValues.set(pinKey(node.id, tOutPin.id), val);
    }
  }
}
