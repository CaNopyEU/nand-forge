import { memo } from "react";
import { BaseEdge, EdgeLabelRenderer, type Edge, type EdgeProps } from "@xyflow/react";
import { useSimulationStore } from "../../store/simulation-store.ts";

function lightenColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c: number) => Math.round(c * 0.6 + 255 * 0.4);
  return `#${mix(r).toString(16).padStart(2, "0")}${mix(g).toString(16).padStart(2, "0")}${mix(b).toString(16).padStart(2, "0")}`;
}

function formatHex(value: number, bits: number): string {
  const digits = Math.ceil(bits / 4);
  const masked = value & ((1 << bits) - 1);
  return `0x${masked.toString(16).toUpperCase().padStart(digits, "0")}`;
}

export type ManhattanEdgeData = { color?: string; bits?: number };
export type ManhattanEdgeType = Edge<ManhattanEdgeData, "manhattan">;

function ManhattanEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  selected,
  data,
}: EdgeProps<ManhattanEdgeType>) {
  const signal = useSimulationStore((s) => s.edgeSignals[id] ?? 0);
  const unstable = useSimulationStore((s) => s.unstableEdges[id] ?? false);

  const bits = data?.bits ?? 1;
  const isBus = bits > 1;

  const midX = (sourceX + targetX) / 2;
  const path =
    sourceY === targetY
      ? `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`
      : `M ${sourceX} ${sourceY} L ${midX} ${sourceY} L ${midX} ${targetY} L ${targetX} ${targetY}`;

  const customColor = data?.color;
  let color: string;
  if (unstable) {
    color = "#f87171";
  } else if (selected) {
    color = "#60a5fa";
  } else if (customColor) {
    color = signal ? lightenColor(customColor) : customColor;
  } else {
    color = signal ? "#34d399" : "#71717a";
  }

  const labelX = (sourceX + targetX) / 2;
  const labelY = (sourceY + targetY) / 2;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: color,
          strokeWidth: isBus ? (selected ? 4 : 3.5) : (selected ? 2.5 : 2),
          transition: "stroke 0.15s ease",
          animation: unstable ? "wire-pulse 0.5s infinite" : undefined,
        }}
      />
      {isBus && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "none",
            }}
            className="rounded bg-zinc-900/80 px-1 text-[10px] font-mono text-zinc-300"
          >
            {formatHex(signal, bits)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const ManhattanEdge = memo(ManhattanEdgeComponent);
