// Mesin audio bersama: instrumen, drum, reverb, pitch bend, dan clock sequencer.
(function (root) {
  const A = {};
  let ac, master, bus, send, noiseBuf;
  const st = (A.state = { vol: 0.8, rev: 0.22, cutoff: 1, atk: 1, rel: 1, det: 0, bendRange: 200, bend: 0, vib: true });
  const hz = (A.hz = (m) => 440 * Math.pow(2, (m - 69) / 12));
  const voices = new Set();

  const INST = {
    violin: { osc: ['sawtooth', 'sawtooth'], det: [0, 7], cut: 6, q: 0.8, a: 0.05, d: 0.1, s: 1, r: 0.15, vib: 1, gain: 0.22 },
    synth: { osc: ['sawtooth', 'square'], det: [-6, 6], cut: 5, q: 2, a: 0.01, d: 0.25, s: 0.6, r: 0.2, fenv: 3, gain: 0.15 },
    pluck: { osc: ['triangle', 'sawtooth'], det: [0, 3], cut: 4, q: 1, a: 0.003, d: 0.35, s: 0, r: 0.1, fenv: 5, gain: 0.22 },
    pad: { osc: ['sawtooth', 'sawtooth', 'triangle'], det: [-9, 9, 0], cut: 3, q: 0.5, a: 0.5, d: 0.3, s: 0.8, r: 0.9, gain: 0.11 },
    bass: { osc: ['sawtooth', 'square'], det: [0, -1], cut: 2.2, q: 2, a: 0.005, d: 0.2, s: 0.5, r: 0.1, fenv: 4, gain: 0.26 },
    piano: { osc: ['triangle', 'sine'], det: [0, 2], cut: 6, q: 0.5, a: 0.003, d: 1.2, s: 0.04, r: 0.3, gain: 0.3 },
    bell: { osc: ['sine', 'sine'], ratio: [1, 3.5], det: [0, 0], cut: 12, q: 0.3, a: 0.003, d: 1.4, s: 0, r: 0.4, gain: 0.25 },
    organ: { osc: ['sine', 'sine', 'sine'], ratio: [1, 2, 3], det: [0, 0, 0], cut: 10, q: 0.3, a: 0.02, d: 0.1, s: 1, r: 0.08, vib: 0.5, gain: 0.16 },
  };
  A.INSTRUMENTS = [['synth', 'Synth'], ['pluck', 'Pluck'], ['piano', 'Piano'], ['pad', 'Pad'], ['bass', 'Bass'], ['bell', 'Bell'], ['organ', 'Organ'], ['violin', 'Biola']];

  A.init = function () {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return ac; }
    ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    const comp = ac.createDynamicsCompressor();
    master = ac.createGain(); master.gain.value = st.vol;
    master.connect(comp); comp.connect(ac.destination);
    bus = ac.createGain();
    bus.connect(master);
    send = ac.createGain(); send.gain.value = st.rev;
    const conv = ac.createConvolver();
    const n = Math.floor(ac.sampleRate * 1.8);
    const ib = ac.createBuffer(2, n, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ib.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.5); }
    conv.buffer = ib;
    bus.connect(send); send.connect(conv); conv.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    requestAnimationFrame(vloop);
    return ac;
  };
  A.now = () => (ac ? ac.currentTime : 0);
  A.setVol = (v) => { st.vol = v; if (master) master.gain.setTargetAtTime(v, ac.currentTime, 0.02); };
  A.setRev = (v) => { st.rev = v; if (send) send.gain.setTargetAtTime(v, ac.currentTime, 0.02); };

  A.note = function (midi, o) {
    o = o || {};
    A.init();
    const P = INST[o.inst || 'synth'] || INST.synth;
    const t = Math.max(o.when || 0, ac.currentTime);
    const vel = o.vel == null ? 0.8 : o.vel;
    const f = hz(midi);
    const g = ac.createGain(), flt = ac.createBiquadFilter();
    flt.type = 'lowpass'; flt.Q.value = P.q;
    const base = Math.min(f * P.cut * st.cutoff, 12000), top = Math.min(base * (1 + (P.fenv || 0)), 14000);
    flt.frequency.setValueAtTime(top, t);
    if (P.fenv) flt.frequency.setTargetAtTime(base, t, 0.12 + P.d * 0.3);
    const peak = P.gain * (0.35 + 0.65 * vel), a = Math.max(0.002, P.a * st.atk);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * P.s + 0.0001, t + a, Math.max(0.02, P.d / 3));
    const oscs = [], dets = [];
    P.osc.forEach((type, i) => {
      const x = ac.createOscillator();
      x.type = type; x.frequency.value = f * (P.ratio ? P.ratio[i] : 1);
      const d = (P.det[i] || 0) + st.det * (i % 2 ? 1 : -1);
      dets.push(d); x.detune.value = d + st.bend;
      x.connect(flt); x.start(t); oscs.push(x);
    });
    let lfo = null;
    if (P.vib && st.vib) {
      lfo = ac.createOscillator();
      const lg = ac.createGain();
      lfo.frequency.value = 5.5;
      lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(P.vib * 14, t + 0.7);
      lfo.connect(lg); oscs.forEach((x) => lg.connect(x.detune)); lfo.start(t);
    }
    flt.connect(g); g.connect(bus);
    const v = {
      oscs, dets, stopped: false,
      setFreq(fr) {
        const n = ac.currentTime;
        oscs.forEach((x, i) => x.frequency.setTargetAtTime(fr * (P.ratio ? P.ratio[i] : 1), n, 0.03));
        flt.frequency.setTargetAtTime(Math.min(fr * P.cut * st.cutoff, 12000), n, 0.03);
      },
      stop(when) {
        if (v.stopped) return;
        v.stopped = true;
        const n = Math.max(when || 0, ac.currentTime), r = Math.max(0.04, P.r * st.rel);
        if (n <= ac.currentTime + 0.01) { g.gain.cancelScheduledValues(n); g.gain.setValueAtTime(g.gain.value, n); }
        g.gain.setTargetAtTime(0, n, r / 3);
        oscs.forEach((x) => x.stop(n + r + 0.15));
        if (lfo) lfo.stop(n + r + 0.15);
        setTimeout(() => voices.delete(v), (n - ac.currentTime + r + 0.3) * 1000);
      },
    };
    voices.add(v);
    return v;
  };
  A.play = function (midi, dur, o) {
    A.init();
    o = o || {};
    const t = Math.max(o.when || 0, ac.currentTime);
    const v = A.note(midi, Object.assign({}, o, { when: t }));
    v.stop(t + dur);
    return v;
  };
  A.setBend = function (cents) {
    st.bend = cents;
    if (!ac) return;
    const n = ac.currentTime;
    voices.forEach((v) => v.oscs.forEach((x, i) => x.detune.setTargetAtTime(v.dets[i] + cents, n, 0.02)));
  };

  // ---- Drum ----
  function tone(out, t, type, f0, f1, dur, peak) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(out, t, ft, fq, Q, dur, peak) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = ft; f.frequency.value = fq; f.Q.value = Q;
    const g = ac.createGain(); g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + dur + 0.02);
  }
  A.drum = function (kind, p, vel, when) {
    A.init();
    const t = Math.max(when || 0, ac.currentTime);
    const out = ac.createGain(); out.gain.value = vel == null ? 0.8 : vel; out.connect(bus);
    switch (kind) {
      case 'kick': tone(out, t, 'sine', p || 150, 42, 0.38, 1); noise(out, t, 'highpass', 3000, 1, 0.015, 0.25); break;
      case 'snare': noise(out, t, 'bandpass', 1800, 0.8, 0.2, 0.7); tone(out, t, 'triangle', p || 190, 120, 0.12, 0.5); break;
      case 'clap': for (let k = 0; k < 3; k++) noise(out, t + k * 0.012, 'bandpass', 1300, 1, 0.025, 0.6); noise(out, t + 0.036, 'bandpass', 1300, 1, 0.18, 0.5); break;
      case 'rim': tone(out, t, 'square', 480, 380, 0.04, 0.35); noise(out, t, 'highpass', 3000, 1, 0.03, 0.3); break;
      case 'hat': noise(out, t, 'highpass', 7500, 1, p || 0.05, 0.5); break;
      case 'open': noise(out, t, 'highpass', 6500, 1, p || 0.3, 0.45); break;
      case 'crash': noise(out, t, 'highpass', 5000, 1, p || 1.1, 0.5); noise(out, t, 'bandpass', 9000, 1, (p || 1.1) * 0.7, 0.3); break;
      case 'ride': noise(out, t, 'bandpass', 9000, 2, p || 0.6, 0.35); tone(out, t, 'square', 5200, 5000, 0.12, 0.08); break;
      case 'tom': tone(out, t, 'sine', (p || 120) * 1.4, (p || 120) * 0.6, 0.35, 0.9); break;
      case 'cow': tone(out, t, 'square', 540 * (p || 1), null, 0.25, 0.3); tone(out, t, 'square', 800 * (p || 1), null, 0.25, 0.3); break;
      case 'conga': tone(out, t, 'sine', (p || 250) * 1.2, p || 250, 0.22, 0.8); break;
      case 'clave': tone(out, t, 'sine', p || 2400, null, 0.06, 0.6); break;
      case 'zap': tone(out, t, 'sawtooth', p || 1500, 80, 0.25, 0.3); break;
      case 'bass': { const f = hz(p || 36); tone(out, t, 'triangle', f * 1.02, f, 0.4, 0.7); tone(out, t, 'sawtooth', f, f, 0.25, 0.2); break; }
      default: tone(out, t, 'sine', 200, 100, 0.1, 0.5);
    }
  };

  // ---- Antrian visual (sinkron dengan waktu audio) ----
  const vq = [];
  A.visual = (time, fn) => { vq.push({ time, fn }); };
  function vloop() {
    const n = ac ? ac.currentTime : 0;
    if (vq.length) {
      const due = vq.filter((e) => e.time <= n).sort((a, b) => a.time - b.time);
      if (due.length) { due.forEach((e) => { vq.splice(vq.indexOf(e), 1); try { e.fn(); } catch (err) { /* abaikan */ } }); }
    }
    requestAnimationFrame(vloop);
  }

  // ---- Clock 16th-note ----
  const Clock = (A.Clock = {
    bpm: 120, playing: false, step: 0, next: 0, timer: 0, subs: new Set(), states: new Set(),
    start() {
      if (this.playing) return;
      A.init();
      this.playing = true; this.step = 0; this.next = ac.currentTime + 0.08;
      this.timer = setInterval(() => this.tick(), 25);
      this.states.forEach((f) => f('start'));
    },
    stop() {
      if (!this.playing) return;
      clearInterval(this.timer); this.playing = false; this.step = 0;
      this.states.forEach((f) => f('stop'));
    },
    tick() {
      while (this.next < ac.currentTime + 0.14) {
        this.subs.forEach((f) => f(this.step, this.next));
        this.next += 60 / this.bpm / 4; this.step++;
      }
    },
  });

  if (typeof module !== 'undefined') module.exports = A; else root.VAudio = A;
})(this);
