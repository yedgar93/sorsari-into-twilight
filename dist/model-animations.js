/**
 * Model Viewer Animations
 * - Center model camera animation (oscillation and 360° spin)
 * - Zoom and fade animation for center model
 * - Final image fade in animation
 * - TERROR model interaction and auto-reset
 */

(function () {
  "use strict";

  // =====================
  // MOBILE DETECTION & COMPRESSED MODELS
  // =====================
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

  console.log(`[Model Viewer] Device Type: ${isMobile ? "MOBILE" : "DESKTOP"}`);

  // Switch to compressed models on mobile for better performance
  if (isMobile) {
    const centerModelViewer = document.querySelector("#model-viewer");
    const terrorModelViewer = document.querySelector("#terror-model-viewer");

    if (centerModelViewer) {
      centerModelViewer.src = "base_basic_shaded-compressed.glb";
      console.log(
        "[Model Viewer] Center Model: base_basic_shaded-compressed.glb (mobile)"
      );
    }
    if (terrorModelViewer) {
      terrorModelViewer.src = "TERRORbase_basic_shaded-compressed.glb";
      console.log(
        "[Model Viewer] TERROR Model: TERRORbase_basic_shaded-compressed.glb (mobile)"
      );
    }
  } else {
    console.log("[Model Viewer] Center Model: base_basic_shaded.glb (desktop)");
    console.log(
      "[Model Viewer] TERROR Model: TERRORbase_basic_shaded.glb (desktop)"
    );
  }

  // =====================
  // CENTER MODEL CAMERA
  // =====================
  const modelViewer = document.querySelector("#model-viewer");
  const modelViewerWrapper = document.querySelector("#model-viewer-wrapper");
  let time = 0;

  // 360 spin variables
  const spinTimes = [30.89, 126.9]; // Spin moments at 30.89s and 2:07.03 (127.03s)
  const spinDuration = 1.0; // Duration of spin in seconds
  const blendDuration = 0.5; // Duration to blend from locked to oscillating after spin
  let currentSpinIndex = -1;
  let lastSpinEndYaw = 0; // Track where the last spin ended
  let lastSpinEndPitch = 75; // Track where the last spin ended
  let lastSpinEndTime = 0; // When the last spin ended

  // Throttle camera animation to 30fps (every other frame)
  let cameraFrameCount = 0;

  function animateModelCamera() {
    cameraFrameCount++;
    // Only update every 2 frames (30fps instead of 60fps)
    if (cameraFrameCount % 2 !== 0) {
      requestAnimationFrame(animateModelCamera);
      return;
    }

    time += 0.032; // ~30fps (0.016 * 2)

    const currentTime = SORSARI.musicTime || 0;

    let yaw, pitch, distance;

    // Calculate oscillation based on time since last spin
    const timeSinceLastSpin = time - lastSpinEndTime;
    const oscillationYaw = Math.sin(timeSinceLastSpin * 0.3) * 20;
    const oscillationPitch = 75 + Math.sin(timeSinceLastSpin * 0.2) * 15;
    const oscillationDistance = 105 + Math.sin(timeSinceLastSpin * 0.25) * 20;

    // Determine current state
    let currentState = "normal";
    let activeSpinTime = 0;

    for (let i = 0; i < spinTimes.length; i++) {
      const spinStart = spinTimes[i];
      const spinEnd = spinStart + spinDuration;
      const blendEnd = spinEnd + blendDuration;

      if (currentTime >= spinStart && currentTime < spinEnd) {
        currentState = "spinning";
        activeSpinTime = spinStart;
        if (currentSpinIndex !== i) {
          currentSpinIndex = i;
          modelViewer.removeAttribute("min-camera-orbit");
          modelViewer.removeAttribute("max-camera-orbit");
        }
        break;
      } else if (currentTime >= spinEnd && currentTime < blendEnd) {
        currentState = "blending";
        activeSpinTime = spinStart;
        break;
      }
    }

    if (currentState === "spinning") {
      // Calculate current oscillation position at the START of the spin
      const currentOscillationYaw = lastSpinEndYaw + oscillationYaw;
      const currentOscillationPitch = oscillationPitch;

      // Calculate spin progress (0 to 1)
      const spinProgress = (currentTime - activeSpinTime) / spinDuration;
      const easedProgress = 1 - Math.pow(1 - spinProgress, 3); // Ease-out cubic

      // Spin 360° from current oscillation position
      yaw = currentOscillationYaw + easedProgress * 360;
      pitch = currentOscillationPitch;
      distance = oscillationDistance;

      // At end of spin, update where we ended (back to same visual position)
      if (spinProgress >= 0.99) {
        lastSpinEndYaw = currentOscillationYaw;
        lastSpinEndPitch = currentOscillationPitch;
        lastSpinEndTime = time;
      }
    } else if (currentState === "blending") {
      // Blend from locked to oscillating
      const blendProgress =
        (currentTime - (activeSpinTime + spinDuration)) / blendDuration;
      const blendEase = blendProgress * blendProgress * (3 - 2 * blendProgress); // Smooth step

      // Gradually introduce oscillation amplitude
      yaw = lastSpinEndYaw + oscillationYaw * blendEase;
      pitch =
        lastSpinEndPitch + (oscillationPitch - lastSpinEndPitch) * blendEase;
      distance = oscillationDistance;
    } else {
      // Normal oscillation
      if (currentSpinIndex !== -1) {
        // Just exited blend mode - restore constraints
        currentSpinIndex = -1;
        modelViewer.setAttribute("min-camera-orbit", "-30deg 60deg auto");
        modelViewer.setAttribute("max-camera-orbit", "30deg 90deg auto");
      }

      yaw = lastSpinEndYaw + oscillationYaw;
      pitch = oscillationPitch;
      distance = oscillationDistance;
    }

    modelViewer.cameraOrbit = `${yaw}deg ${pitch}deg ${distance}%`;

    requestAnimationFrame(animateModelCamera);
  }

  modelViewer.addEventListener("load", () => {
    animateModelCamera();
  });

  // =====================
  // CENTER MODEL ZOOM & FADE
  // =====================
  const dropTime = 31.5;
  const fadeInDuration = 2.5;
  const zoomInStart = 25;
  const zoomInEnd = 64;
  const zoomOutEnd = 94;
  const maxZoomScale = 1.75;
  const modelFadeOutStart = 205;
  const modelFadeOutEnd = 215;
  const modelFadeOutDuration = modelFadeOutEnd - modelFadeOutStart;
  const finalZoomOutStart = 195;
  const finalZoomOutEnd = 215;
  const finalZoomOutDuration = finalZoomOutEnd - finalZoomOutStart;

  // CENTER MODEL BRIGHTNESS
  // =====================
  const brightnessStartValue = 0.1; // Start at 0.1 brightness
  const brightnessEndTime = 11.5; // Reach full brightness by 11.5 seconds
  const brightnessEndValue = 1.0; // Full brightness

  // Throttle zoom animation to 30fps (every other frame)
  let zoomFrameCount = 0;

  function animateModelViewerZoom() {
    zoomFrameCount++;
    // Only update every 2 frames (30fps instead of 60fps)
    if (zoomFrameCount % 2 !== 0) {
      requestAnimationFrame(animateModelViewerZoom);
      return;
    }

    const currentTime = SORSARI.musicTime || 0;

    // Fade in opacity over first 2.5 seconds
    let opacity = 1.0;
    if (currentTime < fadeInDuration) {
      opacity = currentTime / fadeInDuration;
    } else if (
      currentTime >= modelFadeOutStart &&
      currentTime <= modelFadeOutEnd
    ) {
      const fadeProgress =
        (currentTime - modelFadeOutStart) / modelFadeOutDuration;
      opacity = 1.0 - fadeProgress;
    } else if (currentTime > modelFadeOutEnd) {
      opacity = 0;
    }
    modelViewer.style.opacity = opacity;

    // Brightness animation (0.1 to 1.0 over first 0.07 seconds)
    let brightness = brightnessEndValue;
    if (currentTime < brightnessEndTime) {
      const brightnessProgress = currentTime / brightnessEndTime;
      brightness =
        brightnessStartValue +
        (brightnessEndValue - brightnessStartValue) * brightnessProgress;
    }
    modelViewerWrapper.style.filter = `brightness(${brightness})`;

    // Base scale animation (0 to 31.5s)
    let baseScale = 1.0;
    if (currentTime < dropTime) {
      const progress = currentTime / dropTime;
      const easedProgress =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      baseScale = 0.01 + (1.0 - 0.01) * easedProgress;
    }

    // Additional zoom effect (0:32 to 1:35)
    let zoomMultiplier = 1.0;
    if (currentTime >= zoomInStart && currentTime < zoomInEnd) {
      const zoomProgress =
        (currentTime - zoomInStart) / (zoomInEnd - zoomInStart);
      const easedZoom =
        zoomProgress < 0.5
          ? 4 * zoomProgress * zoomProgress * zoomProgress
          : 1 - Math.pow(-2 * zoomProgress + 2, 3) / 2;
      zoomMultiplier = 1.0 + (maxZoomScale - 1.0) * easedZoom;
    } else if (currentTime >= zoomInEnd && currentTime < zoomOutEnd) {
      const zoomOutProgress =
        (currentTime - zoomInEnd) / (zoomOutEnd - zoomInEnd);
      const easedZoomOut =
        zoomOutProgress < 0.5
          ? 4 * zoomOutProgress * zoomOutProgress * zoomOutProgress
          : 1 - Math.pow(-2 * zoomOutProgress + 2, 3) / 2;
      zoomMultiplier = maxZoomScale - (maxZoomScale - 1.0) * easedZoomOut;
    }

    // Final zoom out effect (3:15 to 3:35) - scale down to 0
    let finalZoomMultiplier = 1.0;
    if (currentTime >= finalZoomOutStart && currentTime <= finalZoomOutEnd) {
      const finalZoomProgress =
        (currentTime - finalZoomOutStart) / finalZoomOutDuration;
      const easedFinalZoom =
        finalZoomProgress * finalZoomProgress * finalZoomProgress;
      finalZoomMultiplier = 1.0 - easedFinalZoom;
    } else if (currentTime > finalZoomOutEnd) {
      finalZoomMultiplier = 0.0;
    }

    const finalScale = baseScale * zoomMultiplier * finalZoomMultiplier;
    modelViewer.style.transform = `translate(-50%, -50%) scale(${finalScale})`;

    requestAnimationFrame(animateModelViewerZoom);
  }

  animateModelViewerZoom();

  // =====================
  // FINAL IMAGE FADE IN
  // =====================
  const finalImage = document.getElementById("final-image");
  const finalImageContainer = document.getElementById("final-image-container");
  const finalImageFadeStart = 213;
  const finalImageFadeDuration = 1.5;
  const finalImagePreloadTime = 200; // Start loading 13 seconds before it appears
  let tiltInitialized = false;
  let finalImageLoaded = false;

  // Click on final image to open Spotify
  finalImage.addEventListener("click", () => {
    window.open(
      "https://open.spotify.com/artist/2t01L1I0juJWbThU5jP06Y",
      "_blank"
    );
  });

  function animateFinalImage() {
    const currentTime = SORSARI.musicTime || 0;

    // Lazy load the final image 13 seconds before it appears
    if (currentTime >= finalImagePreloadTime && !finalImageLoaded) {
      const dataSrc = finalImage.getAttribute("data-src");
      if (dataSrc) {
        finalImage.src = dataSrc;
        finalImage.removeAttribute("data-src");
        finalImageLoaded = true;
        console.log("Final image lazy loaded at", currentTime);
      }
    }

    if (currentTime >= finalImageFadeStart) {
      const timeSinceFadeStart = currentTime - finalImageFadeStart;
      if (timeSinceFadeStart < finalImageFadeDuration) {
        const fadeProgress = timeSinceFadeStart / finalImageFadeDuration;
        finalImageContainer.style.opacity = fadeProgress;
        if (fadeProgress > 0.1) {
          finalImageContainer.style.pointerEvents = "auto";
          if (!tiltInitialized && typeof VanillaTilt !== "undefined") {
            VanillaTilt.init(finalImage);
            tiltInitialized = true;
          }
        }
      } else {
        finalImageContainer.style.opacity = 1;
        finalImageContainer.style.pointerEvents = "auto";
        if (!tiltInitialized && typeof VanillaTilt !== "undefined") {
          VanillaTilt.init(finalImage);
          tiltInitialized = true;
        }
      }
    }

    requestAnimationFrame(animateFinalImage);
  }

  animateFinalImage();

  // =====================
  // TERROR MODEL CONTROLS
  // =====================
  const terrorModelViewer = document.querySelector("#terror-model-viewer");

  // Adjust rotation speed on mobile (isMobile already declared at top)
  if (isMobile) {
    // On mobile, reduce rotation speed to 15deg/sec (was 45deg/sec)
    // This reduces GPU load while keeping the model animated
    terrorModelViewer.setAttribute("rotation-per-second", "15deg");
  }

  const targetTerrorOrbit = { theta: 75, radius: 150 };
  let isUserInteracting = false;
  let resetTimeout;
  let userHasMoved = false;

  // Double click/tap to open SoundCloud link
  let lastTapTime = 0;
  const doubleTapDelay = 300;

  terrorModelViewer.addEventListener("dblclick", () => {
    window.open("https://soundcloud.com/terrorhythm", "_blank");
  });

  // Detect when user starts interacting
  terrorModelViewer.addEventListener("mousedown", () => {
    isUserInteracting = true;
    userHasMoved = false;
    clearTimeout(resetTimeout);
  });

  terrorModelViewer.addEventListener("touchstart", () => {
    isUserInteracting = true;
    userHasMoved = false;
    clearTimeout(resetTimeout);
  });

  // Detect when user stops interacting
  terrorModelViewer.addEventListener("mouseup", () => {
    if (isUserInteracting && userHasMoved) {
      isUserInteracting = false;
      resetTimeout = setTimeout(() => {
        smoothResetCamera();
      }, 2000);
    }
  });

  terrorModelViewer.addEventListener("touchend", (e) => {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTapTime;

    if (tapLength < doubleTapDelay && tapLength > 0) {
      e.preventDefault();
      window.open("https://soundcloud.com/terrorhythm", "_blank");
      lastTapTime = 0;
      return;
    }
    lastTapTime = currentTime;

    if (isUserInteracting && userHasMoved) {
      isUserInteracting = false;
      resetTimeout = setTimeout(() => {
        smoothResetCamera();
      }, 2000);
    }
  });

  // Track if user actually moved the camera
  terrorModelViewer.addEventListener("camera-change", () => {
    if (isUserInteracting) {
      userHasMoved = true;
    }
  });

  function smoothResetCamera() {
    const currentOrbit = terrorModelViewer.getCameraOrbit();
    const currentTheta = currentOrbit.theta * (180 / Math.PI);

    let step = 0;
    const steps = 60;

    function animate() {
      if (isUserInteracting) return;

      step++;
      const progress = step / steps;
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      const newTheta =
        currentTheta + (targetTerrorOrbit.theta - currentTheta) * easeProgress;
      const liveOrbit = terrorModelViewer.getCameraOrbit();
      const livePhi = liveOrbit.phi * (180 / Math.PI);

      terrorModelViewer.cameraOrbit = `${livePhi}deg ${newTheta}deg ${targetTerrorOrbit.radius}%`;

      if (step < steps) {
        requestAnimationFrame(animate);
      }
    }

    animate();
  }

  // =====================
  // TEXT FADE IN ANIMATION
  // =====================
  const textFadeInDelay = 8.0; // Delay before fade starts
  const textFadeInDuration = 16.0; // Duration of fade
  const textFadeInStart = textFadeInDelay; // When fade actually starts
  const textFadeInEnd = textFadeInDelay + textFadeInDuration; // When fade completes
  const sorsariText = document.getElementById("sorsari-text");
  const trackTitle = document.getElementById("track-title");
  const terrorModel = document.getElementById("terror-model-viewer");
  const bottomImage = document.getElementById("bottom-image");
  const mobileLeftImage = document.getElementById("mobile-left-image");
  const mobileRightImage = document.getElementById("mobile-right-image");

  const trackTitleFadeOutStart = 47;
  const trackTitleFadeOutEnd = 57;
  const trackTitleFadeOutDuration =
    trackTitleFadeOutEnd - trackTitleFadeOutStart;

  function animateTextFadeIn() {
    const currentTime = SORSARI.musicTime || 0;

    if (currentTime < textFadeInStart) {
      // Before fade starts - keep opacity at 0
      const opacity = 0;
      sorsariText.style.opacity = opacity;
      trackTitle.style.opacity = opacity * 0.7;
      terrorModel.style.opacity = opacity;
      bottomImage.style.opacity = opacity;
      mobileLeftImage.style.opacity = opacity;
      mobileRightImage.style.opacity = opacity;
    } else if (currentTime < textFadeInEnd) {
      // During fade - gradually increase opacity
      const fadeProgress = (currentTime - textFadeInStart) / textFadeInDuration;
      const opacity = fadeProgress;
      sorsariText.style.opacity = opacity;
      trackTitle.style.opacity = opacity * 0.7;
      terrorModel.style.opacity = opacity;
      bottomImage.style.opacity = opacity;
      mobileLeftImage.style.opacity = opacity;
      mobileRightImage.style.opacity = opacity;
    } else {
      sorsariText.style.opacity = 1;

      let trackTitleOpacity = 0.7;
      if (
        currentTime >= trackTitleFadeOutStart &&
        currentTime <= trackTitleFadeOutEnd
      ) {
        const fadeProgress =
          (currentTime - trackTitleFadeOutStart) / trackTitleFadeOutDuration;
        trackTitleOpacity = 0.7 * (1.0 - fadeProgress);
      } else if (currentTime > trackTitleFadeOutEnd) {
        trackTitleOpacity = 0;
      }
      trackTitle.style.opacity = trackTitleOpacity;

      terrorModel.style.opacity = 1;
      bottomImage.style.opacity = 1;
      mobileLeftImage.style.opacity = 1;
      mobileRightImage.style.opacity = 1;
    }

    requestAnimationFrame(animateTextFadeIn);
  }

  animateTextFadeIn();
})();
