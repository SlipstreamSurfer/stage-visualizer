extends Node3D
# SV in Godot: one hall, one stage, one DJ booth. For someone who plays at home and wants to stand behind the decks
# of a hangar show: the light follows what they play, through system audio, rekordbox (rkbx_link over OSC), or both.
# Start options after "--":
#   (the settings screen, P, keeps the source, delay and quality; these options go first for one run)
#   --device=NAME      the input that carries system audio (default: found by itself)
#   --track=PATH       play a music file instead (ogg, mp3, wav), for testing
#   --osc-port=4460    where rekordbox's OSC comes in
#   --quality=NAME     light, normal, high, ultra or auto (default auto)
#   --genre=ID         a genre from Show.GENRE_ORDER (default auto: by the tempo)
#   --latency=SECONDS  how far the listening runs behind the sound (default 0.08)
#   --shoulder         start over the DJ's shoulder instead of through the DJ's eyes
#   --section=NAME     hold a part of the track (intro, groove, build, break, peak), for pictures and measuring
#   --shot=PATH        save a picture after --wait seconds (default 8) and quit
#   --bench            measure each setting from the booth, 1080p, no frame limit
#   --log              print every change of part, blackout and drop
#   --record [--output=PATH] [--no-audio]   record inputs + optional WAV; R stops recording
#   --replay=PATH [--fast]                 play every recorded frame; fast requires --headless
#   --seconds=N --trace --seed=N           stop after N seconds, trace frames, repeat show choices
#   --check [--check-report=PATH]          validate a replay; exit 3 on failed show assertions
#   --app              the start screen and first-run setup even with test options (for pictures)
#   --hud [--pause | --keys | --settings]   with --shot: a picture with the show bar, the pause menu or the help
#   --eye=X,Y,Z --at=X,Y,Z [--fov=N | --ortho=SIZE] [--bright]   look at the build from anywhere

var hall: Hall
var rig: Rig
var crowd: Crowd
var show: Show
var listen: Listen
var rb: Rekordbox
var view: View
var env: Environment
var hud: Hud
var bar: ShowBar
var pause: PauseMenu
var help: HelpScreen
var midi: MidiControls
var menu: AppMenu
var wizard: SetupWizard
var _return_to := ""    # where a screen goes back to when it closes: "menu", "pause", "start" (then the show) or ""
var _app := false       # the app's own screens (start screen, first-run setup); off for tests and recordings
var settings: SettingsPanel
var level := 0
var calibration: Quality.Calibration
var args := {}
var _shot_at := -1.0
var _clock := 0.0
var _film_next := 0.0
var _tune_at := 0.0
var _prof := [0, 0, 0, 0]
var _moment_done := false
var steady := Quality.Steady.new()
var _film_n := 0
var _mouse_idle := 0.0
var _bench_frames: Array[float] = []
var _bench_gpu: Array[float] = []
var _collecting := false
var session := Session.new()
var _pending := 0.0
var _closing := false
var _context := {}
var _replay_audio: AudioStreamPlayer
var _frames := 0
var checks: ShowChecks

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		var kv := a.trim_prefix("--").split("=", true, 1)
		args[kv[0]] = kv[1] if kv.size() > 1 else "1"
	if (args.has("record") and args.has("replay")) or (args.has("fast") and not args.has("replay")):
		printerr("Choose --record or --replay=PATH; --fast requires replay.")
		_quit(1)
		return
	if args.has("fast") and DisplayServer.get_name() != "headless":
		printerr("--fast requires --headless.")
		_quit(1)
		return
	if args.has("check") and not args.has("replay"):
		printerr("--check requires --replay=PATH.")
		_quit(1)
		return
	if args.has("replay"):
		var context = Session.read_metadata(args.replay).get("context", {})
		if context is Dictionary: _context = context
		for key in ["seed", "scene", "genre", "section", "safe"]:
			if _context.has(key): args[key] = _context[key]
	if args.has("record") or args.has("replay"):
		args.seed = args.get("seed", 1)
	settings = SettingsPanel.new()
	settings.load_settings()
	if (args.has("record") or args.has("replay")) and not args.has("genre"):
		args.genre = settings.values.genre
	if args.has("seed"): seed(int(args.seed))
	for n in ["sv_beat", "sv_energy", "sv_hands", "sv_haze", "sv_phones"]:
		RenderingServer.global_shader_parameter_add(n, RenderingServer.GLOBAL_VAR_TYPE_FLOAT, 1.0 if n == "sv_haze" else 0.0)
	hall = Hall.new()
	add_child(hall)
	hall.build()
	rig = Rig.new()
	add_child(rig)
	rig.build()
	crowd = Crowd.new()
	add_child(crowd)
	crowd.build(3000)
	_environment()
	view = View.new()
	add_child(view)
	view.current = true
	view.shoulder = args.has("shoulder")
	_app = args.has("app") or not AppMenu.should_skip(args, DisplayServer.get_name() == "headless")
	if _app and not args.has("shoulder"): view.select_camera(int(settings.values.get("camera", 1)), true)
	view.camera_changed.connect(_on_camera)
	if args.has("eye"):
		var v := func(t: String) -> Vector3:
			var n := t.split_floats(",")
			return Vector3(n[0], n[1], n[2])
		view.fixed = {"eye": v.call(args.eye), "at": v.call(args.get("at", "0,0,0"))}
		if args.has("ortho"): view.fixed.ortho = float(args.ortho)
		if args.has("fov"): view.fixed.fov = float(args.fov)
	crowd.dj_node.visible = view.shows_dj()
	listen = Listen.new()
	add_child(listen)
	rb = Rekordbox.new()
	add_child(rb)
	show = Show.new(rig, hall, args)
	show.forced = args.get("section", "")
	_hud()
	# the settings (P): saved choices, with the command line going first
	add_child(settings)
	settings.shortcuts_enabled = false   # main opens it (P), and knows where to go back to
	menu = AppMenu.new()
	add_child(menu)
	wizard = SetupWizard.new()
	add_child(wizard)
	pause.set_has_menu(_app)
	menu.start_show.connect(func():
		menu.close_panel()
		if not settings.values.get("setup_done", false): _open_wizard("start"))
	menu.source_requested.connect(func():
		menu.close_panel()
		_open_wizard("menu"))
	menu.settings_requested.connect(func():
		menu.close_panel()
		_open_settings("menu"))
	menu.quit_requested.connect(func(): _quit())
	wizard.completed.connect(func(options: Dictionary):
		_apply_settings(options)
		_back())
	wizard.cancelled.connect(_back)
	settings.closed.connect(_back)
	var overrides := {}
	if args.has("track"):
		overrides.source = "file"
		overrides.track = args.track
	if args.has("device"):
		overrides.device = args.device
		if not args.has("track"): overrides.source = "both"
	if args.has("osc-port"): overrides.osc_port = int(args["osc-port"])
	if args.has("quality"): overrides.quality = args.quality
	if args.has("latency"): overrides.latency = float(args.latency)
	if args.has("genre"): overrides.genre = args.genre
	settings.set_values(overrides)
	settings.applied.connect(_apply_settings)
	_apply_settings(settings.values)
	if args.has("film"): _fixed_1080p()
	if args.has("shot"):
		_shot_at = float(args.get("wait", "8"))
		_fixed_1080p()
	if args.has("bench"): _bench()
	if args.has("bright"): env.ambient_light_energy = 0.9
	if args.has("settings"): settings.open_panel()   # for a picture of the settings screen
	if args.has("pause"): pause.open()   # pictures of the pause menu and the help
	if args.has("keys"): help.toggle()
	if args.has("safe"): show.safe = true
	if _context.has("tune"): show.tune = _context.tune.duplicate(true)
	if not (args.has("shot") or args.has("bench") or args.has("film")): UiStyle.configure_window(get_window())
	if not _app and not (args.has("shot") or args.has("bench") or args.has("windowed")): get_window().mode = Window.MODE_FULLSCREEN
	if args.has("windowed"): get_window().mode = Window.MODE_WINDOWED
	# the app: the first time the setup (it warns about flashing light), then the start screen
	if _app:
		if not settings.values.get("setup_done", false): _open_wizard("start")
		else: menu.open_panel()
	elif not args.has("safe"): _say("Flashing lights. S makes the strobes gentle.", 10.0)
	if args.has("replay"):
		if session.start_replay(args.replay, listen, rb) != OK:
			_session_error()
			return
		print("session: ", session.path)
		if args.has("check"): checks = ShowChecks.new()
		if args.has("fast"): Engine.max_fps = 0
		elif not args.has("no-audio"): _start_replay_audio()
	elif args.has("record"):
		_start_recording()
	get_tree().auto_accept_quit = false

# A dark hall full of haze: the light comes from the rig alone.
func _environment() -> void:
	env = Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color.BLACK
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.55, 0.6, 0.7)
	env.ambient_light_energy = 0.02
	env.reflected_light_source = Environment.REFLECTION_SOURCE_DISABLED
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.tonemap_exposure = 1.0
	env.glow_enabled = true
	env.glow_intensity = 0.55
	env.glow_bloom = 0.04
	env.glow_hdr_threshold = 0.9
	env.glow_blend_mode = Environment.GLOW_BLEND_MODE_ADDITIVE
	env.volumetric_fog_density = 0.009
	env.volumetric_fog_albedo = Color(0.92, 0.93, 0.96)
	env.volumetric_fog_anisotropy = 0.55
	env.volumetric_fog_length = 70.0
	env.volumetric_fog_detail_spread = 1.6
	env.volumetric_fog_ambient_inject = 0.0
	env.volumetric_fog_temporal_reprojection_enabled = true
	env.ssr_max_steps = 48
	env.ssr_depth_tolerance = 0.4
	env.ssao_radius = 1.5
	env.ssao_intensity = 1.6
	env.sdfgi_use_occlusion = true
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

# The show's light on the room (SV in the browser: hall light and fog colour from director.room): the hall's
# surfaces take a little of the show's colour, the haze glows with it, a kick lifts both and a strobe flashes the room.
var _room_level := 0.0
func _room(dt: float) -> void:
	if args.has("bright"): return
	_room_level = maxf(rig.room_level, lerpf(_room_level, rig.room_level, 1.0 - exp(-dt * 8.0)))
	var c := rig.room_color
	env.ambient_light_color = c
	# strobes and blinders light the room through their own lamps (Rig); here only the show's glow, capped
	var level := minf(_room_level, 30.0)
	env.ambient_light_energy = 0.02 + level * 0.0014
	var glow := (0.004 + level * 0.0008) * float(show.mood.get("haze", 1.0))
	env.volumetric_fog_emission = Color(c.r * glow, c.g * glow, c.b * glow)

func _hud() -> void:
	hud = Hud.new()
	add_child(hud)
	RenderingServer.viewport_set_measure_render_time(get_viewport().get_viewport_rid(), true)
	if (args.has("shot") or args.has("bench") or args.has("film")) and not args.has("hud"): hud.visible = false
	bar = ShowBar.new()
	add_child(bar)
	bar.visible = hud.visible
	help = HelpScreen.new()
	add_child(help)
	pause = PauseMenu.new()
	add_child(pause)
	pause.chosen.connect(_on_pause)
	if DisplayServer.get_name() != "headless":
		midi = MidiControls.new()
		add_child(midi)
		pause.midi = midi
		midi.pressed.connect(_midi_pressed)
		midi.released.connect(func(action: String): if action in ["strobe", "blinder"]: _manual(action, false))

# The source and the graphics, from the settings screen (and once at the start).
func _apply_settings(options: Dictionary) -> void:
	show.genre = options.get("genre", show.genre)
	show.safe = args.has("safe") or bool(options.get("safe", show.safe))
	if _app and not (args.has("windowed") or args.has("shot")): SvDisplay.apply(options, get_window())
	if not args.has("replay") and settings.apply_audio(listen, rb) != OK:
		settings.show_error(rb.error if rb.error != "" else "Could not open the audio source.")
	if not args.has("replay") and args.has("track") and args.has("osc-port") and not rb.listening:
		rb.start(int(args["osc-port"]))
		if not rb.listening: settings.show_error(rb.error)
	if args.has("bench"): return
	if options.quality == "auto" and not args.has("replay"):
		calibration = Quality.Calibration.new()
		_set_level(0)
	else:
		calibration = null
		_set_level(Quality.ORDER.find(options.quality))

func _set_level(i: int) -> void:
	level = clampi(i, 0, Quality.ORDER.size() - 1)
	Quality.apply(Quality.ORDER[level], env, get_viewport(), rig, crowd)
	steady.reset(Quality.PRESETS[Quality.ORDER[level]].scale)

func _say(text: String, seconds := 3.0) -> void:
	hud.say(text, seconds)

func _process(dt: float) -> void:
	if _closing: return
	# the pointer goes away when the mouse rests, in full screen
	_mouse_idle += dt
	var resting := get_window().mode == Window.MODE_FULLSCREEN and _mouse_idle > 2.0 and not settings.is_open() and not pause.is_open() and not help.is_open() and not menu.is_open() and not wizard.is_open()
	Input.mouse_mode = Input.MOUSE_MODE_HIDDEN if resting else Input.MOUSE_MODE_VISIBLE
	if session.replaying:
		_pending += dt
		while not session.finished and session.error == "" and (args.has("fast") or _pending >= session.next_delay()):
			_pending -= session.next_delay()
			if session.replay_frame(listen, rb):
				_restore_controls(session.controls)
				_frame(session.frame_dt, false)
			if _closing: return
		if session.error != "": _session_error()
		elif session.finished: _quit()
		return
	_frame(dt, true)

func _frame(dt: float, live: bool) -> void:
	_clock += dt
	var t0 := Time.get_ticks_usec()
	if live: listen.update(dt)
	var t1 := Time.get_ticks_usec()
	if live: rb.update(dt)
	if session.recording and session.record_frame(dt, listen, rb, _controls()) != OK:
		_session_error()
		return
	if checks: checks.before(listen, rb)
	var was := show.section
	var dark := show.blackout
	show.update(dt, listen, rb)
	if checks: checks.observe(dt, show, rb)
	if args.has("log") and (show.section != was or show.blackout != dark or show.dropped):
		print("%.2fs beat %.2f · %s%s%s · %s countin %.1f" % [_clock, show.beat, show.section, " · DROP" if show.dropped else "", " · blackout" if show.blackout > 0.0 else "", show.phrase, show.countin])
	var t2 := Time.get_ticks_usec()
	rig.update(dt, show.beat)
	_room(dt)
	var t3 := Time.get_ticks_usec()
	view.update(dt, show)
	_frames += 1
	if args.has("trace"):
		print(JSON.stringify({"n": _frames - 1, "t": _clock, "dt": dt, "beat": show.beat,
			"section": show.section, "phrase": show.phrase, "drop": show.dropped, "title": show.title,
			"look": show.scene_text()}, "", true, true))
	if args.has("profile"):   # where a frame's time goes on the processor, printed every five seconds
		_prof[0] += t1 - t0
		_prof[1] += t2 - t1
		_prof[2] += t3 - t2
		_prof[3] += 1
		if _prof[3] >= 300:
			print("cpu per frame: listen %.2f ms · show %.2f ms · rig %.2f ms" % [_prof[0] / _prof[3] / 1000.0, _prof[1] / _prof[3] / 1000.0, _prof[2] / _prof[3] / 1000.0])
			_prof = [0, 0, 0, 0]
	if not args.has("replay") and not (args.has("bench") or args.has("shot") or args.has("film") or args.has("nosteady")) and (calibration == null or calibration.done):
		var sc := steady.sample(dt, _pace())
		if sc > 0.0:
			var vp := get_viewport()
			vp.scaling_3d_mode = Viewport.SCALING_3D_MODE_FSR if sc < 0.999 else Viewport.SCALING_3D_MODE_BILINEAR
			vp.scaling_3d_scale = sc
			if args.has("profile"): print("steady: scale %d%% (typical frame %.1f ms, may take %.1f ms)" % [roundi(sc * 100.0), steady.typical * 1000.0, 1000.0 / _pace()])
	if calibration and not calibration.done:
		var l := calibration.step(dt, _pace())
		if l != level: _set_level(l)
	if _collecting:
		_bench_frames.append(dt)
		_bench_gpu.append(RenderingServer.viewport_get_measured_render_time_gpu(get_viewport().get_viewport_rid()))
	if hud.visible:
		hud.refresh(show, listen, rb, Quality.ORDER[level], calibration != null, view, show.safe)
		bar.refresh(dt, show, listen, rb)
	# live: the faders in local/live.json, and a restart when local/restart appears (start.sh starts SV again)
	if not session.replaying and _clock >= _tune_at:
		_tune_at = _clock + 1.0
		show.read_tune(ProjectSettings.globalize_path("res://local/live.json"))
		rig.beam_strength = Quality.PRESETS[Quality.ORDER[level]].beam * float(show.tune.beam)
		var again := ProjectSettings.globalize_path("res://local/restart")
		if FileAccess.file_exists(again):
			DirAccess.remove_absolute(again)
			_quit(42)
	if args.has("moment-at") and _clock >= float(args["moment-at"]) and not _moment_done:   # a test of M
		_moment_done = true
		_moment()
	# --film=DIR: a picture every --every seconds (default 0.12) from --wait on, --count of them, then quit
	if args.has("film") and _clock >= float(args.get("wait", "8")):
		if _film_next <= _clock:
			_film_next = _clock + float(args.get("every", "0.12"))
			await RenderingServer.frame_post_draw
			get_viewport().get_texture().get_image().save_png("%s/%03d.png" % [args.film, _film_n])
			_film_n += 1
			if _film_n >= int(args.get("count", "16")): _quit()
	if _shot_at > 0.0 and _clock >= _shot_at:
		_shot_at = -1.0
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png(args.shot)
		print("saved ", args.shot)
		print("state: %s [%s] · %s · %s · %.1f BPM · beat %.1f · energy %.2f · scene %s" % [show.source, listen.device_name + " / now " + AudioServer.input_device, show.section, show.phrase, show.bpm, show.beat, show.energy, show.scene])
		_quit()
	if args.has("seconds") and _clock >= float(args.seconds): _quit()

func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventMouseMotion:
		_mouse_idle = 0.0
		bar.wake()
	if e is InputEventMouseMotion and e.button_mask & MOUSE_BUTTON_MASK_LEFT and not pause.is_open() and not help.is_open():
		view.drag(e.relative)
		return
	if not (e is InputEventKey and not e.echo): return
	# held: strobe and blinders as long as the key is down
	if e.keycode == KEY_SPACE: _manual("strobe", e.pressed)
	elif e.keycode == KEY_N: _manual("blinder", e.pressed)
	if not e.pressed: return
	bar.wake()
	if e.keycode == KEY_F1 or e.unicode == 63:   # ? or F1
		help.toggle()
		return
	match e.keycode:
		KEY_B: _manual("blackout", not show.manual.blackout)
		KEY_L: _manual("next_look", true)
		KEY_I:
			hud.info = not hud.info
			hud.visible = true
			bar.visible = true
		KEY_V: view.select_camera(1 if view.camera_index() == 2 else 2)
		KEY_P: _open_settings("")
		KEY_C:
			view.yaw = 0.0
			view.pitch = 0.0
		KEY_Q:
			calibration = null
			_set_level((level + 1) % Quality.ORDER.size())
			_say(Quality.ORDER[level].capitalize() if e.keycode == KEY_Q else show.genre_now())
			_remember("quality", Quality.ORDER[level])
		KEY_G:   # the next genre (Shift: the one before), remembered
			var order := Show.GENRE_ORDER
			var i := order.find(show.genre)
			show.genre = order[posmod(i + (-1 if e.shift_pressed else 1), order.size())]
			_say(Quality.ORDER[level].capitalize() if e.keycode == KEY_Q else show.genre_now())
			_remember("genre", show.genre)
		KEY_H:
			hud.visible = not hud.visible
			bar.visible = hud.visible
		KEY_F:
			var w := get_window()
			w.mode = Window.MODE_WINDOWED if w.mode == Window.MODE_FULLSCREEN else Window.MODE_FULLSCREEN
			if _app: _remember("fullscreen", w.mode == Window.MODE_FULLSCREEN)
		KEY_BRACKETLEFT, KEY_BRACKETRIGHT:   # the lights earlier or later, 10 ms a press, remembered
			listen.latency = clampf(listen.latency + (0.01 if e.keycode == KEY_BRACKETRIGHT else -0.01), 0.0, 0.5)
			_say("Audio delay %d ms" % roundi(listen.latency * 1000.0))
			_remember("latency", listen.latency)
		KEY_T:   # tap on the one: this beat starts a bar (and a phrase)
			listen.bar_offset = roundf(listen.beat)
			_say("The one is here")
		KEY_M: _moment()
		KEY_R:
			if not session.replaying:
				if session.recording:
					session.stop()
					_say("Recording saved")
				else:
					_say("Start with --record to capture the complete show from its first frame.")
		KEY_S:
			show.safe = not show.safe
			_say("Gentle strobes on" if show.safe else "Gentle strobes off")
			if _app: _remember("safe", show.safe)
		KEY_ESCAPE:   # one step back: the help, the pause menu, or open the pause menu
			if help.is_open(): help.close()
			elif pause.is_open(): pause.back()
			else: pause.open()

# The DJ's own buttons, from the keyboard or a controller.
func _manual(action: String, on: bool) -> void:
	match action:
		"blackout":
			show.manual.blackout = on
			_say("Blackout" if on else "Blackout off", 1.5)
		"strobe": show.manual.strobe = on
		"blinder": show.manual.blinder = on
		"next_look":
			if on:
				show.manual.looks += 1
				_say("Next look", 1.5)

# A pad: blackout toggles, strobe and blinders hold, next look steps on.
func _midi_pressed(action: String) -> void:
	_manual(action, not show.manual.blackout if action == "blackout" else true)

func _on_pause(what: String) -> void:
	match what:
		"settings": _open_settings("pause")
		"source": _open_wizard("pause")
		"menu": menu.open_panel()
		"help": help.toggle()
		"quit": _quit()

# The screens, and where each goes back to when it closes.
func _open_settings(back_to: String) -> void:
	_return_to = back_to
	settings.open_panel()

func _open_wizard(back_to: String) -> void:
	_return_to = back_to
	wizard.open_panel(settings, listen, rb)

func _back() -> void:
	var to := _return_to
	_return_to = ""
	match to:
		"menu": menu.open_panel()
		"pause": pause.open()

func _on_camera(index: int) -> void:
	crowd.dj_node.visible = view.shows_dj()
	if _app and not session.replaying: _remember("camera", index)

# The frames a second SV may show: the screen's rate, or the frame limit when that is lower (with a limit of 60 on a
# 144 Hz screen, every frame takes 16.7 ms by design and is not slow).
func _pace() -> float:
	var screen := DisplayServer.screen_get_refresh_rate()
	if screen <= 0.0: screen = 60.0
	return minf(screen, float(Engine.max_fps)) if Engine.max_fps > 0 else screen

func _remember(key: String, value: Variant) -> void:
	if settings.remember(key, value) != OK: _say("Could not save settings", 5.0)

func _controls() -> Dictionary:
	return {"genre": show.genre, "safe": show.safe, "forced": show.forced, "manual": show.manual.duplicate(), "camera": view.camera_index(),
		"tune": show.tune.duplicate(true), "shoulder": view.shoulder, "yaw": view.yaw, "pitch": view.pitch}

func _restore_controls(options: Dictionary) -> void:
	if options.is_empty(): return
	show.genre = options.get("genre", show.genre)
	show.safe = options.get("safe", show.safe)
	show.forced = options.get("forced", show.forced)
	if options.get("manual") is Dictionary:
		var m: Dictionary = options.manual
		show.manual = {"blackout": bool(m.get("blackout", false)), "strobe": bool(m.get("strobe", false)), "blinder": bool(m.get("blinder", false)), "looks": int(m.get("looks", 0))}
	show.tune = options.get("tune", show.tune).duplicate(true)
	if options.has("camera"): view.select_camera(int(options.camera), true)
	else: view.shoulder = options.get("shoulder", view.shoulder)
	view.yaw = options.get("yaw", view.yaw)
	view.pitch = options.get("pitch", view.pitch)
	crowd.dj_node.visible = view.shows_dj()

func _start_recording() -> void:
	var context := {"seed": str(args.get("seed", 1)), "genre": show.genre, "section": show.forced,
		"tune": show.tune.duplicate(true)}
	if args.has("safe"): context.safe = true
	if args.has("scene"): context.scene = int(args.scene)
	if session.start_record(listen, args.get("output", ""), not args.has("no-audio"), context) != OK:
		_session_error()
	else: print("session: ", session.path)

func _start_replay_audio() -> void:
	var path := session.path.get_basename() + ".wav"
	if not FileAccess.file_exists(path): return
	var stream := AudioStreamWAV.load_from_file(path)
	if stream == null: return
	_replay_audio = AudioStreamPlayer.new()
	_replay_audio.stream = stream
	add_child(_replay_audio)
	_replay_audio.play()

func _session_error() -> void:
	printerr(session.error)
	_quit(1)

func _quit(code := 0) -> void:
	if _closing: return
	_closing = true
	if checks:
		var report := checks.report()
		var path: String = args.get("check-report", Session.local_path().path_join("checks/" + session.path.get_file() + ".json"))
		DirAccess.make_dir_recursive_absolute(path.get_base_dir())
		var file := FileAccess.open(path, FileAccess.WRITE)
		if file: file.store_string(JSON.stringify(report, "  "))
		else:
			printerr("Cannot write check report: ", path)
			code = 1
		print("checks: ", JSON.stringify(report))
		if not report.passed and code == 0: code = 3
	if session.recording or session.replaying:
		print("session: %d frames, %.3f s" % [session.frame_count, session.time])
	session.stop()
	if listen: listen.stop()
	if rb: rb.stop()
	if _replay_audio: _replay_audio.stop()
	get_tree().quit(code)

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST: _quit()

func _exit_tree() -> void:
	session.stop()

# M: "this moment". A picture and everything the show knows, to local/moments/, for looking at later together.
func _moment() -> void:
	var dir := Session.local_path().path_join("moments")
	DirAccess.make_dir_recursive_absolute(dir)
	var stamp := Time.get_datetime_string_from_system().replace(":", "-")
	var state := {"time": stamp, "source": show.source, "genre": show.genre_now(), "bpm": show.bpm, "beat": show.beat,
		"section": show.section, "phrase": show.phrase, "next_phrase": show.next_phrase, "countin": show.countin,
		"build": show.build, "drop": show.drop, "scene": show.scene_text(), "hall_look": show.hall_look,
		"deck": rb.deck() if rb.live() else "", "track": show.title, "quality": Quality.ORDER[level],
		"scale": get_viewport().scaling_3d_scale, "fps": Engine.get_frames_per_second(), "view": View.NAMES[view.camera_index() - 1]}
	var f := FileAccess.open("%s/%s.json" % [dir, stamp], FileAccess.WRITE)
	if f: f.store_string(JSON.stringify(state, "  "))
	if DisplayServer.get_name() == "headless":
		_say("Moment state saved (headless)")
		return
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_jpg("%s/%s.jpg" % [dir, stamp], 0.85)
	_say("Moment saved")

# Pictures and measurements are 1920 by 1080 whatever size the window is.
func _fixed_1080p() -> void:
	var w := get_window()
	w.content_scale_mode = Window.CONTENT_SCALE_MODE_VIEWPORT
	w.content_scale_size = Vector2i(1920, 1080)
	w.content_scale_aspect = Window.CONTENT_SCALE_ASPECT_IGNORE

# The same measurement as SV's local/probe/bench.mjs: 1080p, no frame limit, the median frame through the DJ's
# eyes and over the DJ's shoulder, each setting in turn, three rounds.
func _bench() -> void:
	calibration = null
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_DISABLED)
	Engine.max_fps = 0
	_fixed_1080p()
	RenderingServer.viewport_set_measure_render_time(get_viewport().get_viewport_rid(), true)
	var got := {}
	await get_tree().create_timer(4.0).timeout
	for r in 3:
		for v in ["eyes", "shoulder"]:
			view.shoulder = v == "shoulder"
			crowd.dj_node.visible = view.shows_dj()
			await get_tree().create_timer(2.0).timeout
			var order: Array = Quality.ORDER.duplicate() if not args.has("presets") else Array(str(args.presets).split(","))
			if r % 2 == 1: order.reverse()
			for p in order:
				_set_level(Quality.ORDER.find(p))
				await get_tree().create_timer(1.5).timeout
				_bench_frames.clear()
				_bench_gpu.clear()
				_collecting = true
				await get_tree().create_timer(3.0).timeout
				_collecting = false
				var f := _bench_frames.duplicate()
				f.sort()
				var g := _bench_gpu.duplicate()
				g.sort()
				var key: String = v + " " + p
				if not got.has(key): got[key] = []
				got[key].append([f[f.size() / 2] * 1000.0, g[g.size() / 2]])
	print("Godot %s · %s · 1920x1080 · %s" % [Engine.get_version_info().string, RenderingServer.get_video_adapter_name(), show.forced if show.forced != "" else "as the music goes"])
	for key in got:
		var ms := 0.0
		var gpu := 0.0
		for v in got[key]:
			ms += v[0]
			gpu += v[1]
		ms /= got[key].size()
		gpu /= got[key].size()
		print("%-16s %5.1f ms · %3d fps · gpu %5.1f ms · %s" % [key, ms, roundi(1000.0 / ms), gpu, " ".join(got[key].map(func(x): return "%.1f" % x[0]))])
	get_tree().quit()
