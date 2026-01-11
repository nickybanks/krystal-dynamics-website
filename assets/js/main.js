// Krystal Dynamics - JavaScript

// Load header and footer
async function loadComponent(id, url) {
    try {
        const response = await fetch(url);
        const html = await response.text();
        document.getElementById(id).innerHTML = html;
    } catch (error) {
        console.error('Error loading component:', error);
    }
}

// Load components on page load and initialize theme after header loads
async function loadComponents() {
    await loadComponent('header', '/assets/includes/header.html');
    await loadComponent('footer', '/assets/includes/footer.html');
    // Initialize theme AFTER header is loaded
    initTheme();
}

loadComponents();

// Theme Management with Smooth Transition
function initTheme() {
  const themeToggle = document.getElementById('themeToggle');
  
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);

  themeToggle?.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Add ripple effect
    createRipple(themeToggle);
  });
}

// Ripple Effect for Buttons
function createRipple(element) {
  const ripple = document.createElement('span');
  const rect = element.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = rect.width / 2;
  const y = rect.height / 2;
  
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${x - size / 2}px`;
  ripple.style.top = `${y - size / 2}px`;
  ripple.style.position = 'absolute';
  ripple.style.borderRadius = '50%';
  ripple.style.background = 'rgba(255, 255, 255, 0.6)';
  ripple.style.transform = 'scale(0)';
  ripple.style.animation = 'ripple-animation 0.6s ease-out';
  ripple.style.pointerEvents = 'none';
  
  element.appendChild(ripple);
  
  setTimeout(() => ripple.remove(), 600);
}

// Add ripple animation CSS
const style = document.createElement('style');
style.textContent = `
  @keyframes ripple-animation {
    to {
      transform: scale(4);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Hero Carousel with Parallax
function initCarousel() {
  const carouselContainer = document.getElementById('carouselContainer');
  
  if (!carouselContainer) return;

  const images = [
    'assets/images/k-field-interface.png',
    'assets/images/k-clip-interface.png',
    'assets/images/k-comp-interface.png'
  ];

  let currentSlide = 0;
  let carouselInterval;
  let isTransitioning = false;

  // Create slides - first one gets fetchpriority="high", no lazy loading
  images.forEach((src, index) => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = `Plugin ${index + 1}`;
    img.className = `carousel-slide ${index === 0 ? 'active' : ''}`;
    
    // First image: high priority, no lazy loading
    if (index === 0) {
      img.fetchPriority = 'high';
    } else {
      // Other carousel images: lazy load
      img.loading = 'lazy';
    }
    
    carouselContainer.appendChild(img);
  });

  function goToSlide(index) {
    if (isTransitioning || index === currentSlide) return;
    isTransitioning = true;
    
    const slides = carouselContainer.querySelectorAll('.carousel-slide');
    
    slides[currentSlide].classList.remove('active');
    
    currentSlide = index;
    
    slides[currentSlide].classList.add('active');
    
    resetCarouselInterval();
    
    setTimeout(() => {
      isTransitioning = false;
    }, 1500);
  }

  function nextSlide() {
    const nextIndex = (currentSlide + 1) % images.length;
    goToSlide(nextIndex);
  }

  function startCarousel() {
    carouselInterval = setInterval(nextSlide, 5000);
  }

  function resetCarouselInterval() {
    clearInterval(carouselInterval);
    startCarousel();
  }

  startCarousel();

  carouselContainer.addEventListener('mouseenter', () => {
    clearInterval(carouselInterval);
  });

  carouselContainer.addEventListener('mouseleave', startCarousel);

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      const prevIndex = (currentSlide - 1 + images.length) % images.length;
      goToSlide(prevIndex);
    } else if (e.key === 'ArrowRight') {
      nextSlide();
    }
  });
}

// Plugin Detail Page Image Carousel - NEW
function initPluginDetailCarousel() {
  const carouselContainer = document.querySelector('.plugin-detail-image-carousel');
  
  if (!carouselContainer) return;

  const imagesData = carouselContainer.getAttribute('data-images');
  if (!imagesData) return;

  let images;
  try {
    images = JSON.parse(imagesData);
  } catch (e) {
    console.error('Error parsing carousel images:', e);
    return;
  }

  if (!images || images.length === 0) return;

  let currentSlide = 0;
  let carouselInterval;

  // Create image elements
  images.forEach((src, index) => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = `Plugin interface ${index + 1}`;
    if (index === 0) {
      img.classList.add('active');
    }
    carouselContainer.appendChild(img);
  });

  // Only start carousel if there's more than one image
  if (images.length > 1) {
    function nextSlide() {
      const carouselImages = carouselContainer.querySelectorAll('img');
      
      // Remove active class from current image
      carouselImages[currentSlide].classList.remove('active');
      
      // Move to next slide
      currentSlide = (currentSlide + 1) % images.length;
      
      // Add active class to new current image
      carouselImages[currentSlide].classList.add('active');
    }

    function startCarousel() {
      carouselInterval = setInterval(nextSlide, 4000); // Change every 4 seconds
    }

    function stopCarousel() {
      clearInterval(carouselInterval);
    }

    // Start the carousel
    startCarousel();

    // Pause on hover
    carouselContainer.addEventListener('mouseenter', stopCarousel);
    carouselContainer.addEventListener('mouseleave', startCarousel);
  }
}

// Scroll Animations - SIMPLIFIED for better performance
function initScrollAnimations() {
  const observerOptions = {
    root: null,
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Observe only plugin images and content
  document.querySelectorAll('.plugin-image, .plugin-content').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
  });
}

// Header Scroll Effect
function initHeaderScroll() {
  const header = document.querySelector('header');
  let lastScroll = 0;
  
  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
    
    lastScroll = currentScroll;
  });
}

// Button Hover Effects
function initButtonEffects() {
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('mouseenter', function(e) {
      const rect = this.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      this.style.setProperty('--mouse-x', `${x}px`);
      this.style.setProperty('--mouse-y', `${y}px`);
    });
    
    btn.addEventListener('click', function(e) {
      createRipple(this);
    });
  });
}

// Image Lazy Loading Enhancement
function initImageLoading() {
  const images = document.querySelectorAll('img[loading="lazy"]');
  
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.classList.add('loading');
          
          img.addEventListener('load', () => {
            img.classList.remove('loading');
            img.style.animation = 'fadeIn 0.5s ease-out';
          });
          
          imageObserver.unobserve(img);
        }
      });
    });
    
    images.forEach(img => imageObserver.observe(img));
  }
}

// Download Button Analytics (placeholder for tracking)
function initDownloadTracking() {
  document.querySelectorAll('.download-section a').forEach(link => {
    link.addEventListener('click', function(e) {
      const pluginName = this.closest('.plugin-detail')?.querySelector('h2')?.textContent || 'Unknown';
      const platform = this.textContent.includes('Windows') ? 'Windows' : 'macOS';
      
      console.log(`Download tracked: ${pluginName} - ${platform}`);
      // Add your analytics code here
    });
  });
}

// Easter Egg - Konami Code
function initEasterEgg() {
  const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let konamiIndex = 0;
  
  document.addEventListener('keydown', (e) => {
    if (e.key === konamiCode[konamiIndex]) {
      konamiIndex++;
      if (konamiIndex === konamiCode.length) {
        activateEasterEgg();
        konamiIndex = 0;
      }
    } else {
      konamiIndex = 0;
    }
  });
}

function activateEasterEgg() {
  document.body.style.animation = 'rainbow 2s linear infinite';
  
  const rainbowStyle = document.createElement('style');
  rainbowStyle.textContent = `
    @keyframes rainbow {
      0% { filter: hue-rotate(0deg); }
      100% { filter: hue-rotate(360deg); }
    }
  `;
  document.head.appendChild(rainbowStyle);
  
  setTimeout(() => {
    document.body.style.animation = '';
    rainbowStyle.remove();
  }, 5000);
  
  console.log('🎉 Easter egg activated!');
}

// Performance Optimization - Simplified
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Simplified Scroll Handler
window.addEventListener('scroll', debounce(() => {
  const header = document.querySelector('header');
  const currentScroll = window.pageYOffset;
  
  if (currentScroll > 50) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
}, 10), { passive: true });

// Initialize Everything
document.addEventListener('DOMContentLoaded', () => {
  initCarousel();
  initPluginDetailCarousel();
  initScrollAnimations();
  initButtonEffects();
  initImageLoading();
  initDownloadTracking();
  initEasterEgg();
  
  console.log('Krystal Dynamics - Loaded');
});
