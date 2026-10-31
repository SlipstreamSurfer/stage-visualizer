extends SceneTree
# The desk stays usable at wide and narrow sizes; clicks still change the real show.
var failed: Array[String] = []
var desk: LightDesk
var show: Show

func _initialize() -> void:
	call_deferred("_run")

func check(ok: bool, message: String) -> void:
	if not ok: failed.append(message)

func _run() -> void:
	for name in ["sv_beat", "sv_energy", "sv_hands", "sv_haze", "sv_phones"]:
		RenderingServer.global_shader_parameter_add(name, RenderingServer.GLOBAL_VAR_TYPE_FLOAT, 0.0)
	root.size = Vector2i(1920, 1080)
	UiStyle.configure_window(root)
	var rig := Rig.new()
	root.add_child(rig)
	rig.build()
	var hall := Hall.new()
	show = Show.new(rig, hall, {"genre": "techno-raw-deep-hypnotic", "seed": 7})
	desk = LightDesk.new()
	root.add_child(desk)
	desk.light = show
	desk.open()
	await settle()
	var grid := desk.find_child("GroupsGrid", true, false) as GridContainer
	check(grid != null, "Desk needs a responsive card grid")
	if grid != null:
		check(grid.columns == 3, "Wide desk should use three columns")
		check(grid.get_child_count() == 9, "Every light group needs its own card")
		await check_layout(grid)
	var row: Dictionary = desk._rows.wash
	check(row.has("value"), "Every group needs a visible percentage")
	check(row.toggle.custom_minimum_size.y >= 60, "Group switches need a large hit target")
	check(row.toggle.focus_mode == Control.FOCUS_NONE, "Group switches must not steal show keys")
	row.slider.value = 0.35
	await settle()
	check(is_equal_approx(float(show.tune.groups.wash), 0.35), "Fader changes the real show")
	if row.has("value"): check(row.value.text == "35%", "Desk percentage follows the fader")
	await click(row.toggle)
	check(float(show.tune.groups.wash) == 0.0, "A real mouse click switches the group off")
	await click(row.toggle)
	check(is_equal_approx(float(show.tune.groups.wash), 0.35), "Clicking on restores the chosen level")
	row.slider.value = 0.0
	check(not row.toggle.button_pressed, "Zero fader must show OFF, not ON")
	desk.toggle_group("wash")
	check(float(show.tune.groups.wash) > 0.0, "Switching on from zero must restore a useful level")
	show.tune.groups.wash = 0.2
	desk.sync()
	check(is_equal_approx(row.slider.value, 0.2), "Desk reflects external group settings")
	desk.all_on()
	check(show.tune.groups.is_empty(), "All on restores the show's default levels")
	if grid != null:
		for pixels in [Vector2i(1440, 900), Vector2i(921, 1036), Vector2i(900, 650)]:
			root.size = pixels
			await settle()
			if pixels.x < 1000:
				check(grid.columns <= 2, "Narrow desk must reduce its columns")
			print("desk layout: ", pixels, " physical -> ", root.get_visible_rect().size, " logical, ", grid.columns, " columns")
			await check_layout(grid)
	var close := desk.find_child("CloseDesk", true, false) as Button
	check(close != null, "Desk needs a visible close button")
	if close != null:
		await click(close)
		check(not desk.is_open(), "Close button closes the desk")
	desk.free()
	rig.free()
	hall.free()
	print("light desk layout: ", "passed" if failed.is_empty() else failed)
	quit(0 if failed.is_empty() else 1)

func settle() -> void:
	for i in 5: await process_frame

func click(button: BaseButton) -> void:
	var position := button.get_global_rect().get_center()
	for down in [true, false]:
		var event := InputEventMouseButton.new()
		event.position = position
		event.global_position = position
		event.button_index = MOUSE_BUTTON_LEFT
		event.pressed = down
		root.push_input(event, true)
		await process_frame
	await settle()

func check_layout(grid: GridContainer) -> void:
	await settle()
	var bounds := desk._panel.get_global_rect()
	check(Rect2(Vector2.ZERO, root.get_visible_rect().size).encloses(bounds), "Desk must fit inside the viewport")
	for card: Control in grid.get_children():
		check(card.size.x >= 240.0, "Cards must not shrink controls below a useful width")
		var box := card.get_global_rect()
		check(box.position.x >= bounds.position.x and box.end.x <= bounds.end.x, "Cards must not overflow horizontally")
	for row: Dictionary in desk._rows.values():
		check(row.slider.size.y >= 44, "Fader hit target must be at least 44 logical pixels high")
		check(row.slider.focus_mode == Control.FOCUS_NONE, "Faders must not steal show keys")
