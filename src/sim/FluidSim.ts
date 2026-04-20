import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import fullscreenVert from './shaders/fullscreen.vert.glsl?raw';
import splatFrag from './shaders/splat.frag.glsl?raw';

export interface FluidSimConfig {
  resolution?: number;
}

interface PingPong {
  read: THREE.WebGLRenderTarget;
  write: THREE.WebGLRenderTarget;
  swap(): void;
  dispose(): void;
}

function createPingPong(width: number, height: number): PingPong {
  const options: THREE.RenderTargetOptions = {
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
    depthBuffer: false,
    stencilBuffer: false,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
  };
  const a = new THREE.WebGLRenderTarget(width, height, options);
  const b = new THREE.WebGLRenderTarget(width, height, options);
  return {
    read: a,
    write: b,
    swap() {
      const tmp = this.read;
      this.read = this.write;
      this.write = tmp;
    },
    dispose() {
      a.dispose();
      b.dispose();
    },
  };
}

export class FluidSim {
  readonly resolution: number;
  readonly aspect: number;

  private renderer: THREE.WebGLRenderer;
  private quad: FullScreenQuad;
  private density: PingPong;
  private velocity: PingPong;

  private splatMaterial: THREE.ShaderMaterial;

  constructor(renderer: THREE.WebGLRenderer, config: FluidSimConfig = {}) {
    const resolution = config.resolution ?? 256;
    this.resolution = resolution;
    this.aspect = 1;
    this.renderer = renderer;

    this.density = createPingPong(resolution, resolution);
    this.velocity = createPingPong(resolution, resolution);

    this.splatMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTarget: { value: null },
        uColor: { value: new THREE.Vector3() },
        uPoint: { value: new THREE.Vector2() },
        uRadius: { value: 0.0005 },
        uAspect: { value: this.aspect },
      },
      vertexShader: fullscreenVert,
      fragmentShader: splatFrag,
      depthTest: false,
      depthWrite: false,
    });

    this.quad = new FullScreenQuad();
  }

  get densityTexture(): THREE.Texture {
    return this.density.read.texture;
  }

  get velocityTexture(): THREE.Texture {
    return this.velocity.read.texture;
  }

  splat(
    point: THREE.Vector2,
    color: THREE.Color,
    velocity: THREE.Vector2,
    radius = 0.0005,
  ): void {
    const uniforms = this.splatMaterial.uniforms;
    uniforms.uPoint.value.copy(point);
    uniforms.uRadius.value = radius;
    uniforms.uAspect.value = this.aspect;

    uniforms.uTarget.value = this.density.read.texture;
    uniforms.uColor.value.set(color.r, color.g, color.b);
    this.runPass(this.splatMaterial, this.density.write);
    this.density.swap();

    uniforms.uTarget.value = this.velocity.read.texture;
    uniforms.uColor.value.set(velocity.x, velocity.y, 0);
    this.runPass(this.splatMaterial, this.velocity.write);
    this.velocity.swap();
  }

  step(_dt: number): void {
    // Advection, pressure, etc. land in later milestones.
  }

  private runPass(
    material: THREE.ShaderMaterial,
    target: THREE.WebGLRenderTarget,
  ): void {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.clear();
    this.quad.render(this.renderer);
    this.renderer.setRenderTarget(null);
  }

  dispose(): void {
    this.density.dispose();
    this.velocity.dispose();
    this.splatMaterial.dispose();
    this.quad.dispose();
  }
}
