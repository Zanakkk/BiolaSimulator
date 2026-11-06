// Instrumen Biola: fingerboard 4 senar x 12 semitone.
(function (root) {
  const A = root.VAudio, M = root.VMidi, X = root.VMusic;
  const OPEN = M.OPEN, MAXO = M.MAXO;
  const SN = ['G', 'D', 'A', 'E'];
  const FING = ['0', '1', '1', '2', '2', '3', '3', '4'];
  const fingOf = (o) => (o < FING.length ? FING[o] : '↑');
  const hz = A.hz;
  const $ = (id) => document.getElementById(id);
  const V = { name: 'violin', range: [62, 84] };

  const board = $('board');
  const cells = [];
  for (let s = 0; s < 4; s++) {
    cells[s] = [];
    for (let o = 0; o <= MAXO; o++) {
      const c = document.createElement('div');
      c.className = 'cell' + (o === 0 ? ' open' : '') + ([2, 4, 5, 7, 9, 12].includes(o) ? ' mark' : '');
      c.style.setProperty('--s', s); c.style.setProperty('--o', o);
      c.dataset.s = s; c.dataset.o = o;
      c.innerHTML = '<b>' + X.nname(OPEN[s] + o) + '</b><i>' + (o === 0 ? 'senar ' + SN[s] : 'jari ' + fingOf(o)) + '</i>';
      board.appendChild(c); cells[s][o] = c;
    }
  }
  const cellAt = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest ? el.closest('.cell') : null; };
  const midiOf = (c) => OPEN[+c.dataset.s] + +c.dataset.o;
  const voice = (c) => A.note(midiOf(c), { inst: 'violin', vel: 0.8 });
  const hit = (c) => { const ok = root.Learn.onPlay(midiOf(c)); if (ok === false) { c.classList.add('bad'); setTimeout(() => c.classList.remove('bad'), 250); } };

  const active = new Map();
  board.addEventListener('pointerdown', (e) => {
    e.preventDefault(); A.init();
    const c = cellAt(e.clientX, e.clientY); if (!c) return;
    c.classList.add('down'); active.set(e.pointerId, { c, v: voice(c) });
    hit(c);
  });
  board.addEventListener('pointermove', (e) => {
    const a = active.get(e.pointerId); if (!a) return;
    const c = cellAt(e.clientX, e.clientY); if (!c || c === a.c) return;
    a.c.classList.remove('down');
    if (c.dataset.s === a.c.dataset.s) a.v.setFreq(hz(midiOf(c)));
    else { a.v.stop(); a.v = voice(c); }
    a.c = c; c.classList.add('down');
    hit(c);
  });
  const up = (e) => { const a = active.get(e.pointerId); if (!a) return; a.v.stop(); a.c.classList.remove('down'); active.delete(e.pointerId); };
  board.addEventListener('pointerup', up);
  board.addEventListener('pointercancel', up);
  board.addEventListener('contextmenu', (e) => e.preventDefault());

  V.prepare = function (notes) {
    const ns = notes.map((n) => Object.assign({}, n));
    const sh = M.foldRange(ns);
    const map = M.mapFingering(ns);
    const t = ns.map((n, i) => {
      const m = map[i];
      return { midi: n.midi, els: [cells[m.s][m.o]], text: 'Senar <b>' + SN[m.s] + '</b> · ' + (m.o === 0 ? 'kosong' : 'jari <b>' + fingOf(m.o) + '</b>'), accept: (p) => p === n.midi };
    });
    t.info = sh ? sh + ' nada digeser oktaf agar masuk jangkauan biola' : '';
    return t;
  };
  V.clearMarks = () => board.querySelectorAll('.target,.next,.good,.bad,.playing').forEach((c) => c.classList.remove('target', 'next', 'good', 'bad', 'playing'));
  V.play = (m, dur) => A.play(m, dur, { inst: 'violin', vel: 0.8 });
  V.flash = (els, ms) => els.forEach((e) => { e.classList.add('playing'); setTimeout(() => e.classList.remove('playing'), ms); });
  V.activate = () => {};
  V.deactivate = () => { active.forEach((a) => a.v.stop()); active.clear(); };
  root.VViolin = V;
})(this);
