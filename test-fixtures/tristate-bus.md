# Tri-state Buffers & Shared Bus

Tri-state buffers, pull-up/pull-down resistors, and multi-driver shared bus resolution. Introduces wire state sentinels beyond binary 0/1 for modelling high impedance, weak drives, and bus conflicts.

## Wire State Sentinels

| Value | Constant | Meaning |
|-------|----------|---------|
| ≥ 0 | — | Strong driven value (0 or 1 for 1-bit; 0..N for multi-bit) |
| −1 | `Z_VALUE` | High impedance — driver disconnected from bus |
| −2 | `WEAK_1` | Weak pull-up (overridden by any strong driver) |
| −3 | `WEAK_0` | Weak pull-down (overridden by any strong driver) |
| −4 | `CONFLICT` | Multiple strong drivers disagree |

## Bus Resolution (`resolveBus`)

```
resolveBus(values):
  1. Filter out Z_VALUE (floating) — ignored
  2. No active drivers → return Z_VALUE
  3. Separate strong (≥ 0) from weak (WEAK_1 / WEAK_0)
  4. Strong drivers present:
       all agree → return that value
       disagree  → return CONFLICT
  5. Only weak drivers:
       all agree → return concrete value (WEAK_1→1, WEAK_0→0)
       disagree  → return CONFLICT
```

## Modules

| Name | ID | Inputs | Outputs | Description |
|------|----|--------|---------|-------------|
| Tristate Basic | mod-tristate-basic | D, EN | Y | EN=1 → Y=D; EN=0 → Y=Z_VALUE |
| Pull-up Alone | mod-pullup-alone | — | Y | Constant WEAK_1 — resolves to 1 |
| Pull-down Alone | mod-pulldown-alone | — | Y | Constant WEAK_0 — resolves to 0 |
| Tristate + Pull-up | mod-tristate-pullup | D, EN | Y | Open-drain: EN=0 → pull-up holds bus high |
| 2-Driver Bus | mod-bus-2drivers | D1, EN1, D2, EN2 | Y | Two tristates sharing one output |
| 2-Driver Bus + Pull-down | mod-bus-2drivers-pulldown | D1, EN1, D2, EN2 | Y | Two tristates + pull-down default |
| Tri-state 8-bit | mod-tristate-8bit | D[8], EN | Y[8] | 8-bit bus driver |
| Bus MUX | mod-bidirectional-mux | A, B, SEL | Y | SEL routes A or B via NAND inverter |

## Architecture

### Open-drain (Tristate + Pull-up)
```
Tristate(D, EN) ──┐
                  ├── Y  (bus node)
Pull-up (WEAK_1) ─┘

EN=0: resolveBus([Z, WEAK_1]) → pullup wins → Y=1
EN=1: resolveBus([D, WEAK_1]) → strong wins → Y=D
```

### Shared Bus — 2 Drivers
```
Tristate1(D1, EN1) ──┐
                     ├── Y  (bus node)
Tristate2(D2, EN2) ──┘

One EN=1     → Y = that driver's D
Both EN=0    → resolveBus([Z, Z]) → Y = Z_VALUE
Both EN=1, same value → Y = D
Both EN=1, different  → Y = CONFLICT
```

### Bus MUX
```
A ──→ TsA (EN=SEL) ──────┐
                          ├── Y
B ──→ TsB (EN=!SEL) ─────┘
SEL ──→ NAND(SEL, SEL) ──→ !SEL

SEL=1: TsA on  (EN=1), TsB off (EN=NAND(1,1)=0) → Y=A
SEL=0: TsA off (EN=0), TsB on  (EN=NAND(0,0)=1) → Y=B
```

## Behaviour

### Tristate Basic
| EN | D | Y |
|----|---|---|
| 0  | X | Z_VALUE (−1) |
| 1  | 0 | 0 |
| 1  | 1 | 1 |

### Tristate + Pull-up
| EN | D | Y |
|----|---|---|
| 0  | X | 1 (pull-up holds) |
| 1  | 0 | 0 (strong beats weak) |
| 1  | 1 | 1 |

### 2-Driver Bus
| EN1 | EN2 | D1 | D2 | Y |
|-----|-----|----|----|---|
| 1 | 0 | D | X | D |
| 0 | 1 | X | D | D |
| 0 | 0 | X | X | Z_VALUE |
| 1 | 1 | 0 | 0 | 0 |
| 1 | 1 | 1 | 1 | 1 |
| 1 | 1 | 0 | 1 | CONFLICT (−4) |

## Test Scenarios

- Tristate basic: EN=1 D=1→1; EN=1 D=0→0; EN=0→Z_VALUE
- Pull-up alone: always 1
- Pull-down alone: always 0
- Open-drain: EN=0→1 (pullup); EN=1 D=0→0 (strong); EN=1 D=1→1
- 2-driver bus: single driver→value; agree→value; disagree→CONFLICT; both off→Z_VALUE
- 2-driver + pulldown: both off→0 (pulldown); one on strong→strong wins; disagree→CONFLICT
- 8-bit tristate: EN=1 D=0xA5→Y=0xA5; EN=0→Z_VALUE
- Bus MUX: SEL=1→Y=A; SEL=0→Y=B

## Use Cases

- **Open-collector bus**: multiple devices share a bus; pull-up holds line high when all idle
- **Bus arbitration**: visualise CONFLICT (red pulse on wire) when two drivers disagree
- **Half-duplex data line**: bidirectional bus controlled by SEL
- **High-impedance visualisation**: Z_VALUE appears as purple wire colour in the canvas
