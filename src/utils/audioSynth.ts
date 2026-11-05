/**
 * High-fidelity Web Audio API synthesizer for procedural demo tracks.
 * Generates a clean 10-second professional electronic loop (Beat, sub, pad, hi-hats).
 */
export function generateDemoLoop(ctx: AudioContext): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const duration = 10; // 10 seconds beautiful electronic loop
  const buffer = ctx.createBuffer(2, sampleRate * duration, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  const tempo = 124;
  const beatLen = 60 / tempo; // ~0.483s per beat

  for (let i = 0; i < buffer.length; i++) {
    const t = i / sampleRate;
    let sample = 0;

    // 1. Kick Drum (sine frequency sweep starting at 130Hz down to 42Hz)
    const beatIndex = Math.floor(t / beatLen);
    const timeInBeat = t % beatLen;
    if (timeInBeat < 0.28) {
      const freq = 130 * Math.exp(-38 * timeInBeat);
      const kickEnv = Math.exp(-9 * timeInBeat);
      sample += 0.85 * Math.sin(2 * Math.PI * freq * timeInBeat) * kickEnv;
    }

    // 2. Closed Hi-hat (filtered white noise envelope on half-beats)
    const subBeatIndex = Math.floor(t / (beatLen / 2));
    const timeInSubBeat = t % (beatLen / 2);
    if (subBeatIndex % 2 === 1 && timeInSubBeat < 0.09) {
      const noise = Math.random() * 2 - 1;
      const hatEnv = Math.exp(-32 * timeInSubBeat);
      sample += 0.12 * noise * hatEnv;
    }

    // 3. Ambient Chord Pad (A Minor -> F Major -> C Major -> G Major)
    const measure = Math.floor(beatIndex / 4); // 4 beats per chord
    const measureProgress = (beatIndex % 4) / 4 + (timeInBeat / (beatLen * 4));
    
    let baseFreq = 110; // A2
    let chordRatio = [1.0, 1.2, 1.5, 1.8]; // Minor
    
    if (measure === 1) { // F Major
      baseFreq = 87.31; // F2
      chordRatio = [1.0, 1.25, 1.5, 1.875];
    } else if (measure === 2) { // C Major
      baseFreq = 130.81; // C3
      chordRatio = [1.0, 1.25, 1.5, 1.875];
    } else if (measure === 3) { // G Major
      baseFreq = 98.0; // G2
      chordRatio = [1.0, 1.25, 1.5, 1.75]; // G dominant vibe
    }

    // Synthesis of standard warm synth oscillators (Detuned saws)
    let padValue = 0;
    for (let u = 0; u < chordRatio.length; u++) {
      const pitchFreq = baseFreq * chordRatio[u];
      // Oscillator 1 (Saw)
      const osc1 = ((t * pitchFreq) % 1) * 2 - 1;
      // Oscillator 2 (Slightly detuned saw)
      const osc2 = ((t * (pitchFreq * 1.008)) % 1) * 2 - 1;
      padValue += (osc1 + osc2) * 0.25;
    }
    
    // Slow sidechain pumping envelope triggered by kick
    const sidechain = 0.2 + 0.8 * Math.pow(Math.max(0, timeInBeat) / beatLen, 3);
    
    // Lowpass filter synthesis (simple moving-average style/frequency filter simulation)
    const padEnv = 0.25 * Math.sin(Math.PI * measureProgress);
    sample += padValue * padEnv * sidechain;

    // Direct Stereo distribution and spatial expansion
    const pan = 0.15 * Math.sin(2 * Math.PI * 0.25 * t); // slow auto-panning
    left[i] = Math.max(-1, Math.min(1, sample * (1 - pan)));
    right[i] = Math.max(-1, Math.min(1, sample * (1 + pan)));
  }

  return buffer;
}
