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

// === Node data types ===

export type InputNodeData = {
  label: string;
  pinId: string;
  value: boolean;
};

export type OutputNodeData = {
  label: string;
  pinId: string;
};

export type ConstantNodeData = {
  label: string;
  pinId: string;
  value: boolean;
};

export type ModuleNodeData = {
  label: string;
  moduleId: string;
  pins: Pin[];
};

// === App node types ===

export type InputNodeType = Node<InputNodeData, "circuitInput">;
export type OutputNodeType = Node<OutputNodeData, "circuitOutput">;
export type ConstantNodeType = Node<ConstantNodeData, "constant">;
export type ModuleNodeType = Node<ModuleNodeData, "module">;
export type AppNode =
  | InputNodeType
  | OutputNodeType
  | ConstantNodeType
  | ModuleNodeType;

// === Store ===

interface CircuitStore {
  nodes: AppNode[];
  edges: RFEdge[];
  activeModuleId: string | null;

  onNodesChange: (changes: NodeChange<AppNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<RFEdge>[]) => void;
  addNode: (
    type: "circuitInput" | "circuitOutput" | "constant" | "module",
    position: XYPosition,
    moduleId?: string,
  ) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: RFEdge) => void;
  removeEdge: (id: string) => void;
  toggleInputValue: (nodeId: string) => void;
  toggleConstantValue: (nodeId: string) => void;
  updateNodeLabel: (nodeId: string, label: string) => void;
}

export const useCircuitStore = create<CircuitStore>((set) => ({
  nodes: [],
  edges: [],
  activeModuleId: null,

  onNodesChange: (changes) =>
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
    })),

  onEdgesChange: (changes) =>
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    })),

  addNode: (type, position, moduleId) =>
    set((state) => {
      const id = generateId();

      let node: AppNode;
      switch (type) {
        case "circuitInput":
          node = {
            id,
            type: "circuitInput",
            position,
            data: { label: "Input", pinId: generateId(), value: false },
          };
          break;
        case "circuitOutput":
          node = {
            id,
            type: "circuitOutput",
            position,
            data: { label: "Output", pinId: generateId() },
          };
          break;
        case "constant":
          node = {
            id,
            type: "constant",
            position,
            data: { label: "0", pinId: generateId(), value: false },
          };
          break;
        case "module": {
          const mid = moduleId ?? BUILTIN_NAND_MODULE_ID;
          const isNand = mid === BUILTIN_NAND_MODULE_ID;
          const pins: Pin[] = isNand
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
          node = {
            id,
            type: "module",
            position,
            data: { label: isNand ? "NAND" : "Module", moduleId: mid, pins },
          };
          break;
        }
      }

      return { nodes: [...state.nodes, node] };
    }),

  removeNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
    })),

  addEdge: (edge) =>
    set((state) => ({ edges: [...state.edges, edge] })),

  removeEdge: (id) =>
    set((state) => ({ edges: state.edges.filter((e) => e.id !== id) })),

  toggleInputValue: (nodeId) =>
    set((state) => ({
      nodes: state.nodes.map((n) => {
        if (n.id !== nodeId || n.type !== "circuitInput") return n;
        return { ...n, data: { ...n.data, value: !n.data.value } };
      }),
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
    })),

  updateNodeLabel: (nodeId, label) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId
          ? ({ ...n, data: { ...n.data, label } } as AppNode)
          : n,
      ),
    })),
}));
