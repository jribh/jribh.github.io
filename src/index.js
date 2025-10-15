// Navbar interaction logic

function setActive(key) {
	// Update bottom navbar links
	const links = document.querySelectorAll('.navbar__link');
	links.forEach((a) => a.classList.toggle('is-active', a.dataset.nav === key));
	
	// Update side nav dots
	const dots = document.querySelectorAll('.side-nav__dot');
	dots.forEach((dot) => dot.classList.toggle('is-active', dot.dataset.section === key));
	
	// Update navbar state (Primary vs Secondary)
	updateNavbarState(key);
}

function updateNavbarState(key) {
	const navbar = document.querySelector('.navbar');
	if (!navbar) return;
	
	// Primary state (no background) for 'home' section, Secondary state for all others
	if (key === 'home') {
		navbar.classList.remove('navbar--secondary');
	} else {
		navbar.classList.add('navbar--secondary');
	}
}

function initNavbar() {
	const links = document.querySelectorAll('.navbar__link');
	if (!links.length) return;

	links.forEach((a) => {
		a.addEventListener('click', (e) => {
			// allow anchor default behavior but update active state
			const key = a.dataset.nav;
			setActive(key);
		});
		a.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				setActive(a.dataset.nav);
				a.click();
			}
		});
	});

	// Add click handler for center logo to scroll to top
	const logo = document.querySelector('.navbar__logo');
	if (logo) {
		logo.style.cursor = 'pointer';
		logo.tabIndex = 0; // Make focusable
		logo.addEventListener('click', () => {
			if (window.smoothScroll && typeof window.smoothScroll.scrollTo === 'function') {
				window.smoothScroll.scrollTo(0, 800);
			} else {
				window.scrollTo({ top: 0, behavior: 'smooth' });
			}
			setActive('home');
		});
		logo.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				logo.click();
			}
		});
	}

	// set active from hash if present
	const hash = location.hash.replace('#', '');
	if (hash) {
		const match = Array.from(links).find((a) => a.getAttribute('href') === `#${hash}`);
		if (match) setActive(match.dataset.nav);
	} else {
		// Initialize navbar state on page load (starts at home/Primary state)
		updateNavbarState('home');
	}
}

function initSideNav() {
	const dots = document.querySelectorAll('.side-nav__dot');
	if (!dots.length) return;

	dots.forEach((dot) => {
		dot.addEventListener('click', (e) => {
			e.preventDefault();
			const section = dot.dataset.section;
			setActive(section);
			// Navigate to the section using smooth scroll
			const target = document.querySelector(`[href="#${section}"]`);
			if (target) {
				target.click();
			} else {
				location.hash = section;
			}
		});
		
		dot.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				dot.click();
			}
		});
	});
}

function initScrollbar() {
	let scrollTimeout;
	
	// Get scroll position from smooth scroll or fallback to window
	const getScrollPosition = () => {
		if (window.smoothScroll && window.smoothScroll.scrollCurrent !== undefined) {
			return window.smoothScroll.scrollCurrent;
		}
		return window.scrollY;
	};
	
	// Use requestAnimationFrame to continuously monitor scroll position
	const monitorScroll = () => {
		const scrollY = getScrollPosition();
		
		// Add scrolling class
		document.body.classList.add('is-scrolling');
		
		// Clear existing timeout
		clearTimeout(scrollTimeout);
		
		// Remove class after scrolling stops
		scrollTimeout = setTimeout(() => {
			document.body.classList.remove('is-scrolling');
		}, 150);
		
		// Update navbar state based on scroll position
		updateNavbarOnScroll(scrollY);
		
		// Continue monitoring
		requestAnimationFrame(monitorScroll);
	};
	
	// Start monitoring
	requestAnimationFrame(monitorScroll);
}

function updateNavbarOnScroll(scrollY = null) {
	const navbar = document.querySelector('.navbar');
	if (!navbar) return;
	
	// Get scroll position from smooth scroll or parameter
	if (scrollY === null) {
		scrollY = window.smoothScroll && window.smoothScroll.scrollCurrent !== undefined 
			? window.smoothScroll.scrollCurrent 
			: window.scrollY;
	}
	
	// Calculate which section is currently in view
	const sections = document.querySelectorAll('.content-section');
	const scrollPosition = scrollY + (window.innerHeight / 2); // middle of viewport
	
	let currentSection = 'home'; // default to first section
	let currentSectionIndex = 0;
	
	sections.forEach((section, index) => {
		const sectionTop = section.offsetTop;
		const sectionBottom = sectionTop + section.offsetHeight;
		
		if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
			currentSectionIndex = index;
			// Map section indices to navigation keys
			// Section 0 -> home (first dot)
			// Sections 1, 2, 3 -> about (second dot)
			// Section 4 -> work (third dot)
			if (index === 0) {
				currentSection = 'home';
			} else if (index >= 1 && index <= 3) {
				currentSection = 'about';
			} else if (index === 4) {
				currentSection = 'work';
			} else {
				currentSection = 'contact';
			}
		}
	});
	
	// Update navbar visual state based on current section
	// Primary state only for home (section 0)
	if (currentSectionIndex === 0) {
		navbar.classList.remove('navbar--secondary');
	} else {
		navbar.classList.add('navbar--secondary');
	}
	
	// Update dark overlay based on sections 4 and 5 (indices 3 and 4)
	// On mobile (<=1024px), also show overlay for section 3 (index 2) and section 6 (index 5)
	// On desktop, hide overlay in section 6 (index 5 = contact section)
	const darkOverlay = document.getElementById('dark-overlay');
	if (darkOverlay) {
		const isMobile = window.innerWidth <= 1024;
		
		// Show overlay logic:
		// Desktop: sections 4 and 5 only (indices 3 and 4)
		// Mobile: sections 3, 4, 5, and 6 (indices 2, 3, 4, and 5)
		let showOverlay;
		if (isMobile) {
			showOverlay = currentSectionIndex === 2 || currentSectionIndex === 3 || currentSectionIndex === 4 || currentSectionIndex === 5;
		} else {
			showOverlay = currentSectionIndex === 3 || currentSectionIndex === 4;
		}
		
		if (showOverlay) {
			darkOverlay.classList.add('is-visible');
		} else {
			darkOverlay.classList.remove('is-visible');
		}
		
		// Make overlay fully black in section 5 (index 4 = work section)
		// On mobile, also keep it fully black in section 6 (index 5 = contact section)
		const shouldBeFullyBlack = currentSectionIndex === 4 || (isMobile && currentSectionIndex === 5);
		const isCurrentlyFullyBlack = darkOverlay.classList.contains('is-fully-black');
		
		if (shouldBeFullyBlack && !isCurrentlyFullyBlack) {
			// Section 5 (work) - fully black
			// Section 6 (contact) on mobile - fully black
			darkOverlay.classList.add('is-fully-black');
			
			// Pause animation 300ms after overlay becomes fully black
			// (800ms background-color transition + 300ms buffer = 1100ms total delay)
			if (window.pauseAnimation && window.animationPauseTimeout != null) {
				clearTimeout(window.animationPauseTimeout);
			}
			if (window.pauseAnimation) {
				window.animationPauseTimeout = setTimeout(() => {
					window.pauseAnimation();
				}, 1100);
			}
			
			// Clear any pending resume timeout since we're going black
			if (window.animationResumeTimeout != null) {
				clearTimeout(window.animationResumeTimeout);
				window.animationResumeTimeout = null;
			}
		} else if (!shouldBeFullyBlack && isCurrentlyFullyBlack) {
			// All other sections - semi-transparent (0.5 opacity)
			
			// Resume animation 300ms before overlay starts fading
			// (opacity transition is 1200ms, start 300ms early)
			if (window.resumeAnimation && window.animationResumeTimeout != null) {
				clearTimeout(window.animationResumeTimeout);
			}
			if (window.resumeAnimation) {
				window.animationResumeTimeout = setTimeout(() => {
					window.resumeAnimation();
				}, 0); // Resume immediately so scene is rendering before fade starts
			}
			
			// Clear any pending pause timeout since we're going transparent
			if (window.animationPauseTimeout != null) {
				clearTimeout(window.animationPauseTimeout);
				window.animationPauseTimeout = null;
			}
			
			// Remove the class after a small delay to let resume happen first
			setTimeout(() => {
				darkOverlay.classList.remove('is-fully-black');
			}, 50);
		}
	}
	
	// Update active states in navigation
	const links = document.querySelectorAll('.navbar__link');
	links.forEach((a) => a.classList.toggle('is-active', a.dataset.nav === currentSection));
	
	const dots = document.querySelectorAll('.side-nav__dot');
	dots.forEach((dot) => dot.classList.toggle('is-active', dot.dataset.section === currentSection));
}

document.addEventListener('DOMContentLoaded', () => {
	initNavbar();
	initSideNav();
	initScrollbar();
	// Initial check for navbar state on page load
	setTimeout(() => {
		updateNavbarOnScroll();
	}, 100);
});
