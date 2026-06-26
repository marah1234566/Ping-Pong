import * as THREE from 'three';

export function buildStands(scene) {
  const courtGroup = new THREE.Group();

  const structureMat = new THREE.MeshStandardMaterial({
    color: 0x181a1f,
    roughness: 0.9,
  });

  const steps = 6;
  const stepH = 0.45;
  const stepD = 0.9;

  function buildModernStand(length, posX, posZ, rotY = 0, colors = [0x3a3f47, 0x24282e, 0x515863]) {
    const stand = new THREE.Group();
    const seatMaterials = colors.map(color =>
      new THREE.MeshStandardMaterial({ color: color, roughness: 0.6 })
    );

    for (let i = 0; i < steps; i++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(length, stepH, stepD),
        structureMat
      );
      step.position.set(0, stepH / 2 + i * stepH, i * stepD);
      step.castShadow = true;
      step.receiveShadow = true;
      stand.add(step);

      const numSeatsInRow = 12;
      const seatWidth = (length - 0.4) / numSeatsInRow;

      for (let j = 0; j < numSeatsInRow; j++) {
        const randomMat = seatMaterials[(i + j) % seatMaterials.length];
        const seat = new THREE.Mesh(
          new THREE.BoxGeometry(seatWidth - 0.05, 0.15, stepD - 0.15),
          randomMat
        );
        seat.position.set(
          -(length / 2) + seatWidth / 2 + j * seatWidth + 0.2,
          stepH / 2 + i * stepH + 0.15,
          i * stepD
        );
        seat.castShadow = true;
        stand.add(seat);
      }
    }

    stand.position.set(posX, 0, posZ);
    stand.rotation.y = rotY;
    return stand;
  }

  const bluePallete   = [0x1d3557, 0x457b9d, 0xa8dadc];
  const redPallete    = [0x660708, 0xa4161a, 0xba181b];
  const greenPallete  = [0x1b4332, 0x2d6a4f, 0x52b788];
  const yellowPallete = [0xee9b00, 0xca6702, 0x005f73];

  const northStand = buildModernStand(32, 0, 12, 0, bluePallete);
  courtGroup.add(northStand);

  const southStand = buildModernStand(32, 0, -12, -Math.PI, redPallete);
  courtGroup.add(southStand);

  const westStand = buildModernStand(16, -19, 0, -Math.PI / 2, greenPallete);
  courtGroup.add(westStand);

  const eastStand = buildModernStand(16, 19, 0, Math.PI / 2, yellowPallete);
  courtGroup.add(eastStand);

  scene.add(courtGroup);
}