# Clock + Button Sequential

Interactive sequential circuits that combine Clock and Button nodes with flip-flops and latches. Demonstrates how externally driven inputs (clock tick, button press) control sequential state.

## Modules

| Name | ID | Inputs | Outputs | Sub-modules | Description |
|------|----|--------|---------|-------------|-------------|
| NOT | mod-not | A | Out | 1x NAND | Inverter |
| SR Latch | mod-sr-latch | S, R | Q, Q̄ | 2x NAND | Cross-coupled NAND, level-sensitive |
| D Latch | mod-d-latch | D, EN | Q | NAND + SR Latch | Transparent when EN=1 |
| D Flip-Flop | mod-d-flipflop | D, CLK | Q | NOT + 2x D-Latch | Master-slave, rising-edge triggered |
| Clock-driven DFF | mod-clock-driven-dff | — | Q | Clock + Button + D-FF | Button=data, Clock=trigger |
| Button SR Control | mod-button-sr-control | — | Q, Q̄ | 2x Button + SR Latch | Manual SET/RESET |
| Clock + Button Enable | mod-clock-and-button-enable | D | Q | Clock + Button + AND(NAND-NAND) + D-FF | Gated clock |
| Button Toggle | mod-button-toggle | — | Q | VCC constant + Button + D-Latch | Capture on button press |

## Architecture

### Clock-driven D Flip-Flop
```
Button (DATA) ──→ D ──┐
                       D-FF ──→ Q
Clock ───────────→ CLK ┘

Rising clock edge captures current button state into Q.
```

### Button SR Control
```
Button SET ──→ S ──┐
                    SR Latch ──→ Q, Q̄
Button RST ──→ R ──┘

NAND SR uses active-low inputs: button pressed = 0.
```

### Gated Clock
```
Clock ──→ NAND ──→ NAND (NOT = AND result) ──→ CLK ──┐
              ↑                                        D-FF ──→ Q
Button ───────┘                               D ──────┘

AND(Clock, Button) gates the clock.
DFF updates only when button is pressed during a clock edge.
```

### Button Toggle (D Latch)
```
VCC (constant 1) ──→ D ──┐
                           D-Latch ──→ Q
Button ──────────────→ EN ┘

EN=1 (pressed): transparent, Q=D=1.
EN=0 (released): hold — Q retains last value.
```

## Characteristic Tables

### D Flip-Flop
| D | CLK edge | Q(next) |
|---|----------|---------|
| 0 | rising   | 0 |
| 1 | rising   | 1 |
| X | no edge  | Q(hold) |

### NAND SR Latch (active-low)
| S | R | Q(next) |
|---|---|---------|
| 0 | 1 | 1 (SET) |
| 1 | 0 | 0 (RESET) |
| 1 | 1 | Q(hold) |
| 0 | 0 | invalid |

## Test Scenarios

### Clock-driven DFF
- button=1, clock=1 → Q=1 (DFF captures data=1 on high clock)
- Structure: circuit contains clock node and button node

### Button SR Control
- SET pressed (S=0), RST not pressed (R=1) → Q=1
- SET not pressed (S=1), RST pressed (R=0) → Q=0
- Structure: circuit contains two button nodes

### Gated Clock
- clock=1, button=1 → AND=1 → DFF clocked → Q=D
- Structure: circuit contains clock node and button node

### Button Toggle
- button pressed (EN=1), VCC on D (cv=1) → Q=1
- Structure: constant node with pin name "1" (VCC)

## Use Cases

- **Interactive debugging**: manually trigger sequential circuits with button presses
- **Clock gating**: enable/disable clock domain using a button as gate
- **Manual SR control**: set/reset latch state interactively
- **Data capture**: sample a signal only on a rising clock edge
