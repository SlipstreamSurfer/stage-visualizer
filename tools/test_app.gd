extends SceneTree
# Settings migration, temporary source preview, wizard navigation and camera changes.

class TestListen extends Listen:
	var level := 0.0
	func start_input(device := "") -> void:
		source = "system audio"
		device_name = device
	func status() -> Dictionary:
		return {"source": source, "device": device_name, "level": level, "bpm": bpm, "confidence": confidence}

class TestRekordbox extends Rekordbox:
	var connected := false
	func start(p: int) -> void:
		port = p
		listening = true
	func status() -> Dictionary:
		return {"connected": connected, "sender_ip": "127.0.0.1", "packets": 10 if connected else 0,
			"deck": "1", "seconds_since": 0.1 if connected else -1.0, "listening": listening, "error": error}

var failures := 0
var checks := 0

func check(ok: bool, message: String) -> void:
	checks += 1
	if not ok:
		failures += 1
		printerr(message)

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	for option in ["film", "shot", "bench", "replay", "seconds", "track", "record", "check", "eye", "settings", "moment-at"]:
		check(AppMenu.should_skip({option: "test"}), "Test option must skip menu: " + option)
	check(not AppMenu.should_skip({}), "Normal launch uses menu")
	check(AppMenu.should_skip({}, true), "Headless launch skips menu")
	check(UiStyle.layout_size(Vector2i(1920, 1080)) == Vector2i(1920, 1080), "1080p UI scale")
	check(UiStyle.layout_size(Vector2i(3840, 2160)) == Vector2i(1920, 1080), "4K UI scale")
	check(UiStyle.layout_size(Vector2i(921, 1036)).x <= 961, "Narrow window keeps large text")
	check(UiStyle.theme().get_color("font_focus_color", "PrimaryButton") == UiStyle.PANEL, "Focused primary button keeps dark text")
	SvDisplay.apply({"fps_limit": 30}, root)
	check(Engine.max_fps == 30, "Apply frame limit")
	SvDisplay.apply({"fps_limit": 0}, root)
	check(Engine.max_fps == 0, "Remove frame limit")
	var directory := Session.local_path().path_join("app-tests-%d" % Time.get_ticks_usec())
	DirAccess.make_dir_recursive_absolute(directory)
	var path := directory.path_join("settings.cfg")
	var old := ConfigFile.new()
	old.set_value("settings", "genre", "house")
	old.set_value("settings", "latency", 0.12)
	old.set_value("settings", "source", "rekordbox")
	old.set_value("other", "kept", "yes")
	check(old.save(path) == OK, "Write legacy config")
	var settings := SettingsPanel.new()
	settings.config_path = path
	settings.shortcuts_enabled = false
	var values := settings.load_settings()
	check(values.genre == "house" and values.latency == 0.12, "Keep legacy settings")
	check(not values.setup_done and not values.safe and values.camera == 1 and values.fps_limit == 60, "Defaults for new fields")
	settings.set_values({"source": "file", "track": "/tmp/cli.ogg", "genre": "hard-techno"})
	check(settings.remember("camera", 5) == OK, "Remember new shortcut")
	var saved := ConfigFile.new()
	saved.load(path)
	check(saved.get_value("settings", "camera") == 5, "Camera saved")
	check(saved.get_value("settings", "source") == "rekordbox" and saved.get_value("settings", "genre") == "house", "Do not save unrelated CLI overrides")
	check(saved.get_value("settings", "track") == "" and saved.get_value("other", "kept") == "yes", "Keep other settings sections")
	var valid := SettingsPanel._validated({"screen": 3, "camera": 4, "fps_limit": 120, "safe": true, "setup_done": true, "fullscreen": true})
	check(valid.screen == 3 and valid.camera == 4 and valid.fps_limit == 120 and valid.safe and valid.setup_done and valid.fullscreen, "Validate display and wizard choices")
	var bad := SettingsPanel._validated({"screen": INF, "camera": 2.5, "fps_limit": 45, "safe": "yes", "setup_done": 1, "fullscreen": [], "latency": NAN})
	check(bad.screen == -1 and bad.camera == 1 and bad.fps_limit == 60 and not bad.safe and not bad.setup_done and not bad.fullscreen, "Reject malformed new fields")
	check(bad.latency == SettingsPanel.DEFAULTS.latency, "Reject nonfinite delay")
	check(settings.remember("unknown", true) == ERR_INVALID_PARAMETER, "Unknown field does not write")
	settings.load_settings()
	root.add_child(settings)
	settings.open_panel()
	check(settings.is_open(), "Open themed settings")
	settings._safe.button_pressed = true
	settings._camera.select(2)
	settings._fps.select(2)
	settings._apply()
	check(not settings.is_open() and settings.values.camera == 3 and settings.values.fps_limit == 120, "Save display choices from UI")
	saved.load(path)
	check(saved.get_value("other", "kept") == "yes", "Full save keeps other sections")
	var menu := AppMenu.new()
	root.add_child(menu)
	var actions := []
	menu.start_show.connect(func(): actions.append("Start show"))
	menu.source_requested.connect(func(): actions.append("Source"))
	menu.settings_requested.connect(func(): actions.append("Settings"))
	menu.quit_requested.connect(func(): actions.append("Quit"))
	menu.open_panel()
	for button in menu.find_children("*", "Button", true, false): button.pressed.emit()
	check(actions == ["Start show", "Source", "Settings", "Quit"], "Menu routes all four actions")
	menu.close_panel()
	var listen := TestListen.new()
	var rb := TestRekordbox.new()
	root.add_child(listen)
	root.add_child(rb)
	var before_preview := settings.values.duplicate()
	settings.set_values({"source": "both", "device": "SV unavailable test input"})
	check(settings.apply_audio(listen, rb) == ERR_UNAVAILABLE and rb.listening, "Missing audio input does not block rekordbox")
	settings.set_values(before_preview)
	var wizard := SetupWizard.new()
	root.add_child(wizard)
	var completed := []
	wizard.completed.connect(func(options: Dictionary): completed.append(options))
	wizard.open_panel(settings, listen, rb)
	check(wizard.is_open() and wizard.page_index() == 0, "Wizard opens source choice")
	wizard.choose_source("both")
	check(wizard.page_index() == 1 and not wizard.source_ready(), "Preview waits for both sources")
	wizard._wait = 11.0
	wizard._update_status()
	check(wizard._help_next.visible and not wizard._help_label.text.is_empty(), "Source help after ten seconds")
	check(SetupWizard.help_steps("rekordbox", false, false, 5566)[-1].contains("5566"), "Help uses selected UDP port")
	listen.level = 0.1
	listen.bpm = 120.0
	listen.confidence = 0.9
	rb.connected = true
	wizard._update_status()
	check(wizard.source_ready() and wizard._meter.value > 0 and wizard._rb_label.text.contains("found"), "Meter and live receiver feedback")
	wizard.next()
	check(wizard.page_index() == 2, "Delay step")
	for i in 6:
		listen.beat = i + 1.0 - 0.16
		wizard._last_tap = -10.0
		check(wizard.tap(), "Accept a kick tap")
	check(absf(listen.latency - 0.08) < 0.006, "Six taps align the existing Listen latency")
	check(not wizard.tap(), "Ignore repeat taps inside debounce interval")
	wizard.next()
	wizard._safe.button_pressed = true
	wizard.next()
	check(completed.size() == 1 and not wizard.is_open(), "Finish wizard once")
	saved.load(path)
	check(saved.get_value("settings", "setup_done") and saved.get_value("settings", "safe"), "First-run and gentle strobes persisted")
	check(saved.get_value("settings", "source") == "both", "Selected source persisted")
	var before := settings.values.duplicate(true)
	var saved_bytes := FileAccess.get_file_as_bytes(path)
	wizard.open_panel(settings, listen, rb)
	rb.fields = {"1/bpm/current": 126.0}
	wizard.choose_source("rekordbox")
	check(wizard._tempo_label.text.contains("126"), "Rekordbox-only setup shows recognised tempo")
	var escape := InputEventKey.new()
	escape.keycode = KEY_ESCAPE
	escape.pressed = true
	wizard._input(escape)
	check(wizard.page_index() == 0 and wizard.is_open(), "Back moves one page")
	wizard.back()
	check(not wizard.is_open() and settings.values == before, "Cancel restores preview values")
	check(FileAccess.get_file_as_bytes(path) == saved_bytes, "Cancel leaves saved settings intact")
	var audio := Listen.new()
	audio.start_samples(44100.0)
	var samples := PackedFloat32Array()
	samples.resize(4096)
	samples.fill(0.1)
	audio.push_samples(samples)
	check(audio.status().level > 0.09, "Listen reports real signal level")
	audio.update(0.3)
	check(audio.status().level == 0, "Old meter signal expires")
	audio.stop()
	check(audio.status().source == "none" and audio.status().level == 0, "Stopped source is clear")
	audio.free()
	var rig := Rig.new()
	var hall := Hall.new()
	var show := Show.new(rig, hall)
	var view := View.new()
	root.add_child(view)
	root.move_child(view, 0) # Same input order as main's camera beneath the UI layers.
	var camera_key := InputEventKey.new()
	camera_key.keycode = KEY_4
	camera_key.pressed = true
	root.push_input(camera_key)
	check(view.camera_index() == 4, "Camera hotkey reaches the show")
	menu.open_panel()
	camera_key.keycode = KEY_5
	root.push_input(camera_key)
	check(view.camera_index() == 4, "Open menu blocks show camera hotkeys")
	menu.close_panel()
	root.push_input(camera_key)
	check(view.camera_index() == 5, "Closing menu restores camera hotkeys")
	var positions := []
	for i in range(1, 6):
		view.select_camera(i, true)
		view.update(0.1, show)
		check(view.position.is_finite() and view.transform.basis.is_finite(), "Finite camera %d" % i)
		positions.append(view.position)
	check(positions[0] != positions[1] and positions[2] != positions[3] and positions[3] != positions[4], "Five distinct viewpoints")
	view.select_camera(1, true)
	view.update(0.1, show)
	var first := view.position
	view.select_camera(5)
	view.update(0.01, show)
	check(view.position.distance_to(first) > 0 and view.position.distance_to(positions[4]) > 1, "Camera transition is smooth")
	view.shoulder = true
	check(view.camera_index() == 2, "Legacy V toggle selects shoulder")
	view.shoulder = false
	check(view.camera_index() == 1, "Legacy replay selects eyes")
	view.free()
	rig.free()
	hall.free()
	wizard.free()
	menu.free()
	settings.free()
	listen.free()
	rb.free()
	print("app: %d checks, %d failures" % [checks, failures])
	quit(0 if failures == 0 else 1)
