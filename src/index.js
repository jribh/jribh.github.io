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
			// Navigate to the section
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
	
	window.addEventListener('scroll', () => {
		// Add scrolling class immediately for smooth transition
		document.body.classList.add('is-scrolling');
		
		// Clear existing timeout
		clearTimeout(scrollTimeout);
		
		// Remove class after scrolling stops
		// Wait longer to allow the 800ms transition to complete smoothly
		scrollTimeout = setTimeout(() => {
			document.body.classList.remove('is-scrolling');
		}, 150); // Shorter delay so transition starts sooner after stopping
		
		// Update navbar state based on scroll position
		updateNavbarOnScroll();
	}, { passive: true });
}

function updateNavbarOnScroll() {
	const navbar = document.querySelector('.navbar');
	if (!navbar) return;
	
	// Calculate which section is currently in view
	const sections = document.querySelectorAll('.content-section');
	const scrollPosition = window.scrollY + (window.innerHeight / 2); // middle of viewport
	
	let currentSection = 'home'; // default to first section
	
	sections.forEach((section, index) => {
		const sectionTop = section.offsetTop;
		const sectionBottom = sectionTop + section.offsetHeight;
		
		if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
			// Determine section key based on index
			const sectionKeys = ['home', 'about', 'work', 'contact'];
			currentSection = sectionKeys[index] || 'home';
		}
	});
	
	// Update navbar visual state based on current section
	if (currentSection === 'home') {
		navbar.classList.remove('navbar--secondary');
	} else {
		navbar.classList.add('navbar--secondary');
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
	updateNavbarOnScroll();
});
