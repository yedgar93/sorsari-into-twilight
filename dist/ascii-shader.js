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
let modelFrameSkipCounter = 0;
let purpleFrameSkipCounter = 0;
let resizeTimeout;

// Layer color mapping - different colors for different canvas layers
const LAYER_COLORS = {
  webgl: "#44227fa3", // Purple for main WebGL renderer
  stars: "#6dbdbdff", // Cyan for stars
  snes: "#FFFF00", // Yellow for SNES intro
  model: "#e158a1ff", // Pink for center model
  default: "#8000ffaa", // Purple fallback
};

// Track which canvas is which for coloring
let canvasLayerMap = {};

// Center model ASCII layer
let modelAsciiCanvas;
let modelAsciiCtx;

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
  asciiCanvas.style.width = canvasWidth + "px";
  asciiCanvas.style.height = canvasHeight + "px";
  document.body.appendChild(asciiCanvas);
  asciiCtx = asciiCanvas.getContext("2d", { willReadFrequently: true });

  // Pre-create temp canvas for reuse (avoid allocation every frame)
  tempCanvas = document.createElement("canvas");
  tempCanvas.width = canvasWidth;
  tempCanvas.height = canvasHeight;
  tempCtx = tempCanvas.getContext("2d");

  // Map canvas layers for coloring
  canvasLayerMap = {};
  const allCanvases = document.querySelectorAll("canvas");
  allCanvases.forEach((canvas) => {
    if (canvas === asciiCanvas) return;

    // Identify canvas by ID or class
    if (canvas.id === "stars-canvas" || canvas.className.includes("stars")) {
      canvasLayerMap[canvas] = "stars";
    } else if (
      canvas.id === "snes-canvas" ||
      canvas.className.includes("snes")
    ) {
      canvasLayerMap[canvas] = "snes";
    } else if (canvas === window.root?.renderer?.domElement) {
      canvasLayerMap[canvas] = "webgl";
    }
  });

  frameSkipCounter = 0;

  // Create separate ASCII layer for center model (pink overlay)
  // Get the actual model viewer size from the DOM
  const modelViewer = document.querySelector("#model-viewer");
  let modelWidth = 555;
  let modelHeight = 555;

  if (modelViewer) {
    const rect = modelViewer.getBoundingClientRect();
    modelWidth = rect.width || 555;
    modelHeight = rect.height || 555;
  }

  modelAsciiCanvas = document.createElement("canvas");
  modelAsciiCanvas.width = modelWidth; // Match model-viewer size
  modelAsciiCanvas.height = modelHeight;
  modelAsciiCanvas.style.position = "fixed";
  modelAsciiCanvas.style.top = "50%";
  modelAsciiCanvas.style.left = "50%";
  modelAsciiCanvas.style.transform = "translate(-50%, -50%)";
  modelAsciiCanvas.style.zIndex = "10009"; // Above main ASCII (10005)
  modelAsciiCanvas.style.pointerEvents = "none";
  modelAsciiCanvas.style.width = modelWidth + "px";
  modelAsciiCanvas.style.height = modelHeight + "px";
  document.body.appendChild(modelAsciiCanvas);
  modelAsciiCtx = modelAsciiCanvas.getContext("2d", {
    willReadFrequently: true,
  });

  console.log("ASCII canvas created:", canvasWidth, "x", canvasHeight);
  console.log("Canvas layer map:", canvasLayerMap);
  asciiLoop();
}

function stopASCII() {
  if (asciiCanvas) {
    asciiCanvas.remove();
    asciiCanvas = null;
    asciiCtx = null;
  }
  if (modelAsciiCanvas) {
    modelAsciiCanvas.remove();
    modelAsciiCanvas = null;
    modelAsciiCtx = null;
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
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      reinitializeASCII();
    }, 250); // Wait 250ms after resize stops before reinitializing
  }
});

const ASCII_CHARS = " .:-=+*#%@";
const CHAR_WIDTH = 8;
const CHAR_HEIGHT = 16;

function asciiLoop() {
  if (!asciiActive || !asciiCanvas) return;

  // Stop animation if song has ended
  if (window.visualizersStoppped) {
    console.log("[ASCII] Animation stopped - song ended");
    return;
  }

  // Frame skipping based on global FPS scale (CONFIG.fpsScale from script.js)
  frameSkipCounter++;
  const fpsScale = window.CONFIG?.fpsScale || 0.33;
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

    // Frame skip for purple layer only (half FPS)
    purpleFrameSkipCounter++;
    if (purpleFrameSkipCounter % 2 !== 0) {
      // Skip this frame for purple rendering, but still clear it
      asciiCtx.fillStyle = "#000000";
      asciiCtx.fillRect(0, 0, asciiCanvas.width, asciiCanvas.height);
      requestAnimationFrame(asciiLoop);
      return;
    }

    const data = imageData.data;
    const sourceWidth = imageData.width;
    const sourceHeight = imageData.height;

    // Calculate scale factor from source to canvas
    const scaleX = asciiCanvas.width / sourceWidth;
    const scaleY = asciiCanvas.height / sourceHeight;

    // Process in larger blocks for performance
    asciiCtx.fillStyle = "#8000ffff";
    asciiCtx.font = "thin 16px monospace";

    let charCount = 0;

    for (let y = 0; y < asciiCanvas.height; y += CHAR_HEIGHT) {
      for (let x = 0; x < asciiCanvas.width; x += CHAR_WIDTH) {
        // Map canvas coordinates back to source coordinates
        const sourceX = Math.floor(x / scaleX);
        const sourceY = Math.floor(y / scaleY);

        // Sample pixel block - average brightness
        let brightness = 0;
        let count = 0;

        for (
          let dy = 0;
          dy < CHAR_HEIGHT && sourceY + dy < sourceHeight;
          dy += 4
        ) {
          for (
            let dx = 0;
            dx < CHAR_WIDTH && sourceX + dx < sourceWidth;
            dx += 4
          ) {
            const idx = ((sourceY + dy) * sourceWidth + (sourceX + dx)) * 4;
            const r = data[idx] || 0;
            const g = data[idx + 1] || 0;
            const b = data[idx + 2] || 0;
            brightness += (r + g + b) / 3.2;
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
      console.warn("No ASCII characters rendered - image may be all black");
    }
  } catch (e) {
    console.warn("ASCII processing error:", e);
  }
} // End shouldRenderBackground

// Render center model ASCII layer (pink overlay)
if (modelAsciiCanvas && modelAsciiCtx) {
  try {
    // Clear model ASCII canvas
    modelAsciiCtx.fillStyle = "#000000";
    modelAsciiCtx.fillRect(
      0,
      0,
      modelAsciiCanvas.width,
      modelAsciiCanvas.height
    );

    // Get the model-viewer element
    const modelViewer = document.querySelector("#model-viewer");
    if (modelViewer) {
      try {
        // Try to access the internal canvas from model-viewer
        // model-viewer renders to a canvas in its shadow DOM
        let modelCanvas = null;

        // Try to get canvas from shadow DOM
        if (modelViewer.shadowRoot) {
          modelCanvas = modelViewer.shadowRoot.querySelector("canvas");
        }

        // If no shadow DOM canvas, try to find it in the light DOM
        if (!modelCanvas) {
          modelCanvas = modelViewer.querySelector("canvas");
        }

        // If still no canvas, try to access the renderer directly
        if (!modelCanvas && modelViewer.renderer) {
          modelCanvas = modelViewer.renderer.domElement;
        }

        // Debug: log what we found
        if (!modelCanvas && frameSkipCounter === 1) {
          console.log(
            "Model canvas not found. shadowRoot:",
            !!modelViewer.shadowRoot,
            "renderer:",
            !!modelViewer.renderer
          );
        }

        if (modelCanvas) {
          const tempModelCanvas = document.createElement("canvas");
          tempModelCanvas.width = 555;
          tempModelCanvas.height = 555;
          const tempModelCtx = tempModelCanvas.getContext("2d");

          // Draw the model canvas to temp canvas
          tempModelCtx.drawImage(modelCanvas, 0, 0, 555, 555);
          const imageData = tempModelCtx.getImageData(0, 0, 555, 555);
          const data = imageData.data;

          // Set pink color for model layer
          modelAsciiCtx.fillStyle = LAYER_COLORS.model;
          modelAsciiCtx.font = "regular 12px monospace";

          // Process model pixels with high intensity boost (model is very dim)
          const intensityBoost = 5.0;

          for (let y = 0; y < 555; y += CHAR_HEIGHT) {
            for (let x = 0; x < 555; x += CHAR_WIDTH) {
              let brightness = 0;
              let count = 0;

              for (let dy = 0; dy < CHAR_HEIGHT && y + dy < 555; dy += 4) {
                for (let dx = 0; dx < CHAR_WIDTH && x + dx < 555; dx += 4) {
                  const idx = ((y + dy) * 555 + (x + dx)) * 4;
                  const r = data[idx] || 0;
                  const g = data[idx + 1] || 0;
                  const b = data[idx + 2] || 0;
                  const a = data[idx + 3] || 0;

                  if (a > 0) {
                    brightness += (r + g + b) / 3;
                    count++;
                  }
                }
              }

              if (count > 0) {
                brightness = (brightness / count / 255) * intensityBoost;
                brightness = Math.min(1, brightness);

                const charIndex = Math.floor(
                  brightness * (ASCII_CHARS.length - 1)
                );
                const char = ASCII_CHARS[charIndex];

                if (char !== " ") {
                  modelAsciiCtx.fillText(char, x, y + CHAR_HEIGHT - 8);
                }
              }
            }
          }
        }
      } catch (e) {
        // Model viewer might not be ready or drawable
        console.debug("Model ASCII error:", e.message);
      }
    }
  } catch (e) {
    // Silently fail if model ASCII rendering has issues
  }
}

requestAnimationFrame(asciiLoop);

// Expose for debugging
window.toggleASCII = toggleASCII;
