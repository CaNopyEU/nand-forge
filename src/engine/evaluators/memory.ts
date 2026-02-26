import type { CircuitNode, Module, PinId } from "../types.ts";
import type { AdjacencyList, InstanceState } from "../simulate.ts";
import { pinKey, resolveInputInternal } from "../simulate.ts";

/**
 * ROM evaluator: address input → data output (combinational read).
 */
export function evaluateRom(
  node: CircuitNode,
  adj: AdjacencyList,
  pinValues: Map<string, number>,
  _modules?: Module[],
  _instanceStates?: Map<string, InstanceState>,
): void {
  const addrPin = node.pins.find((p) => p.direction === "input");
  const dataPin = node.pins.find((p) => p.direction === "output");
  if (!addrPin || !dataPin) return;
  const addrKey = pinKey(node.id, addrPin.id);
  const addr = resolveInputInternal(adj, addrKey, pinValues);
  pinValues.set(addrKey, addr);
  const addrMask = (1 << (addrPin.bits as number)) - 1;
  const safeAddr = addr >= 0 ? addr : 0;
  const data = (node.romData ?? [])[safeAddr & addrMask] ?? 0;
  pinValues.set(pinKey(node.id, dataPin.id), data);
}

/**
 * RAM evaluator: rising-edge write, combinational read.
 */
export function evaluateRam(
  node: CircuitNode,
  adj: AdjacencyList,
  pinValues: Map<string, number>,
  _modules?: Module[],
  instanceStates?: Map<string, InstanceState>,
): void {
  const addrPin = node.pins.find((p) => p.name === "Addr");
  const dataInPin = node.pins.find((p) => p.name === "DIn");
  const wePin = node.pins.find((p) => p.name === "WE");
  const clkPin = node.pins.find((p) => p.name === "CLK");
  const dataOutPin = node.pins.find((p) => p.direction === "output");
  if (!addrPin || !dataInPin || !wePin || !clkPin || !dataOutPin) return;

  const resolveInput = (pin: { id: PinId }): number => {
    const key = pinKey(node.id, pin.id);
    const raw = resolveInputInternal(adj, key, pinValues);
    const val = raw >= 0 ? raw : 0;
    pinValues.set(key, val);
    return val;
  };

  const addr = resolveInput(addrPin);
  const dataIn = resolveInput(dataInPin);
  const writeEnable = resolveInput(wePin);
  const clkVal = resolveInput(clkPin);

  const prevState = instanceStates?.get(node.id);
  const prevClkVal = prevState?.pinValues.get(pinKey(node.id, clkPin.id)) ?? 0;
  const addrBits = addrPin.bits as number;
  const size = 1 << addrBits;
  const addrMask = size - 1;

  const ramData: number[] = prevState?.ramData
    ? [...prevState.ramData]
    : (node.initialData ? [...node.initialData] : new Array(size).fill(0));

  const risingEdge = prevClkVal === 0 && clkVal === 1;
  let lastWriteAddr: number | null = prevState?.lastWriteAddr ?? null;
  if (risingEdge && writeEnable) {
    const wrAddr = addr & addrMask;
    ramData[wrAddr] = dataIn & 0xFF;
    lastWriteAddr = wrAddr;
  } else {
    lastWriteAddr = null;
  }

  const dataOut = ramData[addr & addrMask] ?? 0;
  pinValues.set(pinKey(node.id, dataOutPin.id), dataOut);

  if (instanceStates) {
    const newPinValues = new Map<string, number>();
    newPinValues.set(pinKey(node.id, clkPin.id), clkVal);
    instanceStates.set(node.id, {
      pinValues: newPinValues,
      children: prevState?.children ?? new Map(),
      ramData,
      lastWriteAddr,
    });
  }
}
