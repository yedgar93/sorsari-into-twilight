# SORSARI - Into Twilight: Comprehensive Timeline Analysis

## Timeline Mechanics

### Continuous vs Discrete Advancement

**Continuous Advancement:**
The timeline operates on a frame-by-frame basis using `requestAnimationFrame` at 60fps (throttled to 30fps on mobile devices). The core time source is `SORSARI.musicTime`, which is synchronized with `audioElement.currentTime` to ensure perfect alignment with audio playback.

```javascript
// From script.js - Main animation loop
tick: function () {
  const frameStartTime = performance.now();
  const currentFpsScale = isMobile ? adaptiveFpsScale : CONFIG.fpsScale;
  const frameSkipInterval = Math.max(1, Math.round(1 / currentFpsScale));

  // Frame skipping for performance
  if (reducedFrameCounter % frameSkipInterval !== 0) {
    requestAnimationFrame(this.tick);
    return;
  }

  // Update logic runs at throttled rate
  if (reducedFrameCounter % updateFrameSkipInterval === 0) {
    this.update();
  }

  // Render logic for Three.js canvas
  if (reducedFrameCounter % trianglesFrameSkipInterval === 0) {
    this.render();
  }
}
```

All visual interpolations use mathematical easing functions for smooth transitions. The primary easing function is cubic ease-out:

```javascript
const easedProgress = 1 - Math.pow(1 - progress, 3);
```

Audio-reactive effects continuously sample frequency data from Web Audio API analyzers, processing bass levels, drum tracks, and instrument levels in real-time.

**Discrete Events:**
Critical state changes occur at exact millisecond timestamps. These are hardcoded constants that trigger immediate state transitions:

```javascript
// From script.js - Key timing constants
const firstDropTime = 31.5;
const secondDropTime = 127.03;
const invertBackTime = 160.06;
const parallaxKillTime = 190;
const bloomKillTime = 190;
```

Process termination is handled by setting flags that cause animation loops to exit:

```javascript
// From stars.js - Process termination
if (window.starsAnimationStopped) {
  console.log("[Stars] Animation stopped - song ended");
  return;
}
```

## Key Timestamps

### Pre-Intro (0:00 - 0:31)

**0:00 - Blinking Stars Render:**
- 80 stars spawn with sine-wave blink pattern: `Math.sin(time * blinkSpeed) * 0.5 + 0.5`
- Stars positioned randomly across canvas with slow movement
- Each star has individual blink phase offset for organic effect
- **Visual:** Subtle twinkling creates atmospheric depth, stars appear to breathe

**0:08 - UI Text Fade-In Begins:**
- Opacity transitions from 0 to 1 over 16 seconds using linear interpolation
- Text elements: "SORSARI", "Breaking The Surface", track title
- **Visual:** Text materializes from transparency, creating anticipation

**0:15.5 - Triangles Brightness Fade:**
- Three.js triangles transition from 0.3 to 1.0 brightness over 12 seconds
- Uses post-processing bloom effect that intensifies with brightness
- **Visual:** Geometric shapes emerge from darkness, adding structural interest

**0:20 - Blinking Stars Terminate:**
- Animation loop exits, canvas clears, memory freed
- **Visual:** Stars vanish completely, canvas becomes cleaner

**0:24 - UI Text Fully Visible:**
- All text reaches 100% opacity
- **Visual:** Complete title card visible, establishing the piece's identity

**0:27.4 - Triangles Full Brightness:**
- Brightness reaches 1.0, bloom effect at maximum for intro
- **Visual:** Triangles glow brightly, creating focal points

### First Drop (0:31 - 1:35)

**0:30.89 - Center Model 360° Spin:**
- Camera instantly removes orbit constraints
- Spin interpolates 360° over 1 second using cubic ease-out
- **Code:** `yaw = currentOscillationYaw + easedProgress * 360`
- **Visual:** Model rotates rapidly around Y-axis, disorienting the viewer

**0:31.5 - Drop Hits:**
- Screen shake activates: ±4px random offset every 1.5s cycle
- Model brightness fades from 0.1 to 1.0 over 0.9 seconds
- **Visual:** Sudden brightness increase creates impact, shake adds physicality

**0:31.85 - Stars Fast Downward Movement:**
- Velocity multiplies by 150x factor: `layerVy = -layer.speed * dropSpeedMultiplier`
- Trail effect enabled by not clearing canvas fully
- **Visual:** Stars streak downward like meteor shower, creating momentum

**0:31.96 - Triangles Abrupt Fade Back In:**
- Brightness jumps to 1.0 instantly
- **Visual:** Triangles snap back to full intensity, maintaining energy

**1:03 - Model Chromatic Aberration Fades Out:**
- Red/blue channel offset transitions from 10px to 0px over 1 second
- **Visual:** Color fringing disappears, model returns to normal

**1:04 - UI Glitch Effect Fades Out:**
- Drop-shadow filters remove over 1 second
- **Visual:** Text and images lose color distortion, stabilizing

**1:35 - Screen Shake Stops:**
- Transform resets to identity
- Stars begin 2-second deceleration phase
- **Visual:** Canvas stabilizes, energy begins to dissipate

### Breakdown (1:35 - 2:07)

**1:35.8 - Stars Deceleration:**
- Velocity interpolates from 150x to normal over 2 seconds
- Uses smoothstep easing: `decelEase = decelProgress * decelProgress * (3 - 2 * decelProgress)`
- **Visual:** Stars slow dramatically, creating relief after intensity

**1:37.8 - Stars Fade Out Begins:**
- Canvas opacity fades from 1.0 to 0.0 over 4 seconds
- **Visual:** Stars gradually disappear, creating breathing room

**2:07 - Stars Fade Complete:**
- Canvas becomes transparent
- **Visual:** Complete void, anticipation builds for second drop

### Second Drop (2:07 - 3:10)

**2:06.9 - Center Model 360° Spin:**
- Identical to first drop spin mechanics
- **Visual:** Familiar disorientation returns

**2:07 - Stars Fast Upward Movement:**
- Velocity reverses: `layerVy = layer.speed * dropSpeedMultiplier`
- Direction now upward, defying gravity
- **Visual:** Stars shoot upward like rockets, creating defiance

**2:08 - Invert Filter Applied:**
- CSS filter: `filter: invert(100%) hue-rotate(180deg)`
- Applied to entire three-container
- **Visual:** World inverts - black becomes white, colors reverse, creating surreal negative space

**2:40.06 - Invert Filter Removed:**
- Filter fades out instantly
- Camera begins upward pan and tilt
- **Visual:** Reality snaps back, camera starts slow upward movement

**3:10 - UI Glitch Effect Fade-Out:**
- Chromatic aberration reduces over 16 seconds
- **Visual:** Color distortions gradually disappear

### Final Section (3:10 - 4:00)

**3:10 - Stars Chromatic Aberration Fade-Out:**
- Sine-wave offset reduces to 0 over 16 seconds
- **Visual:** Color fringing disappears, stars normalize

**3:12 - Screen Shake Stops:**
- Final stabilization
- **Visual:** Complete stillness returns

**3:15 - Model Final Zoom-Out:**
- Scale interpolates from 1.0 to 0.0 over 20 seconds
- Opacity fades from 1.0 to 0.0 over 15 seconds
- **Visual:** Model shrinks into nothingness, dissolving away

**3:20 - Final Image Lazy-Load:**
- Album art loads asynchronously
- **Visual:** No immediate change, preparing for reveal

**3:26 - Stars Process Terminates:**
- Animation loop exits permanently
- **Visual:** Stars completely gone, canvas empty

**3:33 - Final Image Fade-In:**
- Opacity transitions 0 to 1 over 1.5 seconds
- Interactive tilt effects activate
- **Visual:** Album art emerges, becoming the sole focus

**3:35 - Center Model Invisible:**
- Opacity reaches 0, model fully dissolved
- **Visual:** Complete emptiness except for final image

**3:46.5 - Stars Fade Wrapper CSS Fade:**
- Additional CSS fade completes
- **Visual:** Any remaining star elements fully transparent

## Code-Level Timeline State Machine

### Core Architecture

The system uses a hierarchical animation architecture:

1. **Master RAF Loop** (`script.js`): 60fps coordinator
2. **Update Callbacks**: Throttled to 30fps, handles logic
3. **Render Callbacks**: Throttled per component, handles drawing
4. **Component Loops**: Individual `requestAnimationFrame` loops per visual layer

**Time Synchronization:**
```javascript
// Update loop syncs music time
if (audioReactive && audioElement && !audioElement.paused) {
  cameraTime += 1 / 30;
  SORSARI.musicTime = audioElement.currentTime;
}
```

**Performance Throttling:**
Mobile devices use adaptive FPS scaling based on frame time history:
```javascript
if (avgFrameTime > frameTimeThresholdHigh) {
  adaptiveFpsScale = Math.max(minFpsScale, adaptiveFpsScale * throttleDownFactor);
}
```

### Update Callback Structure

The main update function orchestrates all timeline logic:

```javascript
root.addUpdateCallback(function () {
  // Audio analysis (every frame or throttled)
  if (frameCount % audioAnalysisInterval === 0) {
    sendAudioDataToWorker();
  }

  // Parallax calculations with peak detection
  if (audioLevel > parallaxPeakLevel) {
    parallaxPeakLevel = audioLevel;
  } else {
    parallaxPeakLevel *= parallaxPeakDecay;
  }

  // Chromatic aberration during drops
  if (isInDrop) {
    const chromaticOffset = parallaxShift * 2.73 + 1.55;
    // Apply to multiple elements
  }

  // Camera zoom interpolations
  if (currentTime >= cameraZoomOutStart) {
    const zoomOutProgress = Math.min((currentTime - cameraZoomOutStart) / cameraZoomOutDuration, 1.0);
    cameraZoomOutOffset = zoomOutProgress * cameraZoomOutDistance;
  }
});
```

### Time-Based Interpolation System

All continuous effects use normalized progress calculations:

```javascript
function interpolate(currentTime, startTime, endTime, startValue, endValue, easing = 'cubic') {
  const progress = Math.min((currentTime - startTime) / (endTime - startTime), 1.0);

  let easedProgress;
  switch(easing) {
    case 'cubic':
      easedProgress = 1 - Math.pow(1 - progress, 3);
      break;
    case 'smoothstep':
      easedProgress = progress * progress * (3 - 2 * progress);
      break;
    case 'linear':
    default:
      easedProgress = progress;
  }

  return startValue + (endValue - startValue) * easedProgress;
}
```

### Component-Specific Timeline Logic

#### Stars Canvas (`stars.js`)

**Layer System:**
Three parallax layers with different speeds and blur:
```javascript
const starLayers = [
  { count: 50, speed: 0.0125, blur: 0.0, scale: 0.7 }, // Sharp foreground
  { count: 35, speed: 0.0215, blur: 2.0, scale: 0.85 }, // Blurred midground
  { count: 20, speed: 0.0313, blur: 0.0, scale: 1.0 }  // Sharp background
];
```

**Movement State Machine:**
```javascript
let timingState = "normal";
if (currentTime >= firstDropTime && currentTime < breakdownTime) {
  timingState = "firstDrop";
} else if (currentTime >= breakdownTime && currentTime < breakdownTime + decelerationDuration) {
  timingState = "deceleration";
} else if (currentTime >= secondDropTime && currentTime < invertBackTime) {
  timingState = "secondDrop";
}
```

**Chromatic Aberration Rendering:**
```javascript
// Throttled to 15fps for performance
if (shouldRenderChromatic) {
  // Red channel offset
  starsCtx.fillStyle = `rgba(255, 0, 0, ${layer.opacity * 0.4})`;
  starsCtx.beginPath();
  normalStars.forEach(star => {
    const x = Math.floor(star.x + chromaticOffset);
    starsCtx.arc(x, star.y, layer.size * depthScale, 0, Math.PI * 2);
  });
  starsCtx.fill();
}
```

**Performance Optimizations:**
- Typed arrays for position/velocity data
- Batched rendering with single `beginPath`
- Frame skipping during heavy periods
- Process termination at 127s

#### Three.js Triangles (`script.js`)

**Brightness Animation:**
Multi-stage brightness curve with abrupt changes:
```javascript
let brightness = 0.3; // Base level

if (currentTime >= trianglesEndTime) {
  brightness = 1.0; // Full brightness
}

if (currentTime >= trianglesFadeInTime) {
  brightness = 1.0; // Abrupt fade back in
}
```

**Bloom Effect:**
Audio-reactive intensity based on bass analysis:
```javascript
const bassLevel = drumsDataArray.slice(0, 8).reduce((a, b) => a + b, 0) / (8 * 255);
const bloomIntensity = (bassLevel - 0.5) * 2.0;
composer.passes[1].strength = Math.max(0, bloomIntensity); // Bloom pass
```

#### Model Viewer (`model-animations.js`)

**Camera Oscillation:**
Smooth orbital movement with multiple frequency components:
```javascript
const oscillationYaw = Math.sin(currentTime * 0.3) * 20;
const oscillationPitch = 75 + Math.sin(currentTime * 0.2) * 15;
const oscillationDistance = 105 + Math.sin(currentTime * 0.25) * 20;
```

**Spin Mechanics:**
360° rotation with constraint removal and restoration:
```javascript
if (currentState === "spinning") {
  const spinProgress = (currentTime - activeSpinTime) / spinDuration;
  const easedProgress = 1 - Math.pow(1 - spinProgress, 3);
  yaw = currentOscillationYaw + easedProgress * 360;
}
```

**Zoom Interpolation:**
Complex multi-stage camera movement:
```javascript
// Intro zoom out
if (currentTime < introZoomDuration) {
  const introProgress = currentTime / introZoomDuration;
  const easedIntroProgress = introProgress < 0.5
    ? 2 * introProgress * introProgress
    : 1 - Math.pow(-2 * introProgress + 2, 2) / 2;
  root.camera.position.z = introZoomDistance + (preDropZoomDistance - introZoomDistance) * easedIntroProgress;
}
```

#### Audio Visualizer (`visualizer.js`)

**Waveform Rendering:**
Time-domain data visualization with dynamic line count:
```javascript
analyser.getByteTimeDomainData(dataArray);

const numLines = currentTime >= extraLinesTime && currentTime < backToNormalTime ? 3 : 1;
const offsets = numLines === 3 ? [-100, 0, 100] : [0];

offsets.forEach(offset => {
  visualizerCtx.beginPath();
  const sliceWidth = width / numPoints;
  let x = 0;

  for (let i = 0; i < numPoints; i++) {
    const v = dataArray[i * step] / 128.0;
    const y = v * height / 2 + offset;

    if (i === 0) {
      visualizerCtx.moveTo(x, y);
    } else {
      visualizerCtx.lineTo(x, y);
    }
    x += sliceWidth;
  }
  visualizerCtx.stroke();
});
```

**Opacity Fading:**
Precise time-based visibility control:
```javascript
if (currentTime < fadeInStart) {
  opacity = 0;
} else if (currentTime < fadeInEnd) {
  opacity = (currentTime - fadeInStart) / (fadeInEnd - fadeInStart);
} else if (currentTime < fadeOutStart) {
  opacity = 1;
} else if (currentTime < fadeOutEnd) {
  opacity = 1 - (currentTime - fadeOutStart) / (fadeOutEnd - fadeOutStart);
}
```

#### UI Elements (`script.js`)

**Parallax System:**
Audio-reactive element shifting with peak detection:
```javascript
const audioLevel = bassSum / (8 * 255);
if (audioLevel > parallaxPeakLevel) {
  parallaxPeakLevel = audioLevel;
} else {
  parallaxPeakLevel *= parallaxPeakDecay;
}

const parallaxShift = parallaxPeakLevel * parallaxMaxShift * parallaxSensitivity;
```

**Glitch Effects:**
Chromatic aberration with ghost mirror effects:
```javascript
const applyGlitchEffect = (element, key) => {
  // Random ghost effect triggering
  if (!ghost.active && Math.random() < ghostMirrorChance) {
    ghost.active = true;
    ghost.endTime = currentTime + ghostMirrorDuration;
    ghost.effectType = Math.floor(Math.random() * 3);
  }

  // Build complex filter string
  const filter = `drop-shadow(${chromaticOffset * dir}px ${yOffset}px 0px rgba(255, 0, 0, ${redOpacity})) drop-shadow(${ -chromaticOffset * dir}px ${-yOffset}px 0px rgba(0, 0, 255, ${blueOpacity}))`;
  element.style.filter = filter;
};
```

### Performance Optimizations

**Process Killing:**
Components self-terminate when no longer needed:
```javascript
// Stars killed at 127s
if (currentTime >= fadeOutEndTime) {
  window.starsAnimationStopped = true;
  return;
}
```

**Adaptive Throttling:**
Frame rate scales based on performance:
```javascript
const avgFrameTime = frameTimeHistory.reduce((a, b) => a + b, 0) / frameTimeHistorySize;
if (avgFrameTime > frameTimeThresholdHigh) {
  adaptiveFpsScale *= throttleDownFactor;
}
```

**Batched DOM Updates:**
Multiple style changes collected and applied together:
```javascript
function batchDOMUpdate(elementId, transform) {
  // Queue updates, apply on next frame
}
```

**Memory Management:**
- Typed arrays for performance-critical data
- Texture caching for repeated elements
- Event listener cleanup on termination

## Visual Experience Throughout the Song

### 0:00 - 0:31 (Intro - Building Tension)

**Frame-by-Frame Evolution:**
- **0:00-0:08:** Canvas starts empty. Blinking stars materialize one by one, each with unique blink timing. Sine waves create organic pulsing. User sees subtle starfield establishing cosmic scale.
- **0:08-0:15:** Stars zoom out smoothly, canvas expands from 2x to 1x scale. Blur dissipates from 2px to 0px. Triangles begin glowing faintly. UI text starts appearing letter by letter.
- **0:15-0:20:** Triangles reach half brightness, bloom effect becomes noticeable. Stars continue zooming, creating depth perception. Text becomes more solid.
- **0:20-0:24:** Blinking stars vanish completely, canvas feels cleaner. Triangles glow brighter. Text fully materializes.
- **0:24-0:31:** Model begins emerging from black, scaling from microscopic to full size. Camera oscillates gently. Triangles reach full luminescence.

**User Perception:** Atmospheric emergence from void. Stars provide cosmic context, triangles add geometric structure, model appears as a mysterious artifact. Tension builds through gradual revelation, each element adding layers of visual interest.

### 0:31 - 1:35 (First Drop - High Energy)

**Frame-by-Frame Evolution:**
- **0:31:** Model suddenly spins 360°, camera unlocks. Brightness explodes. Screen begins shaking erratically.
- **0:31-0:32:** Stars accelerate downward at blinding speed, leaving trails. Chromatic aberration fringes model in red/blue. UI elements develop color ghosts.
- **0:32-1:03:** Model zooms closer, filling more screen space. Stars maintain hyperspeed. Glitch effects intensify with audio peaks.
- **1:03-1:04:** Chromatic effects fade instantly. Glitch distortions disappear. Energy maintains but visual chaos reduces.
- **1:04-1:35:** Stars decelerate smoothly over 2 seconds. Screen shake stops. Model begins zooming back out.

**User Perception:** Overwhelming sensory assault. The spin creates vertigo, downward star movement suggests falling through space, shake adds physical impact. Chromatic aberration makes everything feel digitally unstable. Peak intensity creates disorientation and excitement.

### 1:35 - 2:07 (Breakdown - Decompression)

**Frame-by-Frame Evolution:**
- **1:35-1:38:** Stars slow dramatically, trails fade. Screen stabilizes completely. Chromatic effects vanish.
- **1:38-2:07:** Stars fade to transparency over 4 seconds. Model zooms back to normal distance. Camera begins free orbital movement.

**User Perception:** Emotional release after intensity. Star deceleration provides relief, fade creates breathing room. Camera movement adds exploration and freedom. Breakdown feels like emerging from chaos into clarity.

### 2:07 - 3:10 (Second Drop - Peak Intensity)

**Frame-by-Frame Evolution:**
- **2:07-2:08:** Model spins again. Stars reverse direction, shooting upward. Screen shake returns. Invert filter applies instantly - world becomes negative.
- **2:08-2:40:** Everything appears in inverted colors, creating surreal negative space. Stars maintain upward velocity. Chromatic aberration rotates with stars.
- **2:40-3:10:** Invert filter removes, reality snaps back. Camera begins slow upward pan. Glitch effects fade gradually.

**User Perception:** Maximum surrealism. Invert filter creates psychological displacement, upward stars defy physics, rotation adds dizziness. Second drop feels even more intense than the first due to accumulated experience.

### 3:10 - 3:35 (Final Fade - Resolution)

**Frame-by-Frame Evolution:**
- **3:10-3:12:** Stars lose chromatic aberration. Screen shake ends. Model begins final zoom-out.
- **3:12-3:20:** Model shrinks steadily. Stars fade further. Final image loads in background.
- **3:20-3:33:** Model becomes tiny, then vanishes. Stars disappear completely.
- **3:33-3:35:** Album art fades in, becoming interactive.

**User Perception:** Gradual dissolution into nothingness. Model's disappearance feels like ascension or evaporation. Album art provides closure, interactive elements allow final engagement.

### 3:35 - 4:00 (Outro - Reflection)

**Frame-by-Frame Evolution:**
- **3:35-3:38:** Only album art visible, slowly becoming opaque. Camera maintains subtle movement.
- **3:38-4:00:** Static contemplation. Replay button appears after 3 seconds.

**User Perception:** Peaceful resolution. Album art serves as visual anchor, preventing complete emptiness. Subtle camera movement maintains life without distraction. Experience concludes on a contemplative note.

## Detailed Stars Rendering and Canvas Architecture

### Canvas Layering System

The visual experience uses a complex multi-layer canvas and DOM element stack, carefully orchestrated with z-index values and CSS transforms:

**Background Layer (z-index: 0-1):**
- `#stars-canvas` (z-index: 0, opacity: 0.65) - Main starfield rendered with 2D Canvas API
- `#three-container` (z-index: auto, filter: blur(2px), opacity: 0.64) - Three.js WebGL canvas with depth-of-field blur

**Midground Layer (z-index: 5):**
- `#visualizer-canvas` (z-index: 5, opacity: 0.8) - Audio waveform oscilloscope

**Model Layer (z-index: 10002):**
- `#model-viewer` (z-index: 10) - WebGL 3D model with camera controls

**UI Overlay (z-index: 10005-10006):**
- Image elements with parallax transforms
- CRT scanline overlay with `mix-blend-mode: multiply`
- Radial glow overlay with `mix-blend-mode: screen`

### Stars Rendering Pipeline

#### Multi-Layer Starfield Architecture

The starfield consists of **4 distinct layers**, each with unique movement patterns and rendering characteristics:

**Main Star Layers (3 layers):**
```javascript
const starLayers = [
  { count: 50, speed: 0.0125, size: 0.5, opacity: 0.3, blur: 0.0, scale: 0.7 }, // Far layer
  { count: 35, speed: 0.0215, size: 0.75, opacity: 0.5, blur: 2.0, scale: 0.85 }, // Mid layer  
  { count: 20, speed: 0.0313, size: 1.0, opacity: 0.8, blur: 0.0, scale: 1.0 }   // Close layer
];
```

**Special Effect Layers:**
- **Hyperspace Layer:** 40 stars flying toward camera (15-27s)
- **Reverse Direction Layer:** 40 stars flying away (63.76-127s)

#### Star Data Structure and Memory Layout

Each star is stored efficiently using typed arrays for GPU-friendly access:

```javascript
// Float32Array layout: [x, y, vx, vy] per star
const positions = new Float32Array(starCount * 4);
const pulseData = new Float32Array(starCount * 2); // [pulseAmount, pulseDecay]

// Access pattern:
const baseIndex = starIndex * 4;
positions[baseIndex] = x;        // Current X position
positions[baseIndex + 1] = y;    // Current Y position  
positions[baseIndex + 2] = vx;   // Velocity X
positions[baseIndex + 3] = vy;   // Velocity Y
```

#### Star Movement Algorithms

**Normal Parallax Movement:**
```javascript
// Update all stars in batch
for (let i = 0; i < starCount; i++) {
  const baseIndex = i * 4;
  
  // Apply velocity
  positions[baseIndex] += positions[baseIndex + 2];     // x += vx
  positions[baseIndex + 1] += positions[baseIndex + 3]; // y += vy
  
  // Screen wrapping
  if (positions[baseIndex] < 0) positions[baseIndex] = canvasWidth;
  else if (positions[baseIndex] > canvasWidth) positions[baseIndex] = 0;
  
  if (positions[baseIndex + 1] < 0) positions[baseIndex + 1] = canvasHeight;
  else if (positions[baseIndex + 1] > canvasHeight) positions[baseIndex] = 0;
}
```

**Drop Hyperspeed Movement:**
```javascript
const dropSpeedMultiplier = 150;

if (timingState === "firstDrop") {
  layerVy = -layer.speed * dropSpeedMultiplier; // Downward at 150x speed
} else if (timingState === "secondDrop") {
  layerVy = layer.speed * dropSpeedMultiplier;  // Upward at 150x speed
}
```

**Breakdown Deceleration:**
```javascript
if (timingState === "deceleration") {
  const decelProgress = (currentTime - breakdownTime) / decelerationDuration;
  const decelEase = decelProgress * decelProgress * (3 - 2 * decelProgress); // Smoothstep
  
  const hyperspeedVy = -layer.speed * dropSpeedMultiplier;
  layerVy = hyperspeedVy + (layer.speed - hyperspeedVy) * decelEase;
}
```

#### Chromatic Aberration Implementation

**Color Channel Separation Rendering:**
```javascript
function drawStarWithChromatic(x, y, size, opacity, offsetAmount) {
  if (offsetAmount === 0) {
    // Normal white star
    starsCtx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
    starsCtx.beginPath();
    starsCtx.arc(x, y, size, 0, Math.PI * 2);
    starsCtx.fill();
    return;
  }

  // Split into RGB channels with offset
  const offset = offsetAmount;
  
  // Red channel (shifted right)
  starsCtx.fillStyle = `rgba(255, 0, 0, ${opacity * 0.4})`;
  starsCtx.beginPath();
  starsCtx.arc(x + offset, y, size, 0, Math.PI * 2);
  starsCtx.fill();
  
  // Green channel (no shift)
  starsCtx.fillStyle = `rgba(0, 255, 0, ${opacity * 0.4})`;
  starsCtx.beginPath();
  starsCtx.arc(x, y, size, 0, Math.PI * 2);
  starsCtx.fill();
  
  // Blue channel (shifted left)
  starsCtx.fillStyle = `rgba(0, 0, 255, ${opacity * 0.4})`;
  starsCtx.beginPath();
  starsCtx.arc(x - offset, y, size, 0, Math.PI * 2);
  starsCtx.fill();
}
```

**Aberration Waveform:**
```javascript
const rotationProgress = (currentTime - chromaticAberrationStartTime) / 
                        (zoomInEndTime - chromaticAberrationStartTime);
const chromaticOffset = Math.sin(rotationProgress * Math.PI * 2) * 
                       chromaticAberrationMaxOffset * chromaticAberrationIntensity;
```

#### Trail Effects During Drops

**Motion Blur Implementation:**
```javascript
if (isDropActive) {
  // Don't clear canvas fully - creates trail effect
  starsCtx.fillStyle = "rgba(1, 3, 19, 0.15)"; // Semi-transparent black
  starsCtx.fillRect(0, 0, canvasWidth, canvasHeight);
  
  // Draw trails instead of dots
  starsCtx.strokeStyle = `rgba(255, 255, 255, ${layer.opacity})`;
  starsCtx.lineWidth = layer.size * depthScale * 1.5;
  starsCtx.beginPath();
  
  stars.forEach(star => {
    const x = Math.floor(star.x);
    const y = Math.floor(star.y);
    const trailX = Math.floor(star.x - star.vx * 8); // 8-frame trail length
    const trailY = Math.floor(star.y - star.vy * 8);
    
    starsCtx.moveTo(x, y);
    starsCtx.lineTo(trailX, trailY);
  });
  
  starsCtx.stroke();
}
```

#### Hyperspace 3D Perspective

**Perspective Projection Math:**
```javascript
// Move star toward camera (Z decreases)
positions[baseIndex + 2] -= hyperspaceLayer.speed;

// Perspective scaling
const scale = positions[baseIndex + 2]; // Z becomes scale factor (0.1 to 1.0)
const screenX = canvasWidth/2 + positions[baseIndex] * scale;
const screenY = canvasHeight/2 + positions[baseIndex + 1] * scale;

// Size decreases as star approaches (depth cue)
const size = 2.5 - (1 - positions[baseIndex + 2]) * 2; // 2.5px to 0.5px

// Opacity increases with depth
const starDepthOpacity = 0.3 + (1 - positions[baseIndex + 2]) * 0.5;
```

### Three.js Canvas Rendering

The Three.js canvas provides the core geometric background that underlies the entire visual experience. Unlike the 2D starfield canvas, this WebGL-powered layer renders complex 3D triangle geometries that create an abstract, ever-evolving backdrop.

#### Core Scene Architecture

**Scene Setup:**
```javascript
// Three.js scene initialization
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ 
  antialias: true, 
  alpha: true,
  powerPreference: "high-performance"
});

// Camera positioning for isometric-like view
camera.position.set(0, 0, 5);
camera.lookAt(0, 0, 0);
```

**Triangle Geometry Generation:**
The canvas displays a dynamic mesh of triangles that continuously morph and regenerate. The system maintains approximately 200-300 triangles at any given time, each with unique properties:

```javascript
class Triangle {
  constructor() {
    // Random initial position within view frustum
    this.position = new THREE.Vector3(
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 10
    );
    
    // Random velocity for continuous movement
    this.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.02,
      (Math.random() - 0.5) * 0.02,
      (Math.random() - 0.5) * 0.01
    );
    
    // Triangle geometry with random size variation
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      -0.5 + Math.random() * 0.2, -0.5 + Math.random() * 0.2, 0,
       0.5 + Math.random() * 0.2, -0.5 + Math.random() * 0.2, 0,
       0.0 + Math.random() * 0.2,  0.5 + Math.random() * 0.2, 0
    ]);
    
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    
    // Material with emissive properties for glow effect
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(Math.random(), 0.7, 0.5),
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    scene.add(this.mesh);
  }
}
```

#### Triangle Lifecycle Management

**Continuous Regeneration:**
Triangles follow a complete lifecycle from creation to destruction, maintaining visual density:

```javascript
function updateTriangles() {
  triangles.forEach((triangle, index) => {
    // Update position
    triangle.mesh.position.add(triangle.velocity);
    
    // Boundary checking and wrapping
    if (triangle.mesh.position.x > 15) triangle.mesh.position.x = -15;
    if (triangle.mesh.position.x < -15) triangle.mesh.position.x = 15;
    if (triangle.mesh.position.y > 15) triangle.mesh.position.y = -15;
    if (triangle.mesh.position.y < -15) triangle.mesh.position.y = 15;
    
    // Age-based opacity fade
    const age = (Date.now() - triangle.birthTime) / triangle.lifespan;
    triangle.mesh.material.opacity = Math.max(0, 0.6 * (1 - age));
    
    // Remove dead triangles
    if (age >= 1.0) {
      scene.remove(triangle.mesh);
      triangles.splice(index, 1);
    }
  });
  
  // Maintain triangle count
  while (triangles.length < targetTriangleCount) {
    triangles.push(new Triangle());
  }
}
```

**Color Evolution:**
Triangle colors continuously shift through the HSL color space, creating organic color transitions:

```javascript
function updateTriangleColors() {
  const time = Date.now() * 0.001; // Convert to seconds
  
  triangles.forEach(triangle => {
    // Hue cycles every 60 seconds
    const hue = (time * 0.0167 + triangle.hueOffset) % 1.0;
    
    // Saturation and lightness vary with audio
    const saturation = 0.5 + audioLevel * 0.3;
    const lightness = 0.4 + bassLevel * 0.2;
    
    triangle.mesh.material.color.setHSL(hue, saturation, lightness);
  });
}
```

#### Depth-of-Field Blur Effect

The Three.js canvas has a persistent CSS blur filter applied that creates depth-of-field simulation:

```css
#three-container {
  filter: blur(2px);
  opacity: 0.64;
  z-index: auto;
}
```

This blur serves multiple purposes:
- **Depth Simulation:** Creates perceived depth by softening distant elements
- **Performance Optimization:** Reduces visual complexity of background layer
- **Atmospheric Effect:** Adds ethereal quality to geometric forms
- **Layer Integration:** Allows starfield and other elements to appear "in front" of blurred geometry

#### Audio-Reactive Triangle Behavior

**Bass-Driven Scaling:**
```javascript
function applyAudioReactivity() {
  const bassLevel = getBassLevel();
  
  triangles.forEach(triangle => {
    // Scale triangles with bass intensity
    const scaleMultiplier = 1.0 + bassLevel * 0.5;
    triangle.mesh.scale.setScalar(scaleMultiplier);
    
    // Add subtle rotation during intense bass
    if (bassLevel > 0.7) {
      triangle.mesh.rotation.z += bassLevel * 0.01;
    }
  });
}
```

**Frequency-Based Movement:**
Different frequency ranges influence triangle movement patterns:
- **Low Frequencies (20-200Hz):** Cause triangles to cluster and pulse
- **Mid Frequencies (200-2000Hz):** Create swirling motion patterns  
- **High Frequencies (2000Hz+):** Add jitter and sparkle effects

#### Rendering Integration

The Three.js canvas renders at a throttled frame rate (typically 30fps on desktop, lower on mobile) to maintain performance while providing smooth geometric animation:

```javascript
function render() {
  // Update triangle positions and properties
  updateTriangles();
  updateTriangleColors();
  applyAudioReactivity();
  
  // Render scene through post-processing pipeline
  composer.render();
}
```

This creates a living, breathing geometric backdrop that responds to the music while providing visual depth and complexity beneath the starfield and UI elements.

### Three.js Post-Processing Effects

#### Effect Composer Pipeline

**Render Pass Chain:**
```javascript
const composer = new THREE.EffectComposer(renderer);

// 1. Render scene to texture
composer.addPass(new THREE.RenderPass(scene, camera));

// 2. Apply bloom effect
const bloomPass = new THREE.UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.5,  // strength
  0.4,  // radius  
  0.85  // threshold
);
composer.addPass(bloomPass);

// 3. Apply radial blur
composer.addPass(radialBlurPass);

// 4. Output to screen
composer.addPass(new THREE.ShaderPass(THREE.CopyShader));
```

**Audio-Reactive Bloom:**
```javascript
// Analyze bass frequencies
const bassLevel = drumsDataArray.slice(0, 8).reduce((a, b) => a + b) / (8 * 255);
const bloomIntensity = Math.max(0, (bassLevel - 0.5) * 2.0);

composer.passes[1].strength = bloomIntensity;
```

#### Radial Blur Shader (GLSL)

**Vertex Shader:**
```glsl
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

**Fragment Shader:**
```glsl
uniform sampler2D tDiffuse;
uniform vec2 resolution;
uniform float strength;
uniform int samples;
varying vec2 vUv;

void main() {
  vec2 center = vec2(0.5, 0.5);
  vec2 uv = vUv;
  vec2 dir = uv - center;
  float dist = length(dir);
  dir = normalize(dir);
  
  vec4 color = texture2D(tDiffuse, uv);
  vec4 sum = color;
  
  float blurAmount = strength * dist;
  
  for(int i = 1; i < 16; i++) {
    if(i >= samples) break;
    float scale = 1.0 - blurAmount * (float(i) / float(samples));
    sum += texture2D(tDiffuse, center + dir * dist * scale);
  }
  
  sum /= float(samples);
  gl_FragColor = sum;
}
```

### Screen Shake and Transform Effects

#### CSS Transform-Based Shake

**Shake Cycle Logic:**
```javascript
const shakeDuration = 1.5;    // 1.5 seconds shaking
const shakeDelayDuration = 0.5; // 0.5 seconds delay
const shakeIntensityStar = 1.5; // ±1.5px for stars

if (isInDrop && !skipShakeDuringCameraPan) {
  const timeSinceDropStart = currentTime - dropTime;
  const cycleTime = timeSinceDropStart % (shakeDuration + shakeDelayDuration);
  
  if (cycleTime < shakeDuration) {
    // Apply random shake during shake phase
    const shakeOffsetX = (Math.random() - 0.5) * shakeIntensityStar;
    const shakeOffsetY = (Math.random() - 0.5) * shakeIntensityStar;
    
    starsCanvas.style.transform = `translate3d(${shakeOffsetX}px, ${shakeOffsetY}px, 0) 
                                   scale(${zoomScale}) rotate(${rotationDegrees}deg)`;
  } else {
    // Reset during delay phase
    starsCanvas.style.transform = `translate3d(0, 0, 0) scale(${zoomScale}) 
                                   rotate(${rotationDegrees}deg)`;
  }
}
```

#### Canvas Zoom and Rotation

**Zoom Interpolation:**
```javascript
// Initial zoom out (0-20s)
let zoomScale = 1.0;
if (currentTime < zoomOutEnd) {
  const zoomProgress = currentTime / zoomOutDuration;
  zoomScale = zoomStartScale - (zoomStartScale - 1.0) * zoomProgress;
}

// Dramatic zoom in (160-240s)
if (currentTime >= zoomInStartTime) {
  const fastProgress = (currentTime - zoomInStartTime) / (zoomSlowdownTime - zoomInStartTime);
  zoomInAmount = 1.0 + Math.pow(fastProgress, 0.5) * 4.0; // Up to 5x zoom
  zoomScale = zoomInAmount;
}
```

**Rotation Animation:**
```javascript
let rotationDegrees = 0;
if (currentTime >= zoomInStartTime) {
  const rotationProgress = (currentTime - zoomInStartTime) / (zoomInEndTime - zoomInStartTime);
  rotationDegrees = rotationProgress * 1440; // 4 full rotations
}
```

### CSS Filter Effects System

#### Global Invert Filter

**Application Timing:**
```javascript
const invertStart = 127.0;  // 2:07
const invertEnd = 160.06;   // 2:40:06

if (currentTime >= invertStart && currentTime < invertEnd && !invertFilterApplied) {
  threeContainer.style.filter = "invert(100%) hue-rotate(180deg)";
  invertFilterApplied = true;
} else if (currentTime >= invertEnd && !invertFilterRemoved) {
  threeContainer.style.filter = "none";
  invertFilterRemoved = true;
}
```

#### Chromatic Aberration on DOM Elements

**Drop-Shadow Technique:**
```javascript
const chromaticOffset = parallaxShift * 2.73 + 1.55;
const redOpacity = 0.26 * glitchOpacity;
const blueOpacity = 0.34 * glitchOpacity;

const filter = `drop-shadow(${chromaticOffset * dir}px ${yOffset}px 0px rgba(255, 0, 0, ${redOpacity}))
                drop-shadow(${-chromaticOffset * dir}px ${-yOffset}px 0px rgba(0, 0, 255, ${blueOpacity}))`;

element.style.filter = filter;
```

### CRT Display Effects

#### Scanline Overlay (CSS-Only)

**Multi-Layer Background Pattern:**
```css
body::before {
  background-image:
    /* Horizontal scanlines */
    repeating-linear-gradient(
      0deg,
      rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.3) 2px,
      transparent 2px, transparent 12px
    ),
    /* Vertical scanlines */
    repeating-linear-gradient(
      90deg,
      rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.3) 2px,
      transparent 2px, transparent 12px
    ),
    /* Radial glow */
    radial-gradient(
      circle at 20% 50%,
      rgba(255, 255, 255, 0.005),
      transparent 50%
    );
  
  background-size: 3.1495px 3.1495px, 3.1495px 3.1495px, 100% 100%;
  mix-blend-mode: multiply;
  opacity: 0.55;
}
```

#### Phosphor Glow Effect

**Screen Blend Mode:**
```css
body::after {
  background: radial-gradient(
    ellipse at center,
    rgba(255, 255, 255, 0.05) 0%,
    rgba(0, 0, 0, 0.1) 100%
  );
  mix-blend-mode: screen;
  filter: blur(2.5px);
  opacity: 0;
}

body.glow-active::after {
  animation: glowFadeIn 18s ease-in forwards;
}
```

### Performance Optimization Architecture

#### Adaptive Frame Rate Scaling

**Mobile Performance Management:**
```javascript
const frameTimeHistorySize = 10;
let frameTimeHistory = [];

function monitorFrameTime(frameTime) {
  frameTimeHistory.push(frameTime);
  if (frameTimeHistory.length > frameTimeHistorySize) {
    frameTimeHistory.shift();
  }
  
  if (frameTimeHistory.length === frameTimeHistorySize) {
    const avgFrameTime = frameTimeHistory.reduce((a, b) => a + b) / frameTimeHistorySize;
    
    if (avgFrameTime > frameTimeThresholdHigh) {
      adaptiveFpsScale = Math.max(minFpsScale, adaptiveFpsScale * throttleDownFactor);
    } else if (avgFrameTime < frameTimeThresholdLow) {
      adaptiveFpsScale = Math.min(maxFpsScale, adaptiveFpsScale * throttleUpFactor);
    }
  }
}
```

#### Component-Specific Throttling

**Stars Rendering (30fps):**
```javascript
const starsRenderInterval = 2; // Every 2nd frame
if (starsFrameCount - lastStarsRender >= starsRenderInterval) {
  // Render stars
  lastStarsRender = starsFrameCount;
}
```

**Camera Updates (20fps):**
```javascript
const cameraPanUpdateInterval = 3; // Every 3rd frame
if (starsFrameCount - lastCameraPanUpdate >= cameraPanUpdateInterval) {
  // Update camera position
}
```

#### Memory Management

**Typed Array Usage:**
- All star positions/velocities use `Float32Array` for fast batch operations
- Hyperspace layers use `Float32Array` for 3D coordinates
- Audio analysis uses `Uint8Array` for frequency data

**Process Termination:**
```javascript
// Stars killed at 127s
if (currentTime >= fadeOutEndTime) {
  window.starsAnimationStopped = true;
  return; // Exit animation loop
}
```

**Batched DOM Updates:**
```javascript
function batchDOMUpdate(elementId, transform) {
  // Queue updates for next frame to prevent layout thrashing
  queuedUpdates[elementId] = transform;
}

// Apply all queued updates in one batch
requestAnimationFrame(() => {
  Object.entries(queuedUpdates).forEach(([id, transform]) => {
    document.getElementById(id).style.transform = transform;
  });
  queuedUpdates = {};
});
```

This detailed rendering architecture creates the immersive visual experience through carefully orchestrated canvas layers, GPU-accelerated effects, and performance-optimized rendering pipelines.</content>
<parameter name="filePath">/Users/jonathanyedgarova/Documents/GitHub/sorsari-into-twilight/Timeline.md