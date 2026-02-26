/**
 * E2E tests for test-fixture circuits.
 *
 * Each fixture is a JSON file with modules that can be loaded and evaluated
 * by the engine. These tests verify that hand-crafted fixtures produce
 * correct outputs — serving as both regression and integration tests.
 */

import { describe, expect, it } from "vitest";
import type { Module } from "../../src/engine/types.ts";
import { evaluateCircuit, evaluateCircuitWithState, resolveTunnels, Z_VALUE, CONFLICT } from "../../src/engine/simulate.ts";
import type { InstanceState } from "../../src/engine/simulate.ts";

import gatesData from "../../test-fixtures/gates.json";
import muxDemuxData from "../../test-fixtures/mux-demux.json";
import decoderData from "../../test-fixtures/decoder.json";
import adderData from "../../test-fixtures/adder.json";
import alu8Data from "../../test-fixtures/alu-8bit.json";
import flipFlopsData from "../../test-fixtures/flip-flops.json";
import counter4Data from "../../test-fixtures/counter-4bit.json";
import busPeripheralsData from "../../test-fixtures/bus-peripherals-demo.json";
import ioBasicsData from "../../test-fixtures/io-basics.json";
import busSplitMergeData from "../../test-fixtures/bus-split-merge.json";
import ioPeripheralsAdvData from "../../test-fixtures/io-peripherals-advanced.json";
import tunnelAdvData from "../../test-fixtures/tunnel-advanced.json";
import clockButtonData from "../../test-fixtures/clock-button-sequential.json";
import tristateData from "../../test-fixtures/tristate-bus.json";
import cpuComponentsData from "../../test-fixtures/cpu-components.json";

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
  "io-basics": ioBasicsData as unknown as FixtureFile,
  "bus-split-merge": busSplitMergeData as unknown as FixtureFile,
  "io-peripherals-advanced": ioPeripheralsAdvData as unknown as FixtureFile,
  "tunnel-advanced": tunnelAdvData as unknown as FixtureFile,
  "clock-button-sequential": clockButtonData as unknown as FixtureFile,
  "tristate-bus": tristateData as unknown as FixtureFile,
  "cpu-components": cpuComponentsData as unknown as FixtureFile,
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

function evalModuleWithTunnels(
  modules: Module[],
  moduleId: string,
  inputs: Record<string, number>,
): Record<string, number> {
  const mod = findModule(modules, moduleId);
  const resolved = resolveTunnels(mod.circuit);
  return evaluateCircuit(resolved, inputs, modules);
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

  // Opcode helpers: { op0, op1, op2 }
  const AND = { op0: 0, op1: 0, op2: 0 };
  const OR  = { op0: 1, op1: 0, op2: 0 };
  const XOR = { op0: 0, op1: 1, op2: 0 };
  const NOT = { op0: 1, op1: 1, op2: 0 };
  const ADD = { op0: 0, op1: 0, op2: 1 };
  const SUB = { op0: 1, op1: 0, op2: 1 };
  const SHL = { op0: 0, op1: 1, op2: 1 };
  const SHR = { op0: 1, op1: 1, op2: 1 };

  // Helper: evaluate ALU slice with defaults for unused inputs
  const slice = (inputs: Record<string, number>) =>
    evalModule(modules, "mod-alu-slice", { cin: 0, shiftin: 0, ...inputs });

  // Helper: evaluate 8-bit ALU
  const alu = (a: number, b: number, op: Record<string, number>) =>
    evalModule(modules, "mod-alu8", { a, b, ...op });

  describe("NOR8", () => {
    it("all zeros → 1", () => {
      const out = evalModule(modules, "mod-nor8", { d0: 0, d1: 0, d2: 0, d3: 0, d4: 0, d5: 0, d6: 0, d7: 0 });
      expect(out).toMatchObject({ out: 1 });
    });

    it("any one set → 0", () => {
      const out = evalModule(modules, "mod-nor8", { d0: 0, d1: 0, d2: 0, d3: 1, d4: 0, d5: 0, d6: 0, d7: 0 });
      expect(out).toMatchObject({ out: 0 });
    });

    it("all ones → 0", () => {
      const out = evalModule(modules, "mod-nor8", { d0: 1, d1: 1, d2: 1, d3: 1, d4: 1, d5: 1, d6: 1, d7: 1 });
      expect(out).toMatchObject({ out: 0 });
    });
  });

  describe("ALU Slice (1-bit)", () => {
    it("AND: 1 & 1 = 1", () => {
      expect(slice({ a: 1, b: 1, ...AND })).toMatchObject({ r: 1 });
    });

    it("AND: 1 & 0 = 0", () => {
      expect(slice({ a: 1, b: 0, ...AND })).toMatchObject({ r: 0 });
    });

    it("OR: 1 | 0 = 1", () => {
      expect(slice({ a: 1, b: 0, ...OR })).toMatchObject({ r: 1 });
    });

    it("OR: 0 | 0 = 0", () => {
      expect(slice({ a: 0, b: 0, ...OR })).toMatchObject({ r: 0 });
    });

    it("XOR: 1 ^ 1 = 0", () => {
      expect(slice({ a: 1, b: 1, ...XOR })).toMatchObject({ r: 0 });
    });

    it("XOR: 1 ^ 0 = 1", () => {
      expect(slice({ a: 1, b: 0, ...XOR })).toMatchObject({ r: 1 });
    });

    it("NOT: ~1 = 0", () => {
      expect(slice({ a: 1, b: 0, ...NOT })).toMatchObject({ r: 0 });
    });

    it("NOT: ~0 = 1", () => {
      expect(slice({ a: 0, b: 0, ...NOT })).toMatchObject({ r: 1 });
    });

    it("ADD: 1 + 1 + 0 = 0 carry 1", () => {
      expect(slice({ a: 1, b: 1, ...ADD })).toMatchObject({ r: 0, cout: 1 });
    });

    it("ADD: 1 + 0 + 1 = 0 carry 1", () => {
      expect(slice({ a: 1, b: 0, cin: 1, ...ADD })).toMatchObject({ r: 0, cout: 1 });
    });

    it("SUB slice: A=1, B=0, Cin=1 → B_eff=1, FA(1,1,1)=1 carry 1", () => {
      expect(slice({ a: 1, b: 0, cin: 1, ...SUB })).toMatchObject({ r: 1, cout: 1 });
    });

    it("Shift: shiftin=1, op=SHL → R=1 (passes through)", () => {
      expect(slice({ a: 0, b: 0, shiftin: 1, ...SHL })).toMatchObject({ r: 1 });
    });
  });

  describe("8-bit ALU — AND (Op=000)", () => {
    it("0xFF AND 0x0F = 0x0F", () => {
      expect(alu(0xff, 0x0f, AND)["r"]).toBe(0x0f);
    });

    it("0xA5 AND 0x5A = 0x00", () => {
      const out = alu(0xa5, 0x5a, AND);
      expect(out["r"]).toBe(0x00);
      expect(out["zero"]).toBe(1);
    });

    it("0xFF AND 0xFF = 0xFF", () => {
      expect(alu(0xff, 0xff, AND)["r"]).toBe(0xff);
    });
  });

  describe("8-bit ALU — OR (Op=001)", () => {
    it("0xA0 OR 0x05 = 0xA5", () => {
      expect(alu(0xa0, 0x05, OR)["r"]).toBe(0xa5);
    });

    it("0x00 OR 0x00 = 0x00, Zero=1", () => {
      const out = alu(0x00, 0x00, OR);
      expect(out["r"]).toBe(0x00);
      expect(out["zero"]).toBe(1);
    });
  });

  describe("8-bit ALU — XOR (Op=010)", () => {
    it("0xFF XOR 0xFF = 0x00, Zero=1", () => {
      const out = alu(0xff, 0xff, XOR);
      expect(out["r"]).toBe(0x00);
      expect(out["zero"]).toBe(1);
    });

    it("0xAA XOR 0x55 = 0xFF, Neg=1", () => {
      const out = alu(0xaa, 0x55, XOR);
      expect(out["r"]).toBe(0xff);
      expect(out["neg"]).toBe(1);
    });
  });

  describe("8-bit ALU — NOT (Op=011)", () => {
    it("NOT 0xA5 = 0x5A", () => {
      expect(alu(0xa5, 0x00, NOT)["r"]).toBe(0x5a);
    });

    it("NOT 0x00 = 0xFF, Neg=1", () => {
      const out = alu(0x00, 0x00, NOT);
      expect(out["r"]).toBe(0xff);
      expect(out["neg"]).toBe(1);
    });

    it("NOT 0xFF = 0x00, Zero=1", () => {
      const out = alu(0xff, 0x00, NOT);
      expect(out["r"]).toBe(0x00);
      expect(out["zero"]).toBe(1);
    });
  });

  describe("8-bit ALU — ADD (Op=100)", () => {
    it("5 + 3 = 8", () => {
      const out = alu(5, 3, ADD);
      expect(out).toMatchObject({ r: 8, carry: 0, zero: 0, neg: 0 });
    });

    it("0x37 + 0x85 = 0xBC, no carry", () => {
      expect(alu(0x37, 0x85, ADD)).toMatchObject({ r: 0xbc, carry: 0 });
    });

    it("0xFF + 0x01 = 0x00, Carry=1, Zero=1", () => {
      const out = alu(0xff, 0x01, ADD);
      expect(out).toMatchObject({ r: 0x00, carry: 1, zero: 1 });
    });

    it("0x00 + 0x00 = 0x00, Zero=1", () => {
      const out = alu(0x00, 0x00, ADD);
      expect(out).toMatchObject({ r: 0x00, carry: 0, zero: 1 });
    });

    it("0x80 + 0x80 = 0x00, Carry=1, Zero=1", () => {
      expect(alu(0x80, 0x80, ADD)).toMatchObject({ r: 0x00, carry: 1, zero: 1 });
    });

    it("0x7F + 0x01 = 0x80, Neg=1", () => {
      expect(alu(0x7f, 0x01, ADD)).toMatchObject({ r: 0x80, neg: 1 });
    });
  });

  describe("8-bit ALU — SUB (Op=101)", () => {
    it("5 - 3 = 2, Carry=1", () => {
      expect(alu(5, 3, SUB)).toMatchObject({ r: 2, carry: 1, zero: 0, neg: 0 });
    });

    it("3 - 5 = 0xFE (-2), Carry=0, Neg=1", () => {
      expect(alu(3, 5, SUB)).toMatchObject({ r: 0xfe, carry: 0, neg: 1 });
    });

    it("0 - 1 = 0xFF, Carry=0, Neg=1", () => {
      expect(alu(0, 1, SUB)).toMatchObject({ r: 0xff, carry: 0, neg: 1 });
    });

    it("0 - 0 = 0, Carry=1, Zero=1", () => {
      expect(alu(0, 0, SUB)).toMatchObject({ r: 0x00, carry: 1, zero: 1 });
    });

    it("0xFF - 0xFF = 0, Carry=1, Zero=1", () => {
      expect(alu(0xff, 0xff, SUB)).toMatchObject({ r: 0x00, carry: 1, zero: 1 });
    });

    it("0x80 - 0x01 = 0x7F, Carry=1", () => {
      expect(alu(0x80, 0x01, SUB)).toMatchObject({ r: 0x7f, carry: 1 });
    });
  });

  describe("8-bit ALU — SHL (Op=110)", () => {
    it("0x01 << 1 = 0x02", () => {
      expect(alu(0x01, 0x00, SHL)["r"]).toBe(0x02);
    });

    it("0x80 << 1 = 0x00, Zero=1", () => {
      const out = alu(0x80, 0x00, SHL);
      expect(out["r"]).toBe(0x00);
      expect(out["zero"]).toBe(1);
    });

    it("0xFF << 1 = 0xFE, Neg=1", () => {
      const out = alu(0xff, 0x00, SHL);
      expect(out["r"]).toBe(0xfe);
      expect(out["neg"]).toBe(1);
    });

    it("0x55 << 1 = 0xAA, Neg=1", () => {
      expect(alu(0x55, 0x00, SHL)["r"]).toBe(0xaa);
    });

    it("0x00 << 1 = 0x00, Zero=1", () => {
      expect(alu(0x00, 0x00, SHL)).toMatchObject({ r: 0x00, zero: 1 });
    });
  });

  describe("8-bit ALU — SHR (Op=111)", () => {
    it("0x80 >> 1 = 0x40", () => {
      expect(alu(0x80, 0x00, SHR)["r"]).toBe(0x40);
    });

    it("0x01 >> 1 = 0x00, Zero=1", () => {
      const out = alu(0x01, 0x00, SHR);
      expect(out["r"]).toBe(0x00);
      expect(out["zero"]).toBe(1);
    });

    it("0xFF >> 1 = 0x7F", () => {
      expect(alu(0xff, 0x00, SHR)["r"]).toBe(0x7f);
    });

    it("0xAA >> 1 = 0x55", () => {
      expect(alu(0xaa, 0x00, SHR)["r"]).toBe(0x55);
    });

    it("0x00 >> 1 = 0x00, Zero=1", () => {
      expect(alu(0x00, 0x00, SHR)).toMatchObject({ r: 0x00, zero: 1 });
    });
  });

  describe("Flags — edge cases", () => {
    it("Zero flag: ADD 0+0 → Zero=1", () => {
      expect(alu(0, 0, ADD)["zero"]).toBe(1);
    });

    it("Zero flag: AND 0xA5 & 0x5A → Zero=1", () => {
      expect(alu(0xa5, 0x5a, AND)["zero"]).toBe(1);
    });

    it("Neg flag: ADD 0x7F+1 → Neg=1 (result 0x80)", () => {
      expect(alu(0x7f, 0x01, ADD)["neg"]).toBe(1);
    });

    it("Neg flag: NOT 0x00 → Neg=1 (result 0xFF)", () => {
      expect(alu(0x00, 0x00, NOT)["neg"]).toBe(1);
    });

    it("Carry flag: ADD overflow → Carry=1", () => {
      expect(alu(0xff, 0x01, ADD)["carry"]).toBe(1);
    });

    it("Carry flag: SUB no borrow → Carry=1", () => {
      expect(alu(5, 3, SUB)["carry"]).toBe(1);
    });

    it("Carry flag: SUB with borrow → Carry=0", () => {
      expect(alu(3, 5, SUB)["carry"]).toBe(0);
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
// I/O Basics fixture
// ============================================================

describe("Fixture: io-basics", () => {
  const fixture = loadFixture("io-basics");
  const modules = fixture.modules;

  describe("4-bit pass-through", () => {
    it("preserves value 0", () => {
      expect(evalModule(modules, "mod-passthrough-4bit", { d: 0 })).toMatchObject({ q: 0 });
    });

    it("preserves value 15 (0xF)", () => {
      expect(evalModule(modules, "mod-passthrough-4bit", { d: 15 })).toMatchObject({ q: 15 });
    });

    it("preserves value 0b1010 = 10", () => {
      expect(evalModule(modules, "mod-passthrough-4bit", { d: 0b1010 })).toMatchObject({ q: 0b1010 });
    });
  });

  describe("16-bit pass-through", () => {
    it("preserves value 0", () => {
      expect(evalModule(modules, "mod-passthrough-16bit", { d: 0 })).toMatchObject({ q: 0 });
    });

    it("preserves max value 0xFFFF", () => {
      expect(evalModule(modules, "mod-passthrough-16bit", { d: 0xffff })).toMatchObject({ q: 0xffff });
    });

    it("preserves value 0xABCD", () => {
      expect(evalModule(modules, "mod-passthrough-16bit", { d: 0xabcd })).toMatchObject({ q: 0xabcd });
    });
  });

  describe("Constants VCC/GND", () => {
    it("VCC is always 1 and GND is always 0", () => {
      // Constant nodes need their values seeded externally (app layer does this via canvas-to-circuit)
      // Pin name "1" → value 1, pin name "0" → value 0
      const out = evalModule(modules, "mod-constants-vcc-gnd", { cv: 1, cz: 0 });
      expect(out).toMatchObject({ vcc: 1, gnd: 0 });
    });
  });

  describe("Button to output", () => {
    it("button pressed=0 → output 0", () => {
      // Button value comes from external input (bp pin)
      const out = evalModule(modules, "mod-button-to-output", { bp: 0 });
      expect(out).toMatchObject({ q: 0 });
    });

    it("button pressed=1 → output 1", () => {
      const out = evalModule(modules, "mod-button-to-output", { bp: 1 });
      expect(out).toMatchObject({ q: 1 });
    });
  });

  describe("Clock to output", () => {
    it("clock=0 → output 0", () => {
      const out = evalModule(modules, "mod-clock-to-output", { cp: 0 });
      expect(out).toMatchObject({ q: 0 });
    });

    it("clock=1 → output 1", () => {
      const out = evalModule(modules, "mod-clock-to-output", { cp: 1 });
      expect(out).toMatchObject({ q: 1 });
    });
  });

  describe("3-way fan-out", () => {
    it("input 0 → all three outputs are 0", () => {
      const out = evalModule(modules, "mod-fanout-3way", { a: 0 });
      expect(out).toMatchObject({ y0: 0, y1: 0, y2: 0 });
    });

    it("input 1 → all three outputs are 1", () => {
      const out = evalModule(modules, "mod-fanout-3way", { a: 1 });
      expect(out).toMatchObject({ y0: 1, y1: 1, y2: 1 });
    });
  });

  describe("Probe no effect", () => {
    it("probe does not alter signal — input 0 → output 0", () => {
      const out = evalModule(modules, "mod-probe-no-effect", { a: 0 });
      expect(out).toMatchObject({ q: 0 });
    });

    it("probe does not alter signal — input 1 → output 1", () => {
      const out = evalModule(modules, "mod-probe-no-effect", { a: 1 });
      expect(out).toMatchObject({ q: 1 });
    });
  });

  describe("8-bit fan-out", () => {
    it("both outputs receive same value 0xA5", () => {
      const out = evalModule(modules, "mod-multi-bit-fanout", { d: 0xa5 });
      expect(out).toMatchObject({ q0: 0xa5, q1: 0xa5 });
    });

    it("both outputs receive same value 0x00", () => {
      const out = evalModule(modules, "mod-multi-bit-fanout", { d: 0x00 });
      expect(out).toMatchObject({ q0: 0x00, q1: 0x00 });
    });
  });
});

// ============================================================
// Bus Split/Merge fixture
// ============================================================

describe("Fixture: bus-split-merge", () => {
  const fixture = loadFixture("bus-split-merge");
  const modules = fixture.modules;

  describe("Split-Merge roundtrip 8-bit", () => {
    it("0xA5 → split → merge → 0xA5", () => {
      expect(evalModule(modules, "mod-split-merge-roundtrip-8", { d: 0xa5 })).toMatchObject({ q: 0xa5 });
    });

    it("0xFF → split → merge → 0xFF", () => {
      expect(evalModule(modules, "mod-split-merge-roundtrip-8", { d: 0xff })).toMatchObject({ q: 0xff });
    });

    it("0x00 → split → merge → 0x00", () => {
      expect(evalModule(modules, "mod-split-merge-roundtrip-8", { d: 0x00 })).toMatchObject({ q: 0x00 });
    });

    it("0x01 (only LSB) → split → merge → 0x01", () => {
      expect(evalModule(modules, "mod-split-merge-roundtrip-8", { d: 0x01 })).toMatchObject({ q: 0x01 });
    });

    it("0x80 (only MSB) → split → merge → 0x80", () => {
      expect(evalModule(modules, "mod-split-merge-roundtrip-8", { d: 0x80 })).toMatchObject({ q: 0x80 });
    });
  });

  describe("Split-Merge roundtrip 4-bit", () => {
    it("0xF → split → merge → 0xF", () => {
      expect(evalModule(modules, "mod-split-merge-roundtrip-4", { d: 0xf })).toMatchObject({ q: 0xf });
    });

    it("0x5 → split → merge → 0x5", () => {
      expect(evalModule(modules, "mod-split-merge-roundtrip-4", { d: 0x5 })).toMatchObject({ q: 0x5 });
    });

    it("0x0 → split → merge → 0x0", () => {
      expect(evalModule(modules, "mod-split-merge-roundtrip-4", { d: 0x0 })).toMatchObject({ q: 0x0 });
    });
  });

  describe("4-bit bit reverse", () => {
    // 0b1010 (10) → reversed → 0b0101 (5)
    it("0b1010 → reversed → 0b0101", () => {
      expect(evalModule(modules, "mod-bit-reverse-4", { d: 0b1010 })).toMatchObject({ q: 0b0101 });
    });

    // 0b1100 (12) → reversed → 0b0011 (3)
    it("0b1100 → reversed → 0b0011", () => {
      expect(evalModule(modules, "mod-bit-reverse-4", { d: 0b1100 })).toMatchObject({ q: 0b0011 });
    });

    // 0b1111 → reversed → 0b1111 (symmetric)
    it("0b1111 → reversed → 0b1111 (symmetric)", () => {
      expect(evalModule(modules, "mod-bit-reverse-4", { d: 0b1111 })).toMatchObject({ q: 0b1111 });
    });

    // 0b0000 → reversed → 0b0000
    it("0b0000 → reversed → 0b0000", () => {
      expect(evalModule(modules, "mod-bit-reverse-4", { d: 0b0000 })).toMatchObject({ q: 0b0000 });
    });

    // 0b0001 → reversed → 0b1000
    it("0b0001 → reversed → 0b1000", () => {
      expect(evalModule(modules, "mod-bit-reverse-4", { d: 0b0001 })).toMatchObject({ q: 0b1000 });
    });
  });

  describe("Lower nibble extract", () => {
    it("0xA5 → lower nibble → 0x05", () => {
      expect(evalModule(modules, "mod-lower-nibble-extract", { d: 0xa5 })).toMatchObject({ q: 0x05 });
    });

    it("0xFF → lower nibble → 0x0F", () => {
      expect(evalModule(modules, "mod-lower-nibble-extract", { d: 0xff })).toMatchObject({ q: 0x0f });
    });

    it("0xF0 → lower nibble → 0x00", () => {
      expect(evalModule(modules, "mod-lower-nibble-extract", { d: 0xf0 })).toMatchObject({ q: 0x00 });
    });

    it("0x00 → lower nibble → 0x00", () => {
      expect(evalModule(modules, "mod-lower-nibble-extract", { d: 0x00 })).toMatchObject({ q: 0x00 });
    });
  });

  describe("Nibble swap", () => {
    it("0xA5 → swap → 0x5A", () => {
      expect(evalModule(modules, "mod-nibble-swap", { d: 0xa5 })).toMatchObject({ q: 0x5a });
    });

    it("0x12 → swap → 0x21", () => {
      expect(evalModule(modules, "mod-nibble-swap", { d: 0x12 })).toMatchObject({ q: 0x21 });
    });

    it("0xFF → swap → 0xFF (symmetric)", () => {
      expect(evalModule(modules, "mod-nibble-swap", { d: 0xff })).toMatchObject({ q: 0xff });
    });

    it("0x00 → swap → 0x00", () => {
      expect(evalModule(modules, "mod-nibble-swap", { d: 0x00 })).toMatchObject({ q: 0x00 });
    });

    it("0xF0 → swap → 0x0F", () => {
      expect(evalModule(modules, "mod-nibble-swap", { d: 0xf0 })).toMatchObject({ q: 0x0f });
    });
  });
});

// ============================================================
// I/O Peripherals Advanced fixture
// ============================================================

describe("Fixture: io-peripherals-advanced", () => {
  const fixture = loadFixture("io-peripherals-advanced");
  const modules = fixture.modules;

  describe("DIP bitwise NOT to LED", () => {
    it("DIP=0xA5 → NOT → LED=0x5A", () => {
      const out = evalModule(modules, "mod-dip-bitwise-not-led", { dp: 0xa5 });
      expect(out).toMatchObject({ q: 0x5a });
    });

    it("DIP=0xFF → NOT → LED=0x00", () => {
      const out = evalModule(modules, "mod-dip-bitwise-not-led", { dp: 0xff });
      expect(out).toMatchObject({ q: 0x00 });
    });

    it("DIP=0x00 → NOT → LED=0xFF", () => {
      const out = evalModule(modules, "mod-dip-bitwise-not-led", { dp: 0x00 });
      expect(out).toMatchObject({ q: 0xff });
    });

    it("DIP=0x0F → NOT → LED=0xF0", () => {
      const out = evalModule(modules, "mod-dip-bitwise-not-led", { dp: 0x0f });
      expect(out).toMatchObject({ q: 0xf0 });
    });
  });

  describe("Two DIP AND to Hex", () => {
    it("0xFF AND 0x0F = 0x0F", () => {
      const out = evalModule(modules, "mod-two-dip-and-hex", { a: 0xff, b: 0x0f });
      expect(out).toMatchObject({ q: 0x0f });
    });

    it("0xA5 AND 0x5A = 0x00", () => {
      const out = evalModule(modules, "mod-two-dip-and-hex", { a: 0xa5, b: 0x5a });
      expect(out).toMatchObject({ q: 0x00 });
    });

    it("0xFF AND 0xFF = 0xFF", () => {
      const out = evalModule(modules, "mod-two-dip-and-hex", { a: 0xff, b: 0xff });
      expect(out).toMatchObject({ q: 0xff });
    });

    it("0x00 AND 0xFF = 0x00", () => {
      const out = evalModule(modules, "mod-two-dip-and-hex", { a: 0x00, b: 0xff });
      expect(out).toMatchObject({ q: 0x00 });
    });
  });

  describe("DIP direct to Hex and LED", () => {
    it("pass-through 0xA5 to all outputs", () => {
      const out = evalModule(modules, "mod-dip-direct-hex-led", { d: 0xa5 });
      expect(out).toMatchObject({ q: 0xa5 });
    });

    it("pass-through 0x00 to all outputs", () => {
      const out = evalModule(modules, "mod-dip-direct-hex-led", { d: 0x00 });
      expect(out).toMatchObject({ q: 0x00 });
    });

    it("variant nodes preserved", () => {
      const mod = findModule(modules, "mod-dip-direct-hex-led");
      const dip = mod.circuit.nodes.find((n) => n.variant === "dip-switch");
      const hex = mod.circuit.nodes.find((n) => n.variant === "hex-display");
      const led = mod.circuit.nodes.find((n) => n.variant === "led-bar");
      expect(dip).toBeDefined();
      expect(hex).toBeDefined();
      expect(led).toBeDefined();
    });
  });

  describe("4-bit DIP to Hex", () => {
    it("pass-through 0xF", () => {
      const out = evalModule(modules, "mod-4bit-dip-hex", { d: 0xf });
      expect(out).toMatchObject({ q: 0xf });
    });

    it("pass-through 0x0", () => {
      const out = evalModule(modules, "mod-4bit-dip-hex", { d: 0x0 });
      expect(out).toMatchObject({ q: 0x0 });
    });

    it("pass-through 0xA", () => {
      const out = evalModule(modules, "mod-4bit-dip-hex", { d: 0xa });
      expect(out).toMatchObject({ q: 0xa });
    });

    it("4-bit variants preserved", () => {
      const mod = findModule(modules, "mod-4bit-dip-hex");
      const dip = mod.circuit.nodes.find((n) => n.variant === "dip-switch");
      const hex = mod.circuit.nodes.find((n) => n.variant === "hex-display");
      expect(dip).toBeDefined();
      expect(hex).toBeDefined();
      expect(dip!.pins[0]!.bits).toBe(4);
      expect(hex!.pins[0]!.bits).toBe(4);
    });
  });
});

// ============================================================
// Tunnel Advanced fixture
// ============================================================

describe("Fixture: tunnel-advanced", () => {
  const fixture = loadFixture("tunnel-advanced");
  const modules = fixture.modules;

  describe("8-bit tunnel", () => {
    it("0xA5 passes through 8-bit tunnel", () => {
      const out = evalModuleWithTunnels(modules, "mod-tunnel-8bit", { d: 0xa5 });
      expect(out).toMatchObject({ q: 0xa5 });
    });

    it("0xFF passes through 8-bit tunnel", () => {
      const out = evalModuleWithTunnels(modules, "mod-tunnel-8bit", { d: 0xff });
      expect(out).toMatchObject({ q: 0xff });
    });

    it("0x00 passes through 8-bit tunnel", () => {
      const out = evalModuleWithTunnels(modules, "mod-tunnel-8bit", { d: 0x00 });
      expect(out).toMatchObject({ q: 0x00 });
    });
  });

  describe("Multi-name tunnels", () => {
    it("independent signals — A=1, B=0 → QA=1, QB=0", () => {
      const out = evalModuleWithTunnels(modules, "mod-tunnel-multi-name", { a: 1, b: 0 });
      expect(out).toMatchObject({ qa: 1, qb: 0 });
    });

    it("independent signals — A=0, B=1 → QA=0, QB=1", () => {
      const out = evalModuleWithTunnels(modules, "mod-tunnel-multi-name", { a: 0, b: 1 });
      expect(out).toMatchObject({ qa: 0, qb: 1 });
    });

    it("both signals same — A=1, B=1 → QA=1, QB=1", () => {
      const out = evalModuleWithTunnels(modules, "mod-tunnel-multi-name", { a: 1, b: 1 });
      expect(out).toMatchObject({ qa: 1, qb: 1 });
    });
  });

  describe("Tunnel fan-out", () => {
    it("input 1 → both outputs receive 1", () => {
      const out = evalModuleWithTunnels(modules, "mod-tunnel-fanout", { d: 1 });
      expect(out).toMatchObject({ q0: 1, q1: 1 });
    });

    it("input 0 → both outputs receive 0", () => {
      const out = evalModuleWithTunnels(modules, "mod-tunnel-fanout", { d: 0 });
      expect(out).toMatchObject({ q0: 0, q1: 0 });
    });
  });

  describe("Tunnel with logic (NOT)", () => {
    it("input 0 → tunnel X → NOT → tunnel Y → output 1", () => {
      const out = evalModuleWithTunnels(modules, "mod-tunnel-with-logic", { a: 0 });
      expect(out).toMatchObject({ q: 1 });
    });

    it("input 1 → tunnel X → NOT → tunnel Y → output 0", () => {
      const out = evalModuleWithTunnels(modules, "mod-tunnel-with-logic", { a: 1 });
      expect(out).toMatchObject({ q: 0 });
    });
  });

  describe("Tunnel chain (P → Q → R)", () => {
    it("input 1 passes through 3 tunnel pairs", () => {
      const out = evalModuleWithTunnels(modules, "mod-tunnel-chain", { a: 1 });
      expect(out).toMatchObject({ q: 1 });
    });

    it("input 0 passes through 3 tunnel pairs", () => {
      const out = evalModuleWithTunnels(modules, "mod-tunnel-chain", { a: 0 });
      expect(out).toMatchObject({ q: 0 });
    });
  });
});

// ============================================================
// Clock + Button Sequential fixture
// ============================================================

describe("Fixture: clock-button-sequential", () => {
  const fixture = loadFixture("clock-button-sequential");
  const modules = fixture.modules;

  describe("Clock-driven D Flip-Flop", () => {
    it("has clock and button nodes", () => {
      const mod = findModule(modules, "mod-clock-driven-dff");
      const clockNode = mod.circuit.nodes.find((n) => n.type === "clock");
      const buttonNode = mod.circuit.nodes.find((n) => n.type === "button");
      expect(clockNode).toBeDefined();
      expect(buttonNode).toBeDefined();
    });

    it("button=1, clock=1 → DFF captures data", () => {
      const out = evalModule(modules, "mod-clock-driven-dff", { bp: 1, cp: 1 });
      expect(out).toMatchObject({ q: 1 });
    });
  });

  describe("Button SR control", () => {
    it("has two button nodes", () => {
      const mod = findModule(modules, "mod-button-sr-control");
      const buttons = mod.circuit.nodes.filter((n) => n.type === "button");
      expect(buttons.length).toBe(2);
    });

    // NAND SR: S=1, R=1 → hold; S=0, R=1 → set Q=1; S=1, R=0 → reset Q=0
    it("SET pressed (S=0), RST not pressed (R=1) → Q=1", () => {
      // For NAND SR latch: active-low inputs
      const out = evalModule(modules, "mod-button-sr-control", { bs: 0, br: 1 });
      expect(out["q"]).toBe(1);
    });

    it("SET not pressed (S=1), RST pressed (R=0) → Q=0", () => {
      const out = evalModule(modules, "mod-button-sr-control", { bs: 1, br: 0 });
      expect(out["q"]).toBe(0);
    });
  });

  describe("Clock + Button enable (gated clock)", () => {
    it("clock=1, button=1 → gated clock passes (AND=1)", () => {
      // AND(1,1) = 1 via NAND-NAND
      const out = evalModule(modules, "mod-clock-and-button-enable", { d: 1, cp: 1, bp: 1 });
      expect(out).toMatchObject({ q: 1 });
    });

    it("clock=1, button=0 → gated clock blocked (AND=0)", () => {
      // AND(1,0) = 0 → DFF clock stays low
      const mod = findModule(modules, "mod-clock-and-button-enable");
      expect(mod.circuit.nodes.find((n) => n.type === "clock")).toBeDefined();
      expect(mod.circuit.nodes.find((n) => n.type === "button")).toBeDefined();
    });
  });

  describe("Button Toggle (D Latch)", () => {
    it("has constant and button nodes", () => {
      const mod = findModule(modules, "mod-button-toggle");
      const constNode = mod.circuit.nodes.find((n) => n.type === "constant");
      const buttonNode = mod.circuit.nodes.find((n) => n.type === "button");
      expect(constNode).toBeDefined();
      expect(buttonNode).toBeDefined();
      // Constant should be VCC (pin name "1")
      expect(constNode!.pins[0]!.name).toBe("1");
    });

    it("button pressed (EN=1) with VCC on D → Q=1", () => {
      // Constant VCC (pin cv, name "1") needs seeded value
      const out = evalModule(modules, "mod-button-toggle", { bp: 1, cv: 1 });
      expect(out).toMatchObject({ q: 1 });
    });
  });
});

// ============================================================
// Tristate bus fixture
// ============================================================

describe("Fixture: tristate-bus", () => {
  const fixture = loadFixture("tristate-bus");
  const modules = fixture.modules;

  describe("Tristate basic (1-bit)", () => {
    it("EN=1, D=0 → Y=0 (driven low)", () => {
      expect(evalModule(modules, "mod-tristate-basic", { d: 0, en: 1 })).toMatchObject({ y: 0 });
    });

    it("EN=1, D=1 → Y=1 (driven high)", () => {
      expect(evalModule(modules, "mod-tristate-basic", { d: 1, en: 1 })).toMatchObject({ y: 1 });
    });

    it("EN=0 → Y=Z (high impedance)", () => {
      expect(evalModule(modules, "mod-tristate-basic", { d: 1, en: 0 })).toMatchObject({ y: Z_VALUE });
    });
  });

  describe("Pull-up alone", () => {
    it("always outputs 1 (weak high)", () => {
      expect(evalModule(modules, "mod-pullup-alone", {})).toMatchObject({ y: 1 });
    });
  });

  describe("Pull-down alone", () => {
    it("always outputs 0 (weak low)", () => {
      expect(evalModule(modules, "mod-pulldown-alone", {})).toMatchObject({ y: 0 });
    });
  });

  describe("Tristate + Pull-up (open-drain)", () => {
    it("EN=0 → pull-up wins → Y=1", () => {
      // Tristate outputs Z, only WEAK_1 remains on bus
      expect(evalModule(modules, "mod-tristate-pullup", { d: 0, en: 0 })).toMatchObject({ y: 1 });
    });

    it("EN=1, D=0 → strong 0 beats weak pull-up → Y=0", () => {
      expect(evalModule(modules, "mod-tristate-pullup", { d: 0, en: 1 })).toMatchObject({ y: 0 });
    });

    it("EN=1, D=1 → strong 1, pull-up agrees → Y=1", () => {
      expect(evalModule(modules, "mod-tristate-pullup", { d: 1, en: 1 })).toMatchObject({ y: 1 });
    });
  });

  describe("Shared bus — 2 tri-state drivers", () => {
    it("only ts1 enabled, D1=0 → Y=0", () => {
      expect(evalModule(modules, "mod-bus-2drivers", { d1: 0, en1: 1, d2: 0, en2: 0 })).toMatchObject({ y: 0 });
    });

    it("only ts1 enabled, D1=1 → Y=1", () => {
      expect(evalModule(modules, "mod-bus-2drivers", { d1: 1, en1: 1, d2: 0, en2: 0 })).toMatchObject({ y: 1 });
    });

    it("only ts2 enabled, D2=0 → Y=0", () => {
      expect(evalModule(modules, "mod-bus-2drivers", { d1: 0, en1: 0, d2: 0, en2: 1 })).toMatchObject({ y: 0 });
    });

    it("only ts2 enabled, D2=1 → Y=1", () => {
      expect(evalModule(modules, "mod-bus-2drivers", { d1: 0, en1: 0, d2: 1, en2: 1 })).toMatchObject({ y: 1 });
    });

    it("both enabled, agree on 1 → Y=1", () => {
      expect(evalModule(modules, "mod-bus-2drivers", { d1: 1, en1: 1, d2: 1, en2: 1 })).toMatchObject({ y: 1 });
    });

    it("both enabled, agree on 0 → Y=0", () => {
      expect(evalModule(modules, "mod-bus-2drivers", { d1: 0, en1: 1, d2: 0, en2: 1 })).toMatchObject({ y: 0 });
    });

    it("both enabled, disagree → Y=CONFLICT", () => {
      expect(evalModule(modules, "mod-bus-2drivers", { d1: 0, en1: 1, d2: 1, en2: 1 })).toMatchObject({ y: CONFLICT });
    });

    it("neither enabled → Y=Z (floating bus)", () => {
      expect(evalModule(modules, "mod-bus-2drivers", { d1: 0, en1: 0, d2: 0, en2: 0 })).toMatchObject({ y: Z_VALUE });
    });
  });

  describe("Shared bus — 2 drivers + pull-down", () => {
    it("both disabled → pull-down wins → Y=0", () => {
      expect(evalModule(modules, "mod-bus-2drivers-pulldown", { d1: 0, en1: 0, d2: 0, en2: 0 })).toMatchObject({ y: 0 });
    });

    it("ts1 enabled, D1=1 → strong 1 beats pull-down → Y=1", () => {
      expect(evalModule(modules, "mod-bus-2drivers-pulldown", { d1: 1, en1: 1, d2: 0, en2: 0 })).toMatchObject({ y: 1 });
    });

    it("ts1 enabled, D1=0 → strong 0, pull-down agrees → Y=0", () => {
      expect(evalModule(modules, "mod-bus-2drivers-pulldown", { d1: 0, en1: 1, d2: 0, en2: 0 })).toMatchObject({ y: 0 });
    });

    it("both enabled, disagree → Y=CONFLICT (pull-down is weak, ignored)", () => {
      expect(evalModule(modules, "mod-bus-2drivers-pulldown", { d1: 0, en1: 1, d2: 1, en2: 1 })).toMatchObject({ y: CONFLICT });
    });
  });

  describe("Tri-state 8-bit bus driver", () => {
    it("EN=1, D=0xA5 → Y=0xA5", () => {
      expect(evalModule(modules, "mod-tristate-8bit", { d: 0xa5, en: 1 })).toMatchObject({ y: 0xa5 });
    });

    it("EN=1, D=0xFF → Y=0xFF", () => {
      expect(evalModule(modules, "mod-tristate-8bit", { d: 0xff, en: 1 })).toMatchObject({ y: 0xff });
    });

    it("EN=1, D=0x00 → Y=0x00", () => {
      expect(evalModule(modules, "mod-tristate-8bit", { d: 0x00, en: 1 })).toMatchObject({ y: 0x00 });
    });

    it("EN=0 → Y=Z (8-bit high impedance)", () => {
      expect(evalModule(modules, "mod-tristate-8bit", { d: 0xa5, en: 0 })).toMatchObject({ y: Z_VALUE });
    });
  });

  describe("Bus multiplexer (tristate MUX)", () => {
    // SEL=1 → tsA enabled (EN=SEL=1), tsB disabled (EN=NAND(1,1)=0) → Y=A
    it("SEL=1, A=0 → Y=0", () => {
      expect(evalModule(modules, "mod-bidirectional-mux", { a: 0, b: 1, sel: 1 })).toMatchObject({ y: 0 });
    });

    it("SEL=1, A=1 → Y=1", () => {
      expect(evalModule(modules, "mod-bidirectional-mux", { a: 1, b: 0, sel: 1 })).toMatchObject({ y: 1 });
    });

    // SEL=0 → tsA disabled (EN=0), tsB enabled (EN=NAND(0,0)=1) → Y=B
    it("SEL=0, B=0 → Y=0", () => {
      expect(evalModule(modules, "mod-bidirectional-mux", { a: 1, b: 0, sel: 0 })).toMatchObject({ y: 0 });
    });

    it("SEL=0, B=1 → Y=1", () => {
      expect(evalModule(modules, "mod-bidirectional-mux", { a: 0, b: 1, sel: 0 })).toMatchObject({ y: 1 });
    });
  });
});

// ============================================================
// CPU Components fixture
// ============================================================

describe("Fixture: cpu-components", () => {
  const fixture = loadFixture("cpu-components");
  const modules = fixture.modules;

  // Helper: evaluate with persistent instance state (sequential circuits)
  function evalWithState(
    moduleId: string,
    inputs: Record<string, number>,
    instanceStates: Map<string, InstanceState>,
  ): Record<string, number> {
    const mod = findModule(modules, moduleId);
    const { outputs } = evaluateCircuitWithState(
      mod.circuit, inputs, modules, undefined, instanceStates,
    );
    return outputs;
  }

  // ---- mod-inc8 (combinational) ----

  describe("8-bit Incrementer (mod-inc8)", () => {
    it("0 → 1", () => {
      expect(evalModule(modules, "mod-inc8", { a: 0 })).toMatchObject({ s: 1, cout: 0 });
    });

    it("1 → 2", () => {
      expect(evalModule(modules, "mod-inc8", { a: 1 })).toMatchObject({ s: 2, cout: 0 });
    });

    it("127 → 128", () => {
      expect(evalModule(modules, "mod-inc8", { a: 127 })).toMatchObject({ s: 128, cout: 0 });
    });

    it("254 → 255", () => {
      expect(evalModule(modules, "mod-inc8", { a: 254 })).toMatchObject({ s: 255, cout: 0 });
    });

    it("255 → 0 (overflow wrap)", () => {
      expect(evalModule(modules, "mod-inc8", { a: 255 })).toMatchObject({ s: 0, cout: 1 });
    });
  });

  // ---- mod-mux8-2 (combinational) ----

  describe("8-bit MUX 2:1 (mod-mux8-2)", () => {
    it("S=0 selects A", () => {
      expect(evalModule(modules, "mod-mux8-2", { a: 0xAB, b: 0xCD, s: 0 })).toMatchObject({ y: 0xAB });
    });

    it("S=1 selects B", () => {
      expect(evalModule(modules, "mod-mux8-2", { a: 0xAB, b: 0xCD, s: 1 })).toMatchObject({ y: 0xCD });
    });

    it("S=0, A=0x00 → Y=0x00", () => {
      expect(evalModule(modules, "mod-mux8-2", { a: 0x00, b: 0xFF, s: 0 })).toMatchObject({ y: 0x00 });
    });

    it("S=1, B=0xFF → Y=0xFF", () => {
      expect(evalModule(modules, "mod-mux8-2", { a: 0x00, b: 0xFF, s: 1 })).toMatchObject({ y: 0xFF });
    });
  });

  // ---- mod-reg8 (sequential) ----

  describe("8-bit Register (mod-reg8)", () => {
    it("load value on rising edge (EN=1)", () => {
      const st = new Map<string, InstanceState>();

      // CLK=0 (low): present data
      evalWithState("mod-reg8", { d: 0x42, clk: 0, en: 1 }, st);
      // CLK=1 (rising edge): capture
      const r = evalWithState("mod-reg8", { d: 0x42, clk: 1, en: 1 }, st);
      expect(r["q"]).toBe(0x42);
    });

    it("hold value when EN=0", () => {
      const st = new Map<string, InstanceState>();

      // Load 0xAA
      evalWithState("mod-reg8", { d: 0xAA, clk: 0, en: 1 }, st);
      evalWithState("mod-reg8", { d: 0xAA, clk: 1, en: 1 }, st);

      // Try to load 0x55 with EN=0 — should hold 0xAA
      evalWithState("mod-reg8", { d: 0x55, clk: 0, en: 0 }, st);
      const r = evalWithState("mod-reg8", { d: 0x55, clk: 1, en: 0 }, st);
      expect(r["q"]).toBe(0xAA);
    });

    it("overwrite with new value", () => {
      const st = new Map<string, InstanceState>();

      // Load 0x11
      evalWithState("mod-reg8", { d: 0x11, clk: 0, en: 1 }, st);
      evalWithState("mod-reg8", { d: 0x11, clk: 1, en: 1 }, st);

      // Load 0x22
      evalWithState("mod-reg8", { d: 0x22, clk: 0, en: 1 }, st);
      const r = evalWithState("mod-reg8", { d: 0x22, clk: 1, en: 1 }, st);
      expect(r["q"]).toBe(0x22);
    });
  });

  // ---- mod-pc (sequential) ----

  describe("Program Counter (mod-pc)", () => {
    it("reset sets PC to 0", () => {
      const st = new Map<string, InstanceState>();

      // Reset=1, clock edge
      evalWithState("mod-pc", { clk: 0, load: 0, rst: 1, addrin: 0 }, st);
      const r = evalWithState("mod-pc", { clk: 1, load: 0, rst: 1, addrin: 0 }, st);
      expect(r["pc"]).toBe(0);
    });

    it("auto-increment 0→1→2→3", () => {
      const st = new Map<string, InstanceState>();

      // Reset first
      evalWithState("mod-pc", { clk: 0, load: 0, rst: 1, addrin: 0 }, st);
      evalWithState("mod-pc", { clk: 1, load: 0, rst: 1, addrin: 0 }, st);

      // Tick 1: 0→1
      evalWithState("mod-pc", { clk: 0, load: 0, rst: 0, addrin: 0 }, st);
      let r = evalWithState("mod-pc", { clk: 1, load: 0, rst: 0, addrin: 0 }, st);
      expect(r["pc"]).toBe(1);

      // Tick 2: 1→2
      evalWithState("mod-pc", { clk: 0, load: 0, rst: 0, addrin: 0 }, st);
      r = evalWithState("mod-pc", { clk: 1, load: 0, rst: 0, addrin: 0 }, st);
      expect(r["pc"]).toBe(2);

      // Tick 3: 2→3
      evalWithState("mod-pc", { clk: 0, load: 0, rst: 0, addrin: 0 }, st);
      r = evalWithState("mod-pc", { clk: 1, load: 0, rst: 0, addrin: 0 }, st);
      expect(r["pc"]).toBe(3);
    });

    it("load jump address", () => {
      const st = new Map<string, InstanceState>();

      // Reset
      evalWithState("mod-pc", { clk: 0, load: 0, rst: 1, addrin: 0 }, st);
      evalWithState("mod-pc", { clk: 1, load: 0, rst: 1, addrin: 0 }, st);

      // Load address 0x42
      evalWithState("mod-pc", { clk: 0, load: 1, rst: 0, addrin: 0x42 }, st);
      const r = evalWithState("mod-pc", { clk: 1, load: 1, rst: 0, addrin: 0x42 }, st);
      expect(r["pc"]).toBe(0x42);
    });

    it("increment after jump", () => {
      const st = new Map<string, InstanceState>();

      // Reset
      evalWithState("mod-pc", { clk: 0, load: 0, rst: 1, addrin: 0 }, st);
      evalWithState("mod-pc", { clk: 1, load: 0, rst: 1, addrin: 0 }, st);

      // Jump to 0x10
      evalWithState("mod-pc", { clk: 0, load: 1, rst: 0, addrin: 0x10 }, st);
      evalWithState("mod-pc", { clk: 1, load: 1, rst: 0, addrin: 0x10 }, st);

      // Increment: 0x10 → 0x11
      evalWithState("mod-pc", { clk: 0, load: 0, rst: 0, addrin: 0 }, st);
      const r = evalWithState("mod-pc", { clk: 1, load: 0, rst: 0, addrin: 0 }, st);
      expect(r["pc"]).toBe(0x11);
    });

    it("reset priority over load", () => {
      const st = new Map<string, InstanceState>();

      // Both reset and load active — reset should win
      evalWithState("mod-pc", { clk: 0, load: 1, rst: 1, addrin: 0xFF }, st);
      const r = evalWithState("mod-pc", { clk: 1, load: 1, rst: 1, addrin: 0xFF }, st);
      expect(r["pc"]).toBe(0);
    });

    it("wrap-around 255→0", () => {
      const st = new Map<string, InstanceState>();

      // Jump to 0xFF
      evalWithState("mod-pc", { clk: 0, load: 1, rst: 0, addrin: 0xFF }, st);
      evalWithState("mod-pc", { clk: 1, load: 1, rst: 0, addrin: 0xFF }, st);

      // Increment: 0xFF → 0x00 (wrap)
      evalWithState("mod-pc", { clk: 0, load: 0, rst: 0, addrin: 0 }, st);
      const r = evalWithState("mod-pc", { clk: 1, load: 0, rst: 0, addrin: 0 }, st);
      expect(r["pc"]).toBe(0);
    });
  });

  // ---- Decoder ROM (combinational) ----

  describe("Instruction Decoder ROM", () => {
    // The decoder is a ROM node pre-programmed with control signals.
    // We test the decoder ROM data table directly against expected control words.

    const decoderRom = [
      0x00, 0x81, 0x84, 0x02, 0x80, 0xE0, 0xE8, 0xC0,
      0xC8, 0xD0, 0xD8, 0xF0, 0xF8, 0x00, 0x00, 0x00,
    ];

    // Helper to extract control signal fields from control word
    function decodeControl(word: number) {
      return {
        reg_write: (word >> 7) & 1,
        alu_en:    (word >> 6) & 1,
        alu_op:    (word >> 3) & 7,
        mem_read:  (word >> 2) & 1,
        mem_write: (word >> 1) & 1,
        imm_sel:   (word >> 0) & 1,
      };
    }

    it("0x0 NOP — no signals active", () => {
      expect(decodeControl(decoderRom[0]!)).toMatchObject({
        reg_write: 0, alu_en: 0, mem_read: 0, mem_write: 0, imm_sel: 0,
      });
    });

    it("0x1 LDI — reg_write + imm_sel", () => {
      expect(decodeControl(decoderRom[1]!)).toMatchObject({
        reg_write: 1, alu_en: 0, mem_read: 0, mem_write: 0, imm_sel: 1,
      });
    });

    it("0x2 LD — reg_write + mem_read", () => {
      expect(decodeControl(decoderRom[2]!)).toMatchObject({
        reg_write: 1, alu_en: 0, mem_read: 1, mem_write: 0, imm_sel: 0,
      });
    });

    it("0x3 ST — mem_write only", () => {
      expect(decodeControl(decoderRom[3]!)).toMatchObject({
        reg_write: 0, alu_en: 0, mem_read: 0, mem_write: 1, imm_sel: 0,
      });
    });

    it("0x4 MOV — reg_write only", () => {
      expect(decodeControl(decoderRom[4]!)).toMatchObject({
        reg_write: 1, alu_en: 0, mem_read: 0, mem_write: 0, imm_sel: 0,
      });
    });

    it("0x5 ADD — reg_write + alu_en, alu_op=100", () => {
      expect(decodeControl(decoderRom[5]!)).toMatchObject({
        reg_write: 1, alu_en: 1, alu_op: 0b100, mem_read: 0, mem_write: 0,
      });
    });

    it("0x6 SUB — reg_write + alu_en, alu_op=101", () => {
      expect(decodeControl(decoderRom[6]!)).toMatchObject({
        reg_write: 1, alu_en: 1, alu_op: 0b101, mem_read: 0, mem_write: 0,
      });
    });

    it("0x7 AND — reg_write + alu_en, alu_op=000", () => {
      expect(decodeControl(decoderRom[7]!)).toMatchObject({
        reg_write: 1, alu_en: 1, alu_op: 0b000, mem_read: 0, mem_write: 0,
      });
    });

    it("0x8 OR — reg_write + alu_en, alu_op=001", () => {
      expect(decodeControl(decoderRom[8]!)).toMatchObject({
        reg_write: 1, alu_en: 1, alu_op: 0b001, mem_read: 0, mem_write: 0,
      });
    });

    it("0x9 XOR — reg_write + alu_en, alu_op=010", () => {
      expect(decodeControl(decoderRom[9]!)).toMatchObject({
        reg_write: 1, alu_en: 1, alu_op: 0b010, mem_read: 0, mem_write: 0,
      });
    });

    it("0xA NOT — reg_write + alu_en, alu_op=011", () => {
      expect(decodeControl(decoderRom[10]!)).toMatchObject({
        reg_write: 1, alu_en: 1, alu_op: 0b011, mem_read: 0, mem_write: 0,
      });
    });

    it("0xB SHL — reg_write + alu_en, alu_op=110", () => {
      expect(decodeControl(decoderRom[11]!)).toMatchObject({
        reg_write: 1, alu_en: 1, alu_op: 0b110, mem_read: 0, mem_write: 0,
      });
    });

    it("0xC SHR — reg_write + alu_en, alu_op=111", () => {
      expect(decodeControl(decoderRom[12]!)).toMatchObject({
        reg_write: 1, alu_en: 1, alu_op: 0b111, mem_read: 0, mem_write: 0,
      });
    });

    it("0xD JMP — no data-path signals (control unit decodes jump)", () => {
      expect(decodeControl(decoderRom[13]!)).toMatchObject({
        reg_write: 0, alu_en: 0, mem_read: 0, mem_write: 0,
      });
    });

    it("0xE JZ — no data-path signals (control unit decodes jump)", () => {
      expect(decodeControl(decoderRom[14]!)).toMatchObject({
        reg_write: 0, alu_en: 0, mem_read: 0, mem_write: 0,
      });
    });

    it("0xF HALT — no data-path signals (control unit decodes halt)", () => {
      expect(decodeControl(decoderRom[15]!)).toMatchObject({
        reg_write: 0, alu_en: 0, mem_read: 0, mem_write: 0,
      });
    });
  });

  // ---- Decoder via ROM node (engine integration) ----

  describe("Decoder ROM via engine", () => {
    it("ROM lookup matches decoder table for all 16 opcodes", () => {
      const expectedRom = [
        0x00, 0x81, 0x84, 0x02, 0x80, 0xE0, 0xE8, 0xC0,
        0xC8, 0xD0, 0xD8, 0xF0, 0xF8, 0x00, 0x00, 0x00,
      ];

      // Build a small test circuit: ROM with decoder data, 4-bit addr input, 8-bit data output
      const romCircuit = {
        id: "decoder-rom-test",
        name: "Decoder ROM Test",
        nodes: [
          {
            id: "addr_in", type: "input" as const,
            position: { x: 0, y: 0 }, rotation: 0 as const,
            pins: [{ id: "addr", name: "Addr", direction: "output" as const, bits: 4 as const }],
          },
          {
            id: "rom1", type: "rom" as const,
            position: { x: 200, y: 0 }, rotation: 0 as const,
            pins: [
              { id: "ra", name: "Addr", direction: "input" as const, bits: 4 as const },
              { id: "rd", name: "Data", direction: "output" as const, bits: 8 as const },
            ],
            romData: expectedRom,
          },
          {
            id: "data_out", type: "output" as const,
            position: { x: 400, y: 0 }, rotation: 0 as const,
            pins: [{ id: "data", name: "Data", direction: "input" as const, bits: 8 as const }],
          },
        ],
        edges: [
          { id: "e1", fromNodeId: "addr_in", fromPinId: "addr", toNodeId: "rom1", toPinId: "ra" },
          { id: "e2", fromNodeId: "rom1", fromPinId: "rd", toNodeId: "data_out", toPinId: "data" },
        ],
      };

      for (let opcode = 0; opcode < 16; opcode++) {
        const result = evaluateCircuit(romCircuit, { addr: opcode }, modules);
        expect(result["data"]).toBe(expectedRom[opcode]);
      }
    });
  });
});

// ============================================================
// Fixture structural checks
// ============================================================

describe("Fixture structural integrity", () => {
  const fixtureNames = [
    "gates", "mux-demux", "decoder", "adder",
    "alu-8bit", "flip-flops", "counter-4bit", "bus-peripherals-demo",
    "io-basics", "bus-split-merge", "io-peripherals-advanced",
    "tunnel-advanced", "clock-button-sequential", "tristate-bus",
    "cpu-components",
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
