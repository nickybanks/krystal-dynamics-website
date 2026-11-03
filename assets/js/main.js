// ─── Shared content data ─────────────────────────────────────────────────────
let PLUGINS = [];
let siteDataPromise;

async function getSiteData() {
  if (!siteDataPromise) {
    siteDataPromise = fetch('/assets/data/plugins.json', { cache: 'no-cache' })
      .then(response => {
        if (!response.ok) throw new Error(`Content data request failed: ${response.status}`);
        return response.json();
      })
      .then(data => ({ ...data, plugins: data.plugins.map(withReleaseInfo) }))
      .catch(error => {
        siteDataPromise = null;
        throw error;
      });
  }
  return siteDataPromise;
}

// ─── Patreon URL (mirrors the link in the About section) ─────────────────────
const PATREON_URL = 'https://www.patreon.com/cw/Krystal_Dynamics?vanity=Krystal_Dynamics';

// ─── Version data (derived from history, same rule as tools/build_versions.py) ─
function withReleaseInfo(plugin) {
  const history = plugin.history || [];
  const latest = history[0];
  const dates = [latest?.date, plugin.publicRelease].filter(Boolean).sort();
  // Launch = public release date (or the first version's date); anything after the first version is an update
  const launchDate = plugin.publicRelease || history.at(-1)?.date || '1970-01-01';
  return {
    ...plugin,
    version: latest?.version || null,
    releaseDate: dates.pop() || '1970-01-01',
    launchDate,
    // Only updates after the public release count (early access fixes are not news for the public)
    latestUpdate: history.length > 1 && latest.date > launchDate ? latest : null,
    isEarlyAccess: launchDate > new Date().toISOString().slice(0, 10),
  };
}

// Release notes of one history entry as a flat list
function releaseNotes(release) {
  return (release?.groups || []).flatMap(group => group.items || []);
}

// Which plugin is coming soon, which was launched last and which was updated last
function getReleaseHighlights(plugins) {
  const newest = (list, key) => list.reduce((best, p) => (!best || key(p) > key(best) ? p : best), null);
  const launched = plugins.filter(plugin => !plugin.isEarlyAccess);
  return {
    upcoming: newest(plugins.filter(plugin => plugin.isEarlyAccess), plugin => -Date.parse(plugin.launchDate)),
    latestRelease: newest(launched, plugin => plugin.launchDate),
    latestUpdate: newest(launched.filter(plugin => plugin.latestUpdate), plugin => plugin.latestUpdate.date),
  };
}

// Every history entry of every plugin, newest first
const RELEASE_TYPES = {
  'early-access': 'Early access',
  release: 'New plugin',
  update: 'Update',
};

function getRecentActivity(plugins, limit) {
  const today = new Date().toISOString().slice(0, 10);
  return plugins
    .flatMap(plugin => {
      const history = plugin.history;
      const first = history.at(-1);
      const hadEarlyAccess = Boolean(plugin.publicRelease) && plugin.publicRelease > first.date;
      const events = history.map((release, index) => ({
        plugin,
        release,
        date: release.date,
        type: index < history.length - 1 ? 'update' : hadEarlyAccess ? 'early-access' : 'release',
      }));
      if (!hadEarlyAccess || plugin.publicRelease > today) return events;   // still in early access: show its history
      // Already public: the early access period is hidden, the public release replaces it
      const release = history.find(entry => entry.date <= plugin.publicRelease) || first;
      return [
        ...events.filter(event => event.date > plugin.publicRelease),
        { plugin, release, date: plugin.publicRelease, type: 'release' },
      ];
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

// ─── Sort newest first ────────────────────────────────────────────────────────
function sortByDate(plugins) {
  return [...plugins].sort((a, b) => {
    const dateA = new Date(a.releaseDate);
    const dateB = new Date(b.releaseDate);
    return dateB - dateA; // Newest first
  });
}

// ─── Format a date string for display ────────────────────────────────────────
function formatReleaseDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

// ─── Load homepage plugins ────────────────────────────────────────────────────
async function loadHomepagePlugins() {
  const container = document.getElementById('pluginShowcase');
  if (!container) return;

  try {
    const data = await getSiteData();
    PLUGINS = data.plugins;
  } catch (error) {
    console.error('Unable to load plugin data:', error);
    return;
  }

  const sorted = sortByDate(PLUGINS);

  console.log('Loaded plugins:', sorted.map(p => ({ name: p.name, date: p.releaseDate, version: p.version })));

  renderHomeNews(sorted);
  if (typeof renderPluginShowcase === 'function') renderPluginShowcase(sorted);   // assets/js/plugin-showcase.js
}

// ─── Load header / footer ─────────────────────────────────────────────────────
async function loadComponent(id, url) {
  try {
    const res = await fetch(url);
    const html = await res.text();
    document.getElementById(id).innerHTML = html;
  } catch (e) {
    console.error('Error loading component:', e);
  }
}

async function loadComponents() {
  await loadComponent('header', '/assets/includes/header.html');
  await loadComponent('footer', '/assets/includes/footer.html?v=20261007-svgfix');
  initMobileNav();
  initHeaderScroll();
  initNavHighlight();
}

function initMobileNav() {
  const toggle = document.querySelector('.mobile-menu-toggle');
  const nav = document.getElementById('mainNavigation');
  if (!toggle || !nav) return;

  const setOpen = open => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  };

  toggle.addEventListener('click', () => {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  nav.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => setOpen(false));
  });

  document.addEventListener('click', event => {
    if (!nav.contains(event.target) && !toggle.contains(event.target)) setOpen(false);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setOpen(false);
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) setOpen(false);
  });
}

// ─── Header scroll shrink ─────────────────────────────────────────────────────
function initHeaderScroll() {
  const header = document.querySelector('header');
  if (!header) return;

  const update = () => header.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', update, { passive: true });
  update();
}

// ─── Active nav link ──────────────────────────────────────────────────────────
function initNavHighlight() {
  const page = document.body.dataset.page;
  if (!page) return;

  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('href') === `/${page}.html`) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    }
  });
}

// ─── Home news carousel ───────────────────────────────────────────────────────
function escapeNewsMarkup(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function renderNewsAction(action, primary = false) {
  const href = escapeNewsMarkup(action.href);
  const external = /^https?:\/\//i.test(action.href);
  return `<a class="${primary ? 'btn btn-primary' : 'news-secondary-link'}" href="${href}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeNewsMarkup(action.label)}</a>`;
}

const NEWS_INTERVAL_MS = 6500;
const NEWS_CARD_MS = 3200;   // time each interface stays in the news card before the next one fades in
const NEWS_MOVE_MS = 700;   // duration of the slide-to-slide movement (also used by pages.css via --news-move)

function renderNewsNotes(notes, page, max = 4) {
  if (!notes.length) return '';
  const extra = notes.length - max;
  return `
    <ul class="news-notes">
      ${notes.slice(0, max).map(note => `<li>${escapeNewsMarkup(note)}</li>`).join('')}
    </ul>
    ${extra > 0 ? `<a class="news-notes-more" href="${escapeNewsMarkup(page)}#version-history">${extra} more ${extra === 1 ? 'change' : 'changes'} in the changelog</a>` : ''}`;
}

function renderNewsTimeline(entries) {
  return `
    <ol class="news-timeline">
      ${entries.map(({ plugin, release, type, date }) => {
        const note = type === 'update' ? releaseNotes(release)[0] : plugin.catalogDescription;
        return `
        <li class="news-timeline-item news-timeline-item--${type}">
          <a class="news-update-link" href="${escapeNewsMarkup(plugin.page)}#version-history">
            <time class="news-update-date" datetime="${escapeNewsMarkup(date)}">${escapeNewsMarkup(formatReleaseDate(date))}</time>
            <span class="news-update-title">${escapeNewsMarkup(plugin.name)} <small>v${escapeNewsMarkup(release.version)}</small></span>
            <span class="news-update-type">${RELEASE_TYPES[type]}</span>
            ${note ? `<span class="news-update-note">${escapeNewsMarkup(note)}</span>` : ''}
          </a>
        </li>`;
      }).join('')}
    </ol>`;
}

// Update "grande": cambia la prima o la seconda cifra rispetto alla versione precedente
function isMajorUpdate(history) {
  if (history.length < 2) return false;
  const [a, b] = [history[0].version.split('.'), history[1].version.split('.')];
  return a[0] !== b[0] || a[1] !== b[1];
}

// Card del plugin in evidenza (slide early access / release / update): tutte le interfacce, in dissolvenza
function renderNewsCard(plugin) {
  if (!plugin.images?.length) return '';
  return `
    <a class="news-hero-card" href="${escapeNewsMarkup(plugin.page)}" aria-label="${escapeNewsMarkup(plugin.name)}: view details">
      ${plugin.images.map((src, index) => `<img src="${escapeNewsMarkup(src)}" alt=""${index === 0 ? ' class="active"' : ' loading="lazy"'} decoding="async">`).join('')}
    </a>`;
}

function buildHomeNews(plugins) {
  const { upcoming, latestRelease, latestUpdate } = getReleaseHighlights(plugins);
  const activity = getRecentActivity(plugins, 5);
  const news = [];

  if (upcoming) {
    news.push({
      variant: 'early-access',
      plugin: upcoming,
      tab: 'Early access',
      tabName: upcoming.name,
      kicker: 'Early access on Patreon',
      title: upcoming.name,
      version: `Public release ${formatReleaseDate(upcoming.launchDate)}`,
      body: upcoming.catalogDescription || upcoming.description,
      highlight: 'Patreon members can use it now, before the public release.',
      image: upcoming.images?.[0],
      primary: { label: 'Get early access', href: PATREON_URL },
      secondary: { label: 'Plugin details', href: upcoming.page },
    });
  }

  const latest = [];   // release e update, ordinati per data

  if (latestRelease) {
    latest.push({
      date: latestRelease.launchDate,
      variant: 'release',
      plugin: latestRelease,
      tab: 'New plugin',
      tabName: latestRelease.name,
      kicker: 'Latest release',
      title: latestRelease.name,
      version: `Released ${formatReleaseDate(latestRelease.launchDate)}`,
      body: latestRelease.catalogDescription || latestRelease.description,
      image: latestRelease.images?.[0],
      primary: { label: 'View details', href: latestRelease.page },
      secondary: { label: 'Visit MuseHub', href: latestRelease.museHub },
    });
  }

  if (latestUpdate) {
    const release = latestUpdate.latestUpdate;
    const major = isMajorUpdate(latestUpdate.history);
    latest.push({
      date: release.date,
      variant: 'update',
      plugin: latestUpdate,
      major,
      tab: 'Update',
      tabName: `${latestUpdate.name} ${release.version}`,
      kicker: major ? 'Major update' : 'Latest update',
      title: latestUpdate.name,
      bigVersion: major ? `v${release.version}` : '',
      version: major
        ? `Updated ${formatReleaseDate(release.date)}`
        : `Version ${release.version}, ${formatReleaseDate(release.date)}`,
      notes: renderNewsNotes(releaseNotes(release), latestUpdate.page),
      image: latestUpdate.images?.[0],
      primary: { label: 'View details', href: latestUpdate.page },
      secondary: { label: 'Visit MuseHub', href: latestUpdate.museHub },
    });
  }

  news.push(...latest.sort((a, b) => b.date.localeCompare(a.date)));

  if (activity.length) {
    news.push({
      variant: 'activity',
      tab: 'Activity',
      tabName: 'Recent releases',
      title: 'Recent releases',
      body: 'New plugins and updates across the suite, newest first.',
      timeline: activity,
      image: activity[0].plugin.images?.[1] || activity[0].plugin.images?.[0],
    });
  }

  return news;
}

// Sulla slide Activity: un piccolo mazzo di interfacce di plugin che rimanda al catalogo
function renderPluginDeck(host, plugins) {
  // Random plugins and a random screenshot of each, new on every page load
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const pool = plugins.filter(plugin => plugin.images?.length);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const cards = pool.slice(0, 4).map(plugin => pick(plugin.images));
  if (cards.length < 2) return;
  const deck = document.createElement('a');
  deck.className = 'news-deck';
  deck.href = '/plugins.html';
  deck.style.setProperty('--cards', cards.length);
  deck.innerHTML = `
    <span class="news-deck-cards" aria-hidden="true">
      ${cards.map((image, index) => `
        <img class="news-deck-card" style="--i: ${index}" src="${escapeNewsMarkup(image)}" alt="">`).join('')}
    </span>
    <span class="news-deck-label">Browse all the plugins</span>`;
  host.appendChild(deck);

  // Each interface keeps its own proportions and its size relative to the largest one
  const images = [...deck.querySelectorAll('.news-deck-card')];
  Promise.all(images.map(img => img.decode().catch(() => {}))).then(() => {
    const widest = Math.max(...images.map(img => img.naturalWidth || 0));
    if (widest) images.forEach(img => img.style.setProperty('--w', (img.naturalWidth || widest) / widest));
    // Proportions of each interface, so the corners can be the same share of its width at any size
    images.forEach(img => { if (img.naturalWidth) img.style.setProperty('--ar', (img.naturalWidth / img.naturalHeight).toFixed(4)); });
  });
}

// Sfondo della slide Activity: colonne verticali (stile pagina Plugins), una per plugin aggiornato,
// ognuna con il ritaglio della sua interfaccia. All'hover di una voce si aprono a tutto schermo.
const COLUMN_LOOKS = {
  rest: { opacity: 0.55, saturation: 0.5, brightness: 0.8, zoom: 1.04, motion: 0.15 },
  off:  { opacity: 0 },
};

function initActivityColumns(slide, entries) {
  if (typeof window.KDLens !== 'function') return null;
  const seen = new Set();
  const plugins = entries.map(entry => entry.plugin)
    .filter(plugin => plugin.images?.length && !seen.has(plugin.id) && seen.add(plugin.id));
  if (!plugins.length) return null;

  const wrap = document.createElement('div');
  wrap.className = 'news-columns';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.style.display = 'none';   // il ciclo di rendering parte solo quando la slide è visibile
  wrap.innerHTML = `
    <div class="news-columns-lens"></div>
    <div class="news-columns-grid">${plugins.map(() => '<span class="news-column"></span>').join('')}</div>`;
  slide.prepend(wrap);

  const columns = [...wrap.querySelectorAll('.news-column')];
  const lens = window.KDLens(wrap.querySelector('.news-columns-lens'), plugins.map(plugin => plugin.images[0]), {
    region: index => columns[index]?.getBoundingClientRect(),
  });
  if (!lens) { wrap.remove(); return null; }

  let on = false;        // la slide Activity è quella visibile
  let covered = false;   // un'interfaccia a tutto schermo copre le colonne (hover su una voce)
  let hideTimer = 0;
  const apply = () => plugins.forEach((_, index) =>
    lens.set(index, on && !covered ? COLUMN_LOOKS.rest : COLUMN_LOOKS.off, NEWS_MOVE_MS));

  return {
    // La slide entra o esce: le colonne sfumano insieme al resto
    setSlideActive(active) {
      window.clearTimeout(hideTimer);
      on = active;
      covered = false;
      if (active) {
        wrap.style.display = '';
      } else {
        hideTimer = window.setTimeout(() => { if (!on) wrap.style.display = 'none'; }, NEWS_MOVE_MS + 100);
      }
      apply();
    },
    // Hover su una voce: le colonne sfumano e al loro posto si apre l'interfaccia a tutto schermo
    setCovered(value) {
      covered = value;
      apply();
    },
  };
}

function renderHomeNews(plugins) {
  const carousel = document.getElementById('homeNewsCarousel');
  const stage = document.getElementById('homeNewsSlides');
  const controls = document.getElementById('homeNewsControls');
  const tabs = document.getElementById('homeNewsDots');
  if (!carousel || !stage || !controls || !tabs) return;

  const news = buildHomeNews(plugins);

  // Each slide: background + overlay stay in place and cross-fade; .news-layer (card + text) slides sideways
  stage.innerHTML = news.map((item, index) => {
    const heading = index === 0 ? 'h1' : 'h2';
    return `
      <article class="news-slide news-slide--${item.variant}${index === 0 ? ' is-active' : ''}" id="news-slide-${index}" role="tabpanel" aria-roledescription="slide" aria-label="${index + 1} of ${news.length}" aria-hidden="${index !== 0}">
        <div class="plugin-item-bg news-slide-bg" aria-hidden="true"></div>
        <div class="plugin-item-overlay news-slide-overlay" aria-hidden="true"></div>
        <div class="news-layer">
          ${item.plugin ? renderNewsCard(item.plugin) : ''}
          <div class="news-copy">
            ${item.kicker ? `<p class="news-kicker">${escapeNewsMarkup(item.kicker)}</p>` : ''}
            <${heading} class="news-title">${escapeNewsMarkup(item.title)}</${heading}>
            ${item.bigVersion ? `<p class="news-bigversion">${escapeNewsMarkup(item.bigVersion)}</p>` : ''}
            ${item.version ? `<p class="news-version">${escapeNewsMarkup(item.version)}</p>` : ''}
            ${item.body ? `<p class="news-body">${escapeNewsMarkup(item.body)}</p>` : ''}
            ${item.notes || ''}
            ${item.timeline ? renderNewsTimeline(item.timeline) : ''}
            ${item.highlight ? `<p class="news-highlight">${escapeNewsMarkup(item.highlight)}</p>` : ''}
            ${item.primary ? `<div class="news-actions">
              ${renderNewsAction(item.primary, true)}
              ${item.secondary ? renderNewsAction(item.secondary) : ''}
            </div>` : ''}
          </div>
        </div>
      </article>`;
  }).join('');

  tabs.innerHTML = news.map((item, index) => `
    <button class="news-tab news-tab--${item.variant}${index === 0 ? ' is-active' : ''}" type="button" role="tab"
            aria-controls="news-slide-${index}" aria-selected="${index === 0}">
      <span class="news-tab-meter" aria-hidden="true"></span>
      <span class="news-tab-label">${escapeNewsMarkup(item.tab)}</span>
      <span class="news-tab-name">${escapeNewsMarkup(item.tabName)}</span>
    </button>`).join('');
  tabs.setAttribute('role', 'tablist');
  carousel.style.setProperty('--news-interval', `${NEWS_INTERVAL_MS}ms`);
  carousel.style.setProperty('--news-move', `${NEWS_MOVE_MS}ms`);

  // Proporzioni delle card, per gli angoli arrotondati in scala con la larghezza
  stage.querySelectorAll('.news-hero-card img:first-child').forEach(img => {
    const card = img.parentElement;
    const setRatio = () => card.style.setProperty('--ar', (img.naturalWidth / img.naturalHeight).toFixed(4));
    if (img.complete) setRatio(); else img.addEventListener('load', setRatio, { once: true });
  });

  // The interfaces of each card follow one another while its slide is the visible one
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    stage.querySelectorAll('.news-hero-card').forEach(card => {
      const images = [...card.querySelectorAll('img')];
      if (images.length < 2) return;
      const slide = card.closest('.news-slide');
      let current = 0;
      window.setInterval(() => {
        if (!slide.classList.contains('is-active')) return;
        images[current].classList.remove('active');
        current = (current + 1) % images.length;
        images[current].classList.add('active');
      }, NEWS_CARD_MS);
    });
  }

  stage.querySelectorAll('.news-slide').forEach((slide, index) => {
    if (news[index].image) slide.querySelector('.news-slide-bg').style.backgroundImage = `url("${news[index].image}")`;
  });

  // Activity slide: the background follows the hovered/focused entry
  const activityIndex = news.findIndex(item => item.variant === 'activity');
  const activityBackground = stage.querySelector('.news-slide--activity .news-slide-bg');
  const defaultActivityBackground = activityBackground?.style.backgroundImage || '';

  // Backgrounds through the same lens as the plugin showcase: crossfade, inverse fisheye, slow drift.
  // Without WebGL (or without plugin-showcase.js) the slides keep their own CSS backgrounds.
  const lensImages = [...new Set([
    ...news.map(item => item.image),
    ...(news[activityIndex]?.timeline || []).map(entry => entry.plugin.images?.[0]),
  ].filter(Boolean))];
  const lensHost = document.createElement('div');
  lensHost.className = 'news-lens';
  lensHost.setAttribute('aria-hidden', 'true');
  carousel.prepend(lensHost);
  const lens = typeof window.KDLens === 'function'
    ? window.KDLens(lensHost, lensImages, {
        opacity: 0.78, brightness: 0.82, saturation: 0.88,      // same look as the CSS backgrounds
        zoom: { shown: 1.04, hidden: 1.09 },
      })
    : null;

  // Activity: vertical crops of the updated plugins instead of a single image
  const columns = lens && activityIndex >= 0
    ? initActivityColumns(stage.querySelector('.news-slide--activity'), news[activityIndex].timeline)
    : null;

  if (lens) {
    carousel.classList.add('has-lens');
    carousel.kdShowImage = src => lens.show(lensImages.indexOf(src));
    // With columns the shared lens shows nothing on the Activity slide
    carousel.kdSlideImages = news.map((item, index) => (columns && index === activityIndex ? null : item.image));
    carousel.kdOnSlide = index => columns?.setSlideActive(index === activityIndex);
    carousel.kdShowImage(carousel.kdSlideImages[0]);
    carousel.kdOnSlide(0);
  } else {
    lensHost.remove();
  }

  stage.querySelectorAll('.news-slide--activity .news-update-link').forEach((link, index) => {
    const entry = news[activityIndex].timeline[index];
    if (!entry) return;

    if (columns) {
      // The hovered/focused entry opens its plugin full size, in place of the columns
      const image = entry.plugin.images?.[0];
      const show = () => { columns.setCovered(true); carousel.kdShowImage(image); };
      const restore = () => {
        if (link.matches(':hover') || document.activeElement === link) return;
        columns.setCovered(false);
        carousel.kdShowImage(null);
      };
      link.addEventListener('mouseenter', show);
      link.addEventListener('mouseleave', restore);
      link.addEventListener('focus', show);
      link.addEventListener('blur', restore);
      return;
    }

    // Fallback without WebGL: the CSS background follows the hovered entry
    const image = entry.plugin.images?.[0];
    if (!activityBackground || !image) return;
    const restartSlideCycle = () => {
      activityBackground.classList.add('is-drift-reset'); // snap the drift back to its start position
      void activityBackground.offsetWidth;                // commit that state before the transition restarts
      activityBackground.classList.remove('is-drift-reset');
      carousel.dispatchEvent(new Event('news-restart-timer'));
    };
    const show = () => {
      activityBackground.style.backgroundImage = `url("${image}")`;
      restartSlideCycle();
    };
    const restore = () => {
      if (!link.matches(':hover') && document.activeElement !== link) {
        activityBackground.style.backgroundImage = defaultActivityBackground;
        restartSlideCycle();
      }
    };
    link.addEventListener('mouseenter', show);
    link.addEventListener('mouseleave', restore);
    link.addEventListener('focus', show);
    link.addEventListener('blur', restore);
  });

  // The deck lives inside the slide's layer, so it slides together with the text
  renderPluginDeck(stage.querySelector('.news-slide--activity .news-layer') || carousel, plugins);
  controls.hidden = news.length < 2;
  carousel.setAttribute('aria-busy', 'false');
  lockNewsHeight(carousel);
  initHomeNewsCarousel(carousel);
}

// Mobile browsers resize the viewport while scrolling (address bar hiding/showing):
// the news hero takes the screen height once and keeps it, updating only when the width changes
// (rotation), so it never grows or shrinks under the visitor's finger. Used by mobile.css.
function lockNewsHeight(carousel) {
  let width = window.innerWidth;
  const lock = () => carousel.style.setProperty('--news-screen-h', `${window.innerHeight}px`);
  lock();
  window.addEventListener('resize', () => {
    if (window.innerWidth === width) return;
    width = window.innerWidth;
    lock();
  });
}

function initHomeNewsCarousel(carousel) {
  const slides = [...carousel.querySelectorAll('.news-slide')];
  const tabs = [...carousel.querySelectorAll('.news-tab')];
  if (slides.length < 2) return;

  let activeIndex = 0;
  let timer = null;
  let leaveTimer = null;
  let hoveringList = false;
  const lists = carousel.querySelectorAll('.news-timeline, .news-notes, .news-deck');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The active tab's meter fills over one interval; restart it whenever the timer restarts
  const restartMeter = () => {
    const meter = tabs[activeIndex]?.querySelector('.news-tab-meter');
    if (!meter) return;
    meter.classList.remove('is-running');
    void meter.offsetWidth;
    meter.classList.add('is-running');
  };

  const stopRotation = () => {
    if (timer) window.clearInterval(timer);
    timer = null;
    carousel.classList.add('is-paused');
  };

  // dir: 1 = new slide enters from the right (content moves left), -1 = from the left.
  // Background and overlay cross-fade in place; only the content layer travels.
  const showSlide = (index, dir) => {
    const next = (index + slides.length) % slides.length;
    if (next === activeIndex) return;
    dir = dir || (next > activeIndex ? 1 : -1);

    const leaving = slides[activeIndex];
    slides.forEach(slide => slide.classList.remove('is-leaving'));
    leaving.classList.add('is-leaving');
    window.clearTimeout(leaveTimer);
    leaveTimer = window.setTimeout(() => leaving.classList.remove('is-leaving'), NEWS_MOVE_MS + 50);

    carousel.style.setProperty('--news-dir', dir);
    void carousel.offsetWidth;   // the entering layer is placed on the right side before it animates

    activeIndex = next;
    slides.forEach((slide, slideIndex) => {
      const isActive = slideIndex === activeIndex;
      slide.classList.toggle('is-active', isActive);
      slide.setAttribute('aria-hidden', String(!isActive));
    });
    tabs.forEach((tab, tabIndex) => {
      const isActive = tabIndex === activeIndex;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
    });
    carousel.kdShowImage?.(carousel.kdSlideImages?.[activeIndex]);   // background crossfade (lens)
    carousel.kdOnSlide?.(activeIndex);                                // Activity columns
    restartMeter();
  };

  const startRotation = () => {
    stopRotation();
    const shouldPause = reducedMotion || hoveringList || carousel.contains(document.activeElement);
    if (shouldPause) return;
    carousel.classList.remove('is-paused');
    restartMeter();
    // Automatic rotation always moves left, also on the wrap-around
    timer = window.setInterval(() => showSlide(activeIndex + 1, 1), NEWS_INTERVAL_MS);
  };

  tabs.forEach((tab, index) => tab.addEventListener('click', () => showSlide(index)));

  carousel.addEventListener('news-restart-timer', startRotation);
  carousel.addEventListener('focusin', stopRotation);
  carousel.addEventListener('focusout', () => window.setTimeout(startRotation, 0));

  // Pause while the pointer is over a list (so it can be read) or over the plugin deck
  lists.forEach(list => {
    list.addEventListener('mouseenter', () => { hoveringList = true; stopRotation(); });
    list.addEventListener('mouseleave', () => { hoveringList = false; startRotation(); });
  });

  startRotation();
}

// ─── Plugin page hero: wallpaper background (same effect as homepage list) ───
function initPluginHeroBackground() {
  const hero = document.querySelector('.plugin-hero');
  if (!hero || hero.querySelector('.plugin-item-bg')) return;

  const carousel = hero.querySelector('.plugin-detail-image-carousel');
  if (!carousel) return;

  let images = [];
  try { images = JSON.parse(carousel.getAttribute('data-images') || '[]'); }
  catch (e) { return; }
  if (!images.length) return;

  const bg = document.createElement('div');
  bg.className = 'plugin-item-bg';
  bg.setAttribute('aria-hidden', 'true');
  bg.style.backgroundImage = `url('${images[0]}')`;

  const overlay = document.createElement('div');
  overlay.className = 'plugin-item-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  hero.prepend(bg, overlay);
}

// ─── Plugin detail image carousel ────────────────────────────────────────────
function initPluginDetailCarousel() {
  document.querySelectorAll('.plugin-detail-image-carousel').forEach(wrap => {
    if (wrap.dataset.init) return;
    wrap.dataset.init = '1';

    let images;
    try { images = JSON.parse(wrap.getAttribute('data-images') || '[]'); }
    catch (e) { return; }

    if (!images.length) return;

    images.forEach((src, i) => {
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      img.loading = i === 0 ? 'eager' : 'lazy';
      if (i === 0) img.classList.add('active');
      wrap.appendChild(img);
    });

    // Proportions of the screenshots, so the corners can be the same share of the width at any size
    const first = wrap.querySelector('img');
    const setRatio = () => { if (first.naturalWidth) wrap.style.setProperty('--ar', (first.naturalWidth / first.naturalHeight).toFixed(4)); };
    if (first.complete) setRatio(); else first.addEventListener('load', setRatio, { once: true });

    if (images.length < 2) return;

    let cur = 0;
    const next = () => {
      const imgs = wrap.querySelectorAll('img');
      imgs[cur].classList.remove('active');
      cur = (cur + 1) % images.length;
      imgs[cur].classList.add('active');
    };
    // Keeps cycling on hover too
    setInterval(next, 3500);
  });
}

// ─── Full-column plugin library navigation ───────────────────────────────────
function initPluginLibrary() {
  const cards = [...document.querySelectorAll('.plugin-volume[data-href]')];
  if (!cards.length) return;
  const isTouch = () => window.matchMedia('(hover: none)').matches;

  cards.forEach(card => {
    card.addEventListener('click', event => {
      if (isTouch() && !card.classList.contains('is-open')) {
        event.preventDefault();
        cards.forEach(item => item.classList.remove('is-open'));
        card.classList.add('is-open');
        card.focus({ preventScroll: true });
        return;
      }

      if (event.target.closest('a')) return;
      window.location.href = card.dataset.href;
    });

    card.addEventListener('keydown', event => {
      if (event.target !== card || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      if (isTouch() && !card.classList.contains('is-open')) {
        cards.forEach(item => item.classList.remove('is-open'));
        card.classList.add('is-open');
        return;
      }
      window.location.href = card.dataset.href;
    });
  });
}

// ─── MuseHub download milestone animation ───────
function initDownloadCounter() {
  const counters = document.querySelectorAll('[data-download-counter]');
  if (!counters.length) return;

  const formatter = new Intl.NumberFormat('en-US');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  counters.forEach(counter => {
    const target = Number(counter.dataset.downloadCounter);
    if (!Number.isFinite(target)) return;
    if (reducedMotion || !('IntersectionObserver' in window)) {
      counter.textContent = formatter.format(target);
      return;
    }

    counter.textContent = '0';
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      const startedAt = performance.now();
      const duration = 1500;
      const tick = now => {
        const progress = Math.min((now - startedAt) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        counter.textContent = formatter.format(Math.round(target * eased));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    observer.observe(counter);
  });
}

// ─── Scroll reveal ────────────────────────────────────────────────────────────
function initScrollReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });

  document.querySelectorAll('.reveal:not(.visible)').forEach(el => obs.observe(el));
}

// ─── Easter egg ───────────────────────────────────────────────────────────────
function initEasterEgg() {
  const code = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  let idx = 0;

  document.addEventListener('keydown', e => {
    idx = e.key === code[idx] ? idx + 1 : 0;
    if (idx === code.length) {
      const s = document.createElement('style');
      s.textContent = '@keyframes rainbow{0%{filter:hue-rotate(0deg)}100%{filter:hue-rotate(360deg)}}';
      document.head.appendChild(s);
      document.body.style.animation = 'rainbow 2s linear infinite';
      setTimeout(() => { document.body.style.animation = ''; s.remove(); }, 10000);
      idx = 0;
    }
  });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
loadComponents();

document.addEventListener('DOMContentLoaded', () => {
  loadHomepagePlugins();
  initPluginHeroBackground();
  initPluginDetailCarousel();
  initPluginLibrary();
  initDownloadCounter();
  initScrollReveal();
  initEasterEgg();
});