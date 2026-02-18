# 4-bit Register

Level-sensitive 4-bit register built from D-latches. All 4 bits share a common enable line — EN=1 makes the register transparent; EN=0 holds the stored value.

## Modules

| Name | ID | Inputs | Outputs | Sub-modules | Description |
|------|----|--------|---------|-------------|-------------|
| SR Latch | mod-sr-latch | S, R | Q, Q̄ | 2x NAND | Cross-coupled NAND latch |
| D Latch | mod-d-latch | D, EN | Q | NAND + SR Latch | Transparent when EN=1 |
| 4-bit Register | mod-4bit-reg | D0–D3, EN | Q0–Q3 | 4x D-Latch | Parallel 4-bit storage |

## Architecture

```
D0 ──→ D-Latch ──→ Q0
D1 ──→ D-Latch ──→ Q1
D2 ──→ D-Latch ──→ Q2
D3 ──→ D-Latch ──→ Q3
        ↑
EN ─────┤ (shared enable)
```

Each D-Latch: EN=1 → transparent (Q follows D continuously); EN=0 → holds last captured value.

## Characteristic Tables

### SR Latch (NAND — active-low inputs)

| S | R | Q(next) |
|---|---|---------|
| 0 | 1 | 1 (SET) |
| 1 | 0 | 0 (RESET) |
| 1 | 1 | Q(hold) |
| 0 | 0 | invalid |

### D Latch

| EN | D | Q(next) |
|----|---|---------|
| 1  | 0 | 0 |
| 1  | 1 | 1 |
| 0  | X | Q(hold) |

### 4-bit Register

| EN | D3..D0 | Q3..Q0 |
|----|--------|--------|
| 1  | new    | new (transparent) |
| 0  | any    | Q(hold) |

## Test Scenarios

### SR Latch
- S=0, R=1 → Q=1 (SET)
- S=1, R=0 → Q=0 (RESET)
- S=1, R=1 → hold previous value

### D Latch
- EN=1, D=1 → Q=1 (transparent)
- EN=1, D=0 → Q=0
- EN=0, any D → Q holds last captured value

### 4-bit Register
- EN=1, D=0b1010 → Q=0b1010
- EN=1, D=0b0101 → Q=0b0101
- EN=0 → Q unchanged regardless of D

## Use Cases

- **CPU register file**: temporary operand storage
- **Bus capture**: latch bus value when enable is pulsed high
- **Pipelined datapath**: hold stage inputs stable while enable is low
- **Building block**: 8-bit register = two 4-bit registers side by side
