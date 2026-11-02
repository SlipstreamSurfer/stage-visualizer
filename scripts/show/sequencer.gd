class_name LightSequencer
extends RefCounted
# A step sequencer for the lights, on the beat grid. A bar has 4 beats and 16 steps. The show plays in blocks of 4, 8,
# 16 or 32 bars; a block holds one pattern for each lane and only changes on its own bar line. The last quarter of a
# block is a fill: the pattern with more hits, leading into the next block.
# Everything follows from numbers (lane, block, bar), never from chance, so a replay plays the same.
#
# Lanes: 0 the hall's centre heads, 1 the hall's side heads, 2 the stage heads, 3 the bars.

const STEPS := 16
const LANES := 4
const LENGTHS := [4, 8, 16, 32]

# How long a block lasts (in bars), by part of the track; the blocks of a part take turns.
const BLOCKS := {
	"intro": [8, 4],
	"low": [8],
	"groove": [16, 8, 16, 32, 8],
	"peak": [8, 16, 8, 32],
	"break": [4, 8],
}

static func length_for(section: String, index: int, salt := 0) -> int:
	var cycle: Array = BLOCKS.get(section, [8])
	return cycle[posmod(hash("%s:%d:%d:length" % [section, index, salt]), cycle.size())]

# k hits spread evenly over the 16 steps, turned by rot steps: bit i is step i.
static func euclid(hits: int, rot: int) -> int:
	var mask := 0
	for i in STEPS:
		if floori((i + 1) * hits / float(STEPS)) != floori(i * hits / float(STEPS)): mask |= 1 << i
	rot = posmod(rot, STEPS)
	return ((mask << rot) | (mask >> (STEPS - rot))) & 0xFFFF

# No two hits on neighbouring steps: the quickest a lane can go is every eighth note (4 hits a second at 130 BPM).
static func thin(mask: int) -> int:
	var out := mask
	for i in STEPS:
		if (mask >> i) & 1 == 1 and (mask >> posmod(i - 1, STEPS)) & 1 == 1: out &= ~(1 << i)
	return out

# The hits of extra that fit in beside the ones there are, without touching one: a fill only adds.
static func _with(mask: int, extra: int) -> int:
	var out := mask
	for i in STEPS:
		if (extra >> i) & 1 == 1 and (out >> posmod(i - 1, STEPS)) & 1 == 0 and (out >> ((i + 1) % STEPS)) & 1 == 0: out |= 1 << i
	return out

static func popcount(mask: int) -> int:
	var n := 0
	for i in STEPS: n += (mask >> i) & 1
	return n

# The pattern of a lane in a block, for a bar of it (0 is the block's first bar). safe: on the quarter notes only.
static func pattern(lane: int, block: int, bar: int, length: int, safe := false, salt := 0) -> int:
	# Occasional driving eighths and sixteenths; other lanes keep their own rhythms.
	var speed := posmod(hash("%d:%d:speed" % [block, salt]), 8)
	if not safe and lane == 2 and speed in [2, 5]:
		return 0x5555 if speed == 2 else 0xFFFF
	var s := absi(hash("%d:%d:%d:%d:rhythm" % [lane, block, length, salt]))
	var hits := 3 + (s / 3) % 5
	var rot := (s / 7) % STEPS
	var mask := thin(euclid(hits, rot))
	if bar >= length - maxi(1, length / 4): mask = _with(mask, euclid(hits + 3, rot + 1))   # the fill
	if safe:
		mask &= 0x1111
		if mask == 0: mask = 0x1111
	return mask

# A repeated hit must go down between adjacent sixteenths, even if no frame lands on the step boundary.
static func pulse(mask: int, grid: float) -> float:
	var phase := fposmod(grid * 4.0, 1.0)
	if not hit(mask, floori(grid * 4.0)): return 0.0
	return 1.0 - smoothstep(0.35, 0.8, phase)

static func hit(mask: int, step: int) -> bool:
	return (mask >> posmod(step, STEPS)) & 1 == 1

# Select whole fixtures in space. A different station owns each eighth/sixteenth, with real darkness between.
static func fixture_gain(position: Vector3, grid: float, block: int, safe := false, salt := 0) -> float:
	if safe: return 1.0
	var mode := posmod(hash("%d:%d:route" % [block, salt]), 6)
	var x := clampf((position.x + 22.0) / 44.0, 0.0, 0.999)
	var z := clampf((position.z + 37.0) / 74.0, 0.0, 0.999)
	var coordinate := z
	match mode:
		0: coordinate = x
		1: coordinate = z
		2: coordinate = (x + z) * 0.5
		3: coordinate = absf(x * 2.0 - 1.0)
		4: coordinate = (x if floori(z * 4.0) % 2 == 0 else 1.0 - x)
		5: coordinate = fposmod(z + floorf(x * 4.0) * 0.125, 1.0)
	var speed := 4.0 if posmod(hash("%d:%d:step-speed" % [block, salt]), 3) == 0 else 2.0
	var step := grid * speed
	var station := clampi(floori(coordinate * 8.0), 0, 7)
	if station != posmod(floori(step), 8): return 0.0
	return 1.0 - smoothstep(0.7, 0.94, fposmod(step, 1.0))
