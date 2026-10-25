// Site-wide motion: scroll reveals, pointer tilt and spotlight, parallax.
// Works on content rendered later (plugin lists, plugin pages) by watching the DOM.
// Everything is skipped when the visitor prefers reduced motion.
(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const REVEAL = [
    '.milestone',
    '.plugin-item .plugin-image-wrapper',
    '.plugin-item .plugin-content > *',
    '.about-body > *',
    '.plugin-volume',
    '.plugin-hero .plugin-content > *',
    '.plugin-detail-content > :not(h3)',
    '.about-simple-copy > *',
    '.about-row',
    '.about-cta .container > *',
  ];
  const TILT = ['.plugin-detail-image-carousel'];
  // Headings that appear together with the block they introduce, instead of on their own
  const ATTACH = [
    { lead: '.plugin-detail-content > h3', follower: el => el.nextElementSibling },
    { lead: '.about-story-intro', follower: () => document.querySelector('.about-row') },
  ];
  const SPOTLIGHT = ['.plugin-detail-content > ul > li', '.collapsible', '.installation-platform'];
  const PARALLAX = ['.about-hero-image'];

  const once = (el, key) => {
    const tag = `kd${key}`;
    if (el.dataset[tag]) return false;
    el.dataset[tag] = '1';
    return true;
  };

  // ── Reveal: elements rise into place the first time they enter the viewport ──
  const leadsOf = new Map();   // follower element -> headings that appear with it

  function show(el, delay) {
    el.style.setProperty('--kd-delay', `${delay}ms`);
    el.classList.add('is-in');
    // Hand control back to the element's own transitions once it has arrived
    setTimeout(() => el.classList.remove('kd-reveal', 'is-in'), 900 + delay);
  }

  const revealObserver = new IntersectionObserver(entries => {
    // Stagger only the elements that enter together, in document order
    entries.filter(entry => entry.isIntersecting).forEach((entry, index) => {
      const el = entry.target;
      revealObserver.unobserve(el);
      const delay = Math.min(index, 4) * 60;
      show(el, delay);
      (leadsOf.get(el) || []).forEach(lead => show(lead, delay));
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });

  function bindReveal(el) {
    if (!once(el, 'Reveal')) return;
    el.classList.add('kd-reveal');
    revealObserver.observe(el);
  }

  function bindAttach(lead, findFollower) {
    const follower = findFollower(lead);
    if (!follower || !follower.dataset.kdReveal || !once(lead, 'Lead')) return;
    lead.classList.add('kd-reveal');
    if (!follower.classList.contains('kd-reveal')) { show(lead, 0); return; }   // follower already shown
    leadsOf.set(follower, [...(leadsOf.get(follower) || []), lead]);
  }

  // ── Tilt: interface screenshots lean toward the pointer, with a soft glare ──
  function bindTilt(el) {
    if (!finePointer || !once(el, 'Tilt')) return;
    el.classList.add('kd-tilt');
    const glare = document.createElement('span');
    glare.className = 'kd-glare';
    glare.setAttribute('aria-hidden', 'true');
    el.appendChild(glare);

    let target = { x: 0, y: 0 }, current = { x: 0, y: 0 }, frame = 0;
    const step = () => {
      current.x += (target.x - current.x) * 0.12;
      current.y += (target.y - current.y) * 0.12;
      el.style.transform = `perspective(1000px) rotateX(${(-current.y * 7).toFixed(2)}deg) rotateY(${(current.x * 9).toFixed(2)}deg)`;
      const settled = Math.abs(target.x - current.x) < 0.001 && Math.abs(target.y - current.y) < 0.001;
      frame = settled ? 0 : requestAnimationFrame(step);
      if (settled && !target.x && !target.y) el.style.transform = '';
    };
    const kick = () => { if (!frame) frame = requestAnimationFrame(step); };

    el.addEventListener('pointermove', event => {
      const box = el.getBoundingClientRect();
      target = { x: (event.clientX - box.left) / box.width - 0.5, y: (event.clientY - box.top) / box.height - 0.5 };
      el.style.setProperty('--gx', `${(target.x + 0.5) * 100}%`);
      el.style.setProperty('--gy', `${(target.y + 0.5) * 100}%`);
      kick();
    });
    el.addEventListener('pointerleave', () => { target = { x: 0, y: 0 }; kick(); });
  }

  // ── Spotlight: a faint light follows the pointer across cards ──
  function bindSpotlight(el) {
    if (!finePointer || !once(el, 'Spot')) return;
    const light = document.createElement('span');
    light.className = 'kd-spotlight';
    light.setAttribute('aria-hidden', 'true');
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.appendChild(light);
    el.addEventListener('pointermove', event => {
      const box = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${event.clientX - box.left}px`);
      el.style.setProperty('--my', `${event.clientY - box.top}px`);
    });
  }

  // ── Parallax: large photos drift slower than the page ──
  const parallaxItems = [];
  function bindParallax(el) {
    if (!once(el, 'Para')) return;
    el.classList.add('kd-parallax');
    parallaxItems.push(el);
    updateParallax();
  }
  function updateParallax() {
    const mid = window.innerHeight / 2;
    parallaxItems.forEach(el => {
      const box = el.getBoundingClientRect();
      if (box.bottom < 0 || box.top > window.innerHeight) return;
      el.style.translate = `0 ${((box.top + box.height / 2 - mid) * -0.08).toFixed(1)}px`;
    });
  }

  // ── Bind everything that matches, now and whenever new content is rendered ──
  function bindAll() {
    REVEAL.forEach(sel => document.querySelectorAll(sel).forEach(bindReveal));
    ATTACH.forEach(({ lead, follower }) => document.querySelectorAll(lead).forEach(el => bindAttach(el, follower)));
    TILT.forEach(sel => document.querySelectorAll(sel).forEach(bindTilt));
    SPOTLIGHT.forEach(sel => document.querySelectorAll(sel).forEach(bindSpotlight));
    PARALLAX.forEach(sel => document.querySelectorAll(sel).forEach(bindParallax));
  }

  let pending = false;
  const scheduleBind = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; bindAll(); });
  };

  function boot() {
    bindAll();
    new MutationObserver(scheduleBind).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('scroll', () => requestAnimationFrame(updateParallax), { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();