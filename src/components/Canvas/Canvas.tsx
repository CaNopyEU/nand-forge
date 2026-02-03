import { useCallback } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Panel,
  ReactFlowProvider,
  useReactFlow,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useCircuitStore, type AppNode } from "../../store/circuit-store.ts";
import { InputNode } from "./InputNode.tsx";
import { OutputNode } from "./OutputNode.tsx";
import { ConstantNode } from "./ConstantNode.tsx";
import { ModuleNode } from "./ModuleNode.tsx";

// P1: nodeTypes defined outside component — stable reference
const nodeTypes: NodeTypes = {
  circuitInput: InputNode,
  circuitOutput: OutputNode,
  constant: ConstantNode,
  module: ModuleNode,
} as NodeTypes;

function CanvasInner() {
  const nodes = useCircuitStore((s) => s.nodes);
  const edges = useCircuitStore((s) => s.edges);
  const onNodesChange = useCircuitStore((s) => s.onNodesChange);
  const onEdgesChange = useCircuitStore((s) => s.onEdgesChange);
  const addNode = useCircuitStore((s) => s.addNode);

  const { screenToFlowPosition } = useReactFlow();

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

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
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
