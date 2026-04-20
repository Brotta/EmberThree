import * as THREE from 'three';

export interface MuzzleFlashOptions {
  seed?: number;
  cols?: number;
  rows?: number;
  cellSize?: number;
  frameCount?: number;
  fps?: number;
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
    cols = 4,
    rows = 4,
    cellSize = 128,
    frameCount = cols * rows,
    fps = 60,
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = cols * cellSize;
  canvas.height = rows * cellSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < frameCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = col * cellSize + cellSize / 2;
    const cy = row * cellSize + cellSize / 2;

    const t = frameCount > 1 ? i / (frameCount - 1) : 0;
    const envelope = flashEnvelope(t);
    if (envelope <= 0) continue;

    const radiusNorm = Math.pow(t, 0.4);
    const radius = cellSize * 0.45 * Math.min(radiusNorm + 0.12, 1);

    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, `rgba(255, 255, 230, ${0.95 * envelope})`);
    gradient.addColorStop(0.3, `rgba(255, 220, 130, ${0.85 * envelope})`);
    gradient.addColorStop(0.7, `rgba(255, 120, 40, ${0.45 * envelope})`);
    gradient.addColorStop(1, 'rgba(150, 40, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;

  return { texture, cols, rows, frameCount, fps };
}

function flashEnvelope(t: number): number {
  const peakT = 0.15;
  const attack = t / peakT;
  const decay = 1 - (t - peakT) / (1 - peakT);
  return Math.max(0, t < peakT ? attack : decay);
}
