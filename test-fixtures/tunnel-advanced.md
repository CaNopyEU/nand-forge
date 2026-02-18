# Tunnels — Advanced

Tunnel pairs for wireless signal routing within a circuit. Demonstrates multi-bit tunnels, independent named pairs, fan-out, combination with logic gates, and chained hops.

## How Tunnels Work

```
TunnelIn(name)  ← receives a signal (has a physical wire in)
TunnelOut(name) → emits the signal (connects to downstream)

resolveTunnels() creates virtual edges:
  for each TunnelIn, find all TunnelOut with the same pin name
  → virtual edge: TunnelIn.outputPin → TunnelOut.inputPin

Matching is by pin name, not node ID.
Fan-out: one TunnelIn → many TunnelOut with the same name.
```

## Modules

| Name | ID | Inputs | Outputs | Tunnel names | Description |
|------|----|--------|---------|--------------|-------------|
| 8-bit Tunnel | mod-tunnel-8bit | D[8] | Q[8] | BUS | 8-bit signal through one tunnel pair |
| Multi-name Tunnels | mod-tunnel-multi-name | A, B | QA, QB | SIG_A, SIG_B | Two independent, isolated tunnel pairs |
| Tunnel Fan-out | mod-tunnel-fanout | D | Q0, Q1 | CLK (1 in, 2 out) | One source → two receivers |
| Tunnel with Logic | mod-tunnel-with-logic | A | Q | X, Y | NOT gate between two tunnel pairs |
| Tunnel Chain | mod-tunnel-chain | A | Q | P, Q, R | Signal through 3 sequential tunnel pairs |

## Architecture

### Multi-name Tunnels
```
A ──→ TunnelIn(SIG_A)  ···→  TunnelOut(SIG_A) ──→ QA
B ──→ TunnelIn(SIG_B)  ···→  TunnelOut(SIG_B) ──→ QB

SIG_A and SIG_B are completely isolated — different names never mix.
```

### Tunnel Fan-out
```
D ──→ TunnelIn(CLK)  ···→  TunnelOut(CLK) ──→ Q0
                     ···→  TunnelOut(CLK) ──→ Q1

Both outputs receive the same value.
```

### Tunnel with Logic
```
A ──→ TunnelIn(X) ···→ TunnelOut(X) ──→ NAND(A, A) = NOT(A)
                                      ──→ TunnelIn(Y) ···→ TunnelOut(Y) ──→ Q
```

### Tunnel Chain (P → Q → R)
```
A ──→ In(P)···Out(P)──→ In(Q)···Out(Q)──→ In(R)···Out(R)──→ Q

Each hop is a complete tunnel pair; signal is preserved across all three.
```

## Test Scenarios

### 8-bit Tunnel
- D=0xA5 → Q=0xA5 (multi-bit preserved)
- D=0xFF → Q=0xFF; D=0x00 → Q=0x00

### Multi-name Tunnels
- A=1, B=0 → QA=1, QB=0 (independent)
- A=0, B=1 → QA=0, QB=1
- A=1, B=1 → QA=1, QB=1

### Tunnel Fan-out
- D=1 → Q0=1, Q1=1
- D=0 → Q0=0, Q1=0

### Tunnel with Logic (NOT in the middle)
- A=0 → Q=1 (NOT 0)
- A=1 → Q=0 (NOT 1)

### Tunnel Chain
- A=1 → Q=1 (signal preserved through 3 hops)
- A=0 → Q=0

## Use Cases

- **Clock distribution**: route a clock signal to multiple flip-flops without physical wires
- **Bus routing**: connect a data bus to several module inputs across a complex layout
- **Namespace isolation**: carry independent signals in the same circuit using different names
- **Wire simplification**: reduce visual clutter in large circuits by removing long crossing wires
