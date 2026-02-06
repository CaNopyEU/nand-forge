import { generateTruthTable } from "./truth-table.ts";
import type { Circuit, Module, TruthTable } from "./types.ts";

export interface TruthTableWorkerRequest {
  id: number;
  circuit: Circuit;
  modules: Module[];
}

export interface TruthTableWorkerResponse {
  id: number;
  truthTable: TruthTable | null;
}

self.onmessage = (e: MessageEvent<TruthTableWorkerRequest>) => {
  const { id, circuit, modules } = e.data;
  const truthTable = generateTruthTable(circuit, modules);
  const response: TruthTableWorkerResponse = { id, truthTable };
  self.postMessage(response);
};
