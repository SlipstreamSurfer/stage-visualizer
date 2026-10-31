class_name ShowMusic
extends ShowGenres
# Reading the music: SV's listening, or rekordbox (decks, phrases, mixes), into parts, beats and drops.

func update(dt: float, listen: Listen, rb: Rekordbox) -> void:
	dropped = false
	var was := section
	if rb.live(): _from_rekordbox(dt, rb, listen)
	else: _from_listening(listen)
	if forced != "":
		section = forced
		if forced == "build": build = 0.8
	if section != was:
		_drop_open = false
		_section_from = beat
		if section == "peak" and was in ["break", "build"]:
			drop = 1.0
			dropped = true
			_drop_open = true
			_drops += 1
			_drop_beat = beat
			note("drop")
		else: note(section)
		_pick(true)
	elif _drop_open and beat - _drop_beat >= drop_open_beats():
		_drop_open = false
		_pick(false)   # a short opening hit, then leave room again
	elif _look_genre != genre or _look_family != str(_g().family):
		_pick(true)
	elif rb.live() and phrase != "" and _phrase_turn:
		_pick(true)
	elif beat - _look_from >= LOOK_BEATS[section] * float(tune.look) and fposmod(beat, 16.0) < 0.5: _pick(false)   # a look stands 8 to 16 bars, and changes on a phrase
	_swap = int(floorf((beat - _look_from) / 32.0)) % 2 == 1   # the colours trade places every eight bars
	drop = maxf(0.0, drop - dt * bpm / 60.0 / 4.0)
	if _drop_beat >= 0.0 and beat - _drop_beat > 32.0: _drop_beat = -100.0
	if kick:
		_kicks += 1
		if _kicks % 8 == 0:
			for f in rig.fixtures:
				f.rp = randf()
				f.rt = randf()
	_light(dt)

# --- reading the music ---

func _from_listening(l: Listen) -> void:
	beat = l.beat - l.bar_offset + l.latency * l.bpm / 60.0   # counted from a bar's first beat, and as the sound is now
	bpm = l.bpm
	kick = l.kick
	since_kick = l.since_kick
	energy = l.energy
	source = l.source
	phrase = ""
	blackout = 0.0
	if l.track_changed:
		l.track_changed = false
		_new_track(l.title)
	if l.section != "":   # SV's listening (listen.js): its parts, its build, its drop
		build = l.build
		if l.ev_drop: section = "peak"
		elif l.phase == "break": section = "build" if l.build > 0.35 else "break"
		else: section = {"intro": "intro", "groove": "groove", "low": "groove", "peak": "peak", "break": "break"}.get(l.section, "groove")
		return
	# the show's own judgement, until then: a part holds for eight bars at least, except a drop
	var held := beat - _section_from >= 32.0
	match section:
		"intro":
			if beat > 32.0 and since_kick < 2.0: section = "groove"
		"groove", "peak":
			if since_kick > 8.0 and beat > 16.0 and held:
				section = "break"
				_break_from = beat
			elif section == "peak" and beat > _peak_until: section = "groove"
		"break", "build":
			var long_ := beat - _break_from
			build = clampf((l.energy - 0.35) * 1.5 + long_ / 96.0, 0.0, 1.0)
			if section == "break" and build > 0.5 and held: section = "build"
			if since_kick < 0.6 and long_ > 16.0:
				section = "peak"
				_peak_until = beat + 64.0
				build = 0.0

# Rekordbox's phrases: Intro, Verse, Up, Chorus, Down, Bridge, Outro, and the beats to the next one.
func _from_rekordbox(dt: float, rb: Rekordbox, l: Listen) -> void:
	_choose_deck(dt, rb)
	source = "rekordbox" + (" + audio" if l.source != "none" else "")
	bpm = float(rb.value("bpm/current", bpm))
	var t := str(rb.value("track/title", ""))
	if t != title:
		var mixed_in := t == incoming and incoming != ""
		_outgoing = title
		_new_track(t)
		l.notify_track(t)   # the listening starts its references afresh for the new track
		if mixed_in: _pick(true)   # the new track has the decks: a new scene on its first beat
		if _log: print("rekordbox: %s is master%s" % [t, " (mixed in)" if mixed_in else ""])
	_watch_mix(rb)
	_rb_beat += dt * bpm / 60.0
	var sub = rb.value("beat/subdiv/1")
	if sub != null:
		var s := float(sub)
		_rb_beat = floorf(_rb_beat - s + 0.5) + s
	beat = _rb_beat
	var whole := int(floorf(beat))
	kick = whole != _rb_whole and int(rb.value("transport/playing", 1)) == 1
	_rb_whole = whole
	since_kick = beat - whole
	energy = l.energy if l.source != "none" else (0.85 if section == "peak" else 0.6)
	phrase = str(rb.value("phrase/current", ""))
	_phrase_turn = phrase != _last_phrase and _last_phrase != "" and phrase != ""
	_last_phrase = phrase
	next_phrase = str(rb.value("phrase/next", ""))
	countin = float(rb.value("phrase/countin", -1.0))
	var p := phrase.to_lower()
	if p.begins_with("intro"): section = "intro"
	elif p.begins_with("outro"): section = "outro"
	elif p.begins_with("up"): section = "build"
	elif p.begins_with("down") or p.begins_with("bridge"): section = "break"
	elif p.begins_with("chorus"): section = "peak"
	elif p != "": section = "groove"
	else: section = "groove"   # no phrase analysis: neutral, no predicted build or blackout
	var coming := p != "" and next_phrase.to_lower().begins_with("chorus") and countin >= 0.0 and section != "peak"
	build = clampf(1.0 - countin / 32.0, 0.0, 1.0) if coming else 0.0
	blackout = 1.0 if coming and countin <= 1.0 else 0.0

func _new_track(t: String) -> void:
	if title != "" or t != "": note("new track")
	_drop_open = false
	_drop_beat = -100.0
	drop = 0.0
	_weights = _budget(scene, false)
	title = t
	palette = _palette_for(t)   # one pair of colours for the whole track
	incoming = ""
	mix = 0.0

# Which deck to follow. A deck plays when its clock moves (time, beat) or it says so. With a master from the sender,
# the deck that plays that title; without, the deck followed now while it plays, else another that plays: when the
# DJ stops or runs out the old deck, the show goes over to the new one.
func _choose_deck(dt: float, rb: Rekordbox) -> void:
	_rb_clock += dt
	for d in ["1", "2", "3", "4"]:
		var now := [rb.fields.get(d + "/time"), rb.fields.get(d + "/beat/subdiv/1"), rb.fields.get(d + "/beat/position")]
		if now == [null, null, null] and not rb.fields.has(d + "/track/title"): continue
		var seen: Array = _deck_seen.get(d, [null, -10.0])
		if seen[0] != now:
			if seen[0] != null: seen[1] = _rb_clock
			seen[0] = now
		_deck_seen[d] = seen
		var flag = rb.fields.get(d + "/transport/playing")
		playing[d] = _rb_clock - float(seen[1]) < 0.6 or (flag != null and int(flag) == 1 and now == [null, null, null])
	var pick := rb.active
	var master_title := str(rb.fields.get("master/track/title", ""))
	if master_title != "":
		pick = "master"
		for d in playing:
			if playing[d] and str(rb.fields.get(d + "/track/title", "")) == master_title: pick = d
	elif not playing.get(pick, false):
		for d in ["1", "2", "3", "4"]:
			if playing.get(d, false):
				pick = d
				break
	else:
		# both play: a DJ mixes out in the outro. When the followed deck is in its outro and the other has played
		# eight bars or more, the show goes over on the first beat of the other's next phrase.
		var other := ""
		for d in ["1", "2", "3", "4"]:
			if d != pick and playing.get(d, false): other = d
		if other == "": _both_from = -1.0
		else:
			if _both_from < 0.0: _both_from = _rb_clock
			var mine: String = rb.value_for(pick, "phrase/current", "").to_lower()
			var theirs: String = rb.value_for(other, "phrase/current", "")
			var turned: bool = _deck_phrase.has(other) and theirs != "" and _deck_phrase[other] != "" and _deck_phrase[other] != theirs
			var bars := (_rb_clock - _both_from) * maxf(bpm, 60.0) / 60.0 / 4.0
			if mine.begins_with("outro") and bars >= 8.0 and turned: pick = other
	for d in ["1", "2", "3", "4"]: _deck_phrase[d] = rb.value_for(d, "phrase/current", "")
	if pick == "": pick = "1"
	if pick != rb.active:
		if _log: print("rekordbox: following deck %s" % pick)
		rb.active = pick

func deck_text(rb: Rekordbox) -> String:
	var marks: Array = []
	for d in ["1", "2", "3", "4"]:
		if _deck_seen.has(d): marks.append(("▶" if playing.get(d, false) else "■") + d)
	return "deck %s   %s" % [rb.deck(), " ".join(marks)]

# A mix: another deck plays a different track while the master plays. The colours lean towards the incoming
# track as the mix goes on (half way at most, over 32 beats); when it takes the master, they glide the rest.
# A track only loaded, not playing, changes nothing.
func _watch_mix(rb: Rekordbox) -> void:
	var found := ""
	for d in ["1", "2", "3", "4"]:
		var other := str(rb.fields.get(d + "/track/title", ""))
		if other != "" and other != title and other != _outgoing and playing.get(d, false) and d != rb.deck(): found = other
	if found != incoming:
		if found != "":
			_incoming_palette = _palette_for(found)
			_mix_from = beat
			if _log: print("rekordbox: mixing in %s" % found)
		elif _log: print("rekordbox: mix stopped")
		incoming = found
	mix = clampf((beat - _mix_from) / 32.0, 0.0, 1.0) if incoming != "" else 0.0

# The colours on the rig: the track's, leaning towards the incoming one in a mix, always gliding, never jumping.
func _glide(dt: float) -> Array:
	var want: Array = palette
	if incoming != "" and not _incoming_palette.is_empty():
		want = [palette[0].lerp(_incoming_palette[0], 0.5 * mix), palette[1].lerp(_incoming_palette[1], 0.5 * mix)]
	if _shown.is_empty(): _shown = want.duplicate()
	var k := 1.0 - exp(-dt * 1.2)
	_shown = [_shown[0].lerp(want[0], k), _shown[1].lerp(want[1], k)]
	return _shown
