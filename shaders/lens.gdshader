// The front glass of a fixture, an LED line or a lamp: as bright as the light behind it, so that bloom picks it up.
// Drawn as a MultiMesh: the instance colour, times its alpha.
shader_type spatial;
render_mode unshaded, shadows_disabled;

uniform float gain = 8.0;
varying vec4 tint;

void vertex() { tint = COLOR; }

void fragment() { ALBEDO = tint.rgb * tint.a * gain + vec3(0.004); }
