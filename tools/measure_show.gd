extends SceneTree
# Measure a long show without rendering: a set of three generated tracks (about sixteen minutes), played with given
# light-desk levels. Reports how often looks change, how much changes at once, how often the total light jumps with
# the strobes off, how lit the stage's own heads are, and how soon a figure returns.
# Works on any version with the same Show API, so two versions can be compared on the same music and settings.
#   godot --headless --path . --script tools/measure_show.gd -- --genre=techno-raw-deep-hypnotic --desk=low --output=res://local/m.json

var options := {}

func _initialize() -> void:
	for arg in OS.get_cmdline_user_args():
		var pair := arg.trim_prefix("--").split("=", true, 1)
		options[pair[0]] = pair[1] if pair.size() > 1 else "1"
	call_deferred("_run")

func _section(bar: float) -> String:
	if bar < 16.0: return "intro"
	if bar < 64.0: return "groove"
	if bar < 80.0: return "break"
	if bar < 144.0: return "peak"
	return "groove" if bar < 160.0 else "outro"

func _run() -> void:
	for name in ["sv_beat", "sv_energy", "sv_hands", "sv_haze", "sv_phones"]:
		RenderingServer.global_shader_parameter_add(name, RenderingServer.GLOBAL_VAR_TYPE_FLOAT, 0.0)
	var rig := Rig.new()
	root.add_child(rig)
	rig.build()
	var hall := Hall.new()
	hall.stage_screen = Node3D.new()
	hall.add_child(hall.stage_screen)
	var listen := Listen.new()
	var rb := Rekordbox.new()
	var genre: String = options.get("genre", "techno-raw-deep-hypnotic")
	seed(37)
	var show := Show.new(rig, hall, {"genre": genre, "seed": 37})
	if options.get("desk", "low") == "low":
		show.tune.groups = {"front": 0.0, "hall": 0.0, "wash": 0.15, "back": 1.0, "roof": 1.0, "side": 1.0, "delay": 1.0, "batten": 1.0, "rear": 1.0}
	if options.get("strobe", "off") == "off": show.tune.strobe = 0.0
	var dt := 0.05
	var bpm := 128.0
	var track_bars := 176.0
	var frames := int(3.0 * track_bars * 4.0 * 60.0 / bpm / dt)
	var previous := ""
	var keys := {"look": "", "stack": "", "program": "", "room": ""}
	var changes := {"look": 0, "stack": 0, "program": 0, "room": 0}
	var together := 0
	var held_since := 0.0
	var holds: Array = []
	var looks_seen: Array = []
	var returns := 0
	var jumps := 0
	var jump_frames := 0
	var last_total := -1.0
	var stage_sum := 0.0
	var stage_n := 0
	var lit_sum := 0.0
	var played := 0.0
	for n in frames:
		var t := n * dt
		var beat_all := t * bpm / 60.0
		var track := floori(beat_all / (track_bars * 4.0))
		var b := fposmod(beat_all, track_bars * 4.0)
		var bar := b / 4.0
		var sec := _section(bar)
		var breaking := sec == "break"
		listen.beat = b
		listen.bpm = bpm
		listen.latency = 0.0
		listen.source = "fixture"
		listen.title = "Measured track %d" % track
		listen.section = sec
		listen.phase = "break" if breaking else "groove"
		listen.build = clampf((bar - 72.0) / 8.0, 0.0, 1.0) if breaking else 0.0
		listen.ev_drop = previous == "break" and sec == "peak"
		listen.track_changed = n == 0 or floori((beat_all - dt * bpm / 60.0) / (track_bars * 4.0)) != track
		listen.energy = 0.3 if breaking else 0.55 if sec in ["intro", "outro"] else 0.85
		listen.since_kick = fposmod(b, 1.0) if not breaking else 10.0
		listen.kick = not breaking and int(floorf(b)) != int(floorf(b - dt * bpm / 60.0))
		previous = sec
		if "parts" in listen and not breaking:
			# a groove: claps on two and four, hats on the off-beats, a lead that comes in at bar 32
			var parts = listen.parts
			parts.clear_events()
			for i in 6: parts.hit[i] *= exp(-dt * 14.0)
			var step := int(floorf(b * 2.0))
			if step != int(floorf((b - dt * bpm / 60.0) * 2.0)):
				if step % 2 == 1:
					parts.hit[5] = 0.8
					parts.hits[5] += 1
				elif (step / 2) % 2 == 1:
					parts.hit[4] = 1.0
					parts.hits[4] += 1
			parts.present[4] = 0.8
			parts.present[5] = 0.8
			parts.present[1] = 0.8
			parts.level[1] = 0.6 + 0.3 * exp(-fposmod(b, 1.0) * 6.0)
			if absf(bar - 32.0) < dt * bpm / 240.0: parts.came_in[3] = true
		show.update(dt, listen, rb)
		if t < 20.0: continue
		var now := {"look": show.head_name, "stack": show.stack_name, "program": show.PROGRAMS[show._program].name, "room": str(show.phrasing.cue)}
		var changed := 0
		for k in keys:
			if keys[k] != "" and keys[k] != now[k]:
				changes[k] += 1
				changed += 1
			keys[k] = now[k]
		if changed >= 3: together += 1
		if changed > 0 and now.look != "":
			if not breaking: holds.append(t - held_since)
			held_since = t
		if looks_seen.is_empty() or looks_seen[0] != now.look:
			if now.look in looks_seen.slice(1, 4): returns += 1
			looks_seen.push_front(now.look)
		# the light that reaches the eye, without the strobe channels
		var total := 0.0
		var stage := 0.0
		var stage_count := 0
		for f in rig.fixtures:
			total += f.level
			if f.kind != Rig.WASH and f.group in ["back", "roof", "delay"]:
				stage += f.level
				stage_count += 1
		for bt in rig.battens: total += bt.level
		if sec in ["groove", "peak"] and show._drop_beat < 0.0 or (show._drop_beat >= 0.0 and b - show._drop_beat > 16.0 and sec in ["groove", "peak"]):
			if last_total >= 0.0:
				jump_frames += 1
				if absf(total - last_total) / maxf(maxf(total, last_total), 4.0) > 0.2: jumps += 1
			stage_sum += stage / maxf(1.0, stage_count)
			stage_n += 1
			lit_sum += total
			played += dt
		last_total = total
	holds.sort()
	var minutes := (frames * dt - 20.0) / 60.0
	var result := {
		"genre": genre, "desk": options.get("desk", "low"), "minutes": snappedf(minutes, 0.1),
		"look_changes_per_min": snappedf(changes.look / minutes, 0.01), "stack_changes_per_min": snappedf(changes.stack / minutes, 0.01),
		"program_changes_per_min": snappedf(changes.program / minutes, 0.01), "room_changes_per_min": snappedf(changes.room / minutes, 0.01),
		"three_or_more_at_once": together, "median_hold_s": snappedf(holds[holds.size() / 2] if not holds.is_empty() else 0.0, 0.1),
		"quick_returns": returns, "distinct_looks": looks_seen.reduce(func(acc, x): return acc if x in acc else acc + [x], []).size(),
		"light_jumps_per_min": snappedf(jumps / maxf(0.01, played / 60.0), 0.1), "stage_head_mean": snappedf(stage_sum / maxf(1.0, stage_n), 0.001),
		"total_light_mean": snappedf(lit_sum / maxf(1.0, stage_n), 0.01),
	}
	print(JSON.stringify(result))
	var path: String = options.get("output", "")
	if path != "":
		var file := FileAccess.open(path, FileAccess.WRITE)
		file.store_string(JSON.stringify(result, "  "))
		file.close()
	rig.free()
	hall.free()
	listen.free()
	rb.free()
	quit()
