import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import GUI from 'lil-gui';
import { FlipbookSprite } from './runtime';
import {
  generateMuzzleFlashAtlas,
  flashEnvelope,
  type MuzzleFlashAtlas,
} from './sim/muzzleFlash';
import { FluidSim } from './sim/FluidSim';
import {
  bakeFlipbook,
  downloadFlipbook,
  type BakedFlipbook,
} from './export/bakeFlipbook';

const container = document.getElementById('app') as HTMLDivElement;
const hud = document.getElementById('hud') as HTMLDivElement;
const previewFrame = document.getElementById('preview-frame') as HTMLDivElement;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x0b0d10);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.set(2.2, 1.6, 2.8);
camera.lookAt(0, 0.8, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 0.65));
const dir = new THREE.DirectionalLight(0xffffff, 1.0);
dir.position.set(3, 5, 2);
scene.add(dir);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(8, 8),
  new THREE.MeshStandardMaterial({ color: 0x1a1d21, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const gun = buildGun();
gun.position.set(-0.4, 0.8, 0);
scene.add(gun);
const barrelTip = new THREE.Vector3(0.55, 0.8, 0);

const atlasPool: MuzzleFlashAtlas[] = [1, 2, 3, 7, 42].map((seed) =>
  generateMuzzleFlashAtlas({ seed }),
);

interface ActiveFlash {
  sprite: FlipbookSprite;
  light: THREE.PointLight;
  startTime: number;
  duration: number;
}
const activeFlashes: ActiveFlash[] = [];

function fire(): void {
  const atlas = atlasPool[Math.floor(Math.random() * atlasPool.length)];
  const duration = atlas.frameCount / atlas.fps;
  const sprite = new FlipbookSprite({
    texture: atlas.texture,
    cols: atlas.cols,
    rows: atlas.rows,
    frameCount: atlas.frameCount,
    fps: atlas.fps,
    loop: false,
    size: 0.9,
    blending: THREE.AdditiveBlending,
    onComplete: () => cleanupFlash(sprite),
  });
  sprite.position.copy(barrelTip);
  scene.add(sprite);

  const light = new THREE.PointLight(0xffaa55, 0, 5, 1.8);
  light.position.copy(barrelTip);
  scene.add(light);

  activeFlashes.push({
    sprite,
    light,
    startTime: performance.now() / 1000,
    duration,
  });
}

function cleanupFlash(sprite: FlipbookSprite): void {
  const idx = activeFlashes.findIndex((a) => a.sprite === sprite);
  if (idx < 0) return;
  const entry = activeFlashes[idx];
  scene.remove(entry.sprite);
  scene.remove(entry.light);
  entry.sprite.dispose();
  activeFlashes.splice(idx, 1);
}

function buildGun(): THREE.Group {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x2a2e35,
    metalness: 0.6,
    roughness: 0.4,
  });
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.7, 20),
    bodyMat,
  );
  barrel.rotation.z = Math.PI / 2;
  barrel.position.x = 0.35;
  group.add(barrel);

  const receiver = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.16, 0.12),
    bodyMat,
  );
  receiver.position.x = 0.02;
  group.add(receiver);

  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.22, 0.1),
    bodyMat,
  );
  grip.position.set(-0.04, -0.17, 0);
  grip.rotation.z = -0.3;
  group.add(grip);

  return group;
}

const fluid = new FluidSim(renderer, {
  resolution: 256,
  velocityDissipation: 0.2,
  densityDissipation: 1.0,
  pressureIterations: 20,
  buoyancy: 0,
});

const previewQuad = new FullScreenQuad(
  new THREE.MeshBasicMaterial({ map: fluid.densityTexture, toneMapped: false }),
);

window.addEventListener('click', (e) => {
  if (!isEventInsidePreview(e)) fire();
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    fire();
  }
});

const params = {
  autoFire: true,
  fireInterval: 1.0,
  emitDye: true,
  splatRadius: 0.00016,
  splatSpeed: 600,
  velocityDissipation: 0.2,
  densityDissipation: 1.0,
  pressureIterations: 20,
  buoyancy: 0,
  smokeMode: false,
  bakeCols: 8,
  bakeRows: 8,
  bakeCellSize: 128,
  bakeFps: 30,
  bakeDownload: true,
  clearSim: () => fluid.clear(),
  dyePreset: () => applyDyePreset(),
  smokePreset: () => applySmokePreset(),
  bake: () => void bakeAndSpawn(),
};

function applyDyePreset(): void {
  params.emitDye = true;
  params.splatRadius = 0.00016;
  params.splatSpeed = 600;
  params.velocityDissipation = 0.2;
  params.densityDissipation = 1.0;
  params.buoyancy = 0;
  params.smokeMode = false;
  syncSimParams();
  gui.controllers.forEach((c) => c.updateDisplay());
  simFolder.controllers.forEach((c) => c.updateDisplay());
}

function applySmokePreset(): void {
  params.emitDye = true;
  params.splatRadius = 0.00045;
  params.splatSpeed = 120;
  params.velocityDissipation = 0.08;
  params.densityDissipation = 0.4;
  params.buoyancy = 35;
  params.smokeMode = true;
  syncSimParams();
  gui.controllers.forEach((c) => c.updateDisplay());
  simFolder.controllers.forEach((c) => c.updateDisplay());
}

function syncSimParams(): void {
  fluid.velocityDissipation = params.velocityDissipation;
  fluid.densityDissipation = params.densityDissipation;
  fluid.pressureIterations = params.pressureIterations;
  fluid.buoyancy = params.buoyancy;
}

const splatColorTarget = new THREE.Color();
const splatPoint = new THREE.Vector2(0.5, 0.12);
const splatVelocity = new THREE.Vector2();

const gui = new GUI({ title: 'EmberThree' });
const fxFolder = gui.addFolder('Muzzle flash');
fxFolder.add(params, 'autoFire').name('auto-fire');
fxFolder.add(params, 'fireInterval', 0.15, 3, 0.05).name('interval (s)');

const simFolder = gui.addFolder('Fluid sim');
simFolder.add(params, 'emitDye').name('emit dye');
simFolder.add(params, 'splatRadius', 0.00005, 0.001, 0.00001).name('splat radius');
simFolder.add(params, 'splatSpeed', 0, 2000, 10).name('splat speed');
simFolder
  .add(params, 'velocityDissipation', 0, 4, 0.05)
  .name('vel dissipation')
  .onChange((v: number) => {
    fluid.velocityDissipation = v;
  });
simFolder
  .add(params, 'densityDissipation', 0, 4, 0.05)
  .name('dye dissipation')
  .onChange((v: number) => {
    fluid.densityDissipation = v;
  });
simFolder
  .add(params, 'pressureIterations', 0, 60, 1)
  .name('pressure iter')
  .onChange((v: number) => {
    fluid.pressureIterations = v;
  });
simFolder
  .add(params, 'buoyancy', 0, 80, 1)
  .name('buoyancy')
  .onChange((v: number) => {
    fluid.buoyancy = v;
  });
simFolder.add(params, 'dyePreset').name('preset: dye');
simFolder.add(params, 'smokePreset').name('preset: smoke');
simFolder.add(params, 'clearSim').name('clear sim');

const bakeFolder = gui.addFolder('Bake');
bakeFolder.add(params, 'bakeCols', [4, 6, 8, 10]).name('cols');
bakeFolder.add(params, 'bakeRows', [4, 6, 8, 10]).name('rows');
bakeFolder.add(params, 'bakeCellSize', [64, 96, 128, 192, 256]).name('cell size');
bakeFolder.add(params, 'bakeFps', 6, 60, 1).name('playback fps');
bakeFolder.add(params, 'bakeDownload').name('download PNG+JSON');
const bakeButton = bakeFolder.add(params, 'bake').name('bake flipbook');

let autoFireAt = performance.now() / 1000 + params.fireInterval;
let prevSimTime: number | null = null;
let baking = false;
let bakedSprite: FlipbookSprite | null = null;
hud.textContent = 'EmberThree — Phase 3 · click scene to fire · space to fire';

function simEmit(now: number): void {
  if (!params.emitDye) return;
  if (params.smokeMode) {
    splatColorTarget.setRGB(0.9, 0.9, 0.92);
    splatVelocity.set(Math.sin(now * 0.7) * 40, params.splatSpeed);
  } else {
    const hue = (now * 0.1) % 1;
    splatColorTarget.setHSL(hue, 0.9, 0.55);
    splatVelocity.set(Math.sin(now * 1.5) * 120, params.splatSpeed);
  }
  fluid.splat(splatPoint, splatColorTarget, splatVelocity, params.splatRadius);
}

async function bakeAndSpawn(): Promise<void> {
  if (baking) return;
  baking = true;
  bakeButton.disable();
  hud.textContent = 'Baking flipbook… 0%';
  fluid.clear();
  let simClock = 0;
  try {
    const baked = await bakeFlipbook(
      renderer,
      () => fluid.densityTexture,
      (dt) => {
        simClock += dt;
        simEmit(simClock);
        fluid.step(dt);
      },
      {
        cols: params.bakeCols,
        rows: params.bakeRows,
        cellSize: params.bakeCellSize,
        fps: params.bakeFps,
        onProgress: (frame, total) => {
          hud.textContent = `Baking flipbook… ${Math.round((frame / total) * 100)}%`;
        },
      },
    );
    spawnBakedSprite(baked);
    if (params.bakeDownload) {
      downloadFlipbook(baked, `emberthree-${params.smokeMode ? 'smoke' : 'dye'}`);
    }
    hud.textContent = 'Baked · ready for playback in scene';
  } finally {
    baking = false;
    bakeButton.enable();
  }
}

function spawnBakedSprite(baked: BakedFlipbook): void {
  if (bakedSprite) {
    scene.remove(bakedSprite);
    bakedSprite.dispose();
  }
  bakedSprite = new FlipbookSprite({
    texture: baked.texture,
    cols: baked.cols,
    rows: baked.rows,
    frameCount: baked.frameCount,
    fps: baked.fps,
    size: 1.8,
    loop: true,
    blending: THREE.NormalBlending,
  });
  bakedSprite.position.set(1.6, 1.0, -0.3);
  scene.add(bakedSprite);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setAnimationLoop(() => {
  const now = performance.now() / 1000;
  const dt = prevSimTime === null ? 1 / 60 : Math.min(now - prevSimTime, 1 / 30);
  prevSimTime = now;

  if (params.autoFire && now >= autoFireAt) {
    fire();
    autoFireAt = now + params.fireInterval;
  }

  for (const entry of activeFlashes) {
    const t = Math.min((now - entry.startTime) / entry.duration, 1);
    entry.light.intensity = 18 * flashEnvelope(t);
  }

  if (!baking) {
    simEmit(now);
    fluid.step(dt);
  }

  renderer.setScissorTest(false);
  renderer.setViewport(
    0,
    0,
    renderer.domElement.width,
    renderer.domElement.height,
  );
  renderer.clear();
  renderer.render(scene, camera);

  renderPreview();
});

function renderPreview(): void {
  const dpr = renderer.getPixelRatio();
  const rect = previewFrame.getBoundingClientRect();
  const canvasH = renderer.domElement.height;
  const x = rect.left * dpr;
  const y = canvasH - (rect.top + rect.height) * dpr;
  const w = rect.width * dpr;
  const h = rect.height * dpr;

  renderer.setScissorTest(true);
  renderer.setScissor(x, y, w, h);
  renderer.setViewport(x, y, w, h);
  (previewQuad.material as THREE.MeshBasicMaterial).map = fluid.densityTexture;
  previewQuad.render(renderer);
  renderer.setScissorTest(false);
}

function isEventInsidePreview(e: MouseEvent): boolean {
  const rect = previewFrame.getBoundingClientRect();
  return (
    e.clientX >= rect.left &&
    e.clientX <= rect.right &&
    e.clientY >= rect.top &&
    e.clientY <= rect.bottom
  );
}

interface DragState {
  x: number;
  y: number;
  t: number;
}
let dragging: DragState | null = null;
const dragColor = new THREE.Color();
const dragPoint = new THREE.Vector2();
const dragVelocity = new THREE.Vector2();

previewFrame.style.cursor = 'crosshair';
previewFrame.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  (e.target as Element).setPointerCapture(e.pointerId);
  const rect = previewFrame.getBoundingClientRect();
  dragging = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
    t: performance.now() / 1000,
  };
  dragColor.setHSL(Math.random(), 0.9, 0.55);
});

previewFrame.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const rect = previewFrame.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const t = performance.now() / 1000;
  const dt = Math.max(t - dragging.t, 1 / 120);

  dragPoint.set(x / rect.width, 1 - y / rect.height);
  dragVelocity.set(
    ((x - dragging.x) / dt) * 3,
    (-(y - dragging.y) / dt) * 3,
  );
  fluid.splat(dragPoint, dragColor, dragVelocity, params.splatRadius * 3);

  dragging = { x, y, t };
});

const endDrag = (): void => {
  dragging = null;
};
previewFrame.addEventListener('pointerup', endDrag);
previewFrame.addEventListener('pointercancel', endDrag);
previewFrame.addEventListener('pointerleave', endDrag);
