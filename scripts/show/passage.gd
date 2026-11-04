class_name ShowPassage
extends RefCounted
# A passage is one spatial idea held for a musical stretch of 16 or 32 bars. One group leads it, others support it,
# the rest hold a quiet figure or make room. It begins, develops and ends; the director changes scenes, room
# compositions and bar figures only when a passage changes, so the layers move together instead of on their own clocks.
#
# Stage figures (the towers behind the DJ, the stage roof's spots, the delay towers) are designed to read on their
# own, with the hall beams and the stage row switched off and the washes low.

# name: [lead group, support groups]
const FIGURES := {
	"crossing_planes": ["back", ["roof"]],      # two fans from the towers cross slowly over the crowd
	"held_rake": ["back", ["delay"]],           # an asymmetric rake, held, drifting a little
	"opening_columns": ["back", ["roof"]],      # upright columns that slowly open in width, then lean down into the hall
	"roof_cross": ["roof", ["back", "bars"]],   # the roof spots weave: neighbours lean opposite ways, reaching out into the hall
	"roof_fan": ["roof", ["back"]],             # a mirrored fan from the roof that widens and reaches further
	"overhead": ["hall", ["back"]],             # the hall's own looks lead; the stage holds a quiet figure
	"rain": ["rear", ["delay"]],                # beam rain: every beam falls on its own from 45° up to 45° down
}
# Beam rain: one fall takes RAIN_FALL of a cycle of RAIN_BEATS (about 2.5 s at 128 BPM); the beam goes back up dark.
const RAIN_BEATS := 8.0
const RAIN_FALL := 0.7
const RAIN_GROUPS := ["rear", "delay"]
const LEVEL := {"lead": 1.0, "support": 0.6, "hold": 0.3}
# How much of the kick a role may show: the lead breathes with it, the rest barely.
const PULSE := {"lead": 0.75, "support": 0.3, "hold": 0.08}

var index := -1           # counts passages; the director keys its scene changes on it
var figure := "overhead"
var mirror := 1.0         # which way an asymmetric figure leans
var started := 0.0        # in beats
var length := 128.0       # in beats
var progress := 0.0
var _identity := ""
var _rng := RandomNumberGenerator.new()
var _recent: Array = []   # figure, lean and roles: a colour change is not a new passage
var _section := ""
var _change_at := -1.0
var _hall_on := true
var breath := 0.0         # the bass: the figure widens with it
var stepped := false      # techno: heads stand still and change position only in steps (four per passage), in the dark
var route := "across"     # the passage's rhythm: how the lead's light travels from fixture to fixture on the beat
const ROUTES := ["across", "centre", "ladder", "alternate", "pingpong"]
var _open := 0.0
var _clock := 0.0         # the beat grid now, for figures that move on their own
var _grid := 0.0          # a new layer (a lead) came in: the figure opens up, then settles

func open() -> void:
	_open = 1.0

# Called every frame on the beat grid. Returns true when a new passage starts.
func update(grid: float, section: String, dropped: bool, faders: Dictionary, identity: String) -> bool:
	_hall_on = float(faders.get("hall", 1.0)) > 0.3
	_clock = grid
	if identity != _identity or grid < started - 8.0:
		_identity = identity
		_rng.seed = hash(identity + ":passage")
		_recent.clear()
		index = -1
		_section = section
		_change_at = -1.0
		_start(floorf(grid / 16.0) * 16.0, section)
		return true
	if section == "break":
		_section = section
		return false
	var due := grid >= started + length
	# a new part of the track moves on at the next four-bar line, not mid-bar; a drop moves on at once
	if section != _section:
		_section = section
		_change_at = floorf(grid / 16.0) * 16.0 + 16.0 if grid - started >= 32.0 else -1.0
	if _change_at >= 0.0 and grid >= _change_at: due = true
	if dropped: due = true
	if due:
		_start(floorf(grid / 4.0) * 4.0, section)
		return true
	progress = clampf((grid - started) / length, 0.0, 1.0)
	_open *= exp(-maxf(0.0, grid - _grid) / 16.0)   # settles over about four bars
	_grid = grid
	return false

func _start(at: float, section: String) -> void:
	index += 1
	started = at
	progress = 0.0
	_change_at = -1.0
	var quiet := section in ["intro", "low", "outro"]
	length = 128.0 if quiet else [128.0, 128.0, 64.0][_rng.randi_range(0, 2)]
	var pool: Array = FIGURES.keys()
	if not _hall_on: pool.erase("overhead")   # the hall is off on the desk: the stage carries every passage
	if not stepped: pool.erase("rain")         # rain is a techno figure: the other heads stand still meanwhile
	var options := []
	for name in pool:
		for lean in [-1.0, 1.0]:
			var key := "%s:%d" % [name, lean]
			if not key in _recent and not (not _recent.is_empty() and _recent[0].begins_with(name + ":")): options.append(key)
	if options.is_empty(): options = ["%s:1" % pool[0]]
	var pick: String = options[_rng.randi_range(0, options.size() - 1)]
	figure = pick.get_slice(":", 0)
	mirror = float(pick.get_slice(":", 1))
	route = ROUTES[_rng.randi_range(0, ROUTES.size() - 1)]
	_recent.push_front(pick)
	if _recent.size() > 4: _recent.resize(4)

# lead, support or hold, for a fixture group ("bars" for the battens)
func role(group: String) -> String:
	var def: Array = FIGURES[figure]
	if group == def[0]: return "lead"
	if group in def[1]: return "support"
	if figure == "overhead" and group in ["rear", "side"]: return "support"
	return "hold"

# How strong a group plays in this passage; in the rain the hall steps back almost to dark, so the rain reads.
func level(group: String, part: String) -> float:
	if figure == "rain" and group == "hall": return 0.05
	return LEVEL[part]

func stage_leads() -> bool:
	return figure != "overhead"

# begin, development and end of the passage as weights 0..1
func begin() -> float: return smoothstep(0.0, 0.18, _at())
func develop() -> float:
	if stepped: return smoothstep(0.15, 0.85, _at())
	return clampf(smoothstep(0.15, 0.85, progress) + _open * 0.35 + breath * 0.12, 0.0, 1.0)
func ending() -> float: return smoothstep(0.88, 1.0, _at())

# Where the passage is for aiming: in steps when the heads stand still, so a position holds for a quarter of it.
func _at() -> float:
	return (floorf(progress * 4.0) + 0.5) / 4.0 if stepped else progress

# The rhythm of the lead: its light travels between fixtures on the beat (quarters, eighths late in a peak).
# The passage opens with everything on, plays the route, and closes with everything on again.
func chase(group: String, row: int, u: float, grid: float, section: String) -> float:
	if progress < 0.125 or progress >= 0.875: return 1.0
	var rate := 2.0 if section == "peak" and progress >= 0.5 else 1.0
	var step := floori(grid * rate)
	if mirror < 0.0: step = -step
	var station := clampi(floori(u * 8.0), 0, 7)
	var on := false
	match route:
		"across": on = posmod(station - step, 4) == 0                       # two lights travel across, half a rig apart
		"centre": on = mini(3, floori(absf(u - 0.5) * 8.0)) == posmod(step, 4)   # rings from the middle out
		"ladder": on = (row if group == "back" else mini(3, floori(u * 4.0))) == posmod(step, 4)   # bottom to top
		"alternate": on = posmod(station + step, 2) == 0                    # odd and even trade places
		"pingpong":
			var at := posmod(step, 14)
			on = station == (at if at < 8 else 14 - at)
	if not on: return 0.04
	return 1.0 - smoothstep(0.6, 0.98, fposmod(grid * rate, 1.0)) * 0.7

func describe() -> String:
	var def: Array = FIGURES[figure]
	return "%s (%s leads, %s, %d%%)" % [figure.replace("_", " "), def[0], route, roundi(progress * 100.0)]

# Where a stage head aims in this passage, as a point in the hall. m is the show's slow motion clock.
# Returns null-like Vector3.INF when the figure leaves the head to the director's own program.
func stage_target(group: String, row: int, mount: Vector3, xn: float, u: float, m: float) -> Vector3:
	var d := develop()
	var e := ending()
	var b := begin()
	var side := -1.0 if mount.x < 0.0 else 1.0
	var drift := sin(m * 0.18 + u * 0.9) * 0.8
	if figure == "rain" and group in RAIN_GROUPS: return _rain(mount)
	match group:
		"back":
			if row == 3: return _back_spot(mount, u, d, m)
			var height := 6.0 + row * 3.0   # above the crowd: from the DJ's eyes low beams pile up on the horizon
			match figure:
				"crossing_planes":
					# each side's fan swings slowly across the centre line; the two planes meet and pass
					var swing := sin(_at() * TAU * 1.0 + (0.0 if side < 0 else PI)) * lerpf(3.0, 9.0, d * b) * (1.0 - e * 0.6)
					# every tower keeps its own lane (at least the towers' spacing), so the planes cross without bundling
					return Vector3(_lane(mount.x * 1.6 + swing), height + d * 1.5, 26.0)
				"held_rake":
					# all lean one way, rising across the rig: an asymmetric figure that holds
					var lean := mirror * lerpf(4.0, 13.0, d) * (1.0 - e * 0.5)
					return Vector3(_lane(mount.x * 1.4 + lean + drift), 5.0 + u * 5.0 + row * 2.0, 22.0 - u * 6.0)
				"opening_columns":
					# upright, then wider, then leaning down into the hall
					var wide := lerpf(1.1, 2.0, smoothstep(0.1, 0.55, _at()))
					var reach := smoothstep(0.45, 0.95, _at()) * (1.0 - e * 0.5)
					return Vector3(_lane(mount.x * wide), lerpf(14.0, 7.0 + row * 2.5, reach), lerpf(mount.z + 9.0 + row * 2.0, 24.0, reach))
				_:
					# support/hold: a calm, slightly opening fan towards the back of the hall, above the crowd
					return Vector3(_lane(mount.x * 1.6 + drift), 7.0 + row * 2.5 + sin(m * 0.12 + u * 2.0) * 0.8, 30.0)
		"roof":
			match figure:
				"roof_cross":
					# a weave: neighbours lean opposite ways, so the crossings spread over the whole width instead of one knot;
					# the weave reaches from the stage out into the hall and back
					var lean := (1.0 if roundi(u * 11.0) % 2 == 0 else -1.0) * mirror * lerpf(2.5, 6.0, d)
					var z := lerpf(-24.0, 4.0, d) * (1.0 - e) + -24.0 * e
					return Vector3(mount.x * 1.15 + lean, 0.0, z)
				"roof_fan":
					var width := lerpf(10.0, 22.0, d) * (1.0 - e * 0.4)
					return Vector3(xn * width + mirror * d * 3.0, 0.0, lerpf(-24.0, 14.0, d * (1.0 - e * 0.6)) - absf(xn) * 4.0)
				_:
					# support/hold: on the deck and the front of the crowd, a slow mirrored breath
					return Vector3(xn * (13.0 + 2.0 * sin(m * 0.15)), 0.0, -24.0 + absf(xn) * 6.0 + 2.0 * sin(m * 0.1 + xn))
		"delay":
			# the four beams of a tower fan out, each to its own place
			var fan := (u - 0.5) * 10.0
			if figure == "held_rake":
				return Vector3(mount.x * 0.8 + fan + mirror * 5.0 * d, 14.0, mount.z - 14.0)   # leaning towards the stage with the rake
			return Vector3(mount.x + fan, 14.5, mount.z - 6.0 + (u - 0.5) * 8.0)   # nearly upright, quiet
		"rear":
			# from the back of the hall towards the stage, every beam in its own lane, above the crowd
			return Vector3(_lane(mount.x * 1.3 + mirror * d * 4.0), 6.0 + 2.0 * sin(m * 0.1 + u * 3.0), -18.0)
		"side":
			# straight across, slightly rising, staggered by height: parallel lines, no knot
			return Vector3(-side * 6.0, mount.y + 1.5, mount.z + (u - 0.5) * 4.0 + mirror * d * 3.0)
	return Vector3.INF

# Where a falling beam aims: from 45° up to 45° down towards the stage, each beam on its own moment, in its own lane.
func _rain(mount: Vector3) -> Vector3:
	var t := _rain_t(mount)
	var a := deg_to_rad(lerpf(45.0, -45.0, minf(t / RAIN_FALL, 1.0)))
	var d := Vector3(0.0, sin(a), -cos(a))
	# aim at the point where the ray meets the roof or the floor, so the angle survives the hall's limits
	var reach := (14.4 - mount.y) / d.y if d.y > 0.01 else (mount.y - 0.2) / -d.y if d.y < -0.01 else 30.0
	return mount + d * clampf(reach, 1.0, 30.0)

# How lit a falling beam is: it fades in at the top, out near the bottom, and goes back up in the dark.
func rain_level(mount: Vector3) -> float:
	var f := _rain_t(mount) / RAIN_FALL
	if f >= 1.0: return 0.0
	return smoothstep(0.0, 0.1, f) * (1.0 - smoothstep(0.75, 1.0, f))

func _rain_t(mount: Vector3) -> float:
	var own := fposmod(sin(mount.x * 12.9898 + mount.y * 78.233 + mount.z * 3.7) * 43758.5453, 1.0)
	return fposmod(_clock / RAIN_BEATS + own, 1.0)

# Across the hall without piling up at a wall: a soft limit keeps every head's order and some of its spacing.
static func _lane(x: float) -> float:
	return 23.0 * tanh(x / 23.0)

# The spot on each back tower: a slow, high answer to the beams, never into the booth.
func _back_spot(mount: Vector3, u: float, d: float, m: float) -> Vector3:
	var lean := mirror * (u - 0.5) * 2.0
	return Vector3(_lane(mount.x + lean * 8.0 * d), 12.0 + sin(m * 0.1 + u * PI) * 1.0, 18.0)

# Whether a stage head is part of the figure: making room for a sightline is a choice, not a flash.
func stage_on(group: String, row: int) -> bool:
	if figure == "roof_fan" and group == "back": return row >= 2   # only the upper heads support; the booth stays clear
	if figure == "roof_cross" and group == "back": return row != 0
	return true
