extends SceneTree
# Exact input roundtrip, frame pulses, integer OSC, WAV and malformed files.
const SessionIO = preload("res://scripts/session.gd")
const Wav = preload("res://scripts/listen_wav.gd")
var failures := 0

func check(ok: bool, message: String) -> void:
	if not ok:
		failures += 1
		printerr(message)

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var dir := SessionIO.local_path().path_join("session-tests")
	DirAccess.make_dir_recursive_absolute(dir)
	var path := dir.path_join("roundtrip-%d.jsonl" % Time.get_ticks_usec())
	var listen := Listen.new()
	var rb := Rekordbox.new()
	root.add_child(listen)
	root.add_child(rb)
	var session := SessionIO.new()
	check(SessionIO.export_local_path("/tmp/SV.x86_64", false) == "/tmp/local", "Linux session folder")
	check(SessionIO.export_local_path("/tmp/SV.app/Contents/MacOS/SV", true) == "/tmp/local", "Mac folder outside signed bundle")
	check(session.start_record(listen, path) == OK, "start recording")
	var expected := []
	var durations := [0.01612345678901234, 0.11666666666666675, 0.018972333333333202, 0.13, 0.017, 0.02]
	var samples := PackedVector2Array([Vector2(-0.5, 0.25), Vector2(0.125, -0.75)])
	listen.samples_captured.emit(samples, 48000.0)
	for i in durations.size():
		listen.beat = PI * i
		listen.phase = "break" if i == 2 else "groove"
		listen.section = "break" if i == 2 else "peak"
		listen.kick = i % 2 == 0
		listen.ev_drop = i == 3
		listen.track_changed = i == 0
		listen.latency = 0.12345678901234567
		listen.energy = 0.3141592653589793
		rb.replaying = true
		rb.replay_live = i not in [0, 5]
		rb.active = "2" if i > 2 else "1"
		rb.fields = {"1/phrase/current": 3, "2/track/title": "Test • 曲", "1/bpm/current": 124.125}
		expected.append(SessionIO.snapshot(listen, rb))
		check(session.record_frame(durations[i], listen, rb, {"yaw": durations[i], "tune": {"pace": 0.11666666666666675}}) == OK, "write frame")
	session.stop()
	var wav = Wav.new()
	check(wav.load_file(path.get_basename() + ".wav"), "read WAV")
	check(wav.rate == 48000 and wav.channels == 2 and wav.frame_count() == 2, "WAV header/count")
	check(wav.samples(0, 2) == PackedFloat32Array([-0.125, -0.3125]), "WAV samples")
	check(session.start_replay(path, listen, rb) == OK, "start replay")
	if session.error != "":
		printerr(session.error)
		quit(1)
		return
	for i in durations.size():
		check(session.next_delay() == durations[i], "next frame duration")
		check(session.replay_frame(listen, rb), "read frame")
		check(session.frame_dt == durations[i], "exact frame clock")
		check(session.controls.yaw == durations[i] and session.controls.tune.pace == 0.11666666666666675, "exact nested show controls")
		check(SessionIO.snapshot(listen, rb) == expected[i], "input snapshot %d differs" % i)
		check(rb.fields["1/phrase/current"] is int, "integer OSC type")
		# Consumers may clear pulses, change decks or reset track references.
		listen.track_changed = false
		listen.ev_drop = false
		rb.active = "master"
		listen.update(0.1) # replay_frame must restore all inputs on the next row
	check(session.finished and session.frame_count == durations.size(), "EOF/count")
	check(not session.replay_frame(listen, rb), "no duplicate final frame")
	session.stop()
	# Initial v1 recordings have no IEEE copy of optional show controls.
	var legacy := dir.path_join("legacy.jsonl")
	var old := FileAccess.open(legacy, FileAccess.WRITE)
	for line in FileAccess.get_file_as_string(path).strip_edges().split("\n"):
		var row: Dictionary = JSON.parse_string(line)
		if row.kind == "session": row.version = 1
		elif row.kind == "frame":
			var bytes := Marshalls.base64_to_raw(row.f64)
			row.f64 = Marshalls.raw_to_base64(bytes.slice(0, bytes.size() - 16))
		old.store_line(JSON.stringify(row, "", true, true))
	old.close()
	check(session.start_replay(legacy, listen, rb) == OK, "read v1 recording")
	check(session.replay_frame(listen, rb) and session.frame_dt == durations[0], "exact v1 inputs")
	session.stop()
	var broken := dir.path_join("broken.jsonl")
	var file := FileAccess.open(broken, FileAccess.WRITE)
	file.store_line("{\"kind\":\"session\",\"version\":999}")
	file.close()
	check(session.start_replay(broken, listen, rb) != OK, "reject wrong schema")
	session.stop()
	file = FileAccess.open(broken, FileAccess.WRITE)
	var source := FileAccess.open(path, FileAccess.READ)
	file.store_line(source.get_line())
	file.store_line("{\"kind\":\"frame\"}")
	file.close()
	source.close()
	check(session.start_replay(broken, listen, rb) != OK, "reject incomplete frame")
	session.stop()
	listen.free()
	rb.free()
	print("session roundtrip: %d failures" % failures)
	quit(0 if failures == 0 else 1)
