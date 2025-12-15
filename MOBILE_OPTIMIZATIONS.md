# Mobile Optimizations & Modernization

This CodePen has been optimized for mobile devices and modernized to use the latest Three.js (r160).

## Changes Made

### Modernization (Three.js r160)

- **Replaced `THREE.Geometry` with `THREE.BufferGeometry`** - The legacy Geometry API was removed in newer Three.js versions
- **Updated `THREE.Math` to `THREE.MathUtils`** - Math utilities were moved to MathUtils namespace
- **Replaced `THREE.FlatShading` with `flatShading: true`** - Updated to modern material property syntax
- **Replaced `THREE.VertexColors` with `vertexColors: true`** - Updated to boolean property
- **Updated `ExtrudeGeometry` parameter** - Changed `amount` to `depth` parameter
- **Modernized `BloomPass` to `UnrealBloomPass`** - Using the newer, more powerful bloom effect
- **Updated `EffectComposer` API** - Simplified initialization for modern Three.js
- **Added `BufferGeometryUtils`** - Required for merging BufferGeometry instances

### 1. **Touch Event Support** (dist/script.js)

- Added `touchstart` and `touchmove` event listeners
- Created a unified `handleInteraction()` function that works for both mouse and touch
- Prevents default touch behavior to avoid scrolling interference
- Uses `{ passive: false }` to ensure preventDefault works

### 2. **Performance Optimization** (dist/script.js)

- Reduced particle count on mobile devices from 10,000 to 5,000
- Detects mobile devices using user agent string
- Maintains full quality on desktop

### 3. **Viewport Configuration** (index.html)

- Added proper viewport meta tags:
  - `maximum-scale=1.0` - prevents unwanted zooming
  - `user-scalable=no` - disables pinch-to-zoom
- Added mobile web app meta tags for better full-screen experience

## How to Test

### Desktop

1. Open `http://localhost:8000` in your browser
2. Move your mouse to interact with the animation

### Mobile

1. Find your computer's local IP address
2. On your mobile device (same WiFi network), visit `http://[your-ip]:8000`
3. Touch and drag to interact with the animation

## Original CodePen

This is based on the famous CodePen by Gosha Arinich (zadvorsky): https://codepen.io/zadvorsky/pen/ezZXzg

## Technical Details

- Uses Delaunay triangulation to create the mesh
- Custom THREE.js shaders for animation
- Bloom post-processing effect
- dat.GUI for color controls (desktop only)
