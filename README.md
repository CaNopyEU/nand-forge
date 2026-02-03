# NAND Forge

Interactive circuit builder where the only built-in gate is NAND. Everything else (NOT, AND, OR, XOR, ...) is built by the user from scratch and saved as reusable modules.

## Prerequisites

- Node.js 20+
- npm

## Setup

```bash
npm install
```

## Commands

```bash
# Dev server (http://localhost:5173)
npm run dev

# Type check + production build
npm run build

# Preview production build
npm run preview

# Run tests (watch mode)
npm test

# Run tests once
npx vitest run

# Type check only
npx tsc -b
```

## Project structure

```
src/
  engine/         # Simulation engine (pure TS, no React)
    types.ts      # Core data types
    simulate.ts   # Circuit evaluation
    truth-table.ts
    validate.ts   # Cycle detection
  store/          # Zustand state
    circuit-store.ts
    simulation-store.ts
  hooks/          # React hooks
  components/
    Canvas/       # React Flow canvas + node/edge components
  utils/

tests/
  engine/         # Unit tests for simulation engine
```

## Docs

- `tech-spec.md` — full MVP spec (iterations 1–13)
- `STATUS.md` — current progress, architecture decisions, session notes
- `post-mvp-roadmap.md` — iterations 14–35
