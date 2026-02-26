import { create } from "zustand";
import {
  applyNodeChanges,
  applyEdgeChanges,
  type NodeChange,
} from "@xyflow/react";
import { BUILTIN_NAND_MODULE_ID, BUILTIN_SPLITTER_MODULE_ID, BUILTIN_MERGER_MODULE_ID } from "../engine/simulate.ts";
import { getModuleById, useModuleStore } from "./module-store.ts";
import { circuitNodesToAppNodes, circuitEdgesToRFEdges } from "../utils/circuit-converters.ts";
import { type Rotation, nextRotation } from "../utils/layout.ts";
import type { AppNode, CircuitStore, DrilldownFrame } from "./circuit-store-types.ts";
import { pushSnapshot } from "./circuit-store-helpers.ts";
import { createNode } from "./circuit-store-node-factory.ts";

// Re-export for backward compatibility
export type * from "./circuit-store-types.ts";
export { extractInterface } from "./circuit-store-helpers.ts";

export const useCircuitStore = create<CircuitStore>((set, get) => ({
  nodes: [],
  edges: [],
  activeModuleId: null,
  simulationVersion: 0,
  isDirty: false,
  past: [],
  future: [],
  stampModuleId: null,
  drilldownStack: [],
  drilldownRoot: null,
  readOnly: false,

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

      // Snapshot before removal + clean up edges connected to removed nodes
      return {
        ...pushSnapshot(state),
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
      const newEdges = applyEdgeChanges(changes, state.edges);
      if (!hasRemoval) {
        return { edges: newEdges };
      }
      return {
        ...pushSnapshot(state),
        edges: newEdges,
        simulationVersion: state.simulationVersion + 1,
        isDirty: true,
      };
    }),

  addNode: (type, position, moduleId, moduleData, bits, variant) =>
    set((state) => ({
      ...pushSnapshot(state),
      nodes: [...state.nodes, createNode(type, position, moduleId, moduleData, bits, variant)],
      simulationVersion: state.simulationVersion + 1,
      isDirty: true,
    })),

  removeNode: (id) =>
    set((state) => ({
      ...pushSnapshot(state),
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      simulationVersion: state.simulationVersion + 1,
      isDirty: true,
    })),
  addEdge: (edge) =>
    set((state) => ({
      ...pushSnapshot(state),
      edges: [...state.edges, edge],
      simulationVersion: state.simulationVersion + 1,
      isDirty: true,
    })),
  removeEdge: (id) =>
    set((state) => ({
      ...pushSnapshot(state),
      edges: state.edges.filter((e) => e.id !== id),
      simulationVersion: state.simulationVersion + 1,
      isDirty: true,
    })),

  toggleInputValue: (nodeId) =>
    set((state) => ({
      ...pushSnapshot(state),
      nodes: state.nodes.map((n) => {
        if (n.id !== nodeId || n.type !== "circuitInput") return n;
        return { ...n, data: { ...n.data, value: n.data.value ? 0 : 1 } };
      }),
      simulationVersion: state.simulationVersion + 1,
      isDirty: true,
    })),
  setInputValue: (nodeId, value) =>
    set((state) => ({
      ...pushSnapshot(state),
      nodes: state.nodes.map((n) => {
        if (n.id !== nodeId || n.type !== "circuitInput") return n;
        const nodeBits = n.data.bits ?? 1;
        const max = (1 << nodeBits) - 1;
        return { ...n, data: { ...n.data, value: Math.min(Math.max(0, value), max) } };
      }),
      simulationVersion: state.simulationVersion + 1,
      isDirty: true,
    })),
  toggleConstantValue: (nodeId) =>
    set((state) => ({
      ...pushSnapshot(state),
      nodes: state.nodes.map((n) => {
        if (n.id !== nodeId || n.type !== "constant") return n;
        return {
          ...n,
          data: {
            ...n.data,
            value: n.data.value ? 0 : 1,
            label: n.data.value === 0 ? "1" : "0",
          },
        };
      }),
      simulationVersion: state.simulationVersion + 1,
      isDirty: true,
    })),

  rotateNode: (nodeId) =>
    set((state) => ({
      ...pushSnapshot(state),
      nodes: state.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        const cur = (n.data as { rotation?: Rotation }).rotation ?? 0;
        return { ...n, data: { ...n.data, rotation: nextRotation(cur) } } as AppNode;
      }),
      isDirty: true,
    })),
  updateNodeLabel: (nodeId, label) =>
    set((state) => ({
      ...pushSnapshot(state),
      nodes: state.nodes.map((n) =>
        n.id === nodeId
          ? ({ ...n, data: { ...n.data, label } } as AppNode)
          : n,
      ),
      isDirty: true,
    })),
  setEdgeColor: (edgeId, color) =>
    set((state) => ({
      ...pushSnapshot(state),
      edges: state.edges.map((e) =>
        e.id === edgeId
          ? { ...e, data: { ...e.data, color } }
          : e,
      ),
      isDirty: true,
    })),

  tickClocks: () =>
    set((state) => {
      if (state.drilldownRoot) {
        // In drill-down: tick clocks in the root context
        return {
          drilldownRoot: {
            ...state.drilldownRoot,
            nodes: state.drilldownRoot.nodes.map((n) => {
              if (n.type !== "clock") return n;
              return { ...n, data: { ...n.data, value: n.data.value ? 0 : 1 } };
            }),
          },
          simulationVersion: state.simulationVersion + 1,
        };
      }
      return {
        nodes: state.nodes.map((n) => {
          if (n.type !== "clock") return n;
          return { ...n, data: { ...n.data, value: n.data.value ? 0 : 1 } };
        }),
        simulationVersion: state.simulationVersion + 1,
      };
    }),

  setButtonPressed: (nodeId, pressed) =>
    set((state) => ({
      nodes: state.nodes.map((n) => {
        if (n.id !== nodeId || n.type !== "button") return n;
        return { ...n, data: { ...n.data, pressed } };
      }),
      simulationVersion: state.simulationVersion + 1,
    })),
  setDipSwitchValue: (nodeId, value) =>
    set((state) => ({
      ...pushSnapshot(state),
      nodes: state.nodes.map((n) => {
        if (n.id !== nodeId || n.type !== "dipSwitch") return n;
        const max = (1 << (n.data.bits ?? 8)) - 1;
        return { ...n, data: { ...n.data, value: Math.min(Math.max(0, value), max) } };
      }),
      simulationVersion: state.simulationVersion + 1,
      isDirty: true,
    })),
  setRomData: (nodeId, romData) =>
    set((state) => ({
      ...pushSnapshot(state),
      nodes: state.nodes.map((n) => {
        if (n.id !== nodeId || n.type !== "rom") return n;
        return { ...n, data: { ...n.data, romData } };
      }),
      simulationVersion: state.simulationVersion + 1,
      isDirty: true,
    })),
  setRamInitialData: (nodeId, initialData) =>
    set((state) => ({
      ...pushSnapshot(state),
      nodes: state.nodes.map((n) => {
        if (n.id !== nodeId || n.type !== "ram") return n;
        return { ...n, data: { ...n.data, initialData } };
      }),
      simulationVersion: state.simulationVersion + 1,
      isDirty: true,
    })),

  clearCanvas: () =>
    set((state) => ({
      nodes: [],
      edges: [],
      past: [],
      future: [],
      simulationVersion: state.simulationVersion + 1,
      isDirty: false,
    })),
  setActiveModuleId: (moduleId) =>
    set({ activeModuleId: moduleId }),
  loadCircuit: (nodes, edges) =>
    set((state) => ({
      nodes,
      edges,
      past: [],
      future: [],
      simulationVersion: state.simulationVersion + 1,
      isDirty: false,
    })),
  markClean: () =>
    set({ isDirty: false }),

  undo: () => {
    const state = get();
    if (state.past.length === 0) return;
    const previous = state.past[state.past.length - 1]!;
    set({
      past: state.past.slice(0, -1),
      future: [{ nodes: state.nodes, edges: state.edges }, ...state.future],
      nodes: previous.nodes,
      edges: previous.edges,
      simulationVersion: state.simulationVersion + 1,
      isDirty: true,
    });
  },
  redo: () => {
    const state = get();
    if (state.future.length === 0) return;
    const next = state.future[0]!;
    set({
      past: [...state.past, { nodes: state.nodes, edges: state.edges }],
      future: state.future.slice(1),
      nodes: next.nodes,
      edges: next.edges,
      simulationVersion: state.simulationVersion + 1,
      isDirty: true,
    });
  },

  takeSnapshot: () =>
    set((state) => pushSnapshot(state)),
  setStampModuleId: (moduleId) =>
    set({ stampModuleId: moduleId }),

  drillDown: (instanceNodeId) => {
    const state = get();
    const node = state.nodes.find((n) => n.id === instanceNodeId);
    if (!node || node.type !== "module") return;

    const moduleId = node.data.moduleId;
    if (
      moduleId === BUILTIN_NAND_MODULE_ID ||
      moduleId === BUILTIN_SPLITTER_MODULE_ID ||
      moduleId === BUILTIN_MERGER_MODULE_ID
    ) return;

    const mod = getModuleById(moduleId);
    if (!mod) return;
    const drilldownRoot = state.drilldownRoot ?? {
      moduleId: state.activeModuleId,
      nodes: state.nodes,
      edges: state.edges,
      isDirty: state.isDirty,
    };

    const frame: DrilldownFrame = {
      moduleId,
      instanceNodeId,
      label: mod.name,
    };

    const modules = useModuleStore.getState().modules;
    const appNodes = circuitNodesToAppNodes(mod.circuit.nodes, modules);
    const rfEdges = circuitEdgesToRFEdges(mod.circuit.edges);

    set({
      drilldownRoot,
      drilldownStack: [...state.drilldownStack, frame],
      nodes: appNodes,
      edges: rfEdges,
      readOnly: true,
      stampModuleId: null,
      past: [],
      future: [],
      simulationVersion: state.simulationVersion + 1,
    });
  },

  navigateToLevel: (level) => {
    const state = get();
    if (!state.drilldownRoot) return;

    if (level === 0) {
      set({
        nodes: state.drilldownRoot.nodes,
        edges: state.drilldownRoot.edges,
        activeModuleId: state.drilldownRoot.moduleId,
        isDirty: state.drilldownRoot.isDirty,
        drilldownStack: [],
        drilldownRoot: null,
        readOnly: false,
        past: [],
        future: [],
        simulationVersion: state.simulationVersion + 1,
      });
      return;
    }
    const targetFrame = state.drilldownStack[level - 1];
    if (!targetFrame) return;

    const mod = getModuleById(targetFrame.moduleId);
    if (!mod) return;

    const modules = useModuleStore.getState().modules;
    const appNodes = circuitNodesToAppNodes(mod.circuit.nodes, modules);
    const rfEdges = circuitEdgesToRFEdges(mod.circuit.edges);

    set({
      drilldownStack: state.drilldownStack.slice(0, level),
      nodes: appNodes,
      edges: rfEdges,
      past: [],
      future: [],
      simulationVersion: state.simulationVersion + 1,
    });
  },

  enterEditMode: () => {
    const state = get();
    if (state.drilldownStack.length === 0) return;

    const currentFrame = state.drilldownStack[state.drilldownStack.length - 1]!;

    set({
      activeModuleId: currentFrame.moduleId,
      drilldownStack: [],
      drilldownRoot: null,
      readOnly: false,
      isDirty: false,
      past: [],
      future: [],
    });
  },
}));
