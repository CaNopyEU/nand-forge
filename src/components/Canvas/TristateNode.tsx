import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { TristateNodeType } from "../../store/circuit-store.ts";
import { getInputPosition, getOutputPosition, getHandleDistributionStyle, isVerticalSide } from "../../utils/layout.ts";
import { useSimulationStore } from "../../store/simulation-store.ts";
import { pinKey, Z_VALUE } from "../../engine/simulate.ts";

function TristateNodeComponent({ id, data, selected }: NodeProps<TristateNodeType>) {
  const rotation = data.rotation ?? 0;
  const inputPos = getInputPosition(rotation);
  const outputPos = getOutputPosition(rotation);

  const pinValues = useSimulationStore((s) => s.pinValues);
  const dataSignal   = pinValues[pinKey(id, data.dataPinId)]   ?? 0;
  const enableSignal = pinValues[pinKey(id, data.enablePinId)] ?? 0;
  const outputSignal = pinValues[pinKey(id, data.outputPinId)] ?? 0;

  const enabled = enableSignal > 0;
  const isHighZ = outputSignal === Z_VALUE;

  const inputPinIds = [data.dataPinId, data.enablePinId];
  const inputSignals = [dataSignal, enableSignal];
  const inputLabels = ["D", "EN"];

  const isHorizontalLayout = !isVerticalSide(inputPos);
  const sizeStyle = isHorizontalLayout
    ? { minWidth: "80px", minHeight: "64px" }
    : { minHeight: "80px", minWidth: "64px" };

  function handleColor(sig: number) {
    return sig > 0 ? "#34d399" : "#52525b";
  }
  function handleGlow(sig: number) {
    return sig > 0 ? "0 0 4px rgba(52,211,153,0.6)" : "none";
  }

  const outColor = isHighZ ? "#a855f7" : outputSignal > 0 ? "#34d399" : "#52525b";
  const outGlow  = isHighZ ? "0 0 4px rgba(168,85,247,0.6)" : outputSignal > 0 ? "0 0 4px rgba(52,211,153,0.6)" : "none";

  function labelClasses(side: Position): string {
    switch (side) {
      case Position.Left:   return "absolute left-1.5 text-[9px] text-zinc-400";
      case Position.Right:  return "absolute right-1.5 text-[9px] text-zinc-400";
      case Position.Top:    return "absolute top-0.5 text-[9px] text-zinc-400";
      case Position.Bottom: return "absolute bottom-0.5 text-[9px] text-zinc-400";
    }
  }

  function labelStyle(side: Position, index: number, total: number): React.CSSProperties {
    const pct = `${((index + 1) / (total + 1)) * 100}%`;
    if (isVerticalSide(side)) return { top: pct, transform: "translateY(-50%)" };
    return { left: pct, transform: "translateX(-50%)" };
  }

  return (
    <div
      className={`relative rounded border bg-zinc-800 ${selected ? "border-blue-500" : "border-violet-600"}`}
      style={sizeStyle}
    >
      {/* Input handles: D and EN */}
      {inputPinIds.map((pinId, i) => (
        <Handle
          key={pinId}
          type="target"
          position={inputPos}
          id={pinId}
          style={{
            ...getHandleDistributionStyle(inputPos, i, inputPinIds.length),
            background: handleColor(inputSignals[i]!),
            boxShadow: handleGlow(inputSignals[i]!),
          }}
        />
      ))}

      {/* Output handle: Y */}
      <Handle
        type="source"
        position={outputPos}
        id={data.outputPinId}
        style={{
          ...getHandleDistributionStyle(outputPos, 0, 1),
          background: outColor,
          boxShadow: outGlow,
        }}
      />

      {/* Pin labels — inputs */}
      {inputLabels.map((name, i) => (
        <span
          key={name}
          className={labelClasses(inputPos)}
          style={labelStyle(inputPos, i, inputPinIds.length)}
        >
          {name}
        </span>
      ))}
      {/* Pin label — output */}
      <span className={labelClasses(outputPos)} style={labelStyle(outputPos, 0, 1)}>
        Y
      </span>

      {/* Center content */}
      <div className="flex h-full flex-col items-center justify-center gap-0.5 px-6 py-1">
        <span className="text-[10px] font-bold text-violet-300">▷Z</span>
        <span className="text-[9px] text-zinc-500">{data.bits}-bit</span>
        <span className={`text-[9px] font-semibold ${enabled ? "text-emerald-400" : "text-zinc-600"}`}>
          {enabled ? "ON" : "HiZ"}
        </span>
      </div>
    </div>
  );
}

export const TristateNode = memo(TristateNodeComponent);
