extends RefCounted
# Port of SV's src/ear.js: Blackman, magnitude/N, 0.05 smoothing, 60 Hz.
# Both AudioEffectCapture and offline WAV decoding call push().
const N = 2048
const STEPS = 60.0
var rate: float
var every: float
var next: float
var count: int = 0
var last := PackedFloat32Array()
var re := PackedFloat64Array()
var im := PackedFloat64Array()
var smooth := PackedFloat64Array()
var window := PackedFloat64Array()
var rev := PackedInt32Array()
var cos_t := PackedFloat64Array()
var sin_t := PackedFloat64Array()

func _init(sample_rate: float) -> void:
	rate = sample_rate
	every = rate / STEPS
	next = every
	last.resize(N)
	re.resize(N / 2)
	im.resize(N / 2)
	smooth.resize(N / 2)
	window.resize(N)
	rev.resize(N / 2)
	cos_t.resize(N / 2)
	sin_t.resize(N / 2)
	for i: int in N:
		window[i] = 0.42 - 0.5 * cos(TAU * i / N) + 0.08 * cos(2.0 * TAU * i / N)
	for i: int in N / 2:
		var r: int = 0
		for b: int in 10: r |= ((i >> b) & 1) << (9 - b)
		rev[i] = r
		cos_t[i] = cos(TAU * i / N)
		sin_t[i] = -sin(TAU * i / N)

func band(lo: float, hi: float) -> float:
	var hz: float = rate / N
	var a: int = maxi(1, floori(lo / hz))
	var b: int = mini(N / 2 - 1, ceili(hi / hz))
	var p: float = 0.0
	for i: int in range(a, b + 1): p += smooth[i] * smooth[i]
	return sqrt(p / (b - a + 1)) if b >= a else 0.0

func spectrum() -> float:
	var power: float = 0.0
	# A real N-point FFT needs only one complex N/2 transform: pack even/odd
	# samples together, then recover their spectra with conjugate symmetry.
	for i: int in N / 2:
		var x: float = last[(count + i * 2) & (N - 1)]
		var y: float = last[(count + i * 2 + 1) & (N - 1)]
		power += x * x
		power += y * y
		re[rev[i]] = x * window[i * 2]
		im[rev[i]] = y * window[i * 2 + 1]
	var size: int = 2
	while size <= N / 2:
		var half: int = size >> 1
		var step: int = N / size
		for i: int in range(0, N / 2, size):
			for j: int in half:
				var c: float = cos_t[j * step]
				var s: float = sin_t[j * step]
				var a: int = i + j
				var b: int = a + half
				var tr: float = re[b] * c - im[b] * s
				var ti: float = re[b] * s + im[b] * c
				re[b] = re[a] - tr
				im[b] = im[a] - ti
				re[a] += tr
				im[a] += ti
		size <<= 1
	for k: int in N / 2:
		var mirror: int = (N / 2 - k) & (N / 2 - 1)
		var ar: float = (re[k] + re[mirror]) * 0.5
		var ai: float = (im[k] - im[mirror]) * 0.5
		var br: float = (im[k] + im[mirror]) * 0.5
		var bi: float = (re[mirror] - re[k]) * 0.5
		var real: float = ar + cos_t[k] * br - sin_t[k] * bi
		var imaginary: float = ai + sin_t[k] * br + cos_t[k] * bi
		smooth[k] = 0.05 * smooth[k] + 0.95 * sqrt(real * real + imaginary * imaginary) / N
	return sqrt(power / N)

func push(samples: PackedFloat32Array, step: Callable) -> void:
	for x: float in samples:
		last[count & (N - 1)] = x
		count += 1
		if count >= next:
			next += every
			var rms: float = spectrum()
			step.call([band(35, 170), band(250, 3000), band(4000, 14000)], rms, count / rate)

func skip(frames: int) -> void:
	count += frames
	next += frames
	last.fill(0.0)
