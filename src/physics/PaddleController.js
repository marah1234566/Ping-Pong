import * as THREE from 'three';
import { PHYSICS } from '../constants.js';

/**
 * يتحكم بمضرب اللاعب ومضرب البوت مع قفل الحركة على السطح العلوي للطاولة مباشرة
 */
export class PaddleController {
  constructor(camera, renderer, tableHalfX) {
    this.camera = camera;
    this.renderer = renderer;
    this.tableHalfX = tableHalfX;

    // الارتفاع هو السطح العلوي الفعلي للطاولة بالملي (الارتفاع + السماكة)
    this.baseY = PHYSICS.tableH + PHYSICS.tableThickness;

    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.baseY);
    this._raycaster = new THREE.Raycaster();
    this._mouseNDC = new THREE.Vector2();
    this._intersectPoint = new THREE.Vector3();

    this.playerPos = new THREE.Vector3(this.tableHalfX - 0.3, this.baseY, 0);
    this.playerPrevPos = this.playerPos.clone();
    this.playerVel = new THREE.Vector3();

    this.botPos = new THREE.Vector3(-this.tableHalfX + 0.3, this.baseY, 0);
    this.botPrevPos = this.botPos.clone();
    this.botVel = new THREE.Vector3();

    this.playerWantsHit = false;

    this._bindEvents();
  }

  _bindEvents() {
    const dom = this.renderer.domElement;

    dom.addEventListener('mousemove', (e) => {
      const rect = dom.getBoundingClientRect();
      this._mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this._mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    });

    dom.addEventListener('mousedown', () => {
      this.playerWantsHit = true;
    });
  }

  update(dt) {
    this._raycaster.setFromCamera(this._mouseNDC, this.camera);
    const hit = this._raycaster.ray.intersectPlane(this._plane, this._intersectPoint);

    if (hit) {
      // حدود الحركة الطولية والجانبية على الطاولة
      const clampedX = THREE.MathUtils.clamp(hit.x, 0.15, this.tableHalfX + 0.6);
      const clampedZ = THREE.MathUtils.clamp(hit.z, -PHYSICS.tableW / 2 - 0.4, PHYSICS.tableW / 2 + 0.4);

      this.playerPrevPos.copy(this.playerPos);
      
      // قفل الارتفاع على السطح تماماً
      this.playerPos.set(clampedX, this.baseY, clampedZ);

      if (dt > 0) {
        this.playerVel.copy(this.playerPos).sub(this.playerPrevPos).divideScalar(dt);
      }
    }

    this._updateBot(dt);
  }

  _updateBot(dt, ballPos) {
    if (!ballPos) return;

    this.botPrevPos.copy(this.botPos);

    const targetZ = THREE.MathUtils.clamp(ballPos.z, -PHYSICS.tableW / 2, PHYSICS.tableW / 2);
    const followSpeed = 3.5;
    const dz = targetZ - this.botPos.z;
    const step = THREE.MathUtils.clamp(dz, -followSpeed * dt, followSpeed * dt);
    
    this.botPos.z += step;
    this.botPos.y = this.baseY; // قفل ارتفاع البوت على السطح تماماً

    if (dt > 0) {
      this.botVel.copy(this.botPos).sub(this.botPrevPos).divideScalar(dt);
    }
  }

  shouldBotHit(ballPos) {
    return Math.abs(ballPos.x - this.botPos.x) < 0.25 && ballPos.x < 0;
  }

  consumePlayerHitIntent() {
    const wanted = this.playerWantsHit;
    this.playerWantsHit = false;
    return wanted;
  }
}