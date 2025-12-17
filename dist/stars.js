/**
 * Parallax Stars Background
 * - Multi-layer star field with parallax effect
 * - Device motion (gyroscope) tilt support
 * - Music-reactive behavior during drops
 * - Pulse effect triggered by instruments
 */

(function () {
  "use strict";

  // Detect mobile devices (same as in script.js)
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

  const starsCanvas = document.getElementById("stars-canvas");
  const starsCanvasWrapper = document.getElementById("stars-canvas-wrapper");
  // Enable alpha channel for hyperspace layer (needs transparency for blue stars)
  const starsCtx = starsCanvas.getContext("2d", { alpha: true });

  // Set initial canvas size (scaled to 0.75x for performance - stars are 1-2px anyway)
  const canvasScale = 0.75;
  starsCanvas.width = window.innerWidth * canvasScale;
  starsCanvas.height = window.innerHeight * canvasScale;

  // Create blinking stars canvas (pre-intro layer)
  const blinkingStarsCanvas = document.createElement("canvas");
  blinkingStarsCanvas.id = "blinking-stars-canvas";
  blinkingStarsCanvas.width = window.innerWidth * canvasScale;
  blinkingStarsCanvas.height = window.innerHeight * canvasScale;
  blinkingStarsCanvas.style.position = "fixed";
  blinkingStarsCanvas.style.top = "0";
  blinkingStarsCanvas.style.left = "0";
  blinkingStarsCanvas.style.width = "100%";
  blinkingStarsCanvas.style.height = "100%";
  blinkingStarsCanvas.style.zIndex = "0";
  blinkingStarsCanvas.style.pointerEvents = "none";
  blinkingStarsCanvas.style.opacity = "1";
  blinkingStarsCanvas.style.willChange = "opacity";
  starsCanvasWrapper.insertBefore(blinkingStarsCanvas, starsCanvas);
  const blinkingStarsCtx = blinkingStarsCanvas.getContext("2d", {
    alpha: true,
  });

  // Blinking stars data
  const blinkingStars = [];
  const blinkingStarCount = 80;
  const blinkingStarFadeOutDelay = 12; // 8 seconds after music starts
  const blinkingStarFadeOutDuration = 16; // Fade out over 12 seconds

  // Blinking stars re-appearance at 1:41
  const blinkingStarFadeInStart = 101; // 1:41 - fade in starts
  const blinkingStarFadeInDuration = 10; // Fade in over 10 seconds
  const blinkingStarFadeOutStart = 125; // 2:05 - fade out starts
  const blinkingStarFadeOutEnd = 152; // 2:32 - fade out ends (27 seconds duration)

  // Screen shake parameters
  const shakeDuration = 1.5;
  const shakeDelayDuration = 0.5;
  const shakeIntensityStar = 1.5; // 1-2px for stars
  const firstDropShakeEndTime = 95; // 1:35 - stop shaking at breakdown
  const secondDropShakeEndTime = 192; // 3:12 - stop shaking

  // Canvas zoom parameters
  const zoomStartScale = 2.0; // Start zoomed in 2x
  const zoomOutStart = 0; // Start zooming out immediately
  const zoomOutEnd = 20; // Finish zooming out at 20 seconds
  const zoomOutDuration = zoomOutEnd - zoomOutStart;

  // Canvas blur parameters
  const blurStartAmount = 2.0; // Start with 4px blur
  const blurOutStart = 4; // Start removing blur immediately
  const blurOutEnd = 24; // Finish removing blur at 24 seconds
  const blurOutDuration = blurOutEnd - blurOutStart;

  // Create star layers with different speeds for parallax and depth-of-field
  // Reduce star count on mobile for better performance (105 → 70 stars)
  const starLayers = isMobile
    ? [
        {
          stars: [],
          count: 35,
          speed: 0.0125,
          size: 0.5,
          opacity: 0.3,
          depth: 3,
          blur: 0.0,
          scale: 0.7,
        }, // Far layer (sharp)
        {
          stars: [],
          count: 25,
          speed: 0.0215,
          size: 0.75,
          opacity: 0.5,
          depth: 2,
          blur: 2.0,
          scale: 0.85,
        }, // Mid layer (blurred for depth effect)
        {
          stars: [],
          count: 10,
          speed: 0.0313,
          size: 1,
          opacity: 0.8,
          depth: 1,
          blur: 0.0,
          scale: 1.0,
        }, // Close layer (sharp)
      ]
    : [
        {
          stars: [],
          count: 50,
          speed: 0.0125,
          size: 0.5,
          opacity: 0.3,
          depth: 3,
          blur: 0.0,
          scale: 0.7,
        }, // Far layer (sharp)
        {
          stars: [],
          count: 35,
          speed: 0.0215,
          size: 0.75,
          opacity: 0.5,
          depth: 2,
          blur: 2.0,
          scale: 0.85,
        }, // Mid layer (blurred for depth effect)
        {
          stars: [],
          count: 20,
          speed: 0.0313,
          size: 1,
          opacity: 0.8,
          depth: 1,
          blur: 0.0,
          scale: 1.0,
        }, // Close layer (sharp)
      ];

  // Drop timing
  const firstDropTime = 31.85;
  const breakdownTime = 95.8;
  const secondDropTime = 127.78;
  const invertBackTime = 160; // 2:40 - reverse star direction back to up
  const fadeOutStartTime = 123;
  const fadeOutEndTime = 127;
  const secondDropSnapTime = 128.04;
  const dropSpeedMultiplier = 150;
  const decelerationDuration = 2.0;
  const fadeOutDuration = fadeOutEndTime - fadeOutStartTime;

  // Final blur and fade out
  const finalBlurFadeStart = 214.5; // 3:34.5
  const finalBlurFadeDuration = 12.5; // Fade over 12.5 seconds to end at 3:47
  const finalBlurFadeEnd = finalBlurFadeStart + finalBlurFadeDuration; // 227 seconds (3:47)

  // Chromatic aberration settings
  let chromaticAberrationEnabled = true;
  const chromaticAberrationStartTime = 64; // Start at 1:04 (first drop area)
  const chromaticAberrationEndTime = breakdownTime; // End at breakdown (1:35)
  const chromaticAberrationMaxOffset = 3; // Max pixel offset for color channels
  const chromaticAberrationIntensity = 0.6; // How much to use the offset (0-1)
  const chromaticFadeOutStart = 190; // 3:10 - start fading out
  const chromaticFadeOutEnd = 206; // 3:26 - completely gone

  // Process kill times
  const starPulsingKillTime = 206; // Kill star pulsing at 3:26

  // Process kill flags
  let starPulsingKilled = false;
  let starsAnimationKilled = false;

  // Device motion tilt offset
  let tiltOffsetX = 0;
  let tiltOffsetY = 0;
  const tiltSensitivity = 5.0;
  const tiltDisplay = document.getElementById("tilt-display");
  let motionEventCount = 0;

  // Listen for device motion (gyroscope)
  if (window.DeviceOrientationEvent) {
    window.addEventListener("deviceorientation", function (event) {
      motionEventCount++;

      const gamma = event.gamma || 0;
      const beta = event.beta || 0;

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

    // Auto-enable on Android (no permission needed)
    if (typeof DeviceOrientationEvent.requestPermission !== "function") {
      const btn = document.getElementById("enable-motion-btn");
      if (btn) {
        btn.textContent = "Motion Active ✓";
        btn.style.backgroundColor = "#4CAF50";
      }
    }
  } else {
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

  // Initialize blinking stars (pre-intro layer)
  for (let i = 0; i < blinkingStarCount; i++) {
    blinkingStars.push({
      x: Math.random() * blinkingStarsCanvas.width,
      y: Math.random() * blinkingStarsCanvas.height,
      vx: (Math.random() - 0.5) * 0.01, // Very slow movement
      vy: (Math.random() - 0.5) * 0.01,
      size: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.6 + 0.4,
      blinkSpeed: Math.random() * 2 + 1, // Blink frequency
      blinkPhase: Math.random() * Math.PI * 2, // Random starting phase
    });
  }

  // Handle window resize
  window.addEventListener("resize", function () {
    const oldWidth = starsCanvas.width;
    const oldHeight = starsCanvas.height;
    starsCanvas.width = window.innerWidth * canvasScale;
    starsCanvas.height = window.innerHeight * canvasScale;
    blinkingStarsCanvas.width = window.innerWidth * canvasScale;
    blinkingStarsCanvas.height = window.innerHeight * canvasScale;

    const scaleX = starsCanvas.width / oldWidth;
    const scaleY = starsCanvas.height / oldHeight;

    starLayers.forEach((layer) => {
      layer.stars.forEach((star) => {
        star.x *= scaleX;
        star.y *= scaleY;
      });
    });

    blinkingStars.forEach((star) => {
      star.x *= scaleX;
      star.y *= scaleY;
    });
  });

  // =====================
  // HYPERSPACE LAYER (Flying towards screen)
  // =====================
  const hyperspaceLayer = {
    stars: [],
    count: 40, // Fewer stars for performance
    minZ: 0.1,
    maxZ: 1.0,
    speed: 0.015, // How fast they move towards camera
    fadeInStart: 15, // Start fading in at 15 seconds
    fadeInEnd: 27, // Fully visible at 27 seconds
    maxOpacity: 0.85, // Maximum opacity
  };

  // Reverse direction layer (active from 1:03.76 to 2:07)
  const reverseDirectionLayer = {
    stars: [],
    count: 40,
    minZ: 0.1,
    maxZ: 1.0,
    speed: 0.015,
    fadeInStart: 63.76, // 1:03.76 - start fading in
    fadeInEnd: 63.76, // Instantly visible
    fadeOutStart: 127, // 2:07 - start fading out
    fadeOutEnd: 127, // Instantly invisible
    maxOpacity: 0.85,
  };

  // Initialize hyperspace stars
  for (let i = 0; i < hyperspaceLayer.count; i++) {
    hyperspaceLayer.stars.push({
      x: (Math.random() - 0.5) * starsCanvas.width * 2, // Wider spread
      y: (Math.random() - 0.5) * starsCanvas.height * 2, // Taller spread
      z:
        Math.random() * (hyperspaceLayer.maxZ - hyperspaceLayer.minZ) +
        hyperspaceLayer.minZ, // 0.1 to 1.0
      baseZ: 0, // Will be set on init
    });
  }

  // Initialize reverse direction stars
  for (let i = 0; i < reverseDirectionLayer.count; i++) {
    reverseDirectionLayer.stars.push({
      x: (Math.random() - 0.5) * starsCanvas.width * 2,
      y: (Math.random() - 0.5) * starsCanvas.height * 2,
      z:
        Math.random() *
          (reverseDirectionLayer.maxZ - reverseDirectionLayer.minZ) +
        reverseDirectionLayer.minZ,
      baseZ: 0,
    });
  }

  // Set initial Z values
  hyperspaceLayer.stars.forEach((star) => {
    star.baseZ = star.z;
  });

  reverseDirectionLayer.stars.forEach((star) => {
    star.baseZ = star.z;
  });

  // Animate stars
  function animateStars() {
    // Check if music is paused (globalPauseState is exposed from script.js)
    if (window.globalPauseState && window.globalPauseState.paused) {
      // Skip animation but keep the loop running
      requestAnimationFrame(animateStars);
      return;
    }

    const currentTime = SORSARI.musicTime || 0;
    const isDropActive =
      (currentTime >= firstDropTime && currentTime < breakdownTime) ||
      currentTime >= secondDropTime;

    // =====================
    // BLINKING STARS (Pre-intro layer)
    // =====================
    let blinkingStarsOpacity = 1.0;
    let blinkingStarsActive = true;

    // Before fade out: fully visible (0s to 12s)
    if (currentTime < blinkingStarFadeOutDelay) {
      blinkingStarsOpacity = 1.0;
      blinkingStarsActive = true;
    }
    // Initial fade out: 12s to 28s
    else if (
      currentTime >= blinkingStarFadeOutDelay &&
      currentTime < blinkingStarFadeOutDelay + blinkingStarFadeOutDuration
    ) {
      const fadeProgress =
        (currentTime - blinkingStarFadeOutDelay) / blinkingStarFadeOutDuration;
      blinkingStarsOpacity = 1.0 - fadeProgress;
      blinkingStarsActive = true;
    }
    // Fade out ends, stars are gone
    else if (
      currentTime >= blinkingStarFadeOutDelay + blinkingStarFadeOutDuration &&
      currentTime < blinkingStarFadeInStart
    ) {
      blinkingStarsOpacity = 0;
      blinkingStarsActive = false;
    }
    // Re-appearance: fade in from 1:41 to 1:51 (101s to 111s)
    else if (
      currentTime >= blinkingStarFadeInStart &&
      currentTime < blinkingStarFadeInStart + blinkingStarFadeInDuration
    ) {
      const fadeProgress =
        (currentTime - blinkingStarFadeInStart) / blinkingStarFadeInDuration;
      blinkingStarsOpacity = fadeProgress;
      blinkingStarsActive = true;
    }
    // Stars visible: 1:51 to 2:05 (111s to 125s)
    else if (
      currentTime >= blinkingStarFadeInStart + blinkingStarFadeInDuration &&
      currentTime < blinkingStarFadeOutStart
    ) {
      blinkingStarsOpacity = 1.0;
      blinkingStarsActive = true;
    }
    // Fade out again: 2:05 to 2:32 (125s to 152s)
    else if (
      currentTime >= blinkingStarFadeOutStart &&
      currentTime < blinkingStarFadeOutEnd
    ) {
      const fadeProgress =
        (currentTime - blinkingStarFadeOutStart) /
        (blinkingStarFadeOutEnd - blinkingStarFadeOutStart);
      blinkingStarsOpacity = 1.0 - fadeProgress;
      blinkingStarsActive = true;
    }
    // After 2:32, stars are gone and process is killed
    else if (currentTime >= blinkingStarFadeOutEnd) {
      blinkingStarsOpacity = 0;
      blinkingStarsActive = false;
    }

    // Render blinking stars (only if active to save performance)
    if (blinkingStarsActive) {
      blinkingStarsCtx.clearRect(
        0,
        0,
        blinkingStarsCanvas.width,
        blinkingStarsCanvas.height
      );
      blinkingStarsCanvas.style.opacity = blinkingStarsOpacity;

      if (blinkingStarsOpacity > 0) {
        blinkingStars.forEach((star) => {
          // Very slow movement
          star.x += star.vx;
          star.y += star.vy;

          // Wrap around edges
          if (star.x < 0) star.x = blinkingStarsCanvas.width;
          if (star.x > blinkingStarsCanvas.width) star.x = 0;
          if (star.y < 0) star.y = blinkingStarsCanvas.height;
          if (star.y > blinkingStarsCanvas.height) star.y = 0;

          // Calculate blink effect (sine wave)
          const blinkValue =
            Math.sin(currentTime * star.blinkSpeed + star.blinkPhase) * 0.5 +
            0.5;
          const finalOpacity = star.opacity * blinkValue * blinkingStarsOpacity;

          // Draw star
          blinkingStarsCtx.fillStyle = `rgba(255, 255, 255, ${finalOpacity})`;
          blinkingStarsCtx.beginPath();
          blinkingStarsCtx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
          blinkingStarsCtx.fill();
        });
      }
    } else {
      // Keep canvas cleared and hidden when not active
      blinkingStarsCtx.clearRect(
        0,
        0,
        blinkingStarsCanvas.width,
        blinkingStarsCanvas.height
      );
      blinkingStarsCanvas.style.opacity = "0";
    }

    // Final blur and fade out (takes priority over earlier fades)
    let canvasOpacity = 1.0;
    let blurAmount = 0;

    if (currentTime >= finalBlurFadeStart && currentTime < finalBlurFadeEnd) {
      const fadeProgress =
        (currentTime - finalBlurFadeStart) / finalBlurFadeDuration;
      canvasOpacity = 1.0 - fadeProgress;
      blurAmount = fadeProgress * 20;
    } else if (currentTime >= finalBlurFadeEnd) {
      canvasOpacity = 0;
      blurAmount = 20;
    } else {
      // Handle opacity fade out before second drop and snap back (only if not in final fade)
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
    }

    starsCanvas.style.opacity = canvasOpacity;
    starsCanvas.style.filter =
      blurAmount > 0 ? `blur(${blurAmount}px)` : "none";

    // Calculate zoom scale (zoom out from 2x to 1x over first 20 seconds)
    let zoomScale = 1.0;
    if (currentTime < zoomOutEnd) {
      const zoomProgress = currentTime / zoomOutDuration;
      zoomScale = zoomStartScale - (zoomStartScale - 1.0) * zoomProgress;
    }

    // Zoom in from 2:40 to end of song
    const zoomInStartTime = invertBackTime; // 2:40
    const zoomSlowdownTime = 162; // 2:42 - slow down zoom
    const zoomInEndTime = 240; // ~4:00 (end of song)
    if (currentTime >= zoomInStartTime) {
      let zoomInAmount;
      if (currentTime < zoomSlowdownTime) {
        // Fast zoom from 2:40 to 2:42
        const fastProgress =
          (currentTime - zoomInStartTime) /
          (zoomSlowdownTime - zoomInStartTime);
        zoomInAmount = 1.0 + Math.pow(fastProgress, 0.5) * 4.0;
      } else {
        // Slow zoom from 2:42 to end
        const slowProgress =
          (currentTime - zoomSlowdownTime) / (zoomInEndTime - zoomSlowdownTime);
        const zoomAt242 = 1.0 + Math.pow(1.0, 0.5) * 4.0; // ~5x at 2:42
        zoomInAmount = zoomAt242 + slowProgress * 2.0; // Slow additional zoom
      }
      zoomScale = zoomInAmount;
    }

    // Rotation from 2:40 to end of song
    let rotationDegrees = 0;
    if (currentTime >= zoomInStartTime) {
      const rotationProgress =
        (currentTime - zoomInStartTime) / (zoomInEndTime - zoomInStartTime);
      rotationDegrees = rotationProgress * 1440; // 4 full rotations (4 x 360 degrees)
    }

    // Calculate chromatic aberration offset (pulsing effect)
    let chromaticOffset = 0;
    let chromaticIntensityMultiplier = 1.0;

    // Check if dither mode is disabling chromatic aberration
    const ditherDisablingChromatic = window.ditherChromaticAberrationDisabled;

    // Check if we're in fade-out section (3:10 to 3:26)
    if (
      currentTime >= chromaticFadeOutStart &&
      currentTime < chromaticFadeOutEnd
    ) {
      const fadeProgress =
        (currentTime - chromaticFadeOutStart) /
        (chromaticFadeOutEnd - chromaticFadeOutStart);
      chromaticIntensityMultiplier = 1.0 - fadeProgress; // Fade from 1.0 to 0
    } else if (currentTime >= chromaticFadeOutEnd) {
      // Completely disable chromatic aberration after 3:26 to save performance
      chromaticAberrationEnabled = false;
      chromaticIntensityMultiplier = 0;
    }

    if (
      !isMobile &&
      !ditherDisablingChromatic &&
      chromaticAberrationEnabled &&
      currentTime >= chromaticAberrationStartTime &&
      currentTime < chromaticAberrationEndTime
    ) {
      // Pulsing effect during first drop section (1:04 to 1:35)
      const chromaticProgress =
        (currentTime - chromaticAberrationStartTime) /
        (chromaticAberrationEndTime - chromaticAberrationStartTime);
      chromaticOffset =
        Math.sin(chromaticProgress * Math.PI * 4) * // 2 full pulses
        chromaticAberrationMaxOffset *
        chromaticAberrationIntensity *
        chromaticIntensityMultiplier;
    } else if (
      !isMobile &&
      !ditherDisablingChromatic &&
      chromaticAberrationEnabled &&
      currentTime >= invertBackTime
    ) {
      // Rotating effect from 2:40 onwards (with zoom and rotation)
      const rotationProgress =
        (currentTime - invertBackTime) / (zoomInEndTime - invertBackTime);
      chromaticOffset =
        Math.sin(rotationProgress * Math.PI * 2) *
        chromaticAberrationMaxOffset *
        chromaticAberrationIntensity *
        chromaticIntensityMultiplier;
    }

    // Calculate wrapper blur amount (blur out from 4px to 0px over first 24 seconds)
    let wrapperBlurAmount = 0;
    if (currentTime < blurOutEnd) {
      const blurProgress = currentTime / blurOutDuration;
      wrapperBlurAmount = blurStartAmount - blurStartAmount * blurProgress;
    }
    starsCanvasWrapper.style.filter =
      wrapperBlurAmount > 0 ? `blur(${wrapperBlurAmount}px)` : "none";

    // Apply screen shake to stars canvas during drops
    const ditherDisablingScreenShake = window.ditherScreenShakeDisabled;
    const isInFirstDrop =
      currentTime >= firstDropTime && currentTime < firstDropShakeEndTime;
    const isInSecondDrop =
      currentTime >= secondDropTime && currentTime < secondDropShakeEndTime;

    if (!ditherDisablingScreenShake && (isInFirstDrop || isInSecondDrop)) {
      const timeSinceDropStart = isInFirstDrop
        ? currentTime - firstDropTime
        : currentTime - secondDropTime;
      const cycleTime =
        timeSinceDropStart % (shakeDuration + shakeDelayDuration);

      if (cycleTime < shakeDuration) {
        // In shake phase
        const shakeOffsetX = (Math.random() - 0.5) * shakeIntensityStar;
        const shakeOffsetY = (Math.random() - 0.5) * shakeIntensityStar;
        starsCanvas.style.transform = `translate(${shakeOffsetX}px, ${shakeOffsetY}px) scale(${zoomScale}) rotate(${rotationDegrees}deg)`;
      } else {
        // In delay phase
        starsCanvas.style.transform = `scale(${zoomScale}) rotate(${rotationDegrees}deg)`;
      }
    } else {
      starsCanvas.style.transform = `scale(${zoomScale}) rotate(${rotationDegrees}deg)`;
    }

    // Create trail effect during drops by not fully clearing canvas
    if (isDropActive) {
      starsCtx.fillStyle = "rgba(1, 3, 19, 0.15)";
      starsCtx.fillRect(0, 0, starsCanvas.width, starsCanvas.height);
    } else {
      starsCtx.clearRect(0, 0, starsCanvas.width, starsCanvas.height);
    }

    // Get instruments level for star pulsing
    // Disabled on mobile to save performance
    // Kill star pulsing at 3:26 to save performance (desktop only)
    let instrumentsLevel = 0;
    if (!isMobile && currentTime < starPulsingKillTime) {
      instrumentsLevel = SORSARI.getInstrumentsLevel
        ? SORSARI.getInstrumentsLevel()
        : 0;
    } else if (
      !isMobile &&
      !starPulsingKilled &&
      currentTime >= starPulsingKillTime
    ) {
      starPulsingKilled = true;
      // Reset all star pulse amounts
      starLayers.forEach((layer) => {
        layer.stars.forEach((star) => {
          star.pulseAmount = 0;
        });
      });
    } else if (isMobile && !starPulsingKilled) {
      // On mobile, disable pulsing entirely
      starPulsingKilled = true;
      starLayers.forEach((layer) => {
        layer.stars.forEach((star) => {
          star.pulseAmount = 0;
        });
      });
    }
    const pulseThreshold = 0.25;

    // Get dynamic blur values from debug controls (if available)
    const blurValues = [
      SORSARI.dofBlur?.layer1 ?? starLayers[0].blur,
      SORSARI.dofBlur?.layer2 ?? starLayers[1].blur,
      SORSARI.dofBlur?.layer3 ?? starLayers[2].blur,
    ];

    // Pre-calculate timing state once per frame (instead of per star)
    let timingState = "normal";
    let decelProgress = 0;
    let decelEase = 0;

    if (currentTime >= firstDropTime && currentTime < breakdownTime) {
      timingState = "firstDrop";
    } else if (
      currentTime >= breakdownTime &&
      currentTime < breakdownTime + decelerationDuration
    ) {
      timingState = "deceleration";
      decelProgress = (currentTime - breakdownTime) / decelerationDuration;
      decelEase = decelProgress * decelProgress * (3 - 2 * decelProgress);
    } else if (currentTime >= secondDropTime && currentTime < invertBackTime) {
      timingState = "secondDrop";
    } else if (currentTime >= invertBackTime) {
      timingState = "firstDrop"; // Back to flowing up like first drop
    }

    starLayers.forEach((layer, layerIndex) => {
      // Pre-calculate layer depth for parallax (same for all stars in layer)
      const layerDepth = layer.speed / 0.0313;

      // Apply depth-of-field blur filter for this layer
      const blurAmount = blurValues[layerIndex];
      if (blurAmount > 0) {
        starsCtx.filter = `blur(${blurAmount}px)`;
      } else {
        starsCtx.filter = "none";
      }

      // Batch stars by whether they're pulsing or not for more efficient rendering
      const normalStars = [];
      const pulsingStars = [];

      layer.stars.forEach((star) => {
        // Determine star velocity based on pre-calculated timing state
        if (timingState === "firstDrop") {
          star.vx = star.baseVx;
          star.vy = -layer.speed * dropSpeedMultiplier;
        } else if (timingState === "deceleration") {
          const hyperspeedVy = -layer.speed * dropSpeedMultiplier;
          star.vx = star.baseVx;
          star.vy = hyperspeedVy + (star.baseVy - hyperspeedVy) * decelEase;
        } else if (timingState === "secondDrop") {
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

        // Move star
        star.x += star.vx;
        star.y += star.vy;

        // Wrap around edges
        if (star.x < 0) star.x = starsCanvas.width;
        if (star.x > starsCanvas.width) star.x = 0;
        if (star.y < 0) star.y = starsCanvas.height;
        if (star.y > starsCanvas.height) star.y = 0;

        // Apply tilt offset based on layer depth (parallax effect)
        star.drawX = star.x + tiltOffsetX * layerDepth;
        star.drawY = star.y + tiltOffsetY * layerDepth;

        // Separate pulsing stars from normal stars for batched rendering
        if (star.pulseAmount > 0) {
          pulsingStars.push(star);
        } else {
          normalStars.push(star);
        }
      });

      // Apply depth-based size scaling
      const depthScale = layer.scale;

      // Batch render normal (non-pulsing) stars directly to main canvas
      if (normalStars.length > 0) {
        if (chromaticOffset !== 0) {
          // Draw with chromatic aberration (BATCHED for performance)
          const offset = chromaticOffset;
          const size = layer.size * depthScale;

          if (isDropActive) {
            // Batched trails with chromatic aberration
            starsCtx.lineWidth = size * 1.5;

            // Red channel (offset right)
            starsCtx.strokeStyle = `rgba(255, 0, 0, ${layer.opacity * 0.4})`;
            starsCtx.beginPath();
            normalStars.forEach((star) => {
              const x = Math.floor(star.drawX);
              const y = Math.floor(star.drawY);
              starsCtx.moveTo(x + offset, y);
              starsCtx.lineTo(x + offset - star.vx * 8, y - star.vy * 8);
            });
            starsCtx.stroke();

            // Green channel (no offset)
            starsCtx.strokeStyle = `rgba(0, 255, 0, ${layer.opacity * 0.4})`;
            starsCtx.beginPath();
            normalStars.forEach((star) => {
              const x = Math.floor(star.drawX);
              const y = Math.floor(star.drawY);
              starsCtx.moveTo(x, y);
              starsCtx.lineTo(x - star.vx * 8, y - star.vy * 8);
            });
            starsCtx.stroke();

            // Blue channel (offset left)
            starsCtx.strokeStyle = `rgba(0, 0, 255, ${layer.opacity * 0.4})`;
            starsCtx.beginPath();
            normalStars.forEach((star) => {
              const x = Math.floor(star.drawX);
              const y = Math.floor(star.drawY);
              starsCtx.moveTo(x - offset, y);
              starsCtx.lineTo(x - offset - star.vx * 8, y - star.vy * 8);
            });
            starsCtx.stroke();
          } else {
            // Batched dots with chromatic aberration
            // Red channel (offset right)
            starsCtx.fillStyle = `rgba(255, 0, 0, ${layer.opacity * 0.4})`;
            starsCtx.beginPath();
            normalStars.forEach((star) => {
              const x = Math.floor(star.drawX);
              const y = Math.floor(star.drawY);
              starsCtx.moveTo(x + offset + size, y);
              starsCtx.arc(x + offset, y, size, 0, Math.PI * 2);
            });
            starsCtx.fill();

            // Green channel (no offset)
            starsCtx.fillStyle = `rgba(0, 255, 0, ${layer.opacity * 0.4})`;
            starsCtx.beginPath();
            normalStars.forEach((star) => {
              const x = Math.floor(star.drawX);
              const y = Math.floor(star.drawY);
              starsCtx.moveTo(x + size, y);
              starsCtx.arc(x, y, size, 0, Math.PI * 2);
            });
            starsCtx.fill();

            // Blue channel (offset left)
            starsCtx.fillStyle = `rgba(0, 0, 255, ${layer.opacity * 0.4})`;
            starsCtx.beginPath();
            normalStars.forEach((star) => {
              const x = Math.floor(star.drawX);
              const y = Math.floor(star.drawY);
              starsCtx.moveTo(x - offset + size, y);
              starsCtx.arc(x - offset, y, size, 0, Math.PI * 2);
            });
            starsCtx.fill();
          }
        } else if (isDropActive) {
          // Draw trails for normal stars (no chromatic aberration)
          starsCtx.strokeStyle = `rgba(255, 255, 255, ${layer.opacity})`;
          starsCtx.lineWidth = layer.size * depthScale * 1.5;
          starsCtx.beginPath();
          normalStars.forEach((star) => {
            // Use integer coordinates to avoid sub-pixel rendering overhead
            const x = Math.floor(star.drawX);
            const y = Math.floor(star.drawY);
            const trailX = Math.floor(star.drawX - star.vx * 8);
            const trailY = Math.floor(star.drawY - star.vy * 8);
            starsCtx.moveTo(x, y);
            starsCtx.lineTo(trailX, trailY);
          });
          starsCtx.stroke();
        } else {
          // Draw dots for normal stars (no chromatic aberration)
          starsCtx.fillStyle = `rgba(255, 255, 255, ${layer.opacity})`;
          starsCtx.beginPath();
          normalStars.forEach((star) => {
            // Use integer coordinates to avoid sub-pixel rendering overhead
            const x = Math.floor(star.drawX);
            const y = Math.floor(star.drawY);
            starsCtx.moveTo(x + layer.size * depthScale, y);
            starsCtx.arc(x, y, layer.size * depthScale, 0, Math.PI * 2);
          });
          starsCtx.fill();
        }
      }

      // Render pulsing stars individually (they have different opacity/size)
      pulsingStars.forEach((star) => {
        const finalOpacity =
          layer.opacity + star.pulseAmount * (1.0 - layer.opacity);
        const sizeMultiplier = 1.0 + star.pulseAmount * 2.5;
        const finalSize = layer.size * depthScale * sizeMultiplier;

        if (isDropActive) {
          starsCtx.strokeStyle = `rgba(255, 255, 255, ${finalOpacity})`;
          starsCtx.lineWidth = finalSize * 1.5;
          starsCtx.beginPath();
          // Use integer coordinates to avoid sub-pixel rendering overhead
          const x = Math.floor(star.drawX);
          const y = Math.floor(star.drawY);
          const trailX = Math.floor(star.drawX - star.vx * 8);
          const trailY = Math.floor(star.drawY - star.vy * 8);
          starsCtx.moveTo(x, y);
          starsCtx.lineTo(trailX, trailY);
          starsCtx.stroke();
        } else {
          starsCtx.fillStyle = `rgba(255, 255, 255, ${finalOpacity})`;
          starsCtx.beginPath();
          // Use integer coordinates to avoid sub-pixel rendering overhead
          const x = Math.floor(star.drawX);
          const y = Math.floor(star.drawY);
          starsCtx.arc(x, y, finalSize, 0, Math.PI * 2);
          starsCtx.fill();
        }
      });
    });

    // =====================
    // RENDER HYPERSPACE LAYER
    // =====================
    // Calculate hyperspace layer opacity based on fade-in timing
    let hyperspaceOpacity = 0;
    if (
      currentTime >= hyperspaceLayer.fadeInStart &&
      currentTime < hyperspaceLayer.fadeInEnd
    ) {
      // Fade in from 0 to maxOpacity
      const fadeProgress =
        (currentTime - hyperspaceLayer.fadeInStart) /
        (hyperspaceLayer.fadeInEnd - hyperspaceLayer.fadeInStart);
      hyperspaceOpacity = fadeProgress * hyperspaceLayer.maxOpacity;
    } else if (currentTime >= hyperspaceLayer.fadeInEnd) {
      // Fully visible after fade-in completes
      hyperspaceOpacity = hyperspaceLayer.maxOpacity;
    }

    // Update and render hyperspace stars (flying towards screen)
    hyperspaceLayer.stars.forEach((star) => {
      // Normal mode: move star towards camera (decrease Z)
      star.z -= hyperspaceLayer.speed;

      // Reset to far distance when it reaches camera
      if (star.z <= hyperspaceLayer.minZ) {
        star.z = hyperspaceLayer.maxZ;
        // Randomize position for next cycle
        star.x = (Math.random() - 0.5) * starsCanvas.width * 2;
        star.y = (Math.random() - 0.5) * starsCanvas.height * 2;
      }

      // Calculate perspective projection (closer = larger and more centered)
      const scale = star.z; // 0.1 to 1.0
      const screenX = starsCanvas.width / 2 + star.x * scale;
      const screenY = starsCanvas.height / 2 + star.y * scale;

      // Only draw if on screen and hyperspace is visible
      if (
        hyperspaceOpacity > 0 &&
        screenX >= -10 &&
        screenX <= starsCanvas.width + 10 &&
        screenY >= -10 &&
        screenY <= starsCanvas.height + 10
      ) {
        // Size DECREASES as star gets closer (shrinks towards center for depth effect)
        const size = 2.5 - (1 - star.z) * 2; // 2.5 to 0.5 pixels (shrinks as Z decreases)
        // Opacity combines star depth with layer fade-in
        const starDepthOpacity = 0.3 + (1 - star.z) * 0.5; // 0.3 to 0.8 based on depth
        const finalOpacity = starDepthOpacity * hyperspaceOpacity; // Apply layer opacity

        starsCtx.fillStyle = `rgba(200, 220, 255, ${finalOpacity})`;
        starsCtx.beginPath();
        const x = Math.floor(screenX);
        const y = Math.floor(screenY);
        starsCtx.arc(x, y, size, 0, Math.PI * 2);
        starsCtx.fill();
      }
    });

    // Update and render reverse direction stars (flying away from screen, 1:03.76 to 2:07)
    reverseDirectionLayer.stars.forEach((star) => {
      // Move star AWAY from camera (increase Z)
      star.z += reverseDirectionLayer.speed;

      // Reset to close distance when it goes too far
      if (star.z >= reverseDirectionLayer.maxZ) {
        star.z = reverseDirectionLayer.minZ;
        // Randomize position for next cycle
        star.x = (Math.random() - 0.5) * starsCanvas.width * 2;
        star.y = (Math.random() - 0.5) * starsCanvas.height * 2;
      }

      // Calculate reverse direction layer opacity
      let reverseOpacity = 0;
      if (
        currentTime >= reverseDirectionLayer.fadeInStart &&
        currentTime < reverseDirectionLayer.fadeOutStart
      ) {
        reverseOpacity = reverseDirectionLayer.maxOpacity;
      }

      // Calculate perspective projection
      const scale = star.z;
      const screenX = starsCanvas.width / 2 + star.x * scale;
      const screenY = starsCanvas.height / 2 + star.y * scale;

      // Only draw if on screen and reverse layer is visible
      if (
        reverseOpacity > 0 &&
        screenX >= -10 &&
        screenX <= starsCanvas.width + 10 &&
        screenY >= -10 &&
        screenY <= starsCanvas.height + 10
      ) {
        // Size DECREASES as star gets closer (shrinks towards center for depth effect)
        const size = 2.5 - (1 - star.z) * 2;
        // Opacity combines star depth with layer opacity
        const starDepthOpacity = 0.3 + (1 - star.z) * 0.5;
        const finalOpacity = starDepthOpacity * reverseOpacity;

        starsCtx.fillStyle = `rgba(200, 220, 255, ${finalOpacity})`;
        starsCtx.beginPath();
        const x = Math.floor(screenX);
        const y = Math.floor(screenY);
        starsCtx.arc(x, y, size, 0, Math.PI * 2);
        starsCtx.fill();
      }
    });

    // Reset filter after all layers are drawn
    starsCtx.filter = "none";

    // Kill stars animation after final fade out (3:35) to save performance
    if (currentTime >= finalBlurFadeEnd && !starsAnimationKilled) {
      starsAnimationKilled = true;
      // Stop requesting animation frames - stars are fully faded out
      return;
    }

    // FPS scaling - skip frames based on CONFIG.fpsScale from script.js
    const fpsScale = window.CONFIG?.fpsScale || 1.0;
    const frameSkipInterval = Math.max(1, Math.round(1 / fpsScale));
    starsFrameCount++;

    if (frameSkipInterval > 1 && starsFrameCount % frameSkipInterval !== 0) {
      requestAnimationFrame(animateStars);
      return;
    }

    requestAnimationFrame(animateStars);
  }

  let starsFrameCount = 0;
  animateStars();

  // =====================
  // RESET FUNCTION FOR REPLAY
  // =====================
  window.SORSARI = window.SORSARI || {};
  SORSARI.resetStarsAnimation = function () {
    console.log("[Stars] Resetting stars animation");

    // Reset kill flags
    starPulsingKilled = false;
    starsAnimationKilled = false;

    // Reset frame count
    starsFrameCount = 0;

    // Clear canvas
    starsCtx.clearRect(0, 0, starsCanvas.width, starsCanvas.height);
    blinkingStarsCtx.clearRect(
      0,
      0,
      blinkingStarsCanvas.width,
      blinkingStarsCanvas.height
    );

    // Reset all star pulse amounts
    starLayers.forEach((layer) => {
      layer.stars.forEach((star) => {
        star.pulseAmount = 0;
      });
    });

    // Reset hyperspace and reverse direction layers
    hyperspaceLayer.stars.forEach((star) => {
      star.z = star.baseZ;
    });
    reverseDirectionLayer.stars.forEach((star) => {
      star.z = star.baseZ;
    });
  };
})();
