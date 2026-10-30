// CDJ glass, jog LCD and transport rings; no waveform samples are supplied by rkbx_link.
shader_type spatial;
render_mode unshaded, shadows_disabled;
global uniform float sv_beat;
global uniform float sv_energy;
uniform int kind = 0; // waveform, transport, jog LCD, level strip
uniform float deck = 1.0;
uniform float playing = 0.0;
uniform bool linked = false;
uniform bool cue = false;
uniform float position = 0.0;
float hash(float x) { return fract(sin(x * 91.7 + deck * 13.1) * 43758.5); }
void fragment() {
	vec2 uv = UV;
	vec3 c = vec3(0.008, 0.012, 0.019);
	if (kind == 0) {
		// Preserve SV's live procedural waveform, now positioned by this deck's beat.
		float pos = linked ? position * 0.12 : sv_beat * 0.12;
		float x = (uv.x - 0.5) * 6.0 + pos + deck * 37.0;
		float h = 0.15 + 0.6 * hash(floor(x * 8.0)) * (0.6 + 0.4 * sin(floor(x * 8.0) * 0.21));
		float wave = step(abs(uv.y - 0.48) * 3.5, h) * step(0.25, uv.y) * step(uv.y, 0.74);
		vec3 wc = mix(vec3(0.1, 0.45, 1.0), vec3(1.0, 0.55, 0.15), step(0.6, hash(floor(x * 8.0) + 3.0)));
		c += wc * wave * 0.9;
		c += vec3(0.9, 0.95, 1.0) * (1.0 - step(0.003, abs(uv.x - 0.5))) * step(0.25, uv.y) * step(uv.y, 0.76);
		float overview = step(0.79, uv.y) * step(uv.y, 0.86);
		c += vec3(0.2, 0.45, 0.65) * overview * step(abs(sin(uv.x * 80.0 + deck)), 0.7);
		c += vec3(0.04, 0.1, 0.17) * (1.0 - step(0.002, abs(fract(uv.x * 8.0) - 0.5))) * step(0.25, uv.y) * step(uv.y, 0.75);
	} else if (kind == 1) {
		float r = length(uv - 0.5);
		if (r > 0.5) discard;
		c = vec3(0.1, 0.11, 0.12);
		float ring = step(0.41, r) * step(r, 0.49);
		c += (cue ? vec3(1.0, 0.45, 0.03) : vec3(0.05, 1.0, 0.23)) * ring * (cue ? 0.6 : mix(0.025, 1.4, playing));
	} else if (kind == 2) {
		vec2 p = uv - 0.5;
		float r = length(p);
		if (r > 0.5) discard;
		c *= 0.3;
		float ring = step(0.35, r) * step(r, 0.47);
		c += vec3(0.1, 0.45, 0.95) * ring * mix(0.035, 1.0, playing);
		float angle = atan(p.y, p.x) + 3.14159;
		float needle = step(6.1, mod(angle - position * 1.3, 6.28318)) * step(0.2, r) * step(r, 0.45);
		c += vec3(1.0, 0.35, 0.15) * needle * playing;
		c += vec3(0.12, 0.3, 0.45) * (1.0 - step(0.25, r)) * playing;
	} else {
		float lv = clamp(sv_energy * (0.8 + 0.2 * hash(floor(sv_beat * 4.0))), 0.0, 1.0);
		float on = step(1.0 - uv.y, lv) * step(0.2, fract(uv.y * 18.0));
		c += (uv.y < 0.15 ? vec3(1.0, 0.05, 0.02) : uv.y < 0.35 ? vec3(1.0, 0.65, 0.04) : vec3(0.08, 0.85, 0.2)) * on;
	}
	ALBEDO = c;
}
