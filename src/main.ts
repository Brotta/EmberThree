import * as THREE from 'three';
import { FlipbookSprite, generateTestAtlas } from './runtime';

const container = document.getElementById('app') as HTMLDivElement;

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
camera.position.set(2.5, 2, 3.5);
camera.lookAt(0, 0.8, 0);

const hemi = new THREE.HemisphereLight(0xffffff, 0x334455, 0.8);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xffffff, 1.2);
dir.position.set(3, 5, 2);
scene.add(dir);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(6, 6),
  new THREE.MeshStandardMaterial({ color: 0x1a1d21, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const marker = new THREE.Mesh(
  new THREE.BoxGeometry(0.3, 0.3, 0.3),
  new THREE.MeshStandardMaterial({ color: 0xff5533 }),
);
marker.position.set(-1.2, 0.15, 0);
scene.add(marker);

const atlas = generateTestAtlas({ cols: 8, rows: 8, cellSize: 64 });
const flipbook = new FlipbookSprite({
  texture: atlas,
  cols: 8,
  rows: 8,
  fps: 24,
  size: 1.2,
});
flipbook.position.set(0.4, 0.8, 0);
scene.add(flipbook);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
});
