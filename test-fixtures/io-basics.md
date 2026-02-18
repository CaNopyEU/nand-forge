# I/O Basics

Fundamental I/O node behaviours: pass-through wires, constant sources, button, clock, fan-out, and probe. Verifies correct signal routing for different bit widths.

## Modules

| Name | ID | Inputs | Outputs | Sub-modules | Description |
|------|----|--------|---------|-------------|-------------|
| 4-bit Pass-through | mod-passthrough-4bit | D[4] | Q[4] | — | Direct wire, 4-bit |
| 16-bit Pass-through | mod-passthrough-16bit | D[16] | Q[16] | — | Direct wire, 16-bit |
| VCC and GND | mod-constants-vcc-gnd | — | VCC, GND | 2x constant | Fixed 1 and fixed 0 |
| Button to Output | mod-button-to-output | — | Q | button | Pressed=1, released=0 |
| Clock to Output | mod-clock-to-output | — | Q | clock | Current clock tick value |
| 3-Way Fan-out | mod-fanout-3way | A | Y0, Y1, Y2 | — | 1 source → 3 destinations |
| Probe No Effect | mod-probe-no-effect | A | Q | probe | Observer, does not alter signal |
| 8-bit Fan-out | mod-multi-bit-fanout | D[8] | Q0[8], Q1[8] | — | 8-bit signal to two outputs |

## Architecture

```
Pass-through:    Input ──────────────────── Output

Fan-out:         Input ──┬──── Output 0
                         ├──── Output 1
                         └──── Output 2

Probe:           Input ──────────────────── Output
                         └── Probe (observe only, no load)

Constant:        (pin name encodes value) ──── Output
                   "1" → emits 1 (VCC)
                   "0" → emits 0 (GND)
```

## Behaviour

| Node type | Condition | Output |
|-----------|-----------|--------|
| Pass-through | any D | Q = D (all bits preserved) |
| Constant VCC | pin name "1" | always 1 |
| Constant GND | pin name "0" | always 0 |
| Button | pressed (bp=1) | 1 |
| Button | released (bp=0) | 0 |
| Clock | tick high (cp=1) | 1 |
| Clock | tick low (cp=0) | 0 |
| Fan-out | A=1 | all outputs = 1 |
| Fan-out | A=0 | all outputs = 0 |
| Probe | any | signal unchanged |

## Test Scenarios

### Pass-through
- 4-bit: D=0 → Q=0; D=15 → Q=15; D=10 → Q=10
- 16-bit: D=0 → Q=0; D=0xFFFF → Q=0xFFFF; D=0xABCD → Q=0xABCD

### Constants
- VCC (cv=1, pin "1") → output=1
- GND (cz=0, pin "0") → output=0

### Button
- bp=0 → Q=0 (not pressed)
- bp=1 → Q=1 (pressed)

### Clock
- cp=0 → Q=0 (low tick)
- cp=1 → Q=1 (high tick)

### 3-Way Fan-out
- A=0 → Y0=Y1=Y2=0
- A=1 → Y0=Y1=Y2=1

### Probe
- A=0 → Q=0 (probe does not interfere)
- A=1 → Q=1

### 8-bit Fan-out
- D=0xA5 → Q0=0xA5, Q1=0xA5
- D=0x00 → Q0=0x00, Q1=0x00

## Use Cases

- **Fan-out**: broadcast one control signal to multiple destinations without signal degradation
- **Constants**: provide VCC/GND without an external input node
- **Probe**: inspect wire values at any point in a circuit for debugging
- **Multi-bit wiring**: verify N-bit connections carry all bits intact across all bit widths
