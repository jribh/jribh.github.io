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
    // ========== SECTION 4 ANIMATIONS ==========
    const section4 = document.querySelector('[data-section="4"]');
    if (section4) {
      const workWrapper = section4.querySelector('.work-wrapper');
      const workLines = section4.querySelectorAll('.work-line'); // Each line within H2
      const workOverlays = section4.querySelectorAll('.work-wrapper .work-overlay'); // Crafting / and / for people

      // 1) Animate each line independently with scroll triggers and y-movement
      workLines.forEach((line, index) => {
        const startPosition = 80 - (index * 1.5); // Stagger triggers: 80%, 78%, 76%, etc... Increase the first number to trigger earlier
        this.createAnimationPreserve(line, {
          start: `top ${startPosition}%`,
          duration: 0.6,
          stagger: 0.02,
        });
      });

      // 2) Animate work overlays with beautiful fade in - different triggers for 'Crafting' vs others
      if (workOverlays && workOverlays.length) {
        // Set initial hidden state
        gsap.set(workOverlays, { autoAlpha: 0 });
        
        workOverlays.forEach((overlay, index) => {
          // 'Crafting' (first overlay) triggers later at 60%, others at 75%
          const startPosition = index === 0 ? 'top 60%' : 'top 75%';
          this.createScrollTriggerAnimation(overlay, {
            start: startPosition,
            duration: 2,
            ease: 'expo.out',
            delay: index * 0.1, // Slight stagger for multiple overlays
          });
        });
      }
    }
      if (eyeCandyHeading) {
        this.createAnimation(eyeCandyHeading, {
          start: 'top 70%', // Decrease to trigger further up in the viewport
          duration: 0.6,
          stagger: 0.02,
        });
      }

      // Split and animate BEYOND - triggers further up
      if (beyondWord) {
        this.createAnimation(beyondWord, {
          start: 'top 50%', // Decrease to trigger further up in the viewport
          duration: 0.8,
          stagger: 0.04, // Slightly more stagger
        });
      }

      // Split and animate PRETTY - triggers even further up
      if (prettyWord) {
        this.createAnimation(prettyWord, {
          start: 'top 45%', // Decrease to trigger further up in the viewport
          duration: 0.8,
          stagger: 0.04,
          onComplete: () => {
            // Trigger tagline animation 500ms after PRETTY finishes
            setTimeout(() => {
              this.animateTagline(tagline);
            }, 900);
          },
          onReverse: () => {
            // Hide tagline when row 2 reverses
            this.hideTagline(tagline);
          }
        });
      }

      // Set up tagline but don't animate it yet
      if (tagline) {
        gsap.set(tagline, { autoAlpha: 0 });
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
          start: 'top 70%', // Decrease to trigger further up in the viewport
          duration: 0.4,
          stagger: 0.02,
        });
      }

      // 2. "And then some." - letter-by-letter animation like EYE CANDY
      if (subtitleHeading) {
        this.createAnimation(subtitleHeading, {
          start: 'top 60%', // Slightly higher trigger than ENTERPRISE
          duration: 0.4,
          stagger: 0.02,
        });
      }

      // 3. CTAs - animate based on scroll trigger
      if (buttons) {
        this.createScrollTriggerAnimation(buttons, {
          start: 'top 70%', // Trigger after "And then some"
          duration: 1,
          ease: 'expo.out',
        });
      }

      // 4. Right column - animate based on scroll trigger
      if (rightColumn) {
        this.createScrollTriggerAnimation(rightColumn, {
          start: 'top 36%', // Trigger after CTAs
          duration: 1.4,
          ease: 'expo.out',
        });
      }

      // Set up CTAs and right column initially hidden
      if (buttons) {
        gsap.set(buttons, { autoAlpha: 0 });
      }
      if (rightColumn) {
        gsap.set(rightColumn, { autoAlpha: 0 });
      }
    }

    // ========== SECTION 5 ANIMATIONS ==========
    const section5 = document.querySelector('[data-section="5"]');
    if (section5) {
      const workHeading = section5.querySelector('.heading-h1--gradient-work');

      // Animate h1 with same style as section 4 h2 lines
      if (workHeading) {
        this.createAnimationPreserve(workHeading, {
          start: 'top 60%',
          duration: 1,
          stagger: 0.02,
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
      onComplete = null,
      onReverse = null,
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
          // Call onComplete callback if provided
          if (onComplete) onComplete();
        },
        onLeaveBack: () => {
          // Only reverse if we've been visible for at least 200ms (debounce rapid scrolling)
          if (hasEntered) {
            reverseTimeout = setTimeout(() => {
              if (element.anim && element.anim.scrollTrigger) {
                element.anim.reverse();
              }
              // Call onReverse callback if provided
              if (onReverse) onReverse();
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

  // --- Section 4 specific: preserve <br> and nested spans while splitting text nodes into .char spans ---
  splitElementPreserveLineBreaks(element) {
    const createdChars = [];

    const splitTextNode = (node) => {
      const text = node.textContent;
      const frag = document.createDocumentFragment();
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const span = document.createElement('span');
        span.className = ch === ' ' ? 'char char-space' : 'char';
        span.textContent = ch === ' ' ? ' ' : ch;
        frag.appendChild(span);
        createdChars.push(span);
      }
      node.parentNode.replaceChild(frag, node);
    };

    const walk = (node) => {
      // If it's a text node and not empty, split it
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent.trim() === '' && node.textContent.indexOf(' ') === node.textContent.length - 1) {
          // leave pure trailing spaces alone; still split to preserve layout spacing
        }
        splitTextNode(node);
        return;
      }
      // If it's an element node
      if (node.nodeType === Node.ELEMENT_NODE) {
        // Do not alter <br> elements
        if (node.tagName === 'BR') return;
        // Recurse into children
        // Use Array.from to avoid live collection issues when we mutate
        Array.from(node.childNodes).forEach(walk);
      }
    };

    walk(element);
    return createdChars;
  }

  createAnimationPreserve(element, options = {}) {
    // Reset if previously split by us
    if (element.anim) {
      element.anim.progress(1).kill();
    }
    // Restore original HTML if we split before
    if (element._originalHTML) {
      element.innerHTML = element._originalHTML;
    } else {
      // Store the original HTML once for restoration
      element._originalHTML = element.innerHTML;
    }

    // Split while preserving <br> and nested structure
    const chars = this.splitElementPreserveLineBreaks(element);
    element.chars = chars;

    const {
      start = 'top 70%',
      duration = 0.6,
      stagger = 0.02,
      delay = 0,
      onComplete = null,       // kept for API parity
      onReverse = null,
      onEnterCompleteDelayMs = 0, // extra: delay after enter completes
      onEnterAfterDelay = null,   // extra: callback after the above delay
    } = options;

    let hasEntered = false;
    let reverseTimeout = null;

    // We animate chars like other headings
    element.anim = gsap.from(chars, {
      scrollTrigger: {
        trigger: element,
        start: start,
        scroller: '#content',
        onEnter: () => {
          hasEntered = true;
          if (reverseTimeout) {
            clearTimeout(reverseTimeout);
            reverseTimeout = null;
          }
        },
        onLeaveBack: () => {
          if (hasEntered) {
            reverseTimeout = setTimeout(() => {
              if (element.anim && element.anim.scrollTrigger) {
                element.anim.reverse();
              }
              if (onReverse) onReverse();
            }, 200);
          }
        },
        onEnterBack: () => {
          if (reverseTimeout) {
            clearTimeout(reverseTimeout);
            reverseTimeout = null;
          }
          if (element.anim) {
            element.anim.play();
          }
        }
      },
      duration: duration,
      ease: 'circ.out',
      y: 80,
      opacity: 0,
      stagger: stagger,
      delay: delay,
      onComplete: () => {
        if (onEnterAfterDelay) {
          setTimeout(() => {
            if (onEnterAfterDelay) onEnterAfterDelay();
          }, onEnterCompleteDelayMs);
        }
        if (onComplete) onComplete();
      }
    });

    this.animatedElements.push(element);
  }

  animateTagline(tagline, onComplete = null) {
    // Kill any existing animation
    if (tagline._tl) tagline._tl.kill();
    
    // Animate tagline with beautiful fade, y movement, skew, and blur
    tagline._tl = gsap.fromTo(
      tagline,
      { autoAlpha: 0, y: 24, skewY: 2, filter: 'blur(6px)' },
      { 
        autoAlpha: 1, 
        y: 0, 
        skewY: 0, 
        filter: 'blur(0px)', 
        duration: 1, 
        ease: 'expo.out', 
        overwrite: 'auto',
        onComplete: onComplete
      }
    );
  }

  hideTagline(tagline) {
    // Kill any existing animation
    if (tagline._tl) tagline._tl.kill();
    
    // Hide tagline with reverse animation
    gsap.to(tagline, { autoAlpha: 0, y: 24, skewY: 2, filter: 'blur(6px)', duration: 0.35, ease: 'power2.in', overwrite: 'auto' });
  }

  animateEnterpriseButtons(buttons, onComplete = null) {
    // Kill any existing animation
    if (buttons._tl) buttons._tl.kill();
    
    // Animate buttons with beautiful fade, y movement, skew, and blur (like tagline)
    buttons._tl = gsap.fromTo(
      buttons,
      { autoAlpha: 0, y: 24, skewY: 2, filter: 'blur(6px)' },
      { 
        autoAlpha: 1, 
        y: 0, 
        skewY: 0, 
        filter: 'blur(0px)', 
        duration: 1, 
        ease: 'expo.out', 
        overwrite: 'auto',
        onComplete: onComplete
      }
    );
  }

  animateEnterpriseRight(rightColumn) {
    // Kill any existing animation
    if (rightColumn._tl) rightColumn._tl.kill();
    
    // Animate right column with beautiful fade, y movement, skew, and blur (like tagline)
    rightColumn._tl = gsap.fromTo(
      rightColumn,
      { autoAlpha: 0, y: 24, skewY: 2, filter: 'blur(6px)' },
      { 
        autoAlpha: 1, 
        y: 0, 
        skewY: 0, 
        filter: 'blur(0px)', 
        duration: 1, 
        ease: 'expo.out', 
        overwrite: 'auto'
      }
    );
  }

  hideEnterpriseButtons(buttons) {
    // Kill any existing animation
    if (buttons._tl) buttons._tl.kill();
    
    // Hide buttons with reverse animation
    gsap.to(buttons, { autoAlpha: 0, y: 24, skewY: 2, filter: 'blur(6px)', duration: 0.35, ease: 'power2.in', overwrite: 'auto' });
  }

  hideEnterpriseRight(rightColumn) {
    // Kill any existing animation
    if (rightColumn._tl) rightColumn._tl.kill();
    
    // Hide right column with reverse animation
    gsap.to(rightColumn, { autoAlpha: 0, y: 24, skewY: 2, filter: 'blur(6px)', duration: 0.35, ease: 'power2.in', overwrite: 'auto' });
  }

  createScrollTriggerAnimation(element, options = {}) {
    const {
      start = 'top 70%',
      duration = 1,
      ease = 'expo.out',
    } = options;

    // Track state to prevent rapid toggle flicker
    let hasEntered = false;
    let reverseTimeout = null;

    // Kill any existing animation
    if (element._tl) element._tl.kill();

    // Create ScrollTrigger
    element._st = ScrollTrigger.create({
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
        // Animate in
        gsap.fromTo(
          element,
          { autoAlpha: 0, y: 24, skewY: 2, filter: 'blur(6px)' },
          { 
            autoAlpha: 1, 
            y: 0, 
            skewY: 0, 
            filter: 'blur(0px)', 
            duration: duration, 
            ease: ease, 
            overwrite: 'auto'
          }
        );
      },
      onLeaveBack: () => {
        // Only reverse if we've been visible for at least 200ms (debounce rapid scrolling)
        if (hasEntered) {
          reverseTimeout = setTimeout(() => {
            // Animate out
            gsap.to(element, { 
              autoAlpha: 0, 
              y: 24, 
              skewY: 2, 
              filter: 'blur(6px)', 
              duration: 0.35, 
              ease: 'power2.in', 
              overwrite: 'auto' 
            });
          }, 200);
        }
      },
      onEnterBack: () => {
        // Re-entering, clear the reverse timeout and animate back in
        if (reverseTimeout) {
          clearTimeout(reverseTimeout);
          reverseTimeout = null;
        }
        gsap.fromTo(
          element,
          { autoAlpha: 0, y: 24, skewY: 2, filter: 'blur(6px)' },
          { 
            autoAlpha: 1, 
            y: 0, 
            skewY: 0, 
            filter: 'blur(0px)', 
            duration: duration, 
            ease: ease, 
            overwrite: 'auto'
          }
        );
      },
    });

    this.animatedElements.push(element);
  }

  refresh() {
    ScrollTrigger.refresh();
  }

  destroy() {
    this.animatedElements.forEach(element => {
      if (element.anim) {
        element.anim.kill();
      }
      // Restore original content based on how it was split
      if (element._originalHTML) {
        element.innerHTML = element._originalHTML;
      } else if (element.originalText) {
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
