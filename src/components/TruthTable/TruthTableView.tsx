import { useState, useMemo, useEffect, useCallback } from "react";
import { useModuleStore } from "../../store/module-store.ts";
import { BUILTIN_NAND_MODULE_ID } from "../../engine/simulate.ts";
import { generateTruthTable } from "../../engine/truth-table.ts";
import type { Module, TruthTable } from "../../engine/types.ts";

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
}

export function TruthTableView({ open, onClose }: TruthTableViewProps) {
  const modules = useModuleStore((s) => s.modules);
  const allModules: Module[] = [NAND_MODULE, ...modules];

  const [selectedId, setSelectedId] = useState<string>(BUILTIN_NAND_MODULE_ID);
  const [page, setPage] = useState(0);

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

  const { truthTable, tooManyInputs } = useMemo(() => {
    if (!selectedModule) return { truthTable: null, tooManyInputs: false };

    // NAND special case
    if (selectedModule.id === BUILTIN_NAND_MODULE_ID) {
      return { truthTable: NAND_TRUTH_TABLE, tooManyInputs: false };
    }

    // Module already has truth table
    if (selectedModule.truthTable) {
      return { truthTable: selectedModule.truthTable, tooManyInputs: false };
    }

    // Too many inputs
    if (selectedModule.inputs.length > 16) {
      return { truthTable: null, tooManyInputs: true };
    }

    // Generate on-demand
    const generated = generateTruthTable(selectedModule.circuit, modules);
    return { truthTable: generated, tooManyInputs: false };
  }, [selectedModule, modules]);

  if (!open) return null;

  // Map pin IDs to display names
  const inputHeaders = truthTable?.inputNames.map((pinId) => {
    if (!selectedModule) return pinId;
    const pin = selectedModule.inputs.find((p) => p.id === pinId);
    return pin?.name ?? pinId;
  }) ?? [];

  const outputHeaders = truthTable?.outputNames.map((pinId) => {
    if (!selectedModule) return pinId;
    const pin = selectedModule.outputs.find((p) => p.id === pinId);
    return pin?.name ?? pinId;
  }) ?? [];

  // Build rows
  const allRows = truthTable
    ? Object.entries(truthTable.rows).map(([inputKey, outputValue]) => ({
        inputs: inputKey.split(""),
        outputs: outputValue.split(""),
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

        {truthTable && (
          <div className="overflow-auto flex-1">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-600">
                  {inputHeaders.map((name, i) => (
                    <th
                      key={`in-${i}`}
                      className="px-3 py-1.5 text-center font-semibold text-zinc-300"
                    >
                      {name}
                    </th>
                  ))}
                  {outputHeaders.map((name, i) => (
                    <th
                      key={`out-${i}`}
                      className={`px-3 py-1.5 text-center font-semibold text-zinc-300 ${i === 0 ? "border-l border-zinc-600" : ""}`}
                    >
                      {name}
                    </th>
                  ))}
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
