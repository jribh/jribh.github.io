const navbar = document.querySelector('nav');

let x = window.matchMedia("(max-width: 990px)");

window.onscroll = () => {
    if (window.scrollY > 100 && !x.matches) {
        navbar.classList.add('nav-active');
    } else {
        navbar.classList.remove('nav-active');
    }
};