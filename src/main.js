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

// متغيرات التحكم بأنيميشن الضربة المتزامنة والملتصقة تماماً بالقرص الأحمر
let isSwinging = false;      
let swingProgress = 0;      
let swingStartPosition = new THREE.Vector3(); 
let currentSwingOffset = 0;
let ballReleased = false; 
let savedLaunchVel = new THREE.Vector3(); 

const LAUNCH_X = -PHYSICS.tableL / 2 + 0.1;
const LAUNCH_Y = PHYSICS.tableH + PHYSICS.tableThickness + 0.08;
const LAUNCH_Z = 0;

function setLaunchPosition() {
  ballState.pos.set(LAUNCH_X, LAUNCH_Y, LAUNCH_Z);
  ballState.bounces = 0;
  ballState.stopped = false;
}

// ── دالة الإطلاق المحدثة هندسياً لتخرج من القرص الأحمر تماماً 🚀 ──
function launchBall() {
  const v0Input = document.getElementById('v0');
  const thetaInput = document.getElementById('theta');
  const v0 = v0Input ? parseFloat(v0Input.value) : 7.5;
  const theta = thetaInput ? (parseFloat(thetaInput.value) * Math.PI / 180) : (12 * Math.PI / 180);

  physics.justLaunched = false;

  // 1. حفظ موضع الماوس الحالي كموقع انطلاق للمضرب
  swingStartPosition.copy(paddleController.playerPos);
  
  // 2. حساب السرعة والاتجاه الفيزيائي المطلوب للكرة عند الانفصال
  const vx = -v0 * Math.cos(theta);
  const vy = v0 * Math.sin(theta);
  const vz = -paddleController.playerVel.z * 0.3;
  savedLaunchVel.set(vx, vy, vz);

  // 3. تصفير حركة الكرة وتجهيزها للالتصاق بوجه المضرب
  ballState.vel.set(0, 0, 0);
  ballState.omega.set(0, 0, 0);
  ballState.bounces = 0;
  ballState.stopped = false;
  
  isSwinging = true;
  swingProgress = 0;
  currentSwingOffset = 0;
  ballReleased = false;

  // تحديث مصفوفة التحويلات للمضرب فوراً لحساب النقطة المحلية بدقة
  playerPaddle.updateMatrixWorld();

  // 🔥 الحل الهندسي السحري: نحدد النقطة المحلية لمركز القرص الأحمر تماماً (0 للأمام، 0.45 للأعلى)
  // ونحولها إلى إحداثيات العالم الحقيقي لتوضع الكرة في سنتر الدائرة الحمراء بالملي
  const localCenter = new THREE.Vector3(0, 0.45, 0); 
  playerPaddle.localToWorld(localCenter);
  
  // نضع الكرة في هذا المركز العالمي للقرص مع إزاحة خفيفة جداً للأمام ليظهر الالتصاق البصري
  ballState.pos.copy(localCenter);
  ballState.pos.x -= 0.05; 

  trajectory.clear();
}

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

  // الحسابات الفيزيائية للكرة تعمل عند الانفصال
  if (!isSwinging || ballReleased) {
    const subSteps = 4;
    for (let i = 0; i < subSteps; i++) {
      physics.step(dt / subSteps);
    }
  }

  // ── 1. فحص دالات الـ Controller بأمان ──────────────────
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

  playerPaddle.rotation.x = THREE.MathUtils.lerp(playerPaddle.rotation.x, targetTiltX, 0.15);
  playerPaddle.rotation.z = THREE.MathUtils.lerp(playerPaddle.rotation.z, finalPlayerTiltZ, 0.15);
  playerPaddle.rotation.y = 0;

  botPaddle.rotation.x = THREE.MathUtils.lerp(botPaddle.rotation.x, botTiltX, 0.15);
  botPaddle.rotation.z = THREE.MathUtils.lerp(botPaddle.rotation.z, botTiltZ, 0.15);
  botPaddle.rotation.y = 0;

  // ── 3. الارتفاع الوقائي الديناميكي بصرياً ──────────────────
  const tableSurfaceY = PHYSICS.tableH + PHYSICS.tableThickness;
  const totalPaddleExtent = 0.57; 

  const playerOffsetDueToTilt = Math.max(Math.abs(Math.sin(playerPaddle.rotation.x)), Math.abs(Math.sin(playerPaddle.rotation.z))) * totalPaddleExtent;
  const botOffsetDueToTilt = Math.max(Math.abs(Math.sin(botPaddle.rotation.x)), Math.abs(Math.sin(botPaddle.rotation.z))) * totalPaddleExtent;

  // ── 4. تطبيق الأنميشن والاندفاع المتزامن بدقة ──
  if (isSwinging) {
    swingProgress += dt * 5.5; 

    if (swingProgress <= 0.5) {
      const t = swingProgress / 0.5;
      currentSwingOffset = THREE.MathUtils.lerp(0, 0.5, t);
      
      playerPaddle.position.copy(swingStartPosition);
      playerPaddle.position.x -= currentSwingOffset;
      playerPaddle.position.y = tableSurfaceY + playerOffsetDueToTilt + (Math.sin(t * Math.PI) * 0.08);

      // تحديث المظهر العالمي للمضرب أثناء الحركة
      playerPaddle.updateMatrixWorld();

      // إعادة حساب مركز القرص الأحمر العالمي في كل فريم لتبقى الكرة ملتصقة بوسط الدائرة الحمراء تماماً!
      const currentLocalCenter = new THREE.Vector3(0, 0.45, 0);
      playerPaddle.localToWorld(currentLocalCenter);
      
      ballState.pos.copy(currentLocalCenter);
      ballState.pos.x -= (currentRadius + 0.01); // تلامس سطحي مثالي مع القرص الدائري
    } else if (swingProgress <= 1.0) {
      if (!ballReleased) {
        ballReleased = true;
        physics.applyBallSpin(spinType);
        ballState.vel.copy(savedLaunchVel);
      }

      const t = (swingProgress - 0.5) / 0.5;
      const swingEndPos = new THREE.Vector3(swingStartPosition.x - 0.5, tableSurfaceY + playerOffsetDueToTilt, swingStartPosition.z);
      playerPaddle.position.lerpVectors(swingEndPos, paddleController.playerPos, t);
      playerPaddle.position.y = THREE.MathUtils.lerp(playerPaddle.position.y, tableSurfaceY + playerOffsetDueToTilt, t);
    } else {
      isSwinging = false;
      playerPaddle.position.copy(paddleController.playerPos);
      playerPaddle.position.y = tableSurfaceY + playerOffsetDueToTilt;
    }
  } else {
    playerPaddle.position.copy(paddleController.playerPos);
    playerPaddle.position.y = tableSurfaceY + playerOffsetDueToTilt;
  }

  botPaddle.position.copy(paddleController.botPos);
  botPaddle.position.y = tableSurfaceY + botOffsetDueToTilt;

  // ── 5. فحص التصادم الديناميكي المعتاد ──────────────────
  const checkY = tableSurfaceY + currentRadius;
  const playerHitCheckPos = new THREE.Vector3(playerPaddle.position.x, checkY, playerPaddle.position.z);
  const botHitCheckPos    = new THREE.Vector3(paddleController.botPos.x,    checkY, paddleController.botPos.z);

  const distToPlayer = ballState.pos.distanceTo(playerHitCheckPos);
  const distToBot    = ballState.pos.distanceTo(botHitCheckPos);
  const hitThreshold = 0.95; 

  if (!isSwinging) {
    const playerWantsHit = paddleController.consumePlayerHitIntent() || (distToPlayer < hitThreshold);
    if (distToPlayer < hitThreshold || (Math.abs(ballState.pos.x - playerHitCheckPos.x) < 0.4 && Math.abs(ballState.pos.z - playerHitCheckPos.z) < 0.6)) {
      physics.checkPaddleHit(playerHitCheckPos, paddleController.playerVel, true);
    } else {
      physics.checkPaddleHit(playerHitCheckPos, paddleController.playerVel, playerWantsHit);
    }
  }

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