/**
 * Contact Return Button
 * Handles the up arrow button that appears in section 6 (contact)
 * - Shows when arriving at contact section (especially from section 3)
 * - Scrolls back to section 3 when clicked, then fades out
 * - Fades out when scrolled out of viewport
 */

import { gsap } from 'gsap';

class ContactReturnButton {
  constructor() {
    this.btn = null;
    this.contactSection = null;
    this.aboutSection = null;
    this.isVisible = false;
    this.hasBeenClicked = false;
    this.rafId = null;
    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  setup() {
    this.btn = document.querySelector('.contact-return-btn');
    this.contactSection = document.getElementById('contact');
    this.aboutSection = document.getElementById('about');

    if (!this.btn || !this.contactSection || !this.aboutSection) {
      console.warn('ContactReturnButton: Required elements not found');
      return;
    }

    // Start with button hidden
    this.btn.classList.add('is-hidden');
    this.isVisible = false;

    // Set up click handler
    this.btn.addEventListener('click', () => this.handleClick());

    // Start monitoring scroll
    this.startMonitoring();
  }

  handleClick() {
    if (this.hasBeenClicked) return;
    this.hasBeenClicked = true;

    // Scroll to about section (section 3, index 2)
    const targetPosition = this.aboutSection.offsetTop;

    if (window.smoothScroll && typeof window.smoothScroll.scrollTo === 'function') {
      window.smoothScroll.scrollTo(targetPosition, 1200);
    } else {
      window.scrollTo({ top: targetPosition, behavior: 'smooth' });
    }

    // Fade out the button
    gsap.to(this.btn, {
      opacity: 0,
      duration: 0.4,
      ease: 'power2.inOut',
      onComplete: () => {
        this.btn.classList.add('is-hidden');
        this.isVisible = false;
      }
    });
  }

  startMonitoring() {
    const monitor = () => {
      this.updateButtonVisibility();
      this.rafId = requestAnimationFrame(monitor);
    };
    this.rafId = requestAnimationFrame(monitor);
  }

  updateButtonVisibility() {
    // Get scroll position
    const scrollY = window.smoothScroll?.scrollCurrent ?? window.scrollY;

    // Get contact section bounds
    const contactTop = this.contactSection.offsetTop;
    const contactBottom = contactTop + this.contactSection.offsetHeight;

    // Get button position in viewport
    const btnRect = this.btn.getBoundingClientRect();
    const btnInViewport = btnRect.top >= 0 && btnRect.bottom <= window.innerHeight;

    // Check if we're in contact section
    const viewportMid = scrollY + window.innerHeight / 2;
    const isInContactSection = viewportMid >= contactTop && viewportMid < contactBottom;

    // If button was already clicked, keep it hidden
    if (this.hasBeenClicked) {
      if (this.isVisible) {
        this.fadeOut();
      }
      return;
    }

    // Only show button if:
    // 1. We arrived via the Contact Me button
    // 2. We're in the contact section
    // 3. The button is in viewport
    if (window.__arrivedViaContactButton && isInContactSection && btnInViewport && !this.isVisible) {
      this.fadeIn();
    } else if ((!isInContactSection || !btnInViewport) && this.isVisible) {
      // Hide if we left contact section OR button scrolled out of viewport
      this.fadeOut();
      // Reset the flag when button is hidden
      if (window.__arrivedViaContactButton) {
        window.__arrivedViaContactButton = false;
      }
    }
  }

  fadeIn() {
    this.isVisible = true;
    this.btn.classList.remove('is-hidden');

    gsap.to(this.btn, {
      opacity: 1,
      duration: 0.4,
      ease: 'power2.inOut'
    });
  }

  fadeOut() {
    this.isVisible = false;

    gsap.to(this.btn, {
      opacity: 0,
      duration: 0.4,
      ease: 'power2.inOut',
      onComplete: () => {
        this.btn.classList.add('is-hidden');
      }
    });
  }

  destroy() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
  }
}

// Initialize
const contactReturnButton = new ContactReturnButton();

// Expose globally so index.js can reset the state
window.contactReturnButton = contactReturnButton;

export default contactReturnButton;
