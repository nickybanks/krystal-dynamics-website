// KrystalComp plots: the compression curve and the gain change over time, computed from the plugin's own
// processing (KrystalComp: Source/GainComputer.h, EnvelopeDetector.h, SmoothingFilter.h, DynamicProcessors.h).
//
//   KDScopes.compCurve(container, state)   output against input level, downward or upward
//   KDScopes.compTime(container, state)    gain change over time on a test signal, with the waveform behind
//
// Both return { set(state) } and are driven by the scroll-driven scope section (plugin-story.js).
(function () {
  'use strict';

  const SR = 48000;
  const dB = v => 20 * Math.log10(Math.max(v, 1e-9));
  const gainOf = d => Math.pow(10, d / 20);
  const r = v => Math.round(v * 100) / 100;
  const pathOf = pts => pts.map((p, i) => `${i ? 'L' : 'M'}${r(p[0])} ${r(p[1])}`).join('');
  const line = (cls, ax, ay, bx, by) => `<line class="${cls}" x1="${r(ax)}" y1="${r(ay)}" x2="${r(bx)}" y2="${r(by)}"/>`;
  const fmtDb = (v, digits = 1) => `${v > 0.05 ? '+' : v < -0.05 ? '−' : ''}${Math.abs(v).toFixed(digits)} dB`;
  const minus = d => (d < 0 ? `−${-d}` : `${d}`);
  const isUp = state => state.mode === 'UWRD';

  // ── Gain computers (dB in, dB of gain change out) ──────────────────────────────
  function downwardDb(inDb, { threshold, ratio, knee, range }) {
    const inv = 1 / Math.max(1, ratio);
    let gr = 0;
    if (knee > 0.01) {
      const ks = threshold - knee / 2, ke = threshold + knee / 2;
      if (inDb <= ks) gr = 0;
      else if (inDb < ke) { const x = inDb - ks; gr = x * x / knee * 0.5 * (1 - inv); }
      else gr = (inDb - threshold) * (1 - inv);
    } else if (inDb > threshold) gr = (inDb - threshold) * (1 - inv);
    return -Math.min(gr, range);
  }
  function upwardDb(inDb, { threshold, ratio, knee, range }) {
    const inv = 1 / Math.max(1, ratio);
    const ks = threshold - knee / 2, ke = threshold + knee / 2;
    if (inDb >= ke) return 0;
    let g;
    if (knee > 0.01 && inDb > ks) { const x = ke - inDb; g = x * x / knee * 0.5 * (1 - inv); }
    else g = (threshold - inDb) * (1 - inv);
    const fade = Math.min(1, Math.max(0, (inDb + 96) / 10));
    return Math.min(g, range) * fade;
  }
  const gainDb = (inDb, s) => (isUp(s) ? upwardDb(inDb, s) : downwardDb(inDb, s));

  // ── Compression curve ────────────────────────────────────────────────────────
  function compCurve(container, initial) {
    const W = 400, H = 380, pad = 12, LV0 = -60, LV1 = 0;
    const X = d => pad + (d - LV0) / (LV1 - LV0) * (W - 2 * pad);
    const Y = d => H - pad - (Math.min(Math.max(d, LV0 - 6), LV1 + 6) - LV0) / (LV1 - LV0) * (H - 2 * pad);
    container.innerHTML = `
      <div class="kp-peak kp-peak--square">
        <svg viewBox="0 0 ${W} ${H}" aria-hidden="true">
          <defs><clipPath id="kp-comp-clip"><rect x="${pad}" y="${pad}" width="${W - 2 * pad}" height="${H - 2 * pad}" rx="6"/></clipPath></defs>
          <rect class="kp-frame" x="${pad}" y="${pad}" width="${W - 2 * pad}" height="${H - 2 * pad}" rx="6"/>
          <g class="kp-scaffold"></g>
          <g clip-path="url(#kp-comp-clip)"><path class="kp-change-fill" d=""/><g class="kp-thr"></g><path class="kp-curve kp-comp" d=""/></g>
        </svg>
        <figcaption class="kp-readouts">
          <span><span data-l="a"></span> <b data-r="a"></b></span>
          <span><span data-l="b"></span> <b data-r="b"></b></span>
        </figcaption>
      </div>`;
    const $ = sel => container.querySelector(sel);
    const sc = [];
    [-48, -36, -24, -12].forEach(d => {
      sc.push(line('kp-grid', X(d), pad, X(d), H - pad), line('kp-grid', pad, Y(d), W - pad, Y(d)));
      sc.push(`<text class="kp-tick" x="${r(X(d))}" y="${H - pad - 6}" text-anchor="middle">${minus(d)}</text>`);
      sc.push(`<text class="kp-tick" x="${pad + 5}" y="${r(Y(d) - 4)}">${minus(d)}</text>`);
    });
    sc.push(line('kp-identity', X(LV0), Y(LV0), X(LV1), Y(LV1)));
    sc.push(`<text class="kp-tick kp-axis-name" x="${W - pad - 5}" y="${H - pad - 6}" text-anchor="end">input, dB</text>`);
    sc.push(`<text class="kp-label" x="${pad + 6}" y="${pad + 14}">output, dB</text>`);
    $('.kp-scaffold').innerHTML = sc.join('');

    function draw(state) {
      const curve = [], diag = [];
      for (let d = LV0; d <= LV1 + 1e-9; d += 0.25) {
        curve.push([X(d), Y(d + gainDb(d, state))]);
        diag.push([X(d), Y(d)]);
      }
      $('.kp-comp').setAttribute('d', pathOf(curve));
      $('.kp-change-fill').setAttribute('d', `${pathOf(curve)}L${diag.slice().reverse().map(p => `${r(p[0])} ${r(p[1])}`).join('L')}Z`);
      $('.kp-change-fill').classList.toggle('is-up', isUp(state));
      const t = state.threshold, k = state.knee;
      $('.kp-thr').innerHTML = (k > 0.5 ? `<rect class="kp-knee-band" x="${r(X(t - k / 2))}" y="${pad}" width="${r(X(t + k / 2) - X(t - k / 2))}" height="${H - 2 * pad}"/>` : '')
        + line('kp-threshold', X(t), pad, X(t), H - pad)
        + `<text class="kp-label" x="${r(X(t) + 5)}" y="${pad + 30}">threshold</text>`;
      if (isUp(state)) {
        $('[data-l="a"]').textContent = 'Added at −40 dB';
        $('[data-r="a"]').textContent = fmtDb(upwardDb(-40, state));
        $('[data-l="b"]').textContent = 'Most added';
        $('[data-r="b"]').textContent = fmtDb(state.range);
      } else {
        $('[data-l="a"]').textContent = 'Reduction at 0 dB';
        $('[data-r="a"]').textContent = fmtDb(downwardDb(0, state));
        $('[data-l="b"]').textContent = 'At −12 dB';
        $('[data-r="b"]').textContent = fmtDb(downwardDb(-12, state));
      }
    }

    draw(initial);
    return { set: state => draw(state) };
  }

  // ── Gain change over time ──────────────────────────────────────────────────────
  // Test signal: a 110 Hz note at −30 dB with a loud passage at −6 dB from 0 to 250 ms
  const T0 = -0.12, T1 = 1.0, LOUD_END = 0.25;
  const SIGNAL = (() => {
    const n = Math.round((T1 - T0) * SR), out = new Float64Array(n);
    const quiet = gainOf(-30), loud = gainOf(-6), ramp = 0.001;
    for (let i = 0; i < n; i++) {
      const t = T0 + i / SR;
      let a = quiet;
      if (t >= 0 && t < LOUD_END) a = loud;
      if (t >= 0 && t < ramp) a = quiet + (loud - quiet) * t / ramp;
      if (t >= LOUD_END && t < LOUD_END + ramp) a = loud + (quiet - loud) * (t - LOUD_END) / ramp;
      out[i] = a * Math.sin(2 * Math.PI * 110 * t);
    }
    return out;
  })();

  const coeff = ms => Math.min(1, 1 - Math.exp(-1 / (Math.max(ms, 0.0001) * 0.001 * SR)));
  const LOOKAHEAD_MS = 20;

  // state: { mode, detector: 'RMS' | 'PEAK', threshold, ratio, knee, range, attack, hold, release, lookahead }
  // The compressor listens to `sidechain` (the signal itself by default) and changes the gain of `signal`
  function compress(state, signal = SIGNAL, sidechain = signal) {
    const n = signal.length, up = isUp(state);
    const rmsWin = Math.round(0.01 * SR), sq = new Float64Array(rmsWin);
    let sum = 0, idx = 0, peak = 0, fast = 0;
    const peakDecay = Math.exp(-1 / (0.010 * SR)), fastDecay = Math.exp(-1 / (0.005 * SR));
    const aC = coeff(state.attack), rC = coeff(state.release);
    const holdSamples = Math.floor((state.hold || 0) * 0.001 * SR);
    const la = state.lookahead > 0;
    const audioDelay = la ? Math.floor(LOOKAHEAD_MS * 0.001 * SR) : 0;
    const gainDelay = la ? Math.max(0, audioDelay - Math.round(state.lookahead * 0.001 * SR)) : 0;
    const raw = new Float64Array(n);
    let s = 1, hold = 0;
    for (let i = 0; i < n; i++) {
      const x = sidechain[i];
      let env;
      if (state.detector === 'PEAK') { peak = Math.abs(x) > peak ? Math.abs(x) : peak * peakDecay; env = peak; }
      else {
        sum += x * x - sq[idx]; sq[idx] = x * x; idx = (idx + 1) % rmsWin;
        env = Math.sqrt(Math.max(0, sum) / rmsWin);
      }
      if (up) { fast = Math.abs(x) > fast ? Math.abs(x) : fast * fastDecay; env = Math.max(env, 0.707 * fast); }
      const target = env < 1e-10 ? 1 : gainOf(gainDb(dB(env), state));
      const falling = target < s;
      let c = falling ? aC : rC;
      if (falling) hold = holdSamples;
      else if (hold > 0) { c = 0; hold--; }
      s += c * (target - s);
      raw[i] = s;
    }
    // Lookahead: the audio is delayed by 20 ms, the gain by 20 ms minus the lookahead
    const gain = new Float64Array(n), out = new Float64Array(n), audio = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      gain[i] = i - gainDelay >= 0 ? raw[i - gainDelay] : raw[0];
      audio[i] = i - audioDelay >= 0 ? signal[i - audioDelay] : 0;
      out[i] = audio[i] * gain[i];
    }
    return { gain, out, audio, audioDelay };
  }

  const VIEWS = { attack: [-0.015, 0.06], release: [-0.06, 0.95] };

  function compTime(container, initial) {
    const W = 640, H = 300, pad = 12, top = 12, h = 262, RANGE_DB = 15;
    container.innerHTML = `
      <div class="kp-peak">
        <svg viewBox="0 0 ${W} ${H}" aria-hidden="true">
          <rect class="kp-frame" x="${pad}" y="${top}" width="${W - 2 * pad}" height="${h}" rx="6"/>
          <g class="kp-scaffold"></g>
          <g class="kp-wave"><path class="kp-removed" d=""/><path class="kp-input" d=""/><path class="kp-curve kp-out" d=""/></g>
          <path class="kp-change-fill kp-time-fill" d=""/><path class="kp-change" d=""/>
        </svg>
        <figcaption class="kp-readouts">
          <span><span data-l="a"></span> <b data-r="a"></b></span>
          <span><span data-l="b"></span> <b data-r="b"></b></span>
          <span><span data-l="c"></span> <b data-r="c"></b></span>
        </figcaption>
      </div>`;
    const $ = sel => container.querySelector(sel);

    function draw(state) {
      const up = isUp(state);
      const [v0, v1] = VIEWS[state.view] || VIEWS.release;
      const res = compress(state);
      const X = t => pad + (t - v0) / (v1 - v0) * (W - 2 * pad);
      // Gain change: reduction hangs from the top, increase rises from the bottom
      const G = d => up ? top + h - 22 - Math.min(1, Math.max(0, d / RANGE_DB)) * (h - 40)
                        : top + 18 + Math.min(1, Math.max(0, -d / RANGE_DB)) * (h - 40);
      const tOf = i => T0 + (i - res.audioDelay) / SR;
      const i0 = Math.max(res.audioDelay, Math.round((v0 - T0) * SR) + res.audioDelay);
      const i1 = Math.min(SIGNAL.length - 1, Math.round((v1 - T0) * SR) + res.audioDelay);
      const stride = Math.max(1, Math.round((i1 - i0) / 1400));
      const mid = top + h / 2 + 6, amp = (h - 44) / 2 / 0.62, WY = v => mid - v * amp;
      const gPts = [], inPts = [], outPts = [];
      for (let i = i0; i <= i1; i += stride) {
        const x = X(tOf(i));
        gPts.push([x, G(dB(res.gain[i]))]);
        inPts.push([x, WY(res.audio[i])]);
        outPts.push([x, WY(res.out[i])]);
      }
      $('.kp-change').setAttribute('d', pathOf(gPts));
      const base = G(0);
      $('.kp-time-fill').setAttribute('d', `${pathOf(gPts)}L${r(X(v1))} ${r(base)}L${r(X(v0))} ${r(base)}Z`);
      $('.kp-time-fill').classList.toggle('is-up', up);
      $('.kp-change').classList.toggle('is-up', up);
      $('.kp-input').setAttribute('d', pathOf(inPts));
      $('.kp-out').setAttribute('d', pathOf(outPts));
      $('.kp-removed').setAttribute('d', `${pathOf(inPts)}L${outPts.slice().reverse().map(p => `${r(p[0])} ${r(p[1])}`).join('L')}Z`);

      const sc = [];
      [5, 10].forEach(d => {
        const y = G(up ? d : -d);
        sc.push(line('kp-grid', pad, y, W - pad, y));
        sc.push(`<text class="kp-tick" x="${pad + 6}" y="${r(y - 3)}">${up ? '+' : '−'}${d} dB</text>`);
      });
      sc.push(line('kp-axis', pad, base, W - pad, base));
      sc.push(`<text class="kp-label" x="${pad + 6}" y="${top + 13}">${up ? 'gain increase' : 'gain reduction'}</text>`);
      const thr = gainOf(state.threshold);
      [1, -1].forEach(k => sc.push(line('kp-ceiling', pad, WY(k * thr), W - pad, WY(k * thr))));
      sc.push(`<text class="kp-tick" x="${W - pad - 6}" y="${r(WY(thr) - 4)}" text-anchor="end">threshold</text>`);
      const marks = state.view === 'attack' ? [[0, 'loud']] : [[0, 'loud'], [LOUD_END, 'quiet']];
      marks.forEach(([t, label]) => {
        sc.push(line('kp-identity', X(t), top, X(t), top + h));
        sc.push(`<text class="kp-label" x="${r(X(t) + 5)}" y="${top + h - 22}">${label}</text>`);
      });
      const step = state.view === 'attack' ? 0.01 : 0.1;
      for (let t = Math.ceil(v0 / step) * step; t <= v1 + 1e-9; t += step) {
        sc.push(`<text class="kp-tick" x="${r(X(t))}" y="${top + h - 6}" text-anchor="middle">${Math.abs(t) < 1e-9 ? '0' : Math.round(t * 1000)} ms</text>`);
      }
      $('.kp-scaffold').innerHTML = sc.join('');

      // Readouts
      const at = t => res.gain[Math.min(res.gain.length - 1, Math.round((t - T0) * SR) + res.audioDelay)];
      if (up) {
        const quietBoost = dB(at(-0.005));
        let inLoud = 0; for (let t = 0.1; t < LOUD_END; t += 0.005) inLoud = Math.max(inLoud, dB(at(t)));
        let back = null;
        for (let t = LOUD_END; t < T1 - 0.03; t += 0.0005) if (dB(at(t)) >= quietBoost - 1) { back = t - LOUD_END; break; }
        $('[data-l="a"]').textContent = 'Quiet part';
        $('[data-r="a"]').textContent = fmtDb(quietBoost);
        $('[data-l="b"]').textContent = 'Loud part';
        $('[data-r="b"]').textContent = fmtDb(inLoud);
        $('[data-l="c"]').textContent = 'Boost back after';
        $('[data-r="c"]').textContent = back === null ? '–' : `${Math.round(back * 1000)} ms`;
      } else {
        let deepest = 0; for (let t = 0; t < LOUD_END; t += 0.0005) deepest = Math.min(deepest, dB(at(t)));
        let reach = null; for (let t = -0.02; t < LOUD_END; t += 0.00005) if (dB(at(t)) <= deepest * 0.9) { reach = t; break; }
        let back = null;
        for (let t = LOUD_END; t < T1 - 0.03; t += 0.0005) if (dB(at(t)) > -1) { back = t - LOUD_END; break; }
        $('[data-l="a"]').textContent = 'Deepest';
        $('[data-r="a"]').textContent = fmtDb(deepest);
        $('[data-l="b"]').textContent = '90% reached';
        $('[data-r="b"]').textContent = reach === null ? '–' : reach < 0 ? `${(-reach * 1000).toFixed(1)} ms early` : `after ${(reach * 1000).toFixed(1)} ms`;
        $('[data-l="c"]').textContent = 'Back within 1 dB';
        $('[data-r="c"]').textContent = back === null ? 'not yet' : `after ${Math.round(back * 1000)} ms`;
      }
    }

    draw(initial);
    return { set: state => draw(state) };
  }

  // ── Sidechain EQ (KrystalComp's ThreeBandEQ: Butterworth high/low-pass cascades and a bell) ───────────
  function biquad(b0, b1, b2, a0, a1, a2) { return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0]; }
  function highPass(f, q) {
    const n = Math.tan(Math.PI * f / SR), n2 = n * n, c1 = 1 / (1 + n / q + n2);
    return [c1, -2 * c1, c1, c1 * 2 * (n2 - 1), c1 * (1 - n / q + n2)];
  }
  function lowPass(f, q) {
    const n = 1 / Math.tan(Math.PI * f / SR), n2 = n * n, c1 = 1 / (1 + n / q + n2);
    return [c1, 2 * c1, c1, c1 * 2 * (1 - n2), c1 * (1 - n / q + n2)];
  }
  function bell(f, q, gainDb) {
    const A = Math.sqrt(gainOf(gainDb)), w = 2 * Math.PI * f / SR, alpha = Math.sin(w) / (2 * q), c2 = -2 * Math.cos(w);
    return biquad(1 + alpha * A, c2, 1 - alpha * A, 1 + alpha / A, c2, 1 - alpha / A);
  }
  const sectionQ = (n, i) => 1 / (2 * Math.sin(Math.PI * (2 * i + 1) / (4 * n)));
  // eq: { hpf, hpfSlope (12-48), bell, bellGain, bellQ, lpf, lpfSlope }; filters at the ends of the range are off
  function sidechainEq(x, eq = {}) {
    const chain = [];
    const sections = slope => Math.max(1, Math.min(4, Math.round((slope || 12) / 12)));
    if ((eq.hpf || 20) > 20.5) { const n = sections(eq.hpfSlope); for (let i = 0; i < n; i++) chain.push(highPass(eq.hpf, sectionQ(n, i))); }
    if (Math.abs(eq.bellGain || 0) >= 0.1) chain.push(bell(eq.bell || 1000, eq.bellQ || 1, Math.max(-24, Math.min(24, eq.bellGain))));
    if ((eq.lpf || 20000) < 19950) { const n = sections(eq.lpfSlope); for (let i = 0; i < n; i++) chain.push(lowPass(eq.lpf, sectionQ(n, i))); }
    let y = x;
    chain.forEach(([b0, b1, b2, a1, a2]) => {
      const out = new Float64Array(y.length);
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < y.length; i++) {
        const v = b0 * y[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = y[i]; y2 = y1; y1 = v; out[i] = v;
      }
      y = out;
    });
    return y;
  }

  // Test mix over 1 s: a kick every 250 ms, a sustained voice around 440 Hz, and two sibilant bursts at 6.5 kHz
  const MIX_LEN = 1.0;
  const MIX = (() => {
    const n = Math.round(MIX_LEN * SR), out = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let v = 0.16 * Math.sin(2 * Math.PI * 440 * t + 0.6 * Math.sin(2 * Math.PI * 5 * t))
            + 0.06 * Math.sin(2 * Math.PI * 880 * t + 0.6 * Math.sin(2 * Math.PI * 5 * t));
      const k = t % 0.25;
      if (k < 0.2) v += 0.75 * Math.min(1, k / 0.002) * Math.exp(-k / 0.06) * Math.sin(2 * Math.PI * (48 * k + 90 * 0.015 * (1 - Math.exp(-k / 0.015))));
      [0.36, 0.86].forEach(s0 => {
        const d = t - s0;
        if (d >= 0 && d < 0.07) v += 0.16 * Math.sin(Math.PI * d / 0.07) * Math.sin(2 * Math.PI * 6500 * t);
      });
      out[i] = v;
    }
    return out;
  })();
  const SC_COMP = { mode: 'DWRD', detector: 'RMS', threshold: -22, ratio: 4, knee: 6, range: 60, attack: 5, hold: 0, release: 120, lookahead: 0 };

  // Gain reduction on the test mix with a given sidechain EQ, with the compressed waveform behind it
  function sidechainSVG(eq, { width = 420, height = 200 } = {}) {
    const res = compress(SC_COMP, MIX, sidechainEq(MIX, eq));
    const W = width, H = height, pad = 10, n = MIX.length, stride = Math.max(1, Math.round(n / 1400));
    const X = i => pad + i / (n - 1) * (W - 2 * pad);
    const mid = H / 2 + 8, amp = (H / 2 - 24) / 0.95;
    const G = d => pad + 14 + Math.min(1, Math.max(0, -d / 12)) * (H - 2 * pad - 28);
    const wave = [], gr = [];
    let deepest = 0, sum = 0;
    for (let i = 0; i < n; i += stride) {
      wave.push([X(i), mid - res.out[i] * amp]);
      const d = dB(res.gain[i]);
      gr.push([X(i), G(d)]);
      deepest = Math.min(deepest, d);
      sum += d;
    }
    const avg = sum / gr.length;
    const grid = [-6].map(d => `${line('kp-grid', pad, G(d), W - pad, G(d))}<text class="kp-tick" x="${pad + 5}" y="${r(G(d) - 3)}">−${-d} dB</text>`).join('');
    const svg = `<div class="kp-plot"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gain reduction on a test mix">
      <rect class="kp-frame" x="${pad}" y="${pad}" width="${W - 2 * pad}" height="${H - 2 * pad}" rx="6"/>${grid}
      ${line('kp-axis', pad, G(0), W - pad, G(0))}
      <path class="kp-sc-wave" d="${pathOf(wave)}"/>
      <path class="kp-change-fill kp-time-fill" d="${pathOf(gr)}L${r(X(n - 1))} ${r(G(0))}L${r(X(0))} ${r(G(0))}Z"/><path class="kp-change" d="${pathOf(gr)}"/>
    </svg></div>`;
    return { svg, deepest, average: avg, stat: `Average reduction ${fmtDb(avg)}, deepest ${fmtDb(deepest)}` };
  }

  window.KDScopes = Object.assign(window.KDScopes || {}, { compCurve, compTime });
  window.KDPanels = Object.assign(window.KDPanels || {}, { compSidechain: (state, opts) => sidechainSVG(state, opts) });
  window.KDComp = { downwardDb, upwardDb, compress, sidechainEq, sidechainSVG, MIX };
})();
