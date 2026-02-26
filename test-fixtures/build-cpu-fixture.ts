#!/usr/bin/env npx tsx
/**
 * CPU components fixture builder.
 * Generates test-fixtures/cpu-components.json with:
 * - Program Counter (mod-pc) and its sub-modules
 * - Decoder ROM data table
 *
 * Usage: npx tsx test-fixtures/build-cpu-fixture.ts > test-fixtures/cpu-components.json
 */

import {
  type CircuitNode, type Pin, type Module,
  pn, iNode, oNode, cNode, mNode, mkMod, edgeCounter,
  buildNot, buildAnd, buildOr, buildXor,
  buildMux2, buildMux4, buildHalfAdder, buildFullAdder,
} from "./alu-fixture-helpers.ts";

import { buildReg8, buildInc8, buildMux8_2 } from "./cpu-fixture-helpers.ts";

// ---- Flip-flop dependencies (imported from flip-flops.json at runtime) ----
// We need: mod-sr-latch, mod-d-latch, mod-d-flipflop, mod-not, mod-xor
// These are already in flip-flops.json but we need to include them in this
// fixture so it's self-contained. Re-build them here using the same structure.

import flipFlopsData from "./flip-flops.json" with { type: "json" };

const flipFlopModules = (flipFlopsData as unknown as { modules: Module[] }).modules
  .filter(m => ["mod-sr-latch", "mod-d-latch", "mod-not", "mod-xor", "mod-d-flipflop"].includes(m.id));

// ---- mod-pc — Program Counter ----
//
// Inputs:  CLK (1-bit), Load (1-bit), Reset (1-bit), AddrIn (8-bit)
// Outputs: PC (8-bit)
//
// Behaviour (synchronous, rising-edge triggered):
//   Reset=1 → PC = 0x00
//   Load=1  → PC = AddrIn (jump)
//   Else    → PC = PC + 1 (auto-increment)
//   Priority: Reset > Load > Increment
//
// Architecture:
//   inc8(reg_out) → inc_val
//   mux8_2(inc_val, addr_in, load) → mux1_out      (select increment vs jump)
//   8× AND(mux1_out[i], NOT reset) → gated          (zero on reset)
//   reg8(gated, clk, 1) → reg_out → PC              (always enabled)

function buildPC(): Module {
  const nodes: CircuitNode[] = [];
  const { edges, add } = edgeCounter();

  // 4 inputs
  nodes.push(iNode("clki", "clk", "CLK", 0, 0));
  nodes.push(iNode("loadi", "load", "Load", 0, 100));
  nodes.push(iNode("rsti", "rst", "Reset", 0, 200));
  nodes.push(iNode("addri", "addrin", "AddrIn", 0, 300, 8));

  // 1 output
  nodes.push(oNode("pco", "pc", "PC", 1800, 0, 8));

  // Constant 1 for reg8 EN (always enabled)
  nodes.push(cNode("cone", "co", 1, 0, 400));

  // NOT Reset — for gating
  nodes.push(mNode("nrst", "mod-not", 200, 200, [
    pn("nra", "A", "input"), pn("nro", "Out", "output"),
  ]));
  add("rsti", "rst", "nrst", "nra");

  // Incrementer: reg_out → inc_val
  nodes.push(mNode("inc", "mod-inc8", 400, 0, [
    pn("inca", "A", "input", 8),
    pn("incs", "S", "output", 8), pn("incco", "Cout", "output"),
  ]));

  // MUX8-2: select inc_val (A, S=0) vs AddrIn (B, S=1) based on Load
  nodes.push(mNode("mux_ld", "mod-mux8-2", 600, 0, [
    pn("mla", "A", "input", 8), pn("mlb", "B", "input", 8),
    pn("mls", "S", "input"), pn("mly", "Y", "output", 8),
  ]));

  // Wire inc → mux.A, AddrIn → mux.B, Load → mux.S
  add("inc", "incs", "mux_ld", "mla");
  add("addri", "addrin", "mux_ld", "mlb");
  add("loadi", "load", "mux_ld", "mls");

  // Reset gating: splitter → 8× AND(bit, NOT_reset) → merger
  // Splitter for mux output
  const splPins: Pin[] = [
    pn("smi", "In", "input", 8),
    ...Array.from({ length: 8 }, (_, i) => pn(`sm${i}`, String(i), "output")),
  ];
  nodes.push(mNode("spmux", "builtin:splitter", 800, 0, splPins));
  add("mux_ld", "mly", "spmux", "smi");

  // 8× AND gates for reset gating
  for (let i = 0; i < 8; i++) {
    const id = `ga${i}`;
    nodes.push(mNode(id, "mod-and", 1000, i * 80, [
      pn(`${id}a`, "A", "input"), pn(`${id}b`, "B", "input"), pn(`${id}o`, "Out", "output"),
    ]));
    add("spmux", `sm${i}`, id, `${id}a`);
    add("nrst", "nro", id, `${id}b`);
  }

  // Merger: gated bits → 8-bit bus
  const mrgPins: Pin[] = [
    ...Array.from({ length: 8 }, (_, i) => pn(`mg${i}`, String(i), "input")),
    pn("mgo", "Out", "output", 8),
  ];
  nodes.push(mNode("mrg_gate", "builtin:merger", 1200, 0, mrgPins));
  for (let i = 0; i < 8; i++) add(`ga${i}`, `ga${i}o`, "mrg_gate", `mg${i}`);

  // Register: stores the PC value
  nodes.push(mNode("reg", "mod-reg8", 1400, 0, [
    pn("regd", "D", "input", 8), pn("regc", "CLK", "input"),
    pn("rege", "EN", "input"), pn("regq", "Q", "output", 8),
  ]));

  add("mrg_gate", "mgo", "reg", "regd");
  add("clki", "clk", "reg", "regc");
  add("cone", "co", "reg", "rege");

  // Register output → PC output + feedback to incrementer
  add("reg", "regq", "pco", "pc");
  add("reg", "regq", "inc", "inca");

  return mkMod("mod-pc", "Program Counter",
    [pn("clk", "CLK", "input"), pn("load", "Load", "input"),
     pn("rst", "Reset", "input"), pn("addrin", "AddrIn", "input", 8)],
    [pn("pc", "PC", "output", 8)],
    "pc-c", nodes, edges,
  );
}

// ---- Decoder ROM data ----
// Opcode (4-bit) → 8-bit control word
// Bit 7: reg_write, Bit 6: alu_en, Bit 5-3: alu_op[2:0],
// Bit 2: mem_read, Bit 1: mem_write, Bit 0: imm_sel

export const DECODER_ROM_DATA: number[] = [
  0x00, // 0x0 NOP          — no operation
  0x81, // 0x1 LDI          — reg_write + imm_sel
  0x84, // 0x2 LD           — reg_write + mem_read
  0x02, // 0x3 ST           — mem_write
  0x80, // 0x4 MOV          — reg_write
  0xE0, // 0x5 ADD          — reg_write + alu_en + alu_op=100
  0xE8, // 0x6 SUB          — reg_write + alu_en + alu_op=101
  0xC0, // 0x7 AND          — reg_write + alu_en + alu_op=000
  0xC8, // 0x8 OR           — reg_write + alu_en + alu_op=001
  0xD0, // 0x9 XOR          — reg_write + alu_en + alu_op=010
  0xD8, // 0xA NOT          — reg_write + alu_en + alu_op=011
  0xF0, // 0xB SHL          — reg_write + alu_en + alu_op=110
  0xF8, // 0xC SHR          — reg_write + alu_en + alu_op=111
  0x00, // 0xD JMP          — (jump decoded by control unit)
  0x00, // 0xE JZ           — (jump decoded by control unit)
  0x00, // 0xF HALT         — (halt decoded by control unit)
];

// ---- Assembly & output ----

// Primitives needed by the CPU modules (reused from ALU)
const primitives = [
  buildNot(), buildAnd(), buildOr(), buildXor(),
  buildMux2(), buildHalfAdder(), buildFullAdder(),
];

// New CPU modules
const cpuModules = [
  buildReg8(), buildInc8(), buildMux8_2(), buildPC(),
];

// Combine: flip-flop deps + primitives + cpu modules
// Deduplicate by id (flip-flops and alu-helpers share mod-not, mod-xor)
const allModules = [...flipFlopModules, ...primitives, ...cpuModules];
const seen = new Set<string>();
const modules: Module[] = [];
for (const m of allModules) {
  if (!seen.has(m.id)) {
    seen.add(m.id);
    modules.push(m);
  }
}

const fixture = {
  version: 2,
  modules,
  library: modules.map(m => ({ type: "module" as const, moduleId: m.id })),
};

console.log(JSON.stringify(fixture, null, 2));
