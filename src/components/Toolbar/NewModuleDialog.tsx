import { useState, useRef, useEffect } from "react";

interface NewModuleDialogProps {
  open: boolean;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

export function NewModuleDialog({ open, onConfirm, onCancel }: NewModuleDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setError("");
      // Focus input after render
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Module name cannot be empty.");
      return;
    }
    if (trimmed.toUpperCase() === "NAND") {
      setError('"NAND" is a built-in gate and cannot be used as a module name.');
      return;
    }
    onConfirm(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
      <div className="w-80 rounded-lg border border-zinc-700 bg-zinc-800 p-4 shadow-xl animate-dialog-in">
        <h2 className="mb-3 text-sm font-bold text-zinc-100">New Module</h2>

        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onCancel();
          }}
          placeholder="Module name"
          className="mb-2 w-full rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-blue-500"
        />

        {error && (
          <p className="mb-2 text-xs text-red-400">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded bg-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-600"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="rounded bg-blue-600 px-3 py-1 text-xs text-zinc-100 hover:bg-blue-500"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
