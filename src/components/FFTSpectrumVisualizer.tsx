import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  Activity, 
  Layers, 
  Sliders, 
  Maximize2, 
  Pause, 
  Play, 
  RefreshCw, 
  AlertTriangle, 
  Check, 
  Zap, 
  Info,
  TrendingDown,
  Eye,
  EyeOff
} from 'lucide-react';
import { useMastering } from '../context/MasteringContext';

export type FFTSourceMode = 'post' | 'pre' | 'dual' | 'delta';
export type FFTGraphStyle = 'spline' | 'bars';
export type FFTPeakHold = '2s' | '5s' | 'inf' | 'off';

export interface DetectedClash {
  id: string;
  freq: number;
  db: number;
  prominenceDb: number;
  type: 'rumble' | 'mud' | 'boxiness' | 'harshness' | 'sibilance' | 'resonance';
  title: string;
  description: string;
  recommendedBand: 'hpf' | 'low' | 'lowMid' | 'mid' | 'highMid' | 'high' | 'lpf';
  suggestedFreq: number;
  suggestedGain: number;
  suggestedQ: number;
  timestamp: number;
}

// Frequency to musical note converter
function freqToMusicalNote(freq: number): string {
  if (freq < 16) return '';
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const midi = Math.round(69 + 12 * Math.log2(freq / 440));
  const noteName = noteNames[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${noteName}${octave}`;
}

export default function FFTSpectrumVisualizer() {
  const { 
    audioContextRef, 
    nodesRef, 
    isPlaying, 
    audioBuffer, 
    isEngaged, 
    settings, 
    updateSettings 
  } = useMastering();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const requestRef = useRef<number>(0);

  // Dedicated secondary analyser for pre-master (dry) input
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);

  // View & visualization controls
  const [sourceMode, setSourceMode] = useState<FFTSourceMode>('post');
  const [graphStyle, setGraphStyle] = useState<FFTGraphStyle>('spline');
  const [peakHold, setPeakHold] = useState<FFTPeakHold>('2s');
  const [showSlopeGuide, setShowSlopeGuide] = useState<boolean>(true);
  const [showClashMarkers, setShowClashMarkers] = useState<boolean>(true);
  const [isFrozen, setIsFrozen] = useState<boolean>(false);
  const [clashSensitivity, setClashSensitivity] = useState<'normal' | 'high'>('normal');

  // Interactive mouse cursor inspection
  const [hoverData, setHoverData] = useState<{ freq: number; db: number; note: string; x: number; y: number } | null>(null);

  // Active detected clashes state
  const [detectedClashes, setDetectedClashes] = useState<DetectedClash[]>([]);
  const clashCooldownMap = useRef<Map<string, number>>(new Map());

  // Buffer state for peak hold line
  const peakHoldDataRef = useRef<Float32Array | null>(null);
  const peakHoldTimersRef = useRef<Float64Array | null>(null);

  // Setup input analyzer connected to dry signal
  useEffect(() => {
    if (!audioContextRef.current || !nodesRef.current) return;
    const ctx = audioContextRef.current;
    const nodes = nodesRef.current;

    if (!inputAnalyserRef.current && nodes.inputGain) {
      try {
        const inputAnalyser = ctx.createAnalyser();
        inputAnalyser.fftSize = 2048;
        inputAnalyser.smoothingTimeConstant = 0.75;
        nodes.inputGain.connect(inputAnalyser);
        inputAnalyserRef.current = inputAnalyser;
      } catch (err) {
        console.warn('Could not initialize input analyzer for FFT:', err);
      }
    }

    // Configure main master analyzer for high resolution
    if (nodes.analyser) {
      nodes.analyser.fftSize = 2048;
      nodes.analyser.smoothingTimeConstant = 0.75;
    }
  }, [audioContextRef.current, nodesRef.current, audioBuffer]);

  // Geometry mapping: Frequency (20Hz-20kHz) & Amplitude (-90dB to 0dB)
  const getGeometry = useCallback((w: number, h: number) => {
    const padL = 36;
    const padR = 16;
    const padT = 16;
    const padB = 24;
    const plotW = Math.max(10, w - padL - padR);
    const plotH = Math.max(10, h - padT - padB);

    const minFreq = 20;
    const maxFreq = 20000;
    const minLog = Math.log10(minFreq);
    const maxLog = Math.log10(maxFreq);

    const minDb = -90;
    const maxDb = 0;

    const freqToX = (f: number) => {
      const clampedF = Math.max(minFreq, Math.min(maxFreq, f));
      return padL + ((Math.log10(clampedF) - minLog) / (maxLog - minLog)) * plotW;
    };

    const xToFreq = (x: number) => {
      const clampedX = Math.max(padL, Math.min(padL + plotW, x));
      const ratio = (clampedX - padL) / plotW;
      return Math.round(Math.pow(10, minLog + ratio * (maxLog - minLog)));
    };

    const dbToY = (db: number) => {
      const clampedDb = Math.max(minDb, Math.min(maxDb, db));
      return padT + ((maxDb - clampedDb) / (maxDb - minDb)) * plotH;
    };

    const yToDb = (y: number) => {
      const clampedY = Math.max(padT, Math.min(padT + plotH, y));
      const ratio = (clampedY - padT) / plotH;
      return Math.round(maxDb - ratio * (maxDb - minDb));
    };

    return { padL, padR, padT, padB, plotW, plotH, minFreq, maxFreq, minDb, maxDb, freqToX, xToFreq, dbToY, yToDb };
  }, []);

  // One-click Auto-Fix for a specific detected clash
  const handleFixClash = (clash: DetectedClash) => {
    const newEq = { ...settings.eq };
    if (clash.recommendedBand === 'hpf') {
      newEq.hpf = Math.min(50, Math.max(25, clash.suggestedFreq));
    } else if (clash.recommendedBand === 'lpf') {
      newEq.lpf = Math.max(8000, Math.min(18000, clash.suggestedFreq));
    } else {
      const bandKey = clash.recommendedBand as 'low' | 'lowMid' | 'mid' | 'highMid' | 'high';
      const existing = newEq[bandKey];
      newEq[bandKey] = {
        freq: clash.suggestedFreq,
        gain: Number((existing.gain + clash.suggestedGain).toFixed(1)),
        q: clash.suggestedQ
      };
    }
    updateSettings({ eq: newEq });

    // Mark clash as handled in cooldown map
    clashCooldownMap.current.set(clash.id, performance.now() + 5000);
    setDetectedClashes(prev => prev.filter(c => c.id !== clash.id));
  };

  // Tame All Active Clashes in single click
  const handleTameAllClashes = () => {
    if (detectedClashes.length === 0) return;
    const newEq = { ...settings.eq };

    detectedClashes.forEach(clash => {
      if (clash.recommendedBand === 'hpf') {
        newEq.hpf = Math.min(50, Math.max(25, clash.suggestedFreq));
      } else if (clash.recommendedBand === 'lpf') {
        newEq.lpf = Math.max(8000, Math.min(18000, clash.suggestedFreq));
      } else {
        const bandKey = clash.recommendedBand as 'low' | 'lowMid' | 'mid' | 'highMid' | 'high';
        newEq[bandKey] = {
          freq: clash.suggestedFreq,
          gain: Number(Math.max(-9, Math.min(6, newEq[bandKey].gain + clash.suggestedGain)).toFixed(1)),
          q: clash.suggestedQ
        };
      }
      clashCooldownMap.current.set(clash.id, performance.now() + 5000);
    });

    updateSettings({ eq: newEq });
    setDetectedClashes([]);
  };

  // Main Canvas Real-Time FFT Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        dpr = window.devicePixelRatio || 1;
        canvas.width = parent.clientWidth * dpr;
        canvas.height = parent.clientHeight * dpr;
        ctx.scale(dpr, dpr);
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const postAnalyser = nodesRef.current?.analyser || null;
    const inputAnalyser = inputAnalyserRef.current || null;

    const binCount = postAnalyser ? postAnalyser.frequencyBinCount : 1024;
    const postData = new Uint8Array(binCount);
    const preData = new Uint8Array(binCount);

    if (!peakHoldDataRef.current || peakHoldDataRef.current.length !== binCount) {
      peakHoldDataRef.current = new Float32Array(binCount).fill(-100);
      peakHoldTimersRef.current = new Float64Array(binCount).fill(0);
    }

    const render = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);

      const geom = getGeometry(w, h);
      const now = performance.now();

      // 1. Fetch Real Web Audio FFT Frequency Data
      let hasSignal = false;
      if (isPlaying && audioBuffer && !isFrozen) {
        if (postAnalyser) {
          postAnalyser.getByteFrequencyData(postData);
          hasSignal = true;
        }
        if (inputAnalyser) {
          inputAnalyser.getByteFrequencyData(preData);
        }
      }

      // 2. Draw dB Horizontal Grid
      const dbLevels = [0, -12, -24, -36, -48, -60, -72, -84];
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.font = '8px monospace';

      dbLevels.forEach((db) => {
        const y = geom.dbToY(db);
        ctx.beginPath();
        if (db === 0) {
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
          ctx.setLineDash([]);
        } else if (db === -24) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.setLineDash([4, 4]);
        } else {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
          ctx.setLineDash([]);
        }
        ctx.lineWidth = 1;
        ctx.moveTo(geom.padL, y);
        ctx.lineTo(w - geom.padR, y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = db === 0 ? 'rgba(239, 68, 68, 0.7)' : 'rgba(255, 255, 255, 0.25)';
        ctx.fillText(`${db}`, geom.padL - 6, y);
      });

      // 3. Draw Frequency Vertical Grid & Standard Audiophile Markings
      const freqMarkers = [
        { f: 20, label: '20' },
        { f: 50, label: '50' },
        { f: 100, label: '100' },
        { f: 250, label: '250' },
        { f: 500, label: '500' },
        { f: 1000, label: '1k' },
        { f: 2500, label: '2.5k' },
        { f: 5000, label: '5k' },
        { f: 10000, label: '10k' },
        { f: 20000, label: '20k' }
      ];

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      freqMarkers.forEach(({ f, label }) => {
        const x = geom.freqToX(f);
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        ctx.moveTo(x, geom.padT);
        ctx.lineTo(x, h - geom.padB);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fillText(label, x, h - geom.padB + 4);
      });

      // 4. Draw Pink Noise Slope Target Guide (-3dB/octave slope line)
      if (showSlopeGuide) {
        ctx.save();
        ctx.beginPath();
        const startX = geom.freqToX(50);
        const startY = geom.dbToY(-18);
        const endX = geom.freqToX(16000);
        const endY = geom.dbToY(-42);

        ctx.strokeStyle = 'rgba(245, 158, 11, 0.22)';
        ctx.setLineDash([4, 6]);
        ctx.lineWidth = 1.2;
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(245, 158, 11, 0.4)';
        ctx.font = '7px monospace';
        ctx.textAlign = 'right';
        ctx.fillText('TARGET SLOPE (-3dB/OCT)', geom.freqToX(14000), geom.dbToY(-40) - 5);
        ctx.restore();
      }

      // Sample rate estimation (standard 48kHz / 44.1kHz)
      const sampleRate = audioContextRef.current?.sampleRate || 48000;
      const binHz = sampleRate / (2 * binCount);

      // Helper function to calculate dBFS from byte (0..255 -> -90..0 dBFS)
      const byteToDb = (byteVal: number) => {
        if (byteVal === 0) return -90;
        return (byteVal / 255) * 90 - 90;
      };

      // 5. RENDER PRE-MASTER (DRY) SPECTRUM (when in PRE or DUAL mode)
      if ((sourceMode === 'pre' || sourceMode === 'dual') && hasSignal) {
        ctx.save();
        ctx.beginPath();
        let first = true;
        const step = 2;

        for (let x = geom.padL; x <= geom.padL + geom.plotW; x += step) {
          const freq = geom.xToFreq(x);
          const bin = Math.min(binCount - 1, Math.max(0, Math.round(freq / binHz)));
          const db = byteToDb(preData[bin]);
          const y = geom.dbToY(db);

          if (first) {
            ctx.moveTo(x, y);
            first = false;
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.strokeStyle = 'rgba(245, 158, 11, 0.65)'; // Warm Amber for Dry
        ctx.lineWidth = sourceMode === 'dual' ? 1.5 : 2;
        ctx.stroke();

        if (sourceMode === 'pre') {
          ctx.lineTo(geom.padL + geom.plotW, h - geom.padB);
          ctx.lineTo(geom.padL, h - geom.padB);
          ctx.closePath();
          const preGrad = ctx.createLinearGradient(0, geom.padT, 0, h - geom.padB);
          preGrad.addColorStop(0, 'rgba(245, 158, 11, 0.2)');
          preGrad.addColorStop(1, 'rgba(245, 158, 11, 0.0)');
          ctx.fillStyle = preGrad;
          ctx.fill();
        }
        ctx.restore();
      }

      // 6. RENDER POST-MASTER (WET) SPECTRUM
      if ((sourceMode === 'post' || sourceMode === 'dual') && hasSignal) {
        if (graphStyle === 'spline') {
          ctx.save();
          ctx.beginPath();
          let first = true;
          const step = 2;

          for (let x = geom.padL; x <= geom.padL + geom.plotW; x += step) {
            const freq = geom.xToFreq(x);
            const bin = Math.min(binCount - 1, Math.max(0, Math.round(freq / binHz)));
            const db = byteToDb(postData[bin]);
            const y = geom.dbToY(db);

            if (first) {
              ctx.moveTo(x, y);
              first = false;
            } else {
              ctx.lineTo(x, y);
            }
          }

          // Shaded Gradient Fill Under Curve
          ctx.lineTo(geom.padL + geom.plotW, h - geom.padB);
          ctx.lineTo(geom.padL, h - geom.padB);
          ctx.closePath();

          const grad = ctx.createLinearGradient(0, geom.padT, 0, h - geom.padB);
          grad.addColorStop(0, 'rgba(29, 185, 84, 0.35)');
          grad.addColorStop(0.4, 'rgba(16, 185, 129, 0.15)');
          grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
          ctx.fillStyle = grad;
          ctx.fill();

          // Stroke Outline with subtle glow
          ctx.beginPath();
          first = true;
          for (let x = geom.padL; x <= geom.padL + geom.plotW; x += step) {
            const freq = geom.xToFreq(x);
            const bin = Math.min(binCount - 1, Math.max(0, Math.round(freq / binHz)));
            const db = byteToDb(postData[bin]);
            const y = geom.dbToY(db);
            if (first) {
              ctx.moveTo(x, y);
              first = false;
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.strokeStyle = '#1db954'; // Emerald neon
          ctx.lineWidth = 2;
          ctx.shadowColor = 'rgba(29, 185, 84, 0.6)';
          ctx.shadowBlur = 8;
          ctx.stroke();
          ctx.restore();
        } else {
          // RTA BARS MODE (64 Logarithmic Bands)
          const numBars = 64;
          const barW = geom.plotW / numBars;
          ctx.save();

          for (let i = 0; i < numBars; i++) {
            const barX = geom.padL + i * barW;
            const freq = geom.xToFreq(barX + barW / 2);
            const bin = Math.min(binCount - 1, Math.max(0, Math.round(freq / binHz)));
            const db = byteToDb(postData[bin]);
            const y = geom.dbToY(db);
            const barH = Math.max(0, (h - geom.padB) - y);

            const barGrad = ctx.createLinearGradient(0, y, 0, h - geom.padB);
            if (db > -12) {
              barGrad.addColorStop(0, '#ef4444');
              barGrad.addColorStop(0.4, '#f59e0b');
              barGrad.addColorStop(1, '#10b981');
            } else if (db > -24) {
              barGrad.addColorStop(0, '#f59e0b');
              barGrad.addColorStop(1, '#10b981');
            } else {
              barGrad.addColorStop(0, '#10b981');
              barGrad.addColorStop(1, '#064e3b');
            }

            ctx.fillStyle = barGrad;
            ctx.fillRect(barX + 1, y, Math.max(1, barW - 2), barH);
          }
          ctx.restore();
        }
      }

      // 7. PEAK HOLD TRACE
      if (peakHold !== 'off' && peakHoldDataRef.current && peakHoldTimersRef.current && hasSignal) {
        const pData = peakHoldDataRef.current;
        const pTimers = peakHoldTimersRef.current;
        const holdDuration = peakHold === '5s' ? 5000 : peakHold === 'inf' ? Infinity : 2000;

        ctx.save();
        ctx.beginPath();
        let first = true;
        const step = 2;

        for (let x = geom.padL; x <= geom.padL + geom.plotW; x += step) {
          const freq = geom.xToFreq(x);
          const bin = Math.min(binCount - 1, Math.max(0, Math.round(freq / binHz)));
          const currentDb = byteToDb(postData[bin]);

          if (currentDb > pData[bin]) {
            pData[bin] = currentDb;
            pTimers[bin] = now + holdDuration;
          } else if (now > pTimers[bin] && peakHold !== 'inf') {
            pData[bin] = Math.max(-90, pData[bin] - 0.4); // graceful decay
          }

          const y = geom.dbToY(pData[bin]);
          if (first) {
            ctx.moveTo(x, y);
            first = false;
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)'; // Electric Yellow Peak Line
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      }

      // 8. REAL-TIME CLASH & RESONANCE DETECTION ENGINE
      if (showClashMarkers && hasSignal && !isFrozen) {
        const foundClashes: DetectedClash[] = [];
        const thresholdProminence = clashSensitivity === 'high' ? 6 : 8.5; // dB above surrounding average
        const minClashDb = -50; // Ignore silent/noise floor bins

        // Define primary clashing danger zones
        const dangerZones = [
          { minF: 20, maxF: 35, type: 'rumble', title: 'Sub Rumble', desc: 'Excessive infrasonic energy stealing dynamic headroom', band: 'hpf', gain: -12, q: 0.7 },
          { minF: 180, maxF: 450, type: 'mud', title: 'Mud Buildup', desc: 'Harmonic accumulation masking vocal & bass clarity', band: 'lowMid', gain: -2.5, q: 2.2 },
          { minF: 600, maxF: 1300, type: 'boxiness', title: 'Boxy Resonance', desc: 'Nasal or hollow buildup crowding mid-range', band: 'mid', gain: -2.5, q: 2.5 },
          { minF: 2400, maxF: 4500, type: 'harshness', title: 'Harsh Ear Fatigue', desc: 'Over-accumulated sensitivity peak causing listener fatigue', band: 'highMid', gain: -2.0, q: 2.8 },
          { minF: 6500, maxF: 9500, type: 'sibilance', title: 'Sibilance Clash', desc: 'Piercing treble spike or distorted high sibilance', band: 'high', gain: -2.0, q: 2.0 }
        ] as const;

        // Moving average window size (approx 1/3 octave)
        const windowRadius = 14;

        dangerZones.forEach((zone) => {
          let maxProminence = 0;
          let worstBin = -1;
          let worstDb = -100;

          const startBin = Math.max(1, Math.round(zone.minF / binHz));
          const endBin = Math.min(binCount - 2, Math.round(zone.maxF / binHz));

          for (let b = startBin; b <= endBin; b++) {
            const db = byteToDb(postData[b]);
            if (db < minClashDb) continue;

            // Calculate surrounding moving average
            let sum = 0;
            let count = 0;
            for (let k = Math.max(0, b - windowRadius); k <= Math.min(binCount - 1, b + windowRadius); k++) {
              if (Math.abs(k - b) > 2) {
                sum += byteToDb(postData[k]);
                count++;
              }
            }
            const avg = count > 0 ? sum / count : db;
            const prominence = db - avg;

            if (prominence > thresholdProminence && prominence > maxProminence) {
              maxProminence = prominence;
              worstBin = b;
              worstDb = db;
            }
          }

          if (worstBin !== -1) {
            const centerFreq = Math.round(worstBin * binHz);
            const clashId = `${zone.type}_${centerFreq}`;
            const cooldown = clashCooldownMap.current.get(clashId) || 0;

            if (now > cooldown) {
              foundClashes.push({
                id: clashId,
                freq: centerFreq,
                db: Number(worstDb.toFixed(1)),
                prominenceDb: Number(maxProminence.toFixed(1)),
                type: zone.type as any,
                title: zone.title,
                description: zone.desc,
                recommendedBand: zone.band as any,
                suggestedFreq: centerFreq,
                suggestedGain: zone.gain,
                suggestedQ: zone.q,
                timestamp: now
              });
            }
          }
        });

        // Update state throttle (avoid excessive React re-renders)
        if (Math.random() < 0.25) {
          setDetectedClashes(foundClashes);
        }

        // Draw In-Canvas Clash Markers & Glowing Guides
        foundClashes.forEach((clash) => {
          const cx = geom.freqToX(clash.freq);
          const cy = geom.dbToY(clash.db);
          const isSevere = clash.prominenceDb > 10;
          const color = isSevere ? '#ef4444' : '#f59e0b';

          ctx.save();
          // Vertical guide line
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.setLineDash([3, 3]);
          ctx.lineWidth = 1;
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx, h - geom.padB);
          ctx.stroke();
          ctx.setLineDash([]);

          // Warning Pip on the peak
          ctx.beginPath();
          ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 10;
          ctx.fill();

          // Outer pulsing ring
          ctx.beginPath();
          ctx.arc(cx, cy, 7.5, 0, Math.PI * 2);
          ctx.strokeStyle = `${color}88`;
          ctx.lineWidth = 1;
          ctx.stroke();

          // Label
          ctx.font = 'bold 7.5px monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(`⚠️ ${clash.title}`, cx, Math.max(geom.padT + 10, cy - 12));
          ctx.font = '7px monospace';
          ctx.fillStyle = color;
          ctx.fillText(`${clash.freq >= 1000 ? `${(clash.freq / 1000).toFixed(1)}k` : clash.freq}Hz (+${clash.prominenceDb}dB)`, cx, Math.max(geom.padT + 18, cy - 4));
          ctx.restore();
        });
      }

      // 9. DRAW INTERACTIVE HOVER CROSSHAIR
      if (hoverData) {
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.setLineDash([2, 2]);
        ctx.lineWidth = 1;

        // Vertical line at hover freq
        ctx.moveTo(hoverData.x, geom.padT);
        ctx.lineTo(hoverData.x, h - geom.padB);

        // Horizontal line at hover dB
        ctx.moveTo(geom.padL, hoverData.y);
        ctx.lineTo(w - geom.padR, hoverData.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      requestRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(requestRef.current);
    };
  }, [
    isPlaying, 
    audioBuffer, 
    sourceMode, 
    graphStyle, 
    peakHold, 
    showSlopeGuide, 
    showClashMarkers, 
    isFrozen, 
    clashSensitivity, 
    hoverData, 
    getGeometry
  ]);

  // Pointer move handler for interactive inspect tooltip
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const geom = getGeometry(rect.width, rect.height);

    if (x >= geom.padL && x <= rect.width - geom.padR && y >= geom.padT && y <= rect.height - geom.padB) {
      const freq = geom.xToFreq(x);
      const db = geom.yToDb(y);
      const note = freqToMusicalNote(freq);
      setHoverData({ freq, db, note, x, y });
    } else {
      setHoverData(null);
    }
  };

  const handlePointerLeave = () => {
    setHoverData(null);
  };

  return (
    <div className="flex flex-col w-full bg-black/60 rounded-xl border border-white/10 overflow-hidden shadow-2xl relative select-none">
      
      {/* 1. TOP HEADER CONTROLS TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-white/5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-black/60 px-2 py-0.5 rounded border border-white/10">
            <Activity className="w-3.5 h-3.5 text-primary animate-pulse" />
            <span className="font-mono text-[9px] font-bold text-white tracking-widest uppercase">FFT SPECTRUM ANALYZER</span>
          </div>

          {/* Mode Switcher: Post, Pre, Dual, Delta */}
          <div className="flex bg-black/40 rounded p-0.5 border border-white/10">
            {(['post', 'pre', 'dual'] as FFTSourceMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSourceMode(mode)}
                className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase transition-all cursor-pointer ${
                  sourceMode === mode
                    ? mode === 'pre'
                      ? 'bg-amber-500 text-black shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                      : 'bg-primary text-black shadow-[0_0_8px_rgba(29,185,84,0.4)]'
                    : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}
              >
                {mode === 'post' ? 'Wet (Master)' : mode === 'pre' ? 'Dry (Pre)' : 'Dual Compare'}
              </button>
            ))}
          </div>
        </div>

        {/* Display options */}
        <div className="flex items-center gap-1.5">
          {/* Spline vs Bars */}
          <div className="flex bg-black/40 rounded p-0.5 border border-white/10">
            <button
              type="button"
              onClick={() => setGraphStyle('spline')}
              className={`px-1.5 py-0.5 rounded text-[7.5px] font-mono font-bold uppercase transition-all cursor-pointer ${
                graphStyle === 'spline' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white'
              }`}
            >
              Spline
            </button>
            <button
              type="button"
              onClick={() => setGraphStyle('bars')}
              className={`px-1.5 py-0.5 rounded text-[7.5px] font-mono font-bold uppercase transition-all cursor-pointer ${
                graphStyle === 'bars' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white'
              }`}
            >
              RTA Bars
            </button>
          </div>

          {/* Peak Hold Cycle */}
          <button
            type="button"
            onClick={() => {
              const modes: FFTPeakHold[] = ['2s', '5s', 'inf', 'off'];
              setPeakHold(modes[(modes.indexOf(peakHold) + 1) % modes.length]);
            }}
            title="Cycle Peak Hold Duration"
            className="px-2 py-0.5 rounded bg-black/40 border border-white/10 hover:border-white/20 text-[7.5px] font-mono text-white/60 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
          >
            <span className="text-white/30">PEAK:</span>
            <span className="text-yellow-400 font-bold uppercase">{peakHold}</span>
          </button>

          {/* Target Slope Guide Toggle */}
          <button
            type="button"
            onClick={() => setShowSlopeGuide(!showSlopeGuide)}
            title="Toggle -3dB/Octave Pink Noise Reference Slope"
            className={`px-2 py-0.5 rounded border text-[7.5px] font-mono font-bold transition-all cursor-pointer ${
              showSlopeGuide 
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' 
                : 'bg-black/40 border-white/10 text-white/30 hover:text-white'
            }`}
          >
            SLOPE -3dB
          </button>

          {/* Clash Markers Toggle */}
          <button
            type="button"
            onClick={() => setShowClashMarkers(!showClashMarkers)}
            title="Toggle Clashing Resonances & Frequency Anomaly Markers"
            className={`px-2 py-0.5 rounded border text-[7.5px] font-mono font-bold transition-all flex items-center gap-1 cursor-pointer ${
              showClashMarkers 
                ? 'bg-scarlet/20 border-scarlet/40 text-scarlet' 
                : 'bg-black/40 border-white/10 text-white/30 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-2.5 h-2.5" />
            <span>CLASHES</span>
          </button>

          {/* Freeze Frame */}
          <button
            type="button"
            onClick={() => setIsFrozen(!isFrozen)}
            title="Freeze/Hold current FFT spectrum frame"
            className={`px-2 py-0.5 rounded border text-[7.5px] font-mono font-bold transition-all cursor-pointer ${
              isFrozen 
                ? 'bg-cyan-500/30 border-cyan-400 text-cyan-300 animate-pulse' 
                : 'bg-black/40 border-white/10 text-white/40 hover:text-white'
            }`}
          >
            {isFrozen ? 'FROZEN' : 'FREEZE'}
          </button>
        </div>
      </div>

      {/* 2. MAIN FFT CANVAS VIEWPORT */}
      <div 
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className="w-full h-56 relative cursor-crosshair bg-[#08080a]"
      >
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Dynamic Hover HUD Box */}
        {hoverData && (
          <div 
            className="absolute pointer-events-none bg-black/90 backdrop-blur-md border border-white/20 px-2.5 py-1 rounded shadow-2xl text-[8.5px] font-mono flex items-center gap-3 z-30"
            style={{
              left: Math.min(window.innerWidth - 180, Math.max(10, hoverData.x - 70)),
              top: Math.max(10, hoverData.y - 32)
            }}
          >
            <span className="text-primary font-black">
              {hoverData.freq >= 1000 ? `${(hoverData.freq / 1000).toFixed(2)} kHz` : `${hoverData.freq} Hz`}
            </span>
            {hoverData.note && (
              <span className="text-amber-400 font-bold bg-amber-400/10 px-1 py-0.2 rounded border border-amber-400/20">
                {hoverData.note}
              </span>
            )}
            <span className="text-white/60">
              {hoverData.db} dBFS
            </span>
          </div>
        )}

        {/* Legend Overlay when Dual Compare is active */}
        {sourceMode === 'dual' && (
          <div className="absolute top-2 left-10 pointer-events-none flex items-center gap-3 bg-black/70 px-2 py-1 rounded border border-white/10 font-mono text-[7px]">
            <div className="flex items-center gap-1">
              <div className="w-2 h-0.5 bg-amber-400" />
              <span className="text-amber-400 font-bold">DRY (PRE)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-0.5 bg-primary" />
              <span className="text-primary font-bold">WET (POST)</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. CLASH & ANOMALY ACTION BANNER */}
      {showClashMarkers && detectedClashes.length > 0 && (
        <div className="p-2.5 bg-black/80 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-scarlet/20 border border-scarlet/30 text-scarlet">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] font-bold text-white uppercase tracking-wider">
                  {detectedClashes.length} Frequency Clash{detectedClashes.length > 1 ? 'es' : ''} Detected
                </span>
                <span className="text-[7.5px] font-mono text-scarlet font-bold bg-scarlet/10 px-1.5 py-0.2 rounded border border-scarlet/20">
                  REAL-TIME FFT
                </span>
              </div>
              <p className="text-[8px] font-mono text-white/40 leading-none mt-0.5">
                Spectral energy spikes exceeding local average slope. Tame to avoid harshness and mud.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            {detectedClashes.slice(0, 3).map((clash) => (
              <button
                key={clash.id}
                type="button"
                onClick={() => handleFixClash(clash)}
                title={`Click to notch ${clash.freq} Hz by ${clash.suggestedGain} dB on ${clash.recommendedBand} EQ`}
                className="px-2 py-1 rounded bg-white/5 hover:bg-white/15 border border-white/10 hover:border-primary/50 text-[8px] font-mono transition-all flex items-center gap-1.5 cursor-pointer group"
              >
                <span className="text-scarlet font-black">
                  {clash.freq >= 1000 ? `${(clash.freq / 1000).toFixed(1)}k` : clash.freq}Hz
                </span>
                <span className="text-white/60 group-hover:text-white">
                  {clash.title}
                </span>
                <span className="text-primary font-bold bg-primary/10 px-1 py-0.2 rounded border border-primary/20">
                  Cut {clash.suggestedGain}dB
                </span>
              </button>
            ))}

            {detectedClashes.length > 1 && (
              <button
                type="button"
                onClick={handleTameAllClashes}
                className="px-2.5 py-1 rounded bg-primary hover:bg-primary/90 text-black font-mono text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_12px_rgba(29,185,84,0.4)] flex items-center gap-1"
              >
                <Zap className="w-2.5 h-2.5 fill-current" />
                <span>Tame All</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. FOOTER STATUS BAR */}
      <div className="px-3 py-1 bg-black/90 border-t border-white/5 flex items-center justify-between text-[7px] font-mono text-white/30">
        <div className="flex items-center gap-3">
          <span>LOG 20 Hz - 20 kHz</span>
          <span>•</span>
          <span>RESOLUTION: 2048 FFT</span>
          <span>•</span>
          <span>SAMPLING: {audioContextRef.current?.sampleRate ? `${(audioContextRef.current.sampleRate / 1000).toFixed(1)} kHz` : '48.0 kHz'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/40">HOVER TO INSPECT FREQ & NOTE</span>
        </div>
      </div>

    </div>
  );
}
