extends SceneTree
# Validate the real FFT against a direct DFT, and push() across chunk boundaries.
const Ear = preload("res://scripts/listen_ear.gd")
func _initialize() -> void:
	var largest := 0.0
	for rate in [44100.0, 48000.0]:
		var samples := PackedFloat32Array()
		samples.resize(Ear.N)
		seed(91)
		var power := 0.0
		for i in Ear.N:
			samples[i] = 0.1 + 0.3 * sin(TAU * i * 32 / Ear.N) + 0.1 * cos(TAU * i * 600 / Ear.N) + randf() * 0.02
			power += samples[i] * samples[i]
		var ear = Ear.new(rate)
		ear.last = samples.duplicate()
		ear.count = Ear.N
		assert(absf(ear.spectrum() - sqrt(power / Ear.N)) < 1e-12)
		for k in [0, 1, 3, 10, 32, 50, 120, 200, 300, 600, 800, 1023]:
			var real := 0.0
			var imaginary := 0.0
			for i in Ear.N:
				var window := 0.42 - 0.5 * cos(TAU * i / Ear.N) + 0.08 * cos(2.0 * TAU * i / Ear.N)
				real += samples[i] * window * cos(TAU * k * i / Ear.N)
				imaginary -= samples[i] * window * sin(TAU * k * i / Ear.N)
			var expected := 0.95 * sqrt(real * real + imaginary * imaginary) / Ear.N
			largest = maxf(largest, absf(expected - ear.smooth[k]))
			assert(absf(expected - ear.smooth[k]) < 1e-12)
		var whole = Ear.new(rate)
		var chunks = Ear.new(rate)
		var one := []
		var many := []
		whole.push(samples, func(b, rms, t): one.append([b, rms, t]))
		var offset := 0
		for width in [13, 700, 1, 301, 1033]:
			chunks.push(samples.slice(offset, offset + width), func(b, rms, t): many.append([b, rms, t]))
			offset += width
		assert(one == many)
	print("real FFT: DFT bins/RMS and chunk boundaries agree; largest bin error ", largest)
	quit()
