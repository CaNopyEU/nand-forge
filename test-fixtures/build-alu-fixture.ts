#!/usr/bin/env npx tsx
/**
 * ALU 8-bit v2 fixture builder.
 * Generates test-fixtures/alu-8bit.json with 8 operations + carry/zero/negative flags.
 *
 * Opcode mapping (3-bit):
 *   000 AND | 001 OR | 010 XOR | 011 NOT A
 *   100 ADD | 101 SUB | 110 SHL | 111 SHR
 *
 * Usage: npx tsx test-fixtures/build-alu-fixture.ts > test-fixtures/alu-8bit.json
 */

import {
  type CircuitNode, type Pin,
  pn, iNode, oNode, cNode, mNode, mkMod, edgeCounter,
  buildNot, buildAnd, buildOr, buildXor,
  buildMux2, buildMux4, buildHalfAdder, buildFullAdder,
} from "./alu-fixture-helpers.ts";

// ---- NOR8 — 8-input NOR (OR tree + NOT) ----

function buildNor8() {
  const nodes: CircuitNode[] = [];
  const { edges, add } = edgeCounter();

  for (let i = 0; i < 8; i++) nodes.push(iNode(`d${i}i`, `d${i}`, `D${i}`, 0, i * 60));

  // Level 1: 4 OR gates pairing adjacent inputs
  const l1 = [[0, 1], [2, 3], [4, 5], [6, 7]] as const;
  for (const [a, b] of l1) {
    const id = `or${a}${b}`;
    nodes.push(mNode(id, "mod-or", 200, (a + b) * 30, [
      pn(`${id}a`, "A", "input"), pn(`${id}b`, "B", "input"), pn(`${id}o`, "Out", "output"),
    ]));
    add(`d${a}i`, `d${a}`, id, `${id}a`);
    add(`d${b}i`, `d${b}`, id, `${id}b`);
  }

  // Level 2: 2 OR gates
  nodes.push(mNode("or03", "mod-or", 400, 90, [
    pn("or03a", "A", "input"), pn("or03b", "B", "input"), pn("or03o", "Out", "output"),
  ]));
  add("or01", "or01o", "or03", "or03a");
  add("or23", "or23o", "or03", "or03b");

  nodes.push(mNode("or47", "mod-or", 400, 270, [
    pn("or47a", "A", "input"), pn("or47b", "B", "input"), pn("or47o", "Out", "output"),
  ]));
  add("or45", "or45o", "or47", "or47a");
  add("or67", "or67o", "or47", "or47b");

  // Level 3: final OR
  nodes.push(mNode("or_all", "mod-or", 600, 180, [
    pn("oaa", "A", "input"), pn("oab", "B", "input"), pn("oao", "Out", "output"),
  ]));
  add("or03", "or03o", "or_all", "oaa");
  add("or47", "or47o", "or_all", "oab");

  // NOT (invert to get NOR)
  nodes.push(mNode("inv", "mod-not", 800, 180, [pn("ia", "A", "input"), pn("io", "Out", "output")]));
  add("or_all", "oao", "inv", "ia");

  nodes.push(oNode("oo", "out", "Out", 1000, 180));
  add("inv", "io", "oo", "out");

  return mkMod("mod-nor8", "NOR8",
    Array.from({ length: 8 }, (_, i) => pn(`d${i}`, `D${i}`, "input")),
    [pn("out", "Out", "output")],
    "nor8-c", nodes, edges,
  );
}

// ---- ALU Slice v2 (1-bit, 8 operations) ----
//
// Inputs:  A, B, Cin, Op0, Op1, Op2, ShiftIn
// Outputs: R, Cout
//
// Logic path:    AND/OR/XOR/NOT → MUX4(Op0, Op1) → logic_result
// Arith path:    FA(A, XOR(B, Op0), Cin) → Sum, Cout
// Final MUX4:    (logic, logic, Sum, ShiftIn; S0=Op1, S1=Op2) → R

function buildAluSlice() {
  const nodes: CircuitNode[] = [];
  const { edges, add } = edgeCounter();

  // 7 inputs
  nodes.push(iNode("ai", "a", "A", 0, 0));
  nodes.push(iNode("bi", "b", "B", 0, 100));
  nodes.push(iNode("ci", "cin", "Cin", 0, 200));
  nodes.push(iNode("op0i", "op0", "Op0", 0, 350));
  nodes.push(iNode("op1i", "op1", "Op1", 0, 450));
  nodes.push(iNode("op2i", "op2", "Op2", 0, 550));
  nodes.push(iNode("shi", "shiftin", "ShiftIn", 0, 650));

  // Logic gates: AND, OR, XOR, NOT on (A, B)
  nodes.push(mNode("g_and", "mod-and", 250, 0, [
    pn("ga", "A", "input"), pn("gb", "B", "input"), pn("go", "Out", "output"),
  ]));
  nodes.push(mNode("g_or", "mod-or", 250, 80, [
    pn("oa", "A", "input"), pn("ob", "B", "input"), pn("oo", "Out", "output"),
  ]));
  nodes.push(mNode("g_xor", "mod-xor", 250, 160, [
    pn("xa", "A", "input"), pn("xb", "B", "input"), pn("xo", "Out", "output"),
  ]));
  nodes.push(mNode("g_not", "mod-not", 250, 240, [pn("na", "A", "input"), pn("no", "Out", "output")]));

  // B_eff = XOR(B, Op0) — conditional B inversion for SUB
  nodes.push(mNode("xor_beff", "mod-xor", 250, 350, [
    pn("xba", "A", "input"), pn("xbb", "B", "input"), pn("xbo", "Out", "output"),
  ]));

  // Full Adder: FA(A, B_eff, Cin)
  nodes.push(mNode("g_fa", "mod-full-adder", 250, 450, [
    pn("fa", "A", "input"), pn("fb", "B", "input"), pn("fc", "Cin", "input"),
    pn("fs", "S", "output"), pn("fco", "Cout", "output"),
  ]));

  // Logic MUX4: select among AND/OR/XOR/NOT by (Op0, Op1)
  nodes.push(mNode("mux_logic", "mod-mux4", 500, 80, [
    pn("mld0", "D0", "input"), pn("mld1", "D1", "input"),
    pn("mld2", "D2", "input"), pn("mld3", "D3", "input"),
    pn("mls0", "S0", "input"), pn("mls1", "S1", "input"), pn("mly", "Y", "output"),
  ]));

  // Final MUX4: select among (logic, logic, arith_sum, shift) by (Op1, Op2)
  nodes.push(mNode("mux_final", "mod-mux4", 750, 300, [
    pn("mfd0", "D0", "input"), pn("mfd1", "D1", "input"),
    pn("mfd2", "D2", "input"), pn("mfd3", "D3", "input"),
    pn("mfs0", "S0", "input"), pn("mfs1", "S1", "input"), pn("mfy", "Y", "output"),
  ]));

  // 2 outputs
  nodes.push(oNode("ro", "r", "R", 1000, 300));
  nodes.push(oNode("coo", "cout", "Cout", 1000, 500));

  // --- Wiring ---

  // A → logic gates + FA
  add("ai", "a", "g_and", "ga");
  add("ai", "a", "g_or", "oa");
  add("ai", "a", "g_xor", "xa");
  add("ai", "a", "g_not", "na");
  add("ai", "a", "g_fa", "fa");

  // B → logic gates + B_eff
  add("bi", "b", "g_and", "gb");
  add("bi", "b", "g_or", "ob");
  add("bi", "b", "g_xor", "xb");
  add("bi", "b", "xor_beff", "xba");

  // Op0 → B_eff + logic MUX S0
  add("op0i", "op0", "xor_beff", "xbb");
  add("op0i", "op0", "mux_logic", "mls0");

  // Cin → FA
  add("ci", "cin", "g_fa", "fc");

  // B_eff → FA.B
  add("xor_beff", "xbo", "g_fa", "fb");

  // Logic outputs → logic MUX
  add("g_and", "go", "mux_logic", "mld0");  // D0 = AND
  add("g_or", "oo", "mux_logic", "mld1");   // D1 = OR
  add("g_xor", "xo", "mux_logic", "mld2");  // D2 = XOR
  add("g_not", "no", "mux_logic", "mld3");  // D3 = NOT

  // Op1 → logic MUX S1 + final MUX S0
  add("op1i", "op1", "mux_logic", "mls1");
  add("op1i", "op1", "mux_final", "mfs0");

  // Logic result → final MUX D0 + D1 (both Op2=0 paths)
  add("mux_logic", "mly", "mux_final", "mfd0");
  add("mux_logic", "mly", "mux_final", "mfd1");

  // FA sum → final MUX D2 (arithmetic path)
  add("g_fa", "fs", "mux_final", "mfd2");

  // ShiftIn → final MUX D3 (shift path)
  add("shi", "shiftin", "mux_final", "mfd3");

  // Op2 → final MUX S1
  add("op2i", "op2", "mux_final", "mfs1");

  // Outputs
  add("mux_final", "mfy", "ro", "r");
  add("g_fa", "fco", "coo", "cout");

  return mkMod("mod-alu-slice", "ALU Slice",
    [pn("a", "A", "input"), pn("b", "B", "input"), pn("cin", "Cin", "input"),
     pn("op0", "Op0", "input"), pn("op1", "Op1", "input"), pn("op2", "Op2", "input"),
     pn("shiftin", "ShiftIn", "input")],
    [pn("r", "R", "output"), pn("cout", "Cout", "output")],
    "alus-c", nodes, edges,
  );
}

// ---- ALU 8-bit v2 (8 operations + flags) ----
//
// Inputs:  A[8], B[8], Op0, Op1, Op2
// Outputs: R[8], Carry, Zero, Neg
//
// 8× MUX2 for shift inputs (per-bit left/right neighbor selection)
// 8× ALU Slice v2 with ripple carry
// NOR8 for Zero flag

function buildAlu8() {
  const nodes: CircuitNode[] = [];
  const { edges, add } = edgeCounter();

  // 5 inputs
  nodes.push(iNode("ai", "a", "A", 0, 0, 8));
  nodes.push(iNode("bi", "b", "B", 0, 80, 8));
  nodes.push(iNode("op0i", "op0", "Op0", 0, 200));
  nodes.push(iNode("op1i", "op1", "Op1", 0, 280));
  nodes.push(iNode("op2i", "op2", "Op2", 0, 360));

  // 4 outputs
  nodes.push(oNode("ro", "r", "R", 1800, 0, 8));
  nodes.push(oNode("carryo", "carry", "Carry", 1800, 100));
  nodes.push(oNode("zeroo", "zero", "Zero", 1800, 200));
  nodes.push(oNode("nego", "neg", "Neg", 1800, 300));

  // Splitters for A and B
  const splitterPins = (pf: string): Pin[] => [
    pn(`${pf}i`, "In", "input", 8),
    ...Array.from({ length: 8 }, (_, i) => pn(`${pf}${i}`, String(i), "output")),
  ];
  nodes.push(mNode("spa", "builtin:splitter", 150, 0, splitterPins("sa")));
  nodes.push(mNode("spb", "builtin:splitter", 150, 80, splitterPins("sb")));

  // Constant 0 for shift edge cases
  nodes.push(cNode("czero", "cz", 0, 200, 500));

  // Wire inputs to splitters
  add("ai", "a", "spa", "sai");
  add("bi", "b", "spb", "sbi");

  // Shift MUX2 per bit: MUX2(A=left_neighbor, B=right_neighbor, S=Op0)
  // SHL (Op0=0): select A = A[i-1]   SHR (Op0=1): select B = A[i+1]
  for (let i = 0; i < 8; i++) {
    const id = `sh${i}`;
    nodes.push(mNode(id, "mod-mux2", 350, i * 80, [
      pn(`${id}a`, "A", "input"), pn(`${id}b`, "B", "input"),
      pn(`${id}s`, "S", "input"), pn(`${id}y`, "Y", "output"),
    ]));
    // A = left neighbor (i-1) or 0 for LSB
    if (i === 0) add("czero", "cz", id, `${id}a`);
    else add("spa", `sa${i - 1}`, id, `${id}a`);
    // B = right neighbor (i+1) or 0 for MSB
    if (i === 7) add("czero", "cz", id, `${id}b`);
    else add("spa", `sa${i + 1}`, id, `${id}b`);
    // S = Op0
    add("op0i", "op0", id, `${id}s`);
  }

  // ALU Slice v2 per bit
  for (let i = 0; i < 8; i++) {
    const id = `s${i}`;
    nodes.push(mNode(id, "mod-alu-slice", 600, i * 80, [
      pn(`${id}a`, "A", "input"), pn(`${id}b`, "B", "input"), pn(`${id}ci`, "Cin", "input"),
      pn(`${id}p0`, "Op0", "input"), pn(`${id}p1`, "Op1", "input"), pn(`${id}p2`, "Op2", "input"),
      pn(`${id}si`, "ShiftIn", "input"),
      pn(`${id}r`, "R", "output"), pn(`${id}co`, "Cout", "output"),
    ]));

    add("spa", `sa${i}`, id, `${id}a`);   // A bit
    add("spb", `sb${i}`, id, `${id}b`);   // B bit

    // Cin: Op0 for bit 0 (=1 for SUB), previous Cout for bits 1-7
    if (i === 0) add("op0i", "op0", id, `${id}ci`);
    else add(`s${i - 1}`, `s${i - 1}co`, id, `${id}ci`);

    add("op0i", "op0", id, `${id}p0`);    // Op0
    add("op1i", "op1", id, `${id}p1`);    // Op1
    add("op2i", "op2", id, `${id}p2`);    // Op2
    add(`sh${i}`, `sh${i}y`, id, `${id}si`); // ShiftIn
  }

  // Merger: r0..r7 → R[8]
  const mergerPins: Pin[] = [
    ...Array.from({ length: 8 }, (_, i) => pn(`m${i}`, String(i), "input")),
    pn("mo", "Out", "output", 8),
  ];
  nodes.push(mNode("mrg", "builtin:merger", 1200, 0, mergerPins));

  for (let i = 0; i < 8; i++) add(`s${i}`, `s${i}r`, "mrg", `m${i}`);
  add("mrg", "mo", "ro", "r");

  // Carry = Cout of bit 7
  add("s7", "s7co", "carryo", "carry");

  // NOR8 for Zero flag
  nodes.push(mNode("znor", "mod-nor8", 1200, 400, [
    ...Array.from({ length: 8 }, (_, i) => pn(`zd${i}`, `D${i}`, "input")),
    pn("zo", "Out", "output"),
  ]));
  for (let i = 0; i < 8; i++) add(`s${i}`, `s${i}r`, "znor", `zd${i}`);
  add("znor", "zo", "zeroo", "zero");

  // Neg = bit 7 of result
  add("s7", "s7r", "nego", "neg");

  return mkMod("mod-alu8", "8-bit ALU",
    [pn("a", "A", "input", 8), pn("b", "B", "input", 8),
     pn("op0", "Op0", "input"), pn("op1", "Op1", "input"), pn("op2", "Op2", "input")],
    [pn("r", "R", "output", 8), pn("carry", "Carry", "output"),
     pn("zero", "Zero", "output"), pn("neg", "Neg", "output")],
    "alu8-c", nodes, edges,
  );
}

// ---- Assembly & output ----

const modules = [
  buildNot(), buildAnd(), buildOr(), buildXor(),
  buildMux2(), buildMux4(), buildHalfAdder(), buildFullAdder(),
  buildNor8(), buildAluSlice(), buildAlu8(),
];

const fixture = {
  version: 2,
  modules,
  library: modules.map(m => ({ type: "module", moduleId: m.id })),
};

console.log(JSON.stringify(fixture, null, 2));
