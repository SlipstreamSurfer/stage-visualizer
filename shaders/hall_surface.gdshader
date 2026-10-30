// Coated building surfaces, lit directly by the rig and by its low-cost diffuse return.
shader_type spatial;

uniform vec3 surface_color : source_color = vec3(0.18, 0.20, 0.19);
uniform float surface_roughness : hint_range(0.0, 1.0) = 0.8;
uniform float surface_metallic : hint_range(0.0, 1.0) = 0.0;
uniform float return_gain : hint_range(0.0, 2.0) = 0.7;
uniform vec3 show_return = vec3(0.0);
uniform bool profiled = false;
uniform sampler2D panel_color : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D panel_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
varying vec3 panel_tint;

void vertex() {
	panel_tint = COLOR.rgb;
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
	// Approximate bounced show light; zero when the show is dark, never a house light.
	EMISSION = ALBEDO * show_return * return_gain;
}
