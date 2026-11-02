shader_type spatial;
render_mode unshaded, cull_disabled, fog_disabled;

uniform vec4 show_color : source_color = vec4(0.4, 0.1, 0.8, 1.0);
uniform vec4 accent_color : source_color = vec4(0.1, 0.3, 1.0, 1.0);
uniform int visual = 0;
uniform int previous_visual = 0;
uniform float dissolve = 1.0;
uniform float motion = 0.0;
uniform float level = 0.0;
uniform float pulse = 0.0;

float stroke(float distance_to_line, float width) {
	float aa = max(fwidth(distance_to_line), 0.002);
	return 1.0 - smoothstep(width - aa, width + aa, abs(distance_to_line));
}

float pattern(vec2 p, int mode) {
	float t = motion;
	if (mode == 0) {
		// Contour waves.
		return stroke(sin(p.y * 19.0 + sin(p.x * 6.0 + t) * 2.0 - t * 2.0), 0.07);
	} else if (mode == 1) {
		// A rectangular tunnel, with a dark centre.
		float r = max(abs(p.x), abs(p.y) * 0.72);
		return stroke(sin(r * 42.0 - t * 3.0), 0.1) * smoothstep(0.04, 0.18, r);
	} else if (mode == 2) {
		// Split columns open and close rather than flashing the entire panel.
		float columns = sin(p.x * 34.0 + floor(p.y * 5.0) * 0.7 + t);
		return stroke(columns, 0.12 + 0.07 * sin(t * 0.6)) * (0.55 + 0.45 * cos(p.y * 5.0 - t));
	} else if (mode == 3) {
		// A floating orbit, used during breaks.
		vec2 q = p - vec2(sin(t * 0.6) * 0.1, cos(t * 0.4) * 0.08);
		float r = length(q);
		return max(stroke(r - 0.28 - sin(t * 0.4) * 0.04, 0.009), 0.45 * stroke(r - 0.35, 0.005));
	} else if (mode == 4) {
		// Counter-moving diagonal threads.
		float a = stroke(sin((p.x + p.y) * 23.0 + t), 0.06);
		float b = stroke(sin((p.x - p.y) * 23.0 - t * 0.7), 0.06);
		return max(a, b * 0.45);
	}
	// Mirrored horizons.
	float y = abs(p.y) - 0.12 - sin(p.x * 5.0 + t) * 0.05;
	return stroke(y, 0.01) + 0.35 * stroke(y - 0.08, 0.005);
}

void fragment() {
	vec2 p = (UV - vec2(0.5)) * vec2(1.0, 1.4);
	float figure = mix(pattern(p, previous_visual), pattern(p, visual), dissolve);
	float vignette = 1.0 - smoothstep(0.2, 0.86, length(p));
	vec3 colour = mix(show_color.rgb, accent_color.rgb, smoothstep(-0.5, 0.5, p.y) * 0.35);
	float brightness = clamp(figure, 0.0, 1.0) * vignette * level * (0.8 + pulse * 0.2);
	ALBEDO = vec3(0.0);
	EMISSION = colour * brightness * 2.2;
}
