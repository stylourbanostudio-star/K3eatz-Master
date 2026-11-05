import React, { useState, useEffect, useRef } from 'react';
import { 
  FileDown, 
  Settings2, 
  CheckCircle, 
  Music, 
  Save, 
  Share2, 
  ChevronRight,
  HardDrive,
  Cloud,
  FileAudio,
  Cpu,
  Loader2,
  CheckSquare,
  Square,
  Download,
  ListChecks,
  RefreshCw,
  Music2,
  Plus,
  Trash2,
  Volume2,
  Play,
  Pause,
  Sparkles,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useMastering, Track } from '../context/MasteringContext';
import { renderMasterOffline, RenderResult } from '../utils/wavRenderer';
import { backgroundMastering } from '../utils/backgroundMastering';
import { PersistedMasterRender } from '../utils/audioStorage';

const demoTracksPlaceholder: Track[] = [
  { id: 't1', name: 'Hyperlight (Radio Cut)', artist: 'Vapor Core', bpm: 124, key: 'A Minor', duration: 218, status: 'analyzed', metadata: {}, userId: 'demo' },
  { id: 't2', name: 'Midnight Synthesis', artist: 'Chronos', bpm: 118, key: 'F# Major', duration: 295, status: 'analyzed', metadata: {}, userId: 'demo' },
  { id: 't3', name: 'Echoplex Horizon', artist: 'Solaris', bpm: 128, key: 'C Minor', duration: 242, status: 'mastered', metadata: {}, userId: 'demo' },
  { id: 't4', name: 'Subterranean Bass', artist: 'Abyss', bpm: 140, key: 'E Minor', duration: 180, status: 'pending', metadata: {}, userId: 'demo' },
  { id: 't5', name: 'Resonance Waves', artist: 'Lumina', bpm: 95, key: 'D Major', duration: 310, status: 'analyzed', metadata: {}, userId: 'demo' }
];

const getEstimatedSize = (durationSec: number, formats: string[]) => {
  let size = 0;
  if (formats.includes('WAV')) size += (durationSec * 10.5 * 1024 * 1024) / 60; // 10.5MB/min
  if (formats.includes('AIFF')) size += (durationSec * 10.5 * 1024 * 1024) / 60; // 10.5MB/min
  if (formats.includes('FLAC')) size += (durationSec * 5.2 * 1024 * 1024) / 60; // 5.2MB/min
  if (formats.includes('MP3')) size += (durationSec * 1.2 * 1024 * 1024) / 60; // 1.2MB/min
  if (formats.includes('AAC')) size += (durationSec * 1.4 * 1024 * 1024) / 60; // 1.4MB/min
  if (formats.includes('OGG')) size += (durationSec * 1.0 * 1024 * 1024) / 60; // 1.0MB/min
  if (size === 0) return '0.0 MB';
  return (size / (1024 * 1024)).toFixed(1) + ' MB';
};

export default function ExportSection() {
  const { currentTrack, tracks, settings, updateSettings, exportPresets, addExportPreset, deleteExportPreset, getTrackAudioBuffer } = useMastering();
  
  // App export mode
  const [exportMode, setExportMode] = useState<'single' | 'batch'>('single');
  
  // Single Track Export State
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [complete, setComplete] = useState(false);
  const [renderedResult, setRenderedResult] = useState<RenderResult | null>(null);
  const [renderStage, setRenderStage] = useState<string>('Ready to render');
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // Available Tracks list
  const availableTracks = tracks && tracks.length > 0 ? tracks : demoTracksPlaceholder;
  
  // Batch Export State
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>(() => {
    return [availableTracks[0]?.id, availableTracks[1]?.id].filter(Boolean);
  });
  const [batchExporting, setBatchExporting] = useState(false);
  const [batchComplete, setBatchComplete] = useState(false);
  const [batchRenderedResults, setBatchRenderedResults] = useState<Record<string, RenderResult>>({});
  const [batchProgress, setBatchProgress] = useState<Record<string, { 
    progress: number; 
    status: 'queued' | 'rendering' | 'complete'; 
    stage: string; 
    size: string; 
  }>>({});
  
  // Settings & Presets state
  const [selectedFormats, setSelectedFormats] = useState(['WAV']);
  const [mp3Quality, setMp3Quality] = useState('320 kbps');
  const [ditherEnabled, setDitherEnabled] = useState(true);
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [presetName, setPresetName] = useState('');

  // Local helper for simulated active downloads
  const [downloadingTrackId, setDownloadingTrackId] = useState<string | null>(null);

  // Synchronize local dither state with global mastering settings
  useEffect(() => {
    if (settings && typeof settings.ditherEnabled === 'boolean' && settings.ditherEnabled !== ditherEnabled) {
      setDitherEnabled(settings.ditherEnabled);
    }
  }, [settings?.ditherEnabled]);

  const handleDitherToggle = (val: boolean) => {
    setDitherEnabled(val);
    updateSettings({ ditherEnabled: val });
  };

  // Initialize selectedTrackIds if availableTracks changes
  useEffect(() => {
    if (selectedTrackIds.length === 0 && availableTracks.length > 0) {
      setSelectedTrackIds([availableTracks[0].id]);
    }
  }, [availableTracks]);

  const toggleTrackSelection = (id: string) => {
    if (batchExporting) return;
    setSelectedTrackIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectAllTracks = () => {
    if (batchExporting) return;
    setSelectedTrackIds(availableTracks.map(t => t.id));
  };

  const clearTrackSelection = () => {
    if (batchExporting) return;
    setSelectedTrackIds([]);
  };

  const toggleFormat = (f: string) => {
    if (exporting || batchExporting) return;
    setSelectedFormats(prev => 
      prev.includes(f) ? prev.filter(item => item !== f) : [...prev, f]
    );
  };

  const handleSavePreset = async () => {
    if (!presetName.trim()) return;
    await addExportPreset(presetName, {
      formats: selectedFormats,
      mp3Quality,
      ditherEnabled
    });
    setPresetName('');
    setIsSavingPreset(false);
  };

  const loadPreset = (preset: any) => {
    if (exporting || batchExporting) return;
    setSelectedFormats(preset.settings.formats);
    setMp3Quality(preset.settings.mp3Quality);
    setDitherEnabled(preset.settings.ditherEnabled);
    updateSettings({ ditherEnabled: preset.settings.ditherEnabled });
  };

  // Clean up preview audio on unmount or new master
  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
      setIsPreviewPlaying(false);
    }
  }, [renderedResult]);

  const togglePreview = () => {
    if (!renderedResult) return;
    if (!previewAudioRef.current) {
      const audio = new Audio(renderedResult.blobUrl);
      audio.onended = () => setIsPreviewPlaying(false);
      previewAudioRef.current = audio;
    }
    if (isPreviewPlaying) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
    } else {
      previewAudioRef.current.play();
      setIsPreviewPlaying(true);
    }
  };

  const handleDownloadWav = (trackName: string, result?: RenderResult | null) => {
    const target = result || renderedResult;
    if (!target) return;
    const element = document.createElement("a");
    element.href = target.blobUrl;
    const bitLabel = target.bitDepth === 24 ? '24bit_96k' : '16bit_44k';
    element.download = `${trackName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_mastered_${bitLabel}.wav`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleDownloadBatchTrack = (trackId: string, trackName: string) => {
    const target = batchRenderedResults[trackId];
    if (target) {
      setDownloadingTrackId(trackId);
      handleDownloadWav(trackName, target);
      setTimeout(() => setDownloadingTrackId(null), 600);
    }
  };

  const handleDownloadAllBatch = () => {
    selectedTrackIds.forEach((id, index) => {
      const track = availableTracks.find(t => t.id === id);
      const target = batchRenderedResults[id];
      if (track && target) {
        setTimeout(() => {
          handleDownloadWav(track.name, target);
        }, index * 350);
      }
    });
  };

  const handleExport = async () => {
    if (!currentTrack) return;
    const taskId = 'render-' + Date.now();
    setExporting(true);
    setComplete(false);
    setProgress(5);
    setRenderStage('Initializing Offline Audio Engine...');

    try {
      await backgroundMastering.registerJob(taskId, currentTrack.id, currentTrack.name);

      const sourceBuffer = await getTrackAudioBuffer(currentTrack);
      if (!sourceBuffer) {
        throw new Error('No audio signal stream found for this session.');
      }

      const result = await renderMasterOffline({
        sourceBuffer,
        settings,
        bitDepth: settings.bitDepth ?? 16,
        dither: ditherEnabled,
        ditherType: settings.ditherType ?? 'POW-r Type 1',
        onProgress: (p, stage) => {
          setProgress(p);
          setRenderStage(stage);
          backgroundMastering.updateJobProgress(taskId, p, stage);
        }
      });

      const persistedRender: PersistedMasterRender = {
        id: taskId,
        trackId: currentTrack.id,
        trackName: currentTrack.name,
        wavBlob: result.wavBlob,
        sampleRate: result.sampleRate,
        bitDepth: result.bitDepth,
        truePeakDbfs: result.truePeakDbfs,
        integratedRmsDbfs: result.integratedRmsDbfs,
        duration: result.duration,
        timestamp: Date.now(),
        formattedSize: result.formattedSize
      };

      await backgroundMastering.completeJob(taskId, persistedRender);

      setRenderedResult(result);
      setComplete(true);
    } catch (err: any) {
      console.error('Offline mastering render error:', err);
      await backgroundMastering.failJob(taskId, err.message || 'Processing failed');
      alert('Master rendering error: ' + (err.message || 'Processing failed'));
    } finally {
      setExporting(false);
    }
  };

  const handleBatchExport = async () => {
    if (selectedTrackIds.length === 0) return;
    setBatchExporting(true);
    setBatchComplete(false);
    
    // Initialize batch progress values
    const initialProgress: typeof batchProgress = {};
    selectedTrackIds.forEach(id => {
      initialProgress[id] = {
        progress: 0,
        status: 'queued',
        stage: 'Queued in render queue',
        size: '0.0 MB'
      };
    });
    setBatchProgress(initialProgress);

    const activeResults: Record<string, RenderResult> = {};

    for (const trackId of selectedTrackIds) {
      const track = availableTracks.find(t => t.id === trackId);
      if (!track) continue;

      const batchTaskId = `batch-${trackId}-${Date.now()}`;
      await backgroundMastering.registerJob(batchTaskId, trackId, track.name);

      setBatchProgress(prev => ({
        ...prev,
        [trackId]: {
          progress: 5,
          status: 'rendering',
          stage: 'Loading audio stream...',
          size: '...'
        }
      }));

      try {
        const sourceBuffer = await getTrackAudioBuffer(track);
        const result = await renderMasterOffline({
          sourceBuffer,
          settings: track.settings || settings,
          bitDepth: settings.bitDepth ?? 16,
          dither: ditherEnabled,
          ditherType: settings.ditherType ?? 'POW-r Type 1',
          onProgress: (p, stage) => {
            backgroundMastering.updateJobProgress(batchTaskId, p, stage);
            setBatchProgress(prev => ({
              ...prev,
              [trackId]: {
                progress: p,
                status: p === 100 ? 'complete' : 'rendering',
                stage,
                size: p === 100 ? result?.formattedSize || 'Done' : 'Processing...'
              }
            }));
          }
        });

        activeResults[trackId] = result;
        setBatchRenderedResults(prev => ({ ...prev, [trackId]: result }));

        const persistedBatchRender: PersistedMasterRender = {
          id: batchTaskId,
          trackId,
          trackName: track.name,
          wavBlob: result.wavBlob,
          sampleRate: result.sampleRate,
          bitDepth: result.bitDepth,
          truePeakDbfs: result.truePeakDbfs,
          integratedRmsDbfs: result.integratedRmsDbfs,
          duration: result.duration,
          timestamp: Date.now(),
          formattedSize: result.formattedSize
        };

        await backgroundMastering.completeJob(batchTaskId, persistedBatchRender);

        setBatchProgress(prev => ({
          ...prev,
          [trackId]: {
            progress: 100,
            status: 'complete',
            stage: `Lossless PCM Master (${result.truePeakDbfs} dBTP)`,
            size: result.formattedSize
          }
        }));
      } catch (err: any) {
        console.error(`Batch render failed for track ${track.name}:`, err);
        await backgroundMastering.failJob(batchTaskId, err.message || 'Batch render failed');
        setBatchProgress(prev => ({
          ...prev,
          [trackId]: {
            progress: 100,
            status: 'complete',
            stage: 'Render failed',
            size: '0.0 MB'
          }
        }));
      }
    }

    setBatchExporting(false);
    setBatchComplete(true);
  };

  // Dynamic values of enqueued batch parameters
  const batchTotalTracks = selectedTrackIds.length;
  const batchCompletedCount = selectedTrackIds.filter(id => batchProgress[id]?.status === 'complete').length;
  const batchOverallProgress = batchTotalTracks === 0 
    ? 0 
    : Math.round(selectedTrackIds.reduce((sum, id) => sum + (batchProgress[id]?.progress || 0), 0) / batchTotalTracks);

  const batchTotalDuration = selectedTrackIds.reduce((sum, id) => {
    const track = availableTracks.find(t => t.id === id);
    return sum + (track?.duration || 180);
  }, 0);

  const totalBatchCalculatedSize = getEstimatedSize(batchTotalDuration, selectedFormats);

  return (
    <div className="h-full w-full flex flex-col p-8 bg-obsidian overflow-y-auto custom-scrollbar">
      <div className="max-w-4xl mx-auto w-full space-y-8">
        
        {/* Header Block */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-amber/10 border border-amber/20 w-fit">
              <HardDrive className="w-4 h-4 text-amber animate-pulse" />
              <span className="font-mono text-[10px] text-amber font-black uppercase tracking-[0.2em]">Final Rendering Phase</span>
            </div>
            <h1 className="text-4xl font-mono font-black italic text-white uppercase tracking-tighter">
              Terminal <span className="text-primary italic">Export</span>
            </h1>
            <p className="text-white/40 max-w-lg font-sans text-sm">
              Commit your master to high-res physical and cloud containers.
            </p>
          </div>

          {/* Mode Selector Option tabs */}
          <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5 shadow-inner">
            <button 
              onClick={() => {
                if (batchExporting || exporting) return;
                setExportMode('single');
              }}
              disabled={batchExporting || exporting}
              className={`px-4 py-2 rounded-xl text-[10px] font-mono font-black tracking-widest uppercase transition-all ${
                exportMode === 'single' 
                  ? 'bg-primary text-on-primary shadow-lg scale-100' 
                  : 'text-white/40 hover:text-white/80 disabled:opacity-50'
              }`}
            >
              Single Track
            </button>
            <button 
              onClick={() => {
                if (batchExporting || exporting) return;
                setExportMode('batch');
              }}
              disabled={batchExporting || exporting}
              className={`px-4 py-2 rounded-xl text-[10px] font-mono font-black tracking-widest uppercase transition-all flex items-center gap-2 ${
                exportMode === 'batch' 
                  ? 'bg-primary text-on-primary shadow-lg scale-100' 
                  : 'text-white/40 hover:text-white/80 disabled:opacity-50'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              Batch Export
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT: Configuration Pane */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Conditional Left Pane Elements Based on Export Mode */}
            {exportMode === 'batch' ? (
              /* BATCH QUEUE TRACK SELECTOR PANEL */
              <div className="hardware-panel p-6 rounded-3xl space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-3">
                    <ListChecks className="w-5 h-5 text-primary" />
                    <h3 className="engraved-label text-white/40">Select Tracks to Process</h3>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={selectAllTracks}
                      disabled={batchExporting}
                      className="px-2 py-1 rounded bg-white/5 text-[8px] font-mono text-white/60 hover:text-white border border-white/5 transition-all uppercase disabled:opacity-50"
                    >
                      Select All
                    </button>
                    <button 
                      onClick={clearTrackSelection}
                      disabled={batchExporting}
                      className="px-2 py-1 rounded bg-white/5 text-[8px] font-mono text-white/60 hover:text-white border border-white/10 transition-all uppercase disabled:opacity-50"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                  {availableTracks.map(track => {
                    const isSelected = selectedTrackIds.includes(track.id);
                    return (
                      <div 
                        key={track.id}
                        onClick={() => toggleTrackSelection(track.id)}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-primary/5 border-primary/30 shadow-[0_0_12px_rgba(29,185,84,0.05)]' 
                            : 'bg-obsidian border-white/5 hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`transition-colors ${isSelected ? 'text-primary' : 'text-white/20'}`}>
                            {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-mono text-[10px] font-bold text-white uppercase truncate tracking-wider">{track.name}</h4>
                            <p className="text-[8px] text-white/30 uppercase mt-0.5">{track.artist} • {(track.duration / 60).toFixed(1)} mins</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className="px-1.5 py-0.5 roundedbg-white/5 text-[7px] font-mono text-white/30 border border-white/5 uppercase">
                            {track.bpm} BPM
                          </span>
                          <span className="font-mono text-[9px] text-white/30">
                            {getEstimatedSize(track.duration, selectedFormats)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* STANDARD SINGLE PROJECT EXPORT PRESETS PANEL */
              <div className="hardware-panel p-6 rounded-3xl space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileDown className="w-5 h-5 text-primary" />
                    <h3 className="engraved-label text-white/40">Export Presets</h3>
                  </div>
                  <button 
                    onClick={() => setIsSavingPreset(true)}
                    disabled={exporting}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-mono text-white/60 hover:text-primary transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save New
                  </button>
                </div>

                <AnimatePresence>
                  {isSavingPreset && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-4"
                    >
                      <input 
                        type="text"
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                        placeholder="PRESET NAME..."
                        className="w-full bg-obsidian border border-white/10 rounded-lg px-4 py-2 font-mono text-[11px] text-white focus:outline-none focus:border-primary/50"
                        autoFocus
                      />
                      <div className="flex gap-3">
                        <button 
                          onClick={handleSavePreset}
                          className="flex-1 py-2 bg-primary text-on-primary rounded-lg font-mono text-[10px] font-black uppercase tracking-widest"
                        >
                          Confirm
                        </button>
                        <button 
                          onClick={() => {
                            setIsSavingPreset(false);
                            setPresetName('');
                          }}
                          className="flex-1 py-2 bg-white/5 text-white/40 rounded-lg font-mono text-[10px] font-black uppercase tracking-widest"
                        >
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {exportPresets.length === 0 ? (
                    <div className="col-span-full py-8 text-center border border-dashed border-white/5 rounded-2xl">
                      <span className="font-mono text-[9px] text-white/20 uppercase tracking-widest">No saved configurations</span>
                    </div>
                  ) : (
                    exportPresets.map(preset => (
                      <div key={preset.id} className="relative group">
                        <button 
                          onClick={() => loadPreset(preset)}
                          disabled={exporting}
                          className="w-full p-3 rounded-xl bg-obsidian border border-white/5 text-left transition-all hover:border-primary group-hover:bg-primary/5 disabled:opacity-50"
                        >
                          <div className="font-mono text-[10px] font-black text-white/50 truncate uppercase mb-1">{preset.name}</div>
                          <div className="flex gap-1">
                            {preset.settings.formats.slice(0, 2).map(f => (
                              <span key={f} className="text-[7px] font-mono text-white/25 uppercase">{f}</span>
                            ))}
                            {preset.settings.formats.length > 2 && <span className="text-[7px] font-mono text-white/25">...</span>}
                          </div>
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteExportPreset(preset.id);
                          }}
                          className="absolute top-1 right-1 p-1 rounded bg-scarlet/10 text-scarlet opacity-0 group-hover:opacity-100 transition-opacity hover:bg-scarlet hover:text-white"
                        >
                          <div className="w-2 h-2 rounded-full bg-current" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* SHARED EXPORT CONTAINERS SELECTOR */}
            <div className="hardware-panel p-6 rounded-3xl space-y-6">
              <div className="space-y-4">
                <h3 className="engraved-label text-white/40">Select Output Containers</h3>
                <div className="grid grid-cols-3 gap-3">
                  {['WAV', 'MP3', 'FLAC', 'AIFF', 'AAC', 'OGG'].map(format => (
                    <button 
                      key={format}
                      onClick={() => toggleFormat(format)}
                      disabled={exporting || batchExporting}
                      className={`p-3.5 rounded-xl border flex flex-col items-center gap-2.5 transition-all ${
                        selectedFormats.includes(format) 
                          ? 'bg-primary/10 border-primary text-primary shadow-[0_0_15px_rgba(29,185,84,0.1)]' 
                          : 'bg-obsidian border-white/5 text-white/20 hover:border-white/10'
                      } disabled:opacity-50`}
                    >
                      <FileAudio className="w-5 h-5" />
                      <span className="font-mono text-[9px] font-black tracking-widest uppercase">{format}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* SHARED PRECISION SETTINGS */}
              <div className="pt-6 border-t border-white/5 space-y-5">
                <h3 className="engraved-label text-white/40">Precision Settings</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <OptionControl label="Sample Rate" value="96.0 kHz" />
                  
                  <OptionControl 
                    label="Bit Depth" 
                    value={`${settings.bitDepth ?? 16}-Bit Output`} 
                    onClick={() => {
                      if (exporting || batchExporting) return;
                      const depths = [24, 16, 8];
                      const currentIdx = depths.indexOf(settings.bitDepth ?? 16);
                      const nextDepth = depths[(currentIdx + 1) % depths.length];
                      updateSettings({ bitDepth: nextDepth });
                    }}
                  />

                  <OptionControl 
                    label="WAV Dithering" 
                    value={settings.bitDepth === 24 ? "Bypassed (24-Bit)" : (ditherEnabled ? "Active" : "Bypassed")} 
                    onClick={() => {
                      if (exporting || batchExporting) return;
                      if (settings.bitDepth === 24) return;
                      handleDitherToggle(!ditherEnabled);
                    }}
                  />

                  {settings.bitDepth !== 24 && ditherEnabled && (
                    <OptionControl 
                      label="Dither Algorithm" 
                      value={settings.ditherType ?? 'POW-r Type 1'} 
                      onClick={() => {
                        if (exporting || batchExporting) return;
                        const algorithms = ['Flat TPDF', 'POW-r Type 1', 'POW-r Type 2', 'POW-r Type 3', 'Apogee UV22HR'];
                        const currentIdx = algorithms.indexOf(settings.ditherType ?? 'POW-r Type 1');
                        const nextAlgo = algorithms[(currentIdx + 1) % algorithms.length];
                        updateSettings({ ditherType: nextAlgo });
                      }}
                    />
                  )}

                  {selectedFormats.includes('MP3') && (
                    <OptionControl 
                      label="MP3 Bitrate" 
                      value={mp3Quality} 
                      onClick={() => {
                        if (exporting || batchExporting) return;
                        const qualities = ['128 kbps', '192 kbps', '320 kbps'];
                        const nextIdx = (qualities.indexOf(mp3Quality) + 1) % qualities.length;
                        setMp3Quality(qualities[nextIdx]);
                      }}
                    />
                  )}
                  <OptionControl label="Normalize" value="None" />
                </div>
              </div>
            </div>

            {/* CONNECT ARCHIVE */}
            <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between group cursor-pointer hover:border-white/20 transition-all">
              <div className="flex items-center gap-4">
                <Cloud className="w-7 h-7 text-white/20 group-hover:text-primary transition-colors animate-pulse" />
                <div>
                  <h4 className="font-mono text-[10px] font-black text-white uppercase tracking-widest">Connect Cloud Archive</h4>
                  <p className="text-[8px] text-white/30 uppercase mt-1">Sync to Dropbox / Drive / iCloud</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white transition-colors" />
            </div>
          </div>

          {/* RIGHT: Status Dashboard & Render Feed */}
          <div className="lg:col-span-5 space-y-6">
            
            {exportMode === 'batch' ? (
              /* BATCH EXPORT RENDER INTERACTIVE ACTIONS */
              <div className="piano-black p-6 rounded-3xl border border-white/10 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Cpu className="w-5 h-5 text-primary" />
                    <h3 className="font-mono text-xs font-black uppercase text-white tracking-widest italic">Batch Status</h3>
                  </div>
                  
                  <div className="space-y-2 border-y border-white/5 py-4">
                    <SummaryItem label="Enqueued Sessions" value={`${selectedTrackIds.length} Tracks`} color="white" />
                    <SummaryItem label="Global Settings" value={`${selectedFormats.join(', ')}`} />
                    <SummaryItem label="Combined Scope" value={`${(batchTotalDuration / 60).toFixed(1)} minutes`} />
                    <SummaryItem label="Estimated Total Size" value={totalBatchCalculatedSize} />
                  </div>
                </div>

                {!batchExporting && !batchComplete && (
                  <button 
                    onClick={handleBatchExport}
                    disabled={selectedTrackIds.length === 0}
                    className="w-full py-5 bg-primary text-on-primary rounded-xl font-mono text-[11px] font-black uppercase tracking-[0.2em] hover:brightness-110 shadow-[0_0_25px_rgba(29,185,84,0.25)] active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className="w-4 h-4 animate-spin-slow" />
                    Process Batch Queue
                  </button>
                )}

                {/* Batch Render Progress Indicator */}
                {batchExporting && (
                  <div className="space-y-4 py-2">
                    <div className="flex justify-between items-end">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-[8px] text-primary font-bold uppercase tracking-widest animate-pulse">RENDERING CONCURRENT DSP CORE...</span>
                        <span className="font-mono text-[9px] text-white/40">COMPILING {batchCompletedCount} OF {batchTotalTracks} MASTER FILES</span>
                      </div>
                      <span className="font-mono text-2xl text-primary font-black leading-none">{batchOverallProgress}%</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden relative">
                      <motion.div 
                        className="h-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${batchOverallProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Batch Mode Completion UI */}
                {batchComplete && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-5"
                  >
                    <div className="p-4 bg-primary/10 border border-primary/25 rounded-2xl flex flex-col items-center text-center space-y-3.5">
                      <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-[0_0_15px_#1db954]">
                        <CheckCircle className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-mono text-[11px] font-black text-white uppercase tracking-wider">Batch Operations Completed</h4>
                        <p className="text-[8px] text-white/50 uppercase mt-2 tracking-widest leading-relaxed px-2">
                          All {batchTotalTracks} multitracks successfully rendered. Select files to load or download.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={handleDownloadAllBatch}
                        className="py-3 bg-primary text-on-primary rounded-xl font-mono text-[9px] font-black uppercase tracking-wider hover:brightness-110 shadow-[0_0_15px_rgba(29,185,84,0.15)] active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download All WAVs
                      </button>
                      <button 
                        onClick={() => {
                          setBatchComplete(false);
                          setBatchProgress({});
                          setBatchRenderedResults({});
                        }}
                        className="py-3 bg-white/5 border border-white/5 hover:border-white/10 rounded-xl font-mono text-[9px] font-bold text-white/70 uppercase hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                      >
                        Reset Queue
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            ) : (
              /* STANDARD SINGLE PROJECT EXPORT CARD */
              <div className="piano-black p-8 rounded-3xl border border-white/10 space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Music className="w-5 h-5 text-primary" />
                    <h3 className="font-mono text-xs font-black uppercase text-white tracking-widest italic">Export Summary</h3>
                  </div>
                  <div className="space-y-3 pt-4 border-t border-white/5 text-[10px]">
                    <SummaryItem label="Master Target" value={currentTrack?.name || 'No Project Selected'} color="white" />
                    <SummaryItem label="Processing Mode" value="Optimized Master DSP" />
                    <SummaryItem label="Target Loudness" value={`${settings.lufsTarget} LUFS`} />
                    <SummaryItem label="Precision Formats" value={`${selectedFormats.join(', ')}`} />
                    <SummaryItem label="Estimated Size" value={currentTrack ? getEstimatedSize(currentTrack.duration, selectedFormats) : '0.0 MB'} />
                  </div>
                </div>

                {!exporting && !complete && (
                  <button 
                    onClick={handleExport}
                    disabled={!currentTrack}
                    className="w-full py-5 bg-primary text-on-primary rounded-2xl font-mono text-sm font-black uppercase tracking-[0.2em] hover:brightness-110 shadow-[0_0_30px_rgba(29,185,84,0.3)] active:scale-[0.98] transition-all flex items-center justify-center gap-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FileDown className="w-5 h-5" />
                    Commit Master
                  </button>
                )}

                {exporting && (
                  <div className="space-y-5 py-2">
                    <div className="flex justify-between items-end mb-2">
                      <div className="flex flex-col gap-1 max-w-[75%]">
                        <span className="font-mono text-[8px] text-primary font-bold uppercase tracking-[0.3em] animate-pulse">Rendering Core DSP...</span>
                        <span className="font-mono text-[9px] text-white/70 uppercase tracking-wider font-bold truncate">
                          {renderStage}
                        </span>
                      </div>
                      <span className="font-mono text-xl text-primary font-black leading-none">{progress}%</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {complete && renderedResult && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-6"
                  >
                    <div className="p-5 bg-primary/10 border border-primary/25 rounded-2xl flex flex-col items-center text-center space-y-4">
                      <div className="w-11 h-11 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-[0_0_20px_#1db954]">
                        <CheckCircle className="w-7 h-7" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-mono text-xs font-black text-white uppercase tracking-widest">Mastering Complete</h4>
                        <p className="text-[9px] text-white/50 uppercase tracking-widest leading-relaxed">
                          Lossless PCM Stream Compiled via OfflineAudioContext
                        </p>
                      </div>

                      {/* Real Master Acoustic Metrics Grid */}
                      <div className="w-full grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-left font-mono">
                        <div className="bg-obsidian/70 p-2.5 rounded-xl border border-white/5">
                          <span className="text-[7.5px] text-white/30 uppercase tracking-wider block">True Peak Max</span>
                          <span className="text-[11px] text-primary font-black">{renderedResult.truePeakDbfs} dBTP</span>
                        </div>
                        <div className="bg-obsidian/70 p-2.5 rounded-xl border border-white/5">
                          <span className="text-[7.5px] text-white/30 uppercase tracking-wider block">Integrated RMS</span>
                          <span className="text-[11px] text-white font-black">{renderedResult.integratedRmsDbfs} dBFS</span>
                        </div>
                        <div className="bg-obsidian/70 p-2.5 rounded-xl border border-white/5">
                          <span className="text-[7.5px] text-white/30 uppercase tracking-wider block">Format Stream</span>
                          <span className="text-[10px] text-white/80 font-bold">{renderedResult.bitDepth}-Bit / {(renderedResult.sampleRate / 1000).toFixed(1)}k</span>
                        </div>
                        <div className="bg-obsidian/70 p-2.5 rounded-xl border border-white/5">
                          <span className="text-[7.5px] text-white/30 uppercase tracking-wider block">File Output</span>
                          <span className="text-[10px] text-primary font-bold">{renderedResult.formattedSize}</span>
                        </div>
                      </div>

                      {/* In-browser Audition Player */}
                      <div className="w-full p-3 rounded-xl bg-obsidian border border-primary/20 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={togglePreview}
                            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                              isPreviewPlaying ? 'bg-primary text-on-primary shadow-[0_0_12px_#1db954]' : 'bg-white/10 text-white hover:bg-primary/20 hover:text-primary'
                            }`}
                          >
                            {isPreviewPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                          </button>
                          <div className="text-left">
                            <div className="font-mono text-[9px] font-black uppercase text-white tracking-wider">
                              {isPreviewPlaying ? 'Auditioning Master' : 'Audition Rendered Master'}
                            </div>
                            <div className="font-mono text-[7.5px] text-white/40 uppercase tracking-wider">
                              Real-Time Playback (.WAV)
                            </div>
                          </div>
                        </div>
                        <Activity className={`w-4 h-4 ${isPreviewPlaying ? 'text-primary animate-pulse' : 'text-white/20'}`} />
                      </div>

                      {/* Offline Persistence & Local Storage badge */}
                      <div className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between text-left">
                        <div className="flex items-center gap-2">
                          <HardDrive className="w-3.5 h-3.5 text-primary" />
                          <span className="font-mono text-[8px] text-white/70 uppercase tracking-widest">
                            Persisted in Local IndexedDB & SW Cache
                          </span>
                        </div>
                        <span className="font-mono text-[7px] text-primary/80 uppercase font-bold">Offline Ready</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => currentTrack && handleDownloadWav(currentTrack.name)}
                        className="py-3 bg-primary text-on-primary rounded-xl font-mono text-[10px] font-bold uppercase hover:brightness-110 shadow-[0_0_20px_rgba(29,185,84,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        Download .WAV
                      </button>
                      <button 
                        onClick={() => {
                          setComplete(false);
                          setProgress(0);
                        }}
                        className="py-3 bg-white/5 border border-white/5 rounded-xl font-mono text-[10px] font-bold text-white/70 uppercase hover:bg-white/10 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        Compile Again
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {/* LIVE CONSOLE & PIPELINE PROGRESS FEED PANEL (Extremely gorgeous in batch mode) */}
            {exportMode === 'batch' && selectedTrackIds.length > 0 && (
              <div className="hardware-panel p-5 rounded-2xl space-y-4">
                <div className="flex items-center gap-3 border-b border-white/5 pb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="font-mono text-[8px] uppercase tracking-widest text-white/40">Simultaneous Render Feed</span>
                </div>

                <div className="space-y-3.5 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                  {selectedTrackIds.map(id => {
                    const track = availableTracks.find(t => t.id === id);
                    if (!track) return null;
                    
                    const progressState = batchProgress[id] || { progress: 0, status: 'queued', stage: 'Ready in queue', size: '0.0 MB' };
                    const isRendering = progressState.status === 'rendering';
                    const isComplete = progressState.status === 'complete';

                    return (
                      <div 
                        key={id}
                        className={`p-3 rounded-lg bg-black/60 border transition-all ${
                          isRendering 
                            ? 'border-amber/30 bg-amber/5' 
                            : isComplete 
                              ? 'border-primary/20 bg-primary/2' 
                              : 'border-white/5'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="min-w-0 flex-1">
                            <h5 className="font-mono text-[9px] font-bold text-white truncate uppercase tracking-wide">{track.name}</h5>
                            <span className="text-[7px] font-mono text-white/30 uppercase mt-0.5 block truncate">
                              [{progressState.stage.toUpperCase()}]
                            </span>
                          </div>
                          <div className="text-right flex items-center gap-2">
                            <span className="font-mono text-[9px] text-white/50">{progressState.size}</span>
                            <span className={`font-mono text-[9px] font-black ${isComplete ? 'text-primary' : isRendering ? 'text-amber animate-pulse' : 'text-white/20'}`}>
                              {progressState.progress}%
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar inside Feed */}
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden relative mb-1.5">
                          <div 
                            className={`h-full transition-all duration-150 ${isComplete ? 'bg-primary' : isRendering ? 'bg-amber' : 'bg-white/10'}`} 
                            style={{ width: `${progressState.progress}%` }}
                          />
                        </div>

                        <div className="flex justify-between items-center">
                          <div className="flex gap-1.5">
                            {selectedFormats.map(fmt => (
                              <span key={fmt} className="bg-white/5 px-1 py-0.5 rounded-[3px] text-[6px] font-mono font-bold text-white/40 tracking-wider">
                                {fmt}
                              </span>
                            ))}
                          </div>

                          {isComplete && (
                            <button
                              onClick={() => handleDownloadBatchTrack(track.id, track.name)}
                              disabled={downloadingTrackId === track.id}
                              className="px-2 py-0.5 rounded bg-primary text-on-primary text-[7px] font-mono font-bold uppercase transition-all flex items-center gap-1 hover:brightness-110 active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                              {downloadingTrackId === track.id ? (
                                <>
                                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                  SAVING...
                                </>
                              ) : (
                                <>
                                  <Download className="w-2.5 h-2.5" />
                                  DOWNLOAD
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STORAGE & METADATA FOOTER */}
            <div className="p-5 rounded-2xl bg-obsidian-light/50 border border-white/5">
              <div className="flex items-center gap-3 mb-3">
                <Settings2 className="w-4 h-4 text-white/20" />
                <span className="engraved-label text-[8px]">Disk Space Warning</span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest">
                  <span className="text-white/20">Local Storage Space</span>
                  <span className="text-white/40">{exportMode === 'batch' && batchComplete ? '1.8 GB / 10 GB' : '1.2 GB / 10 GB'}</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white/40 transition-all duration-300" 
                    style={{ width: exportMode === 'batch' && batchComplete ? '18%' : '12%' }} 
                  />
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

function OptionControl({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  return (
    <div className="space-y-2">
      <span className="engraved-label text-[8px] opacity-40">{label}</span>
      <button 
        onClick={onClick}
        type="button"
        className="w-full h-10 px-4 bg-obsidian border border-white/5 rounded-xl flex items-center justify-between group hover:border-primary/40 transition-all cursor-pointer"
      >
        <span className="font-mono text-[10px] font-black text-white/60 group-hover:text-white transition-colors">{value}</span>
        <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-primary transition-colors" />
      </button>
    </div>
  );
}

function SummaryItem({ label, value, color = 'primary' }: { label: string; value: string; color?: string }) {
  const colorClass = color === 'white' ? 'text-white' : 'text-primary';
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0 text-[10px]">
      <span className="font-mono text-[8.5px] text-white/35 uppercase tracking-widest">{label}</span>
      <span className={`font-mono text-[9px] font-black uppercase ${colorClass}`}>{value}</span>
    </div>
  );
}
