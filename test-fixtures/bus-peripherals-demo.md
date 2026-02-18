# Bus Peripherals Demo

Showcase modules for bus peripheral features: DIP Switch, Hex Display, LED Bar, and Tunnels. Verifies that peripheral variant nodes and tunnel pairs survive serialisation round-trips.

## Modules

| Name | ID | Inputs | Outputs | Features Tested |
|------|----|--------|---------|-----------------|
| Hex Monitor | mod-hex-monitor | Data[8] | Pass[8] | Hex Display + LED Bar reading same bus |
| Tunnel Bridge | mod-tunnel-bridge | In | Out | Wireless signal routing via tunnel pair |
| DIP to Hex | mod-dip-demo | (none) | Val[8] | DIP Switch as interactive 8-bit input |

## Architecture

### Hex Monitor
8-bit pass-through with visual outputs. Input signal is fanned out to:
- Hex Display (shows hex/binary/decimal)
- LED Bar (shows individual bit LEDs)
- Pass-through output

Use case: debugging tool — insert between any 8-bit bus to visualize signal.

### Tunnel Bridge
1-bit signal routed wirelessly through a tunnel pair (name: "SIG").
- Input → TunnelIn("SIG") ... TunnelOut("SIG") → Output
- No physical wire between the tunnels — `resolveTunnels()` creates virtual edges

Use case: verification that tunnel resolution works in import/export round-trip.

### DIP to Hex
Self-contained demo with DIP Switch (variant: "dip-switch") wired to Hex Display (variant: "hex-display").
No external inputs — the DIP Switch IS the interactive control.

Use case: test that variant nodes serialize/deserialize correctly.

## Test Scenarios

### Hex Monitor
1. Input Data=0xA5 → Pass output=0xA5 (pass-through works)
2. Internal hex-display and led-bar pins receive the same value

### Tunnel Bridge
1. Input In=1 → Output Out=1 (signal passes through tunnel pair)
2. Input In=0 → Output Out=0

### DIP to Hex
1. Import fixture → DIP Switch and Hex Display nodes preserved with correct variants
2. Set DIP value=0xFF → Hex Display pin receives 0xFF

## Use Cases

These modules verify that the following engine node types survive export/import:
- `type: "input", variant: "dip-switch"` → canvas `dipSwitch`
- `type: "output", variant: "hex-display"` → canvas `hexDisplay`
- `type: "output", variant: "led-bar"` → canvas `ledBar`
- `type: "tunnel", variant: "in"/"out"` → canvas `tunnel`
