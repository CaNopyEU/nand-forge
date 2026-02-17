import type {
  Circuit,
  CircuitNode,
  Edge,
  Module,
  ModuleId,
  NodeId,
  PinId,
} from "./types.ts";
import { evaluateCircuitIterative } from "./simulate-iterative.ts";

// === Instance state (hierarchical — supports nested sub-modules) ===

export interface InstanceState {
  pinValues: Map<string, number>;
  children: Map<string, InstanceState>;
  /** Runtime RAM contents — only for RAM nodes */
  ramData?: number[];
  /** Last address written this tick — for viewer highlighting */
  lastWriteAddr?: number | null;
}

// === Wire state sentinels ===

/** High-impedance output (tri-state buffer disabled). Not a driver. */
export const Z_VALUE = -1;
/** Weak pull-up driver — wins only when no strong driver is present. */
export const WEAK_1  = -2;
/** Weak pull-down driver — wins only when no strong driver is present. */
export const WEAK_0  = -3;
/** Bus conflict — multiple strong drivers disagreed. */
export const CONFLICT = -4;

// === Bus resolution ===

/**
 * Resolve multiple driver values on a shared bus.
 *
 * Rules:
 *  - Z_VALUE  (-1) does not drive; ignored.
 *  - Strong drivers (≥ 0) beat weak drivers.
 *  - If only one unique strong value → that value.
 *  - If multiple differing strong values → CONFLICT.
 *  - If only weak drivers (WEAK_1 / WEAK_0) → their concrete equivalent (1 / 0).
 *  - If only Z → Z_VALUE (floating).
 */
export function resolveBus(values: number[]): number {
  const active = values.filter((v) => v !== Z_VALUE);
  if (active.length === 0) return Z_VALUE;

  const strong = active.filter((v) => v >= 0);
  if (strong.length > 0) {
    const first = strong[0]!;
    for (const v of strong) {
      if (v !== first) return CONFLICT;
    }
    return first;
  }

  // Only weak drivers remain
  const weakConcrete = active.map((v) => (v === WEAK_1 ? 1 : 0));
  const first = weakConcrete[0]!;
  for (const v of weakConcrete) {
    if (v !== first) return CONFLICT;
  }
  return first;
}

// === Constants ===

export const BUILTIN_NAND_MODULE_ID: ModuleId = "builtin:nand";
export const BUILTIN_SPLITTER_MODULE_ID: ModuleId = "builtin:splitter";
export const BUILTIN_MERGER_MODULE_ID: ModuleId = "builtin:merger";
export const BUILTIN_ROM_MODULE_ID: ModuleId = "builtin:rom";
export const BUILTIN_RAM_MODULE_ID: ModuleId = "builtin:ram";

// === Helpers ===

export function pinKey(nodeId: NodeId, pinId: PinId): string {
  return `${nodeId}:${pinId}`;
}

// === NAND evaluation ===

export function evaluateNand(a: number, b: number): number {
  return (a & b) ? 0 : 1;
}

// === Tunnel resolution ===

/**
 * Resolve tunnels by creating virtual edges between same-named tunnel pairs.
 * TunnelIn nodes (variant="in") have a visible input pin and an internal output pin.
 * TunnelOut nodes (variant="out") have an internal input pin and a visible output pin.
 * For each name group, connect every tunnelIn's output pin → every tunnelOut's input pin.
 */
export function resolveTunnels(circuit: Circuit): Circuit {
  const tunnelNodes = circuit.nodes.filter((n) => n.type === "tunnel");
  if (tunnelNodes.length === 0) return circuit;

  // Group by pin name (tunnel label — both pins share the same name)
  const groups = new Map<string, { ins: CircuitNode[]; outs: CircuitNode[] }>();
  for (const node of tunnelNodes) {
    const name = node.pins[0]?.name ?? "";
    let group = groups.get(name);
    if (!group) {
      group = { ins: [], outs: [] };
      groups.set(name, group);
    }
    if (node.variant === "in") {
      group.ins.push(node);
    } else {
      group.outs.push(node);
    }
  }

  const virtualEdges: Edge[] = [];
  let edgeIdx = 0;
  for (const [, group] of groups) {
    for (const inNode of group.ins) {
      const outPin = inNode.pins.find((p) => p.direction === "output");
      if (!outPin) continue;
      for (const outNode of group.outs) {
        const inPin = outNode.pins.find((p) => p.direction === "input");
        if (!inPin) continue;
        virtualEdges.push({
          id: `__tunnel_${edgeIdx++}`,
          fromNodeId: inNode.id,
          fromPinId: outPin.id,
          toNodeId: outNode.id,
          toPinId: inPin.id,
        });
      }
    }
  }

  if (virtualEdges.length === 0) return circuit;

  return {
    ...circuit,
    edges: [...circuit.edges, ...virtualEdges],
  };
}

// === Adjacency list ===

export interface AdjacencyList {
  forward: Map<string, Array<{ nodeId: NodeId; pinId: PinId }>>;
  /** Array-based: supports multiple drivers per destination (shared bus). */
  reverse: Map<string, Array<{ nodeId: NodeId; pinId: PinId }>>;
  nodeIds: NodeId[];
}

export function buildAdjacencyList(circuit: Circuit): AdjacencyList {
  const forward = new Map<string, Array<{ nodeId: NodeId; pinId: PinId }>>();
  const reverse = new Map<string, Array<{ nodeId: NodeId; pinId: PinId }>>();
  const nodeIds = circuit.nodes.map((n) => n.id);

  for (const edge of circuit.edges) {
    const srcKey = pinKey(edge.fromNodeId, edge.fromPinId);
    const dstKey = pinKey(edge.toNodeId, edge.toPinId);

    const targets = forward.get(srcKey);
    if (targets) {
      targets.push({ nodeId: edge.toNodeId, pinId: edge.toPinId });
    } else {
      forward.set(srcKey, [{ nodeId: edge.toNodeId, pinId: edge.toPinId }]);
    }

    // Append to array — multiple drivers allowed (bus resolution)
    const existing = reverse.get(dstKey);
    if (existing) {
      existing.push({ nodeId: edge.fromNodeId, pinId: edge.fromPinId });
    } else {
      reverse.set(dstKey, [{ nodeId: edge.fromNodeId, pinId: edge.fromPinId }]);
    }
  }

  return { forward, reverse, nodeIds };
}

// === Input resolution with bus support ===

/**
 * Resolve all drivers for a given destination pin key.
 * Handles single-driver (fast path), multi-driver (bus resolution via resolveBus),
 * and no-driver (returns 0) cases.
 */
function resolveInputInternal(
  adj: AdjacencyList,
  key: string,
  pinValues: Map<string, number>,
): number {
  const drivers = adj.reverse.get(key);
  if (!drivers || drivers.length === 0) return 0;
  // Always go through resolveBus so WEAK_1/WEAK_0 sentinels are converted
  // to their concrete equivalents (1/0) even for a single driver.
  // Use ?? 0 (not Z_VALUE) so uncomputed pins in the iterative evaluator
  // default to 0 (backward-compatible); actual Z_VALUE (-1) entries in the
  // map are never undefined so they pass through correctly.
  const vals = drivers.map(
    (d) => pinValues.get(pinKey(d.nodeId, d.pinId)) ?? 0,
  );
  return resolveBus(vals);
}

// === Topological sort (Kahn's algorithm) ===

export function topologicalSort(circuit: Circuit): NodeId[] {
  // Build node-level in-degree from unique (fromNodeId → toNodeId) pairs
  const inDegree = new Map<NodeId, number>();
  const nodeAdj = new Map<NodeId, Set<NodeId>>();

  for (const node of circuit.nodes) {
    inDegree.set(node.id, 0);
    nodeAdj.set(node.id, new Set());
  }

  for (const edge of circuit.edges) {
    const targets = nodeAdj.get(edge.fromNodeId);
    if (targets && !targets.has(edge.toNodeId)) {
      targets.add(edge.toNodeId);
      inDegree.set(
        edge.toNodeId,
        (inDegree.get(edge.toNodeId) ?? 0) + 1,
      );
    }
  }

  // Sources: nodes with in-degree 0
  const queue: NodeId[] = [];
  for (const [nodeId, deg] of inDegree) {
    if (deg === 0) {
      queue.push(nodeId);
    }
  }

  const sorted: NodeId[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    const neighbors = nodeAdj.get(current);
    if (neighbors) {
      for (const neighbor of neighbors) {
        const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) {
          queue.push(neighbor);
        }
      }
    }
  }

  if (sorted.length !== circuit.nodes.length) {
    throw new Error("Circuit contains a cycle");
  }

  return sorted;
}

// === Single-node evaluation (shared by topological and iterative evaluators) ===

export function evaluateNode(
  node: CircuitNode,
  adj: AdjacencyList,
  pinValues: Map<string, number>,
  modules?: Module[],
  instanceStates?: Map<string, InstanceState>,
): void {
  switch (node.type) {
    case "input":
    case "constant":
    case "clock":
    case "button":
      // Already seeded — nothing to do
      break;

    case "tunnel": {
      // Pass-through: read upstream value for input pin, copy to output pin
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
      break;
    }

    case "output":
    case "probe": {
      for (const pin of node.pins) {
        if (pin.direction === "input") {
          const key = pinKey(node.id, pin.id);
          pinValues.set(key, resolveInputInternal(adj, key, pinValues));
        }
      }
      break;
    }

    case "rom": {
      const addrPin = node.pins.find((p) => p.direction === "input");
      const dataPin = node.pins.find((p) => p.direction === "output");
      if (!addrPin || !dataPin) break;
      const addrKey = pinKey(node.id, addrPin.id);
      const addr = resolveInputInternal(adj, addrKey, pinValues);
      pinValues.set(addrKey, addr);
      const addrMask = (1 << (addrPin.bits as number)) - 1;
      const safeAddr = addr >= 0 ? addr : 0;
      const data = (node.romData ?? [])[safeAddr & addrMask] ?? 0;
      pinValues.set(pinKey(node.id, dataPin.id), data);
      break;
    }

    case "ram": {
      const addrPin = node.pins.find((p) => p.name === "Addr");
      const dataInPin = node.pins.find((p) => p.name === "DIn");
      const wePin = node.pins.find((p) => p.name === "WE");
      const clkPin = node.pins.find((p) => p.name === "CLK");
      const dataOutPin = node.pins.find((p) => p.direction === "output");
      if (!addrPin || !dataInPin || !wePin || !clkPin || !dataOutPin) break;

      // Resolve all inputs from upstream (treat Z/CONFLICT as 0 for RAM logic)
      const resolveInput = (pin: { id: PinId }): number => {
        const key = pinKey(node.id, pin.id);
        const raw = resolveInputInternal(adj, key, pinValues);
        const val = raw >= 0 ? raw : 0;
        pinValues.set(key, val);
        return val;
      };

      const addr = resolveInput(addrPin);
      const dataIn = resolveInput(dataInPin);
      const writeEnable = resolveInput(wePin);
      const clkVal = resolveInput(clkPin);

      // Get previous state (prevClockVal + ramData from last tick)
      const prevState = instanceStates?.get(node.id);
      const prevClkVal = prevState?.pinValues.get(pinKey(node.id, clkPin.id)) ?? 0;
      const addrBits = addrPin.bits as number;
      const size = 1 << addrBits;
      const addrMask = size - 1;

      // Initialize ramData from initialData on first run, otherwise use prev state
      const ramData: number[] = prevState?.ramData
        ? [...prevState.ramData]
        : (node.initialData ? [...node.initialData] : new Array(size).fill(0));

      // Rising edge write
      const risingEdge = prevClkVal === 0 && clkVal === 1;
      let lastWriteAddr: number | null = prevState?.lastWriteAddr ?? null;
      if (risingEdge && writeEnable) {
        const wrAddr = addr & addrMask;
        ramData[wrAddr] = dataIn & 0xFF;
        lastWriteAddr = wrAddr;
      } else {
        lastWriteAddr = null;
      }

      // Combinational read
      const dataOut = ramData[addr & addrMask] ?? 0;
      pinValues.set(pinKey(node.id, dataOutPin.id), dataOut);

      // Persist state for next tick
      if (instanceStates) {
        const newPinValues = new Map<string, number>();
        newPinValues.set(pinKey(node.id, clkPin.id), clkVal);
        instanceStates.set(node.id, {
          pinValues: newPinValues,
          children: prevState?.children ?? new Map(),
          ramData,
          lastWriteAddr,
        });
      }
      break;
    }

    case "tristate": {
      // Tri-state buffer: when EN=1 pass data through; when EN=0 output Z (high-impedance)
      const dataPin   = node.pins.find((p) => p.name === "D");
      const enablePin = node.pins.find((p) => p.name === "EN");
      const outPin    = node.pins.find((p) => p.direction === "output");
      if (!dataPin || !enablePin || !outPin) break;
      const dataKey   = pinKey(node.id, dataPin.id);
      const enableKey = pinKey(node.id, enablePin.id);
      const dataVal   = resolveInputInternal(adj, dataKey, pinValues);
      const enableVal = resolveInputInternal(adj, enableKey, pinValues);
      pinValues.set(dataKey, dataVal);
      pinValues.set(enableKey, enableVal);
      pinValues.set(pinKey(node.id, outPin.id), enableVal > 0 ? dataVal : Z_VALUE);
      break;
    }

    case "pullup":
    case "pulldown":
      // Already seeded in evaluateCircuitFull / evaluateCircuitIterative
      break;

    case "module": {
      if (node.moduleId === BUILTIN_SPLITTER_MODULE_ID) {
        // Splitter: one multi-bit input → N 1-bit outputs
        const inputPin = node.pins.find((p) => p.direction === "input")!;
        const inputKey = pinKey(node.id, inputPin.id);
        const drivers = adj.reverse.get(inputKey);
        const inputValue = (drivers && drivers.length > 0)
          ? resolveInputInternal(adj, inputKey, pinValues)
          : (pinValues.get(inputKey) ?? 0); // iterative fallback
        pinValues.set(inputKey, inputValue);
        const safeInputValue = inputValue >= 0 ? inputValue : 0;
        const outputPins = node.pins.filter((p) => p.direction === "output");
        for (let i = 0; i < outputPins.length; i++) {
          pinValues.set(pinKey(node.id, outputPins[i]!.id), (safeInputValue >> i) & 1);
        }
        break;
      }
      if (node.moduleId === BUILTIN_MERGER_MODULE_ID) {
        // Merger: N 1-bit inputs → one multi-bit output
        const inputPins = node.pins.filter((p) => p.direction === "input");
        let result = 0;
        for (let i = 0; i < inputPins.length; i++) {
          const key = pinKey(node.id, inputPins[i]!.id);
          const drivers = adj.reverse.get(key);
          const bit = (drivers && drivers.length > 0)
            ? resolveInputInternal(adj, key, pinValues)
            : (pinValues.get(key) ?? 0); // iterative fallback
          pinValues.set(key, bit);
          const safeBit = bit >= 0 ? bit : 0;
          result |= ((safeBit & 1) << i);
        }
        const outputPin = node.pins.find((p) => p.direction === "output")!;
        pinValues.set(pinKey(node.id, outputPin.id), result);
        break;
      }
      if (node.moduleId === BUILTIN_NAND_MODULE_ID) {
        const inputPins = node.pins.filter(
          (p) => p.direction === "input",
        );
        const outputPins = node.pins.filter(
          (p) => p.direction === "output",
        );

        const resolveInput = (pin: { id: PinId }): number => {
          return resolveInputInternal(adj, pinKey(node.id, pin.id), pinValues);
        };

        const a = inputPins[0] ? resolveInput(inputPins[0]) : 0;
        const b = inputPins[1] ? resolveInput(inputPins[1]) : 0;
        const result = evaluateNand(a, b);

        for (const outPin of outputPins) {
          pinValues.set(pinKey(node.id, outPin.id), result);
        }
      } else if (node.moduleId && modules) {
        const mod = modules.find((m) => m.id === node.moduleId);
        if (mod) {
          const instanceInputPins = node.pins.filter(
            (p) => p.direction === "input",
          );
          const instanceOutputPins = node.pins.filter(
            (p) => p.direction === "output",
          );

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
      }
      break;
    }
  }
}

// === Circuit evaluation (full — returns all pin values) ===

export function evaluateCircuitFull(
  circuit: Circuit,
  inputs: Record<PinId, number>,
  modules?: Module[],
  instanceStates?: Map<string, InstanceState>,
): Map<string, number> {
  const resolved = resolveTunnels(circuit);
  const adj = buildAdjacencyList(resolved);
  const order = topologicalSort(resolved);
  const pinValues = new Map<string, number>();

  // Index nodes by id for fast lookup
  const nodeMap = new Map<NodeId, CircuitNode>();
  for (const node of resolved.nodes) {
    nodeMap.set(node.id, node);
  }

  // Seed source nodes (inputs, constants, clocks, buttons, pull-ups/downs)
  for (const node of resolved.nodes) {
    if (
      node.type === "input" ||
      node.type === "constant" ||
      node.type === "clock" ||
      node.type === "button" ||
      node.type === "pullup" ||
      node.type === "pulldown"
    ) {
      for (const pin of node.pins) {
        if (pin.direction === "output") {
          if (node.type === "pullup") {
            pinValues.set(pinKey(node.id, pin.id), WEAK_1);
          } else if (node.type === "pulldown") {
            pinValues.set(pinKey(node.id, pin.id), WEAK_0);
          } else {
            pinValues.set(pinKey(node.id, pin.id), inputs[pin.id] ?? 0);
          }
        }
      }
    }
  }

  // Process nodes in topological order
  for (const nodeId of order) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;
    evaluateNode(node, adj, pinValues, modules, instanceStates);
  }

  return pinValues;
}

// === Circuit evaluation with state (for sub-module evaluation) ===

export function evaluateCircuitWithState(
  circuit: Circuit,
  inputs: Record<PinId, number>,
  modules?: Module[],
  prevPinValues?: Map<string, number>,
  instanceStates?: Map<string, InstanceState>,
): { outputs: Record<PinId, number>; pinValues: Map<string, number> } {
  let pinValues: Map<string, number>;
  try {
    pinValues = evaluateCircuitFull(circuit, inputs, modules, instanceStates);
  } catch {
    const iterResult = evaluateCircuitIterative(
      circuit,
      inputs,
      modules,
      prevPinValues ?? new Map(),
      instanceStates,
    );
    pinValues = iterResult.pinValues;
  }

  const outputs: Record<PinId, number> = {};
  for (const node of circuit.nodes) {
    if (node.type === "output") {
      for (const pin of node.pins) {
        if (pin.direction === "input") {
          outputs[pin.id] = pinValues.get(pinKey(node.id, pin.id)) ?? 0;
        }
      }
    }
  }

  return { outputs, pinValues };
}

// === Circuit evaluation (outputs only — preserves original API) ===
// Falls back to iterative evaluation for cyclic sub-circuits.

export function evaluateCircuit(
  circuit: Circuit,
  inputs: Record<PinId, number>,
  modules?: Module[],
): Record<PinId, number> {
  let pinValues: Map<string, number>;
  try {
    pinValues = evaluateCircuitFull(circuit, inputs, modules);
  } catch {
    // Cyclic sub-circuit — fall back to iterative evaluator
    const iterResult = evaluateCircuitIterative(circuit, inputs, modules, new Map());
    pinValues = iterResult.pinValues;
  }

  const result: Record<PinId, number> = {};
  for (const node of circuit.nodes) {
    if (node.type === "output") {
      for (const pin of node.pins) {
        if (pin.direction === "input") {
          result[pin.id] = pinValues.get(pinKey(node.id, pin.id)) ?? 0;
        }
      }
    }
  }

  return result;
}
