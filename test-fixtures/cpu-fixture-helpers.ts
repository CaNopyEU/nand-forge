/**
 * Shared builders for CPU fixture modules (Program Counter, etc.).
 * Reuses primitives from alu-fixture-helpers.ts and references
 * flip-flop modules (mod-d-flipflop) from flip-flops.json.
 */

import {
  type CircuitNode, type Pin, type Module,
  pn, iNode, oNode, cNode, mNode, mkMod, ed, edgeCounter,
} from "./alu-fixture-helpers.ts";

// ---- mod-reg8 — 8-bit edge-triggered register ----
//
// Inputs:  D[8], CLK, EN (active-high enable)
// Outputs: Q[8]
//
// Architecture: 8× MUX2 (select D or Q_feedback based on EN) → 8× DFF
// When EN=1, DFF input = D[i]; when EN=0, DFF input = Q[i] (hold)

export function buildReg8(): Module {
  const nodes: CircuitNode[] = [];
  const { edges, add } = edgeCounter();

  // Inputs
  nodes.push(iNode("di", "d", "D", 0, 0, 8));
  nodes.push(iNode("clki", "clk", "CLK", 0, 100));
  nodes.push(iNode("eni", "en", "EN", 0, 200));

  // Output
  nodes.push(oNode("qo", "q", "Q", 1200, 0, 8));

  // Splitter: D[8] → 8 individual bits
  const splitterPins: Pin[] = [
    pn("sdi", "In", "input", 8),
    ...Array.from({ length: 8 }, (_, i) => pn(`sd${i}`, String(i), "output")),
  ];
  nodes.push(mNode("spd", "builtin:splitter", 150, 0, splitterPins));
  add("di", "d", "spd", "sdi");

  // 8× MUX2 + DFF
  for (let i = 0; i < 8; i++) {
    const mId = `mx${i}`;
    const fId = `ff${i}`;

    // MUX2: A=feedback(Q[i]), B=D[i], S=EN → when EN=1 selects D
    nodes.push(mNode(mId, "mod-mux2", 350, i * 80, [
      pn(`${mId}a`, "A", "input"), pn(`${mId}b`, "B", "input"),
      pn(`${mId}s`, "S", "input"), pn(`${mId}y`, "Y", "output"),
    ]));

    // DFF
    nodes.push(mNode(fId, "mod-d-flipflop", 550, i * 80, [
      pn(`${fId}d`, "D", "input"), pn(`${fId}c`, "CLK", "input"),
      pn(`${fId}q`, "Q", "output"),
    ]));

    // D[i] → MUX2.B (selected when EN=1)
    add("spd", `sd${i}`, mId, `${mId}b`);

    // EN → MUX2.S
    add("eni", "en", mId, `${mId}s`);

    // MUX2.Y → DFF.D
    add(mId, `${mId}y`, fId, `${fId}d`);

    // CLK → DFF.CLK
    add("clki", "clk", fId, `${fId}c`);

    // DFF.Q → MUX2.A (feedback: when EN=0, hold current value)
    add(fId, `${fId}q`, mId, `${mId}a`);
  }

  // Merger: 8× DFF.Q → Q[8]
  const mergerPins: Pin[] = [
    ...Array.from({ length: 8 }, (_, i) => pn(`mq${i}`, String(i), "input")),
    pn("mqo", "Out", "output", 8),
  ];
  nodes.push(mNode("mrg", "builtin:merger", 800, 0, mergerPins));

  for (let i = 0; i < 8; i++) add(`ff${i}`, `ff${i}q`, "mrg", `mq${i}`);
  add("mrg", "mqo", "qo", "q");

  return mkMod("mod-reg8", "8-bit Register",
    [pn("d", "D", "input", 8), pn("clk", "CLK", "input"), pn("en", "EN", "input")],
    [pn("q", "Q", "output", 8)],
    "reg8-c", nodes, edges,
  );
}

// ---- mod-inc8 — 8-bit incrementer ----
//
// Inputs:  A[8]
// Outputs: S[8], Cout
//
// Architecture: 8× Full Adder, B=0 hardwired, Cin[0]=1
// Effectively computes A + 1

export function buildInc8(): Module {
  const nodes: CircuitNode[] = [];
  const { edges, add } = edgeCounter();

  // Input
  nodes.push(iNode("ai", "a", "A", 0, 0, 8));

  // Outputs
  nodes.push(oNode("so", "s", "S", 1000, 0, 8));
  nodes.push(oNode("couto", "cout", "Cout", 1000, 100));

  // Splitter: A[8] → 8 bits
  const splitterPins: Pin[] = [
    pn("sai", "In", "input", 8),
    ...Array.from({ length: 8 }, (_, i) => pn(`sa${i}`, String(i), "output")),
  ];
  nodes.push(mNode("spa", "builtin:splitter", 150, 0, splitterPins));
  add("ai", "a", "spa", "sai");

  // Constants: B=0 for all adders, Cin[0]=1 for +1
  nodes.push(cNode("czero", "cz", 0, 200, 500));
  nodes.push(cNode("cone", "co", 1, 200, 600));

  // 8× Full Adder with ripple carry
  for (let i = 0; i < 8; i++) {
    const id = `fa${i}`;
    nodes.push(mNode(id, "mod-full-adder", 400, i * 80, [
      pn(`${id}a`, "A", "input"), pn(`${id}b`, "B", "input"), pn(`${id}ci`, "Cin", "input"),
      pn(`${id}s`, "S", "output"), pn(`${id}co`, "Cout", "output"),
    ]));

    // A[i]
    add("spa", `sa${i}`, id, `${id}a`);

    // B = 0
    add("czero", "cz", id, `${id}b`);

    // Cin: bit 0 gets 1, rest gets previous Cout
    if (i === 0) add("cone", "co", id, `${id}ci`);
    else add(`fa${i - 1}`, `fa${i - 1}co`, id, `${id}ci`);
  }

  // Merger: 8× FA.S → S[8]
  const mergerPins: Pin[] = [
    ...Array.from({ length: 8 }, (_, i) => pn(`ms${i}`, String(i), "input")),
    pn("mso", "Out", "output", 8),
  ];
  nodes.push(mNode("mrg", "builtin:merger", 700, 0, mergerPins));

  for (let i = 0; i < 8; i++) add(`fa${i}`, `fa${i}s`, "mrg", `ms${i}`);
  add("mrg", "mso", "so", "s");

  // Cout from MSB
  add("fa7", "fa7co", "couto", "cout");

  return mkMod("mod-inc8", "8-bit Incrementer",
    [pn("a", "A", "input", 8)],
    [pn("s", "S", "output", 8), pn("cout", "Cout", "output")],
    "inc8-c", nodes, edges,
  );
}

// ---- mod-mux8-2 — 8-bit 2:1 multiplexer ----
//
// Inputs:  A[8], B[8], S
// Outputs: Y[8]
//
// Architecture: 8× MUX 2:1 (1-bit each)

export function buildMux8_2(): Module {
  const nodes: CircuitNode[] = [];
  const { edges, add } = edgeCounter();

  // Inputs
  nodes.push(iNode("ai", "a", "A", 0, 0, 8));
  nodes.push(iNode("bi", "b", "B", 0, 100, 8));
  nodes.push(iNode("si", "s", "S", 0, 250));

  // Output
  nodes.push(oNode("yo", "y", "Y", 800, 0, 8));

  // Splitters
  const splPins = (pf: string): Pin[] => [
    pn(`${pf}i`, "In", "input", 8),
    ...Array.from({ length: 8 }, (_, i) => pn(`${pf}${i}`, String(i), "output")),
  ];
  nodes.push(mNode("spa", "builtin:splitter", 150, 0, splPins("sa")));
  nodes.push(mNode("spb", "builtin:splitter", 150, 100, splPins("sb")));
  add("ai", "a", "spa", "sai");
  add("bi", "b", "spb", "sbi");

  // 8× MUX2
  for (let i = 0; i < 8; i++) {
    const id = `m${i}`;
    nodes.push(mNode(id, "mod-mux2", 350, i * 80, [
      pn(`${id}a`, "A", "input"), pn(`${id}b`, "B", "input"),
      pn(`${id}s`, "S", "input"), pn(`${id}y`, "Y", "output"),
    ]));
    add("spa", `sa${i}`, id, `${id}a`);
    add("spb", `sb${i}`, id, `${id}b`);
    add("si", "s", id, `${id}s`);
  }

  // Merger
  const mergerPins: Pin[] = [
    ...Array.from({ length: 8 }, (_, i) => pn(`my${i}`, String(i), "input")),
    pn("myo", "Out", "output", 8),
  ];
  nodes.push(mNode("mrg", "builtin:merger", 600, 0, mergerPins));

  for (let i = 0; i < 8; i++) add(`m${i}`, `m${i}y`, "mrg", `my${i}`);
  add("mrg", "myo", "yo", "y");

  return mkMod("mod-mux8-2", "8-bit MUX 2:1",
    [pn("a", "A", "input", 8), pn("b", "B", "input", 8), pn("s", "S", "input")],
    [pn("y", "Y", "output", 8)],
    "mux82-c", nodes, edges,
  );
}
