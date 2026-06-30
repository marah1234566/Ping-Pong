import * as THREE from 'three';
import { PHYSICS } from '../constants.js';

export class PhysicsEngine {
  constructor(state) {
    this.state = state;

    this._Fg   = new THREE.Vector3();
    this._Fd   = new THREE.Vector3();
    this._Fm   = new THREE.Vector3();
    this._Ftot = new THREE.Vector3();
    this._acc  = new THREE.Vector3();

    this._I = (2 / 3) * PHYSICS.m * PHYSICS.r * PHYSICS.r;
    
    // متغير التحقق من لحظة الانطلاق
    this.justLaunched = false;
  }

  /**
   * تطبيق قيم السرعة والدوران بناءً على الحركة المحددة فوراً عند الضغط على الزر
   */
  applyBallSpin(type) {
    const { pos, vel, omega } = this.state;

    // نلغي أي سرعة أو دوران سابق قبل تطبيق الحركة الجديدة
    vel.set(0, 0, 0);
    omega.set(0, 0, 0);

    // تطبيق قيم السرعات والـ Spin للحركات المختلفة
    switch (type) {
      case 'backspin':
        vel.set(-8.5, 4.2, 0);
        omega.set(0, 0, -8);
        break;

      case 'topspin':
        vel.set(-7.5, 3.8, 0);
        omega.set(0, 0, 30);
        break;

      case 'sidespin':
        vel.set(-8.5, 3.2, 1.8);
        omega.set(0, 0, 0);
        break;

      case 'corkscrew':
        vel.set(-8.5, 3.5, 1.4);
        omega.set(0, 0, 35);
        break;

      case 'nethit':
        vel.set(-5.8, 1.8, 0);
        omega.set(0, 0, 0);
        break;

      case 'snake':
        vel.set(-10.5, 1.8, -0.5); 
        omega.set(0, -50, 10);
        break;

      case 'phantom':
        vel.set(-6.5, 4.2, 0.5);
        omega.set(0, 30, 45);
        break;

      case 'deadball':
        vel.set(-7.5, 3.0, 0);
        omega.set(0, 0, 0);
        break;

      default:
        vel.set(-8.5, 2.8, 0);
        omega.set(0, 0, 0);
        break;
    }

    // تنشيط المحاكاة وتصفير الارتدادات
    this.state.stopped = false;
    this.state.bounces = 0;

    // تفعيل حماية الإطلاق المؤقتة لمنع التصادم العكسي في أول فريم
    this.justLaunched = true;
  }

  step(dt) {
    if (this.state.stopped) return;
    const { pos, vel, omega } = this.state;

    // تصفير حماية الإطلاق تلقائياً بمجرد أن تبدأ الكرة بالتحرك والابتعاد عن المضرب
    if (this.justLaunched && vel.length() > 0.1) {
      // إذا ابتعدت الكرة قليلاً للأمام، نقوم بإلغاء الحماية فوراً ليصبح المضرب جاهزاً للضرب والتصادم
      if (pos.x < (PHYSICS.tableL / 2) - 0.4) {
        this.justLaunched = false;
      }
    }

    this._Fg.set(0, -PHYSICS.m * PHYSICS.g, 0);

    const speed = vel.length();
    if (speed > 1e-6) {
      const dragMag = 0.5 * PHYSICS.Cd * PHYSICS.rho * PHYSICS.A * speed * speed;
      this._Fd.copy(vel).normalize().multiplyScalar(-dragMag);
    } else {
      this._Fd.set(0, 0, 0);
    }

    this._Fm.crossVectors(omega, vel).multiplyScalar(PHYSICS.Sm);

    const maxMagnus = PHYSICS.m * PHYSICS.g * 3.0;
    if (this._Fm.length() > maxMagnus) {
      this._Fm.setLength(maxMagnus);
    }

    this._Ftot.copy(this._Fg).add(this._Fd).add(this._Fm);
    this._acc.copy(this._Ftot).divideScalar(PHYSICS.m);

    vel.addScaledVector(this._acc, dt);
    pos.addScaledVector(vel, dt);

    omega.multiplyScalar(Math.exp(-PHYSICS.beta * dt));

    this._handleCollisions();
  }

  _handleCollisions() {
    const { pos, vel, omega } = this.state;
    const { tableH, tableL, tableW, tableThickness, e, mu, r } = PHYSICS;
    const tableSurfaceY = tableH + tableThickness;

    const halfL = tableL / 2;
    const halfW = tableW / 2;

    // أ) تصادم سطح الطاولة
    if (
      pos.y <= tableSurfaceY + r &&
      Math.abs(pos.x) <= halfL &&
      Math.abs(pos.z) <= halfW &&
      vel.y < 0
    ) {
      pos.y = tableSurfaceY + r;
      vel.y = -e * vel.y;

      const spinEffectX = -omega.z * r * 0.5;
      const spinEffectZ =  omega.x * r * 0.5;

      vel.x = vel.x * (1 - mu) + spinEffectX * mu;
      vel.z = vel.z * (1 - mu) + spinEffectZ * mu;

      omega.x *= 0.8;
      omega.y *= 0.8;
      omega.z *= 0.8;

      this.state.bounces++;
    }

    // ب) تصادم الشبكة
    const netH = 0.35;
    const netTopY = tableSurfaceY + netH;

    const nearNetX = Math.abs(pos.x) <= r + 0.02;
    const withinNetWidth = Math.abs(pos.z) <= halfW + r;
    const belowNetTop = pos.y - r <= netTopY;
    const aboveTable = pos.y + r >= tableSurfaceY;

    if (nearNetX && withinNetWidth && belowNetTop && aboveTable) {
      pos.x = Math.sign(vel.x || 1) * (r + 0.025);
      vel.x = -vel.x * 0.5;
      vel.y *= 0.8;
      vel.z *= 0.8;
      omega.multiplyScalar(0.7);
    }

    // ج) تصادم حواف الطاولة الجانبية
    const onTableHeight = pos.y >= tableH && pos.y <= tableSurfaceY + r;
    const withinTableLength = Math.abs(pos.x) <= halfL;
    const atSideEdge = Math.abs(pos.z) >= halfW - r && Math.abs(pos.z) <= halfW + r;

    if (onTableHeight && withinTableLength && atSideEdge) {
      pos.z = Math.sign(pos.z) * (halfW - r);
      vel.z = -vel.z * e;
      vel.x *= 0.92;
      omega.multiplyScalar(0.85);
    }

    // د) تصادم الأرض
    if (pos.y <= r) {
      pos.y = r;

      const speed = vel.length();
      if (Math.abs(vel.y) < 0.05 && speed < 0.15) {
        vel.set(0, 0, 0);
        omega.set(0, 0, 0);
        this.state.stopped = true;
      } else {
        vel.y = -e * 0.5 * vel.y;
        vel.x *= 0.8;
        vel.z *= 0.8;
        omega.multiplyScalar(0.6);
      }
    }
  }

  /**
   * يفحص تصادم الكرة مع المضرب وينقل الزخم الفيزيائي بدقة
   */
  checkPaddleHit(paddlePos, paddleVel, isHitting) {
    const { pos, vel, omega } = this.state;
    const { r } = PHYSICS;

    // حظر التصادم فقط في أول فريم حقيقي لمنع الالتصاق والارتداد العكسي المتكرر
    if (this.justLaunched && paddlePos.x > 0) return false;

    // تعيين نصف قطر الفحص الموسع ليتوافق تماماً مع الحجم المكبّر الجديد للمضارب
    const paddleRadius = 0.95;
    const hitDistance = r + paddleRadius;

    const dist = pos.distanceTo(paddlePos);
    if (dist > hitDistance) return false;
    if (!isHitting) return false;

    // حساب ناقل العمودي للتصادم وإزاحة الكرة منعاً للتداخل
    const normal = new THREE.Vector3().subVectors(pos, paddlePos).normalize();
    pos.copy(paddlePos).addScaledVector(normal, hitDistance + 0.005);

    const restitution = 0.65;
    const transferFactor = 1.5; // عامل زيادة زخم المضرب لجعل الضربة حقيقية وقوية
    const speedAlongNormal = vel.dot(normal);

    if (speedAlongNormal < 0 || vel.length() < 0.1) {
      vel.addScaledVector(normal, -speedAlongNormal * (1 + restitution));
      vel.addScaledVector(paddleVel, transferFactor);
      
      // نقل تأثير الدوران من حركة المضرب إلى الكرة
      omega.z += paddleVel.z * 2.5;
      omega.x += paddleVel.y * 1.8;
    }

    this.state.stopped = false;
    return true;
  }
}