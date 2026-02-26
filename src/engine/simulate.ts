import type {
  Circuit,
  CircuitNode,
  Edge,
  Module,
  NodeId,
  PinId,
} from "./types.ts";
import { evaluateCircuitIterative } from "./simulate-iterative.ts";
import { hasCycle } from "./validate.ts";
import {
  Z_VALUE,
  WEAK_1,
  WEAK_0,
  CONFLICT,
} from "./constants.ts";

// Re-export constants for backward compatibility
export {
  Z_VALUE,
  WEAK_1,
  WEAK_0,
  CONFLICT,
  BUILTIN_NAND_MODULE_ID,
  BUILTIN_SPLITTER_MODULE_ID,
  BUILTIN_MERGER_MODULE_ID,
  BUILTIN_ROM_MODULE_ID,
  BUILTIN_RAM_MODULE_ID,
} from "./constants.ts";

// === Instance state (hierarchical — supports nested sub-modules) ===

export interface InstanceState {
  pinValues: Map<string, number>;
  children: Map<string, InstanceState>;
  /** Runtime RAM contents — only for RAM nodes */
  ramData?: number[];
  /** Last address written this tick — for viewer highlighting */
  lastWriteAddr?: number | null;
}

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

// === Constants (re-exported from ./constants.ts above) ===

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
export function resolveInputInternal(
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

// === Single-node evaluation (delegates to registry) ===

import { evaluateNodeDispatch } from "./node-registry.ts";
export { evaluateNodeDispatch as evaluateNode } from "./node-registry.ts";
// Local alias for use within this file
const evaluateNode = evaluateNodeDispatch;

// === Circuit evaluation (full — returns all pin values) ===

export function evaluateCircuitFull(
  circuit: Circuit,
  inputs: Record<PinId, number>,
  modules?: Module[],
  instanceStates?: Map<string, InstanceState>,
): Map<string, number> {
  const resolved = resolveTunnels(circuit);
  if (hasCycle(resolved)) {
    throw new Error("Circuit contains a cycle");
  }
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
