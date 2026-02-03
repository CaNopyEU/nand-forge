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
      onClick={() => {
        if (!isBuiltin) onOpen(module.id);
      }}
      className={`flex cursor-grab items-center justify-between rounded border px-2 py-1.5 text-xs active:cursor-grabbing ${
        isBuiltin
          ? "border-zinc-600 bg-zinc-800 text-zinc-300"
          : "border-zinc-600 bg-zinc-800 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-700"
      }`}
      title={isBuiltin ? "Drag to canvas" : "Click to edit, drag to canvas"}
    >
      <span className="font-medium">{module.name}</span>
      <span className="text-[10px] text-zinc-500">
        {inputCount}in {outputCount}out
      </span>
    </div>
  );
});
