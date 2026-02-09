# 4-bit Ripple Counter

Binary counter that increments on each clock pulse. Built from cascaded T flip-flops.

## Modules

| Name | ID | Inputs | Outputs | Sub-modules | Description |
|------|----|--------|---------|-------------|-------------|
| SR Latch | mod-sr-latch | S, R | Q, Q-bar | 2x NAND | Cross-coupled NAND |
| D Latch | mod-d-latch | D, EN | Q | NAND + SR Latch | Level-sensitive latch |
| NOT | mod-not | A | Out | 1x NAND | Inverter |
| XOR | mod-xor | A, B | Out | 4x NAND | Exclusive OR |
| D Flip-Flop | mod-d-flipflop | D, CLK | Q | NOT + 2x D Latch | Edge-triggered FF |
| T Flip-Flop | mod-t-flipflop | T, CLK | Q | XOR + D-FF | Toggle on edge |
| 4-bit Counter | mod-counter4 | CLK | Q0-Q3 | 4x T-FF + Const | Ripple counter |

## Architecture

```
Const(1)──→ T ──→ T ──→ T ──→ T
CLK ──→ CLK  Q──→CLK  Q──→CLK  Q──→CLK  Q
             │         │         │         │
             Q0(LSB)   Q1        Q2        Q3(MSB)
```

Each T flip-flop has T=1 (constant), so it toggles on every rising edge of its CLK input.
Q0 toggles every external CLK pulse. Q1 toggles when Q0 transitions, etc.

## Counting Sequence

| CLK Pulses | Q3 | Q2 | Q1 | Q0 | Decimal |
|------------|----|----|----|----|---------|
| 0 | 0 | 0 | 0 | 0 | 0 |
| 1 | 0 | 0 | 0 | 1 | 1 |
| 2 | 0 | 0 | 1 | 0 | 2 |
| 3 | 0 | 0 | 1 | 1 | 3 |
| 4 | 0 | 1 | 0 | 0 | 4 |
| ... | | | | | |
| 15 | 1 | 1 | 1 | 1 | 15 |
| 16 | 0 | 0 | 0 | 0 | 0 (wrap) |

## Test Scenarios

1. Initial state: all outputs 0
2. After 1 CLK pulse: Q0=1, Q1=Q2=Q3=0 (count=1)
3. After 5 CLK pulses: Q0=1, Q1=0, Q2=1, Q3=0 (count=5)
4. After 16 CLK pulses: wraps back to 0000
5. Sequential: count matches N mod 16

## Limitations

- **Ripple propagation**: each bit change propagates through the chain, causing momentary glitches
- Not synchronous — all T-FFs don't change simultaneously
- For glitch-free counting, a synchronous counter design would be needed

## Use Cases

- Frequency division (Q0 = CLK/2, Q1 = CLK/4, etc.)
- Event counting
- Address generation for sequential memory access
- Timer circuits
- Showcase for LED Bar display (connect Q0-Q3 via Merger to LED Bar)
