/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  Settings as SetupIcon, 
  LayoutGrid as MasteringIcon, 
  Library as LibraryIcon, 
  Sparkles as PromoteIcon, 
  Cloud as CloudIcon,
  Mic2 as AIAnalystIcon,
  Database as MetadataIcon,
  Palette as ArtworkIcon,
  FileAudio as ExportIcon,
  Upload as LoadIcon,
  Menu, 
  User,
  Power,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Scale,
  Activity,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MasteringProvider, useMastering } from './context/MasteringContext';
import MasteringSection from './components/MasteringSection';
import LoaderSection from './components/LoaderSection';
import AIAnalystSection from './components/AIAnalystSection';
import ExportSection from './components/ExportSection';
import LibrarySection from './components/LibrarySection';
import ArtworkSection from './components/ArtworkSection';
import PromoteSection from './components/PromoteSection';
import SetupSection from './components/SetupSection';
import AnalogVUMeters from './components/AnalogVUMeters';
import PhaseCorrelationMeter from './components/PhaseCorrelationMeter';
import StereoWidthMeter from './components/StereoWidthMeter';
import { NetworkPersistenceIndicator } from './components/NetworkPersistenceIndicator';
import { PWAInstallButton } from './components/PWAInstallButton';

export default function App() {
  return (
    <MasteringProvider>
      <WorkstationShell />
    </MasteringProvider>
  );
}

function WorkstationShell() {
  const { 
    activeSection, 
    setActiveSection, 
    user, 
    loading, 
    login, 
    logout, 
    currentTrack,
    language,
    setLanguage,
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
    togglePlayback,
    handleSeek,
    settings,
    updateSettings
  } = useMastering();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isMobileMonitorOpen, setIsMobileMonitorOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        togglePlayback();
      } else if (key === 'm') {
        if (audioBuffer) {
          setIsEngaged(!isEngaged);
        }
      } else if (key === 'l') {
        setActiveSection('LOAD TRACK');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [togglePlayback, isEngaged, setIsEngaged, setActiveSection, audioBuffer]);

  const formatPlaybackTime = (time: number) => {
    if (isNaN(time) || time === undefined) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const languages: { id: 'en' | 'es' | 'pt', label: string, flag: string }[] = [
    { id: 'en', label: 'English', flag: '🇺🇸' },
    { id: 'es', label: 'Español', flag: '🇪🇸' },
    { id: 'pt', label: 'Português', flag: '🇧🇷' }
  ];

  if (loading) {
    return (
      <div className="h-screen w-screen bg-obsidian flex flex-col items-center justify-center space-y-8">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative"
        >
          <img src="/logo.svg" alt="K-3EATZ" className="w-48 h-48 object-contain" />
          <div className="absolute inset-0 border-2 border-primary/20 rounded-full animate-ping -z-10" />
        </motion.div>
        <div className="flex flex-col items-center gap-3">
          <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 2, repeat: Infinity }}
              className="h-full bg-primary"
            />
          </div>
          <p className="font-mono text-[10px] text-primary animate-pulse tracking-[0.4em] uppercase">Initializing Neural Cores...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen bg-obsidian flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[radial-gradient(#1db954_1px,transparent_1px)] [background-size:40px_40px]" />
        </div>
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-primary/5 blur-[120px] rounded-full animate-pulse" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full hardware-panel p-12 rounded-[40px] border border-white/5 space-y-12 z-10 text-center relative"
        >
          <div className="space-y-4">
             <div className="w-40 h-40 mx-auto flex items-center justify-center">
                <img src="/logo.svg" alt="K-3EATZ" className="w-full h-full object-contain" />
             </div>
             <div>
                <p className="text-white/30 font-mono text-[10px] uppercase tracking-[0.4em] mt-2">Professional Terminal Access</p>
             </div>
          </div>

          <div className="space-y-6">
             <p className="text-white/40 font-sans text-sm leading-relaxed px-4">
                Enter the terminal to access your neural mastering modules and cloud-synced DNA archive.
             </p>
             <button 
               onClick={login}
               className="w-full py-5 bg-white text-black rounded-2xl font-mono text-sm font-black uppercase tracking-widest hover:bg-primary hover:text-on-primary shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_#1db954] transition-all active:scale-95 flex items-center justify-center gap-4 group"
             >
                <CloudIcon className="w-5 h-5 group-hover:animate-bounce" />
                Initialize Authentication
             </button>
          </div>

          <div className="pt-8 border-t border-white/5 flex justify-center gap-4 opacity-20">
             <span className="font-mono text-[8px] uppercase tracking-widest">TLS 1.3 ENCRYPTED</span>
             <span className="font-mono text-[8px] uppercase tracking-widest">v2.4 LTS</span>
          </div>
        </motion.div>
      </div>
    );
  }

  const navItems = [
    { id: 'MASTERING', label: t('nav.mastering'), icon: MasteringIcon },
    { id: 'LOAD TRACK', label: t('nav.load_track'), icon: LoadIcon },
    { id: 'AI ANALYST', label: t('nav.ai_analyst'), icon: AIAnalystIcon },
    { id: 'LIBRARY', label: t('nav.library'), icon: LibraryIcon },
    { id: 'EXPORT', label: t('nav.export'), icon: ExportIcon },
    { id: 'ARTWORK', label: t('nav.artwork'), icon: ArtworkIcon },
    { id: 'PROMOTE', label: t('nav.promote'), icon: PromoteIcon },
    { id: 'SETUP', label: t('nav.setup'), icon: SetupIcon },
  ];

  // Mobile bottom tab bar primary destinations
  const mobileTabs = [
    { id: 'MASTERING', label: t('nav.mastering'), icon: MasteringIcon },
    { id: 'LOAD TRACK', label: t('nav.load_track'), icon: LoadIcon },
    { id: 'AI ANALYST', label: 'IA Analyst', icon: AIAnalystIcon },
    { id: 'EXPORT', label: t('nav.export'), icon: ExportIcon },
  ];

  return (
    <div className="flex bg-obsidian text-white h-screen overflow-hidden selection:bg-primary/30">
      {/* Sidebar Navigation (Desktop) */}
      <aside className="hidden md:flex flex-col w-20 lg:w-64 bg-obsidian-light border-r border-white/5 z-50">
        <div className="p-6 flex items-center justify-center lg:justify-start gap-4">
          <div className="w-8 h-8 rounded-lg bg-primary shadow-[0_0_15px_#1db954] flex items-center justify-center">
             <MasteringIcon className="w-5 h-5 text-on-primary fill-current" />
          </div>
          <div className="hidden lg:block">
            <h1 className="text-sm font-black tracking-tighter text-white font-mono leading-none">
              K-3EATZ
            </h1>
            <span className="text-[10px] text-primary font-bold font-mono tracking-widest uppercase">MASTER PRO</span>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1 py-4 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center gap-4 px-3 py-3 rounded-lg transition-all duration-300 group relative ${
                activeSection === item.id 
                  ? 'bg-primary/10 text-primary border-l-2 border-primary shadow-[inset_0_0_10px_rgba(29,185,84,0.1)]' 
                  : 'text-white/30 hover:bg-white/5 hover:text-white/60'
              }`}
            >
              <item.icon className={`w-5 h-5 min-w-[20px] ${activeSection === item.id ? 'neon-glow-emerald' : ''}`} />
              <span className="hidden lg:block font-mono text-[10px] uppercase tracking-[0.2em] font-bold">
                {item.label}
              </span>
              
              {/* Tooltip for collapsed mode */}
              <div className="lg:hidden absolute left-full ml-4 px-2 py-1 bg-graphite border border-white/10 rounded text-[10px] font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                {item.label}
              </div>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5">
           <button 
             onClick={logout}
             className="w-full flex items-center gap-4 px-3 py-3 text-white/20 hover:text-scarlet transition-colors group"
           >
             <Power className="w-5 h-5 group-hover:rotate-90 transition-transform" />
             <span className="hidden lg:block font-mono text-[10px] uppercase tracking-widest font-bold">Shut Down</span>
           </button>
        </div>
      </aside>

      {/* Main Contents */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header (Top Bar) - Fully Responsive */}
        <header className="h-14 bg-obsidian-light/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-3 sm:px-6 z-40 shrink-0">
           {/* Left Zone: Brand + Menu trigger */}
           <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsMenuOpen(true)}
                className="md:hidden w-10 h-10 flex items-center justify-center text-white/60 hover:text-white rounded-lg active:bg-white/5"
                aria-label="Abrir Menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-2">
                <img src="/logo.svg" alt="K-3EATZ" className="h-7 w-auto object-contain" />
                <div className="flex flex-col">
                  <span className="font-mono text-xs font-black tracking-tight text-white leading-none">
                    K-3EATZ
                  </span>
                  <span className="text-[8px] font-mono font-bold text-primary tracking-widest uppercase leading-none mt-0.5">
                    MASTER
                  </span>
                </div>
              </div>
           </div>

           {/* Center Zone: Quick Master / Bypass Toggle for Instant Auditioning */}
           <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (audioBuffer) {
                    setIsEngaged(!isEngaged);
                  }
                }}
                disabled={!audioBuffer}
                title={isEngaged ? "Clique para ouvir o áudio Original (Bypass)" : "Clique para ouvir o áudio Masterizado (Wet)"}
                className={`flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full font-mono text-[9px] uppercase tracking-widest font-black transition-all border ${
                  !audioBuffer
                    ? 'border-white/5 bg-white/5 text-white/20 cursor-not-allowed'
                    : isEngaged
                      ? 'border-primary/50 bg-primary/20 text-primary shadow-[0_0_12px_rgba(29,185,84,0.3)] animate-pulse'
                      : 'border-white/10 bg-white/10 text-white/70 hover:text-white'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${isEngaged ? 'bg-primary' : 'bg-white/40'}`} />
                <span className="truncate max-w-[90px] sm:max-w-none">
                  {isEngaged ? 'Master (Ativo)' : 'Bypass (Dry)'}
                </span>
              </button>
           </div>

           {/* Right Zone: Persistence, Language & User */}
           <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden sm:flex">
                <PWAInstallButton />
              </div>

              <div className="hidden lg:flex">
                <NetworkPersistenceIndicator />
              </div>

              {/* Language Selector */}
              <div className="relative">
                <button 
                  onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-all font-mono text-[9px] uppercase tracking-widest text-white/50 hover:text-white"
                  title="Idioma"
                >
                  <span className="text-sm">{languages.find(l => l.id === language)?.flag}</span>
                  <span className="hidden xl:inline text-[8px] font-bold">{language.toUpperCase()}</span>
                </button>

                <AnimatePresence>
                  {isLangMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-36 bg-graphite border border-white/10 rounded-xl shadow-2xl p-1 z-50"
                    >
                      {languages.map((lang) => (
                        <button
                          key={lang.id}
                          onClick={() => {
                            setLanguage(lang.id);
                            setIsLangMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors font-mono text-[9px] uppercase tracking-widest ${
                            language === lang.id ? 'bg-primary/10 text-primary' : 'text-white/40 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span>{lang.flag}</span>
                            <span>{lang.label}</span>
                          </div>
                          {language === lang.id && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* User Avatar */}
              <button 
                onClick={() => setIsMenuOpen(true)}
                className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1 rounded-full bg-white/5 border border-white/5 hover:border-white/10 transition-colors group"
                title={user.email || 'Conta de Usuário'}
              >
                 <div className="w-6 h-6 rounded-full bg-graphite flex items-center justify-center overflow-hidden border border-white/10 shrink-0">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="User" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-white/50" />
                    )}
                 </div>
                 <span className="hidden xl:inline font-mono text-[9px] text-white/50 group-hover:text-white truncate max-w-[100px]">
                   {user.displayName || user.email?.split('@')[0]}
                 </span>
              </button>
           </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="h-full w-full"
            >
              {activeSection === 'LOAD TRACK' && <LoaderSection />}
              {activeSection === 'MASTERING' && <MasteringSection />}
              {activeSection === 'AI ANALYST' && <AIAnalystSection />}
              {activeSection === 'LIBRARY' && <LibrarySection />}
              {activeSection === 'ARTWORK' && <ArtworkSection />}
              {activeSection === 'PROMOTE' && <PromoteSection />}
              {activeSection === 'EXPORT' && <ExportSection />}
              {activeSection === 'SETUP' && <SetupSection />}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Studio Transport Bar & Meter Bridge (Adaptive Desktop & Mobile) */}
        
        {/* DESKTOP TRANSPORT (md:flex) */}
        <footer className="hidden md:flex min-h-[136px] py-3 bg-obsidian border-t border-white/5 px-6 flex-row items-center justify-between gap-4 z-40 piano-black relative shrink-0">
            {/* Left side: Track Info and Play/Pause */}
            <div className="flex items-center gap-3.5 w-60 lg:w-72 shrink-0">
               <button 
                 onClick={togglePlayback}
                 disabled={!audioBuffer}
                 className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shrink-0 ${
                   !audioBuffer 
                     ? 'bg-white/5 text-white/20 cursor-not-allowed' 
                     : isPlaying 
                       ? 'bg-primary/25 border border-primary/45 text-primary shadow-[0_0_15px_rgba(29,185,84,0.3)] hover:scale-105' 
                       : 'bg-white border border-white text-black hover:bg-white/90 hover:scale-105'
                 }`}
               >
                 {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
               </button>
               
               <div className="min-w-0 flex-1">
                  <h4 className="text-[11px] font-mono font-bold text-white truncate uppercase tracking-widest leading-normal">
                    {currentTrack?.name || 'Nenhuma faixa carregada'}
                  </h4>
                  <p className="text-[9px] font-mono text-white/30 truncate uppercase leading-none mt-0.5">
                    {currentTrack?.artist || 'Carregue áudio ou ative a demo'}
                  </p>
               </div>
            </div>

            {/* Center: Running progress bar + Dual Analog VU Meters & Stereo Field Meters */}
            <div className="flex flex-col items-center flex-grow mx-2 lg:mx-4 max-w-4xl lg:max-w-5xl gap-2">
              <div className="w-full">
                {audioBuffer ? (
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center text-[8px] font-mono uppercase tracking-widest text-white/30">
                      <span>{formatPlaybackTime(currentTime)}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-primary font-bold animate-pulse">● DSP MASTER ENGINE</span>
                        <span className="opacity-40">|</span>
                        <span>{currentTrack?.bpm ? `${currentTrack.bpm} BPM` : '124 BPM'}</span>
                      </div>
                      <span>{formatPlaybackTime(audioBuffer.duration)}</span>
                    </div>
                    <input 
                      type="range"
                      min="0"
                      max={audioBuffer.duration || 10}
                      step="0.01"
                      value={currentTime}
                      onChange={(e) => handleSeek(parseFloat(e.target.value))}
                      className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary focus:outline-hidden"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-[9px] font-mono text-white/20 uppercase tracking-[0.3em] font-bold">Aguardando Sinal de Áudio...</p>
                    <div className="flex gap-1 mt-1 animate-pulse">
                      {[1, 2, 3, 4, 5].map((dot) => (
                        <div key={dot} className="w-1.5 h-1.5 rounded-full bg-white/10" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-stretch justify-center gap-2 lg:gap-3 w-full">
                <AnalogVUMeters />
                <PhaseCorrelationMeter />
                <StereoWidthMeter />
              </div>
            </div>

            {/* Right side: Comparative Switch & Volume */}
            <div className="flex items-center justify-end gap-4 lg:gap-6 shrink-0 w-60 lg:w-72">
               {/* Clean vs Processed Comparative Switch */}
               <div className="flex flex-col items-end">
                  <span className="text-[8px] font-mono uppercase tracking-widest text-white/30 mb-1 font-bold">Motor de Comparação</span>
                  <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/5">
                    <button 
                      onClick={() => setIsEngaged(false)}
                      disabled={!audioBuffer}
                      className={`px-3 py-1.5 text-[8px] font-mono rounded font-bold transition-all uppercase tracking-wider ${
                        !isEngaged && audioBuffer
                          ? 'bg-white/15 text-white font-black' 
                          : 'text-white/20 hover:text-white/40'
                      }`}
                    >
                      Raw (Dry)
                    </button>
                    <button 
                      onClick={() => currentTrack && setIsEngaged(true)}
                      disabled={!audioBuffer}
                      className={`px-3 py-1.5 text-[8px] font-mono rounded font-bold transition-all uppercase tracking-wider ${
                        isEngaged && audioBuffer
                          ? 'bg-primary/20 text-primary shadow-[0_0_15px_rgba(29,185,84,0.3)] font-black animate-pulse' 
                          : 'text-white/20 hover:text-white/40'
                      }`}
                    >
                      Master (Wet)
                    </button>
                    <button
                      onClick={() => setAutoGainMatch(!autoGainMatch)}
                      title={autoGainMatch ? `Auto-Gain Match Ativo: -${autoGainOffsetDb} dB` : "Igualar volume percebido no teste A/B"}
                      className={`flex items-center gap-1 px-2 py-1.5 text-[8px] font-mono rounded font-bold transition-all uppercase tracking-wider ${
                        autoGainMatch
                          ? 'bg-amber/20 text-amber border border-amber/30'
                          : 'text-white/20 hover:text-white/40'
                      }`}
                    >
                      <Scale className="w-2.5 h-2.5" />
                      <span>{autoGainMatch && autoGainOffsetDb > 0 ? `-${autoGainOffsetDb}dB` : 'Match'}</span>
                    </button>
                  </div>
               </div>

               {/* Master output gain controller */}
               <div className="flex flex-col items-end">
                  <span className="text-[8px] font-mono uppercase tracking-widest text-white/30 mb-1">Volume Master</span>
                  <div className="flex items-center gap-2">
                    {settings.masterVolume === 0 ? (
                      <VolumeX className="w-3.5 h-3.5 text-white/30" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5 text-white/30" />
                    )}
                    <input 
                      type="range"
                      min="0"
                      max="1.5"
                      step="0.05"
                      value={settings.masterVolume}
                      onChange={(e) => updateSettings({ masterVolume: parseFloat(e.target.value) })}
                      className="w-16 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary"
                    />
                  </div>
               </div>
            </div>
        </footer>

        {/* MOBILE COMPACT STUDIO TRANSPORT BAR (md:hidden) */}
        <div className="md:hidden bg-obsidian-light/95 backdrop-blur-md border-t border-white/10 relative z-40 shrink-0">
          {/* Integrated Scrubbing Bar */}
          {audioBuffer && (
            <div className="relative w-full h-1 bg-white/10">
              <div 
                className="h-full bg-primary" 
                style={{ width: `${Math.min(100, (currentTime / (audioBuffer.duration || 1)) * 100)}%` }} 
              />
              <input 
                type="range"
                min="0"
                max={audioBuffer.duration || 10}
                step="0.01"
                value={currentTime}
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
              />
            </div>
          )}

          {/* Transport Row: Play + Track Info + A/B Toggle + Meter Sheet Toggle */}
          <div className="h-12 px-3 flex items-center justify-between gap-2">
            {/* Play/Pause Button */}
            <button 
              onClick={togglePlayback}
              disabled={!audioBuffer}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 active:scale-95 ${
                !audioBuffer 
                  ? 'bg-white/5 text-white/20' 
                  : isPlaying 
                    ? 'bg-primary text-black shadow-[0_0_12px_#1db954]' 
                    : 'bg-white text-black hover:bg-white/90'
              }`}
              aria-label={isPlaying ? "Pausar áudio" : "Reproduzir áudio"}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
            </button>

            {/* Track Info (Click to open track or toggle monitor) */}
            <div 
              onClick={() => setIsMobileMonitorOpen(!isMobileMonitorOpen)}
              className="flex-1 min-w-0 cursor-pointer"
            >
              <h4 className="text-[10px] font-mono font-bold text-white truncate leading-tight">
                {currentTrack?.name || 'Toque para carregar'}
              </h4>
              <div className="flex items-center gap-1.5 text-[8.5px] font-mono text-white/40 leading-none mt-0.5">
                <span>{formatPlaybackTime(currentTime)} / {audioBuffer ? formatPlaybackTime(audioBuffer.duration) : '0:00'}</span>
                {autoGainMatch && autoGainOffsetDb > 0 && (
                  <span className="text-amber font-bold">-{autoGainOffsetDb}dB</span>
                )}
              </div>
            </div>

            {/* Dry vs Wet Level-Matched A/B Switch */}
            <div className="flex items-center bg-black/50 rounded-lg p-0.5 border border-white/10 shrink-0">
              <button 
                onClick={() => setIsEngaged(false)}
                disabled={!audioBuffer}
                className={`px-2 py-0.5 text-[7.5px] font-mono font-bold rounded uppercase transition-colors ${
                  !isEngaged && audioBuffer ? 'bg-white/20 text-white' : 'text-white/30'
                }`}
              >
                Dry
              </button>
              <button 
                onClick={() => currentTrack && setIsEngaged(true)}
                disabled={!audioBuffer}
                className={`px-2 py-0.5 text-[7.5px] font-mono font-bold rounded uppercase transition-colors ${
                  isEngaged && audioBuffer ? 'bg-primary text-black font-black' : 'text-white/30'
                }`}
              >
                Wet
              </button>
            </div>

            {/* Mobile Studio Monitor Sheet Toggle */}
            <button
              onClick={() => setIsMobileMonitorOpen(!isMobileMonitorOpen)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors ${
                isMobileMonitorOpen 
                  ? 'bg-primary/20 text-primary border-primary/40' 
                  : 'bg-white/5 text-white/50 border-white/5'
              }`}
              title="Medidores Analógicos & Monitor"
              aria-label="Abrir Medidores"
            >
              <Activity className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* MOBILE BOTTOM NAVIGATION BAR (md:hidden) */}
        <nav className="md:hidden h-12 bg-obsidian/95 backdrop-blur-md border-t border-white/5 grid grid-cols-5 items-center z-40 px-1 shrink-0 pb-safe">
          {mobileTabs.map((tab) => {
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id)}
                className={`min-h-[44px] flex flex-col items-center justify-center py-0.5 transition-colors ${
                  isActive ? 'text-primary' : 'text-white/40 hover:text-white/70'
                }`}
              >
                <tab.icon className={`w-3.5 h-3.5 ${isActive ? 'neon-glow-emerald scale-110' : ''} transition-transform`} />
                <span className="text-[8px] font-mono uppercase tracking-wider font-bold mt-0.5 truncate max-w-[64px]">
                  {tab.label}
                </span>
              </button>
            );
          })}

          {/* More / Menu Button */}
          <button
            onClick={() => setIsMenuOpen(true)}
            className="min-h-[44px] flex flex-col items-center justify-center py-0.5 text-white/40 hover:text-white/70 transition-colors"
          >
            <Menu className="w-3.5 h-3.5" />
            <span className="text-[8px] font-mono uppercase tracking-wider font-bold mt-0.5">
              {t('nav.more')}
            </span>
          </button>
        </nav>
      </div>

      {/* Mobile Studio Monitor Drawer / Sheet */}
      <AnimatePresence>
        {isMobileMonitorOpen && (
          <div className="fixed inset-0 z-[120] md:hidden flex flex-col justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMonitorOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-xs"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative bg-obsidian-light border-t border-white/10 rounded-t-3xl p-5 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              {/* Drawer Handle */}
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-1" />
              
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <div>
                  <h3 className="font-mono text-xs font-black uppercase tracking-widest text-white">Monitor Analógico</h3>
                  <p className="font-mono text-[9px] text-white/40">VU Meters & Correlação de Fase</p>
                </div>
                <button 
                  onClick={() => setIsMobileMonitorOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* VU & Phase Meters */}
              <div className="flex flex-col gap-3 py-2">
                <AnalogVUMeters />
                <div className="grid grid-cols-2 gap-2">
                  <PhaseCorrelationMeter />
                  <StereoWidthMeter />
                </div>
              </div>

              {/* Master Volume Slider */}
              <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-2">
                <div className="flex justify-between items-center text-[9px] font-mono uppercase text-white/50">
                  <span>Volume Master de Saída</span>
                  <span className="text-primary font-bold">{Math.round(settings.masterVolume * 100)}%</span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  value={settings.masterVolume}
                  onChange={(e) => updateSettings({ masterVolume: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary"
                />
              </div>

              {/* Auto-Gain Match Controls in Monitor */}
              <div className="p-3 bg-black/40 rounded-xl border border-white/5 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-mono text-white block uppercase font-bold">Auto-Gain Match</span>
                  <span className="text-[8px] font-mono text-white/40 block">Atenua o master para audição igualada ao original</span>
                </div>
                <button
                  onClick={() => setAutoGainMatch(!autoGainMatch)}
                  className={`px-3 py-1.5 rounded-lg font-mono text-[9px] font-bold uppercase transition-all ${
                    autoGainMatch ? 'bg-amber text-black' : 'bg-white/10 text-white/40'
                  }`}
                >
                  {autoGainMatch ? `Ativo (-${autoGainOffsetDb}dB)` : 'Inativo'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Drawer (Menu com todas as seções) */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[150]"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="fixed left-0 top-0 bottom-0 w-72 bg-obsidian-light z-[160] border-r border-white/10 flex flex-col justify-between"
            >
              <div className="p-6 overflow-y-auto">
                 <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
                   <div className="flex items-center gap-2">
                     <img src="/logo.svg" alt="K-3EATZ" className="h-7 w-auto object-contain" />
                     <div>
                       <h2 className="font-mono text-sm font-black text-white leading-none">K-3EATZ</h2>
                       <span className="font-mono text-[8px] text-primary font-bold uppercase tracking-widest">Mastering DAW</span>
                     </div>
                   </div>
                   <button 
                     onClick={() => setIsMenuOpen(false)}
                     className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white"
                   >
                     <X className="w-4 h-4" />
                   </button>
                 </div>

                 <nav className="space-y-1">
                    {navItems.map(item => (
                      <button
                        key={item.id}
                        onClick={() => { setActiveSection(item.id); setIsMenuOpen(false); }}
                        className={`w-full flex items-center gap-3.5 p-3 rounded-xl transition-all font-mono text-[10px] font-bold uppercase tracking-widest ${
                          activeSection === item.id 
                            ? 'bg-primary/15 text-primary border border-primary/20 shadow-sm' 
                            : 'text-white/50 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <item.icon className="w-4 h-4 min-w-[16px]" />
                        <span>{item.label}</span>
                      </button>
                    ))}
                 </nav>
              </div>

              {/* Bottom Drawer Actions */}
              <div className="p-6 border-t border-white/5 space-y-3 bg-black/20">
                 <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                   <span className="font-mono text-[9px] text-white/60 uppercase truncate">{user.email}</span>
                 </div>
                 <button 
                   onClick={() => { logout(); setIsMenuOpen(false); }}
                   className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-scarlet border border-scarlet/20 hover:bg-scarlet/10 transition-colors font-mono text-[9px] font-bold uppercase tracking-widest"
                 >
                    <Power className="w-3.5 h-3.5" />
                    <span>Desconectar Sessão</span>
                 </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function PlaceholderSection({ title, icon: Icon }: { title: string, icon: any }) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-obsidian relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 pointer-events-none">
         <div className="absolute inset-0 bg-[radial-gradient(#1db954_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>

      <div className="w-24 h-24 bg-obsidian-light border border-white/5 rounded-3xl flex items-center justify-center mb-8 shadow-2xl relative group">
        <Icon className="w-10 h-10 text-primary group-hover:scale-110 transition-transform neon-glow-emerald" />
        <div className="absolute -inset-8 bg-primary/5 blur-3xl -z-10 group-hover:bg-primary/10 transition-colors" />
      </div>
      
      <div className="space-y-4">
        <h2 className="text-4xl font-mono uppercase tracking-tighter text-white italic">
           {title} <span className="text-primary">.INIT</span>
        </h2>
        <p className="text-white/40 max-w-md mx-auto font-sans text-sm leading-relaxed">
          The <span className="text-white/60">{title}</span> neural module is currently calibrating. 
          Expect full core deployment once the DSP cycle completes.
        </p>
      </div>

      <div className="mt-12 flex gap-3">
        <div className="w-1 h-1 rounded-full bg-primary animate-ping" />
        <div className="w-1 h-1 rounded-full bg-primary/40 animate-ping delay-100" />
        <div className="w-1 h-1 rounded-full bg-primary/20 animate-ping delay-200" />
      </div>
    </div>
  );
}
