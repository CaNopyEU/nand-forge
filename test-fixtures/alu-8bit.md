# 8-bit ALU

Bit-sliced ALU built entirely from NAND gates. Supports 4 operations selected by a 2-bit opcode.

## Modules

| Name | ID | Inputs | Outputs | Sub-modules | Description |
|------|----|--------|---------|-------------|-------------|
| NOT | mod-not | A | Out | 1x NAND | Inverter |
| AND | mod-and | A, B | Out | 2x NAND | Logical AND |
| OR | mod-or | A, B | Out | 3x NAND | Logical OR |
| XOR | mod-xor | A, B | Out | 4x NAND | Exclusive OR |
| MUX 2:1 | mod-mux2 | A, B, S | Y | NOT + 2x AND + OR | 2-input multiplexer |
| MUX 4:1 | mod-mux4 | D0–D3, S0, S1 | Y | 3x MUX 2:1 | 4-input multiplexer |
| Half Adder | mod-half-adder | A, B | S, C | XOR + AND | Sum and carry |
| Full Adder | mod-full-adder | A, B, Cin | S, Cout | 2x HA + OR | Ripple-friendly adder |
| ALU Slice | mod-alu-slice | A, B, Cin, Op0, Op1 | R, Cout | AND + OR + XOR + FA + MUX 4:1 | 1-bit ALU |
| 8-bit ALU | mod-alu8 | A[8], B[8], Op0, Op1 | R[8], Cout | 8x ALU Slice + Splitter + Merger | Full 8-bit ALU |

## Architecture

### ALU Slice (1-bit)
```
A,B → AND  → D0 ─┐
A,B → OR   → D1 ─┤
A,B → XOR  → D2 ─┼→ MUX 4:1 → R
A,B,Cin → FA → S → D3 ─┘   ↑
               └→ Cout    Op0,Op1
```

### 8-bit ALU
```
A[8] → Splitter → a0..a7
B[8] → Splitter → b0..b7

0 → ALU_Slice0(a0,b0) → r0, c0
     ALU_Slice1(a1,b1,c0) → r1, c1
     ...
     ALU_Slice7(a7,b7,c6) → r7, Cout

r0..r7 → Merger → R[8]
```

## Operation Table

| Op1 | Op0 | Operation | Formula |
|-----|-----|-----------|---------|
| 0 | 0 | AND | R = A & B |
| 0 | 1 | OR | R = A \| B |
| 1 | 0 | XOR | R = A ^ B |
| 1 | 1 | ADD | R = A + B, Cout = carry |

## Test Scenarios

### ALU Slice
- A=1, B=1, Op=00 (AND) → R=1
- A=1, B=0, Op=01 (OR) → R=1
- A=1, B=1, Op=10 (XOR) → R=0
- A=1, B=1, Cin=0, Op=11 (ADD) → R=0, Cout=1

### 8-bit ALU — AND (Op=00)
- 0xFF AND 0x0F = 0x0F, Cout=0
- 0xA5 AND 0x5A = 0x00, Cout=0

### 8-bit ALU — OR (Op=01)
- 0xA0 OR 0x05 = 0xA5, Cout=0
- 0x00 OR 0x00 = 0x00, Cout=0

### 8-bit ALU — XOR (Op=10)
- 0xFF XOR 0xFF = 0x00, Cout=0
- 0xAA XOR 0x55 = 0xFF, Cout=0

### 8-bit ALU — ADD (Op=11)
- 0x37 + 0x85 = 0xBC, Cout=0
- 0xFF + 0x01 = 0x00, Cout=1 (overflow)
- 0x00 + 0x00 = 0x00, Cout=0
- 0x80 + 0x80 = 0x00, Cout=1

## Use Cases

- Core of any CPU datapath
- Arithmetic and logic operations on 8-bit values
- Cascadable: connect Cout to Cin of a second ALU for 16-bit operations
- Connect DIP Switches to A/B, Hex Displays to R for interactive demo
