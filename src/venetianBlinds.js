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

		gsap.set(slat, { scaleX: easedProgress });

		maxSlatScale = Math.max(maxSlatScale, easedProgress);
		minSlatScale = Math.min(minSlatScale, easedProgress);
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

function ensurePageTransitionOverlay() {
	let overlay = document.getElementById(PAGE_TRANSITION_OVERLAY_ID);
	if (overlay) return overlay;
	overlay = document.createElement('div');
	overlay.id = PAGE_TRANSITION_OVERLAY_ID;
	overlay.setAttribute('aria-hidden', 'true');
	document.body.appendChild(overlay);
	return overlay;
}

function tweenBlindsProgress(rootEl, from, to, { duration, ease, slats, stagger, reverse } = {}) {
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

	// Block clicks during the transition.
	overlay.style.pointerEvents = 'auto';

	// Always start from a clean state.
	resetVenetianBlindsOn(overlay);
	updateVenetianBlindsOn(overlay, 0, {
		slats: opts.slats ?? DEFAULTS.slats,
		stagger: opts.stagger ?? 0.04,
		reverse: !!(opts.coverReverse ?? opts.reverse),
		smooth: 1,
	});

	await tweenBlindsProgress(overlay, 0, 1, {
		duration: opts.coverDuration ?? 0.55,
		ease: opts.coverEase ?? 'expo.inOut',
		slats: opts.slats,
		stagger: opts.stagger,
		reverse: opts.coverReverse ?? opts.reverse,
	});

	await Promise.resolve(runSwap?.());

	await tweenBlindsProgress(overlay, 1, 0, {
		duration: opts.revealDuration ?? 0.65,
		ease: opts.revealEase ?? 'expo.inOut',
		slats: opts.slats,
		stagger: opts.stagger,
		reverse: opts.revealReverse ?? opts.reverse ?? true,
	});

	overlay.style.pointerEvents = 'none';
	resetVenetianBlindsOn(overlay);
}

// Optional: rebuild slats on resize so columns stay even
window.addEventListener('resize', () => {
	// No-op: `ensureContainer()` will rebuild on the next update because
	// it compares `builtForWidth` against `window.innerWidth`.
});

