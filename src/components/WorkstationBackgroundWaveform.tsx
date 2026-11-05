import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useMastering } from '../context/MasteringContext';

export default function WorkstationBackgroundWaveform() {
  const { audioBuffer, currentTime, isPlaying } = useMastering();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // 1. Listen to parent size changes dynamically
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      setDimensions({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    };

    updateSize();

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // 2. Precalculate highly optimized, scale-normalized peak points from the AudioBuffer
  const peaks = useMemo(() => {
    if (!audioBuffer) return [];

    const sampleCount = 180; // Elegant density of columns
    const computedPeaks: number[] = [];
    const channelData = audioBuffer.getChannelData(0);
    const step = Math.floor(channelData.length / sampleCount);

    let maxSampleVal = 0.01; // Avoid divide-by-zero
    for (let i = 0; i < sampleCount; i++) {
      let max = 0;
      const start = i * step;
      const end = Math.min(start + step, channelData.length);
      for (let j = start; j < end; j++) {
        const val = Math.abs(channelData[j]);
        if (val > max) max = val;
      }
      computedPeaks.push(max);
      if (max > maxSampleVal) {
        maxSampleVal = max;
      }
    }

    // Normalize values to peak level of 1.0 safely
    return computedPeaks.map((p) => p / maxSampleVal);
  }, [audioBuffer]);

  // 3. Render the dynamic waveform & playhead indicator inside the requestAnimationFrame loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Support premium high-DPI scaling
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    let animationId: number;

    const render = () => {
      const w = dimensions.width;
      const h = dimensions.height;
      
      // Clean canvas
      ctx.clearRect(0, 0, w, h);

      if (!audioBuffer || peaks.length === 0) {
        // Draw static grid-lines if no Audio signal connected
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.012)';
        ctx.lineWidth = 1;
        const gridLines = 8;
        for (let i = 1; i < gridLines; i++) {
          const y = (h / gridLines) * i;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
        return;
      }

      const totalDuration = audioBuffer.duration;
      const progress = Math.min(1, Math.max(0, currentTime / totalDuration));

      // Draw horizontal background evaluation bars
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.01)';
      ctx.lineWidth = 0.5;
      for (let yVal = 0.1; yVal < 1; yVal += 0.2) {
        const yTop = h * 0.5 - (h * 0.4 * yVal);
        const yBottom = h * 0.5 + (h * 0.4 * yVal);
        ctx.beginPath(); ctx.moveTo(0, yTop); ctx.lineTo(w, yTop); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, yBottom); ctx.lineTo(w, yBottom); ctx.stroke();
      }

      // Render the symmetrical columns
      const count = peaks.length;
      const spacing = 3;
      const colWidth = (w - (count - 1) * spacing) / count;
      const centerY = h / 2;
      const maxAmplitude = h * 0.38; // Give generous spacing margin top and bottom

      for (let i = 0; i < count; i++) {
        const peak = peaks[i];
        const barHeight = peak * maxAmplitude;
        const x = i * (colWidth + spacing);
        const isPlayedPos = (i / count) <= progress;

        // Choose gorgeous glowing retro theme for background
        let barColor = 'rgba(255, 255, 255, 0.02)'; // Dark unplayed
        if (isPlayedPos) {
          barColor = 'rgba(29, 185, 84, 0.08)'; // Radiant glowing green played
        }

        ctx.fillStyle = barColor;

        // Symmetric top and bottom bars with slight rounded capsule look
        const r = Math.max(1, colWidth / 2);
        const topY = centerY - barHeight;
        const bottomY = centerY + barHeight;
        const totalHeight = barHeight * 2;

        if (totalHeight > 2) {
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(x, topY, colWidth, totalHeight, r);
          } else {
            ctx.rect(x, topY, colWidth, totalHeight);
          }
          ctx.fill();
        }
      }

      // Draw thin elegant fluorescent scan playhead pointer
      if (progress > 0 && progress < 1) {
        const playheadX = progress * w;
        
        const gradient = ctx.createLinearGradient(playheadX, 0, playheadX, h);
        gradient.addColorStop(0, 'rgba(29, 185, 84, 0)');
        gradient.addColorStop(0.1, 'rgba(29, 185, 84, 0.25)');
        gradient.addColorStop(0.5, 'rgba(29, 185, 84, 0.15)');
        gradient.addColorStop(0.9, 'rgba(29, 185, 84, 0.25)');
        gradient.addColorStop(1, 'rgba(29, 185, 84, 0)');

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, h);
        ctx.stroke();

        // Small glowing pip indicator at center point
        ctx.fillStyle = '#1db954';
        ctx.shadowColor = '#1db954';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(playheadX, centerY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [dimensions, peaks, audioBuffer, currentTime]);

  return (
    <div 
      ref={containerRef} 
      className="absolute inset-0 w-full h-full pointer-events-none select-none z-0"
    >
      <canvas 
        ref={canvasRef} 
        className="w-full h-full block"
      />
    </div>
  );
}
