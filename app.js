(function () {
  const M = window.VMidi;
  const OPEN = M.OPEN, MAXO = M.MAXO;
  const SN = ['G', 'D', 'A', 'E'];
  const NN = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const nname = (m) => NN[m % 12] + (Math.floor(m / 12) - 1);
  const FING = ['0', '1', '1', '2', '2', '3', '3', '4'];
  const fingOf = (o) => (o < FING.length ? FING[o] : '↑');
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const $ = (id) => document.getElementById(id);

  // ---------- Lagu bawaan ----------
  const q = (arr) => arr.map(([m, b], i) => ({ midi: m, b }));
  function seq(list, bpm) {
    let t = 0; const spb = 60 / bpm;
    return list.map(([m, b]) => { const n = { t, d: b * spb, midi: m }; t += b * spb; return n; });
  }
  const SONGS = {
    'Twinkle Twinkle': () => seq([[62,1],[62,1],[69,1],[69,1],[71,1],[71,1],[69,2],[67,1],[67,1],[66,1],[66,1],[64,1],[64,1],[62,2],[69,1],[69,1],[67,1],[67,1],[66,1],[66,1],[64,2],[69,1],[69,1],[67,1],[67,1],[66,1],[66,1],[64,2],[62,1],[62,1],[69,1],[69,1],[71,1],[71,1],[69,2],[67,1],[67,1],[66,1],[66,1],[64,1],[64,1],[62,2]], 100),
    'Ode to Joy': () => seq([[66,1],[66,1],[67,1],[69,1],[69,1],[67,1],[66,1],[64,1],[62,1],[62,1],[64,1],[66,1],[66,1.5],[64,.5],[64,2],[66,1],[66,1],[67,1],[69,1],[69,1],[67,1],[66,1],[64,1],[62,1],[62,1],[64,1],[66,1],[64,1.5],[62,.5],[62,2]], 110),
    'Tangga nada D mayor': () => seq([62,64,66,67,69,71,73,74,73,71,69,67,66,64,62].map((m) => [m, 1]), 100),
    'Latihan senar kosong': () => seq([55,62,69,76,69,62,55].map((m) => [m, 1.5]), 70),
  };

  // ---------- Audio ----------
  let ac, master;
  function initAudio() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    const comp = ac.createDynamicsCompressor();
    master = ac.createGain(); master.gain.value = 0.8;
    master.connect(comp); comp.connect(ac.destination);
  }
  function makeVoice(freq) {
    const t = ac.currentTime;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.05);
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.8; f.frequency.value = Math.min(freq * 6, 7000);
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain();
    o1.type = o2.type = 'sawtooth';
    o1.frequency.value = o2.frequency.value = freq; o2.detune.value = 7;
    lfo.frequency.value = 5.5;
    lg.gain.setValueAtTime(0, t);
    if ($('vib').checked) lg.gain.linearRampToValueAtTime(14, t + 0.7);
    lfo.connect(lg); lg.connect(o1.detune); lg.connect(o2.detune);
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(master);
    o1.start(t); o2.start(t); lfo.start(t);
    return {
      setFreq(fr) { const n = ac.currentTime; o1.frequency.setTargetAtTime(fr, n, 0.03); o2.frequency.setTargetAtTime(fr, n, 0.03); f.frequency.setTargetAtTime(Math.min(fr * 6, 7000), n, 0.03); },
      stop() { const n = ac.currentTime; g.gain.cancelScheduledValues(n); g.gain.setTargetAtTime(0, n, 0.05); o1.stop(n + 0.4); o2.stop(n + 0.4); lfo.stop(n + 0.4); },
    };
  }
  function playTone(midi, dur) {
    initAudio();
    const v = makeVoice(hz(midi));
    setTimeout(() => v.stop(), Math.max(80, dur * 1000));
  }

  // ---------- Board ----------
  const board = $('board');
  const cells = [];
  for (let s = 0; s < 4; s++) {
    cells[s] = [];
    for (let o = 0; o <= MAXO; o++) {
      const c = document.createElement('div');
      c.className = 'cell' + (o === 0 ? ' open' : '') + ([2, 4, 5, 7, 9, 12].includes(o) ? ' mark' : '');
      c.style.setProperty('--s', s); c.style.setProperty('--o', o);
      c.dataset.s = s; c.dataset.o = o;
      c.innerHTML = '<b>' + nname(OPEN[s] + o) + '</b><i>' + (o === 0 ? 'senar ' + SN[s] : 'jari ' + fingOf(o)) + '</i>';
      board.appendChild(c); cells[s][o] = c;
    }
  }
  const cellAt = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest ? el.closest('.cell') : null; };
  const midiOf = (c) => OPEN[+c.dataset.s] + +c.dataset.o;

  const active = new Map();
  board.addEventListener('pointerdown', (e) => {
    e.preventDefault(); initAudio();
    const c = cellAt(e.clientX, e.clientY); if (!c) return;
    const v = makeVoice(hz(midiOf(c)));
    c.classList.add('down'); active.set(e.pointerId, { c, v });
    onPress(c);
  });
  board.addEventListener('pointermove', (e) => {
    const a = active.get(e.pointerId); if (!a) return;
    const c = cellAt(e.clientX, e.clientY); if (!c || c === a.c) return;
    a.c.classList.remove('down');
    if (c.dataset.s === a.c.dataset.s) a.v.setFreq(hz(midiOf(c)));
    else { a.v.stop(); a.v = makeVoice(hz(midiOf(c))); }
    a.c = c; c.classList.add('down');
    onPress(c);
  });
  const up = (e) => { const a = active.get(e.pointerId); if (!a) return; a.v.stop(); a.c.classList.remove('down'); active.delete(e.pointerId); };
  board.addEventListener('pointerup', up); board.addEventListener('pointercancel', up);
  board.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---------- State lagu & mode ----------
  const S = { mode: 'free', notes: [], map: [], i: 0, ok: 0, bad: 0, speed: 0.7, raf: 0, di: 0, t0: 0 };

  function setSong(notes, title, shifted) {
    stopDemo();
    notes = M.toMonophonic(notes);
    const sh = M.foldRange(notes);
    S.notes = notes; S.map = M.mapFingering(notes); S.i = 0; S.ok = 0; S.bad = 0;
    $('hint').textContent = title + ' · ' + notes.length + ' nada' + (sh ? ' · ' + sh + ' nada digeser oktaf agar masuk jangkauan biola' : '');
    render();
  }

  function clearMarks() { board.querySelectorAll('.target,.next,.good,.bad,.playing').forEach((c) => c.classList.remove('target', 'next', 'good', 'bad', 'playing')); }
  function render() {
    clearMarks();
    if (S.mode === 'wait' && S.i < S.map.length) {
      const m = S.map[S.i]; cells[m.s][m.o].classList.add('target');
      if (S.map[S.i + 1]) { const n = S.map[S.i + 1]; cells[n.s][n.o].classList.add('next'); }
      $('stat').innerHTML = 'Senar <b>' + SN[m.s] + '</b> · ' + (m.o === 0 ? 'kosong' : 'jari <b>' + fingOf(m.o) + '</b>') + ' · ✓' + S.ok + ' ✗' + S.bad;
    } else if (S.mode !== 'demo') $('stat').textContent = '';
    renderStrip();
    $('barfill').style.width = (S.notes.length ? (S.i / S.notes.length) * 100 : 0) + '%';
  }
  function renderStrip() {
    const st = $('strip'); st.innerHTML = '';
    const a = Math.max(0, S.i - 2), b = Math.min(S.notes.length, S.i + 14);
    for (let k = a; k < b; k++) {
      const s = document.createElement('span'); s.className = 'chip' + (k === S.i ? ' cur' : '');
      s.textContent = nname(S.notes[k].midi); st.appendChild(s);
    }
  }

  function onPress(c) {
    if (S.mode !== 'wait' || S.i >= S.notes.length) return;
    if (midiOf(c) === S.notes[S.i].midi) {
      S.ok++; S.i++;
      if (S.i >= S.notes.length) return finish();
      render();
    } else {
      S.bad++; c.classList.add('bad'); setTimeout(() => c.classList.remove('bad'), 250);
      $('stat').innerHTML = $('stat').innerHTML.replace(/✓\d+ ✗\d+/, '✓' + S.ok + ' ✗' + S.bad);
    }
  }
  function finish() {
    const acc = Math.round((S.ok / Math.max(1, S.ok + S.bad)) * 100);
    render(); $('barfill').style.width = '100%';
    $('msgT').textContent = 'Selesai! 🎉';
    $('msgP').textContent = 'Akurasi ' + acc + '% (' + S.ok + ' benar, ' + S.bad + ' salah). Coba lagi dengan kecepatan lebih tinggi?';
    $('msg').classList.add('show');
    S.i = 0; S.ok = 0; S.bad = 0; setTimeout(render, 0);
  }
  $('msgOk').onclick = () => $('msg').classList.remove('show');

  // ---------- Demo ----------
  function stopDemo() { cancelAnimationFrame(S.raf); S.raf = 0; if (S.mode === 'demo') { S.mode = 'free'; setModeUI(); } clearMarks(); }
  function startDemo() {
    if (!S.notes.length) return;
    initAudio(); S.di = 0; S.t0 = performance.now();
    const end = S.notes[S.notes.length - 1];
    const loop = (now) => {
      const el = ((now - S.t0) / 1000) * S.speed;
      while (S.di < S.notes.length && S.notes[S.di].t <= el) trigger(S.di++);
      if (S.di >= S.notes.length && el > end.t + end.d + 0.3) { stopDemo(); S.i = 0; render(); return; }
      S.raf = requestAnimationFrame(loop);
    };
    S.raf = requestAnimationFrame(loop);
  }
  function trigger(k) {
    const n = S.notes[k], m = S.map[k], ms = (n.d / S.speed) * 1000;
    playTone(n.midi, (ms / 1000) * 0.95);
    const c = cells[m.s][m.o]; c.classList.add('playing'); setTimeout(() => c.classList.remove('playing'), ms * 0.9);
    S.i = k; renderStrip(); $('barfill').style.width = ((k + 1) / S.notes.length) * 100 + '%';
    $('stat').innerHTML = 'Senar <b>' + SN[m.s] + '</b> · ' + (m.o === 0 ? 'kosong' : 'jari <b>' + fingOf(m.o) + '</b>');
  }

  // ---------- UI ----------
  function setModeUI() {
    $('mFree').classList.toggle('on', S.mode === 'free');
    $('mWait').classList.toggle('on', S.mode === 'wait');
    $('mDemo').classList.toggle('on', S.mode === 'demo');
  }
  function setMode(m) {
    if (S.mode === 'demo') { cancelAnimationFrame(S.raf); }
    S.mode = m; S.i = 0; S.ok = 0; S.bad = 0; setModeUI(); render();
    if (m === 'demo') startDemo();
  }
  $('mFree').onclick = () => setMode('free');
  $('mWait').onclick = () => setMode('wait');
  $('mDemo').onclick = () => (S.mode === 'demo' ? setMode('free') : setMode('demo'));
  $('bReset').onclick = () => setMode(S.mode);
  $('bHear').onclick = () => { if (S.notes[S.i]) playTone(S.notes[S.i].midi, 0.8); };
  $('speed').oninput = (e) => {
    const nv = e.target.value / 100;
    if (S.mode === 'demo') { const el = ((performance.now() - S.t0) / 1000) * S.speed; S.t0 = performance.now() - (el / nv) * 1000; }
    S.speed = nv; $('speedV').textContent = e.target.value + '%';
  };
  S.speed = $('speed').value / 100;

  const sel = $('songSel');
  Object.keys(SONGS).forEach((k) => { const o = document.createElement('option'); o.textContent = k; sel.appendChild(o); });
  sel.onchange = () => { $('trackSel').style.display = 'none'; setSong(SONGS[sel.value](), sel.value); };

  let tracks = [];
  $('file').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      tracks = M.parseMidi(await f.arrayBuffer());
      if (!tracks.length) throw new Error('Tidak ada nada di file ini');
      const ts = $('trackSel'); ts.innerHTML = '';
      tracks.forEach((t, i) => { const o = document.createElement('option'); o.value = i; o.textContent = t.name + ' (' + t.notes.length + ' nada)'; ts.appendChild(o); });
      ts.style.display = ''; ts.value = tracks.indexOf(M.bestTrack(tracks));
      setMode('free');
      setSong(tracks[ts.value].notes.map((n) => ({ ...n })), f.name);
      ts.onchange = () => setSong(tracks[ts.value].notes.map((n) => ({ ...n })), f.name + ' · ' + tracks[ts.value].name);
    } catch (err) { $('hint').textContent = 'Gagal memuat MIDI: ' + err.message; }
    e.target.value = '';
  };

  setSong(SONGS[sel.value](), sel.value);
})();
