/**
 * E2E tests for Phase A — Sequential Circuits (Iterations 14–16)
 *
 * Full vertical slice: AppNodes + RFEdges → canvasToCircuit → engine → simulation-store
 * Tests the complete pipeline as the real app uses it, without a browser.
 */

import { describe, expect, it, beforeEach } from "vitest";
import type { Edge as RFEdge } from "@xyflow/react";
import type { Module, Pin } from "../../src/engine/types.ts";
import { pinKey, BUILTIN_NAND_MODULE_ID } from "../../src/engine/simulate.ts";
import { useSimulationStore } from "../../src/store/simulation-store.ts";
import { useModuleStore } from "../../src/store/module-store.ts";
import type {
  AppNode,
  InputNodeType,
  OutputNodeType,
  ClockNodeType,
  ButtonNodeType,
  ProbeNodeType,
  ConstantNodeType,
  ModuleNodeType,
} from "../../src/store/circuit-store.ts";

// ============================================================
// Helpers — AppNode (RF layer) builders
// ============================================================

function makePin(id: string, name: string, direction: "input" | "output"): Pin {
  return { id, name, direction, bits: 1 };
}

function inputNode(id: string, pinId: string, label: string, value = 0): InputNodeType {
  return {
    id, type: "circuitInput",
    position: { x: 0, y: 0 },
    data: { label, pinId, value, rotation: 0 },
  } as InputNodeType;
}

function outputNode(id: string, pinId: string, label: string): OutputNodeType {
  return {
    id, type: "circuitOutput",
    position: { x: 0, y: 0 },
    data: { label, pinId, rotation: 0 },
  } as OutputNodeType;
}

function clockNode(id: string, pinId: string, value = 0): ClockNodeType {
  return {
    id, type: "clock",
    position: { x: 0, y: 0 },
    data: { pinId, value, rotation: 0 },
  } as ClockNodeType;
}

function buttonNode(id: string, pinId: string, label: string, pressed = 0): ButtonNodeType {
  return {
    id, type: "button",
    position: { x: 0, y: 0 },
    data: { label, pinId, pressed, rotation: 0 },
  } as ButtonNodeType;
}

function probeNode(id: string, pinId: string): ProbeNodeType {
  return {
    id, type: "probe",
    position: { x: 0, y: 0 },
    data: { pinId, rotation: 0 },
  } as ProbeNodeType;
}

function constantNode(id: string, pinId: string, label: string, value: number): ConstantNodeType {
  return {
    id, type: "constant",
    position: { x: 0, y: 0 },
    data: { label, pinId, value, rotation: 0 },
  } as ConstantNodeType;
}

function nandNode(id: string, inA: string, inB: string, out: string): ModuleNodeType {
  return {
    id, type: "module",
    position: { x: 0, y: 0 },
    data: {
      label: "NAND",
      moduleId: BUILTIN_NAND_MODULE_ID,
      pins: [
        makePin(inA, "A", "input"),
        makePin(inB, "B", "input"),
        makePin(out, "Out", "output"),
      ],
      rotation: 0,
    },
  } as ModuleNodeType;
}

function moduleNode(
  id: string,
  moduleId: string,
  label: string,
  inputs: Array<{ id: string; name: string }>,
  outputs: Array<{ id: string; name: string }>,
): ModuleNodeType {
  return {
    id, type: "module",
    position: { x: 0, y: 0 },
    data: {
      label,
      moduleId,
      pins: [
        ...inputs.map((p) => makePin(p.id, p.name, "input")),
        ...outputs.map((p) => makePin(p.id, p.name, "output")),
      ],
      rotation: 0,
    },
  } as ModuleNodeType;
}

function edge(id: string, source: string, sourceHandle: string, target: string, targetHandle: string): RFEdge {
  return { id, source, sourceHandle, target, targetHandle };
}

// ============================================================
// Helper — run simulation and return store snapshot
// ============================================================

function runSim(nodes: AppNode[], edges: RFEdge[]) {
  useSimulationStore.getState().runSimulation(nodes, edges);
  return useSimulationStore.getState();
}

function pin(nodeId: string, pinId: string): string {
  return pinKey(nodeId, pinId);
}

// ============================================================
// Helper — SR Latch Module (reusable across tests)
// ============================================================

function makeSRLatchModule(): Module {
  return {
    id: "mod-sr",
    name: "SR Latch",
    inputs: [makePin("s", "S", "input"), makePin("r", "R", "input")],
    outputs: [makePin("q", "Q", "output"), makePin("qbar", "Qbar", "output")],
    circuit: {
      id: "sr-int", name: "SR Latch",
      nodes: [
        { id: "si", type: "input", position: { x: 0, y: 0 }, rotation: 0, pins: [makePin("s", "S", "output")] },
        { id: "ri", type: "input", position: { x: 0, y: 0 }, rotation: 0, pins: [makePin("r", "R", "output")] },
        { id: "n1", type: "module", moduleId: BUILTIN_NAND_MODULE_ID, position: { x: 0, y: 0 }, rotation: 0, pins: [makePin("a", "A", "input"), makePin("b", "B", "input"), makePin("o", "Out", "output")] },
        { id: "n2", type: "module", moduleId: BUILTIN_NAND_MODULE_ID, position: { x: 0, y: 0 }, rotation: 0, pins: [makePin("a", "A", "input"), makePin("b", "B", "input"), makePin("o", "Out", "output")] },
        { id: "qo", type: "output", position: { x: 0, y: 0 }, rotation: 0, pins: [makePin("q", "Q", "input")] },
        { id: "qbo", type: "output", position: { x: 0, y: 0 }, rotation: 0, pins: [makePin("qbar", "Qbar", "input")] },
      ],
      edges: [
        { id: "e1", fromNodeId: "si", fromPinId: "s", toNodeId: "n1", toPinId: "a" },
        { id: "e2", fromNodeId: "ri", fromPinId: "r", toNodeId: "n2", toPinId: "b" },
        { id: "e3", fromNodeId: "n1", fromPinId: "o", toNodeId: "qo", toPinId: "q" },
        { id: "e4", fromNodeId: "n2", fromPinId: "o", toNodeId: "qbo", toPinId: "qbar" },
        { id: "e5", fromNodeId: "n1", fromPinId: "o", toNodeId: "n2", toPinId: "a" },
        { id: "e6", fromNodeId: "n2", fromPinId: "o", toNodeId: "n1", toPinId: "b" },
      ],
    },
    createdAt: "", updatedAt: "",
  };
}

// ============================================================
// Reset stores before each test
// ============================================================

beforeEach(() => {
  useSimulationStore.setState({
    pinValues: {},
    edgeSignals: {},
    prevPinValues: new Map(),
    instanceStates: new Map(),
    oscillating: false,
    unstableEdges: {},
    running: false,
    tickRate: 2,
    signalHistory: [],
    recording: false,
  });
  useModuleStore.setState({ modules: [] });
});

// ============================================================
// I14 — Clock + Button
// ============================================================

describe("I14 — Clock source + Button", () => {
  describe("Clock node seeding", () => {
    it("clock value=0 propagates 0 through wire to output", () => {
      const nodes: AppNode[] = [
        clockNode("clk", "cp", 0),
        outputNode("out", "op", "Q"),
      ];
      const edges: RFEdge[] = [edge("e1", "clk", "cp", "out", "op")];

      const s = runSim(nodes, edges);
      expect(s.pinValues[pin("out", "op")]).toBe(0);
      expect(s.edgeSignals["e1"]).toBe(0);
    });

    it("clock value=1 propagates 1 through wire to output", () => {
      const nodes: AppNode[] = [
        clockNode("clk", "cp", 1),
        outputNode("out", "op", "Q"),
      ];
      const edges: RFEdge[] = [edge("e1", "clk", "cp", "out", "op")];

      const s = runSim(nodes, edges);
      expect(s.pinValues[pin("out", "op")]).toBe(1);
      expect(s.edgeSignals["e1"]).toBe(1);
    });
  });

  describe("Clock toggle (tickClocks simulation)", () => {
    it("alternating clock value toggles output across ticks", () => {
      // Tick 0: CLK=0 → Out=0
      const nodes0: AppNode[] = [
        clockNode("clk", "cp", 0),
        outputNode("out", "op", "Q"),
      ];
      const edges: RFEdge[] = [edge("e1", "clk", "cp", "out", "op")];

      let s = runSim(nodes0, edges);
      expect(s.pinValues[pin("out", "op")]).toBe(0);

      // Tick 1: CLK toggled → 1
      const nodes1: AppNode[] = [
        clockNode("clk", "cp", 1),
        outputNode("out", "op", "Q"),
      ];
      s = runSim(nodes1, edges);
      expect(s.pinValues[pin("out", "op")]).toBe(1);

      // Tick 2: CLK toggled → 0
      s = runSim(nodes0, edges);
      expect(s.pinValues[pin("out", "op")]).toBe(0);
    });
  });

  describe("Button node seeding", () => {
    it("button pressed=0 propagates 0", () => {
      const nodes: AppNode[] = [
        buttonNode("btn", "bp", "BTN", 0),
        outputNode("out", "op", "Q"),
      ];
      const edges: RFEdge[] = [edge("e1", "btn", "bp", "out", "op")];

      const s = runSim(nodes, edges);
      expect(s.pinValues[pin("out", "op")]).toBe(0);
    });

    it("button pressed=1 propagates 1", () => {
      const nodes: AppNode[] = [
        buttonNode("btn", "bp", "BTN", 1),
        outputNode("out", "op", "Q"),
      ];
      const edges: RFEdge[] = [edge("e1", "btn", "bp", "out", "op")];

      const s = runSim(nodes, edges);
      expect(s.pinValues[pin("out", "op")]).toBe(1);
    });

    it("button pulse: press → release changes output", () => {
      const edges: RFEdge[] = [edge("e1", "btn", "bp", "out", "op")];

      // Released
      let s = runSim([buttonNode("btn", "bp", "BTN", 0), outputNode("out", "op", "Q")], edges);
      expect(s.pinValues[pin("out", "op")]).toBe(0);

      // Pressed
      s = runSim([buttonNode("btn", "bp", "BTN", 1), outputNode("out", "op", "Q")], edges);
      expect(s.pinValues[pin("out", "op")]).toBe(1);

      // Released again
      s = runSim([buttonNode("btn", "bp", "BTN", 0), outputNode("out", "op", "Q")], edges);
      expect(s.pinValues[pin("out", "op")]).toBe(0);
    });
  });

  describe("Clock + NAND gate combination", () => {
    it("CLK → NAND(CLK, 1) = NOT(CLK)", () => {
      // Clock → NAND.A, Constant(1) → NAND.B, NAND.Out → Output
      const nodes: AppNode[] = [
        clockNode("clk", "cp", 0),
        constantNode("c1", "vcc", "VCC", 1),
        nandNode("nand", "na", "nb", "no"),
        outputNode("out", "op", "Q"),
      ];
      const edges: RFEdge[] = [
        edge("e1", "clk", "cp", "nand", "na"),
        edge("e2", "c1", "vcc", "nand", "nb"),
        edge("e3", "nand", "no", "out", "op"),
      ];

      // CLK=0 → NAND(0,1)=1
      let s = runSim(nodes, edges);
      expect(s.pinValues[pin("out", "op")]).toBe(1);

      // CLK=1 → NAND(1,1)=0
      const nodes1 = [...nodes];
      nodes1[0] = clockNode("clk", "cp", 1);
      s = runSim(nodes1, edges);
      expect(s.pinValues[pin("out", "op")]).toBe(0);
    });
  });

  describe("Probe node reads signal", () => {
    it("probe shows value from upstream wire", () => {
      const nodes: AppNode[] = [
        inputNode("in", "ip", "A", 1),
        probeNode("prb", "pp"),
      ];
      const edges: RFEdge[] = [edge("e1", "in", "ip", "prb", "pp")];

      const s = runSim(nodes, edges);
      expect(s.pinValues[pin("prb", "pp")]).toBe(1);
    });
  });

  describe("Empty circuit", () => {
    it("empty canvas clears state", () => {
      const s = runSim([], []);
      expect(s.pinValues).toEqual({});
      expect(s.edgeSignals).toEqual({});
      expect(s.oscillating).toBe(false);
    });
  });

  describe("Edge signals", () => {
    it("each edge carries source pin value", () => {
      const nodes: AppNode[] = [
        inputNode("in", "ip", "A", 1),
        outputNode("out1", "op1", "Q1"),
        outputNode("out2", "op2", "Q2"),
      ];
      const edges: RFEdge[] = [
        edge("e1", "in", "ip", "out1", "op1"),
        edge("e2", "in", "ip", "out2", "op2"),
      ];

      const s = runSim(nodes, edges);
      expect(s.edgeSignals["e1"]).toBe(1);
      expect(s.edgeSignals["e2"]).toBe(1);
    });
  });
});

// ============================================================
// I15 — Feedback loops (cyclic circuits)
// ============================================================

describe("I15 — Controlled feedback loops", () => {
  describe("SR NAND Latch (direct wiring, no sub-module)", () => {
    // S → NAND1.A, NAND2.Out → NAND1.B
    // R → NAND2.B, NAND1.Out → NAND2.A
    // NAND1.Out → Q, NAND2.Out → Qbar

    function srLatchNodes(sVal: number, rVal: number, clkVal: number): AppNode[] {
      return [
        inputNode("s", "sp", "S", sVal),
        inputNode("r", "rp", "R", rVal),
        clockNode("clk", "clkp", clkVal),
        nandNode("n1", "n1a", "n1b", "n1o"),
        nandNode("n2", "n2a", "n2b", "n2o"),
        outputNode("q", "qp", "Q"),
        outputNode("qbar", "qbp", "Qbar"),
      ];
    }

    const srEdges: RFEdge[] = [
      edge("e1", "s", "sp", "n1", "n1a"),
      edge("e2", "r", "rp", "n2", "n2b"),
      edge("e3", "n1", "n1o", "q", "qp"),
      edge("e4", "n2", "n2o", "qbar", "qbp"),
      edge("e5", "n1", "n1o", "n2", "n2a"),     // feedback
      edge("e6", "n2", "n2o", "n1", "n1b"),     // feedback
    ];

    it("Set (S=0, R=1) → Q=1, Qbar=0, stable", () => {
      const s = runSim(srLatchNodes(0, 1, 0), srEdges);
      expect(s.oscillating).toBe(false);
      expect(s.pinValues[pin("q", "qp")]).toBe(1);
      expect(s.pinValues[pin("qbar", "qbp")]).toBe(0);
    });

    it("Reset (S=1, R=0) → Q=0, Qbar=1, stable", () => {
      const s = runSim(srLatchNodes(1, 0, 0), srEdges);
      expect(s.oscillating).toBe(false);
      expect(s.pinValues[pin("q", "qp")]).toBe(0);
      expect(s.pinValues[pin("qbar", "qbp")]).toBe(1);
    });

    it("Hold after Set — retains Q=1 via prevPinValues", () => {
      // Tick 1: Set
      runSim(srLatchNodes(0, 1, 0), srEdges);

      // Tick 2: Hold (S=1, R=1) — prevPinValues carry state
      const s = runSim(srLatchNodes(1, 1, 1), srEdges);
      expect(s.oscillating).toBe(false);
      expect(s.pinValues[pin("q", "qp")]).toBe(1);
      expect(s.pinValues[pin("qbar", "qbp")]).toBe(0);
    });

    it("Hold after Reset — retains Q=0 via prevPinValues", () => {
      // Tick 1: Reset
      runSim(srLatchNodes(1, 0, 0), srEdges);

      // Tick 2: Hold
      const s = runSim(srLatchNodes(1, 1, 1), srEdges);
      expect(s.oscillating).toBe(false);
      expect(s.pinValues[pin("q", "qp")]).toBe(0);
      expect(s.pinValues[pin("qbar", "qbp")]).toBe(1);
    });

    it("Set → Hold → Reset → Hold state sequence", () => {
      // Set
      runSim(srLatchNodes(0, 1, 0), srEdges);
      let s = runSim(srLatchNodes(1, 1, 1), srEdges);
      expect(s.pinValues[pin("q", "qp")]).toBe(1);

      // Reset
      runSim(srLatchNodes(1, 0, 0), srEdges);
      s = runSim(srLatchNodes(1, 1, 1), srEdges);
      expect(s.pinValues[pin("q", "qp")]).toBe(0);
    });
  });

  describe("Cycle without clock — iterative evaluation", () => {
    it("feedback loop without clock node uses iterative evaluator (no infinite loop)", () => {
      const nodes: AppNode[] = [
        nandNode("n1", "a", "b", "o"),
      ];
      // Feedback: output → both inputs (no clock present!)
      const edges: RFEdge[] = [
        edge("fb1", "n1", "o", "n1", "a"),
        edge("fb2", "n1", "o", "n1", "b"),
      ];

      const s = runSim(nodes, edges);
      // Iterative evaluator produces values (oscillating NAND)
      expect(s.pinValues).toHaveProperty("n1:o");
      expect(s.oscillating).toBe(true);
    });
  });

  describe("Ring oscillator detection", () => {
    it("NAND feedback with clock → oscillating=true, unstable edges marked", () => {
      const nodes: AppNode[] = [
        clockNode("clk", "clkp", 0),
        nandNode("n1", "a", "b", "o"),
      ];
      const edges: RFEdge[] = [
        edge("fb1", "n1", "o", "n1", "a"),
        edge("fb2", "n1", "o", "n1", "b"),
      ];

      const s = runSim(nodes, edges);
      expect(s.oscillating).toBe(true);
      // At least one edge should be unstable
      const hasUnstable = Object.values(s.unstableEdges).some((v) => v);
      expect(hasUnstable).toBe(true);
    });
  });

  describe("Acyclic circuits still work through full pipeline", () => {
    it("NOT gate: Input(1) → NAND(A,A) → Output = 0", () => {
      const nodes: AppNode[] = [
        inputNode("in", "ip", "A", 1),
        nandNode("nand", "na", "nb", "no"),
        outputNode("out", "op", "Q"),
      ];
      const edges: RFEdge[] = [
        edge("e1", "in", "ip", "nand", "na"),
        edge("e2", "in", "ip", "nand", "nb"),
        edge("e3", "nand", "no", "out", "op"),
      ];

      const s = runSim(nodes, edges);
      expect(s.oscillating).toBe(false);
      expect(s.pinValues[pin("out", "op")]).toBe(0); // NOT(1) = 0
    });
  });
});

// ============================================================
// I16 — Per-instance state + Signal history
// ============================================================

describe("I16 — Per-instance state for sub-modules", () => {
  describe("SR Latch as saved module — Hold state across ticks", () => {
    beforeEach(() => {
      useModuleStore.setState({ modules: [makeSRLatchModule()] });
    });

    function topCircuit(sVal: number, rVal: number): { nodes: AppNode[]; edges: RFEdge[] } {
      const nodes: AppNode[] = [
        inputNode("ts", "tsp", "S", sVal),
        inputNode("tr", "trp", "R", rVal),
        moduleNode("sr", "mod-sr", "SR Latch",
          [{ id: "ms", name: "S" }, { id: "mr", name: "R" }],
          [{ id: "mq", name: "Q" }, { id: "mqb", name: "Qbar" }],
        ),
        outputNode("oq", "oqp", "Q"),
        outputNode("oqb", "oqbp", "Qbar"),
      ];
      const edges: RFEdge[] = [
        edge("e1", "ts", "tsp", "sr", "ms"),
        edge("e2", "tr", "trp", "sr", "mr"),
        edge("e3", "sr", "mq", "oq", "oqp"),
        edge("e4", "sr", "mqb", "oqb", "oqbp"),
      ];
      return { nodes, edges };
    }

    it("Set → Hold retains Q=1 via instanceStates", () => {
      const { nodes: n1, edges } = topCircuit(0, 1);
      let s = runSim(n1, edges);
      expect(s.pinValues[pin("oq", "oqp")]).toBe(1);

      const { nodes: n2 } = topCircuit(1, 1);
      s = runSim(n2, edges);
      expect(s.pinValues[pin("oq", "oqp")]).toBe(1);
      expect(s.pinValues[pin("oqb", "oqbp")]).toBe(0);
    });

    it("Reset → Hold retains Q=0 via instanceStates", () => {
      const { nodes: n1, edges } = topCircuit(1, 0);
      let s = runSim(n1, edges);
      expect(s.pinValues[pin("oq", "oqp")]).toBe(0);

      const { nodes: n2 } = topCircuit(1, 1);
      s = runSim(n2, edges);
      expect(s.pinValues[pin("oq", "oqp")]).toBe(0);
      expect(s.pinValues[pin("oqb", "oqbp")]).toBe(1);
    });

    it("Set → Hold → Reset → Hold full cycle", () => {
      const { edges } = topCircuit(0, 1);

      // Set
      runSim(topCircuit(0, 1).nodes, edges);
      let s = runSim(topCircuit(1, 1).nodes, edges);
      expect(s.pinValues[pin("oq", "oqp")]).toBe(1);

      // Reset
      runSim(topCircuit(1, 0).nodes, edges);
      s = runSim(topCircuit(1, 1).nodes, edges);
      expect(s.pinValues[pin("oq", "oqp")]).toBe(0);
    });
  });

  describe("Two independent SR Latch instances", () => {
    beforeEach(() => {
      useModuleStore.setState({ modules: [makeSRLatchModule()] });
    });

    it("each instance holds its own state independently", () => {
      const nodes: AppNode[] = [
        inputNode("s1", "s1p", "S1", 0),
        inputNode("r1", "r1p", "R1", 1),
        inputNode("s2", "s2p", "S2", 1),
        inputNode("r2", "r2p", "R2", 0),
        moduleNode("sr1", "mod-sr", "SR1",
          [{ id: "sr1_s", name: "S" }, { id: "sr1_r", name: "R" }],
          [{ id: "sr1_q", name: "Q" }, { id: "sr1_qb", name: "Qbar" }],
        ),
        moduleNode("sr2", "mod-sr", "SR2",
          [{ id: "sr2_s", name: "S" }, { id: "sr2_r", name: "R" }],
          [{ id: "sr2_q", name: "Q" }, { id: "sr2_qb", name: "Qbar" }],
        ),
        outputNode("q1", "q1p", "Q1"),
        outputNode("q2", "q2p", "Q2"),
      ];
      const edges: RFEdge[] = [
        edge("e1", "s1", "s1p", "sr1", "sr1_s"),
        edge("e2", "r1", "r1p", "sr1", "sr1_r"),
        edge("e3", "s2", "s2p", "sr2", "sr2_s"),
        edge("e4", "r2", "r2p", "sr2", "sr2_r"),
        edge("e5", "sr1", "sr1_q", "q1", "q1p"),
        edge("e6", "sr2", "sr2_q", "q2", "q2p"),
      ];

      // Tick 1: Set SR1 (S=0,R=1→Q=1), Reset SR2 (S=1,R=0→Q=0)
      let s = runSim(nodes, edges);
      expect(s.pinValues[pin("q1", "q1p")]).toBe(1);
      expect(s.pinValues[pin("q2", "q2p")]).toBe(0);

      // Tick 2: Hold both (S=1, R=1)
      const holdNodes: AppNode[] = [
        inputNode("s1", "s1p", "S1", 1),
        inputNode("r1", "r1p", "R1", 1),
        inputNode("s2", "s2p", "S2", 1),
        inputNode("r2", "r2p", "R2", 1),
        nodes[4]!, nodes[5]!, nodes[6]!, nodes[7]!,
      ];
      s = runSim(holdNodes, edges);
      expect(s.pinValues[pin("q1", "q1p")]).toBe(1);  // SR1 holds 1
      expect(s.pinValues[pin("q2", "q2p")]).toBe(0); // SR2 holds 0
    });
  });

  describe("instanceStates is reset on empty circuit", () => {
    it("clearing canvas resets instanceStates", () => {
      useModuleStore.setState({ modules: [makeSRLatchModule()] });

      // Build some state
      const nodes: AppNode[] = [
        inputNode("s", "sp", "S", 0),
        inputNode("r", "rp", "R", 1),
        moduleNode("sr", "mod-sr", "SR",
          [{ id: "ms", name: "S" }, { id: "mr", name: "R" }],
          [{ id: "mq", name: "Q" }, { id: "mqb", name: "Qbar" }],
        ),
        outputNode("q", "qp", "Q"),
      ];
      const edges: RFEdge[] = [
        edge("e1", "s", "sp", "sr", "ms"),
        edge("e2", "r", "rp", "sr", "mr"),
        edge("e3", "sr", "mq", "q", "qp"),
      ];
      runSim(nodes, edges);

      // Clear
      const s = runSim([], []);
      expect(s.instanceStates.size).toBe(0);
    });
  });
});

// ============================================================
// I16 — Signal history & Recording
// ============================================================

describe("I16 — Signal history recording", () => {
  it("no recording by default — history stays empty", () => {
    const nodes: AppNode[] = [
      clockNode("clk", "cp", 0),
      outputNode("out", "op", "Q"),
    ];
    const edges: RFEdge[] = [edge("e1", "clk", "cp", "out", "op")];

    runSim(nodes, edges);
    runSim(nodes, edges);
    runSim(nodes, edges);

    const s = useSimulationStore.getState();
    expect(s.signalHistory).toHaveLength(0);
  });

  it("toggleRecording enables recording", () => {
    useSimulationStore.getState().toggleRecording();
    expect(useSimulationStore.getState().recording).toBe(true);
  });

  it("records pinValues snapshot each tick when recording", () => {
    useSimulationStore.getState().toggleRecording();

    const edges: RFEdge[] = [edge("e1", "clk", "cp", "out", "op")];

    // Tick 1: CLK=0
    runSim([clockNode("clk", "cp", 0), outputNode("out", "op", "Q")], edges);
    // Tick 2: CLK=1
    runSim([clockNode("clk", "cp", 1), outputNode("out", "op", "Q")], edges);
    // Tick 3: CLK=0
    runSim([clockNode("clk", "cp", 0), outputNode("out", "op", "Q")], edges);

    const s = useSimulationStore.getState();
    expect(s.signalHistory).toHaveLength(3);

    // Verify clock signal alternates in history
    expect(s.signalHistory[0]![pin("clk", "cp")]).toBe(0);
    expect(s.signalHistory[1]![pin("clk", "cp")]).toBe(1);
    expect(s.signalHistory[2]![pin("clk", "cp")]).toBe(0);

    // Output follows clock
    expect(s.signalHistory[0]![pin("out", "op")]).toBe(0);
    expect(s.signalHistory[1]![pin("out", "op")]).toBe(1);
    expect(s.signalHistory[2]![pin("out", "op")]).toBe(0);
  });

  it("clearHistory resets signal history", () => {
    useSimulationStore.getState().toggleRecording();

    const nodes: AppNode[] = [clockNode("clk", "cp", 0), outputNode("out", "op", "Q")];
    const edges: RFEdge[] = [edge("e1", "clk", "cp", "out", "op")];
    runSim(nodes, edges);

    expect(useSimulationStore.getState().signalHistory).toHaveLength(1);

    useSimulationStore.getState().clearHistory();
    expect(useSimulationStore.getState().signalHistory).toHaveLength(0);
  });

  it("history respects maxHistoryLength (circular buffer)", () => {
    useSimulationStore.setState({ maxHistoryLength: 4, recording: true });

    const edges: RFEdge[] = [edge("e1", "clk", "cp", "out", "op")];

    // Run 6 ticks — only last 4 should remain
    for (let i = 0; i < 6; i++) {
      runSim(
        [clockNode("clk", "cp", i % 2 === 1 ? 1 : 0), outputNode("out", "op", "Q")],
        edges,
      );
    }

    const s = useSimulationStore.getState();
    expect(s.signalHistory).toHaveLength(4);

    // 6 ticks: i=0→0, i=1→1, i=2→0, i=3→1, i=4→0, i=5→1
    // maxHistoryLength=4, so last 4 remain: i=2→0, i=3→1, i=4→0, i=5→1
    expect(s.signalHistory[0]![pin("clk", "cp")]).toBe(0);
    expect(s.signalHistory[1]![pin("clk", "cp")]).toBe(1);
    expect(s.signalHistory[2]![pin("clk", "cp")]).toBe(0);
    expect(s.signalHistory[3]![pin("clk", "cp")]).toBe(1);
  });

  it("stopping recording freezes history", () => {
    useSimulationStore.getState().toggleRecording(); // on

    const nodes: AppNode[] = [clockNode("clk", "cp", 0), outputNode("out", "op", "Q")];
    const edges: RFEdge[] = [edge("e1", "clk", "cp", "out", "op")];

    runSim(nodes, edges);
    runSim(nodes, edges);
    expect(useSimulationStore.getState().signalHistory).toHaveLength(2);

    useSimulationStore.getState().toggleRecording(); // off

    runSim(nodes, edges);
    runSim(nodes, edges);
    expect(useSimulationStore.getState().signalHistory).toHaveLength(2); // unchanged
  });
});

// ============================================================
// Cross-iteration integration scenarios
// ============================================================

describe("Cross-iteration integration", () => {
  describe("SR Latch module + Clock + Recording (I14+I15+I16)", () => {
    beforeEach(() => {
      useModuleStore.setState({ modules: [makeSRLatchModule()] });
      useSimulationStore.getState().toggleRecording();
    });

    it("full sequence: Set → Hold (4 ticks with clock) → recording captures all states", () => {
      const edges: RFEdge[] = [
        edge("e1", "s", "sp", "sr", "ms"),
        edge("e2", "r", "rp", "sr", "mr"),
        edge("e3", "sr", "mq", "q", "qp"),
        edge("e4", "clk", "clkp", "probe", "pp"),
      ];

      // Tick 0: Set (S=0, R=1), CLK=0
      runSim([
        inputNode("s", "sp", "S", 0),
        inputNode("r", "rp", "R", 1),
        clockNode("clk", "clkp", 0),
        moduleNode("sr", "mod-sr", "SR",
          [{ id: "ms", name: "S" }, { id: "mr", name: "R" }],
          [{ id: "mq", name: "Q" }, { id: "mqb", name: "Qbar" }],
        ),
        outputNode("q", "qp", "Q"),
        probeNode("probe", "pp"),
      ], edges);

      // Tick 1: Hold (S=1, R=1), CLK=1
      runSim([
        inputNode("s", "sp", "S", 1),
        inputNode("r", "rp", "R", 1),
        clockNode("clk", "clkp", 1),
        moduleNode("sr", "mod-sr", "SR",
          [{ id: "ms", name: "S" }, { id: "mr", name: "R" }],
          [{ id: "mq", name: "Q" }, { id: "mqb", name: "Qbar" }],
        ),
        outputNode("q", "qp", "Q"),
        probeNode("probe", "pp"),
      ], edges);

      // Tick 2: Still Hold, CLK=0
      runSim([
        inputNode("s", "sp", "S", 1),
        inputNode("r", "rp", "R", 1),
        clockNode("clk", "clkp", 0),
        moduleNode("sr", "mod-sr", "SR",
          [{ id: "ms", name: "S" }, { id: "mr", name: "R" }],
          [{ id: "mq", name: "Q" }, { id: "mqb", name: "Qbar" }],
        ),
        outputNode("q", "qp", "Q"),
        probeNode("probe", "pp"),
      ], edges);

      // Tick 3: Still Hold, CLK=1
      runSim([
        inputNode("s", "sp", "S", 1),
        inputNode("r", "rp", "R", 1),
        clockNode("clk", "clkp", 1),
        moduleNode("sr", "mod-sr", "SR",
          [{ id: "ms", name: "S" }, { id: "mr", name: "R" }],
          [{ id: "mq", name: "Q" }, { id: "mqb", name: "Qbar" }],
        ),
        outputNode("q", "qp", "Q"),
        probeNode("probe", "pp"),
      ], edges);

      const s = useSimulationStore.getState();

      // 4 ticks recorded
      expect(s.signalHistory).toHaveLength(4);

      // Q stays 1 across all ticks (Set then Hold)
      for (let i = 0; i < 4; i++) {
        expect(s.signalHistory[i]![pin("q", "qp")]).toBe(1);
      }

      // Clock alternates in history
      expect(s.signalHistory[0]![pin("clk", "clkp")]).toBe(0);
      expect(s.signalHistory[1]![pin("clk", "clkp")]).toBe(1);
      expect(s.signalHistory[2]![pin("clk", "clkp")]).toBe(0);
      expect(s.signalHistory[3]![pin("clk", "clkp")]).toBe(1);

      // Probe mirrors clock
      expect(s.signalHistory[0]![pin("probe", "pp")]).toBe(0);
      expect(s.signalHistory[1]![pin("probe", "pp")]).toBe(1);
    });
  });

  describe("Button + NAND gate — combinational through full pipeline", () => {
    it("button controls NAND input dynamically", () => {
      // BTN → NAND.A, Constant(1) → NAND.B → Output
      // NAND(0,1)=1, NAND(1,1)=0
      const edges: RFEdge[] = [
        edge("e1", "btn", "bp", "nand", "na"),
        edge("e2", "c1", "vcc", "nand", "nb"),
        edge("e3", "nand", "no", "out", "op"),
      ];

      const mkNodes = (pressed: number): AppNode[] => [
        buttonNode("btn", "bp", "BTN", pressed),
        constantNode("c1", "vcc", "VCC", 1),
        nandNode("nand", "na", "nb", "no"),
        outputNode("out", "op", "Q"),
      ];

      // Not pressed → NAND(0,1) = 1
      let s = runSim(mkNodes(0), edges);
      expect(s.pinValues[pin("out", "op")]).toBe(1);

      // Pressed → NAND(1,1) = 0
      s = runSim(mkNodes(1), edges);
      expect(s.pinValues[pin("out", "op")]).toBe(0);

      // Released → NAND(0,1) = 1 again
      s = runSim(mkNodes(0), edges);
      expect(s.pinValues[pin("out", "op")]).toBe(1);
    });
  });

  describe("Simulation store state management", () => {
    it("play/pause toggle", () => {
      expect(useSimulationStore.getState().running).toBe(false);
      useSimulationStore.getState().play();
      expect(useSimulationStore.getState().running).toBe(true);
      useSimulationStore.getState().pause();
      expect(useSimulationStore.getState().running).toBe(false);
    });

    it("setTickRate updates Hz", () => {
      useSimulationStore.getState().setTickRate(10);
      expect(useSimulationStore.getState().tickRate).toBe(10);
    });
  });
});
