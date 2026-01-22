/**
 * Contact Arrow Animation
 * Handles the hover animation for arrows/icons in buttons and links
 * Creates a swapping animation where the icon moves up and is replaced by
 * another icon coming from below, giving a continuous scrolling effect
 */

import { gsap } from 'gsap';

class ContactArrowAnimation {
  constructor() {
    this.animations = [];
    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  setup() {
    // Find all buttons and links that should have the animation
    const selectors = [
      '.enterprise-buttons button',
      '.enterprise-buttons a',
      '.contact-email-link',
      '.contact-return-btn'
    ];

    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        // Skip the Send button in contact form
        if (element.classList.contains('contact-form-submit')) {
          return;
        }

        const icon = element.querySelector('img');
        if (icon) {
          this.setupIconAnimation(element, icon);
        }
      });
    });
  }

  setupIconAnimation(parentElement, icon) {
    // Wait for image to load before setting up animation
    if (icon.complete) {
      this.createAnimation(parentElement, icon);
    } else {
      icon.addEventListener('load', () => this.createAnimation(parentElement, icon));
    }
  }

  createAnimation(parentElement, icon) {
    // Get icon dimensions after image is loaded
    const iconWidth = icon.offsetWidth;
    const iconHeight = icon.offsetHeight;

    // Determine animation direction based on element type
    const isReturnButton = parentElement.classList.contains('contact-return-btn');
    const moveDirection = isReturnButton ? 1 : -1; // 1 for down, -1 for up

    // Create a wrapper with overflow hidden
    const iconWrapper = document.createElement('span');
    iconWrapper.className = 'arrow-animation-wrapper';
    iconWrapper.style.cssText = `
      display: inline-block;
      overflow: hidden;
      vertical-align: middle;
      width: ${iconWidth}px;
      height: ${iconHeight}px;
      position: relative;
    `;
    
    // Insert wrapper before icon and move icon into it
    icon.parentNode.insertBefore(iconWrapper, icon);
    
    // Make icon absolute positioned within wrapper
    icon.style.position = 'absolute';
    icon.style.top = '0';
    icon.style.left = '0';
    icon.style.margin = '0';
    
    iconWrapper.appendChild(icon);

    // Create a clone of the icon positioned below/above inside the same wrapper
    const cloneIcon = icon.cloneNode(true);
    cloneIcon.style.position = 'absolute';
    cloneIcon.style.top = '0';
    cloneIcon.style.left = '0';
    cloneIcon.style.margin = '0';
    iconWrapper.appendChild(cloneIcon);

    // Set initial positions based on direction
    gsap.set(icon, { y: 0 });
    gsap.set(cloneIcon, { y: iconHeight * moveDirection });

    // Create the "over" timeline (icon moves in direction, clone comes from opposite)
    const overTimeline = gsap.timeline({ paused: true });
    overTimeline
      .to(icon, 0.3, { y: -iconHeight * moveDirection }, 0)
      .to(cloneIcon, 0.3, { y: 0 }, 0);

    // Create the "out" timeline (clone moves away, original comes back)
    const outTimeline = gsap.timeline({ paused: true });
    outTimeline
      .to(cloneIcon, 0.3, { y: iconHeight * moveDirection }, 0)
      .to(icon, 0.3, { y: 0 }, 0);

    // Mouse event handlers
    const handleMouseOver = () => {
      if (outTimeline.isActive()) {
        outTimeline.timeScale(3);
        overTimeline.delay(0.1);
      } else {
        overTimeline.delay(0).timeScale(1);
      }
      overTimeline.play(0);
    };

    const handleMouseOut = () => {
      if (overTimeline.isActive()) {
        overTimeline.timeScale(3);
        outTimeline.delay(0.1);
      } else {
        outTimeline.delay(0).timeScale(1);
      }
      outTimeline.play(0);
    };

    // Set up hover event listeners
    parentElement.addEventListener('mouseenter', handleMouseOver);
    parentElement.addEventListener('mouseleave', handleMouseOut);

    // Store animation data for cleanup
    this.animations.push({
      parentElement,
      overTimeline,
      outTimeline,
      handleMouseOver,
      handleMouseOut,
      iconWrapper
    });
  }

  destroy() {
    this.animations.forEach(({ parentElement, overTimeline, outTimeline, handleMouseOver, handleMouseOut, iconWrapper }) => {
      if (overTimeline) overTimeline.kill();
      if (outTimeline) outTimeline.kill();
      
      if (parentElement) {
        parentElement.removeEventListener('mouseenter', handleMouseOver);
        parentElement.removeEventListener('mouseleave', handleMouseOut);
      }
      
      if (iconWrapper && iconWrapper.parentNode) {
        const icon = iconWrapper.querySelector('img');
        if (icon) {
          parentElement.appendChild(icon);
        }
        iconWrapper.remove();
      }
    });
    this.animations = [];
  }
}

// Initialize
const contactArrowAnimation = new ContactArrowAnimation();

export default contactArrowAnimation;