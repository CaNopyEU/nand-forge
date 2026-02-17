import { memo } from "react";
import { Handle, type NodeProps } from "@xyflow/react";
import type { PullNodeType } from "../../store/circuit-store.ts";
import { getOutputPosition, getHandleDistributionStyle } from "../../utils/layout.ts";

function PullNodeComponent({ data, selected }: NodeProps<PullNodeType>) {
  const rotation = data.rotation ?? 0;
  const outputPos = getOutputPosition(rotation);

  const isPullup = data.variant === "pullup";
  const label = isPullup ? "↑R" : "↓R";
  const hint  = isPullup ? "PULL↑" : "PULL↓";

  // Pull nodes always emit WEAK_1 or WEAK_0, shown as soft purple
  const handleColor = "#a855f7";
  const handleGlow  = "0 0 4px rgba(168,85,247,0.4)";

  return (
    <div
      className={`relative rounded border bg-zinc-800 ${selected ? "border-blue-500" : "border-violet-700"}`}
      style={{ minWidth: "48px", minHeight: "48px" }}
    >
      <Handle
        type="source"
        position={outputPos}
        id={data.outputPinId}
        style={{
          ...getHandleDistributionStyle(outputPos, 0, 1),
          background: handleColor,
          boxShadow: handleGlow,
        }}
      />

      <div className="flex h-full flex-col items-center justify-center gap-0.5 px-2 py-1">
        <span className="text-[12px] font-bold text-violet-300">{label}</span>
        <span className="text-[8px] text-zinc-500">{hint}</span>
      </div>
    </div>
  );
}

export const PullNode = memo(PullNodeComponent);
