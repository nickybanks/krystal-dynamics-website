// KrystalField plots: the combined downward and upward curve, and the gain change over time, computed from the
// plugin's own processing (KrystalField: Source/GainComputers.h, EnvelopeDetector.h, SmoothingFilter.h,
// SidechainEQ.h, DynamicProcessor.h).
//
//   KDScopes.fieldCurve(container, state)   output against input level, with the window between the thresholds
//   KDScopes.fieldTime(container, state)    gain change over time on a quiet-loud-quiet phrase, waveform behind
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

  // Thresholds from the target (centre of the window) and the range, as the TARGET and RANGE knobs set them
  function thresholds(s) {
    const upper = Math.min(0, Math.max(-30, s.target + s.range / 2));
    return { upper, lower: upper - s.range };
  }

  // ── Gain computers (dB in, dB of gain change out) ──────────────────────────────
  function downwardDb(inDb, threshold, ratio, knee) {
    const inv = 1 / Math.max(1, ratio);
    if (knee > 0.01) {
      const ks = threshold - knee / 2, ke = threshold + knee / 2;
      if (inDb <= ks) return 0;
      if (inDb < ke) { const x = inDb - ks; return -(x * x / knee * 0.5 * (1 - inv)); }
      return -(inDb - threshold) * (1 - inv);
    }
    return inDb > threshold ? -(inDb - threshold) * (1 - inv) : 0;
  }
  // Upward, with the protection of very quiet signals tied to the knee
  function upwardDb(inDb, threshold, ratio, knee) {
    const inv = 1 / Math.max(1, ratio);
    let g = 0;
    if (knee > 0.01) {
      const ks = threshold - knee / 2, ke = threshold + knee / 2;
      if (inDb >= ke) g = 0;
      else if (inDb > ks) { const x = ke - inDb; g = x * x / knee * 0.5 * (1 - inv); }
      else g = (threshold - inDb) * (1 - inv);
    } else if (inDb < threshold) g = (threshold - inDb) * (1 - inv);
    const offset = 100 - Math.pow(Math.min(1, Math.max(0, knee / 72)), 0.4) * 80;
    const ignoreKnee = 10 + knee / 2, d = inDb - (threshold - offset);
    const f = d > ignoreKnee ? 1 : d > 0 ? (x => x * x * (3 - 2 * x))(d / ignoreKnee) : offset > 95 ? 1 : 0;
    return Math.min(40, g * f);
  }
  function gainDb(inDb, s) {
    const { upper, lower } = thresholds(s);
    return downwardDb(inDb, upper, s.downRatio, s.downKnee) + upwardDb(inDb, lower, s.upRatio, s.upKnee);
  }

  // ── Curve ──────────────────────────────────────────────────────────────────────
  function fieldCurve(container, initial) {
    const W = 400, H = 380, pad = 12, LV0 = -60, LV1 = 0;
    const X = d => pad + (d - LV0) / (LV1 - LV0) * (W - 2 * pad);
    const Y = d => H - pad - (Math.min(Math.max(d, LV0 - 8), LV1 + 8) - LV0) / (LV1 - LV0) * (H - 2 * pad);
    container.innerHTML = `
      <div class="kp-peak kp-peak--square">
        <svg viewBox="0 0 ${W} ${H}" aria-hidden="true">
          <defs><clipPath id="kp-field-clip"><rect x="${pad}" y="${pad}" width="${W - 2 * pad}" height="${H - 2 * pad}" rx="6"/></clipPath></defs>
          <rect class="kp-frame" x="${pad}" y="${pad}" width="${W - 2 * pad}" height="${H - 2 * pad}" rx="6"/>
          <g class="kp-scaffold"></g>
          <g clip-path="url(#kp-field-clip)">
            <g class="kp-window"></g>
            <path class="kp-field-up" d=""/><path class="kp-field-down" d=""/>
            <path class="kp-curve kp-field" d=""/>
          </g>
        </svg>
        <figcaption class="kp-readouts">
          <span>Lower <b data-r="lo"></b></span>
          <span>Upper <b data-r="up"></b></span>
          <span>At 0 dB <b data-r="top"></b></span>
          <span>At −40 dB <b data-r="low"></b></span>
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
      const { upper, lower } = thresholds(state);
      const curve = [], up = [], down = [];
      for (let d = LV0; d <= LV1 + 1e-9; d += 0.25) {
        const g = gainDb(d, state);
        curve.push([X(d), Y(d + g)]);
        up.push([X(d), Y(d + Math.max(0, g))]);
        down.push([X(d), Y(d + Math.min(0, g))]);
      }
      const diag = curve.map((p, i) => [p[0], Y(LV0 + i * 0.25)]).reverse().map(p => `${r(p[0])} ${r(p[1])}`).join('L');
      $('.kp-field').setAttribute('d', pathOf(curve));
      $('.kp-field-up').setAttribute('d', `${pathOf(up)}L${diag}Z`);
      $('.kp-field-down').setAttribute('d', `${pathOf(down)}L${diag}Z`);
      $('.kp-window').innerHTML = `<rect class="kp-window-band" x="${r(X(lower))}" y="${pad}" width="${r(X(upper) - X(lower))}" height="${H - 2 * pad}"/>`
        + line('kp-threshold', X(lower), pad, X(lower), H - pad) + line('kp-threshold', X(upper), pad, X(upper), H - pad)
        + `<text class="kp-label" x="${r(X(lower) + 5)}" y="${pad + 30}">lower</text><text class="kp-label" x="${r(X(upper) + 5)}" y="${pad + 30}">upper</text>`;
      $('[data-r="lo"]').textContent = `${minus(Math.round(lower * 10) / 10)} dB`;
      $('[data-r="up"]').textContent = `${minus(Math.round(upper * 10) / 10)} dB`;
      $('[data-r="top"]').textContent = fmtDb(gainDb(0, state));
      $('[data-r="low"]').textContent = fmtDb(gainDb(-40, state));
    }

    draw(initial);
    return { set: state => draw(state) };
  }

  // ── Filters for the detector (JUCE biquad formulas) ────────────────────────────
  function highPass(f, q) {
    const n = Math.tan(Math.PI * f / SR), n2 = n * n, c1 = 1 / (1 + n / q + n2);
    return [c1, -2 * c1, c1, c1 * 2 * (n2 - 1), c1 * (1 - n / q + n2)];
  }
  function highShelf(f, q, gain) {
    const A = Math.sqrt(gain), am = A - 1, ap = A + 1, w = 2 * Math.PI * f / SR, c = Math.cos(w);
    const beta = Math.sin(w) * Math.sqrt(A) / q, amc = am * c;
    const b0 = A * (ap + amc + beta), b1 = A * -2 * (am + ap * c), b2 = A * (ap + amc - beta);
    const a0 = ap - amc + beta, a1 = 2 * (am - ap * c), a2 = ap - amc - beta;
    return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  }
  function filter(x, [b0, b1, b2, a1, a2]) {
    const out = new Float64Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = v; out[i] = v;
    }
    return out;
  }

  // ── Gain change over time ──────────────────────────────────────────────────────
  // Test phrase: a 220 Hz note at −40 dB, loud at −6 dB from 0 to 300 ms, then quiet again
  const T0 = -0.4, T1 = 1.0, LOUD_END = 0.3;
  const SIGNAL = (() => {
    const n = Math.round((T1 - T0) * SR), out = new Float64Array(n);
    const quiet = gainOf(-40), loud = gainOf(-6), ramp = 0.002;
    for (let i = 0; i < n; i++) {
      const t = T0 + i / SR;
      let a = quiet;
      if (t >= 0 && t < LOUD_END) a = loud;
      if (t >= 0 && t < ramp) a = quiet + (loud - quiet) * t / ramp;
      if (t >= LOUD_END && t < LOUD_END + ramp) a = loud + (quiet - loud) * (t - LOUD_END) / ramp;
      out[i] = a * Math.sin(2 * Math.PI * 220 * t);
    }
    return out;
  })();
  const coeff = ms => Math.min(1, 1 - Math.exp(-1 / (Math.max(ms, 0.0001) * 0.001 * SR)));

  // state: { detector: 'RMS' | 'PEAK' | 'LOUD', target, range, downRatio, downKnee, upRatio, upKnee, attack, release,
  //          lookahead, lfBias }
  function process(state, signal = SIGNAL) {
    const n = signal.length;
    let sc = filter(signal, highPass(state.lfBias || 60, 0.707));
    const mode = state.detector || 'PEAK';
    let env = new Float64Array(n);
    if (mode === 'PEAK') {
      const decay = Math.exp(-1 / (0.010 * SR));
      let p = 0;
      for (let i = 0; i < n; i++) { const a = Math.abs(sc[i]); p = a > p ? a : p * decay; env[i] = p; }
    } else {
      if (mode === 'LOUD') sc = filter(filter(sc, highPass(38, 0.5)), highShelf(1500, 1 / Math.SQRT2, gainOf(4.044)));
      const win = Math.round((mode === 'LOUD' ? 0.05 : 0.015) * SR), sq = new Float64Array(win);
      let sum = 0, idx = 0;
      for (let i = 0; i < n; i++) {
        sum += sc[i] * sc[i] - sq[idx]; sq[idx] = sc[i] * sc[i]; idx = (idx + 1) % win;
        env[i] = Math.sqrt(Math.max(0, sum) / win);
      }
    }
    const aC = coeff(state.attack), rC = coeff(state.release);
    const holdSamples = Math.floor(Math.max(0, (state.lookahead || 0) - state.attack) * 0.001 * SR);
    const delay = Math.round((state.lookahead || 0) * 0.001 * SR);
    const gain = new Float64Array(n), audio = new Float64Array(n), out = new Float64Array(n);
    let s = 1, hold = 0;
    for (let i = 0; i < n; i++) {
      const target = env[i] < 1e-10 ? 1 : gainOf(gainDb(dB(env[i]), state));
      let c;
      if (target < s) { c = aC; hold = holdSamples; }
      else if (hold <= 0) c = rC;
      else { c = 0; hold--; }
      s += c * (target - s);
      gain[i] = s;
      audio[i] = i - delay >= 0 ? signal[i - delay] : 0;
      out[i] = audio[i] * s;
    }
    return { gain, audio, out, delay };
  }

  const VIEWS = { attack: [-0.01, 0.05], full: [-0.3, 0.95] };

  function fieldTime(container, initial) {
    const W = 640, H = 300, pad = 12, top = 12, h = 262, RANGE_DB = 15;
    container.innerHTML = `
      <div class="kp-peak">
        <svg viewBox="0 0 ${W} ${H}" aria-hidden="true">
          <rect class="kp-frame" x="${pad}" y="${top}" width="${W - 2 * pad}" height="${h}" rx="6"/>
          <g class="kp-scaffold"></g>
          <g class="kp-wave"><path class="kp-removed" d=""/><path class="kp-input" d=""/><path class="kp-curve kp-out" d=""/></g>
          <path class="kp-field-up" d=""/><path class="kp-field-down" d=""/><path class="kp-field-gain" d=""/>
        </svg>
        <figcaption class="kp-readouts">
          <span>Quiet part <b data-r="q"></b></span>
          <span>Loud part <b data-r="l"></b></span>
          <span>Boost back after <b data-r="b"></b></span>
        </figcaption>
      </div>`;
    const $ = sel => container.querySelector(sel);

    function draw(state) {
      const [v0, v1] = VIEWS[state.view] || VIEWS.full;
      const res = process(state);
      const X = t => pad + (t - v0) / (v1 - v0) * (W - 2 * pad);
      const mid = top + h / 2;
      const G = d => mid - Math.max(-RANGE_DB, Math.min(RANGE_DB, d)) / RANGE_DB * (h / 2 - 16);
      const amp = (h / 2 - 16) / 0.55, WY = v => mid - v * amp;
      const tOf = i => T0 + (i - res.delay) / SR;
      const i0 = Math.max(res.delay, Math.round((v0 - T0) * SR) + res.delay);
      const i1 = Math.min(SIGNAL.length - 1, Math.round((v1 - T0) * SR) + res.delay);
      const stride = Math.max(1, Math.round((i1 - i0) / 1400));
      const g = [], inP = [], outP = [];
      for (let i = i0; i <= i1; i += stride) {
        const x = X(tOf(i));
        g.push([x, G(dB(res.gain[i]))]);
        inP.push([x, WY(res.audio[i])]);
        outP.push([x, WY(res.out[i])]);
      }
      const base = `L${r(X(v1))} ${r(mid)}L${r(X(v0))} ${r(mid)}Z`;
      $('.kp-field-gain').setAttribute('d', pathOf(g));
      $('.kp-field-up').setAttribute('d', `${pathOf(g.map(p => [p[0], Math.min(p[1], mid)]))}${base}`);
      $('.kp-field-down').setAttribute('d', `${pathOf(g.map(p => [p[0], Math.max(p[1], mid)]))}${base}`);
      $('.kp-input').setAttribute('d', pathOf(inP));
      $('.kp-out').setAttribute('d', pathOf(outP));
      $('.kp-removed').setAttribute('d', `${pathOf(inP)}L${outP.slice().reverse().map(p => `${r(p[0])} ${r(p[1])}`).join('L')}Z`);

      const sc = [];
      [-10, -5, 5, 10].forEach(d => {
        sc.push(line('kp-grid', pad, G(d), W - pad, G(d)));
        sc.push(`<text class="kp-tick" x="${pad + 6}" y="${r(G(d) - 3)}">${d > 0 ? '+' : '−'}${Math.abs(d)} dB</text>`);
      });
      sc.push(line('kp-axis', pad, mid, W - pad, mid));
      sc.push(`<text class="kp-label" x="${pad + 6}" y="${top + 13}">gain change</text>`);
      const marks = state.view === 'attack' ? [[0, 'loud']] : [[0, 'loud'], [LOUD_END, 'quiet']];
      marks.forEach(([t, label]) => {
        sc.push(line('kp-identity', X(t), top, X(t), top + h));
        sc.push(`<text class="kp-label" x="${r(X(t) + 5)}" y="${top + h - 22}">${label}</text>`);
      });
      const step = state.view === 'attack' ? 0.01 : 0.2;
      for (let t = Math.ceil(v0 / step) * step; t <= v1 + 1e-9; t += step) {
        sc.push(`<text class="kp-tick" x="${r(X(t))}" y="${top + h - 6}" text-anchor="middle">${Math.abs(t) < 1e-9 ? '0' : Math.round(t * 1000)} ms</text>`);
      }
      $('.kp-scaffold').innerHTML = sc.join('');

      const at = t => dB(res.gain[Math.min(res.gain.length - 1, Math.round((t - T0) * SR) + res.delay)]);
      const quiet = at(-0.02);
      let loud = 0; for (let t = 0.1; t < LOUD_END; t += 0.005) loud = Math.min(loud, at(t));
      let back = null;
      for (let t = LOUD_END; t < T1 - 0.03; t += 0.001) if (at(t) >= quiet - 1) { back = t - LOUD_END; break; }
      $('[data-r="q"]').textContent = fmtDb(quiet);
      $('[data-r="l"]').textContent = fmtDb(loud);
      $('[data-r="b"]').textContent = back === null ? 'not yet' : `${Math.round(back * 1000)} ms`;
    }

    draw(initial);
    return { set: state => draw(state) };
  }

  // ── Comparison panels (two side by side under a feature section) ───────────────
  const PANEL_BASE = { detector: 'PEAK', target: -18, range: 12, downRatio: 4, downKnee: 24, upRatio: 3, upKnee: 40,
                       attack: 1, release: 144, lookahead: 0, lfBias: 60 };

  // Upward knee: the curve below the window, with the noise floor region shaded
  function upwardPanel(state, { width = 420, height = 220 } = {}) {
    const s = { ...PANEL_BASE, ...state };
    const W = width, H = height, pad = 10, LV0 = -78, LV1 = -6, OV0 = -80, OV1 = -2;
    const X = d => pad + (d - LV0) / (LV1 - LV0) * (W - 2 * pad);
    const Y = d => H - pad - (Math.min(Math.max(d, OV0 - 6), OV1 + 6) - OV0) / (OV1 - OV0) * (H - 2 * pad);
    const { lower } = thresholds(s);
    const curve = [], diag = [];
    for (let d = LV0; d <= LV1 + 1e-9; d += 0.25) { curve.push([X(d), Y(d + gainDb(d, s))]); diag.push([X(d), Y(d)]); }
    const noiseEnd = -54;
    const grid = [-66, -54, -42, -30, -18].map(d => `${line('kp-grid', X(d), pad, X(d), H - pad)}<text class="kp-tick" x="${r(X(d))}" y="${H - pad - 5}" text-anchor="middle">${minus(d)}</text>`).join('');
    const svg = `<div class="kp-plot"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Upward compression curve">
      <defs><clipPath id="kp-upw-${++uid}"><rect x="${pad}" y="${pad}" width="${W - 2 * pad}" height="${H - 2 * pad}" rx="6"/></clipPath></defs>
      <rect class="kp-frame" x="${pad}" y="${pad}" width="${W - 2 * pad}" height="${H - 2 * pad}" rx="6"/>${grid}
      <g clip-path="url(#kp-upw-${uid})">
        <rect class="kp-noise-band" x="${pad}" y="${pad}" width="${r(X(noiseEnd) - pad)}" height="${H - 2 * pad}"/>
        <text class="kp-label" x="${pad + 6}" y="${pad + 14}">noise floor</text>
        ${line('kp-identity', X(LV0), Y(LV0), X(LV1), Y(LV1))}${line('kp-threshold', X(lower), pad, X(lower), H - pad)}
        <text class="kp-label" x="${r(X(lower) + 5)}" y="${pad + 14}">lower</text>
        <path class="kp-field-up" d="${pathOf(curve)}L${diag.slice().reverse().map(p => `${r(p[0])} ${r(p[1])}`).join('L')}Z"/>
        <path class="kp-curve kp-field" d="${pathOf(curve)}"/>
      </g></svg></div>`;
    return { svg, stat: `Lift: ${fmtDb(gainDb(-36, s))} at −36 dB, ${fmtDb(gainDb(-66, s))} at −66 dB` };
  }
  let uid = 0;

  // LF bias: a kick every 250 ms under a sustained voice, gain change over time with the waveform behind
  const MIX = (() => {
    const n = Math.round(1.0 * SR), out = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR, k = t % 0.25;
      let v = 0.11 * Math.sin(2 * Math.PI * 440 * t + 0.6 * Math.sin(2 * Math.PI * 5 * t)) + 0.04 * Math.sin(2 * Math.PI * 880 * t);
      if (k < 0.2) v += 0.6 * Math.min(1, k / 0.002) * Math.exp(-k / 0.06) * Math.sin(2 * Math.PI * (50 * k + 40 * 0.012 * (1 - Math.exp(-k / 0.012))));
      out[i] = v;
    }
    return out;
  })();
  function lfBiasPanel(state, { width = 420, height = 200 } = {}) {
    const s = { ...PANEL_BASE, ...state };
    const res = process(s, MIX);
    const W = width, H = height, pad = 10, n = MIX.length, stride = Math.max(1, Math.round(n / 1400));
    const X = i => pad + i / (n - 1) * (W - 2 * pad);
    // 0 dB near the top: the kicks pull the gain down from there, the waveform sits behind
    const zero = pad + 26, perDb = (H * 0.56 - zero) / 9, G = d => zero - Math.max(-9, Math.min(3, d)) * perDb;
    const mid = H * 0.71, amp = (H - pad - 6 - mid) / 0.7;
    const g = [], wave = [];
    let lo = 99, hi = -99;
    const skip = Math.round(0.25 * SR);   // past the start
    for (let i = 0; i < n; i += stride) {
      const d = dB(res.gain[i]);
      g.push([X(i), G(d)]);
      wave.push([X(i), mid - res.out[i] * amp]);
      if (i > skip) { lo = Math.min(lo, d); hi = Math.max(hi, d); }
    }
    const base = `L${r(X(n - 1))} ${r(zero)}L${r(X(0))} ${r(zero)}Z`;
    const grid = [-6].map(d => `${line('kp-grid', pad, G(d), W - pad, G(d))}<text class="kp-tick" x="${pad + 5}" y="${r(G(d) - 3)}">${d > 0 ? '+' : '−'}${Math.abs(d)} dB</text>`).join('');
    const svg = `<div class="kp-plot"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gain change on a test mix">
      <rect class="kp-frame" x="${pad}" y="${pad}" width="${W - 2 * pad}" height="${H - 2 * pad}" rx="6"/>${grid}
      <path class="kp-sc-wave" d="${pathOf(wave)}"/>
      ${line('kp-axis', pad, zero, W - pad, zero)}<text class="kp-tick" x="${pad + 5}" y="${r(zero - 3)}">0 dB</text>
      <path class="kp-field-up" d="${pathOf(g.map(p => [p[0], Math.min(p[1], zero)]))}${base}"/>
      <path class="kp-field-down" d="${pathOf(g.map(p => [p[0], Math.max(p[1], zero)]))}${base}"/>
      <path class="kp-field-gain" d="${pathOf(g)}"/>
    </svg></div>`;
    return { svg, stat: `Each kick pulls the gain to ${fmtDb(lo)}`, swing: hi - lo };
  }

  window.KDScopes = Object.assign(window.KDScopes || {}, { fieldCurve, fieldTime });
  window.KDPanels = Object.assign(window.KDPanels || {}, { fieldUpward: upwardPanel, fieldLfBias: lfBiasPanel });
  window.KDField = { thresholds, gainDb, process, upwardPanel, lfBiasPanel };
})();
