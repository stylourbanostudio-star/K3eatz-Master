export type AutomatableParam = 
  | 'gain'
  | 'eq.low'
  | 'eq.lowMid'
  | 'eq.mid'
  | 'eq.highMid'
  | 'eq.high'
  | 'eq.hpf'
  | 'eq.lpf';

export interface AutomationPoint {
  id: string;
  time: number; // in seconds
  value: number; // in parameter unit (e.g. dB or Hz)
}

export interface ParameterAutomation {
  paramId: AutomatableParam;
  name: string;
  group: 'Gain' | 'EQ';
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  color: string;
  points: AutomationPoint[];
  enabled: boolean;
}

export type AutomationMode = 'off' | 'read' | 'write' | 'latch';

export const DEFAULT_AUTOMATION_TRACKS: Record<AutomatableParam, Omit<ParameterAutomation, 'points' | 'enabled'>> = {
  'gain': {
    paramId: 'gain',
    name: 'Input Gain',
    group: 'Gain',
    unit: 'dB',
    min: -12,
    max: 12,
    step: 0.1,
    defaultValue: 0,
    color: '#1db954' // Emerald / Primary
  },
  'eq.low': {
    paramId: 'eq.low',
    name: 'EQ Low (100Hz)',
    group: 'EQ',
    unit: 'dB',
    min: -12,
    max: 12,
    step: 0.1,
    defaultValue: 0,
    color: '#10b981' // Emerald light
  },
  'eq.lowMid': {
    paramId: 'eq.lowMid',
    name: 'EQ Low-Mid (250Hz)',
    group: 'EQ',
    unit: 'dB',
    min: -12,
    max: 12,
    step: 0.1,
    defaultValue: 0,
    color: '#06b6d4' // Cyan
  },
  'eq.mid': {
    paramId: 'eq.mid',
    name: 'EQ Mid (1kHz)',
    group: 'EQ',
    unit: 'dB',
    min: -12,
    max: 12,
    step: 0.1,
    defaultValue: 0,
    color: '#f59e0b' // Amber
  },
  'eq.highMid': {
    paramId: 'eq.highMid',
    name: 'EQ High-Mid (2.5kHz)',
    group: 'EQ',
    unit: 'dB',
    min: -12,
    max: 12,
    step: 0.1,
    defaultValue: 0,
    color: '#ec4899' // Pink
  },
  'eq.high': {
    paramId: 'eq.high',
    name: 'EQ High (10kHz)',
    group: 'EQ',
    unit: 'dB',
    min: -12,
    max: 12,
    step: 0.1,
    defaultValue: 0,
    color: '#a855f7' // Purple
  },
  'eq.hpf': {
    paramId: 'eq.hpf',
    name: 'High-Pass Filter',
    group: 'EQ',
    unit: 'Hz',
    min: 20,
    max: 500,
    step: 1,
    defaultValue: 20,
    color: '#38bdf8' // Sky blue
  },
  'eq.lpf': {
    paramId: 'eq.lpf',
    name: 'Low-Pass Filter',
    group: 'EQ',
    unit: 'Hz',
    min: 5000,
    max: 20000,
    step: 10,
    defaultValue: 20000,
    color: '#ef4444' // Rose / Red
  }
};

/**
 * Evaluates the automation curve at the given playback time using linear interpolation.
 */
export function interpolateAutomationValue(points: AutomationPoint[], time: number): number | null {
  if (!points || points.length === 0) return null;
  if (points.length === 1) return points[0].value;

  // If time is before or at the first point
  if (time <= points[0].time) {
    return points[0].value;
  }

  // If time is after or at the last point
  if (time >= points[points.length - 1].time) {
    return points[points.length - 1].value;
  }

  // Find surrounding points
  let left = 0;
  let right = points.length - 1;

  for (let i = 0; i < points.length - 1; i++) {
    if (points[i].time <= time && time <= points[i + 1].time) {
      left = i;
      right = i + 1;
      break;
    }
  }

  const p0 = points[left];
  const p1 = points[right];

  const dt = p1.time - p0.time;
  if (dt <= 0.0001) return p0.value;

  const ratio = (time - p0.time) / dt;
  return p0.value + ratio * (p1.value - p0.value);
}

/**
 * Inserts or updates an automation point, maintaining chronological order.
 */
export function addOrUpdateAutomationPoint(
  points: AutomationPoint[],
  time: number,
  value: number,
  timeThreshold: number = 0.08
): AutomationPoint[] {
  const roundedTime = Math.max(0, Math.round(time * 100) / 100);
  const roundedValue = Math.round(value * 100) / 100;

  // Check if a point exists close to this time
  const existingIndex = points.findIndex(p => Math.abs(p.time - roundedTime) <= timeThreshold);

  if (existingIndex !== -1) {
    const updated = [...points];
    updated[existingIndex] = {
      ...updated[existingIndex],
      time: roundedTime,
      value: roundedValue
    };
    return updated.sort((a, b) => a.time - b.time);
  }

  const newPoint: AutomationPoint = {
    id: `pt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    time: roundedTime,
    value: roundedValue
  };

  return [...points, newPoint].sort((a, b) => a.time - b.time);
}

/**
 * Creates preset automation shapes for common mastering and creative transitions.
 */
export function generatePresetShape(
  paramId: AutomatableParam,
  shapeType: 'fade-in' | 'fade-out' | 'chorus-lift' | 'drop-swell' | 'filter-sweep' | 'sidechain-pump' | 'clear',
  duration: number
): AutomationPoint[] {
  const dur = Math.max(10, duration || 120);

  if (shapeType === 'clear') {
    return [];
  }

  const newId = (idx: number) => `preset_${paramId}_${idx}_${Date.now()}`;

  switch (shapeType) {
    case 'fade-in':
      if (paramId === 'gain') {
        return [
          { id: newId(0), time: 0, value: -12 },
          { id: newId(1), time: 0.5, value: -8 },
          { id: newId(2), time: 2.5, value: -3 },
          { id: newId(3), time: 4.5, value: 0 },
          { id: newId(4), time: dur, value: 0 }
        ];
      }
      return [];

    case 'fade-out':
      if (paramId === 'gain') {
        const fadeStart = Math.max(0, dur - 8);
        return [
          { id: newId(0), time: 0, value: 0 },
          { id: newId(1), time: fadeStart, value: 0 },
          { id: newId(2), time: fadeStart + 3, value: -2 },
          { id: newId(3), time: fadeStart + 6, value: -6 },
          { id: newId(4), time: dur, value: -12 }
        ];
      }
      return [];

    case 'chorus-lift':
      // Mid-song dynamic energy lift
      const chorus1Start = Math.min(dur * 0.3, 30);
      const chorus1End = Math.min(dur * 0.5, 60);
      const liftVal = paramId === 'gain' ? 1.5 : paramId === 'eq.high' ? 2.5 : paramId === 'eq.mid' ? 1.2 : 0;
      return [
        { id: newId(0), time: 0, value: 0 },
        { id: newId(1), time: chorus1Start - 1, value: 0 },
        { id: newId(2), time: chorus1Start, value: liftVal },
        { id: newId(3), time: chorus1End, value: liftVal },
        { id: newId(4), time: chorus1End + 1, value: 0 },
        { id: newId(5), time: dur, value: 0 }
      ];

    case 'drop-swell':
      // Low EQ build-up into drop
      const dropTime = Math.min(dur * 0.4, 45);
      const swellVal = paramId === 'eq.low' ? 3.5 : paramId === 'gain' ? 1.0 : 0;
      return [
        { id: newId(0), time: 0, value: 0 },
        { id: newId(1), time: dropTime - 6, value: 0 },
        { id: newId(2), time: dropTime - 1.5, value: -2.0 }, // suck out before drop
        { id: newId(3), time: dropTime, value: swellVal },
        { id: newId(4), time: dropTime + 12, value: swellVal * 0.6 },
        { id: newId(5), time: dropTime + 24, value: 0 },
        { id: newId(6), time: dur, value: 0 }
      ];

    case 'filter-sweep':
      if (paramId === 'eq.hpf') {
        const sweepStart = Math.min(dur * 0.3, 30);
        const sweepPeak = sweepStart + 8;
        return [
          { id: newId(0), time: 0, value: 20 },
          { id: newId(1), time: sweepStart, value: 20 },
          { id: newId(2), time: sweepPeak, value: 420 },
          { id: newId(3), time: sweepPeak + 0.1, value: 20 },
          { id: newId(4), time: dur, value: 20 }
        ];
      }
      return [];

    case 'sidechain-pump':
      // Periodic 1-second pulse for electronic pumping feel
      if (paramId === 'gain') {
        const points: AutomationPoint[] = [];
        const interval = 1.0;
        const count = Math.min(Math.floor(dur / interval), 40);
        for (let i = 0; i < count; i++) {
          const t = i * interval;
          points.push({ id: newId(i * 2), time: t, value: -4.0 });
          points.push({ id: newId(i * 2 + 1), time: t + 0.75, value: 0.0 });
        }
        points.push({ id: newId(999), time: dur, value: 0 });
        return points;
      }
      return [];

    default:
      return [];
  }
}
