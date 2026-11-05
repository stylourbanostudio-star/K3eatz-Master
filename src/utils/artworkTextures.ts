/**
 * High-Resolution Canvas Texture Synthesizer for Artwork Studio
 * Generates lossless vinyl grooves, analog tape noise, shrink wrap, and vintage print wear.
 */

export type TextureType = 'none' | 'vinyl' | 'tape' | 'shrinkwrap' | 'vintage';

export function applyTextureToCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  texture: TextureType,
  intensity: number = 70
) {
  if (texture === 'none' || intensity <= 0) return;
  const factor = Math.max(0.1, Math.min(1.0, intensity / 100));

  ctx.save();

  if (texture === 'vinyl') {
    drawVinylGrooves(ctx, width, height, factor);
  } else if (texture === 'tape') {
    drawAnalogTape(ctx, width, height, factor);
  } else if (texture === 'shrinkwrap') {
    drawShrinkWrap(ctx, width, height, factor);
  } else if (texture === 'vintage') {
    drawVintageRingWear(ctx, width, height, factor);
  }

  ctx.restore();
}

/**
 * Photorealistic Vinyl Grooves, Reflection Sheens & Center Ring
 */
function drawVinylGrooves(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  factor: number
) {
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.hypot(cx, cy);

  // 1. Concentric Vinyl Grooves
  ctx.lineWidth = Math.max(1, Math.round(width / 1500));
  const grooveCount = Math.floor(180 * factor);
  const minR = width * 0.12;
  const maxGrooveR = width * 0.72;
  const step = (maxGrooveR - minR) / grooveCount;

  for (let r = minR; r < maxGrooveR; r += step) {
    const isMajor = Math.floor(r) % 7 === 0;
    const alpha = (isMajor ? 0.08 : 0.035) * factor;
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Subtle dark groove depression
    ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * 1.5})`;
    ctx.beginPath();
    ctx.arc(cx, cy, r + ctx.lineWidth, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 2. Vinyl 12" LP Ring Wear Depression (circular wear where the record outline is embossed)
  const ringR = width * 0.44;
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.12 * factor})`;
  ctx.lineWidth = Math.max(2, width * 0.008);
  ctx.beginPath();
  ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = `rgba(0, 0, 0, ${0.15 * factor})`;
  ctx.lineWidth = Math.max(3, width * 0.012);
  ctx.beginPath();
  ctx.arc(cx, cy, ringR + width * 0.005, 0, Math.PI * 2);
  ctx.stroke();

  // 3. Two Anisotropic Light Reflection Cones (Diagonal Vinyl Sheens)
  const angles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
  angles.forEach((baseAngle) => {
    const grad = ctx.createRadialGradient(cx, cy, width * 0.08, cx, cy, width * 0.6);
    grad.addColorStop(0, `rgba(255, 255, 255, ${0.18 * factor})`);
    grad.addColorStop(0.5, `rgba(255, 255, 255, ${0.08 * factor})`);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, maxR, baseAngle - 0.22, baseAngle + 0.22);
    ctx.closePath();
    ctx.fill();
  });

  // 4. Subtle Outer Vinyl Rim Vignette
  const rimGrad = ctx.createRadialGradient(cx, cy, width * 0.35, cx, cy, width * 0.65);
  rimGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  rimGrad.addColorStop(1, `rgba(0, 0, 0, ${0.4 * factor})`);
  ctx.fillStyle = rimGrad;
  ctx.fillRect(0, 0, width, height);

  // 5. Authentic Hype Tag in Corner
  if (factor >= 0.4) {
    drawVinylHypeSticker(ctx, width, height, factor);
  }
}

/**
 * Analog Tape Magnetic Saturation, Horizontal Scanlines, Head Wear & Flutter Grain
 */
function drawAnalogTape(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  factor: number
) {
  // 1. Warm Analog Magnetic Saturation Wash
  ctx.fillStyle = `rgba(180, 110, 45, ${0.07 * factor})`;
  ctx.fillRect(0, 0, width, height);

  // 2. Horizontal Magnetic Tape Head Scanlines
  const lineSpacing = Math.max(3, Math.round(height / 350));
  ctx.lineWidth = 1;
  for (let y = 0; y < height; y += lineSpacing) {
    const isDark = (y / lineSpacing) % 2 === 0;
    const alpha = (isDark ? 0.05 : 0.02) * factor;
    ctx.strokeStyle = isDark ? `rgba(0, 0, 0, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // 3. Magnetic Tape Edge Bleed & Head Wear (Top & Bottom Wear Bands)
  const topGrad = ctx.createLinearGradient(0, 0, 0, height * 0.08);
  topGrad.addColorStop(0, `rgba(0, 0, 0, ${0.35 * factor})`);
  topGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, width, height * 0.08);

  const botGrad = ctx.createLinearGradient(0, height, 0, height * 0.92);
  botGrad.addColorStop(0, `rgba(0, 0, 0, ${0.35 * factor})`);
  botGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = botGrad;
  ctx.fillRect(0, height * 0.92, width, height * 0.08);

  // 4. Authentic Analog Tape Micro Stamp
  if (factor >= 0.3) {
    const fontSize = Math.max(12, Math.round(width * 0.016));
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.45 * factor})`;
    ctx.textAlign = 'left';
    ctx.fillText('MASTER TAPE // 15 IPS • CCIR EQ', width * 0.05, height * 0.06);

    ctx.textAlign = 'right';
    ctx.fillText('ANALOG STUDER A800 SATELLITE', width * 0.95, height * 0.06);
  }
}

/**
 * Realistic Glossy Shrink Wrap with Crinkles, Folds & Reflections
 */
function drawShrinkWrap(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  factor: number
) {
  // 1. Diagonal Cellophane Sheen
  const sheenGrad = ctx.createLinearGradient(0, 0, width, height);
  sheenGrad.addColorStop(0, `rgba(255, 255, 255, ${0.12 * factor})`);
  sheenGrad.addColorStop(0.2, `rgba(255, 255, 255, ${0.03 * factor})`);
  sheenGrad.addColorStop(0.4, `rgba(255, 255, 255, ${0.15 * factor})`);
  sheenGrad.addColorStop(0.6, `rgba(255, 255, 255, ${0.02 * factor})`);
  sheenGrad.addColorStop(0.85, `rgba(255, 255, 255, ${0.18 * factor})`);
  sheenGrad.addColorStop(1, `rgba(255, 255, 255, ${0.05 * factor})`);
  ctx.fillStyle = sheenGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Corner Cellophane Triangular Folds (Top-Right & Bottom-Left)
  const foldSize = width * 0.18;

  // Top-Right Fold
  ctx.beginPath();
  ctx.moveTo(width - foldSize, 0);
  ctx.lineTo(width, foldSize);
  ctx.lineTo(width, 0);
  ctx.closePath();
  ctx.fillStyle = `rgba(255, 255, 255, ${0.2 * factor})`;
  ctx.fill();

  ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 * factor})`;
  ctx.lineWidth = Math.max(1.5, width * 0.002);
  ctx.beginPath();
  ctx.moveTo(width - foldSize, 0);
  ctx.lineTo(width, foldSize);
  ctx.stroke();

  // 3. Realistic Wrinkle / Crinkle Lines
  const wrinkles = [
    { x1: 0, y1: height * 0.15, x2: width * 0.25, y2: 0 },
    { x1: width * 0.1, y1: height * 0.05, x2: width * 0.4, y2: 0 },
    { x1: 0, y1: height * 0.85, x2: width * 0.3, y2: height },
    { x1: width * 0.7, y1: height, x2: width, y2: height * 0.78 },
    { x1: width * 0.85, y1: height, x2: width, y2: height * 0.9 }
  ];

  wrinkles.forEach((w) => {
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 * factor})`;
    ctx.lineWidth = Math.max(1, width * 0.0015);
    ctx.beginPath();
    ctx.moveTo(w.x1, w.y1);
    ctx.lineTo(w.x2, w.y2);
    ctx.stroke();

    // Dark crease shadow underneath
    ctx.strokeStyle = `rgba(0, 0, 0, ${0.25 * factor})`;
    ctx.beginPath();
    ctx.moveTo(w.x1 + 1, w.y1 + 1);
    ctx.lineTo(w.x2 + 1, w.y2 + 1);
    ctx.stroke();
  });
}

/**
 * Vintage Cardboard Sleeve & Ring Wear
 */
function drawVintageRingWear(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  factor: number
) {
  const cx = width / 2;
  const cy = height / 2;
  const ringR = width * 0.42;

  // Aged cardboard tint
  ctx.fillStyle = `rgba(215, 185, 150, ${0.08 * factor})`;
  ctx.fillRect(0, 0, width, height);

  // Heavy circular ring wear (scuffed white friction ring)
  const ringGrad = ctx.createRadialGradient(cx, cy, ringR - width * 0.06, cx, cy, ringR + width * 0.06);
  ringGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
  ringGrad.addColorStop(0.5, `rgba(255, 255, 255, ${0.25 * factor})`);
  ringGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = ringGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, ringR + width * 0.06, 0, Math.PI * 2);
  ctx.fill();

  // Edge distress / scuffs
  const edgeDistress = [
    { x: 0, y: 0, w: width * 0.08, h: height, dark: true },
    { x: width * 0.94, y: 0, w: width * 0.06, h: height, dark: true },
    { x: 0, y: 0, w: width, h: height * 0.05, dark: false },
    { x: 0, y: height * 0.95, w: width, h: height * 0.05, dark: false }
  ];

  edgeDistress.forEach((e) => {
    ctx.fillStyle = e.dark ? `rgba(0, 0, 0, ${0.2 * factor})` : `rgba(255, 255, 255, ${0.15 * factor})`;
    ctx.fillRect(e.x, e.y, e.w, e.h);
  });
}

/**
 * Metallic Gold/Silver Vinyl Hype Sticker in the corner
 */
function drawVinylHypeSticker(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  factor: number
) {
  const size = Math.round(width * 0.16);
  const cx = width - size * 0.85;
  const cy = size * 0.85;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(0.08); // Slight organic tilt

  // Drop shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = Math.max(6, width * 0.01);
  ctx.shadowOffsetY = Math.max(3, width * 0.005);

  // Sticker base
  ctx.fillStyle = '#0a0a0a';
  ctx.beginPath();
  ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // Gold foil border
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = Math.max(2, Math.round(width * 0.003));
  ctx.beginPath();
  ctx.arc(0, 0, size / 2 - 4, 0, Math.PI * 2);
  ctx.stroke();

  // Inner ring
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, size / 2 - 10, 0, Math.PI * 2);
  ctx.stroke();

  // Text inside sticker
  ctx.fillStyle = '#d4af37';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${Math.max(8, Math.round(size * 0.15))}px monospace`;
  ctx.fillText('180g AUDIOPHILE', 0, -size * 0.18);

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.max(7, Math.round(size * 0.12))}px monospace`;
  ctx.fillText('VINYL MASTER', 0, 0);

  ctx.fillStyle = '#1db954';
  ctx.font = `900 ${Math.max(6, Math.round(size * 0.1))}px monospace`;
  ctx.fillText('DIRECT DMM CUT', 0, size * 0.18);

  ctx.restore();
}
