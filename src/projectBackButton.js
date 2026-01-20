// Toggle visibility of fixed "All Projects" button based on the regular button's visibility.
// Uses IntersectionObserver when available, but also includes a scroll/resize fallback for robustness.
function initProjectBackButton() {
  const fixedButton = document.querySelector('.pd-back-button-fixed');
  const regularButton = document.querySelector(
    '.project-details-content .pd-back-button:not(.pd-back-button-fixed)'
  );

  if (!fixedButton) return;

  const showFixed = () => fixedButton.classList.add('is-visible');
  const hideFixed = () => fixedButton.classList.remove('is-visible');

  let rafId = null;
  const update = () => {
    rafId = null;

    // If we can't find the regular button, fall back to scroll position.
    if (!regularButton) {
      const y = (document.scrollingElement && document.scrollingElement.scrollTop) || window.scrollY || 0;
      if (y > 16) showFixed();
      else hideFixed();
      return;
    }

    const rect = regularButton.getBoundingClientRect();
    const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;
    const isVisible = rect.bottom > 0 && rect.top < viewportH;
    if (isVisible) hideFixed();
    else showFixed();
  };

  const requestUpdate = () => {
    if (rafId != null) return;
    rafId = window.requestAnimationFrame(update);
  };

  // Fallback updates (covers transformed layouts / edge browser cases)
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  requestUpdate();

  // Preferred observer
  if (regularButton && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries && entries[0];
        if (!entry) return;
        if (!entry.isIntersecting) showFixed();
        else hideFixed();
      },
      {
        threshold: 0,
        rootMargin: '0px',
      }
    );

    observer.observe(regularButton);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProjectBackButton);
} else {
  initProjectBackButton();
}
