class_name ShowLooks
extends RefCounted
# SV's hangar looks (stage-visualizer/src/hangar-looks.js), ported as they are. The hall heads are programmed the way a
# lighting desk does it. A look combines five things:
#   position  where the beams point: a point in the hall
#   move      an effect on top of it
#   gate      which heads are lit; the lit ones get brighter by GATE_GAIN
#   colour    how the two show colours are spread: [share of the second colour, share of white]
#   beam      narrow, wide or broken up by a gobo
# h is the head (u: its place along the truss 0..1, row: which truss, xn: -1 at the left wall to 1 at the right,
# rp and rt: random numbers that change every eight kicks), p where it hangs now (its truss can be lower than
# planned), k the director's clocks (m runs with the music, phase counts beats) and s the part of the track, the
# build, the energy, the drop and where the stage is. Every look works in every mood: the clocks carry the tempo.

const HALL := {"x": 21.5, "z0": -30.0, "z1": 36.0, "roof": 14.6}

# A moving head as the director sees it: the fixture, and what the director keeps for it.
class Head:
	var fx: Rig.Fixture
	var role := ""           # overhead (over the crowd), stage (behind and on the stage), row (the stage's front row)
	var u := 0.0
	var row := 0
	var xn := 0.0
	var slot := 0            # its place in its role's list
	var rp := 0.0
	var rt := 0.0
	var bank := 0            # 0 the centre of the hall, 1 its sides, 2 the stage: they take turns in the foreground
	var lit_key := 0.0       # which heads stay dark in a genre that lights only a share of them
	var hanging := true      # hangs from a truss (else stands: a tower, the deck)
	var aim := Vector2.ZERO  # pan, tilt it is asked for now (eased)
	var aimed := false
	var cue := ""
	var move_at := -100.0
	var move_level := 1.0
	var level := 1.0
	var gate := 1.0
	var color := Color.WHITE
	var colored := false

static func _clamp(x: float) -> float:
	return clampf(x, 0.0, 1.0)

static func on_side(p: Vector3) -> bool:
	return absf(p.x) > 18.0

static func side_of(p: Vector3) -> float:
	return -1.0 if p.x < 0.0 else 1.0

static func depth(p: Vector3) -> float:
	return _clamp((p.z - HALL.z0) / (HALL.z1 - HALL.z0))

static func across(p: Vector3) -> float:
	return _clamp((p.x + HALL.x) / (HALL.x * 2.0))

static func _hash(a: float, b: float) -> float:
	var x := sin(a * 127.1 + b * 311.7) * 43758.5453
	return x - floorf(x)

# The floor scan: beams in depth zones across the hall; builds and peaks lift a share to the roof.
static func floor_target(h: Head, p: Vector3, k: Dictionary, beat: float, section: String, build: float, energy: float, drop: float) -> Vector3:
	var planned := h.fx.mount
	var bar := int(floorf(beat / 16.0)) % 4
	var zone := posmod(int(floorf((p.z + 30.0) / 10.0)) + bar, 5)
	# pan on a slow show clock, not the kick phase: a 125 BPM beat made beams snap side to side
	var sway := sin(k.m * 0.55 + absf(planned.x) * 0.07 + planned.z * 0.03)
	var roof := _clamp(build * 0.5) if section == "break" else _clamp(0.28 + energy * 0.42 + drop * 0.45) if section == "peak" else 0.0
	var side := -1.0 if h.xn < 0.0 else 1.0
	var x := side * (absf(h.xn) * 5.0 + sway * 7.0) * (-1.0 if k.hangar_look == 1 else 1.0)
	return Vector3(x * (1.0 - roof) + side * (19.0 + sway * 2.0) * roof, 0.35 + roof * 13.8, -16.0 + zone * 11.5 + sway * 2.0)

static func position(name: String, h: Head, p: Vector3, k: Dictionary, s: Dictionary) -> Vector3:
	match name:
		"floor": return floor_target(h, p, k, s.beat, s.section, s.build, s.energy, s.drop)
		"down": return Vector3(p.x, 0.0, p.z)
		"curtain":   # each hall truss spreads a fan of beams across its own width, up to 80 degrees out; the sides look down
			if on_side(p): return Vector3(p.x - side_of(p) * 3.0, 0.0, p.z)
			var a: float = (h.u * 2.0 - 1.0) * 1.4 + 0.25 * sin(k.m * 0.3 + h.row * 0.8)
			return Vector3(p.x + sin(a) * 30.0, p.y - cos(a) * 30.0, p.z)
		"fan": return Vector3(-side_of(p) * 8.0, 0.5, p.z + (h.u - 0.5) * 18.0) if on_side(p) else Vector3(h.xn * 24.0, 2.0, p.z + 5.0)
		"cross": return Vector3(-side_of(p) * 14.0, 1.0, p.z) if on_side(p) else Vector3(-h.xn * 15.0, 0.8, p.z)
		"converge": return Vector3(sin(k.m * 0.25) * 5.0, 3.0 + 2.0 * sin(k.m * 0.4), s.stage + 2.0 * sin(k.m * 0.3))   # over the booth
		# up and out under the roof: long beams through the top of the hall, the trusses taking turns forwards and back
		"sky": return Vector3(-side_of(p) * 12.0, p.y + 3.5, p.z) if on_side(p) else Vector3(p.x * 1.8, p.y + 3.2, p.z + (18.0 if h.row % 2 else -18.0))
		"rakeStage": return Vector3(p.x * 0.8, 0.5, p.z - 14.0)
		"rakeBack": return Vector3(p.x * 0.8, 0.5, p.z + 14.0)
		"walls": return Vector3(-side_of(p) * HALL.x, 6.0, p.z) if on_side(p) else Vector3(side_of(p) * HALL.x, 5.0 + h.u * 2.0, p.z + (h.u - 0.5) * 6.0)
		"tunnel":   # every head aims at a ring around the middle of the hall, closer to the stage
			var a: float = (h.u + (0.5 if on_side(p) else 0.0)) * TAU + h.row * 0.7
			return Vector3(cos(a) * 9.0, 6.5 + sin(a) * 5.0, maxf(s.stage + 4.0, p.z - 16.0))
		"scatter": return Vector3(p.x + h.rp * 9.0, 0.0, p.z + (h.rt - 0.5) * 14.0)   # new places every eight kicks
		# the looks of Techno (Raw / Deep / Hypnotic) alone
		"lanes":   # parallel lanes down the hall, each head in the lane of its place along the truss
			if on_side(p): return Vector3(-side_of(p) * 10.0, 0.5, p.z)
			return Vector3((floorf(h.u * 5.99) / 5.0 * 2.0 - 1.0) * 17.0, 0.0, minf(p.z + 12.0 + (h.row % 2) * 3.0, 30.0))
		"horizon":   # a line of light just above the crowd's hands
			if on_side(p): return Vector3(-side_of(p) * 14.0, 4.3, p.z)
			return Vector3(p.x * 0.9, 4.3, p.z + 15.0)
		"cathedral":   # the two halves lean in and meet under the roof
			if on_side(p): return Vector3(-side_of(p) * 4.0, 13.5, p.z)
			return Vector3(-signf(p.x) * 1.5, 13.8, p.z + (h.u - 0.5) * 6.0)
		"searchlights":   # every head on a slow search of its own
			return Vector3(sin(k.m * 0.2 + h.row * 1.3 + h.u * 5.0) * 16.0, 0.0, p.z + cos(k.m * 0.17 + h.u * 4.0 + h.row) * 14.0)
		"pendulum":   # the whole hall swings from side to side once in four bars
			return Vector3(p.x + sin(k.phase * TAU / 16.0 + h.row * 0.6) * 12.0, 0.0, p.z + 6.0)
		"stairs":   # each truss aims a step further down the hall than the one before
			return Vector3(p.x * 0.6, 0.0, p.z + (h.row - 2) * 7.0 + 8.0)
	return Vector3(p.x, 0.0, p.z)

# How far an effect moves the target scales with how far the beam travels, so an effect on the roof is as big as one on the floor.
static func _reach(t: Vector3, p: Vector3) -> float:
	return maxf(0.5, t.distance_to(p) / 11.0)

static func move(name: String, t: Vector3, h: Head, p: Vector3, k: Dictionary) -> Vector3:
	match name:
		"sway":
			var r := _reach(t, p)
			var a: float = k.m * 0.45 + h.row * 0.9
			return Vector3(t.x + sin(a) * 3.0 * r, t.y, t.z + cos(a * 0.8) * 5.0 * r)
		"circle":
			var r := _reach(t, p) * 8.0
			var a: float = k.phase * TAU / 16.0 + h.u * PI + h.row * 0.9
			return Vector3(t.x + cos(a) * r, t.y, t.z + sin(a) * r)
		"eight":   # a figure of eight
			var r := _reach(t, p)
			var a: float = k.phase * TAU / 32.0 + h.u * PI
			return Vector3(t.x + sin(a) * 9.0 * r, t.y, t.z + sin(2.0 * a) * 5.0 * r)
		"tiltWave": return Vector3(t.x, t.y, t.z + sin(k.phase * TAU / 8.0 - h.u * TAU) * 8.0 * _reach(t, p))   # a ripple along each truss
		"panWave": return Vector3(t.x + sin(k.phase * TAU / 8.0 - h.u * TAU + h.row) * 7.0 * _reach(t, p), t.y, t.z)
		"breathe":   # the fan opens and closes around the point straight below the head
			var o: float = 0.45 + 0.55 * (0.5 + 0.5 * sin(k.m * 0.35 + h.row * 0.6))
			return Vector3(p.x + (t.x - p.x) * o, t.y, p.z + (t.z - p.z) * o)
		"snake": return Vector3(t.x + sin(k.m * 0.5 - t.z * 0.15) * 9.0, t.y, t.z)   # a wave that travels down the hall
		"pendulum": return Vector3(t.x + sin(k.phase * TAU / 8.0 + h.row * 0.7) * 6.0 * _reach(t, p), t.y, t.z)   # a swing locked to the bar
		"drift":   # slow wandering, each head its own way
			var r := _reach(t, p)
			return Vector3(t.x + sin(k.m * 0.21 + h.u * 7.0) * 5.0 * r, t.y, t.z + cos(k.m * 0.17 + h.row * 2.0) * 5.0 * r)
		"pulse":   # in and out once a bar
			var o: float = 0.7 + 0.3 * sin(k.phase * TAU / 4.0)
			return Vector3(p.x + (t.x - p.x) * o, t.y, p.z + (t.z - p.z) * o)
		"stepRow":   # the trusses step forward and back by turns, a bar at a time
			return Vector3(t.x, t.y, t.z + (float(floori(k.phase / 4.0) % 4) - 1.5) * 4.0 * (1.0 if h.row % 2 == 0 else -1.0))
		"spin":   # the whole picture turns slowly round the point straight below each head
			var a: float = k.m * 0.3
			var dx := t.x - p.x
			var dz := t.z - p.z
			return Vector3(p.x + dx * cos(a) - dz * sin(a), t.y, p.z + dx * sin(a) + dz * cos(a))
	return t

# counted: beats, counted at half speed in calm parts; pattern (0..5) a figure that holds for 32 beats
static func gate(name: String, h: Head, counted: float, pattern: int) -> bool:
	var at := h.fx.mount
	match name:
		"all": return true
		"patterns":   # halves, diagonals, from the middle out, alternate heads (real positions)
			var x := _clamp((at.x + 20.0) / 40.0)
			var z := _clamp((at.z + 36.0) / 54.0)
			var step := int(floorf(counted / 2.0))
			if pattern == 0: return (0 if x < 0.5 else 1) == step % 2
			if pattern == 3: return (0 if z < 0.5 else 1) == step % 2
			if pattern == 4: return mini(3, int(floorf(absf(x * 2.0 - 1.0) * 4.0))) == 3 - step % 4
			if pattern == 5: return h.slot % 2 == step % 2
			var diagonal := (x + z) / 2.0 if pattern == 1 else (1.0 - x + z) / 2.0
			return mini(3, int(floorf(diagonal * 4.0))) == step % 4
		"chase": return fposmod(h.u * 2.0 - counted / 8.0 + h.row * 0.25, 1.0) < 0.5   # a band along the trusses
		"across": return fposmod(across(at) - counted / 8.0, 1.0) < 0.35   # a band across the hall
		"frontBack": return fposmod(depth(at) - counted / 16.0, 1.0) < 0.4   # from the stage to the back
		"centre": return fposmod(absf(across(at) * 2.0 - 1.0) - counted / 8.0, 1.0) < 0.5   # out from the middle
		"alternate": return h.slot % 2 == int(floorf(counted / 2.0)) % 2
		"sparkle": return _hash(h.slot + h.row * 31, floorf(counted)) < 0.45   # a different handful every beat
		"trusses": return h.row % 7 == int(floorf(counted / 4.0)) % 7   # one truss at a time
		"outIn": return fposmod(absf(across(at) * 2.0 - 1.0) + counted / 8.0, 1.0) < 0.5   # in from the walls to the middle
		"blocks": return (h.slot / 4 + int(floorf(counted / 2.0))) % 3 == 0   # blocks of four heads, a third of them at a time
		"diag": return fposmod(across(at) + depth(at) - counted / 12.0, 1.0) < 0.4   # a diagonal band across the hall
		"pairsAlt": return (h.slot / 2) % 2 == int(floorf(counted / 2.0)) % 2   # pairs of heads, by turns
	return true

const GATE_GAIN := {"all": 1.0, "chase": 1.5, "across": 1.7, "frontBack": 2.1, "centre": 1.5, "alternate": 1.5, "sparkle": 1.5, "trusses": 2.2,
	"outIn": 1.5, "blocks": 2.0, "diag": 1.7, "pairsAlt": 1.5}

# [share of the second colour, share of white]
static func colour(name: String, h: Head, beats: float) -> Vector2:
	var at := h.fx.mount
	match name:
		"sides": return Vector2(0.0 if (0 if at.x < 0.0 else 1) == int(floorf(beats / 32.0)) % 2 else 1.0, 0.0)   # the sides swap every 32 beats
		"alternate": return Vector2(h.slot % 2, 0.0)
		"trusses": return Vector2(h.row % 2, 0.0)
		"depth": return Vector2(depth(at), 0.0)   # from the first colour at the stage to the second at the back
		"centreWhite": return Vector2(0.0, 0.65 * (1.0 - absf(h.xn)))   # white in the middle of the hall, colour at the sides
	return Vector2.ZERO   # mono

# zoom: how wide the beam opens (multiplies the show's own), gobo: how strongly a gobo breaks it up (-1: leave it)
const BEAMS := {"normal": [1.0, -1.0], "narrow": [0.7, 0.0], "wide": [1.5, 0.0], "gobo": [1.1, 0.85], "tight": [0.5, 0.0], "broad": [1.9, 0.0]}

# The looks, in the order in which tracks get them: name, tiers, position, move, gate, colour, beam.
const HEAD_LOOKS := {
	"floor": ["Floor scan", ["calm", "mid", "big"], "floor", "still", "patterns", "sides", "normal"],
	"curtains": ["Curtains", ["calm", "mid", "big"], "curtain", "still", "all", "sides", "normal"],
	"circles": ["Circles", ["mid", "big"], "down", "circle", "patterns", "sides", "normal"],
	"fan": ["Fans", ["mid", "big"], "fan", "breathe", "all", "sides", "normal"],
	"pillars": ["Pillars", ["calm", "mid"], "down", "still", "chase", "sides", "normal"],
	"cross": ["Crossfire", ["mid", "big"], "cross", "sway", "chase", "sides", "normal"],
	"converge": ["Converge", ["big"], "converge", "still", "all", "sides", "normal"],
	"sky": ["Sky", ["big"], "sky", "sway", "all", "sides", "narrow"],
	"softCurtains": ["Breathing curtains", ["calm", "mid"], "curtain", "breathe", "all", "depth", "wide"],
	"rakeStage": ["Towards the stage", ["calm", "mid"], "rakeStage", "sway", "all", "mono", "wide"],
	"eights": ["Figures of eight", ["mid", "big"], "down", "eight", "alternate", "alternate", "normal"],
	"tunnel": ["Tunnel", ["big"], "tunnel", "still", "all", "depth", "narrow"],
	"snake": ["Snake", ["calm", "mid"], "down", "snake", "chase", "depth", "normal"],
	"ripple": ["Ripple", ["mid", "big"], "down", "tiltWave", "chase", "trusses", "normal"],
	"walls": ["On the walls", ["mid"], "walls", "tiltWave", "trusses", "mono", "gobo"],
	"skyCircles": ["Circles in the roof", ["big"], "sky", "circle", "alternate", "sides", "narrow"],
	"rakeBack": ["Towards the back", ["mid", "big"], "rakeBack", "sway", "frontBack", "trusses", "normal"],
	"softFans": ["Soft fans", ["calm", "mid"], "fan", "sway", "alternate", "trusses", "wide"],
	"scatter": ["Scatter", ["mid", "big"], "scatter", "still", "sparkle", "alternate", "narrow"],
	"panWave": ["Pan wave", ["mid"], "fan", "panWave", "across", "depth", "normal"],
	"spiral": ["Spiral tunnel", ["big"], "tunnel", "spin", "chase", "alternate", "narrow"],
	"turningFans": ["Turning fans", ["mid", "big"], "fan", "spin", "centre", "depth", "gobo"],
	"crossTrusses": ["Crossfire, truss by truss", ["big"], "cross", "panWave", "trusses", "centreWhite", "normal"],
	"convergePulse": ["Converge, truss by truss", ["big"], "converge", "tiltWave", "trusses", "centreWhite", "narrow"],
	"ballyhoo": ["Ballyhoo", ["big"], "fan", "eight", "sparkle", "sides", "narrow"],
	# an 8th entry: the look belongs to Techno (Raw / Deep / Hypnotic) alone and is in no fallback list
	"lanes": ["Lanes", ["calm", "mid"], "lanes", "sway", "all", "depth", "narrow", true],
	"horizon": ["Horizon", ["mid", "big"], "horizon", "tiltWave", "across", "sides", "wide", true],
	"cathedral": ["Cathedral", ["mid", "big"], "cathedral", "breathe", "all", "centreWhite", "narrow", true],
	"searchlights": ["Searchlights", ["calm", "mid", "big"], "searchlights", "still", "chase", "alternate", "normal", true],
	"pendulum": ["Pendulum", ["mid", "big"], "pendulum", "still", "centre", "trusses", "normal", true],
	"stairs": ["Stairs", ["mid"], "stairs", "sway", "trusses", "depth", "narrow", true],
}

static func head_tier(tier: String) -> Array:
	var out := []
	for key in HEAD_LOOKS:
		if tier in HEAD_LOOKS[key][1] and HEAD_LOOKS[key].size() <= 7: out.append(key)
	return out

# Formations of the five hall trusses: drop in metres below their top (v: 0 the front truss, 1 the back one) and
# roll for a truss whose two hoists stop at different heights. A formation holds for minutes; the low ones suit
# calm parts of a track, the high ones peaks. The winches never take a truss lower than 5.5 m (Rig._winch).
const DEEPEST := 6.0
const TRUSS_LOOKS := ["High", "Rising to the back", "Valley", "Low", "Tilted", "Arch", "Zigzag", "Falling to the back",
	"Front low", "Twin valleys", "Ramp, tilted", "Canopy", "Middle low", "Twisted", "Back low"]

static func truss_drop(look: int, v: float, row: int) -> float:
	match look:
		1: return (1.0 - v) * 5.5
		2: return 5.5 * (1.0 - absf(v * 2.0 - 1.0))
		3: return 4.5
		4: return 2.4
		5: return 0.5 + 5.0 * absf(v * 2.0 - 1.0)
		6: return 4.8 if row % 2 else 1.0
		7: return v * 5.5
		8: return [5.5, 1.6, 0.6, 0.4, 0.4][mini(row, 4)]
		9: return [0.4, 5.0, 1.2, 5.0, 0.4][mini(row, 4)]
		10: return (1.0 - v) * 4.5
		11: return DEEPEST
		12: return [1.0, 1.4, 5.5, 1.4, 1.0][mini(row, 4)]
		13: return 1.8
		14: return [0.4, 0.4, 0.6, 1.6, 5.5][mini(row, 4)]
	return 0.0

static func truss_roll(look: int, row: int) -> float:
	match look:
		4: return (0.07 if row % 2 else -0.07)
		10: return 0.06
		13: return (row / 2.0 - 1.0) * 0.07
	return 0.0

# which parts of a track a formation suits, from how low it hangs on average
static func truss_tiers(look: int) -> Array:
	var mean := 0.0
	for row in 5: mean += truss_drop(look, row / 4.0, row) / 5.0
	return ["calm", "mid"] if mean >= 3.2 else ["mid", "big"] if mean <= 1.6 else ["calm", "mid", "big"]

# How often the show changes look and formation (seconds): looks at a scene cue once held, formations likewise,
# or sooner for a new track.
const PACE := {
	"calm": {"head": 80.0, "truss": 240.0, "track": 60.0},
	"normal": {"head": 40.0, "truss": 120.0, "track": 30.0},
	"lively": {"head": 20.0, "truss": 60.0, "track": 15.0},
}

# How each kind of music uses the rig: which looks the heads take (in order of preference), which formations the
# trusses go to, how quickly things change (pace: a multiple of the chosen pace's times), what share of the hall
# heads is lit outside a drop (lit), which of the stage row's looks it plays (row), how far the row is up against
# the others (rowLevel) and how far the washes are up (wash). A mood without a style of its own takes its family's.
const STYLES := {
	"techno": {"looks": ["floor", "curtains", "cross", "fan", "circles", "ripple", "rakeBack", "crossTrusses", "converge", "pillars", "snake", "skyCircles"], "trusses": ["High", "Low", "Tilted", "Zigzag", "Valley", "Rising to the back", "Twisted", "Front low"], "pace": 1.0, "lit": 0.9,
		"row": ["curtain", "chase", "pairs", "sweep", "fan", "crowd"], "rowLevel": 1.0, "wash": 0.75},
	"raw": {"looks": ["pillars", "cross", "floor", "ripple", "crossTrusses", "scatter", "walls", "converge"], "trusses": ["Low", "Canopy", "Tilted", "Twisted", "Front low"], "pace": 0.9, "lit": 0.75,
		"row": ["chase", "pairs", "curtain", "crowd"], "rowLevel": 0.9, "wash": 0.45},
	"deep": {"looks": ["softCurtains", "rakeStage", "snake", "walls", "softFans", "tunnel", "sky", "pillars"], "trusses": ["High", "Rising to the back", "Arch", "Falling to the back", "Middle low"], "pace": 1.8, "lit": 0.6,
		"row": ["curtain", "wave", "fan", "vee"], "rowLevel": 0.75, "wash": 1.15},
	"hypnotic": {"looks": ["softCurtains", "curtains", "tunnel", "snake", "rakeStage", "sky", "walls", "spiral", "softFans"], "trusses": ["High", "Arch", "Rising to the back", "Falling to the back", "Valley"], "pace": 2.2, "lit": 0.5,
		"row": ["curtain", "wave", "vee"], "rowLevel": 0.7, "wash": 1.0},
	"electro": {"looks": ["scatter", "eights", "panWave", "cross", "turningFans", "ripple", "ballyhoo"], "trusses": ["Zigzag", "Twin valleys", "Tilted", "Twisted"], "pace": 0.8, "lit": 0.9,
		"row": ["pairs", "chase", "sweep", "wave"], "rowLevel": 1.0, "wash": 0.8},
	"hard": {"looks": ["scatter", "ballyhoo", "crossTrusses", "convergePulse", "circles", "eights", "cross", "turningFans", "converge"], "trusses": ["Low", "Canopy", "Zigzag", "Twin valleys", "Front low", "Tilted"], "pace": 0.5, "lit": 1.0,
		"row": ["sweep", "crowd", "pairs", "chase", "fan"], "rowLevel": 1.1, "wash": 0.7},
	"harddance": {"looks": ["ballyhoo", "scatter", "turningFans", "eights", "spiral", "convergePulse", "circles"], "trusses": ["Canopy", "Zigzag", "Low", "Twisted", "Twin valleys"], "pace": 0.45, "lit": 1.0,
		"row": ["crowd", "sweep", "pairs", "fan", "chase"], "rowLevel": 1.15, "wash": 0.8},
	"trance": {"looks": ["sky", "skyCircles", "fan", "tunnel", "spiral", "converge", "softFans", "turningFans", "curtains"], "trusses": ["Arch", "Valley", "High", "Twin valleys", "Rising to the back"], "pace": 0.9, "lit": 1.0,
		"row": ["fan", "vee", "wave", "curtain", "sweep"], "rowLevel": 1.0, "wash": 1.3},
	"trancedeep": {"looks": ["softCurtains", "tunnel", "sky", "softFans", "spiral", "rakeStage"], "trusses": ["High", "Arch", "Valley"], "pace": 1.6, "lit": 0.65,
		"row": ["curtain", "wave", "vee"], "rowLevel": 0.8, "wash": 1.2},
	"psytrance": {"looks": ["spiral", "turningFans", "circles", "eights", "skyCircles", "scatter", "ballyhoo"], "trusses": ["Twisted", "Zigzag", "Arch", "Tilted"], "pace": 0.7, "lit": 0.95,
		"row": ["sweep", "wave", "pairs", "chase"], "rowLevel": 1.0, "wash": 1.1},
	"House": {"looks": ["fan", "softFans", "circles", "eights", "panWave", "curtains", "rakeStage", "sky", "floor"], "trusses": ["High", "Arch", "Valley", "Rising to the back", "Middle low"], "pace": 1.1, "lit": 0.85,
		"row": ["sweep", "wave", "fan", "vee"], "rowLevel": 0.85, "wash": 1.5},
	"melodic": {"looks": ["sky", "softCurtains", "tunnel", "fan", "softFans", "converge", "skyCircles"], "trusses": ["Arch", "High", "Valley", "Falling to the back"], "pace": 1.5, "lit": 0.75,
		"row": ["wave", "vee", "curtain", "fan"], "rowLevel": 0.9, "wash": 1.35},
	"progressive": {"looks": ["sky", "curtains", "tunnel", "fan", "converge", "softFans"], "trusses": ["Arch", "High", "Rising to the back"], "pace": 1.4, "lit": 0.8,
		"row": ["vee", "wave", "fan", "curtain"], "rowLevel": 0.95, "wash": 1.3},
	"organic": {"looks": ["softCurtains", "softFans", "rakeStage", "walls", "snake"], "trusses": ["High", "Arch", "Middle low"], "pace": 2.0, "lit": 0.55,
		"row": ["curtain", "wave"], "rowLevel": 0.6, "wash": 1.5},
	"mainstage": {"looks": ["ballyhoo", "converge", "sky", "turningFans", "crossTrusses", "fan", "spiral", "circles"], "trusses": ["Arch", "Valley", "Twin valleys", "High", "Zigzag"], "pace": 0.7, "lit": 1.0,
		"row": ["fan", "crowd", "sweep", "vee", "pairs"], "rowLevel": 1.1, "wash": 1.1},
	"Bass": {"looks": ["scatter", "eights", "cross", "turningFans", "ripple", "converge", "circles"], "trusses": ["Low", "Zigzag", "Tilted", "Front low", "Twin valleys"], "pace": 0.7, "lit": 0.9,
		"row": ["pairs", "sweep", "crowd", "chase"], "rowLevel": 1.0, "wash": 0.9},
	"deepdubstep": {"looks": ["pillars", "walls", "rakeStage", "snake", "tunnel"], "trusses": ["Low", "Canopy", "Middle low"], "pace": 1.6, "lit": 0.5,
		"row": ["curtain", "pairs"], "rowLevel": 0.7, "wash": 0.8},
	"Open format": {"looks": ["fan", "circles", "eights", "panWave", "softFans", "curtains", "floor"], "trusses": ["High", "Arch", "Valley", "Rising to the back"], "pace": 1.2, "lit": 0.85,
		"row": ["sweep", "wave", "fan", "vee"], "rowLevel": 0.9, "wash": 1.3},
	"Concert & ambient": {"looks": ["softCurtains", "rakeStage", "walls", "softFans"], "trusses": ["High", "Arch"], "pace": 2.5, "lit": 0.45,
		"row": ["curtain", "wave"], "rowLevel": 0.6, "wash": 1.4},
}

# Techno (Raw / Deep / Hypnotic) is one Beatport genre but three ways of playing: the raw, the deep and the hypnotic
# styles above are put together for it, so a track draws on all their looks, formations and rows.
const RAW_DEEP_STYLE := {
	"looks": ["pillars", "cross", "softCurtains", "floor", "ripple", "tunnel", "crossTrusses", "snake", "scatter", "rakeStage", "spiral",
		"walls", "curtains", "softFans", "sky", "converge", "circles", "skyCircles", "lanes", "horizon", "cathedral", "searchlights", "pendulum", "stairs"],
	"trusses": ["High", "Low", "Canopy", "Arch", "Tilted", "Rising to the back", "Twisted", "Valley", "Falling to the back", "Front low", "Middle low"],
	"pace": 0.75, "lit": 0.75, "row": ["chase", "curtain", "pairs", "wave", "crowd", "vee", "sweep", "fan"], "rowLevel": 0.85, "wash": 0.8,
}

static func style_of(mood_key: String, family: String) -> Dictionary:
	if STYLES.has(mood_key): return STYLES[mood_key]
	if STYLES.has(family): return STYLES[family]
	return STYLES.techno

# The stage's row of heads along the front of the deck, played as one instrument, as on the big techno stages: a
# curtain straight up, a fan, a V crossing over the booth, a wave or a sweep running along the row, crossing pairs, a
# chase, a sunburst on the drop and, at a peak, beams low over the crowd. name, tiers, gate, colour.
const ROW_UP := 14.2   # the height the beams are aimed at: just under the roof
const ROW_LOOKS := {
	"curtain": ["Curtain", ["calm", "mid"], "all", "mono"],
	"fan": ["Fan", ["calm", "mid", "big"], "all", "sides"],
	"vee": ["V over the booth", ["mid", "big"], "all", "sides"],
	"wave": ["Wave", ["mid", "big"], "all", "mono"],
	"sweep": ["Sweep", ["mid", "big"], "all", "mono"],
	"pairs": ["Crossing pairs", ["mid", "big"], "alternate", "alternate"],
	"chase": ["Chase", ["calm", "mid", "big"], "chase", "mono"],
	"sunburst": ["Sunburst", ["big"], "all", "centreWhite"],
	"crowd": ["Over the crowd", ["big"], "centre", "mono"],   # over the heads, never into the eyes
}
const ROW_LEVEL := {"calm": 0.45, "mid": 0.7, "big": 0.95}

static func row_tier(tier: String) -> Array:
	var out := []
	for key in ROW_LOOKS:
		if key != "sunburst" and tier in ROW_LOOKS[key][1]: out.append(key)
	return out

static func row_aim(name: String, h: Head, p: Vector3, k: Dictionary) -> Vector3:
	match name:
		"curtain": return Vector3(p.x, ROW_UP, p.z + 2.5)
		"fan": return Vector3(p.x * 2.4, ROW_UP, p.z + 7.0)
		"vee": return Vector3(-p.x * 0.9, ROW_UP, p.z + 3.5)
		"wave": return Vector3(p.x, ROW_UP, p.z + 4.0 + sin(k.phase * TAU / 8.0 - h.u * TAU * 1.5) * 9.0)
		"sweep": return Vector3(p.x + sin(k.phase * TAU / 16.0 - h.u * 2.0) * 10.0, ROW_UP, p.z + 5.0)
		"pairs": return Vector3(p.x + (6.0 if h.slot % 2 else -6.0), ROW_UP, p.z + 5.0)
		"chase": return Vector3(p.x, ROW_UP, p.z + 3.0)
		"sunburst": return Vector3(p.x * 3.5, ROW_UP * 0.8, p.z + 9.0)
		"crowd": return Vector3(p.x * 1.4 + sin(k.m * 0.4) * 4.0, 4.6, p.z + 24.0)
	return Vector3(p.x, ROW_UP, p.z + 2.5)
