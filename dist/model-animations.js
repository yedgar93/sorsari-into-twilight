/// <reference path="./types.d.ts" />

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
  // Use centralized mobile detection from script.js
  const isMobile = window.SORSARI?.isMobile ?? false;

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
  // Cache model viewers to avoid repeated queries during animation loops
  const modelViewer = document.querySelector("#model-viewer");
  const modelViewerWrapper = document.querySelector("#model-viewer-wrapper");
  let time = 0;

  // 360 spin variables
  // Spin events occur at specific music timestamps (see EFFECT_TIMELINE.md for details)
  const spinTimes = [30.89, 126.9]; // Spin moments at 30.89s (0:31) and 126.9s (2:07)
  const spinDuration = 1.0; // Duration of spin in seconds
  const blendDuration = 0.125; // Duration to blend from locked to oscillating after spin
  let currentSpinIndex = -1;
  let manualSpinStartTime = null; // For manual spin trigger
  let isManualSpinning = false;
  let spinCooldownEndTime = 0; // Prevent retriggering too soon

  // Terror model manual spin variables
  let isTerrorManualSpinning = false;
  let terrorOriginalRotationSpeed = null; // Store original rotation speed

  // Expose manual spin trigger
  SORSARI.triggerCenterModelSpin = function() {
    const currentTime = SORSARI.musicTime || 0;
    const audio = SORSARI.audioElement;
    
    // Prevent triggering before song starts or after it ends
    if (!audio || audio.currentTime === 0 || audio.ended) return;
    
    if (isManualSpinning || isTerrorManualSpinning || currentTime < spinCooldownEndTime) return; // Already spinning or in cooldown
    isManualSpinning = true;
    manualSpinStartTime = currentTime;
    // Remove constraints during spin (but not if user is currently interacting)
    if (modelViewer && !isUserInteractingWithCenter) {
      modelViewer.removeAttribute("min-camera-orbit");
      modelViewer.removeAttribute("max-camera-orbit");
    }
    console.log("[Easter Egg] SPIN triggered!");
    
    // Play the lol sound
    const lolSound = new Audio("CDKefkaLaugh.wav");
    lolSound.play();
    
    // Also trigger terror model spin by temporarily increasing rotation speed 5x for 1 second
    if (!isTerrorManualSpinning && typeof terrorModelViewer !== 'undefined' && terrorModelViewer) {
      isTerrorManualSpinning = true;
      // Get current rotation speed
      const currentSpeed = terrorModelViewer.getAttribute("rotation-per-second") || "45deg"; // default to 45deg if not set
      const speedValue = parseFloat(currentSpeed);
      terrorOriginalRotationSpeed = currentSpeed;
      // Set to 10x speed initially
      const boostedSpeed = (speedValue * 10) + "deg";
      terrorModelViewer.setAttribute("rotation-per-second", boostedSpeed);
      // Decelerate: after 0.3s to 5x, 0.6s to 2x, 1s back to normal
      setTimeout(() => {
        const midSpeed = (speedValue * 5) + "deg";
        terrorModelViewer.setAttribute("rotation-per-second", midSpeed);
      }, 300);
      setTimeout(() => {
        const slowSpeed = (speedValue * 2) + "deg";
        terrorModelViewer.setAttribute("rotation-per-second", slowSpeed);
      }, 600);
      setTimeout(() => {
        // Pause rotation for 250ms like center model freeze
        terrorModelViewer.setAttribute("rotation-per-second", "0deg");
        setTimeout(() => {
          if (terrorOriginalRotationSpeed) {
            terrorModelViewer.setAttribute("rotation-per-second", terrorOriginalRotationSpeed);
          }
          isTerrorManualSpinning = false;
          terrorOriginalRotationSpeed = null;
        }, 250);
      }, 1000);
    }
  };
  // Dedicated animation loop for terror model camera
  let lastSpinEndYaw = 0; // Track where the last spin ended
  let lastSpinEndPitch = 75; // Track where the last spin ended
  let lastSpinEndTime = 0; // When the last spin ended

  // User interaction tracking
  let isUserInteractingWithCenter = false;
  let isHoldingPosition = false; // Pause animation to hold position
  let userInteractionTimeout = null;
  const userInteractionHoldDelay = 500; // 0.5 seconds to hold position after user stops
  const userInteractionResetDelay = 1000; // 1 second total before restoring constraints

  // Throttle camera animation to 30fps (every other frame)
  let cameraFrameCount = 0;

  /**
   * Camera animation state machine for center model viewer
   *
   * STATE MACHINE:
   * 1. NORMAL: Continuous oscillation with sinusoidal movement
   * 2. SPINNING: 360° camera spin (triggered at specific music timestamps)
   * 3. BLENDING: Smooth transition from spin back to oscillation
   *
   * The animation is driven by SORSARI.musicTime (from audio playback),
   * ensuring the camera motion stays perfectly synchronized with the music.
   *
   * USER INTERACTION:
   * - After 10 seconds into the track, users can manually rotate the camera
   * - While interacting, timeline-based animation pauses
   * - After release, animation freezes for 500ms then resumes
   *
   * OSCILLATION PARAMETERS:
   * - Yaw: ±20° oscillation (left-right rotation, controlled by sin(time * 0.3))
   * - Pitch: 75° ± 15° (up-down tilt, controlled by sin(time * 0.2))
   * - Distance: 105% ± 20% (zoom, controlled by sin(time * 0.25))
   *
   * @function animateModelCamera
   * @returns {void}
   */
  function animateModelCamera() {
    cameraFrameCount++;
    // Only update every 2 frames (30fps instead of 60fps)
    if (cameraFrameCount % 2 !== 0) {
      requestAnimationFrame(animateModelCamera);
      return;
    }

    time += 0.032; // ~30fps (0.016 * 2)

    const currentTime = SORSARI.musicTime || 0;

    // Enable interaction after 10 seconds
    if (!interactionEnabled && currentTime >= interactionEnableTime) {
      interactionEnabled = true;
      console.log("Model viewer interaction enabled");
    }

    let yaw, pitch, distance;

    // If user is interacting or holding position, don't update camera from timeline
    if (isUserInteractingWithCenter || isHoldingPosition) {
      // Don't set cameraOrbit - let the user control it freely or hold current position
      requestAnimationFrame(animateModelCamera);
      return;
    }

    // User is not interacting, so resume timeline animation
    {
      // Calculate oscillation based on MUSIC TIME (not local timer)
      const oscillationYaw = Math.sin(currentTime * 0.3) * 20;
      const oscillationPitch = 75 + Math.sin(currentTime * 0.2) * 15;
      const oscillationDistance = 105 + Math.sin(currentTime * 0.25) * 20;

      // Determine current state
      let currentState = "normal";
      let activeSpinTime = 0;

      // Check for manual spin first
      if (isManualSpinning && manualSpinStartTime !== null) {
        const manualSpinProgress = (currentTime - manualSpinStartTime) / spinDuration;
        if (manualSpinProgress < 1) {
          currentState = "spinning";
          activeSpinTime = manualSpinStartTime;
        } else if (manualSpinProgress < 1 + blendDuration) {
          currentState = "blending";
          activeSpinTime = manualSpinStartTime;
        } else {
          // Manual spin complete - freeze position like user interaction reset
          isManualSpinning = false;
          manualSpinStartTime = null;
          spinCooldownEndTime = (SORSARI.musicTime || 0) + 1.0; // 1 second cooldown
          isHoldingPosition = true; // Freeze animation
          // Keep position frozen for 0.25 seconds
          setTimeout(() => {
            isHoldingPosition = false; // Resume animation
          }, 250);
          // Restore constraints after 1 second total
          setTimeout(() => {
            if (modelViewer) {
              modelViewer.setAttribute("min-camera-orbit", "-30deg 60deg auto");
              modelViewer.setAttribute("max-camera-orbit", "30deg 90deg auto");
            }
          }, 1000);
        }
      }

      // Check timeline spins only if not manually spinning
      if (!isManualSpinning) {
        for (let i = 0; i < spinTimes.length; i++) {
        const spinStart = spinTimes[i];
        const spinEnd = spinStart + spinDuration;
        const blendEnd = spinEnd + blendDuration;

        if (currentTime >= spinStart && currentTime < spinEnd) {
          currentState = "spinning";
          activeSpinTime = spinStart;
          if (currentSpinIndex !== i && modelViewer) {
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
        const blendEase =
          blendProgress * blendProgress * (3 - 2 * blendProgress); // Smooth step

        // Gradually introduce oscillation amplitude
        yaw = lastSpinEndYaw + oscillationYaw * blendEase;
        pitch =
          lastSpinEndPitch + (oscillationPitch - lastSpinEndPitch) * blendEase;
        distance = oscillationDistance;
      } else {
        // Normal oscillation
        if (currentSpinIndex !== -1) {
          // Just exited blend mode - restore constraints (unless user is interacting)
          currentSpinIndex = -1;
          if (!isUserInteractingWithCenter && modelViewer) {
            modelViewer.setAttribute("min-camera-orbit", "-30deg 60deg auto");
            modelViewer.setAttribute("max-camera-orbit", "30deg 90deg auto");
          }
        }

        yaw = lastSpinEndYaw + oscillationYaw;
        pitch = oscillationPitch;
        distance = oscillationDistance;
      }
    }

    // Only update cameraOrbit if modelViewer exists
    if (modelViewer) {
      modelViewer.cameraOrbit = `${yaw}deg ${pitch}deg ${distance}%`;
    }

    requestAnimationFrame(animateModelCamera);
  }

  modelViewer.addEventListener("load", () => {
    animateModelCamera();
  });

  // =====================
  // CENTER MODEL USER INTERACTION
  // =====================
  /**
   * User Interaction Controller for Center Model Viewer
   *
   * INTERACTION FLOW:
   * 1. Users can interact after 10 seconds (interactionEnableTime)
   * 2. On mousedown/touchstart: Timeline animation pauses, constraints expand
   * 3. On mouseup/touchend: Timeline animation resumes after 500ms freeze
   * 4. After 1 second total: Camera orbit constraints restore to default
   *
   * CONSTRAINT BEHAVIOR:
   * - Default: ±30° yaw, 60-90° pitch (limited oscillation zone)
   * - Desktop interaction: ±110° yaw, 20-160° pitch (2 full rotations)
   * - Mobile interaction: ±720° yaw, 0-180° pitch (extreme freedom)
   *
   * STATE VARIABLES:
   * - isUserInteractingWithCenter: Currently dragging/touching
   * - isHoldingPosition: Frozen state after interaction ends
   * - interactionEnabled: Unlocked after 10 seconds
   */

  // Disable interaction until 10 seconds into the song
  const interactionEnableTime = 7; // seconds
  let interactionEnabled = false;

  /**
   * Handle mouse/touch interaction start
   * Expands camera constraints to allow free rotation
   * Desktop: ±110° yaw | Mobile: ±720° yaw (extreme range for max flexibility)
   */
  modelViewer.addEventListener("mousedown", () => {
    // Only allow interaction after 10 seconds
    if (!interactionEnabled) {
      return;
    }
    isUserInteractingWithCenter = true;
    clearTimeout(userInteractionTimeout);
    // Allow multiple rotations (720° = 2 full rotations)
    modelViewer.setAttribute("min-camera-orbit", "-110deg 20deg auto");
    modelViewer.setAttribute("max-camera-orbit", "110deg 160deg auto");
  });

  /**
   * Handle touch interaction start (mobile)
   * Expands constraints to allow free rotation (same as desktop)
   */
  modelViewer.addEventListener("touchstart", () => {
    // Only allow interaction after 10 seconds
    if (!interactionEnabled) {
      return;
    }
    isUserInteractingWithCenter = true;
    clearTimeout(userInteractionTimeout);
    // Allow same rotation range as desktop: ±110° yaw, 20-160° pitch
    modelViewer.setAttribute("min-camera-orbit", "-110deg 20deg auto");
    modelViewer.setAttribute("max-camera-orbit", "110deg 160deg auto");
  });

  /**
   * Handle mouse interaction end
   * Freezes camera for 500ms, then resumes animation
   * Restores orbit constraints after 1 second
   */
  modelViewer.addEventListener("mouseup", () => {
    if (isUserInteractingWithCenter) {
      isUserInteractingWithCenter = false;
      isHoldingPosition = true; // Freeze animation
      // Keep position frozen for 0.5 seconds
      clearTimeout(userInteractionTimeout);
      userInteractionTimeout = setTimeout(() => {
        isHoldingPosition = false; // Resume animation
      }, userInteractionHoldDelay);
      // Restore constraints after 1 second total
      setTimeout(() => {
        modelViewer.setAttribute("min-camera-orbit", "-30deg 60deg auto");
        modelViewer.setAttribute("max-camera-orbit", "30deg 90deg auto");
      }, userInteractionResetDelay);
    }
  });

  /**
   * Handle touch interaction end (mobile)
   * Same behavior as mouseup but for touch events
   */
  modelViewer.addEventListener("touchend", () => {
    if (isUserInteractingWithCenter) {
      isUserInteractingWithCenter = false;
      isHoldingPosition = true; // Freeze animation
      // Keep position frozen for 0.5 seconds
      clearTimeout(userInteractionTimeout);
      userInteractionTimeout = setTimeout(() => {
        isHoldingPosition = false; // Resume animation
      }, userInteractionHoldDelay);
      // Restore constraints after 1 second total
      setTimeout(() => {
        modelViewer.setAttribute("min-camera-orbit", "-30deg 60deg auto");
        modelViewer.setAttribute("max-camera-orbit", "30deg 90deg auto");
      }, userInteractionResetDelay);
    }
  });

  // =====================
  // CENTER MODEL ZOOM & FADE
  // =====================
  /**
   * ZOOM & FADE ANIMATION TIMELINE
   *
   * ZOOM PHASES:
   * 1. 0:00-0:25 (0-25s): Pixel blur ramps in (0-12px blur) + brightness ramps up
   * 2. 0:25-1:04 (25-64s): Zoom in phase (scale 1.0 → 1.75x)
   * 3. 1:04-1:34 (64-94s): Zoom out phase (scale 1.75x → 1.0) - BREAKDOWN happens at 1:35
   * 4. 1:35-3:15 (95-195s): Hold steady
   * 5. 3:15-3:35 (195-215s): Final zoom out + fade out
   *
   * BRIGHTNESS:
   * - 0:00-0:31: Ramp from 0.1 to 1.0 (full brightness at first drop)
   * - 0:31-3:15: Hold full brightness
   * - 3:15-3:35: Fade out to 0
   *
   * PIXEL BLUR (CRT effect):
   * - 0:00-0:15.5: Ramp from 0px to 12px (creates pixelated "glitch" effect)
   * - 0:15.5+: Hold at 12px
   */
  const dropTime = 31.5; // 0:31 - first drop timestamp
  const fadeInDuration = 2.5;
  const zoomInStart = 25; // 0:25 - begin zooming in
  const zoomInEnd = 64; // 1:04 - finish zooming in
  const zoomOutEnd = 94; // 1:34 - finish zooming out (breakdown at 1:35)
  const maxZoomScale = 1.75; // Maximum zoom level
  const modelFadeOutStart = 205; // 3:25 - start fading out
  const modelFadeOutEnd = 215; // 3:35 - completely faded
  const modelFadeOutDuration = modelFadeOutEnd - modelFadeOutStart;
  const finalZoomOutStart = 195; // 3:15 - start final zoom out
  const finalZoomOutEnd = 215; // 3:35 - finish final zoom out
  const finalZoomOutDuration = finalZoomOutEnd - finalZoomOutStart;

  // Pixel blur parameters (CRT pixelated effect)
  const pixelBlurStart = 0; // 0:00 - start blur ramp
  const pixelBlurEnd = 15.5; // 0:15.5 - finish blur ramp (full 12px blur)
  const pixelBlurDuration = pixelBlurEnd - pixelBlurStart;
  const maxPixelBlur = 12; // Maximum pixel blur amount

  // Get pixel blur wrapper
  const modelPixelBlurWrapper = document.querySelector(
    "#model-pixel-blur-wrapper"
  );

  // CENTER MODEL BRIGHTNESS
  // =====================
  /**
   * Brightness ramp matches the music progression:
   * - Starts low (0.1) during intro to create fade-in effect
   * - Reaches full brightness (1.0) at first drop (0:31)
   * - Maintains full brightness through main section
   * - Fades out during final section (3:10+)
   */
  const brightnessStartValue = 0.1; // Start at 0.1 brightness
  const brightnessDelayStart = 31.5; // Stay at 0.1 brightness until 3 seconds
  const brightnessEndTime = 32.4; // Reach full brightness by 11.5 seconds
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

    // Brightness animation (stay at 0.1 until 3s, then fade to 1.0 by 11.5s)
    let brightness = brightnessStartValue;
    if (
      currentTime >= brightnessDelayStart &&
      currentTime < brightnessEndTime
    ) {
      const brightnessProgress =
        (currentTime - brightnessDelayStart) /
        (brightnessEndTime - brightnessDelayStart);
      brightness =
        brightnessStartValue +
        (brightnessEndValue - brightnessStartValue) * brightnessProgress;
    } else if (currentTime >= brightnessEndTime) {
      brightness = brightnessEndValue;
    }
    // Pixel blur animation (0 to 12.5s)
    let pixelBlurAmount = 0;
    if (currentTime < pixelBlurEnd) {
      const blurProgress = currentTime / pixelBlurDuration;
      pixelBlurAmount = maxPixelBlur * (1 - blurProgress); // Fade from max to 0
    }

    // Debug log every 30 frames
    // Apply pixel blur to outer wrapper
    if (modelPixelBlurWrapper) {
      if (pixelBlurAmount > 0) {
        modelPixelBlurWrapper.style.filter = `blur(${pixelBlurAmount}px)`;
      } else {
        modelPixelBlurWrapper.style.filter = "none";
      }
    }

    // Combine brightness filter for inner wrapper
    let filterValue = `brightness(${brightness})`;
    modelViewerWrapper.style.filter = filterValue;

    // if (zoomFrameCount % 30 === 0) {
    //   console.log(
    //     `[Model Blur] currentTime=${currentTime.toFixed(
    //       2
    //     )}s, pixelBlurAmount=${pixelBlurAmount.toFixed(2)}px, blurFilter="${
    //       modelPixelBlurWrapper?.style.filter || "none"
    //     }"`
    //   );
    // }

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
    if (SORSARI.beepSound) {
      SORSARI.beepSound.play();
    }
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

  // Helper: allow link only when UI fade-in has been active for at least 1s
  // (allowing link even when paused or ended, just not before fade-in)
  function canOpenTerrorLink() {
    const audio = window.SORSARI && SORSARI.audioElement;
    const t =
      (window.SORSARI && (SORSARI.musicTime || (audio && audio.currentTime))) ||
      0;
    // Allow only after the global text/model fade-in has been active >= 1s
    const fadeGuardPassed = t >= textFadeInStart + 1.0;
    return fadeGuardPassed;
  }

  // Double click/tap to open SoundCloud link
  let lastTapTime = 0;
  const doubleTapDelay = 300;

  terrorModelViewer.addEventListener("dblclick", (e) => {
    if (!canOpenTerrorLink()) {
      e.preventDefault();
      return;
    }
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
      if (!canOpenTerrorLink()) {
        lastTapTime = 0;
        return;
      }
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

  let terrorModelFadedIn = false; // Track if terror model has faded in

  function animateTextFadeIn() {
    const currentTime = SORSARI.musicTime || 0;

    if (currentTime < textFadeInStart) {
      // Before fade starts - keep opacity at 0
      const opacity = 0;
      sorsariText.style.opacity = opacity;
      trackTitle.style.opacity = opacity * 0.7;
      terrorModel.style.opacity = opacity;
      // Only disable pointer-events if not yet faded in
      if (!terrorModelFadedIn) {
        terrorModel.style.pointerEvents = "none";
      }
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
      terrorModel.style.pointerEvents = "auto";
      terrorModelFadedIn = true; // Mark as faded in
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
      terrorModel.style.pointerEvents = "auto";
      terrorModelFadedIn = true; // Mark as faded in
      bottomImage.style.opacity = 1;
      mobileLeftImage.style.opacity = 1;
      mobileRightImage.style.opacity = 1;
    }

    requestAnimationFrame(animateTextFadeIn);
  }

  animateTextFadeIn();

  // =====================
  // RESET FUNCTION FOR REPLAY
  // =====================
  window.SORSARI = window.SORSARI || {};
  SORSARI.resetModelAnimations = function () {
    console.log("[Model Animations] Resetting all animations");

    // Reset time variables
    time = 0;
    cameraFrameCount = 0;
    zoomFrameCount = 0;
    currentSpinIndex = -1;
    lastSpinEndYaw = 0;
    lastSpinEndPitch = 75;
    lastSpinEndTime = 0;
    tiltInitialized = false;
    finalImageLoaded = false;

    // Reset model opacities and transforms
    modelViewer.style.opacity = 0;
    modelViewer.style.transform = "translate(-50%, -50%) scale(1)";

    // Reset final image
    finalImageContainer.style.opacity = 0;
    finalImageContainer.style.pointerEvents = "none";
    const finalImage = document.getElementById("final-image");
    if (finalImage) {
      finalImage.setAttribute("data-src", "SOSARI-BTS-FINAL-V4.JPG");
      finalImage.src = "";
    }

    // Reset text and UI elements
    sorsariText.style.opacity = 0;
    trackTitle.style.opacity = 0;
    terrorModel.style.opacity = 0;
    bottomImage.style.opacity = 0;
    mobileLeftImage.style.opacity = 0;
    mobileRightImage.style.opacity = 0;
  };
})();
