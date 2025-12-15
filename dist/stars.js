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
      blur: 3.0,
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

    // Calculate zoom scale (zoom out from 2x to 1x over first 20 seconds)
    let zoomScale = 1.0;
    if (currentTime < zoomOutEnd) {
      const zoomProgress = currentTime / zoomOutDuration;
      zoomScale = zoomStartScale - (zoomStartScale - 1.0) * zoomProgress;
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

    if (isInFirstDrop || isInSecondDrop) {
      const timeSinceDropStart = isInFirstDrop
        ? currentTime - firstDropTime
        : currentTime - secondDropTime;
      const cycleTime =
        timeSinceDropStart % (shakeDuration + shakeDelayDuration);

      if (cycleTime < shakeDuration) {
        // In shake phase
        const shakeOffsetX = (Math.random() - 0.5) * shakeIntensityStar;
        const shakeOffsetY = (Math.random() - 0.5) * shakeIntensityStar;
        starsCanvas.style.transform = `translate(${shakeOffsetX}px, ${shakeOffsetY}px) scale(${zoomScale})`;
      } else {
        // In delay phase
        starsCanvas.style.transform = `scale(${zoomScale})`;
      }
    } else {
      starsCanvas.style.transform = `scale(${zoomScale})`;
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
    } else if (currentTime >= secondDropTime) {
      timingState = "secondDrop";
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
        if (isDropActive) {
          // Draw trails for normal stars
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
          // Draw dots for normal stars
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

    requestAnimationFrame(animateStars);
  }

  animateStars();
})();
