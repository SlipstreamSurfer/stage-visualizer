class_name Show
extends ShowDirector
# The lighting designer. It reads the music (system audio, rekordbox, or both), knows the part of the track
# (intro, groove, build, break, peak, outro), and plays the rig the way SV in the browser does (show/director.gd):
# a mood per genre, a palette per track, looks held for a phrase, the drop opening the whole rig.
# With rekordbox it sees a drop coming: the build is timed to the phrase, the rig goes black on the last beat before
# it, and the drop lands on the first beat of the Chorus.


func _init(r: Rig, h: Hall, options: Dictionary = {}) -> void:
	rig = r
	hall = h
	if options.is_empty():
		for a in OS.get_cmdline_user_args():
			var pair := a.trim_prefix("--").split("=", true, 1)
			options[pair[0]] = pair[1] if pair.size() > 1 else "1"
	_log = options.has("log")
	genre = options.get("genre", "auto")
	if options.has("seed"): seed(int(options.seed))

func _light(dt: float) -> void:
	_direct(dt)
	# the crowd: hands and phones go up with the music
	var G := _g()
	var hands_want: float = {"intro": 0.05, "groove": 0.3, "build": 0.2 + 0.5 * build, "break": 0.15, "peak": 0.55 + 0.45 * drop, "outro": 0.05}[section] * G.hands
	_hands = lerpf(_hands, maxf(hands_want, drop), 1.0 - exp(-dt * 2.0))
	RenderingServer.global_shader_parameter_set("sv_beat", beat)
	RenderingServer.global_shader_parameter_set("sv_energy", clampf(energy * 1.2, 0.0, 1.0) * (0.5 if section == "break" else 1.0))
	RenderingServer.global_shader_parameter_set("sv_hands", _hands)
	_phones = lerpf(_phones, 1.0 if section == "break" or (section == "build" and build > 0.6) else 0.0, 1.0 - exp(-dt * 0.8))
	RenderingServer.global_shader_parameter_set("sv_phones", _phones)
