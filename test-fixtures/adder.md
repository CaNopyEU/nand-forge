# Arithmetic Circuits — Adders

Adder hierarchy from basic half adder to 8-bit ripple carry adder.

## Modules

| Name | ID | Inputs | Outputs | Sub-modules | Description |
|------|----|--------|---------|-------------|-------------|
| XOR | mod-xor | A, B | Out | 4x NAND | Exclusive OR |
| AND | mod-and | A, B | Out | 2x NAND | Logical AND |
| OR | mod-or | A, B | Out | 3x NAND | Logical OR |
| Half Adder | mod-half-adder | A, B | S, C | XOR + AND | S=XOR(A,B), C=AND(A,B) |
| Full Adder | mod-full-adder | A, B, Cin | S, Cout | 2x HA + OR | Ripple-friendly |
| 8-bit Adder | mod-adder8 | A[8], B[8] | S[8], Cout | 8x FA + Split/Merge | Ripple carry |

## Architecture

### Half Adder
```
A ──→ XOR ──→ S (sum)
B ──→ AND ──→ C (carry)
```

### Full Adder (from 2 Half Adders)
```
A,B → HA1 → S1,C1
S1,Cin → HA2 → S, C2
C1,C2 → OR → Cout
```

### 8-bit Ripple Carry Adder
```
A[8] → Splitter → a0..a7
B[8] → Splitter → b0..b7

0 → FA0(a0,b0) → s0, c0
     FA1(a1,b1,c0) → s1, c1
     ...
     FA7(a7,b7,c6) → s7, Cout

s0..s7 → Merger → S[8]
```

## Truth Tables

### Half Adder
| A | B | S | C |
|---|---|---|---|
| 0 | 0 | 0 | 0 |
| 0 | 1 | 1 | 0 |
| 1 | 0 | 1 | 0 |
| 1 | 1 | 0 | 1 |

### Full Adder
| A | B | Cin | S | Cout |
|---|---|-----|---|------|
| 0 | 0 | 0 | 0 | 0 |
| 0 | 0 | 1 | 1 | 0 |
| 0 | 1 | 0 | 1 | 0 |
| 0 | 1 | 1 | 0 | 1 |
| 1 | 0 | 0 | 1 | 0 |
| 1 | 0 | 1 | 0 | 1 |
| 1 | 1 | 0 | 0 | 1 |
| 1 | 1 | 1 | 1 | 1 |

## Test Scenarios

### Half Adder
- 0+0 = S:0, C:0
- 1+1 = S:0, C:1

### Full Adder
- 1+1+1 = S:1, Cout:1

### 8-bit Adder
- 0x37 + 0x85 = 0xBC, Cout=0
- 0xFF + 0x01 = 0x00, Cout=1 (overflow)
- 0x00 + 0x00 = 0x00, Cout=0

## Use Cases

- Core building block for ALU
- Address calculation
- Increment/decrement counters
- Showcase: connect DIP Switches to A/B, Hex Display to S
