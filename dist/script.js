window.onload = init;

// Detect mobile devices
var isMobile =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

var CONFIG = {
  pointCount: isMobile ? 800 : 4000, // Balanced for mobile - still looks good but performs well
  extrudeAmount: 2.0,
  splineStepsX: isMobile ? 2 : 3, // Decent quality on mobile
  splineStepsY: isMobile ? 2 : 3, // Decent quality on mobile

  // Radial blur settings - adjust these to change blur strength
  radialBlurStrength: isMobile ? 0.7 : 0.9, // Higher = more blur (0.0 - 1.0)
  radialBlurSamples: isMobile ? 8 : 12, // Higher = smoother blur but slower (4 - 16)
};

// Audio setup
var audioContext;
var analyser;
var dataArray;
var audioSource;
var audioElement;

// Drums track for kick detection
var drumsAnalyser;
var drumsDataArray;
var drumsSource;
var drumsElement;

// Instruments track for star pulsing
var instrumentsAnalyser;
var instrumentsDataArray;
var instrumentsSource;
var instrumentsElement;

var bassLevel = 0;
var drumsBassLevel = 0;
var instrumentsLevel = 0;
var audioReactive = false;

// Global time tracking (exposed for model-viewer animations)
window.musicTime = 0;

// Kick detection and color flash
var kickThreshold = 0.68; // Threshold for kick detection (0-1)
var kickTimingOffset = 0.0; // Timing offset for kick flash in seconds (positive = earlier, negative = later)
var colorFlashAmount = 0; // Current flash amount (0-1)
var defaultColor = new THREE.Color(0x362f99); // Default purple/blue
var kickColor = new THREE.Color(0x766391); // Pink color for kicks

// Audio timing offset (in seconds) - adjust if visualizer is ahead/behind music
var audioTimingOffset = 0; // Positive = delay visualizer, Negative = advance visualizer

// Bass history buffer for timing offset
var bassHistory = [];
var maxHistoryLength = 300; // Store up to 10 seconds at 30fps

function initAudio() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();

  // Main audio analyser
  analyser = audioContext.createAnalyser();
  analyser.fftSize = isMobile ? 64 : 128;
  analyser.smoothingTimeConstant = 0.8;
  var bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);

  // Drums analyser for kick detection
  drumsAnalyser = audioContext.createAnalyser();
  drumsAnalyser.fftSize = isMobile ? 64 : 128;
  drumsAnalyser.smoothingTimeConstant = 0.8;
  var drumsBufferLength = drumsAnalyser.frequencyBinCount;
  drumsDataArray = new Uint8Array(drumsBufferLength);

  // Instruments analyser for star pulsing
  instrumentsAnalyser = audioContext.createAnalyser();
  instrumentsAnalyser.fftSize = isMobile ? 64 : 128;
  instrumentsAnalyser.smoothingTimeConstant = 0.8;
  var instrumentsBufferLength = instrumentsAnalyser.frequencyBinCount;
  instrumentsDataArray = new Uint8Array(instrumentsBufferLength);

  // Main audio track
  audioElement = new Audio("sorsari - into twilight.wav");
  audioElement.loop = false; // Don't loop
  audioElement.crossOrigin = "anonymous";

  // Expose globally for debug controls
  window.audioElement = audioElement;

  // Connect main audio to analyser and output
  audioSource = audioContext.createMediaElementSource(audioElement);
  audioSource.connect(analyser);
  analyser.connect(audioContext.destination);

  // Drums track for kick detection
  drumsElement = new Audio("stems/drums.wav");
  drumsElement.loop = false; // Don't loop
  drumsElement.crossOrigin = "anonymous";
  drumsSource = audioContext.createMediaElementSource(drumsElement);
  drumsSource.connect(drumsAnalyser);
  console.log("Drums track loaded for kick detection");

  // Instruments track for star pulsing
  instrumentsElement = new Audio("stems/instruments.wav");
  instrumentsElement.loop = false; // Don't loop
  instrumentsElement.crossOrigin = "anonymous";
  instrumentsSource = audioContext.createMediaElementSource(instrumentsElement);
  instrumentsSource.connect(instrumentsAnalyser);
  console.log("Instruments track loaded for star pulsing");

  // Sync all tracks - play them together
  function playAllTracks() {
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    // Start all audio tracks
    var playPromises = [audioElement.play()];
    if (drumsElement) {
      playPromises.push(drumsElement.play());
    }
    if (instrumentsElement) {
      playPromises.push(instrumentsElement.play());
    }

    Promise.all(playPromises)
      .then(function () {
        audioReactive = true;
        console.log("All tracks playing in sync:", {
          main: true,
          drums: !!drumsElement,
          instruments: !!instrumentsElement,
        });
      })
      .catch(function (error) {
        console.error("Playback failed:", error);
        // Try to play main audio at least
        audioElement.play().then(function () {
          audioReactive = true;
          console.log("Main audio playing (stems failed)");
        });
      });
  }

  // Try to autoplay, fallback to click-to-play
  playAllTracks();

  // Fallback for autoplay prevention
  document.addEventListener(
    "click",
    function () {
      if (!audioReactive) {
        playAllTracks();
      }
    },
    { once: true }
  );
}

function getAudioData() {
  if (!audioReactive || !analyser) return 0;

  analyser.getByteFrequencyData(dataArray);

  // Get bass frequencies (0-250Hz roughly corresponds to first 8 bins)
  var bass = 0;
  for (var i = 0; i < 8; i++) {
    bass += dataArray[i];
  }
  bass = bass / (8 * 255); // Normalize to 0-1

  // Smooth the bass level
  bassLevel = bassLevel * 0.7 + bass * 0.3;

  // Store in history buffer for timing offset
  bassHistory.push(bassLevel);
  if (bassHistory.length > maxHistoryLength) {
    bassHistory.shift(); // Remove oldest entry
  }

  // Apply timing offset by reading from history
  // Positive offset = delay (read from past), Negative offset = advance (read current/recent)
  var offsetFrames = Math.round(-audioTimingOffset * 30); // Convert seconds to frames (30fps), invert sign
  var historyIndex = bassHistory.length - 1 - offsetFrames;

  // Clamp to valid range
  if (historyIndex < 0) historyIndex = 0;
  if (historyIndex >= bassHistory.length) historyIndex = bassHistory.length - 1;

  return bassHistory[historyIndex] || bassLevel;
}

// Get drums bass data for kick detection
function getDrumsBass() {
  // If drums track not available, fall back to main audio bass
  if (!drumsElement || !drumsAnalyser) {
    return getAudioData();
  }

  if (!audioReactive) return 0;

  drumsAnalyser.getByteFrequencyData(drumsDataArray);

  // Get bass frequencies from drums track (0-250Hz roughly corresponds to first 8 bins)
  var drumsBass = 0;
  for (var i = 0; i < 8; i++) {
    drumsBass += drumsDataArray[i];
  }
  drumsBass = drumsBass / (8 * 255); // Normalize to 0-1

  // Smooth the drums bass level
  drumsBassLevel = drumsBassLevel * 0.7 + drumsBass * 0.3;

  return drumsBassLevel;
}

// Get instruments data for star pulsing (mid-high frequencies)
function getInstrumentsLevel() {
  if (!instrumentsElement || !instrumentsAnalyser) {
    return 0;
  }

  if (!audioReactive) return 0;

  instrumentsAnalyser.getByteFrequencyData(instrumentsDataArray);

  // Get mid-high frequencies (bins 8-32 for melodic content)
  var instruments = 0;
  for (var i = 8; i < 32; i++) {
    instruments += instrumentsDataArray[i];
  }
  instruments = instruments / (24 * 255); // Normalize to 0-1

  // Smooth the instruments level
  instrumentsLevel = instrumentsLevel * 0.6 + instruments * 0.4;

  return instrumentsLevel;
}

// Expose instruments level globally for star animation
window.getInstrumentsLevel = getInstrumentsLevel;

function init() {
  // Initialize audio
  initAudio();

  var root = new THREERoot({
    createCameraControls: false,
    antialias: window.devicePixelRatio === 1,
    fov: 60,
  });
  root.renderer.setClearColor(0x000000, 0); // Transparent background
  root.camera.position.set(0, 0, 200);
  root.camera.lookAt(15, -25, 0); // Tilted down to avoid bright center

  var light = new THREE.PointLight(0xffffff, 1.0);
  root.add(light);

  var vertices = [],
    indices,
    i,
    j;

  // 1. generate random points in grid formation with some noise
  var PHI = Math.PI * (3 - Math.sqrt(5));
  var n = CONFIG.pointCount;
  var radius = 100;
  var noise = 4.0;

  for (i = 0; i <= n; i++) {
    var t = i * PHI;
    var r = Math.sqrt(i) / Math.sqrt(n);
    var x = r * Math.cos(t) * (radius - THREE.Math.randFloat(0, noise));
    var y = r * Math.sin(t) * (radius - THREE.Math.randFloatSpread(0, noise));

    vertices.push([x, y]);
  }

  // 2. generate indices
  indices = Delaunay.triangulate(vertices);

  // 2.5. reduce triangle count on mobile for better performance
  if (isMobile) {
    // Keep only every other triangle (50% reduction)
    var reducedIndices = [];
    for (var idx = 0; idx < indices.length; idx += 6) {
      // Each triangle is 3 indices, skip every other triangle
      if (idx + 2 < indices.length) {
        reducedIndices.push(indices[idx]);
        reducedIndices.push(indices[idx + 1]);
        reducedIndices.push(indices[idx + 2]);
      }
    }
    indices = reducedIndices;
  }

  // 3. create displacement splines
  var pointsX = [];
  var pointsY = [];
  var segmentsX = CONFIG.splineStepsX;
  var segmentsY = CONFIG.splineStepsY;

  for (i = 0; i <= segmentsX; i++) {
    pointsX.push(
      new THREE.Vector3(
        THREE.Math.mapLinear(i, 0, segmentsX, -radius, radius),
        0,
        i === 0 || i === segmentsX ? 0 : -THREE.Math.randFloat(64, 72)
      )
    );
  }
  for (i = 0; i <= segmentsY; i++) {
    pointsY.push(
      new THREE.Vector3(
        0,
        THREE.Math.mapLinear(i, 0, segmentsY, -radius, radius),
        i === 0 || i === segmentsY ? 0 : -THREE.Math.randFloat(64, 72)
      )
    );
  }

  var splineX = new THREE.CatmullRomCurve3(pointsX);
  var splineY = new THREE.CatmullRomCurve3(pointsY);

  // line geometries for testing

  //var g, m;
  //g = new THREE.Geometry();
  //g.vertices = splineX.getPoints(50);
  //m = new THREE.LineBasicMaterial({color: 0xff0000});
  //root.add(new THREE.Line(g, m));
  //g = new THREE.Geometry();
  //g.vertices = splineY.getPoints(50);
  //m = new THREE.LineBasicMaterial({color: 0x00ff00});
  //root.add(new THREE.Line(g, m));

  // 4. generate geometry (maybe find a cheaper way to do this)
  var geometry = new THREE.Geometry();
  var shapeScale = 0.95;

  for (i = 0; i < indices.length; i += 3) {
    // build the face
    var v0 = vertices[indices[i]];
    var v1 = vertices[indices[i + 1]];
    var v2 = vertices[indices[i + 2]];

    // calculate centroid
    var cx = (v0[0] + v1[0] + v2[0]) / 3;
    var cy = (v0[1] + v1[1] + v2[1]) / 3;

    // translate, scale, un-translate
    v0 = [(v0[0] - cx) * shapeScale + cx, (v0[1] - cy) * shapeScale + cy];
    v1 = [(v1[0] - cx) * shapeScale + cx, (v1[1] - cy) * shapeScale + cy];
    v2 = [(v2[0] - cx) * shapeScale + cx, (v2[1] - cy) * shapeScale + cy];

    // draw the face to a shape
    var shape = new THREE.Shape();
    shape.moveTo(v0[0], v0[1]);
    shape.lineTo(v1[0], v1[1]);
    shape.lineTo(v2[0], v2[1]);

    // use the shape to create a geometry
    var shapeGeometry = new THREE.ExtrudeGeometry(shape, {
      amount: CONFIG.extrudeAmount,
      bevelEnabled: false,
    });

    // offset z vector components based on the two splines
    for (j = 0; j < shapeGeometry.vertices.length; j++) {
      var v = shapeGeometry.vertices[j];
      var ux = THREE.Math.clamp(
        THREE.Math.mapLinear(v.x, -radius, radius, 0.0, 1.0),
        0.0,
        1.0
      );
      var uy = THREE.Math.clamp(
        THREE.Math.mapLinear(v.y, -radius, radius, 0.0, 1.0),
        0.0,
        1.0
      );

      v.z += splineX.getPointAt(ux).z;
      v.z += splineY.getPointAt(uy).z;
    }

    // merge into the whole
    geometry.merge(shapeGeometry);
  }

  geometry.center();

  // 5. feed the geometry to the animation
  var animation = new Animation(geometry);
  root.add(animation);

  // interactive
  var paused = false;

  // post processing - define early so we can use in update callback
  // Reduce bloom quality on mobile for better performance
  // Higher threshold = only bright parts bloom (only on bass hits)
  var bloomPass = new THREE.BloomPass(2.0, 25, 4, isMobile ? 256 : 512); // Threshold 2.0 = only bloom on peaks

  // Radial blur shader for atmospheric background effect
  var RadialBlurShader = {
    uniforms: {
      tDiffuse: { type: "t", value: null },
      resolution: {
        type: "v2",
        value: new THREE.Vector2(window.innerWidth, window.innerHeight),
      },
      strength: { type: "f", value: CONFIG.radialBlurStrength },
      samples: { type: "i", value: CONFIG.radialBlurSamples },
    },
    vertexShader: [
      "varying vec2 vUv;",
      "void main() {",
      "  vUv = uv;",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
      "}",
    ].join("\n"),
    fragmentShader: [
      "uniform sampler2D tDiffuse;",
      "uniform vec2 resolution;",
      "uniform float strength;",
      "uniform int samples;",
      "varying vec2 vUv;",
      "",
      "void main() {",
      "  vec2 center = vec2(0.5, 0.5);",
      "  vec2 uv = vUv;",
      "  vec2 dir = uv - center;",
      "  float dist = length(dir);",
      "  dir = normalize(dir);",
      "  ",
      "  vec4 color = texture2D(tDiffuse, uv);",
      "  vec4 sum = color;",
      "  ",
      "  float blurAmount = strength * dist;",
      "  ",
      "  for(int i = 1; i < 12; i++) {",
      "    if(i >= samples) break;",
      "    float scale = 1.0 - blurAmount * (float(i) / float(samples));",
      "    sum += texture2D(tDiffuse, center + dir * dist * scale);",
      "  }",
      "  ",
      "  sum /= float(samples);",
      "  gl_FragColor = sum;",
      "}",
    ].join("\n"),
  };

  var radialBlurPass = new THREE.ShaderPass(RadialBlurShader);
  var copyPass = new THREE.ShaderPass(THREE.CopyShader);
  root.initPostProcessing([bloomPass, radialBlurPass, copyPass]);

  // Get access to the geometry vertices for speaker cone effect
  var positions = animation.geometry.attributes.position.array;
  var originalPositions = new Float32Array(positions.length);
  for (var i = 0; i < positions.length; i++) {
    originalPositions[i] = positions[i];
  }

  var frameCount = 0; // For throttling vertex updates
  var cameraTime = 0; // For camera movement timing
  var originalCameraPos = { x: 0, y: 0, z: 90 }; // Store original camera position after zoom-in
  var upwardPanStartTime = 160.06; // 2:40:06 - when upward pan begins
  var upwardPanSpeed = 2.125; // Units per second to pan upward (SUPER slow)
  var upwardTiltSpeed = 10; // Degrees per second to tilt camera upward
  var upwardPanEnabled = false; // Track if pan/tilt has been enabled

  // Intro zoom settings
  var dropTime = 31.5; // Time in seconds when the drop hits
  var zoomDuration = 2.0; // Duration of zoom-in animation in seconds
  var introZoomDistance = 1000; // Starting zoomed-out distance
  var preDropZoomDistance = 450; // Slightly closer before the drop (subtle zoom)
  var finalZoomDistance = 90; // Final zoomed-in distance
  var hasZoomedIn = false;
  var introZoomDuration = 32.0; // Duration of subtle intro zoom (first 30 seconds)

  // Second drop zoom settings (breakdown at 1:35) - same pattern as first drop
  var secondBreakdownStart = 95.0; // 1:35 - breakdown starts (like 0 seconds in intro)
  var secondIntroZoomDuration = 30.0; // 30 seconds of subtle zoom (95-125)
  var secondDropTime = 127; // 2:06.5 - second drop (95 + 31.5 seconds)
  var hasSecondZoom = false;

  // CSS filter inversion at second drop
  var invertFilterApplied = false;
  var invertFilterRemoved = false;
  var threeContainer = document.getElementById("three-container");
  var threeBlurWrapper = document.getElementById("three-blur-wrapper");

  // Triangle canvas fade out timing
  var triangleFadeOutStart = 185; // 3:05
  var triangleFadeOutEnd = 215; // 3:35
  var triangleFadeOutDuration = triangleFadeOutEnd - triangleFadeOutStart; // 30 seconds

  // Triangle canvas blur timing
  var triangleBlurStart = 178; // 2:58
  var triangleBlurEnd = 215; // 3:35 (when fade out completes)
  var triangleBlurDuration = triangleBlurEnd - triangleBlurStart; // 37 seconds

  // Camera zoom out timing
  var cameraZoomOutStart = 165; // 2:45
  var cameraZoomOutEnd = 215; // 3:35 (when fade out completes)
  var cameraZoomOutDuration = cameraZoomOutEnd - cameraZoomOutStart; // 50 seconds
  var cameraZoomOutDistance = 300; // How far to pull back (added to current Z position)

  // Camera roving settings
  var beatsPerCycle = 64; // Number of beats for position orbit
  var beatsPerLookCycle = 128; // Number of beats for look direction (tilt/pan)
  var bpm = 120;
  var secondsPerBeat = 60 / bpm;
  var cycleDuration = beatsPerCycle * secondsPerBeat; // Position cycle time
  var lookCycleDuration = beatsPerLookCycle * secondsPerBeat; // Look cycle time

  // Scene rotation settings
  var beatsPerRotation = 192; // Full rotation every 192 beats (50% slower than 128)
  var rotationDuration = beatsPerRotation * secondsPerBeat; // Time for full 360° rotation

  root.addUpdateCallback(function () {
    if (paused) return;

    animation.time += 1 / 30;
    frameCount++;

    // Only increment camera time if audio is playing
    if (audioReactive && audioElement && !audioElement.paused) {
      cameraTime += 1 / 30;
      window.musicTime = audioElement.currentTime; // Use actual audio time for accuracy
    }

    // Get current audio playback time
    var currentTime = audioElement ? audioElement.currentTime : 0;

    // Camera zoom out from 2:45 to 3:35 (165s to 215s) - pull camera back on Z axis
    var cameraZoomOutOffset = 0;
    if (currentTime >= cameraZoomOutStart) {
      var zoomOutProgress = Math.min(
        (currentTime - cameraZoomOutStart) / cameraZoomOutDuration,
        1.0
      );
      cameraZoomOutOffset = zoomOutProgress * cameraZoomOutDistance; // Pull back up to 300 units
    }

    // Handle multi-stage zoom animation
    // FIRST DROP SEQUENCE (0-33.5 seconds)
    if (currentTime < introZoomDuration) {
      // Stage 1: Subtle intro zoom (0-30 seconds) - very slow zoom in
      var introProgress = currentTime / introZoomDuration;
      // Ease in-out for smooth subtle zoom
      var easedIntroProgress =
        introProgress < 0.5
          ? 2 * introProgress * introProgress
          : 1 - Math.pow(-2 * introProgress + 2, 2) / 2;
      root.camera.position.z =
        introZoomDistance +
        (preDropZoomDistance - introZoomDistance) * easedIntroProgress +
        cameraZoomOutOffset;
    } else if (
      currentTime >= dropTime &&
      currentTime < dropTime + zoomDuration
    ) {
      // Stage 2: Big zoom-in at the drop (31.5-33.5 seconds)
      var zoomProgress = (currentTime - dropTime) / zoomDuration;
      // Ease out cubic for smooth deceleration
      var easedProgress = 1 - Math.pow(1 - zoomProgress, 3);
      // Interpolate camera Z position from pre-drop distance to final
      root.camera.position.z =
        preDropZoomDistance +
        (finalZoomDistance - preDropZoomDistance) * easedProgress +
        cameraZoomOutOffset;

      if (!hasZoomedIn && zoomProgress >= 1.0) {
        hasZoomedIn = true;
      }
    } else if (currentTime >= introZoomDuration && currentTime < dropTime) {
      // Between intro zoom and drop - hold at pre-drop distance
      root.camera.position.z = preDropZoomDistance + cameraZoomOutOffset;
    }
    // SECOND DROP SEQUENCE (1:35-2:08.5 / 95-128.5 seconds) - same timing as first
    else if (
      currentTime >= secondBreakdownStart &&
      currentTime < secondBreakdownStart + secondIntroZoomDuration
    ) {
      // Subtle zoom out during breakdown (95-125 seconds, 30 seconds)
      var secondIntroProgress =
        (currentTime - secondBreakdownStart) / secondIntroZoomDuration;
      var easedSecondIntroProgress =
        secondIntroProgress < 0.5
          ? 2 * secondIntroProgress * secondIntroProgress
          : 1 - Math.pow(-2 * secondIntroProgress + 2, 2) / 2;
      root.camera.position.z =
        finalZoomDistance +
        (preDropZoomDistance - finalZoomDistance) * easedSecondIntroProgress +
        cameraZoomOutOffset;
    } else if (
      currentTime >= secondDropTime &&
      currentTime < secondDropTime + zoomDuration
    ) {
      // Big zoom back in at second drop (126.5-128.5 seconds)
      var secondZoomProgress = (currentTime - secondDropTime) / zoomDuration;
      var easedSecondProgress = 1 - Math.pow(1 - secondZoomProgress, 3);
      root.camera.position.z =
        preDropZoomDistance +
        (finalZoomDistance - preDropZoomDistance) * easedSecondProgress +
        cameraZoomOutOffset;

      if (!hasSecondZoom && secondZoomProgress >= 1.0) {
        hasSecondZoom = true;
      }
    } else if (
      currentTime >= secondBreakdownStart + secondIntroZoomDuration &&
      currentTime < secondDropTime
    ) {
      // Between second intro zoom and second drop - hold at pre-drop distance
      root.camera.position.z = preDropZoomDistance + cameraZoomOutOffset;
    }

    // Audio reactivity - only use actual bass from audio
    var bass = getAudioData();

    // Fade in canvas opacity from 13 to 30 seconds
    var fadeInStart = 13.0; // Start fading at 13 seconds
    var fadeInEnd = 30.0; // Finish fading at 30 seconds
    var currentAudioTime = audioElement ? audioElement.currentTime : 0;
    if (currentAudioTime < fadeInStart) {
      // Before 13 seconds - stay at 0 opacity
      animation.material.uniforms["opacity"].value = 0.0;
    } else if (currentAudioTime < fadeInEnd) {
      // Between 13-30 seconds - fade from 0 to 1
      var fadeProgress =
        (currentAudioTime - fadeInStart) / (fadeInEnd - fadeInStart);
      animation.material.uniforms["opacity"].value = fadeProgress;
    } else {
      // After 30 seconds - stay at full opacity
      animation.material.uniforms["opacity"].value = 1.0;
    }

    // Rotate the entire scene slowly - full rotation every 128 beats
    if (audioReactive && audioElement && !audioElement.paused) {
      var rotationProgress = (cameraTime % rotationDuration) / rotationDuration; // 0 to 1
      var rotationAngle = (rotationProgress * (Math.PI * 2)) / 8; // 0 to 2π (360°)
      animation.rotation.z = rotationAngle; // Rotate around Z axis
    }

    // Make the animation react to bass
    // uD controls displacement/extrusion - pulsate with bass
    animation.material.uniforms["uD"].value = 2.0 + bass * 24.0;

    // uA controls animation amplitude - increase with bass
    animation.material.uniforms["uA"].value = 1.0 + bass * 6.0;

    // Make it more metallic and less rough when bass hits
    animation.material.uniforms["roughness"].value = 0.5 - bass * 0.3;
    animation.material.uniforms["metalness"].value = 0.3 + bass * 0.7;

    // Kick detection and color flash (using drums track)
    var drumsBass = getDrumsBass();
    if (drumsBass > kickThreshold) {
      // Kick detected - flash to pink
      colorFlashAmount = Math.min(1.0, colorFlashAmount + 0.3);
    } else {
      // Fade back to default color
      colorFlashAmount = Math.max(0.0, colorFlashAmount - 0.05);
    }

    // Interpolate between default color and kick color
    var currentColor = defaultColor.clone().lerp(kickColor, colorFlashAmount);
    animation.material.uniforms["diffuse"].value.copy(currentColor);

    // Update bloom intensity - ONLY bloom on strong bass hits
    // Bass threshold: only bloom when bass > 0.5 (true peak moments only)
    var bloomIntensity = 0.0; // No bloom by default
    if (bass > 0.5) {
      // Scale bloom intensity based on how much bass exceeds threshold
      bloomIntensity = (bass - 0.5) * 2.0; // Amplify the bloom on peaks
    }
    bloomPass.copyUniforms["opacity"].value = bloomIntensity;

    // Camera roving - smooth circular motion that returns to origin
    // Only move camera if controls are not enabled AND audio is playing AND zoom-in is complete
    if (
      (!root.controls || !root.controls.enabled) &&
      audioReactive &&
      audioElement &&
      !audioElement.paused &&
      hasZoomedIn // Only start roving after zoom-in completes
    ) {
      var cycleProgress = (cameraTime % cycleDuration) / cycleDuration; // 0 to 1
      var angle = cycleProgress * Math.PI * 2; // Full circle

      // Smooth easing - slow at start/end, faster in middle
      var eased = 0.5 - Math.cos(angle) * 0.5;

      // Gentle orbital movement
      var orbitRadius = 15; // How far to move from center
      var heightVariation = 8; // Vertical movement

      root.camera.position.x =
        originalCameraPos.x + Math.sin(angle) * orbitRadius * eased;
      root.camera.position.y =
        originalCameraPos.y + Math.sin(angle * 2) * heightVariation * eased;
      root.camera.position.z =
        originalCameraPos.z + Math.cos(angle) * 5 * eased + cameraZoomOutOffset; // Slight zoom in/out + zoom out offset

      // Camera look direction - tilts and pans over 128 beats
      var lookProgress = (cameraTime % lookCycleDuration) / lookCycleDuration; // 0 to 1
      var lookAngle = lookProgress * Math.PI * 2;

      // Create a look target that orbits around the center point - EXTREME ANGLES
      var lookOffset = 80; // Much larger offset for dramatic angle changes
      var lookTargetX = Math.sin(lookAngle) * lookOffset;
      var lookTargetY = Math.sin(lookAngle * 1.5) * lookOffset; // Full vertical tilt
      var lookTargetZ = Math.cos(lookAngle * 0.8) * lookOffset * 0.8; // Strong depth variation

      // Look at the offset target instead of dead center
      root.camera.lookAt(lookTargetX, lookTargetY, lookTargetZ);
    }

    // At 2:40:06 (160.06 seconds), start panning camera upwards and tilting (ALWAYS active after this time)
    if (currentTime >= upwardPanStartTime) {
      if (!upwardPanEnabled) {
        console.log("Camera pan and tilt enabled at 2:40:06");
        upwardPanEnabled = true;
      }

      var timeSincePanStart = currentTime - upwardPanStartTime;
      var upwardPanOffset = timeSincePanStart * upwardPanSpeed; // Pan upwards SUPER slow
      var tiltAmount = timeSincePanStart * upwardTiltSpeed; // Tilt upward over time

      // Move the camera position upward (increase Y position)
      root.camera.position.y = upwardPanOffset;

      // Tilt camera upward by looking at a point that moves up over time
      // Start looking at (0, 0, 0) and gradually look higher and higher
      var lookAtY = tiltAmount; // Look target moves upward
      root.camera.lookAt(0, lookAtY, 0);
    }

    // Apply CSS invert filter at second drop (2:08 / 128 seconds)
    if (currentTime >= 128 && !invertFilterApplied) {
      console.log("Applying invert filter at 2:08, currentTime:", currentTime);
      console.log("threeContainer exists?", !!threeContainer);

      if (threeContainer) {
        // Apply invert + hue-rotate to keep colors looking the same
        // Hue rotation of 180deg compensates for the color inversion
        threeContainer.style.filter = "invert(100%) hue-rotate(180deg)";
        console.log("Applied filter:", threeContainer.style.filter);
      } else {
        console.error("threeContainer is NULL!");
      }

      invertFilterApplied = true;
      console.log("Inverted at 2:08");
    }

    // Remove CSS invert filter at 2:40:06 (160.06 seconds)
    if (currentTime >= 160.06 && invertFilterApplied && !invertFilterRemoved) {
      console.log(
        "Removing invert filter at 2:40:06, currentTime:",
        currentTime
      );

      if (threeContainer) {
        threeContainer.style.filter = "none";
        console.log("Removed filter");
      }

      invertFilterRemoved = true;
      console.log("Inverted back at 2:40:06");
    }

    // Blur triangle canvas wrapper from 2:58 to 3:35 (178s to 215s)
    var triangleBlur = 0;
    if (currentTime >= triangleBlurStart && currentTime <= triangleBlurEnd) {
      var blurProgress =
        (currentTime - triangleBlurStart) / triangleBlurDuration;
      triangleBlur = blurProgress * 15; // Blur up to 15px
    } else if (currentTime > triangleBlurEnd) {
      triangleBlur = 15; // Max blur after end
    }

    // Apply blur to wrapper (separate from invert filter on container)
    if (threeBlurWrapper) {
      threeBlurWrapper.style.filter =
        triangleBlur > 0 ? "blur(" + triangleBlur + "px)" : "none";
    }

    // Fade out triangle canvas from 3:05 to 3:35 (185s to 215s)
    if (
      currentTime >= triangleFadeOutStart &&
      currentTime <= triangleFadeOutEnd
    ) {
      var fadeProgress =
        (currentTime - triangleFadeOutStart) / triangleFadeOutDuration;
      var opacity = 1.0 - fadeProgress; // Fade from 1.0 to 0.0
      if (threeContainer) {
        threeContainer.style.opacity = opacity;
      }
    } else if (currentTime > triangleFadeOutEnd) {
      // Keep at 0 opacity after fade completes
      if (threeContainer) {
        threeContainer.style.opacity = 0;
      }
    }

    // Speaker cone effect - throttle more on mobile for better performance
    var throttleInterval = isMobile ? 6 : 2; // Update every 6 frames on mobile, 2 on desktop
    if (frameCount % throttleInterval === 0) {
      var speakerRadius = 15; // radius of the "speaker cone" area
      var speakerPush = bass * 8.0; // how much to push in/out

      for (var i = 0; i < positions.length; i += 3) {
        var x = originalPositions[i];
        var y = originalPositions[i + 1];
        var z = originalPositions[i + 2];

        var distFromCenter = Math.sqrt(x * x + y * y + z * z);

        // Only affect vertices within speaker radius
        if (distFromCenter < speakerRadius) {
          var influence = 1.0 - distFromCenter / speakerRadius; // stronger at center
          var pushAmount = speakerPush * influence;

          // Push along the normal direction (away from center)
          var length = distFromCenter || 0.001;
          positions[i] = x + (x / length) * pushAmount;
          positions[i + 1] = y + (y / length) * pushAmount;
          positions[i + 2] = z + (z / length) * pushAmount;
        } else {
          // Reset vertices outside speaker area
          positions[i] = x;
          positions[i + 1] = y;
          positions[i + 2] = z;
        }
      }

      animation.geometry.attributes.position.needsUpdate = true;
    }
  });

  // Handle both mouse and touch events (disabled when audio is reactive)
  function handleInteraction(clientX, clientY) {
    if (paused || audioReactive) return; // Don't override audio reactivity

    var px = clientX / window.innerWidth;
    var py = clientY / window.innerHeight;

    animation.material.uniforms["uD"].value = 2.0 + px * 16;
    animation.material.uniforms["uA"].value = py * 4.0;

    animation.material.uniforms["roughness"].value = px;
    animation.material.uniforms["metalness"].value = py;
  }

  root.container.addEventListener("mousemove", function (e) {
    handleInteraction(e.clientX, e.clientY);
  });

  // Touch support for mobile
  root.container.addEventListener(
    "touchmove",
    function (e) {
      e.preventDefault();
      if (e.touches.length > 0) {
        handleInteraction(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    { passive: false }
  );

  root.container.addEventListener(
    "touchstart",
    function (e) {
      e.preventDefault();
      if (e.touches.length > 0) {
        handleInteraction(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    { passive: false }
  );

  // Keyboard controls (P = pause, C = camera controls)
  window.addEventListener("keyup", function (e) {
    if (e.key === "p" || e.key === "P") {
      paused = !paused;
    }
    if (e.key === "c" || e.key === "C") {
      if (root.controls) {
        root.controls.enabled = !root.controls.enabled;
      } else {
        root.createOrbitControls();
      }
    }
  });

  // dat.gui - DISABLED (library not included)
  // var g = new dat.GUI();
  // var colorProxy = {};

  // Object.defineProperty(colorProxy, "diffuse", {
  //   get: function () {
  //     return "#" + animation.material.uniforms["diffuse"].value.getHexString();
  //   },
  //   set: function (v) {
  //     animation.material.uniforms["diffuse"].value.set(v);
  //   },
  // });

  // g.addColor(colorProxy, "diffuse").name("color");
  // g.add(bloomPass.copyUniforms.opacity, "value").name("bloom str");
}

////////////////////
// CLASSES
////////////////////

function Animation(modelGeometry) {
  var geometry = new THREE.BAS.ModelBufferGeometry(modelGeometry);

  var i, j;

  var aOffsetAmplitude = geometry.createAttribute("aOffsetAmplitude", 2);
  var positionBuffer = geometry.getAttribute("position").array;
  var x, y, distance;

  for (i = 0; i < aOffsetAmplitude.array.length; i += 12) {
    // 6 * 2
    var offset = THREE.Math.randFloat(1, 4);
    var amplitude = THREE.Math.randFloat(0.5, 1.0);

    x = 0;
    y = 0;

    // x/y position of the corresponding vertex from the position buffer
    for (j = 0; j < 6; j += 2) {
      x += positionBuffer[((i + j) / 2) * 3];
      y += positionBuffer[((i + j) / 2) * 3 + 1];
    }

    x /= 3;
    y /= 3;

    distance = Math.sqrt(x * x + y * y);

    for (j = 0; j < 12; j += 2) {
      aOffsetAmplitude.array[i + j] =
        (distance + offset) * (1.0 + THREE.Math.randFloatSpread(0.0125));
      aOffsetAmplitude.array[i + j + 1] = amplitude;
    }
  }

  var aColor = geometry.createAttribute("color", 3);
  var color = new THREE.Color();

  for (i = 0; i < aColor.array.length; i += 18) {
    // 6 * 3
    color.setHSL(0, 0, THREE.Math.randFloat(0.5, 1.0));

    for (j = 0; j < 18; j += 3) {
      aColor.array[i + j] = color.r;
      aColor.array[i + j + 1] = color.g;
      aColor.array[i + j + 2] = color.b;
    }
  }

  var material = new THREE.BAS.StandardAnimationMaterial(
    {
      shading: THREE.FlatShading,
      vertexColors: THREE.VertexColors,
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uD: { value: 4.4 },
        uA: { value: 3.2 },
      },
      vertexFunctions: [THREE.BAS.ShaderChunk["ease_cubic_in_out"]],
      vertexParameters: [
        "uniform float uTime;",
        "uniform float uD;",
        "uniform float uA;",
        "attribute vec2 aOffsetAmplitude;",
      ],
      vertexPosition: [
        "float tProgress = sin(uTime + aOffsetAmplitude.x / uD);",
        "tProgress = easeCubicInOut(tProgress);",
        "transformed.z += aOffsetAmplitude.y * uA * tProgress;",
      ],
    },
    {
      diffuse: 0x362f99, // Normal purple/blue (will change to inverted at second drop)
      roughness: 0.5, // Higher roughness = less reflective/bright by default
      metalness: 0.3, // Lower metalness = darker by default, will increase on bass
      opacity: 0.8,
    }
  );

  geometry.computeVertexNormals();

  THREE.Mesh.call(this, geometry, material);

  this.frustumCulled = false;
}
Animation.prototype = Object.create(THREE.Mesh.prototype);
Animation.prototype.constructor = Animation;
Object.defineProperty(Animation.prototype, "time", {
  get: function () {
    return this.material.uniforms["uTime"].value;
  },
  set: function (v) {
    this.material.uniforms["uTime"].value = v;
  },
});

//// ROOT

function THREERoot(params) {
  // defaults
  params = utils.extend(
    {
      container: "#three-container",
      fov: 60,
      zNear: 1,
      zFar: 10000,
      createCameraControls: true,
      autoStart: true,
      pixelRatio: Math.min(window.devicePixelRatio, 1.5), // Cap at 1.5 for better performance
    },
    params
  );

  // maps and arrays
  this.updateCallbacks = [];
  this.resizeCallbacks = [];
  this.objects = {};

  // renderer
  this.renderer = new THREE.WebGLRenderer({
    antialias: params.antialias,
    alpha: true, // Enable transparency
  });
  this.renderer.setPixelRatio(params.pixelRatio);

  // container
  this.container =
    typeof params.container === "string"
      ? document.querySelector(params.container)
      : params.container;
  this.container.appendChild(this.renderer.domElement);

  // camera
  this.camera = new THREE.PerspectiveCamera(
    params.fov,
    window.innerWidth / window.innerHeight,
    params.zNear,
    params.zFar
  );

  // scene
  this.scene = new THREE.Scene();

  // resize handling
  this.resize = this.resize.bind(this);
  this.resize();
  window.addEventListener("resize", this.resize, false);

  // tick / update / render
  this.tick = this.tick.bind(this);
  params.autoStart && this.tick();

  // optional camera controls
  params.createCameraControls && this.createOrbitControls();
}
THREERoot.prototype = {
  createOrbitControls: function () {
    this.controls = new THREE.OrbitControls(
      this.camera,
      this.renderer.domElement
    );
    this.addUpdateCallback(this.controls.update.bind(this.controls));
  },
  start: function () {
    this.tick();
  },
  addUpdateCallback: function (callback) {
    this.updateCallbacks.push(callback);
  },
  addResizeCallback: function (callback) {
    this.resizeCallbacks.push(callback);
  },
  add: function (object, key) {
    key && (this.objects[key] = object);
    this.scene.add(object);
  },
  addTo: function (object, parentKey, key) {
    key && (this.objects[key] = object);
    this.get(parentKey).add(object);
  },
  get: function (key) {
    return this.objects[key];
  },
  remove: function (o) {
    var object;

    if (typeof o === "string") {
      object = this.objects[o];
    } else {
      object = o;
    }

    if (object) {
      object.parent.remove(object);
      delete this.objects[o];
    }
  },
  tick: function () {
    this.update();
    this.render();
    requestAnimationFrame(this.tick);
  },
  update: function () {
    this.updateCallbacks.forEach(function (callback) {
      callback();
    });
  },
  render: function () {
    this.renderer.render(this.scene, this.camera);
  },
  resize: function () {
    var width = window.innerWidth;
    var height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.resizeCallbacks.forEach(function (callback) {
      callback();
    });
  },
  initPostProcessing: function (passes) {
    var size = this.renderer.getSize();
    var pixelRatio = this.renderer.getPixelRatio();
    size.width *= pixelRatio;
    size.height *= pixelRatio;

    var composer = (this.composer = new THREE.EffectComposer(
      this.renderer,
      new THREE.WebGLRenderTarget(size.width, size.height, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        stencilBuffer: false,
      })
    ));

    var renderPass = new THREE.RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    for (var i = 0; i < passes.length; i++) {
      var pass = passes[i];
      pass.renderToScreen = i === passes.length - 1;
      this.composer.addPass(pass);
    }

    this.renderer.autoClear = false;
    this.render = function () {
      this.renderer.clear();
      this.composer.render();
    }.bind(this);

    this.addResizeCallback(
      function () {
        var width = window.innerWidth;
        var height = window.innerHeight;

        composer.setSize(width * pixelRatio, height * pixelRatio);
      }.bind(this)
    );
  },
};

//// UTILS

var utils = {
  extend: function (dst, src) {
    for (var key in src) {
      dst[key] = src[key];
    }

    return dst;
  },
  randSign: function () {
    return Math.random() > 0.5 ? 1 : -1;
  },
  ease: function (ease, t, b, c, d) {
    return b + ease.getRatio(t / d) * c;
  },
};

//// BAS

THREE.BAS = {};

THREE.BAS.ShaderChunk = {};

THREE.BAS.ShaderChunk["catmull-rom"] =
  "vec3 catmullRom(vec3 p0, vec3 p1, vec3 p2, vec3 p3, float t)\n{\n    vec3 v0 = (p2 - p0) * 0.5;\n    vec3 v1 = (p3 - p1) * 0.5;\n    float t2 = t * t;\n    float t3 = t * t * t;\n\n    return vec3((2.0 * p1 - 2.0 * p2 + v0 + v1) * t3 + (-3.0 * p1 + 3.0 * p2 - 2.0 * v0 - v1) * t2 + v0 * t + p1);\n}\n\nvec3 catmullRom(vec3 p0, vec3 p1, vec3 p2, vec3 p3, vec2 c, float t)\n{\n    vec3 v0 = (p2 - p0) * c.x;\n    vec3 v1 = (p3 - p1) * c.y;\n    float t2 = t * t;\n    float t3 = t * t * t;\n\n    return vec3((2.0 * p1 - 2.0 * p2 + v0 + v1) * t3 + (-3.0 * p1 + 3.0 * p2 - 2.0 * v0 - v1) * t2 + v0 * t + p1);\n}\n\nfloat catmullRom(float p0, float p1, float p2, float p3, float t)\n{\n    float v0 = (p2 - p0) * 0.5;\n    float v1 = (p3 - p1) * 0.5;\n    float t2 = t * t;\n    float t3 = t * t * t;\n\n    return float((2.0 * p1 - 2.0 * p2 + v0 + v1) * t3 + (-3.0 * p1 + 3.0 * p2 - 2.0 * v0 - v1) * t2 + v0 * t + p1);\n}\n\nfloat catmullRom(float p0, float p1, float p2, float p3, vec2 c, float t)\n{\n    float v0 = (p2 - p0) * c.x;\n    float v1 = (p3 - p1) * c.y;\n    float t2 = t * t;\n    float t3 = t * t * t;\n\n    return float((2.0 * p1 - 2.0 * p2 + v0 + v1) * t3 + (-3.0 * p1 + 3.0 * p2 - 2.0 * v0 - v1) * t2 + v0 * t + p1);\n}\n";

THREE.BAS.ShaderChunk["cubic_bezier"] =
  "vec3 cubicBezier(vec3 p0, vec3 c0, vec3 c1, vec3 p1, float t) {\n    float tn = 1.0 - t;\n\n    return tn * tn * tn * p0 + 3.0 * tn * tn * t * c0 + 3.0 * tn * t * t * c1 + t * t * t * p1;\n}\n\nvec2 cubicBezier(vec2 p0, vec2 c0, vec2 c1, vec2 p1, float t) {\n    float tn = 1.0 - t;\n\n    return tn * tn * tn * p0 + 3.0 * tn * tn * t * c0 + 3.0 * tn * t * t * c1 + t * t * t * p1;\n}\n";

THREE.BAS.ShaderChunk["ease_back_in"] =
  "float easeBackIn(float p, float amplitude) {\n    return p * p * ((amplitude + 1.0) * p - amplitude);\n}\n\nfloat easeBackIn(float p) {\n    return easeBackIn(p, 1.70158);\n}\n\nfloat easeBackIn(float t, float b, float c, float d, float amplitude) {\n    return b + easeBackIn(t / d, amplitude) * c;\n}\n\nfloat easeBackIn(float t, float b, float c, float d) {\n    return b + easeBackIn(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_back_in_out"] =
  "float easeBackInOut(float p, float amplitude) {\n    amplitude *= 1.525;\n\n    return ((p *= 2.0) < 1.0) ? 0.5 * p * p * ((amplitude + 1.0) * p - amplitude) : 0.5 * ((p -= 2.0) * p * ((amplitude + 1.0) * p + amplitude) + 2.0);\n}\n\nfloat easeBackInOut(float p) {\n    return easeBackInOut(p, 1.70158);\n}\n\nfloat easeBackInOut(float t, float b, float c, float d, float amplitude) {\n    return b + easeBackInOut(t / d, amplitude) * c;\n}\n\nfloat easeBackInOut(float t, float b, float c, float d) {\n    return b + easeBackInOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_back_out"] =
  "float easeBackOut(float p, float amplitude) {\n    return ((p = p - 1.0) * p * ((amplitude + 1.0) * p + amplitude) + 1.0);\n}\n\nfloat easeBackOut(float p) {\n    return easeBackOut(p, 1.70158);\n}\n\nfloat easeBackOut(float t, float b, float c, float d, float amplitude) {\n    return b + easeBackOut(t / d, amplitude) * c;\n}\n\nfloat easeBackOut(float t, float b, float c, float d) {\n    return b + easeBackOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_bezier"] =
  "float easeBezier(float p, vec4 curve) {\n    float ip = 1.0 - p;\n    return (3.0 * ip * ip * p * curve.xy + 3.0 * ip * p * p * curve.zw + p * p * p).y;\n}\n\nfloat easeBezier(float t, float b, float c, float d, vec4 curve) {\n    return b + easeBezier(t / d, curve) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_bounce_in"] =
  "float easeBounceIn(float p) {\n    if ((p = 1.0 - p) < 1.0 / 2.75) {\n        return 1.0 - (7.5625 * p * p);\n    } else if (p < 2.0 / 2.75) {\n        return 1.0 - (7.5625 * (p -= 1.5 / 2.75) * p + 0.75);\n    } else if (p < 2.5 / 2.75) {\n        return 1.0 - (7.5625 * (p -= 2.25 / 2.75) * p + 0.9375);\n    }\n    return 1.0 - (7.5625 * (p -= 2.625 / 2.75) * p + 0.984375);\n}\n\nfloat easeBounceIn(float t, float b, float c, float d) {\n    return b + easeBounceIn(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_bounce_in_out"] =
  "float easeBounceInOut(float p) {\n    bool invert = (p < 0.5);\n\n    p = invert ? (1.0 - (p * 2.0)) : ((p * 2.0) - 1.0);\n\n    if (p < 1.0 / 2.75) {\n        p = 7.5625 * p * p;\n    } else if (p < 2.0 / 2.75) {\n        p = 7.5625 * (p -= 1.5 / 2.75) * p + 0.75;\n    } else if (p < 2.5 / 2.75) {\n        p = 7.5625 * (p -= 2.25 / 2.75) * p + 0.9375;\n    } else {\n        p = 7.5625 * (p -= 2.625 / 2.75) * p + 0.984375;\n    }\n\n    return invert ? (1.0 - p) * 0.5 : p * 0.5 + 0.5;\n}\n\nfloat easeBounceInOut(float t, float b, float c, float d) {\n    return b + easeBounceInOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_bounce_out"] =
  "float easeBounceOut(float p) {\n    if (p < 1.0 / 2.75) {\n        return 7.5625 * p * p;\n    } else if (p < 2.0 / 2.75) {\n        return 7.5625 * (p -= 1.5 / 2.75) * p + 0.75;\n    } else if (p < 2.5 / 2.75) {\n        return 7.5625 * (p -= 2.25 / 2.75) * p + 0.9375;\n    }\n    return 7.5625 * (p -= 2.625 / 2.75) * p + 0.984375;\n}\n\nfloat easeBounceOut(float t, float b, float c, float d) {\n    return b + easeBounceOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_circ_in"] =
  "float easeCircIn(float p) {\n    return -(sqrt(1.0 - p * p) - 1.0);\n}\n\nfloat easeCircIn(float t, float b, float c, float d) {\n    return b + easeCircIn(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_circ_in_out"] =
  "float easeCircInOut(float p) {\n    return ((p *= 2.0) < 1.0) ? -0.5 * (sqrt(1.0 - p * p) - 1.0) : 0.5 * (sqrt(1.0 - (p -= 2.0) * p) + 1.0);\n}\n\nfloat easeCircInOut(float t, float b, float c, float d) {\n    return b + easeCircInOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_circ_out"] =
  "float easeCircOut(float p) {\n  return sqrt(1.0 - (p = p - 1.0) * p);\n}\n\nfloat easeCircOut(float t, float b, float c, float d) {\n  return b + easeCircOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_cubic_in"] =
  "float easeCubicIn(float t) {\n  return t * t * t;\n}\n\nfloat easeCubicIn(float t, float b, float c, float d) {\n  return b + easeCubicIn(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_cubic_in_out"] =
  "float easeCubicInOut(float t) {\n  return (t /= 0.5) < 1.0 ? 0.5 * t * t * t : 0.5 * ((t-=2.0) * t * t + 2.0);\n}\n\nfloat easeCubicInOut(float t, float b, float c, float d) {\n  return b + easeCubicInOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_cubic_out"] =
  "float easeCubicOut(float t) {\n  float f = t - 1.0;\n  return f * f * f + 1.0;\n}\n\nfloat easeCubicOut(float t, float b, float c, float d) {\n  return b + easeCubicOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_elastic_in"] =
  "float easeElasticIn(float p, float amplitude, float period) {\n    float p1 = max(amplitude, 1.0);\n    float p2 = period / min(amplitude, 1.0);\n    float p3 = p2 / PI2 * (asin(1.0 / p1));\n\n    return -(p1 * pow(2.0, 10.0 * (p -= 1.0)) * sin((p - p3) * PI2 / p2));\n}\n\nfloat easeElasticIn(float p) {\n    return easeElasticIn(p, 1.0, 0.3);\n}\n\nfloat easeElasticIn(float t, float b, float c, float d, float amplitude, float period) {\n    return b + easeElasticIn(t / d, amplitude, period) * c;\n}\n\nfloat easeElasticIn(float t, float b, float c, float d) {\n    return b + easeElasticIn(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_elastic_in_out"] =
  "float easeElasticInOut(float p, float amplitude, float period) {\n    float p1 = max(amplitude, 1.0);\n    float p2 = period / min(amplitude, 1.0);\n    float p3 = p2 / PI2 * (asin(1.0 / p1));\n\n    return ((p *= 2.0) < 1.0) ? -0.5 * (p1 * pow(2.0, 10.0 * (p -= 1.0)) * sin((p - p3) * PI2 / p2)) : p1 * pow(2.0, -10.0 * (p -= 1.0)) * sin((p - p3) * PI2 / p2) * 0.5 + 1.0;\n}\n\nfloat easeElasticInOut(float p) {\n    return easeElasticInOut(p, 1.0, 0.3);\n}\n\nfloat easeElasticInOut(float t, float b, float c, float d, float amplitude, float period) {\n    return b + easeElasticInOut(t / d, amplitude, period) * c;\n}\n\nfloat easeElasticInOut(float t, float b, float c, float d) {\n    return b + easeElasticInOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_elastic_out"] =
  "float easeElasticOut(float p, float amplitude, float period) {\n    float p1 = max(amplitude, 1.0);\n    float p2 = period / min(amplitude, 1.0);\n    float p3 = p2 / PI2 * (asin(1.0 / p1));\n\n    return p1 * pow(2.0, -10.0 * p) * sin((p - p3) * PI2 / p2) + 1.0;\n}\n\nfloat easeElasticOut(float p) {\n    return easeElasticOut(p, 1.0, 0.3);\n}\n\nfloat easeElasticOut(float t, float b, float c, float d, float amplitude, float period) {\n    return b + easeElasticOut(t / d, amplitude, period) * c;\n}\n\nfloat easeElasticOut(float t, float b, float c, float d) {\n    return b + easeElasticOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_expo_in"] =
  "float easeExpoIn(float p) {\n    return pow(2.0, 10.0 * (p - 1.0));\n}\n\nfloat easeExpoIn(float t, float b, float c, float d) {\n    return b + easeExpoIn(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_expo_in_out"] =
  "float easeExpoInOut(float p) {\n    return ((p *= 2.0) < 1.0) ? 0.5 * pow(2.0, 10.0 * (p - 1.0)) : 0.5 * (2.0 - pow(2.0, -10.0 * (p - 1.0)));\n}\n\nfloat easeExpoInOut(float t, float b, float c, float d) {\n    return b + easeExpoInOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_expo_out"] =
  "float easeExpoOut(float p) {\n  return 1.0 - pow(2.0, -10.0 * p);\n}\n\nfloat easeExpoOut(float t, float b, float c, float d) {\n  return b + easeExpoOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_quad_in"] =
  "float easeQuadIn(float t) {\n    return t * t;\n}\n\nfloat easeQuadIn(float t, float b, float c, float d) {\n  return b + easeQuadIn(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_quad_in_out"] =
  "float easeQuadInOut(float t) {\n    float p = 2.0 * t * t;\n    return t < 0.5 ? p : -p + (4.0 * t) - 1.0;\n}\n\nfloat easeQuadInOut(float t, float b, float c, float d) {\n    return b + easeQuadInOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_quad_out"] =
  "float easeQuadOut(float t) {\n  return -t * (t - 2.0);\n}\n\nfloat easeQuadOut(float t, float b, float c, float d) {\n  return b + easeQuadOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_quart_in"] =
  "float easeQuartIn(float t) {\n  return t * t * t * t;\n}\n\nfloat easeQuartIn(float t, float b, float c, float d) {\n  return b + easeQuartIn(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_quart_in_out"] =
  "float easeQuartInOut(float t) {\n    return t < 0.5 ? 8.0 * pow(t, 4.0) : -8.0 * pow(t - 1.0, 4.0) + 1.0;\n}\n\nfloat easeQuartInOut(float t, float b, float c, float d) {\n    return b + easeQuartInOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_quart_out"] =
  "float easeQuartOut(float t) {\n  return 1.0 - pow(1.0 - t, 4.0);\n}\n\nfloat easeQuartOut(float t, float b, float c, float d) {\n  return b + easeQuartOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_quint_in"] =
  "float easeQuintIn(float t) {\n    return pow(t, 5.0);\n}\n\nfloat easeQuintIn(float t, float b, float c, float d) {\n    return b + easeQuintIn(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_quint_in_out"] =
  "float easeQuintInOut(float t) {\n    return (t /= 0.5) < 1.0 ? 0.5 * t * t * t * t * t : 0.5 * ((t -= 2.0) * t * t * t * t + 2.0);\n}\n\nfloat easeQuintInOut(float t, float b, float c, float d) {\n    return b + easeQuintInOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_quint_out"] =
  "float easeQuintOut(float t) {\n    return (t -= 1.0) * t * t * t * t + 1.0;\n}\n\nfloat easeQuintOut(float t, float b, float c, float d) {\n    return b + easeQuintOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_sine_in"] =
  "float easeSineIn(float p) {\n  return -cos(p * 1.57079632679) + 1.0;\n}\n\nfloat easeSineIn(float t, float b, float c, float d) {\n  return b + easeSineIn(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_sine_in_out"] =
  "float easeSineInOut(float p) {\n  return -0.5 * (cos(PI * p) - 1.0);\n}\n\nfloat easeSineInOut(float t, float b, float c, float d) {\n  return b + easeSineInOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["ease_sine_out"] =
  "float easeSineOut(float p) {\n  return sin(p * 1.57079632679);\n}\n\nfloat easeSineOut(float t, float b, float c, float d) {\n  return b + easeSineOut(t / d) * c;\n}\n";

THREE.BAS.ShaderChunk["quaternion_rotation"] =
  "vec3 rotateVector(vec4 q, vec3 v)\n{\n    return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);\n}\n\nvec4 quatFromAxisAngle(vec3 axis, float angle)\n{\n    float halfAngle = angle * 0.5;\n    return vec4(axis.xyz * sin(halfAngle), cos(halfAngle));\n}\n";

THREE.BAS.Utils = {
  separateFaces: function (geometry) {
    var vertices = [];

    for (var i = 0, il = geometry.faces.length; i < il; i++) {
      var n = vertices.length;

      var face = geometry.faces[i];

      var a = face.a;
      var b = face.b;
      var c = face.c;

      var va = geometry.vertices[a];
      var vb = geometry.vertices[b];
      var vc = geometry.vertices[c];

      vertices.push(va.clone());
      vertices.push(vb.clone());
      vertices.push(vc.clone());

      face.a = n;
      face.b = n + 1;
      face.c = n + 2;
    }

    geometry.vertices = vertices;
    delete geometry.__tmpVertices;
  },
  tessellate: function (geometry, maxEdgeLength) {
    var edge;

    var faces = [];
    var faceVertexUvs = [];
    var maxEdgeLengthSquared = maxEdgeLength * maxEdgeLength;

    for (var i = 0, il = geometry.faceVertexUvs.length; i < il; i++) {
      faceVertexUvs[i] = [];
    }

    for (var i = 0, il = geometry.faces.length; i < il; i++) {
      var face = geometry.faces[i];

      if (face instanceof THREE.Face3) {
        var a = face.a;
        var b = face.b;
        var c = face.c;

        var va = geometry.vertices[a];
        var vb = geometry.vertices[b];
        var vc = geometry.vertices[c];

        var dab = va.distanceToSquared(vb);
        var dbc = vb.distanceToSquared(vc);
        var dac = va.distanceToSquared(vc);

        if (
          dab > maxEdgeLengthSquared ||
          dbc > maxEdgeLengthSquared ||
          dac > maxEdgeLengthSquared
        ) {
          var m = geometry.vertices.length;

          var triA = face.clone();
          var triB = face.clone();

          if (dab >= dbc && dab >= dac) {
            var vm = va.clone();
            vm.lerp(vb, 0.5);

            triA.a = a;
            triA.b = m;
            triA.c = c;

            triB.a = m;
            triB.b = b;
            triB.c = c;

            if (face.vertexNormals.length === 3) {
              var vnm = face.vertexNormals[0].clone();
              vnm.lerp(face.vertexNormals[1], 0.5);

              triA.vertexNormals[1].copy(vnm);
              triB.vertexNormals[0].copy(vnm);
            }

            if (face.vertexColors.length === 3) {
              var vcm = face.vertexColors[0].clone();
              vcm.lerp(face.vertexColors[1], 0.5);

              triA.vertexColors[1].copy(vcm);
              triB.vertexColors[0].copy(vcm);
            }

            edge = 0;
          } else if (dbc >= dab && dbc >= dac) {
            var vm = vb.clone();
            vm.lerp(vc, 0.5);

            triA.a = a;
            triA.b = b;
            triA.c = m;

            triB.a = m;
            triB.b = c;
            triB.c = a;

            if (face.vertexNormals.length === 3) {
              var vnm = face.vertexNormals[1].clone();
              vnm.lerp(face.vertexNormals[2], 0.5);

              triA.vertexNormals[2].copy(vnm);

              triB.vertexNormals[0].copy(vnm);
              triB.vertexNormals[1].copy(face.vertexNormals[2]);
              triB.vertexNormals[2].copy(face.vertexNormals[0]);
            }

            if (face.vertexColors.length === 3) {
              var vcm = face.vertexColors[1].clone();
              vcm.lerp(face.vertexColors[2], 0.5);

              triA.vertexColors[2].copy(vcm);

              triB.vertexColors[0].copy(vcm);
              triB.vertexColors[1].copy(face.vertexColors[2]);
              triB.vertexColors[2].copy(face.vertexColors[0]);
            }

            edge = 1;
          } else {
            var vm = va.clone();
            vm.lerp(vc, 0.5);

            triA.a = a;
            triA.b = b;
            triA.c = m;

            triB.a = m;
            triB.b = b;
            triB.c = c;

            if (face.vertexNormals.length === 3) {
              var vnm = face.vertexNormals[0].clone();
              vnm.lerp(face.vertexNormals[2], 0.5);

              triA.vertexNormals[2].copy(vnm);
              triB.vertexNormals[0].copy(vnm);
            }

            if (face.vertexColors.length === 3) {
              var vcm = face.vertexColors[0].clone();
              vcm.lerp(face.vertexColors[2], 0.5);

              triA.vertexColors[2].copy(vcm);
              triB.vertexColors[0].copy(vcm);
            }

            edge = 2;
          }

          faces.push(triA, triB);
          geometry.vertices.push(vm);

          for (var j = 0, jl = geometry.faceVertexUvs.length; j < jl; j++) {
            if (geometry.faceVertexUvs[j].length) {
              var uvs = geometry.faceVertexUvs[j][i];

              var uvA = uvs[0];
              var uvB = uvs[1];
              var uvC = uvs[2];

              // AB

              if (edge === 0) {
                var uvM = uvA.clone();
                uvM.lerp(uvB, 0.5);

                var uvsTriA = [uvA.clone(), uvM.clone(), uvC.clone()];
                var uvsTriB = [uvM.clone(), uvB.clone(), uvC.clone()];

                // BC
              } else if (edge === 1) {
                var uvM = uvB.clone();
                uvM.lerp(uvC, 0.5);

                var uvsTriA = [uvA.clone(), uvB.clone(), uvM.clone()];
                var uvsTriB = [uvM.clone(), uvC.clone(), uvA.clone()];

                // AC
              } else {
                var uvM = uvA.clone();
                uvM.lerp(uvC, 0.5);

                var uvsTriA = [uvA.clone(), uvB.clone(), uvM.clone()];
                var uvsTriB = [uvM.clone(), uvB.clone(), uvC.clone()];
              }

              faceVertexUvs[j].push(uvsTriA, uvsTriB);
            }
          }
        } else {
          faces.push(face);

          for (var j = 0, jl = geometry.faceVertexUvs.length; j < jl; j++) {
            faceVertexUvs[j].push(geometry.faceVertexUvs[j][i]);
          }
        }
      }
    }

    geometry.faces = faces;
    geometry.faceVertexUvs = faceVertexUvs;
  },
  tessellateRepeat: function (geometry, maxEdgeLength, times) {
    for (var i = 0; i < times; i++) {
      THREE.BAS.Utils.tessellate(geometry, maxEdgeLength);
    }
  },
  subdivide: function (geometry, subdivisions) {
    var WARNINGS = !true; // Set to true for development
    var ABC = ["a", "b", "c"];

    while (subdivisions-- > 0) {
      smooth(geometry);
    }

    delete geometry.__tmpVertices;
    geometry.computeFaceNormals();
    geometry.computeVertexNormals();

    function getEdge(a, b, map) {
      var vertexIndexA = Math.min(a, b);
      var vertexIndexB = Math.max(a, b);

      var key = vertexIndexA + "_" + vertexIndexB;

      return map[key];
    }

    function processEdge(a, b, vertices, map, face, metaVertices) {
      var vertexIndexA = Math.min(a, b);
      var vertexIndexB = Math.max(a, b);

      var key = vertexIndexA + "_" + vertexIndexB;

      var edge;

      if (key in map) {
        edge = map[key];
      } else {
        var vertexA = vertices[vertexIndexA];
        var vertexB = vertices[vertexIndexB];

        edge = {
          a: vertexA, // pointer reference
          b: vertexB,
          newEdge: null,
          // aIndex: a, // numbered reference
          // bIndex: b,
          faces: [], // pointers to face
        };

        map[key] = edge;
      }

      edge.faces.push(face);

      metaVertices[a].edges.push(edge);
      metaVertices[b].edges.push(edge);
    }

    function generateLookups(vertices, faces, metaVertices, edges) {
      var i, il, face, edge;

      for (i = 0, il = vertices.length; i < il; i++) {
        metaVertices[i] = { edges: [] };
      }

      for (i = 0, il = faces.length; i < il; i++) {
        face = faces[i];

        processEdge(face.a, face.b, vertices, edges, face, metaVertices);
        processEdge(face.b, face.c, vertices, edges, face, metaVertices);
        processEdge(face.c, face.a, vertices, edges, face, metaVertices);
      }
    }

    function newFace(newFaces, a, b, c) {
      newFaces.push(new THREE.Face3(a, b, c));
    }

    /////////////////////////////

    // Performs one iteration of Subdivision
    function smooth(geometry) {
      var tmp = new THREE.Vector3();

      var oldVertices, oldFaces;
      var newVertices, newFaces; // newUVs = [];

      var n, l, i, il, j, k;
      var metaVertices, sourceEdges;

      // new stuff.
      var sourceEdges, newEdgeVertices, newSourceVertices;

      oldVertices = geometry.vertices; // { x, y, z}
      oldFaces = geometry.faces; // { a: oldVertex1, b: oldVertex2, c: oldVertex3 }

      /******************************************************
       *
       * Step 0: Preprocess Geometry to Generate edges Lookup
       *
       *******************************************************/

      metaVertices = new Array(oldVertices.length);
      sourceEdges = {}; // Edge => { oldVertex1, oldVertex2, faces[]  }

      generateLookups(oldVertices, oldFaces, metaVertices, sourceEdges);

      /******************************************************
       *
       *  Step 1.
       *  For each edge, create a new Edge Vertex,
       *  then position it.
       *
       *******************************************************/

      newEdgeVertices = [];
      var other, currentEdge, newEdge, face;
      var edgeVertexWeight, adjacentVertexWeight, connectedFaces;

      for (i in sourceEdges) {
        currentEdge = sourceEdges[i];
        newEdge = new THREE.Vector3();

        edgeVertexWeight = 3 / 8;
        adjacentVertexWeight = 1 / 8;

        connectedFaces = currentEdge.faces.length;

        // check how many linked faces. 2 should be correct.
        if (connectedFaces != 2) {
          // if length is not 2, handle condition
          edgeVertexWeight = 0.5;
          adjacentVertexWeight = 0;

          if (connectedFaces != 1) {
            if (WARNINGS)
              console.warn(
                "Subdivision Modifier: Number of connected faces != 2, is: ",
                connectedFaces,
                currentEdge
              );
          }
        }

        newEdge
          .addVectors(currentEdge.a, currentEdge.b)
          .multiplyScalar(edgeVertexWeight);

        tmp.set(0, 0, 0);

        for (j = 0; j < connectedFaces; j++) {
          face = currentEdge.faces[j];

          for (k = 0; k < 3; k++) {
            other = oldVertices[face[ABC[k]]];
            if (other !== currentEdge.a && other !== currentEdge.b) break;
          }

          tmp.add(other);
        }

        tmp.multiplyScalar(adjacentVertexWeight);
        newEdge.add(tmp);

        currentEdge.newEdge = newEdgeVertices.length;
        newEdgeVertices.push(newEdge);

        // console.log(currentEdge, newEdge);
      }

      /******************************************************
       *
       *  Step 2.
       *  Reposition each source vertices.
       *
       *******************************************************/

      var beta, sourceVertexWeight, connectingVertexWeight;
      var connectingEdge, connectingEdges, oldVertex, newSourceVertex;
      newSourceVertices = [];

      for (i = 0, il = oldVertices.length; i < il; i++) {
        oldVertex = oldVertices[i];

        // find all connecting edges (using lookupTable)
        connectingEdges = metaVertices[i].edges;
        n = connectingEdges.length;
        beta;

        if (n == 3) {
          beta = 3 / 16;
        } else if (n > 3) {
          beta = 3 / (8 * n); // Warren's modified formula
        }

        // Loop's original beta formula
        // beta = 1 / n * ( 5/8 - Math.pow( 3/8 + 1/4 * Math.cos( 2 * Math. PI / n ), 2) );

        sourceVertexWeight = 1 - n * beta;
        connectingVertexWeight = beta;

        if (n <= 2) {
          // crease and boundary rules
          // console.warn('crease and boundary rules');

          if (n == 2) {
            if (WARNINGS) console.warn("2 connecting edges", connectingEdges);
            sourceVertexWeight = 3 / 4;
            connectingVertexWeight = 1 / 8;

            // sourceVertexWeight = 1;
            // connectingVertexWeight = 0;
          } else if (n == 1) {
            if (WARNINGS) console.warn("only 1 connecting edge");
          } else if (n == 0) {
            if (WARNINGS) console.warn("0 connecting edges");
          }
        }

        newSourceVertex = oldVertex.clone().multiplyScalar(sourceVertexWeight);

        tmp.set(0, 0, 0);

        for (j = 0; j < n; j++) {
          connectingEdge = connectingEdges[j];
          other =
            connectingEdge.a !== oldVertex
              ? connectingEdge.a
              : connectingEdge.b;
          tmp.add(other);
        }

        tmp.multiplyScalar(connectingVertexWeight);
        newSourceVertex.add(tmp);

        newSourceVertices.push(newSourceVertex);
      }

      /******************************************************
       *
       *  Step 3.
       *  Generate Faces between source vertecies
       *  and edge vertices.
       *
       *******************************************************/

      newVertices = newSourceVertices.concat(newEdgeVertices);
      var sl = newSourceVertices.length,
        edge1,
        edge2,
        edge3;
      newFaces = [];

      for (i = 0, il = oldFaces.length; i < il; i++) {
        face = oldFaces[i];

        // find the 3 new edges vertex of each old face

        edge1 = getEdge(face.a, face.b, sourceEdges).newEdge + sl;
        edge2 = getEdge(face.b, face.c, sourceEdges).newEdge + sl;
        edge3 = getEdge(face.c, face.a, sourceEdges).newEdge + sl;

        // create 4 faces.

        newFace(newFaces, edge1, edge2, edge3);
        newFace(newFaces, face.a, edge1, edge3);
        newFace(newFaces, face.b, edge2, edge1);
        newFace(newFaces, face.c, edge3, edge2);
      }

      // Overwrite old arrays
      geometry.vertices = newVertices;
      geometry.faces = newFaces;

      // console.log('done');
    }
  },

  computeCentroid: (function () {
    var v = new THREE.Vector3();

    return function (geometry, face) {
      var a = geometry.vertices[face.a],
        b = geometry.vertices[face.b],
        c = geometry.vertices[face.c];

      v.x = (a.x + b.x + c.x) / 3;
      v.y = (a.y + b.y + c.y) / 3;
      v.z = (a.z + b.z + c.z) / 3;

      return v;
    };
  })(),

  createDepthAnimationMaterial: function (sourceMaterial) {
    // todo morph & skinning support
    return new THREE.BAS.DepthAnimationMaterial({
      uniforms: sourceMaterial.uniforms,
      vertexFunctions: sourceMaterial.vertexFunctions,
      vertexParameters: sourceMaterial.vertexParameters,
      vertexInit: sourceMaterial.vertexInit,
      vertexPosition: sourceMaterial.vertexPosition,
    });
  },

  createDistanceAnimationMaterial: function (sourceMaterial) {
    // todo morph & skinning support
    return new THREE.BAS.DistanceAnimationMaterial({
      uniforms: sourceMaterial.uniforms,
      vertexFunctions: sourceMaterial.vertexFunctions,
      vertexParameters: sourceMaterial.vertexParameters,
      vertexInit: sourceMaterial.vertexInit,
      vertexPosition: sourceMaterial.vertexPosition,
    });
  },
};
THREE.BAS.ModelBufferGeometry = function (model) {
  THREE.BufferGeometry.call(this);

  this.modelGeometry = model;
  this.faceCount = this.modelGeometry.faces.length;
  this.vertexCount = this.modelGeometry.vertices.length;

  this.bufferIndices();
  this.bufferPositions();
};
THREE.BAS.ModelBufferGeometry.prototype = Object.create(
  THREE.BufferGeometry.prototype
);
THREE.BAS.ModelBufferGeometry.prototype.constructor =
  THREE.BAS.ModelBufferGeometry;

THREE.BAS.ModelBufferGeometry.prototype.bufferIndices = function () {
  var indexBuffer = new Uint32Array(this.faceCount * 3);

  this.setIndex(new THREE.BufferAttribute(indexBuffer, 1));

  for (var i = 0, offset = 0; i < this.faceCount; i++, offset += 3) {
    var face = this.modelGeometry.faces[i];

    indexBuffer[offset] = face.a;
    indexBuffer[offset + 1] = face.b;
    indexBuffer[offset + 2] = face.c;
  }
};

THREE.BAS.ModelBufferGeometry.prototype.bufferPositions = function () {
  var positionBuffer = this.createAttribute("position", 3).array;

  for (var i = 0, offset = 0; i < this.vertexCount; i++, offset += 3) {
    var vertex = this.modelGeometry.vertices[i];

    positionBuffer[offset] = vertex.x;
    positionBuffer[offset + 1] = vertex.y;
    positionBuffer[offset + 2] = vertex.z;
  }
};

THREE.BAS.ModelBufferGeometry.prototype.bufferUVs = function () {
  var uvBuffer = this.createAttribute("uv", 2).array;

  for (var i = 0; i < this.faceCount; i++) {
    var face = this.modelGeometry.faces[i];
    var uv;

    uv = this.modelGeometry.faceVertexUvs[0][i][0];
    uvBuffer[face.a * 2] = uv.x;
    uvBuffer[face.a * 2 + 1] = uv.y;

    uv = this.modelGeometry.faceVertexUvs[0][i][1];
    uvBuffer[face.b * 2] = uv.x;
    uvBuffer[face.b * 2 + 1] = uv.y;

    uv = this.modelGeometry.faceVertexUvs[0][i][2];
    uvBuffer[face.c * 2] = uv.x;
    uvBuffer[face.c * 2 + 1] = uv.y;
  }
};

THREE.BAS.ModelBufferGeometry.prototype.createAttribute = function (
  name,
  itemSize
) {
  var buffer = new Float32Array(this.vertexCount * itemSize);
  var attribute = new THREE.BufferAttribute(buffer, itemSize);

  this.addAttribute(name, attribute);

  return attribute;
};

/**
 * A THREE.BufferGeometry where a 'prefab' geometry is repeated a number of times
 * @param prefab the THREE.Geometry instance to repeat
 * @param count the number of times to repeat it
 * @constructor
 */
THREE.BAS.PrefabBufferGeometry = function (prefab, count) {
  THREE.BufferGeometry.call(this);

  this.prefabGeometry = prefab;
  this.prefabCount = count;
  this.prefabVertexCount = prefab.vertices.length;

  this.bufferIndices();
  this.bufferPositions();
};
THREE.BAS.PrefabBufferGeometry.prototype = Object.create(
  THREE.BufferGeometry.prototype
);
THREE.BAS.PrefabBufferGeometry.prototype.constructor =
  THREE.BAS.PrefabBufferGeometry;

THREE.BAS.PrefabBufferGeometry.prototype.bufferIndices = function () {
  var prefabFaceCount = this.prefabGeometry.faces.length;
  var prefabIndexCount = this.prefabGeometry.faces.length * 3;
  var prefabIndices = [];

  for (var h = 0; h < prefabFaceCount; h++) {
    var face = this.prefabGeometry.faces[h];
    prefabIndices.push(face.a, face.b, face.c);
  }

  var indexBuffer = new Uint32Array(this.prefabCount * prefabIndexCount);

  this.setIndex(new THREE.BufferAttribute(indexBuffer, 1));

  for (var i = 0; i < this.prefabCount; i++) {
    for (var k = 0; k < prefabIndexCount; k++) {
      indexBuffer[i * prefabIndexCount + k] =
        prefabIndices[k] + i * this.prefabVertexCount;
    }
  }
};

THREE.BAS.PrefabBufferGeometry.prototype.bufferPositions = function () {
  var positionBuffer = this.createAttribute("position", 3).array;

  for (var i = 0, offset = 0; i < this.prefabCount; i++) {
    for (var j = 0; j < this.prefabVertexCount; j++, offset += 3) {
      var prefabVertex = this.prefabGeometry.vertices[j];

      positionBuffer[offset] = prefabVertex.x;
      positionBuffer[offset + 1] = prefabVertex.y;
      positionBuffer[offset + 2] = prefabVertex.z;
    }
  }
};

// todo test
THREE.BAS.PrefabBufferGeometry.prototype.bufferUvs = function () {
  var prefabFaceCount = this.prefabGeometry.faces.length;
  var prefabVertexCount = (this.prefabVertexCount =
    this.prefabGeometry.vertices.length);
  var prefabUvs = [];

  for (var h = 0; h < prefabFaceCount; h++) {
    var face = this.prefabGeometry.faces[h];
    var uv = this.prefabGeometry.faceVertexUvs[0][h];

    prefabUvs[face.a] = uv[0];
    prefabUvs[face.b] = uv[1];
    prefabUvs[face.c] = uv[2];
  }

  var uvBuffer = this.createAttribute("uv", 2);

  for (var i = 0, offset = 0; i < this.prefabCount; i++) {
    for (var j = 0; j < prefabVertexCount; j++, offset += 2) {
      var prefabUv = prefabUvs[j];

      uvBuffer.array[offset] = prefabUv.x;
      uvBuffer.array[offset + 1] = prefabUv.y;
    }
  }
};

THREE.BAS.PrefabBufferGeometry.prototype.createAttribute = function (
  name,
  itemSize,
  factory
) {
  var buffer = new Float32Array(
    this.prefabCount * this.prefabVertexCount * itemSize
  );
  var attribute = new THREE.BufferAttribute(buffer, itemSize);

  this.addAttribute(name, attribute);

  if (factory) {
    var data = [];

    for (var i = 0; i < this.prefabCount; i++) {
      this.setPrefabData(attribute, i, factory(data, i, this.prefabCount));
    }
  }

  return attribute;
};

/**
 * Copy data for all vertices of the prefab
 * usually called in a loop
 * @param attribute The attribute or attribute name where data is to be stored.
 * @param prefabIndex Index of the prefab in the buffer geometry.
 * @param data Array of data. Length should be equal to item size of the attribute.
 */
THREE.BAS.PrefabBufferGeometry.prototype.setPrefabData = function (
  attribute,
  prefabIndex,
  data
) {
  attribute =
    typeof attribute === "string" ? this.attributes[attribute] : attribute;

  var offset = prefabIndex * this.prefabVertexCount * attribute.itemSize;

  for (var i = 0; i < this.prefabVertexCount; i++) {
    for (var j = 0; j < attribute.itemSize; j++) {
      attribute.array[offset++] = data[j];
    }
  }
};

THREE.BAS.BaseAnimationMaterial = function (parameters, uniformValues) {
  THREE.ShaderMaterial.call(this);

  this.setValues(parameters);

  // todo add missing default defines

  if (uniformValues) {
    uniformValues.map && (this.defines["USE_MAP"] = "");
    uniformValues.normalMap && (this.defines["USE_NORMALMAP"] = "");
    uniformValues.envMap && (this.defines["USE_ENVMAP"] = "");

    if (uniformValues.envMap) {
      this.defines["USE_ENVMAP"] = "";

      var envMapTypeDefine = "ENVMAP_TYPE_CUBE";
      var envMapModeDefine = "ENVMAP_MODE_REFLECTION";
      var envMapBlendingDefine = "ENVMAP_BLENDING_MULTIPLY";

      switch (uniformValues.envMap.mapping) {
        case THREE.CubeReflectionMapping:
        case THREE.CubeRefractionMapping:
          envMapTypeDefine = "ENVMAP_TYPE_CUBE";
          break;
        case THREE.CubeUVReflectionMapping:
        case THREE.CubeUVRefractionMapping:
          envMapTypeDefine = "ENVMAP_TYPE_CUBE_UV";
          break;
        case THREE.EquirectangularReflectionMapping:
        case THREE.EquirectangularRefractionMapping:
          envMapTypeDefine = "ENVMAP_TYPE_EQUIREC";
          break;
        case THREE.SphericalReflectionMapping:
          envMapTypeDefine = "ENVMAP_TYPE_SPHERE";
          break;
      }

      switch (uniformValues.envMap.mapping) {
        case THREE.CubeRefractionMapping:
        case THREE.EquirectangularRefractionMapping:
          envMapModeDefine = "ENVMAP_MODE_REFRACTION";
          break;
      }

      switch (uniformValues.combine) {
        case THREE.MixOperation:
          envMapBlendingDefine = "ENVMAP_BLENDING_MIX";
          break;
        case THREE.AddOperation:
          envMapBlendingDefine = "ENVMAP_BLENDING_ADD";
          break;
        case THREE.MultiplyOperation:
        default:
          envMapBlendingDefine = "ENVMAP_BLENDING_MULTIPLY";
          break;
      }

      this.defines[envMapTypeDefine] = "";
      this.defines[envMapBlendingDefine] = "";
      this.defines[envMapModeDefine] = "";
    }
  }
};
THREE.BAS.BaseAnimationMaterial.prototype = Object.create(
  THREE.ShaderMaterial.prototype
);
THREE.BAS.BaseAnimationMaterial.prototype.constructor =
  THREE.BAS.BaseAnimationMaterial;

THREE.BAS.BaseAnimationMaterial.prototype.setUniformValues = function (values) {
  for (var key in values) {
    if (key in this.uniforms) {
      var uniform = this.uniforms[key];
      var value = values[key];

      // todo add matrix uniform types?
      switch (uniform.type) {
        case "c": // color
          uniform.value.set(value);
          break;
        case "v2": // vectors
        case "v3":
        case "v4":
          uniform.value.copy(value);
          break;
        case "f": // float
        case "t": // texture
        default:
          uniform.value = value;
      }
    }
  }
};

THREE.BAS.BaseAnimationMaterial.prototype._stringifyChunk = function (name) {
  return this[name] ? this[name].join("\n") : "";
};

THREE.BAS.BasicAnimationMaterial = function (parameters, uniformValues) {
  this.varyingParameters = [];

  this.vertexFunctions = [];
  this.vertexParameters = [];
  this.vertexInit = [];
  this.vertexNormal = [];
  this.vertexPosition = [];
  this.vertexColor = [];

  this.fragmentFunctions = [];
  this.fragmentParameters = [];
  this.fragmentInit = [];
  this.fragmentMap = [];
  this.fragmentAlpha = [];

  THREE.BAS.BaseAnimationMaterial.call(this, parameters, uniformValues);

  var basicShader = THREE.ShaderLib["basic"];

  this.uniforms = THREE.UniformsUtils.merge([
    basicShader.uniforms,
    this.uniforms,
  ]);
  this.lights = false;
  this.vertexShader = this._concatVertexShader();
  this.fragmentShader = this._concatFragmentShader();

  this.setUniformValues(uniformValues);
};
THREE.BAS.BasicAnimationMaterial.prototype = Object.create(
  THREE.BAS.BaseAnimationMaterial.prototype
);
THREE.BAS.BasicAnimationMaterial.prototype.constructor =
  THREE.BAS.BasicAnimationMaterial;

THREE.BAS.BasicAnimationMaterial.prototype._concatVertexShader = function () {
  // based on THREE.ShaderLib.basic
  return [
    THREE.ShaderChunk["common"],
    THREE.ShaderChunk["uv_pars_vertex"],
    THREE.ShaderChunk["uv2_pars_vertex"],
    THREE.ShaderChunk["envmap_pars_vertex"],
    THREE.ShaderChunk["color_pars_vertex"],
    THREE.ShaderChunk["morphtarget_pars_vertex"],
    THREE.ShaderChunk["skinning_pars_vertex"],
    THREE.ShaderChunk["logdepthbuf_pars_vertex"],

    this._stringifyChunk("vertexFunctions"),
    this._stringifyChunk("vertexParameters"),
    this._stringifyChunk("varyingParameters"),

    "void main() {",

    this._stringifyChunk("vertexInit"),

    THREE.ShaderChunk["uv_vertex"],
    THREE.ShaderChunk["uv2_vertex"],
    THREE.ShaderChunk["color_vertex"],
    THREE.ShaderChunk["skinbase_vertex"],

    "	#ifdef USE_ENVMAP",

    THREE.ShaderChunk["beginnormal_vertex"],

    this._stringifyChunk("vertexNormal"),

    THREE.ShaderChunk["morphnormal_vertex"],
    THREE.ShaderChunk["skinnormal_vertex"],
    THREE.ShaderChunk["defaultnormal_vertex"],

    "	#endif",

    THREE.ShaderChunk["begin_vertex"],

    this._stringifyChunk("vertexPosition"),
    this._stringifyChunk("vertexColor"),

    THREE.ShaderChunk["morphtarget_vertex"],
    THREE.ShaderChunk["skinning_vertex"],
    THREE.ShaderChunk["project_vertex"],
    THREE.ShaderChunk["logdepthbuf_vertex"],

    THREE.ShaderChunk["worldpos_vertex"],
    THREE.ShaderChunk["envmap_vertex"],

    "}",
  ].join("\n");
};

THREE.BAS.BasicAnimationMaterial.prototype._concatFragmentShader = function () {
  return [
    "uniform vec3 diffuse;",
    "uniform float opacity;",

    this._stringifyChunk("fragmentFunctions"),
    this._stringifyChunk("fragmentParameters"),
    this._stringifyChunk("varyingParameters"),

    "#ifndef FLAT_SHADED",

    "	varying vec3 vNormal;",

    "#endif",

    THREE.ShaderChunk["common"],
    THREE.ShaderChunk["color_pars_fragment"],
    THREE.ShaderChunk["uv_pars_fragment"],
    THREE.ShaderChunk["uv2_pars_fragment"],
    THREE.ShaderChunk["map_pars_fragment"],
    THREE.ShaderChunk["alphamap_pars_fragment"],
    THREE.ShaderChunk["aomap_pars_fragment"],
    THREE.ShaderChunk["envmap_pars_fragment"],
    THREE.ShaderChunk["fog_pars_fragment"],
    THREE.ShaderChunk["specularmap_pars_fragment"],
    THREE.ShaderChunk["logdepthbuf_pars_fragment"],

    "void main() {",

    this._stringifyChunk("fragmentInit"),

    "	vec4 diffuseColor = vec4( diffuse, opacity );",

    THREE.ShaderChunk["logdepthbuf_fragment"],
    this._stringifyChunk("fragmentMap") || THREE.ShaderChunk["map_fragment"],
    THREE.ShaderChunk["color_fragment"],

    this._stringifyChunk("fragmentAlpha"),

    THREE.ShaderChunk["alphamap_fragment"],
    THREE.ShaderChunk["alphatest_fragment"],
    THREE.ShaderChunk["specularmap_fragment"],

    "	ReflectedLight reflectedLight;",
    "	reflectedLight.directDiffuse = vec3( 0.0 );",
    "	reflectedLight.directSpecular = vec3( 0.0 );",
    "	reflectedLight.indirectDiffuse = diffuseColor.rgb;",
    "	reflectedLight.indirectSpecular = vec3( 0.0 );",

    THREE.ShaderChunk["aomap_fragment"],

    "	vec3 outgoingLight = reflectedLight.indirectDiffuse;",

    THREE.ShaderChunk["envmap_fragment"],
    THREE.ShaderChunk["linear_to_gamma_fragment"],
    THREE.ShaderChunk["fog_fragment"],

    "	gl_FragColor = vec4( outgoingLight, diffuseColor.a );",

    "}",
  ].join("\n");
};

THREE.BAS.DepthAnimationMaterial = function (parameters) {
  this.depthPacking = THREE.RGBADepthPacking;
  this.clipping = true;

  this.vertexFunctions = [];
  this.vertexParameters = [];
  this.vertexInit = [];
  this.vertexPosition = [];

  THREE.BAS.BaseAnimationMaterial.call(this, parameters);

  var depthShader = THREE.ShaderLib["depth"];

  this.uniforms = THREE.UniformsUtils.merge([
    depthShader.uniforms,
    this.uniforms,
  ]);
  this.vertexShader = this._concatVertexShader();
  this.fragmentShader = depthShader.fragmentShader;
};
THREE.BAS.DepthAnimationMaterial.prototype = Object.create(
  THREE.BAS.BaseAnimationMaterial.prototype
);
THREE.BAS.DepthAnimationMaterial.prototype.constructor =
  THREE.BAS.DepthAnimationMaterial;

THREE.BAS.DepthAnimationMaterial.prototype._concatVertexShader = function () {
  return [
    THREE.ShaderChunk["common"],
    THREE.ShaderChunk["uv_pars_vertex"],
    THREE.ShaderChunk["displacementmap_pars_vertex"],
    THREE.ShaderChunk["morphtarget_pars_vertex"],
    THREE.ShaderChunk["skinning_pars_vertex"],
    THREE.ShaderChunk["logdepthbuf_pars_vertex"],
    THREE.ShaderChunk["clipping_planes_pars_vertex"],

    this._stringifyChunk("vertexFunctions"),
    this._stringifyChunk("vertexParameters"),

    "void main() {",

    this._stringifyChunk("vertexInit"),

    THREE.ShaderChunk["uv_vertex"],
    THREE.ShaderChunk["skinbase_vertex"],

    THREE.ShaderChunk["begin_vertex"],

    this._stringifyChunk("vertexPosition"),

    THREE.ShaderChunk["displacementmap_vertex"],
    THREE.ShaderChunk["morphtarget_vertex"],
    THREE.ShaderChunk["skinning_vertex"],
    THREE.ShaderChunk["project_vertex"],
    THREE.ShaderChunk["logdepthbuf_vertex"],
    THREE.ShaderChunk["clipping_planes_vertex"],

    "}",
  ].join("\n");
};

THREE.BAS.DistanceAnimationMaterial = function (parameters) {
  this.depthPacking = THREE.RGBADepthPacking;
  this.clipping = true;

  this.vertexFunctions = [];
  this.vertexParameters = [];
  this.vertexInit = [];
  this.vertexPosition = [];

  THREE.BAS.BaseAnimationMaterial.call(this, parameters);

  var distanceShader = THREE.ShaderLib["distanceRGBA"];

  this.uniforms = THREE.UniformsUtils.merge([
    distanceShader.uniforms,
    this.uniforms,
  ]);
  this.vertexShader = this._concatVertexShader();
  this.fragmentShader = distanceShader.fragmentShader;
};
THREE.BAS.DistanceAnimationMaterial.prototype = Object.create(
  THREE.BAS.BaseAnimationMaterial.prototype
);
THREE.BAS.DistanceAnimationMaterial.prototype.constructor =
  THREE.BAS.DistanceAnimationMaterial;

THREE.BAS.DistanceAnimationMaterial.prototype._concatVertexShader =
  function () {
    return [
      "varying vec4 vWorldPosition;",

      THREE.ShaderChunk["common"],
      THREE.ShaderChunk["morphtarget_pars_vertex"],
      THREE.ShaderChunk["skinning_pars_vertex"],
      THREE.ShaderChunk["clipping_planes_pars_vertex"],

      this._stringifyChunk("vertexFunctions"),
      this._stringifyChunk("vertexParameters"),

      "void main() {",

      this._stringifyChunk("vertexInit"),

      THREE.ShaderChunk["skinbase_vertex"],
      THREE.ShaderChunk["begin_vertex"],

      this._stringifyChunk("vertexPosition"),

      THREE.ShaderChunk["morphtarget_vertex"],
      THREE.ShaderChunk["skinning_vertex"],
      THREE.ShaderChunk["project_vertex"],
      THREE.ShaderChunk["worldpos_vertex"],
      THREE.ShaderChunk["clipping_planes_vertex"],

      "vWorldPosition = worldPosition;",

      "}",
    ].join("\n");
  };

THREE.BAS.PhongAnimationMaterial = function (parameters, uniformValues) {
  this.varyingParameters = [];

  this.vertexFunctions = [];
  this.vertexParameters = [];
  this.vertexInit = [];
  this.vertexNormal = [];
  this.vertexPosition = [];
  this.vertexColor = [];

  this.fragmentFunctions = [];
  this.fragmentParameters = [];
  this.fragmentInit = [];
  this.fragmentAlpha = [];
  this.fragmentEmissive = [];
  this.fragmentSpecular = [];

  THREE.BAS.BaseAnimationMaterial.call(this, parameters, uniformValues);

  var phongShader = THREE.ShaderLib["phong"];

  this.uniforms = THREE.UniformsUtils.merge([
    phongShader.uniforms,
    this.uniforms,
  ]);
  this.lights = true;
  this.vertexShader = this._concatVertexShader();
  this.fragmentShader = this._concatFragmentShader();

  this.setUniformValues(uniformValues);
};
THREE.BAS.PhongAnimationMaterial.prototype = Object.create(
  THREE.BAS.BaseAnimationMaterial.prototype
);
THREE.BAS.PhongAnimationMaterial.prototype.constructor =
  THREE.BAS.PhongAnimationMaterial;

THREE.BAS.PhongAnimationMaterial.prototype._concatVertexShader = function () {
  // based on THREE.ShaderLib.phong
  return [
    "#define PHONG",

    "varying vec3 vViewPosition;",

    "#ifndef FLAT_SHADED",

    "	varying vec3 vNormal;",

    "#endif",

    THREE.ShaderChunk["common"],
    THREE.ShaderChunk["uv_pars_vertex"],
    THREE.ShaderChunk["uv2_pars_vertex"],
    THREE.ShaderChunk["displacementmap_pars_vertex"],
    THREE.ShaderChunk["envmap_pars_vertex"],
    THREE.ShaderChunk["lights_phong_pars_vertex"],
    THREE.ShaderChunk["color_pars_vertex"],
    THREE.ShaderChunk["morphtarget_pars_vertex"],
    THREE.ShaderChunk["skinning_pars_vertex"],
    THREE.ShaderChunk["shadowmap_pars_vertex"],
    THREE.ShaderChunk["logdepthbuf_pars_vertex"],

    this._stringifyChunk("vertexFunctions"),
    this._stringifyChunk("vertexParameters"),
    this._stringifyChunk("varyingParameters"),

    "void main() {",

    this._stringifyChunk("vertexInit"),

    THREE.ShaderChunk["uv_vertex"],
    THREE.ShaderChunk["uv2_vertex"],
    THREE.ShaderChunk["color_vertex"],
    THREE.ShaderChunk["beginnormal_vertex"],

    this._stringifyChunk("vertexNormal"),

    THREE.ShaderChunk["morphnormal_vertex"],
    THREE.ShaderChunk["skinbase_vertex"],
    THREE.ShaderChunk["skinnormal_vertex"],
    THREE.ShaderChunk["defaultnormal_vertex"],

    "#ifndef FLAT_SHADED", // Normal computed with derivatives when FLAT_SHADED

    "	vNormal = normalize( transformedNormal );",

    "#endif",

    THREE.ShaderChunk["begin_vertex"],

    this._stringifyChunk("vertexPosition"),
    this._stringifyChunk("vertexColor"),

    THREE.ShaderChunk["displacementmap_vertex"],
    THREE.ShaderChunk["morphtarget_vertex"],
    THREE.ShaderChunk["skinning_vertex"],
    THREE.ShaderChunk["project_vertex"],
    THREE.ShaderChunk["logdepthbuf_vertex"],

    "	vViewPosition = - mvPosition.xyz;",

    THREE.ShaderChunk["worldpos_vertex"],
    THREE.ShaderChunk["envmap_vertex"],
    THREE.ShaderChunk["lights_phong_vertex"],
    THREE.ShaderChunk["shadowmap_vertex"],

    "}",
  ].join("\n");
};

THREE.BAS.PhongAnimationMaterial.prototype._concatFragmentShader = function () {
  return [
    "#define PHONG",

    "uniform vec3 diffuse;",
    "uniform vec3 emissive;",
    "uniform vec3 specular;",
    "uniform float shininess;",
    "uniform float opacity;",

    this._stringifyChunk("fragmentFunctions"),
    this._stringifyChunk("fragmentParameters"),
    this._stringifyChunk("varyingParameters"),

    THREE.ShaderChunk["common"],
    THREE.ShaderChunk["packing"],
    THREE.ShaderChunk["color_pars_fragment"],
    THREE.ShaderChunk["uv_pars_fragment"],
    THREE.ShaderChunk["uv2_pars_fragment"],
    THREE.ShaderChunk["map_pars_fragment"],
    THREE.ShaderChunk["alphamap_pars_fragment"],
    THREE.ShaderChunk["aomap_pars_fragment"],
    THREE.ShaderChunk["lightmap_pars_fragment"],
    THREE.ShaderChunk["emissivemap_pars_fragment"],
    THREE.ShaderChunk["envmap_pars_fragment"],
    THREE.ShaderChunk["fog_pars_fragment"],
    THREE.ShaderChunk["bsdfs"],
    THREE.ShaderChunk["ambient_pars"],
    THREE.ShaderChunk["lights_pars"],
    THREE.ShaderChunk["lights_phong_pars_fragment"],
    THREE.ShaderChunk["shadowmap_pars_fragment"],
    THREE.ShaderChunk["bumpmap_pars_fragment"],
    THREE.ShaderChunk["normalmap_pars_fragment"],
    THREE.ShaderChunk["specularmap_pars_fragment"],
    THREE.ShaderChunk["logdepthbuf_pars_fragment"],

    "void main() {",

    this._stringifyChunk("fragmentInit"),

    "	vec4 diffuseColor = vec4( diffuse, opacity );",
    "	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );",
    "	vec3 totalEmissiveLight = emissive;",

    THREE.ShaderChunk["logdepthbuf_fragment"],
    THREE.ShaderChunk["map_fragment"],
    THREE.ShaderChunk["color_fragment"],

    this._stringifyChunk("fragmentAlpha"),

    THREE.ShaderChunk["alphamap_fragment"],
    THREE.ShaderChunk["alphatest_fragment"],
    THREE.ShaderChunk["specularmap_fragment"],
    THREE.ShaderChunk["normal_fragment"],

    this._stringifyChunk("fragmentEmissive"),

    THREE.ShaderChunk["emissivemap_fragment"],

    // accumulation
    THREE.ShaderChunk["lights_phong_fragment"],

    this._stringifyChunk("fragmentSpecular"),

    THREE.ShaderChunk["lights_template"],

    // modulation
    THREE.ShaderChunk["aomap_fragment"],

    "vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveLight;",

    THREE.ShaderChunk["envmap_fragment"],
    THREE.ShaderChunk["linear_to_gamma_fragment"],

    THREE.ShaderChunk["fog_fragment"],

    "	gl_FragColor = vec4( outgoingLight, diffuseColor.a );",

    "}",
  ].join("\n");
};

THREE.BAS.StandardAnimationMaterial = function (parameters, uniformValues) {
  this.varyingParameters = [];

  this.vertexFunctions = [];
  this.vertexParameters = [];
  this.vertexInit = [];
  this.vertexNormal = [];
  this.vertexPosition = [];
  this.vertexColor = [];

  this.fragmentFunctions = [];
  this.fragmentParameters = [];
  this.fragmentInit = [];
  this.fragmentAlpha = [];
  this.fragmentEmissive = [];

  THREE.BAS.BaseAnimationMaterial.call(this, parameters, uniformValues);

  var standardShader = THREE.ShaderLib["standard"];

  this.uniforms = THREE.UniformsUtils.merge([
    standardShader.uniforms,
    this.uniforms,
  ]);
  this.lights = true;
  this.vertexShader = this._concatVertexShader();
  this.fragmentShader = this._concatFragmentShader();

  this.setUniformValues(uniformValues);
};
THREE.BAS.StandardAnimationMaterial.prototype = Object.create(
  THREE.BAS.BaseAnimationMaterial.prototype
);
THREE.BAS.StandardAnimationMaterial.prototype.constructor =
  THREE.BAS.StandardAnimationMaterial;

THREE.BAS.StandardAnimationMaterial.prototype._concatVertexShader =
  function () {
    // based on THREE.ShaderLib.physical
    return [
      "#define PHYSICAL",

      "varying vec3 vViewPosition;",

      "#ifndef FLAT_SHADED",

      "	varying vec3 vNormal;",

      "#endif",

      THREE.ShaderChunk["common"],
      THREE.ShaderChunk["uv_pars_vertex"],
      THREE.ShaderChunk["uv2_pars_vertex"],
      THREE.ShaderChunk["displacementmap_pars_vertex"],
      THREE.ShaderChunk["color_pars_vertex"],
      THREE.ShaderChunk["morphtarget_pars_vertex"],
      THREE.ShaderChunk["skinning_pars_vertex"],
      THREE.ShaderChunk["shadowmap_pars_vertex"],
      THREE.ShaderChunk["specularmap_pars_fragment"],
      THREE.ShaderChunk["logdepthbuf_pars_vertex"],
      THREE.ShaderChunk["clipping_planes_pars_vertex"],

      this._stringifyChunk("vertexFunctions"),
      this._stringifyChunk("vertexParameters"),
      this._stringifyChunk("varyingParameters"),

      "void main() {",

      this._stringifyChunk("vertexInit"),

      THREE.ShaderChunk["uv_vertex"],
      THREE.ShaderChunk["uv2_vertex"],
      THREE.ShaderChunk["color_vertex"],
      THREE.ShaderChunk["beginnormal_vertex"],

      this._stringifyChunk("vertexNormal"),

      THREE.ShaderChunk["morphnormal_vertex"],
      THREE.ShaderChunk["skinbase_vertex"],
      THREE.ShaderChunk["skinnormal_vertex"],
      THREE.ShaderChunk["defaultnormal_vertex"],

      "#ifndef FLAT_SHADED", // Normal computed with derivatives when FLAT_SHADED

      "	vNormal = normalize( transformedNormal );",

      "#endif",

      THREE.ShaderChunk["begin_vertex"],

      this._stringifyChunk("vertexPosition"),
      this._stringifyChunk("vertexColor"),

      THREE.ShaderChunk["displacementmap_vertex"],
      THREE.ShaderChunk["morphtarget_vertex"],
      THREE.ShaderChunk["skinning_vertex"],
      THREE.ShaderChunk["project_vertex"],
      THREE.ShaderChunk["logdepthbuf_vertex"],
      THREE.ShaderChunk["clipping_planes_vertex"],

      "	vViewPosition = - mvPosition.xyz;",

      THREE.ShaderChunk["worldpos_vertex"],
      THREE.ShaderChunk["shadowmap_vertex"],

      "}",
    ].join("\n");
  };

THREE.BAS.StandardAnimationMaterial.prototype._concatFragmentShader =
  function () {
    return [
      "#define PHYSICAL",

      "uniform vec3 diffuse;",
      "uniform vec3 emissive;",
      "uniform float roughness;",
      "uniform float metalness;",
      "uniform float opacity;",

      "uniform float envMapIntensity;",

      "varying vec3 vViewPosition;",

      "#ifndef FLAT_SHADED",
      "varying vec3 vNormal;",
      "#endif",

      this._stringifyChunk("fragmentFunctions"),
      this._stringifyChunk("fragmentParameters"),
      this._stringifyChunk("varyingParameters"),

      THREE.ShaderChunk["common"],
      THREE.ShaderChunk["packing"],
      THREE.ShaderChunk["color_pars_fragment"],
      THREE.ShaderChunk["uv_pars_fragment"],
      THREE.ShaderChunk["uv2_pars_fragment"],
      THREE.ShaderChunk["map_pars_fragment"],
      THREE.ShaderChunk["alphamap_pars_fragment"],
      THREE.ShaderChunk["aomap_pars_fragment"],
      THREE.ShaderChunk["lightmap_pars_fragment"],
      THREE.ShaderChunk["emissivemap_pars_fragment"],
      THREE.ShaderChunk["envmap_pars_fragment"],
      THREE.ShaderChunk["fog_pars_fragment"],
      THREE.ShaderChunk["bsdfs"],
      THREE.ShaderChunk["cube_uv_reflection_fragment"],
      THREE.ShaderChunk["lights_pars"],
      THREE.ShaderChunk["lights_physical_pars_fragment"],
      THREE.ShaderChunk["shadowmap_pars_fragment"],
      THREE.ShaderChunk["bumpmap_pars_fragment"],
      THREE.ShaderChunk["normalmap_pars_fragment"],
      THREE.ShaderChunk["roughnessmap_pars_fragment"],
      THREE.ShaderChunk["metalnessmap_pars_fragment"],
      THREE.ShaderChunk["logdepthbuf_pars_fragment"],
      THREE.ShaderChunk["clipping_planes_pars_fragment"],

      "void main() {",

      this._stringifyChunk("fragmentInit"),

      "	vec4 diffuseColor = vec4( diffuse, opacity );",
      "	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );",
      "	vec3 totalEmissiveRadiance = emissive;",

      THREE.ShaderChunk["logdepthbuf_fragment"],
      THREE.ShaderChunk["map_fragment"],
      THREE.ShaderChunk["color_fragment"],

      this._stringifyChunk("fragmentAlpha"),

      THREE.ShaderChunk["alphamap_fragment"],
      THREE.ShaderChunk["alphatest_fragment"],
      THREE.ShaderChunk["specularmap_fragment"],
      THREE.ShaderChunk["roughnessmap_fragment"],
      THREE.ShaderChunk["metalnessmap_fragment"],
      THREE.ShaderChunk["normal_fragment"],

      this._stringifyChunk("fragmentEmissive"),

      THREE.ShaderChunk["emissivemap_fragment"],

      // accumulation
      THREE.ShaderChunk["lights_physical_fragment"],

      this._stringifyChunk("fragmentSpecular"),

      THREE.ShaderChunk["lights_template"],

      // modulation
      THREE.ShaderChunk["aomap_fragment"],

      "vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;",

      "	gl_FragColor = vec4( outgoingLight, diffuseColor.a );",

      THREE.ShaderChunk["premultiplied_alpha_fragment"],
      THREE.ShaderChunk["tonemapping_fragment"],
      THREE.ShaderChunk["encodings_fragment"],
      THREE.ShaderChunk["fog_fragment"],

      "}",
    ].join("\n");
  };
