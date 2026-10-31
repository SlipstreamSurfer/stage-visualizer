class_name LightDesk
extends CanvasLayer
# The light desk (D): every group of lights with a switch and a slider, over the show, which goes on. One tap switches
# a group off, the slider sets how much it may give; W switches the washes alone. Nothing here takes the keyboard, so
# the show's own keys keep working. The groups are the show's tune.groups, so a recording keeps them.
# Later this is where smarter controls can go: every row is a switch and a slider, and a row can become any control.

# [group (a tune.groups key), name on the desk]
const GROUPS := [["wash", "Washes"], ["hall", "Hall beams"], ["front", "Stage row"], ["back", "Towers behind the DJ"],
	["rear", "Rear truss"], ["side", "Side towers"], ["delay", "Delay towers"], ["roof", "Roof spots"], ["batten", "Bars"]]

var light: Show
var _panel: PanelContainer
var _rows := {}   # group -> {"toggle": CheckButton, "slider": HSlider}

func _ready() -> void:
	layer = 15
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	_panel = PanelContainer.new()
	_panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER_RIGHT)
	_panel.offset_left = -560
	_panel.offset_right = -24
	_panel.mouse_filter = Control.MOUSE_FILTER_STOP
	root.add_child(_panel)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 8)
	_panel.add_child(column)
	column.add_child(UiStyle.label("Light desk", "Title"))
	column.add_child(UiStyle.label("D closes. W: washes on / off.", "Hint"))
	for entry in GROUPS:
		var key: String = entry[0]
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 12)
		column.add_child(row)
		var toggle := CheckButton.new()
		toggle.text = entry[1]
		toggle.button_pressed = true
		toggle.custom_minimum_size.x = 290
		toggle.focus_mode = Control.FOCUS_NONE
		row.add_child(toggle)
		var slider := HSlider.new()
		slider.min_value = 0.0
		slider.max_value = 1.0
		slider.step = 0.05
		slider.value = 1.0
		slider.custom_minimum_size = Vector2(190, 34)
		slider.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		slider.focus_mode = Control.FOCUS_NONE
		row.add_child(slider)
		_rows[key] = {"toggle": toggle, "slider": slider}
		toggle.toggled.connect(func(_on: bool): _apply(key))
		slider.value_changed.connect(func(_v: float):
			if not _rows[key].toggle.button_pressed: _rows[key].toggle.set_pressed_no_signal(true)   # moving a slider puts the group on
			_apply(key))
	var all := UiStyle.button("All on")
	all.focus_mode = Control.FOCUS_NONE
	all.pressed.connect(func(): all_on())
	column.add_child(all)
	_panel.hide()

func is_open() -> bool:
	return _panel != null and _panel.visible

func open() -> void:
	sync()
	_panel.show()

func close() -> void:
	_panel.hide()

func toggle() -> void:
	if is_open(): close()
	else: open()

# The desk shows what the show has now (also what local/live.json set).
func sync() -> void:
	for key in _rows:
		var level := 1.0 if light == null else float(light.tune.groups.get(key, 1.0))
		_rows[key].toggle.set_pressed_no_signal(level > 0.0)
		if level > 0.0: _rows[key].slider.set_value_no_signal(level)

# A group on or off with one key or tap; on again gives what its slider says. Returns whether it is on now.
func toggle_group(key: String) -> bool:
	var toggle: CheckButton = _rows[key].toggle
	toggle.button_pressed = not toggle.button_pressed   # emits toggled, so _apply runs
	return toggle.button_pressed

func all_on() -> void:
	for key in _rows:
		_rows[key].toggle.set_pressed_no_signal(true)
		_rows[key].slider.set_value_no_signal(1.0)
		_apply(key)

func _apply(key: String) -> void:
	if light == null: return
	var on: bool = _rows[key].toggle.button_pressed
	var level: float = _rows[key].slider.value
	if not on: light.tune.groups[key] = 0.0
	elif level >= 0.999: light.tune.groups.erase(key)   # the show's own level
	else: light.tune.groups[key] = level
