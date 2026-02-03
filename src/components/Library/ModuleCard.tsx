import React from "react";
import type { Module } from "../../engine/types.ts";
import { BUILTIN_NAND_MODULE_ID } from "../../engine/simulate.ts";

interface ModuleCardProps {
  module: Module;
  onOpen: (moduleId: string) => void;
}

export const ModuleCard = React.memo(function ModuleCard({
  module,
  onOpen,
}: ModuleCardProps) {
  const isBuiltin = module.id === BUILTIN_NAND_MODULE_ID;
  const inputCount = module.inputs.length;
  const outputCount = module.outputs.length;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/nandforge-module", module.id);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="flex cursor-grab items-center gap-1 rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 active:cursor-grabbing"
      title="Drag to canvas"
    >
      <span className="flex-1 font-medium">{module.name}</span>
      <span className="text-[10px] text-zinc-500">
        {inputCount}in {outputCount}out
      </span>
      {!isBuiltin && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpen(module.id);
          }}
          className="ml-1 rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-600 hover:text-zinc-200"
          title="Edit module"
        >
          Edit
        </button>
      )}
    </div>
  );
});
