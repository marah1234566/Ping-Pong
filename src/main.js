import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildStands } from './scene/Stands.js';
import { buildPaddle } from './scene/Paddle.js';
import { PaddleController } from './physics/PaddleController.js';

import { PHYSICS }              from './constants.js';
import { BallState }            from './physics/BallState.js';
import { PhysicsEngine }        from './physics/PhysicsEngine.js';
import { TrajectoryVisualizer } from './utils/TrajectoryVisualizer.js';
import { buildLights }          from './scene/Lights.js';
import { buildFloor }           from './scene/Floor.js';
import { buildTable }           from './scene/Table.js';

// ════════════════════════════════════════════════════════════════
//  Renderer
// ════════════════════════════════════════════════════════════════
const container = document.getElementById('canvas-container');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
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
scene.fog = new THREE.Fog(0x0a0c0f, 40, 100);

const camera = new THREE.PerspectiveCamera(
  50,
  container.clientWidth / container.clientHeight,
  0.01,
  100
);
camera.position.set(-11, 6, 9);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, PHYSICS.tableH, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance   = 1;
controls.maxDistance   = 35;
controls.maxPolarAngle = Math.PI / 2 - 0.02;

// ════════════════════════════════════════════════════════════════
//  Build Environment
// ════════════════════════════════════════════════════════════════
const lights = buildLights(scene);
buildFloor(scene);
buildTable(scene);
buildStands(scene);

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

// ظل صناعي تحت الكرة
const blobMesh = new THREE.Mesh(
  new THREE.CircleGeometry(PHYSICS.r * 1.5, 16),
  new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.35, transparent: true })
);
blobMesh.rotation.x = -Math.PI / 2;
scene.add(blobMesh);

// ── المضارب المكبّرة ─────────────────────────────────────────────
const playerPaddle = buildPaddle(0xd64545); 
const botPaddle    = buildPaddle(0x3478c2); 
scene.add(playerPaddle);
scene.add(botPaddle);

const paddleController = new PaddleController(camera, renderer, PHYSICS.tableL / 2);

// ════════════════════════════════════════════════════════════════
//  Physics Engine Setup
// ════════════════════════════════════════════════════════════════
const ballState  = new BallState();
const physics    = new PhysicsEngine(ballState);
const trajectory = new TrajectoryVisualizer(scene);

let spinType = 'topspin';

const LAUNCH_X = -PHYSICS.tableL / 2 + 0.1;
const LAUNCH_Y = PHYSICS.tableH + PHYSICS.tableThickness + 0.08;
const LAUNCH_Z = 0;

function setLaunchPosition() {
  ballState.pos.set(LAUNCH_X, LAUNCH_Y, LAUNCH_Z);
  ballState.bounces = 0;
  ballState.stopped = false;
}
// ── تعديل دالة الإطلاق لتخرج الكرة مباشرة من المضرب 🚀 ────────────────
// ── دالة إطلاق الكرة الصحيحة والمثبتة هندسياً لتخرج من جهة اللاعب 🚀 ────────────────
// ── دالة الإطلاق الاحترافية: الكرة تنطلق من المضرب وبتأثير ضربته تماماً 🚀 ──
function launchBall() {
  // 1. قراءة قيم السرعة والزاوية من الـ Sliders
  const v0Input = document.getElementById('v0');
  const thetaInput = document.getElementById('theta');
  const v0 = v0Input ? parseFloat(v0Input.value) : 7.5; // السرعة الابتدائية للضربة
  const theta = thetaInput ? (parseFloat(thetaInput.value) * Math.PI / 180) : (12 * Math.PI / 180);

  // 2. مطابقة موقع انطلاق الكرة مع مركز المضرب الأحمر (اللاعب) تماماً
  ballState.pos.copy(paddleController.playerPos);
  
  // إزاحة طفيفة أمام المضرب مباشرة (باتجاه محور X السالب) حتى لا تخرج من خلفه
  ballState.pos.x -= 0.25; 
  ballState.pos.y += 0.1; 

  // 3. الحل السحري: حساب اتجاه الدفع بناءً على زاوية وميلان المضرب الحالي (Normal Vector)
  // ننشئ متجه متجه للأمام الافتراضي
  const forwardVector = new THREE.Vector3(-Math.cos(theta), Math.sin(theta), 0);
  
  // نقوم بتدوير متجه الانطلاق بنفس زوايا دوران المضرب الحالية تماماً لتعكس الضربة وجه المضرب!
  forwardVector.applyAxisAngle(new THREE.Vector3(1, 0, 0), playerPaddle.rotation.x);
  forwardVector.applyAxisAngle(new THREE.Vector3(0, 0, 1), playerPaddle.rotation.z);
  forwardVector.normalize();

  // 4. تعيين السرعة النهائية للكرة بناءً على المتجه المائل للمضرب وقوة الدفع
  ballState.vel.copy(forwardVector).multiplyScalar(v0);

  // 5. تصفير المتغيرات وتشغيل الحركة والدوران الفيزيائي المختار (Top/Back/Side)
  ballState.omega.set(0, 0, 0); 
  ballState.bounces = 0;
  ballState.stopped = false;

  // تطبيق الدوران الميكانيكي ومسار خط الرسم المحدث
  physics.applyBallSpin(spinType);
  trajectory.clear();
}
launchBall();

// ════════════════════════════════════════════════════════════════
//  🎮 UI Controls & Sliders
// ════════════════════════════════════════════════════════════════
const ballSizeSlider = document.getElementById('ball-size');
const ballSizeVal    = document.getElementById('ball-size-val');

if (ballSizeSlider && ballSizeVal) {
  ballSizeSlider.addEventListener('input', () => {
    const scale = parseFloat(ballSizeSlider.value);
    ballSizeVal.textContent = scale.toFixed(1);
    currentRadius = PHYSICS.r * scale;
    ballMesh.scale.setScalar(currentRadius);
  });
}

const pushForceSlider = document.getElementById('push-force');
const pushValEl       = document.getElementById('push-val');

if (pushForceSlider && pushValEl) {
  pushForceSlider.addEventListener('input', () => {
    pushValEl.textContent = pushForceSlider.value;
  });
}

function getPushForce() {
  return pushForceSlider ? parseFloat(pushForceSlider.value) : 1.0;
}

function pushBall(direction) {
  ballState.stopped = false;
  ballState.vel.addScaledVector(direction, getPushForce());
}

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

document.getElementById('btn-stop')?.addEventListener('click', () => {
  ballState.vel.set(0, 0, 0);
  ballState.omega.set(0, 0, 0);
  ballState.stopped = true;
});

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

['v0', 'theta', 'omegaSlider'].forEach(id => {
  const input = document.getElementById(id);
  const label = id === 'omegaSlider' ? 'omega-val' : id + '-val';
  const valEl = document.getElementById(label);
  if (input && valEl) input.addEventListener('input', () => { valEl.textContent = input.value; });
});

const spinSelect = document.getElementById('spinSelect');
if (spinSelect) {
  spinSelect.addEventListener('change', (e) => {
    spinType = e.target.value;
  });
}

document.getElementById('launch-btn')?.addEventListener('click', launchBall);

// ════════════════════════════════════════════════════════════════
//  Animation Loop
// ════════════════════════════════════════════════════════════════
let lastTime = null;

function animate(timestamp) {
  requestAnimationFrame(animate);

  if (lastTime === null) lastTime = timestamp;
  const dt = Math.min((timestamp - lastTime) / 1000, 0.033);
  lastTime = timestamp;

  // الحسابات الفيزيائية للكرة
  const subSteps = 4;
  for (let i = 0; i < subSteps; i++) {
    physics.step(dt / subSteps);
  }

  // ── 1. فحص دالات الـ Controller بأمان لمنع الشاشة السوداء ──────────────────
  try {
    if (typeof paddleController.update === 'function') {
      paddleController.update(dt);
    }
    if (typeof paddleController.updateBot === 'function') {
      paddleController.updateBot(dt, ballState.pos);
    } else if (typeof paddleController._updateBot === 'function') {
      paddleController._updateBot(dt, ballState.pos);
    }
  } catch (err) {
    console.error("Controller update error:", err);
  }

  // ── 2. حساب زوايا الدوران المطلوبة للمضارب بناءً على الـ Spin ──────────────────
  let targetTiltX = 0;
  let targetTiltZ = 0;
  let botTiltX = 0;
  let botTiltZ = 0;

  switch (spinType) {
    case 'topspin':
      targetTiltX = -Math.PI / 6; 
      botTiltX = Math.PI / 6;
      break;
    case 'backspin':
      targetTiltX = Math.PI / 6;  
      botTiltX = -Math.PI / 6;
      break;
    case 'sidespin':
      targetTiltZ = -Math.PI / 8;
      botTiltZ = Math.PI / 8;
      break;
    default:
      targetTiltX = 0;
      targetTiltZ = 0;
      break;
  }

  const motionTiltZ = THREE.MathUtils.clamp(paddleController.playerVel.z * 0.03, -0.2, 0.2);
  const finalPlayerTiltZ = targetTiltZ + motionTiltZ;

  // تطبيق التدوير الانسيابي والناعم
  playerPaddle.rotation.x = THREE.MathUtils.lerp(playerPaddle.rotation.x, targetTiltX, 0.15);
  playerPaddle.rotation.z = THREE.MathUtils.lerp(playerPaddle.rotation.z, finalPlayerTiltZ, 0.15);
  playerPaddle.rotation.y = 0;

  botPaddle.rotation.x = THREE.MathUtils.lerp(botPaddle.rotation.x, botTiltX, 0.15);
  botPaddle.rotation.z = THREE.MathUtils.lerp(botPaddle.rotation.z, botTiltZ, 0.15);
  botPaddle.rotation.y = 0;

  // ── 3. الارتفاع الوقائي الديناميكي بصرياً فقط لمنع الغوص ──────────────────
  const tableSurfaceY = PHYSICS.tableH + PHYSICS.tableThickness;
  const totalPaddleExtent = 0.57; 

  const playerOffsetDueToTilt = Math.max(Math.abs(Math.sin(playerPaddle.rotation.x)), Math.abs(Math.sin(playerPaddle.rotation.z))) * totalPaddleExtent;
  const botOffsetDueToTilt = Math.max(Math.abs(Math.sin(botPaddle.rotation.x)), Math.abs(Math.sin(botPaddle.rotation.z))) * totalPaddleExtent;

  // المظهر البصري يتحرك فوق الطاولة مباشرة دون غوص
  playerPaddle.position.copy(paddleController.playerPos);
  playerPaddle.position.y = tableSurfaceY + playerOffsetDueToTilt;

  botPaddle.position.copy(paddleController.botPos);
  botPaddle.position.y = tableSurfaceY + botOffsetDueToTilt;

  // ── 4. الحل السحري للتصادم الدقيق 🎯 ──────────────────
  // ننشئ نقاط فحص فيزيائية ثابتة الارتفاع على نفس مستوى الكرة تماماً لضمان الاصطدام بنسبة 100%
 // ── 4. الحل السحري والتلقائي للتصادم الدقيق 🎯 ──────────────────
  // نحدد الارتفاع الثابت للفحص الفيزيائي ليتناسب مع مستوى مسار الكرة فوق الطاولة
  const checkY = tableSurfaceY + currentRadius;

  const playerHitCheckPos = new THREE.Vector3(paddleController.playerPos.x, checkY, paddleController.playerPos.z);
  const botHitCheckPos    = new THREE.Vector3(paddleController.botPos.x,    checkY, paddleController.botPos.z);

  // حساب المسافة الهندسية المباشرة بين الكرة والمضارب
  const distToPlayer = ballState.pos.distanceTo(playerHitCheckPos);
  const distToBot    = ballState.pos.distanceTo(botHitCheckPos);

  // نصف قطر الفحص الموسّع لضمان التقاط الكرة (حجم الكرة + حجم المضرب المكبّر تقريباً)
  const hitThreshold = 0.95; 

  // أ) فحص تصادم مضرب اللاعب (الأحمر)
  // إذا اقتربت الكرة من المضرب ضمن النطاق، يتم تفعيل الضرب تلقائياً لضمان عدم مرورها
  const playerWantsHit = paddleController.consumePlayerHitIntent() || (distToPlayer < hitThreshold);
  if (distToPlayer < hitThreshold || (Math.abs(ballState.pos.x - playerHitCheckPos.x) < 0.4 && Math.abs(ballState.pos.z - playerHitCheckPos.z) < 0.6)) {
    physics.checkPaddleHit(playerHitCheckPos, paddleController.playerVel, true);
  } else {
    physics.checkPaddleHit(playerHitCheckPos, paddleController.playerVel, playerWantsHit);
  }

  // ب) فحص تصادم مضرب البوت (الأزرق)
  // تفعيل التصادم التلقائي للبوت بمجرد اقتراب الكرة من حيز المضرب الخاص به
  const botShouldHit = paddleController.shouldBotHit(ballState.pos) || (distToBot < hitThreshold);
  if (distToBot < hitThreshold || (Math.abs(ballState.pos.x - botHitCheckPos.x) < 0.4 && Math.abs(ballState.pos.z - botHitCheckPos.z) < 0.6)) {
    physics.checkPaddleHit(botHitCheckPos, paddleController.botVel, true);
  } else {
    physics.checkPaddleHit(botHitCheckPos, paddleController.botVel, botShouldHit);
  }
  // ── تحديث مظهر الكرة والظل ومسار الحركة ─────────────────────────
  ballMesh.position.copy(ballState.pos);

  const spinAxis  = ballState.omega.clone().normalize();
  const spinAngle = ballState.omega.length() * dt;
  if (spinAngle > 0.0001) {
    ballMesh.rotateOnWorldAxis(spinAxis, spinAngle);
  }

  trajectory.addPoint(ballState.pos);

  const surfaceY  = ballState.pos.y > PHYSICS.tableH + 0.05 ? PHYSICS.tableH + 0.033 : 0.002;
  const distSurf  = ballState.pos.y - surfaceY;
  const blobScale = Math.max(0.2, 1.0 - distSurf * 0.6);
  blobMesh.position.set(ballState.pos.x, surfaceY, ballState.pos.z);
  blobMesh.scale.setScalar(blobScale * currentRadius / PHYSICS.r);

  // تحديث الإضاءة
  if (lights) {
    const cameraDistance = camera.position.distanceTo(controls.target);
    const lightMultiplier = Math.max(1.0, cameraDistance * 0.07);
    if (lights.ambient)   lights.ambient.intensity   = 1.2 * lightMultiplier;
    if (lights.dirLight)  lights.dirLight.intensity  = 2.5 * lightMultiplier;
    if (lights.fillLight) lights.fillLight.intensity = 0.5 * lightMultiplier;
  }

  // تحديث واجهة المستخدم الإحصائية
  const speedEl = document.getElementById('s-speed');
  const heightEl = document.getElementById('s-height');
  const omegaEl = document.getElementById('s-omega');
  const bouncesEl = document.getElementById('s-bounces');

  if (speedEl) speedEl.textContent = ballState.vel.length().toFixed(2);
  if (heightEl) heightEl.textContent = Math.max(0, ballState.pos.y - PHYSICS.tableH).toFixed(3);
  if (omegaEl) omegaEl.textContent = ballState.omega.length().toFixed(1);
  if (bouncesEl) bouncesEl.textContent = ballState.bounces;

  controls.update();
  renderer.render(scene, camera);
}

requestAnimationFrame(animate);

// ════════════════════════════════════════════════════════════════
//  Resize Event
// ════════════════════════════════════════════════════════════════
window.addEventListener('resize', () => {
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});