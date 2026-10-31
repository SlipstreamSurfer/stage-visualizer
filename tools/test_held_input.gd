extends SceneTree
# Exercise actual viewport input with the real settings panel and MIDI dispatch.

class TestMain extends "res://scripts/main.gd":
	func _ready() -> void:
		pass
	func _process(_delta: float) -> void:
		pass

class TestMidi extends MidiControls:
	func _ready() -> void:
		pass

var failures := []
var checks := 0

func check(ok: bool, message: String) -> void:
	checks += 1
	if not ok: failures.append(message)

func key(code: Key, down: bool) -> void:
	var event := InputEventKey.new()
	event.keycode = code
	event.pressed = down
	await process_frame
	root.push_input(event)

func pad(pitch: int, down: bool) -> void:
	var event := InputEventMIDI.new()
	event.message = MIDI_MESSAGE_NOTE_ON
	event.channel = 0
	event.pitch = pitch
	event.velocity = 100 if down else 0
	await process_frame
	root.push_input(event)

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var app := TestMain.new()
	root.add_child(app)
	var rig := Rig.new()
	var hall := Hall.new()
	app.show = Show.new(rig, hall, {"genre": "techno-peak-time-driving"})
	app.bar = ShowBar.new()
	app.add_child(app.bar)
	app.hud = Hud.new()
	app.add_child(app.hud)
	app.settings = SettingsPanel.new()
	app.add_child(app.settings)
	app.midi = TestMidi.new()
	app.midi.path = "user://held-input-test-midi.cfg"
	app.add_child(app.midi)
	app.midi.links = {"MIDI 0": {"blinder": "note:0:36", "strobe": "note:0:37"}}
	app.midi.pressed.connect(app._midi_pressed)
	if app.has_method("_midi_released"):
		app.midi.released.connect(Callable(app, "_midi_released"))
	else:
		app.midi.released.connect(func(action: String): if action in ["strobe", "blinder"]: app._manual(action, false))
	await process_frame
	await key(KEY_P, true)
	await key(KEY_P, false)
	check(app.settings.is_open(), "P opens settings")
	await key(KEY_N, true)
	await key(KEY_SPACE, true)
	check(not app.show.manual.blinder and not app.show.manual.strobe, "settings consumes effect presses")
	var back: Button
	for button in app.settings.find_children("*", "Button", true, false):
		if button.text == "Back": back = button
	check(back != null, "settings has a Back button")
	if back: back.pressed.emit()
	check(not app.settings.is_open(), "settings Back closes the panel")
	for entry in [[KEY_N, "blinder"], [KEY_SPACE, "strobe"]]:
		await key(entry[0], true)
		check(app.show.manual[entry[1]], entry[1] + " should start on key press")
		app.settings.open_panel()
		await key(entry[0], false)
		check(not app.show.manual[entry[1]], entry[1] + " should stop when settings consumes the release")
		app.settings.close_panel()
	# Releasing a keyboard hold over the panel must not stop a MIDI hold.
	for entry in [[KEY_N, 36, "blinder"], [KEY_SPACE, 37, "strobe"]]:
		await key(entry[0], true)
		await pad(entry[1], true)
		app.settings.open_panel()
		await key(entry[0], false)
		check(app.show.manual[entry[2]], entry[2] + " MIDI hold survives a panel-consumed key release")
		await pad(entry[1], false)
		check(not app.show.manual[entry[2]], entry[2] + " stops after MIDI release with settings open")
		app.settings.close_panel()
	# MIDI and keyboard independently hold the same effect.
	for entry in [[KEY_N, 36, "blinder"], [KEY_SPACE, 37, "strobe"]]:
		await key(entry[0], true)
		await pad(entry[1], true)
		await key(entry[0], false)
		check(app.show.manual[entry[2]], entry[2] + " MIDI hold survives keyboard release")
		await pad(entry[1], false)
		check(not app.show.manual[entry[2]], entry[2] + " stops after both releases")
		await pad(entry[1], true)
		await key(entry[0], true)
		await pad(entry[1], false)
		check(app.show.manual[entry[2]], entry[2] + " keyboard hold survives MIDI release")
		await key(entry[0], false)
		check(not app.show.manual[entry[2]], entry[2] + " stops after both releases reversed")
	# Losing keyboard focus must not leave a keyboard effect stuck or toggle blackout.
	await key(KEY_B, true)
	await key(KEY_B, false)
	check(app.show.manual.blackout, "blackout toggles on")
	await key(KEY_N, true)
	await key(KEY_SPACE, true)
	app.notification(Node.NOTIFICATION_WM_WINDOW_FOCUS_OUT)
	check(not app.show.manual.blinder and not app.show.manual.strobe, "focus loss releases temporary keyboard effects")
	check(app.show.manual.blackout, "focus loss preserves blackout toggle")
	await key(KEY_B, true)
	await key(KEY_B, false)
	check(not app.show.manual.blackout, "blackout toggles off")
	await pad(36, true)
	await pad(37, true)
	check(app.show.manual.blinder and app.show.manual.strobe, "MIDI holds both effects")
	app.notification(Node.NOTIFICATION_WM_WINDOW_FOCUS_OUT)
	check(not app.show.manual.blinder and not app.show.manual.strobe, "focus loss releases MIDI effects")
	await pad(36, true)
	await pad(37, true)
	check(app.show.manual.blinder and app.show.manual.strobe, "MIDI holds work again after focus loss")
	await pad(36, false)
	await pad(37, false)
	check(not app.show.manual.blinder and not app.show.manual.strobe, "MIDI releases work after focus loss")
	rig.free()
	hall.free()
	app.queue_free()
	await process_frame
	if failures.is_empty(): print("held input: %d checks passed" % checks)
	else: printerr("held input: ", failures)
	quit(0 if failures.is_empty() else 1)
