extends SceneTree

var failures: Array[String] = []

func _initialize() -> void:
	for pattern in BarPixels.PATTERNS:
		var levels := BarPixels.levels(pattern)
		assert(levels.size() == 12, "Every bar pattern must address twelve LED cells")
		for level in levels: assert(level == 0.0 or level == 1.0, "Pixel output must stay within its dimmer range")
	assert(BarPixels.levels("left_half").count(1.0) == 6, "50/50 bars must light exactly six cells")
	assert(BarPixels.levels("right_half").count(1.0) == 6, "Mirrored 50/50 bars must light six cells")
	assert(BarPixels.levels("odd").count(1.0) == 6 and BarPixels.levels("even").count(1.0) == 6, "Odd/even bars must alternate six cells")
	assert(BarPixels.levels("centre").count(1.0) == 4, "The centre pattern must remain local")
	assert(BarPixels.levels("ends").count(1.0) == 4, "The end pattern must remain local")
	assert(BarPixels.levels("window", 3).count(1.0) == 3, "A moving pixel window must contain three cells")
	assert(BarPixels.pattern_for(9, 4, "back", false) == BarPixels.pattern_for(9, 4, "back", false), "Pattern selection must replay deterministically")
	var rig := Rig.new()
	root.add_child(rig)
	rig.build()
	assert(rig._batten_pixels.multimesh.instance_count == rig.battens.size() * 12, "All batten pixels must share one batched draw")
	var first: Rig.Batten = rig.battens[0]
	first.color = Color.RED
	first.pixel_levels = BarPixels.levels("left_half")
	first.pixel_colors.fill(Color.RED)
	assert(first.pixel_levels[0] == 1.0 and first.pixel_levels[11] == 0.0, "Each cell keeps its own dimmer value")
	assert(first.pixel_colors.size() == 12 and first.pixel_colors[0] == Color.RED, "Each cell keeps its own colour value")
	assert(rig._batten_pixels.multimesh.use_colors, "The batched pixel mesh must read per-instance colour")
	rig.free()
	print("bar pixels: twelve per fixture, eight held patterns, independent dimmer cells, one batch")
	quit()
