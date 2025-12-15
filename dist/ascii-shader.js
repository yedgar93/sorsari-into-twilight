// ASCII Art Shader Easter Egg - Full Screen
// Type "ascii" to toggle real-time ASCII conversion on EVERYTHING

let asciiBuffer = "";
let asciiTimeout;
let asciiActive = false;
let asciiCanvas;
let asciiCtx;
let asciiImageData;
let tempCanvas; // Reuse temp canvas instead of creating new one each frame
let tempCtx;
let frameSkipCounter = 0;

// Listen for "ascii" keypress
document.addEventListener("keydown", (e) => {
  asciiBuffer += e.key.toLowerCase();

  if (asciiBuffer.length > 5) {
    asciiBuffer = asciiBuffer.slice(-5);
  }

  if (asciiBuffer.includes("ascii")) {
    toggleASCII();
    asciiBuffer = "";
  }

  clearTimeout(asciiTimeout);
  asciiTimeout = setTimeout(() => {
    asciiBuffer = "";
  }, 2000);
});

function toggleASCII() {
  asciiActive = !asciiActive;

  if (asciiActive) {
    startASCII();
    console.log("ASCII mode enabled!");
  } else {
    stopASCII();
    console.log("ASCII mode disabled!");
  }
}

function startASCII() {
  // Get canvas size from the THREE.js renderer (most reliable source)
  let canvasWidth = window.innerWidth;
  let canvasHeight = window.innerHeight;

  if (window.root && window.root.renderer) {
    canvasWidth = window.root.renderer.domElement.width;
    canvasHeight = window.root.renderer.domElement.height;
  }

  // Create full-screen canvas overlay
  asciiCanvas = document.createElement("canvas");
  asciiCanvas.width = canvasWidth;
  asciiCanvas.height = canvasHeight;
  asciiCanvas.style.position = "fixed";
  asciiCanvas.style.top = "0";
  asciiCanvas.style.left = "0";
  asciiCanvas.style.zIndex = "10005";
  asciiCanvas.style.pointerEvents = "none";
  asciiCanvas.style.width = "100vw";
  asciiCanvas.style.height = "100vh";
  document.body.appendChild(asciiCanvas);
  asciiCtx = asciiCanvas.getContext("2d", { willReadFrequently: true });

  // Pre-create temp canvas for reuse (avoid allocation every frame)
  tempCanvas = document.createElement("canvas");
  tempCanvas.width = canvasWidth;
  tempCanvas.height = canvasHeight;
  tempCtx = tempCanvas.getContext("2d");

  frameSkipCounter = 0;
  console.log("ASCII canvas created:", canvasWidth, "x", canvasHeight);
  asciiLoop();
}

function stopASCII() {
  if (asciiCanvas) {
    asciiCanvas.remove();
    asciiCanvas = null;
    asciiCtx = null;
  }
  if (tempCanvas) {
    tempCanvas = null;
    tempCtx = null;
  }
}

function reinitializeASCII() {
  if (asciiActive) {
    stopASCII();
    startASCII();
  }
}

// Listen for window resize and reinitialize ASCII if active
window.addEventListener("resize", () => {
  if (asciiActive) {
    reinitializeASCII();
  }
});

const ASCII_CHARS = " .:-=+*#%@";
const CHAR_WIDTH = 8;
const CHAR_HEIGHT = 16;

function asciiLoop() {
  if (!asciiActive || !asciiCanvas) return;

  // Frame skipping based on global FPS scale (CONFIG.fpsScale from script.js)
  frameSkipCounter++;
  const fpsScale = window.CONFIG?.fpsScale || 0.77;
  const frameSkipInterval = Math.max(1, Math.round(1 / fpsScale));

  if (frameSkipInterval > 1 && frameSkipCounter % frameSkipInterval !== 0) {
    requestAnimationFrame(asciiLoop);
    return;
  }

  // Clear ASCII canvas
  asciiCtx.fillStyle = "#000000";
  asciiCtx.fillRect(0, 0, asciiCanvas.width, asciiCanvas.height);

  // Get pixel data from screen
  try {
    // Try to get data from the renderer if available
    let imageData = null;

    if (window.root && window.root.renderer) {
      try {
        // Read pixels directly from WebGL renderer
        const renderer = window.root.renderer;
        const canvas = renderer.domElement;
        const width = canvas.width;
        const height = canvas.height;

        // Reuse temp canvas instead of creating new one
        tempCanvas.width = width;
        tempCanvas.height = height;
        tempCtx.drawImage(canvas, 0, 0);

        imageData = tempCtx.getImageData(0, 0, width, height);
      } catch (e) {
        console.warn("Could not read from WebGL renderer:", e.message);
      }
    }

    // Fallback: try to read from canvas directly
    if (!imageData) {
      const allCanvases = document.querySelectorAll("canvas");
      if (allCanvases.length > 0) {
        tempCanvas.width = window.innerWidth;
        tempCanvas.height = window.innerHeight;

        tempCtx.fillStyle = "#000000";
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        // Draw all canvases in order (including stars canvas)
        allCanvases.forEach((canvas) => {
          try {
            // Skip the ASCII canvas itself
            if (canvas === asciiCanvas) return;
            tempCtx.drawImage(canvas, 0, 0);
          } catch (e) {
            // Skip canvases that can't be read (e.g., WebGL)
          }
        });

        imageData = tempCtx.getImageData(
          0,
          0,
          tempCanvas.width,
          tempCanvas.height
        );
      }
    }

    if (!imageData) {
      requestAnimationFrame(asciiLoop);
      return;
    }

    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Process in larger blocks for performance
    asciiCtx.fillStyle = "#8000ffff";
    asciiCtx.font = "regular 12px monospace";

    let charCount = 0;

    for (let y = 0; y < asciiCanvas.height; y += CHAR_HEIGHT) {
      for (let x = 0; x < asciiCanvas.width; x += CHAR_WIDTH) {
        // Sample pixel block - average brightness
        let brightness = 0;
        let count = 0;

        for (let dy = 0; dy < CHAR_HEIGHT && y + dy < height; dy += 4) {
          for (let dx = 0; dx < CHAR_WIDTH && x + dx < width; dx += 4) {
            const idx = ((y + dy) * width + (x + dx)) * 4;
            const r = data[idx] || 0;
            const g = data[idx + 1] || 0;
            const b = data[idx + 2] || 0;
            brightness += (r + g + b) / 3;
            count++;
          }
        }

        if (count > 0) {
          brightness = brightness / count / 255;
          const charIndex = Math.floor(brightness * (ASCII_CHARS.length - 1));
          const char = ASCII_CHARS[charIndex];

          if (char !== " ") {
            asciiCtx.fillText(char, x, y + CHAR_HEIGHT - 8);
            charCount++;
          }
        }
      }
    }

    if (charCount === 0) {
      // No characters rendered (image may be all black)
    }
  } catch (e) {
    console.warn("ASCII processing error:", e);
  }

  requestAnimationFrame(asciiLoop);
}

// Expose for debugging
window.toggleASCII = toggleASCII;
