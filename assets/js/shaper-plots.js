// KrystalShaper plots, computed from the plugin's own processing (KrystalShaper: Source/DynamicProcessor.h,
// EnvelopeDetector.h).
//
//   KDScopes.shaperTime(container, state)    gain change of the transient and sustain parts over two drum hits
//   KDScopes.shaperDetect(container, state)  which hits of a phrase are detected as transients
//   KDScopes.shaperBands(container, state)   how much each part is changed at each frequency
//
// All return { set(state) } and are driven by the scroll-driven scope section (plugin-story.js).
(function () {
  'use strict';

  const SR = 48000;
  const dB = v => 20 * Math.log10(Math.max(Math.abs(v), 1e-9));
  const gainOf = d => Math.pow(10, d / 20);
  const r = v => Math.round(v * 100) / 100;
  const pathOf = pts => pts.map((p, i) => `${i ? 'L' : 'M'}${r(p[0])} ${r(p[1])}`).join('');
  const line = (cls, ax, ay, bx, by) => `<line class="${cls}" x1="${r(ax)}" y1="${r(ay)}" x2="${r(bx)}" y2="${r(by)}"/>`;
  const fmtDb = (v, digits = 1) => `${v > 0.05 ? '+' : v < -0.05 ? '−' : ''}${Math.abs(v).toFixed(digits)} dB`;
  const fmtHz = f => (f < 1000 ? `${Math.round(f)} Hz` : `${(f / 1000).toFixed(1)} kHz`);
  let uid = 0;

  // ── DSP ────────────────────────────────────────────────────────────────────────
  const MODES = {
    SHARP:  { gainSmoothMs: 0.1, fastDecayMs: 2, slowAttackMs: 8,  slowReleaseMs: 30,  fadeExp: 1.5 },
    MEDIUM: { gainSmoothMs: 0.5, fastDecayMs: 5, slowAttackMs: 15, slowReleaseMs: 60,  fadeExp: 1.0 },
    SMOOTH: { gainSmoothMs: 3,   fastDecayMs: 8, slowAttackMs: 25, slowReleaseMs: 100, fadeExp: 0.7 },
  };
  const DEFAULTS = { mode: 'MEDIUM', input: 0, transient: 0, sustain: 0, hold: 20, release: 100, threshold: 4, pump: 0,
                     lookahead: false, trHpf: 20, trLpf: 20000, suHpf: 20, suLpf: 20000 };
  const coeffMs = ms => Math.exp(-1 / (Math.max(0.1, ms) * 0.001 * SR));

  // 12 dB/oct high-pass or low-pass, Q 0.707
  function biquad(f, highPass) {
    const w = 2 * Math.PI * Math.min(f, 0.45 * SR) / SR, c = Math.cos(w), al = Math.sin(w) / (2 * Math.SQRT1_2), a0 = 1 + al;
    const b0 = (highPass ? (1 + c) / 2 : (1 - c) / 2) / a0, b1 = (highPass ? -(1 + c) : 1 - c) / a0;
    return { b0, b1, b2: b0, a1: -2 * c / a0, a2: (1 - al) / a0 };
  }
  function runBiquad(x, q) {
    const y = new Float64Array(x.length);
    let z1 = 0, z2 = 0;
    for (let i = 0; i < x.length; i++) {
      const o = q.b0 * x[i] + z1;
      z1 = q.b1 * x[i] - q.a1 * o + z2;
      z2 = q.b2 * x[i] - q.a2 * o;
      y[i] = o;
    }
    return y;
  }
  // Each filter is bypassed at the end of its range, independently: a high-pass alone never engages the low-pass
  const hpOn = f => f > 20.5, lpOn = f => f < 19950;
  const bandOpen = (hp, lp) => !hpOn(hp) && !lpOn(lp);
  // A part's gain applied only inside its band: y = x + (g - 1) * band(x)
  function applyBand(x, gains, hp, lp) {
    const y = new Float64Array(x.length);
    if (bandOpen(hp, lp)) { for (let i = 0; i < x.length; i++) y[i] = x[i] * gains[i]; return y; }
    let b = x;
    if (hpOn(hp)) b = runBiquad(b, biquad(hp, true));
    if (lpOn(lp)) b = runBiquad(b, biquad(lp, false));
    for (let i = 0; i < x.length; i++) y[i] = x[i] + (gains[i] - 1) * b[i];
    return y;
  }

  function process(state, signal) {
    const s = { ...DEFAULTS, ...state }, m = MODES[s.mode] || MODES.MEDIUM, n = signal.length;
    const gIn = gainOf(s.input);
    const fastC = coeffMs(m.fastDecayMs), slowA = coeffMs(m.slowAttackMs), slowR = coeffMs(m.slowReleaseMs);
    const smooth = Math.exp(-1 / (m.gainSmoothMs * 0.001 * SR));
    const onset = gainOf(s.threshold), rearm = 1 + (onset - 1) * 0.25;
    const holdN = Math.floor(s.hold * 0.001 * SR), relN = Math.max(1, Math.floor(s.release * 0.001 * SR));
    const trDb = s.transient * 0.15, suDb = s.sustain * 0.15, pumpDb = s.pump * 0.12;
    const x = new Float64Array(n), w = new Float64Array(n), dbT = new Float64Array(n), dbS = new Float64Array(n);
    const gT = new Float64Array(n), gS = new Float64Array(n), onsets = [];
    let fast = 0, ms = 0, wv = 0, sT = 0, sS = 0, hold = 0, pos = 0, armed = true;
    for (let i = 0; i < n; i++) {
      x[i] = signal[i] * gIn;
      const det = Math.abs(x[i]);
      fast = det >= fast ? det : det + fastC * (fast - det);
      const sq = det * det;
      ms = sq + (sq > ms ? slowA : slowR) * (ms - sq);
      const slow = Math.sqrt(ms) * Math.SQRT2;
      if (armed && fast > 1e-3 && fast > slow * onset) { wv = 1; hold = holdN; pos = 0; armed = false; onsets.push(i); }
      else if (fast <= slow * rearm) armed = true;
      if (hold > 0) hold--;
      else if (wv > 0) {
        const ph = ++pos / relN;
        wv = ph >= 1 ? 0 : Math.pow(0.5 * (1 + Math.cos(Math.PI * ph)), m.fadeExp);
      }
      const tT = wv * trDb, tS = (1 - wv) * suDb - 4 * wv * (1 - wv) * pumpDb;
      sT = tT + smooth * (sT - tT);
      sS = tS + smooth * (sS - tS);
      w[i] = wv; dbT[i] = sT; dbS[i] = sS; gT[i] = gainOf(sT); gS[i] = gainOf(sS);
    }
    // Lookahead delays the audio, not the detection
    const delay = s.lookahead ? Math.round(0.002 * SR) : 0;
    const audio = new Float64Array(n);
    for (let i = delay; i < n; i++) audio[i] = x[i - delay];
    const out = applyBand(applyBand(audio, gT, s.trHpf, s.trLpf), gS, s.suHpf, s.suLpf);
    return { w, dbT, dbS, audio, out, onsets, delay };
  }

  // ── Test signals ───────────────────────────────────────────────────────────────
  function noise(seed) {
    let v = seed >>> 0;
    return () => { v = (Math.imul(v, 1664525) + 1013904223) >>> 0; return v / 2147483648 - 1; };
  }
  // A snare-like hit: click, tuned body, rattle and a long, quiet room tail
  function addHit(buf, t0, amp, seed) {
    const rnd = noise(seed), i0 = Math.round(t0 * SR);
    let lp = 0;
    for (let k = 0; i0 + k < buf.length && k < SR * 1.2; k++) {
      const t = k / SR, nz = rnd();
      lp += 0.05 * (nz - lp);
      const v = 0.4 * nz * Math.exp(-t / 0.003)
              + 0.7 * Math.sin(2 * Math.PI * (190 * t + 60 * 0.01 * (1 - Math.exp(-t / 0.01)))) * Math.exp(-t / 0.12)
              + 0.1 * nz * Math.exp(-t / 0.04)
              + 0.7 * lp * Math.exp(-t / 0.3);
      buf[i0 + k] += amp * Math.min(1, t / 0.0005) * v;
    }
  }
  const HITS_T0 = -0.08, HITS_DUR = 1.1, HITS_AT = [0, 0.55];
  const HITS = (() => {
    const buf = new Float64Array(Math.round(HITS_DUR * SR));
    HITS_AT.forEach((t, k) => addHit(buf, t - HITS_T0, 0.42, 11 + k));
    return buf;
  })();
  // A phrase of loud and soft hits, some of them landing on the tail of the one before
  const PHRASE_T0 = -0.05, PHRASE_DUR = 2.05;
  const PHRASE_HITS = [[0, 0], [0.26, -8], [0.5, -20], [0.74, -2], [0.84, -9], [1.1, -14], [1.36, 0], [1.48, -12], [1.74, -5]];
  const PHRASE = (() => {
    const buf = new Float64Array(Math.round(PHRASE_DUR * SR));
    PHRASE_HITS.forEach(([t, d], k) => addHit(buf, t - PHRASE_T0, 0.42 * gainOf(d), 31 + k));
    return buf;
  })();

  // ── Shaping over time ──────────────────────────────────────────────────────────
  function shaperTime(container, initial) {
    const W = 640, H = 300, pad = 12, top = 12, h = 262, RANGE_DB = 16, id = `kp-shp-${++uid}`;
    container.innerHTML = `
      <div class="kp-peak">
        <svg viewBox="0 0 ${W} ${H}" aria-hidden="true">
          <defs><clipPath id="${id}"><rect x="${pad}" y="${top}" width="${W - 2 * pad}" height="${h}" rx="6"/></clipPath></defs>
          <rect class="kp-frame" x="${pad}" y="${top}" width="${W - 2 * pad}" height="${h}" rx="6"/>
          <g class="kp-scaffold"></g>
          <g clip-path="url(#${id})">
            <path class="kp-shp-in" d=""/><path class="kp-shp-out" d=""/>
            <path class="kp-shp-su" d=""/><path class="kp-shp-tr" d=""/><path class="kp-field-gain" d=""/>
          </g>
        </svg>
        <figcaption class="kp-readouts">
          <span>Attack <b data-r="a"></b></span>
          <span>Sustain <b data-r="s"></b></span>
          <span>Lowest gain <b data-r="l"></b></span>
          <span>Output peak <b data-r="p"></b></span>
        </figcaption>
      </div>`;
    const $ = sel => container.querySelector(sel);
    const v0 = HITS_T0, v1 = HITS_T0 + HITS_DUR;

    function draw(state) {
      const res = process(state, HITS);
      const X = t => pad + (t - v0) / (v1 - v0) * (W - 2 * pad);
      const mid = top + h / 2;
      const G = d => mid - Math.max(-RANGE_DB - 2, Math.min(RANGE_DB + 2, d)) / RANGE_DB * (h / 2 - 16);
      const amp = (h / 2 - 16) / 0.9, WY = v => mid - v * amp;
      const tOf = i => v0 + (i - res.delay) / SR;
      const i0 = res.delay, i1 = HITS.length - 1, stride = Math.max(1, Math.round((i1 - i0) / 1400));
      const tr = [], su = [], net = [], inP = [], outP = [];
      for (let i = i0; i <= i1; i += stride) {
        const xx = X(tOf(i));
        tr.push([xx, G(res.dbT[i - res.delay])]);
        su.push([xx, G(res.dbS[i - res.delay])]);
        net.push([xx, G(res.dbT[i - res.delay] + res.dbS[i - res.delay])]);
        // envelope of the waveform: both edges, so the stride never aliases the tone
        let lo = 0, hi = 0, olo = 0, ohi = 0;
        for (let k = Math.max(0, i - 130); k < Math.min(i + Math.max(stride, 130), i1 + 1); k++) {
          lo = Math.min(lo, res.audio[k]); hi = Math.max(hi, res.audio[k]);
          olo = Math.min(olo, res.out[k]); ohi = Math.max(ohi, res.out[k]);
        }
        inP.push([xx, WY(hi), WY(lo)]);
        outP.push([xx, WY(ohi), WY(olo)]);
      }
      const area = pts => `${pathOf(pts.map(p => [p[0], p[1]]))}L${pts.slice().reverse().map(p => `${r(p[0])} ${r(p[2])}`).join('L')}Z`;
      const base = `L${r(X(v1))} ${r(mid)}L${r(X(tOf(i0)))} ${r(mid)}Z`;
      $('.kp-shp-in').setAttribute('d', area(inP));
      $('.kp-shp-out').setAttribute('d', area(outP));
      $('.kp-shp-tr').setAttribute('d', `${pathOf(tr)}${base}`);
      $('.kp-shp-su').setAttribute('d', `${pathOf(su)}${base}`);
      $('.kp-field-gain').setAttribute('d', pathOf(net));

      const sc = [];
      [-10, -5, 5, 10].forEach(d => {
        sc.push(line('kp-grid', pad, G(d), W - pad, G(d)));
        sc.push(`<text class="kp-tick" x="${pad + 6}" y="${r(G(d) - 3)}">${d > 0 ? '+' : '−'}${Math.abs(d)} dB</text>`);
      });
      sc.push(line('kp-axis', pad, mid, W - pad, mid));
      sc.push(`<text class="kp-label" x="${pad + 6}" y="${top + 13}">gain change</text>`);
      HITS_AT.forEach(t => sc.push(line('kp-identity', X(t), top, X(t), top + h)));
      for (let t = 0; t <= v1 + 1e-9; t += 0.2) {
        sc.push(`<text class="kp-tick" x="${r(X(t))}" y="${top + h - 6}" text-anchor="middle">${Math.round(t * 1000)} ms</text>`);
      }
      $('.kp-scaffold').innerHTML = sc.join('');

      // Readouts: strongest change on the first attack, the sustain change just before the second hit, output peak
      const iHit = Math.round((HITS_AT[0] - v0) * SR), iLate = Math.round((HITS_AT[1] - 0.03 - v0) * SR);
      // the attack: where the transient change is strongest, or 5 ms into the hit when TRANSIENT is at 0
      let kA = iHit + Math.round(0.005 * SR), best = 0.05;
      for (let i = iHit; i < iHit + Math.round(0.06 * SR); i++) if (Math.abs(res.dbT[i]) > best) { best = Math.abs(res.dbT[i]); kA = i; }
      const att = res.dbT[kA] + res.dbS[kA];
      let pk = 0, low = 0;
      for (let i = 0; i < res.out.length; i++) pk = Math.max(pk, Math.abs(res.out[i]));
      for (let i = iHit; i < iLate; i++) low = Math.min(low, res.dbT[i] + res.dbS[i]);
      $('[data-r="a"]').textContent = fmtDb(att);
      $('[data-r="s"]').textContent = fmtDb(res.dbT[iLate] + res.dbS[iLate]);
      $('[data-r="l"]').textContent = fmtDb(low);
      $('[data-r="p"]').textContent = `${dB(pk) > 0.05 ? '+' : dB(pk) < -0.05 ? '−' : ''}${Math.abs(dB(pk)).toFixed(1)} dBFS`;
    }
    draw(initial);
    return { set: draw };
  }

  // ── Detection ──────────────────────────────────────────────────────────────────
  function shaperDetect(container, initial) {
    const W = 640, H = 260, pad = 12, top = 12, h = 222, id = `kp-shd-${++uid}`;
    container.innerHTML = `
      <div class="kp-peak">
        <svg viewBox="0 0 ${W} ${H}" aria-hidden="true">
          <defs><clipPath id="${id}"><rect x="${pad}" y="${top}" width="${W - 2 * pad}" height="${h}" rx="6"/></clipPath></defs>
          <rect class="kp-frame" x="${pad}" y="${top}" width="${W - 2 * pad}" height="${h}" rx="6"/>
          <g clip-path="url(#${id})">
            <g class="kp-scaffold"></g>
            <path class="kp-shp-out" d=""/>
            <path class="kp-shp-w" d=""/><path class="kp-shp-wline" d=""/>
            <g class="kp-marks"></g>
          </g>
        </svg>
        <figcaption class="kp-readouts">
          <span>Detected <b data-r="n"></b></span>
          <span>Missed <b data-r="m"></b></span>
          <span>Extra triggers <b data-r="x"></b></span>
        </figcaption>
      </div>`;
    const $ = sel => container.querySelector(sel);
    const v0 = PHRASE_T0, v1 = PHRASE_T0 + PHRASE_DUR;

    function draw(state) {
      const res = process({ ...state, transient: 0, sustain: 0, pump: 0, lookahead: false }, PHRASE);
      const X = t => pad + (t - v0) / (v1 - v0) * (W - 2 * pad);
      const wTop = top + 8, wH = 44, mid = top + wH + 16 + (h - wH - 16) / 2;
      // Level in dB, as in the plugin's display (down to −48 dB), so a quieter phrase stays readable
      const half = (h - wH - 16) / 2 - 22, A = v => Math.max(0, Math.min(1, (dB(v) + 48) / 48)) * half;
      const stride = Math.max(1, Math.round(PHRASE.length / 1400));
      const wave = [], wc = [];
      for (let i = 0; i < PHRASE.length; i += stride) {
        let lo = 0, hi = 0;
        for (let k = Math.max(0, i - 130); k < Math.min(i + Math.max(stride, 130), PHRASE.length); k++) { lo = Math.min(lo, res.audio[k]); hi = Math.max(hi, res.audio[k]); }
        const xx = X(v0 + i / SR);
        const pk = Math.max(hi, -lo);
        wave.push([xx, mid - A(pk), mid + A(pk)]);
        let wm = 0;
        for (let k = i; k < Math.min(i + stride, PHRASE.length); k++) wm = Math.max(wm, res.w[k]);
        wc.push([xx, wTop + wH - wm * wH]);
      }
      $('.kp-shp-out').setAttribute('d', `${pathOf(wave.map(p => [p[0], p[1]]))}L${wave.slice().reverse().map(p => `${r(p[0])} ${r(p[2])}`).join('L')}Z`);
      $('.kp-shp-w').setAttribute('d', `${pathOf(wc)}L${r(X(v1))} ${wTop + wH}L${r(X(v0))} ${wTop + wH}Z`);
      $('.kp-shp-wline').setAttribute('d', pathOf(wc));

      // Which hits were detected: an onset within 15 ms of the start of each hit
      const times = res.onsets.map(i => v0 + i / SR);
      const found = PHRASE_HITS.map(([t]) => times.some(o => o >= t - 0.002 && o < t + 0.015));
      const marks = PHRASE_HITS.map(([t], k) => {
        const xx = X(t);
        return found[k]
          ? `<circle class="kp-hit is-on" cx="${r(xx)}" cy="${top + h - 12}" r="4.5"/>`
          : `<circle class="kp-hit" cx="${r(xx)}" cy="${top + h - 12}" r="4.5"/>`;
      }).join('');
      const extraMarks = times.filter(o => !PHRASE_HITS.some(([t]) => o >= t - 0.002 && o < t + 0.015))
        .map(o => line('kp-extra', X(o), top + h - 18, X(o), top + h - 6)).join('');
      $('.kp-marks').innerHTML = marks + extraMarks;
      const sc = [line('kp-axis', pad, wTop + wH, W - pad, wTop + wH),
        `<text class="kp-label" x="${W - pad - 6}" y="${wTop + wH + 13}" text-anchor="end">transient part</text>`];
      $('.kp-scaffold').innerHTML = sc.join('');

      const n = found.filter(Boolean).length;
      const extra = times.filter(o => !PHRASE_HITS.some(([t]) => o >= t - 0.002 && o < t + 0.015)).length;
      $('[data-r="n"]').textContent = `${n} of ${PHRASE_HITS.length}`;
      $('[data-r="x"]').textContent = extra ? `${extra}` : 'none';
      $('[data-r="m"]').textContent = n === PHRASE_HITS.length ? 'none' : `${PHRASE_HITS.length - n}`;
    }
    draw(initial);
    return { set: draw };
  }

  // ── Frequency ranges of the two parts ──────────────────────────────────────────
  function bandResponse(f, hp, lp, g) {
    if (bandOpen(hp, lp)) return g;
    const resp = q => {
      const w = 2 * Math.PI * f / SR, c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
      const nr = q.b0 + q.b1 * c1 + q.b2 * c2, ni = -(q.b1 * s1 + q.b2 * s2);
      const dr = 1 + q.a1 * c1 + q.a2 * c2, di = -(q.a1 * s1 + q.a2 * s2);
      const d = dr * dr + di * di;
      return [(nr * dr + ni * di) / d, (ni * dr - nr * di) / d];
    };
    const [ar, ai] = hpOn(hp) ? resp(biquad(hp, true)) : [1, 0], [br, bi] = lpOn(lp) ? resp(biquad(lp, false)) : [1, 0];
    const hr = ar * br - ai * bi, hi = ar * bi + ai * br;
    const yr = 1 + (g - 1) * hr, yi = (g - 1) * hi;
    return Math.hypot(yr, yi);
  }
  function shaperBands(container, initial) {
    const W = 640, H = 300, pad = 12, top = 12, h = 262, F0 = 20, F1 = 20000, RANGE_DB = 16;
    container.innerHTML = `
      <div class="kp-peak">
        <svg viewBox="0 0 ${W} ${H}" aria-hidden="true">
          <rect class="kp-frame" x="${pad}" y="${top}" width="${W - 2 * pad}" height="${h}" rx="6"/>
          <g class="kp-scaffold"></g>
          <path class="kp-shp-su kp-shp-band" d=""/><path class="kp-shp-tr kp-shp-band" d=""/>
          <path class="kp-shp-suline" d=""/><path class="kp-shp-trline" d=""/>
        </svg>
        <figcaption class="kp-readouts">
          <span>Transient, lows <b data-r="tl"></b></span>
          <span>Transient, highs <b data-r="th"></b></span>
          <span>Sustain, lows <b data-r="sl"></b></span>
          <span>Sustain, highs <b data-r="sh"></b></span>
        </figcaption>
      </div>`;
    const $ = sel => container.querySelector(sel);
    const X = f => pad + Math.log(f / F0) / Math.log(F1 / F0) * (W - 2 * pad);
    const mid = top + h / 2, G = d => mid - Math.max(-RANGE_DB - 2, Math.min(RANGE_DB + 2, d)) / RANGE_DB * (h / 2 - 16);
    const sc = [];
    [-15, -10, -5, 5, 10, 15].forEach(d => {
      sc.push(line('kp-grid', pad, G(d), W - pad, G(d)));
      sc.push(`<text class="kp-tick" x="${pad + 6}" y="${r(G(d) - 3)}">${d > 0 ? '+' : '−'}${Math.abs(d)} dB</text>`);
    });
    [50, 100, 200, 500, 1000, 2000, 5000, 10000].forEach(f => {
      sc.push(line('kp-grid', X(f), top, X(f), top + h));
      sc.push(`<text class="kp-tick" x="${r(X(f))}" y="${top + h - 6}" text-anchor="middle">${f < 1000 ? f : `${f / 1000}k`}</text>`);
    });
    sc.push(line('kp-axis', pad, mid, W - pad, mid));
    $('.kp-scaffold').innerHTML = sc.join('');

    function draw(state) {
      const s = { ...DEFAULTS, ...state };
      const gT = gainOf(s.transient * 0.15), gS = gainOf(s.sustain * 0.15);
      const tr = [], su = [];
      for (let k = 0; k <= 300; k++) {
        const f = F0 * Math.pow(F1 / F0, k / 300);
        tr.push([X(f), G(dB(bandResponse(f, s.trHpf, s.trLpf, gT)))]);
        su.push([X(f), G(dB(bandResponse(f, s.suHpf, s.suLpf, gS)))]);
      }
      const base = `L${r(X(F1))} ${r(mid)}L${r(X(F0))} ${r(mid)}Z`;
      $('.kp-shp-tr').setAttribute('d', `${pathOf(tr)}${base}`);
      $('.kp-shp-su').setAttribute('d', `${pathOf(su)}${base}`);
      $('.kp-shp-trline').setAttribute('d', pathOf(tr));
      $('.kp-shp-suline').setAttribute('d', pathOf(su));
      const at = (f, hp, lp, g) => fmtDb(dB(bandResponse(f, hp, lp, g)));
      $('[data-r="tl"]').textContent = at(100, s.trHpf, s.trLpf, gT);
      $('[data-r="th"]').textContent = at(8000, s.trHpf, s.trLpf, gT);
      $('[data-r="sl"]').textContent = at(100, s.suHpf, s.suLpf, gS);
      $('[data-r="sh"]').textContent = at(8000, s.suHpf, s.suLpf, gS);
    }
    draw(initial);
    return { set: draw };
  }

  window.KDScopes = Object.assign(window.KDScopes || {}, { shaperTime, shaperDetect, shaperBands });
  window.KDShaper = { process, bandResponse, HITS, PHRASE, PHRASE_HITS, fmtHz };
})();
