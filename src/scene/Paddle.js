import * as THREE from 'three';

/**
 * بناء مضرب بصري مكبّر مع نقل نقطة الارتكاز (Pivot) إلى أسفل المقبض تماماً
 * لمنع الغوص داخل الطاولة نهائياً تحت أي ظرف أو دوران
 */
export function buildPaddle(color = 0xd64545) {
  const group = new THREE.Group();

  // أبعاد المضرب الكبيرة المتناسبة مع حجم الطاولة
  const paddleRadius = 0.35;
  const handleLength = 0.38;

  // 🏓 وجه المضرب (قرص دائري)
  const faceGeo = new THREE.CylinderGeometry(paddleRadius, paddleRadius, 0.04, 32);
  const faceMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4 });
  const face = new THREE.Mesh(faceGeo, faceMat);
  face.rotation.x = Math.PI / 2;
  face.castShadow = true;
  
  // نرفع وجه المضرب للأعلى بمقدار طول المقبض + نصف قطر الوجه
  face.position.set(0, handleLength + paddleRadius, 0);
  group.add(face);

  // 🪵 المقبض الخشبي
  const handleGeo = new THREE.CylinderGeometry(0.045, 0.052, handleLength, 12);
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.7 });
  const handle = new THREE.Mesh(handleGeo, handleMat);
  handle.castShadow = true;
  
  // نرفع المقبض بحيث تبدأ حافته السفلية من الصفر تماماً (Y = handleLength / 2)
  handle.position.set(0, handleLength / 2, 0);
  group.add(handle);

  return group;
}