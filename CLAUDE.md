# NAND Forge — Claude Code Guide

Digital logic simulator: build circuits from NAND gates up.

## Stack
React 19 + Zustand 5 + @xyflow/react 12 + Tailwind 4 + Vite 7 + Vitest 4 + TypeScript 5 (strict)

## Commands
```bash
npm run dev      # Vite dev server
npm test         # Vitest watch mode
npm run build    # tsc -b && vite build (type-check first!)
```

---

## Workflow Rules

- **Read before edit**: Before editing any file, read it first — never edit blind.
- **Verify after every change**: Run `npm run build && npm test` after implementation. Do not mark done if either fails.
- **Scope discipline**: Only change what was asked. Do not refactor surrounding code, add comments, improve unrelated parts, or add docstrings to untouched code.
- **Never commit without explicit user approval.**
- **Plan mode for larger tasks**: For phases/iterations or multi-file changes, use `EnterPlanMode` first, get approval, then implement.
- **Read the iteration spec first**: Before implementing an iteration, read the relevant section in `post-mvp-roadmap.md` and `post-mvp-progress.md`.

### Vague Task Guard
If a task is vague (e.g. "implement Phase D", "fix the simulation", "improve performance"), **do not start coding**. Instead:
1. State that the task is too broad to implement safely.
2. Ask the user to specify: which iteration/sub-task, which file(s), what the expected before/after behaviour is.
3. Alternatively, offer to enter plan mode to break it down together.

A task is specific enough when it names the target file(s), describes what changes, and fits in a single iteration.

### Definition of Done (per task)

Every task:
- [ ] `npm run build` — 0 errors (includes `tsc -b`)
- [ ] `npm test` — all tests pass
- [ ] No unintended side effects in adjacent files

Engine changes:
- [ ] Unit test covering the new/changed behaviour
- [ ] Pure TS only — no React/DOM/Zustand imports in `src/engine/`

Store changes:
- [ ] Zustand selectors used (never subscribe to entire store)
- [ ] `simulationVersion` bumped only on circuit-relevant mutations

UI changes:
- [ ] Tailwind classes use design tokens (no hardcoded hex colors)
- [ ] `nodeTypes`/`edgeTypes` defined outside components (stable reference)
- [ ] React.memo on custom nodes

---

## File Size Guard

When creating or editing a `.ts` or `.tsx` file, check its total line count. If the file exceeds **400 lines**, it must be split before the task is considered done.

Applies to: files changed or created in the current task only.

Exempt:
- Test files (`*.test.ts`) — no line limit
- Type files (`engine/types.ts`) — no limit
- Config files (`vite.config.ts`, `tsconfig.json`, `tailwind.config.*`) — no limit

Decomposition strategies:
- `.tsx` component too large → extract sub-components, move logic into hooks
- Store too large → split into domain slices, extract helpers into `utils/`
- Hook too large → extract pure functions into `utils/`, keep only reactive wiring in the hook
- Engine file too large → split by concern (per-node-type evaluators, separate helpers)

**File over 400 lines in a changed file = blocker.** Propose a split plan before continuing.

---

## Engine Layer Guard

Files in `src/engine/` must remain **pure TypeScript** — no React, no Zustand, no DOM APIs. This is enforced because the engine runs (or will run) in a Web Worker.

Forbidden imports in `src/engine/**`:
- `react`, `react-dom`
- `zustand`
- `@xyflow/react`
- `window`, `document`, `localStorage` (DOM globals)

If you need engine data in a React context, pipe it through a store or hook — never import React into the engine.

---

## Architecture
```
src/engine/     → Pure TS simulation (no React/DOM deps — Web Worker safe)
src/store/      → Zustand stores (circuit, module, simulation, library, toast)
src/hooks/      → React hooks (useSimulation, useWiring, useClockTick)
src/components/ → Canvas/ Library/ Toolbar/ StatusBar/ TimingDiagram/ shared/
src/utils/      → canvas-to-circuit, circuit-converters, persistence, layout, id
tests/          → Vitest, node env, uses make* factory helpers
test-fixtures/  → Pre-built circuit JSON files for e2e tests
```

**Data flow**: Canvas (RF) → `canvasToCircuit()` → Engine evaluate → pinValues → `circuitToAppNodes()`/`circuitToRFEdges()` → Canvas renders

## Key Constraints

### TypeScript (strict mode)
- **TS4111**: `noPropertyAccessFromIndexSignature` — use `e.data?.["color"]` not `e.data?.color` for RF edge/node data
- `noUncheckedIndexedAccess` enabled — index access returns `T | undefined`
- `noUnusedLocals` + `noUnusedParameters` — no dead code

### Design Rules
- **NAND-first**: Only built-in gate is NAND (`builtin:nand`). All logic built from NAND by users
- **Reference modules** (not snapshots): Module changes cascade to all instances
- **Truth table cache**: ≤16 inputs → O(1) lookup table, >16 → recursive simulation
- **Hierarchical instance state**: `InstanceState { pinValues, children }` — flat map causes collision with identical sub-modules
- **Tri-state signals**: `Z_VALUE=-1`, `WEAK_0=-2`, `WEAK_1=-3`, `CONFLICT=-4`

### Performance
- `nodeTypes`/`edgeTypes` defined **outside** components (stable reference)
- Use Zustand selectors: `useStore(s => s.field)` — never subscribe to entire store
- `simulationVersion` counter — re-simulate only on circuit-relevant changes

---

## Patterns & Recipes

### Zustand Store Action Pattern
```ts
// Snapshot-first for undoable actions
someAction: (id) => {
  set(state => {
    pushSnapshot(state);  // 1. snapshot for undo
    // 2. mutation
    return { ...changes, simulationVersion: state.simulationVersion + 1 };
  });
},
```

### Test Pattern
Use factory helpers — tests run in node env (no DOM):
```ts
makePin(id, name, direction)
makeInputNode(id, pinId, name)
makeNandNode(id, inA, inB, out)
makeEdge(id, fromNode, fromPin, toNode, toPin)
makeCircuit(name, nodes, edges)
```

Store tests — every `beforeEach`:
1. Reset store to initial state (use `useCircuitStore.setState(initialState)`)
2. Clear any singleton state from hooks

### React Flow Node Pattern
```tsx
// OUTSIDE component — stable reference (P1 rule)
const nodeTypes = { myNode: MyNode, ... };

// Component must be React.memo
const MyNode = memo(({ data, id }: NodeProps<MyNodeType>) => {
  const value = useSimulationStore(s => s.pinValues[data.outputPinId]); // selector
  return ( /* ... */ );
});
```

---

## Common Tasks

### Add new node type
1. Add type literal to `CircuitNode.type` union in `engine/types.ts`
2. Create `src/components/Canvas/FooNode.tsx` (copy existing node pattern)
3. Register in `nodeTypes` map in `Canvas.tsx`
4. Handle in `canvasToCircuit()` + `circuitToAppNodes()`
5. Add to toolbar if user-placeable
6. Add `getPinBits` case in `useWiring.ts`
7. Add engine test in `tests/engine/`

### Add test
Tests run in node env (no DOM). Use factory helpers from existing tests.

---

## Key Files (read order)
1. `src/engine/types.ts` — Core data model
2. `src/engine/simulate.ts` — Evaluation logic (topological sort, truth table, bus resolution)
3. `src/store/circuit-store.ts` — Canvas state, undo/redo, drill-down
4. `src/store/module-store.ts` — Module CRUD, cascading updates, save analysis
5. `src/store/simulation-store.ts` — Pin values, instance states, tick loop
6. `src/components/Canvas/Canvas.tsx` — Main UI orchestration

## Docs
- `tech-spec.md` — MVP specification (iterations 1–13)
- `STATUS.md` — Architecture decisions, session notes
- `post-mvp-roadmap.md` — Future features (H1–H4 intermezzo, iterations 24–35)
- `post-mvp-progress.md` — Progress tracker
