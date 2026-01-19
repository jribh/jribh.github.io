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

  // Mobile-responsive trigger: trigger further up (60%) on mobile (<=768px), 75% on desktop
  const isMobile = window.innerWidth <= 768;
  const triggerStart = isMobile ? 'top 60%' : 'top 75%';

  dividers.forEach((divider) => {
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
        // Beautiful fade-in animation matching the site's aesthetic
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
        // Fade out when scrolling back up
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
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCaseStudiesDividers);
} else {
  initCaseStudiesDividers();
}

export { initCaseStudiesDividers };
