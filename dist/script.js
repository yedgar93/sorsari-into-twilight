// =====================
// SORSARI Namespace
// Single global object to share state between scripts
// =====================
window.SORSARI = window.SORSARI || {};
window.SORSARI.musicTime = 0;
window.SORSARI.audioElement = null;
window.SORSARI.getInstrumentsLevel = function () {
  return 0;
}; // Will be replaced after init

// =====================
// Loading State Management (set up BEFORE init)
// =====================
let assetsLoaded = false;
let audioLoaded = false;
let threejsReady = false;

function markAudioLoaded() {
  if (!audioLoaded) {
    audioLoaded = true;
    console.log("[Loading] Main audio loaded");
    checkAllAssetsLoaded();
  }
}

function markThreeJSReady() {
  if (!threejsReady) {
    threejsReady = true;
    console.log("[Loading] Three.js ready");
    checkAllAssetsLoaded();
  }
}

function checkAllAssetsLoaded() {
  console.log(
    "[Loading] Check: audio=" + audioLoaded + ", threejs=" + threejsReady
  );
  if (audioLoaded && threejsReady) {
    assetsLoaded = true;
    hideLoadingSpinner();
  }
}

function hideLoadingSpinner() {
  const spinner = document.getElementById("loading-spinner-container");
  if (spinner) {
    spinner.classList.add("hidden");
    console.log("[Loading] All assets loaded - hiding spinner");
  }

  // Show touch-to-start container
  const touchToStart = document.getElementById("touch-to-start-container");
  if (touchToStart) {
    touchToStart.classList.add("visible");
    console.log("[Loading] Showing touch-to-start");
  }
}

// Fallback: if loading takes too long (10 seconds), force it to complete
setTimeout(function () {
  if (!assetsLoaded) {
    console.warn(
      "[Loading] Timeout - forcing load completion (audio=" +
        audioLoaded +
        ", threejs=" +
        threejsReady +
        ")"
    );
    audioLoaded = true;
    threejsReady = true;
    assetsLoaded = true;
    hideLoadingSpinner();
  }
}, 10000);

// Expose for use in other scripts
SORSARI.markThreeJSReady = markThreeJSReady;
SORSARI.assetsLoaded = function () {
  return assetsLoaded;
};

window.onload = init;

// Detect mobile devices
const isMobile =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

// =====================
// Prevent Pinch Zoom on Mobile
// =====================
if (isMobile) {
  // Prevent pinch zoom with touch events
  document.addEventListener(
    "touchmove",
    function (event) {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    },
    { passive: false }
  );

  // Prevent double-tap zoom
  let lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    function (event) {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    },
    { passive: false }
  );
}

// =====================
// Low-Power Failsafe System
// =====================
// Parachute that opens if device is struggling
let lowPowerFailsafeActive = false;
let lowPowerFailsafeTriggered = false;
let fpsDropFrameCount = 0;
const fpsDropThreshold = 22; // FPS below this triggers failsafe
const fpsDropDuration = 2000; // Must stay below threshold for 2 seconds

// References to be set during init
let failsafeThreeContainer = null;
let failsafeThreeBlurWrapper = null;
let failsafeRoot = null;
let failsafeBloomPass = null;
let failsafeRadialBlurPass = null;

// Global pause state for failsafe
let globalPauseState = { paused: false };
// Expose to window so other scripts can check pause state
window.globalPauseState = globalPauseState;

// DOM update batching - collect all DOM changes and apply them once per frame
let pendingDOMUpdates = {
  bottomImage: null,
  mobileLeftImage: null,
  mobileRightImage: null,
  trackTitle: null,
  hasUpdates: false,
};

// Cache DOM element references (set during init)
let cachedDOMElements = {
  bottomImage: null,
  mobileLeftImage: null,
  mobileRightImage: null,
  trackTitle: null,
};

// Batch DOM updates to reduce layout thrashing
function batchDOMUpdate(elementId, transform) {
  if (!elementId || !transform) return;

  // Store by element ID instead of reference to avoid scope issues
  if (elementId === "bottomImage") {
    pendingDOMUpdates.bottomImage = transform;
    pendingDOMUpdates.hasUpdates = true;
  } else if (elementId === "mobileLeftImage") {
    pendingDOMUpdates.mobileLeftImage = transform;
    pendingDOMUpdates.hasUpdates = true;
  } else if (elementId === "mobileRightImage") {
    pendingDOMUpdates.mobileRightImage = transform;
    pendingDOMUpdates.hasUpdates = true;
  } else if (elementId === "trackTitle") {
    pendingDOMUpdates.trackTitle = transform;
    pendingDOMUpdates.hasUpdates = true;
  }
}

// Apply all batched DOM updates at once
function flushDOMUpdates() {
  if (!pendingDOMUpdates.hasUpdates) return;

  if (pendingDOMUpdates.bottomImage !== null && cachedDOMElements.bottomImage) {
    cachedDOMElements.bottomImage.style.transform =
      pendingDOMUpdates.bottomImage;
  }
  if (
    pendingDOMUpdates.mobileLeftImage !== null &&
    cachedDOMElements.mobileLeftImage
  ) {
    cachedDOMElements.mobileLeftImage.style.transform =
      pendingDOMUpdates.mobileLeftImage;
  }
  if (
    pendingDOMUpdates.mobileRightImage !== null &&
    cachedDOMElements.mobileRightImage
  ) {
    cachedDOMElements.mobileRightImage.style.transform =
      pendingDOMUpdates.mobileRightImage;
  }
  if (pendingDOMUpdates.trackTitle !== null && cachedDOMElements.trackTitle) {
    cachedDOMElements.trackTitle.style.transform = pendingDOMUpdates.trackTitle;
  }

  pendingDOMUpdates.hasUpdates = false;
}

// Check for low-power conditions
function checkLowPowerConditions() {
  // Check 1: Data Saver mode
  if (navigator.connection?.saveData === true) {
    console.warn("[Low-Power Failsafe] Data Saver mode detected");
    return true;
  }

  // Check 2: Battery API (if available)
  if (navigator.getBattery) {
    navigator.getBattery().then((battery) => {
      if (battery.level < 0.15) {
        console.warn("[Low-Power Failsafe] Battery < 15%");
        return true;
      }
    });
  }

  return false;
}

// Monitor FPS for sustained drops
function monitorFPSForFailsafe(currentFPS) {
  if (currentFPS < fpsDropThreshold) {
    fpsDropFrameCount++;
    // If FPS has been low for 2+ seconds, trigger failsafe
    if (fpsDropFrameCount > (fpsDropThreshold * fpsDropDuration) / 1000) {
      console.warn(
        `[Low-Power Failsafe] FPS dropped below ${fpsDropThreshold} for >2 seconds`
      );
      return true;
    }
  } else {
    // Reset counter if FPS recovers
    fpsDropFrameCount = 0;
  }
  return false;
}

// Trigger low-power failsafe
function triggerLowPowerFailsafe() {
  if (lowPowerFailsafeTriggered) return; // Only trigger once
  lowPowerFailsafeTriggered = true;
  lowPowerFailsafeActive = true;

  console.warn("[Low-Power Failsafe] ACTIVATED - Disabling Three.js");
  console.log(
    "[Low-Power Failsafe] failsafeThreeContainer:",
    failsafeThreeContainer
  );
  console.log("[Low-Power Failsafe] failsafeRoot:", failsafeRoot);

  // Fade out Three.js canvas (fade the wrapper which contains the container)
  if (failsafeThreeBlurWrapper) {
    console.log("[Low-Power Failsafe] Setting wrapper opacity to 0");
    failsafeThreeBlurWrapper.style.transition = "opacity 1s ease-out";
    failsafeThreeBlurWrapper.style.opacity = "0";

    // After fade completes, dispose renderer
    setTimeout(() => {
      if (failsafeRoot && failsafeRoot.renderer) {
        failsafeRoot.renderer.dispose();
        console.log("[Low-Power Failsafe] Renderer disposed");
      }

      if (failsafeRoot && failsafeRoot.scene) {
        // Dispose all geometries and materials in scene
        failsafeRoot.scene.traverse((object) => {
          if (object.geometry) {
            object.geometry.dispose();
          }
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach((mat) => mat.dispose());
            } else {
              object.material.dispose();
            }
          }
        });
        console.log("[Low-Power Failsafe] Scene disposed");
      }

      // Disable post-processing passes
      if (failsafeBloomPass) failsafeBloomPass.enabled = false;
      if (failsafeRadialBlurPass) failsafeRadialBlurPass.enabled = false;

      // Stop the animation loop by setting global pause state
      globalPauseState.paused = true;
      console.log("[Low-Power Failsafe] Animation loop paused");

      console.log("[Low-Power Failsafe] Three.js fully disabled");
      console.log("[Low-Power Failsafe] 2D canvas + CRT + audio still running");
    }, 1000);
  }
}

const CONFIG = {
  pointCount: isMobile ? 400 : 3000, // Optimized for mobile - 400 points for better performance
  extrudeAmount: 2.0,
  splineStepsX: isMobile ? 2 : 3, // Decent quality on mobile
  splineStepsY: isMobile ? 2 : 3, // Decent quality on mobile

  // Radial blur settings - adjust these to change blur strength
  radialBlurStrength: isMobile ? 0.6 : 0.9, // Higher = more blur (0.0 - 1.0)
  radialBlurSamples: isMobile ? 8 : 10, // Higher = smoother blur but slower (4 - 16)

  // Global FPS controller - scales down rendering frequency
  // 1.0 = 60fps, 0.5 = 30fps, 0.33 = 20fps, 0.25 = 15fps
  // Mobile starts at 60fps but will throttle down based on frame time
  fpsScale: isMobile ? 1.0 : 0.77,
};

// =====================
// Adaptive FPS Throttling (Mobile Only)
// =====================
// Monitors frame time and throttles aggressively if performance degrades
let adaptiveFpsScale = isMobile ? 0.75 : CONFIG.fpsScale; // Start at 45fps on mobile instead of 60fps
let frameTimeHistory = [];
const frameTimeHistorySize = 10; // Average over 10 frames
const frameTimeThresholdHigh = 28; // Throttle if avg frame time > 28ms (more aggressive)
const frameTimeThresholdLow = 12; // Resume if avg frame time < 12ms (stricter recovery)
const throttleDownFactor = 0.75; // Reduce by 25% when throttling (more aggressive)
const throttleUpFactor = 1.03; // Increase by 3% when recovering (slower recovery)
const minFpsScale = 0.33; // Don't go below 20fps
const maxFpsScale = 1.0; // Don't go above 60fps

// Audio setup
let audioContext;
let analyser;
let dataArray;
let audioSource;
let audioElement;
let limiter; // Soft limiter to prevent clipping

// Drums track for kick detection
let drumsAnalyser;
let drumsDataArray;
let drumsSource;
let drumsElement;

// Instruments track for star pulsing
let instrumentsAnalyser;
let instrumentsDataArray;
let instrumentsSource;
let instrumentsElement;

let bassLevel = 0;
let drumsBassLevel = 0;
let instrumentsLevel = 0;
let audioReactive = false;

// Kick detection and color flash
const kickThreshold = 0.68; // Threshold for kick detection (0-1)
const kickTimingOffset = 0.0; // Timing offset for kick flash in seconds (positive = earlier, negative = later)
let colorFlashAmount = 0; // Current flash amount (0-1)
const defaultColor = new THREE.Color(0x362f99); // Default purple/blue
const kickColor = new THREE.Color(0x80558a); // Bright pink color for kicks
const cachedInterpolatedColor = new THREE.Color(); // Reusable color for interpolation (avoids allocation every frame)

// Audio timing offset (in seconds) - adjust if visualizer is ahead/behind music
const audioTimingOffset = 0; // Positive = delay visualizer, Negative = advance visualizer

// Bass history buffer for timing offset
const bassHistory = [];
const maxHistoryLength = 300; // Store up to 10 seconds at 30fps

// Page visibility detection for battery savings
let isPageVisible = true;
let reducedFrameCounter = 0;

// Screen shake on drops
const firstDropTime = 31.5;
const firstDropShakeEndTime = 95; // 1:35 - stop shaking at breakdown
const secondDropTime = 127.03;
const secondDropShakeEndTime = 192; // 3:12 - stop shaking

let screenShakeActive = false;
let shakeStartTime = 0;
let shakeDelayStartTime = 0;
let isInShakeDelay = false;
const shakeDuration = 1.5; // seconds
const shakeDelayDuration = 0.5; // seconds between shakes
const shakeIntensityCenter = 4; // 3-5px for center model
const shakeIntensityStar = 1.5; // 1-2px for stars

function getScreenShakeOffset() {
  if (!screenShakeActive) return { x: 0, y: 0 };

  const currentTime = SORSARI.musicTime || 0;
  const isInFirstDrop =
    currentTime >= firstDropTime && currentTime < breakdownTime;
  const isInSecondDrop = currentTime >= secondDropTime && currentTime < endTime;

  if (!isInFirstDrop && !isInSecondDrop) {
    screenShakeActive = false;
    return { x: 0, y: 0 };
  }

  // Random jitter offset
  const offsetX = (Math.random() - 0.5) * 2;
  const offsetY = (Math.random() - 0.5) * 2;

  return { x: offsetX, y: offsetY };
}

// Web Worker for audio analysis (runs in background thread)
let audioWorker = null;
let workerBass = 0;
let workerDrums = 0;
let workerInstruments = 0;

function initAudioWorker() {
  // Create worker if supported
  if (typeof Worker !== "undefined") {
    audioWorker = new Worker("dist/audio-worker.js");

    // Receive analysis results from worker
    audioWorker.onmessage = (event) => {
      const { bass, drums, instruments } = event.data;
      workerBass = bass;
      workerDrums = drums;
      workerInstruments = instruments;
    };
  }
}

function initAudio() {
  try {
    // Support both standard and webkit AudioContext (for older Safari/Chrome)
    const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextClass) {
      console.error("AudioContext not supported in this browser");
      return;
    }
    audioContext = new AudioContextClass();
  } catch (error) {
    console.error("Failed to initialize AudioContext:", error);
    return;
  }

  // Create soft limiter to prevent clipping (-0.1dB threshold)
  limiter = audioContext.createDynamicsCompressor();
  limiter.threshold.value = -0.1; // Threshold at -0.1dB
  limiter.knee.value = 0; // Hard knee for transparent limiting
  limiter.ratio.value = 20; // High ratio for limiting (not compression)
  limiter.attack.value = 0.003; // 3ms attack for fast response
  limiter.release.value = 0.25; // 250ms release for smooth recovery

  // Main audio analyser
  analyser = audioContext.createAnalyser();
  analyser.fftSize = isMobile ? 64 : 128;
  analyser.smoothingTimeConstant = 0.8;
  const bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);

  // Drums analyser for kick detection (desktop only - mobile uses main track)
  if (!isMobile) {
    drumsAnalyser = audioContext.createAnalyser();
    drumsAnalyser.fftSize = 128;
    drumsAnalyser.smoothingTimeConstant = 0.8;
    const drumsBufferLength = drumsAnalyser.frequencyBinCount;
    drumsDataArray = new Uint8Array(drumsBufferLength);
  }

  // Instruments analyser for star pulsing (desktop only - mobile uses main track)
  if (!isMobile) {
    instrumentsAnalyser = audioContext.createAnalyser();
    instrumentsAnalyser.fftSize = 128;
    instrumentsAnalyser.smoothingTimeConstant = 0.8;
    const instrumentsBufferLength = instrumentsAnalyser.frequencyBinCount;
    instrumentsDataArray = new Uint8Array(instrumentsBufferLength);
  }

  // Main audio track
  audioElement = new Audio("sorsari - into twilight.wav");
  audioElement.loop = false; // Don't loop
  audioElement.crossOrigin = "anonymous";

  // Expose via SORSARI namespace for other scripts
  SORSARI.audioElement = audioElement;
  SORSARI.analyser = analyser;

  // Connect main audio through limiter to analyser and output
  audioSource = audioContext.createMediaElementSource(audioElement);
  audioSource.connect(limiter);
  limiter.connect(analyser);
  analyser.connect(audioContext.destination);

  // Drums track for kick detection (desktop only)
  if (!isMobile) {
    drumsElement = new Audio("stems/drums.wav");
    drumsElement.loop = false; // Don't loop
    drumsElement.crossOrigin = "anonymous";
    drumsSource = audioContext.createMediaElementSource(drumsElement);
    drumsSource.connect(drumsAnalyser);
    console.log("Drums track loaded for kick detection");
  }

  // Instruments track for star pulsing (desktop only)
  if (!isMobile) {
    instrumentsElement = new Audio("stems/instruments.wav");
    instrumentsElement.loop = false; // Don't loop
    instrumentsElement.crossOrigin = "anonymous";
    instrumentsSource =
      audioContext.createMediaElementSource(instrumentsElement);
    instrumentsSource.connect(instrumentsAnalyser);
    console.log("Instruments track loaded for star pulsing");
  }

  // =====================
  // Loading State Management - Listen for audio load events
  // =====================
  // Listen for audio load events
  audioElement.addEventListener("canplay", markAudioLoaded);
  audioElement.addEventListener("loadeddata", markAudioLoaded);
  audioElement.addEventListener("loadedmetadata", markAudioLoaded);

  // Check if audio is already loaded (in case events fired before listener attached)
  if (audioElement.readyState >= 2) {
    // readyState >= 2 means HAVE_CURRENT_DATA or better
    markAudioLoaded();
  }

  // Sync all tracks - play them together
  function playAllTracks() {
    // Prevent playback until all assets are loaded
    if (!assetsLoaded) {
      console.log("[Loading] Playback blocked - assets still loading");
      return;
    }

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    // Start all audio tracks
    const playPromises = [audioElement.play()];
    // Only play stem tracks on desktop
    if (!isMobile) {
      if (drumsElement) {
        playPromises.push(drumsElement.play());
      }
      if (instrumentsElement) {
        playPromises.push(instrumentsElement.play());
      }
    }

    Promise.all(playPromises)
      .then(function () {
        audioReactive = true;
        // Trigger glow fade-in animation when music starts
        document.body.classList.add("glow-active");
        // Hide touch-to-start text if it hasn't appeared yet
        const touchToStartElement = document.getElementById("touch-to-start");
        if (touchToStartElement) {
          touchToStartElement.classList.add("hidden");
        }
        console.log("All tracks playing in sync:", {
          main: true,
          drums: !isMobile && !!drumsElement,
          instruments: !isMobile && !!instrumentsElement,
        });
      })
      .catch(function (error) {
        console.error("Playback failed:", error);
        // Try to play main audio at least
        audioElement.play().then(function () {
          audioReactive = true;
          console.log("Main audio playing (stems failed)");
        });
      });
  }

  // Check if autoplay parameter is set (from replay button)
  const urlParams = new URLSearchParams(window.location.search);
  const shouldAutoplay = urlParams.get("autoplay") === "true";

  // Check if we're coming from a replay (stored in sessionStorage)
  const isReplayingFromSession =
    sessionStorage.getItem("isReplaying") === "true";

  // Try to autoplay
  if (shouldAutoplay || isReplayingFromSession) {
    console.log("Autoplay enabled from replay - starting immediately");
    // Clear the replay flag
    sessionStorage.removeItem("isReplaying");
    // Small delay to ensure audio context is ready after page reload
    setTimeout(() => {
      playAllTracks();
    }, 100);
  } else {
    playAllTracks();
  }

  // Fallback for autoplay prevention (especially on mobile)
  // On mobile, autoplay is blocked by browser policy, so we need a user gesture
  document.addEventListener("click", function handleUserClick() {
    if (!audioReactive) {
      // Only try to play if assets are loaded
      if (assetsLoaded) {
        console.log("User interaction detected - starting playback");
        playAllTracks();
        // Remove listener after successful playback attempt
        document.removeEventListener("click", handleUserClick);
      } else {
        console.log(
          "User clicked but assets still loading - will retry when ready"
        );
      }
    }
  });

  // Override the skipToTime function to sync all three audio tracks
  SORSARI.skipToTime = function (seconds) {
    if (audioElement) {
      audioElement.currentTime = seconds;
    }
    if (drumsElement) {
      drumsElement.currentTime = seconds;
    }
    if (instrumentsElement) {
      instrumentsElement.currentTime = seconds;
    }
    // Also update SORSARI.musicTime immediately so all animators sync
    SORSARI.musicTime = seconds;
    console.log("Skipped all tracks to:", seconds, "seconds");
  };

  // Replay button logic
  let songEndedTime = null;
  const replayButton = document.getElementById("replay-button");

  // Detect when song ends
  audioElement.addEventListener("ended", function () {
    console.log("Song ended");
    songEndedTime = Date.now();
  });

  // Check if 7 seconds have passed since song ended and show replay button
  setInterval(() => {
    if (songEndedTime && Date.now() - songEndedTime >= 3000) {
      if (replayButton && !replayButton.classList.contains("visible")) {
        replayButton.classList.add("visible");
      }
    }
  }, 100);

  // Expose replay function for use in init()
  SORSARI.replay = function () {
    console.log(
      "Replaying song - fading out and refreshing page with autoplay"
    );

    // Set flag in sessionStorage to enable autoplay after reload
    // This persists through the page refresh and allows autoplay on mobile
    sessionStorage.setItem("isReplaying", "true");

    // Fade out entire body
    document.body.style.transition = "opacity 0.8s ease-in";
    document.body.style.opacity = "0";

    // Create fade overlay
    const fadeOverlay = document.createElement("div");
    fadeOverlay.style.position = "fixed";
    fadeOverlay.style.top = "0";
    fadeOverlay.style.left = "0";
    fadeOverlay.style.width = "100%";
    fadeOverlay.style.height = "100%";
    fadeOverlay.style.backgroundColor = "rgba(0, 0, 0, 0)";
    fadeOverlay.style.zIndex = "99999";
    fadeOverlay.style.pointerEvents = "none";
    fadeOverlay.style.transition = "background-color 0.8s ease-in";
    document.body.appendChild(fadeOverlay);

    // Trigger fade-out
    setTimeout(() => {
      fadeOverlay.style.backgroundColor = "rgba(0, 0, 0, 1)";
    }, 10);

    // Refresh page after fade completes using location.reload()
    // This preserves the user gesture context better on mobile
    setTimeout(() => {
      location.reload();
    }, 850);
  };

  // Replay button click handler
  if (replayButton) {
    replayButton.addEventListener("click", function () {
      SORSARI.replay();
    });
  }
}

// Audio analysis is now handled by Web Worker (audio-worker.js)
// These functions are kept for reference but are no longer called

// Expose instruments level via SORSARI namespace for star animation (throttled to 30fps)
SORSARI.getInstrumentsLevel = getInstrumentsLevelThrottled;

// Audio analysis frame counter for worker communication
let audioAnalysisFrameCount = 0;

// =====================
// Uniform Dead Zones (Audio-Driven)
// =====================
// Prevents shader uniform updates on tiny audio jitter
// Mobile: aggressive (±0.05), Desktop: loose (±0.02)
const uniformDeadZones = {
  bass: isMobile ? 0.05 : 0.02,
  roughness: isMobile ? 0.05 : 0.02,
  metalness: isMobile ? 0.05 : 0.02,
  colorFlash: isMobile ? 0.05 : 0.02,
  bloom: isMobile ? 0.05 : 0.02,
};

// Track last uniform values to detect meaningful changes
let lastUniformValues = {
  uD: 2.0,
  uA: 1.0,
  roughness: 0.5,
  metalness: 0.3,
  diffuse: new THREE.Color(0x9b111e),
  bloom: 0.0,
};

// Send audio data to worker for analysis
function sendAudioDataToWorker() {
  if (!audioWorker) return;

  audioAnalysisFrameCount++;

  // Get frequency data from main analyser (always available)
  analyser.getByteFrequencyData(dataArray);

  // On desktop, also get data from stem analysers
  if (!isMobile) {
    drumsAnalyser.getByteFrequencyData(drumsDataArray);
    instrumentsAnalyser.getByteFrequencyData(instrumentsDataArray);
  } else {
    // On mobile, use main track data for all analysis
    drumsDataArray = dataArray;
    instrumentsDataArray = dataArray;
  }

  // Send to worker for analysis
  audioWorker.postMessage({
    bassData: dataArray,
    drumsData: drumsDataArray,
    instrumentsData: instrumentsDataArray,
    frameCount: audioAnalysisFrameCount,
  });
}

// Get bass level from worker (throttled to 30fps by worker)
function getAudioDataThrottled() {
  return workerBass;
}

// Get drums level from worker (every frame for kick detection)
function getDrumsBasThrottled() {
  return workerDrums;
}

// Get instruments level from worker (throttled to 30fps by worker)
function getInstrumentsLevelThrottled() {
  return workerInstruments;
}

function init() {
  // Initialize audio
  initAudio();
  initAudioWorker();

  let root = null;
  let webglAvailable = true;

  try {
    root = new THREERoot({
      createCameraControls: false,
      antialias: window.devicePixelRatio === 1,
      fov: 60,
    });

    // Check if renderer is a real WebGL renderer or fallback
    if (!root.renderer.render || typeof root.renderer.render !== "function") {
      webglAvailable = false;
      console.warn("WebGL not available - skipping 3D visualization");
    }
  } catch (e) {
    console.error("Failed to initialize THREE.js root:", e);
    webglAvailable = false;
  }

  // Expose root for easter eggs (even if null)
  window.root = root;

  // Only initialize 3D scene if WebGL is available
  if (!webglAvailable || !root) {
    console.log("Skipping 3D visualization - WebGL not available");
    return; // Exit early if WebGL not available
  }

  try {
    root.renderer.setClearColor(0x000000, 0); // Transparent background
    root.camera.position.set(0, 0, 200);
    root.camera.lookAt(15, -25, 0); // Tilted down to avoid bright center

    const light = new THREE.PointLight(0xffffff, 1.0);
    root.add(light);

    const vertices = [];
    let indices;
    let i, j;

    // 1. generate random points in grid formation with some noise
    const PHI = Math.PI * (3 - Math.sqrt(5));
    const n = CONFIG.pointCount;
    const radius = 100;
    const noise = 4.0;

    for (i = 0; i <= n; i++) {
      const t = i * PHI;
      const r = Math.sqrt(i) / Math.sqrt(n);
      const x = r * Math.cos(t) * (radius - THREE.Math.randFloat(0, noise));
      const y =
        r * Math.sin(t) * (radius - THREE.Math.randFloatSpread(0, noise));

      vertices.push([x, y]);
    }

    // 2. generate indices
    indices = Delaunay.triangulate(vertices);

    // 2.5. reduce triangle count on mobile for better performance
    if (isMobile) {
      // Keep only every other triangle (50% reduction)
      const reducedIndices = [];
      for (let idx = 0; idx < indices.length; idx += 6) {
        // Each triangle is 3 indices, skip every other triangle
        if (idx + 2 < indices.length) {
          reducedIndices.push(indices[idx]);
          reducedIndices.push(indices[idx + 1]);
          reducedIndices.push(indices[idx + 2]);
        }
      }
      indices = reducedIndices;
    }

    // 3. create displacement splines
    const pointsX = [];
    const pointsY = [];
    const segmentsX = CONFIG.splineStepsX;
    const segmentsY = CONFIG.splineStepsY;

    for (i = 0; i <= segmentsX; i++) {
      pointsX.push(
        new THREE.Vector3(
          THREE.Math.mapLinear(i, 0, segmentsX, -radius, radius),
          0,
          i === 0 || i === segmentsX ? 0 : -THREE.Math.randFloat(64, 72)
        )
      );
    }
    for (i = 0; i <= segmentsY; i++) {
      pointsY.push(
        new THREE.Vector3(
          0,
          THREE.Math.mapLinear(i, 0, segmentsY, -radius, radius),
          i === 0 || i === segmentsY ? 0 : -THREE.Math.randFloat(64, 72)
        )
      );
    }

    const splineX = new THREE.CatmullRomCurve3(pointsX);
    const splineY = new THREE.CatmullRomCurve3(pointsY);

    // line geometries for testing

    //var g, m;
    //g = new THREE.Geometry();
    //g.vertices = splineX.getPoints(50);
    //m = new THREE.LineBasicMaterial({color: 0xff0000});
    //root.add(new THREE.Line(g, m));
    //g = new THREE.Geometry();
    //g.vertices = splineY.getPoints(50);
    //m = new THREE.LineBasicMaterial({color: 0x00ff00});
    //root.add(new THREE.Line(g, m));

    // 4. generate geometry (maybe find a cheaper way to do this)
    const geometry = new THREE.Geometry();
    const shapeScale = 0.95;

    for (i = 0; i < indices.length; i += 3) {
      // build the face
      let v0 = vertices[indices[i]];
      let v1 = vertices[indices[i + 1]];
      let v2 = vertices[indices[i + 2]];

      // calculate centroid
      const cx = (v0[0] + v1[0] + v2[0]) / 3;
      const cy = (v0[1] + v1[1] + v2[1]) / 3;

      // translate, scale, un-translate
      v0 = [(v0[0] - cx) * shapeScale + cx, (v0[1] - cy) * shapeScale + cy];
      v1 = [(v1[0] - cx) * shapeScale + cx, (v1[1] - cy) * shapeScale + cy];
      v2 = [(v2[0] - cx) * shapeScale + cx, (v2[1] - cy) * shapeScale + cy];

      // draw the face to a shape
      const shape = new THREE.Shape();
      shape.moveTo(v0[0], v0[1]);
      shape.lineTo(v1[0], v1[1]);
      shape.lineTo(v2[0], v2[1]);

      // use the shape to create a geometry
      const shapeGeometry = new THREE.ExtrudeGeometry(shape, {
        amount: CONFIG.extrudeAmount,
        bevelEnabled: false,
      });

      // offset z vector components based on the two splines
      for (j = 0; j < shapeGeometry.vertices.length; j++) {
        const v = shapeGeometry.vertices[j];
        const ux = THREE.Math.clamp(
          THREE.Math.mapLinear(v.x, -radius, radius, 0.0, 1.0),
          0.0,
          1.0
        );
        const uy = THREE.Math.clamp(
          THREE.Math.mapLinear(v.y, -radius, radius, 0.0, 1.0),
          0.0,
          1.0
        );

        v.z += splineX.getPointAt(ux).z;
        v.z += splineY.getPointAt(uy).z;
      }

      // merge into the whole
      geometry.merge(shapeGeometry);
    }

    geometry.center();

    // 5. feed the geometry to the animation
    const animation = new Animation(geometry);
    root.add(animation);

    // interactive
    // Use global pause state so failsafe can pause the animation loop
    // let paused = false; // Removed - using globalPauseState instead

    // Page visibility detection listener
    document.addEventListener("visibilitychange", function () {
      isPageVisible = !document.hidden;
      if (isPageVisible) {
        console.log("Page visible - resuming full speed rendering");
      } else {
        console.log("Page hidden - reducing rendering frequency");
      }
    });

    // post processing - define early so we can use in update callback
    // Disable bloom on mobile entirely for better performance
    // Higher threshold = only bright parts bloom (only on bass hits)
    const bloomPass = new THREE.BloomPass(2.0, 25, 4, 256); // Threshold 2.0 = only bloom on peaks, 256 resolution
    if (isMobile) {
      bloomPass.enabled = false;
    }

    // Radial blur shader for atmospheric background effect
    const RadialBlurShader = {
      uniforms: {
        tDiffuse: { type: "t", value: null },
        resolution: {
          type: "v2",
          value: new THREE.Vector2(window.innerWidth, window.innerHeight),
        },
        strength: { type: "f", value: CONFIG.radialBlurStrength },
        samples: { type: "i", value: CONFIG.radialBlurSamples },
      },
      vertexShader: [
        "varying vec2 vUv;",
        "void main() {",
        "  vUv = uv;",
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
        "}",
      ].join("\n"),
      fragmentShader: [
        "uniform sampler2D tDiffuse;",
        "uniform vec2 resolution;",
        "uniform float strength;",
        "uniform int samples;",
        "varying vec2 vUv;",
        "",
        "void main() {",
        "  vec2 center = vec2(0.5, 0.5);",
        "  vec2 uv = vUv;",
        "  vec2 dir = uv - center;",
        "  float dist = length(dir);",
        "  dir = normalize(dir);",
        "  ",
        "  vec4 color = texture2D(tDiffuse, uv);",
        "  vec4 sum = color;",
        "  ",
        "  float blurAmount = strength * dist;",
        "  ",
        "  for(int i = 1; i < 16; i++) {",
        "    if(i >= samples) break;",
        "    float scale = 1.0 - blurAmount * (float(i) / float(samples));",
        "    sum += texture2D(tDiffuse, center + dir * dist * scale);",
        "  }",
        "  ",
        "  sum /= float(samples);",
        "  gl_FragColor = sum;",
        "}",
      ].join("\n"),
    };

    const radialBlurPass = new THREE.ShaderPass(RadialBlurShader);
    const copyPass = new THREE.ShaderPass(THREE.CopyShader);
    root.initPostProcessing([bloomPass, radialBlurPass, copyPass]);

    // Set failsafe references for post-processing passes
    failsafeBloomPass = bloomPass;
    failsafeRadialBlurPass = radialBlurPass;

    // Expose bloom and radial blur passes for debug controls
    window.SORSARI = window.SORSARI || {};
    window.SORSARI.bloomPass = bloomPass;
    window.SORSARI.radialBlurPass = radialBlurPass;

    // Get access to the geometry vertices for speaker cone effect
    const positions = animation.geometry.attributes.position.array;
    const originalPositions = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i++) {
      originalPositions[i] = positions[i];
    }

    // Speaker cone optimization disabled - was finding 0 vertices and adding unnecessary computation
    // If needed in the future, can be re-enabled with proper model center detection

    let frameCount = 0; // For throttling vertex updates
    let cameraTime = 0; // For camera movement timing
    const originalCameraPos = { x: 0, y: 0, z: 90 }; // Store original camera position after zoom-in
    const upwardPanStartTime = 160.06; // 2:40:06 - when upward pan begins
    const upwardPanSpeed = 2.125; // Units per second to pan upward (SUPER slow)
    const upwardTiltSpeed = 10; // Degrees per second to tilt camera upward
    let upwardPanEnabled = false; // Track if pan/tilt has been enabled

    // Intro zoom settings
    const dropTime = 31.5; // Time in seconds when the drop hits
    const zoomDuration = 2.0; // Duration of zoom-in animation in seconds
    const introZoomDistance = 1000; // Starting zoomed-out distance
    const preDropZoomDistance = 450; // Slightly closer before the drop (subtle zoom)
    const finalZoomDistance = 90; // Final zoomed-in distance
    let hasZoomedIn = false;
    const introZoomDuration = 32.0; // Duration of subtle intro zoom (first 30 seconds)

    // Second drop zoom settings (breakdown at 1:35) - same pattern as first drop
    const secondBreakdownStart = 95.0; // 1:35 - breakdown starts (like 0 seconds in intro)
    const secondIntroZoomDuration = 30.0; // 30 seconds of subtle zoom (95-125)
    const secondDropTime = 127; // 2:06.5 - second drop (95 + 31.5 seconds)
    let hasSecondZoom = false;

    // CSS filter inversion at second drop
    let invertFilterApplied = false;
    let invertFilterRemoved = false;
    const threeContainer = document.getElementById("three-container");
    const threeBlurWrapper = document.getElementById("three-blur-wrapper");

    // Set failsafe references
    failsafeThreeContainer = threeContainer;
    failsafeThreeBlurWrapper = threeBlurWrapper;
    failsafeRoot = root;

    // Triangle canvas fade out timing
    const triangleFadeOutStart = 185; // 3:05
    const triangleFadeOutEnd = 215; // 3:35
    const triangleFadeOutDuration = triangleFadeOutEnd - triangleFadeOutStart; // 30 seconds

    // Triangle canvas blur timing
    const triangleBlurStart = 178; // 2:58
    const triangleBlurEnd = 215; // 3:35 (when fade out completes)
    const triangleBlurDuration = triangleBlurEnd - triangleBlurStart; // 37 seconds

    // Camera zoom out timing
    const cameraZoomOutStart = 165; // 2:45
    const cameraZoomOutEnd = 215; // 3:35 (when fade out completes)
    const cameraZoomOutDuration = cameraZoomOutEnd - cameraZoomOutStart; // 50 seconds
    const cameraZoomOutDistance = 300; // How far to pull back (added to current Z position)

    // Camera roving settings
    const beatsPerCycle = 64; // Number of beats for position orbit
    const beatsPerLookCycle = 128; // Number of beats for look direction (tilt/pan)
    const bpm = 120;
    const secondsPerBeat = 60 / bpm;
    const cycleDuration = beatsPerCycle * secondsPerBeat; // Position cycle time
    const lookCycleDuration = beatsPerLookCycle * secondsPerBeat; // Look cycle time

    // Scene rotation settings
    const beatsPerRotation = 192; // Full rotation every 192 beats (50% slower than 128)
    const rotationDuration = beatsPerRotation * secondsPerBeat; // Time for full 360° rotation

    // Parallax depth shift settings
    const bottomImage = document.getElementById("bottom-image");
    const mobileLeftImage = document.getElementById("mobile-left-image");
    const mobileRightImage = document.getElementById("mobile-right-image");
    const trackTitle = document.getElementById("track-title");

    // Cache DOM elements for batched updates
    cachedDOMElements.bottomImage = bottomImage;
    cachedDOMElements.mobileLeftImage = mobileLeftImage;
    cachedDOMElements.mobileRightImage = mobileRightImage;
    cachedDOMElements.trackTitle = trackTitle;

    const parallaxMaxShift = 3.275; // Maximum pixels to shift (creates breathing effect)
    const parallaxSensitivity = 0.476; // How much audio affects the shift (0-1)

    // Model viewer chromatic aberration settings
    const modelViewerWrapper = document.getElementById("model-viewer-wrapper");
    const terrorModelViewer = document.querySelector("#terror-model-viewer"); // Cache this to avoid repeated queries

    // First drop chromatic aberration (1:31.85 to 1:35.8)
    const firstDropChromaticStartTime = 31.85; // 1:31.85 - first drop
    const firstDropChromaticEndTime = 95.8; // 1:35.8 - breakdown
    const firstDropChromaticStartAmount = 5; // Start at 15px
    const firstDropChromaticMaxAmount = 10; // Max 30px

    // Final chromatic aberration (3:12 onwards)
    const finalChromaticStartTime = 191.72; // 3:12 - start chromatic aberration
    const finalChromaticMaxAmount = 20; // Max pixel offset for chromatic aberration

    // Triangles canvas brightness control
    const trianglesStartValue = 0.3; // Start at 0.3 brightness
    const trianglesDelayStart = 15.5; // Stay at 0.3 brightness until 15.5 seconds
    const trianglesEndTime = 27.4; // Reach full brightness by 27.4 seconds
    const trianglesEndValue = 1.0; // Full brightness
    const trianglesFadeOutStart = 28.95; // Fade out from 0:28.5
    const trianglesFadeOutEnd = 30.12; // Fade out complete at 0:29.5
    const trianglesFadeInTime = 31.96; // Abruptly fade back in at 0:32

    // Process kill times
    const parallaxKillTime = 190; // Kill parallax shift at 3:10
    const bloomKillTime = 190; // Kill bloom updates at 3:10
    const kickDetectionKillTime = 190; // Kill kick detection at 3:10
    const audioAnalysisKillTime = 206; // Kill audio analysis at 3:26
    const screenShakeKillTime = 192; // Kill screen shake at 3:12
    const cameraPanKillTime = 215; // Kill camera pan & tilt at 3:35
    const centerModelKillTime = 215; // Kill center model at 3:35

    // Process kill flags
    let parallaxKilled = false;
    let bloomKilled = false;
    let kickDetectionKilled = false;
    let audioAnalysisKilled = false;
    let screenShakeKilled = false;
    let cameraPanKilled = false;
    let centerModelKilled = false;
    let threeRenderingKilled = false;

    // Peak detection for parallax
    let parallaxPeakLevel = 0;
    let parallaxPeakDecay = 0.9; // How fast the peak decays (0.9-0.99)

    // Parallax throttling - update at reduced FPS based on CONFIG.fpsScale
    let parallaxFrameCount = 0;
    // On mobile: 15fps (every 4 frames at 60fps), on desktop: 30fps (every 2 frames)
    const parallaxUpdateInterval = isMobile
      ? 4
      : Math.max(1, Math.round(1 / (CONFIG.fpsScale * 0.5)));

    // Individual parallax offsets for each element (randomized)
    const parallaxOffsets = {
      bottomImage: Math.random() * 0.3 - 0.15, // -0.15 to 0.15
      mobileLeftImage: Math.random() * 0.3 - 0.16,
      mobileRightImage: Math.random() * 0.3 - 0.15,
      trackTitle: Math.random() * 0.297 - 0.14,
    };

    // Random direction multipliers (1 or -1) for each element
    const parallaxDirections = {
      bottomImage: Math.random() > 0.5 ? 1 : -1,
      mobileLeftImage: Math.random() > 0.5 ? 1 : -1,
      mobileRightImage: Math.random() > 0.5 ? 1 : -1,
      trackTitle: Math.random() > 0.5 ? 1 : -1,
    };

    // Ghost mirror effect state (random mirroring for 0.5s)
    const ghostMirrorState = {
      bottomImage: { active: false, endTime: 0 },
      mobileLeftImage: { active: false, endTime: 0 },
      mobileRightImage: { active: false, endTime: 0 },
      trackTitle: { active: false, endTime: 0 },
    };
    const ghostMirrorDuration = 0.5; // seconds
    const ghostMirrorChance = 0.003; // ~0.3% chance per frame (rare)

    root.addUpdateCallback(function () {
      if (globalPauseState.paused) return;

      animation.time += 1 / 30;
      frameCount++;

      // Send audio data to worker for analysis
      // On mobile: every 2 frames (30fps) to reduce main thread load
      // On desktop: every frame (60fps) for smooth reactivity
      const audioAnalysisInterval = isMobile ? 2 : 1;
      if (
        audioReactive &&
        audioElement &&
        !audioElement.paused &&
        frameCount % audioAnalysisInterval === 0
      ) {
        sendAudioDataToWorker();
      }

      // Only increment camera time if audio is playing
      if (audioReactive && audioElement && !audioElement.paused) {
        cameraTime += 1 / 30;
        SORSARI.musicTime = audioElement.currentTime; // Use actual audio time for accuracy
      }

      // Get current audio playback time
      const currentTime = audioElement ? audioElement.currentTime : 0;

      // Apply parallax depth shift to UI elements based on audio peaks
      // Kill parallax process at 3:10 to save performance
      if (currentTime >= parallaxKillTime) {
        if (!parallaxKilled) {
          parallaxKilled = true;
          // Reset all parallax transforms
          if (bottomImage) bottomImage.style.transform = "translateY(0px)";
          if (mobileLeftImage)
            mobileLeftImage.style.transform = "translateY(0px)";
          if (mobileRightImage)
            mobileRightImage.style.transform = "translateY(0px)";
          if (trackTitle)
            trackTitle.style.transform = "translateX(-50%) translateY(0px)";
        }
      } else if (audioReactive && drumsAnalyser) {
        // Throttle parallax updates based on global FPS scale (30fps target)
        parallaxFrameCount++;
        if (parallaxFrameCount % parallaxUpdateInterval !== 0) {
          // Skip this frame's parallax update
        } else {
          // Get frequency data from drums track instead of master
          drumsAnalyser.getByteFrequencyData(drumsDataArray);

          // Calculate bass level from low frequencies (first 8 bins)
          let bassSum = 0;
          for (let i = 0; i < 8; i++) {
            bassSum += drumsDataArray[i];
          }
          const audioLevel = bassSum / (8 * 255); // Normalize to 0-1

          // Peak detection: only respond to peaks above the current peak level
          if (audioLevel > parallaxPeakLevel) {
            parallaxPeakLevel = audioLevel; // New peak detected
          } else {
            parallaxPeakLevel *= parallaxPeakDecay; // Decay the peak over time
          }

          // Use the peak level for parallax (creates pulsing effect)
          const parallaxShift =
            parallaxPeakLevel * parallaxMaxShift * parallaxSensitivity;

          // Batch DOM updates instead of writing directly (reduces layout thrashing)
          // Apply to bottom image with randomized offset and direction
          if (bottomImage) {
            const shift =
              parallaxShift * parallaxDirections.bottomImage +
              parallaxOffsets.bottomImage;
            batchDOMUpdate("bottomImage", `translateY(${shift}px)`);
          }

          // Apply to mobile left image with randomized offset and direction
          if (mobileLeftImage) {
            const shift =
              parallaxShift * parallaxDirections.mobileLeftImage +
              parallaxOffsets.mobileLeftImage;
            batchDOMUpdate("mobileLeftImage", `translateY(${shift}px)`);
          }

          // Apply to mobile right image with randomized offset and direction
          if (mobileRightImage) {
            const shift =
              parallaxShift * parallaxDirections.mobileRightImage +
              parallaxOffsets.mobileRightImage;
            batchDOMUpdate("mobileRightImage", `translateY(${shift}px)`);
          }

          // Apply to track title - combine with existing translateX and randomized offset/direction
          if (trackTitle) {
            const shift =
              parallaxShift * parallaxDirections.trackTitle +
              parallaxOffsets.trackTitle;
            batchDOMUpdate(
              "trackTitle",
              `translateX(-50%) translateY(${shift}px)`
            );
          }

          // Apply chromatic aberration to UI elements during drops (opposite to parallax direction)
          // First drop: 0:31 to 1:36, Second drop: 2:07 to 3:10, Fade out: 3:10 to 3:30
          const isInDrop =
            (currentTime >= 31 && currentTime < 96) || // First drop 0:31 to 1:36
            (currentTime >= 127 && currentTime < 190); // Second drop 2:07 to 3:10

          // Calculate opacity for fade out section (3:10 to 3:30)
          let glitchOpacity = 1.0;
          if (currentTime >= 190 && currentTime < 210) {
            // Fade out from 1.0 to 0 over 20 seconds
            glitchOpacity = 1.0 - (currentTime - 190) / 20;
          } else if (currentTime >= 210) {
            glitchOpacity = 0;
          }

          if (
            (isInDrop || (currentTime >= 190 && currentTime < 210)) &&
            glitchOpacity > 0
          ) {
            // Calculate chromatic offset based on parallax shift (MORE INTENSE)
            const chromaticOffset = parallaxShift * 2.73 + 1.55; // Bigger multiplier + base offset

            // Helper function to apply chromatic + optional ghost effects
            const applyGlitchEffect = (element, key) => {
              if (!element) return;

              let dir = -parallaxDirections[key]; // Opposite direction
              const ghost = ghostMirrorState[key];

              // Random chance to trigger ghost effect (only if not already active)
              if (!ghost.active && Math.random() < ghostMirrorChance) {
                ghost.active = true;
                ghost.endTime = currentTime + ghostMirrorDuration;
                // Randomly choose effect type: 0 = reverse colors, 1 = flip horizontal, 2 = both
                ghost.effectType = Math.floor(Math.random() * 3);
              }

              // Check if ghost effect should end
              if (ghost.active && currentTime >= ghost.endTime) {
                ghost.active = false;
              }

              // Apply ghost effects
              let flipColors = false;
              let flipHorizontal = false;
              if (ghost.active) {
                if (ghost.effectType === 0 || ghost.effectType === 2) {
                  flipColors = true; // Reverse chromatic aberration direction
                }
                if (ghost.effectType === 1 || ghost.effectType === 2) {
                  flipHorizontal = true; // Flip aberration horizontally (Y axis offset)
                }
              }

              // Reverse direction if flipColors is active
              if (flipColors) {
                dir = -dir;
              }

              // Build filter string - horizontal flip adds Y offset
              const yOffset = flipHorizontal ? chromaticOffset * 0.44 : 0;
              const redOpacity = 0.26 * glitchOpacity;
              const blueOpacity = 0.34 * glitchOpacity;
              const filter = `drop-shadow(${
                chromaticOffset * dir
              }px ${yOffset}px 0px rgba(255, 0, 0, ${redOpacity})) drop-shadow(${
                -chromaticOffset * dir
              }px ${-yOffset}px 0px rgba(0, 0, 255, ${blueOpacity}))`;

              element.style.filter = filter;
            };

            // Apply to each element
            applyGlitchEffect(bottomImage, "bottomImage");
            applyGlitchEffect(mobileLeftImage, "mobileLeftImage");
            applyGlitchEffect(mobileRightImage, "mobileRightImage");
            applyGlitchEffect(trackTitle, "trackTitle");

            // Apply chromatic aberration to TERROR model (using cached reference)
            if (terrorModelViewer) {
              const redOpacity = 0.44 * glitchOpacity;
              const blueOpacity = 0.52 * glitchOpacity;
              const terrorFilter = `drop-shadow(${chromaticOffset}px 0px 0px rgba(255, 0, 0, ${redOpacity})) drop-shadow(-${chromaticOffset}px 0px 0px rgba(0, 0, 255, ${blueOpacity}))`;
              terrorModelViewer.style.filter = terrorFilter;
            }
          } else {
            // Remove chromatic aberration and reset transforms when not in drop
            if (bottomImage) {
              bottomImage.style.filter = "";
              ghostMirrorState.bottomImage.active = false;
            }
            if (mobileLeftImage) {
              mobileLeftImage.style.filter = "";
              ghostMirrorState.mobileLeftImage.active = false;
            }
            if (mobileRightImage) {
              mobileRightImage.style.filter = "";
              ghostMirrorState.mobileRightImage.active = false;
            }
            if (trackTitle) {
              trackTitle.style.filter = "";
              ghostMirrorState.trackTitle.active = false;
            }

            // Remove chromatic aberration from TERROR model (using cached reference)
            if (terrorModelViewer) {
              terrorModelViewer.style.filter = "";
            }
          }
        } // Close throttle check
      }

      // Camera zoom out from 2:45 to 3:35 (165s to 215s) - pull camera back on Z axis
      let cameraZoomOutOffset = 0;
      if (currentTime >= cameraZoomOutStart) {
        const zoomOutProgress = Math.min(
          (currentTime - cameraZoomOutStart) / cameraZoomOutDuration,
          1.0
        );
        cameraZoomOutOffset = zoomOutProgress * cameraZoomOutDistance; // Pull back up to 300 units
      }

      // Handle multi-stage zoom animation
      // FIRST DROP SEQUENCE (0-33.5 seconds)
      if (currentTime < introZoomDuration) {
        // Stage 1: Subtle intro zoom (0-30 seconds) - very slow zoom in
        const introProgress = currentTime / introZoomDuration;
        // Ease in-out for smooth subtle zoom
        const easedIntroProgress =
          introProgress < 0.5
            ? 2 * introProgress * introProgress
            : 1 - Math.pow(-2 * introProgress + 2, 2) / 2;
        root.camera.position.z =
          introZoomDistance +
          (preDropZoomDistance - introZoomDistance) * easedIntroProgress +
          cameraZoomOutOffset;
      } else if (
        currentTime >= dropTime &&
        currentTime < dropTime + zoomDuration
      ) {
        // Stage 2: Big zoom-in at the drop (31.5-33.5 seconds)
        const zoomProgress = (currentTime - dropTime) / zoomDuration;
        // Ease out cubic for smooth deceleration
        const easedProgress = 1 - Math.pow(1 - zoomProgress, 3);
        // Interpolate camera Z position from pre-drop distance to final
        root.camera.position.z =
          preDropZoomDistance +
          (finalZoomDistance - preDropZoomDistance) * easedProgress +
          cameraZoomOutOffset;

        if (!hasZoomedIn && zoomProgress >= 1.0) {
          hasZoomedIn = true;
        }
      } else if (currentTime >= introZoomDuration && currentTime < dropTime) {
        // Between intro zoom and drop - hold at pre-drop distance
        root.camera.position.z = preDropZoomDistance + cameraZoomOutOffset;
      }
      // SECOND DROP SEQUENCE (1:35-2:08.5 / 95-128.5 seconds) - same timing as first
      else if (
        currentTime >= secondBreakdownStart &&
        currentTime < secondBreakdownStart + secondIntroZoomDuration
      ) {
        // Subtle zoom out during breakdown (95-125 seconds, 30 seconds)
        const secondIntroProgress =
          (currentTime - secondBreakdownStart) / secondIntroZoomDuration;
        const easedSecondIntroProgress =
          secondIntroProgress < 0.5
            ? 2 * secondIntroProgress * secondIntroProgress
            : 1 - Math.pow(-2 * secondIntroProgress + 2, 2) / 2;
        root.camera.position.z =
          finalZoomDistance +
          (preDropZoomDistance - finalZoomDistance) * easedSecondIntroProgress +
          cameraZoomOutOffset;
      } else if (
        currentTime >= secondDropTime &&
        currentTime < secondDropTime + zoomDuration
      ) {
        // Big zoom back in at second drop (126.5-128.5 seconds)
        const secondZoomProgress =
          (currentTime - secondDropTime) / zoomDuration;
        const easedSecondProgress = 1 - Math.pow(1 - secondZoomProgress, 3);
        root.camera.position.z =
          preDropZoomDistance +
          (finalZoomDistance - preDropZoomDistance) * easedSecondProgress +
          cameraZoomOutOffset;

        if (!hasSecondZoom && secondZoomProgress >= 1.0) {
          hasSecondZoom = true;
        }
      } else if (
        currentTime >= secondBreakdownStart + secondIntroZoomDuration &&
        currentTime < secondDropTime
      ) {
        // Between second intro zoom and second drop - hold at pre-drop distance
        root.camera.position.z = preDropZoomDistance + cameraZoomOutOffset;
      }

      // Audio reactivity - only use actual bass from audio (throttled to 30fps)
      // Kill audio analysis at 3:26 to save performance
      let bass = 0;
      if (currentTime < audioAnalysisKillTime) {
        bass = getAudioDataThrottled();
      } else if (!audioAnalysisKilled) {
        audioAnalysisKilled = true;
        // Reset audio-reactive values to defaults
        animation.material.uniforms["uD"].value = 2.0;
        animation.material.uniforms["uA"].value = 1.0;
        animation.material.uniforms["roughness"].value = 0.5;
        animation.material.uniforms["metalness"].value = 0.3;
      }

      // Fade in canvas opacity from 13 to 30 seconds
      const fadeInStart = 13.0; // Start fading at 13 seconds
      const fadeInEnd = 30.0; // Finish fading at 30 seconds
      const currentAudioTime = audioElement ? audioElement.currentTime : 0;
      if (currentAudioTime < fadeInStart) {
        // Before 13 seconds - stay at 0 opacity
        animation.material.uniforms["opacity"].value = 0.0;
      } else if (currentAudioTime < fadeInEnd) {
        // Between 13-30 seconds - fade from 0 to 1
        const fadeProgress =
          (currentAudioTime - fadeInStart) / (fadeInEnd - fadeInStart);
        animation.material.uniforms["opacity"].value = fadeProgress;
      } else {
        // After 30 seconds - stay at full opacity
        animation.material.uniforms["opacity"].value = 1.0;
      }

      // Rotate the entire scene slowly - full rotation every 128 beats
      if (audioReactive && audioElement && !audioElement.paused) {
        const rotationProgress =
          (cameraTime % rotationDuration) / rotationDuration; // 0 to 1
        const rotationAngle = (rotationProgress * (Math.PI * 2)) / 8; // 0 to 2π (360°)
        animation.rotation.z = rotationAngle; // Rotate around Z axis
      }

      // Make the animation react to bass (with dead zones to reduce GPU state changes)
      // uD controls displacement/extrusion - pulsate with bass
      const newUD = 2.0 + bass * 24.0;
      if (Math.abs(newUD - lastUniformValues.uD) > uniformDeadZones.bass) {
        animation.material.uniforms["uD"].value = newUD;
        lastUniformValues.uD = newUD;
      }

      // uA controls animation amplitude - increase with bass
      const newUA = 1.0 + bass * 6.0;
      if (Math.abs(newUA - lastUniformValues.uA) > uniformDeadZones.bass) {
        animation.material.uniforms["uA"].value = newUA;
        lastUniformValues.uA = newUA;
      }

      // Make it more metallic and less rough when bass hits (with dead zones)
      const newRoughness = 0.5 - bass * 0.3;
      if (
        Math.abs(newRoughness - lastUniformValues.roughness) >
        uniformDeadZones.roughness
      ) {
        animation.material.uniforms["roughness"].value = newRoughness;
        lastUniformValues.roughness = newRoughness;
      }

      const newMetalness = 0.3 + bass * 0.7;
      if (
        Math.abs(newMetalness - lastUniformValues.metalness) >
        uniformDeadZones.metalness
      ) {
        animation.material.uniforms["metalness"].value = newMetalness;
        lastUniformValues.metalness = newMetalness;
      }

      // Kick detection and color flash (using drums track) - throttled to every 2 frames
      // Disabled on mobile to save performance (main track detection is too noisy)
      // Kill kick detection at 3:10 to save performance
      if (currentTime >= kickDetectionKillTime) {
        if (!kickDetectionKilled) {
          kickDetectionKilled = true;
          // Reset to default color
          animation.material.uniforms["diffuse"].value.copy(defaultColor);
          colorFlashAmount = 0.0;
        }
      } else if (!isMobile && frameCount % 2 === 0) {
        const drumsBass = getDrumsBasThrottled();
        if (drumsBass > kickThreshold) {
          // Kick detected - flash to pink
          colorFlashAmount = Math.min(1.0, colorFlashAmount + 0.3);
        } else {
          // Fade back to default color
          colorFlashAmount = Math.max(0.0, colorFlashAmount - 0.05);
        }

        // Only update color if change exceeds dead zone
        if (
          Math.abs(colorFlashAmount - lastUniformValues.diffuse.getHSL({}).l) >
          uniformDeadZones.colorFlash
        ) {
          // Interpolate between default color and kick color (reuse cached color object)
          cachedInterpolatedColor
            .copy(defaultColor)
            .lerp(kickColor, colorFlashAmount);
          animation.material.uniforms["diffuse"].value.copy(
            cachedInterpolatedColor
          );
          lastUniformValues.diffuse.copy(cachedInterpolatedColor);
        }
      }

      // Update bloom intensity - throttled to every 3 frames (with dead zones)
      // Kill bloom at 3:10 to save performance
      if (currentTime >= bloomKillTime) {
        if (!bloomKilled) {
          bloomKilled = true;
          bloomPass.copyUniforms["opacity"].value = 0.0;
        }
      } else if (frameCount % 3 === 0) {
        let bloomIntensity = 0.0; // No bloom by default
        if (bass > 0.5) {
          // Scale bloom intensity based on how much bass exceeds threshold
          bloomIntensity = (bass - 0.5) * 2.0; // Amplify the bloom on peaks
        }
        // Only update bloom if change exceeds dead zone
        if (
          Math.abs(bloomIntensity - lastUniformValues.bloom) >
          uniformDeadZones.bloom
        ) {
          bloomPass.copyUniforms["opacity"].value = bloomIntensity;
          lastUniformValues.bloom = bloomIntensity;
        }
      }

      // Screen shake on drops
      // Calculate drop states first (needed for both shake and screen shake application)
      const isInFirstDrop =
        currentTime >= firstDropTime && currentTime < firstDropShakeEndTime;
      const isInSecondDrop =
        currentTime >= secondDropTime && currentTime < secondDropShakeEndTime;

      // Kill screen shake process at 3:12 to save performance
      if (currentTime >= screenShakeKillTime) {
        if (!screenShakeKilled) {
          screenShakeKilled = true;
          screenShakeActive = false;
        }
      } else if (isInFirstDrop || isInSecondDrop) {
        // Determine if we should be shaking or in delay
        if (!screenShakeActive) {
          screenShakeActive = true;
          shakeStartTime = currentTime;
          isInShakeDelay = false;
        }

        const timeSinceShakeStart = currentTime - shakeStartTime;
        const cycleTime =
          timeSinceShakeStart % (shakeDuration + shakeDelayDuration);

        if (cycleTime < shakeDuration) {
          // In shake phase
          isInShakeDelay = false;
        } else {
          // In delay phase
          isInShakeDelay = true;
        }
      } else {
        screenShakeActive = false;
      }

      // Kill center model rendering at 3:35 to save performance
      if (currentTime >= centerModelKillTime) {
        if (!centerModelKilled) {
          centerModelKilled = true;
          // Stop all camera animation
          if (root.camera) {
            root.camera.position.copy(originalCameraPos);
            root.camera.lookAt(0, 0, 0);
          }
        }
      }
      // Camera roving - smooth circular motion that returns to origin
      // Only move camera if controls are not enabled AND audio is playing AND zoom-in is complete
      else if (
        (!root.controls || !root.controls.enabled) &&
        audioReactive &&
        audioElement &&
        !audioElement.paused &&
        hasZoomedIn // Only start roving after zoom-in completes
      ) {
        const cycleProgress = (cameraTime % cycleDuration) / cycleDuration; // 0 to 1
        const angle = cycleProgress * Math.PI * 2; // Full circle

        // Smooth easing - slow at start/end, faster in middle
        const eased = 0.5 - Math.cos(angle) * 0.5;

        // Gentle orbital movement
        const orbitRadius = 15; // How far to move from center
        const heightVariation = 8; // Vertical movement

        root.camera.position.x =
          originalCameraPos.x + Math.sin(angle) * orbitRadius * eased;
        root.camera.position.y =
          originalCameraPos.y + Math.sin(angle * 2) * heightVariation * eased;
        root.camera.position.z =
          originalCameraPos.z +
          Math.cos(angle) * 5 * eased +
          cameraZoomOutOffset; // Slight zoom in/out + zoom out offset

        // Camera look direction - tilts and pans over 128 beats
        const lookProgress =
          (cameraTime % lookCycleDuration) / lookCycleDuration; // 0 to 1
        const lookAngle = lookProgress * Math.PI * 2;

        // Create a look target that orbits around the center point - EXTREME ANGLES
        const lookOffset = 80; // Much larger offset for dramatic angle changes
        const lookTargetX = Math.sin(lookAngle) * lookOffset;
        const lookTargetY = Math.sin(lookAngle * 1.5) * lookOffset; // Full vertical tilt
        const lookTargetZ = Math.cos(lookAngle * 0.8) * lookOffset * 0.8; // Strong depth variation

        // Look at the offset target instead of dead center
        root.camera.lookAt(lookTargetX, lookTargetY, lookTargetZ);
      }

      // At 2:40:06 (160.06 seconds), start panning camera upwards and tilting (ALWAYS active after this time)
      // Kill camera pan at 3:35 to save performance
      if (currentTime >= cameraPanKillTime) {
        if (!cameraPanKilled) {
          cameraPanKilled = true;
          // Reset camera to original position
          if (root.camera) {
            root.camera.position.copy(originalCameraPos);
            root.camera.lookAt(0, 0, 0);
          }
        }
      } else if (currentTime >= upwardPanStartTime) {
        if (!upwardPanEnabled) {
          console.log("Camera pan and tilt enabled at 2:40:06");
          upwardPanEnabled = true;
        }

        const timeSincePanStart = currentTime - upwardPanStartTime;
        const upwardPanOffset = timeSincePanStart * upwardPanSpeed; // Pan upwards SUPER slow
        const tiltAmount = timeSincePanStart * upwardTiltSpeed; // Tilt upward over time

        // Move the camera position upward (increase Y position)
        root.camera.position.y = upwardPanOffset;

        // Tilt camera upward by looking at a point that moves up over time
        // Start looking at (0, 0, 0) and gradually look higher and higher
        const lookAtY = tiltAmount; // Look target moves upward
        root.camera.lookAt(0, lookAtY, 0);
      }

      // Apply CSS invert filter at second drop (2:08 / 128 seconds)
      if (currentTime >= 128 && !invertFilterApplied) {
        console.log(
          "Applying invert filter at 2:08, currentTime:",
          currentTime
        );
        console.log("threeContainer exists?", !!threeContainer);

        if (threeContainer) {
          // Apply invert + hue-rotate to keep colors looking the same
          // Hue rotation of 180deg compensates for the color inversion
          threeContainer.style.filter = "invert(100%) hue-rotate(180deg)";
          console.log("Applied filter:", threeContainer.style.filter);
        } else {
          console.error("threeContainer is NULL!");
        }

        invertFilterApplied = true;
        console.log("Inverted at 2:08");
      }

      // Apply screen shake to center model viewer during drops
      if (!isInShakeDelay && (isInFirstDrop || isInSecondDrop)) {
        const shakeOffsetX = (Math.random() - 0.5) * shakeIntensityCenter;
        const shakeOffsetY = (Math.random() - 0.5) * shakeIntensityCenter;
        threeContainer.style.transform = `translate(${shakeOffsetX}px, ${shakeOffsetY}px)`;
      } else {
        threeContainer.style.transform = "translate(0, 0)";
      }

      // Remove CSS invert filter at 2:40:06 (160.06 seconds)
      if (
        currentTime >= 160.06 &&
        invertFilterApplied &&
        !invertFilterRemoved
      ) {
        console.log(
          "Removing invert filter at 2:40:06, currentTime:",
          currentTime
        );

        if (threeContainer) {
          threeContainer.style.filter = "none";
          console.log("Removed filter");
        }

        invertFilterRemoved = true;
        console.log("Inverted back at 2:40:06");
      }

      // Apply chromatic aberration to model viewer (two phases)
      // Disabled on mobile for better performance
      if (modelViewerWrapper && !isMobile) {
        let chromaticAmount = 0;

        // Phase 1: First drop (0:31.85 to 1:03) - STOP at 1:03
        if (currentTime >= firstDropChromaticStartTime && currentTime < 63) {
          const dropProgress =
            (currentTime - firstDropChromaticStartTime) /
            (firstDropChromaticEndTime - firstDropChromaticStartTime);
          // Start at 5px, increase to 10px
          chromaticAmount =
            firstDropChromaticStartAmount +
            dropProgress *
              (firstDropChromaticMaxAmount - firstDropChromaticStartAmount);
        }
        // Fade out between 1:03 and 1:04 (63-64 seconds)
        else if (currentTime >= 63 && currentTime < 64) {
          // Calculate what the chromatic amount would be at 1:03
          const dropProgress =
            (63 - firstDropChromaticStartTime) /
            (firstDropChromaticEndTime - firstDropChromaticStartTime);
          const startAmount =
            firstDropChromaticStartAmount +
            dropProgress *
              (firstDropChromaticMaxAmount - firstDropChromaticStartAmount);

          // Now fade from that amount to 0
          const fadeProgress = (currentTime - 63) / 1.0; // Fade over 1 second
          chromaticAmount = startAmount * (1 - Math.min(1, fadeProgress));
        }
        // Phase 2: Second segment (1:50 to 2:40) - same params as first drop
        else if (currentTime >= 110 && currentTime < 160) {
          const segmentProgress = (currentTime - 110) / (160 - 110);
          chromaticAmount =
            firstDropChromaticStartAmount +
            segmentProgress *
              (firstDropChromaticMaxAmount - firstDropChromaticStartAmount);
        }
        // Fade out second segment (2:40 to 2:54) - 14 seconds
        else if (currentTime >= 160 && currentTime < 174) {
          const fadeProgress = (currentTime - 160) / 14; // Fade over 14 seconds
          chromaticAmount = firstDropChromaticMaxAmount * (1 - fadeProgress);
        }
        // Phase 3: Final section (3:12 onwards)
        else if (currentTime >= finalChromaticStartTime) {
          const songEndTime = 240; // ~4:00 (end of song)
          const chromaticProgress =
            (currentTime - finalChromaticStartTime) /
            (songEndTime - finalChromaticStartTime);
          // Clamp to 0-1
          const clampedProgress = Math.min(1, Math.max(0, chromaticProgress));
          // Exponential curve for dramatic intensification
          const intensity = Math.pow(clampedProgress, 1.5);
          chromaticAmount = intensity * finalChromaticMaxAmount;
        }

        // Extract current brightness from the filter (set by model-animations.js)
        const currentFilter = modelViewerWrapper.style.filter;
        let brightness = 1.0; // Default to full brightness
        if (currentFilter && currentFilter.includes("brightness")) {
          const match = currentFilter.match(/brightness\(([\d.]+)\)/);
          if (match) {
            brightness = parseFloat(match[1]);
          }
        }

        // Apply chromatic aberration filter combined with brightness
        if (chromaticAmount > 0) {
          const filterValue = `brightness(${brightness}) drop-shadow(${chromaticAmount}px 0px 0px rgba(255, 0, 0, 0.3)) drop-shadow(-${chromaticAmount}px 0px 0px rgba(0, 0, 255, 0.3))`;
          modelViewerWrapper.style.filter = filterValue;
        } else {
          // Let model-animations.js handle the brightness filter
          modelViewerWrapper.style.filter = `brightness(${brightness})`;
        }
      }

      // Blur triangle canvas wrapper from 2:58 to 3:35 (178s to 215s)
      let triangleBlur = 0;
      if (currentTime >= triangleBlurStart && currentTime <= triangleBlurEnd) {
        const blurProgress =
          (currentTime - triangleBlurStart) / triangleBlurDuration;
        triangleBlur = blurProgress * 15; // Blur up to 15px
      } else if (currentTime > triangleBlurEnd) {
        triangleBlur = 15; // Max blur after end
      }

      // Apply blur to wrapper (separate from invert filter on container)
      if (threeBlurWrapper) {
        threeBlurWrapper.style.filter =
          triangleBlur > 0 ? "blur(" + triangleBlur + "px)" : "none";
      }

      // Triangles canvas brightness animation (stay at 0.3 until 31.5s, then fade to 1.0 by 32.4s)
      let trianglesBrightness = trianglesStartValue;
      let trianglesOpacity = 1.0;

      // Fade out from 0:28.5 to 0:29.5
      if (
        currentTime >= trianglesFadeOutStart &&
        currentTime < trianglesFadeOutEnd
      ) {
        const fadeOutProgress =
          (currentTime - trianglesFadeOutStart) /
          (trianglesFadeOutEnd - trianglesFadeOutStart);
        trianglesBrightness = trianglesEndValue * (1 - fadeOutProgress); // Fade from 1.0 to 0.0
        trianglesOpacity = 1 - fadeOutProgress; // Fade opacity from 1.0 to 0.0
      }
      // Abruptly fade back in at 0:32
      else if (currentTime >= trianglesFadeInTime) {
        trianglesBrightness = trianglesEndValue; // Jump back to 1.0
        trianglesOpacity = 1.0; // Jump back to full opacity
      }
      // Normal brightness animation (0:15.5 to 0:27.4)
      else if (
        currentTime >= trianglesDelayStart &&
        currentTime < trianglesEndTime
      ) {
        const trianglesProgress =
          (currentTime - trianglesDelayStart) /
          (trianglesEndTime - trianglesDelayStart);
        trianglesBrightness =
          trianglesStartValue +
          (trianglesEndValue - trianglesStartValue) * trianglesProgress;
      } else if (
        currentTime >= trianglesEndTime &&
        currentTime < trianglesFadeOutStart
      ) {
        trianglesBrightness = trianglesEndValue;
      }

      // Apply brightness filter to triangles container (combine with existing filters)
      if (threeContainer) {
        const currentFilter = threeContainer.style.filter || "none";
        let filterValue = `brightness(${trianglesBrightness})`;

        // Preserve existing filters (invert, blur, etc.)
        if (currentFilter !== "none" && !currentFilter.includes("brightness")) {
          filterValue = `${filterValue} ${currentFilter}`;
        }

        threeContainer.style.filter = filterValue;
      }

      // Handle all opacity changes (early fade takes priority)
      if (threeContainer) {
        // Early fade out from 0:28.5 to 0:29.5 (takes priority)
        if (
          currentTime >= trianglesFadeOutStart &&
          currentTime < trianglesFadeOutEnd
        ) {
          threeContainer.style.opacity = trianglesOpacity;
        }
        // Keep invisible from 0:29.5 to 0:32
        else if (
          currentTime >= trianglesFadeOutEnd &&
          currentTime < trianglesFadeInTime
        ) {
          threeContainer.style.opacity = 0;
        }
        // Later fade out from 3:05 to 3:35 (185s to 215s) - check this BEFORE the fade in condition
        else if (
          currentTime >= triangleFadeOutStart &&
          currentTime <= triangleFadeOutEnd
        ) {
          const fadeProgress =
            (currentTime - triangleFadeOutStart) / triangleFadeOutDuration;
          const opacity = 1.0 - fadeProgress; // Fade from 1.0 to 0.0
          threeContainer.style.opacity = opacity;
        } else if (currentTime > triangleFadeOutEnd) {
          // Keep at 0 opacity after fade completes
          threeContainer.style.opacity = 0;
        }
        // Abruptly fade back in at 0:32 (but not if we're in the final fade out)
        else if (currentTime >= trianglesFadeInTime) {
          threeContainer.style.opacity = 1.0;
        }
      }

      // Kill THREE.js rendering after triangles fade out completes (3:35)
      if (currentTime >= triangleFadeOutEnd) {
        if (!threeRenderingKilled) {
          threeRenderingKilled = true;
          // Stop the update callback to save performance
          globalPauseState.paused = true;
          // Disable expensive post-processing passes
          bloomPass.enabled = false;
          radialBlurPass.enabled = false;
        }
      }

      // Speaker cone effect - bass-reactive pulsing
      // DISABLED FOR TESTING - checking if this is thermal culprit
      const throttleInterval = isMobile ? 0 : 2; // Disabled on mobile for testing
      if (throttleInterval > 0 && frameCount % throttleInterval === 0) {
        const speakerPush = bass * 8.0; // how much to push in/out

        // Loop through all vertices for speaker cone effect
        for (let i = 0; i < positions.length; i += 3) {
          const x = originalPositions[i];
          const y = originalPositions[i + 1];
          const z = originalPositions[i + 2];
          const distFromCenter = Math.sqrt(x * x + y * y + z * z);

          // Only affect vertices within a reasonable distance
          if (distFromCenter > 0.1) {
            const normalX = x / distFromCenter;
            const normalY = y / distFromCenter;
            const normalZ = z / distFromCenter;

            positions[i] = originalPositions[i] + normalX * speakerPush;
            positions[i + 1] = originalPositions[i + 1] + normalY * speakerPush;
            positions[i + 2] = originalPositions[i + 2] + normalZ * speakerPush;
          }
        }

        animation.geometry.attributes.position.needsUpdate = true;
      }

      // Flush all batched DOM updates at the end of the update callback
      flushDOMUpdates();
    });

    // Handle both mouse and touch events (disabled when audio is reactive)
    function handleInteraction(clientX, clientY) {
      if (globalPauseState.paused || audioReactive) return; // Don't override audio reactivity

      const px = clientX / window.innerWidth;
      const py = clientY / window.innerHeight;

      animation.material.uniforms["uD"].value = 2.0 + px * 16;
      animation.material.uniforms["uA"].value = py * 4.0;

      animation.material.uniforms["roughness"].value = px;
      animation.material.uniforms["metalness"].value = py;
    }

    root.container.addEventListener("mousemove", function (e) {
      handleInteraction(e.clientX, e.clientY);
    });

    // Touch support for mobile
    root.container.addEventListener(
      "touchmove",
      function (e) {
        e.preventDefault();
        if (e.touches.length > 0) {
          handleInteraction(e.touches[0].clientX, e.touches[0].clientY);
        }
      },
      { passive: false }
    );

    root.container.addEventListener(
      "touchstart",
      function (e) {
        e.preventDefault();
        if (e.touches.length > 0) {
          handleInteraction(e.touches[0].clientX, e.touches[0].clientY);
        }
      },
      { passive: false }
    );

    // Keyboard controls (Spacebar = pause/resume)
    // Disabled on mobile to save CPU
    if (!isMobile) {
      window.addEventListener("keydown", function (e) {
        if (e.code === "Space") {
          e.preventDefault(); // Prevent page scroll
          globalPauseState.paused = !globalPauseState.paused;

          // Pause or resume all audio tracks
          if (globalPauseState.paused) {
            // Pause all tracks
            if (audioElement) audioElement.pause();
            if (drumsElement) drumsElement.pause();
            if (instrumentsElement) instrumentsElement.pause();
            console.log("Music paused");
          } else {
            // Resume all tracks
            if (audioElement) audioElement.play();
            if (drumsElement) drumsElement.play();
            if (instrumentsElement) instrumentsElement.play();
            console.log("Music resumed");
          }
        }
      });
    }

    // dat.gui - DISABLED (library not included)
    // var g = new dat.GUI();
    // var colorProxy = {};

    // Object.defineProperty(colorProxy, "diffuse", {
    //   get: function () {
    //     return "#" + animation.material.uniforms["diffuse"].value.getHexString();
    //   },
    //   set: function (v) {
    //     animation.material.uniforms["diffuse"].value.set(v);
    //   },
    // });

    // g.addColor(colorProxy, "diffuse").name("color");
    // g.add(bloomPass.copyUniforms.opacity, "value").name("bloom str");

    // Mark Three.js as ready (for loading spinner)
    SORSARI.markThreeJSReady();
  } catch (e) {
    console.error("Error during 3D scene initialization:", e);
    console.log("Continuing without 3D visualization");
    // Still mark as ready even if there's an error, so we don't get stuck on loading screen
    SORSARI.markThreeJSReady();
  }
}

////////////////////
// CLASSES
////////////////////

function Animation(modelGeometry) {
  const geometry = new THREE.BAS.ModelBufferGeometry(modelGeometry);

  let i, j;

  const aOffsetAmplitude = geometry.createAttribute("aOffsetAmplitude", 2);
  const positionBuffer = geometry.getAttribute("position").array;
  let x, y, distance;

  for (i = 0; i < aOffsetAmplitude.array.length; i += 12) {
    // 6 * 2
    const offset = THREE.Math.randFloat(1, 4);
    const amplitude = THREE.Math.randFloat(0.5, 1.0);

    x = 0;
    y = 0;

    // x/y position of the corresponding vertex from the position buffer
    for (j = 0; j < 6; j += 2) {
      x += positionBuffer[((i + j) / 2) * 3];
      y += positionBuffer[((i + j) / 2) * 3 + 1];
    }

    x /= 3;
    y /= 3;

    distance = Math.sqrt(x * x + y * y);

    for (j = 0; j < 12; j += 2) {
      aOffsetAmplitude.array[i + j] =
        (distance + offset) * (1.0 + THREE.Math.randFloatSpread(0.0125));
      aOffsetAmplitude.array[i + j + 1] = amplitude;
    }
  }

  const aColor = geometry.createAttribute("color", 3);
  const color = new THREE.Color();

  for (i = 0; i < aColor.array.length; i += 18) {
    // 6 * 3
    color.setHSL(0, 0, THREE.Math.randFloat(0.5, 1.0));

    for (j = 0; j < 18; j += 3) {
      aColor.array[i + j] = color.r;
      aColor.array[i + j + 1] = color.g;
      aColor.array[i + j + 2] = color.b;
    }
  }

  const material = new THREE.BAS.StandardAnimationMaterial(
    {
      shading: THREE.FlatShading,
      vertexColors: THREE.VertexColors,
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uD: { value: 4.4 },
        uA: { value: 3.2 },
      },
      vertexFunctions: [THREE.BAS.ShaderChunk["ease_cubic_in_out"]],
      vertexParameters: [
        "uniform float uTime;",
        "uniform float uD;",
        "uniform float uA;",
        "attribute vec2 aOffsetAmplitude;",
      ],
      vertexPosition: [
        "float tProgress = sin(uTime + aOffsetAmplitude.x / uD);",
        "tProgress = easeCubicInOut(tProgress);",
        "transformed.z += aOffsetAmplitude.y * uA * tProgress;",
      ],
    },
    {
      diffuse: 0x362f99, // Normal purple/blue (will change to inverted at second drop)
      roughness: 0.5, // Higher roughness = less reflective/bright by default
      metalness: 0.3, // Lower metalness = darker by default, will increase on bass
      opacity: 0.8,
    }
  );

  geometry.computeVertexNormals();

  THREE.Mesh.call(this, geometry, material);

  this.frustumCulled = false;
}
Animation.prototype = Object.create(THREE.Mesh.prototype);
Animation.prototype.constructor = Animation;
Object.defineProperty(Animation.prototype, "time", {
  get: function () {
    return this.material.uniforms["uTime"].value;
  },
  set: function (v) {
    this.material.uniforms["uTime"].value = v;
  },
});

//// ROOT

function THREERoot(params) {
  // defaults
  params = utils.extend(
    {
      container: "#three-container",
      fov: 60,
      zNear: 1,
      zFar: 10000,
      createCameraControls: true,
      autoStart: true,
      pixelRatio: Math.min(window.devicePixelRatio, 1.25), // Cap at 1.25 for better performance
    },
    params
  );

  // maps and arrays
  this.updateCallbacks = [];
  this.resizeCallbacks = [];
  this.objects = {};

  // renderer - with fallback for WebGL failures
  let rendererCreated = false;
  try {
    this.renderer = new THREE.WebGLRenderer({
      antialias: params.antialias,
      alpha: true, // Enable transparency
      powerPreference: "high-performance", // Request high-performance GPU
      failIfMajorPerformanceCaveat: false, // Don't fail on performance issues
    });
    rendererCreated = true;
  } catch (e) {
    console.error("WebGL renderer creation failed:", e);
    // Try with minimal settings
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: true,
        powerPreference: "low-power",
      });
      rendererCreated = true;
      console.warn("WebGL renderer created with fallback settings");
    } catch (e2) {
      console.error("WebGL renderer creation failed even with fallback:", e2);
      // Create a canvas fallback
      this.renderer = {
        domElement: document.createElement("canvas"),
        setPixelRatio: function () {},
        setClearColor: function () {},
        setSize: function () {},
        render: function () {},
        getSize: function () {
          return { width: window.innerWidth, height: window.innerHeight };
        },
        getPixelRatio: function () {
          return 1;
        },
      };
      console.warn("Using canvas fallback instead of WebGL");
    }
  }

  if (!rendererCreated) {
    console.warn("WebGL not available - using fallback renderer");
  }

  // Half-resolution rendering for pixelated effect (50% of normal resolution)
  // This reduces pixel count by 75% for massive performance gain
  this.renderer.setPixelRatio(params.pixelRatio * 0.5);

  // container
  this.container =
    typeof params.container === "string"
      ? document.querySelector(params.container)
      : params.container;
  this.container.appendChild(this.renderer.domElement);

  // camera
  this.camera = new THREE.PerspectiveCamera(
    params.fov,
    window.innerWidth / window.innerHeight,
    params.zNear,
    params.zFar
  );

  // scene
  this.scene = new THREE.Scene();

  // resize handling
  this.resize = this.resize.bind(this);
  this.resize();
  window.addEventListener("resize", this.resize, false);

  // tick / update / render
  this.tick = this.tick.bind(this);
  params.autoStart && this.tick();

  // optional camera controls
  params.createCameraControls && this.createOrbitControls();
}
THREERoot.prototype = {
  createOrbitControls: function () {
    // Check if OrbitControls is available
    if (typeof THREE.OrbitControls === "undefined") {
      console.warn(
        "OrbitControls not loaded. Please include the OrbitControls library."
      );
      return;
    }
    this.controls = new THREE.OrbitControls(
      this.camera,
      this.renderer.domElement
    );
    this.addUpdateCallback(this.controls.update.bind(this.controls));
  },
  start: function () {
    this.tick();
  },
  addUpdateCallback: function (callback) {
    this.updateCallbacks.push(callback);
  },
  addResizeCallback: function (callback) {
    this.resizeCallbacks.push(callback);
  },
  add: function (object, key) {
    key && (this.objects[key] = object);
    this.scene.add(object);
  },
  addTo: function (object, parentKey, key) {
    key && (this.objects[key] = object);
    this.get(parentKey).add(object);
  },
  get: function (key) {
    return this.objects[key];
  },
  remove: function (o) {
    let object;

    if (typeof o === "string") {
      object = this.objects[o];
    } else {
      object = o;
    }

    if (object) {
      object.parent.remove(object);
      delete this.objects[o];
    }
  },
  tick: function () {
    const frameStartTime = performance.now();

    // Use adaptive FPS scale on mobile, CONFIG.fpsScale on desktop
    const currentFpsScale = isMobile ? adaptiveFpsScale : CONFIG.fpsScale;
    const frameSkipInterval = Math.max(1, Math.round(1 / currentFpsScale));
    reducedFrameCounter++;

    // Page visibility optimization - reduce rendering when tab is hidden
    if (!isPageVisible) {
      // Only render every 10th frame when page is hidden (6fps instead of 60fps)
      if (reducedFrameCounter % 10 !== 0) {
        requestAnimationFrame(this.tick);
        return;
      }
    } else if (
      frameSkipInterval > 1 &&
      reducedFrameCounter % frameSkipInterval !== 0
    ) {
      // Skip frames based on FPS scale when page is visible
      requestAnimationFrame(this.tick);
      return;
    }

    // Update callback throttling - separate from render throttling
    // On mobile, use adaptive FPS scale; on desktop, use full 60fps
    const updateFpsScale = isMobile ? adaptiveFpsScale : 1.0;
    const updateFrameSkipInterval = Math.max(1, Math.round(1 / updateFpsScale));
    if (reducedFrameCounter % updateFrameSkipInterval === 0) {
      this.update();
    }

    // Three.js canvas rendering - can be throttled separately on mobile
    const trianglesFpsScale = isMobile ? adaptiveFpsScale : 1.0;
    const trianglesFrameSkipInterval = Math.max(
      1,
      Math.round(1 / trianglesFpsScale)
    );
    if (reducedFrameCounter % trianglesFrameSkipInterval === 0) {
      this.render();
    }

    // Measure frame time and adjust FPS scale on mobile
    const frameEndTime = performance.now();
    const frameTime = frameEndTime - frameStartTime;

    // Update debug display with frame time
    if (window.updateFrameTime) {
      window.updateFrameTime(frameTime);
    }

    // Check for low-power failsafe conditions
    if (!lowPowerFailsafeActive) {
      // Check static conditions (data saver, battery)
      if (checkLowPowerConditions()) {
        triggerLowPowerFailsafe();
      }

      // Monitor FPS drops on mobile
      if (isMobile) {
        const currentFPS = 1000 / frameTime;
        if (monitorFPSForFailsafe(currentFPS)) {
          triggerLowPowerFailsafe();
        }
      }
    }

    if (isMobile) {
      frameTimeHistory.push(frameTime);

      // Keep history size constant
      if (frameTimeHistory.length > frameTimeHistorySize) {
        frameTimeHistory.shift();
      }

      // Only adjust FPS if we have enough history
      if (frameTimeHistory.length === frameTimeHistorySize) {
        const avgFrameTime =
          frameTimeHistory.reduce((a, b) => a + b, 0) / frameTimeHistorySize;

        // Aggressive throttling if frame time is high
        if (avgFrameTime > frameTimeThresholdHigh) {
          adaptiveFpsScale = Math.max(
            minFpsScale,
            adaptiveFpsScale * throttleDownFactor
          );
          // console.log(
          //   `[Thermal Throttle] Frame time ${avgFrameTime.toFixed(
          //     1
          //   )}ms > ${frameTimeThresholdHigh}ms. FPS Scale: ${adaptiveFpsScale.toFixed(
          //     2
          //   )}`
          // );
        }
        // Gradually recover if frame time is low
        else if (avgFrameTime < frameTimeThresholdLow) {
          adaptiveFpsScale = Math.min(
            maxFpsScale,
            adaptiveFpsScale * throttleUpFactor
          );
          // console.log(
          //   `[Thermal Recover] Frame time ${avgFrameTime.toFixed(
          //     1
          //   )}ms < ${frameTimeThresholdLow}ms. FPS Scale: ${adaptiveFpsScale.toFixed(
          //     2
          //   )}`
          // );
        }
      }
    }

    requestAnimationFrame(this.tick);
  },
  update: function () {
    this.updateCallbacks.forEach(function (callback) {
      callback();
    });
  },
  render: function () {
    this.renderer.render(this.scene, this.camera);
  },
  resize: function () {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.resizeCallbacks.forEach(function (callback) {
      callback();
    });
  },
  initPostProcessing: function (passes) {
    const size = this.renderer.getSize();
    const pixelRatio = this.renderer.getPixelRatio();
    size.width *= pixelRatio;
    size.height *= pixelRatio;

    const composer = (this.composer = new THREE.EffectComposer(
      this.renderer,
      new THREE.WebGLRenderTarget(size.width, size.height, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        stencilBuffer: false,
      })
    ));

    const renderPass = new THREE.RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    for (let i = 0; i < passes.length; i++) {
      const pass = passes[i];
      pass.renderToScreen = i === passes.length - 1;
      this.composer.addPass(pass);
    }

    this.renderer.autoClear = false;
    this.render = function () {
      this.renderer.clear();
      this.composer.render();
    }.bind(this);

    this.addResizeCallback(
      function () {
        const width = window.innerWidth;
        const height = window.innerHeight;

        composer.setSize(width * pixelRatio, height * pixelRatio);
      }.bind(this)
    );
  },
};

//// UTILS

const utils = {
  extend: function (dst, src) {
    for (const key in src) {
      dst[key] = src[key];
    }

    return dst;
  },
  randSign: function () {
    return Math.random() > 0.5 ? 1 : -1;
  },
  ease: function (ease, t, b, c, d) {
    return b + ease.getRatio(t / d) * c;
  },
};

//// BAS

THREE.BAS = {};

THREE.BAS.ShaderChunk = {};

THREE.BAS.ShaderChunk["catmull-rom"] =
  "vec3 catmullRom(vec3 p0, vec3 p1, vec3 p2, vec3 p3, float t)\n{\n    vec3 v0 = (p2 - p0) * 0.5;\n    vec3 v1 = (p3 - p1) * 0.5;\n    float t2 = t * t;\n    float t3 = t * t * t;\n\n    return vec3((2.0 * p1 - 2.0 * p2 + v0 + v1) * t3 + (-3.0 * p1 + 3.0 * p2 - 2.0 * v0 - v1) * t2 + v0 * t + p1);\n}\n\nvec3 catmullRom(vec3 p0, vec3 p1, vec3 p2, vec3 p3, vec2 c, float t)\n{\n    vec3 v0 = (p2 - p0) * c.x;\n    vec3 v1 = (p3 - p1) * c.y;\n    float t2 = t * t;\n    float t3 = t * t * t;\n\n    return vec3((2.0 * p1 - 2.0 * p2 + v0 + v1) * t3 + (-3.0 * p1 + 3.0 * p2 - 2.0 * v0 - v1) * t2 + v0 * t + p1);\n}\n\nfloat catmullRom(float p0, float p1, float p2, float p3, float t)\n{\n    float v0 = (p2 - p0) * 0.5;\n    float v1 = (p3 - p1) * 0.5;\n    float t2 = t * t;\n    float t3 = t * t * t;\n\n    return float((2.0 * p1 - 2.0 * p2 + v0 + v1) * t3 + (-3.0 * p1 + 3.0 * p2 - 2.0 * v0 - v1) * t2 + v0 * t + p1);\n}\n\nfloat catmullRom(float p0, float p1, float p2, float p3, vec2 c, float t)\n{\n    float v0 = (p2 - p0) * c.x;\n    float v1 = (p3 - p1) * c.y;\n    float t2 = t * t;\n    float t3 = t * t * t;\n\n    return float((2.0 * p1 - 2.0 * p2 + v0 + v1) * t3 + (-3.0 * p1 + 3.0 * p2 - 2.0 * v0 - v1) * t2 + v0 * t + p1);\n}\n";

THREE.BAS.ShaderChunk["cubic_bezier"] =
  "vec3 cubicBezier(vec3 p0, vec3 c0, vec3 c1, vec3 p1, float t) {\n    float tn = 1.0 - t;\n\n    return tn * tn * tn * p0 + 3.0 * tn * tn * t * c0 + 3.0 * tn * t * t * c1 + t * t * t * p1;\n}\n\nvec2 cubicBezier(vec2 p0, vec2 c0, vec2 c1, vec2 p1, float t) {\n    float tn = 1.0 - t;\n\n    return tn * tn * tn * p0 + 3.0 * tn * tn * t * c0 + 3.0 * tn * t * t * c1 + t * t * t * p1;\n}\n";

THREE.BAS.ShaderChunk["ease_back_in"] =
  "float easeBackIn(float p, float amplitude) {\n    return p * p * ((amplitude + 1.0) * p - amplitude);\n}\n\nfloat easeBackIn(float p) {\n    return easeBackIn(p, 1.70158);\n}\n\nfloat easeBackIn(float t, float b, float c, float d, float amplitude) {\n    return b + easeBackIn(t / d, amplitude) * c;\n}\n\nfloat easeBackIn(float t, float b, float c, float d) {\n    return b + easeBackIn(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_back_in_out"] =
  "float easeBackInOut(float p, float amplitude) {\n    amplitude *= 1.525;\n\n    return ((p *= 2.0) < 1.0) ? 0.5 * p * p * ((amplitude + 1.0) * p - amplitude) : 0.5 * ((p -= 2.0) * p * ((amplitude + 1.0) * p + amplitude) + 2.0);\n}\n\nfloat easeBackInOut(float p) {\n    return easeBackInOut(p, 1.70158);\n}\n\nfloat easeBackInOut(float t, float b, float c, float d, float amplitude) {\n    return b + easeBackInOut(t / d, amplitude) * c;\n}\n\nfloat easeBackInOut(float t, float b, float c, float d) {\n    return b + easeBackInOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_back_out"] =
  "float easeBackOut(float p, float amplitude) {\n    return ((p = p - 1.0) * p * ((amplitude + 1.0) * p + amplitude) + 1.0);\n}\n\nfloat easeBackOut(float p) {\n    return easeBackOut(p, 1.70158);\n}\n\nfloat easeBackOut(float t, float b, float c, float d, float amplitude) {\n    return b + easeBackOut(t / d, amplitude) * c;\n}\n\nfloat easeBackOut(float t, float b, float c, float d) {\n    return b + easeBackOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_bezier"] =
  "float easeBezier(float p, vec4 curve) {\n    float ip = 1.0 - p;\n    return (3.0 * ip * ip * p * curve.xy + 3.0 * ip * p * p * curve.zw + p * p * p).y;\n}\n\nfloat easeBezier(float t, float b, float c, float d, vec4 curve) {\n    return b + easeBezier(t / d, curve) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_bounce_in"] =
  "float easeBounceIn(float p) {\n    if ((p = 1.0 - p) < 1.0 / 2.75) {\n        return 1.0 - (7.5625 * p * p);\n    } else if (p < 2.0 / 2.75) {\n        return 1.0 - (7.5625 * (p -= 1.5 / 2.75) * p + 0.75);\n    } else if (p < 2.5 / 2.75) {\n        return 1.0 - (7.5625 * (p -= 2.25 / 2.75) * p + 0.9375);\n    }\n    return 1.0 - (7.5625 * (p -= 2.625 / 2.75) * p + 0.984375);\n}\n\nfloat easeBounceIn(float t, float b, float c, float d) {\n    return b + easeBounceIn(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_bounce_in_out"] =
  "float easeBounceInOut(float p) {\n    bool invert = (p < 0.5);\n\n    p = invert ? (1.0 - (p * 2.0)) : ((p * 2.0) - 1.0);\n\n    if (p < 1.0 / 2.75) {\n        p = 7.5625 * p * p;\n    } else if (p < 2.0 / 2.75) {\n        p = 7.5625 * (p -= 1.5 / 2.75) * p + 0.75;\n    } else if (p < 2.5 / 2.75) {\n        p = 7.5625 * (p -= 2.25 / 2.75) * p + 0.9375;\n    } else {\n        p = 7.5625 * (p -= 2.625 / 2.75) * p + 0.984375;\n    }\n\n    return invert ? (1.0 - p) * 0.5 : p * 0.5 + 0.5;\n}\n\nfloat easeBounceInOut(float t, float b, float c, float d) {\n    return b + easeBounceInOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_bounce_out"] =
  "float easeBounceOut(float p) {\n    if (p < 1.0 / 2.75) {\n        return 7.5625 * p * p;\n    } else if (p < 2.0 / 2.75) {\n        return 7.5625 * (p -= 1.5 / 2.75) * p + 0.75;\n    } else if (p < 2.5 / 2.75) {\n        return 7.5625 * (p -= 2.25 / 2.75) * p + 0.9375;\n    }\n    return 7.5625 * (p -= 2.625 / 2.75) * p + 0.984375;\n}\n\nfloat easeBounceOut(float t, float b, float c, float d) {\n    return b + easeBounceOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_circ_in"] =
  "float easeCircIn(float p) {\n    return -(sqrt(1.0 - p * p) - 1.0);\n}\n\nfloat easeCircIn(float t, float b, float c, float d) {\n    return b + easeCircIn(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_circ_in_out"] =
  "float easeCircInOut(float p) {\n    return ((p *= 2.0) < 1.0) ? -0.5 * (sqrt(1.0 - p * p) - 1.0) : 0.5 * (sqrt(1.0 - (p -= 2.0) * p) + 1.0);\n}\n\nfloat easeCircInOut(float t, float b, float c, float d) {\n    return b + easeCircInOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_circ_out"] =
  "float easeCircOut(float p) {\n  return sqrt(1.0 - (p = p - 1.0) * p);\n}\n\nfloat easeCircOut(float t, float b, float c, float d) {\n  return b + easeCircOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_cubic_in"] =
  "float easeCubicIn(float t) {\n  return t * t * t;\n}\n\nfloat easeCubicIn(float t, float b, float c, float d) {\n  return b + easeCubicIn(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_cubic_in_out"] =
  "float easeCubicInOut(float t) {\n  return (t /= 0.5) < 1.0 ? 0.5 * t * t * t : 0.5 * ((t-=2.0) * t * t + 2.0);\n}\n\nfloat easeCubicInOut(float t, float b, float c, float d) {\n  return b + easeCubicInOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_cubic_out"] =
  "float easeCubicOut(float t) {\n  float f = t - 1.0;\n  return f * f * f + 1.0;\n}\n\nfloat easeCubicOut(float t, float b, float c, float d) {\n  return b + easeCubicOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_elastic_in"] =
  "float easeElasticIn(float p, float amplitude, float period) {\n    float p1 = max(amplitude, 1.0);\n    float p2 = period / min(amplitude, 1.0);\n    float p3 = p2 / PI2 * (asin(1.0 / p1));\n\n    return -(p1 * pow(2.0, 10.0 * (p -= 1.0)) * sin((p - p3) * PI2 / p2));\n}\n\nfloat easeElasticIn(float p) {\n    return easeElasticIn(p, 1.0, 0.3);\n}\n\nfloat easeElasticIn(float t, float b, float c, float d, float amplitude, float period) {\n    return b + easeElasticIn(t / d, amplitude, period) * c;\n}\n\nfloat easeElasticIn(float t, float b, float c, float d) {\n    return b + easeElasticIn(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_elastic_in_out"] =
  "float easeElasticInOut(float p, float amplitude, float period) {\n    float p1 = max(amplitude, 1.0);\n    float p2 = period / min(amplitude, 1.0);\n    float p3 = p2 / PI2 * (asin(1.0 / p1));\n\n    return ((p *= 2.0) < 1.0) ? -0.5 * (p1 * pow(2.0, 10.0 * (p -= 1.0)) * sin((p - p3) * PI2 / p2)) : p1 * pow(2.0, -10.0 * (p -= 1.0)) * sin((p - p3) * PI2 / p2) * 0.5 + 1.0;\n}\n\nfloat easeElasticInOut(float p) {\n    return easeElasticInOut(p, 1.0, 0.3);\n}\n\nfloat easeElasticInOut(float t, float b, float c, float d, float amplitude, float period) {\n    return b + easeElasticInOut(t / d, amplitude, period) * c;\n}\n\nfloat easeElasticInOut(float t, float b, float c, float d) {\n    return b + easeElasticInOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_elastic_out"] =
  "float easeElasticOut(float p, float amplitude, float period) {\n    float p1 = max(amplitude, 1.0);\n    float p2 = period / min(amplitude, 1.0);\n    float p3 = p2 / PI2 * (asin(1.0 / p1));\n\n    return p1 * pow(2.0, -10.0 * p) * sin((p - p3) * PI2 / p2) + 1.0;\n}\n\nfloat easeElasticOut(float p) {\n    return easeElasticOut(p, 1.0, 0.3);\n}\n\nfloat easeElasticOut(float t, float b, float c, float d, float amplitude, float period) {\n    return b + easeElasticOut(t / d, amplitude, period) * c;\n}\n\nfloat easeElasticOut(float t, float b, float c, float d) {\n    return b + easeElasticOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_expo_in"] =
  "float easeExpoIn(float p) {\n    return pow(2.0, 10.0 * (p - 1.0));\n}\n\nfloat easeExpoIn(float t, float b, float c, float d) {\n    return b + easeExpoIn(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_expo_in_out"] =
  "float easeExpoInOut(float p) {\n    return ((p *= 2.0) < 1.0) ? 0.5 * pow(2.0, 10.0 * (p - 1.0)) : 0.5 * (2.0 - pow(2.0, -10.0 * (p - 1.0)));\n}\n\nfloat easeExpoInOut(float t, float b, float c, float d) {\n    return b + easeExpoInOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_expo_out"] =
  "float easeExpoOut(float p) {\n  return 1.0 - pow(2.0, -10.0 * p);\n}\n\nfloat easeExpoOut(float t, float b, float c, float d) {\n  return b + easeExpoOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_quad_in"] =
  "float easeQuadIn(float t) {\n    return t * t;\n}\n\nfloat easeQuadIn(float t, float b, float c, float d) {\n  return b + easeQuadIn(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_quad_in_out"] =
  "float easeQuadInOut(float t) {\n    float p = 2.0 * t * t;\n    return t < 0.5 ? p : -p + (4.0 * t) - 1.0;\n}\n\nfloat easeQuadInOut(float t, float b, float c, float d) {\n    return b + easeQuadInOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_quad_out"] =
  "float easeQuadOut(float t) {\n  return -t * (t - 2.0);\n}\n\nfloat easeQuadOut(float t, float b, float c, float d) {\n  return b + easeQuadOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_quart_in"] =
  "float easeQuartIn(float t) {\n  return t * t * t * t;\n}\n\nfloat easeQuartIn(float t, float b, float c, float d) {\n  return b + easeQuartIn(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_quart_in_out"] =
  "float easeQuartInOut(float t) {\n    return t < 0.5 ? 8.0 * pow(t, 4.0) : -8.0 * pow(t - 1.0, 4.0) + 1.0;\n}\n\nfloat easeQuartInOut(float t, float b, float c, float d) {\n    return b + easeQuartInOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_quart_out"] =
  "float easeQuartOut(float t) {\n  return 1.0 - pow(1.0 - t, 4.0);\n}\n\nfloat easeQuartOut(float t, float b, float c, float d) {\n  return b + easeQuartOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_quint_in"] =
  "float easeQuintIn(float t) {\n    return pow(t, 5.0);\n}\n\nfloat easeQuintIn(float t, float b, float c, float d) {\n    return b + easeQuintIn(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_quint_in_out"] =
  "float easeQuintInOut(float t) {\n    return (t /= 0.5) < 1.0 ? 0.5 * t * t * t * t * t : 0.5 * ((t -= 2.0) * t * t * t * t + 2.0);\n}\n\nfloat easeQuintInOut(float t, float b, float c, float d) {\n    return b + easeQuintInOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_quint_out"] =
  "float easeQuintOut(float t) {\n    return (t -= 1.0) * t * t * t * t + 1.0;\n}\n\nfloat easeQuintOut(float t, float b, float c, float d) {\n    return b + easeQuintOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_sine_in"] =
  "float easeSineIn(float p) {\n  return -cos(p * 1.57079632679) + 1.0;\n}\n\nfloat easeSineIn(float t, float b, float c, float d) {\n  return b + easeSineIn(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_sine_in_out"] =
  "float easeSineInOut(float p) {\n  return -0.5 * (cos(PI * p) - 1.0);\n}\n\nfloat easeSineInOut(float t, float b, float c, float d) {\n  return b + easeSineInOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_sine_out"] =
  "float easeSineOut(float p) {\n  return sin(p * 1.57079632679);\n}\n\nfloat easeSineOut(float t, float b, float c, float d) {\n  return b + easeSineOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["quaternion_rotation"] =
  "vec3 rotateVector(vec4 q, vec3 v)\n{\n    return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);\n}\n\nvec4 quatFromAxisAngle(vec3 axis, float angle)\n{\n    float halfAngle = angle * 0.5;\n    return vec4(axis.xyz * sin(halfAngle), cos(halfAngle));\n}\n";

THREE.BAS.Utils = {
  separateFaces: function (geometry) {
    var vertices = [];

    for (var i = 0, il = geometry.faces.length; i < il; i++) {
      var n = vertices.length;

      var face = geometry.faces[i];

      var a = face.a;
      var b = face.b;
      var c = face.c;

      var va = geometry.vertices[a];
      var vb = geometry.vertices[b];
      var vc = geometry.vertices[c];

      vertices.push(va.clone());
      vertices.push(vb.clone());
      vertices.push(vc.clone());

      face.a = n;
      face.b = n + 1;
      face.c = n + 2;
    }

    geometry.vertices = vertices;
    delete geometry.__tmpVertices;
  },
  tessellate: function (geometry, maxEdgeLength) {
    var edge;

    var faces = [];
    var faceVertexUvs = [];
    var maxEdgeLengthSquared = maxEdgeLength * maxEdgeLength;

    for (var i = 0, il = geometry.faceVertexUvs.length; i < il; i++) {
      faceVertexUvs[i] = [];
    }

    for (var i = 0, il = geometry.faces.length; i < il; i++) {
      var face = geometry.faces[i];

      if (face instanceof THREE.Face3) {
        var a = face.a;
        var b = face.b;
        var c = face.c;

        var va = geometry.vertices[a];
        var vb = geometry.vertices[b];
        var vc = geometry.vertices[c];

        var dab = va.distanceToSquared(vb);
        var dbc = vb.distanceToSquared(vc);
        var dac = va.distanceToSquared(vc);

        if (
          dab > maxEdgeLengthSquared ||
          dbc > maxEdgeLengthSquared ||
          dac > maxEdgeLengthSquared
        ) {
          var m = geometry.vertices.length;

          var triA = face.clone();
          var triB = face.clone();

          if (dab >= dbc && dab >= dac) {
            var vm = va.clone();
            vm.lerp(vb, 0.5);

            triA.a = a;
            triA.b = m;
            triA.c = c;

            triB.a = m;
            triB.b = b;
            triB.c = c;

            if (face.vertexNormals.length === 3) {
              var vnm = face.vertexNormals[0].clone();
              vnm.lerp(face.vertexNormals[1], 0.5);

              triA.vertexNormals[1].copy(vnm);
              triB.vertexNormals[0].copy(vnm);
            }

            if (face.vertexColors.length === 3) {
              var vcm = face.vertexColors[0].clone();
              vcm.lerp(face.vertexColors[1], 0.5);

              triA.vertexColors[1].copy(vcm);
              triB.vertexColors[0].copy(vcm);
            }

            edge = 0;
          } else if (dbc >= dab && dbc >= dac) {
            var vm = vb.clone();
            vm.lerp(vc, 0.5);

            triA.a = a;
            triA.b = b;
            triA.c = m;

            triB.a = m;
            triB.b = c;
            triB.c = a;

            if (face.vertexNormals.length === 3) {
              var vnm = face.vertexNormals[1].clone();
              vnm.lerp(face.vertexNormals[2], 0.5);

              triA.vertexNormals[2].copy(vnm);

              triB.vertexNormals[0].copy(vnm);
              triB.vertexNormals[1].copy(face.vertexNormals[2]);
              triB.vertexNormals[2].copy(face.vertexNormals[0]);
            }

            if (face.vertexColors.length === 3) {
              var vcm = face.vertexColors[1].clone();
              vcm.lerp(face.vertexColors[2], 0.5);

              triA.vertexColors[2].copy(vcm);

              triB.vertexColors[0].copy(vcm);
              triB.vertexColors[1].copy(face.vertexColors[2]);
              triB.vertexColors[2].copy(face.vertexColors[0]);
            }

            edge = 1;
          } else {
            var vm = va.clone();
            vm.lerp(vc, 0.5);

            triA.a = a;
            triA.b = b;
            triA.c = m;

            triB.a = m;
            triB.b = b;
            triB.c = c;

            if (face.vertexNormals.length === 3) {
              var vnm = face.vertexNormals[0].clone();
              vnm.lerp(face.vertexNormals[2], 0.5);

              triA.vertexNormals[2].copy(vnm);
              triB.vertexNormals[0].copy(vnm);
            }

            if (face.vertexColors.length === 3) {
              var vcm = face.vertexColors[0].clone();
              vcm.lerp(face.vertexColors[2], 0.5);

              triA.vertexColors[2].copy(vcm);
              triB.vertexColors[0].copy(vcm);
            }

            edge = 2;
          }

          faces.push(triA, triB);
          geometry.vertices.push(vm);

          for (var j = 0, jl = geometry.faceVertexUvs.length; j < jl; j++) {
            if (geometry.faceVertexUvs[j].length) {
              var uvs = geometry.faceVertexUvs[j][i];

              var uvA = uvs[0];
              var uvB = uvs[1];
              var uvC = uvs[2];

              // AB

              if (edge === 0) {
                var uvM = uvA.clone();
                uvM.lerp(uvB, 0.5);

                var uvsTriA = [uvA.clone(), uvM.clone(), uvC.clone()];
                var uvsTriB = [uvM.clone(), uvB.clone(), uvC.clone()];

                // BC
              } else if (edge === 1) {
                var uvM = uvB.clone();
                uvM.lerp(uvC, 0.5);

                var uvsTriA = [uvA.clone(), uvB.clone(), uvM.clone()];
                var uvsTriB = [uvM.clone(), uvC.clone(), uvA.clone()];

                // AC
              } else {
                var uvM = uvA.clone();
                uvM.lerp(uvC, 0.5);

                var uvsTriA = [uvA.clone(), uvB.clone(), uvM.clone()];
                var uvsTriB = [uvM.clone(), uvB.clone(), uvC.clone()];
              }

              faceVertexUvs[j].push(uvsTriA, uvsTriB);
            }
          }
        } else {
          faces.push(face);

          for (var j = 0, jl = geometry.faceVertexUvs.length; j < jl; j++) {
            faceVertexUvs[j].push(geometry.faceVertexUvs[j][i]);
          }
        }
      }
    }

    geometry.faces = faces;
    geometry.faceVertexUvs = faceVertexUvs;
  },
  tessellateRepeat: function (geometry, maxEdgeLength, times) {
    for (var i = 0; i < times; i++) {
      THREE.BAS.Utils.tessellate(geometry, maxEdgeLength);
    }
  },
  subdivide: function (geometry, subdivisions) {
    var WARNINGS = !true; // Set to true for development
    var ABC = ["a", "b", "c"];

    while (subdivisions-- > 0) {
      smooth(geometry);
    }

    delete geometry.__tmpVertices;
    geometry.computeFaceNormals();
    geometry.computeVertexNormals();

    function getEdge(a, b, map) {
      var vertexIndexA = Math.min(a, b);
      var vertexIndexB = Math.max(a, b);

      var key = vertexIndexA + "_" + vertexIndexB;

      return map[key];
    }

    function processEdge(a, b, vertices, map, face, metaVertices) {
      var vertexIndexA = Math.min(a, b);
      var vertexIndexB = Math.max(a, b);

      var key = vertexIndexA + "_" + vertexIndexB;

      var edge;

      if (key in map) {
        edge = map[key];
      } else {
        var vertexA = vertices[vertexIndexA];
        var vertexB = vertices[vertexIndexB];

        edge = {
          a: vertexA, // pointer reference
          b: vertexB,
          newEdge: null,
          // aIndex: a, // numbered reference
          // bIndex: b,
          faces: [], // pointers to face
        };

        map[key] = edge;
      }

      edge.faces.push(face);

      metaVertices[a].edges.push(edge);
      metaVertices[b].edges.push(edge);
    }

    function generateLookups(vertices, faces, metaVertices, edges) {
      var i, il, face, edge;

      for (i = 0, il = vertices.length; i < il; i++) {
        metaVertices[i] = { edges: [] };
      }

      for (i = 0, il = faces.length; i < il; i++) {
        face = faces[i];

        processEdge(face.a, face.b, vertices, edges, face, metaVertices);
        processEdge(face.b, face.c, vertices, edges, face, metaVertices);
        processEdge(face.c, face.a, vertices, edges, face, metaVertices);
      }
    }

    function newFace(newFaces, a, b, c) {
      newFaces.push(new THREE.Face3(a, b, c));
    }

    /////////////////////////////

    // Performs one iteration of Subdivision
    function smooth(geometry) {
      var tmp = new THREE.Vector3();

      var oldVertices, oldFaces;
      var newVertices, newFaces; // newUVs = [];

      var n, l, i, il, j, k;
      var metaVertices, sourceEdges;

      // new stuff.
      var sourceEdges, newEdgeVertices, newSourceVertices;

      oldVertices = geometry.vertices; // { x, y, z}
      oldFaces = geometry.faces; // { a: oldVertex1, b: oldVertex2, c: oldVertex3 }

      /******************************************************
       *
       * Step 0: Preprocess Geometry to Generate edges Lookup
       *
       *******************************************************/

      metaVertices = new Array(oldVertices.length);
      sourceEdges = {}; // Edge => { oldVertex1, oldVertex2, faces[]  }

      generateLookups(oldVertices, oldFaces, metaVertices, sourceEdges);

      /******************************************************
       *
       *  Step 1.
       *  For each edge, create a new Edge Vertex,
       *  then position it.
       *
       *******************************************************/

      newEdgeVertices = [];
      var other, currentEdge, newEdge, face;
      var edgeVertexWeight, adjacentVertexWeight, connectedFaces;

      for (i in sourceEdges) {
        currentEdge = sourceEdges[i];
        newEdge = new THREE.Vector3();

        edgeVertexWeight = 3 / 8;
        adjacentVertexWeight = 1 / 8;

        connectedFaces = currentEdge.faces.length;

        // check how many linked faces. 2 should be correct.
        if (connectedFaces != 2) {
          // if length is not 2, handle condition
          edgeVertexWeight = 0.5;
          adjacentVertexWeight = 0;

          if (connectedFaces != 1) {
            if (WARNINGS)
              console.warn(
                "Subdivision Modifier: Number of connected faces != 2, is: ",
                connectedFaces,
                currentEdge
              );
          }
        }

        newEdge
          .addVectors(currentEdge.a, currentEdge.b)
          .multiplyScalar(edgeVertexWeight);

        tmp.set(0, 0, 0);

        for (j = 0; j < connectedFaces; j++) {
          face = currentEdge.faces[j];

          for (k = 0; k < 3; k++) {
            other = oldVertices[face[ABC[k]]];
            if (other !== currentEdge.a && other !== currentEdge.b) break;
          }

          tmp.add(other);
        }

        tmp.multiplyScalar(adjacentVertexWeight);
        newEdge.add(tmp);

        currentEdge.newEdge = newEdgeVertices.length;
        newEdgeVertices.push(newEdge);

        // console.log(currentEdge, newEdge);
      }

      /******************************************************
       *
       *  Step 2.
       *  Reposition each source vertices.
       *
       *******************************************************/

      var beta, sourceVertexWeight, connectingVertexWeight;
      var connectingEdge, connectingEdges, oldVertex, newSourceVertex;
      newSourceVertices = [];

      for (i = 0, il = oldVertices.length; i < il; i++) {
        oldVertex = oldVertices[i];

        // find all connecting edges (using lookupTable)
        connectingEdges = metaVertices[i].edges;
        n = connectingEdges.length;
        beta;

        if (n == 3) {
          beta = 3 / 16;
        } else if (n > 3) {
          beta = 3 / (8 * n); // Warren's modified formula
        }

        // Loop's original beta formula
        // beta = 1 / n * ( 5/8 - Math.pow( 3/8 + 1/4 * Math.cos( 2 * Math. PI / n ), 2) );

        sourceVertexWeight = 1 - n * beta;
        connectingVertexWeight = beta;

        if (n <= 2) {
          // crease and boundary rules
          // console.warn('crease and boundary rules');

          if (n == 2) {
            if (WARNINGS) console.warn("2 connecting edges", connectingEdges);
            sourceVertexWeight = 3 / 4;
            connectingVertexWeight = 1 / 8;

            // sourceVertexWeight = 1;
            // connectingVertexWeight = 0;
          } else if (n == 1) {
            if (WARNINGS) console.warn("only 1 connecting edge");
          } else if (n == 0) {
            if (WARNINGS) console.warn("0 connecting edges");
          }
        }

        newSourceVertex = oldVertex.clone().multiplyScalar(sourceVertexWeight);

        tmp.set(0, 0, 0);

        for (j = 0; j < n; j++) {
          connectingEdge = connectingEdges[j];
          other =
            connectingEdge.a !== oldVertex
              ? connectingEdge.a
              : connectingEdge.b;
          tmp.add(other);
        }

        tmp.multiplyScalar(connectingVertexWeight);
        newSourceVertex.add(tmp);

        newSourceVertices.push(newSourceVertex);
      }

      /******************************************************
       *
       *  Step 3.
       *  Generate Faces between source vertecies
       *  and edge vertices.
       *
       *******************************************************/

      newVertices = newSourceVertices.concat(newEdgeVertices);
      var sl = newSourceVertices.length,
        edge1,
        edge2,
        edge3;
      newFaces = [];

      for (i = 0, il = oldFaces.length; i < il; i++) {
        face = oldFaces[i];

        // find the 3 new edges vertex of each old face

        edge1 = getEdge(face.a, face.b, sourceEdges).newEdge + sl;
        edge2 = getEdge(face.b, face.c, sourceEdges).newEdge + sl;
        edge3 = getEdge(face.c, face.a, sourceEdges).newEdge + sl;

        // create 4 faces.

        newFace(newFaces, edge1, edge2, edge3);
        newFace(newFaces, face.a, edge1, edge3);
        newFace(newFaces, face.b, edge2, edge1);
        newFace(newFaces, face.c, edge3, edge2);
      }

      // Overwrite old arrays
      geometry.vertices = newVertices;
      geometry.faces = newFaces;

      // console.log('done');
    }
  },

  computeCentroid: (function () {
    var v = new THREE.Vector3();

    return function (geometry, face) {
      var a = geometry.vertices[face.a],
        b = geometry.vertices[face.b],
        c = geometry.vertices[face.c];

      v.x = (a.x + b.x + c.x) / 3;
      v.y = (a.y + b.y + c.y) / 3;
      v.z = (a.z + b.z + c.z) / 3;

      return v;
    };
  })(),

  createDepthAnimationMaterial: function (sourceMaterial) {
    // todo morph & skinning support
    return new THREE.BAS.DepthAnimationMaterial({
      uniforms: sourceMaterial.uniforms,
      vertexFunctions: sourceMaterial.vertexFunctions,
      vertexParameters: sourceMaterial.vertexParameters,
      vertexInit: sourceMaterial.vertexInit,
      vertexPosition: sourceMaterial.vertexPosition,
    });
  },

  createDistanceAnimationMaterial: function (sourceMaterial) {
    // todo morph & skinning support
    return new THREE.BAS.DistanceAnimationMaterial({
      uniforms: sourceMaterial.uniforms,
      vertexFunctions: sourceMaterial.vertexFunctions,
      vertexParameters: sourceMaterial.vertexParameters,
      vertexInit: sourceMaterial.vertexInit,
      vertexPosition: sourceMaterial.vertexPosition,
    });
  },
};
THREE.BAS.ModelBufferGeometry = function (model) {
  THREE.BufferGeometry.call(this);

  this.modelGeometry = model;
  this.faceCount = this.modelGeometry.faces.length;
  this.vertexCount = this.modelGeometry.vertices.length;

  this.bufferIndices();
  this.bufferPositions();
};
THREE.BAS.ModelBufferGeometry.prototype = Object.create(
  THREE.BufferGeometry.prototype
);
THREE.BAS.ModelBufferGeometry.prototype.constructor =
  THREE.BAS.ModelBufferGeometry;

THREE.BAS.ModelBufferGeometry.prototype.bufferIndices = function () {
  var indexBuffer = new Uint32Array(this.faceCount * 3);

  this.setIndex(new THREE.BufferAttribute(indexBuffer, 1));

  for (var i = 0, offset = 0; i < this.faceCount; i++, offset += 3) {
    var face = this.modelGeometry.faces[i];

    indexBuffer[offset] = face.a;
    indexBuffer[offset + 1] = face.b;
    indexBuffer[offset + 2] = face.c;
  }
};

THREE.BAS.ModelBufferGeometry.prototype.bufferPositions = function () {
  var positionBuffer = this.createAttribute("position", 3).array;

  for (var i = 0, offset = 0; i < this.vertexCount; i++, offset += 3) {
    var vertex = this.modelGeometry.vertices[i];

    positionBuffer[offset] = vertex.x;
    positionBuffer[offset + 1] = vertex.y;
    positionBuffer[offset + 2] = vertex.z;
  }
};

THREE.BAS.ModelBufferGeometry.prototype.bufferUVs = function () {
  var uvBuffer = this.createAttribute("uv", 2).array;

  for (var i = 0; i < this.faceCount; i++) {
    var face = this.modelGeometry.faces[i];
    var uv;

    uv = this.modelGeometry.faceVertexUvs[0][i][0];
    uvBuffer[face.a * 2] = uv.x;
    uvBuffer[face.a * 2 + 1] = uv.y;

    uv = this.modelGeometry.faceVertexUvs[0][i][1];
    uvBuffer[face.b * 2] = uv.x;
    uvBuffer[face.b * 2 + 1] = uv.y;

    uv = this.modelGeometry.faceVertexUvs[0][i][2];
    uvBuffer[face.c * 2] = uv.x;
    uvBuffer[face.c * 2 + 1] = uv.y;
  }
};

THREE.BAS.ModelBufferGeometry.prototype.createAttribute = function (
  name,
  itemSize
) {
  var buffer = new Float32Array(this.vertexCount * itemSize);
  var attribute = new THREE.BufferAttribute(buffer, itemSize);

  this.addAttribute(name, attribute);

  return attribute;
};

/**
 * A THREE.BufferGeometry where a 'prefab' geometry is repeated a number of times
 * @param prefab the THREE.Geometry instance to repeat
 * @param count the number of times to repeat it
 * @constructor
 */
THREE.BAS.PrefabBufferGeometry = function (prefab, count) {
  THREE.BufferGeometry.call(this);

  this.prefabGeometry = prefab;
  this.prefabCount = count;
  this.prefabVertexCount = prefab.vertices.length;

  this.bufferIndices();
  this.bufferPositions();
};
THREE.BAS.PrefabBufferGeometry.prototype = Object.create(
  THREE.BufferGeometry.prototype
);
THREE.BAS.PrefabBufferGeometry.prototype.constructor =
  THREE.BAS.PrefabBufferGeometry;

THREE.BAS.PrefabBufferGeometry.prototype.bufferIndices = function () {
  var prefabFaceCount = this.prefabGeometry.faces.length;
  var prefabIndexCount = this.prefabGeometry.faces.length * 3;
  var prefabIndices = [];

  for (var h = 0; h < prefabFaceCount; h++) {
    var face = this.prefabGeometry.faces[h];
    prefabIndices.push(face.a, face.b, face.c);
  }

  var indexBuffer = new Uint32Array(this.prefabCount * prefabIndexCount);

  this.setIndex(new THREE.BufferAttribute(indexBuffer, 1));

  for (var i = 0; i < this.prefabCount; i++) {
    for (var k = 0; k < prefabIndexCount; k++) {
      indexBuffer[i * prefabIndexCount + k] =
        prefabIndices[k] + i * this.prefabVertexCount;
    }
  }
};

THREE.BAS.PrefabBufferGeometry.prototype.bufferPositions = function () {
  var positionBuffer = this.createAttribute("position", 3).array;

  for (var i = 0, offset = 0; i < this.prefabCount; i++) {
    for (var j = 0; j < this.prefabVertexCount; j++, offset += 3) {
      var prefabVertex = this.prefabGeometry.vertices[j];

      positionBuffer[offset] = prefabVertex.x;
      positionBuffer[offset + 1] = prefabVertex.y;
      positionBuffer[offset + 2] = prefabVertex.z;
    }
  }
};

// todo test
THREE.BAS.PrefabBufferGeometry.prototype.bufferUvs = function () {
  var prefabFaceCount = this.prefabGeometry.faces.length;
  var prefabVertexCount = (this.prefabVertexCount =
    this.prefabGeometry.vertices.length);
  var prefabUvs = [];

  for (var h = 0; h < prefabFaceCount; h++) {
    var face = this.prefabGeometry.faces[h];
    var uv = this.prefabGeometry.faceVertexUvs[0][h];

    prefabUvs[face.a] = uv[0];
    prefabUvs[face.b] = uv[1];
    prefabUvs[face.c] = uv[2];
  }

  var uvBuffer = this.createAttribute("uv", 2);

  for (var i = 0, offset = 0; i < this.prefabCount; i++) {
    for (var j = 0; j < prefabVertexCount; j++, offset += 2) {
      var prefabUv = prefabUvs[j];

      uvBuffer.array[offset] = prefabUv.x;
      uvBuffer.array[offset + 1] = prefabUv.y;
    }
  }
};

THREE.BAS.PrefabBufferGeometry.prototype.createAttribute = function (
  name,
  itemSize,
  factory
) {
  var buffer = new Float32Array(
    this.prefabCount * this.prefabVertexCount * itemSize
  );
  var attribute = new THREE.BufferAttribute(buffer, itemSize);

  this.addAttribute(name, attribute);

  if (factory) {
    var data = [];

    for (var i = 0; i < this.prefabCount; i++) {
      this.setPrefabData(attribute, i, factory(data, i, this.prefabCount));
    }
  }

  return attribute;
};

/**
 * Copy data for all vertices of the prefab
 * usually called in a loop
 * @param attribute The attribute or attribute name where data is to be stored.
 * @param prefabIndex Index of the prefab in the buffer geometry.
 * @param data Array of data. Length should be equal to item size of the attribute.
 */
THREE.BAS.PrefabBufferGeometry.prototype.setPrefabData = function (
  attribute,
  prefabIndex,
  data
) {
  attribute =
    typeof attribute === "string" ? this.attributes[attribute] : attribute;

  var offset = prefabIndex * this.prefabVertexCount * attribute.itemSize;

  for (var i = 0; i < this.prefabVertexCount; i++) {
    for (var j = 0; j < attribute.itemSize; j++) {
      attribute.array[offset++] = data[j];
    }
  }
};

THREE.BAS.BaseAnimationMaterial = function (parameters, uniformValues) {
  THREE.ShaderMaterial.call(this);

  this.setValues(parameters);

  // todo add missing default defines

  if (uniformValues) {
    uniformValues.map && (this.defines["USE_MAP"] = "");
    uniformValues.normalMap && (this.defines["USE_NORMALMAP"] = "");
    uniformValues.envMap && (this.defines["USE_ENVMAP"] = "");

    if (uniformValues.envMap) {
      this.defines["USE_ENVMAP"] = "";

      var envMapTypeDefine = "ENVMAP_TYPE_CUBE";
      var envMapModeDefine = "ENVMAP_MODE_REFLECTION";
      var envMapBlendingDefine = "ENVMAP_BLENDING_MULTIPLY";

      switch (uniformValues.envMap.mapping) {
        case THREE.CubeReflectionMapping:
        case THREE.CubeRefractionMapping:
          envMapTypeDefine = "ENVMAP_TYPE_CUBE";
          break;
        case THREE.CubeUVReflectionMapping:
        case THREE.CubeUVRefractionMapping:
          envMapTypeDefine = "ENVMAP_TYPE_CUBE_UV";
          break;
        case THREE.EquirectangularReflectionMapping:
        case THREE.EquirectangularRefractionMapping:
          envMapTypeDefine = "ENVMAP_TYPE_EQUIREC";
          break;
        case THREE.SphericalReflectionMapping:
          envMapTypeDefine = "ENVMAP_TYPE_SPHERE";
          break;
      }

      switch (uniformValues.envMap.mapping) {
        case THREE.CubeRefractionMapping:
        case THREE.EquirectangularRefractionMapping:
          envMapModeDefine = "ENVMAP_MODE_REFRACTION";
          break;
      }

      switch (uniformValues.combine) {
        case THREE.MixOperation:
          envMapBlendingDefine = "ENVMAP_BLENDING_MIX";
          break;
        case THREE.AddOperation:
          envMapBlendingDefine = "ENVMAP_BLENDING_ADD";
          break;
        case THREE.MultiplyOperation:
        default:
          envMapBlendingDefine = "ENVMAP_BLENDING_MULTIPLY";
          break;
      }

      this.defines[envMapTypeDefine] = "";
      this.defines[envMapBlendingDefine] = "";
      this.defines[envMapModeDefine] = "";
    }
  }
};
THREE.BAS.BaseAnimationMaterial.prototype = Object.create(
  THREE.ShaderMaterial.prototype
);
THREE.BAS.BaseAnimationMaterial.prototype.constructor =
  THREE.BAS.BaseAnimationMaterial;

THREE.BAS.BaseAnimationMaterial.prototype.setUniformValues = function (values) {
  for (var key in values) {
    if (key in this.uniforms) {
      var uniform = this.uniforms[key];
      var value = values[key];

      // todo add matrix uniform types?
      switch (uniform.type) {
        case "c": // color
          uniform.value.set(value);
          break;
        case "v2": // vectors
        case "v3":
        case "v4":
          uniform.value.copy(value);
          break;
        case "f": // float
        case "t": // texture
        default:
          uniform.value = value;
      }
    }
  }
};

THREE.BAS.BaseAnimationMaterial.prototype._stringifyChunk = function (name) {
  return this[name] ? this[name].join("\n") : "";
};

THREE.BAS.BasicAnimationMaterial = function (parameters, uniformValues) {
  this.varyingParameters = [];

  this.vertexFunctions = [];
  this.vertexParameters = [];
  this.vertexInit = [];
  this.vertexNormal = [];
  this.vertexPosition = [];
  this.vertexColor = [];

  this.fragmentFunctions = [];
  this.fragmentParameters = [];
  this.fragmentInit = [];
  this.fragmentMap = [];
  this.fragmentAlpha = [];

  THREE.BAS.BaseAnimationMaterial.call(this, parameters, uniformValues);

  var basicShader = THREE.ShaderLib["basic"];

  this.uniforms = THREE.UniformsUtils.merge([
    basicShader.uniforms,
    this.uniforms,
  ]);
  this.lights = false;
  this.vertexShader = this._concatVertexShader();
  this.fragmentShader = this._concatFragmentShader();

  this.setUniformValues(uniformValues);
};
THREE.BAS.BasicAnimationMaterial.prototype = Object.create(
  THREE.BAS.BaseAnimationMaterial.prototype
);
THREE.BAS.BasicAnimationMaterial.prototype.constructor =
  THREE.BAS.BasicAnimationMaterial;

THREE.BAS.BasicAnimationMaterial.prototype._concatVertexShader = function () {
  // based on THREE.ShaderLib.basic
  return [
    THREE.ShaderChunk["common"],
    THREE.ShaderChunk["uv_pars_vertex"],
    THREE.ShaderChunk["uv2_pars_vertex"],
    THREE.ShaderChunk["envmap_pars_vertex"],
    THREE.ShaderChunk["color_pars_vertex"],
    THREE.ShaderChunk["morphtarget_pars_vertex"],
    THREE.ShaderChunk["skinning_pars_vertex"],
    THREE.ShaderChunk["logdepthbuf_pars_vertex"],

    this._stringifyChunk("vertexFunctions"),
    this._stringifyChunk("vertexParameters"),
    this._stringifyChunk("varyingParameters"),

    "void main() {",

    this._stringifyChunk("vertexInit"),

    THREE.ShaderChunk["uv_vertex"],
    THREE.ShaderChunk["uv2_vertex"],
    THREE.ShaderChunk["color_vertex"],
    THREE.ShaderChunk["skinbase_vertex"],

    "	#ifdef USE_ENVMAP",

    THREE.ShaderChunk["beginnormal_vertex"],

    this._stringifyChunk("vertexNormal"),

    THREE.ShaderChunk["morphnormal_vertex"],
    THREE.ShaderChunk["skinnormal_vertex"],
    THREE.ShaderChunk["defaultnormal_vertex"],

    "	#endif",

    THREE.ShaderChunk["begin_vertex"],

    this._stringifyChunk("vertexPosition"),
    this._stringifyChunk("vertexColor"),

    THREE.ShaderChunk["morphtarget_vertex"],
    THREE.ShaderChunk["skinning_vertex"],
    THREE.ShaderChunk["project_vertex"],
    THREE.ShaderChunk["logdepthbuf_vertex"],

    THREE.ShaderChunk["worldpos_vertex"],
    THREE.ShaderChunk["envmap_vertex"],

    "}",
  ].join("\n");
};

THREE.BAS.BasicAnimationMaterial.prototype._concatFragmentShader = function () {
  return [
    "uniform vec3 diffuse;",
    "uniform float opacity;",

    this._stringifyChunk("fragmentFunctions"),
    this._stringifyChunk("fragmentParameters"),
    this._stringifyChunk("varyingParameters"),

    "#ifndef FLAT_SHADED",

    "	varying vec3 vNormal;",

    "#endif",

    THREE.ShaderChunk["common"],
    THREE.ShaderChunk["color_pars_fragment"],
    THREE.ShaderChunk["uv_pars_fragment"],
    THREE.ShaderChunk["uv2_pars_fragment"],
    THREE.ShaderChunk["map_pars_fragment"],
    THREE.ShaderChunk["alphamap_pars_fragment"],
    THREE.ShaderChunk["aomap_pars_fragment"],
    THREE.ShaderChunk["envmap_pars_fragment"],
    THREE.ShaderChunk["fog_pars_fragment"],
    THREE.ShaderChunk["specularmap_pars_fragment"],
    THREE.ShaderChunk["logdepthbuf_pars_fragment"],

    "void main() {",

    this._stringifyChunk("fragmentInit"),

    "	vec4 diffuseColor = vec4( diffuse, opacity );",

    THREE.ShaderChunk["logdepthbuf_fragment"],
    this._stringifyChunk("fragmentMap") || THREE.ShaderChunk["map_fragment"],
    THREE.ShaderChunk["color_fragment"],

    this._stringifyChunk("fragmentAlpha"),

    THREE.ShaderChunk["alphamap_fragment"],
    THREE.ShaderChunk["alphatest_fragment"],
    THREE.ShaderChunk["specularmap_fragment"],

    "	ReflectedLight reflectedLight;",
    "	reflectedLight.directDiffuse = vec3( 0.0 );",
    "	reflectedLight.directSpecular = vec3( 0.0 );",
    "	reflectedLight.indirectDiffuse = diffuseColor.rgb;",
    "	reflectedLight.indirectSpecular = vec3( 0.0 );",

    THREE.ShaderChunk["aomap_fragment"],

    "	vec3 outgoingLight = reflectedLight.indirectDiffuse;",

    THREE.ShaderChunk["envmap_fragment"],
    THREE.ShaderChunk["linear_to_gamma_fragment"],
    THREE.ShaderChunk["fog_fragment"],

    "	gl_FragColor = vec4( outgoingLight, diffuseColor.a );",

    "}",
  ].join("\n");
};

THREE.BAS.DepthAnimationMaterial = function (parameters) {
  this.depthPacking = THREE.RGBADepthPacking;
  this.clipping = true;

  this.vertexFunctions = [];
  this.vertexParameters = [];
  this.vertexInit = [];
  this.vertexPosition = [];

  THREE.BAS.BaseAnimationMaterial.call(this, parameters);

  var depthShader = THREE.ShaderLib["depth"];

  this.uniforms = THREE.UniformsUtils.merge([
    depthShader.uniforms,
    this.uniforms,
  ]);
  this.vertexShader = this._concatVertexShader();
  this.fragmentShader = depthShader.fragmentShader;
};
THREE.BAS.DepthAnimationMaterial.prototype = Object.create(
  THREE.BAS.BaseAnimationMaterial.prototype
);
THREE.BAS.DepthAnimationMaterial.prototype.constructor =
  THREE.BAS.DepthAnimationMaterial;

THREE.BAS.DepthAnimationMaterial.prototype._concatVertexShader = function () {
  return [
    THREE.ShaderChunk["common"],
    THREE.ShaderChunk["uv_pars_vertex"],
    THREE.ShaderChunk["displacementmap_pars_vertex"],
    THREE.ShaderChunk["morphtarget_pars_vertex"],
    THREE.ShaderChunk["skinning_pars_vertex"],
    THREE.ShaderChunk["logdepthbuf_pars_vertex"],
    THREE.ShaderChunk["clipping_planes_pars_vertex"],

    this._stringifyChunk("vertexFunctions"),
    this._stringifyChunk("vertexParameters"),

    "void main() {",

    this._stringifyChunk("vertexInit"),

    THREE.ShaderChunk["uv_vertex"],
    THREE.ShaderChunk["skinbase_vertex"],

    THREE.ShaderChunk["begin_vertex"],

    this._stringifyChunk("vertexPosition"),

    THREE.ShaderChunk["displacementmap_vertex"],
    THREE.ShaderChunk["morphtarget_vertex"],
    THREE.ShaderChunk["skinning_vertex"],
    THREE.ShaderChunk["project_vertex"],
    THREE.ShaderChunk["logdepthbuf_vertex"],
    THREE.ShaderChunk["clipping_planes_vertex"],

    "}",
  ].join("\n");
};

THREE.BAS.DistanceAnimationMaterial = function (parameters) {
  this.depthPacking = THREE.RGBADepthPacking;
  this.clipping = true;

  this.vertexFunctions = [];
  this.vertexParameters = [];
  this.vertexInit = [];
  this.vertexPosition = [];

  THREE.BAS.BaseAnimationMaterial.call(this, parameters);

  var distanceShader = THREE.ShaderLib["distanceRGBA"];

  this.uniforms = THREE.UniformsUtils.merge([
    distanceShader.uniforms,
    this.uniforms,
  ]);
  this.vertexShader = this._concatVertexShader();
  this.fragmentShader = distanceShader.fragmentShader;
};
THREE.BAS.DistanceAnimationMaterial.prototype = Object.create(
  THREE.BAS.BaseAnimationMaterial.prototype
);
THREE.BAS.DistanceAnimationMaterial.prototype.constructor =
  THREE.BAS.DistanceAnimationMaterial;

THREE.BAS.DistanceAnimationMaterial.prototype._concatVertexShader =
  function () {
    return [
      "varying vec4 vWorldPosition;",

      THREE.ShaderChunk["common"],
      THREE.ShaderChunk["morphtarget_pars_vertex"],
      THREE.ShaderChunk["skinning_pars_vertex"],
      THREE.ShaderChunk["clipping_planes_pars_vertex"],

      this._stringifyChunk("vertexFunctions"),
      this._stringifyChunk("vertexParameters"),

      "void main() {",

      this._stringifyChunk("vertexInit"),

      THREE.ShaderChunk["skinbase_vertex"],
      THREE.ShaderChunk["begin_vertex"],

      this._stringifyChunk("vertexPosition"),

      THREE.ShaderChunk["morphtarget_vertex"],
      THREE.ShaderChunk["skinning_vertex"],
      THREE.ShaderChunk["project_vertex"],
      THREE.ShaderChunk["worldpos_vertex"],
      THREE.ShaderChunk["clipping_planes_vertex"],

      "vWorldPosition = worldPosition;",

      "}",
    ].join("\n");
  };

THREE.BAS.PhongAnimationMaterial = function (parameters, uniformValues) {
  this.varyingParameters = [];

  this.vertexFunctions = [];
  this.vertexParameters = [];
  this.vertexInit = [];
  this.vertexNormal = [];
  this.vertexPosition = [];
  this.vertexColor = [];

  this.fragmentFunctions = [];
  this.fragmentParameters = [];
  this.fragmentInit = [];
  this.fragmentAlpha = [];
  this.fragmentEmissive = [];
  this.fragmentSpecular = [];

  THREE.BAS.BaseAnimationMaterial.call(this, parameters, uniformValues);

  var phongShader = THREE.ShaderLib["phong"];

  this.uniforms = THREE.UniformsUtils.merge([
    phongShader.uniforms,
    this.uniforms,
  ]);
  this.lights = true;
  this.vertexShader = this._concatVertexShader();
  this.fragmentShader = this._concatFragmentShader();

  this.setUniformValues(uniformValues);
};
THREE.BAS.PhongAnimationMaterial.prototype = Object.create(
  THREE.BAS.BaseAnimationMaterial.prototype
);
THREE.BAS.PhongAnimationMaterial.prototype.constructor =
  THREE.BAS.PhongAnimationMaterial;

THREE.BAS.PhongAnimationMaterial.prototype._concatVertexShader = function () {
  // based on THREE.ShaderLib.phong
  return [
    "#define PHONG",

    "varying vec3 vViewPosition;",

    "#ifndef FLAT_SHADED",

    "	varying vec3 vNormal;",

    "#endif",

    THREE.ShaderChunk["common"],
    THREE.ShaderChunk["uv_pars_vertex"],
    THREE.ShaderChunk["uv2_pars_vertex"],
    THREE.ShaderChunk["displacementmap_pars_vertex"],
    THREE.ShaderChunk["envmap_pars_vertex"],
    THREE.ShaderChunk["lights_phong_pars_vertex"],
    THREE.ShaderChunk["color_pars_vertex"],
    THREE.ShaderChunk["morphtarget_pars_vertex"],
    THREE.ShaderChunk["skinning_pars_vertex"],
    THREE.ShaderChunk["shadowmap_pars_vertex"],
    THREE.ShaderChunk["logdepthbuf_pars_vertex"],

    this._stringifyChunk("vertexFunctions"),
    this._stringifyChunk("vertexParameters"),
    this._stringifyChunk("varyingParameters"),

    "void main() {",

    this._stringifyChunk("vertexInit"),

    THREE.ShaderChunk["uv_vertex"],
    THREE.ShaderChunk["uv2_vertex"],
    THREE.ShaderChunk["color_vertex"],
    THREE.ShaderChunk["beginnormal_vertex"],

    this._stringifyChunk("vertexNormal"),

    THREE.ShaderChunk["morphnormal_vertex"],
    THREE.ShaderChunk["skinbase_vertex"],
    THREE.ShaderChunk["skinnormal_vertex"],
    THREE.ShaderChunk["defaultnormal_vertex"],

    "#ifndef FLAT_SHADED", // Normal computed with derivatives when FLAT_SHADED

    "	vNormal = normalize( transformedNormal );",

    "#endif",

    THREE.ShaderChunk["begin_vertex"],

    this._stringifyChunk("vertexPosition"),
    this._stringifyChunk("vertexColor"),

    THREE.ShaderChunk["displacementmap_vertex"],
    THREE.ShaderChunk["morphtarget_vertex"],
    THREE.ShaderChunk["skinning_vertex"],
    THREE.ShaderChunk["project_vertex"],
    THREE.ShaderChunk["logdepthbuf_vertex"],

    "	vViewPosition = - mvPosition.xyz;",

    THREE.ShaderChunk["worldpos_vertex"],
    THREE.ShaderChunk["envmap_vertex"],
    THREE.ShaderChunk["lights_phong_vertex"],
    THREE.ShaderChunk["shadowmap_vertex"],

    "}",
  ].join("\n");
};

THREE.BAS.PhongAnimationMaterial.prototype._concatFragmentShader = function () {
  return [
    "#define PHONG",

    "uniform vec3 diffuse;",
    "uniform vec3 emissive;",
    "uniform vec3 specular;",
    "uniform float shininess;",
    "uniform float opacity;",

    this._stringifyChunk("fragmentFunctions"),
    this._stringifyChunk("fragmentParameters"),
    this._stringifyChunk("varyingParameters"),

    THREE.ShaderChunk["common"],
    THREE.ShaderChunk["packing"],
    THREE.ShaderChunk["color_pars_fragment"],
    THREE.ShaderChunk["uv_pars_fragment"],
    THREE.ShaderChunk["uv2_pars_fragment"],
    THREE.ShaderChunk["map_pars_fragment"],
    THREE.ShaderChunk["alphamap_pars_fragment"],
    THREE.ShaderChunk["aomap_pars_fragment"],
    THREE.ShaderChunk["lightmap_pars_fragment"],
    THREE.ShaderChunk["emissivemap_pars_fragment"],
    THREE.ShaderChunk["envmap_pars_fragment"],
    THREE.ShaderChunk["fog_pars_fragment"],
    THREE.ShaderChunk["bsdfs"],
    THREE.ShaderChunk["ambient_pars"],
    THREE.ShaderChunk["lights_pars"],
    THREE.ShaderChunk["lights_phong_pars_fragment"],
    THREE.ShaderChunk["shadowmap_pars_fragment"],
    THREE.ShaderChunk["bumpmap_pars_fragment"],
    THREE.ShaderChunk["normalmap_pars_fragment"],
    THREE.ShaderChunk["specularmap_pars_fragment"],
    THREE.ShaderChunk["logdepthbuf_pars_fragment"],

    "void main() {",

    this._stringifyChunk("fragmentInit"),

    "	vec4 diffuseColor = vec4( diffuse, opacity );",
    "	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );",
    "	vec3 totalEmissiveLight = emissive;",

    THREE.ShaderChunk["logdepthbuf_fragment"],
    THREE.ShaderChunk["map_fragment"],
    THREE.ShaderChunk["color_fragment"],

    this._stringifyChunk("fragmentAlpha"),

    THREE.ShaderChunk["alphamap_fragment"],
    THREE.ShaderChunk["alphatest_fragment"],
    THREE.ShaderChunk["specularmap_fragment"],
    THREE.ShaderChunk["normal_fragment"],

    this._stringifyChunk("fragmentEmissive"),

    THREE.ShaderChunk["emissivemap_fragment"],

    // accumulation
    THREE.ShaderChunk["lights_phong_fragment"],

    this._stringifyChunk("fragmentSpecular"),

    THREE.ShaderChunk["lights_template"],

    // modulation
    THREE.ShaderChunk["aomap_fragment"],

    "vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveLight;",

    THREE.ShaderChunk["envmap_fragment"],
    THREE.ShaderChunk["linear_to_gamma_fragment"],

    THREE.ShaderChunk["fog_fragment"],

    "	gl_FragColor = vec4( outgoingLight, diffuseColor.a );",

    "}",
  ].join("\n");
};

THREE.BAS.StandardAnimationMaterial = function (parameters, uniformValues) {
  this.varyingParameters = [];

  this.vertexFunctions = [];
  this.vertexParameters = [];
  this.vertexInit = [];
  this.vertexNormal = [];
  this.vertexPosition = [];
  this.vertexColor = [];

  this.fragmentFunctions = [];
  this.fragmentParameters = [];
  this.fragmentInit = [];
  this.fragmentAlpha = [];
  this.fragmentEmissive = [];

  THREE.BAS.BaseAnimationMaterial.call(this, parameters, uniformValues);

  var standardShader = THREE.ShaderLib["standard"];

  this.uniforms = THREE.UniformsUtils.merge([
    standardShader.uniforms,
    this.uniforms,
  ]);
  this.lights = true;
  this.vertexShader = this._concatVertexShader();
  this.fragmentShader = this._concatFragmentShader();

  this.setUniformValues(uniformValues);
};
THREE.BAS.StandardAnimationMaterial.prototype = Object.create(
  THREE.BAS.BaseAnimationMaterial.prototype
);
THREE.BAS.StandardAnimationMaterial.prototype.constructor =
  THREE.BAS.StandardAnimationMaterial;

THREE.BAS.StandardAnimationMaterial.prototype._concatVertexShader =
  function () {
    // based on THREE.ShaderLib.physical
    return [
      "#define PHYSICAL",

      "varying vec3 vViewPosition;",

      "#ifndef FLAT_SHADED",

      "	varying vec3 vNormal;",

      "#endif",

      THREE.ShaderChunk["common"],
      THREE.ShaderChunk["uv_pars_vertex"],
      THREE.ShaderChunk["uv2_pars_vertex"],
      THREE.ShaderChunk["displacementmap_pars_vertex"],
      THREE.ShaderChunk["color_pars_vertex"],
      THREE.ShaderChunk["morphtarget_pars_vertex"],
      THREE.ShaderChunk["skinning_pars_vertex"],
      THREE.ShaderChunk["shadowmap_pars_vertex"],
      THREE.ShaderChunk["specularmap_pars_fragment"],
      THREE.ShaderChunk["logdepthbuf_pars_vertex"],
      THREE.ShaderChunk["clipping_planes_pars_vertex"],

      this._stringifyChunk("vertexFunctions"),
      this._stringifyChunk("vertexParameters"),
      this._stringifyChunk("varyingParameters"),

      "void main() {",

      this._stringifyChunk("vertexInit"),

      THREE.ShaderChunk["uv_vertex"],
      THREE.ShaderChunk["uv2_vertex"],
      THREE.ShaderChunk["color_vertex"],
      THREE.ShaderChunk["beginnormal_vertex"],

      this._stringifyChunk("vertexNormal"),

      THREE.ShaderChunk["morphnormal_vertex"],
      THREE.ShaderChunk["skinbase_vertex"],
      THREE.ShaderChunk["skinnormal_vertex"],
      THREE.ShaderChunk["defaultnormal_vertex"],

      "#ifndef FLAT_SHADED", // Normal computed with derivatives when FLAT_SHADED

      "	vNormal = normalize( transformedNormal );",

      "#endif",

      THREE.ShaderChunk["begin_vertex"],

      this._stringifyChunk("vertexPosition"),
      this._stringifyChunk("vertexColor"),

      THREE.ShaderChunk["displacementmap_vertex"],
      THREE.ShaderChunk["morphtarget_vertex"],
      THREE.ShaderChunk["skinning_vertex"],
      THREE.ShaderChunk["project_vertex"],
      THREE.ShaderChunk["logdepthbuf_vertex"],
      THREE.ShaderChunk["clipping_planes_vertex"],

      "	vViewPosition = - mvPosition.xyz;",

      THREE.ShaderChunk["worldpos_vertex"],
      THREE.ShaderChunk["shadowmap_vertex"],

      "}",
    ].join("\n");
  };

THREE.BAS.StandardAnimationMaterial.prototype._concatFragmentShader =
  function () {
    return [
      "#define PHYSICAL",

      "uniform vec3 diffuse;",
      "uniform vec3 emissive;",
      "uniform float roughness;",
      "uniform float metalness;",
      "uniform float opacity;",

      "uniform float envMapIntensity;",

      "varying vec3 vViewPosition;",

      "#ifndef FLAT_SHADED",
      "varying vec3 vNormal;",
      "#endif",

      this._stringifyChunk("fragmentFunctions"),
      this._stringifyChunk("fragmentParameters"),
      this._stringifyChunk("varyingParameters"),

      THREE.ShaderChunk["common"],
      THREE.ShaderChunk["packing"],
      THREE.ShaderChunk["color_pars_fragment"],
      THREE.ShaderChunk["uv_pars_fragment"],
      THREE.ShaderChunk["uv2_pars_fragment"],
      THREE.ShaderChunk["map_pars_fragment"],
      THREE.ShaderChunk["alphamap_pars_fragment"],
      THREE.ShaderChunk["aomap_pars_fragment"],
      THREE.ShaderChunk["lightmap_pars_fragment"],
      THREE.ShaderChunk["emissivemap_pars_fragment"],
      THREE.ShaderChunk["envmap_pars_fragment"],
      THREE.ShaderChunk["fog_pars_fragment"],
      THREE.ShaderChunk["bsdfs"],
      THREE.ShaderChunk["cube_uv_reflection_fragment"],
      THREE.ShaderChunk["lights_pars"],
      THREE.ShaderChunk["lights_physical_pars_fragment"],
      THREE.ShaderChunk["shadowmap_pars_fragment"],
      THREE.ShaderChunk["bumpmap_pars_fragment"],
      THREE.ShaderChunk["normalmap_pars_fragment"],
      THREE.ShaderChunk["roughnessmap_pars_fragment"],
      THREE.ShaderChunk["metalnessmap_pars_fragment"],
      THREE.ShaderChunk["logdepthbuf_pars_fragment"],
      THREE.ShaderChunk["clipping_planes_pars_fragment"],

      "void main() {",

      this._stringifyChunk("fragmentInit"),

      "	vec4 diffuseColor = vec4( diffuse, opacity );",
      "	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );",
      "	vec3 totalEmissiveRadiance = emissive;",

      THREE.ShaderChunk["logdepthbuf_fragment"],
      THREE.ShaderChunk["map_fragment"],
      THREE.ShaderChunk["color_fragment"],

      this._stringifyChunk("fragmentAlpha"),

      THREE.ShaderChunk["alphamap_fragment"],
      THREE.ShaderChunk["alphatest_fragment"],
      THREE.ShaderChunk["specularmap_fragment"],
      THREE.ShaderChunk["roughnessmap_fragment"],
      THREE.ShaderChunk["metalnessmap_fragment"],
      THREE.ShaderChunk["normal_fragment"],

      this._stringifyChunk("fragmentEmissive"),

      THREE.ShaderChunk["emissivemap_fragment"],

      // accumulation
      THREE.ShaderChunk["lights_physical_fragment"],

      this._stringifyChunk("fragmentSpecular"),

      THREE.ShaderChunk["lights_template"],

      // modulation
      THREE.ShaderChunk["aomap_fragment"],

      "vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;",

      "	gl_FragColor = vec4( outgoingLight, diffuseColor.a );",

      THREE.ShaderChunk["premultiplied_alpha_fragment"],
      THREE.ShaderChunk["tonemapping_fragment"],
      THREE.ShaderChunk["encodings_fragment"],
      THREE.ShaderChunk["fog_fragment"],

      "}",
    ].join("\n");
  };
