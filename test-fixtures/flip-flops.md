# Flip-Flops (Edge-Triggered)

Sequential logic elements built from NAND gates. Includes level-sensitive latches and edge-triggered flip-flops.

## Modules

| Name | ID | Inputs | Outputs | Sub-modules | Description |
|------|----|--------|---------|-------------|-------------|
| SR Latch | mod-sr-latch | S, R | Q, Q-bar | 2x NAND | Cross-coupled NAND, level-sensitive |
| D Latch | mod-d-latch | D, EN | Q | NOT(NAND) + SR Latch | Level-sensitive, transparent when EN=1 |
| NOT | mod-not | A | Out | 1x NAND | Inverter |
| XOR | mod-xor | A, B | Out | 4x NAND | Exclusive OR |
| D Flip-Flop | mod-d-flipflop | D, CLK | Q | NOT + 2x D Latch | Master-slave, rising-edge triggered |
| T Flip-Flop | mod-t-flipflop | T, CLK | Q | XOR + D-FF | Toggle on rising edge when T=1 |

## Architecture

### D Flip-Flop (Master-Slave)
```
D ──────┐
        ├─→ [Master D-Latch (EN=NOT CLK)] ──→ [Slave D-Latch (EN=CLK)] ──→ Q
CLK ─┬──┘                                          │
     └──→ [NOT] ──→ master.EN                      │
     └──────────────────────────────→ slave.EN ─────┘
```
- CLK=0: Master is transparent (captures D), Slave is opaque (holds previous)
- CLK=1: Master locks, Slave opens and captures master's output
- Net effect: Q captures D on rising edge of CLK

### T Flip-Flop (Toggle)
```
T ──→ [XOR] ──→ [D-FF] ──→ Q
        ↑          │
        └──────────┘ (feedback: Q → XOR input B)
```
- T=1: D = XOR(1, Q) = NOT Q → toggles on clock edge
- T=0: D = XOR(0, Q) = Q → holds value
- Contains feedback loop (handled by iterative evaluator)

## Characteristic Tables

### D Flip-Flop
| D | CLK edge | Q(next) |
|---|----------|---------|
| 0 | rising | 0 |
| 1 | rising | 1 |
| X | no edge | Q(prev) |

### T Flip-Flop
| T | CLK edge | Q(next) |
|---|----------|---------|
| 0 | rising | Q(prev) |
| 1 | rising | NOT Q(prev) |
| X | no edge | Q(prev) |

## Test Scenarios

### D Flip-Flop
1. Set D=1, CLK: 0→1 → Q becomes 1
2. Set D=0, CLK stays 1 → Q stays 1 (edge-triggered, not level)
3. Set D=0, CLK: 0→1 → Q becomes 0

### T Flip-Flop
1. T=1, pulse CLK repeatedly → Q toggles: 0→1→0→1...
2. T=0, pulse CLK → Q holds its value
3. T=1 acts as frequency divider (Q changes at half CLK rate)

## Use Cases

- **D Flip-Flop**: registers, pipeline stages, data sampling
- **T Flip-Flop**: counters, frequency dividers, toggle switches
- **SR Latch**: basic memory element, debouncing
- **D Latch**: transparent latches, bus interfaces
