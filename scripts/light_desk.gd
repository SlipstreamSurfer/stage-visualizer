class_name LightDesk
extends CanvasLayer
# Group cards over the running show. D closes, W switches washes; mouse controls never take the show's keys.
# A card owns its switch and level control, so another control (such as an XY pad) can replace the fader later.

# [tune.groups key, short name, location]
const GROUPS := [["front", "Stage row", "Stage edge"], ["back", "Back towers", "Behind the DJ"], ["roof", "Roof spots", "Above the stage"],
	["hall", "Hall beams", "Over the crowd"], ["side", "Side towers", "Along the walls"], ["delay", "Delay towers", "Middle of the hall"],
	["wash", "Washes", "Ambient light · W"], ["batten", "Bars", "Strobe battens"], ["rear", "Rear truss", "Back of the hall"]]

var light: Show
var _root: Control
var _panel: PanelContainer
var _grid: GridContainer
var _summary: Label
var _rows := {}   # group -> switch, replaceable level control, value, card, last positive level
var _card_on: StyleBoxFlat
var _card_off: StyleBoxFlat
var _thumb: Texture2D
var _sync_at := 0.0
var _haze_slider: HSlider
var _haze_value: Label
var _haze_hint: Label
var _fog_enabled := true

func _ready() -> void:
	layer = 15
	_root = Control.new()
	_root.theme = UiStyle.theme()
	_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_root)
	_panel = PanelContainer.new()
	_panel.name = "LightDeskPanel"
	_panel.mouse_filter = Control.MOUSE_FILTER_STOP
	_panel.add_theme_stylebox_override("panel", UiStyle.box(UiStyle.PANEL, UiStyle.BORDER, 20))
	_root.add_child(_panel)
	_panel.anchor_left = 1.0
	_panel.anchor_right = 1.0
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 16)
	_panel.add_child(column)
	var header := HBoxContainer.new()
	column.add_child(header)
	var title := UiStyle.label("Light desk", "Title")
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(title)
	var close_button := UiStyle.button("Close")
	close_button.name = "CloseDesk"
	close_button.focus_mode = Control.FOCUS_NONE
	close_button.pressed.connect(close)
	header.add_child(close_button)
	column.add_child(UiStyle.label("D / Esc closes · W switches washes", "Hint"))
	_summary = UiStyle.label("", "Hint")
	_summary.name = "ActiveGroups"
	_summary.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	column.add_child(_summary)
	var scroll := ScrollContainer.new()
	scroll.name = "GroupScroll"
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	column.add_child(scroll)
	_grid = GridContainer.new()
	_grid.name = "GroupsGrid"
	_grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_grid.add_theme_constant_override("h_separation", 12)
	_grid.add_theme_constant_override("v_separation", 12)
	scroll.add_child(_grid)
	_card_on = UiStyle.box(UiStyle.SURFACE, UiStyle.ACCENT.darkened(0.45), 16)
	_card_off = UiStyle.box(UiStyle.PANEL, UiStyle.BORDER, 16)
	_thumb = _fader_thumb()
	for entry in GROUPS: _group_card(entry)
	_haze_control(column)
	var footer := HBoxContainer.new()
	column.add_child(footer)
	var all := UiStyle.button("All on · 100%")
	all.focus_mode = Control.FOCUS_NONE
	all.pressed.connect(all_on)
	footer.add_child(all)
	var note := UiStyle.label("Levels last for this run", "Hint")
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	note.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	note.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	footer.add_child(note)
	_root.resized.connect(_layout)
	_grid.minimum_size_changed.connect(_layout)
	_panel.minimum_size_changed.connect(_layout)
	_layout()
	sync()
	_panel.hide()

func _group_card(entry: Array) -> void:
	var key: String = entry[0]
	var card := PanelContainer.new()
	card.name = key.capitalize().replace(" ", "") + "Card"
	card.custom_minimum_size = Vector2(240, 148)
	card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_grid.add_child(card)
	var body := VBoxContainer.new()
	body.add_theme_constant_override("separation", 8)
	card.add_child(body)
	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 8)
	body.add_child(header)
	var labels := VBoxContainer.new()
	labels.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	labels.add_theme_constant_override("separation", 0)
	header.add_child(labels)
	var title := UiStyle.label(entry[1])
	title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	labels.add_child(title)
	var location := UiStyle.label(entry[2], "Hint")
	location.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	labels.add_child(location)
	var toggle_button := UiStyle.button("ON")
	toggle_button.toggle_mode = true
	toggle_button.button_pressed = true
	toggle_button.custom_minimum_size.x = 72
	toggle_button.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	toggle_button.focus_mode = Control.FOCUS_NONE
	toggle_button.tooltip_text = "Switch " + str(entry[1]).to_lower() + " on or off"
	toggle_button.add_theme_stylebox_override("pressed", UiStyle.box(UiStyle.ACCENT, Color.TRANSPARENT, 12))
	toggle_button.add_theme_stylebox_override("hover_pressed", UiStyle.box(UiStyle.ACCENT.lightened(0.12), Color.TRANSPARENT, 12))
	toggle_button.add_theme_color_override("font_pressed_color", UiStyle.PANEL)
	toggle_button.add_theme_color_override("font_hover_pressed_color", UiStyle.PANEL)
	header.add_child(toggle_button)
	var level := HBoxContainer.new()
	level.add_theme_constant_override("separation", 8)
	body.add_child(level)
	var slider := HSlider.new()
	slider.min_value = 0.0
	slider.max_value = 1.0
	slider.step = 0.05
	slider.value = 1.0
	slider.custom_minimum_size = Vector2(128, 44)
	slider.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	slider.focus_mode = Control.FOCUS_NONE
	slider.tooltip_text = str(entry[1]) + " level"
	_style_fader(slider)
	level.add_child(slider)
	var value := UiStyle.label("100%")
	value.custom_minimum_size.x = 64
	value.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	value.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	level.add_child(value)
	_rows[key] = {"toggle": toggle_button, "slider": slider, "value": value, "card": card, "last": 1.0}
	toggle_button.toggled.connect(func(on: bool):
		if on and slider.value <= 0.0: slider.set_value_no_signal(_rows[key].last)
		_apply(key))
	slider.value_changed.connect(func(v: float):
		toggle_button.set_pressed_no_signal(v > 0.0)
		if v > 0.0: _rows[key].last = v
		_apply(key))

# Atmosphere is independent of the light-group faders and their All on reset.
func _haze_control(column: VBoxContainer) -> void:
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", UiStyle.box(UiStyle.SURFACE, UiStyle.BORDER, 16))
	column.add_child(panel)
	var body := VBoxContainer.new()
	body.add_theme_constant_override("separation", 4)
	panel.add_child(body)
	var header := HBoxContainer.new()
	body.add_child(header)
	var title := UiStyle.label("Haze", "Subtitle")
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(title)
	_haze_value = UiStyle.label("100%")
	_haze_value.name = "HazeValue"
	header.add_child(_haze_value)
	_haze_slider = HSlider.new()
	_haze_slider.name = "HazeSlider"
	_haze_slider.min_value = 0.0
	_haze_slider.max_value = 2.0
	_haze_slider.step = 0.05
	_haze_slider.value = 1.0
	_haze_slider.custom_minimum_size.y = 44
	_haze_slider.focus_mode = Control.FOCUS_NONE
	_haze_slider.tooltip_text = "Haze density and beam visibility, not lamp brightness"
	_style_fader(_haze_slider)
	body.add_child(_haze_slider)
	_haze_hint = UiStyle.label("", "Hint")
	_haze_hint.name = "HazeHint"
	_haze_hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body.add_child(_haze_hint)
	_haze_slider.value_changed.connect(func(v: float):
		if light != null: light.tune.haze = v
		_haze_value.text = "%d%%" % roundi(v * 100.0))

func _style_fader(slider: HSlider) -> void:
	var track := UiStyle.box(UiStyle.PANEL, Color.TRANSPARENT, 0)
	track.content_margin_top = 3
	track.content_margin_bottom = 3
	slider.add_theme_stylebox_override("slider", track)
	var fill := track.duplicate() as StyleBoxFlat
	fill.bg_color = UiStyle.ACCENT
	slider.add_theme_stylebox_override("grabber_area", fill)
	slider.add_theme_stylebox_override("grabber_area_highlight", fill)
	slider.add_theme_icon_override("grabber", _thumb)
	slider.add_theme_icon_override("grabber_highlight", _thumb)

func set_fog_enabled(enabled: bool) -> void:
	_fog_enabled = enabled
	_refresh_haze()

func _refresh_haze() -> void:
	if _haze_slider == null: return
	var level := Haze.level(light.tune.get("haze", 1.0) if light != null else 1.0)
	_haze_slider.set_value_no_signal(level)
	_haze_value.text = "%d%%" % roundi(level * 100.0)
	_haze_hint.text = "Haze density · 100% is the original setting" if _fog_enabled else "Beams only · volumetric haze is off at this quality"

func _layout() -> void:
	if _grid == null: return
	var available := _root.size
	var width := minf(available.x - 32.0, clampf(available.x * 0.56, 560.0, 960.0))
	_panel.offset_left = -width - 16
	_panel.offset_right = -16
	_panel.offset_top = 16
	_grid.columns = 3 if width >= 840 else 2 if width >= 540 else 1
	var height := _panel.get_combined_minimum_size().y + _grid.get_combined_minimum_size().y + 8.0
	_panel.offset_bottom = 16 + minf(available.y - 32.0, height)

static func _fader_thumb() -> Texture2D:
	var image := Image.create(28, 28, false, Image.FORMAT_RGBA8)
	for y in 28:
		for x in 28:
			var colour := UiStyle.ACCENT
			colour.a = clampf(13.5 - Vector2(x - 13.5, y - 13.5).length(), 0.0, 1.0)
			image.set_pixel(x, y, colour)
	return ImageTexture.create_from_image(image)

func _process(dt: float) -> void:
	if not is_open(): return
	_sync_at += dt
	if _sync_at >= 0.2:
		_sync_at = 0.0
		sync()

func is_open() -> bool:
	return _panel != null and _panel.visible

func open() -> void:
	sync()
	_layout()
	_panel.show()

func close() -> void:
	_panel.hide()

func toggle() -> void:
	if is_open(): close()
	else: open()

# Reflect the real show (including external changes), without emitting control signals.
func sync() -> void:
	for key in _rows:
		var level := 1.0 if light == null else float(light.tune.groups.get(key, 1.0))
		_rows[key].toggle.set_pressed_no_signal(level > 0.0)
		if level > 0.0:
			_rows[key].slider.set_value_no_signal(level)
			_rows[key].last = level
		_refresh(key)
	_update_summary()
	_refresh_haze()

# On again restores the fader, including its last positive value after dragging down to zero.
func toggle_group(key: String) -> bool:
	sync()
	var button: BaseButton = _rows[key].toggle
	button.button_pressed = not button.button_pressed
	return button.button_pressed

func all_on() -> void:
	for key in _rows:
		_rows[key].toggle.set_pressed_no_signal(true)
		_rows[key].slider.set_value_no_signal(1.0)
		_rows[key].last = 1.0
		_apply(key)

func _apply(key: String) -> void:
	var on: bool = _rows[key].toggle.button_pressed
	var level: float = _rows[key].slider.value
	if light != null:
		if not on: light.tune.groups[key] = 0.0
		elif level >= 0.999: light.tune.groups.erase(key)
		else: light.tune.groups[key] = level
	_refresh(key)
	_update_summary()

func _refresh(key: String) -> void:
	var row: Dictionary = _rows[key]
	var on: bool = row.toggle.button_pressed
	row.toggle.text = "ON" if on else "OFF"
	row.value.text = "%d%%" % roundi(row.slider.value * 100.0)
	row.value.add_theme_color_override("font_color", UiStyle.TEXT if on else UiStyle.MUTED)
	row.slider.modulate = Color.WHITE if on else Color(0.55, 0.62, 0.67)
	row.card.add_theme_stylebox_override("panel", _card_on if on else _card_off)

func _update_summary() -> void:
	var on := 0
	for row: Dictionary in _rows.values():
		if row.toggle.button_pressed: on += 1
	_summary.text = "%d / %d groups on · Automatic show keeps running" % [on, _rows.size()]
