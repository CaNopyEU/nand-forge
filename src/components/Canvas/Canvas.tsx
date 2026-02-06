import { useCallback, useEffect, useState, type DragEvent, type MouseEvent as ReactMouseEvent } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Panel,
  ReactFlowProvider,
  useReactFlow,
  type NodeTypes,
  type EdgeTypes,
  type Edge as RFEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useCircuitStore, type AppNode } from "../../store/circuit-store.ts";
import { getModuleById, useModuleStore } from "../../store/module-store.ts";
import { BUILTIN_NAND_MODULE_ID } from "../../engine/simulate.ts";
import { getForbiddenModuleIds } from "../../engine/validate.ts";
import type { Pin } from "../../engine/types.ts";
import { useWiring } from "../../hooks/useWiring.ts";
import { useSimulation } from "../../hooks/useSimulation.ts";
import { InputNode } from "./InputNode.tsx";
import { OutputNode } from "./OutputNode.tsx";
import { ConstantNode } from "./ConstantNode.tsx";
import { ProbeNode } from "./ProbeNode.tsx";
import { ModuleNode } from "./ModuleNode.tsx";
import { ManhattanEdge } from "./ManhattanEdge.tsx";
import { EdgeColorPicker } from "./EdgeColorPicker.tsx";

// P1: nodeTypes & edgeTypes defined outside component — stable reference
const nodeTypes: NodeTypes = {
  circuitInput: InputNode,
  circuitOutput: OutputNode,
  constant: ConstantNode,
  probe: ProbeNode,
  module: ModuleNode,
} as NodeTypes;

const edgeTypes: EdgeTypes = {
  manhattan: ManhattanEdge,
} as EdgeTypes;

const defaultEdgeOptions = { type: "manhattan" as const };

type ContextMenuState = { nodeId: string; x: number; y: number } | null;

function CanvasInner() {
  const nodes = useCircuitStore((s) => s.nodes);
  const edges = useCircuitStore((s) => s.edges);
  const onNodesChange = useCircuitStore((s) => s.onNodesChange);
  const onEdgesChange = useCircuitStore((s) => s.onEdgesChange);
  const addNode = useCircuitStore((s) => s.addNode);
  const rotateNode = useCircuitStore((s) => s.rotateNode);
  const setEdgeColor = useCircuitStore((s) => s.setEdgeColor);
  const undo = useCircuitStore((s) => s.undo);
  const redo = useCircuitStore((s) => s.redo);
  const takeSnapshot = useCircuitStore((s) => s.takeSnapshot);

  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [edgeColorMenu, setEdgeColorMenu] = useState<{ edgeId: string; x: number; y: number } | null>(null);

  const { onConnect, isValidConnection } = useWiring();
  const { screenToFlowPosition } = useReactFlow();
  useSimulation();

  // Keyboard shortcut: R to rotate selected nodes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "r" && e.key !== "R") return;
      // Skip when user is typing in an input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const selected = useCircuitStore.getState().nodes.filter((n) => n.selected);
      if (selected.length === 0) return;

      for (const node of selected) {
        rotateNode(node.id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [rotateNode]);

  // Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z / Ctrl+Y (redo)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  // Snapshot before node drag for undo support
  const handleNodeDragStart = useCallback(() => {
    takeSnapshot();
  }, [takeSnapshot]);

  // Close context menu on Escape
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [contextMenu]);

  const handleAddNode = useCallback(
    (type: AppNode["type"]) => {
      const position = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      // Small random offset to avoid stacking
      position.x += (Math.random() - 0.5) * 100;
      position.y += (Math.random() - 0.5) * 100;
      addNode(type, position);
    },
    [screenToFlowPosition, addNode],
  );

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const moduleId = e.dataTransfer.getData("application/nandforge-module");
      if (!moduleId) return;

      // Prevent circular dependencies
      const activeModuleId = useCircuitStore.getState().activeModuleId;
      if (activeModuleId) {
        const forbidden = getForbiddenModuleIds(activeModuleId, useModuleStore.getState().modules);
        if (forbidden.has(moduleId)) return;
      }

      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });

      if (moduleId === BUILTIN_NAND_MODULE_ID) {
        addNode("module", position, BUILTIN_NAND_MODULE_ID);
        return;
      }

      // Look up custom module for pin data
      const mod = getModuleById(moduleId);
      if (!mod) return;

      const pins: Pin[] = [
        ...mod.inputs.map((p) => ({ ...p, direction: "input" as const })),
        ...mod.outputs.map((p) => ({ ...p, direction: "output" as const })),
      ];

      addNode("module", position, moduleId, { label: mod.name, pins });
    },
    [screenToFlowPosition, addNode],
  );

  const handleNodeContextMenu = useCallback(
    (e: ReactMouseEvent, node: AppNode) => {
      e.preventDefault();
      setContextMenu({ nodeId: node.id, x: e.clientX, y: e.clientY });
    },
    [],
  );

  const handleEdgeContextMenu = useCallback(
    (e: ReactMouseEvent, edge: RFEdge) => {
      e.preventDefault();
      setContextMenu(null);
      setEdgeColorMenu({ edgeId: edge.id, x: e.clientX, y: e.clientY });
    },
    [],
  );

  const handleEdgeColorSelect = useCallback(
    (color: string | undefined) => {
      if (edgeColorMenu) {
        setEdgeColor(edgeColorMenu.edgeId, color);
      }
      setEdgeColorMenu(null);
    },
    [edgeColorMenu, setEdgeColor],
  );

  const handlePaneClick = useCallback(() => {
    setContextMenu(null);
    setEdgeColorMenu(null);
  }, []);

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onNodeDragStart={handleNodeDragStart}
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeContextMenu={handleEdgeContextMenu}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        deleteKeyCode={["Backspace", "Delete"]}
        className="bg-zinc-900"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#3f3f46"
        />
        <Panel position="top-left">
          <div className="flex gap-1">
            <button
              className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-600"
              onClick={() => handleAddNode("circuitInput")}
            >
              + Input
            </button>
            <button
              className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-600"
              onClick={() => handleAddNode("circuitOutput")}
            >
              + Output
            </button>
            <button
              className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-600"
              onClick={() => handleAddNode("constant")}
            >
              + Constant
            </button>
            <button
              className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-600"
              onClick={() => handleAddNode("module")}
            >
              + NAND
            </button>
            <button
              className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-600"
              onClick={() => handleAddNode("probe")}
            >
              + Probe
            </button>
          </div>
        </Panel>
      </ReactFlow>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 rounded border border-zinc-600 bg-zinc-800 py-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="w-full px-4 py-1.5 text-left text-xs text-zinc-200 hover:bg-zinc-700"
            onClick={() => {
              rotateNode(contextMenu.nodeId);
              setContextMenu(null);
            }}
          >
            Rotate
          </button>
        </div>
      )}

      {/* Edge color picker */}
      {edgeColorMenu && (
        <EdgeColorPicker
          x={edgeColorMenu.x}
          y={edgeColorMenu.y}
          onSelect={handleEdgeColorSelect}
          onClose={() => setEdgeColorMenu(null)}
        />
      )}
    </>
  );
}

export default function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
