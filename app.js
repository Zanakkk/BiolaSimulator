// Shell aplikasi: beranda, pilih instrumen, lagu (bawaan / MIDI / generate).
(function (root) {
  const A = root.VAudio, M = root.VMidi, X = root.VMusic, L = root.Learn;
  const $ = (id) => document.getElementById(id);
  const insts = { violin: root.VViolin, pad: root.VPad };
  let cur = null;

  function seq(list, bpm) {
    let t = 0; const spb = 60 / bpm;
    return list.map(([m, b]) => { const n = { t, d: b * spb, midi: m }; t += b * spb; return n; });
  }
  const SONGS = {
    'Twinkle Twinkle': () => seq([[62,1],[62,1],[69,1],[69,1],[71,1],[71,1],[69,2],[67,1],[67,1],[66,1],[66,1],[64,1],[64,1],[62,2],[69,1],[69,1],[67,1],[67,1],[66,1],[66,1],[64,2],[69,1],[69,1],[67,1],[67,1],[66,1],[66,1],[64,2],[62,1],[62,1],[69,1],[69,1],[71,1],[71,1],[69,2],[67,1],[67,1],[66,1],[66,1],[64,1],[64,1],[62,2]], 100),
    'Ode to Joy': () => seq([[66,1],[66,1],[67,1],[69,1],[69,1],[67,1],[66,1],[64,1],[62,1],[62,1],[64,1],[66,1],[66,1.5],[64,.5],[64,2],[66,1],[66,1],[67,1],[69,1],[69,1],[67,1],[66,1],[64,1],[62,1],[62,1],[64,1],[66,1],[64,1.5],[62,.5],[62,2]], 110),
    'Tangga nada D mayor': () => seq([62, 64, 66, 67, 69, 71, 73, 74, 73, 71, 69, 67, 66, 64, 62].map((m) => [m, 1]), 100),
    'Tangga nada C mayor': () => seq([60, 62, 64, 65, 67, 69, 71, 72, 71, 69, 67, 65, 64, 62, 60].map((m) => [m, 1]), 100),
    'Latihan senar kosong': () => seq([55, 62, 69, 76, 69, 62, 55].map((m) => [m, 1.5]), 70),
  };

  function open(name) {
    A.init();
    if (cur && cur !== name) insts[cur].deactivate();
    cur = name;
    $('home').hidden = true; $('app').hidden = false;
    $('violinView').hidden = name !== 'violin'; $('padView').hidden = name !== 'pad';
    $('tViolin').classList.toggle('on', name === 'violin'); $('tPad').classList.toggle('on', name === 'pad');
    $('bSet').style.display = name === 'pad' ? '' : 'none';
    insts[name].activate();
    L.setInst(insts[name]);
    try { history.replaceState(null, '', '#' + name); } catch (e) { /* abaikan */ }
  }
  function home() {
    if (cur) insts[cur].deactivate();
    L.setMode('free'); cur = null;
    $('app').hidden = true; $('home').hidden = false;
    try { history.replaceState(null, '', location.pathname); } catch (e) { /* abaikan */ }
  }
  $('goViolin').onclick = () => open('violin');
  $('goPad').onclick = () => open('pad');
  $('tViolin').onclick = () => open('violin');
  $('tPad').onclick = () => open('pad');
  $('bHome').onclick = home;

  // Mode belajar
  $('mFree').onclick = () => L.setMode('free');
  $('mWait').onclick = () => L.setMode('wait');
  $('mDemo').onclick = () => (L.mode === 'demo' ? L.setMode('free') : L.setMode('demo'));
  $('bHear').onclick = () => L.hear();
  $('bReset').onclick = () => L.setMode(L.mode);
  $('msgOk').onclick = () => $('msg').classList.remove('show');

  // Sheets
  const sheet = (id, show) => $(id).classList.toggle('show', show);
  $('bSong').onclick = () => sheet('songSheet', true);
  $('bSet').onclick = () => sheet('setSheet', true);
  document.querySelectorAll('.sheet .close').forEach((b) => { b.onclick = () => b.closest('.sheet').classList.remove('show'); });

  // Lagu
  const sel = $('songSel');
  Object.keys(SONGS).forEach((k) => { const o = document.createElement('option'); o.textContent = k; sel.appendChild(o); });
  const loadBuiltin = () => { $('trackSel').style.display = 'none'; L.setSong(SONGS[sel.value](), sel.value); };
  sel.onchange = loadBuiltin;

  let tracks = [];
  $('file').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      tracks = M.parseMidi(await f.arrayBuffer());
      if (!tracks.length) throw new Error('Tidak ada nada di file ini');
      const ts = $('trackSel'); ts.innerHTML = '';
      tracks.forEach((t, i) => { const o = document.createElement('option'); o.value = i; o.textContent = t.name + ' (' + t.notes.length + ' nada)'; ts.appendChild(o); });
      ts.style.display = ''; ts.value = tracks.indexOf(M.bestTrack(tracks));
      const go = () => L.setSong(tracks[ts.value].notes, f.name + ' · ' + tracks[ts.value].name);
      ts.onchange = go; go();
      sheet('songSheet', false);
    } catch (err) { $('hint').textContent = 'Gagal memuat MIDI: ' + err.message; }
    e.target.value = '';
  };

  // Generate nada
  X.NN.forEach((n, i) => { const o = document.createElement('option'); o.value = i; o.textContent = n; $('genRoot').appendChild(o); });
  Object.keys(X.SCALES).filter((k) => k !== 'Kromatik').forEach((k) => { const o = document.createElement('option'); o.textContent = k; $('genScale').appendChild(o); });
  $('genRoot').value = 2;
  function generate() {
    const range = (insts[cur] || insts.violin).range;
    const notes = X.generate({
      root: +$('genRoot').value, scale: $('genScale').value, count: +$('genCount').value, hard: +$('genHard').value,
      lo: range[0], hi: range[1], bpm: 100,
    });
    const nm = 'Generate · ' + X.pcname(+$('genRoot').value) + ' ' + $('genScale').value;
    L.setSong(notes, nm);
    sheet('songSheet', false);
    L.setMode('wait');
  }
  $('bGen').onclick = generate;

  // Kecepatan & vibrato
  $('speed').oninput = (e) => { L.setSpeed(e.target.value / 100); $('speedV').textContent = e.target.value + '%'; };
  L.speed = $('speed').value / 100;
  $('vib').onchange = (e) => { A.state.vib = e.target.checked; };

  loadBuiltin();
  const h = location.hash.replace('#', '');
  if (insts[h]) open(h);
})(this);
