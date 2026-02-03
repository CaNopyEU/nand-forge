import { useModuleStore } from "../../store/module-store.ts";
import { useCircuitStore } from "../../store/circuit-store.ts";
import { BUILTIN_NAND_MODULE_ID } from "../../engine/simulate.ts";
import { circuitNodesToAppNodes, circuitEdgesToRFEdges } from "../../utils/circuit-converters.ts";
import type { Module } from "../../engine/types.ts";
import { ModuleCard } from "./ModuleCard.tsx";

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
  const setActiveModuleId = useCircuitStore((s) => s.setActiveModuleId);
  const loadCircuit = useCircuitStore((s) => s.loadCircuit);

  const handleOpen = (moduleId: string) => {
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;

    setActiveModuleId(moduleId);

    const appNodes = circuitNodesToAppNodes(mod.circuit.nodes, modules);
    const rfEdges = circuitEdgesToRFEdges(mod.circuit.edges);
    loadCircuit(appNodes, rfEdges);
  };

  return (
    <div className="flex w-44 flex-col border-r border-zinc-700 p-2">
      <span className="text-xs font-semibold text-zinc-400">Library</span>
      <div className="mt-2 flex flex-col gap-1">
        <ModuleCard module={NAND_MODULE} onOpen={() => {}} />
        {modules.map((mod) => (
          <ModuleCard key={mod.id} module={mod} onOpen={handleOpen} />
        ))}
      </div>
    </div>
  );
}
