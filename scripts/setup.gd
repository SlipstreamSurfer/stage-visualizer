class_name SetupWizard
extends CanvasLayer
# Source preview is temporary. Only Finish saves; Back from the first page restores.
# Main continues to update Listen/Rekordbox while this panel is open.

signal completed(options: Dictionary)
signal cancelled

var _settings: SettingsPanel
var _listen: Listen
var _rb: Rekordbox
var _previous := {}
var _options := {}
var _page := 0
var _wait := 0.0
var _audio_seen := false
var _preview_error := ""
var _help_index := 0
var _taps: Array[float] = []
var _last_tap := -10.0
var _local_ips := "127.0.0.1"
var _root: Control
var _step: Label
var _heading: Label
var _body: VBoxContainer
var _error: Label
var _back: Button
var _next: Button
var _meter: ProgressBar
var _audio_label: Label
var _tempo_label: Label
var _rb_label: Label
var _peer_label: Label
var _help_label: Label
var _help_next: Button
var _device: OptionButton
var _delay: SpinBox
var _tap_label: Label
var _tap_button: Button
var _beat: ProgressBar
var _safe: CheckButton

func _ready() -> void:
	layer = 30
	_root = UiStyle.screen(self)
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_root.add_child(center)
	var card := PanelContainer.new()
	card.custom_minimum_size.x = 820
	center.add_child(card)
	var column := VBoxContainer.new()
	card.add_child(column)
	_step = UiStyle.label("", "Hint")
	column.add_child(_step)
	_heading = UiStyle.label("", "Title")
	column.add_child(_heading)
	_body = VBoxContainer.new()
	_body.custom_minimum_size = Vector2(756, 260)
	column.add_child(_body)
	_error = _text("", "Hint")
	_error.add_theme_color_override("font_color", UiStyle.WARNING)
	column.add_child(_error)
	var buttons := HBoxContainer.new()
	column.add_child(buttons)
	_back = UiStyle.button("Back")
	_back.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_back.pressed.connect(back)
	buttons.add_child(_back)
	_next = UiStyle.button("Continue", true)
	_next.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_next.pressed.connect(next)
	buttons.add_child(_next)
	_root.hide()

func open_panel(settings: SettingsPanel, listen: Listen, rb: Rekordbox) -> void:
	_settings = settings
	_listen = listen
	_rb = rb
	_previous = settings.values.duplicate(true)
	_options = _previous.duplicate(true)
	_page = 0
	_taps.clear()
	_last_tap = -10.0
	_preview_error = ""
	var addresses: Array[String] = []
	for address in IP.get_local_addresses():
		if ":" not in address and not address.begins_with("127.") and not address.begins_with("169.254."):
			addresses.append(address)
	_local_ips = ", ".join(addresses) if not addresses.is_empty() else "127.0.0.1"
	_root.show()
	_render()

func is_open() -> bool:
	return _root != null and _root.visible

func page_index() -> int:
	return _page

func back() -> void:
	if _page > 0:
		_page -= 1
		_render()
		return
	_settings.set_values(_previous)
	_settings.apply_audio(_listen, _rb)
	_root.hide()
	cancelled.emit()

func choose_source(source: String) -> void:
	if source not in ["system", "both", "rekordbox"]: return
	_options.source = source
	_start_preview()
	_page = 1
	_render()

func next() -> void:
	if _page == 0: return
	if _page < 3:
		_page += 1
		_render()
		return
	_options.safe = _safe.button_pressed
	var changes := {"setup_done": true}
	for key in ["source", "device", "osc_port", "latency", "safe"]: changes[key] = _options[key]
	if _settings.remember_many(changes) != OK:
		_error.text = "Could not save. Your previous settings are kept. Try again."
		return
	_root.hide()
	completed.emit(_settings.values.duplicate())

func _start_preview() -> void:
	_wait = 0.0
	_audio_seen = false
	_help_index = 0
	_preview_error = ""
	var audio := {}
	for key in ["source", "device", "osc_port", "latency"]: audio[key] = _options[key]
	_settings.set_values(audio)
	if _settings.apply_audio(_listen, _rb) != OK:
		_preview_error = _rb.error if _rb.error != "" else "Audio input unavailable. Choose another input."

func _render() -> void:
	for child in _body.get_children():
		_body.remove_child(child)
		child.queue_free()
	_device = null
	_meter = null
	_beat = null
	_step.text = "Source · %d of 4" % (_page + 1)
	_heading.text = ["Choose your source", "Check your source", "Match the kick", "Flashing lights"][_page]
	_error.text = ""
	_next.visible = _page != 0
	_next.text = "Save and continue" if _page == 3 else "Skip for now" if _page == 2 else "Continue"
	match _page:
		0: _source_page()
		1: _check_page()
		2: _delay_page()
		3: _safety_page()
	if _page != 0: _next.grab_focus()

func _source_page() -> void:
	_body.add_child(_text("What will you play music with?"))
	for item in [["System audio", "system"], ["Rekordbox", "rekordbox"], ["Both", "both"]]:
		var button := UiStyle.button(item[0], item[1] == _options.source)
		var id: String = item[1]
		button.pressed.connect(func(): choose_source(id))
		_body.add_child(button)
	_body.get_child(maxi(0, ["system", "rekordbox", "both"].find(_options.source)) + 1).grab_focus()

func _check_page() -> void:
	if _options.source in ["system", "both"]:
		_audio_label = UiStyle.label("Waiting for audio…")
		_body.add_child(_audio_label)
		_meter = ProgressBar.new()
		_meter.max_value = 1.0
		_meter.show_percentage = false
		_meter.custom_minimum_size.y = 28
		_body.add_child(_meter)
		_device = OptionButton.new()
		_device.fit_to_longest_item = false
		_device.custom_minimum_size.y = UiStyle.BUTTON_HEIGHT
		_device.add_item("Audio input · Automatic")
		_device.set_item_metadata(0, "")
		for device in AudioServer.get_input_device_list():
			_device.add_item(device)
			_device.set_item_metadata(_device.item_count - 1, device)
			if device == _options.device: _device.select(_device.item_count - 1)
		if _options.device != "" and _options.device not in AudioServer.get_input_device_list():
			_device.add_item(_options.device + " (unavailable)")
			_device.set_item_metadata(_device.item_count - 1, _options.device)
			_device.select(_device.item_count - 1)
		_device.item_selected.connect(func(_index: int):
			_options.device = _device.get_selected_metadata()
			_start_preview())
		_body.add_child(_device)
		_tempo_label = UiStyle.label("Listening for tempo…", "Hint")
		_body.add_child(_tempo_label)
	if _options.source in ["rekordbox", "both"]:
		_rb_label = UiStyle.label("Waiting for rekordbox…")
		_body.add_child(_rb_label)
		_peer_label = _text("", "Hint")
		_body.add_child(_peer_label)
		var row := HBoxContainer.new()
		row.add_child(UiStyle.label("Rekordbox port"))
		var port := SpinBox.new()
		port.min_value = 1
		port.max_value = 65535
		port.step = 1
		port.value = _options.osc_port
		port.custom_minimum_size.y = UiStyle.BUTTON_HEIGHT
		port.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		port.value_changed.connect(func(value: float):
			_options.osc_port = int(value)
			_start_preview())
		row.add_child(port)
		_body.add_child(row)
		if _options.source == "rekordbox":
			_tempo_label = UiStyle.label("Waiting for tempo…", "Hint")
			_body.add_child(_tempo_label)
	_help_label = _text("Play a track to check your source.", "Hint")
	_body.add_child(_help_label)
	var buttons := HBoxContainer.new()
	_help_next = UiStyle.button("Next help step")
	_help_next.pressed.connect(func():
		_help_index += 1
		_update_status())
	buttons.add_child(_help_next)
	var retry := UiStyle.button("Check again")
	retry.pressed.connect(_start_preview)
	buttons.add_child(retry)
	_body.add_child(buttons)
	_update_status()

func source_ready() -> bool:
	return (_options.source == "rekordbox" or _audio_seen) and (_options.source == "system" or _rb.status().connected)

func _process(dt: float) -> void:
	if not is_open(): return
	_wait += dt
	if _page == 1: _update_status()
	if _page == 2 and _beat:
		_beat.value = fposmod(_listen.beat + _options.latency * _listen.bpm / 60.0, 1.0)

func _update_status() -> void:
	var audio := _listen.status()
	var rb := _rb.status()
	if _options.source in ["system", "both"]:
		_audio_seen = _audio_seen or audio.level > 0.0015
		_meter.value = clampf((linear_to_db(maxf(audio.level, 0.000001)) + 60.0) / 60.0, 0.0, 1.0)
		_audio_label.text = "Audio found ✓" if _audio_seen else "Waiting for audio…"
		_tempo_label.text = "%.1f BPM · %s" % [audio.bpm, "Beat found ✓" if audio.confidence >= 0.3 else "Learning the beat…"] if audio.bpm > 0 else "Listening for tempo…"
	if _options.source in ["rekordbox", "both"]:
		_rb_label.text = "rekordbox found ✓ · deck %s" % rb.deck if rb.connected else "Waiting for rekordbox…"
		_peer_label.text = "From " + rb.sender_ip if rb.connected and rb.sender_ip != "" else "This PC: %s · UDP %d" % [_local_ips, _options.osc_port]
		var tempo := float(_rb.value("bpm/current", 0.0))
		if rb.connected and tempo > 0:
			_tempo_label.text = "%.1f BPM · Beat found ✓" % tempo
		elif _options.source == "rekordbox": _tempo_label.text = "Waiting for tempo…"
	_error.text = _preview_error
	_next.text = "Continue" if source_ready() else "Continue anyway"
	var steps := help_steps(_options.source, _audio_seen, rb.connected, _options.osc_port)
	_help_next.visible = _wait >= 10.0 and not steps.is_empty()
	if source_ready(): _help_label.text = "Your source is ready."
	elif _wait < 10.0: _help_label.text = "Play a track to check your source."
	else: _help_label.text = steps[_help_index % steps.size()] if not steps.is_empty() else "Play a track, then check again."

static func help_steps(source: String, audio_found: bool, rb_found: bool, port: int) -> Array[String]:
	var steps: Array[String] = []
	if source in ["system", "both"] and not audio_found:
		steps.append("Audio · Play music. Check that you can hear it.")
		if OS.has_feature("macos"):
			steps.append("Audio · Choose BlackHole 2ch as Audio input.")
			steps.append("Audio · In Audio MIDI Setup, send sound to your speakers and BlackHole with a Multi-Output Device.")
			steps.append("Audio · Allow SV to use the microphone in System Settings.")
		elif OS.has_feature("windows"):
			steps.append("Audio · Choose Stereo Mix or your audio loopback as Audio input.")
			steps.append("Audio · Allow SV to use audio input in Windows settings.")
		else:
			steps.append("Audio · Choose stage-visualizer, a monitor or your audio loopback as Audio input.")
	if source in ["rekordbox", "both"] and not rb_found:
		steps.append("Rekordbox · Open Rekordbox and play an analysed track.")
		steps.append("Rekordbox · Start rkbx_link. Choose your Rekordbox version and enable OSC.")
		steps.append("Rekordbox · Set osc.destination to this PC's IP and port %d. On this same PC, use 127.0.0.1:%d." % [port, port])
		steps.append("Rekordbox · Allow incoming UDP %d for SV in the firewall. Then choose Check again." % port)
	return steps

func _delay_page() -> void:
	if _options.source == "rekordbox":
		_body.add_child(_text("Rekordbox sends the beat directly. No audio delay is needed."))
		_body.add_child(_text("Choose Continue to keep your saved audio delay.", "Hint"))
		_next.text = "Continue"
		return
	_body.add_child(_text("Tap on the kick at least 6 times. Or set the delay below."))
	_beat = ProgressBar.new()
	_beat.max_value = 1.0
	_beat.show_percentage = false
	_beat.custom_minimum_size.y = 28
	_body.add_child(_beat)
	_tap_button = UiStyle.button("Tap on the kick · T")
	_tap_button.pressed.connect(tap)
	_body.add_child(_tap_button)
	_tap_label = _text("Start your music, then tap.", "Hint")
	_body.add_child(_tap_label)
	_delay = SpinBox.new()
	_delay.min_value = 0
	_delay.max_value = 500
	_delay.step = 5
	_delay.suffix = "ms audio delay"
	_delay.value = _options.latency * 1000.0
	_delay.custom_minimum_size.y = UiStyle.BUTTON_HEIGHT
	_delay.value_changed.connect(func(value: float):
		_options.latency = value / 1000.0
		_listen.latency = _options.latency
		_next.text = "Continue")
	_body.add_child(_delay)
	_body.add_child(_text("The light should meet the sound. You can adjust this later with [ and ].", "Hint"))

func tap() -> bool:
	if _page != 2 or _options.source == "rekordbox": return false
	if _listen.bpm <= 0 or _listen.confidence < 0.2:
		_tap_label.text = "Still finding the beat. Play a track with a clear kick."
		return false
	var now := Time.get_ticks_msec() / 1000.0
	if now - _last_tap < 0.15: return false
	_last_tap = now
	var advanced: float = _listen.beat + _options.latency * _listen.bpm / 60.0
	var offset: float = _options.latency + (roundf(advanced) - advanced) * 60.0 / _listen.bpm
	_taps.append(clampf(offset, 0.0, 0.5))
	if _taps.size() > 12: _taps.pop_front()
	_tap_label.text = "%d of 6 taps" % _taps.size() if _taps.size() < 6 else "Delay matched ✓ · Tap again to refine it."
	if _taps.size() >= 6:
		var sorted := _taps.duplicate()
		sorted.sort()
		_delay.value = roundf(sorted[sorted.size() / 2] * 1000.0 / 5.0) * 5.0
	return true

func _safety_page() -> void:
	_body.add_child(_text("SV uses flashes and strobe lights."))
	_body.add_child(_text("If flashing lights affect you, do not use the show."))
	_safe = CheckButton.new()
	_safe.text = "Gentle strobes"
	_safe.button_pressed = _options.safe
	_safe.toggled.connect(func(value: bool): _options.safe = value)
	_body.add_child(_safe)
	_body.add_child(_text("Gentle strobes reduce the flashes. They still flash.", "Hint"))
	_body.add_child(_text("Change this later in Settings or press S during a show.", "Hint"))

func _text(text: String, variant := "") -> Label:
	var label := UiStyle.label(text, variant)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.custom_minimum_size.x = 720
	return label

func _input(event: InputEvent) -> void:
	if not is_open() or not event is InputEventKey or not event.pressed or event.echo: return
	if _device and is_instance_valid(_device) and _device.get_popup().visible: return
	if event.keycode == KEY_ESCAPE:
		back()
		get_viewport().set_input_as_handled()
	elif event.keycode == KEY_T and _page == 2:
		tap()
		get_viewport().set_input_as_handled()

func _unhandled_input(_event: InputEvent) -> void:
	if is_open(): get_viewport().set_input_as_handled()
