class_name ShowPhrasing
extends RefCounted
# Spatial cues have memory, musical durations and a private replayable random source.
const NAMES := ["Architecture", "Stage silhouette", "Hall wave", "Scattered islands", "Open room", "Side canopy", "Depth layers", "Centre sculpture", "Broken symmetry"]
const BANKS := [Vector3(0.9, 0.55, 0.65), Vector3(0.35, 0.4, 1.0), Vector3(1.0, 0.65, 0.4), Vector3(0.65, 1.0, 0.6), Vector3.ONE,
	Vector3(0.45, 1.0, 0.55), Vector3(0.85, 0.6, 0.5), Vector3(1.0, 0.35, 0.6), Vector3(0.6, 0.85, 0.85)]
var cue := 0
var banks := Vector3.ONE
var wave := 0.0
var stereo := 0.0
var grid := 0.0
var next_at := 0.0
var _rng := RandomNumberGenerator.new()
var _identity := ""
var _recent: Array = []
var _period := 16.0
var _offset := 0.0
var _direction := 1.0

func update(dt: float, clock: float, section: String, build: float, drop: float, flowing: bool, gentle: bool, identity := "show") -> void:
	if identity != _identity or clock < grid - 4.0:
		_identity = identity
		_rng.seed = hash(identity)
		next_at = 0.0
		_recent.clear()
	grid = clock
	var quiet := section in ["intro", "low", "break", "outro"]
	if clock >= next_at:
		var pool: Array = [0, 1, 5, 7] if quiet or flowing else range(NAMES.size())
		var fresh := pool.filter(func(i): return i != cue and not i in _recent)
		if fresh.is_empty(): fresh = pool.filter(func(i): return i != cue)
		_recent.push_front(cue)
		if _recent.size() > 3: _recent.resize(3)
		cue = fresh[_rng.randi_range(0, fresh.size() - 1)]
		var lengths := [64, 96, 128, 192] if quiet or flowing else [32, 48, 64, 96, 128]
		next_at = floorf(clock / 16.0) * 16.0 + lengths[_rng.randi_range(0, lengths.size() - 1)]
		_period = [12.0, 16.0, 24.0, 32.0][_rng.randi_range(0, 3)]
		_offset = _rng.randf_range(0.0, TAU)
		_direction = -1.0 if _rng.randf() < 0.5 else 1.0
	var target: Vector3 = BANKS[cue]
	if quiet: target = target.lerp(Vector3(0.4, 0.35, 1.0), clampf(build, 0.0, 1.0))
	var opening := clampf(drop * 2.0, 0.0, 1.0)
	banks = banks.lerp(target, 1.0 - exp(-dt / 2.0)).lerp(Vector3.ONE, opening)
	var active := not quiet and not flowing and not gentle
	wave = lerpf(wave, 1.0 if active and cue in [2, 3, 6, 8] else 0.0, 1.0 - exp(-dt / 2.0))
	stereo = lerpf(stereo, 1.0 if active and cue in [3, 5, 8] else 0.0, 1.0 - exp(-dt / 2.0))

func gain(bank: int, position: Vector3, drop: float) -> float:
	var depth := clampf((position.z + 36.0) / 72.0, 0.0, 1.0)
	var phase := grid * TAU / _period * _direction + _offset
	var travelling := 0.65 + 0.35 * cos(depth * TAU * (2.0 if cue == 6 else 1.0) - phase)
	# Local islands and curved bands avoid a repeating left/right switch.
	var answering := 0.7 + 0.3 * sin(position.x * 0.16 + depth * 5.0 + sin(phase * 0.37) * 2.0)
	var value := banks[clampi(bank, 0, 2)] * lerpf(1.0, travelling, wave) * lerpf(1.0, answering, stereo)
	return lerpf(maxf(0.1, value), 1.0, clampf(drop * 2.0, 0.0, 1.0))
