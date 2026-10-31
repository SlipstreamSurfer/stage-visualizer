extends SceneTree
# Haze scales the existing volumes and beam visibility, never lamp output or quality settings.
var failed: Array[String] = []

func _initialize() -> void:
	call_deferred("_run")

func check(ok: bool, message: String) -> void:
	if not ok: failed.append(message)

func _run() -> void:
	for name in ["sv_beat", "sv_energy", "sv_hands", "sv_haze", "sv_phones"]:
		RenderingServer.global_shader_parameter_add(name, RenderingServer.GLOBAL_VAR_TYPE_FLOAT, 0.0)
	for pair in [[0.0,0.0],[1.0,1.0],[2.0,2.0],[-4.0,0.0],[9.0,2.0],[NAN,1.0],[INF,1.0],["bad",1.0],[true,1.0],[{},1.0]]:
		check(is_equal_approx(Haze.level(pair[0]), pair[1]), "Invalid haze normalisation for " + str(pair[0]))
	var hall := Hall.new()
	root.add_child(hall)
	hall.build()
	hall.set_process(false)
	var density := {}
	for node in hall.get_children():
		if node is FogVolume: density[node.name] = node.material.density
	check(density.size() == 5, "Keep the existing five fog volumes")
	var environment := Environment.new()
	for k in [0.0, 2.0, 2.0, 0.5, 1.0]:
		environment.volumetric_fog_enabled = false
		Haze.apply(k, environment, hall)
		check(not environment.volumetric_fog_enabled, "Haze must not enable fog on Low/Light")
		check(is_equal_approx(environment.volumetric_fog_density, Haze.DENSITY * k), "Global density does not follow the fader")
		for label in density:
			var volume := hall.get_node(NodePath(label)) as FogVolume
			check(is_equal_approx(volume.material.density, density[label] * k), "Local density incorrect: " + str(label))
	var rig := Rig.new()
	root.add_child(rig)
	rig.build()
	var show := Show.new(rig,hall,{"genre":"techno-raw-deep-hypnotic","seed":7})
	check(float(show.tune.get("haze", 1.0)) == 1.0, "Default haze must preserve the current show")
	var desk := LightDesk.new()
	root.add_child(desk)
	desk.light = show
	desk.open()
	await process_frame
	var slider := desk.find_child("HazeSlider",true,false) as HSlider
	var hint := desk.find_child("HazeHint",true,false) as Label
	check(slider != null and hint != null, "Desk needs a haze fader and quality notice")
	if slider != null and hint != null:
		check(slider.min_value == 0.0 and slider.max_value == 2.0, "Haze range must be 0–200%")
		check(slider.focus_mode == Control.FOCUS_NONE, "Haze must not steal show keys")
		slider.value = 1.5
		check(is_equal_approx(float(show.tune.haze),1.5), "Haze fader does not change the show tune")
		check(show.tune.groups.is_empty(), "Haze must not edit light groups")
		desk.call("set_fog_enabled", false)
		check(hint.text.contains("Beams only"), "Explain when volumetric fog is disabled")
		desk.call("set_fog_enabled", true)
		check(not hint.text.contains("Beams only"), "Notice must follow quality changes")
		show.tune.haze = 0.5
		desk.sync()
		check(is_equal_approx(slider.value,0.5), "Desk must reflect external haze changes")
		desk.all_on()
		check(is_equal_approx(float(show.tune.haze),0.5), "All on must not reset atmosphere")
	# Exercise the actual main-loop room path without attaching main or starting audio/input.
	var app := preload("res://scripts/main.gd").new()
	app.hall = hall
	app.rig = rig
	app.show = show
	app.env = environment
	rig.room_level = 8.0
	rig.room_color = Color(0.1,0.4,0.8)
	show.tune.haze = 0.0
	app._room(0.1)
	check(is_zero_approx(environment.volumetric_fog_density), "Main does not apply zero haze")
	check(environment.volumetric_fog_emission == Color(0,0,0), "Zero haze must not leave fog emission")
	show.tune.haze = 2.0
	app._room(0.1)
	check(is_equal_approx(environment.volumetric_fog_density,0.018), "Main does not apply extra haze")
	var ambient := environment.ambient_light_energy
	show.tune.haze = 1.0
	app._room(0.1)
	check(is_equal_approx(environment.ambient_light_energy,ambient), "Haze must not brighten the room's ambient light")
	app.free()
	desk.free()
	rig.free()
	hall.free()
	print("haze: ", "passed" if failed.is_empty() else failed)
	quit(0 if failed.is_empty() else 1)
