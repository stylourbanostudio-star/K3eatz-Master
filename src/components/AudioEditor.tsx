import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Scissors, 
  Trash2, 
  Plus, 
  Play, 
  Pause, 
  ZoomIn, 
  ZoomOut, 
  ChevronLeft, 
  Save,
  Clock,
  Move,
  RefreshCw,
  Activity,
  RotateCcw,
  RotateCw,
  Hand,
  Settings2,
  X,
  Combine
} from 'lucide-react';
import { useMastering, AudioClip, Track } from '../context/MasteringContext';

interface AudioEditorProps {
  onClose: () => void;
}

export default function AudioEditor({ onClose }: AudioEditorProps) {
  const { currentTrack, setCurrentTrack, t } = useMastering();
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [tool, setTool] = useState<'select' | 'split' | 'hand'>('select');
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastXRef = useRef<number>(0);

  // Undo/Redo History
  const [history, setHistory] = useState<AudioClip[][]>([]);
  const [redoStack, setRedoStack] = useState<AudioClip[][]>([]);

  // Initialize clips if they don't exist
  const [clips, setClips] = useState<AudioClip[]>(() => {
    if (currentTrack?.clips && currentTrack.clips.length > 0) {
      return currentTrack.clips;
    }
    return [{
      id: 'clip-1',
      name: 'Original',
      startTime: 0,
      endTime: currentTrack?.duration || 0,
      trackOffset: 0
    }];
  });

  const pushHistory = (newClips: AudioClip[]) => {
    setHistory(prev => [...prev, clips]);
    setRedoStack([]);
    setClips(newClips);
  };

  const undo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setRedoStack(prevRedo => [...prevRedo, clips]);
    setHistory(prevHistory => prevHistory.slice(0, -1));
    setClips(prev);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistory(prevHistory => [...prevHistory, clips]);
    setRedoStack(prevRedo => prevRedo.slice(0, -1));
    setClips(next);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clips, history, redoStack]);

  useEffect(() => {
    if (currentTrack?.file) {
      loadAudio(currentTrack.file);
    }
  }, [currentTrack?.file]);

  const loadAudio = async (file: File) => {
    setLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      setAudioBuffer(decodedBuffer);
      
      // Update duration if it was 0
      if (currentTrack && currentTrack.duration === 0) {
         // This is a bit tricky since Track is in context, but we can update clips
         setClips([{
           id: 'clip-1',
           name: 'Original',
           startTime: 0,
           endTime: decodedBuffer.duration,
           trackOffset: 0
         }]);
      }
    } catch (error) {
      console.error("Failed to load audio:", error);
    } finally {
      setLoading(false);
    }
  };

  const playPause = () => {
    if (!audioBuffer || !audioContextRef.current) return;

    if (isPlaying) {
      sourceRef.current?.stop();
      setIsPlaying(false);
    } else {
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      const offset = currentTime;
      source.start(0, offset);
      sourceRef.current = source;
      startTimeRef.current = audioContextRef.current.currentTime - offset;
      
      setIsPlaying(true);
      
      source.onended = () => {
        setIsPlaying(false);
      };
    }
  };

  useEffect(() => {
    let animationFrame: number;
    const updateProgress = () => {
      if (isPlaying && audioContextRef.current) {
        const time = audioContextRef.current.currentTime - startTimeRef.current;
        setCurrentTime(time);
        if (time >= (audioBuffer?.duration || 0)) {
          setIsPlaying(false);
        }
      }
      animationFrame = requestAnimationFrame(updateProgress);
    };
    animationFrame = requestAnimationFrame(updateProgress);
    return () => cancelAnimationFrame(animationFrame);
  }, [isPlaying, audioBuffer]);

  const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !audioBuffer) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const scrollLeft = containerRef.current.scrollLeft;
    const time = ((x + scrollLeft) / (containerRef.current.scrollWidth)) * audioBuffer.duration;
    
    if (tool === 'hand') {
      setIsPanning(true);
      lastXRef.current = e.clientX;
      document.addEventListener('mousemove', handleMouseMovePan);
      document.addEventListener('mouseup', handleMouseUpPan);
      return;
    }

    if (tool === 'split') {
      // Find clip under cursor if none selected
      let targetClipId = selectedClipIds[0];
      if (!targetClipId) {
        const clipUnder = clips.find(c => time >= c.trackOffset && time <= c.trackOffset + (c.endTime - c.startTime));
        if (clipUnder) targetClipId = clipUnder.id;
      }
      
      if (targetClipId) {
        splitClip(targetClipId, time);
      }
    } else if (tool === 'select') {
      if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
        setSelectedClipIds([]);
      }
      setCurrentTime(time);
      if (isPlaying) {
        sourceRef.current?.stop();
        setIsPlaying(false);
        setTimeout(() => playPause(), 50);
      }
    } else {
      setCurrentTime(time);
      if (isPlaying) {
        sourceRef.current?.stop();
        setIsPlaying(false);
        setTimeout(() => playPause(), 50);
      }
    }
  };

  const handleMouseMoveTimeline = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !audioBuffer) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const scrollLeft = containerRef.current.scrollLeft;
    const time = ((x + scrollLeft) / containerRef.current.scrollWidth) * audioBuffer.duration;
    setHoveredTime(time);
  };

  const handleMouseMovePan = (e: MouseEvent) => {
    if (!containerRef.current) return;
    const dx = e.clientX - lastXRef.current;
    containerRef.current.scrollLeft -= dx;
    lastXRef.current = e.clientX;
  };

  const handleMouseUpPan = () => {
    setIsPanning(false);
    document.removeEventListener('mousemove', handleMouseMovePan);
    document.removeEventListener('mouseup', handleMouseUpPan);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.5 : 0.5;
      const newZoom = Math.min(20, Math.max(1, zoom + delta));
      
      if (newZoom !== zoom && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const scrollLeft = containerRef.current.scrollLeft;
        
        // Calculate the time at the mouse position before zoom
        const timeAtMouse = ((mouseX + scrollLeft) / containerRef.current.scrollWidth) * (audioBuffer?.duration || 1);
        
        setZoom(newZoom);
        
        // After zoom, we want the same 'timeAtMouse' to be at the same 'mouseX' 
        // We'll need a small effect or timeout to adjust scroll after state update
        setTimeout(() => {
          if (containerRef.current) {
            const newScrollWidth = containerRef.current.scrollWidth;
            const newScrollLeft = (timeAtMouse / (audioBuffer?.duration || 1)) * newScrollWidth - mouseX;
            containerRef.current.scrollLeft = newScrollLeft;
          }
        }, 0);
      }
    }
  };

  const splitClip = (clipId: string, time: number) => {
    const clipIndex = clips.findIndex(c => c.id === clipId);
    if (clipIndex === -1) return;

    const clip = clips[clipIndex];
    // Convert timeline time to clip-relative source time
    const sourceTimeAtSplit = clip.startTime + (time - clip.trackOffset);

    if (sourceTimeAtSplit <= clip.startTime || sourceTimeAtSplit >= clip.endTime) return;

    const newClip1: AudioClip = {
      ...clip,
      endTime: sourceTimeAtSplit,
    };

    const newClip2: AudioClip = {
      id: `clip-${Date.now()}`,
      name: `${clip.name.replace(/ \(Part \d+\)$/, '')} (Part ${clips.length + 1})`,
      startTime: sourceTimeAtSplit,
      endTime: clip.endTime,
      trackOffset: time
    };

    const updatedClips = [...clips];
    updatedClips.splice(clipIndex, 1, newClip1, newClip2);
    pushHistory(updatedClips);
    setTool('select');
    setSelectedClipIds([newClip2.id]);
  };

  const mergeClips = () => {
    if (selectedClipIds.length < 2) return;

    const selectedItems = clips.filter(c => selectedClipIds.includes(c.id));
    selectedItems.sort((a, b) => a.trackOffset - b.trackOffset);

    const first = selectedItems[0];
    const last = selectedItems[selectedItems.length - 1];

    const mergedClip: AudioClip = {
      id: `clip-merged-${Date.now()}`,
      name: `${first.name.replace(/ \(Part \d+\)$/, '')} (Merged)`,
      startTime: first.startTime,
      endTime: last.endTime,
      trackOffset: first.trackOffset,
      fadeInDuration: first.fadeInDuration,
      fadeOutDuration: last.fadeOutDuration
    };

    const remainingClips = clips.filter(c => !selectedClipIds.includes(c.id));
    const newClips = [...remainingClips, mergedClip].sort((a, b) => a.trackOffset - b.trackOffset);
    
    pushHistory(newClips);
    setSelectedClipIds([mergedClip.id]);
  };

  const deleteClip = (clipId: string) => {
    pushHistory(clips.filter(c => c.id !== clipId));
    setSelectedClipIds(prev => prev.filter(id => id !== clipId));
  };

  const normalizeAudio = () => {
    if (!audioBuffer) return;
    setIsNormalizing(true);
    
    // Save state before normalization in history? 
    // Usually normalization changes the buffer, not the clips. 
    // But we'll leave it simple for now.
      const numberOfChannels = audioBuffer.numberOfChannels;
      let maxAmp = 0;
      
      // Find peak amplitude across all channels
      for (let c = 0; c < numberOfChannels; c++) {
        const data = audioBuffer.getChannelData(c);
        for (let i = 0; i < data.length; i++) {
          const abs = Math.abs(data[i]);
          if (abs > maxAmp) maxAmp = abs;
        }
      }
      
      if (maxAmp > 0) {
        const scale = 0.98 / maxAmp; // Target -0.2dB
        const newBuffer = new AudioContext().createBuffer(
          numberOfChannels,
          audioBuffer.length,
          audioBuffer.sampleRate
        );
        
        for (let c = 0; c < numberOfChannels; c++) {
          const oldData = audioBuffer.getChannelData(c);
          const newData = newBuffer.getChannelData(c);
          for (let i = 0; i < oldData.length; i++) {
            newData[i] = oldData[i] * scale;
          }
        }
        setAudioBuffer(newBuffer);
      }
      setIsNormalizing(false);
  };

  const applyAutoFades = () => {
    const fadeDuration = 0.05; // 50ms is better for standard de-clicking
    pushHistory(clips.map(clip => ({
      ...clip,
      fadeInDuration: clip.fadeInDuration || fadeDuration,
      fadeOutDuration: clip.fadeOutDuration || fadeDuration
    })));
  };

  const saveEdits = () => {
    if (currentTrack) {
      setCurrentTrack({
        ...currentTrack,
        clips: clips
      });
      onClose();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute inset-x-6 top-6 bottom-6 z-50 piano-black rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-white/[0.02]">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="h-6 w-px bg-white/10" />
          <div>
            <span className="engraved-label text-primary">Audio Editor</span>
            <h2 className="text-white font-mono text-sm uppercase tracking-widest">{currentTrack?.name}</h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
           <div className="flex bg-black/40 rounded-lg p-1 border border-white/5">
              <ToolButton 
                active={tool === 'select'} 
                onClick={() => setTool('select')} 
                icon={Move} 
                label="Select" 
              />
              <ToolButton 
                active={tool === 'hand'} 
                onClick={() => setTool('hand')} 
                icon={Hand} 
                label="Pan" 
              />
              <ToolButton 
                active={tool === 'split'} 
                onClick={() => setTool('split')} 
                icon={Scissors} 
                label="Split" 
              />
              <div className="h-6 w-px bg-white/10 mx-1" />
              <button 
                onClick={mergeClips}
                disabled={selectedClipIds.length < 2}
                className={`p-2 rounded-md flex items-center gap-2 transition-all ${selectedClipIds.length >= 2 ? 'bg-primary/20 text-primary border border-primary/30' : 'text-white/20 cursor-not-allowed opacity-50'}`}
                title="Merge Selected Clips"
              >
                <Combine className="w-4 h-4" />
                <span className="font-mono text-[9px] uppercase font-bold hidden md:block">Merge</span>
              </button>
           </div>

           <div className="h-6 w-px bg-white/10 mx-1" />

           <div className="flex bg-black/40 rounded-lg p-1 border border-white/5">
              <button 
                onClick={undo}
                disabled={history.length === 0}
                className="p-2 rounded-md text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-20 transition-all"
                title="Undo (Ctrl+Z)"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button 
                onClick={redo}
                disabled={redoStack.length === 0}
                className="p-2 rounded-md text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-20 transition-all"
                title="Redo (Ctrl+Y)"
              >
                <RotateCw className="w-4 h-4" />
              </button>
           </div>
           
           <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
              <button 
                onClick={normalizeAudio}
                disabled={isNormalizing || !audioBuffer}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 text-white/40 hover:text-white transition-all disabled:opacity-50"
                title="Normalize Audio"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isNormalizing ? 'animate-spin text-primary' : ''}`} />
                <span className="font-mono text-[8px] uppercase font-bold hidden lg:block">Normalize</span>
              </button>
              <div className="h-4 w-px bg-white/10 mx-1" />
              <button 
                onClick={applyAutoFades}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 text-white/40 hover:text-white transition-all"
                title="Auto Fade Clips"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="font-mono text-[8px] uppercase font-bold hidden lg:block">Auto Fade</span>
              </button>
           </div>

           <div className="h-6 w-px bg-white/10 mx-2" />
           
           <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
              <button 
                onClick={() => setZoom(prev => Math.max(1, prev - 0.5))}
                className="p-1 rounded hover:bg-white/5 text-white/40 hover:text-white transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              
              <input 
                type="range"
                min="1"
                max="20"
                step="0.5"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-24 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary"
              />

              <button 
                onClick={() => setZoom(prev => Math.min(20, prev + 0.5))}
                className="p-1 rounded hover:bg-white/5 text-white/40 hover:text-white transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              
              <div className="h-4 w-px bg-white/10 mx-1" />
              <span className="font-mono text-[9px] text-white/40 w-8 text-center">{Math.round(zoom * 100)}%</span>
           </div>

           <button 
            onClick={saveEdits}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg font-mono text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
           >
             <Save className="w-3.5 h-3.5" />
             Apply Edits
           </button>
        </div>
      </div>

      {/* Editor Main */}
      <div className="flex-1 bg-black/20 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden border-r border-white/5">
          {/* Ruler */}
          <div className="h-8 border-b border-white/5 bg-white/[0.01] overflow-hidden relative group/ruler">
           <div 
             className="absolute inset-y-0"
             style={{ 
               width: `${100 * zoom}%`,
               backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px)`,
               backgroundSize: `${(zoom / (audioBuffer?.duration || 1)) * 100}% 100%`
             }}
           >
              {audioBuffer && (zoom > 4) && Array.from({ length: Math.ceil(audioBuffer.duration * 10) }).map((_, i) => {
                if (i % 10 === 0) return null; // Skip main seconds (handled by span below)
                const shouldShow = (zoom > 8) || (i % 5 === 0 && zoom > 4);
                if (!shouldShow) return null;
                
                return (
                  <div 
                    key={i}
                    className="absolute h-2 bottom-0 border-l border-white/10"
                    style={{ left: `${(i / 10 / audioBuffer.duration) * 100}%` }}
                  />
                );
              })}
              
              {audioBuffer && Array.from({ length: Math.ceil(audioBuffer.duration) + 1 }).map((_, i) => (
                <div 
                  key={i}
                  className="absolute h-full border-l border-white/20 flex flex-col justify-end pb-1 pl-1.5"
                  style={{ left: `${(i / audioBuffer.duration) * 100}%` }}
                >
                  <span className="text-[7px] font-mono text-white/40 font-bold">{i}s</span>
                </div>
              ))}
           </div>
        </div>

          {/* Timeline Area */}
          <div 
            ref={containerRef}
            className={`flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar relative px-12 py-8 ${tool === 'hand' ? 'cursor-grab active:cursor-grabbing' : ''}`}
            onMouseDown={handleTimelineMouseDown}
            onMouseMove={handleMouseMoveTimeline}
            onMouseLeave={() => setHoveredTime(null)}
            onWheel={handleWheel}
          >
            <div 
              className="relative h-48 bg-white/[0.02] border-y border-white/5 flex items-center"
              style={{ width: `${100 * zoom}%`, minWidth: '100%' }}
            >
               {/* Waveform Visualization (Placeholder / Background) */}
               <div className="absolute inset-0 opacity-10 pointer-events-none">
                  <WaveformCanvas buffer={audioBuffer} zoom={zoom} />
               </div>

               {/* Split Indicator */}
               {tool === 'split' && hoveredTime !== null && (
                 <div 
                   className="absolute top-0 bottom-0 w-px bg-white/40 z-40 border-l border-dashed border-white/20"
                   style={{ left: `${(hoveredTime / (audioBuffer?.duration || 1)) * 100}%` }}
                 />
               )}

                {/* Clips */}
                {clips.map((clip) => (
                  <AudioClipElement 
                    key={clip.id}
                    clip={clip}
                    totalDuration={audioBuffer?.duration || 1}
                    zoom={zoom}
                    isSelected={selectedClipIds.includes(clip.id)}
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      if (e.shiftKey || e.metaKey || e.ctrlKey) {
                        setSelectedClipIds(prev => 
                          prev.includes(clip.id) 
                            ? prev.filter(id => id !== clip.id) 
                            : [...prev, clip.id]
                        );
                      } else {
                        setSelectedClipIds([clip.id]);
                      }
                    }}
                    onDelete={() => deleteClip(clip.id)}
                    onUpdate={(updated) => {
                      setClips(clips.map(c => c.id === clip.id ? { ...c, ...updated } : c));
                    }}
                    buffer={audioBuffer}
                  />
                ))}

             {/* Playhead */}
             <motion.div 
               animate={{ left: `${(currentTime / (audioBuffer?.duration || 1)) * 100}%` }}
               transition={{ type: 'linear', duration: 0.1 }}
               className="absolute top-0 bottom-0 w-[2px] bg-primary z-30 shadow-[0_0_10px_#1db954]"
             >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rotate-45" />
             </motion.div>
          </div>
        </div>

          {/* Toolbar Footer */}
          <div className="h-16 border-t border-white/5 bg-white/[0.01] flex items-center justify-between px-8">
             <div className="flex items-center gap-6">
                <button 
                  onClick={playPause}
                  className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(29,185,84,0.2)] hover:scale-110 active:scale-90 transition-all"
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
                </button>
                
                <div className="flex flex-col">
                   <span className="text-[7px] font-mono text-white/20 uppercase tracking-widest">Timecode</span>
                   <span className="text-sm font-mono text-white font-bold tabular-nums">
                      {formatTime(currentTime)} / {formatTime(audioBuffer?.duration || 0)}
                   </span>
                </div>
             </div>

             <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
                   <Clock className="w-3.5 h-3.5 text-white/40" />
                   <span className="font-mono text-[9px] text-white/60">Sample Rate: {audioBuffer?.sampleRate || 44100} Hz</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
                   <Activity className="w-3.5 h-3.5 text-white/40" />
                   <span className="font-mono text-[9px] text-white/60">Channels: {audioBuffer?.numberOfChannels || 0}</span>
                </div>
             </div>
          </div>
        </div>

        {/* Properties Panel */}
        <AnimatePresence>
          {selectedClipIds.length > 0 && (
            <motion.div 
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
              className="w-72 bg-black/40 backdrop-blur-xl border-l border-white/5 flex flex-col"
            >
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-primary" />
                    <span className="font-mono text-[10px] text-white uppercase tracking-widest font-bold">
                      {selectedClipIds.length > 1 ? `Multiple Clips (${selectedClipIds.length})` : 'Clip Properties'}
                    </span>
                 </div>
                 <button onClick={() => setSelectedClipIds([])} className="text-white/20 hover:text-white">
                    <X className="w-4 h-4" />
                 </button>
              </div>

              <div className="p-6 flex flex-col gap-6">
                 {(() => {
                   if (selectedClipIds.length > 1) {
                     return (
                       <div className="flex flex-col gap-4">
                         <p className="text-[10px] font-mono text-white/60">
                           Select adjacent clips to merge them into a single segment.
                         </p>
                         <button 
                           onClick={mergeClips}
                           className="flex items-center justify-center gap-2 p-3 rounded-lg bg-primary/20 hover:bg-primary text-primary transition-all border border-primary/30 group"
                         >
                            <Combine className="w-4 h-4 group-hover:scale-110 transition-transform" />
                            <span className="font-mono text-[9px] uppercase font-black tracking-widest">Merge Selected</span>
                         </button>
                       </div>
                     );
                   }
                   const clip = clips.find(c => c.id === selectedClipIds[0]);
                   if (!clip) return null;
                   return (
                     <>
                       <div className="flex flex-col gap-2">
                          <label className="text-[8px] font-mono text-white/40 uppercase tracking-widest">Clip Name</label>
                          <input 
                            type="text" 
                            value={clip.name}
                            onChange={(e) => setClips(clips.map(c => c.id === clip.id ? { ...c, name: e.target.value } : c))}
                            className="bg-white/5 border border-white/10 rounded px-3 py-2 text-xs font-mono text-white focus:border-primary outline-none"
                          />
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                          <div className="flex flex-col gap-2">
                             <label className="text-[8px] font-mono text-white/40 uppercase tracking-widest">Start Offset</label>
                             <input 
                               type="number" 
                               step="0.001"
                               value={clip.trackOffset.toFixed(3)}
                               onChange={(e) => setClips(clips.map(c => c.id === clip.id ? { ...c, trackOffset: parseFloat(e.target.value) || 0 } : c))}
                               className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[10px] font-mono text-white focus:border-primary outline-none"
                             />
                          </div>
                          <div className="flex flex-col gap-2">
                             <label className="text-[8px] font-mono text-white/40 uppercase tracking-widest">Duration</label>
                             <div className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[10px] font-mono text-white/40">
                                {(clip.endTime - clip.startTime).toFixed(3)}s
                             </div>
                          </div>
                       </div>

                       <div className="flex flex-col gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 shadow-inner">
                          <span className="text-[8px] font-mono text-primary uppercase tracking-widest font-black">Fade Automations</span>
                          
                          <div className="flex flex-col gap-2">
                             <div className="flex justify-between items-center">
                                <label className="text-[8px] font-mono text-white/40 uppercase tracking-widest">Fade In</label>
                                <span className="text-[8px] font-mono text-primary">{(clip.fadeInDuration || 0).toFixed(2)}s</span>
                             </div>
                             <input 
                               type="range"
                               min="0"
                               max="1"
                               step="0.01"
                               value={clip.fadeInDuration || 0}
                               onChange={(e) => setClips(clips.map(c => c.id === clip.id ? { ...c, fadeInDuration: parseFloat(e.target.value) } : c))}
                               className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary"
                             />
                          </div>

                          <div className="flex flex-col gap-2">
                             <div className="flex justify-between items-center">
                                <label className="text-[8px] font-mono text-white/40 uppercase tracking-widest">Fade Out</label>
                                <span className="text-[8px] font-mono text-primary">{(clip.fadeOutDuration || 0).toFixed(2)}s</span>
                             </div>
                             <input 
                               type="range"
                               min="0"
                               max="1"
                               step="0.01"
                               value={clip.fadeOutDuration || 0}
                               onChange={(e) => setClips(clips.map(c => c.id === clip.id ? { ...c, fadeOutDuration: parseFloat(e.target.value) } : c))}
                               className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary"
                             />
                          </div>
                       </div>

                       <button 
                         onClick={() => deleteClip(clip.id)}
                         className="mt-4 flex items-center justify-center gap-2 p-3 rounded-lg bg-scarlet/10 hover:bg-scarlet/20 text-scarlet border border-scarlet/20 transition-all group"
                       >
                          <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          <span className="font-mono text-[9px] uppercase font-black uppercase tracking-[0.2em]">Remove Segment</span>
                       </button>
                     </>
                   );
                 })()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {loading && (
        <div className="absolute inset-0 bg-obsidian/80 backdrop-blur-md z-50 flex flex-col items-center justify-center">
           <RefreshCw className="w-12 h-12 text-primary animate-spin mb-4" />
           <p className="text-white font-mono text-xs uppercase tracking-widest animate-pulse">Decoding Audio Buffer...</p>
        </div>
      )}
    </motion.div>
  );
}

function ToolButton({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`p-2 rounded-md flex items-center gap-2 transition-all ${active ? 'bg-primary text-on-primary shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
      title={label}
    >
      <Icon className="w-4 h-4" />
      <span className="font-mono text-[9px] uppercase font-bold hidden md:block">{label}</span>
    </button>
  );
}

interface AudioClipElementProps {
  key?: string | number;
  clip: AudioClip;
  totalDuration: number;
  zoom: number;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<AudioClip>) => void;
  buffer: AudioBuffer | null;
}

function AudioClipElement({ 
  clip, 
  totalDuration, 
  zoom, 
  isSelected, 
  onClick, 
  onDelete, 
  onUpdate,
  buffer
}: AudioClipElementProps) {
  const left = (clip.trackOffset / totalDuration) * 100;
  const width = ((clip.endTime - clip.startTime) / totalDuration) * 100;
  
  const [isResizing, setIsResizing] = useState<'left' | 'right' | 'move' | 'fadeIn' | 'fadeOut' | null>(null);
  const startPos = useRef({ x: 0, trackOffset: 0, startTime: 0, endTime: 0, fadeIn: 0, fadeOut: 0 });

  const handleMouseDown = (e: React.MouseEvent, type: 'left' | 'right' | 'move' | 'fadeIn' | 'fadeOut') => {
    e.stopPropagation();
    setIsResizing(type);
    startPos.current = { 
      x: e.clientX, 
      trackOffset: clip.trackOffset,
      startTime: clip.startTime,
      endTime: clip.endTime,
      fadeIn: clip.fadeInDuration || 0,
      fadeOut: clip.fadeOutDuration || 0
    };
    onClick(e);

    // Initial value for drag-scrolling if tool === hand
    // Hand tool is handled at top level, but let's keep consistency
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };


  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing || !buffer) return;
    
    const container = document.querySelector('.overflow-x-auto');
    if (!container) return;
    
    const scrollWidth = container.scrollWidth;
    const secondsPerPixel = totalDuration / scrollWidth;
    const dx = (e.clientX - startPos.current.x) * secondsPerPixel;
    const clipDuration = clip.endTime - clip.startTime;

    if (isResizing === 'move') {
      onUpdate({ trackOffset: Math.max(0, startPos.current.trackOffset + dx) });
    } else if (isResizing === 'left') {
      const newStart = Math.max(0, Math.min(startPos.current.endTime - 0.1, startPos.current.startTime + dx));
      const timeDiff = newStart - startPos.current.startTime;
      onUpdate({ 
        startTime: newStart,
        trackOffset: Math.max(0, startPos.current.trackOffset + timeDiff)
      });
    } else if (isResizing === 'right') {
      const newEnd = Math.min(buffer.duration, Math.max(startPos.current.startTime + 0.1, startPos.current.endTime + dx));
      onUpdate({ endTime: newEnd });
    } else if (isResizing === 'fadeIn') {
      const newFadeIn = Math.max(0, Math.min(clipDuration - (clip.fadeOutDuration || 0), startPos.current.fadeIn + dx));
      onUpdate({ fadeInDuration: newFadeIn });
    } else if (isResizing === 'fadeOut') {
      const newFadeOut = Math.max(0, Math.min(clipDuration - (clip.fadeInDuration || 0), startPos.current.fadeOut - dx));
      onUpdate({ fadeOutDuration: newFadeOut });
    }
  };

  const handleMouseUp = () => {
    setIsResizing(null);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  return (
    <div 
      className={`absolute h-32 rounded-lg border flex flex-col overflow-hidden cursor-pointer transition-shadow ${
        isSelected ? 'bg-primary/20 border-primary shadow-[0_0_20px_rgba(29,185,84,0.2)] z-20' : 'bg-white/5 border-white/10 z-10 hover:border-white/30'
      } ${isResizing === 'move' ? 'cursor-grabbing' : ''}`}
      style={{ left: `${left}%`, width: `${width}%` }}
      onMouseDown={(e) => handleMouseDown(e, 'move')}
    >
      {/* Waveform Detail */}
      <div className="flex-1 opacity-60 pointer-events-none relative">
         <WaveformCanvas buffer={buffer} clip={clip} zoom={zoom} />
         
         {/* Fade Overlays */}
         {clip.fadeInDuration && clip.fadeInDuration > 0 && (
           <div 
             className="absolute inset-y-0 left-0 bg-linear-to-r from-black/60 to-transparent pointer-events-none"
             style={{ width: `${(clip.fadeInDuration / (clip.endTime - clip.startTime)) * 100}%` }}
           />
         )}
         {clip.fadeOutDuration && clip.fadeOutDuration > 0 && (
           <div 
             className="absolute inset-y-0 right-0 bg-linear-to-l from-black/60 to-transparent pointer-events-none"
             style={{ width: `${(clip.fadeOutDuration / (clip.endTime - clip.startTime)) * 100}%` }}
           />
         )}
      </div>

      {/* Clip Info */}
      <div className={`h-8 flex items-center justify-between px-3 pointer-events-none ${isSelected ? 'bg-primary/20' : 'bg-black/40'}`}>
         <div className="flex items-center gap-2 truncate">
            <span className="text-[8px] font-mono font-black text-white/60 truncate uppercase">{clip.name}</span>
            <span className="text-[7px] font-mono text-white/20">{(clip.endTime - clip.startTime).toFixed(2)}s</span>
         </div>
         {isSelected && (
           <div className="flex items-center gap-1 pointer-events-auto">
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="p-1 rounded hover:bg-scarlet/20 text-white/40 hover:text-scarlet transition-colors"
                title="Delete Clip"
              >
                 <Trash2 className="w-3 h-3" />
              </button>
           </div>
         )}
      </div>

      {/* Resize Handles */}
      {isSelected && (
        <>
          <div 
            onMouseDown={(e) => handleMouseDown(e, 'left')}
            className="absolute left-0 top-0 bottom-0 w-1 bg-primary/40 cursor-ew-resize hover:bg-primary transition-colors z-30" 
            title="Resize Start"
          />
          <div 
            onMouseDown={(e) => handleMouseDown(e, 'right')}
            className="absolute right-0 top-0 bottom-0 w-1 bg-primary/40 cursor-ew-resize hover:bg-primary transition-colors z-30" 
            title="Resize End"
          />
          
          {/* Fade Handles */}
          <div 
            onMouseDown={(e) => handleMouseDown(e, 'fadeIn')}
            className="absolute top-1 w-3 h-3 rounded-full bg-white/80 border border-black shadow-lg cursor-ew-resize hover:scale-125 transition-transform z-40"
            style={{ left: `${((clip.fadeInDuration || 0) / (clip.endTime - clip.startTime)) * 100}%`, transform: 'translateX(-50%)' }}
            title="Adjust Fade In"
          />
          <div 
            onMouseDown={(e) => handleMouseDown(e, 'fadeOut')}
            className="absolute top-1 w-3 h-3 rounded-full bg-white/80 border border-black shadow-lg cursor-ew-resize hover:scale-125 transition-transform z-40"
            style={{ right: `${((clip.fadeOutDuration || 0) / (clip.endTime - clip.startTime)) * 100}%`, transform: 'translateX(50%)' }}
            title="Adjust Fade Out"
          />
        </>
      )}
    </div>
  );
}

interface WaveformCanvasProps {
  key?: string | number;
  buffer: AudioBuffer | null;
  clip?: AudioClip;
  zoom: number;
}

function WaveformCanvas({ buffer, clip, zoom }: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !buffer) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const width = canvas.clientWidth * window.devicePixelRatio;
      const height = canvas.clientHeight * window.devicePixelRatio;
      canvas.width = width;
      canvas.height = height;
      
      ctx.clearRect(0, 0, width, height);
      
      const numChannels = buffer.numberOfChannels;
      const channelHeight = height / numChannels;
      
      for (let c = 0; c < numChannels; c++) {
        const channelData = buffer.getChannelData(c);
        const yCenter = (c * channelHeight) + (channelHeight / 2);
        
        let startIdx = 0;
        let endIdx = channelData.length;
        
        if (clip) {
          startIdx = Math.floor(clip.startTime * buffer.sampleRate);
          endIdx = Math.max(startIdx + 1, Math.floor(clip.endTime * buffer.sampleRate));
        }

        const step = Math.ceil((endIdx - startIdx) / width);
        const amp = channelHeight / 2;

        ctx.beginPath();
        ctx.moveTo(0, yCenter);
        ctx.strokeStyle = c === 0 ? '#1db954' : '#1db954cc';
        ctx.lineWidth = 1;

        for (let i = 0; i < width; i++) {
          let min = 1.0;
          let max = -1.0;
          for (let j = 0; j < step; j++) {
            const dat = channelData[startIdx + (i * step) + j];
            if (dat < min) min = dat;
            if (dat > max) max = dat;
          }
          ctx.lineTo(i, yCenter + (min * amp));
          ctx.lineTo(i, yCenter + (max * amp));
        }
        ctx.stroke();

        // Draw center line
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.moveTo(0, yCenter);
        ctx.lineTo(width, yCenter);
        ctx.stroke();
      }
    };

    draw();
  }, [buffer, clip, zoom]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}
