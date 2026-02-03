# NAND Forge — Status

## Quick Start pre Claude

Toto je interaktivny circuit builder kde jediny built-in gate je NAND.
Pred zaciatakom prace precitaj:

1. Tento subor — aktualny stav, rozhodnutia, poznamky
2. `tech-spec.md` — kompletna technicka specifikacia MVP (iteracie 1–13)
3. `post-mvp-roadmap.md` — post-MVP roadmap (iteracie 14–35) — **citat az ked je MVP hotove**

---

## Aktualny stav

**Faza:** Implementacia
**Aktualna iteracia:** 6 (DONE)
**Posledna zmena:** Iteracia 6 dokoncena

### Progress tracker

| Iteracia | Nazov | Status |
|---|---|---|
| 1 | Projekt setup + core typy | ✅ DONE |
| 2 | Simulation engine | ✅ DONE |
| 3 | Truth table engine | ✅ DONE |
| 4 | Canvas zaklad | ✅ DONE |
| 5 | Wiring | ✅ DONE |
| 6 | Live simulacia na canvase | ✅ DONE |
| 7 | Module system: ukladanie | ⬜ TODO |
| 8 | Module system: kniznica a pouzitie | ⬜ TODO |
| 9 | Editacia pouziteho modulu + kaskadovanie | ⬜ TODO |
| 10 | Rotacia | ⬜ TODO |
| 11 | Truth table view | ⬜ TODO |
| 12 | Persistencia + export/import | ⬜ TODO |
| 13 | Polish a edge cases | ⬜ TODO |

Statusy: ⬜ TODO | 🔧 IN PROGRESS | ✅ DONE

---

## Klucove architektonicke rozhodnutia

### R1: NAND-first pristup
- Jediny built-in gate je NAND. Vsetko ostatne (NOT, AND, OR, XOR...) si user buduje sam.
- NAND je built-in modul s fixnym `moduleId: "builtin:nand"`, engine ho evaluuje priamo `!(a && b)`.

### R2: Jednotny vizual modulov
- NAND nema specialnu grafiku. Vsetky moduly (vratane NAND) su obdlznik s menom.
- Neexistuje `NandNode.tsx` — vsetko renderuje `ModuleNode.tsx`.
- Dovod: konzistencia, jednoduchsi kod, ziadne special cases v renderovani.

### R3: Reference-based moduly (nie snapshot)
- Povodne sme planovali snapshot (kopia pri vlozeni). Zmenene na reference-based uz v MVP.
- Zmena logiky modulu sa propaguje do vsetkych instancii.
- Breaking changes (odobranie pinu) → warning dialog → odpojenie wirov.
- Dovod: NAND-first pristup vyzaduje aby zmena zakladneho modulu (napr. NOT) ovplyvnila vsetko co ho pouziva.

### R4: Truth table ako simulacny cache
- Truth table sa generuje pri ulozeni modulu (nie pri kazdom pouziti).
- Threshold: ≤ 16 inputov → lookup table, > 16 → rekurzivna simulacia.
- Lookup je O(1) bez ohladu na zlozitost modulu — nepotrebujeme hardcoded logiku pre AND, OR atd.
- Dovod: masivny performance boost pri vnorenych moduloch.

### R5: Canvas = vzdy konkretny modul
- Neexistuje "volny canvas". User vzdy pracuje na pomenovanom module.
- "New Module" → zadaj meno → cisty canvas.
- Klik na modul v library → otvori na editaciu.
- Save uklada aktualny stav modulu, canvas ostava otvoreny.
- Dovod: jednoznacna persistencia — vzdy vies co ukladas.

### R6: Piny su vzdy interface piny
- Vsetky Input/Output nody na canvase sa automaticky stanu interface pinmi modulu.
- Aj nepripojene piny su interface piny (warning, nie error).
- Pin mena sa edituju priamo na Input/Output nodoch.
- Dovod: jednoduchost — ziadne manualne oznacovanie co je interface a co nie.

### R7: React Flow ako framework
- Validovane: custom handles (viacero pinov na node) — OK.
- Validovane: custom edge routing (manhattan) — OK.
- Validovane: performance pri 100+ nodoch s dodrzanim pravidiel P1–P5 — OK.
- Performance pravidla su **povinne od prveho riadku kodu** (vid tech-spec sekcia 7.2).

### R8: Manhattan wiring — naivny L/Z-shape
- MVP pouziva jednoduchy 3-segmentovy Z-shape path (horizontal → vertical → horizontal).
- Ziadny pathfinding, ziadne obchadzanie komponentov.
- Dovod: jednoduche, vizualne dostatocne. Pathfinding pride post-MVP.

### R9: Tri-state buffer az po RAM (iteracia 23)
- Tri-state pridava treti stav (Z) do simulacie — meni core engine.
- Pre MVP a jednoduchy CPU staci multiplexer (postavitelny z NAND).
- Dovod: nechceme menit core engine kym nie je stabilny.

### R10: Convenience komponenty
- MVP: Constant (0/1), Probe (debug)
- Post-MVP Faza A: Button (pulse) — momentany signal
- Post-MVP Faza B: Splitter/Merger, DIP switch, Hex display, LED bar, Tunnel/Label

---

## Otvorene otazky / Buduci vyskum

- React Flow vs vlastny SVG: rozhodnute v prospech React Flow, ale ak sa objavi blocker → fallback plan existuje
- Web Worker pre simulaciu: zvazit az ked sa objavia performance problemy
- Undo/Redo: post-MVP (iteracia 18), command pattern

---

## Poznamky z poslednej session

_Tu sa budu pridavat poznamky z kazdeho pracovneho session. Najnovsie hore._

### Session 2026-02-03 (iteracia 6)
- Refaktorovane `src/engine/simulate.ts`:
  - Nova funkcia `evaluateCircuitFull(circuit, inputs, modules)` — vracia `Map<string, boolean>` so VSETKYMI pin values (nodeId:pinId → value)
  - `evaluateCircuit` deleguje na `evaluateCircuitFull` a extrahuje len output node values (zachovane API, existujuce testy OK)
- Pridany `simulationVersion` do `src/store/circuit-store.ts`:
  - Counter inkrementovany pri kazdej simulacne-relevantnej mutacii (addNode, removeNode, addEdge, removeEdge, toggleInputValue, toggleConstantValue, onNodesChange s remove, onEdgesChange s remove)
  - Opraveny bug: `onNodesChange` s typom 'remove' teraz cisti pripojene edges (predtym ostali ovisete)
- Pridany `ProbeNodeData` a `ProbeNodeType` do circuit-store, `addNode` podporuje typ `probe`
- Vytvorene `src/store/simulation-store.ts` — Zustand store:
  - `pinValues: Record<string, boolean>` — vsetky pin values po simulacii
  - `edgeSignals: Record<string, boolean>` — signal pre kazdy edge (podla source output pin)
  - `runSimulation(nodes, edges)` — konvertuje AppNode[]/RFEdge[] na engine Circuit, vola `evaluateCircuitFull`, uklada vysledky
  - Interna funkcia `canvasToCircuit` — mapuje React Flow typy (circuitInput/circuitOutput/constant/probe/module) na engine typy (input/output/constant/probe/module)
- Vytvorene `src/hooks/useSimulation.ts`:
  - Sleduje `simulationVersion` z circuit store
  - Pri zmene cita nodes/edges cez `getState()` (bez subscribovania na drag/pan)
  - Vola `runSimulation` zo simulation store
- Aktualizovane `src/components/Canvas/ManhattanEdge.tsx`:
  - Cita signal z `useSimulationStore` podla edge ID namiesto edge data
  - Farba: seda (#71717a) pre 0, zelena (#34d399) pre 1, modra (#60a5fa) pre selected
- Aktualizovane `src/components/Canvas/OutputNode.tsx`:
  - Cita signal z `useSimulationStore` podla `pinKey(nodeId, pinId)`
  - LED svieti zelene pri signal=true, seda pri false
- Vytvorene `src/components/Canvas/ProbeNode.tsx`:
  - `React.memo` (P2), 1 target handle vlavo
  - Zobrazuje aktualnu hodnotu (0/1) z simulation store
  - Kompaktny debug nastroj — na rozdiel od Output nema meno a nesluzi ako interface pin
- Aktualizovane `src/components/Canvas/Canvas.tsx`:
  - Registrovany `probe: ProbeNode` v `nodeTypes` (mimo komponent, P1)
  - Pridane tlacidlo "+ Probe" v paneli
  - Volany `useSimulation()` hook v `CanvasInner`
- Verifikacia: `tsc -b` zero errors, `npm run build` OK, 37/37 testov OK

### Session 2026-02-03 (iteracia 5)
- Vytvorene `src/components/Canvas/ManhattanEdge.tsx` — custom edge komponent:
  - `React.memo` (P2), SVG Z-shape path (horizontal → vertical → horizontal)
  - Ak piny v rovnakej vyske → rovny wire (2-segmentovy)
  - Farba podla signalu: `#71717a` (seda, 0/neznamy), `#34d399` (zelena, 1), `#60a5fa` (modra, selected)
  - Signal sa cita z `data.signal` na edge — pripravene pre I6 (simulation store)
  - Exportovany `ManhattanEdgeType` pre typovanie
- Vytvorene `src/hooks/useWiring.ts` — wiring hook:
  - `isValidConnection(connection)` — validacia pred pripojenim:
    - Ziadne self-connections (source === target)
    - Handles musia byt specifikovane
    - Ziadne duplicitne edges (rovnaky source+sourceHandle → target+targetHandle)
    - Kazdy input pin moze mat max 1 pripojeny wire (one driver per input)
    - Cycle detection — BFS z target, ak dosiahneme source → cyklus → odmietnutie
  - `onConnect(connection)` — vytvori edge s `generateId()` a typom `manhattan`
  - Typ `IsValidConnection` z React Flow pre kompatibilitu s `Edge | Connection` union
- Aktualizovane `src/components/Canvas/Canvas.tsx`:
  - `edgeTypes` definovane mimo komponent (P1): `{ manhattan: ManhattanEdge }`
  - `defaultEdgeOptions = { type: 'manhattan' }` — vsetky nove wiry su manhattan
  - `onConnect` a `isValidConnection` z `useWiring()` hooku
  - Wire selekcia a mazanie funguje cez existujuce `deleteKeyCode` + `onEdgesChange`
- Verifikacia: `tsc -b` zero errors, `npm run build` OK, 37/37 testov OK

### Session 2026-02-03 (iteracia 4)
- Vytvorene `src/store/circuit-store.ts` — Zustand store:
  - Node/edge state s `applyNodeChanges`/`applyEdgeChanges`
  - `addNode` pre 4 typy: `circuitInput`, `circuitOutput`, `constant`, `module` (NAND)
  - `removeNode` s automatickym mazanim pripojenych edges
  - `toggleInputValue`, `toggleConstantValue`, `updateNodeLabel`
  - Typed AppNode union: `InputNodeType | OutputNodeType | ConstantNodeType | ModuleNodeType`
- Vytvorene node komponenty (vsetky `React.memo` — P2):
  - `InputNode.tsx` — toggle button (0/1), editovatelne meno (double-click), source handle vpravo
  - `OutputNode.tsx` — LED indikator (placeholder), editovatelne meno, target handle vlavo
  - `ConstantNode.tsx` — toggle 0/1 (amber), source handle vpravo
  - `ModuleNode.tsx` — dynamicke handles z `pins[]`, pin mena vedla handleov, label v strede
- Vytvorene `Canvas.tsx`:
  - `ReactFlowProvider` + `ReactFlow` s gridom (dots), pan, zoom
  - `nodeTypes` definovane mimo komponent (P1)
  - Panel s docasnymi tlacidlami: + Input, + Output, + Constant, + NAND
  - `screenToFlowPosition` pre umiestnenie novych nodov do stredu viewportu
- Aktualizovane `App.tsx` — layout shell:
  - Toolbar s nazvom "NAND Forge"
  - Library panel (placeholder)
  - Canvas area (flex-1)
- Rozhodnutie: RF node typy pouzivaju `circuitInput`/`circuitOutput` (nie `input`/`output`) aby sa predislo kolizii s React Flow built-in typmi
- Verifikacia: `tsc -b` zero errors, 37/37 testov OK

### Session 2026-02-03 (iteracia 3)
- Vytvorene `src/engine/truth-table.ts`:
  - `generateTruthTable(circuit, modules)` — iteruje vsetky 2^n input kombinacie, vola `evaluateCircuit`, vracia `TruthTable | null`
  - Threshold: > 16 inputov → vracia `null`
  - `lookupTruthTable(table, inputs)` — O(1) lookup podla input kluca
- Vytvorene `tests/engine/truth-table.test.ts` — 8 testov:
  - generateTruthTable: NOT (2 riadky), XOR z 4 NANDov (4 riadky), threshold > 16 → null, presne 16 → OK, prazdny circuit
  - lookupTruthTable: NOT lookup, XOR lookup, chybajuci riadok → false
- Rozsirene `tests/engine/simulate.test.ts` o 2 testy (module s truth table cache):
  - Input → NOT modul (s truth table) → Output
  - Double NOT (2x modul) → identita
- Poznamka: truth table cache lookup v `evaluateCircuit` bol uz implementovany v I2 (task 3.4 uz splneny)
- Verifikacia: 37/37 testov OK, `tsc -b` zero errors

### Session 2026-02-03 (iteracia 2)
- Vytvorene `src/engine/simulate.ts`:
  - `evaluateNand(a, b)` — `!(a && b)`
  - `BUILTIN_NAND_MODULE_ID` = `"builtin:nand"`
  - `pinKey(nodeId, pinId)` — kompozitny kluc pre mapy
  - `buildAdjacencyList(circuit)` — forward (fan-out) + reverse (fan-in) mapy
  - `topologicalSort(circuit)` — Kahnov algoritmus, throw pri cykle
  - `evaluateCircuit(circuit, inputs, modules?)` — seed inputs, propagacia cez topo order, NAND eval, custom module support (truth table lookup + rekurzia)
- Vytvorene `src/engine/validate.ts`:
  - `hasCycle(circuit)` — DFS three-color (WHITE/GRAY/BLACK)
  - `hasTransitiveSelfReference(moduleId, modules)` — BFS cez module grafy
- Vytvorene `tests/engine/simulate.test.ts` — 17 testov:
  - 4x NAND truth table, pinKey, adjacency list (forward, reverse, fan-out)
  - topologicalSort dependency order
  - evaluateCircuit: empty, pass-through, NOT (2 testy), AND (4 kombinacie), unconnected output
- Vytvorene `tests/engine/validate.test.ts` — 10 testov:
  - hasCycle: acyclic, cyclic A→B→C→A, self-loop, empty, disconnected
  - hasTransitiveSelfReference: mutual A↔B, direct, no-ref, nonexistent, chain A→B→C→A
- Verifikacia: 27/27 testov OK, `tsc -b` zero errors

### Session 2026-02-03 (planovanie)
- Vytvoreny tech-spec.md s kompletnou MVP specifikaciou (13 iteracii, ~90 taskov)
- Vytvoreny post-mvp-roadmap.md (iteracie 14–35, od CPU po platformu)
- Validovany React Flow (handles, manhattan routing, performance)
- Zmeneny snapshot model na reference-based
- NAND vizual zjednoteny s ostatnymi modulmi
- Zaradeny convenience komponenty (Constant, Probe, Button, Splitter/Merger, DIP switch, Hex display, LED bar, Tunnel)
- Zaradeny tri-state buffer medzi iteraciu 22 (RAM) a 24 (ALU)

### Session 2026-02-03 (iteracia 1)
- Nainstalovane dependencies: react, react-dom, @xyflow/react, zustand, typescript, tailwindcss, vitest
- Vytvorene tsconfig (project references), vite.config.ts (React + Tailwind + Vitest), .gitignore
- Vytvorene index.html, src/main.tsx, src/App.tsx (placeholder), src/index.css (Tailwind)
- Vytvorene src/engine/types.ts — vsetky core typy (NodeId, PinId, EdgeId, ModuleId, Pin, CircuitNode, Edge, Circuit, Module, TruthTable)
- Vytvorene src/utils/id.ts — generateId() cez crypto.randomUUID()
- Vytvorena projektova struktura (src/engine, store, components/*, hooks, utils, tests/engine)
- Overene: `bun run build` OK, `vitest run` OK (ziadne testy zatial)
