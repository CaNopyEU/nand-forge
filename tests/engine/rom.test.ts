import { describe, expect, it } from "vitest";
import type { Circuit, CircuitNode, Edge } from "../../src/engine/types.ts";
import { evaluateCircuitFull, pinKey } from "../../src/engine/simulate.ts";

// === Helpers ===

function makeRomNode(id: string, addrPinId: string, dataPinId: string, romData: number[]): CircuitNode {
  const addressBits = romData.length <= 16 ? 4 : 8;
  return {
    id,
    type: "rom",
    position: { x: 0, y: 0 },
    rotation: 0,
    romData,
    pins: [
      { id: addrPinId, name: "Addr", direction: "input", bits: addressBits },
      { id: dataPinId, name: "Data", direction: "output", bits: 8 },
    ],
  };
}

function makeInputNode(id: string, pinId: string, bits: 4 | 8 = 4): CircuitNode {
  return {
    id,
    type: "input",
    position: { x: 0, y: 0 },
    rotation: 0,
    pins: [{ id: pinId, name: "In", direction: "output", bits }],
  };
}

function makeOutputNode(id: string, pinId: string): CircuitNode {
  return {
    id,
    type: "output",
    position: { x: 0, y: 0 },
    rotation: 0,
    pins: [{ id: pinId, name: "Out", direction: "input", bits: 8 }],
  };
}

function makeEdge(id: string, fromNodeId: string, fromPinId: string, toNodeId: string, toPinId: string): Edge {
  return { id, fromNodeId, fromPinId, toNodeId, toPinId };
}

// === Tests ===

describe("ROM simulation", () => {
  it("outputs correct data for each address", () => {
    const romContent = [0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77,
                        0x88, 0x99, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF];
    const circuit: Circuit = {
      id: "test",
      name: "ROM test",
      nodes: [
        makeInputNode("addr", "addrPin"),
        makeRomNode("rom", "addrIn", "dataOut", romContent),
        makeOutputNode("out", "outPin"),
      ],
      edges: [
        makeEdge("e1", "addr", "addrPin", "rom", "addrIn"),
        makeEdge("e2", "rom", "dataOut", "out", "outPin"),
      ],
    };

    for (let addr = 0; addr < 16; addr++) {
      const pinValues = evaluateCircuitFull(circuit, { addrPin: addr });
      const output = pinValues.get(pinKey("out", "outPin"));
      expect(output).toBe(romContent[addr]);
    }
  });

  it("outputs 0 for addresses beyond romData length", () => {
    const romContent = [0xAB, 0xCD];
    const circuit: Circuit = {
      id: "test",
      name: "ROM short",
      nodes: [
        makeInputNode("addr", "addrPin"),
        makeRomNode("rom", "addrIn", "dataOut", romContent),
        makeOutputNode("out", "outPin"),
      ],
      edges: [
        makeEdge("e1", "addr", "addrPin", "rom", "addrIn"),
        makeEdge("e2", "rom", "dataOut", "out", "outPin"),
      ],
    };

    // Addr 0 → 0xAB, Addr 1 → 0xCD, Addr 2 → 0 (out of bounds)
    const pv0 = evaluateCircuitFull(circuit, { addrPin: 0 });
    expect(pv0.get(pinKey("out", "outPin"))).toBe(0xAB);

    const pv1 = evaluateCircuitFull(circuit, { addrPin: 1 });
    expect(pv1.get(pinKey("out", "outPin"))).toBe(0xCD);

    const pv2 = evaluateCircuitFull(circuit, { addrPin: 2 });
    expect(pv2.get(pinKey("out", "outPin"))).toBe(0);
  });

  it("masks address to addressBits (4-bit ROM with large address input)", () => {
    // 4-bit ROM: address is masked to 0..15
    const romContent = new Array(16).fill(0).map((_, i) => i * 10);
    const circuit: Circuit = {
      id: "test",
      name: "ROM mask test",
      nodes: [
        makeInputNode("addr", "addrPin"),
        makeRomNode("rom", "addrIn", "dataOut", romContent),
        makeOutputNode("out", "outPin"),
      ],
      edges: [
        makeEdge("e1", "addr", "addrPin", "rom", "addrIn"),
        makeEdge("e2", "rom", "dataOut", "out", "outPin"),
      ],
    };

    // Address 0x1A (26) → masked to 0xA (10) → romContent[10] = 100
    const pv = evaluateCircuitFull(circuit, { addrPin: 0x1A });
    expect(pv.get(pinKey("out", "outPin"))).toBe(romContent[0x1A & 0xF]);
  });

  it("works with unconnected address input (defaults to 0)", () => {
    const romContent = [0x42, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
    const circuit: Circuit = {
      id: "test",
      name: "ROM no input",
      nodes: [
        makeRomNode("rom", "addrIn", "dataOut", romContent),
        makeOutputNode("out", "outPin"),
      ],
      edges: [
        makeEdge("e1", "rom", "dataOut", "out", "outPin"),
      ],
    };

    const pv = evaluateCircuitFull(circuit, {});
    expect(pv.get(pinKey("out", "outPin"))).toBe(0x42);
  });

  it("8-bit address ROM: 256 entries", () => {
    const romContent = new Array(256).fill(0).map((_, i) => (i * 3) & 0xFF);
    const circuit: Circuit = {
      id: "test",
      name: "ROM 256",
      nodes: [
        makeInputNode("addr", "addrPin", 8),
        makeRomNode("rom", "addrIn", "dataOut", romContent),
        makeOutputNode("out", "outPin"),
      ],
      edges: [
        makeEdge("e1", "addr", "addrPin", "rom", "addrIn"),
        makeEdge("e2", "rom", "dataOut", "out", "outPin"),
      ],
    };

    for (const addr of [0, 1, 127, 200, 255]) {
      const pv = evaluateCircuitFull(circuit, { addrPin: addr });
      expect(pv.get(pinKey("out", "outPin"))).toBe(romContent[addr]);
    }
  });
});
