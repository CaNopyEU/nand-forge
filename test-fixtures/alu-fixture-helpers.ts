/**
 * Shared types and helpers for ALU fixture builder.
 * Also contains primitive module builders (NOT, AND, OR, XOR, MUX2, MUX4, HA, FA).
 */

// ---- Types (matching engine/types.ts) ----

export type BitWidth = 1 | 4 | 8 | 16;

export interface Pin {
  id: string;
  name: string;
  direction: "input" | "output";
  bits: BitWidth;
}

export interface CircuitNode {
  id: string;
  type: string;
  moduleId?: string;
  position: { x: number; y: number };
  rotation: 0;
  pins: Pin[];
}

export interface Edge {
  id: string;
  fromNodeId: string;
  fromPinId: string;
  toNodeId: string;
  toPinId: string;
}

export interface Circuit {
  id: string;
  name: string;
  nodes: CircuitNode[];
  edges: Edge[];
}

export interface Module {
  id: string;
  name: string;
  inputs: Pin[];
  outputs: Pin[];
  circuit: Circuit;
  createdAt: string;
  updatedAt: string;
}

// ---- Constants & helpers ----

const TS = "2026-02-09T00:00:00.000Z";

export const pn = (id: string, name: string, dir: "input" | "output", bits: BitWidth = 1): Pin =>
  ({ id, name, direction: dir, bits });

export const iNode = (id: string, pid: string, pname: string, x: number, y: number, bits: BitWidth = 1): CircuitNode =>
  ({ id, type: "input", position: { x, y }, rotation: 0, pins: [pn(pid, pname, "output", bits)] });

export const oNode = (id: string, pid: string, pname: string, x: number, y: number, bits: BitWidth = 1): CircuitNode =>
  ({ id, type: "output", position: { x, y }, rotation: 0, pins: [pn(pid, pname, "input", bits)] });

export const cNode = (id: string, pid: string, value: 0 | 1, x: number, y: number): CircuitNode =>
  ({ id, type: "constant", position: { x, y }, rotation: 0, pins: [pn(pid, String(value), "output")] });

export const mNode = (id: string, moduleId: string, x: number, y: number, pins: Pin[]): CircuitNode =>
  ({ id, type: "module", moduleId, position: { x, y }, rotation: 0, pins });

const nand = (id: string, pf: string, x: number, y: number): CircuitNode =>
  mNode(id, "builtin:nand", x, y, [
    pn(`${pf}a`, "A", "input"), pn(`${pf}b`, "B", "input"), pn(`${pf}o`, "Out", "output"),
  ]);

export const ed = (id: string, fn: string, fp: string, tn: string, tp: string): Edge =>
  ({ id, fromNodeId: fn, fromPinId: fp, toNodeId: tn, toPinId: tp });

export const mkMod = (
  id: string, name: string, ins: Pin[], outs: Pin[],
  cid: string, nodes: CircuitNode[], edges: Edge[],
): Module => ({
  id, name, inputs: ins, outputs: outs,
  circuit: { id: cid, name, nodes, edges },
  createdAt: TS, updatedAt: TS,
});

export function edgeCounter() {
  let idx = 0;
  const edges: Edge[] = [];
  const add = (fn: string, fp: string, tn: string, tp: string) => {
    edges.push(ed(`e${++idx}`, fn, fp, tn, tp));
  };
  return { edges, add };
}

// ---- Primitive modules (8, identical to existing fixture) ----

export function buildNot(): Module {
  return mkMod("mod-not", "NOT",
    [pn("a", "A", "input")], [pn("out", "Out", "output")], "not-c",
    [iNode("ai", "a", "A", 0, 0), nand("n1", "n1", 200, 0), oNode("oo", "out", "Out", 400, 0)],
    [ed("e1", "ai", "a", "n1", "n1a"), ed("e2", "ai", "a", "n1", "n1b"), ed("e3", "n1", "n1o", "oo", "out")],
  );
}

export function buildAnd(): Module {
  return mkMod("mod-and", "AND",
    [pn("a", "A", "input"), pn("b", "B", "input")], [pn("out", "Out", "output")], "and-c",
    [
      iNode("ai", "a", "A", 0, 0), iNode("bi", "b", "B", 0, 100),
      nand("n1", "n1", 200, 50), nand("n2", "n2", 400, 50),
      oNode("oo", "out", "Out", 600, 50),
    ],
    [
      ed("e1", "ai", "a", "n1", "n1a"), ed("e2", "bi", "b", "n1", "n1b"),
      ed("e3", "n1", "n1o", "n2", "n2a"), ed("e4", "n1", "n1o", "n2", "n2b"),
      ed("e5", "n2", "n2o", "oo", "out"),
    ],
  );
}

export function buildOr(): Module {
  return mkMod("mod-or", "OR",
    [pn("a", "A", "input"), pn("b", "B", "input")], [pn("out", "Out", "output")], "or-c",
    [
      iNode("ai", "a", "A", 0, 0), iNode("bi", "b", "B", 0, 100),
      nand("n1", "n1", 200, 0), nand("n2", "n2", 200, 100), nand("n3", "n3", 400, 50),
      oNode("oo", "out", "Out", 600, 50),
    ],
    [
      ed("e1", "ai", "a", "n1", "n1a"), ed("e2", "ai", "a", "n1", "n1b"),
      ed("e3", "bi", "b", "n2", "n2a"), ed("e4", "bi", "b", "n2", "n2b"),
      ed("e5", "n1", "n1o", "n3", "n3a"), ed("e6", "n2", "n2o", "n3", "n3b"),
      ed("e7", "n3", "n3o", "oo", "out"),
    ],
  );
}

export function buildXor(): Module {
  return mkMod("mod-xor", "XOR",
    [pn("a", "A", "input"), pn("b", "B", "input")], [pn("out", "Out", "output")], "xor-c",
    [
      iNode("ai", "a", "A", 0, 0), iNode("bi", "b", "B", 0, 150),
      nand("n1", "n1", 200, 75), nand("n2", "n2", 400, 0),
      nand("n3", "n3", 400, 150), nand("n4", "n4", 600, 75),
      oNode("oo", "out", "Out", 800, 75),
    ],
    [
      ed("e1", "ai", "a", "n1", "n1a"), ed("e2", "bi", "b", "n1", "n1b"),
      ed("e3", "ai", "a", "n2", "n2a"), ed("e4", "n1", "n1o", "n2", "n2b"),
      ed("e5", "bi", "b", "n3", "n3a"), ed("e6", "n1", "n1o", "n3", "n3b"),
      ed("e7", "n2", "n2o", "n4", "n4a"), ed("e8", "n3", "n3o", "n4", "n4b"),
      ed("e9", "n4", "n4o", "oo", "out"),
    ],
  );
}

export function buildMux2(): Module {
  return mkMod("mod-mux2", "MUX 2:1",
    [pn("a", "A", "input"), pn("b", "B", "input"), pn("s", "S", "input")],
    [pn("y", "Y", "output")], "mux2-c",
    [
      iNode("ai", "a", "A", 0, 0), iNode("bi", "b", "B", 0, 100), iNode("si", "s", "S", 0, 200),
      mNode("inv", "mod-not", 150, 200, [pn("ia", "A", "input"), pn("io", "Out", "output")]),
      mNode("a1", "mod-and", 300, 0, [pn("a1a", "A", "input"), pn("a1b", "B", "input"), pn("a1o", "Out", "output")]),
      mNode("a2", "mod-and", 300, 100, [pn("a2a", "A", "input"), pn("a2b", "B", "input"), pn("a2o", "Out", "output")]),
      mNode("o1", "mod-or", 500, 50, [pn("o1a", "A", "input"), pn("o1b", "B", "input"), pn("o1o", "Out", "output")]),
      oNode("yo", "y", "Y", 700, 50),
    ],
    [
      ed("e1", "si", "s", "inv", "ia"),
      ed("e2", "ai", "a", "a1", "a1a"), ed("e3", "inv", "io", "a1", "a1b"),
      ed("e4", "bi", "b", "a2", "a2a"), ed("e5", "si", "s", "a2", "a2b"),
      ed("e6", "a1", "a1o", "o1", "o1a"), ed("e7", "a2", "a2o", "o1", "o1b"),
      ed("e8", "o1", "o1o", "yo", "y"),
    ],
  );
}

export function buildMux4(): Module {
  return mkMod("mod-mux4", "MUX 4:1",
    [pn("d0", "D0", "input"), pn("d1", "D1", "input"), pn("d2", "D2", "input"), pn("d3", "D3", "input"),
     pn("s0", "S0", "input"), pn("s1", "S1", "input")],
    [pn("y", "Y", "output")], "mux4-c",
    [
      iNode("d0i", "d0", "D0", 0, 0), iNode("d1i", "d1", "D1", 0, 80),
      iNode("d2i", "d2", "D2", 0, 160), iNode("d3i", "d3", "D3", 0, 240),
      iNode("s0i", "s0", "S0", 0, 350), iNode("s1i", "s1", "S1", 0, 430),
      mNode("mlo", "mod-mux2", 250, 0, [
        pn("la", "A", "input"), pn("lb", "B", "input"), pn("ls", "S", "input"), pn("ly", "Y", "output"),
      ]),
      mNode("mhi", "mod-mux2", 250, 200, [
        pn("ha", "A", "input"), pn("hb", "B", "input"), pn("hs", "S", "input"), pn("hy", "Y", "output"),
      ]),
      mNode("mfin", "mod-mux2", 500, 100, [
        pn("fa", "A", "input"), pn("fb", "B", "input"), pn("fs", "S", "input"), pn("fy", "Y", "output"),
      ]),
      oNode("yo", "y", "Y", 700, 100),
    ],
    [
      ed("e1", "d0i", "d0", "mlo", "la"), ed("e2", "d1i", "d1", "mlo", "lb"), ed("e3", "s0i", "s0", "mlo", "ls"),
      ed("e4", "d2i", "d2", "mhi", "ha"), ed("e5", "d3i", "d3", "mhi", "hb"), ed("e6", "s0i", "s0", "mhi", "hs"),
      ed("e7", "mlo", "ly", "mfin", "fa"), ed("e8", "mhi", "hy", "mfin", "fb"), ed("e9", "s1i", "s1", "mfin", "fs"),
      ed("e10", "mfin", "fy", "yo", "y"),
    ],
  );
}

export function buildHalfAdder(): Module {
  return mkMod("mod-half-adder", "Half Adder",
    [pn("a", "A", "input"), pn("b", "B", "input")],
    [pn("s", "S", "output"), pn("c", "C", "output")], "ha-c",
    [
      iNode("ai", "a", "A", 0, 0), iNode("bi", "b", "B", 0, 150),
      mNode("xor1", "mod-xor", 250, 0, [pn("xa", "A", "input"), pn("xb", "B", "input"), pn("xo", "Out", "output")]),
      mNode("and1", "mod-and", 250, 150, [pn("aa", "A", "input"), pn("ab", "B", "input"), pn("ao", "Out", "output")]),
      oNode("so", "s", "S", 500, 0), oNode("co", "c", "C", 500, 150),
    ],
    [
      ed("e1", "ai", "a", "xor1", "xa"), ed("e2", "bi", "b", "xor1", "xb"),
      ed("e3", "ai", "a", "and1", "aa"), ed("e4", "bi", "b", "and1", "ab"),
      ed("e5", "xor1", "xo", "so", "s"), ed("e6", "and1", "ao", "co", "c"),
    ],
  );
}

export function buildFullAdder(): Module {
  return mkMod("mod-full-adder", "Full Adder",
    [pn("a", "A", "input"), pn("b", "B", "input"), pn("cin", "Cin", "input")],
    [pn("s", "S", "output"), pn("cout", "Cout", "output")], "fa-c",
    [
      iNode("ai", "a", "A", 0, 0), iNode("bi", "b", "B", 0, 150), iNode("ci", "cin", "Cin", 0, 300),
      mNode("ha1", "mod-half-adder", 250, 0, [
        pn("h1a", "A", "input"), pn("h1b", "B", "input"), pn("h1s", "S", "output"), pn("h1c", "C", "output"),
      ]),
      mNode("ha2", "mod-half-adder", 500, 0, [
        pn("h2a", "A", "input"), pn("h2b", "B", "input"), pn("h2s", "S", "output"), pn("h2c", "C", "output"),
      ]),
      mNode("or1", "mod-or", 500, 200, [pn("oa", "A", "input"), pn("ob", "B", "input"), pn("oo", "Out", "output")]),
      oNode("so", "s", "S", 750, 0), oNode("couto", "cout", "Cout", 750, 200),
    ],
    [
      ed("e1", "ai", "a", "ha1", "h1a"), ed("e2", "bi", "b", "ha1", "h1b"),
      ed("e3", "ha1", "h1s", "ha2", "h2a"), ed("e4", "ci", "cin", "ha2", "h2b"),
      ed("e5", "ha2", "h2s", "so", "s"),
      ed("e6", "ha1", "h1c", "or1", "oa"), ed("e7", "ha2", "h2c", "or1", "ob"),
      ed("e8", "or1", "oo", "couto", "cout"),
    ],
  );
}
