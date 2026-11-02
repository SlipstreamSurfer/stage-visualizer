class_name BarPixels
extends RefCounted
# Twelve independently driven LED cells per batten. Shapes hold for whole phrases.
const COUNT := 12
const PATTERNS := ["solid", "left_half", "right_half", "odd", "even", "centre", "ends", "window"]

static func pattern_for(phrase: int, fixture: int, group: String, gentle: bool) -> String:
	var choices := 2 if gentle else PATTERNS.size()
	var offset := posmod(fixture + hash(group), choices)
	return PATTERNS[posmod(phrase + offset, choices)]

static func levels(pattern: String, phase := 0) -> PackedFloat32Array:
	var result := PackedFloat32Array()
	result.resize(COUNT)
	for i in COUNT:
		var on := true
		match pattern:
			"left_half": on = i < COUNT / 2
			"right_half": on = i >= COUNT / 2
			"odd": on = i % 2 == 1
			"even": on = i % 2 == 0
			"centre": on = i in [4, 5, 6, 7]
			"ends": on = i in [0, 1, 10, 11]
			"window": on = posmod(i - phase, COUNT) < 3
			_: pass
		result[i] = 1.0 if on else 0.0
	return result
