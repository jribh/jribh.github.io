import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';
import beyondSvgUrl from 'url:./assets/beyond_svg.svg';
import prettySvgUrl from 'url:./assets/pretty_svg.svg';
import beyondBaseUrl from 'url:./assets/beyond_base.svg';
import prettyBaseUrl from 'url:./assets/pretty_base.svg';

gsap.registerPlugin(ScrollTrigger);

// ============================================================================
// CONFIGURABLE ANIMATION PARAMETERS
// Change these values to adjust letter animation timing (in seconds)
// Speed increased by 50% (all durations and delays divided by 1.5)
// ============================================================================

// Animation loop configuration
const ANIMATION_LOOP_CONFIG = {
  // Percentage of text to keep visible when reversing (0 to 1, where 1 = 100%)
  reverseStopPercent: 0.65,
  // Pause duration between full draw and reverse (in seconds)
  pauseDuration: 6
};

const BEYOND_ANIMATION_CONFIG = {
  // Loop interval (yoyo forward and reverse, no gap)
  loopInterval: 0,
  
  // Individual letter/path animation durations and start delays
  paths: {
    b_left: {
      duration: 0.667,
      delay: 0
    },
    b_right: {
      duration: 0.933,
      delay: 0.133
    },
    e_left: {
      duration: 1.2,
      delay: 0.267
    },
    e_middle: {
      duration: 0.267,
      delay: 0.8
    },
    y: {
      duration: 1.333,
      delay: 0.4
    },
    o_left: {
      duration: 1.067,
      delay: 0.533
    },
    o_right: {
      duration: 1.067,
      delay: 0.667
    },
    n: {
      duration: 1.333,
      delay: 0.8
    },
    d_left: {
      duration: 1.067,
      delay: 0.933
    },
    d_right: {
      duration: 0.933,
      delay: 1.067
    }
  }
};

const PRETTY_ANIMATION_CONFIG = {
  // Loop interval (yoyo forward and reverse, no gap)
  loopInterval: 0,
  
  // Individual path animation durations and start delays
  paths: {
    p_left: {
      duration: 1.067,
      delay: 0.6
    },
    p_right: {
      duration: 0.667,
      delay: 0.733
    },
    r_left: {
      duration: 1.067,
      delay: 0.8
    },
    r_right: {
      duration: 1.2,
      delay: 0.933
    },
    e_left: {
      duration: 1.2,
      delay: 1.067
    },
    e_middle: {
      duration: 0.267,
      delay: 1.6
    },
    t_1: {
      duration: 1.067,
      delay: 1.2
    },
    t_2: {
      duration: 1.067,
      delay: 1.333
    },
    y: {
      duration: 1.333,
      delay: 1.467
    }
  }
};

// Export config for easy runtime tweaking via console
window.BEYOND_ANIMATION_CONFIG = BEYOND_ANIMATION_CONFIG;
window.PRETTY_ANIMATION_CONFIG = PRETTY_ANIMATION_CONFIG;
window.ANIMATION_LOOP_CONFIG = ANIMATION_LOOP_CONFIG;

// Load SVG from URL
async function loadSVG(url) {
  const response = await fetch(url);
  const text = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'image/svg+xml');
  return doc.querySelector('svg');
}

async function initBeyondAnimation() {
  try {
    // Wait for container to exist in DOM
    const waitForContainer = () => {
      return new Promise(resolve => {
        const check = () => {
          const container = document.querySelector('#beyond-pretty-container');
          if (container) {
            resolve(container);
          } else {
            requestAnimationFrame(check);
          }
        };
        check();
      });
    };

    const container = await waitForContainer();
    
    // Load all SVGs from assets
    const [beyondSvg, prettySvg, beyondBaseSvg, prettyBaseSvg] = await Promise.all([
      loadSVG(beyondSvgUrl),
      loadSVG(prettySvgUrl),
      loadSVG(beyondBaseUrl),
      loadSVG(prettyBaseUrl)
    ]);

    // Create unique IDs for masks to avoid conflicts
    const beyondMaskId = 'beyond-mask-' + Math.random().toString(36).substr(2, 9);
    const prettyMaskId = 'pretty-mask-' + Math.random().toString(36).substr(2, 9);

    // Set up BEYOND: Create mask from path SVG and apply to base SVG
    beyondSvg.setAttribute('id', beyondMaskId);
    beyondSvg.style.position = 'absolute';
    beyondSvg.style.width = '0';
    beyondSvg.style.height = '0';
    beyondSvg.style.opacity = '0';
    beyondSvg.style.pointerEvents = 'none';
    
    // Convert the path SVG into a mask element
    const beyondMaskElement = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
    beyondMaskElement.setAttribute('id', beyondMaskId);
    const beyondMaskGroup = beyondSvg.querySelector('#beyond_svg');
    if (beyondMaskGroup) {
      // Clone all paths into the mask and set them to white (visible in mask)
      Array.from(beyondMaskGroup.children).forEach(path => {
        const maskPath = path.cloneNode(true);
        maskPath.setAttribute('stroke', 'white');
        maskPath.setAttribute('fill', 'none');
        beyondMaskElement.appendChild(maskPath);
      });
    }

    // Add mask to base SVG's defs
    let beyondDefs = beyondBaseSvg.querySelector('defs');
    if (!beyondDefs) {
      beyondDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      beyondBaseSvg.insertBefore(beyondDefs, beyondBaseSvg.firstChild);
    }
    beyondDefs.appendChild(beyondMaskElement);

    // Update Beyond gradient colors to match Figma design
    const beyondGradientStops = beyondBaseSvg.querySelectorAll('linearGradient stop');
    beyondGradientStops.forEach(stop => {
      const offset = stop.getAttribute('offset');
      if (offset === '0') {
        stop.setAttribute('stop-color', '#8A2118'); // Dark red at top-left
      } else if (offset === '1') {
        stop.setAttribute('stop-color', '#D64A3E'); // Lighter red at bottom-right
      }
    });

    // Apply mask to base SVG content
    const beyondBaseGroup = beyondBaseSvg.querySelector('#beyond_base');
    if (beyondBaseGroup) {
      beyondBaseGroup.setAttribute('mask', `url(#${beyondMaskId})`);
    }

    // Set up PRETTY: Create mask from path SVG and apply to base SVG
    prettySvg.setAttribute('id', prettyMaskId);
    prettySvg.style.position = 'absolute';
    prettySvg.style.width = '0';
    prettySvg.style.height = '0';
    prettySvg.style.opacity = '0';
    prettySvg.style.pointerEvents = 'none';
    
    // Convert the path SVG into a mask element
    const prettyMaskElement = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
    prettyMaskElement.setAttribute('id', prettyMaskId);
    const prettyMaskGroup = prettySvg.querySelector('#pretty_svg');
    if (prettyMaskGroup) {
      // Clone all paths into the mask and set them to white (visible in mask)
      Array.from(prettyMaskGroup.children).forEach(path => {
        const maskPath = path.cloneNode(true);
        maskPath.setAttribute('stroke', 'white');
        maskPath.setAttribute('fill', 'none');
        prettyMaskElement.appendChild(maskPath);
      });
    }

    // Add mask to base SVG's defs
    let prettyDefs = prettyBaseSvg.querySelector('defs');
    if (!prettyDefs) {
      prettyDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      prettyBaseSvg.insertBefore(prettyDefs, prettyBaseSvg.firstChild);
    }
    prettyDefs.appendChild(prettyMaskElement);

    // Update Pretty gradient colors to match Figma design
    const prettyGradientStops = prettyBaseSvg.querySelectorAll('linearGradient stop');
    prettyGradientStops.forEach(stop => {
      const offset = stop.getAttribute('offset');
      if (offset === '0') {
        stop.setAttribute('stop-color', '#F56A62'); // Coral pink at top-left
      } else if (offset === '1') {
        stop.setAttribute('stop-color', '#FFA2AB'); // Light pink at bottom-right
      }
    });

    // Apply mask to base SVG content
    const prettyBaseGroup = prettyBaseSvg.querySelector('#pretty_base');
    if (prettyBaseGroup) {
      prettyBaseGroup.setAttribute('mask', `url(#${prettyMaskId})`);
    }

    // Add classes to base SVGs (these are what will be visible)
    beyondBaseSvg.classList.add('beyond-svg');
    prettyBaseSvg.classList.add('pretty-svg');

    // Append base SVGs to container (these are visible)
    container.appendChild(beyondBaseSvg);
    container.appendChild(prettyBaseSvg);

    // Set up beautiful GSAP scroll-triggered fade-in animation for the SVG container
    // This animates the container itself, separate from the path/mask animations
    gsap.set(container, { autoAlpha: 0, y: 32, filter: 'blur(8px)' });
    
    // Get scroller based on smooth scroll state
    const getScroller = () => {
      return (window.smoothScroll && window.smoothScroll.isRunning) ? '#content' : window;
    };
    
    // Mobile-responsive trigger: trigger further up (60%) on mobile (<=768px), 75% on desktop
    const isMobile = window.innerWidth <= 768;
    const triggerStart = isMobile ? 'top 60%' : 'top 75%';
    
    ScrollTrigger.create({
      trigger: container,
      start: triggerStart,
      scroller: getScroller(),
      onEnter: () => {
        // Beautiful fade-in animation matching the site's aesthetic
        gsap.to(container, {
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
        gsap.to(container, {
          autoAlpha: 0,
          y: 32,
          filter: 'blur(8px)',
          duration: 0.6,
          ease: 'power2.in',
          overwrite: 'auto'
        });
      }
    });

    // Get all the paths to animate for BEYOND (from the mask)
    const beyondPaths = {
      b_left: beyondMaskElement.querySelector('#b_left'),
      b_right: beyondMaskElement.querySelector('#b_right'),
      e_left: beyondMaskElement.querySelector('#e_left'),
      e_middle: beyondMaskElement.querySelector('#e_middle'),
      y: beyondMaskElement.querySelector('#y'),
      o_left: beyondMaskElement.querySelector('#o_left'),
      o_right: beyondMaskElement.querySelector('#o_right'),
      n: beyondMaskElement.querySelector('#n'),
      d_left: beyondMaskElement.querySelector('#d_left'),
      d_right: beyondMaskElement.querySelector('#d_right')
    };

    // Get all the paths to animate for PRETTY (from the mask)
    const prettyPaths = {
      p_left: prettyMaskElement.querySelector('#p_left'),
      p_right: prettyMaskElement.querySelector('#p_right'),
      r_left: prettyMaskElement.querySelector('#r_left'),
      r_right: prettyMaskElement.querySelector('#r_right'),
      e_left: prettyMaskElement.querySelector('#e_left'),
      e_middle: prettyMaskElement.querySelector('#e_middle'),
      t_1: prettyMaskElement.querySelector('#t_1'),
      t_2: prettyMaskElement.querySelector('#t_2'),
      y: prettyMaskElement.querySelector('#y')
    };

    // Set up stroke-dasharray for path animation (BEYOND mask paths)
    Object.values(beyondPaths).forEach(path => {
      if (path) {
        const length = path.getTotalLength();
        path.style.strokeDasharray = length;
        path.style.strokeDashoffset = length;
        // Ensure paths are visible in mask (white stroke)
        path.style.fill = 'none';
        path.style.stroke = 'white';
        path.style.strokeWidth = '30';
      }
    });

    // Set up stroke-dasharray for path animation (PRETTY mask paths)
    Object.values(prettyPaths).forEach(path => {
      if (path) {
        const length = path.getTotalLength();
        path.style.strokeDasharray = length;
        path.style.strokeDashoffset = length;
        // Ensure paths are visible in mask (white stroke)
        path.style.fill = 'none';
        path.style.stroke = 'white';
        path.style.strokeWidth = '30';
      }
    });

    // Create the animation timeline for BEYOND
    function createBeyondTimeline(reverse = false, stopAtPercent = 0) {
      const tl = gsap.timeline();
      const cfg = BEYOND_ANIMATION_CONFIG.paths;

      // Animate each path with configurable timing
      Object.keys(beyondPaths).forEach(key => {
        const path = beyondPaths[key];
        if (path && cfg[key]) {
          const pathLength = path.getTotalLength();
          // If reverse, stop at the specified percent (e.g., 0.2 = 20% visible = 80% offset)
          const targetOffset = reverse ? (pathLength * (1 - stopAtPercent)) : 0;
          
          tl.to(path, {
            strokeDashoffset: targetOffset,
            duration: cfg[key].duration,
            ease: 'power2.inOut'
          }, cfg[key].delay);
        }
      });

      return tl;
    }

    // Create the animation timeline for PRETTY
    function createPrettyTimeline(reverse = false, stopAtPercent = 0) {
      const tl = gsap.timeline();
      const cfg = PRETTY_ANIMATION_CONFIG.paths;

      // Animate each path with configurable timing
      Object.keys(prettyPaths).forEach(key => {
        const path = prettyPaths[key];
        if (path && cfg[key]) {
          const pathLength = path.getTotalLength();
          // If reverse, stop at the specified percent (e.g., 0.2 = 20% visible = 80% offset)
          const targetOffset = reverse ? (pathLength * (1 - stopAtPercent)) : 0;
          
          tl.to(path, {
            strokeDashoffset: targetOffset,
            duration: cfg[key].duration,
            ease: 'power2.inOut'
          }, cfg[key].delay);
        }
      });

      return tl;
    }

    // Main animation controller
    let animationState = {
      isRunning: false,
      isReverse: false,
      masterTimeline: null
    };

    // Create and run the yoyo animation loop with pause
    function runAnimationLoop() {
      if (animationState.isRunning) return;
      
      animationState.isRunning = true;
      animationState.isReverse = false;

      // Create master timeline that runs forward, pauses, then reverses to 20% seamlessly
      const masterTl = gsap.timeline({
        onComplete: () => {
          // Animation complete, reset for next loop
          animationState.isRunning = false;
          // Schedule next loop to start immediately for smooth yoyo
          setTimeout(() => {
            runAnimationLoop();
          }, 0);
        }
      });

      // Add forward animations
      const beyondForwardTl = createBeyondTimeline(false);
      const prettyForwardTl = createPrettyTimeline(false);
      
      masterTl.add(beyondForwardTl, 0);
      masterTl.add(prettyForwardTl, 0);

      // Calculate total duration of forward animation
      const beyondDuration = beyondForwardTl.duration();
      
      // Add 8-second pause after forward animation completes
      const pauseDuration = ANIMATION_LOOP_CONFIG.pauseDuration;
      
      // Add reverse animations that stop at configured percent visible (80% offset)
      const beyondReverseTl = createBeyondTimeline(true, ANIMATION_LOOP_CONFIG.reverseStopPercent);
      const prettyReverseTl = createPrettyTimeline(true, ANIMATION_LOOP_CONFIG.reverseStopPercent);
      
      masterTl.add(beyondReverseTl, beyondDuration + pauseDuration);
      masterTl.add(prettyReverseTl, beyondDuration + pauseDuration);
      
      // Immediately add forward animation again at the end (seamless loop, no pause)
      const reverseDuration = beyondReverseTl.duration();
      const beyondForwardTl2 = createBeyondTimeline(false);
      const prettyForwardTl2 = createPrettyTimeline(false);
      
      masterTl.add(beyondForwardTl2, beyondDuration + pauseDuration + reverseDuration);
      masterTl.add(prettyForwardTl2, beyondDuration + pauseDuration + reverseDuration);

      animationState.masterTimeline = masterTl;
    }

    // Stop the animation
    function stopAnimation() {
      if (animationState.masterTimeline) {
        animationState.masterTimeline.kill();
        animationState.masterTimeline = null;
      }
      animationState.isRunning = false;
    }

    // Start animation when Section 2 comes into view
    // For desktop: hook into smoothScroll snap callback
    // For mobile: use Intersection Observer
    const section2 = document.querySelector('.content-section[data-section="2"]');
    
    // Track if animation has been triggered
    let animationTriggered = false;
    
  // Mobile/touch device: IntersectionObserver + scroll fallback for iOS
  const IS_TOUCH = (window.smoothScroll && window.smoothScroll.isTouchDevice) ||
           (typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) ||
           (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches);
  if (IS_TOUCH) {
      if (section2) {
        const observer = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (!animationTriggered) {
              // Use boundingClientRect approach as a fallback when intersectionRatio is unreliable (some iOS cases)
              const ratioOkay = entry.intersectionRatio >= 0.28; // lower threshold
              const bounds = entry.boundingClientRect;
              const vh = window.innerHeight || document.documentElement.clientHeight;
              const pixelVisible = Math.min(vh, Math.max(0, vh - Math.max(bounds.top, 0))); // crude visible height estimate
              const pixelThresholdOkay = pixelVisible >= vh * 0.28; // at least 28% of viewport height
              if ((entry.isIntersecting && ratioOkay) || pixelThresholdOkay) {
                animationTriggered = true;
                runAnimationLoop();
                break;
              }
            }
          }
        }, {
          threshold: [0.1, 0.2, 0.28, 0.35, 0.5]
        });
        observer.observe(section2);

        // Fallback: if user has scrolled past 70% of first viewport but observer hasn't fired, start animation
        const touchFallbackCheck = () => {
          if (!animationTriggered) {
            const y = window.scrollY || document.documentElement.scrollTop || 0;
            if (y > window.innerHeight * 0.7) {
              animationTriggered = true;
              runAnimationLoop();
            }
          }
        };
        window.addEventListener('scroll', touchFallbackCheck, { passive: true });
        // Safety timeout: trigger if not started after 6s and user has interacted
        setTimeout(() => {
          if (!animationTriggered) {
            const y = window.scrollY || document.documentElement.scrollTop || 0;
            if (y > window.innerHeight * 0.4) {
              animationTriggered = true;
              runAnimationLoop();
            }
          }
        }, 6000);
      }
  } else {
      // Desktop: Hook into the smoothScroll snap callback
      const originalScrollTo = window.smoothScroll.scrollTo;
      window.smoothScroll.scrollTo = function(target, duration, onComplete) {
        // Check if this is the Section 2 snap
        const section2Top = section2 ? section2.offsetTop : window.innerHeight;
        
        const isSection2Snap = Math.abs(target - section2Top) < 1;
        
        // Call original scrollTo
        const wrappedCallback = () => {
          if (isSection2Snap && !animationTriggered) {
            // Start animation when snap completes
            animationTriggered = true;
            runAnimationLoop();
          }
          if (typeof onComplete === 'function') {
            onComplete();
          }
        };
        
        return originalScrollTo.call(this, target, duration, wrappedCallback);
      };
    }

    // Expose controls for debugging
    window.beyondAnimationControls = {
      start: runAnimationLoop,
      stop: stopAnimation,
      getState: () => animationState
    };

  } catch (error) {
    console.error('Error loading beyond/pretty SVG animations:', error);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBeyondAnimation);
} else {
  initBeyondAnimation();
}
