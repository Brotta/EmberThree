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
}

const MAX_CLAMP_DT = 0.1;

export class FlipbookSprite extends THREE.Mesh {
  declare material: THREE.ShaderMaterial;

  private readonly frameCount: number;
  private readonly fps: number;
  private readonly loop: boolean;
  private time = 0;
  private lastTime: number | null = null;

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
    });

    super(geometry, material);

    this.frameCount = frameCount;
    this.fps = fps;
    this.loop = loop;

    this.onBeforeRender = (_renderer, _scene, camera) => this.tick(camera);
  }

  private tick(camera: THREE.Camera): void {
    const now = performance.now() / 1000;
    const dt =
      this.lastTime === null ? 0 : Math.min(now - this.lastTime, MAX_CLAMP_DT);
    this.lastTime = now;

    this.time += dt;
    let frame = this.time * this.fps;
    frame = this.loop
      ? frame % this.frameCount
      : Math.min(frame, this.frameCount - 1);
    this.material.uniforms.uFrame.value = frame;

    this.quaternion.copy(camera.quaternion);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
