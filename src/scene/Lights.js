import * as THREE from 'three';

export function buildLights(scene) {
  // ── إضاءة محيطية ──────────────────────────────────────────
  const ambient = new THREE.AmbientLight(0x223344, 1.2);
  scene.add(ambient);

  // ── إضاءة اتجاهية (مصدر الظلال الرئيسي) ──────────────────
  const dirLight = new THREE.DirectionalLight(0xffeedd, 2.5);
  dirLight.position.set(3, 6, 4);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width  = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near    = 0.1;
  dirLight.shadow.camera.far     = 30;
  dirLight.shadow.camera.left    = -5;
  dirLight.shadow.camera.right   =  5;
  dirLight.shadow.camera.top     =  5;
  dirLight.shadow.camera.bottom  = -5;
  dirLight.shadow.bias           = -0.001;
  scene.add(dirLight);

  // ── إضاءة تعبئة (من الجهة الأخرى) ────────────────────────
  const fillLight = new THREE.DirectionalLight(0x3366ff, 0.5);
  fillLight.position.set(-4, 3, -2);
  scene.add(fillLight);

  // ── نقطة ضوء فوق الطاولة ─────────────────────────────────
  const tableLight = new THREE.PointLight(0xffffff, 1.5, 8);
  tableLight.position.set(0, 3, 0);
  tableLight.castShadow = true;
  scene.add(tableLight);

  // 🔥 الجديد هنا: إرجاع الأضواء لكي نتحكم بها ديناميكياً مع حركة الكاميرا
  return { ambient, dirLight, fillLight, tableLight };
}