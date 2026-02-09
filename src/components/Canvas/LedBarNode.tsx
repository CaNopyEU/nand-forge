import { memo } from "react";
import { Handle, type NodeProps } from "@xyflow/react";
import type { LedBarNodeType } from "../../store/circuit-store.ts";
import { getInputPosition } from "../../utils/layout.ts";
import { useSimulationStore } from "../../store/simulation-store.ts";
import { pinKey } from "../../engine/simulate.ts";

function LedBarNodeComponent({ id, data, selected }: NodeProps<LedBarNodeType>) {
  const bits = data.bits ?? 8;
  const signal = useSimulationStore(
    (s) => s.pinValues[pinKey(id, data.pinId)] ?? 0,
  );

  return (
    <div
      className={`flex flex-col items-center gap-1 rounded border bg-zinc-800 px-2 py-1.5 ${selected ? "border-blue-500" : "border-amber-700"}`}
    >
      <Handle type="target" position={getInputPosition(data.rotation ?? 0)} id={data.pinId} />

      <div className="flex gap-1">
        {Array.from({ length: bits }, (_, i) => {
          const bitIndex = bits - 1 - i;
          const bitVal = (signal >> bitIndex) & 1;
          return (
            <div
              key={bitIndex}
              className={`h-3 w-3 rounded-full ${
                bitVal
                  ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]"
                  : "bg-zinc-600"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

export const LedBarNode = memo(LedBarNodeComponent);
