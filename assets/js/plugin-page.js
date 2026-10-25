// Plugin detail pages: the top section in the same style as the plugin popup.
// Runs once page-content.js has rendered the page. The rest of the page is untouched.
//   - the interface floats over the moving-matter background (lens from plugin-showcase.js)
//   - a "version, date" line under the name
//   - phones: a download bar docks at the bottom once the download buttons scroll away
(function () {
  'use strict';

  const phone = window.matchMedia('(max-width: 767px)');
  const page = document.getElementById('pluginDetailPage');
  if (!page) return;

  // ── Background of the hero: the screenshots as moving matter, following the carousel ──
  function initHeroLens(hero) {
    const carousel = hero.querySelector('.plugin-detail-image-carousel');
    if (!carousel || typeof window.KDLens !== 'function') return;
    let images = [];
    try { images = JSON.parse(carousel.getAttribute('data-images') || '[]'); } catch (e) { return; }
    if (!images.length) return;

    const host = document.createElement('div');
    host.className = 'pp-lens';
    host.setAttribute('aria-hidden', 'true');
    hero.prepend(host);
    // Same strength as the hover background it replaces on desktop
    const lens = window.KDLens(host, images.slice(0, 1), { opacity: 0.45, saturation: 0.9, brightness: 0.85 });
    if (!lens) { host.remove(); return; }
    hero.classList.add('has-lens');
    lens.show(0);

    // Phones: the background fades out below the interface, so the text sits on the plain page
    const fit = () => {
      const top = hero.getBoundingClientRect().top;
      hero.style.setProperty('--pp-stage', `${Math.round(carousel.getBoundingClientRect().bottom - top + 28)}px`);
    };
    new ResizeObserver(fit).observe(carousel);
    fit();

    // The background stays on the first interface while the carousel cycles,
    // so the moving matter never restarts
  }

  // ── "Version 1.2.0, updated October 16, 2026" under the name, as in the popup ──
  async function addMeta(hero) {
    const title = hero.querySelector('.plugin-content h1');
    if (!title || hero.querySelector('.pp-meta') || typeof getSiteData !== 'function') return;
    let plugin;
    try { plugin = (await getSiteData()).plugins.find(item => item.id === page.dataset.pluginKey); } catch (e) { return; }
    if (!plugin) return;
    const latest = plugin.history?.[0];
    const when = plugin.isEarlyAccess ? 'early access'
      : plugin.latestUpdate ? `updated ${formatReleaseDate(latest.date)}`
      : `released ${formatReleaseDate(plugin.launchDate)}`;
    const meta = document.createElement('p');
    meta.className = 'pp-meta';
    meta.textContent = [plugin.version ? `Version ${plugin.version}` : '', when].filter(Boolean).join(', ');
    title.after(meta);
  }

  // ── Download bar docked at the bottom once the hero buttons are out of sight ──
  function dockDownloads(hero) {
    const block = hero.querySelector('.plugin-hero-downloads');
    const actions = block?.querySelector('.download-buttons, .plugin-early-access a');
    if (!block || !actions || document.querySelector('.pp-dock')) return;
    const name = hero.querySelector('.plugin-content h1')?.textContent || '';
    const dock = document.createElement('div');
    dock.className = 'pp-dock';
    dock.setAttribute('aria-label', `Download ${name}`);
    dock.setAttribute('role', 'region');
    const copy = actions.cloneNode(true);
    copy.classList.add('pp-dock-actions');
    copy.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
    dock.appendChild(copy);
    document.body.appendChild(dock);
    document.body.classList.add('has-pp-dock');

    const footer = document.getElementById('footer');
    let pastButtons = false, atFooter = false;
    const update = () => {
      const show = pastButtons && !atFooter;
      dock.classList.toggle('is-shown', show);
      dock.inert = !show;   // hidden bar: out of the tab order and away from screen readers
    };
    new IntersectionObserver(([entry]) => {
      pastButtons = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      update();
    }).observe(block);
    if (footer) {
      new IntersectionObserver(([entry]) => { atFooter = entry.isIntersecting; update(); }).observe(footer);
    }
    update();
  }

  function enhance() {
    const hero = page.querySelector('.plugin-hero');
    if (!hero || hero.dataset.ppReady) return false;
    hero.dataset.ppReady = '1';
    addMeta(hero);
    initHeroLens(hero);
    if (phone.matches) dockDownloads(hero);
    return true;
  }

  // page-content.js renders the page after loading the data: wait for it
  if (!enhance()) {
    const observer = new MutationObserver(() => { if (enhance()) observer.disconnect(); });
    observer.observe(page, { childList: true, subtree: true });
  }
})();