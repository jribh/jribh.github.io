import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Work Cards Fade-in Animation
 * 
 * Animates each work card with a smooth fade-in,
 * blur reduction, and slight upward movement when scrolling into view.
 * Staggered animation for each card.
 */

// Get scroller based on smooth scroll state
const getScroller = () => {
  return (window.smoothScroll && window.smoothScroll.isRunning) ? '#content' : window;
};

function initWorkCardsAnimation() {
  const workCardRows = Array.from(document.querySelectorAll('.work-card-row'));
  const allWorkCards = Array.from(document.querySelectorAll('.work-card'));
  const standaloneWorkCards = allWorkCards.filter((card) => !card.closest('.work-card-row'));

  const targets = [...standaloneWorkCards, ...workCardRows];

  if (!targets.length) {
    console.warn('No work cards found');
    return;
  }

  // Mobile-responsive trigger: trigger further up (60%) on mobile (<=768px), 75% on desktop
  const isMobile = window.innerWidth <= 768;
  const triggerStart = isMobile ? 'top 60%' : 'top 75%';

  targets.forEach((target, index) => {
    if (target.dataset.workCardsAnimInit === '1') return;
    target.dataset.workCardsAnimInit = '1';

    // Set initial state: hidden with blur and slight downward offset
    gsap.set(target, {
      autoAlpha: 0,
      y: 32,
      filter: 'blur(8px)'
    });

    ScrollTrigger.create({
      trigger: target,
      start: triggerStart,
      scroller: getScroller(),
      onEnter: () => {
        // Beautiful fade-in animation matching the site's aesthetic
        // Stagger each card by 0.1 seconds
        gsap.to(target, {
          autoAlpha: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 1.2,
          ease: 'expo.out',
          delay: index * 0.1,
          clearProps: 'y,transform,filter',
          overwrite: false
        });
      },
      onLeaveBack: () => {
        // Fade out when scrolling back up
        gsap.to(target, {
          autoAlpha: 0,
          y: 32,
          filter: 'blur(8px)',
          duration: 0.6,
          ease: 'power2.in',
          overwrite: false
        });
      }
    });
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWorkCardsAnimation);
} else {
  initWorkCardsAnimation();
}

export { initWorkCardsAnimation };
