import * as THREE from 'three';

/**
 * يرسم خط مسار حركة الكرة في الفضاء ثلاثي الأبعاد.
 * يستخدم BufferGeometry بمصفوفة ثابتة الحجم لأداء أفضل.
 */
export class TrajectoryVisualizer {
  constructor(scene, maxPoints = 800) {
    this.maxPoints = maxPoints;
    this.count     = 0;

    // مصفوفة ثابتة لتخزين المواضع
    this._positions = new Float32Array(maxPoints * 3);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(this._positions, 3)
    );
    geo.setDrawRange(0, 0);

    const mat = new THREE.LineBasicMaterial({
      color: 0x00e5ff,
      opacity: 0.55,
      transparent: true,
    });

    this.line = new THREE.Line(geo, mat);
    scene.add(this.line);
  }

  /** إضافة نقطة جديدة على المسار */
  addPoint(pos) {
    if (this.count >= this.maxPoints) {
      // تمرير النقاط (sliding window)
      this._positions.copyWithin(0, 3);
      this.count = this.maxPoints - 1;
    }

    const i = this.count * 3;
    this._positions[i]     = pos.x;
    this._positions[i + 1] = pos.y;
    this._positions[i + 2] = pos.z;
    this.count++;

    this.line.geometry.attributes.position.needsUpdate = true;
    this.line.geometry.setDrawRange(0, this.count);
  }

  /** مسح المسار عند إعادة الإطلاق */
  clear() {
    this.count = 0;
    this.line.geometry.setDrawRange(0, 0);
  }
}