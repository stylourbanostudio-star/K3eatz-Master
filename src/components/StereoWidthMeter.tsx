import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useMastering } from '../context/MasteringContext';
import { RotateCcw, MoveHorizontal, AlertTriangle, CheckCircle2, Sliders } from 'lucide-react';

/**
 * Stereo Width & Spatial Spread Indicator
 * 
 * Monitors the soundstage spatial aperture and Mid/Side (M/S) energy balance during mastering.
 * Helps identify:
 *   - Excessively narrow mixes (< 35%): mix collapsed towards mono, lacking stereo depth and separation.
 *   - Focused mixes (35% - 70%): center-dominant, suitable for vocals/bass or vintage productions.
 *   - Optimal / Balanced stereo (70% - 130%): healthy commercial soundstage with strong phantom center and mono safety.
 *   - Expansive mixes (130% - 165%): wide spatial field; requires monitoring mono-compatibility.
 *   - Excessively wide mixes (> 165%): side energy overwhelms center, resulting in comb filtering and phase cancellation when summed to mono.
 */
export default function StereoWidthMeter() {
  const { 
    isPlaying, 
    audioBuffer, 
    audioContextRef, 
    nodesRef 
  } = useMastering();

  // Peak hold state (highest stereo width percentage recorded during playback)
  const maxPeakWidthRef = useRef<number>(100);
  const minWidthRef = useRef<number>(100);
  const smoothedWidthRef = useRef<number>(100);
  const smoothedMidRmsRef = useRef<number>(0);
  const smoothedSideRmsRef = useRef<number>(0);
  const flashResetRef = useRef<boolean>(false);
  const [flashReset, setFlashReset] = useState(false);

  // DOM direct update references for 60fps performance without React re-render lag
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const peakMarkerRef = useRef<HTMLDivElement | null>(null);
  const widthValueTextRef = useRef<HTMLSpanElement | null>(null);
  const statusBadgeRef = useRef<HTMLSpanElement | null>(null);
  const warningLedRef = useRef<HTMLDivElement | null>(null);
  const peakTextRef = useRef<HTMLSpanElement | null>(null);
  const msRatioTextRef = useRef<HTMLSpanElement | null>(null);
  const leftWingRef = useRef<SVGLineElement | null>(null);
  const rightWingRef = useRef<SVGLineElement | null>(null);
  const spreadArcRef = useRef<SVGPathElement | null>(null);

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
      console.warn('Unable to bind Stereo Width Splitter:', err);
    }
  }, [audioContextRef, nodesRef]);

  useEffect(() => {
    ensureAnalysers();
  }, [ensureAnalysers, audioBuffer, isPlaying]);

  // Click-to-reset peak width hold and warning latches
  const resetPeakHold = useCallback(() => {
    maxPeakWidthRef.current = 100;
    minWidthRef.current = 100;
    if (peakMarkerRef.current) {
      peakMarkerRef.current.style.left = '50%';
      peakMarkerRef.current.style.opacity = '0';
    }
    if (peakTextRef.current) {
      peakTextRef.current.textContent = 'MAX 100%';
      peakTextRef.current.className = 'font-mono text-[6.5px] text-white/40 font-bold';
    }
    if (warningLedRef.current) {
      warningLedRef.current.style.backgroundColor = '#180505';
      warningLedRef.current.style.boxShadow = 'none';
    }

    setFlashReset(true);
    setTimeout(() => setFlashReset(false), 250);
  }, []);

  // Real-time animation loop calculating Mid/Side spatial spread and width percentage
  useEffect(() => {
    const leftData = new Float32Array(512);
    const rightData = new Float32Array(512);

    const updateWidthEngine = () => {
      let instantaneousWidth = 100; // 100% nominal
      let instantaneousMidRms = 0;
      let instantaneousSideRms = 0;
      let hasSignal = false;

      if (isPlaying && (!analyserLRef.current || !analyserRRef.current)) {
        ensureAnalysers();
      }

      if (isPlaying && analyserLRef.current && analyserRRef.current) {
        analyserLRef.current.getFloatTimeDomainData(leftData);
        analyserRRef.current.getFloatTimeDomainData(rightData);

        let sumM2 = 0;
        let sumS2 = 0;
        let sumL2 = 0;
        let sumR2 = 0;
        const len = leftData.length;

        for (let i = 0; i < len; i++) {
          const l = leftData[i];
          const r = rightData[i];
          sumL2 += l * l;
          sumR2 += r * r;

          // Mid (Sum / Center) and Side (Difference / Spatial Spread)
          const m = 0.70710678 * (l + r);
          const s = 0.70710678 * (l - r);
          sumM2 += m * m;
          sumS2 += s * s;
        }

        // Noise floor gate (~ -70 dBFS)
        if (sumL2 > 1e-7 || sumR2 > 1e-7) {
          hasSignal = true;
          instantaneousMidRms = Math.sqrt(sumM2 / len);
          instantaneousSideRms = Math.sqrt(sumS2 / len);

          if (instantaneousMidRms > 1e-6) {
            // Calibrated mastering width ratio:
            // Standard stereo tracks have Side around -6 dB to -8 dB relative to Mid (rmsS/rmsM ~ 0.5 - 0.6)
            // With factor 1.8, nominal stereo reads ~ 95% - 110%.
            const rawRatio = instantaneousSideRms / instantaneousMidRms;
            instantaneousWidth = Math.max(0, Math.min(200, rawRatio * 1.8 * 100));
          } else if (instantaneousSideRms > 1e-6) {
            // Pure side / zero mid (extreme anti-phase)
            instantaneousWidth = 200;
          } else {
            instantaneousWidth = 0; // Pure silence / mono
          }
        } else {
          instantaneousWidth = 100;
        }
      } else {
        instantaneousWidth = 100;
      }

      // Ballistic smoothing: responsive attack, smooth musical decay
      const smoothingFactor = hasSignal ? 0.22 : 0.12;
      smoothedWidthRef.current += (instantaneousWidth - smoothedWidthRef.current) * smoothingFactor;
      smoothedMidRmsRef.current += (instantaneousMidRms - smoothedMidRmsRef.current) * smoothingFactor;
      smoothedSideRmsRef.current += (instantaneousSideRms - smoothedSideRmsRef.current) * smoothingFactor;

      const currentWidth = smoothedWidthRef.current;
      const currentMid = smoothedMidRmsRef.current;
      const currentSide = smoothedSideRmsRef.current;

      // Track peak maximum width reached
      if (hasSignal && currentWidth > maxPeakWidthRef.current) {
        maxPeakWidthRef.current = currentWidth;
      }
      // Track minimum width reached during active playback
      if (hasSignal && currentWidth < minWidthRef.current) {
        minWidthRef.current = currentWidth;
      }

      // Percentage across 0% to 200% scale (0% = 0, 100% = 50% left, 200% = 100% left)
      const cursorPercent = Math.max(0, Math.min(100, (currentWidth / 200) * 100));
      const peakPercent = Math.max(0, Math.min(100, (maxPeakWidthRef.current / 200) * 100));

      // 1. Update Linear Cursor Position & Color Tone
      if (cursorRef.current) {
        cursorRef.current.style.left = `${cursorPercent}%`;
        if (currentWidth < 35) {
          // Excessively narrow / collapsed
          cursorRef.current.style.backgroundColor = '#f59e0b'; // Amber warning
          cursorRef.current.style.boxShadow = '0 0 7px rgba(245, 158, 11, 0.95)';
        } else if (currentWidth < 70) {
          // Focused / modest
          cursorRef.current.style.backgroundColor = '#38bdf8'; // Sky blue
          cursorRef.current.style.boxShadow = '0 0 6px rgba(56, 189, 248, 0.9)';
        } else if (currentWidth <= 130) {
          // Optimal / Balanced stereo
          cursorRef.current.style.backgroundColor = '#10b981'; // Emerald
          cursorRef.current.style.boxShadow = '0 0 7px rgba(16, 185, 129, 0.95)';
        } else if (currentWidth <= 165) {
          // Expansive
          cursorRef.current.style.backgroundColor = '#2dd4bf'; // Teal
          cursorRef.current.style.boxShadow = '0 0 7px rgba(45, 212, 191, 0.9)';
        } else {
          // Excessively wide / out of bounds
          cursorRef.current.style.backgroundColor = '#ef4444'; // Red alert
          cursorRef.current.style.boxShadow = '0 0 9px rgba(239, 68, 68, 1)';
        }
      }

      // 2. Update Peak Width Marker
      if (peakMarkerRef.current) {
        if (hasSignal && maxPeakWidthRef.current > 105) {
          peakMarkerRef.current.style.left = `${peakPercent}%`;
          peakMarkerRef.current.style.opacity = '1';
          if (maxPeakWidthRef.current > 165) {
            peakMarkerRef.current.style.backgroundColor = '#ef4444';
            peakMarkerRef.current.style.boxShadow = '0 0 5px rgba(239,68,68,0.9)';
          } else {
            peakMarkerRef.current.style.backgroundColor = '#f59e0b';
            peakMarkerRef.current.style.boxShadow = '0 0 4px rgba(245,158,11,0.8)';
          }
        } else {
          peakMarkerRef.current.style.opacity = '0';
        }
      }

      // 3. Update Digital Width Readout
      if (widthValueTextRef.current) {
        widthValueTextRef.current.textContent = `${Math.round(currentWidth)}%`;
        if (currentWidth < 35) {
          widthValueTextRef.current.className = 'font-mono text-[7px] text-amber-400 font-black';
        } else if (currentWidth < 70) {
          widthValueTextRef.current.className = 'font-mono text-[7px] text-sky-400 font-bold';
        } else if (currentWidth <= 130) {
          widthValueTextRef.current.className = 'font-mono text-[7px] text-emerald-400 font-bold';
        } else if (currentWidth <= 165) {
          widthValueTextRef.current.className = 'font-mono text-[7px] text-teal-300 font-bold';
        } else {
          widthValueTextRef.current.className = 'font-mono text-[7px] text-rose-400 font-black animate-pulse';
        }
      }

      // 4. Update Diagnostic Status Badge & Warning LED
      if (statusBadgeRef.current) {
        if (!hasSignal) {
          statusBadgeRef.current.textContent = 'READY';
          statusBadgeRef.current.className = 'font-mono text-[6px] text-white/30 font-bold';
        } else if (currentWidth < 35) {
          statusBadgeRef.current.textContent = 'NARROW / MONO';
          statusBadgeRef.current.className = 'font-mono text-[6px] text-amber-400 font-black tracking-wider';
        } else if (currentWidth < 70) {
          statusBadgeRef.current.textContent = 'FOCUSED';
          statusBadgeRef.current.className = 'font-mono text-[6px] text-sky-400 font-bold tracking-wider';
        } else if (currentWidth <= 130) {
          statusBadgeRef.current.textContent = 'OPTIMAL STEREO';
          statusBadgeRef.current.className = 'font-mono text-[6px] text-emerald-400 font-bold tracking-wider';
        } else if (currentWidth <= 165) {
          statusBadgeRef.current.textContent = 'EXPANSIVE';
          statusBadgeRef.current.className = 'font-mono text-[6px] text-teal-300 font-bold tracking-wider';
        } else {
          statusBadgeRef.current.textContent = 'EXCESSIVE WIDE';
          statusBadgeRef.current.className = 'font-mono text-[6px] text-rose-500 font-black tracking-wider animate-pulse';
        }
      }

      // 5. Update Warning LED (Amber on collapsed mono, Red on excessive width)
      if (warningLedRef.current) {
        if (hasSignal && currentWidth > 165) {
          warningLedRef.current.style.backgroundColor = '#ef4444';
          warningLedRef.current.style.boxShadow = '0 0 7px #ef4444, inset 0 0 2px #fff';
        } else if (hasSignal && currentWidth < 35) {
          warningLedRef.current.style.backgroundColor = '#f59e0b';
          warningLedRef.current.style.boxShadow = '0 0 6px #f59e0b, inset 0 0 2px #fff';
        } else if (maxPeakWidthRef.current > 165) {
          warningLedRef.current.style.backgroundColor = '#7f1d1d';
          warningLedRef.current.style.boxShadow = 'none';
        } else {
          warningLedRef.current.style.backgroundColor = '#180505';
          warningLedRef.current.style.boxShadow = 'none';
        }
      }

      // 6. Update Max Peak text readout
      if (peakTextRef.current) {
        peakTextRef.current.textContent = `MAX ${Math.round(maxPeakWidthRef.current)}%`;
        if (maxPeakWidthRef.current > 165) {
          peakTextRef.current.className = 'font-mono text-[6.5px] text-rose-400 font-bold';
        } else if (maxPeakWidthRef.current > 130) {
          peakTextRef.current.className = 'font-mono text-[6.5px] text-teal-400 font-bold';
        } else {
          peakTextRef.current.className = 'font-mono text-[6.5px] text-white/40 font-bold';
        }
      }

      // 7. Update Mid/Side Ratio text (dB)
      if (msRatioTextRef.current && hasSignal && currentMid > 1e-5) {
        const smRatioDb = 20 * Math.log10(Math.max(1e-4, currentSide / currentMid));
        const sign = smRatioDb >= 0 ? '+' : '';
        msRatioTextRef.current.textContent = `S/M ${sign}${smRatioDb.toFixed(1)}dB`;
      } else if (msRatioTextRef.current) {
        msRatioTextRef.current.textContent = 'S/M -INF';
      }

      // 8. Update Spatial Soundstage Arc / Wings (SVG aperture)
      if (leftWingRef.current && rightWingRef.current && spreadArcRef.current) {
        // Center origin at (50, 24).
        // Half-angle theta: 0% width -> 2 deg (almost touching center)
        // 100% width -> 42 deg (nominal stereo cone)
        // 200% width -> 85 deg (extreme wide horizontal spread)
        const halfAngleDeg = Math.max(2, Math.min(85, (currentWidth / 200) * 85));
        const halfAngleRad = (halfAngleDeg * Math.PI) / 180;
        const radius = 20;

        const lx = 50 - radius * Math.sin(halfAngleRad);
        const ly = 24 - radius * Math.cos(halfAngleRad);
        const rx = 50 + radius * Math.sin(halfAngleRad);
        const ry = 24 - radius * Math.cos(halfAngleRad);

        leftWingRef.current.setAttribute('x2', lx.toFixed(1));
        leftWingRef.current.setAttribute('y2', ly.toFixed(1));
        rightWingRef.current.setAttribute('x2', rx.toFixed(1));
        rightWingRef.current.setAttribute('y2', ry.toFixed(1));

        // Arc path between left wing tip and right wing tip
        const arcD = `M ${lx.toFixed(1)} ${ly.toFixed(1)} A ${radius} ${radius} 0 0 1 ${rx.toFixed(1)} ${ry.toFixed(1)}`;
        spreadArcRef.current.setAttribute('d', arcD);

        // Color tone for wings & arc
        let wingColor = '#10b981';
        if (currentWidth < 35) wingColor = '#f59e0b';
        else if (currentWidth < 70) wingColor = '#38bdf8';
        else if (currentWidth <= 130) wingColor = '#10b981';
        else if (currentWidth <= 165) wingColor = '#2dd4bf';
        else wingColor = '#ef4444';

        leftWingRef.current.setAttribute('stroke', wingColor);
        rightWingRef.current.setAttribute('stroke', wingColor);
        spreadArcRef.current.setAttribute('stroke', wingColor);
      }

      animationFrameRef.current = requestAnimationFrame(updateWidthEngine);
    };

    animationFrameRef.current = requestAnimationFrame(updateWidthEngine);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  return (
    <div 
      className={`flex flex-col justify-between self-stretch min-h-[90px] bg-black/70 px-2.5 py-1.5 rounded-xl border relative select-none transition-all duration-200 w-[145px] sm:w-[172px] shadow-2xl ${
        flashReset 
          ? 'border-amber-400 ring-2 ring-amber-400/50 bg-amber-950/40 shadow-[0_0_12px_rgba(245,158,11,0.5)]' 
          : 'border-white/10 hover:border-white/20'
      }`}
    >
      {/* 1. Header: Title, Live Numeric Value & Warning LED */}
      <div className="flex items-center justify-between w-full border-b border-white/5 pb-1">
        <div className="flex items-center gap-1">
          <MoveHorizontal className="w-2.5 h-2.5 text-primary/80" />
          <span className="font-mono text-[7px] font-bold tracking-wider text-white/50">STEREO WIDTH</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span ref={statusBadgeRef} className="font-mono text-[6px] text-emerald-400 font-bold tracking-wider">
            READY
          </span>
          <span ref={widthValueTextRef} className="font-mono text-[7px] text-emerald-400 font-bold">
            100%
          </span>
          <div 
            ref={warningLedRef}
            onClick={resetPeakHold}
            title="Spatial Spread Warning LED (Amber = Narrow Mix < 35% | Red = Excessive Width > 165%) - Clique para resetar"
            className="w-1.5 h-1.5 rounded-full cursor-pointer transition-all duration-300 ml-0.5"
            style={{ backgroundColor: '#180505' }}
          />
        </div>
      </div>

      {/* 2. Soundstage Spatial Aperture Cone & Linear Bar */}
      <div 
        onClick={resetPeakHold}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') resetPeakHold(); }}
        title="Indicador de Abertura Estéreo (0% Mono a 200% Super-Wide). Clique para resetar o pico máximo."
        className="w-full relative my-0.5 cursor-pointer group/bar"
      >
        {/* Micro Soundstage Vector Aperture Display */}
        <div className="flex items-center justify-center h-7 relative w-full mb-0.5">
          <svg viewBox="0 0 100 26" className="w-full h-full overflow-visible">
            {/* Center Phantom Axis (Mono reference) */}
            <line x1="50" y1="24" x2="50" y2="4" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" strokeDasharray="1,1" />

            {/* Standard Stereo Aperture Guides (Nominal 60-90 deg cone) */}
            <path 
              d="M 36.5 9 A 20 20 0 0 1 63.5 9" 
              fill="none" 
              stroke="rgba(16, 185, 129, 0.18)" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
            />

            {/* Live Spatial Spread Arc */}
            <path 
              ref={spreadArcRef}
              d="M 36.5 9 A 20 20 0 0 1 63.5 9" 
              fill="none" 
              stroke="#10b981" 
              strokeWidth="1.2" 
              strokeLinecap="round"
              className="drop-shadow-[0_0_3px_currentColor] transition-colors"
            />

            {/* Left Spatial Wing */}
            <line 
              ref={leftWingRef}
              x1="50" 
              y1="24" 
              x2="36.5" 
              y2="9" 
              stroke="#10b981" 
              strokeWidth="1.2" 
              strokeLinecap="round"
              className="transition-colors"
            />

            {/* Right Spatial Wing */}
            <line 
              ref={rightWingRef}
              x1="50" 
              y1="24" 
              x2="63.5" 
              y2="9" 
              stroke="#10b981" 
              strokeWidth="1.2" 
              strokeLinecap="round"
              className="transition-colors"
            />

            {/* Origin Pivot Dot */}
            <circle cx="50" cy="24" r="1.8" fill="#10b981" className="opacity-90" />
            <circle cx="50" cy="24" r="0.8" fill="#ffffff" />

            {/* Aperture Labels */}
            <text x="14" y="22" fontSize="5" fontFamily="monospace" fill="rgba(255,255,255,0.25)">L</text>
            <text x="83" y="22" fontSize="5" fontFamily="monospace" fill="rgba(255,255,255,0.25)">R</text>
            <text x="50" y="3" fontSize="4.5" fontFamily="monospace" fill="rgba(255,255,255,0.3)" textAnchor="middle">CENTER</text>
          </svg>
        </div>

        {/* Linear Scale labels (0% MONO, 100% STD, 200% WIDE) */}
        <div className="flex justify-between text-[6px] font-mono text-white/30 px-0.5 mb-0.5">
          <span className="text-amber-400/80 font-bold">0% M</span>
          <span className="text-emerald-400/80 font-bold">100% STD</span>
          <span className="text-rose-400/80 font-bold">200% W</span>
        </div>

        {/* Track Container */}
        <div className="w-full h-2 rounded bg-[#0a0a0a] border border-white/10 relative overflow-hidden shadow-inner">
          {/* Graded background gradient: Amber (Narrow) -> Emerald (Optimal) -> Rose (Excessive) */}
          <div className="absolute inset-0 bg-gradient-to-r from-amber-900/60 via-emerald-900/70 via-teal-900/50 to-rose-900/70 opacity-60" />

          {/* Optimal Target Zone Bracket [70% - 130%] */}
          <div 
            className="absolute top-0 bottom-0 border-l border-r border-emerald-500/40 bg-emerald-500/10 pointer-events-none"
            style={{ left: '35%', width: '30%' }}
            title="Zona Ideal de Mix Estéreo (70% - 130%)"
          />

          {/* 100% center nominal line */}
          <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/40 -translate-x-1/2 z-10" />

          {/* Peak Width Tick Marker */}
          <div 
            ref={peakMarkerRef}
            className="absolute top-0 bottom-0 w-1 -translate-x-1/2 z-20 transition-all pointer-events-none rounded-full"
            style={{ left: '50%', opacity: 0, backgroundColor: '#f59e0b' }}
          />

          {/* Real-time Ballistic Cursor Needle */}
          <div 
            ref={cursorRef}
            className="absolute top-0 bottom-0 w-1.5 -translate-x-1/2 z-30 transition-all rounded-full"
            style={{ 
              left: '50%', 
              backgroundColor: '#10b981',
              boxShadow: '0 0 6px rgba(16, 185, 129, 0.9)'
            }}
          />
        </div>

        {/* Hover Hint */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/90 border border-white/20 rounded px-1.5 py-0.5 text-[6px] font-mono text-amber-300 opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
          Clique para resetar pico de abertura
        </div>
      </div>

      {/* 3. Bottom Controls: MAX Peak readout, S/M Ratio & RST */}
      <div className="flex items-center justify-between w-full border-t border-white/5 pt-1 text-[6.5px] font-mono">
        <button
          type="button"
          onClick={resetPeakHold}
          title="Pico máximo de abertura estéreo atingido durante a reprodução"
          className="hover:text-amber-300 transition-colors flex items-center gap-0.5 cursor-pointer"
        >
          <span ref={peakTextRef} className="font-mono text-[6.5px] text-white/40 font-bold">
            MAX 100%
          </span>
        </button>

        <div className="flex items-center gap-1">
          {/* Live Side-to-Mid (S/M) Energy Ratio Readout */}
          <span 
            ref={msRatioTextRef}
            title="Razão de Energia Side / Mid em decibéis. Valores saudáveis: -12 dB a -4 dB"
            className="text-white/30 hidden xs:inline"
          >
            S/M -INF
          </span>

          {/* Reset Button */}
          <button
            type="button"
            onClick={resetPeakHold}
            title="Resetar pico de abertura estéreo e alertas de mix estreito/amplo"
            className="px-1 py-0.5 rounded bg-white/5 hover:bg-amber-500/20 hover:text-amber-300 text-white/40 border border-white/5 transition-all font-bold cursor-pointer flex items-center gap-0.5 group/rst"
          >
            <RotateCcw className="w-2 h-2 group-hover/rst:-rotate-90 transition-transform" />
            <span>RST</span>
          </button>
        </div>
      </div>
    </div>
  );
}
