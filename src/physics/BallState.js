import * as THREE from 'three';
import { PHYSICS } from '../constants.js';

/**
 * يحتفظ بالحالة الكاملة للكرة في أي لحظة:
 * الموقع (pos)، السرعة الخطية (vel)، السرعة الزاوية (omega).
 */
export class BallState {
  constructor() {
    this.pos     = new THREE.Vector3();
    this.vel     = new THREE.Vector3();
    this.omega   = new THREE.Vector3(); // rad/s
    this.bounces = 0;
    this.stopped = false;
  }

  /**
   * إعادة تعيين الحالة بناءً على معاملات الإطلاق
   * @param {number} v0       - السرعة الابتدائية (m/s)
   * @param {number} thetaDeg - زاوية القذف (درجات)
   * @param {string} spinType - 'topspin' | 'backspin' | 'none'
   * @param {number} omegaMag - قيمة الدوران (rad/s)
   */
  reset(v0, thetaDeg, spinType, omegaMag) {
    const theta = THREE.MathUtils.degToRad(thetaDeg);

    // نقطة الإطلاق: نهاية الطاولة (جانب اللاعب) + ارتفاع طفيف
    this.pos.set(
      -PHYSICS.tableL / 2 + 0.1,
      PHYSICS.tableH + 0.15,
      0
    );

    // السرعة الابتدائية مع مراعاة زاوية القذف
    this.vel.set(
      v0 * Math.cos(theta),  // المكوّن الأفقي
      v0 * Math.sin(theta),  // المكوّن العمودي
      0
    );

    // تعيين الدوران الابتدائي حسب النوع
    if (spinType === 'topspin') {
      this.omega.set(0, 0, -omegaMag); // Z سالب = Topspin
    } else if (spinType === 'backspin') {
      this.omega.set(0, 0, omegaMag);  // Z موجب = Backspin
    } else {
      this.omega.set(0, 0, 0);
    }

    this.bounces = 0;
    this.stopped = false;
  }
}