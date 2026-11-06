// Launchpad virtual 8x8 dengan 8 mode: Session, Note, Chrom, Chord, Drum, Step, Fader, Arp.
(function (root) {
  const A = root.VAudio, X = root.VMusic;
  const Clock = A.Clock;
  const $ = (id) => document.getElementById(id);

  const cfg = { mode: 'note', root: 0, scale: 'Mayor', oct: 3, trans: 0, off: 3, choff: 5, inst: 'synth', vel: 100, sustain: false, arpPat: 'up', arpRate: 2, tempo: 120 };
  const MODES = [['session', 'Session'], ['note', 'Note'], ['chrom', 'Chrom'], ['chord', 'Chord'], ['drum', 'Drum'], ['seq', 'Step'], ['fader', 'Fader'], ['arp', 'Arp']];
  const P = { name: 'pad', range: [48, 84], cfg };

  // ---------- DOM ----------
  const grid = $('padgrid');
  const pads = [], tops = [], sides = [];
  (function build() {
    grid.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const b = document.createElement('button');
      b.className = 'fn top'; b.dataset.top = i; b.textContent = MODES[i][1];
      b.style.gridRow = 1; b.style.gridColumn = i + 1;
      grid.appendChild(b); tops.push(b);
    }
    for (let i = 0; i < 8; i++) {
      const r = 7 - i; pads[r] = [];
      for (let c = 0; c < 8; c++) {
        const d = document.createElement('div');
        d.className = 'pad'; d.dataset.r = r; d.dataset.c = c;
        d.style.gridRow = i + 2; d.style.gridColumn = c + 1;
        d.innerHTML = '<span class="lbl"></span>';
        grid.appendChild(d); pads[r][c] = d;
      }
      const s = document.createElement('button');
      s.className = 'fn side'; s.dataset.side = i; s.style.gridRow = i + 2; s.style.gridColumn = 9;
      s.innerHTML = '<span></span>';
      grid.appendChild(s); sides.push(s);
    }
  })();

  // ---------- Teori / layout ----------
  const sc = () => X.SCALES[cfg.scale];
  const degPitch = (k) => { const s = sc(), n = s.length; return 12 * (cfg.oct + 1) + cfg.root + 12 * Math.floor(k / n) + s[((k % n) + n) % n] + cfg.trans; };
  const padPitch = (r, c) => (cfg.mode === 'chrom' ? 12 * (cfg.oct + 1) + cfg.root + c + r * cfg.choff + cfg.trans : degPitch(c + r * cfg.off));
  const pcRel = (p) => (((p - cfg.trans - cfg.root) % 12) + 12) % 12;
  const CH = [[0, 2, 4], [2, 4, 7], [4, 7, 9], [0, 2, 4, 6], [0, 2, 4, 6, 8], [0, 1, 4], [0, 3, 4], [0, 4, 7]];
  const CH_HUE = [200, 260, 320, 20, 50, 120, 160, 0];
  const chordNotes = (r, c) => CH[r].map((d) => degPitch(c + d));

  const hsl = (h, s, l) => 'hsl(' + h + ' ' + s + '% ' + l + '%)';

  // ---------- Drum map (64 pad) ----------
  const DR = [];
  (function () {
    const g0 = [], g1 = [], g2 = [], g3 = [];
    [200, 175, 150, 135, 120, 105, 90, 75].forEach((f, i) => g0.push(['kick', f, 'K' + (i + 1)]));
    [190, 215, 240, 165].forEach((f, i) => g0.push(['snare', f, 'S' + (i + 1)]));
    g0.push(['clap', 0, 'Clap'], ['clap', 1, 'Clap2'], ['rim', 0, 'Rim'], ['snare', 140, 'S5']);
    [0.025, 0.035, 0.05, 0.065, 0.08, 0.1].forEach((d, i) => g1.push(['hat', d, 'H' + (i + 1)]));
    g1.push(['open', 0.25, 'Op1'], ['open', 0.4, 'Op2'], ['crash', 0.9, 'Cr1'], ['crash', 1.5, 'Cr2'], ['ride', 0.5, 'Rd1'], ['ride', 0.9, 'Rd2']);
    [0.02, 0.03, 0.04, 0.055].forEach((d, i) => g1.push(['hat', d, 'Sh' + (i + 1)]));
    [80, 95, 110, 130, 150, 175, 200, 230].forEach((f, i) => g2.push(['tom', f, 'T' + (i + 1)]));
    g2.push(['cow', 1, 'Cow'], ['cow', 1.35, 'Cow2'], ['conga', 200, 'Cg1'], ['conga', 260, 'Cg2'], ['conga', 330, 'Cg3'], ['clave', 2200, 'Clv'], ['clave', 2800, 'Clv2'], ['zap', 900, 'Zap']);
    for (let i = 0; i < 8; i++) g3.push(['bass', 36 + i, 'B' + (i + 1)]);
    [1200, 1600, 2000, 2600, 3200, 900, 700, 500].forEach((f, i) => g3.push(['zap', f, 'Fx' + (i + 1)]));
    const groups = [[g0, 0], [g1, 50], [g2, 210], [g3, 285]];
    for (let r = 0; r < 8; r++) {
      DR[r] = [];
      for (let c = 0; c < 8; c++) {
        const gi = (r >= 4 ? 2 : 0) + (c >= 4 ? 1 : 0); // bawah-kiri g0, bawah-kanan g1, atas-kiri g2, atas-kanan g3
        const idx = (r % 4) * 4 + (c % 4);
        const d = groups[gi][0][idx];
        DR[r][c] = { kind: d[0], p: d[1], label: d[2], hue: groups[gi][1] };
      }
    }
  })();

  // ---------- Suara & voice ----------
  const held = new Map(), sustained = new Set();
  const vel = () => cfg.vel / 127;
  function noteOn(key, m) { held.set(key, A.note(m, { inst: cfg.inst, vel: vel() })); }
  function noteOff(key) {
    const v = held.get(key); if (!v) return;
    held.delete(key);
    if (cfg.sustain) sustained.add(v); else v.stop();
  }
  function releaseSustain() { sustained.forEach((v) => v.stop()); sustained.clear(); }
  function allOff() { held.forEach((v) => v.stop()); held.clear(); releaseSustain(); arpClear(); }

  // ---------- Arpeggiator ----------
  const arp = { list: [], i: 0, timer: 0 };
  function arpStep() {
    if (!arp.list.length) { clearInterval(arp.timer); arp.timer = 0; return; }
    const L = arp.list.slice().sort((a, b) => a - b);
    let m;
    if (cfg.arpPat === 'down') m = L[L.length - 1 - (arp.i % L.length)];
    else if (cfg.arpPat === 'updown') { const sq = L.concat(L.slice(1, -1).reverse()); m = sq[arp.i % sq.length]; }
    else if (cfg.arpPat === 'random') m = L[Math.floor(Math.random() * L.length)];
    else m = L[arp.i % L.length];
    arp.i++;
    A.play(m, (60 / cfg.tempo / cfg.arpRate) * 0.9, { inst: cfg.inst, vel: vel() });
  }
  function arpStart() { if (arp.timer) return; arp.i = 0; arpStep(); arp.timer = setInterval(arpStep, 60000 / cfg.tempo / cfg.arpRate); }
  function arpRestart() { if (arp.timer) { clearInterval(arp.timer); arp.timer = 0; if (arp.list.length) arpStart(); } }
  function arpClear() { arp.list = []; clearInterval(arp.timer); arp.timer = 0; }

  // ---------- Pitch bend ----------
  let bendT = 0, bendCur = 0;
  function bendTo(target) {
    clearInterval(bendT);
    bendT = setInterval(() => {
      bendCur += (target - bendCur) * 0.3;
      if (Math.abs(target - bendCur) < 2) { bendCur = target; clearInterval(bendT); }
      A.setBend(bendCur); setThumb(bendCur);
    }, 16);
  }
  const wheel = $('wheel'), thumb = $('wthumb');
  function setThumb(c) { thumb.style.top = (50 - (c / A.state.bendRange) * 45) + '%'; }
  function wheelMove(e) {
    const r = wheel.getBoundingClientRect();
    const f = Math.max(-1, Math.min(1, -((e.clientY - r.top) / r.height - 0.5) * 2));
    bendCur = f * A.state.bendRange; clearInterval(bendT); A.setBend(bendCur); setThumb(bendCur);
  }
  let wheelOn = false;
  wheel.addEventListener('pointerdown', (e) => { e.preventDefault(); A.init(); wheelOn = true; wheel.setPointerCapture(e.pointerId); wheelMove(e); });
  wheel.addEventListener('pointermove', (e) => { if (wheelOn) wheelMove(e); });
  const wheelUp = () => { if (wheelOn) { wheelOn = false; bendTo(0); } };
  wheel.addEventListener('pointerup', wheelUp); wheel.addEventListener('pointercancel', wheelUp);

  // ---------- Session ----------
  const sess = { playing: Array(8).fill(-1), queue: Array(8).fill(null) };
  const clips = {};
  const TRK_INST = [null, null, null, 'bass', 'pad', 'pluck', 'synth', null];
  const TRK_NAME = ['Kick', 'Snare', 'Hat', 'Bass', 'Chord', 'Arp', 'Lead', 'Perc'];
  const PAT = {
    kick: [[0, 4, 8, 12], [0, 6, 10], [0, 3, 8, 11], [0, 4, 8, 10, 12], [0, 2, 8, 10], [0, 8], [0, 4, 7, 8, 12, 15], [0, 3, 6, 8, 11, 14]],
    snare: [[4, 12], [4, 12, 15], [4, 10, 12], [4, 9, 12, 14], [12], [2, 4, 10, 12], [4, 7, 12], [4, 12, 13, 14, 15]],
    hat: [[0, 2, 4, 6, 8, 10, 12, 14], [2, 6, 10, 14], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], [0, 4, 8, 12], [0, 2, 3, 4, 6, 8, 10, 11, 12, 14], [1, 3, 5, 7, 9, 11, 13, 15], [0, 2, 4, 6, 8, 10, 12, 13, 14, 15], [0, 3, 6, 9, 12, 15]],
    bass: [[0, 4, 8, 12], [0, 3, 6, 8, 11], [0, 2, 4, 8, 10, 12], [0, 6, 8, 14], [0, 2, 3, 8, 10, 11], [0, 4, 6, 8, 12, 14], [0, 8], [0, 1, 4, 6, 8, 9, 12, 14]],
    prog: [[0, 3, 4, 3], [0, 5, 3, 4], [5, 3, 0, 4], [0, 4, 5, 3], [0, 0, 3, 4], [3, 4, 0, 0], [0, 2, 3, 4], [5, 4, 3, 4]],
    lead: [[0, 3, 6, 8, 11, 14], [0, 2, 4, 8, 10, 12], [0, 4, 6, 8, 12], [2, 5, 8, 10, 13], [0, 6, 8, 14], [0, 3, 4, 8, 11, 12], [0, 8, 10, 12], [0, 2, 6, 7, 8, 12]],
    perc: [[2, 6, 10, 14], [3, 7, 11, 15], [0, 5, 10], [4, 12], [1, 4, 7, 10, 13], [2, 3, 10, 11], [6, 14], [0, 3, 6, 9, 12]],
  };
  function makeClip(c, s) {
    const R = X.rng(c * 977 + s * 131 + cfg.root * 7 + cfg.scale.length * 13);
    const st = Array(16).fill(null), n = sc().length;
    const deg = (k, base) => base + cfg.root + 12 * Math.floor(k / n) + sc()[((k % n) + n) % n];
    const pick = (a) => a[s % a.length];
    const prog = pick(PAT.prog);
    switch (c) {
      case 0: pick(PAT.kick).forEach((i) => { st[i] = { drum: ['kick', 130 + Math.floor(R() * 30)] }; }); break;
      case 1: pick(PAT.snare).forEach((i) => { st[i] = { drum: [s % 2 ? 'clap' : 'snare', 200] }; }); break;
      case 2: pick(PAT.hat).forEach((i) => { st[i] = { drum: [i % 8 === 6 && s > 3 ? 'open' : 'hat', i % 4 === 2 ? 0.07 : 0.04] }; }); break;
      case 3: { const walk = [0, 0, 0, 4, 2, 3, 5, -3]; pick(PAT.bass).forEach((i, k) => { const d = k === 0 ? 0 : walk[Math.floor(R() * walk.length)]; st[i] = { notes: [deg(d, 36)], len: 2 }; }); break; }
      case 4: for (let q = 0; q < 4; q++) { const b = prog[q]; st[q * 4] = { notes: [deg(b, 48), deg(b + 2, 48), deg(b + 4, 48)], len: 4 }; } break;
      case 5: { const shape = [[0, 2, 4, 7], [0, 4, 2, 7], [7, 4, 2, 0], [0, 2, 4, 2]][s % 4]; for (let i = 0; i < 16; i++) { const b = prog[(i >> 2) % 4]; st[i] = { notes: [deg(b + shape[i % 4], 60)], len: 1 }; } break; }
      case 6: { let k = 4; pick(PAT.lead).forEach((i) => { k = Math.max(0, Math.min(10, k + [-2, -1, 1, 2, 0, 3][Math.floor(R() * 6)])); st[i] = { notes: [deg(k, 60)], len: 2 }; }); break; }
      case 7: pick(PAT.perc).forEach((i, k) => { st[i] = { drum: [['cow', 1], ['clave', 2400], ['zap', 1800], ['conga', 260]][(k + s) % 4] }; }); break;
    }
    return { steps: st };
  }
  const clip = (c, s) => { const k = cfg.root + cfg.scale + ':' + c + ':' + s; return clips[k] || (clips[k] = makeClip(c, s)); };

  // ---------- Sequencer ----------
  const SEQ_DR = [['kick', 150], ['snare', 200], ['hat', 0.04], ['open', 0.3], ['clap', 0], ['tom', 120], ['rim', 0], ['cow', 1]];
  const seq = { mel: Array.from({ length: 16 }, () => Array(8).fill(false)), drum: Array.from({ length: 16 }, () => Array(8).fill(false)), track: 'mel', page: 0, on: false, cur: -1 };
  [0, 4, 8, 12].forEach((s) => { seq.drum[s][0] = true; }); [4, 12].forEach((s) => { seq.drum[s][1] = true; }); [2, 6, 10, 14].forEach((s) => { seq.drum[s][2] = true; });
  [[0, 0], [3, 2], [6, 4], [8, 2], [10, 3], [12, 0]].forEach(([s, r]) => { seq.mel[s][r] = true; });

  function onStep(step, time) {
    const s = step % 16, stepSec = 60 / Clock.bpm / 4;
    if (seq.on) {
      seq.mel[s].forEach((on, r) => { if (on) A.play(degPitch(r), stepSec * 1.8, { inst: cfg.inst, vel: 0.8, when: time }); });
      seq.drum[s].forEach((on, r) => { if (on) A.drum(SEQ_DR[r][0], SEQ_DR[r][1], 0.9, time); });
      A.visual(time, () => { seq.cur = s; if (cfg.mode === 'seq') render(); });
    }
    if (s === 0) {
      let ch = false;
      for (let c = 0; c < 8; c++) if (sess.queue[c] != null) { sess.playing[c] = sess.queue[c] === 'stop' ? -1 : sess.queue[c]; sess.queue[c] = null; ch = true; }
      if (ch) A.visual(time, () => { if (cfg.mode === 'session') render(); });
    }
    for (let c = 0; c < 8; c++) {
      const sn = sess.playing[c]; if (sn < 0) continue;
      const e = clip(c, sn).steps[s]; if (!e) continue;
      if (e.drum) A.drum(e.drum[0], e.drum[1], 0.75, time);
      else e.notes.forEach((m) => A.play(m, stepSec * e.len * 0.95, { inst: TRK_INST[c], vel: 0.7, when: time }));
    }
  }
  Clock.subs.add(onStep);
  Clock.states.add((s) => {
    if (s === 'stop') { sess.playing.fill(-1); sess.queue.fill(null); seq.cur = -1; seq.on = false; }
    syncTransport(); render();
  });
  function ensureClock() { Clock.bpm = cfg.tempo; if (!Clock.playing) Clock.start(); }

  // ---------- Fader ----------
  const FADERS = [
    { n: 'Vol', lvl: 5, ap: (l) => A.setVol(0.1 + (l / 7) * 0.9) },
    { n: 'Rev', lvl: 2, ap: (l) => A.setRev((l / 7) * 0.8) },
    { n: 'Filter', lvl: 4, ap: (l) => { A.state.cutoff = 0.25 + (l / 7) * 2.2; } },
    { n: 'Attack', lvl: 1, ap: (l) => { A.state.atk = 0.2 + (l / 7) * 5; } },
    { n: 'Release', lvl: 2, ap: (l) => { A.state.rel = 0.3 + (l / 7) * 4; } },
    { n: 'Detune', lvl: 1, ap: (l) => { A.state.det = l * 3; } },
    { n: 'Tempo', lvl: 3, ap: (l) => setTempo(60 + l * 20) },
    { n: 'Bend', lvl: 1, ap: (l) => { A.state.bendRange = 100 + l * 100; } },
  ];
  function faderSet(r, c) { FADERS[c].lvl = r; FADERS[c].ap(r); render(); }
  function setTempo(v) { cfg.tempo = v; Clock.bpm = v; $('tpBpm').value = v; $('tpBpmV').textContent = v; arpRestart(); }

  // ---------- Mode pitched (Note/Chrom/Arp) ----------
  const pitched = { down(r, c, el) {
    const p = padPitch(r, c), key = r + ':' + c;
    if (cfg.mode === 'arp') { if (!arp.list.includes(p)) arp.list.push(p); arpStart(); }
    else noteOn(key, p);
    const ok = root.Learn.onPlay(p);
    if (ok === false) { el.classList.add('bad'); setTimeout(() => el.classList.remove('bad'), 250); }
  }, up(r, c) {
    const p = padPitch(r, c);
    if (cfg.mode === 'arp') { if (!cfg.sustain) { arp.list = arp.list.filter((x) => x !== p); if (!arp.list.length) arpClear(); } }
    else noteOff(r + ':' + c);
  } };

  const MODE = {
    note: pitched, chrom: pitched, arp: pitched,
    chord: {
      down(r, c) { chordNotes(r, c).forEach((m, k) => noteOn(r + ':' + c + ':' + k, m)); },
      up(r, c) { for (let k = 0; k < 6; k++) noteOff(r + ':' + c + ':' + k); },
    },
    drum: { down(r, c) { const d = DR[r][c]; A.drum(d.kind, d.p, 0.5 + vel() * 0.5); } },
    seq: { down(r, c) {
      const s = seq.page * 8 + c, lane = seq[seq.track];
      lane[s][r] = !lane[s][r];
      if (lane[s][r]) { if (seq.track === 'mel') A.play(degPitch(r), 0.3, { inst: cfg.inst, vel: vel() }); else A.drum(SEQ_DR[r][0], SEQ_DR[r][1], 0.9); }
      render();
    } },
    session: { down(r, c) {
      const s = 7 - r;
      if (sess.playing[c] === s && sess.queue[c] == null) sess.queue[c] = 'stop';
      else sess.queue[c] = (sess.queue[c] === s) ? null : s;
      ensureClock(); render();
    } },
    fader: { down(r, c) { faderSet(r, c); }, slide(r, c) { faderSet(r, c); } },
  };

  // ---------- Tombol samping ----------
  function shift(k, d) {
    if (k === 'oct') cfg.oct = Math.max(-1, Math.min(7, cfg.oct + d)); else cfg.trans = Math.max(-12, Math.min(12, cfg.trans + d));
    allOff(); layoutChanged();
  }
  function cycleVel() { const v = [50, 80, 100, 127]; cfg.vel = v[(v.indexOf(cfg.vel) + 1) % v.length]; render(); }
  function toggleSustain() { cfg.sustain = !cfg.sustain; if (!cfg.sustain) { releaseSustain(); if (cfg.mode === 'arp') arpClear(); } render(); }
  const SIDE = {
    pitched: [
      { l: '8▲', tap: () => shift('oct', 1) }, { l: '8▼', tap: () => shift('oct', -1) },
      { l: '♯', tap: () => shift('trans', 1) }, { l: '♭', tap: () => shift('trans', -1) },
      { l: '⤴', down: () => bendTo(A.state.bendRange), up: () => bendTo(0) }, { l: '⤵', down: () => bendTo(-A.state.bendRange), up: () => bendTo(0) },
      { l: 'Sus', tap: toggleSustain, lit: () => cfg.sustain }, { l: 'Vel', tap: cycleVel },
    ],
    session: Array.from({ length: 8 }, (_, i) => ({ l: String(i + 1), tap: () => { for (let c = 0; c < 8; c++) sess.queue[c] = i; ensureClock(); render(); } })),
    drum: [{}, {}, {}, {}, {}, {}, {}, { l: 'Vel', tap: cycleVel }].map((x) => (x.l ? x : null)),
    seq: [
      { l: '▶', tap: () => { seq.on = !seq.on; if (seq.on) ensureClock(); render(); }, lit: () => seq.on },
      { l: 'Clr', tap: () => { seq[seq.track].forEach((a) => a.fill(false)); render(); } },
      { l: 'M/D', tap: () => { seq.track = seq.track === 'mel' ? 'drum' : 'mel'; render(); }, lit: () => seq.track === 'drum' },
      { l: 'A/B', tap: () => { seq.page = 1 - seq.page; render(); }, lit: () => seq.page === 1 },
      { l: 'Rnd', tap: () => { seq[seq.track].forEach((a) => a.forEach((_, r) => { a[r] = Math.random() < (seq.track === 'drum' ? 0.18 : 0.08); })); render(); } },
      { l: 'BPM−', tap: () => setTempo(Math.max(60, cfg.tempo - 5)) }, { l: 'BPM+', tap: () => setTempo(Math.min(180, cfg.tempo + 5)) },
      { l: 'A→B', tap: () => { for (let s = 0; s < 8; s++) seq[seq.track][8 + s] = seq[seq.track][s].slice(); render(); } },
    ],
    fader: [{ l: 'Rst', tap: () => { FADERS.forEach((f, i) => { f.lvl = [5, 2, 4, 1, 2, 1, 3, 1][i]; f.ap(f.lvl); }); render(); } }, null, null, null, null, null, null, null],
  };
  const sideSpec = () => (['note', 'chrom', 'chord', 'arp'].includes(cfg.mode) ? SIDE.pitched : SIDE[cfg.mode]);

  // ---------- Render ----------
  function padView(r, c) {
    const m = cfg.mode;
    if (m === 'note' || m === 'arp') {
      const p = padPitch(r, c), rel = pcRel(p);
      const deg = sc().indexOf(rel);
      return { col: rel === 0 ? hsl(185, 90, 55) : (deg === 2 || deg === 4 ? hsl(265, 70, 62) : hsl(215, 25, 75)), l: rel === 0 ? 0.95 : 0.4, lbl: X.pcname(p) };
    }
    if (m === 'chrom') {
      const p = padPitch(r, c), rel = pcRel(p), inS = sc().includes(rel);
      return { col: rel === 0 ? hsl(185, 90, 55) : hsl(215, 25, 75), l: rel === 0 ? 0.95 : inS ? 0.4 : 0.07, lbl: X.pcname(p) };
    }
    if (m === 'chord') return { col: hsl(CH_HUE[r], 85, 58), l: c === 0 ? 0.85 : 0.5, lbl: '' };
    if (m === 'drum') { const d = DR[r][c]; return { col: hsl(d.hue, 85, 58), l: 0.5, lbl: d.label }; }
    if (m === 'seq') {
      const s = seq.page * 8 + c, on = seq[seq.track][s][r], head = seq.on && seq.cur === s;
      const hue = seq.track === 'mel' ? 150 : 20;
      return { col: on ? hsl(hue, 90, 55) : hsl(215, 25, 75), l: on ? (head ? 1 : 0.85) : (head ? 0.35 : 0.1), lbl: '' };
    }
    if (m === 'session') {
      const s = 7 - r, pl = sess.playing[c] === s, q = sess.queue[c] === s || (pl && sess.queue[c] === 'stop');
      return { col: pl ? hsl(135, 90, 55) : q ? hsl(45, 95, 58) : hsl(c * 45, 80, 60), l: pl ? 1 : q ? 0.9 : 0.25, lbl: s === 0 ? TRK_NAME[c] : '', cls: q ? 'q' : pl ? 'pulse' : '' };
    }
    if (m === 'fader') { const f = FADERS[c]; return { col: hsl(c * 40 + 10, 85, 58), l: r <= f.lvl ? 0.85 : 0.08, lbl: r === 0 ? f.n : '' }; }
    return { col: '#888', l: 0.1, lbl: '' };
  }
  function render() {
    tops.forEach((b, i) => b.classList.toggle('on', MODES[i][0] === cfg.mode));
    const spec = sideSpec();
    sides.forEach((b, i) => { const s = spec[i]; b.firstChild.textContent = s ? s.l : ''; b.classList.toggle('dead', !s); b.classList.toggle('on', !!(s && s.lit && s.lit())); });
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const e = pads[r][c], v = padView(r, c);
      e.style.setProperty('--c', v.col); e.style.setProperty('--l', v.l);
      e.firstChild.textContent = v.lbl;
      e.classList.toggle('q', v.cls === 'q'); e.classList.toggle('pulse', v.cls === 'pulse');
    }
    const info = { session: 'Session · tekan klip untuk launch (mulai di birama berikutnya), tombol kanan = scene', note: 'Note · ' + X.pcname(cfg.root) + ' ' + cfg.scale, chrom: 'Kromatik · ' + X.pcname(cfg.root), chord: 'Chord · diatonik ' + X.pcname(cfg.root) + ' ' + cfg.scale + ' (baris = jenis akor)', drum: 'Drum · 4 kuadran: kick/snare, hat/cymbal, tom/perkusi, bass/FX', seq: 'Step · ' + (seq.track === 'mel' ? 'melodi' : 'drum') + ' halaman ' + (seq.page ? 'B' : 'A'), fader: 'Fader · sentuh/geser tiap kolom', arp: 'Arp · tahan beberapa pad, ' + cfg.arpPat };
    const pit = ['note', 'chrom', 'chord', 'arp'].includes(cfg.mode);
    $('padStatus').textContent = info[cfg.mode] + (pit ? ' · Okt ' + cfg.oct + ' · ' + (cfg.trans >= 0 ? '+' : '') + cfg.trans + ' · Vel ' + cfg.vel : '');
  }

  // ---------- Input ----------
  const ptr = new Map();
  grid.addEventListener('pointerdown', (e) => {
    A.init();
    const el = e.target.closest('[data-r],[data-top],[data-side]'); if (!el) return;
    e.preventDefault();
    if (el.dataset.top !== undefined) { setMode(MODES[+el.dataset.top][0]); return; }
    if (el.dataset.side !== undefined) {
      const sp = sideSpec()[+el.dataset.side]; if (!sp) return;
      el.classList.add('down'); ptr.set(e.pointerId, { side: sp, el });
      if (sp.tap) sp.tap(); if (sp.down) sp.down();
      return;
    }
    const r = +el.dataset.r, c = +el.dataset.c;
    ptr.set(e.pointerId, { r, c, el }); el.classList.add('down');
    MODE[cfg.mode].down(r, c, el);
  });
  grid.addEventListener('pointermove', (e) => {
    const p = ptr.get(e.pointerId); if (!p || p.side || !MODE[cfg.mode].slide) return;
    const el = document.elementFromPoint(e.clientX, e.clientY), pe = el && el.closest ? el.closest('[data-r]') : null;
    if (!pe || pe === p.el) return;
    p.el.classList.remove('down'); p.el = pe; p.r = +pe.dataset.r; p.c = +pe.dataset.c; pe.classList.add('down');
    MODE[cfg.mode].slide(p.r, p.c);
  });
  const gUp = (e) => {
    const p = ptr.get(e.pointerId); if (!p) return;
    ptr.delete(e.pointerId); p.el.classList.remove('down');
    if (p.side) { if (p.side.up) p.side.up(); return; }
    if (MODE[cfg.mode].up) MODE[cfg.mode].up(p.r, p.c);
  };
  grid.addEventListener('pointerup', gUp); grid.addEventListener('pointercancel', gUp);
  grid.addEventListener('contextmenu', (e) => e.preventDefault());

  function setMode(m) {
    if (m === cfg.mode) return;
    if (root.Learn && root.Learn.inst === P && root.Learn.mode !== 'free' && m !== 'note' && m !== 'chrom') root.Learn.setMode('free');
    allOff(); ptr.clear();
    cfg.mode = m;
    syncSettings(); layoutChanged();
  }
  function layoutChanged() { render(); if (root.Learn && root.Learn.inst === P) root.Learn.rebuild(false); }

  // ---------- Transport & pengaturan ----------
  function syncTransport() { $('tpPlay').textContent = Clock.playing ? '■ Stop' : '▶ Play'; $('tpPlay').classList.toggle('on', Clock.playing); }
  $('tpPlay').onclick = () => { A.init(); if (Clock.playing) Clock.stop(); else { Clock.bpm = cfg.tempo; Clock.start(); } };
  $('tpBpm').oninput = (e) => setTempo(+e.target.value);

  const fillSel = (id, items, val) => { const s = $(id); s.innerHTML = ''; items.forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; s.appendChild(o); }); s.value = val; };
  fillSel('padInst', A.INSTRUMENTS.filter((x) => x[0] !== 'violin'), cfg.inst);
  fillSel('padScale', Object.keys(X.SCALES).map((k) => [k, k]), cfg.scale);
  fillSel('padRoot', X.NN.map((n, i) => [i, n]), cfg.root);
  fillSel('padOff', [[3, 'Terz (3) — kunci skala'], [4, 'Kuart (4)'], [5, 'Kuint (5)'], [7, 'Oktaf (7) — baris sama']], cfg.off);
  fillSel('padChOff', [[5, 'Kuart (5) — seperti gitar'], [4, 'Terz mayor (4)'], [3, 'Terz minor (3)'], [8, '8 semitone']], cfg.choff);
  fillSel('arpPat', [['up', 'Naik'], ['down', 'Turun'], ['updown', 'Naik-turun'], ['random', 'Acak']], cfg.arpPat);
  fillSel('arpRate', [[2, '1/8'], [4, '1/16'], [3, 'Triplet']], cfg.arpRate);
  function syncSettings() { $('padInst').value = cfg.inst; $('padScale').value = cfg.scale; $('padRoot').value = cfg.root; $('padOff').value = cfg.off; $('padChOff').value = cfg.choff; }
  $('padInst').onchange = (e) => { cfg.inst = e.target.value; };
  $('padScale').onchange = (e) => { cfg.scale = e.target.value; allOff(); layoutChanged(); };
  $('padRoot').onchange = (e) => { cfg.root = +e.target.value; allOff(); layoutChanged(); };
  $('padOff').onchange = (e) => { cfg.off = +e.target.value; allOff(); layoutChanged(); };
  $('padChOff').onchange = (e) => { cfg.choff = +e.target.value; allOff(); layoutChanged(); };
  $('arpPat').onchange = (e) => { cfg.arpPat = e.target.value; render(); };
  $('arpRate').onchange = (e) => { cfg.arpRate = +e.target.value; arpRestart(); };

  // ---------- Antarmuka untuk Learn ----------
  function candidatesFor(m) { const out = []; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (padPitch(r, c) === m) out.push({ r, c, p: m }); return out; }
  function resolve(notes) {
    const cand = [];
    for (const n of notes) {
      let list = candidatesFor(n.midi), folded = false;
      if (!list.length) { for (const k of [12, -12, 24, -24, 36, -36, 48, -48]) { list = candidatesFor(n.midi + k); if (list.length) { folded = true; break; } } }
      if (!list.length) return null;
      cand.push(list.map((x) => Object.assign({ folded }, x)));
    }
    return X.viterbi(cand, (c) => c.r * 0.05, (a, b) => (a.r === b.r && a.c === b.c ? 0 : (Math.abs(a.r - b.r) + Math.abs(a.c - b.c)) * 0.3));
  }
  function autoLayout(notes) {
    const lo = Math.min(...notes.map((n) => n.midi)), hi = Math.max(...notes.map((n) => n.midi));
    const key = X.detectKey(notes);
    if (key) {
      cfg.mode = 'note'; cfg.root = key.root; cfg.scale = key.scale; cfg.off = 3; cfg.trans = 0;
      cfg.oct = Math.floor((lo - key.root) / 12) - 1;
      if (padPitch(7, 7) < hi) { cfg.off = 4; if (padPitch(7, 7) < hi) cfg.off = 5; }
    } else {
      cfg.mode = 'chrom'; cfg.root = ((lo % 12) + 12) % 12; cfg.oct = Math.floor(lo / 12) - 1; cfg.choff = 5; cfg.trans = 0;
    }
    syncSettings();
  }
  P.prepare = function (notes, auto) {
    if (!notes.length) return [];
    allOff();
    if (auto) autoLayout(notes);
    const saved = cfg.mode, pit = saved === 'note' || saved === 'chrom';
    if (!pit) cfg.mode = 'note';
    let ch = resolve(notes);
    if (!ch && cfg.mode === 'note') { cfg.mode = 'chrom'; cfg.root = notes.reduce((a, n) => Math.min(a, n.midi), 127) % 12; cfg.oct = Math.floor(Math.min(...notes.map((n) => n.midi)) / 12) - 1; ch = resolve(notes); }
    const lay = cfg.mode;
    if (!pit && cfg.mode === 'note') cfg.mode = saved;
    if (!ch) return [];
    const t = ch.map((c, i) => ({
      midi: c.p, els: [pads[c.r][c.c]], text: 'Pad baris <b>' + (c.r + 1) + '</b>, kolom <b>' + (c.c + 1) + '</b>',
      accept: c.folded ? (p) => ((p % 12) + 12) % 12 === ((notes[i].midi % 12) + 12) % 12 : (p) => p === c.p,
    }));
    const nf = ch.filter((c) => c.folded).length;
    t.info = (lay === 'note' ? X.pcname(cfg.root) + ' ' + cfg.scale : 'kromatik') + (nf ? ' · ' + nf + ' nada beda oktaf' : '');
    render();
    return t;
  };
  P.clearMarks = () => grid.querySelectorAll('.target,.next,.bad,.playing').forEach((e) => e.classList.remove('target', 'next', 'bad', 'playing'));
  P.play = (m, dur) => A.play(m, dur, { inst: cfg.inst, vel: vel() });
  P.flash = (els, ms) => els.forEach((e) => { e.classList.add('playing'); setTimeout(() => e.classList.remove('playing'), ms); });
  P.enterLearn = () => { if (cfg.mode !== 'note' && cfg.mode !== 'chrom') setMode('note'); };
  P.activate = () => { Clock.bpm = cfg.tempo; syncTransport(); render(); };
  P.deactivate = () => { allOff(); ptr.clear(); Clock.stop(); bendTo(0); };
  P.setLayout = (o) => Object.assign(cfg, o);

  FADERS.forEach((f) => f.ap(f.lvl));
  setThumb(0); syncTransport(); render();
  root.VPad = P;
})(this);
