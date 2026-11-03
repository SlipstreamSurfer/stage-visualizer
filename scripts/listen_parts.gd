class_name ListenParts
extends RefCounted
# The parts of a track, from six bands of the spectrum: how loud each is against the fullest it has been in this
# track, a hit when it strikes (a kick, a clap, a hat), and when a part comes in as a new layer.
# Bands, not separated instruments: a hat and a shaker share the top band, a lead and a vocal the middle one.

const NAMES := ["kick", "bass", "body", "lead", "clap", "hats"]
const BANDS := [[40.0, 90.0], [90.0, 250.0], [250.0, 600.0], [600.0, 2500.0], [2500.0, 5500.0], [8000.0, 15000.0]]
const THRESHOLD := [0.25, 0.22, 0.18, 0.22, 0.3, 0.12]   # how hard a rise must be to count as a hit
const GAP := [0.12, 0.1, 0.07, 0.09, 0.2, 0.05]           # seconds before the same part can hit again

var level := PackedFloat32Array([0, 0, 0, 0, 0, 0])     # 0..1 against this track's fullest
var hit := PackedFloat32Array([0, 0, 0, 0, 0, 0])       # 1 on a hit, falling away quickly
var present := PackedFloat32Array([0, 0, 0, 0, 0, 0])   # 0..1, how much the part plays over the last seconds
var came_in := [false, false, false, false, false, false]   # this frame: the part came in as a layer
var hits := PackedInt32Array([0, 0, 0, 0, 0, 0])        # hits counted, so a show can walk on with each

var _fast := PackedFloat32Array([0, 0, 0, 0, 0, 0])
var _slow := PackedFloat32Array([0, 0, 0, 0, 0, 0])
var _bed := PackedFloat32Array([0, 0, 0, 0, 0, 0])
var _ref := PackedFloat32Array([1e-4, 1e-4, 1e-4, 1e-4, 1e-4, 1e-4])
var _yard := PackedFloat32Array([1e-4, 1e-4, 1e-4, 1e-4, 1e-4, 1e-4])
var _armed := [true, true, true, true, true, true]
var _last := PackedFloat32Array([-9, -9, -9, -9, -9, -9])
var _out_for := PackedFloat32Array([0, 0, 0, 0, 0, 0])

static func _follow(value: float, target: float, dt: float, seconds: float) -> float:
	return value + (target - value) * (1.0 - exp(-dt / maxf(seconds, 0.0001)))

func reset() -> void:
	for i in 6:
		level[i] = 0.0
		hit[i] = 0.0
		present[i] = 0.0
		came_in[i] = false
		_fast[i] = 0.0
		_slow[i] = 0.0
		_bed[i] = 0.0
		_ref[i] = 1e-4
		_yard[i] = 1e-4
		_out_for[i] = 0.0

# Forget the yardstick of the last track (a new track can be quieter or fuller).
func new_track() -> void:
	for i in 6: _yard[i] = maxf(1e-4, _bed[i])

# One step of sound: raw band magnitudes, the time on the sound clock, the step length.
func update(raw: Array, t: float, dt: float, gate: float) -> void:
	for i in 6:
		var x: float = raw[i] if i < raw.size() else 0.0
		_ref[i] = maxf(1e-4, _follow(_ref[i], x, dt, 0.025 if x > _ref[i] else 8.0))
		_fast[i] = _follow(_fast[i], x, dt, 0.012)
		_slow[i] = _follow(_slow[i], x, dt, 0.2)
		_bed[i] = _follow(_bed[i], x, dt, 1.5)
		_yard[i] = maxf(_bed[i], _yard[i] * exp(-dt / 90.0))
		level[i] = _follow(level[i], clampf(pow(x / _ref[i], 0.75), 0.0, 1.0) * gate, dt, 0.02 if x > _slow[i] else 0.12)
		var rise := maxf(0.0, (_fast[i] - _slow[i]) / _ref[i]) * gate
		if rise < THRESHOLD[i] * 0.4: _armed[i] = true
		if _armed[i] and rise > THRESHOLD[i] and t - _last[i] > GAP[i]:
			_armed[i] = false
			_last[i] = t
			hit[i] = maxf(hit[i], clampf(rise * 1.6, 0.4, 1.0))
			hits[i] += 1
		hit[i] *= exp(-dt * 14.0)
		var p := clampf(_bed[i] / _yard[i], 0.0, 1.0) * gate
		# a layer comes in when the part rises well above where it was for a while
		if p < 0.3: _out_for[i] += dt
		elif p > 0.6:
			if _out_for[i] > 4.0: came_in[i] = true
			_out_for[i] = 0.0
		present[i] = p

func clear_events() -> void:
	for i in 6: came_in[i] = false
