import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import fullscreenVert from './shaders/fullscreen.vert.glsl?raw';
import splatFrag from './shaders/splat.frag.glsl?raw';
import advectionFrag from './shaders/advection.frag.glsl?raw';
import divergenceFrag from './shaders/divergence.frag.glsl?raw';
import pressureFrag from './shaders/pressure.frag.glsl?raw';
import gradientSubtractFrag from './shaders/gradientSubtract.frag.glsl?raw';
import buoyancyFrag from './shaders/buoyancy.frag.glsl?raw';

export interface FluidSimConfig {
  resolution?: number;
  velocityDissipation?: number;
  densityDissipation?: number;
  pressureIterations?: number;
  buoyancy?: number;
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

function createRenderTarget(
  width: number,
  height: number,
): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(width, height, {
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false,
    depthBuffer: false,
    stencilBuffer: false,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
  });
}

export class FluidSim {
  readonly resolution: number;
  readonly aspect: number;

  velocityDissipation: number;
  densityDissipation: number;
  pressureIterations: number;
  buoyancy: number;

  private renderer: THREE.WebGLRenderer;
  private quad: FullScreenQuad;

  private density: PingPong;
  private velocity: PingPong;
  private pressure: PingPong;
  private divergence: THREE.WebGLRenderTarget;

  private splatMaterial: THREE.ShaderMaterial;
  private advectionMaterial: THREE.ShaderMaterial;
  private divergenceMaterial: THREE.ShaderMaterial;
  private pressureMaterial: THREE.ShaderMaterial;
  private gradientSubtractMaterial: THREE.ShaderMaterial;
  private buoyancyMaterial: THREE.ShaderMaterial;

  constructor(renderer: THREE.WebGLRenderer, config: FluidSimConfig = {}) {
    const resolution = config.resolution ?? 256;
    this.resolution = resolution;
    this.aspect = 1;
    this.renderer = renderer;
    this.velocityDissipation = config.velocityDissipation ?? 0.2;
    this.densityDissipation = config.densityDissipation ?? 1.0;
    this.pressureIterations = config.pressureIterations ?? 20;
    this.buoyancy = config.buoyancy ?? 0;

    this.density = createPingPong(resolution, resolution);
    this.velocity = createPingPong(resolution, resolution);
    this.pressure = createPingPong(resolution, resolution);
    this.divergence = createRenderTarget(resolution, resolution);

    const texelSize = new THREE.Vector2(1 / resolution, 1 / resolution);

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

    this.advectionMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uVelocity: { value: null },
        uSource: { value: null },
        uTexelSize: { value: texelSize.clone() },
        uDt: { value: 0 },
        uDissipation: { value: 0 },
      },
      vertexShader: fullscreenVert,
      fragmentShader: advectionFrag,
      depthTest: false,
      depthWrite: false,
    });

    this.divergenceMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uVelocity: { value: null },
        uTexelSize: { value: texelSize.clone() },
      },
      vertexShader: fullscreenVert,
      fragmentShader: divergenceFrag,
      depthTest: false,
      depthWrite: false,
    });

    this.pressureMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uPressure: { value: null },
        uDivergence: { value: null },
        uTexelSize: { value: texelSize.clone() },
      },
      vertexShader: fullscreenVert,
      fragmentShader: pressureFrag,
      depthTest: false,
      depthWrite: false,
    });

    this.gradientSubtractMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uVelocity: { value: null },
        uPressure: { value: null },
        uTexelSize: { value: texelSize.clone() },
      },
      vertexShader: fullscreenVert,
      fragmentShader: gradientSubtractFrag,
      depthTest: false,
      depthWrite: false,
    });

    this.buoyancyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uVelocity: { value: null },
        uDensity: { value: null },
        uBuoyancy: { value: 0 },
        uDt: { value: 0 },
      },
      vertexShader: fullscreenVert,
      fragmentShader: buoyancyFrag,
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

  clear(): void {
    const prev = this.renderer.getRenderTarget();
    for (const rt of [
      this.density.read,
      this.density.write,
      this.velocity.read,
      this.velocity.write,
      this.pressure.read,
      this.pressure.write,
      this.divergence,
    ]) {
      this.renderer.setRenderTarget(rt);
      this.renderer.clear();
    }
    this.renderer.setRenderTarget(prev);
  }

  step(dt: number): void {
    const advU = this.advectionMaterial.uniforms;
    advU.uDt.value = dt;

    advU.uVelocity.value = this.velocity.read.texture;
    advU.uSource.value = this.velocity.read.texture;
    advU.uDissipation.value = this.velocityDissipation;
    this.runPass(this.advectionMaterial, this.velocity.write);
    this.velocity.swap();

    if (this.buoyancy !== 0) {
      const bu = this.buoyancyMaterial.uniforms;
      bu.uVelocity.value = this.velocity.read.texture;
      bu.uDensity.value = this.density.read.texture;
      bu.uBuoyancy.value = this.buoyancy;
      bu.uDt.value = dt;
      this.runPass(this.buoyancyMaterial, this.velocity.write);
      this.velocity.swap();
    }

    this.divergenceMaterial.uniforms.uVelocity.value =
      this.velocity.read.texture;
    this.runPass(this.divergenceMaterial, this.divergence);

    this.renderer.setRenderTarget(this.pressure.read);
    this.renderer.clear();

    this.pressureMaterial.uniforms.uDivergence.value = this.divergence.texture;
    for (let i = 0; i < this.pressureIterations; i++) {
      this.pressureMaterial.uniforms.uPressure.value =
        this.pressure.read.texture;
      this.runPass(this.pressureMaterial, this.pressure.write);
      this.pressure.swap();
    }

    const gsU = this.gradientSubtractMaterial.uniforms;
    gsU.uVelocity.value = this.velocity.read.texture;
    gsU.uPressure.value = this.pressure.read.texture;
    this.runPass(this.gradientSubtractMaterial, this.velocity.write);
    this.velocity.swap();

    advU.uVelocity.value = this.velocity.read.texture;
    advU.uSource.value = this.density.read.texture;
    advU.uDissipation.value = this.densityDissipation;
    this.runPass(this.advectionMaterial, this.density.write);
    this.density.swap();
  }

  private runPass(
    material: THREE.ShaderMaterial,
    target: THREE.WebGLRenderTarget,
  ): void {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.quad.render(this.renderer);
  }

  dispose(): void {
    this.density.dispose();
    this.velocity.dispose();
    this.pressure.dispose();
    this.divergence.dispose();
    this.splatMaterial.dispose();
    this.advectionMaterial.dispose();
    this.divergenceMaterial.dispose();
    this.pressureMaterial.dispose();
    this.gradientSubtractMaterial.dispose();
    this.buoyancyMaterial.dispose();
    this.quad.dispose();
  }
}
