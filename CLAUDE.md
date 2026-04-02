# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A static single-page web tool for decoding and encoding Solax V1 Hybrid/Fit/AC inverter CAN bus data. No build step, no framework, no package manager — pure vanilla JS deployed via GitHub Pages.

Protocol sources: [rand12345/solax_can_bus](https://github.com/rand12345/solax_can_bus) and [dalathegreat/Battery-Emulator SOLAX-CAN.cpp](https://github.com/dalathegreat/Battery-Emulator/blob/main/Software/src/inverter/SOLAX-CAN.cpp).

## Running & Testing

Open `index.html` directly in a browser (no server needed).

Run tests by loading `index.html?test=1` — results appear in the browser console. Pass/fail summary is shown in the page title. There are ~20 assertions covering decode, encode, round-trips, and parser edge cases.

## Architecture

Script load order matters — `index.html` loads scripts in this sequence:

1. `protocol.js` — defines `FRAMES` (global const), the only file to edit when adding/modifying frame definitions
2. `decoder.js` — `decodeFrame(id, bytes)` and `parseLines(text)`, depends on `FRAMES`
3. `encoder.js` — `encodeFrame(id, values)`, depends on `FRAMES`
4. `app.js` — DOM wiring, rendering logic, uPlot chart creation; depends on all above
5. `test.js` — loaded dynamically only when `?test=1` is present

## Frame Definitions (`protocol.js`)

Each frame field has this shape:
```js
{ name, startByte, length, signed, factor, offset, unit, min, max }
```

- All multi-byte fields are **little-endian**
- Physical value = `raw * factor + offset`
- Raw value = `round((physical - offset) / factor)`
- `length` is 1, 2, or 4 bytes only
- Fields with units `V`, `mV`, `A`, `W`, `Wh`, `kWh`, `%` are treated as "electrical" and rendered as uPlot time-series charts when the same frame ID appears multiple times in the log

## Key Behaviours

- Decoder updates live on textarea input
- When a CAN ID appears once: renders a field table; when multiple times: electrical fields → uPlot charts, non-electrical fields → table showing latest value
- Unknown frame IDs are hidden by default (controlled by `knownOnly` checkbox)
- Encoder out-of-range validation highlights inputs red but still generates output (intentional — for testing edge values)
- File import is capped at 5 MB

## Deployment

Push to `main` — GitHub Pages auto-deploys from the repo root (~60s). No CI pipeline.
