import type {
  Node,
  Edge as RFEdge,
  NodeChange,
  EdgeChange,
  XYPosition,
} from "@xyflow/react";
import type { BitWidth, Pin } from "../engine/types.ts";
import type { Rotation } from "../utils/layout.ts";

// === Node data types ===

export type InputNodeData = {
  label: string;
  pinId: string;
  value: number;
  bits: BitWidth;
  rotation: Rotation;
};

export type OutputNodeData = {
  label: string;
  pinId: string;
  bits: BitWidth;
  rotation: Rotation;
};

export type ConstantNodeData = {
  label: string;
  pinId: string;
  value: number;
  rotation: Rotation;
};

export type ProbeNodeData = {
  pinId: string;
  rotation: Rotation;
};

export type ClockNodeData = {
  pinId: string;
  value: number;
  rotation: Rotation;
};

export type ButtonNodeData = {
  label: string;
  pinId: string;
  pressed: number;
  rotation: Rotation;
};

export type DipSwitchNodeData = {
  label: string;
  pinId: string;
  value: number;
  bits: BitWidth;
  rotation: Rotation;
};

export type HexDisplayNodeData = {
  pinId: string;
  bits: BitWidth;
  rotation: Rotation;
};

export type LedBarNodeData = {
  pinId: string;
  bits: BitWidth;
  rotation: Rotation;
};

export type TunnelNodeData = {
  label: string;
  pinId: string;
  bits: BitWidth;
  direction: "in" | "out";
  rotation: Rotation;
};

export type RomNodeData = {
  addrPinId: string;
  dataPinId: string;
  addressBits: 4 | 8;
  romData: number[];
  rotation: Rotation;
};

export type RamNodeData = {
  addrPinId: string;
  dataInPinId: string;
  writePinId: string;
  clockPinId: string;
  dataOutPinId: string;
  addressBits: 4 | 8;
  initialData: number[];
  rotation: Rotation;
};

export type TristateNodeData = {
  dataPinId: string;
  enablePinId: string;
  outputPinId: string;
  bits: 1 | 8;
  rotation: Rotation;
};

export type PullNodeData = {
  outputPinId: string;
  variant: "pullup" | "pulldown";
  rotation: Rotation;
};

export type ModuleNodeData = {
  label: string;
  moduleId: string;
  pins: Pin[];
  rotation: Rotation;
  color?: string;
  icon?: string;
  description?: string;
  customWidth?: number;
};

// === App node types ===

export type InputNodeType = Node<InputNodeData, "circuitInput">;
export type OutputNodeType = Node<OutputNodeData, "circuitOutput">;
export type ConstantNodeType = Node<ConstantNodeData, "constant">;
export type ProbeNodeType = Node<ProbeNodeData, "probe">;
export type ClockNodeType = Node<ClockNodeData, "clock">;
export type ButtonNodeType = Node<ButtonNodeData, "button">;
export type DipSwitchNodeType = Node<DipSwitchNodeData, "dipSwitch">;
export type HexDisplayNodeType = Node<HexDisplayNodeData, "hexDisplay">;
export type LedBarNodeType = Node<LedBarNodeData, "ledBar">;
export type TunnelNodeType = Node<TunnelNodeData, "tunnel">;
export type RomNodeType = Node<RomNodeData, "rom">;
export type RamNodeType = Node<RamNodeData, "ram">;
export type TristateNodeType = Node<TristateNodeData, "tristate">;
export type PullNodeType = Node<PullNodeData, "pull">;
export type ModuleNodeType = Node<ModuleNodeData, "module">;
export type AppNode =
  | InputNodeType
  | OutputNodeType
  | ConstantNodeType
  | ProbeNodeType
  | ClockNodeType
  | ButtonNodeType
  | DipSwitchNodeType
  | HexDisplayNodeType
  | LedBarNodeType
  | TunnelNodeType
  | RomNodeType
  | RamNodeType
  | TristateNodeType
  | PullNodeType
  | ModuleNodeType;

// === Drill-down types ===

export interface DrilldownFrame {
  moduleId: string;
  instanceNodeId: string;
  label: string;
}

export interface DrilldownRootContext {
  moduleId: string | null;
  nodes: AppNode[];
  edges: RFEdge[];
  isDirty: boolean;
}

// === History ===

export type Snapshot = { nodes: AppNode[]; edges: RFEdge[] };

// === Store interface ===

export interface CircuitStore {
  nodes: AppNode[];
  edges: RFEdge[];
  activeModuleId: string | null;
  simulationVersion: number;
  isDirty: boolean;
  past: Snapshot[];
  future: Snapshot[];
  stampModuleId: string | null;
  drilldownStack: DrilldownFrame[];
  drilldownRoot: DrilldownRootContext | null;
  readOnly: boolean;

  onNodesChange: (changes: NodeChange<AppNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<RFEdge>[]) => void;
  addNode: (
    type: AppNode["type"],
    position: XYPosition,
    moduleId?: string,
    moduleData?: { label: string; pins: Pin[] },
    bits?: BitWidth,
    variant?: string,
  ) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: RFEdge) => void;
  removeEdge: (id: string) => void;
  toggleInputValue: (nodeId: string) => void;
  setInputValue: (nodeId: string, value: number) => void;
  toggleConstantValue: (nodeId: string) => void;
  rotateNode: (nodeId: string) => void;
  updateNodeLabel: (nodeId: string, label: string) => void;
  setEdgeColor: (edgeId: string, color: string | undefined) => void;
  tickClocks: () => void;
  setButtonPressed: (nodeId: string, pressed: number) => void;
  setDipSwitchValue: (nodeId: string, value: number) => void;
  setRomData: (nodeId: string, romData: number[]) => void;
  setRamInitialData: (nodeId: string, initialData: number[]) => void;
  clearCanvas: () => void;
  setActiveModuleId: (moduleId: string | null) => void;
  loadCircuit: (nodes: AppNode[], edges: RFEdge[]) => void;
  markClean: () => void;
  undo: () => void;
  redo: () => void;
  takeSnapshot: () => void;
  setStampModuleId: (moduleId: string | null) => void;
  drillDown: (instanceNodeId: string) => void;
  navigateToLevel: (level: number) => void;
  enterEditMode: () => void;
}
