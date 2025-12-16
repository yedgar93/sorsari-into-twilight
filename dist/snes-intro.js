// SNES Intro Stars - Separate script to avoid timing issues
(function () {
  // Wait for DOM to be ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSnesIntroStars);
  } else {
    initSnesIntroStars();
  }

  function initSnesIntroStars() {
    // Create canvas
    const snesIntroCanvas = document.createElement("canvas");
    snesIntroCanvas.id = "snes-intro-canvas";
    snesIntroCanvas.width = window.innerWidth;
    snesIntroCanvas.height = window.innerHeight;
    snesIntroCanvas.style.position = "fixed";
    snesIntroCanvas.style.top = "0";
    snesIntroCanvas.style.left = "0";
    snesIntroCanvas.style.width = "100%";
    snesIntroCanvas.style.height = "100%";
    snesIntroCanvas.style.zIndex = "10001";
    snesIntroCanvas.style.pointerEvents = "none";
    snesIntroCanvas.style.opacity = "1";
    snesIntroCanvas.style.willChange = "opacity";
    snesIntroCanvas.style.filter = "blur(0.5px)"; // Slight blur for retro feel
    snesIntroCanvas.style.mixBlendMode = "screen"; // Additive blend for chromatic effect
    document.body.appendChild(snesIntroCanvas);
    const ctx = snesIntroCanvas.getContext("2d", { alpha: true });

    console.log("SNES intro canvas created!");

    // Camera pan parameters (intro camera pan upward effect)
    const cameraPanStartTime = 4.5; // Start panning at 1.5 seconds
    const cameraPanEndTime = 22.0; // Stop panning at 7 seconds
    const cameraPanDuration = cameraPanEndTime - cameraPanStartTime;
    const cameraPanDistance = 66; // Pixels to pan downward (stars move down = camera pans up)

    // Star data
    const stars = [];
    const starCount = 120;
    const colors = [
      "255, 255, 255",
      "255, 240, 200",
      "255, 220, 200",
      "240, 240, 255",
      "255, 200, 240",
      "220, 255, 240",
      "255, 255, 200",
    ];

    // Initialize stars
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * snesIntroCanvas.width,
        y: Math.random() * snesIntroCanvas.height,
        size: Math.random() * 1.2 + 0.3,
        opacity: Math.random() * 0.7 + 0.3,
        twinkleSpeed: Math.random() * 3 + 1,
        twinklePhase: Math.random() * Math.PI * 2,
        colorRGB: colors[Math.floor(Math.random() * colors.length)],
        hasColor: Math.random() < 0.6,
        isIntenseStar: Math.random() < 0.05,
        intenseTwinkleSpeed: Math.random() * 8 + 4,
        rotationSpeed: Math.random() * 4 + 2,
      });
    }

    // Add extra stars above the viewport for camera pan (1.5-7 seconds)
    // These will scroll down to fill the gap as camera pans upward
    for (let i = 0; i < starCount * 0.5; i++) {
      stars.push({
        x: Math.random() * snesIntroCanvas.width,
        y: -cameraPanDistance - Math.random() * 100, // Start above viewport
        size: Math.random() * 1.2 + 0.3,
        opacity: Math.random() * 0.7 + 0.3,
        twinkleSpeed: Math.random() * 3 + 1,
        twinklePhase: Math.random() * Math.PI * 2,
        colorRGB: colors[Math.floor(Math.random() * colors.length)],
        hasColor: Math.random() < 0.6,
        isIntenseStar: Math.random() < 0.05,
        intenseTwinkleSpeed: Math.random() * 8 + 4,
        rotationSpeed: Math.random() * 4 + 2,
      });
    }

    console.log(`Created ${stars.length} SNES intro stars`);

    // Animation loop
    let frameCount = 0;
    let startTime = Date.now();
    let lastFrameTime = startTime;
    function animate() {
      frameCount++;
      // Use elapsed time for twinkling (always advances)
      const elapsedTime = (Date.now() - startTime) / 1000;
      // Use music time for fade out (0 before music, then counts up)
      const musicTime = SORSARI?.musicTime || 0;

      // Slow down animation to ~8 FPS for retro Nintendo feel
      const now = Date.now();
      if (now - lastFrameTime < 208) {
        // 208ms = ~4.8 FPS (60% slower)
        requestAnimationFrame(animate);
        return;
      }
      lastFrameTime = now;
      const fadeOutStart = 6;
      const fadeOutDuration = 24.95;
      const fadeOutEnd = fadeOutStart + fadeOutDuration;

      // // Debug log every 60 frames
      // if (frameCount % 60 === 0) {
      //   console.log(
      //     `SNES stars: elapsedTime=${elapsedTime.toFixed(
      //       1
      //     )}s, musicTime=${musicTime.toFixed(1)}s, stars.length=${stars.length}`
      //   );
      // }

      // Calculate camera pan offset (intro camera panning upward effect)
      let cameraPanOffsetY = 0;
      if (musicTime >= cameraPanStartTime && musicTime < cameraPanEndTime) {
        const panProgress =
          (musicTime - cameraPanStartTime) / cameraPanDuration;
        cameraPanOffsetY = panProgress * cameraPanDistance; // Stars move down as camera pans up
      } else if (musicTime >= cameraPanEndTime) {
        cameraPanOffsetY = cameraPanDistance; // Stay at final pan position
      }

      let opacity = 1.0;
      if (musicTime < fadeOutStart) {
        opacity = 1.0;
      } else if (musicTime >= fadeOutStart && musicTime < fadeOutEnd) {
        const fadeProgress = (musicTime - fadeOutStart) / fadeOutDuration;
        opacity = 1.0 - fadeProgress;
      } else if (musicTime >= fadeOutEnd) {
        opacity = 0;
      }

      if (opacity > 0) {
        ctx.clearRect(0, 0, snesIntroCanvas.width, snesIntroCanvas.height);
        snesIntroCanvas.style.opacity = opacity.toString();

        // Draw stars
        stars.forEach((star) => {
          const twinkleValue =
            Math.sin(elapsedTime * star.twinkleSpeed + star.twinklePhase) *
              0.5 +
            0.5;
          const finalOpacity = star.opacity * twinkleValue;
          const colorRGB = star.hasColor ? star.colorRGB : "255, 255, 255";

          // Minor chromatic aberration offset
          const chromaOffset = Math.sin(elapsedTime * 2) * 0.3;

          // Apply camera pan offset to Y position
          const starY = star.y + cameraPanOffsetY;

          if (star.isIntenseStar) {
            const intenseTwinkle =
              Math.sin(elapsedTime * star.intenseTwinkleSpeed) * 0.5 + 0.5;
            const intenseOpacity = star.opacity * intenseTwinkle;
            const rotation = elapsedTime * star.rotationSpeed;

            ctx.save();
            ctx.translate(star.x + chromaOffset, starY + chromaOffset);
            ctx.rotate(rotation);
            ctx.strokeStyle = `rgba(${colorRGB}, ${intenseOpacity})`;
            ctx.lineWidth = 1.5;

            const armLength = star.size * 3;
            ctx.beginPath();
            ctx.moveTo(-armLength, -armLength);
            ctx.lineTo(armLength, armLength);
            ctx.moveTo(armLength, -armLength);
            ctx.lineTo(-armLength, armLength);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(0, -armLength);
            ctx.lineTo(0, armLength);
            ctx.moveTo(-armLength, 0);
            ctx.lineTo(armLength, 0);
            ctx.stroke();

            ctx.restore();
          } else {
            // Draw with chromatic aberration (red, green, blue channels offset)
            const offset = chromaOffset;

            // Red channel
            ctx.fillStyle = `rgba(255, 0, 0, ${finalOpacity * 0.3})`;
            ctx.beginPath();
            ctx.arc(star.x + offset, starY + offset, star.size, 0, Math.PI * 2);
            ctx.fill();

            // Green channel
            ctx.fillStyle = `rgba(0, 255, 0, ${finalOpacity * 0.3})`;
            ctx.beginPath();
            ctx.arc(
              star.x - offset * 0.5,
              starY - offset * 0.5,
              star.size,
              0,
              Math.PI * 2
            );
            ctx.fill();

            // Blue channel
            ctx.fillStyle = `rgba(0, 0, 255, ${finalOpacity * 0.3})`;
            ctx.beginPath();
            ctx.arc(star.x - offset, starY - offset, star.size, 0, Math.PI * 2);
            ctx.fill();

            // White base
            ctx.fillStyle = `rgba(${colorRGB}, ${finalOpacity * 0.7})`;
            ctx.beginPath();
            ctx.arc(star.x, starY, star.size, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      } else {
        ctx.clearRect(0, 0, snesIntroCanvas.width, snesIntroCanvas.height);
        snesIntroCanvas.style.opacity = "0";
      }

      requestAnimationFrame(animate);
    }

    animate();

    // Handle window resize
    window.addEventListener("resize", () => {
      snesIntroCanvas.width = window.innerWidth;
      snesIntroCanvas.height = window.innerHeight;
    });
  }
})();
