# NAND Forge — Post-MVP Progress Tracker

Tracking subor pre post-MVP iteracie. Roadmap: [`post-mvp-roadmap.md`](post-mvp-roadmap.md).

---

## Faza A — Sekvencne obvody

### Iteracia 14 — Clock source + Button [DONE]

| # | Task | Status |
|---|---|---|
| 14.1 | Clock node typ | DONE |
| 14.2 | Clock konfiguracia (tick rate: 1/2/5/10/25 Hz) | DONE |
| 14.3 | Taktovana simulacia (setInterval + tickClocks) | DONE |
| 14.4 | Play / Pause / Step v toolbare | DONE |
| 14.5 | Clock vizual (cyan tema, signal indikator) | DONE |
| 14.6 | Button (pulse) node (momentany, pointerDown/Up) | DONE |
| 14.7 | Clock + Button v canvas paneli (+ Clock, + Button buttons) | DONE |

**Implementacia:**
- Engine: `CircuitNode.type` rozsireny o `"clock" | "button"`, seeding v `evaluateCircuitFull`
- Store: `ClockNodeData`, `ButtonNodeData`, `tickClocks()` (bez undo), `setButtonPressed()` (bez undo)
- Simulation store: `running`, `tickRate`, `play/pause/step/setTickRate`
- Hook: `useClockTick` — `setInterval(tickClocks, 1000/tickRate)` ked `running=true`
- Komponenty: `ClockNode.tsx` (cyan), `ButtonNode.tsx` (rose, editable label)
- Konverzia: oba smery (canvas-to-circuit, circuit-to-canvas)
- Toolbar: Play/Pause toggle, Step button, tick rate select

---

### Iteracia 15 — Kontrolovane cykly (feedback loops) [DONE]

| # | Task | Status |
|---|---|---|
| 15.1 | Iterativny evaluator (Gauss-Seidel convergence) | DONE |
| 15.2 | Povolenie cyklov (s clockom) | DONE |
| 15.3 | Stabilizacia detekcia + prevPinValues delay model | DONE |
| 15.4 | Oscilacia warning (unstable edges vizual) | DONE |
| 15.5 | Testy cykly (SR latch, ring oscillator, acyclic sanity) | DONE |

**Implementacia:**
- Engine: `simulate-iterative.ts` — iterativny evaluator s convergence loop (max 100 iteracii)
- `evaluateCircuit` fallback na iterativny evaluator pri cycle detekcii
- Simulation store: `prevPinValues`, `oscillating`, `unstableEdges`
- Vizual: oscillating edges animacia

---

### Iteracia 16 — Flip-Flopy a Registre [DONE]

| # | Task | Status |
|---|---|---|
| 16.1 | Per-instance state (`instanceStates` Map) | DONE |
| 16.2 | `evaluateCircuitWithState` (outputs + pinValues) | DONE |
| 16.3 | Thread `instanceStates` cez evaluateNode, evaluateCircuitFull, iterativny evaluator | DONE |
| 16.4 | Simulation store integrácia (instanceStates persistencia medzi tikmi) | DONE |
| 16.5 | Signal history (recording, maxHistoryLength: 128) | DONE |
| 16.6 | Timing diagram view (SVG waveform, signal selector, Record/Stop/Clear) | DONE |
| 16.7 | Testy per-instance state (SR latch hold, nezavisle instancie, acyclic sanity) | DONE |

**Implementacia:**
- Engine: `instanceStates: Map<string, InstanceState>` (hierarchicke) — kazdy modul-instance node ma vlastne ulozene pin values z predchadzajuceho ticku
- `evaluateCircuitWithState()` — vrati outputs + full pinValues, try topological / catch iterative
- `evaluateNode` module case: cita `prevSubState` z `instanceStates`, zapisuje novy stav po evaluacii
- Simulation store: `instanceStates`, `signalHistory`, `recording`, `toggleRecording()`, `clearHistory()`
- Komponenty: `TimingDiagramView.tsx` — dialog s SVG waveformami, signal selector (checkboxy), auto-scroll
- Toolbar: "Timing" button vedla "Truth Table"
- Testy: 4 nove (SR latch Set→Hold, Reset→Hold, 2 nezavisle instancie, acyclic NOT gate)

---

## Faza B — Multi-bit & UX

### Iteracia 17A — Core Multi-bit Engine [DONE]

| # | Task | Status |
|---|---|---|
| 17.1 | Multi-bit pin typ (`Pin.bits: BitWidth = 1 \| 4 \| 8 \| 16`) | DONE |
| 17.5 | Bus validacia (wire medzi pinmi roznej sirky → reject) | DONE |
| 17.6 | Bus simulacia (`boolean` → `number` vsade) | DONE |
| 17.7 | Spatna kompatibilita (1-bit moduly funguju rovnako) | DONE |

**Implementacia:**
- Engine: `BitWidth` typ, `Pin.bits` rozsireny na `1 | 4 | 8 | 16`
- Engine: vsetky signal hodnoty `boolean` → `number` (`evaluateNand` pouziva bitovy `(a & b) ? 0 : 1`)
- Engine: `InstanceState.pinValues`, `IterativeResult.pinValues`, vsetky `evaluateCircuit*` funkcie → `Map<string, number>` / `Record<string, number>`
- Store: `InputNodeData.value`, `ConstantNodeData.value`, `ClockNodeData.value`, `ButtonNodeData.pressed` → `number`
- Store: `SimulationStore.pinValues`, `edgeSignals`, `prevPinValues`, `signalHistory` → `number`
- Konverzia: `canvas-to-circuit.ts` a `circuit-converters.ts` — default hodnoty `0` namiesto `false`
- Wiring: `useWiring.ts` — novy `getPinBits()` helper + pravidlo: `sourceBits !== targetBits → reject`
- UI: vsetky `?? false` → `?? 0`, ButtonNode `setButtonPressed(id, 1/0)`
- Persistence: `migrateNodeValues()` — stare boolean hodnoty sa automaticky migruju na number pri nacitani z localStorage
- Testy: vsetky existujuce testy aktualizovane (`true/false` → `1/0`), novy `useWiring.test.ts` (11 testov pre bit width validaciu)

### Iteracia 17B — Bus I/O, Splitter/Merger, Bus Wire Rendering [DONE]

| # | Task | Status |
|---|---|---|
| 17.2 | Bus wire rendering (hrubsi stroke + hex label) | DONE |
| 17.3 | Bus Input/Output nody (konfigurovatelna bitova sirka) | DONE |
| 17.4 | Splitter/Merger (built-in moduly) | DONE |

**Implementacia:**
- Store: `InputNodeData.bits`, `OutputNodeData.bits` (`BitWidth`), `addNode(…, bits?)`, `setInputValue()` action
- Store: `extractInterface` cita `bits` z Input/Output node data namiesto hardcoded `1`
- Wiring: `getPinBits` rozsireny o `circuitInput`/`circuitOutput`, `onConnect` uklada `bits` do edge data
- Engine: `BUILTIN_SPLITTER_MODULE_ID`, `BUILTIN_MERGER_MODULE_ID` + evaluateNode cases (bit extraction/composition)
- UI: `ManhattanEdge` — bus wiry hrubsie (3.5px), hex label cez `EdgeLabelRenderer`
- UI: `InputNode` — multi-bit mode: hex input field + bit width badge
- UI: `OutputNode` — multi-bit mode: hex display (green/gray) + bit width badge
- UI: `Canvas` — 4 nove tlacidla: Bus In, Bus Out, Splitter, Merger (amber tema)
- Konverzia: `canvas-to-circuit` a `circuit-converters` — bits zachovanie, splitter/merger label detection
- Testy: 8 novych engine testov (Splitter 8/4-bit, Merger 8/4-bit, roundtrip), 6 novych wiring testov (bus I/O bit width)

### Iteracia 17C — Bus Peripherals [DONE]

| # | Task | Status |
|---|---|---|
| 17.8 | DIP Switch node (8-bit toggle, engine type input+variant) | DONE |
| 17.9 | Hex Display node (hex/bin/dec zobrazenie, engine type output+variant) | DONE |
| 17.10 | LED Bar node (8 LED kruzkov s glow efektom) | DONE |
| 17.11 | Tunnel node (wireless prepojenie cez meno, novy engine type "tunnel") | DONE |

**Implementacia:**
- Engine: `CircuitNode.variant?: string` pre rozlisenie DIP/Hex/LED od beznych input/output nodov
- Engine: novy typ `"tunnel"` — pass-through node (input → output), `resolveTunnels()` vytvara virtualne edges medzi rovnomennymi tunnelIn/tunnelOut parmi pred evaluaciou
- Engine: tunnel integrovany do `evaluateCircuitFull` aj `evaluateCircuitIterative`
- Store: 4 nove data typy (`DipSwitchNodeData`, `HexDisplayNodeData`, `LedBarNodeData`, `TunnelNodeData`), `setDipSwitchValue()` action
- Store: `addNode` rozsireny o `dipSwitch`, `hexDisplay`, `ledBar`, `tunnel` cases
- Konverzia: `canvas-to-circuit` — DIP→input+dip-switch, Hex→output+hex-display, LED→output+led-bar, Tunnel→tunnel+2 piny (visible + internal)
- Konverzia: `circuit-converters` — variant-aware spätna konverzia (zachovava DIP/Hex/LED/Tunnel pri load)
- Wiring: `getPinBits` rozsireny pre vsetky 4 nove typy
- UI: `DipSwitchNode.tsx` (amber, 8 toggle buttons MSB-first, editable label)
- UI: `HexDisplayNode.tsx` (amber, hex/bin/dec, green ked non-zero)
- UI: `LedBarNode.tsx` (amber, 8 LED kruzkov so shadow glow)
- UI: `TunnelNode.tsx` (violet, direction-dependent handle, editable label = tunnel name, signal badge)
- Canvas: 7 novych tlacidiel (+ DIP, + Hex, + LEDs, |, + Tun In, + Tun Out)
- Testy: 14 novych testov (DIP evaluation, Hex/LED readback, tunnel basic/mismatch/multi-driver/bus-width, resolveTunnels, round-trip variant preservation)

### Iteracia 18 — Undo/Redo [DONE — MVP I13]

> Pozn.: Undo/Redo bol implementovany uz v MVP iteracii 13 (snapshot-based pristup).

### Iteracia 19 — Drill-down do modulov [DONE]

| # | Task | Status |
|---|---|---|
| 19.1 | Drill-down stav v circuit-store (stack, root context, readOnly) | DONE |
| 19.2 | Double-click na modul → drill-down (read-only canvas) | DONE |
| 19.3 | Breadcrumb navigacia v toolbare (Root / ModuleA / ModuleB) | DONE |
| 19.4 | Live simulacne hodnoty v drill-down (root simulacia + instanceState traversal) | DONE |
| 19.5 | Read-only guards (nodes, edges, input interakcie, library stamp/drag) | DONE |
| 19.6 | Escape → navigate up, Enter Edit Mode button | DONE |

**Implementacia:**
- Store: `DrilldownFrame` a `DrilldownRootContext` typy, 3 nove state polia (`drilldownStack`, `drilldownRoot`, `readOnly`)
- Store: 3 nove akcie — `drillDown(instanceNodeId)` (push frame, save root, load sub-module, set readOnly), `navigateToLevel(level)` (truncate stack alebo restore root), `enterEditMode()` (clear drill-down, keep module on canvas)
- Store: `tickClocks` modifikovany — v drill-down toggleuje clocky v root kontexte
- Canvas: `onNodeDoubleClick` handler — double-click na module node spusti `drillDown`, built-in moduly (NAND/Splitter/Merger) ignorovane
- Canvas: read-only guards — `nodesDraggable`, `nodesConnectable`, `deleteKeyCode`, guarded `onNodesChange` (len select+dimensions), `onEdgesChange` (len select), guarded `handleDrop`/`handlePaneClick`/`handleNodeContextMenu`
- Canvas: skryty add-node panel, zobrazeny "Read-only view" indikator
- Canvas: Escape handler — naviguje o uroven hore v drill-down
- Toolbar: breadcrumb UI s kliknutelnymi levelmi, "Edit" button, disabled Undo/Redo/Save/New Module
- Simulacia: `useSimulation` — v drill-down simuluje root obvod, traversuje `instanceStates` hierarchiu podla `drilldownStack`, injektuje `pinValues`/`edgeSignals` pre drilled-down view
- Interaktivne nody: `InputNode`, `ButtonNode`, `DipSwitchNode`, `ConstantNode` — disabled toggle/click/input ked `readOnly`
- Library: stamp mode blokovany ked `readOnly`

### Iteracia 20 — Vizualne customizovanie [DONE]

| # | Task | Status |
|---|---|---|
| 20.1 | Farba modulu (color picker, per-definition) | DONE |
| 20.2 | Ikona modulu (emoji selector, per-definition) | DONE |
| 20.3 | Popis modulu (description textarea, tooltip) | DONE |
| 20.4 | Custom velkosc bloku (width slider, override auto-resize) | DONE |

**Implementacia:**
- Engine: `Module` rozsireny o `color?`, `icon?`, `description?`, `customWidth?` (vsetky optional — backward kompatibilne)
- Store: `ModuleNodeData` rozsireny o rovnake 4 vizualne polia
- Store: `addNode()` kopiruje vizualne props z Module definition pri vytvarani instancie
- Store: nova akcia `updateModuleVisuals(id, visuals)` — updatne Module definition + refreshne vsetky instancie na aktualnom platne
- Konverzia: `circuitNodesToAppNodes()` kopiruje vizualne props z Module definition do node data
- Novy komponent: `ModulePropertiesDialog.tsx` — farebna paleta (8 tmavych farieb), emoji selector (12 ikon), description textarea, custom width slider (72–200px), Save/Cancel
- `ModuleCard.tsx` — dynamicka background color, ikona vedla nazvu, description v tooltip, context menu (pravy klik → "Properties")
- `ModuleNode.tsx` — dynamicka `backgroundColor` (fallback zinc-800), ikona pred labelom, `title` tooltip s popisom, custom width override
- `Canvas.tsx` — node context menu rozsireny o "Properties" pre non-builtin module nody, renderuje `ModulePropertiesDialog`
- `LibraryPanel.tsx` + `LibraryTree.tsx` — threading `onProperties` callbacku, renderovanie dialogu

---

## Faza C — Pamat + Tri-state buffer [IN PROGRESS]

### Iteracia 21 — ROM (Read-Only Memory) [DONE]

| # | Task | Status |
|---|---|---|
| 21.1 | ROM modul koncept (novy `"rom"` node typ, 4-bit/8-bit addr, 8-bit data output) | DONE |
| 21.2 | ROM editor (tabulkovy dialog: addr, hex input, bin, dec; highlight non-zero) | DONE |
| 21.3 | ROM simulacia (kombinacna: addr → lookup v romData → data output, bez clocku) | DONE |
| 21.4 | ROM import/export (Export `.hex` dump, Import `.hex`/`.txt` s komentarmi, Clear all) | DONE |

**Implementacia:**
- Engine: `CircuitNode.type` rozsireny o `"rom"`, pridany `romData?: number[]` field
- Engine: `evaluateNode` — `case "rom"`: cita addr z upstream, maskuje na `addrPin.bits`, lookup v `romData`, outputuje data
- Engine: `BUILTIN_ROM_MODULE_ID` konstanta
- Store: `RomNodeData` (addrPinId, dataPinId, addressBits: 4|8, romData, rotation), `RomNodeType`, `setRomData()` akcia
- Store: `addNode("rom", ...)` — 2 varianty: 4-bit (16 entries) a 8-bit (256 entries)
- Konverzia: `canvas-to-circuit` + `circuit-converters` — obojsmerny handling `"rom"` uzla (zachovanie romData pri persist/load)
- Wiring: `getPinBits` rozsireny pre ROM (addrPin → addressBits, dataPin → 8)
- UI: `RomNode.tsx` — purple tema, addr input handle, data output handle, zobrazenie aktualneho @addr → data, "Edit" tlacidlo
- UI: `RomEditorDialog.tsx` — fixed overlay dialog, scrollovatelna tabulka, hex input per bunka, Import/Export/Clear all toolbar
- Canvas: `rom: RomNode` v nodeTypes, 2 tlacidla `+ ROM 16` a `+ ROM 256` (purple tema)
- Testy: `tests/engine/rom.test.ts` — 5 testov (lookup, out-of-bounds, addr maskovanie, no-input default, 256-entry)

### Iteracia 22 — RAM [PENDING]
### Iteracia 23 — Tri-state buffer [PENDING]

---

## Faza D — CPU [PENDING]
## Faza E — Programovanie [PENDING]
## Faza F — I/O & Periferie [PENDING]
## Faza G — Platforma & Komunita [PENDING]

---

## Subor zmien

| Iteracia | Datum | Commit | Poznamka |
|---|---|---|---|
| 14 | 2026-02-07 | 2b59ca7 | Clock + Button, Play/Pause/Step, tick rate |
| 15 | 2026-02-07 | fba524d | Kontrolovane cykly, iterativny evaluator, oscilacia detekcia |
| 16 | 2026-02-07 | — | Per-instance state, timing diagram, signal history |
| 17A | 2026-02-08 | — | Core multi-bit engine: boolean→number, BitWidth type, bus validacia |
| 17B | 2026-02-09 | — | Bus I/O nody, Splitter/Merger, bus wire rendering |
| 17C | 2026-02-09 | — | DIP Switch, Hex Display, LED Bar, Tunnel nodes |
| 19 | 2026-02-14 | — | Drill-down do modulov: double-click, breadcrumb, read-only, live sim |
| 20 | 2026-02-14 | — | Vizualne customizovanie: farba, ikona, popis, custom sirka modulov |
| 21 | 2026-02-18 | — | ROM: built-in node, kombinacny lookup, editor, hex import/export |
