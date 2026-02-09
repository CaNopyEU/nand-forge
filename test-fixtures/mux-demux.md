# Multiplexers

## Module Overview

| Name | Inputs | Outputs | Sub-modules | Description |
|------|--------|---------|-------------|-------------|
| NOT | A | Out | 1x NAND | Inverter: NAND(A,A) |
| AND | A, B | Out | 2x NAND | Conjunction: NOT(NAND(A,B)) |
| OR | A, B | Out | 3x NAND | Disjunction: NAND(NOT(A), NOT(B)) |
| MUX2 | A, B, S | Y | 1x NOT, 2x AND, 1x OR | 2:1 multiplexer |
| MUX4 | D0, D1, D2, D3, S0, S1 | Y | 3x MUX2 | 4:1 multiplexer |

## Truth Tables

### MUX2 (2:1 Multiplexer)

Y = OR(AND(A, NOT(S)), AND(B, S))

When S=0, output follows A. When S=1, output follows B.

| S | A | B | Y |
|---|---|---|---|
| 0 | 0 | 0 | 0 |
| 0 | 0 | 1 | 0 |
| 0 | 1 | 0 | 1 |
| 0 | 1 | 1 | 1 |
| 1 | 0 | 0 | 0 |
| 1 | 0 | 1 | 1 |
| 1 | 1 | 0 | 0 |
| 1 | 1 | 1 | 1 |

### MUX4 (4:1 Multiplexer)

Y = MUX2(MUX2(D0, D1, S0), MUX2(D2, D3, S0), S1)

S1 selects the pair (low or high), S0 selects within the pair.

| S1 | S0 | Y |
|----|----|---|
| 0  | 0  | D0 |
| 0  | 1  | D1 |
| 1  | 0  | D2 |
| 1  | 1  | D3 |

## Test Scenarios

### MUX2

1. **S=0, A=1, B=0** -- Y should be 1 (selects A)
2. **S=0, A=0, B=1** -- Y should be 0 (selects A)
3. **S=1, A=1, B=0** -- Y should be 0 (selects B)
4. **S=1, A=0, B=1** -- Y should be 1 (selects B)

### MUX4

1. **S1=0, S0=0, D0=1, D1=0, D2=0, D3=0** -- Y=1 (selects D0)
2. **S1=0, S0=1, D0=0, D1=1, D2=0, D3=0** -- Y=1 (selects D1)
3. **S1=1, S0=0, D0=0, D1=0, D2=1, D3=0** -- Y=1 (selects D2)
4. **S1=1, S0=1, D0=0, D1=0, D2=0, D3=1** -- Y=1 (selects D3)

## Use Cases

- **Data routing**: Select one of multiple data sources to forward to a single output
- **Bus selection**: Choose which bus drives a shared data path
- **Instruction decode**: Select operands or immediate values based on opcode fields
- **Function generation**: Any N-input boolean function can be implemented with a 2^N:1 MUX
