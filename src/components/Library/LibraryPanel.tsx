import { useState } from "react";
import { useModuleStore, getModulesDependingOn } from "../../store/module-store.ts";
import { useCircuitStore } from "../../store/circuit-store.ts";
import { BUILTIN_NAND_MODULE_ID } from "../../engine/simulate.ts";
import { circuitNodesToAppNodes, circuitEdgesToRFEdges } from "../../utils/circuit-converters.ts";
import type { Module } from "../../engine/types.ts";
import { ModuleCard } from "./ModuleCard.tsx";
import { SaveWarningDialog } from "../SaveModule/SaveWarningDialog.tsx";

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
  const setActiveModuleId = useCircuitStore((s) => s.setActiveModuleId);
  const loadCircuit = useCircuitStore((s) => s.loadCircuit);

  const [deleteTarget, setDeleteTarget] = useState<{ module: Module; dependents: Module[] } | null>(null);

  const handleOpen = (moduleId: string) => {
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;

    setActiveModuleId(moduleId);

    const appNodes = circuitNodesToAppNodes(mod.circuit.nodes, modules);
    const rfEdges = circuitEdgesToRFEdges(mod.circuit.edges);
    loadCircuit(appNodes, rfEdges);
  };

  const handleDelete = (moduleId: string) => {
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;

    const dependents = getModulesDependingOn(moduleId, modules);

    if (dependents.length === 0) {
      // No dependents — delete silently
      executeModuleDelete(moduleId);
      return;
    }

    // Has dependents — show warning
    setDeleteTarget({ module: mod, dependents });
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    executeModuleDelete(deleteTarget.module.id);
    setDeleteTarget(null);
  };

  return (
    <>
      <div className="flex w-44 flex-col border-r border-zinc-700 p-2">
        <span className="text-xs font-semibold text-zinc-400">Library</span>
        <div className="mt-2 flex flex-col gap-1">
          <ModuleCard module={NAND_MODULE} onOpen={() => {}} />
          {modules.map((mod) => (
            <ModuleCard key={mod.id} module={mod} onOpen={handleOpen} onDelete={handleDelete} />
          ))}
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
    </>
  );
}
