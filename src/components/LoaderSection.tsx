import React, { useState, useCallback } from 'react';
import { Upload, Music, FileAudio, Check, AlertCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useMastering, Track } from '../context/MasteringContext';

export default function LoaderSection() {
  const { addTrack, setCurrentTrack, setActiveSection } = useMastering();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('audio/')) {
      setError('Unsupported file format. Please use WAV, MP3 or AIFF.');
      return;
    }

    setUploading(true);
    setError(null);

    // Simulate high-speed neural upload
    setTimeout(async () => {
      const trackData: Omit<Track, 'id' | 'userId'> = {
        name: file.name.replace(/\.[^/.]+$/, ""),
        artist: 'Unknown Artist',
        bpm: 120,
        key: 'C Maj',
        duration: 180,
        file: file,
        status: 'analyzed',
        metadata: {}
      };
      
      const newTrack = await addTrack(trackData);
      if (newTrack) {
        setCurrentTrack(newTrack);
        setActiveSection('MASTERING');
      }
      setUploading(false);
    }, 2000);
  }, [addTrack, setCurrentTrack, setActiveSection]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-8 bg-obsidian relative overflow-hidden">
      {/* Background Grids */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(#1db954_1px,transparent_1px)] [background-size:40px_40px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl w-full z-10"
      >
        <div className="text-center mb-12">
           <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="font-mono text-[10px] text-primary font-black uppercase tracking-[0.2em]">High-Fidelity Input</span>
           </div>
           <h1 className="text-5xl font-mono font-black italic text-white uppercase tracking-tighter leading-none">
             Load <span className="text-primary italic">Sonic</span> Core
           </h1>
           <p className="text-white/40 font-sans text-sm mt-4 tracking-wide max-w-sm mx-auto">
             Upload your high-resolution audio files for terminal AI analysis and premium mastering.
           </p>
        </div>

        <div 
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`relative group h-80 rounded-3xl border-2 border-dashed transition-all duration-500 flex flex-col items-center justify-center cursor-pointer overflow-hidden ${
            isDragging 
              ? 'border-primary bg-primary/5 shadow-[0_0_50px_rgba(29,185,84,0.15)]' 
              : 'border-white/10 bg-obsidian-light hover:border-white/20'
          }`}
        >
           <input 
             type="file" 
             className="absolute inset-0 opacity-0 cursor-pointer z-50" 
             onChange={onFileChange}
             accept="audio/*"
           />

           <div className="relative z-10 flex flex-col items-center gap-6">
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                uploading ? 'bg-primary shadow-[0_0_30px_#1db954] animate-pulse' : 'bg-graphite border border-white/5'
              }`}>
                 {uploading ? (
                    <div className="relative">
                      <div className="absolute inset-0 border-2 border-white rounded-full animate-spin border-t-transparent" />
                      <Upload className="w-8 h-8 text-on-primary" />
                    </div>
                 ) : (
                    <Upload className="w-8 h-8 text-white/40 group-hover:text-primary transition-colors" />
                 )}
              </div>

              <div className="text-center">
                 <p className="font-mono text-[11px] font-black uppercase tracking-[0.3em] text-white">
                   {uploading ? 'Neural Extracting...' : 'Drop Track or Click to Browse'}
                 </p>
                 <p className="text-[9px] font-mono text-white/20 uppercase mt-2 tracking-widest">
                   WAV, AIFF, FLAC, MP3 (Max 500MB)
                 </p>
              </div>
           </div>

           {/* Pulse rings */}
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
              <div className="w-64 h-64 border border-primary/20 rounded-full animate-ping" />
           </div>

           <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute bottom-6 left-0 right-0 px-6"
                >
                   <div className="bg-scarlet/10 border border-scarlet/20 rounded-xl p-3 flex items-center gap-3">
                      <AlertCircle className="w-4 h-4 text-scarlet" />
                      <span className="text-[10px] font-mono text-scarlet font-bold uppercase">{error}</span>
                   </div>
                </motion.div>
              )}
           </AnimatePresence>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-6">
           <FeatureCard 
             icon={FileAudio} 
             title="Lossless Sync" 
             desc="Native 32-bit float architecture for zero-loss imports." 
           />
           <FeatureCard 
             icon={Music} 
             title="Auto Metadata" 
             desc="Deep learning scans for genre, tempo, and key instantly." 
           />
        </div>
      </motion.div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) {
  return (
    <div className="p-5 rounded-2xl bg-obsidian-light border border-white/5 hover:border-white/10 transition-all group">
       <div className="w-10 h-10 rounded-lg bg-black/40 flex items-center justify-center mb-4 border border-white/5 group-hover:bg-primary/5 transition-colors">
          <Icon className="w-5 h-5 text-white/20 group-hover:text-primary transition-colors" />
       </div>
       <h3 className="font-mono text-[10px] font-black uppercase text-white tracking-widest mb-2">{title}</h3>
       <p className="text-[10px] text-white/30 leading-relaxed font-sans">{desc}</p>
    </div>
  );
}
