import { create } from "zustand";
import {
  applyNodeChanges,
  applyEdgeChanges,
  type Edge as RFEdge,
  type Node,
  type NodeChange,
  type EdgeChange,
  type XYPosition,
} from "@xyflow/react";
import type { Pin } from "../engine/types.ts";
import { generateId } from "../utils/id.ts";
import { BUILTIN_NAND_MODULE_ID } from "../engine/simulate.ts";
import { type Rotation, nextRotation } from "../utils/layout.ts";

// === Node data types ===

export type InputNodeData = {
  label: string;
  pinId: string;
  value: boolean;
  rotation: Rotation;
};

export type OutputNodeData = {
  label: string;
  pinId: string;
  rotation: Rotation;
};

export type ConstantNodeData = {
  label: string;
  pinId: string;
  value: boolean;
  rotation: Rotation;
};

export type ProbeNodeData = {
  pinId: string;
  rotation: Rotation;
};

export type ModuleNodeData = {
  label: string;
  moduleId: string;
  pins: Pin[];
  rotation: Rotation;
};

// === App node types ===

export type InputNodeType = Node<InputNodeData, "circuitInput">;
export type OutputNodeType = Node<OutputNodeData, "circuitOutput">;
export type ConstantNodeType = Node<ConstantNodeData, "constant">;
export type ProbeNodeType = Node<ProbeNodeData, "probe">;
export type ModuleNodeType = Node<ModuleNodeData, "module">;
export type AppNode =
  | InputNodeType
  | OutputNodeType
  | ConstantNodeType
  | ProbeNodeType
  | ModuleNodeType;

// === Helpers ===

export function extractInterface(
  nodes: AppNode[],
  existingOrder?: { inputIds: string[]; outputIds: string[] },
): { inputs: Pin[]; outputs: Pin[] } {
  const inputs: Pin[] = [];
  const outputs: Pin[] = [];

  for (const node of nodes) {
    if (node.type === "circuitInput") {
      inputs.push({
        id: node.data.pinId,
        name: node.data.label,
        direction: "input",
        bits: 1,
      });
    } else if (node.type === "circuitOutput") {
      outputs.push({
        id: node.data.pinId,
        name: node.data.label,
        direction: "output",
        bits: 1,
      });
    }
  }

  if (existingOrder) {
    const sortByOrder = (pins: Pin[], order: string[]): Pin[] => {
      const indexMap = new Map(order.map((id, i) => [id, i]));
      const ordered: Pin[] = [];
      const remaining: Pin[] = [];
      for (const pin of pins) {
        const idx = indexMap.get(pin.id);
        if (idx !== undefined) {
          ordered[idx] = pin;
        } else {
          remaining.push(pin);
        }
      }
      return [...ordered.filter(Boolean), ...remaining];
    };
    return {
      inputs: sortByOrder(inputs, existingOrder.inputIds),
      outputs: sortByOrder(outputs, existingOrder.outputIds),
    };
  }

  return { inputs, outputs };
}

// === Store ===

interface CircuitStore {
  nodes: AppNode[];
  edges: RFEdge[];
  activeModuleId: string | null;
  simulationVersion: number;
  isDirty: boolean;

  onNodesChange: (changes: NodeChange<AppNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<RFEdge>[]) => void;
  addNode: (
    type: AppNode["type"],
    position: XYPosition,
    moduleId?: string,
    moduleData?: { label: string; pins: Pin[] },
  ) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: RFEdge) => void;
  removeEdge: (id: string) => void;
  toggleInputValue: (nodeId: string) => void;
  toggleConstantValue: (nodeId: string) => void;
  rotateNode: (nodeId: string) => void;
  updateNodeLabel: (nodeId: string, label: string) => void;
  setEdgeColor: (edgeId: string, color: string | undefined) => void;
  clearCanvas: () => void;
  setActiveModuleId: (moduleId: string | null) => void;
  loadCircuit: (nodes: AppNode[], edges: RFEdge[]) => void;
  markClean: () => void;
}

export const useCircuitStore = create<CircuitStore>((set) => ({
  nodes: [],
  edges: [],
  activeModuleId: null,
  simulationVersion: 0,
  isDirty: false,

  onNodesChange: (changes) =>
    set((state) => {
      const removedIds = new Set(
        changes
          .filter((c): c is NodeChange<AppNode> & { type: "remove" } => c.type === "remove")
          .map((c) => c.id),
      );
      const newNodes = applyNodeChanges(changes, state.nodes);
      const hasContentChange = changes.some(
        (c) => c.type !== "select" && c.type !== "dimensions",
      );

      if (removedIds.size === 0) {
        return {
          nodes: newNodes,
          ...(hasContentChange ? { isDirty: true } : {}),
        };
      }

      // Clean up edges connected to removed nodes + bump simulation version
      return {
        nodes: newNodes,
        edges: state.edges.filter(
          (e) => !removedIds.has(e.source) && !removedIds.has(e.target),
        ),
        simulationVersion: state.simulationVersion + 1,
        isDirty: true,
      };
    }),

  onEdgesChange: (changes) =>
    set((state) => {
      const hasRemoval = changes.some((c) => c.type === "remove");
      return {
        edges: applyEdgeChanges(changes, state.edges),
        ...(hasRemoval
          ? { simulationVersion: state.simulationVersion + 1, isDirty: true }
          : {}),
      };
    }),

  addNode: (type, position, moduleId, moduleData) =>
    set((state) => {
      const id = generateId();

      let node: AppNode;
      switch (type) {
        case "circuitInput":
          node = {
            id,
            type: "circuitInput",
            position,
            data: { label: "Input", pinId: generateId(), value: false, rotation: 0 },
          };
          break;
        case "circuitOutput":
          node = {
            id,
            type: "circuitOutput",
            position,
            data: { label: "Output", pinId: generateId(), rotation: 0 },
          };
          break;
        case "constant":
          node = {
            id,
            type: "constant",
            position,
            data: { label: "0", pinId: generateId(), value: false, rotation: 0 },
          };
          break;
        case "probe":
          node = {
            id,
            type: "probe",
            position,
            data: { pinId: generateId(), rotation: 0 },
          };
          break;
        case "module": {
          const mid = moduleId ?? BUILTIN_NAND_MODULE_ID;
          const isNand = mid === BUILTIN_NAND_MODULE_ID;
          // Use provided moduleData or fall back to NAND defaults
          const pins: Pin[] = moduleData
            ? moduleData.pins.map((p) => ({ ...p, id: generateId() }))
            : isNand
              ? [
                  { id: generateId(), name: "A", direction: "input", bits: 1 },
                  { id: generateId(), name: "B", direction: "input", bits: 1 },
                  {
                    id: generateId(),
                    name: "Out",
                    direction: "output",
                    bits: 1,
                  },
                ]
              : [];
          const label = moduleData ? moduleData.label : isNand ? "NAND" : "Module";
          node = {
            id,
            type: "module",
            position,
            data: { label, moduleId: mid, pins, rotation: 0 },
          };
          break;
        }
      }

      return {
        nodes: [...state.nodes, node],
        simulationVersion: state.simulationVersion + 1,
        isDirty: true,
      };
    }),

  removeNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      simulationVersion: state.simulationVersion + 1,
      isDirty: true,
    })),

  addEdge: (edge) =>
    set((state) => ({
      edges: [...state.edges, edge],
      simulationVersion: state.simulationVersion + 1,
      isDirty: true,
    })),

  removeEdge: (id) =>
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== id),
      simulationVersion: state.simulationVersion + 1,
      isDirty: true,
    })),

  toggleInputValue: (nodeId) =>
    set((state) => ({
      nodes: state.nodes.map((n) => {
        if (n.id !== nodeId || n.type !== "circuitInput") return n;
        return { ...n, data: { ...n.data, value: !n.data.value } };
      }),
      simulationVersion: state.simulationVersion + 1,
      isDirty: true,
    })),

  toggleConstantValue: (nodeId) =>
    set((state) => ({
      nodes: state.nodes.map((n) => {
        if (n.id !== nodeId || n.type !== "constant") return n;
        return {
          ...n,
          data: {
            ...n.data,
            value: !n.data.value,
            label: n.data.value ? "0" : "1",
          },
        };
      }),
      simulationVersion: state.simulationVersion + 1,
      isDirty: true,
    })),

  rotateNode: (nodeId) =>
    set((state) => ({
      nodes: state.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        const cur = (n.data as { rotation?: Rotation }).rotation ?? 0;
        return { ...n, data: { ...n.data, rotation: nextRotation(cur) } } as AppNode;
      }),
      isDirty: true,
    })),

  updateNodeLabel: (nodeId, label) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId
          ? ({ ...n, data: { ...n.data, label } } as AppNode)
          : n,
      ),
      isDirty: true,
    })),

  setEdgeColor: (edgeId, color) =>
    set((state) => ({
      edges: state.edges.map((e) =>
        e.id === edgeId
          ? { ...e, data: { ...e.data, color } }
          : e,
      ),
      isDirty: true,
    })),

  clearCanvas: () =>
    set((state) => ({
      nodes: [],
      edges: [],
      simulationVersion: state.simulationVersion + 1,
      isDirty: false,
    })),

  setActiveModuleId: (moduleId) =>
    set({ activeModuleId: moduleId }),

  loadCircuit: (nodes, edges) =>
    set((state) => ({
      nodes,
      edges,
      simulationVersion: state.simulationVersion + 1,
      isDirty: false,
    })),

  markClean: () =>
    set({ isDirty: false }),
}));
