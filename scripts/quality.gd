class_name Quality
extends RefCounted
# Graphics settings as SV has them since 0.37: Light, Normal, High, Ultra, and Automatic, which measures: it starts
# at Light and goes up as long as the screen's refresh rate is kept.

const ORDER := ["light", "normal", "high", "ultra"]
const PRESETS := {
	"light":  {"scale": 0.5, "fog": 0, "surface": 0.15, "shadows": 0, "ssr": false, "ssao": false, "ssil": false, "sdfgi": false, "crowd": 1200, "taa": false, "beam": 0.7},
	"normal": {"scale": 0.8, "fog": 64, "surface": 0.5, "shadows": 0, "ssr": false, "ssao": true, "ssil": false, "sdfgi": false, "crowd": 2400, "taa": false, "beam": 0.8},
	"high":   {"scale": 1.0, "fog": 96, "surface": 1.0, "shadows": 0, "ssr": true, "ssao": true, "ssil": false, "sdfgi": false, "crowd": 3000, "taa": true, "beam": 0.75},
	"ultra":  {"scale": 1.0, "fog": 128, "surface": 1.0, "shadows": 8, "ssr": true, "ssao": true, "ssil": true, "sdfgi": true, "crowd": 3000, "taa": true, "beam": 0.7},
}

static func apply(name: String, env: Environment, vp: Viewport, rig: Rig, crowd: Crowd) -> void:
	var q: Dictionary = PRESETS[name]
	vp.scaling_3d_mode = Viewport.SCALING_3D_MODE_FSR if q.scale < 1.0 else Viewport.SCALING_3D_MODE_BILINEAR
	vp.scaling_3d_scale = q.scale
	vp.use_taa = q.taa
	vp.screen_space_aa = Viewport.SCREEN_SPACE_AA_DISABLED if q.taa else Viewport.SCREEN_SPACE_AA_FXAA
	env.volumetric_fog_enabled = q.fog > 0
	if q.fog > 0: RenderingServer.environment_set_volumetric_fog_volume_size(q.fog, q.fog)
	env.ssr_enabled = q.ssr
	env.ssao_enabled = q.ssao
	env.ssil_enabled = q.ssil
	env.sdfgi_enabled = q.sdfgi
	rig.configure(q.surface, q.fog > 0, q.shadows)
	rig.beam_strength = q.beam
	crowd.shown(q.crowd)

# Automatic: a step up every three seconds while the frames keep up with the screen, one back down when not.
class Calibration:
	var level := 0
	var done := false
	var _frames: Array[float] = []
	var _wait := 1.5

	func step(dt: float, refresh: float) -> int:
		if done: return level
		if _wait > 0.0:
			_wait -= dt
			return level
		_frames.append(dt)
		if _frames.size() < int(refresh * 3.0): return level
		_frames.sort()
		var ms: float = _frames[_frames.size() / 2]
		_frames.clear()
		_wait = 1.5
		var keeps := ms <= 1.08 / refresh
		if keeps and level < ORDER.size() - 1: level += 1
		else:
			if not keeps and level > 0: level -= 1
			done = true
		return level

# A steady picture, as SV in the browser has it (steady.js): when frames take longer than the screen allows, draw
# fewer pixels (down to 40 %), and more again when there is room for three seconds, up to what the setting asks.
# Most of a frame is pixels (beams, haze, glow), so a slightly softer picture keeps the pace where a full one stutters.
class Steady:
	var top := 1.0
	var scale := 1.0
	var _times: Array[float] = []
	var _room := 0.0

	func reset(preset_scale: float) -> void:
		top = preset_scale
		scale = preset_scale
		_times.clear()
		_room = 0.0

	# Returns a new scale when it should change, else -1.
	func sample(dt: float, refresh: float) -> float:
		_times.append(dt)
		if _times.size() < 45: return -1.0
		var sorted := _times.duplicate()
		sorted.sort()
		var typical: float = sorted[sorted.size() / 2]
		_times.clear()
		var frame := 1.0 / maxf(refresh, 30.0)
		if typical > frame * 1.12 and scale > 0.4:
			scale = maxf(0.4, scale - 0.06)
			_room = 0.0
			return scale
		if typical < frame * 0.8:
			_room += 45.0 * typical
			if _room > 3.0 and scale < top:
				scale = minf(top, scale + 0.06)
				_room = 0.0
				return scale
		else: _room = 0.0
		return -1.0
