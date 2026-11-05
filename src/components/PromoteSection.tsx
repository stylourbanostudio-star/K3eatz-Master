import React, { useState, useRef } from 'react';
import { 
  Sparkles, 
  Instagram, 
  Share2, 
  Video, 
  Phone, 
  Layout, 
  RefreshCw, 
  Download,
  CheckCircle2,
  Tv,
  ArrowRight,
  Music,
  Eye,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useMastering } from '../context/MasteringContext';

export default function PromoteSection() {
  const { currentTrack } = useMastering();
  const [generating, setGenerating] = useState(false);
  const formats = [
    { id: 'Stories', icon: Phone, ratio: '9/16', label: '1080x1920', platforms: 'IG / TikTok / WA' },
    { id: 'Portrait Feed', icon: Instagram, ratio: '4/5', label: '1080x1350', platforms: 'Instagram' },
    { id: 'Square Feed', icon: Layout, ratio: '1/1', label: '1080x1080', platforms: 'Standard' },
    { id: 'Widescreen', icon: Tv, ratio: '16/9', label: '1280x720', platforms: 'FB / YT / LI' },
    { id: 'Header', icon: Share2, ratio: '3/1', label: '1500x500', platforms: 'X / Branding' },
  ];

  const templates = [
    { id: 'None', label: 'Clean Master' },
    { id: 'Spotify', label: 'Spotify Style' },
    { id: 'Apple', label: 'Apple Music' },
    { id: 'YouTube', label: 'YouTube Music' },
  ];

  const [selectedFormat, setSelectedFormat] = useState(formats[0]);
  const [selectedTemplate, setSelectedTemplate] = useState('None');
  const [aiMode, setAiMode] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [complete, setComplete] = useState(false);
  const [aiImageUrl, setAiImageUrl] = useState<string | null>(null);

  // Custom User Backdrop Image state
  const [customArtUrl, setCustomArtUrl] = useState<string | null>(() => {
    return localStorage.getItem('mastercore_promote_custom_art') || null;
  });

  const customArtInputRef = useRef<HTMLInputElement>(null);

  const handleCustomArtChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        setCustomArtUrl(url);
        localStorage.setItem('mastercore_promote_custom_art', url);
        setAiImageUrl(url);
        setComplete(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setComplete(false);
    setAiImageUrl(null);

    if (aiMode && aiPrompt.trim()) {
      try {
        const mappedRatio = selectedFormat.ratio.replace('/', ':');
        const response = await fetch('/api/generate-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt: `Cinematic artistic ambient release background cover art, luxury design concept: ${aiPrompt}. Matching music genre and aesthetic colors. Empty space for text layout.`,
            aspectRatio: mappedRatio
          })
        });

        const data = await response.json();
        if (data.success && data.image) {
          setAiImageUrl(data.image);
        } else {
          throw new Error("Proxy generation failed");
        }
      } catch (err) {
        console.error("Artistic promo card generation failed:", err);
        setAiImageUrl(customArtUrl || `https://picsum.photos/seed/${Math.random()}/1080/1920?blur=5`);
      } finally {
        setGenerating(false);
        setComplete(true);
      }
    } else {
      // Classic instant mode
      setTimeout(() => {
        setAiImageUrl(customArtUrl || `https://picsum.photos/seed/${currentTrack?.id || 'test'}/1080/1920?blur=5`);
        setGenerating(false);
        setComplete(true);
      }, 2000);
    }
  };

  return (
    <div className="h-full w-full flex flex-col p-8 bg-obsidian overflow-y-auto custom-scrollbar">
      <div className="max-w-6xl mx-auto w-full space-y-12">
        
        {/* Header */}
        <div className="flex flex-col gap-4">
           <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                 <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-4xl font-mono font-black italic text-white uppercase tracking-tighter">
                Promotional <span className="text-primary italic">Forge</span>
              </h1>
           </div>
           <p className="text-white/40 max-w-lg font-sans text-sm">
              Generate viral-ready social media assets optimized for your terminal master release.
           </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
           {/* Left: Configuration */}
           <div className="lg:col-span-5 space-y-8">
              <div className="space-y-6">
                 <h3 className="engraved-label text-white/20 italic">Select Social Module</h3>
                 <div className="grid grid-cols-2 gap-4">
                    {formats.map(f => (
                      <button 
                        key={f.id}
                        onClick={() => setSelectedFormat(f)}
                        className={`p-4 rounded-3xl border flex flex-col items-center gap-2 transition-all ${
                          selectedFormat.id === f.id 
                            ? 'bg-primary/10 border-primary text-primary' 
                            : 'bg-obsidian-light border-white/5 text-white/30 hover:border-white/15'
                        }`}
                      >
                         <f.icon className="w-5 h-5" />
                         <div className="text-center">
                            <span className="block font-mono text-[9px] font-black uppercase tracking-widest">{f.id}</span>
                            <span className="block text-[7px] font-mono text-white/20 uppercase mt-1">{f.platforms}</span>
                         </div>
                      </button>
                    ))}
                 </div>
              </div>

              <div className="hardware-panel p-8 rounded-3xl space-y-8">
                 <div className="space-y-6">
                    <h3 className="engraved-label text-white/40">Visual Template</h3>
                    <div className="grid grid-cols-2 gap-2">
                       {templates.map(t => (
                         <button 
                           key={t.id}
                           onClick={() => setSelectedTemplate(t.id)}
                           className={`py-2 px-4 rounded-xl border font-mono text-[9px] uppercase tracking-widest transition-all ${
                             selectedTemplate === t.id 
                               ? 'bg-primary/20 border-primary text-primary' 
                               : 'bg-black/20 border-white/5 text-white/40 hover:border-white/10'
                           }`}
                         >
                           {t.label}
                         </button>
                       ))}
                    </div>
                 </div>

                 <div className="space-y-4">
                    <h3 className="engraved-label text-white/40">Engine Configuration</h3>
                    <div className="space-y-4">
                       <OptionSwitch label="Vivid Motion" active />
                       <OptionSwitch label="Audio Wave Overlay" active />
                       <OptionSwitch label="Neural AI Generation" active={aiMode} onChange={setAiMode} />
                    </div>

                    {/* Custom Backdrop Art Section */}
                    <div className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-3">
                       <div className="flex justify-between items-center">
                          <span className="font-mono text-[10px] text-white/30 uppercase tracking-widest">Custom Backdrop Art</span>
                          {customArtUrl && (
                            <button 
                              onClick={() => { setCustomArtUrl(null); localStorage.removeItem('mastercore_promote_custom_art'); if (aiImageUrl === customArtUrl) setAiImageUrl(null); }}
                              className="text-[8px] font-mono font-bold text-scarlet uppercase hover:underline"
                            >
                              Remove
                            </button>
                          )}
                       </div>
                       
                       <input 
                         type="file" 
                         ref={customArtInputRef} 
                         onChange={handleCustomArtChange} 
                         accept="image/*" 
                         className="hidden" 
                       />
                       
                       {customArtUrl ? (
                         <div className="flex items-center gap-3 bg-black/40 p-2 rounded-xl border border-white/5">
                            <img src={customArtUrl} className="w-10 h-10 object-cover rounded-lg border border-white/10" referrerPolicy="no-referrer" />
                            <div className="flex-1 min-w-0">
                               <p className="font-mono text-[9px] text-primary uppercase font-bold tracking-wider">Backdrop Loaded</p>
                               <p className="text-[7px] text-white/30 uppercase tracking-widest truncate">Custom Artwork Active</p>
                            </div>
                            <button 
                              onClick={() => customArtInputRef.current?.click()}
                              className="text-[8px] font-mono font-black text-white bg-white/10 py-1 px-2 rounded-md hover:bg-white/20 uppercase"
                            >
                              Change
                            </button>
                         </div>
                       ) : (
                         <button 
                           onClick={() => customArtInputRef.current?.click()}
                           className="w-full py-3 bg-black/40 border border-dashed border-white/10 rounded-xl font-mono text-[10px] font-bold text-white/50 uppercase tracking-widest hover:border-primary/40 hover:text-primary transition-all flex items-center justify-center gap-2"
                         >
                            <Upload className="w-3.5 h-3.5" />
                            Upload Backdrop Image
                         </button>
                       )}
                    </div>

                    {aiMode && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 bg-primary/5 border border-primary/20 rounded-2xl"
                      >
                         <p className="text-[9px] font-mono text-primary/60 uppercase tracking-widest mb-2">AI Creative Prompt</p>
                         <textarea 
                           value={aiPrompt}
                           onChange={(e) => setAiPrompt(e.target.value)}
                           placeholder="Describe the mood, colors, and style for your visual card..."
                           className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-[10px] text-white focus:outline-hidden focus:border-primary/50 min-h-[60px] resize-none"
                         />
                      </motion.div>
                    )}
                 </div>

                 <button 
                   onClick={handleGenerate}
                   disabled={generating || !currentTrack}
                   className={`w-full py-5 rounded-2xl font-mono text-xs font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-4 ${
                     generating 
                       ? 'bg-white/5 text-white/20' 
                       : 'bg-primary text-on-primary hover:brightness-110 shadow-[0_0_30px_rgba(29,185,84,0.3)] active:scale-95'
                   }`}
                 >
                    {generating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Instagram className="w-5 h-5" />}
                    {generating ? 'Processing Video Neural...' : `Forge ${selectedFormat.id}`}
                 </button>
              </div>
           </div>

           {/* Right: Asset Preview */}
           <div className="lg:col-span-7 flex items-start justify-center">
              <div 
                className="relative w-full max-h-[700px] bg-obsidian-light rounded-[40px] border-8 border-graphite shadow-2xl overflow-hidden flex flex-col items-center justify-center text-center p-6 transition-all duration-500 ease-out"
                style={{ aspectRatio: selectedFormat.ratio }}
              >
                 
                 {/* Simulated Content */}
                 {complete ? (
                    <div className="absolute inset-0 animate-in fade-in duration-1000">
                       <img 
                         src={aiImageUrl || customArtUrl || `https://picsum.photos/seed/${currentTrack?.id || 'test'}/1080/1920?blur=5`} 
                         className="w-full h-full object-cover opacity-60"
                         referrerPolicy="no-referrer"
                       />
                       <div className="absolute inset-0 bg-linear-to-b from-transparent via-black/20 to-black/80" />
                       
                       {aiMode && !customArtUrl && (
                         <div className="absolute top-4 right-4 z-20">
                            <div className="px-3 py-1 bg-primary/20 backdrop-blur-md border border-primary/40 rounded-full flex items-center gap-2">
                               <Sparkles className="w-3 h-3 text-primary animate-pulse" />
                               <span className="text-[8px] font-mono font-bold text-primary tracking-[0.2em] uppercase">Neural AI Generated</span>
                            </div>
                         </div>
                       )}

                       {customArtUrl && (
                         <div className="absolute top-4 right-4 z-20">
                            <div className="px-3 py-1 bg-white/20 backdrop-blur-md border border-white/20 rounded-full flex items-center gap-2">
                               <Layout className="w-3 h-3 text-white" />
                               <span className="text-[8px] font-mono font-bold text-white tracking-[0.2em] uppercase">Custom Backdrop URL</span>
                            </div>
                         </div>
                       )}
                       
                       {/* Template Overlays */}
                       {selectedTemplate === 'Spotify' && (
                         <div className="absolute top-6 left-6 flex items-center gap-2 z-10">
                            <div className="w-8 h-8 rounded-full bg-[#1DB954] flex items-center justify-center">
                               <Music className="w-4 h-4 text-black" />
                            </div>
                            <span className="font-sans font-bold text-white tracking-tight">Spotify</span>
                         </div>
                       )}

                       {selectedTemplate === 'Apple' && (
                         <div className="absolute top-6 left-6 flex items-center gap-2 z-10">
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                               <Music className="w-4 h-4 text-black" />
                            </div>
                            <span className="font-sans font-bold text-white tracking-tight text-sm">Music</span>
                         </div>
                       )}

                       {selectedTemplate === 'YouTube' && (
                         <div className="absolute bottom-6 right-6 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 z-10">
                            <div className="w-4 h-4 rounded-full bg-[#FF0000]" />
                            <span className="font-mono text-[9px] font-black text-white uppercase italic">Music</span>
                         </div>
                       )}
                       
                       <div className="absolute inset-0 flex flex-col items-center justify-center p-6 space-y-8">
                          {/* Spinning vinyl/disk effect */}
                          <div className={`rounded-full border-2 border-white/20 animate-[spin_10s_linear_infinite] flex items-center justify-center z-10 ${selectedFormat.id === 'Header' ? 'w-24 h-24' : 'w-48 h-48'}`}>
                             <div className={`rounded-full border border-primary/40 p-2 ${selectedFormat.id === 'Header' ? 'w-20 h-20' : 'w-40 h-40'}`}>
                                <div className="w-full h-full rounded-full bg-graphite flex items-center justify-center shadow-2xl relative overflow-hidden">
                                   <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                                      <Music className="w-6 h-6 text-primary" />
                                   </div>
                                </div>
                             </div>
                          </div>

                          <div className="space-y-6 z-10">
                             <div className="space-y-2">
                                <h2 className={`text-white font-mono font-black uppercase tracking-tighter drop-shadow-2xl ${selectedFormat.id === 'Header' ? 'text-xl' : 'text-3xl'}`}>
                                   {currentTrack?.name || 'NEW MASTER'}
                                </h2>
                                <p className={`text-primary font-mono font-black uppercase tracking-[0.2em] shadow-black ${selectedFormat.id === 'Header' ? 'text-[8px]' : 'text-sm'}`}>
                                   {currentTrack?.artist || 'MASTERCORE'}
                                </p>
                             </div>
                             
                             <div className="flex gap-1 justify-center h-4 items-end">
                                {Array.from({ length: 12 }).map((_, i) => (
                                  <motion.div 
                                    key={i}
                                    animate={{ height: [4, 16, 4] }}
                                    transition={{ repeat: Infinity, duration: 1, delay: i * 0.1 }}
                                    className="w-1 bg-primary shadow-[0_0_8px_#1db954]"
                                  />
                                ))}
                             </div>
                          </div>
                       </div>

                       <div className={`absolute bottom-6 flex flex-col items-center gap-4 z-10 ${selectedFormat.id === 'Header' ? 'scale-75' : ''}`}>
                          <div className="px-6 py-2 bg-primary text-on-primary rounded-full font-mono text-[10px] font-black uppercase tracking-widest shadow-xl">
                             AVAILABLE NOW
                          </div>
                          <div className="flex gap-4">
                             <Instagram className="w-6 h-6 text-white/60" />
                             <Share2 className="w-6 h-6 text-white/60" />
                          </div>
                       </div>
                    </div>
                 ) : (
                    <div className="space-y-8">
                       <div className="w-20 h-20 bg-obsidian border border-white/5 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                          {generating ? <RefreshCw className="w-8 h-8 text-primary animate-spin" /> : <Eye className="w-8 h-8 text-white/10" />}
                       </div>
                       <div className="space-y-2">
                          <h4 className="font-mono text-xs font-black text-white uppercase tracking-[0.3em]">
                             {generating ? 'RENDERING CLIP' : 'FORGE VISUAL'}
                          </h4>
                          <p className="text-[10px] font-mono text-white/20 uppercase tracking-[0.4em]">Ready for Generation</p>
                       </div>
                    </div>
                 )}

                 {/* Phone elements */}
                 <div className="absolute top-4 w-20 h-6 bg-graphite rounded-full" />
                 <div className="absolute bottom-4 w-12 h-1 bg-white/20 rounded-full" />
              </div>

              {complete && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8 flex flex-col sm:flex-row gap-4 w-full max-w-[320px]"
                >
                   <button className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-4 font-mono text-xs font-black text-white uppercase hover:bg-white/10 transition-all">
                      <Download className="w-5 h-5 text-primary" />
                      Save Asset
                   </button>
                   <button className="flex-1 py-4 bg-primary text-on-primary rounded-2xl flex items-center justify-center gap-4 font-mono text-xs font-black uppercase shadow-xl hover:brightness-110 transition-all">
                      Publish
                      <ArrowRight className="w-5 h-5" />
                   </button>
                </motion.div>
              )}
           </div>
        </div>

      </div>
    </div>
  );
}

function OptionSwitch({ label, active = false, onChange }: { label: string, active?: boolean, onChange?: (val: boolean) => void }) {
  const [isOn, setIsOn] = useState(active);
  const handleToggle = () => {
    const newState = !isOn;
    setIsOn(newState);
    if (onChange) onChange(newState);
  };

  return (
    <div className="flex items-center justify-between p-4 bg-obsidian border border-white/5 rounded-2xl">
       <span className="font-mono text-[10px] text-white/40 uppercase tracking-widest">{label}</span>
       <button 
         onClick={handleToggle}
         className={`w-10 h-5 rounded-full relative transition-colors ${isOn ? 'bg-primary' : 'bg-white/10'}`}
       >
          <motion.div 
            initial={false}
            animate={{ x: isOn ? 22 : 2 }}
            className="absolute top-1 w-3 h-3 rounded-full bg-white shadow-lg"
          />
       </button>
    </div>
  );
}
