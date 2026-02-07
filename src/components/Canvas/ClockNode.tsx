import { memo } from "react";
import { Handle, type NodeProps } from "@xyflow/react";
import type { ClockNodeType } from "../../store/circuit-store.ts";
import { getOutputPosition } from "../../utils/layout.ts";
import { useSimulationStore } from "../../store/simulation-store.ts";
import { pinKey } from "../../engine/simulate.ts";

function ClockNodeComponent({ id, data, selected }: NodeProps<ClockNodeType>) {
  const signal = useSimulationStore(
    (s) => s.pinValues[pinKey(id, data.pinId)] ?? false,
  );

  return (
    <div
      className={`flex items-center gap-1.5 rounded border bg-zinc-800 px-2 py-1.5 ${selected ? "border-blue-500" : "border-zinc-600"}`}
    >
      <span className="text-xs text-cyan-400">CLK</span>

      <div
        className={`h-3 w-3 rounded-full ${
          signal
            ? "bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.5)]"
            : "bg-zinc-600"
        }`}
      />

      <Handle
        type="source"
        position={getOutputPosition(data.rotation ?? 0)}
        id={data.pinId}
      />
    </div>
  );
}

export const ClockNode = memo(ClockNodeComponent);
