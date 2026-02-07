import { memo } from "react";
import { Handle, type NodeProps } from "@xyflow/react";
import type { ProbeNodeType } from "../../store/circuit-store.ts";
import { getInputPosition } from "../../utils/layout.ts";
import { useSimulationStore } from "../../store/simulation-store.ts";
import { pinKey } from "../../engine/simulate.ts";

function ProbeNodeComponent({ id, data, selected }: NodeProps<ProbeNodeType>) {
  const signal = useSimulationStore(
    (s) => s.pinValues[pinKey(id, data.pinId)] ?? false,
  );

  return (
    <div className={`flex items-center gap-1 rounded border bg-zinc-800 px-1.5 py-1 ${selected ? "border-blue-500" : "border-zinc-600"}`}>
      <Handle type="target" position={getInputPosition(data.rotation ?? 0)} id={data.pinId} />

      <div
        className={`flex h-5 w-5 items-center justify-center rounded-sm text-xs font-bold ${
          signal
            ? "bg-emerald-500 text-white"
            : "bg-zinc-600 text-zinc-300"
        }`}
      >
        {signal ? "1" : "0"}
      </div>
    </div>
  );
}

export const ProbeNode = memo(ProbeNodeComponent);
