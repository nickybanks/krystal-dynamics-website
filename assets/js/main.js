// ─── Shared content data ─────────────────────────────────────────────────────
let PLUGINS = [];
let siteDataPromise;

async function getSiteData() {
  if (!siteDataPromise) {
    siteDataPromise = fetch('/assets/data/plugins.json')
      .then(response => {
        if (!response.ok) throw new Error(`Content data request failed: ${response.status}`);
        return response.json();
      })
      .catch(error => {
        siteDataPromise = null;
        throw error;
      });
  }
  return siteDataPromise;
}

// ─── Patreon URL (mirrors the link in the About section) ─────────────────────
const PATREON_URL = 'https://www.patreon.com/cw/Krystal_Dynamics?vanity=Krystal_Dynamics';

// ─── Fetch version data ───────────────────────────────────────────────────────
async function fetchVersionData(plugin) {
  try {
    const res = await fetch(plugin.versionFile + '?_=' + Date.now());
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    return { ...plugin, version: data.version, releaseDate: data.releaseDate };
  } catch (e) {
    console.warn('Version fetch failed for', plugin.name, e);
    return { ...plugin, version: null, releaseDate: '1970-01-01' };
  }
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
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// ─── Render homepage plugin list ─────────────────────────────────────────────
function renderPluginList(plugins) {
  const container = document.getElementById('pluginList');
  if (!container) return;

  container.innerHTML = '';

  plugins.forEach((plugin, index) => {
    const isFeatured    = index === 0;
    const isEarlyAccess = isFeatured && new Date(plugin.releaseDate) > new Date();
    const isReversed    = !isFeatured && (index % 2 === 1);

    const specsHTML   = plugin.formats.map(f => `<li>${f}</li>`).join('');
    const versionHTML = plugin.version ? `<li>Version ${plugin.version}</li>` : '';

    const ctaHTML = isEarlyAccess
      ? `<div class="plugin-early-access">
           <a href="${PATREON_URL}" target="_blank" rel="noopener noreferrer"
              class="btn btn-patreon"
              aria-label="Join Patreon for early access to ${plugin.name}">
             <span class="btn-patreon-logo" aria-hidden="true">
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
                 <path d="M15.303125 4.80625c-0.003125 -2.04375 -1.59375 -3.71875 -3.459375 -4.321875C9.525 -0.265625 6.46875 -0.15625 4.253125 0.8875 1.571875 2.153125 0.728125 4.928125 0.696875 7.69375 0.671875 9.96875 0.896875 15.95625 4.278125 16c2.509375 0.03125 2.884375 -3.203125 4.046875 -4.759375 0.825 -1.109375 1.890625 -1.421875 3.2 -1.746875 2.25 -0.55625 3.784375 -2.334375 3.78125 -4.6875z"/>
               </svg>
             </span>
             <span>Join Patreon for Early Access</span>
           </a>
           <p class="plugin-release-hint">Releasing ${formatReleaseDate(plugin.releaseDate)}</p>
         </div>`
      : `<div class="plugin-actions">
           <a href="${plugin.page}" class="btn btn-primary">View Details</a>
           <a href="${plugin.museHub}" class="plugin-musehub-link" target="_blank" rel="noopener noreferrer">Visit MuseHub</a>
         </div>`;

    const badgeHTML = isFeatured
      ? `<div class="plugin-featured-badge${isEarlyAccess ? ' plugin-featured-badge--early' : ''}">
           ${isEarlyAccess ? 'Early Access' : 'Latest Release'}
         </div>`
      : '';

    const article = document.createElement('article');
    const classes  = ['plugin-item'];
    if (isFeatured)    classes.push('plugin-item--featured');
    if (isEarlyAccess) classes.push('plugin-item--early-access');
    if (isReversed)    classes.push('plugin-item--reversed');
    article.className = classes.join(' ');

    article.innerHTML = `
      <div class="plugin-item-bg" aria-hidden="true"></div>
      <div class="plugin-item-overlay" aria-hidden="true"></div>
      <div class="container">
        <div class="plugin-grid${isReversed ? ' plugin-grid-reverse' : ''}">
          <div class="plugin-image-wrapper">
            <a href="${isEarlyAccess ? PATREON_URL : plugin.page}"
              ${isEarlyAccess ? 'target="_blank" rel="noopener noreferrer"' : ''}
              class="plugin-detail-image-carousel plugin-carousel-link"
              aria-label="${isEarlyAccess ? 'Join Patreon for early access to ' + plugin.name : 'View details for ' + plugin.name}"
              data-images='${JSON.stringify(plugin.images)}'></a>
          </div>
          <div class="plugin-content">
            <div class="plugin-content-header">
              <div></div>
              ${badgeHTML}
            </div>
            <h3>${plugin.name}</h3>
            <p>${plugin.description}</p>
            <ul class="plugin-specs">${specsHTML}${versionHTML}</ul>
            ${ctaHTML}
          </div>
        </div>
      </div>`;

    const background = article.querySelector('.plugin-item-bg');
    if (plugin.images?.[0]) background.style.backgroundImage = `url("${plugin.images[0]}")`;

    container.appendChild(article);
  });

  initPluginDetailCarousel();
}

// ─── Load homepage plugins ────────────────────────────────────────────────────
async function loadHomepagePlugins() {
  const container = document.getElementById('pluginList');
  if (!container) return;

  try {
    const data = await getSiteData();
    PLUGINS = data.plugins;
  } catch (error) {
    console.error('Unable to load plugin data:', error);
    return;
  }

  const withVersions = await Promise.all(PLUGINS.map(fetchVersionData));
  const sorted = sortByDate(withVersions);

  console.log('Loaded plugins:', sorted.map(p => ({ name: p.name, date: p.releaseDate, version: p.version })));

  renderHomeNews(sorted);
  renderPluginList(sorted);
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

function renderHomeNews(plugins) {
  const carousel = document.getElementById('homeNewsCarousel');
  const stage = document.getElementById('homeNewsSlides');
  const controls = document.getElementById('homeNewsControls');
  const dots = document.getElementById('homeNewsDots');
  if (!carousel || !stage || !controls || !dots) return;

  const today = new Date();
  const datedPlugins = plugins.filter(plugin => plugin.version && Number.isFinite(Date.parse(plugin.releaseDate)));
  const upcoming = datedPlugins
    .filter(plugin => new Date(plugin.releaseDate) > today)
    .sort((a, b) => new Date(a.releaseDate) - new Date(b.releaseDate))[0];
  const latest = sortByDate(datedPlugins.filter(plugin => new Date(plugin.releaseDate) <= today))[0];
  const latestHistory = latest?.history?.find(release => release.version === latest.version);
  const releaseHighlight = latestHistory?.groups?.flatMap(group => group.items || [])[0];
  const latestUpdates = datedPlugins
    .filter(plugin => new Date(plugin.releaseDate) <= today)
    .map(plugin => {
      const release = plugin.history?.find(entry => entry.version === plugin.version);
      const summary = release?.groups?.flatMap(group => group.items || []).find(Boolean);
      return release && summary ? { plugin, release, summary } : null;
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.plugin.releaseDate) - new Date(a.plugin.releaseDate))
    .slice(0, 3);
  const latestUpdatePlugin = latestUpdates[0]?.plugin || latest;

  const news = [];
  if (upcoming) {
    news.push({
      variant: 'early-access',
      kicker: 'Early access - coming soon',
      title: upcoming.name,
      version: `Public release ${formatReleaseDate(upcoming.releaseDate)}`,
      body: upcoming.catalogDescription || upcoming.description,
      highlight: 'Get early access on Patreon ahead of the public release.',
      image: upcoming.images?.[0],
      primary: { label: 'Get early access', href: PATREON_URL },
      secondary: { label: 'Plugin details', href: upcoming.page },
    });
  }

  if (latest) {
    news.push({
      kicker: `Latest release - ${formatReleaseDate(latest.releaseDate)}`,
      title: latest.name,
      version: `Version ${latest.version}`,
      body: latest.catalogDescription || latest.description,
      highlight: releaseHighlight ? `Latest update: ${releaseHighlight}` : '',
      image: latest.images?.[0],
      primary: { label: 'View details', href: latest.page },
      secondary: { label: 'Visit MuseHub', href: latest.museHub },
    });
  }

  news.push({
    variant: 'latest-updates',
    title: 'Latest updates',
    version: `${latestUpdates.length} recently updated plugins`,
    body: 'Recent fixes and improvements from across the plugin suite.',
    updates: latestUpdates,
    image: latestUpdatePlugin?.images?.[0] || upcoming?.images?.[0] || plugins[0]?.images?.[0] || '',
    primary: { label: 'View details', href: latestUpdatePlugin?.page || '/plugins.html' },
    secondary: { label: 'Browse all plugins', href: '/plugins.html' },
  });

  stage.innerHTML = news.map((item, index) => {
    const heading = index === 0 ? 'h1' : 'h2';
    const variantClass = item.variant ? ` news-slide--${escapeNewsMarkup(item.variant)}` : '';
    const highlightMarkup = item.highlight ? `<p class="news-highlight">${escapeNewsMarkup(item.highlight)}</p>` : '';
    const updatesMarkup = item.updates?.length ? `
      <ul class="news-update-list">
        ${item.updates.map(update => `
          <li>
            <a class="news-update-link" href="${escapeNewsMarkup(update.plugin.page)}">
              <span class="news-update-title">${escapeNewsMarkup(update.plugin.name)} <small>v${escapeNewsMarkup(update.release.version)}</small></span>
              <time class="news-update-date" datetime="${escapeNewsMarkup(update.plugin.releaseDate)}">${escapeNewsMarkup(formatReleaseDate(update.plugin.releaseDate))}</time>
              <span class="news-update-note">${escapeNewsMarkup(update.summary)}</span>
            </a>
          </li>`).join('')}
      </ul>` : '';

    return `
      <article class="news-slide${variantClass}${index === 0 ? ' is-active' : ''}" role="group" aria-roledescription="slide" aria-label="${index + 1} of ${news.length}" aria-hidden="${index !== 0}">
        <div class="plugin-item-bg news-slide-bg" aria-hidden="true"></div>
        <div class="plugin-item-overlay news-slide-overlay" aria-hidden="true"></div>
        <div class="news-copy">
          ${item.kicker ? `<p class="news-kicker">${escapeNewsMarkup(item.kicker)}</p>` : ''}
          <${heading} class="news-title">${escapeNewsMarkup(item.title)}</${heading}>
          <p class="news-version">${escapeNewsMarkup(item.version)}</p>
          <p class="news-body">${escapeNewsMarkup(item.body)}</p>
          ${updatesMarkup}
          ${highlightMarkup}
          <div class="news-actions">
            ${renderNewsAction(item.primary, true)}
            ${renderNewsAction(item.secondary)}
          </div>
        </div>
      </article>`;
  }).join('');

  dots.innerHTML = news.map((item, index) => `
    <button class="news-dot${index === 0 ? ' is-active' : ''}" type="button" data-news-index="${index}" aria-label="Show news slide ${index + 1}: ${escapeNewsMarkup(item.title)}" aria-pressed="${index === 0}"></button>`).join('');
  stage.querySelectorAll('.news-slide').forEach((slide, index) => {
    if (news[index].image) slide.querySelector('.news-slide-bg').style.backgroundImage = `url("${news[index].image}")`;
  });
  const updatesBackground = stage.querySelector('.news-slide--latest-updates .news-slide-bg');
  const defaultUpdatesBackground = updatesBackground?.style.backgroundImage || '';
  stage.querySelectorAll('.news-update-link').forEach((link, index) => {
    const image = latestUpdates[index]?.plugin.images?.[0];
    if (!updatesBackground || !image) return;

    // Restart the slide timer and the image drift whenever the hovered/focused update changes.
    const restartSlideCycle = () => {
      updatesBackground.classList.add('is-drift-reset'); // snap the drift back to its start position
      void updatesBackground.offsetWidth;                // commit that state before the transition restarts
      updatesBackground.classList.remove('is-drift-reset');
      carousel.dispatchEvent(new Event('news-restart-timer'));
    };
    const showPluginBackground = () => {
      updatesBackground.style.backgroundImage = `url("${image}")`;
      restartSlideCycle();
    };
    const restoreUpdatesBackground = () => {
      if (!link.matches(':hover') && document.activeElement !== link) {
        updatesBackground.style.backgroundImage = defaultUpdatesBackground;
        restartSlideCycle();
      }
    };

    link.addEventListener('mouseenter', showPluginBackground);
    link.addEventListener('mouseleave', restoreUpdatesBackground);
    link.addEventListener('focus', showPluginBackground);
    link.addEventListener('blur', restoreUpdatesBackground);
  });
  controls.hidden = news.length < 2;
  carousel.setAttribute('aria-busy', 'false');
  initHomeNewsCarousel(carousel);
}

function initHomeNewsCarousel(carousel) {
  const slides = [...carousel.querySelectorAll('.news-slide')];
  const dots = [...carousel.querySelectorAll('.news-dot')];
  if (slides.length < 2) return;

  let activeIndex = 0;
  let timer = null;
  let hoveringUpdates = false;
  const updatesList = carousel.querySelector('.news-update-list');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const stopRotation = () => {
    if (timer) window.clearInterval(timer);
    timer = null;
  };

  const showSlide = index => {
    activeIndex = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      const isActive = slideIndex === activeIndex;
      slide.classList.toggle('is-active', isActive);
      slide.setAttribute('aria-hidden', String(!isActive));
    });
    dots.forEach((dot, dotIndex) => {
      const isActive = dotIndex === activeIndex;
      dot.classList.toggle('is-active', isActive);
      dot.setAttribute('aria-pressed', String(isActive));
    });
  };

  const startRotation = () => {
    stopRotation();
    const shouldPause = reducedMotion || hoveringUpdates || carousel.contains(document.activeElement);
    if (!shouldPause) timer = window.setInterval(() => showSlide(activeIndex + 1), 5500);
  };

  dots.forEach((dot, index) => dot.addEventListener('click', () => showSlide(index)));

  carousel.addEventListener('news-restart-timer', startRotation);
  carousel.addEventListener('focusin', stopRotation);
  carousel.addEventListener('focusout', () => window.setTimeout(startRotation, 0));

  // Pause the rotation while the mouse is over the "latest updates" list.
  if (updatesList) {
    updatesList.addEventListener('mouseenter', () => { hoveringUpdates = true; stopRotation(); });
    updatesList.addEventListener('mouseleave', () => { hoveringUpdates = false; startRotation(); });
  }

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

    if (images.length < 2) return;

    let cur = 0;
    let timer;
    const next = () => {
      const imgs = wrap.querySelectorAll('img');
      imgs[cur].classList.remove('active');
      cur = (cur + 1) % images.length;
      imgs[cur].classList.add('active');
    };
    const start = () => { timer = setInterval(next, 3500); };
    const stop  = () => clearInterval(timer);

    start();
    wrap.addEventListener('mouseenter', stop);
    wrap.addEventListener('mouseleave', start);
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
