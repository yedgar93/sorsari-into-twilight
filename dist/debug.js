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

  // Debug log to screen (exposed via SORSARI namespace)
  SORSARI.debugLog = function (msg) {
    const debugLogEl = document.getElementById("debug-log");
    if (debugLogEl) {
      const timestamp = new Date().toLocaleTimeString();
      debugLogEl.innerHTML = `[${timestamp}] ${msg}<br>` + debugLogEl.innerHTML;
    }
    console.log(msg);
  };

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
