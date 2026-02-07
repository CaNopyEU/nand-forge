import { describe, expect, it } from "vitest";
import type {
  Circuit,
  CircuitNode,
  Edge,
  Module,
  Pin,
} from "../../src/engine/types.ts";
import {
  BUILTIN_NAND_MODULE_ID,
  evaluateCircuitFull,
  evaluateCircuitWithState,
  pinKey,
  type InstanceState,
} from "../../src/engine/simulate.ts";

// === Test helpers ===

function makePin(id: string, name: string, direction: "input" | "output"): Pin {
  return { id, name, direction, bits: 1 };
}

function makeInputNode(id: string, pinId: string, name: string): CircuitNode {
  return {
    id,
    type: "input",
    position: { x: 0, y: 0 },
    rotation: 0,
    pins: [makePin(pinId, name, "output")],
  };
}

function makeOutputNode(id: string, pinId: string, name: string): CircuitNode {
  return {
    id,
    type: "output",
    position: { x: 0, y: 0 },
    rotation: 0,
    pins: [makePin(pinId, name, "input")],
  };
}

function makeNandNode(
  id: string,
  inAId: string,
  inBId: string,
  outId: string,
): CircuitNode {
  return {
    id,
    type: "module",
    moduleId: BUILTIN_NAND_MODULE_ID,
    position: { x: 0, y: 0 },
    rotation: 0,
    pins: [
      makePin(inAId, "A", "input"),
      makePin(inBId, "B", "input"),
      makePin(outId, "Out", "output"),
    ],
  };
}

function makeModuleNode(
  id: string,
  moduleId: string,
  inputPins: Array<{ id: string; name: string }>,
  outputPins: Array<{ id: string; name: string }>,
): CircuitNode {
  return {
    id,
    type: "module",
    moduleId,
    position: { x: 0, y: 0 },
    rotation: 0,
    pins: [
      ...inputPins.map((p) => makePin(p.id, p.name, "input")),
      ...outputPins.map((p) => makePin(p.id, p.name, "output")),
    ],
  };
}

function makeEdge(
  id: string,
  fromNodeId: string,
  fromPinId: string,
  toNodeId: string,
  toPinId: string,
): Edge {
  return { id, fromNodeId, fromPinId, toNodeId, toPinId };
}

function makeCircuit(name: string, nodes: CircuitNode[], edges: Edge[]): Circuit {
  return { id: `circuit-${name}`, name, nodes, edges };
}

// === SR Latch Module ===
// Internal circuit: 2 NANDs with cross-feedback
//   S_in → NAND1.A
//   NAND2.Out → NAND1.B (feedback)
//   NAND1.Out → Q_out + NAND2.A
//   R_in → NAND2.B
//   NAND2.Out → Qbar_out

function makeSRLatchModule(): Module {
  const nodes: CircuitNode[] = [
    makeInputNode("s_in", "s", "S"),
    makeInputNode("r_in", "r", "R"),
    makeNandNode("nand1", "n1a", "n1b", "n1out"),
    makeNandNode("nand2", "n2a", "n2b", "n2out"),
    makeOutputNode("q_out", "q", "Q"),
    makeOutputNode("qbar_out", "qbar", "Qbar"),
  ];

  const edges: Edge[] = [
    makeEdge("e1", "s_in", "s", "nand1", "n1a"),
    makeEdge("e2", "r_in", "r", "nand2", "n2b"),
    makeEdge("e3", "nand1", "n1out", "q_out", "q"),
    makeEdge("e4", "nand2", "n2out", "qbar_out", "qbar"),
    // Cross-feedback
    makeEdge("e5", "nand1", "n1out", "nand2", "n2a"),
    makeEdge("e6", "nand2", "n2out", "nand1", "n1b"),
  ];

  return {
    id: "mod-sr-latch",
    name: "SR Latch",
    inputs: [
      makePin("s", "S", "input"),
      makePin("r", "R", "input"),
    ],
    outputs: [
      makePin("q", "Q", "output"),
      makePin("qbar", "Qbar", "output"),
    ],
    circuit: makeCircuit("sr-latch-internal", nodes, edges),
    createdAt: "",
    updatedAt: "",
  };
}

describe("per-instance state (evaluateCircuitWithState)", () => {
  describe("SR latch module — Hold state across ticks", () => {
    it("Set (S=0, R=1) then Hold (S=1, R=1) retains Q=1", () => {
      const srMod = makeSRLatchModule();
      const modules = [srMod];

      // Top-level circuit: S_input, R_input → SR_instance → Q_output
      const topNodes: CircuitNode[] = [
        makeInputNode("top_s", "ts", "S"),
        makeInputNode("top_r", "tr", "R"),
        makeModuleNode(
          "sr_inst",
          "mod-sr-latch",
          [{ id: "si_s", name: "S" }, { id: "si_r", name: "R" }],
          [{ id: "si_q", name: "Q" }, { id: "si_qbar", name: "Qbar" }],
        ),
        makeOutputNode("top_q", "tq", "Q"),
        makeOutputNode("top_qbar", "tqbar", "Qbar"),
      ];

      const topEdges: Edge[] = [
        makeEdge("te1", "top_s", "ts", "sr_inst", "si_s"),
        makeEdge("te2", "top_r", "tr", "sr_inst", "si_r"),
        makeEdge("te3", "sr_inst", "si_q", "top_q", "tq"),
        makeEdge("te4", "sr_inst", "si_qbar", "top_qbar", "tqbar"),
      ];

      const topCircuit = makeCircuit("top", topNodes, topEdges);
      const instanceStates = new Map<string, InstanceState>();

      // Tick 1: Set (S=0, R=1) → Q=1
      const tick1 = evaluateCircuitWithState(
        topCircuit,
        { ts: false, tr: true },
        modules,
        undefined,
        instanceStates,
      );
      expect(tick1.outputs["tq"]).toBe(true);
      expect(tick1.outputs["tqbar"]).toBe(false);

      // Verify instanceStates was populated
      expect(instanceStates.has("sr_inst")).toBe(true);

      // Tick 2: Hold (S=1, R=1) — should retain Q=1
      const tick2 = evaluateCircuitWithState(
        topCircuit,
        { ts: true, tr: true },
        modules,
        undefined,
        instanceStates,
      );
      expect(tick2.outputs["tq"]).toBe(true);
      expect(tick2.outputs["tqbar"]).toBe(false);
    });

    it("Reset (S=1, R=0) then Hold (S=1, R=1) retains Q=0", () => {
      const srMod = makeSRLatchModule();
      const modules = [srMod];

      const topNodes: CircuitNode[] = [
        makeInputNode("top_s", "ts", "S"),
        makeInputNode("top_r", "tr", "R"),
        makeModuleNode(
          "sr_inst",
          "mod-sr-latch",
          [{ id: "si_s", name: "S" }, { id: "si_r", name: "R" }],
          [{ id: "si_q", name: "Q" }, { id: "si_qbar", name: "Qbar" }],
        ),
        makeOutputNode("top_q", "tq", "Q"),
        makeOutputNode("top_qbar", "tqbar", "Qbar"),
      ];

      const topEdges: Edge[] = [
        makeEdge("te1", "top_s", "ts", "sr_inst", "si_s"),
        makeEdge("te2", "top_r", "tr", "sr_inst", "si_r"),
        makeEdge("te3", "sr_inst", "si_q", "top_q", "tq"),
        makeEdge("te4", "sr_inst", "si_qbar", "top_qbar", "tqbar"),
      ];

      const topCircuit = makeCircuit("top", topNodes, topEdges);
      const instanceStates = new Map<string, InstanceState>();

      // Tick 1: Reset (S=1, R=0) → Q=0
      const tick1 = evaluateCircuitWithState(
        topCircuit,
        { ts: true, tr: false },
        modules,
        undefined,
        instanceStates,
      );
      expect(tick1.outputs["tq"]).toBe(false);
      expect(tick1.outputs["tqbar"]).toBe(true);

      // Tick 2: Hold (S=1, R=1) — should retain Q=0
      const tick2 = evaluateCircuitWithState(
        topCircuit,
        { ts: true, tr: true },
        modules,
        undefined,
        instanceStates,
      );
      expect(tick2.outputs["tq"]).toBe(false);
      expect(tick2.outputs["tqbar"]).toBe(true);
    });
  });

  describe("Independent instances", () => {
    it("two SR latch instances hold independent states", () => {
      const srMod = makeSRLatchModule();
      const modules = [srMod];

      const topNodes: CircuitNode[] = [
        makeInputNode("s1", "s1_pin", "S1"),
        makeInputNode("r1", "r1_pin", "R1"),
        makeInputNode("s2", "s2_pin", "S2"),
        makeInputNode("r2", "r2_pin", "R2"),
        makeModuleNode(
          "sr1",
          "mod-sr-latch",
          [{ id: "sr1_s", name: "S" }, { id: "sr1_r", name: "R" }],
          [{ id: "sr1_q", name: "Q" }, { id: "sr1_qbar", name: "Qbar" }],
        ),
        makeModuleNode(
          "sr2",
          "mod-sr-latch",
          [{ id: "sr2_s", name: "S" }, { id: "sr2_r", name: "R" }],
          [{ id: "sr2_q", name: "Q" }, { id: "sr2_qbar", name: "Qbar" }],
        ),
        makeOutputNode("q1", "q1_pin", "Q1"),
        makeOutputNode("q2", "q2_pin", "Q2"),
      ];

      const topEdges: Edge[] = [
        makeEdge("e1", "s1", "s1_pin", "sr1", "sr1_s"),
        makeEdge("e2", "r1", "r1_pin", "sr1", "sr1_r"),
        makeEdge("e3", "s2", "s2_pin", "sr2", "sr2_s"),
        makeEdge("e4", "r2", "r2_pin", "sr2", "sr2_r"),
        makeEdge("e5", "sr1", "sr1_q", "q1", "q1_pin"),
        makeEdge("e6", "sr2", "sr2_q", "q2", "q2_pin"),
      ];

      const topCircuit = makeCircuit("top-dual", topNodes, topEdges);
      const instanceStates = new Map<string, InstanceState>();

      // Tick 1: Set SR1 (S=0, R=1), Reset SR2 (S=1, R=0)
      const tick1 = evaluateCircuitWithState(
        topCircuit,
        { s1_pin: false, r1_pin: true, s2_pin: true, r2_pin: false },
        modules,
        undefined,
        instanceStates,
      );
      expect(tick1.outputs["q1_pin"]).toBe(true);  // SR1 Set → Q=1
      expect(tick1.outputs["q2_pin"]).toBe(false); // SR2 Reset → Q=0

      // Tick 2: Hold both (S=1, R=1)
      const tick2 = evaluateCircuitWithState(
        topCircuit,
        { s1_pin: true, r1_pin: true, s2_pin: true, r2_pin: true },
        modules,
        undefined,
        instanceStates,
      );
      expect(tick2.outputs["q1_pin"]).toBe(true);  // SR1 holds Q=1
      expect(tick2.outputs["q2_pin"]).toBe(false); // SR2 holds Q=0
    });
  });

  describe("Nested sub-modules — D Latch using SR Latch (4-bit register)", () => {
    // D Latch = SR Latch + 2 NANDs (D gating)
    // D → NAND1.A, Enable → NAND1.B, NAND1.Out → SR.S
    // NOT(D) → NAND2.A (via NAND(D,D)), Enable → NAND2.B, NAND2.Out → SR.R
    function makeDLatchModule(): Module {
      const srMod = makeSRLatchModule();
      return {
        id: "mod-d-latch",
        name: "D Latch",
        inputs: [makePin("d", "D", "input"), makePin("en", "EN", "input")],
        outputs: [makePin("q", "Q", "output")],
        circuit: makeCircuit("d-latch-internal", [
          // Inputs
          { id: "d_in", type: "input", position: { x: 0, y: 0 }, rotation: 0, pins: [makePin("d", "D", "output")] },
          { id: "en_in", type: "input", position: { x: 0, y: 0 }, rotation: 0, pins: [makePin("en", "EN", "output")] },
          // NOT(D) = NAND(D, D)
          { id: "not_d", type: "module", moduleId: "builtin:nand", position: { x: 0, y: 0 }, rotation: 0,
            pins: [makePin("a", "A", "input"), makePin("b", "B", "input"), makePin("o", "Out", "output")] },
          // NAND1: D AND EN → S (via NAND)
          { id: "nand_s", type: "module", moduleId: "builtin:nand", position: { x: 0, y: 0 }, rotation: 0,
            pins: [makePin("a", "A", "input"), makePin("b", "B", "input"), makePin("o", "Out", "output")] },
          // NAND2: NOT(D) AND EN → R (via NAND)
          { id: "nand_r", type: "module", moduleId: "builtin:nand", position: { x: 0, y: 0 }, rotation: 0,
            pins: [makePin("a", "A", "input"), makePin("b", "B", "input"), makePin("o", "Out", "output")] },
          // SR Latch instance
          makeModuleNode("sr_inst", "mod-sr-latch",
            [{ id: "sr_s", name: "S" }, { id: "sr_r", name: "R" }],
            [{ id: "sr_q", name: "Q" }, { id: "sr_qbar", name: "Qbar" }],
          ),
          // Output
          { id: "q_out", type: "output", position: { x: 0, y: 0 }, rotation: 0, pins: [makePin("q", "Q", "input")] },
        ], [
          // D → NOT_D (both inputs)
          makeEdge("e1", "d_in", "d", "not_d", "a"),
          makeEdge("e2", "d_in", "d", "not_d", "b"),
          // D → NAND_S.A
          makeEdge("e3", "d_in", "d", "nand_s", "a"),
          // EN → NAND_S.B
          makeEdge("e4", "en_in", "en", "nand_s", "b"),
          // NOT_D → NAND_R.A
          makeEdge("e5", "not_d", "o", "nand_r", "a"),
          // EN → NAND_R.B
          makeEdge("e6", "en_in", "en", "nand_r", "b"),
          // NAND_S.Out → SR.S (NAND output is active-low, so NAND(D,EN) → S_bar)
          makeEdge("e7", "nand_s", "o", "sr_inst", "sr_s"),
          // NAND_R.Out → SR.R
          makeEdge("e8", "nand_r", "o", "sr_inst", "sr_r"),
          // SR.Q → Output
          makeEdge("e9", "sr_inst", "sr_q", "q_out", "q"),
        ]),
        createdAt: "", updatedAt: "",
      };
    }

    it("4 D Latch instances hold independent states", () => {
      const srMod = makeSRLatchModule();
      const dMod = makeDLatchModule();
      const modules = [srMod, dMod];

      // 4-bit register: D0..D3 inputs, EN input, Q0..Q3 outputs
      const topNodes: CircuitNode[] = [
        makeInputNode("d0", "d0p", "D0"),
        makeInputNode("d1", "d1p", "D1"),
        makeInputNode("d2", "d2p", "D2"),
        makeInputNode("d3", "d3p", "D3"),
        makeInputNode("en", "enp", "EN"),
        makeModuleNode("dl0", "mod-d-latch",
          [{ id: "dl0_d", name: "D" }, { id: "dl0_en", name: "EN" }],
          [{ id: "dl0_q", name: "Q" }]),
        makeModuleNode("dl1", "mod-d-latch",
          [{ id: "dl1_d", name: "D" }, { id: "dl1_en", name: "EN" }],
          [{ id: "dl1_q", name: "Q" }]),
        makeModuleNode("dl2", "mod-d-latch",
          [{ id: "dl2_d", name: "D" }, { id: "dl2_en", name: "EN" }],
          [{ id: "dl2_q", name: "Q" }]),
        makeModuleNode("dl3", "mod-d-latch",
          [{ id: "dl3_d", name: "D" }, { id: "dl3_en", name: "EN" }],
          [{ id: "dl3_q", name: "Q" }]),
        makeOutputNode("q0", "q0p", "Q0"),
        makeOutputNode("q1", "q1p", "Q1"),
        makeOutputNode("q2", "q2p", "Q2"),
        makeOutputNode("q3", "q3p", "Q3"),
      ];

      const topEdges: Edge[] = [
        makeEdge("e_d0", "d0", "d0p", "dl0", "dl0_d"),
        makeEdge("e_d1", "d1", "d1p", "dl1", "dl1_d"),
        makeEdge("e_d2", "d2", "d2p", "dl2", "dl2_d"),
        makeEdge("e_d3", "d3", "d3p", "dl3", "dl3_d"),
        makeEdge("e_en0", "en", "enp", "dl0", "dl0_en"),
        makeEdge("e_en1", "en", "enp", "dl1", "dl1_en"),
        makeEdge("e_en2", "en", "enp", "dl2", "dl2_en"),
        makeEdge("e_en3", "en", "enp", "dl3", "dl3_en"),
        makeEdge("e_q0", "dl0", "dl0_q", "q0", "q0p"),
        makeEdge("e_q1", "dl1", "dl1_q", "q1", "q1p"),
        makeEdge("e_q2", "dl2", "dl2_q", "q2", "q2p"),
        makeEdge("e_q3", "dl3", "dl3_q", "q3", "q3p"),
      ];

      const topCircuit = makeCircuit("4bit-reg", topNodes, topEdges);
      const instanceStates = new Map<string, InstanceState>();

      // Tick 1: Load D=1010 with EN=1
      const tick1 = evaluateCircuitWithState(
        topCircuit,
        { d0p: true, d1p: false, d2p: true, d3p: false, enp: true },
        modules, undefined, instanceStates,
      );
      expect(tick1.outputs["q0p"]).toBe(true);
      expect(tick1.outputs["q1p"]).toBe(false);
      expect(tick1.outputs["q2p"]).toBe(true);
      expect(tick1.outputs["q3p"]).toBe(false);

      // Tick 2: Change D=0101 but EN=0 (latch should hold previous)
      const tick2 = evaluateCircuitWithState(
        topCircuit,
        { d0p: false, d1p: true, d2p: false, d3p: true, enp: false },
        modules, undefined, instanceStates,
      );
      // Should retain 1010 from tick 1!
      expect(tick2.outputs["q0p"]).toBe(true);
      expect(tick2.outputs["q1p"]).toBe(false);
      expect(tick2.outputs["q2p"]).toBe(true);
      expect(tick2.outputs["q3p"]).toBe(false);

      // Tick 3: EN=1 again with D=0101 → should latch new values
      const tick3 = evaluateCircuitWithState(
        topCircuit,
        { d0p: false, d1p: true, d2p: false, d3p: true, enp: true },
        modules, undefined, instanceStates,
      );
      expect(tick3.outputs["q0p"]).toBe(false);
      expect(tick3.outputs["q1p"]).toBe(true);
      expect(tick3.outputs["q2p"]).toBe(false);
      expect(tick3.outputs["q3p"]).toBe(true);
    });
  });

  describe("Acyclic sanity check", () => {
    it("NOT gate module via evaluateCircuitWithState matches evaluateCircuitFull", () => {
      // NOT module: NAND(A, A) → Out
      const notMod: Module = {
        id: "mod-not",
        name: "NOT",
        inputs: [makePin("a", "A", "input")],
        outputs: [makePin("out", "Out", "output")],
        circuit: makeCircuit("not-internal", [
          makeInputNode("in_a", "a", "A"),
          makeNandNode("nand", "na", "nb", "nout"),
          makeOutputNode("out_node", "out", "Out"),
        ], [
          makeEdge("e1", "in_a", "a", "nand", "na"),
          makeEdge("e2", "in_a", "a", "nand", "nb"),
          makeEdge("e3", "nand", "nout", "out_node", "out"),
        ]),
        createdAt: "",
        updatedAt: "",
      };
      const modules = [notMod];

      // Top-level: Input → NOT_instance → Output
      const topNodes: CircuitNode[] = [
        makeInputNode("top_in", "tin", "A"),
        makeModuleNode(
          "not_inst",
          "mod-not",
          [{ id: "ni_a", name: "A" }],
          [{ id: "ni_out", name: "Out" }],
        ),
        makeOutputNode("top_out", "tout", "Out"),
      ];
      const topEdges: Edge[] = [
        makeEdge("te1", "top_in", "tin", "not_inst", "ni_a"),
        makeEdge("te2", "not_inst", "ni_out", "top_out", "tout"),
      ];
      const topCircuit = makeCircuit("top-not", topNodes, topEdges);

      // evaluateCircuitWithState
      const result = evaluateCircuitWithState(
        topCircuit,
        { tin: true },
        modules,
      );

      // evaluateCircuitFull (direct)
      const fullPinValues = evaluateCircuitFull(topCircuit, { tin: true }, modules);
      const fullOutput = fullPinValues.get(pinKey("top_out", "tout"));

      expect(result.outputs["tout"]).toBe(false); // NOT(true) = false
      expect(result.outputs["tout"]).toBe(fullOutput);
    });
  });
});
