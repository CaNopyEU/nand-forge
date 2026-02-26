import type { CircuitNode, Module, PinId } from "../types.ts";
import type { AdjacencyList, InstanceState } from "../simulate.ts";
import { pinKey, resolveInputInternal, evaluateNand, evaluateCircuitWithState } from "../simulate.ts";
import {
  BUILTIN_NAND_MODULE_ID,
  BUILTIN_SPLITTER_MODULE_ID,
  BUILTIN_MERGER_MODULE_ID,
} from "../constants.ts";

/**
 * Module evaluator: handles NAND, splitter, merger, and custom modules.
 */
export function evaluateModule(
  node: CircuitNode,
  adj: AdjacencyList,
  pinValues: Map<string, number>,
  modules?: Module[],
  instanceStates?: Map<string, InstanceState>,
): void {
  if (node.moduleId === BUILTIN_SPLITTER_MODULE_ID) {
    evaluateSplitter(node, adj, pinValues);
    return;
  }
  if (node.moduleId === BUILTIN_MERGER_MODULE_ID) {
    evaluateMerger(node, adj, pinValues);
    return;
  }
  if (node.moduleId === BUILTIN_NAND_MODULE_ID) {
    evaluateNandModule(node, adj, pinValues);
    return;
  }
  if (node.moduleId && modules) {
    evaluateCustomModule(node, adj, pinValues, modules, instanceStates);
  }
}

function evaluateSplitter(
  node: CircuitNode,
  adj: AdjacencyList,
  pinValues: Map<string, number>,
): void {
  const inputPin = node.pins.find((p) => p.direction === "input")!;
  const inputKey = pinKey(node.id, inputPin.id);
  const drivers = adj.reverse.get(inputKey);
  const inputValue = (drivers && drivers.length > 0)
    ? resolveInputInternal(adj, inputKey, pinValues)
    : (pinValues.get(inputKey) ?? 0);
  pinValues.set(inputKey, inputValue);
  const safeInputValue = inputValue >= 0 ? inputValue : 0;
  const outputPins = node.pins.filter((p) => p.direction === "output");
  for (let i = 0; i < outputPins.length; i++) {
    pinValues.set(pinKey(node.id, outputPins[i]!.id), (safeInputValue >> i) & 1);
  }
}

function evaluateMerger(
  node: CircuitNode,
  adj: AdjacencyList,
  pinValues: Map<string, number>,
): void {
  const inputPins = node.pins.filter((p) => p.direction === "input");
  let result = 0;
  for (let i = 0; i < inputPins.length; i++) {
    const key = pinKey(node.id, inputPins[i]!.id);
    const drivers = adj.reverse.get(key);
    const bit = (drivers && drivers.length > 0)
      ? resolveInputInternal(adj, key, pinValues)
      : (pinValues.get(key) ?? 0);
    pinValues.set(key, bit);
    const safeBit = bit >= 0 ? bit : 0;
    result |= ((safeBit & 1) << i);
  }
  const outputPin = node.pins.find((p) => p.direction === "output")!;
  pinValues.set(pinKey(node.id, outputPin.id), result);
}

function evaluateNandModule(
  node: CircuitNode,
  adj: AdjacencyList,
  pinValues: Map<string, number>,
): void {
  const inputPins = node.pins.filter((p) => p.direction === "input");
  const outputPins = node.pins.filter((p) => p.direction === "output");
  const resolveInput = (pin: { id: PinId }): number =>
    resolveInputInternal(adj, pinKey(node.id, pin.id), pinValues);
  const a = inputPins[0] ? resolveInput(inputPins[0]) : 0;
  const b = inputPins[1] ? resolveInput(inputPins[1]) : 0;
  const result = evaluateNand(a, b);
  for (const outPin of outputPins) {
    pinValues.set(pinKey(node.id, outPin.id), result);
  }
}

function evaluateCustomModule(
  node: CircuitNode,
  adj: AdjacencyList,
  pinValues: Map<string, number>,
  modules: Module[],
  instanceStates?: Map<string, InstanceState>,
): void {
  const mod = modules.find((m) => m.id === node.moduleId);
  if (!mod) return;

  const instanceInputPins = node.pins.filter((p) => p.direction === "input");
  const instanceOutputPins = node.pins.filter((p) => p.direction === "output");

  const subInputs: Record<PinId, number> = {};
  for (let i = 0; i < instanceInputPins.length; i++) {
    const instancePin = instanceInputPins[i];
    const defPin = mod.inputs[i];
    if (!instancePin || !defPin) continue;
    const key = pinKey(node.id, instancePin.id);
    subInputs[defPin.id] = resolveInputInternal(adj, key, pinValues);
  }

  const prevState = instanceStates?.get(node.id);
  const prevSubPinValues = prevState?.pinValues ?? new Map<string, number>();
  const childInstanceStates = prevState?.children ?? new Map<string, InstanceState>();
  const subResult = evaluateCircuitWithState(
    mod.circuit,
    subInputs,
    modules,
    prevSubPinValues,
    childInstanceStates,
  );
  if (instanceStates) {
    instanceStates.set(node.id, {
      pinValues: subResult.pinValues,
      children: childInstanceStates,
    });
  }
  const subOutputs = subResult.outputs;
  for (let i = 0; i < instanceOutputPins.length; i++) {
    const instancePin = instanceOutputPins[i];
    const defPin = mod.outputs[i];
    if (instancePin && defPin) {
      pinValues.set(
        pinKey(node.id, instancePin.id),
        subOutputs[defPin.id] ?? 0,
      );
    }
  }
}
