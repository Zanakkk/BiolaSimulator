// Teori musik, generator nada, dan Viterbi generik (dipakai Biola & Launchpad)
(function (root) {
  const NN = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const nname = (m) => NN[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
  const pcname = (m) => NN[((m % 12) + 12) % 12];

  const SCALES = {
    'Mayor': [0, 2, 4, 5, 7, 9, 11],
    'Minor': [0, 2, 3, 5, 7, 8, 10],
    'Dorian': [0, 2, 3, 5, 7, 9, 10],
    'Phrygian': [0, 1, 3, 5, 7, 8, 10],
    'Lydian': [0, 2, 4, 6, 7, 9, 11],
    'Mixolydian': [0, 2, 4, 5, 7, 9, 10],
    'Locrian': [0, 1, 3, 5, 6, 8, 10],
    'Harmonic minor': [0, 2, 3, 5, 7, 8, 11],
    'Melodic minor': [0, 2, 3, 5, 7, 9, 11],
    'Pentatonik mayor': [0, 2, 4, 7, 9],
    'Pentatonik minor': [0, 3, 5, 7, 10],
    'Blues': [0, 3, 5, 6, 7, 10],
    'Whole tone': [0, 2, 4, 6, 8, 10],
    'Kromatik': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  };

  function rng(seed) {
    let a = seed >>> 0;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // cand: array of arrays of kandidat. Mengembalikan kandidat terpilih per langkah.
  function viterbi(cand, nodeCost, trans) {
    const n = cand.length;
    if (!n) return [];
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
    for (let i = n - 1; i >= 0; i--) { res[i] = cand[i][k]; if (i > 0) k = back[i - 1][k]; }
    return res;
  }

  // Generator melodi: random-walk pada skala, berakhir di tonika.
  function generate(o) {
    const root = o.root || 0, scale = o.scale || 'Mayor', count = o.count || 16, hard = o.hard || 1;
    const lo = o.lo == null ? 60 : o.lo, hi = o.hi == null ? 84 : o.hi, bpm = o.bpm || 100;
    const R = rng(o.seed == null ? Math.floor(Math.random() * 1e9) : o.seed);
    const sc = SCALES[scale] || SCALES.Mayor;
    const pcOf = (m) => (((m - root) % 12) + 12) % 12;
    const pool = [];
    for (let m = lo; m <= hi; m++) if (sc.includes(pcOf(m))) pool.push(m);
    if (!pool.length) return [];
    const tonicIdx = pool.map((m, k) => (pcOf(m) === 0 ? k : -1)).filter((k) => k >= 0);
    const mid = (lo + hi) / 2;
    let idx = tonicIdx.length ? tonicIdx.sort((a, b) => Math.abs(pool[a] - mid) - Math.abs(pool[b] - mid))[0] : 0;
    const tonics = tonicIdx.slice();
    const steps = hard === 1 ? [-1, -1, 1, 1, 1, -1, 2, -2, 0] : hard === 2 ? [-1, 1, -1, 1, 2, -2, 3, -3, 0, 4, -4] : [-1, 1, 2, -2, 3, -3, 4, -4, 5, -5, 7, -7, 0];
    const rh = hard === 1 ? [1, 1, 1, 1, 2] : hard === 2 ? [0.5, 0.5, 1, 1, 1.5, 2] : [0.25, 0.5, 0.5, 0.75, 1, 1, 1.5, 2];
    const spb = 60 / bpm;
    let t = 0;
    const out = [];
    for (let i = 0; i < count; i++) {
      const last = i === count - 1;
      const d = last ? 2 : rh[Math.floor(R() * rh.length)];
      out.push({ t, d: d * spb, midi: pool[idx] });
      t += d * spb;
      if (i < count - 2) idx = Math.max(0, Math.min(pool.length - 1, idx + steps[Math.floor(R() * steps.length)]));
      else if (i === count - 2 && tonics.length) {
        let best = tonics[0];
        tonics.forEach((k) => { if (Math.abs(k - idx) < Math.abs(best - idx)) best = k; });
        idx = best;
      }
    }
    return out;
  }

  // Cari skala yang memuat semua pitch class lagu.
  function detectKey(notes) {
    const pcs = new Set(notes.map((n) => ((n.midi % 12) + 12) % 12));
    const lastPc = ((notes[notes.length - 1].midi % 12) + 12) % 12;
    const names = ['Mayor', 'Minor', 'Pentatonik mayor', 'Pentatonik minor', 'Blues', 'Dorian', 'Mixolydian', 'Harmonic minor'];
    let best = null, bs = -1;
    for (let r = 0; r < 12; r++) {
      for (const nm of names) {
        const sc = SCALES[nm];
        let ok = true;
        for (const pc of pcs) if (!sc.includes(((pc - r) % 12 + 12) % 12)) { ok = false; break; }
        if (!ok) continue;
        const score = (r === lastPc ? 4 : 0) + (nm === 'Mayor' || nm === 'Minor' ? 2 : 0) - names.indexOf(nm) * 0.1;
        if (score > bs) { bs = score; best = { root: r, scale: nm }; }
      }
    }
    return best;
  }

  const api = { NN, nname, pcname, SCALES, rng, viterbi, generate, detectKey };
  if (typeof module !== 'undefined') module.exports = api; else root.VMusic = api;
})(this);
