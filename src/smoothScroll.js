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
  this.snapAccumulatedDelta = 0; // accumulate wheel delta to add inertia before snap
  this.snapPendingTimeout = null; // allow short delay before triggering snap
  this.lastWheelTime = 0; // time of last wheel event for decay
  this.snapThresholdPx = 0; // dynamic threshold computed from viewport
    // Touch-specific snap suppression during programmatic scrolls (e.g., navbar clicks)
    this.touchDisableSnapUntil = 0;
    // Keyboard scrolling state
    this.keysPressed = new Set();
    this.keyScrollSpeed = 0;
    this.keyScrollRafId = null;
    this.init();
  }

  getNavigationType() {
    try {
      const nav = performance.getEntriesByType?.('navigation')?.[0];
      if (nav && typeof nav.type === 'string') return nav.type;
    } catch {}

    // Legacy fallback
    try {
      // 2 === TYPE_BACK_FORWARD
      if (performance?.navigation && typeof performance.navigation.type === 'number') {
        return performance.navigation.type === 2 ? 'back_forward' : 'navigate';
      }
    } catch {}

    return 'navigate';
  }

  persistHomeScrollPosition() {
    try {
      const y = this.isTouchDevice ? (window.scrollY || 0) : (this.scrollCurrent || 0);
      sessionStorage.setItem('__homeScrollY', String(Math.round(y)));
    } catch {}
  }

  restoreHomeScrollPositionIfNeeded() {
    // Only restore on back/forward navigations and only when home URL isn't
    // explicitly driving a scroll via project param/hash.
    const navType = this.getNavigationType();
    if (navType !== 'back_forward') return;

    const hasProjectKey = (() => {
      try {
        const qs = new URLSearchParams(window.location.search);
        if (qs.get('project')) return true;
        const hs = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
        return !!hs.get('project');
      } catch {
        return false;
      }
    })();
    if (hasProjectKey) return;

    let y = null;
    try {
      const raw = sessionStorage.getItem('__homeScrollY');
      if (raw != null && raw !== '') {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) y = parsed;
      }
    } catch {}
    if (y == null) return;

    // Clamp to max scroll so we don't overshoot if content height changed.
    const maxScroll = this.content ? Math.max(0, this.content.scrollHeight - window.innerHeight) : 0;
    y = Math.max(0, Math.min(y, maxScroll));

    this.scrollTarget = y;
    this.scrollCurrent = y;

    if (this.scrollbarContainer) this.scrollbarContainer.scrollTop = y;
    if (this.content) this.content.style.transform = `translate3d(0, -${Math.round(y * 100) / 100}px, 0)`;
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
      this.scrollCurrent = window.scrollY || 0;

      // Compute Section 2 top for snap assist
      this.computeSection2Top = () => {
        const sec2 = document.querySelector('.content-section[data-section="2"]');
        this.section2Top = sec2 ? sec2.offsetTop : window.innerHeight;
      };
      this.computeSection2Top();

      // Update scrollCurrent on native scroll for touch devices with inertia/elastic guards
      this.lastNativeScrollY = window.scrollY || 0;
      this.isAutoSnappingTouch = false;
      this.mobileSnapAccumulated = 0;
      this.mobileSnapPending = null;
      const onNativeScroll = () => {
        const y = window.scrollY || 0;
        const delta = y - this.lastNativeScrollY;
        this.lastNativeScrollY = y;
        this.scrollCurrent = y;

        // If we're currently doing a programmatic animated scroll (anchor/nav),
        // never run the Section-1 snap-assist.
        const snapAssistEnabled = performance.now() >= this.touchDisableSnapUntil;

        const withinSection1 = y < this.section2Top * 0.95;
        if (withinSection1 && snapAssistEnabled) {
          if (delta > 0) {
            // Ignore iOS elastic bounce from the top
            if (y < 12) return;
            this.mobileSnapAccumulated += delta;
            const threshold = this.snapThresholdPx || window.innerHeight * 0.14;
            if (!this.isAutoSnappingTouch && this.mobileSnapAccumulated >= threshold) {
              if (!this.mobileSnapPending) {
                this.mobileSnapPending = setTimeout(() => {
                  if (this.scrollCurrent < this.section2Top * 0.95) {
                    this.isAutoSnappingTouch = true;
                    this.animateScrollTo(this.section2Top, 750);
                    setTimeout(() => { this.isAutoSnappingTouch = false; }, 900);
                  }
                  this.mobileSnapPending = null;
                  this.mobileSnapAccumulated = 0;
                }, 100);
              }
            }
          } else if (delta < -6) {
            // User quickly scrolls up: cancel pending snap and reset accumulation
            this.mobileSnapAccumulated = 0;
            if (this.mobileSnapPending) {
              clearTimeout(this.mobileSnapPending);
              this.mobileSnapPending = null;
            }
          }
        } else if (!withinSection1) {
          // Reset once we leave Section 1
          this.mobileSnapAccumulated = 0;
          if (this.mobileSnapPending) {
            clearTimeout(this.mobileSnapPending);
            this.mobileSnapPending = null;
          }
        }
      };
      window.addEventListener('scroll', onNativeScroll, { passive: true });

      // Update on resize
      window.addEventListener('resize', () => {
        this.computeSection2Top();
      }, { passive: true });

      // Handle anchor links smoothly
      this.setupAnchorLinks();
      SmoothScroll.installGlobalAnchorInterceptor(this);
      return;
    }
    
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    
    // Get initial scroll position
    this.scrollTarget = window.scrollY || 0;
    this.scrollCurrent = this.scrollTarget;

    // Compute section 2 offset for one-way snapping
    this.computeSection2Top = () => {
      const sec2 = document.querySelector('.content-section[data-section="2"]');
      // Fallback to viewport height if not found (section 1 is 100vh)
      this.section2Top = sec2 ? sec2.offsetTop : window.innerHeight;
      // Recompute snap threshold: require user to scroll a fraction of viewport before snap engages
      // Using 14% of viewport height gives gentle inertia (tunable)
      this.snapThresholdPx = window.innerHeight * 0.14;
      // Clamp minimum threshold for very small viewports
      if (this.snapThresholdPx < 80) this.snapThresholdPx = 80;
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
    
    // Listen for keyboard events
    window.addEventListener('keydown', this.onKeyDown.bind(this), { passive: false });
    window.addEventListener('keyup', this.onKeyUp.bind(this), { passive: false });
    window.addEventListener('blur', this.onWindowBlur.bind(this), { passive: true });
    
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

    // Restore scroll position (e.g., when coming back from a project page)
    this.restoreHomeScrollPositionIfNeeded();

    // Persist scroll position when leaving the page (supports back/forward restore)
    window.addEventListener('pagehide', () => this.persistHomeScrollPosition(), { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.persistHomeScrollPosition();
    }, { passive: true });

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
    // When project overlay is open, allow native scrolling (don't hijack wheel).
    if (window.__projectOverlayOpen) return;

    e.preventDefault();
    
    // Normalize wheel delta across browsers
    let delta = e.deltaY;
    
    // Multiplier for scroll speed
    const wheelMultiplier = 1.0;
    delta *= wheelMultiplier;

    // Inertia-based snap logic for desktop (non-touch): accumulate intent before snapping to Section 2
    if (!this.isTouchDevice) {
      const now = performance.now();
      // Decay accumulation if time between wheel events is large (>250ms)
      if (now - this.lastWheelTime > 250) {
        this.snapAccumulatedDelta = 0;
      }
      this.lastWheelTime = now;

      const withinSection1 = this.scrollCurrent < this.section2Top && this.scrollTarget < this.section2Top;
      if (!this.isAutoSnapping && withinSection1 && delta > 0) {
        this.snapAccumulatedDelta += delta;
        // If user reverses direction (negative delta) clear accumulation
        if (delta < 0) this.snapAccumulatedDelta = 0;

        // If accumulated delta exceeds threshold, schedule snap with small delay allowing quick reversal cancel
        if (this.snapAccumulatedDelta >= this.snapThresholdPx) {
          // Prevent duplicate scheduling
          if (!this.snapPendingTimeout) {
            this.snapPendingTimeout = setTimeout(() => {
              // Re-check conditions before executing (user might have scrolled back up)
              if (!this.isAutoSnapping && this.scrollCurrent < this.section2Top * 0.95) {
                this.isAutoSnapping = true;
                this.scrollTo(this.section2Top, 700, () => {
                  this.isAutoSnapping = false;
                  this.snapAccumulatedDelta = 0;
                });
              }
              this.snapPendingTimeout = null;
            }, 80); // 80ms delay gives slight inertia window
          }
        }
      } else if (!withinSection1) {
        // Reset accumulation if user leaves Section 1
        this.snapAccumulatedDelta = 0;
        if (this.snapPendingTimeout) {
          clearTimeout(this.snapPendingTimeout);
          this.snapPendingTimeout = null;
        }
      }
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

  onKeyDown(e) {
    // When project overlay is open, allow native scrolling (don't hijack keys).
    if (window.__projectOverlayOpen) return;

    // Only handle keyboard scrolling if not in an input/textarea/contenteditable
    const target = e.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
      return; // Let default behavior handle input fields
    }

    const key = e.key;
    if (this.keysPressed.has(key)) {
      return; // Key already pressed, ignore repeat events
    }

    let shouldHandle = false;
    let scrollDirection = 0;

    switch (key) {
      case 'ArrowDown':
        scrollDirection = 1;
        shouldHandle = true;
        break;
      case 'ArrowUp':
        scrollDirection = -1;
        shouldHandle = true;
        break;
      case 'PageDown':
        this.scrollTarget += window.innerHeight;
        this.scrollTarget = Math.max(0, Math.min(this.scrollTarget, this.content.scrollHeight - window.innerHeight));
        e.preventDefault();
        return;
      case 'PageUp':
        this.scrollTarget -= window.innerHeight;
        this.scrollTarget = Math.max(0, Math.min(this.scrollTarget, this.content.scrollHeight - window.innerHeight));
        e.preventDefault();
        return;
      case ' ': // Spacebar
        if (!e.shiftKey) {
          this.scrollTarget += window.innerHeight; // Space scrolls down
        } else {
          this.scrollTarget -= window.innerHeight; // Shift+Space scrolls up
        }
        this.scrollTarget = Math.max(0, Math.min(this.scrollTarget, this.content.scrollHeight - window.innerHeight));
        e.preventDefault();
        return;
      case 'Home':
        this.scrollTarget = 0;
        e.preventDefault();
        return;
      case 'End':
        this.scrollTarget = this.content.scrollHeight - window.innerHeight;
        e.preventDefault();
        return;
      default:
        return; // Don't prevent default for other keys
    }

    if (shouldHandle) {
      e.preventDefault();
      this.keysPressed.add(key);
      this.keyScrollSpeed = scrollDirection * Math.max(30, window.innerHeight * 0.04);
      this.startKeyScrolling();
    }
  }

  onKeyUp(e) {
    if (window.__projectOverlayOpen) return;
    const key = e.key;
    if (this.keysPressed.has(key)) {
      this.keysPressed.delete(key);
      
      // If no arrow keys are pressed anymore, stop continuous scrolling
      if (!this.hasActiveArrowKeys()) {
        this.stopKeyScrolling();
      }
    }
  }

  onWindowBlur() {
    // Stop all key scrolling when window loses focus
    this.keysPressed.clear();
    this.stopKeyScrolling();
  }

  hasActiveArrowKeys() {
    return this.keysPressed.has('ArrowUp') || this.keysPressed.has('ArrowDown');
  }

  startKeyScrolling() {
    if (this.keyScrollRafId) return; // Already scrolling
    
    const scrollStep = () => {
      if (!this.hasActiveArrowKeys()) {
        this.stopKeyScrolling();
        return;
      }

      // Inertia-based snap for key scrolling: accumulate implied distance before snapping
      if (!this.isAutoSnapping && this.keyScrollSpeed > 0 && this.scrollCurrent < this.section2Top && this.scrollTarget < this.section2Top) {
        this.snapAccumulatedDelta += Math.abs(this.keyScrollSpeed);
        if (this.snapAccumulatedDelta >= this.snapThresholdPx) {
          this.isAutoSnapping = true;
          this.scrollTo(this.section2Top, 700, () => {
            this.isAutoSnapping = false;
            this.snapAccumulatedDelta = 0;
          });
          this.stopKeyScrolling();
          return;
        }
      }

      if (this.isAutoSnapping) {
        this.stopKeyScrolling();
        return;
      }

      this.scrollTarget += this.keyScrollSpeed;
      
      // Clamp scroll target
      const maxScroll = this.content.scrollHeight - window.innerHeight;
      this.scrollTarget = Math.max(0, Math.min(this.scrollTarget, maxScroll));

      this.keyScrollRafId = requestAnimationFrame(scrollStep);
    };
    
    this.keyScrollRafId = requestAnimationFrame(scrollStep);
  }

  stopKeyScrolling() {
    if (this.keyScrollRafId) {
      cancelAnimationFrame(this.keyScrollRafId);
      this.keyScrollRafId = null;
    }
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
    // Touch devices use native scrolling; never translate the content container.
    // This guards against other modules calling `start()`/`onScroll()` during overlay transitions.
    if (this.isTouchDevice) return;
    
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
        // If the global capture interceptor already handled this click, skip.
        if (e.__smoothScrollHandled) return;
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
    // Suppress the touch Section-1 snap-assist while we're animating.
    if (this.isTouchDevice) {
      this.touchDisableSnapUntil = performance.now() + duration + 250;
      this.mobileSnapAccumulated = 0;
      if (this.mobileSnapPending) {
        clearTimeout(this.mobileSnapPending);
        this.mobileSnapPending = null;
      }
    }

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
      // Mark so per-anchor listeners don't also run animateScrollTo.
      e.__smoothScrollHandled = true;
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
    // Touch devices do not run the smooth-scroll RAF loop.
    if (this.isTouchDevice) return;
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
    this.stopKeyScrolling();
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
