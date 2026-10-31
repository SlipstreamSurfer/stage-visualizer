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

static func length_for(section: String, index: int) -> int:
	var cycle: Array = BLOCKS.get(section, [8])
	return cycle[posmod(index, cycle.size())]

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
static func pattern(lane: int, block: int, bar: int, length: int, safe := false) -> int:
	var s := lane * 7919 + block * 104729 + length * 31
	var hits := 3 + (s / 3) % 5
	var rot := (s / 7) % STEPS
	var mask := thin(euclid(hits, rot))
	if bar >= length - maxi(1, length / 4): mask = _with(mask, euclid(hits + 3, rot + 1))   # the fill
	if safe:
		mask &= 0x1111
		if mask == 0: mask = 0x1111
	return mask

static func hit(mask: int, step: int) -> bool:
	return (mask >> posmod(step, STEPS)) & 1 == 1
