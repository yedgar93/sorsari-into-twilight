/**
 * Debug Window Controls
 * - Keyboard listener to show debug window when typing "debug"
 * - Draggable debug window
 * - Skip buttons for jumping to specific times
 * - Hue rotate slider
 * - Time display
 * - Device motion enable function
 */

(function () {
  "use strict";

  // Keyboard listener to show debug window when typing "debug"
  let debugKeyBuffer = "";
  const debugKeyword = "debug";

  document.addEventListener("keypress", function (e) {
    debugKeyBuffer += e.key.toLowerCase();

    // Keep only the last 5 characters
    if (debugKeyBuffer.length > debugKeyword.length) {
      debugKeyBuffer = debugKeyBuffer.slice(-debugKeyword.length);
    }

    // Check if "debug" was typed
    if (debugKeyBuffer === debugKeyword) {
      const debugWindow = document.getElementById("debug-window");
      debugWindow.classList.toggle("hidden");
      debugKeyBuffer = ""; // Reset buffer
    }
  });

  // Make debug window draggable
  const debugWindow = document.getElementById("debug-window");
  const debugHeader = document.getElementById("debug-header");

  // Add event listeners for debug skip buttons (replaces inline onclick)
  document.querySelectorAll(".debug-btn[data-skip-time]").forEach((btn) => {
    btn.addEventListener("click", function () {
      const time = parseInt(this.dataset.skipTime, 10);
      if (typeof SORSARI.skipToTime === "function") {
        SORSARI.skipToTime(time);
      }
    });
  });

  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;

  debugHeader.addEventListener("mousedown", dragStart);
  document.addEventListener("mousemove", drag);
  document.addEventListener("mouseup", dragEnd);

  function dragStart(e) {
    initialX = e.clientX - debugWindow.offsetLeft;
    initialY = e.clientY - debugWindow.offsetTop;
    isDragging = true;
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      debugWindow.style.left = currentX + "px";
      debugWindow.style.top = currentY + "px";
    }
  }

  function dragEnd() {
    isDragging = false;
  }

  // Skip to time function (exposed via SORSARI namespace)
  // Note: This will be overridden by script.js with the full version that syncs all tracks
  window.SORSARI = window.SORSARI || {};
  SORSARI.skipToTime = function (seconds) {
    // Fallback implementation - will be replaced by script.js
    if (SORSARI.audioElement) {
      SORSARI.audioElement.currentTime = seconds;
      console.log(
        "Skipped to:",
        seconds,
        "seconds (fallback - single track only)"
      );
    } else {
      console.warn("Audio element not ready yet");
    }
  };

  // Update time display
  setInterval(() => {
    // Access the audioElement from SORSARI namespace
    if (SORSARI.audioElement) {
      const minutes = Math.floor(SORSARI.audioElement.currentTime / 60);
      const seconds = Math.floor(SORSARI.audioElement.currentTime % 60);
      document.getElementById(
        "time-display"
      ).textContent = `Time: ${minutes}:${seconds.toString().padStart(2, "0")}`;
    }
  }, 100);

  // Hue rotate slider control
  const hueSlider = document.getElementById("hue-slider");
  const hueValue = document.getElementById("hue-value");
  const htmlElement = document.documentElement;

  hueSlider.addEventListener("input", function () {
    const hueRotate = this.value;
    hueValue.textContent = hueRotate;
    htmlElement.style.filter = `hue-rotate(${hueRotate}deg)`;
  });

  // Depth-of-field blur sliders
  // Expose blur values in SORSARI namespace so stars.js can access them
  window.SORSARI = window.SORSARI || {};
  window.SORSARI.dofBlur = {
    layer1: 0.0,
    layer2: 3.0,
    layer3: 0.0,
    triangles: 5.0,
  };

  // Layer 1 blur slider
  const layer1BlurSlider = document.getElementById("layer1-blur-slider");
  const layer1BlurValue = document.getElementById("layer1-blur-value");
  layer1BlurSlider.addEventListener("input", function () {
    SORSARI.dofBlur.layer1 = parseFloat(this.value);
    layer1BlurValue.textContent = this.value;
  });

  // Layer 2 blur slider
  const layer2BlurSlider = document.getElementById("layer2-blur-slider");
  const layer2BlurValue = document.getElementById("layer2-blur-value");
  layer2BlurSlider.addEventListener("input", function () {
    SORSARI.dofBlur.layer2 = parseFloat(this.value);
    layer2BlurValue.textContent = this.value;
  });

  // Layer 3 blur slider
  const layer3BlurSlider = document.getElementById("layer3-blur-slider");
  const layer3BlurValue = document.getElementById("layer3-blur-value");
  layer3BlurSlider.addEventListener("input", function () {
    SORSARI.dofBlur.layer3 = parseFloat(this.value);
    layer3BlurValue.textContent = this.value;
  });

  // Triangles blur slider
  const trianglesBlurSlider = document.getElementById("triangles-blur-slider");
  const trianglesBlurValue = document.getElementById("triangles-blur-value");
  const threeContainer = document.getElementById("three-container");
  trianglesBlurSlider.addEventListener("input", function () {
    SORSARI.dofBlur.triangles = parseFloat(this.value);
    trianglesBlurValue.textContent = this.value;
    if (threeContainer) {
      threeContainer.style.filter = `blur(${this.value}px)`;
    }
  });

  // Debug log to screen (exposed via SORSARI namespace)
  SORSARI.debugLog = function (msg) {
    const debugLogEl = document.getElementById("debug-log");
    if (debugLogEl) {
      const timestamp = new Date().toLocaleTimeString();
      debugLogEl.innerHTML = `[${timestamp}] ${msg}<br>` + debugLogEl.innerHTML;
    }
    console.log(msg);
  };

  // Canvas layer visibility toggles - wait for DOM to be ready
  function setupCanvasToggles() {
    const starsCanvasBtn = document.getElementById("toggle-stars-canvas");
    const threeContainerBtn = document.getElementById("toggle-three-container");
    const modelsBtn = document.getElementById("toggle-models");
    const visualizerBtn = document.getElementById("toggle-visualizer");
    const starsCanvas = document.getElementById("stars-canvas");
    const threeContainerEl = document.getElementById("three-container");
    const modelViewer = document.getElementById("model-viewer");
    const terrorModelViewer = document.getElementById("terror-model-viewer");
    const visualizerCanvas = document.getElementById("visualizer-canvas");

    console.log("[Debug] starsCanvasBtn:", starsCanvasBtn);
    console.log("[Debug] threeContainerBtn:", threeContainerBtn);
    console.log("[Debug] modelsBtn:", modelsBtn);
    console.log("[Debug] starsCanvas:", starsCanvas);
    console.log("[Debug] threeContainerEl:", threeContainerEl);
    console.log("[Debug] modelViewer:", modelViewer);
    console.log("[Debug] terrorModelViewer:", terrorModelViewer);

    // Track visibility state
    let starsCanvasVisible = true;
    let threeContainerVisible = true;
    let modelsVisible = true;

    if (starsCanvasBtn && starsCanvas) {
      console.log("[Debug] Attaching stars canvas toggle");
      starsCanvasBtn.addEventListener("click", function () {
        console.log("[Debug] Stars canvas toggle clicked");
        starsCanvasVisible = !starsCanvasVisible;
        starsCanvas.style.display = starsCanvasVisible ? "block" : "none";
        starsCanvasBtn.textContent = starsCanvasVisible ? "Stars ✓" : "Stars ✗";
        starsCanvasBtn.style.opacity = starsCanvasVisible ? "1" : "0.5";
      });
    } else {
      console.log(
        "[Debug] Could not attach stars canvas toggle - missing elements"
      );
    }

    if (threeContainerBtn && threeContainerEl) {
      console.log("[Debug] Attaching three container toggle");
      threeContainerBtn.addEventListener("click", function () {
        console.log("[Debug] Three container toggle clicked");
        threeContainerVisible = !threeContainerVisible;
        threeContainerEl.style.display = threeContainerVisible
          ? "block"
          : "none";
        threeContainerBtn.textContent = threeContainerVisible
          ? "Triangles ✓"
          : "Triangles ✗";
        threeContainerBtn.style.opacity = threeContainerVisible ? "1" : "0.5";
      });
    } else {
      console.log(
        "[Debug] Could not attach three container toggle - missing elements"
      );
    }

    if (modelsBtn && modelViewer && terrorModelViewer) {
      console.log("[Debug] Attaching models toggle");
      modelsBtn.addEventListener("click", function () {
        console.log("[Debug] Models toggle clicked");
        modelsVisible = !modelsVisible;
        modelViewer.style.display = modelsVisible ? "block" : "none";
        terrorModelViewer.style.display = modelsVisible ? "block" : "none";
        modelsBtn.textContent = modelsVisible ? "Models ✓" : "Models ✗";
        modelsBtn.style.opacity = modelsVisible ? "1" : "0.5";
      });
    } else {
      console.log("[Debug] Could not attach models toggle - missing elements");
    }

    // Track visualizer visibility state
    let visualizerVisible = true;

    if (visualizerBtn && visualizerCanvas) {
      console.log("[Debug] Attaching visualizer toggle");
      visualizerBtn.addEventListener("click", function () {
        console.log("[Debug] Visualizer toggle clicked");
        visualizerVisible = !visualizerVisible;
        visualizerCanvas.style.display = visualizerVisible ? "block" : "none";
        visualizerBtn.textContent = visualizerVisible
          ? "Visualizer ✓"
          : "Visualizer ✗";
        visualizerBtn.style.opacity = visualizerVisible ? "1" : "0.5";
      });
    } else {
      console.log(
        "[Debug] Could not attach visualizer toggle - missing elements"
      );
    }
  }

  // Run setup when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupCanvasToggles);
  } else {
    setupCanvasToggles();
  }

  // Enable device motion function (for iOS 13+)
  SORSARI.enableDeviceMotion = async function () {
    const btn = document.getElementById("enable-motion-btn");
    SORSARI.debugLog("enableDeviceMotion called");
    SORSARI.debugLog(
      "DeviceOrientationEvent: " + typeof DeviceOrientationEvent
    );
    SORSARI.debugLog(
      "requestPermission: " + typeof DeviceOrientationEvent?.requestPermission
    );
    SORSARI.debugLog("Protocol: " + window.location.protocol);
    SORSARI.debugLog("Hostname: " + window.location.hostname);

    try {
      if (
        typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function"
      ) {
        // iOS 13+ requires permission
        SORSARI.debugLog("Requesting iOS device orientation permission...");
        const permission = await DeviceOrientationEvent.requestPermission();
        SORSARI.debugLog("Permission result: " + permission);

        if (permission === "granted") {
          btn.textContent = "Motion Enabled ✓";
          btn.style.backgroundColor = "#4CAF50";
          SORSARI.debugLog("Device motion permission granted");
          SORSARI.deviceMotionEnabled = true;
        } else {
          btn.textContent = "Permission: " + permission;
          btn.style.backgroundColor = "#f44336";
          SORSARI.debugLog("Device motion permission result: " + permission);
        }
      } else {
        // Android or older iOS - no permission needed
        btn.textContent = "Motion Active ✓";
        btn.style.backgroundColor = "#4CAF50";
        SORSARI.debugLog("Device motion available (no permission needed)");
        SORSARI.deviceMotionEnabled = true;
      }
    } catch (error) {
      SORSARI.debugLog("ERROR: " + error.message);
      SORSARI.debugLog("Error name: " + error.name);
      btn.textContent = "Error: " + error.message;
      btn.style.backgroundColor = "#f44336";
    }
  };
})();
