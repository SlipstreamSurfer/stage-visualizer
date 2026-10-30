extends SceneTree
# The DJ's own buttons work on top of the automatic show, and a controller can be taught without a device.

func _initialize() -> void:
	for name in ["sv_beat", "sv_energy", "sv_hands", "sv_haze", "sv_phones"]:
		RenderingServer.global_shader_parameter_add(name, RenderingServer.GLOBAL_VAR_TYPE_FLOAT, 0.0)
	var rig := Rig.new()
	root.add_child(rig)
	rig.build()
	var hall := Hall.new()
	var listen := Listen.new()
	var rb := Rekordbox.new()
	seed(5)
	var show := Show.new(rig, hall, {"genre": "techno-peak-time-driving", "seed": 5})
	var failed := []
	var frame := func(n: int) -> void:
		for i in n:
			listen.bpm = 128.0
			listen.beat += 128.0 / 60.0 / 20.0
			listen.source = "fixture"
			listen.section = "groove"
			listen.phase = "groove"
			listen.energy = 0.7
			listen.bass = 0.6
			listen.mid = 0.5
			listen.kick = int(floorf(listen.beat)) != int(floorf(listen.beat - 128.0 / 60.0 / 20.0))
			listen.since_kick = fposmod(listen.beat, 1.0)
			show.update(0.05, listen, rb)
	var lit := func() -> int:
		var n := 0
		for f in rig.fixtures:
			if f.level > 0.003: n += 1
		for b in rig.battens:
			if maxf(b.level, b.strobe) > 0.003: n += 1
		return n
	frame.call(200)
	if lit.call() == 0: failed.append("the show is dark before any button")
	# blackout: everything dark, and the show goes on afterwards
	show.manual.blackout = true
	frame.call(5)
	if lit.call() != 0 or rig.strobe > 0.0 or rig.blinder > 0.0: failed.append("blackout leaves light on")
	show.manual.blackout = false
	frame.call(40)
	if lit.call() == 0: failed.append("the show does not come back after a blackout")
	# strobe while held: the hall flashes, and stops when let go
	show.manual.strobe = true
	var flashes := 0
	for i in 20:
		frame.call(1)
		if rig.strobe > 0.0: flashes += 1
	if flashes < 5 or flashes > 15: failed.append("strobe flashed %d of 20 frames" % flashes)
	show.manual.strobe = false
	frame.call(20)
	if rig.strobe > 0.0: failed.append("strobe goes on after it is let go")
	# blinders while held
	show.manual.blinder = true
	frame.call(2)
	if rig.blinder < 0.9: failed.append("blinders do not light: %.2f" % rig.blinder)
	show.manual.blinder = false
	frame.call(40)
	if rig.blinder > 0.05: failed.append("blinders stay on")
	# next look: a new scene at once
	var scene_before := show._scene
	show.manual.looks += 1
	frame.call(1)
	if show._scene != scene_before + 1: failed.append("next look did not start a new scene")
	# the controller: learn a pad, press it, let it go; kept in its file
	var midi := MidiControls.new()
	midi.path = "user://test_midi.cfg"
	DirAccess.remove_absolute(ProjectSettings.globalize_path(midi.path))
	var events := []
	midi.pressed.connect(func(a): events.append("+" + a))
	midi.released.connect(func(a): events.append("-" + a))
	var note := func(pitch: int, velocity: int) -> InputEventMIDI:
		var e := InputEventMIDI.new()
		e.message = MIDI_MESSAGE_NOTE_ON
		e.channel = 6
		e.pitch = pitch
		e.velocity = velocity
		return e
	midi.handle(note.call(36, 100))   # not linked yet: nothing
	midi.learn("strobe")
	midi.handle(note.call(36, 100))   # teaches pad 36
	midi.handle(note.call(36, 0))     # its release
	midi.handle(note.call(36, 100))
	midi.handle(note.call(36, 0))
	midi.handle(note.call(37, 100))   # another pad: nothing
	if events != ["+strobe", "-strobe"]: failed.append("MIDI events: " + str(events))
	var cc := InputEventMIDI.new()
	cc.message = MIDI_MESSAGE_CONTROL_CHANGE
	cc.controller_number = 20
	cc.controller_value = 127
	midi.learn("blackout")
	midi.handle(cc)
	var again := MidiControls.new()
	again.path = midi.path
	again._load()
	if again.label("strobe").is_empty() or again.label("strobe") == "not linked" or again.label("blackout") == "not linked":
		failed.append("links are not kept: %s / %s" % [again.label("strobe"), again.label("blackout")])
	DirAccess.remove_absolute(ProjectSettings.globalize_path(midi.path))
	midi.free()
	again.free()
	rig.free()
	hall.free()
	listen.free()
	rb.free()
	if failed.is_empty(): print("controls: blackout, strobe, blinders and next look work over the show; a pad is learned, pressed, released and kept")
	else: printerr("controls: ", failed)
	quit(0 if failed.is_empty() else 1)
