import { gsap } from 'gsap';
// Use explicit url: imports so Parcel always treats these as file URLs in dev and build
import logoAnimUrl from 'url:./assets/logo_anim.svg';
import logoMaskUrl from 'url:./assets/logo_mask.svg';

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
    // Wait for loading overlay content to exist
    const waitForLoadingOverlay = () => {
      return new Promise(resolve => {
        const check = () => {
          const loadingContent = document.querySelector('.loading-overlay__content');
          if (loadingContent) {
            resolve(loadingContent);
          } else {
            requestAnimationFrame(check);
          }
        };
        check();
      });
    };

    const loadingContent = await waitForLoadingOverlay();
    
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

    // Derive mask box from the logo's viewBox to keep coordinates in sync
    const vbVals = (logoSvg.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
    const vbX = Number.isFinite(vbVals[0]) ? vbVals[0] : 0;
    const vbY = Number.isFinite(vbVals[1]) ? vbVals[1] : 0;
    const vbW = Number.isFinite(vbVals[2]) ? vbVals[2] : 48;
    const vbH = Number.isFinite(vbVals[3]) ? vbVals[3] : 48;

    // Build the mask inside the same SVG to avoid cross-doc references
    const maskElement = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
    maskElement.setAttribute('id', maskId);
    maskElement.setAttribute('maskUnits', 'userSpaceOnUse');
    maskElement.setAttribute('x', String(vbX));
    maskElement.setAttribute('y', String(vbY));
    maskElement.setAttribute('width', String(vbW));
    maskElement.setAttribute('height', String(vbH));
    // Hint some engines (WebKit) to use luminance masking
    maskElement.setAttribute('style', 'mask-type:luminance');

    // White background: show everything by default
    const whiteRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    whiteRect.setAttribute('x', String(vbX));
    whiteRect.setAttribute('y', String(vbY));
    whiteRect.setAttribute('width', String(vbW));
    whiteRect.setAttribute('height', String(vbH));
    whiteRect.setAttribute('fill', 'white');
    maskElement.appendChild(whiteRect);

    // Add black shapes from the external mask SVG
    const maskShapes = maskSvg.querySelectorAll('path, rect, circle, ellipse, polygon, polyline');
    maskShapes.forEach((node) => {
      const cloned = node.cloneNode(true);
      // Ensure these draw as "holes" in the mask regardless of original styling
      if (!cloned.getAttribute('fill')) cloned.setAttribute('fill', 'black');
      cloned.setAttribute('stroke', 'none');
      maskElement.appendChild(cloned);
    });

    // Add the mask into <defs>
    let defs = logoSvg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      logoSvg.insertBefore(defs, logoSvg.firstChild);
    }
    defs.appendChild(maskElement);

    // Wrap all visible content in a <g> and apply the mask to the group
    const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    wrapper.setAttribute('class', 'masked-logo-content');
    wrapper.setAttribute('mask', `url(#${maskId})`);
    const childrenToWrap = Array.from(logoSvg.childNodes).filter((n) => n.nodeType === 1 && n.nodeName.toLowerCase() !== 'defs');
    childrenToWrap.forEach((n) => wrapper.appendChild(n));
    logoSvg.appendChild(wrapper);

    // Replace the placeholder div with our animated SVG
    loadingContent.replaceChild(logoSvg, loadingContent.firstChild);

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
      // Wait 400ms after first animation completes before resolving
      setTimeout(() => {
        logoAnimationCompleteResolve();
        
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
      }, 400);
    });

    // Cleanup function to stop looping when loading finishes
    window.stopLogoLooping = () => {
      isLoadingPhase = false;
      if (loopInterval) {
        clearInterval(loopInterval);
        loopInterval = null;
      }
    };

  } catch (error) {
    console.error('Error loading logo animation:', error);
    // If there's an error, resolve the promise anyway so the startup sequence can continue
    setTimeout(() => {
      logoAnimationCompleteResolve();
      // Mark loading complete to stop any loops
      markLoadingComplete();
    }, 400);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLogoAnimation);
} else {
  initLogoAnimation();
}
