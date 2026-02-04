import { Position } from "@xyflow/react";
import type { CSSProperties } from "react";

export type Rotation = 0 | 90 | 180 | 270;

/** Cycle through rotations: 0 → 90 → 180 → 270 → 0 */
export function nextRotation(r: Rotation): Rotation {
  return ((r + 90) % 360) as Rotation;
}

/** Which side input (target) handles sit on for the given rotation. */
export function getInputPosition(r: Rotation): Position {
  switch (r) {
    case 0:
      return Position.Left;
    case 90:
      return Position.Top;
    case 180:
      return Position.Right;
    case 270:
      return Position.Bottom;
  }
}

/** Which side output (source) handles sit on for the given rotation. */
export function getOutputPosition(r: Rotation): Position {
  switch (r) {
    case 0:
      return Position.Right;
    case 90:
      return Position.Bottom;
    case 180:
      return Position.Left;
    case 270:
      return Position.Top;
  }
}

/** Returns true when the position is Left or Right (pins distributed vertically). */
export function isVerticalSide(pos: Position): boolean {
  return pos === Position.Left || pos === Position.Right;
}

/**
 * Compute inline style to distribute a handle along the correct axis.
 * Vertical sides (Left/Right) → distribute with `top` %.
 * Horizontal sides (Top/Bottom) → distribute with `left` %.
 */
export function getHandleDistributionStyle(
  pos: Position,
  index: number,
  total: number,
): CSSProperties {
  const pct = `${((index + 1) / (total + 1)) * 100}%`;
  if (isVerticalSide(pos)) {
    return { top: pct };
  }
  return { left: pct };
}
