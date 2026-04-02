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
  table.className = 'field-table';
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

function renderStepViewer(container, decoded) {
  var idx = decoded.length - 1;

  var controls = document.createElement('div');
  controls.className = 'step-controls';

  var prevBtn = document.createElement('button');
  prevBtn.textContent = '\u25c4';
  prevBtn.title = 'Previous frame';

  var slider = document.createElement('input');
  slider.type = 'range';
  slider.min = 0;
  slider.max = decoded.length - 1;
  slider.value = idx;

  var nextBtn = document.createElement('button');
  nextBtn.textContent = '\u25ba';
  nextBtn.title = 'Next frame';

  var info = document.createElement('span');
  info.className = 'step-info';

  controls.appendChild(prevBtn);
  controls.appendChild(slider);
  controls.appendChild(nextBtn);
  controls.appendChild(info);
  container.appendChild(controls);

  var tableWrap = document.createElement('div');
  container.appendChild(tableWrap);

  function update() {
    slider.value = idx;
    var d = decoded[idx];
    var ts = d.timestamp ? '\u00a0\u2014\u00a0t\u00a0=\u00a0' + d.timestamp.toFixed(3) + '\u00a0s' : '';
    info.textContent = (idx + 1) + '\u00a0/\u00a0' + decoded.length + ts;
    prevBtn.disabled = (idx === 0);
    nextBtn.disabled = (idx === decoded.length - 1);
    tableWrap.innerHTML = '';
    if (d.known) {
      tableWrap.appendChild(renderTable(d));
    } else {
      tableWrap.appendChild(renderUnknownTable(d.rawBytes));
    }
  }

  prevBtn.addEventListener('click', function() { if (idx > 0) { idx--; update(); } });
  nextBtn.addEventListener('click', function() { if (idx < decoded.length - 1) { idx++; update(); } });
  slider.addEventListener('input', function() { idx = parseInt(slider.value); update(); });

  update();
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

    // If knownOnly, skip groups where no frame decoded successfully
    var anyKnown = decoded.some(function(d) { return d.known; });
    if (!anyKnown && knownOnly) return;

    // Section title from first known frame (or first frame for all-unknown groups)
    var nameFrame = decoded[0];
    for (var ni = 0; ni < decoded.length; ni++) {
      if (decoded[ni].known) { nameFrame = decoded[ni]; break; }
    }

    var s = makeSection(idToHex(id), nameFrame.name, group.length);

    if (group.length === 1) {
      if (decoded[0].known) {
        s.body.appendChild(renderTable(decoded[0]));
      } else {
        s.body.appendChild(renderUnknownTable(decoded[0].rawBytes));
      }
    } else {
      renderStepViewer(s.body, decoded);
    }

    output.appendChild(s.section);
  });
}

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
                        '  [' + f.min + ' \u2026 ' + f.max + ']';

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
