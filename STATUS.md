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
**Aktualna iteracia:** 1 (DONE)
**Posledna zmena:** Iteracia 1 dokoncena

### Progress tracker

| Iteracia | Nazov | Status |
|---|---|---|
| 1 | Projekt setup + core typy | ✅ DONE |
| 2 | Simulation engine | ⬜ TODO |
| 3 | Truth table engine | ⬜ TODO |
| 4 | Canvas zaklad | ⬜ TODO |
| 5 | Wiring | ⬜ TODO |
| 6 | Live simulacia na canvase | ⬜ TODO |
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

_Tu sa budu pridavat poznamky z kazdeho pracovneho session._

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
