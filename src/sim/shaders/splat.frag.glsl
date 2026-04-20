precision highp float;

varying vec2 vUv;

uniform sampler2D uTarget;
uniform vec3 uColor;
uniform vec2 uPoint;
uniform float uRadius;
uniform float uAspect;

void main() {
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  float falloff = exp(-dot(p, p) / uRadius);
  vec3 base = texture2D(uTarget, vUv).xyz;
  gl_FragColor = vec4(base + uColor * falloff, 1.0);
}
