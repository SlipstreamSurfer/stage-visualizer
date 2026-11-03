extends SceneTree
# What the six parts hear in a WAV: hits per minute, how present each is, and when layers come in.
#   godot --headless --path . --script tools/parts_probe.gd -- file.wav
const ListenNode = preload("res://scripts/listen.gd")
const Wav = preload("res://scripts/listen_wav.gd")

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var path: String = OS.get_cmdline_user_args()[0] if not OS.get_cmdline_user_args().is_empty() else ""
	var wav = Wav.new()
	if path == "" or not wav.load_file(path):
		printerr("Usage: parts_probe.gd -- file.wav")
		quit(1)
		return
	var listen: Node = ListenNode.new()
	root.add_child(listen)
	listen.start_samples(wav.rate)
	var chunk: int = int(wav.rate / 60.0)
	var present := PackedFloat32Array([0, 0, 0, 0, 0, 0])
	var layers := []
	var frames := 0
	for first in range(0, wav.frame_count(), chunk):
		listen.begin_frame()
		listen.push_samples(wav.samples(first, chunk))
		frames += 1
		for i in 6:
			present[i] += listen.parts.present[i]
			if listen.parts.came_in[i]: layers.append("%s@%ds" % [ListenParts.NAMES[i], roundi(first / wav.rate)])
	var minutes: float = wav.frame_count() / wav.rate / 60.0
	var out := {}
	for i in 6:
		out[ListenParts.NAMES[i]] = {"hits_per_min": roundi(listen.parts.hits[i] / minutes), "present": snappedf(present[i] / frames, 0.01)}
	print(JSON.stringify({"parts": out, "layers": layers, "bpm": listen.bpm}))
	listen.free()
	quit()
