import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  CircleDot, 
  Play, 
  Pause, 
  RotateCcw, 
  Trash2, 
  Sparkles, 
  Sliders, 
  Maximize2, 
  Minimize2, 
  Check, 
  X, 
  Plus, 
  HelpCircle,
  Volume2,
  Waves,
  Zap,
  ChevronDown
} from 'lucide-react';
import { useMastering } from '../context/MasteringContext';
import { 
  AutomatableParam, 
  AutomationPoint, 
  ParameterAutomation, 
  AutomationMode, 
  DEFAULT_AUTOMATION_TRACKS, 
  interpolateAutomationValue, 
  addOrUpdateAutomationPoint,
  generatePresetShape
} from '../data/automationTypes';

interface AutomationStudioProps {
  onClose?: () => void;
  // External hook to record parameter changes made from main console sliders/knobs
  recordedParamEvent?: { param: AutomatableParam; value: number } | null;
  automationMode: AutomationMode;
  setAutomationMode: (mode: AutomationMode) => void;
  tracks: Record<AutomatableParam, ParameterAutomation>;
  setTracks: React.Dispatch<React.SetStateAction<Record<AutomatableParam, ParameterAutomation>>>;
  activeParam: AutomatableParam;
  setActiveParam: (param: AutomatableParam) => void;
}

export default function AutomationStudio({
  onClose,
  automationMode,
  setAutomationMode,
  tracks,
  setTracks,
  activeParam,
  setActiveParam
}: AutomationStudioProps) {
  const { 
    audioBuffer, 
    currentTime, 
    isPlaying, 
    handleSeek, 
    togglePlayback,
    settings,
    updateSettings,
    nodesRef,
    audioContextRef
  } = useMastering();

  const totalDuration = Math.max(10, audioBuffer?.duration || 120);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ time: number; value: number; x: number; y: number } | null>(null);
  const [isScrubbingRuler, setIsScrubbingRuler] = useState(false);
  const [snapGrid, setSnapGrid] = useState<number>(0); // 0 = Free, 0.5 = 0.5s, 1 = 1s
  const [showPresetsMenu, setShowPresetsMenu] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const currentTrackConfig = tracks[activeParam];

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  // Convert Time / Value to Canvas X / Y
  const getCoordinates = useCallback((time: number, value: number, width: number, height: number) => {
    const padL = 45;
    const padR = 20;
    const padT = 24;
    const padB = 26;

    const plotW = Math.max(10, width - padL - padR);
    const plotH = Math.max(10, height - padT - padB);

    const x = padL + (time / totalDuration) * plotW;
    
    const minVal = currentTrackConfig.min;
    const maxVal = currentTrackConfig.max;
    const valRange = maxVal - minVal;
    
    // Invert Y so max is at top
    const normalizedVal = (value - minVal) / valRange;
    const y = padT + (1 - normalizedVal) * plotH;

    return { x, y, padL, padR, padT, padB, plotW, plotH };
  }, [totalDuration, currentTrackConfig]);

  // Convert Canvas X / Y to Time / Value
  const getTimeAndValueFromCoords = useCallback((clientX: number, clientY: number, rect: DOMRect) => {
    const width = rect.width;
    const height = rect.height;

    const padL = 45;
    const padR = 20;
    const padT = 24;
    const padB = 26;

    const plotW = Math.max(10, width - padL - padR);
    const plotH = Math.max(10, height - padT - padB);

    const x = Math.max(padL, Math.min(width - padR, clientX - rect.left));
    const y = Math.max(padT, Math.min(height - padB, clientY - rect.top));

    let time = ((x - padL) / plotW) * totalDuration;
    if (snapGrid > 0) {
      time = Math.round(time / snapGrid) * snapGrid;
    }
    time = Math.max(0, Math.min(totalDuration, time));

    const minVal = currentTrackConfig.min;
    const maxVal = currentTrackConfig.max;
    const valRange = maxVal - minVal;

    const normalizedY = 1 - ((y - padT) / plotH);
    let value = minVal + normalizedY * valRange;
    value = Math.round(value * 10) / 10;
    value = Math.max(minVal, Math.min(maxVal, value));

    return { time, value };
  }, [totalDuration, currentTrackConfig, snapGrid]);

  // Redraw Canvas on changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    const height = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const cssWidth = canvas.offsetWidth;
    const cssHeight = canvas.offsetHeight;

    const { padL, padR, padT, padB, plotW, plotH } = getCoordinates(0, 0, cssWidth, cssHeight);

    // Background fill
    ctx.fillStyle = '#08080a';
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    // Gridlines (Horizontal - Value)
    const minVal = currentTrackConfig.min;
    const maxVal = currentTrackConfig.max;
    const stepVal = (maxVal - minVal) / 4;

    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= 4; i++) {
      const val = minVal + i * stepVal;
      const { y } = getCoordinates(0, val, cssWidth, cssHeight);

      // Grid line
      ctx.strokeStyle = val === 0 ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = val === 0 ? 1.5 : 1;
      if (val === 0) ctx.setLineDash([4, 4]);
      else ctx.setLineDash([]);

      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(cssWidth - padR, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      ctx.fillStyle = val === 0 ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.3)';
      const labelStr = currentTrackConfig.unit === 'Hz' 
        ? `${Math.round(val)}Hz` 
        : `${val > 0 ? '+' : ''}${Math.round(val)}dB`;
      ctx.fillText(labelStr, padL - 8, y);
    }

    // Gridlines (Vertical - Time)
    const timeStep = totalDuration > 120 ? 30 : totalDuration > 60 ? 15 : 5;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let t = 0; t <= totalDuration; t += timeStep) {
      const { x } = getCoordinates(t, 0, cssWidth, cssHeight);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, cssHeight - padB);
      ctx.stroke();

      // Time ruler label
      const mins = Math.floor(t / 60);
      const secs = Math.floor(t % 60);
      const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillText(timeStr, x, cssHeight - padB + 6);
    }

    const points = currentTrackConfig.points;

    // Draw Curve
    if (points.length > 0) {
      // 1. Area fill underneath curve
      const gradient = ctx.createLinearGradient(0, padT, 0, cssHeight - padB);
      gradient.addColorStop(0, `${currentTrackConfig.color}40`);
      gradient.addColorStop(1, `${currentTrackConfig.color}05`);

      ctx.beginPath();
      const firstCoord = getCoordinates(points[0].time, points[0].value, cssWidth, cssHeight);
      ctx.moveTo(firstCoord.x, cssHeight - padB);
      ctx.lineTo(firstCoord.x, firstCoord.y);

      for (let i = 1; i < points.length; i++) {
        const coord = getCoordinates(points[i].time, points[i].value, cssWidth, cssHeight);
        ctx.lineTo(coord.x, coord.y);
      }

      const lastCoord = getCoordinates(points[points.length - 1].time, points[points.length - 1].value, cssWidth, cssHeight);
      ctx.lineTo(lastCoord.x, cssHeight - padB);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // 2. Stroke line
      ctx.beginPath();
      ctx.moveTo(firstCoord.x, firstCoord.y);
      for (let i = 1; i < points.length; i++) {
        const coord = getCoordinates(points[i].time, points[i].value, cssWidth, cssHeight);
        ctx.lineTo(coord.x, coord.y);
      }
      ctx.strokeStyle = currentTrackConfig.color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = currentTrackConfig.color;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 3. Draw keyframe points
      points.forEach(pt => {
        const { x, y } = getCoordinates(pt.time, pt.value, cssWidth, cssHeight);
        const isHovered = pt.id === hoveredPointId;
        const isDragging = pt.id === draggingPointId;

        ctx.beginPath();
        ctx.arc(x, y, isDragging ? 6.5 : isHovered ? 5.5 : 4, 0, Math.PI * 2);
        ctx.fillStyle = isHovered || isDragging ? '#ffffff' : currentTrackConfig.color;
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    }

    // Draw Live Playhead
    const playhead = getCoordinates(currentTime, 0, cssWidth, cssHeight);
    ctx.beginPath();
    ctx.moveTo(playhead.x, padT - 6);
    ctx.lineTo(playhead.x, cssHeight - padB + 2);
    ctx.strokeStyle = automationMode === 'write' ? '#ef4444' : '#1db954';
    ctx.lineWidth = 2;
    ctx.shadowColor = automationMode === 'write' ? '#ef4444' : '#1db954';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Playhead handle on top ruler
    ctx.beginPath();
    ctx.moveTo(playhead.x - 5, padT - 10);
    ctx.lineTo(playhead.x + 5, padT - 10);
    ctx.lineTo(playhead.x, padT - 3);
    ctx.closePath();
    ctx.fillStyle = automationMode === 'write' ? '#ef4444' : '#1db954';
    ctx.fill();

  }, [
    currentTrackConfig, 
    currentTime, 
    totalDuration, 
    hoveredPointId, 
    draggingPointId, 
    getCoordinates,
    automationMode
  ]);

  // Handle Mouse Down (Clicking/Dragging Points or Scrubbing Playhead)
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;

    const cssWidth = canvas.offsetWidth;
    const cssHeight = canvas.offsetHeight;

    // Check if clicked in the top ruler area (padT - 14 to padT) for scrubbing
    const clickYRel = clientY - rect.top;
    if (clickYRel <= 26) {
      setIsScrubbingRuler(true);
      const { time } = getTimeAndValueFromCoords(clientX, clientY, rect);
      handleSeek(time);
      return;
    }

    // Check if clicked near an existing keyframe point
    const points = currentTrackConfig.points;
    let foundPointId: string | null = null;

    for (const pt of points) {
      const { x, y } = getCoordinates(pt.time, pt.value, cssWidth, cssHeight);
      const dx = clientX - (rect.left + x);
      const dy = clientY - (rect.top + y);
      if (Math.hypot(dx, dy) <= 12) {
        foundPointId = pt.id;
        break;
      }
    }

    if (e.button === 2 || e.altKey) {
      // Right-click or Alt-click to delete point
      if (foundPointId) {
        setTracks(prev => ({
          ...prev,
          [activeParam]: {
            ...prev[activeParam],
            points: prev[activeParam].points.filter(p => p.id !== foundPointId)
          }
        }));
        showToast("Deleted automation keyframe");
      }
      return;
    }

    if (foundPointId) {
      // Start dragging existing point
      setDraggingPointId(foundPointId);
    } else {
      // Add a new point at cursor location
      const { time, value } = getTimeAndValueFromCoords(clientX, clientY, rect);
      const newPoints = addOrUpdateAutomationPoint(currentTrackConfig.points, time, value, 0.05);

      setTracks(prev => ({
        ...prev,
        [activeParam]: {
          ...prev[activeParam],
          points: newPoints
        }
      }));

      // Find the created point and set dragging
      const createdPt = newPoints.find(p => Math.abs(p.time - time) <= 0.06);
      if (createdPt) {
        setDraggingPointId(createdPt.id);
      }
    }
  };

  // Handle Mouse Move (Hovering or Dragging)
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;
    const cssWidth = canvas.offsetWidth;
    const cssHeight = canvas.offsetHeight;

    if (isScrubbingRuler) {
      const { time } = getTimeAndValueFromCoords(clientX, clientY, rect);
      handleSeek(time);
      return;
    }

    if (draggingPointId) {
      const { time, value } = getTimeAndValueFromCoords(clientX, clientY, rect);

      setTracks(prev => {
        const pts = prev[activeParam].points.map(p => {
          if (p.id === draggingPointId) {
            return { ...p, time, value };
          }
          return p;
        });
        return {
          ...prev,
          [activeParam]: {
            ...prev[activeParam],
            points: pts.sort((a, b) => a.time - b.time)
          }
        };
      });

      setHoverInfo({ time, value, x: clientX - rect.left, y: clientY - rect.top });
      return;
    }

    // Check hover near points
    const points = currentTrackConfig.points;
    let hoveredId: string | null = null;

    for (const pt of points) {
      const { x, y } = getCoordinates(pt.time, pt.value, cssWidth, cssHeight);
      const dx = clientX - (rect.left + x);
      const dy = clientY - (rect.top + y);
      if (Math.hypot(dx, dy) <= 10) {
        hoveredId = pt.id;
        setHoverInfo({ time: pt.time, value: pt.value, x, y });
        break;
      }
    }

    setHoveredPointId(hoveredId);
    if (!hoveredId) setHoverInfo(null);
  };

  // Handle Mouse Up
  const handleMouseUp = () => {
    setDraggingPointId(null);
    setIsScrubbingRuler(false);
  };

  // Apply a preset shape
  const handleApplyPresetShape = (shape: 'fade-in' | 'fade-out' | 'chorus-lift' | 'drop-swell' | 'filter-sweep' | 'sidechain-pump' | 'clear') => {
    const newPoints = generatePresetShape(activeParam, shape, totalDuration);
    setTracks(prev => ({
      ...prev,
      [activeParam]: {
        ...prev[activeParam],
        points: newPoints
      }
    }));
    setShowPresetsMenu(false);
    showToast(shape === 'clear' ? 'Cleared automation curve' : `Applied ${shape.replace('-', ' ')} envelope`);
  };

  // Clear all automation
  const handleClearAll = () => {
    setTracks(prev => {
      const reset: any = {};
      Object.keys(prev).forEach(key => {
        reset[key] = { ...prev[key as AutomatableParam], points: [] };
      });
      return reset;
    });
    showToast("Cleared all automation tracks");
  };

  // Currently evaluated value for active track at current playback time
  const evaluatedActiveValue = useMemo(() => {
    const val = interpolateAutomationValue(currentTrackConfig.points, currentTime);
    return val !== null ? val : currentTrackConfig.defaultValue;
  }, [currentTrackConfig, currentTime]);

  const activePointsCount = currentTrackConfig.points.length;
  const totalAutomationPoints = useMemo(() => {
    return Object.values(tracks).reduce((acc, t) => acc + t.points.length, 0);
  }, [tracks]);

  return (
    <div ref={containerRef} className="piano-black rounded-2xl border border-white/10 p-5 space-y-4 shadow-2xl relative overflow-hidden">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-3 py-1 bg-primary text-obsidian rounded-full font-mono text-[9px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1.5 pointer-events-none"
          >
            <Check className="w-3 h-3 stroke-[3]" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header bar: Title & Automation Mode Transport */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-7 bg-primary rounded-xs shadow-[0_0_12px_#1db954]" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] text-primary uppercase tracking-[0.25em] font-bold">Automation Core</span>
              <span className="font-mono text-[8px] bg-white/5 text-white/40 px-1.5 py-0.2 rounded border border-white/5">
                {totalAutomationPoints} Active Points
              </span>
            </div>
            <h3 className="font-mono text-sm uppercase text-white font-bold tracking-tight mt-0.5">
              Gain & EQ Parameter Automation
            </h3>
          </div>
        </div>

        {/* Global Automation Mode Switcher */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-black/60 p-1 rounded-xl border border-white/10 shadow-inner">
            {/* OFF */}
            <button
              onClick={() => setAutomationMode('off')}
              className={`px-3 py-1 rounded-lg font-mono text-[8.5px] uppercase tracking-wider font-bold transition-all ${
                automationMode === 'off'
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-white/30 hover:text-white/60'
              }`}
            >
              Manual / Off
            </button>

            {/* READ (Play back automation) */}
            <button
              onClick={() => setAutomationMode('read')}
              title="Play back recorded automation envelopes on Gain and EQ nodes"
              className={`px-3 py-1 rounded-lg font-mono text-[8.5px] uppercase tracking-wider font-bold transition-all flex items-center gap-1.5 ${
                automationMode === 'read'
                  ? 'bg-primary text-obsidian shadow-[0_0_15px_rgba(29,185,84,0.3)]'
                  : 'text-primary/70 hover:text-primary hover:bg-primary/10'
              }`}
            >
              <Play className="w-2.5 h-2.5 fill-current" />
              <span>Auto Read</span>
            </button>

            {/* WRITE / RECORD (Record automation in real-time) */}
            <button
              onClick={() => setAutomationMode('write')}
              title="Record automation in real-time: Move Gain slider or EQ knobs during playback"
              className={`px-3 py-1 rounded-lg font-mono text-[8.5px] uppercase tracking-wider font-bold transition-all flex items-center gap-1.5 ${
                automationMode === 'write'
                  ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-pulse'
                  : 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
              }`}
            >
              <CircleDot className="w-2.5 h-2.5 fill-current" />
              <span>Record Auto</span>
            </button>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Recording Status Banner */}
      <AnimatePresence>
        {automationMode === 'write' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-500/30 flex items-center justify-between font-mono text-[9px] text-red-200">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span className="font-bold uppercase tracking-widest text-red-400">REC READY</span>
                <span>
                  {isPlaying 
                    ? `Recording ${currentTrackConfig.name} movements to timeline... Move knobs or sliders!` 
                    : 'Press Play in the transport bar to begin recording automation movements'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-white/60">Time: {currentTime.toFixed(2)}s</span>
                {!isPlaying && (
                  <button
                    onClick={togglePlayback}
                    className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded font-bold uppercase tracking-widest"
                  >
                    Start Playback
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Parameter Selector Tabs Bar */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-1 border-b border-white/5">
        <div className="flex gap-1.5 min-w-max">
          {(Object.keys(tracks) as AutomatableParam[]).map((pId) => {
            const trk = tracks[pId];
            const isSelected = activeParam === pId;
            const hasPoints = trk.points.length > 0;

            return (
              <button
                key={pId}
                onClick={() => setActiveParam(pId)}
                className={`px-3 py-1.5 rounded-xl font-mono text-[9px] uppercase tracking-wider transition-all flex items-center gap-2 ${
                  isSelected
                    ? 'bg-black/90 border border-white/25 text-white shadow-md'
                    : 'bg-black/40 border border-white/5 text-white/40 hover:text-white/80 hover:bg-black/60'
                }`}
              >
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: trk.color }} 
                />
                <span className={isSelected ? 'font-bold' : ''}>{trk.name}</span>
                {hasPoints && (
                  <span className="text-[7.5px] px-1.5 py-0.2 rounded bg-white/10 text-white/70 font-mono">
                    {trk.points.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Live Evaluated Metric */}
        <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-xl border border-white/10 font-mono text-[9.5px] whitespace-nowrap">
          <span className="text-white/40 uppercase tracking-widest text-[8px]">Cur. Value:</span>
          <span className="font-bold text-white" style={{ color: currentTrackConfig.color }}>
            {currentTrackConfig.unit === 'Hz'
              ? `${Math.round(evaluatedActiveValue)} Hz`
              : `${evaluatedActiveValue > 0 ? '+' : ''}${evaluatedActiveValue.toFixed(1)} dB`}
          </span>
        </div>
      </div>

      {/* Interactive Automation Canvas */}
      <div className="relative rounded-xl border border-white/10 bg-black overflow-hidden shadow-inner select-none">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={(e) => e.preventDefault()}
          className="w-full h-48 cursor-crosshair block"
        />

        {/* Hover Point Tooltip */}
        {hoverInfo && (
          <div 
            className="absolute z-30 pointer-events-none -translate-x-1/2 -translate-y-full mb-2 bg-black/90 text-white border border-white/20 px-2 py-1 rounded shadow-lg font-mono text-[8.5px] whitespace-nowrap flex items-center gap-1.5"
            style={{ left: `${hoverInfo.x}px`, top: `${hoverInfo.y}px` }}
          >
            <span className="text-primary font-bold">
              {currentTrackConfig.unit === 'Hz' 
                ? `${Math.round(hoverInfo.value)}Hz` 
                : `${hoverInfo.value > 0 ? '+' : ''}${hoverInfo.value.toFixed(1)}dB`}
            </span>
            <span className="text-white/40">@ {hoverInfo.time.toFixed(2)}s</span>
          </div>
        )}

        {/* Canvas Instructions Watermark */}
        <div className="absolute bottom-2 right-3 pointer-events-none font-mono text-[7.5px] text-white/20 uppercase tracking-widest flex items-center gap-3">
          <span>Click: Add Keyframe</span>
          <span>•</span>
          <span>Drag: Move Point</span>
          <span>•</span>
          <span>Right-Click: Delete</span>
          <span>•</span>
          <span>Top Bar: Scrub Playhead</span>
        </div>
      </div>

      {/* Bottom Tooling Bar: Shapes, Clear, Snap */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          {/* Preset Shapes Generator Menu */}
          <div className="relative">
            <button
              onClick={() => setShowPresetsMenu(!showPresetsMenu)}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 rounded-xl font-mono text-[8.5px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-3 h-3 text-primary" />
              <span>Generate Envelope Shape</span>
              <ChevronDown className="w-3 h-3 text-white/40" />
            </button>

            <AnimatePresence>
              {showPresetsMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute bottom-full mb-2 left-0 w-52 bg-obsidian-light/95 border border-white/15 rounded-xl shadow-2xl p-1.5 z-50 backdrop-blur-md space-y-1 font-mono text-[9px]"
                >
                  <div className="px-2 py-1 text-white/30 text-[8px] uppercase tracking-widest">Mastering Envelopes</div>
                  <button
                    onClick={() => handleApplyPresetShape('fade-in')}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-white/10 rounded text-white hover:text-primary transition-colors flex items-center justify-between"
                  >
                    <span>Intro Fade-In (4.5s)</span>
                    <span className="text-[7.5px] text-white/30">Gain</span>
                  </button>
                  <button
                    onClick={() => handleApplyPresetShape('fade-out')}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-white/10 rounded text-white hover:text-primary transition-colors flex items-center justify-between"
                  >
                    <span>Outro Fade-Out (8s)</span>
                    <span className="text-[7.5px] text-white/30">Gain</span>
                  </button>
                  <button
                    onClick={() => handleApplyPresetShape('chorus-lift')}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-white/10 rounded text-white hover:text-primary transition-colors flex items-center justify-between"
                  >
                    <span>Chorus Energy Lift</span>
                    <span className="text-[7.5px] text-white/30">+1.5dB</span>
                  </button>
                  <button
                    onClick={() => handleApplyPresetShape('drop-swell')}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-white/10 rounded text-white hover:text-primary transition-colors flex items-center justify-between"
                  >
                    <span>Drop Low-End Swell</span>
                    <span className="text-[7.5px] text-white/30">EQ Low</span>
                  </button>
                  <button
                    onClick={() => handleApplyPresetShape('filter-sweep')}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-white/10 rounded text-white hover:text-primary transition-colors flex items-center justify-between"
                  >
                    <span>HPF Filter Sweep</span>
                    <span className="text-[7.5px] text-white/30">20-420Hz</span>
                  </button>
                  <button
                    onClick={() => handleApplyPresetShape('sidechain-pump')}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-white/10 rounded text-white hover:text-primary transition-colors flex items-center justify-between"
                  >
                    <span>Quarter-Note Pulse</span>
                    <span className="text-[7.5px] text-white/30">Pump</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Snap Grid Selector */}
          <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-xl border border-white/5 font-mono text-[8px] text-white/40">
            <span>Grid:</span>
            {[
              { label: 'Free', val: 0 },
              { label: '0.5s', val: 0.5 },
              { label: '1.0s', val: 1.0 },
              { label: '2.0s', val: 2.0 }
            ].map(g => (
              <button
                key={g.label}
                onClick={() => setSnapGrid(g.val)}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  snapGrid === g.val ? 'bg-primary text-obsidian font-bold' : 'hover:text-white'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Clear Curve Actions */}
        <div className="flex items-center gap-2 font-mono text-[8.5px]">
          <button
            onClick={() => handleApplyPresetShape('clear')}
            disabled={activePointsCount === 0}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-white/60 hover:text-red-400 border border-white/5 rounded-xl transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset {currentTrackConfig.name}</span>
          </button>

          <button
            onClick={handleClearAll}
            disabled={totalAutomationPoints === 0}
            className="px-3 py-1.5 bg-red-950/30 hover:bg-red-950/60 disabled:opacity-30 disabled:pointer-events-none text-red-400 border border-red-900/30 rounded-xl transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear All</span>
          </button>
        </div>
      </div>
    </div>
  );
}
