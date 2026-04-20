import * as THREE from 'three';

export interface TestAtlasOptions {
  cols?: number;
  rows?: number;
  cellSize?: number;
}

export function generateTestAtlas(
  options: TestAtlasOptions = {},
): THREE.CanvasTexture {
  const { cols = 8, rows = 8, cellSize = 64 } = options;
  const total = cols * rows;

  const canvas = document.createElement('canvas');
  canvas.width = cols * cellSize;
  canvas.height = rows * cellSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');

  for (let i = 0; i < total; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = col * cellSize + cellSize / 2;
    const cy = row * cellSize + cellSize / 2;

    const t = i / total;
    const theta = t * Math.PI * 2;
    const pulse = 0.5 + 0.5 * Math.sin(theta);
    const radius = cellSize * (0.18 + 0.28 * pulse);
    const hue = t * 360;

    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, `hsla(${hue}, 100%, 72%, ${0.85 * pulse + 0.15})`);
    gradient.addColorStop(0.5, `hsla(${hue}, 100%, 50%, ${0.5 * pulse})`);
    gradient.addColorStop(1, `hsla(${hue}, 100%, 40%, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
