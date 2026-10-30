class_name Listen
extends Node
# SV listening on the sample clock; see listen_core.gd and listen_ear.gd.
# update() latches events across all audio steps until the next picture frame.
# The music comes from system audio (what the computer plays, through a loopback input), or for testing a file.

var bpm := 0.0
var beat := 0.0          # beats since the start, with the fraction
var kick := false        # a kick this frame
var since_kick := 99.0   # beats since the last kick
var energy := 0.0        # 0..1, how loud now
var long_energy := 0.0   # the same over about eight seconds
var low := 0.0
var high := 0.0
var source := "none"
var device_name := ""
var title := ""
var track_changed := false
# For the show, so that it can run on the music's bars and phrases (filled in by the listening, see AGENTS.md):
var bar_offset := 0.0    # a beat on which a bar starts; phrases of 16 beats start where (beat - bar_offset) is a multiple of 16
# What the listening tells the show, as SV's listen.js and signals.js do (see AGENTS.md, "Luisteren").
var phase := ""           # "groove" or "break" ("" = not known yet)
var section := ""         # "intro", "groove", "peak", "low" or "break" ("" = not known yet)
var build := 0.0          # 0..1, how far a build-up has come (in a break)
var riser := 0.0          # 0..1, a riser in the highs (in a break)
var confidence := 0.0     # 0..1, how sure the tempo is
var bass := 0.0           # 0..1, the three bands
var mid := 0.0
var treble := 0.0
var accent := 0.0         # 1 on a high hit, falling away
var hype := 0.0           # stays up for a while after a drop
var ev_drop := false      # this frame: the kick came back after a break (the drop)
var ev_broke := false     # this frame: a break began
var ev_back := false      # this frame: the kick returned after a short pause (no break, only an accent)
var ev_lift := false      # this frame: a new layer came in
var ev_silent := false    # this frame: the sound stopped
var latency := 0.08:     # seconds the analysis runs behind the sound; the show looks this far ahead
	set(value): latency = clampf(value, 0.0, 0.5)
var player: AudioStreamPlayer
const Core = preload("res://scripts/listen_core.gd")
const Ear = preload("res://scripts/listen_ear.gd")
const STEP := 1.0 / 60.0
signal analysed(t: float, event: Dictionary, state: Dictionary)
# Same samples as the analysis, before input muting. Optional session WAV sink.
signal samples_captured(samples: PackedVector2Array, sample_rate: float)
var sensitivity := 1.0
var _capture: AudioEffectCapture
var _ear: RefCounted
var _listener = Core.Listener.new()
var _rate := 2.1
var _stable_bpm := 0.0
var _clock_candidate := 0.0
var _clock_candidate_for := 0.0
var _discarded := 0
var _clock := 0.0
var _pending_device := ""
var _device_wait := 0.0
var _bus_name := ""
var _bar_scores := [0.0, 0.0, 0.0, 0.0]
var _bar_counts := [0, 0, 0, 0]
var _bar_hits := 0
var _bar_candidate := -1
var _bar_confirm := 0
var _track_number := 0
var _track_at := 0.0
var _heard_music := false
var _silence := 0.0
var _silent_gap := false
var _dip_time := 0.0
var _dip_at := -100.0
var _dip_tone := 0.0
var _tone := 0.5
var _recovery := 0.0
var _track_bpm := 0.0
var _tempo_candidate := 0.0
var _tempo_hits := 0
var _input_level := 0.0
var _sample_age := 99.0

func status() -> Dictionary:
	return {"source": source, "device": device_name, "level": _input_level if _sample_age < 0.25 else 0.0,
		"bpm": bpm, "confidence": confidence}

func start_file(path: String) -> bool:
	var stream: AudioStream
	if path.get_extension().to_lower() == "ogg": stream = AudioStreamOggVorbis.load_from_file(path)
	elif path.get_extension().to_lower() == "mp3": stream = AudioStreamMP3.load_from_file(path)
	elif path.get_extension().to_lower() == "wav": stream = AudioStreamWAV.load_from_file(path)
	if stream == null: return false
	if stream is AudioStreamOggVorbis or stream is AudioStreamMP3: stream.loop = true
	stop()
	_bus("Music", false)
	player = AudioStreamPlayer.new()
	player.stream = stream
	player.bus = _bus_name
	add_child(player)
	player.play()
	source = "file"
	title = path.get_file().get_basename()
	_new_track()
	return true

# System audio: the input that carries what the computer plays. On Linux SV makes a source for it called
# "stage-visualizer"; on a Mac it is BlackHole; otherwise a loopback or monitor if there is one.
func start_input(device := "") -> void:
	stop()
	var list := AudioServer.get_input_device_list()
	if device == "":
		for want in ["stage-visualizer", "blackhole", "loopback", "monitor", "stereo mix"]:
			for d in list:
				if device == "" and want in d.to_lower(): device = d
	if device != "" and device in list: _pending_device = device   # Godot switches inputs only once one is running
	_bus("Input", true)
	player = AudioStreamPlayer.new()
	player.stream = AudioStreamMicrophone.new()
	player.bus = _bus_name
	add_child(player)
	player.play()
	source = "system audio"
	title = "System audio"
	device_name = device if device != "" else "Default"
	_new_track()

# Capture precedes the mute, so loopback audio is analysed without feeding it back.
func _bus(name: String, silent: bool) -> void:
	var i := AudioServer.bus_count
	AudioServer.add_bus(i)
	AudioServer.set_bus_name(i, name)
	_bus_name = AudioServer.get_bus_name(i)
	AudioServer.set_bus_send(i, "Master")
	var fx := AudioEffectCapture.new()
	fx.buffer_length = 2.0
	AudioServer.add_bus_effect(i, fx)
	if silent:
		var quiet := AudioEffectAmplify.new()
		quiet.volume_db = -80
		AudioServer.add_bus_effect(i, quiet)
	_capture = fx
	_ear = Ear.new(AudioServer.get_mix_rate())

func toggle() -> void:
	if player and source == "file":
		player.stream_paused = not player.stream_paused
		if _capture: _capture.clear_buffer()

# Release the previous source before opening another one.
func stop() -> void:
	if is_instance_valid(player):
		player.stop()
		player.stream = null
		player.queue_free()
	player = null
	_capture = null
	_ear = null
	if _bus_name != "":
		var i := AudioServer.get_bus_index(_bus_name)
		if i > 0: AudioServer.remove_bus(i)
	_bus_name = ""
	_pending_device = ""
	_device_wait = 0.0
	source = "none"
	device_name = ""
	beat = 0.0
	bpm = 0.0
	energy = 0.0
	long_energy = 0.0
	low = 0.0
	high = 0.0
	_listener = Core.Listener.new()
	_clock = 0.0
	_rate = 2.1
	_stable_bpm = 0.0
	_clock_candidate = 0.0
	_clock_candidate_for = 0.0
	_discarded = 0
	_input_level = 0.0
	_sample_age = 99.0
	phase = ""
	section = ""
	build = 0.0
	riser = 0.0
	confidence = 0.0
	bass = 0.0
	mid = 0.0
	treble = 0.0
	accent = 0.0
	hype = 0.0
	kick = false
	begin_frame()
	since_kick = 99.0
	track_changed = false
	_reset_detection()

func _exit_tree() -> void:
	stop()

# Call once per picture frame. One or many 60 Hz audio steps can complete here.
func update(dt: float) -> void:
	begin_frame()
	_sample_age += dt
	_device_wait += dt
	if _pending_device != "" and _device_wait > 0.5:
		AudioServer.input_device = _pending_device
		_pending_device = ""
	if _capture == null: return
	if player and source == "file" and player.stream_paused: return
	var discarded := _capture.get_discarded_frames()
	var frames := _capture.get_frames_available()
	if frames > 0:
		var stereo := _capture.get_buffer(frames)
		samples_captured.emit(stereo, AudioServer.get_mix_rate())
		var mono := PackedFloat32Array()
		mono.resize(stereo.size())
		for i in stereo.size(): mono[i] = (stereo[i].x + stereo[i].y) * 0.5
		push_samples(mono)
	if discarded > _discarded:
		# Missing audio is not a musical break (Signals.skip).
		var seconds: float = float(discarded - _discarded) / _ear.rate
		_listener.s.last_kick += seconds
		_listener.s.break_at += seconds
		_listener.s.out_at += seconds
		_ear.skip(discarded - _discarded)
		push_warning("Listen: capture lost %.3f s of audio" % seconds)
		_discarded = discarded

func begin_frame() -> void:
	kick = false
	ev_drop = false
	ev_broke = false
	ev_back = false
	ev_lift = false
	ev_silent = false

# Offline callers use precisely the same entry point as the live capture.
func start_samples(sample_rate: float) -> void:
	stop()
	source = "offline"
	_ear = Ear.new(sample_rate)
	_new_track()

func push_samples(samples: PackedFloat32Array) -> void:
	if _ear != null: _ear.push(samples, _hear)

func _hear(bands: Array, rms: float, t: float) -> void:
	_input_level = clampf(rms, 0.0, 1.0)
	_sample_age = 0.0
	_clock = t
	var previous_phase: String = _listener.s.phase
	var was_silent: bool = _listener.s.silent_for > 2.5
	var a: Dictionary = _listener.music.update(bands, rms, t, STEP, sensitivity)
	var ev: Dictionary = _listener.update(a, t, STEP)
	var s: Dictionary = _listener.s
	if ev.kick:
		kick = true
		if absf(ev.kick_gap * _rate - 1.0) < 0.25:
			var f := fmod(beat, 1.0)
			beat += (-f if f < 0.5 else 1.0 - f) * 0.5
		_bar_onset(a.bass + a.bass_onset * 0.5 + maxf(0.0, a.bass - a.high) * 0.25)
		if source == "system audio" and _listener.tempo.kicks > 0: _detect_tempo(_listener.tempo.kicks)
	if ev.drop: hype = 1.0
	if ev.lift: hype = maxf(hype, 0.4)
	ev_drop = ev_drop or ev.drop
	ev_broke = ev_broke or ev.broke
	ev_back = ev_back or ev.back > 0
	ev_lift = ev_lift or ev.lift
	ev_silent = ev_silent or (ev.silent and not was_silent)
	accent = maxf(accent, a.accent)
	bass = a.bass
	mid = minf(1.0, a.mid)
	treble = a.high
	low = bass
	high = treble
	phase = s.phase
	section = s.section
	build = s.build
	riser = s.riser
	bpm = s.bpm
	confidence = _listener.tempo.confidence
	since_kick = (t - s.last_kick) * (bpm / 60.0 if bpm else _rate)
	_flow(STEP, ev.track_ended)
	long_energy = lerpf(long_energy, energy, 1.0 - exp(-STEP * 0.12))
	if source == "system audio": _detect_track(STEP, energy, treble / maxf(bass + treble, 0.01))
	# Event metadata matches tools/hear.mjs; silence is edge-triggered for logs.
	ev["start"] = ev.kick > 0 and previous_phase == "break" and not ev.drop
	ev["silence_edge"] = ev.silent and not was_silent
	analysed.emit(t, ev, s)

# Signals.flow, advanced on the sound clock so offline and live share timing.
func _flow(dt: float, track_ended: bool) -> void:
	accent *= exp(-dt * 18.0)
	hype *= exp(-dt * 0.22)
	var target := bass * 0.5 + mid * 0.3 + treble * 0.2
	energy += (target - energy) * (1.0 - exp(-dt / (0.07 if target > energy else 0.35)))
	if track_ended: _stable_bpm = 0.0
	if bpm:
		if not _stable_bpm: _stable_bpm = bpm
		var difference := absf(bpm - _stable_bpm)
		if difference <= 1.5:
			_stable_bpm += (bpm - _stable_bpm) * (1.0 - exp(-dt / 4.0))
			_clock_candidate_for = 0.0
		else:
			if absf(bpm - _clock_candidate) > 1.5:
				_clock_candidate = bpm
				_clock_candidate_for = 0.0
			if confidence >= 0.45 and phase != "break": _clock_candidate_for += dt
			if _clock_candidate_for >= 3.0:
				_stable_bpm = bpm
				_clock_candidate_for = 0.0
		_rate += (_stable_bpm / 60.0 - _rate) * (1.0 - exp(-dt / 2.0))
	beat += dt * _rate * (1.0 if _listener.s.activity > 0.15 else 0.3)

# Four-beat accent voting. Ambiguous, even kicks keep the first onset as the anchor.
func _bar_onset(strength: float) -> void:
	var whole := roundi(beat)
	if _bar_hits == 0: bar_offset = float(whole)
	var slot := posmod(whole, 4)
	_bar_scores[slot] = lerpf(_bar_scores[slot], strength, 0.3)
	_bar_counts[slot] += 1
	_bar_hits += 1
	if _bar_hits < 16 or slot != 0: return
	for count in _bar_counts:
		if count < 4: return
	var best := 0
	for i in range(1, 4):
		if _bar_scores[i] > _bar_scores[best]: best = i
	var runner := 0.0
	for i in 4:
		if i != best: runner = maxf(runner, _bar_scores[i])
	if _bar_scores[best] < runner * 1.12 + 0.02:
		_bar_confirm = 0
		return
	_bar_confirm = _bar_confirm + 1 if best == _bar_candidate else 1
	_bar_candidate = best
	if _bar_confirm >= 3:
		# Preserve the phrase origin rather than moving it to every new bar.
		bar_offset += float(posmod(best - roundi(bar_offset) + 2, 4) - 2)

func _detect_track(dt: float, level: float, tone: float) -> void:
	var age := _clock - _track_at
	if level < 0.08:
		_silence += dt
		if _heard_music and _silence >= 2.0: _silent_gap = true
	else:
		_silence = 0.0
		if level > 0.25:
			if _silent_gap and age > 8.0:
				_new_track()
			_heard_music = true
	# An energy dip alone can be a breakdown: require a changed spectral balance on recovery.
	if level < maxf(0.1, long_energy * 0.45) and long_energy > 0.25:
		_dip_time += dt
		if _dip_time >= 2.0 and _dip_at < _clock - 14.0:
			_dip_at = _clock
			_dip_tone = _tone
	else: _dip_time = 0.0
	var recovered := level > maxf(0.3, long_energy * 0.9) and absf(tone - _dip_tone) > 0.16
	if _clock - _dip_at < 14.0 and recovered: _recovery += dt
	else: _recovery = 0.0
	if age > 24.0 and _recovery > 1.2: _new_track()
	_tone = lerpf(_tone, tone, 1.0 - exp(-dt * 0.4))

func _detect_tempo(tempo: float) -> void:
	if _track_bpm == 0.0:
		_track_bpm = tempo
		return
	if absf(tempo - _track_bpm) < maxf(4.0, _track_bpm * 0.04):
		_tempo_hits = 0
		return
	if absf(tempo - _tempo_candidate) > 2.0: _tempo_hits = 0
	_tempo_candidate = tempo
	_tempo_hits += 1
	if _tempo_hits >= 12 and _clock - _track_at > 24.0:
		_new_track()
		_track_bpm = tempo

func _reset_detection() -> void:
	_bar_scores.fill(0.0)
	_bar_counts.fill(0)
	_bar_hits = 0
	_bar_candidate = -1
	_bar_confirm = 0
	bar_offset = roundf(beat)
	_track_at = _clock
	_heard_music = false
	_silence = 0.0
	_silent_gap = false
	_dip_time = 0.0
	_dip_at = -100.0
	_recovery = 0.0
	_track_bpm = 0.0
	_tempo_hits = 0

func _new_track() -> void:
	_reset_detection()
	_listener.new_track()
	_stable_bpm = 0.0
	track_changed = true
	if source == "system audio":
		_track_number += 1
		title = "System audio · %d" % _track_number

# Call only when the player reports a different track (Signals.told/newTrack).
func notify_track(track_title: String = "") -> void:
	_new_track()
	if track_title != "": title = track_title
