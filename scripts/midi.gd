class_name MidiControls
extends Node
# A DJ controller as a light desk: pads and buttons work the show's own buttons (blackout, strobe, blinder, next
# look). Nothing is linked until the DJ teaches it: choose an action, press a pad. A note or a controller change
# (CC) is linked by its channel and number, kept per device name in user://midi.cfg.
#   held actions: on while the pad is down (note on, or CC 64 and up), off when it is let go
#   press actions: once per press

signal pressed(action: String)
signal released(action: String)
signal learned(action: String, label: String)

const ACTIONS := ["blackout", "strobe", "blinder", "next_look"]
const NAMES := {"blackout": "Blackout", "strobe": "Strobe", "blinder": "Blinders", "next_look": "Next look"}
var path := "user://midi.cfg"   # the tests use their own

var links := {}            # device name -> {action -> "note:CH:N" or "cc:CH:N"}
var learning := ""         # the action waiting for a pad, "" when none
var _down := {}            # action -> held now
var _open := false

func _ready() -> void:
	_load()
	OS.open_midi_inputs()
	_open = true

func _exit_tree() -> void:
	if _open: OS.close_midi_inputs()

# Forget physical holds after the window loses focus.
func clear_held() -> void:
	_down.erase("strobe")
	_down.erase("blinder")

# A controller plugged in after the start: look for inputs again.
func reopen() -> void:
	if _open: OS.close_midi_inputs()
	OS.open_midi_inputs()
	_open = true

func devices() -> PackedStringArray:
	return OS.get_connected_midi_inputs()

func _device_name(index: int) -> String:
	var list := devices()
	return list[index] if index >= 0 and index < list.size() else "MIDI %d" % index

# Wait for the next pad, knob or button, and link it to an action.
func learn(action: String) -> void:
	learning = action

func forget(action: String) -> void:
	for device in links: links[device].erase(action)
	_save()

# What an action is linked to, for the menu: "Note 36 · DDJ-400", or "not linked".
func label(action: String) -> String:
	for device in links:
		if links[device].has(action):
			var parts: PackedStringArray = str(links[device][action]).split(":")
			return "%s %s · %s" % ["Note" if parts[0] == "note" else "Knob", parts[2], device]
	return "not linked"

func _input(event: InputEvent) -> void:
	if event is InputEventMIDI: handle(event)

# One MIDI message. Public so the tests can send messages without a device.
func handle(e: InputEventMIDI) -> void:
	var kind := ""
	var on := false
	match e.message:
		MIDI_MESSAGE_NOTE_ON:
			kind = "note"
			on = e.velocity > 0
		MIDI_MESSAGE_NOTE_OFF:
			kind = "note"
		MIDI_MESSAGE_CONTROL_CHANGE:
			kind = "cc"
			on = e.controller_value >= 64
		_: return
	var number := e.pitch if kind == "note" else e.controller_number
	var key := "%s:%d:%d" % [kind, e.channel, number]
	var device := _device_name(e.device)
	if learning != "":
		if not on: return   # learn on the press, not on the release of the pad before
		forget(learning)
		if not links.has(device): links[device] = {}
		links[device][learning] = key
		var action := learning
		learning = ""
		_save()
		learned.emit(action, label(action))
		return
	var mine: Dictionary = links.get(device, {})
	for action in mine:
		if mine[action] != key: continue
		if on and not _down.get(action, false):
			_down[action] = true
			pressed.emit(action)
		elif not on and _down.get(action, false):
			_down[action] = false
			released.emit(action)

func _load() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(path) != OK: return
	for device in cfg.get_sections():
		links[device] = {}
		for action in cfg.get_section_keys(device):
			if action in ACTIONS: links[device][action] = str(cfg.get_value(device, action))

func _save() -> void:
	var cfg := ConfigFile.new()
	for device in links:
		for action in links[device]: cfg.set_value(device, action, links[device][action])
	cfg.save(path)
