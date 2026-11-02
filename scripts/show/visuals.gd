class_name StageVisuals
extends RefCounted
# Cues stay on musical phrases. Motion uses elapsed show time so replay speed cannot change it.
var current := 0
var previous := 0
var blend := 1.0
var motion := 0.0
var level := 0.0
var pulse := 0.0
var focus := 0.0
var color := Color.WHITE
var accent := Color.WHITE
var _section := ""
var _next_at := 0.0
var _grid := 0.0
var _identity := ""
var _recent: Array = []
var _rng := RandomNumberGenerator.new()

func update(dt: float, grid: float, section: String, energy: float, colours: Array, master: float, gentle: bool, enabled: bool, identity := "show", focused := false) -> void:
	if _identity != identity or grid < _grid - 4.0:
		_identity = identity
		_rng.seed = hash(identity + ":visuals")
		_next_at = 0.0
		_recent.clear()
	_grid = grid
	var quiet := section in ["intro", "break", "outro", "low"]
	if (grid >= _next_at or section != _section) and blend >= 1.0:
		var choices: Array = range(6).filter(func(i): return i != current and not i in _recent)
		var next: int = 3 if section == "break" else choices[_rng.randi_range(0, choices.size() - 1)]
		# Finish the current dissolve before accepting another cue.
		if next != current and blend >= 1.0:
			previous = current
			current = next
			blend = 0.0
			_recent.push_front(previous)
			if _recent.size() > 2: _recent.resize(2)
		_section = section
		_next_at = floorf(grid / 16.0) * 16.0 + (64.0 if quiet else [32.0, 48.0, 64.0, 96.0][_rng.randi_range(0, 3)])
	blend = minf(1.0, blend + dt / (4.0 if quiet else 2.0))
	motion += dt * (0.12 if quiet else 0.2 + clampf(energy, 0.0, 1.0) * 0.25)
	pulse = 0.0 if gentle or quiet else pow(0.5 + 0.5 * cos(grid * TAU / 4.0), 4.0)
	var screen_turn := 1.0 if enabled and not quiet and focused else 0.0
	focus = lerpf(focus, screen_turn, 1.0 - exp(-dt / 2.0))
	var target := (0.22 if quiet else 0.45 + focus * 0.35) * clampf(master, 0.0, 1.0)
	# A blackout closes immediately; ordinary changes dissolve.
	level = 0.0 if master <= 0.0 or not enabled else lerpf(level, target, 1.0 - exp(-dt / 0.7))
	if not colours.is_empty():
		color = color.lerp(colours[0], 1.0 - exp(-dt / 1.4))
		accent = accent.lerp(colours[mini(1, colours.size() - 1)], 1.0 - exp(-dt / 1.4))

func apply(material: ShaderMaterial) -> void:
	material.set_shader_parameter("show_color", color)
	material.set_shader_parameter("accent_color", accent)
	material.set_shader_parameter("visual", current)
	material.set_shader_parameter("previous_visual", previous)
	material.set_shader_parameter("dissolve", smoothstep(0.0, 1.0, blend))
	material.set_shader_parameter("motion", motion)
	material.set_shader_parameter("level", level)
	material.set_shader_parameter("pulse", pulse)
