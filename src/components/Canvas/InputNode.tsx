import { memo, useCallback, useState } from "react";
import { Handle, type NodeProps } from "@xyflow/react";
import { useCircuitStore, type InputNodeType } from "../../store/circuit-store.ts";
import { getOutputPosition } from "../../utils/layout.ts";

function formatHex(value: number, bits: number): string {
  const digits = Math.ceil(bits / 4);
  const masked = value & ((1 << bits) - 1);
  return masked.toString(16).toUpperCase().padStart(digits, "0");
}

function InputNodeComponent({ id, data, selected }: NodeProps<InputNodeType>) {
  const toggleInputValue = useCircuitStore((s) => s.toggleInputValue);
  const setInputValue = useCircuitStore((s) => s.setInputValue);
  const updateNodeLabel = useCircuitStore((s) => s.updateNodeLabel);
  const readOnly = useCircuitStore((s) => s.readOnly);

  const bits = data.bits ?? 1;
  const isBus = bits > 1;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);
  const [hexDraft, setHexDraft] = useState("");

  const handleToggle = useCallback(() => {
    toggleInputValue(id);
  }, [id, toggleInputValue]);

  const commitLabel = useCallback(() => {
    updateNodeLabel(id, draft);
    setEditing(false);
  }, [id, draft, updateNodeLabel]);

  const commitHex = useCallback(() => {
    const parsed = parseInt(hexDraft, 16);
    if (!isNaN(parsed)) {
      setInputValue(id, parsed);
    }
  }, [id, hexDraft, setInputValue]);

  return (
    <div className={`flex items-center gap-1.5 rounded border bg-zinc-800 px-2 py-1.5 ${selected ? "border-blue-500" : "border-zinc-600"}`}>
      {isBus ? (
        <input
          className="nodrag nopan w-14 rounded bg-zinc-700 px-1 text-xs font-mono text-zinc-100 outline-none text-center"
          value={hexDraft || formatHex(data.value, bits)}
          onChange={(e) => setHexDraft(e.target.value)}
          onFocus={() => setHexDraft(formatHex(data.value, bits))}
          onBlur={() => { commitHex(); setHexDraft(""); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { commitHex(); setHexDraft(""); (e.target as HTMLInputElement).blur(); }
          }}
          readOnly={readOnly}
        />
      ) : (
        <button
          className={`nodrag nopan flex h-5 w-5 items-center justify-center rounded-sm text-xs font-bold ${
            data.value
              ? "bg-emerald-500 text-white"
              : "bg-zinc-600 text-zinc-300"
          }`}
          onClick={readOnly ? undefined : handleToggle}
          disabled={readOnly}
        >
          {data.value ? "1" : "0"}
        </button>
      )}

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

      {isBus && (
        <span className="text-[9px] text-zinc-500">{bits}b</span>
      )}

      <Handle type="source" position={getOutputPosition(data.rotation ?? 0)} id={data.pinId} />
    </div>
  );
}

export const InputNode = memo(InputNodeComponent);
