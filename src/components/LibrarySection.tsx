import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  Play, 
  Calendar, 
  Music, 
  Clock, 
  Tag, 
  ChevronRight,
  HardDrive,
  CheckCircle2,
  ListMusic,
  Trash2,
  Copy,
  Plus,
  X,
  Save,
  Sparkles,
  Layers,
  Check,
  AlertTriangle,
  PlayCircle,
  Settings,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useMastering, Track, defaultSettings } from '../context/MasteringContext';

export default function LibrarySection() {
  const { 
    tracks, 
    setCurrentTrack, 
    setActiveSection, 
    currentTrack, 
    updateTrackTags, 
    language, 
    presets: masteringPresets,
    isPlaying,
    togglePlayback,
    isEngaged,
    setIsEngaged,
    updateSettings,
    currentTime,
    audioBuffer,
    handleSeek
  } = useMastering();
  const [search, setSearch] = useState('');

  // Metadata Dialog State
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editAlbum, setEditAlbum] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editTrackNumber, setEditTrackNumber] = useState('');
  const [editCoverUrl, setEditCoverUrl] = useState('');
  const [editGenre, setEditGenre] = useState('');

  // Presets State
  const [presets, setPresets] = useState<Array<{
    id: string;
    name: string;
    label?: string;
    album?: string;
    artist?: string;
    year?: string;
    trackNumber?: string;
    coverUrl?: string;
    genre?: string;
  }>>(() => {
    const saved = localStorage.getItem('mastercore_metadata_presets');
    return saved ? JSON.parse(saved) : [];
  });
  const [newPresetName, setNewPresetName] = useState('');

  // Built-in Premium System Mastering Presets for Batch Processing
  const systemPresets = [
    {
      id: 'sys-warm-tape',
      name: 'Warm Master (Analog Tape Saturation)',
      settings: {
        eq: { 
          hpf: 20,
          low: { freq: 100, gain: 1.8, q: 0.7 }, 
          lowMid: { freq: 250, gain: 0, q: 1.0 },
          mid: { freq: 1000, gain: -0.2, q: 1.0 }, 
          highMid: { freq: 2500, gain: 0.2, q: 1.0 },
          high: { freq: 10000, gain: 1.2, q: 0.7 },
          lpf: 20000
        },
        dynamics: {
          low: { threshold: -18, ratio: 1.5, attack: 30, release: 100, gain: 0.5 },
          mid: { threshold: -20, ratio: 1.2, attack: 15, release: 50, gain: 0.2 },
          high: { threshold: -24, ratio: 1.1, attack: 5, release: 30, gain: 0 },
        },
        compression: 15,
        limiter: -0.2,
        stereoWidthL: 110,
        stereoWidthR: 110,
        stereoLink: true,
        saturation: 30,
        reverb: 3,
        delay: 0,
        exciter: { amount: 15, color: 40 },
        gain: 1.0,
        masterVolume: 1,
        lufsTarget: -12,
        ditherEnabled: true,
        ditherType: 'POW-r Type 1',
        bitDepth: 16,
      }
    },
    {
      id: 'sys-club-maximizer',
      name: 'Club Master (Heavy Limit & Low End)',
      settings: {
        eq: { 
          hpf: 25,
          low: { freq: 100, gain: 3.0, q: 0.8 }, 
          lowMid: { freq: 250, gain: -0.5, q: 1.0 },
          mid: { freq: 1000, gain: 0, q: 1.0 }, 
          highMid: { freq: 2500, gain: 0.5, q: 1.0 },
          high: { freq: 10000, gain: 2.0, q: 0.6 },
          lpf: 19500
        },
        dynamics: {
          low: { threshold: -14, ratio: 2.5, attack: 40, release: 120, gain: 1.5 },
          mid: { threshold: -16, ratio: 2.0, attack: 20, release: 80, gain: 0.8 },
          high: { threshold: -18, ratio: 1.5, attack: 8, release: 40, gain: 0.3 },
        },
        compression: 25,
        limiter: -0.8,
        stereoWidthL: 120,
        stereoWidthR: 120,
        stereoLink: true,
        saturation: 15,
        reverb: 0,
        delay: 0,
        exciter: { amount: 25, color: 60 },
        gain: 2.5,
        masterVolume: 1,
        lufsTarget: -8,
        ditherEnabled: true,
        ditherType: 'POW-r Type 2',
        bitDepth: 16,
      }
    },
    {
      id: 'sys-clean-air',
      name: 'Pristine Master (High-Fidelity Air EQ)',
      settings: {
        eq: { 
          hpf: 15,
          low: { freq: 100, gain: 0.2, q: 0.7 }, 
          lowMid: { freq: 250, gain: -0.2, q: 1.0 },
          mid: { freq: 1000, gain: 0, q: 1.0 }, 
          highMid: { freq: 2500, gain: 1.0, q: 0.9 },
          high: { freq: 12000, gain: 3.5, q: 0.5 },
          lpf: 22000
        },
        dynamics: {
          low: { threshold: -22, ratio: 1.2, attack: 20, release: 80, gain: 0 },
          mid: { threshold: -24, ratio: 1.1, attack: 10, release: 40, gain: 0 },
          high: { threshold: -26, ratio: 1.1, attack: 3, release: 20, gain: 0 },
        },
        compression: 5,
        limiter: -0.1,
        stereoWidthL: 105,
        stereoWidthR: 105,
        stereoLink: true,
        saturation: 5,
        reverb: 1,
        delay: 0,
        exciter: { amount: 8, color: 80 },
        gain: 0.5,
        masterVolume: 1,
        lufsTarget: -14,
        ditherEnabled: true,
        ditherType: 'Apogee UV22HR',
        bitDepth: 24,
      }
    }
  ];

  // Batch Queue State
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [selectedBatchTrackIds, setSelectedBatchTrackIds] = useState<string[]>([]);
  const [batchProcessingState, setBatchProcessingState] = useState<'idle' | 'running' | 'completed'>('idle');
  const [currentQueueIndex, setCurrentQueueIndex] = useState<number>(0);
  const [mockTrackProgress, setMockTrackProgress] = useState<number>(0);
  const [batchLogs, setBatchLogs] = useState<string[]>([]);

  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  // Preview Audio Audition States
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewCountdown, setPreviewCountdown] = useState(15);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Web Audio 15-second Audition Preview Timer
  useEffect(() => {
    if (isPreviewMode && isPlaying && previewTrackId) {
      const interval = setInterval(() => {
        setPreviewCountdown(prev => {
          if (prev <= 1) {
            if (isPlaying) {
              togglePlayback();
            }
            setIsPreviewMode(false);
            setPreviewTrackId(null);
            clearInterval(interval);
            return 15;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    } else if (!isPlaying) {
      setIsPreviewMode(false);
      setPreviewTrackId(null);
    }
  }, [isPreviewMode, isPlaying, previewTrackId]);

  // Clean up preview audio audition when batch modal is closed
  useEffect(() => {
    if (!isBatchOpen) {
      if (isPlaying && isPreviewMode) {
        togglePlayback();
      }
      setIsPreviewMode(false);
      setPreviewTrackId(null);
    }
  }, [isBatchOpen, isPlaying, isPreviewMode]);

  const handleStartPreview = async (trackId: string) => {
    if (isPlaying && previewTrackId === trackId) {
      togglePlayback();
      setIsPreviewMode(false);
      setPreviewTrackId(null);
      return;
    }

    const track = tracks.find(t => t.id === trackId);
    if (!track) return;

    const activeMasteringPresets = masteringPresets || [];
    const preset = [...activeMasteringPresets, ...systemPresets].find(p => p.id === selectedPresetId);
    if (!preset) return;

    setLoadingPreview(true);
    setPreviewTrackId(trackId);

    // Set current track to build up Web Audio source
    setCurrentTrack(track);

    // Synchronously update context mastering values
    await updateSettings(preset.settings);
    
    // Engaged high-precision DSP chain
    setIsEngaged(true);

    setPreviewCountdown(15);
    setIsPreviewMode(true);

    // Standard buffering allocation timeout, then seek and play
    setTimeout(() => {
      setLoadingPreview(false);
      handleSeek(0);
      togglePlayback();
    }, 450);
  };

  // Auto scroll logs container to bottom
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [batchLogs]);

  // Sequential batch processing logic
  useEffect(() => {
    if (batchProcessingState !== 'running') return;
    if (selectedBatchTrackIds.length === 0 || !selectedPresetId) {
      setBatchProcessingState('idle');
      return;
    }

    const currentTrackId = selectedBatchTrackIds[currentQueueIndex];
    if (!currentTrackId) {
      setBatchProcessingState('completed');
      return;
    }

    const track = tracks.find(t => t.id === currentTrackId);
    const activeMasteringPresets = masteringPresets || [];
    const preset = [...activeMasteringPresets, ...systemPresets].find(p => p.id === selectedPresetId);
    const currentName = track ? track.name : 'Unknown Track';
    const presetName = preset ? preset.name : 'Mastering Preset';

    const interval = setInterval(() => {
      setMockTrackProgress(prev => {
        const step = Math.floor(Math.random() * 8) + 6; // progress by 6-13%
        const next = Math.min(100, prev + step);

        if (prev === 0) {
          setBatchLogs(logs => [
            ...logs,
            `[ENGINE] >>> INITIALIZING DSP PIPELINE FOR FILE: "${currentName.toUpperCase()}"`,
            `[ENGINE] Reading high-precision 96.0 kHz float-32 audio streams...`,
            `[PRESET] Applying master configuration: "${presetName.toUpperCase()}"`
          ]);
        } else if (prev < 30 && next >= 30) {
          const mockLUF = (Math.random() * 4 - 20).toFixed(1);
          setBatchLogs(logs => [
            ...logs,
            `[ANALYZER] Analyzed RMS profile: ${mockLUF} LUFS | Peak ceiling: -1.0 dBFS`,
            `[EQ] Deploying linear-phase filters with HPF active at ${preset?.settings?.eq?.hpf ?? 20} Hz...`
          ]);
        } else if (prev < 60 && next >= 60) {
          setBatchLogs(logs => [
            ...logs,
            `[DYNAMICS] Activating multi-band compressor thresholds...`,
            `[HARMONICS] Injecting analog tape saturation saturation: ${preset?.settings?.saturation ?? 0}%`
          ]);
        } else if (prev < 85 && next >= 85) {
          setBatchLogs(logs => [
            ...logs,
            `[LIMITER] Engaged IRC brickwall threshold: ${preset?.settings?.limiter ?? -0.3} dBFS (LUFS Target: ${preset?.settings?.lufsTarget ?? -14} LUFS)`,
            `[DITHER] Generating high-definition 24-bit/16-bit noise shape...`
          ]);
        }

        if (next >= 100) {
          clearInterval(interval);
          
          // Apply mastering preset settings to track
          if (preset) {
            updateTrackTags(currentTrackId, { settings: preset.settings as any });
          }

          setBatchLogs(logs => [
            ...logs,
            `[FLUSH] Compiling audio stream containers...`,
            `[SUCCESS] Render complete for "${currentName.toUpperCase()}"! Settings committed to Archive.`,
            `[ENGINE] Freeing DSP buffers. Done.\n`
          ]);

          setTimeout(() => {
            if (currentQueueIndex + 1 < selectedBatchTrackIds.length) {
              setCurrentQueueIndex(idx => idx + 1);
              setMockTrackProgress(0);
            } else {
              setBatchProcessingState('completed');
            }
          }, 600);
        }

        return next;
      });
    }, 150);

    return () => clearInterval(interval);
  }, [batchProcessingState, currentQueueIndex, selectedBatchTrackIds, selectedPresetId, tracks, masteringPresets]);

  const handleSelectAllTracks = () => {
    setSelectedBatchTrackIds(tracks.map(t => t.id));
  };

  const handleDeselectAllTracks = () => {
    setSelectedBatchTrackIds([]);
  };

  const handleToggleTrackSelection = (id: string) => {
    setSelectedBatchTrackIds(prev => 
      prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
    );
  };

  // Add Translation keys for Batch Engine
   const mBatch = {
    pt: {
      batchTitle: "Fila de Processamento em Lote",
      batchBtn: "Processar Lote",
      batchDesc: "Aplique presets de masterização a vários arquivos de áudio sequencialmente com feedback em tempo real e logs de DSP.",
      selectPreset: "1. Selecionar Preset de Masterização",
      selectTracks: "2. Selecionar Sessões para a Fila",
      runBatch: "Executar Processo em Lote",
      running: "Processando Fila...",
      completed: "Sucesso no Processamento",
      logConsole: "Console de logs do DSP de Hardware",
      queuedBadge: "Na Fila",
      processingBadge: "Processando",
      doneBadge: "Masterizado",
      selectAll: "Selecionar Todos",
      deselectAll: "Limpar Seleção",
      activeProcessing: "Processando faixa {current} de {total}...",
      successMsg: "Sucesso! {count} faixas foram estruturadas e masterizadas com o preset '{presetName}'.",
      noTracks: "Nenhuma faixa selecionada. Escolha as trilhas a processar.",
      noPresets: "Nenhum preset disponível. Crie um na tela de Masterização ou use um dos itens de fábrica.",
      systemPresetsLabel: "Presets de Masterização de Fábrica",
      customPresetsLabel: "Seus Presets de Masterização Salvos",
      cancelBatch: "Abortar Render",
      completedStatus: "Engine Masterizado",
      dspAudition: "Modo de Audição DSP",
      previewBtn: "Prévia de Áudio",
      previewDesc: "Ouça uma amostra de 15 segundos masterizada com o preset atual.",
    },
    en: {
      batchTitle: "Hardware Batch DSP Engine",
      batchBtn: "Batch Processing",
      batchDesc: "Apply mastering presets to multiple session files sequentially with real-time DSP progress feedback and terminal action logs.",
      selectPreset: "1. Select Mastering Preset",
      selectTracks: "2. Select Files for Queue",
      runBatch: "Run Batch Sequential Process",
      running: "Processing Queue...",
      completed: "Batch Run Successful",
      logConsole: "Hardware DSP Terminal logs",
      queuedBadge: "Queued",
      processingBadge: "Processing",
      doneBadge: "Mastered",
      selectAll: "Select All",
      deselectAll: "Clear Selection",
      activeProcessing: "Processing track {current} of {total}...",
      successMsg: "Success! {count} tracks successfully formatted and mastered with '{presetName}'.",
      noTracks: "No tracks selected. Select tracks from the database to queue.",
      noPresets: "No presets available. Select from standard System Presets or save custom ones.",
      systemPresetsLabel: "Factory Core DSP Presets",
      customPresetsLabel: "Custom Saved Mastering Presets",
      cancelBatch: "Abort Render",
      completedStatus: "Engine Mastered",
      dspAudition: "DSP Audition Mode",
      previewBtn: "Preview Audio",
      previewDesc: "Audition a 15-second mastered sample with the active preset.",
    }
  };

  const mb = mBatch[language as keyof typeof mBatch] || mBatch.en;

  const filteredTracks = tracks.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.artist.toLowerCase().includes(search.toLowerCase())
  );

  const openTagsEditor = (track: Track) => {
    setEditingTrack(track);
    setEditTitle(track.name || '');
    setEditArtist(track.artist || '');
    setEditLabel(track.metadata?.label || '');
    setEditAlbum(track.metadata?.album || '');
    setEditYear(track.metadata?.year || '');
    setEditTrackNumber(track.metadata?.trackNumber || '');
    setEditCoverUrl(track.metadata?.coverUrl || '');
    setEditGenre(track.metadata?.genre || '');
  };

  const handleSaveTags = () => {
    if (!editingTrack) return;
    updateTrackTags(editingTrack.id, {
      name: editTitle,
      artist: editArtist,
      metadata: {
        ...editingTrack.metadata,
        label: editLabel,
        album: editAlbum,
        year: editYear,
        trackNumber: editTrackNumber,
        coverUrl: editCoverUrl,
        genre: editGenre,
      }
    });
    setEditingTrack(null);
  };

  const handleSavePreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset = {
      id: 'preset-' + Date.now(),
      name: newPresetName.trim(),
      label: editLabel,
      album: editAlbum,
      artist: editArtist,
      year: editYear,
      trackNumber: editTrackNumber,
      coverUrl: editCoverUrl,
      genre: editGenre
    };
    const updated = [...presets, newPreset];
    setPresets(updated);
    localStorage.setItem('mastercore_metadata_presets', JSON.stringify(updated));
    setNewPresetName('');
  };

  const handleApplyPreset = (preset: any) => {
    if (preset.label !== undefined) setEditLabel(preset.label);
    if (preset.album !== undefined) setEditAlbum(preset.album);
    if (preset.artist !== undefined) setEditArtist(preset.artist);
    if (preset.year !== undefined) setEditYear(preset.year);
    if (preset.trackNumber !== undefined) setEditTrackNumber(preset.trackNumber);
    if (preset.coverUrl !== undefined) setEditCoverUrl(preset.coverUrl);
    if (preset.genre !== undefined) setEditGenre(preset.genre);
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    localStorage.setItem('mastercore_metadata_presets', JSON.stringify(updated));
  };

  const tLang = {
    pt: {
      title: "Arquivo de Sessões",
      desc: "Navegue e recupere suas sessões de masterização e arquivos renderizados.",
      searchPlaceholder: "Buscar na base de dados...",
      sessions: "Sessões",
      editTags: "Editar Tags",
      save: "Salvar Alterações",
      cancel: "Cancelar",
      tagEditor: "Editor de Tags de Metadados",
      presetSection: "Presets de Metadados",
      savePresetBtn: "Salvar Metalink",
      savePresetPlaceholder: "Nome do Preset (ex: Gravadora Techno)",
      usePreset: "Aplicar",
      previewCover: "Prévia da Capa",
      fieldTitle: "Título da Faixa",
      fieldArtist: "Artista",
      fieldLabel: "Gravadora / Label",
      fieldAlbum: "Álbum",
      fieldYear: "Ano",
      fieldGenre: "Gênero Trilha",
      fieldTrackNo: "Número da Faixa",
      fieldCover: "URL da Imagem da Capa",
      emptyPresets: "Nenhum preset salvo",
      generateArtworkAlert: "Dica: Você pode gerar uma arte incrível na aba de Artwork e usar o link aqui!"
    },
    en: {
      title: "Session Archive",
      desc: "Browse and recall your terminal mastering sessions and rendered assets.",
      searchPlaceholder: "Search DNA database...",
      sessions: "Sessions",
      editTags: "Edit Tags",
      save: "Save Changes",
      cancel: "Cancel",
      tagEditor: "Metadata Tag Editor",
      presetSection: "Metadata Presets",
      savePresetBtn: "Save Preset",
      savePresetPlaceholder: "Preset Name (e.g. Techno Label)",
      usePreset: "Apply",
      previewCover: "Cover Preview",
      fieldTitle: "Track Title",
      fieldArtist: "Artist",
      fieldLabel: "Record Label",
      fieldAlbum: "Album",
      fieldYear: "Year",
      fieldGenre: "Genre Track",
      fieldTrackNo: "Track Number",
      fieldCover: "Cover Image URL",
      emptyPresets: "No saved presets",
      generateArtworkAlert: "Pro-tip: Generate a custom artwork in the Artwork visualizer tab first!"
    }
  };

  const m = tLang[language as keyof typeof tLang] || tLang.en;

  return (
    <div className="h-full w-full flex flex-col p-8 bg-obsidian overflow-hidden">
      <div className="max-w-6xl mx-auto w-full flex flex-col h-full space-y-8">
        
        {/* Header with Search */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-white/5">
           <div className="space-y-4">
              <div className="flex items-center gap-3">
                 <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                    <ListMusic className="w-6 h-6 text-primary" />
                 </div>
                 <h1 className="text-4xl font-mono font-black italic text-white uppercase tracking-tighter">
                   Session <span className="text-primary italic">Archive</span>
                 </h1>
              </div>
              <p className="text-white/40 max-w-lg font-sans text-sm">
                 {m.desc}
              </p>
           </div>

           <div className="flex items-center gap-4">
              <button 
                onClick={() => {
                  setIsBatchOpen(true);
                  setBatchProcessingState('idle');
                  setBatchLogs([]);
                  setCurrentQueueIndex(0);
                  setMockTrackProgress(0);
                  if (tracks.length > 0 && selectedBatchTrackIds.length === 0) {
                    setSelectedBatchTrackIds([tracks[0].id]);
                  }
                  const availableMasteringPresets = masteringPresets || [];
                  const activePresets = [...availableMasteringPresets, ...systemPresets];
                  if (activePresets.length > 0 && !selectedPresetId) {
                    setSelectedPresetId(activePresets[0].id);
                  }
                }}
                className="h-12 px-5 bg-primary/10 border border-primary/20 hover:border-primary/40 hover:bg-primary/25 rounded-xl flex items-center justify-center text-primary text-[10.5px] uppercase font-black tracking-widest gap-2 shrink-0 active:scale-95 duration-100 ease-in-out font-mono font-semibold"
              >
                <Layers className="w-4 h-4 text-primary" />
                <span>{mb.batchBtn}</span>
              </button>

              <div className="relative group">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-primary transition-colors" />
                 <input 
                   type="text"
                   value={search}
                   onChange={(e) => setSearch(e.target.value)}
                   placeholder={m.searchPlaceholder}
                   className="w-64 h-12 bg-obsidian-light border border-white/5 rounded-xl pl-12 pr-4 font-mono text-[11px] text-white placeholder:text-white/20 focus:border-primary/40 focus:outline-hidden transition-all shadow-inner"
                 />
              </div>
              <button className="h-12 px-4 bg-obsidian-light border border-white/5 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:border-white/20 transition-all">
                 <Filter className="w-5 h-5" />
              </button>
           </div>
        </div>

        {/* Content Area - Track Rows */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2 pb-64">
          {filteredTracks.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
               <HardDrive className="w-20 h-20 mb-6" />
               <p className="font-mono text-xs uppercase tracking-[0.4em]">Archive Empty</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-1">
               {filteredTracks.map(track => (
                 <TrackRow 
                   key={track.id} 
                   track={track} 
                   active={currentTrack?.id === track.id}
                   onSelect={() => {
                     setCurrentTrack(track);
                     setActiveSection('MASTERING');
                   }}
                   onEditTags={() => openTagsEditor(track)}
                 />
               ))}
            </div>
          )}
        </div>

        {/* Quick Stats Footer */}
        <div className="pt-6 border-t border-white/5 flex items-center justify-between opacity-40">
           <div className="flex gap-8">
              <div className="flex items-center gap-2">
                 <Music className="w-4 h-4" />
                 <span className="font-mono text-[9px] font-bold uppercase tracking-widest">{tracks.length} {m.sessions}</span>
              </div>
              <div className="flex items-center gap-2">
                 <HardDrive className="w-4 h-4" />
                 <span className="font-mono text-[9px] font-bold uppercase tracking-widest">124.5 MB Total</span>
              </div>
           </div>
           <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span className="font-mono text-[9px] font-bold uppercase tracking-widest">Cloud Sync Active</span>
           </div>
        </div>
      </div>

      {/* FLOATING HARDWARE DIALOG MODAL: METADATA & TAG EDITOR */}
      <AnimatePresence>
        {editingTrack && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-4xl bg-obsidian-light border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] hardware-panel"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 bg-black/40 border-b border-white/5">
                <div className="flex items-center gap-2.5">
                  <Tag className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-mono font-black uppercase text-white tracking-tight">{m.tagEditor}</h2>
                </div>
                <button 
                  onClick={() => setEditingTrack(null)}
                  className="p-1 px-3 bg-white/5 border border-white/5 hover:border-white/20 transition-all rounded-lg scroll-none font-mono text-[10px] uppercase text-white/50 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Container */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Visualizer / Preview Panel on Left/Center */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                  <div className="bg-black/60 p-4 border border-white/5 rounded-2xl flex flex-col items-center">
                    <span className="engraved-label text-[8px] text-white/40 mb-3 block">{m.previewCover}</span>
                    <div className="w-48 h-48 rounded-xl overflow-hidden bg-graphite border border-white/15 flex items-center justify-center relative group shadow-lg">
                      {editCoverUrl ? (
                        <img 
                          src={editCoverUrl} 
                          alt="Cover Art Preview" 
                          className="w-full h-full object-cover transition-transform group-hover:scale-105" 
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = 'https://picsum.photos/seed/broken/500/500';
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-2 text-white/10">
                          <Music className="w-12 h-12" />
                          <span className="text-[8px] font-mono tracking-widest uppercase">No Artwork</span>
                        </div>
                      )}
                      
                      {/* Album Tags overlay visualizer */}
                      <div className="absolute inset-x-0 bottom-0 bg-black/70 backdrop-blur-xs p-3 text-left">
                        <p className="font-mono text-[9px] font-black text-primary uppercase truncate tracking-wide">{editTitle || 'Untitled Track'}</p>
                        <p className="font-sans text-[8px] text-white/60 truncate">{editArtist || 'Unknown Artist'}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 truncate">
                          {editAlbum && <span className="font-sans text-[7px] text-white/40 italic truncate">{editAlbum}</span>}
                          {editAlbum && editGenre && <span className="text-[7px] text-white/20">•</span>}
                          {editGenre && <span className="font-mono text-[7px] text-primary truncate uppercase tracking-widest">{editGenre}</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Artwork Tip & alert */}
                  <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl flex gap-3 text-left">
                    <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <p className="font-sans text-xs text-white/60 leading-relaxed">
                      {m.generateArtworkAlert}
                    </p>
                  </div>

                  {/* Preset Selector Panel */}
                  <div className="hardware-panel p-4 rounded-2xl flex-1 flex flex-col">
                    <span className="engraved-label text-[8px] text-white/40 mb-3 block uppercase">{m.presetSection}</span>
                    
                    {/* Add Current Configuration as a Preset */}
                    <div className="flex items-center gap-2 mb-4">
                      <input 
                        type="text"
                        value={newPresetName}
                        onChange={e => setNewPresetName(e.target.value)}
                        placeholder={m.savePresetPlaceholder}
                        className="flex-1 h-9 bg-black border border-white/5 rounded-lg px-3 font-mono text-[10px] text-white placeholder:text-white/20 focus:border-primary/40 focus:outline-hidden"
                      />
                      <button 
                        onClick={handleSavePreset}
                        className="h-9 px-3 bg-primary/20 border border-primary/30 rounded-lg text-primary text-[10px] font-mono uppercase font-black tracking-widest hover:bg-primary hover:text-on-primary transition-all flex items-center gap-1 shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{m.savePresetBtn}</span>
                      </button>
                    </div>

                    {/* Presets List */}
                    <div className="flex-1 min-h-[120px] max-h-[180px] overflow-y-auto custom-scrollbar border border-white/5 rounded-lg bg-black/20 p-2 flex flex-col gap-1.5 text-left">
                      {presets.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-white/20 font-mono text-[9px] uppercase tracking-widest py-8">
                          {m.emptyPresets}
                        </div>
                      ) : (
                        presets.map(p => (
                          <div 
                            key={p.id}
                            onClick={() => handleApplyPreset(p)}
                            className="p-2 bg-white/5 hover:bg-primary/5 border border-transparent hover:border-primary/20 rounded-lg cursor-pointer transition-all flex items-center justify-between group"
                          >
                            <div className="min-w-0">
                              <p className="font-mono text-[10px] font-black text-white/80 group-hover:text-primary transition-colors truncate">{p.name}</p>
                              <p className="font-mono text-[8px] text-white/30 truncate uppercase mt-0.5">
                                {p.artist || 'VAR'} | {p.album || 'N/A'} | {p.label || 'N/A'}{p.genre ? ` | ${p.genre}` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-[8px] font-mono text-primary font-bold uppercase">{m.usePreset}</span>
                              <button 
                                onClick={(e) => handleDeletePreset(p.id, e)}
                                className="p-1 hover:bg-rose-500/20 text-rose-500/50 hover:text-rose-400 transition-all rounded-sm"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Edit Inputs Column */}
                <div className="lg:col-span-7 flex flex-col gap-5 text-left">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Track Title */}
                    <div className="space-y-1.5">
                      <label className="engraved-label text-white/40 uppercase">{m.fieldTitle}</label>
                      <input 
                        type="text"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        className="w-full h-11 bg-black border border-white/5 rounded-xl px-4 font-mono text-xs text-white focus:border-primary/40 focus:outline-hidden"
                      />
                    </div>

                    {/* Artist */}
                    <div className="space-y-1.5">
                      <label className="engraved-label text-white/40 uppercase">{m.fieldArtist}</label>
                      <input 
                        type="text"
                        value={editArtist}
                        onChange={e => setEditArtist(e.target.value)}
                        className="w-full h-11 bg-black border border-white/5 rounded-xl px-4 font-mono text-xs text-white focus:border-primary/40 focus:outline-hidden"
                      />
                    </div>

                    {/* Record Label */}
                    <div className="space-y-1.5">
                      <label className="engraved-label text-white/40 uppercase">{m.fieldLabel}</label>
                      <input 
                        type="text"
                        value={editLabel}
                        onChange={e => setEditLabel(e.target.value)}
                        placeholder="e.g., Spine Records, independent"
                        className="w-full h-11 bg-black border border-white/5 rounded-xl px-4 font-mono text-xs text-white focus:border-primary/40 focus:outline-hidden"
                      />
                    </div>

                    {/* Album */}
                    <div className="space-y-1.5">
                      <label className="engraved-label text-white/40 uppercase">{m.fieldAlbum}</label>
                      <input 
                        type="text"
                        value={editAlbum}
                        onChange={e => setEditAlbum(e.target.value)}
                        placeholder="Album Name"
                        className="w-full h-11 bg-black border border-white/5 rounded-xl px-4 font-mono text-xs text-white focus:border-primary/40 focus:outline-hidden"
                      />
                    </div>

                    {/* Year / Ano */}
                    <div className="space-y-1.5">
                      <label className="engraved-label text-white/40 uppercase">{m.fieldYear}</label>
                      <input 
                        type="text"
                        value={editYear}
                        onChange={e => setEditYear(e.target.value)}
                        placeholder="e.g., 2026"
                        className="w-full h-11 bg-black border border-white/5 rounded-xl px-4 font-mono text-xs text-white focus:border-primary/40 focus:outline-hidden"
                      />
                    </div>

                    {/* Track Number */}
                    <div className="space-y-1.5">
                      <label className="engraved-label text-white/40 uppercase">{m.fieldTrackNo}</label>
                      <input 
                        type="text"
                        value={editTrackNumber}
                        onChange={e => setEditTrackNumber(e.target.value)}
                        placeholder="e.g., 01, A1"
                        className="w-full h-11 bg-black border border-white/5 rounded-xl px-4 font-mono text-xs text-white focus:border-primary/40 focus:outline-hidden"
                      />
                    </div>

                    {/* Genre */}
                    <div className="space-y-1.5">
                      <label className="engraved-label text-white/40 uppercase">{m.fieldGenre}</label>
                      <input 
                        type="text"
                        value={editGenre}
                        onChange={e => setEditGenre(e.target.value)}
                        placeholder="e.g., Techno, Electronic, Hip Hop"
                        className="w-full h-11 bg-black border border-white/5 rounded-xl px-4 font-mono text-xs text-white focus:border-primary/40 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Cover Artwork Image URL */}
                  <div className="space-y-1.5">
                    <label className="engraved-label text-white/40 uppercase">{m.fieldCover}</label>
                    <input 
                      type="text"
                      value={editCoverUrl}
                      onChange={e => setEditCoverUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/... or base64 data"
                      className="w-full h-11 bg-black border border-white/5 rounded-xl px-4 font-mono text-xs text-white focus:border-primary/40 focus:outline-hidden"
                    />
                  </div>
                </div>

              </div>

              {/* Footer Panel */}
              <div className="p-6 bg-black/40 border-t border-white/5 flex items-center justify-end gap-3">
                <button 
                  onClick={() => setEditingTrack(null)}
                  className="px-6 py-3.5 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 text-white/80 transition-all font-mono text-xs uppercase tracking-widest"
                >
                  {m.cancel}
                </button>
                <button 
                  onClick={handleSaveTags}
                  className="px-6 py-3.5 bg-primary text-on-primary hover:brightness-110 shadow-[0_0_20px_rgba(29,185,84,0.2)] rounded-xl transition-all font-mono text-xs font-black uppercase tracking-widest flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>{m.save}</span>
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FLOATING DIALOG MODAL: SEQUENTIAL BATCH DSP ENGINE */}
      <AnimatePresence>
        {isBatchOpen && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-5xl bg-obsidian-light border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] hardware-panel"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 bg-black/40 border-b border-white/5">
                <div className="flex items-center gap-2.5">
                  <Layers className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-mono font-black uppercase text-white tracking-tight">{mb.batchTitle}</h2>
                </div>
                <button 
                  onClick={() => {
                    if (batchProcessingState === 'running') {
                      if (!confirm(mb.cancelBatch + "?")) return;
                    }
                    setIsBatchOpen(false);
                    setBatchProcessingState('idle');
                  }}
                  className="p-1 px-3 bg-white/5 border border-white/5 hover:border-white/20 transition-all rounded-lg font-mono text-[10px] uppercase text-white/50 hover:text-white flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Sub-header description */}
              <div className="p-6 bg-white/5 border-b border-white/5 flex flex-col gap-1 text-left">
                <p className="text-white/70 font-sans text-xs leading-relaxed max-w-3xl">
                  {mb.batchDesc}
                </p>
              </div>

              {/* Content Panels Grid */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
                
                {/* Left Column (6/12): CONFIGURATION (Presets and Track Checklist) */}
                <div className="lg:col-span-6 flex flex-col gap-6 min-h-0">
                  
                  {/* PRESET SELECTOR */}
                  <div className="flex flex-col gap-2">
                    <span className="font-mono text-[10px] font-black uppercase text-primary tracking-widest block">
                      {mb.selectPreset}
                    </span>
                    
                    <div className="border border-white/5 bg-black/20 rounded-xl p-3 flex flex-col gap-4 max-h-[220px] overflow-y-auto custom-scrollbar">
                      
                      {/* USER PRESETS */}
                      <div>
                        <span className="font-sans text-[9px] font-black tracking-wider uppercase text-white/30 block mb-2">
                          {mb.customPresetsLabel}
                        </span>
                        
                        {(masteringPresets || []).length === 0 ? (
                          <span className="font-mono text-[9px] inline-block uppercase text-white/10 px-2 py-1 mb-4">
                            - Clean (No saved mastering presets) -
                          </span>
                        ) : (
                          <div className="flex flex-col gap-1 mb-4">
                            {(masteringPresets || []).map(p => {
                              const isSelected = selectedPresetId === p.id;
                              return (
                                <button
                                  key={p.id}
                                  disabled={batchProcessingState === 'running'}
                                  onClick={() => setSelectedPresetId(p.id)}
                                  className={`w-full p-2.5 rounded-lg border text-left flex items-center justify-between transition-all ${
                                    isSelected 
                                      ? 'bg-primary/20 border-primary/40 text-white' 
                                      : 'bg-white/5 border-transparent text-white/60 hover:bg-white/10'
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="font-mono text-[10px] font-black uppercase truncate">{p.name}</div>
                                    <div className="font-mono text-[8px] text-white/30 truncate mt-0.5">
                                      Target Level: {p.settings?.lufsTarget ?? -14} LUFS | Compression: {p.settings?.compression ?? 0}%
                                    </div>
                                  </div>
                                  <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ml-3 ${isSelected ? 'border-primary bg-primary' : 'border-white/20'}`}>
                                    {isSelected && <Check className="w-2.5 h-2.5 text-black stroke-[3px]" />}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* SYSTEM PRESETS */}
                      <div>
                        <span className="font-sans text-[9px] font-black tracking-wider uppercase text-white/30 block mb-2">
                          {mb.systemPresetsLabel}
                        </span>
                        
                        <div className="flex flex-col gap-1">
                          {systemPresets.map(p => {
                            const isSelected = selectedPresetId === p.id;
                            return (
                              <button
                                key={p.id}
                                disabled={batchProcessingState === 'running'}
                                onClick={() => setSelectedPresetId(p.id)}
                                className={`w-full p-2.5 rounded-lg border text-left flex items-center justify-between transition-all ${
                                  isSelected 
                                    ? 'bg-primary/20 border-primary/40 text-white' 
                                    : 'bg-white/5 border-transparent text-white/60 hover:bg-white/10'
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="font-mono text-[10px] font-black uppercase truncate flex items-center gap-1.5">
                                    <Sparkles className="w-3 h-3 text-primary" />
                                    <span>{p.name}</span>
                                  </div>
                                  <div className="font-mono text-[8px] text-white/30 truncate mt-0.5">
                                    Tape Saturation: {p.settings?.saturation ?? 0}% | Dither: {p.settings?.ditherType ?? 'Flat'} | Depth: {p.settings?.bitDepth ?? 16}-Bit
                                  </div>
                                </div>
                                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ml-3 ${isSelected ? 'border-primary bg-primary' : 'border-white/20'}`}>
                                  {isSelected && <Check className="w-2.5 h-2.5 text-black stroke-[3px]" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* SESSION SELECTOR */}
                  <div className="flex flex-col gap-2 flex-1 min-h-[200px]">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-black uppercase text-primary tracking-widest block">
                        {mb.selectTracks}
                      </span>
                      <div className="flex gap-2">
                        <button
                          disabled={batchProcessingState === 'running'}
                          onClick={handleSelectAllTracks}
                          className="font-mono text-[8px] uppercase font-bold text-primary/80 hover:text-primary hover:underline transition-all"
                        >
                          {mb.selectAll}
                        </button>
                        <span className="text-white/10 text-[8px] font-mono">•</span>
                        <button
                          disabled={batchProcessingState === 'running'}
                          onClick={handleDeselectAllTracks}
                          className="font-mono text-[8px] uppercase font-bold text-white/40 hover:text-white hover:underline transition-all"
                        >
                          {mb.deselectAll}
                        </button>
                      </div>
                    </div>

                    <div className="border border-white/5 bg-black/20 rounded-xl p-2 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1 max-h-[220px]">
                      {tracks.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-white/20 font-mono text-[9px] uppercase tracking-widest">
                          No tracks imported
                        </div>
                      ) : (
                        tracks.map(t => {
                          const isSelected = selectedBatchTrackIds.includes(t.id);
                          const isCurrentlyProcessing = batchProcessingState === 'running' && selectedBatchTrackIds[currentQueueIndex] === t.id;
                          const isAlreadyProcessed = batchProcessingState === 'running' && selectedBatchTrackIds.indexOf(t.id) !== -1 && selectedBatchTrackIds.indexOf(t.id) < currentQueueIndex;
                          
                          return (
                            <button
                              key={t.id}
                              disabled={batchProcessingState === 'running'}
                              onClick={() => handleToggleTrackSelection(t.id)}
                              className={`w-full p-2.5 rounded-lg border text-left flex items-center justify-between transition-all ${
                                isCurrentlyProcessing
                                  ? 'bg-amber-500/15 border-amber-500/40 text-white'
                                  : isAlreadyProcessed
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-white/50'
                                    : isSelected 
                                      ? 'bg-white/5 border-white/10 text-white' 
                                      : 'bg-transparent border-transparent text-white/40 hover:bg-white/5'
                              }`}
                            >
                              <div className="min-w-0 flex-1 flex items-center gap-3">
                                <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${isSelected ? 'border-primary bg-primary text-black' : 'border-white/10'}`}>
                                  {isSelected && <Check className="w-3 h-3 stroke-[3px]" />}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-mono text-[10px] font-black uppercase truncate">{t.name}</div>
                                  <div className="font-mono text-[8px] text-white/30 truncate mt-0.5">
                                    {Math.floor(t.duration / 60)}:{(t.duration % 60).toString().padStart(2, '0')} | {t.bpm} BPM{t.artist ? ` | ${t.artist}` : ''}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                {/* Dedicated inline Audition Preview Button */}
                                {selectedPresetId && (
                                  <button
                                    disabled={batchProcessingState === 'running' || loadingPreview}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStartPreview(t.id);
                                    }}
                                    className={`p-1 px-1.5 rounded bg-black/40 border text-[9px] font-mono uppercase tracking-wider flex items-center justify-center gap-1 transition-all outline-none cursor-pointer ${
                                      previewTrackId === t.id && isPlaying
                                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                        : 'bg-white/5 text-white/60 border-white/10 hover:text-white hover:border-white/25'
                                    }`}
                                    title="Audition Preview"
                                  >
                                    {previewTrackId === t.id && isPlaying ? (
                                      <>
                                        <Activity className="w-3 h-3 text-amber-400 animate-pulse shrink-0" />
                                        <span>{previewCountdown}s</span>
                                      </>
                                    ) : (
                                      <>
                                        <Play className="w-2.5 h-2.5 shrink-0" />
                                        <span>Audition</span>
                                      </>
                                    )}
                                  </button>
                                )}

                                {isCurrentlyProcessing && (
                                  <span className="px-1.5 py-0.5 rounded-sm bg-amber-500/20 border border-amber-500/30 text-[7px] font-mono font-bold text-amber-500 tracking-wider uppercase animate-pulse">
                                    {mb.processingBadge}
                                  </span>
                                )}
                                {isAlreadyProcessed && (
                                  <span className="px-1.5 py-0.5 rounded-sm bg-emerald-500/20 border border-emerald-500/30 text-[7px] font-mono font-bold text-emerald-500 tracking-wider uppercase">
                                    {mb.doneBadge}
                                  </span>
                                )}
                                {!isCurrentlyProcessing && !isAlreadyProcessed && isSelected && (
                                  <span className="px-1.5 py-0.5 rounded-sm bg-white/5 border border-white/5 text-[7px] font-mono font-bold text-white/40 tracking-wider uppercase">
                                    {mb.queuedBadge}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                </div>

                {/* Right Column (6/12): LIVE DSP SIMULATION AND LOG CONSOLE */}
                <div className="lg:col-span-6 flex flex-col gap-6 min-h-0 justify-between">
                  
                  {batchProcessingState === 'idle' ? (
                    /* IDLE STATE WRAPPER */
                    <div className="flex-1 flex flex-col items-center justify-center border border-white/5 rounded-2xl bg-black/10 p-8 text-center min-h-[300px]">
                      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/15 flex items-center justify-center mb-6 text-white/20 animate-pulse">
                        <Activity className="w-8 h-8" />
                      </div>
                      <h4 className="font-mono text-xs font-black uppercase tracking-widest text-white/80 mb-2">Engine Armed & Idle</h4>
                      <p className="font-sans text-xs text-white/40 max-w-sm mb-8 leading-relaxed">
                        Configure target mastering parameters and sessions, then press execute to trigger sequential background processing.
                      </p>

                      {/* Interactive Audition Preview Dashboard */}
                      {selectedBatchTrackIds.length > 0 && selectedPresetId ? (
                        <div className="w-full border border-white/5 bg-white/5 rounded-xl p-4 text-left space-y-3 mb-6">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[9px] uppercase tracking-widest text-primary font-bold flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-primary animate-pulse" />
                              <span>{mb.dspAudition}</span>
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-[8px] uppercase font-bold tracking-wider">
                              15s Audition Limit
                            </span>
                          </div>
                          
                          <p className="font-sans text-[11px] text-white/50 leading-relaxed">
                            {mb.previewDesc}
                          </p>

                          <div className="p-3 rounded-lg bg-black/45 border border-white/5 flex items-center justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <span className="text-[7.5px] font-mono text-white/30 uppercase block font-semibold tracking-wider">Session File to Audition</span>
                              <span className="font-mono text-[11px] font-black uppercase text-white truncate block">
                                {tracks.find(t => t.id === selectedBatchTrackIds[0])?.name || 'Selected Track'}
                              </span>
                              <span className="font-mono text-[8px] text-white/40 block mt-0.5">
                                Preset: {
                                  ([...(masteringPresets || []), ...systemPresets].find(p => p.id === selectedPresetId))?.name || 'Target Preset'
                                }
                              </span>
                            </div>

                            <button
                              onClick={() => handleStartPreview(selectedBatchTrackIds[0])}
                              disabled={loadingPreview}
                              className={`h-11 px-4 rounded-lg font-mono text-[10px] uppercase font-black tracking-wider flex items-center justify-center gap-2 transition-all outline-none cursor-pointer ${
                                isPreviewMode && previewTrackId === selectedBatchTrackIds[0] && isPlaying
                                  ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)] font-bold'
                                  : 'bg-primary/20 hover:bg-primary/30 text-primary border border-primary/20'
                              }`}
                            >
                              {previewTrackId === selectedBatchTrackIds[0] && isPlaying ? (
                                <>
                                  <span className="w-2 h-2 rounded-full bg-black animate-ping shrink-0" />
                                  <span>Stop ({previewCountdown}s)</span>
                                </>
                              ) : (
                                <>
                                  <PlayCircle className="w-4 h-4 shrink-0" />
                                  <span>{mb.previewBtn}</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full border border-white/5 bg-white/5 border-dashed rounded-xl p-4 text-center mb-6">
                          <span className="font-mono text-[9px] uppercase tracking-wider text-white/30 block">
                            Select active presets & files to enable DSP Audition Preview
                          </span>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setBatchLogs([
                            `[SYSTEM] Sequential batch job armed.`,
                            `[SYSTEM] Selected Preset ID: ${selectedPresetId}`,
                            `[SYSTEM] Target Queue count: ${selectedBatchTrackIds.length} files.`
                          ]);
                          setBatchProcessingState('running');
                          setCurrentQueueIndex(0);
                          setMockTrackProgress(0);
                        }}
                        disabled={selectedBatchTrackIds.length === 0 || !selectedPresetId}
                        className="w-full h-12 rounded-xl bg-primary hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100 flex items-center justify-center gap-2 font-mono text-xs font-black uppercase tracking-widest text-black shadow-lg transition-all"
                      >
                        <PlayCircle className="w-4 h-4" />
                        <span>{mb.runBatch}</span>
                      </button>
                    </div>
                  ) : (
                    /* RUNNING OR COMPLETED STATE WRAPPER */
                    <div className="flex-1 flex flex-col gap-5 min-h-[300px] justify-between">
                      
                      {/* Active queue monitor */}
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-left flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[9px] uppercase tracking-widest bg-primary/10 border border-primary/20 text-primary px-2.5 py-1 rounded-sm font-bold">
                            {batchProcessingState === 'running' ? mb.running : mb.completed}
                          </span>
                          <span className="font-mono text-xs text-white/40">
                            {batchProcessingState === 'running' 
                              ? mb.activeProcessing.replace('{current}', (currentQueueIndex + 1).toString()).replace('{total}', selectedBatchTrackIds.length.toString())
                              : mb.completedStatus
                            }
                          </span>
                        </div>

                        {/* Active File Label */}
                        {batchProcessingState === 'running' && (
                          <div className="border border-white/5 bg-black/40 p-3 rounded-lg flex justify-between items-center">
                            <div className="min-w-0">
                              <span className="text-[7px] font-mono uppercase text-white/30 tracking-wider block font-semibold">CURRENT ACTIVE FILE</span>
                              <span className="font-mono text-[10px] font-black uppercase text-primary tracking-wide truncate block">
                                {tracks.find(t => t.id === selectedBatchTrackIds[currentQueueIndex])?.name || 'Unknown Track'}
                              </span>
                            </div>
                            <span className="font-mono text-xl font-black text-primary animate-pulse">{mockTrackProgress}%</span>
                          </div>
                        )}

                        {/* Current Track Progress Bar */}
                        {batchProcessingState === 'running' && (
                          <div className="space-y-1">
                            <div className="h-1.5 bg-black rounded-full overflow-hidden border border-white/5">
                              <div 
                                className="h-full bg-primary rounded-full transition-all duration-150"
                                style={{ width: `${mockTrackProgress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Overall Job Progress Bar */}
                        <div className="space-y-1.5 pt-2 border-t border-white/5">
                          <div className="flex justify-between items-center font-mono text-[8px] uppercase text-white/40 tracking-wider font-semibold">
                            <span>OVERALL QUEUE PROGRESS</span>
                            <span>
                              {batchProcessingState === 'completed'
                                ? '100%'
                                : `${Math.floor(((currentQueueIndex + (mockTrackProgress / 100)) / selectedBatchTrackIds.length) * 100)}%`
                              }
                            </span>
                          </div>
                          <div className="h-2 bg-black rounded-full overflow-hidden border border-white/5">
                            <div 
                              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                              style={{ 
                                width: batchProcessingState === 'completed' 
                                  ? '100%' 
                                  : `${((currentQueueIndex + (mockTrackProgress / 100)) / selectedBatchTrackIds.length) * 100}%` 
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Terminal logs panel */}
                      <div className="flex-1 flex flex-col gap-2">
                        <span className="font-mono text-[9px] uppercase tracking-widest text-white/40 block">
                          {mb.logConsole}
                        </span>
                        
                        <div className="flex-1 bg-black/95 rounded-xl border border-white/5 p-4 font-mono text-[9.5px] leading-relaxed text-emerald-400 overflow-y-auto custom-scrollbar max-h-[160px] flex flex-col gap-1 select-none">
                          {batchLogs.map((log, index) => {
                            const isSuccess = log.includes('[SUCCESS]');
                            const isSystem = log.includes('[SYSTEM]');
                            const isEngine = log.includes('[ENGINE]');
                            
                            return (
                              <div 
                                key={index}
                                className={isSuccess ? 'text-emerald-300 font-bold' : isSystem ? 'text-primary' : isEngine ? 'text-amber-500' : 'text-emerald-400/80'}
                              >
                                {log}
                              </div>
                            );
                          })}
                          <div ref={terminalEndRef} />
                        </div>
                      </div>

                      {/* Render Completed Message */}
                      {batchProcessingState === 'completed' && (
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-left flex gap-3">
                          <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                          <p className="font-sans text-xs text-white/80 leading-relaxed">
                            {mb.successMsg
                              .replace('{count}', selectedBatchTrackIds.length.toString())
                              .replace('{presetName}', [...(masteringPresets || []), ...systemPresets].find(p => p.id === selectedPresetId)?.name || 'N/A')
                            }
                          </p>
                        </div>
                      )}

                      {/* Action trigger button inside processing screen */}
                      <div className="flex justify-end gap-3">
                        {batchProcessingState === 'running' ? (
                          <button
                            onClick={() => {
                              if (confirm(mb.cancelBatch + "?")) {
                                setBatchProcessingState('idle');
                                setBatchLogs(logs => [...logs, '>>> BATCH PROCESS ABORTED BY USER. CURRENT RENDER TERMINATED.']);
                              }
                            }}
                            className="w-full h-11 border border-rose-500/20 hover:border-rose-500/40 bg-rose-500/15 text-rose-500 hover:bg-rose-500/25 transition-all rounded-xl font-mono text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1 shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>{mb.cancelBatch}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setIsBatchOpen(false);
                              setBatchProcessingState('idle');
                            }}
                            className="w-full h-12 bg-primary text-black hover:brightness-110 rounded-xl font-mono text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center shadow-lg"
                          >
                            <Check className="w-4 h-4 shrink-0 stroke-[3px] mr-1" />
                            <span>Dismiss Batch Processing</span>
                          </button>
                        )}
                      </div>

                    </div>
                  )}

                </div>

              </div>

              {/* General Bottom Footer */}
              <div className="p-6 bg-black/40 border-t border-white/5 flex items-center justify-end">
                <button 
                  onClick={() => {
                    if (batchProcessingState === 'running') {
                      if (!confirm(mb.cancelBatch + "?")) return;
                    }
                    setIsBatchOpen(false);
                    setBatchProcessingState('idle');
                  }}
                  className="px-6 py-3 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 text-white/80 transition-all font-mono text-[10.5px] uppercase tracking-widest font-black"
                >
                  Close Window
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TrackRow(props: { track: Track, active: boolean, onSelect: () => void, onEditTags: () => void, key?: any }) {
  const { track, active, onSelect, onEditTags } = props;
  const { deleteTrack, duplicateTrack, renameTrack, language } = useMastering();
  
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(track.name);

  const tMenu = {
    pt: { rename: "Renomear", duplicate: "Duplicar", delete: "Excluir", select: "Carregar Sessão", placeholder: "Nome da track", tags: "Editar Tags" },
    es: { rename: "Renombrar", duplicate: "Duplicar", delete: "Eliminar", select: "Cargar Sesión", placeholder: "Nombre de track", tags: "Editar Tags" },
    en: { rename: "Rename", duplicate: "Duplicate", delete: "Delete", select: "Load Session", placeholder: "Track name", tags: "Edit Tags" }
  };
  const m = tMenu[language as keyof typeof tMenu] || tMenu.en;

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (renameVal.trim() && renameVal.trim() !== track.name) {
      renameTrack(track.id, renameVal.trim());
    }
    setIsRenaming(false);
  };

  const handleRenameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRenaming(true);
    setShowMenu(false);
  };

  const handleDuplicateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    duplicateTrack(track);
    setShowMenu(false);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteTrack(track.id);
    setShowMenu(false);
  };

  // Close menu on click outside
  useEffect(() => {
    if (!showMenu) return;
    const handleOutside = () => setShowMenu(false);
    window.addEventListener('click', handleOutside);
    return () => window.removeEventListener('click', handleOutside);
  }, [showMenu]);

  return (
    <div 
      onClick={() => {
        if (!isRenaming) onSelect();
      }}
      className={`group w-full flex items-center gap-6 p-4 rounded-xl border border-transparent transition-all cursor-pointer relative ${
        active 
          ? 'bg-primary/5 border-primary/20 backdrop-blur-sm' 
          : 'hover:bg-white/5 hover:border-white/5'
      }`}
    >
       <div className={`w-12 h-12 rounded-lg relative overflow-hidden flex items-center justify-center text-white/20 transition-all grow-0 shrink-0 ${
         active ? 'bg-primary/20 text-primary shadow-[0_0_15px_rgba(29,185,84,0.2)]' : 'bg-graphite'
       }`}>
          {track.metadata?.coverUrl ? (
            <img 
              src={track.metadata.coverUrl} 
              alt={track.name} 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer"
              onError={(e) => {
                // If direct loading fails, show standard notes icon
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <Music className="w-6 h-6" />
          )}
          <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
             <Play className="w-6 h-6 text-white fill-current" />
          </div>
       </div>

       <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-3">
             {isRenaming ? (
               <form onSubmit={handleRenameSubmit} className="flex items-center gap-2 max-w-md w-full" onClick={e => e.stopPropagation()}>
                  <input 
                    type="text"
                    value={renameVal}
                    onChange={e => setRenameVal(e.target.value)}
                    placeholder={m.placeholder}
                    className="flex-1 h-8 bg-obsidian border border-primary/40 rounded-lg px-3 font-mono text-xs text-white focus:outline-hidden"
                    autoFocus
                  />
                  <button 
                    type="submit" 
                    className="p-1 px-2.5 bg-primary/20 border border-primary/30 rounded-lg text-primary hover:bg-primary hover:text-on-primary transition-all text-[10px] font-mono uppercase font-black"
                  >
                     Ok
                  </button>
                  <button 
                    type="button" 
                    onClick={(e) => { e.stopPropagation(); setIsRenaming(false); setRenameVal(track.name); }}
                    className="p-1 px-2 bg-white/5 border border-white/10 rounded-lg text-white/60 hover:bg-white/10 transition-all text-[10px] font-mono uppercase font-black"
                  >
                     Esc
                  </button>
               </form>
             ) : (
               <>
                  <h4 className={`font-mono text-xs font-bold truncate uppercase tracking-widest ${active ? 'text-primary' : 'text-white'}`}>
                     {track.name}
                  </h4>
                  <span className="px-1.5 py-0.5 rounded-sm bg-white/5 border border-white/5 text-[8px] font-mono text-white/40 uppercase">
                     {track.bpm} BPM
                  </span>
                  {active && (
                     <div className="flex gap-1 h-3 items-end pb-0.5">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="w-0.5 h-full bg-primary animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
                        ))}
                     </div>
                  )}
               </>
             )}
          </div>
          <div className="flex items-center gap-6 mt-1 text-white/20 font-mono text-[9px] uppercase tracking-widest">
             <div className="flex items-center gap-2">
                <Calendar className="w-3 h-3" />
                <span>{track.metadata?.size === 'Synthetic' ? 'AI SYNTH' : 'ARCHIVE'}</span>
             </div>
             <div className="flex items-center gap-2">
                <Clock className="w-3 h-3" />
                <span>{Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}</span>
             </div>
             {track.artist && (
               <div className="flex items-center gap-1.5">
                  <span className="text-white/40 font-semibold">{track.artist}</span>
               </div>
             )}
             {track.metadata?.album && (
               <div className="flex items-center gap-1 opacity-60">
                 <span>•</span>
                 <span>{track.metadata.album}</span>
               </div>
             )}
             {track.metadata?.genre && (
               <div className="flex items-center gap-1 opacity-75 text-primary">
                 <span>•</span>
                 <span className="font-semibold uppercase tracking-wider text-[8px]">{track.metadata.genre}</span>
               </div>
             )}
             {track.metadata?.year && (
               <div className="flex items-center gap-1 opacity-40">
                 <span>•</span>
                 <span>{track.metadata.year}</span>
               </div>
             )}
          </div>
       </div>

       <div className="flex items-center gap-8 opacity-0 group-hover:opacity-100 transition-opacity grow-0 shrink-0">
          <div className="text-right flex flex-col items-end">
             <span className="engraved-label text-[8px] opacity-40">Sample Rate</span>
             <span className="font-mono text-[9px] text-white/60">96.0 kHz</span>
          </div>
          
          <div className="relative">
             <button 
               onClick={(e) => {
                 e.stopPropagation();
                 setShowMenu(!showMenu);
               }}
               className="p-2 text-white/40 hover:text-white transition-colors hover:bg-white/5 rounded-lg border border-transparent active:border-white/10"
             >
                <MoreVertical className="w-5 h-5" />
             </button>

             {/* Dropdown Menu Overlay */}
             <AnimatePresence>
                {showMenu && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    onClick={e => e.stopPropagation()}
                    className="absolute right-0 top-12 z-50 w-56 bg-obsidian-light border border-white/10 rounded-2xl p-2 shadow-2xl hardware-panel flex flex-col gap-1 "
                  >
                     <button
                       onClick={() => {
                         onSelect();
                         setShowMenu(false);
                       }}
                       className="w-full px-4 py-2.5 rounded-xl font-mono text-[10px] uppercase font-black tracking-widest text-left text-white/60 hover:text-primary hover:bg-primary/10 transition-all flex items-center justify-between"
                     >
                        <span>{m.select}</span>
                        <Play className="w-3.5 h-3.5" />
                     </button>
                     <button
                       onClick={(e) => {
                         e.stopPropagation();
                         onEditTags();
                         setShowMenu(false);
                       }}
                       className="w-full px-4 py-2.5 rounded-xl font-mono text-[10px] uppercase font-black tracking-widest text-left text-white/60 hover:text-primary hover:bg-primary/10 transition-all flex items-center justify-between"
                     >
                        <span>{m.tags}</span>
                        <Tag className="w-3.5 h-3.5 opacity-40" />
                     </button>
                     <button
                       onClick={handleRenameClick}
                       className="w-full px-4 py-2.5 rounded-xl font-mono text-[10px] uppercase font-black tracking-widest text-left text-white/60 hover:text-primary hover:bg-primary/10 transition-all flex items-center justify-between"
                     >
                        <span>{m.rename}</span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                     </button>
                     <button
                       onClick={handleDuplicateClick}
                       className="w-full px-4 py-2.5 rounded-xl font-mono text-[10px] uppercase font-black tracking-widest text-left text-white/60 hover:text-primary hover:bg-primary/10 transition-all flex items-center justify-between"
                     >
                        <span>{m.duplicate}</span>
                        <Copy className="w-3.5 h-3.5 opacity-40" />
                     </button>
                     <div className="h-px bg-white/5 my-1" />
                     <button
                       onClick={handleDeleteClick}
                       className="w-full px-4 py-2.5 rounded-xl font-mono text-[10px] uppercase font-black tracking-widest text-left text-rose-500 hover:bg-rose-500/10 transition-all flex items-center justify-between"
                     >
                        <span>{m.delete}</span>
                        <Trash2 className="w-3.5 h-3.5" />
                     </button>
                  </motion.div>
                )}
             </AnimatePresence>
          </div>
          <ChevronRight className="w-5 h-5 text-white/10" />
       </div>
    </div>
  );
}
