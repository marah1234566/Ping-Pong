import * as THREE from 'three';

/** بناء الأرضية مع شبكة مرجعية */
export function buildFloor(scene) {
  const geo = new THREE.PlaneGeometry(20, 20);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x111820, roughness: 0.9, metalness: 0.1,
  });
  const floor = new THREE.Mesh(geo, mat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(20, 40, 0x1a2530, 0x1a2530);
  grid.position.y = 0.001;
  scene.add(grid);
}