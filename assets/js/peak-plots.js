// KrystalPeak plots: the limiter and the upward compression, computed from the plugin's own processing
// (KrystalPeak: Source/DynamicProcessor.h, SmoothingFilter.h, UpwardGainComputer.h).
//
//   KDScopes.peakLimiter(container, state)   gain reduction over time on a test signal
//   KDScopes.peakUpward(container, state)    upward compression curve, output against input level
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
  const ms = s => s * 1000;

  // ── Limiter (one channel of KrystalPeak's limiter) ─────────────────────────────
  const LOOKAHEAD_MS = 23;
  const MODE_LOOKAHEAD_MS = [23, 5, 3];          // Clean, Punch, Brick
  const BRICK_RAMP_MS = [0.1, 3];
  const HOLD_MS = [11.5, 11.5, 25];
  const HOLD_TOLERANCE = [1, gainOf(0.05), gainOf(0.05)];
  const AUTO_FAST_MS = 92, AUTO_SLOW_MS = 1000;
  const coeff = t => Math.min(1, 1 - Math.exp(-1 / (Math.max(t, 0.0001) * 0.001 * SR)));
  const samples = t => Math.round(t * 0.001 * SR);

  // Test signal: a steady bass line with two kick drums, the first at 0 s, the second at 0.26 s
  const T0 = -0.08, T1 = 0.66, HIT2 = 0.26;
  function kick(t, amp) {
    if (t < 0) return 0;
    const phase = 2 * Math.PI * (50 * t + 120 * 0.012 * (1 - Math.exp(-t / 0.012)));
    return amp * Math.min(1, t / 0.0005) * Math.exp(-t / 0.07) * Math.sin(phase);
  }
  const SIGNAL = (() => {
    const n = Math.round((T1 - T0) * SR), out = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const t = T0 + i / SR;
      out[i] = 0.42 * Math.sin(2 * Math.PI * 55 * t + 0.3) + kick(t, 1.7) + kick(t - HIT2, 1.35);
    }
    return out;
  })();

  // state: { mode: 'Clean' | 'Punch' | 'Brick', attack: 0-23, release: ms, auto: bool, ceiling: dB }
  function limit(state) {
    const mode = Math.max(0, ['Clean', 'Punch', 'Brick'].indexOf(state.mode));
    const ceiling = gainOf(state.ceiling ?? -0.1);
    const attack = Math.min(Math.max(state.attack ?? 8.2, 0), LOOKAHEAD_MS);
    const L = samples(LOOKAHEAD_MS);
    const ramp = Math.max(1, Math.round((BRICK_RAMP_MS[0] + attack / LOOKAHEAD_MS * (BRICK_RAMP_MS[1] - BRICK_RAMP_MS[0])) * 0.001 * SR));
    const window = mode === 2 ? ramp + 1 : Math.max(1, samples(MODE_LOOKAHEAD_MS[mode]));
    const scDelay = mode === 0 ? 0 : mode === 2 ? L - ramp : L - samples(MODE_LOOKAHEAD_MS[mode]);
    const aCoeff = coeff(mode === 2 ? 0 : Math.min(attack, MODE_LOOKAHEAD_MS[mode]));
    const rCoeff = coeff(state.release ?? 164);
    const fast = coeff(AUTO_FAST_MS), slow = coeff(AUTO_SLOW_MS);
    const holdSamples = Math.floor(HOLD_MS[mode] * 0.001 * SR), tolerance = HOLD_TOLERANCE[mode];

    const n = SIGNAL.length;
    const gain = new Float64Array(n), out = new Float64Array(n), pre = new Float64Array(n);
    const dq = [];
    let head = 0;
    let s = 1, hold = 0;
    const avg = new Float64Array(ramp).fill(1);
    let avgPos = 0, avgSum = ramp;
    for (let i = 0; i < n; i++) {
      // Window maximum of the sidechain (delayed in Punch and Brick)
      const sc = i - scDelay >= 0 ? Math.abs(SIGNAL[i - scDelay]) : 0;
      while (dq.length > head && dq[dq.length - 1][1] <= sc) dq.pop();
      dq.push([i, sc]);
      while (dq[head][0] <= i - window) head++;
      if (head > 4096) { dq.splice(0, head); head = 0; }
      const peak = dq[head][1];
      const target = peak <= ceiling || peak < 1e-10 ? 1 : ceiling / peak;
      // Attack / hold / release smoothing
      let c;
      if (target < s) { c = aCoeff; hold = holdSamples; }
      else if (tolerance > 1 && target <= s * tolerance) { c = 0; hold = holdSamples; }
      else if (hold <= 0) c = state.auto ? slow + (fast - slow) * (1 - s) : rCoeff;
      else { c = 0; hold--; }
      s += c * (target - s);
      let g = s;
      if (mode === 2) {   // Brick: moving average, a linear ramp into the peak
        avgSum += g - avg[avgPos];
        avg[avgPos] = g;
        avgPos = (avgPos + 1) % ramp;
        g = avgSum / ramp;
      }
      const audio = i - L >= 0 ? SIGNAL[i - L] : 0;
      gain[i] = g;
      pre[i] = audio * g;
      out[i] = Math.max(-ceiling, Math.min(ceiling, pre[i]));
    }
    return { gain, out, pre, L, ceiling };
  }

  const VIEWS = { peak: [-0.026, 0.034], release: [-0.03, 0.6] };

  // Gain reduction over time around the kick: how early it starts, how deep it goes, how it recovers.
  // The dashed line is the reduction the peak needs; if the curve hasn't reached it on the peak, the excess is
  // clipped at the ceiling (marked in red).
  function peakLimiter(container, initial) {
    const W = 640, H = 300, pad = 12, top = 12, h = 262, GR_MIN = -10;
    container.innerHTML = `
      <div class="kp-peak">
        <svg viewBox="0 0 ${W} ${H}" aria-hidden="true">
          <rect class="kp-frame" x="${pad}" y="${top}" width="${W - 2 * pad}" height="${h}" rx="6"/>
          <g class="kp-scaffold"></g>
          <g class="kp-wave"><path class="kp-removed" d=""/><path class="kp-input" d=""/><path class="kp-curve kp-out" d=""/></g>
          <path class="kp-gr-fill" d=""/><path class="kp-gr" d=""/>
          <g class="kp-over"><line x1="0" y1="0" x2="0" y2="0"/><text class="kp-label" x="0" y="0"></text></g>
        </svg>
        <figcaption class="kp-readouts">
          <span>Reduction starts <b data-r="start"></b></span>
          <span>Deepest <b data-r="max"></b></span>
          <span>Clipped at the ceiling <b data-r="clip"></b></span>
        </figcaption>
      </div>`;
    const $ = sel => container.querySelector(sel);

    // Reduction the first kick needs to stay at the ceiling
    let peakIn = 0, peakAt = 0;
    for (let i = 0; i < SIGNAL.length; i++) {
      const t = T0 + i / SR;
      if (t > HIT2 - 0.01) break;
      if (Math.abs(SIGNAL[i]) > peakIn) { peakIn = Math.abs(SIGNAL[i]); peakAt = t; }
    }

    function draw(state) {
      const [v0, v1] = VIEWS[state.view] || VIEWS.peak;
      const res = limit(state);
      const X = t => pad + (t - v0) / (v1 - v0) * (W - 2 * pad);
      const Y = d => top + 18 + Math.min(1, Math.max(0, d / GR_MIN)) * (h - 40);
      const tOf = i => T0 + (i - res.L) / SR;
      const i0 = Math.max(res.L, Math.round((v0 - T0) * SR) + res.L), i1 = Math.min(res.gain.length - 1, Math.round((v1 - T0) * SR) + res.L);
      const stride = Math.max(1, Math.round((i1 - i0) / 1200));
      const pts = []; for (let i = i0; i <= i1; i += stride) pts.push([X(tOf(i)), Y(dB(res.gain[i]))]);
      $('.kp-gr').setAttribute('d', pathOf(pts));
      // Waveform behind the curve: the input in grey, the limited output in the accent colour
      const mid = top + h / 2 + 6, amp = (h - 44) / 2 / 2.05;
      const WY = v => mid - v * amp;
      const inPts = [], outPts = [];
      for (let i = i0; i <= i1; i += stride) {
        const x = X(tOf(i));
        inPts.push([x, WY(SIGNAL[i - res.L] || 0)]);
        outPts.push([x, WY(res.out[i])]);
      }
      $('.kp-input').setAttribute('d', pathOf(inPts));
      $('.kp-out').setAttribute('d', pathOf(outPts));
      $('.kp-removed').setAttribute('d', `${pathOf(inPts)}L${outPts.slice().reverse().map(p => `${r(p[0])} ${r(p[1])}`).join('L')}Z`);
      $('.kp-gr-fill').setAttribute('d', `${pathOf(pts)}L${r(X(v1))} ${r(Y(0))}L${r(X(v0))} ${r(Y(0))}Z`);

      const needed = dB(res.ceiling / peakIn);
      const sc = [];
      [-2, -4, -6, -8].forEach(d => {
        sc.push(line('kp-grid', pad, Y(d), W - pad, Y(d)));
        sc.push(`<text class="kp-tick" x="${pad + 6}" y="${r(Y(d) - 3)}">−${-d} dB</text>`);
      });
      sc.push(line('kp-axis', pad, Y(0), W - pad, Y(0)));
      [1, -1].forEach(k => sc.push(line('kp-ceiling', pad, WY(k * res.ceiling), W - pad, WY(k * res.ceiling))));
      sc.push(`<text class="kp-tick" x="${W - pad - 6}" y="${r(WY(res.ceiling) - 4)}" text-anchor="end">ceiling</text>`);
      sc.push(`<text class="kp-label" x="${pad + 6}" y="${top + 13}">gain reduction</text>`);
      sc.push(line('kp-threshold', pad, Y(needed), W - pad, Y(needed)));
      sc.push(`<text class="kp-label" x="${W - pad - 6}" y="${r(Y(needed) + 13)}" text-anchor="end">needed for the peak</text>`);
      const hits = state.view === 'release' ? [0, HIT2] : [0];
      hits.forEach(t => {
        sc.push(line('kp-identity', X(t), top, X(t), top + h));
        sc.push(`<text class="kp-label" x="${r(X(t) + 5)}" y="${top + h - 22}">kick</text>`);
      });
      const step = state.view === 'release' ? 0.1 : 0.01;
      for (let t = Math.ceil(v0 / step) * step; t <= v1 + 1e-9; t += step) {
        sc.push(`<text class="kp-tick" x="${r(X(t))}" y="${top + h - 6}" text-anchor="middle">${Math.abs(t) < 1e-9 ? '0' : Math.round(ms(t))} ms</text>`);
      }
      $('.kp-scaffold').innerHTML = sc.join('');

      // Readouts, and the shortfall on the peak: what the ceiling has to clip
      let start = null, maxGr = 0, clip = 0, clipAt = 0;
      for (let i = res.L; i < res.gain.length; i++) {
        const t = tOf(i);
        if (t > HIT2 - 0.01) break;
        if (start === null && res.gain[i] < 0.995) start = t;
        maxGr = Math.min(maxGr, dB(res.gain[i]));
        const over = Math.abs(res.pre[i]) / res.ceiling;
        if (over > clip) { clip = over; clipAt = i; }
      }
      const over = $('.kp-over');
      if (clip > 1.001) {
        const x = X(tOf(clipAt)), y0 = Y(dB(res.gain[clipAt])), y1 = Y(dB(res.gain[clipAt]) - dB(clip));
        over.style.display = '';
        over.querySelector('line').setAttribute('x1', r(x)); over.querySelector('line').setAttribute('x2', r(x));
        over.querySelector('line').setAttribute('y1', r(y0)); over.querySelector('line').setAttribute('y2', r(y1));
        const label = over.querySelector('text');
        label.setAttribute('x', r(x + 7)); label.setAttribute('y', r((y0 + y1) / 2 + 4));
        label.textContent = `${fmtDb(dB(clip))} clipped`;
      } else over.style.display = 'none';
      $('[data-r="start"]').textContent = start === null ? '–' : `${start < 0 ? `${(-ms(start)).toFixed(1)} ms before` : `${ms(start).toFixed(1)} ms after`} the kick`;
      $('[data-r="max"]').textContent = fmtDb(maxGr);
      $('[data-r="clip"]').textContent = clip > 1.001 ? fmtDb(dB(clip)) : 'none';
    }

    draw(initial);
    return { set: state => draw(state) };
  }

  // ── Upward compression (KrystalPeak's upward stage) ────────────────────────────
  const UP_THRESHOLD = -18, UP_KNEE = 60, UP_MAX_RATIO = 4;

  // Gain added (dB) at a detected level (dB), for UPWARD 0-1
  function upwardGainDb(inDb, upward) {
    const ratio = 1 + upward * (UP_MAX_RATIO - 1), inv = 1 / ratio;
    const kneeStart = UP_THRESHOLD - UP_KNEE / 2, kneeEnd = UP_THRESHOLD + UP_KNEE / 2;
    let g;
    if (inDb >= kneeEnd) g = 0;
    else if (inDb > kneeStart) { const x = kneeEnd - inDb; g = x * x / UP_KNEE * 0.5 * (1 - inv); }
    else g = (UP_THRESHOLD - inDb) * (1 - inv);
    const offset = 100 - Math.pow(Math.min(1, UP_KNEE / 72), 0.4) * 80;
    const ignoreKnee = 10 + UP_KNEE / 2, d = inDb - (UP_THRESHOLD - offset);
    let f = d > ignoreKnee ? 1 : d > 0 ? (x => x * x * (3 - 2 * x))(d / ignoreKnee) : offset > 95 ? 1 : 0;
    return Math.min(40, Math.max(0, g * f));
  }

  // Output level against input level in dB, like a compressor curve: the curve rises above the diagonal where
  // gain is added (filled in yellow), with the largest lift marked
  function peakUpward(container, initial) {
    const W = 400, H = 380, pad = 12, LV0 = -60, LV1 = 0;
    const X = d => pad + (d - LV0) / (LV1 - LV0) * (W - 2 * pad);
    const Y = d => H - pad - (d - LV0) / (LV1 - LV0) * (H - 2 * pad);
    container.innerHTML = `
      <div class="kp-peak kp-peak--square">
        <svg viewBox="0 0 ${W} ${H}" aria-hidden="true">
          <defs><clipPath id="kp-up-clip"><rect x="${pad}" y="${pad}" width="${W - 2 * pad}" height="${H - 2 * pad}" rx="6"/></clipPath></defs>
          <rect class="kp-frame" x="${pad}" y="${pad}" width="${W - 2 * pad}" height="${H - 2 * pad}" rx="6"/>
          <g class="kp-scaffold"></g>
          <g clip-path="url(#kp-up-clip)"><path class="kp-gi-fill" d=""/><path class="kp-curve kp-up" d=""/></g>
          <g class="kp-gap"><line x1="0" y1="0" x2="0" y2="0"/><text class="kp-label" x="0" y="0"></text></g>
        </svg>
        <figcaption class="kp-readouts">
          <span>Added at −20 dB <b data-r="g20"></b></span>
          <span>at −40 dB <b data-r="g40"></b></span>
          <span>at −60 dB <b data-r="g60"></b></span>
        </figcaption>
      </div>`;
    const $ = sel => container.querySelector(sel);
    const sc = [];
    [-48, -36, -24, -12].forEach(d => {
      sc.push(line('kp-grid', X(d), pad, X(d), H - pad), line('kp-grid', pad, Y(d), W - pad, Y(d)));
      sc.push(`<text class="kp-tick" x="${r(X(d))}" y="${H - pad - 6}" text-anchor="middle">−${-d}</text>`);
      sc.push(`<text class="kp-tick" x="${pad + 5}" y="${r(Y(d) - 4)}">−${-d}</text>`);
    });
    sc.push(line('kp-identity', X(LV0), Y(LV0), X(LV1), Y(LV1)));
    sc.push(`<text class="kp-tick kp-axis-name" x="${W - pad - 5}" y="${H - pad - 6}" text-anchor="end">input, dB</text>`);
    sc.push(`<text class="kp-label" x="${pad + 6}" y="${pad + 14}">output, dB</text>`);
    $('.kp-scaffold').innerHTML = sc.join('');

    function draw(state) {
      const u = Math.min(1, Math.max(0, (state.upward ?? 0) / 100));
      const curve = [], diag = [];
      let best = -1, bestAt = -20;
      for (let d = LV0; d <= LV1 + 1e-9; d += 0.5) {
        const g = upwardGainDb(d, u);
        curve.push([X(d), Y(d + g)]);
        diag.push([X(d), Y(d)]);
        if (g > best) { best = g; bestAt = d; }
      }
      $('.kp-up').setAttribute('d', pathOf(curve));
      $('.kp-gi-fill').setAttribute('d', `${pathOf(curve)}L${diag.slice().reverse().map(p => `${r(p[0])} ${r(p[1])}`).join('L')}Z`);
      const gap = $('.kp-gap');
      if (best > 0.05) {
        gap.style.display = '';
        const ln = gap.querySelector('line'), x = X(bestAt);
        ln.setAttribute('x1', r(x)); ln.setAttribute('x2', r(x));
        ln.setAttribute('y1', r(Y(bestAt))); ln.setAttribute('y2', r(Y(bestAt + best)));
        const t = gap.querySelector('text');
        t.setAttribute('x', r(x + 7)); t.setAttribute('y', r(Y(bestAt) + 14));
        t.textContent = fmtDb(best);
      } else gap.style.display = 'none';
      $('[data-r="g20"]').textContent = fmtDb(upwardGainDb(-20, u));
      $('[data-r="g40"]').textContent = fmtDb(upwardGainDb(-40, u));
      $('[data-r="g60"]').textContent = fmtDb(upwardGainDb(-60, u));
    }

    draw(initial);
    return { set: state => draw(state) };
  }

  window.KDScopes = Object.assign(window.KDScopes || {}, { peakLimiter, peakUpward });
  window.KDPeak = { limit, upwardGainDb };
})();
