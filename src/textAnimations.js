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
    // ========== SECTION 2 ANIMATIONS ==========
    const section2 = document.querySelector('[data-section="2"]');
    if (section2) {
      // Get animatable elements
      const eyeCandyHeading = section2.querySelector('.section-heading');
      const beyondWord = section2.querySelector('.section-word--left');
      const prettyWord = section2.querySelector('.section-word--right');
      const tagline = section2.querySelector('.section-tagline');

      // Split and animate EYE CANDY - triggers earlier
      if (eyeCandyHeading) {
        this.createAnimation(eyeCandyHeading, {
          start: 'top 50%', // Animate further up
          duration: 0.8,
          stagger: 0.02,
        });
      }

      // Split and animate BEYOND - triggers further up
      if (beyondWord) {
        this.createAnimation(beyondWord, {
          start: 'top 45%', // Further up than before
          duration: 1.2,
          stagger: 0.05, // Slightly more stagger
        });
        
        // Animate GRAD property for BEYOND
        this.animateGradProperty(beyondWord);
      }

      // Split and animate PRETTY - triggers even further up
      if (prettyWord) {
        this.createAnimation(prettyWord, {
          start: 'top 38%', // Even further up (center of viewport)
          duration: 1.2,
          stagger: 0.05,
        });
        
        // Animate GRAD property for PRETTY
        this.animateGradProperty(prettyWord);
      }

      // Animate tagline - beautiful fade with subtle y, skew, and blur
      if (tagline) {
        // Ensure starting hidden and remove any previous trigger
        gsap.set(tagline, { autoAlpha: 0 });
        if (tagline._st) {
          tagline._st.kill();
        }

        tagline._st = ScrollTrigger.create({
          trigger: tagline,
          start: 'top 75%', // enters when top of tagline is near bottom of viewport
          scroller: '#content',
          onEnter: () => {
            if (tagline._tl) tagline._tl.kill();
            tagline._tl = gsap.fromTo(
              tagline,
              { autoAlpha: 0, y: 24, skewY: 2, filter: 'blur(6px)' },
              { autoAlpha: 1, y: 0, skewY: 0, filter: 'blur(0px)', duration: 1, ease: 'expo.out', overwrite: 'auto' }
            );
          },
          onLeaveBack: () => {
            if (tagline._tl) tagline._tl.kill();
            gsap.to(tagline, { autoAlpha: 0, y: 24, skewY: 2, filter: 'blur(6px)', duration: 0.35, ease: 'power2.in', overwrite: 'auto' });
          },
        });
      }
    }

    // ========== SECTION 3 ANIMATIONS ==========
    const section3 = document.querySelector('[data-section="3"]');
    if (section3) {
      const enterpriseHeading = section3.querySelector('.heading-h2');
      const subtitleHeading = section3.querySelector('.heading-h3-regular');
      const buttons = section3.querySelector('.enterprise-buttons');
      const rightColumn = section3.querySelector('.enterprise-right');

      // 1. ENTERPRISE text - letter-by-letter fade like EYE CANDY
      if (enterpriseHeading) {
        this.createAnimation(enterpriseHeading, {
          start: 'top 50%',
          duration: 0.8,
          stagger: 0.03,
        });
      }

      // 2. "And then some." - scramble text effect
      if (subtitleHeading) {
        this.createScrambleAnimation(subtitleHeading, {
          start: 'top 60%',
          duration: 1.2,
        });
      }

      // 3. Buttons - beautiful fade with y movement
      if (buttons) {
        gsap.set(buttons, { autoAlpha: 0 });
        if (buttons._st) buttons._st.kill();

        buttons._st = ScrollTrigger.create({
          trigger: buttons,
          start: 'top 65%',
          scroller: '#content',
          onEnter: () => {
            if (buttons._tl) buttons._tl.kill();
            buttons._tl = gsap.fromTo(
              buttons,
              { autoAlpha: 0, y: 40, filter: 'blur(4px)' },
              { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.2, ease: 'expo.out', overwrite: 'auto' }
            );
          },
          onLeaveBack: () => {
            if (buttons._tl) buttons._tl.kill();
            gsap.to(buttons, { autoAlpha: 0, y: 40, filter: 'blur(4px)', duration: 0.4, ease: 'power2.in', overwrite: 'auto' });
          },
        });
      }

      // 4. Right column - beautiful fade with y movement
      if (rightColumn) {
        gsap.set(rightColumn, { autoAlpha: 0 });
        if (rightColumn._st) rightColumn._st.kill();

        rightColumn._st = ScrollTrigger.create({
          trigger: rightColumn,
          start: 'top 65%',
          scroller: '#content',
          onEnter: () => {
            if (rightColumn._tl) rightColumn._tl.kill();
            rightColumn._tl = gsap.fromTo(
              rightColumn,
              { autoAlpha: 0, y: 40, filter: 'blur(4px)' },
              { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.2, ease: 'expo.out', delay: 0.2, overwrite: 'auto' }
            );
          },
          onLeaveBack: () => {
            if (rightColumn._tl) rightColumn._tl.kill();
            gsap.to(rightColumn, { autoAlpha: 0, y: 40, filter: 'blur(4px)', duration: 0.4, ease: 'power2.in', overwrite: 'auto' });
          },
        });
      }
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

    // Track state to prevent rapid toggle flicker
    let hasEntered = false;
    let reverseTimeout = null;

    // Create animation using ScrollTrigger with debounced reverse
    element.anim = gsap.from(chars, {
      scrollTrigger: {
        trigger: element,
        start: start,
        scroller: '#content',
        onEnter: () => {
          hasEntered = true;
          // Clear any pending reverse
          if (reverseTimeout) {
            clearTimeout(reverseTimeout);
            reverseTimeout = null;
          }
        },
        onLeaveBack: () => {
          // Only reverse if we've been visible for at least 200ms (debounce rapid scrolling)
          if (hasEntered) {
            reverseTimeout = setTimeout(() => {
              if (element.anim && element.anim.scrollTrigger) {
                element.anim.reverse();
              }
            }, 200);
          }
        },
        onEnterBack: () => {
          // Re-entering, clear the reverse timeout and play forward
          if (reverseTimeout) {
            clearTimeout(reverseTimeout);
            reverseTimeout = null;
          }
          if (element.anim) {
            element.anim.play();
          }
        },
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

  createScrambleAnimation(element, options = {}) {
    // Store original text
    const originalText = element.textContent;
    element.originalText = originalText;
    
    // Character set for scrambling
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*().,?';
    
    const {
      start = 'top 70%',
      duration = 1.2,
    } = options;

    // Set initial state
    gsap.set(element, { autoAlpha: 0 });

    // Create scramble object
    const scrambleObj = { progress: 0 };
    let scrambleInterval = null;

    if (element._st) element._st.kill();
    
    element._st = ScrollTrigger.create({
      trigger: element,
      start: start,
      scroller: '#content',
      onEnter: () => {
        // Fade in and scramble
        gsap.set(element, { autoAlpha: 1 });
        
        if (scrambleInterval) clearInterval(scrambleInterval);
        
        // Animate progress from 0 to 1
        gsap.to(scrambleObj, {
          progress: 1,
          duration: duration,
          ease: 'power2.out',
          onUpdate: () => {
            const progress = scrambleObj.progress;
            const revealedChars = Math.floor(originalText.length * progress);
            
            let displayText = '';
            for (let i = 0; i < originalText.length; i++) {
              if (i < revealedChars) {
                // Character is revealed
                displayText += originalText[i];
              } else if (originalText[i] === ' ') {
                // Keep spaces
                displayText += ' ';
              } else {
                // Scramble remaining characters
                displayText += chars[Math.floor(Math.random() * chars.length)];
              }
            }
            element.textContent = displayText;
          },
          onComplete: () => {
            element.textContent = originalText;
          }
        });
      },
      onLeaveBack: () => {
        // Fade out when scrolling back up
        gsap.to(element, { 
          autoAlpha: 0, 
          duration: 0.4, 
          ease: 'power2.in',
          onComplete: () => {
            scrambleObj.progress = 0;
            element.textContent = originalText;
          }
        });
      },
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

  animateGradProperty(element) {
    // Create a smooth looping GRAD animation between -50 and 95
    const gradObj = { value: 95 }; // Start at default GRAD value
    
    gsap.to(gradObj, {
      value: -70,
      duration: 2.8,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
      onUpdate: () => {
        // Update the font-variation-settings with the new GRAD value
        const currentSettings = `
          'wght' 320,
          'opsz' 144,
          'wdth' 27,
          'slnt' 0,
          'GRAD' ${Math.round(gradObj.value)},
          'YOPQ' 79,
          'XTRA' 468,
          'YTUC' 760,
          'YTLC' 514,
          'YTAS' 750
        `;
        element.style.fontVariationSettings = currentSettings;
      }
    });
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
