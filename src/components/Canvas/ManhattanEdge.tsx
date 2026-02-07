import { memo } from "react";
import { BaseEdge, type Edge, type EdgeProps } from "@xyflow/react";
import { useSimulationStore } from "../../store/simulation-store.ts";

function lightenColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c: number) => Math.round(c * 0.6 + 255 * 0.4);
  return `#${mix(r).toString(16).padStart(2, "0")}${mix(g).toString(16).padStart(2, "0")}${mix(b).toString(16).padStart(2, "0")}`;
}

export type ManhattanEdgeData = { color?: string };
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
  const signal = useSimulationStore((s) => s.edgeSignals[id] ?? false);

  const midX = (sourceX + targetX) / 2;
  const path =
    sourceY === targetY
      ? `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`
      : `M ${sourceX} ${sourceY} L ${midX} ${sourceY} L ${midX} ${targetY} L ${targetX} ${targetY}`;

  const customColor = data?.color;
  let color: string;
  if (selected) {
    color = "#60a5fa";
  } else if (customColor) {
    color = signal ? lightenColor(customColor) : customColor;
  } else {
    color = signal ? "#34d399" : "#71717a";
  }

  return (
    <BaseEdge
      id={id}
      path={path}
      style={{ stroke: color, strokeWidth: selected ? 2.5 : 2, transition: "stroke 0.15s ease" }}
    />
  );
}

export const ManhattanEdge = memo(ManhattanEdgeComponent);
