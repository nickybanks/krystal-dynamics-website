// Mobile-only components (styles in assets/css/mobile.css, active below 768px):
// - installation guide: Windows / macOS switch instead of two long cards,
//   built once the plugin page has been rendered.
(function () {
  'use strict';

  function initInstallTabs(guide) {
    const platforms = [...guide.querySelectorAll('.installation-platform')];
    if (guide.dataset.tabs || platforms.length < 2) return;
    guide.dataset.tabs = '1';

    // Start on the visitor's own system
    const isMac = /Mac|iPhone|iPad/i.test(navigator.userAgent);
    let active = Math.max(0, platforms.findIndex(p => /mac/i.test(p.querySelector('h4')?.textContent || '') === isMac));

    const tabs = document.createElement('div');
    tabs.className = 'install-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.innerHTML = platforms.map((platform, index) => {
      const name = platform.querySelector('h4')?.textContent || `Option ${index + 1}`;
      const format = platform.querySelector('.platform-format')?.textContent || '';
      return `<button type="button" role="tab" class="install-tab">${name}<small>${format}</small></button>`;
    }).join('');
    guide.before(tabs);

    const buttons = [...tabs.querySelectorAll('.install-tab')];
    const select = index => {
      active = index;
      platforms.forEach((platform, i) => platform.classList.toggle('is-active', i === index));
      buttons.forEach((button, i) => {
        button.classList.toggle('is-active', i === index);
        button.setAttribute('aria-selected', String(i === index));
      });
    };
    buttons.forEach((button, index) => button.addEventListener('click', () => select(index)));
    select(active);
  }

  function scan() {
    document.querySelectorAll('.installation-guide').forEach(initInstallTabs);
  }

  function boot() {
    scan();
    let pending = false;
    new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; scan(); });
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
