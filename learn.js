// Mesin belajar bersama: mode Bebas / Belajar (tunggu) / Demo, dipakai Biola dan Launchpad.
// Instrumen harus menyediakan: prepare(notes, auto) -> targets[{midi, els, text, accept(p)}],
// play(midi, dur), flash(els, ms), clearMarks().
(function (root) {
  const A = root.VAudio, M = root.VMidi, X = root.VMusic;
  const $ = (id) => document.getElementById(id);
  const L = { mode: 'free', notes: [], targets: [], i: 0, ok: 0, bad: 0, speed: 0.7, inst: null, raf: 0, title: '' };

  L.setInst = function (inst) { this.setMode('free'); this.inst = inst; this.rebuild(true); };
  L.setSong = function (notes, title) {
    this.setMode('free');
    this.notes = M.toMonophonic(notes.map((n) => Object.assign({}, n)));
    this.title = title || '';
    this.rebuild(true);
  };
  L.rebuild = function (auto) {
    if (this.inst) this.inst.clearMarks();
    this.targets = this.inst && this.notes.length ? this.inst.prepare(this.notes, auto) : [];
    if (this.i >= this.targets.length) this.i = 0;
    $('hint').textContent = this.notes.length ? this.title + ' · ' + this.notes.length + ' nada' + (this.targets.info ? ' · ' + this.targets.info : '') : 'Pilih lagu lewat tombol ♫ Lagu.';
    this.render();
  };
  L.setMode = function (m) {
    cancelAnimationFrame(this.raf); this.raf = 0;
    this.mode = m; this.i = 0; this.ok = 0; this.bad = 0;
    if (m !== 'free' && this.inst && this.inst.enterLearn) this.inst.enterLearn();
    ['free', 'wait', 'demo'].forEach((k) => { const b = $('m' + k[0].toUpperCase() + k.slice(1)); if (b) b.classList.toggle('on', k === m); });
    this.render();
    if (m === 'demo') this.startDemo();
  };
  L.render = function () {
    const inst = this.inst;
    if (inst) inst.clearMarks();
    if (this.mode === 'wait' && this.targets[this.i] && inst) {
      this.targets[this.i].els.forEach((e) => e.classList.add('target'));
      const nx = this.targets[this.i + 1];
      if (nx) nx.els.forEach((e) => e.classList.add('next'));
      $('stat').innerHTML = this.targets[this.i].text + ' · ✓' + this.ok + ' ✗' + this.bad;
    } else if (this.mode !== 'demo') $('stat').textContent = '';
    this.renderStrip();
    $('barfill').style.width = (this.notes.length ? (this.i / this.notes.length) * 100 : 0) + '%';
  };
  L.renderStrip = function () {
    const st = $('strip'); st.innerHTML = '';
    const a = Math.max(0, this.i - 2), b = Math.min(this.targets.length, this.i + 14);
    for (let k = a; k < b; k++) {
      const s = document.createElement('span');
      s.className = 'chip' + (k === this.i ? ' cur' : '');
      s.textContent = X.nname(this.targets[k].midi);
      st.appendChild(s);
    }
  };
  // Dipanggil instrumen saat pemain menekan nada. Mengembalikan true/false (benar/salah) atau null bila tidak relevan.
  L.onPlay = function (pitch) {
    if (this.mode !== 'wait' || this.i >= this.targets.length) return null;
    if (this.targets[this.i].accept(pitch)) {
      this.ok++; this.i++;
      if (this.i >= this.targets.length) { this.finish(); return true; }
      this.render();
      return true;
    }
    this.bad++;
    $('stat').innerHTML = $('stat').innerHTML.replace(/✓\d+ ✗\d+/, '✓' + this.ok + ' ✗' + this.bad);
    return false;
  };
  L.finish = function () {
    const acc = Math.round((this.ok / Math.max(1, this.ok + this.bad)) * 100);
    $('barfill').style.width = '100%';
    $('msgT').textContent = 'Selesai! 🎉';
    $('msgP').textContent = 'Akurasi ' + acc + '% (' + this.ok + ' benar, ' + this.bad + ' salah). Coba lagi dengan kecepatan lebih tinggi?';
    $('msg').classList.add('show');
    this.i = 0; this.ok = 0; this.bad = 0;
    setTimeout(() => this.render(), 0);
  };
  L.hear = function () {
    const t = this.targets[this.i];
    if (t && this.inst) this.inst.play(t.midi, 0.8);
  };
  L.startDemo = function () {
    if (!this.targets.length) { this.setMode('free'); return; }
    A.init();
    let di = 0, t0 = performance.now();
    this._rebase = (nv) => { const el = ((performance.now() - t0) / 1000) * this.speed; t0 = performance.now() - (el / nv) * 1000; };
    const notes = this.notes, end = notes[notes.length - 1];
    const loop = (now) => {
      const el = ((now - t0) / 1000) * this.speed;
      while (di < notes.length && notes[di].t <= el) this.trigger(di++);
      if (di >= notes.length && el > end.t + end.d + 0.3) { this.setMode('free'); return; }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  };
  L.trigger = function (k) {
    const n = this.notes[k], t = this.targets[k], ms = (n.d / this.speed) * 1000;
    this.inst.play(t.midi, (ms / 1000) * 0.95);
    this.inst.flash(t.els, ms * 0.9);
    this.i = k; this.renderStrip();
    $('barfill').style.width = ((k + 1) / this.notes.length) * 100 + '%';
    $('stat').innerHTML = t.text;
  };
  L.setSpeed = function (v) {
    if (this.mode === 'demo' && this._rebase) this._rebase(v);
    this.speed = v;
  };

  root.Learn = L;
})(this);
