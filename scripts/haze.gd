class_name Haze
extends RefCounted
# One multiplier for the beam haze and the hall's existing fog volumes; no new lights or fog grid.
const DENSITY := 0.009

static func level(value: Variant = 1.0) -> float:
	if not (value is float or value is int): return 1.0
	var n := float(value)
	return clampf(n, 0.0, 2.0) if is_finite(n) else 1.0

static func apply(value: Variant, environment: Environment, hall: Hall) -> float:
	var k := level(value)
	RenderingServer.global_shader_parameter_set("sv_haze", k)
	environment.volumetric_fog_density = DENSITY * k
	hall.set_haze(k)
	return k
