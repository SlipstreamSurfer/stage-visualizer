class_name ShowSet
extends RefCounted
# How the stage set plays: the tubes and the frames each pick a figure per passage, locked to the beat grid.
# Levels are 0..1 before the master and the desk.

const TUBE_MODES := ["rise", "drops", "pulse", "alternate"]
const FRAME_MODES := ["orbit", "nest", "beat"]
const DIM := 0.04

static func tube_mode(passage: int) -> String:
	return TUBE_MODES[posmod(hash("%d:tubes" % passage), TUBE_MODES.size())]

static func frame_mode(passage: int) -> String:
	return FRAME_MODES[posmod(hash("%d:frames" % passage), FRAME_MODES.size())]

# A tube pixel: tube 0..5 left to right, place 0..1 from the bottom up.
static func tube(mode: String, tube_index: int, place: float, grid: float, kick: float) -> float:
	match mode:
		"rise":   # fills from the bottom up once a bar, then starts again
			return 1.0 if place <= fposmod(grid / 4.0, 1.0) else DIM
		"drops":   # a drop falls down each tube in two beats, every tube on its own moment
			var own := fposmod(sin(tube_index * 12.9898) * 43758.5453, 1.0)
			var head := 1.0 - fposmod(grid / 2.0 + own, 1.0)
			var trail := place - head
			return 1.0 - trail / 0.2 if trail >= 0.0 and trail < 0.2 else DIM
		"pulse":   # every tube on the kick
			return DIM + (1.0 - DIM) * kick
		"alternate":   # odd and even tubes trade on the beat
			var on := posmod(tube_index, 2) == posmod(floori(grid), 2)
			return 1.0 - smoothstep(0.5, 1.0, fposmod(grid, 1.0)) * 0.7 if on else DIM
	return DIM

# A frame pixel: frame 0 the inner one, 1 the outer one; place 0..1 round it.
static func frame(mode: String, frame_index: int, place: float, grid: float, kick: float) -> float:
	match mode:
		"orbit":   # a light runs round each frame once a bar, the two the opposite way
			var at := fposmod(grid / 4.0, 1.0)
			if frame_index == 1: at = 1.0 - at
			var d := fposmod((place - at) * (1.0 if frame_index == 0 else -1.0), 1.0)
			return 1.0 - d / 0.15 if d < 0.15 else DIM * 1.5
		"nest":   # inner and outer frame take turns on the beat
			var on := frame_index == posmod(floori(grid), 2)
			return 1.0 - smoothstep(0.4, 1.0, fposmod(grid, 1.0)) * 0.8 if on else DIM
		"beat":   # both frames on the kick
			return 0.08 + 0.92 * kick
	return DIM
