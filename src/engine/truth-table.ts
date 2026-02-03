import type { Circuit, Module, TruthTable } from "./types.ts";
import { evaluateCircuit } from "./simulate.ts";

const MAX_TRUTH_TABLE_INPUTS = 16;

export function generateTruthTable(
  circuit: Circuit,
  modules: Module[],
): TruthTable | null {
  // Collect input pin IDs (from input nodes' output pins)
  const inputPinIds: string[] = [];
  for (const node of circuit.nodes) {
    if (node.type === "input") {
      for (const pin of node.pins) {
        if (pin.direction === "output") {
          inputPinIds.push(pin.id);
        }
      }
    }
  }

  if (inputPinIds.length > MAX_TRUTH_TABLE_INPUTS) {
    return null;
  }

  // Collect output pin IDs (from output nodes' input pins)
  const outputPinIds: string[] = [];
  for (const node of circuit.nodes) {
    if (node.type === "output") {
      for (const pin of node.pins) {
        if (pin.direction === "input") {
          outputPinIds.push(pin.id);
        }
      }
    }
  }

  const numCombinations = 1 << inputPinIds.length;
  const rows: Record<string, string> = {};

  for (let i = 0; i < numCombinations; i++) {
    const inputs: Record<string, boolean> = {};
    let inputKey = "";

    for (let j = 0; j < inputPinIds.length; j++) {
      const pinId = inputPinIds[j];
      if (pinId === undefined) continue;
      const bit = (i >> (inputPinIds.length - 1 - j)) & 1;
      inputs[pinId] = bit === 1;
      inputKey += bit.toString();
    }

    const outputs = evaluateCircuit(circuit, inputs, modules);

    let outputValue = "";
    for (const pinId of outputPinIds) {
      outputValue += outputs[pinId] ? "1" : "0";
    }

    rows[inputKey] = outputValue;
  }

  return { inputNames: inputPinIds, outputNames: outputPinIds, rows };
}

export function lookupTruthTable(
  table: TruthTable,
  inputs: Record<string, boolean>,
): Record<string, boolean> {
  const inputKey = table.inputNames
    .map((name) => (inputs[name] ? "1" : "0"))
    .join("");

  const outputStr = table.rows[inputKey] ?? "";
  const result: Record<string, boolean> = {};

  for (let i = 0; i < table.outputNames.length; i++) {
    const name = table.outputNames[i];
    if (name !== undefined) {
      result[name] = outputStr[i] === "1";
    }
  }

  return result;
}
