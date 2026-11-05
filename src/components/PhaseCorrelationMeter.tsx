import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useMastering } from '../context/MasteringContext';
import { RotateCcw, Activity, AlertTriangle, CheckCircle2, Radio } from 'lucide-react';

/**
 * Phase Correlation Meter
 * Monitors stereo phase relationship and mono-compatibility during mastering.
 * 
 * Scale:
 *   +1.0: Pure Mono (100% Mono Compatible, Left & Right are in complete phase)
 *   0.0 to +1.0: Healthy Stereo Field (Normal stereo width, safe for mono playback)
 *   -0.3 to 0.0: Wide Decorrelation (Risk of phase comb filtering when summed to mono)
 *   -1.0 to -0.3: Phase Inversion / Cancellation (Elements will vanish in mono systems)
 */
export default function PhaseCorrelationMeter() {
  const { 
    isPlaying, 
    audioBuffer, 
    audioContextRef, 
    nodesRef,
    isMonoAudition,
    toggleMonoAudition
  } = useMastering();

  // Negative peak hold state (lowest correlation recorded during playback)
  const minPeakCorrRef = useRef<number>(1.0);
  const smoothedCorrRef = useRef<number>(1.0);
  const flashResetRef = useRef<boolean>(false);
  const [flashReset, setFlashReset] = useState(false);

  // DOM direct update references for 60fps performance without React re-render lag
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const minPeakMarkerRef = useRef<HTMLDivElement | null>(null);
  const valueTextRef = useRef<HTMLSpanElement | null>(null);
  const statusBadgeRef = useRef<HTMLSpanElement | null>(null);
  const clipLedRef = useRef<HTMLDivElement | null>(null);
  const minPeakTextRef = useRef<HTMLSpanElement | null>(null);
  const canvasGonioRef = useRef<HTMLCanvasElement | null>(null);

  const [showGonio, setShowGonio] = useState(false);

  // Web Audio Analysers for discrete Left and Right channel analysis
  const analyserLRef = useRef<AnalyserNode | null>(null);
  const analyserRRef = useRef<AnalyserNode | null>(null);
  const splitterRef = useRef<ChannelSplitterNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Connect channel splitter to masterGain to capture real-time post-DSP stereo field
  const ensureAnalysers = useCallback(() => {
    if (splitterRef.current || !audioContextRef.current || !nodesRef.current?.masterGain) return;
    const ctx = audioContextRef.current;
    const masterGain = nodesRef.current.masterGain;

    try {
      const splitter = ctx.createChannelSplitter(2);
      const analyserL = ctx.createAnalyser();
      const analyserR = ctx.createAnalyser();

      analyserL.fftSize = 512;
      analyserL.smoothingTimeConstant = 0.2;
      analyserR.fftSize = 512;
      analyserR.smoothingTimeConstant = 0.2;

      masterGain.connect(splitter);
      splitter.connect(analyserL, 0);
      splitter.connect(analyserR, 1);

      splitterRef.current = splitter;
      analyserLRef.current = analyserL;
      analyserRRef.current = analyserR;
    } catch (err) {
      console.warn('Unable to bind Phase Correlation Splitter:', err);
    }
  }, [audioContextRef, nodesRef]);

  useEffect(() => {
    ensureAnalysers();
  }, [ensureAnalysers, audioBuffer, isPlaying]);

  // Click-to-reset minimum peak hold and clip warning
  const resetPeakHold = useCallback(() => {
    minPeakCorrRef.current = 1.0;
    if (minPeakMarkerRef.current) {
      minPeakMarkerRef.current.style.left = '100%';
      minPeakMarkerRef.current.style.opacity = '0';
    }
    if (minPeakTextRef.current) {
      minPeakTextRef.current.textContent = 'MIN +1.00';
      minPeakTextRef.current.className = 'font-mono text-[6.5px] text-emerald-400 font-bold';
    }
    if (clipLedRef.current) {
      clipLedRef.current.style.backgroundColor = '#180505';
      clipLedRef.current.style.boxShadow = 'none';
    }

    setFlashReset(true);
    setTimeout(() => setFlashReset(false), 250);
  }, []);

  // Real-time animation loop calculating Pearson correlation coefficient
  useEffect(() => {
    const leftData = new Float32Array(512);
    const rightData = new Float32Array(512);

    const updatePhaseEngine = () => {
      let instantaneousCorrelation = 1.0;
      let hasSignal = false;

      if (isPlaying && (!analyserLRef.current || !analyserRRef.current)) {
        ensureAnalysers();
      }

      if (isPlaying && analyserLRef.current && analyserRRef.current) {
        analyserLRef.current.getFloatTimeDomainData(leftData);
        analyserRRef.current.getFloatTimeDomainData(rightData);

        let sumLR = 0;
        let sumL2 = 0;
        let sumR2 = 0;
        const len = leftData.length;

        for (let i = 0; i < len; i++) {
          const l = leftData[i];
          const r = rightData[i];
          sumLR += l * r;
          sumL2 += l * l;
          sumR2 += r * r;
        }

        const denom = Math.sqrt(sumL2 * sumR2);

        // Detect if there is actual audio above noise floor (-70 dBFS approx)
        if (sumL2 > 1e-7 || sumR2 > 1e-7) {
          hasSignal = true;
          if (denom > 1e-7) {
            instantaneousCorrelation = sumLR / denom;
            instantaneousCorrelation = Math.max(-1.0, Math.min(1.0, instantaneousCorrelation));
          } else {
            instantaneousCorrelation = 1.0;
          }
        } else {
          // Resting state when silent
          instantaneousCorrelation = 1.0;
        }
      } else {
        instantaneousCorrelation = 1.0;
      }

      // Ballistic smoothing (fast response to out-of-phase transients, smooth release)
      const smoothingFactor = instantaneousCorrelation < smoothedCorrRef.current ? 0.35 : 0.18;
      smoothedCorrRef.current += (instantaneousCorrelation - smoothedCorrRef.current) * smoothingFactor;
      const currentCorr = smoothedCorrRef.current;

      // Track minimum correlation (lowest phase recorded)
      if (hasSignal && currentCorr < minPeakCorrRef.current) {
        minPeakCorrRef.current = currentCorr;
      }

      // Map correlation [-1.0, +1.0] to percentage [0%, 100%]
      // -1.0 -> 0%,  0.0 -> 50%,  +1.0 -> 100%
      const percent = Math.max(0, Math.min(100, ((currentCorr + 1.0) / 2.0) * 100));
      const minPeakPercent = Math.max(0, Math.min(100, ((minPeakCorrRef.current + 1.0) / 2.0) * 100));

      // Update Cursor position & color
      if (cursorRef.current) {
        cursorRef.current.style.left = `${percent}%`;
        if (currentCorr >= 0.3) {
          cursorRef.current.style.backgroundColor = '#10b981'; // Emerald
          cursorRef.current.style.boxShadow = '0 0 6px rgba(16, 185, 129, 0.9)';
        } else if (currentCorr >= 0.0) {
          cursorRef.current.style.backgroundColor = '#38bdf8'; // Cyan
          cursorRef.current.style.boxShadow = '0 0 6px rgba(56, 189, 248, 0.9)';
        } else if (currentCorr >= -0.3) {
          cursorRef.current.style.backgroundColor = '#f59e0b'; // Amber warning
          cursorRef.current.style.boxShadow = '0 0 7px rgba(245, 158, 11, 0.95)';
        } else {
          cursorRef.current.style.backgroundColor = '#ef4444'; // Red phase alert
          cursorRef.current.style.boxShadow = '0 0 9px rgba(239, 68, 68, 1)';
        }
      }

      // Update Min Peak Marker
      if (minPeakMarkerRef.current) {
        if (minPeakCorrRef.current < 0.98 && hasSignal) {
          minPeakMarkerRef.current.style.left = `${minPeakPercent}%`;
          minPeakMarkerRef.current.style.opacity = '1';
          if (minPeakCorrRef.current < 0) {
            minPeakMarkerRef.current.style.backgroundColor = '#ef4444';
            minPeakMarkerRef.current.style.boxShadow = '0 0 5px rgba(239,68,68,0.9)';
          } else {
            minPeakMarkerRef.current.style.backgroundColor = '#f59e0b';
            minPeakMarkerRef.current.style.boxShadow = '0 0 4px rgba(245,158,11,0.8)';
          }
        } else {
          minPeakMarkerRef.current.style.opacity = '0';
        }
      }

      // Update Numeric readout
      if (valueTextRef.current) {
        const sign = currentCorr >= 0 ? '+' : '';
        valueTextRef.current.textContent = `${sign}${currentCorr.toFixed(2)}`;
        if (currentCorr >= 0.3) {
          valueTextRef.current.className = 'font-mono text-[7px] text-emerald-400 font-bold';
        } else if (currentCorr >= 0.0) {
          valueTextRef.current.className = 'font-mono text-[7px] text-sky-400 font-bold';
        } else if (currentCorr >= -0.3) {
          valueTextRef.current.className = 'font-mono text-[7px] text-amber-400 font-bold animate-pulse';
        } else {
          valueTextRef.current.className = 'font-mono text-[7px] text-rose-500 font-black animate-pulse';
        }
      }

      // Update Min Peak text readout
      if (minPeakTextRef.current) {
        const minSign = minPeakCorrRef.current >= 0 ? '+' : '';
        minPeakTextRef.current.textContent = `MIN ${minSign}${minPeakCorrRef.current.toFixed(2)}`;
        if (minPeakCorrRef.current < 0) {
          minPeakTextRef.current.className = 'font-mono text-[6.5px] text-rose-400 font-bold';
        } else if (minPeakCorrRef.current < 0.3) {
          minPeakTextRef.current.className = 'font-mono text-[6.5px] text-amber-400 font-bold';
        } else {
          minPeakTextRef.current.className = 'font-mono text-[6.5px] text-white/40 font-bold';
        }
      }

      // Update Phase Status Badge
      if (statusBadgeRef.current) {
        if (!hasSignal) {
          statusBadgeRef.current.textContent = 'READY';
          statusBadgeRef.current.className = 'font-mono text-[6px] text-white/30 font-bold';
        } else if (currentCorr >= 0.6) {
          statusBadgeRef.current.textContent = 'MONO SAFE';
          statusBadgeRef.current.className = 'font-mono text-[6px] text-emerald-400 font-bold tracking-wider';
        } else if (currentCorr >= 0.15) {
          statusBadgeRef.current.textContent = 'STEREO OK';
          statusBadgeRef.current.className = 'font-mono text-[6px] text-sky-400 font-bold tracking-wider';
        } else if (currentCorr >= 0.0) {
          statusBadgeRef.current.textContent = 'WIDE STEREO';
          statusBadgeRef.current.className = 'font-mono text-[6px] text-amber-300 font-bold tracking-wider';
        } else if (currentCorr >= -0.3) {
          statusBadgeRef.current.textContent = 'PHASE RISK';
          statusBadgeRef.current.className = 'font-mono text-[6px] text-amber-500 font-black tracking-wider';
        } else {
          statusBadgeRef.current.textContent = 'CANCELLATION';
          statusBadgeRef.current.className = 'font-mono text-[6px] text-rose-500 font-black tracking-wider animate-pulse';
        }
      }

      // Update Phase Warning LED
      if (clipLedRef.current) {
        if (currentCorr < 0 && hasSignal) {
          clipLedRef.current.style.backgroundColor = '#ef4444';
          clipLedRef.current.style.boxShadow = '0 0 6px #ef4444, inset 0 0 2px #fff';
        } else if (minPeakCorrRef.current < 0) {
          // Latch amber/dim red to signify a phase issue occurred during the track
          clipLedRef.current.style.backgroundColor = '#7f1d1d';
          clipLedRef.current.style.boxShadow = 'none';
        } else {
          clipLedRef.current.style.backgroundColor = '#180505';
          clipLedRef.current.style.boxShadow = 'none';
        }
      }

      // Optional Mini Goniometer / Vector scope renderer (when user toggles goniometer view)
      if (showGonio && canvasGonioRef.current && hasSignal) {
        const canvas = canvasGonioRef.current;
        const ctx2d = canvas.getContext('2d');
        if (ctx2d) {
          const w = canvas.width;
          const h = canvas.height;
          ctx2d.fillStyle = 'rgba(8, 8, 8, 0.3)';
          ctx2d.fillRect(0, 0, w, h);

          ctx2d.strokeStyle = currentCorr < 0 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(16, 185, 129, 0.8)';
          ctx2d.lineWidth = 1;
          ctx2d.beginPath();

          const len = leftData.length;
          const step = 4;
          for (let i = 0; i < len; i += step) {
            const l = leftData[i];
            const r = rightData[i];
            // Rotate 45 degrees: X = (L - R) / sqrt(2), Y = (L + R) / sqrt(2)
            const x = w / 2 + ((l - r) * (w / 2) * 1.3);
            const y = h / 2 - ((l + r) * (h / 2) * 1.3);
            if (i === 0) ctx2d.moveTo(x, y);
            else ctx2d.lineTo(x, y);
          }
          ctx2d.stroke();
        }
      }

      animationFrameRef.current = requestAnimationFrame(updatePhaseEngine);
    };

    animationFrameRef.current = requestAnimationFrame(updatePhaseEngine);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, showGonio]);

  return (
    <div 
      className={`flex flex-col justify-between self-stretch min-h-[90px] bg-black/70 px-2.5 py-1.5 rounded-xl border relative select-none transition-all duration-200 w-[145px] sm:w-[172px] shadow-2xl ${
        flashReset 
          ? 'border-amber-400 ring-2 ring-amber-400/50 bg-amber-950/40 shadow-[0_0_12px_rgba(245,158,11,0.5)]' 
          : 'border-white/10 hover:border-white/20'
      }`}
    >
      {/* 1. Header: Title, Live Numeric Value & Clip LED */}
      <div className="flex items-center justify-between w-full border-b border-white/5 pb-1">
        <div className="flex items-center gap-1">
          <Activity className="w-2.5 h-2.5 text-primary/80" />
          <span className="font-mono text-[7px] font-bold tracking-wider text-white/50">PHASE CORR</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span ref={statusBadgeRef} className="font-mono text-[6px] text-emerald-400 font-bold tracking-wider">
            READY
          </span>
          <span ref={valueTextRef} className="font-mono text-[7px] text-emerald-400 font-bold">
            +1.00
          </span>
          <div 
            ref={clipLedRef}
            onClick={resetPeakHold}
            title="Phase Inversion Alert (< 0 correlation) - Clique para resetar"
            className="w-1.5 h-1.5 rounded-full cursor-pointer transition-all duration-300 ml-0.5"
            style={{ backgroundColor: '#180505' }}
          />
        </div>
      </div>

      {/* 2. Visual Correlation Meter Bar */}
      <div 
        onClick={resetPeakHold}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') resetPeakHold(); }}
        title="Medidor de Correlação de Fase (-1.0 a +1.0). Clique para resetar o pico mínimo registrado."
        className="w-full relative my-1 cursor-pointer group/bar"
      >
        {/* Scale labels (-1, 0, +1) */}
        <div className="flex justify-between text-[6px] font-mono text-white/30 px-0.5 mb-0.5">
          <span className="text-rose-400/80 font-bold">-1</span>
          <span className="text-white/40">0</span>
          <span className="text-emerald-400/80 font-bold">+1</span>
        </div>

        {/* Track Container */}
        <div className="w-full h-2 rounded bg-[#0a0a0a] border border-white/10 relative overflow-hidden shadow-inner">
          {/* Graded background gradient: Red -> Amber -> Cyan -> Emerald */}
          <div className="absolute inset-0 bg-gradient-to-r from-rose-900/60 via-amber-800/40 via-sky-900/40 to-emerald-900/70 opacity-60" />

          {/* Zero center vertical dividing notch */}
          <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/30 -translate-x-1/2 z-10" />

          {/* Negative Peak Hold Tick Marker */}
          <div 
            ref={minPeakMarkerRef}
            className="absolute top-0 bottom-0 w-1 -translate-x-1/2 z-20 transition-all pointer-events-none rounded-full"
            style={{ left: '100%', opacity: 0, backgroundColor: '#f59e0b' }}
          />

          {/* Real-time Ballistic Cursor Needle */}
          <div 
            ref={cursorRef}
            className="absolute top-0 bottom-0 w-1.5 -translate-x-1/2 z-30 transition-all rounded-full"
            style={{ 
              left: '100%', 
              backgroundColor: '#10b981',
              boxShadow: '0 0 6px rgba(16, 185, 129, 0.9)'
            }}
          />
        </div>

        {/* Hover Hint */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/90 border border-white/20 rounded px-1.5 py-0.5 text-[6px] font-mono text-amber-300 opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
          Clique para resetar pico
        </div>
      </div>

      {/* 3. Bottom Controls: MIN Peak readout, Mono Audition & RST */}
      <div className="flex items-center justify-between w-full border-t border-white/5 pt-1 text-[6.5px] font-mono">
        <button
          type="button"
          onClick={resetPeakHold}
          title="Menor correlação de fase atingida durante o áudio"
          className="hover:text-amber-300 transition-colors flex items-center gap-0.5"
        >
          <span ref={minPeakTextRef} className="font-mono text-[6.5px] text-white/40 font-bold">
            MIN +1.00
          </span>
        </button>

        <div className="flex items-center gap-1">
          {/* Mono Audition Button */}
          <button
            type="button"
            onClick={toggleMonoAudition}
            title={isMonoAudition ? "Audicão Mono ATIVA (Left & Right somados)" : "Audicionar compatibilidade mono (Soma L+R)"}
            className={`px-1.5 py-0.5 rounded font-bold transition-all flex items-center gap-0.5 cursor-pointer border ${
              isMonoAudition 
                ? 'bg-amber-500/20 text-amber-300 border-amber-400/50 shadow-[0_0_8px_rgba(245,158,11,0.3)] animate-pulse' 
                : 'bg-white/5 text-white/40 hover:text-white border-white/5 hover:border-white/20'
            }`}
          >
            <Radio className="w-2 h-2" />
            <span>{isMonoAudition ? 'MONO' : 'MONO'}</span>
          </button>

          {/* Reset Button */}
          <button
            type="button"
            onClick={resetPeakHold}
            title="Resetar pico mínimo de fase e avisos de cancelamento"
            className="px-1 py-0.5 rounded bg-white/5 hover:bg-amber-500/20 hover:text-amber-300 text-white/40 border border-white/5 transition-all font-bold cursor-pointer flex items-center gap-0.5 group/rst"
          >
            <RotateCcw className="w-2 h-2 group-hover/rst:-rotate-90 transition-transform" />
            <span>RST</span>
          </button>
        </div>
      </div>

      {/* Popout / Goniometer Vector scope toggle (optional drawer) */}
      {showGonio && (
        <div className="absolute bottom-full left-0 mb-2 p-2 bg-[#0a0a0a] border border-white/10 rounded-lg shadow-2xl z-50 w-40">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[7px] font-mono text-white/50 font-bold">L/R GONIOMETER</span>
            <button 
              onClick={() => setShowGonio(false)}
              className="text-[7px] text-white/40 hover:text-white"
            >
              ✕
            </button>
          </div>
          <canvas 
            ref={canvasGonioRef} 
            width={140} 
            height={90} 
            className="w-full h-20 rounded bg-black border border-white/5"
          />
        </div>
      )}
    </div>
  );
}
