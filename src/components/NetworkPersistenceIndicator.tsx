import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  Database, 
  HardDrive, 
  CheckCircle2, 
  Loader2, 
  X, 
  RefreshCw,
  Cpu,
  Layers,
  Info
} from 'lucide-react';
import { 
  getStorageQuotaEstimate, 
  getAllMasterRenders, 
  getProcessingJobs, 
  PersistedMasterRender,
  PersistedProcessingJob
} from '../utils/audioStorage';
import { onServiceWorkerStatusChange, ServiceWorkerStatus } from '../utils/serviceWorkerRegistration';
import { backgroundMastering, BackgroundTaskEvent } from '../utils/backgroundMastering';

export const NetworkPersistenceIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [swStatus, setSwStatus] = useState<ServiceWorkerStatus>({
    isSupported: false,
    isRegistered: false,
    isActive: false,
    registration: null
  });
  const [quota, setQuota] = useState<{ usedBytes: number; quotaBytes: number; percentage: number }>({
    usedBytes: 0,
    quotaBytes: 1024 * 1024 * 1024,
    percentage: 0
  });
  const [activeTask, setActiveTask] = useState<BackgroundTaskEvent | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [savedRenders, setSavedRenders] = useState<PersistedMasterRender[]>([]);
  const [persistedJobs, setPersistedJobs] = useState<PersistedProcessingJob[]>([]);
  const [completedNotice, setCompletedNotice] = useState<string | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubSw = onServiceWorkerStatusChange(setSwStatus);

    // Subscribe to background mastering events
    const unsubTask = backgroundMastering.subscribe((event) => {
      setActiveTask(event);
      if (event.status === 'completed') {
        if (!backgroundMastering.getIsTabVisible()) {
          setCompletedNotice(`Master render completed while away: ${event.result?.trackName || 'Audio Master'}`);
        }
        setTimeout(() => {
          refreshStorageMetrics();
        }, 500);
      }
    });

    refreshStorageMetrics();
    const interval = setInterval(refreshStorageMetrics, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubSw();
      unsubTask();
      clearInterval(interval);
    };
  }, []);

  const refreshStorageMetrics = async () => {
    try {
      const q = await getStorageQuotaEstimate();
      setQuota(q);
      const renders = await getAllMasterRenders();
      setSavedRenders(renders);
      const jobs = await getProcessingJobs();
      setPersistedJobs(jobs);
    } catch {
      // Ignore
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <>
      {/* Background Tab Completion Toast Notice */}
      {completedNotice && (
        <div className="fixed top-16 right-4 z-50 bg-primary/20 backdrop-blur-md border border-primary/40 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top duration-300">
          <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
          <div className="text-xs">
            <div className="font-bold text-primary font-mono uppercase tracking-wider">Background Render Ready</div>
            <div className="text-white/80">{completedNotice}</div>
          </div>
          <button 
            onClick={() => setCompletedNotice(null)}
            className="p-1 hover:bg-white/10 rounded text-white/50 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Top Bar Trigger Badge */}
      <div className="flex items-center gap-2">
        {/* Active Background Task Pill */}
        {activeTask && activeTask.status === 'processing' && (
          <div 
            onClick={() => setShowDetails(true)}
            className="cursor-pointer flex items-center gap-2 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[9px] font-mono text-amber-400 hover:bg-amber-500/20 transition-all shadow-[0_0_12px_rgba(245,158,11,0.15)]"
            title="Background Audio Processing active in Web Audio thread"
          >
            <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
            <span className="font-bold uppercase tracking-wider hidden sm:inline">Background DSP:</span>
            <span>{activeTask.progress}%</span>
          </div>
        )}

        {/* Online / Offline Status Button */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-mono uppercase tracking-wider transition-all ${
            !isOnline
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
              : swStatus.isActive
                ? 'bg-primary/10 hover:bg-primary/20 border-primary/25 text-primary/90'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/60'
          }`}
          title="Click to view Local Audio Persistence & Offline Service Worker State"
        >
          {isOnline ? (
            <Wifi className="w-3 h-3 text-primary" />
          ) : (
            <WifiOff className="w-3 h-3 text-amber-400 animate-pulse" />
          )}
          
          <span className="hidden md:inline">
            {isOnline ? 'Online' : 'Offline'}
          </span>

          <span className="w-1 h-1 rounded-full bg-white/30 hidden sm:inline" />

          <Database className="w-2.5 h-2.5 text-primary/70" />
          <span className="text-[8px] font-bold text-white/80">
            {savedRenders.length > 0 ? `${savedRenders.length} Masters` : 'Local DB'}
          </span>
        </button>
      </div>

      {/* Persistence & Offline Details Modal */}
      {showDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#0d1117] border border-white/15 rounded-2xl p-6 shadow-2xl text-left relative overflow-hidden">
            {/* Background ambient accent */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary/10 border border-primary/20 rounded-xl text-primary">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm tracking-wide">Audio Engine Persistence & Offline DSP</h3>
                  <p className="text-[10px] text-white/50 font-mono uppercase tracking-wider">Service Worker & IndexedDB Status</p>
                </div>
              </div>
              <button 
                onClick={() => setShowDetails(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              {/* Network & Service Worker Status Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-1">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-white/40">Network Connectivity</span>
                  <div className="flex items-center gap-2">
                    {isOnline ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <span className="text-xs font-bold text-white">Online Active</span>
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-xs font-bold text-amber-400">Offline (Local DSP)</span>
                      </>
                    )}
                  </div>
                  <p className="text-[9px] text-white/50 leading-tight">
                    {isOnline 
                      ? 'Full cloud AI synthesis & local 32-bit DSP enabled.' 
                      : 'Mastering, playback, EQ, and WAV export continue 100% offline.'}
                  </p>
                </div>

                <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-1">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-white/40">Service Worker</span>
                  <div className="flex items-center gap-2">
                    {swStatus.isActive ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                        <span className="text-xs font-bold text-primary">Active & Cached</span>
                      </>
                    ) : (
                      <>
                        <Loader2 className="w-3.5 h-3.5 text-white/40 animate-spin" />
                        <span className="text-xs font-bold text-white/70">Registering...</span>
                      </>
                    )}
                  </div>
                  <p className="text-[9px] text-white/50 leading-tight">
                    App shell and DSP scripts precached for zero-latency offline boot.
                  </p>
                </div>
              </div>

              {/* Local Storage Quota */}
              <div className="p-3.5 bg-white/5 rounded-xl border border-white/5 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-white/60 flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-primary" />
                    Local Storage Allocation
                  </span>
                  <span className="text-white/80 font-bold">{formatBytes(quota.usedBytes)} used</span>
                </div>
                <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(2, quota.percentage)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] font-mono text-white/40">
                  <span>IndexedDB 32-bit Float Audio Storage</span>
                  <span>Estimated Quota: {formatBytes(quota.quotaBytes)}</span>
                </div>
              </div>

              {/* Active Background Task */}
              {activeTask && activeTask.status === 'processing' && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-400 font-mono uppercase tracking-wider flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 animate-spin" />
                      Active Background DSP
                    </span>
                    <span className="font-mono text-amber-300 font-bold">{activeTask.progress}%</span>
                  </div>
                  <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-400 transition-all duration-300"
                      style={{ width: `${activeTask.progress}%` }}
                    />
                  </div>
                  <p className="text-[10px] font-mono text-amber-200/70">{activeTask.stage}</p>
                </div>
              )}

              {/* Persisted Offline Masters */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-white/50 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-primary" />
                    Persisted Offline Masters ({savedRenders.length})
                  </span>
                  <button 
                    onClick={refreshStorageMetrics}
                    className="p-1 hover:bg-white/10 rounded text-white/40 hover:text-white transition"
                    title="Refresh status"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>

                {savedRenders.length === 0 ? (
                  <div className="p-4 rounded-xl bg-black/30 border border-white/5 text-center text-xs text-white/40 font-mono">
                    No rendered masters stored in local IndexedDB yet.
                  </div>
                ) : (
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                    {savedRenders.slice(-4).reverse().map((render) => (
                      <div 
                        key={render.id}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-white/5 text-xs hover:border-primary/20 transition"
                      >
                        <div className="truncate pr-2">
                          <div className="font-bold text-white truncate text-[11px]">{render.trackName}</div>
                          <div className="font-mono text-[9px] text-white/40">
                            {render.bitDepth}-bit WAV • {render.sampleRate} Hz • {render.formattedSize}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary font-mono text-[8px] font-bold">
                            {render.truePeakDbfs} dBTP
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Informational Guidance */}
              <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex gap-2.5 items-start">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-[10px] text-white/60 leading-relaxed">
                  Your audio buffers and master renders are persistently backed by local browser IndexedDB and the Service Worker thread. Even if you switch tabs, lose Wi-Fi connection, or refresh the page, your audio and offline DSP jobs are preserved.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setShowDetails(false)}
                className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-mono tracking-wider uppercase transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
