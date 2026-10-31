class_name Hud
extends CanvasLayer
# What the show knows, always on screen, a corner for each subject:
#   top left      SOUND    where the music comes from, how loud, the tempo and how sure, the delay, rekordbox
#   top right     TRACK    the part of the track, bar and beat, the phrase, build and riser, what happened last
#   bottom left   SHOW     the genre, the scene (who leads, who supports), the hall's look, the colours, a mix
#   bottom right  SYSTEM   frames, GPU time, quality, view
# This is the info screen (key I, off at first); the show bar (overlay.gd) is what the DJ sees. The note at the top
# (say) is always there.

var info := false
var _boxes := {}
var _note: Label
var _note_until := 0.0

func _ready() -> void:
	layer = 10
	for corner in ["tl", "tr", "bl", "br"]: _boxes[corner] = _box(corner)
	_note = Label.new()
	_note.add_theme_font_size_override("font_size", 26)
	_note.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.9))
	_note.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	_note.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_note.offset_top = 16
	_note.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(_note)

# A word in the middle at the top for a moment (the delay, the one, the strobes).
func say(text: String, seconds: float) -> void:
	_note.text = text
	_note_until = Time.get_ticks_msec() / 1000.0 + seconds

func _box(corner: String) -> RichTextLabel:
	var panel := PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.02, 0.025, 0.03, 0.62)
	style.set_corner_radius_all(8)
	style.content_margin_left = 12
	style.content_margin_right = 12
	style.content_margin_top = 8
	style.content_margin_bottom = 8
	panel.add_theme_stylebox_override("panel", style)
	var top := corner.begins_with("t")
	var left := corner.ends_with("l")
	panel.anchor_left = 0.0 if left else 1.0
	panel.anchor_right = panel.anchor_left
	panel.anchor_top = 0.0 if top else 1.0
	panel.anchor_bottom = panel.anchor_top
	panel.grow_horizontal = Control.GROW_DIRECTION_END if left else Control.GROW_DIRECTION_BEGIN
	panel.grow_vertical = Control.GROW_DIRECTION_END if top else Control.GROW_DIRECTION_BEGIN
	var m := 14.0
	panel.offset_left = m if left else -m
	panel.offset_right = panel.offset_left
	panel.offset_top = m if top else -m
	panel.offset_bottom = panel.offset_top
	panel.visible = false
	add_child(panel)
	var text := RichTextLabel.new()
	text.bbcode_enabled = true
	text.fit_content = true
	text.autowrap_mode = TextServer.AUTOWRAP_OFF
	text.scroll_active = false
	text.custom_minimum_size.x = 330
	text.add_theme_font_size_override("normal_font_size", 18)
	text.add_theme_font_size_override("bold_font_size", 18)
	panel.add_child(text)
	return text

static func _head(title: String) -> String:
	return "[b][color=#8fb4ff]%s[/color][/b]\n" % title

static func _swatch(c: Color) -> String:
	return "[color=#%s]■[/color]" % c.to_html(false)

func refresh(show: Show, listen: Listen, rb: Rekordbox, quality: String, auto: bool, view: View, safe: bool) -> void:
	_note.visible = Time.get_ticks_msec() / 1000.0 < _note_until
	for corner in _boxes: _boxes[corner].get_parent().visible = info
	if not info: return
	# SOUND
	var s := _head("SOUND")
	var src := show.source if show.source != "" else "waiting for music"
	if listen.device_name != "" and src.contains("audio"): src += " (%s)" % listen.device_name
	s += "Source  %s\n" % src
	s += "Level  %.2f   bass %.2f · mid %.2f · treble %.2f\n" % [listen.energy, listen.bass, listen.mid, listen.treble]
	s += "Tempo  %.1f BPM%s\n" % [show.bpm, "   sure %d%%" % roundi(listen.confidence * 100.0) if listen.confidence > 0.0 else ""]
	s += "Delay  %d ms\n" % roundi(listen.latency * 1000.0)
	if rb.listening: s += "Rekordbox  %s · port %d%s" % ["live" if rb.live() else "listening", rb.port, "\n           " + show.deck_text(rb) if rb.live() else ""]
	elif rb.error != "": s += "Rekordbox  [color=#ff9a80]%s[/color]" % rb.error
	else: s += "Rekordbox  off"
	_boxes.tl.text = s
	# TRACK
	var t := _head("TRACK")
	var beat := show.beat
	t += "Part  %s%s\n" % [show.section, "   (%s)" % listen.phase if listen.phase != "" else "   (judged by the show)"]
	t += "Bar  %d   beat %d   phrase %d · bar %d of 4\n" % [int(floorf(beat / 4.0)) + 1, posmod(int(floorf(beat)), 4) + 1, int(floorf(beat / 16.0)) + 1, posmod(int(floorf(beat / 4.0)), 4) + 1]
	t += "Build  %.2f   riser %.2f   drop %.2f\n" % [show.build, listen.riser, show.drop]
	if show.phrase != "": t += "Rekordbox  %s → %s in %d\n" % [show.phrase, show.next_phrase, int(show.countin)]
	t += "Last  %s" % show.last_event()
	_boxes.tr.text = t
	# SHOW
	var w := _head("SHOW")
	w += "Genre  %s\n" % show.genre_now()
	w += "Scene  %s\n" % show.scene_text()
	w += "Hall  %s\n" % " · ".join(show.hall_look)
	var cols: Array = show.colours_now()
	w += "Colours  %s %s%s" % [_swatch(cols[0]), _swatch(cols[1]), "   mixing in %s (%d%%)" % [show.incoming, roundi(show.mix * 100.0)] if show.incoming != "" else ""]
	_boxes.bl.text = w
	# SYSTEM
	var y := _head("SYSTEM")
	y += "Version  %s\n" % BuildInfo.label()
	var gpu := RenderingServer.viewport_get_measured_render_time_gpu(get_viewport().get_viewport_rid())
	y += "Frames  %d fps   %.1f ms   GPU %.1f ms\n" % [Engine.get_frames_per_second(), 1000.0 / maxf(Engine.get_frames_per_second(), 1.0), gpu]
	y += "Quality  %s%s   scale %d%%\n" % [quality.capitalize(), " (auto)" if auto else "", roundi(get_viewport().scaling_3d_scale * 100.0)]
	y += "View  %s   strobes %s" % ["over the shoulder" if view.shoulder else "the DJ's eyes", "gentle" if safe else "full"]
	_boxes.br.text = y
