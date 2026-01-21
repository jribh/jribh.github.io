import { withVenetianPageTransition } from './venetianBlinds.js';
import { gsap } from 'gsap';

function isSameOriginUrl(url) {
  try {
    const u = new URL(url, window.location.href);
    return u.origin === window.location.origin;
  } catch {
    return false;
  }
}

function resolveSameOriginPath(href) {
  const u = new URL(href, window.location.href);
  // Preserve query/hash if ever used on project pages.
  return `${u.pathname}${u.search || ''}${u.hash || ''}`;
}

function isProjectDetailsUrl(url) {
  try {
    const u = new URL(url, window.location.href);
    return /\/project-details-.*\.htm$/.test(u.pathname);
  } catch {
    return false;
  }
}

function getScrollPosition() {
  const ss = window.smoothScroll;
  if (ss && typeof ss.scrollCurrent === 'number') return ss.scrollCurrent;
  return window.scrollY || 0;
}

function setScrollPosition(y) {
  const ss = window.smoothScroll;
  if (ss && ss.content && !ss.isTouchDevice) {
    ss.scrollTarget = y;
    ss.scrollCurrent = y;
    ss.onScroll();
    if (ss.scrollbarContainer) ss.scrollbarContainer.scrollTop = y;
    return;
  }
  window.scrollTo(0, y);
}

let lastHomeScroll = null;
let homeUrl = null;

let navQueue = Promise.resolve();
function runNavExclusive(task) {
  navQueue = navQueue.then(task, task);
  return navQueue;
}

function isOverlayOpen() {
  return !!window.__projectOverlayOpen || document.body.classList.contains('project-overlay-open');
}

function setupOverlayBackButtonObserver(overlayRoot) {
  if (!overlayRoot) return;
  const fixedButton = overlayRoot.querySelector('.pd-back-button-fixed');
  const regularButton = overlayRoot.querySelector('.pd-back-button:not(.pd-back-button-fixed)');
  if (!fixedButton || !regularButton) return;

  const showFixed = () => fixedButton.classList.add('is-visible');
  const hideFixed = () => fixedButton.classList.remove('is-visible');

  // Clean up any previous observer/listeners when swapping projects
  if (overlayRoot.__pdBackBtnObserver) {
    try { overlayRoot.__pdBackBtnObserver.disconnect(); } catch {}
    overlayRoot.__pdBackBtnObserver = null;
  }
  if (typeof overlayRoot.__pdBackBtnCleanup === 'function') {
    try { overlayRoot.__pdBackBtnCleanup(); } catch {}
    overlayRoot.__pdBackBtnCleanup = null;
  }

  let rafId = null;
  const update = () => {
    rafId = null;
    const rootRect = overlayRoot.getBoundingClientRect();
    const rect = regularButton.getBoundingClientRect();
    const isVisible = rect.bottom > rootRect.top && rect.top < rootRect.bottom;
    if (isVisible) hideFixed();
    else showFixed();
  };

  const requestUpdate = () => {
    if (rafId != null) return;
    rafId = window.requestAnimationFrame(update);
  };

  const onScroll = () => requestUpdate();
  overlayRoot.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', requestUpdate);
  requestUpdate();

  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (!entry) return;
      if (!entry.isIntersecting) showFixed();
      else hideFixed();
    },
    {
      root: overlayRoot,
      threshold: 0,
    }
  );

  observer.observe(regularButton);
  overlayRoot.__pdBackBtnObserver = observer;
  overlayRoot.__pdBackBtnCleanup = () => {
    overlayRoot.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', requestUpdate);
    if (rafId != null) window.cancelAnimationFrame(rafId);
  };
}

function ensureOverlay() {
  let overlay = document.getElementById('project-overlay');
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = 'project-overlay';
  overlay.className = 'project-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  document.body.appendChild(overlay);
  return overlay;
}

function setOverlayOpen(isOpen) {
  window.__projectOverlayOpen = isOpen;
  document.body.classList.toggle('project-overlay-open', isOpen);
}

function pauseSmoothScroll() {
  const ss = window.smoothScroll;
  if (ss && typeof ss.stop === 'function') ss.stop();
}

function resumeSmoothScroll() {
  const ss = window.smoothScroll;
  if (ss && !ss.isTouchDevice && typeof ss.start === 'function') ss.start();
}

async function fetchProjectDom(href) {
  const resolved = resolveSameOriginPath(href);
  const res = await fetch(resolved, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load ${href}: ${res.status}`);
  const html = await res.text();
  return new DOMParser().parseFromString(html, 'text/html');
}

function buildOverlayContentFromDoc(doc, href) {
  const overlay = ensureOverlay();
  overlay.innerHTML = '';

  const hero = doc.querySelector('.project-details-hero');
  const main = doc.querySelector('.project-details-content');

  const title = doc.querySelector('title')?.textContent?.trim();
  if (title) document.title = title;

  const insertedHero = hero ? document.importNode(hero, true) : null;
  const insertedMain = main ? document.importNode(main, true) : null;

  if (insertedHero) {
    overlay.appendChild(insertedHero);
    gsap.set(insertedHero, { autoAlpha: 0, y: 20 });
  }
  if (insertedMain) {
    overlay.appendChild(insertedMain);
    // Don't translate the entire main container: it contains a fixed-position back button.
    // A transformed ancestor would make `position: fixed` behave like `absolute`.
    gsap.set(insertedMain, { autoAlpha: 0 });
  }

  // Cursor wiring happens on initial DOMContentLoaded. Project pages are injected later,
  // so refresh hover targets to enable text cursor + magnetic hover.
  if (typeof window.__refreshCursorTargets === 'function') {
    window.__refreshCursorTargets(overlay);
  }

  overlay.dataset.href = href;
  overlay.scrollTop = 0;

  // Ensure fixed back button visibility logic works inside the overlay scroller.
  setupOverlayBackButtonObserver(overlay);

  return { hero: insertedHero, main: insertedMain };
}

async function openProject(href, { pushState = true, replaceState = false, animate = true } = {}) {
  return runNavExclusive(async () => {
    if (!href || !isSameOriginUrl(href)) return;

    const resolvedHref = resolveSameOriginPath(href);

    const homeScroll = isOverlayOpen()
      ? (typeof lastHomeScroll === 'number' ? lastHomeScroll : getScrollPosition())
      : getScrollPosition();
    lastHomeScroll = homeScroll;

    if (pushState) {
      if (!homeUrl) homeUrl = window.location.href;
      const baseState = history.state && typeof history.state === 'object' ? history.state : {};
      history.replaceState({ ...baseState, homeScroll }, '', window.location.href);
      history.pushState({ __project: true, href: resolvedHref, homeScroll }, '', resolvedHref);
    } else if (replaceState) {
      history.replaceState({ __project: true, href: resolvedHref, homeScroll }, '', resolvedHref);
    }

    const doSwap = async () => {
      pauseSmoothScroll();
      setOverlayOpen(true);
      const doc = await fetchProjectDom(resolvedHref);
      const elements = buildOverlayContentFromDoc(doc, resolvedHref);
      return elements;
    };

    if (animate) {
      const elements = await withVenetianPageTransition(doSwap, { 
        slats: 18, 
        stagger: 0.025, 
        coverReverse: false, 
        revealReverse: false,
        coverDuration: 0.9,
        revealDuration: 1.1,
        coverEase: 'power2.inOut',
        revealEase: 'power2.inOut'
      });
    } else {
      const elements = await doSwap();
      // Instant reveal for non-animated navigation
      if (elements) {
        if (elements.hero) gsap.set(elements.hero, { autoAlpha: 1, y: 0 });
        if (elements.main) gsap.set(elements.main, { autoAlpha: 1 });
      }
    }
  });
}

async function closeProjectWithTransition(state, { animate = true } = {}) {
  return runNavExclusive(async () => {
    const doSwap = async () => {
      closeProject(state);
      return null;
    };

    if (animate) {
      await withVenetianPageTransition(doSwap, { 
        slats: 18, 
        stagger: 0.025, 
        coverReverse: false, 
        revealReverse: false,
        coverDuration: 0.9,
        revealDuration: 1.1,
        coverEase: 'power2.inOut',
        revealEase: 'power2.inOut'
      });
    } else {
      await doSwap();
    }
  });
}

function closeProject(state) {
  // If the cursor was magnetically locked to an element inside the overlay,
  // the element will be removed on close. Force-unlock so the cursor doesn't
  // get stuck/off-screen when returning to home.
  if (window.__cursorApi && typeof window.__cursorApi.forceUnlock === 'function') {
    window.__cursorApi.forceUnlock();
  }

  const overlay = document.getElementById('project-overlay');
  if (overlay) overlay.innerHTML = '';

  document.title = 'Jribh Shandilya | Interaction Design';

  setOverlayOpen(false);
  resumeSmoothScroll();

  if (window.__cursorApi && typeof window.__cursorApi.ensureVisible === 'function') {
    window.__cursorApi.ensureVisible();
  }

  const y = state?.homeScroll;
  const restoreY = (typeof y === 'number') ? y : lastHomeScroll;
  if (typeof restoreY === 'number') setScrollPosition(restoreY);
}

function scrollHomeToProject(projectKey) {
  if (!projectKey) return;

  const keyToHref = {
    'axis': 'project-details-axis.htm',
    'enterprise': 'project-details-enterprise.htm',
    'spacetime': 'project-details-spacetime.htm',
    'tata-neu': 'project-details-tata-neu.htm',
    'song-lyrics': 'project-details-song-lyrics.htm',
    'remote-touch': 'project-details-remote-touch.htm',
    'guardian': 'project-details-guardian.htm',
  };

  const projectHref = keyToHref[projectKey];
  if (!projectHref) return;

  const attemptScroll = (triesLeft = 120) => {
    const ss = window.smoothScroll;
    const targetLink = document.querySelector(`a.work-card-link[href$="${projectHref}"]`) ||
      document.querySelector(`a.work-card-link[href*="${projectHref}"]`);

    if (!targetLink || !ss) {
      if (triesLeft > 0) requestAnimationFrame(() => attemptScroll(triesLeft - 1));
      return;
    }

    // For desktop smooth scroll, wait until setup created the content container.
    if (!ss.isTouchDevice && !ss.content) {
      if (triesLeft > 0) requestAnimationFrame(() => attemptScroll(triesLeft - 1));
      return;
    }

    const targetTop = Math.max(0, (targetLink.offsetTop || 0) - Math.round(window.innerHeight * 0.12));

    if (ss.isTouchDevice && typeof ss.animateScrollTo === 'function') {
      ss.animateScrollTo(targetTop, 900);
    } else if (typeof ss.scrollTo === 'function') {
      ss.scrollTo(targetTop, 900);
    } else {
      window.scrollTo(0, targetTop);
    }
  };

  attemptScroll();
}

function setupInterceptors() {
  // Capture-phase interceptor to prevent any default navigation when overlay is open.
  document.addEventListener('click', (e) => {
    if (!isOverlayOpen()) return;

    const target = e.target;
    if (!target || !target.closest) return;

    const backBtn = target.closest('.pd-back-button');
    if (backBtn) {
      e.preventDefault();
      e.stopPropagation();

      // Prefer browser back when in a project history state.
      if (history.state && history.state.__project) {
        history.back();
        return;
      }

	  closeProjectWithTransition({ homeScroll: lastHomeScroll }).catch(() => {
		  closeProject({ homeScroll: lastHomeScroll });
	  });
      const targetHomeUrl = homeUrl || './index.htm';
      const baseState = history.state && typeof history.state === 'object' ? history.state : {};
      history.replaceState({ ...baseState, homeScroll: lastHomeScroll }, '', targetHomeUrl);
      return;
    }

    const anchor = target.closest('a');
    const href = anchor && anchor.getAttribute && anchor.getAttribute('href');
    if (anchor && href && isSameOriginUrl(href) && isProjectDetailsUrl(href)) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      e.stopPropagation();
	  openProject(href, { pushState: false, replaceState: true, animate: true }).catch((err) => {
        console.warn('Failed to navigate overlay project:', err);
      });
    }
  }, true);

  document.addEventListener('click', (e) => {
    // Handle work card links
    const link = e.target.closest && e.target.closest('a.work-card-link');
    if (link) {
      const href = link.getAttribute('href');
      if (!href) return;

      // Allow modifier-clicks to behave normally
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      e.preventDefault();
	  openProject(href, { pushState: true, animate: true }).catch((err) => {
        console.warn('Failed to open project overlay:', err);
        window.location.href = href;
      });
      return;
    }

    // Handle project-to-project navigation inside the overlay without full page reload.
    if (isOverlayOpen()) {
      const a = e.target.closest && e.target.closest('a');
      const href = a && a.getAttribute && a.getAttribute('href');
      if (a && href && isSameOriginUrl(href) && isProjectDetailsUrl(href)) {
        // Allow modifier-clicks to behave normally
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
		openProject(href, { pushState: false, replaceState: true, animate: true }).catch((err) => {
          console.warn('Failed to navigate overlay project:', err);
        });
        return;
      }
    }
  });

  window.addEventListener('popstate', async (e) => {
    const state = e.state;

    if (state && state.__project && state.href) {
	  openProject(state.href, { pushState: false, animate: true }).catch((err) => {
        console.warn('Failed to restore project overlay:', err);
      });
      return;
    }

	try {
		await closeProjectWithTransition(state, { animate: true });
	} catch {
		closeProject(state);
	}
  });
}

function initProjectRouter() {
  setupInterceptors();

  // Remember the initial home URL for later URL restoration.
  if (!homeUrl && !/project-details-.*\.htm$/.test(window.location.pathname)) {
    homeUrl = window.location.href;
  }

  // If we navigated from a standalone project page back to home, scroll to that card.
  const params = new URLSearchParams(window.location.search);
  const projectKeyFromQuery = params.get('project');
  const hashParams = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
  const projectKeyFromHash = hashParams.get('project');
  const projectKey = projectKeyFromQuery || projectKeyFromHash;
  if (projectKey) {
    scrollHomeToProject(projectKey);

    // Clean the URL so refresh doesn't keep re-scrolling.
    const cleanUrl = `${window.location.pathname}${window.location.hash || ''}`;
    history.replaceState(history.state, document.title, cleanUrl);
  }

  // If user reloads while the overlay URL is in the bar but parcel served index.htm,
  // try to open the overlay based on current path.
  const path = window.location.pathname;
  if (path && /project-details-.*\.htm$/.test(path)) {
	openProject(path, { pushState: true, animate: false }).catch(() => {});
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProjectRouter);
} else {
  initProjectRouter();
}
