#include '../rotate.glsl'
#include '../sdf.glsl'

uniform int uShape;
uniform vec3 uColor;
uniform float uAlpha;
uniform vec2 uResolution;
uniform vec2 uPointerUv;
uniform vec2 uVelocity;
attribute float aIntensity;
attribute float aAngle;
attribute float aRotate;
varying vec4 vColor;
varying float vRotate;

void main() {
  vec3 newPosition = position;

  float pointerDist = distance(uv, uPointerUv);
  float rise = exp(-pointerDist * pointerDist * 16.);
  newPosition.z += rise;

  vec2 vel = length(uVelocity) > .001 ? normalize(uVelocity) : vec2(0.);
  vel = rotate(vel, aAngle);
  vec2 intensity = vel * clamp(length(uVelocity) / 2000., 0., 1.) * aIntensity;
  newPosition.xy -= .5 * intensity;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);

  // make shapes
  float r = .4;
  vec2 p = uv - .5;
  float d = 0.;
  if      (uShape == 0) d = sdCircle(p, r);
  else if (uShape == 1) d = sdSquare(p, vec2(r));
  else if (uShape == 2) d = sdPentagon(p, r);
  else if (uShape == 3) d = sdHexagon(p, r);
  else if (uShape == 4) d = sdStar5(p, r*1.4, r*1.4);

  // multiply by sqrt(2.) so rotated corners don't get clipped.
  float pointSize = .09 * uResolution.x;
  gl_PointSize = pointSize * sqrt(2.) * smoothstep(0., -.12, d);
  gl_PointSize *= 1. - .4 * clamp(newPosition.z, 0., 1.);

  vColor = vec4(uColor, uAlpha);
  vRotate = aRotate * length(intensity);
}
