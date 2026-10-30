class_name Quality
extends RefCounted
# Graphics settings as SV has them: Low, Light, Normal, High, Ultra, and Automatic, which measures: it starts at Low
# and goes up as long as the screen's rate is kept. The presets follow what each effect costs (main.gd --costs, on a
# GTX 1660 SUPER at 1080p from Ultra's 16 ms): the render scale saves most (70 %: 5 ms, 50 %: 7.5 ms); SDFGI
# 2.6-3.9 ms, the haze volume 2, the beams 2-2.4, 3,000 people 2.2, SSR 1.6-2, SSIL 1.7, TAA 0.7-1.6, glow and
# the lamps on surfaces under 1 ms; shadows 0.2 ms and SSAO next to nothing.
# Low is for weak integrated graphics: the beams and the glow stay (they are the show), the rest is sparse.

const ORDER := ["low", "light", "normal", "high", "ultra"]
const PRESETS := {
	"low":    {"scale": 0.5, "fog": 0, "surface": 0.0, "shadows": 0, "ssr": false, "ssao": false, "ssil": false, "sdfgi": false, "crowd": 600, "taa": false, "beam": 0.75},
	"light":  {"scale": 0.6, "fog": 0, "surface": 0.15, "shadows": 0, "ssr": false, "ssao": true, "ssil": false, "sdfgi": false, "crowd": 1200, "taa": false, "beam": 0.7},
	"normal": {"scale": 0.8, "fog": 64, "surface": 0.5, "shadows": 4, "ssr": false, "ssao": true, "ssil": false, "sdfgi": false, "crowd": 2400, "taa": false, "beam": 0.8},
	"high":   {"scale": 1.0, "fog": 96, "surface": 1.0, "shadows": 8, "ssr": true, "ssao": true, "ssil": false, "sdfgi": false, "crowd": 3000, "taa": true, "beam": 0.75},
	"ultra":  {"scale": 1.0, "fog": 128, "surface": 1.0, "shadows": 12, "ssr": true, "ssao": true, "ssil": true, "sdfgi": true, "crowd": 3000, "taa": true, "beam": 0.7},
}

static func apply(name: String, env: Environment, vp: Viewport, rig: Rig, crowd: Crowd) -> void:
	apply_options(PRESETS[name], env, vp, rig, crowd)

# Every option on its own (a preset is a set of them): what a settings screen or a measurement can change one by one.
#   scale 0.4-1 (FSR below 1), fog 0 (off) or the haze volume's size, surface: the share of lamps that light
#   surfaces, shadows: how many spots cast shadows, ssr ssao ssil sdfgi taa: Godot's screen effects, crowd: people,
#   beam: how strong the beams are drawn; glow and beams (false hides them) default to on.
static func apply_options(q: Dictionary, env: Environment, vp: Viewport, rig: Rig, crowd: Crowd) -> void:
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
	env.glow_enabled = q.get("glow", true)
	rig.configure(q.surface, q.fog > 0, q.shadows)
	rig.beam_strength = q.beam
	rig.set_beams_visible(q.get("beams", true))
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
# But only when it helps: when a step down does not make frames faster, the time goes elsewhere (the processor, or
# a screen that paces slower than it says), so the step is undone and it waits half a minute before trying again.
class Steady:
	var top := 1.0
	var scale := 1.0
	var typical := 0.0
	var _times: Array[float] = []
	var _room := 0.0
	var _before := 0.0     # the typical frame before the last step down, 0 when there was none
	var _hold := 0.0       # seconds to wait before trying a step down again

	func reset(preset_scale: float) -> void:
		top = preset_scale
		scale = preset_scale
		_times.clear()
		_room = 0.0
		_before = 0.0
		_hold = 0.0

	# Returns a new scale when it should change, else -1.
	func sample(dt: float, refresh: float) -> float:
		_hold = maxf(0.0, _hold - dt)
		_times.append(dt)
		if _times.size() < 45: return -1.0
		var sorted := _times.duplicate()
		sorted.sort()
		typical = sorted[sorted.size() / 2]
		_times.clear()
		var frame := 1.0 / maxf(refresh, 30.0)
		if _before > 0.0:
			var helped := typical < _before * 0.93
			_before = 0.0
			if not helped:
				_hold = 30.0
				_room = 0.0
				scale = minf(top, scale + 0.06)
				return scale
		if typical > frame * 1.12 and scale > 0.4 and _hold <= 0.0:
			_before = typical
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
