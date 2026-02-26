import { useEffect, useRef, useCallback } from "react";
import type { WorkerRequest, WorkerResponse } from "../engine/worker-protocol.ts";

interface WorkerHandle {
  postSimulate: (request: WorkerRequest) => boolean;
  pendingRequestId: () => number;
  nextRequestId: () => number;
}

/**
 * Manages the simulation Web Worker lifecycle.
 *
 * - Creates the worker on mount, terminates on unmount.
 * - Falls back gracefully if Worker construction fails (test env, SSR).
 * - Exposes `postSimulate()` which returns false if worker is unavailable.
 * - Cancellation via monotonic requestId: stale responses are discarded by the caller.
 */
export function useSimulationWorker(
  onResult: (response: WorkerResponse) => void,
): WorkerHandle {
  const workerRef = useRef<Worker | null>(null);
  const fallbackRef = useRef(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    try {
      const worker = new Worker(
        new URL("../workers/simulation.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        onResult(e.data);
      };
      workerRef.current = worker;
    } catch {
      fallbackRef.current = true;
    }

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
    // onResult is stable (useCallback in consumer) — safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const postSimulate = useCallback((request: WorkerRequest): boolean => {
    if (fallbackRef.current || !workerRef.current) return false;
    workerRef.current.postMessage(request);
    return true;
  }, []);

  const pendingRequestId = useCallback(() => requestIdRef.current, []);
  const nextRequestId = useCallback(() => ++requestIdRef.current, []);

  return { postSimulate, pendingRequestId, nextRequestId };
}
