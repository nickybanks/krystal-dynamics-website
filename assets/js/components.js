function initCollapsibles() {
  document.querySelectorAll('.collapsible').forEach(collapsible => {
    const header = collapsible.querySelector('.collapsible__header');
    const content = collapsible.querySelector('.collapsible__content');
    if (!header || !content) return;

    header.setAttribute('aria-expanded', String(collapsible.classList.contains('is-open')));

    if (collapsible.classList.contains('is-open')) {
      content.style.maxHeight = `${content.scrollHeight}px`;
    }

    const toggle = () => {
      const isOpen = collapsible.classList.toggle('is-open');
      header.setAttribute('aria-expanded', String(isOpen));
      content.style.maxHeight = isOpen ? `${content.scrollHeight}px` : '0';
    };

    header.addEventListener('click', toggle);

    window.addEventListener('resize', () => {
      if (collapsible.classList.contains('is-open')) {
        content.style.maxHeight = `${content.scrollHeight}px`;
      }
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCollapsibles);
} else {
  initCollapsibles();
}
