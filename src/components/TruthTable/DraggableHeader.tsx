import React, { useCallback } from "react";

interface DraggableHeaderProps {
  index: number;
  name: string;
  direction: "input" | "output";
  isFirstOutput: boolean;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

export function DraggableHeader({
  index,
  name,
  direction,
  isFirstOutput,
  onReorder,
}: DraggableHeaderProps) {
  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData("text/plain", `${direction}:${index}`);
      e.dataTransfer.effectAllowed = "move";
    },
    [direction, index],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const data = e.dataTransfer.getData("text/plain");
      const [srcDirection, srcIndexStr] = data.split(":");
      if (srcDirection !== direction) return;
      const srcIndex = parseInt(srcIndexStr!, 10);
      if (isNaN(srcIndex) || srcIndex === index) return;
      onReorder(srcIndex, index);
    },
    [direction, index, onReorder],
  );

  return (
    <th
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`px-3 py-1.5 text-center font-semibold text-zinc-300 cursor-grab active:cursor-grabbing select-none ${isFirstOutput ? "border-l border-zinc-600" : ""}`}
    >
      {name}
    </th>
  );
}
