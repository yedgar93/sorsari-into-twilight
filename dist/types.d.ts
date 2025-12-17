/**
 * Global Type Definitions for SORSARI Audio-Visual Experience
 * 
 * Provides TypeScript type safety for all global window extensions
 * Eliminates IDE warnings and enables autocomplete
 */

declare global {
  interface Window {
    /**
     * SORSARI namespace
     * Central hub for all audio-visual state and methods
     */
    SORSARI: {
      /** Current playback time in seconds (synced to audio element) */
      musicTime: number;
      /** Main audio HTML element */
      audioElement: HTMLAudioElement | null;
      /** Analyser node for frequency data */
      analyser: AnalyserNode | null;
      /** Whether device is mobile or desktop */
      isMobile: boolean;
      /** Skip to specific timestamp in seconds */
      skipToTime(seconds: number): void;
      /** Replay the experience from the beginning */
      replay(): void;
      /** Reset model animations for replay */
      resetModelAnimations(): void;
    };
    
    /** Play all audio tracks in sync */
    playAllTracks(): void;
    
    /** Three.js scene root */
    root: THREE.Scene | null;
    
    /** Global pause state across all effects */
    globalPauseState: boolean;
    
    /** VanillaTilt library for 3D tilt effect */
    VanillaTilt?: {
      init(element: HTMLElement, options?: Record<string, unknown>): void;
    };
  }
}

export {};
