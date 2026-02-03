import { memo, useCallback, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useCircuitStore, type InputNodeType } from "../../store/circuit-store.ts";

function InputNodeComponent({ id, data }: NodeProps<InputNodeType>) {
  const toggleInputValue = useCircuitStore((s) => s.toggleInputValue);
  const updateNodeLabel = useCircuitStore((s) => s.updateNodeLabel);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);

  const handleToggle = useCallback(() => {
    toggleInputValue(id);
  }, [id, toggleInputValue]);

  const commitLabel = useCallback(() => {
    updateNodeLabel(id, draft);
    setEditing(false);
  }, [id, draft, updateNodeLabel]);

  return (
    <div className="flex items-center gap-1.5 rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5">
      <button
        className={`nodrag nopan flex h-5 w-5 items-center justify-center rounded-sm text-xs font-bold ${
          data.value
            ? "bg-emerald-500 text-white"
            : "bg-zinc-600 text-zinc-300"
        }`}
        onClick={handleToggle}
      >
        {data.value ? "1" : "0"}
      </button>

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

      <Handle type="source" position={Position.Right} id={data.pinId} />
    </div>
  );
}

export const InputNode = memo(InputNodeComponent);
