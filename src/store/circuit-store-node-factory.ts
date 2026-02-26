import type { XYPosition } from "@xyflow/react";
import type { BitWidth, Pin } from "../engine/types.ts";
import { generateId } from "../utils/id.ts";
import { BUILTIN_NAND_MODULE_ID } from "../engine/constants.ts";
import { getModuleById } from "./module-store.ts";
import type { AppNode } from "./circuit-store-types.ts";

export function createNode(
  type: AppNode["type"],
  position: XYPosition,
  moduleId?: string,
  moduleData?: { label: string; pins: Pin[] },
  bits?: BitWidth,
  variant?: string,
): AppNode {
  const id = generateId();
  const bw: BitWidth = bits ?? 1;

  let node: AppNode;
  switch (type) {
    case "circuitInput":
      node = {
        id,
        type: "circuitInput",
        position,
        data: { label: "Input", pinId: generateId(), value: 0, bits: bw, rotation: 0 },
      };
      break;
    case "circuitOutput":
      node = {
        id,
        type: "circuitOutput",
        position,
        data: { label: "Output", pinId: generateId(), bits: bw, rotation: 0 },
      };
      break;
    case "constant":
      node = {
        id,
        type: "constant",
        position,
        data: { label: "0", pinId: generateId(), value: 0, rotation: 0 },
      };
      break;
    case "probe":
      node = {
        id,
        type: "probe",
        position,
        data: { pinId: generateId(), rotation: 0 },
      };
      break;
    case "clock":
      node = {
        id,
        type: "clock",
        position,
        data: { pinId: generateId(), value: 0, rotation: 0 },
      };
      break;
    case "button":
      node = {
        id,
        type: "button",
        position,
        data: { label: "BTN", pinId: generateId(), pressed: 0, rotation: 0 },
      };
      break;
    case "dipSwitch":
      node = {
        id,
        type: "dipSwitch",
        position,
        data: { label: "DIP", pinId: generateId(), value: 0, bits: 8 as BitWidth, rotation: 0 },
      };
      break;
    case "hexDisplay":
      node = {
        id,
        type: "hexDisplay",
        position,
        data: { pinId: generateId(), bits: 8 as BitWidth, rotation: 0 },
      };
      break;
    case "ledBar":
      node = {
        id,
        type: "ledBar",
        position,
        data: { pinId: generateId(), bits: 8 as BitWidth, rotation: 0 },
      };
      break;
    case "tunnel":
      node = {
        id,
        type: "tunnel",
        position,
        data: { label: "T", pinId: generateId(), bits: 1 as BitWidth, direction: (moduleData?.label === "out" ? "out" : "in") as "in" | "out", rotation: 0 },
      };
      break;
    case "rom": {
      const addrBits = (bits === 8 ? 8 : 4) as 4 | 8;
      node = {
        id,
        type: "rom",
        position,
        data: {
          addrPinId: generateId(),
          dataPinId: generateId(),
          addressBits: addrBits,
          romData: new Array(1 << addrBits).fill(0) as number[],
          rotation: 0,
        },
      };
      break;
    }
    case "ram": {
      const addrBits = (bits === 8 ? 8 : 4) as 4 | 8;
      node = {
        id,
        type: "ram",
        position,
        data: {
          addrPinId: generateId(),
          dataInPinId: generateId(),
          writePinId: generateId(),
          clockPinId: generateId(),
          dataOutPinId: generateId(),
          addressBits: addrBits,
          initialData: new Array(1 << addrBits).fill(0) as number[],
          rotation: 0,
        },
      };
      break;
    }
    case "tristate": {
      const tsBits = (bits === 8 ? 8 : 1) as 1 | 8;
      node = {
        id,
        type: "tristate",
        position,
        data: {
          dataPinId: generateId(),
          enablePinId: generateId(),
          outputPinId: generateId(),
          bits: tsBits,
          rotation: 0,
        },
      };
      break;
    }
    case "pull": {
      node = {
        id,
        type: "pull",
        position,
        data: {
          outputPinId: generateId(),
          variant: (variant === "pulldown" ? "pulldown" : "pullup") as "pullup" | "pulldown",
          rotation: 0,
        },
      };
      break;
    }
    case "module": {
      const mid = moduleId ?? BUILTIN_NAND_MODULE_ID;
      const isNand = mid === BUILTIN_NAND_MODULE_ID;
      // Use provided moduleData or fall back to NAND defaults
      const pins: Pin[] = moduleData
        ? moduleData.pins.map((p) => ({ ...p, id: generateId() }))
        : isNand
          ? [
              { id: generateId(), name: "A", direction: "input", bits: 1 },
              { id: generateId(), name: "B", direction: "input", bits: 1 },
              {
                id: generateId(),
                name: "Out",
                direction: "output",
                bits: 1,
              },
            ]
          : [];
      const label = moduleData ? moduleData.label : isNand ? "NAND" : "Module";
      // Copy visual properties from module definition
      const modDef = getModuleById(mid);
      node = {
        id,
        type: "module",
        position,
        data: {
          label,
          moduleId: mid,
          pins,
          rotation: 0,
          ...(modDef?.color ? { color: modDef.color } : {}),
          ...(modDef?.icon ? { icon: modDef.icon } : {}),
          ...(modDef?.description ? { description: modDef.description } : {}),
          ...(modDef?.customWidth ? { customWidth: modDef.customWidth } : {}),
        },
      };
      break;
    }
  }

  return node;
}
