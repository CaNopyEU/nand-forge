import { useState, useEffect } from "react";
import type { Module } from "../../engine/types.ts";
import { useModuleStore, type ModuleVisuals } from "../../store/module-store.ts";

const MODULE_COLORS = [
  "#7f1d1d", // dark red
  "#78350f", // dark amber
  "#713f12", // dark yellow
  "#14532d", // dark green
  "#164e63", // dark cyan
  "#1e3a5f", // dark blue
  "#4c1d95", // dark violet
  "#831843", // dark pink
];

const MODULE_ICONS = [
  "\u26A1", "\u{1F527}", "\u{1F4E6}", "\u{1F9EE}", "\u{1F4BE}", "\u{1F512}",
  "\u{1F4DD}", "\u{1F3AF}", "\u{1F504}", "\u23F1\uFE0F", "\u{1F500}", "\u{1F4CA}",
];

interface ModulePropertiesDialogProps {
  open: boolean;
  module: Module | null;
  onClose: () => void;
}

export function ModulePropertiesDialog({ open, module, onClose }: ModulePropertiesDialogProps) {
  const updateModuleVisuals = useModuleStore((s) => s.updateModuleVisuals);

  const [color, setColor] = useState<string | undefined>(undefined);
  const [icon, setIcon] = useState<string | undefined>(undefined);
  const [description, setDescription] = useState("");
  const [customWidth, setCustomWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (open && module) {
      setColor(module.color);
      setIcon(module.icon);
      setDescription(module.description ?? "");
      setCustomWidth(module.customWidth);
    }
  }, [open, module]);

  if (!open || !module) return null;

  const handleSave = () => {
    const visuals: ModuleVisuals = {
      color,
      icon,
      description: description.trim() || undefined,
      customWidth,
    };
    updateModuleVisuals(module.id, visuals);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-80 rounded-lg border border-zinc-700 bg-zinc-800 p-4 shadow-xl animate-dialog-in">
        <h2 className="mb-3 text-sm font-bold text-zinc-100">
          {module.icon && <span className="mr-1">{module.icon}</span>}
          {module.name} — Properties
        </h2>

        {/* Color picker */}
        <label className="mb-1 block text-[11px] text-zinc-400">Color</label>
        <div className="mb-3 flex items-center gap-1.5">
          {MODULE_COLORS.map((c) => (
            <button
              key={c}
              className={`h-5 w-5 rounded border transition-transform hover:scale-110 ${color === c ? "border-white ring-1 ring-white/50" : "border-zinc-500"}`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
          <button
            className="ml-1 rounded bg-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-600"
            onClick={() => setColor(undefined)}
          >
            Reset
          </button>
        </div>

        {/* Icon selector */}
        <label className="mb-1 block text-[11px] text-zinc-400">Icon</label>
        <div className="mb-3 flex items-center gap-1">
          {MODULE_ICONS.map((ic) => (
            <button
              key={ic}
              className={`h-6 w-6 rounded text-sm transition-transform hover:scale-110 ${icon === ic ? "bg-zinc-600 ring-1 ring-white/50" : "bg-zinc-700 hover:bg-zinc-600"}`}
              onClick={() => setIcon(ic)}
            >
              {ic}
            </button>
          ))}
          <button
            className="ml-1 rounded bg-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-600"
            onClick={() => setIcon(undefined)}
          >
            Reset
          </button>
        </div>

        {/* Description */}
        <label className="mb-1 block text-[11px] text-zinc-400">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description..."
          rows={2}
          className="mb-3 w-full rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-blue-500 resize-none"
        />

        {/* Custom width */}
        <label className="mb-1 block text-[11px] text-zinc-400">
          Custom width {customWidth ? `(${customWidth}px)` : "(auto)"}
        </label>
        <div className="mb-3 flex items-center gap-2">
          <input
            type="range"
            min={72}
            max={200}
            value={customWidth ?? 72}
            onChange={(e) => setCustomWidth(Number(e.target.value))}
            className="flex-1 accent-blue-500"
          />
          <button
            className="rounded bg-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-600"
            onClick={() => setCustomWidth(undefined)}
          >
            Reset
          </button>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded bg-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-600"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded bg-blue-600 px-3 py-1 text-xs text-zinc-100 hover:bg-blue-500"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
