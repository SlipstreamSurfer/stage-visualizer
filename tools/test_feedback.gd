extends SceneTree
var failures := []
func check(ok: bool, message: String) -> void:
	if not ok: failures.append(message)
func _initialize() -> void:
	call_deferred("_run")
func _run() -> void:
	var rig := Rig.new()
	var hall := Hall.new()
	var light := Show.new(rig, hall, {"genre": "house"})
	light.tune.groups = {"wash": 0.05, "front": 0.0}
	light.title = "Generated fixture"
	var history := ShowFeedback.new()
	history.folder = "/tmp/sv-feedback-%d" % Time.get_ticks_usec()
	for n in 1300:
		light.beat = n * 0.2
		history.observe(0.1, light, rig, 3)
	check(history.samples.size() <= 601, "Feedback history must be bounded to sixty seconds")
	check(not DirAccess.dir_exists_absolute(history.folder), "History must stay in memory before a rating")
	var frozen := history.freeze()
	var marked_at: float = frozen.end
	for n in 800: history.observe(0.1, light, rig, 3)
	var path := history.save_rating("good", 15, "Spatial movement worked well.", frozen)
	check(path != "", "Good feedback must save locally")
	var doc: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(path))
	check(doc.rating == "good" and doc.note == "Spatial movement worked well.", "Rating and note must survive JSON")
	check(doc.captured_seconds > 14.5 and doc.captured_seconds <= 15.0, "Only the selected past window is saved")
	check(absf(float(doc.history_end) - marked_at) < 0.001 and doc.samples[-1].t <= marked_at + 0.001, "Typing later must not move the rated moment")
	check(not doc.audio_recorded and doc.samples[0].controls.groups.front == 0.0, "Feedback must contain controls and no audio")
	var updated := history.save_rating("needs_work", 30, "Too much repeated gating.", frozen, path)
	check(updated == path, "Editing details must update the same rating")
	doc = JSON.parse_string(FileAccess.get_file_as_string(path))
	check(doc.rating == "needs_work" and doc.captured_seconds > 29.5, "Window and verdict can be corrected")
	check(history.save_rating("unknown", 15, "", frozen) == "", "Invalid ratings must be rejected")
	var panel := FeedbackPanel.new()
	root.add_child(panel)
	panel.history = history
	var key := InputEventKey.new()
	key.pressed = true
	key.keycode = KEY_F7
	check(panel.handle_key(key) and panel.last_path != "", "F7 must save a good rating immediately")
	key.keycode = KEY_F6
	panel.handle_key(key)
	check(panel.is_open(), "F6 must open optional details")
	panel._text.text = "Keep this atmosphere."
	panel._window.select(2)
	panel._save_details()
	check(not panel.is_open() and panel.seconds == 30, "Details save the selected window and close")
	key.keycode = KEY_F8
	panel.handle_key(key)
	doc = JSON.parse_string(FileAccess.get_file_as_string(panel.last_path))
	check(doc.rating == "needs_work" and doc.requested_seconds == 30, "F8 uses the chosen window for the next rating")
	panel.open_details()
	key.keycode = KEY_ESCAPE
	check(panel.handle_key(key) and not panel.is_open(), "Escape closes feedback without opening another menu")
	check(not AppMenu.should_skip({"debug-feedback": true}), "Debug feedback must retain normal app navigation")
	panel.free()
	rig.free()
	hall.free()
	for file in DirAccess.get_files_at(history.folder): DirAccess.remove_absolute(history.folder.path_join(file))
	DirAccess.remove_absolute(history.folder)
	print("feedback: ", "passed" if failures.is_empty() else failures)
	quit(0 if failures.is_empty() else 1)
