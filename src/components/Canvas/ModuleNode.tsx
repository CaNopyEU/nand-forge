import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ModuleNodeType } from "../../store/circuit-store.ts";
import { useSimulationStore } from "../../store/simulation-store.ts";
import { pinKey } from "../../engine/simulate.ts";
import {
  getInputPosition,
  getOutputPosition,
  getHandleDistributionStyle,
  isVerticalSide,
} from "../../utils/layout.ts";

/** CSS classes for pin-label placement depending on which side the handle sits on. */
function labelClasses(side: Position): string {
  switch (side) {
    case Position.Left:
      return "absolute left-1.5 text-[9px] text-zinc-400";
    case Position.Right:
      return "absolute right-1.5 text-[9px] text-zinc-400";
    case Position.Top:
      return "absolute top-0.5 text-[9px] text-zinc-400";
    case Position.Bottom:
      return "absolute bottom-0.5 text-[9px] text-zinc-400";
  }
}

/** Inline style to position a pin label next to its handle. */
function labelStyle(
  side: Position,
  index: number,
  total: number,
): React.CSSProperties {
  const pct = `${((index + 1) / (total + 1)) * 100}%`;
  if (isVerticalSide(side)) {
    return { top: pct, transform: "translateY(-50%)" };
  }
  return { left: pct, transform: "translateX(-50%)" };
}

function ModuleNodeComponent({ id, data, selected }: NodeProps<ModuleNodeType>) {
  const pinValues = useSimulationStore((s) => s.pinValues);
  const rotation = data.rotation ?? 0;
  const inputPos = getInputPosition(rotation);
  const outputPos = getOutputPosition(rotation);

  const inputPins = data.pins.filter((p) => p.direction === "input");
  const outputPins = data.pins.filter((p) => p.direction === "output");
  const rows = Math.max(inputPins.length, outputPins.length, 1);

  // When pins are on Top/Bottom (90°/270°), the node should be wider instead of taller.
  const isHorizontalLayout = !isVerticalSide(inputPos);
  const sizeStyle = isHorizontalLayout
    ? { minWidth: `${rows * 24 + 16}px`, minHeight: "72px" }
    : { minHeight: `${rows * 24 + 16}px`, minWidth: "72px" };

  return (
    <div
      className={`relative rounded border bg-zinc-800 px-4 ${selected ? "border-blue-500" : "border-zinc-600"}`}
      style={sizeStyle}
    >
      {/* Input handles */}
      {inputPins.map((pin, i) => {
        const signal = pinValues[pinKey(id, pin.id)] ?? false;
        return (
          <Handle
            key={pin.id}
            type="target"
            position={inputPos}
            id={pin.id}
            style={{
              ...getHandleDistributionStyle(inputPos, i, inputPins.length),
              background: signal ? "#34d399" : "#52525b",
              boxShadow: signal ? "0 0 4px rgba(52,211,153,0.6)" : "none",
            }}
          />
        );
      })}

      {/* Label */}
      <div className="flex h-full items-center justify-center py-2">
        <span className="text-xs font-bold text-zinc-200">{data.label}</span>
      </div>

      {/* Pin names — inputs */}
      {inputPins.map((pin, i) => (
        <span
          key={pin.id}
          className={labelClasses(inputPos)}
          style={labelStyle(inputPos, i, inputPins.length)}
        >
          {pin.name}
        </span>
      ))}
      {/* Pin names — outputs */}
      {outputPins.map((pin, i) => (
        <span
          key={pin.id}
          className={labelClasses(outputPos)}
          style={labelStyle(outputPos, i, outputPins.length)}
        >
          {pin.name}
        </span>
      ))}

      {/* Output handles */}
      {outputPins.map((pin, i) => {
        const signal = pinValues[pinKey(id, pin.id)] ?? false;
        return (
          <Handle
            key={pin.id}
            type="source"
            position={outputPos}
            id={pin.id}
            style={{
              ...getHandleDistributionStyle(outputPos, i, outputPins.length),
              background: signal ? "#34d399" : "#52525b",
              boxShadow: signal ? "0 0 4px rgba(52,211,153,0.6)" : "none",
            }}
          />
        );
      })}
    </div>
  );
}

export const ModuleNode = memo(ModuleNodeComponent);
