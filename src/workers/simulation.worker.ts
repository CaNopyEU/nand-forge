import { evaluateCircuitFull } from "../engine/simulate.ts";
import { evaluateCircuitIterative } from "../engine/simulate-iterative.ts";
import type { WorkerRequest, WorkerResponse } from "../engine/worker-protocol.ts";

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  if (req.type !== "simulate") return;

  const { requestId, circuit, inputValues, modules, instanceStates, prevPinValues } = req;

  let pinValues: Map<string, number>;
  let stable = true;
  let unstableKeys = new Set<string>();

  try {
    pinValues = evaluateCircuitFull(circuit, inputValues, modules, instanceStates);
  } catch {
    const result = evaluateCircuitIterative(
      circuit,
      inputValues,
      modules,
      prevPinValues,
      instanceStates,
    );
    pinValues = result.pinValues;
    stable = result.stable;
    unstableKeys = result.unstableKeys;
  }

  const response: WorkerResponse = {
    type: "result",
    requestId,
    pinValues,
    instanceStates,
    stable,
    unstableKeys,
  };

  self.postMessage(response);
};
