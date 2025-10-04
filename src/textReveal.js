import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Text Reveal Effect for Section 3 - Right Column
 * Splits text into words and animates opacity on scroll
 * Similar to CRED's "Not everyone makes it in" section
 */

class TextReveal {
  constructor() {
    this.init();
  }

  init() {
    // Wait for both DOM and window load, plus smooth scroll initialization
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        window.addEventListener('load', () => {
          // Wait for smooth scroll to initialize
          setTimeout(() => this.setup(), 800);
        });
      });
    } else if (document.readyState === 'interactive') {
      window.addEventListener('load', () => {
        setTimeout(() => this.setup(), 800);
      });
    } else {
      // Page already loaded, setup with delay for smooth scroll
      setTimeout(() => this.setup(), 800);
    }
  }

  setup() {
    // Select all paragraphs in the enterprise-right column
    const paragraphs = document.querySelectorAll('.enterprise-right .body-default');
    
    if (paragraphs.length === 0) {
      setTimeout(() => this.setup(), 1000);
      return;
    }

    // Process all paragraphs and collect all word spans
    const allWordSpans = [];
    
    paragraphs.forEach((paragraph, index) => {
      const words = this.splitIntoWords(paragraph.innerHTML);
      
      // Replace paragraph content with wrapped words
      const wrappedHTML = words
        .map((word, wordIndex) => {
          if (word.trim().startsWith('<img')) {
            return `<span class="text-reveal-word" style="opacity: 0.25;">${word}</span>`;
          }
          return `<span class="text-reveal-word" style="opacity: 0.25;">${word}</span>`;
        })
        .join(' ');
      
      paragraph.innerHTML = wrappedHTML;
      
      // Collect word spans from this paragraph
      const wordSpans = paragraph.querySelectorAll('.text-reveal-word');
      allWordSpans.push(...Array.from(wordSpans));
    });

    if (allWordSpans.length === 0) {
      return;
    }

    // Make only the first 8 words across ALL paragraphs white
    const initialWhiteWords = Math.min(8, allWordSpans.length);
    allWordSpans.slice(0, initialWhiteWords).forEach(span => {
      span.style.opacity = '1';
    });

    // Create individual ScrollTriggers for each word to maintain consistent reveal position
    allWordSpans.forEach((word, index) => {
      // Skip the first few words that are already white
      if (index < initialWhiteWords) return;

      gsap.to(word, {
        opacity: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: word,
          start: 'top 62%', // Word becomes white when it's 62% from top (38% from bottom)
          end: 'top 58%',   // Very tight transition zone (only 4% range)
          scrub: 0.2,       // Faster scrub for snappier response
          markers: false
        }
      });
    });
    
    // Refresh ScrollTrigger to recalculate positions
    ScrollTrigger.refresh();
  }

  splitIntoWords(html) {
    // Create a temporary div to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    const words = [];
    const nodes = Array.from(tempDiv.childNodes);
    
    nodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        // Split text nodes into words
        const textWords = node.textContent.split(/(\s+)/);
        words.push(...textWords.filter(w => w.trim().length > 0 || w === ' '));
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Keep element nodes (like img tags) intact
        words.push(node.outerHTML);
      }
    });
    
    return words;
  }

  // Clean up ScrollTrigger instances
  destroy() {
    ScrollTrigger.getAll().forEach(trigger => trigger.kill());
  }

  // Refresh ScrollTrigger (useful for dynamic content)
  refresh() {
    ScrollTrigger.refresh();
  }
}

// Initialize the text reveal effect
const textReveal = new TextReveal();

// Expose for debugging
window.textReveal = textReveal;

// Export for external use
export default textReveal;
