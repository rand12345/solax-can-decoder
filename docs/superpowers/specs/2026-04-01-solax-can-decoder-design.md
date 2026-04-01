# Solax CAN Bus Decoder/Encoder — Design Spec

**Date:** 2026-04-01  
**Status:** Approved  

---

## Overview

A static single-page web tool hosted on GitHub Pages that decodes and encodes Solax V1 Hybrid/Fit/AC inverter CAN bus data. Target audience: technical users (engineers, battery hobbyists) familiar with CAN bus concepts.

Protocol source: [rand12345/solax_can_bus](https://github.com/rand12345/solax_can_bus) (README + DBC) and [dalathegreat/Battery-Emulator SOLAX-CAN.cpp](https://github.com/dalathegreat/Battery-Emulator/blob/main/Software/src/inverter/SOLAX-CAN.cpp).

---

## Architecture

Multi-file vanilla JS static site. No build step, no framework, no package manager. Deployed directly from the `main` branch root of a new GitHub repository (`solax-can-decoder`), with GitHub Pages enabled.

### File Structure

```
solax-can-decoder/
├── index.html      # Single page, two tabs: Decoder / Encoder
├── style.css       # Minimal dark/monospace theme
├── protocol.js     # Frame definitions — only file to edit to add frames
├── decoder.js      # Parses input → decoded tables or uPlot time series
├── encoder.js      # Field inputs → raw CAN hex bytes
└── test.js         # In-browser assertions, activated via ?test=1
```

### Dependencies (CDN, no install)

- **uPlot** — lightweight time series charting (~40KB), loaded from CDN

---

## Protocol Definitions (`protocol.js`)

Exports a `FRAMES` map keyed by CAN ID (integer). Each entry:

```js
{
  0x1872: {
    name: "BMS_Limits",
    fields: [
      { name: "slave_voltage_max",  startByte: 0, length: 2, signed: false, factor: 0.1,  offset: 0, unit: "V",   min: 290, max: 400 },
      { name: "slave_voltage_min",  startByte: 2, length: 2, signed: false, factor: 0.1,  offset: 0, unit: "V",   min: 290, max: 330 },
      { name: "max_charge_rate",    startByte: 4, length: 2, signed: false, factor: 0.1,  offset: 0, unit: "A",   min: 0,   max: 253 },
      { name: "max_discharge_rate", startByte: 6, length: 2, signed: false, factor: 0.1,  offset: 0, unit: "A",   min: 0,   max: 35  },
    ]
  }
}
```

All multi-byte fields are little-endian. Signed fields use two's complement.

### Known Frames

| CAN ID | Name          | Source         |
|--------|---------------|----------------|
| 0x1871 | BMS_Poll      | README (RX, poll from inverter) |
| 0x1872 | BMS_Limits    | DBC + Battery-Emulator |
| 0x1873 | BMS_PackData  | DBC + Battery-Emulator |
| 0x1874 | BMS_CellData  | DBC + Battery-Emulator |
| 0x1875 | BMS_Status    | DBC + Battery-Emulator |
| 0x1876 | BMS_PackTemps | DBC + Battery-Emulator |
| 0x1877 | BMS_Identity  | Battery-Emulator (battery type, firmware version) |
| 0x1878 | BMS_PackStats | DBC + Battery-Emulator |
| 0x187A | BMS_Announce  | Battery-Emulator (static startup frame: `01 50 ...`) |
| 0x187E | BMS_Ultra     | Battery-Emulator (total capacity Wh, SOH%, SOC%) |

---

## Decoder

### Input

Two entry methods, both feeding the same parser:

1. **Textarea** — paste candump log lines or a single frame
2. **Import file** button (`<input type="file" accept=".txt,.log">`) — loads file content into the textarea

### Accepted Input Formats

**Candump log** (with or without leading line numbers):
```
(3162.556) TX1 1872 [8] B8 11 A8 0C F8 00 F8 00
20   (3162.556) RX0 1871 [8] 01 00 01 00 00 00 00 00
```

**Single frame** (no timestamp or direction required):
```
1872 B8 11 A8 0C F8 00 F8 00
```

### Parsing Rules

1. Strip leading line-number prefix (`^\d+\s+` before the `(`)
2. Regex: `\(?([\d.]+)\)?\s+\w+\s+([0-9A-Fa-f]+)\s+\[(\d+)\]\s+((?:[0-9A-Fa-f]{2}\s*)+)`
3. Single-frame shorthand: `^([0-9A-Fa-f]+)\s+((?:[0-9A-Fa-f]{2}\s*)+)$`
4. Lines matching neither pattern are counted as skipped

### Output

**Frame seen once → table:**

| Frame | Field | Raw (hex) | Decoded |
|-------|-------|-----------|---------|
| 0x1872 BMS_Limits | slave_voltage_max | 0x11B8 | 453.6 V |

**Frame seen multiple times → uPlot time series:**
- One graph panel per numeric field
- X-axis: log timestamp (seconds)
- Y-axis: decoded physical value with unit label
- All panels for a frame grouped under a collapsible section header

**Unknown frames:**
- Hidden by default
- Shown as `0xXXXX — Unknown Frame | B0 B1 B2 B3 B4 B5 B6 B7` when "Show all frames" toggle is on

**Controls:**
- `Show known frames only` toggle (default: ON)
- `Show all occurrences` toggle — when OFF (default), time series shows all data points; this toggle has no effect on single-occurrence frames
- Skipped line count: `"N lines skipped — unrecognised format"` (dismissible, shown only when N > 0)

### Behaviour

- Output updates live as text is typed or pasted into the textarea
- Clearing the textarea clears the output

---

## Encoder

### UI

A `<select>` dropdown lists all known frame IDs and names. Selecting one renders a form with one `<input type="number">` per field, labelled with:
- Field name
- Unit
- Valid range (as `min`/`max` HTML attributes and placeholder text)

### Output

Updates live as values are typed:

```
Candump:  1872 [8] B8 11 A8 0C F8 00 F8 00
Raw hex:  B811A80CF800F800
```

A **Copy** button copies the raw hex to clipboard.

### Validation

- Out-of-range value: input border turns red, tooltip shows valid range
- Output is still generated (technical users may intentionally send edge values)
- Non-numeric input: field treated as 0

---

## Error Handling

| Condition | Behaviour |
|-----------|-----------|
| Malformed log line | Skip silently, increment skipped count |
| Empty textarea | Clear output, hide skipped count |
| File too large (>5MB) | Show warning, do not load |
| Unknown CAN ID | Show as Unknown Frame when toggle is on |
| Encoder out-of-range | Red input highlight, tooltip, output still generated |

---

## Testing (`test.js`)

Activated by loading `index.html?test=1`. Runs ~20 assertions in the browser console on page load. No test framework — plain `console.assert`.

Test cases include:

- `decode(0x1872, [0xB8,0x11,0xA8,0x0C,0xF8,0x00,0xF8,0x00])` → `slave_voltage_max = 453.6`
- `decode(0x1873, [0xBA,0x0F,0xF1,0xFF,0x2F,0x00,0x01,0x00])` → `current_sensor = -1.5`
- Encoder round-trip: `encode(0x1872, { slave_voltage_max: 453.6, ... })` → decode back → values match
- Parser handles line-number prefix correctly
- Parser handles single-frame shorthand

---

## Deployment

- **Repository:** `solax-can-decoder` (new public repo, created via GitHub API)
- **GitHub Pages:** enabled on `main` branch, root folder (`/`)
- **URL:** `https://<username>.github.io/solax-can-decoder`
- No CI pipeline needed — push to `main` triggers Pages auto-deploy (~60s)
