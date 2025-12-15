# SORSARI - Into Twilight: Complete Effect Timeline

## Song Duration: ~4:00 (240 seconds)

---

## PRE-INTRO (0:00 - 0:31)

### Blinking Stars Layer

- **0:00 - 0:08**: Render blinking stars (80 stars, slow movement, sine-wave blink effect)
- **0:08 - 0:20**: Fade out blinking stars over 12 seconds
- **0:20+**: Process killed (no rendering)

### Main Stars Canvas

- **0:00 - 0:20**: Zoom out from 2.0x to 1.0x (20 seconds)
- **0:00 - 0:24**: Blur out from 2.0px to 0px (24 seconds)
- **0:00+**: Normal star movement (slow, parallax layers)

### Center Model

- **0:00 - 0:02.5**: Fade in opacity from 0 to 1.0
- **0:00 - 0:31.5**: Scale up from 0.01 to 1.0 (eased)
- **0:00+**: Camera oscillation (locked, not roving yet)

### UI Elements (Text, Images)

- **0:00 - 0:08**: Hidden (opacity 0)
- **0:08 - 0:24**: Fade in over 16 seconds
- **0:24+**: Fully visible

### Triangles Canvas (Three.js)

- **0:00 - 0:15.5**: Brightness at 0.3
- **0:15.5 - 0:27.4**: Fade brightness from 0.3 to 1.0 (12 seconds)
- **0:27.4+**: Full brightness (1.0)

---

## FIRST DROP (0:31 - 1:35)

### Drop Start: 0:31.5 (31.5s)

### Center Model

- **0:30.89**: 360° spin (1 second)
- **0:31.5 - 0:32.4**: Brightness fade from 0.1 to 1.0 (0.9 seconds)
- **0:25 - 1:04**: Zoom in from 1.0 to 1.75x (39 seconds)
- **1:04 - 1:34**: Zoom out from 1.75x to 1.0x (30 seconds)

### Model Viewer Chromatic Aberration

- **0:31.85 - 1:03**: Increase from 5px to 10px offset
- **1:03 - 1:04**: Fade out from 10px to 0px (1 second)
- **1:04+**: Completely disabled

### Stars Canvas

- **0:31.85 - 1:35.8**: Fast downward movement (drop speed multiplier 150x)
- **1:04 - 1:35.8**: Chromatic aberration pulsing (2 full pulses, 3px max offset)

### Screen Shake

- **0:31.5 - 1:35**: Active (1.5s shake + 0.5s delay cycles)
- Center model: ±4px
- Stars: ±1.5px

### UI Elements Chromatic Aberration (Glitch Effect)

- **0:31 - 1:03**: Active (opposite parallax direction, 0.44-0.52 opacity)
- **1:03 - 1:04**: Fade out
- **1:04+**: Disabled

### Parallax Shift (Audio-Reactive)

- **0:31+**: Active (bass-responsive, max ±3.275px)

---

## BREAKDOWN (1:35 - 2:07)

### Stars Canvas

- **1:35.8 - 1:37.8**: Deceleration (2 seconds, stars slow down)
- **1:37.8 - 2:07**: Fade out (4 seconds fade, then invisible until 2:07)

### Center Model

- **1:34 - 1:35**: Zoom out completes
- **1:35+**: Camera roving enabled (orbital movement + look direction)

### Screen Shake

- **1:35+**: Stops

### Chromatic Aberration (All)

- **1:35+**: Disabled

---

## SECOND DROP (2:07 - 3:10)

### Drop Start: 2:07.03 (127.78s)

### Center Model

- **2:06.9**: 360° spin (1 second)
- **2:07+**: Camera roving continues

### Stars Canvas

- **2:07 - 3:10**: Fast upward movement (reverse direction, drop speed multiplier 150x)
- **2:07 - 3:10**: Chromatic aberration rotating effect (sine wave, 3px max offset)

### Screen Shake

- **2:07 - 3:12**: Active (1.5s shake + 0.5s delay cycles)

### UI Elements Chromatic Aberration (Glitch Effect)

- **2:07 - 2:54**: Active (opposite parallax direction)
- **2:54 - 3:10**: Fade out over 16 seconds
- **3:10+**: Disabled

### Three.js Invert Filter

- **2:08**: Applied (invert 100% + hue-rotate 180°)
- **2:40.06**: Removed

### Camera Pan & Tilt

- **2:40.06+**: Upward pan + tilt enabled (very slow, continuous)

---

## FINAL SECTION (3:10 - 4:00)

### Stars Canvas

- **3:10 - 3:26**: Chromatic aberration fade out (16 seconds, then disabled)
- **3:26+**: Process killed
- **3:14.5 - 3:29.5**: Final blur and fade out (15 seconds)

### Center Model

- **3:15 - 3:35**: Final zoom out from 1.0 to 0.0 (20 seconds)
- **3:20.5 - 3:35**: Fade out opacity from 1.0 to 0.0 (15 seconds)
- **3:35+**: Invisible

### Final Image

- **3:20**: Lazy load starts
- **3:33 - 3:34.5**: Fade in over 1.5 seconds
- **3:34.5+**: Fully visible, interactive (Vanilla Tilt enabled)

### Screen Shake

- **3:12+**: Stops

### Camera Pan & Tilt

- **2:40.06+**: Continues throughout

---

---

## AUDIO-REACTIVE EFFECTS (Continuous)

### Kick Detection & Color Flash

- **Threshold**: 0.68 (drums track)
- **Effect**: Triangles color shifts from purple (0x362f99) to pink (0x766391)
- **Active**: Throughout song

### Bloom Intensity

- **Trigger**: Bass level > 0.5
- **Intensity**: (bass - 0.5) \* 2.0
- **Update Rate**: Every 3 frames (throttled)

### Star Pulsing

- **Trigger**: Instruments level > threshold
- **Probability**: 0.000375 per frame
- **Effect**: Individual stars pulse outward

### Parallax Shift (UI Elements)

- **Sensitivity**: 0.476 (audio-reactive)
- **Max Shift**: ±3.275px
- **Elements**: bottom-image, mobile-left-image, mobile-right-image, track-title
- **Peak Detection**: Decay 0.9x per frame

---

## PERFORMANCE NOTES

### Processes That Kill Themselves

1. **Blinking stars layer**: Stops rendering at 0:20
2. **Stars chromatic aberration**: Stops rendering at 3:26
3. **Center model**: Becomes invisible at 3:35

### Throttled Processes (Performance)

- Camera animation: 30fps (every 2 frames)
- Zoom animation: 30fps (every 2 frames)
- Bloom update: Every 3 frames
- Star pulse: Probability-based (rare)

### Continuous Processes

- Main stars rendering (all 3 layers)
- Three.js triangles canvas
- Center model camera animation
- Audio analysis (drums, instruments, main)
- Parallax shift calculation
- Screen shake calculation
- Final image animation loop
