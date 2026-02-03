import type {
  Circuit,
  CircuitNode,
  Module,
  ModuleId,
  NodeId,
  PinId,
} from "./types.ts";

// === Constants ===

export const BUILTIN_NAND_MODULE_ID: ModuleId = "builtin:nand";

// === Helpers ===

export function pinKey(nodeId: NodeId, pinId: PinId): string {
  return `${nodeId}:${pinId}`;
}

// === NAND evaluation ===

export function evaluateNand(a: boolean, b: boolean): boolean {
  return !(a && b);
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

// === Circuit evaluation (full — returns all pin values) ===

export function evaluateCircuitFull(
  circuit: Circuit,
  inputs: Record<PinId, boolean>,
  modules?: Module[],
): Map<string, boolean> {
  const adj = buildAdjacencyList(circuit);
  const order = topologicalSort(circuit);
  const pinValues = new Map<string, boolean>();

  // Index nodes by id for fast lookup
  const nodeMap = new Map<NodeId, CircuitNode>();
  for (const node of circuit.nodes) {
    nodeMap.set(node.id, node);
  }

  // Seed input/constant nodes
  for (const node of circuit.nodes) {
    if (node.type === "input" || node.type === "constant") {
      for (const pin of node.pins) {
        if (pin.direction === "output") {
          pinValues.set(
            pinKey(node.id, pin.id),
            inputs[pin.id] ?? false,
          );
        }
      }
    }
  }

  // Process nodes in topological order
  for (const nodeId of order) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    switch (node.type) {
      case "input":
      case "constant":
        // Already seeded
        break;

      case "output":
      case "probe": {
        // Read value from upstream pin via reverse map
        for (const pin of node.pins) {
          if (pin.direction === "input") {
            const key = pinKey(node.id, pin.id);
            const upstream = adj.reverse.get(key);
            if (upstream) {
              pinValues.set(
                key,
                pinValues.get(pinKey(upstream.nodeId, upstream.pinId)) ??
                  false,
              );
            } else {
              pinValues.set(key, false);
            }
          }
        }
        break;
      }

      case "module": {
        if (node.moduleId === BUILTIN_NAND_MODULE_ID) {
          // Resolve input pins
          const inputPins = node.pins.filter(
            (p) => p.direction === "input",
          );
          const outputPins = node.pins.filter(
            (p) => p.direction === "output",
          );

          const resolveInput = (pin: { id: PinId }): boolean => {
            const key = pinKey(node.id, pin.id);
            const upstream = adj.reverse.get(key);
            if (upstream) {
              return (
                pinValues.get(
                  pinKey(upstream.nodeId, upstream.pinId),
                ) ?? false
              );
            }
            return false;
          };

          const a = inputPins[0] ? resolveInput(inputPins[0]) : false;
          const b = inputPins[1] ? resolveInput(inputPins[1]) : false;
          const result = evaluateNand(a, b);

          for (const outPin of outputPins) {
            pinValues.set(pinKey(node.id, outPin.id), result);
          }
        } else if (node.moduleId && modules) {
          // Custom module: lookup and evaluate
          const mod = modules.find((m) => m.id === node.moduleId);
          if (mod) {
            // Build sub-circuit inputs from this node's input pins
            const subInputs: Record<PinId, boolean> = {};
            for (const pin of node.pins) {
              if (pin.direction === "input") {
                const key = pinKey(node.id, pin.id);
                const upstream = adj.reverse.get(key);
                if (upstream) {
                  subInputs[pin.id] =
                    pinValues.get(
                      pinKey(upstream.nodeId, upstream.pinId),
                    ) ?? false;
                } else {
                  subInputs[pin.id] = false;
                }
              }
            }

            if (mod.truthTable) {
              // Use truth table for lookup
              const inputKey = mod.truthTable.inputNames
                .map((name) => (subInputs[name] ? "1" : "0"))
                .join("");
              const outputStr = mod.truthTable.rows[inputKey] ?? "";
              const outputPins = node.pins.filter(
                (p) => p.direction === "output",
              );
              for (let i = 0; i < outputPins.length; i++) {
                const outPin = outputPins[i];
                if (outPin) {
                  pinValues.set(
                    pinKey(node.id, outPin.id),
                    outputStr[i] === "1",
                  );
                }
              }
            } else {
              // Recursive evaluation
              const subOutputs = evaluateCircuit(
                mod.circuit,
                subInputs,
                modules,
              );
              const outputPins = node.pins.filter(
                (p) => p.direction === "output",
              );
              for (const outPin of outputPins) {
                pinValues.set(
                  pinKey(node.id, outPin.id),
                  subOutputs[outPin.id] ?? false,
                );
              }
            }
          }
        }
        break;
      }
    }
  }

  return pinValues;
}

// === Circuit evaluation (outputs only — preserves original API) ===

export function evaluateCircuit(
  circuit: Circuit,
  inputs: Record<PinId, boolean>,
  modules?: Module[],
): Record<PinId, boolean> {
  const pinValues = evaluateCircuitFull(circuit, inputs, modules);

  const result: Record<PinId, boolean> = {};
  for (const node of circuit.nodes) {
    if (node.type === "output") {
      for (const pin of node.pins) {
        if (pin.direction === "input") {
          result[pin.id] = pinValues.get(pinKey(node.id, pin.id)) ?? false;
        }
      }
    }
  }

  return result;
}
