# I/O Peripherals — Advanced

Circuits combining DIP Switch, Hex Display, and LED Bar with logic operations. Demonstrates the full pipeline: interactive input → bit manipulation → visual output. Also verifies that peripheral variant nodes survive import/export.

## Modules

| Name | ID | Inputs | Outputs | Sub-modules | Description |
|------|----|--------|---------|-------------|-------------|
| NOT | mod-not | A | Out | 1x NAND | Inverter |
| AND | mod-and | A, B | Out | 2x NAND | Logical AND |
| DIP Bitwise NOT to LED | mod-dip-bitwise-not-led | — | Q[8] | DIP + Splitter + 8x NOT + Merger + LED | Invert all 8 bits |
| Two DIP AND to Hex | mod-two-dip-and-hex | A[8], B[8] | Q[8] | 2x DIP + 2x Splitter + 8x AND + Merger + Hex | Bitwise AND |
| DIP Direct to Hex and LED | mod-dip-direct-hex-led | D[8] | Q[8] | DIP + Hex + LED (fan-out) | Same value to all outputs |
| 4-bit DIP to Hex | mod-4bit-dip-hex | D[4] | Q[4] | DIP[4] + Hex[4] | 4-bit peripheral pair |

## Architecture

### DIP Bitwise NOT to LED
```
DIP[8] → Splitter → bit0..7
                     bit0 → NOT → bit0'
                     ...
                     bit7 → NOT → bit7'
                                  ↓
                              Merger → LED Bar + Q[8]
```

### Two DIP AND to Hex
```
A[8] → Splitter → a0..a7
B[8] → Splitter → b0..b7
                   (ai AND bi) → ri (for each i)
                                  ↓
                              Merger → Hex Display + Q[8]
```

### DIP Direct to Hex and LED (fan-out)
```
DIP[8] ──┬── Hex Display
         ├── LED Bar
         └── Q[8]
```

## Behaviour

| Module | Input | Output | Notes |
|--------|-------|--------|-------|
| DIP NOT LED | D=0xA5 | Q=0x5A | bitwise NOT |
| DIP NOT LED | D=0xFF | Q=0x00 | |
| DIP NOT LED | D=0x00 | Q=0xFF | |
| DIP NOT LED | D=0x0F | Q=0xF0 | |
| Two DIP AND | A=0xFF, B=0x0F | Q=0x0F | |
| Two DIP AND | A=0xA5, B=0x5A | Q=0x00 | |
| DIP direct | D=0xA5 | Q=0xA5 | all outputs equal |
| 4-bit DIP | D=0xF | Q=0xF | bits=4 |

## Test Scenarios

### DIP Bitwise NOT to LED
- 0xA5 (10100101b) → NOT → 0x5A (01011010b)
- 0xFF → 0x00
- 0x00 → 0xFF
- 0x0F → 0xF0

### Two DIP AND to Hex
- A=0xFF AND B=0x0F = 0x0F
- A=0xA5 AND B=0x5A = 0x00
- A=0xFF AND B=0xFF = 0xFF
- A=0x00 AND B=0xFF = 0x00

### DIP Direct to Hex and LED
- D=0xA5 → Q=0xA5 (all outputs identical)
- D=0x00 → Q=0x00
- Structural: dip-switch, hex-display, led-bar variant nodes present

### 4-bit DIP to Hex
- D=0xF → Q=0xF; D=0x0 → Q=0x0; D=0xA → Q=0xA
- Structural: bits=4 on both DIP and Hex nodes

## Use Cases

- **Visual debugging**: connect DIP Switch to logic and observe results on Hex/LED
- **Bit manipulation demos**: NOT, AND, swap applied to interactive input
- **Peripheral verification**: confirms variant nodes (dip-switch, hex-display, led-bar) serialise correctly
- **Showcase**: build an interactive bitwise calculator with DIP Switches and Hex Display
