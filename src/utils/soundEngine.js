// Web Audio API synthesizer for UI sound effects.
// Avoids external file loading dependencies.

let audioCtx = null;
let soundVolume = 0.5; // default volume (0 to 1)
let soundEnabled = true;
let soundPack = 'modern'; // 'modern' | 'mechanical' | 'soft'

export function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

export function setSoundVolume(volume) {
  soundVolume = Math.max(0, Math.min(1, volume));
}

export function setSoundEnabled(enabled) {
  soundEnabled = !!enabled;
}

export function setSoundPack(pack) {
  soundPack = pack;
}

function playTone(freq, type, duration, startTimeOffset = 0, volumeMultiplier = 1) {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime + startTimeOffset);

  const gain = soundVolume * volumeMultiplier;
  gainNode.gain.setValueAtTime(gain, audioCtx.currentTime + startTimeOffset);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + startTimeOffset + duration);

  osc.start(audioCtx.currentTime + startTimeOffset);
  osc.stop(audioCtx.currentTime + startTimeOffset + duration);
}

export function playClick() {
  if (!soundEnabled) return;
  
  if (soundPack === 'mechanical') {
    // A quick, short mechanical click sound
    playTone(1600, 'square', 0.03, 0, 0.3);
    playTone(800, 'square', 0.02, 0.01, 0.2);
  } else if (soundPack === 'soft') {
    // Soft bubble pop
    playTone(600, 'sine', 0.08, 0, 0.4);
  } else {
    // Modern crisp click
    playTone(1200, 'sine', 0.04, 0, 0.4);
  }
}

export function playSuccess() {
  if (!soundEnabled) return;

  if (soundPack === 'mechanical') {
    // Retro chime
    playTone(523.25, 'triangle', 0.15, 0, 0.5); // C5
    playTone(659.25, 'triangle', 0.15, 0.08, 0.5); // E5
    playTone(783.99, 'triangle', 0.25, 0.16, 0.5); // G5
  } else if (soundPack === 'soft') {
    // Gentle warm chord
    playTone(440, 'sine', 0.3, 0, 0.6); // A4
    playTone(554.37, 'sine', 0.3, 0.05, 0.5); // C#5
    playTone(659.25, 'sine', 0.4, 0.1, 0.4); // E5
  } else {
    // Modern electronic ascending tones
    playTone(880, 'sine', 0.1, 0, 0.4); // A5
    playTone(1318.51, 'sine', 0.2, 0.08, 0.4); // E6
  }
}

export function playWarning() {
  if (!soundEnabled) return;
  
  // Double alert beep
  playTone(220, 'sawtooth', 0.12, 0, 0.3);
  playTone(220, 'sawtooth', 0.12, 0.15, 0.3);
}
