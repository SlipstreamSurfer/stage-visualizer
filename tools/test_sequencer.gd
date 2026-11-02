extends SceneTree
# The light sequencer and the new looks, moves, gates and colour spreads: pure numbers, no rig and no waiting.

func _initialize() -> void:
	var failed := []
	var S := LightSequencer
	# The spatial sequence hands light from one whole fixture to another, with truly dark off steps.
	var occupied := {}
	for step in 32:
		var lit := 0
		for column in 16:
			var x := -20.625 + column * 2.75
			for row in 8:
				var z := -32.375 + row * 9.25
				var value := S.fixture_gain(Vector3(x, 10, z), step * 0.25, 7, false, 23)
				if value > 0.1:
					lit += 1
					occupied[Vector2i(x, z)] = true
		if lit == 0 or lit >= 64: failed.append("Spatial sequencer must select a local set of whole fixtures")
	if occupied.size() < 96: failed.append("Spatial sequencer does not travel through the rig")
	# the grid
	for hits in range(1, 9):
		for rot in 16:
			if S.popcount(S.euclid(hits, rot)) != hits: failed.append("euclid(%d, %d) has %d hits" % [hits, rot, S.popcount(S.euclid(hits, rot))])
	# lengths: only 4, 8, 16 or 32 bars, and the blocks of a part take turns
	var seen := {}
	for section in ["intro", "low", "groove", "peak", "break", "nonsense"]:
		for i in 12:
			var n := S.length_for(section, i)
			seen[n] = true
			if n not in S.LENGTHS: failed.append("%s block %d is %d bars" % [section, i, n])
	for n in S.LENGTHS:
		if not seen.has(n): failed.append("no block is %d bars" % n)
	# Patterns are deterministic; dense stage patterns may use eighths or sixteenths.
	var distinct := {}
	for lane in S.LANES:
		for block in 40:
			for length in S.LENGTHS:
				var first := S.pattern(lane, block, 0, length)
				if first != S.pattern(lane, block, 0, length): failed.append("a pattern is not the same twice")
				distinct[first] = true
				for bar in length:
					var m := S.pattern(lane, block, bar, length)
					if m != 0xFFFF and ((m & ((m << 1) & 0xFFFF)) != 0 or ((m & 1) == 1 and ((m >> 15) & 1) == 1)): failed.append("neighbouring hits: lane %d block %d bar %d" % [lane, block, bar])
					var n := S.popcount(m)
					if n < 2 or n > 16: failed.append("%d hits: lane %d block %d bar %d of %d" % [n, lane, block, bar, length])
					var safe := S.pattern(lane, block, bar, length, true)
					if safe == 0 or safe & ~0x1111 != 0: failed.append("safe pattern off the quarter notes")
				# a block holds one pattern until its fill, and the fill has at least as many hits
				var body := S.pattern(lane, block, 0, length)
				for bar in length - maxi(1, length / 4):
					if S.pattern(lane, block, bar, length) != body: failed.append("a block changes before its fill")
				if S.popcount(S.pattern(lane, block, length - 1, length)) < S.popcount(body): failed.append("the fill has fewer hits")
	if distinct.size() < 20: failed.append("only %d different patterns" % distinct.size())
	# the lanes do not all play the same
	var same := 0
	for block in 40:
		if S.pattern(0, block, 0, 16) == S.pattern(1, block, 0, 16): same += 1
	if same > 10: failed.append("lanes 0 and 1 play the same pattern in %d of 40 blocks" % same)
	var speeds := {}
	for block in 80: speeds[S.pattern(2, block, 0, 8)] = true
	if not speeds.has(0x5555) or not speeds.has(0xFFFF): failed.append("Missing eighth or sixteenth stage pattern")
	var different_tracks := 0
	for block in 40:
		if S.pattern(0, block, 0, 16, false, 17) != S.pattern(0, block, 0, 16, false, 39): different_tracks += 1
	if different_tracks < 20: failed.append("Different tracks reuse too many identical rhythms")
	if S.pulse(0xFFFF, 0.0) < 0.9 or S.pulse(0xFFFF, 0.2) > 0.01 or S.pulse(0xFFFF, 0.25) < 0.9: failed.append("Sixteenths do not separate into pulses")
	var monos := {}
	for block in 60: monos[ShowDirector.mono_colour(block).to_html()] = true
	if monos.size() != 5: failed.append("Mono blocks must include five different colours")

	# the new head looks: every one of them with every move, over the hall, over time: finite, and aimed in or at the hall
	var L := ShowLooks
	var rig_heads := []
	for row in 5:
		for step in 11:
			var h := ShowLooks.Head.new()
			h.fx = Rig.Fixture.new()
			var z: float = Rig.TRUSS_Z[row]
			var x := -19.0 + step * 3.8
			h.fx.mount = Vector3(x, 10.0, z + absf(x) * 0.12)
			h.u = step / 10.0
			h.row = row
			h.xn = x / 19.0
			h.slot = row * 11 + step
			h.rp = sin(h.slot * 1.7)
			h.rt = 0.5 + 0.5 * cos(h.slot * 2.3)
			rig_heads.append(h)
	var new_looks := []
	for key in L.HEAD_LOOKS:
		if L.HEAD_LOOKS[key].size() > 7: new_looks.append(key)
	if new_looks.size() < 6: failed.append("only %d new looks" % new_looks.size())
	for key in new_looks:
		var look: Array = L.HEAD_LOOKS[key]
		var moves: Array = ShowDirector.STACK_MOVES.duplicate()   # what the stack can pair with it, and its own move
		if look[3] not in moves: moves.append(look[3])
		for move in moves:
			for tick in 24:
				var k := {"m": tick * 0.9, "spin": tick * 0.3, "phase": tick * 2.7, "build": 0.0, "hangar_look": tick % 3}
				var s := {"beat": tick * 2, "section": "groove", "build": 0.0, "energy": 0.6, "drop": 0.0, "stage": -28.0}
				for h in rig_heads:
					var p: Vector3 = h.fx.mount
					var t: Vector3 = L.move(move, L.position(look[2], h, p, k, s), h, p, k)
					if not (is_finite(t.x) and is_finite(t.y) and is_finite(t.z)): failed.append("%s + %s: not finite" % [key, move]); break
					if absf(t.x) > 200.0 or absf(t.y) > 200.0 or absf(t.z) > 200.0:   # the moves scale with the distance of the target: wild is wild
						failed.append("%s + %s aims at %s" % [key, move, t]); break
					var inside := ShowDirector._inside(t)   # what the show aims at in the end: in the hall
					if absf(inside.x) > 24.0 or inside.y < 0.0 or inside.y > 14.5 or inside.z < -36.0 or inside.z > 35.0: failed.append("%s + %s is aimed outside the hall" % [key, move]); break
	failed = _first(failed, 12)
	# the new gates: a share of the heads, every head sometimes, and none for ever
	for gate in ["outIn", "blocks", "diag", "pairsAlt"]:
		var on_total := 0
		var lit_once := {}
		var frames := 0
		for counted in range(0, 64):
			frames += 1
			for h in rig_heads:
				if L.gate(gate, h, float(counted), 0):
					on_total += 1
					lit_once[h.slot] = true
		var share := on_total / float(frames * rig_heads.size())
		if share < 0.15 or share > 0.75: failed.append("gate %s lights %.0f%% of the heads" % [gate, share * 100.0])
		if lit_once.size() < rig_heads.size(): failed.append("gate %s never lights %d heads" % [gate, rig_heads.size() - lit_once.size()])
		if not L.GATE_GAIN.has(gate): failed.append("gate %s has no gain" % gate)
	# the new colour spreads: always a colour of the palette or between two, whatever the beat
	var pal: Array = ShowDirector.RAW_DEEP_PALETTES[0].map(func(c): return ShowDirector._hex(c))
	var director := ShowDirector.new()
	var replay := ShowDirector.new()
	# Ordinary figures keep their authored movement and gating instead of acquiring random fast gates.
	for scene in 80:
		director._scene = scene
		replay._scene = scene
		var stack := director._stack(L.HEAD_LOOKS.floor, "mid")
		if stack != replay._stack(L.HEAD_LOOKS.floor, "mid"): failed.append("Pattern choices change on replay")
		if stack != [L.HEAD_LOOKS.floor[3], L.HEAD_LOOKS.floor[4], L.HEAD_LOOKS.floor[5], L.HEAD_LOOKS.floor[6]]:
			failed.append("The ordinary figure acquired an extra pattern layer")
	for name in ShowDirector.STACK_COLOURS:
		var colours := {}
		for k32 in 8:
			for h in rig_heads:
				var c: Color = director._spread(name, h, k32, k32 / 2, pal)
				if not (is_finite(c.r) and is_finite(c.g) and is_finite(c.b)): failed.append("colour spread %s: not finite" % name)
				colours[c.to_html()] = true
		if colours.size() < 2: failed.append("colour spread %s gives %d colours" % [name, colours.size()])
	if ShowDirector.STACK_COLOURS.size() < 10 or ShowDirector.STACK_MOVES.size() < 12 or ShowDirector.STACK_GATES.size() < 12 or ShowDirector.STACK_BEAMS.size() < 6:
		failed.append("the stacks are small: %d colours, %d moves, %d gates, %d beams" % [ShowDirector.STACK_COLOURS.size(), ShowDirector.STACK_MOVES.size(), ShowDirector.STACK_GATES.size(), ShowDirector.STACK_BEAMS.size()])
	if ShowDirector.RAW_DEEP_PALETTES.size() < 16: failed.append("%d palettes" % ShowDirector.RAW_DEEP_PALETTES.size())
	for palette in ShowDirector.RAW_DEEP_PALETTES:
		if palette.size() < 3 or palette.size() > 4: failed.append("a palette of %d colours" % palette.size())
	# the other genres keep their looks: the new ones are in no other style, and no fallback list
	for style_name in L.STYLES:
		for key in L.STYLES[style_name].looks:
			if key in new_looks: failed.append("%s plays a new look: %s" % [style_name, key])
	for part in ["calm", "mid", "big"]:
		for key in L.head_tier(part):
			if key in new_looks: failed.append("the fallback list of %s has a new look" % part)
	if failed.is_empty(): print("sequencer: patterns of 4, 8, 16 and 32 bars; %d new looks over every move stay in the hall; the new gates and colour spreads hold" % new_looks.size())
	else: printerr("sequencer: ", failed)
	quit(0 if failed.is_empty() else 1)

static func _first(list: Array, n: int) -> Array:
	return list.slice(0, n)
