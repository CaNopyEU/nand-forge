// === Identifiers ===
export type NodeId = string;
export type PinId = string;
export type EdgeId = string;
export type ModuleId = string;

// === Pin ===
export interface Pin {
  id: PinId;
  name: string;
  direction: "input" | "output";
  bits: 1;
}

// === Node on canvas ===
export interface CircuitNode {
  id: NodeId;
  type: "input" | "output" | "constant" | "probe" | "module" | "clock" | "button";
  moduleId?: ModuleId;
  position: { x: number; y: number };
  rotation: 0 | 90 | 180 | 270;
  pins: Pin[];
}

// === Wire between pins ===
export interface Edge {
  id: EdgeId;
  fromNodeId: NodeId;
  fromPinId: PinId;
  toNodeId: NodeId;
  toPinId: PinId;
  color?: string;
}

// === Circuit — editable circuit on canvas ===
export interface Circuit {
  id: string;
  name: string;
  nodes: CircuitNode[];
  edges: Edge[];
}

// === Module — saved reusable circuit ===
export interface Module {
  id: ModuleId;
  name: string;
  inputs: Pin[];
  outputs: Pin[];
  circuit: Circuit;
  pinOrder?: { inputIds: PinId[]; outputIds: PinId[] };
  createdAt: string;
  updatedAt: string;
}