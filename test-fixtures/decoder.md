# 2-to-4 Line Decoder

## Description

A 2-to-4 line decoder takes a 2-bit binary input (A1, A0) and activates exactly one of four output lines (Y0-Y3). The output corresponding to the binary value of the input is set to 1; all other outputs are 0. This is a fundamental combinational circuit used in address decoding and memory selection.

## Module Overview

| Name | Inputs | Outputs | Sub-modules | Description |
|------|--------|---------|-------------|-------------|
| NOT | A | Out | 1x NAND | Inverter: NAND(A,A) |
| AND | A, B | Out | 2x NAND | Conjunction: NOT(NAND(A,B)) |
| 2-to-4 Decoder | A0, A1 | Y0, Y1, Y2, Y3 | 2x NOT, 4x AND | Binary decoder |

## Internal Structure

The decoder uses two NOT gates to produce the complements of the inputs (NOT_A0, NOT_A1), then four AND gates to generate each output:

- **Y0** = AND(NOT(A1), NOT(A0)) -- active when A1=0, A0=0
- **Y1** = AND(NOT(A1), A0) -- active when A1=0, A0=1
- **Y2** = AND(A1, NOT(A0)) -- active when A1=1, A0=0
- **Y3** = AND(A1, A0) -- active when A1=1, A0=1

## Truth Table

| A1 | A0 | Y0 | Y1 | Y2 | Y3 |
|----|----|----|----|----|-----|
| 0  | 0  | 1  | 0  | 0  | 0  |
| 0  | 1  | 0  | 1  | 0  | 0  |
| 1  | 0  | 0  | 0  | 1  | 0  |
| 1  | 1  | 0  | 0  | 0  | 1  |

## Test Scenarios

1. **A1=0, A0=0** -- Y0=1, Y1=0, Y2=0, Y3=0 (select line 0)
2. **A1=0, A0=1** -- Y0=0, Y1=1, Y2=0, Y3=0 (select line 1)
3. **A1=1, A0=0** -- Y0=0, Y1=0, Y2=1, Y3=0 (select line 2)
4. **A1=1, A0=1** -- Y0=0, Y1=0, Y2=0, Y3=1 (select line 3)

## Use Cases

- **Address decoding**: Select one of N memory chips or I/O devices based on address bits
- **Memory bank selection**: Route read/write operations to the correct memory bank
- **Instruction decode**: Activate the appropriate functional unit based on opcode bits
- **Demultiplexing**: When combined with an enable signal, routes a single input to one of several outputs
