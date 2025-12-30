// Krystal Dynamics - Enhanced Interactive JavaScript

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

// Enhanced Carousel with Parallax
function initCarousel() {
    const carouselContainer = document.getElementById('carouselContainer');
    const carouselDots = document.getElementById('carouselDots');

    if (!carouselContainer || !carouselDots) return;

    const images = [
        'assets/images/k-field-interface.png',
        'assets/images/k-clip-interface.png',
        'assets/images/k-comp-interface.png'
    ];

    let currentSlide = 0;
    let carouselInterval;
    let isTransitioning = false;

    // Create slides with preload
    images.forEach((src, index) => {
        const img = document.createElement('img');
        img.src = src;
        img.alt = `Plugin ${index + 1}`;
        img.className = `carousel-slide ${index === 0 ? 'active' : ''}`;
        img.loading = 'lazy';
        carouselContainer.appendChild(img);
    });

    // Create dots
    images.forEach((_, index) => {
        const dot = document.createElement('button');
        dot.className = `carousel-dot ${index === 0 ? 'active' : ''}`;
        dot.setAttribute('aria-label', `Go to slide ${index + 1}`);
        dot.addEventListener('click', () => goToSlide(index));
        carouselDots.appendChild(dot);
    });

    function goToSlide(index) {
        if (isTransitioning || index === currentSlide) return;
        isTransitioning = true;

        const slides = carouselContainer.querySelectorAll('.carousel-slide');
        const dots = carouselDots.querySelectorAll('.carousel-dot');

        slides[currentSlide].classList.remove('active');
        dots[currentSlide].classList.remove('active');

        currentSlide = index;

        slides[currentSlide].classList.add('active');
        dots[currentSlide].classList.add('active');

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

// Smooth Scroll with Offset - DISABLED for smoother native scrolling
function initSmoothScroll() {
    // Smooth scroll disabled to improve performance
    // Native browser scrolling is used instead
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

// Parallax Effect - DISABLED for smoother scrolling
function initParallax() {
    // Parallax disabled to improve scroll performance
}

// Button Hover Effects
function initButtonEffects() {
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('mouseenter', function (e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            this.style.setProperty('--mouse-x', `${x}px`);
            this.style.setProperty('--mouse-y', `${y}px`);
        });

        btn.addEventListener('click', function (e) {
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

// Cursor Trail Effect (Optional - can be enabled/disabled)
function initCursorTrail() {
    let trails = [];
    const maxTrails = 20;

    document.addEventListener('mousemove', (e) => {
        if (window.innerWidth < 768) return; // Disable on mobile

        const trail = document.createElement('div');
        trail.className = 'cursor-trail';
        trail.style.cssText = `
      position: fixed;
      width: 8px;
      height: 8px;
      background: var(--accent-primary);
      border-radius: 50%;
      pointer-events: none;
      z-index: 9999;
      opacity: 0.5;
      left: ${e.clientX}px;
      top: ${e.clientY}px;
      transform: translate(-50%, -50%);
      animation: trail-fade 0.5s ease-out forwards;
    `;

        document.body.appendChild(trail);
        trails.push(trail);

        if (trails.length > maxTrails) {
            const oldTrail = trails.shift();
            oldTrail.remove();
        }

        setTimeout(() => trail.remove(), 500);
    });

    const trailStyle = document.createElement('style');
    trailStyle.textContent = `
    @keyframes trail-fade {
      to {
        opacity: 0;
        transform: translate(-50%, -50%) scale(2);
      }
    }
  `;
    document.head.appendChild(trailStyle);
}

// Plugin Specs Animation - DISABLED
function initSpecsAnimation() {
    // Animation disabled for cleaner experience
}

// Download Button Analytics (placeholder for tracking)
function initDownloadTracking() {
    document.querySelectorAll('.download-section a').forEach(link => {
        link.addEventListener('click', function (e) {
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
    initTheme();
    initCarousel();
    initSmoothScroll();
    initScrollAnimations();
    initButtonEffects();
    initImageLoading();
    initDownloadTracking();
    initEasterEgg();

    console.log('✨ Krystal Dynamics - Loaded');
});