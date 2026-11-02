shader_type spatial;
render_mode unshaded, shadows_disabled;

uniform float gain = 8.0;

void fragment() {
	ALBEDO = COLOR.rgb * COLOR.a;
	EMISSION = COLOR.rgb * COLOR.a * gain;
}
