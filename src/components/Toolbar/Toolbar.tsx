import { useState, useEffect, useCallback } from "react";
import { useCircuitStore } from "../../store/circuit-store.ts";
import { useModuleStore, getModuleById, type SaveAnalysis } from "../../store/module-store.ts";
import { generateId } from "../../utils/id.ts";
import type { Module } from "../../engine/types.ts";
import { NewModuleDialog } from "./NewModuleDialog.tsx";
import { SaveWarningDialog } from "../SaveModule/SaveWarningDialog.tsx";

export function Toolbar() {
  const activeModuleId = useCircuitStore((s) => s.activeModuleId);
  const isDirty = useCircuitStore((s) => s.isDirty);
  const clearCanvas = useCircuitStore((s) => s.clearCanvas);
  const setActiveModuleId = useCircuitStore((s) => s.setActiveModuleId);
  const addModule = useModuleStore((s) => s.addModule);
  const prepareSave = useModuleStore((s) => s.prepareSave);
  const executeSave = useModuleStore((s) => s.executeSave);

  // "new" = New Module (clears canvas), "save" = Save prompt (keeps canvas)
  const [dialogMode, setDialogMode] = useState<"new" | "save" | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);
  const [saveAnalysis, setSaveAnalysis] = useState<SaveAnalysis | null>(null);

  // Resolve active module name
  const activeModule = activeModuleId ? getModuleById(activeModuleId) : undefined;

  const showToast = useCallback((type: "success" | "error" | "warning", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const doSave = useCallback(() => {
    const analysis = prepareSave();

    if (!analysis.success) {
      showToast("error", analysis.errors.join(" "));
      return;
    }

    if (analysis.needsConfirmation) {
      setSaveAnalysis(analysis);
      return;
    }

    const result = executeSave(analysis);

    if (!result.success) {
      showToast("error", result.errors.join(" "));
      return;
    }

    if (result.warnings.length > 0) {
      showToast("warning", `Saved with warnings: ${result.warnings.join(" ")}`);
    } else {
      showToast("success", "Module saved.");
    }
  }, [prepareSave, executeSave, showToast]);

  const handleSaveConfirm = useCallback(() => {
    if (!saveAnalysis) return;
    const result = executeSave(saveAnalysis);
    setSaveAnalysis(null);

    if (!result.success) {
      showToast("error", result.errors.join(" "));
      return;
    }

    if (result.warnings.length > 0) {
      showToast("warning", `Saved with warnings: ${result.warnings.join(" ")}`);
    } else {
      showToast("success", "Module saved.");
    }
  }, [saveAnalysis, executeSave, showToast]);

  const handleSave = useCallback(() => {
    if (!activeModuleId) {
      // No active module — ask for name, then save with current canvas
      setDialogMode("save");
      return;
    }
    doSave();
  }, [activeModuleId, doSave]);

  const handleDialogConfirm = useCallback((name: string) => {
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

    if (dialogMode === "new") {
      clearCanvas();
    }

    setDialogMode(null);

    // If saving, trigger save now that activeModuleId is set
    if (dialogMode === "save") {
      // Need to call save after state update — use setTimeout(0)
      setTimeout(() => doSave(), 0);
    }
  }, [addModule, setActiveModuleId, clearCanvas, dialogMode, doSave]);

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
            {isDirty && <span className="ml-1 text-amber-400">*</span>}
          </span>
        )}

        {!activeModule && isDirty && (
          <span className="ml-3 text-xs text-zinc-500">unsaved circuit</span>
        )}

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setDialogMode("new")}
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
        open={dialogMode !== null}
        onConfirm={handleDialogConfirm}
        onCancel={() => setDialogMode(null)}
      />

      <SaveWarningDialog
        open={saveAnalysis !== null}
        removedPins={saveAnalysis?.diff?.removed ?? []}
        affectedModules={saveAnalysis?.affectedModules ?? []}
        onConfirm={handleSaveConfirm}
        onCancel={() => setSaveAnalysis(null)}
      />

      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 rounded px-4 py-2 text-xs text-white shadow-lg ${toastColor}`}>
          {toast.message}
        </div>
      )}
    </>
  );
}
