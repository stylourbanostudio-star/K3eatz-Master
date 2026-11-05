import React, { useState } from 'react';
import { Download, Check, Share } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  // If already running in standalone mode, suppress button
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    const success = await install();
    if (success) {
      setJustInstalled(true);
      setTimeout(() => setJustInstalled(false), 3000);
    }
  };

  if (isInstallable) {
    return (
      <button
        onClick={handleInstallClick}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 hover:bg-primary/30 border border-primary/30 rounded-lg text-primary text-[10px] font-mono uppercase tracking-wider font-bold transition-all shadow-[0_0_12px_rgba(29,185,84,0.15)]"
        title="Install K-3EATZ MASTER PRO as Standalone Desktop/Mobile Application"
      >
        {justInstalled ? (
          <>
            <Check className="w-3.5 h-3.5 text-primary" />
            <span>Installed</span>
          </>
        ) : (
          <>
            <Download className="w-3.5 h-3.5 text-primary animate-bounce" />
            <span className="hidden sm:inline">Install DAW App</span>
            <span className="sm:hidden">Install</span>
          </>
        )}
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/70 text-[10px] font-mono uppercase tracking-wider transition"
          title="Install on iPhone / iPad"
        >
          <Share className="w-3.5 h-3.5 text-white/60" />
          <span>Install iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-[#0d1117] border border-white/20 p-6 text-white text-left shadow-2xl">
              <h3 className="text-base font-bold text-white mb-2">Install on iPhone / iPad</h3>
              <p className="text-xs text-white/70 leading-relaxed mb-4">
                1. Tap the <strong className="text-primary">Share</strong> button in Safari's bottom toolbar.<br />
                2. Scroll down and tap <strong className="text-primary">Add to Home Screen</strong>.<br />
                3. Launch the Master Pro icon for full-screen offline DSP mastering.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2 bg-primary/20 hover:bg-primary/30 border border-primary/40 rounded-xl text-primary font-mono text-xs font-bold uppercase tracking-wider transition"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
