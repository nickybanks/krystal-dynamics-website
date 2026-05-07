// ─── Plugin registry ─────────────────────────────────────────────────────────
const PLUGINS = [
  {
    id: 'krystal-field',
    name: 'KrystalField',
    description: 'A mastering-grade dynamic processor featuring dual compression engines for simultaneous downward and upward compression. Precise control over mix dynamics for mastering, bus processing, and final mix polish.',
    page: 'plugins/krystal-field.html',
    versionFile: '/versions/krystalfield_version.json',
    images: [
      'assets/images/k-field-interface-1.png',
      'assets/images/k-field-interface-2.png',
      'assets/images/k-field-interface-3.png',
      'assets/images/k-field-interface-4.png',
    ],
    formats: ['VST3', 'AU'],
  },
  {
    id: 'krystal-clip',
    name: 'KrystalClip',
    description: 'A clipping processor featuring four distinct saturation algorithms for controlled peak limiting. Each mode provides different harmonic characteristics, from transparent loudness control to creative saturation.',
    page: 'plugins/krystal-clip.html',
    versionFile: '/versions/krystalclip_version.json',
    images: [
      'assets/images/k-clip-interface-1.png',
      'assets/images/k-clip-interface-2.png',
      'assets/images/k-clip-interface-3.png',
      'assets/images/k-clip-interface-4.png',
    ],
    formats: ['VST3', 'AU'],
  },
  {
    id: 'krystal-comp',
    name: 'KrystalComp',
    description: 'A precision digital compressor designed for mixing and mastering workflows. Surgical control over dynamics with flexible sidechain processing and both RMS and Peak detection modes.',
    page: 'plugins/krystal-comp.html',
    versionFile: '/versions/krystalcomp_version.json',
    images: [
      'assets/images/k-comp-interface-1.png',
      'assets/images/k-comp-interface-2.png',
      'assets/images/k-comp-interface-3.png',
      'assets/images/k-comp-interface-4.png',
    ],
    formats: ['VST3', 'AU'],
  },
  {
    id: 'krystal-peak',
    name: 'KrystalPeak',
    description: 'A transparent digital limiter designed to suppress peaks and maximize loudness. Shape transients with precision while maintaining clarity, impact, and mix integrity.',
    page: 'plugins/krystal-peak.html',
    versionFile: '/versions/krystalpeak_version.json',
    images: [
      'assets/images/k-peak-interface-1.png',
      'assets/images/k-peak-interface-2.png',
      'assets/images/k-peak-interface-3.png',
      'assets/images/k-peak-interface-4.png',
    ],
    formats: ['VST3', 'AU'],
  }
];

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
      : `<a href="${plugin.page}" class="btn btn-primary">View Details</a>`;

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
      <div class="plugin-item-bg" style="background-image:url('${plugin.images?.[0] || ''}')" aria-hidden="true"></div>
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

    container.appendChild(article);
  });

  initPluginDetailCarousel();
}

// ─── Load homepage plugins ────────────────────────────────────────────────────
async function loadHomepagePlugins() {
  const container = document.getElementById('pluginList');
  if (!container) return;

  const withVersions = await Promise.all(PLUGINS.map(fetchVersionData));
  const sorted = sortByDate(withVersions);

  console.log('Loaded plugins:', sorted.map(p => ({ name: p.name, date: p.releaseDate, version: p.version })));

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
  await loadComponent('footer', '/assets/includes/footer.html');
  initTheme();
  initHeaderScroll();
  initNavHighlight();
}

// ─── Theme ────────────────────────────────────────────────────────────────────
function initTheme() {
  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;

  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);

  toggle.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
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
  const sections = document.querySelectorAll('section[id]');
  if (!sections.length) return;

  const links = document.querySelectorAll('.nav-link');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        links.forEach(l => l.classList.remove('active'));
        const a = document.querySelector(`.nav-link[href*="${entry.target.id}"]`);
        a?.classList.add('active');
      }
    });
  }, { threshold: 0.35 });

  sections.forEach(s => obs.observe(s));
}

// ─── Hero carousel ────────────────────────────────────────────────────────────
function initHeroCarousel() {
  const wrap = document.getElementById('carouselContainer');
  if (!wrap) return;

  const srcs = [
    'assets/images/k-field-interface-1.png',
    'assets/images/k-clip-interface-1.png',
    'assets/images/k-comp-interface-1.png',
    'assets/images/k-peak-interface-1.png',
  ];

  srcs.forEach((src, i) => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.className = 'carousel-slide' + (i === 0 ? ' active' : '');
    img.loading = i === 0 ? 'eager' : 'lazy';
    wrap.appendChild(img);
  });

  let cur = 0;
  setInterval(() => {
    const slides = wrap.querySelectorAll('.carousel-slide');
    slides[cur].classList.remove('active');
    cur = (cur + 1) % srcs.length;
    slides[cur].classList.add('active');
  }, 5000);
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
  initHeroCarousel();
  loadHomepagePlugins();
  initPluginDetailCarousel();
  initScrollReveal();
  initEasterEgg();
});