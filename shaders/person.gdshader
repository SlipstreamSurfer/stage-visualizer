// One surface and material for the crowd. Colour: r = arm joint, g = side, b = body region.
// INSTANCE_CUSTOM: x = timing/build, y = movement, z = hands threshold, w = appearance.
shader_type spatial;

global uniform float sv_beat;
global uniform float sv_energy;
global uniform float sv_hands;
global uniform float sv_phones;
varying vec3 tint;
varying float screen_light;

void vertex() {
	vec4 c = INSTANCE_CUSTOM;
	float side = COLOR.g * 2.0 - 1.0;
	float build = mix(0.88, 1.12, fract(c.x * 13.71));
	float region = COLOR.b;
	bool screen_part = region > 0.6 && region < 0.65;
	bool phone_part = (region > 0.3 && region < 0.4) || screen_part;
	// One in 25 in every quality level. c.z > 1 identifies the DJ, who has no phone.
	float owns_phone = (INSTANCE_ID % 25 == 0 && c.z < 1.0) ? 1.0 : 0.0;
	float phone_up = owns_phone * smoothstep(0.08 + c.x * 0.15, 0.75 + c.x * 0.15, clamp(sv_phones, 0.0, 1.0));
	if (phone_part) {
		vec3 wrist = vec3(0.275, 0.82, 0.0);
		VERTEX = wrist + (VERTEX - wrist) * phone_up;
	}
	screen_light = (screen_part ? 1.0 : 0.0) * phone_up * (1.6 + 0.4 * sv_energy);
	bool hair_part = region > 0.4 && region < 0.6;
	if (hair_part) {
		float hair_size = mix(0.15, 1.3, fract(c.w * 17.13));
		VERTEX = vec3(0.0, 1.65, 0.0) + (VERTEX - vec3(0.0, 1.65, 0.0)) * hair_size;
	}
	float ph = sv_beat + c.x * 0.23;
	float up = smoothstep(c.z, c.z + 0.25, sv_hands);
	float arm = step(0.1, COLOR.r);
	float lower_arm = arm * (1.0 - step(0.75, COLOR.r));
	// Different elbows and shoulders, with one hand often lower than the other.
	float phone_arm = phone_up * step(0.5, COLOR.g);
	float bend = mix((0.15 + 0.55 * fract(c.x * 19.4 + side)) + up * 0.65, 0.2, phone_arm);
	vec2 elbow = vec2(1.12, 0.0);
	vec2 forearm = VERTEX.yz - elbow;
	vec2 folded = elbow + vec2(forearm.x * cos(bend) + forearm.y * sin(bend), -forearm.x * sin(bend) + forearm.y * cos(bend));
	VERTEX.yz = mix(VERTEX.yz, folded, lower_arm);
	NORMAL.yz = mix(NORMAL.yz, vec2(NORMAL.y * cos(bend) + NORMAL.z * sin(bend), -NORMAL.y * sin(bend) + NORMAL.z * cos(bend)), lower_arm);
	float a = side * (0.06 + up * mix(1.9, 2.75, fract(c.w * 11.3 + side * 0.37)) + c.y * 0.12 * sin(ph * 3.14159 + side));
	a = mix(a, 2.9, phone_arm);
	vec2 shoulder = vec2(0.23 * side, 1.43);
	vec2 rel = VERTEX.xy - shoulder;
	vec2 turned = shoulder + vec2(rel.x * cos(a) - rel.y * sin(a), rel.x * sin(a) + rel.y * cos(a));
	VERTEX.xy = mix(VERTEX.xy, turned, arm);
	NORMAL.xy = mix(NORMAL.xy, vec2(NORMAL.x * cos(a) - NORMAL.y * sin(a), NORMAL.x * sin(a) + NORMAL.y * cos(a)), arm);
	VERTEX.x *= build;
	NORMAL.x /= build;
	float bounce = (0.5 - 0.5 * cos(6.28318 * ph)) * (0.012 + 0.055 * sv_energy) * c.y;
	VERTEX.y -= bounce * smoothstep(0.15, 0.95, VERTEX.y);
	float sway = sin(sv_beat * 1.5708 + c.x * 40.0) * (0.012 + 0.022 * c.y);
	VERTEX.x += sway * VERTEX.y;
	VERTEX.z += sin(sv_beat * 0.7854 + c.w * 30.0) * 0.02 * c.y * VERTEX.y;
	NORMAL.y -= sway * NORMAL.x;
	NORMAL = normalize(NORMAL);
	float k = fract(c.w * 7.31);
	vec3 skin = mix(vec3(0.66, 0.47, 0.36), vec3(0.14, 0.085, 0.055), fract(c.w * 3.17));
	vec3 cloth = k < 0.48 ? vec3(0.025, 0.028, 0.032) : k < 0.65 ? vec3(0.09, 0.11, 0.13) : k < 0.79 ? vec3(0.12, 0.055, 0.045) : k < 0.9 ? vec3(0.08, 0.12, 0.09) : vec3(0.36, 0.33, 0.28);
	vec3 pants = mix(vec3(0.02, 0.024, 0.03), vec3(0.075, 0.095, 0.13), fract(c.x * 5.3));
	vec3 hair = mix(vec3(0.018, 0.012, 0.008), vec3(0.27, 0.17, 0.075), fract(c.w * 23.8));
	vec3 shoes = mix(vec3(0.018), vec3(0.35, 0.34, 0.32), step(0.8, fract(c.w * 12.9)));
	tint = screen_part ? vec3(0.55, 0.75, 1.0) : phone_part ? vec3(0.012, 0.014, 0.018) : region > 0.9 ? skin : region > 0.65 ? shoes : hair_part ? hair : region > 0.15 ? pants : cloth;
}

void fragment() {
	ALBEDO = tint;
	ROUGHNESS = 0.9;
	EMISSION = tint * screen_light;
}
