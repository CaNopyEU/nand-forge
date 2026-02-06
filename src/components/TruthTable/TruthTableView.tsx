import { useState, useEffect, useCallback } from "react";
import { useModuleStore } from "../../store/module-store.ts";
import { BUILTIN_NAND_MODULE_ID } from "../../engine/simulate.ts";
import { generateTruthTableAsync } from "../../engine/truth-table.ts";
import type { Module, TruthTable } from "../../engine/types.ts";
import { DraggableHeader } from "./DraggableHeader.tsx";

const ROWS_PER_PAGE = 64;

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

const NAND_TRUTH_TABLE: TruthTable = {
  inputNames: ["a", "b"],
  outputNames: ["out"],
  rows: { "00": "1", "01": "1", "10": "1", "11": "0" },
};

interface TruthTableViewProps {
  open: boolean;
  onClose: () => void;
  defaultModuleId?: string;
}

export function TruthTableView({ open, onClose, defaultModuleId }: TruthTableViewProps) {
  const modules = useModuleStore((s) => s.modules);
  const truthTableGenerating = useModuleStore((s) => s.truthTableGenerating);
  const reorderPins = useModuleStore((s) => s.reorderPins);
  const allModules: Module[] = [NAND_MODULE, ...modules];

  const [selectedId, setSelectedId] = useState<string>(BUILTIN_NAND_MODULE_ID);
  const [page, setPage] = useState(0);
  const [prevOpen, setPrevOpen] = useState(false);
  const [asyncTruthTable, setAsyncTruthTable] = useState<TruthTable | null>(null);
  const [computing, setComputing] = useState(false);

  // When dialog opens, select the default module
  if (open && !prevOpen) {
    const targetId = defaultModuleId && allModules.some((m) => m.id === defaultModuleId)
      ? defaultModuleId
      : BUILTIN_NAND_MODULE_ID;
    if (selectedId !== targetId) setSelectedId(targetId);
    if (page !== 0) setPage(0);
  }
  if (open !== prevOpen) setPrevOpen(open);

  // Reset page when module changes
  useEffect(() => {
    setPage(0);
  }, [selectedId]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  const selectedModule = allModules.find((m) => m.id === selectedId);

  // Resolve truth table: cached, NAND hardcoded, or async on-demand
  const isNand = selectedModule?.id === BUILTIN_NAND_MODULE_ID;
  const tooManyInputs = selectedModule ? selectedModule.inputs.length > 16 && !isNand : false;
  const cachedTruthTable = isNand
    ? NAND_TRUTH_TABLE
    : selectedModule?.truthTable ?? null;

  // Async on-demand generation when no cached TT available
  useEffect(() => {
    if (!open || !selectedModule || isNand || tooManyInputs || cachedTruthTable) {
      setAsyncTruthTable(null);
      setComputing(false);
      return;
    }

    let cancelled = false;
    setComputing(true);
    setAsyncTruthTable(null);

    generateTruthTableAsync(selectedModule.circuit, modules).then((tt) => {
      if (!cancelled) {
        setAsyncTruthTable(tt);
        setComputing(false);
      }
    });

    return () => { cancelled = true; };
  }, [open, selectedModule, isNand, tooManyInputs, cachedTruthTable, modules]);

  const truthTable = cachedTruthTable ?? asyncTruthTable;
  const isLoading = computing || (truthTableGenerating && !truthTable && selectedModule && !isNand && !tooManyInputs);

  const canReorder = selectedModule && !isNand && selectedModule.id !== BUILTIN_NAND_MODULE_ID;

  // Build display order from module's inputs/outputs (user-sorted),
  // mapping to truth table's inputNames/outputNames (circuit order).
  // This ensures columns display in the user's chosen order while
  // correctly remapping each row's bit positions.
  const displayInputIds = canReorder && selectedModule
    ? selectedModule.inputs.map((p) => p.id)
    : truthTable?.inputNames ?? [];
  const displayOutputIds = canReorder && selectedModule
    ? selectedModule.outputs.map((p) => p.id)
    : truthTable?.outputNames ?? [];

  // Index mapping: displayIndex → truthTable data index
  const inputIndexMap = truthTable
    ? displayInputIds.map((id) => truthTable.inputNames.indexOf(id))
    : [];
  const outputIndexMap = truthTable
    ? displayOutputIds.map((id) => truthTable.outputNames.indexOf(id))
    : [];

  const handleReorderInputs = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!selectedModule) return;
      const ids = [...displayInputIds];
      const [moved] = ids.splice(fromIndex, 1);
      ids.splice(toIndex, 0, moved!);
      reorderPins(selectedModule.id, "input", ids);
    },
    [selectedModule, displayInputIds, reorderPins],
  );

  const handleReorderOutputs = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!selectedModule) return;
      const ids = [...displayOutputIds];
      const [moved] = ids.splice(fromIndex, 1);
      ids.splice(toIndex, 0, moved!);
      reorderPins(selectedModule.id, "output", ids);
    },
    [selectedModule, displayOutputIds, reorderPins],
  );

  if (!open) return null;

  // Map pin IDs to display names (in display order)
  const inputHeaders = displayInputIds.map((pinId) => {
    if (!selectedModule) return pinId;
    const pin = selectedModule.inputs.find((p) => p.id === pinId);
    return pin?.name ?? pinId;
  });

  const outputHeaders = displayOutputIds.map((pinId) => {
    if (!selectedModule) return pinId;
    const pin = selectedModule.outputs.find((p) => p.id === pinId);
    return pin?.name ?? pinId;
  });

  // Build rows with remapped bit positions
  const allRows = truthTable
    ? Object.entries(truthTable.rows).map(([inputKey, outputValue]) => ({
        inputs: inputIndexMap.map((i) => (i >= 0 ? inputKey[i] ?? "0" : "0")),
        outputs: outputIndexMap.map((i) => (i >= 0 ? outputValue[i] ?? "0" : "0")),
      }))
    : [];

  const totalPages = Math.max(1, Math.ceil(allRows.length / ROWS_PER_PAGE));
  const currentPage = Math.min(page, totalPages - 1);
  const visibleRows = allRows.slice(
    currentPage * ROWS_PER_PAGE,
    (currentPage + 1) * ROWS_PER_PAGE,
  );
  const needsPagination = allRows.length > ROWS_PER_PAGE;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleOverlayClick}
    >
      <div className="max-h-[80vh] w-auto min-w-80 max-w-[90vw] overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800 p-4 shadow-xl flex flex-col">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-100">Truth Table</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 text-lg leading-none px-1"
          >
            &times;
          </button>
        </div>

        {/* Module selector */}
        <div className="mb-3 flex items-center gap-2">
          <label className="text-xs text-zinc-400">Module:</label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-blue-500"
          >
            {allModules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Content */}
        {tooManyInputs && selectedModule && (
          <p className="text-xs text-zinc-400">
            Too many inputs ({selectedModule.inputs.length}) — truth table requires ≤ 16 inputs
          </p>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-500 border-t-zinc-200" />
            <span className="ml-2 text-xs text-zinc-400">Generating truth table...</span>
          </div>
        )}

        {truthTable && (
          <div className="overflow-auto flex-1">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-600">
                  {inputHeaders.map((name, i) =>
                    canReorder ? (
                      <DraggableHeader
                        key={`in-${i}`}
                        index={i}
                        name={name}
                        direction="input"
                        isFirstOutput={false}
                        onReorder={handleReorderInputs}
                      />
                    ) : (
                      <th
                        key={`in-${i}`}
                        className="px-3 py-1.5 text-center font-semibold text-zinc-300"
                      >
                        {name}
                      </th>
                    ),
                  )}
                  {outputHeaders.map((name, i) =>
                    canReorder ? (
                      <DraggableHeader
                        key={`out-${i}`}
                        index={i}
                        name={name}
                        direction="output"
                        isFirstOutput={i === 0}
                        onReorder={handleReorderOutputs}
                      />
                    ) : (
                      <th
                        key={`out-${i}`}
                        className={`px-3 py-1.5 text-center font-semibold text-zinc-300 ${i === 0 ? "border-l border-zinc-600" : ""}`}
                      >
                        {name}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, ri) => (
                  <tr
                    key={ri}
                    className={ri % 2 === 1 ? "bg-zinc-700/30" : ""}
                  >
                    {row.inputs.map((bit, i) => (
                      <td
                        key={`in-${i}`}
                        className={`px-3 py-1 text-center ${bit === "1" ? "text-emerald-400 font-bold" : "text-zinc-500"}`}
                      >
                        {bit}
                      </td>
                    ))}
                    {row.outputs.map((bit, i) => (
                      <td
                        key={`out-${i}`}
                        className={`px-3 py-1 text-center ${i === 0 ? "border-l border-zinc-600" : ""} ${bit === "1" ? "text-emerald-400 font-bold" : "text-zinc-500"}`}
                      >
                        {bit}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {needsPagination && (
          <div className="mt-3 flex items-center justify-center gap-3 text-xs text-zinc-400">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="px-1 hover:text-zinc-200 disabled:opacity-30 disabled:hover:text-zinc-400"
            >
              ◀
            </button>
            <span>
              Page {currentPage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              className="px-1 hover:text-zinc-200 disabled:opacity-30 disabled:hover:text-zinc-400"
            >
              ▶
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
