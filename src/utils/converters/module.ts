import type { CircuitNode, Module } from "../../engine/types.ts";
import type { AppNode } from "../../store/circuit-store.ts";
import type { Rotation } from "../layout.ts";
import type { NodeConverter } from "../node-converters.ts";
import {
  BUILTIN_NAND_MODULE_ID,
  BUILTIN_SPLITTER_MODULE_ID,
  BUILTIN_MERGER_MODULE_ID,
} from "../../engine/constants.ts";

export const moduleConverter: NodeConverter = {
  toCircuitNode: (node: AppNode) => {
    const n = node as AppNode & { type: "module" };
    return {
      id: n.id,
      type: "module" as const,
      moduleId: n.data.moduleId,
      position: n.position,
      rotation: n.data.rotation ?? 0,
      pins: n.data.pins,
    };
  },
  fromCircuitNode: (node: CircuitNode, modules?: Module[]) => {
    const mid = node.moduleId ?? "";
    const moduleMap = modules ? new Map(modules.map((m) => [m.id, m])) : new Map<string, Module>();
    const mod = moduleMap.get(mid);
    const label = mid === BUILTIN_NAND_MODULE_ID
      ? "NAND"
      : mid === BUILTIN_SPLITTER_MODULE_ID
      ? `Split ${node.pins.filter((p) => p.direction === "output").length}`
      : mid === BUILTIN_MERGER_MODULE_ID
      ? `Merge ${node.pins.filter((p) => p.direction === "input").length}`
      : mod?.name ?? "Module";
    return {
      id: node.id,
      type: "module" as const,
      position: node.position,
      data: {
        label,
        moduleId: mid,
        pins: node.pins,
        rotation: (node.rotation ?? 0) as Rotation,
        ...(mod?.color ? { color: mod.color } : {}),
        ...(mod?.icon ? { icon: mod.icon } : {}),
        ...(mod?.description ? { description: mod.description } : {}),
        ...(mod?.customWidth ? { customWidth: mod.customWidth } : {}),
      },
    };
  },
  getPinBits: (node: AppNode, pinId?: string) => {
    const n = node as AppNode & { type: "module" };
    return n.data.pins.find((p) => p.id === pinId)?.bits ?? 1;
  },
};
