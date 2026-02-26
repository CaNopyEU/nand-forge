import type { CircuitNode, BitWidth, Module } from "../engine/types.ts";
import type { AppNode } from "../store/circuit-store.ts";

// === Converter interface ===

export interface NodeConverter {
  toCircuitNode: (node: AppNode) => CircuitNode;
  fromCircuitNode: (node: CircuitNode, modules?: Module[]) => AppNode;
  extractInputValue?: (node: AppNode) => Record<string, number>;
  getPinBits: (node: AppNode, pinId?: string) => BitWidth;
}

// === Converter imports ===

import { circuitInputConverter, circuitOutputConverter, constantConverter, probeConverter, clockConverter, buttonConverter } from "./converters/simple-io.ts";
import { dipSwitchConverter, hexDisplayConverter, ledBarConverter } from "./converters/bus-io.ts";
import { tunnelConverter } from "./converters/tunnel.ts";
import { romConverter, ramConverter } from "./converters/memory.ts";
import { tristateConverter, pullConverter } from "./converters/tristate-pull.ts";
import { moduleConverter } from "./converters/module.ts";

// === Forward dispatch: AppNode type → converter ===

const appNodeConverters: Record<string, NodeConverter> = {
  circuitInput: circuitInputConverter,
  circuitOutput: circuitOutputConverter,
  constant: constantConverter,
  probe: probeConverter,
  clock: clockConverter,
  button: buttonConverter,
  dipSwitch: dipSwitchConverter,
  hexDisplay: hexDisplayConverter,
  ledBar: ledBarConverter,
  tunnel: tunnelConverter,
  rom: romConverter,
  ram: ramConverter,
  tristate: tristateConverter,
  pull: pullConverter,
  module: moduleConverter,
};

// === Reverse dispatch: engine node type+variant → converter ===

type ReverseKey = string;

function reverseKey(type: string, variant?: string): ReverseKey {
  return variant ? `${type}:${variant}` : type;
}

const engineNodeConverters: Record<ReverseKey, NodeConverter> = {
  "input": circuitInputConverter,
  "input:dip-switch": dipSwitchConverter,
  "output": circuitOutputConverter,
  "output:hex-display": hexDisplayConverter,
  "output:led-bar": ledBarConverter,
  "constant": constantConverter,
  "probe": probeConverter,
  "clock": clockConverter,
  "button": buttonConverter,
  "tunnel": tunnelConverter,
  "rom": romConverter,
  "ram": ramConverter,
  "tristate": tristateConverter,
  "pullup": pullConverter,
  "pulldown": pullConverter,
  "module": moduleConverter,
};

// === Public API ===

export function getAppNodeConverter(appNodeType: string): NodeConverter {
  const converter = appNodeConverters[appNodeType];
  if (!converter) throw new Error(`No converter for AppNode type: ${appNodeType}`);
  return converter;
}

export function getEngineNodeConverter(engineType: string, variant?: string): NodeConverter {
  const key = reverseKey(engineType, variant);
  return engineNodeConverters[key] ?? engineNodeConverters[engineType]!;
}

export function getPinBits(nodes: AppNode[], nodeId: string, pinId: string): BitWidth {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return 1;
  const converter = appNodeConverters[node.type];
  if (!converter) return 1;
  return converter.getPinBits(node, pinId);
}
