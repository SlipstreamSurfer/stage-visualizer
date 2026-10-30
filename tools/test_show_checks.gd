extends SceneTree
# Prove the checker rejects deliberately wrong outputs, not only a good replay.
func _initialize() -> void:
	for name in ["sv_beat", "sv_energy", "sv_hands", "sv_haze", "sv_phones"]:
		RenderingServer.global_shader_parameter_add(name, RenderingServer.GLOBAL_VAR_TYPE_FLOAT, 0.0)
	var rig := Rig.new()
	var hall := Hall.new()
	var listen := Listen.new()
	var rb := Rekordbox.new()
	seed(19)
	var show := Show.new(rig, hall)
	show.source = "fixture"
	show.title = "Test"
	show.bpm = 120.0
	var good := ShowChecks.new()
	listen.ev_drop = true
	show.section = "peak"
	show.dropped = true
	good.before(listen, rb)
	good.observe(0.05, show, rb)
	assert(good.report().passed and good.report().matched_drops == 1)
	var late := ShowChecks.new()
	show.dropped = false
	late.before(listen, rb)
	late.observe(0.05, show, rb)
	assert(not late.report().passed and late.failures[0].rule == "drop_timing")
	listen.ev_drop = false
	var dark := ShowChecks.new()
	rig.fixtures.append(Rig.Fixture.new())
	show.section = "groove"
	for n in 50: dark.observe(0.1, show, rb)
	assert(not dark.report().passed and dark.failures[0].rule == "dark")
	rig.fixtures.clear()
	var jitter := ShowChecks.new()
	for section in ["groove", "break", "groove"]:
		show.section = section
		jitter.observe(0.1, show, rb)
		if jitter.section_changes == 1: jitter.observe(10.0, show, rb)
	assert(not jitter.report().passed and jitter.failures[0].rule == "section_jitter")
	var repeated := ShowChecks.new()
	for look in [["A"], ["B"], ["A"], ["B"]]:
		show.hall_look = look
		repeated.observe(0.1, show, rb)
	assert(not repeated.report().passed and repeated.report().failures[-1].rule == "variation")
	listen.section = "groove"
	listen.phase = "groove"
	listen.bpm = 128.0
	show.genre = "house"
	show.update(0.1, listen, rb)
	assert(show.mood_key == "house")
	show.genre = "techno-raw-deep-hypnotic"
	show.update(0.1, listen, rb)
	assert(show.mood_key == "raw")
	show.genre = "hard-techno"
	show.update(0.1, listen, rb)
	assert(show.mood_key == "hard")
	rig.free()
	hall.free()
	listen.free()
	rb.free()
	print("show checks: good drop accepted; wrong outputs rejected; a dark room is caught; genre changes the mood at once")
	quit()
