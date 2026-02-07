import { useState, useEffect, useCallback, useRef } from "react";
import { useCircuitStore } from "../../store/circuit-store.ts";
import { useSimulationStore } from "../../store/simulation-store.ts";
import { useModuleStore, getModuleById, type SaveAnalysis } from "../../store/module-store.ts";
import { useLibraryStore } from "../../store/library-store.ts";
import { useToastStore } from "../../store/toast-store.ts";
import { generateId } from "../../utils/id.ts";
import type { Module } from "../../engine/types.ts";
import { NewModuleDialog } from "./NewModuleDialog.tsx";
import { SaveWarningDialog } from "../SaveModule/SaveWarningDialog.tsx";
import { TimingDiagramView } from "../TimingDiagram/TimingDiagramView.tsx";
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
  const undo = useCircuitStore((s) => s.undo);
  const redo = useCircuitStore((s) => s.redo);
  const canUndo = useCircuitStore((s) => s.past.length > 0);
  const canRedo = useCircuitStore((s) => s.future.length > 0);

  const running = useSimulationStore((s) => s.running);
  const tickRate = useSimulationStore((s) => s.tickRate);
  const play = useSimulationStore((s) => s.play);
  const pause = useSimulationStore((s) => s.pause);
  const step = useSimulationStore((s) => s.step);
  const setTickRate = useSimulationStore((s) => s.setTickRate);

  const showToast = useToastStore((s) => s.showToast);

  // "new" = New Module (clears canvas), "save" = Save prompt (keeps canvas)
  const [dialogMode, setDialogMode] = useState<"new" | "save" | null>(null);
  const [saveAnalysis, setSaveAnalysis] = useState<SaveAnalysis | null>(null);
  const [showTimingDiagram, setShowTimingDiagram] = useState(false);
  const [pendingAction, setPendingAction] = useState<"new" | null>(null);

  const importInputRef = useRef<HTMLInputElement>(null);

  // Resolve active module name
  const activeModule = activeModuleId ? getModuleById(activeModuleId) : undefined;

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

        <div className="ml-4 flex items-center gap-1 border-l border-zinc-600 pl-4">
          <button
            onClick={running ? pause : play}
            className={`rounded px-2 py-1 text-xs font-medium ${
              running
                ? "bg-amber-600 text-white hover:bg-amber-500"
                : "bg-emerald-600 text-white hover:bg-emerald-500"
            }`}
          >
            {running ? "Pause" : "Play"}
          </button>
          <button
            onClick={step}
            disabled={running}
            className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Single tick"
          >
            Step
          </button>
          <select
            value={tickRate}
            onChange={(e) => setTickRate(Number(e.target.value))}
            className="rounded bg-zinc-700 px-1 py-1 text-xs text-zinc-200 outline-none"
            title="Tick rate (Hz)"
          >
            <option value={1}>1 Hz</option>
            <option value={2}>2 Hz</option>
            <option value={5}>5 Hz</option>
            <option value={10}>10 Hz</option>
            <option value={25}>25 Hz</option>
          </select>
        </div>

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setShowTimingDiagram(true)}
            className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-600"
          >
            Timing
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

      <TimingDiagramView open={showTimingDiagram} onClose={() => setShowTimingDiagram(false)} />

      <UnsavedChangesDialog
        open={pendingAction !== null}
        canSave={activeModuleId !== null}
        onSave={handleUnsavedSave}
        onDiscard={handleUnsavedDiscard}
        onCancel={handleUnsavedCancel}
      />
    </>
  );
}
