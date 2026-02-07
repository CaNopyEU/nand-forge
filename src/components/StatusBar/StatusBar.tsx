import { useCircuitStore } from "../../store/circuit-store.ts";
import { getModuleById } from "../../store/module-store.ts";

export function StatusBar() {
  const nodeCount = useCircuitStore((s) => s.nodes.length);
  const edgeCount = useCircuitStore((s) => s.edges.length);
  const activeModuleId = useCircuitStore((s) => s.activeModuleId);

  const moduleName = activeModuleId
    ? getModuleById(activeModuleId)?.name
    : undefined;

  return (
    <div className="flex h-6 items-center border-t border-zinc-700 px-4 text-[10px] text-zinc-500">
      <span>{nodeCount} nodes</span>
      <span className="mx-1.5">&middot;</span>
      <span>{edgeCount} wires</span>
      {moduleName && (
        <>
          <span className="mx-1.5">&middot;</span>
          <span>{moduleName}</span>
        </>
      )}
    </div>
  );
}
