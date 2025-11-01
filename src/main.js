import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

import { EffectComposer, RenderPass, EffectPass, SelectiveBloomEffect, SMAAEffect, SMAAPreset, HueSaturationEffect, BrightnessContrastEffect , Effect } from 'postprocessing';
import { reededParams, createReededPass, setReededResolution, tickReededTime, updateReeded as _updateReeded, createGrainPass, updateGrain, setReededDepth, setReededScrollProgress, setReededScrollRefractionMultiplier, setReededSplitScreenMode, createBottomVignettePass, setBottomVignetteResolution, updateBottomVignette } from './effects/OverlayEffects.js';
import { gsap } from 'gsap';
import { logoAnimationComplete, markLoadingComplete } from './logoTestAnim.js';

import hdriUrl from './assets/hdri_bg.hdr';
import modelUrl from './assets/head_packed.glb';
import shadowMaskUrl from './assets/Head_Shadowmask.png';
import bgAudioUrl from './assets/bg_audio.mp3';

let headContainer = document.querySelector("#head-container");
headContainer.style.overflow = "default";
let currentTime;

// Audio visualizer globals (declared early to avoid TDZ in animate)
let bgAudio = null;
let isAudioPlaying = false;
let audioContext = null;
let analyser = null;
let gainNode = null;
let dataArray = null;
let visualizerCanvas = null;
let visualizerCtx = null;
let animationId = null;
let barHeights = [];

// Startup sequence state
let startupActive = true;
let allowHeadLook = false;
let allowBreathing = false; // both chin & shoulder breathing enabled together after startup
const eyeMeshes = [];
const initialChinLiftRad = -0.25; // slight look up during startup

// Touch-device detection (phones/tablets)
const IS_TOUCH_DEVICE = (function(){
  try {
    if (window.matchMedia && window.matchMedia('(pointer:coarse)').matches) return true;
    if ('ontouchstart' in window) return true;
    const ua = (navigator.userAgent || '').toLowerCase();
    return /mobi|iphone|ipad|android|tablet/.test(ua);
  } catch { return false; }
})();

const PREFERS_REDUCED_MOTION = (function(){
  try {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch { return false; }
})();

// Width-based phone check using existing breakpoints (phones < 500px, tablets >= 500px)
function isPhoneWidth() {
  try {
    const vw = window.visualViewport ? Math.floor(window.visualViewport.width) : window.innerWidth;
    return vw < 500; // matches usage elsewhere (phone < 500, tablet 500-1100)
  } catch { return false; }
}

const inactivityThreshold = 5000; // time before head moves back to position

const WIND_BASE_TS = 1.0;

let scene = new THREE.Scene();
// Nudge entire scene slightly to the right to correct off-center model
scene.position.x = 0.35;
let w = window.innerWidth;
let h = window.innerHeight;
let aspectRatio = w/h,
    fieldOfView = 30,
    nearPlane = 1,
    farPlane = 400;

let frustumSize = 32; // reduce this to increase zoom
let frustumHeight = 1; // increase this to bring lower

let camera = new THREE.OrthographicCamera(
    frustumSize*aspectRatio/-2, frustumSize*aspectRatio/2, frustumSize+frustumHeight, frustumHeight, nearPlane, farPlane
)

camera.position.set( 0, 0, 200);
// Startup: begin slightly zoomed-in (orthographic zoom > 1 zooms in)
const STARTUP_CAM_ZOOM = 1.06; // subtle close look
camera.zoom = STARTUP_CAM_ZOOM;
camera.updateProjectionMatrix();

const theCanvas = document.querySelector("#artboard");
const bgEl = document.getElementById('head-background');
const g2xEl = document.getElementById('g2x'); // optional red radial gradient overlay
// Ensure initial blackout
if (theCanvas) theCanvas.style.opacity = '0';
if (bgEl) bgEl.style.opacity = '0';
// Create a fullscreen loading overlay that fades in on startup

// Loading overlay fade durations (in milliseconds)
const LOADING_FADE_IN_MS = 200;
const LOADING_FADE_OUT_MS = 250;
// Helper to convert ms -> seconds for GSAP
const ms = (v) => Math.max(0, Number(v) || 0) / 1000;
let blackoutEl = document.createElement('div');
blackoutEl.className = 'loading-overlay';
const loadingContent = document.createElement('div');
loadingContent.className = 'loading-overlay__content';
const logoImg = new Image();
// Resolve logo URL via bundler to work in dev and build
const logoUrl = new URL('./assets/logo.svg', import.meta.url);
logoImg.src = logoUrl.href;
logoImg.alt = 'Logo';
logoImg.draggable = false;
logoImg.decoding = 'async';
logoImg.className = 'loading-overlay__logo';

loadingContent.appendChild(logoImg);
blackoutEl.appendChild(loadingContent);
document.body.appendChild(blackoutEl);
gsap.set(blackoutEl, { opacity: 0 });
gsap.set(loadingContent, { opacity: 0, y: 16 });

// Helper: build a fullscreen "vertical blinds" overlay for curtain-style transitions
function createBlindsOverlay(stripeCount) {
  const vw = window.visualViewport ? Math.floor(window.visualViewport.width) : window.innerWidth;
  // Choose a sensible default by width bucket if not provided
  const count = Math.max(1, stripeCount || (vw >= 1440 ? 1 : vw >= 1024 ? 1 : vw >= 600 ? 1 : 1));
  const wrap = document.createElement('div');
  wrap.className = 'blinds-overlay';
  wrap.style.setProperty('--blinds-count', String(count));
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'blinds-overlay__stripe';
    wrap.appendChild(s);
  }
  document.body.appendChild(wrap);
  return wrap;
}

let overlayActivated = false;
let logoAnimReady = false;

// Wait for logo animation to complete
logoAnimationComplete.then(() => {
  logoAnimReady = true;
  tryStartStartupSequence();
});

const activateLoadingOverlay = () => {
  if (overlayActivated) return;
  overlayActivated = true;
  blackoutEl.style.pointerEvents = 'auto';
  if (PREFERS_REDUCED_MOTION) {
    gsap.set(blackoutEl, { opacity: 1 });
    gsap.set(loadingContent, { opacity: 1, y: 0 });
    return;
  }
  const fadeInTl = gsap.timeline();
  fadeInTl.to(blackoutEl, { opacity: 1, duration: ms(LOADING_FADE_IN_MS), ease: 'power2.out' }, 0);
  fadeInTl.to(loadingContent, { opacity: 1, duration: ms(LOADING_FADE_IN_MS), ease: 'power2.out' }, 0.1);
};

if (document.readyState === 'complete') {
  requestAnimationFrame(activateLoadingOverlay);
} else {
  window.addEventListener('load', () => requestAnimationFrame(activateLoadingOverlay), { once: true });
  requestAnimationFrame(activateLoadingOverlay);
}

const loadingManager = new THREE.LoadingManager();
let assetsReady = false;
let modelReady = false;
let startupTriggered = false;

loadingManager.onProgress = (_url, itemsLoaded, itemsTotal) => {
  // Progress bar removed - no longer updating progress
};

loadingManager.onLoad = () => {
  assetsReady = true;
  tryStartStartupSequence();
};

loadingManager.onError = (url) => {
  console.warn(`Asset failed to load: ${url}`);
  assetsReady = true;
  tryStartStartupSequence();
};

function tryStartStartupSequence() {
  if (startupTriggered) return;
  if (!assetsReady || !modelReady || !logoAnimReady) return;
  startupTriggered = true;
  startStartupSequence();
}



theCanvas.style.overflow = "hidden";
theCanvas.style.left = '0';
theCanvas.style.position = 'fixed';

let renderer = new THREE.WebGLRenderer({
    canvas : theCanvas,
    alpha : true,
    antialias : true
})

THREE.Cache.clear();

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.setClearColor( 0x000000, 0 ); // the default
renderer.shadowMap.enabled = true;
renderer.physicallyCorrectLights = true;
renderer.toneMappingExposure = 0.0;
// Prefer maximum available anisotropy for crisper textures
const MAX_ANISOTROPY = (renderer.capabilities && typeof renderer.capabilities.getMaxAnisotropy === 'function')
  ? renderer.capabilities.getMaxAnisotropy()
  : 1;

const renderScene = new RenderPass(scene, camera)
const composer = new EffectComposer(renderer)

const bloomEffect = new SelectiveBloomEffect( scene, camera, {
  intensity: 2.2,
  radius: 0.8,                 // wider spread
  luminanceThreshold: 0.02,    // bloom earlier
  luminanceSmoothing: 0.03
});

// Reeded Glass (external module): create pass + expose a window updater for convenience
let _reedEffect = null;
let _reedPass = null;
window.reededParams = reededParams; // expose for quick console tweaks
window.updateReeded = (partial)=> _updateReeded(_reedEffect, _reedPass, partial);

// Bottom vignette (screen fade at bottom), applied before reeded glass so glass overlay is unaffected
let _vignetteEffect = null;
let _vignettePass = null;

// Fullscreen gradient background plane
let _bgGrad = null;
// Black bottom cover plane for portrait phones
let _bottomCover = null;
// Store default background glow intensities for startup animation
let _bgGlow1Default = 0.9;
let _bgGlow2Default = 0.55;

function ensureBottomCover(){
  if (_bottomCover) return _bottomCover;
  const geo = new THREE.PlaneGeometry(1, 1, 1, 1);
  // Shader with feathered top edge (fade alpha near top)
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor:    { value: new THREE.Color(0x000000) },
      uOpacity:  { value: 1.0 },
      uFeather:  { value: 0.5 } // fraction of height to feather at top (increased blur)
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uFeather;
      void main(){
        // Fade out only near the top edge: fully opaque below, smooth to 0 at top
        float a = 1.0 - smoothstep(1.0 - uFeather, 1.0, vUv.y);
        gl_FragColor = vec4(uColor, a * uOpacity);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'BottomCoverPlane';
  // Draw last and above everything to hide seam
  mesh.renderOrder = 999;
  mesh.position.z = 100; // well in front of scene content
  mesh.visible = false;  // enabled only when needed
  scene.add(mesh);
  _bottomCover = mesh;
  return mesh;
}

// Optional: allow runtime tuning of feather width (0..0.6 recommended)
window.setBottomCoverFeather = function(v){
  const m = ensureBottomCover();
  if (m && m.material && m.material.uniforms && m.material.uniforms.uFeather){
    m.material.uniforms.uFeather.value = Math.max(0.0, Math.min(0.6, Number(v) || 0));
  }
};

function updateBottomCoverPlane(coverHeight){
  const m = ensureBottomCover();
  if (!coverHeight || coverHeight <= 0){ m.visible = false; return; }
  // Fit to current camera frustum width and requested cover height, align to bottom
  const fw = (camera.right - camera.left);
  const fh = (camera.top - camera.bottom);
  m.visible = true;
  m.scale.set(fw, coverHeight, 1);
  m.position.x = (camera.left + camera.right) * 0.5;
  m.position.y = camera.bottom + coverHeight * 0.5;
}

function createGradientBackground() {
  if (_bgGrad) return;
  const geo = new THREE.PlaneGeometry(1, 1, 1, 1);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
  uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  uTopColor: { value: new THREE.Color(0x1C214B) },
  uBottomColor: { value: new THREE.Color(0x0A0707) },
  // Radial red glow (#77211A), centered horizontally, 25% from bottom
  uGlowColor: { value: new THREE.Color(0x77211A) },
  uGlowCenter: { value: new THREE.Vector2(0.5, 0.25) },
  uGlowRadius: { value: 0.43 },
  uGlowIntensity: { value: 0.9 },
  // Additional large static glow on top-left (replacing removed blob)
  uGlow2Color: { value: new THREE.Color(0x810C01) },
  uGlow2Center: { value: new THREE.Vector2(0.04, 0.70) },
  uGlow2Radius: { value: 0.62 },
  uGlow2Intensity: { value: 0.55 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform vec3 uTopColor;
      uniform vec3 uBottomColor;
      uniform vec2 uResolution;
      uniform vec3 uGlowColor; 
      uniform vec2 uGlowCenter; 
      uniform float uGlowRadius; 
      uniform float uGlowIntensity;
  // Second static glow (top-left)
  uniform vec3 uGlow2Color; 
  uniform vec2 uGlow2Center; 
  uniform float uGlow2Radius; 
  uniform float uGlow2Intensity;

      vec3 screenBlend(vec3 base, vec3 over){
        return 1.0 - (1.0 - base) * (1.0 - over);
      }
      void main() {
        // vUv.y is 1.0 at top and 0.0 at bottom for PlaneGeometry
        float t = 1.0 - clamp(vUv.y, 0.0, 1.0);
        vec3 col = mix(uTopColor, uBottomColor, t);

        // Circular blur gradient (aspect-correct) as a red glow behind the head (center-bottom)
        vec2 p = vUv - uGlowCenter;
        float aspect = max(uResolution.x, 1.0) / max(uResolution.y, 1.0);
        p.x *= aspect;
        float d = length(p);
        float m = 1.0 - smoothstep(0.0, max(uGlowRadius, 1e-4), d); // 1 at center -> 0 at radius
        // Slight softening
        m = pow(m, 1.4);
        vec3 glow = uGlowColor * (uGlowIntensity * m);
        col = screenBlend(col, glow);

        // Large warm glow from top-left
        vec2 p2 = vUv - uGlow2Center;
        p2.x *= aspect;
        float d2 = length(p2);
        float m2 = 1.0 - smoothstep(0.0, max(uGlow2Radius, 1e-4), d2);
        m2 = pow(m2, 1.6);
        vec3 glow2 = uGlow2Color * (uGlow2Intensity * m2);
        col = screenBlend(col, glow2);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    depthTest: true,
    depthWrite: true,
    toneMapped: false
  });
  _bgGrad = new THREE.Mesh(geo, mat);
  _bgGrad.name = 'BackgroundGradientPlane';
  _bgGrad.renderOrder = -1000; // draw first
  _bgGrad.position.z = -80;    // behind everything else
  scene.add(_bgGrad);
}

function positionGradientBackgroundFromFrustum() {
  if (!_bgGrad) return;
  const fw = (camera.right - camera.left);
  const fh = (camera.top - camera.bottom);
  // Increase bleed significantly to cover scene movement in section 6 (scene moves +8 units)
  // Need extra coverage on the left side when scene shifts right
  const bleed = 1.4; // Increased from 1.06 to ensure full coverage
  _bgGrad.scale.set(fw * bleed, fh * bleed, 1);
  // Counter the scene's position so the background stays centered on the camera
  const cx = (camera.left + camera.right) * 0.5;
  const cy = (camera.top + camera.bottom) * 0.5;
  _bgGrad.position.x = cx - (scene.position?.x || 0);
  _bgGrad.position.y = cy - (scene.position?.y || 0);

  // Keep shader aware of CSS pixel resolution for consistent look
  const vw = window.visualViewport ? Math.floor(window.visualViewport.width) : window.innerWidth;
  const vh = window.visualViewport ? Math.floor(window.visualViewport.height) : window.innerHeight;
  const uRes = _bgGrad.material.uniforms.uResolution;
  if (uRes && uRes.value) uRes.value.set(vw, vh);
}

// Update gradient colors based on scroll progress
function updateGradientColorsForScroll(scrollProgress) {
  if (!_bgGrad || !_bgGrad.material || !_bgGrad.material.uniforms) return;
  
  // Original top color: #1C214B (dark blue)
  // Target top color when scrolled: #050505 (almost black)
  const originalTopColor = new THREE.Color(0x1C214B);
  const scrolledTopColor = new THREE.Color(0x0C0F21);
  
  // Interpolate between original and scrolled top color
  const currentTopColor = originalTopColor.clone().lerp(scrolledTopColor, scrollProgress);
  
  // Update the uniform
  _bgGrad.material.uniforms.uTopColor.value.copy(currentTopColor);
}

const hemLight = new THREE.HemisphereLight( 0xabd5f7, 0x000000, 40 );
scene.add( hemLight );

// Strong warm red point light from below/front center (under-face glow)
const underfacePointLight = new THREE.PointLight(0xE60E00, 3000, 12); // color, intensity, range
underfacePointLight.position.set(0, 8, -4);
scene.add(underfacePointLight);

// Warm red spotlight from slightly below, angled up toward hairline
const redUnderHairSpot = new THREE.SpotLight(0xE60E00, 3500, 40, Math.PI / 3.6, 0.8, 1);
redUnderHairSpot.position.set(0, 5, 4.5); // below head, toward camera
redUnderHairSpot.target.position.set(0, 8, 2.5); // aim toward hairline
redUnderHairSpot.target.updateMatrixWorld();
redUnderHairSpot.castShadow = false; // no shadows for performance
scene.add(redUnderHairSpot);
scene.add(redUnderHairSpot.target);

// Warm red spotlight from front-right side
const redFrontRightSpot = new THREE.SpotLight(0xE60E00, 1000);
redFrontRightSpot.angle = Math.PI / 7; // narrow beam
redFrontRightSpot.penumbra = 1; // soft edge
redFrontRightSpot.decay = 0.8; // falloff
redFrontRightSpot.distance = 50;
redFrontRightSpot.position.set(8, 10, 7);
redFrontRightSpot.target.position.set(14, 25, -4);
redFrontRightSpot.target.updateMatrixWorld();
scene.add(redFrontRightSpot);
scene.add(redFrontRightSpot.target);

// Narrow warm red spotlight from far upper-right
const redUpperRightSpot = new THREE.SpotLight(0x880800, 1200);
redUpperRightSpot.angle = Math.PI / 28; // very narrow
redUpperRightSpot.penumbra = 1; // soft edge
redUpperRightSpot.decay = 1.1; // falloff
redUpperRightSpot.distance = 50;
redUpperRightSpot.position.set(8, 22, 32);
redUpperRightSpot.target.position.set(6, 28, 0);
redUpperRightSpot.target.updateMatrixWorld();
scene.add(redUpperRightSpot);
scene.add(redUpperRightSpot.target);

// Warm red spotlight from left side
const redLeftSpot = new THREE.SpotLight(0x880800, 100);
redLeftSpot.angle = Math.PI / 7;
redLeftSpot.penumbra = 0.3;
redLeftSpot.decay = 1.3;
redLeftSpot.distance = 12;
redLeftSpot.position.set(-7, 9, 3);
redLeftSpot.target.position.set(0, 17, 11);
redLeftSpot.target.updateMatrixWorld();
scene.add(redLeftSpot);
scene.add(redLeftSpot.target);

// Top-down cool bluish spotlight
const topCoolBlueSpot = new THREE.SpotLight(0x75B3CA, 150);
topCoolBlueSpot.angle = Math.PI / 5;
topCoolBlueSpot.penumbra = 0.1;
topCoolBlueSpot.decay = 1;
topCoolBlueSpot.distance = 8;
topCoolBlueSpot.position.set(0, 33, 12);
topCoolBlueSpot.target.position.set(0, 0, -5);
topCoolBlueSpot.target.updateMatrixWorld();
scene.add(topCoolBlueSpot);
scene.add(topCoolBlueSpot.target);

// Top-down neutral gray spotlight from upper-left
const topGrayLeftSpot = new THREE.SpotLight(0x8D8D8D, 300);
topGrayLeftSpot.angle = Math.PI / 7;
topGrayLeftSpot.penumbra = 0.5;
topGrayLeftSpot.decay = 1;
topGrayLeftSpot.distance = 28;
topGrayLeftSpot.position.set(-8, 34, -3);
topGrayLeftSpot.target.position.set(-13, 0, 4);
topGrayLeftSpot.target.updateMatrixWorld();
scene.add(topGrayLeftSpot);
scene.add(topGrayLeftSpot.target);

// Overhead neutral gray spotlight from slightly front-right
const overheadNeutralSpot = new THREE.SpotLight(0x8D8D8D, 100);
overheadNeutralSpot.angle = Math.PI / 10;
overheadNeutralSpot.penumbra = 1.6;
overheadNeutralSpot.decay = 1;
overheadNeutralSpot.distance = 16;
overheadNeutralSpot.position.set(0, 30, 14);  // above head, slightly forward
overheadNeutralSpot.target.position.set(2, 22, 11); // aiming toward upper face/hair
overheadNeutralSpot.target.updateMatrixWorld();
scene.add(overheadNeutralSpot);
scene.add(overheadNeutralSpot.target);

// Collect all lights, remember their final intensities, and start at 10%
const allLights = [
  hemLight,
  underfacePointLight,
  redUnderHairSpot,
  redFrontRightSpot,
  redUpperRightSpot,
  redLeftSpot,
  topCoolBlueSpot,
  topGrayLeftSpot,
  overheadNeutralSpot
];

const lightFinalIntensities = new Map();
allLights.forEach(l => {
  if (!l) return;
  lightFinalIntensities.set(l, l.intensity);
  l.intensity = l.intensity * 0.1; // start at 10% before eyes turn on
});

// Music-reactive lighting configuration — EXPOSED FOR EASY TUNING
// Tip: You can change any of these at runtime with window.updateMusicReactiveConfig({...})
const musicReactiveConfig = {
  // 1) Analysis resolution and band selection
  // Larger fftSize => more frequency resolution (must be a power of two: 32..32768)
  fftSize: 256,
  // Frequency “bins” to average for each band (indexes into analyser.getByteFrequencyData array)
  bassBins: [0, 12], // Use lower bins for kick/bass (inclusive start, exclusive end)
  midBins: [12, 32], // Use low-mid for synth body

  // 2) Beat detection (for bright flashes on the main beat)
  // Uses a simple z-score on the chosen band with a cooldown so not every beat triggers
  beat: {
    band: 'mid',       // Which band to listen to for beat flashes: 'bass' | 'mid'
    thresholdZ: 1.6,    // Higher => fewer flashes; lower => more
    minIntervalMs: 420, // Minimum time between flashes (ms). ~420ms ≈ 143 BPM
    holdMs: 120,         // Time to hold max brightness after a trigger (ms)
    decayMs: 800        // Time to fade from max back to 0 after hold (ms)
  },

  // 3) Continuous (non-beat) movement so lights breathe with music between flashes
  // This keeps the scene alive even without major beat triggers
  cont: {
    bassGain: 0.5,    // Multiplier for bass continuous movement (0 => off, increase for more movement)
    midGain: 0.3,     // Multiplier for mid continuous movement (increase to see synth leads)
    hemAdd: 5        // Additive intensity for hemisphere light (base + this * level; increase for more breathing)
  },

  // 4) Flash amounts applied on each detected beat
  flash: {
    redMult: 1.2, // Multiplier applied to red spotlights on a beat (1 => no flash)
    hemAdd: 12    // Additive intensity applied to hemisphere light on a beat (0 => no flash)
  },

  // 5) How quickly lights move toward their targets (0..1 where 1=instant, 0=never)
  // Higher = snappier response, lower = smoother/delayed response
  responsiveness: {
    bass: 0.65,       // Bass light responsiveness (increase for snappier bass pulses)
    mid: 0.6,         // Mid light responsiveness (increase for snappier synth reactions)
    hem: 0.65         // Hemisphere responsiveness (increase for quicker scene breathing)
  },

  // 6) Debug: Set to true to see beat detection in console
  debugBeats: false
};

// Music-reactive lighting setup
// Note: Exclude cool/neutral lights and redUpperRightSpot as requested.
const reactiveLights = {
  bass: [underfacePointLight, redUnderHairSpot], // Low frequencies - red/warm
  mid: [redFrontRightSpot, redLeftSpot, hemLight],         // Mid frequencies - side reds
  ambient: [hemLight, overheadNeutralSpot]                            // Hemisphere ambient
};

// --- Simple beat detector state ---
const _beatState = {
  ema: 0,      // exponential moving average of band level
  ema2: 0,     // exponential moving average of squared level (for variance)
  init: false,
  lastTrigger: 0,
  flashStart: 0
};

// --- Base gradient glow intensities (set at startup) ---
let _bgGlow1BaseIntensity = 0.9;  // uGlowIntensity base
let _bgGlow2BaseIntensity = 0.55; // uGlow2Intensity base

function _updateBeatDetector(level01, nowMs) {
  // level01 is 0..1 normalized band level
  const alpha = 0.08; // smoothing for EMA (lower = smoother)
  if (!_beatState.init) {
    _beatState.ema = level01;
    _beatState.ema2 = level01 * level01;
    _beatState.init = true;
  } else {
    _beatState.ema = (1 - alpha) * _beatState.ema + alpha * level01;
    _beatState.ema2 = (1 - alpha) * _beatState.ema2 + alpha * level01 * level01;
  }

  const variance = Math.max(0, _beatState.ema2 - _beatState.ema * _beatState.ema);
  const std = Math.sqrt(variance + 1e-6);
  const z = std > 1e-5 ? (level01 - _beatState.ema) / std : 0;

  const cfg = musicReactiveConfig.beat;
  const elapsed = nowMs - _beatState.lastTrigger;
  if (z >= cfg.thresholdZ && elapsed >= cfg.minIntervalMs) {
    _beatState.lastTrigger = nowMs;
    _beatState.flashStart = nowMs; // begin hold/decay window
  }
}

function _getFlashLevel(nowMs) {
  // Returns 0..1 where 1 is full flash during hold, then decays to 0
  if (_beatState.flashStart === 0) return 0;
  const cfg = musicReactiveConfig.beat;
  const t = nowMs - _beatState.flashStart;
  if (t <= cfg.holdMs) return 1;
  const decayT = t - cfg.holdMs;
  if (decayT >= cfg.decayMs) return 0;
  return Math.max(0, 1 - decayT / cfg.decayMs);
}

function updateReactiveLighting() {
  if (!isAudioPlaying || !analyser || !dataArray) return;

  analyser.getByteFrequencyData(dataArray);

  // --- Aggregate bands ---
  const [b0, b1] = musicReactiveConfig.bassBins;
  const [m0, m1] = musicReactiveConfig.midBins;
  const bass = dataArray.slice(b0, b1).reduce((a, b) => a + b, 0) / Math.max(1, (b1 - b0));
  const mid = dataArray.slice(m0, m1).reduce((a, b) => a + b, 0) / Math.max(1, (m1 - m0));
  const bassNorm = Math.pow(bass / 255, 1.3); // slightly emphasize
  const midNorm = Math.pow(mid / 255, 1.15);

  // --- Beat detector (uses selected band) ---
  const nowMs = performance.now();
  const beatBandLevel = musicReactiveConfig.beat.band === 'mid' ? midNorm : bassNorm;
  _updateBeatDetector(beatBandLevel, nowMs);
  const flash = _getFlashLevel(nowMs); // 0..1

  // --- Apply continuous modulation always ---
  reactiveLights.bass.forEach(light => {
    const base = lightFinalIntensities.get(light) || light.intensity;
    // Continuous modulation based on bass level
    const contMultiplier = 1 + bassNorm * musicReactiveConfig.cont.bassGain;
    // Add flash on top when beat is detected
    const flashMultiplier = flash * musicReactiveConfig.flash.redMult;
    const target = base * (contMultiplier + flashMultiplier) * currentSpotlightIntensity;
    light.intensity += (target - light.intensity) * musicReactiveConfig.responsiveness.bass;
  });

  reactiveLights.mid.forEach(light => {
    const base = lightFinalIntensities.get(light) || light.intensity;
    // Continuous modulation based on mid level
    const contMultiplier = 1 + midNorm * musicReactiveConfig.cont.midGain;
    // Add flash on top when beat is detected
    const flashMultiplier = flash * musicReactiveConfig.flash.redMult;
    const target = base * (contMultiplier + flashMultiplier) * currentSpotlightIntensity;
    light.intensity += (target - light.intensity) * musicReactiveConfig.responsiveness.mid;
  });

  reactiveLights.ambient.forEach(light => {
    const base = lightFinalIntensities.get(light) || light.intensity;
    // Continuous modulation based on mid level (hemisphere follows mid)
    const contAdd = midNorm * musicReactiveConfig.cont.hemAdd;
    // Add flash on top when beat is detected
    const flashAdd = flash * musicReactiveConfig.flash.hemAdd;
    const target = base + contAdd + flashAdd;
    light.intensity += (target - light.intensity) * musicReactiveConfig.responsiveness.hem;
  });

  // --- Modulate gradient background glow (center red glow behind neck) ---
  if (_bgGrad && _bgGrad.material && _bgGrad.material.uniforms) {
    const u = _bgGrad.material.uniforms;
    // Primary glow (center red glow behind neck) follows mid level with continuous modulation at reduced intensity
    const glowContMultiplier = 1 + midNorm * musicReactiveConfig.cont.midGain * 0.04; // 20% of previous modulation
    const glowFlashAdd = flash * musicReactiveConfig.flash.hemAdd * 0.03; // 20% of previous flash
    const glowTarget = _bgGlow1BaseIntensity * glowContMultiplier + glowFlashAdd;
    if (u.uGlowIntensity) {
      u.uGlowIntensity.value += (glowTarget - u.uGlowIntensity.value) * musicReactiveConfig.responsiveness.hem;
    }
  }
}

// Expose config updater for console tweaks
window.updateMusicReactiveConfig = function(updates) {
  Object.assign(musicReactiveConfig, updates);
  console.log('Music reactive lighting config updated:', musicReactiveConfig);
};

// Call once before adding any RectAreaLight

const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

new RGBELoader(loadingManager)
  .load(hdriUrl, (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;

        // Create a scene just for rotation
        const hdrScene = new THREE.Scene();
        const hdrSphere = new THREE.Mesh(
            new THREE.SphereGeometry(1, 60, 40),
            new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide })
        );

        hdrSphere.rotation.y = THREE.MathUtils.degToRad(-90); 
        hdrScene.add(hdrSphere);

        const envMap = pmremGenerator.fromScene(hdrScene).texture;

        scene.environment = envMap;
        scene.background = envMap;

        pmremGenerator.dispose();
});

let blackMaterial = new THREE.MeshBasicMaterial({
  color: 0x000000,
  side: THREE.DoubleSide,
  toneMapped: false,
  fog: false
});

// loading external GLTF head
let mixer, GLTFHead;

function loadGLTFHead(GLTFName) {
  const loader = new GLTFLoader(loadingManager);

    // Meshopt for geometry compression
    loader.setMeshoptDecoder(MeshoptDecoder);

    loader.load(GLTFName, function (gltf) {
        GLTFHead = gltf.scene;
        let GLTFAnimations = gltf.animations;

        currentTime = 0;

        manipulateModel(GLTFHead, GLTFAnimations);

        // Initialize scroll-based effects to match current page position before startup
        initializeScrollEffectsFromCurrentPosition();
        
    modelReady = true;
    tryStartStartupSequence();

    }, undefined, function (error) {
        console.error(error);
    modelReady = true;
    tryStartStartupSequence();
    });
}

loadGLTFHead(modelUrl);

let chin, neck, head, leftShoulder, rightShoulder;

function manipulateModel(model, animations) {
    
    mixer = new THREE.AnimationMixer(model);
    const windClip = THREE.AnimationClip.findByName(animations, 'Wind');
    if (windClip) mixer.clipAction(windClip).play();

    const materialConfigs = {
        Face: {
            metallic: 0.99,
            roughness: 0.38
        },
        Sweater: {
            metallic: 0,
            roughness: 1
        },
        Hair: {
            metallic: 1,
            roughness: 0.7
        }
    };

  const shadowMaskTexture = new THREE.TextureLoader(loadingManager).load(shadowMaskUrl);
    shadowMaskTexture.flipY = false;
    if (shadowMaskTexture) shadowMaskTexture.anisotropy = MAX_ANISOTROPY;

    // Helper: set max anisotropy on all textures a material may use
    function setMaterialMaxAnisotropy(mat){
      if (!mat) return;
      const maybeSet = (tex)=>{ if (tex && tex.isTexture) tex.anisotropy = Math.max(tex.anisotropy || 1, MAX_ANISOTROPY); };
      maybeSet(mat.map);
      maybeSet(mat.normalMap);
      maybeSet(mat.roughnessMap);
      maybeSet(mat.metalnessMap);
      maybeSet(mat.aoMap);
      maybeSet(mat.emissiveMap);
      maybeSet(mat.specularMap);
      maybeSet(mat.clearcoatNormalMap);
      maybeSet(mat.displacementMap);
    }

    // Helper: collect candidate names from node and a couple of ancestors
    function collectAncestorNamesLower(object3d) {
        const names = [];
        let current = object3d;
        for (let i = 0; i < 3 && current; i++) {
            if (current.name && typeof current.name === 'string') {
                names.push(current.name.toLowerCase());
            }
            current = current.parent;
        }
        return names;
    }

    // Helper: does any node/ancestor name equal or include token (case-insensitive)
    function nameMatches(object3d, token) {
        const t = token.toLowerCase();
        const pool = collectAncestorNamesLower(object3d);
        return pool.some(n => n === t || n.includes(t));
    }

    // Helper: find the config key that matches this node by name (node or ancestors)
    function getConfigKeyFor(object3d) {
        const pool = collectAncestorNamesLower(object3d);
        for (const key of Object.keys(materialConfigs)) {
            const k = key.toLowerCase();
            if (pool.some(n => n === k || n.includes(k))) return key;
        }
        return null;
    }

    model.traverse((child) => {
        if (child.type === 'SkinnedMesh') {
            child.frustumCulled = false;
            child.geometry.computeTangents();
        }
    if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
      // Sharpen texture filtering
      if (Array.isArray(child.material)) child.material.forEach(setMaterialMaxAnisotropy);
      else setMaterialMaxAnisotropy(child.material);

            // Add bloom to eyes (match node or ancestor names)
            if (nameMatches(child, 'eye')) {
                child.material.emissive = new THREE.Color('#0053ED');
                child.material.color.set('#2C2C2C');
                child.material.emissiveIntensity = 3;
                child.material.emissiveMap = child.material.map;
                bloomEffect.selection.add(child);
                // Track eyes for startup sequence
                child.userData.eyeOriginalEmissiveIntensity = child.material.emissiveIntensity;
                child.userData.eyeOriginalColor = child.material.color; // Store original color
                eyeMeshes.push(child);
            }

            // Apply black material to sweater_black by node/ancestor names
            if (nameMatches(child, 'sweater_black')) {
                child.material = blackMaterial;
            }
        }

        const cfgKey = child.isMesh ? getConfigKeyFor(child) : null;
        if (child.isMesh && cfgKey) {
            const params = materialConfigs[cfgKey];
            const mat = child.material;

            mat.metalness = params.metallic;
            mat.roughness = params.roughness;

            mat.onBeforeCompile = (shader) => {
                for (let key in params) {
                    if (key !== "metallic" && key !== "roughness") {
                        shader.uniforms[key] = { value: params[key] };
                    }
                }

                if (cfgKey === 'Face') {
                    shader.uniforms.shadowMask = { value: shadowMaskTexture };
                    shader.fragmentShader = `
                        uniform sampler2D shadowMask;
                    ` + shader.fragmentShader;
                }

                shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <normal_fragment_maps>',
                    (cfgKey === 'Face') ? `
                    #include <normal_fragment_maps>
                    {
                      roughnessFactor = ${params.roughness.toFixed(3)};
                      float maskVal = texture2D(shadowMask, vUv).r;
                      diffuseColor.rgb *= (1.0 - maskVal);
                      roughnessFactor = mix(roughnessFactor, 1.0, maskVal);
                      metalnessFactor = mix(metalnessFactor, 0.0, maskVal);
                    }` : `#include <normal_fragment_maps>`
                );
            };

            setMaterialMaxAnisotropy(mat);
            mat.needsUpdate = true;
        }
    });

    // === Bone references ===
    model.traverse(o => {
        if (o.isBone && o.name === 'Chin') {
            chin = o;
            // Gate head look until startup finishes
            if (allowHeadLook) startHeadLook(chin);
        }
        if (o.isBone && o.name === 'Neck') neck = o;
        if (o.isBone && o.name === 'Head') head = o;
        if (o.isBone && o.name === 'Right_shoulder') rightShoulder = o;
        if (o.isBone && o.name === 'Left_shoulder') leftShoulder = o;
    });

    scene.add(model);
    // model.rotation.y -= 0.2;
    // Chin pose: slight up during startup, default otherwise
    chin.rotation.x = startupActive ? (Math.PI / 2 - initialChinLiftRad) : Math.PI / 2;

  // Glow blobs removed
}

// --- Tunables ---
const DEGREE_LIMIT = 25;
const LOOK_DAMP    = 10;
const DEADZONE_DEG = 0.2;

// Breathing
const BREATH_SPEED_MS         = 0.0013;
const CHIN_BREATH_AMPL_RAD    = THREE.MathUtils.degToRad(1.1);
const SHOULDER_BREATH_AMPL    = 0.23;
const SHOULDER_PHASE          = Math.PI;
const BREATH_EASE_IN_MS       = 2000;

// Inactivity return
const RETURN_DAMP   = 4;

// Eases the *start* of the snap‑back after inactivity so it doesn’t jerk
const RETURN_EASE_MS = 4000;        // how long to ramp into the return motion
// When the window is being resized, treat rotations gently for a short settle period
const RESIZE_SETTLE_MS = 250;      // grace period after every resize event

// --- State ---
let mousecoords = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let lastMouseMoveTime = Date.now();
let _headLookClock = new THREE.Clock();

// Breathing state
let _breathClockMs = Date.now();
let _breathPhase   = 0;
let _chinBreathOffset = 0;
let _shoulderGain = 0;
let _shoulderStartMs = Date.now();
let _baseLeftShoulderY = null;
let _baseRightShoulderY = null;
let _chinGain = 0;
let _chinBreathActive = false;
let _chinStartMs = null;
let _wasInactive = false;          // tracks transition into inactivity
let _inactiveStartMs = 0;          // when inactivity began (for easing)
let _lastResizeMs = 0;             // timestamp of last resize event

function _clamp01(v){ return Math.max(0, Math.min(1, v)); }
function _easeInOutQuad(t){ t=_clamp01(t); return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2; }

if (!IS_TOUCH_DEVICE) {
  document.addEventListener('mousemove', (e) => {
    lastMouseMoveTime = Date.now();
    mousecoords = { x: e.clientX, y: e.clientY };
  }, { passive: true });
}

window.addEventListener('mouseleave', () => {
  mousecoords = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
});

function _markResize() {
  _lastResizeMs = Date.now();
  // While layout is fluid, steer target to center briefly to avoid random jumps
  mousecoords = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}
window.addEventListener('resize', _markResize, { passive: true });
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', _markResize, { passive: true });
}

let _headLookJustStarted = false;
let _headLookStartMs = 0;
let _headLookInitialCoords = null;

function startHeadLook() {
  _headLookClock.getDelta();
  _headLookJustStarted = true;
  _headLookStartMs = Date.now();
  _headLookInitialCoords = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  _headLookRAF();
}
function stopHeadLook() {
  _headLookClock.stop();
}

function _headLookRAF() {
  const dt = _headLookClock.getDelta();
  const now = Date.now();

  // Detect inactivity window
  const inactive = (now - lastMouseMoveTime > inactivityThreshold);

  // Detect live-resize settling window
  const resizing = now - _lastResizeMs < RESIZE_SETTLE_MS;

  // Track transition into inactivity to start an ease-in ramp
  if (inactive && !_wasInactive) {
    _inactiveStartMs = now;
  }
  _wasInactive = inactive;

  // Compute return progress (0..1) used only while inactive
  const returnProgress = inactive ? _clamp01((now - _inactiveStartMs) / RETURN_EASE_MS) : 1;

  if (typeof chin !== 'undefined' && chin) {
    // Choose head target: center if inactive/resizing, else cursor
    const useCenter = IS_TOUCH_DEVICE || inactive || resizing;
    let targetCoords = useCenter ? { x: window.innerWidth / 2, y: window.innerHeight / 2 } : mousecoords;

    // Ease the first movement after startup
    if (_headLookJustStarted) {
      const easeDuration = 500; // ms
      const t = Math.min(1, (now - _headLookStartMs) / easeDuration);
      // Use cubic ease for organic start
      const easeT = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      targetCoords = {
        x: _headLookInitialCoords.x + (mousecoords.x - _headLookInitialCoords.x) * easeT,
        y: _headLookInitialCoords.y + (mousecoords.y - _headLookInitialCoords.y) * easeT
      };
      if (t >= 1) _headLookJustStarted = false;
    }

    moveJoint(targetCoords, chin, DEGREE_LIMIT, dt, inactive, resizing, returnProgress);
  }

  doBreathing();
  requestAnimationFrame(_headLookRAF);
}

// Simple breathing-only loop for touch devices (no head follow)
let _breathOnlyActive = false;
function startBreathingOnly(){
  if (_breathOnlyActive) return;
  _breathOnlyActive = true;
  const loop = () => { doBreathing(); requestAnimationFrame(loop); };
  loop();
}

function moveJoint(mouse, joint, degreeLimit, dt, inactive, resizing, returnProgress) {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const mx = (mouse && typeof mouse.x === 'number') ? mouse.x : cx;
  const my = (mouse && typeof mouse.y === 'number') ? mouse.y : cy;

  // Apply head movement restriction smoothly tied to scroll progress in sections 2 and 3
  // Calculate progress through sections 2-3 (from 1/3 to 2/3 of total scroll)
  const scrollProgressNormalized = Math.max(0, Math.min((currentScrollProgress - 1/3) * 3, 1.0)); // Normalize 1/3-2/3 to 0-1
  const restrictionProgress = scrollProgressNormalized; // Apply restriction during sections 2-3
  const restrictionMultiplier = 1.0 - (restrictionProgress * (1.0 - headMovementRestriction));
  const effectiveDegreeLimit = degreeLimit * restrictionMultiplier;

  const degrees = getMouseDegrees(mx, my, effectiveDegreeLimit);
  const targetRotationY = -THREE.MathUtils.degToRad(degrees.x) / 2.5;
  const targetRotationZ = -THREE.MathUtils.degToRad(degrees.x);
  const targetRotationX = Math.PI / 2 + THREE.MathUtils.degToRad(degrees.y) + _chinBreathOffset;

  // Base damping: normal look vs gentle return
  const baseDamp = inactive ? RETURN_DAMP : LOOK_DAMP;
  const alphaBase = 1 - Math.exp(-baseDamp * (dt || 0.016));

  // Ease the *start* of the return so it doesn’t kick with a jerk
  const easeFactor = inactive ? _easeInOutQuad(returnProgress) : 1;  // ramps 0→1 smoothly

  // While resizing, further soften changes to avoid wobble
  const resizeSoftener = resizing ? 0.25 : 1; // very gentle while viewport is in flux

  const alpha = alphaBase * easeFactor * resizeSoftener;
  const dead  = THREE.MathUtils.degToRad(DEADZONE_DEG);

  const dx = targetRotationX - joint.rotation.x;
  const dy = targetRotationY - joint.rotation.y;
  const dz = targetRotationZ - joint.rotation.z;

  if (Math.abs(dx) < dead && Math.abs(dy) < dead && Math.abs(dz) < dead) {
    joint.rotation.set(targetRotationX, targetRotationY, targetRotationZ);
    return;
  }

  // Blend toward target with controlled easing (prevents snap/jerk)
  joint.rotation.x += dx * alpha;
  joint.rotation.y += dy * alpha;
  joint.rotation.z += dz * alpha;
}

function getMouseDegrees(x, y, degreeLimit) {
  let dx = 0, dy = 0;
  const w = { x: window.innerWidth, y: window.innerHeight };
  // Clamp to window bounds so off-screen targets don't over-rotate
  const cx = Math.max(0, Math.min(w.x, x));
  const cy = Math.max(0, Math.min(w.y, y));

  if (cx <= w.x / 2) dx = ((degreeLimit * ((w.x / 2 - cx) / (w.x / 2) * 100)) / 100) * -1;
  if (cx >= w.x / 2) dx = (degreeLimit * ((cx - w.x / 2) / (w.x / 2) * 100)) / 100;
  if (cy <= w.y / 2) dy = (((degreeLimit * 0.5) * ((w.y / 2 - cy) / (w.y / 2) * 100)) / 100) * -1;
  if (cy >= w.y / 2) dy = (degreeLimit * ((cy - w.y / 2) / (w.y / 2) * 100)) / 100;

  return { x: dx, y: dy };
}

function doBreathing() {
  // Hold breathing entirely during startup sequence
  if (!allowBreathing) return;

  if (typeof leftShoulder !== 'undefined' && leftShoulder && _baseLeftShoulderY === null) {
    _baseLeftShoulderY = leftShoulder.position.y;
  }
  if (typeof rightShoulder !== 'undefined' && rightShoulder && _baseRightShoulderY === null) {
    _baseRightShoulderY = rightShoulder.position.y;
  }

  const nowMs = Date.now();
  const deltaMs = nowMs - _breathClockMs;
  _breathClockMs = nowMs;
  _breathPhase += BREATH_SPEED_MS * deltaMs;

  _shoulderGain = Math.min(1, (nowMs - _shoulderStartMs) / BREATH_EASE_IN_MS);

  // Chin breathing active when breathing is allowed
  let chinShouldBeActive = true;

  if (chinShouldBeActive) {
    if (!_chinBreathActive) {
      _chinBreathActive = true;
      _chinStartMs = nowMs;
      _chinGain = 0;
    } else if (_chinStartMs != null) {
      _chinGain = Math.min(1, (nowMs - _chinStartMs) / BREATH_EASE_IN_MS);
    }
  } else {
    _chinBreathActive = false;
    _chinGain = 0;
    _chinStartMs = null;
  }

  const shoulderOffset = Math.sin(_breathPhase + SHOULDER_PHASE) * SHOULDER_BREATH_AMPL * _shoulderGain;
  _chinBreathOffset = Math.sin(_breathPhase) * CHIN_BREATH_AMPL_RAD * _chinGain;

  if (typeof leftShoulder !== 'undefined' && leftShoulder && _baseLeftShoulderY !== null) {
    leftShoulder.position.y = _baseLeftShoulderY + shoulderOffset;
  }
  if (typeof rightShoulder !== 'undefined' && rightShoulder && _baseRightShoulderY !== null) {
    rightShoulder.position.y = _baseRightShoulderY + shoulderOffset;
  }

  // If head-follow is disabled (touch devices or head look not allowed),
  // apply the chin breathing offset directly to the chin bone rotation.
  if (chin && (IS_TOUCH_DEVICE || !allowHeadLook)) {
    const baseX = Math.PI / 2;
    chin.rotation.x = baseX + _chinBreathOffset;
    // Keep Y/Z as-is; head-follow would normally manage those when enabled
  }
}

const clock = new THREE.Clock();

const smaaEffect = new SMAAEffect(undefined, undefined, SMAAPreset.MEDIUM);
// On touch devices we prefer crispness (higher DPR) over heavy AA; use a lighter SMAA preset
if (IS_TOUCH_DEVICE) {
  try { smaaEffect.preset = SMAAPreset.LOW; } catch {}
}

const hueSatEffect = new HueSaturationEffect({
    hue: 0.09,         // warmer tone
    saturation: -0.25    // slight vibrance
});
  
const brightnessContrastEffect = new BrightnessContrastEffect({
    brightness: -0.07,   // tweak if needed
    contrast: 0.07     // subtle punch
});

// Grain overlay from the overlay effects module
const { effect: grainEffect, pass: grainPass } = createGrainPass(camera);
// Dial down grain on phones only (not tablets), based on width breakpoints
if (IS_TOUCH_DEVICE && isPhoneWidth()) {
  try { updateGrain(grainEffect, { opacity: 0.04 }); } catch {}
}



// ---- Device heuristics & base DPR caps ----
const MAX_EFFECTIVE_DPR = 1.75; // absolute safety ceiling
function detectDeviceProfile(){
  const ua = (navigator.userAgent || '').toLowerCase();
  const isMobile = /mobi|iphone|android/.test(ua) || (matchMedia && matchMedia('(pointer:coarse)').matches);
  const isTablet = (!isMobile && /ipad|tablet/.test(ua)) || (Math.min(screen.width, screen.height) >= 768 && Math.min(screen.width, screen.height) < 1100 && (window.devicePixelRatio||1) >= 1.5);
  const isMac = /mac/.test(ua);
  const isAppleSilicon = isMac && /apple/.test(navigator.vendor || '') && ('gpu' in navigator || /arm|apple/.test(ua));
  const isM1AirLike = isAppleSilicon && (window.devicePixelRatio||1) >= 2 && Math.max(screen.width, screen.height) <= 2560;
  const largeDisplay = Math.max(screen.width || 0, screen.height || 0) >= 2560;
  const cores = navigator.hardwareConcurrency || 0;
  const dpr = window.devicePixelRatio || 1;
  const isIPhone = /iphone/.test(ua);
  const isHighEndPhone = isMobile && ((isIPhone && cores >= 6) || (cores >= 8 && dpr >= 3));
  let category = 'desktop';
  let baseCapInitial = MAX_EFFECTIVE_DPR;
  let baseCapMax = MAX_EFFECTIVE_DPR;
  if (isMobile){
    category='phone';
    if (isHighEndPhone){
      // High-end phones can sustain higher internal resolution while still >60fps
      baseCapInitial = 1.6;  // noticeably sharper
      baseCapMax = 1.7;      // allow slight headroom if performance is great
    } else {
      // Typical phones: improved starting sharpness
      baseCapInitial = 1.35;
      baseCapMax = 1.5;
    }
  }
  else if (isTablet){ category='tablet'; baseCapInitial = 1.25; baseCapMax = 1.3; }
  else if (isM1AirLike){ category='fanless'; baseCapInitial = 1.25; baseCapMax = 1.35; }
  else { // desktop
    if (largeDisplay){
      // Start conservative on large 27" 4K: similar to old logic (~1.16) but allow upgrade if ample headroom
      baseCapInitial = 1.18; // starting ceiling
      baseCapMax = 1.55;     // allow later upgrades but not full 1.75 on huge surface
    } else {
      baseCapInitial = 1.55;
      baseCapMax = 1.75;
    }
  }
  baseCapInitial = Math.min(baseCapInitial, window.devicePixelRatio || 1);
  baseCapMax = Math.min(baseCapMax, window.devicePixelRatio || 1);
  return { category, baseCapInitial, baseCapMax, baseCapCurrent: baseCapInitial, largeDisplay };
}
const __deviceProfile = detectDeviceProfile();

// Quantized DPR buckets (multipliers applied to baseCap) – descending order
// Keep buckets relatively high to avoid overly soft image on phones
const DPR_BUCKETS = [1.0, 0.9, 0.8];
let _dprBucketIndex = 0; // start at full quality of current baseCapCurrent

// Effect quality tiers prioritizing subtle internal resolution drops before DPR buckets
// level 0 = best, higher = more aggressive downscale
const EFFECT_QUALITY_LEVELS = [
  { name:'Ultra', bloomScale:1.0,  reededScale:1.0 },
  { name:'High',  bloomScale:0.82, reededScale:0.9 },
  { name:'Med',   bloomScale:0.68, reededScale:0.8 },
  { name:'Low',   bloomScale:0.55, reededScale:0.7 } // reserve for very heavy scenes
];
let _effectQualityLevel = 0;

// Performance adaptation thresholds
const PERF_FPS_DROP_THRESHOLD = 55;        // trigger lowering when sustained below
const PERF_FPS_RAISE_THRESHOLD = 65;       // must be at/above this to consider raising
const PERF_DEGRADE_MIN_DURATION = 4000;    // ms of continuous low perf before degrading
const PERF_UPGRADE_MIN_DURATION = 6000;    // ms of sustained high perf before upgrading
const PERF_CHANGE_DEBOUNCE = 1300;         // ms between any two changes

// EMA smoothing (~1s window). We'll derive alpha dynamically per frame.
const EMA_WINDOW_SECONDS = 1.0;
let _emaFrameTime = 1/60; // start optimistic
let _lastPerfChangeTime = performance.now();
let _lowPerfAccum = 0;
let _highPerfAccum = 0;
let _lastEmaFPS = 60;

// Track canvas CSS size for re-applying on DPR changes without layout jumps
let _lastCSSW = window.innerWidth; let _lastCSSH = window.innerHeight;

// Resume/settling guard state
let _resumeGuardUntil = 0;           // time until which downscales are forbidden
let _resumeIgnoreFrames = 0;         // number of frames to ignore in EMA/scaler
let _postResumeDebounceUntil = 0;    // additional debounce window after guard

function _triggerResumeGuard(){
  const now = performance.now();
  _resumeGuardUntil = now + 4500;         // forbid downscales ~4.5s
  _resumeIgnoreFrames = 60;               // ignore first ~60 frames
  _postResumeDebounceUntil = now + 7000;  // extra debounce for a bit after
  // Reset EMA and accumulators
  _emaFrameTime = 1/60;
  _lowPerfAccum = 0; _highPerfAccum = 0;
  _lastPerfChangeTime = now; // also pushes next allowed change
}

// Hook resume-like events
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') _triggerResumeGuard();
}, { passive: true });
window.addEventListener('focus', _triggerResumeGuard, { passive: true });
window.addEventListener('pageshow', _triggerResumeGuard, { passive: true });

function applyEffectQuality(){
  const tier = EFFECT_QUALITY_LEVELS[_effectQualityLevel];
  if (!tier) return;
  // Do NOT change bloom in real time – it's perceptible. Keep bloom at its initial resolution.
  // Only adjust reeded internal resolution subtly.
  try {
    if (_reedEffect && typeof setReededResolution === 'function') {
      setReededResolution(_reedEffect, Math.floor(_lastCSSW * tier.reededScale), Math.floor(_lastCSSH * tier.reededScale));
    }
  } catch(e){ /* silent */ }
}

function currentTargetPixelRatio(){
  const base = __deviceProfile.baseCapCurrent;
  const bucketMul = DPR_BUCKETS[_dprBucketIndex] || 1.0;
  return Math.min(base * bucketMul, MAX_EFFECTIVE_DPR, window.devicePixelRatio || 1);
}

function _applyRendererPixelRatio(){
  const pr = currentTargetPixelRatio();
  renderer.setPixelRatio(pr);
  renderer.setSize(_lastCSSW, _lastCSSH, false);
  composer.setSize(_lastCSSW, _lastCSSH);
  // Update dependent resolutions (vignette wants framebuffer resolution)
  const epr = pr; // effective pixel ratio used
  resizeRendererAndComposer._epr = pr;
  if (_vignetteEffect) setBottomVignetteResolution(_vignetteEffect, Math.floor(_lastCSSW * epr), Math.floor(_lastCSSH * epr));
  applyEffectQuality();
  // Pixel budget check (in case baseCapCurrent changed before this call)
  if (typeof enforcePixelBudget === 'function') enforcePixelBudget();
}

// Replace old computation function (kept name for legacy calls)
function computeEffectivePixelRatio(){
  return currentTargetPixelRatio();
}

function _effectiveDebounceMs(now){
  return PERF_CHANGE_DEBOUNCE + (now < _postResumeDebounceUntil ? 700 : 0);
}

function attemptDegrade(now){
  if (now < _resumeGuardUntil) return; // downscales forbidden during guard
  if (now - _lastPerfChangeTime < _effectiveDebounceMs(now)) return;
  // First try effect quality
  if (_effectQualityLevel < EFFECT_QUALITY_LEVELS.length - 1){
    const prevTier = EFFECT_QUALITY_LEVELS[_effectQualityLevel].name;
    _effectQualityLevel++;
    const newTier = EFFECT_QUALITY_LEVELS[_effectQualityLevel].name;
    applyEffectQuality();
  _lastPerfChangeTime = now;
  window.__perfDebug && console.log('[Perf] Degraded effect tier ->', newTier);
  if (typeof _logChange === 'function') _logChange('Tier ↓', prevTier, newTier, `EMA ${_lastEmaFPS.toFixed(1)} < ${PERF_FPS_DROP_THRESHOLD} for ${PERF_DEGRADE_MIN_DURATION}ms`);
    return;
  }
  // Then drop DPR bucket (if possible)
  if (_dprBucketIndex < DPR_BUCKETS.length - 1){
    const prevB = DPR_BUCKETS[_dprBucketIndex];
    _dprBucketIndex++;
    const newB = DPR_BUCKETS[_dprBucketIndex];
    _applyRendererPixelRatio();
  _lastPerfChangeTime = now;
  window.__perfDebug && console.log('[Perf] Dropped DPR bucket ->', newB);
  if (typeof _logChange === 'function') _logChange('Bucket ↓', String(prevB), String(newB), `EMA ${_lastEmaFPS.toFixed(1)} < ${PERF_FPS_DROP_THRESHOLD} for ${PERF_DEGRADE_MIN_DURATION}ms`);
  }
}

// Pixel budget: cap internal pixel count to avoid needless GPU usage on large 4K monitors
const PIXEL_BUDGET = 9_000_000; // ~ between 1440p@1.5x and 4K@1.0x
function enforcePixelBudget(){
  let pr = currentTargetPixelRatio();
  let internalPixels = _lastCSSW * _lastCSSH * pr * pr;
  let changed = false;
  while (internalPixels > PIXEL_BUDGET && (_dprBucketIndex < DPR_BUCKETS.length - 1)){
    _dprBucketIndex++; // drop bucket
    pr = currentTargetPixelRatio();
    internalPixels = _lastCSSW * _lastCSSH * pr * pr;
    changed = true;
  }
  if (changed) {
    _applyRendererPixelRatio();
    window.__perfDebug && console.log('[Perf] Enforced pixel budget, DPR bucket now', DPR_BUCKETS[_dprBucketIndex]);
    if (typeof _logChange === 'function') _logChange('Budget', '-', String(DPR_BUCKETS[_dprBucketIndex]), `>${(PIXEL_BUDGET/1e6).toFixed(1)} MP framebuffer`);
  }
}

function attemptUpgrade(now){
  if (now - _lastPerfChangeTime < _effectiveDebounceMs(now)) return;
  // Prefer restoring DPR first (visual crispness) if we've lowered it
  if (_dprBucketIndex > 0){
    const prevB = DPR_BUCKETS[_dprBucketIndex];
    _dprBucketIndex--;
    const newB = DPR_BUCKETS[_dprBucketIndex];
    _applyRendererPixelRatio();
  _lastPerfChangeTime = now;
  window.__perfDebug && console.log('[Perf] Raised DPR bucket ->', newB);
    if (typeof _logChange === 'function') _logChange('Bucket ↑', String(prevB), String(newB), `EMA ${_lastEmaFPS.toFixed(1)} ≥ ${PERF_FPS_RAISE_THRESHOLD} for ${PERF_UPGRADE_MIN_DURATION}ms`);
    return;
  }
  // Then restore effect quality
  if (_effectQualityLevel > 0){
    const prevTier = EFFECT_QUALITY_LEVELS[_effectQualityLevel].name;
    _effectQualityLevel--;
    const newTier = EFFECT_QUALITY_LEVELS[_effectQualityLevel].name;
    applyEffectQuality();
  _lastPerfChangeTime = now;
  window.__perfDebug && console.log('[Perf] Upgraded effect tier ->', newTier);
    if (typeof _logChange === 'function') _logChange('Tier ↑', prevTier, newTier, `EMA ${(_lastEmaFPS).toFixed(1)} ≥ ${PERF_FPS_RAISE_THRESHOLD} for ${PERF_UPGRADE_MIN_DURATION}ms`);
    return;
  }
  // Finally, if everything is maxed and we are still very healthy, allow raising baseCapCurrent slightly (for desktops only)
  if (__deviceProfile.category === 'desktop' && __deviceProfile.baseCapCurrent < __deviceProfile.baseCapMax){
    const prev = __deviceProfile.baseCapCurrent;
    __deviceProfile.baseCapCurrent = Math.min(__deviceProfile.baseCapMax, __deviceProfile.baseCapCurrent + 0.1);
    _applyRendererPixelRatio();
  _lastPerfChangeTime = now;
  window.__perfDebug && console.log('[Perf] Increased desktop baseCapCurrent ->', __deviceProfile.baseCapCurrent.toFixed(2));
  if (typeof _logChange === 'function') _logChange('Desktop baseCap ↑', prev.toFixed(2), __deviceProfile.baseCapCurrent.toFixed(2), '');
  }
}

function perfAdaptiveUpdate(delta){
  // delta already in seconds
  const now = performance.now();
  const alpha = 1 - Math.exp(-delta / EMA_WINDOW_SECONDS); // continuous-time EMA
  const frameTime = delta; // seconds
  // Ignore the first ~N frames after resume: keep EMA stable and skip actions
  if (_resumeIgnoreFrames > 0){
    _resumeIgnoreFrames--;
    // keep EMA as-is; also keep debug updated
    if (window.__perfDebug){
      window.__perfDebug.resumeGuardMs = Math.max(0, _resumeGuardUntil - now);
      window.__perfDebug.ignoreFrames = _resumeIgnoreFrames;
    }
    return;
  }

  _emaFrameTime = _emaFrameTime + alpha * (frameTime - _emaFrameTime);
  const emaFPS = 1 / _emaFrameTime;
  _lastEmaFPS = emaFPS;

  if (emaFPS < PERF_FPS_DROP_THRESHOLD){
    _lowPerfAccum += delta * 1000; // ms
    _highPerfAccum = 0;
    if (_lowPerfAccum >= PERF_DEGRADE_MIN_DURATION){
      attemptDegrade(now);
      _lowPerfAccum = 0; // reset after change
    }
  } else if (emaFPS >= PERF_FPS_RAISE_THRESHOLD){
    _highPerfAccum += delta * 1000; // ms
    _lowPerfAccum = 0;
  if (_highPerfAccum >= PERF_UPGRADE_MIN_DURATION){
      attemptUpgrade(now);
      _highPerfAccum = 0;
    }
  } else {
    // In middle band – decay accumulators gently to require sustained trends
    _lowPerfAccum = Math.max(0, _lowPerfAccum - delta * 400);
    _highPerfAccum = Math.max(0, _highPerfAccum - delta * 400);
  }
  // Optional debug hook
  if (window.__perfDebug){
    window.__perfDebug.emaFPS = emaFPS.toFixed(1);
    window.__perfDebug.bucket = DPR_BUCKETS[_dprBucketIndex];
    window.__perfDebug.effectTier = EFFECT_QUALITY_LEVELS[_effectQualityLevel].name;
  window.__perfDebug.baseCapCurrent = __deviceProfile.baseCapCurrent;
  window.__perfDebug.resumeGuardMs = Math.max(0, _resumeGuardUntil - now);
  window.__perfDebug.ignoreFrames = _resumeIgnoreFrames;
  }
  // Update HUD
  _initPerfHUD();
  _updatePerfHUD(150);
}

// Performance HUD update tracking
let _perfHUDLastUpdate = 0;

function _initPerfHUD(){
  // Show performance HUD element
  const perfHud = document.querySelector('.performance-hud');
  if (perfHud) {
    // Defer showing until after startup so GSAP can animate it in
    if (!startupActive) {
      perfHud.classList.add('is-visible');
    }
  }
}

function _updatePerfHUD(throttleMs = 150){
  const now = performance.now();
  if ((now - _perfHUDLastUpdate) < throttleMs) return;
  _perfHUDLastUpdate = now;
  
  // Update FPS value
  const fpsFPS = document.getElementById('perf-fps');
  if (fpsFPS && _lastEmaFPS && isFinite(_lastEmaFPS)) {
    fpsFPS.textContent = _lastEmaFPS.toFixed(0);
  }
  
  // Update Tier value
  const perfTier = document.getElementById('perf-tier');
  if (perfTier && typeof _effectQualityLevel === 'number') {
    perfTier.textContent = EFFECT_QUALITY_LEVELS[_effectQualityLevel].name;
  }
}

function _logChange(kind, from, to, reason){
  // Console logging only for performance changes
  window.__perfDebug && console.log(`[Perf] ${kind}: ${from} → ${to} ${reason ? `(${reason})` : ''}`);
}

// Expose debug controls
window.__perfDebug = {
  get status(){ return { dpr: currentTargetPixelRatio(), bucket: DPR_BUCKETS[_dprBucketIndex], tier: EFFECT_QUALITY_LEVELS[_effectQualityLevel].name, baseCapCurrent: __deviceProfile.baseCapCurrent, baseCapMax: __deviceProfile.baseCapMax }; },
  forceBucket(i){ _dprBucketIndex = Math.min(Math.max(0,i), DPR_BUCKETS.length-1); _applyRendererPixelRatio(); },
  forceTier(i){ _effectQualityLevel = Math.min(Math.max(0,i), EFFECT_QUALITY_LEVELS.length-1); applyEffectQuality(); },
  setBaseCap(v){ __deviceProfile.baseCapCurrent = Math.min(Math.max(0.5, v), __deviceProfile.baseCapMax); _applyRendererPixelRatio(); },
  emaFPS: 60,
  bucket: 1.0,
  effectTier: 'Ultra'
};

function updateOrthoFrustum(cam, aspect) {
  // Base values
  let size = frustumSize;
  let heightOffset = frustumHeight;

  // Orientation check
  const vw = window.visualViewport ? Math.floor(window.visualViewport.width)  : window.innerWidth;
  const vh = window.visualViewport ? Math.floor(window.visualViewport.height) : window.innerHeight;
  const isPortrait = vh >= vw;

  // Device-responsive tweaks
  if (isPortrait) {
    // Breakpoints: Phones (portrait) if width < 450px, otherwise tablet
    const isPhonePortrait = vw < 450;
    if (isPhonePortrait) {
      // Phones (portrait): zoom out a bit more and nudge scene up
      size = frustumSize * 1.5; // Decrease multiplier to increase zoom
      heightOffset = frustumHeight - 6.5; // Subtract with higher number to move scene up
    } else {
      // Tablets (portrait): zoom out a bit, keep height offset as-is
      size = frustumSize * 1.4;
      heightOffset = frustumHeight;
    }
  }

  cam.left   = -size * aspect / 2;
  cam.right  =  size * aspect / 2;
  cam.top    =  size + heightOffset;
  cam.bottom =  heightOffset;
  cam.updateProjectionMatrix();

  // Update the bottom cover plane based on how much we shifted the scene up
  // Cover height equals the vertical offset applied (frustumHeight - heightOffset).
  // Keep it confined to the bottom area so it only slightly overlaps the model's bottom edge.
  const coverHeight = Math.max(0, frustumHeight - heightOffset);
  updateBottomCoverPlane(coverHeight);
}

function setCanvasCSSSize(canvas, w, h) {
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
}

function resizeRendererAndComposer(renderer, composer, w, h) {
  _lastCSSW = w; _lastCSSH = h;
  _applyRendererPixelRatio(); // centralizes pixel ratio + dependent sizes
  enforcePixelBudget();
}

let resizeRAF = 0;
function handleResize() {
  if (resizeRAF) return;
  resizeRAF = requestAnimationFrame(() => {
    resizeRAF = 0;

    const vw = window.visualViewport ? Math.floor(window.visualViewport.width)  : window.innerWidth;
    const vh = window.visualViewport ? Math.floor(window.visualViewport.height) : window.innerHeight;

    // On portrait phones, oversize canvas height by ~15% to cover small viewport height increases
    const isPortrait = vh >= vw;
    const isPhonePortrait = isPortrait && vw < 500;
    const cssH = isPhonePortrait ? Math.floor(vh * 1.15) : vh;

    if (theCanvas) setCanvasCSSSize(theCanvas, vw, cssH);

    const aspect = vw / cssH;
    updateOrthoFrustum(camera, aspect);

  resizeRendererAndComposer(renderer, composer, vw, cssH);
  if (_reedEffect) setReededResolution(_reedEffect, vw, cssH);
  if (_vignetteEffect) setBottomVignetteResolution(_vignetteEffect, Math.floor(vw * (resizeRendererAndComposer._epr || 1)), Math.floor(cssH * (resizeRendererAndComposer._epr || 1)));
  // Resize depth RT if present
  if (animate._depthRT) animate._depthRT.setSize(vw, cssH);
    // Fit gradient background to the frustum
    positionGradientBackgroundFromFrustum();
  });
}

if (IS_TOUCH_DEVICE) {
  // On touch devices: only handle orientation changes (avoid frequent viewport-height jitter resizes)
  window.addEventListener('orientationchange', handleResize, { passive: true });
} else {
  // On non-touch: respond to full resize and visualViewport changes
  window.addEventListener('resize', handleResize, { passive: true });
  window.addEventListener('orientationchange', handleResize, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleResize, { passive: true });
  }
}

// Handle scroll to gradually apply reeded glass effect
let currentSection = 0;
let currentScrollProgress = 0;
let baseExposure = 1.0; // Store the base exposure value
let scrollRefractionMultiplier = 3.0; // Configurable refraction multiplier
let headMovementRestriction = 0.16; // 10% of normal movement when scrolling
let baseEyeIntensity = 6.0; // Store the base eye emissive intensity
let baseSaturation = -0.25; // Store the base saturation value
let targetMusicVolume = 0.25; // Target music volume based on scroll section
let currentMusicVolume = 0.25; // Current smoothly-interpolated music volume
let targetVisualizerRange = 1.0; // Target visualizer range multiplier (1.0 = full range, 0.6 = 60% range)
let currentVisualizerRange = 1.0; // Current smoothly-interpolated visualizer range
let targetSpotlightIntensity = 1.0; // Spotlight intensity multiplier (1.0 = full, 0.4 = reduced)
let currentSpotlightIntensity = 1.0; // Current smoothly-interpolated spotlight intensity

// Update music volume based on current section
function updateMusicVolumeForSection(section) {
  // Sections 0-1 and section 6: normal volume (0.45), full visualizer range (1.0), and full spotlight intensity
  // Sections 2-5: reduced volume (0.12), reduced visualizer range (0.6), and reduced spotlight intensity to 40%
  if (section <= 1 || section === 5) { // section 5 is section 6 (0-indexed)
    targetMusicVolume = 0.45; // Normal volume
    targetVisualizerRange = 1.0;
    targetSpotlightIntensity = 1.0; // Full spotlight intensity
  } else {
    targetMusicVolume = 0.4 * 0.3; // 0.12 total
    targetVisualizerRange = 0.6; // 60% of normal range
    targetSpotlightIntensity = 0.4; // Reduce spotlight intensity to 40%
  }
}

// Smoothly interpolate and apply music volume
function applyMusicVolumeSmoothing() {
  if (!audioContext || !gainNode) return;
  
  // Effective target respects play/pause override
  const desired = Math.max(0, Math.min(1, (volumeOverride ?? targetMusicVolume)));
  const now = audioContext.currentTime;
  try {
    // Use exponential smoothing toward the target; calling each frame is fine.
    gainNode.gain.setTargetAtTime(desired, now, VOLUME_SMOOTH_TC);
  } catch {}
}

// Smoothly interpolate and apply visualizer range
function applyVisualizerRangeSmoothing() {
  // Smooth interpolation: lerp current toward target with a time constant
  const lerpFactor = 0.08; // Smooth transition over ~1 second
  currentVisualizerRange += (targetVisualizerRange - currentVisualizerRange) * lerpFactor;
}

// Smoothly interpolate and apply spotlight intensity
function applySpotlightIntensitySmoothing() {
  // Smooth interpolation: lerp current toward target with a time constant
  const lerpFactor = 0.08; // Smooth transition over ~1 second
  currentSpotlightIntensity += (targetSpotlightIntensity - currentSpotlightIntensity) * lerpFactor;
}

// Update saturation based on scroll progress
function updateSaturationForScroll(scrollProgress) {
  if (!hueSatEffect) return;
  
  // Reduce saturation further when scrolled (more desaturated)
  // Base saturation: -0.25, Target when scrolled: -0.8 (much more desaturated)
  const targetSaturation = baseSaturation - (scrollProgress * 0.0); // Reduces saturation by 0.30 when fully scrolled
  hueSatEffect.saturation = targetSaturation;
}

// Compute exposure as a smooth function across part 2 -> 3
// 0.0-0.5: keep baseExposure; 0.5-1.0: smoothly lerp to darker exposure
function computeExposureForScroll(scrollProgress) {
  // Keep exposure constant throughout scrolling
  return baseExposure;
}

// Determine glass effect configuration based on scroll progress
// Helper to get current scroll position from either smooth scroll or window.scrollY
function getCurrentScrollPosition() {
  return window.smoothScroll?.scrollCurrent ?? window.scrollY;
}

function getGlassModeForProgress(scrollProgress) {
  
  if (scrollProgress <= 1/3) {
    // First third: transitioning from page 1 to page 2
    // No glass effect yet
    return {
      splitScreen: false,
      boundary: 0.5,
      effectProgress: 0.0,
      rightSideProgress: 0.0
    };
  } else if (scrollProgress <= 2/3) {
    // Second third: transitioning from page 2 to page 3
    // Left side gets glass effect
    const localProgress = (scrollProgress - 1/3) * 3.0; // Normalize to 0-1 for this transition
    return {
      splitScreen: true,
      boundary: 0.5, // Split at 50% (left half gets effect)
      effectProgress: localProgress,
      rightSideProgress: 0.0 // Right side has no effect yet
    };
  } else {
    // Final third: transitioning from page 3 to page 4
    // Right side gradually gets glass effect while left side maintains full effect
    const localProgress = (scrollProgress - 2/3) * 3.0; // Normalize to 0-1 for this transition
    return {
      splitScreen: true, // Keep split-screen mode
      boundary: 0.5, // Keep boundary at 50%
      effectProgress: 1.0, // Left side maintains full effect
      rightSideProgress: localProgress // Right side gradually gets effect
    };
  }
}

// Initialize effects based on current scroll position (for page reloads)
function initializeScrollEffectsFromCurrentPosition() {
  const scrollY = getCurrentScrollPosition();
  const sectionHeight = window.innerHeight;
  const totalSections = 4; // Now we have 4 sections
  const scrollProgress = Math.min(scrollY / (sectionHeight * (totalSections - 1)), 1.0); // Normalize to 0-1 across all sections
  
  // Set the current scroll progress and section
  currentScrollProgress = scrollProgress;
  currentSection = Math.round(scrollY / sectionHeight);
  
  // Determine glass effect mode based on section
  const glassModeConfig = getGlassModeForProgress(scrollProgress);
  
  // Apply effects immediately without animation to match scroll position
  if (_reedEffect) {
    setReededScrollProgress(_reedEffect, glassModeConfig.effectProgress);
    setReededScrollRefractionMultiplier(_reedEffect, scrollRefractionMultiplier);
    setReededSplitScreenMode(_reedEffect, glassModeConfig.splitScreen, glassModeConfig.boundary, glassModeConfig.rightSideProgress);
  }
  
  // Update gradient colors for scroll position
  updateGradientColorsForScroll(scrollProgress);
  
  // Update saturation for scroll position
  updateSaturationForScroll(scrollProgress);
  
  // baseExposure should always remain at the original value
  baseExposure = 1.0;
  
  // Note: Initial exposure will be set correctly by the startup sequence based on currentScrollProgress
  
  // Exposure remains constant throughout scrolling
}

function updateReededGlassProgress(progress) {
  if (_reedEffect) {
    setReededScrollProgress(_reedEffect, progress);
    // Update refraction multiplier
    setReededScrollRefractionMultiplier(_reedEffect, scrollRefractionMultiplier);
  }
  // Note: Exposure is now handled directly in scroll handlers for better timing
}

function handleScroll() {
  const scrollY = getCurrentScrollPosition();
  
  // Get actual section elements and their positions
  const sections = document.querySelectorAll('.content-section');
  if (sections.length < 6) return;
  
  // Calculate actual section boundaries (we now have 6 sections)
  const section1End = sections[0].offsetTop + sections[0].offsetHeight;
  const section2End = sections[1].offsetTop + sections[1].offsetHeight;
  const section3Start = sections[2].offsetTop;
  const section3End = sections[2].offsetTop + sections[2].offsetHeight;
  const section4Start = sections[3].offsetTop;
  const section4End = sections[3].offsetTop + sections[3].offsetHeight;
  const section5Start = sections[4].offsetTop;
  const section5End = sections[4].offsetTop + sections[4].offsetHeight;
  const section6Start = sections[5].offsetTop;
  const section6End = sections[5].offsetTop + sections[5].offsetHeight;
  
  // Determine scroll progress based on actual section positions
  // We maintain the original 0-1 range for sections 1-4, then extend for sections 5-6
  let scrollProgress = 0;
  
  if (scrollY <= section1End) {
    // Section 1 -> 2 transition (0 to 1/3)
    scrollProgress = (scrollY / section1End) * (1/3);
  } else if (scrollY <= section2End) {
    // Section 2 -> 3 transition (1/3 to 2/3)
    const progressInSection2 = (scrollY - section1End) / (section2End - section1End);
    scrollProgress = (1/3) + (progressInSection2 * (1/3));
  } else if (scrollY <= section3End) {
    // Within section 3 - keep at 2/3 until near the end
    // Only start the transition to section 4 in the last 100vh of section 3
    const transitionZoneHeight = Math.min(window.innerHeight, section3End - section3Start);
    const transitionStart = section3End - transitionZoneHeight;
    
    if (scrollY < transitionStart) {
      // Still in section 3, before transition zone
      scrollProgress = 2/3;
    } else {
      // In transition zone - section 3 -> 4 (2/3 to 1)
      const progressInTransition = (scrollY - transitionStart) / transitionZoneHeight;
      scrollProgress = (2/3) + (progressInTransition * (1/3));
    }
  } else if (scrollY <= section4End) {
    // In section 4 - maintain progress at 1.0
    scrollProgress = 1.0;
  } else if (scrollY <= section5End) {
    // In section 5 - maintain progress at 1.0
    scrollProgress = 1.0;
  } else {
    // In section 6 - maintain progress at 1.0
    scrollProgress = 1.0;
  }
  
  scrollProgress = Math.min(scrollProgress, 1.0);
  
  // Update reeded glass smoothly based on scroll position
  currentScrollProgress = scrollProgress;
  
  // Get glass mode configuration for current progress
  const glassModeConfig = getGlassModeForProgress(scrollProgress);
  
  // Detect section 6 for special camera/model positioning
  // Trigger effects once section 6 comes into view (binary on/off)
  const inSection6 = scrollY >= (section5End - window.innerHeight * 0.4);
  
  // Reeded glass removal: Start fading out earlier and over a longer distance
  // Start removing glass 1.5 viewports before section 5 ends
  // Complete removal over 1.8 viewports (well before model starts moving)
  const glassRemovalStart = section5End - (window.innerHeight * 1.5);
  const glassRemovalDistance = window.innerHeight * 1.8;
  
  let glassRemovalProgress = 0;
  if (scrollY >= glassRemovalStart) {
    glassRemovalProgress = Math.min((scrollY - glassRemovalStart) / glassRemovalDistance, 1.0);
  }
  
  // Update reeded glass effects
  if (_reedEffect) {
    // Use scroll-based glass removal progress instead of binary trigger
    // Interpolate from current glass effect to 0 (section 1 level) based on scroll
    const effectiveProgress = glassModeConfig.effectProgress * (1 - glassRemovalProgress);
    setReededScrollProgress(_reedEffect, effectiveProgress);
    
    // Also fade out split screen mode gradually
    const effectiveSplitScreen = glassRemovalProgress < 1 ? glassModeConfig.splitScreen : false;
    const effectiveRightProgress = glassModeConfig.rightSideProgress * (1 - glassRemovalProgress);
    
    setReededScrollRefractionMultiplier(_reedEffect, scrollRefractionMultiplier);
    setReededSplitScreenMode(_reedEffect, effectiveSplitScreen, glassModeConfig.boundary, effectiveRightProgress);
  }
  
  // Update gradient background colors
  updateGradientColorsForScroll(scrollProgress);
  
  // Update saturation based on scroll position
  updateSaturationForScroll(scrollProgress);
  
  // Section 6: Move camera left and rotate model to face left
  updateSection6Effects(inSection6);
  
  // Update current section for reference
  if (scrollY < section1End) {
    currentSection = 0;
  } else if (scrollY < section2End) {
    currentSection = 1;
  } else if (scrollY < section3End) {
    currentSection = 2;
  } else if (scrollY < section4End) {
    currentSection = 3;
  } else if (scrollY < section5End) {
    currentSection = 4;
  } else {
    currentSection = 5;
  }
  
  // Update music volume based on scroll section
  updateMusicVolumeForSection(currentSection);
  
  // Update performance HUD opacity based on section (skip during startup to avoid clashing with GSAP intro)
  const hudElement = document.querySelector('.performance-hud');
  if (hudElement && !startupActive) {
    let opacity = 1.0;
    if (scrollProgress > 0 && scrollProgress <= 1/3) {
      // During transition from section 1 to 2
      const t = scrollProgress / (1/3);
      opacity = 1.0 - t * 0.5;
    } else if (currentSection > 0) {
      opacity = 0.5;
    }
    hudElement.style.opacity = opacity;
  }
}

// Section 6 camera and model animation
let section6SceneTarget = { x: 0.35 }; // Default scene position (base)
let section6ModelRotationTarget = 0;
let section6AnimationProgress = 0; // 0..1 blend that eases symmetrically

function updateSection6Effects(isActive) {
  // Endpoints: always interpolate between the same two values.
  // This keeps enter/exit speeds identical because the eased progress drives both directions.
  const baseSceneX = 0.35;
  const maxSceneDelta = 10.0;      // move right by 10 units at 100%
  const maxModelRotY  = -0.315;    // ~-18° at 100% (negative = rotate to the right)

  // Progress integrator (same constant both ways -> symmetric pace)
  const progressSpeed = 0.017;     // 3x slower than earlier
  const targetProgress = isActive ? 1 : 0;
  section6AnimationProgress += (targetProgress - section6AnimationProgress) * progressSpeed;

  // Ease-in-out cubic for a gentle start and finish (symmetric by definition)
  const p = section6AnimationProgress;
  const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

  // Targets derived purely from eased progress (no branch-dependent jump)
  const targetSceneX = baseSceneX + maxSceneDelta * eased;
  const targetModelRotY = maxModelRotY * eased;

  // Small smoothing toward targets to avoid micro-jitter; same both ways
  const sceneLerp = 0.1;
  scene.position.x = scene.position.x * (1 - sceneLerp) + targetSceneX * sceneLerp;

  if (GLTFHead) {
    const rotLerp = 0.1;
    GLTFHead.rotation.y = GLTFHead.rotation.y * (1 - rotLerp) + targetModelRotY * rotLerp;
  }
}

// Use default scroll behavior - no snapping
// Monitor custom smooth scroll position
function monitorScrollEffects() {
  handleScroll();
  requestAnimationFrame(monitorScrollEffects);
}
monitorScrollEffects();

// Configuration functions for scroll effects
window.setScrollRefractionMultiplier = function(multiplier) {
  scrollRefractionMultiplier = Math.max(1, multiplier || 3.0);
  if (_reedEffect) {
    setReededScrollRefractionMultiplier(_reedEffect, scrollRefractionMultiplier);
  }
  console.log(`Scroll refraction multiplier set to: ${scrollRefractionMultiplier}x`);
};

window.setHeadMovementRestriction = function(restriction) {
  headMovementRestriction = Math.max(0, Math.min(1, restriction || 0.1));
  console.log(`Head movement restriction set to: ${headMovementRestriction * 100}%`);
};

handleResize();

// add all render passes -------------------------------------------------

composer.addPass(renderScene);
composer.addPass(new EffectPass(camera, bloomEffect, hueSatEffect, brightnessContrastEffect, smaaEffect));

// Bottom vignette: init and add before reeded glass so glass overlay is not faded
{
  const created = createBottomVignettePass(camera);
  _vignetteEffect = created.effect;
  _vignettePass = created.pass;
  // Use framebuffer resolution (CSS px * effective pixel ratio) to match gl_FragCoord
  const epr = resizeRendererAndComposer._epr || computeEffectivePixelRatio();
  setBottomVignetteResolution(_vignetteEffect, Math.floor(window.innerWidth * epr), Math.floor(window.innerHeight * epr));
  composer.addPass(_vignettePass);
}

// Wire shader-only reeded refraction between grading and grain so grain overlays it
{
  const created = createReededPass(camera);
  _reedEffect = created.effect;
  _reedPass = created.pass;
  setReededResolution(_reedEffect, window.innerWidth, window.innerHeight);
  _reedPass.enabled = !!reededParams.enabled;
  composer.addPass(_reedPass);
}
composer.addPass(new EffectPass(camera, grainEffect));

// Create gradient background so it also refracts through the glass
createGradientBackground();
positionGradientBackgroundFromFrustum();

// Dark startup: hide red glow gradients until lights turn on
try {
  if (_bgGrad && _bgGrad.material && _bgGrad.material.uniforms) {
    const u = _bgGrad.material.uniforms;
    // Capture defaults from shader uniforms (in case they change in code)
    if (typeof u.uGlowIntensity?.value === 'number') {
      _bgGlow1Default = u.uGlowIntensity.value;
      _bgGlow1BaseIntensity = u.uGlowIntensity.value; // Set base intensity for music reactivity
    }
    if (typeof u.uGlow2Intensity?.value === 'number') {
      _bgGlow2Default = u.uGlow2Intensity.value;
      _bgGlow2BaseIntensity = u.uGlow2Intensity.value; // Set base intensity for music reactivity
    }
    if (u.uGlowIntensity) u.uGlowIntensity.value = 0.0;
    if (u.uGlow2Intensity) u.uGlow2Intensity.value = 0.0;
  }
} catch (e) { /* no-op */ }

// Apply initial DPR & quality (ensures correct sizing before first frame bursts heavy effects)
_applyRendererPixelRatio();
applyEffectQuality();

// Animation pause state for performance optimization
let isAnimationPaused = false;
let animationPauseTimeout = null;
let animationResumeTimeout = null;

function pauseAnimation() {
  if (!isAnimationPaused) {
    isAnimationPaused = true;
    // Trigger resume guard to prevent performance system from degrading quality
    // during the pause (prevents misinterpreting pause as performance drop)
    if (typeof _triggerResumeGuard === 'function') {
      _triggerResumeGuard();
    }
  }
}

function resumeAnimation() {
  if (isAnimationPaused) {
    isAnimationPaused = false;
    // Trigger resume guard to allow scene to stabilize after resuming
    // without the performance system making unnecessary changes
    if (typeof _triggerResumeGuard === 'function') {
      _triggerResumeGuard();
    }
    // Restart the animation loop
    requestAnimationFrame(animate);
  }
}

function animate() {
    // Skip rendering if paused for performance
    if (isAnimationPaused) {
      return;
    }
  
    const delta = clock.getDelta();
  // Adaptive performance update (hybrid DPR + effect tier)
  perfAdaptiveUpdate(delta);
    
    // Update wind animation with scroll-based speed reduction
    if (mixer) {
      // Gradually reduce wind speed from section 2 through section 3
      let windSpeedMultiplier = 1.0; // Default full speed

      if (currentScrollProgress > 1/3) { // Start slowing down at section 2
        // Map scroll progress from 1/3 to 2/3 (sections 2-3) to speed multiplier from 1.0 to 0.5
        const slowdownProgress = Math.min(1.0, (currentScrollProgress - 1/3) / (1/3)); // 0 to 1 over sections 2-3
        windSpeedMultiplier = 1.0 - (slowdownProgress * 0.5); // Gradually reduce from 1.0 to 0.5
      }

      const effectiveWindSpeed = WIND_BASE_TS * windSpeedMultiplier;

      mixer.timeScale = effectiveWindSpeed;
      mixer.update(delta);   // breathing and wind
    }
    
    // Update eye intensity with scroll-based reduction
    if (eyeMeshes.length > 0) {
      // Apply eye intensity reduction only in final section (scroll progress > 0.5)
      const finalSectionProgress = Math.max(0, (currentScrollProgress - 0.5) * 2.0); // 0-1 in final section only
      const eyeIntensityMultiplier = 1.0 - (finalSectionProgress * 0.3); // Reduce to 70% when fully scrolled
      const effectiveEyeIntensity = baseEyeIntensity * eyeIntensityMultiplier;
      
      eyeMeshes.forEach(m => {
          if (m.material && m.material.emissiveIntensity !== undefined) {
            m.material.emissiveIntensity = effectiveEyeIntensity;
          }
        });
    }

  // Advance reeded time and render
  if (_reedEffect) tickReededTime(_reedEffect, delta);

  // Update music-reactive lighting (only if audio system initialized)
  if (typeof isAudioPlaying !== 'undefined' && isAudioPlaying && analyser && dataArray) {
    updateReactiveLighting();
  }

  // Apply smooth music volume transitions based on scroll section
  applyMusicVolumeSmoothing();

  // Apply smooth visualizer range transitions based on scroll section
  applyVisualizerRangeSmoothing();

  // Apply smooth spotlight intensity transitions based on scroll section
  applySpotlightIntensitySmoothing();

  // --- Depth pass for reeded effect ---
  // Create depth RT lazily (once)
  if (!animate._depthRT) {
    const size = renderer.getSize(new THREE.Vector2());
    animate._depthRT = new THREE.WebGLRenderTarget(size.x, size.y, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false
    });
    animate._depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    animate._depthOverrideOld = null;
  }
  // Keep depth RT in sync with size
  {
    const size = renderer.getSize(new THREE.Vector2());
    if (animate._depthRT.width !== size.x || animate._depthRT.height !== size.y) {
      animate._depthRT.setSize(size.x, size.y);
    }
  }

  // Render scene to depth RT using override material
  const oldTarget = renderer.getRenderTarget();
  const oldAutoClear = renderer.autoClear;
  renderer.autoClear = true;
  animate._depthOverrideOld = scene.overrideMaterial;
  scene.overrideMaterial = animate._depthMat;
  renderer.setRenderTarget(animate._depthRT);
  renderer.clear();
  renderer.render(scene, camera);
  scene.overrideMaterial = animate._depthOverrideOld;
  renderer.setRenderTarget(oldTarget);
  renderer.autoClear = oldAutoClear;

  // Feed depth texture to reeded shader
  if (_reedEffect) {
    setReededDepth(_reedEffect, animate._depthRT.texture, camera.near, camera.far);
  }

  // Post stack
  composer.render();

  // Glow blobs removed

    currentTime += 1/60;

    requestAnimationFrame(animate)
}

animate();

// Delay helper retained for a couple of non-visual holds
function delay(ms){ return new Promise(res=>setTimeout(res, ms)); }

async function startStartupSequence(){
  const tl = gsap.timeline();
  // Build blinds overlay for a curtain-style reveal (skipped for reduced motion)
  let blindsWrap = null;
  let blindsStripes = null;
  if (!PREFERS_REDUCED_MOTION) {
    // blindsWrap = createBlindsOverlay();
    // blindsStripes = blindsWrap.querySelectorAll('.blinds-overlay__stripe');
    // Stripes start fully covering the screen (full width)
    // gsap.set(blindsStripes, { scaleX: 1 });
  }

  // Set initial lower values for reeded glass parameters at startup
  if (_reedEffect) {
    const U = _reedEffect.uniforms;
    // Set lower initial values for z depth, refraction, and gradient stops
    U.get('depthD0').value = 204.5; // Higher than normal 198.5
    U.get('depthD1').value = 208.5; // Higher than normal 201.5
    U.get('uRefractPx').value = 6.0; // Lower than normal 12.0
    U.get('gradientBlackStop1').value = 0.02; // Lower than normal 0.04
    U.get('gradientBlackStop2').value = 0.275; // Lower than normal 0.55
    U.get('gradientWhiteStop1').value = 0.14; // Lower than normal 0.28
    U.get('gradientWhiteStop2').value = 0.425; // Lower than normal 0.85
  }

  // Hide navigation elements initially for startup reveal
  const bottomBar = document.querySelector('.bottom-bar');
  const sideNav = document.querySelector('.side-nav'); // Parent container for side dots
  const sideNavDots = document.querySelectorAll('.side-nav__dot');
  const navbarLinks = document.querySelectorAll('.navbar__link');
  const navbarLogoHero = document.querySelector('.navbar__logo-hero'); // Hero logo for section 1
  const bottomBarLeft = document.querySelector('.bottom-bar__left');
  const bottomBarRight = document.querySelector('.bottom-bar__right');
  const perfHudEl = document.querySelector('.performance-hud');
  
  // Note: CSS already hides these with opacity: 0 and visibility: hidden
  // We just need to set GSAP initial states for the transforms
  gsap.set(navbarLinks, { opacity: 0, y: 8 });
  // Disable CSS transition on hero logo to prevent clash with GSAP animation
  if (navbarLogoHero) navbarLogoHero.style.transition = 'none';
  gsap.set(navbarLogoHero, { opacity: 0 }); // Only hide hero logo opacity (no scale transform)
  gsap.set(bottomBarLeft, { opacity: 0, x: -12 });
  gsap.set(bottomBarRight, { opacity: 0, x: 12 });
  // Prepare performance HUD for a subtle top-down fade-in
  if (perfHudEl) {
    gsap.set(perfHudEl, { opacity: 0, x: -8, visibility: 'hidden' });
    perfHudEl.style.transition = 'none'; // Disable CSS transition during GSAP animation
  }

  // Phase 1: Simple smooth fade reveal
  // Fade out loading overlay completely (including logo) while canvas and background fade in
  // Total duration of 0.8s for smooth, continuous transition
  tl.to(blackoutEl, { opacity: 0, duration: 0.8, ease: 'power2.inOut' }, 0);
  // Canvas fades in from transparent to opaque during same period
  tl.to(theCanvas, { opacity: 1, duration: 0.8, ease: 'power2.inOut' }, 0);
  // Background element fades to 10% opacity during same period
  tl.to(bgEl, { opacity: 0.1, duration: 0.8, ease: 'power2.inOut' }, 0);
  // Remove DOM element after fade completes
  tl.call(() => { try { blackoutEl?.remove(); blackoutEl = null; } catch {} }, null, 0.8);

  // Phase 2 setup at ~0.62s
  tl.call(() => {
    renderer.toneMappingExposure = 0.5; // 50% reduced exposure (darker scene)
    if (hueSatEffect) hueSatEffect.saturation = -0.75; // 75% saturation (more desaturated)
    eyeMeshes.forEach(m=>{ if (m.material){ m.material.emissiveIntensity = 0.5; m.material.color.set(0x000000); }});
  }, null, 0.62);

  // Phase 3: eyes on after 1s
  tl.add('eyesOn', 1.62);
  
  // Restore exposure and saturation when lights turn on
  tl.to(renderer, { toneMappingExposure: 1.0, duration: 0.4, ease: 'power1.out' }, 'eyesOn');
  if (hueSatEffect) {
    tl.to(hueSatEffect, { saturation: -0.25, duration: 0.4, ease: 'power1.out' }, 'eyesOn');
  }
  // Bring in background red glows smoothly at the same moment
  tl.call(() => {
    try {
      if (_bgGrad && _bgGrad.material && _bgGrad.material.uniforms) {
        const u = _bgGrad.material.uniforms;
        // Animate via gsap on uniforms' value for smooth transition
        if (u.uGlowIntensity) gsap.to(u.uGlowIntensity, { value: _bgGlow1Default, duration: 0.6, ease: 'power1.out' });
        if (u.uGlow2Intensity) gsap.to(u.uGlow2Intensity, { value: _bgGlow2Default, duration: 0.6, ease: 'power1.out' });
      }
    } catch (e) { /* ignore */ }
  }, null, 'eyesOn');
  // Fade in the background element to its normal opacity in sync with lights-on
  if (bgEl) tl.to(bgEl, { opacity: 0.75, duration: 0.6, ease: 'power1.out' }, 'eyesOn');
  
  eyeMeshes.forEach(m=>{
    // Adjust target eye intensity based on scroll position
    const baseTargetEI = 6; 
    const scrollAdjustedEI = baseTargetEI * (1.0 - (currentScrollProgress * 0.5)); // Apply scroll reduction if needed
    const targetEI = scrollAdjustedEI;
    
    const orig = (m.userData.eyeOriginalColor && m.userData.eyeOriginalColor.isColor) ? m.userData.eyeOriginalColor : new THREE.Color('#2C2C2C');
    tl.to(m.material, { emissiveIntensity: targetEI, duration: 0.12, ease: 'power1.out' }, 'eyesOn');
    tl.to(m.material.color, { r: orig.r, g: orig.g, b: orig.b, duration: 0.12, ease: 'none' }, 'eyesOn');
  });

  // Match lights intensity ramp to eyes-on: 10% -> 100% over the same window
  allLights.forEach(l => {
    const finalI = lightFinalIntensities.get(l) ?? l.intensity;
    tl.to(l, { intensity: finalI, duration: 0.4, ease: 'power1.out' }, 'eyesOn');
  });

  // Reveal navigation elements with classy staggered animations at end of Phase 3
  tl.add('navReveal', 'eyesOn+=1.0'); // Start 1s after lights turn on
  
  // Bottom bar container fades in first
  tl.to(bottomBar, { 
    opacity: 1, 
    visibility: 'visible',
    duration: 1.2, // in seconds
    ease: 'power2.out' 
  }, 'navReveal');
  // Performance HUD fades in in parallel with bottom bar
  if (perfHudEl) {
    tl.to(perfHudEl, {
      opacity: 1,
      y: 0,
      duration: 1.8,
      ease: 'power2.out',
      delay: 0.6,
      onStart: () => { try { perfHudEl.style.visibility = 'visible'; } catch (e) {} },
      onComplete: () => { 
        try { 
          perfHudEl.classList.add('is-visible');
          perfHudEl.style.transition = ''; // Re-enable CSS transition after startup
        } catch (e) {} 
      }
    }, 'navReveal');
  }
  
  // Navbar links fade up with stagger (left to right)
  tl.to(navbarLinks, { 
    opacity: 1, 
    y: 0,
    duration: 1.2,
    ease: 'power2.out',
    stagger: 0.12 // 3x of 40ms
  }, 'navReveal+=0.24'); // 3x of 80ms
  
  // Hero logo fades in smoothly (only for section 1)
  tl.to(navbarLogoHero, { 
    opacity: 1,
    visibility: 'visible', // Make visible when animating in
    duration: 3.2,
    ease: 'power2.out',
    onComplete: () => {
      // Re-enable CSS transition after GSAP animation completes
      // This allows the scroll-based hiding/showing to work smoothly
      if (navbarLogoHero) navbarLogoHero.style.transition = '';
      // Clear inline opacity to let CSS take control
      gsap.set(navbarLogoHero, { clearProps: 'opacity' });
    }
  }, 'navReveal+=0.36'); // 3x of 120ms
  
  // Bottom bar left section slides in from left
  tl.to(bottomBarLeft, { 
    opacity: 1, 
    x: 0,
    duration: 1.2,
    ease: 'power2.out'
  }, 'navReveal+=0.18'); // 3x of 60ms
  
  // Bottom bar right section slides in from right
  tl.to(bottomBarRight, { 
    opacity: 1, 
    x: 0,
    duration: 1.2,
    ease: 'power2.out'
  }, 'navReveal+=0.18'); // 3x of 60ms
  
  // Side nav container becomes visible first (set both opacity and visibility)
  tl.to(sideNav, { 
    opacity: 1,
    visibility: 'visible',
    duration: 1.5,
  }, 'navReveal+=0.45'); // 3x of 150ms
  
  // Side nav dots fade in with stagger (top to bottom)
  tl.to(sideNavDots, { 
    opacity: 1,
    visibility: 'visible',
    duration: 2.4,
    ease: 'power2.out',
    stagger: 0.15 // 3x of 50ms
  }, 'navReveal+=0.45'); // 3x of 150ms

  // Phase 4: exposure/background 800ms after eyes
  tl.add('phase4', 'eyesOn+=0.8');
  // Keep exposure constant throughout scrolling
  const startupTargetExposure = baseExposure;
  tl.to(renderer, { toneMappingExposure: startupTargetExposure, duration: 1.6, ease: 'power1.inOut' }, 'phase4');
  // Background glows and opacity are already handled at 'eyesOn'

  // Animate reeded glass parameters back to normal values in phase 4
  if (_reedEffect) {
    const U = _reedEffect.uniforms;
    tl.to(U.get('depthD0'), { value: 198.5, duration: 1.6, ease: 'power1.inOut' }, 'phase4');
    tl.to(U.get('depthD1'), { value: 201.5, duration: 1.6, ease: 'power1.inOut' }, 'phase4');
    tl.to(U.get('uRefractPx'), { value: 12.0, duration: 1.6, ease: 'power1.inOut' }, 'phase4');
    tl.to(U.get('gradientBlackStop1'), { value: 0.04, duration: 1.6, ease: 'power1.inOut' }, 'phase4');
    tl.to(U.get('gradientBlackStop2'), { value: 0.55, duration: 1.6, ease: 'power1.inOut' }, 'phase4');
    tl.to(U.get('gradientWhiteStop1'), { value: 0.28, duration: 1.6, ease: 'power1.inOut' }, 'phase4');
    tl.to(U.get('gradientWhiteStop2'), { value: 0.85, duration: 1.6, ease: 'power1.inOut' }, 'phase4');
  }

  // Phase 5: chin settle 100ms after Phase 4 starts
  if (chin) {
  // Sync camera zoom-out with chin settling to rest
  tl.to(chin.rotation, { x: Math.PI/2, duration: 1.2, ease: 'power1.inOut' }, 'phase4+=0.1');
  tl.to(camera, { zoom: 1.0, duration: 1.5, ease: 'power3.inOut', onUpdate: ()=> camera.updateProjectionMatrix() }, 'phase4+=0.1');
  
  // Enable head look immediately when chin finishes settling to rest pose
  tl.call(() => {
    if (!IS_TOUCH_DEVICE) {
      allowHeadLook = true;
      if (chin) startHeadLook(chin);
    }
  }, null, 'phase4+=1.2'); // When chin animation completes
  }

  // Mark startup complete when timeline ends
  await new Promise(res => tl.eventCallback('onComplete', () => res()));
  startupActive = false;
  
  // Stop logo animation loop now that startup is complete
  markLoadingComplete();
  if (window.stopLogoLooping) {
    window.stopLogoLooping();
  }

  // Apply scroll-based wind speed if we're in the final section
  if (mixer && currentScrollProgress > 0.5) {
    const finalSectionProgress = (currentScrollProgress - 0.5) * 2.0; // 0-1 in final section only
    const windSpeedMultiplier = 1.0 - (finalSectionProgress * 0.5);
    mixer.timeScale = WIND_BASE_TS * windSpeedMultiplier;
  }

  // Start breathing animation and touch device head look after startup
  if (IS_TOUCH_DEVICE) {
    allowHeadLook = false;
    // Keep head centered and run only breathing updates on touch devices
    startBreathingOnly();
  }
  _shoulderStartMs = Date.now();
  _chinBreathActive = false;
  _chinGain = 0;
  _chinStartMs = null;
  allowBreathing = true;
}

// Add Intersection Observer for curtains block (bottom-bar) to adjust exposure
let curtainsBlock = document.querySelector('.bottom-bar');
if (curtainsBlock) {
  let observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      let targetExposure = entry.isIntersecting ? baseExposure * 0.5 : baseExposure;
      gsap.to(renderer, { toneMappingExposure: targetExposure, duration: 1.2, ease: 'power2.out' });
    });
  }, { threshold: 0.5 });
  observer.observe(curtainsBlock);
}

// Expose pause/resume functions and timeout variables for performance optimization
window.pauseAnimation = pauseAnimation;
window.resumeAnimation = resumeAnimation;
window.animationPauseTimeout = null;
window.animationResumeTimeout = null;

// Music Visualizer setup with smooth fade in/out (globals declared above)
bgAudio = null;
isAudioPlaying = false;
audioContext = null;
analyser = null;
gainNode = null;
dataArray = null;
visualizerCanvas = null;
visualizerCtx = null;
animationId = null;
let audioLoaded = false; // Track if audio file has been loaded
let audioLoading = false; // Track if audio is currently loading
let prePlayAnimationActive = true; // Start with pre-play animation
let prePlayAnimationTime = 0; // Time for smooth wave animation
let prePlayAnimationId = null; // Animation frame ID for pre-play animation
let volumeOverride = null; // When set (0..1), overrides scroll-based target during fades
// barHeights declared above

// Visualizer configuration (can be adjusted at runtime via window.updateVisualizerConfig())
const visualizerConfig = {
  numBars: 24,           // Number of frequency bars
  barWidth: 0.4,         // Bar width as fraction of available space (0-1)
  minBarHeightPx: 5,     // Minimum bar height in pixels
};
const AUDIO_FADE_MS = 1200; // Smooth fade duration for play/pause
const VOLUME_SMOOTH_TC = AUDIO_FADE_MS / 1000 / 3; // ~3 time constants ~= fade duration

function initMusicVisualizer() {
  visualizerCanvas = document.getElementById('music-visualizer');
  if (!visualizerCanvas) return;

  visualizerCtx = visualizerCanvas.getContext('2d');
  visualizerCanvas.style.cursor = 'pointer';

  // Initialize bar heights to a static diamond shape
  barHeights = [];
  for (let i = 0; i < visualizerConfig.numBars; i++) {
    const center = Math.floor(visualizerConfig.numBars / 2);
    const dist = Math.abs(i - center);
    const shape = 1 - (dist / center); // taper at edges
    barHeights[i] = Math.max(0.1, shape * 0.6);
  }

  // Setup audio element (lazy-load: only preload metadata, not full file)
  bgAudio = new Audio(bgAudioUrl);
  bgAudio.loop = true;
  bgAudio.preload = 'metadata'; // Only load metadata for fast startup, full audio loads on first play
  bgAudio.crossOrigin = 'anonymous';

  // Track when audio can start playing (buffer progress)
  bgAudio.addEventListener('canplay', () => { audioLoaded = true; }, { once: true });
  bgAudio.addEventListener('progress', trackAudioDownloadProgress);

  // Click handler for play/pause
  visualizerCanvas.addEventListener('click', toggleAudioVisualizer);

  // Start pre-play animation (will be stopped when user plays music)
  prePlayAnimationActive = true;
  animatePrePlayVisualizer();
  // Set initial opacity based on play state
  updateVisualizerOpacity();
}

// Track audio download progress for UX feedback on slow connections
function trackAudioDownloadProgress() {
  if (!bgAudio) return;
  const buffered = bgAudio.buffered;
  if (buffered.length > 0) {
    const downloadProgress = buffered.end(buffered.length - 1) / bgAudio.duration;
    if (window.__audioDebug) {
      window.__audioDebug.downloadProgress = Math.round(downloadProgress * 100);
    }
  }
}

function setupAudioContext() {
  if (audioContext) return;
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    // Use configurable FFT size for better beat sensitivity/resolution
    analyser.fftSize = musicReactiveConfig.fftSize || 256;

    gainNode = audioContext.createGain();
    gainNode.gain.value = 0.0; // start muted; we'll fade in on play

    const source = audioContext.createMediaElementSource(bgAudio);
    // source -> gain -> analyser -> destination
    source.connect(gainNode);
    gainNode.connect(analyser);
    analyser.connect(audioContext.destination);

    dataArray = new Uint8Array(analyser.frequencyBinCount);
  } catch (e) {
    console.warn('Web Audio API not supported:', e);
  }
}

function updateVisualizerOpacity() {
  if (!visualizerCanvas) return;
  visualizerCanvas.style.opacity = isAudioPlaying ? '1' : '0.8';
}

function toggleAudioVisualizer() {
  if (!bgAudio) return;

  if (isAudioPlaying) {
    // Freeze bars immediately and fade audio out
    isAudioPlaying = false;
    updateVisualizerOpacity();
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    smoothPause();
  } else {
    if (!audioContext) setupAudioContext();
    
    // If audio not yet loaded, initiate lazy load on first click
    if (!audioLoaded && !audioLoading) {
      audioLoading = true;
      console.log('Audio not yet loaded, buffering...');
      // Start buffering and play when ready
      bgAudio.addEventListener('canplay', playAudioWhenReady, { once: true });
      bgAudio.load(); // Explicitly trigger download
    } else if (audioLoaded) {
      // Audio is ready, play immediately
      playAudioImmediately();
    } else {
      // Audio is currently loading, wait for it
      console.log('Audio buffering in progress, waiting...');
      bgAudio.addEventListener('canplay', playAudioWhenReady, { once: true });
    }
  }
}

function playAudioWhenReady() {
  audioLoaded = true;
  audioLoading = false;
  console.log('Audio ready, starting playback');
  playAudioImmediately();
}

function playAudioImmediately() {
  // Stop pre-play animation
  prePlayAnimationActive = false;
  if (prePlayAnimationId) {
    cancelAnimationFrame(prePlayAnimationId);
    prePlayAnimationId = null;
  }
  
  smoothPlay()
    .then(() => {
      isAudioPlaying = true;
      updateVisualizerOpacity();
      visualizeAudio();
    })
    .catch(e => console.warn('Background audio failed to play:', e));
}

async function smoothPlay() {
  if (!audioContext) setupAudioContext();
  try { await audioContext.resume(); } catch {}
  await bgAudio.play();
  const now = audioContext.currentTime;
  try {
    // Clear pause override and begin smoothing toward scroll-based target
    volumeOverride = null;
    // Kick smoothing immediately so users feel the fade start
    const desired = Math.max(0, Math.min(1, (volumeOverride ?? targetMusicVolume)));
    gainNode.gain.setTargetAtTime(desired, now, VOLUME_SMOOTH_TC);
  } catch {}
}

function smoothPause() {
  if (!audioContext || !gainNode) { try { bgAudio.pause(); } catch {} return; }
  const now = audioContext.currentTime;
  try {
    // Force target to 0 and let smoothing handle fade-out
    volumeOverride = 0.0;
    gainNode.gain.setTargetAtTime(0.0, now, VOLUME_SMOOTH_TC);
  } catch {}
  // Pause after fade completes
  setTimeout(() => { 
    try { 
      bgAudio.pause();
      // Reset gainNode to 0 to ensure clean state
      gainNode.gain.setValueAtTime(0.0, audioContext.currentTime);
    } catch {} 
  }, AUDIO_FADE_MS + 30);
}

// Initialize pseudo-random bar patterns for paused visualizer
let prePlayBarSeeds = [];
let prePlayBarHeights = []; // Smooth previous heights for continuity
let prePlayAnimationStartTime = 0; // Track when the burst animation started
const PRE_PLAY_BURST_DURATION = 3000; // 3 seconds of animation
const PRE_PLAY_BURST_CYCLE = 10000; // 10 second total cycle (2 sec on, 8 sec off)
function initializePrePlayBarSeeds() {
  prePlayBarSeeds = [];
  prePlayBarHeights = [];
  for (let i = 0; i < visualizerConfig.numBars; i++) {
    // Generate pseudo-random seed per bar for deterministic but varied animation
    prePlayBarSeeds[i] = Math.sin(i * 12.9898) * 43758.5453; // Common hash function
    prePlayBarSeeds[i] = prePlayBarSeeds[i] - Math.floor(prePlayBarSeeds[i]);
    prePlayBarHeights[i] = 0.45; // Initialize with base height
  }
}

// Pre-play animation: complex organic pattern with multiple wave frequencies
function animatePrePlayVisualizer() {
  if (!prePlayAnimationActive || !visualizerCanvas || !visualizerCtx) return;
  
  prePlayAnimationId = requestAnimationFrame(animatePrePlayVisualizer);
  
  // Calculate position in the 6-second cycle
  const now = performance.now();
  if (prePlayAnimationStartTime === 0) {
    prePlayAnimationStartTime = now;
  }
  const timeInCycle = (now - prePlayAnimationStartTime) % PRE_PLAY_BURST_CYCLE;
  const isInBurstPhase = timeInCycle < PRE_PLAY_BURST_DURATION;
  
  // Only animate during burst phase; render static otherwise
  if (isInBurstPhase) {
    // Progressive time during burst (0 to 1 over 2 seconds)
    const burstProgress = timeInCycle / PRE_PLAY_BURST_DURATION;
    prePlayAnimationTime += 0.025; // Continue time progression during burst
    
    // Initialize seeds once
    if (prePlayBarSeeds.length === 0) {
      initializePrePlayBarSeeds();
    }
    
    const width = visualizerCanvas.width;
    const height = visualizerCanvas.height;
    
    // Calculate bar width and gap based on config
    const barWidth = width * visualizerConfig.barWidth / visualizerConfig.numBars;
    const totalGapWidth = width - (barWidth * visualizerConfig.numBars);
    const gap = totalGapWidth / visualizerConfig.numBars;
    
    visualizerCtx.clearRect(0, 0, width, height);
    
    for (let i = 0; i < visualizerConfig.numBars; i++) {
      const centerIndex = Math.floor(visualizerConfig.numBars / 2);
      const distanceFromCenter = Math.abs(i - centerIndex);
      const shapeFactor = 1 - (distanceFromCenter / centerIndex) * 0.6; // taper edges
      
      // Per-bar seed for organic variation
      const seed = prePlayBarSeeds[i];
      
      // Combine multiple wave frequencies at different speeds for organic feel
      // Fundamental wave (slow, main rhythm)
      const fundamentalFreq = 0.8;
      const fundamental = (Math.sin(prePlayAnimationTime * fundamentalFreq + seed * 6.28) + 1) / 2;
      
      // Second harmonic (faster, adds complexity)
      const harmonic2Freq = 1.9;
      const harmonic2 = (Math.sin(prePlayAnimationTime * harmonic2Freq + seed * 3.14) + 1) / 2;
      
      // Third harmonic (even faster, adds detail)
      const harmonic3Freq = 3.2;
      const harmonic3 = (Math.sin(prePlayAnimationTime * harmonic3Freq - seed * 2.0) + 1) / 2;
      
      // Slow wandering drift (very long period, creates unpredictable motion)
      const driftFreq = 0.15;
      const drift = (Math.sin(prePlayAnimationTime * driftFreq + seed * 10.0) + 1) / 2;
      
      // Combine all waves with weighted mix:
      // Fundamental drives the motion, harmonics add texture, drift adds subtle randomness
      const waveValue = (
        fundamental * 0.55 +      // Main driver
        harmonic2 * 0.25 +         // Secondary variation
        harmonic3 * 0.12 +         // Fine detail
        drift * 0.08               // Slow, unpredictable drift
      );
      
      // Add smooth per-bar variation (continuous, no abrupt changes)
      // Use multiple smooth sine waves at different frequencies for organic feel
      const variation1 = Math.sin(prePlayAnimationTime * 0.3 + seed * 7.77) * 0.04;
      const variation2 = Math.sin(prePlayAnimationTime * 0.7 - seed * 5.23) * 0.03;
      const variation3 = Math.sin(prePlayAnimationTime * 1.1 + seed * 3.14) * 0.02;
      const smoothJitter = variation1 + variation2 + variation3;
      
      // Modulate height with all combined effects
      const baseHeight = 0.45;
      const heightWithVariation = baseHeight + (waveValue - 0.5) * 0.45 + smoothJitter;
      const targetHeight = Math.max(0.15, heightWithVariation) * shapeFactor; // Clamp to 15% minimum
      
      // Apply exponential smoothing for ultra-smooth animation (prevents any tiny discontinuities)
      // Use consistent lerp factor for smooth transitions between phases
      prePlayBarHeights[i] += (targetHeight - prePlayBarHeights[i]) * 0.50; // Smooth lerp factor
      const animatedHeight = prePlayBarHeights[i];
      
      const x = i * (barWidth + gap) + gap / 2;
      let barHeightNorm = animatedHeight * height * currentVisualizerRange;
      // Ensure minimum bar height of 5px
      const barHeight = Math.max(visualizerConfig.minBarHeightPx, barHeightNorm);
      const y = (height - barHeight) / 2;
      visualizerCtx.fillStyle = '#E8EFFF';
      visualizerCtx.fillRect(x, y, barWidth, barHeight);
    }
  } else {
    // Render static visualization during off phase
    renderStaticVisualizer();
  }
}

function renderStaticVisualizer() {
  if (!visualizerCtx) return;
  const width = visualizerCanvas.width;
  const height = visualizerCanvas.height;
  
  // Calculate bar width and gap based on config
  const barWidth = width * visualizerConfig.barWidth / visualizerConfig.numBars;
  const totalGapWidth = width - (barWidth * visualizerConfig.numBars);
  const gap = totalGapWidth / visualizerConfig.numBars;
  
  visualizerCtx.clearRect(0, 0, width, height);
  
  // Initialize seeds once if needed
  if (prePlayBarSeeds.length === 0) {
    initializePrePlayBarSeeds();
  }
  
  for (let i = 0; i < visualizerConfig.numBars; i++) {
    const centerIndex = Math.floor(visualizerConfig.numBars / 2);
    const distanceFromCenter = Math.abs(i - centerIndex);
    const shapeFactor = 1 - (distanceFromCenter / centerIndex) * 0.6; // taper edges
    
    // Per-bar seed for organic variation
    const seed = prePlayBarSeeds[i];
    
    // Very subtle slow animation even in static phase for randomization
    // Use very low frequency waves to create gentle variation
    const slowWave1 = (Math.sin(prePlayAnimationTime * 0.15 + seed * 6.28) + 1) / 2;
    const slowWave2 = (Math.sin(prePlayAnimationTime * 0.08 - seed * 3.14) + 1) / 2;
    
    // Subtle jitter to break symmetry
    const jitter = (Math.sin(prePlayAnimationTime * 0.2 + seed * 9.99) + 1) / 2;
    
    // Combine for static base height with slight variation
    const baseHeight = 0.45;
    const variation = (slowWave1 * 0.15 + slowWave2 * 0.1 + jitter * 0.05) * shapeFactor;
    const targetHeight = Math.max(0.15, baseHeight + (variation - 0.15) * 0.3) * shapeFactor;
    
    // Apply smooth lerp to prePlayBarHeights to ensure smooth transition
    prePlayBarHeights[i] += (targetHeight - prePlayBarHeights[i]) * 0.28; // Slower lerp for smooth transition
    const animatedHeight = prePlayBarHeights[i];
    
    const x = i * (barWidth + gap) + gap / 2;
    let barHeightNorm = animatedHeight * height * currentVisualizerRange;
    // Ensure minimum bar height of 5px
    const barHeight = Math.max(visualizerConfig.minBarHeightPx, barHeightNorm);
    const y = (height - barHeight) / 2;
    visualizerCtx.fillStyle = '#E8EFFF';
    visualizerCtx.fillRect(x, y, barWidth, barHeight);
  }
}

function visualizeAudio() {
  if (!isAudioPlaying || !analyser) return;

  animationId = requestAnimationFrame(visualizeAudio);
  analyser.getByteFrequencyData(dataArray);

  const width = visualizerCanvas.width;
  const height = visualizerCanvas.height;
  
  // Calculate bar width and gap based on config
  const barWidth = width * visualizerConfig.barWidth / visualizerConfig.numBars;
  const totalGapWidth = width - (barWidth * visualizerConfig.numBars);
  const gap = totalGapWidth / visualizerConfig.numBars;

  visualizerCtx.clearRect(0, 0, width, height);

  for (let i = 0; i < visualizerConfig.numBars; i++) {
    const centerIndex = Math.floor(visualizerConfig.numBars / 2);
    const distanceFromCenter = Math.abs(i - centerIndex);
    const shapeFactor = 1 - (distanceFromCenter / centerIndex) * 0.6; // taper edges

    const dataIndex = Math.min(i + 2, dataArray.length - 1);
    const targetHeight = (dataArray[dataIndex] / 255) * shapeFactor;

    // Smooth animation: interpolate between current and target
    barHeights[i] += (targetHeight - barHeights[i]) * 0.25;

    const x = i * (barWidth + gap) + gap / 2;
    let barHeightNorm = barHeights[i] * height * currentVisualizerRange;
    // Ensure minimum bar height of 5px
    const barHeight = Math.max(visualizerConfig.minBarHeightPx, barHeightNorm);
    const y = (height - barHeight) / 2;
    visualizerCtx.fillStyle = '#E8EFFF';
    visualizerCtx.fillRect(x, y, barWidth, barHeight);
  }
}

// Expose configuration updater for console tweaks
window.updateVisualizerConfig = function(config) {
  Object.assign(visualizerConfig, config);
  // Reinitialize bar heights array if numBars changed
  if (config.numBars) {
    barHeights = [];
    prePlayBarHeights = [];
    for (let i = 0; i < visualizerConfig.numBars; i++) {
      const center = Math.floor(visualizerConfig.numBars / 2);
      const dist = Math.abs(i - center);
      const shape = 1 - (dist / center);
      barHeights[i] = Math.max(0.1, shape * 0.6);
      prePlayBarHeights[i] = 0.45; // Initialize with base height
    }
  }
  if (!isAudioPlaying) renderStaticVisualizer();
  console.log('Visualizer config updated:', visualizerConfig);
};

// Initialize visualizer after startup
setTimeout(initMusicVisualizer, 100);

// Debug: expose audio loading state
window.__audioDebug = {
  get state() {
    return {
      audioLoaded,
      audioLoading,
      isPlaying: isAudioPlaying,
      canPlayThrough: bgAudio ? bgAudio.readyState >= 3 : false,
      downloadProgress: bgAudio ? `${Math.round((bgAudio.buffered.length > 0 ? bgAudio.buffered.end(bgAudio.buffered.length - 1) / bgAudio.duration : 0) * 100)}%` : 'N/A'
    };
  },
  get duration() { return bgAudio ? bgAudio.duration : 'N/A'; },
  get currentTime() { return bgAudio ? bgAudio.currentTime : 'N/A'; }
};
