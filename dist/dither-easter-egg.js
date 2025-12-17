// Dithering Easter Egg - Type "dither" to toggle full-screen pixely dithering mode
// Only runs on desktop to save performance

let ditherBuffer = "";
let ditherTimeout;
let ditherActive = false;
let ditherCanvas;
let ditherCtx;
let ditherTempCanvas;
let ditherTempCtx;
let ditherDownsampleCanvas;
let ditherDownsampleCtx;
let cachedCanvases = [];
let ditherFrameSkip = 0;
let ditherResizeTimeout;
const FRAME_SKIP = 6; // Process every 6th frame (16% CPU usage)
const DOWNSAMPLE_SCALE = 0.3; // Downsample to 30% resolution (9x fewer pixels)

// Detect mobile
const isMobileDither =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

if (!isMobileDither) {
  document.addEventListener("keydown", (e) => {
    ditherBuffer += e.key.toLowerCase();
    if (ditherBuffer.length > 7) {
      ditherBuffer = ditherBuffer.slice(-7);
    }
    if (ditherBuffer.includes("classic")) {
      toggleDither();
      ditherBuffer = "";
    }
    clearTimeout(ditherTimeout);
    ditherTimeout = setTimeout(() => {
      ditherBuffer = "";
    }, 2000);
  });
}

function toggleDither() {
  ditherActive = !ditherActive;
  const threeContainer = document.querySelector("#three-container");
  if (ditherActive) {
    startDither();
    // Limit all FPS to 30fps max
    window.ditherMaxFps = 30;
    console.log("Max FPS limited to 30fps");

    // Reduce Three.js renderer quality to 10% for performance
    if (window.root && window.root.renderer) {
      window.root.renderer.setPixelRatio(0.1);
      console.log("Three.js pixel ratio reduced to 10%");
    }
    // Reduce Three.js canvas brightness to 55%
    if (threeContainer) {
      threeContainer.style.filter = "brightness(0.55)";
      console.log("Three.js brightness reduced to 55%");
    }
    // Disable bloom for performance
    if (window.SORSARI && window.SORSARI.bloomPass) {
      window.SORSARI.bloomPass.enabled = false;
      console.log("Bloom disabled for performance");
    }
    // Disable chromatic aberration and screen shake
    window.ditherChromaticAberrationDisabled = true;
    window.ditherScreenShakeDisabled = true;
    console.log("Dithering mode enabled!");
  } else {
    stopDither();
    // Remove FPS limit
    window.ditherMaxFps = null;
    console.log("Max FPS limit removed");

    // Restore Three.js renderer quality to 50% (original)
    if (window.root && window.root.renderer) {
      window.root.renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, 1.25) * 0.5
      );
      console.log("Three.js pixel ratio restored to 50%");
    }
    // Restore Three.js canvas brightness
    if (threeContainer) {
      threeContainer.style.filter = "none";
      console.log("Three.js brightness restored to 100%");
    }
    // Re-enable bloom
    if (window.SORSARI && window.SORSARI.bloomPass) {
      window.SORSARI.bloomPass.enabled = true;
      console.log("Bloom re-enabled");
    }
    // Re-enable chromatic aberration and screen shake
    window.ditherChromaticAberrationDisabled = false;
    window.ditherScreenShakeDisabled = false;
    console.log("Dithering mode disabled!");
  }
}

function startDither() {
  ditherCanvas = document.createElement("canvas");
  ditherCanvas.width = window.innerWidth * window.devicePixelRatio;
  ditherCanvas.height = window.innerHeight * window.devicePixelRatio;
  ditherCanvas.style.position = "fixed";
  ditherCanvas.style.top = "0";
  ditherCanvas.style.left = "0";
  ditherCanvas.style.zIndex = "10003"; // Above model-viewer (10002) but below UI
  ditherCanvas.style.pointerEvents = "none";
  ditherCanvas.style.width = "100%";
  ditherCanvas.style.height = "100%";
  ditherCanvas.style.imageRendering = "pixelated";
  document.body.appendChild(ditherCanvas);
  ditherCtx = ditherCanvas.getContext("2d", { willReadFrequently: true });

  ditherTempCanvas = document.createElement("canvas");
  ditherTempCanvas.width = window.innerWidth * window.devicePixelRatio;
  ditherTempCanvas.height = window.innerHeight * window.devicePixelRatio;
  ditherTempCtx = ditherTempCanvas.getContext("2d");

  // Downsample canvas for faster processing
  ditherDownsampleCanvas = document.createElement("canvas");
  ditherDownsampleCanvas.width = Math.ceil(
    window.innerWidth * DOWNSAMPLE_SCALE
  );
  ditherDownsampleCanvas.height = Math.ceil(
    window.innerHeight * DOWNSAMPLE_SCALE
  );
  ditherDownsampleCtx = ditherDownsampleCanvas.getContext("2d");

  // Cache canvases once
  cachedCanvases = Array.from(document.querySelectorAll("canvas")).filter(
    (c) => c !== ditherCanvas
  );

  // Also get canvas from model-viewer shadow DOM
  const modelViewer = document.querySelector("#model-viewer");
  if (modelViewer && modelViewer.shadowRoot) {
    const modelCanvas = modelViewer.shadowRoot.querySelector("canvas");
    if (modelCanvas && !cachedCanvases.includes(modelCanvas)) {
      cachedCanvases.push(modelCanvas);
    }
  }

  ditherFrameSkip = 0;

  ditherLoop();
}

function stopDither() {
  if (ditherCanvas) {
    ditherCanvas.remove();
    ditherCanvas = null;
    ditherCtx = null;
  }
  if (ditherTempCanvas) {
    ditherTempCanvas = null;
    ditherTempCtx = null;
  }
}

function reinitializeDither() {
  if (ditherActive) {
    stopDither();
    startDither();
  }
}

// Handle window resize events
window.addEventListener("resize", () => {
  if (ditherActive) {
    clearTimeout(ditherResizeTimeout);
    ditherResizeTimeout = setTimeout(() => {
      reinitializeDither();
    }, 250); // Wait 250ms after resize stops before reinitializing
  }
});

function ditherLoop() {
  if (!ditherActive || !ditherCanvas) return;

  // Skip frames for performance
  ditherFrameSkip++;
  if (ditherFrameSkip < FRAME_SKIP) {
    requestAnimationFrame(ditherLoop);
    return;
  }
  ditherFrameSkip = 0;

  // Capture screen at downsampled resolution
  try {
    const dpr = window.devicePixelRatio;

    // Clear downsample canvas
    ditherDownsampleCtx.fillStyle = "#000000";
    ditherDownsampleCtx.fillRect(
      0,
      0,
      ditherDownsampleCanvas.width,
      ditherDownsampleCanvas.height
    );

    // Draw cached canvases to downsample canvas
    cachedCanvases.forEach((canvas) => {
      try {
        const rect = canvas.getBoundingClientRect();
        // Account for canvas internal pixel ratio (for Three.js, etc)
        const canvasPixelRatio = canvas.width / rect.width;

        ditherDownsampleCtx.drawImage(
          canvas,
          0,
          0,
          canvas.width,
          canvas.height,
          rect.left * DOWNSAMPLE_SCALE,
          rect.top * DOWNSAMPLE_SCALE,
          rect.width * DOWNSAMPLE_SCALE,
          rect.height * DOWNSAMPLE_SCALE
        );
      } catch (e) {}
    });

    // Get image data from downsampled canvas (much faster!)
    const imageData = ditherDownsampleCtx.getImageData(
      0,
      0,
      ditherDownsampleCanvas.width,
      ditherDownsampleCanvas.height
    );

    applyDithering(imageData);

    // Draw dithered result back to downsample canvas
    ditherDownsampleCtx.putImageData(imageData, 0, 0);

    // Scale up to full resolution on display canvas
    ditherCtx.clearRect(0, 0, ditherCanvas.width, ditherCanvas.height);
    ditherCtx.drawImage(
      ditherDownsampleCanvas,
      0,
      0,
      ditherDownsampleCanvas.width,
      ditherDownsampleCanvas.height,
      0,
      0,
      ditherCanvas.width,
      ditherCanvas.height
    );
  } catch (e) {
    console.warn("Dithering error:", e);
  }

  requestAnimationFrame(ditherLoop);
}

function applyDithering(imageData) {
  const data = imageData.data;
  const levels = 6; // Reduce colors to 4 levels per channel (0, 85, 170, 255)
  const step = Math.floor(256 / levels);

  // Ultra-fast posterization - just quantize colors
  for (let i = 0; i < data.length; i += 4) {
    // Quantize each channel to nearest level
    data[i] = Math.round(data[i] / step) * step;
    data[i + 1] = Math.round(data[i + 1] / step) * step;
    data[i + 2] = Math.round(data[i + 2] / step) * step;
  }
}

window.toggleDither = toggleDither;
