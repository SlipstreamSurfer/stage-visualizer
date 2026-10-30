// The screens on the decks and the mixer, live with the music: on a player the waveform of the track scrolling
// past the playhead, on the mixer the level meters. kind 0 = player, 1 = mixer.
shader_type spatial;
render_mode unshaded, shadows_disabled;

global uniform float sv_beat;
global uniform float sv_energy;
uniform int kind = 0;
uniform float deck = 0.0;   // which deck, so they differ
uniform float playing = 1.0;
uniform float gain = 1.4;

float hash(float x) { return fract(sin(x * 91.7 + deck * 13.1) * 43758.5); }

void fragment() {
	vec2 uv = UV;
	vec3 c = vec3(0.01, 0.012, 0.02);
	if (kind == 0) {
		// the overview strip along the bottom, the big waveform above it, the playhead in the middle
		float pos = sv_beat * 0.12 * playing + deck * 37.0;
		float x = (uv.x - 0.5) * 6.0 + pos;
		float h = 0.15 + 0.6 * hash(floor(x * 8.0)) * (0.6 + 0.4 * sin(floor(x * 8.0) * 0.21));
		float kick = step(0.75, fract(x * 2.0)) * 0.3;
		float y = abs(uv.y - 0.42) * 2.6;
		float wave = step(y, h + kick) * step(uv.y, 0.78) * step(0.08, uv.y);
		vec3 wc = mix(vec3(0.1, 0.45, 1.0), vec3(1.0, 0.55, 0.15), step(0.6, hash(floor(x * 8.0) + 3.0)));
		c += wc * wave * 0.9;
		c += vec3(1.0, 0.2, 0.2) * smoothstep(0.006, 0.0, abs(uv.x - 0.5)) * step(uv.y, 0.8);
		float over = step(0.86, uv.y) * step(uv.y, 0.96);
		c += vec3(0.4, 0.5, 0.6) * over * step(abs(sin(uv.x * 80.0 + deck)), 0.7) * 0.4;
		c += vec3(0.9) * over * step(uv.x, fract(pos * 0.004 + 0.3)) * 0.25;
	} else {
		// four channel meters
		float ch = floor(uv.x * 4.0);
		float lv = clamp(sv_energy * (0.75 + 0.25 * hash(ch + floor(sv_beat * 4.0))) * (ch == 1.0 || ch == 2.0 ? 1.0 : 0.15), 0.0, 1.0);
		float seg = fract(uv.y * 15.0);
		float on = step(1.0 - uv.y, lv) * step(0.25, seg) * step(abs(fract(uv.x * 4.0) - 0.5), 0.25);
		vec3 mc = uv.y < 0.2 ? vec3(1.0, 0.1, 0.05) : uv.y < 0.4 ? vec3(1.0, 0.7, 0.1) : vec3(0.1, 1.0, 0.3);
		c += mc * on;
	}
	ALBEDO = c * gain;
}
