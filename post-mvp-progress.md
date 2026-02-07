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
- Engine: `instanceStates: Map<string, Map<string, boolean>>` — kazdy modul-instance node ma vlastne ulozene pin values z predchadzajuceho ticku
- `evaluateCircuitWithState()` — vrati outputs + full pinValues, try topological / catch iterative
- `evaluateNode` module case: cita `prevSubState` z `instanceStates`, zapisuje novy stav po evaluacii
- Simulation store: `instanceStates`, `signalHistory`, `recording`, `toggleRecording()`, `clearHistory()`
- Komponenty: `TimingDiagramView.tsx` — dialog s SVG waveformami, signal selector (checkboxy), auto-scroll
- Toolbar: "Timing" button vedla "Truth Table"
- Testy: 4 nove (SR latch Set→Hold, Reset→Hold, 2 nezavisle instancie, acyclic NOT gate)

---

## Faza B — Multi-bit & UX [PENDING]

### Iteracia 17 — Multi-bit bus + convenience I/O [PENDING]
### Iteracia 18 — Undo/Redo [DONE — MVP I13]

> Pozn.: Undo/Redo bol implementovany uz v MVP iteracii 13 (snapshot-based pristup).

### Iteracia 19 — Drill-down do modulov [PENDING]
### Iteracia 20 — Vizualne customizovanie [PENDING]

---

## Faza C — Pamat + Tri-state buffer [PENDING]
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
