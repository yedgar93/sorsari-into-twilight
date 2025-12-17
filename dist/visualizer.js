/// <reference path="./types.d.ts" />

// Audio Visualizer - Oscilloscope style waveform (Performance Optimized)
(function () {
  const visualizerCanvas = document.getElementById("visualizer-canvas");
  if (!visualizerCanvas) return;

  // Optimize context for performance
  const visualizerCtx = visualizerCanvas.getContext("2d", {
    willReadFrequently: false,
    alpha: true,
  });

  // Use centralized mobile detection from script.js
  const isMobile = window.SORSARI?.isMobile ?? false;

  // =====================
  // VISUALIZER TIMELINE
  // =====================
  // Single horizontal line during intro/verses
  // Multiple horizontal lines during breakdowns and drops
  // Full fade out at the very end
  
  // Timing constants (in seconds with music timestamps)
  const fadeInStart = 93; // 1:33 - Breakdown section begins (intro waveform)
  const fadeInEnd = 127; // 2:07 - Second drop (add 2 more lines)
  const extraLinesTime = 128; // 2:08 - Add 2 additional waveform lines (total 3)
  const backToNormalTime = 192; // 3:12 - Return to 1 horizontal line
  const fadeOutStart = 190; // 3:10 - Begin fade out
  const fadeOutEnd = 212; // 3:32 - Fully faded out

  // Canvas dimensions - always full screen
  let width, height, halfHeight;
  let lineWidth = isMobile ? 1 : 2;

  // Bitmap caching for performance
  let cachedBitmap = null;
  let lastCachedOpacity = 0;

  function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    halfHeight = height / 2;
    visualizerCanvas.width = width;
    visualizerCanvas.height = height;
    visualizerCtx.lineWidth = lineWidth;
    visualizerCtx.imageSmoothingEnabled = false;
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

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

    // Fewer points on mobile for speed
    const numPoints = isMobile ? 32 : 64;
    const step = Math.floor(bufferLength / numPoints);

    // Pre-calculate line offsets
    const singleLineOffsets = [0];
    const tripleLineOffsets = [0, -100, 100];

    // Cache for stroke style
    let lastOpacity = -1;
    let lastStrokeStyle = "";

    let visualizerFrameCount = 0;

    function visualize() {
      // Apply FPS limit if dither mode is active (30fps max)
      if (window.ditherMaxFps) {
        const now = performance.now();
        const frameTime = 1000 / window.ditherMaxFps; // ~33.33ms for 30fps
        if (!window.lastVisualizerFrameTime) {
          window.lastVisualizerFrameTime = now;
        }
        if (now - window.lastVisualizerFrameTime < frameTime) {
          requestAnimationFrame(visualize);
          return;
        }
        window.lastVisualizerFrameTime = now;
      }

      // FPS scaling - skip frames based on CONFIG.fpsScale from script.js
      const fpsScale = window.CONFIG?.fpsScale || 1.0;
      const frameSkipInterval = Math.max(1, Math.round(1 / fpsScale));
      visualizerFrameCount++;

      if (
        frameSkipInterval > 1 &&
        visualizerFrameCount % frameSkipInterval !== 0
      ) {
        requestAnimationFrame(visualize);
        return;
      }

      requestAnimationFrame(visualize);

      // Calculate opacity based on current time
      const currentTime = audioElement.currentTime;
      let opacity = 0;

      if (currentTime < fadeInStart) {
        opacity = 0;
      } else if (currentTime < fadeInEnd) {
        opacity = (currentTime - fadeInStart) / (fadeInEnd - fadeInStart);
      } else if (currentTime < fadeOutStart) {
        opacity = 1;
      } else if (currentTime < fadeOutEnd) {
        opacity =
          1 - (currentTime - fadeOutStart) / (fadeOutEnd - fadeOutStart);
      } else {
        opacity = 0;
      }

      // Skip drawing if invisible - clear and cache
      if (opacity <= 0) {
        visualizerCtx.clearRect(0, 0, width, height);
        cachedBitmap = null; // Clear cache when invisible
        return;
      }

      analyser.getByteTimeDomainData(dataArray);

      visualizerCtx.clearRect(0, 0, width, height);

      // Only update stroke style if opacity changed
      const newStrokeStyle = `rgba(236, 183, 221, ${opacity * 0.8})`;
      if (newStrokeStyle !== lastStrokeStyle) {
        visualizerCtx.strokeStyle = newStrokeStyle;
        lastStrokeStyle = newStrokeStyle;
      }

      // Vertical from 2:07 to 3:12, then back to horizontal
      const isVertical =
        currentTime >= fadeInEnd && currentTime < backToNormalTime;

      // Extra lines from 2:08 to 3:12
      const hasExtraLines =
        currentTime >= extraLinesTime && currentTime < backToNormalTime;
      const lineOffsets = hasExtraLines ? tripleLineOffsets : singleLineOffsets;

      // Pre-calculate dimensions
      const sliceHeight = height / numPoints;
      const sliceWidth = width / numPoints;
      const halfWidth = width / 2;

      for (let lineIndex = 0; lineIndex < lineOffsets.length; lineIndex++) {
        const offset = lineOffsets[lineIndex];
        visualizerCtx.beginPath();

        if (isVertical) {
          // Vertical mode: wave goes top to bottom
          let y = 0;

          for (let i = 0; i < bufferLength; i += step) {
            const v = dataArray[i] / 128.0;
            const x = v * halfWidth + offset;

            if (i === 0) {
              visualizerCtx.moveTo(x, y);
            } else {
              visualizerCtx.lineTo(x, y);
            }

            y += sliceHeight;
          }
        } else {
          // Horizontal mode: wave goes left to right
          let x = 0;

          for (let i = 0; i < bufferLength; i += step) {
            const v = dataArray[i] / 128.0;
            const y = v * halfHeight + offset;

            if (i === 0) {
              visualizerCtx.moveTo(x, y);
            } else {
              visualizerCtx.lineTo(x, y);
            }

            x += sliceWidth;
          }
        }

        visualizerCtx.stroke();

        // Cache bitmap if opacity changed (for faster redraws)
        if (opacity !== lastCachedOpacity) {
          lastCachedOpacity = opacity;
          // Use transferToImageBitmap for better performance if available
          if (visualizerCanvas.convertToBlob) {
            cachedBitmap = visualizerCanvas.transferToImageBitmap?.();
          }
        }
      }
    }

    visualize();
  }

  waitForAnalyser();
})();
