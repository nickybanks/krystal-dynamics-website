// Plots computed from the plugins' own transfer functions (KrystalClip: Source/SoftClipper.h).
// Everything is normalised to the threshold: x = input / threshold, y = output / threshold.
//
//   KDPlots.clip(x, { mode, slope, normalize, fold, shape })   one sample through the clipper
//   KDPlots.transferSVG(series, options)                         static transfer-curve plot (manual)
//   KDPlots.waveSVG(series, options)                             static sine-in / clipped-out plot (manual)
//   KDPlots.live(container, state)                               animated stage: curve, waveform, harmonics
(function () {
  'use strict';

  // ── KrystalClip transfer functions (port of SoftClipper.h) ───────────────────
  const MODES = ['Softer', 'Warmer', 'Harder', 'Darker'];
  const jmap = (v, a0, a1, b0, b1) => b0 + (v - a0) / (a1 - a0) * (b1 - b0);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // |x| -> |y| for one half-wave (positive matters only for Darker)
  function curve(a, positive, mode, slope) {
    switch (mode) {
      case 'Softer': {
        const w = jmap(slope, 0.1, 1, 0.3, 0.8), k = 1 - w;
        return a < k ? a : k + w * Math.tanh((a - k) / w);
      }
      case 'Warmer': {
        const p = clamp(4 / slope, 1, 16);
        if (a > 10) return 1;
        return a / Math.max(Math.pow(1 + Math.pow(a, p), 1 / p), 0.0001);
      }
      case 'Harder': {
        const w = jmap(slope, 0.1, 1, 0.01, 0.5), k = 1 - w;
        return a < k ? a : k + w * Math.tanh((a - k) / w);
      }
      case 'Darker': {
        const pos = jmap(slope, 0.1, 1, 0.3, 0.85);
        const w = positive ? pos : pos * 0.35, k = 1 - w;
        return a < k ? a : k + w * Math.tanh((a - k) / w);
      }
      default: return Math.min(a, 1);
    }
  }

  // Normalize: the whole curve is scaled by one gain, 1 / f(1), so it reaches the threshold exactly at an
  // input equal to the threshold (above it the output stays at 1). One gain for both half-waves: the one
  // that is lower at the threshold sets it, so with Darker the harder half reaches the threshold earlier.
  function normGain(mode, slope) {
    return 1 / Math.max(Math.min(curve(1, true, mode, slope), curve(1, false, mode, slope)), 0.0001);
  }

  function shaped(v, mode, slope, normalize) {
    const positive = v >= 0;
    const gain = normalize ? normGain(mode, slope) : 1;
    const y = Math.min(curve(Math.abs(v), positive, mode, slope) * gain, 1);
    return positive ? y : -y;
  }

  function foldWave(u, shape) {
    const a = Math.abs(u);
    if (a <= 1) return u;
    const w = shape === 'Sine' ? Math.sin(Math.PI / 2 * a) : Math.abs(((a - 1) % 4) - 2) - 1;
    return u > 0 ? w : -w;
  }

  function clip(x, { mode = 'Softer', slope = 0.5, normalize = false, fold = 0, shape = 'Tri' } = {}) {
    const clipped = shaped(x, mode, slope, normalize);
    let y = clipped;
    if (fold > 0) y = clipped + fold * (shaped(foldWave(x, shape), mode, slope, normalize) - clipped);
    return clamp(y, -1, 1);
  }

  // Harmonics of a sine of amplitude `drive` (relative to the threshold): dB relative to the fundamental
  function harmonics(state, drive, count = 9) {
    const N = 512, out = new Float64Array(N);
    for (let n = 0; n < N; n++) out[n] = clip(drive * Math.sin(2 * Math.PI * n / N), state);
    const mags = [];
    for (let k = 1; k <= count; k++) {
      let re = 0, im = 0;
      for (let n = 0; n < N; n++) { const ph = 2 * Math.PI * k * n / N; re += out[n] * Math.cos(ph); im -= out[n] * Math.sin(ph); }
      mags.push(Math.hypot(re, im) * 2 / N);
    }
    const ref = mags[0] || 1e-12;
    const thd = Math.sqrt(mags.slice(1).reduce((sum, m) => sum + m * m, 0)) / ref;
    return { db: mags.map(m => Math.max(-90, 20 * Math.log10(Math.max(m, 1e-12) / ref))), thd };
  }

  // Where the knee starts on the positive half-wave (null for Warmer, which has no linear section)
  function kneeStart(mode, slope) {
    if (mode === 'Softer') return 1 - jmap(slope, 0.1, 1, 0.3, 0.8);
    if (mode === 'Harder') return 1 - jmap(slope, 0.1, 1, 0.01, 0.5);
    if (mode === 'Darker') return 1 - jmap(slope, 0.1, 1, 0.3, 0.85);
    return null;
  }

  const dB = v => 20 * Math.log10(Math.max(v, 1e-9));
  const fmtDb = (v, digits = 1) => {
    const n = Math.abs(v) < 0.005 ? 0 : v;
    return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(digits)} dB`;
  };

  // ── SVG helpers ──────────────────────────────────────────────────────────────
  const r = v => Math.round(v * 100) / 100;
  const pathOf = pts => pts.map((p, i) => `${i ? 'L' : 'M'}${r(p[0])} ${r(p[1])}`).join('');
  const lerp = (a, b, t) => a + (b - a) * t;
  const minus = d => d === 0 ? '0' : d > 0 ? `+${d}` : `−${-d}`;
  let uid = 0;

  // Two views of the transfer plot:
  //   full – both half-waves, linear amplitude (shows the shape and the asymmetry of Darker)
  //   db   – positive half-wave, input and output level in dB relative to the threshold (shows knee and gain)
  const FULL = { x0: -2, x1: 2, y0: -1.25, y1: 1.25 };
  const DB = { x0: -24, x1: 6, y0: -24, y1: 3 };
  const DB_TICKS = [-18, -12, -6];

  function box(w, h, pad, view) {
    const { x0, x1, y0, y1 } = view;
    return {
      X: x => pad + (x - x0) / (x1 - x0) * (w - 2 * pad),
      Y: y => h - pad - (y - y0) / (y1 - y0) * (h - 2 * pad),
      ...view,
    };
  }

  const line = (cls, ax, ay, bx, by) => `<line class="${cls}" x1="${r(ax)}" y1="${r(ay)}" x2="${r(bx)}" y2="${r(by)}"/>`;

  // Axes, threshold lines and identity, linear view
  function scaffoldFull(b) {
    const { X, Y, x0, x1, y0, y1 } = b;
    const out = [line('kp-axis', X(x0), Y(0), X(x1), Y(0)), line('kp-axis', X(0), Y(y0), X(0), Y(y1))];
    [1, -1].forEach(t => { if (t > y0 && t < y1) out.push(line('kp-threshold', X(x0), Y(t), X(x1), Y(t))); });
    out.push(`<text class="kp-label" x="${r(X(x0) + 6)}" y="${r(Y(1) - 6)}">threshold</text>`);
    const lo = Math.max(x0, y0), hi = Math.min(x1, y1);
    out.push(line('kp-identity', X(lo), Y(lo), X(hi), Y(hi)));
    return out.join('');
  }

  // 6 dB grid, threshold and identity, dB view
  function scaffoldDb(b, h, pad) {
    const { X, Y, x0, x1, y0, y1 } = b;
    const out = [];
    DB_TICKS.forEach(d => out.push(line('kp-grid', X(d), Y(y0), X(d), Y(y1)), line('kp-grid', X(x0), Y(d), X(x1), Y(d))));
    out.push(line('kp-grid', X(0), Y(y0), X(0), Y(y1)));
    out.push(line('kp-identity', X(y0), Y(y0), X(y1), Y(y1)));
    out.push(line('kp-threshold', X(x0), Y(0), X(x1), Y(0)));
    out.push(`<text class="kp-label" x="${r(X(x0) + 6)}" y="${r(Y(0) - 6)}">threshold</text>`);
    [...DB_TICKS, 0].forEach(d => out.push(`<text class="kp-tick" x="${r(X(d))}" y="${r(h - pad - 6)}" text-anchor="middle">${d === 0 ? '0 dB' : minus(d)}</text>`));
    DB_TICKS.forEach(d => out.push(`<text class="kp-tick" x="${r(X(x0) + 5)}" y="${r(Y(d) - 4)}">${minus(d)}</text>`));
    out.push(`<text class="kp-tick kp-axis-name" x="${r(X(x1) - 5)}" y="${r(h - pad - 6)}" text-anchor="end">input</text>`);
    return out.join('');
  }

  // Sample points: the same index runs over both views, so a curve can morph from one to the other
  const SAMPLES = 220;
  const linX = Array.from({ length: SAMPLES + 1 }, (_, i) => FULL.x0 + (FULL.x1 - FULL.x0) * i / SAMPLES);
  const dbX = Array.from({ length: SAMPLES + 1 }, (_, i) => DB.x0 + (DB.x1 - DB.x0) * i / SAMPLES);
  const dbA = dbX.map(d => Math.pow(10, d / 20));
  const dbOf = y => Math.max(DB.y0 - 6, dB(Math.abs(y)));

  const fullPoints = (f, b, xs = linX) => xs.map(x => [b.X(x), b.Y(f(x))]);
  const dbPoints = (f, b) => dbX.map((d, i) => [b.X(d), b.Y(dbOf(f(dbA[i])))]);

  // Gain marker at 0 dB input: from a reference curve (dashed) to the curve drawn over it; the value sits
  // under the dashed curve, where the plot is empty
  function gainMarker(b, from, to) {
    const y0 = dbOf(from), y1 = dbOf(to);
    return `<g class="kp-gap">${line('', b.X(0), b.Y(y0), b.X(0), b.Y(y1))}<text class="kp-label" x="${r(b.X(0) + 6)}" y="${r(b.Y(y0) + 14)}">${fmtDb(y1 - y0, 2)}</text></g>`;
  }

  // Static transfer curves (manual). view 'db' plots the positive half in dB; a series can be dashed.
  function transferSVG(series, { range = 2, width = 320, height = 300, legend = true, view = 'full' } = {}) {
    const w = width, h = height, pad = 14, id = `kp-clip-${++uid}`;
    const isDb = view === 'db';
    let paths, scaffold, extra = '';
    if (isDb) {
      const b = box(w, h, pad, DB);
      scaffold = scaffoldDb(b, h, pad);
      paths = series.map(s => `<path class="kp-curve${s.dashed ? ' is-dashed' : ''}" style="--kp-color:${s.color || 'var(--kd-blue)'}" d="${pathOf(dbPoints(x => clip(x, s), b))}"/>`).join('');
      const ref = series.find(s => s.dashed), top = series.find(s => !s.dashed);
      if (ref && top) extra = gainMarker(b, clip(1, ref), clip(1, top));
    } else {
      const b = box(w, h, pad, { ...FULL, x0: -range, x1: range });
      const xs = Array.from({ length: 261 }, (_, i) => -range + 2 * range * i / 260);
      scaffold = scaffoldFull(b);
      paths = series.map(s => `<path class="kp-curve${s.dashed ? ' is-dashed' : ''}" style="--kp-color:${s.color || 'var(--kd-blue)'}" d="${pathOf(fullPoints(x => clip(x, s), b, xs))}"/>`).join('');
    }
    const key = legend && series.length > 1
      ? `<div class="kp-legend">${series.map(s => `<span class="${s.dashed ? 'is-dashed' : ''}" style="--kp-color:${s.color || 'var(--kd-blue)'}">${s.label || s.mode}</span>`).join('')}</div>` : '';
    const aria = isDb ? 'Transfer curve: input level against output level in dB, relative to the threshold' : 'Transfer curve: input against output, relative to the threshold';
    return `<div class="kp-plot"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${aria}">
      <defs><clipPath id="${id}"><rect x="${pad}" y="${pad}" width="${w - 2 * pad}" height="${h - 2 * pad}" rx="6"/></clipPath></defs>
      <rect class="kp-frame" x="${pad}" y="${pad}" width="${w - 2 * pad}" height="${h - 2 * pad}" rx="6"/>
      ${scaffold}<g clip-path="url(#${id})">${paths}${extra}</g></svg>${key}</div>`;
  }

  // Static waveform: a sine of amplitude `drive` and the clipped result
  function waveSVG(series, { drive = 1.78, width = 420, height = 220, cycles = 2 } = {}) {
    const w = width, h = height, pad = 14, yr = 2.1;
    const n = 260, X = i => pad + i / n * (w - 2 * pad), Y = y => h / 2 - y / yr * (h / 2 - pad);
    const input = Array.from({ length: n + 1 }, (_, i) => [X(i), Y(drive * Math.sin(2 * Math.PI * cycles * i / n))]);
    const paths = series.map(s => {
      const pts = Array.from({ length: n + 1 }, (_, i) => [X(i), Y(clip(drive * Math.sin(2 * Math.PI * cycles * i / n), s))]);
      return `<path class="kp-curve" style="--kp-color:${s.color || 'var(--kd-blue)'}" d="${pathOf(pts)}"/>`;
    }).join('');
    const th = [1, -1].map(t => `<line class="kp-threshold" x1="${pad}" y1="${r(Y(t))}" x2="${w - pad}" y2="${r(Y(t))}"/>`).join('');
    return `<div class="kp-plot"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Sine input and clipped output"><rect class="kp-frame" x="${pad}" y="${pad}" width="${w - 2 * pad}" height="${h - 2 * pad}" rx="6"/>${th}<path class="kp-input" d="${pathOf(input)}"/>${paths}</svg></div>`;
  }

  // The same clipped signal as the WAVE view draws it (bipolar, threshold on both sides) or as the RECT view
  // draws it (absolute value, one threshold): dashed input, removed part filled, output as a line
  function displaySVG({ rect = false, mode = 'Harder', slope = 0.3, width = 420, height = 190 } = {}) {
    const w = width, h = height, pad = 14, yr = 2.1, n = 360, cycles = 5;
    const signal = Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n, p = 2 * Math.PI * cycles * t;
      const env = 0.5 + 1.2 * Math.pow(Math.sin(Math.PI * t), 1.5);
      return env * (0.82 * Math.sin(p) + 0.28 * Math.sin(2 * p + 0.9));
    });
    const X = i => pad + i / n * (w - 2 * pad);
    const Y = rect ? v => h - pad - Math.abs(v) / yr * (h - 2 * pad) : v => h / 2 - v / yr * (h / 2 - pad);
    const input = signal.map((x, i) => [X(i), Y(x)]);
    const output = signal.map((x, i) => [X(i), Y(clip(x, { mode, slope }))]);
    const removed = `${pathOf(input)}L${output.slice().reverse().map(p => `${r(p[0])} ${r(p[1])}`).join('L')}Z`;
    const th = (rect ? [1] : [1, -1]).map(t => `<line class="kp-threshold" x1="${pad}" y1="${r(Y(t))}" x2="${w - pad}" y2="${r(Y(t))}"/>`).join('');
    const zero = rect ? '' : `<line class="kp-axis" x1="${pad}" y1="${r(h / 2)}" x2="${w - pad}" y2="${r(h / 2)}"/>`;
    return `<div class="kp-plot"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${rect ? 'Rectified' : 'Bipolar'} waveform with clipping"><rect class="kp-frame" x="${pad}" y="${pad}" width="${w - 2 * pad}" height="${h - 2 * pad}" rx="6"/>${zero}${th}<path class="kp-removed" d="${removed}"/><path class="kp-input" d="${pathOf(input)}"/><path class="kp-curve" d="${pathOf(output)}"/></svg></div>`;
  }

  // ── Live stage: transfer curve, waveform and harmonics, animated between states ──
  // state: { mode, slope, normalize, view: 'full' | 'db' }
  function live(container, initial, { drive = 1.78 } = {}) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const T = { w: 300, h: 300, pad: 12 }, id = `kp-live-${++uid}`;
    const W = { w: 360, h: 150, pad: 10 }, WN = 220, WY = 2.05;
    const WX = i => W.pad + i / WN * (W.w - 2 * W.pad), WYf = y => W.h / 2 - y / WY * (W.h / 2 - W.pad);
    const H = { w: 360, h: 120, count: 9 };
    const LB = box(T.w, T.h, T.pad, FULL), DBB = box(T.w, T.h, T.pad, DB);

    container.innerHTML = `
      <div class="kp-live">
        <figure class="kp-cell kp-cell--transfer">
          <svg viewBox="0 0 ${T.w} ${T.h}" aria-hidden="true">
            <defs><clipPath id="${id}"><rect x="${T.pad}" y="${T.pad}" width="${T.w - 2 * T.pad}" height="${T.h - 2 * T.pad}" rx="6"/></clipPath></defs>
            <rect class="kp-frame" x="${T.pad}" y="${T.pad}" width="${T.w - 2 * T.pad}" height="${T.h - 2 * T.pad}" rx="6"/>
            <g class="kp-scaffold-full">${scaffoldFull(LB)}</g>
            <g class="kp-scaffold-db">${scaffoldDb(DBB, T.h, T.pad)}</g>
            <g clip-path="url(#${id})">
              <path class="kp-curve is-dashed kp-ghost" d=""/>
              <path class="kp-curve kp-live-curve" d=""/>
              <g class="kp-gap"><line x1="0" y1="0" x2="0" y2="0"/><text class="kp-label" x="0" y="0"></text></g>
              <g class="kp-knee"><circle r="4" cx="0" cy="0"/><text class="kp-label" x="0" y="0">knee</text></g>
              <circle class="kp-dot" r="4.5" cx="0" cy="0"/>
            </g>
          </svg>
          <figcaption class="kp-readouts">
            <span>Knee <b data-r="knee"></b></span><span>At threshold <b data-r="gap"></b></span>
          </figcaption>
        </figure>
        <figure class="kp-cell kp-cell--wave">
          <svg viewBox="0 0 ${W.w} ${W.h}" aria-hidden="true">
            <rect class="kp-frame" x="${W.pad}" y="${W.pad}" width="${W.w - 2 * W.pad}" height="${W.h - 2 * W.pad}" rx="6"/>
            ${[1, -1].map(t => `<line class="kp-threshold" x1="${W.pad}" y1="${r(WYf(t))}" x2="${W.w - W.pad}" y2="${r(WYf(t))}"/>`).join('')}
            <path class="kp-removed" d=""/>
            <path class="kp-input" d=""/>
            <path class="kp-curve kp-live-wave" d=""/>
          </svg>
          <figcaption><span>Sine, ${Math.round(20 * Math.log10(drive))} dB over the threshold</span></figcaption>
        </figure>
        <figure class="kp-cell kp-cell--harmonics">
          <svg viewBox="0 0 ${H.w} ${H.h}" aria-hidden="true">
            ${Array.from({ length: H.count }, (_, k) => `<g class="kp-bar" data-k="${k}"><rect x="0" y="0" width="0" height="0" rx="2"/><text class="kp-label" text-anchor="middle"></text></g>`).join('')}
          </svg>
          <figcaption><span>Harmonics</span><b class="kp-thd"></b></figcaption>
        </figure>
      </div>`;

    const $ = sel => container.querySelector(sel);
    const fullScaffold = $('.kp-scaffold-full'), dbScaffold = $('.kp-scaffold-db');
    const curvePath = $('.kp-live-curve'), ghostPath = $('.kp-ghost');
    const gapEl = $('.kp-gap'), kneeEl = $('.kp-knee'), dot = $('.kp-dot');
    const wavePath = $('.kp-live-wave'), inputPath = $('.kp-input'), removedPath = $('.kp-removed');
    const bars = [...container.querySelectorAll('.kp-bar')];
    const thdEl = $('.kp-thd'), kneeOut = $('[data-r="knee"]'), gapOut = $('[data-r="gap"]');

    // Input sine (fixed)
    const inputPts = Array.from({ length: WN + 1 }, (_, i) => drive * Math.sin(4 * Math.PI * i / WN));
    inputPath.setAttribute('d', pathOf(inputPts.map((v, i) => [WX(i), WYf(v)])));

    // A frame is everything drawn for one state; two frames blend into an intermediate one
    const frameOf = s => {
      const k = kneeStart(s.mode, s.slope);
      return {
        state: s,
        main: x => clip(x, s),
        off: x => clip(x, { ...s, normalize: false }),
        harm: harmonics(s, drive, H.count),
        v: s.view === 'db' ? 1 : 0,
        k, kVis: k == null ? 0 : 1,
        norm: s.normalize ? 1 : 0,
      };
    };
    const mix = (a, b, t) => t >= 1 ? b : t <= 0 ? a : {
      state: b.state,
      main: x => lerp(a.main(x), b.main(x), t),
      off: x => lerp(a.off(x), b.off(x), t),
      harm: { db: a.harm.db.map((d, i) => lerp(d, b.harm.db[i], t)), thd: lerp(a.harm.thd, b.harm.thd, t) },
      v: lerp(a.v, b.v, t),
      k: b.k == null ? a.k : a.k == null ? b.k : lerp(a.k, b.k, t),
      kVis: lerp(a.kVis, b.kVis, t),
      norm: lerp(a.norm, b.norm, t),
    };

    // Curve points in the current view; between views each sample moves from one position to the other
    const pointsOf = (f, v) => {
      if (v <= 0) return fullPoints(f, LB);
      const d = dbPoints(f, DBB);
      if (v >= 1) return d;
      return fullPoints(f, LB).map((p, i) => [lerp(p[0], d[i][0], v), lerp(p[1], d[i][1], v)]);
    };

    let shown = frameOf(initial), from = shown, to = shown, animation = null, phase = 0, dotTimer = null;

    function draw(f) {
      shown = f;
      const v = f.v;
      fullScaffold.style.opacity = r(1 - v);
      dbScaffold.style.opacity = r(v);

      curvePath.setAttribute('d', pathOf(pointsOf(f.main, v)));
      ghostPath.setAttribute('d', pathOf(pointsOf(f.off, v)));
      ghostPath.style.opacity = r(f.norm);

      // Normalize gain, measured at an input equal to the threshold (dB view)
      const [gapSeg, gapText] = gapEl.children;
      const g0 = dbOf(f.off(1)), g1 = dbOf(f.main(1));
      gapSeg.setAttribute('x1', r(DBB.X(0))); gapSeg.setAttribute('x2', r(DBB.X(0)));
      gapSeg.setAttribute('y1', r(DBB.Y(g0))); gapSeg.setAttribute('y2', r(DBB.Y(g1)));
      gapText.setAttribute('x', r(DBB.X(0) + 6)); gapText.setAttribute('y', r(DBB.Y(g0) + 14));
      gapText.textContent = fmtDb(g1 - g0, 2);
      gapEl.style.opacity = r(v * f.norm);

      // Start of the knee on the positive half-wave (dB view)
      if (f.k != null) {
        const kx = DBB.X(dB(f.k)), ky = DBB.Y(dbOf(f.main(f.k)));
        const [circle, text] = kneeEl.children;
        circle.setAttribute('cx', r(kx)); circle.setAttribute('cy', r(ky));
        text.setAttribute('x', r(kx + 9)); text.setAttribute('y', r(ky + 15));
      }
      kneeEl.style.opacity = r(f.kVis * v);

      wavePath.setAttribute('d', pathOf(inputPts.map((x, i) => [WX(i), WYf(f.main(x))])));
      // Removed part: between input and output where they differ
      const upper = inputPts.map((x, i) => [WX(i), WYf(x)]);
      const lower = inputPts.map((x, i) => [WX(i), WYf(f.main(x))]).reverse();
      removedPath.setAttribute('d', `${pathOf(upper)}L${lower.map(p => `${r(p[0])} ${r(p[1])}`).join('L')}Z`);

      const bw = (H.w - 20) / H.count;
      bars.forEach((g, n) => {
        const db = f.harm.db[n];
        const hgt = Math.max(1.5, (db + 90) / 90 * (H.h - 26));
        const rect = g.firstElementChild, text = g.lastElementChild;
        rect.setAttribute('x', r(10 + n * bw + bw * 0.22));
        rect.setAttribute('width', r(bw * 0.56));
        rect.setAttribute('y', r(H.h - 16 - hgt));
        rect.setAttribute('height', r(hgt));
        g.classList.toggle('is-even', (n + 1) % 2 === 0);
        g.classList.toggle('is-silent', db <= -89);
        text.setAttribute('x', r(10 + n * bw + bw / 2));
        text.setAttribute('y', H.h - 3);
        text.textContent = n + 1;
      });
      thdEl.textContent = `THD ${(f.harm.thd * 100).toFixed(1)}%`;
      dot.style.opacity = r(1 - v);
    }

    function readouts(s) {
      const ks = kneeStart(s.mode, s.slope);
      kneeOut.textContent = ks == null ? 'none' : fmtDb(dB(ks));
      gapOut.textContent = fmtDb(dB(Math.abs(clip(1, s))), 2);
    }

    // A dot runs along the curve, following the sine input (linear view only)
    function moveDot() {
      phase += 0.018;
      const x = drive * Math.sin(phase);
      dot.setAttribute('cx', r(LB.X(x)));
      dot.setAttribute('cy', r(LB.Y(shown.main(x))));
      dotTimer = requestAnimationFrame(moveDot);
    }

    function set(next, animate = true) {
      const target = frameOf({ ...next });
      readouts(target.state);
      if (animation) { cancelAnimationFrame(animation); animation = null; }
      // Start from what is on screen, also when a transition is interrupted
      from = shown;
      to = target;
      if (reduce || !animate) { draw(to); return; }
      const t0 = performance.now(), dur = 700;
      const step = now => {
        const p = Math.min(1, (now - t0) / dur);
        const t = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        draw(mix(from, to, t));
        if (p < 1) animation = requestAnimationFrame(step);
        else animation = null;
      };
      animation = requestAnimationFrame(step);
    }

    readouts(shown.state);
    draw(shown);
    if (!reduce) {
      // Run the dot only while the stage is on screen
      new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && !dotTimer) moveDot();
        else if (!entry.isIntersecting && dotTimer) { cancelAnimationFrame(dotTimer); dotTimer = null; }
      }).observe(container);
    } else {
      dot.remove();
    }
    return { set };
  }

  window.KDPlots = { MODES, clip, harmonics, kneeStart, normGain, transferSVG, waveSVG, displaySVG, live };
})();
