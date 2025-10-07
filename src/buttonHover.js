import gsap from 'gsap';

// Direction-aware hover fill for the SEND button
// Inspired by GSAP directional hover demos.
export function initDirectionalHoverButtons() {
  const btn = document.querySelector('.contact-form-submit');
  if (!btn) return;

  let tl; // timeline reused per hover

  function setVarsFromDirection(el, e, state) {
    const rect = el.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;

    // Distances to edges
    const top = relY;
    const bottom = rect.height - relY;
    const left = relX;
    const right = rect.width - relX;

    const min = Math.min(top, bottom, left, right);
    let fromX = 0, fromY = 0, toX = 0, toY = 0;

    // Start outside depending on nearest edge
    const offset = 105; // percentage outside the button
    if (min === top) {
      fromX = 0; fromY = -offset; // enter from top
      toX = 0; toY = 0;           // settle centered
    } else if (min === bottom) {
      fromX = 0; fromY = offset;  // enter from bottom
      toX = 0; toY = 0;
    } else if (min === left) {
      fromX = -offset; fromY = 0; // enter from left
      toX = 0; toY = 0;
    } else {
      fromX = offset; fromY = 0;  // enter from right
      toX = 0; toY = 0;
    }

    if (state === 'out') {
      // reverse: exit toward nearest edge from current pointer
      const tmpX = fromX, tmpY = fromY;
      fromX = 0; fromY = 0;
      toX = tmpX; toY = tmpY;
    }

    return { fromX, fromY, toX, toY };
  }

  function animate(el, e, state) {
    const { fromX, fromY, toX, toY } = setVarsFromDirection(el, e, state);
    tl && tl.kill();
    tl = gsap.timeline({ defaults: { duration: 0.35, ease: 'power2.out' } });

    if (state === 'in') {
      tl.set(el, { '--tx': `${fromX}%`, '--ty': `${fromY}%` })
        .to(el, { '--tx': `${toX}%`, '--ty': `${toY}%` })
        .add(() => el.classList.add('is-filled'));
    } else {
      tl.set(el, { '--tx': `${fromX}%`, '--ty': `${fromY}%` })
        .to(el, { '--tx': `${toX}%`, '--ty': `${toY}%` })
        .add(() => el.classList.remove('is-filled'));
    }
  }

  btn.addEventListener('mouseenter', (e) => animate(btn, e, 'in'));
  btn.addEventListener('mouseleave', (e) => animate(btn, e, 'out'));
}

// Auto-init when loaded as a module
initDirectionalHoverButtons();
