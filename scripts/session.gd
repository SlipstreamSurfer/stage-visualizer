class_name Session
extends RefCounted
# Record immediately before Show.update; replay replaces both source updates.
# The IEEE sidecar preserves floats that Godot's decimal parser rounds differently.

const VERSION := 2
const LISTEN_FIELDS := [
	"bpm", "confidence", "beat", "bar_offset", "phase", "section", "build", "riser",
	"energy", "bass", "mid", "treble", "kick", "accent", "hype", "ev_drop",
	"ev_broke", "ev_back", "ev_lift", "ev_silent", "track_changed", "latency",
	"since_kick", "long_energy", "low", "high", "source", "device_name", "title", "sensitivity"]
const RB_FIELDS := ["listening", "error", "packets", "active", "port", "last_packet", "_clock"]

var error := ""
var path := ""
var recording := false
var replaying := false
var finished := false
var frame_count := 0
var time := 0.0
var frame_dt := 0.0
var metadata := {}
var controls := {}
var _file: FileAccess
var _listen: Listen
var _next := {}
var _flush_at := 1.0
var _line := 0
var _wav: FileAccess
var _audio_bytes := 0
var _audio_rate := 0
var _audio_start := -1.0
var _audio_error := ""
var _audio_lost := 0

static func local_path() -> String:
	if not OS.has_feature("template"): return ProjectSettings.globalize_path("res://local")
	return export_local_path(OS.get_executable_path(), OS.has_feature("macos"))

static func export_local_path(executable: String, macos: bool) -> String:
	var base := executable.get_base_dir()
	# Stay outside the signed .app bundle.
	if macos:
		for i in 3: base = base.get_base_dir()
	return base.path_join("local")

func start_record(listen: Listen, filename := "", audio := true, context: Dictionary = {}) -> Error:
	stop()
	error = ""
	frame_count = 0
	time = 0.0
	_flush_at = 1.0
	_audio_bytes = 0
	_audio_rate = 0
	_audio_start = -1.0
	_audio_error = ""
	_audio_lost = 0
	if filename == "":
		var stamp := Time.get_datetime_string_from_system().replace(":", "-")
		filename = local_path().path_join("sessions/%s-%06d.jsonl" % [stamp, Time.get_ticks_usec() % 1000000])
	path = ProjectSettings.globalize_path(filename)
	var result := DirAccess.make_dir_recursive_absolute(path.get_base_dir())
	if result != OK: return _fail("Cannot create session folder: " + path, result)
	if FileAccess.file_exists(path) or FileAccess.file_exists(path.get_basename() + ".wav"):
		return _fail("Session already exists: " + path, ERR_ALREADY_EXISTS)
	_file = FileAccess.open(path, FileAccess.WRITE)
	if _file == null: return _fail("Cannot create session: " + path, FileAccess.get_open_error())
	_listen = listen
	metadata = {"kind": "session", "version": VERSION, "created": Time.get_datetime_string_from_system(),
		"engine": Engine.get_version_info().string, "listen_fields": LISTEN_FIELDS,
		"audio_requested": audio, "source": listen.source, "title": listen.title, "context": context}
	_write(metadata)
	recording = true
	if audio: listen.samples_captured.connect(_capture_audio)
	return OK

static func snapshot(listen: Listen, rb: Rekordbox) -> Dictionary:
	var state := {}
	for key in LISTEN_FIELDS: state[key] = listen.get(key)
	var rekordbox := {"fields": rb.fields.duplicate(true), "live": rb.live(), "ints": []}
	# JSON numbers parse as floats in Godot. Retain OSC integer types too.
	for key in rb.fields:
		if rb.fields[key] is int: rekordbox.ints.append(key)
	for key in RB_FIELDS: rekordbox[key] = rb.get(key)
	return {"listen": state, "rb": rekordbox}

func record_frame(dt: float, listen: Listen, rb: Rekordbox, options: Dictionary = {}) -> Error:
	if not recording: return ERR_UNCONFIGURED
	if not is_finite(dt) or dt <= 0.0: return _fail("Frame duration must be positive", ERR_INVALID_PARAMETER)
	var row := snapshot(listen, rb)
	time += dt
	row.merge({"kind": "frame", "t": time, "dt": dt, "n": frame_count})
	if not options.is_empty(): row.controls = options
	# Godot's decimal JSON parser is not correctly rounded for every double.
	# A compact IEEE copy makes the frame clock and source floats bit exact.
	row.f64 = Marshalls.raw_to_base64(_float_values(row).to_byte_array())
	_write(row)
	frame_count += 1
	if time >= _flush_at:
		_file.flush()
		_flush_at = time + 1.0
	var result := _file.get_error()
	if result != OK: return _fail("Session write failed: " + path, result)
	return OK

static func read_metadata(filename: String) -> Dictionary:
	var file := FileAccess.open(filename, FileAccess.READ)
	if file == null: return {}
	var parser := JSON.new()
	if parser.parse(file.get_line()) != OK or not parser.data is Dictionary: return {}
	return parser.data

func start_replay(filename: String, listen: Listen, rb: Rekordbox) -> Error:
	stop()
	error = ""
	finished = false
	frame_count = 0
	time = 0.0
	_line = 0
	path = ProjectSettings.globalize_path(filename)
	_file = FileAccess.open(path, FileAccess.READ)
	if _file == null: return _fail("Cannot read session: " + path, FileAccess.get_open_error())
	metadata = _read()
	var version = metadata.get("version")
	if metadata.get("kind") != "session" or (version != 1 and version != VERSION) or metadata.get("listen_fields") != LISTEN_FIELDS:
		return _fail("Unsupported session header: " + path, ERR_FILE_UNRECOGNIZED)
	_listen = listen
	listen.stop()
	rb.stop()
	rb.replaying = true
	replaying = true
	return _advance()

# Realtime drivers wait for next_delay(), then call replay_frame once. Never skip
# rows to catch up: one-frame events and Show's own state depend on every row.
func next_delay() -> float:
	return float(_next.get("dt", 0.0))

func replay_frame(listen: Listen, rb: Rekordbox) -> bool:
	if not replaying or _next.is_empty() or error != "": return false
	frame_dt = float(_next.dt)
	time = float(_next.t)
	controls = _next.get("controls", {}).duplicate(true)
	for key in LISTEN_FIELDS: listen.set(key, _next.listen[key])
	rb.fields = _next.rb.fields.duplicate(true)
	for key in _next.rb.ints: rb.fields[key] = int(rb.fields[key])
	for key in RB_FIELDS: rb.set(key, _next.rb[key])
	rb.replay_live = _next.rb.live
	frame_count += 1
	_advance()
	return true

func _advance() -> Error:
	_next = {}
	var row := _read()
	if row.get("kind") == "end":
		if row.get("frames") != frame_count or not _number(row.get("t")) or absf(row.t - time) > 1e-8 * maxf(1.0, time):
			return _fail("Session footer does not match frames", ERR_FILE_CORRUPT)
		finished = true
		return OK
	if not _valid_frame(row):
		return _fail("Invalid or incomplete session at line %d" % _line, ERR_FILE_CORRUPT)
	_next = row
	return OK

func _valid_frame(row: Dictionary) -> bool:
	if row.get("kind") != "frame" or row.get("n") != frame_count: return false
	if not _number(row.get("dt")) or not _number(row.get("t")): return false
	if row.dt <= 0.0 or absf(row.t - time - row.dt) > 1e-8 * maxf(1.0, row.t): return false
	if not row.get("listen") is Dictionary or not row.get("rb") is Dictionary: return false
	if not row.get("controls", {}) is Dictionary: return false
	for key in LISTEN_FIELDS:
		if not row.listen.has(key): return false
		var sample = _listen.get(key)
		var value = row.listen[key]
		if sample is float:
			if not _number(value): return false
		elif typeof(value) != typeof(sample): return false
	if not row.rb.get("fields") is Dictionary or not row.rb.get("live") is bool or not row.rb.get("ints") is Array: return false
	for key in row.rb.ints:
		if not row.rb.fields.has(key) or not _number(row.rb.fields[key]): return false
	for key in RB_FIELDS:
		if not row.rb.has(key): return false
	for key in ["packets", "port", "last_packet", "_clock"]:
		if not _number(row.rb[key]): return false
	return row.rb.listening is bool and row.rb.error is String and row.rb.active is String

static func _number(value: Variant) -> bool:
	return (value is float or value is int) and is_finite(float(value))

func _read() -> Dictionary:
	if _file.eof_reached(): return {}
	_line += 1
	var parser := JSON.new()
	if parser.parse(_file.get_line()) != OK or not parser.data is Dictionary: return {}
	if parser.data.get("kind") == "frame" and not _restore_floats(parser.data, metadata.get("version", 1) >= 2): return {}
	return parser.data

static func _float_values(row: Dictionary, precise_controls := true) -> PackedFloat64Array:
	var values := PackedFloat64Array([row.t, row.dt])
	for key in LISTEN_FIELDS:
		if _number(row.listen.get(key)): values.append(row.listen[key])
	var keys: Array = row.rb.fields.keys()
	keys.sort()
	for key in keys:
		if _number(row.rb.fields[key]) and key not in row.rb.ints: values.append(row.rb.fields[key])
	values.append(row.rb.last_packet)
	values.append(row.rb._clock)
	var extra := []
	if precise_controls: _control_numbers(row.get("controls", {}), extra)
	values.append_array(PackedFloat64Array(extra))
	return values

static func _control_numbers(value: Variant, numbers: Array) -> void:
	if _number(value): numbers.append(float(value))
	elif value is Dictionary:
		var keys: Array = value.keys()
		keys.sort()
		for key in keys: _control_numbers(value[key], numbers)
	elif value is Array:
		for item in value: _control_numbers(item, numbers)

static func _restore_control_numbers(value: Variant, values: PackedFloat64Array, cursor: Array) -> Variant:
	if _number(value):
		var number := values[cursor[0]]
		cursor[0] += 1
		return number
	if value is Dictionary:
		var keys: Array = value.keys()
		keys.sort()
		for key in keys: value[key] = _restore_control_numbers(value[key], values, cursor)
	elif value is Array:
		for i in value.size(): value[i] = _restore_control_numbers(value[i], values, cursor)
	return value

static func _restore_floats(row: Dictionary, precise_controls := true) -> bool:
	if not row.get("f64") is String or not row.get("listen") is Dictionary or not row.get("rb") is Dictionary: return false
	if not row.rb.get("fields") is Dictionary or not row.rb.get("ints") is Array: return false
	if not row.has("t") or not row.has("dt") or not row.rb.has("last_packet") or not row.rb.has("_clock"): return false
	var bytes := Marshalls.base64_to_raw(row.f64)
	if bytes.size() != _float_values(row, precise_controls).size() * 8: return false
	var values := bytes.to_float64_array()
	for value in values:
		if not is_finite(value): return false
	row.t = values[0]
	row.dt = values[1]
	var at := 2
	for key in LISTEN_FIELDS:
		if _number(row.listen.get(key)):
			row.listen[key] = values[at]
			at += 1
	var keys: Array = row.rb.fields.keys()
	keys.sort()
	for key in keys:
		if _number(row.rb.fields[key]) and key not in row.rb.ints:
			row.rb.fields[key] = values[at]
			at += 1
	row.rb.last_packet = values[at]
	row.rb._clock = values[at + 1]
	if precise_controls and row.has("controls"): row.controls = _restore_control_numbers(row.controls, values, [at + 2])
	return true

func _write(row: Dictionary) -> void:
	_file.store_line(JSON.stringify(row, "", true, true))

func _capture_audio(samples: PackedVector2Array, sample_rate: float) -> void:
	if _audio_error != "" or samples.is_empty(): return
	if _wav == null:
		_audio_rate = roundi(sample_rate)
		_wav = FileAccess.open(path.get_basename() + ".wav", FileAccess.WRITE_READ)
		if _wav == null:
			_audio_error = "Cannot create audio sidecar"
			return
		_audio_start = time
		_audio_header()
	if roundi(sample_rate) != _audio_rate:
		_audio_error = "Audio sample rate changed; WAV stopped"
		return
	# IEEE float32 stereo WAV, streamed to disk rather than accumulated in memory.
	var bytes := samples.to_byte_array()
	if _audio_bytes + bytes.size() > 0xffffff00:
		_audio_error = "WAV reached RIFF size limit; audio stopped"
		return
	_wav.store_buffer(bytes)
	_audio_bytes += bytes.size()
	if _listen._capture: _audio_lost = maxi(_audio_lost, _listen._capture.get_discarded_frames())
	if _wav.get_error() != OK: _audio_error = "Audio write failed"

func _audio_header() -> void:
	_wav.seek(0)
	_wav.store_buffer("RIFF".to_ascii_buffer())
	_wav.store_32(36 + _audio_bytes)
	_wav.store_buffer("WAVEfmt ".to_ascii_buffer())
	_wav.store_32(16)
	_wav.store_16(3) # IEEE float
	_wav.store_16(2)
	_wav.store_32(_audio_rate)
	_wav.store_32(_audio_rate * 8)
	_wav.store_16(8)
	_wav.store_16(32)
	_wav.store_buffer("data".to_ascii_buffer())
	_wav.store_32(_audio_bytes)

func stop() -> void:
	if is_instance_valid(_listen) and _listen.samples_captured.is_connected(_capture_audio):
		_listen.samples_captured.disconnect(_capture_audio)
	if _wav:
		_audio_header()
		_wav.close()
		_wav = null
	if recording and _file:
		_write({"kind": "end", "frames": frame_count, "t": time, "audio": {
			"file": path.get_basename().get_file() + ".wav" if _audio_bytes > 0 else "",
			"frames": _audio_bytes / 8, "rate": _audio_rate, "start": _audio_start,
			"discarded": _audio_lost, "error": _audio_error}})
	if _file: _file.close()
	_file = null
	_next = {}
	recording = false
	replaying = false
	_listen = null

func _fail(message: String, code: Error) -> Error:
	error = message
	return code
