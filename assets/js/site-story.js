// Section headings and entrance animations of the plugin pages (plugin-story.js), for the other
// pages of the site: home and About. Titles marked data-ks-split rise word by word, elements marked
// data-ks-reveal fade in as they enter the screen. Content added later (rendered from
// plugins.json) is picked up as well.
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const animated = !reduceMotion.matches && 'IntersectionObserver' in window;

  // "Two words" -> each word in its own mask, as the plugin pages do
  function split(el) {
    if (el.dataset.ksSplitDone) return;
    el.dataset.ksSplitDone = '1';
    if (el.textContent.includes('\u2062')) return;   // local edit mode (_text-editor) keeps the text whole
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach((word, i) => {
      const outer = document.createElement('span');
      outer.className = 'ks-word';
      outer.style.setProperty('--i', i);
      const inner = document.createElement('span');
      inner.textContent = word;
      outer.appendChild(inner);
      el.appendChild(outer);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
  }

  const observer = animated ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }) : null;

  function watch(root) {
    root.querySelectorAll?.('[data-ks-split]').forEach(el => { if (!el.querySelector('.ks-word')) split(el); });
    root.querySelectorAll?.('[data-ks-reveal], [data-ks-split]').forEach(el => {
      if (el.dataset.ksWatched) return;
      el.dataset.ksWatched = '1';
      if (!observer || el.getBoundingClientRect().bottom < 0) el.classList.add('is-in');
      else observer.observe(el);
    });
  }

  function start() {
    const root = document.querySelector('main');
    if (!root) return;
    if (animated) root.classList.add('ks-animate');
    watch(root);
    new MutationObserver(records => records.forEach(r => r.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      if (node.matches('[data-ks-reveal], [data-ks-split]')) watch(node.parentElement || node);
      else watch(node);
    }))).observe(root, { childList: true, subtree: true });
  }

  window.KDSiteStory = { split, watch };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
