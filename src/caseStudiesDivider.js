import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Work Section Subheader Divider Fade-in Animation
 * 
 * Animates all .work-subheader-divider elements with a smooth fade-in,
 * blur reduction, and slight upward movement when scrolling into view.
 */

// Get scroller based on smooth scroll state
const getScroller = () => {
  return (window.smoothScroll && window.smoothScroll.isRunning) ? '#content' : window;
};

function initCaseStudiesDividers() {
  const dividers = document.querySelectorAll('.work-subheader-divider');

  if (!dividers.length) {
    console.warn('No case studies divider elements found');
    return;
  }

  const shouldSkipOnMobile = (divider) => {
    if (divider.classList.contains('work-subheader-divider--no-scroll-mobile')) return true;
    const text = divider.querySelector('.work-subheader-text')?.textContent?.trim().toLowerCase();
    return text === 'exploratory projects';
  };

  const setupAnimatedDivider = (divider, triggerStart) => {
    // Set initial state: hidden with blur and slight downward offset
    gsap.set(divider, {
      autoAlpha: 0,
      y: 32,
      filter: 'blur(8px)'
    });

    ScrollTrigger.create({
      trigger: divider,
      start: triggerStart,
      scroller: getScroller(),
      onEnter: () => {
        gsap.to(divider, {
          autoAlpha: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 1.2,
          ease: 'expo.out',
          overwrite: 'auto'
        });
      },
      onLeaveBack: () => {
        gsap.to(divider, {
          autoAlpha: 0,
          y: 32,
          filter: 'blur(8px)',
          duration: 0.6,
          ease: 'power2.in',
          overwrite: 'auto'
        });
      }
    });
  };

  ScrollTrigger.matchMedia({
    '(max-width: 768px)': () => {
      const triggerStart = 'top 60%';
      dividers.forEach((divider) => {
        if (shouldSkipOnMobile(divider)) {
          gsap.set(divider, { autoAlpha: 1, y: 0, filter: 'blur(0px)' });
          return;
        }
        setupAnimatedDivider(divider, triggerStart);
      });
    },
    '(min-width: 769px)': () => {
      const triggerStart = 'top 75%';
      dividers.forEach((divider) => {
        setupAnimatedDivider(divider, triggerStart);
      });
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCaseStudiesDividers);
} else {
  initCaseStudiesDividers();
}

export { initCaseStudiesDividers };
