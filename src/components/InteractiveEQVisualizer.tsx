import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useMastering } from '../context/MasteringContext';

export interface EQBand {
  freq: number;
  gain: number;
  q: number;
}

export interface EQSettings {
  hpf: number;
  low: EQBand;
  lowMid: EQBand;
  mid: EQBand;
  highMid: EQBand;
  high: EQBand;
  lpf: number;
}

interface InteractiveEQVisualizerProps {
  active: boolean;
  eq: EQSettings;
  onChangeEq?: (newEq: EQSettings) => void;
}

type NodeId = 'hpf' | 'low' | 'lowMid' | 'mid' | 'highMid' | 'high' | 'lpf';

interface NodeConfig {
  id: NodeId;
  label: string;
  color: string;
  type: 'filter' | 'shelf' | 'bell';
  minFreq: number;
  maxFreq: number;
}

const NODES_CONFIG: NodeConfig[] = [
  { id: 'hpf', label: 'HPF', color: '#38bdf8', type: 'filter', minFreq: 20, maxFreq: 500 },
  { id: 'low', label: 'Low', color: '#1db954', type: 'shelf', minFreq: 30, maxFreq: 400 },
  { id: 'lowMid', label: 'Low-Mid', color: '#10b981', type: 'bell', minFreq: 120, maxFreq: 1200 },
  { id: 'mid', label: 'Mid', color: '#f59e0b', type: 'bell', minFreq: 400, maxFreq: 4500 },
  { id: 'highMid', label: 'High-Mid', color: '#ec4899', type: 'bell', minFreq: 1500, maxFreq: 10000 },
  { id: 'high', label: 'High', color: '#a855f7', type: 'shelf', minFreq: 4000, maxFreq: 18000 },
  { id: 'lpf', label: 'LPF', color: '#ef4444', type: 'filter', minFreq: 5000, maxFreq: 20000 },
];

export default function InteractiveEQVisualizer({ active, eq, onChangeEq }: InteractiveEQVisualizerProps) {
  const { nodesRef, isPlaying, audioBuffer, audioContextRef } = useMastering();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const fftDataRef = useRef<Uint8Array | null>(null);

  const [hoveredNode, setHoveredNode] = useState<NodeId | null>(null);
  const [draggingNode, setDraggingNode] = useState<NodeId | null>(null);

  // Fallback safe EQ object
  const safeEq: EQSettings = {
    hpf: eq?.hpf ?? 20,
    low: { freq: eq?.low?.freq ?? 100, gain: eq?.low?.gain ?? 0, q: eq?.low?.q ?? 0.7 },
    lowMid: { freq: eq?.lowMid?.freq ?? 250, gain: eq?.lowMid?.gain ?? 0, q: eq?.lowMid?.q ?? 1.0 },
    mid: { freq: eq?.mid?.freq ?? 1000, gain: eq?.mid?.gain ?? 0, q: eq?.mid?.q ?? 1.0 },
    highMid: { freq: eq?.highMid?.freq ?? 2500, gain: eq?.highMid?.gain ?? 0, q: eq?.highMid?.q ?? 1.0 },
    high: { freq: eq?.high?.freq ?? 10000, gain: eq?.high?.gain ?? 0, q: eq?.high?.q ?? 0.7 },
    lpf: eq?.lpf ?? 20000
  };

  const getGeometry = useCallback((w: number, h: number) => {
    const padL = 32;
    const padR = 16;
    const padT = 16;
    const padB = 22;
    const plotW = Math.max(10, w - padL - padR);
    const plotH = Math.max(10, h - padT - padB);
    const centerY = padT + plotH / 2;
    const minLog = Math.log10(20);
    const maxLog = Math.log10(20000);

    const freqToX = (f: number) => {
      const clampedF = Math.max(20, Math.min(20000, f));
      return padL + ((Math.log10(clampedF) - minLog) / (maxLog - minLog)) * plotW;
    };

    const xToFreq = (x: number) => {
      const clampedX = Math.max(padL, Math.min(padL + plotW, x));
      const ratio = (clampedX - padL) / plotW;
      return Math.round(Math.pow(10, minLog + ratio * (maxLog - minLog)));
    };

    const dbToY = (db: number) => {
      const clampedDb = Math.max(-12, Math.min(12, db));
      return centerY - (clampedDb / 12) * (plotH / 2);
    };

    const yToDb = (y: number) => {
      const clampedY = Math.max(padT, Math.min(padT + plotH, y));
      const val = -((clampedY - centerY) / (plotH / 2)) * 12;
      return Number(val.toFixed(1));
    };

    return { padL, padR, padT, padB, plotW, plotH, centerY, freqToX, xToFreq, dbToY, yToDb };
  }, []);

  // Compute screen coordinates for each node
  const getNodePosition = useCallback((id: NodeId, w: number, h: number) => {
    const geom = getGeometry(w, h);
    if (!geom) return { x: 0, y: 0 };

    switch (id) {
      case 'hpf':
        return { x: geom.freqToX(safeEq.hpf), y: geom.centerY };
      case 'low':
        return { x: geom.freqToX(safeEq.low.freq), y: geom.dbToY(safeEq.low.gain) };
      case 'lowMid':
        return { x: geom.freqToX(safeEq.lowMid.freq), y: geom.dbToY(safeEq.lowMid.gain) };
      case 'mid':
        return { x: geom.freqToX(safeEq.mid.freq), y: geom.dbToY(safeEq.mid.gain) };
      case 'highMid':
        return { x: geom.freqToX(safeEq.highMid.freq), y: geom.dbToY(safeEq.highMid.gain) };
      case 'high':
        return { x: geom.freqToX(safeEq.high.freq), y: geom.dbToY(safeEq.high.gain) };
      case 'lpf':
        return { x: geom.freqToX(safeEq.lpf), y: geom.centerY };
    }
  }, [getGeometry, safeEq]);

  // Main Canvas Rendering Loop
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

    const render = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      ctx.clearRect(0, 0, w, h);
      const geom = getGeometry(w, h);

      // 1. Draw dB Horizontal Grid
      const dbLevels = [12, 6, 0, -6, -12];
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.font = '8px monospace';

      dbLevels.forEach((db) => {
        const y = geom.dbToY(db);
        ctx.beginPath();
        if (db === 0) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
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

        // Label
        ctx.fillStyle = db === 0 ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.2)';
        ctx.fillText(`${db > 0 ? '+' : ''}${db}`, geom.padL - 6, y);
      });

      // 2. Draw Frequency Vertical Grid & Labels
      const freqMarkers = [
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

        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillText(label, x, h - geom.padB + 4);
      });

      // 3. Real-time Web Audio Fast Fourier Transform (FFT) Spectrum
      const analyser = nodesRef.current?.analyser;
      const sampleRate = audioContextRef.current?.sampleRate || 48000;

      if (analyser && isPlaying && audioBuffer) {
        const binCount = analyser.frequencyBinCount;
        if (!fftDataRef.current || fftDataRef.current.length !== binCount) {
          fftDataRef.current = new Uint8Array(binCount);
        }
        analyser.getByteFrequencyData(fftDataRef.current);
        const data = fftDataRef.current;
        const binHz = sampleRate / (2 * binCount);

        // Draw Real-time FFT Area Spectrum behind EQ Curve
        ctx.save();
        ctx.beginPath();
        let first = true;
        const step = 3;

        for (let x = geom.padL; x <= geom.padL + geom.plotW; x += step) {
          const freq = geom.xToFreq(x);
          const bin = Math.min(binCount - 1, Math.max(0, Math.round(freq / binHz)));
          const rawVal = data[bin]; // 0..255
          const normalized = rawVal / 255;
          const barH = normalized * (geom.plotH * 0.95);
          const y = h - geom.padB - barH;

          if (first) {
            ctx.moveTo(x, y);
            first = false;
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.lineTo(geom.padL + geom.plotW, h - geom.padB);
        ctx.lineTo(geom.padL, h - geom.padB);
        ctx.closePath();

        const fftGrad = ctx.createLinearGradient(0, geom.padT, 0, h - geom.padB);
        fftGrad.addColorStop(0, 'rgba(29, 185, 84, 0.28)');
        fftGrad.addColorStop(0.6, 'rgba(16, 185, 129, 0.12)');
        fftGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = fftGrad;
        ctx.fill();

        // Stroke top contour of FFT
        ctx.beginPath();
        first = true;
        for (let x = geom.padL; x <= geom.padL + geom.plotW; x += step) {
          const freq = geom.xToFreq(x);
          const bin = Math.min(binCount - 1, Math.max(0, Math.round(freq / binHz)));
          const rawVal = data[bin];
          const normalized = rawVal / 255;
          const barH = normalized * (geom.plotH * 0.95);
          const y = h - geom.padB - barH;

          if (first) {
            ctx.moveTo(x, y);
            first = false;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.strokeStyle = 'rgba(29, 185, 84, 0.4)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      }

      // 4. Calculate and Draw Continuous Parametric Frequency Response Curve
      ctx.beginPath();
      let firstPoint = true;
      const step = 2; // Step in pixels for high performance

      for (let x = geom.padL; x <= geom.padL + geom.plotW; x += step) {
        const freq = geom.xToFreq(x);
        let totalDb = 0;

        // HPF
        const hpfdB = 20 * Math.log10(1 / Math.sqrt(1 + Math.pow(safeEq.hpf / freq, 6)));
        totalDb += Math.max(-48, hpfdB);

        // Low Shelf
        const lowFactor = Math.exp(-Math.pow(freq / (150 * safeEq.low.q), 2));
        totalDb += safeEq.low.gain * lowFactor;

        // Low-Mid Bell
        const lmFactor = Math.exp(-Math.pow((Math.log10(freq) - Math.log10(safeEq.lowMid.freq)) * (4 / safeEq.lowMid.q), 2));
        totalDb += safeEq.lowMid.gain * lmFactor;

        // Mid Bell
        const midFactor = Math.exp(-Math.pow((Math.log10(freq) - Math.log10(safeEq.mid.freq)) * (4 / safeEq.mid.q), 2));
        totalDb += safeEq.mid.gain * midFactor;

        // High-Mid Bell
        const hmFactor = Math.exp(-Math.pow((Math.log10(freq) - Math.log10(safeEq.highMid.freq)) * (4 / safeEq.highMid.q), 2));
        totalDb += safeEq.highMid.gain * hmFactor;

        // High Shelf
        const highFactor = 1 - Math.exp(-Math.pow(freq / (10000 * safeEq.high.q), 2));
        totalDb += safeEq.high.gain * highFactor;

        // LPF
        const lpfdB = 20 * Math.log10(1 / Math.sqrt(1 + Math.pow(freq / safeEq.lpf, 6)));
        totalDb += Math.max(-48, lpfdB);

        const y = geom.dbToY(totalDb);

        if (firstPoint) {
          ctx.moveTo(x, y);
          firstPoint = false;
        } else {
          ctx.lineTo(x, y);
        }
      }

      // Stroke Curve with Glow
      ctx.save();
      ctx.strokeStyle = '#1db954';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(29, 185, 84, 0.6)';
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.restore();

      // Fill Area under the curve
      ctx.lineTo(geom.padL + geom.plotW, geom.centerY);
      ctx.lineTo(geom.padL, geom.centerY);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, geom.padT, 0, h - geom.padB);
      grad.addColorStop(0, 'rgba(29, 185, 84, 0.18)');
      grad.addColorStop(0.5, 'rgba(29, 185, 84, 0.05)');
      grad.addColorStop(1, 'rgba(29, 185, 84, 0.0)');
      ctx.fillStyle = grad;
      ctx.fill();

      // 5. Draw Interactive Nodes
      NODES_CONFIG.forEach((cfg) => {
        const pos = getNodePosition(cfg.id, w, h);
        const isHovered = hoveredNode === cfg.id;
        const isDragging = draggingNode === cfg.id;
        const radius = isDragging ? 7 : isHovered ? 6 : 4.5;

        // Outer Glow Halo when active/hovered
        if (isHovered || isDragging) {
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, radius + 8, 0, Math.PI * 2);
          ctx.fillStyle = `${cfg.color}25`;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(pos.x, pos.y, radius + 4, 0, Math.PI * 2);
          ctx.strokeStyle = cfg.color;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Inner Circle Node
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = cfg.color;
        ctx.shadowColor = cfg.color;
        ctx.shadowBlur = isHovered || isDragging ? 14 : 6;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Center white pip
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // Node Label Tag
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = isHovered || isDragging ? '#ffffff' : 'rgba(255, 255, 255, 0.6)';
        const labelY = pos.y > geom.centerY ? pos.y + radius + 10 : pos.y - radius - 6;
        ctx.fillText(cfg.label, pos.x, labelY);
      });

      requestRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(requestRef.current);
    };
  }, [active, safeEq, hoveredNode, draggingNode, getGeometry, getNodePosition]);

  // Pointer Interaction Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canvasRef.current || !onChangeEq) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;

    // Check hit test for each node
    for (const cfg of NODES_CONFIG) {
      const pos = getNodePosition(cfg.id, w, h);
      const dist = Math.hypot(x - pos.x, y - pos.y);
      if (dist <= 16) {
        setDraggingNode(cfg.id);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;
    const geom = getGeometry(w, h);

    if (draggingNode && onChangeEq) {
      const cfg = NODES_CONFIG.find((c) => c.id === draggingNode);
      if (!cfg) return;

      const rawFreq = geom.xToFreq(x);
      const newFreq = Math.max(cfg.minFreq, Math.min(cfg.maxFreq, rawFreq));
      const newGain = geom.yToDb(y);

      const nextEq = { ...safeEq };
      if (cfg.id === 'hpf') {
        nextEq.hpf = Math.round(newFreq);
      } else if (cfg.id === 'lpf') {
        nextEq.lpf = Math.round(newFreq);
      } else {
        const bandKey = cfg.id as 'low' | 'lowMid' | 'mid' | 'highMid' | 'high';
        nextEq[bandKey] = {
          ...safeEq[bandKey],
          freq: Math.round(newFreq),
          gain: newGain
        };
      }
      onChangeEq(nextEq);
    } else {
      // Update hover state
      let found: NodeId | null = null;
      for (const cfg of NODES_CONFIG) {
        const pos = getNodePosition(cfg.id, w, h);
        const dist = Math.hypot(x - pos.x, y - pos.y);
        if (dist <= 16) {
          found = cfg.id;
          break;
        }
      }
      setHoveredNode(found);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingNode) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setDraggingNode(null);
    }
  };

  // Double click resets band gain to 0 dB
  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current || !onChangeEq) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;

    for (const cfg of NODES_CONFIG) {
      const pos = getNodePosition(cfg.id, w, h);
      const dist = Math.hypot(x - pos.x, y - pos.y);
      if (dist <= 16) {
        if (cfg.id === 'hpf') {
          onChangeEq({ ...safeEq, hpf: 20 });
        } else if (cfg.id === 'lpf') {
          onChangeEq({ ...safeEq, lpf: 20000 });
        } else {
          const bandKey = cfg.id as 'low' | 'lowMid' | 'mid' | 'highMid' | 'high';
          onChangeEq({
            ...safeEq,
            [bandKey]: { ...safeEq[bandKey], gain: 0 }
          });
        }
        return;
      }
    }
  };

  // Mouse wheel adjusts Q (bandwidth)
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!hoveredNode || !onChangeEq) return;
    const cfg = NODES_CONFIG.find((c) => c.id === hoveredNode);
    if (!cfg || cfg.type === 'filter') return; // HPF and LPF don't use Q in this graph

    e.preventDefault();
    const bandKey = cfg.id as 'low' | 'lowMid' | 'mid' | 'highMid' | 'high';
    const currentQ = safeEq[bandKey].q;
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    const newQ = Number(Math.max(0.3, Math.min(8.0, currentQ + delta)).toFixed(2));

    onChangeEq({
      ...safeEq,
      [bandKey]: { ...safeEq[bandKey], q: newQ }
    });
  };

  const activeNodeId = draggingNode || hoveredNode;
  const activeNodeCfg = activeNodeId ? NODES_CONFIG.find((c) => c.id === activeNodeId) : null;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onWheel={handleWheel}
      className={`relative w-full h-full select-none touch-none ${
        draggingNode ? 'cursor-grabbing' : hoveredNode ? 'cursor-grab' : 'cursor-crosshair'
      }`}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Floating HUD Tooltip when a node is hovered or dragged */}
      {activeNodeCfg && (
        <div
          className="absolute top-2 right-3 pointer-events-none bg-black/85 backdrop-blur-md border border-white/15 px-3 py-1.5 rounded-lg shadow-2xl flex items-center gap-3 font-mono text-[9px] animate-in fade-in duration-100"
          style={{ borderColor: activeNodeCfg.color }}
        >
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: activeNodeCfg.color }} />
            <span className="font-bold text-white uppercase">{activeNodeCfg.label}</span>
          </div>

          <div className="text-white/60">
            Freq:{' '}
            <span className="text-white font-bold">
              {activeNodeCfg.id === 'hpf'
                ? `${safeEq.hpf} Hz`
                : activeNodeCfg.id === 'lpf'
                ? `${safeEq.lpf >= 1000 ? `${(safeEq.lpf / 1000).toFixed(1)}k` : safeEq.lpf} Hz`
                : (() => {
                    const f = safeEq[activeNodeCfg.id as 'low' | 'lowMid' | 'mid' | 'highMid' | 'high'].freq;
                    return f >= 1000 ? `${(f / 1000).toFixed(2)} kHz` : `${f} Hz`;
                  })()}
            </span>
          </div>

          {activeNodeCfg.type !== 'filter' && (
            <>
              <div className="text-white/60">
                Gain:{' '}
                <span className="text-primary font-bold">
                  {(() => {
                    const g = safeEq[activeNodeCfg.id as 'low' | 'lowMid' | 'mid' | 'highMid' | 'high'].gain;
                    return `${g > 0 ? '+' : ''}${g} dB`;
                  })()}
                </span>
              </div>
              <div className="text-white/40">
                Q:{' '}
                <span className="text-amber font-bold">
                  {safeEq[activeNodeCfg.id as 'low' | 'lowMid' | 'mid' | 'highMid' | 'high'].q.toFixed(2)}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Bottom helper tip */}
      <div className="absolute bottom-1 left-9 pointer-events-none text-[7px] font-mono text-white/25 uppercase tracking-wider hidden sm:block">
        Arrastar nós: Freq / Ganho • Scroll: Ajuste de Q • Duplo clique: Reset 0 dB
      </div>
    </div>
  );
}
