import { memo, useCallback, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useCircuitStore, type OutputNodeType } from "../../store/circuit-store.ts";
import { useSimulationStore } from "../../store/simulation-store.ts";
import { pinKey } from "../../engine/simulate.ts";

function OutputNodeComponent({ id, data }: NodeProps<OutputNodeType>) {
  const updateNodeLabel = useCircuitStore((s) => s.updateNodeLabel);
  const signal = useSimulationStore(
    (s) => s.pinValues[pinKey(id, data.pinId)] ?? false,
  );

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);

  const commitLabel = useCallback(() => {
    updateNodeLabel(id, draft);
    setEditing(false);
  }, [id, draft, updateNodeLabel]);

  return (
    <div className="flex items-center gap-1.5 rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5">
      <Handle type="target" position={Position.Left} id={data.pinId} />

      {editing ? (
        <input
          className="nodrag nopan w-14 rounded bg-zinc-700 px-1 text-xs text-zinc-100 outline-none"
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
          className="cursor-text text-xs text-zinc-300"
          onDoubleClick={() => {
            setDraft(data.label);
            setEditing(true);
          }}
        >
          {data.label}
        </span>
      )}

      <div
        className={`h-3 w-3 rounded-full ${
          signal
            ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]"
            : "bg-zinc-600"
        }`}
      />
    </div>
  );
}

export const OutputNode = memo(OutputNodeComponent);
