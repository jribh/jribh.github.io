import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Big Cats Image Reveal Animation
 * 
 * Wraps each image in a container with overflow hidden,
 * then reveals the image by animating a vertical mask using clip-path.
 * The animation triggers when scrolling into view with a stagger effect.
 */

// Get scroller element for ScrollTrigger
const getScroller = () => {
    // Check if smooth scroll is actually active (not just if the instance exists)
    return (window.smoothScroll && window.smoothScroll.isRunning) ? '#content' : window;
};

function initBigCatsReveal() {
    const images = document.querySelectorAll('.big-cats-grid .big-cat-image');

    if (!images.length) {
        console.warn('No big cat images found');
        return;
    }

    // Wrap each image in a reveal container
    images.forEach((img) => {
        // Create wrapper for overflow/mask control
        const wrapper = document.createElement('div');
        wrapper.className = 'big-cat-reveal-wrapper';

        // Insert wrapper before image and move image inside
        img.parentNode.insertBefore(wrapper, img);
        wrapper.appendChild(img);

        // Initial states: hide via vertical clip-path and slight scale
        gsap.set(wrapper, { autoAlpha: 1 });
        gsap.set(img, {
            clipPath: 'inset(100% 0% 0% 0%)', // hidden from bottom
            // webkitClipPath for Safari fallback
            webkitClipPath: 'inset(100% 0% 0% 0%)',
            scale: 1.12,
        });

    });

    // Build separate scrubbed timelines for each row
    const imagesArray = Array.from(document.querySelectorAll('.big-cats-grid .big-cat-image'));
    
    // Detect if we're in mobile layout (768px and below)
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    
    let firstRow, secondRow, thirdRow, fourthRow;
    
    if (isMobile) {
        // Mobile: 2 images per row, 4 rows total
        firstRow = imagesArray.slice(0, 2);   // images 1-2
        secondRow = imagesArray.slice(2, 4);  // images 3-4
        thirdRow = imagesArray.slice(4, 6);   // images 5-6
        fourthRow = imagesArray.slice(6, 8);  // images 7-8
    } else {
        // Desktop: 4 images per row, 2 rows total
        firstRow = imagesArray.slice(0, 4);   // images 1-4
        secondRow = imagesArray.slice(4, 8);  // images 5-8
    }

    // First row timeline
    const tl1 = gsap.timeline({
        defaults: { ease: 'power3.out' },
        scrollTrigger: {
            trigger: '.big-cats-grid',
            scroller: getScroller(),
            start: isMobile ? 'top 85%' : 'top 75%',
            end: isMobile ? 'top 65%' : 'top 15%',
            scrub: 1,
            invalidateOnRefresh: true,
            // markers: true,
        },
    });

    tl1.to(firstRow, {
        clipPath: 'inset(0% 0% 0% 0%)',
        webkitClipPath: 'inset(0% 0% 0% 0%)',
        duration: 1,
        stagger: {
            each: 0.08,
            from: 'start',
        },
    }, 0);

    tl1.to(firstRow, {
        scale: 1,
        duration: 1.1,
        ease: 'power2.out',
        stagger: {
            each: 0.08,
            from: 'start',
        },
    }, 0);

    // Second row timeline
    const tl2 = gsap.timeline({
        defaults: { ease: 'power3.out' },
        scrollTrigger: {
            trigger: '.big-cats-grid',
            scroller: getScroller(),
            start: isMobile ? 'top 65%' : 'top 45%',
            end: isMobile ? 'top 45%' : 'top -25%',
            scrub: 0.8,
            invalidateOnRefresh: true,
            // markers: true,
        },
    });

    tl2.to(secondRow, {
        clipPath: 'inset(0% 0% 0% 0%)',
        webkitClipPath: 'inset(0% 0% 0% 0%)',
        duration: 1,
        stagger: {
            each: 0.08,
            from: 'start',
        },
    }, 0);

    tl2.to(secondRow, {
        scale: 1,
        duration: 1.1,
        ease: 'power2.out',
        stagger: {
            each: 0.08,
            from: 'start',
        },
    }, 0);

    // Mobile only: Third and fourth row timelines
    if (isMobile) {
        const tl3 = gsap.timeline({
            defaults: { ease: 'power3.out' },
            scrollTrigger: {
                trigger: '.big-cats-grid',
                scroller: getScroller(),
                start: 'top 45%',
                end: 'top 25%',
                scrub: 0.8,
                invalidateOnRefresh: true,
            },
        });

        tl3.to(thirdRow, {
            clipPath: 'inset(0% 0% 0% 0%)',
            webkitClipPath: 'inset(0% 0% 0% 0%)',
            duration: 1,
            stagger: {
                each: 0.08,
                from: 'start',
            },
        }, 0);

        tl3.to(thirdRow, {
            scale: 1,
            duration: 1.1,
            ease: 'power2.out',
            stagger: {
                each: 0.08,
                from: 'start',
            },
        }, 0);

        const tl4 = gsap.timeline({
            defaults: { ease: 'power3.out' },
            scrollTrigger: {
                trigger: '.big-cats-grid',
                scroller: getScroller(),
                start: 'top 25%',
                end: 'top 5%',
                scrub: 0.8,
                invalidateOnRefresh: true,
            },
        });

        tl4.to(fourthRow, {
            clipPath: 'inset(0% 0% 0% 0%)',
            webkitClipPath: 'inset(0% 0% 0% 0%)',
            duration: 1,
            stagger: {
                each: 0.08,
                from: 'start',
            },
        }, 0);

        tl4.to(fourthRow, {
            scale: 1,
            duration: 1.1,
            ease: 'power2.out',
            stagger: {
                each: 0.08,
                from: 'start',
            },
        }, 0);
    }

    // Ensure ScrollTrigger calculates after DOM mutations
    ScrollTrigger.refresh();
}

// Wait for DOM and smooth scroll to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Small delay to ensure smooth scroll is initialized
        setTimeout(initBigCatsReveal, 100);
    });
} else {
    setTimeout(initBigCatsReveal, 100);
}

export { initBigCatsReveal };
