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
}

// === Constants ===

export const BUILTIN_NAND_MODULE_ID: ModuleId = "builtin:nand";
export const BUILTIN_SPLITTER_MODULE_ID: ModuleId = "builtin:splitter";
export const BUILTIN_MERGER_MODULE_ID: ModuleId = "builtin:merger";

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
  reverse: Map<string, { nodeId: NodeId; pinId: PinId }>;
  nodeIds: NodeId[];
}

export function buildAdjacencyList(circuit: Circuit): AdjacencyList {
  const forward = new Map<string, Array<{ nodeId: NodeId; pinId: PinId }>>();
  const reverse = new Map<string, { nodeId: NodeId; pinId: PinId }>();
  const nodeIds = circuit.nodes.map((n) => n.id);

  for (const edge of circuit.edges) {
    const srcKey = pinKey(edge.fromNodeId, edge.fromPinId);
    const dstKey = pinKey(edge.toNodeId, edge.toPinId);

    const targets = forward.get(srcKey);
    if (targets) {
      targets.push({ nodeId: edge.toNodeId, pinId: edge.toPinId });
    } else {
      forward.set(srcKey, [
        { nodeId: edge.toNodeId, pinId: edge.toPinId },
      ]);
    }

    reverse.set(dstKey, {
      nodeId: edge.fromNodeId,
      pinId: edge.fromPinId,
    });
  }

  return { forward, reverse, nodeIds };
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
        const upstream = adj.reverse.get(key);
        if (upstream) {
          pinValues.set(key, pinValues.get(pinKey(upstream.nodeId, upstream.pinId)) ?? 0);
        } else {
          pinValues.set(key, 0);
        }
        if (tOutPin) {
          pinValues.set(pinKey(node.id, tOutPin.id), pinValues.get(key) ?? 0);
        }
      }
      break;
    }

    case "output":
    case "probe": {
      for (const pin of node.pins) {
        if (pin.direction === "input") {
          const key = pinKey(node.id, pin.id);
          const upstream = adj.reverse.get(key);
          if (upstream) {
            pinValues.set(
              key,
              pinValues.get(pinKey(upstream.nodeId, upstream.pinId)) ??
                0,
            );
          } else {
            pinValues.set(key, 0);
          }
        }
      }
      break;
    }

    case "module": {
      if (node.moduleId === BUILTIN_SPLITTER_MODULE_ID) {
        // Splitter: one multi-bit input → N 1-bit outputs
        const inputPin = node.pins.find((p) => p.direction === "input")!;
        const inputKey = pinKey(node.id, inputPin.id);
        const upstream = adj.reverse.get(inputKey);
        const inputValue = upstream
          ? (pinValues.get(pinKey(upstream.nodeId, upstream.pinId)) ?? 0)
          : (pinValues.get(inputKey) ?? 0);
        pinValues.set(inputKey, inputValue);
        const outputPins = node.pins.filter((p) => p.direction === "output");
        for (let i = 0; i < outputPins.length; i++) {
          pinValues.set(pinKey(node.id, outputPins[i]!.id), (inputValue >> i) & 1);
        }
        break;
      }
      if (node.moduleId === BUILTIN_MERGER_MODULE_ID) {
        // Merger: N 1-bit inputs → one multi-bit output
        const inputPins = node.pins.filter((p) => p.direction === "input");
        let result = 0;
        for (let i = 0; i < inputPins.length; i++) {
          const key = pinKey(node.id, inputPins[i]!.id);
          const upstream = adj.reverse.get(key);
          const bit = upstream
            ? (pinValues.get(pinKey(upstream.nodeId, upstream.pinId)) ?? 0)
            : (pinValues.get(key) ?? 0);
          pinValues.set(key, bit);
          result |= ((bit & 1) << i);
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
          const key = pinKey(node.id, pin.id);
          const upstream = adj.reverse.get(key);
          if (upstream) {
            return (
              pinValues.get(
                pinKey(upstream.nodeId, upstream.pinId),
              ) ?? 0
            );
          }
          return 0;
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
            const upstream = adj.reverse.get(key);
            subInputs[defPin.id] = upstream
              ? (pinValues.get(
                  pinKey(upstream.nodeId, upstream.pinId),
                ) ?? 0)
              : 0;
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

  // Seed input/constant nodes
  for (const node of resolved.nodes) {
    if (node.type === "input" || node.type === "constant" || node.type === "clock" || node.type === "button") {
      for (const pin of node.pins) {
        if (pin.direction === "output") {
          pinValues.set(
            pinKey(node.id, pin.id),
            inputs[pin.id] ?? 0,
          );
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
