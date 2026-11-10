// Installation and manual pages of a plugin with `guide` in plugins.json
// (<main id="pluginGuide" data-plugin-key="…" data-guide="install|manual">).
// Content comes from the plugin's guide file (see plugin-story.js); the installation steps are the
// ones page-content.js uses on the standard plugin pages.
(function () {
  'use strict';

  const root = document.getElementById('pluginGuide');
  if (!root) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const S = () => window.KDStory;

  const CHEVRON = '<svg class="kg-chevron" viewBox="0 0 24 24" aria-hidden="true"><polyline points="9 6 15 12 9 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const SEARCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m16 16 4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

  // ── Content blocks (authored HTML from the guide file) ───────────────────────
  // ctx = { plugin, guide }: needed by figures (screenshots) and plots
  function figure(f, ctx) {
    const color = S().shotColor(ctx.guide, f.image);
    const crop = f.crop !== false && !!f.focus;
    const visual = S().frame(ctx.plugin, ctx.guide, {
      images: [f.image], active: f.image, focus: f.focus, crop, ring: false, color,
      label: f.label || (f.caption ? f.caption.replace(/<[^>]+>/g, '') : `${ctx.plugin.name} interface`), pins: f.pins || null,
    });
    return `
      <figure class="kg-figure${crop ? ' is-crop' : ''}" style="--ks-color:${color}">
        ${visual}
        ${S().pinLegend(f.pins)}
        ${f.caption ? `<figcaption>${f.caption}</figcaption>` : ''}
      </figure>`;
  }

  function plot(p) {
    const P = window.KDPlots;
    if (!P) return '';
    // Several waveforms side by side, each with its own label
    if (p.kind === 'waves') {
      const panels = p.panels.map(panel => `<div class="kg-wave"><span class="kg-wave-label">${panel.label}</span>${P.waveSVG(panel.series, { drive: p.drive || 1.78, width: 300, height: 200, cycles: 1 })}</div>`).join('');
      return `<figure class="kg-plot kg-plot--waves"><div class="kg-waves kg-waves--${p.panels.length}">${panels}</div>${p.caption ? `<figcaption>${p.caption}</figcaption>` : ''}</figure>`;
    }
    const svg = p.kind === 'wave' ? P.waveSVG(p.series, { drive: p.drive || 1.78 }) : P.transferSVG(p.series, { range: p.range || 2, view: p.view || 'full' });
    const legend = p.kind === 'wave' && p.series.length > 1
      ? `<div class="kp-legend">${p.series.map(s => `<span style="--kp-color:${s.color}">${s.label || s.mode}</span>`).join('')}</div>` : '';
    return `<figure class="kg-plot kg-plot--${p.kind === 'wave' ? 'wave' : 'transfer'}">${svg}${legend}${p.caption ? `<figcaption>${p.caption}</figcaption>` : ''}</figure>`;
  }

  function block(item, ctx) {
    if (typeof item === 'string') return `<p>${item}</p>`;
    if (item.specs) {
      return `<dl class="kg-specs">${item.specs.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
    }
    if (item.table) {
      const { head, rows } = item.table;
      return `
        <div class="kg-table-wrap"><table class="kg-table">
          <thead><tr>${head.map(cell => `<th scope="col">${cell}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(row => `<tr>${row.map((cell, i) => i === 0 ? `<th scope="row">${cell}</th>` : `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>`;
    }
    if (item.steps) return `<ol class="ks-steps">${item.steps.map(step => `<li>${step}</li>`).join('')}</ol>`;
    if (item.list) return `<ul class="kg-list">${item.list.map(entry => `<li>${entry}</li>`).join('')}</ul>`;
    if (item.note) return `<p class="kg-note">${item.note}</p>`;
    if (item.figure) return figure(item.figure, ctx);
    if (item.figures) return `<div class="kg-figures kg-figures--${Math.min(item.figures.length, 4)}">${item.figures.map(f => figure(f, ctx)).join('')}</div>`;
    if (item.plot) return plot(item.plot);
    // Text with small, narrow screenshots beside it (tall controls such as the meters)
    if (item.aside) {
      return `<div class="kg-aside"><div class="kg-aside-text">${blocks(item.aside.body, ctx)}</div><div class="kg-aside-media">${item.aside.figures.map(f => figure(f, ctx)).join('')}</div></div>`;
    }
    return '';
  }

  const blocks = (list, ctx) => (list || []).map(item => block(item, ctx)).join('');

  function hero(title, intro, extra = '') {
    return `
      <section class="kg-hero">
        <div class="container">
          <h1 class="kg-title" data-ks-split>${S().splitWords(title)}</h1>
          ${intro ? `<p class="kg-intro" data-ks-reveal style="--d:120ms">${S().esc(intro)}</p>` : ''}
          ${extra}
        </div>
      </section>`;
  }

  function versionLine(plugin) {
    const latest = plugin.history?.[0];
    const date = latest?.date && typeof formatReleaseDate === 'function' ? `, updated ${formatReleaseDate(latest.date)}` : '';
    return plugin.version ? `Version ${S().esc(plugin.version)}${S().esc(date)}` : '';
  }

  function releasedLine(plugin) {
    const latest = plugin.history?.[0];
    return latest?.date && typeof formatReleaseDate === 'function' ? `Updated ${formatReleaseDate(latest.date)}` : '';
  }

  // ── Collapsible panels with a height animation (native <details> underneath) ──
  function animateDetails(details) {
    const summary = details.querySelector(':scope > summary');
    const body = details.querySelector(':scope > .kg-collapse');
    if (!summary || !body) return;
    let running = null;
    summary.addEventListener('click', event => {
      if (reduceMotion.matches || !body.animate) return;   // native toggle
      event.preventDefault();
      if (running) running.cancel();
      const opening = !details.open;
      if (opening) details.open = true;
      const full = body.scrollHeight;
      running = body.animate(
        { height: opening ? ['0px', `${full}px`] : [`${full}px`, '0px'], opacity: opening ? [0, 1] : [1, 0] },
        { duration: Math.min(520, 240 + full * 0.25), easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
      running.onfinish = () => {
        running = null;
        if (!opening) details.open = false;
        details.dispatchEvent(new Event('kg-toggled'));
      };
      if (opening) details.dispatchEvent(new Event('kg-toggled'));
    });
  }

  // ── Install ─────────────────────────────────────────────────────────────────
  function detectSystem() {
    const platform = (navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || '').toLowerCase();
    if (/iphone|ipad|android/.test(platform)) return null;   // the plugins don't run there
    if (/mac/.test(platform)) return 'macos';
    if (/win/.test(platform)) return 'windows';
    return null;
  }

  function renderInstall(plugin, guide) {
    const pc = window.KDPageContent;
    const action = pc.downloadAction(plugin);
    const platforms = pc.installationGuide(plugin);
    const mine = detectSystem();
    const openId = platforms.some(p => p.id === mine) ? mine : null;
    const esc = S().esc;
    const specs = [{ label: 'Version', value: plugin.version }, ...(plugin.specifications || [])];

    return S().nav(plugin, 'install', action) + `
      <div class="kg-page">
        <section class="kg-hero kg-install">
          <div class="container kg-install-grid">
            <div class="kg-install-main">
              <h1 class="kg-title" data-ks-split>${S().splitWords(guide.install?.title || 'Install')}</h1>
              ${guide.install?.intro ? `<p class="kg-intro" data-ks-reveal style="--d:120ms">${esc(guide.install.intro)}</p>` : ''}
              <dl class="kg-requirements" data-ks-reveal style="--d:200ms">
                ${specs.filter(item => item.label !== 'Latency' && item.label !== 'Version').map(item => `<div><dt>${esc(item.label)}</dt><dd>${esc(item.value)}</dd></div>`).join('')}
              </dl>
              <div class="kg-download" data-ks-reveal style="--d:260ms">
                <div class="kg-download-copy">
                  <strong>${esc(plugin.name)} ${esc(plugin.version || '')}</strong>
                  ${releasedLine(plugin) ? `<span class="kg-meta">${esc(releasedLine(plugin))}</span>` : ''}
                </div>
                <a href="${esc(action.href)}" class="btn btn-primary" target="_blank" rel="noopener noreferrer">${esc(action.label)}</a>
              </div>
            </div>
            <div class="kg-platforms">
              ${platforms.map((platform, i) => `
                <details class="kg-platform" id="${platform.id}"${platform.id === openId ? ' open' : ''} data-ks-reveal style="--d:${120 + i * 90}ms">
                  <summary>
                    <span class="kg-platform-icon">${platform.icon}</span>
                    <span class="kg-platform-name">${esc(platform.name)}</span>
                    <span class="kg-platform-format">${esc(platform.format)}</span>
                    ${platform.id === mine ? '<span class="kg-badge">Your system</span>' : ''}
                    ${CHEVRON}
                  </summary>
                  <div class="kg-collapse">
                    <div class="kg-platform-body">
                      <div>
                        <h3>Installer <span>recommended</span></h3>
                        <ol class="ks-steps">${platform.recommended.map(step => `<li>${step}</li>`).join('')}</ol>
                      </div>
                      <div>
                        <h3>Manual installation</h3>
                        <ol class="ks-steps">${platform.manual.map(step => `<li>${step}</li>`).join('')}</ol>
                      </div>
                      <p class="kg-note">${platform.note}</p>
                    </div>
                  </div>
                </details>`).join('')}
            </div>
          </div>
        </section>
        <section class="kg-section kg-section--alt">
          <div class="container kg-after">
            <div data-ks-reveal>
              <h2>Uninstalling</h2>
              <p>To uninstall, delete the plugin files from the folders listed under manual installation. Your preferences are stored in <code>Documents/Krystal Dynamics/${esc(plugin.name)}</code>: delete that folder too to remove them.</p>
            </div>
            <div data-ks-reveal style="--d:100ms">
              <h2>License</h2>
              <p>${esc(plugin.license)}</p>
            </div>
            <div data-ks-reveal style="--d:200ms">
              <h2>Next</h2>
              <p>Every control in detail, with tips, ranges and defaults.</p>
              ${S().textLink(plugin.guide.manual, 'Open the manual')}
            </div>
          </div>
        </section>
      </div>`;
  }

  // ── Version history ─────────────────────────────────────────────────────────
  function renderHistory(plugin, guide) {
    const esc = S().esc;
    const date = d => (d && typeof formatReleaseDate === 'function' ? formatReleaseDate(d) : d || '');
    const releases = plugin.history || [];
    return S().nav(plugin, 'history', window.KDPageContent.downloadAction(plugin)) + `
      <div class="kg-page">
        ${hero(guide.history?.title || 'Version History', guide.history?.intro, `
          <p class="kg-meta kg-hero-meta" data-ks-reveal style="--d:200ms">${releases.length === 1 ? `First released ${esc(date(releases[0]?.date))}` : `${releases.length} releases since ${esc(date(releases.at(-1)?.date))}`}</p>`)}
        <section class="kg-section">
          <div class="container">
            <ol class="kg-releases">
              ${releases.map((release, i) => `
                <li class="kg-release${i === 0 ? ' is-current' : ''}" id="v${esc(release.version)}" data-ks-reveal>
                  <div class="kg-release-meta">
                    <h2 class="kg-release-title">
                      <span class="kg-release-version">${esc(release.version)}</span>
                      ${i === 0 ? '<span class="kg-badge">Current</span>' : ''}
                    </h2>
                    ${release.date ? `<time datetime="${esc(release.date)}">${esc(date(release.date))}</time>` : ''}
                  </div>
                  <div class="kg-release-notes">
                    ${release.groups.map(group => `
                      <h3>${esc(group.title)}</h3>
                      ${group.items.length ? `<ul class="kg-list">${group.items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}`).join('')}
                  </div>
                </li>`).join('')}
            </ol>
          </div>
        </section>
      </div>`;
  }

  // ── Manual ──────────────────────────────────────────────────────────────────
  function renderManual(plugin, guide) {
    const esc = S().esc;
    const manual = guide.manual;
    const chapters = manual.chapters || [];
    const ctx = { plugin, guide };
    const frameFor = chapter => {
      if (chapter.image === undefined) return '';
      const color = S().shotColor(guide, chapter.image);
      const visual = S().frame(plugin, guide, {
        images: [chapter.image], active: chapter.image, focus: chapter.focus, crop: !!chapter.crop, color,
        label: `${plugin.name}: ${chapter.title}`,
      });
      return `<div class="kg-chapter-visual${chapter.crop ? ' is-crop' : ''}" data-ks-reveal style="--ks-color:${color}">${visual}</div>`;
    };

    return S().nav(plugin, 'manual', window.KDPageContent.downloadAction(plugin)) + `
      <div class="kg-page">
        ${hero(manual.title || 'Manual', manual.intro, `
          <div class="kg-search" data-ks-reveal style="--d:200ms">
            <label class="kg-search-field">
              ${SEARCH}
              <span class="visually-hidden">Search the manual</span>
              <input type="search" id="kgSearch" placeholder="Search the manual" autocomplete="off" spellcheck="false">
            </label>
            <span class="kg-meta">${versionLine(plugin)}</span>
          </div>
          <p class="kg-search-status" id="kgSearchStatus" role="status" aria-live="polite"></p>`)}
        <div class="container kg-manual">
          <aside class="kg-toc" aria-label="Contents">
            <p class="kg-toc-title">Contents</p>
            <ol>
              ${chapters.map((chapter, i) => `
                <li data-chapter="${esc(chapter.id)}"><a href="#${esc(chapter.id)}"><span>${i + 1}</span>${esc(chapter.title)}</a></li>`).join('')}
            </ol>
          </aside>
          <div class="kg-chapters">
            ${chapters.map((chapter, c) => `
              <section class="kg-chapter" id="${esc(chapter.id)}" aria-labelledby="${esc(chapter.id)}-title">
                <div class="kg-chapter-head" data-ks-reveal>
                  <h2 id="${esc(chapter.id)}-title"><span class="kg-num">${c + 1}</span>${esc(chapter.title)}</h2>
                  ${chapter.topics?.length ? '<button type="button" class="kg-open-all" aria-pressed="false">Open all</button>' : ''}
                </div>
                <div class="kg-chapter-intro" data-ks-reveal style="--d:80ms">${blocks(chapter.intro, ctx)}</div>
                ${frameFor(chapter)}
                ${chapter.topics?.length ? `
                  <div class="kg-topics">
                    ${chapter.topics.map((topic, t) => `
                      <details class="kg-topic" id="${esc(topic.id)}">
                        <summary>
                          ${CHEVRON}
                          <span class="kg-num">${c + 1}.${t + 1}</span>
                          <h3>${esc(topic.title)}</h3>
                        </summary>
                        <div class="kg-collapse">
                          <div class="kg-topic-body">
                            ${blocks(topic.body, ctx)}
                            ${(topic.more || []).map((more, m) => `
                              <details class="kg-more">
                                <summary>${CHEVRON}<span class="kg-num">${c + 1}.${t + 1}.${m + 1}</span><h4>${esc(more.title)}</h4></summary>
                                <div class="kg-collapse"><div class="kg-more-body">${blocks(more.body, ctx)}</div></div>
                              </details>`).join('')}
                          </div>
                        </div>
                      </details>`).join('')}
                  </div>` : ''}
                ${chapter.after ? `<div class="kg-chapter-after">${blocks(chapter.after, ctx)}</div>` : ''}
              </section>`).join('')}
            <p class="kg-empty" id="kgEmpty" hidden>No topic matches your search.</p>
          </div>
        </div>
      </div>`;
  }

  function initManual() {
    const topics = [...root.querySelectorAll('.kg-topic')];
    const chapters = [...root.querySelectorAll('.kg-chapter')];
    const tocItems = [...root.querySelectorAll('.kg-toc li')];
    root.querySelectorAll('.kg-topic, .kg-more').forEach(animateDetails);

    // Open topic in the address bar, so a link points to it
    topics.forEach(topic => topic.addEventListener('kg-toggled', () => {
      if (topic.open && history.replaceState) history.replaceState(null, '', `#${topic.id}`);
    }));

    // "Open all" per chapter
    root.querySelectorAll('.kg-open-all').forEach(button => {
      const chapter = button.closest('.kg-chapter');
      const update = () => {
        const all = [...chapter.querySelectorAll('.kg-topic')].every(t => t.open);
        button.textContent = all ? 'Close all' : 'Open all';
        button.setAttribute('aria-pressed', all);
      };
      button.addEventListener('click', () => {
        const items = [...chapter.querySelectorAll('.kg-topic')];
        const open = !items.every(t => t.open);
        items.forEach(t => { t.open = open; });
        update();
      });
      chapter.querySelectorAll('.kg-topic').forEach(t => t.addEventListener('toggle', update));
    });

    // Contents: the chapter being read is highlighted
    const mark = id => tocItems.forEach(item => item.classList.toggle('is-active', item.dataset.chapter === id));
    const visible = new Map();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => visible.set(entry.target.id, entry.isIntersecting));
      const first = chapters.find(ch => visible.get(ch.id) && !ch.hidden);
      if (first) mark(first.id);
    }, { rootMargin: '-30% 0px -60% 0px' });
    chapters.forEach(ch => observer.observe(ch));

    // Search: topics whose title or text contain every word stay visible and open
    const input = root.querySelector('#kgSearch');
    const status = root.querySelector('#kgSearchStatus');
    const empty = root.querySelector('#kgEmpty');
    const index = topics.map(topic => ({ topic, text: topic.textContent.toLowerCase().replace(/\s+/g, ' ') }));
    const chapterText = new Map(chapters.map(ch => [ch, ch.querySelector('.kg-chapter-after')?.textContent.toLowerCase() || '']));
    let wasOpen = null;
    const search = () => {
      const words = input.value.toLowerCase().trim().split(/\s+/).filter(w => w.length > 1);
      if (!words.length) {
        index.forEach(({ topic }) => { topic.hidden = false; });
        chapters.forEach(ch => { ch.hidden = false; });
        if (wasOpen) { topics.forEach(t => { t.open = wasOpen.has(t); }); wasOpen = null; }
        tocItems.forEach(item => item.classList.remove('is-dim'));
        status.textContent = '';
        empty.hidden = true;
        return;
      }
      if (!wasOpen) wasOpen = new Set(topics.filter(t => t.open));
      let count = 0;
      index.forEach(({ topic, text }) => {
        const hit = words.every(w => text.includes(w));
        topic.hidden = !hit;
        topic.open = hit;
        if (hit) count++;
      });
      chapters.forEach((ch, i) => {
        const ownHit = words.every(w => chapterText.get(ch).includes(w));
        const anyTopic = [...ch.querySelectorAll('.kg-topic')].some(t => !t.hidden);
        ch.hidden = !(anyTopic || ownHit);
        if (ownHit && !anyTopic) count++;
        tocItems[i].classList.toggle('is-dim', ch.hidden);
      });
      status.textContent = count ? `${count} ${count === 1 ? 'topic matches' : 'topics match'} “${input.value.trim()}”` : '';
      empty.hidden = count > 0;
    };
    let timer;
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(search, 120); });
    input.addEventListener('keydown', event => { if (event.key === 'Escape') { input.value = ''; search(); } });

    // A link to a topic opens it
    window.addEventListener('hashchange', () => openHash(false));
    openHash(true);
  }

  // Scroll to the element named in the address (and open it if it is a topic). On page load the jump
  // is repeated while the header, fonts and images settle, unless the visitor scrolls first.
  function openHash(onLoad) {
    const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (!target) return;
    target.closest('details')?.setAttribute('open', '');
    target.closest('.kg-topic')?.setAttribute('open', '');
    const jump = () => {
      const offset = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - offset, behavior: 'instant' });
    };
    requestAnimationFrame(jump);
    if (!onLoad) return;
    let userScrolled = false;
    const stop = () => { userScrolled = true; };
    ['wheel', 'touchmove', 'keydown', 'mousedown'].forEach(type => window.addEventListener(type, stop, { once: true, passive: true }));
    [250, 700].forEach(ms => setTimeout(() => { if (!userScrolled) jump(); }, ms));
    window.addEventListener('load', () => { if (!userScrolled) jump(); }, { once: true });
  }

  function initInstall() {
    root.querySelectorAll('.kg-platform').forEach(animateDetails);
    openHash(true);   // e.g. install.html#macos
  }

  async function boot() {
    try {
      const data = await getSiteData();
      const plugin = data.plugins.find(item => item.id === root.dataset.pluginKey);
      if (!plugin || !plugin.guide) throw new Error('Plugin guide not found');
      const guide = await S().load(plugin);
      const kind = root.dataset.guide;
      root.innerHTML = kind === 'manual' ? renderManual(plugin, guide)
        : kind === 'history' ? renderHistory(plugin, guide)
        : renderInstall(plugin, guide);
      S().initOffsets(root);
      if (kind === 'manual') initManual();
      else if (kind === 'install') initInstall();
      else openHash(true);
      S().initReveal(root);
    } catch (error) {
      console.error('Unable to render the plugin guide:', error);
      root.innerHTML = '<section class="kg-hero"><div class="container"><p>This page could not be loaded. Please try again later.</p><a href="/plugins.html">Browse all plugins</a></div></section>';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
