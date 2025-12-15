/**
 * Parallax Stars Background
 * - Multi-layer star field with parallax effect
 * - Device motion (gyroscope) tilt support
 * - Music-reactive behavior during drops
 * - Pulse effect triggered by instruments
 */

(function () {
  "use strict";

  const starsCanvas = document.getElementById("stars-canvas");
  const starsCtx = starsCanvas.getContext("2d");

  // Set initial canvas size
  starsCanvas.width = window.innerWidth;
  starsCanvas.height = window.innerHeight;

  // Create star layers with different speeds for parallax
  const starLayers = [
    { stars: [], count: 50, speed: 0.0125, size: 0.5, opacity: 0.3 }, // Far layer
    { stars: [], count: 35, speed: 0.0215, size: 0.75, opacity: 0.5 }, // Mid layer
    { stars: [], count: 20, speed: 0.0313, size: 1, opacity: 0.8 }, // Close layer
  ];

  // Drop timing
  const firstDropTime = 31.85;
  const breakdownTime = 95.8;
  const secondDropTime = 127.78;
  const fadeOutStartTime = 123;
  const fadeOutEndTime = 127;
  const secondDropSnapTime = 128.04;
  const dropSpeedMultiplier = 150;
  const decelerationDuration = 2.0;
  const fadeOutDuration = fadeOutEndTime - fadeOutStartTime;

  // Final blur and fade out
  const finalBlurFadeStart = 214.5;
  const finalBlurFadeDuration = 15;
  const finalBlurFadeEnd = finalBlurFadeStart + finalBlurFadeDuration;

  // Device motion tilt offset
  let tiltOffsetX = 0;
  let tiltOffsetY = 0;
  const tiltSensitivity = 5.0;
  const tiltDisplay = document.getElementById("tilt-display");
  let motionEventCount = 0;

  // Listen for device motion (gyroscope)
  if (window.DeviceOrientationEvent) {
    console.log("DeviceOrientationEvent is supported");

    window.addEventListener("deviceorientation", function (event) {
      motionEventCount++;

      const gamma = event.gamma || 0;
      const beta = event.beta || 0;

      if (motionEventCount === 1) {
        console.log("First device orientation event received:", {
          gamma,
          beta,
        });
      }

      tiltOffsetX = Math.max(-100, Math.min(100, gamma * tiltSensitivity));
      tiltOffsetY = Math.max(
        -100,
        Math.min(100, (beta - 90) * tiltSensitivity)
      );

      if (motionEventCount % 5 === 0 && tiltDisplay) {
        tiltDisplay.textContent = `Tilt: X=${tiltOffsetX.toFixed(
          1
        )}, Y=${tiltOffsetY.toFixed(1)} | γ=${gamma.toFixed(
          1
        )}° β=${beta.toFixed(1)}°`;
      }
    });
    console.log("Device orientation listener added");

    // Auto-enable on Android (no permission needed)
    if (typeof DeviceOrientationEvent.requestPermission !== "function") {
      const btn = document.getElementById("enable-motion-btn");
      if (btn) {
        btn.textContent = "Motion Active ✓";
        btn.style.backgroundColor = "#4CAF50";
      }
      console.log("Device motion auto-enabled (Android)");
    }
  } else {
    console.log("DeviceOrientationEvent NOT supported");
    if (tiltDisplay) {
      tiltDisplay.textContent = "Device motion not supported";
    }
  }

  // Initialize stars
  starLayers.forEach((layer) => {
    for (let i = 0; i < layer.count; i++) {
      layer.stars.push({
        x: Math.random() * starsCanvas.width,
        y: Math.random() * starsCanvas.height,
        baseVx: (Math.random() - 0.5) * layer.speed,
        baseVy: (Math.random() - 0.5) * layer.speed,
        vx: (Math.random() - 0.5) * layer.speed,
        vy: (Math.random() - 0.5) * layer.speed,
        pulseAmount: 0,
        pulseDecay: 0.05 + Math.random() * 0.05,
      });
    }
  });

  // Handle window resize
  window.addEventListener("resize", function () {
    const oldWidth = starsCanvas.width;
    const oldHeight = starsCanvas.height;
    starsCanvas.width = window.innerWidth;
    starsCanvas.height = window.innerHeight;

    const scaleX = starsCanvas.width / oldWidth;
    const scaleY = starsCanvas.height / oldHeight;

    starLayers.forEach((layer) => {
      layer.stars.forEach((star) => {
        star.x *= scaleX;
        star.y *= scaleY;
      });
    });
  });

  // Animate stars
  function animateStars() {
    const currentTime = SORSARI.musicTime || 0;
    const isDropActive =
      (currentTime >= firstDropTime && currentTime < breakdownTime) ||
      currentTime >= secondDropTime;

    // Handle opacity fade out before second drop and snap back
    let canvasOpacity = 1.0;

    if (currentTime >= fadeOutStartTime && currentTime < fadeOutEndTime) {
      const fadeProgress = (currentTime - fadeOutStartTime) / fadeOutDuration;
      canvasOpacity = 1.0 - fadeProgress;
    } else if (
      currentTime >= fadeOutEndTime &&
      currentTime < secondDropSnapTime
    ) {
      canvasOpacity = 0.0;
    } else if (currentTime >= secondDropSnapTime) {
      canvasOpacity = 1.0;
    }

    // Final blur and fade out
    let blurAmount = 0;
    if (currentTime >= finalBlurFadeStart && currentTime <= finalBlurFadeEnd) {
      const fadeProgress =
        (currentTime - finalBlurFadeStart) / finalBlurFadeDuration;
      canvasOpacity = 1.0 - fadeProgress;
      blurAmount = fadeProgress * 20;
    } else if (currentTime > finalBlurFadeEnd) {
      canvasOpacity = 0;
      blurAmount = 20;
    }

    starsCanvas.style.opacity = canvasOpacity;
    starsCanvas.style.filter =
      blurAmount > 0 ? `blur(${blurAmount}px)` : "none";

    // Create trail effect during drops by not fully clearing canvas
    if (isDropActive) {
      starsCtx.fillStyle = "rgba(1, 3, 19, 0.15)";
      starsCtx.fillRect(0, 0, starsCanvas.width, starsCanvas.height);
    } else {
      starsCtx.clearRect(0, 0, starsCanvas.width, starsCanvas.height);
    }

    // Get instruments level for star pulsing
    const instrumentsLevel = SORSARI.getInstrumentsLevel
      ? SORSARI.getInstrumentsLevel()
      : 0;
    const pulseThreshold = 0.25;

    starLayers.forEach((layer) => {
      layer.stars.forEach((star) => {
        // Determine star velocity based on music timing
        if (currentTime >= firstDropTime && currentTime < breakdownTime) {
          star.vx = star.baseVx;
          star.vy = -layer.speed * dropSpeedMultiplier;
        } else if (
          currentTime >= breakdownTime &&
          currentTime < breakdownTime + decelerationDuration
        ) {
          const decelProgress =
            (currentTime - breakdownTime) / decelerationDuration;
          const decelEase =
            decelProgress * decelProgress * (3 - 2 * decelProgress);
          const hyperspeedVy = -layer.speed * dropSpeedMultiplier;
          star.vx = star.baseVx;
          star.vy = hyperspeedVy + (star.baseVy - hyperspeedVy) * decelEase;
        } else if (currentTime >= secondDropTime) {
          star.vx = star.baseVx;
          star.vy = layer.speed * dropSpeedMultiplier;
        } else {
          star.vx = star.baseVx;
          star.vy = star.baseVy;
        }

        // Pulse logic
        if (instrumentsLevel > pulseThreshold && Math.random() < 0.000375) {
          star.pulseAmount = 1.0;
        }

        if (star.pulseAmount > 0) {
          star.pulseAmount = Math.max(0, star.pulseAmount - star.pulseDecay);
        }

        const finalOpacity =
          layer.opacity + star.pulseAmount * (1.0 - layer.opacity);
        const sizeMultiplier = 1.0 + star.pulseAmount * 2.5;
        const finalSize = layer.size * sizeMultiplier;

        // Apply tilt offset based on layer depth (parallax effect)
        const layerDepth = layer.speed / 0.0313;
        const drawX = star.x + tiltOffsetX * layerDepth;
        const drawY = star.y + tiltOffsetY * layerDepth;

        // Draw star with trail during drops
        if (isDropActive) {
          starsCtx.beginPath();
          starsCtx.moveTo(drawX, drawY);
          starsCtx.lineTo(drawX - star.vx * 8, drawY - star.vy * 8);
          starsCtx.strokeStyle = `rgba(255, 255, 255, ${finalOpacity})`;
          starsCtx.lineWidth = finalSize * 1.5;
          starsCtx.stroke();
        } else {
          starsCtx.fillStyle = `rgba(255, 255, 255, ${finalOpacity})`;
          starsCtx.beginPath();
          starsCtx.arc(drawX, drawY, finalSize, 0, Math.PI * 2);
          starsCtx.fill();
        }

        // Move star
        star.x += star.vx;
        star.y += star.vy;

        // Wrap around edges
        if (star.x < 0) star.x = starsCanvas.width;
        if (star.x > starsCanvas.width) star.x = 0;
        if (star.y < 0) star.y = starsCanvas.height;
        if (star.y > starsCanvas.height) star.y = 0;
      });
    });

    requestAnimationFrame(animateStars);
  }

  animateStars();
})();
