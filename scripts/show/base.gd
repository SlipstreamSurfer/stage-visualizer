class_name ShowBase
extends RefCounted
# The show's state and the live faders. The show is built in layers, each extending the one before:
#   base -> genres -> music (reading the music, rekordbox, decks, mixes) -> director (SV's director.js: moods,
#   programs, scenes, looks; the tables are in looks.gd) -> show.gd (the crowd).

const PALETTES := [
	[Color(1.0, 1.0, 1.0), Color(0.15, 0.35, 1.0)],
	[Color(1.0, 0.06, 0.04), Color(1.0, 0.95, 0.9)],
	[Color(0.85, 0.1, 1.0), Color(0.1, 0.8, 1.0)],
	[Color(1.0, 0.5, 0.08), Color(1.0, 0.95, 0.85)],
	[Color(0.3, 0.1, 1.0), Color(1.0, 0.15, 0.5)],
	[Color(0.1, 1.0, 0.35), Color(1.0, 1.0, 1.0)],
	[Color(0.05, 0.6, 1.0), Color(1.0, 0.1, 0.25)],
]

const HALL_LOOKS := {
	"intro": [["down", "breathe", "all", "a"], ["rakeBack", "sway", "half", "split"], ["curtain", "still", "all", "a"]],
	"groove": [["floor", "sway", "all", "split"], ["cross", "panWave", "all", "alt"], ["fan", "tiltWave", "rows", "split"], ["scatter", "still", "half", "alt"], ["walls", "sway", "all", "rows"]],
	"build": [["tunnel", "circle", "chase", "a"], ["converge", "still", "all", "white"], ["curtain", "tiltWave", "chase", "split"]],
	"break": [["sky", "sway", "all", "b"], ["curtain", "breathe", "half", "b"], ["rakeStage", "still", "all", "split"]],
	"peak": [["floor", "eight", "alt", "split"], ["tunnel", "circle", "all", "white"], ["cross", "panWave", "chase", "alt"], ["sky", "tiltWave", "all", "split"], ["fan", "circle", "alt", "rows"]],
}

# Scenes: what leads and what supports, the way a lighting designer builds a show: less is more. A scene names the
# groups that play, with their cue and how strong (1 leads, half or less supports); a group it leaves out is dark.
# The first peak scene is the short opening hit on a drop. Scenes marked big
# (more than two groups leading, or the rear in the DJ's face) wait until the night has had two drops.
const SCENES := {
	"intro": [
		{"front": ["parallel", 0.5], "wash": ["fill", 0.35]},
		{"hall": ["", 0.45], "wash": ["fill", 0.3]},
		{"back": ["up", 0.5], "spot": ["dj", 0.35]},
	],
	"groove": [
		{"hall": ["", 1.0], "wash": ["split", 0.35]},
		{"front": ["fan", 1.0], "batten": ["kick", 0.4]},
		{"back": ["over", 1.0], "spot": ["carpet", 0.35]},
		{"side": ["across", 1.0], "wash": ["fill", 0.3]},
		{"hall": ["", 0.9], "front": ["parallel", 0.45]},
	],
	"build": [
		{"front": ["wave", 1.0], "hall": ["", 0.5], "batten": ["chase", 0.6]},
		{"back": ["up", 1.0], "spot": ["dj", 0.5], "batten": ["chase", 0.6]},
	],
	"break": [
		{"wash": ["fill", 0.6], "back": ["up", 0.3]},
		{"hall": ["", 0.5], "wash": ["fill", 0.45]},
		{"spot": ["carpet", 0.45], "front": ["parallel", 0.25]},
	],
	"peak": [
		{"hall": ["", 1.0], "front": ["fan", 1.0], "back": ["over", 1.0], "rear": ["stage", 0.8], "side": ["across", 0.7], "delay": ["cross", 0.7], "wash": ["pulse", 0.6], "batten": ["kick", 1.0]},
		{"front": ["fan", 1.0], "hall": ["", 0.9], "batten": ["kick", 0.6]},
		{"back": ["over", 1.0], "rear": ["stage", 0.9], "wash": ["pulse", 0.35]},
		{"side": ["across", 1.0], "delay": ["cross", 0.9], "batten": ["wave", 0.45]},
		{"hall": ["", 1.0], "front": ["cross", 0.45], "wash": ["pulse", 0.35]},
		{"front": ["wave", 1.0], "back": ["converge", 0.9]},
	],
}

# The sequencer: on top of a scene, a pattern runs through the rig on the beat (SV's compositions and gates), and the
# leads move on the beat. Patterns light a share of the fixtures by where they hang; motions step, open and close, hold.
const SEQ := {
	"intro": ["pulse", "wave", "hold"],
	"groove": ["pingpong", "solo", "alternate", "answer", "centre", "chase", "diagonal", "kick4"],
	"build": ["accel", "sweep", "centre"],
	"break": ["pulse", "wave", "hold"],
	"peak": ["sparkle", "chase", "pingpong", "solo", "kick4", "diagonal", "answer", "sweep"],
}

const MOTION := {
	"intro": ["flow", "flow", "hold"], "groove": ["flow", "flow", "step2", "open", "hold"], "build": ["flow", "step1"],
	"break": ["flow"], "peak": ["flow", "flow", "step1", "step2", "open"],
}

const LOOK_BEATS := {"intro": 32.0, "groove": 64.0, "build": 32.0, "break": 32.0, "peak": 64.0, "outro": 32.0}   # how long a look stands


const MASTER := {"intro": 0.4, "groove": 0.8, "build": 0.6, "break": 0.3, "peak": 1.0, "outro": 0.35}

const HALL := {"x": 21.5}

const GROUP := {"hall": 0.8, "front": 1.0, "back": 0.7, "rear": 0.8, "side": 0.8, "delay": 0.8}   # how the beam groups weigh against each other


var rig: Rig

var hall: Hall

var section := "intro"

var build := 0.0

var drop := 0.0

var dropped := false

var _drop_open := false

var blackout := 0.0

var energy := 0.0

var beat := 0.0

var bpm := 125.0

var kick := false

var since_kick := 99.0

var source := ""

var title := ""

var phrase := ""

var next_phrase := ""

var countin := -1.0

var forced := ""

var hall_look: Array = HALL_LOOKS.intro[0]

var scene: Dictionary = SCENES.intro[0]

var palette: Array = PALETTES[0]

var incoming := ""         # with rekordbox: the track on another deck that is playing too (a mix), "" when none

var mix := 0.0             # 0..1, how far that mix is

var _incoming_palette: Array = []

var _mix_from := 0.0

var playing := {}         # with rekordbox: which decks play now ("1".."4" -> true), judged by their clock moving

var _deck_seen := {}      # deck -> [its last time/beat values, when they last moved]

var _rb_clock := 0.0

var _both_from := -1.0    # when a second deck began to play alongside the followed one

var _deck_phrase := {}    # deck -> its phrase last frame, to see a new phrase begin

var _phrase_turn := false # this frame a new phrase began on the followed deck (rekordbox): looks change here

var _last_phrase := ""

var _outgoing := ""       # the track that just gave up the master; it may play on while it is mixed out

var _shown: Array = []     # the colours on the rig now: they glide towards the track's (and, in a mix, the next one's)

var _log := false

var _events: Array = []   # [time, what] of the last few things that happened, for the screen

# Live tuning (local/live.json, read every second while the show runs): a lighting designer's faders, so the show can
# be shaped while someone plays. Missing keys keep their default.
var tune := {"master": 1.0, "pace": 1.0, "strobe": 1.0, "hit": 1.0, "look": 1.0, "beam": 1.0, "groups": {}}

var safe := false         # gentle strobes: never more than three flashes a second (for people sensitive to flashing light)

var genre := "auto"        # an id from GENRE_ORDER; "auto" goes by the tempo

var _look_from := 0.0

var _break_from := 0.0

var _peak_until := 0.0

var _rb_beat := 0.0

var _rb_whole := -1

var _strobe_n := -1

var _kicks := 0

var _hands := 0.0

var _phones := 0.0       # phones up in the crowd, 0..1 (sv_phones)

var _forced_scene := -1   # --scene=N: hold scene N of the part, for pictures

var _m_from := 0.0        # the movement clock is anchored at a phrase: m = _m_at + TAU * (beat - _m_from) / 32 * _pace

var _m_at := 0.0

var _pace := 1.0          # half, normal or double speed, changed only on a phrase

var _swap := false        # the two colours trade places every eight bars, on the beat

var _drops := 0           # drops so far tonight: the big scenes wait for two

var _drop_beat := -100.0

var _section_from := 0.0  # where the part began; parts the show judges itself hold for eight bars at least

# The effect engine, the way a console builds variety: every look draws a movement effect, an intensity effect and a
# colour effect, each a shape with a size, a period in beats and a spread over the fixtures; a new look must differ
# from the one before in all three.
const FX_SHAPES := ["sine", "circle", "eight", "square", "saw", "bounce", "steps"]

const FX_SPREADS := ["none", "linear", "mirror", "random", "rows"]

const IFX_SHAPES := ["chase", "saw", "square", "sine", "pulse"]

const CFX := ["split", "alt", "centre", "chase", "mono", "white_lead"]

var fx := {"shape": "sine", "axis": "pan", "size": 0.2, "period": 8.0, "spread": "linear", "dir": 1.0}

var ifx := {"shape": "chase", "period": 4.0, "width": 0.35, "spread": "linear", "dir": 1.0}

var cfx := "split"

var seq := "pulse"        # the pattern now

var motion := "flow"      # how the leads move now

var _seq_from := 0.0

var _weights := {}        # the scene after the budget: at most two lead, at most two support
var _look_genre := "auto"
var _look_family := ""

const PACE := {"intro": 0.6, "groove": 1.0, "build": 1.15, "break": 0.5, "peak": 1.3, "outro": 0.5}

static func _other(list: Array, was: String) -> String:
	var pool := list.filter(func(x): return x != was)
	if pool.is_empty(): pool = list
	return pool[randi() % pool.size()]

# A big scene: more than two groups leading, or the rear truss lighting the stage (in the DJ's face).
static func _big(c: Dictionary) -> bool:
	var leads := 0
	for g in c:
		if float(c[g][1]) >= 0.8: leads += 1
	return leads > 2 or (c.has("rear") and c.rear[0] == "stage")

# Less is more: at most two groups lead and at most two support (at half strength or less); the drop is the exception.
static func _budget(c: Dictionary, free: bool) -> Dictionary:
	var out := {}
	if free:
		for g in c: out[g] = float(c[g][1])
		return out
	var order: Array = c.keys()
	order.sort_custom(func(x, y): return float(c[x][1]) > float(c[y][1]))
	var leads := 0
	var support := 0
	for g in order:
		var w := float(c[g][1])
		if w >= 0.9 and leads < 2:
			out[g] = w
			leads += 1
		elif support < 2:
			out[g] = minf(w, 0.5)
			support += 1
	return out

# What happened: kept for the screen (and printed with --log).
func note(what: String) -> void:
	_events.push_front([Time.get_ticks_msec() / 1000.0, what])
	if _events.size() > 3: _events.pop_back()
	if _log: print("show: ", what)

func last_event() -> String:
	if _events.is_empty(): return "nothing yet"
	var now := Time.get_ticks_msec() / 1000.0
	return "  ·  ".join(_events.map(func(e): return "%s %ds ago" % [e[1], roundi(now - e[0])]))

# The scene in words: who leads, who supports.
func scene_text() -> String:
	var lead: Array = []
	var support: Array = []
	for g in scene:
		var w: float = scene[g][1]
		var name: String = g + ("" if scene[g][0] == "" else " " + str(scene[g][0]))
		if w >= 0.9: lead.append(name)
		else: support.append(name)
	return "%s · %s · %s · fx %s %s %s/%d · %s   lead: %s   support: %s" % [score_text(), seq, motion, fx.shape, fx.axis, fx.spread, int(fx.period), cfx, ", ".join(lead) if not lead.is_empty() else "none", ", ".join(support) if not support.is_empty() else "none"]

func score_text() -> String:
	return ""

func colours_now() -> Array:
	return _shown if not _shown.is_empty() else palette

static func _x(p: Vector3) -> float:
	return clampf((p.x + 21.0) / 42.0, 0.0, 1.0)

static func _z(p: Vector3) -> float:
	return clampf((p.z - Hall.FRONT) / (26.0 - Hall.FRONT), 0.0, 1.0)

func _cue(group: String) -> String:
	return scene[group][0] if scene.has(group) else "off"

func _weight(group: String) -> float:
	return _weights.get(group, 0.0)

# Read local/live.json: the faders. Called about once a second.
func read_tune(path: String) -> void:
	if not FileAccess.file_exists(path): return
	var data = JSON.parse_string(FileAccess.get_file_as_string(path))
	if data is Dictionary:
		for k in data: tune[k] = data[k]
		if not (tune.groups is Dictionary): tune.groups = {}

# Filled in by the layers above.
func _light(_dt: float) -> void:
	pass

func _pick(_now: bool) -> void:
	pass
