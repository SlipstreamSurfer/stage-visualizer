class_name HelpScreen
extends CanvasLayer
# Every key on one screen, in groups (? or F1). Escape, ? or F1 closes it.

const GROUPS := [
	["Show", [["B", "Blackout (on / off)"], ["Space", "Strobe, while held"], ["N", "Blinders, while held"],
		["L", "Next look"], ["G", "Next genre (Shift: back)"], ["S", "Gentle strobes"]]],
	["Picture", [["1–5", "Camera: eyes, shoulder, crowd, FOH, side"], ["V", "Over the shoulder / the DJ's eyes"], ["C", "Look straight ahead"], ["Drag", "Look around"],
		["Q", "Quality"], ["F", "Full screen"], ["I", "Info screen"], ["H", "Hide everything"], ["M", "Save this moment"]]],
	["Timing", [["T", "The one is here (tap on the first beat)"], ["[  ]", "Lights earlier / later"]]],
	["Menus", [["Esc", "Pause menu"], ["P", "Settings"], ["? or F1", "This help"]]],
]

var _root: Control

func _ready() -> void:
	layer = 18
	_root = UiStyle.screen(self, 0.55)
	_root.mouse_filter = Control.MOUSE_FILTER_STOP
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_root.add_child(center)
	var panel := PanelContainer.new()
	center.add_child(panel)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 18)
	panel.add_child(column)
	column.add_child(UiStyle.label("Keys", "Title"))
	var groups := HBoxContainer.new()
	groups.add_theme_constant_override("separation", 56)
	column.add_child(groups)
	for g in GROUPS:
		var box := VBoxContainer.new()
		box.add_theme_constant_override("separation", 8)
		groups.add_child(box)
		box.add_child(UiStyle.label(g[0], "Subtitle"))
		var grid := GridContainer.new()
		grid.columns = 2
		grid.add_theme_constant_override("h_separation", 18)
		grid.add_theme_constant_override("v_separation", 6)
		box.add_child(grid)
		for k in g[1]:
			var key := UiStyle.label(k[0])
			key.add_theme_color_override("font_color", UiStyle.ACCENT)
			grid.add_child(key)
			grid.add_child(UiStyle.label(k[1]))
	column.add_child(UiStyle.label("Esc closes this screen", "Hint"))
	_root.hide()

func is_open() -> bool:
	return _root != null and _root.visible

func toggle() -> void:
	_root.visible = not _root.visible

func close() -> void:
	_root.hide()
