# Basic Logic Gates

All gates built purely from NAND (`builtin:nand`).

## Modules

| Name | ID | Inputs | Outputs | NAND Count | Formula |
|------|----|--------|---------|------------|---------|
| NOT | mod-not | A | Out | 1 | NAND(A,A) |
| AND | mod-and | A, B | Out | 2 | NOT(NAND(A,B)) |
| OR | mod-or | A, B | Out | 3 | NAND(NOT(A), NOT(B)) |
| XOR | mod-xor | A, B | Out | 4 | NAND(NAND(A,t), NAND(B,t)) where t=NAND(A,B) |
| NOR | mod-nor | A, B | Out | 4 | NOT(OR(A,B)) |
| XNOR | mod-xnor | A, B | Out | 5 | NOT(XOR(A,B)) |
| Buffer | mod-buffer | A | Out | 2 | NOT(NOT(A)) |

## Truth Tables

### NOT
| A | Out |
|---|-----|
| 0 | 1 |
| 1 | 0 |

### AND
| A | B | Out |
|---|---|-----|
| 0 | 0 | 0 |
| 0 | 1 | 0 |
| 1 | 0 | 0 |
| 1 | 1 | 1 |

### OR
| A | B | Out |
|---|---|-----|
| 0 | 0 | 0 |
| 0 | 1 | 1 |
| 1 | 0 | 1 |
| 1 | 1 | 1 |

### XOR
| A | B | Out |
|---|---|-----|
| 0 | 0 | 0 |
| 0 | 1 | 1 |
| 1 | 0 | 1 |
| 1 | 1 | 0 |

### NOR
| A | B | Out |
|---|---|-----|
| 0 | 0 | 1 |
| 0 | 1 | 0 |
| 1 | 0 | 0 |
| 1 | 1 | 0 |

### XNOR
| A | B | Out |
|---|---|-----|
| 0 | 0 | 1 |
| 0 | 1 | 0 |
| 1 | 0 | 0 |
| 1 | 1 | 1 |

### Buffer
| A | Out |
|---|-----|
| 0 | 0 |
| 1 | 1 |

## Test Scenarios

1. NOT: A=0 -> 1, A=1 -> 0
2. AND: only (1,1) -> 1
3. OR: only (0,0) -> 0
4. XOR: (0,1) and (1,0) -> 1
5. NOR: only (0,0) -> 1
6. XNOR: (0,0) and (1,1) -> 1
7. Buffer: passthrough, A=0 -> 0, A=1 -> 1

## Use Cases

- **NOT**: signal inversion, enable/disable logic
- **AND**: masking bits, condition checking
- **OR**: combining signals, default values
- **XOR**: parity checking, arithmetic (half adder), toggle logic
- **NOR/XNOR**: comparison, equality checking
- **Buffer**: signal regeneration, delay matching
