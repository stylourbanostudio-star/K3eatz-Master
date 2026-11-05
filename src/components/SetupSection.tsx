import React, { useState } from 'react';
import { 
  Settings2, 
  Cloud, 
  Monitor, 
  ShieldCheck, 
  Smartphone, 
  Cpu, 
  Speaker,
  Layout,
  RefreshCw,
  LogOut,
  Sliders,
  Keyboard,
  X,
  BookOpen,
  Info,
  HelpCircle,
  Activity,
  Music,
  ArrowRight,
  Volume2,
  Layers,
  Globe,
  HardDrive,
  Usb,
  Mic,
  CheckCircle2
} from 'lucide-react';
import { motion } from 'motion/react';
import { useMastering } from '../context/MasteringContext';

export default function SetupSection() {
  const {
    appTheme,
    setAppTheme,
    glowIntensity,
    setGlowIntensity,
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
  } = useMastering();

  const [activeTab, setActiveTab] = useState<'config' | 'about'>('config');
  const [expandedSection, setExpandedSection] = useState<string | null>('intro');
  const [cloudActive, setCloudActive] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isShortcutModalOpen, setIsShortcutModalOpen] = useState(false);

  const handleScan = async () => {
    setIsScanning(true);
    try {
      await refreshAudioDevices();
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setIsScanning(false), 800);
    }
  };

  const isMobile = /iphone|ipad|ipod|android/i.test(navigator.userAgent.toLowerCase());

  const driverOptions = isMobile ? [
    { value: 'AAudio Engine (Android)', label: 'AAudio Low-Latency Engine' },
    { value: 'CoreAudio Mobile (iOS)', label: 'CoreAudio Mobile Out' },
    { value: 'OpenSL ES Mobile Link', label: 'OpenSL ES Audio Interface' },
    { value: 'Bluetooth Low-Latency Direct', label: 'Bluetooth Wireless (Synced)' },
    { value: 'Universal WebAudio Engine', label: 'Universal WebAudio Bridge' }
  ] : [
    { value: 'ASIO Web-Direct Link', label: 'ASIO Low-Latency Driver' },
    { value: 'CoreAudio Engine (macOS)', label: 'CoreAudio Engine (macOS)' },
    { value: 'Windows WASAPI Exclusive', label: 'WASAPI Exclusive Driver' },
    { value: 'DirectSound / MME Wave', label: 'MME / DirectSound Fallback' },
    { value: 'Universal WebAudio Engine', label: 'Universal WebAudio Engine' }
  ];

  return (
    <div className="h-full w-full flex flex-col p-8 bg-obsidian overflow-y-auto custom-scrollbar">
      <div className="max-w-4xl mx-auto w-full space-y-8">
        
        {/* Header */}
        <div className="flex flex-col gap-4">
           <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                 <Settings2 className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-4xl font-mono font-black italic text-white uppercase tracking-tighter">
                System <span className="text-primary italic">Setup</span>
              </h1>
           </div>
           <p className="text-white/40 max-w-lg font-sans text-sm">
              Configure seu terminal para obter o melhor desempenho na masterização de áudio K-3EATZ.
           </p>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-white/5 pb-1 gap-2">
           <button 
             onClick={() => setActiveTab('config')}
             className={`pb-3 px-4 font-mono text-[10px] font-black uppercase tracking-widest relative transition-all cursor-pointer ${
               activeTab === 'config' ? 'text-primary' : 'text-white/45 hover:text-white'
             }`}
           >
              Preferências
              {activeTab === 'config' && (
                <motion.div layoutId="setupActiveTab" className="absolute bottom-0 inset-x-0 h-0.5 bg-primary" />
              )}
           </button>
           <button 
             onClick={() => setActiveTab('about')}
             className={`pb-3 px-4 font-mono text-[10px] font-black uppercase tracking-widest relative transition-all cursor-pointer ${
               activeTab === 'about' ? 'text-primary' : 'text-white/45 hover:text-white'
             }`}
           >
              Sobre & Manual Técnico
              {activeTab === 'about' && (
                <motion.div layoutId="setupActiveTab" className="absolute bottom-0 inset-x-0 h-0.5 bg-primary" />
              )}
           </button>
        </div>

        {activeTab === 'config' ? (
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Visual Identification */}
              <div className="space-y-6">
                 <h3 className="engraved-label text-white/20 italic">Visual Identity</h3>
                 <div className="hardware-panel p-6 rounded-3xl space-y-6">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-graphite flex items-center justify-center text-white/20">
                             <Layout className="w-5 h-5" />
                          </div>
                          <div>
                             <p className="font-mono text-[11px] font-black text-white uppercase tracking-widest">Interface Theme</p>
                             <p className="text-[9px] text-white/30 uppercase tracking-widest mt-1">Current: {appTheme === 'LIGHT' ? 'WHITE' : appTheme} MODE</p>
                          </div>
                       </div>
                       <div className="flex bg-black p-1 rounded-lg border border-white/5">
                          {['DARK', 'WHITE', 'SYSTEM'].map(t => (
                             <button 
                               key={t}
                               onClick={() => setAppTheme(t === 'WHITE' ? 'LIGHT' : t as any)}
                               className={`px-3 py-1 rounded font-mono text-[9px] font-black uppercase tracking-widest transition-all ${
                                 (t === 'WHITE' && appTheme === 'LIGHT') || (t === appTheme)
                                   ? 'bg-primary text-on-primary font-black' 
                                   : 'text-white/40 hover:text-white'
                               }`}
                             >
                                {t}
                             </button>
                          ))}
                       </div>
                    </div>

                    <div className="space-y-4">
                       <div className="flex justify-between items-center px-1">
                          <span className="font-mono text-[10px] text-white/40 uppercase tracking-widest">Glow Intensity</span>
                          <span className="font-mono text-[10px] text-primary font-bold">{glowIntensity}%</span>
                       </div>
                       <input 
                         type="range"
                         min="0"
                         max="100"
                         step="5"
                         value={glowIntensity}
                         onChange={(e) => setGlowIntensity(parseInt(e.target.value, 10))}
                         className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary focus:outline-hidden"
                       />
                    </div>
                 </div>
              </div>

              {/* Cloud Architecture */}
              <div className="space-y-6">
                 <h3 className="engraved-label text-white/20 italic">Cloud Infrastructure</h3>
                 <div className="hardware-panel p-6 rounded-3xl space-y-6">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${cloudActive ? 'bg-primary/20 text-primary' : 'bg-white/5 text-white/20'}`}>
                             <Cloud className="w-5 h-5" />
                          </div>
                          <div>
                             <p className="font-mono text-[11px] font-black text-white uppercase tracking-widest">Synchronization</p>
                             <p className={`text-[9px] uppercase tracking-widest mt-1 ${cloudActive ? 'text-primary animate-pulse' : 'text-white/30'}`}>
                                {cloudActive ? 'Connected & Active' : 'Offline'}
                             </p>
                          </div>
                       </div>
                       <button 
                         onClick={() => setCloudActive(!cloudActive)}
                         className={`w-12 h-6 rounded-full relative transition-colors ${cloudActive ? 'bg-primary' : 'bg-white/20'}`}
                       >
                          <motion.div 
                            initial={false}
                            animate={{ x: cloudActive ? 24 : 4 }}
                            className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-lg"
                          />
                       </button>
                    </div>
                    
                    <button className="w-full py-3 bg-white/5 border border-white/5 rounded-xl font-mono text-[11px] font-bold text-white uppercase tracking-[0.2em] hover:bg-white/10 transition-all flex items-center justify-center gap-3">
                       <RefreshCw className="w-4 h-4 text-primary" />
                       Check for Updates
                    </button>
                 </div>
              </div>

              {/* Keyboard Controller Shortcuts */}
              <div className="space-y-6 md:col-span-2">
                 <h3 className="engraved-label text-white/20 italic">Tactile Navigation</h3>
                 <div className="hardware-panel p-6 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-6 font-mono bg-black/30 border border-white/5 shadow-inner">
                    <div className="flex items-center gap-4">
                       <div className="p-3 bg-primary/15 border border-primary/25 rounded-2xl text-primary">
                          <Keyboard className="w-5 h-5" />
                       </div>
                       <div>
                          <p className="font-mono text-[11px] font-bold text-white uppercase tracking-widest">Keyboard Controller Shortcuts</p>
                          <p className="text-[9px] text-white/35 uppercase tracking-widest mt-1">Accelerate mixing, playback, and editing operations with live tactile hotkeys.</p>
                       </div>
                    </div>
                    <button 
                      onClick={() => setIsShortcutModalOpen(true)}
                      className="px-6 py-2.5 bg-primary/20 border border-primary/30 rounded-xl text-primary font-mono text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-on-primary hover:border-primary transition-all shadow-lg active:scale-95 whitespace-nowrap cursor-pointer"
                    >
                       View Hotkeys Map
                    </button>
                 </div>
              </div>

               {/* Audio Engine */}
               <div className="md:col-span-2 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                     <h3 className="engraved-label text-white/20 italic">Audio Infrastructure & Routing</h3>
                     
                     {/* Realtime OS Core Tag */}
                     <div className="px-3 py-1.5 bg-white/5 border border-white/5 flex items-center gap-2 rounded-lg">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        <span className="font-mono text-[9px] text-white/50 uppercase tracking-widest">
                          Active Core: <span className="text-primary font-black">{detectedOS}</span>
                        </span>
                     </div>
                  </div>

                  <div className="hardware-panel p-8 rounded-3xl space-y-8">
                     {/* Hardware Event Alert Banner if recently connected/scanned */}
                     {lastHardwareEvent && (
                       <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between text-[10px] font-mono text-primary">
                         <div className="flex items-center gap-2">
                           <Activity className="w-4 h-4 animate-pulse" />
                           <span>{lastHardwareEvent.message}</span>
                         </div>
                         <span className="text-white/40 text-[9px]">{new Date(lastHardwareEvent.timestamp).toLocaleTimeString()}</span>
                       </div>
                     )}

                     {/* Permission Banner to reveal actual hardware model names if not yet granted */}
                     {!hasDevicePermission && (
                       <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                         <div className="flex items-center gap-3">
                           <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300">
                             <ShieldCheck className="w-5 h-5" />
                           </div>
                           <div>
                             <p className="font-mono text-[10.5px] font-black text-amber-200 uppercase tracking-widest">
                               Identificação Precisa de Placas de Áudio
                             </p>
                             <p className="text-[9.5px] text-white/50 leading-relaxed font-sans">
                               Navegadores exigem autorização pontual de áudio para identificar marcas e modelos de interfaces externas (Focusrite, Apollo, MOTU, etc.).
                             </p>
                           </div>
                         </div>
                         <button
                           onClick={() => requestDevicePermission()}
                           className="px-4 py-2 bg-amber-500 text-black font-mono text-[9px] font-black uppercase tracking-wider rounded-xl hover:bg-amber-400 transition-all shrink-0 cursor-pointer shadow-lg"
                         >
                           Autorizar Nomes Reais
                         </button>
                       </div>
                     )}
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Card 1: DSP Summer */}
                    <div className="space-y-4 group">
                       <div className="flex items-center gap-4">
                          <div className="p-3 rounded-xl bg-obsidian border border-white/5 text-primary">
                             <Cpu className="w-6 h-6" />
                          </div>
                          <div>
                             <h4 className="font-mono text-[10px] font-black text-white uppercase tracking-widest">Internal Summing</h4>
                             <p className="text-primary font-mono text-[10px] font-black uppercase mt-1">32-Bit Double-Prec</p>
                          </div>
                       </div>
                       <p className="text-[10px] text-white/30 leading-relaxed font-sans">
                          Linear-phase high-speed neural summing engine with 64-bit precision internal accumulators.
                       </p>
                    </div>

                    {/* Card 2: Audio Driver Select */}
                    <div className="space-y-4 group">
                       <div className="flex items-center gap-4">
                          <div className="p-3 rounded-xl bg-obsidian border border-white/5 text-primary">
                             <Sliders className="w-6 h-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                             <h4 className="font-mono text-[10px] font-black text-white uppercase tracking-widest">Master Driver</h4>
                             <select 
                               value={audioDriver}
                               onChange={(e) => setAudioDriver(e.target.value)}
                               className="w-full mt-1.5 bg-black text-primary font-mono text-[10px] font-bold uppercase py-1 px-2 rounded border border-white/10 focus:outline-hidden focus:border-primary/50"
                             >
                               {driverOptions.map(opt => (
                                 <option key={opt.value} value={opt.value}>
                                   {opt.label}
                                 </option>
                               ))}
                             </select>
                          </div>
                       </div>
                       <p className="text-[10px] text-white/30 leading-relaxed font-sans">
                          Advanced low-latency kernel-bypass driver interface for direct buffer audio output.
                       </p>
                    </div>

                    {/* Card 3: Audio Output Select */}
                    <div className="space-y-4 group">
                       <div className="flex items-center gap-4">
                          <div className="p-3 rounded-xl bg-obsidian border border-white/5 text-primary">
                             <Speaker className="w-6 h-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                             <div className="flex items-center justify-between">
                               <h4 className="font-mono text-[10px] font-black text-white uppercase tracking-widest">Output Hardware</h4>
                               <span className="font-mono text-[8px] text-primary font-bold">{audioOutputDevices.length} opções</span>
                             </div>
                             <select 
                               value={selectedAudioOutput}
                               onChange={(e) => setSelectedAudioOutput(e.target.value)}
                               className="w-full mt-1.5 bg-black text-primary font-mono text-[10px] font-bold uppercase py-1 px-2 rounded border border-white/10 focus:outline-hidden focus:border-primary/50 truncate"
                             >
                               {audioOutputDevices.map(device => (
                                 <option key={device.deviceId} value={device.deviceId}>
                                   {device.isExternal ? `[EXT] ${device.label}` : device.label || `Output (${device.deviceId.substring(0, 5)})`}
                                 </option>
                               ))}
                             </select>
                          </div>
                       </div>
                       <p className="text-[10px] text-white/30 leading-relaxed font-sans">
                          Real-time destination routing node mapping for DACs, physical line-outs and monitor speakers.
                       </p>
                    </div>
                    </div>

                    {/* Input Hardware & Active Hardware Inspector */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/5">
                      {/* Input Hardware Selection */}
                      <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Mic className="w-4 h-4 text-primary" />
                            <span className="font-mono text-[10px] font-black text-white uppercase tracking-wider">Entrada de Áudio (Input)</span>
                          </div>
                          <span className="font-mono text-[8px] text-white/40">{audioInputDevices.length} opções</span>
                        </div>
                        <select
                          value={selectedAudioInput}
                          onChange={(e) => setSelectedAudioInput(e.target.value)}
                          className="w-full bg-black text-white/80 font-mono text-[10px] font-bold py-1.5 px-2 rounded border border-white/10 focus:outline-hidden focus:border-primary/50 truncate"
                        >
                          {audioInputDevices.map(device => (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.isExternal ? `[EXT] ${device.label}` : device.label || `Microfone (${device.deviceId.substring(0, 5)})`}
                            </option>
                          ))}
                        </select>
                        <p className="text-[9px] text-white/30 font-sans">
                          Porta de entrada para microfones de medição acústica RTA, talkback ou calibração de sala.
                        </p>
                      </div>

                      {/* Active Hardware Model Inspector */}
                      <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <HardDrive className="w-4 h-4 text-emerald-400" />
                            <span className="font-mono text-[10px] font-black text-white uppercase tracking-wider">Interface Ativa Detectada</span>
                          </div>
                          <span className="flex items-center gap-1 font-mono text-[8px] text-emerald-400 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            CONECTADO
                          </span>
                        </div>

                        <div className="bg-black/60 p-2.5 rounded-xl border border-white/5 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[8px] text-white/40 uppercase">Modelo:</span>
                            <span className="font-mono text-[9px] text-primary font-bold truncate max-w-[200px]">
                              {activeAudioHardware?.modelName || activeAudioHardware?.label || 'Placa Integrada Padrão'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[8px] text-white/40 uppercase">Fabricante / Marca:</span>
                            <span className="font-mono text-[9px] text-white/80 font-bold">
                              {activeAudioHardware?.brand || 'Universal Audio Core'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[8px] text-white/40 uppercase">Tipo de Conexão:</span>
                            <span className="font-mono text-[9px] text-amber-300 font-bold">
                              {activeAudioHardware?.isExternal ? (activeAudioHardware.interfaceType || 'USB Audio Class 2.0') : 'Barramento Interno'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* External Hardware Recognition Highlights */}
                    {externalAudioDevices.length > 0 && (
                      <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-3">
                        <div className="flex items-center gap-2">
                          <Usb className="w-4 h-4 text-primary" />
                          <h4 className="font-mono text-[10.5px] font-black text-primary uppercase tracking-widest">
                            Placas e Interfaces Externas Conectadas ({externalAudioDevices.length})
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {externalAudioDevices.map(ext => (
                            <div 
                              key={ext.deviceId}
                              onClick={() => setSelectedAudioOutput(ext.deviceId)}
                              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                                selectedAudioOutput === ext.deviceId 
                                  ? 'bg-primary/20 border-primary text-white shadow-lg' 
                                  : 'bg-black/50 border-white/5 hover:border-white/20 text-white/70'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="px-1.5 py-0.5 rounded text-[7px] font-mono font-black uppercase bg-primary text-black">
                                  {ext.brand || 'EXT'}
                                </span>
                                {selectedAudioOutput === ext.deviceId && (
                                  <span className="text-[7.5px] font-mono text-primary font-bold flex items-center gap-1">
                                    <CheckCircle2 className="w-2.5 h-2.5" /> ATIVA
                                  </span>
                                )}
                              </div>
                              <p className="font-mono text-[9.5px] font-bold text-white truncate">
                                {ext.modelName || ext.label}
                              </p>
                              <p className="text-[8px] font-mono text-white/40 mt-1">
                                {ext.interfaceType || 'USB Audio'} • {ext.kind === 'audiooutput' ? 'Saída' : 'Entrada'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Diagnostic / Scan Button Bar */}
                    <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                       <div className="flex flex-col gap-1 flex-1">
                          <p className="font-mono text-[10px] text-white/60 uppercase tracking-widest text-left">Hardware Port Recognition</p>
                          <p className="text-[9px] font-sans text-white/30 text-left">Connect external USB interfaces, MIDI sound cards or headphones, then trigger a deep system scan.</p>
                       </div>
                       <button 
                         onClick={handleScan}
                         disabled={isScanning}
                         className="flex items-center gap-3 px-5 py-2.5 rounded-xl border border-white/10 font-mono text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer bg-white/5 text-white hover:bg-white/10"
                       >
                          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin" : ""}`} />
                          {isScanning ? "Scanning Hardware..." : "Scan Connected Drivers"}
                       </button>
                    </div>
                 </div>
               </div>
           </div>
        ) : (
           /* ABOUT & INSTRUCTIONAL MANUAL TAB */
           <div className="space-y-8 animate-in fade-in transition-all duration-300">
              
              {/* Highlight Official Logo */}
              <div className="hardware-panel p-8 rounded-3xl bg-radial from-primary/10 via-black/40 to-black/80 border border-primary/20 flex flex-col md:flex-row items-center gap-8 shadow-[0_0_50px_rgba(29,185,84,0.06)] relative overflow-hidden group">
                 {/* Decorative radar lines inside the grid */}
                 <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />
                 
                 {/* Pulsing neon highlight container around the logo preview */}
                 <div className="relative w-48 h-48 sm:w-56 sm:h-56 shrink-0 bg-black/60 border border-white/10 rounded-2xl p-4 flex items-center justify-center shadow-inner group-hover:border-primary/40 transition-colors duration-500">
                    <div className="absolute inset-2 rounded-xl bg-radial from-primary/5 to-transparent blur-xl" />
                    <img 
                      src="/logo.svg" 
                      alt="K-3EATZ Logo" 
                      className="w-full h-full object-contain relative z-10 transition-transform duration-700 group-hover:scale-105" 
                      referrerPolicy="no-referrer"
                    />
                 </div>

                 {/* Text block talking about Logo identity */}
                 <div className="space-y-4 flex-1">
                    <div className="flex items-center gap-2.5">
                       <span className="px-2 py-0.5 font-mono text-[8.5px] bg-primary/25 border border-primary/35 text-primary font-black uppercase rounded tracking-widest">
                          Selo de Identidade
                       </span>
                       <span className="text-white/20 font-mono text-[9px]">•</span>
                       <span className="font-mono text-[9px] text-white/40 uppercase tracking-widest">
                          Console Original
                       </span>
                    </div>

                    <h2 className="text-2xl font-mono font-black text-white uppercase tracking-tight italic">
                       Conectando Som & <span className="text-primary">Identidade K-3EATZ</span>
                    </h2>

                    <p className="text-white/70 font-sans text-xs leading-relaxed">
                       O ícone oficial de **K-3EATZ** funde o nome do artista diretamente com uma representação sutil de oscilador e ondas analógicas senoidais e espectrais. O nome se dissolve e emerge de colunas de frequência calibrada, retratando o perfeito equilíbrio entre harmonia, volume e potência máxima.
                     </p>

                     <p className="text-white/50 font-sans text-xs leading-relaxed border-t border-white/5 pt-3">
                        **Trajetória & Engenharia**: Atuando na produção de áudio como **Beatmaker desde 2003**, o artista iniciou em **2014** sua trajetória como **DJ Khally**, tocando em diversos eventos e festas icônicas de São Paulo (SP). Retomando posteriormente sua assinatura como **DJ K-3EATZ**, idealizou e deitou as fundações deste masterizador com o objetivo prático de agilizar seus próprios projetos de estúdio. Hoje, esta refinada ferramenta opera sob uma sutil e técnica lógica de **DOWN Mastering** (Digital Optimized Waveform Network), compartilhando este console com a expectativa de apoiar e acelerar a finalização de faixas de muitos outros produtores.
                    </p>

                    <div className="pt-2 flex flex-wrap gap-x-4 gap-y-2 text-[10px] font-mono text-white/40 uppercase">
                       <span className="flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-primary" />
                          Mastering Sum
                       </span>
                       <span>•</span>
                       <span className="flex items-center gap-1.5">
                          <Music className="w-3.5 h-3.5 text-secondary" />
                          Zero Clipping
                       </span>
                       <span>•</span>
                       <span className="flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-primary" />
                          Neural Routing
                       </span>
                    </div>
                 </div>
              </div>

              {/* Technical Specifications Accordion Manual */}
              <div className="space-y-4">
                 <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary animate-pulse" />
                    <h3 className="engraved-label text-white/50 italic uppercase tracking-wider">Manual de Operação Técnico</h3>
                 </div>

                 <div className="space-y-3">
                    
                    {/* SECTION 1: Intro */}
                    <div className="hardware-panel rounded-2xl overflow-hidden border border-white/5">
                       <button 
                         onClick={() => setExpandedSection(expandedSection === 'intro' ? null : 'intro')}
                         className="w-full p-4 flex items-center justify-between font-mono bg-black/45 hover:bg-black/60 transition-all text-left cursor-pointer"
                       >
                          <div className="flex items-center gap-3 font-mono">
                             <span className="text-primary font-black text-[10px]">01</span>
                             <span className="text-[11px] font-black text-white uppercase tracking-widest">Introdução Geral do Sistema</span>
                          </div>
                          <span className="text-[9px] text-white/30 font-bold font-mono">{expandedSection === 'intro' ? '▲ FECHAR' : '▼ ABRIR'}</span>
                       </button>
                       {expandedSection === 'intro' && (
                          <div className="p-5 bg-black/20 border-t border-white/5 text-xs text-white/60 leading-relaxed font-sans space-y-3">
                             <p>
                                O **K-3EATZ Neural Mastering Console** é um ambiente completo para somas estéreo, balanceamento harmônico e maximização de volume percebido. Ele possibilita que produtores e beatmakers preparem e elevem suas pistas (beats ou músicas completas) para lançamento imediato e otimizado.
                             </p>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                <div className="p-3 rounded-lg bg-white/5 border border-white/5 space-y-1">
                                   <p className="font-mono text-[9px] text-primary font-bold uppercase tracking-wider">Soma Direta de Estágio</p>
                                   <p className="text-[10px] text-white/40 leading-normal">Mantém os transientes vivos e reduz perdas de fase harmônica nas baixas frequências.</p>
                                </div>
                                <div className="p-3 rounded-lg bg-white/5 border border-white/5 space-y-1">
                                   <p className="font-mono text-[9px] text-primary font-bold uppercase tracking-wider">True Peak inteligente</p>
                                   <p className="text-[10px] text-white/40 leading-normal">Garante limite físico absoluto contra distorções e clipagens digitais.</p>
                                </div>
                             </div>
                          </div>
                       )}
                    </div>

                    {/* SECTION 2: Waveform Editor */}
                    <div className="hardware-panel rounded-2xl overflow-hidden border border-white/5">
                       <button 
                         onClick={() => setExpandedSection(expandedSection === 'editor' ? null : 'editor')}
                         className="w-full p-4 flex items-center justify-between font-mono bg-black/45 hover:bg-black/60 transition-all text-left cursor-pointer"
                       >
                          <div className="flex items-center gap-3 font-mono">
                             <span className="text-primary font-black text-[10px]">02</span>
                             <span className="text-[11px] font-black text-white uppercase tracking-widest">Navegação e Editor de Ondas</span>
                          </div>
                          <span className="text-[9px] text-white/30 font-bold font-mono">{expandedSection === 'editor' ? '▲ FECHAR' : '▼ ABRIR'}</span>
                       </button>
                       {expandedSection === 'editor' && (
                          <div className="p-5 bg-black/20 border-t border-white/5 text-xs text-white/60 leading-relaxed font-sans space-y-3">
                             <p>
                                O visualizador no topo renderiza de forma detalhada o comportamento dinâmico e o envelope do arquivo de áudio carregado.
                             </p>
                             <ul className="list-disc list-inside space-y-1.5 pl-1 text-[11px] text-white/45">
                                <li>**Loader Integrado**: Permite arrastar ou selecionar arquivos locais nos formatos `.wav`, `.mp3`, `.ogg` e `.flac`.</li>
                                <li>**Navegação Rápida**: Clique sobre qualquer ponto horizontal do waveform para posicionar a agulha de reprodução.</li>
                                <li>**Marcador Neon**: A linha em movimento representa o playhead dinâmico sincronizado em tempo real.</li>
                             </ul>
                          </div>
                       )}
                    </div>

                    {/* SECTION 3: Spectrum EQ */}
                    <div className="hardware-panel rounded-2xl overflow-hidden border border-white/5">
                       <button 
                         onClick={() => setExpandedSection(expandedSection === 'eq' ? null : 'eq')}
                         className="w-full p-4 flex items-center justify-between font-mono bg-black/45 hover:bg-black/60 transition-all text-left cursor-pointer"
                       >
                          <div className="flex items-center gap-3 font-mono">
                             <span className="text-primary font-black text-[10px]">03</span>
                             <span className="text-[11px] font-black text-white uppercase tracking-widest">Modelador de Espectro (Equalizador)</span>
                          </div>
                          <span className="text-[9px] text-white/30 font-bold font-mono">{expandedSection === 'eq' ? '▲ FECHAR' : '▼ ABRIR'}</span>
                       </button>
                       {expandedSection === 'eq' && (
                          <div className="p-5 bg-black/20 border-t border-white/5 text-xs text-white/60 leading-relaxed font-sans space-y-3">
                             <p>
                                Permite ajustar três bandas cirúrgicas essenciais para moldar o equilíbrio harmônico e tonal geral da música:
                             </p>
                             <div className="space-y-4 pt-1">
                                <div className="flex gap-4">
                                   <div className="font-mono text-[9px] bg-white/5 px-2.5 py-1 rounded h-fit block font-bold text-primary">LOW SHELF</div>
                                   <p className="text-[11px] text-white/50 leading-relaxed">
                                      **Graves & Impacto (80Hz)**: Proporciona controle total sobre o peso dos bumbos e subgraves, permitindo atenuar excessos embolados ou empurrar com força em produções de Hip Hop/Trap.
                                   </p>
                                </div>
                                <div className="flex gap-4">
                                   <div className="font-mono text-[9px] bg-white/5 px-2.5 py-1 rounded h-fit block font-bold text-primary">BELL PEAK</div>
                                   <p className="text-[11px] text-white/50 leading-relaxed">
                                      **Foco & Médios (1.5kHz)**: Controla a área de destaque dos vocais, caixa de bateria e instrumentos principais, facilitando maior presença ou limpando ressonâncias nessa zona do espectro.
                                   </p>
                                </div>
                                <div className="flex gap-4">
                                   <div className="font-mono text-[9px] bg-white/5 px-2.5 py-1 rounded h-fit block font-bold text-primary">HIGH SHELF</div>
                                   <p className="text-[11px] text-white/50 leading-relaxed">
                                      **Ar & Brilho (10kHz)**: Traz brilho cristalino profissional e abertura estéreo aos agudos de hi-hats, loops de percussão e texturas aéreas de vocais.
                                   </p>
                                </div>
                             </div>
                          </div>
                       )}
                    </div>

                    {/* SECTION 4: Processing and Limiter */}
                    <div className="hardware-panel rounded-2xl overflow-hidden border border-white/5">
                       <button 
                         onClick={() => setExpandedSection(expandedSection === 'limiter' ? null : 'limiter')}
                         className="w-full p-4 flex items-center justify-between font-mono bg-black/45 hover:bg-black/60 transition-all text-left cursor-pointer"
                       >
                          <div className="flex items-center gap-3 font-mono">
                             <span className="text-primary font-black text-[10px]">04</span>
                             <span className="text-[11px] font-black text-white uppercase tracking-widest">Ganho de Entrada & Limitador Inteligente</span>
                          </div>
                          <span className="text-[9px] text-white/30 font-bold font-mono">{expandedSection === 'limiter' ? '▲ FECHAR' : '▼ ABRIR'}</span>
                       </button>
                       {expandedSection === 'limiter' && (
                          <div className="p-5 bg-black/20 border-t border-white/5 text-xs text-white/60 leading-relaxed font-sans space-y-3">
                             <p>
                                O motor térmico final calcula e molda o volume máximo otimizando o headroom dinâmico:
                             </p>
                             <ul className="list-disc list-inside space-y-2 pl-1 text-[11px] text-white/45">
                                <li>**Gain Drive**: Amplifica o sinal que alimenta a cadeia de compressão do console para encorpar a música.</li>
                                <li>**LUFS Targets calibrados (Alvos de Saída)**: Fornece presets prontos como **Spotify/YouTube (-14 LUFS)** para manter sua dinâmica nativa, **Apple Music (-16 LUFS)** ou perfis de peso comercial como **Club / CD (-9 LUFS a -7 LUFS)**.</li>
                                <li>**Peak Ceiling (-1.0 dBTP)**: Mantém o teto estéreo em conformidade física para evitar clipping e distorções agressivas ao converter o áudio para streaming.</li>
                             </ul>
                          </div>
                       )}
                    </div>

                    {/* SECTION 5: Real-time Meters */}
                    <div className="hardware-panel rounded-2xl overflow-hidden border border-white/5">
                       <button 
                         onClick={() => setExpandedSection(expandedSection === 'meters' ? null : 'meters')}
                         className="w-full p-4 flex items-center justify-between font-mono bg-black/45 hover:bg-black/60 transition-all text-left cursor-pointer"
                       >
                          <div className="flex items-center gap-3 font-mono">
                             <span className="text-primary font-black text-[10px]">05</span>
                             <span className="text-[11px] font-black text-white uppercase tracking-widest">Medições Físicas (Integrated LUFS, TP, Range)</span>
                          </div>
                          <span className="text-[9px] text-white/30 font-bold font-mono">{expandedSection === 'meters' ? '▲ FECHAR' : '▼ ABRIR'}</span>
                       </button>
                       {expandedSection === 'meters' && (
                          <div className="p-5 bg-black/20 border-t border-white/5 text-xs text-white/60 leading-relaxed font-sans space-y-3">
                             <p>
                                Monitore com exatidão a resposta com medidores desenhados para a norma internacional **EBU R128**:
                             </p>
                             <ul className="list-disc list-inside space-y-1.5 pl-1 text-[11px] text-white/45">
                                <li>**Integrated LUFS**: Informa o volume integrado acumulado de forma contínua durante a música.</li>
                                <li>**True Peak (dBTP)**: Analisa picos analógicos entre amostras digitais, evitando qualquer estalo indesejado.</li>
                                <li>**Alerta Inteligente**: Mostra avisos como **"Optimized"** quando seu LUFS e ganho estão sincronizados com as quotas exigidas pelas plataformas de streaming.</li>
                             </ul>
                          </div>
                       )}
                    </div>

                    {/* SECTION 6: Preset Memory bank */}
                    <div className="hardware-panel rounded-2xl overflow-hidden border border-white/5">
                       <button 
                         onClick={() => setExpandedSection(expandedSection === 'presets' ? null : 'presets')}
                         className="w-full p-4 flex items-center justify-between font-mono bg-black/45 hover:bg-black/60 transition-all text-left cursor-pointer"
                       >
                          <div className="flex items-center gap-3 font-mono">
                             <span className="text-primary font-black text-[10px]">06</span>
                             <span className="text-[11px] font-black text-white uppercase tracking-widest">Banco de Memória Custom Preset Ware</span>
                          </div>
                          <span className="text-[9px] text-white/30 font-bold font-mono">{expandedSection === 'presets' ? '▲ FECHAR' : '▼ ABRIR'}</span>
                       </button>
                       {expandedSection === 'presets' && (
                          <div className="p-5 bg-black/20 border-t border-white/5 text-xs text-white/60 leading-relaxed font-sans space-y-2">
                             <p>
                                Salve combinações exclusivas de equalização, alvos LOUDS e saturação criadas por você no banco de dados integrado:
                             </p>
                             <p>
                                Dê nomes customizados aos presets (ex: "TAPESUB-BOOST") e armazene sua identidade sonora para que ela possa ser resgatada e aplicada em novos projetos em menos de um segundo.
                             </p>
                          </div>
                       )}
                    </div>

                 </div>
              </div>

           </div>
        )}

        {/* System Footer Actions */}
        <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-8">
           <div className="flex items-center gap-8 text-white/20">
              <div className="flex items-center gap-3">
                 <Monitor className="w-4 h-4" />
                 <span className="font-mono text-[9px] uppercase tracking-widest">Pro Workstation v2.4</span>
              </div>
              <div className="flex items-center gap-3">
                 <Smartphone className="w-4 h-4" />
                 <span className="font-mono text-[9px] uppercase tracking-widest">Mobile Remote Ready</span>
              </div>
           </div>

           <button className="flex items-center gap-3 px-6 py-3 rounded-xl bg-scarlet/10 border border-scarlet/20 text-scarlet font-mono text-[10px] font-black uppercase tracking-widest hover:bg-scarlet hover:text-on-primary transition-all">
              <LogOut className="w-4 h-4" />
              Terminate Terminal
           </button>
        </div>
      </div>

      {/* Keyboard Shortcuts Modal Overlay */}
      {isShortcutModalOpen && (
         <div className="fixed inset-0 min-h-screen bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="relative w-full max-w-2xl bg-gradient-to-b from-graphite to-obsidian border border-white/10 p-8 rounded-3xl shadow-2xl overflow-hidden"
            >
               {/* Decorative Neon lines */}
               <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-primary/50 to-transparent" />
               <div className="absolute bottom-0 inset-x-0 h-px bg-linear-to-r from-transparent via-scarlet/20 to-transparent" />

               {/* Close Button */}
               <button 
                 onClick={() => setIsShortcutModalOpen(false)}
                 className="absolute top-6 right-6 p-2 rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer"
               >
                  <X className="w-4 h-4" />
               </button>

               {/* Modal Header */}
               <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-primary/10 border border-primary/25 rounded-2xl text-primary">
                     <Keyboard className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                     <h2 className="text-xl font-mono font-black italic text-white uppercase tracking-tighter">
                       Mastering <span className="text-primary italic">Terminal Shortcuts</span>
                     </h2>
                     <p className="text-white/40 font-mono text-[9px] uppercase tracking-widest mt-1">Full tactile control matrix for audio engineering</p>
                  </div>
               </div>

               {/* Shortcuts Categorized Grid */}
               <div className="space-y-6">
                  {/* Category: Global App Commands */}
                  <div>
                     <span className="engraved-label text-[9px] text-primary block mb-3 uppercase tracking-widest">Global Live System Controls</span>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex items-center justify-between p-3.5 bg-black/40 rounded-xl border border-white/5 hover:border-white/15 transition-all">
                           <div className="space-y-1">
                              <p className="font-mono text-[11px] font-bold text-white uppercase tracking-widest">Play / Pause</p>
                              <p className="text-[9px] text-white/30 font-sans">Toggle global track playback</p>
                           </div>
                           <kbd className="px-3 py-1 bg-graphite border border-white/10 rounded text-[10px] font-mono font-bold text-primary shadow-[0_2px_4px_rgba(0,0,0,0.5)]">SPACE</kbd>
                        </div>

                        <div className="flex items-center justify-between p-3.5 bg-black/40 rounded-xl border border-white/5 hover:border-white/15 transition-all">
                           <div className="space-y-1">
                              <p className="font-mono text-[11px] font-bold text-white uppercase tracking-widest">Master Bypass</p>
                              <p className="text-[9px] text-white/30 font-sans">Toggle active DSP processing</p>
                           </div>
                           <kbd className="px-3.5 py-1 bg-graphite border border-white/10 rounded text-[10px] font-mono font-bold text-primary shadow-[0_2px_4px_rgba(0,0,0,0.5)]">M</kbd>
                        </div>

                        <div className="flex items-center justify-between p-3.5 bg-black/40 rounded-xl border border-white/5 hover:border-white/15 transition-all">
                           <div className="space-y-1">
                              <p className="font-mono text-[11px] font-bold text-white uppercase tracking-widest">Load Track</p>
                              <p className="text-[9px] text-white/30 font-sans">Instantly jump to loader screen</p>
                           </div>
                           <kbd className="px-3.5 py-1 bg-graphite border border-white/10 rounded text-[10px] font-mono font-bold text-primary shadow-[0_2px_4px_rgba(0,0,0,0.5)]">L</kbd>
                        </div>
                     </div>
                  </div>

                  {/* Category: Dynamic Audio Editor Controls */}
                  <div>
                     <span className="engraved-label text-[9px] text-scarlet block mb-3 uppercase tracking-widest">Audio Multi-Clip Editor Controls</span>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex items-center justify-between p-3.5 bg-black/40 rounded-xl border border-white/5 hover:border-white/15 transition-all">
                           <div className="space-y-1">
                              <p className="font-mono text-[11px] font-bold text-white uppercase tracking-widest">Undo Last Action</p>
                              <p className="text-[9px] text-white/30 font-sans">Step backwards in editor history</p>
                           </div>
                           <div className="flex gap-1.5">
                              <kbd className="px-2 py-1 bg-graphite border border-white/10 rounded text-[10px] font-mono font-bold text-white/60">Ctrl</kbd>
                              <span className="text-white/20 self-center">+</span>
                              <kbd className="px-2 py-1 bg-graphite border border-white/10 rounded text-[10px] font-mono font-bold text-white/60">Z</kbd>
                           </div>
                        </div>

                        <div className="flex items-center justify-between p-3.5 bg-black/40 rounded-xl border border-white/5 hover:border-white/15 transition-all">
                           <div className="space-y-1">
                               <p className="font-mono text-[11px] font-bold text-white uppercase tracking-widest">Redo Action</p>
                               <p className="text-[9px] text-white/30 font-sans">Step forwards in editor history</p>
                            </div>
                            <div className="flex gap-1.5">
                               <kbd className="px-2 py-1 bg-graphite border border-white/10 rounded text-[10px] font-mono font-bold text-white/60">Ctrl</kbd>
                               <span className="text-white/20 self-center">+</span>
                               <kbd className="px-2 py-1 bg-graphite border border-white/10 rounded text-[10px] font-mono font-bold text-white/60">Shift</kbd>
                               <span className="text-white/20 self-center">+</span>
                               <kbd className="px-2 py-1 bg-graphite border border-white/10 rounded text-[10px] font-mono font-bold text-white/60">Z</kbd>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Micro Tips */}
                <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      <span className="font-mono text-[8px] text-white/30 uppercase tracking-widest">Input elements automatically bypass hotkeys</span>
                   </div>
                   <button 
                     type="button"
                     onClick={() => setIsShortcutModalOpen(false)}
                     className="px-5 py-2.5 bg-white/5 border border-white/15 rounded-xl font-mono text-[10px] font-bold uppercase text-white/85 tracking-widest hover:bg-white/10 hover:text-white transition-all cursor-pointer"
                   >
                      Acknowledge Matrix
                   </button>
                </div>
             </motion.div>
          </div>
       )}
    </div>
  );
}
