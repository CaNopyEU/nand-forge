import type { CircuitNode, Module } from "../types.ts";
import type { AdjacencyList, InstanceState } from "../simulate.ts";
import { pinKey, resolveInputInternal } from "../simulate.ts";
import { Z_VALUE } from "../constants.ts";

/**
 * Tri-state buffer: when EN=1 pass data through; when EN=0 output Z.
 */
export function evaluateTristate(
  node: CircuitNode,
  adj: AdjacencyList,
  pinValues: Map<string, number>,
  _modules?: Module[],
  _instanceStates?: Map<string, InstanceState>,
): void {
  const dataPin = node.pins.find((p) => p.name === "D");
  const enablePin = node.pins.find((p) => p.name === "EN");
  const outPin = node.pins.find((p) => p.direction === "output");
  if (!dataPin || !enablePin || !outPin) return;
  const dataKey = pinKey(node.id, dataPin.id);
  const enableKey = pinKey(node.id, enablePin.id);
  const dataVal = resolveInputInternal(adj, dataKey, pinValues);
  const enableVal = resolveInputInternal(adj, enableKey, pinValues);
  pinValues.set(dataKey, dataVal);
  pinValues.set(enableKey, enableVal);
  pinValues.set(pinKey(node.id, outPin.id), enableVal > 0 ? dataVal : Z_VALUE);
}
