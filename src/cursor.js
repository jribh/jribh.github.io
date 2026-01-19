// Custom Cursor Logic
import smoothScroll from './smoothScroll.js';

// Touch-device detection (phones/tablets)
const IS_TOUCH_DEVICE = (function(){
  try {
    if (window.matchMedia && window.matchMedia('(pointer:coarse)').matches) return true;
    if ('ontouchstart' in window) return true;
    const ua = (navigator.userAgent || '').toLowerCase();
    return /mobi|iphone|ipad|android|tablet/.test(ua);
  } catch { return false; }
})();

function initCustomCursor() {
    const cursor = document.querySelector('.custom-cursor');
    if (!cursor) return;

    let isVisible = false;
    let isCursorLocked = false;
    let lockedTarget = null;
    let lockedRect = null;
    const returnAnimMap = new WeakMap(); // element -> rAF id
    let lastMagX = 0;
    let lastMagY = 0;
    let lastMagS = 1;
    
    // Store current mouse position
    let mouseX = 0;
    let mouseY = 0;
    
    // Track if text field is focused
    let isTextFieldFocused = false;
    
    // Track if mouse has ever entered the viewport (to avoid showing cursor at load)
    let mouseHasEnteredViewport = false;
    
    // Start with cursor hidden
    cursor.style.opacity = '0';
    isVisible = false;

    // Track focus/blur on text fields
    const textFieldSelectors = 'input[type="text"], input[type="email"], input[type="password"], textarea, input:not([type="button"]):not([type="submit"]):not([type="reset"])';
    
    // Function to update text field focus state
    const updateTextFieldFocus = () => {
        const activeElement = document.activeElement;
        isTextFieldFocused = activeElement && activeElement.matches(textFieldSelectors);
    };
    
    // Listen for focus events on all text fields
    document.addEventListener('focusin', (e) => {
        if (e.target.matches(textFieldSelectors)) {
            isTextFieldFocused = true;
        }
    });
    
    document.addEventListener('focusout', (e) => {
        if (e.target.matches(textFieldSelectors)) {
            isTextFieldFocused = false;
        }
    });

    // Direct cursor movement without smoothing
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        
        // Mark that mouse has entered the viewport on first move
        if (!mouseHasEnteredViewport) {
            mouseHasEnteredViewport = true;
        }

        // If not locked, update cursor position immediately
        if (!isCursorLocked) {
            cursor.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
        }
        
        // Show cursor when mouse moves in the page
        if (!isVisible && mouseHasEnteredViewport) {
            cursor.style.opacity = '1';
            isVisible = true;
        }
        
        // Re-hide default cursor on every move to ensure it stays hidden
        document.body.style.cursor = 'none';
    });
    
    // Define clickable selectors - comprehensive list for all interactive elements
    const clickableSelectors = 'a, button, input, textarea, select, [role="button"], .navbar__link, .side-nav__dot, .bottom-bar__social, .bottom-bar__visualizer, .work-card, .contact-form, .contact-email-link, .contact-copy-btn, .btn-primary, .btn-secondary, .btn-instagram, .contact-form-input, .contact-form-submit, .navbar__logo';

    // Magnetic targets (subset: nav links and buttons) as requested
    // Added .performance-hud__content so FPS HUD gets the same magnetic hover effects
    // Excluded .work-card from magnetic selectors to remove magnet effect from work cards
    const magneticSelectors = 'a:not(.work-card), .navbar__link, button:not(.work-card), .btn-link, .btn-instagram, .contact-form-submit, .side-nav__dot, .bottom-bar__social, .bottom-bar__visualizer, .navbar__logo, .performance-hud__content';

    // Text element selectors for text cursor behavior
    const textSelectors = 'h1, h2, h3, h4, h5, h6, p, input, textarea';

    // Handle hover on text elements (headings, paragraphs, inputs, textareas) - show text cursor
    // Filter out paragraphs that contain interactive elements, but include all inputs and textareas
    const allTextElements = document.querySelectorAll(textSelectors);
    const textElements = Array.from(allTextElements).filter(el => {
        const tagName = el.tagName.toLowerCase();
        // Exclude all text elements within .work-cards
        if (el.closest('.work-cards')) {
            return false;
        }
        // Include all inputs and textareas
        if (tagName === 'input' || tagName === 'textarea') {
            return true;
        }
        // For paragraphs, exclude those that contain interactive elements
        if (tagName === 'p') {
            return !el.querySelector('a, button, .btn-link, .btn-instagram, .contact-footer__link');
        }
        return true; // Include all headings
    });
    textElements.forEach((el) => {
        el.addEventListener('mouseenter', () => {
            if (isCursorLocked) return; // magnetic lock takes precedence
            cursor.classList.add('custom-cursor--text');
        });
        
        el.addEventListener('mouseleave', () => {
            if (isCursorLocked) return; // magnetic lock manages its own state
            cursor.classList.remove('custom-cursor--text');
        });
    });

    // Work card hover state - enlarge cursor
    const workCards = document.querySelectorAll('.work-card');
    workCards.forEach((card) => {
        card.addEventListener('mouseenter', () => {
            if (isCursorLocked) return; // magnetic lock takes precedence
            cursor.classList.add('custom-cursor--work-card');
        });
        
        card.addEventListener('mouseleave', () => {
            if (isCursorLocked) return; // magnetic lock manages its own state
            cursor.classList.remove('custom-cursor--work-card');
        });
    });

    // Apply [data-magnetic] and wire magnetic behavior
    const magneticElements = Array.from(document.querySelectorAll(magneticSelectors));
    if (!IS_TOUCH_DEVICE) {
        magneticElements.forEach((el) => el.setAttribute('data-magnetic', ''));
    }

    // Also add data-magnetic to navbar for transform support (skip on touch devices)
    const navbar = document.querySelector('.navbar');
    if (navbar && !IS_TOUCH_DEVICE) {
        navbar.setAttribute('data-magnetic', '');
    }

    function lockToTarget(target) {
        // Skip magnetic behavior on touch devices
        if (IS_TOUCH_DEVICE) return;

        // Cancel any ongoing return animation for this target only
        const existing = returnAnimMap.get(target);
        if (existing) {
            cancelAnimationFrame(existing);
            returnAnimMap.delete(target);
        }
        lockedTarget = target;
        lockedRect = target.getBoundingClientRect();
        isCursorLocked = true;

        cursor.classList.add('custom-cursor--locked');

        // Start continuous position updates
        startLockRefresh();

        // Center the cursor container on the target
        const cx = lockedRect.left + lockedRect.width / 2;
        const cy = lockedRect.top + lockedRect.height / 2;
        cursor.style.transform = `translate(${cx}px, ${cy}px)`;

        // Morph the circle into the rounded rect size using CSS variables
        const circle = cursor.querySelector('.custom-cursor__circle');
        circle.style.width = `${lockedRect.width}px`;
        circle.style.height = `${lockedRect.height}px`;
        circle.style.borderRadius = `0.8em`; // Rounded rect
        circle.style.transform = `translate(-50%, -50%) scale(var(--cursor-scale, 1))`;

        // Light grow on target
        lastMagS = 1.025; // reduced scaling for subtler effect
        target.style.setProperty('--ms', lastMagS);
    }

    function updateMagneticOffsets(e) {
        // Skip magnetic behavior on touch devices
        if (IS_TOUCH_DEVICE) return;

        if (!isCursorLocked || !lockedTarget || !lockedRect) return;
        const x = e.clientX;
        const y = e.clientY;
        const halfW = lockedRect.width / 2;
        const halfH = lockedRect.height / 2;
        const offX = Math.max(-1, Math.min(1, (x - (lockedRect.left + halfW)) / halfW));
        const offY = Math.max(-1, Math.min(1, (y - (lockedRect.top + halfH)) / halfH));

        // Cursor content subtle offset
        const cursorDX = offX * 3; // px
        const cursorDY = offY * 3; // px
        const circle = cursor.querySelector('.custom-cursor__circle');
        circle.style.transform = `translate(calc(-50% + ${cursorDX}px), calc(-50% + ${cursorDY}px)) scale(var(--cursor-scale, 1))`;

        // Target magnet movement (reduced by 50%)
        lastMagX = offX * 3; // px
        lastMagY = offY * 2; // px
        lockedTarget.style.setProperty('--mx', `${lastMagX}px`);
        lockedTarget.style.setProperty('--my', `${lastMagY}px`);

        // Also move navbar when hovering on navbar links (but not in section 1)
        if (lockedTarget.classList.contains('navbar__link') && !isInSection1()) {
            const navbar = lockedTarget.closest('.navbar');
            if (navbar) {
                // Apply reduced movement to navbar (50% of link movement)
                navbar.style.setProperty('--mx', `${lastMagX * 0.5}px`);
                navbar.style.setProperty('--my', `${lastMagY * 0.5}px`);
            }
        }
    }

    function unlockTarget(target) {
        // Skip magnetic behavior on touch devices
        if (IS_TOUCH_DEVICE) return;

        if (!isCursorLocked) return;
        // If leaving one target but immediately entering another, ignore unlock here
        if (target && lockedTarget && target !== lockedTarget) return;

        // Add exiting state for customizable transition
        cursor.classList.remove('custom-cursor--locked');
        cursor.classList.add('custom-cursor--exiting');

        const circle = cursor.querySelector('.custom-cursor__circle');
        // Reset to default circular cursor immediately (will transition smoothly via exiting state)
        circle.style.width = '';
        circle.style.height = '';
        circle.style.borderRadius = '';
        circle.style.transform = 'translate(-50%, -50%) scale(var(--cursor-scale, 1))';

        // Remove exiting class after transition completes
        setTimeout(() => {
            cursor.classList.remove('custom-cursor--exiting');
        }, 120); // Match transition duration in CSS

        // Animate target back smoothly using JS tween to avoid CSS transition overrides
        if (lockedTarget) {
            const startX = lastMagX;
            const startY = lastMagY;
            const startS = lastMagS;
            const endX = 0;
            const endY = 0;
            const endS = 1;
            const duration = 180; // ms
            const startTime = performance.now();

            const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

            const targetEl = lockedTarget; // capture per-element
            const animateBack = (now) => {
                const t = Math.min(1, (now - startTime) / duration);
                const e = easeOutCubic(t);
                const curX = startX + (endX - startX) * e;
                const curY = startY + (endY - startY) * e;
                const curS = startS + (endS - startS) * e;
                targetEl.style.setProperty('--mx', `${curX}px`);
                targetEl.style.setProperty('--my', `${curY}px`);
                targetEl.style.setProperty('--ms', curS);

                // Also animate navbar back if it was a navbar link (but not in section 1)
                if (targetEl.classList.contains('navbar__link') && !isInSection1()) {
                    const navbar = targetEl.closest('.navbar');
                    if (navbar) {
                        navbar.style.setProperty('--mx', `${curX * 0.5}px`);
                        navbar.style.setProperty('--my', `${curY * 0.5}px`);
                    }
                }

                if (t < 1) {
                    const id = requestAnimationFrame(animateBack);
                    returnAnimMap.set(targetEl, id);
                } else {
                    // Finalize
                    targetEl.style.setProperty('--mx', '0px');
                    targetEl.style.setProperty('--my', '0px');
                    targetEl.style.setProperty('--ms', 1);
                    const existing = returnAnimMap.get(targetEl);
                    if (existing) returnAnimMap.delete(targetEl);

                    // Also finalize navbar
                    if (targetEl.classList.contains('navbar__link') && !isInSection1()) {
                        const navbar = targetEl.closest('.navbar');
                        if (navbar) {
                            navbar.style.setProperty('--mx', '0px');
                            navbar.style.setProperty('--my', '0px');
                        }
                    }
                }
            };
            const id = requestAnimationFrame(animateBack);
            returnAnimMap.set(targetEl, id);
        }

        isCursorLocked = false;
        lockedTarget = null;
        lockedRect = null;
        lastMagX = 0; lastMagY = 0; lastMagS = 1;

        // Stop continuous position updates
        stopLockRefresh();

        // Snap cursor back to actual mouse position
        cursor.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
    }

    // Wire events for magnetic elements (skip on touch devices)
    if (!IS_TOUCH_DEVICE) {
        magneticElements.forEach((el) => {
            el.addEventListener('mouseenter', (ev) => {
                // Ignore inputs/textareas inside form fields where text cursor is desired
                if (ev.target.matches('input, textarea, select')) return;
                lockToTarget(ev.currentTarget);
            }, { passive: true });

            el.addEventListener('mousemove', (ev) => {
                if (!isCursorLocked) return;
                // Keep rect up-to-date when content moves (smooth scroll)
                lockedRect = ev.currentTarget.getBoundingClientRect();
                updateMagneticOffsets(ev);
            }, { passive: true });

            el.addEventListener('mouseleave', (ev) => {
                unlockTarget(ev.currentTarget);
            }, { passive: true });
        });
    }

    // Keep lock centered on scroll/resize
    const refreshLock = () => {
        if (!isCursorLocked || !lockedTarget) return;
        lockedRect = lockedTarget.getBoundingClientRect();
        const cx = lockedRect.left + lockedRect.width / 2;
        const cy = lockedRect.top + lockedRect.height / 2;
        cursor.style.transform = `translate(${cx}px, ${cy}px)`;
    };
    window.addEventListener('scroll', refreshLock, { passive: true });
    window.addEventListener('resize', refreshLock);

    // Continuously refresh lock position when cursor is locked (in case element moves)
    let lockRefreshId = null;
    const startLockRefresh = () => {
        if (lockRefreshId) return; // Already running
        const refreshLoop = () => {
            if (!isCursorLocked) {
                lockRefreshId = null;
                return;
            }
            refreshLock();
            lockRefreshId = requestAnimationFrame(refreshLoop);
        };
        lockRefreshId = requestAnimationFrame(refreshLoop);
    };

    const stopLockRefresh = () => {
        if (lockRefreshId) {
            cancelAnimationFrame(lockRefreshId);
            lockRefreshId = null;
        }
    };

    // Hide cursor when leaving the document
    document.addEventListener('mouseleave', () => {
        cursor.style.opacity = '0';
        isVisible = false;
    });

    // Re-show cursor when re-entering the document
    document.addEventListener('mouseenter', () => {
        // Only show cursor if it has previously entered the viewport
        if (mouseHasEnteredViewport) {
            cursor.style.opacity = '1';
            isVisible = true;
        }
    });

    // Handle mouse down (click) state
    document.addEventListener('mousedown', (e) => {
        // If text field is focused, don't trigger any special behavior
        if (isTextFieldFocused) {
            return;
        }
        
        // Scale down cursor on click (like CodePen) - always apply, even when locked
        cursor.style.setProperty('--cursor-scale', '0.94');
        
        // Add active state for visual feedback
        cursor.classList.add('custom-cursor--active');
    });

    document.addEventListener('mouseup', () => {
        // Scale back up cursor on release
        cursor.style.setProperty('--cursor-scale', '1');
        
        cursor.classList.remove('custom-cursor--active');
    });

    // Force hide default cursor on body with additional event
    document.body.style.cursor = 'none';
    
    // Re-apply cursor: none when focus returns to window
    window.addEventListener('focus', () => {
        document.body.style.cursor = 'none';
    });
}

/**
 * Helper function to check if element is in viewport
 */
function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    return (
        rect.top < window.innerHeight &&
        rect.bottom > 0
    );
}

/**
 * Helper function to check if we're currently in section 1
 */
function isInSection1() {
    const firstSection = document.querySelector('.content-section[data-section="1"]');
    if (!firstSection) return false;
    
    const rect = firstSection.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    
    // Check if section 1 is currently visible (covers most of the viewport)
    return rect.top <= 0 && rect.bottom >= viewportHeight * 0.5;
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initCustomCursor);