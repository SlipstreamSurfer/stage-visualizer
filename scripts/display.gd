class_name SvDisplay
extends RefCounted
# Main applies this once at startup and after settings change, outside test runs.

const FPS_LIMITS := [30, 60, 120, 0]

static func screens() -> Array:
	var result := []
	if DisplayServer.get_name() == "headless": return result
	for i in DisplayServer.get_screen_count():
		var size := DisplayServer.screen_get_size(i)
		result.append({"id": i, "label": "Screen %d · %d × %d" % [i + 1, size.x, size.y]})
	return result

static func apply(options: Dictionary, window: Window) -> void:
	var limit := int(options.get("fps_limit", 60))
	Engine.max_fps = limit if limit in FPS_LIMITS else 60
	if DisplayServer.get_name() == "headless": return
	var screen := int(options.get("screen", -1))
	var fullscreen: bool = options.get("fullscreen", false)
	if screen < 0 or screen >= DisplayServer.get_screen_count(): screen = window.current_screen
	if screen != window.current_screen:
		window.mode = Window.MODE_WINDOWED
		window.current_screen = screen
		var bounds := DisplayServer.screen_get_usable_rect(screen)
		window.size = Vector2i(mini(1440, bounds.size.x), mini(810, bounds.size.y))
		window.position = bounds.position + (bounds.size - window.size) / 2
	window.mode = Window.MODE_FULLSCREEN if fullscreen else Window.MODE_WINDOWED
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_DISABLED if Engine.max_fps == 0 else DisplayServer.VSYNC_ENABLED, window.get_window_id())
