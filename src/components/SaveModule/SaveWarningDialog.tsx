import type { Pin, Module } from "../../engine/types.ts";

interface SaveWarningDialogProps {
  open: boolean;
  title?: string;
  message?: string;
  removedPins: Pin[];
  affectedModules: Module[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function SaveWarningDialog({
  open,
  title = "Breaking changes detected",
  message,
  removedPins,
  affectedModules,
  onConfirm,
  onCancel,
}: SaveWarningDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in"
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <div className="w-96 rounded-lg border border-zinc-700 bg-zinc-800 p-4 shadow-xl animate-dialog-in">
        <h2 className="mb-3 text-sm font-bold text-zinc-100">{title}</h2>

        {message && (
          <p className="mb-3 text-xs text-zinc-300">{message}</p>
        )}

        {removedPins.length > 0 && (
          <div className="mb-3">
            <p className="mb-1 text-xs font-semibold text-red-400">Removed pins:</p>
            <ul className="ml-3 list-disc text-xs text-zinc-300">
              {removedPins.map((pin) => (
                <li key={pin.id}>
                  {pin.name} ({pin.direction})
                </li>
              ))}
            </ul>
          </div>
        )}

        {affectedModules.length > 0 && (
          <div className="mb-3">
            <p className="mb-1 text-xs font-semibold text-amber-400">Affected modules:</p>
            <ul className="ml-3 list-disc text-xs text-zinc-300">
              {affectedModules.map((mod) => (
                <li key={mod.id}>{mod.name}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="mb-3 text-xs text-zinc-400">
          Wires connected to removed pins will be disconnected.
        </p>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded bg-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-600"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded bg-red-600 px-3 py-1 text-xs text-zinc-100 hover:bg-red-500"
          >
            Save anyway
          </button>
        </div>
      </div>
    </div>
  );
}
