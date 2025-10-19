import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Text Reveal Animations
 * Letter-by-letter reveals triggered by ScrollTrigger on scroll
 * Based on GSAP's SplitText reveal technique from CodePen
 */

class TextAnimations {
  constructor() {
    this.animatedElements = [];
    this.init();
  }

  init() {
    // Wait for DOM to be ready and smooth scroll to initialize
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => this.setupSplits(), 100);
      });
    } else {
      setTimeout(() => this.setupSplits(), 100);
    }
  }

  setupSplits() {
    const section = document.querySelector('[data-section="2"]');
    if (!section) return;

    // Get animatable elements
    const eyeCandyHeading = section.querySelector('.section-heading');
    const beyondWord = section.querySelector('.section-word--left');
    const prettyWord = section.querySelector('.section-word--right');
    const tagline = section.querySelector('.section-tagline');

    // Split and animate EYE CANDY - triggers earlier
    if (eyeCandyHeading) {
      this.createAnimation(eyeCandyHeading, {
        start: 'top 70%', // Animate further up
        duration: 0.8,
        stagger: 0.02,
      });
    }

    // Split and animate BEYOND - triggers further up
    if (beyondWord) {
      this.createAnimation(beyondWord, {
        start: 'top 55%', // Further up than before
        duration: 0.8, // Slower than EYE CANDY
        stagger: 0.025, // Slightly more stagger
      });
    }

    // Split and animate PRETTY - triggers even further up
    if (prettyWord) {
      this.createAnimation(prettyWord, {
        start: 'top 50%', // Even further up (center of viewport)
        duration: 0.8, // Slower
        stagger: 0.025,
      });
    }

    // Animate tagline - triggers with PRETTY, simplified
    if (tagline) {
      gsap.set(tagline, { opacity: 0 }); // Start hidden
      
      gsap.to(tagline, {
        scrollTrigger: {
          trigger: prettyWord || tagline, // Use PRETTY's trigger
          start: 'top 50%', // Same timing as PRETTY
          once: true, // Only animate once, don't reverse
          scroller: '#content',
        },
        duration: 0.8,
        ease: 'power2.out',
        opacity: 1,
      });
    }
  }

  createAnimation(element, options = {}) {
    // Reset if needed
    if (element.anim) {
      element.anim.progress(1).kill();
      if (element.originalText) {
        element.textContent = element.originalText;
      }
    }

    // Store original text
    element.originalText = element.textContent;

    // Manually split into chars
    const chars = this.splitIntoChars(element);
    
    // Store reference
    element.chars = chars;

    // Default options
    const {
      start = 'top 70%',
      duration = 0.6,
      stagger = 0.02,
      delay = 0,
    } = options;

    // Create animation using ScrollTrigger (like CodePen)
    element.anim = gsap.from(chars, {
      scrollTrigger: {
        trigger: element,
        start: start,
        toggleActions: 'play none none reverse', // Play on enter, reverse on leave back
        scroller: '#content', // Use smooth scroll container
      },
      duration: duration,
      ease: 'circ.out',
      y: 80,
      opacity: 0,
      stagger: stagger,
      delay: delay,
    });

    this.animatedElements.push(element);
  }

  splitIntoChars(element) {
    const text = element.textContent;
    const chars = text.split('').map(char => {
      if (char === ' ') {
        return '<span class="char char-space"> </span>';
      }
      return `<span class="char">${char}</span>`;
    });
    
    element.innerHTML = chars.join('');
    return element.querySelectorAll('.char');
  }

  refresh() {
    ScrollTrigger.refresh();
  }

  destroy() {
    this.animatedElements.forEach(element => {
      if (element.anim) {
        element.anim.kill();
      }
      if (element.originalText) {
        element.textContent = element.originalText;
      }
    });
    this.animatedElements = [];
  }
}

// Initialize
const textAnimations = new TextAnimations();

// Refresh on window resize (like CodePen)
ScrollTrigger.addEventListener('refresh', () => {
  if (textAnimations.setupSplits) {
    textAnimations.setupSplits();
  }
});

// Expose for debugging
window.textAnimations = textAnimations;

export default textAnimations;
