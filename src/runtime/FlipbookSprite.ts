import * as THREE from 'three';
import flipbookVert from './shaders/flipbook.vert.glsl?raw';
import flipbookFrag from './shaders/flipbook.frag.glsl?raw';

export interface FlipbookSpriteOptions {
  texture: THREE.Texture;
  cols: number;
  rows: number;
  frameCount?: number;
  fps?: number;
  loop?: boolean;
  size?: number;
  aspect?: number;
  blending?: THREE.Blending;
  autoplay?: boolean;
  onComplete?: () => void;
}

const MAX_CLAMP_DT = 0.1;

export class FlipbookSprite extends THREE.Mesh {
  declare material: THREE.ShaderMaterial;

  private readonly frameCount: number;
  private readonly fps: number;
  private readonly loop: boolean;
  private readonly onComplete?: () => void;
  private time = 0;
  private lastTime: number | null = null;
  private playing: boolean;
  private completed = false;

  constructor(options: FlipbookSpriteOptions) {
    const {
      texture,
      cols,
      rows,
      frameCount = cols * rows,
      fps = 30,
      loop = true,
      size = 1,
      aspect = 1,
      blending = THREE.NormalBlending,
      autoplay = true,
      onComplete,
    } = options;

    const geometry = new THREE.PlaneGeometry(aspect * size, size);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uAtlas: { value: texture },
        uCols: { value: cols },
        uRows: { value: rows },
        uFrame: { value: 0 },
      },
      vertexShader: flipbookVert,
      fragmentShader: flipbookFrag,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending,
    });

    super(geometry, material);

    this.frameCount = frameCount;
    this.fps = fps;
    this.loop = loop;
    this.onComplete = onComplete;
    this.playing = autoplay;

    this.onBeforeRender = (_renderer, _scene, camera) => this.tick(camera);
  }

  play(): void {
    this.time = 0;
    this.lastTime = null;
    this.completed = false;
    this.playing = true;
    this.material.uniforms.uFrame.value = 0;
  }

  stop(): void {
    this.playing = false;
    this.time = 0;
    this.lastTime = null;
  }

  private tick(camera: THREE.Camera): void {
    const now = performance.now() / 1000;
    const dt =
      this.lastTime === null ? 0 : Math.min(now - this.lastTime, MAX_CLAMP_DT);
    this.lastTime = now;

    if (this.playing && !this.completed) {
      this.time += dt;
      let frame = this.time * this.fps;
      if (this.loop) {
        frame = frame % this.frameCount;
      } else if (frame >= this.frameCount - 1) {
        frame = this.frameCount - 1;
        this.completed = true;
        this.playing = false;
        this.onComplete?.();
      }
      this.material.uniforms.uFrame.value = frame;
    }

    this.quaternion.copy(camera.quaternion);
    this.updateMatrixWorld(true);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
