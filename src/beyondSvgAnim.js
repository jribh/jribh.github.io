import { gsap } from 'gsap';
import beyondSvgUrl from 'url:./assets/beyond_svg.svg';
import prettySvgUrl from 'url:./assets/pretty_svg.svg';

// ============================================================================
// CONFIGURABLE ANIMATION PARAMETERS
// Change these values to adjust letter animation timing (in seconds)
// ============================================================================
const BEYOND_ANIMATION_CONFIG = {
  // Loop interval (every 5 seconds)
  loopInterval: 5.0,
  
  // Individual letter/path animation durations and start delays
  paths: {
    b_left: {
      duration: 1.0,
      delay: 0
    },
    b_right: {
      duration: 1.4,
      delay: 0.2
    },
    e_left: {
      duration: 1.8,
      delay: 0.4
    },
    e_middle: {
      duration: 0.4,
      delay: 1.2
    },
    y: {
      duration: 2.0,
      delay: 0.6
    },
    o_left: {
      duration: 1.6,
      delay: 0.8
    },
    o_right: {
      duration: 1.6,
      delay: 1.0
    },
    n: {
      duration: 2.0,
      delay: 1.2
    },
    d_left: {
      duration: 1.6,
      delay: 1.4
    },
    d_right: {
      duration: 1.4,
      delay: 1.6
    }
  }
};

const PRETTY_ANIMATION_CONFIG = {
  // Loop interval (every 5 seconds)
  loopInterval: 5.0,
  
  // Individual path animation durations and start delays
  paths: {
    p_left: {
      duration: 1.6,
      delay: 0
    },
    p_right: {
      duration: 1.0,
      delay: 0.2
    },
    r_left: {
      duration: 1.6,
      delay: 0.3
    },
    r_right: {
      duration: 1.8,
      delay: 0.5
    },
    e_left: {
      duration: 1.8,
      delay: 0.7
    },
    e_middle: {
      duration: 0.4,
      delay: 1.5
    },
    t_1: {
      duration: 1.6,
      delay: 0.9
    },
    t_2: {
      duration: 1.6,
      delay: 1.1
    },
    y: {
      duration: 2.0,
      delay: 1.3
    }
  }
};

// Export config for easy runtime tweaking via console
window.BEYOND_ANIMATION_CONFIG = BEYOND_ANIMATION_CONFIG;
window.PRETTY_ANIMATION_CONFIG = PRETTY_ANIMATION_CONFIG;

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
    
    // Load both SVGs from assets
    const [beyondSvg, prettySvg] = await Promise.all([
      loadSVG(beyondSvgUrl),
      loadSVG(prettySvgUrl)
    ]);

    // Add classes to SVGs
    beyondSvg.classList.add('beyond-svg');
    prettySvg.classList.add('pretty-svg');

    // Append SVGs to container
    container.appendChild(beyondSvg);
    container.appendChild(prettySvg);

    // Get all the paths to animate for BEYOND
    const beyondPaths = {
      b_left: beyondSvg.querySelector('#b_left'),
      b_right: beyondSvg.querySelector('#b_right'),
      e_left: beyondSvg.querySelector('#e_left'),
      e_middle: beyondSvg.querySelector('#e_middle'),
      y: beyondSvg.querySelector('#y'),
      o_left: beyondSvg.querySelector('#o_left'),
      o_right: beyondSvg.querySelector('#o_right'),
      n: beyondSvg.querySelector('#n'),
      d_left: beyondSvg.querySelector('#d_left'),
      d_right: beyondSvg.querySelector('#d_right')
    };

    // Get all the paths to animate for PRETTY
    const prettyPaths = {
      p_left: prettySvg.querySelector('#p_left'),
      p_right: prettySvg.querySelector('#p_right'),
      r_left: prettySvg.querySelector('#r_left'),
      r_right: prettySvg.querySelector('#r_right'),
      e_left: prettySvg.querySelector('#e_left'),
      e_middle: prettySvg.querySelector('#e_middle'),
      t_1: prettySvg.querySelector('#t_1'),
      t_2: prettySvg.querySelector('#t_2'),
      y: prettySvg.querySelector('#y')
    };

    // Set up stroke-dasharray for path animation (BEYOND)
    Object.values(beyondPaths).forEach(path => {
      if (path) {
        const length = path.getTotalLength();
        path.style.strokeDasharray = length;
        path.style.strokeDashoffset = length;
        // Ensure paths are visible and styled
        path.style.fill = 'none';
        path.style.stroke = '#FA5242';
        path.style.strokeWidth = '30';
      }
    });

    // Set up stroke-dasharray for path animation (PRETTY)
    Object.values(prettyPaths).forEach(path => {
      if (path) {
        const length = path.getTotalLength();
        path.style.strokeDasharray = length;
        path.style.strokeDashoffset = length;
        // Ensure paths are visible and styled
        path.style.fill = 'none';
        path.style.stroke = '#FA5242';
        path.style.strokeWidth = '30';
      }
    });

    // Create the animation timeline for BEYOND
    function createBeyondTimeline() {
      const tl = gsap.timeline();
      const cfg = BEYOND_ANIMATION_CONFIG.paths;

      // Animate each path with configurable timing
      Object.keys(beyondPaths).forEach(key => {
        const path = beyondPaths[key];
        if (path && cfg[key]) {
          tl.to(path, {
            strokeDashoffset: 0,
            duration: cfg[key].duration,
            ease: 'power2.inOut'
          }, cfg[key].delay);
        }
      });

      return tl;
    }

    // Create the animation timeline for PRETTY
    function createPrettyTimeline() {
      const tl = gsap.timeline();
      const cfg = PRETTY_ANIMATION_CONFIG.paths;

      // Animate each path with configurable timing
      Object.keys(prettyPaths).forEach(key => {
        const path = prettyPaths[key];
        if (path && cfg[key]) {
          tl.to(path, {
            strokeDashoffset: 0,
            duration: cfg[key].duration,
            ease: 'power2.inOut'
          }, cfg[key].delay);
        }
      });

      return tl;
    }

    // Start the animation loop for both SVGs
    function runAnimationLoop() {
      // Reset all BEYOND paths
      Object.values(beyondPaths).forEach(path => {
        if (path) {
          const length = path.getTotalLength();
          path.style.strokeDashoffset = length;
        }
      });

      // Reset all PRETTY paths
      Object.values(prettyPaths).forEach(path => {
        if (path) {
          const length = path.getTotalLength();
          path.style.strokeDashoffset = length;
        }
      });

      // Play both animations simultaneously
      const beyondTl = createBeyondTimeline();
      const prettyTl = createPrettyTimeline();
      
      // Schedule next animation after completion (using the longer timeline)
      beyondTl.eventCallback('onComplete', () => {
        setTimeout(() => {
          runAnimationLoop();
        }, BEYOND_ANIMATION_CONFIG.loopInterval * 1000);
      });
    }

    // Start the first animation
    runAnimationLoop();

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
