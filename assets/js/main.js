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
    ],
    formats: ['VST3', 'AU'],
  },
  {
    id: 'krystal-clip',
    name: 'KrystalClip',
    description: 'A clipping processor featuring three distinct saturation algorithms for controlled peak limiting. Each mode provides different harmonic characteristics, from transparent loudness control to creative saturation.',
    page: 'plugins/krystal-clip.html',
    versionFile: '/versions/krystalclip_version.json',
    images: [
      'assets/images/k-clip-interface-1.png',
      'assets/images/k-clip-interface-2.png',
      'assets/images/k-clip-interface-3.png',
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
    ],
    formats: ['VST3', 'AU'],
  },
];

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

// ─── Render homepage plugin list ─────────────────────────────────────────────
function renderPluginList(plugins) {
  const container = document.getElementById('pluginList');
  if (!container) return;
  
  container.innerHTML = '';
  
  plugins.forEach((plugin, index) => {
    const isEven = index % 2 === 1;
    const specsHTML = plugin.formats.map(f => `<li>${f}</li>`).join('');
    const versionHTML = plugin.version
      ? `<li>Version ${plugin.version}</li>`
      : '';
    
    const article = document.createElement('article');
    article.className = 'plugin-item';
    article.innerHTML = `
      <div class="container">
        <div class="plugin-grid${isEven ? ' plugin-grid-reverse' : ''}">
          <div class="plugin-detail-image-carousel"
               data-images='${JSON.stringify(plugin.images)}'></div>
          <div class="plugin-content">
            <h3>${plugin.name}</h3>
            <p>${plugin.description}</p>
            <ul class="plugin-specs">${specsHTML}${versionHTML}</ul>
            <a href="${plugin.page}" class="btn btn-primary">View Details</a>
          </div>
        </div>
      </div>`;
    container.appendChild(article);
  });
  
  // Init carousels for newly injected elements
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