import { describe, expect, it } from "vitest";
import type { Circuit, CircuitNode, Edge } from "../../src/engine/types.ts";
import { evaluateCircuitFull, pinKey, type InstanceState } from "../../src/engine/simulate.ts";

// === Helpers ===

function makeRamNode(
  id: string,
  addrPinId: string,
  dataInPinId: string,
  wePinId: string,
  clkPinId: string,
  dataOutPinId: string,
  addressBits: 4 | 8,
  initialData?: number[],
): CircuitNode {
  return {
    id,
    type: "ram",
    position: { x: 0, y: 0 },
    rotation: 0,
    initialData,
    pins: [
      { id: addrPinId,    name: "Addr", direction: "input",  bits: addressBits },
      { id: dataInPinId,  name: "DIn",  direction: "input",  bits: 8 },
      { id: wePinId,      name: "WE",   direction: "input",  bits: 1 },
      { id: clkPinId,     name: "CLK",  direction: "input",  bits: 1 },
      { id: dataOutPinId, name: "DOut", direction: "output", bits: 8 },
    ],
  };
}

function makeInputNode(id: string, pinId: string, bits: number = 1): CircuitNode {
  return {
    id, type: "input",
    position: { x: 0, y: 0 }, rotation: 0,
    pins: [{ id: pinId, name: "In", direction: "output", bits: bits as 1 | 4 | 8 | 16 }],
  };
}

function makeOutputNode(id: string, pinId: string): CircuitNode {
  return {
    id, type: "output",
    position: { x: 0, y: 0 }, rotation: 0,
    pins: [{ id: pinId, name: "Out", direction: "input", bits: 8 }],
  };
}

function makeEdge(id: string, fromNodeId: string, fromPinId: string, toNodeId: string, toPinId: string): Edge {
  return { id, fromNodeId, fromPinId, toNodeId, toPinId };
}

// === Tests ===

describe("RAM simulation", () => {
  it("reads 0 on all addresses when empty (no initialData)", () => {
    const circuit: Circuit = {
      id: "test", name: "RAM empty",
      nodes: [
        makeInputNode("addr", "addrPin", 4),
        makeInputNode("dataIn", "dataInPin", 8),
        makeInputNode("we", "wePin", 1),
        makeInputNode("clk", "clkPin", 1),
        makeRamNode("ram", "addrIn", "dataIn", "we", "clk", "dataOut", 4),
        makeOutputNode("out", "outPin"),
      ],
      edges: [
        makeEdge("e1", "addr",   "addrPin",   "ram", "addrIn"),
        makeEdge("e2", "dataIn", "dataInPin",  "ram", "dataIn"),
        makeEdge("e3", "we",     "wePin",      "ram", "we"),
        makeEdge("e4", "clk",    "clkPin",     "ram", "clk"),
        makeEdge("e5", "ram",    "dataOut",    "out", "outPin"),
      ],
    };
    const iStates = new Map<string, InstanceState>();
    const pv = evaluateCircuitFull(circuit, { addrPin: 5, dataInPin: 0xFF, wePin: 0, clkPin: 0 }, [], iStates);
    expect(pv.get(pinKey("out", "outPin"))).toBe(0);
  });

  it("initializes from initialData", () => {
    const initialData = new Array(16).fill(0).map((_, i) => i * 11); // 0, 11, 22, ...
    const circuit: Circuit = {
      id: "test", name: "RAM init",
      nodes: [
        makeInputNode("addr", "addrPin", 4),
        makeRamNode("ram", "addrIn", "dataIn", "we", "clk", "dataOut", 4, initialData),
        makeOutputNode("out", "outPin"),
      ],
      edges: [
        makeEdge("e1", "addr", "addrPin", "ram", "addrIn"),
        makeEdge("e2", "ram",  "dataOut", "out", "outPin"),
      ],
    };
    const iStates = new Map<string, InstanceState>();
    for (let addr = 0; addr < 16; addr++) {
      const pv = evaluateCircuitFull(circuit, { addrPin: addr }, [], iStates);
      expect(pv.get(pinKey("out", "outPin"))).toBe(initialData[addr]);
    }
  });

  it("writes on rising clock edge when WE=1", () => {
    const circuit: Circuit = {
      id: "test", name: "RAM write",
      nodes: [
        makeInputNode("addr", "addrPin", 4),
        makeInputNode("dataIn", "dataInPin", 8),
        makeInputNode("we", "wePin", 1),
        makeInputNode("clk", "clkPin", 1),
        makeRamNode("ram", "addrIn", "dataIn", "we", "clk", "dataOut", 4),
        makeOutputNode("out", "outPin"),
      ],
      edges: [
        makeEdge("e1", "addr",   "addrPin",  "ram", "addrIn"),
        makeEdge("e2", "dataIn", "dataInPin","ram", "dataIn"),
        makeEdge("e3", "we",     "wePin",    "ram", "we"),
        makeEdge("e4", "clk",    "clkPin",   "ram", "clk"),
        makeEdge("e5", "ram",    "dataOut",  "out", "outPin"),
      ],
    };
    const iStates = new Map<string, InstanceState>();

    // Tick 1: CLK=0, WE=1, addr=3, dataIn=0xAB → no write (no rising edge yet)
    evaluateCircuitFull(circuit, { addrPin: 3, dataInPin: 0xAB, wePin: 1, clkPin: 0 }, [], iStates);

    // Tick 2: CLK=1 → rising edge → write 0xAB to addr 3
    const pv2 = evaluateCircuitFull(circuit, { addrPin: 3, dataInPin: 0xAB, wePin: 1, clkPin: 1 }, [], iStates);
    expect(pv2.get(pinKey("out", "outPin"))).toBe(0xAB);

    // Tick 3: CLK stays 1 → no new rising edge → no write to addr 7
    const pv3 = evaluateCircuitFull(circuit, { addrPin: 7, dataInPin: 0xFF, wePin: 1, clkPin: 1 }, [], iStates);
    expect(pv3.get(pinKey("out", "outPin"))).toBe(0); // addr 7 still 0

    // Tick 4: CLK=0 then Tick 5: CLK=1 → rising edge → write 0xFF to addr 7
    evaluateCircuitFull(circuit, { addrPin: 7, dataInPin: 0xFF, wePin: 1, clkPin: 0 }, [], iStates);
    const pv5 = evaluateCircuitFull(circuit, { addrPin: 7, dataInPin: 0xFF, wePin: 1, clkPin: 1 }, [], iStates);
    expect(pv5.get(pinKey("out", "outPin"))).toBe(0xFF);

    // Addr 3 still holds 0xAB
    const pvCheck = evaluateCircuitFull(circuit, { addrPin: 3, dataInPin: 0, wePin: 0, clkPin: 1 }, [], iStates);
    expect(pvCheck.get(pinKey("out", "outPin"))).toBe(0xAB);
  });

  it("does NOT write when WE=0 on rising edge", () => {
    const circuit: Circuit = {
      id: "test", name: "RAM no-write",
      nodes: [
        makeInputNode("addr", "addrPin", 4),
        makeInputNode("dataIn", "dataInPin", 8),
        makeInputNode("we", "wePin", 1),
        makeInputNode("clk", "clkPin", 1),
        makeRamNode("ram", "addrIn", "dataIn", "we", "clk", "dataOut", 4),
        makeOutputNode("out", "outPin"),
      ],
      edges: [
        makeEdge("e1", "addr",   "addrPin",  "ram", "addrIn"),
        makeEdge("e2", "dataIn", "dataInPin","ram", "dataIn"),
        makeEdge("e3", "we",     "wePin",    "ram", "we"),
        makeEdge("e4", "clk",    "clkPin",   "ram", "clk"),
        makeEdge("e5", "ram",    "dataOut",  "out", "outPin"),
      ],
    };
    const iStates = new Map<string, InstanceState>();

    // CLK: 0→1, but WE=0 → no write
    evaluateCircuitFull(circuit, { addrPin: 2, dataInPin: 0x99, wePin: 0, clkPin: 0 }, [], iStates);
    const pv = evaluateCircuitFull(circuit, { addrPin: 2, dataInPin: 0x99, wePin: 0, clkPin: 1 }, [], iStates);
    expect(pv.get(pinKey("out", "outPin"))).toBe(0); // nothing written
  });

  it("read is combinational — immediately reflects current address", () => {
    const initialData = new Array(16).fill(0);
    initialData[0] = 0x11;
    initialData[5] = 0x55;
    const circuit: Circuit = {
      id: "test", name: "RAM comb read",
      nodes: [
        makeInputNode("addr", "addrPin", 4),
        makeRamNode("ram", "addrIn", "dataIn", "we", "clk", "dataOut", 4, initialData),
        makeOutputNode("out", "outPin"),
      ],
      edges: [
        makeEdge("e1", "addr", "addrPin", "ram", "addrIn"),
        makeEdge("e2", "ram",  "dataOut", "out", "outPin"),
      ],
    };
    const iStates = new Map<string, InstanceState>();
    const pv0 = evaluateCircuitFull(circuit, { addrPin: 0 }, [], iStates);
    expect(pv0.get(pinKey("out", "outPin"))).toBe(0x11);
    const pv5 = evaluateCircuitFull(circuit, { addrPin: 5 }, [], iStates);
    expect(pv5.get(pinKey("out", "outPin"))).toBe(0x55);
  });

  it("8-bit address RAM: 256 entries — write and read back", () => {
    const circuit: Circuit = {
      id: "test", name: "RAM 256",
      nodes: [
        makeInputNode("addr", "addrPin", 8),
        makeInputNode("dataIn", "dataInPin", 8),
        makeInputNode("we", "wePin", 1),
        makeInputNode("clk", "clkPin", 1),
        makeRamNode("ram", "addrIn", "dataIn", "we", "clk", "dataOut", 8),
        makeOutputNode("out", "outPin"),
      ],
      edges: [
        makeEdge("e1", "addr",   "addrPin",  "ram", "addrIn"),
        makeEdge("e2", "dataIn", "dataInPin","ram", "dataIn"),
        makeEdge("e3", "we",     "wePin",    "ram", "we"),
        makeEdge("e4", "clk",    "clkPin",   "ram", "clk"),
        makeEdge("e5", "ram",    "dataOut",  "out", "outPin"),
      ],
    };
    const iStates = new Map<string, InstanceState>();

    // Write 0xCC to address 200
    evaluateCircuitFull(circuit, { addrPin: 200, dataInPin: 0xCC, wePin: 1, clkPin: 0 }, [], iStates);
    evaluateCircuitFull(circuit, { addrPin: 200, dataInPin: 0xCC, wePin: 1, clkPin: 1 }, [], iStates);

    // Read back from address 200
    const pv = evaluateCircuitFull(circuit, { addrPin: 200, dataInPin: 0, wePin: 0, clkPin: 0 }, [], iStates);
    expect(pv.get(pinKey("out", "outPin"))).toBe(0xCC);
  });

  it("lastWriteAddr is tracked in instanceStates", () => {
    const circuit: Circuit = {
      id: "test", name: "RAM lastWrite",
      nodes: [
        makeInputNode("addr", "addrPin", 4),
        makeInputNode("dataIn", "dataInPin", 8),
        makeInputNode("we", "wePin", 1),
        makeInputNode("clk", "clkPin", 1),
        makeRamNode("ram", "addrIn", "dataIn", "we", "clk", "dataOut", 4),
      ],
      edges: [
        makeEdge("e1", "addr",   "addrPin",  "ram", "addrIn"),
        makeEdge("e2", "dataIn", "dataInPin","ram", "dataIn"),
        makeEdge("e3", "we",     "wePin",    "ram", "we"),
        makeEdge("e4", "clk",    "clkPin",   "ram", "clk"),
      ],
    };
    const iStates = new Map<string, InstanceState>();

    // Rising edge at addr 7
    evaluateCircuitFull(circuit, { addrPin: 7, dataInPin: 1, wePin: 1, clkPin: 0 }, [], iStates);
    evaluateCircuitFull(circuit, { addrPin: 7, dataInPin: 1, wePin: 1, clkPin: 1 }, [], iStates);

    expect(iStates.get("ram")?.lastWriteAddr).toBe(7);

    // No write tick → lastWriteAddr cleared
    evaluateCircuitFull(circuit, { addrPin: 7, dataInPin: 1, wePin: 0, clkPin: 0 }, [], iStates);
    evaluateCircuitFull(circuit, { addrPin: 7, dataInPin: 1, wePin: 0, clkPin: 1 }, [], iStates);
    expect(iStates.get("ram")?.lastWriteAddr).toBeNull();
  });
});
