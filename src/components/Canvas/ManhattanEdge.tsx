import { memo } from "react";
import { BaseEdge, type Edge, type EdgeProps } from "@xyflow/react";
import { useSimulationStore } from "../../store/simulation-store.ts";

export type ManhattanEdgeType = Edge<Record<string, unknown>, "manhattan">;

function ManhattanEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  selected,
}: EdgeProps<ManhattanEdgeType>) {
  const signal = useSimulationStore((s) => s.edgeSignals[id] ?? false);

  const midX = (sourceX + targetX) / 2;
  const path =
    sourceY === targetY
      ? `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`
      : `M ${sourceX} ${sourceY} L ${midX} ${sourceY} L ${midX} ${targetY} L ${targetX} ${targetY}`;

  const color = selected ? "#60a5fa" : signal ? "#34d399" : "#71717a";

  return (
    <BaseEdge
      id={id}
      path={path}
      style={{ stroke: color, strokeWidth: selected ? 2.5 : 2 }}
    />
  );
}

export const ManhattanEdge = memo(ManhattanEdgeComponent);
