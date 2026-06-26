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
  }

  // 👇 هاد هو القسم الجديد ضفناه كـ دالة (Method) داخل الكلاس
applyBallSpin(type) {
  const { pos, vel, omega } = this.state;

  // 1. تكبير الـ X لترجع الكرة لورا لأقصى حافة الطاولة اليمين ويبين القوس كاملاً
  // إذا حسيتها لسا بدها رجعة، فيك ترفع الرقم لـ 2.8 أو 3.0 حسب مقاسات طاولتك
  pos.set(2.6, 1.25, 0); 

  // تصفير المتجهات تماماً قبل الإطلاق الجديد
  vel.set(0, 0, 0);
  omega.set(0, 0, 0);

  switch (type) {
    case 'backspin': 
      // 🚀 ترتفع فوق الشبكة مباشرة وتعمل قوس طبيعي وممتاز
      vel.set(-8.5, 4.2, 0); 
      omega.set(0, 0, -8); // دوران خلفي خفيف لعوم انسيابي
      break;

    case 'topspin': 
      // 🥎 تصطدم بطاولتك أولاً ثم تقفز فوق الشبكة تعبر للخصم
      vel.set(-7.5, -2.8, 0); // زاوية سالبة للأسفل لتضرب طاولتك اليمين أولاً
      omega.set(0, 0, 30);   
      break;

    case 'sidespin': 
      // 📐 تنضرب مائلة نحو الحواف الجانبية
      vel.set(-8.5, 3.0, 1.8); // قوة دفع على Z للانحراف الجانبي
      omega.set(0, 0, 0);
      break;

    case 'nethit': 
      // 🛑 تصطدم بالشبكة مباشرة في المنتصف تماماً وترتد
      vel.set(-5.8, 1.8, 0); 
      omega.set(0, 0, 0);
      break;

    case 'none':
    default:
      // ⚪ ضربة عادية ومستقيمة تعبر الشبكة بشكل طبيعي
      vel.set(-8.5, 2.5, 0);
      omega.set(0, 0, 0);
      break;
 case 'corkscrew':
      // 🌀 حركة الـ Corkscrew الإجبارية:
      // نمنح الكرة سرعة أمامية (X)، وارتفاع ممتاز (Y) لتعبر الشبكة
      // ونعطيها سرعة جانبية ابتدائية (Z) بقيمة 1.4 لتبدأ بالالتفاف والانحراف فوراً في الهواء
      vel.set(-8.5, 3.5, 1.4); 
      
      // نضع قيم الدوران على المحور الافتراضي الشغال عندك (محور Z) ليجعلها تدور وتهبط بحدة
      omega.set(0, 0, 35); 
      break;
  }
  
  // تفعيل الحركة وإعادة تعيين العدادات
  this.state.stopped = false; 
  this.state.bounces = 0;
}
  step(dt) {
    if (this.state.stopped) return;
    const { pos, vel, omega } = this.state;

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
}