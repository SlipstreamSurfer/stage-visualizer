extends SceneTree
# Prove the checker rejects deliberately wrong outputs, not only a good replay.
func _initialize() -> void:
	_visual_cues()
	_spatial_phrases()
	_gesture_paths()
	_effect_balance()
	for name in ["sv_beat", "sv_energy", "sv_hands", "sv_haze", "sv_phones"]:
		RenderingServer.global_shader_parameter_add(name, RenderingServer.GLOBAL_VAR_TYPE_FLOAT, 0.0)
	var rig := Rig.new()
	var hall := Hall.new()
	var listen := Listen.new()
	var rb := Rekordbox.new()
	seed(19)
	var show := Show.new(rig, hall)
	show.source = "fixture"
	show.title = "Test"
	show.bpm = 120.0
	var good := ShowChecks.new()
	listen.ev_drop = true
	show.section = "peak"
	show.dropped = true
	good.before(listen, rb)
	good.observe(0.05, show, rb)
	assert(good.report().passed and good.report().matched_drops == 1)
	var late := ShowChecks.new()
	show.dropped = false
	late.before(listen, rb)
	late.observe(0.05, show, rb)
	assert(not late.report().passed and late.failures[0].rule == "drop_timing")
	listen.ev_drop = false
	var dark := ShowChecks.new()
	rig.fixtures.append(Rig.Fixture.new())
	show.section = "groove"
	for n in 50: dark.observe(0.1, show, rb)
	assert(not dark.report().passed and dark.failures[0].rule == "dark")
	rig.fixtures.clear()
	var jitter := ShowChecks.new()
	for section in ["groove", "break", "groove"]:
		show.section = section
		jitter.observe(0.1, show, rb)
		if jitter.section_changes == 1: jitter.observe(10.0, show, rb)
	assert(not jitter.report().passed and jitter.failures[0].rule == "section_jitter")
	var repeated := ShowChecks.new()
	for look in [["A"], ["B"], ["A"], ["B"]]:
		show.hall_look = look
		repeated.observe(0.1, show, rb)
	assert(not repeated.report().passed and repeated.report().failures[-1].rule == "variation")
	listen.section = "groove"
	listen.phase = "groove"
	listen.bpm = 128.0
	show.genre = "house"
	show.update(0.1, listen, rb)
	assert(show.mood_key == "house")
	show.genre = "techno-raw-deep-hypnotic"
	show.update(0.1, listen, rb)
	assert(show.mood_key == "raw")
	show.genre = "hard-techno"
	show.update(0.1, listen, rb)
	assert(show.mood_key == "hard")
	rig.free()

	hall.free()
	listen.free()
	rb.free()
	print("show checks: good drop accepted; wrong outputs rejected; a dark room is caught; genre changes the mood at once")
	quit()

func _effect_balance() -> void:
	for gentle in [false, true]:
		for track in ["Set A", "Set B", "Set C", "Set D"]:
			var effect := ShowGestures.new()
			var occupied := 0
			var depth := 0
			var sequences := 0
			for n in 12000:
				var grid := n * 0.2
				var section := "break" if posmod(floori(grid), 256) in range(208, 240) else "groove"
				effect.update(0.1, grid, section, 0.0, gentle, false, track, 120.0, true)
				if effect.mix > 0.01:
					occupied += 1
					if effect.name == "depth_chase": depth += 1
					if effect.name == "spatial_sequence": sequences += 1
					if gentle: assert(effect.name != "lightning" and effect.name != "spatial_sequence", "Gentle mode must not start flashing episodes")
			assert(occupied < 3000, "Ordinary choreography must occupy at least 75% of a twenty-minute set")
			assert(depth < 2400 and sequences < 2400, "Neither chase nor sequencer may dominate the show")
			print("balance ", track, " gentle=", gentle, ": ordinary=", snappedf(100.0 * (12000 - occupied) / 12000.0, 0.1), "% depth=", snappedf(100.0 * depth / 12000.0, 0.1), "% sequence=", snappedf(100.0 * sequences / 12000.0, 0.1), "%")

func _visual_cues() -> void:
	var visuals := StageVisuals.new()
	var seen := {}
	var red := [Color.RED]
	for n in 3200:
		visuals.update(0.1, n * 0.2, "groove", 0.7, red, 1.0, false, true)
		seen[visuals.current] = true
	assert(seen.size() == 6, "The screen repeats without visiting all six scenes")
	assert(visuals.color.is_equal_approx(Color.RED) and visuals.accent.is_equal_approx(Color.RED), "Monochrome cues must stay monochrome")
	visuals.update(0.1, 650.0, "groove", 0.7, red, 0.0, false, true)
	assert(visuals.level == 0.0, "A blackout must close the screen on the same frame")
	for n in 100: visuals.update(0.1, 651.0 + n * 0.2, "break", 0.3, red, 1.0, true, true)
	assert(visuals.current == 3 and visuals.pulse == 0.0 and visuals.level < 0.23, "Breaks must settle into a quiet orbit")
	visuals.update(0.1, 680.0, "groove", 0.7, red, 1.0, false, false)
	assert(visuals.level == 0.0, "A disabled screen must remain dark")
	# The same show at a different rendering frame rate keeps its movement.
	var slow := StageVisuals.new()
	var fast := StageVisuals.new()
	for n in 100: slow.update(0.1, n * 0.2, "groove", 0.7, red, 1.0, false, true)
	for n in 200: fast.update(0.05, n * 0.1, "groove", 0.7, red, 1.0, false, true)
	assert(absf(slow.motion - fast.motion) < 0.001, "Visual movement must not depend on frame rate")

func _spatial_phrases() -> void:
	var phrasing := ShowPhrasing.new()
	var cues := {}
	for n in 24000:
		phrasing.update(0.1, n * 0.2, "groove", 0.0, 0.0, false, false)
		cues[phrasing.cue] = true
		for bank in 3:
			for pos in [Vector3(-12, 8, -25), Vector3(12, 8, 25)]:
				var gain := phrasing.gain(bank, pos, 0.0)
				assert(is_finite(gain) and gain >= 0.09 and gain <= 1.0, "Spatial phrasing must retain a lit rig")
	assert(cues.size() == 9, "The room must visit all nine spatial compositions")
	phrasing.update(0.1, 200.0, "peak", 0.0, 1.0, false, false)
	for bank in 3: assert(phrasing.gain(bank, Vector3.ZERO, 1.0) == 1.0, "A drop must reopen every bank")
	for n in 150: phrasing.update(0.1, 200.0, "break", 0.0, 0.0, false, true)
	assert(phrasing.wave < 0.001 and phrasing.stereo < 0.001, "Breaks must settle the travelling effects")

func _gesture_paths() -> void:
	var effect := ShowGestures.new()
	effect.start("depth_chase", 0.0, 19)
	effect.stagger = false
	effect.elapsed = 0.5
	assert(effect.weight(Vector3(0, 10, -18.5)) > 0.9, "The depth chase must reach the front quarter")
	assert(effect.weight(Vector3(0, 10, 30)) == 0.0, "The rear must wait for the travelling chase")
	effect.elapsed = 1.5
	assert(effect.weight(Vector3(0, 10, 18.5)) > 0.9, "The chase must move towards the rear")
	effect.start("lightning", 0.0, 37)
	var node := effect.path[0]
	assert(effect.weight(node) > 0.9, "Lightning must light its local origin")
	var far := Vector3(-node.x, 8, -33.0 if node.z > 0 else 33.0)
	assert(effect.weight(far) == 0.0, "Lightning must not flash the entire hall")
	var replay := ShowGestures.new()
	replay.start("lightning", 0.0, 37)
	assert(effect.path == replay.path, "Lightning must replay the same route")
	var rig := Rig.new()
	var f := Rig.Fixture.new()
	f.kind = Rig.BEAM
	f.group = "hall"
	f.mount = node
	f.color = Color(0.8, 0.03, 0.1)
	f.target = Vector3(3, 1, -8)
	f.level = 0.25
	rig.fixtures.append(f)
	effect.mix = 1.0
	effect.elapsed = 0.0
	effect.apply(rig, 1.0, {}, false)
	assert(f.color == Color(0.8, 0.03, 0.1), "Lightning must inherit the current scene colour")
	assert(f.target == Vector3(3, 1, -8) and f.level > 0.25, "Lightning must accent the running choreography")
	f.level = 0.0
	effect.apply(rig, 1.0, {}, false)
	assert(f.level == 0.0, "Lightning must preserve dark fixtures in the running pattern")
	effect.start("depth_chase", 0.0, 19)
	assert(effect.duration >= 64.0, "Depth chase must develop for at least sixteen bars")
	var snapshots := {}
	for phase in 4:
		effect.elapsed = phase * 16.0 + 3.0
		var levels := []
		for x in [-16, -5, 5, 16]:
			for z in [-27, -17, -7, 3, 13, 23, 33]: levels.append(snappedf(effect.weight(Vector3(x, 10, z)), 0.05))
		snapshots[str(levels)] = true
	assert(snapshots.size() >= 3, "Depth chase must develop distinct variations within the main pattern")
	effect.apply(rig, 1.0, {"hall": 0.0}, false)
	assert(f.level == 0.0, "The chase must respect a disabled hall group")
	effect.apply(rig, 0.0, {}, false)
	assert(f.level == 0.0, "Gesture effects must respect blackout")
	effect.start("lightning", 0.0, 17, true)
	assert(effect.name == "", "Gentle mode must omit lightning")
	effect.start("rain", 0.0, 17)
	assert(effect.name == "", "Light rain must be removed")
	rig.free()
