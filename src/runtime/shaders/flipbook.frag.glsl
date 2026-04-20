precision highp float;

uniform sampler2D uAtlas;
uniform float uCols;
uniform float uRows;
uniform float uFrame;

varying vec2 vUv;

void main() {
  float frame = floor(uFrame);
  float col = mod(frame, uCols);
  float row = floor(frame / uCols);
  float atlasRow = (uRows - 1.0) - row;

  vec2 cell = vec2(1.0 / uCols, 1.0 / uRows);
  vec2 uv = vec2((col + vUv.x) * cell.x, (atlasRow + vUv.y) * cell.y);

  vec4 texel = texture2D(uAtlas, uv);
  if (texel.a < 0.01) discard;
  gl_FragColor = texel;
}
