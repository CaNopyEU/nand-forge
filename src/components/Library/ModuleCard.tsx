import React, { useState, useCallback } from "react";
import type { Module } from "../../engine/types.ts";
import { BUILTIN_NAND_MODULE_ID } from "../../engine/simulate.ts";

interface ModuleCardProps {
  module: Module;
  onOpen: (moduleId: string) => void;
  onDelete?: (moduleId: string) => void;
  onStamp?: (moduleId: string) => void;
  disabled?: boolean;
  stampActive?: boolean;
  parentFolderId?: string | null;
  indexInParent?: number;
  locked?: boolean;
  onReorder?: (moduleId: string, targetFolderId: string | null, insertIndex: number) => void;
}

export const ModuleCard = React.memo(function ModuleCard({
  module,
  onOpen,
  onDelete,
  onStamp,
  disabled,
  stampActive,
  parentFolderId,
  indexInParent,
  locked,
  onReorder,
}: ModuleCardProps) {
  const isBuiltin = module.id === BUILTIN_NAND_MODULE_ID;
  const inputCount = module.inputs.length;
  const outputCount = module.outputs.length;

  const [dropPosition, setDropPosition] = useState<"before" | "after" | null>(null);

  const handleDragStart = (e: React.DragEvent) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("application/nandforge-module", module.id);
    e.dataTransfer.setData("application/nandforge-library-item", module.id);
    e.dataTransfer.effectAllowed = "copyMove";
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (locked || indexInParent === undefined || !onReorder) return;
    if (!e.dataTransfer.types.includes("application/nandforge-library-item")) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    setDropPosition(e.clientY < midY ? "before" : "after");
  }, [locked, indexInParent, onReorder]);

  const handleDragLeave = useCallback(() => {
    setDropPosition(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropPosition(null);
    if (locked || indexInParent === undefined || !onReorder) return;
    const draggedId = e.dataTransfer.getData("application/nandforge-library-item");
    if (!draggedId || draggedId === module.id) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const pos = e.clientY < midY ? "before" : "after";
    const targetIndex = pos === "before" ? indexInParent : indexInParent + 1;
    onReorder(draggedId, parentFolderId ?? null, targetIndex);
  }, [locked, indexInParent, onReorder, parentFolderId, module.id]);

  const dropClass = dropPosition === "before"
    ? "border-t-2 border-t-blue-500"
    : dropPosition === "after"
      ? "border-b-2 border-b-blue-500"
      : "";

  const handleClick = useCallback(() => {
    if (disabled || !onStamp) return;
    onStamp(module.id);
  }, [disabled, onStamp, module.id]);

  return (
    <div
      draggable={!disabled}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`flex items-center gap-1 rounded border bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 ${stampActive ? "border-blue-500 ring-1 ring-blue-500/50" : "border-zinc-600"} ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"} ${dropClass}`}
      title={disabled ? "Cannot place — would create circular dependency" : "Click to stamp, drag to canvas"}
    >
      <span className="flex-1 font-medium">{module.name}</span>
      <span className="text-[10px] text-zinc-500">
        {inputCount}in {outputCount}out
      </span>
      {!isBuiltin && (
        <>
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
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(module.id);
              }}
              className="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:bg-red-600 hover:text-zinc-200"
              title="Delete module"
            >
              Del
            </button>
          )}
        </>
      )}
    </div>
  );
});
