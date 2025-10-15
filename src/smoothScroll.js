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
      
      return;
    }
    
    // Get initial scroll position
    this.scrollTarget = window.scrollY || 0;
    this.scrollCurrent = this.scrollTarget;
    
    // Set up smooth scroll container
    document.body.style.position = 'fixed';
    document.body.style.top = '0';
    document.body.style.left = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    
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
          // For touch devices, use native scrolling
          if (this.isTouchDevice) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            // For smooth scroll, calculate target position relative to content container
            const targetTop = target.offsetTop;
            this.scrollTo(targetTop);
          }
        }
      });
    });
  }

  scrollTo(target, duration = 1000) {
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
    
    ScrollTrigger.scrollerProxy(this.content, null);
  }
}

// Initialize smooth scroll
const smoothScroll = new SmoothScroll();

// Expose for debugging
window.smoothScroll = smoothScroll;

export default smoothScroll;
