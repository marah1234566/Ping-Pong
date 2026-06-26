import * as THREE from 'three';

export function buildFloor(scene) {
  const textureLoader = new THREE.TextureLoader();

  const floorTexture = textureLoader.load(
    'https://threejs.org/examples/textures/hardwood2_diffuse.jpg'
  );
  floorTexture.wrapS = THREE.RepeatWrapping;
  floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(10, 10);  // ← كان 6, مدّدتها مع الأرضية الأكبر
  floorTexture.colorSpace = THREE.SRGBColorSpace;

  const geo = new THREE.PlaneGeometry(40, 40);  // ← كان 20×20
  const mat = new THREE.MeshStandardMaterial({
    map: floorTexture,
    roughness: 0.4,    // ← كان 0.55، أقل = أكتر لمعة
    metalness: 0.08,   // ← كان 0.05
  });
  const floor = new THREE.Mesh(geo, mat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
}