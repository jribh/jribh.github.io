// Venetian blinds animation for dark overlay (section 4 -> 5)
// Creates vertical slats that animate based on scroll progress.

import gsap from 'gsap';

// Default config
const DEFAULTS = {
	slats: 18,               // number of vertical slats
	stagger: 0.02,           // delay between consecutive slats for natural cascade
};

const statesByRoot = new WeakMap();

function getState(rootEl) {
	if (!rootEl) return null;
	let state = statesByRoot.get(rootEl);
	if (!state) {
		state = {
			container: null,
			slats: [],
			builtForWidth: 0,
			currentProgress: 0,
		};
		statesByRoot.set(rootEl, state);
	}
	return state;
}

function ensureContainer(rootEl, state, opts = {}) {
	if (!rootEl || !state) return null;
	// Rebuild if container missing or viewport size changed significantly
	const needBuild = !state.container || state.builtForWidth !== window.innerWidth;
	if (needBuild) {
		// Clean up any previous
		if (state.container && state.container.parentNode) {
			state.container.parentNode.removeChild(state.container);
		}
		const container = document.createElement('div');
		container.className = 'venetian-blinds';
		container.style.setProperty('--slats-count', String(opts.slats || DEFAULTS.slats));
		// Build slats
		const count = opts.slats || DEFAULTS.slats;
		const slats = [];
		for (let i = 0; i < count; i++) {
			const slat = document.createElement('div');
			slat.className = 'venetian-blinds__slat';
			gsap.set(slat, { transformOrigin: 'left center', scaleX: 0 });
			container.appendChild(slat);
			slats.push(slat);
		}
		rootEl.appendChild(container);
		state.container = container;
		state.slats = slats;
		state.builtForWidth = window.innerWidth;
	}
	return state.container;
}

export function updateVenetianBlindsOn(rootEl, progress, opts = {}) {
	if (!rootEl) return;
	const state = getState(rootEl);
	if (!state) return;

	const mode = opts.mode === 'open' ? 'open' : 'close';

	ensureContainer(rootEl, state, opts);
	if (!state.container) {
		console.warn('updateVenetianBlindsOn: container not created');
		return;
	}

	// Clamp progress to 0-1
	progress = Math.max(0, Math.min(1, progress));
	// Smooth to avoid snaps when section logic switches
	const smooth = typeof opts.smooth === 'number' ? opts.smooth : 0.18;
	const smoothed = state.currentProgress + (progress - state.currentProgress) * smooth;

	if (window.__debugBlinds) {
		console.log('Blinds progress (raw, smooth):', progress, smoothed, 'slats:', state.slats.length);
	}

	// Calculate stagger offset for each slat
	const stagger = opts.stagger ?? DEFAULTS.stagger;
	const reverse = opts.reverse ?? false;
	const numSlats = state.slats.length;

	let maxSlatScale = 0;
	let minSlatScale = 1;

	state.slats.forEach((slat, index) => {
		const slatIndex = reverse ? numSlats - 1 - index : index;
		const slatStartProgress = slatIndex * stagger;
		let slatProgress = 0;
		if (smoothed >= slatStartProgress) {
			slatProgress = Math.min(1, (smoothed - slatStartProgress) / (1 - slatStartProgress));
		}

		const easedProgress = slatProgress < 0.5
			? 2 * slatProgress * slatProgress
			: 1 - Math.pow(-2 * slatProgress + 2, 2) / 2;

		// close: 0 -> 1 (slats grow to cover)
		// open:  1 -> 0 (slats shrink away), but still driven by progress 0 -> 1
		const slatScale = mode === 'open' ? (1 - easedProgress) : easedProgress;
		gsap.set(slat, { scaleX: slatScale });

		maxSlatScale = Math.max(maxSlatScale, slatScale);
		minSlatScale = Math.min(minSlatScale, slatScale);
	});

	if (maxSlatScale > 0.01) {
		state.container.style.opacity = '1';
		state.container.style.visibility = 'visible';
	} else {
		state.container.style.opacity = '0';
		state.container.style.visibility = 'hidden';
	}

	const fullyCovered = maxSlatScale > 0.99 && minSlatScale > 0.99;
	rootEl.dataset.blindsCovered = fullyCovered ? '1' : '0';
	rootEl.dataset.blindsProgress = String(smoothed);

	state.currentProgress = smoothed;
}

export function resetVenetianBlindsOn(rootEl) {
	if (!rootEl) return;
	const state = getState(rootEl);
	if (!state || !state.container) return;
	gsap.killTweensOf(state.slats);
	state.slats.forEach((slat) => gsap.set(slat, { scaleX: 0 }));
	state.container.style.opacity = '0';
	state.container.style.visibility = 'hidden';
	state.currentProgress = 0;
}

export function updateVenetianBlinds(progress, opts = {}) {
	// Use separate blinds overlay to avoid inheriting dark overlay opacity
	const blindsOverlay = document.getElementById('blinds-overlay');
	if (!blindsOverlay) {
		console.warn('updateVenetianBlinds: blindsOverlay not found');
		return;
	}

	updateVenetianBlindsOn(blindsOverlay, progress, opts);
}

export function resetVenetianBlinds() {
	const blindsOverlay = document.getElementById('blinds-overlay');
	if (!blindsOverlay) return;
	resetVenetianBlindsOn(blindsOverlay);
}

const PAGE_TRANSITION_OVERLAY_ID = 'page-transition-overlay';
const PAGE_TRANSITION_LOGO_CLASS = 'page-transition-logo';
const PAGE_TRANSITION_LOGO_READY_KEY = '__pageTransitionLogoReady';

function getLogoAnimUrl() {
	try {
		return new URL('./assets/logo_anim.svg', import.meta.url).toString();
	} catch {
		return 'src/assets/logo_anim.svg';
	}
}

function getLogoMaskUrl() {
	try {
		return new URL('./assets/logo_mask.svg', import.meta.url).toString();
	} catch {
		return 'src/assets/logo_mask.svg';
	}
}

function ensurePageTransitionOverlay() {
	let overlay = document.getElementById(PAGE_TRANSITION_OVERLAY_ID);
	if (overlay) return overlay;
	overlay = document.createElement('div');
	overlay.id = PAGE_TRANSITION_OVERLAY_ID;
	overlay.setAttribute('aria-hidden', 'true');
	document.body.appendChild(overlay);
	return overlay;
}

async function loadSVG(url) {
	const response = await fetch(url);
	const text = await response.text();
	const parser = new DOMParser();
	const doc = parser.parseFromString(text, 'image/svg+xml');
	return doc.querySelector('svg');
}

function buildMaskedLogoSvg(logoSvg, maskSvg) {
	if (!logoSvg) return null;

	// Create a unique ID for the mask
	const maskId = 'pt-logo-mask-' + Date.now();

	// Derive mask box from the logo's viewBox to keep coordinates in sync
	const vbVals = (logoSvg.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
	const vbX = Number.isFinite(vbVals[0]) ? vbVals[0] : 0;
	const vbY = Number.isFinite(vbVals[1]) ? vbVals[1] : 0;
	const vbW = Number.isFinite(vbVals[2]) ? vbVals[2] : 48;
	const vbH = Number.isFinite(vbVals[3]) ? vbVals[3] : 48;

	const maskElement = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
	maskElement.setAttribute('id', maskId);
	maskElement.setAttribute('maskUnits', 'userSpaceOnUse');
	maskElement.setAttribute('x', String(vbX));
	maskElement.setAttribute('y', String(vbY));
	maskElement.setAttribute('width', String(vbW));
	maskElement.setAttribute('height', String(vbH));
	maskElement.setAttribute('style', 'mask-type:luminance');

	// White background: show everything by default
	const whiteRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
	whiteRect.setAttribute('x', String(vbX));
	whiteRect.setAttribute('y', String(vbY));
	whiteRect.setAttribute('width', String(vbW));
	whiteRect.setAttribute('height', String(vbH));
	whiteRect.setAttribute('fill', 'white');
	maskElement.appendChild(whiteRect);

	if (maskSvg) {
		const maskShapes = maskSvg.querySelectorAll('path, rect, circle, ellipse, polygon, polyline');
		maskShapes.forEach((node) => {
			const cloned = node.cloneNode(true);
			if (!cloned.getAttribute('fill')) cloned.setAttribute('fill', 'black');
			cloned.setAttribute('stroke', 'none');
			maskElement.appendChild(cloned);
		});
	}

	let defs = logoSvg.querySelector('defs');
	if (!defs) {
		defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
		logoSvg.insertBefore(defs, logoSvg.firstChild);
	}
	defs.appendChild(maskElement);

	const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'g');
	wrapper.setAttribute('class', 'masked-logo-content');
	wrapper.setAttribute('mask', `url(#${maskId})`);
	const childrenToWrap = Array.from(logoSvg.childNodes).filter((n) => n.nodeType === 1 && n.nodeName.toLowerCase() !== 'defs');
	childrenToWrap.forEach((n) => wrapper.appendChild(n));
	logoSvg.appendChild(wrapper);

	return logoSvg;
}

function resetStrokeDash(paths) {
	Object.values(paths).forEach((path) => {
		if (!path || typeof path.getTotalLength !== 'function') return;
		const length = path.getTotalLength();
		path.style.strokeDasharray = length;
		path.style.strokeDashoffset = length;
	});
}

function buildLogoTimeline(paths, cfg) {
	const tl = gsap.timeline({ paused: true });
	// Mirror startup's ordering and easing; timings will be time-scaled to 1s.
	if (paths.j) tl.to(paths.j, { strokeDashoffset: 0, duration: cfg.j.duration, ease: 'power2.inOut' }, cfg.j.delay);
	if (paths.r) tl.to(paths.r, { strokeDashoffset: 0, duration: cfg.r.duration, ease: 'power2.inOut' }, cfg.r.delay);
	if (paths.i_dot) tl.to(paths.i_dot, { strokeDashoffset: 0, duration: cfg.i_dot.duration, ease: 'power2.out' }, cfg.i_dot.delay);
	if (paths.i_body) tl.to(paths.i_body, { strokeDashoffset: 0, duration: cfg.i_body.duration, ease: 'power2.inOut' }, cfg.i_body.delay);
	if (paths.b_upper) tl.to(paths.b_upper, { strokeDashoffset: 0, duration: cfg.b_upper.duration, ease: 'power2.inOut' }, cfg.b_upper.delay);
	if (paths.b_lower) tl.to(paths.b_lower, { strokeDashoffset: 0, duration: cfg.b_lower.duration, ease: 'power2.inOut' }, cfg.b_lower.delay);
	if (paths.h) tl.to(paths.h, { strokeDashoffset: 0, duration: cfg.h.duration, ease: 'power2.inOut' }, cfg.h.delay);
	return tl;
}

async function ensurePageTransitionLogoAnimation(overlay) {
	if (!overlay) return null;
	if (overlay[PAGE_TRANSITION_LOGO_READY_KEY]) return overlay[PAGE_TRANSITION_LOGO_READY_KEY];

	const wrapper = document.createElement('div');
	wrapper.className = PAGE_TRANSITION_LOGO_CLASS;
	overlay.appendChild(wrapper);

	try {
		const [logoSvgRaw, maskSvgRaw] = await Promise.all([
			loadSVG(getLogoAnimUrl()),
			loadSVG(getLogoMaskUrl()),
		]);

		const logoSvg = buildMaskedLogoSvg(logoSvgRaw, maskSvgRaw);
		if (!logoSvg) throw new Error('Logo SVG not loaded');

		logoSvg.removeAttribute('width');
		logoSvg.removeAttribute('height');
		logoSvg.style.cssText = 'display:block; width:100%; height:auto;';
		wrapper.appendChild(logoSvg);
		gsap.set(wrapper, { autoAlpha: 1 });
		gsap.set(logoSvg, { autoAlpha: 1 });
		gsap.set(wrapper, { opacity: 1 });
		gsap.set(logoSvg, { opacity: 1 });
		gsap.set(wrapper, { visibility: 'hidden' });

		const paths = {
			j: logoSvg.querySelector('#j'),
			r: logoSvg.querySelector('#r'),
			h: logoSvg.querySelector('#h'),
			i_body: logoSvg.querySelector('#i_body'),
			i_dot: logoSvg.querySelector('#i_dot'),
			b_upper: logoSvg.querySelector('#b_upper'),
			b_lower: logoSvg.querySelector('#b_lower'),
		};

		resetStrokeDash(paths);

		const cfg = (window.LOGO_ANIMATION_CONFIG && window.LOGO_ANIMATION_CONFIG.letters) ? window.LOGO_ANIMATION_CONFIG.letters : {
			j: { duration: 1.2, delay: 0 },
			r: { duration: 1.6, delay: 0.2 },
			i_dot: { duration: 0.6, delay: 1.0 },
			i_body: { duration: 1.6, delay: 0.6 },
			b_upper: { duration: 1.2, delay: 0.4 },
			b_lower: { duration: 1.2, delay: 0.6 },
			h: { duration: 1.4, delay: 0.8 },
		};

		const tl = buildLogoTimeline(paths, cfg);

		overlay[PAGE_TRANSITION_LOGO_READY_KEY] = { wrapper, logoSvg, paths, tl };
		return overlay[PAGE_TRANSITION_LOGO_READY_KEY];
	} catch (err) {
		console.warn('Page transition logo animation failed; falling back to hidden logo:', err);
		overlay[PAGE_TRANSITION_LOGO_READY_KEY] = { wrapper, logoSvg: null, paths: null, tl: null };
		gsap.set(wrapper, { autoAlpha: 0, visibility: 'hidden' });
		return overlay[PAGE_TRANSITION_LOGO_READY_KEY];
	}
}

function wait(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function playTimeline(tl, { direction = 'forward' } = {}) {
	return new Promise((resolve) => {
		if (!tl) {
			resolve();
			return;
		}
		const done = () => {
			tl.eventCallback('onComplete', null);
			tl.eventCallback('onReverseComplete', null);
			resolve();
		};
		if (direction === 'reverse') {
			tl.eventCallback('onReverseComplete', done);
			tl.reverse();
		} else {
			tl.eventCallback('onComplete', done);
			tl.play(0);
		}
	});
}

function tweenBlindsProgress(rootEl, from, to, { duration, ease, slats, stagger, reverse, mode } = {}) {
	return new Promise((resolve) => {
		const t = { p: from };
		gsap.to(t, {
			p: to,
			duration: typeof duration === 'number' ? duration : 0.55,
			ease: ease || 'expo.inOut',
			onUpdate: () => {
				updateVenetianBlindsOn(rootEl, t.p, {
					slats: slats ?? DEFAULTS.slats,
					stagger: stagger ?? 0.04,
					reverse: !!reverse,
					mode,
					smooth: 1,
				});
			},
			onComplete: resolve,
			overwrite: true,
		});
	});
}

export async function withVenetianPageTransition(runSwap, opts = {}) {
	const overlay = ensurePageTransitionOverlay();
	if (!overlay) {
		await Promise.resolve(runSwap?.());
		return;
	}

	const logoAnim = await ensurePageTransitionLogoAnimation(overlay);

	// Block clicks during the transition.
	overlay.style.pointerEvents = 'auto';

	// Ensure slats exist.
	const transitionState = getState(overlay);
	ensureContainer(overlay, transitionState, { slats: opts.slats ?? DEFAULTS.slats });
	const container = transitionState?.container;
	const slats = transitionState?.slats || [];

	// Kill any in-flight transition tweens.
	gsap.killTweensOf(slats);
	gsap.killTweensOf(container);
	if (logoAnim?.wrapper) gsap.killTweensOf(logoAnim.wrapper);

	// Timeline-based approach is significantly smoother than manual progress sampling.
	const slatsCount = opts.slats ?? DEFAULTS.slats;
	const staggerEach = typeof opts.stagger === 'number' ? opts.stagger : 0.05;
	const coverDuration = typeof opts.coverDuration === 'number' ? opts.coverDuration : 1.0;
	const revealDuration = typeof opts.revealDuration === 'number' ? opts.revealDuration : 1.1;
	const coverEase = opts.coverEase || 'power4.inOut';
	const revealEase = opts.revealEase || 'power4.inOut';

	const coverFrom = (opts.coverReverse ?? false) ? 'end' : 'start';
	// Per your requirement: unravel should also go left -> right.
	const revealFrom = (opts.revealReverse ?? false) ? 'end' : 'start';

	// Always start from a clean visual state.
	if (container) {
		container.style.opacity = '1';
		container.style.visibility = 'visible';
		container.style.setProperty('--slats-count', String(slatsCount));
	}
	gsap.set(slats, { transformOrigin: 'left center', scaleX: 0 });
	if (logoAnim?.wrapper) gsap.set(logoAnim.wrapper, { autoAlpha: 1, visibility: 'hidden' });

	await new Promise((resolve) => {
		gsap.timeline({
			defaults: { overwrite: true },
			onComplete: resolve,
		})
			.set(slats, { transformOrigin: 'left center' }, 0)
			.to(slats, {
				scaleX: 1,
				duration: coverDuration,
				ease: coverEase,
				stagger: { each: staggerEach, from: coverFrom },
			}, 0);
	});

	// Start swapping content while fully covered (logo animation plays on top).
	const swapPromise = Promise.resolve(runSwap?.());

	// Logo stroke animation (same as startup): 1s in, 500ms hold, 1s out.
	if (logoAnim?.tl && logoAnim?.paths && logoAnim?.wrapper) {
		// Reset + fit total timing to exactly 1s.
		resetStrokeDash(logoAnim.paths);
		logoAnim.tl.pause(0);
		const total = Math.max(0.0001, logoAnim.tl.duration());
		logoAnim.tl.timeScale(total / 1);
		gsap.set(logoAnim.wrapper, { visibility: 'visible', autoAlpha: 1 });
		await playTimeline(logoAnim.tl, { direction: 'forward' });
		await wait(500);
		await playTimeline(logoAnim.tl, { direction: 'reverse' });
		gsap.set(logoAnim.wrapper, { visibility: 'hidden', autoAlpha: 0 });
	}

	const swapResult = await swapPromise;

	await new Promise((resolve) => {
		const timeline = gsap.timeline({
			defaults: { overwrite: true },
			onComplete: resolve,
		});

		// Start content animation ~800ms into the reveal phase
		if (swapResult?.hero) {
			timeline.to(swapResult.hero, { autoAlpha: 1, y: 0, duration: 1.6, ease: 'power2.out' }, 1);
		}
		if (swapResult?.main) {
			// Avoid transforming the whole main container (it contains a fixed-position back button).
			timeline.to(swapResult.main, { autoAlpha: 1, duration: 1.6, ease: 'power2.out' }, 1.4);
		}

		// Blinds retract animation happens in parallel
		timeline.set(slats, { transformOrigin: 'right center' }, 0);
		timeline.to(slats, {
			scaleX: 0,
			duration: revealDuration,
			ease: revealEase,
			stagger: { each: staggerEach, from: revealFrom },
		}, 0.06);
		timeline.set(container, { opacity: 0, visibility: 'hidden' });
	});

	overlay.style.pointerEvents = 'none';
	resetVenetianBlindsOn(overlay);
	
	return swapResult;
}

// Optional: rebuild slats on resize so columns stay even
window.addEventListener('resize', () => {
	// No-op: `ensureContainer()` will rebuild on the next update because
	// it compares `builtForWidth` against `window.innerWidth`.
});

