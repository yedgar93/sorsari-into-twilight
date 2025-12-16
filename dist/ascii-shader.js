// ASCII Art Shader Easter Egg - Full Screen
// Type "ascii" to toggle real-time ASCII conversion on EVERYTHING

let asciiBuffer = "";
let asciiTimeout;
let asciiActive = false;
let asciiCanvas;
let asciiCtx;
let asciiImageData;
let tempCanvas;
let tempCtx;
let frameSkipCounter = 0;
let modelFrameSkipCounter = 0;
let purpleFrameSkipCounter = 0;
let resizeTimeout;

// Layer color mapping
const LAYER_COLORS = {
  webgl: "#44227fa3",
  stars: "#6dbdbdff",
  snes: "#FFFF00",
  model: "#e158a1ff",
  default: "#8000ffaa",
};

let canvasLayerMap = {};
let modelAsciiCanvas;
let modelAsciiCtx;

// Character sizes - model uses smaller chars for detail
const ASCII_CHARS = " .:-=+*#%@";
const CHAR_WIDTH = 12;
const CHAR_HEIGHT = 18;
const MODEL_CHAR_WIDTH = 6;
const MODEL_CHAR_HEIGHT = 12;

// Pre-calculate character count for brightness mapping
const CHAR_COUNT = ASCII_CHARS.length - 1;

// Listen for "ascii" keypress (disabled on mobile to save CPU)
const isMobileASCII =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

if (!isMobileASCII) {
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
}

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
  // Always use full window size for ASCII canvas
  let canvasWidth = window.innerWidth;
  let canvasHeight = window.innerHeight;

  asciiCanvas = document.createElement("canvas");
  asciiCanvas.width = canvasWidth;
  asciiCanvas.height = canvasHeight;
  asciiCanvas.style.position = "fixed";
  asciiCanvas.style.top = "0";
  asciiCanvas.style.left = "0";
  asciiCanvas.style.zIndex = "10005";
  asciiCanvas.style.pointerEvents = "none";
  asciiCanvas.style.width = "100%";
  asciiCanvas.style.height = "100%";
  document.body.appendChild(asciiCanvas);
  asciiCtx = asciiCanvas.getContext("2d", { willReadFrequently: true });

  tempCanvas = document.createElement("canvas");
  tempCanvas.width = canvasWidth;
  tempCanvas.height = canvasHeight;
  tempCtx = tempCanvas.getContext("2d");

  canvasLayerMap = {};
  const allCanvases = document.querySelectorAll("canvas");
  allCanvases.forEach((canvas) => {
    if (canvas === asciiCanvas) return;
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
  modelFrameSkipCounter = 0;

  // Create model ASCII layer (pink overlay, smaller chars, transparent background)
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
  modelAsciiCanvas.width = modelWidth;
  modelAsciiCanvas.height = modelHeight;
  modelAsciiCanvas.style.position = "fixed";
  modelAsciiCanvas.style.top = "50%";
  modelAsciiCanvas.style.left = "50%";
  modelAsciiCanvas.style.transform = "translate(-50%, -50%)";
  modelAsciiCanvas.style.zIndex = "10007";
  modelAsciiCanvas.style.pointerEvents = "none";
  modelAsciiCanvas.style.backgroundColor = "transparent";
  modelAsciiCanvas.style.width = modelWidth + "px";
  modelAsciiCanvas.style.height = modelHeight + "px";
  document.body.appendChild(modelAsciiCanvas);
  modelAsciiCtx = modelAsciiCanvas.getContext("2d", {
    willReadFrequently: true,
  });

  console.log("ASCII canvas created:", canvasWidth, "x", canvasHeight);
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

window.addEventListener("resize", () => {
  if (asciiActive) {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      reinitializeASCII();
    }, 250); // Wait 250ms after resize stops before reinitializing
  }
});

function asciiLoop() {
  if (!asciiActive || !asciiCanvas) return;

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
            // Skip the ASCII canvas itself and model ASCII canvas
            if (canvas === asciiCanvas || canvas === modelAsciiCanvas) return;
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
      // No characters rendered (image may be all black)
    }
  } catch (e) {
    console.warn("ASCII processing error:", e);
  }

  // Render center model ASCII layer (pink overlay, smaller chars) - EVERY FRAME
  if (modelAsciiCanvas && modelAsciiCtx) {
    try {
      // Clear model ASCII canvas (transparent background)
      modelAsciiCtx.clearRect(
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
          let modelCanvas = null;

          // Try to get canvas from shadow DOM
          if (modelViewer.shadowRoot) {
            modelCanvas = modelViewer.shadowRoot.querySelector("canvas");
          }

          // If no shadow DOM canvas, try to find it in the light DOM
          if (!modelCanvas) {
            modelCanvas = modelViewer.querySelector("canvas");
          }

          if (modelCanvas) {
            // Get image data directly from model canvas
            const ctx = modelCanvas.getContext("2d");
            if (ctx) {
              const modelImageData = ctx.getImageData(
                0,
                0,
                modelCanvas.width,
                modelCanvas.height
              );
              const modelData = modelImageData.data;

              // Calculate scale factor from source to canvas
              const modelScaleX = modelAsciiCanvas.width / modelCanvas.width;
              const modelScaleY = modelAsciiCanvas.height / modelCanvas.height;

              // Process in blocks like the main ASCII rendering
              modelAsciiCtx.fillStyle = LAYER_COLORS.model;
              modelAsciiCtx.font = "regular 8px monospace";

              for (
                let y = 0;
                y < modelAsciiCanvas.height;
                y += MODEL_CHAR_HEIGHT
              ) {
                for (
                  let x = 0;
                  x < modelAsciiCanvas.width;
                  x += MODEL_CHAR_WIDTH
                ) {
                  // Map canvas coordinates back to source coordinates
                  const sourceX = Math.floor(x / modelScaleX);
                  const sourceY = Math.floor(y / modelScaleY);

                  // Sample pixel block - average brightness
                  let brightness = 0;
                  let count = 0;

                  for (
                    let dy = 0;
                    dy < MODEL_CHAR_HEIGHT && sourceY + dy < modelCanvas.height;
                    dy += 2
                  ) {
                    for (
                      let dx = 0;
                      dx < MODEL_CHAR_WIDTH && sourceX + dx < modelCanvas.width;
                      dx += 2
                    ) {
                      const idx =
                        ((sourceY + dy) * modelCanvas.width + (sourceX + dx)) *
                        4;
                      const r = modelData[idx] || 0;
                      const g = modelData[idx + 1] || 0;
                      const b = modelData[idx + 2] || 0;
                      const a = modelData[idx + 3] || 0;

                      // Only sample non-transparent pixels
                      if (a > 128) {
                        brightness += (r + g + b) / 3;
                        count++;
                      }
                    }
                  }

                  if (count > 0) {
                    brightness = brightness / count / 255;
                    const charIndex = Math.floor(
                      brightness * (ASCII_CHARS.length - 1)
                    );
                    const char = ASCII_CHARS[charIndex];

                    if (char !== " ") {
                      modelAsciiCtx.fillText(
                        char,
                        x,
                        y + MODEL_CHAR_HEIGHT - 4
                      );
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          // Model viewer not accessible
        }
      }
    } catch (e) {
      console.warn("Model ASCII processing error:", e);
    }
  }

  requestAnimationFrame(asciiLoop);
}

window.toggleASCII = toggleASCII;
