import { useRef, useCallback } from "react";
import { useCircuitStore } from "../../store/circuit-store.ts";
import { useSimulationStore } from "../../store/simulation-store.ts";

interface RamViewerDialogProps {
  nodeId: string;
  addressBits: 4 | 8;
  initialData: number[];
  currentAddrSignal: number;
  onClose: () => void;
}

export function RamViewerDialog({
  nodeId,
  addressBits,
  initialData,
  currentAddrSignal,
  onClose,
}: RamViewerDialogProps) {
  const setRamInitialData = useCircuitStore((s) => s.setRamInitialData);
  const ramState = useSimulationStore((s) => s.ramStates[nodeId]);
  const clearInstanceState = useSimulationStore((s) => s.clearRamState);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const size = 1 << addressBits;
  const addrDigits = Math.ceil(addressBits / 4);

  // Live data: prefer runtime state, fall back to initialData
  const liveData = ramState?.data ?? initialData;
  const lastWriteAddr = ramState?.lastWriteAddr ?? null;
  const currentAddr = currentAddrSignal & (size - 1);

  const handleExportCurrent = useCallback(() => {
    const lines = liveData.map((v) => (v ?? 0).toString(16).toUpperCase().padStart(2, "0"));
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ram-${nodeId.slice(0, 6)}.hex`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodeId, liveData]);

  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#") && !l.startsWith(";"));
      const next = new Array(size).fill(0) as number[];
      for (let i = 0; i < Math.min(lines.length, size); i++) {
        const val = parseInt(lines[i]!, 16);
        next[i] = isNaN(val) ? 0 : Math.min(255, Math.max(0, val));
      }
      setRamInitialData(nodeId, next);
      // Also inject immediately into runtime state
      clearInstanceState(nodeId, next);
      e.target.value = "";
    },
    [nodeId, size, setRamInitialData, clearInstanceState],
  );

  const handleReset = useCallback(() => {
    clearInstanceState(nodeId, initialData);
  }, [nodeId, initialData, clearInstanceState]);

  const handleClearAll = useCallback(() => {
    const zeros = new Array(size).fill(0) as number[];
    setRamInitialData(nodeId, zeros);
    clearInstanceState(nodeId, zeros);
  }, [nodeId, size, setRamInitialData, clearInstanceState]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex max-h-[80vh] w-[460px] flex-col rounded-lg border border-zinc-600 bg-zinc-900 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-3">
          <span className="text-sm font-semibold text-emerald-300">
            RAM Viewer — {addressBits}-bit addr ({size} entries × 8-bit)
          </span>
          <button
            className="rounded px-2 py-0.5 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Legend */}
        <div className="flex gap-3 border-b border-zinc-700 px-4 py-1.5 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-blue-800" /> Current addr
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-yellow-700" /> Last write
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-emerald-900" /> Non-zero
          </span>
        </div>

        {/* Toolbar */}
        <div className="flex gap-2 border-b border-zinc-700 px-4 py-2">
          <button
            className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-600"
            onClick={() => fileInputRef.current?.click()}
          >
            Import .hex
          </button>
          <button
            className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-600"
            onClick={handleExportCurrent}
          >
            Export current
          </button>
          <button
            className="rounded bg-zinc-700 px-2 py-1 text-xs text-emerald-400 hover:bg-zinc-600"
            onClick={handleReset}
            title="Reset to initial data (loaded from file)"
          >
            Reset
          </button>
          <button
            className="rounded bg-zinc-700 px-2 py-1 text-xs text-red-400 hover:bg-zinc-600"
            onClick={handleClearAll}
          >
            Clear all
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".hex,.txt"
            className="hidden"
            onChange={handleImport}
          />
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-zinc-800">
              <tr>
                <th className="w-20 px-3 py-1.5 text-left font-medium text-zinc-400">Addr</th>
                <th className="px-3 py-1.5 text-left font-medium text-zinc-400">Hex</th>
                <th className="px-3 py-1.5 text-left font-medium text-zinc-400">Bin</th>
                <th className="px-3 py-1.5 text-left font-medium text-zinc-400">Dec</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: size }, (_, i) => {
                const val = liveData[i] ?? 0;
                const isCurrentAddr = i === currentAddr;
                const isLastWrite = lastWriteAddr !== null && i === lastWriteAddr;
                const isNonZero = val !== 0;
                let rowBg = "";
                if (isLastWrite) rowBg = "bg-yellow-700/30";
                else if (isCurrentAddr) rowBg = "bg-blue-800/30";
                else if (isNonZero) rowBg = "bg-emerald-900/20";
                return (
                  <tr key={i} className={`border-t border-zinc-800 ${rowBg}`}>
                    <td className="px-3 py-1 font-mono">
                      <span className={isCurrentAddr ? "text-blue-400" : "text-zinc-500"}>
                        0x{i.toString(16).toUpperCase().padStart(addrDigits, "0")}
                      </span>
                    </td>
                    <td className={`px-3 py-1 font-mono font-bold ${isLastWrite ? "text-yellow-300" : isNonZero ? "text-emerald-300" : "text-zinc-600"}`}>
                      {val.toString(16).toUpperCase().padStart(2, "0")}
                    </td>
                    <td className="px-3 py-1 font-mono text-zinc-500">
                      {val.toString(2).padStart(8, "0")}
                    </td>
                    <td className={`px-3 py-1 font-mono ${isNonZero ? "text-zinc-300" : "text-zinc-600"}`}>
                      {val}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-700 px-4 py-2 text-right">
          <button
            className="rounded bg-emerald-700 px-3 py-1.5 text-xs text-white hover:bg-emerald-600"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
