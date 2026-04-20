precision highp float;

varying vec2 vUv;

uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uTexelSize;
uniform float uDt;
uniform float uDissipation;

void main() {
  vec2 vel = texture2D(uVelocity, vUv).xy;
  vec2 uvBack = vUv - vel * uDt * uTexelSize;
  vec4 texel = texture2D(uSource, uvBack);
  float decay = 1.0 / (1.0 + uDissipation * uDt);
  gl_FragColor = texel * decay;
}
