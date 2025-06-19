import * as THREE from "three";

export function createDotCluster(
  numDots,
  ringRadius,
  dotGeometry,
  glowMaterial,
  baseOrbitSpeed,
  orbitRadius,
  orbitVariance,
  dotSize,
  ringGroup,
  scene
) {
  const clusterDots = [];

  for (let i = 0; i < numDots; i++) {
    const theta = (i / numDots) * Math.PI * 2;
    const x = ringRadius * Math.cos(theta);
    const y = ringRadius * Math.sin(theta);
    const z = 0;

    const dot = new THREE.Mesh(dotGeometry, glowMaterial);
    const scaleFactor = Math.random() * dotSize + 0.4;
    dot.scale.set(scaleFactor, scaleFactor, scaleFactor);
    dot.position.set(x, y, z);
    ringGroup.add(dot);

    const radialDirection = new THREE.Vector3(x, y, z).normalize();
    const orbitNormal = new THREE.Vector3()
      .crossVectors(radialDirection, new THREE.Vector3(0, 0, 1))
      .normalize();

    const randomizedSpeed = baseOrbitSpeed + (Math.random() - 0.5) * 1.5;
    const randomizedSize =
      orbitRadius + orbitVariance * (Math.random() - 0.5) * 1.0;

    clusterDots.push({
      mesh: dot,
      baseTheta: theta,
      accumulatedPhase: 0,
      basePosition: new THREE.Vector3(x, y, z),
      orbitNormal: orbitNormal,
      orbitAngleOffset: Math.random() * Math.PI * 2,
      currentSpeed: baseOrbitSpeed + (Math.random() - 0.5) * 0.2,
      targetSpeed: baseOrbitSpeed + (Math.random() - 0.5) * 0.2,
      orbitSpeed: randomizedSpeed,
      baseOrbitSpeed: randomizedSpeed,
      targetOrbitSpeed: randomizedSpeed,
      orbitSize: randomizedSize,
      baseOrbitSize: randomizedSize,
      targetOrbitSize: randomizedSize,
      driftFactor: 0.2,
      repulsionOffset: new THREE.Vector3(),
      isBeingRepelled: false,
      repulsionOffset: new THREE.Vector3(),
      baseScale: scaleFactor,
    });
  }

  return clusterDots;
}
