/**
 * K-3EATZ MASTER PRO - Local Audio Persistence & IndexedDB Engine
 * 
 * Provides resilient, persistent local storage for audio files, decoded 32-bit float
 * channel buffers, offline master renders, and background DSP processing queues.
 * This ensures the mastering engine retains full operational state across page reloads,
 * background tab throttling, network disconnects, and browser restarts.
 */

const DB_NAME = 'MasterCoreAudioDB';
const DB_VERSION = 1;

export interface PersistedTrackAudio {
  id: string;
  blob: Blob;
  name: string;
  type: string;
  size: number;
  lastModified: number;
  sampleRate?: number;
  duration?: number;
}

export interface PersistedDecodedBuffer {
  id: string;
  length: number;
  sampleRate: number;
  numberOfChannels: number;
  channels: ArrayBuffer[]; // Serialized 32-bit float PCM buffers per channel
  duration: number;
  timestamp: number;
}

export interface PersistedMasterRender {
  id: string;
  trackId: string;
  trackName: string;
  wavBlob: Blob;
  sampleRate: number;
  bitDepth: number;
  truePeakDbfs: number;
  integratedRmsDbfs: number;
  duration: number;
  timestamp: number;
  formattedSize: string;
}

export interface PersistedProcessingJob {
  id: string;
  trackId: string;
  trackName: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  stage: string;
  error?: string;
  resultBlobId?: string;
  startedAt: number;
  completedAt?: number;
}

// Open or initialize IndexedDB connection
function openAudioDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('tracks_audio')) {
        db.createObjectStore('tracks_audio', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('decoded_buffers')) {
        db.createObjectStore('decoded_buffers', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('master_renders')) {
        const renderStore = db.createObjectStore('master_renders', { keyPath: 'id' });
        renderStore.createIndex('trackId', 'trackId', { unique: false });
        renderStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains('processing_jobs')) {
        const jobStore = db.createObjectStore('processing_jobs', { keyPath: 'id' });
        jobStore.createIndex('status', 'status', { unique: false });
      }

      if (!db.objectStoreNames.contains('session_state')) {
        db.createObjectStore('session_state', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Persists raw track audio file Blob into IndexedDB
 */
export async function saveTrackAudio(trackId: string, file: Blob | File, metadata?: { name?: string; sampleRate?: number; duration?: number }): Promise<void> {
  try {
    const db = await openAudioDB();
    const tx = db.transaction('tracks_audio', 'readwrite');
    const store = tx.objectStore('tracks_audio');

    const item: PersistedTrackAudio = {
      id: trackId,
      blob: file,
      name: metadata?.name || (file instanceof File ? file.name : `track-${trackId}`),
      type: file.type || 'audio/wav',
      size: file.size,
      lastModified: file instanceof File ? file.lastModified : Date.now(),
      sampleRate: metadata?.sampleRate,
      duration: metadata?.duration
    };

    store.put(item);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[AudioStorage] Failed to save track audio to IndexedDB:', err);
  }
}

/**
 * Retrieves raw track audio file from IndexedDB
 */
export async function getTrackAudio(trackId: string): Promise<PersistedTrackAudio | null> {
  try {
    const db = await openAudioDB();
    const tx = db.transaction('tracks_audio', 'readonly');
    const store = tx.objectStore('tracks_audio');
    const request = store.get(trackId);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[AudioStorage] Failed to retrieve track audio from IndexedDB:', err);
    return null;
  }
}

/**
 * Persists decoded 32-bit float AudioBuffer channel data into IndexedDB.
 * This bypasses browser host object restrictions and allows instantaneous restoration
 * of the decoded buffer without re-running expensive decodeAudioData().
 */
export async function saveDecodedAudioBuffer(trackId: string, buffer: AudioBuffer): Promise<void> {
  try {
    const db = await openAudioDB();
    const tx = db.transaction('decoded_buffers', 'readwrite');
    const store = tx.objectStore('decoded_buffers');

    // Extract raw Float32Array channel buffers
    const channels: ArrayBuffer[] = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const channelData = buffer.getChannelData(c);
      // Clone buffer to detach safely
      const copy = new Float32Array(channelData.length);
      copy.set(channelData);
      channels.push(copy.buffer);
    }

    const item: PersistedDecodedBuffer = {
      id: trackId,
      length: buffer.length,
      sampleRate: buffer.sampleRate,
      numberOfChannels: buffer.numberOfChannels,
      channels,
      duration: buffer.duration,
      timestamp: Date.now()
    };

    store.put(item);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[AudioStorage] Failed to persist decoded AudioBuffer:', err);
  }
}

/**
 * Reconstructs a full Web Audio AudioBuffer from persisted IndexedDB Float32Array channels.
 */
export async function getDecodedAudioBuffer(trackId: string, ctx: BaseAudioContext): Promise<AudioBuffer | null> {
  try {
    const db = await openAudioDB();
    const tx = db.transaction('decoded_buffers', 'readonly');
    const store = tx.objectStore('decoded_buffers');
    const request = store.get(trackId);

    const record: PersistedDecodedBuffer | null = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });

    if (!record || !record.channels || record.channels.length === 0) {
      return null;
    }

    // Reconstruct AudioBuffer with identical specifications
    const reconstructed = ctx.createBuffer(
      record.numberOfChannels,
      record.length,
      record.sampleRate
    );

    for (let c = 0; c < record.numberOfChannels; c++) {
      if (record.channels[c]) {
        const floatData = new Float32Array(record.channels[c]);
        reconstructed.copyToChannel(floatData, c);
      }
    }

    return reconstructed;
  } catch (err) {
    console.warn('[AudioStorage] Failed to retrieve decoded AudioBuffer:', err);
    return null;
  }
}

/**
 * Saves a completed offline master render WAV into IndexedDB
 */
export async function saveMasterRender(render: PersistedMasterRender): Promise<void> {
  try {
    const db = await openAudioDB();
    const tx = db.transaction('master_renders', 'readwrite');
    const store = tx.objectStore('master_renders');
    store.put(render);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[AudioStorage] Failed to save master render to IndexedDB:', err);
  }
}

/**
 * Retrieves all saved master renders
 */
export async function getAllMasterRenders(): Promise<PersistedMasterRender[]> {
  try {
    const db = await openAudioDB();
    const tx = db.transaction('master_renders', 'readonly');
    const store = tx.objectStore('master_renders');
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[AudioStorage] Failed to get master renders:', err);
    return [];
  }
}

/**
 * Persists background processing job status for cross-tab or offline tracking
 */
export async function updateProcessingJob(job: PersistedProcessingJob): Promise<void> {
  try {
    const db = await openAudioDB();
    const tx = db.transaction('processing_jobs', 'readwrite');
    const store = tx.objectStore('processing_jobs');
    store.put(job);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[AudioStorage] Failed to update processing job:', err);
  }
}

/**
 * Retrieves active or pending processing jobs
 */
export async function getProcessingJobs(): Promise<PersistedProcessingJob[]> {
  try {
    const db = await openAudioDB();
    const tx = db.transaction('processing_jobs', 'readonly');
    const store = tx.objectStore('processing_jobs');
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    return [];
  }
}

/**
 * Saves current session state (active track id, playback time, etc.)
 */
export async function saveSessionState(key: string, data: any): Promise<void> {
  try {
    const db = await openAudioDB();
    const tx = db.transaction('session_state', 'readwrite');
    const store = tx.objectStore('session_state');
    store.put({ key, data, timestamp: Date.now() });
  } catch (err) {
    // Ignore non-critical session state failure
  }
}

/**
 * Retrieves session state
 */
export async function getSessionState<T>(key: string): Promise<T | null> {
  try {
    const db = await openAudioDB();
    const tx = db.transaction('session_state', 'readonly');
    const store = tx.objectStore('session_state');
    const request = store.get(key);

    return new Promise((resolve) => {
      request.onsuccess = () => {
        resolve(request.result ? (request.result.data as T) : null);
      };
      request.onerror = () => resolve(null);
    });
  } catch (err) {
    return null;
  }
}

/**
 * Estimates available browser local storage quota (used bytes / quota bytes)
 */
export async function getStorageQuotaEstimate(): Promise<{ usedBytes: number; quotaBytes: number; percentage: number }> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const quota = estimate.quota || 1;
      return {
        usedBytes: used,
        quotaBytes: quota,
        percentage: Math.min(100, Math.round((used / quota) * 100))
      };
    } catch {
      // Fallback
    }
  }
  return { usedBytes: 0, quotaBytes: 1024 * 1024 * 1024, percentage: 0 };
}

/**
 * Removes track audio and decoded buffer from IndexedDB
 */
export async function deleteTrackAudio(trackId: string): Promise<void> {
  try {
    const db = await openAudioDB();
    const tx = db.transaction(['tracks_audio', 'decoded_buffers'], 'readwrite');
    tx.objectStore('tracks_audio').delete(trackId);
    tx.objectStore('decoded_buffers').delete(trackId);
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('[AudioStorage] Delete failed:', err);
  }
}
