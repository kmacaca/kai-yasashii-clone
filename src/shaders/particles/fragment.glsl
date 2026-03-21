#include '../rotate.glsl'

varying vec4 vColor;
varying float vRotate;

void main() {
  vec2 p = rotate(gl_PointCoord - .5, vRotate);
  if (max(abs(p.x), abs(p.y)) > .5 / sqrt(2.)) discard;

  gl_FragColor = vColor;
  #include <colorspace_fragment>
}
