// One opaque surface for all people. Colour: r = joint, g = side, b = material.
// INSTANCE_CUSTOM: x = timing, y = energy, z = hands threshold, w = appearance.
shader_type spatial;

global uniform float sv_beat;
global uniform float sv_energy;
global uniform float sv_hands;
global uniform float sv_phones;
// What people wear (Crowd.CLOTH, HAIR, PANTS): colours and where each share ends, from 0 to 1.
uniform vec3 cloth_colours[14];
uniform float cloth_ends[14];
uniform vec3 hair_colours[8];
uniform float hair_ends[8];
uniform vec3 pants_colours[6];
uniform float pants_ends[6];
// The stage's light on the crowd (Crowd.stage_light), strongest at the barrier.
uniform vec3 stage_light = vec3(0.0);
uniform float barrier_z = -24.0;
varying vec3 tint;
varying float stage_near;
varying float screen_light;
varying float skin_part;
varying float face_part;
varying vec3 rest_position;

void vertex() {
	rest_position = VERTEX;
	vec4 c = INSTANCE_CUSTOM;
	float side = COLOR.g * 2.0 - 1.0;
	float region = COLOR.b;
	float arm = step(0.1, COLOR.r);
	float lower_arm = arm * (1.0 - step(0.75, COLOR.r));
	bool screen_part = region > 0.6 && region < 0.65;
	bool phone_part = (region > 0.3 && region < 0.4) || screen_part;
	bool hair_part = region > 0.4 && region < 0.6;
	float head = (VERTEX.y > 1.49 && arm < 0.5) ? 1.0 : 0.0;
	float ph = sv_beat + c.x * 0.18;
	float pulse = sin(ph * 6.283185);
	float energy = clamp(sv_energy, 0.0, 1.0) * c.y;
	// Some people watch, others film. The DJ (z > 1) keeps both hands at the decks.
	float owns_phone = (INSTANCE_ID % 13 == 0 && c.z < 1.0) ? 1.0 : 0.0;
	float phone_up = owns_phone * smoothstep(0.12 + c.x * 0.2, 0.7 + c.x * 0.2, sv_phones);
	if (phone_part) {
		vec3 wrist = vec3(0.255, 0.81, 0.0);
		VERTEX = wrist + (VERTEX - wrist) * phone_up;
	}
	screen_light = (screen_part ? 1.0 : 0.0) * phone_up;
	skin_part = region > 0.9 ? 1.0 : 0.0;
	face_part = head * skin_part;
	if (hair_part) {
		// Cropped hair through to a fuller crown; the skull stays intact underneath.
		float hair_height = mix(0.4, 1.5, fract(c.w * 17.13));
		VERTEX.y = 1.665 + (VERTEX.y - 1.665) * hair_height;
		NORMAL.y /= hair_height;
	}
	float nod = (0.035 + energy * 0.16) * pulse;
	vec2 neck = vec2(1.49, 0.0);
	vec2 rel_head = VERTEX.yz - neck;
	VERTEX.yz = mix(VERTEX.yz, neck + mat2(vec2(cos(nod), sin(nod)), vec2(-sin(nod), cos(nod))) * rel_head, head);
	NORMAL.yz = mix(NORMAL.yz, mat2(vec2(cos(nod), sin(nod)), vec2(-sin(nod), cos(nod))) * NORMAL.yz, head);
	float up = smoothstep(c.z, c.z + 0.28, sv_hands);
	float phone_arm = phone_up * step(0.5, COLOR.g);
	float bend = mix(0.18 + 0.65 * fract(c.x * 19.4 + side * 0.31) + up * 0.5, 0.12, phone_arm);
	vec2 elbow = vec2(1.12, 0.0);
	mat2 fold = mat2(vec2(cos(bend), -sin(bend)), vec2(sin(bend), cos(bend)));
	VERTEX.yz = mix(VERTEX.yz, elbow + fold * (VERTEX.yz - elbow), lower_arm);
	NORMAL.yz = mix(NORMAL.yz, fold * NORMAL.yz, lower_arm);
	float a = side * (0.07 + up * mix(2.05, 2.8, fract(c.w * 11.3 + side * 0.37)) + energy * 0.11 * sin(ph * 3.141593 + side));
	a = mix(a, 2.95, phone_arm);
	vec2 shoulder = vec2(0.23 * side, 1.40);
	mat2 lift = mat2(vec2(cos(a), sin(a)), vec2(-sin(a), cos(a)));
	VERTEX.xy = mix(VERTEX.xy, shoulder + lift * (VERTEX.xy - shoulder), arm);
	NORMAL.xy = mix(NORMAL.xy, lift * NORMAL.xy, arm);
	// Independent shoulder width, depth and head proportions, on top of instance height.
	float build = mix(0.82, 1.20, fract(c.w * 13.71));
	float width = mix(build, mix(0.92, 1.10, fract(c.x * 9.7)), head);
	float depth = mix(0.82, 1.22, fract(c.w * 5.31));
	// Hips and legs against the shoulders: narrow shoulders tend to wider hips, for a mixed crowd.
	float hips = mix(1.16, 0.92, fract(c.w * 13.71)) * mix(0.96, 1.04, fract(c.x * 3.9));
	width *= mix(1.0, hips, (1.0 - smoothstep(0.86, 1.12, VERTEX.y)) * (1.0 - arm) * (1.0 - head));
	VERTEX.x *= width;
	VERTEX.z *= depth;
	NORMAL.x /= width;
	NORMAL.z /= depth;
	// A knee dip on each beat, then airborne on energetic drops; some jump every other beat.
	float dip = (0.5 - 0.5 * cos(ph * 6.283185)) * (0.01 + 0.045 * energy);
	float excitement = max(sv_energy, sv_hands * smoothstep(0.25, 0.5, sv_energy));
	float jumping = smoothstep(0.72, 0.96, excitement) * smoothstep(0.28, 0.75, c.y) * (1.0 - phone_up) * step(c.z, 1.0);
	float jump_phase = ph * (fract(c.w * 8.3) > 0.55 ? 0.5 : 1.0);
	float flight = max(0.0, sin(jump_phase * 6.283185));
	float jump = flight * flight * (0.12 + c.y * 0.20) * jumping;
	VERTEX.y -= dip * smoothstep(0.1, 0.95, VERTEX.y);
	VERTEX.y += jump;
	float sway = sin(sv_beat * 1.570796 + c.x * 40.0) * (0.009 + 0.022 * c.y);
	float forward_sway = sin(sv_beat * 0.785398 + c.w * 30.0) * 0.018 * c.y;
	VERTEX.x += sway * VERTEX.y;
	VERTEX.z += forward_sway * VERTEX.y;
	NORMAL.y -= sway * NORMAL.x + forward_sway * NORMAL.z;
	NORMAL = normalize(NORMAL);
	float k = fract(c.w * 7.31);
	vec3 skin = mix(vec3(0.43, 0.31, 0.24), vec3(0.085, 0.050, 0.036), fract(c.w * 3.17));
	int ci = 13;
	for (int i = 12; i >= 0; i--) { if (k < cloth_ends[i]) ci = i; }
	vec3 cloth = cloth_colours[ci];
	float pk = fract(c.x * 5.3);
	int pi = 5;
	for (int i = 4; i >= 0; i--) { if (pk < pants_ends[i]) pi = i; }
	vec3 pants = pants_colours[pi];
	float hk = fract(c.w * 23.8);
	int hi = 7;
	for (int i = 6; i >= 0; i--) { if (hk < hair_ends[i]) hi = i; }
	vec3 hair = hair_colours[hi];
	stage_near = clamp(1.0 - ((MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).z - barrier_z) / 45.0, 0.25, 1.0);
	vec3 shoes = mix(vec3(0.012), vec3(0.16, 0.15, 0.14), step(0.85, fract(c.w * 12.9)));
	tint = screen_part ? vec3(0.42, 0.62, 0.85) : phone_part ? vec3(0.008) : skin_part > 0.5 ? skin : region > 0.65 ? shoes : hair_part ? hair : region > 0.15 ? pants : cloth;
}

void fragment() {
	// Soft socket and brow shadows, anchored before the nod and sway; no painted eyes or emissive skin.
	float shade = 0.0;
	if (face_part > 0.5 && rest_position.z > 0.025) {
		vec2 eye = vec2(abs(rest_position.x) - 0.043, rest_position.y - 1.641) / vec2(0.018, 0.010);
		vec2 brow = vec2(abs(rest_position.x) - 0.043, rest_position.y - 1.657) / vec2(0.022, 0.005);
		float front = smoothstep(0.025, 0.075, rest_position.z);
		shade = front * (0.22 * (1.0 - smoothstep(0.0, 1.0, dot(eye, eye)))
			+ 0.12 * (1.0 - smoothstep(0.0, 1.0, dot(brow, brow))));
	}
	ALBEDO = tint * (1.0 - shade);
	ROUGHNESS = mix(0.94, 0.80, skin_part);
	SPECULAR = mix(0.25, 0.20, skin_part);
	// Lit cloth edges follow the actual rig, including its dark side. Only screens emit.
	RIM = mix(0.18, 0.08, skin_part);
	RIM_TINT = 0.7;
	EMISSION = tint * screen_light * 1.5;
	// The stage's light: an edge on hair and shoulders facing it (seen from behind), some colour on the fronts.
	vec3 world_normal = normalize((INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).xyz);
	float toward = clamp(dot(world_normal, normalize(vec3(0.0, 0.5, -1.0))), 0.0, 1.0);
	float edge = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 3.0);
	float catch_light = 0.3 + 0.7 * clamp(dot(tint, vec3(0.3, 0.6, 0.1)) * 2.0, 0.0, 1.0);
	EMISSION += stage_light * stage_near * toward * (tint * 0.35 + edge * catch_light * 0.45);
}
