extends SceneTree
# Controlled 448-second set: long looks, two breaks/builds/drops and an outro.
# --mode=listen|rekordbox [--output=PATH]. Input only; no Show implementation used.
func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var options := {}
	for arg in OS.get_cmdline_user_args():
		var pair := arg.trim_prefix("--").split("=", true, 1)
		options[pair[0]] = pair[1] if pair.size() > 1 else "1"
	var mode: String = options.get("mode", "listen")
	if mode not in ["listen", "rekordbox"]:
		printerr("Choose --mode=listen or --mode=rekordbox")
		quit(1)
		return
	var listen := Listen.new()
	var rb := Rekordbox.new()
	root.add_child(listen)
	root.add_child(rb)
	listen.source = "fixture"
	listen.title = "Controlled set"
	listen.bpm = 120.0
	listen.confidence = 1.0
	listen.latency = 0.0
	var session := Session.new()
	var path: String = options.get("output", Session.local_path().path_join("sessions/fixture-%s-%d.jsonl" % [mode, Time.get_ticks_usec()]))
	if session.start_record(listen, path, false, {"seed": 19, "genre": "auto"}) != OK:
		printerr(session.error)
		quit(1)
		return
	var last_phase := ""
	for n in 8960:
		var beat := n * 0.1
		var section := "intro" if beat < 32 else "groove" if beat < 192 else "break" if beat < 256 else "peak" if beat < 512 else "break" if beat < 576 else "peak" if beat < 832 else "groove"
		if options.has("jitter") and beat >= 40.0 and beat < 41.0: section = "break"
		listen.beat = beat
		listen.section = section
		listen.phase = "break" if section == "break" else "groove"
		listen.build = clampf((beat - (224.0 if beat < 512 else 544.0)) / 32.0, 0.0, 1.0) if section == "break" else 0.0
		listen.ev_drop = section == "peak" and last_phase == "break"
		listen.kick = n % 10 == 0 and section != "break"
		listen.since_kick = fposmod(beat, 1.0) if section != "break" else beat - (192.0 if beat < 512 else 512.0)
		listen.energy = 0.8 if section != "break" else 0.25 + listen.build * 0.4
		listen.track_changed = n == 0
		last_phase = section
		rb.replaying = true
		rb.replay_live = mode == "rekordbox"
		if mode == "rekordbox":
			var phrase := "Intro" if beat < 32 else "Verse" if beat < 192 else "Down" if beat < 224 else "Up 1" if beat < 256 else "Chorus 1" if beat < 512 else "Down" if beat < 544 else "Up 2" if beat < 576 else "Chorus 2" if beat < 832 else "Outro"
			var boundary := 32.0 if beat < 32 else 192.0 if beat < 192 else 224.0 if beat < 224 else 256.0 if beat < 256 else 512.0 if beat < 512 else 544.0 if beat < 544 else 576.0 if beat < 576 else 832.0 if beat < 832 else 896.0
			rb.fields = {"1/track/title": listen.title, "1/bpm/current": 120.0, "1/time": beat / 2.0,
				"1/beat/subdiv/1": fposmod(beat, 1.0), "1/transport/playing": 1,
				"1/phrase/current": phrase, "1/phrase/next": "Chorus" if phrase.begins_with("Up") else "",
				"1/phrase/countin": boundary - beat}
		if session.record_frame(0.05, listen, rb) != OK:
			printerr(session.error)
			quit(1)
			return
	session.stop()
	print("fixture: ", path)
	listen.free()
	rb.free()
	quit()
