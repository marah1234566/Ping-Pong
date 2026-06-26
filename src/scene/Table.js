import * as THREE from 'three';
import { PHYSICS } from '../constants.js';

/** بناء الطاولة الكاملة: سطح، أرجل، خطوط، شبكة */
export function buildTable(scene) {
  const { tableL, tableW, tableH, tableThickness } = PHYSICS;
  const thickness = tableThickness;

  // ── سطح الطاولة ─────────────────────────────────────────
  const topGeo = new THREE.BoxGeometry(tableL, thickness, tableW);
  const topMat = new THREE.MeshStandardMaterial({
    color: 0x1a5c8a, roughness: 0.4, metalness: 0.1,
  });
  const top = new THREE.Mesh(topGeo, topMat);
  top.position.y = tableH + thickness / 2;
  top.receiveShadow = true;
  top.castShadow    = true;
  scene.add(top);

  // ── الخطوط البيضاء ──────────────────────────────────────
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  const yLine   = tableH + thickness + 0.001;

  scene.add(_line(new THREE.BoxGeometry(0.01, 0.002, tableW), lineMat, 0, yLine, 0));
  [-tableL/2, tableL/2].forEach(x =>
    scene.add(_line(new THREE.BoxGeometry(0.02, 0.002, tableW + 0.04), lineMat, x, yLine, 0))
  );
  [-tableW/2, tableW/2].forEach(z =>
    scene.add(_line(new THREE.BoxGeometry(tableL + 0.04, 0.002, 0.02), lineMat, 0, yLine, z))
  );

  // ── الأرجل ───────────────────────────────────────────────
  const legMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6, metalness: 0.4 });
  [
    [-tableL/2+0.1, -tableW/2+0.1],
    [ tableL/2-0.1, -tableW/2+0.1],
    [-tableL/2+0.1,  tableW/2-0.1],
    [ tableL/2-0.1,  tableW/2-0.1],
  ].forEach(([x, z]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, tableH, 8), legMat);
    leg.position.set(x, tableH / 2, z);
    leg.castShadow = true;
    scene.add(leg);
  });

  // ── الشبكة (مسطحة، شكلها الأصلي، بارتفاع أعلى وأوضح) ──────
  const netH = 0.35; // ← أعلى من الأصلي (0.1525) لتبين بوضوح فوق الطاولة الأكبر

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7, roughness: 0.3 });

  // العارضة العلوية
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, tableW + 0.3, 8), frameMat);
  bar.rotation.x = Math.PI / 2;
  bar.position.set(0, tableH + thickness + netH, 0);
  bar.castShadow = true;
  scene.add(bar);

  // نسيج الشبكة — PlaneGeometry مسطحة (الشكل الأصلي الصحيح)
  const netMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(tableW + 0.2, netH, 20, 8),
    new THREE.MeshBasicMaterial({ color: 0xdddddd, opacity: 0.7, transparent: true, side: THREE.DoubleSide, wireframe: true })
  );
  netMesh.rotation.y = Math.PI / 2;
  netMesh.position.set(0, tableH + thickness + netH / 2, 0);
  scene.add(netMesh);

  // أعمدة الشبكة
  [-tableW/2 - 0.05, tableW/2 + 0.05].forEach(z => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, netH + 0.02, 8), frameMat);
    post.position.set(0, tableH + thickness + netH / 2, z);
    post.castShadow = true;
    scene.add(post);
  });
}

function _line(geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}