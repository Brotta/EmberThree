precision highp float;

varying vec2 vUv;

uniform sampler2D uVelocity;
uniform sampler2D uDensity;
uniform float uBuoyancy;
uniform float uDt;

void main() {
  vec2 vel = texture2D(uVelocity, vUv).xy;
  vec3 dye = texture2D(uDensity, vUv).xyz;
  float mass = dot(dye, vec3(1.0 / 3.0));
  vel.y += uBuoyancy * mass * uDt;
  gl_FragColor = vec4(vel, 0.0, 1.0);
}
