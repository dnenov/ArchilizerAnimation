import * as THREE from "three";
import { settings } from "./settings.js";
import { DYNAMIC_CLUSTER_DEFAULTS as cfg } from "./dynamicClusterConfig.js";

/**
 * Handles the spawning, updating, and scaling of dynamic orbiting dots.
 * Dots appear around a ring, move with local and global rotation,
 * fade in/out over time, and are animated based on stage transitions.
 */
export class DynamicCluster {
  constructor(ringGroup, getMouseWorldFn) {
    this.ringGroup = ringGroup;
    this.getMouseWorld = getMouseWorldFn; // ✅ Store the mouse function
    this.dots = [];
    this.spawnTimer = 0;
    this.nextSpawnInterval = cfg.SPAWN_INTERVAL_BASE;

    this.state = {
      orbitSizeMultiplier: 1,
    };
  }

  /**
   * Spawns a new dynamic dot with randomized orbit and animation parameters.
   * Dots are positioned on a circular ring and drift while orbiting locally.
   */
  spawnDot() {
    // Place the dot on the ring
    const theta = Math.random() * Math.PI * 2;
    const x = settings.ringRadius * Math.cos(theta);
    const y = settings.ringRadius * Math.sin(theta);
    const z = 0;

    // Create mesh with cloned material
    const mesh = new THREE.Mesh(
      settings.dotGeometry,
      settings.dotSpawnMaterial.clone()
    );

    const scale = (Math.random() * cfg.SIZE + 0.5) * 0.5;
    mesh.scale.set(scale, scale, scale);
    mesh.position.set(x, y, z);
    this.ringGroup.add(mesh);

    // Determine orbit axis (local tangent to the ring)
    const radialDir = new THREE.Vector3(x, y, z).normalize();
    const orbitNormal = new THREE.Vector3()
      .crossVectors(radialDir, new THREE.Vector3(0, 0, 1))
      .normalize();

    // Speed and orbit behavior
    const baseOrbitSpeed =
      cfg.ORBIT_SPEED_BASE +
      Math.random() * (cfg.ORBIT_SPEED_MAX - cfg.ORBIT_SPEED_BASE);
    const baseGlobalSpeed =
      (Math.random() < 0.5 ? -1 : 1) * (0.02 + Math.random() * 0.08);
    const orbitSize = 0.1 + Math.random() * cfg.ORBIT_SIZE;

    // Initialize dot state
    const dot = {
      mesh,
      baseScale: scale,
      basePosition: new THREE.Vector3(x, y, z),
      orbitNormal,
      orbitAngleOffset: Math.random() * Math.PI * 2,
      accumulatedPhase: 0,

      baseOrbitSpeed,
      currentSpeed: baseOrbitSpeed,
      targetSpeed: baseOrbitSpeed,

      baseGlobalSpeed,
      globalSpeed: baseGlobalSpeed,

      orbitSize,
      baseOrbitSize: orbitSize,
      targetOrbitSize: orbitSize,

      life: cfg.LIFE_SPAN + Math.random() * 5,
      maxLife: 0,
      globalAngle: Math.random() * Math.PI * 2,

      repulsionOffset: new THREE.Vector3(),
    };

    dot.maxLife = dot.life;
    this.dots.push(dot);
  }

  /**
   * Updates all active dynamic dots. Handles movement, fading, and removal.
   * Should be called every animation frame.
   * @param {number} deltaTime - Time since last frame
   */
  update(deltaTime) {
    const mousePos = this.getMouseWorld();
    const repulsionRadius = 0.5;
    const baseRepulsionStrength = 0.02;
    const t = settings.animationProgress;
    const dynamicRepulsionRadius = repulsionRadius * (1 + t * 2);
    const dynamicStrength = baseRepulsionStrength * (1 + t * 100);
    const toDot = new THREE.Vector3();

    // Attempt to spawn a new dot if allowed
    this.spawnTimer += deltaTime;
    if (
      this.spawnTimer > this.nextSpawnInterval &&
      this.dots.length < cfg.MAX_DOTS
    ) {
      this.spawnDot();
      this.spawnTimer = 0;
      this.nextSpawnInterval = 0.01; // Can be randomized if desired
    }

    // Loop over dots in reverse for safe removal
    for (let i = this.dots.length - 1; i >= 0; i--) {
      const dot = this.dots[i];

      // Lifespan and fade
      dot.life -= deltaTime;
      const fadeIn = Math.min(1, (dot.maxLife - dot.life) / cfg.FADE_DURATION);
      const fadeOut = Math.min(1, dot.life / cfg.FADE_DURATION);
      const alpha = THREE.MathUtils.clamp(Math.min(fadeIn, fadeOut), 0, 1);

      if (dot.mesh.material?.uniforms?.opacity) {
        dot.mesh.material.uniforms.opacity.value = alpha;
      } else {
        dot.mesh.material.opacity = alpha;
      }

      // Remove dead dot
      if (dot.life <= -cfg.FADE_BUFFER) {
        this.ringGroup.remove(dot.mesh);
        this.dots.splice(i, 1);
        continue;
      }

      // Advance phase and global rotation
      dot.accumulatedPhase += dot.currentSpeed * deltaTime;
      dot.globalAngle += (dot.globalSpeedScaled ?? dot.globalSpeed) * deltaTime;

      // Animate speed and orbit size
      dot.currentSpeed += (dot.targetSpeed - dot.currentSpeed) * 0.1;
      dot.orbitSize += (dot.targetOrbitSize - dot.orbitSize) * 0.1;

      // Update base position along the ring
      const radius = settings.currentRingRadius;
      const bx = radius * Math.cos(dot.globalAngle);
      const by = radius * Math.sin(dot.globalAngle);
      dot.basePosition.set(bx, by, 0);

      // Offset for local orbit
      const tangent = new THREE.Vector3()
        .crossVectors(dot.orbitNormal, new THREE.Vector3(0, 0, 1))
        .normalize();
      const orbitOffset = tangent
        .clone()
        .multiplyScalar(dot.orbitSize)
        .negate();

      // ✅ Repulsion logic
      const worldPos = dot.mesh.getWorldPosition(new THREE.Vector3());
      toDot.subVectors(worldPos, mousePos);
      const dist = toDot.length();

      if (dist < dynamicRepulsionRadius) {
        const falloff =
          (dynamicRepulsionRadius - dist) / dynamicRepulsionRadius;
        const push = toDot
          .normalize()
          .multiplyScalar(Math.pow(falloff, 3) * dynamicStrength * 10);
        dot.repulsionOffset.add(push);
      }

      // 🌀 Let them drift back slowly — same as static
      dot.repulsionOffset.multiplyScalar(0.985);
      dot.repulsionOffset.lerp(new THREE.Vector3(), 0.012);

      // Final position = rotated offset from base
      dot.mesh.position
        .copy(dot.basePosition)
        .add(dot.repulsionOffset)
        .add(orbitOffset);
      dot.mesh.position.sub(dot.basePosition);
      dot.mesh.position.applyAxisAngle(
        dot.orbitNormal,
        dot.accumulatedPhase + dot.orbitAngleOffset
      );
      dot.mesh.position.add(dot.basePosition);

      const distanceFromPlane = dot.mesh.position.z;
      const normalizedDistance = Math.min(
        1,
        Math.max(0, (distanceFromPlane + 0.15) / 0.15)
      );

      // Combine both effects (fade * distance)
      const finalOpacity = alpha * normalizedDistance;

      if (dot.mesh.material?.uniforms?.opacity) {
        dot.mesh.material.uniforms.opacity.value = finalOpacity;
      } else {
        dot.mesh.material.opacity = finalOpacity;
      }
    }
  }

  /**
   * Adjusts orbit radius scale for all dots (with interpolation).
   * Typically used during stage transitions.
   * @param {number} multiplier - Value to multiply each dot's base orbit size
   */
  setOrbitScale(multiplier) {
    this.state.orbitSizeMultiplier = multiplier;
    for (const dot of this.dots) {
      dot.targetOrbitSize = dot.baseOrbitSize * multiplier;
    }
  }

  /**
   * Scales both local orbital speed and global drift using a single factor.
   * Use to sync motion speed to stage progress (t ∈ [0, 1]).
   * @param {number} t - Normalized stage progress
   */
  setSpeedMultiplier(t) {
    const speedMultiplier = THREE.MathUtils.lerp(
      cfg.ORBIT_SPEED_BASE,
      cfg.ORBIT_SPEED_MAX,
      t
    );

    for (const dot of this.dots) {
      dot.targetSpeed = dot.baseOrbitSpeed * speedMultiplier;
      dot.globalSpeed = dot.baseGlobalSpeed * speedMultiplier;
    }
  }

  setSizeMultiplyer(multiplier) {
    for (const dot of this.dots) {
      const s = dot.baseScale * multiplier;
      dot.mesh.scale.set(s, s, s);
    }
  }
}
