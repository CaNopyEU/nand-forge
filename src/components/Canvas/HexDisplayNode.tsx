import { memo } from "react";
import { Handle, type NodeProps } from "@xyflow/react";
import type { HexDisplayNodeType } from "../../store/circuit-store.ts";
import { getInputPosition } from "../../utils/layout.ts";
import { useSimulationStore } from "../../store/simulation-store.ts";
import { pinKey } from "../../engine/simulate.ts";

function HexDisplayNodeComponent({ id, data, selected }: NodeProps<HexDisplayNodeType>) {
  const bits = data.bits ?? 8;
  const signal = useSimulationStore(
    (s) => s.pinValues[pinKey(id, data.pinId)] ?? 0,
  );
  const mask = (1 << bits) - 1;
  const masked = signal & mask;
  const hexDigits = Math.ceil(bits / 4);
  const hex = masked.toString(16).toUpperCase().padStart(hexDigits, "0");
  const bin = masked.toString(2).padStart(bits, "0");
  const active = masked !== 0;

  return (
    <div
      className={`flex flex-col items-center gap-0.5 rounded border bg-zinc-800 px-2 py-1.5 ${selected ? "border-blue-500" : "border-amber-700"}`}
    >
      <Handle type="target" position={getInputPosition(data.rotation ?? 0)} id={data.pinId} />

      <span
        className={`font-mono text-sm font-bold ${active ? "text-emerald-400" : "text-zinc-500"}`}
      >
        0x{hex}
      </span>
      <span className={`font-mono text-[9px] ${active ? "text-zinc-300" : "text-zinc-600"}`}>
        {bin}
      </span>
      <span className={`font-mono text-[9px] ${active ? "text-zinc-300" : "text-zinc-600"}`}>
        {masked}
      </span>
    </div>
  );
}

export const HexDisplayNode = memo(HexDisplayNodeComponent);
