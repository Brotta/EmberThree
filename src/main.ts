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

const fluid = new FluidSim(renderer, { resolution: 256 });

seedInitialSplats(fluid);

function seedInitialSplats(sim: FluidSim): void {
  const palette = [0xff4422, 0x22aaff, 0xffcc33];
  for (let i = 0; i < 3; i++) {
    const color = new THREE.Color(palette[i]);
    const point = new THREE.Vector2(0.35 + i * 0.15, 0.5);
    const vel = new THREE.Vector2((i - 1) * 400, 0);
    sim.splat(point, color, vel, 0.0012);
  }
}

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
  simResolution: 256,
  reseedSim: () => {
    seedInitialSplats(fluid);
  },
};

const gui = new GUI({ title: 'EmberThree' });
const fxFolder = gui.addFolder('Muzzle flash');
fxFolder.add(params, 'autoFire').name('auto-fire');
fxFolder.add(params, 'fireInterval', 0.15, 3, 0.05).name('interval (s)');
const simFolder = gui.addFolder('Fluid sim');
simFolder.add(params, 'simResolution', [128, 256, 512]).name('resolution').disable();
simFolder.add(params, 'reseedSim').name('re-seed splats');

let autoFireAt = performance.now() / 1000 + params.fireInterval;
hud.textContent = 'EmberThree — Phase 3 · click scene to fire · space to fire';

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setAnimationLoop((_, __) => {
  const now = performance.now() / 1000;

  if (params.autoFire && now >= autoFireAt) {
    fire();
    autoFireAt = now + params.fireInterval;
  }

  for (const entry of activeFlashes) {
    const t = Math.min((now - entry.startTime) / entry.duration, 1);
    entry.light.intensity = 18 * flashEnvelope(t);
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
