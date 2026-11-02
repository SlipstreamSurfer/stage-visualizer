// Coated building surfaces, lit directly by the rig and by its low-cost diffuse return.
shader_type spatial;

uniform vec3 surface_color : source_color = vec3(0.18, 0.20, 0.19);
uniform float surface_roughness : hint_range(0.0, 1.0) = 0.8;
uniform float surface_metallic : hint_range(0.0, 1.0) = 0.0;
uniform float return_gain : hint_range(0.0, 2.0) = 0.7;
uniform vec3 bounce_pos_0;
uniform vec3 bounce_pos_1;
uniform vec3 bounce_pos_2;
uniform vec3 bounce_pos_3;
uniform vec3 bounce_colour_0;
uniform vec3 bounce_colour_1;
uniform vec3 bounce_colour_2;
uniform vec3 bounce_colour_3;
uniform bool profiled = false;
uniform sampler2D panel_color : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D panel_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
varying vec3 panel_tint;
varying vec3 world_position;

vec3 bounced(vec3 position, vec3 colour) {
	vec3 delta = world_position - position;
	return colour / (1.0 + dot(delta, delta) / 100.0);
}

void vertex() {
	panel_tint = COLOR.rgb;
	world_position = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	ALBEDO = surface_color * panel_tint;
	if (profiled) {
		ALBEDO *= texture(panel_color, UV).rgb;
		NORMAL_MAP = texture(panel_normal, UV).rgb;
		NORMAL_MAP_DEPTH = 0.65;
	}
	ROUGHNESS = surface_roughness;
	METALLIC = surface_metallic;
	SPECULAR = 0.3;
	// A diffuse return falls off with distance from each lit part of the hall.
	vec3 reflected = bounced(bounce_pos_0, bounce_colour_0) + bounced(bounce_pos_1, bounce_colour_1)
		+ bounced(bounce_pos_2, bounce_colour_2) + bounced(bounce_pos_3, bounce_colour_3);
	EMISSION = ALBEDO * reflected * return_gain;
}
