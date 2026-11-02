shader_type spatial;
render_mode unshaded, cull_disabled, fog_disabled;

uniform vec4 show_color : source_color = vec4(0.4, 0.1, 0.8, 1.0);
uniform float show_energy = 0.0;
uniform float beat = 0.0;

void fragment() {
	vec2 p = (UV - vec2(0.5)) * vec2(1.0, 1.4);
	float drift = TIME * (0.08 + show_energy * 0.12);
	float bands = abs(sin(p.y * 20.0 + sin(p.x * 7.0 + drift) * 2.0 - drift * 3.0));
	float line = 1.0 - smoothstep(0.015, 0.07, bands);
	float vignette = smoothstep(0.85, 0.15, length(p));
	float brightness = (0.025 + line * (0.18 + 0.32 * show_energy)) * vignette;
	ALBEDO = show_color.rgb * brightness;
	EMISSION = show_color.rgb * brightness;
}
