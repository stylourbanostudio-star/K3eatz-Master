import { EQBand, DynamicsBand, MasteringSettings } from '../context/MasteringContext';

export type PresetCategory = 
  | 'All' 
  | 'Punch & Bass' 
  | 'Tone & Air' 
  | 'Dynamic Glue' 
  | 'Genre Polish' 
  | 'Utility';

export interface EqCompPreset {
  id: string;
  name: string;
  category: PresetCategory;
  description: string;
  genreTag: string;
  eq: {
    hpf: number;
    low: EQBand;
    lowMid: EQBand;
    mid: EQBand;
    highMid: EQBand;
    high: EQBand;
    lpf: number;
  };
  compression: number; // 0 - 100 (%)
  dynamics: {
    low: DynamicsBand;
    mid: DynamicsBand;
    high: DynamicsBand;
  };
  highlightParams: {
    lowGain: string;
    highGain: string;
    glueCompression: string;
    char: string;
  };
}

export const EQ_COMP_PRESETS: EqCompPreset[] = [
  {
    id: 'modern-punch',
    name: 'Modern Punch & Weight',
    category: 'Punch & Bass',
    genreTag: 'Hip Hop / Urban',
    description: 'Tight sub-bass definition with lower-mid mud scooped at 240Hz and firm glue compression.',
    highlightParams: {
      lowGain: '+2.8 dB',
      highGain: '+2.0 dB',
      glueCompression: '35%',
      char: 'Firm & Punchy'
    },
    eq: {
      hpf: 28,
      low: { freq: 100, gain: 2.8, q: 0.85 },
      lowMid: { freq: 240, gain: -2.2, q: 1.2 },
      mid: { freq: 1000, gain: 0.0, q: 1.0 },
      highMid: { freq: 2800, gain: 1.2, q: 1.0 },
      high: { freq: 11000, gain: 2.0, q: 0.75 },
      lpf: 20000
    },
    compression: 35,
    dynamics: {
      low: { threshold: -22, ratio: 3.5, attack: 30, release: 90, gain: 1.5 },
      mid: { threshold: -18, ratio: 2.0, attack: 20, release: 50, gain: 0.5 },
      high: { threshold: -16, ratio: 1.8, attack: 8, release: 30, gain: 0.0 }
    }
  },
  {
    id: 'silky-air',
    name: 'Silky Air & High Sheen',
    category: 'Tone & Air',
    genreTag: 'Pop / R&B / Vocal',
    description: 'Pristine 12.5kHz top-end lift with enhanced harmonic breath and transparent optical dynamics.',
    highlightParams: {
      lowGain: '0.0 dB',
      highGain: '+4.0 dB',
      glueCompression: '20%',
      char: 'Airy & Crystalline'
    },
    eq: {
      hpf: 25,
      low: { freq: 100, gain: 0.0, q: 0.7 },
      lowMid: { freq: 300, gain: -1.0, q: 1.0 },
      mid: { freq: 1200, gain: 0.8, q: 1.0 },
      highMid: { freq: 3200, gain: 2.2, q: 1.1 },
      high: { freq: 12500, gain: 4.0, q: 0.7 },
      lpf: 20000
    },
    compression: 20,
    dynamics: {
      low: { threshold: -24, ratio: 1.8, attack: 40, release: 100, gain: 0.0 },
      mid: { threshold: -20, ratio: 2.0, attack: 25, release: 60, gain: 0.8 },
      high: { threshold: -18, ratio: 2.5, attack: 4, release: 35, gain: 1.0 }
    }
  },
  {
    id: 'analog-tape-glue',
    name: 'Warm Analog Tape Glue',
    category: 'Dynamic Glue',
    genreTag: 'Vintage / Indie / Soul',
    description: 'Rich low-end warmth with soft top-end roll-off and musical SSL-style bus compression.',
    highlightParams: {
      lowGain: '+3.2 dB',
      highGain: '-1.5 dB',
      glueCompression: '38%',
      char: 'Thick & Harmonically Warm'
    },
    eq: {
      hpf: 22,
      low: { freq: 90, gain: 3.2, q: 0.7 },
      lowMid: { freq: 280, gain: 0.8, q: 0.9 },
      mid: { freq: 950, gain: -0.5, q: 1.0 },
      highMid: { freq: 2400, gain: -0.8, q: 1.0 },
      high: { freq: 10000, gain: -1.5, q: 0.7 },
      lpf: 18500
    },
    compression: 38,
    dynamics: {
      low: { threshold: -20, ratio: 2.8, attack: 45, release: 140, gain: 1.2 },
      mid: { threshold: -19, ratio: 2.2, attack: 30, release: 80, gain: 0.6 },
      high: { threshold: -22, ratio: 1.5, attack: 12, release: 50, gain: 0.0 }
    }
  },
  {
    id: 'club-sub-slam',
    name: 'Club & Festival Sub Slam',
    category: 'Punch & Bass',
    genreTag: 'EDM / Techno / House',
    description: 'Sub-bass dominance tuned for mega sound systems with rapid multi-band bass clamp.',
    highlightParams: {
      lowGain: '+4.5 dB',
      highGain: '+1.5 dB',
      glueCompression: '48%',
      char: 'Heavy & Club-Authoritative'
    },
    eq: {
      hpf: 32,
      low: { freq: 85, gain: 4.5, q: 0.9 },
      lowMid: { freq: 220, gain: -3.5, q: 1.4 },
      mid: { freq: 1000, gain: -0.8, q: 1.0 },
      highMid: { freq: 3000, gain: 1.8, q: 1.0 },
      high: { freq: 10000, gain: 1.5, q: 0.7 },
      lpf: 19500
    },
    compression: 48,
    dynamics: {
      low: { threshold: -16, ratio: 4.5, attack: 20, release: 70, gain: 2.0 },
      mid: { threshold: -18, ratio: 2.5, attack: 15, release: 45, gain: 0.5 },
      high: { threshold: -15, ratio: 2.0, attack: 5, release: 25, gain: 0.0 }
    }
  },
  {
    id: 'radio-polish',
    name: 'Radio Commercial Polish',
    category: 'Genre Polish',
    genreTag: 'Commercial / Top 40',
    description: 'Classic loudness smile curve with controlled mids and dense multi-band compression.',
    highlightParams: {
      lowGain: '+2.0 dB',
      highGain: '+3.0 dB',
      glueCompression: '42%',
      char: 'Radio-Ready & Dense'
    },
    eq: {
      hpf: 30,
      low: { freq: 100, gain: 2.0, q: 0.75 },
      lowMid: { freq: 260, gain: -1.8, q: 1.1 },
      mid: { freq: 1000, gain: -0.5, q: 1.0 },
      highMid: { freq: 2500, gain: 1.5, q: 1.0 },
      high: { freq: 10000, gain: 3.0, q: 0.7 },
      lpf: 20000
    },
    compression: 42,
    dynamics: {
      low: { threshold: -19, ratio: 3.0, attack: 25, release: 85, gain: 1.0 },
      mid: { threshold: -17, ratio: 2.8, attack: 18, release: 40, gain: 1.0 },
      high: { threshold: -16, ratio: 2.2, attack: 6, release: 30, gain: 0.5 }
    }
  },
  {
    id: 'acoustic-transparent',
    name: 'Acoustic & Vocal Transparency',
    category: 'Tone & Air',
    genreTag: 'Acoustic / Jazz / Folk',
    description: 'Ultra-gentle mastering curve preserving natural micro-dynamics and authentic acoustic room tone.',
    highlightParams: {
      lowGain: '+0.5 dB',
      highGain: '+1.0 dB',
      glueCompression: '12%',
      char: 'Natural & Organic'
    },
    eq: {
      hpf: 20,
      low: { freq: 100, gain: 0.5, q: 0.7 },
      lowMid: { freq: 250, gain: -0.8, q: 1.0 },
      mid: { freq: 1000, gain: 0.5, q: 0.9 },
      highMid: { freq: 2500, gain: 0.8, q: 1.0 },
      high: { freq: 10000, gain: 1.0, q: 0.7 },
      lpf: 20000
    },
    compression: 12,
    dynamics: {
      low: { threshold: -26, ratio: 1.4, attack: 60, release: 150, gain: 0.0 },
      mid: { threshold: -24, ratio: 1.3, attack: 40, release: 90, gain: 0.0 },
      high: { threshold: -22, ratio: 1.2, attack: 20, release: 60, gain: 0.0 }
    }
  },
  {
    id: 'parallel-crush',
    name: 'Aggressive Parallel Crush',
    category: 'Dynamic Glue',
    genreTag: 'Rock / Metal / Industrial',
    description: 'High-ratio dynamic compression with forward mid-bite for tracks needing raw power.',
    highlightParams: {
      lowGain: '+3.0 dB',
      highGain: '+2.0 dB',
      glueCompression: '60%',
      char: 'Aggressive & Squeezed'
    },
    eq: {
      hpf: 30,
      low: { freq: 100, gain: 3.0, q: 0.8 },
      lowMid: { freq: 200, gain: -2.5, q: 1.2 },
      mid: { freq: 1000, gain: 0.0, q: 1.0 },
      highMid: { freq: 3500, gain: 2.5, q: 1.1 },
      high: { freq: 12000, gain: 2.0, q: 0.7 },
      lpf: 20000
    },
    compression: 60,
    dynamics: {
      low: { threshold: -15, ratio: 4.0, attack: 15, release: 60, gain: 2.5 },
      mid: { threshold: -14, ratio: 3.5, attack: 10, release: 35, gain: 2.0 },
      high: { threshold: -15, ratio: 3.0, attack: 3, release: 20, gain: 1.5 }
    }
  },
  {
    id: 'lofi-vintage',
    name: 'Lo-Fi & Vintage Chill',
    category: 'Genre Polish',
    genreTag: 'Lo-Fi / Chillhop / Downtempo',
    description: 'Band-limited nostalgic warmth with rolled-off highs, emphasized midrange, and lazy compression.',
    highlightParams: {
      lowGain: '+2.5 dB',
      highGain: '-3.8 dB',
      glueCompression: '32%',
      char: 'Warm, Mellow & Retro'
    },
    eq: {
      hpf: 45,
      low: { freq: 110, gain: 2.5, q: 0.8 },
      lowMid: { freq: 320, gain: 1.2, q: 1.0 },
      mid: { freq: 1000, gain: 1.8, q: 0.9 },
      highMid: { freq: 2200, gain: -1.2, q: 1.0 },
      high: { freq: 8500, gain: -3.8, q: 0.7 },
      lpf: 14000
    },
    compression: 32,
    dynamics: {
      low: { threshold: -20, ratio: 2.5, attack: 35, release: 110, gain: 0.8 },
      mid: { threshold: -18, ratio: 2.0, attack: 25, release: 70, gain: 0.5 },
      high: { threshold: -24, ratio: 1.6, attack: 15, release: 60, gain: 0.0 }
    }
  },
  {
    id: 'trap-808-dominator',
    name: 'Trap 808 & Drill Slam',
    category: 'Punch & Bass',
    genreTag: 'Trap / Drill / Phonk',
    description: 'Massive sub boost paired with a deep boxiness cut at 230Hz and snapping transient compressor.',
    highlightParams: {
      lowGain: '+4.8 dB',
      highGain: '+2.2 dB',
      glueCompression: '40%',
      char: 'Earth-Shaking Sub'
    },
    eq: {
      hpf: 28,
      low: { freq: 90, gain: 4.8, q: 1.0 },
      lowMid: { freq: 230, gain: -3.8, q: 1.3 },
      mid: { freq: 1000, gain: -1.0, q: 1.0 },
      highMid: { freq: 2700, gain: 2.0, q: 1.0 },
      high: { freq: 11000, gain: 2.2, q: 0.7 },
      lpf: 20000
    },
    compression: 40,
    dynamics: {
      low: { threshold: -17, ratio: 4.0, attack: 22, release: 80, gain: 2.2 },
      mid: { threshold: -19, ratio: 2.2, attack: 16, release: 45, gain: 0.8 },
      high: { threshold: -16, ratio: 2.0, attack: 5, release: 25, gain: 0.5 }
    }
  },
  {
    id: 'clarity-de-mud',
    name: 'Boxiness Cut & Vocal Clarity',
    category: 'Tone & Air',
    genreTag: 'Vocal / Podcast / Hybrid',
    description: 'Surgical cut around muddy resonance frequencies (250-400Hz) with lifted high-mid vocal clarity.',
    highlightParams: {
      lowGain: '-0.5 dB',
      highGain: '+2.5 dB',
      glueCompression: '22%',
      char: 'Crisp & De-Muddled'
    },
    eq: {
      hpf: 35,
      low: { freq: 100, gain: -0.5, q: 0.7 },
      lowMid: { freq: 280, gain: -3.6, q: 1.4 },
      mid: { freq: 1000, gain: 1.0, q: 1.0 },
      highMid: { freq: 3000, gain: 2.8, q: 1.0 },
      high: { freq: 10000, gain: 2.5, q: 0.7 },
      lpf: 20000
    },
    compression: 22,
    dynamics: {
      low: { threshold: -22, ratio: 2.0, attack: 35, release: 80, gain: 0.0 },
      mid: { threshold: -19, ratio: 2.5, attack: 20, release: 50, gain: 0.6 },
      high: { threshold: -18, ratio: 2.0, attack: 6, release: 30, gain: 0.5 }
    }
  },
  {
    id: 'flat-zeroed',
    name: 'Zeroed / Flat Baseline',
    category: 'Utility',
    genreTag: 'Neutral / Reset',
    description: 'Neutral 0 dB state across all 7 equalizer bands with bypassed compression (0% glue).',
    highlightParams: {
      lowGain: '0.0 dB',
      highGain: '0.0 dB',
      glueCompression: '0%',
      char: 'Clean & Neutral'
    },
    eq: {
      hpf: 20,
      low: { freq: 100, gain: 0.0, q: 0.7 },
      lowMid: { freq: 250, gain: 0.0, q: 1.0 },
      mid: { freq: 1000, gain: 0.0, q: 1.0 },
      highMid: { freq: 2500, gain: 0.0, q: 1.0 },
      high: { freq: 10000, gain: 0.0, q: 0.7 },
      lpf: 20000
    },
    compression: 0,
    dynamics: {
      low: { threshold: -20, ratio: 1.0, attack: 30, release: 100, gain: 0.0 },
      mid: { threshold: -20, ratio: 1.0, attack: 15, release: 50, gain: 0.0 },
      high: { threshold: -20, ratio: 1.0, attack: 5, release: 30, gain: 0.0 }
    }
  }
];

// Helper to test if current settings match a preset
export function isPresetActive(
  currentSettings: MasteringSettings, 
  preset: EqCompPreset
): boolean {
  if (!currentSettings || !currentSettings.eq) return false;
  
  // Compression difference tolerance 1%
  if (Math.abs(currentSettings.compression - preset.compression) > 1) {
    return false;
  }

  // Check key EQ gains with 0.3dB tolerance
  const eq = currentSettings.eq;
  const targetEq = preset.eq;

  const lowDiff = Math.abs((eq.low?.gain ?? 0) - targetEq.low.gain);
  const midDiff = Math.abs((eq.mid?.gain ?? 0) - targetEq.mid.gain);
  const highDiff = Math.abs((eq.high?.gain ?? 0) - targetEq.high.gain);
  const lowMidDiff = Math.abs((eq.lowMid?.gain ?? 0) - targetEq.lowMid.gain);
  const highMidDiff = Math.abs((eq.highMid?.gain ?? 0) - targetEq.highMid.gain);

  return lowDiff < 0.3 && midDiff < 0.3 && highDiff < 0.3 && lowMidDiff < 0.3 && highMidDiff < 0.3;
}
