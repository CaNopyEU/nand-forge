import { memo, useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useCircuitStore, type ConstantNodeType } from "../../store/circuit-store.ts";

function ConstantNodeComponent({ id, data }: NodeProps<ConstantNodeType>) {
  const toggleConstantValue = useCircuitStore((s) => s.toggleConstantValue);

  const handleToggle = useCallback(() => {
    toggleConstantValue(id);
  }, [id, toggleConstantValue]);

  return (
    <div className="flex items-center gap-1.5 rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5">
      <button
        className={`nodrag nopan flex h-5 w-5 items-center justify-center rounded-sm text-xs font-bold ${
          data.value
            ? "bg-amber-500 text-white"
            : "bg-zinc-600 text-zinc-300"
        }`}
        onClick={handleToggle}
      >
        {data.value ? "1" : "0"}
      </button>
      <span className="text-xs text-zinc-400">const</span>

      <Handle type="source" position={Position.Right} id={data.pinId} />
    </div>
  );
}

export const ConstantNode = memo(ConstantNodeComponent);
