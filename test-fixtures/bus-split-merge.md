# Bus Split / Merge

Demonstrates the `builtin:splitter` and `builtin:merger` nodes for decomposing and recomposing multi-bit signals. Covers roundtrip identity, bit-reversal, nibble extraction, and nibble swap.

## Modules

| Name | ID | Inputs | Outputs | Sub-modules | Description |
|------|----|--------|---------|-------------|-------------|
| Split-Merge Roundtrip 8-bit | mod-split-merge-roundtrip-8 | D[8] | Q[8] | Splitter + Merger | 8-bit → 8×1-bit → 8-bit |
| Split-Merge Roundtrip 4-bit | mod-split-merge-roundtrip-4 | D[4] | Q[4] | Splitter + Merger | 4-bit → 4×1-bit → 4-bit |
| 4-bit Bit Reverse | mod-bit-reverse-4 | D[4] | Q[4] | Splitter + Merger (cross) | bit0↔bit3, bit1↔bit2 |
| Lower Nibble Extract | mod-lower-nibble-extract | D[8] | Q[8] | Splitter + GND constant + Merger | bits 4–7 zeroed |
| Nibble Swap | mod-nibble-swap | D[8] | Q[8] | Splitter + Merger (cross) | bits 0–3 ↔ bits 4–7 |

## Architecture

```
Splitter (N-bit input):
  In[N] → bit0, bit1, ..., bit(N-1)   (LSB = bit0)

Merger (N-bit output):
  bit0, bit1, ..., bit(N-1) → Out[N]  (LSB = bit0)

Cross-wiring examples:
  Bit Reverse (4-bit):  s0→m3, s1→m2, s2→m1, s3→m0
  Nibble Swap (8-bit):  s0-s3→m4-m7, s4-s7→m0-m3
  Lower Nibble:         s0-s3→m0-m3, GND→m4-m7
```

## Behaviour

| Module | Input | Output | Notes |
|--------|-------|--------|-------|
| Roundtrip 8-bit | 0xA5 | 0xA5 | identity |
| Roundtrip 4-bit | 0xF | 0xF | identity |
| Bit Reverse 4-bit | 0b1010 (10) | 0b0101 (5) | bit order flipped |
| Lower Nibble | 0xA5 | 0x05 | upper nibble masked to 0 |
| Nibble Swap | 0xA5 | 0x5A | nibbles exchanged |

## Test Scenarios

### Roundtrip
- 0xA5 → split → merge → 0xA5 (8-bit)
- 0xFF → 0xFF; 0x00 → 0x00
- 0x01 (only LSB set) and 0x80 (only MSB set) preserved
- 4-bit: 0xF → 0xF; 0x5 → 0x5; 0x0 → 0x0

### Bit Reverse
- 0b1010 (10) → 0b0101 (5)
- 0b1100 (12) → 0b0011 (3)
- 0b1111 → 0b1111 (symmetric)
- 0b0001 → 0b1000

### Lower Nibble Extract
- 0xA5 → 0x05 (upper nibble zeroed)
- 0xFF → 0x0F
- 0xF0 → 0x00

### Nibble Swap
- 0xA5 → 0x5A
- 0x12 → 0x21
- 0xFF → 0xFF (symmetric)
- 0xF0 → 0x0F

## Use Cases

- **Byte manipulation**: extract, mask, or reorder individual bits and nibbles
- **Bit-serial interfaces**: split multi-bit bus for per-bit processing
- **Format conversion**: rearrange bit fields without logic gates
- **Showcase**: connect DIP Switch to Splitter, route bits through logic, recombine with Merger
