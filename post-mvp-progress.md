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

### Iteracia 15 — Kontrolovane cykly (feedback loops) [PENDING]

| # | Task | Status |
|---|---|---|
| 15.1 | Propagation delay model | - |
| 15.2 | Povolenie cyklov (s clockom) | - |
| 15.3 | Stabilizacia detekcia | - |
| 15.4 | Oscilacia warning | - |
| 15.5 | Testy cykly (SR latch) | - |

### Iteracia 16 — Flip-Flopy a Registre [PENDING]

| # | Task | Status |
|---|---|---|
| 16.1 | SR Flip-Flop | - |
| 16.2 | D Flip-Flop | - |
| 16.3 | JK Flip-Flop | - |
| 16.4 | Edge detection | - |
| 16.5 | 8-bit Register | - |
| 16.6 | Counter | - |
| 16.7 | Timing diagram view | - |

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
| 14 | 2026-02-07 | — | Clock + Button, Play/Pause/Step, tick rate |
