import { memo, useCallback, useState } from "react";
import { Handle, type NodeProps } from "@xyflow/react";
import { useCircuitStore, type ButtonNodeType } from "../../store/circuit-store.ts";
import { getOutputPosition } from "../../utils/layout.ts";

function ButtonNodeComponent({ id, data, selected }: NodeProps<ButtonNodeType>) {
  const setButtonPressed = useCircuitStore((s) => s.setButtonPressed);
  const updateNodeLabel = useCircuitStore((s) => s.updateNodeLabel);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);

  const handlePress = useCallback(() => {
    setButtonPressed(id, true);
  }, [id, setButtonPressed]);

  const handleRelease = useCallback(() => {
    setButtonPressed(id, false);
  }, [id, setButtonPressed]);

  const commitLabel = useCallback(() => {
    updateNodeLabel(id, draft);
    setEditing(false);
  }, [id, draft, updateNodeLabel]);

  return (
    <div
      className={`flex items-center gap-1.5 rounded border bg-zinc-800 px-2 py-1.5 ${selected ? "border-blue-500" : "border-zinc-600"}`}
    >
      <button
        className={`nodrag nopan flex h-5 w-8 items-center justify-center rounded-sm text-xs font-bold ${
          data.pressed
            ? "bg-rose-500 text-white"
            : "bg-zinc-600 text-zinc-300"
        }`}
        onPointerDown={handlePress}
        onPointerUp={handleRelease}
        onPointerLeave={handleRelease}
      >
        {data.pressed ? "1" : "0"}
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

      <Handle
        type="source"
        position={getOutputPosition(data.rotation ?? 0)}
        id={data.pinId}
      />
    </div>
  );
}

export const ButtonNode = memo(ButtonNodeComponent);
