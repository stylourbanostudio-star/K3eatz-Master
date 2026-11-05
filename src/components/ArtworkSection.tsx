import React, { useState, useRef } from 'react';
import { 
  Palette, 
  Sparkles, 
  Type as TypeIcon, 
  Layers, 
  Download, 
  Eye, 
  Maximize2,
  RefreshCw,
  Image as ImageIcon,
  Check,
  Upload,
  ExternalLink,
  Disc,
  Radio,
  Box,
  History,
  Sliders
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useMastering } from '../context/MasteringContext';
import { TextureType, applyTextureToCanvas } from '../utils/artworkTextures';
import { compressArtworkForStorage } from '../utils/imageCompression';
import ArtworkTextureOverlay from './ArtworkTextureOverlay';

export default function ArtworkSection() {
  const { currentTrack, updateTrackTags, language } = useMastering();
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [currentSpec, setCurrentSpec] = useState<any>(null);
  const [selectedOverlay, setSelectedOverlay] = useState('Minimal');
  const [selectedFormat, setSelectedFormat] = useState<'CD' | 'Stories' | 'Youtube'>('CD');
  const [selectedTexture, setSelectedTexture] = useState<TextureType>('vinyl');
  const [textureIntensity, setTextureIntensity] = useState<number>(70);
  const [exportResolution, setExportResolution] = useState<'3000' | '2048' | '1024'>('3000');
  const [applied, setApplied] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Localization
  const tLang = {
    pt: {
      title: "Síntese",
      titleAccent: "Visual",
      desc: "Motor de arte generativa IA para capas de lançamentos profissionais.",
      presetPrompt: "Prompt Estético",
      promptPlaceholder: "Descreva a atmosfera... (ex: Chuva cyberpunk, ondas espectrais abstratas, minimalismo industrial)",
      buttonGenerate: "Gerar Arte com IA",
      buttonGenerating: "Sintetizando...",
      visualizing: "Visualizando Conceito...",
      readyInput: "Pronto para criação visual",
      typoTitle: "Estilos de Tipografia",
      formatLabel: "Formato da Capa",
      formatCD: "Formato CD (Streaming)",
      formatStories: "Formato Stories (Sociais)",
      formatYoutube: "Formato YouTube (Banner/Vídeo)",
      download: "Exportar Arte Master",
      resLabel: "Resolução de Saída",
      res3000: "3000 x 3000 px (Ultra-HD / Apple & Spotify Master)",
      res2048: "2048 x 2048 px (2K QHD)",
      res1024: "1024 x 1024 px (Padrão Web)",
      textureTitle: "Texturas Analógicas & Acabamento",
      textureNone: "Digital Limpo",
      textureVinyl: "Vinil Audiófilo (Ranhuras & Brilho 180g)",
      textureTape: "Fita Master Analógica (Tape Saturation)",
      textureShrink: "Plástico Shrink-Wrap (Celofane)",
      textureVintage: "Desgaste Vintage (Capa / Ring Wear)",
      intensityLabel: "Intensidade da Textura",
      upscaling: "Ultra-HD 3000px Ativo",
      applyToTrack: "Aplicar à Faixa",
      appliedSuccessfully: "Aplicado!",
      testMode: "Métodos Alternativos de Teste (Sem Chave API / Offline)",
      buttonProcedural: "Arte Procedural",
      buttonUpload: "Carregar Capa Local",
      openNewTab: "Abrir em Nova Aba"
    },
    en: {
      title: "Visual",
      titleAccent: "Synthesis",
      desc: "Generative AI art engine for professional-grade release covers.",
      presetPrompt: "Aesthetic Prompt",
      promptPlaceholder: "Describe the vibe... (e.g., Cyberpunk rain, abstract spectral waves, industrial minimalism)",
      buttonGenerate: "Generate Artwork with AI",
      buttonGenerating: "Synthesizing...",
      visualizing: "Visualizing Concept...",
      readyInput: "Ready for creative input",
      typoTitle: "Typography Overlays",
      formatLabel: "Artwork Format",
      formatCD: "CD Format (Streaming)",
      formatStories: "Stories Format (Socials)",
      formatYoutube: "YouTube Format (Video/Banner)",
      download: "Export Master Artwork",
      resLabel: "Output Resolution",
      res3000: "3000 x 3000 px (Ultra-HD / Apple & Spotify Master)",
      res2048: "2048 x 2048 px (2K QHD)",
      res1024: "1024 x 1024 px (Web Standard)",
      textureTitle: "Analog Textures & Packaging",
      textureNone: "Clean Digital",
      textureVinyl: "Audiophile Vinyl (180g Grooves & Sheen)",
      textureTape: "Analog Master Tape (Tape Saturation)",
      textureShrink: "Shrink-Wrap Plastic (Cellophane)",
      textureVintage: "Vintage Wear (Ring Wear / Cardboard)",
      intensityLabel: "Texture Intensity",
      upscaling: "Ultra-HD 3000px Active",
      applyToTrack: "Apply to Track",
      appliedSuccessfully: "Applied!",
      testMode: "Alternative Test Methods (No API Key Required)",
      buttonProcedural: "Procedural Art",
      buttonUpload: "Upload Local Art",
      openNewTab: "Open in New Tab"
    }
  };

  const m = tLang[language as keyof typeof tLang] || tLang.en;

  const generateArtwork = async () => {
    if (!prompt) return;
    setGenerating(true);
    setApplied(false);

    const aspectMap = {
      CD: "1:1",
      Stories: "9:16",
      Youtube: "16:9"
    };

    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: `High quality album cover art: ${prompt}. Futuristic, cinematic, high contrast, professional digital art, no text.`,
          aspectRatio: aspectMap[selectedFormat]
        })
      });

      const data = await response.json();
      if (data.success && data.image) {
        if (data.spec) {
          setCurrentSpec(data.spec);
        }
        setGeneratedImage(data.image);
      } else {
        throw new Error(data.error || "Failed secure generation");
      }
    } catch (err) {
      console.warn("Image generation notice - using robust visual fallback:", err);
      const fallbackUrl = drawProceduralArtwork();
      if (fallbackUrl) {
        setGeneratedImage(fallbackUrl);
      }
    } finally {
      setGenerating(false);
    }
  };

  const drawProceduralArtwork = (customSpec?: any): string => {
    try {
      const specToUse = customSpec || currentSpec;
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 1000;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';

      // Extract spec values or fallbacks
      const primaryColor = specToUse?.primaryColor || '#00f5ff';
      const secondaryColor = specToUse?.secondaryColor || '#ff007f';
      const glowColor = specToUse?.glowColor || '#9d4edd';
      const shapeType = specToUse?.shapeType || 'sound-wave';
      const waveFrequency = specToUse?.waveFrequency || 6;
      const starsCount = specToUse?.starsCount || 80;

      // Draw elegant deep obsidian space background
      const grad = ctx.createLinearGradient(0, 0, 1000, 1000);
      grad.addColorStop(0, '#04020a');
      grad.addColorStop(0.5, '#0c0717');
      grad.addColorStop(1, '#020105');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1000, 1000);

      // Draw ambient particles / stars
      const seedValue = prompt ? prompt.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : Math.floor(Math.random() * 1000);
      
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < starsCount; i++) {
        const px = Math.abs(Math.sin(seedValue + i * 47) * 1000);
        const py = Math.abs(Math.cos(seedValue + i * 31) * 1000);
        const psize = Math.abs(Math.sin(seedValue + i) * 2.5) + 0.5;
        ctx.fillStyle = i % 3 === 0 ? `${primaryColor}aa` : (i % 3 === 1 ? `${secondaryColor}aa` : '#ffffffcc');
        ctx.beginPath();
        ctx.arc(px, py, psize, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw background grid lines
      ctx.strokeStyle = `${primaryColor}0d`;
      ctx.lineWidth = 1;
      for (let i = 0; i <= 1000; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0); ctx.lineTo(i, 1000);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i); ctx.lineTo(1000, i);
        ctx.stroke();
      }

      // Central visualizer sphere glowing backdrop
      const radialGrad = ctx.createRadialGradient(500, 500, 50, 500, 500, 480);
      radialGrad.addColorStop(0, `${primaryColor}2a`);
      radialGrad.addColorStop(0.4, `${secondaryColor}10`);
      radialGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = radialGrad;
      ctx.fillRect(0, 0, 1000, 1000);

      // Render shapes depending on the Gemini specification shapeType
      if (shapeType === 'cyber-grid' || shapeType === 'retro-synth-sun') {
        // Perspective grid
        ctx.strokeStyle = `${primaryColor}44`;
        ctx.lineWidth = 1.5;
        const horizonY = 550;
        for (let y = horizonY; y <= 1000; y += 35) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(1000, y);
          ctx.stroke();
        }
        for (let x = -300; x <= 1300; x += 80) {
          ctx.beginPath();
          ctx.moveTo(500, horizonY);
          ctx.lineTo(x, 1000);
          ctx.stroke();
        }
        // Glowing vector neon circle
        ctx.strokeStyle = secondaryColor;
        ctx.lineWidth = 4;
        ctx.shadowColor = secondaryColor;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(500, 320, 110, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } 
      else if (shapeType === 'stellar-burst') {
        // Sun rays / radiating spikes
        ctx.strokeStyle = `${primaryColor}88`;
        ctx.lineWidth = 2;
        ctx.shadowColor = primaryColor;
        ctx.shadowBlur = 10;
        const rays = 64;
        for (let r = 0; r < rays; r++) {
          const angle = (r * Math.PI * 2) / rays;
          const amp = Math.abs(Math.sin(angle * 8 + seedValue)) * 80 + 120;
          ctx.beginPath();
          ctx.moveTo(500, 500);
          ctx.lineTo(500 + Math.cos(angle) * amp, 500 + Math.sin(angle) * amp);
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
      }
      else if (shapeType === 'vortex-orbit') {
        // Orbiting rings
        const orbits = [120, 200, 300, 380];
        orbits.forEach((or, idx) => {
          ctx.strokeStyle = idx % 2 === 0 ? primaryColor : secondaryColor;
          ctx.lineWidth = 2.5;
          ctx.shadowColor = (idx % 2 === 0 ? primaryColor : secondaryColor) as string;
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.ellipse(500, 500, or, or * 0.6, (seedValue / 100) + idx * (Math.PI / 4), 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Small glowing satellite node
          const satAngle = (seedValue / 50) + idx * 2.1;
          const sx = 500 + Math.cos(satAngle) * or;
          const sy = 500 + Math.sin(satAngle) * (or * 0.6);
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.arc(sx, sy, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        });
      }
      else if (shapeType === 'neon-tunnel') {
        // Converging square rings
        const rings = 6;
        for (let s = 1; s <= rings; s++) {
          const size = s * 130;
          ctx.strokeStyle = s % 2 === 0 ? primaryColor : glowColor;
          ctx.lineWidth = 3;
          ctx.shadowColor = (s % 2 === 0 ? primaryColor : glowColor) as string;
          ctx.shadowBlur = 15;
          ctx.strokeRect(500 - size / 2, 500 - size / 2, size, size);
          ctx.shadowBlur = 0;

          // Perspective diagonals
          ctx.strokeStyle = `${secondaryColor}22`;
          ctx.beginPath();
          ctx.moveTo(500, 500);
          ctx.lineTo(500 - size / 2, 500 - size / 2);
          ctx.stroke();
        }
      }
      else if (shapeType === 'abstract-minimal') {
        // Lush, soft layered light blobs
        for (let b = 0; b < 6; b++) {
          const bx = 300 + Math.abs(Math.sin(seedValue + b * 13)) * 400;
          const by = 300 + Math.abs(Math.cos(seedValue + b * 29)) * 400;
          const radius = 180 + b * 40;
          const blobGrad = ctx.createRadialGradient(bx, by, 5, bx, by, radius);
          blobGrad.addColorStop(0, b % 2 === 0 ? `${primaryColor}40` : `${secondaryColor}40`);
          blobGrad.addColorStop(0.5, `${glowColor}15`);
          blobGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = blobGrad;
          ctx.beginPath();
          ctx.arc(bx, by, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      else {
        // Default: Classic futuristic sound-wave orbits
        ctx.strokeStyle = `${primaryColor}aa`;
        ctx.lineWidth = 3.5;
        ctx.shadowColor = primaryColor;
        ctx.shadowBlur = 15;

        ctx.beginPath();
        for (let angle = 0; angle < Math.PI * 2; angle += 0.04) {
          const sinValue = Math.sin(angle * (waveFrequency + (seedValue % 5)) + seedValue);
          const cosValue = Math.cos(angle * 2.5);
          const baseRadius = 260 + sinValue * 45 + cosValue * 12;
          const x = 500 + Math.cos(angle) * baseRadius;
          const y = 500 + Math.sin(angle) * baseRadius;
          if (angle === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Concentric ambient rings
      ctx.strokeStyle = `${primaryColor}1f`;
      ctx.lineWidth = 2;
      for (let r = 160; r <= 360; r += 50) {
        ctx.beginPath();
        ctx.arc(500, 500, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Intersecting white high-fidelity line wave
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      for (let x = 100; x <= 900; x += 2) {
        const t = (x - 100) / 800;
        const wave = Math.sin(t * Math.PI * (waveFrequency + 2) + seedValue) * Math.cos(t * Math.PI * 2);
        const envelope = Math.sin(t * Math.PI);
        const y = 500 + wave * 160 * envelope;
        if (x === 100) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Reset shadow
      ctx.shadowBlur = 0;

      // Apply high-end metadata spec tags
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`SYSTEM_ART_SYNTH // SEED_${seedValue}`, 100, 100);
      ctx.fillText(`ENGINE_MOD: ${shapeType.toUpperCase()}_v1.4`, 100, 120);
      ctx.textAlign = 'right';
      ctx.fillText(`FORMAT: ${selectedFormat.toUpperCase()}`, 900, 100);

      return canvas.toDataURL('image/png');
    } catch (e) {
      console.error("Procedural art failed:", e);
      return '';
    }
  };

  const generateProcedural = (customSpec?: any) => {
    setGenerating(true);
    setApplied(false);
    try {
      const dataUrl = drawProceduralArtwork(customSpec);
      if (dataUrl) {
        setGeneratedImage(dataUrl);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result && typeof event.target.result === 'string') {
        setGeneratedImage(event.target.result);
        setApplied(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const downloadArtwork = () => {
    if (!generatedImage) return;

    // Use Canvas drawing to burn the selected typography and analog textures onto the image file directly
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = generatedImage;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = 3000;
        let height = 3000;

        if (exportResolution === '3000') {
          if (selectedFormat === 'Youtube') {
            width = 3840; height = 2160;
          } else if (selectedFormat === 'Stories') {
            width = 2160; height = 3840;
          } else {
            width = 3000; height = 3000;
          }
        } else if (exportResolution === '2048') {
          if (selectedFormat === 'Youtube') {
            width = 2560; height = 1440;
          } else if (selectedFormat === 'Stories') {
            width = 1440; height = 2560;
          } else {
            width = 2048; height = 2048;
          }
        } else {
          if (selectedFormat === 'Youtube') {
            width = 1280; height = 720;
          } else if (selectedFormat === 'Stories') {
            width = 1080; height = 1920;
          } else {
            width = 1024; height = 1024;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // High quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Direct draw base artwork
        ctx.drawImage(img, 0, 0, width, height);

        // Scale factor relative to base 1024
        const scale = width / 1024;
        const trackName = currentTrack?.name || 'NEW_RELEASE';
        const artistName = currentTrack?.artist || 'MASTERCORE_ENGINE';

        if (selectedOverlay === 'Minimal') {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
          ctx.fillRect(40 * scale, height - 180 * scale, width - 80 * scale, 130 * scale);
          
          ctx.fillStyle = '#FFFFFF';
          ctx.font = `900 ${Math.round(32 * scale)}px monospace`;
          ctx.fillText(trackName.toUpperCase(), 70 * scale, height - 120 * scale);
          
          ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
          ctx.font = `600 ${Math.round(18 * scale)}px monospace`;
          ctx.fillText(artistName.toUpperCase(), 70 * scale, height - 85 * scale);
        } else if (selectedOverlay === 'Brutalist') {
          ctx.lineWidth = Math.max(4, Math.round(12 * scale));
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.strokeRect(30 * scale, 30 * scale, width - 60 * scale, height - 60 * scale);

          ctx.fillStyle = '#FFFFFF';
          ctx.font = `900 ${Math.round(56 * scale)}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(trackName.toUpperCase(), width / 2, height / 2);
        } else if (selectedOverlay === 'Neon') {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
          ctx.fillRect(50 * scale, height - 190 * scale, width - 100 * scale, 130 * scale);

          ctx.strokeStyle = '#1db954';
          ctx.lineWidth = Math.max(2, Math.round(3 * scale));
          ctx.strokeRect(50 * scale, height - 190 * scale, width - 100 * scale, 130 * scale);

          ctx.fillStyle = '#1db954';
          ctx.font = `900 ${Math.round(36 * scale)}px monospace`;
          ctx.fillText(trackName.toUpperCase(), 80 * scale, height - 120 * scale);

          ctx.fillStyle = '#1db954';
          ctx.fillRect(80 * scale, height - 90 * scale, 70 * scale, 3 * scale);
        } else if (selectedOverlay === 'Classic') {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = Math.max(1, Math.round(2 * scale));
          ctx.strokeRect(60 * scale, 60 * scale, width - 120 * scale, height - 120 * scale);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
          ctx.font = `italic ${Math.round(16 * scale)}px Georgia, serif`;
          ctx.fillText(`${selectedFormat.toUpperCase()} RELEASE`, 100 * scale, 100 * scale);

          ctx.fillStyle = '#FFFFFF';
          ctx.font = `italic ${Math.round(44 * scale)}px Georgia, serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(trackName, width / 2, height / 2);

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.beginPath();
          ctx.moveTo(width / 2 - 60 * scale, height / 2 + 35 * scale);
          ctx.lineTo(width / 2 + 60 * scale, height / 2 + 35 * scale);
          ctx.stroke();

          ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.font = `${Math.round(15 * scale)}px monospace`;
          ctx.fillText(artistName.toUpperCase(), width / 2, height / 2 + 75 * scale);
        }

        // Burn analog texture (vinyl, tape, shrinkwrap, vintage) onto exported canvas
        applyTextureToCanvas(ctx, width, height, selectedTexture, textureIntensity);

        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          const texSuffix = selectedTexture !== 'none' ? `_${selectedTexture}` : '';
          link.download = `${currentTrack?.name || 'artwork'}_${selectedFormat.toLowerCase()}_${width}x${height}${texSuffix}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 'image/png');
      } catch (err) {
        console.warn("Direct canvas render blocked by CORS, falling back safely:", err);
        const link = document.createElement('a');
        link.href = generatedImage;
        link.download = `${currentTrack?.name || 'artwork'}_${selectedFormat.toLowerCase()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    };
    img.onerror = () => {
      // Direct raw link trigger
      const link = document.createElement('a');
      link.href = generatedImage;
      link.download = `${currentTrack?.name || 'artwork'}_${selectedFormat.toLowerCase()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
  };

  const applyArtworkToTrack = async () => {
    if (!currentTrack || !generatedImage || applying) return;
    setApplying(true);
    setApplyError(null);
    try {
      // Compress and optimize cover image into high-quality, lightweight album art (~30KB)
      // guaranteeing it never approaches Firestore's 1MB document quota
      const optimizedCover = await compressArtworkForStorage(generatedImage, 400, 0.82);
      await updateTrackTags(currentTrack.id, {
        metadata: {
          ...currentTrack.metadata,
          coverUrl: optimizedCover
        }
      });
      setApplied(true);
      setTimeout(() => setApplied(false), 2500);
    } catch (e: any) {
      console.error("Failed to apply artwork to track tags:", e);
      setApplyError(e?.message || 'Could not attach cover to track');
      setTimeout(() => setApplyError(null), 4000);
    } finally {
      setApplying(false);
    }
  };

  const getAspectClass = () => {
    switch (selectedFormat) {
      case 'Stories':
        return 'aspect-[9/16] h-[360px] md:h-[450px] mx-auto';
      case 'Youtube':
        return 'aspect-[16/9] w-full max-w-xl mx-auto';
      case 'CD':
      default:
        return 'aspect-square w-full max-w-md mx-auto';
    }
  };

  return (
    <div className="h-full w-full flex flex-col p-8 bg-obsidian overflow-y-auto custom-scrollbar">
      <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        {/* Left: Creative Controls */}
        <div className="lg:col-span-5 space-y-8">
           <div className="space-y-4">
              <div className="flex items-center gap-3">
                 <div className="p-2 rounded-lg bg-primary/20 border border-primary/30">
                    <Palette className="w-6 h-6 text-primary neon-glow-emerald" />
                 </div>
                 <h1 className="text-4xl font-mono font-black italic text-white uppercase tracking-tighter">
                   {m.title} <span className="text-primary italic">{m.titleAccent}</span>
                 </h1>
              </div>
              <p className="text-white/40 font-sans text-sm">
                 {m.desc}
              </p>
           </div>

           {/* Input, Format Selector & Generator */}
           <div className="hardware-panel p-6 rounded-3xl space-y-6 animate-fade-in">
              <div className="space-y-3">
                 <label className="engraved-label text-white/40 uppercase">{m.presetPrompt}</label>
                 <textarea 
                   value={prompt}
                   onChange={(e) => setPrompt(e.target.value)}
                   placeholder={m.promptPlaceholder}
                   className="w-full h-28 bg-obsidian border border-white/5 rounded-2xl p-4 font-mono text-xs text-white placeholder:text-white/10 focus:border-primary/40 focus:outline-hidden transition-all resize-none"
                 />
              </div>

              {/* Cover Aspect Ratio Selection */}
              <div className="space-y-3">
                 <label className="engraved-label text-white/30 uppercase">{m.formatLabel}</label>
                 <div className="grid grid-cols-1 gap-2.5">
                    {[
                      { id: 'CD', label: m.formatCD, icon: ImageIcon },
                      { id: 'Stories', label: m.formatStories, icon: Layers },
                      { id: 'Youtube', label: m.formatYoutube, icon: Maximize2 }
                    ].map(item => (
                       <button 
                         key={item.id}
                         onClick={() => setSelectedFormat(item.id as any)}
                         className={`p-3.5 rounded-xl border flex items-center gap-4 transition-all text-left ${
                           selectedFormat === item.id 
                             ? 'bg-primary/5 border-primary text-primary shadow-[0_0_15px_rgba(29,185,84,0.15)]' 
                             : 'bg-obsidian-light border-white/5 text-white/40 hover:border-white/15'
                         }`}
                       >
                          <item.icon className="w-4 h-4 shrink-0" />
                          <div className="flex-1 min-w-0">
                             <p className="font-mono text-[10px] font-black uppercase tracking-wider">{item.id}</p>
                             <p className="text-[9px] text-white/30 truncate mt-0.5">{item.label}</p>
                          </div>
                          {selectedFormat === item.id && (
                             <div className="w-1.5 h-1.5 rounded-full bg-primary neon-glow-emerald" />
                          )}
                       </button>
                    ))}
                 </div>
              </div>

              {/* Generate Triggers */}
              <div className="space-y-4">
                 <button 
                   onClick={generateArtwork}
                   disabled={generating || !prompt}
                   className={`w-full py-4 rounded-xl font-mono text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${
                     generating || !prompt
                       ? 'bg-white/5 text-white/20 cursor-not-allowed' 
                       : 'bg-primary text-on-primary hover:brightness-110 shadow-[0_0_30px_rgba(29,185,84,0.3)] active:scale-95'
                   }`}
                 >
                    {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {generating ? m.buttonGenerating : m.buttonGenerate}
                 </button>

                 {currentSpec && (
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-3 font-mono text-[10px]">
                       <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <span className="text-primary font-black uppercase tracking-widest flex items-center gap-1.5 font-mono">
                             <Sparkles className="w-3 h-3 text-primary animate-pulse" />
                             Gemini Visual Spec
                          </span>
                          <span className="text-white/30 text-[8px] uppercase font-mono">Parallel Engine Synced</span>
                       </div>
                       <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-white/50navy">
                          <div className="space-y-0.5 text-left font-mono">
                             <span className="text-white/20 uppercase block text-[8px]">Primary Vibe</span>
                             <span className="text-white/80 font-bold block truncate uppercase">{currentSpec.shapeType}</span>
                          </div>
                          <div className="space-y-0.5 text-left font-mono">
                             <span className="text-white/20 uppercase block text-[8px]">Color Spectrum</span>
                             <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="w-2.5 h-2.5 rounded-full block border border-white/10" style={{ backgroundColor: currentSpec.primaryColor }} />
                                <span className="text-[9px] font-bold text-white/80 uppercase">{currentSpec.primaryColor}</span>
                             </div>
                          </div>
                          <div className="col-span-2 space-y-0.5 text-left font-mono">
                             <span className="text-white/20 uppercase block text-[8px]">Fallback Unsplash Tags</span>
                             <span className="text-white/40 block truncate text-[9px] italic">"{currentSpec.unsplashTags}"</span>
                          </div>
                        </div>
                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5 mt-1 text-[9px] text-primary leading-snug text-left font-mono">
                           💡 Click <strong>Procedural Art</strong> to render this AI-designed geometry instantly, or see the Unsplash parallel artwork.
                        </div>
                    </div>
                 )}

                 {/* No-key Offline Fallbacks / Uploads */}
                 <div className="border-t border-white/5 pt-4 space-y-3">
                    <span className="font-mono text-[8px] uppercase tracking-widest text-white/30 block mb-1">
                      {m.testMode}
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                       <button
                         onClick={generateProcedural}
                         disabled={generating}
                         className="p-3.5 rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-primary/40 font-mono text-[9px] uppercase tracking-widest font-black flex items-center justify-center gap-2 transition-all active:scale-95"
                       >
                         <Palette className="w-3.5 h-3.5 text-primary" />
                         <span>{m.buttonProcedural}</span>
                       </button>

                       <button
                         onClick={handleUploadClick}
                         disabled={generating}
                         className="p-3.5 rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-primary/40 font-mono text-[9px] uppercase tracking-widest font-black flex items-center justify-center gap-2 transition-all active:scale-95"
                       >
                         <Upload className="w-3.5 h-3.5 text-primary" />
                         <span>{m.buttonUpload}</span>
                       </button>
                    </div>
                    <input 
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                 </div>
              </div>
           </div>

           {/* Font Overlays */}
           <div className="space-y-6 animate-fade-in">
              <h3 className="engraved-label text-white/20 italic">{m.typoTitle}</h3>
              <div className="grid grid-cols-2 gap-4">
                 {['Minimal', 'Brutalist', 'Classic', 'Neon'].map(style => (
                    <button 
                      key={style}
                      onClick={() => setSelectedOverlay(style)}
                      className={`p-4 rounded-xl border flex items-center gap-3 transition-all cursor-pointer ${
                        selectedOverlay === style 
                          ? 'bg-white/10 border-primary text-primary' 
                          : 'bg-obsidian-light border-white/5 text-white/30 hover:border-white/15'
                      }`}
                    >
                       <TypeIcon className="w-4 h-4" />
                       <span className="font-mono text-[10px] font-bold uppercase tracking-widest">{style}</span>
                    </button>
                 ))}
              </div>
           </div>

           {/* Analog Textures & Packaging */}
           <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                 <h3 className="engraved-label text-white/20 italic">{m.textureTitle}</h3>
                 <span className="font-mono text-[9px] text-primary uppercase font-bold tracking-widest">
                    {selectedTexture.toUpperCase()}
                 </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                 <button
                   onClick={() => setSelectedTexture('none')}
                   className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center cursor-pointer ${
                     selectedTexture === 'none'
                       ? 'bg-white/10 border-primary text-primary shadow-[0_0_10px_rgba(29,185,84,0.15)]'
                       : 'bg-obsidian-light border-white/5 text-white/40 hover:border-white/15'
                   }`}
                 >
                    <ImageIcon className="w-4 h-4" />
                    <span className="font-mono text-[9px] font-bold tracking-wide">{m.textureNone}</span>
                 </button>

                 <button
                   onClick={() => setSelectedTexture('vinyl')}
                   className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center cursor-pointer ${
                     selectedTexture === 'vinyl'
                       ? 'bg-white/10 border-[#d4af37] text-[#d4af37] shadow-[0_0_12px_rgba(212,175,55,0.2)]'
                       : 'bg-obsidian-light border-white/5 text-white/40 hover:border-white/15'
                   }`}
                 >
                    <Disc className="w-4 h-4" />
                    <span className="font-mono text-[9px] font-bold tracking-wide">Vinil 180g</span>
                 </button>

                 <button
                   onClick={() => setSelectedTexture('tape')}
                   className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center cursor-pointer ${
                     selectedTexture === 'tape'
                       ? 'bg-white/10 border-amber-500 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                       : 'bg-obsidian-light border-white/5 text-white/40 hover:border-white/15'
                   }`}
                 >
                    <Radio className="w-4 h-4" />
                    <span className="font-mono text-[9px] font-bold tracking-wide">Fita Master</span>
                 </button>

                 <button
                   onClick={() => setSelectedTexture('shrinkwrap')}
                   className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center cursor-pointer ${
                     selectedTexture === 'shrinkwrap'
                       ? 'bg-white/10 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.2)]'
                       : 'bg-obsidian-light border-white/5 text-white/40 hover:border-white/15'
                   }`}
                 >
                    <Box className="w-4 h-4" />
                    <span className="font-mono text-[9px] font-bold tracking-wide">Shrink Wrap</span>
                 </button>

                 <button
                   onClick={() => setSelectedTexture('vintage')}
                   className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center cursor-pointer col-span-2 sm:col-span-1 ${
                     selectedTexture === 'vintage'
                       ? 'bg-white/10 border-orange-300 text-orange-300 shadow-[0_0_12px_rgba(253,186,116,0.2)]'
                       : 'bg-obsidian-light border-white/5 text-white/40 hover:border-white/15'
                   }`}
                 >
                    <History className="w-4 h-4" />
                    <span className="font-mono text-[9px] font-bold tracking-wide">Ring Wear</span>
                 </button>
              </div>

              {/* Texture Intensity Slider */}
              {selectedTexture !== 'none' && (
                <div className="bg-obsidian-light p-3.5 rounded-xl border border-white/5 space-y-2">
                   <div className="flex items-center justify-between font-mono text-[9px]">
                      <div className="flex items-center gap-2 text-white/50">
                         <Sliders className="w-3.5 h-3.5 text-primary" />
                         <span>{m.intensityLabel}</span>
                      </div>
                      <span className="font-bold text-primary">{textureIntensity}%</span>
                   </div>
                   <input
                     type="range"
                     min="10"
                     max="100"
                     step="5"
                     value={textureIntensity}
                     onChange={(e) => setTextureIntensity(Number(e.target.value))}
                     className="w-full accent-primary h-1.5 bg-white/10 rounded-lg cursor-pointer"
                   />
                </div>
              )}
           </div>

           {/* Output Resolution Selector (3000x3000px Ultra HD) */}
           <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                 <h3 className="engraved-label text-white/20 italic">{m.resLabel}</h3>
                 <span className="font-mono text-[8px] px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 font-bold uppercase tracking-widest">
                    {exportResolution === '3000' ? '3000x3000 Master' : exportResolution === '2048' ? '2K Res' : '1024 Web'}
                 </span>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                 <button
                   onClick={() => setExportResolution('3000')}
                   className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all text-center cursor-pointer ${
                     exportResolution === '3000'
                       ? 'bg-primary/10 border-primary text-primary shadow-[0_0_12px_rgba(29,185,84,0.15)]'
                       : 'bg-obsidian-light border-white/5 text-white/40 hover:border-white/15'
                   }`}
                 >
                    <span className="font-mono text-[10px] font-black">3000px</span>
                    <span className="font-mono text-[7px] uppercase tracking-wider text-primary/80 font-bold">Ultra-HD Master</span>
                 </button>

                 <button
                   onClick={() => setExportResolution('2048')}
                   className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all text-center cursor-pointer ${
                     exportResolution === '2048'
                       ? 'bg-white/10 border-primary text-primary'
                       : 'bg-obsidian-light border-white/5 text-white/40 hover:border-white/15'
                   }`}
                 >
                    <span className="font-mono text-[10px] font-black">2048px</span>
                    <span className="font-mono text-[7px] uppercase tracking-wider text-white/30">2K QHD</span>
                 </button>

                 <button
                   onClick={() => setExportResolution('1024')}
                   className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all text-center cursor-pointer ${
                     exportResolution === '1024'
                       ? 'bg-white/10 border-primary text-primary'
                       : 'bg-obsidian-light border-white/5 text-white/40 hover:border-white/15'
                   }`}
                 >
                    <span className="font-mono text-[10px] font-black">1024px</span>
                    <span className="font-mono text-[7px] uppercase tracking-wider text-white/30">Web 1K</span>
                 </button>
              </div>
           </div>
        </div>

        {/* Right: Preview Canvas */}
        <div className="lg:col-span-7 space-y-8 flex flex-col justify-center">
           <div className="piano-black p-4 rounded-[40px] border border-white/10 shadow-2xl relative">
              <div className={`${getAspectClass()} bg-gray-900 rounded-[32px] overflow-hidden relative group transition-all duration-300`}>
                 {generatedImage ? (
                   <>
                     <img 
                       src={generatedImage} 
                       alt="Generated Cover" 
                       className="w-full h-full object-cover"
                       referrerPolicy="no-referrer"
                       onError={() => {
                         console.warn("Direct image render failed, fallback to procedural synthesis");
                         const fallback = drawProceduralArtwork();
                         if (fallback) setGeneratedImage(fallback);
                       }}
                     />

                     {/* Interactive Analog Texture Overlay Preview */}
                     <ArtworkTextureOverlay
                       texture={selectedTexture}
                       intensity={textureIntensity}
                     />
                     
                     {/* Dynamic Text Overlay Preview */}
                     <AnimatePresence>
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="absolute inset-0 flex flex-col p-8 md:p-12 pointer-events-none"
                        >
                           {selectedOverlay === 'Minimal' && (
                             <div className="mt-auto bg-black/40 backdrop-blur-xs p-4 rounded-xl text-left">
                                <h1 className="text-white font-mono text-xl md:text-2xl font-black uppercase tracking-[0.4em] drop-shadow-2xl truncate">
                                   {currentTrack?.name || 'NEW_RELEASE'}
                                </h1>
                                <p className="text-white/60 font-mono text-[9px] mt-2 uppercase tracking-widest truncate">
                                   {currentTrack?.artist || 'MASTERCORE_ENGINE'}
                                </p>
                             </div>
                           )}
                           {selectedOverlay === 'Brutalist' && (
                             <div className="h-full border-[6px] md:border-[10px] border-white/20 flex flex-col items-center justify-center">
                                <h1 className="text-white font-mono text-4xl md:text-6xl font-black uppercase leading-none text-center mix-blend-difference drop-shadow-2xl break-all px-4">
                                   {currentTrack?.name || 'CORE'}
                                </h1>
                             </div>
                           )}
                           {selectedOverlay === 'Neon' && (
                             <div className="mt-auto bg-black/60 p-4 border border-primary/25 rounded-xl text-left font-mono">
                                <h1 className="text-primary text-2xl md:text-3xl font-black uppercase tracking-widest drop-shadow-[0_0_15px_#1db954] truncate">
                                   {currentTrack?.name || 'K-3EATZ'}
                                </h1>
                                <div className="h-0.5 w-12 bg-primary mt-3 shadow-[0_0_10px_#1db954]" />
                             </div>
                           )}
                           {selectedOverlay === 'Classic' && (
                             <div className="h-full flex flex-col justify-between border border-white/10 p-6 text-center">
                                <div className="font-serif italic text-white/50 text-xs tracking-widest mb-2">{selectedFormat.toUpperCase()} RELEASE</div>
                                <div className="my-auto">
                                   <h2 className="text-white font-serif text-3xl font-normal tracking-wide italic leading-normal">{currentTrack?.name || 'Symphony'}</h2>
                                   <div className="h-px w-8 bg-white/20 mx-auto my-3" />
                                   <p className="text-white/40 font-mono text-[8px] uppercase tracking-widest">{currentTrack?.artist || 'ORCHESTRAL CORE'}</p>
                                </div>
                                <div className="text-right text-[8px] text-white/20 font-mono font-bold tracking-widest mt-2">STEREO 96K</div>
                             </div>
                           )}
                        </motion.div>
                     </AnimatePresence>
                   </>
                 ) : (
                    <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-12 space-y-4">
                       {generating ? (
                         <div className="space-y-6">
                            <div className="w-16 h-16 border-2 border-primary rounded-full animate-spin border-t-transparent mx-auto" />
                            <p className="font-mono text-xs text-primary animate-pulse tracking-widest uppercase">{m.visualizing}</p>
                         </div>
                       ) : (
                         <>
                            <ImageIcon className="w-16 h-16 text-white/5" />
                            <p className="font-mono text-[10px] text-white/20 uppercase tracking-[0.4em]">{m.readyInput}</p>
                         </>
                       )}
                    </div>
                 )}

                 {/* Tool Overlay */}
                 <div className="absolute top-6 right-6 flex flex-col gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={downloadArtwork} className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors cursor-pointer">
                       <Maximize2 className="w-4 h-4" />
                    </button>
                    <button onClick={handleUploadClick} className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors cursor-pointer">
                       <Layers className="w-4 h-4" />
                    </button>
                 </div>
              </div>
           </div>

           {/* Interactive Action Triggers */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <a 
                href={generatedImage || '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!generatedImage) e.preventDefault();
                }}
                className={`px-6 py-4 rounded-2xl bg-white/5 border flex items-center justify-center gap-4 font-mono text-[10px] uppercase tracking-widest font-black text-white transition-all ${
                  !generatedImage 
                    ? 'opacity-20 cursor-not-allowed border-white/5' 
                    : 'hover:bg-white/10 hover:border-primary/40 border-white/10'
                }`}
              >
                 <ExternalLink className="w-4 h-4" />
                 {m.openNewTab}
              </a>
              
              <button 
                onClick={downloadArtwork}
                disabled={!generatedImage}
                className="px-6 py-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center gap-4 font-mono text-[10px] uppercase tracking-widest font-black text-white hover:bg-white/10 hover:border-primary/40 disabled:opacity-20 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                 <Download className="w-4 h-4 text-primary" />
                 <span>{m.download} ({exportResolution === '3000' ? (selectedFormat === 'CD' ? '3000x3000px' : selectedFormat === 'Youtube' ? '3840x2160' : '2160x3840') : exportResolution === '2048' ? '2048x2048' : '1024x1024'})</span>
              </button>

              {currentTrack && (
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={applyArtworkToTrack}
                    disabled={!generatedImage || applied || applying}
                    className={`px-6 py-4 rounded-2xl border flex items-center justify-center gap-4 font-mono text-[10px] uppercase tracking-widest font-black transition-all cursor-pointer ${
                      applied 
                        ? 'bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(29,185,84,0.15)]' 
                        : 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/20 disabled:opacity-20 disabled:cursor-not-allowed'
                    }`}
                  >
                     {applying ? (
                       <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                     ) : applied ? (
                       <Check className="w-4 h-4 animate-bounce" />
                     ) : (
                       <Sparkles className="w-4 h-4" />
                     )}
                     {applying ? 'Compressing & Applying...' : applied ? m.appliedSuccessfully : m.applyToTrack}
                  </button>
                  {applyError && (
                    <span className="text-[10px] font-mono text-red-400 text-center">
                      {applyError}
                    </span>
                  )}
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}
