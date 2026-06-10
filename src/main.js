import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { PHYSICS }              from './constants.js';
import { BallState }            from './physics/BallState.js';
import { PhysicsEngine }        from './physics/PhysicsEngine.js';
import { TrajectoryVisualizer } from './utils/TrajectoryVisualizer.js';
import { buildLights }          from './scene/Lights.js';
import { buildFloor }           from './scene/Floor.js';
import { buildTable }           from './scene/Table.js';

// ════════════════════════════════════════════════════════════════
//  Renderer — يأخذ حجم الـ container مش الـ window
// ════════════════════════════════════════════════════════════════
const container = document.getElementById('canvas-container');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight); // ← تعديل
renderer.shadowMap.enabled   = true;
renderer.shadowMap.type      = THREE.PCFSoftShadowMap;
renderer.toneMapping         = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
container.appendChild(renderer.domElement);

// ════════════════════════════════════════════════════════════════
//  Scene & Camera
// ════════════════════════════════════════════════════════════════
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0c0f);
scene.fog        = new THREE.FogExp2(0x0a0c0f, 0.05);

const camera = new THREE.PerspectiveCamera(
  50,
  container.clientWidth / container.clientHeight, // ← تعديل
  0.01,
  100
);
camera.position.set(-3.5, 2.2, 3.0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, PHYSICS.tableH, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance   = 1;
controls.maxDistance   = 12;
controls.maxPolarAngle = Math.PI / 2 - 0.02;

// ════════════════════════════════════════════════════════════════
//  Build Scene
// ════════════════════════════════════════════════════════════════
buildLights(scene);
buildFloor(scene);
buildTable(scene);

// ════════════════════════════════════════════════════════════════
//  Ball Mesh
// ════════════════════════════════════════════════════════════════
let currentRadius = PHYSICS.r;

const ballGeo  = new THREE.SphereGeometry(1, 32, 32);
const ballMat  = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.3 });
const ballMesh = new THREE.Mesh(ballGeo, ballMat);
ballMesh.castShadow = true;
ballMesh.scale.setScalar(PHYSICS.r);
scene.add(ballMesh);

// ظل صناعي
const blobMesh = new THREE.Mesh(
  new THREE.CircleGeometry(PHYSICS.r * 1.5, 16),
  new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.35, transparent: true })
);
blobMesh.rotation.x = -Math.PI / 2;
scene.add(blobMesh);

// ════════════════════════════════════════════════════════════════
//  Physics
// ════════════════════════════════════════════════════════════════
const ballState  = new BallState();
const physics    = new PhysicsEngine(ballState);
const trajectory = new TrajectoryVisualizer(scene);

let spinType = 'topspin';

function launchBall() {
  const v0    = parseFloat(document.getElementById('v0').value);
  const theta = parseFloat(document.getElementById('theta').value);
  const omega = parseFloat(document.getElementById('omegaSlider').value);
  ballState.reset(v0, theta, spinType, omega);
  trajectory.clear();
}

launchBall();

// ════════════════════════════════════════════════════════════════
//  🎮 MANUAL CONTROLLER
// ════════════════════════════════════════════════════════════════

// ── حجم الكرة ─────────────────────────────────────────────────
const ballSizeSlider = document.getElementById('ball-size');
const ballSizeVal    = document.getElementById('ball-size-val');

ballSizeSlider.addEventListener('input', () => {
  const scale = parseFloat(ballSizeSlider.value);
  ballSizeVal.textContent = scale.toFixed(1);
  currentRadius = PHYSICS.r * scale;
  ballMesh.scale.setScalar(currentRadius);
});

// ── قوة الدفع ─────────────────────────────────────────────────
const pushForceSlider = document.getElementById('push-force');
const pushValEl       = document.getElementById('push-val');

pushForceSlider.addEventListener('input', () => {
  pushValEl.textContent = pushForceSlider.value;
});

function getPushForce() {
  return parseFloat(pushForceSlider.value);
}

function pushBall(direction) {
  ballState.stopped = false;
  ballState.vel.addScaledVector(direction, getPushForce());
}

// ── أزرار الاتجاه ─────────────────────────────────────────────
const dirMap = {
  'btn-forward':  new THREE.Vector3( 1,    0,    0),
  'btn-backward': new THREE.Vector3(-1,    0,    0),
  'btn-left':     new THREE.Vector3( 0,    0,   -1),
  'btn-right':    new THREE.Vector3( 0,    0,    1),
  'btn-up':       new THREE.Vector3( 0,    1,    0),
  'btn-down':     new THREE.Vector3( 0,   -0.5,  0),
};

Object.entries(dirMap).forEach(([id, dir]) => {
  const btn = document.getElementById(id);
  if (!btn) return;

  let interval = null;

  const startPush = () => {
    pushBall(dir);
    interval = setInterval(() => pushBall(dir), 100);
  };
  const stopPush = () => {
    clearInterval(interval);
    interval = null;
  };

  btn.addEventListener('mousedown',  startPush);
  btn.addEventListener('mouseup',    stopPush);
  btn.addEventListener('mouseleave', stopPush);
  btn.addEventListener('touchstart', (e) => { e.preventDefault(); startPush(); });
  btn.addEventListener('touchend',   stopPush);
});

// ── زر الإيقاف ────────────────────────────────────────────────
document.getElementById('btn-stop')?.addEventListener('click', () => {
  ballState.vel.set(0, 0, 0);
  ballState.omega.set(0, 0, 0);
  ballState.stopped = true;
});

// ── لوحة المفاتيح ─────────────────────────────────────────────
const keysHeld = new Set();

window.addEventListener('keydown', (e) => {
  if (keysHeld.has(e.code)) return;
  keysHeld.add(e.code);

  const keyMap = {
    'ArrowUp':    new THREE.Vector3( 1,    0,    0),
    'ArrowDown':  new THREE.Vector3(-1,    0,    0),
    'ArrowLeft':  new THREE.Vector3( 0,    0,   -1),
    'ArrowRight': new THREE.Vector3( 0,    0,    1),
    'Space':      new THREE.Vector3( 0,    1,    0),
    'ShiftLeft':  new THREE.Vector3( 0,   -0.5,  0),
  };

  if (keyMap[e.code]) {
    e.preventDefault();
    pushBall(keyMap[e.code]);
  }

  if (e.code === 'KeyS') {
    ballState.vel.set(0, 0, 0);
    ballState.omega.set(0, 0, 0);
    ballState.stopped = true;
  }
});

window.addEventListener('keyup', (e) => keysHeld.delete(e.code));

// ════════════════════════════════════════════════════════════════
//  UI — Sliders & Spin Buttons
// ════════════════════════════════════════════════════════════════
['v0', 'theta', 'omegaSlider'].forEach(id => {
  const input = document.getElementById(id);
  const label = id === 'omegaSlider' ? 'omega-val' : id + '-val';
  const valEl = document.getElementById(label);
  if (input && valEl) input.addEventListener('input', () => { valEl.textContent = input.value; });
});

document.querySelectorAll('.spin-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.spin-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    spinType = btn.dataset.spin;
  });
});

document.getElementById('launch-btn').addEventListener('click', launchBall);

// ════════════════════════════════════════════════════════════════
//  Animation Loop
// ════════════════════════════════════════════════════════════════
let lastTime = null;

function animate(timestamp) {
  requestAnimationFrame(animate);

  if (lastTime === null) lastTime = timestamp;
  const dt = Math.min((timestamp - lastTime) / 1000, 0.033);
  lastTime = timestamp;

  // Sub-stepping
  const subSteps = 4;
  for (let i = 0; i < subSteps; i++) {
    physics.step(dt / subSteps);
  }

  // تحديث موقع الكرة
  ballMesh.position.copy(ballState.pos);

  // تدوير الكرة
  const spinAxis  = ballState.omega.clone().normalize();
  const spinAngle = ballState.omega.length() * dt;
  if (spinAngle > 0.0001) {
    ballMesh.rotateOnWorldAxis(spinAxis, spinAngle);
  }

  // مسار الحركة
  trajectory.addPoint(ballState.pos);

  // الظل الصناعي
  const surfaceY  = ballState.pos.y > PHYSICS.tableH + 0.05
    ? PHYSICS.tableH + 0.033
    : 0.002;
  const distSurf  = ballState.pos.y - surfaceY;
  const blobScale = Math.max(0.2, 1.0 - distSurf * 0.6);
  blobMesh.position.set(ballState.pos.x, surfaceY, ballState.pos.z);
  blobMesh.scale.setScalar(blobScale * currentRadius / PHYSICS.r);

  // الإحصاءات
  document.getElementById('s-speed').textContent   = ballState.vel.length().toFixed(2);
  document.getElementById('s-height').textContent  = Math.max(0, ballState.pos.y - PHYSICS.tableH).toFixed(3);
  document.getElementById('s-omega').textContent   = ballState.omega.length().toFixed(1);
  document.getElementById('s-bounces').textContent = ballState.bounces;

  controls.update();
  renderer.render(scene, camera);
}

requestAnimationFrame(animate);

// ════════════════════════════════════════════════════════════════
//  Resize — يحترم حجم الـ container مش الـ window
// ════════════════════════════════════════════════════════════════
window.addEventListener('resize', () => {
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h); // ← تعديل
});