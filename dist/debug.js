/// <reference path="./types.d.ts" />

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

  // Use centralized mobile detection from script.js
  // Keyboard listener disabled on mobile to save CPU
  const isMobileDebug = window.SORSARI?.isMobile ?? false;

  if (!isMobileDebug) {
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
  }

  // Seven-tap gesture to toggle debug window
  let tapTimes = [];
  const requiredTaps = 7;
  const tapWindow = 1500; // milliseconds

  function handleTapGesture(e) {
    // Ignore taps on the debug window itself or interactive elements
    if (
      e.target.closest("#debug-window") ||
      e.target.closest("button") ||
      e.target.closest("input") ||
      e.target.closest("model-viewer")
    ) {
      return;
    }

    const now = Date.now();
    tapTimes.push(now);

    // Remove taps older than the time window
    tapTimes = tapTimes.filter((time) => now - time < tapWindow);

    // Check if we have enough taps
    if (tapTimes.length >= requiredTaps) {
      const debugWindow = document.getElementById("debug-window");
      debugWindow.classList.toggle("hidden");
      tapTimes = []; // Reset
    }
  }

  document.addEventListener("click", handleTapGesture);
  document.addEventListener("touchstart", handleTapGesture, { passive: true });

  // Close button handler
  const closeBtn = document.getElementById("debug-close-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      debugWindow.classList.add("hidden");
    });
  }

  // Toggle button handler (collapse/expand)
  const toggleBtn = document.getElementById("debug-toggle-btn");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      debugWindow.classList.toggle("collapsed");
    });
  }

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

  // Failsafe trigger button
  const failsafeBtn = document.getElementById("trigger-failsafe-btn");
  if (failsafeBtn) {
    failsafeBtn.addEventListener("click", function () {
      if (typeof triggerLowPowerFailsafe === "function") {
        console.log("[Debug] Manually triggering Low-Power Failsafe");
        triggerLowPowerFailsafe();
      } else {
        console.error("[Debug] triggerLowPowerFailsafe function not found");
      }
    });
  }

  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;

  // Mouse events
  debugHeader.addEventListener("mousedown", dragStart);
  document.addEventListener("mousemove", drag);
  document.addEventListener("mouseup", dragEnd);

  // Touch events
  debugHeader.addEventListener("touchstart", dragStart, { passive: false });
  document.addEventListener("touchmove", drag, { passive: false });
  document.addEventListener("touchend", dragEnd);

  function dragStart(e) {
    // Handle both mouse and touch events
    const clientX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;

    initialX = clientX - debugWindow.offsetLeft;
    initialY = clientY - debugWindow.offsetTop;
    isDragging = true;
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();

      // Handle both mouse and touch events
      const clientX = e.type === "touchmove" ? e.touches[0].clientX : e.clientX;
      const clientY = e.type === "touchmove" ? e.touches[0].clientY : e.clientY;

      currentX = clientX - initialX;
      currentY = clientY - initialY;

      // Constrain to viewport
      const maxX = window.innerWidth - debugWindow.offsetWidth;
      const maxY = window.innerHeight - debugWindow.offsetHeight;
      currentX = Math.max(0, Math.min(currentX, maxX));
      currentY = Math.max(0, Math.min(currentY, maxY));

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
      const currentTime = SORSARI.audioElement.currentTime;
      const duration = SORSARI.audioElement.duration;

      // Update time display
      const minutes = Math.floor(currentTime / 60);
      const seconds = Math.floor(currentTime % 60);
      document.getElementById(
        "time-display"
      ).textContent = `Time: ${minutes}:${seconds.toString().padStart(2, "0")}`;

      // Update progress bar
      if (duration > 0) {
        const progress = (currentTime / duration) * 100;
        const progressBar = document.getElementById("song-progress-bar");
        if (progressBar) {
          progressBar.style.width = progress + "%";
        }
      }
    }
  }, 42);

  // Hue rotate slider control
  const hueSlider = document.getElementById("hue-slider");
  const hueValue = document.getElementById("hue-value");
  const htmlElement = document.documentElement;

  hueSlider.addEventListener("input", function () {
    const hueRotate = this.value;
    hueValue.textContent = hueRotate;
    htmlElement.style.filter = `hue-rotate(${hueRotate}deg)`;
  });

  // Console log capture for debug menu
  const consoleLogQueue = [];
  const maxLogs = 50;
  const debugLogElement = document.getElementById("debug-log"); // Cached to avoid repeated queries in captureLog()

  // Intercept console methods
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  function captureLog(type, args) {
    const message = args
      .map((arg) => {
        if (typeof arg === "object") {
          try {
            return JSON.stringify(arg);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(" ");

    const logEntry = `[${type}] ${message}`;
    consoleLogQueue.push(logEntry);

    // Keep only recent logs
    if (consoleLogQueue.length > maxLogs) {
      consoleLogQueue.shift();
    }

    // Update debug log display on next interval
    if (debugLogElement) {
      debugLogElement.innerHTML = consoleLogQueue
        .map((log) => `<div>${log}</div>`)
        .reverse()
        .join("");
    }
  }

  // console.log = function (...args) {
  //   originalLog.apply(console, args);
  //   captureLog("LOG", args);
  // };

  // console.warn = function (...args) {
  //   originalWarn.apply(console, args);
  //   captureLog("WARN", args);
  // };

  // console.error = function (...args) {
  //   originalError.apply(console, args);
  //   captureLog("ERROR", args);
  // };

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
  if (layer1BlurSlider && layer1BlurValue) {
    layer1BlurSlider.addEventListener("input", function () {
      SORSARI.dofBlur.layer1 = parseFloat(this.value);
      layer1BlurValue.textContent = this.value;
    });
  }

  // Layer 2 blur slider
  const layer2BlurSlider = document.getElementById("layer2-blur-slider");
  const layer2BlurValue = document.getElementById("layer2-blur-value");
  if (layer2BlurSlider && layer2BlurValue) {
    layer2BlurSlider.addEventListener("input", function () {
      SORSARI.dofBlur.layer2 = parseFloat(this.value);
      layer2BlurValue.textContent = this.value;
    });
  }

  // Layer 3 blur slider
  const layer3BlurSlider = document.getElementById("layer3-blur-slider");
  const layer3BlurValue = document.getElementById("layer3-blur-value");
  if (layer3BlurSlider && layer3BlurValue) {
    layer3BlurSlider.addEventListener("input", function () {
      SORSARI.dofBlur.layer3 = parseFloat(this.value);
      layer3BlurValue.textContent = this.value;
    });
  }

  // Triangles blur slider
  const trianglesBlurSlider = document.getElementById("triangles-blur-slider");
  const trianglesBlurValue = document.getElementById("triangles-blur-value");
  const threeContainer = document.getElementById("three-container");
  if (trianglesBlurSlider && trianglesBlurValue) {
    trianglesBlurSlider.addEventListener("input", function () {
      SORSARI.dofBlur.triangles = parseFloat(this.value);
      trianglesBlurValue.textContent = this.value;
      if (threeContainer) {
        threeContainer.style.filter = `blur(${this.value}px)`;
      }
    });
  }

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
    const bloomBtn = document.getElementById("toggle-bloom");
    const radialBlurSlider = document.getElementById("radial-blur-slider");
    const radialBlurValue = document.getElementById("radial-blur-value");
    const starsCanvas = document.getElementById("stars-canvas");
    const threeContainerEl = document.getElementById("three-container");
    const modelViewer = document.getElementById("model-viewer");
    const terrorModelViewer = document.getElementById("terror-model-viewer");
    const visualizerCanvas = document.getElementById("visualizer-canvas");

    console.log("[Canvas Toggle] Button elements found:", {
      starsCanvasBtn: !!starsCanvasBtn,
      threeContainerBtn: !!threeContainerBtn,
      modelsBtn: !!modelsBtn,
      visualizerBtn: !!visualizerBtn,
    });

    console.log("[Canvas Toggle] DOM elements found:", {
      starsCanvas: !!starsCanvas,
      threeContainerEl: !!threeContainerEl,
      modelViewer: !!modelViewer,
      terrorModelViewer: !!terrorModelViewer,
      visualizerCanvas: !!visualizerCanvas,
    });

    // Track visibility state
    let starsCanvasVisible = true;
    let threeContainerVisible = true;
    let modelsVisible = true;

    if (starsCanvasBtn && starsCanvas) {
      console.log("[Debug] Attaching stars canvas toggle");
      starsCanvasBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        console.log("[Debug] Stars canvas toggle clicked");
        starsCanvasVisible = !starsCanvasVisible;
        starsCanvas.style.visibility = starsCanvasVisible
          ? "visible"
          : "hidden";
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
      threeContainerBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        console.log("[Debug] Three container toggle clicked");
        threeContainerVisible = !threeContainerVisible;
        threeContainerEl.style.visibility = threeContainerVisible
          ? "visible"
          : "hidden";
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
      modelsBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        console.log("[Debug] Models toggle clicked");
        modelsVisible = !modelsVisible;
        modelViewer.style.visibility = modelsVisible ? "visible" : "hidden";
        terrorModelViewer.style.visibility = modelsVisible
          ? "visible"
          : "hidden";
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
      visualizerBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        console.log("[Debug] Visualizer toggle clicked");
        visualizerVisible = !visualizerVisible;
        visualizerCanvas.style.visibility = visualizerVisible
          ? "visible"
          : "hidden";
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

    // Bloom toggle
    let bloomEnabled = true;
    if (bloomBtn) {
      console.log("[Debug] Attaching bloom toggle");
      bloomBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        console.log("[Debug] Bloom toggle clicked");
        if (window.SORSARI && window.SORSARI.bloomPass) {
          bloomEnabled = !bloomEnabled;
          window.SORSARI.bloomPass.enabled = bloomEnabled;
          bloomBtn.textContent = bloomEnabled ? "Bloom ✓" : "Bloom ✗";
          bloomBtn.style.opacity = bloomEnabled ? "1" : "0.5";
          console.log("Bloom:", bloomEnabled ? "enabled" : "disabled");
        } else {
          console.log("[Debug] Bloom pass not available");
        }
      });
    } else {
      console.log("[Debug] Could not attach bloom toggle - missing element");
    }

    // Radial blur strength slider
    if (radialBlurSlider && radialBlurValue) {
      console.log("[Debug] Attaching radial blur slider");
      radialBlurSlider.addEventListener("input", function (e) {
        e.stopPropagation();
        const strength = parseFloat(this.value);
        radialBlurValue.textContent = strength.toFixed(1);
        console.log("[Debug] Radial blur strength changed to:", strength);
        if (window.SORSARI && window.SORSARI.radialBlurPass) {
          window.SORSARI.radialBlurPass.uniforms.strength.value = strength;
          console.log("Radial blur strength:", strength);
        } else {
          console.log("[Debug] Radial blur pass not available");
        }
      });
    } else {
      console.log(
        "[Debug] Could not attach radial blur slider - missing elements"
      );
    }
  }

  // Run setup when DOM is ready
  // Retry mechanism: elements may not be loaded when script runs
  let setupAttempts = 0;
  const maxAttempts = 50;

  function trySetupCanvasToggles() {
    setupAttempts++;

    // Check if critical elements exist
    const starsCanvas = document.getElementById("stars-canvas");
    const threeContainer = document.getElementById("three-container");

    if (starsCanvas && threeContainer) {
      console.log("[Canvas Toggle] Elements found on attempt " + setupAttempts);
      setupCanvasToggles();
    } else if (setupAttempts < maxAttempts) {
      // Retry in 100ms
      setTimeout(trySetupCanvasToggles, 100);
    } else {
      console.warn(
        "[Canvas Toggle] Failed to find elements after " +
          maxAttempts +
          " attempts"
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", trySetupCanvasToggles);
  } else {
    trySetupCanvasToggles();
  }

  // Stars fade-out backup (3:20 to 3:46.5)
  // Uses clip-path to shrink the visible area instead of opacity
  // Wait for the element to exist before setting up the fade
  function initStarsFade() {
    const starsFadeWrapperElement =
      document.getElementById("stars-fade-wrapper");
    if (!starsFadeWrapperElement) {
      // Element doesn't exist yet, try again in 100ms
      setTimeout(initStarsFade, 100);
      return;
    }

    let lastLoggedTime = -1;
    setInterval(() => {
      // Use audioElement.currentTime as the source of truth
      let currentTime = 0;
      if (SORSARI.audioElement) {
        currentTime = SORSARI.audioElement.currentTime;
      } else if (SORSARI.musicTime) {
        currentTime = SORSARI.musicTime;
      }

      const fadeStartTime = 200; // 3:20
      const fadeEndTime = 226.5; // 3:46.5

      if (currentTime >= fadeStartTime && currentTime < fadeEndTime) {
        // Fade opacity from 1 to 0
        const fadeProgress =
          (currentTime - fadeStartTime) / (fadeEndTime - fadeStartTime);
        const opacity = 1 - fadeProgress;
        starsFadeWrapperElement.style.opacity = opacity;
      } else if (currentTime >= fadeEndTime) {
        // Fully faded out
        starsFadeWrapperElement.style.opacity = 0;
      } else {
        // Before fade starts - fully visible
        starsFadeWrapperElement.style.opacity = 1;
      }
    }, 16); // Update every ~16ms (60fps)
  }

  // Start trying to initialize the fade
  initStarsFade();

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

  // =====================
  // FPS Counter
  // =====================
  let frameCount = 0;
  let lastSecond = Date.now();
  let currentFps = 60;
  let lastFrameTime = 0;
  let longFrameCount = 0;
  let lastRafTs = performance.now();

  function updateFpsDisplay() {
    const now = Date.now();
    frameCount++;

    // Update FPS every second
    if (now - lastSecond >= 1000) {
      currentFps = frameCount;
      frameCount = 0;
      lastSecond = now;
    }

    // Update display
    const fpsDisplay = document.getElementById("fps-display");
    if (fpsDisplay) {
      fpsDisplay.textContent = `FPS: ${currentFps} | Frame: ${lastFrameTime.toFixed(
        1
      )}ms`;
    }

    // Track long frames via rAF delta as a fallback when Long Tasks API isn't available
    const ts = performance.now();
    const delta = ts - lastRafTs;
    lastRafTs = ts;
    if (delta > 50) longFrameCount++;

    requestAnimationFrame(updateFpsDisplay);
  }

  // Start FPS counter
  updateFpsDisplay();

  // Expose frame time update function for script.js to call
  window.updateFrameTime = function (frameTime) {
    lastFrameTime = frameTime;
  };

  // =====================
  // Memory & Long Task Monitors
  // =====================
  const memoryEl = document.getElementById("memory-display");
  const longTaskEl = document.getElementById("longtask-display");

  function bytesToMB(bytes) {
    return (bytes / (1024 * 1024)).toFixed(1);
  }

  function updateMemoryDisplay() {
    if (!memoryEl) return;
    try {
      const pm = performance && performance.memory;
      if (
        pm &&
        typeof pm.usedJSHeapSize === "number" &&
        typeof pm.jsHeapSizeLimit === "number"
      ) {
        const used = bytesToMB(pm.usedJSHeapSize);
        const limit = bytesToMB(pm.jsHeapSizeLimit);
        const pct = Math.min(
          100,
          Math.max(0, (pm.usedJSHeapSize / pm.jsHeapSizeLimit) * 100)
        ).toFixed(0);
        memoryEl.textContent = `Memory: ${used} / ${limit} MB (${pct}%)`;
      } else {
        const dm =
          typeof navigator !== "undefined" && navigator.deviceMemory
            ? ` | Device RAM: ${navigator.deviceMemory} GB`
            : "";
        memoryEl.textContent = `Memory: N/A (browser doesn't expose)${dm}`;
      }
    } catch (_) {
      memoryEl.textContent = "Memory: N/A (browser doesn't expose)";
    }
  }

  // Update memory every 2 seconds
  updateMemoryDisplay();
  setInterval(updateMemoryDisplay, 2000);

  // Long Task API (if available)
  let supportsLongTasks = false;
  try {
    supportsLongTasks =
      typeof PerformanceObserver !== "undefined" &&
      PerformanceObserver.supportedEntryTypes &&
      PerformanceObserver.supportedEntryTypes.includes("longtask");
  } catch (_) {
    supportsLongTasks = false;
  }

  let longTasksThisSecond = 0;
  if (supportsLongTasks) {
    try {
      const observer = new PerformanceObserver((list) => {
        longTasksThisSecond += list.getEntries().length;
      });
      observer.observe({ entryTypes: ["longtask"] });
    } catch (_) {}
  }

  // If Long Tasks API is not supported, clarify label for fallback
  if (!supportsLongTasks && longTaskEl) {
    longTaskEl.textContent = "Long frames/sec: --";
  }

  // Update long task metric every second; use rAF-based fallback count if API not supported
  setInterval(() => {
    if (longTaskEl) {
      const count = supportsLongTasks ? longTasksThisSecond : longFrameCount;
      longTaskEl.textContent = supportsLongTasks
        ? `Long tasks/sec: ${count}`
        : `Long frames/sec: ${count}`;
    }
    longTasksThisSecond = 0;
    longFrameCount = 0;
  }, 1000);
})();
