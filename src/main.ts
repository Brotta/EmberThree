import * as THREE from 'three';
import { FlipbookSprite } from './runtime';
import {
  generateMuzzleFlashAtlas,
  flashEnvelope,
  type MuzzleFlashAtlas,
} from './sim/muzzleFlash';

const container = document.getElementById('app') as HTMLDivElement;
const hud = document.getElementById('hud') as HTMLDivElement;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x0b0d10);
renderer.outputColorSpace = THREE.SRGBColorSpace;
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

const hemi = new THREE.HemisphereLight(0xffffff, 0x334455, 0.65);
scene.add(hemi);

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
    onComplete: () => cleanup(sprite),
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

function cleanup(sprite: FlipbookSprite): void {
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

window.addEventListener('click', fire);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    fire();
  }
});

let autoFireAt = performance.now() / 1000 + 0.6;
hud.textContent = 'EmberThree — Phase 2 · click or space to fire';

renderer.setAnimationLoop(() => {
  const now = performance.now() / 1000;

  if (now >= autoFireAt) {
    fire();
    autoFireAt = now + 0.9 + Math.random() * 0.4;
  }

  for (const entry of activeFlashes) {
    const t = Math.min((now - entry.startTime) / entry.duration, 1);
    entry.light.intensity = 18 * flashEnvelope(t);
  }

  renderer.render(scene, camera);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
