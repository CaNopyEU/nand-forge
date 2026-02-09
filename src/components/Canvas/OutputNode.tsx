import { memo, useCallback, useState } from "react";
import { Handle, type NodeProps } from "@xyflow/react";
import { useCircuitStore, type OutputNodeType } from "../../store/circuit-store.ts";
import { getInputPosition } from "../../utils/layout.ts";
import { useSimulationStore } from "../../store/simulation-store.ts";
import { pinKey } from "../../engine/simulate.ts";

function formatHex(value: number, bits: number): string {
  const digits = Math.ceil(bits / 4);
  const masked = value & ((1 << bits) - 1);
  return `0x${masked.toString(16).toUpperCase().padStart(digits, "0")}`;
}

function OutputNodeComponent({ id, data, selected }: NodeProps<OutputNodeType>) {
  const updateNodeLabel = useCircuitStore((s) => s.updateNodeLabel);
  const signal = useSimulationStore(
    (s) => s.pinValues[pinKey(id, data.pinId)] ?? 0,
  );

  const bits = data.bits ?? 1;
  const isBus = bits > 1;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);

  const commitLabel = useCallback(() => {
    updateNodeLabel(id, draft);
    setEditing(false);
  }, [id, draft, updateNodeLabel]);

  return (
    <div className={`flex items-center gap-1.5 rounded border bg-zinc-800 px-2 py-1.5 ${selected ? "border-blue-500" : "border-zinc-600"}`}>
      <Handle type="target" position={getInputPosition(data.rotation ?? 0)} id={data.pinId} />

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

      {isBus ? (
        <>
          <span
            className={`rounded px-1 text-xs font-mono ${
              signal ? "bg-emerald-800 text-emerald-200" : "bg-zinc-700 text-zinc-400"
            }`}
          >
            {formatHex(signal, bits)}
          </span>
          <span className="text-[9px] text-zinc-500">{bits}b</span>
        </>
      ) : (
        <div
          className={`h-3 w-3 rounded-full ${
            signal
              ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]"
              : "bg-zinc-600"
          }`}
        />
      )}
    </div>
  );
}

export const OutputNode = memo(OutputNodeComponent);
