class_name FeedbackPanel
extends CanvasLayer
# Created only by --debug-feedback. Rating is immediate; the optional editor uses a frozen past window.
var history := ShowFeedback.new()
var seconds := 15
var last_path := ""
var _frozen := {}
var _rating := "good"
var _note := ""
var _status: Label
var _editor: Control
var _window: OptionButton
var _verdict: OptionButton
var _text: TextEdit
var _heading: Label

func _ready() -> void:
	layer = 19
	var root := Control.new()
	root.theme = UiStyle.theme()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	var strip := VBoxContainer.new()
	strip.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	strip.position = Vector2(18, -170)
	root.add_child(strip)
	_heading = UiStyle.label("Debug feedback · last 15 seconds", "Hint")
	strip.add_child(_heading)
	var buttons := HBoxContainer.new()
	strip.add_child(buttons)
	for item in [["Good · F7", "good"], ["Needs work · F8", "needs_work"], ["Details · F6", "details"]]:
		var button := UiStyle.button(item[0])
		button.focus_mode = Control.FOCUS_NONE
		buttons.add_child(button)
		button.pressed.connect(func():
			if item[1] == "details": open_details()
			else: mark(item[1]))
	_status = UiStyle.label("Saved locally. No audio recording.", "Hint")
	strip.add_child(_status)
	_editor = UiStyle.screen(self, 0.65)
	_editor.mouse_filter = Control.MOUSE_FILTER_STOP
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_editor.add_child(center)
	var panel := PanelContainer.new()
	panel.custom_minimum_size.x = 620
	center.add_child(panel)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 14)
	panel.add_child(column)
	column.add_child(UiStyle.label("Feedback details", "Title"))
	column.add_child(UiStyle.label("The moment before your rating stays selected.", "Hint"))
	_verdict = OptionButton.new()
	_verdict.add_item("Good")
	_verdict.add_item("Needs work")
	column.add_child(_verdict)
	_window = OptionButton.new()
	for length in [5, 15, 30, 60]: _window.add_item("Last %d seconds" % length)
	column.add_child(_window)
	_text = TextEdit.new()
	_text.placeholder_text = "Optional: what worked or felt wrong?"
	_text.custom_minimum_size = Vector2(560, 180)
	_text.wrap_mode = TextEdit.LINE_WRAPPING_BOUNDARY
	column.add_child(_text)
	var actions := HBoxContainer.new()
	column.add_child(actions)
	var save := UiStyle.button("Save details", true)
	save.name = "SaveFeedbackDetails"
	actions.add_child(save)
	save.pressed.connect(_save_details)
	var cancel := UiStyle.button("Back · Esc")
	actions.add_child(cancel)
	cancel.pressed.connect(close)
	_editor.hide()

func mark(verdict: String) -> void:
	_frozen = history.freeze()
	_rating = verdict
	_note = ""
	last_path = history.save_rating(_rating, seconds, "", _frozen)
	var available: float = 0.0 if _frozen.samples.is_empty() else minf(seconds, float(_frozen.end) - float(_frozen.samples[0].t))
	_status.text = ("Good saved" if verdict == "good" else "Needs work saved") + " · %.1fs captured · F6 details" % available if last_path != "" else history.error

func open_details() -> void:
	if last_path == "":
		_status.text = "Mark a moment with F7 or F8 first."
		return
	_verdict.select(0 if _rating == "good" else 1)
	_window.select([5, 15, 30, 60].find(seconds))
	_text.text = _note
	_editor.show()
	_text.grab_focus()

func _save_details() -> void:
	var verdict := "good" if _verdict.selected == 0 else "needs_work"
	var length: int = [5, 15, 30, 60][_window.selected]
	var path := history.save_rating(verdict, length, _text.text, _frozen, last_path)
	if path == "":
		_status.text = history.error
		return
	last_path = path
	seconds = length
	_heading.text = "Debug feedback · last %d seconds" % seconds
	_rating = verdict
	_note = _text.text
	_status.text = "Feedback updated · last %d seconds" % seconds
	close()

func is_open() -> bool:
	return _editor != null and _editor.visible

func close() -> void:
	_editor.hide()

func handle_key(event: InputEventKey) -> bool:
	if not event.pressed or event.echo: return false
	match event.keycode:
		KEY_F7, KEY_F8:
			if not is_open(): mark("good" if event.keycode == KEY_F7 else "needs_work")
			return true
		KEY_F6:
			open_details()
			return true
		KEY_ESCAPE:
			if is_open():
				close()
				return true
	return false

func _unhandled_input(_event: InputEvent) -> void:
	if is_open(): get_viewport().set_input_as_handled()
