import * as THREE from 'three';
import { PHYSICS } from '../constants.js';

/**
 * المحرك الفيزيائي المخصص.
 * يحسب القوى ويُحدّث حالة الكرة يدوياً دون أي مكتبة فيزياء خارجية.
 */
export class PhysicsEngine {
  constructor(state) {
    this.state = state;

    // متجهات مؤقتة لتجنّب إنشاء كائنات في كل إطار
    this._Fg   = new THREE.Vector3();
    this._Fd   = new THREE.Vector3();
    this._Fm   = new THREE.Vector3();
    this._Ftot = new THREE.Vector3();
    this._acc  = new THREE.Vector3();
  }

  /**
   * خطوة فيزيائية واحدة بزمن dt (ثانية)
   * @param {number} dt - الزمن التفاضلي
   */
  step(dt) {
    if (this.state.stopped) return;
    const { pos, vel, omega } = this.state;

    // ── 1. قوة الجاذبية ─────────────────────────────────────
    // F_g = [0, -m·g, 0]
    this._Fg.set(0, -PHYSICS.m * PHYSICS.g, 0);

    // ── 2. قوة مقاومة الهواء (Aerodynamic Drag) ─────────────
    // F_d = -0.5 · Cd · ρ · A · |v| · v
    const speed = vel.length();
    const dragCoeff = -0.5 * PHYSICS.Cd * PHYSICS.rho * PHYSICS.A * speed;
    this._Fd.copy(vel).multiplyScalar(dragCoeff);

    // ── 3. قوة ماغنوس (Magnus Effect) ───────────────────────
    // F_m = Sm · (ω × v)  ← ضرب تقاطعي
    this._Fm.crossVectors(omega, vel).multiplyScalar(PHYSICS.Sm);

    // ── 4. القوة المحصلة والتسارع ────────────────────────────
    // F_total = F_g + F_d + F_m
    // a = F_total / m
    this._Ftot.copy(this._Fg).add(this._Fd).add(this._Fm);
    this._acc.copy(this._Ftot).divideScalar(PHYSICS.m);

    // ── 5. تكامل أويلر-كرومر ────────────────────────────────
    // v(t+dt) = v(t) + a·dt
    vel.addScaledVector(this._acc, dt);
    // pos(t+dt) = pos(t) + v(t+dt)·dt
    pos.addScaledVector(vel, dt);

    // ── 6. تخميد الدوران في الهواء (تخميد أسّي) ─────────────
    // ω(t+dt) = ω(t) · e^(-β·dt)
    omega.multiplyScalar(Math.exp(-PHYSICS.beta * dt));

    // ── 7. معالجة التصادمات ──────────────────────────────────
    this._handleCollisions();
  }

  _handleCollisions() {
    const { pos, vel, omega } = this.state;
    const { tableH, tableL, tableW, e, mu, m, g, r } = PHYSICS;

    // ── تصادم مع سطح الطاولة ────────────────────────────────
    if (
      pos.y <= tableH + r &&
      Math.abs(pos.x) <= tableL / 2 &&
      Math.abs(pos.z) <= tableW / 2 &&
      vel.y < 0
    ) {
      pos.y = tableH + r;

      // السرعة التلامسية (تأثير الدوران عند نقطة التلامس)
      // v_contact = v + ω × r_contact  (r_contact = [0,-r,0])
      const rContact = new THREE.Vector3(0, -r, 0);
      const contactVel = new THREE.Vector3()
        .crossVectors(omega, rContact)
        .add(vel);

      // عكس المركبة العمودية مع معامل الارتداد
      // v'_y = -e · v_y
      vel.y = -e * vel.y;

      // نبضة الاحتكاك على المكونات الأفقية
      const frictionImpulse = mu * Math.abs(vel.y) / g;
      vel.x -= frictionImpulse * Math.sign(contactVel.x) * 0.5;
      vel.z -= frictionImpulse * Math.sign(contactVel.z) * 0.5;

      // تحديث السرعة الزاوية بعزم الاحتكاك
      const torqueFactor = frictionImpulse * r * 2;
      omega.x += torqueFactor * Math.sign(contactVel.z);
      omega.z -= torqueFactor * Math.sign(contactVel.x);

      this.state.bounces++;
    }

    // ── تصادم مع الشبكة ──────────────────────────────────────
    const netH = tableH + 0.1525;
    if (
      Math.abs(pos.x) < 0.012 &&
      pos.y < netH &&
      pos.y > tableH
    ) {
      vel.x = -vel.x * 0.5;
      pos.x = Math.sign(vel.x) * 0.013;
    }

    // ── تصادم مع الأرض ───────────────────────────────────────
    if (pos.y <= r) {
      pos.y = r;
      if (Math.abs(vel.y) < 0.05 && Math.abs(vel.x) < 0.05) {
        // توقف كامل
        vel.set(0, 0, 0);
        omega.set(0, 0, 0);
        this.state.stopped = true;
      } else {
        vel.y  = -e * 0.6 * vel.y;
        vel.x *= 0.85;
        vel.z *= 0.85;
        omega.multiplyScalar(0.7);
      }
    }
  }
}