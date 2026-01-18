// Venetian blinds animation for dark overlay (section 4 -> 5)
// Creates vertical slats that animate based on scroll progress.

import gsap from 'gsap';

// Default config
const DEFAULTS = {
	slats: 18,               // number of vertical slats
	stagger: 0.02,           // delay between consecutive slats for natural cascade
};

let state = {
	container: null,
	slats: [],
	builtForWidth: 0,
	currentProgress: 0,      // track current scroll progress 0-1
};

function ensureContainer(parentEl, opts = {}) {
	if (!parentEl) return null;
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
			// Start closed (scaleX 0)
			gsap.set(slat, { transformOrigin: 'left center', scaleX: 0 });
			container.appendChild(slat);
			slats.push(slat);
		}
		parentEl.appendChild(container);
		state = { ...state, container, slats, builtForWidth: window.innerWidth };
	}
	return state.container;
}

export function updateVenetianBlinds(progress, opts = {}) {
	// Use separate blinds overlay to avoid inheriting dark overlay opacity
	const blindsOverlay = document.getElementById('blinds-overlay');
	if (!blindsOverlay) {
		console.warn('updateVenetianBlinds: blindsOverlay not found');
		return;
	}
    
	ensureContainer(blindsOverlay, opts);
	if (!state.container) {
		console.warn('updateVenetianBlinds: container not created');
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
	
	let maxSlatScale = 0; // Track the maximum slat scale to determine visibility
	let minSlatScale = 1; // Track the minimum slat scale to detect full coverage
	
	state.slats.forEach((slat, index) => {
		// If reverse, stagger from right to left (reverse the index)
		const slatIndex = reverse ? numSlats - 1 - index : index;
		
		// Simpler stagger: each slat starts at (index * stagger) and completes by 1.0
		const slatStartProgress = slatIndex * stagger;
		
		// Map overall progress to this slat's individual progress
		let slatProgress = 0;
		if (smoothed >= slatStartProgress) {
			// This slat has started - animate from its start to completion
			slatProgress = Math.min(1, (smoothed - slatStartProgress) / (1 - slatStartProgress));
		}
		
		// Apply easing (power2.inOut)
		const easedProgress = slatProgress < 0.5
			? 2 * slatProgress * slatProgress
			: 1 - Math.pow(-2 * slatProgress + 2, 2) / 2;
		
		// Update the slat's scaleX
		gsap.set(slat, { scaleX: easedProgress });
		
		// Track max scale
		maxSlatScale = Math.max(maxSlatScale, easedProgress);
		minSlatScale = Math.min(minSlatScale, easedProgress);
	});
	
	// Only show container if any slat has meaningful scale
	if (maxSlatScale > 0.01) {
		state.container.style.opacity = '1';
		state.container.style.visibility = 'visible';
	} else {
		state.container.style.opacity = '0';
		state.container.style.visibility = 'hidden';
	}

	// Expose whether the blinds fully cover the scene so the renderer can pause safely.
	// "covered" means no gaps are visible (all slats effectively at scale 1).
	const fullyCovered = maxSlatScale > 0.99 && minSlatScale > 0.99;
	blindsOverlay.dataset.blindsCovered = fullyCovered ? '1' : '0';
	blindsOverlay.dataset.blindsProgress = String(smoothed);
    
	state.currentProgress = smoothed;
}

export function resetVenetianBlinds() {
	if (!state.container) return;
	gsap.killTweensOf(state.slats);
	state.slats.forEach((slat) => gsap.set(slat, { scaleX: 0 }));
	state.container.style.opacity = '0';
	state.container.style.visibility = 'hidden';
	state.currentProgress = 0;
}

// Optional: rebuild slats on resize so columns stay even
window.addEventListener('resize', () => {
	// Force rebuild next play if width changed significantly
	if (state.container) {
		state.builtForWidth = 0;
	}
});

