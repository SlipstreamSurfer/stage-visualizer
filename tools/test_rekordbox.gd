extends SceneTree
# Real OSC bytes, malformed datagrams and optional loopback UDP (-- --udp).

var failures := 0
var checks := 0

func check(ok: bool, message: String) -> void:
	checks += 1
	if not ok:
		failures += 1
		printerr(message)

func osc_string(value: String) -> PackedByteArray:
	var bytes := value.to_utf8_buffer()
	bytes.resize((bytes.size() + 4) & ~3)
	return bytes

func number(value: Variant, integer := false) -> PackedByteArray:
	var bytes := PackedByteArray()
	bytes.resize(4)
	if integer: bytes.encode_s32(0, int(value))
	else: bytes.encode_float(0, float(value))
	bytes.reverse()
	return bytes

func message(address: String, value: Variant, integer := false) -> PackedByteArray:
	var tag := ",s" if value is String else (",i" if integer else ",f")
	var body := osc_string(value) if value is String else number(value, integer)
	return osc_string(address) + osc_string(tag) + body

func bundle(elements: Array) -> PackedByteArray:
	var bytes := osc_string("#bundle")
	bytes.resize(16)
	bytes[15] = 1 # immediate timetag
	for element in elements:
		bytes.append_array(number(element.size(), true))
		bytes.append_array(element)
	return bytes

func reject(rb: Rekordbox, packet: PackedByteArray, label: String) -> void:
	var before := rb.fields.duplicate(true)
	check(not rb._read(packet), "Accepted " + label)
	check(rb.fields == before, "Changed fields for " + label)

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var rb := Rekordbox.new()
	var bpm := message("/1/bpm/current", 124.125)
	check(rb._read(bpm), "Read BPM")
	check(rb.fields["1/bpm/current"] == 124.125, "Big-endian float")
	check(rb._read(message("/master/track/title", "Beyoncé · 曲 🌊")), "Read Unicode title")
	check(rb.fields["master/track/title"] == "Beyoncé · 曲 🌊", "Exact UTF-8 title")
	check(rb._read(message("/2/phrase/current", 3, true)), "Read integer phrase")
	check(rb.fields["2/phrase/current"] is int, "Preserve OSC int")
	rb.active = "2"
	check(rb.value("phrase/current") == "Chorus", "Numeric phrase name")
	check(rb._read(message("/2/phrase/current", "Up 1")), "Read string phrase")
	check(rb.value("phrase/current") == "Up 1", "Exact string phrase")
	check(rb._read(message("/4/time", -0.5)), "Keep signed track positions")
	check(rb._read(message("/1/phrase/countin", -1.0)), "Keep absent phrase sentinel")
	check(rb._read(message("/1/track/title", "")), "Allow empty track metadata")
	check(rb._read(bundle([bpm, bundle([message("/1/phrase/next", "Chorus 1")])])), "Nested bundle")
	check(rb.fields["1/phrase/next"] == "Chorus 1", "Nested bundle value")
	check(rb._read(bundle([message("/1/time", 1.0), message("/1/time", 2.0)])), "Repeated bundle address")
	check(rb.fields["1/time"] == 2.0, "Preserve bundle order")
	for size in bpm.size(): reject(rb, bpm.slice(0, size), "truncated float %d" % size)
	var bad_padding := bpm.duplicate()
	bad_padding[15] = 1
	reject(rb, bad_padding, "nonzero address padding")
	bad_padding = bpm.duplicate()
	bad_padding[19] = 1
	reject(rb, bad_padding, "nonzero tag padding")
	reject(rb, bpm + PackedByteArray([0, 0, 0, 0]), "extra argument bytes")
	reject(rb, osc_string("/1/bpm/current") + osc_string(",ff") + number(120) + number(121), "multiple arguments")
	reject(rb, osc_string("/1/bpm/current") + osc_string(",x") + number(120), "unsupported tag")
	reject(rb, osc_string("1/bpm/current") + osc_string(",f") + number(120), "missing address slash")
	reject(rb, osc_string("/1/bpm/current") + osc_string("f") + number(120), "missing tag comma")
	for value in [NAN, INF, -INF]:
		reject(rb, message("/1/bpm/current", value), "nonfinite BPM")
	for value in [-1.0, 1001.0, "not a tempo"]:
		reject(rb, message("/1/bpm/current", value), "invalid BPM value")
	for pair in [["track/title", 123], ["beat/subdiv/1", 1.1], ["transport/playing", 2],
		["phrase/available", -1], ["phrase/index", 1.5], ["time", "no"]]:
		reject(rb, message("/1/" + pair[0], pair[1]), "wrong field type/range")
	reject(rb, message("/other/control", 1), "unrelated OSC address")
	reject(rb, message("/5/bpm/current", 120), "unknown deck")
	reject(rb, message("/1/unknown", 1), "unknown field")
	reject(rb, message("/1", 1), "missing field path")
	reject(rb, message("/1/", 1), "empty field path")
	for bytes in [[0x80], [0xc0, 0xaf], [0xe0, 0x80, 0x80], [0xed, 0xa0, 0x80],
		[0xf0, 0x80, 0x80, 0x80], [0xf4, 0x90, 0x80, 0x80], [0xf5, 0x80, 0x80, 0x80], [0xc2]]:
		var text := PackedByteArray(bytes)
		text.resize((text.size() + 4) & ~3)
		reject(rb, osc_string("/1/track/title") + osc_string(",s") + text, "invalid UTF-8")
	var bad_message := osc_string("/1/bpm/current") + osc_string(",f")
	reject(rb, bundle([message("/1/bpm/current", 130), bad_message]), "partly corrupt bundle")
	var header := bundle([])
	reject(rb, header, "empty bundle heartbeat")
	reject(rb, header.slice(0, 8), "missing bundle timetag")
	for size in [0, -4, 1000000, 5]:
		reject(rb, header + number(size, true) + bpm, "invalid bundle element size")
	var nested := bpm
	for i in 8: nested = bundle([nested])
	check(rb._read(nested), "Accept eight bundle levels")
	reject(rb, bundle([nested]), "excessive bundle depth")
	var many := []
	for i in 256: many.append(bpm)
	check(rb._read(bundle(many)), "Accept 256 messages")
	many.append(bpm)
	reject(rb, bundle(many), "excessive message count")
	seed(3841)
	for i in 2000:
		var bytes := PackedByteArray()
		bytes.resize(randi_range(0, 128))
		for j in bytes.size(): bytes[j] = randi_range(0, 255)
		reject(rb, bytes, "random datagram %d" % i)
	rb.free()
	if "--udp" in OS.get_cmdline_user_args(): await _test_udp()
	print("rekordbox: %d checks, %d failures" % [checks, failures])
	quit(0 if failures == 0 else 1)

func _test_udp() -> void:
	var probe := PacketPeerUDP.new()
	if probe.bind(0, "127.0.0.1") != OK:
		check(false, "Cannot bind loopback probe")
		return
	var port := probe.get_local_port()
	probe.close()
	var rb := Rekordbox.new()
	rb.start(port)
	check(rb.listening and not rb.live(), "Listening without a packet is not live")
	if not rb.listening:
		rb.free()
		return
	var sender := PacketPeerUDP.new()
	check(sender.set_dest_address("127.0.0.1", port) == OK, "UDP destination")
	check(sender.put_packet(message("/1/bpm/current", 124)) == OK, "Send valid UDP")
	await create_timer(0.05).timeout
	rb.update(0.1)
	check(rb.live() and rb.packets == 1, "Valid packet starts live connection")
	check(rb.fields.get("1/bpm/current") == 124, "Live UDP value")
	check(rb.status().connected and rb.status().sender_ip == "127.0.0.1" and rb.status().seconds_since == 0.0, "Receiver status includes accepted sender")
	var last := rb.last_packet
	var before := rb.fields.duplicate(true)
	sender.put_packet(osc_string("/1/bpm/current") + osc_string(",f"))
	sender.put_packet(message("/other/control", 1))
	sender.put_packet(message("/1/bpm/current", "no"))
	sender.put_packet(bundle([]))
	await create_timer(0.05).timeout
	rb.update(1.6)
	check(not rb.live(), "Invalid traffic cannot keep the connection live")
	check(rb.packets == 1 and rb.last_packet == last, "Only accepted datagrams count")
	check(rb.fields == before, "Invalid UDP leaves source values intact")
	check(not rb.status().connected and rb.status().sender_ip == "127.0.0.1", "Status exposes timeout without losing sender")
	sender.put_packet(bundle([message("/1/bpm/current", 128), message("/1/phrase/current", "Chorus 1")]))
	await create_timer(0.05).timeout
	rb.update(0.1)
	check(rb.live() and rb.packets == 2, "Valid traffic reconnects")
	check(rb.fields.get("1/phrase/current") == "Chorus 1", "Live bundle value")
	rb.stop()
	check(not rb.live() and rb.fields.is_empty(), "Stop clears receiver")
	check(rb.status().sender_ip == "" and rb.status().seconds_since == -1.0, "Stop clears sender status")
	sender.close()
	rb.free()
