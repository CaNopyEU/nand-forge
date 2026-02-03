import { memo } from "react";
import { BaseEdge, type Edge, type EdgeProps } from "@xyflow/react";

export type ManhattanEdgeType = Edge<{ signal?: boolean }, "manhattan">;

function ManhattanEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
}: EdgeProps<ManhattanEdgeType>) {
  const midX = (sourceX + targetX) / 2;
  const path =
    sourceY === targetY
      ? `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`
      : `M ${sourceX} ${sourceY} L ${midX} ${sourceY} L ${midX} ${targetY} L ${targetX} ${targetY}`;

  const signal = data?.signal ?? false;
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
