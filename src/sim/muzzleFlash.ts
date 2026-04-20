import * as THREE from 'three';

export interface MuzzleFlashOptions {
  seed?: number;
  cols?: number;
  rows?: number;
  cellSize?: number;
  frameCount?: number;
  fps?: number;
  streakCount?: number;
  noiseIntensity?: number;
}

export interface MuzzleFlashAtlas {
  texture: THREE.CanvasTexture;
  cols: number;
  rows: number;
  frameCount: number;
  fps: number;
}

export function generateMuzzleFlashAtlas(
  options: MuzzleFlashOptions = {},
): MuzzleFlashAtlas {
  const {
    seed = 1,
    cols = 4,
    rows = 4,
    cellSize = 128,
    frameCount = cols * rows,
    fps = 60,
    streakCount = 7,
    noiseIntensity = 0.25,
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = cols * cellSize;
  canvas.height = rows * cellSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const rand = mulberry32(seed);
  const streaks = Array.from({ length: streakCount }, (_, k) => ({
    angle: (k / streakCount) * Math.PI * 2 + (rand() - 0.5) * 0.6,
    length: 0.65 + rand() * 0.35,
    thickness: 0.5 + rand() * 0.8,
  }));

  for (let i = 0; i < frameCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = col * cellSize + cellSize / 2;
    const cy = row * cellSize + cellSize / 2;

    const t = frameCount > 1 ? i / (frameCount - 1) : 0;
    const envelope = flashEnvelope(t);
    if (envelope <= 0) continue;

    ctx.save();
    ctx.beginPath();
    ctx.rect(col * cellSize, row * cellSize, cellSize, cellSize);
    ctx.clip();

    drawCore(ctx, cx, cy, cellSize, t, envelope);

    ctx.globalCompositeOperation = 'lighter';
    drawStreaks(ctx, cx, cy, cellSize, t, envelope, streaks);
    drawNoise(ctx, cx, cy, cellSize, envelope, noiseIntensity, rand);

    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;

  return { texture, cols, rows, frameCount, fps };
}

export function flashEnvelope(t: number): number {
  const peakT = 0.15;
  const attack = t / peakT;
  const decay = 1 - (t - peakT) / (1 - peakT);
  return Math.max(0, t < peakT ? attack : decay);
}

function drawCore(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cellSize: number,
  t: number,
  envelope: number,
): void {
  const radiusNorm = Math.pow(t, 0.4);
  const radius = cellSize * 0.45 * Math.min(radiusNorm + 0.12, 1);
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0, `rgba(255, 255, 230, ${0.95 * envelope})`);
  gradient.addColorStop(0.3, `rgba(255, 220, 130, ${0.85 * envelope})`);
  gradient.addColorStop(0.7, `rgba(255, 120, 40, ${0.45 * envelope})`);
  gradient.addColorStop(1, 'rgba(150, 40, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
}

interface Streak {
  angle: number;
  length: number;
  thickness: number;
}

function drawStreaks(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cellSize: number,
  t: number,
  envelope: number,
  streaks: Streak[],
): void {
  const growth = Math.min(t * 3.5, 1);
  for (const streak of streaks) {
    const len = cellSize * 0.48 * streak.length * growth;
    if (len < 1) continue;
    const endX = cx + Math.cos(streak.angle) * len;
    const endY = cy + Math.sin(streak.angle) * len;

    const grad = ctx.createLinearGradient(cx, cy, endX, endY);
    grad.addColorStop(0, `rgba(255, 240, 200, ${0.85 * envelope})`);
    grad.addColorStop(0.4, `rgba(255, 170, 80, ${0.45 * envelope})`);
    grad.addColorStop(1, 'rgba(255, 90, 20, 0)');

    ctx.strokeStyle = grad;
    ctx.lineWidth = cellSize * 0.018 * streak.thickness * (0.4 + envelope * 0.6);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }
}

function drawNoise(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cellSize: number,
  envelope: number,
  intensity: number,
  rand: () => number,
): void {
  const count = Math.floor(40 * intensity * envelope);
  const maxRadius = cellSize * 0.42;
  for (let i = 0; i < count; i++) {
    const r = rand() * maxRadius;
    const a = rand() * Math.PI * 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    const falloff = 1 - r / maxRadius;
    const alpha = envelope * falloff * 0.6 * rand();
    ctx.fillStyle = `rgba(255, 230, 170, ${alpha})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
