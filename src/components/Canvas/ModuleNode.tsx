import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ModuleNodeType } from "../../store/circuit-store.ts";

function ModuleNodeComponent({ data }: NodeProps<ModuleNodeType>) {
  const inputPins = data.pins.filter((p) => p.direction === "input");
  const outputPins = data.pins.filter((p) => p.direction === "output");
  const rows = Math.max(inputPins.length, outputPins.length, 1);

  return (
    <div
      className="relative rounded border border-zinc-600 bg-zinc-800 px-4"
      style={{ minHeight: `${rows * 24 + 16}px`, minWidth: "72px" }}
    >
      {/* Input handles (left) */}
      {inputPins.map((pin, i) => (
        <Handle
          key={pin.id}
          type="target"
          position={Position.Left}
          id={pin.id}
          style={{ top: `${((i + 1) / (inputPins.length + 1)) * 100}%` }}
        />
      ))}

      {/* Label */}
      <div className="flex h-full items-center justify-center py-2">
        <span className="text-xs font-bold text-zinc-200">{data.label}</span>
      </div>

      {/* Pin names */}
      {inputPins.map((pin, i) => (
        <span
          key={pin.id}
          className="absolute left-1.5 text-[9px] text-zinc-400"
          style={{
            top: `${((i + 1) / (inputPins.length + 1)) * 100}%`,
            transform: "translateY(-50%)",
          }}
        >
          {pin.name}
        </span>
      ))}
      {outputPins.map((pin, i) => (
        <span
          key={pin.id}
          className="absolute right-1.5 text-[9px] text-zinc-400"
          style={{
            top: `${((i + 1) / (outputPins.length + 1)) * 100}%`,
            transform: "translateY(-50%)",
          }}
        >
          {pin.name}
        </span>
      ))}

      {/* Output handles (right) */}
      {outputPins.map((pin, i) => (
        <Handle
          key={pin.id}
          type="source"
          position={Position.Right}
          id={pin.id}
          style={{ top: `${((i + 1) / (outputPins.length + 1)) * 100}%` }}
        />
      ))}
    </div>
  );
}

export const ModuleNode = memo(ModuleNodeComponent);
