// Long-form plugin pages. A plugin with `guide` in plugins.json has four pages:
//   overview  – /plugins/<id>.html: hero (page-content.js) + the sections rendered here
//   install   – /plugins/<id>/install.html   (plugin-guide.js)
//   manual    – /plugins/<id>/manual.html    (plugin-guide.js)
//   history   – /plugins/<id>/history.html   (plugin-guide.js)
// Their content lives in the file named by guide.data, loaded only on these pages.
//
// Overview section types (in the order listed in the data):
//   tour     – scroll-driven tour: the steps scroll on the left, the screenshot stays put on the
//              right, zooms to the control each step describes and labels its parts (pins)
//   curves   – clipping modes: the transfer curve, a clipped sine and its harmonics, computed live
//              (plugin-plots.js) and changing as the steps scroll
//   feature  – a cropped screenshot with switchable views and labels, next to short notes
//   start    – getting started: download, installation guide, manual
//
// Pins are labels on a screenshot: { x, y, label, side } with x, y in % of the screenshot.
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  // ── Data ─────────────────────────────────────────────────────────────────────
  const cache = {};
  function load(plugin) {
    const url = plugin.guide?.data;
    if (!url) return Promise.reject(new Error('No guide data'));
    if (!cache[url]) {
      cache[url] = fetch(url, { cache: 'no-cache' }).then(response => {
        if (!response.ok) throw new Error(`Guide data request failed: ${response.status}`);
        return response.json();
      }).catch(error => { delete cache[url]; throw error; });
    }
    return cache[url];
  }

  // Words of a heading, each in its own span so they can rise one after another
  function splitWords(text) {
    return esc(text).split(/\s+/).map((word, i) =>
      `<span class="ks-word" style="--i:${i}"><span>${word}</span></span>`).join(' ');
  }

  const ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function textLink(href, label) {
    return `<a class="ks-link" href="${esc(href)}">${esc(label)}${ARROW}</a>`;
  }

  function head(section, index, extra = '') {
    return `
      <div class="ks-head">
        ${index ? `<span class="ks-index" data-ks-reveal>${String(index).padStart(2, '0')}</span>` : ''}
        <h2 class="ks-title" data-ks-split>${splitWords(section.title)}</h2>
        ${section.intro ? `<p class="ks-intro" data-ks-reveal style="--d:120ms">${esc(section.intro)}</p>` : ''}
        ${extra ? `<div class="ks-head-extra" data-ks-reveal style="--d:200ms">${extra}</div>` : ''}
      </div>`;
  }

  function specList(pairs, className) {
    if (!pairs || !pairs.length) return '';
    return `<dl class="${className}">${pairs.map(([label, value]) =>
      `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`;
  }

  const manualLink = (plugin, id, label) => plugin.guide?.manual && id
    ? textLink(`${plugin.guide.manual}#${id}`, label) : '';

  // ── Screenshot frame that can zoom on a region ───────────────────────────────
  // focus = [left, top, width, height] in % of the screenshot, or a list of two such regions (both outlined,
  // the zoom covers both). The layer holding the images is scaled and moved; the rings, the dimming and the
  // pins sit outside it so they stay crisp.
  const MAX_ZOOM = 2.1;
  const regionsOf = focus => !focus ? [] : Array.isArray(focus[0]) ? focus : [focus];
  const unionOf = rects => {
    const x = Math.min(...rects.map(q => q[0])), y = Math.min(...rects.map(q => q[1]));
    return [x, y, Math.max(...rects.map(q => q[0] + q[2])) - x, Math.max(...rects.map(q => q[1] + q[3])) - y];
  };

  function zoomFor(focus) {
    const rects = regionsOf(focus);
    if (!rects.length) return { s: 1, tx: 0, ty: 0, rings: [] };
    const [x, y, w, h] = unionOf(rects);
    const s = Math.max(1, Math.min(MAX_ZOOM, 82 / w, 82 / h));
    const clamp = (v, min) => Math.min(0, Math.max(min, v));
    const tx = clamp(50 - (x + w / 2) * s, 100 - 100 * s);
    const ty = clamp(50 - (y + h / 2) * s, 100 - 100 * s);
    return { s, tx, ty, rings: rects.slice(0, 2).map(q => [tx + q[0] * s, ty + q[1] * s, q[2] * s, q[3] * s]) };
  }

  // Ring a and ring b (a second region; without one it shrinks to the centre of ring a and fades out),
  // as unitless percentages of the frame
  function zoomVars(focus) {
    const { s, tx, ty, rings } = zoomFor(focus);
    const vars = { '--ks-s': s.toFixed(4), '--ks-tx': `${tx.toFixed(3)}%`, '--ks-ty': `${ty.toFixed(3)}%` };
    ['a', 'b'].forEach((key, i) => {
      const ring = rings[i] || (rings[0] ? [rings[0][0] + rings[0][2] / 2, rings[0][1] + rings[0][3] / 2, 0, 0] : null);
      if (!ring) return;
      const [x, y, w, h] = ring;
      Object.assign(vars, {
        [`--ks-${key}x`]: x.toFixed(3), [`--ks-${key}y`]: y.toFixed(3),
        [`--ks-${key}w`]: w.toFixed(3), [`--ks-${key}h`]: h.toFixed(3),
        [`--ks-${key}o`]: rings[i] ? '1' : '0',
      });
    });
    return vars;
  }

  // Where a point of the screenshot lands in the frame (in % of the frame)
  function placer(focus, crop) {
    if (crop && focus) {
      const [fx, fy, fw, fh] = focus;
      return (x, y) => [(x - fx) / fw * 100, (y - fy) / fh * 100];
    }
    const { s, tx, ty } = zoomFor(focus);
    return (x, y) => [tx + x * s, ty + y * s];
  }

  function pinsMarkup(pins, focus, crop) {
    if (!pins || !pins.length) return '';
    const place = placer(focus, crop);
    return pins.map((p, i) => {
      const [left, top] = place(p.x, p.y);
      if (left < 1 || left > 99 || top < 1 || top > 99) return '';
      return `<span class="ks-pin ks-pin--${esc(p.side || 'top')}" style="left:${left.toFixed(2)}%;top:${top.toFixed(2)}%;--i:${i}"><b>${i + 1}</b><em>${esc(p.label)}</em></span>`;
    }).join('');
  }

  function pinLegend(pins) {
    if (!pins || !pins.length) return '';
    return `<ol class="ks-pin-legend">${pins.map(p => `<li>${esc(p.label)}</li>`).join('')}</ol>`;
  }

  function setPins(frameEl, pins, focus, crop) {
    const host = frameEl.querySelector('.ks-pins');
    if (!host) return;
    host.classList.remove('is-shown');
    host.innerHTML = pinsMarkup(pins, focus, crop);
    // Pins appear once the zoom has settled
    clearTimeout(host._timer);
    host._timer = setTimeout(() => host.classList.add('is-shown'), reduceMotion.matches ? 0 : 650);
  }

  function applyZoom(frameEl, focus) {
    Object.entries(zoomVars(focus)).forEach(([name, value]) => frameEl.style.setProperty(name, value));
    frameEl.classList.toggle('has-ring', regionsOf(focus).length > 0);
  }

  // crop: the frame takes the shape of the focus region and shows only that part, at full size
  function frame(plugin, data, { images, active, focus, color, className = '', label, ring = true, crop = false, pins = null }) {
    const [aw, ah] = data.aspect || [16, 10];
    const styles = color ? [`--ks-color:${color}`] : [];
    let layerStyle = '', hasRing = false;
    if (crop && focus) {
      const [x, y, w, h] = focus;
      styles.push(`aspect-ratio:${(w * aw).toFixed(1)} / ${(h * ah).toFixed(1)}`);
      // The layer keeps the screenshot's own proportions (its height follows from its width) and is moved by
      // a fraction of its own size, so the crop does not depend on the frame's border or rounding
      layerStyle = ` style="width:${(100 / w * 100).toFixed(4)}%;aspect-ratio:${aw} / ${ah};transform:translate(${(-x).toFixed(4)}%, ${(-y).toFixed(4)}%)"`;
      ring = false;
    } else {
      styles.push(`aspect-ratio:${aw} / ${ah}`, ...Object.entries(zoomVars(focus)).map(([k, v]) => `${k}:${v}`));
      hasRing = ring && regionsOf(focus).length > 0;
    }
    const imgs = images.map(i => `<img src="${esc(plugin.images[i])}" alt="" data-image="${i}" class="${i === active ? 'is-active' : ''}" loading="lazy" decoding="async">`).join('');
    return `
      <div class="ks-frame ${className}${crop ? ' is-crop' : ''}${ring ? ' has-spots' : ''}${hasRing ? ' has-ring' : ''}" style="${styles.join(';')}" role="img" aria-label="${esc(label || `${plugin.name} interface`)}">
        <div class="ks-frame-layer"${layerStyle}>${imgs}</div>
        ${ring ? `<span class="ks-dim" aria-hidden="true"></span>${['a', 'b'].map(key => `<span class="ks-ring ks-ring--${key}" aria-hidden="true"><span class="ks-ring-view"><span class="ks-frame-layer">${imgs}</span></span></span>`).join('')}` : ''}
        ${pins ? `<div class="ks-pins is-shown" aria-hidden="true">${pinsMarkup(pins, focus, crop)}</div>` : ''}
      </div>`;
  }

  const uniq = list => [...new Set(list)];
  const shotColor = (data, image) => data.shots?.[image]?.color || 'var(--kd-blue)';

  // ── Page navigation shared by the four pages ─────────────────────────────────
  // active: 'overview' | 'install' | 'manual' | 'history'
  function nav(plugin, active, action) {
    const links = [
      { id: 'install', label: 'Install', href: plugin.guide?.install },
      { id: 'manual', label: 'Manual', href: plugin.guide?.manual },
      { id: 'history', label: 'Version history', href: plugin.guide?.history },
    ].filter(link => link.href);
    return `
      <nav class="ks-nav" aria-label="${esc(plugin.name)}">
        <div class="container ks-nav-inner">
          <a class="ks-nav-name" href="${esc(plugin.page)}"${active === 'overview' ? ' aria-current="page"' : ''}>${esc(plugin.name)}</a>
          <div class="ks-nav-links">
            ${links.map(link => `<a href="${esc(link.href)}"${link.id === active ? ' class="is-active" aria-current="page"' : ''}>${esc(link.label)}</a>`).join('')}
          </div>
          ${action ? `<a href="${esc(action.href)}" class="btn btn-primary ks-cta ks-cta--small" target="_blank" rel="noopener noreferrer">${esc(action.label)}</a>` : ''}
        </div>
      </nav>`;
  }

  // ── Overview sections ────────────────────────────────────────────────────────
  function renderTour(plugin, data, section, index) {
    const images = uniq(section.steps.map(step => step.image));
    const first = section.steps[0];
    const total = String(section.steps.length).padStart(2, '0');
    return `
      <section class="ks ks-tour" id="${esc(section.id)}" data-ks-tour style="--ks-color:${shotColor(data, first.image)}">
        <div class="container">
          ${head(section, index)}
          <div class="ks-tour-grid">
            <ol class="ks-tour-steps">
              ${section.steps.map((step, i) => `
                <li class="ks-step${i === 0 ? ' is-active' : ''}" data-image="${step.image}"
                    data-focus="${esc(JSON.stringify(step.focus || null))}" data-pins="${esc(JSON.stringify(step.pins || []))}"
                    style="--ks-color:${shotColor(data, step.image)}">
                  <div class="ks-step-visual">
                    ${frame(plugin, data, { images: [step.image], active: step.image, focus: step.focus, color: shotColor(data, step.image), label: `${plugin.name}: ${step.title}`, pins: step.pins })}
                    ${pinLegend(step.pins)}
                  </div>
                  <span class="ks-step-num">${String(i + 1).padStart(2, '0')}</span>
                  <h3>${esc(step.title)}</h3>
                  <p>${esc(step.text)}</p>
                  ${specList(step.specs, 'ks-specs')}
                  ${manualLink(plugin, step.manual, 'In the manual')}
                </li>`).join('')}
            </ol>
            <div class="ks-tour-stage" aria-hidden="true">
              <div class="ks-tour-sticky">
                ${frame(plugin, data, { images, active: first.image, focus: first.focus, color: shotColor(data, first.image), className: 'ks-tour-frame', pins: [] })}
                <div class="ks-tour-progress">
                  <span class="ks-tour-label">${esc(first.title)}</span>
                  <span class="ks-tour-count"><b>01</b> / ${total}</span>
                  <span class="ks-tour-bar"><span></span></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>`;
  }

  function renderCurves(plugin, data, section, index) {
    const modes = window.KDPlots?.MODES || [];
    const modeColor = mode => shotColor(data, (data.overview.modeImages || { Softer: 1, Warmer: 0, Harder: 2, Darker: 3 })[mode]);
    const first = section.steps[0];
    return `
      <section class="ks ks-curves" id="${esc(section.id)}" data-ks-curves data-drive="${Number(section.drive) || 1.78}" style="--ks-color:${modeColor(first.mode)}">
        <div class="container">
          ${head(section, index, manualLink(plugin, section.manual, 'In the manual'))}
          <div class="ks-curves-grid">
            <ol class="ks-curves-steps">
              ${section.steps.map((step, i) => `
                <li class="ks-cstep${i === 0 ? ' is-active' : ''}" data-mode="${esc(step.mode)}" data-slope="${Number(step.slope) || 0.5}"
                    data-normalize="${step.normalize ? 1 : 0}" data-view="${step.view === 'db' ? 'db' : 'full'}" data-demo="${esc(step.demo || '')}" style="--ks-color:${modeColor(step.mode)}">
                  <h3>${esc(step.title)}</h3>
                  <p>${esc(step.text)}</p>
                </li>`).join('')}
            </ol>
            <div class="ks-curves-stage">
              <div class="ks-curves-sticky">
                <div class="ks-scope">
                  <div class="ks-scope-controls">
                    <div class="ks-scope-modes" role="group" aria-label="Mode">
                      ${modes.map(mode => `<button type="button" data-mode="${mode}" style="--ks-tab-color:${modeColor(mode)}" aria-pressed="${mode === first.mode}"${mode === first.mode ? ' class="is-active"' : ''}>${mode}</button>`).join('')}
                    </div>
                    <label class="ks-scope-slope">
                      <span>Slope <b class="ks-scope-slope-value">${Number(first.slope).toFixed(2)}</b></span>
                      <input type="range" min="0.1" max="1" step="0.01" value="${Number(first.slope)}" aria-label="Slope">
                    </label>
                    <label class="ks-scope-toggle">
                      <input type="checkbox"${first.normalize ? ' checked' : ''}><span>Normalize</span>
                    </label>
                  </div>
                  <div class="ks-scope-plots"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>`;
  }

  // Scroll-driven plot with its own controls: section.scope names the plot (window.KDScopes), section.controls the
  // controls above it, and each step sets a state (and may run a demo) while it is the active one.
  //   controls: { type: 'choice', key, values } | { type: 'range', key, label, min, max, step, scale: 'log', format }
  //             | { type: 'toggle', key, label, disables }
  //   A range can narrow in some states: alt: { key, value, set: { min, max } } (KrystalComp's upward mode).
  //   section.colors + section.colorKeys: the accent follows the state, e.g. { 'UWRD PEAK': '#FFB000' } by mode and detector.
  const SCOPE_FORMATS = {
    attack: v => (v < 10 ? 'Fast' : v < 18 ? 'Medium' : 'Slow'),
    ms: v => `${v < 100 ? v.toFixed(0) : Math.round(v)} ms`,
    msfine: v => `${v === 0 ? '0' : v < 1 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.round(v)} ms`,
    pct: v => `${Math.round(v)}%`,
    pctsigned: v => `${Math.round(v) > 0 ? '+' : Math.round(v) < 0 ? '−' : ''}${Math.abs(Math.round(v))}%`,
    hz: v => (v < 1000 ? `${Math.round(v)} Hz` : `${(v / 1000).toFixed(1)} kHz`),
    db: v => `${v < -0.05 ? '−' : ''}${Math.abs(v).toFixed(1)} dB`,
    ratio: v => `${v.toFixed(1)}:1`,
  };
  const scopeRange = (c, state) => (c.alt && state[c.alt.key] === c.alt.value ? { ...c, ...c.alt.set } : c);
  const scopeColor = (section, state, fallback) =>
    (section.colors && section.colors[(section.colorKeys || []).map(k => state[k]).join(' ')]) || fallback;
  const scopeFormat = (control, v) => (SCOPE_FORMATS[control.format] || (x => String(x)))(Number(v));
  // Range input position (0-1000) <-> value, linear or logarithmic
  const toSlider = (c, v) => Math.round(1000 * (c.scale === 'log' ? Math.log(v / c.min) / Math.log(c.max / c.min) : (v - c.min) / (c.max - c.min)));
  const fromSlider = (c, p) => {
    const t = p / 1000;
    const v = c.scale === 'log' ? c.min * Math.pow(c.max / c.min, t) : c.min + t * (c.max - c.min);
    return c.step ? Math.round(v / c.step) * c.step : v;
  };

  function renderScope(plugin, data, section, index) {
    const first = section.steps[0].state || {};
    const control = c => {
      if (c.type === 'choice') return `
        <div class="ks-scope-modes" role="group" aria-label="${esc(c.label || c.key)}" data-control="${esc(c.key)}">
          ${c.values.map(v => `<button type="button" data-value="${esc(v)}" style="--ks-tab-color:var(--ks-color)" aria-pressed="${v === first[c.key]}"${v === first[c.key] ? ' class="is-active"' : ''}>${esc(v)}</button>`).join('')}
        </div>`;
      if (c.type === 'toggle') return `
        <label class="ks-scope-toggle" data-control="${esc(c.key)}"><input type="checkbox"${first[c.key] ? ' checked' : ''}><span>${esc(c.label)}</span></label>`;
      return `
        <label class="ks-scope-slope" data-control="${esc(c.key)}">
          <span>${esc(c.label)}</span><b class="ks-scope-value">${esc(scopeFormat(c, first[c.key]))}</b>
          <input type="range" min="0" max="1000" step="1" value="${toSlider(scopeRange(c, first), first[c.key])}" aria-label="${esc(c.label)}">
        </label>`;
    };
    return `
      <section class="ks ks-curves ks-scope-section" id="${esc(section.id)}" data-ks-scope="${esc(section.scope)}"
        data-controls="${esc(JSON.stringify(section.controls || []))}" data-colors="${esc(JSON.stringify({ colors: section.colors || null, keys: section.colorKeys || [] }))}"
        style="--ks-color:${scopeColor(section, first, shotColor(data, 0))}">
        <div class="container">
          ${head(section, index, manualLink(plugin, section.manual, 'In the manual'))}
          <div class="ks-curves-grid">
            <ol class="ks-curves-steps">
              ${section.steps.map((step, i) => `
                <li class="ks-cstep${i === 0 ? ' is-active' : ''}" data-state="${esc(JSON.stringify(step.state || {}))}" data-demo="${esc(JSON.stringify(step.demo || null))}">
                  <h3>${esc(step.title)}</h3>
                  <p>${esc(step.text)}</p>
                </li>`).join('')}
            </ol>
            <div class="ks-curves-stage">
              <div class="ks-curves-sticky">
                <div class="ks-scope">
                  <div class="ks-scope-controls">${(section.controls || []).filter(c => c.type !== 'range').map(control).join('')}</div>
                  <div class="ks-scope-plots"></div>
                  <div class="ks-scope-sliders">${(section.controls || []).filter(c => c.type === 'range').map(control).join('')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>`;
  }

  function initScope(section) {
    const host = section.querySelector('.ks-scope-plots');
    const make = window.KDScopes?.[section.dataset.ksScope];
    if (!host || !make) return;
    const controls = parse(section.dataset.controls, []);
    const steps = [...section.querySelectorAll('.ks-cstep')];
    const el = key => section.querySelector(`[data-control="${key}"]`);
    const state = { ...parse(steps[0].dataset.state, {}) };
    const plot = make(host, { ...state });
    let demo = null;

    // Phones: only the plot stays pinned while the steps scroll; the sliders move below the steps
    const sliders = section.querySelector('.ks-scope-sliders');
    if (sliders && sliders.children.length) {
      const home = sliders.parentNode, dock = document.createElement('div');
      dock.className = 'ks-scope-dock';
      dock.innerHTML = '<p class="ks-scope-dock-title">Adjust the settings</p>';
      section.querySelector('.ks-curves-grid').appendChild(dock);
      const narrow = window.matchMedia('(max-width: 959px)');
      const place = () => (narrow.matches ? dock : home).appendChild(sliders);
      place();
      narrow.addEventListener('change', place);
      // Reaching the sliders hands the plot over to the reader: the step demo stops
      new IntersectionObserver(([entry]) => { if (entry.isIntersecting && narrow.matches) stopDemo(); }, { threshold: 0.5 }).observe(dock);
    }

    const sync = () => controls.forEach(c => {
      const node = el(c.key);
      if (!node) return;
      if (c.type === 'choice') node.querySelectorAll('button').forEach(b => {
        const on = b.dataset.value === state[c.key];
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on);
      });
      else if (c.type === 'toggle') {
        node.querySelector('input').checked = !!state[c.key];
        if (c.disables) el(c.disables)?.classList.toggle('is-disabled', !!state[c.key]);
      } else {
        node.querySelector('input').value = toSlider(scopeRange(c, state), state[c.key]);
        node.querySelector('.ks-scope-value').textContent = scopeFormat(c, state[c.key]);
      }
    });
    const colors = parse(section.dataset.colors, { colors: null, keys: [] });
    const apply = changes => {
      Object.assign(state, changes);
      // Values outside a narrower range (upward mode) are brought inside it
      controls.forEach(c => {
        if (c.type !== 'range') return;
        const rg = scopeRange(c, state);
        state[c.key] = Math.min(rg.max, Math.max(rg.min, state[c.key]));
      });
      const color = colors.colors && colors.colors[colors.keys.map(k => state[k]).join(' ')];
      if (color) section.style.setProperty('--ks-color', color);
      sync();
      plot.set({ ...state });
    };
    const stopDemo = () => { if (demo) { demo(); demo = null; } };

    // Demos: { sweep: key, from, to, period } moves a value back and forth; { toggle: key, every } flips a switch
    const runDemo = d => {
      if (d.sweep) {
        const t0 = performance.now();
        let frame = 0, last = 0;
        const tick = now => {
          if (now - last > 50) {
            last = now;
            const t = 0.5 - 0.5 * Math.cos((now - t0) / (d.period || 3200) * 2 * Math.PI);
            apply({ [d.sweep]: d.from + (d.to - d.from) * t });
          }
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
      }
      if (d.toggle) {
        const timer = setInterval(() => apply({ [d.toggle]: !state[d.toggle] }), d.every || 2600);
        return () => clearInterval(timer);
      }
      if (d.cycle) {   // { cycle: key, values, every }: steps through the values of a selector
        const timer = setInterval(() => {
          const i = d.values.indexOf(state[d.cycle]);
          apply({ [d.cycle]: d.values[(i + 1) % d.values.length] });
        }, d.every || 2600);
        return () => clearInterval(timer);
      }
      return null;
    };

    let current = -1;
    onMiddle(steps, i => {
      if (i === current || i < 0) return;
      current = i;
      steps.forEach((s, n) => s.classList.toggle('is-active', n === i));
      stopDemo();
      apply(parse(steps[i].dataset.state, {}));
      const d = parse(steps[i].dataset.demo, null);
      if (d && !reduceMotion.matches) {
        const delay = setTimeout(() => { if (current === i) demo = runDemo(d); }, 1300);
        demo = () => clearTimeout(delay);
      }
    });

    controls.forEach(c => {
      const node = el(c.key);
      if (!node) return;
      if (c.type === 'choice') node.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { stopDemo(); apply({ [c.key]: b.dataset.value }); }));
      else if (c.type === 'toggle') node.querySelector('input').addEventListener('change', e => { stopDemo(); apply({ [c.key]: e.target.checked }); });
      else node.querySelector('input').addEventListener('input', e => { stopDemo(); apply({ [c.key]: fromSlider(scopeRange(c, state), Number(e.target.value)) }); });
    });
    sync();

    new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) stopDemo();
      else if (!demo && current >= 0 && !reduceMotion.matches) {
        const d = parse(steps[current].dataset.demo, null);
        if (d) demo = runDemo(d);
      }
    }).observe(section);
  }

  function renderFeature(plugin, data, section, index) {
    const views = section.views || [];
    const first = views[0] || { image: 0 };
    return `
      <section class="ks ks-feature${section.reverse ? ' is-reverse' : ''}" id="${esc(section.id)}" data-ks-feature style="--ks-color:${shotColor(data, first.image)}"
        data-focus="${esc(JSON.stringify(section.focus || null))}" data-crop="${section.crop ? 1 : 0}">
        <div class="container ks-feature-grid">
          <div class="ks-feature-shot" data-ks-reveal>
            ${frame(plugin, data, { images: views.map(view => view.image), active: first.image, focus: section.focus, crop: !!section.crop, ring: false, className: 'ks-feature-frame', label: `${plugin.name}: ${section.title}`, pins: first.pins || [] })}
            ${views.length > 1 ? `
              <div class="ks-switch" role="group" aria-label="${esc(section.title)} view">
                ${views.map((view, i) => `<button type="button" class="${i === 0 ? 'is-active' : ''}" aria-pressed="${i === 0}" data-image="${view.image}" data-shape="${esc(view.shape || '')}" data-pins="${esc(JSON.stringify(view.pins || []))}" style="--ks-tab-color:${shotColor(data, view.image)}">${esc(view.label)}</button>`).join('')}
              </div>` : ''}
          </div>
          <div class="ks-feature-copy">
            ${head(section, index)}
            <div class="ks-notes">
              ${(section.columns || []).map((column, i) => `
                <div class="ks-note" data-ks-reveal style="--d:${160 + i * 80}ms">
                  <h3>${esc(column.title)}</h3>
                  <p>${esc(column.text)}</p>
                </div>`).join('')}
            </div>
            ${section.manual ? `<div class="ks-feature-more" data-ks-reveal style="--d:480ms">${manualLink(plugin, section.manual, 'In the manual')}</div>` : ''}
          </div>
        </div>
        ${section.wave ? renderFoldWaves(section.wave) : ''}
        ${section.compare ? renderDisplayCompare(section.compare) : ''}
        ${section.pair ? renderPair(section.pair) : ''}
      </section>`;
  }

  // Waveform before and after folding; the plots are drawn by initFeature (KDPlots), the shape follows the view switch
  function renderFoldWaves(wave) {
    return `
      <div class="container">
        <div class="ks-fold" data-ks-reveal data-wave="${esc(JSON.stringify(wave))}">
          <figure><figcaption>Fold 0%</figcaption><div class="ks-fold-plot" data-fold="0"></div></figure>
          <figure><figcaption>Fold 100%, <span class="ks-fold-shape"></span></figcaption><div class="ks-fold-plot" data-fold="1"></div></figure>
          ${wave.caption ? `<p class="ks-fold-note">${esc(wave.caption)}</p>` : ''}
        </div>
      </div>`;
  }

  // The same clipped signal as WAVE and as RECT draw it; drawn by initFeature, the plot of the selected view is highlighted
  function renderDisplayCompare(compare) {
    return `
      <div class="container">
        <div class="ks-fold ks-compare" data-ks-reveal data-compare="${esc(JSON.stringify(compare))}">
          <figure data-view="WAVE"><figcaption>Bipolar waveform (WAVE)</figcaption><div class="ks-fold-plot"></div></figure>
          <figure data-view="RECT"><figcaption>Rectified waveform (RECT)</figcaption><div class="ks-fold-plot"></div></figure>
          ${compare.caption ? `<p class="ks-fold-note">${esc(compare.caption)}</p>` : ''}
        </div>
      </div>`;
  }

  // Two plots side by side under a feature: the left one fixed, the right one following the view switch.
  //   pair: { plot: name in window.KDPanels, left: { label, state }, right: { VIEW: { label, state } }, caption }
  function renderPair(pair) {
    return `
      <div class="container">
        <div class="ks-fold ks-pair" data-ks-reveal data-pair="${esc(JSON.stringify(pair))}">
          <figure data-side="left"><figcaption><span class="ks-pair-label"></span><b class="ks-pair-stat"></b></figcaption><div class="ks-fold-plot"></div></figure>
          <figure data-side="right"><figcaption><span class="ks-pair-label"></span><b class="ks-pair-stat"></b></figcaption><div class="ks-fold-plot"></div></figure>
          ${pair.caption ? `<p class="ks-fold-note">${esc(pair.caption)}</p>` : ''}
        </div>
      </div>`;
  }

  function renderStart(plugin, data, section, index, parts) {
    const target = step => {
      if (step.action === 'download' && parts.action) {
        return `<a href="${esc(parts.action.href)}" class="btn btn-primary ks-cta" target="_blank" rel="noopener noreferrer">${esc(parts.action.label)}</a>`;
      }
      const href = step.link && plugin.guide?.[step.link.page];
      return href ? textLink(href, step.link.label) : '';
    };
    return `
      <section class="ks ks-start" id="${esc(section.id)}">
        <div class="container">
          ${head(section, index)}
          <ol class="ks-start-steps">
            ${section.steps.map((step, i) => `
              <li data-ks-reveal style="--d:${i * 100}ms">
                <span class="ks-start-num">${i + 1}</span>
                <h3>${esc(step.title)}</h3>
                <p>${esc(step.text)}</p>
                <div class="ks-start-action">${target(step)}</div>
              </li>`).join('')}
          </ol>
          <div class="back-link"><a href="/plugins.html">Back to all plugins</a></div>
        </div>
      </section>`;
  }

  const RENDERERS = { tour: renderTour, curves: renderCurves, scope: renderScope, feature: renderFeature, start: renderStart };

  // parts: { action: {href, label}, hero: markup placed between the plugin nav and the sections }
  function render(plugin, data, parts) {
    const sections = (data.overview?.sections || []).filter(section => RENDERERS[section.type]);
    let side = 0;
    const html = sections.map((section, i) => {
      // Two-column sections alternate: the visual on the right, then on the left, and so on
      const twoColumn = ['tour', 'curves', 'scope', 'feature'].includes(section.type);
      const left = twoColumn && side++ % 2 === 1;
      const spec = section.type === 'feature' ? { ...section, reverse: !left } : section;
      let markup = RENDERERS[section.type](plugin, data, spec, i + 1, parts);
      if (left && section.type !== 'feature') markup = markup.replace('class="ks ', 'class="ks is-flip ');
      // Alternate the background from one section to the next, as on the About page
      return i % 2 ? markup.replace('class="ks ', 'class="ks ks--alt ') : markup;
    }).join('');
    return nav(plugin, 'overview', parts.action) + (parts.hero || '') + `<div class="ks-story">${html}</div>`;
  }

  // ── Behaviour ────────────────────────────────────────────────────────────────

  // Swap the visible image of a frame (they are stacked; the active one fades in)
  function showImage(frameEl, image) {
    frameEl.querySelectorAll('.ks-frame-layer img').forEach(img => {
      img.classList.toggle('is-active', Number(img.dataset.image) === Number(image));
    });
  }

  function initReveal(root) {
    const items = root.querySelectorAll('[data-ks-reveal], [data-ks-split]');
    if (reduceMotion.matches || !('IntersectionObserver' in window)) return;
    root.classList.add('ks-animate');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    items.forEach(el => {
      // Already above the fold when the page opens on an anchor: shown straight away
      if (el.getBoundingClientRect().bottom < 0) el.classList.add('is-in');
      else observer.observe(el);
    });
  }

  // The element crossing the middle of the screen is the active one
  function onMiddle(elements, callback) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) callback(elements.indexOf(entry.target)); });
    }, { rootMargin: '-48% 0px -48% 0px' });
    elements.forEach(el => observer.observe(el));
  }

  const parse = (text, fallback) => { try { return JSON.parse(text); } catch (e) { return fallback; } };

  function initTour(section) {
    const steps = [...section.querySelectorAll('.ks-step')];
    const stage = section.querySelector('.ks-tour-frame');
    if (!steps.length || !stage) return;
    const label = section.querySelector('.ks-tour-label');
    const count = section.querySelector('.ks-tour-count b');
    const bar = section.querySelector('.ks-tour-bar span');
    let current = -1;

    const activate = i => {
      if (i === current || i < 0) return;
      current = i;
      const step = steps[i];
      const color = step.style.getPropertyValue('--ks-color');
      const focus = parse(step.dataset.focus, null);
      steps.forEach((el, n) => el.classList.toggle('is-active', n === i));
      showImage(stage, step.dataset.image);
      applyZoom(stage, focus);
      setPins(stage, parse(step.dataset.pins, []), focus, false);
      section.style.setProperty('--ks-color', color);
      stage.style.setProperty('--ks-color', color);
      if (label) {
        label.classList.remove('is-swapping');
        void label.offsetWidth;   // restart the text animation
        label.textContent = step.querySelector('h3').textContent;
        label.classList.add('is-swapping');
      }
      if (count) count.textContent = String(i + 1).padStart(2, '0');
      if (bar) bar.style.transform = `scaleX(${(i + 1) / steps.length})`;
    };
    activate(0);
    onMiddle(steps, activate);
  }

  function initCurves(section) {
    const host = section.querySelector('.ks-scope-plots');
    if (!host || !window.KDPlots) return;
    const steps = [...section.querySelectorAll('.ks-cstep')];
    const modeButtons = [...section.querySelectorAll('.ks-scope-modes button')];
    const slider = section.querySelector('.ks-scope-slope input');
    const slopeValue = section.querySelector('.ks-scope-slope-value');
    const normalize = section.querySelector('.ks-scope-toggle input');
    const colorOf = mode => modeButtons.find(b => b.dataset.mode === mode)?.style.getPropertyValue('--ks-tab-color');
    const fromStep = step => ({ mode: step.dataset.mode, slope: Number(step.dataset.slope), normalize: step.dataset.normalize === '1', view: step.dataset.view });
    const state = fromStep(steps[0]);
    const plot = window.KDPlots.live(host, state, { drive: Number(section.dataset.drive) || 1.78 });
    let demo = null;

    const sync = () => {
      modeButtons.forEach(b => { const on = b.dataset.mode === state.mode; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on); });
      slider.value = state.slope;
      slopeValue.textContent = Number(state.slope).toFixed(2);
      normalize.checked = state.normalize;
      section.style.setProperty('--ks-color', colorOf(state.mode));
    };
    const apply = (changes, animate = true) => {
      Object.assign(state, changes);
      sync();
      plot.set({ ...state }, animate);
    };
    const stopDemo = () => { if (demo) { demo(); demo = null; } };

    // Demonstrations that run while their step is the active one
    const DEMOS = {
      // Slope moves back and forth across its whole range
      sweep() {
        const t0 = performance.now();
        let frame = 0, last = 0;
        const tick = now => {
          if (now - last > 33) {
            last = now;
            apply({ slope: Math.round((0.55 - 0.45 * Math.cos((now - t0) / 1600)) * 100) / 100 }, false);
          }
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
      },
      // Normalize switches on and off: the gap at the threshold closes and opens
      normalize() {
        const timer = setInterval(() => apply({ normalize: !state.normalize }), 2600);
        return () => clearInterval(timer);
      },
    };

    let current = -1;
    onMiddle(steps, i => {
      if (i === current || i < 0) return;
      current = i;
      const step = steps[i];
      steps.forEach((el, n) => el.classList.toggle('is-active', n === i));
      stopDemo();
      apply(fromStep(step));
      const run = DEMOS[step.dataset.demo];
      if (run && !reduceMotion.matches) {
        const delay = setTimeout(() => { if (current === i) demo = run(); }, 1300);
        demo = () => clearTimeout(delay);
      }
    });

    modeButtons.forEach(b => b.addEventListener('click', () => { stopDemo(); apply({ mode: b.dataset.mode }); }));
    slider.addEventListener('input', () => { stopDemo(); apply({ slope: Number(slider.value) }, false); });
    normalize.addEventListener('change', () => { stopDemo(); apply({ normalize: normalize.checked }); });

    // Pause the demonstration while the section is off screen
    new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) stopDemo();
      else if (!demo && current >= 0 && !reduceMotion.matches) demo = DEMOS[steps[current].dataset.demo]?.() || null;
    }).observe(section);
  }

  function initFeature(section) {
    const shot = section.querySelector('.ks-feature-frame');
    const buttons = [...section.querySelectorAll('.ks-switch button')];
    const fold = section.querySelector('.ks-fold[data-wave]');
    const drawFold = shape => {
      if (!fold || !window.KDPlots) return;
      const wave = parse(fold.dataset.wave, {});
      const base = { mode: wave.mode || 'Harder', slope: wave.slope || 0.1 };
      const opts = { drive: wave.drive || 1.78, height: 190 };
      fold.querySelector('[data-fold="0"]').innerHTML = window.KDPlots.waveSVG([{ ...base, color: '#8A96A3' }], opts);
      fold.querySelector('[data-fold="1"]').innerHTML = window.KDPlots.waveSVG([{ ...base, fold: 1, shape, color: 'var(--ks-color)' }], opts);
      fold.querySelector('.ks-fold-shape').textContent = shape === 'Sine' ? 'Sine' : 'Tri';
    };
    drawFold(buttons[0]?.dataset.shape || 'Tri');
    const compare = section.querySelector('.ks-compare');
    if (compare && window.KDPlots) {
      const c = parse(compare.dataset.compare, {});
      compare.querySelectorAll('figure').forEach(fig => {
        fig.querySelector('.ks-fold-plot').innerHTML = window.KDPlots.displaySVG({ rect: fig.dataset.view === 'RECT', mode: c.mode, slope: c.slope });
      });
    }
    const markCompare = label => compare?.querySelectorAll('figure').forEach(fig => fig.classList.toggle('is-active', fig.dataset.view === label));
    // Two-panel comparison: the right panel follows the selected view
    const pairEl = section.querySelector('.ks-pair');
    const pair = pairEl ? parse(pairEl.dataset.pair, null) : null;
    const drawPanel = (side, spec) => {
      const make = window.KDPanels?.[pair.plot];
      if (!make || !spec) return;
      const fig = pairEl.querySelector(`[data-side="${side}"]`);
      const res = make(spec.state || {}, { width: 420, height: 200 });
      fig.querySelector('.ks-fold-plot').innerHTML = res.svg;
      fig.querySelector('.ks-pair-label').textContent = spec.label || '';
      fig.querySelector('.ks-pair-stat').textContent = res.stat || '';
    };
    const drawPair = label => {
      if (!pair) return;
      drawPanel('right', pair.right?.[label] || Object.values(pair.right || {})[0]);
    };
    if (pair) { drawPanel('left', pair.left); drawPair(buttons[0]?.textContent.trim()); }
    markCompare(buttons[0]?.textContent.trim());
    if (!shot || buttons.length < 2) return;
    const focus = parse(section.dataset.focus, null);
    const crop = section.dataset.crop === '1';
    let current = 0, timer = null, userPicked = false;
    const select = i => {
      current = i % buttons.length;
      buttons.forEach((button, n) => {
        button.classList.toggle('is-active', n === current);
        button.setAttribute('aria-pressed', n === current);
      });
      showImage(shot, buttons[current].dataset.image);
      setPins(shot, parse(buttons[current].dataset.pins, []), focus, crop);
      section.style.setProperty('--ks-color', buttons[current].style.getPropertyValue('--ks-tab-color'));
      if (buttons[current].dataset.shape) drawFold(buttons[current].dataset.shape);
      markCompare(buttons[current].textContent.trim());
      drawPair(buttons[current].textContent.trim());
    };
    buttons.forEach((button, i) => button.addEventListener('click', () => {
      userPicked = true;
      clearInterval(timer);
      select(i);
    }));
    if (reduceMotion.matches) return;
    new IntersectionObserver(([entry]) => {
      clearInterval(timer);
      if (entry.isIntersecting && !userPicked) timer = setInterval(() => select(current + 1), 4500);
    }, { threshold: 0.4 }).observe(section);
  }

  // Only the plugin's own nav stays at the top while scrolling: the site header scrolls away.
  // Its height still matters for anchors, so it is measured here.
  function initOffsets(root) {
    document.body.classList.add('has-plugin-nav');
    const navEl = root.querySelector('.ks-nav');
    const set = () => {
      document.documentElement.style.setProperty('--ks-header', '0px');
      document.documentElement.style.setProperty('--ks-nav', `${Math.round(navEl ? navEl.getBoundingClientRect().height : 0)}px`);
    };
    set();
    window.addEventListener('resize', set);
  }

  function init(root, plugin) {
    // Old links to the changelog on this page go to the history page
    if (location.hash === '#version-history' && plugin?.guide?.history) {
      location.replace(plugin.guide.history);
      return;
    }
    root.classList.add('has-story');
    initOffsets(root);
    initReveal(root);
    root.querySelectorAll('[data-ks-tour]').forEach(initTour);
    root.querySelectorAll('[data-ks-curves]').forEach(initCurves);
    root.querySelectorAll('[data-ks-scope]').forEach(initScope);
    root.querySelectorAll('[data-ks-feature]').forEach(initFeature);
  }

  window.KDStory = {
    load, render, init, nav, frame, head, esc, splitWords, textLink, initReveal, initOffsets, shotColor, pinLegend,
  };
})();
