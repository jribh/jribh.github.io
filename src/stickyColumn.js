/**
 * Custom Sticky Column Handler for Smooth Scroll
 * Implements sticky behavior for enterprise-left column
 * since position: sticky doesn't work with transform-based scrolling
 */

class StickyColumn {
  constructor() {
    this.stickyElement = null;
    this.stickyParent = null;
    this.isActive = false;
    this.topOffset = 0;
    this.init();
  }

  init() {
    // Wait for DOM and smooth scroll to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      // Small delay to ensure smooth scroll is initialized
      setTimeout(() => this.setup(), 100);
    }
  }

  setup() {
    this.stickyElement = document.querySelector('.enterprise-left');
    if (!this.stickyElement) {
      console.warn('Sticky element (.enterprise-left) not found');
      return;
    }

    // Find the parent section
    this.stickyParent = this.stickyElement.closest('.content-section');
    if (!this.stickyParent) {
      console.warn('Parent section not found');
      return;
    }

    // Check if touch device or mobile screen size
    const isTouchDevice = ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const isMobile = window.innerWidth <= 1024;
    
    // Disable sticky on touch devices or mobile screens
    if (isTouchDevice || isMobile) {
      console.log('Touch device or mobile detected - sticky column disabled');
      return;
    }

    this.topOffset = window.innerHeight * 0.01; // 4.5vh - closer to top

    // Remove CSS sticky positioning since we're handling it manually
    this.stickyElement.style.position = 'relative';
    this.stickyElement.style.top = '0';

    // Start monitoring
    this.start();
  }

  updatePosition() {
    if (!this.stickyElement || !this.stickyParent || !window.smoothScroll) return;

    const scrollY = window.smoothScroll.scrollCurrent;
    
    // Get section boundaries
    const sectionTop = this.stickyParent.offsetTop;
    const sectionBottom = sectionTop + this.stickyParent.offsetHeight;
    const stickyHeight = this.stickyElement.offsetHeight;
    
    // Calculate the sticky position
    const viewportTop = scrollY;
    const viewportBottom = scrollY + window.innerHeight;
    
    // When to start sticking (section enters viewport)
    const stickStart = sectionTop - this.topOffset;
    
    // When to stop sticking (bottom of sticky element reaches bottom of section)
    const stickEnd = sectionBottom - stickyHeight - this.topOffset;
    
    if (scrollY >= stickStart && scrollY <= stickEnd) {
      // Stick to viewport
      const translateY = scrollY - sectionTop + this.topOffset;
      this.stickyElement.style.transform = `translate3d(0, ${translateY}px, 0)`;
      this.stickyElement.style.willChange = 'transform';
    } else if (scrollY > stickEnd) {
      // Pin to bottom of section
      const translateY = sectionBottom - sectionTop - stickyHeight;
      this.stickyElement.style.transform = `translate3d(0, ${translateY}px, 0)`;
      this.stickyElement.style.willChange = 'transform';
    } else {
      // Reset to natural position
      this.stickyElement.style.transform = 'translate3d(0, 0, 0)';
      this.stickyElement.style.willChange = 'auto';
    }
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;
    this.animate();
  }

  animate() {
    if (!this.isActive) return;
    this.updatePosition();
    requestAnimationFrame(() => this.animate());
  }

  stop() {
    this.isActive = false;
  }

  destroy() {
    this.stop();
    if (this.stickyElement) {
      this.stickyElement.style.position = '';
      this.stickyElement.style.top = '';
      this.stickyElement.style.transform = '';
      this.stickyElement.style.willChange = '';
    }
  }
}

// Initialize sticky column
const stickyColumn = new StickyColumn();

// Expose for debugging
window.stickyColumn = stickyColumn;

export default stickyColumn;
