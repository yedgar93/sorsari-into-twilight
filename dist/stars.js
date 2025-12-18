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
  const starsCanvasWrapper = document.getElementById("stars-canvas-wrapper");
  // Enable alpha channel for hyperspace layer (needs transparency for blue stars)
  const starsCtx = starsCanvas.getContext("2d", { alpha: true });

  // Set initial canvas size
  starsCanvas.width = window.innerWidth;
  starsCanvas.height = window.innerHeight;

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
  const starLayers = [
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
  const finalBlurFadeStart = 214.5;
  const finalBlurFadeDuration = 15;
  const finalBlurFadeEnd = finalBlurFadeStart + finalBlurFadeDuration;

  // Performance optimization: frame counters for heavy periods
  let starsFrameCount = 0;
  let lastTransformUpdate = 0;
  let lastChromaticRender = 0; // Track when we last rendered chromatic aberration
  let lastStarsRender = 0; // Track when we last rendered stars (for FPS throttling)

  // Chromatic aberration settings
  const chromaticAberrationEnabled = true;
  const chromaticAberrationStartTime = invertBackTime; // Start at 2:40 when zoom begins
  const chromaticAberrationMaxOffset = 3; // Max pixel offset for color channels
  const chromaticAberrationIntensity = 0.6; // How much to use the offset (0-1)

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

    // Update typed arrays for main star layers
    starLayers.forEach((layer) => {
      for (let i = 0; i < layer.starCount; i++) {
        layer.positions[i * 4] *= scaleX;     // x
        layer.positions[i * 4 + 1] *= scaleY; // y
      }
    });

    // Update hyperspace positions
    for (let i = 0; i < hyperspaceLayer.count; i++) {
      hyperspaceLayer.positions[i * 3] *= scaleX;     // x
      hyperspaceLayer.positions[i * 3 + 1] *= scaleY; // y
    }

    // Update reverse direction positions
    for (let i = 0; i < reverseDirectionLayer.count; i++) {
      reversePositions[i * 3] *= scaleX;     // x
      reversePositions[i * 3 + 1] *= scaleY; // y
    }
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

  // OPTIMIZATION: Use typed arrays for better performance
  // Convert star arrays to typed arrays for faster operations
  starLayers.forEach((layer) => {
    const starCount = layer.stars.length;
    const positions = new Float32Array(starCount * 4); // x, y, vx, vy per star
    const pulseData = new Float32Array(starCount * 2); // pulseAmount, pulseDecay per star

    layer.stars.forEach((star, i) => {
      positions[i * 4] = star.x;
      positions[i * 4 + 1] = star.y;
      positions[i * 4 + 2] = star.vx;
      positions[i * 4 + 3] = star.vy;
      pulseData[i * 2] = star.pulseAmount;
      pulseData[i * 2 + 1] = star.pulseDecay;
    });

    layer.positions = positions;
    layer.pulseData = pulseData;
    layer.starCount = starCount;
  });

  // Convert hyperspace and reverse layers to typed arrays too
  const hyperspacePositions = new Float32Array(hyperspaceLayer.count * 3); // x, y, z per star
  hyperspaceLayer.stars.forEach((star, i) => {
    hyperspacePositions[i * 3] = star.x;
    hyperspacePositions[i * 3 + 1] = star.y;
    hyperspacePositions[i * 3 + 2] = star.z;
  });
  hyperspaceLayer.positions = hyperspacePositions;

  const reversePositions = new Float32Array(reverseDirectionLayer.count * 3); // x, y, z per star
  reverseDirectionLayer.stars.forEach((star, i) => {
    reversePositions[i * 3] = star.x;
    reversePositions[i * 3 + 1] = star.y;
    reversePositions[i * 3 + 2] = star.z;
  });
  reverseDirectionLayer.positions = reversePositions;

  // Helper function to draw stars with chromatic aberration effect
  function drawStarWithChromatic(
    x,
    y,
    size,
    opacity,
    offsetAmount,
    isTrail,
    vx,
    vy
  ) {
    if (!chromaticAberrationEnabled || offsetAmount === 0) {
      // Draw normally without chromatic aberration
      if (isTrail) {
        starsCtx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
        starsCtx.beginPath();
        starsCtx.moveTo(x, y);
        starsCtx.lineTo(x - vx * 8, y - vy * 8);
        starsCtx.stroke();
      } else {
        starsCtx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        starsCtx.beginPath();
        starsCtx.arc(x, y, size, 0, Math.PI * 2);
        starsCtx.fill();
      }
      return;
    }

    // Draw with chromatic aberration (3 color channels offset)
    const offset = offsetAmount;

    if (isTrail) {
      // Red channel (offset right)
      starsCtx.strokeStyle = `rgba(255, 0, 0, ${opacity * 0.4})`;
      starsCtx.beginPath();
      starsCtx.moveTo(x + offset, y);
      starsCtx.lineTo(x + offset - vx * 8, y - vy * 8);
      starsCtx.stroke();

      // Green channel (no offset)
      starsCtx.strokeStyle = `rgba(0, 255, 0, ${opacity * 0.4})`;
      starsCtx.beginPath();
      starsCtx.moveTo(x, y);
      starsCtx.lineTo(x - vx * 8, y - vy * 8);
      starsCtx.stroke();

      // Blue channel (offset left)
      starsCtx.strokeStyle = `rgba(0, 0, 255, ${opacity * 0.4})`;
      starsCtx.beginPath();
      starsCtx.moveTo(x - offset, y);
      starsCtx.lineTo(x - offset - vx * 8, y - vy * 8);
      starsCtx.stroke();
    } else {
      // Red channel (offset right)
      starsCtx.fillStyle = `rgba(255, 0, 0, ${opacity * 0.4})`;
      starsCtx.beginPath();
      starsCtx.arc(x + offset, y, size, 0, Math.PI * 2);
      starsCtx.fill();

      // Green channel (no offset)
      starsCtx.fillStyle = `rgba(0, 255, 0, ${opacity * 0.4})`;
      starsCtx.beginPath();
      starsCtx.arc(x, y, size, 0, Math.PI * 2);
      starsCtx.fill();

      // Blue channel (offset left)
      starsCtx.fillStyle = `rgba(0, 0, 255, ${opacity * 0.4})`;
      starsCtx.beginPath();
      starsCtx.arc(x - offset, y, size, 0, Math.PI * 2);
      starsCtx.fill();
    }
  }

  // Animate stars
  function animateStars() {
    // Stop animation if song has ended
    if (window.starsAnimationStopped) {
      console.log("[Stars] Animation stopped - song ended");
      return;
    }

    // Stop animation if disabled via debug menu
    if (window.debugStarsDisabled) {
      requestAnimationFrame(animateStars);
      return;
    }

    const currentTime = SORSARI.musicTime || 0;
    starsFrameCount++;

    // OPTIMIZATION: Stars-specific FPS throttling (render at half the current FPS)
    const starsRenderInterval = 2; // Render every 2nd frame (30fps if global is 60fps)
    const shouldRenderStars =
      starsFrameCount - lastStarsRender >= starsRenderInterval;

    if (!shouldRenderStars) {
      requestAnimationFrame(animateStars);
      return;
    }
    lastStarsRender = starsFrameCount;

    // OPTIMIZATION #5: Skip stars rendering frames during heavy periods (2:40-3:35)
    const isHeavyPeriod = currentTime >= 160 && currentTime <= 215;
    const starsFrameSkip = isHeavyPeriod ? 2 : 1; // Additional skip during heavy period

    if (starsFrameSkip > 1 && starsFrameCount % starsFrameSkip !== 0) {
      requestAnimationFrame(animateStars);
      return;
    }
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

    // Calculate chromatic aberration offset (increases with rotation)
    let chromaticOffset = 0;
    if (
      chromaticAberrationEnabled &&
      currentTime >= chromaticAberrationStartTime
    ) {
      const rotationProgress =
        (currentTime - chromaticAberrationStartTime) /
        (zoomInEndTime - chromaticAberrationStartTime);
      chromaticOffset =
        Math.sin(rotationProgress * Math.PI * 2) *
        chromaticAberrationMaxOffset *
        chromaticAberrationIntensity;
    }

    // OPTIMIZATION: Throttle chromatic aberration rendering to 15fps
    const chromaticRenderInterval = 4; // Render chromatic every 4th frame (15fps)
    const shouldRenderChromatic =
      starsFrameCount - lastChromaticRender >= chromaticRenderInterval;

    // If not time to render chromatic, set offset to 0 (draws normal stars)
    if (chromaticOffset !== 0 && !shouldRenderChromatic) {
      chromaticOffset = 0;
    } else if (chromaticOffset !== 0 && shouldRenderChromatic) {
      lastChromaticRender = starsFrameCount;
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
    const isInFirstDrop =
      currentTime >= firstDropTime && currentTime < firstDropShakeEndTime;
    const isInSecondDrop =
      currentTime >= secondDropTime && currentTime < secondDropShakeEndTime;

    // OPTIMIZATION #1: Throttle transform updates during heavy periods
    const transformUpdateInterval = isHeavyPeriod ? 3 : 1; // Update every 3rd frame during heavy period
    const shouldUpdateTransform =
      starsFrameCount - lastTransformUpdate >= transformUpdateInterval;

    if (shouldUpdateTransform) {
      lastTransformUpdate = starsFrameCount;

      // OPTIMIZATION C: Disable screen shake during camera pan (2:40-3:35) for cinematic effect
      const skipShakeDuringCameraPan = currentTime >= 160 && currentTime <= 215;

      if ((isInFirstDrop || isInSecondDrop) && !skipShakeDuringCameraPan) {
        const timeSinceDropStart = isInFirstDrop
          ? currentTime - firstDropTime
          : currentTime - secondDropTime;
        const cycleTime =
          timeSinceDropStart % (shakeDuration + shakeDelayDuration);

        if (cycleTime < shakeDuration) {
          // In shake phase - use transform3d for hardware acceleration
          const shakeOffsetX = (Math.random() - 0.5) * shakeIntensityStar;
          const shakeOffsetY = (Math.random() - 0.5) * shakeIntensityStar;
          starsCanvas.style.transform = `translate3d(${shakeOffsetX}px, ${shakeOffsetY}px, 0) scale(${zoomScale}) rotate(${rotationDegrees}deg)`;
        } else {
          // In delay phase - use transform3d for hardware acceleration
          starsCanvas.style.transform = `translate3d(0, 0, 0) scale(${zoomScale}) rotate(${rotationDegrees}deg)`;
        }
      } else {
        // No shake - just scale and rotate with hardware acceleration
        starsCanvas.style.transform = `translate3d(0, 0, 0) scale(${zoomScale}) rotate(${rotationDegrees}deg)`;
      }
    }

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

      // OPTIMIZATION: Batch process all stars in this layer using typed arrays
      const canvasWidth = starsCanvas.width;
      const canvasHeight = starsCanvas.height;
      const starCount = layer.starCount;
      const positions = layer.positions;
      const pulseData = layer.pulseData;

      // Pre-calculate common velocity values for all stars in layer
      let layerVy;
      if (timingState === "firstDrop") {
        layerVy = -layer.speed * dropSpeedMultiplier;
      } else if (timingState === "deceleration") {
        const hyperspeedVy = -layer.speed * dropSpeedMultiplier;
        layerVy = hyperspeedVy + (layer.speed - hyperspeedVy) * decelEase;
      } else if (timingState === "secondDrop") {
        layerVy = layer.speed * dropSpeedMultiplier;
      } else {
        layerVy = layer.speed;
      }

      // Batch update positions and collect rendering data
      const normalStars = [];
      const pulsingStars = [];

      for (let i = 0; i < starCount; i++) {
        const baseIndex = i * 4;
        const pulseIndex = i * 2;

        // Update velocity (batch operation)
        positions[baseIndex + 2] = positions[baseIndex + 2]; // baseVx stays the same
        positions[baseIndex + 3] = timingState === "deceleration"
          ? layerVy + (positions[baseIndex + 3] - layerVy) * decelEase
          : layerVy;

        // Pulse logic (reduced frequency for performance)
        if (instrumentsLevel > pulseThreshold && Math.random() < 0.0002) {
          pulseData[pulseIndex] = 1.0;
        }

        if (pulseData[pulseIndex] > 0) {
          pulseData[pulseIndex] -= pulseData[pulseIndex + 1];
          if (pulseData[pulseIndex] < 0) pulseData[pulseIndex] = 0;
        }

        // Move star (batch position update)
        positions[baseIndex] += positions[baseIndex + 2];     // x += vx
        positions[baseIndex + 1] += positions[baseIndex + 3]; // y += vy

        // OPTIMIZATION: Faster boundary wrapping using typed array operations
        if (positions[baseIndex] < 0) positions[baseIndex] = canvasWidth;
        else if (positions[baseIndex] > canvasWidth) positions[baseIndex] = 0;

        if (positions[baseIndex + 1] < 0) positions[baseIndex + 1] = canvasHeight;
        else if (positions[baseIndex + 1] > canvasHeight) positions[baseIndex + 1] = 0;

        // Apply tilt offset and calculate draw positions
        const drawX = positions[baseIndex] + tiltOffsetX * layerDepth;
        const drawY = positions[baseIndex + 1] + tiltOffsetY * layerDepth;

        // Separate pulsing stars from normal stars for batched rendering
        if (pulseData[pulseIndex] > 0) {
          pulsingStars.push({ x: drawX, y: drawY, pulseAmount: pulseData[pulseIndex], vx: positions[baseIndex + 2], vy: positions[baseIndex + 3] });
        } else {
          normalStars.push({ x: drawX, y: drawY, vx: positions[baseIndex + 2], vy: positions[baseIndex + 3] });
        }
      }

      // Apply depth-based size scaling
      const depthScale = layer.scale;

      // OPTIMIZATION: Batch render normal (non-pulsing) stars with single beginPath
      if (normalStars.length > 0) {
        if (chromaticOffset !== 0) {
          // Draw with chromatic aberration (individual stars, but batched by color channel)
          // Red channel batch
          starsCtx.fillStyle = `rgba(255, 0, 0, ${layer.opacity * 0.4})`;
          starsCtx.beginPath();
          normalStars.forEach((star) => {
            const x = Math.floor(star.x + chromaticOffset);
            const y = Math.floor(star.y);
            starsCtx.moveTo(x + layer.size * depthScale, y);
            starsCtx.arc(x, y, layer.size * depthScale, 0, Math.PI * 2);
          });
          starsCtx.fill();

          // Green channel batch
          starsCtx.fillStyle = `rgba(0, 255, 0, ${layer.opacity * 0.4})`;
          starsCtx.beginPath();
          normalStars.forEach((star) => {
            const x = Math.floor(star.x);
            const y = Math.floor(star.y);
            starsCtx.moveTo(x + layer.size * depthScale, y);
            starsCtx.arc(x, y, layer.size * depthScale, 0, Math.PI * 2);
          });
          starsCtx.fill();

          // Blue channel batch
          starsCtx.fillStyle = `rgba(0, 0, 255, ${layer.opacity * 0.4})`;
          starsCtx.beginPath();
          normalStars.forEach((star) => {
            const x = Math.floor(star.x - chromaticOffset);
            const y = Math.floor(star.y);
            starsCtx.moveTo(x + layer.size * depthScale, y);
            starsCtx.arc(x, y, layer.size * depthScale, 0, Math.PI * 2);
          });
          starsCtx.fill();
        } else if (isDropActive) {
          // Draw trails for normal stars (batched stroke)
          starsCtx.strokeStyle = `rgba(255, 255, 255, ${layer.opacity})`;
          starsCtx.lineWidth = layer.size * depthScale * 1.5;
          starsCtx.beginPath();
          normalStars.forEach((star) => {
            const x = Math.floor(star.x);
            const y = Math.floor(star.y);
            const trailX = Math.floor(star.x - star.vx * 8);
            const trailY = Math.floor(star.y - star.vy * 8);
            starsCtx.moveTo(x, y);
            starsCtx.lineTo(trailX, trailY);
          });
          starsCtx.stroke();
        } else {
          // Draw dots for normal stars (single batched fill)
          starsCtx.fillStyle = `rgba(255, 255, 255, ${layer.opacity})`;
          starsCtx.beginPath();
          normalStars.forEach((star) => {
            const x = Math.floor(star.x);
            const y = Math.floor(star.y);
            starsCtx.moveTo(x + layer.size * depthScale, y);
            starsCtx.arc(x, y, layer.size * depthScale, 0, Math.PI * 2);
          });
          starsCtx.fill();
        }
      }

      // Render pulsing stars individually (they have different opacity/size)
      if (pulsingStars.length > 0) {
        pulsingStars.forEach((star) => {
          const finalOpacity = layer.opacity + star.pulseAmount * (1.0 - layer.opacity);
          const sizeMultiplier = 1.0 + star.pulseAmount * 2.5;
          const finalSize = layer.size * depthScale * sizeMultiplier;

          if (isDropActive) {
            starsCtx.strokeStyle = `rgba(255, 255, 255, ${finalOpacity})`;
            starsCtx.lineWidth = finalSize * 1.5;
            starsCtx.beginPath();
            const x = Math.floor(star.x);
            const y = Math.floor(star.y);
            const trailX = Math.floor(star.x - star.vx * 8);
            const trailY = Math.floor(star.y - star.vy * 8);
            starsCtx.moveTo(x, y);
            starsCtx.lineTo(trailX, trailY);
            starsCtx.stroke();
          } else {
            starsCtx.fillStyle = `rgba(255, 255, 255, ${finalOpacity})`;
            starsCtx.beginPath();
            const x = Math.floor(star.x);
            const y = Math.floor(star.y);
            starsCtx.arc(x, y, finalSize, 0, Math.PI * 2);
            starsCtx.fill();
          }
        });
      }
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

    // OPTIMIZATION: Batch process hyperspace stars using typed arrays
    if (hyperspaceOpacity > 0) {
      const positions = hyperspaceLayer.positions;
      const canvasWidth = starsCanvas.width;
      const canvasHeight = starsCanvas.height;

      starsCtx.fillStyle = `rgba(200, 220, 255, ${hyperspaceOpacity})`;
      starsCtx.beginPath();

      for (let i = 0; i < hyperspaceLayer.count; i++) {
        const baseIndex = i * 3;

        // Move star towards camera (decrease Z)
        positions[baseIndex + 2] -= hyperspaceLayer.speed;

        // Reset to far distance when it reaches camera
        if (positions[baseIndex + 2] <= hyperspaceLayer.minZ) {
          positions[baseIndex + 2] = hyperspaceLayer.maxZ;
          // Randomize position for next cycle
          positions[baseIndex] = (Math.random() - 0.5) * canvasWidth * 2;
          positions[baseIndex + 1] = (Math.random() - 0.5) * canvasHeight * 2;
        }

        // Calculate perspective projection (closer = larger and more centered)
        const scale = positions[baseIndex + 2]; // 0.1 to 1.0
        const screenX = canvasWidth / 2 + positions[baseIndex] * scale;
        const screenY = canvasHeight / 2 + positions[baseIndex + 1] * scale;

        // Only draw if on screen
        if (
          screenX >= -10 &&
          screenX <= canvasWidth + 10 &&
          screenY >= -10 &&
          screenY <= canvasHeight + 10
        ) {
          // Size DECREASES as star gets closer (shrinks towards center for depth effect)
          const size = 2.5 - (1 - positions[baseIndex + 2]) * 2; // 2.5 to 0.5 pixels
          // Opacity combines star depth with layer fade-in
          const starDepthOpacity = 0.3 + (1 - positions[baseIndex + 2]) * 0.5; // 0.3 to 0.8 based on depth
          const finalOpacity = starDepthOpacity * hyperspaceOpacity;

          // Batch all arcs in single path
          const x = Math.floor(screenX);
          const y = Math.floor(screenY);
          starsCtx.moveTo(x + size, y);
          starsCtx.arc(x, y, size, 0, Math.PI * 2);
        }
      }
      starsCtx.fill();
    }

    // Update and render reverse direction stars (flying away from screen, 1:03.76 to 2:07)
    let reverseOpacity = 0;
    if (
      currentTime >= reverseDirectionLayer.fadeInStart &&
      currentTime < reverseDirectionLayer.fadeOutStart
    ) {
      reverseOpacity = reverseDirectionLayer.maxOpacity;
    }

    // OPTIMIZATION: Batch process reverse direction stars using typed arrays
    if (reverseOpacity > 0) {
      const positions = reverseDirectionLayer.positions;
      const canvasWidth = starsCanvas.width;
      const canvasHeight = starsCanvas.height;

      starsCtx.fillStyle = `rgba(200, 220, 255, ${reverseOpacity})`;
      starsCtx.beginPath();

      for (let i = 0; i < reverseDirectionLayer.count; i++) {
        const baseIndex = i * 3;

        // Move star AWAY from camera (increase Z)
        positions[baseIndex + 2] += reverseDirectionLayer.speed;

        // Reset to close distance when it goes too far
        if (positions[baseIndex + 2] >= reverseDirectionLayer.maxZ) {
          positions[baseIndex + 2] = reverseDirectionLayer.minZ;
          // Randomize position for next cycle
          positions[baseIndex] = (Math.random() - 0.5) * canvasWidth * 2;
          positions[baseIndex + 1] = (Math.random() - 0.5) * canvasHeight * 2;
        }

        // Calculate perspective projection
        const scale = positions[baseIndex + 2];
        const screenX = canvasWidth / 2 + positions[baseIndex] * scale;
        const screenY = canvasHeight / 2 + positions[baseIndex + 1] * scale;

        // Only draw if on screen
        if (
          screenX >= -10 &&
          screenX <= canvasWidth + 10 &&
          screenY >= -10 &&
          screenY <= canvasHeight + 10
        ) {
          // Size DECREASES as star gets closer (shrinks towards center for depth effect)
          const size = 2.5 - (1 - positions[baseIndex + 2]) * 2;
          // Opacity combines star depth with layer opacity
          const starDepthOpacity = 0.3 + (1 - positions[baseIndex + 2]) * 0.5;
          const finalOpacity = starDepthOpacity * reverseOpacity;

          // Batch all arcs in single path
          const x = Math.floor(screenX);
          const y = Math.floor(screenY);
          starsCtx.moveTo(x + size, y);
          starsCtx.arc(x, y, size, 0, Math.PI * 2);
        }
      }
      starsCtx.fill();
    }

    // Reset filter after all layers are drawn
    starsCtx.filter = "none";

    requestAnimationFrame(animateStars);
  }

  animateStars();
})();
