class_name ShowBar
extends CanvasLayer
# During the show, one calm bar along the bottom: the track, the tempo, the part, the genre and whether the source
# works. It fades out after a few seconds without a mouse or a key, and comes back with one, with a new track, or
# when the source stops working. The technical corners are the info screen (Hud, key I).

const FADE_AFTER := 4.0
const TEXT := Color(0.94, 0.95, 0.97)
const DIM := Color(0.72, 0.76, 0.82)
const GOOD := Color(0.55, 0.9, 0.6)
const WARN := Color(1.0, 0.72, 0.45)

var _panel: PanelContainer
var _track: Label
var _facts: Label
var _source: Label
var _idle := 0.0
var _alpha := 1.0
var _title := ""
var _trouble := false

func _ready() -> void:
	layer = 9
	_panel = PanelContainer.new()
	_panel.theme = UiStyle.theme()
	_panel.add_theme_stylebox_override("panel", panel_style(0.72))
	_panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	_panel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_panel.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_panel.offset_bottom = -24
	_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_panel)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 36)
	_panel.add_child(row)
	_track = _label(row, 26, TEXT)
	_track.custom_minimum_size.x = 260
	_track.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_facts = _label(row, 22, DIM)
	_source = _label(row, 22, GOOD)

# The look of every panel of the show's own screens (the bar, the pause menu, the help).
static func panel_style(alpha := 0.9) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.035, 0.04, 0.05, alpha)
	style.set_corner_radius_all(12)
	style.content_margin_left = 28
	style.content_margin_right = 28
	style.content_margin_top = 14
	style.content_margin_bottom = 14
	return style

static func _label(parent: Control, size: int, color: Color) -> Label:
	var l := Label.new()
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	parent.add_child(l)
	return l

# Something happened that the DJ may want to see: the bar comes back.
func wake() -> void:
	_idle = 0.0

func refresh(dt: float, show: Show, listen: Listen, rb: Rekordbox) -> void:
	var title := show.title if show.title != "" else listen.title
	if title != _title:
		_title = title
		wake()
	_track.text = title if title != "" else "Live sound"
	var bpm := "%d BPM" % roundi(show.bpm) if show.bpm > 0.0 else "finding the tempo"
	_facts.text = "%s    %s    %s" % [bpm, _part(show), show.genre_now()]
	# the source: rekordbox, the sound, or what is wrong
	var text := ""
	var ok := true
	var heard: Dictionary = listen.status()
	if rb.live(): text = "✓ rekordbox" + (" + sound" if listen.source not in ["none", ""] else "")
	elif rb.listening and listen.source in ["none", ""]:
		text = "⚠ waiting for rekordbox"
		ok = false
	elif listen.source in ["none", ""]:
		text = "⚠ no sound"
		ok = false
	elif float(heard.level) < 0.002:
		text = "⚠ silence"
		ok = false
	else: text = "✓ sound"
	_source.text = text
	_source.add_theme_color_override("font_color", GOOD if ok else WARN)
	if not ok and not _trouble: wake()
	_trouble = not ok
	_idle += dt
	var want := 1.0 if _idle < FADE_AFTER or not ok else 0.0
	_alpha = move_toward(_alpha, want, dt * (4.0 if want > _alpha else 1.2))
	_panel.modulate.a = _alpha
	_panel.visible = _alpha > 0.01

static func _part(show: Show) -> String:
	if show.blackout > 0.0: return "Drop coming"
	return {"intro": "Intro", "groove": "Groove", "build": "Build-up", "break": "Break", "peak": "Peak", "outro": "Outro"}.get(show.section, show.section.capitalize())
