interface UnsavedChangesDialogProps {
  open: boolean;
  canSave: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function UnsavedChangesDialog({
  open,
  canSave,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in"
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <div className="w-80 rounded-lg border border-zinc-700 bg-zinc-800 p-4 shadow-xl animate-dialog-in">
        <h2 className="mb-3 text-sm font-bold text-zinc-100">Unsaved changes</h2>
        <p className="mb-4 text-xs text-zinc-300">
          You have unsaved changes. What would you like to do?
        </p>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded bg-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-600"
          >
            Cancel
          </button>
          <button
            onClick={onDiscard}
            className="rounded bg-red-600 px-3 py-1 text-xs text-zinc-100 hover:bg-red-500"
          >
            Discard
          </button>
          {canSave && (
            <button
              onClick={onSave}
              className="rounded bg-blue-600 px-3 py-1 text-xs text-zinc-100 hover:bg-blue-500"
            >
              Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
