export const vertexShader = `
attribute vec3 aSphere;
attribute vec3 aKnot;
attribute vec3 aWave;
attribute float aSeed;
uniform vec4 uMix;
uniform float uTime;
uniform float uSize;
uniform float uPixelRatio;
uniform vec3 uPointer;
uniform float uPointerStrength;
uniform vec3 uPulseOrigin;
uniform float uPulseAge;
varying float vAlpha;

void main() {
  vec3 shape = position * uMix.x + aSphere * uMix.y + aKnot * uMix.z + aWave * uMix.w;
  float drift = uTime * 0.6 + aSeed * 6.2831;
  shape += vec3(sin(drift + shape.y * 2.0), cos(drift * 0.8 + shape.x * 2.0), sin(drift * 1.3)) * 0.018;
  vec4 world = modelMatrix * vec4(shape, 1.0);
  vec3 away = world.xyz - uPointer;
  float distance = length(away.xy);
  float push = smoothstep(1.1, 0.0, distance) * uPointerStrength;
  world.xyz += normalize(away + vec3(0.0001)) * push * 0.55;
  if (uPulseAge >= 0.0) {
    vec3 fromPulse = world.xyz - uPulseOrigin;
    float radius = uPulseAge * 5.5;
    float band = exp(-pow((length(fromPulse) - radius) * 3.2, 2.0)) * max(0.0, 1.0 - uPulseAge);
    world.xyz += normalize(fromPulse + vec3(0.0001)) * band * 0.45;
  }
  vec4 view = viewMatrix * world;
  gl_Position = projectionMatrix * view;
  gl_PointSize = uSize * uPixelRatio * (0.55 + aSeed * 0.75) * (5.0 / -view.z);
  vAlpha = 0.35 + aSeed * 0.65;
}
`;

export const fragmentShader = `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;

void main() {
  vec2 centre = gl_PointCoord - 0.5;
  float distance = length(centre);
  if (distance > 0.5) discard;
  float edge = smoothstep(0.5, 0.32, distance);
  gl_FragColor = vec4(uColor, edge * vAlpha * uOpacity);
}
`;
