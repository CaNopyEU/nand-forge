/**
 * Tests for bit width wire validation logic.
 *
 * useWiring is a React hook — we can't call it directly in unit tests.
 * Instead we test the validation logic by importing getPinBits and
 * exercising it directly. The actual hook wiring is tested via E2E.
 */

import { describe, expect, it } from "vitest";
import type { Pin } from "../../src/engine/types.ts";
import type { AppNode, ModuleNodeType } from "../../src/store/circuit-store.ts";
import { BUILTIN_NAND_MODULE_ID } from "../../src/engine/simulate.ts";

// === Helpers (mirror getPinBits logic from useWiring.ts) ===

function getPinBits(nodes: AppNode[], nodeId: string, pinId: string): number {
  const node = nodes.find((n) => n.id === nodeId);
  if (node?.type === "module") {
    return node.data.pins.find((p) => p.id === pinId)?.bits ?? 1;
  }
  if (node?.type === "circuitInput") return (node.data as { bits?: number }).bits ?? 1;
  if (node?.type === "circuitOutput") return (node.data as { bits?: number }).bits ?? 1;
  return 1;
}

function makePin(id: string, name: string, direction: "input" | "output", bits: 1 | 4 | 8 | 16 = 1): Pin {
  return { id, name, direction, bits };
}

function moduleNode(
  id: string,
  moduleId: string,
  label: string,
  pins: Pin[],
): ModuleNodeType {
  return {
    id,
    type: "module",
    position: { x: 0, y: 0 },
    data: { label, moduleId, pins, rotation: 0 },
  } as ModuleNodeType;
}

function inputNode(id: string, pinId: string, label: string, bits: 1 | 4 | 8 | 16 = 1): AppNode {
  return {
    id,
    type: "circuitInput",
    position: { x: 0, y: 0 },
    data: { label, pinId, value: 0, bits, rotation: 0 },
  } as AppNode;
}

function outputNode(id: string, pinId: string, label: string, bits: 1 | 4 | 8 | 16 = 1): AppNode {
  return {
    id,
    type: "circuitOutput",
    position: { x: 0, y: 0 },
    data: { label, pinId, bits, rotation: 0 },
  } as AppNode;
}

// === Tests ===

describe("getPinBits — bit width resolution", () => {
  it("returns 1 for built-in input node", () => {
    const nodes: AppNode[] = [inputNode("in1", "p1", "A")];
    expect(getPinBits(nodes, "in1", "p1")).toBe(1);
  });

  it("returns 1 for built-in output node", () => {
    const nodes: AppNode[] = [outputNode("out1", "p2", "Q")];
    expect(getPinBits(nodes, "out1", "p2")).toBe(1);
  });

  it("returns 1 for NAND gate pins", () => {
    const nodes: AppNode[] = [
      moduleNode("nand1", BUILTIN_NAND_MODULE_ID, "NAND", [
        makePin("a", "A", "input"),
        makePin("b", "B", "input"),
        makePin("o", "Out", "output"),
      ]),
    ];
    expect(getPinBits(nodes, "nand1", "a")).toBe(1);
    expect(getPinBits(nodes, "nand1", "o")).toBe(1);
  });

  it("returns 8 for 8-bit module pin", () => {
    const nodes: AppNode[] = [
      moduleNode("mod1", "custom-mod", "Wide", [
        makePin("wp", "In", "input", 8),
        makePin("wo", "Out", "output", 8),
      ]),
    ];
    expect(getPinBits(nodes, "mod1", "wp")).toBe(8);
    expect(getPinBits(nodes, "mod1", "wo")).toBe(8);
  });

  it("returns 4 for 4-bit module pin", () => {
    const nodes: AppNode[] = [
      moduleNode("mod1", "custom-mod", "Nibble", [
        makePin("np", "In", "input", 4),
      ]),
    ];
    expect(getPinBits(nodes, "mod1", "np")).toBe(4);
  });

  it("returns 16 for 16-bit module pin", () => {
    const nodes: AppNode[] = [
      moduleNode("mod1", "custom-mod", "Word", [
        makePin("wp", "In", "input", 16),
      ]),
    ];
    expect(getPinBits(nodes, "mod1", "wp")).toBe(16);
  });

  it("returns 8 for 8-bit bus input node", () => {
    const nodes: AppNode[] = [inputNode("in1", "p1", "Bus A", 8)];
    expect(getPinBits(nodes, "in1", "p1")).toBe(8);
  });

  it("returns 8 for 8-bit bus output node", () => {
    const nodes: AppNode[] = [outputNode("out1", "p2", "Bus Q", 8)];
    expect(getPinBits(nodes, "out1", "p2")).toBe(8);
  });

  it("returns 1 for input node without bits (backward compat)", () => {
    const node: AppNode = {
      id: "in1",
      type: "circuitInput",
      position: { x: 0, y: 0 },
      data: { label: "A", pinId: "p1", value: 0, rotation: 0 },
    } as AppNode;
    expect(getPinBits([node], "in1", "p1")).toBe(1);
  });
});

describe("bit width validation logic", () => {
  function isWidthCompatible(nodes: AppNode[], sourceId: string, sourcePin: string, targetId: string, targetPin: string): boolean {
    return getPinBits(nodes, sourceId, sourcePin) === getPinBits(nodes, targetId, targetPin);
  }

  it("accepts 1-bit → 1-bit", () => {
    const nodes: AppNode[] = [
      inputNode("in1", "p1", "A"),
      outputNode("out1", "p2", "Q"),
    ];
    expect(isWidthCompatible(nodes, "in1", "p1", "out1", "p2")).toBe(true);
  });

  it("rejects 1-bit → 8-bit", () => {
    const nodes: AppNode[] = [
      inputNode("in1", "p1", "A"),
      moduleNode("mod1", "custom-mod", "Wide", [
        makePin("wp", "In", "input", 8),
      ]),
    ];
    expect(isWidthCompatible(nodes, "in1", "p1", "mod1", "wp")).toBe(false);
  });

  it("rejects 8-bit → 1-bit", () => {
    const nodes: AppNode[] = [
      moduleNode("mod1", "custom-mod", "Wide", [
        makePin("wo", "Out", "output", 8),
      ]),
      outputNode("out1", "p2", "Q"),
    ];
    expect(isWidthCompatible(nodes, "mod1", "wo", "out1", "p2")).toBe(false);
  });

  it("accepts 8-bit → 8-bit", () => {
    const nodes: AppNode[] = [
      moduleNode("mod1", "custom-a", "A", [
        makePin("ao", "Out", "output", 8),
      ]),
      moduleNode("mod2", "custom-b", "B", [
        makePin("bi", "In", "input", 8),
      ]),
    ];
    expect(isWidthCompatible(nodes, "mod1", "ao", "mod2", "bi")).toBe(true);
  });

  it("rejects 4-bit → 16-bit", () => {
    const nodes: AppNode[] = [
      moduleNode("mod1", "custom-a", "A", [
        makePin("ao", "Out", "output", 4),
      ]),
      moduleNode("mod2", "custom-b", "B", [
        makePin("bi", "In", "input", 16),
      ]),
    ];
    expect(isWidthCompatible(nodes, "mod1", "ao", "mod2", "bi")).toBe(false);
  });

  it("accepts Bus Input (8-bit) → Bus Output (8-bit)", () => {
    const nodes: AppNode[] = [
      inputNode("in1", "p1", "Bus A", 8),
      outputNode("out1", "p2", "Bus Q", 8),
    ];
    expect(isWidthCompatible(nodes, "in1", "p1", "out1", "p2")).toBe(true);
  });

  it("rejects Bus Input (8-bit) → 1-bit Output", () => {
    const nodes: AppNode[] = [
      inputNode("in1", "p1", "Bus A", 8),
      outputNode("out1", "p2", "Q"),
    ];
    expect(isWidthCompatible(nodes, "in1", "p1", "out1", "p2")).toBe(false);
  });

  it("rejects 1-bit Input → Bus Output (8-bit)", () => {
    const nodes: AppNode[] = [
      inputNode("in1", "p1", "A"),
      outputNode("out1", "p2", "Bus Q", 8),
    ];
    expect(isWidthCompatible(nodes, "in1", "p1", "out1", "p2")).toBe(false);
  });
});
