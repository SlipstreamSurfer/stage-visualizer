// A strobe batten (JDC1 or P-5 kind): a line of LED pixels with a strobe tube in the middle.
// Drawn as a MultiMesh of 1 m bars along X: the instance colour is the pixels' colour (alpha: how bright),
// INSTANCE_CUSTOM.x the strobe flash, .y where a chase is, .z how much of a chase (0 = the whole line lit).
shader_type spatial;
render_mode unshaded, shadows_disabled;

uniform float gain = 6.0;
uniform float pixels = 12.0;
varying vec4 tint;
varying vec3 fx;
varying float along;

void vertex() {
	tint = COLOR;
	fx = INSTANCE_CUSTOM.xyz;
	along = VERTEX.x + 0.5;
}

void fragment() {
	float seg = floor(along * pixels) / pixels;
	float gap = smoothstep(0.0, 0.08, fract(along * pixels)) * smoothstep(1.0, 0.92, fract(along * pixels));
	float chase = smoothstep(0.35, 0.0, abs(fract(seg - fx.y + 0.5) - 0.5));
	float lit = mix(1.0, chase, fx.z) * gap;
	ALBEDO = tint.rgb * tint.a * lit * gain + vec3(1.0, 0.97, 0.92) * fx.x * 30.0 + vec3(0.003);
}
