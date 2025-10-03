// Custom Cursor Logic

function initCustomCursor() {
    const cursor = document.querySelector('.custom-cursor');
    if (!cursor) return;

    let isVisible = false;

    // Direct cursor movement without smoothing
    document.addEventListener('mousemove', (e) => {
        cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
        
        // Show cursor when mouse moves in the page
        if (!isVisible) {
            cursor.style.opacity = '1';
            isVisible = true;
        }
    });

    // Define clickable selectors
    const clickableSelectors = 'a, button, input, textarea, select, [role="button"], .navbar__link, .side-nav__dot, .bottom-bar__social';

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
    document.addEventListener('mousedown', () => {
        cursor.classList.add('custom-cursor--active');
    });

    document.addEventListener('mouseup', () => {
        cursor.classList.remove('custom-cursor--active');
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
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initCustomCursor);
