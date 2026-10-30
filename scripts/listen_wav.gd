extends RefCounted
# RIFF/WAVE PCM (8/16/24/32 bit) and IEEE float (32/64 bit), including extensible headers.
# No Godot import/compression: the listener receives the original samples.
var error := ""
var rate := 0
var channels := 0
var format := 0
var bits := 0
var data := PackedByteArray()

func load_file(path: String) -> bool:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null: return _fail("Cannot open WAV: " + path)
	if file.get_buffer(4).get_string_from_ascii() != "RIFF": return _fail("Expected RIFF WAV")
	file.get_32()
	if file.get_buffer(4).get_string_from_ascii() != "WAVE": return _fail("Expected WAVE")
	while file.get_position() + 8 <= file.get_length():
		var id := file.get_buffer(4).get_string_from_ascii()
		var size := file.get_32()
		var end := file.get_position() + size
		if end > file.get_length(): return _fail("Truncated WAV chunk: " + id)
		if id == "fmt ":
			var fmt := file.get_buffer(size)
			if fmt.size() < 16: return _fail("Short WAV format")
			format = fmt.decode_u16(0)
			channels = fmt.decode_u16(2)
			rate = fmt.decode_u32(4)
			bits = fmt.decode_u16(14)
			if format == 65534:
				if fmt.size() < 40: return _fail("Short extensible WAV format")
				format = fmt.decode_u16(24)
		elif id == "data": data = file.get_buffer(size)
		file.seek(end + (size & 1))
	if channels < 1 or rate < 1 or data.is_empty(): return _fail("Missing WAV samples or format")
	if not ((format == 1 and bits in [8, 16, 24, 32]) or (format == 3 and bits in [32, 64])):
		return _fail("Unsupported WAV encoding: format %d, %d bit" % [format, bits])
	if data.size() % (channels * (bits / 8)) != 0: return _fail("Incomplete WAV sample frame")
	return true

func _fail(message: String) -> bool:
	error = message
	return false

func frame_count() -> int:
	return data.size() / (channels * (bits / 8))

func samples(first: int, length: int) -> PackedFloat32Array:
	var width := bits / 8
	var stride := channels * width
	var n := mini(length, frame_count() - first)
	if format == 3 and bits == 32 and channels == 1:
		return data.slice(first * stride, (first + n) * stride).to_float32_array()
	var out := PackedFloat32Array()
	out.resize(n)
	for i in n:
		var sum := 0.0
		for channel in channels:
			var at := (first + i) * stride + channel * width
			if format == 3:
				sum += data.decode_float(at) if bits == 32 else data.decode_double(at)
			else:
				match bits:
					8: sum += (data[at] - 128) / 128.0
					16: sum += data.decode_s16(at) / 32768.0
					24:
						var value := data[at] | (data[at + 1] << 8) | (data[at + 2] << 16)
						if value & 0x800000: value -= 0x1000000
						sum += value / 8388608.0
					32: sum += data.decode_s32(at) / 2147483648.0
		out[i] = sum / channels
	return out
