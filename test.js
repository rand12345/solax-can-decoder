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
