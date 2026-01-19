// Toggle visibility of fixed "All Projects" button based on the regular button's visibility
function initProjectBackButton() {
  const fixedButton = document.querySelector('.pd-back-button-fixed');
  const regularButton = document.querySelector('.project-details-content .pd-back-button:not(.pd-back-button-fixed)');

  if (!fixedButton || !regularButton) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        // When regular button is out of view, show fixed button
        if (!entry.isIntersecting) {
          fixedButton.classList.add('is-visible');
        } else {
          fixedButton.classList.remove('is-visible');
        }
      });
    },
    {
      // Trigger when the button is completely out of view
      threshold: 0,
      rootMargin: '0px'
    }
  );

  observer.observe(regularButton);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProjectBackButton);
} else {
  initProjectBackButton();
}
