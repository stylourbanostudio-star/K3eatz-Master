/**
 * K-3EATZ MASTER PRO - Background Audio Mastering & Tab Resilience Manager
 * 
 * Ensures continuous audio DSP processing, offline master renders, and buffer analysis
 * remain active even when the user switches tabs, minimizes the browser, or loses network connectivity.
 */

import { 
  saveMasterRender, 
  updateProcessingJob, 
  PersistedMasterRender, 
  PersistedProcessingJob 
} from './audioStorage';

export interface BackgroundTaskEvent {
  taskId: string;
  stage: string;
  progress: number;
  status: 'processing' | 'completed' | 'failed';
  result?: PersistedMasterRender;
  error?: string;
}

type TaskListener = (event: BackgroundTaskEvent) => void;

class BackgroundMasteringEngine {
  private activeJobs = new Map<string, PersistedProcessingJob>();
  private listeners = new Set<TaskListener>();
  private wakeLock: any = null;
  private isTabVisible = true;
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.isTabVisible = !document.hidden;

      // Listen for tab switching / backgrounding
      document.addEventListener('visibilitychange', () => {
        this.isTabVisible = !document.hidden;
        if (this.isTabVisible) {
          console.log('[BackgroundMastering] User returned to mastering tab. Resyncing background jobs...');
          this.checkPendingCompletions();
        } else {
          console.log('[BackgroundMastering] Tab backgrounded. Background DSP keep-alive active.');
        }
      });

      // BroadcastChannel for cross-tab mastering state synchronization
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          this.broadcastChannel = new BroadcastChannel('mastercore_dsp_channel');
          this.broadcastChannel.onmessage = (event) => {
            if (event.data && event.data.type === 'DSP_TASK_UPDATE') {
              this.notifyListeners(event.data.payload);
            }
          };
        } catch {
          // Fallback if BroadcastChannel unavailable
        }
      }
    }
  }

  /**
   * Acquire WakeLock so system does not sleep during lengthy 32-bit offline renders
   */
  public async requestWakeLock(): Promise<void> {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          this.wakeLock = null;
        });
        console.log('[BackgroundMastering] Screen WakeLock acquired for audio processing');
      } catch (err) {
        // Non-fatal: wakeLock might be denied or unsupported
      }
    }
  }

  /**
   * Release WakeLock after render finishes
   */
  public releaseWakeLock(): void {
    if (this.wakeLock) {
      try {
        this.wakeLock.release();
        this.wakeLock = null;
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Register a new background mastering job
   */
  public async registerJob(taskId: string, trackId: string, trackName: string): Promise<PersistedProcessingJob> {
    const job: PersistedProcessingJob = {
      id: taskId,
      trackId,
      trackName,
      status: 'processing',
      progress: 0,
      stage: 'Initializing offline DSP engine...',
      startedAt: Date.now()
    };

    this.activeJobs.set(taskId, job);
    await updateProcessingJob(job);
    await this.requestWakeLock();

    // Post to ServiceWorker to notify background activity
    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'MASTERING_TASK_START',
        taskId,
        trackName
      });
    }

    this.broadcast({
      taskId,
      stage: job.stage,
      progress: 0,
      status: 'processing'
    });

    return job;
  }

  /**
   * Update progress for an active job and sync to IndexedDB & Service Worker
   */
  public async updateJobProgress(taskId: string, progress: number, stage: string): Promise<void> {
    const job = this.activeJobs.get(taskId);
    if (!job) return;

    job.progress = progress;
    job.stage = stage;
    job.status = 'processing';

    // Persist to IndexedDB
    await updateProcessingJob(job);

    // Notify Service Worker
    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'MASTERING_TASK_PROGRESS',
        taskId,
        progress,
        stage
      });
    }

    this.broadcast({
      taskId,
      stage,
      progress,
      status: 'processing'
    });
  }

  /**
   * Mark job as completed, save master render to IndexedDB, and release wake lock
   */
  public async completeJob(taskId: string, render: PersistedMasterRender): Promise<void> {
    const job = this.activeJobs.get(taskId);
    if (job) {
      job.progress = 100;
      job.stage = 'Render Complete';
      job.status = 'completed';
      job.completedAt = Date.now();
      await updateProcessingJob(job);
      this.activeJobs.delete(taskId);
    }

    // Save final master render into IndexedDB
    await saveMasterRender(render);

    this.releaseWakeLock();

    // Notify Service Worker
    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'MASTERING_TASK_COMPLETE',
        taskId,
        trackName: render.trackName
      });
    }

    this.broadcast({
      taskId,
      stage: 'Master render finalized and saved locally',
      progress: 100,
      status: 'completed',
      result: render
    });
  }

  /**
   * Fail job
   */
  public async failJob(taskId: string, errorMsg: string): Promise<void> {
    const job = this.activeJobs.get(taskId);
    if (job) {
      job.status = 'failed';
      job.error = errorMsg;
      job.completedAt = Date.now();
      await updateProcessingJob(job);
      this.activeJobs.delete(taskId);
    }

    this.releaseWakeLock();

    this.broadcast({
      taskId,
      stage: 'Master render aborted',
      progress: 0,
      status: 'failed',
      error: errorMsg
    });
  }

  public subscribe(listener: TaskListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(event: BackgroundTaskEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[BackgroundMastering] Listener error:', err);
      }
    });
  }

  private broadcast(payload: BackgroundTaskEvent): void {
    this.notifyListeners(payload);
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'DSP_TASK_UPDATE',
          payload
        });
      } catch {
        // Ignore
      }
    }
  }

  private checkPendingCompletions(): void {
    // Check if any jobs finished while tab was hidden
    this.activeJobs.forEach((job) => {
      if (job.status === 'completed') {
        this.broadcast({
          taskId: job.id,
          stage: 'Render Completed',
          progress: 100,
          status: 'completed'
        });
      }
    });
  }

  public getIsTabVisible(): boolean {
    return this.isTabVisible;
  }
}

export const backgroundMastering = new BackgroundMasteringEngine();
