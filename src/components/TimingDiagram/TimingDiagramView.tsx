import { useState, useEffect, useCallback, useRef } from "react";
import { useSimulationStore } from "../../store/simulation-store.ts";
import { useCircuitStore, type AppNode } from "../../store/circuit-store.ts";

const TICK_WIDTH = 24;
const ROW_HEIGHT = 32;
const LABEL_WIDTH = 100;

interface Signal {
  key: string;
  label: string;
}

function getAvailableSignals(nodes: AppNode[]): Signal[] {
  const signals: Signal[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "circuitInput":
        signals.push({
          key: `${node.id}:${node.data.pinId}`,
          label: node.data.label,
        });
        break;
      case "circuitOutput":
        signals.push({
          key: `${node.id}:${node.data.pinId}`,
          label: node.data.label,
        });
        break;
      case "clock":
        signals.push({
          key: `${node.id}:${node.data.pinId}`,
          label: "CLK",
        });
        break;
      case "probe":
        signals.push({
          key: `${node.id}:${node.data.pinId}`,
          label: `Probe`,
        });
        break;
    }
  }
  return signals;
}

interface TimingDiagramViewProps {
  open: boolean;
  onClose: () => void;
}

export function TimingDiagramView({ open, onClose }: TimingDiagramViewProps) {
  const nodes = useCircuitStore((s) => s.nodes);
  const signalHistory = useSimulationStore((s) => s.signalHistory);
  const recording = useSimulationStore((s) => s.recording);
  const toggleRecording = useSimulationStore((s) => s.toggleRecording);
  const clearHistory = useSimulationStore((s) => s.clearHistory);

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [prevOpen, setPrevOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const availableSignals = getAvailableSignals(nodes);

  // Auto-select all signals when dialog opens
  if (open && !prevOpen) {
    const allKeys = new Set(availableSignals.map((s) => s.key));
    if (
      allKeys.size !== selectedKeys.size ||
      [...allKeys].some((k) => !selectedKeys.has(k))
    ) {
      setSelectedKeys(allKeys);
    }
  }
  if (open !== prevOpen) setPrevOpen(open);

  // Auto-scroll to right when new data arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [signalHistory.length]);

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

  const toggleSignal = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  if (!open) return null;

  const selectedSignals = availableSignals.filter((s) =>
    selectedKeys.has(s.key),
  );
  const tickCount = signalHistory.length;
  const svgWidth = Math.max(tickCount * TICK_WIDTH, TICK_WIDTH);
  const svgHeight = selectedSignals.length * ROW_HEIGHT;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in"
      onClick={handleOverlayClick}
    >
      <div className="mb-4 max-h-[60vh] w-[90vw] max-w-4xl overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800 p-4 shadow-xl flex flex-col animate-dialog-in">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-100">Timing Diagram</h2>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500">
              {tickCount} ticks
            </span>
            <button
              onClick={toggleRecording}
              className={`rounded px-2 py-1 text-xs font-medium ${
                recording
                  ? "bg-red-600 text-white hover:bg-red-500"
                  : "bg-zinc-700 text-zinc-200 hover:bg-zinc-600"
              }`}
            >
              {recording ? "Stop" : "Record"}
            </button>
            <button
              onClick={clearHistory}
              className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-600"
            >
              Clear
            </button>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-200 text-lg leading-none px-1"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Signal selector */}
          <div className="w-32 flex-shrink-0 overflow-y-auto border-r border-zinc-700 pr-2">
            {availableSignals.length === 0 && (
              <p className="text-[10px] text-zinc-500">No signals</p>
            )}
            {availableSignals.map((sig) => (
              <label
                key={sig.key}
                className="flex items-center gap-1.5 py-0.5 text-xs text-zinc-300 cursor-pointer hover:text-zinc-100"
              >
                <input
                  type="checkbox"
                  checked={selectedKeys.has(sig.key)}
                  onChange={() => toggleSignal(sig.key)}
                  className="accent-emerald-500"
                />
                <span className="truncate">{sig.label}</span>
              </label>
            ))}
          </div>

          {/* Waveform area */}
          <div className="flex-1 min-w-0 overflow-hidden">
            {tickCount === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-xs text-zinc-500">
                  {recording
                    ? "Waiting for ticks..."
                    : "Press Record, then Step or Play"}
                </p>
              </div>
            ) : (
              <div className="flex min-h-0 overflow-hidden" style={{ height: svgHeight || ROW_HEIGHT }}>
                {/* Row labels */}
                <div className="flex-shrink-0" style={{ width: LABEL_WIDTH }}>
                  {selectedSignals.map((sig) => (
                    <div
                      key={sig.key}
                      className="flex items-center text-[10px] text-zinc-400 truncate px-1"
                      style={{ height: ROW_HEIGHT }}
                    >
                      {sig.label}
                    </div>
                  ))}
                </div>

                {/* SVG waveform */}
                <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden">
                  <svg
                    width={svgWidth}
                    height={svgHeight || ROW_HEIGHT}
                    className="block"
                  >
                    {selectedSignals.map((sig, rowIdx) => {
                      const y0 = rowIdx * ROW_HEIGHT + ROW_HEIGHT - 6;
                      const y1 = rowIdx * ROW_HEIGHT + 6;

                      // Build waveform path
                      let d = "";
                      for (let t = 0; t < tickCount; t++) {
                        const val = signalHistory[t]?.[sig.key] ?? false;
                        const y = val ? y1 : y0;
                        const x = t * TICK_WIDTH;

                        if (t === 0) {
                          d += `M ${x} ${y}`;
                        } else {
                          const prevVal =
                            signalHistory[t - 1]?.[sig.key] ?? false;
                          const prevY = prevVal ? y1 : y0;
                          // Vertical transition at tick boundary
                          if (prevY !== y) {
                            d += ` L ${x} ${prevY} L ${x} ${y}`;
                          } else {
                            d += ` L ${x} ${y}`;
                          }
                        }
                        d += ` L ${x + TICK_WIDTH} ${y}`;
                      }

                      return (
                        <g key={sig.key}>
                          {/* Row separator */}
                          {rowIdx > 0 && (
                            <line
                              x1={0}
                              y1={rowIdx * ROW_HEIGHT}
                              x2={svgWidth}
                              y2={rowIdx * ROW_HEIGHT}
                              stroke="#3f3f46"
                              strokeWidth={1}
                            />
                          )}
                          {/* Waveform line */}
                          <path
                            d={d}
                            fill="none"
                            stroke="#10b981"
                            strokeWidth={2}
                          />
                        </g>
                      );
                    })}

                    {/* Tick grid lines */}
                    {Array.from({ length: tickCount + 1 }, (_, t) => (
                      <line
                        key={t}
                        x1={t * TICK_WIDTH}
                        y1={0}
                        x2={t * TICK_WIDTH}
                        y2={svgHeight}
                        stroke="#27272a"
                        strokeWidth={1}
                      />
                    ))}
                  </svg>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
