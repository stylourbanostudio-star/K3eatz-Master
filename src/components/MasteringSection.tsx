import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  Zap, 
  Waves, 
  Power, 
  AlignJustify, 
  Volume2 as VolumeIcon,
  Maximize2 as StereoIcon,
  Flame as SaturationIcon,
  Sparkles,
  Music,
  Plus,
  Play,
  Pause,
  Repeat,
  RefreshCw,
  Cloud,
  CloudOff,
  Link2,
  Upload,
  Layers,
  VolumeX,
  Volume1,
  ChevronRight,
  ChevronLeft,
  Save,
  Trash2,
  Sliders,
  Undo2,
  Redo2,
  Camera,
  Check,
  X,
  Edit2,
  Copy,
  Scale
} from 'lucide-react';
import { useMastering, MasteringSettings } from '../context/MasteringContext';
import AudioEditor from './AudioEditor';
import InteractiveEQVisualizer from './InteractiveEQVisualizer';
import FFTSpectrumVisualizer from './FFTSpectrumVisualizer';
import { generateDemoLoop } from '../utils/audioSynth';
import WorkstationBackgroundWaveform from './WorkstationBackgroundWaveform';
import EqCompPresetDropdown from './EqCompPresetDropdown';
import { EQ_COMP_PRESETS } from '../data/eqCompPresets';
import AutomationStudio from './AutomationStudio';
import { 
  AutomatableParam, 
  AutomationMode, 
  ParameterAutomation, 
  DEFAULT_AUTOMATION_TRACKS, 
  interpolateAutomationValue, 
  addOrUpdateAutomationPoint 
} from '../data/automationTypes';

export default function MasteringSection() {
  const { 
    settings, 
    updateSettings, 
    currentTrack, 
    setCurrentTrack, 
    addTrack, 
    user, 
    saving, 
    t,
    audioBuffer,
    isPlaying,
    currentTime,
    isLoadingAudio,
    isEngaged,
    setIsEngaged,
    autoGainMatch,
    setAutoGainMatch,
    autoGainOffsetDb,
    audioContextRef,
    nodesRef,
    togglePlayback,
    handleSeek,
    loadAudio,
    loadDemoTrack,
    presets,
    addPreset,
    deletePreset,
    undo,
    redo,
    canUndo,
    canRedo
  } = useMastering();

  const [activePreset, setActivePreset] = useState('Hip Hop');
  const [showMorePresets, setShowMorePresets] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [matchVolume, setMatchVolume] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [showEditor, setShowEditor] = useState(false);
  const [isLufsCustomMode, setIsLufsCustomMode] = useState(() => {
    const currentVal = settings.lufsTarget ?? -14;
    return currentVal !== -14 && currentVal !== -16 && currentVal !== -13 && currentVal !== -9 && currentVal !== -23 && currentVal !== -7;
  });

  const [newPresetName, setNewPresetName] = useState('');
  const [activeCustomPresetId, setActiveCustomPresetId] = useState<string | null>(null);
  const [spectralViewMode, setSpectralViewMode] = useState<'eq' | 'fft' | 'split'>('eq');
  const [mobileMasteringTab, setMobileMasteringTab] = useState<'dsp' | 'loudness' | 'tone' | 'meters' | 'presets'>('dsp');

  // Snapshot State
  const [snapshots, setSnapshots] = useState<Record<string, { id: string; name: string; settings: any; timestamp: string } | null>>(() => {
    try {
      const saved = localStorage.getItem(`mastercore_snapshots_global`);
      return saved ? JSON.parse(saved) : { A: null, B: null, C: null, D: null };
    } catch (e) {
      return { A: null, B: null, C: null, D: null };
    }
  });
  const [activeSnapshotSlot, setActiveSnapshotSlot] = useState<string | null>(null);
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [snapshotToast, setSnapshotToast] = useState<string | null>(null);

  // Sync snapshot memory on track swap
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`mastercore_snapshots_${currentTrack?.id || 'global'}`);
      setSnapshots(saved ? JSON.parse(saved) : { A: null, B: null, C: null, D: null });
      setActiveSnapshotSlot(null);
    } catch (e) {
      setSnapshots({ A: null, B: null, C: null, D: null });
    }
  }, [currentTrack?.id]);

  // Handle active status reset when user tweaks any dial live
  useEffect(() => {
    if (activeSnapshotSlot && snapshots[activeSnapshotSlot]) {
      const snapSettings = snapshots[activeSnapshotSlot]?.settings;
      if (JSON.stringify(settings) !== JSON.stringify(snapSettings)) {
        setActiveSnapshotSlot(null);
      }
    }
  }, [settings, activeSnapshotSlot, snapshots]);

  // Automation State Engine
  const [showAutomation, setShowAutomation] = useState(false);
  const [automationMode, setAutomationMode] = useState<AutomationMode>('off');
  const [activeAutomationParam, setActiveAutomationParam] = useState<AutomatableParam>('gain');
  const [automationTracks, setAutomationTracks] = useState<Record<AutomatableParam, ParameterAutomation>>(() => {
    try {
      const saved = localStorage.getItem(`mastercore_automation_${currentTrack?.id || 'global'}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        const merged: any = {};
        (Object.keys(DEFAULT_AUTOMATION_TRACKS) as AutomatableParam[]).forEach(k => {
          merged[k] = {
            ...DEFAULT_AUTOMATION_TRACKS[k],
            points: parsed[k]?.points || [],
            enabled: parsed[k]?.enabled !== undefined ? parsed[k].enabled : true
          };
        });
        return merged;
      }
    } catch (e) {}

    const initial: any = {};
    (Object.keys(DEFAULT_AUTOMATION_TRACKS) as AutomatableParam[]).forEach(k => {
      initial[k] = {
        ...DEFAULT_AUTOMATION_TRACKS[k],
        points: [],
        enabled: true
      };
    });
    return initial;
  });

  // Sync automation tracks per track ID
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`mastercore_automation_${currentTrack?.id || 'global'}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        const merged: any = {};
        (Object.keys(DEFAULT_AUTOMATION_TRACKS) as AutomatableParam[]).forEach(k => {
          merged[k] = {
            ...DEFAULT_AUTOMATION_TRACKS[k],
            points: parsed[k]?.points || [],
            enabled: parsed[k]?.enabled !== undefined ? parsed[k].enabled : true
          };
        });
        setAutomationTracks(merged);
      }
    } catch (e) {}
  }, [currentTrack?.id]);

  // Persist automation tracks
  useEffect(() => {
    try {
      localStorage.setItem(`mastercore_automation_${currentTrack?.id || 'global'}`, JSON.stringify(automationTracks));
    } catch (e) {}
  }, [automationTracks, currentTrack?.id]);

  // Real-time Parameter Recording Hook (Write / Latch Mode)
  const lastRecordTimeRef = useRef<Record<string, number>>({});
  const handleRecordParam = useCallback((param: AutomatableParam, value: number) => {
    if (automationMode !== 'write') return;

    const now = Date.now();
    const lastTime = lastRecordTimeRef.current[param] || 0;
    if (now - lastTime < 45) return; // Throttle to maintain 60fps DOM performance
    lastRecordTimeRef.current[param] = now;

    setAutomationTracks(prev => {
      const trk = prev[param];
      if (!trk) return prev;
      const newPoints = addOrUpdateAutomationPoint(trk.points, currentTime, value, 0.08);
      return {
        ...prev,
        [param]: {
          ...trk,
          points: newPoints
        }
      };
    });

    setActiveAutomationParam(param);
  }, [automationMode, currentTime]);

  // Real-time Playback Engine (Read Mode)
  const lastAutomatedValuesRef = useRef<Record<string, number>>({});
  useEffect(() => {
    if (automationMode !== 'read' || !audioBuffer) return;

    const ctx = audioContextRef.current;
    const nodes = nodesRef.current;
    if (!ctx || !nodes) return;

    let hasChanged = false;
    const changedSettings: Partial<MasteringSettings> = {};

    const applyTrack = (
      param: AutomatableParam,
      applyDsp: (v: number) => void,
      applyState: (v: number) => void
    ) => {
      const track = automationTracks[param];
      if (!track || track.points.length === 0) return;

      const val = interpolateAutomationValue(track.points, currentTime);
      if (val === null) return;

      try {
        applyDsp(val);
      } catch (e) {}

      const last = lastAutomatedValuesRef.current[param];
      if (last === undefined || Math.abs(last - val) >= 0.05) {
        lastAutomatedValuesRef.current[param] = val;
        applyState(val);
        hasChanged = true;
      }
    };

    // 1. Gain
    applyTrack(
      'gain',
      (v) => {
        if (nodes.inputGain) {
          nodes.inputGain.gain.setValueAtTime(Math.pow(10, v / 20), ctx.currentTime);
        }
      },
      (v) => { changedSettings.gain = Math.round(v * 10) / 10; }
    );

    // 2. EQ Low
    applyTrack(
      'eq.low',
      (v) => { if (nodes.low) nodes.low.gain.setValueAtTime(v, ctx.currentTime); },
      (v) => {
        if (!changedSettings.eq) changedSettings.eq = { ...settings.eq };
        changedSettings.eq.low = { ...settings.eq.low, gain: Math.round(v * 10) / 10 };
      }
    );

    // 3. EQ Low-Mid
    applyTrack(
      'eq.lowMid',
      (v) => { if (nodes.lowMid) nodes.lowMid.gain.setValueAtTime(v, ctx.currentTime); },
      (v) => {
        if (!changedSettings.eq) changedSettings.eq = { ...settings.eq };
        changedSettings.eq.lowMid = { ...settings.eq.lowMid, gain: Math.round(v * 10) / 10 };
      }
    );

    // 4. EQ Mid
    applyTrack(
      'eq.mid',
      (v) => { if (nodes.mid) nodes.mid.gain.setValueAtTime(v, ctx.currentTime); },
      (v) => {
        if (!changedSettings.eq) changedSettings.eq = { ...settings.eq };
        changedSettings.eq.mid = { ...settings.eq.mid, gain: Math.round(v * 10) / 10 };
      }
    );

    // 5. EQ High-Mid
    applyTrack(
      'eq.highMid',
      (v) => { if (nodes.highMid) nodes.highMid.gain.setValueAtTime(v, ctx.currentTime); },
      (v) => {
        if (!changedSettings.eq) changedSettings.eq = { ...settings.eq };
        changedSettings.eq.highMid = { ...settings.eq.highMid, gain: Math.round(v * 10) / 10 };
      }
    );

    // 6. EQ High
    applyTrack(
      'eq.high',
      (v) => { if (nodes.high) nodes.high.gain.setValueAtTime(v, ctx.currentTime); },
      (v) => {
        if (!changedSettings.eq) changedSettings.eq = { ...settings.eq };
        changedSettings.eq.high = { ...settings.eq.high, gain: Math.round(v * 10) / 10 };
      }
    );

    // 7. EQ HPF
    applyTrack(
      'eq.hpf',
      (v) => { if (nodes.hpf) nodes.hpf.frequency.setValueAtTime(v, ctx.currentTime); },
      (v) => {
        if (!changedSettings.eq) changedSettings.eq = { ...settings.eq };
        changedSettings.eq.hpf = Math.round(v);
      }
    );

    // 8. EQ LPF
    applyTrack(
      'eq.lpf',
      (v) => { if (nodes.lpf) nodes.lpf.frequency.setValueAtTime(v, ctx.currentTime); },
      (v) => {
        if (!changedSettings.eq) changedSettings.eq = { ...settings.eq };
        changedSettings.eq.lpf = Math.round(v);
      }
    );

    if (hasChanged) {
      updateSettings(changedSettings);
    }
  }, [currentTime, automationMode, audioBuffer, automationTracks]);

  const saveSnapshot = (slot: string, customName?: string) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const name = customName || `Approach ${slot}`;
    const newSnapshots = {
      ...snapshots,
      [slot]: {
        id: `snap-${slot}-${Date.now()}`,
        name,
        settings: JSON.parse(JSON.stringify(settings)),
        timestamp: time
      }
    };
    setSnapshots(newSnapshots);
    localStorage.setItem(`mastercore_snapshots_${currentTrack?.id || 'global'}`, JSON.stringify(newSnapshots));
    
    setSnapshotToast(`Snapshot slot ${slot} captured successfully`);
    setTimeout(() => setSnapshotToast(null), 3000);
  };

  const clearSnapshot = (slot: string) => {
    const newSnapshots = {
      ...snapshots,
      [slot]: null
    };
    setSnapshots(newSnapshots);
    localStorage.setItem(`mastercore_snapshots_${currentTrack?.id || 'global'}`, JSON.stringify(newSnapshots));
    if (activeSnapshotSlot === slot) {
      setActiveSnapshotSlot(null);
    }
  };

  const handleRenameSnapshot = (slot: string) => {
    if (!editingName.trim()) return;
    const existing = snapshots[slot];
    if (!existing) return;
    
    const newSnapshots = {
      ...snapshots,
      [slot]: {
        ...existing,
        name: editingName.trim()
      }
    };
    setSnapshots(newSnapshots);
    localStorage.setItem(`mastercore_snapshots_${currentTrack?.id || 'global'}`, JSON.stringify(newSnapshots));
    setEditingSlot(null);
  };

  const loadSnapshot = (slot: string) => {
    const snap = snapshots[slot];
    if (!snap) return;
    updateSettings(snap.settings);
    setActiveSnapshotSlot(slot);
  };

  // AI Limiter Suggestion States
  const [calculatedRms, setCalculatedRms] = useState<number | null>(null);
  const [calculatedPeak, setCalculatedPeak] = useState<number | null>(null);
  const [autoGainApplied, setAutoGainApplied] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState('Electronic');
  const [showLimiterAssistant, setShowLimiterAssistant] = useState(false);
  const [loadingLimiterSuggestion, setLoadingLimiterSuggestion] = useState(false);
  const [suggestionApplied, setSuggestionApplied] = useState(false);
  const [limiterSuggestion, setLimiterSuggestion] = useState<{
    ceiling: number;
    lufsTarget: number;
    releaseMode: string;
    transientResponse: string;
    explanation: string;
  } | null>(null);
  const [suggestionError, setSuggestionError] = useState('');

  // AI Parameter Suggester States
  const [selectedSuggesterGenre, setSelectedSuggesterGenre] = useState('Pop / Modern');
  const [selectedSuggesterAudioType, setSelectedSuggesterAudioType] = useState('Balanced / Transparent');
  const [loadingSuggester, setLoadingSuggester] = useState(false);
  const [suggesterError, setSuggesterError] = useState('');
  const [suggestedParameters, setSuggestedParameters] = useState<{
    genre: string;
    audioType: string;
    eq: { lowGain: number; midGain: number; highGain: number };
    compression: number;
    saturation: number;
    exciterAmount: number;
    stereoWidth: number;
    limiter: number;
    lufsTarget: number;
    explanation: string;
  } | null>(null);
  const [suggesterAppliedToast, setSuggesterAppliedToast] = useState(false);

  // AI A/B Audition & Comparative validation state
  const [isSuggesterAuditionMode, setIsSuggesterAuditionMode] = useState(false);
  const [currentAuditionSlot, setCurrentAuditionSlot] = useState<'A' | 'B'>('A');
  const [preSuggestionUserSettings, setPreSuggestionUserSettings] = useState<any | null>(null);

  const startABCompare = (slot: 'A' | 'B') => {
    if (!suggestedParameters) return;

    if (slot === 'B') {
      // Save current user settings before applying AI settings
      let originalSettings = preSuggestionUserSettings;
      if (!isSuggesterAuditionMode || !originalSettings) {
        originalSettings = JSON.parse(JSON.stringify(settings));
        setPreSuggestionUserSettings(originalSettings);
      }
      
      // Apply AI settings
      updateSettings({
        eq: {
          ...settings.eq,
          low: { ...settings.eq.low, gain: suggestedParameters.eq.lowGain },
          mid: { ...settings.eq.mid, gain: suggestedParameters.eq.midGain },
          high: { ...settings.eq.high, gain: suggestedParameters.eq.highGain }
        },
        compression: suggestedParameters.compression,
        saturation: suggestedParameters.saturation,
        exciter: {
          ...settings.exciter,
          amount: suggestedParameters.exciterAmount
        },
        stereoWidthL: parseFloat((suggestedParameters.stereoWidth * 100).toFixed(0)),
        stereoWidthR: parseFloat((suggestedParameters.stereoWidth * 100).toFixed(0)),
        limiter: suggestedParameters.limiter,
        lufsTarget: suggestedParameters.lufsTarget
      });
      setCurrentAuditionSlot('B');
      setIsSuggesterAuditionMode(true);
    } else {
      // Restore user settings
      if (preSuggestionUserSettings) {
        updateSettings(preSuggestionUserSettings);
      }
      setCurrentAuditionSlot('A');
      setIsSuggesterAuditionMode(true);
    }
  };

  const commitABSettings = (keepAI: boolean) => {
    if (keepAI && suggestedParameters) {
      applySuggesterParameters();
    } else if (!keepAI && preSuggestionUserSettings) {
      updateSettings(preSuggestionUserSettings);
    }
    setIsSuggesterAuditionMode(false);
    setPreSuggestionUserSettings(null);
    setCurrentAuditionSlot('A');
  };

  const AI_DOMINANT_GENRES = [
    'Pop / Modern',
    'Electronic / Dance',
    'Hip Hop / Trap',
    'Lofi / Chillhop',
    'Rock / Heavy Metal',
    'Acoustic / Vocal Folk',
    'Ambient / Cinematic',
    'Podcast / Speech & Vocals'
  ];

  const AI_AUDIO_TYPES = [
    'Balanced / Transparent',
    'Upbeat / Club Force',
    'Vocal-Forward / Clean',
    'Deep Sub / Heavy Bass',
    'Warm Tape / Vintage Glow',
    'Wide Panoramic / Spacious'
  ];

  const fetchParametersSuggestion = async () => {
    setLoadingSuggester(true);
    setSuggesterError('');
    setSuggesterAppliedToast(false);
    try {
      const response = await fetch('/api/suggest-mastering-parameters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genre: selectedSuggesterGenre,
          audioType: selectedSuggesterAudioType,
          rmsValue: calculatedRms ?? -14.0,
          bpm: currentTrack?.bpm || 120
        })
      });
      const data = await response.json();
      if (data.success && data.suggestion) {
        setSuggestedParameters(data.suggestion);
      } else {
        throw new Error(data.error || "Failed to retrieve suggestion");
      }
    } catch (err: any) {
      console.warn("Notice: mastering parameter suggestion fallback:", err);
      setSuggesterError(err.message || "Failed to communicate with Neural Suggester API");
    } finally {
      setLoadingSuggester(false);
    }
  };

  const applySuggesterParameters = () => {
    if (!suggestedParameters) return;
    updateSettings({
      eq: {
        ...settings.eq,
        low: { ...settings.eq.low, gain: suggestedParameters.eq.lowGain },
        mid: { ...settings.eq.mid, gain: suggestedParameters.eq.midGain },
        high: { ...settings.eq.high, gain: suggestedParameters.eq.highGain }
      },
      compression: suggestedParameters.compression,
      saturation: suggestedParameters.saturation,
      exciter: {
        ...settings.exciter,
        amount: suggestedParameters.exciterAmount
      },
      stereoWidthL: parseFloat((suggestedParameters.stereoWidth * 100).toFixed(0)),
      stereoWidthR: parseFloat((suggestedParameters.stereoWidth * 100).toFixed(0)),
      limiter: suggestedParameters.limiter,
      lufsTarget: suggestedParameters.lufsTarget
    });
    setSuggesterAppliedToast(true);
    setTimeout(() => setSuggesterAppliedToast(false), 3000);
  };

  const saveSuggestedToSnapshotSlot = (slot: string) => {
    if (!suggestedParameters) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    // Construct the settings object based on suggestions merged with current controls
    const snapshotSettings = {
      ...settings,
      eq: {
        ...settings.eq,
        low: { ...settings.eq.low, gain: suggestedParameters.eq.lowGain },
        mid: { ...settings.eq.mid, gain: suggestedParameters.eq.midGain },
        high: { ...settings.eq.high, gain: suggestedParameters.eq.highGain }
      },
      compression: suggestedParameters.compression,
      saturation: suggestedParameters.saturation,
      exciter: {
        ...settings.exciter,
        amount: suggestedParameters.exciterAmount
      },
      stereoWidthL: parseFloat((suggestedParameters.stereoWidth * 100).toFixed(0)),
      stereoWidthR: parseFloat((suggestedParameters.stereoWidth * 100).toFixed(0)),
      limiter: suggestedParameters.limiter,
      lufsTarget: suggestedParameters.lufsTarget
    };

    const newSnapshots = {
      ...snapshots,
      [slot]: {
        id: `snap-${slot}-${Date.now()}`,
        name: `${suggestedParameters.genre.split(' / ')[0]} (${selectedSuggesterAudioType.split(' / ')[0]})`,
        settings: snapshotSettings,
        timestamp: time
      }
    };
    setSnapshots(newSnapshots);
    localStorage.setItem(`mastercore_snapshots_${currentTrack?.id || 'global'}`, JSON.stringify(newSnapshots));
    
    setSnapshotToast(`Snapshot slot ${slot} loaded with AI suggestion!`);
    setTimeout(() => setSnapshotToast(null), 3000);
  };

  // Auto-fill selectedGenre when track metadata changes
  useEffect(() => {
    if (currentTrack?.metadata?.genre) {
      setSelectedGenre(currentTrack.metadata.genre);
    }
  }, [currentTrack]);

  // Compute RMS & Peak when audioBuffer changes
  useEffect(() => {
    if (!audioBuffer) {
      setCalculatedRms(null);
      setCalculatedPeak(null);
      setLimiterSuggestion(null);
      setSuggestionApplied(false);
      return;
    }
    try {
      const channelData = audioBuffer.getChannelData(0);
      
      // Compute RMS
      const rmsStep = Math.max(1, Math.floor(channelData.length / 500000));
      let sumSq = 0;
      let rmsCount = 0;
      for (let i = 0; i < channelData.length; i += rmsStep) {
        const val = channelData[i];
        sumSq += val * val;
        rmsCount++;
      }
      const meanSq = sumSq / (rmsCount || 1);
      const rms = Math.sqrt(meanSq);
      const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -120;
      setCalculatedRms(parseFloat(rmsDb.toFixed(1)));

      // Compute Peak level (high accuracy using 2M points scan)
      const peakStep = Math.max(1, Math.floor(channelData.length / 2000000));
      let maxVal = 0;
      for (let i = 0; i < channelData.length; i += peakStep) {
        const absVal = Math.abs(channelData[i]);
        if (absVal > maxVal) {
          maxVal = absVal;
        }
      }
      const peakDb = maxVal > 0 ? 20 * Math.log10(maxVal) : -120;
      setCalculatedPeak(parseFloat(peakDb.toFixed(2)));

    } catch (err) {
      console.error("Failed to compute track statistics", err);
      setCalculatedRms(-14.3);
      setCalculatedPeak(-1.0);
    }
  }, [audioBuffer]);

  const handleAutoGain = () => {
    if (calculatedPeak === null) return;
    // Target is -12 dBFS peak
    const neededGain = -12.0 - calculatedPeak;
    // Clamp to slider range limit of [-12.0, 12.0]
    const clampedGain = Math.max(-12, Math.min(12, parseFloat(neededGain.toFixed(1))));
    
    updateSettings({ gain: clampedGain });
    setAutoGainApplied(true);
    setTimeout(() => {
      setAutoGainApplied(false);
    }, 3000);
  };

  const fetchLimiterSuggestion = async () => {
    if (!currentTrack) return;
    setLoadingLimiterSuggestion(true);
    setSuggestionError('');
    setSuggestionApplied(false);
    try {
      const response = await fetch('/api/suggest-limiter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genre: selectedGenre,
          rmsValue: calculatedRms ?? -14.0,
          bpm: currentTrack?.bpm || 120
        })
      });
      const data = await response.json();
      if (data.success && data.suggestion) {
        setLimiterSuggestion(data.suggestion);
      } else {
        throw new Error(data.error || "Failed to retrieve suggestion");
      }
    } catch (err: any) {
      console.warn("Notice: limiter suggestion fallback:", err);
      setSuggestionError(err.message || "Failed to communicate with AI Analyst");
    } finally {
      setLoadingLimiterSuggestion(false);
    }
  };

  const applyLimiterSuggestion = () => {
    if (!limiterSuggestion) return;
    updateSettings({
      limiter: limiterSuggestion.ceiling,
      lufsTarget: limiterSuggestion.lufsTarget
    });
    setSuggestionApplied(true);
    setTimeout(() => setSuggestionApplied(false), 3000);
  };

  const handleSavePreset = async () => {
    if (!newPresetName.trim()) return;
    try {
      await addPreset(newPresetName.trim(), settings);
      setNewPresetName('');
    } catch (e) {
      console.error("Error saving preset", e);
    }
  };

  const handleLoadPreset = (preset: any) => {
    updateSettings(preset.settings);
    setActiveCustomPresetId(preset.id);
    setActivePreset(preset.name);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLocalSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleSeek(parseFloat(e.target.value));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
      setDragCounter(prev => prev + 1);
      setIsDragging(true);
    }
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    const newCounter = dragCounter - 1;
    setDragCounter(newCounter);
    if (newCounter <= 0) {
      setIsDragging(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setDragCounter(0);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      await processFile(file);
    }
  };

  const processFile = async (file: File) => {
    // Create a temporary track object
    const newTrack = {
      name: file.name.replace(/\.[^/.]+$/, ""),
      artist: user?.displayName || 'Unknown Artist',
      bpm: 120,
      key: 'C Maj',
      duration: 0, // Would need audio context to get real duration
      status: 'pending' as const,
      metadata: {
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      },
      file: file
    };

    if (user) {
      const added = await addTrack(newTrack);
      if (added) {
        setCurrentTrack(added);
      }
    } else {
      // For non-logged in users, just set current track locally
      setCurrentTrack({
        ...newTrack,
        id: 'local-' + Date.now(),
        userId: 'local'
      });
    }
  };

  const [meterValues, setMeterValues] = useState({ 
    lufsM: -14.2, 
    lufsI: -14.2, 
    peak: -0.3, 
    correlation: 0.88,
    peakHold: -0.3
  });

  useEffect(() => {
    const targetLUFS = settings.lufsTarget ?? -14.2;
    setMeterValues(prev => ({
      ...prev,
      lufsM: targetLUFS,
      lufsI: targetLUFS
    }));
  }, [settings.lufsTarget]);

  useEffect(() => {
    if (!isEngaged) return;
    const interval = setInterval(() => {
      setMeterValues(prev => {
        const targetLUFS = settings.lufsTarget ?? -14.0;
        const momentLUFS = targetLUFS + (Math.random() * 0.8 - 0.4);
        const momentPeak = -0.3 + (Math.random() * 0.2 - 0.1);
        const momentCorr = 0.82 + (Math.random() * 0.12 - 0.06);
        
        return {
          lufsM: momentLUFS,
          lufsI: prev.lufsI * 0.99 + momentLUFS * 0.01, // Smoothing for integrated
          peak: momentPeak,
          correlation: momentCorr,
          peakHold: Math.max(prev.peakHold, momentPeak)
        };
      });
    }, 80); // Faster updates for smoother metering
    return () => clearInterval(interval);
  }, [isEngaged, settings.lufsTarget]);

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const mainPresets = ['Hip Hop', 'Trap', 'Reggae', 'Pop'];
  const morePresets = [
    'Amapiano', 'Funk BR', 'Drill', 'Boom Bap', 'Afrobeat', 
    'House', 'Techno', 'EDM', 'Rock', 'Lo-fi', 'Jazz', 
    'R&B', 'Gospel', 'Cinematic', 'Experimental', 'MPB'
  ];

const eqPresets = [
    { name: 'Flat', values: { low: 0, lowMid: 0, mid: 0, highMid: 0, high: 0 } },
    { name: 'Bright', values: { low: -0.5, lowMid: -0.5, mid: 0, highMid: 1.5, high: 3.5 } },
    { name: 'Warm', values: { low: 3.5, lowMid: 1.5, mid: 0, highMid: -1, high: -2.5 } },
    { name: 'Presence', values: { low: 0, lowMid: 0, mid: 1.5, highMid: 3.5, high: 1.5 } },
    { name: 'Cut Mud', values: { low: 0, lowMid: -4, mid: 0, highMid: 0, high: 0 } }
  ];

  const applyEQPreset = (values: Record<string, number>) => {
    const updatedEq = { ...settings.eq };
    Object.entries(values).forEach(([band, gain]) => {
      if (band === 'hpf' || band === 'lpf') {
        (updatedEq as any)[band] = gain;
      } else {
        (updatedEq as any)[band] = { ...(updatedEq as any)[band], gain };
      }
    });
    updateSettings({ eq: updatedEq });
  };

  const applyGenrePreset = (presetName: string) => {
    setActivePreset(presetName);
    
    // Map genres to curated EQ and compression profiles
    const genreToPresetId: Record<string, string> = {
      'Hip Hop': 'modern-punch',
      'Boom Bap': 'modern-punch',
      'Trap': 'trap-808-dominator',
      'Drill': 'trap-808-dominator',
      'Reggae': 'analog-tape-glue',
      'Afrobeat': 'analog-tape-glue',
      'MPB': 'analog-tape-glue',
      'Pop': 'radio-polish',
      'Gospel': 'radio-polish',
      'House': 'club-sub-slam',
      'Techno': 'club-sub-slam',
      'EDM': 'club-sub-slam',
      'Funk BR': 'club-sub-slam',
      'Amapiano': 'club-sub-slam',
      'Rock': 'parallel-crush',
      'Lo-fi': 'lofi-vintage',
      'Jazz': 'acoustic-transparent',
      'R&B': 'silky-air',
      'Cinematic': 'clarity-de-mud',
      'Experimental': 'clarity-de-mud'
    };

    const targetId = genreToPresetId[presetName];
    if (targetId) {
      const p = EQ_COMP_PRESETS.find(x => x.id === targetId);
      if (p) {
        updateSettings({
          eq: {
            ...settings.eq,
            hpf: p.eq.hpf,
            low: { ...p.eq.low },
            lowMid: { ...p.eq.lowMid },
            mid: { ...p.eq.mid },
            highMid: { ...p.eq.highMid },
            high: { ...p.eq.high },
            lpf: p.eq.lpf
          },
          compression: p.compression,
          dynamics: {
            low: { ...p.dynamics.low },
            mid: { ...p.dynamics.mid },
            high: { ...p.dynamics.high }
          }
        });
      }
    }
  };

  return (
    <div 
      className="h-full w-full flex flex-col overflow-hidden bg-obsidian relative"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Drag & Drop Overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-primary/10 backdrop-blur-[2px] flex items-center justify-center p-12"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full h-full border-2 border-dashed border-primary/50 rounded-2xl bg-obsidian-light/80 flex flex-col items-center justify-center gap-6 shadow-[0_0_50px_rgba(29,185,84,0.2)]"
            >
              <div className="w-24 h-24 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center shadow-[0_0_30px_rgba(29,185,84,0.3)]">
                <Upload className="w-12 h-12 text-primary animate-bounce" />
              </div>
              <div className="text-center">
                <h3 className="text-white font-mono text-2xl uppercase tracking-[0.3em] font-black mb-2">Ready for Drop</h3>
                <p className="text-white/40 font-mono text-[10px] uppercase tracking-widest leading-relaxed">
                  Release to load audio into the Spectral Engine
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Top Banner / Chain Info */}
      <div className="h-11 sm:h-10 border-b border-white/5 flex items-center justify-between px-3 sm:px-6 bg-obsidian-light/40 overflow-x-auto custom-scrollbar gap-3 shrink-0 whitespace-nowrap">
         <div className="flex items-center gap-3 sm:gap-6 shrink-0">
            <div className="flex items-center gap-2">
               <div className={`w-1.5 h-1.5 rounded-full ${isEngaged ? 'bg-primary animate-pulse' : 'bg-white/10'}`} />
               <span className="font-mono text-[9px] text-white/40 uppercase tracking-widest">DSP Engine: Ready</span>
            </div>
            <div className="h-4 w-px bg-white/10" />
            
            <AnimatePresence mode="wait">
              {!isOnline ? (
                <motion.div 
                  key="offline"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 cursor-help group"
                  title="Internet connection lost. Changes saved locally."
                >
                  <div className="relative">
                    <CloudOff className="w-3.5 h-3.5 text-scarlet/60" />
                    <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-scarlet rounded-full border border-obsidian" />
                  </div>
                  <span className="font-mono text-[9px] text-scarlet/80 uppercase tracking-widest font-bold">{t('status.offline')}</span>
                </motion.div>
              ) : saving ? (
                <motion.div 
                  key="syncing"
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 5 }}
                  className="flex items-center gap-2 cursor-help"
                  title="Syncing changes to secure cloud storage..."
                >
                  <RefreshCw className="w-3 h-3 text-primary animate-spin" />
                  <span className="font-mono text-[9px] text-primary uppercase tracking-widest font-bold">{t('status.syncing')}</span>
                </motion.div>
              ) : (
                <motion.div 
                  key="synced"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 cursor-help group"
                  title={user ? 'Session safely synced to your account' : 'Session stored in local storage'}
                >
                  <motion.div
                    animate={user ? {
                      opacity: [0.6, 1, 0.6],
                      scale: [0.9, 1.1, 0.9]
                    } : {}}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="relative"
                  >
                    <Cloud className={`w-3.5 h-3.5 ${user ? 'text-primary neon-glow-emerald' : 'text-white/20'}`} />
                    {user && <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-primary rounded-full border border-obsidian shadow-[0_0_5px_#1db954]" />}
                  </motion.div>
                  <span className={`font-mono text-[9px] uppercase tracking-widest font-bold transition-colors ${user ? 'text-white/60 group-hover:text-primary' : 'text-white/20'}`}>
                    {user ? t('status.synced') : t('status.local')}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="h-4 w-px bg-white/10" />
            <div className="hidden xl:flex items-center gap-2.5">
               <ChainModule label="EQ" active />
               <ChainModule label="COMP" active />
               <ChainModule label="LMT" active />
               <ChainModule label="WID" active />
               <ChainModule label="SAT" active={settings.saturation > 0} />
               <ChainModule label="EXC" active={settings.exciter.amount > 0} />
               <ChainModule label="RVB" active={settings.reverb > 0} />
               <ChainModule label="DLY" active={settings.delay > 0} />
            </div>
         </div>
         <div className="flex items-center gap-4">
            {/* Undo / Redo history control module */}
            <div className="flex items-center border border-white/10 rounded overflow-hidden select-none bg-black/60 shadow-inner">
               <button 
                  onClick={undo}
                  disabled={!canUndo}
                  title="Undo last parameter tweak"
                  className={`flex items-center gap-1 px-2.5 py-1 font-mono text-[8.5px] font-bold uppercase tracking-widest transition-all ${
                     canUndo 
                        ? 'text-white/70 hover:bg-white/10 hover:text-white border-r border-white/10' 
                        : 'text-white/15 cursor-not-allowed border-r border-white/10'
                  }`}
               >
                  <Undo2 className="w-2.5 h-2.5" />
                  <span>Undo</span>
               </button>
               <button 
                  onClick={redo}
                  disabled={!canRedo}
                  title="Redo next parameter tweak"
                  className={`flex items-center gap-1 px-2.5 py-1 font-mono text-[8.5px] font-bold uppercase tracking-widest transition-all ${
                     canRedo 
                        ? 'text-white/70 hover:bg-white/10 hover:text-white' 
                        : 'text-white/15 cursor-not-allowed'
                  }`}
               >
                  <span>Redo</span>
                  <Redo2 className="w-2.5 h-2.5" />
               </button>
            </div>

            <button 
               onClick={() => setCompareMode(!compareMode)}
               className={`flex items-center gap-2 px-3 py-1 rounded border transition-all ${
                  compareMode ? 'bg-amber text-obsidian border-amber' : 'text-white/40 border-white/10 hover:border-white/20'
               }`}
            >
               <Repeat className="w-3 h-3" />
               <span className="font-mono text-[9px] font-bold uppercase tracking-widest">Compare A/B</span>
            </button>
            <div className="flex items-center gap-2">
               <input 
                  type="checkbox" 
                  id="match-vol" 
                  checked={matchVolume} 
                  onChange={() => setMatchVolume(!matchVolume)}
                  className="hidden" 
               />
               <label 
                  htmlFor="match-vol" 
                  className={`cursor-pointer font-mono text-[8px] uppercase tracking-widest px-2 py-1 rounded ${matchVolume ? 'text-primary border border-primary/20' : 'text-white/20'}`}
               >
                  Match Vol
               </label>
            </div>
         </div>
      </div>

      {/* Interactive Snapshot Ribbon (Expands when compareMode is active) */}
      <AnimatePresence>
        {compareMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="border-b border-white/10 bg-black/45 overflow-hidden backdrop-blur-md"
          >
            <div className="px-6 py-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6">
              
              {/* Left Side: Context Label */}
              <div className="min-w-[180px] space-y-1">
                <div className="flex items-center gap-2">
                  <Camera className="w-3.5 h-3.5 text-primary animate-pulse" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] font-black text-white">Compare Matrix</span>
                </div>
                <p className="text-[10px] text-white/40 leading-snug">
                  Capture current settings to A/B/C/D slots and instantly switch to compare mastering approaches.
                </p>
                {snapshotToast && (
                  <div className="text-[9px] font-mono font-bold text-primary uppercase animate-pulse">
                    ● {snapshotToast}
                  </div>
                 )}
               </div>

               {/* Right Side: Slots A, B, C, D */}
               <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                 {['A', 'B', 'C', 'D'].map((slot) => {
                   const snap = snapshots[slot];
                   const isActive = activeSnapshotSlot === slot;
                   const isEditing = editingSlot === slot;

                   return (
                     <div 
                       key={slot}
                       className={`relative rounded-lg border p-3 transition-all flex flex-col justify-between h-[105px] group ${
                         snap 
                           ? isActive 
                             ? 'bg-primary/5 border-primary shadow-[0_0_15px_rgba(29,185,84,0.1)]' 
                             : 'bg-white/5 border-white/10 hover:border-white/20'
                           : 'bg-white/[0.01] border-white/5 border-dashed'
                       }`}
                     >
                       {/* Slot Top Header */}
                       <div className="flex items-center justify-between gap-2">
                         <div className="flex items-center gap-1.5 min-w-0 flex-1">
                           <span className={`w-4 h-4 rounded text-[9px] font-mono font-bold flex items-center justify-center ${
                             snap 
                               ? isActive 
                                 ? 'bg-primary text-black' 
                                 : 'bg-white/10 text-white/70'
                               : 'bg-white/5 text-white/30'
                           }`}>
                             {slot}
                           </span>
                           
                           {snap ? (
                             isEditing ? (
                               <div className="flex items-center gap-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                                 <input 
                                   type="text"
                                   value={editingName}
                                   onChange={(e) => setEditingName(e.target.value)}
                                   onKeyDown={(e) => {
                                     if (e.key === 'Enter') handleRenameSnapshot(slot);
                                     if (e.key === 'Escape') setEditingSlot(null);
                                   }}
                                   className="bg-black/80 border border-white/20 rounded px-1 py-0.5 text-[9px] font-mono text-white w-full outline-none"
                                   autoFocus
                                 />
                                 <button 
                                   onClick={() => handleRenameSnapshot(slot)}
                                   className="text-primary hover:text-white"
                                 >
                                   <Check className="w-3 h-3" />
                                 </button>
                               </div>
                             ) : (
                               <span 
                                 onDoubleClick={() => {
                                   setEditingSlot(slot);
                                   setEditingName(snap.name);
                                 }}
                                 className="font-mono text-[10px] font-bold text-white truncate cursor-pointer hover:text-primary flex items-center gap-1 min-w-0"
                                 title="Double-click to rename"
                               >
                                 {snap.name}
                                 <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-40" />
                               </span>
                             )
                           ) : (
                             <span className="font-mono text-[10px] text-white/20 uppercase tracking-wider">Empty Slot</span>
                           )}
                         </div>

                         {/* Actions (Delete / Recapture) */}
                         {snap && (
                           <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 saveSnapshot(slot, snap.name);
                               }}
                               title="Recapture Current System Parameters"
                               className="p-1 rounded hover:bg-white/5 text-white/50 hover:text-amber transition-colors"
                             >
                               <RefreshCw className="w-2.5 h-2.5 animate-spin-hover" />
                             </button>
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 clearSnapshot(slot);
                               }}
                               title="Clear Snapshot"
                               className="p-1 rounded hover:bg-white/5 text-scarlet hover:text-red-400 transition-colors"
                             >
                               <X className="w-2.5 h-2.5" />
                             </button>
                           </div>
                         )}
                       </div>

                       {/* Info Metadata Block */}
                       {snap ? (
                         <div 
                           onClick={() => loadSnapshot(slot)}
                           className="flex-1 mt-2 mb-1 cursor-pointer select-none space-y-1.5 flex flex-col justify-end"
                         >
                           <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] font-mono text-white/40">
                             <div className="truncate">
                               Gain: <span className={settings.gain !== snap.settings.gain ? 'text-amber font-bold' : 'text-white/60'}>
                                 {snap.settings.gain > 0 ? '+' : ''}{snap.settings.gain}dB
                               </span>
                             </div>
                             <div className="truncate">
                               Sat: <span className={settings.saturation !== snap.settings.saturation ? 'text-amber font-bold' : 'text-white/60'}>
                                 {snap.settings.saturation || 0}%
                               </span>
                             </div>
                             <div className="truncate">
                               Width: <span className={settings.stereoWidthR !== snap.settings.stereoWidthR ? 'text-amber font-bold' : 'text-white/60'}>
                                 {snap.settings.stereoWidthR || 1.0}x
                               </span>
                             </div>
                             <div className="truncate">
                               Target: <span className={settings.lufsTarget !== snap.settings.lufsTarget ? 'text-amber font-bold' : 'text-white/60'}>
                                 {snap.settings.lufsTarget || -14}L
                               </span>
                             </div>
                           </div>
                           
                           <div className="flex items-center justify-between text-[8px] font-mono text-white/20 pt-0.5 border-t border-white/5">
                             <span>{snap.timestamp}</span>
                             {isActive ? (
                               <span className="text-primary font-bold tracking-widest uppercase text-[7.5px]">Active</span>
                             ) : (
                               <span className="opacity-0 group-hover:opacity-100 text-white/40 group-hover:text-primary tracking-wider uppercase text-[7.5px]">Audition</span>
                             )}
                           </div>
                         </div>
                       ) : (
                         <div className="flex-1 mt-2 flex items-center justify-center">
                           <button
                             onClick={() => saveSnapshot(slot)}
                             className="w-full h-8 rounded border border-white/5 bg-white/[0.02] hover:bg-primary/10 hover:border-primary/20 hover:text-primary font-mono text-[9px] uppercase tracking-wider flex items-center justify-center gap-1.5 text-white/40 transition-all outline-none"
                           >
                             <Camera className="w-3 h-3" />
                             <span>Capture State</span>
                           </button>
                         </div>
                       )}

                     </div>
                   );
                 })}
               </div>

             </div>
           </motion.div>
         )}
       </AnimatePresence>

      {/* Mobile Studio Module Selector Bar (lg:hidden) */}
      <div className="lg:hidden flex items-center bg-obsidian-light/95 border-b border-white/10 px-2 py-2 overflow-x-auto custom-scrollbar gap-1.5 shrink-0 z-20">
        {[
          { id: 'dsp', label: 'EQ & Dinâmica', icon: Sliders },
          { id: 'loudness', label: 'Limiter & LUFS', icon: Zap },
          { id: 'tone', label: 'Estéreo & Tom', icon: StereoIcon },
          { id: 'meters', label: 'Espectro & Medição', icon: Activity },
          { id: 'presets', label: 'Presets & IA', icon: Sparkles }
        ].map((tab) => {
          const isActive = mobileMasteringTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setMobileMasteringTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[9px] font-bold uppercase tracking-wider shrink-0 transition-all ${
                isActive
                  ? 'bg-primary text-black shadow-[0_0_10px_#1db954]'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

       <div className="flex-1 min-h-0 grid grid-cols-12 overflow-hidden">
        
        {/* Left Column: Visualizers & Presets */}
        <div className={`col-span-12 lg:col-span-8 p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto custom-scrollbar ${mobileMasteringTab === 'meters' || mobileMasteringTab === 'presets' ? 'block' : 'hidden lg:block'}`}>
          {/* Main Visualizer Area */}
          <section className={`piano-black rounded-xl border border-white/10 p-3.5 sm:p-6 space-y-4 sm:space-y-6 relative overflow-hidden h-60 sm:h-72 lg:h-[390px] flex flex-col ${mobileMasteringTab === 'meters' ? 'flex' : 'hidden lg:flex'}`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 z-10">
              <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                <div className="w-1.5 h-8 sm:h-10 bg-primary shadow-[0_0_15px_#1db954]" />
                <div>
                  <span className="engraved-label text-primary">Master Output</span>
                  <h2 className="text-white font-mono text-base sm:text-2xl tracking-tighter italic uppercase">{t('mastering.spectral_engine')}</h2>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-4 lg:gap-6 flex-wrap justify-end">
                 {(() => {
                   const targetLUFSForMeter = settings.lufsTarget ?? -14;
                   const meterMin = Math.min(-24, Math.floor(targetLUFSForMeter - 6));
                   const meterMax = Math.max(-8, Math.ceil(targetLUFSForMeter + 4));
                   return (
                     <>
                       <VisualMeter label="LUFS-M" value={isEngaged ? meterValues.lufsM : -Infinity} target={targetLUFSForMeter} min={meterMin} max={meterMax} active={isEngaged} />
                       <VisualMeter label="LUFS-I" value={isEngaged ? meterValues.lufsI : -Infinity} target={targetLUFSForMeter} min={meterMin} max={meterMax} active={isEngaged} />
                     </>
                   );
                 })()}
                 <VisualMeter label="TRUE PEAK" value={isEngaged ? meterValues.peak : -Infinity} target={-0.1} min={-6} max={2} unit="dB" active={isEngaged} peakHold={meterValues.peakHold} />
                 <CorrelationMeter value={isEngaged ? meterValues.correlation : 0} active={isEngaged} />
              </div>
            </div>

            <div 
              className="flex-1 relative bg-black/40 rounded border border-white/5 overflow-hidden group"
            >
               <SpectralVisualizer active={isPlaying && !!currentTrack} analyser={nodesRef.current?.analyser} />
               {!currentTrack && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                       <Upload className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-white font-mono text-lg uppercase tracking-widest mb-2">Drop your track to start</h3>
                    <p className="text-white/40 font-mono text-[10px] max-w-[240px] leading-relaxed mb-6">
                       Upload WAV, AIFF or MP3 files, or immediately test with our procedural synthesizer.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                       <button 
                         onClick={() => fileInputRef.current?.click()}
                         className="px-6 py-2.5 bg-white/5 border border-white/10 rounded-full text-white/80 font-mono text-[10px] uppercase tracking-widest hover:bg-white/15 transition-all shadow-lg active:scale-95"
                       >
                          Select Audio File
                       </button>
                       <button 
                         onClick={loadDemoTrack}
                         disabled={isLoadingAudio}
                         className="px-6 py-2.5 bg-primary/20 border border-primary/30 rounded-full text-primary font-mono text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-on-primary hover:border-primary transition-all shadow-lg active:scale-95"
                       >
                          {isLoadingAudio ? 'Synthesizing...' : 'Load Audio Demo'}
                       </button>
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      accept="audio/*" 
                      className="hidden" 
                    />
                 </div>
               )}
               {currentTrack && (
                 <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                    <div className="flex gap-2">
                       <span className="px-2 py-1 bg-black/60 rounded text-[8px] font-mono text-white/40 border border-white/5 uppercase tracking-widest">
                          {currentTrack.name}
                       </span>
                       <span className="px-2 py-1 bg-black/60 rounded text-[8px] font-mono text-white/40 border border-white/5 uppercase tracking-widest">
                          {audioBuffer ? `${audioBuffer.sampleRate}Hz` : '---'}
                       </span>
                    </div>
                    
                    <div className="flex gap-2">
                       <div className="flex bg-black/60 rounded-lg p-1 border border-white/5 shadow-2xl">
                          <button 
                            onClick={() => setIsEngaged(false)}
                            className={`px-3 py-1 rounded font-mono text-[9px] uppercase tracking-widest transition-all ${!isEngaged ? 'bg-white/10 text-white shadow-inner' : 'text-white/20 hover:text-white/40'}`}
                          >
                            {t('mastering.original')}
                          </button>
                          <button 
                            onClick={() => setIsEngaged(true)}
                            className={`px-3 py-1 rounded font-mono text-[9px] uppercase tracking-widest transition-all ${isEngaged ? 'bg-primary/20 text-primary shadow-[0_0_15px_rgba(29,185,84,0.3)]' : 'text-white/20 hover:text-white/40'}`}
                          >
                            {t('mastering.master')}
                          </button>

                          <button
                            onClick={() => setAutoGainMatch(!autoGainMatch)}
                            title={autoGainMatch ? `Auto-Gain Ativo: Atenuando -${autoGainOffsetDb} dB no masterizado para equiparar o volume ao original` : "Auto-Gain Inativo: Clique para igualar o volume percebido no teste A/B"}
                            className={`px-2.5 py-1 rounded font-mono text-[8px] uppercase tracking-wider border transition-all flex items-center gap-1.5 ${
                              autoGainMatch 
                                ? 'bg-amber/20 text-amber border-amber/40 shadow-[0_0_12px_rgba(255,170,0,0.3)] font-bold' 
                                : 'bg-white/5 text-white/30 border-white/5 hover:text-white/60'
                            }`}
                          >
                            <Scale className="w-2.5 h-2.5" />
                            <span>Match {autoGainMatch && autoGainOffsetDb > 0 ? `-${autoGainOffsetDb}dB` : 'Gain'}</span>
                          </button>
                       </div>

                       <button 
                         onClick={() => setShowEditor(true)}
                         className="flex items-center gap-2 px-3 py-1 bg-primary/20 hover:bg-primary/40 border border-primary/20 rounded text-[8px] font-mono text-primary uppercase tracking-widest transition-all"
                       >
                          <Layers className="w-3 h-3" />
                          Edit Track
                       </button>
                    </div>
                 </div>
               )}

               {/* Waveform Player Bar */}
               {audioBuffer && (
                 <div className="absolute inset-x-0 bottom-0 bg-black/80 backdrop-blur-md border-t border-white/5 px-6 py-3 flex items-center gap-6">
                    <button 
                      onClick={togglePlayback}
                      className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shadow-lg hover:scale-110 active:scale-95 transition-all"
                    >
                      {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
                    </button>

                    <div className="flex-1 flex flex-col gap-1">
                       <div className="flex justify-between items-center text-[8px] font-mono uppercase tracking-widest text-white/30">
                          <span>{formatPlaybackTime(currentTime)}</span>
                          <span>{formatPlaybackTime(audioBuffer.duration)}</span>
                       </div>
                       <input 
                         type="range"
                         min="0"
                         max={audioBuffer.duration}
                         step="0.01"
                         value={currentTime}
                         onChange={handleLocalSeek}
                         className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary"
                       />
                    </div>

                    <div className="flex items-center gap-3">
                       <button 
                         onClick={() => updateSettings({ masterVolume: settings.masterVolume === 0 ? 1 : 0 })}
                         className="text-white/40 hover:text-white transition-colors"
                       >
                         {settings.masterVolume === 0 ? <VolumeX className="w-4 h-4" /> : settings.masterVolume < 0.5 ? <Volume1 className="w-4 h-4" /> : <VolumeIcon className="w-4 h-4" />}
                       </button>
                       <input 
                         type="range"
                         min="0"
                         max="1.5"
                         step="0.01"
                         value={settings.masterVolume}
                         onChange={(e) => updateSettings({ masterVolume: parseFloat(e.target.value) })}
                         className="w-20 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary"
                       />
                    </div>
                 </div>
               )}

               {isLoadingAudio && (
                 <div className="absolute inset-0 bg-obsidian-light/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                    <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                    <p className="font-mono text-[10px] text-white/60 uppercase tracking-widest animate-pulse">Mounting Audio Core...</p>
                 </div>
               )}
            </div>

            <AnimatePresence>
               {showEditor && (
                 <AudioEditor onClose={() => setShowEditor(false)} />
               )}
            </AnimatePresence>

            <div className="flex justify-between items-center z-10 pt-4 border-t border-white/5">
               <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                     <span className="font-mono text-[9px] text-white/40 uppercase">Phase</span>
                     <div className="w-32 h-1 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                           animate={{ width: isEngaged ? '88%' : '10%' }}
                           className="h-full bg-primary"
                        />
                     </div>
                  </div>
                  <div className="flex items-center gap-2">
                     <span className="font-mono text-[9px] text-white/40 uppercase">Stereo</span>
                     <div className="w-32 h-1 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                           animate={{ width: isEngaged ? '65%' : '5%' }}
                           className="h-full bg-amber"
                        />
                     </div>
                  </div>
               </div>
               <span className="font-mono text-[10px] text-primary font-bold animate-pulse">DSP ACTIVE 32-BIT FLOAT</span>
            </div>
          </section>

          {/* Dynamic Parameter Automation Studio */}
          <AnimatePresence>
             {showAutomation && (
                <motion.div
                   initial={{ opacity: 0, height: 0 }}
                   animate={{ opacity: 1, height: 'auto' }}
                   exit={{ opacity: 0, height: 0 }}
                   className="overflow-hidden mb-6"
                >
                   <AutomationStudio
                      onClose={() => setShowAutomation(false)}
                      automationMode={automationMode}
                      setAutomationMode={setAutomationMode}
                      tracks={automationTracks}
                      setTracks={setAutomationTracks}
                      activeParam={activeAutomationParam}
                      setActiveParam={setActiveAutomationParam}
                   />
                </motion.div>
             )}
          </AnimatePresence>

          {/* Presets Grid & EQ/Compression Preset Hub */}
          <section className={`space-y-4 ${mobileMasteringTab === 'presets' ? 'block' : 'hidden lg:block'}`}>
             <div className="flex items-center justify-between">
                <h3 className="engraved-label text-white/40 italic">Global Presets & Tone Curves</h3>
                <div className="h-px flex-1 mx-6 bg-white/5" />
             </div>

             {/* Dedicated EQ and Compression Preset Dropdown */}
             <div className="p-3 bg-black/40 rounded-2xl border border-white/5 space-y-2">
                <div className="flex items-center justify-between px-1">
                   <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-primary font-bold">EQ & Compression Configurations</span>
                      <span className="font-mono text-[7.5px] text-white/30 hidden sm:inline">(Quick-Apply Spectral Curve & Dynamic Glue)</span>
                   </div>
                   <span className="font-mono text-[7.5px] uppercase tracking-widest text-white/40 font-semibold bg-white/5 px-2 py-0.5 rounded border border-white/5">
                      Presets Dropdown
                   </span>
                </div>
                <EqCompPresetDropdown onPresetApplied={(name) => setActivePreset(name)} />
             </div>

             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {mainPresets.map(preset => (
                   <PresetButton 
                     key={preset} 
                     label={preset} 
                     active={activePreset === preset}
                     onClick={() => applyGenrePreset(preset)}
                   />
                ))}
             </div>
             <button 
               onClick={() => setShowMorePresets(!showMorePresets)}
               className="w-full py-3 bg-white/5 border border-white/5 rounded flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.4em] text-white/40 hover:bg-white/10 hover:text-white transition-all"
             >
                <Plus className="w-3 h-3" />
                More Presets
             </button>
             
             <AnimatePresence>
                {showMorePresets && (
                   <motion.div 
                     initial={{ height: 0, opacity: 0 }}
                     animate={{ height: 'auto', opacity: 1 }}
                     exit={{ height: 0, opacity: 0 }}
                     className="overflow-hidden"
                   >
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-white/5">
                         {morePresets.map(preset => (
                            <button 
                              key={preset}
                              onClick={() => { applyGenrePreset(preset); setShowMorePresets(false); }}
                              className="py-2 text-[9px] font-mono uppercase text-white/30 hover:text-primary transition-colors text-left pl-2"
                            >
                               {preset}
                            </button>
                         ))}
                      </div>
                   </motion.div>
                )}
             </AnimatePresence>
          </section>

          {/* Neural Parameter Suggester Section */}
          <section className={`space-y-4 border-t border-white/5 pt-6 ${mobileMasteringTab === 'presets' ? 'block' : 'hidden lg:block'}`}>
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <h3 className="engraved-label text-white/40 italic">Neural Parametric Suggester</h3>
                   <span className="font-mono text-[8px] bg-emerald-500/15 border border-emerald-500/25 text-primary px-1.5 py-0.5 rounded tracking-widest">AI MATCH CORE</span>
                </div>
                <div className="h-px flex-1 mx-6 bg-white/5" />
             </div>

             <div className="hardware-panel p-5 rounded-2xl bg-black/30 border border-white/5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <label className="engraved-label text-[8px] text-white/30 block uppercase tracking-widest">Target Genre</label>
                      <select
                        value={selectedSuggesterGenre}
                        onChange={(e) => setSelectedSuggesterGenre(e.target.value)}
                        className="w-full bg-black/60 text-white font-mono text-[11px] py-2 px-3 rounded-lg border border-white/10 focus:outline-hidden focus:border-primary/50"
                      >
                         {AI_DOMINANT_GENRES.map((g) => (
                           <option key={g} value={g} className="bg-obsidian text-white">{g}</option>
                         ))}
                      </select>
                   </div>
                   
                   <div className="space-y-1">
                      <label className="engraved-label text-[8px] text-white/30 block uppercase tracking-widest">Acoustic / Energy Profile</label>
                      <select
                        value={selectedSuggesterAudioType}
                        onChange={(e) => setSelectedSuggesterAudioType(e.target.value)}
                        className="w-full bg-black/60 text-white font-mono text-[11px] py-2 px-3 rounded-lg border border-white/10 focus:outline-hidden focus:border-primary/50"
                      >
                         {AI_AUDIO_TYPES.map((a) => (
                           <option key={a} value={a} className="bg-obsidian text-white">{a}</option>
                         ))}
                      </select>
                   </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                   <button
                     onClick={fetchParametersSuggestion}
                     disabled={loadingSuggester}
                     className="flex-1 py-2.5 bg-primary/20 hover:bg-primary/30 border border-primary/30 disabled:border-white/5 disabled:bg-white/5 disabled:text-white/20 text-primary rounded-xl font-mono text-[9px] font-black uppercase tracking-widest transition-all hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer border-none"
                   >
                      {loadingSuggester ? (
                         <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                         <Sparkles className="w-3.5 h-3.5 animate-pulse text-primary" />
                      )}
                      <span>{loadingSuggester ? 'Analyzing Signature...' : 'Solve Optimal Parameters'}</span>
                   </button>
                </div>

                {suggesterError && (
                   <div className="p-3 rounded-lg bg-scarlet/10 border border-scarlet/20 text-scarlet font-mono text-[9px] leading-relaxed">
                      {suggesterError}
                   </div>
                )}                {/* Suggested Results Display */}
                {suggestedParameters && (() => {
                  const originalSettingsSource = (isSuggesterAuditionMode && preSuggestionUserSettings) ? preSuggestionUserSettings : settings;
                  return (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4 pt-3 border-t border-white/5"
                    >
                       {/* Strategic Summary */}
                       <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/10">
                          <div className="flex items-center gap-2 mb-1.5">
                             <Sparkles className="w-3.5 h-3.5 text-primary" />
                             <span className="font-mono text-[9px] font-bold uppercase text-primary tracking-widest">Neural Master Plan</span>
                          </div>
                          <p className="text-[11px] text-white/70 leading-relaxed font-sans italic">
                             "{suggestedParameters.explanation}"
                          </p>
                       </div>

                       {/* Real-time A/B Audition Comparison Controller */}
                       <div id="neural-ab-audition" className="bg-black/50 border border-white/10 rounded-xl p-4 space-y-3.5 shadow-xl relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10">
                             <div className="space-y-0.5">
                                <label className="engraved-label text-[8px] text-white/30 uppercase tracking-widest block font-bold">Audition Validator</label>
                                <span className="text-[10px] text-white/60 font-mono tracking-tight block">
                                   {isSuggesterAuditionMode 
                                      ? `AUDITIONING CHANNEL ${currentAuditionSlot === 'B' ? 'B (AI SUGGESTED)' : 'A (MY ORIGINAL DESIGN)'}`
                                      : "Select a channel to preview of comparisons in real-time:"}
                                </span>
                             </div>

                             <div className="flex items-center gap-1.5 self-stretch sm:self-auto bg-black/40 border border-white/5 p-1 rounded-xl">
                                <button
                                  type="button"
                                  onClick={() => startABCompare('A')}
                                  className={`flex-1 sm:flex-initial py-2 px-4 rounded-lg font-mono text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer ${
                                    isSuggesterAuditionMode && currentAuditionSlot === 'A'
                                      ? 'bg-white/10 border border-white/20 text-white shadow-md'
                                      : 'hover:text-white/80 text-white/40 border border-transparent'
                                  }`}
                                >
                                   [A] My Sound
                                </button>
                                <div className="text-[10px] font-mono font-black text-white/20 px-1 select-none">VS</div>
                                <button
                                  type="button"
                                  onClick={() => startABCompare('B')}
                                  className={`flex-1 sm:flex-initial py-2 px-4 rounded-lg font-mono text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                    isSuggesterAuditionMode && currentAuditionSlot === 'B'
                                      ? 'bg-primary border border-primary text-on-primary shadow-[0_0_15px_rgba(29,185,84,0.3)]'
                                      : 'hover:text-primary/90 text-primary/50 border border-transparent'
                                  }`}
                                >
                                   <Sparkles className="w-3.5 h-3.5" />
                                   [B] AI suggested
                                </button>
                             </div>
                          </div>

                          {/* Live Audition Notification Ribbon */}
                          {isSuggesterAuditionMode && (
                             <div className="bg-black/60 border border-white/5 p-3 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in z-10 relative">
                                <div className="flex items-center gap-2.5">
                                   <span className="relative flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                   </span>
                                   <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-400">
                                      Live Audition Active: Playing {currentAuditionSlot === 'B' ? 'Acoustic Model [B]' : 'My Original Layout [A]'}
                                   </span>
                                </div>
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                   <button
                                     type="button"
                                     onClick={() => commitABSettings(false)}
                                     className="flex-1 sm:flex-initial py-1 text-[8px] font-mono uppercase bg-white/5 hover:bg-white/10 text-white/70 px-2.5 rounded border border-white/10 transition-colors cursor-pointer"
                                   >
                                      Discard [B]
                                   </button>
                                   <button
                                     type="button"
                                     onClick={() => commitABSettings(true)}
                                     className="flex-1 sm:flex-initial py-1 text-[8px] font-mono uppercase bg-primary/20 hover:bg-primary/30 text-primary px-2.5 rounded border border-primary/30 transition-colors cursor-pointer"
                                   >
                                      Accept Suggested [B]
                                   </button>
                                </div>
                             </div>
                          )}
                       </div>

                       {/* Side-by-side Parameter Blueprint comparison */}
                       <div className="bg-black/40 rounded-xl p-4 border border-white/5 space-y-3">
                          <span className="engraved-label text-[7.5px] text-white/20 block uppercase tracking-wide">Target Specs Comparison</span>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5 text-left">
                             <SuggestedParameterRow 
                               label="Low Shelf EQ Gain" 
                               current={`${originalSettingsSource.eq.low.gain > 0 ? '+' : ''}${originalSettingsSource.eq.low.gain.toFixed(1)} dB`} 
                               target={`${suggestedParameters.eq.lowGain > 0 ? '+' : ''}${suggestedParameters.eq.lowGain.toFixed(1)} dB`} 
                             />
                             <SuggestedParameterRow 
                               label="Mid Peaking EQ Gain" 
                               current={`${originalSettingsSource.eq.mid.gain > 0 ? '+' : ''}${originalSettingsSource.eq.mid.gain.toFixed(1)} dB`} 
                               target={`${suggestedParameters.eq.midGain > 0 ? '+' : ''}${suggestedParameters.eq.midGain.toFixed(1)} dB`} 
                             />
                             <SuggestedParameterRow 
                               label="High Air EQ Gain" 
                               current={`${originalSettingsSource.eq.high.gain > 0 ? '+' : ''}${originalSettingsSource.eq.high.gain.toFixed(1)} dB`} 
                               target={`${suggestedParameters.eq.highGain > 0 ? '+' : ''}${suggestedParameters.eq.highGain.toFixed(1)} dB`} 
                             />
                             <SuggestedParameterRow 
                               label="Glue Compression" 
                               current={`${originalSettingsSource.compression}%`} 
                               target={`${suggestedParameters.compression}%`} 
                             />
                             <SuggestedParameterRow 
                               label="Tape Saturation" 
                               current={`${originalSettingsSource.saturation}%`} 
                               target={`${suggestedParameters.saturation}%`} 
                             />
                             <SuggestedParameterRow 
                               label="Harmonic Exciter" 
                               current={`${originalSettingsSource.exciter.amount}%`} 
                               target={`${suggestedParameters.exciterAmount ?? 0}%`} 
                             />
                             <SuggestedParameterRow 
                               label="Stereo Width" 
                               current={`${(originalSettingsSource.stereoWidthL).toFixed(0)}%`} 
                               target={`${(suggestedParameters.stereoWidth * 100).toFixed(0)}%`} 
                             />
                             <SuggestedParameterRow 
                               label="Brickwall Limiter / Target" 
                               current={`${originalSettingsSource.limiter.toFixed(1)} dB / ${originalSettingsSource.lufsTarget} LUFS`} 
                               target={`${suggestedParameters.limiter.toFixed(1)} dB / ${suggestedParameters.lufsTarget} LUFS`} 
                             />
                          </div>
                       </div>

                       {/* Action Triggers */}
                       <div className="flex flex-col sm:flex-row gap-3 pt-2">
                          <button
                            type="button"
                            onClick={applySuggesterParameters}
                            className={`flex-1 py-3 px-4 rounded-xl font-mono text-[10px] font-black uppercase tracking-widest transition-all hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer ${
                              suggesterAppliedToast
                                ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] border-none'
                                : 'bg-primary text-on-primary hover:brightness-110 shadow-[0_0_20px_rgba(29,185,84,0.2)] border-none'
                            }`}
                          >
                             <Check className="w-3.5 h-3.5" />
                             <span>{suggesterAppliedToast ? 'Suggested Values Applied!' : 'Load suggested specs to console'}</span>
                          </button>

                          <div className="flex items-center gap-1.5 justify-end">
                             <span className="font-mono text-[8px] text-white/30 uppercase tracking-wider pr-1">Direct to Snapshot:</span>
                             {['A', 'B', 'C', 'D'].map((slot) => (
                                <button
                                  key={slot}
                                  type="button"
                                  onClick={() => saveSuggestedToSnapshotSlot(slot)}
                                  title={`Directly route these parameters to Compare Slot ${slot}`}
                                  className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 hover:border-primary/40 hover:text-primary text-white/60 font-mono text-xs font-black transition-colors flex items-center justify-center cursor-pointer"
                                >
                                   {slot}
                                </button>
                             ))}
                          </div>
                       </div>
                    </motion.div>
                  );
                })()}
             </div>
          </section>

          {/* Custom Presets / Memory Banks */}
          <section className={`space-y-4 border-t border-white/5 pt-6 ${mobileMasteringTab === 'presets' ? 'block' : 'hidden lg:block'}`}>
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <h3 className="engraved-label text-white/40 italic">Custom Preset Ware</h3>
                   <span className="font-mono text-[8px] bg-primary/10 border border-primary/20 text-primary px-1.5 py-0.5 rounded tracking-widest">USER MEMORY</span>
                </div>
                <div className="h-px flex-1 mx-6 bg-white/5" />
             </div>

             <div className="hardware-panel p-5 rounded-2xl bg-black/30 border border-white/5 space-y-4">
                {/* Store Action */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                   <div className="flex-1 space-y-1">
                      <label className="engraved-label text-[8px] text-white/30 block uppercase tracking-widest">Store Current Console State</label>
                      <input 
                        type="text"
                        value={newPresetName}
                        onChange={(e) => setNewPresetName(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()} // Stop keyboard shortcut interference
                        placeholder="e.g. WARM TAPE SUB-BOOST"
                        className="w-full bg-black/60 text-white font-mono text-[10px] py-2 px-3 rounded-lg border border-white/10 focus:outline-hidden focus:border-primary/50 placeholder:text-white/20 uppercase"
                      />
                   </div>
                   <button
                     onClick={handleSavePreset}
                     disabled={!newPresetName.trim()}
                     className="px-5 py-2 bg-primary/15 hover:bg-primary/25 border border-primary/20 disabled:border-white/5 disabled:bg-white/5 disabled:text-white/20 text-primary rounded-lg font-mono text-[9px] font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                   >
                      <Save className="w-3.5 h-3.5" />
                      Store Preset
                   </button>
                </div>

                {/* Preset List */}
                {presets.length === 0 ? (
                   <div className="py-5 border border-dashed border-white/10 rounded-lg flex flex-col items-center justify-center text-center">
                      <Sliders className="w-5 h-5 text-white/15 mb-1.5" />
                      <p className="font-mono text-[9px] text-white/25 uppercase tracking-widest">No User presets found in this bank</p>
                      <p className="text-[8px] text-white/15 uppercase tracking-widest mt-0.5">Tweak console parameters and save them above</p>
                   </div>
                ) : (
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                      {presets.map((preset) => {
                         const isCurrent = activeCustomPresetId === preset.id;
                         return (
                            <div 
                              key={preset.id}
                              className={`group relative flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                                isCurrent 
                                  ? 'bg-primary/10 border-primary/35 text-white shadow-[0_0_8px_rgba(29,185,84,0.1)]' 
                                  : 'bg-black/45 border-white/5 hover:border-white/20 hover:bg-black/60 text-white/70'
                              }`}
                            >
                               <div 
                                 onClick={() => handleLoadPreset(preset)}
                                 className="flex-1 text-left cursor-pointer space-y-1 pr-6"
                               >
                                  <p className="font-mono text-[10px] font-bold uppercase tracking-wider truncate">
                                     {preset.name}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-x-2 text-[8px] font-mono text-white/30 uppercase">
                                     <span>LUFS: {(preset.settings.lufsTarget ?? -14).toFixed(1)}</span>
                                     <span>•</span>
                                     <span>GAIN: {preset.settings.gain >= 0 ? '+' : ''}{preset.settings.gain.toFixed(1)}dB</span>
                                  </div>
                               </div>

                               <button
                                 onClick={() => deletePreset(preset.id)}
                                 className="opacity-0 group-hover:opacity-100 focus:opacity-100 absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-scarlet/15 text-white/35 hover:text-scarlet transition-all duration-150 cursor-pointer"
                                 title="Delete Preset"
                               >
                                  <Trash2 className="w-3.5 h-3.5" />
                               </button>
                            </div>
                         );
                      })}
                   </div>
                )}
             </div>
          </section>

          {/* Detailed Meters Grid */}
          <div className={`grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6 ${mobileMasteringTab === 'meters' ? 'grid' : 'hidden lg:grid'}`}>
             <LevelMeter label="Spotify" target="-14" current={isEngaged ? meterValues.lufsI.toFixed(1) : (settings.lufsTarget ?? -14.2).toFixed(1)} status={isEngaged && meterValues.lufsI > -14 ? "Over (-14 max)" : "Optimized"} color={isEngaged && meterValues.lufsI > -14 ? "scarlet" : "primary"} />
             <LevelMeter label="Apple Music" target="-16" current={isEngaged ? meterValues.lufsI.toFixed(1) : (settings.lufsTarget ?? -14.2).toFixed(1)} status={isEngaged && meterValues.lufsI > -16 ? "Volume Penalty" : "Optimized"} color={isEngaged && meterValues.lufsI > -16 ? "amber" : "primary"} />
             <LevelMeter label="YouTube" target="-13" current={isEngaged ? meterValues.lufsI.toFixed(1) : (settings.lufsTarget ?? -14.2).toFixed(1)} status={isEngaged && meterValues.lufsI > -13 ? "Clipping Risk" : "Optimized"} color={isEngaged && meterValues.lufsI > -13 ? "scarlet" : "primary"} />
          </div>
        </div>

        {/* Right Column: Workstation Controls */}
        <aside className={`col-span-12 lg:col-span-4 border-l border-white/5 bg-obsidian-light/50 p-4 sm:p-6 overflow-y-auto custom-scrollbar relative ${mobileMasteringTab === 'dsp' || mobileMasteringTab === 'loudness' || mobileMasteringTab === 'tone' ? 'block' : 'hidden lg:block'}`}>
           <div className="absolute inset-0 pointer-events-none sticky top-0 left-0 w-full h-full z-0 overflow-hidden opacity-30">
              <WorkstationBackgroundWaveform />
           </div>
           <div className="space-y-10 pb-8 relative z-10">
              <div className="flex flex-col gap-1">
                 <span className="engraved-label text-primary">Mastering Core</span>
                 <h1 className="text-white font-mono text-xl tracking-tight italic uppercase">Processing Console</h1>
              </div>

              {/* DSP MODULES (EQ & Dinâmica) */}
              <div className={`space-y-10 ${mobileMasteringTab === 'dsp' ? 'block' : 'hidden lg:block'}`}>
                 {/* Master EQ & Compression Preset Dropdown */}
                 <div className="space-y-2 p-3 bg-black/40 rounded-2xl border border-white/5 shadow-inner">
                 <div className="flex items-center justify-between px-1">
                    <span className="font-mono text-[8.5px] uppercase tracking-widest text-white/40 font-semibold">Master Preset Hub</span>
                    <span className="font-mono text-[7.5px] text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 uppercase tracking-widest font-bold">EQ + COMP</span>
                 </div>
                 <EqCompPresetDropdown onPresetApplied={(name) => setActivePreset(name)} />
              </div>

              {/* Console Modules */}
              <ConsoleModule label="Gain Staging" icon={Activity}>
                 <div className="flex items-center justify-between mb-1.5 px-0.5">
                    <span className="font-mono text-[8px] uppercase tracking-widest text-white/40">Gain Staging</span>
                    <div className="flex items-center gap-1.5">
                       {automationMode === 'read' && (automationTracks['gain']?.points.length ?? 0) > 0 && (
                          <span className="font-mono text-[7px] bg-primary/20 text-primary border border-primary/30 px-1.5 py-0.2 rounded font-bold uppercase tracking-wider">
                             Auto: Read
                          </span>
                       )}
                       {automationMode === 'write' && (
                          <span className="font-mono text-[7px] bg-red-600/20 text-red-400 border border-red-500/30 px-1.5 py-0.2 rounded font-bold uppercase tracking-wider animate-pulse">
                             Auto: Rec
                          </span>
                       )}
                    </div>
                 </div>
                 <Slider 
                   label="Input Gain" 
                   value={settings.gain} 
                   onChange={(v) => {
                      updateSettings({ gain: v });
                      if (automationMode === 'write') handleRecordParam('gain', v);
                   }} 
                   min={-12} 
                   max={12} 
                   unit="dB" 
                 />
                 <div className="mt-4 pt-3.5 border-t border-white/5 flex flex-col gap-2">
                    <div className="flex items-center justify-between font-mono text-[9px]">
                       <span className="text-white/40 uppercase tracking-widest font-semibold text-[8px]">Track Peak Input</span>
                       <span className="text-white font-bold">
                          {calculatedPeak !== null ? `${calculatedPeak} dBFS` : 'No track loaded'}
                       </span>
                    </div>
                    <button
                       type="button"
                       disabled={calculatedPeak === null}
                       onClick={handleAutoGain}
                       className={`w-full py-2 px-3 rounded-xl font-mono text-[9px] font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 border ${
                          calculatedPeak === null 
                             ? 'bg-white/2 text-white/20 border-white/5 cursor-not-allowed' 
                             : autoGainApplied 
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                                : 'bg-primary/15 hover:bg-primary/25 text-primary border-primary/20 hover:border-primary/40'
                       }`}
                    >
                       <Sparkles className={`w-3 h-3 ${calculatedPeak !== null && !autoGainApplied ? 'animate-pulse text-primary' : ''}`} />
                       {autoGainApplied ? 'Matched to -12 dBFS Peak!' : '⚡ Apply Auto-Gain (-12dBFS)'}
                    </button>
                 </div>
              </ConsoleModule>

              <ConsoleModule label="Dynamic Glue" icon={Zap}>
                 <Slider 
                   label="Compression" 
                   value={settings.compression} 
                   onChange={(v) => updateSettings({ compression: v })} 
                   min={0} 
                   max={100} 
                   unit="%" 
                 />
              </ConsoleModule>

              <ConsoleModule label="Dynamic Control" icon={Waves}>
                 <div className="space-y-4">
                    {(['low', 'mid', 'high'] as const).map((band) => (
                       <div key={band} className="pt-3 border-t border-white/5 first:border-0 first:pt-0">
                          <div className="flex justify-between items-center mb-3 px-1">
                             <span className="text-[9px] font-mono text-primary uppercase tracking-[0.2em] font-black">{band} Dynamics</span>
                             <div className="flex gap-1">
                                {[1,2,3,4,5].map(i => (
                                   <div key={i} className={`w-1 h-3 rounded-xs ${isEngaged && Math.random() > 0.5 ? 'bg-primary/40' : 'bg-white/5'}`} />
                                ))}
                             </div>
                          </div>
                          <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                             <div className="grid grid-cols-3 gap-2 mb-4">
                                <Knob 
                                  label="Threshold" 
                                  min={-60} max={0} 
                                  value={settings.dynamics[band].threshold} 
                                  onChange={(v) => updateSettings({ dynamics: { ...settings.dynamics, [band]: { ...settings.dynamics[band], threshold: v } } })} 
                                  unit="dB" 
                                />
                                <Knob 
                                  label="Ratio" 
                                  min={1} max={10} 
                                  value={settings.dynamics[band].ratio} 
                                  onChange={(v) => updateSettings({ dynamics: { ...settings.dynamics, [band]: { ...settings.dynamics[band], ratio: v } } })} 
                                  unit=":1" 
                                />
                                <Knob 
                                  label="Makeup" 
                                  min={0} max={12} 
                                  value={settings.dynamics[band].gain} 
                                  onChange={(v) => updateSettings({ dynamics: { ...settings.dynamics, [band]: { ...settings.dynamics[band], gain: v } } })} 
                                  unit="dB" 
                                />
                             </div>
                             <div className="space-y-3">
                                <Slider 
                                  label="Attack" 
                                  min={0.1} max={100} 
                                  value={settings.dynamics[band].attack} 
                                  onChange={(v) => updateSettings({ dynamics: { ...settings.dynamics, [band]: { ...settings.dynamics[band], attack: v } } })} 
                                  unit="ms" 
                                />
                                <Slider 
                                  label="Release" 
                                  min={10} max={500} 
                                  value={settings.dynamics[band].release} 
                                  onChange={(v) => updateSettings({ dynamics: { ...settings.dynamics, [band]: { ...settings.dynamics[band], release: v } } })} 
                                  unit="ms" 
                                />
                             </div>
                          </div>
                       </div>
                    ))}
                 </div>
              </ConsoleModule>

              <ConsoleModule label="Tone & Clarity" icon={AlignJustify}>
                 <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    {/* View Mode Switcher */}
                    <div className="flex items-center gap-1 bg-black/50 p-1 rounded-lg border border-white/10 shadow-inner">
                       <button
                         type="button"
                         onClick={() => setSpectralViewMode('eq')}
                         className={`px-2.5 py-1 rounded-md text-[8px] font-mono font-bold uppercase transition-all cursor-pointer ${
                           spectralViewMode === 'eq'
                             ? 'bg-primary text-black shadow-[0_0_10px_rgba(29,185,84,0.4)]'
                             : 'text-white/50 hover:text-white hover:bg-white/5'
                         }`}
                       >
                         EQ + FFT
                       </button>
                       <button
                         type="button"
                         onClick={() => setSpectralViewMode('fft')}
                         className={`px-2.5 py-1 rounded-md text-[8px] font-mono font-bold uppercase transition-all cursor-pointer flex items-center gap-1 ${
                           spectralViewMode === 'fft'
                             ? 'bg-primary text-black shadow-[0_0_10px_rgba(29,185,84,0.4)]'
                             : 'text-white/50 hover:text-white hover:bg-white/5'
                         }`}
                       >
                         <Activity className="w-2.5 h-2.5" />
                         <span>FFT Clash Monitor</span>
                       </button>
                       <button
                         type="button"
                         onClick={() => setSpectralViewMode('split')}
                         className={`px-2.5 py-1 rounded-md text-[8px] font-mono font-bold uppercase transition-all cursor-pointer ${
                           spectralViewMode === 'split'
                             ? 'bg-primary text-black shadow-[0_0_10px_rgba(29,185,84,0.4)]'
                             : 'text-white/50 hover:text-white hover:bg-white/5'
                         }`}
                       >
                         Dual View
                       </button>
                    </div>

                    {/* Spectral Presets */}
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
                       <span className="text-[7px] font-mono text-white/20 uppercase tracking-widest mr-1">Presets</span>
                       {eqPresets.map(preset => (
                         <button
                           key={preset.name}
                           onClick={() => applyEQPreset(preset.values)}
                           className="px-2 py-0.5 rounded-sm bg-white/5 border border-white/5 text-[7px] font-mono text-white/40 hover:bg-primary/20 hover:text-primary hover:border-primary/30 transition-all uppercase whitespace-nowrap cursor-pointer"
                         >
                           {preset.name}
                         </button>
                       ))}
                    </div>
                 </div>

                 {/* Mode 1: Standard Parametric EQ Visualizer with live FFT overlay */}
                 {spectralViewMode === 'eq' && (
                    <div className="mb-4 h-52 bg-black/60 rounded-xl border border-white/10 overflow-hidden relative shadow-inner">
                       <InteractiveEQVisualizer 
                         active={isEngaged} 
                         eq={settings.eq as any}
                         onChangeEq={(newEq) => {
                            updateSettings({ eq: newEq });
                            if (automationMode === 'write') {
                               if (newEq.low?.gain !== undefined) handleRecordParam('eq.low', newEq.low.gain);
                               if (newEq.lowMid?.gain !== undefined) handleRecordParam('eq.lowMid', newEq.lowMid.gain);
                               if (newEq.mid?.gain !== undefined) handleRecordParam('eq.mid', newEq.mid.gain);
                               if (newEq.highMid?.gain !== undefined) handleRecordParam('eq.highMid', newEq.highMid.gain);
                               if (newEq.high?.gain !== undefined) handleRecordParam('eq.high', newEq.high.gain);
                               if (newEq.hpf !== undefined) handleRecordParam('eq.hpf', newEq.hpf);
                               if (newEq.lpf !== undefined) handleRecordParam('eq.lpf', newEq.lpf);
                            }
                         }}
                       />
                    </div>
                 )}

                 {/* Mode 2: Full-Featured High-Res FFT Spectrum Visualizer & Clash Monitor */}
                 {spectralViewMode === 'fft' && (
                    <div className="mb-4">
                       <FFTSpectrumVisualizer />
                    </div>
                 )}

                 {/* Mode 3: Dual View (Both FFT Clash Monitor & Parametric EQ stacked) */}
                 {spectralViewMode === 'split' && (
                    <div className="mb-4 space-y-3">
                       <FFTSpectrumVisualizer />
                       <div className="h-44 bg-black/60 rounded-xl border border-white/10 overflow-hidden relative shadow-inner">
                          <InteractiveEQVisualizer 
                            active={isEngaged} 
                            eq={settings.eq as any}
                            onChangeEq={(newEq) => {
                               updateSettings({ eq: newEq });
                               if (automationMode === 'write') {
                                  if (newEq.low?.gain !== undefined) handleRecordParam('eq.low', newEq.low.gain);
                                  if (newEq.lowMid?.gain !== undefined) handleRecordParam('eq.lowMid', newEq.lowMid.gain);
                                  if (newEq.mid?.gain !== undefined) handleRecordParam('eq.mid', newEq.mid.gain);
                                  if (newEq.highMid?.gain !== undefined) handleRecordParam('eq.highMid', newEq.highMid.gain);
                                  if (newEq.high?.gain !== undefined) handleRecordParam('eq.high', newEq.high.gain);
                                  if (newEq.hpf !== undefined) handleRecordParam('eq.hpf', newEq.hpf);
                                  if (newEq.lpf !== undefined) handleRecordParam('eq.lpf', newEq.lpf);
                               }
                            }}
                          />
                       </div>
                    </div>
                 )}
                 <div className="space-y-6">
                    {/* Filters Row */}
                    <div className="grid grid-cols-2 gap-4 bg-white/5 p-3 rounded-lg border border-white/5">
                       <Knob 
                         label="High Pass" 
                         min={20} max={500} 
                         value={settings.eq.hpf} 
                         onChange={(v) => {
                            updateSettings({ eq: { ...settings.eq, hpf: v } });
                            if (automationMode === 'write') handleRecordParam('eq.hpf', v);
                         }} 
                         unit="Hz" 
                       />
                       <Knob 
                         label="Low Pass" 
                         min={5000} max={20000} 
                         value={settings.eq.lpf} 
                         onChange={(v) => {
                            updateSettings({ eq: { ...settings.eq, lpf: v } });
                            if (automationMode === 'write') handleRecordParam('eq.lpf', v);
                         }} 
                         unit="Hz" 
                       />
                    </div>

                    <div className="h-px bg-white/5 mx-2" />

                    {/* Main Bands */}
                    <div className="space-y-4">
                       {[
                         { label: 'Low', path: 'low', color: 'text-primary' },
                         { label: 'Mid', path: 'mid', color: 'text-white' },
                         { label: 'High', path: 'high', color: 'text-amber' }
                       ].map((band) => (
                         <div key={band.path} className="space-y-2 bg-white/5 p-3 rounded-lg border border-white/5">
                            <div className="flex justify-between items-center px-1">
                               <span className={`text-[8px] font-mono ${band.color} uppercase tracking-widest font-bold`}>{band.label} Band</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                               <Knob 
                                 label="Gain" 
                                 min={-12} max={12} 
                                 value={(settings.eq as any)[band.path].gain} 
                                 onChange={(v) => {
                                    updateSettings({ eq: { ...settings.eq, [band.path]: { ...(settings.eq as any)[band.path], gain: v } } });
                                    if (automationMode === 'write') handleRecordParam(`eq.${band.path}` as AutomatableParam, v);
                                 }} 
                                 unit="dB" 
                               />
                               <Knob 
                                 label="Q Factor" 
                                 min={0.1} max={5.0} 
                                 value={(settings.eq as any)[band.path].q} 
                                 onChange={(v) => updateSettings({ eq: { ...settings.eq, [band.path]: { ...(settings.eq as any)[band.path], q: v } } })} 
                                 unit="" 
                               />
                            </div>
                         </div>
                       ))}
                    </div>

                    <div className="h-px bg-white/5 mx-2" />

                    {/* Parametric Bands: Low-Mid */}
                    <div className="space-y-3">
                       <div className="flex justify-between items-center px-1">
                          <span className="text-[8px] font-mono text-primary uppercase tracking-widest font-bold">Low-Mid Control</span>
                       </div>
                       <div className="grid grid-cols-3 gap-2 bg-white/5 p-2 rounded-lg border border-white/5">
                          <Knob 
                            label="Freq" 
                            min={100} max={1000} 
                            value={settings.eq.lowMid.freq} 
                            onChange={(v) => updateSettings({ eq: { ...settings.eq, lowMid: { ...settings.eq.lowMid, freq: v } } })} 
                            unit="Hz" 
                          />
                          <Knob 
                            label="Gain" 
                            min={-12} max={12} 
                            value={settings.eq.lowMid.gain} 
                            onChange={(v) => {
                               updateSettings({ eq: { ...settings.eq, lowMid: { ...settings.eq.lowMid, gain: v } } });
                               if (automationMode === 'write') handleRecordParam('eq.lowMid', v);
                            }} 
                            unit="dB" 
                          />
                          <Knob 
                            label="Q" 
                            min={0.1} max={5.0} 
                            value={settings.eq.lowMid.q} 
                            onChange={(v) => updateSettings({ eq: { ...settings.eq, lowMid: { ...settings.eq.lowMid, q: v } } })} 
                            unit="" 
                          />
                       </div>
                    </div>

                    {/* Parametric Bands: High-Mid */}
                    <div className="space-y-3">
                       <div className="flex justify-between items-center px-1">
                          <span className="text-[8px] font-mono text-amber uppercase tracking-widest font-bold">High-Mid Control</span>
                       </div>
                       <div className="grid grid-cols-3 gap-2 bg-white/5 p-2 rounded-lg border border-white/5">
                          <Knob 
                            label="Freq" 
                            min={1000} max={8000} 
                            value={settings.eq.highMid.freq} 
                            onChange={(v) => updateSettings({ eq: { ...settings.eq, highMid: { ...settings.eq.highMid, freq: v } } })} 
                            unit="Hz" 
                          />
                          <Knob 
                            label="Gain" 
                            min={-12} max={12} 
                            value={settings.eq.highMid.gain} 
                            onChange={(v) => {
                               updateSettings({ eq: { ...settings.eq, highMid: { ...settings.eq.highMid, gain: v } } });
                               if (automationMode === 'write') handleRecordParam('eq.highMid', v);
                            }} 
                            unit="dB" 
                          />
                          <Knob 
                            label="Q" 
                            min={0.1} max={5.0} 
                            value={settings.eq.highMid.q} 
                            onChange={(v) => updateSettings({ eq: { ...settings.eq, highMid: { ...settings.eq.highMid, q: v } } })} 
                            unit="" 
                          />
                       </div>
                    </div>
                 </div>
              </ConsoleModule>
              </div>

              {/* TONE & STEREO MODULES (Estéreo, Saturação & Tom) */}
              <div className={`space-y-10 ${mobileMasteringTab === 'tone' ? 'block' : 'hidden lg:block'}`}>
                 <ConsoleModule label="Stereo Imager" icon={StereoIcon}>
                 <div className="space-y-6">
                    <div className="h-32 piano-black rounded border border-white/5 overflow-hidden relative">
                       <Goniometer active={isEngaged} width={(settings.stereoWidthL + settings.stereoWidthR) / 2} />
                       <div className="absolute inset-x-0 bottom-1 flex justify-between px-2">
                          <span className="text-[6px] font-mono text-white/20 uppercase">L</span>
                          <span className="text-[6px] font-mono text-white/20 uppercase">Mono</span>
                          <span className="text-[6px] font-mono text-white/20 uppercase">R</span>
                       </div>
                    </div>

                    <div className="flex items-center justify-between px-1">
                       <span className="text-[8px] font-mono text-white/30 uppercase tracking-widest font-bold">Stereo Width</span>
                       <button 
                         onClick={() => updateSettings({ stereoLink: !settings.stereoLink })}
                         className={`p-1 rounded transition-all ${settings.stereoLink ? 'bg-primary/20 text-primary shadow-[0_0_10px_rgba(29,185,84,0.2)]' : 'bg-white/5 text-white/20 border border-white/5'}`}
                         title={settings.stereoLink ? 'Linked' : 'Unlinked'}
                       >
                          <Link2 className="w-3 h-3" />
                       </button>
                    </div>

                    <div className="space-y-4">
                       <Slider 
                         label="Left Channel" 
                         value={settings.stereoWidthL} 
                         onChange={(v) => {
                           if (settings.stereoLink) {
                             updateSettings({ stereoWidthL: v, stereoWidthR: v });
                           } else {
                             updateSettings({ stereoWidthL: v });
                           }
                         }} 
                         min={0} 
                         max={200} 
                         unit="%" 
                       />
                       <Slider 
                         label="Right Channel" 
                         value={settings.stereoWidthR} 
                         onChange={(v) => {
                           if (settings.stereoLink) {
                             updateSettings({ stereoWidthL: v, stereoWidthR: v });
                           } else {
                             updateSettings({ stereoWidthR: v });
                           }
                         }} 
                         min={0} 
                         max={200} 
                         unit="%" 
                       />
                    </div>

                    {/* Bass Mono Maker (< 120Hz Mono Lock) */}
                    <div className="pt-3 border-t border-white/5 flex items-center justify-between px-1">
                       <div className="flex flex-col">
                          <span className="text-[8px] font-mono text-white/50 uppercase tracking-widest font-bold">Bass Mono Maker (&lt;120Hz)</span>
                          <span className="text-[7px] font-mono text-white/30">Evita cancelamento de fase em subgraves / club / vinil</span>
                       </div>
                       <button
                         type="button"
                         onClick={() => updateSettings({ bassMono: !settings.bassMono })}
                         className={`px-2.5 py-1 rounded text-[8px] font-mono font-bold uppercase transition-all ${
                           settings.bassMono 
                             ? 'bg-primary text-black shadow-[0_0_10px_#1db954]' 
                             : 'bg-white/5 text-white/40 hover:text-white border border-white/10'
                         }`}
                       >
                         {settings.bassMono ? 'LOCKED MONO' : 'OFF'}
                       </button>
                    </div>

                    <div className="flex justify-between items-center px-1">
                       <span className="text-[8px] font-mono text-white/30 uppercase tracking-widest">Mono Compatibility</span>
                       <div className={`w-2 h-2 rounded-full ${isEngaged && ((settings.stereoWidthL + settings.stereoWidthR) / 2 < 120 || settings.bassMono) ? 'bg-primary shadow-[0_0_8px_#1db954]' : 'bg-scarlet shadow-[0_0_8px_#ff2e2e]'}`} />
                    </div>
                 </div>
              </ConsoleModule>

              <ConsoleModule label="Saturation" icon={SaturationIcon}>
                 <Slider 
                   label="Tape Warmth" 
                   value={settings.saturation} 
                   onChange={(v) => updateSettings({ saturation: v })} 
                   min={0} 
                   max={100} 
                   unit="%" 
                 />
              </ConsoleModule>

              <ConsoleModule label="Harmonic Exciter" icon={Sparkles}>
                 <div className="space-y-6">
                    <Slider 
                      label="Excitement" 
                      value={settings.exciter.amount} 
                      onChange={(v) => updateSettings({ exciter: { ...settings.exciter, amount: v } })} 
                      min={0} 
                      max={100} 
                      unit="%" 
                    />
                    <Slider 
                      label="Color / Brilliance" 
                      value={settings.exciter.color} 
                      onChange={(v) => updateSettings({ exciter: { ...settings.exciter, color: v } })} 
                      min={0} 
                      max={100} 
                      unit="%" 
                    />
                 </div>
              </ConsoleModule>
              
              <ConsoleModule label="Knobs Extras" icon={Waves}>
                 <div className="grid grid-cols-2 gap-4 bg-white/5 p-4 rounded-xl border border-white/5">
                    <Knob 
                      label="Reverb" 
                      min={0} max={100} 
                      value={settings.reverb} 
                      onChange={(v) => updateSettings({ reverb: v })} 
                      unit="%" 
                    />
                    <Knob 
                      label="Delay" 
                      min={0} max={100} 
                      value={settings.delay} 
                      onChange={(v) => updateSettings({ delay: v })} 
                      unit="%" 
                    />
                 </div>
              </ConsoleModule>
              </div>

              {/* LOUDNESS & LIMITER MODULES (Limiter & LUFS) */}
              <div className={`space-y-10 ${mobileMasteringTab === 'loudness' ? 'block' : 'hidden lg:block'}`}>
                 <ConsoleModule label="LUFS Target Maximizer" icon={Zap} color="primary">
                 <div className="flex items-center justify-between mb-3 bg-black/20 p-2 rounded-lg border border-white/5">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-white/50 animate-pulse">Free-form Mode (Modo Livre)</span>
                    <button
                      type="button"
                      onClick={() => {
                        const nextMode = !isLufsCustomMode;
                        setIsLufsCustomMode(nextMode);
                        if (!nextMode) {
                          const clampedVal = Math.max(-18, Math.min(-6, settings.lufsTarget ?? -14));
                          updateSettings({ lufsTarget: parseFloat(clampedVal.toFixed(1)) });
                        }
                      }}
                      className={`px-2 py-0.5 rounded font-mono text-[8.5px] font-bold uppercase tracking-widest transition-all ${
                        isLufsCustomMode 
                          ? 'bg-primary text-on-primary shadow-[0_0_8px_#1db954]' 
                          : 'bg-white/5 text-white/40 hover:bg-white/10'
                      }`}
                    >
                      {isLufsCustomMode ? 'ON' : 'OFF'}
                    </button>
                 </div>

                 <div className="space-y-3">
                    <div className="flex items-end gap-3">
                       <div className="flex-1">
                          <Slider 
                            label={isLufsCustomMode ? "Manual Target" : "Target LUFS"} 
                            value={settings.lufsTarget ?? -14} 
                            onChange={(v) => updateSettings({ lufsTarget: parseFloat(v.toFixed(1)) })} 
                            min={isLufsCustomMode ? -40 : -18} 
                            max={isLufsCustomMode ? -1 : -6} 
                            unit=" LUFS" 
                          />
                       </div>
                       {isLufsCustomMode && (
                          <div className="w-20">
                             <span className="engraved-label text-[8px] text-white/30 block mb-1">Direct Target</span>
                             <input 
                               type="number"
                               min={-40}
                               max={-0.1}
                               step={0.1}
                               value={typeof settings.lufsTarget === 'number' ? parseFloat(settings.lufsTarget.toFixed(1)) : -14.0}
                               onChange={(e) => {
                                 let val = parseFloat(e.target.value);
                                 if (!isNaN(val)) {
                                   if (val > 0) val = -val; // Safety for positive DB entry (e.g. if someone types 14, treat as -14)
                                   updateSettings({ lufsTarget: val });
                                 }
                               }}
                               className="w-full bg-black text-primary font-mono text-[10px] font-bold text-center py-1 rounded border border-white/10 focus:outline-hidden focus:border-primary/50"
                             />
                          </div>
                       )}
                    </div>

                    {!isLufsCustomMode ? (
                       <div className="grid grid-cols-4 gap-1 pt-1">
                          {[
                            { label: 'Spotify', val: -14 },
                            { label: 'Apple', val: -16 },
                            { label: 'YouTube', val: -13 },
                            { label: 'Club', val: -9 }
                          ].map((item) => (
                            <button
                              key={item.label}
                              type="button"
                              onClick={() => updateSettings({ lufsTarget: item.val })}
                              className={`py-1 rounded font-mono text-[8px] uppercase tracking-wider border transition-all ${
                                settings.lufsTarget === item.val
                                  ? 'bg-primary/20 text-primary border-primary/40'
                                  : 'bg-black/30 text-white/40 border-white/5 hover:bg-black/50 hover:text-white/60'
                              }`}
                            >
                              {item.label} ({item.val})
                            </button>
                          ))}
                       </div>
                    ) : (
                       <div className="grid grid-cols-4 gap-1 pt-1">
                          {[
                            { label: 'Lo-Fi', val: -20 },
                            { label: 'Cinematic', val: -24 },
                            { label: 'CD Redbook', val: -9 },
                            { label: 'Ultra Hot', val: -3 }
                          ].map((item) => (
                            <button
                              key={item.label}
                              type="button"
                              onClick={() => updateSettings({ lufsTarget: item.val })}
                              className={`py-1 rounded font-mono text-[8px] uppercase tracking-wider border transition-all ${
                                settings.lufsTarget === item.val
                                  ? 'bg-primary/20 text-primary border-primary/40'
                                  : 'bg-black/30 text-white/40 border-white/5 hover:bg-black/50 hover:text-white/60'
                              }`}
                            >
                              {item.label} ({item.val})
                            </button>
                          ))}
                       </div>
                    )}

                    <div className="mt-2 text-[9px] font-mono text-white/40 uppercase tracking-widest text-center">
                       {settings.lufsTarget <= -18 ? "💨 High Dynamic Range release" : settings.lufsTarget <= -14 ? "🍃 Dynamic release grade" : settings.lufsTarget <= -10 ? "📻 Streaming standard grade" : settings.lufsTarget <= -6 ? "🔥 Club & Heavy Bass grade" : "⚡ Extreme Loudness (Sausage)"}
                    </div>
                 </div>
              </ConsoleModule>

              <ConsoleModule label="Brickwall Limiter" icon={VolumeIcon} color="scarlet">
                 <Slider 
                   label="Ceiling" 
                   value={settings.limiter} 
                   onChange={(v) => updateSettings({ limiter: v })} 
                   min={-1} 
                   max={0} 
                   unit="dB" 
                   danger
                 />

                 {/* Neural Limiter Assistant Trigger & Panel */}
                 <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                    <button
                      type="button"
                      onClick={() => setShowLimiterAssistant(!showLimiterAssistant)}
                      className="w-full py-2 px-3 bg-scarlet/10 hover:bg-scarlet/20 border border-scarlet/20 rounded-xl font-mono text-[9px] font-bold uppercase tracking-widest text-scarlet transition-all flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-3.5 h-3.5 animate-pulse text-scarlet" />
                      {showLimiterAssistant ? 'Hide AI Assistant' : 'Neural Limiter Assistant'}
                    </button>

                    <AnimatePresence>
                      {showLimiterAssistant && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden space-y-3"
                        >
                          <div className="bg-black/40 p-4 rounded-xl border border-white/5 space-y-3 text-left">
                            <div className="flex items-center justify-between">
                              <span className="text-[8px] font-mono text-white/30 uppercase tracking-wider">Input Track RMS</span>
                              <span className="text-[10px] font-mono font-bold text-white">
                                {calculatedRms !== null ? `${calculatedRms} dBFS` : 'No Track Loaded'}
                              </span>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[8px] font-mono text-white/30 uppercase tracking-wider block">Target Genre</label>
                              <select
                                value={selectedGenre}
                                onChange={(e) => setSelectedGenre(e.target.value)}
                                className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 font-mono text-[10px] text-white focus:outline-none focus:border-scarlet/40"
                              >
                                {['Electronic', 'Techno', 'House', 'Hip Hop', 'Trap', 'Lo-Fi', 'Ambient', 'Acoustic', 'Rock', 'Pop', 'Classical'].map((g) => (
                                  <option key={g} value={g} className="bg-obsidian text-white">{g}</option>
                                ))}
                              </select>
                            </div>

                            <button
                              type="button"
                              onClick={fetchLimiterSuggestion}
                              disabled={loadingLimiterSuggestion || !currentTrack}
                              className="w-full py-2 bg-scarlet hover:brightness-110 disabled:bg-white/5 disabled:text-white/20 text-white rounded-lg font-mono text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                            >
                              {loadingLimiterSuggestion ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Sparkles className="w-3 h-3" />
                              )}
                              {loadingLimiterSuggestion ? 'Analyzing Signal...' : 'Generate AI Settings'}
                            </button>

                            {suggestionError && (
                              <div className="text-[9px] font-mono text-scarlet leading-snug bg-scarlet/10 p-2 rounded border border-scarlet/20">
                                {suggestionError}
                              </div>
                            )}

                            {limiterSuggestion && (
                              <div className="space-y-3 pt-2 border-t border-white/5 animate-fadeIn">
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="bg-white/2 p-2 rounded border border-white/5 text-center">
                                    <span className="block text-[7px] font-mono text-white/30 uppercase">Ceiling</span>
                                    <span className="text-[11px] font-mono font-black text-scarlet">{limiterSuggestion.ceiling} dB</span>
                                  </div>
                                  <div className="bg-white/2 p-2 rounded border border-white/5 text-center">
                                    <span className="block text-[7px] font-mono text-white/30 uppercase">Loudness</span>
                                    <span className="text-[11px] font-mono font-black text-scarlet">{limiterSuggestion.lufsTarget} LUFS</span>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <span className="text-[7px] font-mono text-white/30 uppercase block">Dynamic Response Style</span>
                                  <div className="text-[10px] font-mono text-white font-semibold">
                                    {limiterSuggestion.releaseMode}
                                  </div>
                                  <div className="text-[8px] font-mono text-white/40 leading-snug">
                                    {limiterSuggestion.transientResponse}
                                  </div>
                                </div>

                                <div className="p-2.5 rounded-lg bg-white/2 border border-white/5">
                                  <span className="text-[7px] font-mono text-scarlet uppercase font-extrabold tracking-wider block mb-1">AI Recommendation</span>
                                  <p className="text-[10px] text-white/60 leading-normal font-sans italic">
                                    "{limiterSuggestion.explanation}"
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={applyLimiterSuggestion}
                                  className={`w-full py-2.5 rounded-lg font-mono text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                                    suggestionApplied
                                      ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                                      : 'bg-white/10 hover:bg-white/20 text-white'
                                  }`}
                                >
                                  {suggestionApplied ? (
                                    <>✔ Applied Successfully</>
                                  ) : (
                                    <>⚡ Apply AI Settings</>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                 </div>
              </ConsoleModule>

              {/* Advanced Dithering & Bit Depth Console Module */}
              <ConsoleModule label="Dithering & Precision" icon={Sliders} color="primary">
                 <div className="space-y-4">
                    {/* Bit Depth Selector */}
                    <div className="space-y-2">
                       <label className="text-[8px] font-mono text-white/30 uppercase tracking-widest block font-bold">Target Bit Depth Precision</label>
                       <div className="grid grid-cols-3 gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5">
                          {[
                             { label: '24-Bit HD', val: 24, subtitle: 'Studio Master' },
                             { label: '16-Bit CD', val: 16, subtitle: 'Standard' },
                             { label: '8-Bit Retro', val: 8, subtitle: 'Gameboy Crunch' }
                          ].map((item) => (
                             <button
                                key={item.val}
                                type="button"
                                onClick={() => updateSettings({ bitDepth: item.val })}
                                className={`py-1.5 px-1 rounded-lg font-mono text-center transition-all ${
                                   settings.bitDepth === item.val
                                      ? 'bg-primary/20 text-primary border border-primary/25 shadow-[0_0_8px_rgba(29,185,84,0.15)] font-black'
                                      : 'text-white/40 hover:text-white/80'
                                }`}
                             >
                                <span className="block text-[8px] tracking-wider uppercase">{item.label}</span>
                                <span className="text-[6px] tracking-widest uppercase opacity-70 block -mt-0.5">{item.subtitle}</span>
                             </button>
                          ))}
                       </div>
                    </div>

                    {/* Dither Bypass State Toggle */}
                    {settings.bitDepth !== 24 && (
                       <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/2 border border-white/5 animate-fadeIn">
                          <div className="flex flex-col gap-0.5">
                             <span className="text-[8px] font-mono text-white uppercase tracking-widest font-extrabold">Dithering Engine</span>
                             <span className="text-[6px] font-mono text-white/40 uppercase">Adds random noise to prevent truncation distortion</span>
                          </div>
                          <button
                             type="button"
                             onClick={() => updateSettings({ ditherEnabled: !settings.ditherEnabled })}
                             className={`py-1 px-3 rounded-lg font-mono text-[8px] font-bold uppercase transition-all border ${
                                settings.ditherEnabled
                                   ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                   : 'bg-scarlet/10 text-scarlet border-scarlet/20'
                             }`}
                          >
                             {settings.ditherEnabled ? 'ACTIVE' : 'BYPASSED'}
                          </button>
                       </div>
                    )}

                    {/* Noise-Shaping Algorithm selector (Only if dither active and bitDepth < 24) */}
                    {settings.bitDepth !== 24 && settings.ditherEnabled && (
                       <div className="space-y-1.5 animate-fadeIn">
                          <label className="text-[8px] font-mono text-white/30 uppercase tracking-widest block font-bold">Noise-Shaping Filter Shape</label>
                          <div className="grid grid-cols-2 gap-1 animate-fadeIn">
                             {['Flat TPDF', 'POW-r Type 1', 'POW-r Type 2', 'POW-r Type 3', 'Apogee UV22HR'].map((algorithm) => (
                                <button
                                   key={algorithm}
                                   type="button"
                                   onClick={() => updateSettings({ ditherType: algorithm })}
                                   className={`py-1 rounded-lg font-mono text-[8px] font-bold text-center border transition-all ${
                                      settings.ditherType === algorithm
                                         ? 'bg-primary/10 border-primary/30 text-primary shadow-sm'
                                         : 'bg-black/20 border-white/5 text-white/40 hover:text-white/60'
                                   }`}
                                >
                                   {algorithm}
                                </button>
                             ))}
                          </div>
                       </div>
                    )}

                    {/* Interactive Spectrum Graph Visualization */}
                    <div className="space-y-1 pt-1">
                       <span className="text-[8px] font-mono text-white/30 uppercase tracking-widest block font-bold">Quantization Noise Spectral Curve</span>
                       <div className="h-28 bg-black/60 rounded-xl border border-white/10 relative overflow-hidden flex flex-col justify-end p-2">
                          {/* Grid Lines & Labels */}
                          <div className="absolute inset-x-0 top-0 bottom-4 flex flex-col justify-between pointer-events-none opacity-20">
                             <div className="w-full border-t border-dashed border-white/60 flex justify-between px-1.5 pt-0.5 text-[5px] font-mono text-white">
                                <span>-48 dBFS</span><span>{settings.bitDepth === 8 ? 'Truncation Grid' : ''}</span>
                             </div>
                             <div className="w-full border-t border-dashed border-white/44 flex justify-between px-1.5 pt-0.5 text-[5px] font-mono text-white">
                                <span>-96 dBFS</span><span>{settings.bitDepth === 16 ? 'Standard Floor' : ''}</span>
                             </div>
                             <div className="w-full border-t border-dashed border-white/20 flex justify-between px-1.5 pt-0.5 text-[5px] font-mono text-white">
                                <span>-144 dBFS</span><span>{settings.bitDepth === 24 ? 'Pristine HD' : ''}</span>
                             </div>
                          </div>

                          {/* Frequency scale on X-axis */}
                          <div className="absolute inset-x-0 bottom-1 flex justify-between px-2 pointer-events-none opacity-30 text-[5px] font-mono text-white uppercase">
                             <span>20 Hz</span>
                             <span>1.0 kHz</span>
                             <span>3.5 kHz</span>
                             <span>12.0 kHz</span>
                             <span>20.0 kHz</span>
                          </div>

                          {/* Spectral path drawing */}
                          <svg className="w-full h-[85px] pointer-events-none z-10" viewBox="0 0 300 100" preserveAspectRatio="none">
                             <defs>
                                <linearGradient id="curveGlow" x1="0" y1="0" x2="0" y2="1">
                                   <stop offset="0%" stopColor="#1db954" stopOpacity="0.4" />
                                   <stop offset="100%" stopColor="#1db954" stopOpacity="0" />
                                </linearGradient>
                             </defs>
                             <path 
                                d={(() => {
                                   const bit = settings.bitDepth ?? 16;
                                   const eth = settings.ditherEnabled ?? true;
                                   const typ = settings.ditherType ?? 'POW-r Type 1';
                                   if (bit === 24) return "M 5 95 L 295 95";
                                   if (!eth) {
                                      const y = bit === 16 ? 66 : 33;
                                      return `M 5 ${y} L 295 ${y}`;
                                   }
                                   if (typ === 'Flat TPDF') {
                                      const y = bit === 16 ? 66 : 33;
                                      return `M 5 ${y} L 295 ${y}`;
                                   }
                                   if (typ === 'POW-r Type 1') {
                                      const base = bit === 16 ? 66 : 33;
                                      return `M 5 ${base} Q 80 ${base} 150 ${base + 8} T 295 ${base - 14}`;
                                   }
                                   if (typ === 'POW-r Type 2') {
                                      const base = bit === 16 ? 66 : 33;
                                      return `M 5 ${base} C 60 ${base} 100 ${base + 18} 160 ${base + 4} T 295 ${base - 22}`;
                                   }
                                   if (typ === 'POW-r Type 3') {
                                      const base = bit === 16 ? 66 : 33;
                                      return `M 5 ${base} C 50 ${base} 90 ${base + 24} 150 ${base} T 295 ${base - 28}`;
                                   }
                                   if (typ === 'Apogee UV22HR') {
                                      const base = bit === 16 ? 66 : 33;
                                      return `M 5 ${base + 2} Q 90 ${base + 8} 180 ${base - 4} T 295 ${base - 28}`;
                                   }
                                   return `M 5 ${bit === 16 ? 66 : 33} L 295 ${bit === 16 ? 66 : 33}`;
                                })()}
                                fill="none" 
                                stroke={settings.bitDepth === 24 ? "#1db954" : settings.ditherEnabled ? "#1db954" : "#ff2e2e"} 
                                strokeWidth="1.5"
                                className="transition-all duration-300"
                             />
                          </svg>
                       </div>
                    </div>

                    {/* Informative summary box */}
                    <div className="p-2.5 rounded-xl bg-white/2 border border-white/5">
                       <span className="text-[7px] font-mono text-primary uppercase font-extrabold tracking-wider block mb-1">
                          {settings.bitDepth === 24 
                             ? 'HD Audio Mastery' 
                             : !settings.ditherEnabled 
                                ? 'Warning: Truncation Distortion active' 
                                : (() => {
                                      switch (settings.ditherType) {
                                         case 'POW-r Type 1': return 'Type 1 (Optimized Flat)';
                                         case 'POW-r Type 2': return 'Type 2 (Vocal Focus)';
                                         case 'POW-r Type 3': return 'Type 3 (Multitrack Mix)';
                                         case 'Apogee UV22HR': return 'Apogee UV22 (Ear Curve)';
                                         case 'Flat TPDF':
                                         default: return 'Flat TPDF (Triangular)';
                                      }
                                   })()
                          }
                       </span>
                       <p className="text-[8px] text-white/50 leading-relaxed font-mono">
                          {settings.bitDepth === 24 
                             ? 'The track will be mastered at full 24-bit studio precision. Dithering is automatically bypassed, maintaining peak transient response and -144dB digital noise floor.' 
                             : !settings.ditherEnabled 
                                ? 'Bypassing dithering causes severe harmonic distortion in quiet passages (truncation noise). This is audible in tails, fades, and reverbs.' 
                                : (() => {
                                      switch (settings.ditherType) {
                                         case 'POW-r Type 1': 
                                            return 'Optimal for quiet acoustic sessions, solo acoustic guitars, and vocal solos. Maintains accurate low-level resolution without spatial smearing.';
                                         case 'POW-r Type 2': 
                                            return 'Optimized for spoken word, audiobooks, and radio. Retains speech clarity by keeping vocal harmonics clean and centering noise away from mid frequencies.';
                                         case 'POW-r Type 3': 
                                            return 'Provides a highly intense 9th-order psychoacoustic curve pushing quantization noise up beyond 14kHz. Essential for techno, pop, or heavy EDM.';
                                         case 'Apogee UV22HR': 
                                            return 'The legendary psychoacoustic model mimicking human ear audibility. Preserves wide, deep spatial cues, reverb tails, and ultra-fine acoustic details.';
                                         case 'Flat TPDF':
                                         default: 
                                            return 'Perfect flat spectrum triangular dither. Generates linear 0.5 LSB random noise with no frequency coloring, suitable for general mixdowns.';
                                      }
                                   })()
                          }
                       </p>
                    </div>
                 </div>
              </ConsoleModule>

              <ConsoleModule label="Master Output" icon={VolumeIcon}>
                 <div className="flex gap-6 h-64 bg-black/40 p-4 rounded-xl border border-white/5 relative overflow-hidden">
                    <div className="flex-1 flex flex-col justify-between py-2">
                       <div className="flex flex-col gap-4">
                          <button 
                            onClick={() => updateSettings({ masterVolume: 0 })}
                            className="w-full py-1 bg-scarlet/10 border border-scarlet/20 rounded font-mono text-[7px] text-scarlet uppercase hover:bg-scarlet/20 transition-all"
                          >
                            Mute
                          </button>
                          <div className="flex flex-col gap-1 items-center">
                             <span className="text-[7px] font-mono text-white/20 uppercase tracking-widest">Target</span>
                             <span className="text-[9px] font-mono text-primary font-bold">-0.3dB</span>
                          </div>
                       </div>
                       
                       <div className="space-y-4">
                          <button 
                            onClick={() => updateSettings({ masterVolume: 1 })}
                            className="w-full py-1 bg-white/5 border border-white/10 rounded font-mono text-[7px] text-white/40 uppercase hover:bg-white/10 transition-all"
                          >
                            Reset
                          </button>
                          <div className="text-center">
                             <div className="text-[12px] font-mono text-white font-black">
                                {settings.masterVolume > 0 ? '+' : ''}{(20 * Math.log10(settings.masterVolume || 0.0001)).toFixed(1)}
                             </div>
                             <div className="text-[7px] font-mono text-white/20 uppercase">dBFS</div>
                          </div>
                       </div>
                    </div>

                    <div className="w-12 h-full flex flex-col gap-2 relative group">
                       <div className="absolute inset-x-0 bottom-0 top-0 flex justify-center py-2">
                          <div className="w-1 h-full bg-black rounded-full shadow-inner border border-white/5 relative">
                             {/* Fader Scale */}
                             {[0, 25, 50, 75, 100].map(p => (
                               <div 
                                 key={p} 
                                 className="absolute w-2 h-px bg-white/20 -left-0.5" 
                                 style={{ bottom: `${p}%` }}
                               />
                             ))}
                          </div>
                       </div>
                       
                       <input 
                         type="range"
                         min="0"
                         max="1.5"
                         step="0.01"
                         value={settings.masterVolume}
                         onChange={(e) => updateSettings({ masterVolume: parseFloat(e.target.value) })}
                         className="absolute inset-0 w-full h-full opacity-0 cursor-ns-resize z-20 [writing-mode:bt-lr] appearance-slider-vertical"
                       />

                       <motion.div 
                         className="absolute left-1/2 -translate-x-1/2 w-8 h-12 bg-linear-to-b from-graphite to-obsidian border border-white/20 rounded shadow-2xl z-10 pointer-events-none group-hover:border-primary/50 transition-colors"
                         style={{ bottom: `${(settings.masterVolume / 1.5) * 100}%`, marginBottom: '-24px' }}
                       >
                          <div className="absolute inset-x-1 top-1/2 -translate-y-px h-0.5 bg-primary shadow-[0_0_8px_#1db954]" />
                          <div className="absolute inset-x-2 top-2 h-px bg-white/5" />
                          <div className="absolute inset-x-2 bottom-2 h-px bg-white/5" />
                       </motion.div>
                    </div>

                    <div className="w-6 h-full bg-black/60 rounded border border-white/10 p-0.5 flex flex-col-reverse gap-px overflow-hidden">
                       <MasterMeter active={isPlaying} volume={settings.masterVolume} analyser={nodesRef.current?.analyser} />
                    </div>
                 </div>
              </ConsoleModule>
              </div>

              <div className="pt-8 border-t border-white/5 space-y-4">
                 <div className="flex justify-between items-center px-2">
                    <span className="engraved-label text-white/20">System Power</span>
                    <span className={`font-mono text-[10px] font-bold ${isEngaged ? 'text-primary' : 'text-white/20'}`}>
                       {isEngaged ? 'ONLINE' : 'STBY'}
                    </span>
                 </div>
                 <button 
                  onClick={() => currentTrack && setIsEngaged(!isEngaged)}
                  disabled={!currentTrack}
                  className={`w-full group relative flex items-center justify-center gap-3 py-6 rounded-xl transition-all duration-500 overflow-hidden ${
                    !currentTrack
                      ? 'bg-white/5 text-white/10 cursor-not-allowed border border-white/5'
                      : isEngaged 
                        ? 'bg-primary text-on-primary shadow-[0_0_30px_rgba(29,185,84,0.4)] border border-primary' 
                        : 'bg-graphite text-white/40 hover:bg-white/10 hover:text-white border border-white/10'
                  }`}
                 >
                    {currentTrack && (
                      <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
                    )}
                    <Power className={`w-6 h-6 transition-transform duration-500 ${isEngaged ? 'rotate-90' : ''}`} />
                    <span className="font-mono text-sm font-black uppercase tracking-[0.3em]">
                       {!currentTrack ? 'No Track Loaded' : (isEngaged ? 'Master Active' : 'Start Master')}
                    </span>
                 </button>
                 {currentTrack && (
                   <button 
                     onClick={() => { setCurrentTrack(null); setIsEngaged(false); }}
                     className="w-full py-2 font-mono text-[8px] uppercase tracking-widest text-white/20 hover:text-scarlet transition-colors"
                   >
                     Clear Session
                   </button>
                 )}
              </div>
           </div>
        </aside>

      </div>
    </div>
  );
}

function formatPlaybackTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

function ChainModule({ label, active }: { label: string, active: boolean }) {
  return (
    <div className={`flex items-center gap-2 group cursor-default`}>
       <div className={`w-1 h-3 rounded-full transition-colors ${active ? 'bg-primary shadow-[0_0_8px_#1db954]' : 'bg-white/10'}`} />
       <span className={`font-mono text-[9px] font-bold transition-colors ${active ? 'text-white' : 'text-white/20'}`}>{label}</span>
    </div>
  );
}

function VisualMeter({ label, value, target, min, max, unit = '', active = false, peakHold }: { 
  label: string; 
  value: number; 
  target: number; 
  min: number; 
  max: number; 
  unit?: string; 
  active?: boolean;
  peakHold?: number;
}) {
  const displayValue = active && value !== -Infinity ? value.toFixed(1) : (active ? '---' : '0.0');
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  const targetPos = ((target - min) / (max - min)) * 100;
  const peakHoldPos = peakHold !== undefined ? ((peakHold - min) / (max - min)) * 100 : null;

  // Generate segments
  const segmentCount = 20;

  return (
    <div className="flex flex-col items-end min-w-[70px]">
      <span className="engraved-label text-[7px] text-white/30 uppercase tracking-[0.2em] mb-1">{label}</span>
      <div className="flex items-baseline gap-1 mb-1">
         <span className={`font-mono font-black text-lg tracking-tighter ${active ? (value > target ? 'text-scarlet neon-glow-scarlet' : 'text-primary neon-glow-emerald') : 'text-white/5'} transition-all`}>
           {displayValue}
         </span>
         <span className="font-mono text-[8px] text-white/20 uppercase">{unit}</span>
      </div>
      <div className="w-full h-2.5 bg-black/60 rounded-sm border border-white/5 relative flex items-center px-0.5 overflow-hidden">
        {/* Background segments */}
        <div className="absolute inset-x-0.5 inset-y-0.5 flex gap-[1px]">
          {Array.from({ length: segmentCount }).map((_, i) => (
            <div key={i} className="flex-1 h-full bg-white/[0.03] rounded-xs" />
          ))}
        </div>

        {/* Fill */}
        <div className="absolute inset-x-0.5 inset-y-0.5 flex gap-[1px]">
          {Array.from({ length: Math.floor((percentage / 100) * segmentCount) }).map((_, i) => {
            const segPos = (i / segmentCount) * 100;
            const isOver = ((min + (i/segmentCount) * (max-min)) > target);
            return (
              <motion.div 
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`flex-1 h-full rounded-xs ${isOver ? 'bg-scarlet shadow-[0_0_8px_#ff2e2e]' : 'bg-primary shadow-[0_0_8px_#1db954]'}`}
              />
            );
          })}
        </div>

        {/* Target Marker */}
        <div 
          className="absolute h-full w-[2px] bg-white/40 z-10 shadow-[0_0_5px_rgba(255,255,255,0.5)]" 
          style={{ left: `${targetPos}%` }} 
        />

        {/* Peak Hold Indicator */}
        {peakHoldPos !== null && active && (
          <motion.div 
            animate={{ left: `${peakHoldPos}%` }}
            className="absolute h-[80%] w-[1.5px] bg-white/60 z-10" 
          />
        )}
      </div>
    </div>
  );
}

function CorrelationMeter({ value, active }: { value: number, active: boolean }) {
  // Value is -1 to +1
  const percentage = ((value + 1) / 2) * 100;
  
  return (
    <div className="flex flex-col items-center min-w-[100px]">
      <span className="engraved-label text-[7px] text-white/30 uppercase tracking-[0.2em] mb-1">CORRELATION</span>
      <div className="w-full h-2.5 piano-black rounded-sm border border-white/5 relative flex items-center px-0.5 mb-1 overflow-hidden">
        {/* Track */}
        <div className="absolute inset-x-0.5 h-[1px] bg-white/5 top-1/2 -translate-y-1/2" />
        <div className="absolute left-1/2 -translate-x-1/2 h-full w-[1px] bg-white/10" />
        
        <div className="absolute inset-x-0.5 flex justify-between px-1 pointer-events-none z-10">
          <span className="text-[5px] font-mono text-white/20">-1</span>
          <span className="text-[5px] font-mono text-white/20">0</span>
          <span className="text-[5px] font-mono text-white/20">+1</span>
        </div>

        {/* Active Gradient Background */}
        {active && (
          <div 
            className="absolute h-full bg-linear-to-r from-transparent via-primary/20 to-transparent"
            style={{ 
              left: '50%', 
              right: `${100 - percentage}%`,
              transition: 'right 0.1s ease'
            }}
          />
        )}

        <motion.div 
          animate={{ left: `${active ? percentage : 50}%` }}
          transition={{ type: 'spring', damping: 15, stiffness: 120 }}
          className={`absolute w-1.5 h-full ${active ? 'bg-primary shadow-[0_0_10px_#1db954]' : 'bg-white/10'} -translate-x-1/2 z-20`}
        />
      </div>
      <div className="flex items-center gap-1">
         <div className={`w-1 h-1 rounded-full ${active && value > 0 ? 'bg-primary animate-pulse' : 'bg-white/5'}`} />
         <span className={`font-mono text-[9px] font-black ${active ? 'text-primary' : 'text-white/5'}`}>
           {active ? (value > 0 ? '+' : '') + value.toFixed(2) : '0.00'}
         </span>
      </div>
    </div>
  );
}

function StatReadout({ label, value, unit = '', active = false }: { label: string, value: string, unit?: string, active?: boolean }) {
  return (
    <div className="flex flex-col items-end">
      <span className="engraved-label text-[8px] opacity-60 mb-0.5">{label}</span>
      <div className="flex items-baseline gap-1">
         <span className={`font-mono font-black text-xl tracking-tighter ${active ? 'text-primary neon-glow-emerald' : 'text-white/10'} transition-all`}>
           {value}
         </span>
         <span className="font-mono text-[10px] text-white/20 uppercase">{unit}</span>
      </div>
    </div>
  );
}

function PresetButton(props: { label: string, active: boolean, onClick: () => void, key?: any }) {
  const { label, active, onClick } = props;
  return (
    <button 
      onClick={onClick}
      className={`px-4 py-3 rounded-lg border font-mono text-[10px] font-bold uppercase tracking-widest transition-all ${
        active 
          ? 'bg-primary border-primary text-on-primary shadow-[0_0_15px_rgba(29,185,84,0.3)]' 
          : 'bg-obsidian-light border-white/5 text-white/30 hover:border-white/20 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}

function SuggestedParameterRow({ label, current, target }: { label: string; current: string; target: string }) {
  const isChanged = current !== target;
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0 text-left">
       <span className="text-[9px] font-mono text-white/35 uppercase tracking-wide">{label}</span>
       <div className="flex items-center gap-1.5 font-mono text-[10px]">
          <span className="text-white/30 line-through">{current}</span>
          <ChevronRight className="w-2.5 h-2.5 text-white/20" />
          <span className={`font-bold ${isChanged ? 'text-primary' : 'text-white/60'}`}>{target}</span>
       </div>
    </div>
  );
}

function LevelMeter({ label, target, current, status, color = 'primary' }: { label: string, target: string, current: string, status: string, color?: string }) {
  const isScarlet = color === 'scarlet';
  const isAmber = color === 'amber';
  
  return (
    <div className="hardware-panel p-4 rounded-xl space-y-3 group hover:border-white/10 transition-colors">
       <div className="flex justify-between items-center">
          <span className="engraved-label opacity-40">{label}</span>
          <span className={`font-mono text-[10px] font-bold ${isScarlet ? 'text-scarlet' : isAmber ? 'text-amber' : 'text-primary opacity-60'}`}>{status}</span>
       </div>
       <div className="grid grid-cols-2 gap-4">
          <div>
             <span className="text-[8px] font-mono text-white/20 uppercase block">Target</span>
             <span className="text-xs font-mono text-white font-bold">{target} <span className="opacity-40 text-[9px]">LUFS</span></span>
          </div>
          <div>
             <span className="text-[8px] font-mono text-white/20 uppercase block">Actual</span>
             <span className={`text-xs font-mono font-bold ${isScarlet ? 'text-scarlet' : isAmber ? 'text-amber' : 'text-white'}`}>{current} <span className="opacity-40 text-[9px]">LUFS</span></span>
          </div>
       </div>
       <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div 
            animate={{ width: `${Math.abs(parseFloat(current)/-20) * 100}%` }}
            className={`h-full ${isScarlet ? 'bg-scarlet' : isAmber ? 'bg-amber' : 'bg-primary'}`}
          />
       </div>
    </div>
  );
}

function ConsoleModule({ label, icon: Icon, color = 'primary', children }: { label: string, icon: any, color?: string, children: React.ReactNode }) {
  return (
    <div className="space-y-4">
       <div className="flex items-center gap-3">
          <div className={`p-2 rounded bg-obsidian border border-white/5 text-primary neon-glow-emerald`}>
             <Icon className="w-3.5 h-3.5" />
          </div>
          <h4 className="engraved-label text-white/40">{label}</h4>
       </div>
       <div className="pl-1">
          {children}
       </div>
    </div>
  );
}

function SpectralVisualizer({ active, analyser }: { active: boolean, analyser?: AnalyserNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (analyser) {
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);
    }

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth * window.devicePixelRatio;
        canvas.height = parent.clientHeight * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      const w = canvas.width / window.devicePixelRatio;
      const h = canvas.height / window.devicePixelRatio;

      ctx.fillStyle = 'rgba(14, 14, 16, 0.4)';
      ctx.fillRect(0, 0, w, h);

      // Grid Lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 50) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += 50) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      if (active) {
        if (analyser && dataArrayRef.current) {
          analyser.getByteFrequencyData(dataArrayRef.current);
          
          const barCount = dataArrayRef.current.length;
          const barWidth = w / barCount;
          
          for (let i = 0; i < barCount; i++) {
            const val = dataArrayRef.current[i];
            const barH = (val / 255) * h * 0.8;
            
            const hue = (i / barCount) * 120 + 100; // Green to Blue
            ctx.fillStyle = `hsla(${hue}, 70%, 50%, ${0.3 + (val/255) * 0.7})`;
            ctx.fillRect(i * barWidth, h - barH, barWidth - 1, barH);
            
            // Draw a second bar at the top for some "reflection"
            ctx.fillStyle = `hsla(${hue}, 70%, 50%, 0.1)`;
            ctx.fillRect(i * barWidth, 0, barWidth - 1, barH / 2);
          }

          // Waveform line overlay
          const timeData = new Uint8Array(analyser.fftSize);
          analyser.getByteTimeDomainData(timeData);
          
          ctx.beginPath();
          ctx.strokeStyle = '#1db954';
          ctx.lineWidth = 2;
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#1db954';
          
          const sliceWidth = w / analyser.fftSize;
          let x = 0;
          for (let i = 0; i < analyser.fftSize; i++) {
            const v = timeData[i] / 128.0;
            const y = v * h / 2;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
        } else {
          // Fallback animation if no analyser yet
          ctx.beginPath();
          ctx.moveTo(0, h / 2);
          ctx.strokeStyle = '#1db954';
          ctx.lineWidth = 2;
          const time = Date.now() / 200;
          for (let x = 0; x < w; x += 2) {
            const y = (h / 2) + Math.sin(x * 0.02 + time) * 20 + Math.sin(x * 0.01 - time * 0.5) * 40;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.stroke();
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(requestRef.current);
    };
  }, [active, analyser]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}

function MasterMeter({ active, volume, analyser }: { active: boolean, volume: number, analyser?: AnalyserNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [level, setLevel] = useState(0);
  const [peak, setPeak] = useState(0);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    if (!active || !analyser) {
      setLevel(0);
      return;
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const update = () => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      const normalized = (avg / 255) * volume;
      
      setLevel(prev => prev * 0.8 + normalized * 0.2);
      setPeak(prev => Math.max(prev * 0.98, normalized));
      
      requestRef.current = requestAnimationFrame(update);
    };

    requestRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(requestRef.current);
  }, [active, analyser, volume]);

  const segments = 40;
  return (
    <div className="flex-1 flex flex-col-reverse gap-px" ref={containerRef}>
      {Array.from({ length: segments }).map((_, i) => {
        const threshold = (i / segments);
        const isActive = level > threshold;
        const isPeak = Math.abs(peak - threshold) < (1/segments);
        
        let color = 'bg-primary/20';
        if (threshold > 0.85) color = isActive ? 'bg-scarlet shadow-[0_0_8px_#ff2e2e]' : 'bg-scarlet/10';
        else if (threshold > 0.7) color = isActive ? 'bg-amber shadow-[0_0_8px_#ffb700]' : 'bg-amber/10';
        else color = isActive ? 'bg-primary shadow-[0_0_8px_#1db954]' : 'bg-primary/10';

        if (isPeak && !isActive) color = 'bg-white/40 shadow-[0_0_4px_white]';

        return (
          <div 
            key={i} 
            className={`w-full flex-1 rounded-xs transition-colors duration-75 ${color}`}
          />
        );
      })}
    </div>
  );
}

function EQVisualizer({ active, eq }: { active: boolean, eq: any }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth * window.devicePixelRatio;
        canvas.height = parent.clientHeight * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      const w = canvas.width / window.devicePixelRatio;
      const h = canvas.height / window.devicePixelRatio;

      ctx.clearRect(0, 0, w, h);

      // Draw Grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < w; x += w / 10) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += h / 4) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // Draw EQ Curve
      ctx.beginPath();
      ctx.strokeStyle = '#1db954';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      
      // Create robust fallbacks for all eq properties to avoid "Cannot read properties of undefined (reading 'freq')"
      const safeEq = {
        hpf: eq?.hpf ?? 20,
        low: { freq: eq?.low?.freq ?? 100, gain: eq?.low?.gain ?? 0, q: eq?.low?.q ?? 0.7 },
        lowMid: { freq: eq?.lowMid?.freq ?? 250, gain: eq?.lowMid?.gain ?? 0, q: eq?.lowMid?.q ?? 1.0 },
        mid: { freq: eq?.mid?.freq ?? 1000, gain: eq?.mid?.gain ?? 0, q: eq?.mid?.q ?? 1.0 },
        highMid: { freq: eq?.highMid?.freq ?? 2500, gain: eq?.highMid?.gain ?? 0, q: eq?.highMid?.q ?? 1.0 },
        high: { freq: eq?.high?.freq ?? 10000, gain: eq?.high?.gain ?? 0, q: eq?.high?.q ?? 0.7 },
        lpf: eq?.lpf ?? 20000
      };

      const centerY = h / 2;
      const sensitivity = 2;

      // Frequency mapping helper (Logarithmic scale 20Hz - 20kHz)
      const freqToX = (f: number) => {
        return (Math.log10(f) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20)) * w;
      };

      const xToFreq = (x: number) => {
        return Math.pow(10, (x / w) * (Math.log10(20000) - Math.log10(20)) + Math.log10(20));
      };

      for (let x = 0; x <= w; x++) {
        const freq = xToFreq(x);
        let offset = 0;
        
        // HPF Approximation (dB)
        const hpfdB = 20 * Math.log10(1 / Math.sqrt(1 + Math.pow(safeEq.hpf / freq, 6)));
        offset += Math.max(-60, hpfdB) * sensitivity;

        // Low shelf (approx 100Hz)
        const lowQ = safeEq.low.q;
        const lowFactor = Math.exp(-Math.pow(freq / (150 * lowQ), 2));
        offset += safeEq.low.gain * lowFactor * sensitivity;
        
        // Low-Mid bell
        const lmFreq = safeEq.lowMid.freq;
        const lmQ = safeEq.lowMid.q;
        const lmFactor = Math.exp(-Math.pow((Math.log10(freq) - Math.log10(lmFreq)) * (4 / lmQ), 2));
        offset += safeEq.lowMid.gain * lmFactor * sensitivity;

        // Mid bell (centered at 1k)
        const midFreq = safeEq.mid.freq;
        const midQ = safeEq.mid.q;
        const midFactor = Math.exp(-Math.pow((Math.log10(freq) - Math.log10(midFreq)) * (4 / midQ), 2));
        offset += safeEq.mid.gain * midFactor * sensitivity;

        // High-Mid bell
        const hmFreq = safeEq.highMid.freq;
        const hmQ = safeEq.highMid.q;
        const hmFactor = Math.exp(-Math.pow((Math.log10(freq) - Math.log10(hmFreq)) * (4 / hmQ), 2));
        offset += safeEq.highMid.gain * hmFactor * sensitivity;
        
        // High shelf
        const highQ = safeEq.high.q;
        const highFactor = 1 - Math.exp(-Math.pow(freq / (10000 * highQ), 2));
        offset += safeEq.high.gain * highFactor * sensitivity;

        // LPF Approximation (dB)
        const lpfdB = 20 * Math.log10(1 / Math.sqrt(1 + Math.pow(freq / safeEq.lpf, 6)));
        offset += Math.max(-60, lpfdB) * sensitivity;

        const y = centerY - offset;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(29, 185, 84, 0.5)';
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Fill
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.fillStyle = 'rgba(29, 185, 84, 0.05)';
      ctx.fill();

      // Real-time spectral simulation (linked to EQ curve)
      if (active) {
        const barCount = 60;
        const barWidth = w / barCount;
        for (let i = 0; i < barCount; i++) {
          const x = i * barWidth;
          const freq = xToFreq(x);
          
          let eqOffset = 0;
          const hpfdB = 20 * Math.log10(1 / Math.sqrt(1 + Math.pow(safeEq.hpf / freq, 6)));
          eqOffset += Math.max(-60, hpfdB);

          eqOffset += safeEq.low.gain * Math.exp(-Math.pow(freq / (150 * safeEq.low.q), 2));
          eqOffset += safeEq.lowMid.gain * Math.exp(-Math.pow((Math.log10(freq) - Math.log10(safeEq.lowMid.freq)) * (4 / safeEq.lowMid.q), 2));
          eqOffset += safeEq.mid.gain * Math.exp(-Math.pow((Math.log10(freq) - Math.log10(safeEq.mid.freq)) * (4 / safeEq.mid.q), 2));
          eqOffset += safeEq.highMid.gain * Math.exp(-Math.pow((Math.log10(freq) - Math.log10(safeEq.highMid.freq)) * (4 / safeEq.highMid.q), 2));
          eqOffset += safeEq.high.gain * (1 - Math.exp(-Math.pow(freq / (10000 * safeEq.high.q), 2)));

          const lpfdB = 20 * Math.log10(1 / Math.sqrt(1 + Math.pow(freq / safeEq.lpf, 6)));
          eqOffset += Math.max(-60, lpfdB);
          
          const noise = Math.random() * 15;
          const barH = Math.max(0, (h * 0.15) + (eqOffset * sensitivity) + noise);
          
          ctx.fillStyle = `rgba(29, 185, 84, ${0.1 + (Math.random() * 0.1)})`;
          ctx.fillRect(i * barWidth, h - barH, barWidth - 1, barH);
        }
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(requestRef.current);
    };
  }, [active, eq]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}

function Goniometer({ active, width }: { active: boolean, width: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth * window.devicePixelRatio;
        canvas.height = parent.clientHeight * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      const w = canvas.width / window.devicePixelRatio;
      const h = canvas.height / window.devicePixelRatio;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, w, h);

      // Grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
      ctx.moveTo(0, h); ctx.lineTo(w / 2, 0); ctx.lineTo(w, h);
      ctx.stroke();

      if (active) {
        const centerX = w / 2;
        const baseY = h - 20;
        const maxLen = h - 40;
        
        ctx.beginPath();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#1db954';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#1db954';

        const pointCount = 20;
        const widthFactor = width / 100;

        for (let i = 0; i < pointCount; i++) {
          const t = Date.now() / 100 + i;
          const angle = (Math.random() - 0.5) * 0.8 * widthFactor;
          const length = maxLen * (0.6 + Math.random() * 0.4);
          
          const x = centerX + Math.sin(angle) * length;
          const y = baseY - Math.cos(angle) * length;
          
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.moveTo(w/2, h-20);
        ctx.lineTo(w/2, 20);
        ctx.stroke();
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(requestRef.current);
    };
  }, [active, width]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}

function Knob({ label, min, max, value = 0, onChange, unit = '', defaultValue }: { label: string, min: number, max: number, value: number, onChange: (v: number) => void, unit?: string, defaultValue?: number }) {
  const safeValue = typeof value === 'number' ? value : 0;
  const rotation = ((safeValue - min) / (max - min)) * 270 - 135;
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startVal = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    startY.current = e.clientY;
    startVal.current = safeValue;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    const deltaY = startY.current - e.clientY;
    const range = max - min;
    const newVal = Math.min(max, Math.max(min, startVal.current + (deltaY / 180) * range));
    onChange(newVal);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // Touch event handlers for mobile gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    startY.current = e.touches[0].clientY;
    startVal.current = safeValue;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const deltaY = startY.current - e.touches[0].clientY;
    const range = max - min;
    const newVal = Math.min(max, Math.max(min, startVal.current + (deltaY / 160) * range));
    onChange(newVal);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    const target = defaultValue !== undefined ? defaultValue : (min <= 0 && max >= 0 ? 0 : min);
    onChange(target);
  };

  return (
    <div className="flex flex-col items-center gap-1.5 group select-none">
       <span className="engraved-label text-[7.5px] sm:text-[8px] text-white/40 tracking-wider truncate max-w-[80px]">{label}</span>
       <div 
         onMouseDown={handleMouseDown}
         onTouchStart={handleTouchStart}
         onTouchMove={handleTouchMove}
         onTouchEnd={handleTouchEnd}
         onTouchCancel={handleTouchEnd}
         onDoubleClick={handleReset}
         style={{ touchAction: 'none' }}
         className="w-9 h-9 sm:w-10 sm:h-10 relative cursor-ns-resize active:scale-95 transition-transform"
         title={`${label}: ${safeValue.toFixed(1)}${unit} (Arraste ou dê duplo clique para resetar)`}
       >
          {/* Octagonal Outer Border */}
          <div 
            className="absolute inset-0 bg-[#333] group-hover:bg-primary/50 transition-colors"
            style={{
              clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)'
            }}
          />
          {/* Octagonal Knob Body Face */}
          <div 
            className="absolute inset-[1px] cnc-knob"
            style={{
              clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)'
            }}
          >
             <motion.div 
               animate={{ rotate: rotation }}
               transition={{ type: 'spring', damping: 20, stiffness: 200 }}
               className="absolute inset-0 flex flex-col items-center pt-1"
             >
                <div className="w-0.5 h-2 sm:h-2.5 bg-primary rounded-full shadow-[0_0_8px_#1db954]" />
             </motion.div>
          </div>
       </div>
       <div 
         onClick={handleReset}
         className="flex items-center gap-0.5 cursor-pointer hover:text-primary transition-colors"
         title="Clique para resetar"
       >
          <span className="font-mono text-[8.5px] sm:text-[9px] font-bold text-white/70">
            {typeof safeValue === 'number' ? safeValue.toFixed(1) : '0.0'}
          </span>
          <span className="text-[7px] font-mono text-white/30 uppercase">{unit}</span>
       </div>
    </div>
  );
}

function Slider({ label, value = 0, onChange, min, max, unit = '', danger = false }: { label: string, value: number, onChange: (v: number) => void, min: number, max: number, unit?: string, danger?: boolean }) {
  const safeValue = typeof value === 'number' ? value : 0;
  const percentage = ((safeValue - min) / (max - min)) * 100;
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end px-1">
        <span className="engraved-label text-[8px] text-white/30">{label}</span>
        <span className={`font-mono font-bold text-[10px] ${danger ? 'text-scarlet neon-glow-scarlet' : 'text-primary neon-glow-emerald'}`}>
          {safeValue > 0 ? '+' : ''}
          {typeof safeValue === 'number' ? safeValue.toFixed(1) : '0.0'} <span className="opacity-40">{unit}</span>
        </span>
      </div>
      <div className="relative h-6 flex items-center group cursor-pointer">
        <div className="absolute inset-x-0 h-1 bg-black rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] border border-white/5" />
        <div 
          className={`absolute h-1 rounded-full ${danger ? 'bg-scarlet' : 'bg-primary'} transition-all`} 
          style={{ 
            width: `${percentage}%`, 
            filter: danger ? 'drop-shadow(0 0 4px #ff2e2e)' : 'drop-shadow(0 0 4px #1db954)' 
          }} 
        />
        <input 
          type="range"
          min={min}
          max={max}
          step={0.1}
          value={safeValue}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div 
          className={`absolute w-3 h-4 bg-linear-to-b from-graphite to-obsidian border border-white/10 rounded-sm shadow-xl pointer-events-none z-20 group-hover:border-primary/40 transition-all`}
          style={{ left: `${percentage}%`, transform: 'translateX(-50%)' }}
        >
           <div className={`w-full h-px bg-primary/40 mt-1.5`} />
        </div>
      </div>
    </div>
  );
}
