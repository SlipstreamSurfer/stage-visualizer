class_name PauseMenu
extends CanvasLayer
# Escape during the show: a menu over the hall. The music, the show and the light go on; nothing stops by accident.
# Escape goes one step back: from the controller page to the menu, from the menu to the show.

signal chosen(what: String)   # "settings", "source", "help", "menu", "quit"

var midi: MidiControls
var _root: Control
var _main: VBoxContainer
var _controller: VBoxContainer
var _rows := {}            # action -> its label on the controller page
var _first: Button
var _menu_button: Button

func _ready() -> void:
	layer = 16
	_root = UiStyle.screen(self, 0.45)
	_root.mouse_filter = Control.MOUSE_FILTER_STOP
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_root.add_child(center)
	var panel := PanelContainer.new()
	panel.custom_minimum_size.x = 520
	center.add_child(panel)
	var pages := VBoxContainer.new()
	panel.add_child(pages)
	# the menu
	_main = _page(pages, "Paused", "The show goes on.")
	_first = _button(_main, "Resume", func(): close())
	_button(_main, "Settings", func(): _choose("settings"))
	_button(_main, "Source", func(): _choose("source"))
	_button(_main, "DJ controller", func(): _show_controller())
	_button(_main, "Help", func(): _choose("help"))
	_menu_button = _button(_main, "Quit to menu", func(): _choose("menu"))
	_menu_button.visible = false   # until there is a start screen
	_button(_main, "Quit", func(): _choose("quit"))
	# the controller page
	_controller = _page(pages, "DJ controller", "Choose a button, then press a pad.")
	for action in MidiControls.ACTIONS:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 14)
		_controller.add_child(row)
		var name := UiStyle.label(MidiControls.NAMES[action])
		name.custom_minimum_size.x = 160
		row.add_child(name)
		var link := UiStyle.label("", "Hint")
		link.custom_minimum_size.x = 300
		row.add_child(link)
		_rows[action] = link
		_button(row, "Learn", func(): _learn(action))
		_button(row, "Clear", func(): _clear(action))
	_button(_controller, "Back", func(): _show_main())
	_root.hide()

func _page(parent: Control, title: String, line: String) -> VBoxContainer:
	var page := VBoxContainer.new()
	parent.add_child(page)
	page.add_child(UiStyle.label(title, "Title"))
	page.add_child(UiStyle.label(line, "Hint"))
	return page

func _button(parent: Control, text: String, action: Callable) -> Button:
	var b := UiStyle.button(text, text == "Resume")
	b.pressed.connect(action)
	parent.add_child(b)
	return b

# There is a start screen to go back to (Codex's menu): show "Quit to menu".
func set_has_menu(yes: bool) -> void:
	_menu_button.visible = yes

func is_open() -> bool:
	return _root != null and _root.visible

func open() -> void:
	_show_main()
	_root.show()

func close() -> void:
	if midi: midi.learning = ""
	_root.hide()

# Escape: one step back.
func back() -> void:
	if _controller.visible: _show_main()
	else: close()

func _choose(what: String) -> void:
	close()
	chosen.emit(what)

func _show_main() -> void:
	if midi: midi.learning = ""
	_controller.hide()
	_main.show()
	_first.grab_focus()

func _show_controller() -> void:
	_main.hide()
	_controller.show()
	if midi: midi.reopen()
	_refresh()
	if midi and midi.devices().is_empty():
		for action in _rows: _rows[action].text = "no controller found"

func _refresh() -> void:
	for action in _rows: _rows[action].text = midi.label(action) if midi else "no MIDI"

func _learn(action: String) -> void:
	if midi == null: return
	midi.learn(action)
	_refresh()
	_rows[action].text = "press a pad…"
	if not midi.learned.is_connected(_on_learned): midi.learned.connect(_on_learned)

func _on_learned(_action: String, _label: String) -> void:
	_refresh()

func _clear(action: String) -> void:
	if midi:
		midi.forget(action)
		_refresh()
