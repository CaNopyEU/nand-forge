import { useState, useEffect, useCallback, useRef } from "react";
import { useCircuitStore } from "../../store/circuit-store.ts";
import { useModuleStore, getModuleById, type SaveAnalysis } from "../../store/module-store.ts";
import { useLibraryStore } from "../../store/library-store.ts";
import { generateId } from "../../utils/id.ts";
import type { Module } from "../../engine/types.ts";
import { NewModuleDialog } from "./NewModuleDialog.tsx";
import { SaveWarningDialog } from "../SaveModule/SaveWarningDialog.tsx";
import { TruthTableView } from "../TruthTable/TruthTableView.tsx";
import { UnsavedChangesDialog } from "../UnsavedChangesDialog.tsx";
import { exportToJson, importFromJson } from "../../utils/persistence.ts";

export function Toolbar() {
  const activeModuleId = useCircuitStore((s) => s.activeModuleId);
  const isDirty = useCircuitStore((s) => s.isDirty);
  const clearCanvas = useCircuitStore((s) => s.clearCanvas);
  const setActiveModuleId = useCircuitStore((s) => s.setActiveModuleId);
  const addModule = useModuleStore((s) => s.addModule);
  const modules = useModuleStore((s) => s.modules);
  const prepareSave = useModuleStore((s) => s.prepareSave);
  const executeSave = useModuleStore((s) => s.executeSave);
  const saveCurrentModule = useModuleStore((s) => s.saveCurrentModule);
  const truthTableGenerating = useModuleStore((s) => s.truthTableGenerating);
  const undo = useCircuitStore((s) => s.undo);
  const redo = useCircuitStore((s) => s.redo);
  const canUndo = useCircuitStore((s) => s.past.length > 0);
  const canRedo = useCircuitStore((s) => s.future.length > 0);

  // "new" = New Module (clears canvas), "save" = Save prompt (keeps canvas)
  const [dialogMode, setDialogMode] = useState<"new" | "save" | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);
  const [saveAnalysis, setSaveAnalysis] = useState<SaveAnalysis | null>(null);
  const [showTruthTable, setShowTruthTable] = useState(false);
  const [pendingAction, setPendingAction] = useState<"new" | null>(null);

  const importInputRef = useRef<HTMLInputElement>(null);

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

  // New Module with unsaved changes check
  const handleNewModule = useCallback(() => {
    if (isDirty) {
      setPendingAction("new");
      return;
    }
    setDialogMode("new");
  }, [isDirty]);

  const handleUnsavedSave = useCallback(() => {
    const result = saveCurrentModule();
    setPendingAction(null);
    if (result.success) {
      setDialogMode("new");
    } else {
      showToast("error", result.errors.join(" "));
    }
  }, [saveCurrentModule, showToast]);

  const handleUnsavedDiscard = useCallback(() => {
    setPendingAction(null);
    setDialogMode("new");
  }, []);

  const handleUnsavedCancel = useCallback(() => {
    setPendingAction(null);
  }, []);

  // Export
  const handleExport = useCallback(() => {
    exportToJson(modules);
  }, [modules]);

  // Import
  const handleImportClick = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { modules: imported, library } = await importFromJson(file);
      useModuleStore.setState({ modules: imported });
      // Restore library tree or auto-generate flat tree
      if (library) {
        useLibraryStore.setState({ tree: library });
      } else {
        useLibraryStore.setState({
          tree: imported.map((m) => ({ type: "module" as const, moduleId: m.id })),
        });
      }
      clearCanvas();
      setActiveModuleId(null);
      showToast("success", `Imported ${imported.length} modules.`);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Import failed.");
    }

    // Reset input so the same file can be selected again
    e.target.value = "";
  }, [clearCanvas, setActiveModuleId, showToast]);

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

        {truthTableGenerating && (
          <span className="ml-2 flex items-center gap-1 text-[10px] text-zinc-500">
            <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-zinc-500 border-t-zinc-300" />
            TT
          </span>
        )}

        <div className="ml-4 flex gap-1">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z)"
          >
            Undo
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Redo (Ctrl+Shift+Z)"
          >
            Redo
          </button>
        </div>

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setShowTruthTable(true)}
            className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-600"
          >
            Truth Table
          </button>
          <button
            onClick={handleExport}
            className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-600"
          >
            Export
          </button>
          <button
            onClick={handleImportClick}
            className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-600"
          >
            Import
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            onClick={handleNewModule}
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

      <TruthTableView open={showTruthTable} onClose={() => setShowTruthTable(false)} defaultModuleId={activeModuleId ?? undefined} />

      <UnsavedChangesDialog
        open={pendingAction !== null}
        canSave={activeModuleId !== null}
        onSave={handleUnsavedSave}
        onDiscard={handleUnsavedDiscard}
        onCancel={handleUnsavedCancel}
      />

      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 rounded px-4 py-2 text-xs text-white shadow-lg ${toastColor}`}>
          {toast.message}
        </div>
      )}
    </>
  );
}
