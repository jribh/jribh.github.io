// Custom Cursor Logic
import smoothScroll from './smoothScroll.js';

function initCustomCursor() {
    const cursor = document.querySelector('.custom-cursor');
    if (!cursor) return;

    const chevron = cursor.querySelector('.custom-cursor__chevron');
    let isVisible = false;
    
    // Store current mouse position
    let mouseX = 0;
    let mouseY = 0;
    
    // Store chevron position for lagged movement
    let chevronX = 0;
    let chevronY = 0;
    
    // Lag factor for chevron (higher = more lag)
    const lagFactor = 0.25;
    
    // Track if cursor is in top 25% of screen
    let isInTopZone = false;
    let currentRotation = 0;
    let targetRotation = 0;
    
    // Track if text field is focused
    let isTextFieldFocused = false;

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

    // Function to update cursor zone status
    function updateCursorZone() {
        // Check if cursor is over the first section
        const firstSection = document.querySelector('.content-section[data-section="1"]');
        let isInFirstSection = false;
        
        if (firstSection) {
            const rect = firstSection.getBoundingClientRect();
            isInFirstSection = (
                mouseY >= rect.top &&
                mouseY <= rect.bottom &&
                mouseX >= rect.left &&
                mouseX <= rect.right
            );
        }
        
        // Check if cursor is over the last section (data-section="6")
        const lastSection = document.querySelector('.content-section[data-section="6"]');
        let isInLastSection = false;
        
        if (lastSection) {
            const rect = lastSection.getBoundingClientRect();
            isInLastSection = (
                mouseY >= rect.top &&
                mouseY <= rect.bottom &&
                mouseX >= rect.left &&
                mouseX <= rect.right
            );
        }
        
        // Check if in top 25% of viewport (but not in first section) OR if in last section
        const viewportHeight = window.innerHeight;
        const topZoneThreshold = viewportHeight * 0.25;
        isInTopZone = (mouseY < topZoneThreshold && !isInFirstSection) || isInLastSection;
    }

    // Direct cursor movement without smoothing
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        
        // Update cursor position immediately
        cursor.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
        
        // Update zone status
        updateCursorZone();
        
        // Show cursor when mouse moves in the page
        if (!isVisible) {
            cursor.style.opacity = '1';
            isVisible = true;
        }
    });
    
    // Update zone status on scroll as well (even when mouse is stationary)
    document.addEventListener('scroll', () => {
        updateCursorZone();
    }, { passive: true });
    
    // For smooth scroll, also listen to the custom scroll updates
    if (window.smoothScroll) {
        // Poll for scroll updates when using custom smooth scroll
        setInterval(() => {
            updateCursorZone();
        }, 16); // ~60fps
    }
    
    // Animate chevron with lag
    function animateChevron() {
        // Smoothly interpolate chevron position towards mouse position
        chevronX += (mouseX - chevronX) * lagFactor;
        chevronY += (mouseY - chevronY) * lagFactor;
        
        // Calculate offset from cursor center
        const offsetX = chevronX - mouseX;
        const offsetY = chevronY - mouseY;
        
        // Determine target rotation based on zone
        targetRotation = isInTopZone ? 180 : 0;
        
        // Smoothly interpolate rotation
        currentRotation += (targetRotation - currentRotation) * 0.12;
        
        // Distance from dot center to chevron starting position (below the dot)
        const distanceFromCenter = 1.8; // 0.8em (circle radius) + gap + chevron offset
        
        // Set transform origin to be at the cursor dot position
        // The chevron is 3em tall, so we need to offset the origin upward
        chevron.style.transformOrigin = `50% -${distanceFromCenter}em`;
        
        // Update CSS variable for rotation
        chevron.style.setProperty('--chevron-rotation', `${currentRotation}deg`);
        
        // Hide chevron if text field is focused, otherwise let CSS handle hover state
        if (isTextFieldFocused) {
            chevron.style.opacity = '0';
        } else {
            // Remove inline opacity to let CSS handle it (hover state)
            chevron.style.opacity = '';
        }
        
        // Apply transform: translate to follow cursor with lag, then rotate around the origin (which is at the dot)
        chevron.style.transform = `translate(calc(-50% + ${offsetX}px), calc(${distanceFromCenter}em + ${offsetY}px)) rotate(${currentRotation}deg)`;
        
        requestAnimationFrame(animateChevron);
    }
    
    // Start animation loop
    animateChevron();

    // Define clickable selectors - comprehensive list for all interactive elements
    const clickableSelectors = 'a, button, input, textarea, select, [role="button"], .navbar__link, .side-nav__dot, .bottom-bar__social, .work-card, .contact-form, .contact-email-link, .contact-copy-btn, .btn-primary, .btn-secondary, .btn-instagram, .contact-form-input, .contact-form-submit, .navbar__logo';

    // Handle hover on clickable elements
    const clickableElements = document.querySelectorAll(clickableSelectors);
    
    clickableElements.forEach((el) => {
        el.addEventListener('mouseenter', () => {
            cursor.classList.add('custom-cursor--hover');
        });
        
        el.addEventListener('mouseleave', () => {
            cursor.classList.remove('custom-cursor--hover');
        });
    });

    // Hide cursor when leaving the document
    document.addEventListener('mouseleave', () => {
        cursor.style.opacity = '0';
        isVisible = false;
    });

    // Re-show cursor when re-entering the document
    document.addEventListener('mouseenter', () => {
        cursor.style.opacity = '1';
        isVisible = true;
    });

    // Handle mouse down (click) state
    document.addEventListener('mousedown', (e) => {
        // If text field is focused, don't trigger scroll-click behavior
        if (isTextFieldFocused) {
            return;
        }
        
        // Check if this click will result in scrolling (chevron is visible, not hovering clickable element)
        const isClickable = e.target.closest(clickableSelectors);
        const isChevronVisible = !cursor.classList.contains('custom-cursor--hover');
        
        if (!isClickable && isChevronVisible) {
            // This will scroll - use scroll-click state
            cursor.classList.add('custom-cursor--scroll-click');
        } else {
            // Normal click on clickable element
            cursor.classList.add('custom-cursor--active');
        }
    });

    document.addEventListener('mouseup', () => {
        cursor.classList.remove('custom-cursor--active');
        cursor.classList.remove('custom-cursor--scroll-click');
    });

    // Handle mix-blend-mode invert effect on clickable elements
    const handleMixBlend = () => {
        const cursorRect = cursor.getBoundingClientRect();
        const cursorCenterX = cursorRect.left + cursorRect.width / 2;
        const cursorCenterY = cursorRect.top + cursorRect.height / 2;
        
        clickableElements.forEach((el) => {
            const rect = el.getBoundingClientRect();
            const isOver = (
                cursorCenterX >= rect.left &&
                cursorCenterX <= rect.right &&
                cursorCenterY >= rect.top &&
                cursorCenterY <= rect.bottom
            );
            
            if (isOver) {
                el.style.mixBlendMode = 'difference';
                el.style.color = 'white';
            } else {
                el.style.mixBlendMode = '';
                el.style.color = '';
            }
        });
        requestAnimationFrame(handleMixBlend);
    };

    handleMixBlend();

    // Force hide default cursor on body with additional event
    document.body.style.cursor = 'none';
    
    // Re-apply cursor: none when focus returns to window
    window.addEventListener('focus', () => {
        document.body.style.cursor = 'none';
    });

    // Click-to-scroll functionality
    initClickToScroll();
}

/**
 * Click-to-scroll functionality
 * Scrolls to next/previous section based on cursor position and chevron direction
 */
function initClickToScroll() {
    // Define clickable selectors that should NOT trigger scroll
    const clickableSelectors = 'a, button, input, textarea, select, [role="button"], .navbar__link, .side-nav__dot, .bottom-bar__social, .work-card, .contact-form, .contact-email-link, .contact-copy-btn, .bottom-bar, .side-nav, .btn-primary, .btn-secondary, .btn-instagram, .navbar__logo';
    
    // Text field selectors
    const textFieldSelectors = 'input[type="text"], input[type="email"], input[type="password"], textarea, input:not([type="button"]):not([type="submit"]):not([type="reset"])';
    
    // Track the last focused text field
    let lastFocusedTextField = null;
    
    // Listen for focus to track which field was focused
    document.addEventListener('focus', (e) => {
        if (e.target.matches && e.target.matches(textFieldSelectors)) {
            lastFocusedTextField = e.target;
        }
    }, true);
    
    // Clear on blur
    document.addEventListener('blur', (e) => {
        if (e.target === lastFocusedTextField) {
            // Small delay before clearing to allow click to check it
            setTimeout(() => {
                lastFocusedTextField = null;
            }, 100);
        }
    }, true);
    
    // Get all sections
    const getAllSections = () => document.querySelectorAll('.content-section');
    
    // Get current section based on scroll position
    const getCurrentSection = () => {
        const sections = getAllSections();
        const scrollPos = smoothScroll.scrollCurrent || window.scrollY;
        const viewportHeight = window.innerHeight;
        const scrollMid = scrollPos + viewportHeight / 2;
        
        let currentSection = sections[0];
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionBottom = sectionTop + section.offsetHeight;
            
            if (scrollMid >= sectionTop && scrollMid < sectionBottom) {
                currentSection = section;
            }
        });
        
        return currentSection;
    };
    
    // Get next or previous section
    const getAdjacentSection = (direction) => {
        const sections = Array.from(getAllSections());
        const currentSection = getCurrentSection();
        const currentIndex = sections.indexOf(currentSection);
        
        if (direction === 'down') {
            return currentIndex < sections.length - 1 ? sections[currentIndex + 1] : null;
        } else {
            return currentIndex > 0 ? sections[currentIndex - 1] : null;
        }
    };
    
    // Handle click event
    document.addEventListener('click', (e) => {
        // Check if a text field was just focused (click is defocusing it)
        if (lastFocusedTextField) {
            return; // Don't scroll, this click is just to defocus the field
        }
        
        // Check if clicking on a text field to focus it
        const clickingTextField = e.target.matches && e.target.matches(textFieldSelectors);
        if (clickingTextField) {
            return;
        }
        
        // Check if click is on a clickable element
        const isClickable = e.target.closest(clickableSelectors);
        if (isClickable) return;
        
        // Determine scroll direction based on cursor zone
        // Chevron points up (180deg) when in top 25% zone OR in last section
        const viewportHeight = window.innerHeight;
        const topZoneThreshold = viewportHeight * 0.25;
        const mouseY = e.clientY;
        
        // Check if in first section
        const firstSection = document.querySelector('.content-section[data-section="1"]');
        let isInFirstSection = false;
        if (firstSection) {
            const rect = firstSection.getBoundingClientRect();
            isInFirstSection = (
                mouseY >= rect.top &&
                mouseY <= rect.bottom
            );
        }
        
        // Check if in last section
        const lastSection = document.querySelector('.content-section[data-section="6"]');
        let isInLastSection = false;
        if (lastSection) {
            const rect = lastSection.getBoundingClientRect();
            isInLastSection = (
                mouseY >= rect.top &&
                mouseY <= rect.bottom
            );
        }
        
        const shouldScrollUp = (mouseY < topZoneThreshold && !isInFirstSection) || isInLastSection;
        const direction = shouldScrollUp ? 'up' : 'down';
        
        // Get target section
        const targetSection = getAdjacentSection(direction);
        
        if (targetSection) {
            const targetTop = targetSection.offsetTop;
            
            // Use smooth scroll if available, otherwise use native scroll
            if (smoothScroll && typeof smoothScroll.scrollTo === 'function') {
                smoothScroll.scrollTo(targetTop, 1200); // Slightly slower for click navigation
            } else {
                window.scrollTo({
                    top: targetTop,
                    behavior: 'smooth'
                });
            }
        }
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

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initCustomCursor);