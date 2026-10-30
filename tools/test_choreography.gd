extends SceneTree
# Measure actual lit heads/battens over a controlled set, including two drops: the rig plays, the looks change.
var options := {}
func _initialize() -> void:
	for arg in OS.get_cmdline_user_args():
		var pair := arg.trim_prefix("--").split("=", true, 1)
		options[pair[0]] = pair[1] if pair.size() > 1 else "1"
	call_deferred("_run")

func _run() -> void:
	for name in ["sv_beat", "sv_energy", "sv_hands", "sv_haze", "sv_phones"]:
		RenderingServer.global_shader_parameter_add(name, RenderingServer.GLOBAL_VAR_TYPE_FLOAT, 0.0)
	var rig := Rig.new()
	root.add_child(rig)
	rig.build()
	var hall := Hall.new()
	var listen := Listen.new()
	var rb := Rekordbox.new()
	var results := {}
	var failed := false
	for genre in ["techno-peak-time-driving", "techno-raw-deep-hypnotic", "minimal-deep-tech", "hard-techno", "house", "melodic-house-techno", "trance-main-floor"]:
		seed(37)
		var show := Show.new(rig, hall, {"genre": genre, "seed": 37})
		var total := 0.0
		var maximum := 0.0
		var minimum := 1.0
		var dark := 0
		var measured := 0
		var looks := {}
		var spaces := {}
		var dark_beats := 0.0
		var longest_rest := 0.0
		var previous := ""
		for n in 2400:
			var b := n * 128.0 / 600.0
			var breaking := (b >= 144.0 and b < 176.0) or (b >= 432.0 and b < 464.0)
			listen.beat = b
			listen.bpm = 128.0
			listen.latency = 0.0
			listen.source = "fixture"
			listen.title = "Choreography test"
			listen.section = "intro" if b < 16.0 else "break" if breaking else "peak" if b >= 176.0 else "groove"
			listen.phase = "break" if breaking else "groove"
			listen.build = clampf((b - (160.0 if b < 432.0 else 448.0)) / 16.0, 0.0, 1.0) if breaking else 0.0
			listen.ev_drop = previous == "break" and listen.section == "peak"
			listen.track_changed = n == 0
			listen.energy = 0.85 if not breaking else 0.3
			listen.since_kick = fposmod(b, 1.0) if not breaking else 10.0
			listen.kick = not breaking and int(floorf(b)) != int(floorf(b - 128.0 / 600.0))
			previous = listen.section
			show.update(0.1, listen, rb)
			looks[show.scene_text()] = true
			spaces[show.truss_name] = true
			var count := 0
			var rows := {}
			for fixture in rig.fixtures:
				if fixture.level > 0.003:
					count += 1
					if fixture.truss >= 0: rows[fixture.truss] = true
			for batten in rig.battens:
				if maxf(batten.level, batten.strobe) > 0.003: count += 1
			var ratio := float(count) / (rig.fixtures.size() + rig.battens.size())
			if show._drop_beat >= 0.0 and b - show._drop_beat < 8.0: continue
			total += ratio
			minimum = minf(minimum, ratio)
			maximum = maxf(maximum, ratio)
			if count == 0: dark += 1
			dark_beats = dark_beats + 128.0 / 600.0 if count == 0 and not breaking else 0.0
			longest_rest = maxf(longest_rest, dark_beats)
			measured += 1
		var result := {"mean_lit": total / measured, "min_lit": minimum, "max_lit": maximum,
			"dark_frames": dark, "frames": measured, "looks": looks.size(), "formations": spaces.size(), "longest_rest_beats": longest_rest}
		results[genre] = result
		print(genre, " ", JSON.stringify(result))
		# a show, not an empty room: the rig plays while the music does, and it moves on
		if result.mean_lit < 0.3 or result.looks < 3 or result.longest_rest_beats > 4.0:
			printerr("Presence/variation contract failed: ", genre)
			failed = true
	var path: String = options.get("output", "res://local/choreography.json")
	var file := FileAccess.open(path, FileAccess.WRITE)
	file.store_string(JSON.stringify(results, "  "))
	file.close()
	rig.free()
	hall.free()
	listen.free()
	rb.free()
	quit(1 if failed else 0)
