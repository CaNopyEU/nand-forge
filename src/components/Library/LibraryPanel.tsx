import { useState, useCallback, useMemo, useEffect } from "react";
import { useModuleStore, getModulesDependingOn } from "../../store/module-store.ts";
import { useCircuitStore } from "../../store/circuit-store.ts";
import { useLibraryStore } from "../../store/library-store.ts";
import { BUILTIN_NAND_MODULE_ID } from "../../engine/simulate.ts";
import { circuitNodesToAppNodes, circuitEdgesToRFEdges } from "../../utils/circuit-converters.ts";
import { getForbiddenModuleIds } from "../../engine/validate.ts";
import type { Module } from "../../engine/types.ts";
import { ModuleCard } from "./ModuleCard.tsx";
import { LibraryTree } from "./LibraryTree.tsx";
import { SaveWarningDialog } from "../SaveModule/SaveWarningDialog.tsx";
import { UnsavedChangesDialog } from "../UnsavedChangesDialog.tsx";

const NAND_MODULE: Module = {
  id: BUILTIN_NAND_MODULE_ID,
  name: "NAND",
  inputs: [
    { id: "a", name: "A", direction: "input", bits: 1 },
    { id: "b", name: "B", direction: "input", bits: 1 },
  ],
  outputs: [
    { id: "out", name: "Out", direction: "output", bits: 1 },
  ],
  circuit: { id: "builtin", name: "NAND", nodes: [], edges: [] },
  createdAt: "",
  updatedAt: "",
};

export function LibraryPanel() {
  const modules = useModuleStore((s) => s.modules);
  const executeModuleDelete = useModuleStore((s) => s.executeModuleDelete);
  const saveCurrentModule = useModuleStore((s) => s.saveCurrentModule);
  const activeModuleId = useCircuitStore((s) => s.activeModuleId);
  const isDirty = useCircuitStore((s) => s.isDirty);
  const setActiveModuleId = useCircuitStore((s) => s.setActiveModuleId);
  const loadCircuit = useCircuitStore((s) => s.loadCircuit);
  const addFolder = useLibraryStore((s) => s.addFolder);
  const syncModules = useLibraryStore((s) => s.syncModules);
  const moveModuleToFolder = useLibraryStore((s) => s.moveModuleToFolder);
  const locked = useLibraryStore((s) => s.locked);
  const toggleLock = useLibraryStore((s) => s.toggleLock);

  const [deleteTarget, setDeleteTarget] = useState<{ module: Module; dependents: Module[] } | null>(null);
  const [pendingOpenId, setPendingOpenId] = useState<string | null>(null);

  const forbiddenIds = useMemo(
    () => activeModuleId ? getForbiddenModuleIds(activeModuleId, modules) : new Set<string>(),
    [activeModuleId, modules],
  );

  // Sync library tree when modules change
  useEffect(() => {
    const moduleIds = new Set(modules.map((m) => m.id));
    syncModules(moduleIds);
  }, [modules, syncModules]);

  const executeOpen = useCallback((moduleId: string) => {
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;

    setActiveModuleId(moduleId);

    const appNodes = circuitNodesToAppNodes(mod.circuit.nodes, modules);
    const rfEdges = circuitEdgesToRFEdges(mod.circuit.edges);
    loadCircuit(appNodes, rfEdges);
  }, [modules, setActiveModuleId, loadCircuit]);

  const handleOpen = useCallback((moduleId: string) => {
    if (isDirty) {
      setPendingOpenId(moduleId);
      return;
    }
    executeOpen(moduleId);
  }, [isDirty, executeOpen]);

  const handleUnsavedSave = useCallback(() => {
    const result = saveCurrentModule();
    const targetId = pendingOpenId;
    setPendingOpenId(null);
    if (result.success && targetId) {
      executeOpen(targetId);
    }
  }, [saveCurrentModule, pendingOpenId, executeOpen]);

  const handleUnsavedDiscard = useCallback(() => {
    const targetId = pendingOpenId;
    setPendingOpenId(null);
    if (targetId) {
      executeOpen(targetId);
    }
  }, [pendingOpenId, executeOpen]);

  const handleUnsavedCancel = useCallback(() => {
    setPendingOpenId(null);
  }, []);

  const handleDelete = (moduleId: string) => {
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;

    const dependents = getModulesDependingOn(moduleId, modules);

    if (dependents.length === 0) {
      executeModuleDelete(moduleId);
      return;
    }

    setDeleteTarget({ module: mod, dependents });
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    executeModuleDelete(deleteTarget.module.id);
    setDeleteTarget(null);
  };

  const handleReorder = useCallback(
    (moduleId: string, targetFolderId: string | null, insertIndex: number) => {
      moveModuleToFolder(moduleId, targetFolderId, insertIndex);
    },
    [moveModuleToFolder],
  );

  const handleAddFolder = useCallback(() => {
    addFolder(null, "New Folder");
  }, [addFolder]);

  const [rootDragOver, setRootDragOver] = useState(false);

  const handleRootDragOver = useCallback((e: React.DragEvent) => {
    if (locked) return;
    if (e.dataTransfer.types.includes("application/nandforge-library-item")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setRootDragOver(true);
    }
  }, [locked]);

  const handleRootDragLeave = useCallback(() => {
    setRootDragOver(false);
  }, []);

  const handleRootDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setRootDragOver(false);
      const moduleId = e.dataTransfer.getData("application/nandforge-library-item");
      if (moduleId) {
        moveModuleToFolder(moduleId, null);
      }
    },
    [moveModuleToFolder],
  );

  return (
    <>
      <div className="flex w-44 flex-col border-r border-zinc-700 p-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-400">Library</span>
          <div className="flex gap-1">
            <button
              onClick={toggleLock}
              className={`rounded px-1 text-[10px] ${locked ? "text-amber-400" : "text-zinc-500 hover:text-zinc-300"}`}
              title={locked ? "Unlock library (enable D&D reordering)" : "Lock library (prevent D&D reordering)"}
            >
              {locked ? "\u{1F512}" : "\u{1F513}"}
            </button>
            <button
              onClick={handleAddFolder}
              className="rounded px-1 text-[10px] text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
              title="Add folder"
            >
              + Folder
            </button>
          </div>
        </div>
        <div
          className={`mt-2 flex flex-1 flex-col gap-1 overflow-y-auto ${rootDragOver ? "bg-blue-900/20 rounded" : ""}`}
          onDragOver={handleRootDragOver}
          onDragLeave={handleRootDragLeave}
          onDrop={handleRootDrop}
        >
          <ModuleCard module={NAND_MODULE} onOpen={() => {}} />
          <LibraryTree
            onOpen={handleOpen}
            onDelete={handleDelete}
            forbiddenIds={forbiddenIds}
            onReorder={handleReorder}
          />
        </div>
      </div>

      <SaveWarningDialog
        open={deleteTarget !== null}
        title="Delete module?"
        message={`"${deleteTarget?.module.name ?? ""}" is used by other modules. Deleting it will remove all its instances and disconnect their wires.`}
        removedPins={[]}
        affectedModules={deleteTarget?.dependents ?? []}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      <UnsavedChangesDialog
        open={pendingOpenId !== null}
        canSave={activeModuleId !== null}
        onSave={handleUnsavedSave}
        onDiscard={handleUnsavedDiscard}
        onCancel={handleUnsavedCancel}
      />
    </>
  );
}
