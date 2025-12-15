/**
 * Audio Analysis Web Worker
 * Runs audio analysis in background thread to avoid blocking main thread
 * Handles: bass analysis, drums detection, instruments level
 */

// Shared state for throttling
let audioAnalysisFrameCount = 0;
let lastBassResult = 0;
let lastDrumsResult = 0;
let lastInstrumentsResult = 0;

// Cache for frequency data
let bassFreqData = null;
let drumsFreqData = null;
let instrumentsFreqData = null;

// Thresholds
const kickThreshold = 0.68;

/**
 * Analyze bass frequencies (0-200Hz range)
 * Throttled to 30fps for efficiency
 */
function analyzeBass(dataArray) {
  if (audioAnalysisFrameCount % 2 !== 0) {
    return lastBassResult; // Return cached result on non-analysis frames
  }

  if (!dataArray || dataArray.length === 0) return 0;

  // Bass is in lower frequencies (first 10% of spectrum)
  const bassRange = Math.floor(dataArray.length * 0.1);
  let sum = 0;

  for (let i = 0; i < bassRange; i++) {
    sum += dataArray[i];
  }

  const average = sum / bassRange / 255; // Normalize to 0-1
  lastBassResult = Math.min(1.0, average);
  return lastBassResult;
}

/**
 * Analyze drums/kick frequencies (20-200Hz range)
 * NOT throttled - needs every frame for kick detection
 */
function analyzeDrums(dataArray) {
  if (!dataArray || dataArray.length === 0) return 0;

  // Drums/kicks are in very low frequencies
  const drumsRange = Math.floor(dataArray.length * 0.08);
  let sum = 0;

  for (let i = 0; i < drumsRange; i++) {
    sum += dataArray[i];
  }

  const average = sum / drumsRange / 255; // Normalize to 0-1
  lastDrumsResult = Math.min(1.0, average);
  return lastDrumsResult;
}

/**
 * Analyze instruments level (mid-high frequencies)
 * Throttled to 30fps for efficiency
 */
function analyzeInstruments(dataArray) {
  if (audioAnalysisFrameCount % 2 !== 0) {
    return lastInstrumentsResult; // Return cached result on non-analysis frames
  }

  if (!dataArray || dataArray.length === 0) return 0;

  // Instruments are in mid-high frequencies (30-100% of spectrum)
  const startRange = Math.floor(dataArray.length * 0.3);
  const endRange = Math.floor(dataArray.length * 1.0);
  let sum = 0;

  for (let i = startRange; i < endRange; i++) {
    sum += dataArray[i];
  }

  const count = endRange - startRange;
  const average = sum / count / 255; // Normalize to 0-1
  lastInstrumentsResult = Math.min(1.0, average);
  return lastInstrumentsResult;
}

/**
 * Main message handler - receives audio data from main thread
 */
self.onmessage = (event) => {
  const { bassData, drumsData, instrumentsData, frameCount } = event.data;

  // Update frame counter for throttling
  audioAnalysisFrameCount = frameCount;

  // Analyze all three audio tracks
  const bass = analyzeBass(bassData);
  const drums = analyzeDrums(drumsData);
  const instruments = analyzeInstruments(instrumentsData);

  // Detect kick (drums above threshold)
  const isKick = drums > kickThreshold;

  // Send results back to main thread
  self.postMessage({
    bass,
    drums,
    instruments,
    isKick,
    frameCount
  });
};

