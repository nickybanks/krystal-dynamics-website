// Render page sections from the shared plugin data file.
(function () {
  'use strict';

  const WINDOWS_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/></svg>';
  const APPLE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>';

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
  }

  function list(items, className = '') {
    return `<ul${className ? ` class="${className}"` : ''}>${items.map(item => `<li>${escapeHTML(item)}</li>`).join('')}</ul>`;
  }

  function renderPluginLibrary(plugins) {
    const shelf = document.querySelector('.library-shelf');
    if (!shelf) return;

    const catalogOrder = ['krystal-comp', 'krystal-clip', 'krystal-field', 'krystal-peak', 'krystal-shaper'];
    const sorted = [...plugins].sort((a, b) => catalogOrder.indexOf(a.id) - catalogOrder.indexOf(b.id));
    shelf.innerHTML = sorted.map((plugin, index) => `
      <article class="plugin-volume" role="listitem" tabindex="0"
        data-href="${escapeHTML(plugin.page)}"
        aria-label="View details for ${escapeHTML(plugin.name)}">
        <img class="volume-image" src="${escapeHTML(plugin.images[0])}"
          alt="${escapeHTML(plugin.name)} plugin interface" ${index === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}>
        <div class="volume-detail">
          <h2>${escapeHTML(plugin.name)}</h2>
          <p>${escapeHTML(plugin.catalogDescription)}</p>
          <a href="${escapeHTML(plugin.page)}">View details</a>
        </div>
      </article>`).join('');

    if (typeof initPluginLibrary === 'function') initPluginLibrary();
  }

  function renderAboutSections(about) {
    const homeCopy = document.getElementById('homeAboutCopy');
    if (homeCopy && about.home) {
      const home = about.home;
      const heading = document.querySelector('.about-story h2');
      if (heading) heading.textContent = home.title;
      homeCopy.innerHTML = home.paragraphs.map(paragraph => `<p>${escapeHTML(paragraph)}</p>`).join('');
      const link = document.getElementById('homeAboutLink');
      if (link) {
        link.href = home.link.href;
        link.textContent = home.link.label;
      }
    }

    const storyGrid = document.getElementById('aboutStoryGrid');
    if (storyGrid && Array.isArray(about.story)) {
      // The hero keeps its title on the left, so the first row puts the title on the right
      // and the layout alternates from there (see .about-row--title-right in pages.css).
      storyGrid.innerHTML = about.story.map((section, index) => `
        <article class="about-row about-row--${index % 2 === 0 ? 'title-right' : 'title-left'}">
          <div class="container about-row-inner">
            <div class="about-row-title">
              <span class="about-row-index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
              <h3>${escapeHTML(section.title)}</h3>
            </div>
            <div class="about-row-copy">
              ${section.paragraphs.map(paragraph => `<p>${escapeHTML(paragraph)}</p>`).join('')}
            </div>
          </div>
        </article>`).join('');
    }
  }

  function renderSpecifications(plugin) {
    const specifications = [
      { label: 'Version', value: plugin.version },
      ...plugin.specifications,
    ];
    return `<dl class="specs">${specifications.map(item => `
      <dt>${escapeHTML(item.label)}</dt><dd>${escapeHTML(item.value)}</dd>`).join('')}
    </dl>`;
  }

  function renderInstallation(plugin) {
    const name = escapeHTML(plugin.name);
    return `
      <div class="installation-guide">
        <section class="installation-platform" aria-labelledby="install-windows-title">
          <div class="platform-header">
            <span class="platform-icon">${WINDOWS_ICON}</span>
            <div class="platform-info"><h4 id="install-windows-title">Windows</h4><span class="platform-format">VST3</span></div>
          </div>
          <div class="installation-steps">
            <div class="installation-method">
              <div class="method-label">Recommended</div>
              <ol class="step-list">
                <li>Download the <strong>.zip</strong> package and extract it.</li>
                <li>Run <strong>${name}-Windows-installer.exe</strong> and follow the on-screen instructions.</li>
                <li>Restart your DAW and rescan plugins if needed.</li>
              </ol>
            </div>
            <div class="installation-method">
              <div class="method-label">Manual installation (if the installer can't be used)</div>
              <ol class="step-list">
                <li>Copy <strong>${name}.vst3</strong> to <code>C:\\Program Files\\Common Files\\VST3</code>.</li>
                <li>Restart your DAW and rescan plugins if needed.</li>
              </ol>
            </div>
            <p class="installation-note"><em>Note:</em> Some systems may show a security warning for unsigned installers. If this happens, use the manual method.</p>
          </div>
        </section>
        <section class="installation-platform" aria-labelledby="install-macos-title">
          <div class="platform-header">
            <span class="platform-icon">${APPLE_ICON}</span>
            <div class="platform-info"><h4 id="install-macos-title">macOS</h4><span class="platform-format">AU / VST3</span></div>
          </div>
          <div class="installation-steps">
            <div class="installation-method">
              <div class="method-label">Recommended</div>
              <ol class="step-list">
                <li>Download the <strong>.zip</strong> package and extract it.</li>
                <li>Open <strong>${name}-MacOS-installer.pkg</strong> and follow the on-screen instructions.</li>
                <li>Restart your DAW and rescan plugins if needed.</li>
              </ol>
            </div>
            <div class="installation-method">
              <div class="method-label">Manual installation (if the installer can't be used)</div>
              <ol class="step-list">
                <li>Copy <strong>${name}.component</strong> (AU) to <code>/Library/Audio/Plug-Ins/Components</code>.</li>
                <li>Copy <strong>${name}.vst3</strong> (VST3) to <code>/Library/Audio/Plug-Ins/VST3</code>.</li>
                <li>Restart your DAW and rescan plugins if needed.</li>
              </ol>
            </div>
            <p class="installation-note"><em>Note:</em> If macOS blocks the installer, you may need to allow it in <strong>System Settings &gt; Privacy &amp; Security</strong>. Apple guidance is available <a href="https://support.apple.com/en-us/102445" target="_blank" rel="noopener noreferrer">here</a>.</p>
          </div>
        </section>
      </div>`;
  }

  function renderHistory(plugin) {
    if (!plugin.history.length) return '';
    return `
      <h3>Version History</h3>
      ${plugin.history.map((release, index) => `
        <section class="collapsible${index === 0 ? ' is-open' : ''}">
          <button type="button" class="collapsible__header" aria-expanded="${index === 0}">
            <span class="collapsible__title">
              <span class="changelog-version">${escapeHTML(release.version)}</span>
              ${release.date ? `<span class="changelog-date text-sm">${escapeHTML(release.date)}</span>` : ''}
              ${index === 0 ? '<span class="badge badge--primary badge--small">Current</span>' : ''}
            </span>
            <svg class="collapsible__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="collapsible__content">
            <div class="collapsible__body">
              <div class="changelog-content">
                ${release.groups.map(group => `<h4>${escapeHTML(group.title)}</h4>${group.items.length ? list(group.items) : ''}`).join('')}
              </div>
            </div>
          </div>
        </section>`).join('')}`;
  }

  async function getCurrentPluginData(plugin) {
    try {
      const response = await fetch(`${plugin.versionFile}?_=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return plugin;
      const versionData = await response.json();
      return { ...plugin, version: versionData.version || plugin.version };
    } catch {
      return plugin;
    }
  }

  function renderPluginDetail(plugin) {
    const target = document.getElementById('pluginDetailPage');
    if (!target) return;
    const safeName = escapeHTML(plugin.name);
    const safeImages = escapeHTML(JSON.stringify(plugin.images));
    const downloadUrl = `https://krystal-dynamics.itch.io/${escapeHTML(plugin.downloadSlug)}/purchase`;

    const isEarlyAccess = new Date(plugin.releaseDate) > new Date();

    const downloadsBlock = isEarlyAccess
      ? `
      <div class="plugin-hero-downloads">
        <h2>Early Access</h2>
        <div class="plugin-early-access">
          <a href="${PATREON_URL}" class="btn btn-patreon" target="_blank" rel="noopener noreferrer" aria-label="Join Patreon for early access to ${safeName}">
            <span class="btn-patreon-logo" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M15.303125 4.80625c-0.003125 -2.04375 -1.59375 -3.71875 -3.459375 -4.321875C9.525 -0.265625 6.46875 -0.15625 4.253125 0.8875 1.571875 2.153125 0.728125 4.928125 0.696875 7.69375 0.671875 9.96875 0.896875 15.95625 4.278125 16c2.509375 0.03125 2.884375 -3.203125 4.046875 -4.759375 0.825 -1.109375 1.890625 -1.421875 3.2 -1.746875 2.25 -0.55625 3.784375 -2.334375 3.78125 -4.6875z"/></svg>
            </span>
            <span>JOIN PATREON</span>
          </a>
          <p class="plugin-release-hint">Public release ${escapeHTML(formatReleaseDate(plugin.releaseDate))}</p>
        </div>
      </div>`
      : `
      <div class="plugin-hero-downloads">
        <h2>Download</h2>
        <div class="download-buttons">
          <a href="${downloadUrl}" class="btn-download" target="_blank" rel="noopener noreferrer" aria-label="Download ${safeName} installer for Windows">
            <span class="os-logo">${WINDOWS_ICON}</span><span>Windows (VST3)</span>
          </a>
          <a href="${downloadUrl}" class="btn-download" target="_blank" rel="noopener noreferrer" aria-label="Download ${safeName} installer for macOS">
            <span class="os-logo">${APPLE_ICON}</span><span>macOS (AU/VST3)</span>
          </a>
        </div>
        <p class="download-note">Completely FREE for personal and commercial use</p>
      </div>`;

    target.innerHTML = `
      <section class="plugin-hero">
        <div class="container">
          <div class="plugin-grid">
            <div class="plugin-detail-image-carousel" data-images='${safeImages}' aria-label="${safeName} interface screenshots"></div>
            <div class="plugin-content">
              <h1>${safeName}</h1>
              <div class="plugin-hero-overview"><p>${escapeHTML(plugin.description)}</p></div>
              ${downloadsBlock}
            </div>
          </div>
        </div>
      </section>
      <section class="plugin-detail">
        <div class="container">
          <div class="plugin-detail-content">
            <h3>Features</h3>
            ${list(plugin.features)}
            <h3>Technical Specifications</h3>
            ${renderSpecifications(plugin)}
            <h3>Installation</h3>
            ${renderInstallation(plugin)}
            ${renderHistory(plugin)}
            <h3 class="mt-4">License</h3>
            <p class="installation-note mt-2">${escapeHTML(plugin.license)}</p>
          </div>
          <div class="back-link"><a href="/plugins.html">Back to all plugins</a></div>
        </div>
      </section>`;

    if (typeof initPluginHeroBackground === 'function') initPluginHeroBackground();
    if (typeof initPluginDetailCarousel === 'function') initPluginDetailCarousel();
    if (typeof initCollapsibles === 'function') initCollapsibles();
  }

  async function bootPageContent() {
    const wantsLibrary = document.querySelector('.library-shelf');
    const detailPage = document.getElementById('pluginDetailPage');
    const wantsAbout = document.getElementById('homeAboutCopy') || document.getElementById('aboutStoryGrid');
    if (!wantsLibrary && !detailPage && !wantsAbout) return;

    try {
      const data = await getSiteData();
      if (wantsLibrary) renderPluginLibrary(data.plugins);
      if (wantsAbout) renderAboutSections(data.about);
      if (detailPage) {
        const requestedId = detailPage.dataset.pluginKey;
        const plugin = data.plugins.find(item => item.id === requestedId);
        if (!plugin) {
          detailPage.innerHTML = '<section class="plugin-detail"><div class="container"><p>Plugin not found.</p><a href="/plugins.html">Browse all plugins</a></div></section>';
          return;
        }
        const current = await getCurrentPluginData(plugin);
        renderPluginDetail(current);
      }
    } catch (error) {
      console.error('Unable to render page content:', error);
      if (detailPage) detailPage.innerHTML = '<section class="plugin-detail"><div class="container"><p>Plugin information could not be loaded. Please try again later.</p></div></section>';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootPageContent, { once: true });
  } else {
    bootPageContent();
  }
})();
