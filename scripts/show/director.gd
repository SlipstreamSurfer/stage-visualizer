class_name ShowDirector
extends ShowMusic
# The director of SV in the browser (stage-visualizer/src/director.js and signals.js), ported as it is: it turns what
# the music does into what every fixture does. Moods per genre, a palette per track, programs and scenes held for a
# phrase, the Hangar's head looks, truss formations and the stage row (looks.gd), washes that never flash with the
# kick, bars on the kick, strobes and blinders only where they belong.
# The rig here is Godot's: the hall trusses, the rear truss and the side towers are the heads over the crowd
# (overhead); the towers behind the DJ, the delay towers and the stage roof's spots are the stage's heads; the beams
# along the deck's front edge are the stage row; every wash is a wash and every batten a bar (and a strobe).

const L := preload("res://scripts/show/looks.gd")

# The genres here (Beatport's) and SV's moods.
const MOOD_OF := {
	"140-deep-dubstep-grime": "deepdubstep", "afro-house": "afro", "amapiano": "amapiano", "ambient-experimental": "ambient",
	"bass-club": "bassclub", "bass-house": "basshouse", "brazilian-funk": "brazilianfunk", "breaks-breakbeat-uk-bass": "breaks",
	"dance-pop": "dancepop", "deep-house": "deephouse", "dj-tools": "djtools", "downtempo": "downtempo", "drum-and-bass": "dnb",
	"dubstep": "dubstep", "electro": "electro", "electronica": "electronica", "funky-house": "funky",
	"hard-dance-hardcore-neo-rave": "harddance", "hard-techno": "hard", "house": "house", "indie-dance": "indiedance",
	"jackin-house": "jackin", "mainstage": "mainstage", "melodic-house-techno": "melodic", "minimal-deep-tech": "minimal",
	"nu-disco-disco": "nudisco", "organic-house": "organic", "progressive-house": "progressive", "psy-trance": "psytrance",
	"tech-house": "techhouse", "techno-peak-time-driving": "techno", "techno-raw-deep-hypnotic": "raw",
	"trance-main-floor": "trance", "trance-raw-deep-hypnotic": "trancedeep", "trap-future-bass": "trap", "uk-garage-bassline": "ukg",
}

# A mood is how a kind of music is lit: its colours, how fast things move, whether there are strobes, what a drop
# does. Every mood starts from BASE and overrides what makes it different.
const ENDING := 30.0
const SETTLE := 3.0
const LATE := 10.0
const BASE := {
	"family": "House", "flow": false,
	"decay": 8.0, "speed": 0.9, "strobes": true, "strobeAt": 0.6, "strobeRate": 1.0,
	"level": 1.0, "haze": 1.0, "breathe": 0.0, "warm": 0.0, "wash": 0.0,
	"sceneKicks": 64, "sceneMin": 24.0, "paletteHold": 240.0,
	"drop": 1.0, "blinder": 1.0,
}
const CALM := {"strobes": false, "blinder": 0.3}
const MOODS := {
	"house": {"palettes": [[0xff7a1a, 0xff2a6a, 0x2a8aff, 0xffd02a], [0xff3a8a, 0x8a3aff, 0x2ad0ff, 0xff8a2a]], "decay": 6.0, "speed": 0.6, "strobeAt": 0.75},
	"deephouse": {"calm": true, "palettes": [[0x2a40d0, 0x8a30c0], [0xff9a40, 0xc03a50], [0x1890a0, 0x3a40c0]], "decay": 3.5, "speed": 0.3, "breathe": 0.45, "level": 0.8, "haze": 1.1},
	"techhouse": {"palettes": [[0xffffff, 0xff3a1a, 0xffb020, 0x2a6aff], [0x20e0a0, 0xffffff, 0xff2a8a, 0xffffff]], "decay": 9.0, "speed": 0.8},
	"funky": {"calm": true, "palettes": [[0xff2a8a, 0xffd02a, 0x2ad0ff, 0x8aff2a], [0xff7a1a, 0xff2a6a, 0xffe02a, 0x2a8aff]], "decay": 6.0, "speed": 0.7, "breathe": 0.3, "blinder": 0.7},
	"jackin": {"palettes": [[0xffb020, 0xff2a3a, 0x2a6aff, 0xffffff], [0xff3a8a, 0xffd02a, 0x2ad0ff, 0xffffff]], "decay": 8.0, "speed": 0.75, "strobeAt": 0.7},
	"afro": {"calm": true, "palettes": [[0xff8a20, 0xc8401a, 0x20a060, 0xd03a8a], [0xffb040, 0x8a3a1a, 0x1a8a8a, 0xff5a30]], "decay": 4.0, "speed": 0.45, "breathe": 0.5, "blinder": 0.5},
	"amapiano": {"calm": true, "palettes": [[0xffb030, 0x8a30c0, 0xff5a8a, 0x30a0c0], [0xff8a20, 0xc02a70, 0xffd060, 0x5a30c0]], "decay": 3.2, "speed": 0.35, "breathe": 0.5},
	"organic": {"palettes": [[0xffa040, 0xff5a3c, 0x2fd0b0, 0xd070ff]], "decay": 2.6, "speed": 0.3, "strobes": false, "breathe": 0.6, "haze": 0.8, "blinder": 0.6},
	"melodic": {"palettes": [[0x2a5aff, 0x20c0d0], [0xff9a30, 0xff3a6a], [0x8a40ff, 0x2a8aff], [0xffffff, 0x40a0ff]], "decay": 5.0, "speed": 0.45, "strobeAt": 0.8, "breathe": 0.3, "haze": 1.2, "sceneKicks": 128, "sceneMin": 40.0},
	"progressive": {"palettes": [[0x3a50ff, 0xc040ff], [0x20b0e0, 0xffc040], [0xff4a8a, 0x5a40ff], [0xffffff, 0x30c0c0]], "decay": 5.5, "speed": 0.5, "strobeAt": 0.75, "breathe": 0.2, "haze": 1.15, "sceneKicks": 128, "sceneMin": 36.0},
	"minimal": {"palettes": [[0xffffff, 0x2a6aff], [0xffffff, 0xff3a1a], [0x20e0c0, 0xffffff]], "decay": 9.0, "speed": 0.35, "level": 0.75, "strobeAt": 0.8, "sceneKicks": 128},
	"nudisco": {"calm": true, "palettes": [[0xff3aa0, 0xffc030, 0x30d0ff, 0xa040ff], [0xff5a30, 0xff30a0, 0xffe040, 0x40a0ff]], "decay": 5.0, "speed": 0.6, "breathe": 0.4, "blinder": 0.6},
	"indiedance": {"palettes": [[0xe02030, 0x7030d0], [0x20c0d0, 0xe02070], [0xffffff, 0xe02030]], "decay": 6.0, "speed": 0.5, "strobeAt": 0.8, "level": 0.9, "haze": 1.2},
	"dancepop": {"palettes": [[0xff3aa0, 0x30a0ff, 0xffe040, 0xffffff], [0xa040ff, 0xff5a30, 0x30e0d0, 0xffffff]], "decay": 7.0, "speed": 0.8},
	"mainstage": {"palettes": [[0xffffff, 0xff2a1a, 0x2a6aff, 0xffd020], [0xffffff, 0xff2a8a, 0x20d0ff, 0xff2a8a], [0xffa030, 0xffffff, 0x2a6aff, 0xffffff]], "decay": 9.0, "speed": 1.1, "level": 1.1, "strobeRate": 1.2, "strobeAt": 0.5},
	"electronica": {"calm": true, "palettes": [[0x20c0d0, 0xff5a3a], [0x8a40ff, 0xffe0a0], [0xffffff, 0x2a5aff]], "decay": 4.0, "speed": 0.35, "breathe": 0.5, "haze": 1.2, "sceneMin": 40.0},
	"downtempo": {"calm": true, "palettes": [[0xff9a40, 0x30a0a0], [0xa050d0, 0xff7a50], [0x3060c0, 0xffc070]], "decay": 2.4, "speed": 0.2, "breathe": 0.7, "level": 0.75, "blinder": 0.2, "sceneMin": 60.0},
	"djtools": {"palettes": [[0xffffff, 0x3a6bff], [0xffffff, 0xffa030]], "decay": 8.0, "speed": 0.6, "strobes": false},
	"techno": {"family": "Techno", "palettes": [[0xffffff, 0xff2a1a, 0x3a6bff, 0xff2a1a], [0xffffff, 0x3a6bff, 0x20d0ff, 0x3a6bff], [0xffa030, 0xffffff, 0xff2a1a, 0xffffff]]},
	"raw": {"family": "Techno", "palettes": [[0xffffff, 0x8fb4ff, 0xffffff, 0xb01810], [0xffffff, 0xb01810], [0xffffff, 0xffb060]], "decay": 10.0, "speed": 0.5, "haze": 1.1, "paletteHold": 360.0, "sceneKicks": 32, "sceneMin": 12.0},
	"electro": {"family": "Techno", "palettes": [[0x20e0ff, 0xff2030, 0xffffff, 0x20e0ff], [0xffffff, 0x3050ff, 0xff2030, 0xffffff]], "decay": 10.0, "speed": 0.9},
	"hard": {"family": "Hard", "palettes": [[0xff1a10, 0xffffff], [0xffffff, 0x3a6bff], [0xff1a10, 0xff7a10], [0xc020ff, 0xffffff]], "decay": 11.0, "speed": 1.4, "level": 1.1, "sceneMin": 20.0, "strobeRate": 1.4, "strobeAt": 0.4, "paletteHold": 180.0},
	"harddance": {"family": "Hard", "palettes": [[0xff1a10, 0xffffff, 0x60ff20, 0xffffff], [0xffffff, 0xff20a0, 0x2060ff, 0xff20a0], [0xffe020, 0xff1a10]], "decay": 14.0, "speed": 1.6, "level": 1.15, "sceneMin": 18.0, "strobeRate": 1.6, "strobeAt": 0.35, "paletteHold": 150.0},
	"trance": {"family": "Trance", "palettes": [[0x2a6aff, 0xffffff, 0x20d0ff, 0xff2ad0], [0xffd020, 0xffffff, 0xff2a8a, 0x8a3aff]], "decay": 7.0, "speed": 1.0, "strobeAt": 0.5, "haze": 1.2},
	"trancedeep": {"family": "Trance", "palettes": [[0x2040e0, 0x7030d0], [0x10a0b0, 0x2040c0], [0xc02a80, 0x4030c0]], "decay": 6.0, "speed": 0.55, "strobes": false, "breathe": 0.2, "level": 0.8, "haze": 1.3, "sceneKicks": 128, "blinder": 0.4},
	"psytrance": {"family": "Trance", "palettes": [[0x30ff60, 0xa020ff, 0xff2ad0, 0xff8a10], [0x20ffd0, 0xff20a0, 0xe0ff20, 0x7020ff]], "decay": 12.0, "speed": 1.3, "strobeRate": 1.3, "sceneMin": 20.0, "haze": 1.2},
	"dnb": {"family": "Bass", "palettes": [[0xffffff, 0x2aff6a, 0x2a6aff, 0xff2a1a], [0xff8a10, 0xffffff, 0x20d0ff, 0xffffff]], "decay": 13.0, "speed": 1.4, "strobeRate": 1.5, "strobeAt": 0.45},
	"dubstep": {"family": "Bass", "palettes": [[0x40ff30, 0x8020e0, 0xffffff, 0xe02020], [0x20c0ff, 0xff2080, 0xffffff, 0x8020e0]], "decay": 6.0, "speed": 0.9, "strobeRate": 0.8, "level": 1.05},
	"deepdubstep": {"family": "Bass", "palettes": [[0xc01818, 0x1830c0], [0x1830c0, 0x6a20b0], [0xffffff, 0xc01818]], "decay": 4.5, "speed": 0.35, "strobeAt": 0.85, "level": 0.65, "haze": 1.3, "blinder": 0.4},
	"basshouse": {"family": "Bass", "palettes": [[0xff2a8a, 0x20e0ff, 0xffffff, 0xe0ff20], [0xffffff, 0xff3a1a, 0x8a3aff, 0xffffff]], "decay": 10.0, "speed": 1.0},
	"bassclub": {"family": "Bass", "palettes": [[0xff3a1a, 0x20e0ff, 0xe0ff20, 0xa030ff], [0xffffff, 0xff2a8a, 0x20e0a0, 0xffffff]], "decay": 10.0, "speed": 1.0, "strobeAt": 0.55},
	"breaks": {"family": "Bass", "palettes": [[0x20d0e0, 0xff7a1a, 0xffffff, 0x20d0e0], [0xffffff, 0x8a3aff, 0x30ff80, 0xffffff]], "decay": 9.0, "speed": 0.9},
	"ukg": {"family": "Bass", "palettes": [[0x9030e0, 0xff3aa0, 0x3060ff, 0xffffff], [0x30d0c0, 0x9030e0, 0xffc040, 0xff3aa0]], "decay": 8.0, "speed": 0.8, "strobeAt": 0.7},
	"trap": {"family": "Bass", "palettes": [[0xff3aa0, 0x30e0ff, 0xa040ff, 0xffffff], [0xffe040, 0xff3a3a, 0x30a0ff, 0xffffff]], "decay": 5.5, "speed": 0.8},
	"brazilianfunk": {"family": "Open format", "palettes": [[0x20c050, 0xffe030, 0x2060ff, 0xff3aa0], [0xffffff, 0x20c050, 0xffe030, 0xffffff]], "decay": 9.0, "speed": 0.9},
	"ambient": {"family": "Concert & ambient", "flow": true, "calm": true, "palettes": [[0x1840c0, 0x10a0a0], [0x6a30c0, 0x2050c0], [0x10a070, 0x1a4a90], [0xc06a30, 0x7a2a50]], "speed": 0.12, "breathe": 0.8, "level": 0.7, "haze": 1.4, "wash": 0.3, "sceneMin": 70.0, "paletteHold": 200.0},
}

const PROGRAMS := [
	{"name": "Pillars", "tier": "calm", "w": {"overhead": 1.0, "stage": 0.1, "wash": 0.5, "bars": 0.5}},
	{"name": "Sway", "tier": "calm", "w": {"overhead": 1.0, "stage": 0.15, "wash": 0.6, "bars": 0.35}},
	{"name": "Fan", "tier": "mid", "w": {"overhead": 1.0, "stage": 0.25, "wash": 0.3, "bars": 0.4}, "twoTone": true},
	{"name": "Cross", "tier": "mid", "w": {"overhead": 1.0, "stage": 0.2, "wash": 0.25, "bars": 0.5}},
	{"name": "Carousel", "tier": "mid", "w": {"overhead": 1.0, "stage": 0.25, "wash": 0.2, "bars": 0.2}, "twoTone": true, "spin": true, "gobo": true},
	{"name": "Scatter", "tier": "mid", "w": {"overhead": 0.5, "stage": 1.0, "wash": 0.3, "bars": 0.25}, "twoTone": true, "slow": true},
	{"name": "Wave", "tier": "big", "w": {"overhead": 1.0, "stage": 0.6, "wash": 0.3, "bars": 0.5}},
	{"name": "Chase", "tier": "big", "w": {"overhead": 1.0, "stage": 0.5, "wash": 0.2, "bars": 0.6}, "gate": true},
	{"name": "Dome", "tier": "big", "w": {"overhead": 1.0, "stage": 0.8, "wash": 0.4, "bars": 0.3}, "twoTone": true, "spin": true, "gobo": true},
	{"name": "Wall", "tier": "big", "w": {"overhead": 0.25, "stage": 1.0, "wash": 0.5, "bars": 0.6}},
]
const TIER := {"intro": "calm", "low": "calm", "groove": "mid", "peak": "big", "break": "mid"}
const SECTION_LEVEL := {"intro": 0.55, "low": 0.65, "groove": 1.0, "peak": 1.0, "break": 1.0}
const SECTION_NAME := {"intro": "intro", "low": "quiet part", "groove": "groove", "peak": "peak", "break": "break"}
const ROLES := ["overhead", "stage", "wash", "bars"]
const WASH_LEVEL := {"intro": 0.16, "low": 0.14, "groove": 0.24, "peak": 0.32}
const BREAK_LOOK := {"overhead": 1.0, "stage": 0.4, "wash": 1.0, "bars": 1.0}
const DROP_LOOK := {"overhead": 1.0, "stage": 0.8, "wash": 0.7, "bars": 0.65}
const WARM := Color(1.0, 0.78, 0.56)

# Techno (Raw / Deep / Hypnotic) plays three or four colours at a time that belong together, not two:
# cold steel and red for the raw, blues and violets for the deep, ice and cyan for the hypnotic, a warm one now and then.
const RAW_DEEP := "techno-raw-deep-hypnotic"

# For Raw / Deep / Hypnotic a look is a position, and the way it moves, which heads are lit, how the colours are spread
# and how the beam looks are drawn apart, as on a lighting desk (one stack each). Every third scene plays the look as
# it was designed; the others combine it with a movement, a gate, a colour spread and a beam of their own.
const STACK_MOVES := ["still", "sway", "breathe", "snake", "tiltWave", "panWave", "circle", "eight"]
const STACK_GATES := ["all", "chase", "across", "frontBack", "centre", "alternate", "trusses", "patterns"]
const STACK_CALM_GATES := ["all", "across", "centre", "chase"]   # a calm part never thins the rig out to a few heads
const STACK_COLOURS := ["sides", "alternate", "trusses", "depth", "centreWhite", "mono"]
const STACK_BEAMS := ["normal", "narrow", "wide", "gobo"]
const RAW_DEEP_PALETTES := [
	[0xdfe8ff, 0x3a6bff, 0x2040e0, 0xb01810],
	[0xb01810, 0xffa030, 0xffffff, 0x5020a0],
	[0x10a0b0, 0x2040e0, 0x7030d0, 0xdff0ff],
	[0xc02a80, 0x4030c0, 0x20d0ff],
	[0xff7a1a, 0x2a40d0, 0xffffff, 0x10a0a0],
	[0x20d0ff, 0xffffff, 0x3a40e0, 0xff2a8a],
	[0x20c080, 0x1a4a90, 0xdff0ff, 0x7030d0],
	[0xffb060, 0xb01810, 0x5a30c0],
]

var mood: Dictionary = {}
var mood_key := ""
var status := ""
var head_name := ""
var truss_name := ""
var row_look := "curtain"
var _moods := {}
var _pools := {}
var _pool: Array = []
var _heads: Array = []       # every moving head the director plays (L.Head)
var _washes: Array = []
var _listen: Listen
var _rb: Rekordbox
var _t := 0.0
# the signals, as SV's signals.js keeps them
var _kick := 0.0
var _accent := 0.0
var _sdrop := 0.0
var _lift := 0.0
var _hype := 0.0
var _energy := 0.0
var _bass := 0.0
var _mid := 0.0
var _treble := 0.0
var _activity := 0.0
var _m_section := "intro"
var _phase_was := ""
var _break_at := 0.0
var _grooved := false
var _last_kick_t := -10.0
var _new_track_flag := false
var _flow := {}
# the director's own state
var _w := BREAK_LOOK.duplicate()
var _program := 0
var _scene := 0
var _scene_at := 0.0
var _beat := 0
var _palette := 0
var _palette_at := 0.0
var _two_tone := 0.0
var _motion := 0.0
var _spin := 0.0
var _spin_vel := 0.0
var _chase := 0.0
var _strobe_clock := 0.0
var _level := 1.0
var _present := 1.0
var _col := Color.WHITE
var _col2 := Color.WHITE
var _bar_level: Array = []
var _bar_start := false
var _wash_level := 0.15
var _row_w := 0.5
var _drop_at := -100.0
var _pending := {}
var _track_at := -1.0
var _track_settle := SETTLE
var _told := false
var _head_look := "floor"
var _head_set := {}
var _head_turn := {"calm": 0, "mid": 3, "big": 5}
var _head_palette := -1
var _head_at := -100.0
var _head_scene := 0
var _head_fresh := false
var _style_key := ""
var _multi_was := false
var _head_recent: Array = []   # the head looks that played last (Raw / Deep / Hypnotic does not repeat them at once)
var _truss_look := 0
var _truss_at := 0.0
var _truss_scene := 0
var _truss_palette := 0
var _truss_track := false
var stack_name := ""   # the head look's movement, gate, colour spread and beam now
var _stack_now: Array = []
var _stack_scene := -1
var _stack_palette := -1
var _stack_look := ""
var _stack_tier := ""
var colours_in_use: Array = [Color.WHITE, Color.WHITE]   # the colours the heads are asked for now (two, or more for Raw / Deep / Hypnotic)
var flash := 0.0
var blind := 0.0
# The DJ's own buttons (keys or a controller), on top of the automatic show, as `manual` in the browser's director:
# blackout and strobe and blinder while held; looks counts presses of "next look".
var manual := {"blackout": false, "strobe": false, "blinder": false, "looks": 0}
var _looks_seen := 0

func update(dt: float, listen: Listen, rb: Rekordbox) -> void:
	_listen = listen
	_rb = rb
	super.update(dt, listen, rb)

func _new_track(t: String) -> void:
	super._new_track(t)
	_new_track_flag = true

static func _hex(h: int) -> Color:
	return Color8(h >> 16 & 255, h >> 8 & 255, h & 255)

static func _vivid(c: Color) -> Color:
	var k := 1.0 / maxf(maxf(c.r, c.g), maxf(c.b, 0.05))
	return Color(c.r * k, c.g * k, c.b * k)

func _mood(key: String) -> Dictionary:
	if _moods.has(key): return _moods[key]
	var m := BASE.duplicate()
	var own: Dictionary = MOODS[key]
	if own.get("calm", false): m.merge(CALM, true)
	m.merge(own, true)
	var pals := []
	for p in own.palettes: pals.append(p.map(func(h): return _hex(h)))
	m.palettes = pals
	_moods[key] = m
	return m

# The palettes a kind of music takes its tracks' colours from: its own, taking turns with those of every other kind
# of club music, as colours belong to no one genre (what the rig does with them does). Music to listen to keeps its own.
func _palette_pool(key: String) -> Array:
	if _pools.has(key): return _pools[key]
	var own: Array = _mood(key).palettes
	var pool := []
	if _mood(key).flow: pool = own
	else:
		var seen := {}
		for p in own: seen[str(p)] = true
		var others := []
		for k in MOODS:
			if k == key or _mood(k).flow: continue
			for p in _mood(k).palettes:
				if not seen.has(str(p)):
					seen[str(p)] = true
					others.append(p)
		var from := 0
		for c in key.to_utf8_buffer(): from += c
		for i in maxi(own.size(), others.size()):
			if i < own.size(): pool.append(own[i])
			if i < others.size(): pool.append(others[(i + from) % others.size()])
	_pools[key] = pool
	return pool

func _multi() -> bool:
	return genre == RAW_DEEP

# [move, gate, colour, beam] for the head look now: its own, or a combination that follows from the scene, the track's
# palette and the look (no chance in it, so a replay plays the same).
func _stack(look: Array, tier: String) -> Array:
	if not _stack_now.is_empty() and _stack_scene == _scene and _stack_palette == _palette and _stack_look == _head_look and _stack_tier == tier:
		return _stack_now   # it only changes with the scene, the palette, the look or the part of the track
	_stack_scene = _scene
	_stack_palette = _palette
	_stack_look = _head_look
	_stack_tier = tier
	_stack_now = [look[3], look[4], look[5], look[6]]
	if _multi() and _scene % 3 != 0:
		var h := absi(hash(_head_look))
		var gates: Array = STACK_CALM_GATES if tier == "calm" else STACK_GATES
		_stack_now = [STACK_MOVES[(h + _scene * 3 + _palette) % STACK_MOVES.size()], gates[(floori(h / 7.0) + _scene * 2 + _palette * 5) % gates.size()],
			STACK_COLOURS[(floori(h / 13.0) + _scene + _palette * 2) % STACK_COLOURS.size()], STACK_BEAMS[(floori(h / 17.0) + _scene * 3 + _palette) % STACK_BEAMS.size()]]
	stack_name = "%s · %s · %s · %s" % _stack_now
	return _stack_now

func _style() -> Dictionary:
	return L.RAW_DEEP_STYLE if _multi() else L.style_of(mood_key, mood.family)

# One colour of the palette for a head: the look's spread (sides, alternate, trusses, depth) over all the palette's
# colours instead of two, and the dominant colour of a "mono" look moves on every 64 beats.
func _spread(name: String, h: L.Head, k32: int, k64: int, pal: Array) -> Color:
	var n := pal.size()
	var side := 0 if h.fx.mount.x < 0.0 else 1
	match name:
		"sides", "centreWhite": return pal[(k32 + side) % n]
		"alternate": return pal[(h.slot + k64) % n]
		"trusses": return pal[(h.row + k64) % n]
		"depth":
			var at := L.depth(h.fx.mount) * (n - 1)
			var i := mini(floori(at), n - 1)
			return pal[i].lerp(pal[mini(i + 1, n - 1)], at - i)
	return pal[k64 % n]

# A break need not be the same floor scan every time: the heads take a curtain or a rake towards the stage,
# and lean further out as the build-up grows.
func _break_target(h: L.Head, p: Vector3, k: Dictionary, s: Dictionary, sig: Dictionary) -> Vector3:
	var variant := (_scene + _palette) % 3
	if variant == 0: return L.floor_target(h, p, k, _beat, "break", sig.build, sig.energy, sig.drop)
	var t: Vector3 = L.move("breathe", L.position("curtain", h, p, k, s), h, p, k) if variant == 1 else L.move("sway", L.position("rakeStage", h, p, k, s), h, p, k)
	return t.lerp(Vector3(t.x, 13.0, t.z), clampf(sig.build, 0.0, 1.0) * 0.5)

func _mood_key() -> String:
	if MOOD_OF.has(genre): return MOOD_OF[genre]
	if bpm > 160.0: return "dnb"
	if bpm > 145.0: return "harddance"
	return "techno"

func _set_mood(key: String) -> void:
	mood = _mood(key)
	mood_key = key
	_multi_was = _multi()
	_pool = RAW_DEEP_PALETTES.map(func(p): return p.map(func(h): return _hex(h))) if _multi() else _palette_pool(key)
	_palette = 0
	_flow = {}
	_pick_program("intro")

# --- the rig, as the director sees it ---

func _cast() -> void:
	var lists := {"overhead": [], "stage": [], "row": []}
	for f in rig.fixtures:
		if f.kind == Rig.WASH:
			_washes.append(f)
			continue
		var h := L.Head.new()
		h.fx = f
		h.u = f.u
		h.xn = f.xn
		h.row = f.row
		h.hanging = f.up.y < -0.5
		match f.group:
			"hall":
				h.role = "overhead"
				h.row = f.truss
			"rear":
				h.role = "overhead"
				h.row = 5
			"side":
				h.role = "overhead"
				h.row = 6
			"front": h.role = "row"
			_: h.role = "stage"   # the towers behind the DJ, the delay towers, the stage roof's spots
		h.slot = lists[h.role].size()
		lists[h.role].append(h)
		h.rp = randf() * 2.0 - 1.0
		h.rt = randf()
		h.bank = 2 if h.role != "overhead" else 1 if absf(f.mount.x) > 18.0 else 0
		h.lit_key = fposmod(h.row * 7.31 + h.u * 13.7, 1.0)
		_heads.append(h)
	_bar_level.resize(rig.battens.size())
	_bar_level.fill(0.0)

# --- the signals ---

# What the music does now, in the words of SV's signals.js and listen.js, from the listening or from rekordbox.
func _signals(dt: float) -> Dictionary:
	var l := _listen
	var heard := l != null and l.source != "none" and l.section != ""
	var told := _rb != null and _rb.live()
	var ev := {"kick": 0.0, "kickGap": 0.0, "drop": false, "from": "", "lift": false, "silent": false, "newTrack": false}
	# the parts of a track
	var phase := "break" if section in ["break", "build"] else "groove"
	var sec: String = {"intro": "intro", "groove": "groove", "build": "break", "break": "break", "peak": "peak", "outro": "low"}.get(section, "groove")
	if heard and not told:
		phase = "break" if l.phase == "break" else "groove"
		sec = "break" if phase == "break" else l.section
	if sec != _m_section:
		ev.from = _m_section
		_m_section = sec
	if phase == "break" and _phase_was != "break": _break_at = _t
	_phase_was = phase
	if sec in ["groove", "peak"]: _grooved = true
	# the bands; rekordbox alone has none, so they are made from its beat
	var b := 0.0
	var m := 0.0
	var tr := 0.0
	if l != null and l.source != "none":
		b = l.bass
		m = minf(1.0, l.mid)
		tr = l.treble
		_accent = l.accent
	elif told:
		var pulse := exp(-since_kick * 6.0) if phase != "break" else 0.0
		b = 0.15 + 0.7 * pulse
		m = 0.45
		tr = 0.3
		_accent = 0.0
	_bass = b
	_mid = m
	_treble = tr
	var e := b * 0.5 + m * 0.3 + tr * 0.2
	_energy += (e - _energy) * (1.0 - exp(-dt / (0.07 if e > _energy else 0.35)))
	# how much music there is
	var playing := told and int(_rb.value("transport/playing", 1)) == 1
	var act := 1.0 if playing else clampf(energy * 5.0, 0.0, 1.0)
	if l != null and l.ev_silent: act = 0.0
	_activity += (act - _activity) * (1.0 - exp(-dt / 0.5))
	# events
	var k := kick
	if told and phase == "break" and not (heard and l.kick): k = false   # rekordbox counts beats; a break has no kick
	if dropped: k = true
	if k:
		ev.kick = clampf(0.55 + b * 0.6, 0.5, 1.0)
		ev.kickGap = _t - _last_kick_t
		_last_kick_t = _t
		_kick = ev.kick
	if dropped:
		ev.drop = true
		_sdrop = 1.0
		_hype = 1.0
	if l != null:
		if l.ev_lift:
			ev.lift = true
			_lift = 1.0
			_hype = maxf(_hype, 0.4)
		if l.ev_back: _lift = maxf(_lift, 0.5)
		if l.ev_silent: ev.silent = true
	if _new_track_flag:
		_new_track_flag = false
		ev.newTrack = true
	_kick *= exp(-dt * float(mood.decay))
	_sdrop *= exp(-dt * 1.6)
	_lift *= exp(-dt * 1.2)
	_hype *= exp(-dt * 0.22)
	return {"phase": phase, "section": sec, "build": build, "riser": (l.riser if heard and not told else build), "activity": _activity,
		"bpm": bpm, "ev": ev, "kick": _kick, "accent": _accent, "drop": _sdrop, "lift": _lift, "hype": maxf(_hype, l.hype if heard else 0.0),
		"energy": _energy, "bass": _bass, "mid": _mid, "treble": _treble, "phase_clock": beat, "beats": floorf(beat), "sinceBreak": _t - _break_at}

# Music with no beat to count (ambient): the show follows how loud and how full it is.
func _flowing(sig: Dictionary, dt: float) -> Dictionary:
	if _flow.is_empty(): _flow = {"fast": 0.0, "lo": 1.0, "hi": 0.0, "tier": "low", "pulse": 0.0, "lift": 0.0, "clock": 0.0, "prev": 0.0, "since": 0.0}
	var F := _flow
	var e: float = 0.0 if sig.activity < 0.05 else sig.energy
	F.fast += (e - F.fast) * minf(1.0, dt * 5.0)
	F.hi = maxf(maxf(F.hi - dt * 0.004, F.fast), 0.08)
	F.lo = minf(F.lo + dt * 0.004, F.fast)
	var rel := clampf((F.fast - F.lo) / maxf(0.05, F.hi - F.lo), 0.0, 1.0)
	var tier := "peak" if rel > (0.6 if F.tier == "peak" else 0.75) else "groove" if rel > (0.35 if F.tier == "low" else 0.22) else "low"
	var ev := {"kick": 0.0, "kickGap": 0.0, "drop": false, "from": "", "lift": false, "silent": sig.ev.silent, "newTrack": sig.ev.newTrack}
	F.since += dt
	if tier != F.tier and F.since > 6.0:
		ev.from = F.tier
		ev.lift = tier == "peak"
		F.tier = tier
		F.since = 0.0
	var rising := maxf(0.0, (F.fast - F.prev) / maxf(dt, 0.001))
	F.prev = F.fast
	F.pulse = maxf(maxf(F.pulse * exp(-dt * 2.5), minf(1.0, rising * 1.2)), sig.accent * 0.6)
	if ev.lift: F.lift = 1.0
	F.lift *= exp(-dt * 0.8)
	F.clock += dt * (0.5 + rel * 0.5)
	return {"phase": "groove", "section": F.tier, "build": 0.0, "riser": 0.0, "activity": sig.activity, "bpm": sig.bpm, "ev": ev,
		"kick": F.pulse * 0.5, "accent": sig.accent, "drop": 0.0, "lift": F.lift, "hype": 0.35 if F.tier == "peak" else 0.0,
		"energy": 0.25 + rel * 0.6, "bass": sig.bass, "mid": sig.mid, "treble": sig.treble, "phase_clock": F.clock, "beats": floorf(F.clock), "sinceBreak": 0.0}

# --- choosing ---

# the next program for this part of the track, never the one that is already up if there is a choice
func _pick_program(sec: String) -> void:
	var list := []
	for i in PROGRAMS.size():
		if PROGRAMS[i].tier == TIER.get(sec, "mid"): list.append(i)
	var at := list.find(_program)
	_program = list[_scene % list.size() if at < 0 else (at + 1) % list.size()]

func _next(sec: String) -> void:
	if not _told and _t - _palette_at >= float(mood.paletteHold):
		_palette += 1
		_palette_at = _t
	_scene += 1
	_pick_program(sec)
	_scene_at = _t

func _start_track(sec: String) -> void:
	_palette += 1
	_palette_at = _t
	_beat = 0
	_next(sec)
	_pending = {}
	_track_at = -1.0

# The heads' look and the trusses' formation. A new palette is the show hearing a new track: it gets two looks of
# its own for each part of a track, others than the last one had, and the show moves between them at scene cues.
func _hangar_looks(tier: String, brk: bool) -> void:
	var style := _style()
	var chosen: Dictionary = L.PACE.normal
	var pace_k := float(style.pace) / maxf(0.25, float(tune.pace))
	var track := _palette != _head_palette
	var cue := _scene != _head_scene
	if _style_key != mood_key:
		_style_key = mood_key
		_head_palette = -1
	if track or _head_palette == -1:
		_head_palette = _palette
		_head_fresh = true
		for part in ["calm", "mid", "big"]:
			var own := []
			for key in style.looks:
				if L.HEAD_LOOKS.has(key) and part in L.HEAD_LOOKS[key][1]: own.append(key)
			var list: Array = own if own.size() >= 2 else L.head_tier(part)
			if _multi():   # six looks of its own for each part of a track, not two
				var six := []
				for i in mini(6, list.size()): six.append(list[(_head_turn[part] + i) % list.size()])
				_head_set[part] = six
				_head_turn[part] += six.size()
			else:
				_head_set[part] = [list[_head_turn[part] % list.size()], list[(_head_turn[part] + 1) % list.size()]]
				_head_turn[part] += 2
	_head_scene = _scene
	if not brk and (_head_fresh or (cue and _t - _head_at >= chosen.head * pace_k * (0.35 if _multi() else 1.0)) or not tier in L.HEAD_LOOKS[_head_look][1]):
		var choices: Array = _head_set[tier]
		var next: String = choices[(choices.find(_head_look) + 1) % choices.size()]
		if _multi():   # the next one that did not play just now
			var fresh := choices.filter(func(c): return c != _head_look and not c in _head_recent)
			if not fresh.is_empty(): next = fresh[0]
		if next != _head_look:
			_head_recent.push_front(_head_look)
			if _head_recent.size() > 2: _head_recent.resize(2)
			_head_look = next
			_head_at = _t
		_head_fresh = false
	# the trusses: at a scene cue once a formation has held its time, sooner for a new track; not during a break
	if _palette != _truss_palette:
		_truss_palette = _palette
		_truss_track = true
	var truss_cue := _scene != _truss_scene
	_truss_scene = _scene
	if not brk and truss_cue and _t - _truss_at >= (chosen.track if _truss_track else chosen.truss) * pace_k:
		var n := L.TRUSS_LOOKS.size()
		var next := (_truss_look + (3 if _truss_track else 1)) % n   # a new track skips ahead for a bigger change
		var any := false
		for i in n:
			if tier in L.truss_tiers(i) and L.TRUSS_LOOKS[i] in style.trusses: any = true
		for _i in n:
			if tier in L.truss_tiers(next) and (not any or L.TRUSS_LOOKS[next] in style.trusses): break
			next = (next + 1) % n
		_truss_look = next
		_truss_at = _t
		_truss_track = false
	head_name = L.HEAD_LOOKS[_head_look][0]
	truss_name = L.TRUSS_LOOKS[_truss_look]

# --- aiming ---

static func _toward(p: Vector3, t: Vector3) -> Vector2:
	var d := t - p
	return Vector2(atan2(d.x, d.z), atan2(Vector2(d.x, d.z).length(), -d.y))

static func _dir(a: Vector2) -> Vector3:
	return Vector3(sin(a.y) * sin(a.x), -cos(a.y), sin(a.y) * cos(a.x))

static func _out(h: L.Head) -> float:
	return (-1.0 if h.xn < 0.0 else 1.0) * PI / 2.0

# A program's aim for a head: [pan, tilt]. overhead: a head that hangs, stage: one that stands.
func _program_aim(name: String, hanging: bool, h: L.Head, k: Dictionary) -> Vector2:
	var m: float = k.m
	match name:
		"Pillars": return Vector2(0.0, 0.05 + 0.04 * sin(m + h.u * 4.0)) if hanging else Vector2((h.u - 0.5) * 0.8, 1.9)
		"Sway": return Vector2(0.0, 0.4 * sin(m * 0.8 + h.row * 0.7)) if hanging else Vector2((h.u - 0.5) * 1.1, 1.85 + 0.2 * sin(m + h.u * 4.0))
		"Fan": return Vector2(_out(h), absf(h.xn) * 0.75 + 0.12 * sin(m + h.row)) if hanging else Vector2((h.u - 0.5) * 1.6, 1.75 + 0.15 * sin(m * 0.7))
		"Cross": return Vector2(-_out(h), 0.25 + absf(h.xn) * 0.55 + 0.12 * sin(m + h.row * 1.3)) if hanging else Vector2(-(h.u - 0.5) * 1.4, 1.95)
		"Carousel": return Vector2(k.spin + h.u * TAU + h.row * 0.8, 0.55) if hanging else Vector2(sin(m + h.u * 5.0) * 0.9, 1.8)
		"Scatter": return Vector2(h.rp * PI, 0.15 + h.rt * 0.7) if hanging else Vector2(h.rp * 0.9, 1.5 + h.rt * 0.7)
		"Wave": return Vector2(0.0, 0.7 * sin(m * 1.3 + h.row * 0.9 + h.u * 2.5)) if hanging else Vector2((h.u - 0.5) * 0.5, 1.75 + 0.3 * sin(m * 1.3 + h.u * 5.0))
		"Chase": return Vector2(0.0, 0.2) if hanging else Vector2(sin(m * 0.5) * 0.4, 1.9)
		"Dome": return Vector2(k.spin * 0.5 + h.u * TAU, 2.2 + 0.15 * sin(m + h.row)) if hanging else Vector2((h.u - 0.5) * 1.8, 2.3 + 0.2 * sin(m * 0.6 + h.u * 3.0))
		"Wall": return Vector2(0.0, 0.3) if hanging else Vector2((h.u - 0.5) * 0.35, 1.72 + 0.2 * sin(m * 0.7))
		"break":   # a slow sway that leans further out as the build-up grows
			if hanging: return Vector2(_out(h), 0.25 + 0.2 * sin(m * 0.6 + h.row) + k.build * 0.9)
			return Vector2((h.u - 0.5) * 1.2, 1.8 + k.build * 0.5)
	return Vector2(0.0, 0.3)

# --- every frame ---

func _direct(dt: float) -> void:
	_t += dt
	if _heads.is_empty(): _cast()
	var key := _mood_key()
	if key != mood_key or _multi() != _multi_was: _set_mood(key)
	var sig := _signals(dt)
	if _rb != null and _rb.live(): _told = true
	elif _listen != null: _told = _listen.title != ""
	if sig.ev.newTrack:
		_track_at = _t
		_track_settle = SETTLE
	if mood.flow: sig = _flowing(sig, dt)
	var ev: Dictionary = sig.ev
	var sec: String = sig.section
	var tier: String = TIER.get(sec, "mid")
	var brk: bool = sig.phase == "break"
	var calm := not brk and tier == "calm"

	# ----- what just happened in the music -----
	var starting := _track_at >= 0.0 and _t - _track_at >= (_track_settle if ev.kick > 0.0 else LATE)
	if starting: _start_track(sec)
	if ev.kick > 0.0:
		if ev.drop:
			if not starting:
				_beat = 0
				_next(sec)
				_pending = {}
			_drop_at = _t
		# beats, not kicks: a kick that was missed for a bar or two moves the count on by the beats it was gone
		var before := _beat
		var gone := roundi(float(ev.kickGap) * maxf(float(sig.bpm), 60.0) / 60.0)
		_beat += gone if before > 0 and gone > 1 and gone <= 16 else 1
		var first := func(n: int) -> bool: return _beat > 1 and floori((before - 1) / float(n)) != floori((_beat - 1) / float(n))
		_bar_start = _beat == 1 or first.call(8)
		# hold a scene for a musical phrase, changing on its first beat; a calm part holds its look twice as long
		var hold := 2 if calm else 1
		if first.call(int(mood.sceneKicks) * hold) and _t - _scene_at >= float(mood.sceneMin) * hold: _next(sec)
		var n := rig.battens.size()
		var pattern := floori((_beat - 1) / 32.0) % 4
		var middle := (n - 1) / 2.0
		for i in n:
			var on := true
			match pattern:
				1: on = i % 2 == _beat % 2
				2: on = absf(i - middle) < (_beat % 4 + 1) * n / 8.0
				3: on = i % 4 == _beat % 4
			if on: _bar_level[i] = ev.kick
		if _bar_start:
			for h: L.Head in _heads:
				h.rp = randf() * 2.0 - 1.0
				h.rt = randf()
	else: _bar_start = false
	if ev.silent:
		if not _told and _t - _palette_at > 60.0:
			_palette += 1
			_palette_at = _t
		_beat = 0
	if ev.from != "":
		# the track moved to another part while the kick kept going: a new look that fits it
		if ev.from != "break" and sec != "break" and not ev.drop: _pending = {"section": sec, "at": _t}
		elif ev.from == "break" and PROGRAMS[_program].tier != tier:
			_pick_program(sec)
			_scene_at = _t
	if ev.lift and _t - _scene_at >= float(mood.sceneMin) - 4.0: _pending = {"section": sec, "at": _t - 3.0, "lift": true}
	if mood.flow and _t - _scene_at >= float(mood.sceneMin): _next(sec)
	# a new part, or a layer coming in, changes the look on the first beat of the next pair of bars
	if not _pending.is_empty():
		if ev.drop or (not _pending.has("lift") and _pending.section != sec) or sec == "break": _pending = {}
		elif _bar_start and _t - _pending.at >= 3.0 and _t - _scene_at >= 12.0:
			_next(sec)
			_pending = {}

	# the DJ asked for the next look: a new scene now, with the next look and formation
	if int(manual.looks) != _looks_seen:
		_looks_seen = int(manual.looks)
		_next(sec)
		_head_at = -1000.0
		_truss_at = -1000.0
		_pending = {}

	# ----- the look, eased -----
	var P: Dictionary = PROGRAMS[_program]
	var accent := 0.0 if brk else minf(0.55, maxf(sig.hype * 0.55, 0.25 if sec == "peak" else 0.0))
	var ease := func(seconds: float) -> float: return 1.0 - exp(-dt / seconds)
	for role in ROLES:
		var base: float = BREAK_LOOK[role] if brk else P.w.get(role, 0.0)
		_w[role] += (base + (DROP_LOOK[role] - base) * accent - _w[role]) * ease.call(0.65 if brk else 1.4)
	_two_tone += ((1.0 if P.get("twoTone", false) or sig.hype > 0.4 else 0.0) - _two_tone) * ease.call(1.1)
	_level += (SECTION_LEVEL.get(sec, 1.0) - _level) * ease.call(1.5)
	# a track keeps its colours from its first kick to its last: one palette, the same two of its colours
	var pal: Array = _pool[_palette % _pool.size()]
	var multi := _multi()
	var pair := 0 if multi else floori(_palette / float(_pool.size())) * 2
	_col = _col.lerp(pal[pair % pal.size()], ease.call(1.1))
	_col2 = _col2.lerp(pal[(pair + 1) % pal.size()], ease.call(1.1))
	var col := _col
	var col2 := _col2
	var act: float = sig.activity
	# how much music there is: silence between two pieces of ambient is not a blackout
	var present_want: float = ((0.6 + 0.4 * act) if act > 0.03 else 0.3) if mood.flow else act
	_present += (present_want - _present) * (ease.call(1.5) if mood.flow else 1.0)
	var held: bool = manual.strobe or manual.blinder
	var master: float = 0.0 if manual.blackout else maxf(_present * _level, 1.0 if held else 0.0) * float(mood.level) * float(tune.master) * (1.0 - blackout)
	var tint := func(c: Color) -> Color: return c.lerp(WARM, mood.warm) if mood.warm > 0.0 else c
	var speed: float = mood.speed * (0.35 + sig.energy * 1.2 + sig.mid * 0.65 + sig.kick * 0.35) * (0.6 if calm else 1.0)
	_motion += dt * speed * act
	_spin_vel += ((speed * 1.4 if not brk and P.get("spin", false) else 0.0) - _spin_vel) * minf(1.0, dt * 2.0)
	_spin += _spin_vel * dt
	_chase += dt * (4.0 + sig.build * 14.0)
	var strobe_rate: float = (6.0 + sig.build * 12.0 if brk and not manual.strobe else 14.0) * mood.strobeRate
	if safe: strobe_rate = minf(strobe_rate, 6.0)   # gentle: three flashes a second at most
	_strobe_clock += dt * strobe_rate

	# ----- strobes and blinders -----
	var strobing: bool = manual.strobe or (mood.strobes and ((brk and sig.riser > mood.strobeAt) or sig.drop > 0.55) and float(tune.strobe) > 0.0)
	flash = 1.0 if strobing and floori(_strobe_clock) % 2 == 0 else 0.0
	blind = maxf(1.0 if manual.blinder else 0.0, pow(sig.drop, 1.5) * mood.blinder)
	var strobe_k := 1.0 if manual.strobe else minf(1.0, float(tune.strobe))
	rig.strobe = flash * master * strobe_k
	rig.blinder = blind * master

	# ----- the moving heads -----
	var k := {"m": _motion, "spin": _spin, "phase": sig.phase_clock, "build": sig.build, "hangar_look": _scene % 3}
	_hangar_looks(tier, brk)
	var look: Array = L.HEAD_LOOKS[_head_look]
	var stage_z := Rig.TRUSS_Z[0] - 8.0   # over the booth
	var s := {"beat": _beat, "section": sec, "build": sig.build, "energy": sig.energy, "drop": sig.drop, "stage": stage_z}
	var style := _style()
	var tier_row := L.row_tier(tier)
	var own := []
	for r in style.get("row", []):
		if r in tier_row: own.append(r)
	var row_list: Array = own if not own.is_empty() else style.row if not style.get("row", []).is_empty() else tier_row
	row_look = ("fan" if sig.build > 0.5 else "curtain") if brk else "sunburst" if _t - _drop_at < 6.0 else row_list[(_scene + _palette * 2) % row_list.size()]
	var row_def: Array = L.ROW_LOOKS[row_look]
	_row_w += ((0.28 + sig.build * 0.5 if brk else L.ROW_LEVEL.get(tier, 0.7)) * style.get("rowLevel", 1.0) - _row_w) * ease.call(1.2)
	var lit_share: float = style.lit
	var beats: float = sig.beats
	var k32 := floori(beats / 32.0)   # the 32 and 64 beat counts the colour spread follows
	var k64 := floori(beats / 64.0)
	var pattern := floori(beats / 32.0) % 6
	var bld := clampf(sig.build, 0.0, 1.0)
	var dropk := clampf(sig.drop, 0.0, 1.0)
	var e18: float = ease.call(1.8)
	var e25: float = ease.call(2.5)
	var e14: float = ease.call(1.4)
	var e_moving: float = ease.call(0.1)
	var e_settle: float = ease.call(0.7)
	var e_gate: float = ease.call(0.08)
	var cue := "%d:%d" % [_scene, floori((_beat - 1) / 16.0)]
	# what is the same for every head this frame, worked out once
	var stack := _stack(look, tier)
	var look_move: String = stack[0]
	var look_gate: String = stack[1]
	var look_colour: String = stack[2]
	var look_beam: Array = L.BEAMS[stack[3]]
	var row_gate: String = row_def[2]
	var row_colour: String = row_def[3]
	var pattern_gain := 2.5 if pattern in [1, 2, 4] else 1.5
	var gains := {}
	for g in [look_gate, row_gate, "patterns"]: gains[g] = 1.0 if calm or brk else float(L.GATE_GAIN.get(g, pattern_gain))
	var warm: float = mood.warm
	var counted := beats / 2.0 if calm else beats
	var white_k := bld * 0.35
	var peak := sec == "peak"
	var foreground_bank := 2 if brk else _scene % 3
	var accent_bank := floori(beats / 2.0) % 3
	var e_kick: float = sig.kick
	var I_base: float = 0.1 + sig.mid * 0.15 + sig.build * 0.3 if brk else 0.045 + sig.energy * 0.23 + sig.bass * 0.12 + e_kick * 0.55 + sig.accent * 0.1
	var I_drop: float = sig.drop * 0.5
	var I_accent: float = sig.accent * 0.18 * master
	var chase_gate: bool = not brk and P.get("gate", false)
	var faders := {}
	for g in GROUP_LEVEL: faders[g] = float(GROUP_LEVEL[g]) * float(tune.groups.get(g, 1.0))
	for h: L.Head in _heads:
		var f: Rig.Fixture = h.fx
		var p := f.pos
		var row: bool = h.role == "row"
		var role: String = "stage" if row else h.role
		var a: Vector2
		if h.role == "overhead":
			if brk: a = _toward(p, _break_target(h, p, k, s, sig) if multi else L.floor_target(h, p, k, _beat, sec, sig.build, sig.energy, sig.drop))
			else: a = _toward(p, L.move(look_move, L.position(look[2], h, p, k, s), h, p, k))
		elif row: a = _toward(p, L.row_aim(row_look, h, p, k))
		else: a = _program_aim("break" if brk else P.name, h.hanging, h, k)
		# crossfade the asked aim as well as limiting the motors; a head dims while it travels far
		if not h.aimed:
			h.aim = _toward(p, p + f.dir)
			h.aimed = true
		var pan_gap: float = atan2(sin(a.x - h.aim.x), cos(a.x - h.aim.x))
		var gap: float = Vector2(pan_gap, a.y - h.aim.y).length()
		if h.cue != cue:
			if h.cue != "" and gap > 0.55: h.move_at = _t
			h.cue = cue
		var moving: bool = _t - h.move_at < 5.0 and gap > 0.2
		h.move_level += ((0.2 if moving else 1.0) - h.move_level) * (e_moving if moving else e_settle)
		if _t - h.move_at > 0.18:
			h.aim.x += pan_gap * e25
			h.aim.y += (a.y - h.aim.y) * e25
		f.target = p + _dir(h.aim) * 30.0
		var I: float = I_base
		var pg := 1.0
		if chase_gate and not row and role == "overhead":
			pg = 0.1 + 0.9 * pow(maxf(0.0, cos(h.u * TAU * 1.5 - sig.phase_clock * TAU / 4.0 + h.row * 1.1)), 3.0)
		I = (I * (_row_w if row else _w[role]) * pg + I_drop) * master
		# give the centre, the sides and the stage turns in the foreground; a drop opens the full rig
		var bank: int = h.bank
		if not brk and accent_bank == bank: I += I_accent
		# the genre's share of lit heads: the rest stay dark outside a drop
		if not brk and h.lit_key > lit_share: I *= dropk * 0.9
		var foreground: bool = bank == foreground_bank
		var lv: float = 1.0 if foreground else 0.28 if calm or brk else 0.45
		h.level += (lv - h.level) * e18
		I *= h.level + (1.0 - h.level) * dropk
		# hold each figure for 32 kicks; builds leave a small group near the stage
		var build_on: bool = absf(h.xn) <= 1.0 - bld * 0.85 and (bld < 0.65 or bank == 2 or h.row % 3 == 0)
		var gate_name: String = look_gate if h.role == "overhead" else row_gate if row else "patterns"
		var on: bool = build_on if brk else L.gate(gate_name, h, counted, pattern)
		h.gate += ((1.0 if on else 0.0) - h.gate) * e_gate
		var gain: float = gains[gate_name]
		I *= (h.gate + (1.0 - h.gate) * dropk) * (gain + (1.0 - gain) * dropk)
		I *= h.move_level + (1.0 - h.move_level) * dropk
		f.level = _lamp(I) * float(faders.get(f.group, 1.0))
		# the look spreads the two colours, through a slow colour fade
		var cname: String = look_colour if h.role == "overhead" else row_colour if row else "sides"
		var share := L.colour(cname, h, beats)
		var target := _vivid(_spread(cname, h, k32, k64, pal).lerp(Color.WHITE, share.y)) if multi else _vivid(col.lerp(col2, share.x).lerp(Color.WHITE, share.y))
		if warm > 0.0: target = target.lerp(WARM, warm)
		if brk: target = target.lerp(Color.WHITE, white_k)
		if not h.colored:
			h.color = target
			h.colored = true
		h.color = h.color.lerp(target, e14)
		f.color = h.color
		var z: float = 1.0 - sig.build * 0.4 if brk else 1.0
		z *= 1.35 if calm or brk else 0.75 if peak else 0.9
		var gobo: float = 0.7 if not brk and not calm and not row else 0.0
		if row: z *= 0.7   # the row's beams are tight and clean: sharp lines in the haze
		if h.role == "overhead" and not brk:   # the look's beam: narrow, wide or with a gobo
			z *= look_beam[0]
			if look_beam[1] >= 0.0: gobo = look_beam[1]
		if f.kind == Rig.SPOT: gobo = 1.0
		f.zoom = z
		f.gobo = gobo
		f.spin = 0.06 if gobo > 0.0 else 0.0

	# ----- washes and bars -----
	# Washes are the colour under the beams: a steady level for the part of the track that changes over a couple of
	# seconds, rising in a build-up and swelling on a drop, and never flashing with the kick: that is what the heads do.
	var wash_target: float = (0.1 + sig.build * 0.32 if brk else WASH_LEVEL.get(sec, 0.24) + mood.breathe * sig.mid * 0.25) * style.get("wash", 1.0)
	if multi and not brk: wash_target *= 0.25 + 0.45 * (0.5 + 0.5 * sin(sig.phase_clock * TAU / 64.0))
	_wash_level += (wash_target - _wash_level) * ease.call(1.6)
	for i in _washes.size():
		var f: Rig.Fixture = _washes[i]
		var p := f.pos
		match f.group:
			"roof": f.target = Vector3(f.mount.x * 0.5, Hall.DECK, -31.5)   # the stage and the DJ
			"rear": f.target = Vector3(p.x, 0.0, p.z - 10.0)
			_: f.target = Vector3(p.x, 0.0, p.z + 3.0)
		f.zoom = 1.0
		f.gobo = 0.0
		f.level = _lamp((maxf(_wash_level * _w.wash, mood.wash) + sig.drop * 0.3 + sig.lift * 0.15) * master) * float(tune.groups.get("wash", 1.0))
		f.color = tint.call(pal[i % pal.size()] if multi else col2 if i % 2 else col)
	for i in rig.battens.size():
		var bt: Rig.Batten = rig.battens[i]
		_bar_level[i] = _bar_level[i] * exp(-dt * mood.decay)
		var breathe: float = (0.25 + mood.breathe) * sig.mid * (0.5 + 0.5 * sin(_t * 0.8 + i * 0.6)) if mood.breathe > 0.0 or brk else 0.0
		var run: float = sig.build * pow(0.5 + 0.5 * sin(bt.u * 5.0 + maxi(bt.truss, 0) + _chase), 4.0) if brk else 0.0   # a chase racing along as the build-up grows
		var hit: float = sig.accent * (0.5 if i % 2 == _beat % 2 else 0.1)
		bt.level = _lamp(maxf(maxf(maxf(_bar_level[i], breathe), maxf(run, hit)) * _w.bars, maxf(sig.drop, sig.lift * 0.45)) * master) * float(tune.groups.get("batten", 1.0))
		bt.color = pal[i % pal.size()] if multi else col2 if i % 2 else col
		bt.chase_amount = 0.0
		bt.strobe = flash * strobe_k * (0.0 if manual.blackout else 1.0) * float(tune.groups.get("batten", 1.0))

	# ----- the trusses on their winches -----
	# Heavy trusses hold a formation for minutes. In a break they sink further as the build grows, in a measured
	# wave, and level out; the drop takes them back up to the formation.
	for i in rig.trusses.size():
		var v := i / float(rig.trusses.size() - 1)
		var base := L.truss_drop(_truss_look, v, i)
		var want := base
		if brk and _grooved: want = minf(L.DEEPEST, base + sig.build * 2.0 + maxf(0.0, sin(v * TAU - sig.build * PI)) * sig.build)
		rig.truss_targets[i] = want
		rig.truss_rolls[i] = 0.0 if brk else L.truss_roll(_truss_look, i)

	# the room itself: how much of all this lands on walls, floor and crowd, and in what colour
	rig.room_color = col.lerp(Color.WHITE, maxf(flash, blind * 0.7))
	rig.room_level = (1.5 + sig.energy * 7.0 + sig.kick * 26.0 + sig.build * 6.0 + sig.lift * 14.0 + flash * 100.0 + blind * 50.0) * master
	hall_look = [head_name, truss_name, L.ROW_LOOKS[row_look][0]]
	status = ("build-up" if sig.build > 0.45 else "break") if brk else SECTION_NAME.get(sec, sec) + " · " + head_name
	_shown = [col, col2]
	colours_in_use = pal if multi else _shown

# SV in the browser draws a level of 1 as a full beam and its renderer is exposed for levels around 0.2 to 0.5;
# this rig's lamps are linear up to 1. A soft knee keeps the order of things (calm, groove, drop) and lets the
# quieter levels read as light, as they did in the browser.
static func _lamp(I: float) -> float:
	return 1.0 - exp(-maxf(I, 0.0) * 3.5)

# How the beam groups weigh against each other (the live faders' groups multiply this).
const GROUP_LEVEL := {"hall": 1.0, "front": 1.0, "back": 0.9, "rear": 0.85, "side": 0.85, "delay": 0.85, "roof": 0.8}

func scene_text() -> String:
	return "%s · %s · %s · trusses %s · row %s" % [status, PROGRAMS[_program].name, mood.get("family", ""), truss_name, row_look]
