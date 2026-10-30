extends SceneTree
# godot --headless --path . --script tools/listen_replay.gd -- file.wav [--chunk=4096]
# JSONL: one event per line, a row every 10 s and a final summary. No real-time waiting.
const ListenNode = preload("res://scripts/listen.gd")
const Wav = preload("res://scripts/listen_wav.gd")
var listen: Node
var rows := []
var events := []
var next_row := 10.0
var kicks := 0
var density := 0.0
var max_build := 0.0
var n := 0
var last_t := 0.0

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var path := ""
	var chunk := 4096
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--chunk="): chunk = maxi(1, int(arg.get_slice("=", 1)))
		elif not arg.begins_with("--"): path = arg
	if path == "":
		printerr("Usage: godot --headless --path . --script tools/listen_replay.gd -- file.wav [--chunk=4096]")
		quit(1)
		return
	var wav = Wav.new()
	if not wav.load_file(path):
		printerr(wav.error)
		quit(1)
		return
	listen = ListenNode.new()
	root.add_child(listen)
	listen.start_samples(wav.rate)
	listen.analysed.connect(_step)
	var started := Time.get_ticks_usec()
	for first in range(0, wav.frame_count(), chunk):
		listen.begin_frame()
		listen.push_samples(wav.samples(first, chunk))
	if n > 0: _row(last_t)
	var sure := []
	for row in rows:
		if row.bpm and row.confidence > 0.4: sure.append(row.bpm)
	sure.sort()
	var tempo: float = sure[sure.size() >> 1] if not sure.is_empty() else 0.0
	var counts := {"drop": 0, "break": 0, "lift": 0, "section": 0}
	for ev in events:
		if counts.has(ev.type): counts[ev.type] += 1
	print(JSON.stringify({"kind": "summary", "file": path, "seconds": float(wav.frame_count()) / wav.rate,
		"bpm": tempo, "counts": counts, "wall_seconds": (Time.get_ticks_usec() - started) / 1e6}))
	listen.free()
	quit()

func _step(t: float, ev: Dictionary, state: Dictionary) -> void:
	last_t = t
	if ev.kick: kicks += 1
	if ev.drop: _event(t, "drop", state, {"gap": ev.kick_gap, "break_length": ev.break_length})
	elif ev.start: _event(t, "start", state)
	if ev.broke: _event(t, "break", state)
	if ev.back: _event(t, "back", state, {"gap": ev.back})
	if ev.silence_edge: _event(t, "silence", state, {"track_ended": ev.track_ended})
	if ev.from != "" and state.section != "break" and ev.from != "break":
		_event(t, "section", state, {"from": ev.from, "to": state.section})
	if ev.lift: _event(t, "lift", state)
	density += state.density
	max_build = maxf(max_build, state.build)
	n += 1
	if t >= next_row - 1e-9:
		_row(t)
		next_row += 10.0

func _event(t: float, type: String, state: Dictionary, extra: Dictionary = {}) -> void:
	var event := {"kind": "event", "t": t, "type": type, "bpm": state.bpm, "section": state.section,
		"drop": type == "drop", "break": type == "break", "lift": type == "lift"}
	event.merge(extra)
	events.append(event)
	print(JSON.stringify(event))

func _row(t: float) -> void:
	var row := {"kind": "row", "t": t, "bpm": listen._listener.tempo.bpm,
		"confidence": listen.confidence, "section": listen.section, "density": density / n,
		"build": max_build, "kicks": kicks, "beat": listen.beat}
	rows.append(row)
	print(JSON.stringify(row))
	kicks = 0
	density = 0.0
	max_build = 0.0
	n = 0
