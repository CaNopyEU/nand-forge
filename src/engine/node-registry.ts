import type { CircuitNode, Module } from "./types.ts";
import type { AdjacencyList, InstanceState } from "./simulate.ts";
import { evaluateSeeded } from "./evaluators/seeded.ts";
import { evaluateOutput, evaluateTunnel } from "./evaluators/passthrough.ts";
import { evaluateRom, evaluateRam } from "./evaluators/memory.ts";
import { evaluateTristate } from "./evaluators/tristate.ts";
import { evaluateModule } from "./evaluators/module.ts";

type NodeEvaluator = (
  node: CircuitNode,
  adj: AdjacencyList,
  pinValues: Map<string, number>,
  modules?: Module[],
  instanceStates?: Map<string, InstanceState>,
) => void;

const evaluatorMap: Record<CircuitNode["type"], NodeEvaluator> = {
  input: evaluateSeeded,
  constant: evaluateSeeded,
  clock: evaluateSeeded,
  button: evaluateSeeded,
  pullup: evaluateSeeded,
  pulldown: evaluateSeeded,
  output: evaluateOutput,
  probe: evaluateOutput,
  tunnel: evaluateTunnel,
  rom: evaluateRom,
  ram: evaluateRam,
  tristate: evaluateTristate,
  module: evaluateModule,
};

/**
 * Dispatch to the correct per-type evaluator.
 */
export function evaluateNodeDispatch(
  node: CircuitNode,
  adj: AdjacencyList,
  pinValues: Map<string, number>,
  modules?: Module[],
  instanceStates?: Map<string, InstanceState>,
): void {
  const evaluator = evaluatorMap[node.type];
  evaluator(node, adj, pinValues, modules, instanceStates);
}
