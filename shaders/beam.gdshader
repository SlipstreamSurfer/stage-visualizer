// A beam of light in haze, drawn as a cone, the way the haze shows it:
//   a core as wide as the fixture's beam angle, with a soft scattered halo around it (the cone's mesh is HALO times
//   wider than the core; across the beam the light falls from the core into the halo);
//   along the beam, as bright as the light is dense: a beam spreads, so a wide one fades with distance and a narrow
//   one carries through the hall, with a little loss in the haze on the way;
//   forward scattering: haze throws more light on along the beam than sideways, so a beam aimed towards you glows
//   (Henyey-Greenstein, g = forward);
//   soft where it meets the floor or a wall, broken up by the gobo when there is one.
// Drawn as a MultiMesh: the instance colour is the beam's colour (alpha: how strong), INSTANCE_CUSTOM.x the gobo,
// .y how the gobo turns, .z the zoom. The cone's mesh runs along +Y from the lens (bottom) to the far end (top).
shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, shadows_disabled, fog_disabled;

uniform float beam_length = 40.0;
uniform float strength = 1.0;
uniform float lens_radius = 0.07;
uniform float spread = 0.05;      // tan of the core's half angle at zoom 1
uniform float halo = 2.2;         // the mesh's width over the core's
uniform float halo_light = 0.1;  // how bright the halo is against the core
uniform float forward = 0.3;
uniform float spokes = 7.0;
global uniform float sv_haze;
uniform sampler2D depth_tex : hint_depth_texture, filter_nearest;
varying vec3 local;
varying vec4 tint;
varying vec3 gobo;
varying vec3 axis;

void vertex() {
	local = VERTEX;
	tint = COLOR;
	gobo = INSTANCE_CUSTOM.xyz;
	axis = normalize((MODELVIEW_MATRIX * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
}

void fragment() {
	float t = clamp(local.y / beam_length + 0.5, 0.0, 1.0);
	float d = t * beam_length;
	// across: where this point lies between the axis (0) and the core's edge (1), seen from here
	float rim = abs(dot(normalize(NORMAL), normalize(VIEW)));
	float u = sqrt(max(0.0, 1.0 - rim * rim)) * halo;
	float across = exp(-pow(u, 4.0) * 1.6) + 0.6 * exp(-u * u * 6.0) + halo_light * exp(-u * u * 0.7);   // edge, hot centre, halo
	// along: the light's density over its width, and the haze taking a little on the way
	float zoom = max(gobo.z, 0.2);
	float width = lens_radius + spread * zoom * d;
	float along = clamp((lens_radius + spread * zoom * 6.0) / width, 0.0, 1.0) * exp(-d / 95.0);
	along *= smoothstep(0.0, 0.015, t) * (1.0 - smoothstep(0.8, 1.0, t));
	// forward scattering, against the light seen from the side
	float c = dot(axis, normalize(VIEW));
	float g = forward;
	float phase = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * c, 1.5) * pow(1.0 + g * g, 1.5) / (1.0 - g * g);
	phase = min(phase, 4.0);
	// the gobo: turning shafts within the beam
	float a = atan(local.x, local.z) + gobo.y;
	float spokes_on = smoothstep(0.3, 0.8, sin(a * spokes) * 0.5 + 0.5) * smoothstep(0.2, 0.7, sin(a * 3.0 + t * 2.0) * 0.5 + 0.6);
	float shape = mix(1.0, 0.2 + 1.3 * spokes_on, gobo.x);
	// soft where the beam meets a surface, and not in the camera's face
	float depth = texture(depth_tex, SCREEN_UV).r;
	vec4 there = INV_PROJECTION_MATRIX * vec4(SCREEN_UV * 2.0 - 1.0, depth, 1.0);
	float soft = clamp((-there.z / there.w + VERTEX.z) / 1.2, 0.0, 1.0);
	float near = smoothstep(1.0, 7.0, -VERTEX.z);
	ALBEDO = tint.rgb * tint.a * across * along * phase * shape * soft * near * strength * sv_haze;
}
