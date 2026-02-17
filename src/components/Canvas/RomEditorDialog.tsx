import { useRef, useCallback } from "react";
import { useCircuitStore } from "../../store/circuit-store.ts";

interface RomEditorDialogProps {
  nodeId: string;
  addressBits: 4 | 8;
  romData: number[];
  onClose: () => void;
}

export function RomEditorDialog({ nodeId, addressBits, romData, onClose }: RomEditorDialogProps) {
  const setRomData = useCircuitStore((s) => s.setRomData);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const size = 1 << addressBits;
  const addrDigits = Math.ceil(addressBits / 4);

  const handleCellChange = useCallback(
    (index: number, raw: string) => {
      const val = parseInt(raw, 16);
      const next = [...romData];
      next[index] = isNaN(val) ? 0 : Math.min(255, Math.max(0, val));
      setRomData(nodeId, next);
    },
    [nodeId, romData, setRomData],
  );

  const handleExport = useCallback(() => {
    const lines = romData.map((v) => (v ?? 0).toString(16).toUpperCase().padStart(2, "0"));
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rom-${nodeId.slice(0, 6)}.hex`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodeId, romData]);

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
      setRomData(nodeId, next);
      e.target.value = "";
    },
    [nodeId, size, setRomData],
  );

  const handleClearAll = useCallback(() => {
    setRomData(nodeId, new Array(size).fill(0) as number[]);
  }, [nodeId, size, setRomData]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex max-h-[80vh] w-[420px] flex-col rounded-lg border border-zinc-600 bg-zinc-900 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-3">
          <span className="text-sm font-semibold text-purple-300">
            ROM Editor — {addressBits}-bit addr ({size} entries × 8-bit)
          </span>
          <button
            className="rounded px-2 py-0.5 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            onClick={onClose}
          >
            ✕
          </button>
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
            onClick={handleExport}
          >
            Export .hex
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
                const val = romData[i] ?? 0;
                const isNonZero = val !== 0;
                return (
                  <tr
                    key={i}
                    className={`border-t border-zinc-800 ${isNonZero ? "bg-purple-900/20" : ""}`}
                  >
                    <td className="px-3 py-1 font-mono text-zinc-500">
                      0x{i.toString(16).toUpperCase().padStart(addrDigits, "0")}
                    </td>
                    <td className="px-3 py-1">
                      <input
                        className="w-14 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-200 outline-none focus:ring-1 focus:ring-purple-500"
                        maxLength={2}
                        defaultValue={val.toString(16).toUpperCase().padStart(2, "0")}
                        key={`${i}-${val}`}
                        onBlur={(e) => handleCellChange(i, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleCellChange(i, (e.target as HTMLInputElement).value);
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                      />
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
            className="rounded bg-purple-700 px-3 py-1.5 text-xs text-white hover:bg-purple-600"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
