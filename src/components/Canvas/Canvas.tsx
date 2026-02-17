import { useCallback, useEffect, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent } from "react";
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
import { BUILTIN_NAND_MODULE_ID, BUILTIN_SPLITTER_MODULE_ID, BUILTIN_MERGER_MODULE_ID } from "../../engine/simulate.ts";
import { getForbiddenModuleIds } from "../../engine/validate.ts";
import type { Pin } from "../../engine/types.ts";
import { useWiring } from "../../hooks/useWiring.ts";
import { useSimulation } from "../../hooks/useSimulation.ts";
import { InputNode } from "./InputNode.tsx";
import { OutputNode } from "./OutputNode.tsx";
import { ConstantNode } from "./ConstantNode.tsx";
import { ProbeNode } from "./ProbeNode.tsx";
import { ModuleNode } from "./ModuleNode.tsx";
import { ClockNode } from "./ClockNode.tsx";
import { ButtonNode } from "./ButtonNode.tsx";
import { DipSwitchNode } from "./DipSwitchNode.tsx";
import { HexDisplayNode } from "./HexDisplayNode.tsx";
import { LedBarNode } from "./LedBarNode.tsx";
import { TunnelNode } from "./TunnelNode.tsx";
import { ManhattanEdge } from "./ManhattanEdge.tsx";
import { EdgeColorPicker } from "./EdgeColorPicker.tsx";
import { ModulePropertiesDialog } from "../Library/ModulePropertiesDialog.tsx";
import { useClockTick } from "../../hooks/useClockTick.ts";

// P1: nodeTypes & edgeTypes defined outside component — stable reference
const nodeTypes: NodeTypes = {
  circuitInput: InputNode,
  circuitOutput: OutputNode,
  constant: ConstantNode,
  probe: ProbeNode,
  clock: ClockNode,
  button: ButtonNode,
  dipSwitch: DipSwitchNode,
  hexDisplay: HexDisplayNode,
  ledBar: LedBarNode,
  tunnel: TunnelNode,
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
  const stampModuleId = useCircuitStore((s) => s.stampModuleId);
  const setStampModuleId = useCircuitStore((s) => s.setStampModuleId);
  const readOnly = useCircuitStore((s) => s.readOnly);
  const drillDown = useCircuitStore((s) => s.drillDown);
  const navigateToLevel = useCircuitStore((s) => s.navigateToLevel);

  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [edgeColorMenu, setEdgeColorMenu] = useState<{ edgeId: string; x: number; y: number } | null>(null);
  const [propertiesModuleId, setPropertiesModuleId] = useState<string | null>(null);

  const drilldownStack = useCircuitStore((s) => s.drilldownStack);

  const { onConnect, isValidConnection } = useWiring();
  const { screenToFlowPosition, fitView } = useReactFlow();
  useSimulation();
  useClockTick();

  // Fit view when drill-down level changes (entering or navigating)
  const drilldownDepth = drilldownStack.length;
  const activeModuleId = useCircuitStore((s) => s.activeModuleId);
  useEffect(() => {
    // Small delay so ReactFlow can lay out the new nodes first
    const timer = setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 50);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drilldownDepth, activeModuleId, fitView]);

  // Read-only guards for node/edge changes
  const guardedOnNodesChange = useCallback(
    (changes: import("@xyflow/react").NodeChange<AppNode>[]) => {
      if (readOnly) {
        const allowed = changes.filter((c) => c.type === "select" || c.type === "dimensions");
        if (allowed.length > 0) onNodesChange(allowed);
        return;
      }
      onNodesChange(changes);
    },
    [readOnly, onNodesChange],
  );

  const guardedOnEdgesChange = useCallback(
    (changes: import("@xyflow/react").EdgeChange<RFEdge>[]) => {
      if (readOnly) {
        const allowed = changes.filter((c) => c.type === "select");
        if (allowed.length > 0) onEdgesChange(allowed);
        return;
      }
      onEdgesChange(changes);
    },
    [readOnly, onEdgesChange],
  );

  // Double-click to drill down into module instances
  // Native onDoubleClick doesn't fire reliably in read-only mode (node re-render
  // on selection breaks browser double-click detection), so we detect it manually.
  const lastClickRef = useRef<{ nodeId: string; time: number }>({ nodeId: "", time: 0 });

  const handleNodeClick = useCallback(
    (_event: ReactMouseEvent, node: AppNode) => {
      if (node.type !== "module") return;
      const now = Date.now();
      if (lastClickRef.current.nodeId === node.id && now - lastClickRef.current.time < 400) {
        lastClickRef.current = { nodeId: "", time: 0 };
        drillDown(node.id);
        return;
      }
      lastClickRef.current = { nodeId: node.id, time: now };
    },
    [drillDown],
  );

  const handleNodeDoubleClick = useCallback(
    (_event: ReactMouseEvent, node: AppNode) => {
      if (node.type !== "module") return;
      drillDown(node.id);
    },
    [drillDown],
  );

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

  // Escape: navigate up in drill-down, clear stamp mode, close context menu
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const state = useCircuitStore.getState();
      if (state.drilldownStack.length > 0) {
        navigateToLevel(state.drilldownStack.length - 1 || 0);
        return;
      }
      if (state.stampModuleId) {
        setStampModuleId(null);
        return;
      }
      if (contextMenu) setContextMenu(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [contextMenu, setStampModuleId, navigateToLevel]);

  const getCenter = useCallback(() => {
    const position = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    position.x += (Math.random() - 0.5) * 100;
    position.y += (Math.random() - 0.5) * 100;
    return position;
  }, [screenToFlowPosition]);

  const handleAddNode = useCallback(
    (type: AppNode["type"]) => {
      addNode(type, getCenter());
    },
    [getCenter, addNode],
  );

  const handleAddBusInput = useCallback(() => {
    addNode("circuitInput", getCenter(), undefined, undefined, 8);
  }, [getCenter, addNode]);

  const handleAddBusOutput = useCallback(() => {
    addNode("circuitOutput", getCenter(), undefined, undefined, 8);
  }, [getCenter, addNode]);

  const handleAddSplitter = useCallback(() => {
    const pins: Pin[] = [
      { id: "x", name: "In", direction: "input", bits: 8 },
      ...Array.from({ length: 8 }, (_, i) => ({
        id: "x", name: String(i), direction: "output" as const, bits: 1 as const,
      })),
    ];
    addNode("module", getCenter(), BUILTIN_SPLITTER_MODULE_ID, { label: "Split 8", pins });
  }, [getCenter, addNode]);

  const handleAddDipSwitch = useCallback(() => {
    addNode("dipSwitch", getCenter());
  }, [getCenter, addNode]);

  const handleAddHexDisplay = useCallback(() => {
    addNode("hexDisplay", getCenter());
  }, [getCenter, addNode]);

  const handleAddLedBar = useCallback(() => {
    addNode("ledBar", getCenter());
  }, [getCenter, addNode]);

  const handleAddTunnelIn = useCallback(() => {
    addNode("tunnel", getCenter(), undefined, { label: "in", pins: [] });
  }, [getCenter, addNode]);

  const handleAddTunnelOut = useCallback(() => {
    addNode("tunnel", getCenter(), undefined, { label: "out", pins: [] });
  }, [getCenter, addNode]);

  const handleAddMerger = useCallback(() => {
    const pins: Pin[] = [
      ...Array.from({ length: 8 }, (_, i) => ({
        id: "x", name: String(i), direction: "input" as const, bits: 1 as const,
      })),
      { id: "x", name: "Out", direction: "output", bits: 8 },
    ];
    addNode("module", getCenter(), BUILTIN_MERGER_MODULE_ID, { label: "Merge 8", pins });
  }, [getCenter, addNode]);

  // Place a module node at a given flow position (shared by drag-drop and stamp mode)
  const placeModule = useCallback(
    (moduleId: string, position: { x: number; y: number }) => {
      // Prevent circular dependencies
      const activeModuleId = useCircuitStore.getState().activeModuleId;
      if (activeModuleId) {
        const forbidden = getForbiddenModuleIds(activeModuleId, useModuleStore.getState().modules);
        if (forbidden.has(moduleId)) return;
      }

      if (moduleId === BUILTIN_NAND_MODULE_ID) {
        addNode("module", position, BUILTIN_NAND_MODULE_ID);
        return;
      }

      const mod = getModuleById(moduleId);
      if (!mod) return;

      const pins: Pin[] = [
        ...mod.inputs.map((p) => ({ ...p, direction: "input" as const })),
        ...mod.outputs.map((p) => ({ ...p, direction: "output" as const })),
      ];

      addNode("module", position, moduleId, { label: mod.name, pins });
    },
    [addNode],
  );

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      if (readOnly) return;
      const moduleId = e.dataTransfer.getData("application/nandforge-module");
      if (!moduleId) return;
      placeModule(moduleId, screenToFlowPosition({ x: e.clientX, y: e.clientY }));
    },
    [screenToFlowPosition, placeModule, readOnly],
  );

  const handleNodeContextMenu = useCallback(
    (e: ReactMouseEvent, node: AppNode) => {
      e.preventDefault();
      if (readOnly) return;
      setContextMenu({ nodeId: node.id, x: e.clientX, y: e.clientY });
    },
    [readOnly],
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

  const handlePaneClick = useCallback(
    (e: ReactMouseEvent) => {
      setContextMenu(null);
      setEdgeColorMenu(null);

      if (readOnly) return;

      const stamp = useCircuitStore.getState().stampModuleId;
      if (stamp) {
        const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        placeModule(stamp, position);
      }
    },
    [screenToFlowPosition, placeModule, readOnly],
  );

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={guardedOnNodesChange}
        onEdgesChange={guardedOnEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
        isValidConnection={readOnly ? undefined : isValidConnection}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onNodeDragStart={readOnly ? undefined : handleNodeDragStart}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeContextMenu={readOnly ? undefined : handleEdgeContextMenu}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
        className={`bg-zinc-900 ${stampModuleId ? "!cursor-crosshair" : ""}`}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#3f3f46"
        />
        {nodes.length === 0 && !stampModuleId && (
          <Panel position="top-center">
            <p className="mt-32 text-sm text-zinc-600 select-none">
              Drag components from the library to start building
            </p>
          </Panel>
        )}
        {readOnly && (
          <Panel position="top-left">
            <span className="rounded bg-zinc-700/80 px-2 py-1 text-xs text-zinc-400">
              Read-only view
            </span>
          </Panel>
        )}
        {!readOnly && (
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
              <button
                className="rounded bg-zinc-700 px-2 py-1 text-xs text-cyan-300 hover:bg-zinc-600"
                onClick={() => handleAddNode("clock")}
              >
                + Clock
              </button>
              <button
                className="rounded bg-zinc-700 px-2 py-1 text-xs text-rose-300 hover:bg-zinc-600"
                onClick={() => handleAddNode("button")}
              >
                + Button
              </button>
              <span className="mx-1 text-zinc-600">|</span>
              <button
                className="rounded bg-zinc-700 px-2 py-1 text-xs text-amber-300 hover:bg-zinc-600"
                onClick={handleAddBusInput}
              >
                + Bus In
              </button>
              <button
                className="rounded bg-zinc-700 px-2 py-1 text-xs text-amber-300 hover:bg-zinc-600"
                onClick={handleAddBusOutput}
              >
                + Bus Out
              </button>
              <button
                className="rounded bg-zinc-700 px-2 py-1 text-xs text-amber-300 hover:bg-zinc-600"
                onClick={handleAddSplitter}
              >
                + Splitter
              </button>
              <button
                className="rounded bg-zinc-700 px-2 py-1 text-xs text-amber-300 hover:bg-zinc-600"
                onClick={handleAddMerger}
              >
                + Merger
              </button>
              <button
                className="rounded bg-zinc-700 px-2 py-1 text-xs text-amber-300 hover:bg-zinc-600"
                onClick={handleAddDipSwitch}
              >
                + DIP
              </button>
              <button
                className="rounded bg-zinc-700 px-2 py-1 text-xs text-amber-300 hover:bg-zinc-600"
                onClick={handleAddHexDisplay}
              >
                + Hex
              </button>
              <button
                className="rounded bg-zinc-700 px-2 py-1 text-xs text-amber-300 hover:bg-zinc-600"
                onClick={handleAddLedBar}
              >
                + LEDs
              </button>
              <span className="mx-1 text-zinc-600">|</span>
              <button
                className="rounded bg-zinc-700 px-2 py-1 text-xs text-violet-300 hover:bg-zinc-600"
                onClick={handleAddTunnelIn}
              >
                + Tun In
              </button>
              <button
                className="rounded bg-zinc-700 px-2 py-1 text-xs text-violet-300 hover:bg-zinc-600"
                onClick={handleAddTunnelOut}
              >
                + Tun Out
              </button>
            </div>
          </Panel>
        )}
      </ReactFlow>

      {/* Context menu */}
      {contextMenu && (() => {
        const ctxNode = nodes.find((n) => n.id === contextMenu.nodeId);
        const isModuleNode = ctxNode?.type === "module";
        const ctxModuleId = isModuleNode ? (ctxNode.data as { moduleId: string }).moduleId : null;
        const isBuiltinModule = ctxModuleId === BUILTIN_NAND_MODULE_ID
          || ctxModuleId === BUILTIN_SPLITTER_MODULE_ID
          || ctxModuleId === BUILTIN_MERGER_MODULE_ID;
        const showProperties = isModuleNode && !isBuiltinModule;
        return (
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
            {showProperties && ctxModuleId && (
              <button
                className="w-full px-4 py-1.5 text-left text-xs text-zinc-200 hover:bg-zinc-700"
                onClick={() => {
                  setPropertiesModuleId(ctxModuleId);
                  setContextMenu(null);
                }}
              >
                Properties
              </button>
            )}
          </div>
        );
      })()}

      {/* Edge color picker */}
      {edgeColorMenu && (
        <EdgeColorPicker
          x={edgeColorMenu.x}
          y={edgeColorMenu.y}
          onSelect={handleEdgeColorSelect}
          onClose={() => setEdgeColorMenu(null)}
        />
      )}

      {/* Module properties dialog */}
      <ModulePropertiesDialog
        open={propertiesModuleId !== null}
        module={propertiesModuleId ? (getModuleById(propertiesModuleId) ?? null) : null}
        onClose={() => setPropertiesModuleId(null)}
      />
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
