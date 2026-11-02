class_name ShowGestures
extends RefCounted
# Lightning accents the current scene. A depth chase develops over several phrases.
var name := ""
var started := 0.0
var duration := 0.0
var mix := 0.0
var elapsed := 0.0
var next_at := 32.0
var stagger := false
var leads: Array[float] = []
var variants: Array[int] = [0, 1, 2, 3]
var path: Array[Vector3] = []
var _gentle := false
var _identity := ""
var _rng := RandomNumberGenerator.new()
var _last_grid := 0.0
var _boundary := -1
var scope := "hall"
var route_seed := 0

func start(effect: String, grid: float, seed_value: int, gentle := false) -> void:
	_rng.seed = seed_value
	name = effect if effect in ["lightning", "depth_chase", "spatial_sequence"] else ""
	if gentle and name == "lightning": name = ""
	_gentle = gentle
	started = grid
	elapsed = 0.0
	duration = [4.0, 8.0][_rng.randi_range(0, 1)] if name == "lightning" else [16.0, 32.0][_rng.randi_range(0, 1)] if name == "spatial_sequence" else [64.0, 96.0][_rng.randi_range(0, 1)]
	scope = ["hall", "stage", "sides"][_rng.randi_range(0, 2)]
	route_seed = _rng.randi()
	stagger = true
	leads.clear()
	for column in 4: leads.append(_rng.randi_range(0, 3) * 0.125)
	variants = [0, 1, 2, 3]
	for i in range(3, 1, -1):
		var j := _rng.randi_range(1, i)
		var swap := variants[i]
		variants[i] = variants[j]
		variants[j] = swap
	path.clear()
	var point := Vector3(_rng.randf_range(-16.0, 16.0), 7.0, _rng.randf_range(-30.0, 30.0))
	for i in 33:
		path.append(point)
		point += Vector3(_rng.randf_range(-13.0, 13.0), 0, _rng.randf_range(-17.0, 17.0))
		point.x = clampf(point.x, -18.0, 18.0)
		point.z = clampf(point.z, -34.0, 33.0)

func update(dt: float, grid: float, section: String, drop: float, gentle: bool, flowing: bool, identity: String, _tempo := 120.0, sequences := false) -> void:
	if identity != _identity or grid < _last_grid - 4.0:
		_identity = identity
		_rng.seed = hash(identity + ":gestures")
		name = ""
		mix = 0.0
		next_at = grid + 128.0
		_boundary = -1
	_last_grid = grid
	elapsed = maxf(0.0, grid - started)
	var boundary := floori(grid / 16.0)
	var allowed := section in ["groove", "peak"] and drop < 0.1 and not flowing
	if boundary != _boundary:
		_boundary = boundary
		if allowed and grid >= next_at and mix < 0.01:
			var choices := ["lightning"]
			if sequences and not gentle: choices.append("spatial_sequence")
			if grid >= 256.0: choices.append("depth_chase")
			if gentle: choices = ["depth_chase"] if grid >= 256.0 else []
			if choices.is_empty():
				next_at = grid + 128.0
				return
			var effect: String = choices[_rng.randi_range(0, choices.size() - 1)]
			start(effect, grid, _rng.randi(), gentle)
			# Every episode buys at least four times its duration of ordinary choreography.
			next_at = grid + duration + maxf(128.0, duration * 4.0) + [0.0, 32.0, 64.0][_rng.randi_range(0, 2)]
	_gentle = gentle
	if gentle and name == "lightning": name = ""
	if not allowed: duration = minf(duration, elapsed)
	var active := name != "" and allowed and elapsed < duration
	# Enter on the groove, without a sudden whole-room cut.
	mix = move_toward(mix, 1.0 if active else 0.0, dt * (4.0 if name == "lightning" else 0.8))

func _chase(position: Vector3, variant: int) -> float:
	var column := clampi(floori((position.x + 22.0) / 11.0), 0, 3)
	var lead: float = leads[column] if stagger and variant in [1, 3] else 0.0
	var cycle := 8.0 if _gentle else 4.0 if variant == 2 else 2.0
	var progress := fposmod(elapsed / cycle + lead, 1.0)
	var depth := clampf((position.z + 37.0) / 74.0, 0.0, 1.0)
	var width := 0.25 if _gentle else 0.15
	var value := 1.0 - smoothstep(0.035, width, absf(depth - progress))
	if variant == 2:
		var echo := 1.0 - smoothstep(0.025, width * 0.65, absf(depth - fposmod(progress - 0.23, 1.0)))
		value = maxf(value, echo * 0.65)
	if variant == 3:
		value *= 0.35 + 0.65 * (0.5 + 0.5 * sin(elapsed * TAU / 4.0 + column * 1.7))
	return value

func weight(position: Vector3) -> float:
	if name == "lightning":
		if path.is_empty(): return 0.0
		var step := elapsed * 4.0
		var index := clampi(floori(step), 0, path.size() - 1)
		var here := Vector2(position.x, position.z)
		var node := Vector2(path[index].x, path[index].z)
		var branch := Vector2(path[mini(index + 1, path.size() - 1)].x, path[mini(index + 1, path.size() - 1)].z)
		var core := maxf(0.0, 1.0 - here.distance_to(node) / 11.0)
		var fork := maxf(0.0, 1.0 - here.distance_to(branch) / 8.0) * 0.45
		return maxf(core, fork) * (1.0 - smoothstep(0.45, 0.95, fposmod(step, 1.0)))
	if name == "depth_chase":
		var phrase := floori(elapsed / 16.0)
		var current := variants[posmod(phrase, variants.size())]
		var previous := variants[posmod(phrase - 1, variants.size())] if phrase > 0 else current
		return lerpf(_chase(position, previous), _chase(position, current), smoothstep(0.0, 2.0, fposmod(elapsed, 16.0)))
	return 0.0

func apply(rig: Rig, master: float, groups: Dictionary, _gentle_mode: bool) -> void:
	if mix <= 0.0 or name == "": return
	for f in rig.fixtures:
		if name == "spatial_sequence":
			if f.kind != Rig.WASH and _in_scope(f.group):
				f.level *= lerpf(1.0, LightSequencer.fixture_gain(f.mount, elapsed, 0, _gentle, route_seed), mix)
			continue
		if name == "depth_chase" and f.kind == Rig.WASH: continue
		var gain: float = float(groups.get("wash", 1.0)) if f.kind == Rig.WASH else float(groups.get(f.group, 1.0))
		var value := weight(f.mount)
		if name == "lightning":
			# Keep every colour, aim and gate. The path accents only what the current scene already plays.
			f.level = minf(maxf(f.level, master * gain), f.level * (1.0 + value * mix * 1.4))
		else:
			var body := 0.35 if _gentle else 0.0
			var chase := (body + (1.0 - body) * value) * master * gain
			if f.group == "front": chase *= 0.18
			f.level = lerpf(f.level, chase, mix)
	for b in rig.battens:
		if name == "spatial_sequence":
			if _in_scope(b.group): b.level *= lerpf(1.0, LightSequencer.fixture_gain(b.mount, elapsed, 0, _gentle, route_seed), mix)
			continue
		var value := weight(b.mount)
		if name == "lightning":
			b.level = minf(maxf(b.level, master * float(groups.get("batten", 1.0))), b.level * (1.0 + value * mix * 1.4))
		else:
			b.level = lerpf(b.level, value * master * float(groups.get("batten", 1.0)), mix)
	# Keep the running show's strobes, blinders, pixel movement and screen cues intact.

func _in_scope(group: String) -> bool:
	match scope:
		"hall": return group == "hall"
		"stage": return group in ["front", "back", "roof"]
	return group in ["side", "delay", "rear"]
