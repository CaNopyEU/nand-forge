import { describe, expect, it } from "vitest";
import { Position } from "@xyflow/react";
import {
  nextRotation,
  getInputPosition,
  getOutputPosition,
  isVerticalSide,
  getHandleDistributionStyle,
  type Rotation,
} from "../../src/utils/layout.ts";

describe("nextRotation", () => {
  it("cycles 0 → 90 → 180 → 270 → 0", () => {
    expect(nextRotation(0)).toBe(90);
    expect(nextRotation(90)).toBe(180);
    expect(nextRotation(180)).toBe(270);
    expect(nextRotation(270)).toBe(0);
  });
});

describe("getInputPosition", () => {
  it.each<[Rotation, Position]>([
    [0, Position.Left],
    [90, Position.Top],
    [180, Position.Right],
    [270, Position.Bottom],
  ])("rotation %d → %s", (r, expected) => {
    expect(getInputPosition(r)).toBe(expected);
  });
});

describe("getOutputPosition", () => {
  it.each<[Rotation, Position]>([
    [0, Position.Right],
    [90, Position.Bottom],
    [180, Position.Left],
    [270, Position.Top],
  ])("rotation %d → %s", (r, expected) => {
    expect(getOutputPosition(r)).toBe(expected);
  });
});

describe("isVerticalSide", () => {
  it("Left and Right are vertical sides", () => {
    expect(isVerticalSide(Position.Left)).toBe(true);
    expect(isVerticalSide(Position.Right)).toBe(true);
  });
  it("Top and Bottom are NOT vertical sides", () => {
    expect(isVerticalSide(Position.Top)).toBe(false);
    expect(isVerticalSide(Position.Bottom)).toBe(false);
  });
});

describe("getHandleDistributionStyle", () => {
  it("vertical side (Left) → returns { top: pct }", () => {
    const style = getHandleDistributionStyle(Position.Left, 0, 2);
    expect(style).toEqual({ top: `${(1 / 3) * 100}%` });
  });

  it("vertical side (Right) → returns { top: pct }", () => {
    const style = getHandleDistributionStyle(Position.Right, 1, 2);
    expect(style).toEqual({ top: `${(2 / 3) * 100}%` });
  });

  it("horizontal side (Top) → returns { left: pct }", () => {
    const style = getHandleDistributionStyle(Position.Top, 0, 3);
    expect(style).toEqual({ left: `${(1 / 4) * 100}%` });
  });

  it("horizontal side (Bottom) → returns { left: pct }", () => {
    const style = getHandleDistributionStyle(Position.Bottom, 2, 3);
    expect(style).toEqual({ left: `${(3 / 4) * 100}%` });
  });
});
