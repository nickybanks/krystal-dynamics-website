// ─── Collapsible Component ───────────────────────────────────────────────────
function initCollapsibles() {
  const collapsibles = document.querySelectorAll('.collapsible');
  
  collapsibles.forEach(collapsible => {
    const header = collapsible.querySelector('.collapsible__header');
    const content = collapsible.querySelector('.collapsible__content');
    
    if (!header || !content) return;
    
    // Set initial max-height for open state
    if (collapsible.classList.contains('is-open')) {
      content.style.maxHeight = content.scrollHeight + 'px';
    }
    
    header.addEventListener('click', () => {
      const isOpen = collapsible.classList.contains('is-open');
      
      if (isOpen) {
        // Close
        content.style.maxHeight = '0';
        collapsible.classList.remove('is-open');
      } else {
        // Open
        content.style.maxHeight = content.scrollHeight + 'px';
        collapsible.classList.add('is-open');
      }
    });
    
    // Recalculate height on window resize
    window.addEventListener('resize', () => {
      if (collapsible.classList.contains('is-open')) {
        content.style.maxHeight = content.scrollHeight + 'px';
      }
    });
  });
}

// ─── Tabs Component ──────────────────────────────────────────────────────────
function initTabs() {
  const tabContainers = document.querySelectorAll('.tabs');
  
  tabContainers.forEach(container => {
    const buttons = container.querySelectorAll('.tabs__button');
    const panels = document.querySelectorAll('.tabs__panel');
    
    buttons.forEach(button => {
      button.addEventListener('click', () => {
        const targetId = button.getAttribute('data-tab');
        
        // Remove active from all buttons and panels
        buttons.forEach(btn => btn.classList.remove('tabs__button--active'));
        panels.forEach(panel => panel.classList.remove('tabs__panel--active'));
        
        // Add active to clicked button and corresponding panel
        button.classList.add('tabs__button--active');
        const targetPanel = document.getElementById(targetId);
        if (targetPanel) {
          targetPanel.classList.add('tabs__panel--active');
        }
      });
    });
  });
}

// ─── Accordion (Only One Open) ───────────────────────────────────────────────
function initAccordion(containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  
  const collapsibles = container.querySelectorAll('.collapsible');
  
  collapsibles.forEach(collapsible => {
    const header = collapsible.querySelector('.collapsible__header');
    const content = collapsible.querySelector('.collapsible__content');
    
    if (!header || !content) return;
    
    header.addEventListener('click', () => {
      const isOpen = collapsible.classList.contains('is-open');
      
      // Close all others
      collapsibles.forEach(other => {
        const otherContent = other.querySelector('.collapsible__content');
        if (other !== collapsible) {
          other.classList.remove('is-open');
          if (otherContent) otherContent.style.maxHeight = '0';
        }
      });
      
      // Toggle current
      if (!isOpen) {
        collapsible.classList.add('is-open');
        content.style.maxHeight = content.scrollHeight + 'px';
      }
    });
  });
}

// ─── Smooth Reveal on Scroll ─────────────────────────────────────────────────
function initScrollReveal() {
  const reveals = document.querySelectorAll('.fade-in:not(.revealed)');
  
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });
  
  reveals.forEach(element => observer.observe(element));
}

// ─── Stagger Animation ───────────────────────────────────────────────────────
function addStaggerAnimation(selector, baseDelay = 100) {
  const elements = document.querySelectorAll(selector);
  
  elements.forEach((element, index) => {
    element.style.animationDelay = `${index * baseDelay}ms`;
  });
}

// ─── Copy to Clipboard ───────────────────────────────────────────────────────
function initCopyButtons() {
  const copyButtons = document.querySelectorAll('[data-copy]');
  
  copyButtons.forEach(button => {
    button.addEventListener('click', async () => {
      const textToCopy = button.getAttribute('data-copy');
      
      try {
        await navigator.clipboard.writeText(textToCopy);
        
        // Visual feedback
        const originalText = button.textContent;
        button.textContent = '✓ Copied!';
        button.classList.add('badge--success');
        
        setTimeout(() => {
          button.textContent = originalText;
          button.classList.remove('badge--success');
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    });
  });
}

// ─── Tooltip Component ───────────────────────────────────────────────────────
function initTooltips() {
  const tooltips = document.querySelectorAll('[data-tooltip]');
  
  tooltips.forEach(element => {
    const tooltipText = element.getAttribute('data-tooltip');
    
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = tooltipText;
    tooltip.style.cssText = `
      position: absolute;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      font-size: 0.875rem;
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease, transform 0.2s ease;
      z-index: 100;
      box-shadow: 0 4px 12px var(--shadow);
    `;
    
    document.body.appendChild(tooltip);
    
    element.addEventListener('mouseenter', (e) => {
      const rect = element.getBoundingClientRect();
      tooltip.style.left = `${rect.left + rect.width / 2}px`;
      tooltip.style.top = `${rect.top - 10}px`;
      tooltip.style.transform = 'translate(-50%, -100%)';
      tooltip.style.opacity = '1';
    });
    
    element.addEventListener('mouseleave', () => {
      tooltip.style.opacity = '0';
    });
  });
}

// ─── Modal Component ─────────────────────────────────────────────────────────
function initModals() {
  const modalTriggers = document.querySelectorAll('[data-modal]');
  
  modalTriggers.forEach(trigger => {
    trigger.addEventListener('click', () => {
      const modalId = trigger.getAttribute('data-modal');
      const modal = document.getElementById(modalId);
      
      if (modal) {
        modal.classList.add('is-open');
        document.body.style.overflow = 'hidden';
      }
    });
  });
  
  const modalCloses = document.querySelectorAll('.modal__close, .modal__overlay');
  
  modalCloses.forEach(closeBtn => {
    closeBtn.addEventListener('click', () => {
      const modal = closeBtn.closest('.modal');
      if (modal) {
        modal.classList.remove('is-open');
        document.body.style.overflow = '';
      }
    });
  });
  
  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const openModal = document.querySelector('.modal.is-open');
      if (openModal) {
        openModal.classList.remove('is-open');
        document.body.style.overflow = '';
      }
    }
  });
}

// ─── Lazy Load Images ────────────────────────────────────────────────────────
function initLazyLoad() {
  const images = document.querySelectorAll('img[data-src]');
  
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.getAttribute('data-src');
        img.removeAttribute('data-src');
        observer.unobserve(img);
      }
    });
  });
  
  images.forEach(img => imageObserver.observe(img));
}

// ─── Auto-init All Components ───────────────────────────────────────────────
function initAllComponents() {
  initCollapsibles();
  initTabs();
  initScrollReveal();
  initCopyButtons();
  initTooltips();
  initModals();
  initLazyLoad();
  
  console.log('✓ All components initialized');
}

// Auto-run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAllComponents);
} else {
  initAllComponents();
}

// Export for manual use
window.KrystalComponents = {
  initCollapsibles,
  initTabs,
  initAccordion,
  initScrollReveal,
  addStaggerAnimation,
  initCopyButtons,
  initTooltips,
  initModals,
  initLazyLoad
};