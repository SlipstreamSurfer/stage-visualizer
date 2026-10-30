class_name Rekordbox
extends Node
# Rekordbox through rkbx_link, straight into the show: the same OSC messages SV's bridge reads
# (tools/rekordbox-bridge.mjs), on UDP 4460. The master deck if it is sent, otherwise deck 1.
# What it adds over listening: the tempo and the beat exactly, the track, and the phrases with how many beats
# to the next one, so the show can see a drop coming.

const TEXT_FIELDS := ["track/id", "track/title", "track/artist", "track/album"]
const NUMBER_FIELDS := ["bpm/current", "bpm/original", "time", "transport/playing",
	"phrase/countin", "phrase/available", "phrase/index", "phrase/start", "phrase/end",
	"beat/subdiv/1", "beat/position"]
const MAX_DEPTH := 8
const MAX_MESSAGES := 256

var port := 4460
var listening := false
var error := ""
var last_packet := -10.0
var fields := {}         # "master/bpm/current" -> value
var packets := 0
var sender_ip := ""
var _udp := PacketPeerUDP.new()
var _clock := 0.0
var replaying := false
var replay_live := false

func start(p: int) -> void:
	stop()
	port = clampi(p, 1, 65535)
	var e := _udp.bind(port, "*")
	listening = e == OK
	if not listening: error = "UDP %d is in use (is SV's server running?)" % port

func stop() -> void:
	_udp.close()
	listening = false
	error = ""
	last_packet = -10.0
	fields.clear()
	packets = 0
	sender_ip = ""
	replaying = false
	replay_live = false

func _exit_tree() -> void:
	stop()

func live() -> bool:
	if replaying: return replay_live
	return listening and _clock - last_packet < 1.5

func status() -> Dictionary:
	return {"connected": live(), "sender_ip": sender_ip, "packets": packets,
		"deck": deck(), "seconds_since": maxf(0.0, _clock - last_packet) if packets > 0 else -1.0,
		"listening": listening, "port": port, "error": error}

var active := ""          # the deck the show follows (set by the show); "" = master if sent, else deck 1

func deck() -> String:
	if active != "": return active
	return "master" if fields.has("master/bpm/current") else "1"

func value(field: String, default = null):
	var result = fields.get(deck() + "/" + field, default)
	return phrase_name(result) if field in ["phrase/current", "phrase/next"] else result

# rkbx_link sends either full names or the lossy numeric phrase family (1..5).
# Family 2 cannot distinguish Verse from Up; request string output for exact builds.
static func phrase_name(raw: Variant) -> String:
	if raw == null: return ""
	var text := str(raw).strip_edges()
	if text.is_valid_float():
		var number := float(text)
		if not is_finite(number) or number != floorf(number): return ""
		return {1: "Intro", 2: "Verse", 3: "Chorus", 4: "Bridge", 5: "Outro"}.get(int(number), "")
	return text

func update(dt: float) -> void:
	if replaying: return
	_clock += dt
	if not listening: return
	while _udp.get_available_packet_count() > 0:
		if _read(_udp.get_packet()):
			last_packet = _clock
			sender_ip = _udp.get_packet_ip()
			packets += 1

func _read(p: PackedByteArray) -> bool:
	var messages := []
	if not _decode(p, messages): return false
	var accepted := false
	for message in messages:
		var key: String = message[0].trim_prefix("/")
		if not _valid_value(key, message[1]): continue
		fields[key] = message[1]
		accepted = true
	return accepted

# Validate a whole packet before changing fields, including nested bundles.
static func _decode(p: PackedByteArray, messages: Array, depth := 0) -> bool:
	if depth > MAX_DEPTH or p.is_empty() or p.size() % 4 != 0: return false
	if p.slice(0, 8) == PackedByteArray([35, 98, 117, 110, 100, 108, 101, 0]):
		if p.size() < 16: return false
		var o := 16
		while o < p.size():
			if o + 4 > p.size(): return false
			var n := _int(p, o)
			o += 4
			if n <= 0 or o + n > p.size(): return false
			if not _decode(p.slice(o, o + n), messages, depth + 1): return false
			o += n
		return true
	var address := _string(p, 0)
	if address.is_empty() or not address[0].begins_with("/"): return false
	var tags := _string(p, address[1])
	if tags.is_empty() or tags[0] not in [",f", ",i", ",s"]: return false
	var o: int = tags[1]
	var v
	if tags[0] == ",s":
		var text := _string(p, o)
		if text.is_empty(): return false
		v = text[0]
		o = text[1]
	else:
		if o + 4 > p.size(): return false
		if tags[0] == ",f":
			v = _float(p, o)
			if not is_finite(v): return false
		else: v = _int(p, o)
		o += 4
	if o != p.size() or messages.size() >= MAX_MESSAGES: return false
	messages.append([address[0], v])
	return true

static func _valid_value(key: String, value: Variant) -> bool:
	var deck_id := key.get_slice("/", 0)
	if deck_id not in ["master", "1", "2", "3", "4"]: return false
	if not key.begins_with(deck_id + "/"): return false
	var field := key.substr(deck_id.length() + 1)
	if field in TEXT_FIELDS: return value is String
	if field in ["phrase/current", "phrase/next"]:
		return value is String or ((value is float or value is int) and is_finite(float(value)))
	if field not in NUMBER_FIELDS or not (value is float or value is int): return false
	if not is_finite(float(value)): return false
	if field in ["transport/playing", "phrase/available"]: return value == 0 or value == 1
	if field in ["phrase/index", "phrase/start", "phrase/end"]: return float(value) == floorf(float(value))
	if field.begins_with("bpm/"): return value >= 0 and value <= 1000
	if field == "beat/subdiv/1": return value >= 0 and value <= 1
	return true

static func _padded(n: int) -> int:
	return (n + 3) & ~3

static func _string(p: PackedByteArray, o: int) -> Array:
	var end := o
	while end < p.size() and p[end] != 0: end += 1
	if end == p.size(): return []
	var next := _padded(end + 1)
	if next > p.size(): return []
	for i in range(end, next):
		if p[i] != 0: return []
	if not _valid_utf8(p, o, end): return []
	return [p.slice(o, end).get_string_from_utf8(), next]

# Check before decoding so bad network bytes cannot produce engine errors.
static func _valid_utf8(p: PackedByteArray, start: int, end: int) -> bool:
	var i := start
	while i < end:
		var first := p[i]
		if first < 0x80:
			i += 1
			continue
		var width := 0
		if first >= 0xc2 and first <= 0xdf: width = 2
		elif first >= 0xe0 and first <= 0xef: width = 3
		elif first >= 0xf0 and first <= 0xf4: width = 4
		if width == 0 or i + width > end: return false
		for j in range(i + 1, i + width):
			if p[j] < 0x80 or p[j] > 0xbf: return false
		if first == 0xe0 and p[i + 1] < 0xa0: return false
		if first == 0xed and p[i + 1] >= 0xa0: return false
		if first == 0xf0 and p[i + 1] < 0x90: return false
		if first == 0xf4 and p[i + 1] > 0x8f: return false
		i += width
	return true

static func _be(p: PackedByteArray, o: int) -> PackedByteArray:
	return PackedByteArray([p[o + 3], p[o + 2], p[o + 1], p[o]])

static func _float(p: PackedByteArray, o: int) -> float:
	return _be(p, o).decode_float(0)

static func _int(p: PackedByteArray, o: int) -> int:
	return _be(p, o).decode_s32(0)
