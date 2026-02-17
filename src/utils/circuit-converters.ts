import type { Edge as RFEdge } from "@xyflow/react";
import type { BitWidth, CircuitNode, Edge as EngineEdge, Module } from "../engine/types.ts";
import type { AppNode } from "../store/circuit-store.ts";
import type { Rotation } from "../utils/layout.ts";
import { BUILTIN_NAND_MODULE_ID, BUILTIN_SPLITTER_MODULE_ID, BUILTIN_MERGER_MODULE_ID } from "../engine/simulate.ts";

/**
 * Convert engine CircuitNodes back to React Flow AppNodes.
 * Used when loading a saved module's circuit onto the canvas.
 */
export function circuitNodesToAppNodes(
  nodes: CircuitNode[],
  modules: Module[],
): AppNode[] {
  const moduleMap = new Map(modules.map((m) => [m.id, m]));

  return nodes.map((node) => {
    switch (node.type) {
      case "input":
        if (node.variant === "dip-switch") {
          return {
            id: node.id,
            type: "dipSwitch" as const,
            position: node.position,
            data: {
              label: node.pins[0]?.name ?? "DIP",
              pinId: node.pins[0]?.id ?? node.id,
              value: 0,
              bits: (node.pins[0]?.bits ?? 8) as BitWidth,
              rotation: (node.rotation ?? 0) as Rotation,
            },
          };
        }
        return {
          id: node.id,
          type: "circuitInput" as const,
          position: node.position,
          data: {
            label: node.pins[0]?.name ?? "Input",
            pinId: node.pins[0]?.id ?? node.id,
            value: 0,
            bits: (node.pins[0]?.bits ?? 1) as BitWidth,
            rotation: (node.rotation ?? 0) as Rotation,
          },
        };
      case "output":
        if (node.variant === "hex-display") {
          return {
            id: node.id,
            type: "hexDisplay" as const,
            position: node.position,
            data: {
              pinId: node.pins[0]?.id ?? node.id,
              bits: (node.pins[0]?.bits ?? 8) as BitWidth,
              rotation: (node.rotation ?? 0) as Rotation,
            },
          };
        }
        if (node.variant === "led-bar") {
          return {
            id: node.id,
            type: "ledBar" as const,
            position: node.position,
            data: {
              pinId: node.pins[0]?.id ?? node.id,
              bits: (node.pins[0]?.bits ?? 8) as BitWidth,
              rotation: (node.rotation ?? 0) as Rotation,
            },
          };
        }
        return {
          id: node.id,
          type: "circuitOutput" as const,
          position: node.position,
          data: {
            label: node.pins[0]?.name ?? "Output",
            pinId: node.pins[0]?.id ?? node.id,
            bits: (node.pins[0]?.bits ?? 1) as BitWidth,
            rotation: (node.rotation ?? 0) as Rotation,
          },
        };
      case "constant": {
        const pinName = node.pins[0]?.name ?? "0";
        const value = pinName === "1" ? 1 : 0;
        return {
          id: node.id,
          type: "constant" as const,
          position: node.position,
          data: {
            label: pinName,
            pinId: node.pins[0]?.id ?? node.id,
            value,
            rotation: (node.rotation ?? 0) as Rotation,
          },
        };
      }
      case "probe":
        return {
          id: node.id,
          type: "probe" as const,
          position: node.position,
          data: {
            pinId: node.pins[0]?.id ?? node.id,
            rotation: (node.rotation ?? 0) as Rotation,
          },
        };
      case "clock":
        return {
          id: node.id,
          type: "clock" as const,
          position: node.position,
          data: {
            pinId: node.pins[0]?.id ?? node.id,
            value: 0,
            rotation: (node.rotation ?? 0) as Rotation,
          },
        };
      case "button":
        return {
          id: node.id,
          type: "button" as const,
          position: node.position,
          data: {
            label: node.pins[0]?.name ?? "BTN",
            pinId: node.pins[0]?.id ?? node.id,
            pressed: 0,
            rotation: (node.rotation ?? 0) as Rotation,
          },
        };
      case "tunnel": {
        const dir = (node.variant ?? "in") as "in" | "out";
        // Visible pin: for "in" it's the input pin, for "out" it's the output pin
        const visiblePin = dir === "in"
          ? node.pins.find((p) => p.direction === "input")
          : node.pins.find((p) => p.direction === "output");
        return {
          id: node.id,
          type: "tunnel" as const,
          position: node.position,
          data: {
            label: node.pins[0]?.name ?? "T",
            pinId: visiblePin?.id ?? node.id,
            bits: (visiblePin?.bits ?? 1) as BitWidth,
            direction: dir,
            rotation: (node.rotation ?? 0) as Rotation,
          },
        };
      }
      case "rom": {
        const addrPin = node.pins.find((p) => p.direction === "input");
        const dataPin = node.pins.find((p) => p.direction === "output");
        const addrBits = (addrPin?.bits ?? 4) as 4 | 8;
        return {
          id: node.id,
          type: "rom" as const,
          position: node.position,
          data: {
            addrPinId: addrPin?.id ?? node.id,
            dataPinId: dataPin?.id ?? node.id,
            addressBits: addrBits,
            romData: node.romData ?? (new Array(1 << addrBits).fill(0) as number[]),
            rotation: (node.rotation ?? 0) as Rotation,
          },
        };
      }
      case "module": {
        const mid = node.moduleId ?? "";
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
      }
    }
  });
}

/**
 * Convert engine Edges back to React Flow Edges.
 */
export function circuitEdgesToRFEdges(edges: EngineEdge[]): RFEdge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.fromNodeId,
    sourceHandle: e.fromPinId,
    target: e.toNodeId,
    targetHandle: e.toPinId,
    type: "manhattan" as const,
    ...(e.color ? { data: { color: e.color } } : {}),
  }));
}
