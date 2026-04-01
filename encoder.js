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
