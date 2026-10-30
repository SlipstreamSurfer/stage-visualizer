class_name ShowChecks
extends RefCounted
# Session assertions, independent of wall-clock speed. Missing coverage is explicit.
var failures := []
var failure_count := 0
var frames := 0
var time := 0.0
var expected_drops := 0
var matched_drops := 0
var section_changes := 0
var looks := 0
var _input_drop := false
var _identity := ""
var _section := ""
var _phrase := ""
var _sections := []
var _look := ""
var _unique := {}
var _lit_sum := 0.0
var _lit_max := 0.0
var _cast_frames := 0
var _rest_frames := 0
var _dark_for := 0.0

func before(listen: Listen, rb: Rekordbox) -> void:
	_input_drop = listen.ev_drop and not rb.live()

func observe(dt: float, show: Show, rb: Rekordbox) -> void:
	time += dt
	frames += 1
	var identity := show.source + "|" + show.title + "|" + (rb.deck() if rb.live() else "")
	if identity != _identity:
		_identity = identity
		_sections.clear()
		_section = ""
		_phrase = ""
	var phrase := Rekordbox.phrase_name(rb.value("phrase/current", "")).to_lower() if rb.live() else ""
	var chorus := phrase.begins_with("chorus") and not _phrase.begins_with("chorus") and _section in ["break", "build"]
	if show.forced == "" and (_input_drop or chorus):
		expected_drops += 1
		if show.dropped and show.section == "peak": matched_drops += 1
		else: fail("drop_timing", "Expected a drop on this input frame")
	_phrase = phrase
	if show.section != _section:
		section_changes += 1
		if _sections.size() >= 2 and not show.dropped:
			var earlier: Dictionary = _sections[_sections.size() - 2]
			var excursion: Dictionary = _sections.back()
			if earlier.section == show.section and time - excursion.t < 8.0 * 60.0 / maxf(show.bpm, 60.0):
				fail("section_jitter", "%s → %s → %s within eight beats" % [earlier.section, _section, show.section])
		_sections.append({"section": show.section, "t": time})
		if _sections.size() > 3: _sections.pop_front()
		_section = show.section
	# A look: the heads' look, the trusses' formation, the stage row and the program.
	var signature := JSON.stringify(show.hall_look) + "|" + str(show.PROGRAMS[show._program].name)
	if signature != _look:
		_look = signature
		_unique[signature] = true
		looks += 1
	for fixture in show.rig.fixtures:
		if not is_finite(fixture.level) or fixture.level < 0.0 or not fixture.target.is_finite():
			fail("fixture", "Non-finite target or invalid intensity")
			break
	var cast_size := show.rig.fixtures.size() + show.rig.battens.size()
	if cast_size > 0:
		var lit := 0
		for fixture in show.rig.fixtures:
			if fixture.level > 0.003: lit += 1
		for batten in show.rig.battens:
			if maxf(batten.level, batten.strobe) > 0.003: lit += 1
		var share := float(lit) / cast_size
		_lit_sum += share
		_lit_max = maxf(_lit_max, share)
		_cast_frames += 1
		if lit == 0: _rest_frames += 1
		# the music plays and the hall stays black: that is an empty room, not a show
		if lit == 0 and show.section in ["groove", "peak"] and show.blackout == 0.0: _dark_for += dt
		else: _dark_for = 0.0
		if _dark_for > 4.0 and _dark_for - dt <= 4.0: fail("dark", "The rig is black for four seconds while the music grooves")

func fail(rule: String, message: String) -> void:
	failure_count += 1
	if failures.size() < 50: failures.append({"rule": rule, "frame": frames - 1, "t": time, "message": message})

func report() -> Dictionary:
	var enough := looks >= 3
	var varied := _unique.size() >= 3
	var count := failure_count + (1 if enough and not varied else 0)
	var issues := failures.duplicate()
	if enough and not varied: issues.append({"rule": "variation", "message": "Fewer than three different looks"})
	return {"passed": count == 0, "frames": frames, "seconds": time, "failures": issues,
		"failure_count": count, "expected_drops": expected_drops, "matched_drops": matched_drops,
		"section_changes": section_changes, "looks": looks, "unique_looks": _unique.size(),
		"mean_lit": _lit_sum / maxf(1, _cast_frames), "max_lit": _lit_max, "rest_frames": _rest_frames,
		"coverage": {"drop_timing": expected_drops > 0, "variation": enough,
			"section_jitter": section_changes >= 3, "dark": frames > 0}}
