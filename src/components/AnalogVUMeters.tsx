import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Radio, Gauge } from 'lucide-react';
import { useMastering } from '../context/MasteringContext';

export type VUScaleMode = 'LUFS' | 'RMS' | 'VU';
export type PeakHoldMode = '2s' | '5s' | 'INF' | 'OFF';

export interface LoudnessStandardProfile {
  targetLUFS: number;
  label: string;
  sublabel: string;
  toleranceLU: number; // ± LU acceptable tolerance
}

export const LOUDNESS_PROFILES: Record<number, LoudnessStandardProfile> = {
  [-14]: { targetLUFS: -14, label: 'SPOTIFY / YT', sublabel: 'Streaming Std', toleranceLU: 1.0 },
  [-16]: { targetLUFS: -16, label: 'APPLE MUSIC', sublabel: 'Sound Check', toleranceLU: 1.0 },
  [-9]:  { targetLUFS: -9,  label: 'CLUB / EDM', sublabel: 'Commercial Master', toleranceLU: 1.5 },
  [-18]: { targetLUFS: -18, label: 'AES TD1004', sublabel: 'Hi-Fi Dynamic', toleranceLU: 1.0 },
  [-23]: { targetLUFS: -23, label: 'EBU R128', sublabel: 'Broadcast TV/Radio', toleranceLU: 0.5 },
};

export const TARGET_PRESETS = [-14, -16, -9, -18, -23];

// Digital True Peak thresholds according to ITU-R BS.1770-4 & streaming distribution specs
export const TRUE_PEAK_CLIP_THRESHOLD = 0.0; // 0.0 dBTP is the absolute digital full-scale ceiling (inter-sample clipping)
export const TRUE_PEAK_WARN_THRESHOLD = -0.5; // Warning headroom threshold (-0.5 to -1.0 dBTP recommended by Spotify/Apple Music)

// ITU-R BS.1770-4 4x oversampled true peak calculation with Catmull-Rom cubic Hermite inter-sample interpolation
function calculateTruePeak(buffer: Float32Array): { samplePeak: number; truePeak: number; truePeakDb: number } {
  let samplePeak = 0;
  let truePeak = 0;
  const len = buffer.length;

  for (let i = 0; i < len; i++) {
    const xCurr = buffer[i];
    const absCurr = Math.abs(xCurr);
    if (absCurr > samplePeak) samplePeak = absCurr;
    if (absCurr > truePeak) truePeak = absCurr;

    // Catmull-Rom 4x inter-sample interpolation between i and i+1
    if (i > 0 && i < len - 2) {
      const xPrev = buffer[i - 1];
      const xNext = buffer[i + 1];
      const xNext2 = buffer[i + 2];

      const a0 = -0.5 * xPrev + 1.5 * xCurr - 1.5 * xNext + 0.5 * xNext2;
      const a1 = xPrev - 2.5 * xCurr + 2.0 * xNext - 0.5 * xNext2;
      const a2 = -0.5 * xPrev + 0.5 * xNext;
      const a3 = xCurr;

      // Evaluate 3 sub-sample points: t = 0.25, 0.5, 0.75
      const s1 = Math.abs(a0 * 0.015625 + a1 * 0.0625 + a2 * 0.25 + a3);
      const s2 = Math.abs(a0 * 0.125 + a1 * 0.25 + a2 * 0.5 + a3);
      const s3 = Math.abs(a0 * 0.421875 + a1 * 0.5625 + a2 * 0.75 + a3);

      if (s1 > truePeak) truePeak = s1;
      if (s2 > truePeak) truePeak = s2;
      if (s3 > truePeak) truePeak = s3;
    }
  }

  const truePeakDb = truePeak > 1e-5 ? 20 * Math.log10(truePeak) : -100;
  return { samplePeak, truePeak, truePeakDb };
}

// ITU-R BS.1770-4 K-weighting filter coefficients at 48kHz
// Stage 1: High shelf filter (head effect acoustic modeling, +4dB)
const B1_0 = 1.53512485958697;
const B1_1 = -2.69169618940638;
const B1_2 = 1.19839281085285;
const A1_1 = -1.69065929318241;
const A1_2 = 0.73248077421585;

// Stage 2: High pass RLB filter (sub-bass attenuation, ~100Hz)
const B2_0 = 1.0;
const B2_1 = -2.0;
const B2_2 = 1.0;
const A2_1 = -1.99004745483398;
const A2_2 = 0.99007225036621;

export default function AnalogVUMeters() {
  const { 
    isPlaying, 
    audioBuffer, 
    audioContextRef, 
    nodesRef, 
    settings, 
    updateSettings,
    isEngaged, 
    glowIntensity 
  } = useMastering();

  // Scale mode and Peak/Hold settings
  const [scaleMode, setScaleMode] = useState<VUScaleMode>(() => {
    return (localStorage.getItem('mastercore_vu_scale') as VUScaleMode) || 'LUFS';
  });
  const [peakHoldMode, setPeakHoldMode] = useState<PeakHoldMode>(() => {
    return (localStorage.getItem('mastercore_vu_peakhold') as PeakHoldMode) || '2s';
  });
  const [selectedTarget, setSelectedTarget] = useState<number>(() => {
    return settings.lufsTarget || -14;
  });

  // Flash feedback states for tactile click-to-reset response
  const [inputResetFlash, setInputResetFlash] = useState(false);
  const [outputResetFlash, setOutputResetFlash] = useState(false);

  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const spectralCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const decayingBandsRef = useRef<number[]>(new Array(8).fill(0));

  // References for direct DOM updates of needles, LEDs, peak hold ticks, and readouts
  const inputNeedleRef = useRef<SVGLineElement | null>(null);
  const outputNeedleRef = useRef<SVGLineElement | null>(null);
  const inputPeakMarkerRef = useRef<SVGLineElement | null>(null);
  const outputPeakMarkerRef = useRef<SVGLineElement | null>(null);
  const inputPeakPipRef = useRef<SVGCircleElement | null>(null);
  const outputPeakPipRef = useRef<SVGCircleElement | null>(null);
  const inputPeakBadgeRef = useRef<SVGGElement | null>(null);
  const outputPeakBadgeRef = useRef<SVGGElement | null>(null);
  const inputPeakBadgeTextRef = useRef<SVGTextElement | null>(null);
  const outputPeakBadgeTextRef = useRef<SVGTextElement | null>(null);
  const inputClippingLedRef = useRef<HTMLDivElement | null>(null);
  const outputClippingLedRef = useRef<HTMLDivElement | null>(null);
  const inputDbTextRef = useRef<SVGTextElement | null>(null);
  const outputDbTextRef = useRef<SVGTextElement | null>(null);
  const inputPeakTextRef = useRef<HTMLSpanElement | null>(null);
  const outputPeakTextRef = useRef<HTMLSpanElement | null>(null);
  const inputTruePeakTextRef = useRef<HTMLSpanElement | null>(null);
  const outputTruePeakTextRef = useRef<HTMLSpanElement | null>(null);
  const inputTruePeakLedRef = useRef<HTMLDivElement | null>(null);
  const outputTruePeakLedRef = useRef<HTMLDivElement | null>(null);
  const inputTruePeakClipFlagRef = useRef<SVGGElement | null>(null);
  const outputTruePeakClipFlagRef = useRef<SVGGElement | null>(null);
  const centerIntegrityBadgeRef = useRef<HTMLDivElement | null>(null);

  // RMS Level Bar & Sustained Loudness refs (AES-17 300ms integration)
  const inputRmsBarRef = useRef<HTMLDivElement | null>(null);
  const outputRmsBarRef = useRef<HTMLDivElement | null>(null);
  const inputRmsTextRef = useRef<HTMLSpanElement | null>(null);
  const outputRmsTextRef = useRef<HTMLSpanElement | null>(null);
  const inputRmsArcRef = useRef<SVGPathElement | null>(null);
  const outputRmsArcRef = useRef<SVGPathElement | null>(null);
  const inputRmsBadgeTextRef = useRef<SVGTextElement | null>(null);
  const outputRmsBadgeTextRef = useRef<SVGTextElement | null>(null);
  const inputSustainedRmsRef = useRef<number>(0);
  const outputSustainedRmsRef = useRef<number>(0);

  // Integrated LUFS (ITU-R BS.1770-4) DOM references for high-precision 60fps updates
  const integratedLufsTextRef = useRef<HTMLSpanElement | null>(null);
  const integratedDeltaTextRef = useRef<HTMLSpanElement | null>(null);
  const integratedStatusBadgeRef = useRef<HTMLSpanElement | null>(null);
  const integratedBarFillRef = useRef<HTMLDivElement | null>(null);
  const momentaryLufsTextRef = useRef<HTMLSpanElement | null>(null);
  const shortTermLufsTextRef = useRef<HTMLSpanElement | null>(null);
  const integratedElapsedTextRef = useRef<HTMLSpanElement | null>(null);
  const centerIntegratedValRef = useRef<HTMLSpanElement | null>(null);
  const centerIntegratedDeltaRef = useRef<HTMLSpanElement | null>(null);

  // Integrated Loudness ITU-R BS.1770-4 gated integration accumulator
  const integratedState = useRef<{
    blockPowers: number[];        // Array of 100ms block energies for gating
    blockAccumulator: number;     // Running mean-square for current block
    blockSampleCount: number;     // Number of frames in current block
    elapsedGatedSeconds: number;  // Accumulated duration of signal above -70 LUFS
    currentIntegratedLUFS: number; // Current gated Integrated LUFS result
    currentShortTermLUFS: number;  // Sliding 3-second Short-term LUFS
    currentMomentaryLUFS: number;  // Instantaneous 400ms Momentary LUFS
    lastGatedCalcTime: number;    // Timestamp for calculation throttling (~100ms)
  }>({
    blockPowers: [],
    blockAccumulator: 0,
    blockSampleCount: 0,
    elapsedGatedSeconds: 0,
    currentIntegratedLUFS: -Infinity,
    currentShortTermLUFS: -Infinity,
    currentMomentaryLUFS: -Infinity,
    lastGatedCalcTime: 0
  });

  // Ballistics state for needle physics simulation (inertia, spring, damping)
  const inputState = useRef<{ angle: number; velocity: number }>({ angle: -50, velocity: 0 });
  const outputState = useRef<{ angle: number; velocity: number }>({ angle: -50, velocity: 0 });

  // Peak / Hold states
  const inputPeakState = useRef<{
    peakDb: number;
    peakAngle: number;
    holdExpiry: number;
  }>({
    peakDb: -Infinity,
    peakAngle: -50,
    holdExpiry: 0
  });

  const outputPeakState = useRef<{
    peakDb: number;
    peakAngle: number;
    holdExpiry: number;
  }>({
    peakDb: -Infinity,
    peakAngle: -50,
    holdExpiry: 0
  });

  // True Peak (dBTP) tracking with 4x inter-sample interpolation
  const inputTruePeakState = useRef<{
    currentDbTP: number;
    maxDbTP: number;
    isClipped: boolean;
    clipCount: number;
    holdExpiry: number;
  }>({
    currentDbTP: -Infinity,
    maxDbTP: -Infinity,
    isClipped: false,
    clipCount: 0,
    holdExpiry: 0
  });

  const outputTruePeakState = useRef<{
    currentDbTP: number;
    maxDbTP: number;
    isClipped: boolean;
    clipCount: number;
    holdExpiry: number;
  }>({
    currentDbTP: -Infinity,
    maxDbTP: -Infinity,
    isClipped: false,
    clipCount: 0,
    holdExpiry: 0
  });

  // Clip LED states
  const inputClipState = useRef<{ lit: boolean; value: number }>({ lit: false, value: 0 });
  const outputClipState = useRef<{ lit: boolean; value: number }>({ lit: false, value: 0 });

  // ITU-R BS.1770 filter memory
  const inputFilterState = useRef<Float64Array>(new Float64Array(4)); // [s1_0, s1_1, s2_0, s2_1]
  const outputFilterState = useRef<Float64Array>(new Float64Array(4));

  // Active animation frame
  const animationFrameRef = useRef<number | null>(null);

  // Establish Web Audio Analyzer relationships
  useEffect(() => {
    if (!audioContextRef.current || !nodesRef.current) return;

    const ctx = audioContextRef.current;
    const nodes = nodesRef.current;

    // Output analyzer: reuse context output analyzer
    outputAnalyserRef.current = nodes.analyser || null;

    // Input analyzer: connect to input gain node in parallel if not done yet
    if (!inputAnalyserRef.current && nodes.inputGain) {
      try {
        const inputAnalyser = ctx.createAnalyser();
        inputAnalyser.fftSize = 256;
        inputAnalyserRef.current = inputAnalyser;
        nodes.inputGain.connect(inputAnalyser);
      } catch (err) {
        console.warn('Unable to bind input analyzer for VU metrics:', err);
      }
    }
  }, [audioContextRef.current, nodesRef.current, audioBuffer]);

  const handleSetScaleMode = (mode: VUScaleMode) => {
    setScaleMode(mode);
    localStorage.setItem('mastercore_vu_scale', mode);
  };

  const handleCyclePeakHold = () => {
    const modes: PeakHoldMode[] = ['2s', '5s', 'INF', 'OFF'];
    const next = modes[(modes.indexOf(peakHoldMode) + 1) % modes.length];
    setPeakHoldMode(next);
    localStorage.setItem('mastercore_vu_peakhold', next);
  };

  // Sync target preset if updated externally
  useEffect(() => {
    if (typeof settings.lufsTarget === 'number') {
      setSelectedTarget(settings.lufsTarget);
    }
  }, [settings.lufsTarget]);

  const handleCycleTarget = () => {
    const next = TARGET_PRESETS[(TARGET_PRESETS.indexOf(selectedTarget) + 1) % TARGET_PRESETS.length];
    setSelectedTarget(next);
    updateSettings({ lufsTarget: next });
  };

  const resetPeaks = (targetChannel: 'all' | 'in' | 'out' = 'all') => {
    const resetIn = targetChannel === 'all' || targetChannel === 'in';
    const resetOut = targetChannel === 'all' || targetChannel === 'out';

    if (resetIn) {
      inputPeakState.current = { peakDb: -Infinity, peakAngle: -50, holdExpiry: 0 };
      inputClipState.current = { lit: false, value: 0 };
      inputTruePeakState.current = {
        currentDbTP: -Infinity,
        maxDbTP: -Infinity,
        isClipped: false,
        clipCount: 0,
        holdExpiry: 0
      };

      if (inputPeakTextRef.current) {
        inputPeakTextRef.current.textContent = 'RESET';
        inputPeakTextRef.current.className = 'font-mono text-[6.5px] text-amber-400 font-bold';
        setTimeout(() => {
          if (inputPeakTextRef.current && inputPeakState.current.peakDb <= -70) {
            inputPeakTextRef.current.textContent = 'PK -INF';
            inputPeakTextRef.current.className = 'font-mono text-[6.5px] text-white/40 font-bold';
          }
        }, 280);
      }

      if (inputTruePeakTextRef.current) {
        inputTruePeakTextRef.current.textContent = '-INF';
        inputTruePeakTextRef.current.className = 'font-mono text-[7px] text-white/40 font-bold';
      }
      if (inputPeakMarkerRef.current) inputPeakMarkerRef.current.style.opacity = '0';
      if (inputPeakPipRef.current) inputPeakPipRef.current.style.opacity = '0';
      if (inputPeakBadgeRef.current && inputPeakBadgeTextRef.current) {
        inputPeakBadgeRef.current.style.opacity = '0.3';
        inputPeakBadgeTextRef.current.textContent = 'HOLD -INF';
        inputPeakBadgeTextRef.current.setAttribute('fill', '#f59e0b');
        const rect = inputPeakBadgeRef.current.querySelector('rect');
        if (rect) rect.setAttribute('stroke', '#f59e0b');
      }
      if (inputTruePeakClipFlagRef.current) {
        inputTruePeakClipFlagRef.current.style.opacity = '0.25';
      }
      if (inputClippingLedRef.current) {
        inputClippingLedRef.current.style.backgroundColor = '#1e0505';
        inputClippingLedRef.current.style.boxShadow = 'inset 0 0 3px rgba(0,0,0,0.9)';
      }
      if (!isPlaying || !audioBuffer) {
        inputSustainedRmsRef.current = 0;
        if (inputRmsBarRef.current) inputRmsBarRef.current.style.width = '0%';
        if (inputRmsTextRef.current) {
          inputRmsTextRef.current.textContent = '-INF';
          inputRmsTextRef.current.className = 'font-mono text-[6px] text-white/40 font-bold';
        }
        if (inputRmsArcRef.current) {
          inputRmsArcRef.current.setAttribute('stroke-dashoffset', '85');
          inputRmsArcRef.current.style.opacity = '0.15';
        }
        if (inputRmsBadgeTextRef.current) {
          inputRmsBadgeTextRef.current.textContent = 'RMS -INF';
        }
      }

      setInputResetFlash(true);
      setTimeout(() => setInputResetFlash(false), 250);
    }

    if (resetOut) {
      outputPeakState.current = { peakDb: -Infinity, peakAngle: -50, holdExpiry: 0 };
      outputClipState.current = { lit: false, value: 0 };
      outputTruePeakState.current = {
        currentDbTP: -Infinity,
        maxDbTP: -Infinity,
        isClipped: false,
        clipCount: 0,
        holdExpiry: 0
      };

      if (outputPeakTextRef.current) {
        outputPeakTextRef.current.textContent = 'RESET';
        outputPeakTextRef.current.className = 'font-mono text-[6.5px] text-amber-400 font-bold';
        setTimeout(() => {
          if (outputPeakTextRef.current && outputPeakState.current.peakDb <= -70) {
            outputPeakTextRef.current.textContent = 'PK -INF';
            outputPeakTextRef.current.className = 'font-mono text-[6.5px] text-white/40 font-bold';
          }
        }, 280);
      }

      if (outputTruePeakTextRef.current) {
        outputTruePeakTextRef.current.textContent = '-INF';
        outputTruePeakTextRef.current.className = 'font-mono text-[7px] text-white/40 font-bold';
      }
      if (outputPeakMarkerRef.current) outputPeakMarkerRef.current.style.opacity = '0';
      if (outputPeakPipRef.current) outputPeakPipRef.current.style.opacity = '0';
      if (outputPeakBadgeRef.current && outputPeakBadgeTextRef.current) {
        outputPeakBadgeRef.current.style.opacity = '0.3';
        outputPeakBadgeTextRef.current.textContent = 'HOLD -INF';
        outputPeakBadgeTextRef.current.setAttribute('fill', '#f59e0b');
        const rect = outputPeakBadgeRef.current.querySelector('rect');
        if (rect) rect.setAttribute('stroke', '#f59e0b');
      }
      if (outputTruePeakClipFlagRef.current) {
        outputTruePeakClipFlagRef.current.style.opacity = '0.25';
      }
      if (outputClippingLedRef.current) {
        outputClippingLedRef.current.style.backgroundColor = '#1e0505';
        outputClippingLedRef.current.style.boxShadow = 'inset 0 0 3px rgba(0,0,0,0.9)';
      }
      if (!isPlaying || !audioBuffer) {
        outputSustainedRmsRef.current = 0;
        if (outputRmsBarRef.current) outputRmsBarRef.current.style.width = '0%';
        if (outputRmsTextRef.current) {
          outputRmsTextRef.current.textContent = '-INF';
          outputRmsTextRef.current.className = 'font-mono text-[6px] text-white/40 font-bold';
        }
        if (outputRmsArcRef.current) {
          outputRmsArcRef.current.setAttribute('stroke-dashoffset', '85');
          outputRmsArcRef.current.style.opacity = '0.15';
        }
        if (outputRmsBadgeTextRef.current) {
          outputRmsBadgeTextRef.current.textContent = 'RMS -INF';
        }
      }

      // Reset Integrated LUFS ITU-R BS.1770-4 accumulator
      integratedState.current = {
        blockPowers: [],
        blockAccumulator: 0,
        blockSampleCount: 0,
        elapsedGatedSeconds: 0,
        currentIntegratedLUFS: -Infinity,
        currentShortTermLUFS: -Infinity,
        currentMomentaryLUFS: -Infinity,
        lastGatedCalcTime: 0
      };
      if (integratedLufsTextRef.current) {
        integratedLufsTextRef.current.textContent = '--.- LUFS';
        integratedLufsTextRef.current.className = 'font-mono text-[9px] font-bold text-white/40';
      }
      if (integratedDeltaTextRef.current) {
        integratedDeltaTextRef.current.textContent = 'Δ ±0.0 LU';
        integratedDeltaTextRef.current.className = 'font-mono text-[7px] text-white/30';
      }
      if (integratedStatusBadgeRef.current) {
        integratedStatusBadgeRef.current.textContent = 'RESET';
        integratedStatusBadgeRef.current.className = 'px-1.5 py-0.5 rounded text-[6px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30';
        setTimeout(() => {
          if (integratedStatusBadgeRef.current && !isPlaying) {
            integratedStatusBadgeRef.current.textContent = 'STANDBY';
            integratedStatusBadgeRef.current.className = 'px-1.5 py-0.5 rounded text-[6px] font-mono font-bold bg-white/5 text-white/40 border border-white/5';
          }
        }, 600);
      }
      if (integratedBarFillRef.current) {
        integratedBarFillRef.current.style.width = '0%';
      }
      if (momentaryLufsTextRef.current) momentaryLufsTextRef.current.textContent = 'M: -INF';
      if (shortTermLufsTextRef.current) shortTermLufsTextRef.current.textContent = 'S: -INF';
      if (integratedElapsedTextRef.current) integratedElapsedTextRef.current.textContent = '00:00';
      if (centerIntegratedValRef.current) centerIntegratedValRef.current.textContent = '--.-';
      if (centerIntegratedDeltaRef.current) centerIntegratedDeltaRef.current.textContent = '±0.0';

      setOutputResetFlash(true);
      setTimeout(() => setOutputResetFlash(false), 250);
    }

    if (targetChannel === 'all' && centerIntegrityBadgeRef.current) {
      centerIntegrityBadgeRef.current.className = 'w-full flex items-center justify-between px-1 py-0.5 rounded bg-black/60 border border-white/5 hover:border-white/20 transition-all cursor-pointer select-none';
      const valEl = centerIntegrityBadgeRef.current.querySelector('.tp-status-val');
      if (valEl) {
        valEl.textContent = 'CLEAN (<0 dBTP)';
        valEl.className = 'tp-status-val font-mono text-[6px] text-emerald-400 font-bold';
      }
    }
  };

  // RequestAnimationFrame measurement, K-weighting DSP, and physics ballistics loop
  useEffect(() => {
    const inputFloatData = new Float32Array(512);
    const outputFloatData = new Float32Array(512);

    // Ballistics constants for physical meter movement:
    // Classic VU specs: 300ms rise time with negligible overshoot.
    const tension = 0.082; // restorative spring force
    const friction = 0.81; // damping

    const updateEngine = () => {
      let targetInputAngle = -50;
      let targetOutputAngle = -50;
      let targetInputPeakAngle = -50;
      let targetOutputPeakAngle = -50;

      let currentInputMetric = -Infinity;
      let currentOutputMetric = -Infinity;
      let currentInputPeakDb = -Infinity;
      let currentOutputPeakDb = -Infinity;

      const now = performance.now();
      let holdDurationMs = 2000;
      if (peakHoldMode === '5s') holdDurationMs = 5000;
      else if (peakHoldMode === 'INF') holdDurationMs = Infinity;
      else if (peakHoldMode === 'OFF') holdDurationMs = 0;

      if (isPlaying && audioBuffer) {
        // --- 1. PROCESS INPUT (DRY / RAW) ---
        if (inputAnalyserRef.current) {
          const analyser = inputAnalyserRef.current;
          analyser.getFloatTimeDomainData(inputFloatData);

          // 4x oversampled True Peak detection on Input
          const tpResult = calculateTruePeak(inputFloatData);
          currentInputPeakDb = tpResult.samplePeak > 1e-5 ? 20 * Math.log10(tpResult.samplePeak) : -100;

          inputTruePeakState.current.currentDbTP = tpResult.truePeakDb;
          if (tpResult.truePeakDb > inputTruePeakState.current.maxDbTP) {
            inputTruePeakState.current.maxDbTP = tpResult.truePeakDb;
          }
          if (tpResult.truePeakDb >= TRUE_PEAK_CLIP_THRESHOLD) {
            inputTruePeakState.current.isClipped = true;
            inputTruePeakState.current.clipCount++;
          }

          let sumSq = 0;
          for (let i = 0; i < inputFloatData.length; i++) {
            const val = inputFloatData[i];
            sumSq += val * val;
          }

          // Continuous sustained RMS integration (AES-17 300ms window)
          const rawInputRms = Math.sqrt(sumSq / inputFloatData.length);
          if (rawInputRms > inputSustainedRmsRef.current) {
            inputSustainedRmsRef.current += (rawInputRms - inputSustainedRmsRef.current) * 0.08;
          } else {
            inputSustainedRmsRef.current += (rawInputRms - inputSustainedRmsRef.current) * 0.04;
          }

          // Compute Metric according to Scale Mode
          if (scaleMode === 'LUFS') {
            // Apply ITU-R BS.1770 K-weighting pre-filter
            const s = inputFilterState.current;
            let kSumSq = 0;
            for (let i = 0; i < inputFloatData.length; i++) {
              const x = inputFloatData[i];
              // Stage 1: High shelf
              const y1 = B1_0 * x + s[0];
              s[0] = B1_1 * x - A1_1 * y1 + s[1];
              s[1] = B1_2 * x - A1_2 * y1;

              // Stage 2: High pass RLB
              const y2 = B2_0 * y1 + s[2];
              s[2] = B2_1 * y1 - A2_1 * y2 + s[3];
              s[3] = B2_2 * y1 - A2_2 * y2;

              kSumSq += y2 * y2;
            }
            const kMeanSq = kSumSq / inputFloatData.length;
            const lufs = kMeanSq > 1e-10 ? -0.691 + 10 * Math.log10(kMeanSq) : -100;
            currentInputMetric = lufs;

            // Needle angle mapping relative to selected target
            const delta = lufs - selectedTarget; // 0 LU = target
            const norm = Math.max(0, Math.min(1.2, (delta + 12) / 18));
            targetInputAngle = -50 + Math.pow(norm, 1.25) * 88;

            // Peak angle relative to target
            const peakDelta = currentInputPeakDb - selectedTarget;
            const peakNorm = Math.max(0, Math.min(1.2, (peakDelta + 12) / 18));
            targetInputPeakAngle = -50 + Math.pow(peakNorm, 1.25) * 88;
          } else if (scaleMode === 'RMS') {
            // Standard AES-17 RMS
            const rms = Math.sqrt(sumSq / inputFloatData.length);
            const rmsDb = rms > 1e-5 ? 20 * Math.log10(rms) : -100;
            currentInputMetric = rmsDb;

            const norm = Math.max(0, Math.min(1.2, (rmsDb + 32) / 34));
            targetInputAngle = -50 + Math.pow(norm, 1.35) * 88;

            const peakNorm = Math.max(0, Math.min(1.2, (currentInputPeakDb + 32) / 34));
            targetInputPeakAngle = -50 + Math.pow(peakNorm, 1.35) * 88;
          } else {
            // Classic VU mode
            const rms = Math.sqrt(sumSq / inputFloatData.length);
            const rmsDb = rms > 1e-5 ? 20 * Math.log10(rms) : -100;
            const vu = rmsDb - (settings.lufsTarget || -14);
            currentInputMetric = vu;

            const norm = Math.max(0, Math.min(1.2, (vu + 20) / 23));
            targetInputAngle = -50 + Math.pow(norm, 1.45) * 90;

            const peakVu = currentInputPeakDb - (settings.lufsTarget || -14);
            const peakNorm = Math.max(0, Math.min(1.2, (peakVu + 20) / 23));
            targetInputPeakAngle = -50 + Math.pow(peakNorm, 1.45) * 90;
          }
        }

        // --- 2. PROCESS OUTPUT (WET / MASTERED) ---
        if (outputAnalyserRef.current) {
          const analyser = outputAnalyserRef.current;
          analyser.getFloatTimeDomainData(outputFloatData);

          // 4x oversampled True Peak detection on Master output
          const tpResult = calculateTruePeak(outputFloatData);
          currentOutputPeakDb = tpResult.samplePeak > 1e-5 ? 20 * Math.log10(tpResult.samplePeak) : -100;

          outputTruePeakState.current.currentDbTP = tpResult.truePeakDb;
          if (tpResult.truePeakDb > outputTruePeakState.current.maxDbTP) {
            outputTruePeakState.current.maxDbTP = tpResult.truePeakDb;
          }
          if (tpResult.truePeakDb >= TRUE_PEAK_CLIP_THRESHOLD) {
            outputTruePeakState.current.isClipped = true;
            outputTruePeakState.current.clipCount++;
          }

          let sumSq = 0;
          for (let i = 0; i < outputFloatData.length; i++) {
            const val = outputFloatData[i];
            sumSq += val * val;
          }

          // Continuous sustained RMS integration (AES-17 300ms window)
          const rawOutputRms = Math.sqrt(sumSq / outputFloatData.length);
          if (rawOutputRms > outputSustainedRmsRef.current) {
            outputSustainedRmsRef.current += (rawOutputRms - outputSustainedRmsRef.current) * 0.08;
          } else {
            outputSustainedRmsRef.current += (rawOutputRms - outputSustainedRmsRef.current) * 0.04;
          }

          // Continuous ITU-R BS.1770-4 K-Weighting DSP for Momentary, Short-Term, & Integrated LUFS
          const s = outputFilterState.current;
          let kSumSq = 0;
          for (let i = 0; i < outputFloatData.length; i++) {
            const x = outputFloatData[i];
            const y1 = B1_0 * x + s[0];
            s[0] = B1_1 * x - A1_1 * y1 + s[1];
            s[1] = B1_2 * x - A1_2 * y1;

            const y2 = B2_0 * y1 + s[2];
            s[2] = B2_1 * y1 - A2_1 * y2 + s[3];
            s[3] = B2_2 * y1 - A2_2 * y2;

            kSumSq += y2 * y2;
          }
          const kMeanSq = kSumSq / outputFloatData.length;
          const momentaryLufs = kMeanSq > 1e-10 ? -0.691 + 10 * Math.log10(kMeanSq) : -100;
          integratedState.current.currentMomentaryLUFS = momentaryLufs;

          // Accumulate block power for ITU-R BS.1770-4 gated integration (~100ms blocks at 60fps)
          integratedState.current.blockAccumulator += kMeanSq;
          integratedState.current.blockSampleCount += 1;

          if (integratedState.current.blockSampleCount >= 6) {
            const blockEnergy = integratedState.current.blockAccumulator / integratedState.current.blockSampleCount;
            integratedState.current.blockAccumulator = 0;
            integratedState.current.blockSampleCount = 0;

            // Maintain up to 3600 blocks (~6 minutes of continuous integrated loudness history)
            if (integratedState.current.blockPowers.length >= 3600) {
              integratedState.current.blockPowers.shift();
            }
            integratedState.current.blockPowers.push(blockEnergy);

            // Active duration tracking: counts duration above -70 LUFS (1.172e-7)
            if (blockEnergy >= 1.172e-7) {
              integratedState.current.elapsedGatedSeconds += 0.1;
            }

            // Gated Integrated LUFS computation (ITU-R BS.1770-4 two-stage gate)
            const blocks = integratedState.current.blockPowers;
            const ABS_GATE_POWER = 1.172e-7; // -70 LUFS absolute threshold
            let absSum = 0;
            let absCount = 0;
            for (let b = 0; b < blocks.length; b++) {
              if (blocks[b] >= ABS_GATE_POWER) {
                absSum += blocks[b];
                absCount++;
              }
            }

            if (absCount > 0) {
              const absMeanPower = absSum / absCount;
              const absLoudness = -0.691 + 10 * Math.log10(absMeanPower);

              // Relative gate: -10.0 LU below absolute-gated mean loudness
              const relThresholdPower = Math.pow(10, (absLoudness - 10.0 + 0.691) / 10);
              let relSum = 0;
              let relCount = 0;
              for (let b = 0; b < blocks.length; b++) {
                if (blocks[b] >= ABS_GATE_POWER && blocks[b] >= relThresholdPower) {
                  relSum += blocks[b];
                  relCount++;
                }
              }

              if (relCount > 0) {
                const finalMeanPower = relSum / relCount;
                integratedState.current.currentIntegratedLUFS = -0.691 + 10 * Math.log10(finalMeanPower);
              }
            }

            // Short-Term LUFS: sliding 3-second window (last 30 blocks of 100ms)
            const stCount = Math.min(30, blocks.length);
            if (stCount > 0) {
              let stSum = 0;
              const startIdx = blocks.length - stCount;
              for (let b = startIdx; b < blocks.length; b++) {
                stSum += blocks[b];
              }
              const stMeanPower = stSum / stCount;
              if (stMeanPower > 1e-10) {
                integratedState.current.currentShortTermLUFS = -0.691 + 10 * Math.log10(stMeanPower);
              }
            }
          }

          if (scaleMode === 'LUFS') {
            currentOutputMetric = momentaryLufs;

            const delta = momentaryLufs - selectedTarget;
            const norm = Math.max(0, Math.min(1.2, (delta + 12) / 18));
            targetOutputAngle = -50 + Math.pow(norm, 1.25) * 88;

            const peakDelta = currentOutputPeakDb - selectedTarget;
            const peakNorm = Math.max(0, Math.min(1.2, (peakDelta + 12) / 18));
            targetOutputPeakAngle = -50 + Math.pow(peakNorm, 1.25) * 88;
          } else if (scaleMode === 'RMS') {
            const rms = Math.sqrt(sumSq / outputFloatData.length);
            const rmsDb = rms > 1e-5 ? 20 * Math.log10(rms) : -100;
            currentOutputMetric = rmsDb;

            const norm = Math.max(0, Math.min(1.2, (rmsDb + 32) / 34));
            targetOutputAngle = -50 + Math.pow(norm, 1.35) * 88;

            const peakNorm = Math.max(0, Math.min(1.2, (currentOutputPeakDb + 32) / 34));
            targetOutputPeakAngle = -50 + Math.pow(peakNorm, 1.35) * 88;
          } else {
            const rms = Math.sqrt(sumSq / outputFloatData.length);
            const rmsDb = rms > 1e-5 ? 20 * Math.log10(rms) : -100;
            const vu = rmsDb - (settings.lufsTarget || -14);
            currentOutputMetric = vu;

            const norm = Math.max(0, Math.min(1.2, (vu + 20) / 23));
            targetOutputAngle = -50 + Math.pow(norm, 1.45) * 90;

            const peakVu = currentOutputPeakDb - (settings.lufsTarget || -14);
            const peakNorm = Math.max(0, Math.min(1.2, (peakVu + 20) / 23));
            targetOutputPeakAngle = -50 + Math.pow(peakNorm, 1.45) * 90;
          }
        }
      } else {
        inputSustainedRmsRef.current *= 0.88;
        outputSustainedRmsRef.current *= 0.88;
      }

      // --- 3. PEAK HOLD CALCULATIONS ---
      // Input Peak Hold
      if (currentInputPeakDb > inputPeakState.current.peakDb) {
        inputPeakState.current.peakDb = currentInputPeakDb;
        inputPeakState.current.peakAngle = targetInputPeakAngle;
        inputPeakState.current.holdExpiry = now + holdDurationMs;
      } else if (now > inputPeakState.current.holdExpiry && peakHoldMode !== 'INF') {
        inputPeakState.current.peakDb = Math.max(-100, inputPeakState.current.peakDb - 0.35);
        inputPeakState.current.peakAngle = Math.max(-50, inputPeakState.current.peakAngle - 0.5);
      }

      // Output Peak Hold
      if (currentOutputPeakDb > outputPeakState.current.peakDb) {
        outputPeakState.current.peakDb = currentOutputPeakDb;
        outputPeakState.current.peakAngle = targetOutputPeakAngle;
        outputPeakState.current.holdExpiry = now + holdDurationMs;
      } else if (now > outputPeakState.current.holdExpiry && peakHoldMode !== 'INF') {
        outputPeakState.current.peakDb = Math.max(-100, outputPeakState.current.peakDb - 0.35);
        outputPeakState.current.peakAngle = Math.max(-50, outputPeakState.current.peakAngle - 0.5);
      }

      // --- 4. APPLY TACTILE INERTIA & SPRING PHYSICS TO NEEDLES ---
      // Input Needle
      const inputForce = (targetInputAngle - inputState.current.angle) * tension;
      inputState.current.velocity = inputState.current.velocity * friction + inputForce;
      inputState.current.angle += inputState.current.velocity;
      if (inputState.current.angle < -53) inputState.current.angle = -53;
      if (inputState.current.angle > 43) inputState.current.angle = 43;

      // Output Needle
      const outputForce = (targetOutputAngle - outputState.current.angle) * tension;
      outputState.current.velocity = outputState.current.velocity * friction + outputForce;
      outputState.current.angle += outputState.current.velocity;
      if (outputState.current.angle < -53) outputState.current.angle = -53;
      if (outputState.current.angle > 43) outputState.current.angle = 43;

      // --- 5. CLIP LED LAWS (-0.2 dBFS Sample / 0.0 dBTP True Peak Threshold) ---
      const clipThresholdDb = -0.2;
      if (currentInputPeakDb >= clipThresholdDb || inputTruePeakState.current.isClipped) {
        inputClipState.current.lit = true;
        inputClipState.current.value = 1.0;
      } else {
        inputClipState.current.value = Math.max(0, inputClipState.current.value - 0.02);
      }

      if (currentOutputPeakDb >= clipThresholdDb || outputTruePeakState.current.isClipped) {
        outputClipState.current.lit = true;
        outputClipState.current.value = 1.0;
      } else {
        outputClipState.current.value = Math.max(0, outputClipState.current.value - 0.02);
      }

      // --- 6. FLUSH VISUALS DIRECTLY TO SVG & DOM ---
      const needleLength = 48;
      const pivotY = 70;
      const pivotX = 100;

      // Input Needle
      if (inputNeedleRef.current) {
        const rad = ((inputState.current.angle - 90) * Math.PI) / 180;
        const x2 = pivotX + needleLength * Math.cos(rad);
        const y2 = pivotY + needleLength * Math.sin(rad);
        inputNeedleRef.current.setAttribute('x2', x2.toFixed(2));
        inputNeedleRef.current.setAttribute('y2', y2.toFixed(2));
      }

      // Output Needle
      if (outputNeedleRef.current) {
        const rad = ((outputState.current.angle - 90) * Math.PI) / 180;
        const x2 = pivotX + needleLength * Math.cos(rad);
        const y2 = pivotY + needleLength * Math.sin(rad);
        outputNeedleRef.current.setAttribute('x2', x2.toFixed(2));
        outputNeedleRef.current.setAttribute('y2', y2.toFixed(2));
      }

      // Input Peak Hold Tick Marker on Arc
      if (inputPeakMarkerRef.current) {
        const peakAngle = inputPeakState.current.peakAngle;
        if (isPlaying && audioBuffer && peakAngle > -48 && peakHoldMode !== 'OFF') {
          const rad = ((peakAngle - 90) * Math.PI) / 180;
          const x1 = pivotX + 46 * Math.cos(rad);
          const y1 = pivotY + 46 * Math.sin(rad);
          const x2 = pivotX + 59 * Math.cos(rad);
          const y2 = pivotY + 59 * Math.sin(rad);
          inputPeakMarkerRef.current.setAttribute('x1', x1.toFixed(2));
          inputPeakMarkerRef.current.setAttribute('y1', y1.toFixed(2));
          inputPeakMarkerRef.current.setAttribute('x2', x2.toFixed(2));
          inputPeakMarkerRef.current.setAttribute('y2', y2.toFixed(2));
          const isClip = inputPeakState.current.peakDb >= clipThresholdDb;
          inputPeakMarkerRef.current.setAttribute('stroke', isClip ? '#ef4444' : '#f59e0b');
          inputPeakMarkerRef.current.style.opacity = '1';

          if (inputPeakPipRef.current) {
            inputPeakPipRef.current.setAttribute('cx', x2.toFixed(2));
            inputPeakPipRef.current.setAttribute('cy', y2.toFixed(2));
            inputPeakPipRef.current.setAttribute('fill', isClip ? '#ef4444' : '#f59e0b');
            inputPeakPipRef.current.style.opacity = '1';
          }
        } else {
          inputPeakMarkerRef.current.style.opacity = '0';
          if (inputPeakPipRef.current) inputPeakPipRef.current.style.opacity = '0';
        }
      }

      // Input On-Dial Peak Hold Badge
      if (inputPeakBadgeRef.current && inputPeakBadgeTextRef.current) {
        const held = inputPeakState.current.peakDb;
        if (isPlaying && audioBuffer && held > -60 && peakHoldMode !== 'OFF') {
          const isClip = held >= clipThresholdDb;
          inputPeakBadgeRef.current.style.opacity = '1';
          inputPeakBadgeTextRef.current.textContent = isClip 
            ? `CLIP ${held >= 0 ? '+' : ''}${held.toFixed(1)}` 
            : `HOLD ${held.toFixed(1)}`;
          inputPeakBadgeTextRef.current.setAttribute('fill', isClip ? '#ef4444' : '#f59e0b');
          const rect = inputPeakBadgeRef.current.querySelector('rect');
          if (rect) rect.setAttribute('stroke', isClip ? '#ef4444' : '#f59e0b');
        } else {
          inputPeakBadgeRef.current.style.opacity = '0.3';
          inputPeakBadgeTextRef.current.textContent = 'HOLD -INF';
          inputPeakBadgeTextRef.current.setAttribute('fill', '#f59e0b');
          const rect = inputPeakBadgeRef.current.querySelector('rect');
          if (rect) rect.setAttribute('stroke', '#f59e0b');
        }
      }

      // Output Peak Hold Tick Marker on Arc
      if (outputPeakMarkerRef.current) {
        const peakAngle = outputPeakState.current.peakAngle;
        if (isPlaying && audioBuffer && peakAngle > -48 && peakHoldMode !== 'OFF') {
          const rad = ((peakAngle - 90) * Math.PI) / 180;
          const x1 = pivotX + 46 * Math.cos(rad);
          const y1 = pivotY + 46 * Math.sin(rad);
          const x2 = pivotX + 59 * Math.cos(rad);
          const y2 = pivotY + 59 * Math.sin(rad);
          outputPeakMarkerRef.current.setAttribute('x1', x1.toFixed(2));
          outputPeakMarkerRef.current.setAttribute('y1', y1.toFixed(2));
          outputPeakMarkerRef.current.setAttribute('x2', x2.toFixed(2));
          outputPeakMarkerRef.current.setAttribute('y2', y2.toFixed(2));
          const isClip = outputPeakState.current.peakDb >= clipThresholdDb;
          outputPeakMarkerRef.current.setAttribute('stroke', isClip ? '#ef4444' : '#f59e0b');
          outputPeakMarkerRef.current.style.opacity = '1';

          if (outputPeakPipRef.current) {
            outputPeakPipRef.current.setAttribute('cx', x2.toFixed(2));
            outputPeakPipRef.current.setAttribute('cy', y2.toFixed(2));
            outputPeakPipRef.current.setAttribute('fill', isClip ? '#ef4444' : '#f59e0b');
            outputPeakPipRef.current.style.opacity = '1';
          }
        } else {
          outputPeakMarkerRef.current.style.opacity = '0';
          if (outputPeakPipRef.current) outputPeakPipRef.current.style.opacity = '0';
        }
      }

      // Output On-Dial Peak Hold Badge
      if (outputPeakBadgeRef.current && outputPeakBadgeTextRef.current) {
        const held = outputPeakState.current.peakDb;
        if (isPlaying && audioBuffer && held > -60 && peakHoldMode !== 'OFF') {
          const isClip = held >= clipThresholdDb;
          outputPeakBadgeRef.current.style.opacity = '1';
          outputPeakBadgeTextRef.current.textContent = isClip 
            ? `CLIP ${held >= 0 ? '+' : ''}${held.toFixed(1)}` 
            : `HOLD ${held.toFixed(1)}`;
          outputPeakBadgeTextRef.current.setAttribute('fill', isClip ? '#ef4444' : '#f59e0b');
          const rect = outputPeakBadgeRef.current.querySelector('rect');
          if (rect) rect.setAttribute('stroke', isClip ? '#ef4444' : '#f59e0b');
        } else {
          outputPeakBadgeRef.current.style.opacity = '0.3';
          outputPeakBadgeTextRef.current.textContent = 'HOLD -INF';
          outputPeakBadgeTextRef.current.setAttribute('fill', '#f59e0b');
          const rect = outputPeakBadgeRef.current.querySelector('rect');
          if (rect) rect.setAttribute('stroke', '#f59e0b');
        }
      }

      // Input Numeric Peak Readout
      if (inputPeakTextRef.current) {
        const held = inputPeakState.current.peakDb;
        if (!isPlaying || !audioBuffer || held <= -70) {
          inputPeakTextRef.current.textContent = 'PK -INF';
          inputPeakTextRef.current.className = 'font-mono text-[6.5px] text-white/40 font-bold';
        } else if (held >= clipThresholdDb) {
          inputPeakTextRef.current.textContent = `CLIP ${held >= 0 ? '+' : ''}${held.toFixed(1)}`;
          inputPeakTextRef.current.className = 'font-mono text-[6.5px] font-black text-red-500 animate-pulse';
        } else {
          inputPeakTextRef.current.textContent = `HOLD ${held.toFixed(1)}`;
          inputPeakTextRef.current.className = held >= -1.0 
            ? 'font-mono text-[6.5px] font-bold text-amber-400' 
            : 'font-mono text-[6.5px] font-bold text-emerald-400';
        }
      }

      // Output Numeric Peak Readout
      if (outputPeakTextRef.current) {
        const held = outputPeakState.current.peakDb;
        if (!isPlaying || !audioBuffer || held <= -70) {
          outputPeakTextRef.current.textContent = 'PK -INF';
          outputPeakTextRef.current.className = 'font-mono text-[6.5px] text-white/40 font-bold';
        } else if (held >= clipThresholdDb) {
          outputPeakTextRef.current.textContent = `CLIP ${held >= 0 ? '+' : ''}${held.toFixed(1)}`;
          outputPeakTextRef.current.className = 'font-mono text-[6.5px] font-black text-red-500 animate-pulse';
        } else {
          outputPeakTextRef.current.textContent = `HOLD ${held.toFixed(1)}`;
          outputPeakTextRef.current.className = held >= -1.0 
            ? 'font-mono text-[6.5px] font-bold text-amber-400' 
            : 'font-mono text-[6.5px] font-bold text-emerald-400';
        }
      }

      // True Peak (dBTP) Real-Time & Post-Processing Readouts
      if (inputTruePeakTextRef.current) {
        const inMaxTP = inputTruePeakState.current.maxDbTP;
        const inCurTP = inputTruePeakState.current.currentDbTP;
        const isClipped = inputTruePeakState.current.isClipped;

        if (inMaxTP <= -70) {
          inputTruePeakTextRef.current.textContent = '-INF';
          inputTruePeakTextRef.current.className = 'font-mono text-[7px] text-white/40 font-bold';
        } else if (isClipped) {
          inputTruePeakTextRef.current.textContent = `+${Math.max(0, inMaxTP).toFixed(2)}`;
          inputTruePeakTextRef.current.className = 'font-mono text-[7px] font-black text-red-500 animate-pulse';
        } else {
          const displayTP = isPlaying ? inCurTP : inMaxTP;
          inputTruePeakTextRef.current.textContent = `${displayTP >= 0 ? '+' : ''}${displayTP.toFixed(1)}`;
          inputTruePeakTextRef.current.className = displayTP >= TRUE_PEAK_WARN_THRESHOLD
            ? 'font-mono text-[7px] font-bold text-amber-400'
            : 'font-mono text-[7px] font-bold text-emerald-400';
        }
      }

      if (outputTruePeakTextRef.current) {
        const outMaxTP = outputTruePeakState.current.maxDbTP;
        const outCurTP = outputTruePeakState.current.currentDbTP;
        const isClipped = outputTruePeakState.current.isClipped;

        if (outMaxTP <= -70) {
          outputTruePeakTextRef.current.textContent = '-INF';
          outputTruePeakTextRef.current.className = 'font-mono text-[7px] text-white/40 font-bold';
        } else if (isClipped) {
          outputTruePeakTextRef.current.textContent = `+${Math.max(0, outMaxTP).toFixed(2)}`;
          outputTruePeakTextRef.current.className = 'font-mono text-[7px] font-black text-red-500 animate-pulse';
        } else {
          const displayTP = isPlaying ? outCurTP : outMaxTP;
          outputTruePeakTextRef.current.textContent = `${displayTP >= 0 ? '+' : ''}${displayTP.toFixed(1)}`;
          outputTruePeakTextRef.current.className = displayTP >= TRUE_PEAK_WARN_THRESHOLD
            ? 'font-mono text-[7px] font-bold text-amber-400'
            : 'font-mono text-[7px] font-bold text-emerald-400';
        }
      }

      // Input & Output In-Dial True Peak 0 dBTP Clip Flags
      if (inputTruePeakClipFlagRef.current) {
        if (inputTruePeakState.current.isClipped) {
          inputTruePeakClipFlagRef.current.style.opacity = '1';
        } else {
          inputTruePeakClipFlagRef.current.style.opacity = isPlaying && inputTruePeakState.current.currentDbTP >= TRUE_PEAK_WARN_THRESHOLD ? '0.6' : '0.25';
        }
      }
      if (outputTruePeakClipFlagRef.current) {
        if (outputTruePeakState.current.isClipped) {
          outputTruePeakClipFlagRef.current.style.opacity = '1';
        } else {
          outputTruePeakClipFlagRef.current.style.opacity = isPlaying && outputTruePeakState.current.currentDbTP >= TRUE_PEAK_WARN_THRESHOLD ? '0.6' : '0.25';
        }
      }

      // Center Console True Peak Signal Integrity Badge
      if (centerIntegrityBadgeRef.current) {
        const isOutClipped = outputTruePeakState.current.isClipped;
        const maxOutTP = outputTruePeakState.current.maxDbTP;
        const valEl = centerIntegrityBadgeRef.current.querySelector('.tp-status-val');

        if (isOutClipped) {
          centerIntegrityBadgeRef.current.className = 'w-full flex items-center justify-between px-1 py-0.5 rounded bg-red-950/50 border border-red-500/60 shadow-[0_0_8px_rgba(239,68,68,0.4)] transition-all cursor-pointer select-none animate-pulse';
          if (valEl) {
            valEl.textContent = `⚠️ CLIP (+${Math.max(0, maxOutTP).toFixed(2)} dBTP)`;
            valEl.className = 'tp-status-val font-mono text-[6px] text-red-400 font-black';
          }
        } else if (maxOutTP > -70) {
          const isWarning = maxOutTP >= TRUE_PEAK_WARN_THRESHOLD;
          centerIntegrityBadgeRef.current.className = isWarning 
            ? 'w-full flex items-center justify-between px-1 py-0.5 rounded bg-amber-950/30 border border-amber-500/30 hover:border-amber-500/50 transition-all cursor-pointer select-none'
            : 'w-full flex items-center justify-between px-1 py-0.5 rounded bg-emerald-950/30 border border-emerald-500/30 hover:border-emerald-500/50 transition-all cursor-pointer select-none';
          if (valEl) {
            valEl.textContent = `${maxOutTP.toFixed(2)} dBTP ${isWarning ? 'WARN' : 'CLEAN'}`;
            valEl.className = isWarning 
              ? 'tp-status-val font-mono text-[6px] text-amber-400 font-bold'
              : 'tp-status-val font-mono text-[6px] text-emerald-400 font-bold';
          }
        } else {
          centerIntegrityBadgeRef.current.className = 'w-full flex items-center justify-between px-1 py-0.5 rounded bg-black/60 border border-white/5 hover:border-white/20 transition-all cursor-pointer select-none';
          if (valEl) {
            valEl.textContent = 'CLEAN (<0 dBTP)';
            valEl.className = 'tp-status-val font-mono text-[6px] text-emerald-400 font-bold';
          }
        }
      }

      // Input LED update
      if (inputClippingLedRef.current) {
        const isClipped = inputTruePeakState.current.isClipped;
        const alpha = Math.max(inputClipState.current.value, isClipped ? 1.0 : 0);
        if (alpha > 0) {
          inputClippingLedRef.current.style.backgroundColor = isClipped ? '#ef4444' : `rgb(${Math.round(239 * alpha + 15 * (1 - alpha))}, ${Math.round(68 * alpha + 1 * (1 - alpha))}, ${Math.round(68 * alpha + 1 * (1 - alpha))})`;
          inputClippingLedRef.current.style.boxShadow = isClipped
            ? '0 0 14px rgba(239, 68, 68, 1), inset 0 0 3px rgba(255, 255, 255, 0.8)'
            : `0 0 ${Math.round(12 * alpha)}px rgba(239, 68, 68, ${alpha}), inset 0 0 2px rgba(255, 255, 255, ${0.4 * alpha})`;
        } else {
          inputClippingLedRef.current.style.backgroundColor = '#1e0505';
          inputClippingLedRef.current.style.boxShadow = 'inset 0 0 3px rgba(0,0,0,0.9)';
        }
      }

      // Output LED update (Latches clipping even after audio stops!)
      if (outputClippingLedRef.current) {
        const isClipped = outputTruePeakState.current.isClipped;
        const alpha = Math.max(outputClipState.current.value, isClipped ? 1.0 : 0);
        if (alpha > 0) {
          outputClippingLedRef.current.style.backgroundColor = isClipped ? '#ef4444' : `rgb(${Math.round(239 * alpha + 15 * (1 - alpha))}, ${Math.round(68 * alpha + 1 * (1 - alpha))}, ${Math.round(68 * alpha + 1 * (1 - alpha))})`;
          outputClippingLedRef.current.style.boxShadow = isClipped
            ? '0 0 14px rgba(239, 68, 68, 1), inset 0 0 3px rgba(255, 255, 255, 0.8)'
            : `0 0 ${Math.round(12 * alpha)}px rgba(239, 68, 68, ${alpha}), inset 0 0 2px rgba(255, 255, 255, ${0.4 * alpha})`;
        } else {
          outputClippingLedRef.current.style.backgroundColor = '#1e0505';
          outputClippingLedRef.current.style.boxShadow = 'inset 0 0 3px rgba(0,0,0,0.9)';
        }
      }

      // In-Dial Digital Readout
      if (inputDbTextRef.current) {
        if (!isPlaying || !audioBuffer || currentInputMetric <= -80) {
          inputDbTextRef.current.textContent = 'OFF';
        } else if (scaleMode === 'LUFS') {
          inputDbTextRef.current.textContent = `${currentInputMetric.toFixed(1)} LUFS`;
        } else if (scaleMode === 'RMS') {
          inputDbTextRef.current.textContent = `${currentInputMetric.toFixed(1)} dB`;
        } else {
          inputDbTextRef.current.textContent = `${currentInputMetric >= 0 ? '+' : ''}${currentInputMetric.toFixed(1)} VU`;
        }
      }

      if (outputDbTextRef.current) {
        if (!isPlaying || !audioBuffer || currentOutputMetric <= -80) {
          outputDbTextRef.current.textContent = 'OFF';
        } else if (scaleMode === 'LUFS') {
          outputDbTextRef.current.textContent = `${currentOutputMetric.toFixed(1)} LUFS`;
        } else if (scaleMode === 'RMS') {
          outputDbTextRef.current.textContent = `${currentOutputMetric.toFixed(1)} dB`;
        } else {
          outputDbTextRef.current.textContent = `${currentOutputMetric >= 0 ? '+' : ''}${currentOutputMetric.toFixed(1)} VU`;
        }
      }

      // --- 6B. SUSTAINED RMS LOUDNESS METERS (AES-17 300ms INTEGRATION) ---
      const inputSustainedRmsDb = inputSustainedRmsRef.current > 1e-5
        ? 20 * Math.log10(inputSustainedRmsRef.current)
        : -100;
      const outputSustainedRmsDb = outputSustainedRmsRef.current > 1e-5
        ? 20 * Math.log10(outputSustainedRmsRef.current)
        : -100;

      const inputRmsNorm = isPlaying && audioBuffer && inputSustainedRmsDb > -40 
        ? Math.max(0, Math.min(1, (inputSustainedRmsDb + 36) / 36)) 
        : 0;
      const outputRmsNorm = isPlaying && audioBuffer && outputSustainedRmsDb > -40 
        ? Math.max(0, Math.min(1, (outputSustainedRmsDb + 36) / 36)) 
        : 0;

      // 1. Horizontal RMS Level Bars inside dial footer/overlay
      if (inputRmsBarRef.current) {
        inputRmsBarRef.current.style.width = `${(inputRmsNorm * 100).toFixed(1)}%`;
      }
      if (outputRmsBarRef.current) {
        outputRmsBarRef.current.style.width = `${(outputRmsNorm * 100).toFixed(1)}%`;
      }

      // 2. Numeric RMS Text Readouts
      if (inputRmsTextRef.current) {
        if (!isPlaying || !audioBuffer || inputSustainedRmsDb <= -40) {
          inputRmsTextRef.current.textContent = '-INF';
          inputRmsTextRef.current.className = 'font-mono text-[6px] text-white/40 font-bold';
        } else {
          inputRmsTextRef.current.textContent = `${inputSustainedRmsDb.toFixed(1)} dB`;
          inputRmsTextRef.current.className = inputSustainedRmsDb >= -6 
            ? 'font-mono text-[6px] text-rose-400 font-black' 
            : inputSustainedRmsDb >= -14 
              ? 'font-mono text-[6px] text-amber-300 font-bold' 
              : 'font-mono text-[6px] text-emerald-400 font-bold';
        }
      }

      if (outputRmsTextRef.current) {
        if (!isPlaying || !audioBuffer || outputSustainedRmsDb <= -40) {
          outputRmsTextRef.current.textContent = '-INF';
          outputRmsTextRef.current.className = 'font-mono text-[6px] text-white/40 font-bold';
        } else {
          outputRmsTextRef.current.textContent = `${outputSustainedRmsDb.toFixed(1)} dB`;
          outputRmsTextRef.current.className = outputSustainedRmsDb >= -6 
            ? 'font-mono text-[6px] text-rose-400 font-black' 
            : outputSustainedRmsDb >= -14 
              ? 'font-mono text-[6px] text-amber-300 font-bold' 
              : 'font-mono text-[6px] text-emerald-400 font-bold';
        }
      }

      // 3. Curved On-Dial RMS Arc Bars (85 unit dasharray)
      const RMS_ARC_LEN = 85;
      if (inputRmsArcRef.current) {
        const offset = (1 - inputRmsNorm) * RMS_ARC_LEN;
        inputRmsArcRef.current.setAttribute('stroke-dashoffset', offset.toFixed(1));
        inputRmsArcRef.current.style.opacity = inputRmsNorm > 0 ? '0.85' : '0.12';
      }
      if (outputRmsArcRef.current) {
        const offset = (1 - outputRmsNorm) * RMS_ARC_LEN;
        outputRmsArcRef.current.setAttribute('stroke-dashoffset', offset.toFixed(1));
        outputRmsArcRef.current.style.opacity = outputRmsNorm > 0 ? '0.85' : '0.12';
      }

      // 4. On-Dial RMS Badges
      if (inputRmsBadgeTextRef.current) {
        inputRmsBadgeTextRef.current.textContent = isPlaying && audioBuffer && inputSustainedRmsDb > -40
          ? `RMS ${inputSustainedRmsDb.toFixed(1)}`
          : 'RMS -INF';
      }
      if (outputRmsBadgeTextRef.current) {
        outputRmsBadgeTextRef.current.textContent = isPlaying && audioBuffer && outputSustainedRmsDb > -40
          ? `RMS ${outputSustainedRmsDb.toFixed(1)}`
          : 'RMS -INF';
      }

      // --- 5. UPDATE INTEGRATED LUFS (ITU-R BS.1770-4) READOUT & COMPLIANCE BADGES ---
      const intVal = integratedState.current.currentIntegratedLUFS;
      const stVal = integratedState.current.currentShortTermLUFS;
      const momVal = integratedState.current.currentMomentaryLUFS;
      const hasMeasuredInt = isFinite(intVal) && intVal > -60;
      const target = selectedTarget;
      const deltaLU = hasMeasuredInt ? intVal - target : 0;
      const sign = deltaLU >= 0 ? '+' : '';

      if (integratedLufsTextRef.current) {
        if (hasMeasuredInt) {
          integratedLufsTextRef.current.textContent = `${intVal.toFixed(1)} LUFS`;
          if (Math.abs(deltaLU) <= 0.6) {
            integratedLufsTextRef.current.className = 'font-mono text-[9px] font-black text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.5)]';
          } else if (Math.abs(deltaLU) <= 1.2) {
            integratedLufsTextRef.current.className = 'font-mono text-[9px] font-bold text-emerald-300';
          } else if (deltaLU > 1.2) {
            integratedLufsTextRef.current.className = 'font-mono text-[9px] font-black text-rose-400 drop-shadow-[0_0_6px_rgba(244,63,94,0.5)]';
          } else {
            integratedLufsTextRef.current.className = 'font-mono text-[9px] font-bold text-amber-300';
          }
        } else {
          integratedLufsTextRef.current.textContent = isPlaying && audioBuffer ? 'MEASURING...' : '--.- LUFS';
          integratedLufsTextRef.current.className = 'font-mono text-[9px] font-bold text-white/40';
        }
      }

      if (integratedDeltaTextRef.current) {
        if (hasMeasuredInt) {
          integratedDeltaTextRef.current.textContent = `Δ ${sign}${deltaLU.toFixed(1)} LU`;
          integratedDeltaTextRef.current.className = Math.abs(deltaLU) <= 1.0 
            ? 'font-mono text-[7px] text-emerald-400 font-bold' 
            : deltaLU > 1.0 
              ? 'font-mono text-[7px] text-rose-400 font-bold' 
              : 'font-mono text-[7px] text-amber-300 font-bold';
        } else {
          integratedDeltaTextRef.current.textContent = 'Δ ±0.0 LU';
          integratedDeltaTextRef.current.className = 'font-mono text-[7px] text-white/30';
        }
      }

      if (integratedStatusBadgeRef.current) {
        if (!isPlaying && !hasMeasuredInt) {
          integratedStatusBadgeRef.current.textContent = 'STANDBY';
          integratedStatusBadgeRef.current.className = 'px-1.5 py-0.5 rounded text-[6px] font-mono font-bold bg-white/5 text-white/40 border border-white/5';
        } else if (!hasMeasuredInt) {
          integratedStatusBadgeRef.current.textContent = 'MEASURING';
          integratedStatusBadgeRef.current.className = 'px-1.5 py-0.5 rounded text-[6px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 animate-pulse';
        } else if (Math.abs(deltaLU) <= 0.6) {
          integratedStatusBadgeRef.current.textContent = '● ON TARGET';
          integratedStatusBadgeRef.current.className = 'px-1.5 py-0.5 rounded text-[6px] font-mono font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.3)]';
        } else if (Math.abs(deltaLU) <= 1.2) {
          integratedStatusBadgeRef.current.textContent = '● COMPLIANT';
          integratedStatusBadgeRef.current.className = 'px-1.5 py-0.5 rounded text-[6px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
        } else if (deltaLU > 1.2) {
          integratedStatusBadgeRef.current.textContent = `▲ HOT (${sign}${deltaLU.toFixed(1)})`;
          integratedStatusBadgeRef.current.className = 'px-1.5 py-0.5 rounded text-[6px] font-mono font-black bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-[0_0_8px_rgba(244,63,94,0.3)]';
        } else {
          integratedStatusBadgeRef.current.textContent = `▼ LOW (${deltaLU.toFixed(1)})`;
          integratedStatusBadgeRef.current.className = 'px-1.5 py-0.5 rounded text-[6px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30';
        }
      }

      if (momentaryLufsTextRef.current) {
        momentaryLufsTextRef.current.textContent = isFinite(momVal) && momVal > -60 
          ? `M: ${momVal.toFixed(1)}` 
          : 'M: -INF';
      }

      if (shortTermLufsTextRef.current) {
        shortTermLufsTextRef.current.textContent = isFinite(stVal) && stVal > -60 
          ? `S: ${stVal.toFixed(1)}` 
          : 'S: -INF';
      }

      if (integratedElapsedTextRef.current) {
        const secs = Math.floor(integratedState.current.elapsedGatedSeconds);
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        integratedElapsedTextRef.current.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      }

      if (integratedBarFillRef.current) {
        if (hasMeasuredInt) {
          const pct = Math.max(0, Math.min(100, ((intVal + 36) / 30) * 100));
          integratedBarFillRef.current.style.width = `${pct}%`;
        } else {
          integratedBarFillRef.current.style.width = '0%';
        }
      }

      if (centerIntegratedValRef.current) {
        centerIntegratedValRef.current.textContent = hasMeasuredInt ? intVal.toFixed(1) : '--.-';
      }
      if (centerIntegratedDeltaRef.current) {
        centerIntegratedDeltaRef.current.textContent = hasMeasuredInt ? `${sign}${deltaLU.toFixed(1)}` : '±0.0';
      }

      // --- 7. DRAW SPECTRAL FREQUENCY BALANCE VISUALIZER ---
      if (spectralCanvasRef.current) {
        const canvas = spectralCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          // Subtle grid
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
          ctx.lineWidth = 1;
          for (let y = 3; y < h; y += 4) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
          }

          // Compute frequency bands
          const numBands = 8;
          const bandValues = new Array(numBands).fill(0);
          
          if (isPlaying && audioBuffer && outputAnalyserRef.current) {
            const freqData = new Uint8Array(128);
            outputAnalyserRef.current.getByteFrequencyData(freqData);

            const bandMaxIndices = [3, 7, 15, 25, 40, 60, 90, 120];
            let startIdx = 1;

            for (let b = 0; b < numBands; b++) {
              const endIdx = bandMaxIndices[b];
              let sum = 0;
              let count = 0;
              for (let i = startIdx; i <= endIdx && i < freqData.length; i++) {
                sum += freqData[i];
                count++;
              }
              bandValues[b] = count > 0 ? sum / count / 255 : 0;
              startIdx = endIdx + 1;
            }
          }

          const decayCoeff = 0.045;
          for (let b = 0; b < numBands; b++) {
            decayingBandsRef.current[b] = Math.max(
              bandValues[b],
              decayingBandsRef.current[b] - decayCoeff
            );
          }

          // Draw segmented LEDs
          const colWidth = 10;
          const colSpacing = 2;
          const startX = Math.round((w - (numBands * colWidth + (numBands - 1) * colSpacing)) / 2);
          const segHeight = 2.5;
          const segSpacing = 1;
          const numSegments = 5;

          for (let b = 0; b < numBands; b++) {
            const val = decayingBandsRef.current[b];
            const x = startX + b * (colWidth + colSpacing);

            for (let s = 0; s < numSegments; s++) {
              const thresh = (s + 1) / numSegments;
              const lit = val >= thresh;

              let litColor = '#10b981';
              let darkColor = '#12251e';
              
              if (s >= 3 && s < 4) {
                litColor = '#f59e0b';
                darkColor = '#241a0d';
              } else if (s >= 4) {
                litColor = '#ef4444';
                darkColor = '#270e0e';
              }

              const y = h - 2 - s * (segHeight + segSpacing);

              ctx.fillStyle = lit ? litColor : darkColor;
              ctx.fillRect(x, y, colWidth, segHeight);

              if (lit && s === Math.floor(val * numSegments)) {
                ctx.fillStyle = litColor;
                ctx.shadowColor = litColor;
                ctx.shadowBlur = 4;
                ctx.fillRect(x, y, colWidth, segHeight);
                ctx.shadowBlur = 0;
              }
            }
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(updateEngine);
    };

    animationFrameRef.current = requestAnimationFrame(updateEngine);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, audioBuffer, scaleMode, peakHoldMode, selectedTarget, settings.lufsTarget]);

  const glowCoeff = glowIntensity / 100;
  const isWetMode = isEngaged && isPlaying && audioBuffer;

  return (
    <div className="flex flex-col bg-black/75 rounded-xl border border-white/10 shadow-2xl relative select-none overflow-hidden transition-all duration-200 hover:border-white/20">
      
      {/* 1. TOP RACK: CH1 [IN] | CENTER CONSOLE | CH2 [OUT] */}
      <div className="flex items-center gap-3 h-16 px-3.5 pt-1.5 pb-1">
        {/* 1. LEFT PANEL: INPUT VU METER (DRY) */}
      <div className="flex flex-col items-center relative w-[130px] sm:w-[152px]">
        {/* Core Meter Header Panel */}
        <div className="flex items-center justify-between w-full px-1.5 mb-1 bg-black/50 rounded py-0.5 border border-white/5">
          <span className="font-mono text-[7px] font-bold text-white/50 tracking-wider">CH1 [IN]</span>
          
          <div className="flex items-center gap-1">
             <button
               type="button"
               onClick={() => resetPeaks('in')}
               title="Peak Hold CH1 [IN] (dBFS) - Clique para resetar"
               className="px-1.5 py-0.5 rounded bg-black/60 border border-white/10 hover:border-amber-400/50 hover:bg-amber-500/10 transition-all cursor-pointer flex items-center gap-1 group/pk"
             >
               <span className="w-1.5 h-1.5 rounded-full bg-amber-400/70 group-hover/pk:bg-amber-400 animate-pulse" />
               <span ref={inputPeakTextRef} className="font-mono text-[6.5px] text-white/50 font-bold group-hover/pk:text-amber-300">PK -INF</span>
               <RotateCcw className="w-2 h-2 text-white/30 group-hover/pk:text-amber-300 transition-transform group-hover/pk:-rotate-90" />
             </button>

             <button
               type="button"
               onClick={() => resetPeaks('in')}
               title="True Peak CH1 [IN] (dBTP, 4x oversampling) - Clique para resetar"
               className="px-1 py-0.2 rounded bg-black/60 border border-white/5 hover:border-white/20 transition-all cursor-pointer flex items-center gap-0.5"
             >
               <span className="font-mono text-[5.5px] text-white/30">TP</span>
               <span ref={inputTruePeakTextRef} className="font-mono text-[6.5px] text-white/40 font-bold">-INF</span>
             </button>

             <div 
               ref={inputClippingLedRef}
               onClick={() => resetPeaks('in')}
               title="Clipping Indicator (Peak & True Peak > -0.2 dBTP) - Clique para resetar"
               className="w-2 h-2 rounded-full transition-shadow duration-700 cursor-pointer ml-0.5" 
               style={{ backgroundColor: '#1e0505', boxShadow: 'inset 0 0 3px rgba(0,0,0,0.9)' }} 
             />
          </div>
        </div>

        {/* Vintage Dial Artwork Panel with Click-to-Reset Interaction */}
        <div 
          onClick={() => resetPeaks('in')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') resetPeaks('in'); }}
          title="Mostrador Analog VU CH1 [IN] - Clique em qualquer lugar no mostrador para resetar os picos e clip"
          className={`w-full h-10 aspect-video rounded overflow-hidden border relative bg-[#0e0e0e] shadow-inner cursor-pointer group/dial transition-all duration-200 ${
            inputResetFlash 
              ? 'border-amber-400 ring-2 ring-amber-400/50 bg-amber-950/40 shadow-[0_0_12px_rgba(245,158,11,0.5)]' 
              : 'border-white/10 hover:border-amber-400/40 hover:shadow-[0_0_10px_rgba(245,158,11,0.15)]'
          }`}
        >
          {/* Hover tooltip hint: Click to Reset */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[0.5px] opacity-0 group-hover/dial:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-20">
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-[6.5px] font-mono text-amber-300 font-bold tracking-wider shadow-lg backdrop-blur-sm">
              <RotateCcw className="w-2 h-2" />
              CLICK TO RESET
            </span>
          </div>

          {/* Dynamic Glow Overlay backlighting */}
          <div 
            className="absolute inset-0 bg-radial transition-all duration-1000 opacity-60 mix-blend-color-dodge"
            style={{
              from: `rgba(235, 137, 24, ${isPlaying ? 0.35 * glowCoeff : 0.08 * glowCoeff})`,
              to: 'rgba(0,0,0,0)',
              background: `radial-gradient(ellipse at 50% 90%, rgba(220, 107, 10, ${isPlaying ? 0.45 * glowCoeff : 0.1 * glowCoeff}) 0%, rgba(20, 10, 0, 0) 80%)`
            }}
          />

          <svg viewBox="0 0 200 80" className="w-full h-full relative z-10" id="vul-svg">
            <defs>
              <linearGradient id="warmAmberPathIn" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#444" />
                <stop offset="68%" stopColor="#888" />
                <stop offset="70%" stopColor="#dc2626" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
              <linearGradient id="lufsGradientIn" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#444" />
                <stop offset="50%" stopColor="#777" />
                <stop offset="65%" stopColor="#10b981" />
                <stop offset="82%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
              <linearGradient id="rmsGradientIn" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#444" />
                <stop offset="55%" stopColor="#777" />
                <stop offset="75%" stopColor="#f59e0b" />
                <stop offset="90%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#dc2626" />
              </linearGradient>
              <linearGradient id="rmsArcGradientIn" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="60%" stopColor="#10b981" />
                <stop offset="82%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
            </defs>

            {/* True Peak dBTP On-Dial Flag */}
            <g id="in-true-peak-flag" ref={inputTruePeakClipFlagRef} opacity="0.25">
              <rect x="7" y="6" width="30" height="9" rx="2" fill="#180404" stroke="#ef4444" strokeWidth="0.6" />
              <text x="22" y="13" fontSize="5.5" fontFamily="monospace" fontWeight="bold" fill="#ef4444" textAnchor="middle">0 dBTP</text>
            </g>

            {/* On-Dial Sustained RMS Badge */}
            <g id="in-rms-badge" opacity="0.85">
              <rect x="7" y="18" width="30" height="8" rx="2" fill="#061c14" stroke="#10b981" strokeWidth="0.5" strokeOpacity="0.6" />
              <text ref={inputRmsBadgeTextRef} x="22" y="24" fontSize="4.6" fontFamily="monospace" fontWeight="bold" fill="#10b981" textAnchor="middle">RMS -INF</text>
            </g>

            {/* On-Dial Peak Hold Badge */}
            <g id="in-peak-hold-badge" ref={inputPeakBadgeRef} opacity="0.3" className="transition-opacity pointer-events-none">
              <rect x="148" y="6" width="45" height="9" rx="2" fill="#141108" stroke="#f59e0b" strokeWidth="0.6" />
              <text ref={inputPeakBadgeTextRef} x="170.5" y="13" fontSize="5.5" fontFamily="monospace" fontWeight="bold" fill="#f59e0b" textAnchor="middle">HOLD -INF</text>
            </g>

            {/* Scale Arc Line */}
            <path 
              d="M 40 55 A 58 58 0 0 1 160 55" 
              fill="none" 
              stroke={scaleMode === 'LUFS' ? "url(#lufsGradientIn)" : scaleMode === 'RMS' ? "url(#rmsGradientIn)" : "url(#warmAmberPathIn)"} 
              strokeWidth="2.5" 
              strokeLinecap="round"
              opacity="0.85"
            />

            {/* Concentric Sustained RMS Arc Groove & Live Bar */}
            <path 
              d="M 45 58 A 52 52 0 0 1 155 58" 
              fill="none" 
              stroke="rgba(255, 255, 255, 0.07)" 
              strokeWidth="1.8" 
              strokeLinecap="round" 
            />
            <path 
              ref={inputRmsArcRef}
              d="M 45 58 A 52 52 0 0 1 155 58" 
              fill="none" 
              stroke="url(#rmsArcGradientIn)" 
              strokeWidth="1.8" 
              strokeLinecap="round" 
              strokeDasharray="85"
              strokeDashoffset="85"
              className="pointer-events-none drop-shadow-[0_0_2px_rgba(16,185,129,0.7)]"
              style={{ opacity: 0.15 }}
            />

            {/* Division Tic marks & labels */}
            {scaleMode === 'LUFS' ? (
              <>
                <line x1="40" y1="55" x2="43" y2="52" stroke="#666" strokeWidth="1" />
                <line x1="68" y1="37" x2="70" y2="34" stroke="#777" strokeWidth="1" />
                <line x1="92" y1="30" x2="93" y2="26" stroke="#999" strokeWidth="1.2" />
                <line x1="116" y1="30" x2="116" y2="26" stroke="#10b981" strokeWidth="1.5" />
                <line x1="140" y1="37" x2="138" y2="34" stroke="#f59e0b" strokeWidth="1.2" />
                <line x1="160" y1="55" x2="157" y2="52" stroke="#ef4444" strokeWidth="1.5" />

                <text x="36" y="62" fontSize="6.5" fontFamily="monospace" fill="#666" textAnchor="middle">-12</text>
                <text x="66" y="44" fontSize="6.5" fontFamily="monospace" fill="#777" textAnchor="middle">-6</text>
                <text x="91" y="38" fontSize="6.5" fontFamily="monospace" fill="#999" textAnchor="middle">-3</text>
                <text x="117" y="38" fontSize="6.5" fontFamily="monospace" fill="#10b981" fontWeight="bold" textAnchor="middle">0</text>
                <text x="142" y="44" fontSize="6.5" fontFamily="monospace" fill="#f59e0b" fontWeight="bold" textAnchor="middle">+3</text>
                <text x="165" y="62" fontSize="6.5" fontFamily="monospace" fill="#ef4444" fontWeight="bold" textAnchor="middle">+6</text>

                <text x="100" y="51" fontSize="7.5" fontFamily="monospace" fontWeight="900" fill="#38bdf8" opacity="0.8" textAnchor="middle" letterSpacing="0.5">LUFS (M)</text>
              </>
            ) : scaleMode === 'RMS' ? (
              <>
                <line x1="40" y1="55" x2="43" y2="52" stroke="#666" strokeWidth="1" />
                <line x1="68" y1="37" x2="70" y2="34" stroke="#777" strokeWidth="1" />
                <line x1="95" y1="30" x2="96" y2="26" stroke="#999" strokeWidth="1.2" />
                <line x1="126" y1="32" x2="124" y2="29" stroke="#f59e0b" strokeWidth="1.2" />
                <line x1="146" y1="42" x2="143" y2="39" stroke="#ef4444" strokeWidth="1.5" />
                <line x1="160" y1="55" x2="157" y2="52" stroke="#ef4444" strokeWidth="1.5" />

                <text x="36" y="62" fontSize="6.5" fontFamily="monospace" fill="#666" textAnchor="middle">-30</text>
                <text x="66" y="44" fontSize="6.5" fontFamily="monospace" fill="#777" textAnchor="middle">-20</text>
                <text x="94" y="38" fontSize="6.5" fontFamily="monospace" fill="#999" textAnchor="middle">-14</text>
                <text x="127" y="40" fontSize="6.5" fontFamily="monospace" fill="#f59e0b" fontWeight="bold" textAnchor="middle">-6</text>
                <text x="147" y="50" fontSize="6.5" fontFamily="monospace" fill="#ef4444" fontWeight="bold" textAnchor="middle">0</text>
                <text x="165" y="62" fontSize="6.5" fontFamily="monospace" fill="#ef4444" fontWeight="bold" textAnchor="middle">+3</text>

                <text x="100" y="51" fontSize="7.5" fontFamily="monospace" fontWeight="900" fill="#f59e0b" opacity="0.8" textAnchor="middle" letterSpacing="0.5">RMS (AES)</text>
              </>
            ) : (
              <>
                <line x1="40" y1="55" x2="43" y2="52" stroke="#666" strokeWidth="1" />
                <line x1="70" y1="36" x2="72" y2="33" stroke="#666" strokeWidth="1" />
                <line x1="100" y1="29" x2="100" y2="25" stroke="#999" strokeWidth="1.2" />
                <line x1="130" y1="33" x2="128" y2="30" stroke="#dc2626" strokeWidth="1.2" />
                <line x1="160" y1="55" x2="157" y2="52" stroke="#ef4444" strokeWidth="1.5" />

                <text x="36" y="62" fontSize="7" fontFamily="monospace" fill="#666" textAnchor="middle">-20</text>
                <text x="66" y="44" fontSize="7" fontFamily="monospace" fill="#777" textAnchor="middle">-10</text>
                <text x="100" y="37" fontSize="7" fontFamily="monospace" fill="#999" textAnchor="middle">-5</text>
                <text x="133" y="41" fontSize="7" fontFamily="monospace" fill="#dc2626" fontWeight="bold" textAnchor="middle">0</text>
                <text x="164" y="62" fontSize="7" fontFamily="monospace" fill="#ef4444" fontWeight="bold" textAnchor="middle">+3</text>

                <text x="100" y="51" fontSize="8.5" fontFamily="sans-serif" fontWeight="900" fill="#999" opacity="0.6" textAnchor="middle" letterSpacing="0.5">VU</text>
              </>
            )}

            {/* Readout */}
            <text ref={inputDbTextRef} x="100" y="61" fontSize="7" fontFamily="monospace" fill="#a1a1aa" opacity="0.5" textAnchor="middle">OFF</text>

            {/* Peak Hold Tick Marker across the scale arc */}
            <line 
              ref={inputPeakMarkerRef}
              x1="100" 
              y1="70" 
              x2="100" 
              y2="70" 
              stroke="#f59e0b" 
              strokeWidth="3.2" 
              strokeLinecap="round" 
              className="pointer-events-none drop-shadow-[0_0_5px_rgba(245,158,11,0.95)]"
              style={{ opacity: 0 }}
            />

            {/* Peak Hold Pip dot at arc perimeter */}
            <circle
              ref={inputPeakPipRef}
              cx="100"
              cy="70"
              r="2.2"
              fill="#f59e0b"
              className="pointer-events-none drop-shadow-[0_0_4px_rgba(245,158,11,1)]"
              style={{ opacity: 0 }}
            />

            {/* Physical Ballistic Needle */}
            <line 
              ref={inputNeedleRef}
              x1="100" 
              y1="70" 
              x2="65" 
              y2="28" 
              stroke="#e11d48" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] pointer-events-none"
            />

            {/* Cap Anchor Pivot */}
            <circle cx="100" cy="70" r="7" fill="#18181b" stroke="#333" strokeWidth="1" />
            <circle cx="100" cy="70" r="2.5" fill="#71717a" />
          </svg>

          {/* Sustained RMS Level Bar Overlay Strip */}
          <div 
            title="Sustained RMS Loudness CH1 (AES-17 300ms window)" 
            className="absolute bottom-0 inset-x-0 z-20 px-1.5 py-0.5 bg-black/85 backdrop-blur-xs border-t border-white/10 flex items-center justify-between pointer-events-none"
          >
            <div className="flex items-center gap-1 min-w-[42px]">
              <span className="font-mono text-[5.5px] font-black text-emerald-400 tracking-wider">RMS</span>
              <span ref={inputRmsTextRef} className="font-mono text-[6px] text-white/40 font-bold">-INF</span>
            </div>
            <div className="flex-1 mx-1.5 h-1 bg-white/10 rounded-full overflow-hidden p-[0.5px]">
              <div 
                ref={inputRmsBarRef}
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 transition-all duration-75"
                style={{ width: '0%' }}
              />
            </div>
            <span className="font-mono text-[5px] text-white/30 tracking-tight">300ms</span>
          </div>
        </div>
      </div>

      {/* 2. CENTER SECTION: MULTI-SCALE METERING CONSOLE & SPECTRAL ANALYZER */}
      <div className="hidden sm:flex flex-col items-center justify-between border-l border-r border-white/5 px-2.5 select-none h-full w-[148px]">
        {/* Scale Mode Switcher */}
        <div className="flex items-center justify-between w-full pt-0.5">
          <span className="font-mono text-[6px] text-white/30 uppercase tracking-widest">SCALE</span>
          <div className="flex bg-black/60 rounded p-0.5 border border-white/10 gap-0.5">
            {(['LUFS', 'RMS', 'VU'] as VUScaleMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleSetScaleMode(mode)}
                className={`px-1.5 py-0.5 rounded text-[7px] font-mono font-bold transition-all cursor-pointer ${
                  scaleMode === mode
                    ? 'bg-primary text-black shadow-[0_0_8px_rgba(29,185,84,0.4)]'
                    : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Spectral Balance Mini Visualizer */}
        <div className="flex flex-col items-center w-full my-0.5">
          <canvas 
            ref={spectralCanvasRef} 
            width={124} 
            height={20} 
            className="bg-black/90 rounded border border-white/5 w-full"
          />
        </div>

        {/* Real-time True Peak Signal Integrity Badge */}
        <div 
          ref={centerIntegrityBadgeRef}
          onClick={resetPeaks}
          title="Mastering True Peak Signal Integrity Monitor - Click to reset clip latches"
          className="w-full flex items-center justify-between px-1 py-0.5 rounded bg-black/60 border border-white/5 hover:border-white/20 transition-all cursor-pointer select-none"
        >
          <span className="font-mono text-[5.5px] text-white/40 uppercase tracking-wider">TRUE PEAK</span>
          <span className="tp-status-val font-mono text-[6px] text-emerald-400 font-bold">CLEAN (&lt;0 dBTP)</span>
        </div>

        {/* Real-time Integrated LUFS Monitor in Center Console */}
        <div 
          title="Loudness Integrado Medido (ITU-R BS.1770-4)"
          className="w-full flex items-center justify-between px-1 py-0.5 rounded bg-black/40 border border-white/5 my-0.5"
        >
          <span className="font-mono text-[5.5px] text-white/40 uppercase tracking-wider">INT LUFS</span>
          <div className="flex items-center gap-1 font-mono">
            <span ref={centerIntegratedValRef} className="text-[6.5px] text-primary font-bold">--.-</span>
            <span ref={centerIntegratedDeltaRef} className="text-[5.5px] text-white/40">±0.0</span>
          </div>
        </div>

        {/* Bottom controls: Peak Hold mode & Target / Reset */}
        <div className="flex items-center justify-between w-full pb-0.5 text-[6.5px] font-mono">
          {scaleMode === 'LUFS' ? (
            <button
              type="button"
              onClick={handleCycleTarget}
              title="Click to cycle LUFS target (-14 / -16 / -9 / -23)"
              className="px-1 py-0.5 rounded bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/5 transition-colors flex items-center gap-0.5 cursor-pointer"
            >
              <span className="text-white/30">TGT:</span>
              <span className="text-primary font-bold">{selectedTarget}</span>
            </button>
          ) : (
            <span className="text-white/30 tracking-wider">
              {scaleMode === 'RMS' ? 'AES-17' : 'ANSI C16'}
            </span>
          )}

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCyclePeakHold}
              title="Cycle Peak Hold: 2s / 5s / Infinite / Off"
              className="px-1 py-0.5 rounded bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/5 transition-colors flex items-center gap-0.5 cursor-pointer"
            >
              <span className="text-white/30">HOLD:</span>
              <span className="text-amber-400 font-bold">{peakHoldMode}</span>
            </button>

            <button
              type="button"
              onClick={() => resetPeaks('all')}
              title="Resetar todos os medidores de Peak Hold & Clip [Click to Reset All]"
              className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-amber-500/20 hover:text-amber-300 hover:border-amber-500/30 text-white/60 border border-white/5 transition-all font-bold uppercase cursor-pointer flex items-center gap-1 group/rst"
            >
              <RotateCcw className="w-2 h-2 group-hover/rst:-rotate-90 transition-transform" />
              <span>RST</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. RIGHT PANEL: OUTPUT VU METER (WET) */}
      <div className="flex flex-col items-center relative w-[130px] sm:w-[152px]">
        {/* Core Meter Header Panel */}
        <div className="flex items-center justify-between w-full px-1.5 mb-1 bg-black/50 rounded py-0.5 border border-white/5">
          <span className={`font-mono text-[7px] font-bold tracking-wider transition-colors ${isWetMode ? 'text-primary' : 'text-white/50'}`}>
            CH2 [OUT]
          </span>
          
          <div className="flex items-center gap-1">
             <button
               type="button"
               onClick={() => resetPeaks('out')}
               title="Peak Hold CH2 [OUT] (dBFS) - Clique para resetar"
               className="px-1.5 py-0.5 rounded bg-black/60 border border-white/10 hover:border-amber-400/50 hover:bg-amber-500/10 transition-all cursor-pointer flex items-center gap-1 group/pk"
             >
               <span className="w-1.5 h-1.5 rounded-full bg-amber-400/70 group-hover/pk:bg-amber-400 animate-pulse" />
               <span ref={outputPeakTextRef} className="font-mono text-[6.5px] text-white/50 font-bold group-hover/pk:text-amber-300">PK -INF</span>
               <RotateCcw className="w-2 h-2 text-white/30 group-hover/pk:text-amber-300 transition-transform group-hover/pk:-rotate-90" />
             </button>

             <button
               type="button"
               onClick={() => resetPeaks('out')}
               title="True Peak CH2 [OUT] (dBTP, 4x oversampling) - Clique para resetar"
               className="px-1 py-0.2 rounded bg-black/60 border border-white/5 hover:border-white/20 transition-all cursor-pointer flex items-center gap-0.5"
             >
               <span className="font-mono text-[5.5px] text-white/30">TP</span>
               <span ref={outputTruePeakTextRef} className="font-mono text-[6.5px] text-white/40 font-bold">-INF</span>
             </button>

             <div 
               ref={outputClippingLedRef}
               onClick={() => resetPeaks('out')}
               title="Clipping Indicator (Peak & True Peak > -0.2 dBTP) - Clique para resetar"
               className="w-2 h-2 rounded-full transition-shadow duration-700 cursor-pointer ml-0.5" 
               style={{ backgroundColor: '#1e0505', boxShadow: 'inset 0 0 3px rgba(0,0,0,0.9)' }} 
             />
          </div>
        </div>

        {/* Vintage Dial Artwork Panel with Click-to-Reset Interaction */}
        <div 
          onClick={() => resetPeaks('out')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') resetPeaks('out'); }}
          title="Mostrador Analog VU CH2 [OUT] - Clique em qualquer lugar no mostrador para resetar os picos e clip"
          className={`w-full h-10 aspect-video rounded overflow-hidden border relative bg-[#0e0e0e] shadow-inner cursor-pointer group/dial transition-all duration-200 ${
            outputResetFlash 
              ? 'border-amber-400 ring-2 ring-amber-400/50 bg-amber-950/40 shadow-[0_0_12px_rgba(245,158,11,0.5)]' 
              : 'border-white/10 hover:border-amber-400/40 hover:shadow-[0_0_10px_rgba(245,158,11,0.15)]'
          }`}
        >
          {/* Hover tooltip hint: Click to Reset */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[0.5px] opacity-0 group-hover/dial:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-20">
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-[6.5px] font-mono text-amber-300 font-bold tracking-wider shadow-lg backdrop-blur-sm">
              <RotateCcw className="w-2 h-2" />
              CLICK TO RESET
            </span>
          </div>

          {/* Dynamic Glow Overlay backlighting (changes amber color to emerald green if output is fully processed) */}
          <div 
            className="absolute inset-0 bg-radial transition-all duration-1000 opacity-60 mix-blend-color-dodge"
            style={{
              from: isWetMode 
                ? `rgba(29, 185, 84, ${0.35 * glowCoeff})` 
                : `rgba(235, 137, 24, ${isPlaying ? 0.35 * glowCoeff : 0.08 * glowCoeff})`,
              to: 'rgba(0,0,0,0)',
              background: isWetMode
                ? `radial-gradient(ellipse at 50% 90%, rgba(29, 185, 84, ${0.45 * glowCoeff}) 0%, rgba(0, 20, 5, 0) 80%)`
                : `radial-gradient(ellipse at 50% 90%, rgba(220, 107, 10, ${isPlaying ? 0.45 * glowCoeff : 0.1 * glowCoeff}) 0%, rgba(20, 10, 0, 0) 80%)`
            }}
          />

          <svg viewBox="0 0 200 80" className="w-full h-full relative z-10" id="vur-svg">
            <defs>
              <linearGradient id="warmAmberPathOut" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#444" />
                <stop offset="68%" stopColor="#888" />
                <stop offset="70%" stopColor="#dc2626" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
              <linearGradient id="lufsGradientOut" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#444" />
                <stop offset="50%" stopColor="#777" />
                <stop offset="65%" stopColor="#10b981" />
                <stop offset="82%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
              <linearGradient id="rmsGradientOut" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#444" />
                <stop offset="55%" stopColor="#777" />
                <stop offset="75%" stopColor="#f59e0b" />
                <stop offset="90%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#dc2626" />
              </linearGradient>
              <linearGradient id="rmsArcGradientOut" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="60%" stopColor="#10b981" />
                <stop offset="82%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
            </defs>

            {/* True Peak dBTP On-Dial Flag */}
            <g id="out-true-peak-flag" ref={outputTruePeakClipFlagRef} opacity="0.25">
              <rect x="7" y="6" width="30" height="9" rx="2" fill="#180404" stroke="#ef4444" strokeWidth="0.6" />
              <text x="22" y="13" fontSize="5.5" fontFamily="monospace" fontWeight="bold" fill="#ef4444" textAnchor="middle">0 dBTP</text>
            </g>

            {/* On-Dial Sustained RMS Badge */}
            <g id="out-rms-badge" opacity="0.85">
              <rect x="7" y="18" width="30" height="8" rx="2" fill="#061c14" stroke="#10b981" strokeWidth="0.5" strokeOpacity="0.6" />
              <text ref={outputRmsBadgeTextRef} x="22" y="24" fontSize="4.6" fontFamily="monospace" fontWeight="bold" fill="#10b981" textAnchor="middle">RMS -INF</text>
            </g>

            {/* On-Dial Peak Hold Badge */}
            <g id="out-peak-hold-badge" ref={outputPeakBadgeRef} opacity="0.3" className="transition-opacity pointer-events-none">
              <rect x="148" y="6" width="45" height="9" rx="2" fill="#141108" stroke="#f59e0b" strokeWidth="0.6" />
              <text ref={outputPeakBadgeTextRef} x="170.5" y="13" fontSize="5.5" fontFamily="monospace" fontWeight="bold" fill="#f59e0b" textAnchor="middle">HOLD -INF</text>
            </g>

            {/* Scale Arc Line */}
            <path 
              d="M 40 55 A 58 58 0 0 1 160 55" 
              fill="none" 
              stroke={scaleMode === 'LUFS' ? "url(#lufsGradientOut)" : scaleMode === 'RMS' ? "url(#rmsGradientOut)" : "url(#warmAmberPathOut)"} 
              strokeWidth="2.5" 
              strokeLinecap="round"
              opacity="0.85"
            />

            {/* Concentric Sustained RMS Arc Groove & Live Bar */}
            <path 
              d="M 45 58 A 52 52 0 0 1 155 58" 
              fill="none" 
              stroke="rgba(255, 255, 255, 0.07)" 
              strokeWidth="1.8" 
              strokeLinecap="round" 
            />
            <path 
              ref={outputRmsArcRef}
              d="M 45 58 A 52 52 0 0 1 155 58" 
              fill="none" 
              stroke="url(#rmsArcGradientOut)" 
              strokeWidth="1.8" 
              strokeLinecap="round" 
              strokeDasharray="85"
              strokeDashoffset="85"
              className="pointer-events-none drop-shadow-[0_0_2px_rgba(16,185,129,0.7)]"
              style={{ opacity: 0.15 }}
            />

            {/* Division Tic marks & labels */}
            {scaleMode === 'LUFS' ? (
              <>
                <line x1="40" y1="55" x2="43" y2="52" stroke="#666" strokeWidth="1" />
                <line x1="68" y1="37" x2="70" y2="34" stroke="#777" strokeWidth="1" />
                <line x1="92" y1="30" x2="93" y2="26" stroke="#999" strokeWidth="1.2" />
                <line x1="116" y1="30" x2="116" y2="26" stroke="#10b981" strokeWidth="1.5" />
                <line x1="140" y1="37" x2="138" y2="34" stroke="#f59e0b" strokeWidth="1.2" />
                <line x1="160" y1="55" x2="157" y2="52" stroke="#ef4444" strokeWidth="1.5" />

                <text x="36" y="62" fontSize="6.5" fontFamily="monospace" fill="#666" textAnchor="middle">-12</text>
                <text x="66" y="44" fontSize="6.5" fontFamily="monospace" fill="#777" textAnchor="middle">-6</text>
                <text x="91" y="38" fontSize="6.5" fontFamily="monospace" fill="#999" textAnchor="middle">-3</text>
                <text x="117" y="38" fontSize="6.5" fontFamily="monospace" fill="#10b981" fontWeight="bold" textAnchor="middle">0</text>
                <text x="142" y="44" fontSize="6.5" fontFamily="monospace" fill="#f59e0b" fontWeight="bold" textAnchor="middle">+3</text>
                <text x="165" y="62" fontSize="6.5" fontFamily="monospace" fill="#ef4444" fontWeight="bold" textAnchor="middle">+6</text>

                <text x="100" y="51" fontSize="7.5" fontFamily="monospace" fontWeight="900" fill="#38bdf8" opacity="0.8" textAnchor="middle" letterSpacing="0.5">LUFS (M)</text>
              </>
            ) : scaleMode === 'RMS' ? (
              <>
                <line x1="40" y1="55" x2="43" y2="52" stroke="#666" strokeWidth="1" />
                <line x1="68" y1="37" x2="70" y2="34" stroke="#777" strokeWidth="1" />
                <line x1="95" y1="30" x2="96" y2="26" stroke="#999" strokeWidth="1.2" />
                <line x1="126" y1="32" x2="124" y2="29" stroke="#f59e0b" strokeWidth="1.2" />
                <line x1="146" y1="42" x2="143" y2="39" stroke="#ef4444" strokeWidth="1.5" />
                <line x1="160" y1="55" x2="157" y2="52" stroke="#ef4444" strokeWidth="1.5" />

                <text x="36" y="62" fontSize="6.5" fontFamily="monospace" fill="#666" textAnchor="middle">-30</text>
                <text x="66" y="44" fontSize="6.5" fontFamily="monospace" fill="#777" textAnchor="middle">-20</text>
                <text x="94" y="38" fontSize="6.5" fontFamily="monospace" fill="#999" textAnchor="middle">-14</text>
                <text x="127" y="40" fontSize="6.5" fontFamily="monospace" fill="#f59e0b" fontWeight="bold" textAnchor="middle">-6</text>
                <text x="147" y="50" fontSize="6.5" fontFamily="monospace" fill="#ef4444" fontWeight="bold" textAnchor="middle">0</text>
                <text x="165" y="62" fontSize="6.5" fontFamily="monospace" fill="#ef4444" fontWeight="bold" textAnchor="middle">+3</text>

                <text x="100" y="51" fontSize="7.5" fontFamily="monospace" fontWeight="900" fill="#f59e0b" opacity="0.8" textAnchor="middle" letterSpacing="0.5">RMS (AES)</text>
              </>
            ) : (
              <>
                <line x1="40" y1="55" x2="43" y2="52" stroke="#666" strokeWidth="1" />
                <line x1="70" y1="36" x2="72" y2="33" stroke="#666" strokeWidth="1" />
                <line x1="100" y1="29" x2="100" y2="25" stroke="#999" strokeWidth="1.2" />
                <line x1="130" y1="33" x2="128" y2="30" stroke="#dc2626" strokeWidth="1.2" />
                <line x1="160" y1="55" x2="157" y2="52" stroke="#ef4444" strokeWidth="1.5" />

                <text x="36" y="62" fontSize="7" fontFamily="monospace" fill="#666" textAnchor="middle">-20</text>
                <text x="66" y="44" fontSize="7" fontFamily="monospace" fill="#777" textAnchor="middle">-10</text>
                <text x="100" y="37" fontSize="7" fontFamily="monospace" fill="#999" textAnchor="middle">-5</text>
                <text x="133" y="41" fontSize="7" fontFamily="monospace" fill="#dc2626" fontWeight="bold" textAnchor="middle">0</text>
                <text x="164" y="62" fontSize="7" fontFamily="monospace" fill="#ef4444" fontWeight="bold" textAnchor="middle">+3</text>

                <text x="100" y="51" fontSize="8.5" fontFamily="sans-serif" fontWeight="900" fill="#999" opacity="0.6" textAnchor="middle" letterSpacing="0.5">VU</text>
              </>
            )}

            {/* Readout */}
            <text ref={outputDbTextRef} x="100" y="61" fontSize="7" fontFamily="monospace" fill="#a1a1aa" opacity="0.5" textAnchor="middle">OFF</text>

            {/* Peak Hold Tick Marker across the scale arc */}
            <line 
              ref={outputPeakMarkerRef}
              x1="100" 
              y1="70" 
              x2="100" 
              y2="70" 
              stroke="#f59e0b" 
              strokeWidth="3.2" 
              strokeLinecap="round" 
              className="pointer-events-none drop-shadow-[0_0_5px_rgba(245,158,11,0.95)]"
              style={{ opacity: 0 }}
            />

            {/* Peak Hold Pip dot at arc perimeter */}
            <circle
              ref={outputPeakPipRef}
              cx="100"
              cy="70"
              r="2.2"
              fill="#f59e0b"
              className="pointer-events-none drop-shadow-[0_0_4px_rgba(245,158,11,1)]"
              style={{ opacity: 0 }}
            />

            {/* Physical Ballistic Needle */}
            <line 
              ref={outputNeedleRef}
              x1="100" 
              y1="70" 
              x2="65" 
              y2="28" 
              stroke="#e11d48" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] pointer-events-none"
            />

            {/* Cap Anchor Pivot */}
            <circle cx="100" cy="70" r="7" fill="#18181b" stroke="#333" strokeWidth="1" />
            <circle cx="100" cy="70" r="2.5" fill="#71717a" />
          </svg>

          {/* Sustained RMS Level Bar Overlay Strip */}
          <div 
            title="Sustained RMS Loudness CH2 (AES-17 300ms window)" 
            className="absolute bottom-0 inset-x-0 z-20 px-1.5 py-0.5 bg-black/85 backdrop-blur-xs border-t border-white/10 flex items-center justify-between pointer-events-none"
          >
            <div className="flex items-center gap-1 min-w-[42px]">
              <span className="font-mono text-[5.5px] font-black text-emerald-400 tracking-wider">RMS</span>
              <span ref={outputRmsTextRef} className="font-mono text-[6px] text-white/40 font-bold">-INF</span>
            </div>
            <div className="flex-1 mx-1.5 h-1 bg-white/10 rounded-full overflow-hidden p-[0.5px]">
              <div 
                ref={outputRmsBarRef}
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 transition-all duration-75"
                style={{ width: '0%' }}
              />
            </div>
            <span className="font-mono text-[5px] text-white/30 tracking-tight">300ms</span>
          </div>
        </div>
      </div>
      </div>

      {/* 2. FOOTER AREA: PROFESSIONAL INTEGRATED LUFS LOUDNESS STANDARD TRACKER */}
      <div 
        title="Monitor de Loudness Integrado (Norma ITU-R BS.1770-4 / EBU R128) - Gating Duplo (-70 LUFS / -10 LU)"
        className="w-full bg-gradient-to-r from-black/95 via-black/85 to-black/95 border-t border-white/10 px-3 py-1 flex items-center justify-between gap-2 z-20"
      >
        {/* Left: Standard specification tag + Elapsed active measurement time */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[6.5px] font-mono text-white/50 font-bold uppercase tracking-wider">
            <Radio className="w-2 h-2 text-primary" />
            BS.1770-4
          </span>
          <div className="hidden sm:flex items-center gap-1 text-[6.5px] font-mono text-white/30">
            <span>TIME:</span>
            <span ref={integratedElapsedTextRef} className="text-white/60 font-bold">00:00</span>
          </div>
        </div>

        {/* Center: Integrated LUFS Digital Readout + Delta LU + Compliance Badge + Precision Bar */}
        <div className="flex items-center gap-2 flex-1 justify-center min-w-0">
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-[6.5px] font-bold text-white/40 uppercase tracking-widest">INT:</span>
            <span ref={integratedLufsTextRef} className="font-mono text-[9px] font-black text-white/40 tracking-tight">
              --.- LUFS
            </span>
          </div>

          <span ref={integratedDeltaTextRef} className="font-mono text-[7px] text-white/30">
            Δ ±0.0 LU
          </span>

          <span ref={integratedStatusBadgeRef} className="px-1.5 py-0.5 rounded text-[6px] font-mono font-bold bg-white/5 text-white/40 border border-white/5">
            STANDBY
          </span>

          {/* Micro Precision Integrated Level Bar with Target Line */}
          <div className="hidden md:flex items-center relative w-24 h-1.5 bg-white/10 rounded-full overflow-hidden p-[0.5px]">
            <div 
              ref={integratedBarFillRef}
              className="h-full rounded-full bg-gradient-to-r from-sky-500 via-emerald-400 via-amber-400 to-rose-500 transition-all duration-100"
              style={{ width: '0%' }}
            />
            {/* Target line indicator mapped at target position */}
            <div 
              className="absolute top-0 bottom-0 w-[1.5px] bg-white shadow-[0_0_3px_white] z-10 pointer-events-none"
              style={{ left: `${Math.max(5, Math.min(95, ((selectedTarget + 36) / 30) * 100))}%` }}
              title={`Target: ${selectedTarget} LUFS`}
            />
          </div>

          {/* Momentary & Short-term indicators */}
          <div className="hidden lg:flex items-center gap-1.5 text-[6px] font-mono text-white/40 border-l border-white/10 pl-2">
            <span ref={momentaryLufsTextRef} title="Momentary Loudness (400ms)">M: -INF</span>
            <span className="text-white/20">|</span>
            <span ref={shortTermLufsTextRef} title="Short-Term Loudness (3s)">S: -INF</span>
          </div>
        </div>

        {/* Right: Target standard selector & Reset Integrated LUFS button */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleCycleTarget}
            title={`Clique para alternar padrão de Loudness: Atual ${selectedTarget} LUFS (${LOUDNESS_PROFILES[selectedTarget]?.label || 'Preset'})`}
            className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10 hover:border-primary/40 transition-colors flex items-center gap-1 cursor-pointer text-[6.5px] font-mono"
          >
            <span className="text-white/30 hidden xs:inline">TARGET:</span>
            <span className="text-primary font-bold">{selectedTarget} LUFS</span>
            <span className="text-[5.5px] text-white/30 uppercase hidden sm:inline font-normal">
              ({LOUDNESS_PROFILES[selectedTarget]?.label?.split('/')[0] || 'STD'})
            </span>
          </button>

          <button
            type="button"
            onClick={() => resetPeaks('out')}
            title="Resetar medição de Loudness Integrado (Integrated LUFS) e reinicializar acumulador ITU-R BS.1770"
            className="px-1 py-0.5 rounded bg-white/5 hover:bg-amber-500/20 hover:text-amber-300 border border-white/10 hover:border-amber-400/40 text-white/40 transition-all cursor-pointer flex items-center gap-0.5 text-[6.5px] font-mono group/lufsrst"
          >
            <RotateCcw className="w-2 h-2 group-hover/lufsrst:-rotate-90 transition-transform" />
            <span className="font-bold">RST</span>
          </button>
        </div>
      </div>
    </div>
  );
}
