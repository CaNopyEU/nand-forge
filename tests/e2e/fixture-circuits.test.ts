/**
 * E2E tests for test-fixture circuits.
 *
 * Each fixture is a JSON file with modules that can be loaded and evaluated
 * by the engine. These tests verify that hand-crafted fixtures produce
 * correct outputs — serving as both regression and integration tests.
 */

import { describe, expect, it } from "vitest";
import type { Module } from "../../src/engine/types.ts";
import { evaluateCircuit, resolveTunnels } from "../../src/engine/simulate.ts";

import gatesData from "../../test-fixtures/gates.json";
import muxDemuxData from "../../test-fixtures/mux-demux.json";
import decoderData from "../../test-fixtures/decoder.json";
import adderData from "../../test-fixtures/adder.json";
import alu8Data from "../../test-fixtures/alu-8bit.json";
import flipFlopsData from "../../test-fixtures/flip-flops.json";
import counter4Data from "../../test-fixtures/counter-4bit.json";
import busPeripheralsData from "../../test-fixtures/bus-peripherals-demo.json";

// ============================================================
// Helpers
// ============================================================

interface FixtureFile {
  version: number;
  modules: Module[];
  library: unknown[];
}

const fixtures: Record<string, FixtureFile> = {
  "gates": gatesData as unknown as FixtureFile,
  "mux-demux": muxDemuxData as unknown as FixtureFile,
  "decoder": decoderData as unknown as FixtureFile,
  "adder": adderData as unknown as FixtureFile,
  "alu-8bit": alu8Data as unknown as FixtureFile,
  "flip-flops": flipFlopsData as unknown as FixtureFile,
  "counter-4bit": counter4Data as unknown as FixtureFile,
  "bus-peripherals-demo": busPeripheralsData as unknown as FixtureFile,
};

function loadFixture(name: string): FixtureFile {
  const f = fixtures[name];
  if (!f) throw new Error(`Fixture ${name} not found`);
  return f;
}

function findModule(modules: Module[], id: string): Module {
  const m = modules.find((m) => m.id === id);
  if (!m) throw new Error(`Module ${id} not found`);
  return m;
}

function evalModule(
  modules: Module[],
  moduleId: string,
  inputs: Record<string, number>,
): Record<string, number> {
  const mod = findModule(modules, moduleId);
  return evaluateCircuit(mod.circuit, inputs, modules);
}

// ============================================================
// Gates fixture
// ============================================================

describe("Fixture: gates", () => {
  const fixture = loadFixture("gates");
  const modules = fixture.modules;

  it("NOT gate", () => {
    expect(evalModule(modules, "mod-not", { a: 0 })).toMatchObject({ out: 1 });
    expect(evalModule(modules, "mod-not", { a: 1 })).toMatchObject({ out: 0 });
  });

  it("AND gate", () => {
    expect(evalModule(modules, "mod-and", { a: 0, b: 0 })).toMatchObject({ out: 0 });
    expect(evalModule(modules, "mod-and", { a: 1, b: 0 })).toMatchObject({ out: 0 });
    expect(evalModule(modules, "mod-and", { a: 0, b: 1 })).toMatchObject({ out: 0 });
    expect(evalModule(modules, "mod-and", { a: 1, b: 1 })).toMatchObject({ out: 1 });
  });

  it("OR gate", () => {
    expect(evalModule(modules, "mod-or", { a: 0, b: 0 })).toMatchObject({ out: 0 });
    expect(evalModule(modules, "mod-or", { a: 1, b: 0 })).toMatchObject({ out: 1 });
    expect(evalModule(modules, "mod-or", { a: 0, b: 1 })).toMatchObject({ out: 1 });
    expect(evalModule(modules, "mod-or", { a: 1, b: 1 })).toMatchObject({ out: 1 });
  });

  it("XOR gate", () => {
    expect(evalModule(modules, "mod-xor", { a: 0, b: 0 })).toMatchObject({ out: 0 });
    expect(evalModule(modules, "mod-xor", { a: 1, b: 0 })).toMatchObject({ out: 1 });
    expect(evalModule(modules, "mod-xor", { a: 0, b: 1 })).toMatchObject({ out: 1 });
    expect(evalModule(modules, "mod-xor", { a: 1, b: 1 })).toMatchObject({ out: 0 });
  });

  it("NOR gate", () => {
    expect(evalModule(modules, "mod-nor", { a: 0, b: 0 })).toMatchObject({ out: 1 });
    expect(evalModule(modules, "mod-nor", { a: 1, b: 1 })).toMatchObject({ out: 0 });
  });

  it("XNOR gate", () => {
    expect(evalModule(modules, "mod-xnor", { a: 0, b: 0 })).toMatchObject({ out: 1 });
    expect(evalModule(modules, "mod-xnor", { a: 1, b: 0 })).toMatchObject({ out: 0 });
    expect(evalModule(modules, "mod-xnor", { a: 1, b: 1 })).toMatchObject({ out: 1 });
  });

  it("Buffer", () => {
    expect(evalModule(modules, "mod-buffer", { a: 0 })).toMatchObject({ out: 0 });
    expect(evalModule(modules, "mod-buffer", { a: 1 })).toMatchObject({ out: 1 });
  });
});

// ============================================================
// MUX/DEMUX fixture
// ============================================================

describe("Fixture: mux-demux", () => {
  const fixture = loadFixture("mux-demux");
  const modules = fixture.modules;

  it("MUX 2:1 selects A when S=0", () => {
    expect(evalModule(modules, "mod-mux2", { a: 1, b: 0, s: 0 })).toMatchObject({ y: 1 });
  });

  it("MUX 2:1 selects B when S=1", () => {
    expect(evalModule(modules, "mod-mux2", { a: 0, b: 1, s: 1 })).toMatchObject({ y: 1 });
  });

  it("MUX 4:1 selects correct input", () => {
    // S1=0, S0=0 → D0
    expect(evalModule(modules, "mod-mux4", { d0: 1, d1: 0, d2: 0, d3: 0, s0: 0, s1: 0 })).toMatchObject({ y: 1 });
    // S1=0, S0=1 → D1
    expect(evalModule(modules, "mod-mux4", { d0: 0, d1: 1, d2: 0, d3: 0, s0: 1, s1: 0 })).toMatchObject({ y: 1 });
    // S1=1, S0=0 → D2
    expect(evalModule(modules, "mod-mux4", { d0: 0, d1: 0, d2: 1, d3: 0, s0: 0, s1: 1 })).toMatchObject({ y: 1 });
    // S1=1, S0=1 → D3
    expect(evalModule(modules, "mod-mux4", { d0: 0, d1: 0, d2: 0, d3: 1, s0: 1, s1: 1 })).toMatchObject({ y: 1 });
  });
});

// ============================================================
// Decoder fixture
// ============================================================

describe("Fixture: decoder", () => {
  const fixture = loadFixture("decoder");
  const modules = fixture.modules;

  it("Decoder 2:4 — input 0b00 activates Y0", () => {
    const out = evalModule(modules, "mod-decoder2to4", { a0: 0, a1: 0 });
    expect(out).toMatchObject({ y0: 1, y1: 0, y2: 0, y3: 0 });
  });

  it("Decoder 2:4 — input 0b01 activates Y1", () => {
    const out = evalModule(modules, "mod-decoder2to4", { a0: 1, a1: 0 });
    expect(out).toMatchObject({ y0: 0, y1: 1, y2: 0, y3: 0 });
  });

  it("Decoder 2:4 — input 0b10 activates Y2", () => {
    const out = evalModule(modules, "mod-decoder2to4", { a0: 0, a1: 1 });
    expect(out).toMatchObject({ y0: 0, y1: 0, y2: 1, y3: 0 });
  });

  it("Decoder 2:4 — input 0b11 activates Y3", () => {
    const out = evalModule(modules, "mod-decoder2to4", { a0: 1, a1: 1 });
    expect(out).toMatchObject({ y0: 0, y1: 0, y2: 0, y3: 1 });
  });
});

// ============================================================
// Adder fixture
// ============================================================

describe("Fixture: adder", () => {
  const fixture = loadFixture("adder");
  const modules = fixture.modules;

  it("Half Adder — 0+0", () => {
    expect(evalModule(modules, "mod-half-adder", { a: 0, b: 0 })).toMatchObject({ s: 0, c: 0 });
  });

  it("Half Adder — 1+1", () => {
    expect(evalModule(modules, "mod-half-adder", { a: 1, b: 1 })).toMatchObject({ s: 0, c: 1 });
  });

  it("Full Adder — 1+1+1", () => {
    expect(evalModule(modules, "mod-full-adder", { a: 1, b: 1, cin: 1 })).toMatchObject({ s: 1, cout: 1 });
  });

  it("8-bit Adder — 0x37 + 0x85 = 0xBC", () => {
    const out = evalModule(modules, "mod-adder8", { a: 0x37, b: 0x85 });
    expect(out).toMatchObject({ s: 0xbc, cout: 0 });
  });

  it("8-bit Adder — 0xFF + 0x01 = overflow", () => {
    const out = evalModule(modules, "mod-adder8", { a: 0xff, b: 0x01 });
    expect(out).toMatchObject({ s: 0x00, cout: 1 });
  });

  it("8-bit Adder — 0x00 + 0x00 = 0x00", () => {
    const out = evalModule(modules, "mod-adder8", { a: 0x00, b: 0x00 });
    expect(out).toMatchObject({ s: 0x00, cout: 0 });
  });
});

// ============================================================
// ALU fixture
// ============================================================

describe("Fixture: alu-8bit", () => {
  const fixture = loadFixture("alu-8bit");
  const modules = fixture.modules;

  describe("ALU Slice (1-bit)", () => {
    it("AND: 1 & 1 = 1", () => {
      const out = evalModule(modules, "mod-alu-slice", { a: 1, b: 1, cin: 0, op0: 0, op1: 0 });
      expect(out).toMatchObject({ r: 1 });
    });

    it("OR: 1 | 0 = 1", () => {
      const out = evalModule(modules, "mod-alu-slice", { a: 1, b: 0, cin: 0, op0: 1, op1: 0 });
      expect(out).toMatchObject({ r: 1 });
    });

    it("XOR: 1 ^ 1 = 0", () => {
      const out = evalModule(modules, "mod-alu-slice", { a: 1, b: 1, cin: 0, op0: 0, op1: 1 });
      expect(out).toMatchObject({ r: 0 });
    });

    it("ADD: 1 + 1 + 0 = 0 carry 1", () => {
      const out = evalModule(modules, "mod-alu-slice", { a: 1, b: 1, cin: 0, op0: 1, op1: 1 });
      expect(out).toMatchObject({ r: 0, cout: 1 });
    });
  });

  describe("8-bit ALU — AND (Op=00)", () => {
    // Note: Cout always reflects the Full Adder carry (A+B), not the AND result
    it("0xFF AND 0x0F = 0x0F", () => {
      const out = evalModule(modules, "mod-alu8", { a: 0xff, b: 0x0f, op0: 0, op1: 0 });
      expect(out["r"]).toBe(0x0f);
    });

    it("0xA5 AND 0x5A = 0x00", () => {
      const out = evalModule(modules, "mod-alu8", { a: 0xa5, b: 0x5a, op0: 0, op1: 0 });
      expect(out["r"]).toBe(0x00);
    });
  });

  describe("8-bit ALU — OR (Op=01)", () => {
    it("0xA0 OR 0x05 = 0xA5", () => {
      const out = evalModule(modules, "mod-alu8", { a: 0xa0, b: 0x05, op0: 1, op1: 0 });
      expect(out["r"]).toBe(0xa5);
    });

    it("0x00 OR 0x00 = 0x00", () => {
      const out = evalModule(modules, "mod-alu8", { a: 0x00, b: 0x00, op0: 1, op1: 0 });
      expect(out["r"]).toBe(0x00);
    });
  });

  describe("8-bit ALU — XOR (Op=10)", () => {
    it("0xFF XOR 0xFF = 0x00", () => {
      const out = evalModule(modules, "mod-alu8", { a: 0xff, b: 0xff, op0: 0, op1: 1 });
      expect(out["r"]).toBe(0x00);
    });

    it("0xAA XOR 0x55 = 0xFF", () => {
      const out = evalModule(modules, "mod-alu8", { a: 0xaa, b: 0x55, op0: 0, op1: 1 });
      expect(out["r"]).toBe(0xff);
    });
  });

  describe("8-bit ALU — ADD (Op=11)", () => {
    it("0x37 + 0x85 = 0xBC, no carry", () => {
      const out = evalModule(modules, "mod-alu8", { a: 0x37, b: 0x85, op0: 1, op1: 1 });
      expect(out).toMatchObject({ r: 0xbc, cout: 0 });
    });

    it("0xFF + 0x01 = 0x00, carry", () => {
      const out = evalModule(modules, "mod-alu8", { a: 0xff, b: 0x01, op0: 1, op1: 1 });
      expect(out).toMatchObject({ r: 0x00, cout: 1 });
    });

    it("0x00 + 0x00 = 0x00", () => {
      const out = evalModule(modules, "mod-alu8", { a: 0x00, b: 0x00, op0: 1, op1: 1 });
      expect(out).toMatchObject({ r: 0x00, cout: 0 });
    });

    it("0x80 + 0x80 = 0x00, carry", () => {
      const out = evalModule(modules, "mod-alu8", { a: 0x80, b: 0x80, op0: 1, op1: 1 });
      expect(out).toMatchObject({ r: 0x00, cout: 1 });
    });
  });
});

// ============================================================
// Bus peripherals fixture
// ============================================================

describe("Fixture: bus-peripherals-demo", () => {
  const fixture = loadFixture("bus-peripherals-demo");
  const modules = fixture.modules;

  it("Hex Monitor — pass-through 0xA5", () => {
    const out = evalModule(modules, "mod-hex-monitor", { data: 0xa5 });
    expect(out).toMatchObject({ pass: 0xa5 });
  });

  it("Hex Monitor — pass-through 0x00", () => {
    const out = evalModule(modules, "mod-hex-monitor", { data: 0x00 });
    expect(out).toMatchObject({ pass: 0x00 });
  });

  it("Tunnel Bridge — signal 1 passes through", () => {
    const mod = findModule(modules, "mod-tunnel-bridge");
    const resolved = resolveTunnels(mod.circuit);
    const out = evaluateCircuit(resolved, { in: 1 }, modules);
    expect(out).toMatchObject({ out: 1 });
  });

  it("Tunnel Bridge — signal 0 passes through", () => {
    const mod = findModule(modules, "mod-tunnel-bridge");
    const resolved = resolveTunnels(mod.circuit);
    const out = evaluateCircuit(resolved, { in: 0 }, modules);
    expect(out).toMatchObject({ out: 0 });
  });

  it("DIP to Hex — variant nodes preserved in fixture", () => {
    const mod = findModule(modules, "mod-dip-demo");
    const dipNode = mod.circuit.nodes.find((n) => n.variant === "dip-switch");
    const hexNode = mod.circuit.nodes.find((n) => n.variant === "hex-display");
    expect(dipNode).toBeDefined();
    expect(hexNode).toBeDefined();
    expect(dipNode!.type).toBe("input");
    expect(hexNode!.type).toBe("output");
  });
});

// ============================================================
// Fixture structural checks
// ============================================================

describe("Fixture structural integrity", () => {
  const fixtureNames = [
    "gates", "mux-demux", "decoder", "adder",
    "alu-8bit", "flip-flops", "counter-4bit", "bus-peripherals-demo",
  ] as const;

  for (const name of fixtureNames) {
    it(`${name}.json is valid v2 format`, () => {
      const f = loadFixture(name);
      expect(f.version).toBe(2);
      expect(Array.isArray(f.modules)).toBe(true);
      expect(Array.isArray(f.library)).toBe(true);
      expect(f.modules.length).toBeGreaterThan(0);
    });

    it(`${name}.json — all library refs resolve`, () => {
      const f = loadFixture(name);
      const moduleIds = new Set(f.modules.map((m: Module) => m.id));
      for (const entry of f.library as Array<{ type: string; moduleId?: string }>) {
        if (entry.type === "module" && entry.moduleId) {
          expect(moduleIds.has(entry.moduleId)).toBe(true);
        }
      }
    });

    it(`${name}.json — all module edges reference existing nodes/pins`, () => {
      const f = loadFixture(name);
      for (const mod of f.modules) {
        const nodeIds = new Set(mod.circuit.nodes.map((n) => n.id));
        for (const edge of mod.circuit.edges) {
          expect(nodeIds.has(edge.fromNodeId)).toBe(true);
          expect(nodeIds.has(edge.toNodeId)).toBe(true);
          const fromNode = mod.circuit.nodes.find((n) => n.id === edge.fromNodeId)!;
          const toNode = mod.circuit.nodes.find((n) => n.id === edge.toNodeId)!;
          expect(fromNode.pins.some((p) => p.id === edge.fromPinId)).toBe(true);
          expect(toNode.pins.some((p) => p.id === edge.toPinId)).toBe(true);
        }
      }
    });
  }
});
