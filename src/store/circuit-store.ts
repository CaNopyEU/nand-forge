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

export type ProbeNodeData = {
  pinId: string;
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
export type ProbeNodeType = Node<ProbeNodeData, "probe">;
export type ModuleNodeType = Node<ModuleNodeData, "module">;
export type AppNode =
  | InputNodeType
  | OutputNodeType
  | ConstantNodeType
  | ProbeNodeType
  | ModuleNodeType;

// === Helpers ===

export function extractInterface(nodes: AppNode[]): { inputs: Pin[]; outputs: Pin[] } {
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

  return { inputs, outputs };
}

// === Store ===

interface CircuitStore {
  nodes: AppNode[];
  edges: RFEdge[];
  activeModuleId: string | null;
  simulationVersion: number;

  onNodesChange: (changes: NodeChange<AppNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<RFEdge>[]) => void;
  addNode: (
    type: AppNode["type"],
    position: XYPosition,
    moduleId?: string,
  ) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: RFEdge) => void;
  removeEdge: (id: string) => void;
  toggleInputValue: (nodeId: string) => void;
  toggleConstantValue: (nodeId: string) => void;
  updateNodeLabel: (nodeId: string, label: string) => void;
  clearCanvas: () => void;
  setActiveModuleId: (moduleId: string | null) => void;
  loadCircuit: (nodes: AppNode[], edges: RFEdge[]) => void;
}

export const useCircuitStore = create<CircuitStore>((set) => ({
  nodes: [],
  edges: [],
  activeModuleId: null,
  simulationVersion: 0,

  onNodesChange: (changes) =>
    set((state) => {
      const removedIds = new Set(
        changes
          .filter((c): c is NodeChange<AppNode> & { type: "remove" } => c.type === "remove")
          .map((c) => c.id),
      );
      const newNodes = applyNodeChanges(changes, state.nodes);

      if (removedIds.size === 0) {
        return { nodes: newNodes };
      }

      // Clean up edges connected to removed nodes + bump simulation version
      return {
        nodes: newNodes,
        edges: state.edges.filter(
          (e) => !removedIds.has(e.source) && !removedIds.has(e.target),
        ),
        simulationVersion: state.simulationVersion + 1,
      };
    }),

  onEdgesChange: (changes) =>
    set((state) => {
      const hasRemoval = changes.some((c) => c.type === "remove");
      return {
        edges: applyEdgeChanges(changes, state.edges),
        ...(hasRemoval
          ? { simulationVersion: state.simulationVersion + 1 }
          : {}),
      };
    }),

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
        case "probe":
          node = {
            id,
            type: "probe",
            position,
            data: { pinId: generateId() },
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

      return {
        nodes: [...state.nodes, node],
        simulationVersion: state.simulationVersion + 1,
      };
    }),

  removeNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      simulationVersion: state.simulationVersion + 1,
    })),

  addEdge: (edge) =>
    set((state) => ({
      edges: [...state.edges, edge],
      simulationVersion: state.simulationVersion + 1,
    })),

  removeEdge: (id) =>
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== id),
      simulationVersion: state.simulationVersion + 1,
    })),

  toggleInputValue: (nodeId) =>
    set((state) => ({
      nodes: state.nodes.map((n) => {
        if (n.id !== nodeId || n.type !== "circuitInput") return n;
        return { ...n, data: { ...n.data, value: !n.data.value } };
      }),
      simulationVersion: state.simulationVersion + 1,
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
    })),

  updateNodeLabel: (nodeId, label) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId
          ? ({ ...n, data: { ...n.data, label } } as AppNode)
          : n,
      ),
    })),

  clearCanvas: () =>
    set((state) => ({
      nodes: [],
      edges: [],
      simulationVersion: state.simulationVersion + 1,
    })),

  setActiveModuleId: (moduleId) =>
    set({ activeModuleId: moduleId }),

  loadCircuit: (nodes, edges) =>
    set((state) => ({
      nodes,
      edges,
      simulationVersion: state.simulationVersion + 1,
    })),
}));
