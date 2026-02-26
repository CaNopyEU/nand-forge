# NAND-8 ISA — Instruction Set Architecture

8-bit CPU architecture for NAND Forge. All logic built from NAND gates.

## Architecture Overview

- **Type**: Harvard (separate instruction and data memory)
- **Word size**: 8-bit data, 16-bit instructions (dual-ROM fetch)
- **Registers**: 4 general-purpose 8-bit registers (R0–R3)
- **Address space**: 256 bytes (8-bit addressing)
- **ALU**: 8 operations with carry/zero/negative flags (iteration 24)

### Dual-ROM Fetch

Two ROM chips share the same PC address:

| ROM | Contents | Format |
|-----|----------|--------|
| ROM_H (high byte) | Instruction | `[opcode:4][Rd:2][Rs:2]` |
| ROM_L (low byte) | Immediate | `[imm8:8]` |

This gives effective 16-bit instructions with single-cycle fetch, simple PC (increment by 1), and full 8-bit immediate values.

### Registers

| Code | Register | Description |
|------|----------|-------------|
| 00 | R0 | General purpose |
| 01 | R1 | General purpose |
| 10 | R2 | General purpose |
| 11 | R3 | General purpose |

## Instruction Encoding

```
High byte (ROM_H):  [opcode:4][Rd:2][Rs:2]
Low byte  (ROM_L):  [imm8:8]

Rd = destination register (bits 3–2)
Rs = source register (bits 1–0)
imm8 = 8-bit immediate value or memory address
```

## Instruction Set (16 opcodes)

```
Opcode  Mnemonic         Type  Description                    ALU op
──────  ───────────────  ────  ─────────────────────────────  ──────
0x0     NOP              -     No operation                   -
0x1     LDI Rd, #imm8    I     Rd = imm8                      -
0x2     LD  Rd, [imm8]   M     Rd = RAM[imm8]                 -
0x3     ST  Rs, [imm8]   M     RAM[imm8] = Rs                 -
0x4     MOV Rd, Rs       R     Rd = Rs                        -
0x5     ADD Rd, Rs       R     Rd = Rd + Rs                   100
0x6     SUB Rd, Rs       R     Rd = Rd - Rs                   101
0x7     AND Rd, Rs       R     Rd = Rd & Rs                   000
0x8     OR  Rd, Rs       R     Rd = Rd | Rs                   001
0x9     XOR Rd, Rs       R     Rd = Rd ^ Rs                   010
0xA     NOT Rd           R     Rd = ~Rd                       011
0xB     SHL Rd           R     Rd = Rd << 1                   110
0xC     SHR Rd           R     Rd = Rd >> 1                   111
0xD     JMP imm8         J     PC = imm8                      -
0xE     JZ  imm8         J     if Zero flag: PC = imm8        -
0xF     HALT             -     Stop clock                     -
```

### Instruction Types

- **I** (Immediate): uses imm8 as data value
- **M** (Memory): uses imm8 as RAM address
- **R** (Register): operates on Rd and Rs registers
- **J** (Jump): uses imm8 as target PC address

## Decoder Control Word

The instruction decoder is a ROM mapping opcode (4-bit) → 8-bit control word.

### Bit Assignment

```
Bit 7:   reg_write   — write result to Rd
Bit 6:   alu_en      — use ALU result (vs passthrough/memory)
Bit 5-3: alu_op[2:0] — ALU operation select
Bit 2:   mem_read    — read from RAM
Bit 1:   mem_write   — write Rs to RAM
Bit 0:   imm_sel     — select imm8 as ALU operand B (vs Rs register)
```

### Decoder ROM Table

```
Opcode  Instruction  reg_write  alu_en  alu_op  mem_read  mem_write  imm_sel  Hex
──────  ───────────  ─────────  ──────  ──────  ────────  ─────────  ───────  ───
0x0     NOP          0          0       000     0         0          0        0x00
0x1     LDI          1          0       000     0         0          1        0x81
0x2     LD           1          0       000     1         0          0        0x84
0x3     ST           0          0       000     0         1          0        0x02
0x4     MOV          1          0       000     0         0          0        0x80
0x5     ADD          1          1       100     0         0          0        0xE0
0x6     SUB          1          1       101     0         0          0        0xE8
0x7     AND          1          1       000     0         0          0        0xC0
0x8     OR           1          1       001     0         0          0        0xC8
0x9     XOR          1          1       010     0         0          0        0xD0
0xA     NOT          1          1       011     0         0          0        0xD8
0xB     SHL          1          1       110     0         0          0        0xF0
0xC     SHR          1          1       111     0         0          0        0xF8
0xD     JMP          0          0       000     0         0          0        0x00
0xE     JZ           0          0       000     0         0          0        0x00
0xF     HALT         0          0       000     0         0          0        0x00
```

Jump/halt control is decoded directly from the opcode bits by the control unit (iteration 26), not from this ROM.

### ALU Opcode Mapping

```
Instruction  ALU Op (3-bit)  ALU Operation
───────────  ──────────────  ─────────────
AND          000             Bitwise AND
OR           001             Bitwise OR
XOR          010             Bitwise XOR
NOT          011             Bitwise NOT A
ADD          100             Addition
SUB          101             Subtraction
SHL          110             Shift Left
SHR          111             Shift Right
```

## Example Programs

### 1. Add Two Numbers

```asm
; Result: R0 = 5 + 3 = 8, stored at RAM[128]
LDI R0, #5      ; R0 = 5         → ROM_H: 0x10, ROM_L: 0x05
LDI R1, #3      ; R1 = 3         → ROM_H: 0x14, ROM_L: 0x03
ADD R0, R1       ; R0 = R0 + R1   → ROM_H: 0x54, ROM_L: 0x00
ST  R0, [0x80]   ; RAM[128] = R0  → ROM_H: 0x30, ROM_L: 0x80
HALT             ; stop            → ROM_H: 0xF0, ROM_L: 0x00
```

### 2. Conditional Jump (Count Down)

```asm
; Count down from 10 to 0
LDI R0, #10     ; R0 = counter    → ROM_H: 0x10, ROM_L: 0x0A
LDI R1, #1      ; R1 = decrement  → ROM_H: 0x14, ROM_L: 0x01
SUB R0, R1       ; R0 = R0 - 1     → ROM_H: 0x64, ROM_L: 0x00  (addr 2)
JZ  0x05         ; if zero, jump 5 → ROM_H: 0xE0, ROM_L: 0x05
JMP 0x02         ; loop back        → ROM_H: 0xD0, ROM_L: 0x02
HALT             ; done             → ROM_H: 0xF0, ROM_L: 0x00  (addr 5)
```

### 3. Memory Copy (4 bytes)

```asm
; Copy RAM[0x10..0x13] → RAM[0x20..0x23]
LD  R0, [0x10]   ; R0 = RAM[16]   → ROM_H: 0x20, ROM_L: 0x10
ST  R0, [0x20]   ; RAM[32] = R0   → ROM_H: 0x30, ROM_L: 0x20
LD  R0, [0x11]   ; R0 = RAM[17]   → ROM_H: 0x20, ROM_L: 0x11
ST  R0, [0x21]   ; RAM[33] = R0   → ROM_H: 0x30, ROM_L: 0x21
LD  R0, [0x12]   ; R0 = RAM[18]   → ROM_H: 0x20, ROM_L: 0x12
ST  R0, [0x22]   ; RAM[34] = R0   → ROM_H: 0x30, ROM_L: 0x22
LD  R0, [0x13]   ; R0 = RAM[19]   → ROM_H: 0x20, ROM_L: 0x13
ST  R0, [0x23]   ; RAM[35] = R0   → ROM_H: 0x30, ROM_L: 0x23
HALT             ; done            → ROM_H: 0xF0, ROM_L: 0x00
```
