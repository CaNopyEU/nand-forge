import { memo, useCallback, useState } from "react";
import { Handle, type NodeProps } from "@xyflow/react";
import { useCircuitStore, type TunnelNodeType } from "../../store/circuit-store.ts";
import { getInputPosition, getOutputPosition } from "../../utils/layout.ts";
import { useSimulationStore } from "../../store/simulation-store.ts";
import { pinKey } from "../../engine/simulate.ts";

function TunnelNodeComponent({ id, data, selected }: NodeProps<TunnelNodeType>) {
  const updateNodeLabel = useCircuitStore((s) => s.updateNodeLabel);
  const isIn = data.direction === "in";

  const signal = useSimulationStore(
    (s) => s.pinValues[pinKey(id, data.pinId)] ?? 0,
  );

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);

  const commitLabel = useCallback(() => {
    updateNodeLabel(id, draft);
    setEditing(false);
  }, [id, draft, updateNodeLabel]);

  return (
    <div
      className={`flex items-center gap-1 rounded border bg-zinc-800 px-2 py-1 ${selected ? "border-blue-500" : "border-violet-600"}`}
    >
      {isIn ? (
        <Handle type="target" position={getInputPosition(data.rotation ?? 0)} id={data.pinId} />
      ) : (
        <Handle type="source" position={getOutputPosition(data.rotation ?? 0)} id={data.pinId} />
      )}

      <span className="text-[10px] text-violet-400">
        {isIn ? "\u2192" : "\u2190"}
      </span>

      {editing ? (
        <input
          className="nodrag nopan w-12 rounded bg-zinc-700 px-1 text-xs text-zinc-100 outline-none"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitLabel();
          }}
          autoFocus
        />
      ) : (
        <span
          className="cursor-text text-xs text-violet-300 font-medium"
          onDoubleClick={() => {
            setDraft(data.label);
            setEditing(true);
          }}
        >
          {data.label}
        </span>
      )}

      <span
        className={`ml-0.5 rounded px-1 text-[9px] font-mono ${
          signal ? "bg-violet-800 text-violet-200" : "bg-zinc-700 text-zinc-500"
        }`}
      >
        {signal}
      </span>
    </div>
  );
}

export const TunnelNode = memo(TunnelNodeComponent);
