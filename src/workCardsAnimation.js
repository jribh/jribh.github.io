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
  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    // Mobile: Animate the entire work-cards container
    const workCardsContainer = document.querySelector('.work-cards');
    
    if (!workCardsContainer) {
      console.warn('No work-cards container found');
      return;
    }

    if (workCardsContainer.dataset.workCardsAnimInit === '1') return;
    workCardsContainer.dataset.workCardsAnimInit = '1';

    // Set initial state for the container
    gsap.set(workCardsContainer, {
      autoAlpha: 0,
      y: 32,
      filter: 'blur(8px)'
    });

    ScrollTrigger.create({
      trigger: workCardsContainer,
      start: 'top 80%',
      scroller: getScroller(),
      onEnter: () => {
        gsap.to(workCardsContainer, {
          autoAlpha: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 1.2,
          ease: 'expo.out',
          clearProps: 'y,transform,filter',
          overwrite: false
        });
      },
      onLeaveBack: () => {
        gsap.to(workCardsContainer, {
          autoAlpha: 0,
          y: 32,
          filter: 'blur(8px)',
          duration: 0.6,
          ease: 'power2.in',
          overwrite: false
        });
      }
    });
  } else {
    // Desktop: Animate individual cards
    const allWorkCards = Array.from(document.querySelectorAll('.work-card'));
    const workCardsInRows = Array.from(document.querySelectorAll('.work-card-row .work-card'));
    const standaloneWorkCards = allWorkCards.filter((card) => !card.closest('.work-card-row'));

    const targets = [...standaloneWorkCards, ...workCardsInRows];

    if (!targets.length) {
      console.warn('No work cards found');
      return;
    }

    const triggerStart = 'top 90%';

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
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWorkCardsAnimation);
} else {
  initWorkCardsAnimation();
}

export { initWorkCardsAnimation };
