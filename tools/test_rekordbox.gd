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
	_test_track_phrases()
	rb.free()
	if "--udp" in OS.get_cmdline_user_args(): await _test_udp()
	print("rekordbox: %d checks, %d failures" % [checks, failures])
	quit(0 if failures == 0 else 1)

# Synthetic OSC reaches both the receiver and the actual show decisions.
func _test_track_phrases() -> void:
	for name in ["sv_beat", "sv_energy", "sv_hands", "sv_haze", "sv_phones"]:
		RenderingServer.global_shader_parameter_add(name, RenderingServer.GLOBAL_VAR_TYPE_FLOAT, 0.0)
	var rb := Rekordbox.new()
	rb.replaying = true
	rb.replay_live = true
	var rig := Rig.new()
	var hall := Hall.new()
	var listen := Listen.new()
	var show := Show.new(rig, hall, {"genre": "house"})
	var send := func(deck: String, field: String, value: Variant) -> void:
		check(rb._read(message("/" + deck + "/" + field, value)), "Accept %s/%s" % [deck, field])
	var tick := func() -> void: show.update(0.1, listen, rb)
	for item in [["track/title", "Track A"], ["bpm/current", 128.0], ["phrase/available", 1],
		["phrase/current", "Up"], ["phrase/next", "Chorus"], ["phrase/countin", 0.5]]:
		send.call("1", item[0], item[1])
	for item in [["track/title", "Other"], ["phrase/available", 1], ["phrase/current", "Outro"],
		["phrase/next", "Chorus"], ["phrase/countin", 12.0]]:
		send.call("2", item[0], item[1])
	tick.call()
	check(show.section == "build" and show.blackout == 1.0, "Initial valid Up/countdown reaches the show")
	var other_before := rb.fields.duplicate(true)
	send.call("1", "track/title", "Track A")
	tick.call()
	check(show.phrase == "Up" and show.countin == 0.5 and show.blackout == 1.0, "Repeated title keeps phrase and countdown")
	send.call("1", "phrase/available", 0)
	tick.call()
	check(show.phrase == "" and show.countin == -1.0 and show.blackout == 0.0, "Unavailable clears an active phrase on the same track")
	send.call("1", "phrase/available", 1)
	for item in [["phrase/current", "Up"], ["phrase/next", "Chorus"], ["phrase/countin", 0.5]]:
		send.call("1", item[0], item[1])
	tick.call()
	check(show.blackout == 1.0, "Analysis resumes on the same track")
	send.call("1", "track/title", "Track B")
	check(not rb.fields.has("1/phrase/current") and not rb.fields.has("1/phrase/next") and not rb.fields.has("1/phrase/countin"), "Changed title clears old phrase data immediately")
	for key in other_before:
		if str(key).begins_with("2/"): check(rb.fields.get(key) == other_before[key], "Other deck retains " + key)
	send.call("1", "phrase/available", 0)
	tick.call()
	check(show.phrase == "" and show.next_phrase == "" and show.countin == -1.0, "Unavailable analysis has no phrase or countdown")
	check(show.blackout == 0.0 and show.section == "groove" and show.build == 0.0, "Missing analysis falls back to groove without inherited blackout")
	# A partial phrase packet cannot predict a blackout before the current phrase arrives.
	send.call("1", "phrase/available", 1)
	send.call("1", "phrase/next", "Chorus")
	send.call("1", "phrase/countin", 0.5)
	tick.call()
	check(show.phrase == "" and show.blackout == 0.0 and show.build == 0.0, "Partial phrase analysis cannot trigger a blackout")
	send.call("1", "phrase/available", 0)
	# Unavailable is authoritative even if old or late phrase messages arrive.
	for item in [["phrase/current", "Up"], ["phrase/next", "Chorus"], ["phrase/countin", 0.5]]:
		send.call("1", item[0], item[1])
	tick.call()
	check(show.phrase == "" and show.next_phrase == "" and show.countin == -1.0 and show.blackout == 0.0, "Unavailable rejects late phrase data")
	send.call("1", "phrase/available", 1)
	tick.call()
	check(show.phrase == "" and show.countin == -1.0 and show.blackout == 0.0, "Availability alone does not resurrect a prior phrase")
	for item in [["phrase/current", "Up"], ["phrase/next", "Chorus"], ["phrase/countin", 0.5]]:
		send.call("1", item[0], item[1])
	tick.call()
	check(show.section == "build" and show.blackout == 1.0 and show.build > 0.9, "Fresh analysis can build and black out")
	send.call("1", "phrase/current", "Chorus")
	tick.call()
	check(show.section == "peak" and show.dropped and show.blackout == 0.0, "Valid transition into Chorus still drops")
	send.call("1", "track/id", "id-a")
	send.call("1", "track/id", "id-a")
	check(rb.value("phrase/current") == "Chorus", "Initial and repeated ID keep current track's phrase")
	send.call("1", "track/id", "id-b")
	tick.call()
	check(show.phrase == "" and show.next_phrase == "" and show.countin == -1.0 and show.blackout == 0.0, "Changed ID clears phrase with unchanged title")
	# Replay may supply raw unavailable fields directly; consumers must still ignore them.
	rb.fields["1/phrase/available"] = 0
	rb.fields["1/phrase/current"] = "Up"
	rb.fields["1/phrase/next"] = "Chorus"
	rb.fields["1/phrase/countin"] = 0.5
	tick.call()
	check(show.phrase == "" and show.blackout == 0.0, "Unavailable replay fields cannot trigger blackout")
	# Unknown phrases must not look like a transition on an incoming deck.
	rb.fields.clear()
	rb.active = "1"
	for item in [["1", "track/title", "First"], ["1", "transport/playing", 1],
		["1", "phrase/current", "Outro"], ["2", "track/title", "Second"],
		["2", "transport/playing", 1], ["2", "phrase/current", "Verse"]]:
		send.call(item[0], item[1], item[2])
	show._deck_seen.clear()
	show.playing.clear()
	show._deck_phrase.clear()
	show._choose_deck(0.1, rb)
	show._rb_clock = 60.0
	show._both_from = 0.0
	rb.fields["2/phrase/available"] = 0
	rb.fields["2/phrase/current"] = "Chorus"   # raw legacy replay data
	show._choose_deck(0.1, rb)
	check(rb.active == "1", "Unavailable incoming phrase does not trigger a deck switch")
	rb.fields.erase("2/phrase/current")
	send.call("2", "phrase/available", 1)
	send.call("2", "phrase/current", "Chorus")
	show._choose_deck(0.1, rb)
	check(rb.active == "1", "The first newly available phrase is not a transition")
	send.call("2", "phrase/current", "Verse")
	show._choose_deck(0.1, rb)
	check(rb.active == "2", "A later valid incoming phrase transition switches decks")
	rig.free()
	hall.free()
	listen.free()
	rb.free()

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
