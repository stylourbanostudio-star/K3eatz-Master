import React from 'react';
import { TextureType } from '../utils/artworkTextures';

interface ArtworkTextureOverlayProps {
  texture: TextureType;
  intensity: number; // 0 to 100
}

export default function ArtworkTextureOverlay({ texture, intensity }: ArtworkTextureOverlayProps) {
  if (texture === 'none' || intensity <= 0) return null;

  const opacity = Math.max(0.1, Math.min(1.0, intensity / 100));

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden select-none"
      style={{ opacity }}
    >
      {/* 1. VINYL GROOVES & SHEEN REFLECTIONS */}
      {texture === 'vinyl' && (
        <div className="relative w-full h-full">
          {/* Concentric groove rings */}
          <div
            className="absolute inset-0 rounded-full scale-[1.3] m-auto opacity-70"
            style={{
              background: `repeating-radial-gradient(
                circle at center,
                rgba(255, 255, 255, 0.04) 0px,
                rgba(255, 255, 255, 0.04) 1px,
                transparent 1px,
                transparent 4px,
                rgba(0, 0, 0, 0.08) 4px,
                rgba(0, 0, 0, 0.08) 5px
              )`
            }}
          />

          {/* Anisotropic Light Sheen Cones */}
          <div
            className="absolute inset-0 opacity-40 mix-blend-screen"
            style={{
              background: `conic-gradient(
                from 45deg at 50% 50%,
                rgba(255, 255, 255, 0.3) 0deg,
                transparent 30deg,
                transparent 60deg,
                rgba(255, 255, 255, 0.25) 90deg,
                transparent 120deg,
                transparent 150deg,
                rgba(255, 255, 255, 0.3) 180deg,
                transparent 210deg,
                transparent 240deg,
                rgba(255, 255, 255, 0.25) 270deg,
                transparent 300deg,
                transparent 330deg,
                rgba(255, 255, 255, 0.3) 360deg
              )`
            }}
          />

          {/* 12" LP Inner Ring Emboss */}
          <div className="absolute inset-8 rounded-full border border-white/15 shadow-[0_0_25px_rgba(0,0,0,0.5)_inset]" />
          <div className="absolute inset-9 rounded-full border border-black/25" />

          {/* Outer Rim Vignette */}
          <div className="absolute inset-0 rounded-3xl shadow-[inset_0_0_80px_rgba(0,0,0,0.7)]" />

          {/* Audiophile Hype Sticker */}
          <div className="absolute top-4 right-4 rotate-6 bg-black/90 border-2 border-[#d4af37] rounded-full w-18 h-18 p-1 shadow-2xl flex flex-col items-center justify-center text-center font-mono">
            <span className="text-[#d4af37] text-[6px] font-black tracking-widest leading-none">180g AUDIOPHILE</span>
            <span className="text-white text-[7px] font-black uppercase tracking-wider my-0.5">VINYL MASTER</span>
            <span className="text-primary text-[5px] font-bold tracking-widest leading-none">DIRECT CUT</span>
          </div>
        </div>
      )}

      {/* 2. ANALOG TAPE / CASSETTE */}
      {texture === 'tape' && (
        <div className="relative w-full h-full">
          {/* Warm analog magnetic color grading */}
          <div className="absolute inset-0 bg-[#c88232] mix-blend-color opacity-25" />

          {/* Horizontal magnetic scanlines */}
          <div
            className="absolute inset-0 opacity-40 mix-blend-overlay"
            style={{
              backgroundImage: `repeating-linear-gradient(
                0deg,
                rgba(0, 0, 0, 0.2) 0px,
                rgba(0, 0, 0, 0.2) 1px,
                transparent 1px,
                transparent 3px
              )`
            }}
          />

          {/* Top & Bottom magnetic head wear gradients */}
          <div className="absolute top-0 inset-x-0 h-10 bg-gradient-to-b from-black/60 to-transparent" />
          <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-black/60 to-transparent" />

          {/* Magnetic Tape Header Stamps */}
          <div className="absolute top-3 left-4 text-[8px] font-mono font-bold text-white/60 tracking-wider">
            MASTER TAPE // 15 IPS • CCIR EQ
          </div>
          <div className="absolute top-3 right-4 text-[8px] font-mono font-bold text-amber/80 tracking-wider">
            TYPE II CrO2 HIGH BIAS
          </div>
        </div>
      )}

      {/* 3. CELLOPHANE SHRINK WRAP */}
      {texture === 'shrinkwrap' && (
        <div className="relative w-full h-full">
          {/* Diagonal high-gloss cellophane sheen */}
          <div
            className="absolute inset-0 opacity-45 mix-blend-screen"
            style={{
              background: `linear-gradient(
                135deg,
                rgba(255, 255, 255, 0.25) 0%,
                rgba(255, 255, 255, 0.05) 25%,
                rgba(255, 255, 255, 0.3) 45%,
                rgba(255, 255, 255, 0.02) 65%,
                rgba(255, 255, 255, 0.25) 90%,
                rgba(255, 255, 255, 0.05) 100%
              )`
            }}
          />

          {/* Top-Right Corner Triangular Cellophane Fold */}
          <div
            className="absolute top-0 right-0 w-24 h-24 pointer-events-none"
            style={{
              background: 'linear-gradient(to bottom left, rgba(255, 255, 255, 0.35) 50%, transparent 50%)',
              borderBottom: '2px solid rgba(255, 255, 255, 0.6)'
            }}
          />

          {/* Bottom-Left Cellophane Fold */}
          <div
            className="absolute bottom-0 left-0 w-20 h-20 pointer-events-none"
            style={{
              background: 'linear-gradient(to top right, rgba(255, 255, 255, 0.3) 50%, transparent 50%)',
              borderTop: '2px solid rgba(255, 255, 255, 0.5)'
            }}
          />

          {/* Cellophane Wrinkles */}
          <div className="absolute top-8 left-4 w-36 h-0.5 bg-white/40 rotate-12 shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
          <div className="absolute bottom-12 right-6 w-44 h-0.5 bg-white/35 -rotate-15 shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
        </div>
      )}

      {/* 4. VINTAGE CARDBOARD SLEEVE & RING WEAR */}
      {texture === 'vintage' && (
        <div className="relative w-full h-full">
          {/* Aged paper wash */}
          <div className="absolute inset-0 bg-[#d7b996] mix-blend-multiply opacity-15" />

          {/* Circular LP jacket ring wear */}
          <div
            className="absolute inset-4 rounded-full opacity-60 mix-blend-screen"
            style={{
              background: `radial-gradient(
                circle,
                transparent 55%,
                rgba(255, 255, 255, 0.45) 75%,
                transparent 85%
              )`
            }}
          />

          {/* Edge Scuffs and Corner Distress */}
          <div className="absolute inset-0 border-4 border-white/20 opacity-40" />
          <div className="absolute left-0 inset-y-0 w-4 bg-gradient-to-r from-black/40 to-transparent" />
          <div className="absolute right-0 inset-y-0 w-4 bg-gradient-to-l from-black/40 to-transparent" />
        </div>
      )}
    </div>
  );
}
