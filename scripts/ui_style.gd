class_name UiStyle
extends RefCounted
# Shared by the menu, setup, settings and show overlays. Sizes are at 1080p.

const TEXT := Color("eef4f6")
const MUTED := Color("b1c0ca")
const ACCENT := Color("80e6d0")
const WARNING := Color("ffd29a")
const PANEL := Color("111b24")
const SURFACE := Color("20313f")
const BORDER := Color("526878")
const BODY := 24
const SMALL := 20
const TITLE := 44
const GAP := 20
const BUTTON_HEIGHT := 60

static var _shared: Theme

static func theme() -> Theme:
	if _shared: return _shared
	var result := Theme.new()
	result.default_font = preload("res://fonts/AtkinsonHyperlegible-Regular.otf")
	result.default_font_size = BODY
	for kind in ["Button", "OptionButton", "CheckButton", "CheckBox", "LineEdit", "Label", "PopupMenu", "SpinBox"]:
		result.set_font_size("font_size", kind, BODY)
		result.set_color("font_color", kind, TEXT)
		result.set_color("font_disabled_color", kind, MUTED)
	for kind in ["Button", "OptionButton"]:
		result.set_stylebox("normal", kind, box(SURFACE))
		result.set_stylebox("hover", kind, box(Color("2b4354"), ACCENT))
		result.set_stylebox("pressed", kind, box(Color("284c50"), ACCENT))
		result.set_stylebox("disabled", kind, box(Color("1b2730")))
		result.set_stylebox("focus", kind, box(Color.TRANSPARENT, ACCENT, 0, 3))
		result.set_color("font_hover_color", kind, TEXT)
		result.set_color("font_pressed_color", kind, TEXT)
		result.set_constant("h_separation", kind, 16)
	result.set_type_variation("PrimaryButton", "Button")
	result.set_stylebox("normal", "PrimaryButton", box(ACCENT))
	result.set_stylebox("hover", "PrimaryButton", box(Color("b1f4e5")))
	result.set_stylebox("pressed", "PrimaryButton", box(Color("5abda9")))
	for state in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		result.set_color(state, "PrimaryButton", PANEL)
	var primary_focus := box(Color.TRANSPARENT, TEXT, 0, 3)
	primary_focus.set_expand_margin_all(4)
	result.set_stylebox("focus", "PrimaryButton", primary_focus)
	result.set_type_variation("Title", "Label")
	result.set_font_size("font_size", "Title", TITLE)
	result.set_font("font", "Title", preload("res://fonts/AtkinsonHyperlegible-Bold.otf"))
	result.set_type_variation("Subtitle", "Label")
	result.set_font_size("font_size", "Subtitle", 30)
	result.set_type_variation("Hint", "Label")
	result.set_font_size("font_size", "Hint", SMALL)
	result.set_color("font_color", "Hint", MUTED)
	result.set_stylebox("panel", "PanelContainer", box(PANEL, BORDER, 32))
	result.set_stylebox("panel", "PopupMenu", box(PANEL, BORDER))
	result.set_stylebox("hover", "PopupMenu", box(SURFACE))
	result.set_constant("v_separation", "PopupMenu", 14)
	result.set_stylebox("panel", "TabContainer", box(PANEL, Color.TRANSPARENT, 12))
	for kind in ["TabBar", "TabContainer"]:
		result.set_stylebox("tab_selected", kind, box(SURFACE, BORDER, 12))
		result.set_stylebox("tab_unselected", kind, box(PANEL, Color.TRANSPARENT, 12))
		result.set_stylebox("tab_hovered", kind, box(Color("2b4354"), ACCENT, 12))
		result.set_font_size("font_size", kind, BODY)
		result.set_color("font_selected_color", kind, TEXT)
		result.set_color("font_unselected_color", kind, MUTED)
	result.set_constant("separation", "VBoxContainer", GAP)
	result.set_constant("separation", "HBoxContainer", GAP)
	result.set_constant("h_separation", "GridContainer", GAP)
	result.set_constant("v_separation", "GridContainer", 16)
	result.set_stylebox("normal", "LineEdit", box(Color("0c141c"), BORDER))
	result.set_stylebox("focus", "LineEdit", box(Color.TRANSPARENT, ACCENT, 0, 3))
	result.set_color("caret_color", "LineEdit", ACCENT)
	result.set_color("selection_color", "LineEdit", Color("375e70"))
	result.set_stylebox("background", "ProgressBar", box(Color("243645"), Color.TRANSPARENT, 0))
	result.set_stylebox("fill", "ProgressBar", box(ACCENT, Color.TRANSPARENT, 0))
	result.set_font_size("font_size", "TooltipLabel", SMALL)
	result.set_color("font_color", "TooltipLabel", TEXT)
	result.set_stylebox("panel", "TooltipPanel", box(PANEL, BORDER))
	_shared = result
	return result

static func configure_window(window: Window) -> void:
	window.content_scale_mode = Window.CONTENT_SCALE_MODE_CANVAS_ITEMS
	window.content_scale_aspect = Window.CONTENT_SCALE_ASPECT_EXPAND
	if DisplayServer.get_name() != "headless": window.min_size = Vector2i(900, 650)
	_resize_window(window)
	var resize := _resize_window.bind(window)
	if not window.size_changed.is_connected(resize): window.size_changed.connect(resize)

static func layout_size(pixels: Vector2i) -> Vector2i:
	if pixels.x <= 0 or pixels.y <= 0: return Vector2i(1920, 1080)
	var scale := minf(float(pixels.y) / 1080.0, float(pixels.x) / 960.0)
	return Vector2i(roundi(pixels.x / scale), roundi(pixels.y / scale))

static func _resize_window(window: Window) -> void:
	window.content_scale_size = layout_size(window.size)

static func box(color: Color, border := Color.TRANSPARENT, padding := 16, width := 1) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = color
	style.border_color = border
	style.set_border_width_all(width if border.a > 0 else 0)
	style.set_corner_radius_all(10)
	style.content_margin_left = padding
	style.content_margin_right = padding
	style.content_margin_top = padding
	style.content_margin_bottom = padding
	return style

static func label(text: String, variant := "") -> Label:
	var control := Label.new()
	control.text = text
	control.theme_type_variation = variant
	return control

static func button(text: String, primary := false) -> Button:
	var control := Button.new()
	control.text = text
	control.custom_minimum_size.y = BUTTON_HEIGHT
	if primary: control.theme_type_variation = "PrimaryButton"
	return control

static func screen(parent: CanvasLayer, opacity := 0.78) -> Control:
	var control := Control.new()
	control.theme = theme()
	control.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	parent.add_child(control)
	var shade := ColorRect.new()
	shade.color = Color(0.015, 0.025, 0.04, opacity)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	control.add_child(shade)
	return control
