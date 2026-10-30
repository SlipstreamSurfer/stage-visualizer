// A beam of light in haze, drawn as a cone: brightest down its middle as you look at it, fading with distance from
// the lens, soft where it meets the floor or a wall, broken up by the gobo when there is one.
// Drawn as a MultiMesh: the instance colour is the beam's colour (alpha: how strong), INSTANCE_CUSTOM.x the gobo,
// .y how the gobo turns. The cone's mesh runs along +Y from the lens (bottom) to the far end (top).
shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, shadows_disabled, fog_disabled;

uniform float beam_length = 40.0;
uniform float strength = 1.0;
uniform float sharp = 3.0;
uniform float spokes = 7.0;
global uniform float sv_haze;
uniform sampler2D depth_tex : hint_depth_texture, filter_nearest;
varying vec3 local;
varying vec4 tint;
varying vec2 gobo;

void vertex() {
	local = VERTEX;
	tint = COLOR;
	gobo = INSTANCE_CUSTOM.xy;
}

void fragment() {
	float t = clamp(local.y / beam_length + 0.5, 0.0, 1.0);
	float rim = abs(dot(normalize(NORMAL), normalize(VIEW)));
	float core = pow(rim, sharp) * 0.75 + pow(rim, sharp * 5.0) * 0.6;
	float fall = pow(1.0 - t, 1.5) * smoothstep(0.0, 0.012, t);
	float a = atan(local.x, local.z) + gobo.y;
	float g = smoothstep(0.3, 0.8, sin(a * spokes) * 0.5 + 0.5) * smoothstep(0.2, 0.7, sin(a * 3.0 + t * 2.0) * 0.5 + 0.6);
	float shape = mix(1.0, 0.2 + 1.3 * g, gobo.x);
	float depth = texture(depth_tex, SCREEN_UV).r;
	vec4 there = INV_PROJECTION_MATRIX * vec4(SCREEN_UV * 2.0 - 1.0, depth, 1.0);
	float soft = clamp((-there.z / there.w + VERTEX.z) / 1.2, 0.0, 1.0);
	float near = smoothstep(1.0, 7.0, -VERTEX.z);
	ALBEDO = tint.rgb * tint.a * core * fall * shape * soft * near * strength * sv_haze;
}
