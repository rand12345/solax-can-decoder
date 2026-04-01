# Solax CAN Bus Decoder/Encoder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a static single-page website to GitHub Pages that decodes Solax CAN bus candump logs and individual frames, and encodes human-readable values back to raw CAN bytes.

**Architecture:** Multi-file vanilla JS, no build step. `protocol.js` holds all frame/field definitions. `decoder.js` and `encoder.js` contain pure logic. `app.js` wires all UI events. `index.html` loads scripts in order and defines the DOM. uPlot (unpkg CDN) renders time series charts for repeated frames.

**Tech Stack:** Vanilla JS (global scope, no modules), uPlot 1.6.31 (CDN), GitHub Pages (main branch root)

---

## File Map

| File | Responsibility |
|------|----------------|
| `protocol.js` | `FRAMES` constant: all 10 CAN frame definitions with field specs |
| `decoder.js` | `readRaw()`, `decodeFrame()`, `parseLines()` |
| `encoder.js` | `encodeFrame()`, LE write helpers |
| `app.js` | Tab switching, decoder rendering, encoder UI, uPlot charts |
| `test.js` | `runTests()` — ~20 `console.assert` checks, activated via `?test=1` |
| `index.html` | DOM shell, script loading order |
| `style.css` | Dark monospace theme |

---

### Task 1: Create GitHub repository and enable Pages

**Files:** none local

- [ ] **Step 1: Get your GitHub username**
```bash
gh api user --jq '.login'
```
Note the output — replace `<username>` throughout this plan with it.

- [ ] **Step 2: Create the repo**
```bash
gh repo create solax-can-decoder --public --description "Solax V1 CAN bus decoder/encoder"
```
Expected: `✓ Created repository <username>/solax-can-decoder on GitHub`

- [ ] **Step 3: Add remote and push existing commits (spec doc)**
```bash
git remote add origin https://github.com/<username>/solax-can-decoder.git
git push -u origin main
```

- [ ] **Step 4: Enable GitHub Pages on main branch root**
```bash
gh api repos/<username>/solax-can-decoder/pages \
  -X POST \
  -H "Accept: application/vnd.github+json" \
  -f "source[branch]=main" \
  -f "source[path]=/"
```
Expected: JSON response containing `"status": "queued"` or `"html_url"`.

- [ ] **Step 5: Confirm Pages URL**
```bash
gh api repos/<username>/solax-can-decoder/pages --jq '.html_url'
```
Expected output: `https://<username>.github.io/solax-can-decoder`

---

### Task 2: Create `protocol.js` — all frame definitions

**Files:**
- Create: `protocol.js`

- [ ] **Step 1: Create `protocol.js`**

All fields are little-endian. `factor` multiplies the raw integer to produce the physical value. `min`/`max` are physical-value bounds used for encoder validation.

```js
// protocol.js
// Solax V1 Hybrid/Fit/AC CAN bus frame definitions.
// Sources:
//   https://github.com/rand12345/solax_can_bus (README + DBC)
//   https://github.com/dalathegreat/Battery-Emulator (SOLAX-CAN.cpp)

const FRAMES = {
  0x1871: {
    name: "BMS_Poll",
    fields: [
      { name: "cmd",   startByte: 0, length: 1, signed: false, factor: 1, offset: 0, unit: "", min: 0, max: 255 },
      { name: "byte2", startByte: 2, length: 1, signed: false, factor: 1, offset: 0, unit: "", min: 0, max: 255 },
      { name: "byte4", startByte: 4, length: 1, signed: false, factor: 1, offset: 0, unit: "", min: 0, max: 255 },
    ]
  },

  0x1872: {
    name: "BMS_Limits",
    fields: [
      { name: "slave_voltage_max",  startByte: 0, length: 2, signed: false, factor: 0.1, offset: 0, unit: "V", min: 290, max: 400 },
      { name: "slave_voltage_min",  startByte: 2, length: 2, signed: false, factor: 0.1, offset: 0, unit: "V", min: 290, max: 330 },
      { name: "max_charge_rate",    startByte: 4, length: 2, signed: false, factor: 0.1, offset: 0, unit: "A", min: 0,   max: 253 },
      { name: "max_discharge_rate", startByte: 6, length: 2, signed: false, factor: 0.1, offset: 0, unit: "A", min: 0,   max: 35  },
    ]
  },

  0x1873: {
    name: "BMS_PackData",
    fields: [
      { name: "master_voltage", startByte: 0, length: 2, signed: false, factor: 0.1,  offset: 0, unit: "V",   min: 290, max: 400 },
      { name: "current_sensor", startByte: 2, length: 2, signed: true,  factor: 0.1,  offset: 0, unit: "A",   min: -40, max: 40  },
      { name: "soc",            startByte: 4, length: 2, signed: false, factor: 1,    offset: 0, unit: "%",   min: 0,   max: 100 },
      { name: "kwh_remaining",  startByte: 6, length: 2, signed: false, factor: 0.01, offset: 0, unit: "kWh", min: 0,   max: 100 },
    ]
  },

  0x1874: {
    name: "BMS_CellData",
    fields: [
      { name: "cell_temp_max",  startByte: 0, length: 2, signed: true,  factor: 0.1, offset: 0, unit: "°C", min: -40,  max: 60   },
      { name: "cell_temp_min",  startByte: 2, length: 2, signed: true,  factor: 0.1, offset: 0, unit: "°C", min: -40,  max: 60   },
      { name: "cell_volts_max", startByte: 4, length: 2, signed: false, factor: 1,   offset: 0, unit: "mV", min: 2900, max: 4200 },
      { name: "cell_volts_min", startByte: 6, length: 2, signed: false, factor: 1,   offset: 0, unit: "mV", min: 2900, max: 4200 },
    ]
  },

  0x1875: {
    name: "BMS_Status",
    fields: [
      { name: "temperature_avg", startByte: 0, length: 2, signed: true,  factor: 0.1, offset: 0, unit: "°C", min: -40, max: 60 },
      { name: "num_modules",     startByte: 2, length: 1, signed: false, factor: 1,   offset: 0, unit: "",   min: 1,   max: 16 },
      { name: "contactor",       startByte: 4, length: 1, signed: false, factor: 1,   offset: 0, unit: "",   min: 0,   max: 1  },
    ]
  },

  0x1876: {
    name: "BMS_PackTemps",
    fields: [
      { name: "temp_max",    startByte: 0, length: 2, signed: true,  factor: 0.1, offset: 0, unit: "°C", min: -40,  max: 60   },
      { name: "cell_mv_max", startByte: 2, length: 2, signed: false, factor: 1,   offset: 0, unit: "mV", min: 2900, max: 4200 },
      { name: "temp_min",    startByte: 4, length: 2, signed: true,  factor: 0.1, offset: 0, unit: "°C", min: -40,  max: 60   },
      { name: "cell_mv_min", startByte: 6, length: 2, signed: false, factor: 1,   offset: 0, unit: "mV", min: 2900, max: 4200 },
    ]
  },

  0x1877: {
    name: "BMS_Identity",
    fields: [
      { name: "battery_type",     startByte: 4, length: 1, signed: false, factor: 1, offset: 0, unit: "", min: 0, max: 255 },
      { name: "firmware_version", startByte: 6, length: 1, signed: false, factor: 1, offset: 0, unit: "", min: 0, max: 255 },
      { name: "bms_role",         startByte: 7, length: 1, signed: false, factor: 1, offset: 0, unit: "", min: 0, max: 255 },
    ]
  },

  0x1878: {
    name: "BMS_PackStats",
    fields: [
      { name: "pack_voltage",   startByte: 0, length: 2, signed: false, factor: 0.1, offset: 0, unit: "V",  min: 290, max: 400        },
      { name: "total_capacity", startByte: 4, length: 4, signed: false, factor: 1,   offset: 0, unit: "Wh", min: 0,   max: 4294967295 },
    ]
  },

  0x187A: {
    name: "BMS_Announce",
    fields: [
      { name: "flag",         startByte: 0, length: 1, signed: false, factor: 1, offset: 0, unit: "", min: 0, max: 255 },
      { name: "battery_type", startByte: 1, length: 1, signed: false, factor: 1, offset: 0, unit: "", min: 0, max: 255 },
    ]
  },

  0x187E: {
    name: "BMS_Ultra",
    fields: [
      { name: "total_capacity_wh", startByte: 0, length: 4, signed: false, factor: 1, offset: 0, unit: "Wh", min: 0, max: 4294967295 },
      { name: "soh",               startByte: 4, length: 1, signed: false, factor: 1, offset: 0, unit: "%",  min: 0, max: 100        },
      { name: "soc",               startByte: 5, length: 1, signed: false, factor: 1, offset: 0, unit: "%",  min: 0, max: 100        },
    ]
  },
};
```

- [ ] **Step 2: Commit**
```bash
git add protocol.js
git commit -m "feat: add protocol frame definitions for all 10 Solax CAN frames"
```

---

### Task 3: Create `decoder.js` — LE helpers and `decodeFrame()`

**Files:**
- Create: `decoder.js`

- [ ] **Step 1: Create `decoder.js` with LE read helpers and `decodeFrame()`**

```js
// decoder.js
// Depends on: FRAMES (protocol.js, must be loaded first)

function readUInt16LE(bytes, offset) {
  return (bytes[offset] | (bytes[offset + 1] << 8)) >>> 0;
}

function readInt16LE(bytes, offset) {
  var v = bytes[offset] | (bytes[offset + 1] << 8);
  return v >= 0x8000 ? v - 0x10000 : v;
}

function readUInt32LE(bytes, offset) {
  return ((bytes[offset] | (bytes[offset+1] << 8) | (bytes[offset+2] << 16) | (bytes[offset+3] << 24)) >>> 0);
}

// Reads a little-endian integer of 1, 2, or 4 bytes from bytes[] at offset.
function readRaw(bytes, offset, length, signed) {
  if (length === 1) {
    var b = bytes[offset];
    return signed ? (b >= 0x80 ? b - 0x100 : b) : b;
  }
  if (length === 2) return signed ? readInt16LE(bytes, offset) : readUInt16LE(bytes, offset);
  if (length === 4) return readUInt32LE(bytes, offset);
  return 0;
}

function toHex(raw, length) {
  // For negative raw values (signed), convert to unsigned representation
  var u = raw < 0 ? raw + Math.pow(2, length * 8) : raw;
  return '0x' + u.toString(16).toUpperCase().padStart(length * 2, '0');
}

// Decodes a CAN frame.
// id: integer CAN ID (e.g. 0x1872)
// bytes: array of 8 integers (0-255)
//
// Returns for known frames:
//   { id, name, known: true,
//     fields: [{ name, raw, rawHex, value, unit, inRange }] }
//
// Returns for unknown frames:
//   { id, name: 'Unknown', known: false, rawBytes: [...] }
function decodeFrame(id, bytes) {
  var def = FRAMES[id];
  if (!def) {
    return { id: id, name: 'Unknown', known: false, rawBytes: bytes.slice() };
  }
  var fields = def.fields.map(function(f) {
    var raw = readRaw(bytes, f.startByte, f.length, f.signed);
    var value = Math.round((raw * f.factor + f.offset) * 10000) / 10000;
    return {
      name: f.name,
      raw: raw,
      rawHex: toHex(raw, f.length),
      value: value,
      unit: f.unit,
      inRange: value >= f.min && value <= f.max,
    };
  });
  return { id: id, name: def.name, known: true, fields: fields };
}
```

- [ ] **Step 2: Commit**
```bash
git add decoder.js
git commit -m "feat: add decodeFrame and little-endian read helpers"
```

---

### Task 4: Add `parseLines()` to `decoder.js`

**Files:**
- Modify: `decoder.js`

- [ ] **Step 1: Append `parseLines()` to the bottom of `decoder.js`**

```js
// Appended to decoder.js

// Parses a multi-line text block into raw frame records.
//
// Accepted formats:
//   Candump: "(3162.556) TX1 1872 [8] B8 11 A8 0C F8 00 F8 00"
//   Numbered: "20   (3162.556) RX0 1871 [8] 01 00 01 00 00 00 00 00"
//   Single frame: "1872 B8 11 A8 0C F8 00 F8 00"
//
// Returns: { frames: [{timestamp, id, bytes}], skipped: number }
function parseLines(text) {
  var lines = text.split('\n');
  var frames = [];
  var skipped = 0;

  // Optional leading line-number, then candump timestamp and payload
  var CANDUMP_RE = /^\s*\d*\s*\(?([\d.]+)\)?\s+\w+\s+([0-9A-Fa-f]+)\s+\[\d+\]\s+((?:[0-9A-Fa-f]{2}\s*)+)$/;
  // Single-frame shorthand: hex ID followed by hex bytes (no timestamp)
  var SINGLE_RE  = /^\s*([0-9A-Fa-f]{3,8})\s+((?:[0-9A-Fa-f]{2}\s*){1,8})$/;

  lines.forEach(function(line) {
    line = line.trim();
    if (!line) return;

    var m = CANDUMP_RE.exec(line);
    if (m) {
      frames.push({
        timestamp: parseFloat(m[1]),
        id: parseInt(m[2], 16),
        bytes: m[3].trim().split(/\s+/).map(function(b) { return parseInt(b, 16); }),
      });
      return;
    }

    m = SINGLE_RE.exec(line);
    if (m) {
      frames.push({
        timestamp: 0,
        id: parseInt(m[1], 16),
        bytes: m[2].trim().split(/\s+/).map(function(b) { return parseInt(b, 16); }),
      });
      return;
    }

    skipped++;
  });

  return { frames: frames, skipped: skipped };
}
```

- [ ] **Step 2: Commit**
```bash
git add decoder.js
git commit -m "feat: add parseLines supporting candump log and single-frame formats"
```

---

### Task 5: Create `encoder.js`

**Files:**
- Create: `encoder.js`

- [ ] **Step 1: Create `encoder.js`**

```js
// encoder.js
// Depends on: FRAMES (protocol.js, must be loaded first)

function writeUInt8(bytes, offset, value) {
  bytes[offset] = ((value >>> 0) & 0xFF);
}

function writeUInt16LE(bytes, offset, value) {
  value = (value >>> 0) & 0xFFFF;
  bytes[offset]     = value & 0xFF;
  bytes[offset + 1] = (value >> 8) & 0xFF;
}

function writeInt16LE(bytes, offset, value) {
  // Convert to unsigned two's complement if negative
  if (value < 0) value = value + 0x10000;
  writeUInt16LE(bytes, offset, value);
}

function writeUInt32LE(bytes, offset, value) {
  value = value >>> 0;
  bytes[offset]     = value & 0xFF;
  bytes[offset + 1] = (value >> 8)  & 0xFF;
  bytes[offset + 2] = (value >> 16) & 0xFF;
  bytes[offset + 3] = (value >> 24) & 0xFF;
}

// Encodes physical field values for a frame into raw CAN bytes.
//
// id: integer CAN ID (e.g. 0x1872)
// values: object of { fieldName: physicalValue } (in physical units, e.g. volts)
//         Missing fields default to 0. Non-numeric input treated as 0.
//
// Returns: { bytes: number[8], candump: string, rawHex: string }
// Returns null for unknown frame ID.
function encodeFrame(id, values) {
  var def = FRAMES[id];
  if (!def) return null;

  var bytes = [0, 0, 0, 0, 0, 0, 0, 0];

  def.fields.forEach(function(f) {
    var physical = (values[f.name] !== undefined && values[f.name] !== '') ? Number(values[f.name]) : 0;
    if (isNaN(physical)) physical = 0;
    var raw = Math.round((physical - f.offset) / f.factor);

    if (f.length === 1) {
      writeUInt8(bytes, f.startByte, raw);
    } else if (f.length === 2) {
      if (f.signed) {
        writeInt16LE(bytes, f.startByte, raw);
      } else {
        writeUInt16LE(bytes, f.startByte, raw);
      }
    } else if (f.length === 4) {
      writeUInt32LE(bytes, f.startByte, raw);
    }
  });

  var hexBytes = bytes.map(function(b) {
    return b.toString(16).toUpperCase().padStart(2, '0');
  });
  var idHex = id.toString(16).toUpperCase();

  return {
    bytes: bytes,
    candump: idHex + ' [8] ' + hexBytes.join(' '),
    rawHex: hexBytes.join(''),
  };
}
```

- [ ] **Step 2: Commit**
```bash
git add encoder.js
git commit -m "feat: add encodeFrame and little-endian write helpers"
```

---

### Task 6: Create `test.js` — all assertions

**Files:**
- Create: `test.js`

- [ ] **Step 1: Create `test.js`**

```js
// test.js
// Activated by loading index.html?test=1
// Depends on: FRAMES, decodeFrame, parseLines, encodeFrame (all loaded before this script)

function runTests() {
  var pass = 0, fail = 0;

  function assert(label, actual, expected) {
    if (Math.abs(actual - expected) < 0.001) {
      console.log('%cPASS%c ' + label + ' = ' + actual, 'color:green', 'color:inherit');
      pass++;
    } else {
      console.error('FAIL: ' + label + ' — expected ' + expected + ', got ' + actual);
      fail++;
    }
  }

  function assertEq(label, actual, expected) {
    if (actual === expected) {
      console.log('%cPASS%c ' + label, 'color:green', 'color:inherit');
      pass++;
    } else {
      console.error('FAIL: ' + label + ' — expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
      fail++;
    }
  }

  // ── decodeFrame: 0x1872 BMS_Limits ──────────────────────────────────────────
  var r72 = decodeFrame(0x1872, [0xB8, 0x11, 0xA8, 0x0C, 0xF8, 0x00, 0xF8, 0x00]);
  assertEq('1872 known',              r72.known,           true);
  assertEq('1872 name',               r72.name,            'BMS_Limits');
  assert  ('1872 slave_voltage_max',  r72.fields[0].value, 453.6);
  assert  ('1872 slave_voltage_min',  r72.fields[1].value, 324.0);
  assert  ('1872 max_charge_rate',    r72.fields[2].value, 24.8);
  assert  ('1872 max_discharge_rate', r72.fields[3].value, 24.8);
  assertEq('1872 rawHex field0',      r72.fields[0].rawHex, '0x11B8');

  // ── decodeFrame: 0x1873 BMS_PackData (signed current) ───────────────────────
  var r73 = decodeFrame(0x1873, [0xBA, 0x0F, 0xF1, 0xFF, 0x2F, 0x00, 0x01, 0x00]);
  assert('1873 master_voltage', r73.fields[0].value, 402.6);
  assert('1873 current_sensor', r73.fields[1].value, -1.5);
  assert('1873 soc',            r73.fields[2].value, 47);
  assert('1873 kwh_remaining',  r73.fields[3].value, 0.01);

  // ── decodeFrame: 0x1874 BMS_CellData ────────────────────────────────────────
  var r74 = decodeFrame(0x1874, [0x04, 0x01, 0xFA, 0x00, 0x68, 0x10, 0x7E, 0x0E]);
  assert('1874 cell_temp_max',  r74.fields[0].value, 26.0);
  assert('1874 cell_temp_min',  r74.fields[1].value, 25.0);
  assert('1874 cell_volts_max', r74.fields[2].value, 4200);
  assert('1874 cell_volts_min', r74.fields[3].value, 3710);

  // ── decodeFrame: 0x187E BMS_Ultra (32-bit field) ────────────────────────────
  var r7E = decodeFrame(0x187E, [0x27, 0x00, 0x00, 0x00, 0x63, 0x2F, 0x00, 0x00]);
  assert('187E total_capacity_wh', r7E.fields[0].value, 39);
  assert('187E soh',               r7E.fields[1].value, 99);
  assert('187E soc',               r7E.fields[2].value, 47);

  // ── decodeFrame: unknown ID ──────────────────────────────────────────────────
  var rUnk = decodeFrame(0x3C2, [0x80, 0x00, 0x06, 0x1C, 0xC8, 0x00, 0x00, 0x00]);
  assertEq('unknown known=false', rUnk.known, false);
  assertEq('unknown name',        rUnk.name,  'Unknown');

  // ── parseLines: candump format ───────────────────────────────────────────────
  var p1 = parseLines('(3162.556) TX1 1872 [8] B8 11 A8 0C F8 00 F8 00');
  assertEq('candump frame count',   p1.frames.length,    1);
  assert  ('candump timestamp',     p1.frames[0].timestamp, 3162.556);
  assertEq('candump id',            p1.frames[0].id,     0x1872);
  assertEq('candump byte[0]',       p1.frames[0].bytes[0], 0xB8);
  assertEq('candump skipped',       p1.skipped,          0);

  // ── parseLines: line-number prefix ──────────────────────────────────────────
  var p2 = parseLines('20   (3162.556) RX0 1871 [8] 01 00 01 00 00 00 00 00');
  assertEq('linenum frame count', p2.frames.length, 1);
  assertEq('linenum id',          p2.frames[0].id,  0x1871);

  // ── parseLines: single-frame shorthand ──────────────────────────────────────
  var p3 = parseLines('1872 B8 11 A8 0C F8 00 F8 00');
  assertEq('single-frame count',   p3.frames.length,  1);
  assertEq('single-frame id',      p3.frames[0].id,   0x1872);
  assertEq('single-frame byte[1]', p3.frames[0].bytes[1], 0x11);

  // ── parseLines: skipped lines ────────────────────────────────────────────────
  var p4 = parseLines('not a valid line\n(3162.556) TX1 1872 [8] B8 11 A8 0C F8 00 F8 00\n');
  assertEq('skipped count',       p4.skipped,         1);
  assertEq('valid after skipped', p4.frames.length,   1);

  // ── parseLines: multi-frame log ─────────────────────────────────────────────
  var multiLog = [
    '(3162.556) TX1 1872 [8] B8 11 A8 0C F8 00 F8 00',
    '(3162.557) TX1 1873 [8] BA 0F F1 FF 2F 00 01 00',
    '(3162.558) TX1 1872 [8] B8 11 A8 0C F8 00 F8 00',
  ].join('\n');
  var p5 = parseLines(multiLog);
  assertEq('multi-frame total frames', p5.frames.length, 3);
  assertEq('multi-frame id[0]', p5.frames[0].id, 0x1872);
  assertEq('multi-frame id[1]', p5.frames[1].id, 0x1873);
  assertEq('multi-frame id[2]', p5.frames[2].id, 0x1872);

  // ── encodeFrame round-trip: 0x1872 ──────────────────────────────────────────
  var enc72 = encodeFrame(0x1872, {
    slave_voltage_max: 453.6, slave_voltage_min: 324.0,
    max_charge_rate: 24.8,   max_discharge_rate: 24.8,
  });
  var dec72rt = decodeFrame(0x1872, enc72.bytes);
  assert  ('roundtrip 1872 slave_voltage_max', dec72rt.fields[0].value, 453.6);
  assert  ('roundtrip 1872 slave_voltage_min', dec72rt.fields[1].value, 324.0);
  assertEq('roundtrip 1872 rawHex', enc72.rawHex, 'B811A80CF800F800');

  // ── encodeFrame round-trip: 0x1873 signed current ───────────────────────────
  var enc73 = encodeFrame(0x1873, {
    master_voltage: 402.6, current_sensor: -1.5, soc: 47, kwh_remaining: 0.01,
  });
  var dec73rt = decodeFrame(0x1873, enc73.bytes);
  assert('roundtrip 1873 current_sensor', dec73rt.fields[1].value, -1.5);
  assert('roundtrip 1873 master_voltage', dec73rt.fields[0].value, 402.6);

  // ── encodeFrame: unknown ID returns null ────────────────────────────────────
  assertEq('encode unknown returns null', encodeFrame(0x9999, {}), null);

  console.log('\n──────────────────────────────────');
  console.log(pass + ' passed, ' + fail + ' failed');
  if (fail > 0) {
    console.error('⚠ TESTS FAILED');
    document.title = '⚠ TESTS FAILED';
  } else {
    console.log('✓ All tests passed');
    document.title = '✓ Tests passed';
  }
}

if (new URLSearchParams(window.location.search).get('test') === '1') {
  window.addEventListener('DOMContentLoaded', runTests);
}
```

- [ ] **Step 2: Commit**
```bash
git add test.js
git commit -m "test: add in-browser test suite for decode, encode, and parseLines"
```

---

### Task 7: Create `style.css`

**Files:**
- Create: `style.css`

- [ ] **Step 1: Create `style.css`**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:      #1a1a1a;
  --surface: #242424;
  --border:  #3a3a3a;
  --text:    #e0e0e0;
  --muted:   #777;
  --accent:  #00cc66;
  --warn:    #ff6b6b;
  --font:    'Courier New', Courier, monospace;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-size: 14px;
  min-height: 100vh;
}

/* ── Header ─────────────────────────────────────── */
header {
  padding: 14px 24px;
  border-bottom: 1px solid var(--border);
}
header h1  { font-size: 15px; color: var(--accent); }
header p   { color: var(--muted); font-size: 11px; margin-top: 4px; }

/* ── Tabs ────────────────────────────────────────── */
.tabs { display: flex; border-bottom: 1px solid var(--border); }
.tab-btn {
  padding: 10px 24px;
  cursor: pointer;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--muted);
  font-family: var(--font);
  font-size: 13px;
}
.tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); }
.tab-btn:hover:not(.active) { color: var(--text); }

.tab-panel          { display: none; padding: 20px 24px; }
.tab-panel.active   { display: block; }

/* ── Decoder input ──────────────────────────────── */
.input-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }

textarea {
  width: 100%;
  height: 140px;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  font-family: var(--font);
  font-size: 12px;
  padding: 8px;
  resize: vertical;
}
textarea:focus { outline: none; border-color: var(--accent); }

.controls {
  display: flex;
  gap: 20px;
  align-items: center;
  margin: 10px 0 16px;
  font-size: 12px;
  color: var(--muted);
}
.controls label { display: flex; align-items: center; gap: 6px; cursor: pointer; }

/* ── Buttons ─────────────────────────────────────── */
button {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  font-family: var(--font);
  font-size: 12px;
  padding: 5px 12px;
  cursor: pointer;
}
button:hover { border-color: var(--accent); color: var(--accent); }

.file-btn { position: relative; overflow: hidden; }
.file-btn input[type=file] { position: absolute; inset: 0; opacity: 0; cursor: pointer; }

/* ── Warnings ────────────────────────────────────── */
.warn {
  color: var(--warn);
  font-size: 12px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.warn button {
  color: var(--muted);
  border: none;
  background: none;
  padding: 0 4px;
  font-size: 11px;
}

/* ── Frame sections ──────────────────────────────── */
.frame-section { margin-bottom: 20px; }

.frame-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 10px;
  cursor: pointer;
  user-select: none;
}
.frame-header h3   { font-size: 13px; color: var(--accent); }
.frame-header .caret { color: var(--muted); font-size: 10px; }
.frame-body.collapsed { display: none; }

/* ── Tables ──────────────────────────────────────── */
table              { width: 100%; border-collapse: collapse; font-size: 12px; }
th                 { text-align: left; color: var(--muted); padding: 3px 8px; border-bottom: 1px solid var(--border); }
td                 { padding: 4px 8px; border-bottom: 1px solid var(--border); }
.out-of-range      { color: var(--warn); }

/* ── uPlot charts ────────────────────────────────── */
.plot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}
.plot-wrap {
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 8px;
  overflow: hidden;
}
/* Override uPlot defaults for dark theme */
.plot-wrap .u-wrap   { background: transparent; }
.plot-wrap .u-legend { display: none; }

/* ── Encoder ─────────────────────────────────────── */
.encoder-top        { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; font-size: 12px; }
.encoder-top label  { color: var(--muted); }

select {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  font-family: var(--font);
  font-size: 13px;
  padding: 5px 8px;
}
select:focus { outline: none; border-color: var(--accent); }

.encoder-form {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.field-row              { display: flex; flex-direction: column; gap: 4px; }
.field-row label        { font-size: 11px; color: var(--muted); }
.field-row input[type=number] {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  font-family: var(--font);
  font-size: 13px;
  padding: 5px 8px;
  width: 100%;
}
.field-row input[type=number]:focus { outline: none; border-color: var(--accent); }
.field-row input.out-of-range       { border-color: var(--warn); }

.output-block {
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 12px;
  max-width: 560px;
}
.output-label { font-size: 11px; color: var(--muted); margin-top: 8px; }
.output-label:first-child { margin-top: 0; }
.output-value { color: var(--accent); word-break: break-all; margin-top: 2px; }
.copy-row     { display: flex; gap: 8px; align-items: center; margin-top: 10px; }
#copiedMsg    { color: var(--accent); font-size: 11px; }
```

- [ ] **Step 2: Commit**
```bash
git add style.css
git commit -m "feat: add dark monospace stylesheet"
```

---

### Task 8: Create `index.html` — page shell

**Files:**
- Create: `index.html`

- [ ] **Step 1: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Solax CAN Decoder</title>
  <link rel="stylesheet" href="style.css">
  <link rel="stylesheet" href="https://unpkg.com/uplot@1.6.31/dist/uPlot.min.css">
</head>
<body>

<header>
  <h1>Solax CAN Bus Decoder / Encoder</h1>
  <p>Solax V1 Hybrid / Fit / AC &middot; 500k baud &middot; Extended ID &middot; Little-endian</p>
</header>

<div class="tabs">
  <button class="tab-btn active" data-tab="decoder">Decoder</button>
  <button class="tab-btn"        data-tab="encoder">Encoder</button>
</div>

<!-- ── Decoder tab ──────────────────────────────────────── -->
<div id="decoder" class="tab-panel active">
  <div class="input-row">
    <label class="file-btn">
      Import file
      <input type="file" id="fileInput" accept=".txt,.log">
    </label>
  </div>

  <textarea id="logInput" spellcheck="false"
    placeholder="Paste candump log or single frame, e.g.:
(3162.556) TX1 1872 [8] B8 11 A8 0C F8 00 F8 00
1872 B8 11 A8 0C F8 00 F8 00"></textarea>

  <div class="controls">
    <label>
      <input type="checkbox" id="knownOnly" checked>
      Show known frames only
    </label>
  </div>

  <div id="skipWarn" class="warn" style="display:none">
    <span id="skipMsg"></span>
    <button id="skipDismiss" title="Dismiss">&#x2715;</button>
  </div>

  <div id="decoderOutput"></div>
</div>

<!-- ── Encoder tab ──────────────────────────────────────── -->
<div id="encoder" class="tab-panel">
  <div class="encoder-top">
    <label for="frameSelect">Frame:</label>
    <select id="frameSelect"></select>
  </div>

  <div id="encoderForm" class="encoder-form"></div>

  <div id="encoderOutput" class="output-block" style="display:none">
    <div class="output-label">Candump</div>
    <div class="output-value" id="outCandump"></div>
    <div class="output-label">Raw hex</div>
    <div class="output-value" id="outRawHex"></div>
    <div class="copy-row">
      <button id="copyBtn">Copy raw hex</button>
      <span id="copiedMsg" style="display:none">Copied!</span>
    </div>
  </div>
</div>

<script src="https://unpkg.com/uplot@1.6.31/dist/uPlot.iife.min.js"></script>
<script src="protocol.js"></script>
<script src="decoder.js"></script>
<script src="encoder.js"></script>
<script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**
```bash
git add index.html
git commit -m "feat: add HTML shell with decoder and encoder tabs"
```

---

### Task 9: Create `app.js` — tab switching and decoder UI

**Files:**
- Create: `app.js`

- [ ] **Step 1: Create `app.js` with tab switching, decoder rendering, and file import**

```js
// app.js
// Depends on: FRAMES (protocol.js), decodeFrame, parseLines (decoder.js),
//             encodeFrame (encoder.js), uPlot (CDN global)

// ── Tab switching ─────────────────────────────────────────────────────────────

document.querySelectorAll('.tab-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var tab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
    document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
    btn.classList.add('active');
    document.getElementById(tab).classList.add('active');
  });
});

// ── Decoder: live update on input ────────────────────────────────────────────

document.getElementById('logInput').addEventListener('input', renderDecoder);
document.getElementById('knownOnly').addEventListener('change', renderDecoder);

document.getElementById('fileInput').addEventListener('change', function(e) {
  var file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    alert('File is larger than 5 MB. Please use a smaller log excerpt.');
    e.target.value = '';
    return;
  }
  var reader = new FileReader();
  reader.onload = function(ev) {
    document.getElementById('logInput').value = ev.target.result;
    renderDecoder();
  };
  reader.readAsText(file);
});

document.getElementById('skipDismiss').addEventListener('click', function() {
  document.getElementById('skipWarn').style.display = 'none';
});

// ── Decoder: rendering ────────────────────────────────────────────────────────

function idToHex(id) {
  return '0x' + id.toString(16).toUpperCase().padStart(4, '0');
}

function renderTable(decoded) {
  var table = document.createElement('table');
  var header = document.createElement('tr');
  header.innerHTML = '<th>Field</th><th>Raw</th><th>Decoded</th>';
  table.appendChild(header);
  decoded.fields.forEach(function(f) {
    var tr = document.createElement('tr');
    var valueStr = f.value + (f.unit ? '\u00a0' + f.unit : '');
    tr.innerHTML =
      '<td>' + f.name + '</td>' +
      '<td>' + f.rawHex + '</td>' +
      '<td class="' + (f.inRange ? '' : 'out-of-range') + '">' + valueStr + '</td>';
    table.appendChild(tr);
  });
  return table;
}

function renderUnknownTable(rawBytes) {
  var table = document.createElement('table');
  var hdr = '<tr><th>Byte</th>';
  var vals = '<tr><td>Hex</td>';
  for (var i = 0; i < rawBytes.length; i++) {
    hdr  += '<th>' + i + '</th>';
    vals += '<td>' + rawBytes[i].toString(16).toUpperCase().padStart(2,'0') + '</td>';
  }
  table.innerHTML = hdr + '</tr>' + vals + '</tr>';
  return table;
}

function makeSection(idHex, title, count) {
  var section = document.createElement('div');
  section.className = 'frame-section';

  var header = document.createElement('div');
  header.className = 'frame-header';
  header.innerHTML =
    '<h3>' + idHex + ' \u2014 ' + title +
    ' <span style="color:var(--muted);font-size:11px">\xd7' + count + '</span></h3>' +
    '<span class="caret">\u25bc</span>';

  var body = document.createElement('div');
  body.className = 'frame-body';

  header.addEventListener('click', function() {
    body.classList.toggle('collapsed');
    header.querySelector('.caret').textContent = body.classList.contains('collapsed') ? '\u25b6' : '\u25bc';
  });

  section.appendChild(header);
  section.appendChild(body);
  return { section: section, body: body };
}

function renderTimeSeries(container, fieldName, unit, timestamps, values) {
  var wrap = document.createElement('div');
  wrap.className = 'plot-wrap';
  container.appendChild(wrap);

  var label = fieldName + (unit ? ' (' + unit + ')' : '');
  var w = Math.max(wrap.offsetWidth || 0, 300);

  var opts = {
    width:  w,
    height: 160,
    scales: { x: { time: false } },
    series: [
      {},
      { label: label, stroke: '#00cc66', width: 2, fill: 'rgba(0,204,102,0.08)' },
    ],
    axes: [
      { stroke: '#666', ticks: { stroke: '#555' }, grid: { stroke: '#2a2a2a' }, label: 's' },
      { stroke: '#666', ticks: { stroke: '#555' }, grid: { stroke: '#2a2a2a' }, label: unit || '' },
    ],
    cursor: { drag: { setScale: false } },
    legend: { show: false },
  };

  new uPlot(opts, [timestamps, values], wrap);
}

function renderDecoder() {
  var text      = document.getElementById('logInput').value;
  var knownOnly = document.getElementById('knownOnly').checked;
  var output    = document.getElementById('decoderOutput');

  output.innerHTML = '';

  if (!text.trim()) {
    document.getElementById('skipWarn').style.display = 'none';
    return;
  }

  var result = parseLines(text);

  if (result.skipped > 0) {
    document.getElementById('skipMsg').textContent =
      result.skipped + ' line' + (result.skipped !== 1 ? 's' : '') + ' skipped \u2014 unrecognised format';
    document.getElementById('skipWarn').style.display = '';
  } else {
    document.getElementById('skipWarn').style.display = 'none';
  }

  // Group frames by CAN ID, preserving first-seen order
  var order  = [];
  var groups = {};
  result.frames.forEach(function(f) {
    if (!groups[f.id]) { groups[f.id] = []; order.push(f.id); }
    groups[f.id].push(f);
  });

  order.forEach(function(id) {
    var group   = groups[id];
    var decoded = group.map(function(f) {
      var d = decodeFrame(id, f.bytes);
      d.timestamp = f.timestamp;
      return d;
    });
    var first = decoded[0];

    if (!first.known && knownOnly) return;

    var s = makeSection(idToHex(id), first.name, group.length);

    if (!first.known) {
      s.body.appendChild(renderUnknownTable(first.rawBytes));
    } else if (group.length === 1) {
      s.body.appendChild(renderTable(first));
    } else {
      // Multiple occurrences → uPlot per field
      var timestamps = decoded.map(function(d) { return d.timestamp; });
      var grid = document.createElement('div');
      grid.className = 'plot-grid';
      s.body.appendChild(grid);

      var fieldDefs = FRAMES[id].fields;
      fieldDefs.forEach(function(fieldDef, fi) {
        var values = decoded.map(function(d) { return d.fields[fi].value; });
        renderTimeSeries(grid, fieldDef.name, fieldDef.unit, timestamps, values);
      });
    }

    output.appendChild(s.section);
  });
}
```

- [ ] **Step 2: Commit**
```bash
git add app.js
git commit -m "feat: wire decoder UI — file import, live rendering, uPlot time series"
```

---

### Task 10: Add encoder UI to `app.js`

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Append encoder UI code to the bottom of `app.js`**

```js
// Appended to app.js — encoder UI

// ── Encoder: populate frame dropdown ─────────────────────────────────────────

var frameSelect = document.getElementById('frameSelect');
Object.keys(FRAMES).forEach(function(id) {
  var idInt  = parseInt(id);
  var idHex  = '0x' + idInt.toString(16).toUpperCase().padStart(4, '0');
  var option = document.createElement('option');
  option.value       = id;
  option.textContent = idHex + ' — ' + FRAMES[id].name;
  frameSelect.appendChild(option);
});

frameSelect.addEventListener('change', buildEncoderForm);

function buildEncoderForm() {
  var id  = parseInt(frameSelect.value);
  var def = FRAMES[id];
  var form = document.getElementById('encoderForm');
  form.innerHTML = '';

  if (!def) return;

  def.fields.forEach(function(f) {
    var row   = document.createElement('div');
    row.className = 'field-row';

    var label = document.createElement('label');
    label.setAttribute('for', 'enc_' + f.name);
    label.textContent = f.name + (f.unit ? ' (' + f.unit + ')' : '') +
                        '  [' + f.min + ' … ' + f.max + ']';

    var input = document.createElement('input');
    input.type = 'number';
    input.id   = 'enc_' + f.name;
    input.step = f.factor < 1 ? f.factor.toString() : '1';
    input.placeholder = String(f.min);
    input.dataset.field = f.name;

    input.addEventListener('input', function() {
      var val = parseFloat(input.value);
      if (!isNaN(val) && (val < f.min || val > f.max)) {
        input.classList.add('out-of-range');
        input.title = 'Out of range: valid range is ' + f.min + ' to ' + f.max;
      } else {
        input.classList.remove('out-of-range');
        input.title = '';
      }
      updateEncoderOutput();
    });

    row.appendChild(label);
    row.appendChild(input);
    form.appendChild(row);
  });

  updateEncoderOutput();
}

function updateEncoderOutput() {
  var id  = parseInt(frameSelect.value);
  var def = FRAMES[id];
  if (!def) return;

  var values = {};
  def.fields.forEach(function(f) {
    var input = document.getElementById('enc_' + f.name);
    values[f.name] = input ? input.value : '';
  });

  var result = encodeFrame(id, values);
  if (!result) return;

  document.getElementById('outCandump').textContent = result.candump;
  document.getElementById('outRawHex').textContent  = result.rawHex;
  document.getElementById('encoderOutput').style.display = '';
}

// ── Encoder: copy button ──────────────────────────────────────────────────────

document.getElementById('copyBtn').addEventListener('click', function() {
  var hex = document.getElementById('outRawHex').textContent;
  if (!hex) return;
  navigator.clipboard.writeText(hex).then(function() {
    var msg = document.getElementById('copiedMsg');
    msg.style.display = '';
    setTimeout(function() { msg.style.display = 'none'; }, 1500);
  });
});

// ── Init: build encoder form for first frame ──────────────────────────────────
buildEncoderForm();
```

- [ ] **Step 2: Commit**
```bash
git add app.js
git commit -m "feat: wire encoder UI — frame dropdown, live hex output, copy button"
```

---

### Task 11: Final wiring — load `test.js` conditionally in `index.html`

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add conditional test.js loading before closing `</body>` in `index.html`**

Find the line `<script src="app.js"></script>` and add the block below it:

```html
  <script src="app.js"></script>
  <script>
    // Load test suite only when ?test=1 is in the URL
    if (new URLSearchParams(location.search).get('test') === '1') {
      var s = document.createElement('script');
      s.src = 'test.js';
      document.head.appendChild(s);
    }
  </script>
```

- [ ] **Step 2: Commit**
```bash
git add index.html
git commit -m "feat: conditionally load test.js via ?test=1"
```

---

### Task 12: Push to GitHub and verify

**Files:** none

- [ ] **Step 1: Push all commits to origin**
```bash
git push origin main
```

- [ ] **Step 2: Wait ~60 seconds, then open the Pages URL**
```bash
open https://<username>.github.io/solax-can-decoder
```
Expected: page loads with dark header "Solax CAN Bus Decoder / Encoder".

- [ ] **Step 3: Smoke-test the decoder**

Paste the following into the textarea and confirm a decoded table appears for 0x1872:
```
(3162.556) TX1 1872 [8] B8 11 A8 0C F8 00 F8 00
```
Expected row: `slave_voltage_max | 0x11B8 | 453.6 V`

- [ ] **Step 4: Smoke-test time series**

Paste the multi-frame excerpt and confirm uPlot charts render for 0x1872:
```
(3162.556) TX1 1872 [8] B8 11 A8 0C F8 00 F8 00
(3162.656) TX1 1872 [8] B8 11 A8 0C F8 00 F8 00
(3162.756) TX1 1872 [8] B9 11 A8 0C F8 00 F8 00
```

- [ ] **Step 5: Smoke-test the encoder**

Select `0x1872 — BMS_Limits`, enter `453.6` for `slave_voltage_max`.
Expected raw hex output: starts with `B811`

- [ ] **Step 6: Run the test suite**
```
https://<username>.github.io/solax-can-decoder?test=1
```
Open browser console. Expected: all assertions `PASS`, final line `N passed, 0 failed`.

- [ ] **Step 7: Test file import**

Import `canlog_04-41-04.txt`. Confirm known frames (0x1872–0x187E) render as time series and unknown frames (0x3C2) are hidden by default. Toggle "Show known frames only" off and confirm 0x3C2 appears as an unknown frame section.
