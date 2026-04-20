precision highp float;

varying vec2 vUv;

uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 uTexelSize;

void main() {
  float L = texture2D(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
  float R = texture2D(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
  float B = texture2D(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
  float T = texture2D(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
  float div = texture2D(uDivergence, vUv).x;
  float p = (L + R + B + T - div) * 0.25;
  gl_FragColor = vec4(p, 0.0, 0.0, 1.0);
}
