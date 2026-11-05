import React, { createContext, useContext, useState, ReactNode, useEffect, useRef, useCallback, useMemo } from 'react';
import { auth, db, googleProvider, signInWithPopup, onAuthStateChanged, User } from '../lib/firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  deleteDoc,
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { Language, translations } from '../translations';
import { generateDemoLoop } from '../utils/audioSynth';
import { 
  saveTrackAudio, 
  getTrackAudio, 
  saveDecodedAudioBuffer, 
  getDecodedAudioBuffer, 
  saveSessionState, 
  getSessionState, 
  deleteTrackAudio 
} from '../utils/audioStorage';
import { 
  identifyAudioHardware, 
  AudioDeviceInfoExtended, 
  POPULAR_STUDIO_INTERFACES 
} from '../utils/audioDeviceDetector';
import { compressArtworkForStorage } from '../utils/imageCompression';

export type AudioClip = {
  id: string;
  startTime: number; // Start in the source audio (seconds)
  endTime: number;   // End in the source audio (seconds)
  trackOffset: number; // Where it starts on the timeline (seconds)
  fadeInDuration?: number; // In seconds
  fadeOutDuration?: number; // In seconds
  name: string;
};

export type Track = {
  id: string;
  name: string;
  artist: string;
  bpm: number;
  key: string;
  duration: number;
  file?: File | null;
  status: 'pending' | 'analyzed' | 'mastered';
  metadata: Record<string, any>;
  settings?: MasteringSettings;
  clips?: AudioClip[];
  userId: string;
  createdAt?: any;
  updatedAt?: any;
};

export type Preset = {
  id: string;
  name: string;
  settings: MasteringSettings;
  userId?: string;
  createdAt?: any;
};

export type ExportSettings = {
  formats: string[];
  mp3Quality: string;
  ditherEnabled: boolean;
};

export type ExportPreset = {
  id: string;
  name: string;
  settings: ExportSettings;
  userId?: string;
  createdAt?: any;
};

export type EQBand = {
  freq: number;
  gain: number;
  q: number;
};

export type DynamicsBand = {
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  gain: number;
};

export type MasteringSettings = {
  eq: {
    hpf: number;
    low: EQBand;
    lowMid: EQBand;
    mid: EQBand;
    highMid: EQBand;
    high: EQBand;
    lpf: number;
  };
  dynamics: {
    low: DynamicsBand;
    mid: DynamicsBand;
    high: DynamicsBand;
  };
  compression: number;
  limiter: number;
  stereoWidthL: number;
  stereoWidthR: number;
  stereoLink: boolean;
  bassMono?: boolean;
  saturation: number;
  reverb: number;
  delay: number;
  exciter: {
    amount: number;
    color: number;
  };
  gain: number;
  masterVolume: number;
  lufsTarget: number;
  ditherEnabled: boolean;
  ditherType: string;
  bitDepth: number;
};

interface MasteringContextType {
  user: User | null;
  loading: boolean;
  saving: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  currentTrack: Track | null;
  setCurrentTrack: (track: Track | null) => void;
  tracks: Track[];
  addTrack: (track: Omit<Track, 'id' | 'userId'>) => Promise<Track | undefined>;
  deleteTrack: (id: string) => Promise<void>;
  duplicateTrack: (track: Track) => Promise<void>;
  renameTrack: (id: string, newName: string) => Promise<void>;
  updateTrackTags: (id: string, updatedFields: { name?: string, artist?: string, settings?: MasteringSettings, metadata?: Record<string, any> }) => Promise<void>;
  settings: MasteringSettings;
  updateSettings: (newSettings: Partial<MasteringSettings>) => Promise<void>;
  presets: Preset[];
  addPreset: (name: string, settings: MasteringSettings) => Promise<void>;
  deletePreset: (id: string) => Promise<void>;

  // Undo/Redo parameters history tracking
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  exportPresets: ExportPreset[];
  addExportPreset: (name: string, settings: ExportSettings) => Promise<void>;
  deleteExportPreset: (id: string) => Promise<void>;
  activeSection: string;
  setActiveSection: (section: string) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;

  // Global Audio Engine Integration
  audioBuffer: AudioBuffer | null;
  isPlaying: boolean;
  currentTime: number;
  isLoadingAudio: boolean;
  isEngaged: boolean;
  setIsEngaged: (engaged: boolean) => void;
  isMonoAudition: boolean;
  setIsMonoAudition: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  toggleMonoAudition: () => void;
  autoGainMatch: boolean;
  setAutoGainMatch: (enabled: boolean) => void;
  autoGainOffsetDb: number;
  audioContextRef: React.MutableRefObject<AudioContext | null>;
  nodesRef: React.MutableRefObject<any>;
  togglePlayback: () => void;
  handleSeek: (time: number) => void;
  loadAudio: (file: File) => Promise<void>;
  loadDemoTrack: () => Promise<void>;
  getTrackAudioBuffer: (track: Track) => Promise<AudioBuffer>;

  // Global System Preferences
  appTheme: 'DARK' | 'LIGHT' | 'SYSTEM';
  setAppTheme: (theme: 'DARK' | 'LIGHT' | 'SYSTEM') => void;
  glowIntensity: number;
  setGlowIntensity: (intensity: number) => void;
  audioOutputDevices: (AudioDeviceInfoExtended & { label: string })[];
  audioInputDevices: (AudioDeviceInfoExtended & { label: string })[];
  allAudioDevices: (AudioDeviceInfoExtended & { label: string })[];
  externalAudioDevices: (AudioDeviceInfoExtended & { label: string })[];
  activeAudioHardware: (AudioDeviceInfoExtended & { label: string }) | null;
  selectedAudioOutput: string;
  setSelectedAudioOutput: (id: string) => void;
  selectedAudioInput: string;
  setSelectedAudioInput: (id: string) => void;
  audioDriver: string;
  setAudioDriver: (driver: string) => void;
  detectedOS: string;
  hasDevicePermission: boolean;
  requestDevicePermission: () => Promise<boolean>;
  refreshAudioDevices: () => Promise<void>;
  lastHardwareEvent: { message: string; timestamp: number } | null;
}

export const defaultSettings: MasteringSettings = {
  eq: { 
    hpf: 20,
    low: { freq: 100, gain: 0, q: 0.7 }, 
    lowMid: { freq: 250, gain: 0, q: 1.0 },
    mid: { freq: 1000, gain: 0, q: 1.0 }, 
    highMid: { freq: 2500, gain: 0, q: 1.0 },
    high: { freq: 10000, gain: 0, q: 0.7 },
    lpf: 20000
  },
  dynamics: {
    low: { threshold: -20, ratio: 1, attack: 30, release: 100, gain: 0 },
    mid: { threshold: -20, ratio: 1, attack: 15, release: 50, gain: 0 },
    high: { threshold: -20, ratio: 1, attack: 5, release: 30, gain: 0 },
  },
  compression: 0,
  limiter: -0.3,
  stereoWidthL: 100,
  stereoWidthR: 100,
  stereoLink: true,
  bassMono: false,
  saturation: 0,
  reverb: 0,
  delay: 0,
  exciter: { amount: 0, color: 50 },
  gain: 0,
  masterVolume: 1,
  lufsTarget: -14,
  ditherEnabled: true,
  ditherType: 'POW-r Type 1',
  bitDepth: 16,
};

export function mergeSettings(parsed: any): MasteringSettings {
  if (!parsed) return { ...defaultSettings };
  
  const mergedEq = { ...defaultSettings.eq };
  if (parsed.eq) {
    Object.keys(parsed.eq).forEach(key => {
      const val = parsed.eq[key];
      if (typeof val === 'object' && val !== null) {
        (mergedEq as any)[key] = { ...(mergedEq as any)[key], ...val };
      } else if (typeof val === 'number') {
        if (['low', 'lowMid', 'mid', 'highMid', 'high'].includes(key)) {
          (mergedEq as any)[key] = { ...(mergedEq as any)[key], gain: val };
        } else if (key === 'hpf' || key === 'lpf') {
          (mergedEq as any)[key] = val;
        }
      }
    });
  }

  const mergedDynamics = { ...defaultSettings.dynamics };
  if (parsed.dynamics) {
    Object.keys(parsed.dynamics).forEach(key => {
      const val = parsed.dynamics[key];
      if (typeof val === 'object' && val !== null) {
        (mergedDynamics as any)[key] = { ...(mergedDynamics as any)[key], ...val };
      }
    });
  }

  const mergedExciter = { ...defaultSettings.exciter };
  if (parsed.exciter && typeof parsed.exciter === 'object') {
    Object.assign(mergedExciter, parsed.exciter);
  }

  return {
    ...defaultSettings,
    ...parsed,
    eq: mergedEq,
    dynamics: mergedDynamics,
    exciter: mergedExciter
  };
}

function useLocalStorage<T>(key: string, initialValue: T, parser?: (val: any) => T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item);
        return parser ? parser(parsed) : parsed;
      }
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
    }
    return initialValue;
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      setStoredValue((prev) => {
        const valueToStore = value instanceof Function ? value(prev) : value;
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        return valueToStore;
      });
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key]);

  return [storedValue, setValue] as const;
}

const MasteringContext = createContext<MasteringContextType | undefined>(undefined);

export function MasteringProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTrack, _setCurrentTrack] = useState<Track | null>(null);
  
  // Cache to store physical File uploads mapped by track ID
  const trackFilesRef = useRef<Record<string, File>>({});
  const [detectedOS, setDetectedOS] = useState<string>('Detecting...');

  const [settings, setSettings] = useLocalStorage<MasteringSettings>(
    'mastercore_settings',
    defaultSettings,
    mergeSettings
  );

  const setCurrentTrack = useCallback((track: Track | null) => {
    if (track) {
      if (track.file) {
        trackFilesRef.current[track.id] = track.file;
      } else if (trackFilesRef.current[track.id]) {
        track.file = trackFilesRef.current[track.id];
      }
    }
    _setCurrentTrack(track);
  }, []);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [exportPresets, setExportPresets] = useState<ExportPreset[]>([]);
  const [activeSection, setActiveSection] = useState('MASTERING');
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('mastercore_lang') as Language) || 'en';
  });

  // --- UNDO/REDO HISTORY STACK ENGINE ---
  const [history, setHistory] = useState<{
    stack: MasteringSettings[];
    index: number;
  }>({
    stack: [settings || defaultSettings],
    index: 0
  });

  const historyTimerRef = useRef<any>(null);
  const isRevertingRef = useRef(false);

  const resetHistory = useCallback((initialSettings: MasteringSettings) => {
    setHistory({
      stack: [initialSettings],
      index: 0
    });
  }, []);

  const recordStateChange = useCallback((newSettings: MasteringSettings) => {
    if (isRevertingRef.current) return;

    if (historyTimerRef.current) {
      clearTimeout(historyTimerRef.current);
    }

    historyTimerRef.current = setTimeout(() => {
      setHistory(prev => {
        // Truncate future states if we performed undo and then tweaked a parameter
        const currentStack = prev.stack.slice(0, prev.index + 1);
        const lastSaved = currentStack[currentStack.length - 1];

        // Guard: Skip redundant identical state pushes
        if (lastSaved && JSON.stringify(lastSaved) === JSON.stringify(newSettings)) {
          return prev;
        }

        const newStack = [...currentStack, newSettings];
        
        // Circular buffer constraint: max 60 history stack levels to preserve memory profiles
        if (newStack.length > 60) {
          newStack.shift();
        }

        return {
          stack: newStack,
          index: newStack.length - 1
        };
      });
    }, 600); // 600ms tactical parameter settling window
  }, []);

  const undo = useCallback(async () => {
    let targetSettings: MasteringSettings | null = null;
    
    setHistory(prev => {
      if (prev.index > 0) {
        const nextIndex = prev.index - 1;
        targetSettings = prev.stack[nextIndex];
        return {
          ...prev,
          index: nextIndex
        };
      }
      return prev;
    });

    if (targetSettings) {
      isRevertingRef.current = true;
      setSettings(targetSettings);
      
      if (user && currentTrack) {
        const path = `users/${user.uid}/tracks/${currentTrack.id}`;
        try {
          setSaving(true);
          await updateDoc(doc(db, path), {
            settings: targetSettings,
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          console.error("Undo DB sync failed:", error);
        } finally {
          setSaving(false);
        }
      } else if (currentTrack) {
        const updatedTrack = { ...currentTrack, settings: targetSettings };
        _setCurrentTrack(updatedTrack);
        
        const updatedList = tracks.map(t => t.id === currentTrack.id ? updatedTrack : t);
        setTracks(updatedList);
        localStorage.setItem('mastercore_local_tracks', JSON.stringify(updatedList.map(t => {
          const { file, ...rest } = t;
          return rest;
        })));
      }

      setTimeout(() => {
        isRevertingRef.current = false;
      }, 50);
    }
  }, [user, currentTrack, tracks, setSettings]);

  const redo = useCallback(async () => {
    let targetSettings: MasteringSettings | null = null;
    
    setHistory(prev => {
      if (prev.index < prev.stack.length - 1) {
        const nextIndex = prev.index + 1;
        targetSettings = prev.stack[nextIndex];
        return {
          ...prev,
          index: nextIndex
        };
      }
      return prev;
    });

    if (targetSettings) {
      isRevertingRef.current = true;
      setSettings(targetSettings);
      
      if (user && currentTrack) {
        const path = `users/${user.uid}/tracks/${currentTrack.id}`;
        try {
          setSaving(true);
          await updateDoc(doc(db, path), {
            settings: targetSettings,
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          console.error("Redo DB sync failed:", error);
        } finally {
          setSaving(false);
        }
      } else if (currentTrack) {
        const updatedTrack = { ...currentTrack, settings: targetSettings };
        _setCurrentTrack(updatedTrack);
        
        const updatedList = tracks.map(t => t.id === currentTrack.id ? updatedTrack : t);
        setTracks(updatedList);
        localStorage.setItem('mastercore_local_tracks', JSON.stringify(updatedList.map(t => {
          const { file, ...rest } = t;
          return rest;
        })));
      }

      setTimeout(() => {
        isRevertingRef.current = false;
      }, 50);
    }
  }, [user, currentTrack, tracks, setSettings]);

  const canUndo = history.index > 0;
  const canRedo = history.index < history.stack.length - 1;

  // System Preference States
  const [appTheme, setAppTheme] = useState<'DARK' | 'LIGHT' | 'SYSTEM'>(() => {
    return (localStorage.getItem('mastercore_theme') as 'DARK' | 'LIGHT' | 'SYSTEM') || 'DARK';
  });

  const [glowIntensity, setGlowIntensity] = useState<number>(() => {
    const saved = localStorage.getItem('mastercore_glow');
    return saved !== null ? parseInt(saved, 10) : 100;
  });

  const [audioDriver, setAudioDriver] = useState<string>(() => {
    return localStorage.getItem('mastercore_driver') || 'Universal WebAudio Engine';
  });

  const [audioOutputDevices, setAudioOutputDevices] = useState<(AudioDeviceInfoExtended & { label: string })[]>([]);
  const [audioInputDevices, setAudioInputDevices] = useState<(AudioDeviceInfoExtended & { label: string })[]>([]);
  const [allAudioDevices, setAllAudioDevices] = useState<(AudioDeviceInfoExtended & { label: string })[]>([]);
  const [externalAudioDevices, setExternalAudioDevices] = useState<(AudioDeviceInfoExtended & { label: string })[]>([]);
  const [hasDevicePermission, setHasDevicePermission] = useState<boolean>(false);
  const [lastHardwareEvent, setLastHardwareEvent] = useState<{ message: string; timestamp: number } | null>(null);

  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>(() => {
    return localStorage.getItem('mastercore_audio_output') || 'default';
  });

  const [selectedAudioInput, setSelectedAudioInput] = useState<string>(() => {
    return localStorage.getItem('mastercore_audio_input') || 'default';
  });

  // Audio Engine State
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isEngaged, setIsEngaged] = useState(false);
  const [isMonoAudition, setIsMonoAudition] = useState(false);
  const toggleMonoAudition = useCallback(() => {
    setIsMonoAudition(prev => !prev);
  }, []);
  const [autoGainMatch, setAutoGainMatch] = useState<boolean>(() => {
    return localStorage.getItem('mastercore_autogain_match') === 'true';
  });

  const handleSetAutoGainMatch = (val: boolean) => {
    setAutoGainMatch(val);
    localStorage.setItem('mastercore_autogain_match', val ? 'true' : 'false');
  };

  // Estimated Auto-Gain level compensation delta based on mastering DSP processing (dB)
  const autoGainOffsetDb = useMemo(() => {
    const eqDelta = (
      (settings.eq.low.gain * 0.2) +
      (settings.eq.lowMid.gain * 0.25) +
      (settings.eq.mid.gain * 0.3) +
      (settings.eq.highMid.gain * 0.25) +
      (settings.eq.high.gain * 0.2)
    );
    const compMakeup = (settings.compression / 100) * 4.5;
    const limiterPush = Math.max(0, -settings.limiter) * 1.8;
    const saturationBoost = (settings.saturation / 100) * 1.5;
    const totalBoost = settings.gain + eqDelta + compMakeup + limiterPush + saturationBoost;
    return Number(Math.max(0, totalBoost).toFixed(1));
  }, [settings]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const nodesRef = useRef<{
    inputGain: GainNode;
    hpf: BiquadFilterNode;
    lpf: BiquadFilterNode;
    low: BiquadFilterNode;
    lowMid: BiquadFilterNode;
    mid: BiquadFilterNode;
    highMid: BiquadFilterNode;
    high: BiquadFilterNode;
    compressor: DynamicsCompressorNode;
    limiter: DynamicsCompressorNode;
    outputGain: GainNode;
    analyser: AnalyserNode;
    bypassGain: GainNode;
    masterGain: GainNode;
  } | null>(null);

  // Synchronize App Theme to localstorage & document DOM
  useEffect(() => {
    localStorage.setItem('mastercore_theme', appTheme);
    const applyTheme = (themeName: 'DARK' | 'LIGHT' | 'SYSTEM') => {
      if (themeName === 'LIGHT') {
        document.body.classList.add('light-theme');
      } else if (themeName === 'DARK') {
        document.body.classList.remove('light-theme');
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
          document.body.classList.remove('light-theme');
        } else {
          document.body.classList.add('light-theme');
        }
      }
    };
    applyTheme(appTheme);

    if (appTheme === 'SYSTEM') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme('SYSTEM');
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [appTheme]);

  // Synchronize Glow Intensity
  useEffect(() => {
    localStorage.setItem('mastercore_glow', glowIntensity.toString());
    document.documentElement.style.setProperty('--glow-intensity', (glowIntensity / 100).toString());
  }, [glowIntensity]);

  // Synchronize Audio Output Selection
  useEffect(() => {
    localStorage.setItem('mastercore_audio_output', selectedAudioOutput);
    const changeSinkId = async () => {
      try {
        if (audioContextRef.current && 'setSinkId' in audioContextRef.current) {
          await (audioContextRef.current as any).setSinkId(selectedAudioOutput);
        }
      } catch (e) {
        console.warn("setSinkId is not fully supported or restricted by iframe rules", e);
      }
    };
    changeSinkId();
  }, [selectedAudioOutput]);

  // Synchronize Audio Driver
  useEffect(() => {
    localStorage.setItem('mastercore_driver', audioDriver);
  }, [audioDriver]);

  // Synchronize Audio Input Selection
  useEffect(() => {
    localStorage.setItem('mastercore_audio_input', selectedAudioInput);
  }, [selectedAudioInput]);

  // Derived Active Hardware for currently selected output
  const activeAudioHardware = useMemo(() => {
    if (audioOutputDevices.length === 0) return null;
    const found = audioOutputDevices.find(d => d.deviceId === selectedAudioOutput);
    return found || audioOutputDevices[0] || null;
  }, [audioOutputDevices, selectedAudioOutput]);

  // Handle OS and platform detection
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const isMobile = /iphone|ipad|ipod|android|blackberry|iemobile|opera mini/i.test(ua);
    const isMac = /macintosh|mac os x/i.test(ua);
    const isWindows = /windows|win32/i.test(ua);
    const isLinux = /linux/i.test(ua);

    if (isMobile) {
      if (/iphone|ipad|ipod/i.test(ua)) {
        setDetectedOS('iOS Mobile (CoreAudio Mobile)');
      } else {
        setDetectedOS('Android Mobile (AAudio / OpenSL ES)');
      }
    } else if (isMac) {
      setDetectedOS('macOS (CoreAudio Engine)');
    } else if (isWindows) {
      setDetectedOS('Windows (WASAPI / ASIO Low-Latency)');
    } else if (isLinux) {
      setDetectedOS('Linux (ALSA Studio Engine)');
    } else {
      setDetectedOS('Generic (Universal WebAudio Engine)');
    }
  }, []);

  const getFallbackDevices = useCallback((): (AudioDeviceInfoExtended & { label: string })[] => {
    const ua = navigator.userAgent.toLowerCase();
    const isMobile = /iphone|ipad|ipod|android/i.test(ua);
    if (isMobile) {
      const raw = [
        { deviceId: 'default', kind: 'audiooutput' as const, label: 'Alto-falantes Integrados (Dispositivo Móvel)', groupId: 'g1' },
        { deviceId: 'bluetooth_out', kind: 'audiooutput' as const, label: 'Fone Sem Fio Bluetooth / AirPods Pro', groupId: 'g2' },
        { deviceId: 'usb_c_dac', kind: 'audiooutput' as const, label: 'Interface Externa USB-C / DAC Hi-Res', groupId: 'g3' }
      ];
      return raw.map(d => {
        const identified = identifyAudioHardware(d as any);
        return { ...identified, label: identified.cleanLabel };
      });
    } else {
      const raw = [
        { deviceId: 'default', kind: 'audiooutput' as const, label: 'Alto-falantes do Sistema / Saída Primária', groupId: 'g1' },
        { deviceId: 'usb_dac', kind: 'audiooutput' as const, label: 'Focusrite Scarlett 2i2 USB Audio Interface', groupId: 'g2' },
        { deviceId: 'aux_out', kind: 'audiooutput' as const, label: 'Saída Analógica de Fone (Line Out 3.5mm)', groupId: 'g3' },
        { deviceId: 'display_port', kind: 'audiooutput' as const, label: 'Saída de Áudio Digital HDMI / DisplayPort', groupId: 'g4' }
      ];
      return raw.map(d => {
        const identified = identifyAudioHardware(d as any);
        return { ...identified, label: identified.cleanLabel };
      });
    }
  }, []);

  // Enumerate actual devices and identify hardware models
  const refreshAudioDevices = useCallback(async () => {
    try {
      if (navigator.permissions && (navigator.permissions as any).query) {
        try {
          const status = await (navigator.permissions as any).query({ name: 'microphone' });
          if (status.state === 'granted') {
            setHasDevicePermission(true);
          }
        } catch (_) {}
      }

      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        const hasRealLabels = devices.some(d => d.label && d.label.trim().length > 0);
        if (hasRealLabels) {
          setHasDevicePermission(true);
        }

        const rawOutputs = devices.filter(d => d.kind === 'audiooutput');
        const rawInputs = devices.filter(d => d.kind === 'audioinput');

        let processedOutputs: (AudioDeviceInfoExtended & { label: string })[] = [];
        let processedInputs: (AudioDeviceInfoExtended & { label: string })[] = [];

        if (rawOutputs.length > 0) {
          processedOutputs = rawOutputs.map(device => {
            const identified = identifyAudioHardware(device);
            return {
              ...identified,
              label: identified.cleanLabel
            };
          });
        } else {
          processedOutputs = getFallbackDevices();
        }

        if (rawInputs.length > 0) {
          processedInputs = rawInputs.map(device => {
            const identified = identifyAudioHardware(device);
            return {
              ...identified,
              label: identified.cleanLabel
            };
          });
        } else {
          const fallbackIn = [
            { deviceId: 'default', kind: 'audioinput' as const, label: 'Microfone Integrado do Sistema', groupId: 'in1' },
            { deviceId: 'usb_mic', kind: 'audioinput' as const, label: 'Focusrite Scarlett USB Input (Ch 1/2)', groupId: 'in2' }
          ].map(d => {
            const id = identifyAudioHardware(d as any);
            return { ...id, label: id.cleanLabel };
          });
          processedInputs = fallbackIn;
        }

        const all = [...processedOutputs, ...processedInputs];
        const external = all.filter(d => d.isExternal);

        setAudioOutputDevices(processedOutputs);
        setAudioInputDevices(processedInputs);
        setAllAudioDevices(all);
        setExternalAudioDevices(external);
      } else {
        const fallbackOut = getFallbackDevices();
        setAudioOutputDevices(fallbackOut);
        setAllAudioDevices(fallbackOut);
      }
    } catch (err) {
      console.warn("Could not enumerate audio devices", err);
      const fallbackOut = getFallbackDevices();
      setAudioOutputDevices(fallbackOut);
      setAllAudioDevices(fallbackOut);
    }
  }, [getFallbackDevices]);

  // Request browser permission to reveal real device names & models
  const requestDevicePermission = useCallback(async (): Promise<boolean> => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setHasDevicePermission(true);
      await refreshAudioDevices();
      setLastHardwareEvent({
        message: 'Permissão concedida! Modelos e marcas de hardware identificados com sucesso.',
        timestamp: Date.now()
      });
      return true;
    } catch (err) {
      console.warn('Microphone permission denied by user or policy:', err);
      return false;
    }
  }, [refreshAudioDevices]);

  // Auto-refresh and listen for live hotplugging / device changes
  useEffect(() => {
    refreshAudioDevices();

    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      const handleDeviceChange = async () => {
        await refreshAudioDevices();
        setLastHardwareEvent({
          message: 'Dispositivo de áudio plugado ou desconectado detectado.',
          timestamp: Date.now()
        });
      };
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      };
    }
  }, [refreshAudioDevices]);

  const initAudioNodes = (ctx: AudioContext) => {
    if (nodesRef.current) return;
    
    const inputGain = ctx.createGain();
    const hpf = ctx.createBiquadFilter(); hpf.type = 'highpass';
    const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass';
    const low = ctx.createBiquadFilter(); low.type = 'lowshelf';
    const lowMid = ctx.createBiquadFilter(); lowMid.type = 'peaking';
    const mid = ctx.createBiquadFilter(); mid.type = 'peaking';
    const highMid = ctx.createBiquadFilter(); highMid.type = 'peaking';
    const high = ctx.createBiquadFilter(); high.type = 'highshelf';
    const compressor = ctx.createDynamicsCompressor();
    const limiter = ctx.createDynamicsCompressor();
    const outputGain = ctx.createGain();
    const analyser = ctx.createAnalyser();
    const bypassGain = ctx.createGain();
    const masterGain = ctx.createGain();
    const stereoGain = ctx.createGain();
    const monoSumGain = ctx.createGain();
    monoSumGain.channelCount = 1;
    monoSumGain.channelCountMode = 'explicit';
    monoSumGain.gain.setValueAtTime(0, ctx.currentTime);

    nodesRef.current = {
      inputGain, hpf, lpf, low, lowMid, mid, highMid, high,
      compressor, limiter, outputGain, analyser, bypassGain, masterGain,
      stereoGain, monoSumGain
    };

    // Wiring up the full signal routing chain
    // 1. Bypass Routing: inputGain -> bypassGain -> masterGain
    inputGain.connect(bypassGain);
    bypassGain.connect(masterGain);

    // 2. Premium Mastering Routing: inputGain -> HPF -> EQ Bands -> LPF -> Compressor -> Limiter -> outputGain -> masterGain
    inputGain.connect(hpf);
    hpf.connect(low);
    low.connect(lowMid);
    lowMid.connect(mid);
    mid.connect(highMid);
    highMid.connect(high);
    high.connect(lpf);
    lpf.connect(compressor);
    compressor.connect(limiter);
    limiter.connect(outputGain);
    outputGain.connect(masterGain);

    // 3. Stereo vs Mono Audition Matrix
    masterGain.connect(stereoGain);
    masterGain.connect(monoSumGain);

    stereoGain.connect(analyser);
    monoSumGain.connect(analyser);

    analyser.connect(ctx.destination);
  };

  // Auto-restore persisted AudioBuffer and mastering session from local IndexedDB on boot/refresh
  useEffect(() => {
    let isCancelled = false;
    async function restorePersistedSession() {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioContextRef.current;
        const lastTrackId = await getSessionState<string>('last_active_track_id');
        const targetId = lastTrackId || 'active_session_buffer';
        const restored = await getDecodedAudioBuffer(targetId, ctx);
        if (restored && !isCancelled) {
          console.log('[MasteringContext] Auto-hydrated persistent AudioBuffer from IndexedDB:', targetId, restored.duration.toFixed(2) + 's');
          setAudioBuffer(restored);
          initAudioNodes(ctx);
        }
      } catch (err) {
        console.warn('[MasteringContext] Persisted audio buffer check (non-fatal):', err);
      }
    }
    restorePersistedSession();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Synchronously update Web Audio core node properties whenever mastering settings or bypass is changed
  useEffect(() => {
    if (!audioContextRef.current || !nodesRef.current) return;
    const nodes = nodesRef.current;
    const ctx = audioContextRef.current;

    try {
      // Input Gain Staging
      if (nodes.inputGain) {
        const linearGain = Math.pow(10, (settings.gain ?? 0) / 20);
        nodes.inputGain.gain.setValueAtTime(linearGain, ctx.currentTime);
      }

      // Equalizers: Filter frequencies & gain
      if (nodes.hpf) nodes.hpf.frequency.value = settings.eq.hpf;
      if (nodes.lpf) nodes.lpf.frequency.value = settings.eq.lpf;

      if (nodes.low) {
        nodes.low.frequency.value = settings.eq.low.freq;
        nodes.low.gain.value = settings.eq.low.gain;
      }
      if (nodes.lowMid) {
        nodes.lowMid.frequency.value = settings.eq.lowMid.freq;
        nodes.lowMid.gain.value = settings.eq.lowMid.gain;
        nodes.lowMid.Q.value = settings.eq.lowMid.q;
      }
      if (nodes.mid) {
        nodes.mid.frequency.value = settings.eq.mid.freq;
        nodes.mid.gain.value = settings.eq.mid.gain;
        nodes.mid.Q.value = settings.eq.mid.q;
      }
      if (nodes.highMid) {
        nodes.highMid.frequency.value = settings.eq.highMid.freq;
        nodes.highMid.gain.value = settings.eq.highMid.gain;
        nodes.highMid.Q.value = settings.eq.highMid.q;
      }
      if (nodes.high) {
        nodes.high.frequency.value = settings.eq.high.freq;
        nodes.high.gain.value = settings.eq.high.gain;
      }

      // Compression
      if (nodes.compressor) {
        const comp = settings.compression;
        if (comp > 0) {
          nodes.compressor.threshold.value = -40 * (comp / 100);
          nodes.compressor.ratio.value = 1 + (comp / 10);
        } else {
          nodes.compressor.threshold.value = 0;
          nodes.compressor.ratio.value = 1;
        }
      }

      // Mastering Brickwall Limiter
      if (nodes.limiter) {
        nodes.limiter.threshold.setValueAtTime(Math.max(-20, settings.limiter), ctx.currentTime);
        nodes.limiter.ratio.setValueAtTime(20, ctx.currentTime);
        nodes.limiter.attack.setValueAtTime(0.001, ctx.currentTime);
        nodes.limiter.release.setValueAtTime(0.05, ctx.currentTime);
      }

      // Mastering volume controls
      if (nodes.masterGain) {
        nodes.masterGain.gain.setValueAtTime(settings.masterVolume, ctx.currentTime);
      }

      // Bypass / Engage Signal Mix with Auto-Gain Match level compensation
      if (isEngaged) {
        nodes.bypassGain.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
        const matchAttenuation = autoGainMatch && autoGainOffsetDb > 0.1
          ? Math.pow(10, -autoGainOffsetDb / 20)
          : 1.0;
        nodes.outputGain.gain.setTargetAtTime(matchAttenuation, ctx.currentTime, 0.02);
      } else {
        nodes.bypassGain.gain.setTargetAtTime(1, ctx.currentTime, 0.02);
        nodes.outputGain.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      }

      // Mono Audition Matrix
      if (nodes.stereoGain && nodes.monoSumGain) {
        if (isMonoAudition) {
          nodes.stereoGain.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
          nodes.monoSumGain.gain.setTargetAtTime(1, ctx.currentTime, 0.02);
        } else {
          nodes.stereoGain.gain.setTargetAtTime(1, ctx.currentTime, 0.02);
          nodes.monoSumGain.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
        }
      }
    } catch (e) {
      console.warn("Failed to update Web Audio engine parameter values:", e);
    }
  }, [settings, isEngaged, isMonoAudition, audioBuffer, autoGainMatch, autoGainOffsetDb]);

  const loadAudio = async (file: File) => {
    setIsLoadingAudio(true);
    try {
      const buffer = await file.arrayBuffer();
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const decodedData = await ctx.decodeAudioData(buffer);
      setAudioBuffer(decodedData);
      
      initAudioNodes(ctx);
      
      if (currentTrack && currentTrack.duration === 0) {
        setCurrentTrack({
          ...currentTrack,
          duration: Math.round(decodedData.duration)
        });
      }

      // Persist audio file and decoded 32-bit float channels to IndexedDB
      const activeId = currentTrack?.id || 'active_session_buffer';
      saveTrackAudio(activeId, file, {
        name: file.name,
        sampleRate: decodedData.sampleRate,
        duration: decodedData.duration
      });
      saveDecodedAudioBuffer(activeId, decodedData);
      saveDecodedAudioBuffer('active_session_buffer', decodedData);
      saveSessionState('last_active_track_id', activeId);
    } catch (err) {
      console.error("Audio decode error", err);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const loadDemoTrack = async () => {
    setIsLoadingAudio(true);
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const buffer = generateDemoLoop(ctx);
      setAudioBuffer(buffer);
      
      initAudioNodes(ctx);

      const demoTrack = {
        id: 'synth-demo-track',
        name: 'Nebula Core (AI Synth Test Loop)',
        artist: 'MasterCore AI Synth',
        bpm: 124,
        key: 'A Minor',
        duration: 10,
        status: 'analyzed' as const,
        metadata: { size: 'Synthetic', type: 'synth' },
        userId: user?.uid || 'guest'
      };

      setCurrentTrack((prev) => {
        if (prev) {
          return prev;
        }
        return demoTrack;
      });
    } catch (err) {
      console.error("Synthesizer loop load error", err);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const getTrackAudioBuffer = useCallback(async (targetTrack: Track): Promise<AudioBuffer> => {
    if (currentTrack && targetTrack.id === currentTrack.id && audioBuffer) {
      return audioBuffer;
    }
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    // 1. Check in-memory file reference
    const file = targetTrack.file || trackFilesRef.current[targetTrack.id];
    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuffer);
      saveDecodedAudioBuffer(targetTrack.id, decoded);
      return decoded;
    }

    // 2. Check persistent IndexedDB decoded buffer cache (instantaneous restoration)
    const persistedDecoded = await getDecodedAudioBuffer(targetTrack.id, ctx);
    if (persistedDecoded) {
      return persistedDecoded;
    }

    // 3. Check persistent IndexedDB raw track audio blob
    const persistedAudio = await getTrackAudio(targetTrack.id);
    if (persistedAudio && persistedAudio.blob) {
      const arrayBuffer = await persistedAudio.blob.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuffer);
      saveDecodedAudioBuffer(targetTrack.id, decoded);
      return decoded;
    }

    // 4. Fallback to synthetic demo loop
    return generateDemoLoop(ctx);
  }, [currentTrack, audioBuffer]);

  const togglePlayback = () => {
    if (!audioBuffer) return;
    
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    if (!nodesRef.current) {
      initAudioNodes(ctx);
    }

    if (isPlaying) {
      sourceRef.current?.stop();
      pauseTimeRef.current = ctx.currentTime - startTimeRef.current;
      setIsPlaying(false);
    } else {
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(nodesRef.current!.inputGain);
      
      const offset = pauseTimeRef.current % audioBuffer.duration;
      source.start(0, offset);
      sourceRef.current = source;
      startTimeRef.current = ctx.currentTime - offset;
      setIsPlaying(true);
      
      source.onended = () => {
        if (sourceRef.current === source) {
          setIsPlaying(false);
          pauseTimeRef.current = 0;
          setCurrentTime(0);
        }
      };
    }
  };

  const handleSeek = (time: number) => {
    if (!audioContextRef.current || !audioBuffer) return;
    const ctx = audioContextRef.current;
    setCurrentTime(time);
    pauseTimeRef.current = time;
    if (isPlaying) {
      try {
        sourceRef.current?.stop();
      } catch (e) {}
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(nodesRef.current!.inputGain);
      source.start(0, time);
      sourceRef.current = source;
      startTimeRef.current = ctx.currentTime - time;
      source.onended = () => {
        if (sourceRef.current === source) {
          setIsPlaying(false);
          pauseTimeRef.current = 0;
          setCurrentTime(0);
        }
      };
    }
  };

  // Keep track of current playtime
  useEffect(() => {
    let anim: number;
    const update = () => {
      if (isPlaying && audioContextRef.current && audioBuffer) {
        const time = audioContextRef.current.currentTime - startTimeRef.current;
        setCurrentTime(time % audioBuffer.duration);
      }
      anim = requestAnimationFrame(update);
    };
    anim = requestAnimationFrame(update);
    return () => cancelAnimationFrame(anim);
  }, [isPlaying, audioBuffer]);

  // Handle auto load buffer on track change
  useEffect(() => {
    // If playing, stop current
    if (isPlaying) {
      try {
        sourceRef.current?.stop();
      } catch (e) {}
      setIsPlaying(false);
    }
    pauseTimeRef.current = 0;
    setCurrentTime(0);

    if (currentTrack?.file) {
      loadAudio(currentTrack.file);
    } else if (currentTrack) {
      loadDemoTrack();
    } else {
      setAudioBuffer(null);
    }
  }, [currentTrack?.id]);

  const t = (key: string) => {
    return (translations[language] as any)[key] || key;
  };

  useEffect(() => {
    localStorage.setItem('mastercore_lang', language);
  }, [language]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Tracks Listener
  useEffect(() => {
    if (!user) {
      const savedLocal = localStorage.getItem('mastercore_local_tracks');
      if (savedLocal) {
        try {
          const parsed = JSON.parse(savedLocal);
          setTracks(parsed);
        } catch (e) {
          setTracks([]);
        }
      } else {
        const defaultTracks: Track[] = [
          {
            id: 'synth-demo-track',
            name: 'Nebula Core (AI Synth Test Loop)',
            artist: 'MasterCore AI Synth',
            bpm: 124,
            key: 'A Minor',
            duration: 10,
            status: 'analyzed' as const,
            metadata: { size: 'Synthetic', type: 'synth' },
            userId: 'guest'
          },
          {
            id: 'demo-2',
            name: 'Sunset Shadows',
            artist: 'Guest Producer',
            bpm: 98,
            key: 'G Minor',
            duration: 222,
            status: 'analyzed' as const,
            metadata: { size: '8.4 MB', type: 'preview' },
            userId: 'guest'
          }
        ];
        setTracks(defaultTracks);
        localStorage.setItem('mastercore_local_tracks', JSON.stringify(defaultTracks));
      }
      return;
    }

    const path = `users/${user.uid}/tracks`;
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const fetchedTracks = snapshot.docs.map(doc => {
          const id = doc.id;
          const cachedFile = trackFilesRef.current[id];
          return {
            id,
            ...doc.data(),
            file: cachedFile || undefined
          } as Track;
        });
        setTracks(fetchedTracks);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Presets Listener
  useEffect(() => {
    if (!user) {
      const saved = localStorage.getItem('mastercore_presets');
      if (saved) {
        try {
          setPresets(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to load local presets", e);
        }
      }
      return;
    }

    const path = `users/${user.uid}/presets`;
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const fetchedPresets = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Preset));
        setPresets(fetchedPresets);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Export Presets Listener
  useEffect(() => {
    if (!user) {
      const saved = localStorage.getItem('mastercore_export_presets');
      if (saved) {
        try {
          setExportPresets(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to load local export presets", e);
        }
      }
      return;
    }

    const path = `users/${user.uid}/export_presets`;
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const fetchedPresets = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as ExportPreset));
        setExportPresets(fetchedPresets);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const [saving, setSaving] = useState(false);

  // Sync settings when current track changes
  useEffect(() => {
    if (currentTrack?.settings) {
      const merged = mergeSettings(currentTrack.settings);
      setSettings(merged);
      resetHistory(merged);
    } else {
      resetHistory(defaultSettings);
    }
  }, [currentTrack?.id, resetHistory]);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const logout = async () => {
    try {
      await auth.signOut();
      setCurrentTrack(null);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const addTrack = async (trackData: Omit<Track, 'id' | 'userId'>): Promise<Track | undefined> => {
    // Omit File object as it's not supported by Firestore
    const { file, ...serializableData } = trackData;

    // Sanitize any large base64 image data in metadata.coverUrl
    let cleanSerializableData = { ...serializableData };
    if (cleanSerializableData.metadata?.coverUrl && typeof cleanSerializableData.metadata.coverUrl === 'string' && cleanSerializableData.metadata.coverUrl.startsWith('data:image/')) {
      try {
        cleanSerializableData.metadata = {
          ...cleanSerializableData.metadata,
          coverUrl: await compressArtworkForStorage(cleanSerializableData.metadata.coverUrl, 400, 0.82)
        };
      } catch (e) {
        console.warn('[MasteringContext] addTrack cover compression notice:', e);
      }
    }

    if (user) {
      const path = `users/${user.uid}/tracks`;
      try {
        setSaving(true);
        const docRef = await addDoc(collection(db, path), {
          ...cleanSerializableData,
          userId: user.uid,
          settings: settings,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        
        // Cache file reference locally in memory and persistent IndexedDB
        if (file) {
          trackFilesRef.current[docRef.id] = file;
          saveTrackAudio(docRef.id, file, { name: serializableData.name, duration: serializableData.duration });
          if (audioBuffer) {
            saveDecodedAudioBuffer(docRef.id, audioBuffer);
          }
        }

        const createdTrack: Track = {
          ...serializableData,
          id: docRef.id,
          userId: user.uid,
          file: file
        };
        return createdTrack;
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      } finally {
        setSaving(false);
      }
    } else {
      setSaving(true);
      const newLocalTrack: Track = {
        ...serializableData,
        id: 'local-' + Date.now(),
        userId: 'guest',
        file: file
      };
      // Cache file reference locally in memory and persistent IndexedDB
      if (file) {
        trackFilesRef.current[newLocalTrack.id] = file;
        saveTrackAudio(newLocalTrack.id, file, { name: serializableData.name, duration: serializableData.duration });
        if (audioBuffer) {
          saveDecodedAudioBuffer(newLocalTrack.id, audioBuffer);
        }
      }
      const updatedList = [newLocalTrack, ...tracks];
      setTracks(updatedList);
      localStorage.setItem('mastercore_local_tracks', JSON.stringify(updatedList.map(t => {
        const { file, ...rest } = t;
        return rest;
      })));
      setTimeout(() => setSaving(false), 300);
      return newLocalTrack;
    }
  };

  const deleteTrack = async (id: string) => {
    // Also remove any persistent audio blobs and decoded buffers
    deleteTrackAudio(id);

    if (user) {
      const path = `users/${user.uid}/tracks/${id}`;
      try {
        setSaving(true);
        await deleteDoc(doc(db, path));
        if (currentTrack?.id === id) {
          setCurrentTrack(null);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      } finally {
        setSaving(false);
      }
    } else {
      const updatedList = tracks.filter(t => t.id !== id);
      setTracks(updatedList);
      localStorage.setItem('mastercore_local_tracks', JSON.stringify(updatedList.map(t => {
        const { file, ...rest } = t;
        return rest;
      })));
      if (currentTrack?.id === id) {
        setCurrentTrack(null);
      }
    }
  };

  const duplicateTrack = async (trackToDup: Track) => {
    const { id, createdAt, updatedAt, file, ...serializableData } = trackToDup;
    const duplicatedName = `${trackToDup.name} (Copy)`;

    if (user) {
      const path = `users/${user.uid}/tracks`;
      try {
        setSaving(true);
        await addDoc(collection(db, path), {
          ...serializableData,
          name: duplicatedName,
          userId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      } finally {
        setSaving(false);
      }
    } else {
      setSaving(true);
      const duplicatedTrack: Track = {
        ...serializableData,
        name: duplicatedName,
        id: 'local-' + Date.now(),
        userId: 'guest',
        file: file
      };
      const updatedList = [duplicatedTrack, ...tracks];
      setTracks(updatedList);
      localStorage.setItem('mastercore_local_tracks', JSON.stringify(updatedList.map(t => {
        const { file, ...rest } = t;
        return rest;
      })));
      setTimeout(() => setSaving(false), 300);
    }
  };

  const renameTrack = async (id: string, newName: string) => {
    if (user) {
      const path = `users/${user.uid}/tracks/${id}`;
      try {
        setSaving(true);
        await updateDoc(doc(db, path), {
          name: newName,
          updatedAt: serverTimestamp(),
        });
        if (currentTrack?.id === id) {
          setCurrentTrack({ ...currentTrack, name: newName });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      } finally {
        setSaving(false);
      }
    } else {
      const updatedList = tracks.map(t => t.id === id ? { ...t, name: newName } : t);
      setTracks(updatedList);
      localStorage.setItem('mastercore_local_tracks', JSON.stringify(updatedList.map(t => {
        const { file, ...rest } = t;
        return rest;
      })));
      if (currentTrack?.id === id) {
        setCurrentTrack({ ...currentTrack, name: newName });
      }
    }
  };

  const updateTrackTags = async (id: string, updatedFields: { name?: string, artist?: string, settings?: MasteringSettings, metadata?: Record<string, any> }) => {
    let sanitizedFields = { ...updatedFields };

    // Deep guard: if metadata.coverUrl is provided as a data URI or large string, ensure it is compressed
    // to strictly preserve the Firestore document limit (<= 1MB).
    if (sanitizedFields.metadata && typeof sanitizedFields.metadata.coverUrl === 'string' && sanitizedFields.metadata.coverUrl.startsWith('data:image/')) {
      try {
        const compressedCover = await compressArtworkForStorage(sanitizedFields.metadata.coverUrl, 400, 0.82);
        sanitizedFields.metadata = {
          ...sanitizedFields.metadata,
          coverUrl: compressedCover
        };
      } catch (compErr) {
        console.warn('[MasteringContext] Cover image auto-compression notice:', compErr);
      }
    }

    if (user) {
      const path = `users/${user.uid}/tracks/${id}`;
      try {
        setSaving(true);
        await updateDoc(doc(db, path), {
          ...sanitizedFields,
          updatedAt: serverTimestamp(),
        });
        if (currentTrack?.id === id) {
          setCurrentTrack({ ...currentTrack, ...sanitizedFields });
          if (sanitizedFields.settings) {
            setSettings(sanitizedFields.settings);
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      } finally {
        setSaving(false);
      }
    } else {
      const updatedList = tracks.map(t => t.id === id ? { ...t, ...sanitizedFields } : t);
      setTracks(updatedList);
      localStorage.setItem('mastercore_local_tracks', JSON.stringify(updatedList.map(t => {
        const { file, ...rest } = t;
        return rest;
      })));
      if (currentTrack?.id === id) {
        setCurrentTrack({ ...currentTrack, ...sanitizedFields });
        if (sanitizedFields.settings) {
          setSettings(sanitizedFields.settings);
        }
      }
    }
  };

  const updateSettings = async (newSettings: Partial<MasteringSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    
    // Log parameter tweaks into the undo/redo engine safely
    recordStateChange(updated);

    if (user && currentTrack) {
      const path = `users/${user.uid}/tracks/${currentTrack.id}`;
      try {
        setSaving(true);
        await updateDoc(doc(db, path), {
          settings: updated,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      } finally {
        setTimeout(() => setSaving(false), 500); // Small delay for UX feel
      }
    } else {
      if (currentTrack) {
        const updatedTrack = { ...currentTrack, settings: updated };
        _setCurrentTrack(updatedTrack);
        
        const updatedList = tracks.map(t => t.id === currentTrack.id ? updatedTrack : t);
        setTracks(updatedList);
        localStorage.setItem('mastercore_local_tracks', JSON.stringify(updatedList.map(t => {
          const { file, ...rest } = t;
          return rest;
        })));
      }
      // Still show a quick flicker for local storage "save"
      setSaving(true);
      setTimeout(() => setSaving(false), 300);
    }
  };

  const addPreset = async (name: string, presetSettings: MasteringSettings) => {
    if (user) {
      const path = `users/${user.uid}/presets`;
      try {
        setSaving(true);
        await addDoc(collection(db, path), {
          name,
          settings: presetSettings,
          userId: user.uid,
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      } finally {
        setSaving(false);
      }
    } else {
      const newPreset: Preset = {
        id: Date.now().toString(),
        name,
        settings: presetSettings,
        createdAt: new Date().toISOString()
      };
      const updatedPresets = [newPreset, ...presets];
      setPresets(updatedPresets);
      localStorage.setItem('mastercore_presets', JSON.stringify(updatedPresets));
    }
  };

  const deletePreset = async (id: string) => {
    if (user) {
      const path = `users/${user.uid}/presets/${id}`;
      try {
        setSaving(true);
        // For simplicity let's just delete
        const { deleteDoc } = await import('firebase/firestore');
        await deleteDoc(doc(db, path));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      } finally {
        setSaving(false);
      }
    } else {
      const updatedPresets = presets.filter(p => p.id !== id);
      setPresets(updatedPresets);
      localStorage.setItem('mastercore_presets', JSON.stringify(updatedPresets));
    }
  };

  const addExportPreset = async (name: string, expSettings: ExportSettings) => {
    if (user) {
      const path = `users/${user.uid}/export_presets`;
      try {
        setSaving(true);
        await addDoc(collection(db, path), {
          name,
          settings: expSettings,
          userId: user.uid,
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      } finally {
        setSaving(false);
      }
    } else {
      const newPreset: ExportPreset = {
        id: Date.now().toString(),
        name,
        settings: expSettings,
        createdAt: new Date().toISOString()
      };
      const updatedPresets = [newPreset, ...exportPresets];
      setExportPresets(updatedPresets);
      localStorage.setItem('mastercore_export_presets', JSON.stringify(updatedPresets));
    }
  };

  const deleteExportPreset = async (id: string) => {
    if (user) {
      const path = `users/${user.uid}/export_presets/${id}`;
      try {
        setSaving(true);
        const { deleteDoc } = await import('firebase/firestore');
        await deleteDoc(doc(db, path));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      } finally {
        setSaving(false);
      }
    } else {
      const updatedPresets = exportPresets.filter(p => p.id !== id);
      setExportPresets(updatedPresets);
      localStorage.setItem('mastercore_export_presets', JSON.stringify(updatedPresets));
    }
  };

  return (
    <MasteringContext.Provider 
      value={{ 
        user,
        loading,
        saving,
        login,
        logout,
        currentTrack, 
        setCurrentTrack, 
        tracks, 
        addTrack, 
        deleteTrack,
        duplicateTrack,
        renameTrack,
        updateTrackTags,
        settings, 
        updateSettings,
        presets,
        addPreset,
        deletePreset,
        undo,
        redo,
        canUndo,
        canRedo,
        exportPresets,
        addExportPreset,
        deleteExportPreset,
        activeSection,
        setActiveSection,
        language,
        setLanguage,
        t,

        // Global Audio States & Handlers
        audioBuffer,
        isPlaying,
        currentTime,
        isLoadingAudio,
        isEngaged,
        setIsEngaged,
        isMonoAudition,
        setIsMonoAudition,
        toggleMonoAudition,
        autoGainMatch,
        setAutoGainMatch: handleSetAutoGainMatch,
        autoGainOffsetDb,
        audioContextRef,
        nodesRef,
        togglePlayback,
        handleSeek,
        loadAudio,
        loadDemoTrack,
        getTrackAudioBuffer,

        // Global System Preferences
        appTheme,
        setAppTheme,
        glowIntensity,
        setGlowIntensity,
        audioOutputDevicesNameSimulated: [], // fallback
        audioOutputDevices,
        audioInputDevices,
        allAudioDevices,
        externalAudioDevices,
        activeAudioHardware,
        selectedAudioOutput,
        setSelectedAudioOutput,
        selectedAudioInput,
        setSelectedAudioInput,
        audioDriver,
        setAudioDriver,
        detectedOS,
        hasDevicePermission,
        requestDevicePermission,
        refreshAudioDevices,
        lastHardwareEvent
      }}
    >
      {children}
    </MasteringContext.Provider>
  );
}

export function useMastering() {
  const context = useContext(MasteringContext);
  if (context === undefined) {
    throw new Error('useMastering must be used within a MasteringProvider');
  }
  return context;
}
