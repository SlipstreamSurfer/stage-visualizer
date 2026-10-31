class_name Rig
extends Node3D
# The rig, as a lighting designer would hang a hangar show around one full-width stage:
#   front   beams along the stage's front edge (a gap where the PA hangs) and 8 strobe battens between them
#   back    7 towers behind the DJ, each with 3 beams and 2 battens: beams over the DJ's head into the hall
#   roof    two trusses over the stage: 12 spots with gobos, 8 washes, 8 blinders at the crowd
#   hall    5 trusses over the crowd on winches, a V at two heights by turns: 12 beams, 4 washes, 4 spots, 2 battens each
#   rear    a truss at the back of the hall: 12 beams, 6 washes, 5 battens and 4 blinders, towards the stage
#   delay   a ground-support tower halfway down either side: 4 beams on top, 2 battens
#   side    4 towers on the floor along each wall: 2 beams across the hall and a batten
# Three kinds of moving head (beam, spot, wash), each drawn as a few MultiMeshes: one draw call per part for all
# of them. The show sets every fixture's target, colour, level, gobo and zoom; update() moves and lights them.

enum { BEAM, SPOT, WASH }
# The three kinds, after real fixtures: a hybrid beam (as a Robe MegaPointe in beam mode, 1.8-21 degrees), a spot
# (as a BMFL, 5-55) and a wash (as a MAC Aura, 10-60). angle: the core's half angle at zoom 1, in degrees (the show's
# zoom multiplies it); light: the half angle of the light it throws on surfaces; len: how far its beam is drawn.
const KINDS := [
	{"angle": 2.6, "light": 2.9, "energy": 90.0, "len": 62.0, "speed": 7.0, "follow": 9.0, "r": 0.12, "body": 0.38, "lens": 0.085, "base": Vector3(0.36, 0.13, 0.3), "strength": 1.3, "halo": 2.2},
	{"angle": 6.0, "light": 6.5, "energy": 85.0, "len": 50.0, "speed": 3.5, "follow": 5.0, "r": 0.17, "body": 0.55, "lens": 0.12, "base": Vector3(0.48, 0.18, 0.38), "strength": 0.7, "halo": 1.8},
	{"angle": 15.0, "light": 18.0, "energy": 30.0, "len": 24.0, "speed": 3.0, "follow": 4.5, "r": 0.2, "body": 0.3, "lens": 0.18, "base": Vector3(0.45, 0.16, 0.36), "strength": 0.1, "halo": 1.4},
]
const TRUSS_Z := [-20.0, -10.0, 0.0, 10.0, 20.0]
const TRUSS_Y := [11.5, 10.4, 11.5, 10.4, 11.5]
const SIDE_Z := [-19.0, -9.0, 11.0, 21.0]
const ARM := ["beam", "wash", "beam", "spot", "beam", "batten", "beam", "wash", "beam", "spot", "beam"]   # one arm of a hall truss, from the middle out
const PA_X := 16.5        # where the PA hangs (Hall), so that no beam shines through it
const LASERS := false     # off for now
const V_DEPTH := 4.5      # the V: how much further from the stage a hall truss's ends are than its middle

class Fixture:
	var kind := 0
	var group := ""          # front, back, roof, hall, side
	var mount := Vector3.ZERO
	var truss := -1          # the hall truss it hangs on, -1 when fixed
	var up := Vector3.UP     # from its base to its head
	var u := 0.0             # its place along its truss, 0..1
	var row := 0
	var xn := 0.0            # -1 at the left wall to 1 at the right
	var idx := 0
	var rp := 0.0            # random numbers that change every eight kicks
	var rt := 0.0
	var pos := Vector3.ZERO  # where its head is now
	var dir := Vector3.DOWN
	var yoke_z := Vector3.FORWARD
	var target := Vector3.ZERO
	var color := Color.WHITE
	var shown := Color.BLACK
	var level := 0.0
	var gobo := 0.0
	var spin := 0.0          # how fast the gobo turns, turns per beat
	var gobo_angle := 0.0
	var zoom := 1.0
	var light: SpotLight3D
	var surface := true
	var gain := 1.0          # the sequencer's share of this fixture now (smoothed)
	var x01 := 0.5           # where it hangs: across the hall 0..1, from the stage front to the rear truss 0..1
	var z01 := 0.0
	var stage := false       # on the stage (front, back, roof) rather than over the hall
	var fx_phase := 0.0      # its place in the look's movement and intensity effects (set per look)
	var ifx_phase := 0.0

class Batten:
	var mount := Vector3.ZERO
	var truss := -1
	var axis := Vector3.RIGHT
	var face := Vector3.FORWARD
	var group := ""
	var u := 0.0
	var color := Color.BLACK
	var level := 0.0
	var strobe := 0.0
	var chase := 0.0
	var chase_amount := 0.0
	var gain := 1.0
	var x01 := 0.5
	var z01 := 0.0
	var ifx_phase := 0.0

var fixtures: Array[Fixture] = []
var battens: Array[Batten] = []
var trusses: Array[Node3D] = []
var truss_targets := PackedFloat32Array([0, 0, 0, 0, 0])   # how far each hall truss should hang below its top, in metres
var truss_rolls := PackedFloat32Array([0, 0, 0, 0, 0])     # a truss whose two hoists stop at different heights, radians
var _truss_drops := PackedFloat32Array([0, 0, 0, 0, 0])
var _truss_speeds := PackedFloat32Array([0, 0, 0, 0, 0])
var strobe := 0.0          # the hall's strobe light, 0..1 this frame
var room_color := Color.WHITE   # the light of the show on the room itself: walls, floor, crowd and the haze
var room_level := 0.0           # as SV in the browser: about 2 quiet, 5-10 a groove, 30 on a kick, 100 in a strobe flash
var blinder := 0.0         # 0..1; the lamps glow and fade like tungsten
var laser_level := 0.0
var laser_color := Color(0.1, 1.0, 0.2)
var laser_spread := 0.6
var laser_tilt := 0.0
var laser_pan := 0.0
var beam_strength := 1.0
var _blinder_glow := 0.0
var _by_kind := [[], [], []]
var _mm := []              # per kind: {base, yoke, head, lens, beam}
var _mm_nodes := {}        # MultiMesh -> the node that draws it
var _batten_body: MultiMesh
var _batten_line: MultiMesh
var _blinder_lamps: MultiMesh
var _blinder_xf: Array[Transform3D] = []
var _blinder_lights: Array[SpotLight3D] = []
var _strobe_lights: Array[OmniLight3D] = []
var _lasers: Array[Vector3] = []
var _laser_mm: MultiMesh
var _body: StandardMaterial3D
var _gobo: Texture2D
var _beat := 0.0
var shape := "v"   # the hall trusses: a V with the point at the stage, or "straight" across (--trusses=straight)

const LASER_BEAMS := 9

func build() -> void:
	var alu := Kit.mat(Color(0.6, 0.61, 0.63), 0.32, 0.9)
	_body = Kit.mat(Color(0.03, 0.03, 0.034), 0.45, 0.25)
	_gobo = _gobo_texture()
	var chords := Kit.Batch.new(Kit.unit_tube(), alu)
	var braces := Kit.Batch.new(Kit.unit_tube(), alu)
	var plates := Kit.Batch.new(Kit.unit_box(), alu)
	var mounts := Kit.Batch.new(Kit.unit_tube(), alu, false)
	var safeties := Kit.Batch.new(Kit.unit_tube(), Kit.mat(Color(0.20, 0.21, 0.22), 0.45, 0.8), false)
	var feet := Kit.Batch.new(Kit.unit_box(), _body, false)
	var F := Hall.FRONT
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--trusses="): shape = a.get_slice("=", 1)

	# front: beams along the edge of the deck, with a gap where the PA hangs, battens between them
	for k in 30:
		var x := -20.3 + k * 1.4
		if absf(absf(x) - PA_X) < 1.4: continue
		_add(BEAM, "front", Vector3(x, Hall.DECK, F - 0.8), Vector3.UP, -1, (x + 20.3) / 40.6, 0)
	for x in [-19.5, -12.5, -7.5, -2.5, 2.5, 7.5, 12.5, 19.5]: _batten("front", Vector3(x, Hall.DECK + 0.1, F - 0.3), -1, Vector3.RIGHT, Vector3(0, 0.6, 0.8).normalized(), (x + 20.0) / 40.0)

	# back: seven towers behind the DJ, beams from 6 m up so that they pass over the DJ's head
	for k in 7:
		var x := -18.0 + k * 6.0
		var z := Hall.BACK + 1.0
		Kit.truss(chords, braces, Vector3(x, Hall.DECK, z), Vector3(x, 13.8, z), 0.3)
		for j in 3: _add(BEAM, "back", Vector3(x, 6.5 + j * 3.0, z + 0.15), Vector3.BACK, -1, k / 6.0, j)
		for j in 2: _batten("back", Vector3(x, 8.0 + j * 3.0, z + 0.22), -1, Vector3.UP, Vector3.BACK, k / 6.0)

	# roof: two trusses over the stage, spots, washes and blinders at the crowd
	var rz := F - 2.5
	for z in [rz, rz - 5.0]: _hung(chords, braces, Vector3(-21, 11.8, z), Vector3(21, 11.8, z))   # the back one clear of the towers
	for k in 12:
		var u := k / 11.0
		_add(SPOT, "roof", Vector3(-19.25 + u * 38.5, 11.55, rz), Vector3.DOWN, -1, u, 0)
	for k in 8:
		var u := k / 7.0
		_add(WASH, "roof", Vector3(-17.5 + u * 35.0, 11.55, rz - 5.0), Vector3.DOWN, -1, u, 1)
	for k in 8:
		var x := -17.5 + k * 5.0
		_blinder(Vector3(x, 11.4, rz + 0.35), Vector3(x * 1.3, 1.5, 6.0))
	if LASERS:
		for x in [-15.0, -9.0, -3.0, 3.0, 9.0, 15.0]: _lasers.append(Vector3(x, 11.25, rz + 0.45))

	# hall: five trusses over the crowd on winches, at two heights by turns
	for i in TRUSS_Z.size():
		var t := Node3D.new()
		t.position = Vector3(0, TRUSS_Y[i], TRUSS_Z[i])
		add_child(t)
		trusses.append(t)
		var c := Kit.Batch.new(Kit.unit_tube(), alu)
		var b := Kit.Batch.new(Kit.unit_tube(), alu)
		if shape == "v":
			Kit.truss(c, b, Vector3(-19, 0, V_DEPTH), Vector3(0, 0, 0))
			Kit.truss(c, b, Vector3(0, 0, 0), Vector3(19, 0, V_DEPTH))
		else: Kit.truss(c, b, Vector3(-19, 0, 0), Vector3(19, 0, 0))
		for x in [-13.0, 0.0, 13.0]: _hoist(c, Vector3(x, 0.2, _bend(x)), Hall.H - TRUSS_Y[i] + 3.0)
		c.build(t)
		b.build(t)
		# hung the way a rigger would: all on the truss's line, evenly spaced, each arm the mirror of the other,
		# counted from the middle out: beams, with a wash, a spot and a strobe batten between them
		var z: float = TRUSS_Z[i]
		var y: float = TRUSS_Y[i]
		for side in [-1.0, 1.0]:
			var along := Vector3(19.0 * float(side), 0, _bend(19.0)).normalized()
			for k in ARM.size():
				var d := (k + 0.5) * 1.75   # metres from the middle, along the truss
				var at := Vector3(0, 0, z) + along * d
				var u := clampf(0.5 + at.x / 38.0, 0.0, 1.0)
				match ARM[k]:
					"beam": _add(BEAM, "hall", at + Vector3(0, y - 0.25, 0), Vector3.DOWN, i, u, i)
					"spot": _add(SPOT, "hall", at + Vector3(0, y - 0.3, 0), Vector3.DOWN, i, u, i)
					"wash": _add(WASH, "hall", at + Vector3(0, y - 0.28, 0), Vector3.DOWN, i, u, i)
					"batten": _batten("hall", at + Vector3(0, y - 0.28, 0), i, along, Vector3.DOWN, u)

	# rear: a truss at the back of the hall, its light at the stage and over the crowd, towards the DJ
	var bz := 26.0
	_hung(chords, braces, Vector3(-19, 11.0, bz), Vector3(19, 11.0, bz))
	for k in 12:
		var u := k / 11.0
		_add(BEAM, "rear", Vector3(-17.5 + u * 35.0, 10.75, bz), Vector3.DOWN, -1, u, 0)
	for k in 6:
		var u := k / 5.0
		_add(WASH, "rear", Vector3(-15.0 + u * 30.0, 10.72, bz + 0.45), Vector3.DOWN, -1, u, 0)
	var at_stage := Vector3(0, -0.25, -1).normalized()
	for x in [-14.0, -7.0, 0.0, 7.0, 14.0]: _batten("rear", Vector3(x + 1.75, 10.72, bz - 0.45), -1, Vector3.RIGHT, at_stage, (x + 19.0) / 38.0)
	for x in [-12.0, -4.0, 4.0, 12.0]: _blinder(Vector3(x, 10.55, bz - 0.4), Vector3(x * 0.8, 1.5, -8.0))

	# delay towers halfway down either side: a box-truss tower on a base plate, a bar across its top with the beams
	# hung on it, battens down the front
	for s in [-1.0, 1.0]:
		var x: float = s * 15.5
		var z := 4.0
		Kit.truss(chords, braces, Vector3(x, 0.05, z), Vector3(x, 9.0, z), 0.5)
		Kit.truss(chords, braces, Vector3(x - 1.0, 9.0, z), Vector3(x + 1.0, 9.0, z), 0.3)
		plates.add(Kit.block(Vector3(0.9, 0.05, 0.9), Vector3(x, 0.025, z)))
		# Visible outriggers and ballast are visual detail, not a load-rated structural model.
		for sx in [-1.0, 1.0]:
			for sz in [-1.0, 1.0]:
				var foot := Vector3(x + sx * 0.88, 0.12, z + sz * 0.88)
				braces.add(Kit.tube(Vector3(x + sx * 0.23, 0.12, z + sz * 0.23), foot, 0.045))
				feet.add(Kit.block(Vector3(0.24, 0.08, 0.24), Vector3(foot.x, 0.04, foot.z)))
				chords.add(Kit.tube(Vector3(foot.x, 0.08, foot.z), Vector3(foot.x, 0.19, foot.z), 0.018))
			feet.add(Kit.block(Vector3(0.24, 0.24, 0.72), Vector3(x + sx * 0.34, 0.17, z)))
		for j in 4:
			var f := _add(BEAM, "delay", Vector3(x + (j - 1.5) * 0.5, 9.2, z), Vector3.UP, -1, j / 3.0, 0)
			f.xn = s
			_delay_mount(mounts, safeties, f.mount)
		for h in [4.0, 7.0]: _batten("delay", Vector3(x, h, z - 0.32), -1, Vector3.UP, Vector3.FORWARD, 0.5 + s * 0.5)

	# side: towers on the floor along both walls, beams across the hall and a batten up each
	for s in [-1.0, 1.0]:
		for z in SIDE_Z:
			var x: float = s * 20.6
			Kit.truss(chords, braces, Vector3(x, 0, z), Vector3(x, 7.5, z), 0.3)
			for j in 2:
				var f := _add(BEAM, "side", Vector3(x - s * 0.15, 3.5 + j * 3.5, z), Vector3(-s, 0, 0), -1, (z + 19.0) / 40.0, j)
				f.xn = s
			_batten("side", Vector3(x - s * 0.22, 5.25, z), -1, Vector3.UP, Vector3(-s, 0, 0), (z + 19.0) / 40.0)

	chords.build(self)
	braces.build(self)
	plates.build(self)
	mounts.build(self).name = "DelayMounts"
	safeties.build(self).name = "DelaySafeties"
	feet.build(self).name = "TowerFeet"

	for f in fixtures:
		f.x01 = clampf((f.mount.x + 21.0) / 42.0, 0.0, 1.0)
		f.z01 = clampf((f.mount.z - Hall.FRONT) / (26.0 - Hall.FRONT), 0.0, 1.0)
		f.stage = f.group in ["front", "back", "roof"]
	for b in battens:
		b.x01 = clampf((b.mount.x + 21.0) / 42.0, 0.0, 1.0)
		b.z01 = clampf((b.mount.z - Hall.FRONT) / (26.0 - Hall.FRONT), 0.0, 1.0)
	for i in fixtures.size():
		fixtures[i].idx = i
		fixtures[i].rp = randf()
		fixtures[i].rt = randf()
	for k in 3: _mm.append(_kind_batches(k))
	_batten_batches()
	if LASERS: _laser_batches()
	# the strobes light the hall through a few shared lamps
	for p in [Vector3(0, 9, Hall.BACK + 2), Vector3(0, 3, F - 0.5), Vector3(0, 10.5, -8), Vector3(0, 10, 22)]:
		var o := OmniLight3D.new()
		o.position = p
		o.omni_range = 30
		o.light_energy = 0.0
		o.light_color = Color(0.92, 0.95, 1.0)
		o.light_volumetric_fog_energy = 0.12
		o.visible = false
		add_child(o)
		_strobe_lights.append(o)

# Two omega rails under each fixed delay head, clamped round the crossbar's upper chords.
# The closed safety loop joins the base to the bar independently of those rails.
func _delay_mount(mounts: Kit.Batch, safeties: Kit.Batch, at: Vector3) -> void:
	for dx in [-0.105, 0.105]:
		mounts.add(Kit.tube(at + Vector3(dx, -0.015, -0.19), at + Vector3(dx, -0.015, 0.19), 0.015))
		for dz in [-0.15, 0.15]:
			var centre := at + Vector3(dx, -0.05, dz)
			for i in 16:
				var a := TAU * i / 16.0
				var b := TAU * (i + 1) / 16.0
				mounts.add(Kit.tube(centre + Vector3(0, cos(a), sin(a)) * 0.032, centre + Vector3(0, cos(b), sin(b)) * 0.032, 0.007))
	Kit.cable(safeties, [at + Vector3(0.16, 0.04, -0.10), at + Vector3(0.20, -0.08, -0.22),
		at + Vector3(0.20, -0.23, -0.22), at + Vector3(0.20, -0.27, -0.14), at + Vector3(0.20, -0.23, -0.08),
		at + Vector3(0.20, -0.06, -0.11), at + Vector3(0.20, -0.015, -0.15), at + Vector3(0.18, -0.005, -0.18),
		at + Vector3(0.16, 0.04, -0.10)], 0.0035)

# Where something hung on hall truss i is now (the truss may be let down or rolled); fixed things stay put.
func _hung_at(mount: Vector3, i: int) -> Vector3:
	if i < 0: return mount
	return trusses[i].transform * (mount - Vector3(0, TRUSS_Y[i], TRUSS_Z[i]))

# A chain hoist: heavy trusses keep their speed and acceleration limits (SV's rig-motion.js), up faster than down,
# and never lower than 5.5 m. Small steps, so braking and turning round stay smooth when a frame takes longer.
func _winch(i: int, target: float, dt: float) -> void:
	var lowest: float = TRUSS_Y[i] - 5.5
	target = clampf(target, 0.0, lowest)
	var drop := _truss_drops[i]
	var v := _truss_speeds[i]
	var speed := 1.1 if target < drop else 0.42
	var left := clampf(dt, 0.0, 0.25)
	while left > 1e-8:
		var step := minf(left, 1.0 / 120.0)
		var gap := target - drop
		var want := 0.0 if absf(gap) < 0.0001 else signf(gap) * minf(speed, sqrt(2.0 * 0.3 * absf(gap)) * 0.8)
		var before := v
		v += clampf(want - before, -0.3 * step, 0.3 * step)
		drop += (before + v) * 0.5 * step
		if drop < 0.0 or drop > lowest:
			drop = clampf(drop, 0.0, lowest)
			v = 0.0
		if absf(target - drop) < 0.0001 and v == 0.0: drop = target
		left -= step
	_truss_drops[i] = drop
	_truss_speeds[i] = v

# Draw the beams or not (a measurement of what they cost, or a setting).
func set_beams_visible(on: bool) -> void:
	for m in _mm: _mm_nodes[m.beam].visible = on

# How far a point on a hall truss lies from the truss's middle line, towards the back: 0 when straight.
func _bend(x: float) -> float:
	return absf(x) / 19.0 * V_DEPTH if shape == "v" else 0.0

# A truss hung from the roof: the truss, a hoist over it every 10 metres or so, the chain up to the steel.
func _hung(chords: Kit.Batch, braces: Kit.Batch, a: Vector3, b: Vector3) -> void:
	Kit.truss(chords, braces, a, b)
	var n := maxi(2, roundi(a.distance_to(b) / 10.0) + 1)
	for i in n:
		var p := a.lerp(b, (i + 0.5) / n) + Vector3(0, 0.2, 0)
		_hoist(chords, p, Hall.H - p.y)

func _hoist(batch: Kit.Batch, at: Vector3, chain: float) -> void:
	batch.add(Kit.tube(at, at + Vector3(0, 0.38, 0), 0.12))
	batch.add(Kit.tube(at + Vector3(0, 0.38, 0), at + Vector3(0, chain, 0), 0.006))

func _add(kind: int, group: String, mount: Vector3, up: Vector3, truss: int, u: float, row: int) -> Fixture:
	var f := Fixture.new()
	f.kind = kind
	f.group = group
	f.mount = mount
	f.truss = truss
	f.up = up
	f.u = u
	f.row = row
	f.xn = clampf(mount.x / 20.0, -1.0, 1.0)
	f.dir = up
	f.yoke_z = Vector3.BACK if absf(up.z) < 0.5 else Vector3.UP
	var K: Dictionary = KINDS[kind]
	f.light = SpotLight3D.new()
	f.light.spot_angle = K.light
	f.light.spot_angle_attenuation = 0.5
	f.light.spot_range = K.len + 5.0
	f.light.light_energy = 0.0
	f.light.visible = false
	if kind == SPOT: f.light.light_projector = _gobo
	add_child(f.light)
	fixtures.append(f)
	_by_kind[kind].append(f)
	return f

func _batten(group: String, mount: Vector3, truss: int, axis: Vector3, face: Vector3, u: float) -> void:
	var b := Batten.new()
	b.group = group
	b.mount = mount
	b.truss = truss
	b.axis = axis
	b.face = face
	b.u = u
	battens.append(b)

func _blinder(at: Vector3, towards: Vector3) -> void:
	# a two-lite at the crowd, tilted down; the lamps are drawn together, a light for every second one
	var aim := (towards - at).normalized()
	var x := Vector3.UP.cross(aim).normalized()
	var b := Basis(x, aim.cross(x), aim)
	Kit.box(self, Vector3(0.62, 0.32, 0.2), at, _body).basis = b
	for s in [-0.15, 0.15]: _blinder_xf.append(Transform3D(b * Basis(Vector3.RIGHT, PI / 2), at + b.x * s + aim * 0.11))
	if _blinder_xf.size() % 4 == 2:
		var l := SpotLight3D.new()
		l.spot_angle = 45
		l.spot_range = 50
		l.light_color = Color(1.0, 0.6, 0.3)
		l.light_energy = 0.0
		l.visible = false
		add_child(l)
		l.global_transform = Transform3D(Basis.looking_at(aim, Vector3.UP), at + aim * 0.3)
		_blinder_lights.append(l)

# --- the batches ---

func _multimesh(mesh: Mesh, n: int, material: Material, colors := false, custom := false, cast := true) -> MultiMesh:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = colors
	mm.use_custom_data = custom
	mm.mesh = mesh
	mm.instance_count = n
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	_mm_nodes[mm] = mi
	mi.material_override = material
	mi.extra_cull_margin = 60.0
	if not cast: mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	return mm

func _kind_batches(kind: int) -> Dictionary:
	var K: Dictionary = KINDS[kind]
	var n: int = _by_kind[kind].size()
	var base := BoxMesh.new()
	base.size = K.base
	var head := CylinderMesh.new()
	head.top_radius = K.r
	head.bottom_radius = K.r * 0.85
	head.height = K.body
	head.radial_segments = 16
	var lens := CylinderMesh.new()
	lens.top_radius = K.lens
	lens.bottom_radius = K.lens
	lens.height = 0.012
	lens.radial_segments = 20
	var cone := CylinderMesh.new()
	cone.height = K.len
	cone.bottom_radius = K.lens * 0.8 * K.halo   # the mesh holds the core and its scattered halo
	cone.top_radius = (K.lens * 0.8 + tan(deg_to_rad(K.angle)) * K.len) * K.halo
	cone.radial_segments = 24
	cone.rings = 1
	cone.cap_top = false
	cone.cap_bottom = false
	var beam_mat := Kit.shader("res://shaders/beam.gdshader", {"beam_length": K.len, "strength": K.strength, "lens_radius": K.lens * 0.8, "spread": tan(deg_to_rad(K.angle)), "halo": K.halo})
	return {
		"base": _multimesh(base, n, _body),
		"yoke": _multimesh(_yoke_mesh(K.r), n, _body),
		"head": _multimesh(head, n, _body),
		"lens": _multimesh(lens, n, Kit.shader("res://shaders/lens.gdshader", {"gain": 16.0}), true, false, false),
		"beam": _multimesh(cone, n, beam_mat, true, true, false),
	}

# The yoke: two arms up from the base and the bar between them, along +Y.
func _yoke_mesh(r: float) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for part in [[Vector3(0.05, 0.4, 0.12), Vector3(-(r + 0.06), 0.2, 0)], [Vector3(0.05, 0.4, 0.12), Vector3(r + 0.06, 0.2, 0)], [Vector3(2 * r + 0.17, 0.05, 0.12), Vector3(0, 0.025, 0)]]:
		var b := BoxMesh.new()
		b.size = part[0]
		st.append_from(b, 0, Transform3D(Basis.IDENTITY, part[1]))
	return st.commit()

func _batten_batches() -> void:
	var body := BoxMesh.new()
	body.size = Vector3(1.03, 0.13, 0.16)
	var line := BoxMesh.new()
	line.size = Vector3(1.0, 0.05, 0.01)
	_batten_body = _multimesh(body, battens.size(), _body)
	_batten_line = _multimesh(line, battens.size(), Kit.shader("res://shaders/batten.gdshader"), true, true, false)
	var lamp := CylinderMesh.new()
	lamp.top_radius = 0.12
	lamp.bottom_radius = 0.12
	lamp.height = 0.01
	_blinder_lamps = _multimesh(lamp, _blinder_xf.size(), Kit.shader("res://shaders/lens.gdshader", {"gain": 6.0}), true, false, false)
	for i in _blinder_xf.size(): _blinder_lamps.set_instance_transform(i, _blinder_xf[i])

func _laser_batches() -> void:
	var cone := CylinderMesh.new()
	cone.height = 70.0
	cone.bottom_radius = 0.004
	cone.top_radius = 0.05
	cone.radial_segments = 6
	cone.rings = 1
	cone.cap_top = false
	cone.cap_bottom = false
	_laser_mm = _multimesh(cone, _lasers.size() * LASER_BEAMS, Kit.shader("res://shaders/beam.gdshader", {"beam_length": 70.0, "strength": 1.5, "sharp": 1.0}), true, true, false)
	for x in _lasers: Kit.box(self, Vector3(0.32, 0.18, 0.36), x - Vector3(0, 0.1, 0), _body)

# A gobo: a ring of seven holes round a smaller one in the middle, soft at the edges.
func _gobo_texture() -> Texture2D:
	var n := 128
	var img := Image.create(n, n, false, Image.FORMAT_L8)
	for y in n:
		for x in n:
			var p := Vector2(x, y) / n * 2.0 - Vector2.ONE
			var v := 0.0
			for k in 7:
				var c := Vector2(cos(k * TAU / 7.0), sin(k * TAU / 7.0)) * 0.55
				v = maxf(v, smoothstep(0.24, 0.17, p.distance_to(c)))
			v = maxf(v, smoothstep(0.17, 0.1, p.length()))
			v *= smoothstep(1.0, 0.92, p.length())
			img.set_pixel(x, y, Color(v, v, v))
	return ImageTexture.create_from_image(img)

# The graphics settings: how many heads light the surfaces, whether they glow in the haze, how many cast shadows.
func configure(surface_share: float, fog: bool, shadows: int) -> void:
	var stride := maxi(1, roundi(1.0 / maxf(surface_share, 0.01)))
	var shadowed := 0
	for f in fixtures:
		f.surface = surface_share >= 0.99 or f.kind == WASH or f.idx % stride == 0
		f.light.light_volumetric_fog_energy = (0.12 if f.kind == WASH else 0.3) if fog else 0.0
		var cast := f.kind == SPOT and f.group == "roof" and shadowed < shadows
		f.light.shadow_enabled = cast
		if cast: shadowed += 1
	for l in _blinder_lights: l.light_volumetric_fog_energy = 0.25 if fog else 0.0

# --- every frame ---

func update(dt: float, beat: float) -> void:
	var beat_dt := beat - _beat
	_beat = beat
	for i in trusses.size():
		var t := trusses[i]
		_winch(i, truss_targets[i], dt)
		t.position.y = TRUSS_Y[i] - _truss_drops[i]
		t.rotation.z = lerpf(t.rotation.z, truss_rolls[i], 1.0 - exp(-dt * 0.4))
	for kind in 3:
		var K: Dictionary = KINDS[kind]
		var m: Dictionary = _mm[kind]
		var list: Array = _by_kind[kind]
		var follow := 1.0 - exp(-dt * K.follow)
		var max_turn: float = K.speed * dt
		var bh: float = K.base.y
		for i in list.size():
			var f: Fixture = list[i]
			var at := _hung_at(f.mount, f.truss)
			var pivot := at + f.up * (bh + 0.3)
			f.pos = pivot
			var want := f.target - pivot
			if want.length_squared() < 0.01: want = f.up
			want = want.normalized()
			var angle := f.dir.angle_to(want)
			if angle > 0.0001: f.dir = f.dir.slerp(want, minf(1.0, minf(angle * follow, max_turn) / angle)).normalized()
			# the yoke turns about the base's axis; the head tilts in the yoke
			var flat := f.dir - f.up * f.dir.dot(f.up)
			if flat.length() > 0.03: f.yoke_z = flat.normalized()
			var yx := f.up.cross(f.yoke_z).normalized()
			var zb := yx.cross(f.dir)
			var hb := Basis(yx, f.dir, zb)
			m.base.set_instance_transform(i, Transform3D(Basis(yx, f.up, f.yoke_z), at + f.up * (bh * 0.5)))
			m.yoke.set_instance_transform(i, Transform3D(Basis(yx, f.up, f.yoke_z), at + f.up * bh))
			m.head.set_instance_transform(i, Transform3D(hb, pivot))
			m.lens.set_instance_transform(i, Transform3D(hb, pivot + f.dir * (K.body * 0.5 + 0.007)))
			var z := f.zoom
			m.beam.set_instance_transform(i, Transform3D(Basis(yx * z, f.dir, zb * z), pivot + f.dir * (K.body * 0.5 + K.len * 0.5 + 0.01)))
			# beams change colour on a wheel (at once), spots and washes mix it
			f.shown = f.color if kind == BEAM else f.shown.lerp(f.color, 1.0 - exp(-dt * 8.0))
			var c := f.shown * f.level
			m.lens.set_instance_color(i, Color(c.r, c.g, c.b, 1.0))
			m.beam.set_instance_color(i, Color(c.r, c.g, c.b, beam_strength if f.level > 0.003 else 0.0))
			f.gobo_angle += f.spin * TAU * beat_dt
			m.beam.set_instance_custom_data(i, Color(f.gobo, f.gobo_angle, z, 0))
			var lit := f.surface and f.level > 0.01
			f.light.visible = lit
			if lit:
				f.light.global_transform = Transform3D(Basis(yx, zb, -f.dir) * Basis(Vector3.BACK, f.gobo_angle), pivot + f.dir * (K.body * 0.5))
				f.light.light_color = f.shown
				f.light.light_energy = K.energy * f.level
				f.light.spot_angle = K.light * z
	for i in battens.size():
		var b := battens[i]
		var at := _hung_at(b.mount, b.truss)
		var y := b.face.cross(b.axis)
		var bb := Basis(b.axis, y, b.face)
		_batten_body.set_instance_transform(i, Transform3D(bb, at))
		_batten_line.set_instance_transform(i, Transform3D(bb, at + b.face * 0.085))
		var c := b.color * b.level
		_batten_line.set_instance_color(i, Color(c.r, c.g, c.b, 1.0))
		_batten_line.set_instance_custom_data(i, Color(b.strobe, b.chase, b.chase_amount, 0))
	for o in _strobe_lights:
		o.visible = strobe > 0.02
		o.light_energy = 16.0 * strobe
	# tungsten: up fast, down slowly
	_blinder_glow = maxf(blinder, _blinder_glow - dt * (1.5 if _blinder_glow > 0.3 else 0.6))
	var g := Color(1.0, 0.5, 0.18) * _blinder_glow * _blinder_glow
	for i in _blinder_xf.size(): _blinder_lamps.set_instance_color(i, Color(g.r, g.g, g.b, 1.6))
	for l in _blinder_lights:
		l.visible = _blinder_glow > 0.01
		l.light_energy = 35.0 * _blinder_glow * _blinder_glow
	if _lasers.is_empty(): return
	var lc := laser_color * laser_level
	var n := 0
	for li in _lasers.size():
		var at := _lasers[li]
		var side := -1.0 if at.x < 0.0 else 1.0
		for k in LASER_BEAMS:
			var yaw := (k - (LASER_BEAMS - 1) * 0.5) * 0.1 * laser_spread + laser_pan * side
			var d := Vector3(sin(yaw), sin(laser_tilt), cos(yaw)).normalized()
			var x := Vector3.UP.cross(d).normalized()
			_laser_mm.set_instance_transform(n, Transform3D(Basis(x, d, x.cross(d)), at + d * 35.1))
			_laser_mm.set_instance_color(n, Color(lc.r, lc.g, lc.b, beam_strength if laser_level > 0.01 else 0.0))
			_laser_mm.set_instance_custom_data(n, Color(0, 0, 0, 0))
			n += 1
