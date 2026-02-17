import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { RamNodeType } from "../../store/circuit-store.ts";
import { getInputPosition, getOutputPosition, getHandleDistributionStyle, isVerticalSide } from "../../utils/layout.ts";
import { useSimulationStore } from "../../store/simulation-store.ts";
import { pinKey } from "../../engine/simulate.ts";
import { RamViewerDialog } from "./RamViewerDialog.tsx";

const INPUT_PINS = ["Addr", "DIn", "WE", "CLK"] as const;

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

function RamNodeComponent({ id, data, selected }: NodeProps<RamNodeType>) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const rotation = data.rotation ?? 0;
  const inputPos = getInputPosition(rotation);
  const outputPos = getOutputPosition(rotation);

  const pinValues = useSimulationStore((s) => s.pinValues);
  const addrSignal   = pinValues[pinKey(id, data.addrPinId)]   ?? 0;
  const dataOutSignal = pinValues[pinKey(id, data.dataOutPinId)] ?? 0;
  const weSignal     = pinValues[pinKey(id, data.writePinId)]   ?? 0;
  const clkSignal    = pinValues[pinKey(id, data.clockPinId)]   ?? 0;

  const addrDigits = Math.ceil(data.addressBits / 4);
  const addrHex = addrSignal.toString(16).toUpperCase().padStart(addrDigits, "0");
  const dataHex = dataOutSignal.toString(16).toUpperCase().padStart(2, "0");

  // pin IDs in order matching INPUT_PINS
  const inputPinIds = [data.addrPinId, data.dataInPinId, data.writePinId, data.clockPinId];
  const inputSignals = [
    pinValues[pinKey(id, data.addrPinId)]   ?? 0,
    pinValues[pinKey(id, data.dataInPinId)] ?? 0,
    weSignal,
    clkSignal,
  ];

  const isHorizontalLayout = !isVerticalSide(inputPos);
  const rows = INPUT_PINS.length; // 4 inputs, 1 output → 4 rows
  const sizeStyle = isHorizontalLayout
    ? { minWidth: `${rows * 24 + 16}px`, minHeight: "100px" }
    : { minHeight: `${rows * 24 + 16}px`, minWidth: "100px" };

  return (
    <>
      <div
        className={`relative rounded border bg-zinc-800 ${selected ? "border-blue-500" : "border-emerald-700"}`}
        style={sizeStyle}
      >
        {/* Input handles */}
        {inputPinIds.map((pinId, i) => (
          <Handle
            key={pinId}
            type="target"
            position={inputPos}
            id={pinId}
            style={{
              ...getHandleDistributionStyle(inputPos, i, inputPinIds.length),
              background: inputSignals[i] ? "#34d399" : "#52525b",
              boxShadow: inputSignals[i] ? "0 0 4px rgba(52,211,153,0.6)" : "none",
            }}
          />
        ))}

        {/* Output handle */}
        <Handle
          type="source"
          position={outputPos}
          id={data.dataOutPinId}
          style={{
            ...getHandleDistributionStyle(outputPos, 0, 1),
            background: dataOutSignal ? "#34d399" : "#52525b",
            boxShadow: dataOutSignal ? "0 0 4px rgba(52,211,153,0.6)" : "none",
          }}
        />

        {/* Pin labels — inputs */}
        {INPUT_PINS.map((name, i) => (
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
          DOut
        </span>

        {/* Center content */}
        <div className="flex h-full flex-col items-center justify-center gap-0.5 px-6 py-2">
          <span className="text-[10px] font-bold text-emerald-300">RAM</span>
          <span className="text-[9px] text-zinc-500">{data.addressBits}-bit</span>
          <div className="mt-0.5 font-mono text-[9px] text-zinc-300">
            <span className="text-zinc-500">@{addrHex}</span>
            {" → "}
            <span>{dataHex}</span>
          </div>
          {weSignal && clkSignal ? (
            <span className="text-[8px] text-yellow-400">WR</span>
          ) : null}
          {/* nodrag: prevents node drag when clicking button */}
          <button
            className="nodrag mt-0.5 rounded bg-zinc-700 px-1.5 py-0.5 text-[9px] text-zinc-300 hover:bg-zinc-600"
            onClick={(e) => { e.stopPropagation(); setViewerOpen(true); }}
          >
            View
          </button>
        </div>
      </div>

      {viewerOpen && (
        <RamViewerDialog
          nodeId={id}
          addressBits={data.addressBits}
          initialData={data.initialData}
          currentAddrSignal={addrSignal}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}

export const RamNode = memo(RamNodeComponent);
