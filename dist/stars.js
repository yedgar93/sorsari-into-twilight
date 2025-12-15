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

  // Screen shake parameters
  const shakeDuration = 1.5;
  const shakeDelayDuration = 0.5;
  const shakeIntensityStar = 1.5; // 1-2px for stars
  const firstDropShakeEndTime = 95; // 1:35 - stop shaking at breakdown
  const secondDropShakeEndTime = 192; // 3:12 - stop shaking

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
        starsCanvas.style.transform = `translate(${shakeOffsetX}px, ${shakeOffsetY}px)`;
      } else {
        // In delay phase
        starsCanvas.style.transform = "translate(0, 0)";
      }
    } else {
      starsCanvas.style.transform = "translate(0, 0)";
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
            starsCtx.moveTo(star.drawX, star.drawY);
            starsCtx.lineTo(star.drawX - star.vx * 8, star.drawY - star.vy * 8);
          });
          starsCtx.stroke();
        } else {
          // Draw dots for normal stars
          starsCtx.fillStyle = `rgba(255, 255, 255, ${layer.opacity})`;
          starsCtx.beginPath();
          normalStars.forEach((star) => {
            starsCtx.moveTo(star.drawX + layer.size * depthScale, star.drawY);
            starsCtx.arc(
              star.drawX,
              star.drawY,
              layer.size * depthScale,
              0,
              Math.PI * 2
            );
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
          starsCtx.moveTo(star.drawX, star.drawY);
          starsCtx.lineTo(star.drawX - star.vx * 8, star.drawY - star.vy * 8);
          starsCtx.stroke();
        } else {
          starsCtx.fillStyle = `rgba(255, 255, 255, ${finalOpacity})`;
          starsCtx.beginPath();
          starsCtx.arc(star.drawX, star.drawY, finalSize, 0, Math.PI * 2);
          starsCtx.fill();
        }
      });
    });

    // Reset filter after all layers are drawn
    starsCtx.filter = "none";

    requestAnimationFrame(animateStars);
  }

  animateStars();
})();
