import { useState, useEffect, useCallback } from "react";
import { useCircuitStore } from "../../store/circuit-store.ts";
import { useModuleStore, getModuleById, type SaveResult } from "../../store/module-store.ts";
import { generateId } from "../../utils/id.ts";
import type { Module } from "../../engine/types.ts";
import { NewModuleDialog } from "./NewModuleDialog.tsx";

export function Toolbar() {
  const activeModuleId = useCircuitStore((s) => s.activeModuleId);
  const clearCanvas = useCircuitStore((s) => s.clearCanvas);
  const setActiveModuleId = useCircuitStore((s) => s.setActiveModuleId);
  const addModule = useModuleStore((s) => s.addModule);
  const saveCurrentModule = useModuleStore((s) => s.saveCurrentModule);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);

  // Resolve active module name
  const activeModule = activeModuleId ? getModuleById(activeModuleId) : undefined;

  const showToast = useCallback((type: "success" | "error" | "warning", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleSave = useCallback(() => {
    const result: SaveResult = saveCurrentModule();

    if (!result.success) {
      showToast("error", result.errors.join(" "));
      return;
    }

    if (result.warnings.length > 0) {
      showToast("warning", `Saved with warnings: ${result.warnings.join(" ")}`);
    } else {
      showToast("success", "Module saved.");
    }
  }, [saveCurrentModule, showToast]);

  const handleNewModule = useCallback((name: string) => {
    const id = generateId();
    const now = new Date().toISOString();

    const newModule: Module = {
      id,
      name,
      inputs: [],
      outputs: [],
      circuit: { id, name, nodes: [], edges: [] },
      createdAt: now,
      updatedAt: now,
    };

    addModule(newModule);
    setActiveModuleId(id);
    clearCanvas();
    setDialogOpen(false);
  }, [addModule, setActiveModuleId, clearCanvas]);

  // Ctrl+S / Cmd+S keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  const toastColor =
    toast?.type === "error"
      ? "bg-red-600"
      : toast?.type === "warning"
        ? "bg-amber-600"
        : "bg-emerald-600";

  return (
    <>
      <div className="flex h-10 items-center border-b border-zinc-700 px-4">
        <span className="text-sm font-bold">NAND Forge</span>

        {activeModule && (
          <span className="ml-3 rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
            {activeModule.name}
          </span>
        )}

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setDialogOpen(true)}
            className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-600"
          >
            New Module
          </button>
          <button
            onClick={handleSave}
            className="rounded bg-blue-600 px-2 py-1 text-xs text-zinc-100 hover:bg-blue-500"
          >
            Save
          </button>
        </div>
      </div>

      <NewModuleDialog
        open={dialogOpen}
        onConfirm={handleNewModule}
        onCancel={() => setDialogOpen(false)}
      />

      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 rounded px-4 py-2 text-xs text-white shadow-lg ${toastColor}`}>
          {toast.message}
        </div>
      )}
    </>
  );
}
