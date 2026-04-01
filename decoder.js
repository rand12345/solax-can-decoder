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
