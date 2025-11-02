import { gsap } from 'gsap';
import logoAnimUrl from './assets/logo_anim.svg';
import logoMaskUrl from './assets/logo_mask.svg';

// ============================================================================
// CONFIGURABLE ANIMATION PARAMETERS
// Change these values to adjust letter animation timing (in seconds)
// ============================================================================
const LOGO_ANIMATION_CONFIG = {
  // Overall loop interval during loading (every 4 seconds)
  loopInterval: 4.0,
  
  // Individual letter animation durations and start delays
  letters: {
    j: {
      duration: 1.2,
      delay: 0
    },
    r: {
      duration: 1.6,
      delay: 0.2
    },
    i_dot: {
      duration: 0.6,
      delay: 1.0
    },
    i_body: {
      duration: 1.6,
      delay: 0.6
    },
    b_upper: {
      duration: 1.2,
      delay: 0.4
    },
    b_lower: {
      duration: 1.2,
      delay: 0.6
    },
    h: {
      duration: 1.4,
      delay: 0.8
    }
  }
};

// Export config for easy runtime tweaking via console
window.LOGO_ANIMATION_CONFIG = LOGO_ANIMATION_CONFIG;

// Export a promise that resolves when the logo animation is complete
let logoAnimationCompleteResolve;
export const logoAnimationComplete = new Promise(resolve => {
  logoAnimationCompleteResolve = resolve;
});

// Track whether we're still in loading phase
let isLoadingPhase = true;
export function markLoadingComplete() {
  isLoadingPhase = false;
}

// Load the SVGs
async function loadSVG(url) {
  const response = await fetch(url);
  const text = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'image/svg+xml');
  return doc.querySelector('svg');
}

async function initLogoAnimation() {
  try {
    // Wait for loading overlay to exist
    const waitForLoadingOverlay = () => {
      return new Promise(resolve => {
        const check = () => {
          const loadingLogo = document.querySelector('.loading-overlay__logo');
          if (loadingLogo) {
            resolve(loadingLogo);
          } else {
            requestAnimationFrame(check);
          }
        };
        check();
      });
    };

    const loadingLogoImg = await waitForLoadingOverlay();
    
    // Load both SVGs
    const [logoSvg, maskSvg] = await Promise.all([
      loadSVG(logoAnimUrl),
      loadSVG(logoMaskUrl)
    ]);

    // Set up the logo SVG to match the loading overlay logo size
    logoSvg.setAttribute('width', '10em');
    logoSvg.setAttribute('height', 'auto');
    logoSvg.style.cssText = 'display: block; filter: drop-shadow(0 0 12px rgba(255, 255, 255, 0.08));';

    // Create a unique ID for the mask
    const maskId = 'logo-mask-' + Date.now();
    
    // Extract the mask paths and create a mask element
    const maskElement = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
    maskElement.setAttribute('id', maskId);
    maskElement.setAttribute('maskUnits', 'userSpaceOnUse');
    maskElement.setAttribute('x', '0');
    maskElement.setAttribute('y', '0');
    maskElement.setAttribute('width', '48');
    maskElement.setAttribute('height', '48');
    
    // Add a white background to the mask (everything visible by default)
    const whiteRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    whiteRect.setAttribute('width', '48');
    whiteRect.setAttribute('height', '48');
    whiteRect.setAttribute('fill', 'white');
    maskElement.appendChild(whiteRect);
    
    console.log('Mask element created:', maskElement);
    
    // Add the black shapes from the mask SVG (these will hide content)
    const maskPaths = maskSvg.querySelectorAll('path, rect');
    console.log('Mask shapes found:', maskPaths.length);
    maskPaths.forEach((path, idx) => {
      const clonedPath = path.cloneNode(true);
      maskElement.appendChild(clonedPath);
      console.log(`Added mask shape ${idx}:`, clonedPath);
    });
    
    // Add the mask definition to the logo SVG
    let defs = logoSvg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      logoSvg.insertBefore(defs, logoSvg.firstChild);
    }
    defs.appendChild(maskElement);
    
    // Apply the mask to ALL paths in the logo AND to any groups
    const allPaths = logoSvg.querySelectorAll('path');
    console.log('Logo paths found:', allPaths.length);
    allPaths.forEach((path, idx) => {
      path.setAttribute('mask', `url(#${maskId})`);
      console.log(`Applied mask to path ${idx}: ${path.id || 'unnamed'}`);
    });
    
    // Also apply to the group if it exists
    const logoGroup = logoSvg.querySelector('[id*="Logo"]');
    if (logoGroup) {
      logoGroup.setAttribute('mask', `url(#${maskId})`);
      console.log('Applied mask to group:', logoGroup.id);
    }

    // Replace the loading overlay logo with our animated SVG
    loadingLogoImg.replaceWith(logoSvg);
    console.log('Replaced loading logo with animated SVG');

    // Get all the letter paths
    const paths = {
      j: logoSvg.querySelector('#j'),
      r: logoSvg.querySelector('#r'),
      h: logoSvg.querySelector('#h'),
      i_body: logoSvg.querySelector('#i_body'),
      i_dot: logoSvg.querySelector('#i_dot'),
      b_upper: logoSvg.querySelector('#b_upper'),
      b_lower: logoSvg.querySelector('#b_lower')
    };

    // Set up stroke-dasharray for path animation
    Object.values(paths).forEach(path => {
      if (path) {
        const length = path.getTotalLength();
        path.style.strokeDasharray = length;
        path.style.strokeDashoffset = length;
      }
    });

    // Create the animation timeline
    function createAnimationTimeline() {
      const tl = gsap.timeline();

      // Use config values for animation parameters
      const cfg = LOGO_ANIMATION_CONFIG.letters;

      // Animate each letter path with configurable timing
      if (paths.j) {
        tl.to(paths.j, {
          strokeDashoffset: 0,
          duration: cfg.j.duration,
          ease: 'power2.inOut'
        }, cfg.j.delay);
      }

      if (paths.r) {
        tl.to(paths.r, {
          strokeDashoffset: 0,
          duration: cfg.r.duration,
          ease: 'power2.inOut'
        }, cfg.r.delay);
      }

      if (paths.i_dot) {
        tl.to(paths.i_dot, {
          strokeDashoffset: 0,
          duration: cfg.i_dot.duration,
          ease: 'power2.out'
        }, cfg.i_dot.delay);
      }

      if (paths.i_body) {
        tl.to(paths.i_body, {
          strokeDashoffset: 0,
          duration: cfg.i_body.duration,
          ease: 'power2.inOut'
        }, cfg.i_body.delay);
      }

      if (paths.b_upper) {
        tl.to(paths.b_upper, {
          strokeDashoffset: 0,
          duration: cfg.b_upper.duration,
          ease: 'power2.inOut'
        }, cfg.b_upper.delay);
      }

      if (paths.b_lower) {
        tl.to(paths.b_lower, {
          strokeDashoffset: 0,
          duration: cfg.b_lower.duration,
          ease: 'power2.inOut'
        }, cfg.b_lower.delay);
      }

      if (paths.h) {
        tl.to(paths.h, {
          strokeDashoffset: 0,
          duration: cfg.h.duration,
          ease: 'power2.inOut'
        }, cfg.h.delay);
      }

      return tl;
    }

    // First animation plays once, then repeats every 4 seconds during loading
    let currentTimeline = createAnimationTimeline();
    let loopInterval = null;
    
    currentTimeline.eventCallback('onComplete', () => {
      // Wait 1 second after first animation completes before resolving
      setTimeout(() => {
        logoAnimationCompleteResolve();
        console.log('Logo animation complete - startup can proceed');
        
        // Continue looping animation during loading if startup hasn't finished
        if (isLoadingPhase) {
          loopInterval = setInterval(() => {
            if (isLoadingPhase) {
              // Reset stroke-dashoffset for all paths
              Object.values(paths).forEach(path => {
                if (path) {
                  path.style.strokeDashoffset = path.getTotalLength();
                }
              });
              // Create and play a new timeline
              createAnimationTimeline().play();
            }
          }, LOGO_ANIMATION_CONFIG.loopInterval * 1000);
        }
      }, 1000);
    });

    // Cleanup function to stop looping when loading finishes
    window.stopLogoLooping = () => {
      isLoadingPhase = false;
      if (loopInterval) {
        clearInterval(loopInterval);
        loopInterval = null;
      }
    };

    console.log('Logo animation initialized with config:', LOGO_ANIMATION_CONFIG);

  } catch (error) {
    console.error('Error loading logo animation:', error);
    // If there's an error, resolve the promise anyway so the startup sequence can continue
    setTimeout(() => {
      logoAnimationCompleteResolve();
      // Mark loading complete to stop any loops
      markLoadingComplete();
    }, 1000);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLogoAnimation);
} else {
  initLogoAnimation();
}
