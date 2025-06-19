import * as THREE from "three";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform vec3 glowColor;
  uniform float coreRadius;
  uniform float glowRadius;
  uniform float coreIntensity;
  uniform float glowIntensity;
  uniform float time;
  uniform float opacity;
  varying vec2 vUv;

  void main() {
    float dist = distance(vUv, vec2(0.5));

    // Smooth circular falloff
    float core = smoothstep(coreRadius * 0.5, coreRadius, dist);
    float glow = smoothstep(coreRadius, glowRadius, dist);

    // Optional pulse
    float pulse = 0.8 + 0.2 * sin(time * 2.0);

    float finalAlpha = pulse * (
      (1.0 - core) * coreIntensity +
      (1.0 - glow) * glowIntensity
    );

    finalAlpha *= opacity; 

    // Hard discard edge to avoid visible square
    if (dist > glowRadius || finalAlpha < 0.01) discard;

    gl_FragColor = vec4(glowColor, finalAlpha);
  }
`;

export default class FakeGlowMaterial extends THREE.ShaderMaterial {
  constructor(params = {}) {
    super({
      uniforms: {
        glowColor: { value: new THREE.Color("#000000") },
        coreRadius: { value: 0.15 },
        glowRadius: { value: 0.22 },
        coreIntensity: { value: 0.9 },
        glowIntensity: { value: 0.2 },
        time: { value: 0 },
        opacity: { value: 1 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      ...params,
    });
  }
}
