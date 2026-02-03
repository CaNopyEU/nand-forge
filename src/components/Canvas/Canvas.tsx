import { useCallback, type DragEvent } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Panel,
  ReactFlowProvider,
  useReactFlow,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useCircuitStore, type AppNode } from "../../store/circuit-store.ts";
import { getModuleById } from "../../store/module-store.ts";
import { BUILTIN_NAND_MODULE_ID } from "../../engine/simulate.ts";
import type { Pin } from "../../engine/types.ts";
import { useWiring } from "../../hooks/useWiring.ts";
import { useSimulation } from "../../hooks/useSimulation.ts";
import { InputNode } from "./InputNode.tsx";
import { OutputNode } from "./OutputNode.tsx";
import { ConstantNode } from "./ConstantNode.tsx";
import { ProbeNode } from "./ProbeNode.tsx";
import { ModuleNode } from "./ModuleNode.tsx";
import { ManhattanEdge } from "./ManhattanEdge.tsx";

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

function CanvasInner() {
  const nodes = useCircuitStore((s) => s.nodes);
  const edges = useCircuitStore((s) => s.edges);
  const onNodesChange = useCircuitStore((s) => s.onNodesChange);
  const onEdgesChange = useCircuitStore((s) => s.onEdgesChange);
  const addNode = useCircuitStore((s) => s.addNode);

  const { onConnect, isValidConnection } = useWiring();
  const { screenToFlowPosition } = useReactFlow();
  useSimulation();

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

      // Prevent inserting a module into itself
      const activeModuleId = useCircuitStore.getState().activeModuleId;
      if (moduleId === activeModuleId) return;

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

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      isValidConnection={isValidConnection}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
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
  );
}

export default function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
