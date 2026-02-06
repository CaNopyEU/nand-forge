import { useEffect } from "react";

const PRESET_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
];

interface EdgeColorPickerProps {
  x: number;
  y: number;
  onSelect: (color: string | undefined) => void;
  onClose: () => void;
}

export function EdgeColorPicker({ x, y, onSelect, onClose }: EdgeColorPickerProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed z-50 rounded border border-zinc-600 bg-zinc-800 p-2 shadow-lg"
      style={{ left: x, top: y }}
    >
      <div className="grid grid-cols-4 gap-1.5 mb-1.5">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            className="h-5 w-5 rounded border border-zinc-500 hover:scale-110 transition-transform"
            style={{ backgroundColor: color }}
            onClick={() => onSelect(color)}
            title={color}
          />
        ))}
      </div>
      <button
        className="w-full rounded bg-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-600"
        onClick={() => onSelect(undefined)}
      >
        Reset
      </button>
    </div>
  );
}
