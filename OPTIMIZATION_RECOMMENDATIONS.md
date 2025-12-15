# Optimization Recommendations

## Current Performance Bottlenecks

### High-Cost Periods

**0:31 - 1:35 (First Drop)**
- Screen shake (±4px every frame)
- Chromatic aberration on model viewer
- Chromatic aberration on stars (pulsing)
- Chromatic aberration on 4 UI elements (glitch effect)
- Star fast movement (150x multiplier)
- Parallax shift on 4 elements
- Bloom intensity updates
- **Recommendation**: This is the most intensive period. Monitor FPS here.

**2:07 - 3:10 (Second Drop)**
- Same as first drop
- Additional: Camera pan & tilt enabled
- Additional: Invert filter applied (CSS)
- **Recommendation**: Similar intensity to first drop.

**3:10 - 3:26 (Final Fade)**
- Stars chromatic aberration fade out
- Center model final zoom out
- Center model fade out
- Final image fade in
- **Recommendation**: Lower intensity, but multiple simultaneous fades.

---

## Optimization Strategies

### 1. Chromatic Aberration Optimization
**Current**: Using drop-shadow filters (3 filters per element)
**Options**:
- Use WebGL shaders instead of CSS filters (faster)
- Reduce opacity values (0.44/0.52 → 0.3/0.4) for less visible effect
- Disable on mobile devices
- Reduce max offset (3px → 2px) for subtle effect

### 2. Star Rendering Optimization
**Current**: 105 stars + 40 hyperspace + 40 reverse = 185 stars
**Options**:
- Reduce star counts by 20-30% (105 → 75 stars)
- Batch render all stars in single draw call (already done)
- Use instanced rendering for identical stars
- Disable blur on mid-layer (3.0px blur is expensive)

### 3. Screen Shake Optimization
**Current**: Random offset every frame (±4px)
**Options**:
- Use pre-calculated shake pattern (sine wave)
- Reduce intensity (±4px → ±2px)
- Reduce frequency (every frame → every 2 frames)
- Use transform instead of style.transform

### 4. Parallax Shift Optimization
**Current**: 4 elements with audio-reactive parallax
**Options**:
- Reduce update frequency (every frame → every 2 frames)
- Use CSS transforms instead of style.left/top
- Combine into single transform calculation
- Disable on mobile

### 5. Audio Analysis Optimization
**Current**: 3 separate audio contexts (main, drums, instruments)
**Options**:
- Reduce FFT size (2048 → 1024)
- Reduce analysis frequency (every frame → every 2 frames)
- Use single audio context with multiple analysers
- Cache frequency data between frames

### 6. Canvas Rendering Optimization
**Current**: 2D canvas for stars, WebGL for triangles
**Options**:
- Use requestAnimationFrame throttling (already done for some)
- Reduce canvas resolution on mobile
- Use OffscreenCanvas for star rendering
- Batch all canvas operations

---

## Quick Wins (Easy to Implement)

1. **Reduce chromatic aberration opacity**
   - Change 0.44/0.52 → 0.3/0.4
   - Impact: ~5-10% FPS improvement
   - File: script.js (lines 742-810)

2. **Disable glitch effect on mobile**
   - Add `if (!isMobile)` check
   - Impact: ~15-20% FPS improvement on mobile
   - File: script.js

3. **Reduce star count by 20%**
   - 50 → 40, 35 → 28, 20 → 16
   - Impact: ~10-15% FPS improvement
   - File: stars.js (lines 66-97)

4. **Use pre-calculated shake pattern**
   - Replace Math.random() with sine wave
   - Impact: ~5% FPS improvement
   - File: script.js (lines 89-130)

5. **Throttle parallax updates to 30fps**
   - Add frame counter check
   - Impact: ~10% FPS improvement
   - File: script.js (lines 742-810)

---

## Medium Effort Optimizations

1. **Implement WebGL chromatic aberration shader**
   - Replace CSS drop-shadow filters
   - Impact: ~20-30% FPS improvement during drops
   - Effort: Medium (requires shader code)

2. **Use CSS transforms for parallax**
   - Replace style.left/top with transform
   - Impact: ~10-15% FPS improvement
   - Effort: Low (simple refactor)

3. **Reduce FFT size for audio analysis**
   - 2048 → 1024
   - Impact: ~5-10% FPS improvement
   - Effort: Low (one-line change)

4. **Implement star instancing**
   - Use WebGL instancing for identical stars
   - Impact: ~15-20% FPS improvement
   - Effort: High (requires WebGL knowledge)

---

## Testing Recommendations

1. **Profile during high-intensity periods**
   - Use Chrome DevTools Performance tab
   - Record 0:31-1:35 and 2:07-3:10
   - Target: 60 FPS (16.67ms per frame)

2. **Test on target devices**
   - Desktop (Chrome, Firefox, Safari)
   - Mobile (iPhone, Android)
   - Tablet (iPad, Android tablet)

3. **Monitor specific metrics**
   - FPS (frames per second)
   - GPU utilization
   - CPU utilization
   - Memory usage
   - Battery drain (mobile)

4. **A/B test optimizations**
   - Implement one optimization at a time
   - Measure FPS improvement
   - Keep if > 5% improvement

---

## Current Performance Characteristics

### Expected FPS by Period
- **0:00 - 0:31**: 55-60 FPS (intro, moderate load)
- **0:31 - 1:35**: 45-55 FPS (first drop, high load)
- **1:35 - 2:07**: 55-60 FPS (breakdown, moderate load)
- **2:07 - 3:10**: 45-55 FPS (second drop, high load)
- **3:10 - 4:00**: 50-60 FPS (final section, moderate load)

### Mobile Expected FPS
- **All periods**: 30-45 FPS (due to reduced point count)
- **Drops**: 25-35 FPS (if chromatic aberration enabled)

### Optimization Target
- **Desktop**: Maintain 55+ FPS during drops
- **Mobile**: Maintain 30+ FPS during drops

