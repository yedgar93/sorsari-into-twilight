# Performance Tuning Guide

## Star Rendering Parameters

### Blinking Stars Layer (Pre-Intro)
- **Count**: 80 stars
- **Movement Speed**: 0.01 (very slow)
- **Blink Speed**: 1-3 Hz (random)
- **Size**: 0.5-2.0px (random)
- **Opacity**: 0.4-1.0 (random)
- **Fade Out**: 8s delay + 12s fade duration
- **Performance Impact**: LOW (killed at 0:20)

### Main Stars Canvas - 3 Layers
**Layer 1 (Far)**
- Count: 50 | Speed: 0.0125 | Size: 0.5px | Opacity: 0.3 | Blur: 0px

**Layer 2 (Mid)**
- Count: 35 | Speed: 0.0215 | Size: 0.75px | Opacity: 0.5 | Blur: 3.0px

**Layer 3 (Close)**
- Count: 20 | Speed: 0.0313 | Size: 1.0px | Opacity: 0.8 | Blur: 0px

**Total**: 105 stars rendered every frame

### Hyperspace Layer (Flying Towards Screen)
- **Count**: 40 stars
- **Speed**: 0.015 (towards camera)
- **Fade In**: 0:15 - 0:27 (12 seconds)
- **Max Opacity**: 0.85
- **Active**: 0:15 - 3:29.5

### Reverse Direction Layer (Upward Movement)
- **Count**: 40 stars
- **Speed**: 0.015 (upward)
- **Fade In**: 1:03.76 (instant)
- **Fade Out**: 2:07 (instant)
- **Active**: 1:03.76 - 2:07

---

## Chromatic Aberration Parameters

### Stars Canvas Chromatic Aberration
- **Max Offset**: 3px
- **Intensity**: 0.6
- **Active Periods**:
  - 1:04 - 1:35 (pulsing, 2 full cycles)
  - 2:40 - 3:26 (rotating effect)
- **Fade Out**: 3:10 - 3:26 (16 seconds)
- **Rendering**: Batched (3 draw calls per frame when active)

### Model Viewer Chromatic Aberration
- **Phase 1**: 0:31.85 - 1:03 (5px → 10px)
- **Phase 2**: 1:50 - 2:40 (5px → 10px)
- **Phase 2 Fade**: 2:40 - 2:54 (14 seconds)
- **Phase 3**: 3:12 - 4:00 (0px → 20px, exponential)

### UI Elements Chromatic Aberration (Glitch)
- **Opacity**: 0.44 (red) / 0.52 (blue)
- **Offset Multiplier**: 6x parallax shift + 2px base
- **Ghost Mirror Effect**: 0.3% chance per frame, 0.5s duration
- **Active Periods**:
  - 0:31 - 1:04
  - 2:07 - 3:10 (with fade out 2:54-3:10)

---

## Canvas & Rendering Parameters

### Stars Canvas Zoom
- **Start Scale**: 2.0x
- **Zoom Out**: 0:00 - 0:20 (20 seconds)
- **End Scale**: 1.0x

### Stars Canvas Blur
- **Start Blur**: 2.0px
- **Blur Out**: 0:04 - 0:24 (20 seconds)
- **End Blur**: 0px

### Triangles Canvas (Three.js)
- **Point Count**: 4000 (desktop) / 400 (mobile)
- **Brightness**: 0.3 → 1.0 (0:15.5 - 0:27.4)
- **Bloom Intensity**: (bass - 0.5) * 2.0 when bass > 0.5
- **Radial Blur**: 0.9 strength, 12 samples (desktop)

### Final Blur & Fade
- **Start**: 3:14.5
- **Duration**: 15 seconds
- **Max Blur**: 20px
- **Fade**: 1.0 → 0.0

---

## Audio Analysis Parameters

### Kick Detection
- **Threshold**: 0.68
- **Source**: Drums track
- **Effect**: Color flash (purple → pink)

### Bloom Trigger
- **Threshold**: 0.5
- **Source**: Main audio
- **Formula**: (bass - 0.5) * 2.0

### Star Pulse
- **Threshold**: Instruments level
- **Probability**: 0.000375 per frame
- **Decay**: 0.05 + random(0.05)

### Parallax Shift
- **Sensitivity**: 0.476
- **Max Shift**: ±3.275px
- **Peak Decay**: 0.9x per frame
- **Elements**: 4 (bottom-image, mobile-left-image, mobile-right-image, track-title)

---

## Screen Shake Parameters

### First Drop (0:31.5 - 1:35)
- **Intensity (Center)**: ±4px
- **Intensity (Stars)**: ±1.5px
- **Shake Duration**: 1.5s
- **Delay Duration**: 0.5s

### Second Drop (2:07 - 3:12)
- **Same as First Drop**

---

## Model Viewer Parameters

### Center Model Zoom
- **Base Scale**: 0.01 → 1.0 (0:00 - 0:31.5)
- **Zoom In**: 1.0 → 1.75x (0:25 - 1:04)
- **Zoom Out**: 1.75x → 1.0x (1:04 - 1:34)
- **Final Zoom Out**: 1.0 → 0.0 (3:15 - 3:35)

### Center Model Brightness
- **Start**: 0.1 (at 0:31.5)
- **End**: 1.0 (at 0:32.4)
- **Duration**: 0.9 seconds

### Center Model Opacity
- **Fade In**: 0:00 - 0:02.5
- **Fade Out**: 3:20.5 - 3:35

### Camera Animation
- **Oscillation Cycle**: 64 beats (32 seconds at 120 BPM)
- **Look Cycle**: 128 beats (64 seconds)
- **Orbit Radius**: 15px
- **Height Variation**: 8px
- **Throttle**: 30fps (every 2 frames)

### 360° Spin
- **Times**: 0:30.89, 2:06.9
- **Duration**: 1.0 second each
- **Blend Duration**: 0.5 seconds

---

## Mobile Optimizations

- **Point Count**: 400 (vs 4000 desktop)
- **Radial Blur Samples**: 8 (vs 12 desktop)
- **Radial Blur Strength**: 0.7 (vs 0.9 desktop)
- **Spline Steps**: 2x2 (vs 3x3 desktop)
- **Model**: Compressed GLB files

