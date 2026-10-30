class_name SettingsPanel
extends CanvasLayer
# A self-contained settings panel. Main applies the emitted quality choice.

signal applied(options: Dictionary)
signal closed

const DEFAULTS := {"source": "both", "device": "", "track": "", "latency": 0.08, "quality": "auto", "genre": "auto", "osc_port": 4460,
	"rekordbox_local": false, "setup_done": false, "safe": false, "screen": -1, "fullscreen": false, "fps_limit": 60, "camera": 1}
const SOURCES := ["system", "both", "rekordbox", "file"]
const SOURCE_LABELS := ["System audio", "System audio + rekordbox", "Rekordbox", "Music file"]
const QUALITIES := ["auto", "light", "normal", "high", "ultra"]

var values := DEFAULTS.duplicate()
var config_path := "user://settings.cfg"
var _loaded := false
var _audio_state := {}
var _root: Control
var _source: OptionButton
var _genre: OptionButton
var _device: OptionButton
var _track: LineEdit
var _latency: SpinBox
var _quality: OptionButton
var _rekordbox_page: RekordboxPage
var _rb: Rekordbox
var _tabs: TabContainer
var _port: SpinBox
var _error: Label
var _dialog: FileDialog
var _input_row: HBoxContainer
var _file_row: HBoxContainer
var _port_row: HBoxContainer
var _screen: OptionButton
var _fullscreen: CheckButton
var _fps: OptionButton
var _camera: OptionButton
var _safe: CheckButton
var shortcuts_enabled := true

func load_settings() -> Dictionary:
	var config := ConfigFile.new()
	var saved := DEFAULTS.duplicate()
	if config.load(config_path) == OK:
		for key in DEFAULTS: saved[key] = config.get_value("settings", key, DEFAULTS[key])
	values = _validated(saved)
	_loaded = true
	return values.duplicate()

# CLI options can override saved values before the first apply.
func set_values(options: Dictionary) -> void:
	var merged := values.duplicate()
	merged.merge(options, true)
	values = _validated(merged)
	if _root: _sync()

func save_settings() -> Error:
	values = _validated(values)
	var config := ConfigFile.new()
	var loaded := config.load(config_path)
	if loaded not in [OK, ERR_FILE_NOT_FOUND]: return loaded
	for key in DEFAULTS: config.set_value("settings", key, values[key])
	return _save_config(config)

# Persist one shortcut choice without also persisting unrelated CLI overrides.
func remember(key: String, value: Variant) -> Error:
	return remember_many({key: value})

func remember_many(options: Dictionary) -> Error:
	for key in options:
		if not DEFAULTS.has(key): return ERR_INVALID_PARAMETER
	var config := ConfigFile.new()
	var loaded := config.load(config_path)
	if loaded not in [OK, ERR_FILE_NOT_FOUND]: return loaded
	var saved := DEFAULTS.duplicate()
	for name in DEFAULTS: saved[name] = config.get_value("settings", name, DEFAULTS[name])
	saved.merge(options, true)
	saved = _validated(saved)
	for name in DEFAULTS: config.set_value("settings", name, saved[name])
	var result := _save_config(config)
	if result == OK:
		for key in options: values[key] = saved[key]
		if _root: _sync()
	return result

func _save_config(config: ConfigFile) -> Error:
	var destination := ProjectSettings.globalize_path(config_path)
	var temporary := destination + ".%d.tmp" % Time.get_ticks_usec()
	var result := config.save(temporary)
	if result != OK: return result
	result = DirAccess.rename_absolute(temporary, destination)
	if result != OK: DirAccess.remove_absolute(temporary)
	return result

static func _validated(options: Dictionary) -> Dictionary:
	var result := DEFAULTS.duplicate()
	for key in ["source", "device", "track", "quality", "genre"]:
		if options.get(key) is String: result[key] = options[key]
	if result.genre not in Show.GENRE_ORDER: result.genre = DEFAULTS.genre
	if result.source not in SOURCES: result.source = DEFAULTS.source
	if result.quality not in QUALITIES: result.quality = DEFAULTS.quality
	var delay = options.get("latency", DEFAULTS.latency)
	if (delay is float or delay is int) and is_finite(float(delay)):
		result.latency = clampf(float(delay), 0.0, 0.5)
	var port = options.get("osc_port", DEFAULTS.osc_port)
	if port is int or (port is float and is_finite(port)):
		result.osc_port = int(clampf(float(port), 1.0, 65535.0))
	for key in ["setup_done", "safe", "fullscreen", "rekordbox_local"]:
		if options.get(key) is bool: result[key] = options[key]
	for key in ["screen", "fps_limit", "camera"]:
		var number = options.get(key)
		if not (number is int or number is float) or not is_finite(float(number)): continue
		if float(number) != floorf(float(number)): continue
		match key:
			"screen":
				if number >= -1 and number <= 64: result.screen = int(number)
			"fps_limit":
				if number in SvDisplay.FPS_LIMITS: result.fps_limit = int(number)
			"camera":
				if number >= 1 and number <= 5: result.camera = int(number)
	return result

# Call at startup and on applied. Unchanged sources keep playing.
func apply_audio(listen: Listen, rb: Rekordbox) -> Error:
	_rb = rb
	if _rekordbox_page: _rekordbox_page.receiver = rb
	listen.latency = values.latency
	var missing_device: bool = values.source in ["system", "both"] and values.device != "" and values.device not in AudioServer.get_input_device_list()
	var result := ERR_UNAVAILABLE if missing_device else OK
	var state := {"source": values.source, "device": values.device, "track": values.track}
	if not missing_device and state != _audio_state:
		match values.source:
			"file":
				if not listen.start_file(values.track): return ERR_FILE_CANT_OPEN
			"rekordbox": listen.stop()
			_: listen.start_input(values.device)
		_audio_state = state
	if values.source in ["both", "rekordbox"]:
		if not rb.listening or rb.port != int(values.osc_port): rb.start(int(values.osc_port))
		if not rb.listening: return ERR_CANT_OPEN
	elif rb.listening: rb.stop()
	return result

func _ready() -> void:
	if not _loaded: load_settings()
	layer = 20
	_root = UiStyle.screen(self)
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_root.add_child(center)
	var panel := PanelContainer.new()
	panel.custom_minimum_size.x = 880
	center.add_child(panel)
	var column := VBoxContainer.new()
	panel.add_child(column)
	column.add_child(UiStyle.label("Settings", "Title"))
	var tabs := TabContainer.new()
	_tabs = tabs
	tabs.get_tab_bar().add_theme_font_size_override("font_size", UiStyle.BODY)
	column.add_child(tabs)
	var sound := VBoxContainer.new()
	sound.name = "Sound"
	tabs.add_child(sound)
	var show_options := VBoxContainer.new()
	show_options.name = "Show"
	tabs.add_child(show_options)
	var display := VBoxContainer.new()
	display.name = "Display"
	tabs.add_child(display)
	var rb_scroll := ScrollContainer.new()
	rb_scroll.name = "Rekordbox"
	rb_scroll.custom_minimum_size.y = 700
	rb_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	tabs.add_child(rb_scroll)
	_rekordbox_page = RekordboxPage.new()
	_rekordbox_page.receiver = _rb
	_rekordbox_page.same_computer = values.rekordbox_local
	_rekordbox_page.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	rb_scroll.add_child(_rekordbox_page)
	_rekordbox_page.port_changed.connect(func(port: int):
		_port.value = port)
	tabs.tab_changed.connect(func(index: int):
		if index == rb_scroll.get_index() and is_instance_valid(_rb) and not _rb.listening:
			_rb.start(int(_port.value)))
	tabs.custom_minimum_size.y = 470
	_source = OptionButton.new()
	for text in SOURCE_LABELS: _source.add_item(text)
	_row(sound, "Source", _source)
	_genre = OptionButton.new()
	_genre.fit_to_longest_item = false
	_genre.custom_minimum_size.x = 280
	_genre.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	for id in Show.GENRE_ORDER: _genre.add_item(Show.genre_name(id))
	_row(show_options, "Genre", _genre)
	_source.item_selected.connect(func(_index: int): _source_rows())
	_device = OptionButton.new()
	_device.fit_to_longest_item = false
	_device.custom_minimum_size.x = 280
	_device.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_input_row = _row(sound, "Audio input", _device)
	_track = LineEdit.new()
	_track.placeholder_text = "Path to .ogg, .mp3 or .wav"
	_track.custom_minimum_size.x = 250
	_file_row = _row(sound, "Music file", _track)
	var browse := UiStyle.button("Browse")
	_file_row.add_child(browse)
	_dialog = FileDialog.new()
	_dialog.theme = UiStyle.theme()
	_dialog.access = FileDialog.ACCESS_FILESYSTEM
	_dialog.file_mode = FileDialog.FILE_MODE_OPEN_FILE
	_dialog.filters = PackedStringArray(["*.ogg,*.mp3,*.wav;Music"])
	add_child(_dialog)
	browse.pressed.connect(func(): _dialog.popup_centered_ratio(0.7))
	_dialog.file_selected.connect(func(path: String): _track.text = path)
	_latency = SpinBox.new()
	_latency.min_value = 0
	_latency.max_value = 500
	_latency.step = 5
	_latency.suffix = "ms"
	_row(sound, "Audio delay", _latency)
	sound.add_child(UiStyle.label("Make the light meet the kick. Set this in Source.", "Hint"))
	_port = SpinBox.new()
	_port.min_value = 1
	_port.max_value = 65535
	_port.step = 1
	_port.rounded = true
	_port_row = _row(sound, "Rekordbox port", _port)
	_port.value_changed.connect(func(port: float):
		_rekordbox_page._port.set_value_no_signal(port)
		_rekordbox_page._refresh()
		if is_open() and is_instance_valid(_rb): _rb.start(int(port)))
	_quality = OptionButton.new()
	for choice in QUALITIES: _quality.add_item("Automatic" if choice == "auto" else choice.capitalize())
	_row(show_options, "Quality", _quality)
	_safe = CheckButton.new()
	_safe.text = "Gentle strobes"
	show_options.add_child(_safe)
	show_options.add_child(UiStyle.label("Less intense flashes. You can change this during a show.", "Hint"))
	_screen = OptionButton.new()
	_screen.fit_to_longest_item = false
	_row(display, "Screen", _screen)
	_fullscreen = CheckButton.new()
	_fullscreen.text = "Full screen"
	display.add_child(_fullscreen)
	_fps = OptionButton.new()
	for limit in SvDisplay.FPS_LIMITS: _fps.add_item("No limit" if limit == 0 else "%d fps" % limit)
	_row(display, "Frame limit", _fps)
	_camera = OptionButton.new()
	for i in View.NAMES.size(): _camera.add_item("%d · %s" % [i + 1, View.NAMES[i]])
	_row(display, "Camera", _camera)
	display.add_child(UiStyle.label("Use 1–5 to change the camera during a show.", "Hint"))
	_error = Label.new()
	_error.add_theme_color_override("font_color", UiStyle.WARNING)
	_error.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_error.custom_minimum_size.x = 480
	column.add_child(_error)
	var buttons := HBoxContainer.new()
	buttons.alignment = BoxContainer.ALIGNMENT_END
	buttons.add_theme_constant_override("separation", 12)
	column.add_child(buttons)
	var cancel := UiStyle.button("Back")
	cancel.pressed.connect(close_panel)
	buttons.add_child(cancel)
	var apply := UiStyle.button("Save", true)
	apply.pressed.connect(_apply)
	buttons.add_child(apply)
	_sync()
	_root.hide()

func _row(parent: VBoxContainer, caption: String, control: Control) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	parent.add_child(row)
	var label := Label.new()
	label.text = caption
	label.custom_minimum_size.x = 220
	row.add_child(label)
	control.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	control.custom_minimum_size.y = UiStyle.BUTTON_HEIGHT
	row.add_child(control)
	return row

func _sync() -> void:
	_source.select(SOURCES.find(values.source))
	_genre.select(Show.GENRE_ORDER.find(values.genre))
	_device.clear()
	_device.add_item("Automatic / default")
	_device.set_item_metadata(0, "")
	for device in AudioServer.get_input_device_list():
		_device.add_item(device)
		_device.set_item_metadata(_device.item_count - 1, device)
	if values.device != "" and values.device not in AudioServer.get_input_device_list():
		_device.add_item(values.device + " (unavailable)")
		_device.set_item_metadata(_device.item_count - 1, values.device)
	for i in _device.item_count:
		if _device.get_item_metadata(i) == values.device: _device.select(i)
	_track.text = values.track
	_latency.value = values.latency * 1000.0
	_quality.select(QUALITIES.find(values.quality))
	_port.value = values.osc_port
	_rekordbox_page.same_computer = values.rekordbox_local
	_rekordbox_page._location.select(0 if values.rekordbox_local else 1)
	_rekordbox_page._port.set_value_no_signal(values.osc_port)
	_rekordbox_page._refresh()
	_safe.button_pressed = values.safe
	_fullscreen.button_pressed = values.fullscreen
	_fps.select(SvDisplay.FPS_LIMITS.find(values.fps_limit))
	_camera.select(values.camera - 1)
	_screen.clear()
	_screen.add_item("Current screen")
	_screen.set_item_metadata(0, -1)
	for screen in SvDisplay.screens():
		_screen.add_item(screen.label)
		_screen.set_item_metadata(_screen.item_count - 1, screen.id)
		if screen.id == values.screen: _screen.select(_screen.item_count - 1)
	_error.text = ""
	_source_rows()

func _source_rows() -> void:
	var choice: String = SOURCES[_source.selected]
	_input_row.visible = choice in ["system", "both"]
	_file_row.visible = choice == "file"
	_port_row.visible = choice in ["both", "rekordbox"]
	_latency.editable = choice != "rekordbox"

func _apply() -> void:
	var options := values.duplicate()
	options.merge({"source": SOURCES[_source.selected], "genre": Show.GENRE_ORDER[_genre.selected], "device": _device.get_selected_metadata(),
		"track": _track.text.strip_edges(), "latency": _latency.value / 1000.0,
		"quality": QUALITIES[_quality.selected], "osc_port": int(_port.value), "rekordbox_local": _rekordbox_page.same_computer,
		"safe": _safe.button_pressed, "fullscreen": _fullscreen.button_pressed,
		"screen": _screen.get_selected_metadata(), "fps_limit": SvDisplay.FPS_LIMITS[_fps.selected], "camera": _camera.selected + 1}, true)
	if options.source == "file":
		if not FileAccess.file_exists(options.track) or options.track.get_extension().to_lower() not in ["ogg", "mp3", "wav"]:
			_error.text = "Choose an existing .ogg, .mp3 or .wav file."
			return
	if options.source in ["system", "both"] and options.device != "" and options.device not in AudioServer.get_input_device_list():
		_error.text = "That audio input is unavailable. Choose another input."
		return
	var previous := values.duplicate()
	values = _validated(options)
	if save_settings() != OK:
		values = previous
		_error.text = "Could not save settings. Check the settings folder."
		return
	close_panel()
	applied.emit(values.duplicate())

func open_panel() -> void:
	_sync()
	_root.show()
	if _tabs.current_tab == 3 and is_instance_valid(_rb) and not _rb.listening:
		_rb.start(int(_port.value))
	_source.grab_focus()

func show_error(message: String) -> void:
	open_panel()
	_error.text = message

func close_panel() -> void:
	if is_instance_valid(_rb):
		if values.source in ["both", "rekordbox"]:
			if _rb.port != values.osc_port: _rb.start(values.osc_port)
		else: _rb.stop()
	_rekordbox_page._save.hide()
	_dialog.hide()
	_root.hide()
	closed.emit()

func is_open() -> bool:
	return _root != null and _root.visible

func _input(event: InputEvent) -> void:
	if not (event is InputEventKey and event.pressed and not event.echo): return
	if is_open() and event.keycode == KEY_ESCAPE:
		if _dialog.visible or _rekordbox_page._save.visible: return
		close_panel()
	elif shortcuts_enabled and not is_open() and event.keycode == KEY_P: open_panel()
	else: return
	get_viewport().set_input_as_handled()

func _unhandled_input(_event: InputEvent) -> void:
	if is_open(): get_viewport().set_input_as_handled()
