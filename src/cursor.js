// Custom Cursor Logic

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

    // Direct cursor movement without smoothing
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        
        // Update cursor position immediately
        cursor.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
        
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
        
        // Check if in top 25% of viewport, but not in first section
        const viewportHeight = window.innerHeight;
        const topZoneThreshold = viewportHeight * 0.25;
        isInTopZone = mouseY < topZoneThreshold && !isInFirstSection;
        
        // Show cursor when mouse moves in the page
        if (!isVisible) {
            cursor.style.opacity = '1';
            isVisible = true;
        }
    });
    
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
        
        // Apply transform: translate to follow cursor with lag, then rotate around the origin (which is at the dot)
        chevron.style.transform = `translate(calc(-50% + ${offsetX}px), calc(${distanceFromCenter}em + ${offsetY}px)) rotate(${currentRotation}deg)`;
        
        requestAnimationFrame(animateChevron);
    }
    
    // Start animation loop
    animateChevron();

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
