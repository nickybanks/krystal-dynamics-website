// Krystal Dynamics - Main JavaScript
// Unified Version

// Theme Management
function initTheme() {
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = themeToggle?.querySelector('.theme-icon');
  
  // Load saved theme or default to light
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme, themeIcon);

  // Theme toggle handler
  themeToggle?.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme, themeIcon);
  });
}

function updateThemeIcon(theme, iconElement) {
  // Icons are managed via CSS visibility
}

// Carousel Management
function initCarousel() {
  const carouselContainer = document.getElementById('carouselContainer');
  const carouselDots = document.getElementById('carouselDots');
  
  if (!carouselContainer || !carouselDots) return;

  // Plugin images for carousel
  const images = [
      'assets/images/k-field-interface.png',
      'assets/images/k-clip-interface.png',
      'assets/images/k-comp-interface.png'
  ];

  let currentSlide = 0;
  let carouselInterval;

  // Create slides
  images.forEach((src, index) => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = `Plugin ${index + 1}`;
    img.className = `carousel-slide ${index === 0 ? 'active' : ''}`;
    carouselContainer.appendChild(img);
  });

  // Create dots
  images.forEach((_, index) => {
    const dot = document.createElement('div');
    dot.className = `carousel-dot ${index === 0 ? 'active' : ''}`;
    dot.addEventListener('click', () => goToSlide(index));
    carouselDots.appendChild(dot);
  });

  function goToSlide(index) {
    const slides = carouselContainer.querySelectorAll('.carousel-slide');
    const dots = carouselDots.querySelectorAll('.carousel-dot');
    
    slides[currentSlide].classList.remove('active');
    dots[currentSlide].classList.remove('active');
    
    currentSlide = index;
    
    slides[currentSlide].classList.add('active');
    dots[currentSlide].classList.add('active');
    
    resetCarouselInterval();
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

  // Start automatic carousel
  startCarousel();

  // Pause on hover
  carouselContainer.addEventListener('mouseenter', () => {
    clearInterval(carouselInterval);
  });

  carouselContainer.addEventListener('mouseleave', () => {
    startCarousel();
  });
}

// Smooth scroll for anchor links
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initCarousel();
  initSmoothScroll();
});