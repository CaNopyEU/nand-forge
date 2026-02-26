import type { Circuit, Module } from "./types.ts";
import type { InstanceState } from "./simulate.ts";

// === Request ===

export interface SimulateRequest {
  type: "simulate";
  requestId: number;
  circuit: Circuit;
  inputValues: Record<string, number>;
  modules: Module[];
  instanceStates: Map<string, InstanceState>;
  prevPinValues: Map<string, number>;
}

export type WorkerRequest = SimulateRequest;

// === Response ===

export interface SimulateResponse {
  type: "result";
  requestId: number;
  pinValues: Map<string, number>;
  instanceStates: Map<string, InstanceState>;
  stable: boolean;
  unstableKeys: Set<string>;
}

export interface ErrorResponse {
  type: "error";
  requestId: number;
  message: string;
}

export type WorkerResponse = SimulateResponse | ErrorResponse;
