/**
 * Login sound — decoded once at module level using Web Audio API.
 *
 * Why Web Audio API instead of HTMLAudioElement:
 * - AudioBufferSourceNode plays on a dedicated audio thread — immune to
 *   main-thread CPU spikes caused by React hydration after router.push().
 * - decodeAudioData() converts the WAV to the device's native sample rate
 *   once, eliminating the per-play software resampling that causes distortion.
 * - No seek operation (currentTime = 0) needed — a new source node is created
 *   per play, so playback always starts from the beginning cleanly.
 */

let ctx: AudioContext | null = null;
let buffer: AudioBuffer | null = null;
let loading = false;

function getContext(): AudioContext {
  if (!ctx || ctx.state === "closed") {
    ctx = new AudioContext();
  }
  return ctx;
}

export async function preloadLoginSound(): Promise<void> {
  if (buffer || loading) return;
  loading = true;
  try {
    const audioCtx = getContext();
    const response = await fetch("/login-tone.wav");
    const arrayBuffer = await response.arrayBuffer();
    buffer = await audioCtx.decodeAudioData(arrayBuffer);
  } catch {
    // Non-fatal — sound simply won't play if preload fails
  } finally {
    loading = false;
  }
}

export function playLoginSound(): void {
  if (!buffer) return;
  try {
    const audioCtx = getContext();

    // Resume context if suspended (browser autoplay policy)
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }

    // Each play gets a fresh source node — no seek, no buffer reset
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start(0);
  } catch {
    // Silently ignore — audio is non-critical
  }
}
