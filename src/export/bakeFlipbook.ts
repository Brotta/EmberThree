import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

export interface BakeOptions {
  cols?: number;
  rows?: number;
  cellSize?: number;
  fps?: number;
  warmupSteps?: number;
  stepsPerFrame?: number;
  dt?: number;
  onProgress?: (frame: number, total: number) => void;
}

export interface BakedFlipbook {
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  cols: number;
  rows: number;
  frameCount: number;
  fps: number;
  cellSize: number;
}

const CAPTURE_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const CAPTURE_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTexture;
void main() {
  vec3 c = texture2D(uTexture, vUv).rgb;
  float a = clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0);
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), a);
}
`;

export async function bakeFlipbook(
  renderer: THREE.WebGLRenderer,
  getDensityTexture: () => THREE.Texture,
  stepFn: (dt: number) => void,
  options: BakeOptions = {},
): Promise<BakedFlipbook> {
  const {
    cols = 8,
    rows = 8,
    cellSize = 128,
    fps = 30,
    warmupSteps = 90,
    stepsPerFrame = 2,
    dt = 1 / 60,
    onProgress,
  } = options;

  const totalFrames = cols * rows;

  const captureRT = new THREE.WebGLRenderTarget(cellSize, cellSize, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
    depthBuffer: false,
    stencilBuffer: false,
  });

  const material = new THREE.ShaderMaterial({
    uniforms: { uTexture: { value: null } },
    vertexShader: CAPTURE_VERT,
    fragmentShader: CAPTURE_FRAG,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new FullScreenQuad(material);

  const canvas = document.createElement('canvas');
  canvas.width = cols * cellSize;
  canvas.height = rows * cellSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    captureRT.dispose();
    quad.dispose();
    material.dispose();
    throw new Error('2D canvas context unavailable');
  }

  for (let i = 0; i < warmupSteps; i++) stepFn(dt);

  const pixels = new Uint8Array(cellSize * cellSize * 4);
  const stride = cellSize * 4;

  for (let i = 0; i < totalFrames; i++) {
    for (let s = 0; s < stepsPerFrame; s++) stepFn(dt);

    material.uniforms.uTexture.value = getDensityTexture();
    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(captureRT);
    quad.render(renderer);
    renderer.readRenderTargetPixels(
      captureRT,
      0,
      0,
      cellSize,
      cellSize,
      pixels,
    );
    renderer.setRenderTarget(prevTarget);

    const flipped = new Uint8ClampedArray(pixels.length);
    for (let y = 0; y < cellSize; y++) {
      const src = (cellSize - 1 - y) * stride;
      const dst = y * stride;
      for (let x = 0; x < stride; x++) flipped[dst + x] = pixels[src + x];
    }

    const col = i % cols;
    const row = Math.floor(i / cols);
    const imageData = new ImageData(flipped, cellSize, cellSize);
    ctx.putImageData(imageData, col * cellSize, row * cellSize);

    onProgress?.(i + 1, totalFrames);

    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
  }

  captureRT.dispose();
  quad.dispose();
  material.dispose();

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;

  return { canvas, texture, cols, rows, frameCount: totalFrames, fps, cellSize };
}

export function downloadFlipbook(
  baked: BakedFlipbook,
  basename: string,
): void {
  baked.canvas.toBlob((blob) => {
    if (!blob) return;
    triggerDownload(blob, `${basename}.png`);
  }, 'image/png');

  const meta = {
    version: 1,
    cols: baked.cols,
    rows: baked.rows,
    frameCount: baked.frameCount,
    fps: baked.fps,
    cellSize: baked.cellSize,
    width: baked.canvas.width,
    height: baked.canvas.height,
  };
  const blob = new Blob([JSON.stringify(meta, null, 2)], {
    type: 'application/json',
  });
  triggerDownload(blob, `${basename}.json`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
