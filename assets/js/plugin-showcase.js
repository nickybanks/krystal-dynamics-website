// Homepage plugin showcase: interfaces floating in a row over moving sine waves.
// Hover (or, on phones, scroll a card to the centre) to light up its background;
// click to open a mini-view of the plugin page with the download buttons.
// Uses the shared helpers from main.js (PATREON_URL, formatReleaseDate, getReleaseHighlights, releaseNotes).
(function () {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scrollMode = window.matchMedia('(max-width: 767px)');   // phones: the row scrolls sideways

  const WINDOWS_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/></svg>';
  const APPLE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>';
  const PATREON_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" aria-hidden="true"><path d="M15.303125 4.80625c-0.003125 -2.04375 -1.59375 -3.71875 -3.459375 -4.321875C9.525 -0.265625 6.46875 -0.15625 4.253125 0.8875 1.571875 2.153125 0.728125 4.928125 0.696875 7.69375 0.671875 9.96875 0.896875 15.95625 4.278125 16c2.509375 0.03125 2.884375 -3.203125 4.046875 -4.759375 0.825 -1.109375 1.890625 -1.421875 3.2 -1.746875 2.25 -0.55625 3.784375 -2.334375 3.78125 -4.6875z"/></svg>';
  const CLOSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  // Resting pose of each card in the row: tilt (deg) and vertical offset (px), repeated if there are more plugins
  const POSES = [
    { rot: -5, y: 22 }, { rot: 3.5, y: -26 }, { rot: -1.5, y: 6 },
    { rot: 4.5, y: -14 }, { rot: -4, y: 28 }, { rot: 2.5, y: -20 },
  ];
  const FEATURES_IN_MODAL = 6;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]);
  const clean = text => String(text ?? '').replace(/\s+/g, ' ').trim();   // descriptions in plugins.json keep their source indentation

  let state = null;   // { plugins, items, backdrops, caption, highlights, active }

  // ─────────────────────────────────────────────────────────────────────────────
  // Row of floating cards
  // ─────────────────────────────────────────────────────────────────────────────
  function badgesFor(plugin, highlights) {
    const badges = [];
    if (plugin.isEarlyAccess) badges.push({ variant: 'early', label: 'Early Access' });
    if (plugin === highlights.latestRelease) badges.push({ variant: 'release', label: 'Latest Release' });
    if (plugin === highlights.latestUpdate) badges.push({ variant: 'update', label: 'Latest Update' });
    return badges;
  }

  function badgeHTML(badges) {
    return badges.map(badge =>
      `<span class="plugin-featured-badge plugin-featured-badge--${badge.variant}">${esc(badge.label)}</span>`).join('');
  }

  function renderPluginShowcase(plugins) {
    const section = document.getElementById('pluginShowcase');
    if (section?.classList.contains('plugin-gallery')) { renderPluginGallery(section, plugins); return; }   // plugins.html
    const track = document.getElementById('pluginShowcaseTrack');
    const backdropLayer = document.getElementById('pluginShowcaseBackdrops');
    const caption = document.getElementById('pluginShowcaseCaption');
    if (!section || !track || !backdropLayer || !caption) return;

    const list = plugins.filter(plugin => plugin.images?.length);
    const highlights = getReleaseHighlights(list);
    const mid = (list.length - 1) / 2;

    track.innerHTML = list.map((plugin, index) => {
      const pose = POSES[index % POSES.length];
      const z = Math.round(list.length - Math.abs(index - mid) * 2);   // the middle card sits on top, like a fanned hand
      return `
        <li class="showcase-item" data-index="${index}"
            style="--i:${index}; --rot:${pose.rot}deg; --y:${pose.y}px; --z:${z}; --dur:${(8 + (index % 3) * 1.6).toFixed(1)}s; --delay:${(-index * 2.3).toFixed(1)}s">
          <button class="showcase-card" type="button" aria-haspopup="dialog"
                  aria-label="${esc(plugin.name)}: open the overview">
            <span class="showcase-float">
              <img class="showcase-image" src="${esc(plugin.images[0])}" alt="" decoding="async" draggable="false">
              ${plugin.isEarlyAccess ? '<span class="showcase-flag">Early access</span>' : ''}
            </span>
          </button>
        </li>`;
    }).join('');

    const wallpapers = list.map(plugin => plugin.images[0]);
    const lens = initLensBackdrop(backdropLayer, wallpapers);
    if (!lens) {
      // No WebGL: the wallpapers are plain layers that crossfade
      backdropLayer.innerHTML = wallpapers.map(src =>
        `<div class="showcase-backdrop" style="background-image:url('${esc(src)}')"></div>`).join('');
      preload(wallpapers);
    }

    const items = [...track.querySelectorAll('.showcase-item')];
    state = {
      section, track, plugins: list, items, highlights, caption, lens,
      backdrops: [...backdropLayer.querySelectorAll('.showcase-backdrop')],
      active: -1,
    };

    sizeCardsByInterface(items);
    bindRow();
    setActive(-1);
    initWaves(section);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Plugins page: full-height columns, one floating interface each, over one wave field.
  // The hovered column widens and shows its plugin behind; click opens the same mini-view.
  // ─────────────────────────────────────────────────────────────────────────────
  function renderPluginGallery(section, plugins) {
    const shelf = document.getElementById('pluginGalleryShelf');
    if (!shelf) return;

    // Newest public release first, as on the old library page
    const list = plugins.filter(plugin => plugin.images?.length)
      .sort((a, b) => b.launchDate.localeCompare(a.launchDate));
    const highlights = getReleaseHighlights(list);

    shelf.innerHTML = list.map((plugin, index) => {
      const pose = POSES[index % POSES.length];
      const badges = badgesFor(plugin, highlights);
      const meta = [plugin.version ? `Version ${plugin.version}` : '', (plugin.formats || []).join(' and ')].filter(Boolean).join(', ');
      return `
        <li class="gallery-col" style="--i:${index}; --rot:${(pose.rot * 0.6).toFixed(1)}deg; --y:${Math.round(pose.y * 0.7)}px; --dur:${(8 + (index % 3) * 1.6).toFixed(1)}s; --delay:${(-index * 2.3).toFixed(1)}s">
          <a class="gallery-card" href="${esc(plugin.page)}" aria-label="${esc(plugin.name)}: view details">
            <span class="gallery-bg" style="--img:url('${esc(plugin.images[0])}')" aria-hidden="true"></span>
            <span class="gallery-float">
              <img class="showcase-image" src="${esc(plugin.images[0])}" alt="" decoding="async" draggable="false">
            </span>
            <span class="gallery-info">
              ${badges.length ? `<span class="gallery-badges">${badgeHTML(badges)}</span>` : ''}
              <span class="gallery-name">${esc(plugin.name)}</span>
              <span class="gallery-more"><span class="gallery-more-inner">
                <span class="gallery-desc">${esc(clean(plugin.catalogDescription || plugin.description))}</span>
                <span class="gallery-meta">${esc(meta)}</span>
              </span></span>
            </span>
          </a>
        </li>`;
    }).join('');

    const items = [...shelf.querySelectorAll('.gallery-col')];
    state = { section, plugins: list, items, highlights, active: -1 };
    sizeCardsByInterface(items);

    // Column backgrounds through the lens: each image drawn inside its own column, one continuous
    // flow of matter across all of them. Same looks as the CSS version (see .gallery-bg).
    // motion: speed of the moving matter (1 = full). Resting columns barely move; the selected one comes alive.
    const GALLERY_LOOKS = {
      rest:   { opacity: 0.5,  saturation: 0.3, brightness: 0.75, zoom: 1.04, motion: 0.05 },
      active: { opacity: 0.6,  saturation: 1,   brightness: 1,    zoom: 1,    motion: 1 },
      dimmed: { opacity: 0.32, saturation: 0.3, brightness: 0.75, zoom: 1.04, motion: 0.05 },
    };
    const lensHost = document.createElement('div');
    lensHost.className = 'gallery-lens';
    lensHost.setAttribute('aria-hidden', 'true');
    section.prepend(lensHost);
    const lens = initLensBackdrop(lensHost, list.map(plugin => plugin.images[0]), {
      region: i => items[i]?.getBoundingClientRect(),
    });
    if (lens) {
      section.classList.add('has-lens');
      items.forEach((item, i) => lens.set(i, GALLERY_LOOKS.rest, 1));
    } else {
      lensHost.remove();
    }

    const setGalleryActive = index => {
      state.active = index;
      shelf.classList.toggle('has-active', index >= 0);
      items.forEach((item, i) => item.classList.toggle('is-active', i === index));
      waveEnergy.target = index >= 0 ? 1 : 0;
      if (lens) items.forEach((item, i) => lens.set(i, i === index ? GALLERY_LOOKS.active : index >= 0 ? GALLERY_LOOKS.dimmed : GALLERY_LOOKS.rest));
    };
    const stacked = () => scrollMode.matches;   // phones: rows, tap opens straight away
    let leaveTimer = 0;

    items.forEach((item, index) => {
      const card = item.querySelector('.gallery-card');
      item.addEventListener('pointerenter', event => {
        if (event.pointerType === 'touch' || stacked()) return;
        clearTimeout(leaveTimer);
        setGalleryActive(index);
      });
      card.addEventListener('focus', () => { if (!stacked()) setGalleryActive(index); });
    });

    shelf.addEventListener('pointerleave', event => {
      if (event.pointerType === 'touch') return;
      leaveTimer = setTimeout(() => { if (!shelf.contains(document.activeElement)) setGalleryActive(-1); }, 140);
    });
    shelf.addEventListener('focusout', () => setTimeout(() => {
      if (!shelf.contains(document.activeElement) && !shelf.matches(':hover')) setGalleryActive(-1);
    }, 0));
    shelf.addEventListener('keydown', event => {
      const keys = stacked() ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
      if (!keys.includes(event.key)) return;
      const current = items.findIndex(item => item.contains(document.activeElement));
      const next = Math.max(0, Math.min(items.length - 1, current + (event.key === keys[1] ? 1 : -1)));
      if (current < 0 || next === current) return;
      event.preventDefault();
      items[next].querySelector('.gallery-card').focus();
    });
    scrollMode.addEventListener?.('change', () => setGalleryActive(-1));

    initWaves(section);
  }

  // Each interface keeps its real size relative to the widest one (same rule as the "Browse all" deck).
  // Sizes are read from each image's own load event (works the same in every browser, cached or not);
  // the cards appear once every interface is measured, so they never show cropped or change size.
  function sizeCardsByInterface(items) {
    if (!items.length) return;
    const list = items[0].parentElement;
    const images = items.map(item => item.querySelector('img'));
    const isLoaded = img => img.complete && img.naturalWidth > 0;
    let revealed = false;

    const apply = () => {
      const ready = images.filter(isLoaded);
      if (ready.length) {
        const widest = Math.max(...ready.map(img => img.naturalWidth));
        items.forEach((item, i) => {
          const img = images[i];
          if (!isLoaded(img)) return;
          item.style.setProperty('--w', (img.naturalWidth / widest).toFixed(3));
          item.style.setProperty('--ratio', `${img.naturalWidth} / ${img.naturalHeight}`);
        });
      }
      // Every image has either loaded or failed: show the cards
      if (!revealed && images.every(img => img.complete)) {
        revealed = true;
        list.classList.add('is-sized');
      }
    };

    images.forEach(img => {
      img.addEventListener('load', apply);
      img.addEventListener('error', apply);
    });
    apply();
    // Safety net on very slow connections: never keep the cards hidden for long
    setTimeout(() => { if (!revealed) { revealed = true; list.classList.add('is-sized'); } }, 6000);
  }

  function setActive(index) {
    if (!state) return;
    const previous = state.active;
    if (index === previous && state.ready) return;
    state.active = index;
    state.ready = true;
    const { section, track, items, backdrops, caption, plugins, highlights, lens } = state;
    const on = index >= 0;

    section.classList.toggle('has-active', on);
    track.style.setProperty('--active', on ? index : -99);
    items[previous]?.classList.remove('is-active');
    items[index]?.classList.add('is-active');
    if (lens) lens.show(index);
    else {
      backdrops[previous]?.classList.remove('is-active');
      backdrops[index]?.classList.add('is-active');
    }
    waveEnergy.target = on ? 1 : 0;

    const name = caption.querySelector('.showcase-caption-name');
    const text = caption.querySelector('.showcase-caption-text');
    if (on) {
      const plugin = plugins[index];
      const badges = badgesFor(plugin, highlights);
      name.innerHTML = `${esc(plugin.name)}${badges.length ? `<span class="showcase-caption-badges">${badgeHTML(badges)}</span>` : ''}`;
      text.textContent = clean(plugin.catalogDescription || plugin.description);
      if (!reducedMotion.matches) {
        [name, text].forEach((el, i) => el.animate(
          [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
          { duration: 380, delay: i * 40, easing: 'ease-out', fill: 'backwards' }));
      }
    } else {
      name.textContent = '';
      text.textContent = '';
    }
  }

  function bindRow() {
    const { track, items } = state;
    let leaveTimer = 0;

    items.forEach((item, index) => {
      const card = item.querySelector('.showcase-card');
      item.addEventListener('pointerenter', event => {
        if (event.pointerType === 'touch' || scrollMode.matches) return;
        clearTimeout(leaveTimer);
        setActive(index);
      });
      card.addEventListener('focus', () => {
        setActive(index);
        if (scrollMode.matches) item.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
      });
      card.addEventListener('click', () => openModal(index));
    });

    // Arrow keys move between the cards
    track.addEventListener('keydown', event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const current = items.findIndex(item => item.contains(document.activeElement));
      if (current < 0) return;
      const next = Math.max(0, Math.min(items.length - 1, current + (event.key === 'ArrowRight' ? 1 : -1)));
      if (next === current) return;
      event.preventDefault();
      items[next].querySelector('.showcase-card').focus();
    });

    // Leaving the row (or the gaps between cards) restores the neutral background after a beat
    track.addEventListener('pointerleave', event => {
      if (event.pointerType === 'touch' || scrollMode.matches) return;
      leaveTimer = setTimeout(() => {
        if (!track.contains(document.activeElement)) setActive(-1);
      }, 140);
    });
    track.addEventListener('focusout', () => setTimeout(() => {
      if (!track.contains(document.activeElement) && !track.matches(':hover') && !scrollMode.matches) setActive(-1);
    }, 0));

    // Phones: the card in the middle of the scroller is the active one
    let frame = 0;
    const pickCentred = () => {
      frame = 0;
      if (!scrollMode.matches) return;
      const box = track.getBoundingClientRect();
      const centre = box.left + box.width / 2;
      let best = -1, bestDistance = Infinity;
      items.forEach((item, i) => {
        const r = item.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - centre);
        if (d < bestDistance) { bestDistance = d; best = i; }
      });
      if (best !== state.active) setActive(best);
    };
    track.addEventListener('scroll', () => { if (!frame) frame = requestAnimationFrame(pickCentred); }, { passive: true });

    const applyMode = () => {
      if (scrollMode.matches) {
        // Start on the first card, centred
        requestAnimationFrame(() => {
          track.scrollLeft = 0;
          pickCentred();
        });
      } else {
        setActive(-1);
      }
    };
    scrollMode.addEventListener?.('change', applyMode);
    applyMode();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Backgrounds as thick, slow-moving matter (WebGL):
  //   slime  – domain-warped noise melting slowly downwards, like lava or toxic sludge
  //   wave   – a sine ripple travelling across it
  //   bulge  – inverse fisheye, edges stretched outwards
  //   grime  – a slight RGB split along the flow and a fine animated grain
  // The distortion is one field over the whole canvas, so it flows continuously
  // even when several images are drawn side by side (plugins page columns).
  // Returns null without WebGL; callers then keep their CSS backgrounds.
  // ─────────────────────────────────────────────────────────────────────────────
  const LENS_GOO = 0.035;         // slime depth, as a share of the size (0 = off)
  const LENS_WAVE = 0.001;        // sine ripple depth (0 = off)
  const LENS_BULGE = 0.2;        // inverse fisheye strength (0 = flat)
  const LENS_SPLIT = 0.35;        // RGB split, relative to the slime movement (0 = off)
  const LENS_GRAIN = 0.035;       // animated grain (0 = off)
  const LENS_OPACITY = 0.36;
  const LENS_FADE_IN = 600, LENS_FADE_OUT = 900;   // ms: the outgoing image lingers, so there is never a cut
  
  // options (all optional):
  //   opacity, brightness, saturation   look of the image being shown
  //   goo, wave, bulge, split, grain    strength of each effect
  //   zoom: { shown, hidden }           slow, centred zoom of the image being shown
  //   region(i) -> DOMRect              draw image i only inside this box (default: the whole canvas)
  // API: show(i) shows one image and fades the others; set(i, { opacity, saturation, brightness, zoom })
  //      drives each image on its own; destroy() stops everything and frees the GPU memory.
  function initLensBackdrop(container, sources, options = {}) {
    const opt = {
      opacity: LENS_OPACITY, brightness: 1, saturation: 0.85,
      goo: LENS_GOO, wave: LENS_WAVE, bulge: LENS_BULGE, split: LENS_SPLIT, grain: LENS_GRAIN,
      zoom: { shown: 1.05, hidden: 1.1 }, region: null,
      ...options,
    };
    const canvas = document.createElement('canvas');
    canvas.className = 'showcase-lens';
    let gl = null;
    try { gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false }); } catch (e) { gl = null; }
    if (!gl) return null;

    const vertex = `
      attribute vec2 a_pos;
      varying vec2 v_uv;
      void main() { v_uv = vec2(a_pos.x, -a_pos.y) * 0.5 + 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }`;
    const fragment = `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif
      varying vec2 v_uv;                     // 0..1, top-left origin, over the whole canvas
      uniform sampler2D u_tex;
      uniform vec4 u_region;                 // box of this image on the canvas: x, y, width, height (0..1)
      uniform float u_alpha, u_zoom, u_canvasAspect, u_imageAspect, u_time, u_brightness, u_saturation;
      uniform float u_goo, u_wave, u_bulge, u_split, u_grain, u_motion;

      float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.02 + 17.0; a *= 0.5; }
        return v;
      }
      // a point of the canvas -> texture coordinates of this image (cover its box, zoom around its centre)
      vec2 toTexture(vec2 point) {
        vec2 p = (point - u_region.xy) / u_region.zw - 0.5;
        float boxAspect = u_canvasAspect * u_region.z / u_region.w;
        if (boxAspect > u_imageAspect) p.y *= u_imageAspect / boxAspect;
        else p.x *= boxAspect / u_imageAspect;
        return p / u_zoom + 0.5;
      }

      void main() {
        vec2 p = v_uv - 0.5;

        // 1. Slime: noise warped by noise, flowing slowly downwards
        vec2 s = vec2(v_uv.x * u_canvasAspect, v_uv.y) * 2.2 + vec2(0.0, -u_time * 0.06);
        float t = u_time * 0.05;
        vec2 q = vec2(fbm(s + vec2(0.0, t)), fbm(s + vec2(5.2, 1.3) - t));
        vec2 r = vec2(fbm(s + 3.0 * q + vec2(1.7, 9.2) + t * 1.4), fbm(s + 3.0 * q + vec2(8.3, 2.8) - t * 1.2));
        vec2 goo = (r - 0.44) * u_goo;
        p += goo;

        // 2. Sine ripple: rows sway sideways, columns bob, both travelling slowly
        p.x += u_wave * sin(v_uv.y * 8.0 + u_time * 0.8);
        p.y += u_wave * 0.7 * sin(v_uv.x * 6.0 - u_time * 0.6);

        // 3. Inverse fisheye: the further from the centre, the more it stretches
        vec2 sq = vec2(p.x * u_canvasAspect, p.y);
        float r2 = dot(sq, sq) / (0.25 * (u_canvasAspect * u_canvasAspect + 1.0));
        p *= 1.0 - u_bulge * r2;
        vec2 point = p + 0.5;

        // 4. Grime: colour channels pulled apart along the flow, then a fine grain
        vec2 split = goo * u_split;
        vec3 c = vec3(texture2D(u_tex, toTexture(point + split)).r,
                      texture2D(u_tex, toTexture(point)).g,
                      texture2D(u_tex, toTexture(point - split)).b);
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, u_saturation) * u_brightness;
        c += (hash(v_uv * 913.0 + fract(u_time * 7.0)) - 0.5) * u_grain * u_motion;   // a still image has no grain
        gl_FragColor = vec4(clamp(c, 0.0, 1.0) * u_alpha, u_alpha);
      }`;
    const compile = (type, src) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
    };
    const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
    if (!vs || !fs) return null;
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    const u = name => gl.getUniformLocation(program, name);
    const uni = {};
    ['tex', 'region', 'alpha', 'zoom', 'canvasAspect', 'imageAspect', 'time', 'brightness', 'saturation',
      'goo', 'wave', 'bulge', 'split', 'grain', 'motion'].forEach(name => { uni[name] = u(`u_${name}`); });
    gl.uniform1i(uni.tex, 0);
    ['goo', 'wave', 'bulge', 'split', 'grain'].forEach(key => gl.uniform1f(uni[key], opt[key]));
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    container.innerHTML = '';
    container.appendChild(canvas);

    // One layer per image. Opacity, saturation and brightness tween together; zoom eases slowly.
    const look = { opacity: 0, saturation: opt.saturation, brightness: opt.brightness };
    const layers = sources.map(() => ({
      tex: null, aspect: 1, wanted: false,
      now: { ...look }, from: { ...look }, to: { ...look }, start: 0, dur: 1,
      zoom: opt.zoom.hidden, zoomTo: null,
      // Each image keeps its own clock, so one can flow while the others hold almost still
      time: 0, rate: 1, rateTo: 1,
    }));
    layers.forEach((layer, i) => { layer.time = i * 13.7; });   // different shapes in each column from the start
    let time = 0, onScreen = true, alive = true;
    let width = 0, height = 0, frame = 0, last = 0;
    const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

    const tween = (layer, target, now, duration) => {
      layer.from = { ...layer.now };
      layer.to = { ...layer.now, ...target };
      layer.start = now;
      // fades stay with reduced motion too: they are not movement
      layer.dur = duration || (layer.to.opacity > layer.now.opacity ? LENS_FADE_IN : LENS_FADE_OUT);
    };

    // Smaller textures than the source files: plenty for a background, and light on phones
    const upload = (layer, img) => {
      if (!alive) return;
      const max = window.innerWidth < 768 ? 1024 : 1600;
      const scale = Math.min(1, max / img.naturalWidth);
      let source = img;
      if (scale < 1) {
        source = document.createElement('canvas');
        source.width = Math.round(img.naturalWidth * scale);
        source.height = Math.round(img.naturalHeight * scale);
        source.getContext('2d').drawImage(img, 0, 0, source.width, source.height);
      }
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      layer.tex = tex;
      layer.aspect = img.naturalWidth / img.naturalHeight;
      // It was asked for before it arrived: fade it in now
      if (layer.to.opacity > 0) {
        const target = { ...layer.to };
        layer.now.opacity = 0;
        tween(layer, target, performance.now(), LENS_FADE_IN);
      }
      kick();
    };

    // Load all images now, upload them one per idle moment (never during a swipe)
    // (with a deadline: a page that never idles, because the matter keeps moving, still gets its images)
    const idle = fn => (window.requestIdleCallback ? window.requestIdleCallback(fn, { timeout: 400 }) : setTimeout(fn, 60));
    sources.forEach((src, i) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = src;
      (img.decode ? img.decode() : new Promise(done => { img.onload = done; }))
        .then(() => idle(() => upload(layers[i], img)))
        .catch(() => {});
    });

    const resize = () => {
      if (!alive) return;
      const box = canvas.getBoundingClientRect();
      // Rendered below screen resolution: the image is soft and moving, and phones stay cool
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * (window.innerWidth < 768 ? 0.6 : 0.75);
      width = Math.max(1, Math.round(box.width * dpr));
      height = Math.max(1, Math.round(box.height * dpr));
      canvas.width = width; canvas.height = height;
      gl.viewport(0, 0, width, height);
      draw();
    };

    function draw() {
      if (!alive) return;
      gl.disable(gl.SCISSOR_TEST);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uni.canvasAspect, width / height);
      const box = opt.region ? canvas.getBoundingClientRect() : null;
      layers.forEach((layer, i) => {
        if (!layer.tex || layer.now.opacity < 0.002) return;
        let region = [0, 0, 1, 1];
        if (box && box.width && box.height) {
          // This image only inside its own box (a column of the plugins page): clip there exactly
          const r = opt.region(i);
          if (!r || !r.width || !r.height) return;
          region = [(r.left - box.left) / box.width, (r.top - box.top) / box.height, r.width / box.width, r.height / box.height];
          const x = Math.round(region[0] * width), w = Math.round((region[0] + region[2]) * width) - x;
          const y = Math.round((1 - region[1] - region[3]) * height), h = Math.round((1 - region[1]) * height) - y;
          gl.enable(gl.SCISSOR_TEST);
          gl.scissor(x, y, Math.max(0, w), Math.max(0, h));
        } else {
          gl.disable(gl.SCISSOR_TEST);
        }
        gl.bindTexture(gl.TEXTURE_2D, layer.tex);
        gl.uniform4f(uni.region, region[0], region[1], region[2], region[3]);
        gl.uniform1f(uni.alpha, layer.now.opacity);
        gl.uniform1f(uni.saturation, layer.now.saturation);
        gl.uniform1f(uni.brightness, layer.now.brightness);
        gl.uniform1f(uni.zoom, layer.zoom);
        gl.uniform1f(uni.time, layer.time);
        gl.uniform1f(uni.motion, reducedMotion.matches ? 0 : Math.min(1, layer.rate));
        gl.uniform1f(uni.imageAspect, layer.aspect);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      });
    }

    function tick(now) {
      frame = 0;
      if (!alive) return;
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      const still = reducedMotion.matches;   // with reduced motion: the matter holds still, no zoom; fades stay
      if (!still) time += dt;
      let moving = !!opt.region;               // columns change width on hover: keep following them
      layers.forEach(layer => {
        // Speed eases towards its target: the matter speeds up and slows down, never jumps
        layer.rate += (layer.rateTo - layer.rate) * Math.min(1, dt * 2.5);
        if (!still) layer.time += dt * layer.rate;
        const p = Math.min(1, (now - layer.start) / layer.dur);
        const k = ease(p);
        Object.keys(layer.now).forEach(key => { layer.now[key] = layer.from[key] + (layer.to[key] - layer.from[key]) * k; });
        if (p < 1) moving = true;
        // Slow zoom, always around the centre of the image's box
        const zoomTo = layer.zoomTo ?? (still ? (opt.zoom.shown + opt.zoom.hidden) / 2 : (layer.wanted ? opt.zoom.shown : opt.zoom.hidden));
        layer.zoom += (zoomTo - layer.zoom) * (still ? 1 : Math.min(1, dt * 0.55));
        if (layer.now.opacity > 0.002 && (Math.abs(zoomTo - layer.zoom) > 0.0005 || !still)) moving = true;
      });
      draw();
      if (moving && onScreen && !document.hidden) frame = requestAnimationFrame(tick);
      else last = 0;
    }
    function kick() { if (!frame && alive) frame = requestAnimationFrame(tick); }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const screenObserver = new IntersectionObserver(entries => {
      onScreen = entries.some(entry => entry.isIntersecting);
      if (onScreen) kick();
    });
    screenObserver.observe(container);
    const onVisible = () => { if (!document.hidden) kick(); };
    document.addEventListener('visibilitychange', onVisible);
    resize();

    return {
      // One image at a time (showcase, news, popup)
      show(index) {
        const now = performance.now();
        layers.forEach((layer, i) => {
          const wanted = i === index;
          if (wanted === layer.wanted) return;
          layer.wanted = wanted;
          tween(layer, { opacity: wanted ? opt.opacity : 0 }, now);
        });
        kick();
      },
      // Each image on its own (plugins page columns)
      set(index, target, duration = 600) {
        const layer = layers[index];
        if (!layer) return;
        const { zoom, motion, ...looks } = target;
        if (zoom !== undefined) layer.zoomTo = zoom;
        if (motion !== undefined) layer.rateTo = motion;
        layer.wanted = (looks.opacity ?? layer.to.opacity) > 0;
        tween(layer, looks, performance.now(), duration);
        kick();
      },
      kick,
      destroy() {
        alive = false;
        if (frame) cancelAnimationFrame(frame);
        resizeObserver.disconnect();
        screenObserver.disconnect();
        document.removeEventListener('visibilitychange', onVisible);
        layers.forEach(layer => layer.tex && gl.deleteTexture(layer.tex));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        canvas.remove();
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Sine waves behind the cards
  // ─────────────────────────────────────────────────────────────────────────────
  const waveEnergy = { value: 0, target: 0 };

  // amp: share of the section height; freq: cycles across the width; speed: radians per second
  const WAVES = [
    { amp: 0.10, freq: 1.15, speed: 0.38, phase: 0.0, width: 1.1, color: [214, 220, 230], alpha: 0.16 },
    { amp: 0.15, freq: 0.80, speed: -0.27, phase: 1.7, width: 1.0, color: [214, 220, 230], alpha: 0.10 },
    { amp: 0.07, freq: 2.10, speed: 0.55, phase: 3.1, width: 0.9, color: [214, 220, 230], alpha: 0.09 },
    { amp: 0.12, freq: 1.45, speed: -0.42, phase: 4.4, width: 1.4, color: [1, 180, 254], alpha: 0.30 },
    { amp: 0.18, freq: 0.62, speed: 0.22, phase: 2.2, width: 1.2, color: [150, 231, 255], alpha: 0.16 },
    { amp: 0.05, freq: 3.00, speed: -0.70, phase: 5.3, width: 0.8, color: [214, 220, 230], alpha: 0.07 },
  ];

  function initWaves(section) {
    const canvas = document.getElementById('pluginShowcaseWaves');
    if (!canvas || canvas.dataset.ready) return;
    canvas.dataset.ready = '1';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0, height = 0, centre = 0, dpr = 1, visible = true, frame = 0, last = performance.now();
    // Plugins page on phones: the plugins are stacked rows, so the waves run top to bottom
    // behind the column of interfaces, crossing every row (as they cross every column on desktop)
    let vertical = false;
    const phases = WAVES.map(wave => wave.phase);
    const track = document.getElementById('pluginShowcaseTrack');

    const resize = () => {
      const box = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = box.width; height = box.height;
      vertical = section.classList.contains('plugin-gallery') && scrollMode.matches;
      if (vertical) {
        const card = section.querySelector('.gallery-float')?.getBoundingClientRect();
        centre = card && card.width ? card.left + card.width / 2 - box.left : width * 0.74;
      } else {
        // The waves run through the middle of the card row
        const row = track?.getBoundingClientRect();
        centre = row && row.height ? row.top + row.height / 2 - box.top : height / 2;
      }
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      draw();
    };

    // Waves are pinned at the edges and open up in the middle, like a held note on a scope
    const envelope = x => Math.pow(Math.sin(Math.PI * x), 1.6);

    function draw() {
      if (!width || !height) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const energy = waveEnergy.value;
      // "along" is the direction the waves travel, "across" the one they swing in
      const along = vertical ? height : width;
      const across = vertical ? width * 0.42 : Math.min(height, 900);
      const step = Math.max(3, along / 360);

      WAVES.forEach((wave, n) => {
        const amp = wave.amp * across * (1 + energy * 0.55);
        const k = wave.freq * Math.PI * 2;
        const t = phases[n];
        ctx.beginPath();
        for (let pos = 0; pos <= along + step; pos += step) {
          const a = Math.min(pos, along);
          const u = a / along;
          const offset = centre + amp * envelope(u) * (Math.sin(k * u + t) + 0.32 * Math.sin(k * 2.3 * u - t * 1.4 + n));
          const [x, y] = vertical ? [offset, a] : [a, offset];
          pos === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        const [r, g, b] = wave.color;
        ctx.strokeStyle = `rgba(${r},${g},${b},${Math.min(1, wave.alpha * (1 + energy * 0.7))})`;
        ctx.lineWidth = wave.width;
        ctx.stroke();
      });
    }

    function tick(now) {
      frame = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      waveEnergy.value += (waveEnergy.target - waveEnergy.value) * Math.min(1, dt * 2);
      // Speed follows the energy, but only ever changes the rate of travel, never the position
      WAVES.forEach((wave, n) => { phases[n] += dt * wave.speed * (1 + waveEnergy.value * 0.5); });
      draw();
      if (visible && !document.hidden && !reducedMotion.matches) frame = requestAnimationFrame(tick);
    }
    const start = () => {
      if (frame || reducedMotion.matches) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    if (track) observer.observe(track);
    new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      if (visible) start();
    }).observe(section);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
    resize();
    start();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Mini-view popup
  // ─────────────────────────────────────────────────────────────────────────────
  let modal = { index: -1, imageIndex: 0, closing: false, lastFocus: null };

  function downloadsHTML(plugin) {
    const name = esc(plugin.name);
    if (plugin.isEarlyAccess) {
      return `
        <div class="pm-actions-row">
          <a href="${PATREON_URL}" class="btn-patreon pm-patreon" target="_blank" rel="noopener noreferrer"
             aria-label="Join Patreon for early access to ${name}">
            <span class="btn-patreon-logo">${PATREON_ICON}</span><span>Join Patreon for early access</span>
          </a>
        </div>
        <p class="pm-note">Public release ${esc(formatReleaseDate(plugin.launchDate))}</p>`;
    }
    const url = `https://krystal-dynamics.itch.io/${encodeURIComponent(plugin.downloadSlug)}/purchase`;
    return `
      <div class="download-buttons pm-actions-row">
        <a href="${url}" class="btn-download" target="_blank" rel="noopener noreferrer" aria-label="Download ${name} for Windows">
          <span class="os-logo">${WINDOWS_ICON}</span><span>Windows <small>VST3</small></span>
        </a>
        <a href="${url}" class="btn-download" target="_blank" rel="noopener noreferrer" aria-label="Download ${name} for macOS">
          <span class="os-logo">${APPLE_ICON}</span><span>macOS <small>AU / VST3</small></span>
        </a>
      </div>
      <p class="pm-note">Free for personal and commercial use.${plugin.museHub
        ? ` Also on <a href="${esc(plugin.museHub)}" target="_blank" rel="noopener noreferrer">MuseHub</a>.` : ''}</p>`;
  }

  function modalHTML(plugin) {
    const badges = badgesFor(plugin, state.highlights);
    const latest = plugin.history?.[0];
    const meta = [
      plugin.version ? `Version ${plugin.version}` : '',
      plugin.isEarlyAccess ? 'early access'
        : latest?.date ? (plugin.latestUpdate ? `updated ${formatReleaseDate(latest.date)}` : `released ${formatReleaseDate(plugin.launchDate)}`) : '',
    ].filter(Boolean).join(', ');
    const features = plugin.features || [];
    const moreFeatures = features.length - FEATURES_IN_MODAL;
    const specs = (plugin.specifications || []).filter(spec => spec.label !== 'Formats');
    const images = plugin.images || [];

    return `
      <button class="pm-close" type="button" aria-label="Close the overview">${CLOSE_ICON}</button>
      <div class="pm-visual">
        <div class="pm-visual-bg" style="--bg:url('${esc(images[0])}')" aria-hidden="true"></div>
        <figure class="pm-stage">
          <img class="pm-image" src="${esc(images[0])}" alt="${esc(plugin.name)} interface">
        </figure>
        ${images.length > 1 ? `
        <div class="pm-thumbs" role="group" aria-label="${esc(plugin.name)} screenshots">
          ${images.map((src, i) => `
            <button type="button" class="pm-thumb${i === 0 ? ' is-current' : ''}" data-image="${i}"
                    aria-label="Screenshot ${i + 1} of ${images.length}" aria-pressed="${i === 0}">
              <img src="${esc(src)}" alt="" decoding="async">
            </button>`).join('')}
        </div>` : ''}
      </div>
      <div class="pm-info">
        <div class="pm-scroll" tabindex="-1">
          <div class="pm-title-row">
            <h2 class="pm-title" id="pluginModalTitle">${esc(plugin.name)}</h2>
            ${badges.length ? `<div class="pm-badges">${badgeHTML(badges)}</div>` : ''}
          </div>
          ${meta ? `<p class="pm-meta">${esc(meta)}</p>` : ''}
          <p class="pm-desc">${esc(clean(plugin.description))}</p>
          ${features.length ? `
          <h3 class="pm-heading">Main features</h3>
          <ul class="pm-features">
            ${features.slice(0, FEATURES_IN_MODAL).map(feature => `<li>${esc(feature)}</li>`).join('')}
          </ul>` : ''}
          <dl class="pm-specs">
            <div><dt>Formats</dt><dd>${esc((plugin.formats || []).join(', '))}</dd></div>
            ${specs.map(spec => `<div><dt>${esc(spec.label)}</dt><dd>${esc(spec.value)}</dd></div>`).join('')}
          </dl>
          <a class="pm-more" href="${esc(plugin.page)}">${moreFeatures > 0
            ? `See all ${features.length} features on the plugin page`
            : 'Open the plugin page'}</a>
        </div>
        <div class="pm-actions">${downloadsHTML(plugin)}</div>
      </div>`;
  }

  // Fetch and decode images ahead of time, so switching to them is instant
  function preload(sources) {
    return sources.map(src => {
      const img = new Image();
      img.decoding = 'async';
      img.src = src;
      return (img.decode ? img.decode() : new Promise(done => { img.onload = done; img.onerror = done; })).catch(() => {});
    });
  }

  function lockScroll(lock) {
    const root = document.documentElement;
    if (lock) {
      const gap = window.innerWidth - root.clientWidth;
      root.style.setProperty('--pm-scrollbar', `${gap}px`);
      root.classList.add('pm-locked');
    } else {
      root.classList.remove('pm-locked');
      root.style.removeProperty('--pm-scrollbar');
    }
  }

  // Animate an element from one screen rectangle to its own place (FLIP)
  function flyFrom(el, fromRect, options) {
    const to = el.getBoundingClientRect();
    if (!to.width || !fromRect.width) return null;
    const dx = fromRect.left - to.left, dy = fromRect.top - to.top;
    const sx = fromRect.width / to.width, sy = fromRect.height / to.height;
    return el.animate([
      { transformOrigin: '0 0', transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy}) rotate(${options.rot || 0}deg)` },
      { transformOrigin: '0 0', transform: 'none' },
    ], { duration: options.duration, easing: options.easing, direction: options.reverse ? 'reverse' : 'normal', fill: 'both' });
  }

  function openModal(index) {
    const dialog = document.getElementById('pluginModal');
    const panel = document.getElementById('pluginModalPanel');
    if (!dialog || !panel || !state || dialog.open) return;
    const plugin = state.plugins[index];
    const item = state.items[index];
    const sourceImage = item.querySelector('.showcase-image');

    modal = { index, imageIndex: 0, closing: false, lastFocus: document.activeElement, swap: 0, ready: preload(plugin.images || []) };
    panel.innerHTML = modalHTML(plugin);
    bindModal(dialog, panel, plugin);

    lockScroll(true);
    dialog.showModal();
    dialog.classList.add('is-open');

    // Background of the left side: the screenshot as moving matter (falls back to the blurred copy)
    const visualBg = panel.querySelector('.pm-visual-bg');
    // Always the first interface: switching screenshots never restarts the background
    modal.lens = visualBg ? initLensBackdrop(visualBg, (plugin.images || []).slice(0, 1), { opacity: 0.3, saturation: 0.9, brightness: 0.9 }) : null;
    if (modal.lens) { visualBg.classList.add('has-lens'); modal.lens.show(0); }
    panel.querySelector('.pm-close').focus({ preventScroll: true });

    if (reducedMotion.matches) return;
    const fromRect = sourceImage.getBoundingClientRect();
    const target = panel.querySelector('.pm-image');
    const run = () => {
      item.classList.add('is-lifted');   // the card has "flown" into the popup
      const flight = flyFrom(target, fromRect, { duration: 620, easing: 'cubic-bezier(0.2, 0.85, 0.2, 1)', rot: Number.parseFloat(item.style.getPropertyValue('--rot')) || 0 });
      flight?.finished.then(() => flight.cancel()).catch(() => {});
    };
    // Wait for the popup image to have its size before measuring where it lands
    if (target.complete && target.naturalWidth) run();
    else target.addEventListener('load', run, { once: true });
  }

  async function closeModal() {
    const dialog = document.getElementById('pluginModal');
    const panel = document.getElementById('pluginModalPanel');
    if (!dialog?.open || modal.closing) return;
    modal.closing = true;
    const item = state.items[modal.index];

    if (!reducedMotion.matches) {
      dialog.classList.add('is-closing');
      const target = panel.querySelector('.pm-image');
      const sourceImage = item?.querySelector('.showcase-image');
      // Fly back to the card only if it shows the same screenshot and is on screen
      if (target && sourceImage && modal.imageIndex === 0) {
        const fromRect = sourceImage.getBoundingClientRect();
        const flight = flyFrom(target, fromRect, { duration: 420, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', reverse: true, rot: Number.parseFloat(item.style.getPropertyValue('--rot')) || 0 });
        if (flight) await flight.finished.catch(() => {});
      } else {
        await new Promise(done => setTimeout(done, 280));
      }
    }

    item?.classList.remove('is-lifted');
    dialog.classList.remove('is-open', 'is-closing');
    dialog.close();
    modal.lens?.destroy();   // free the GPU memory of the popup's background
    modal.lens = null;
    panel.innerHTML = '';
    lockScroll(false);
    const back = modal.lastFocus;
    if (back && document.contains(back)) back.focus({ preventScroll: true });
    modal.closing = false;
  }

  function showImage(panel, plugin, next) {
    const images = plugin.images || [];
    if (images.length < 2) return;
    const index = (next + images.length) % images.length;
    if (index === modal.imageIndex) return;
    modal.imageIndex = index;
    const token = ++modal.swap;
    panel.querySelectorAll('.pm-thumb').forEach((thumb, i) => {
      thumb.classList.toggle('is-current', i === index);
      thumb.setAttribute('aria-pressed', String(i === index));
    });

    const stage = panel.querySelector('.pm-stage');
    const img = stage.querySelector('.pm-image');
    const src = images[index];
    (modal.ready?.[index] || Promise.resolve()).then(() => {
      if (token !== modal.swap || !img.isConnected) return;   // another screenshot was picked meanwhile
      // (the background keeps the first interface on purpose)
      if (reducedMotion.matches) { img.src = src; return; }
      // The old screenshot stays on top as a copy and fades out over the new one
      stage.querySelectorAll('.pm-image-ghost').forEach(ghost => ghost.remove());
      const ghost = img.cloneNode();
      ghost.className = 'pm-image pm-image-ghost';
      ghost.removeAttribute('alt');
      ghost.setAttribute('aria-hidden', 'true');
      Object.assign(ghost.style, {
        left: `${img.offsetLeft}px`, top: `${img.offsetTop}px`,
        width: `${img.offsetWidth}px`, height: `${img.offsetHeight}px`,
      });
      stage.appendChild(ghost);
      img.src = src;
      ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, easing: 'ease-out', fill: 'forwards' })
        .finished.then(() => ghost.remove()).catch(() => ghost.remove());
    });
  }

  function bindModal(dialog, panel, plugin) {
    // The image's proportions, so its corners can be the same share of its width at any size
    const image = panel.querySelector('.pm-image');
    const setRatio = () => { if (image.naturalWidth) image.style.setProperty('--ar', (image.naturalWidth / image.naturalHeight).toFixed(4)); };
    if (image.complete) setRatio(); else image.addEventListener('load', setRatio, { once: true });

    panel.querySelector('.pm-close').addEventListener('click', closeModal);
    panel.querySelectorAll('.pm-thumb').forEach(thumb =>
      thumb.addEventListener('click', () => showImage(panel, plugin, Number(thumb.dataset.image))));
    panel.querySelector('.pm-image').addEventListener('click', () => showImage(panel, plugin, modal.imageIndex + 1));

    if (dialog.dataset.bound) return;
    dialog.dataset.bound = '1';
    // Click outside the panel (on the dimmed page) closes it
    dialog.addEventListener('click', event => {
      if (event.target === dialog || event.target.classList.contains('pm-scrim')) closeModal();
    });
    // Esc: run the animated close instead of the instant native one
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeModal(); });
    dialog.addEventListener('keydown', event => {
      if (!dialog.open || modal.index < 0) return;
      if (event.target.closest('input, textarea')) return;
      const current = state.plugins[modal.index];
      if (event.key === 'ArrowRight') { event.preventDefault(); showImage(document.getElementById('pluginModalPanel'), current, modal.imageIndex + 1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); showImage(document.getElementById('pluginModalPanel'), current, modal.imageIndex - 1); }
    });
  }

  window.renderPluginShowcase = renderPluginShowcase;
  window.KDLens = initLensBackdrop;   // also used by the news carousel (main.js)
})();