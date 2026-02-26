import type { ModuleId } from "./types.ts";

// === Wire state sentinels ===

/** High-impedance output (tri-state buffer disabled). Not a driver. */
export const Z_VALUE = -1;
/** Weak pull-up driver — wins only when no strong driver is present. */
export const WEAK_1 = -2;
/** Weak pull-down driver — wins only when no strong driver is present. */
export const WEAK_0 = -3;
/** Bus conflict — multiple strong drivers disagreed. */
export const CONFLICT = -4;

// === Built-in module IDs ===

export const BUILTIN_NAND_MODULE_ID: ModuleId = "builtin:nand";
export const BUILTIN_SPLITTER_MODULE_ID: ModuleId = "builtin:splitter";
export const BUILTIN_MERGER_MODULE_ID: ModuleId = "builtin:merger";
export const BUILTIN_ROM_MODULE_ID: ModuleId = "builtin:rom";
export const BUILTIN_RAM_MODULE_ID: ModuleId = "builtin:ram";
