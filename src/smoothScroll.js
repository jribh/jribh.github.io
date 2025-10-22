import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Custom Smooth Scrolling Implementation
 * Lightweight smooth scrolling with ScrollTrigger integration
 */

class SmoothScroll {
  constructor() {
    this.scrollTarget = 0;
    this.scrollCurrent = 0;
    this.ease = 0.18; // Increased for faster response and less inertia
    this.isRunning = false;
    this.rafId = null;
    this.content = null;
    this.velocity = 0;
    this.lastScrollTarget = 0;
    this.isTouchDevice = this.detectTouchDevice();
    // One-way snap state
    this.section2Top = 0; // computed after DOM ready
    this.isAutoSnapping = false; // guard while animating snap
    this.init();
  }

  detectTouchDevice() {
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      navigator.msMaxTouchPoints > 0
    );
  }

  init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  setup() {
    this.content = document.getElementById('content');
    if (!this.content) return;
    
    // Skip smooth scroll setup on touch devices
    if (this.isTouchDevice) {
      console.log('Touch device detected - smooth scrolling disabled');
      // Set scrollCurrent to 0 for compatibility with other scripts
      this.scrollCurrent = 0;
      
      // Update scrollCurrent on native scroll for touch devices
      window.addEventListener('scroll', () => {
        this.scrollCurrent = window.scrollY;
      }, { passive: true });

      // Still handle anchor links with custom animated scroll to avoid instant jumps
      this.setupAnchorLinks();
      
      return;
    }
    
    // Get initial scroll position
    this.scrollTarget = window.scrollY || 0;
    this.scrollCurrent = this.scrollTarget;

    // Compute section 2 offset for one-way snapping
    this.computeSection2Top = () => {
      const sec2 = document.querySelector('.content-section[data-section="2"]');
      // Fallback to viewport height if not found (section 1 is 100vh)
      this.section2Top = sec2 ? sec2.offsetTop : window.innerHeight;
    };
    this.computeSection2Top();
    
    // Set up smooth scroll container
    document.body.style.position = 'fixed';
    document.body.style.top = '0';
    document.body.style.left = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    
    // Create a fake scrollbar container
    this.scrollbarContainer = document.createElement('div');
    this.scrollbarContainer.id = 'smooth-scroll-scrollbar';
    this.scrollbarContainer.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 20px;
      height: 100vh;
      overflow-y: scroll;
      overflow-x: hidden;
      z-index: 9999;
      pointer-events: auto;
    `;
    
    // Create inner content for scrollbar (needs to be taller to create scrollbar)
    this.scrollbarInner = document.createElement('div');
    this.scrollbarInner.id = 'smooth-scroll-scrollbar-inner';
    this.scrollbarInner.style.cssText = `
      width: 1px;
      height: ${this.content.scrollHeight}px;
      pointer-events: none;
    `;
    
    this.scrollbarContainer.appendChild(this.scrollbarInner);
    document.body.appendChild(this.scrollbarContainer);
    
    // Prevent wheel events on scrollbar - pass through to main scroll handler
    this.scrollbarContainer.addEventListener('wheel', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Manually trigger the main wheel handler
      this.onWheel(e);
    }, { passive: false });
    
    // Track if user is dragging the scrollbar thumb
    this.isScrollbarScrolling = false;
    this.scrollbarContainer.addEventListener('mousedown', () => {
      this.isScrollbarScrolling = true;
    }, { passive: true });
    
    document.addEventListener('mouseup', () => {
      this.isScrollbarScrolling = false;
    }, { passive: true });
    
    // Listen to scrollbar scroll events (for dragging the thumb)
    this.scrollbarContainer.addEventListener('scroll', (e) => {
      if (this.isScrollbarScrolling) {
        this.scrollTarget = this.scrollbarContainer.scrollTop;
      }
    }, { passive: true });
    
    // Update scrollbar height on resize
    this.updateScrollbarHeight = () => {
      if (this.scrollbarInner && this.content) {
        this.scrollbarInner.style.height = `${this.content.scrollHeight}px`;
      }
    };
    
    // Listen for wheel events
  window.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
    
    // Listen for touchpad/touch events
    window.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: true });
    window.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    window.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: true });
    
    // Configure ScrollTrigger to work with smooth scroll
    ScrollTrigger.defaults({
      scroller: this.content
    });
    
    // Update ScrollTrigger's scroll position manually
    ScrollTrigger.scrollerProxy(this.content, {
      scrollTop: (value) => {
        if (arguments.length) {
          this.scrollTarget = value;
          this.scrollCurrent = value;
        }
        return this.scrollCurrent;
      },
      getBoundingClientRect() {
        return {
          top: 0,
          left: 0,
          width: window.innerWidth,
          height: window.innerHeight
        };
      }
    });
    
    // Start animation loop
    this.start();
    
    // Handle anchor links
    this.setupAnchorLinks();
    
    // Refresh ScrollTrigger on resize
    window.addEventListener('resize', () => {
      // Recompute section 2 top in case viewport height/layout changed
      this.computeSection2Top();
      this.updateScrollbarHeight();
      ScrollTrigger.refresh();
    });
  }

  onWheel(e) {
    e.preventDefault();
    
    // Normalize wheel delta across browsers
    let delta = e.deltaY;
    
    // Multiplier for scroll speed
    const wheelMultiplier = 1.0;
    delta *= wheelMultiplier;

    // One-way snap: if user scrolls down while within Section 1, snap to Section 2
    // Conditions:
    // - Not already auto-snapping
    // - Downward scroll (delta > 0)
    // - Current and target are both within Section 1 range (< section2Top)
    if (!this.isAutoSnapping && delta > 0 && this.scrollCurrent < this.section2Top && this.scrollTarget < this.section2Top) {
      this.isAutoSnapping = true;
      // Animate to Section 2 top and release guard when done
      this.scrollTo(this.section2Top, 700, () => {
        this.isAutoSnapping = false;
      });
      return; // Skip default wheel handling
    }

    if (this.isAutoSnapping) {
      // Ignore wheel input during snap animation
      return;
    }

    this.scrollTarget += delta;
    
    // Clamp scroll target
    const maxScroll = this.content.scrollHeight - window.innerHeight;
    this.scrollTarget = Math.max(0, Math.min(this.scrollTarget, maxScroll));
  }

  touchStartY = 0;
  touchLastY = 0;

  onTouchStart(e) {
    this.touchStartY = e.touches[0].clientY;
    this.touchLastY = this.touchStartY;
  }

  onTouchMove(e) {
    if (!e.touches[0]) return;
    
    const touchY = e.touches[0].clientY;
    const delta = this.touchLastY - touchY;
    this.touchLastY = touchY;
    
    this.scrollTarget += delta * 2;
    
    // Clamp scroll target
    const maxScroll = this.content.scrollHeight - window.innerHeight;
    this.scrollTarget = Math.max(0, Math.min(this.scrollTarget, maxScroll));
  }

  onTouchEnd(e) {
    this.touchStartY = 0;
    this.touchLastY = 0;
  }

  onScroll() {
    if (!this.content) return;
    
    // Calculate the difference
    const diff = this.scrollTarget - this.scrollCurrent;
    
    // Apply damping with velocity tracking for natural deceleration
    this.velocity = diff * this.ease;
    this.scrollCurrent += this.velocity;
    
    // Stop animating when very close to target (prevents infinite small movements)
    if (Math.abs(diff) < 0.1) {
      this.scrollCurrent = this.scrollTarget;
    }
    
    // Round to avoid sub-pixel jitter
    const rounded = Math.round(this.scrollCurrent * 100) / 100;
    
    // Apply transform with GPU acceleration
    this.content.style.transform = `translate3d(0, -${rounded}px, 0)`;
    
    // Sync scrollbar position with smooth scroll (but not when user is actively scrolling it)
    if (this.scrollbarContainer && !this.isScrollbarScrolling && Math.abs(this.scrollbarContainer.scrollTop - rounded) > 1) {
      this.scrollbarContainer.scrollTop = rounded;
    }
    
    // Update ScrollTrigger with current scroll position
    ScrollTrigger.update();
    
    // Continue animation loop
    if (this.isRunning) {
      this.rafId = requestAnimationFrame(() => this.onScroll());
    }
  }

  setupAnchorLinks() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        const href = anchor.getAttribute('href');
        if (href === '#' || href === '') return;
        
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          const targetTop = target.offsetTop;
          
          // Use custom smooth animation for both touch and non-touch devices
          if (this.isTouchDevice) {
            // Animated scroll for touch devices
            this.animateScrollTo(targetTop, 1000);
          } else {
            // Custom smooth scroll for desktop
            this.scrollTo(targetTop);
          }
        }
      });
    });
  }

  // Custom animated scroll that works on touch devices
  animateScrollTo(target, duration = 1000) {
    const start = window.scrollY;
    const distance = target - start;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation (ease-in-out cubic)
      const easeProgress = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      
      const currentPosition = start + (distance * easeProgress);
      window.scrollTo(0, currentPosition);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }

  // Global handler to intercept anchor clicks early on touch devices
  // Guards against default hash navigation before our per-anchor listeners attach
  static installGlobalAnchorInterceptor(instance) {
    if (!instance || !instance.isTouchDevice) return;
    if (window.__anchorInterceptorInstalled) return;
    window.__anchorInterceptorInstalled = true;

    document.addEventListener('click', (e) => {
      const link = e.target.closest && e.target.closest('a[href^="#"]');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href || href === '#') return;

      const target = document.querySelector(href);
      if (!target) return;

      // Prevent default jump and route through our animator
      e.preventDefault();
      const targetTop = target.offsetTop;
      instance.animateScrollTo(targetTop, 1000);
    }, true); // capture to intercept before default
  }

  scrollTo(target, duration = 1000, onComplete) {
    // Smoothly animate to target position
    const start = this.scrollTarget;
    const distance = target - start;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation (ease-in-out)
      const easeProgress = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      
      this.scrollTarget = start + (distance * easeProgress);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        if (typeof onComplete === 'function') onComplete();
      }
    };
    
    requestAnimationFrame(animate);
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.onScroll();
  }

  stop() {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
  }

  destroy() {
    this.stop();
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    
    if (this.content) {
      this.content.style.transform = '';
    }
    
    if (this.scrollbarContainer) {
      this.scrollbarContainer.remove();
      this.scrollbarContainer = null;
      this.scrollbarInner = null;
    }
    
    ScrollTrigger.scrollerProxy(this.content, null);
  }
}

// Initialize smooth scroll
const smoothScroll = new SmoothScroll();

// Expose for debugging
window.smoothScroll = smoothScroll;

export default smoothScroll;
