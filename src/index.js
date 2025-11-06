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
	
	// Update dark overlay based on sections 4 and 5 (indices 3 and 4)
	// On mobile (<=1024px), also show overlay for section 3 (index 2) and section 6 (index 5)
	// On desktop, show overlay in sections 4, 5, and during transition to 6 (indices 3, 4, 5)
	const darkOverlay = document.getElementById('dark-overlay');
	if (darkOverlay) {
		const isMobile = window.innerWidth <= 1024;
		
		// Show overlay logic:
		// Desktop: sections 4, 5, and 6 (indices 3, 4, and 5) - blinds will handle the uncovering
		// Mobile: sections 3, 4, 5, and 6 (indices 2, 3, 4, and 5)
		let showOverlay;
		if (isMobile) {
			showOverlay = currentSectionIndex === 2 || currentSectionIndex === 3 || currentSectionIndex === 4 || currentSectionIndex === 5;
		} else {
			showOverlay = currentSectionIndex === 3 || currentSectionIndex === 4 || currentSectionIndex === 5;
		}
		
		// Apply class instantly but we'll manage opacity smoothly including mobile section 2->3
		if (showOverlay) {
			darkOverlay.classList.add('is-visible');
		} else {
			darkOverlay.classList.remove('is-visible');
			resetVenetianBlinds();
		}
		
		// Smooth opacity transitions for dark overlay
		// Section 3→4: opacity 0 to 0.5
		// Section 4-5: maintain 0.5
		// Section 5→6: opacity 0.5 to 0
		let overlayOpacity = 0;
		
		if (currentSectionIndex === 3) {
			// In section 4 - calculate transition from section 3
			const section3 = sections[2];
			const section4 = sections[3];
			if (section3 && section4) {
				const section4Top = section4.offsetTop;
				const transitionWindow = window.innerHeight * 0.5; // Fade over 50% viewport height
				const transitionStart = section4Top - transitionWindow;
				const transitionEnd = section4Top;
				
				if (scrollY >= transitionEnd) {
					overlayOpacity = 0.5;
				} else if (scrollY >= transitionStart) {
					const progress = (scrollY - transitionStart) / transitionWindow;
					overlayOpacity = progress * 0.5;
				} else {
					overlayOpacity = 0;
				}
			}
		} else if (currentSectionIndex === 4) {
			// In section 5 - maintain 0.5 opacity
			overlayOpacity = 0.5;
		} else if (currentSectionIndex === 5) {
			// In section 6 - calculate transition from section 5
			const section5 = sections[4];
			const section6 = sections[5];
			if (section5 && section6) {
				const section6Top = section6.offsetTop;
				const transitionWindow = window.innerHeight * 0.5; // Fade over 50% viewport height
				const transitionStart = section6Top - transitionWindow;
				const transitionEnd = section6Top;
				
				if (scrollY >= transitionEnd) {
					overlayOpacity = 0;
				} else if (scrollY >= transitionStart) {
					const progress = (scrollY - transitionStart) / transitionWindow;
					overlayOpacity = 0.5 * (1 - progress);
				} else {
					overlayOpacity = 0.5;
				}
			}
		} else if (isMobile && currentSectionIndex === 2) {
			// Mobile: section 3 (index 2) should fade in as we enter it from section 2
			const section3 = sections[2];
			if (section3) {
				const section3Top = section3.offsetTop;
				// Start fading 60% viewport before section 3 top
				const transitionWindow = window.innerHeight * 0.6;
				const transitionStart = section3Top - transitionWindow;
				const transitionEnd = section3Top + window.innerHeight * 0.15; // allow slight continued ramp inside section
				if (scrollY >= transitionEnd) {
					overlayOpacity = 0.5;
				} else if (scrollY >= transitionStart) {
					const progress = (scrollY - transitionStart) / (transitionEnd - transitionStart);
					overlayOpacity = Math.min(0.5, progress * 0.5);
				} else {
					overlayOpacity = 0;
				}
			} else {
				overlayOpacity = 0.5; // fallback
			}
		}
		
		darkOverlay.style.opacity = overlayOpacity;
		
		// Calculate blinds progress - blinds should cover section 5 only
		// Section 4→5 transition: blinds close (animate in left to right)
		// Section 5: blinds fully closed (covering)
		// Section 5→6 transition: blinds open (animate out right to left)
		
		if (currentSectionIndex === 3) {
			// In section 4 - animate blinds closing as we approach section 5
			const section4 = sections[3];
			const section5 = sections[4];
			
			if (section4 && section5) {
				const section5Top = section5.offsetTop;
				const transitionWindow = window.innerHeight * 0.35;
				const transitionStart = section5Top - window.innerHeight + transitionWindow - (window.innerHeight * 0.016);
				const transitionEnd = section5Top + window.innerHeight * 0.35; // Extend animation window to give it more time
				
				let blindsProgress = 0;
				
				if (scrollY >= transitionEnd) {
					// Reached section 5
					blindsProgress = 1;
				} else if (scrollY >= transitionStart) {
					// In transition window - animate blinds closing as section 5 comes into view
					blindsProgress = (scrollY - transitionStart) / transitionWindow;
				} else {
					// Before transition starts
					blindsProgress = 0;
				}
				
				updateVenetianBlinds(blindsProgress, { slats: 18, stagger: 0.04, reverse: false });
			}
		} else if (currentSectionIndex === 4 || currentSectionIndex === 5) {
			// In section 5 or 6 - handle transition to section 6
			const section5 = sections[4];
			const section6 = sections[5];
			
			if (section5 && section6) {
				const section5Top = section5.offsetTop;
				const section5Bottom = section5Top + section5.offsetHeight;
				const section6Top = section6.offsetTop;
				
				// Trigger blinds when transitioning from section 5 to 6
				// Blinds uncover (sweep right to left) as section 6 comes into view
				const transitionWindow = window.innerHeight * 0.35; // Same timing as 4->5 transition
				const transitionStart = section6Top - window.innerHeight * 0.5; // Start when section 6 is ~50% into viewport
				const transitionEnd = section6Top + window.innerHeight * 0.35; // End 35% viewport after section 6 starts
				
				let blindsProgress = 0;
				
				if (scrollY >= transitionEnd) {
					// Fully in section 6 - blinds fully open (0 progress = fully uncovered)
					blindsProgress = 0;
				} else if (scrollY >= transitionStart) {
					// In transition window - animate blinds uncovering as section 6 comes into view
					// Reverse progress: 1 when starting transition, 0 when fully in section 6
					blindsProgress = 1 - ((scrollY - transitionStart) / transitionWindow);
				} else {
					// Before section 6 enters viewport - blinds fully closed (covering)
					blindsProgress = 1;
				}
				
				// Use reverse: true for right-to-left uncovering
				updateVenetianBlinds(blindsProgress, { slats: 18, stagger: 0.04, reverse: true });
			}
		} else {
			// Outside active sections, ensure blinds are hidden
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
