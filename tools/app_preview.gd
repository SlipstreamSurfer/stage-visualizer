extends SceneTree
# Integration preview without changing shared main.gd. --ui=menu|source|check|delay|safety|settings
# --preview-shot=PATH captures a screen; check/delay use simulated indicators for layout QA.

var main: Node
var menu: AppMenu
var wizard: SetupWizard
var options := {}
var simulated := false

func _initialize() -> void:
	for arg in OS.get_cmdline_user_args():
		var pair := arg.trim_prefix("--").split("=", true, 1)
		options[pair[0]] = pair[1] if pair.size() > 1 else "1"
	call_deferred("_start")

func _start() -> void:
	UiStyle.configure_window(root)
	main = load("res://main.tscn").instantiate()
	root.add_child(main)
	main.hud.hide()
	main.settings.shortcuts_enabled = false
	menu = AppMenu.new()
	root.add_child(menu)
	wizard = SetupWizard.new()
	root.add_child(wizard)
	menu.start_show.connect(func():
		menu.close_panel()
		if not main.settings.values.setup_done: wizard.open_panel(main.settings, main.listen, main.rb))
	menu.source_requested.connect(_source)
	menu.settings_requested.connect(func():
		menu.close_panel()
		main.settings.open_panel())
	menu.quit_requested.connect(func(): main._quit())
	wizard.completed.connect(func(values: Dictionary):
		_apply(values)
		menu.open_panel())
	wizard.cancelled.connect(func(): menu.open_panel())
	main.settings.closed.connect(func(): menu.open_panel())
	main.settings.applied.connect(_apply)
	main.view.camera_changed.connect(func(index: int):
		if not AppMenu.should_skip(options) and not options.has("camera-all") and not options.has("preview-all"):
			main.settings.remember("camera", index)
		main.crowd.dj_node.visible = main.view.shows_dj())
	if options.has("preview-all") or options.has("ui"): _apply(main.settings.values)
	if options.has("preview-fullscreen"):
		var display: Dictionary = main.settings.values.duplicate()
		display.fullscreen = true
		SvDisplay.apply(display, root)
	if options.has("camera-all"):
		await _capture_cameras(options["camera-all"])
		return
	if options.has("preview-all"):
		await _capture_all(options["preview-all"])
		return
	if AppMenu.should_skip(options, DisplayServer.get_name() == "headless") and not options.has("ui"):
		print("app preview: menu bypassed")
		return
	match options.get("ui", "menu"):
		"source": _source()
		"check", "delay", "safety":
			_source()
			wizard._options.source = "both"
			wizard._page = {"check": 1, "delay": 2, "safety": 3}[options.ui]
			wizard._wait = 11.0
			simulated = true
			wizard._render()
			print("app preview: simulated source indicators for layout QA")
		"settings": main.settings.open_panel()
		_: menu.open_panel()
	if options.has("preview-shot"):
		await create_timer(2.0).timeout
		await RenderingServer.frame_post_draw
		var image := root.get_texture().get_image()
		var result := image.save_png(options["preview-shot"])
		print("app preview: saved ", options["preview-shot"], " (", result, ")")
		main._quit(0 if result == OK else 1)

func _source() -> void:
	menu.close_panel()
	wizard.open_panel(main.settings, main.listen, main.rb)

func _capture_cameras(directory: String) -> void:
	DirAccess.make_dir_recursive_absolute(directory)
	for index in range(1, 6):
		main.view.select_camera(index, true)
		main.crowd.dj_node.visible = main.view.shows_dj()
		await create_timer(0.5).timeout
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(directory.path_join("camera-%d.png" % index))
		print("app preview: captured camera ", index)
	main._quit()

func _capture_all(directory: String) -> void:
	DirAccess.make_dir_recursive_absolute(directory)
	var screens := ["menu", "source", "check", "delay", "safety", "settings", "show", "display", "rekordbox"]
	if options.has("with-cameras"):
		for i in range(1, 6): screens.append("camera-%d" % i)
	for screen in screens:
		menu.close_panel()
		wizard._root.hide()
		main.settings._root.hide()
		if screen.begins_with("camera-"):
			simulated = false
			main.view.select_camera(int(screen.get_slice("-", 1)), true)
			main.crowd.dj_node.visible = main.view.shows_dj()
		elif screen == "menu": menu.open_panel()
		elif screen in ["settings", "show", "display", "rekordbox"]:
			main.settings.open_panel()
			var tabs: TabContainer = main.settings.find_children("*", "TabContainer", true, false)[0]
			tabs.current_tab = ["settings", "show", "display", "rekordbox"].find(screen)
		else:
			_source()
			wizard._options.source = "both"
			wizard._page = ["source", "check", "delay", "safety"].find(screen)
			wizard._wait = 11.0
			simulated = screen in ["check", "delay"]
			wizard._render()
		await create_timer(0.5).timeout
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(directory.path_join(screen + ".png"))
		print("app preview: captured ", screen)
	main._quit()

func _apply(values: Dictionary) -> void:
	main.show.safe = values.safe
	SvDisplay.apply(values, root)
	main.view.select_camera(values.camera)
	main.crowd.dj_node.visible = main.view.shows_dj()

func _process(_dt: float) -> bool:
	if simulated and main:
		main.listen._input_level = 0.15
		main.listen._sample_age = 0.0
		main.listen.bpm = 124.0
		main.listen.confidence = 0.9
		main.rb.replaying = true
		main.rb.replay_live = true
		main.rb.sender_ip = "127.0.0.1"
	return false
