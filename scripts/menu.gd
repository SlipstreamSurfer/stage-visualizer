class_name AppMenu
extends CanvasLayer
# Main owns navigation. Opening this screen does not pause the show or audio.

signal start_show
signal source_requested
signal settings_requested
signal quit_requested

var _root: Control
var _start: Button
var _source_label: Label

static func should_skip(options: Dictionary, headless := false) -> bool:
	if headless: return true
	for key in ["film", "shot", "bench", "replay", "seconds", "track", "record", "check", "eye", "settings", "moment-at"]:
		if options.has(key): return true
	return false

func _ready() -> void:
	layer = 10
	_root = UiStyle.screen(self, 0.58)
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_root.add_child(center)
	var card := PanelContainer.new()
	card.custom_minimum_size.x = 520
	center.add_child(card)
	var column := VBoxContainer.new()
	card.add_child(column)
	column.add_child(UiStyle.label("SV", "Title"))
	column.add_child(UiStyle.label("Step behind the decks."))
	_source_label = UiStyle.label("Choose a source. Then start the show.", "Hint")
	column.add_child(_source_label)
	_start = UiStyle.button("Start show", true)
	_start.pressed.connect(func(): start_show.emit())
	column.add_child(_start)
	for item in [["Source", source_requested], ["Settings", settings_requested], ["Quit", quit_requested]]:
		var button := UiStyle.button(item[0])
		var action: Signal = item[1]
		button.pressed.connect(func(): action.emit())
		column.add_child(button)
	_root.hide()

func open_panel() -> void:
	_root.show()
	_start.grab_focus()

func close_panel() -> void:
	_root.hide()

func is_open() -> bool:
	return _root != null and _root.visible

func set_source(text: String) -> void:
	_source_label.text = text

func _unhandled_input(_event: InputEvent) -> void:
	if not is_open(): return
	get_viewport().set_input_as_handled() # Keep show hotkeys behind the start screen.
