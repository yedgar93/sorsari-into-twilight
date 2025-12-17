/**
 * Circular Waveform Audio Visualizer
 * Waveform drawn as a smooth circular wave
 */

(function () {
  const canvas = document.getElementById("bar-visualizer");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", {
    willReadFrequently: false,
    alpha: true,
  });

  // Dithering pattern (Bayer matrix 4x4)
  const ditherPattern = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];

  // Set canvas to full screen
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // Apply dithering to reduce color banding and improve performance
  function applyDithering(imageData, ditherStrength = 0.5) {
    const data = imageData.data;
    const width = imageData.width;

    for (let i = 0; i < data.length; i += 4) {
      const pixelIndex = i / 4;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);

      // Get dither value from pattern
      const ditherValue =
        (ditherPattern[y % 4][x % 4] / 16 - 0.5) * ditherStrength;

      // Apply dithering to RGB channels
      data[i] = Math.max(0, Math.min(255, data[i] + ditherValue * 255)); // R
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + ditherValue * 255)); // G
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + ditherValue * 255)); // B
      // Keep alpha unchanged
    }
  }

  // Wait for audio to be ready
  function waitForAnalyser() {
    if (
      window.SORSARI &&
      window.SORSARI.analyser &&
      window.SORSARI.audioElement
    ) {
      startVisualization();
    } else {
      setTimeout(waitForAnalyser, 100);
    }
  }

  function startVisualization() {
    const analyser = window.SORSARI.analyser;
    const audioElement = window.SORSARI.audioElement;
    if (!analyser || !audioElement) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Use centralized mobile detection from script.js
    const isMobile = window.SORSARI?.isMobile ?? false;

    // Sample count for waveform
    const sampleCount = isMobile ? 32 : 64;

    console.log(
      "[Circular Waveform Visualizer] Started! Canvas:",
      canvas.width,
      "x",
      canvas.height,
      "| Samples:",
      sampleCount,
      "| Mobile:",
      isMobile
    );

    let frameCount = 0;

    function visualize() {
      // Apply FPS limit if dither mode is active (30fps max)
      if (window.ditherMaxFps) {
        const now = performance.now();
        const frameTime = 1000 / window.ditherMaxFps; // ~33.33ms for 30fps
        if (!window.lastBarVisualizerFrameTime) {
          window.lastBarVisualizerFrameTime = now;
        }
        if (now - window.lastBarVisualizerFrameTime < frameTime) {
          requestAnimationFrame(visualize);
          return;
        }
        window.lastBarVisualizerFrameTime = now;
      }

      // FPS scaling - skip frames based on CONFIG.fpsScale from script.js
      const fpsScale = window.CONFIG?.fpsScale || 1.0;
      const frameSkipInterval = Math.max(1, Math.round(1 / (4 * fpsScale)));
      frameCount++;

      if (frameSkipInterval > 1 && frameCount % frameSkipInterval !== 0) {
        requestAnimationFrame(visualize);
        return;
      }

      requestAnimationFrame(visualize);

      // Get frequency data
      analyser.getByteFrequencyData(dataArray);

      // Clear canvas (transparent)
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Circle parameters
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const baseRadius = 10;
      const waveAmplitude = 500;

      // Logarithmic scale: use 100Hz to 19kHz range
      const minFreqBin = Math.floor((bufferLength / 2) * (10500 / 18000)); // Start at 100Hz
      const maxFreqBin = Math.floor((bufferLength / 2) * (11000 / 18000)); // End at 19kHz
      const usableRange = maxFreqBin - minFreqBin;

      // Draw waveform circle with smooth interpolation
      ctx.strokeStyle = "rgba(149, 132, 149, 0.85)";
      ctx.lineWidth = 0.01;
      ctx.beginPath();

      const radii = [];
      for (let i = 0; i < sampleCount; i++) {
        // Get frequency data for this sample - average nearby bins for smoother response
        const logIndex = Math.pow(i / sampleCount, 2) * usableRange;
        const centerIndex = Math.floor(minFreqBin + logIndex);

        // Average 3 nearby bins for smoother, more uniform peaks
        let value = 0;
        const binRange = 5;
        for (let j = -binRange; j <= binRange; j++) {
          const idx = Math.max(0, Math.min(bufferLength - 1, centerIndex + j));
          value += dataArray[idx];
        }
        value = value / (binRange * 2 + 1) / 255; // Normalize to 0-1

        // Clamp value to max out at 1.0 (creates smooth circle at peaks)
        value = Math.min(1.0, value);

        // Calculate angle around circle
        const angle = (i / sampleCount) * Math.PI * 2;

        // Radius varies based on frequency
        const radius = baseRadius + value * waveAmplitude;
        radii.push({ angle, radius });

        // Calculate position
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      // Close the path to complete the circle
      ctx.closePath();
      ctx.stroke();

      // Draw filled waveform with subtle fill
      ctx.fillStyle = "rgba(151, 180, 216, 0.08)";
      ctx.fill();

      // Draw inner circle for reference
      ctx.strokeStyle = "rgba(58, 58, 58, 0.04)";
      ctx.lineWidth = 50;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Apply dithering for performance optimization (reduces color banding)
      // Only apply every 2 frames to reduce performance impact
      if (frameCount % 2 === 0) {
        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          applyDithering(imageData, 0.3); // Light dithering (0.3 strength)
          ctx.putImageData(imageData, 0, 0);
        } catch (e) {
          // Silently fail if dithering causes issues (e.g., cross-origin canvas)
        }
      }

      frameCount++;
      if (frameCount === 1) {
        console.log(
          "[Circular Waveform Visualizer] Started with dithering optimization"
        );
      }
    }

    visualize();
  }

  waitForAnalyser();
})();
