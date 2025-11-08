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

import { updateVenetianBlinds, resetVenetianBlinds } from './venetianBlinds.js';

function updateNavbarOnScroll(scrollY = null) {
	const navbar = document.querySelector('.navbar');
	if (!navbar) return;
	const heroLogo = document.querySelector('.navbar__logo-hero');
	const smallLogo = document.querySelector('.navbar__logo');
	
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
			// Force hero-only visibility in home
			if (heroLogo) { heroLogo.style.visibility = 'visible'; heroLogo.style.pointerEvents = 'auto'; }
			if (smallLogo) { smallLogo.style.visibility = 'hidden'; smallLogo.style.pointerEvents = 'none'; }
	} else {
		navbar.classList.add('navbar--secondary');
			// Force small-only visibility in other sections
			if (heroLogo) { heroLogo.style.visibility = 'hidden'; heroLogo.style.pointerEvents = 'none'; }
			if (smallLogo) { smallLogo.style.visibility = 'visible'; smallLogo.style.pointerEvents = 'auto'; }
	}
	
	// Update dark overlay and blinds based on simplified spec
	// Overlay schedule (opacity):
	// - Section 1 & 2: 0 on all devices
	// - Section 3: mobile (<=768px) 0.5, otherwise 0 (fade in smoothly)
	// - Section 4: 0.5 on all devices (fade in smoothly from previous)
	// - Section 5: handled by blinds animation; base overlay opacity 0 to avoid stacking with blinds
	// - Section 6: desktop/tablet -> remove black via blinds; mobile (<=768px) -> remain black (overlay 1) throughout
	const darkOverlay = document.getElementById('dark-overlay');
	if (darkOverlay) {
		const isMobile = window.innerWidth <= 768; // per requirement

		// Determine target overlay opacity by section + device
		let overlayOpacity = 0; // default for sections 1-2

		if (currentSectionIndex === 2) {
			// Section 3
			overlayOpacity = isMobile ? 0.5 : 0;
		} else if (currentSectionIndex === 3) {
			// Section 4
			// Smooth fade from previous value to 0.5 using CSS transition; set value directly here
			overlayOpacity = 0.5;
		} else if (currentSectionIndex === 4) {
			// Section 5 -> use blinds; avoid stacking base overlay with blinds
			overlayOpacity = 0;
		} else if (currentSectionIndex === 5) {
			// Section 6
			// Desktop: remove black via blinds opening; Mobile: keep black but via blinds (avoid double-overlay)
			overlayOpacity = 0;
		}

		// Apply overlay visibility and opacity
		if (overlayOpacity > 0) {
			darkOverlay.classList.add('is-visible');
		} else {
			darkOverlay.classList.remove('is-visible');
		}
		darkOverlay.style.opacity = overlayOpacity;

		// Blinds logic (section 5 only for desktop/tablet, persistent black in 6 for mobile)
		if (currentSectionIndex === 3) {
			// In section 4 - animate blinds closing as we approach section 5
			const section4 = sections[3];
			const section5 = sections[4];
			if (section4 && section5) {
				const section5Top = section5.offsetTop;
				const transitionWindow = window.innerHeight * 0.35;
				const transitionStart = section5Top - window.innerHeight + transitionWindow - (window.innerHeight * 0.016);
				const transitionEnd = section5Top + window.innerHeight * 0.35;
				let blindsProgress = 0;
				if (scrollY >= transitionEnd) {
					blindsProgress = 1;
				} else if (scrollY >= transitionStart) {
					blindsProgress = (scrollY - transitionStart) / transitionWindow;
				} else {
					blindsProgress = 0;
				}
				updateVenetianBlinds(blindsProgress, { slats: 18, stagger: 0.04, reverse: false });
			}
		} else if (currentSectionIndex === 4 || currentSectionIndex === 5) {
			const section6 = sections[5];
			if (section6) {
				if (isMobile) {
					// Mobile: keep blinds closed through section 6 (visually black stays)
					updateVenetianBlinds(1, { slats: 18, stagger: 0.04, reverse: true });
				} else {
					// Desktop/tablet: open blinds transitioning into section 6
					const section6Top = section6.offsetTop;
					const transitionWindow = window.innerHeight * 0.35;
					const transitionStart = section6Top - window.innerHeight * 0.5;
					const transitionEnd = section6Top + window.innerHeight * 0.35;
					let blindsProgress = 0;
					if (scrollY >= transitionEnd) {
						blindsProgress = 0;
					} else if (scrollY >= transitionStart) {
						blindsProgress = 1 - ((scrollY - transitionStart) / transitionWindow);
					} else {
						blindsProgress = 1;
					}
					updateVenetianBlinds(blindsProgress, { slats: 18, stagger: 0.04, reverse: true });
				}
			}
		} else {
			// Outside blinds-active sections, hide blinds
			resetVenetianBlinds();
		}
	}
	
	// Update active states in navigation
	const links = document.querySelectorAll('.navbar__link');
	links.forEach((a) => a.classList.toggle('is-active', a.dataset.nav === currentSection));
	
	const dots = document.querySelectorAll('.side-nav__dot');
	dots.forEach((dot) => dot.classList.toggle('is-active', dot.dataset.section === currentSection));
}

function initContactButton() {
	const contactButton = document.querySelector('.enterprise-buttons button:first-child');
	if (!contactButton) return;

	contactButton.addEventListener('click', () => {
		const contactSection = document.getElementById('contact');
		if (contactSection) {
			// Set flag to indicate we arrived via the contact button
			window.__arrivedViaContactButton = true;
			
			// Reset the clicked state to allow button to show again
			if (window.contactReturnButton) {
				window.contactReturnButton.hasBeenClicked = false;
			}
			
			const targetPosition = contactSection.offsetTop;
			if (window.smoothScroll && typeof window.smoothScroll.scrollTo === 'function') {
				window.smoothScroll.scrollTo(targetPosition, 1200);
			} else {
				window.scrollTo({ top: targetPosition, behavior: 'smooth' });
			}
			setActive('contact');
		}
	});
}

document.addEventListener('DOMContentLoaded', () => {
	initNavbar();
	initSideNav();
	initContactButton();
	initScrollbar();
	// Initial check for navbar state on page load
	setTimeout(() => {
		updateNavbarOnScroll();
	}, 100);
});
