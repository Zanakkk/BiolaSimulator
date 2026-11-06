// Logika murni: parser MIDI + pemetaan nada -> (senar, posisi jari)
// Senar: 0=G3(55) 1=D4(62) 2=A4(69) 3=E5(76). Offset 0 = senar kosong, 1..12 = semitone di fingerboard.
(function (root) {
  const OPEN = [55, 62, 69, 76];
  const MAXO = 12;
  const LOW = 55, HIGH = OPEN[3] + MAXO; // 55..88

  function parseMidi(buf) {
    const d = new DataView(buf);
    let p = 0;
    const str = (n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(d.getUint8(p + i)); p += n; return s; };
    if (d.byteLength < 14 || str(4) !== 'MThd') throw new Error('Bukan file MIDI yang valid');
    p += 4;
    p += 2; // format
    const nt = d.getUint16(p); p += 2;
    const div = d.getUint16(p); p += 2;
    if (div & 0x8000) throw new Error('Format waktu SMPTE belum didukung');

    const tempos = [{ tick: 0, uspq: 500000 }];
    const raw = [];
    for (let t = 0; t < nt && p + 8 <= d.byteLength; t++) {
      const id = str(4);
      const len = d.getUint32(p); p += 4;
      const end = Math.min(p + len, d.byteLength);
      if (id !== 'MTrk') { p = end; continue; }
      let tick = 0, run = 0, name = '';
      const on = {}, notes = [];
      const vlq = () => { let v = 0, b; do { b = d.getUint8(p++); v = (v << 7) | (b & 0x7f); } while (b & 0x80 && p < end); return v; };
      while (p < end) {
        tick += vlq();
        let st = d.getUint8(p);
        if (st < 0x80) { st = run; } else { p++; if (st < 0xf0) run = st; }
        if (st === 0xff) {
          const type = d.getUint8(p++); const l = vlq();
          if (type === 0x51 && l === 3) tempos.push({ tick, uspq: (d.getUint8(p) << 16) | (d.getUint8(p + 1) << 8) | d.getUint8(p + 2) });
          if (type === 0x03) { name = ''; for (let i = 0; i < l; i++) name += String.fromCharCode(d.getUint8(p + i)); }
          p += l;
        } else if (st === 0xf0 || st === 0xf7) {
          p += vlq();
        } else {
          const type = st & 0xf0, ch = st & 0x0f;
          const a = d.getUint8(p++);
          let b = 0;
          if (type !== 0xc0 && type !== 0xd0) b = d.getUint8(p++);
          if (type === 0x90 && b > 0) { if (ch !== 9) on[ch + ':' + a] = tick; }
          else if (type === 0x80 || (type === 0x90 && b === 0)) {
            const k = ch + ':' + a;
            if (k in on) { notes.push({ tick: on[k], end: tick, midi: a }); delete on[k]; }
          }
        }
      }
      p = end;
      raw.push({ name, notes });
    }
    tempos.sort((a, b) => a.tick - b.tick);
    const sec = (tick) => {
      let s = 0, lt = 0, us = 500000;
      for (const t of tempos) { if (t.tick > tick) break; s += (t.tick - lt) * us / 1e6 / div; lt = t.tick; us = t.uspq; }
      return s + (tick - lt) * us / 1e6 / div;
    };
    return raw.map((tr, i) => ({
      index: i,
      name: tr.name || ('Track ' + (i + 1)),
      notes: tr.notes.map((n) => ({ t: sec(n.tick), d: Math.max(0.05, sec(n.end) - sec(n.tick)), midi: n.midi })),
    })).filter((t) => t.notes.length);
  }

  // Violin = satu nada pada satu waktu: ambil nada tertinggi (melodi) dan potong tumpang-tindih.
  function toMonophonic(notes) {
    const s = notes.slice().sort((a, b) => a.t - b.t || b.midi - a.midi);
    const out = [];
    for (const n of s) {
      const last = out[out.length - 1];
      if (last && Math.abs(n.t - last.t) < 0.01) continue; // sama-sama mulai: buang yang lebih rendah
      if (last && last.t + last.d > n.t) last.d = Math.max(0.05, n.t - last.t);
      out.push({ ...n });
    }
    return out;
  }

  // Geser oktaf agar masuk jangkauan biola. Mengembalikan jumlah nada yang digeser.
  function foldRange(notes) {
    let shifted = 0;
    for (const n of notes) {
      let m = n.midi;
      while (m < LOW) { m += 12; }
      while (m > HIGH) { m -= 12; }
      if (m !== n.midi) { shifted++; n.midi = m; }
    }
    return shifted;
  }

  function candidates(midi) {
    const c = [];
    for (let s = 0; s < 4; s++) { const o = midi - OPEN[s]; if (o >= 0 && o <= MAXO) c.push({ s, o }); }
    return c;
  }

  // Viterbi: pilih (senar, offset) tiap nada dengan gerak tangan seminimal mungkin.
  function mapFingering(notes) {
    const n = notes.length;
    if (!n) return [];
    const cand = notes.map((x) => candidates(x.midi));
    const nodeCost = (c) => c.o * 0.15 + (c.o === 0 ? -0.3 : 0) + (c.o > 7 ? 1.0 : 0);
    const trans = (a, b) => Math.abs(a.o - b.o) * (a.s === b.s ? 0.5 : 0.35) + (a.s !== b.s ? 0.4 : 0);
    let cost = cand[0].map(nodeCost);
    const back = [];
    for (let i = 1; i < n; i++) {
      const nc = [], bk = [];
      for (const c of cand[i]) {
        let best = Infinity, bj = 0;
        cand[i - 1].forEach((pc, j) => { const v = cost[j] + trans(pc, c); if (v < best) { best = v; bj = j; } });
        nc.push(best + nodeCost(c)); bk.push(bj);
      }
      cost = nc; back.push(bk);
    }
    let k = cost.indexOf(Math.min(...cost));
    const res = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      res[i] = cand[i][k];
      if (i > 0) k = back[i - 1][k];
    }
    return res;
  }

  // Pilih track yang paling mungkin melodi.
  function bestTrack(tracks) {
    let best = tracks[0], bs = -1;
    for (const t of tracks) {
      const avg = t.notes.reduce((a, n) => a + n.midi, 0) / t.notes.length;
      const sc = t.notes.length * (avg >= 60 ? 1 : 0.5);
      if (sc > bs) { bs = sc; best = t; }
    }
    return best;
  }

  const api = { OPEN, MAXO, LOW, HIGH, parseMidi, toMonophonic, foldRange, mapFingering, bestTrack };
  if (typeof module !== 'undefined') module.exports = api; else root.VMidi = api;
})(this);
