class_name Hall
extends Node3D
# The hall: a hangar of 44 by 76 metres and 15 high, steel portal frames every 9.5 metres on a concrete base.
# One stage across the full width of the short end at -Z (10 deep, 1.6 high), the booth in its middle, the PA
# hung either side, subs on the floor in front, a barrier. Metres, Y up, the crowd towards +Z.

const W := 44.0
const D := 76.0
const H := 15.0
const DECK := 1.6
const FRONT := -28.0        # the stage's front edge
const BACK := -D / 2        # the back wall behind the stage
const BOOTH_Z := -33.0      # the front of the DJ table
const RISER := 0.4
const TABLE := DECK + RISER + 1.05
const BARRIER := -24.0

@export_enum("Two decks:2", "Festival — four decks:4") var booth_decks := 2
var screens: Array[ShaderMaterial] = []
var _floor: StandardMaterial3D
var _wet_floor := false

func build() -> void:
	var black := Kit.mat(Color(0.018, 0.018, 0.02), 0.8)
	var frame := Kit.mat(Color(0.1, 0.105, 0.11), 0.45, 0.7)
	var boxes := Kit.Batch.new(Kit.unit_box(), frame)
	var dark := Kit.Batch.new(Kit.unit_box(), black)

	# floor, walls on a concrete base, roof, the hangar door at the far end
	var ground := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(W, D)
	ground.mesh = pm
	ground.material_override = _concrete()
	add_child(ground)
	var steel := _cladding()
	var plinth := Kit.mat(Color(0.28, 0.27, 0.25), 0.9)
	plinth.uv1_triplanar = true
	for s in [-1.0, 1.0]:
		Kit.box(self, Vector3(0.3, H, D), Vector3(s * (W / 2 + 0.15), H / 2, 0), steel)
		Kit.box(self, Vector3(0.2, 2.9, D), Vector3(s * (W / 2 - 0.1), 1.45, 0), plinth)
	Kit.box(self, Vector3(W, H, 0.3), Vector3(0, H / 2, BACK - 0.15), steel)
	Kit.box(self, Vector3(W, H, 0.3), Vector3(0, H / 2, D / 2 + 0.15), steel)
	var door := Kit.mat(Color(0.17, 0.18, 0.19), 0.5, 0.6)
	for i in 6: Kit.box(self, Vector3(27 / 6.0 - 0.06, 12.6, 0.12), Vector3(-13.5 + (i + 0.5) * 27 / 6.0, 6.3, D / 2 - 0.06), door)
	boxes.add(Kit.block(Vector3(28, 0.5, 0.4), Vector3(0, 12.85, D / 2 - 0.2)))
	Kit.box(self, Vector3(W, 0.3, D), Vector3(0, H + 0.15, 0), Kit.mat(Color(0.13, 0.13, 0.14), 0.85))
	var z := -D / 2
	while z <= D / 2 + 0.01:
		for s in [-1.0, 1.0]: boxes.add(Kit.block(Vector3(0.45, H, 0.3), Vector3(s * (W / 2 - 0.45), H / 2, z)))
		boxes.add(Kit.block(Vector3(W - 0.9, 0.7, 0.3), Vector3(0, H - 0.5, z)))
		boxes.add(Kit.block(Vector3(0.18, 1.6, 0.18), Vector3(-W / 2 + 1.2, H - 1.4, z), 0.0))
		boxes.add(Kit.block(Vector3(0.18, 1.6, 0.18), Vector3(W / 2 - 1.2, H - 1.4, z), 0.0))
		z += 9.5
	for x in range(-18, 19, 4): boxes.add(Kit.block(Vector3(0.12, 0.2, D), Vector3(x, H - 0.25, 0)))

	# the stage across the full width, its black skirt, the booth's riser
	dark.add(Kit.block(Vector3(6, RISER, 3.2), Vector3(0, DECK + RISER / 2, BOOTH_Z - 0.6)))
	var deck_top := Kit.mat(Color(0.03, 0.03, 0.03), 0.55)
	# One solid deck: no second skin crossing the riser or sharing the stage's faces.
	Kit.box(self, Vector3(W - 0.4, DECK, FRONT - BACK), Vector3(0, DECK / 2, (FRONT + BACK) / 2), deck_top).name = "StageDeck"
	_curtain()
	_house_lights()
	_booth(black)
	_pa(dark)
	_hazers(boxes, dark)
	_haze()
	# the barrier, the full width
	var barrier := Kit.mat(Color(0.33, 0.34, 0.35), 0.4, 0.8)
	Kit.box(self, Vector3(W - 3.0, 1.15, 0.12), Vector3(0, 0.62, BARRIER), barrier)
	Kit.box(self, Vector3(W - 3.0, 0.08, 1.1), Vector3(0, 0.04, BARRIER - 0.5), barrier)
	boxes.build(self)
	dark.build(self)

# Two floor hazers at the rear, with recessed outlets facing the crowd.
func _hazers(boxes: Kit.Batch, dark: Kit.Batch) -> void:
	for side in [-1.0, 1.0]:
		var pos := Vector3(side * 17.8, DECK, -36.1)
		boxes.add(Kit.block(Vector3(0.66, 0.38, 0.85), pos + Vector3(0, 0.25, 0)))
		# Split the front plate around a black, recessed outlet.
		dark.add(Kit.block(Vector3(0.5, 0.16, 0.025), pos + Vector3(0, 0.29, 0.432)))
		boxes.add(Kit.block(Vector3(0.52, 0.025, 0.06), pos + Vector3(0, 0.2, 0.45)))
		for x in [-0.28, 0.28]:
			dark.add(Kit.block(Vector3(0.08, 0.07, 0.6), pos + Vector3(x, 0.035, 0)))
		for x in [-0.12, 0.0, 0.12]:
			boxes.add(Kit.block(Vector3(0.018, 0.13, 0.025), pos + Vector3(x, 0.29, 0.45)))

# Five static volumes on the existing fog grid: no particles or noise textures.
# Negative density thins the existing global haze in the roof space.
func _haze() -> void:
	_fog("StageHaze", Vector3(0, DECK + 1.3, -32.4), Vector3(W - 1.0, 3.6, 11.0), 0.014)
	_fog("CrowdHaze", Vector3(0, 3.7, 2.5), Vector3(W - 1.0, 5.0, 56.0), 0.006)
	_fog("RoofHaze", Vector3(0, 12.4, 0), Vector3(W, 7.0, D), -0.006)
	for side in [-1.0, 1.0]:
		_fog("HazerLeft" if side < 0 else "HazerRight", Vector3(side * 17.8, DECK + 0.7, -34.9), Vector3(3.2, 2.4, 4.8), 0.022, RenderingServer.FOG_VOLUME_SHAPE_ELLIPSOID)

func _fog(label: String, pos: Vector3, size: Vector3, density: float, shape: int = RenderingServer.FOG_VOLUME_SHAPE_BOX) -> void:
	var fog := FogVolume.new()
	fog.name = label
	fog.position = pos
	fog.size = size
	fog.shape = shape
	var material := FogMaterial.new()
	material.density = density
	material.albedo = Color(0.92, 0.93, 0.96)
	material.edge_fade = 0.4
	fog.material = material
	add_child(fog)

# Pleated black cloth behind the rear towers, from the deck to the roof frame.
func _curtain() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var panels := 240
	for i in panels:
		var x0 := -W / 2 + 0.3 + (W - 0.6) * i / panels
		var x1 := -W / 2 + 0.3 + (W - 0.6) * (i + 1) / panels
		var z0 := -37.8 + (0.07 if i % 2 == 0 else -0.07)
		var z1 := -37.8 + (-0.07 if i % 2 == 0 else 0.07)
		var a := Vector3(x0, DECK, z0)
		var b := Vector3(x0, 14.2, z0)
		var c := Vector3(x1, 14.2, z1)
		var d := Vector3(x1, DECK, z1)
		for v in [a, b, c, a, c, d]: st.add_vertex(v)
	st.generate_normals()
	var cloth := MeshInstance3D.new()
	cloth.name = "StageCurtain"
	cloth.mesh = st.commit()
	var material := Kit.mat(Color(0.006, 0.006, 0.007), 1.0)
	material.cull_mode = BaseMaterial3D.CULL_DISABLED
	cloth.material_override = material
	add_child(cloth)

# Small familiar details give the dark hangar a human scale.
func _house_lights() -> void:
	var door := Kit.mat(Color(0.08, 0.09, 0.09), 0.85)
	var signs := StandardMaterial3D.new()
	signs.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	signs.albedo_texture = _exit_texture()
	var fixtures := Kit.Batch.new(Kit.unit_box(), Kit.glowing(Color(0.6, 0.7, 0.8), 0.6), false)
	for side in [-1.0, 1.0]:
		for z in [-16.0, 16.0, 31.0]:
			Kit.box(self, Vector3(0.04, 2.25, 1.15), Vector3(side * 21.77, 1.125, z), door)
			_exit_sign(Vector3(side * 21.72, 2.65, z), -side * PI / 2.0, signs)
		for z in [-24.0, -5.0, 14.0, 33.0]:
			fixtures.add(Kit.block(Vector3(0.12, 0.1, 0.6), Vector3(side * 21.55, 4.0, z)))
			_house_light(Vector3(side * 21.0, 3.8, z), 6.5, 0.18)
		Kit.box(self, Vector3(1.15, 2.25, 0.04), Vector3(side * 17.0, 1.125, 37.78), door)
		_exit_sign(Vector3(side * 17.0, 2.65, 37.72), PI, signs)
		fixtures.add(Kit.block(Vector3(0.7, 0.1, 0.15), Vector3(side * 9.0, 7.0, 37.5)))
		_house_light(Vector3(side * 9.0, 6.8, 36.9), 9.0, 0.24)
	fixtures.build(self)

func _house_light(pos: Vector3, reach: float, power: float) -> void:
	var light := OmniLight3D.new()
	light.position = pos
	light.omni_range = reach
	light.omni_attenuation = 1.8
	light.light_color = Color(0.65, 0.75, 0.85)
	light.light_energy = power
	light.light_volumetric_fog_energy = 0.0
	light.shadow_enabled = false
	add_child(light)

func _exit_sign(pos: Vector3, yaw: float, material: Material) -> void:
	var sign := MeshInstance3D.new()
	var quad := QuadMesh.new()
	quad.size = Vector2(0.8, 0.4)
	sign.mesh = quad
	sign.material_override = material
	sign.position = pos
	sign.rotation.y = yaw
	sign.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(sign)

# Door, running figure and direction arrow, readable without a font.
func _exit_texture() -> ImageTexture:
	var image := Image.create(128, 64, false, Image.FORMAT_RGB8)
	image.fill(Color(0.015, 0.28, 0.1))
	for rect in [Rect2i(8, 8, 30, 48), Rect2i(48, 12, 8, 8), Rect2i(44, 23, 10, 20),
			Rect2i(33, 25, 15, 5), Rect2i(52, 30, 13, 5), Rect2i(38, 40, 8, 13),
			Rect2i(48, 40, 8, 8), Rect2i(53, 45, 13, 6), Rect2i(83, 29, 31, 6)]:
		image.fill_rect(rect, Color(0.8, 0.95, 0.85))
	image.fill_rect(Rect2i(12, 12, 22, 44), Color(0.015, 0.28, 0.1))
	for i in 13:
		image.fill_rect(Rect2i(103 + i, 20 + i, 3, 25 - i * 2), Color(0.8, 0.95, 0.85))
	return ImageTexture.create_from_image(image)

# Matte concrete on Light/Normal; a thin wet sheen when the existing SSR pass is enabled.
func _concrete() -> StandardMaterial3D:
	var m := Kit.mat(Color(0.23, 0.225, 0.215), 0.94)
	m.metallic_specular = 0.18
	var n := FastNoiseLite.new()
	n.seed = 52
	n.frequency = 0.025
	n.fractal_octaves = 3
	var rough := NoiseTexture2D.new()
	rough.noise = n
	rough.seamless = true
	rough.width = 256
	rough.height = 256
	var ramp := Gradient.new()
	ramp.set_color(0, Color(0.72, 0.72, 0.72))
	ramp.set_color(1, Color.WHITE)
	rough.color_ramp = ramp
	m.roughness_texture = rough
	var bumps := NoiseTexture2D.new()
	var nb := FastNoiseLite.new()
	nb.seed = 53
	nb.frequency = 0.12
	nb.fractal_octaves = 2
	bumps.noise = nb
	bumps.width = 256
	bumps.height = 256
	bumps.seamless = true
	bumps.as_normal_map = true
	bumps.bump_strength = 0.7
	m.normal_enabled = true
	m.normal_texture = bumps
	m.normal_scale = 0.22
	# The plane already has UVs. Avoid three texture samples per map for a flat floor.
	m.uv1_scale = Vector3(W / 4.0, D / 4.0, 1)
	_floor = m
	return m

func _update_floor() -> void:
	var environment := get_world_3d().environment
	var wet := environment != null and environment.ssr_enabled
	if wet == _wet_floor or _floor == null: return
	_wet_floor = wet
	_floor.roughness = 0.36 if wet else 0.94
	_floor.metallic_specular = 0.42 if wet else 0.18
	_floor.normal_scale = 0.09 if wet else 0.22

# Steel cladding with vertical ribs every 20 cm.
func _cladding() -> StandardMaterial3D:
	var img := Image.create(64, 4, false, Image.FORMAT_RGB8)
	for x in 64:
		var s := cos(x / 64.0 * TAU * 2.0)
		for y in 4: img.set_pixel(x, y, Color(0.5 + 0.45 * s, 0.5, 0.75))
	var m := Kit.mat(Color(0.19, 0.195, 0.2), 0.5, 0.55)
	m.normal_enabled = true
	m.normal_texture = ImageTexture.create_from_image(img)
	m.uv1_triplanar = true
	m.uv1_scale = Vector3(2.5, 2.5, 2.5)
	return m

# Dimensions in metres; local +Z is the back of a unit (away from the DJ).
# Official reference images and limits are recorded in docs/booth.md.
var _gear_batches := {}
var _deck_faces: Array[Dictionary] = []
var _booth_rb: Rekordbox
var _booth_tick := 0.0
var _booth_clock := 0.0
var _deck_motion := {}

func _booth(black: Material) -> void:
	var base := DECK + RISER
	var zt := BOOTH_Z - 0.45
	Kit.box(self, Vector3(3.2, 1.02, 0.9), Vector3(0, base + 0.51, zt), black).name = "BoothCarcass"
	Kit.box(self, Vector3(3.24, 0.03, 0.94), Vector3(0, TABLE - 0.015, zt), Kit.mat(Color(0.05, 0.05, 0.05), 0.35)).name = "BoothTop"
	# Both arrangements share a mixer, matching front edges and 18 mm clearances.
	for arg in OS.get_cmdline_user_args():
		if arg in ["--booth=festival", "--booth=4"]: booth_decks = 4
		elif arg in ["--booth=club", "--booth=2"]: booth_decks = 2
	var positions := [0.7566, 0.394, -0.394, -0.7566] if booth_decks == 4 else [0.394, -0.394]
	for i in positions.size():
		_cdj_3000x(Vector3(positions[i], TABLE, zt + 0.12), i + 1)
	_djm_a9(Vector3(0, TABLE, zt + 0.10395))
	for batch: Kit.Batch in _gear_batches.values(): batch.build(self)
	_gear_batches.clear()
	var lamp := SpotLight3D.new()
	lamp.position = Vector3(0, TABLE + 1.7, zt - 0.5)
	lamp.rotation_degrees = Vector3(-75, 0, 0)
	lamp.spot_angle = 38
	lamp.spot_range = 4
	lamp.light_energy = 1.4
	lamp.light_color = Color(1, 0.78, 0.55)
	lamp.light_volumetric_fog_energy = 0.0
	add_child(lamp)
	_booth_monitors(base, zt)
	# Main remains untouched: the sibling Rekordbox is updated by main before this node.
	process_priority = 10

func _gear_part(p: Node3D, size: Vector3, at: Vector3, color: Color, round_part := false) -> void:
	var key := str(color) + str(round_part)
	if not _gear_batches.has(key):
		_gear_batches[key] = Kit.Batch.new(Kit.unit_tube() if round_part else Kit.unit_box(), Kit.mat(color, 0.72, 0.15))
	var batch: Kit.Batch = _gear_batches[key]
	batch.add(p.transform * Transform3D(Basis.from_scale(size), at))

func _gear_knob(p: Node3D, x: float, z: float, radius := 0.006, y := 0.091) -> void:
	_gear_part(p, Vector3(radius, 0.014, radius), Vector3(x, y, z), Color(0.09, 0.095, 0.1), true)
	_gear_part(p, Vector3(0.0015, 0.001, radius * 0.8), Vector3(x, y + 0.0076, z + radius * 0.35), Color(0.7, 0.72, 0.73))

func _gear_text(p: Node3D, text: String, at: Vector3, width := 0.05, tilt := -90.0) -> Label3D:
	var label := Label3D.new()
	label.text = text
	label.font = preload("res://fonts/AtkinsonHyperlegible-Regular.otf")
	label.font_size = 40
	label.pixel_size = width / maxf(text.length() * 23.0, 40.0)
	label.modulate = Color(0.76, 0.78, 0.8)
	label.outline_size = 0
	label.scale.x = -1.0
	label.no_depth_test = false
	label.position = at
	label.rotation_degrees = Vector3(tilt, 180, 0)
	p.add_child(label)
	return label

func _gear_face(p: Node3D, size: Vector2, at: Vector3, material: Material, tilt := -90.0) -> MeshInstance3D:
	var face := MeshInstance3D.new()
	var quad := QuadMesh.new()
	quad.size = size
	face.mesh = quad
	face.scale.x = -1.0
	face.material_override = material
	face.position = at
	face.rotation_degrees = Vector3(tilt, 180, 0)
	face.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	p.add_child(face)
	return face

func _gear_disc(p: Node3D, radius: float, height: float, at: Vector3, material: Material) -> void:
	var part := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.top_radius = radius
	mesh.bottom_radius = radius
	mesh.height = height
	mesh.radial_segments = 64
	part.mesh = mesh
	part.position = at
	part.material_override = material
	p.add_child(part)

func _gear_fader(p: Node3D, x: float, z: float, length: float, horizontal := false, y := 0.084) -> void:
	var slot := Vector3(length, 0.001, 0.003) if horizontal else Vector3(0.003, 0.001, length)
	_gear_part(p, slot, Vector3(x, y, z), Color(0.003, 0.003, 0.004))
	for tick in 11:
		var t := (float(tick) / 10.0 - 0.5) * length
		var pos := Vector3(x + t, y + 0.0007, z) if horizontal else Vector3(x, y + 0.0007, z + t)
		for side in [-1.0, 1.0]:
			_gear_part(p, Vector3(0.0006, 0.001, 0.005) if horizontal else Vector3(0.005, 0.001, 0.0006), pos + (Vector3(0, 0, side * 0.007) if horizontal else Vector3(side * 0.007, 0, 0)), Color(0.4, 0.42, 0.44))
	_gear_part(p, Vector3(0.007, 0.008, 0.022) if horizontal else Vector3(0.022, 0.008, 0.007), Vector3(x, y + 0.005, z), Color(0.19, 0.2, 0.21))
	_gear_part(p, Vector3(0.001, 0.001, 0.02) if horizontal else Vector3(0.02, 0.001, 0.001), Vector3(x, y + 0.0095, z), Color(0.85, 0.86, 0.87))

func _cdj_3000x(at: Vector3, deck_id: int) -> void:
	var p := Node3D.new()
	p.name = "CDJ3000X_Deck%d" % deck_id
	p.position = at
	# Local X follows the front-panel photograph; camera faces world +Z.
	p.scale.x = -1.0
	add_child(p)
	var black := Kit.mat(Color(0.022, 0.023, 0.026), 0.88, 0.05)
	for x in [-0.133, 0.133]:
		for z in [-0.19, 0.19]: _gear_disc(p, 0.022, 0.014, Vector3(x, 0.007, z), black)
	Kit.box(p, Vector3(0.3446, 0.060, 0.4904), Vector3(0, 0.044, 0), black)
	Kit.box(p, Vector3(0.3406, 0.004, 0.4864), Vector3(0, 0.076, 0), Kit.mat(Color(0.035, 0.036, 0.039), 0.8, 0.1))
	# Integrated sloping touchscreen housing: highest point is 130.1 mm.
	var housing := Kit.box(p, Vector3(0.278, 0.012, 0.150), Vector3(0.004, 0.0988, 0.149), black)
	housing.rotation_degrees.x = -20
	var scr := Kit.shader("res://shaders/booth.gdshader", {"kind": 0, "deck": float(deck_id)})
	screens.append(scr)
	# 223.6 × 125.8 mm active glass = 10.1 inches diagonal, 16:9.
	_gear_face(p, Vector2(0.2236, 0.1258), Vector3(-0.006, 0.105, 0.148), scr, -70)
	var title := _gear_text(p, "DECK %d · rekordbox" % deck_id, Vector3(-0.006, 0.123, 0.191), 0.18, -70)
	var info := _gear_text(p, "NO LINK", Vector3(-0.006, 0.089, 0.096), 0.15, -70)
	title.pixel_size = 0.00032
	info.pixel_size = 0.00032
	title.scale.y = 1.5
	info.scale.y = 1.5
	# 206 mm jog rim, rubber grip scallops, metal lip, centre LCD.
	_gear_disc(p, 0.103, 0.014, Vector3(-0.018, 0.085, -0.062), black)
	for i in 40:
		var a := TAU * float(i) / 40
		_gear_part(p, Vector3(0.004, 0.003, 0.004), Vector3(-0.018 + cos(a) * 0.098, 0.093, -0.062 + sin(a) * 0.098), Color(0.11, 0.115, 0.12), true)
	_gear_disc(p, 0.091, 0.002, Vector3(-0.018, 0.093, -0.062), Kit.mat(Color(0.32, 0.34, 0.36), 0.32, 0.8))
	_gear_disc(p, 0.088, 0.002, Vector3(-0.018, 0.095, -0.062), black)
	var jog := Kit.shader("res://shaders/booth.gdshader", {"kind": 2, "deck": float(deck_id)})
	_gear_face(p, Vector2(0.065, 0.065), Vector3(-0.018, 0.0965, -0.062), jog)
	for b in 2:
		var z := -0.192 + b * 0.047
		_gear_disc(p, 0.019, 0.005, Vector3(-0.137, 0.081, z), Kit.mat(Color(0.18, 0.19, 0.2), 0.35, 0.7))
		var button := Kit.shader("res://shaders/booth.gdshader", {"kind": 1, "cue": b == 1})
		_gear_face(p, Vector2(0.036, 0.036), Vector3(-0.137, 0.084, z), button)
		if b == 0: _deck_faces.append({"screen": scr, "jog": jog, "play": button, "title": title, "info": info, "deck": str(deck_id)})
		_gear_text(p, "CUE" if b else "▶Ⅱ", Vector3(-0.137, 0.085, z), 0.018)
	_gear_fader(p, 0.136, -0.124, 0.174, false, 0.079)
	_gear_text(p, "TEMPO", Vector3(0.136, 0.079, -0.023), 0.027)
	# Eight hot cues directly below the display; transport/search to the left.
	for i in 8:
		var x := -0.098 + i * 0.031
		_gear_part(p, Vector3(0.023, 0.003, 0.012), Vector3(x, 0.081, 0.056), Color(0.1, 0.12, 0.13))
		_gear_part(p, Vector3(0.018, 0.001, 0.0015), Vector3(x, 0.083, 0.052), Color(0.15, 0.6, 0.45) if i % 2 == 0 else Color(0.36, 0.45, 0.7))
		_gear_text(p, String.chr(65 + i), Vector3(x, 0.084, 0.057), 0.006)
	for z in [-0.103, -0.073, -0.043, -0.013, 0.018]:
		for x in [-0.145, -0.12]: _gear_part(p, Vector3(0.018, 0.004, 0.009), Vector3(x, 0.081, z), Color(0.13, 0.14, 0.15))
	for z in [0.09, 0.12, 0.15, 0.18, 0.21]: _gear_part(p, Vector3(0.019, 0.004, 0.012), Vector3(-0.148, 0.081, z), Color(0.12, 0.13, 0.14))
	_gear_knob(p, 0.143, 0.12, 0.014, 0.096)
	_gear_knob(p, 0.115, 0.012, 0.008)
	_gear_knob(p, 0.115, -0.022)
	for z in [0.04, -0.052, -0.074]: _gear_part(p, Vector3(0.033, 0.003, 0.01), Vector3(0.135, 0.081, z), Color(0.13, 0.14, 0.15))
	_gear_text(p, "AlphaTheta", Vector3(-0.095, 0.079, -0.229), 0.075)
	_gear_text(p, "CDJ-3000X", Vector3(0.11, 0.079, -0.229), 0.06)

func _djm_a9(at: Vector3) -> void:
	var p := Node3D.new()
	p.name = "DJM_A9"
	p.position = at
	# Local X follows the front-panel photograph; camera faces world +Z.
	p.scale.x = -1.0
	add_child(p)
	var black := Kit.mat(Color(0.026, 0.027, 0.03), 0.8, 0.15)
	for x in [-0.16, 0.16]:
		for z in [-0.18, 0.18]: _gear_disc(p, 0.016, 0.01, Vector3(x, 0.005, z), black)
	Kit.box(p, Vector3(0.4074, 0.070, 0.4583), Vector3(0, 0.045, 0), black)
	Kit.box(p, Vector3(0.4034, 0.003, 0.4543), Vector3(0, 0.0815, 0), black)
	_gear_text(p, "Pioneer DJ", Vector3(-0.006, 0.084, 0.213), 0.072)
	_gear_text(p, "DJM-A9", Vector3(0.163, 0.084, -0.216), 0.044)
	# Centre: input selectors, TRIM, three-band EQ, COLOR, dual headphone cues, channel faders.
	for ch in 4:
		var x := -0.080 + ch * 0.043
		_gear_text(p, str(ch + 1), Vector3(x - 0.012, 0.084, 0.165), 0.009)
		for z in [0.185, 0.153, 0.12, 0.085, 0.05, 0.002]: _gear_knob(p, x, z, 0.008 if z < 0.14 else 0.006)
		for r in 4: _gear_text(p, ["TRIM", "HI", "MID", "LOW"][r], Vector3(x, 0.084, 0.166 - r * 0.035), 0.018)
		_gear_text(p, "COLOR", Vector3(x, 0.084, 0.020), 0.021)
		for dx in [-0.008, 0.01]: _gear_part(p, Vector3(0.013, 0.003, 0.009), Vector3(x + dx, 0.085, -0.038), Color(0.8, 0.32, 0.035))
		_gear_fader(p, x, -0.112, 0.057)
		_gear_part(p, Vector3(0.011, 0.004, 0.006), Vector3(x, 0.085, -0.168), Color(0.2, 0.21, 0.22))
		var meter := Kit.shader("res://shaders/booth.gdshader", {"kind": 3, "deck": float(ch + 1)})
		_gear_face(p, Vector2(0.003, 0.108), Vector3(x - 0.018, 0.084, 0.11), meter)
		_gear_part(p, Vector3(0.0006, 0.001, 0.365), Vector3(x - 0.024, 0.084, 0), Color(0.32, 0.33, 0.35))
	_gear_fader(p, -0.016, -0.207, 0.06, true)
	_gear_text(p, "MAGVEL FADER", Vector3(-0.016, 0.084, -0.183), 0.055)
	# Left: mic, six Sound Color FX, headphone A. Right: master, booth EQ, headphone B, Beat FX.
	for x in [-0.178, -0.131, 0.094]:
		for z in [0.145, 0.116, 0.086, 0.059, -0.062, -0.12, -0.16]: _gear_knob(p, x, z)
	for i in 6:
		_gear_part(p, Vector3(0.014, 0.003, 0.009), Vector3(-0.14 + (i % 2) * 0.021, 0.085, 0.012 - floorf(i / 2.0) * 0.022), Color(0.18, 0.2, 0.22))
	for x in [-0.176, -0.13]:
		_gear_part(p, Vector3(0.033, 0.004, 0.021), Vector3(x, 0.085, 0.181), Color(0.08, 0.09, 0.11))
		_gear_text(p, "USB", Vector3(x, 0.084, 0.2), 0.017)
	_gear_text(p, "MIC", Vector3(-0.179, 0.084, 0.169), 0.017)
	_gear_text(p, "COLOR FX", Vector3(-0.131, 0.084, 0.05), 0.034)
	_gear_text(p, "MASTER", Vector3(0.094, 0.084, 0.201), 0.032)
	_gear_knob(p, 0.094, 0.181, 0.009, 0.0998) # 107.9 mm maximum height
	for dx in [-0.011, 0.011]:
		_gear_face(p, Vector2(0.003, 0.108), Vector3(0.094 + dx, 0.084, 0.11), Kit.shader("res://shaders/booth.gdshader", {"kind": 3, "deck": 0.0}))
	_gear_text(p, "BOOTH EQ", Vector3(0.094, 0.084, 0.046), 0.034)
	_gear_text(p, "PHONES A", Vector3(-0.131, 0.084, -0.094), 0.035)
	_gear_text(p, "PHONES B", Vector3(0.094, 0.084, -0.094), 0.035)
	for z in [0.18, 0.15, -0.04, -0.12, -0.158]: _gear_knob(p, 0.158, z, 0.008)
	_gear_face(p, Vector2(0.065, 0.047), Vector3(0.157, 0.084, 0.104), Kit.mat(Color(0.01, 0.015, 0.02)))
	_gear_text(p, "BEAT FX", Vector3(0.157, 0.0845, 0.139), 0.036)
	_gear_text(p, "120.0 BPM\nECHO\n1/2   1   2", Vector3(0.157, 0.085, 0.104), 0.052)
	_gear_part(p, Vector3(0.062, 0.002, 0.012), Vector3(0.157, 0.084, 0.067), Color(0.1, 0.12, 0.16))
	for row in 2:
		for col in 4: _gear_part(p, Vector3(0.011, 0.003, 0.007), Vector3(0.133 + col * 0.016, 0.085, -0.073 - row * 0.018), Color(0.07, 0.28, 0.55))
	_gear_disc(p, 0.01, 0.003, Vector3(0.158, 0.085, -0.198), Kit.glowing(Color(0.08, 0.3, 1), 0.7))

func _process(dt: float) -> void:
	if not is_instance_valid(_booth_rb):
		for sibling in get_parent().get_children():
			if sibling is Rekordbox: _booth_rb = sibling
	_booth_clock += dt
	_booth_tick += dt
	if _booth_tick < 0.05: return
	_booth_tick = 0.0
	_update_floor()
	var linked := is_instance_valid(_booth_rb) and _booth_rb.live()
	for face in _deck_faces:
		var d: String = face.deck
		var fields: Dictionary = _booth_rb.fields if linked else {}
		# Physical deck numbers run left to right; never substitute master or another deck.
		var sample := [fields.get(d + "/time"), fields.get(d + "/beat/position"), fields.get(d + "/beat/subdiv/1")]
		var seen: Array = _deck_motion.get(d, [sample, -10.0])
		if sample != seen[0]: seen = [sample, _booth_clock]
		_deck_motion[d] = seen if linked else [sample, -10.0]
		var moving := linked and _booth_clock - float(seen[1]) < 0.6
		var playing := float(fields.get(d + "/transport/playing", 1.0 if moving else 0.0))
		var time_beat := float(fields.get(d + "/time", 0.0)) * float(fields.get(d + "/bpm/current", 0.0)) / 60.0
		var beat := float(fields.get(d + "/beat/position", time_beat)) + float(fields.get(d + "/beat/subdiv/1", 0.0))
		for key in ["screen", "jog", "play"]:
			var material: ShaderMaterial = face[key]
			material.set_shader_parameter("playing", playing)
			material.set_shader_parameter("linked", linked)
			material.set_shader_parameter("position", beat)
		var title: String = str(fields.get(d + "/track/title", "rekordbox"))
		title = title.left(19)
		var artist: String = str(fields.get(d + "/track/artist", "")).left(24)
		face.title.text = "%s · %s\n%s" % [d, title, artist]
		face.info.text = "%s %.1f BPM %02d:%02d" % ["▶" if playing > 0.5 else "Ⅱ" if linked else "NO LINK", float(fields.get(d + "/bpm/current", 0)), int(float(fields.get(d + "/time", 0))) / 60, int(float(fields.get(d + "/time", 0))) % 60]

# L-Acoustics published W/H/D: Kara II 733/252/500 mm; KS28 1340/550/719 mm.
# https://www.l-acoustics.com/products/Kara-ii/ and /products/KS28/
# KS28 on its side puts the middle Kara at ear height. Front (-Z) faces the DJ.
func _booth_monitors(base: float, zt: float) -> void:
	var cabinet := Kit.mat(Color(0.037, 0.035, 0.034), 0.85)
	var grille := Kit.mat(Color(0.075, 0.071, 0.068), 0.82, 0.25)
	var image := Image.create(64, 64, false, Image.FORMAT_RGB8)
	for y in 64:
		for x in 64:
			var hole := Vector2((x % 8) - 3.5, (y % 8) - 3.5).length() < 2.6
			image.set_pixel(x, y, Color(0.19, 0.19, 0.19) if hole else Color(0.65, 0.65, 0.65))
	grille.albedo_texture = ImageTexture.create_from_image(image)
	grille.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	var rubber := Kit.mat(Color(0.012, 0.012, 0.012), 0.95)
	var metal := Kit.mat(Color(0.12, 0.12, 0.115), 0.5, 0.7)
	for side in [-1.0, 1.0]:
		var stack := Node3D.new()
		stack.name = "BoothMonitorsLeft" if side < 0 else "BoothMonitorsRight"
		add_child(stack)
		stack.position = Vector3(side * 2.45, base, zt - 0.4)
		stack.look_at(Vector3(0, base, BOOTH_Z - 1.45))
		# The KS28 has side runners as well as ground runners; keep the casing dimensions.
		for x in [-0.19, 0.19]:
			Kit.box(stack, Vector3(0.05, 0.015, 0.62), Vector3(x, 0.0075, 0.02), rubber)
		var sub := _monitor_cabinet(stack, "KS28", Vector3(1.340, 0.550, 0.719), Vector3(0, 0.015 + 0.670, 0), cabinet, grille)
		sub.rotation.z = PI / 2.0
		# A thin mounting plate, then exactly three Kara II enclosures on each sub.
		Kit.box(stack, Vector3(0.72, 0.025, 0.48), Vector3(0, 1.3675, 0), metal)
		for i in 3:
			var y := 1.380 + i * 0.258 + 0.126
			_monitor_cabinet(stack, "KaraII_%d" % (i + 1), Vector3(0.733, 0.252, 0.500), Vector3(0, y, 0), cabinet, grille)
			# Captive rigging strips in the 6 mm gap, kept inside the cabinet width.
			if i < 2:
				for x in [-0.347, 0.347]:
					Kit.box(stack, Vector3(0.028, 0.006, 0.31), Vector3(x, y + 0.129, 0.04), metal)

func _monitor_cabinet(parent: Node3D, label: String, size: Vector3, pos: Vector3, cabinet: Material, grille: Material) -> Node3D:
	var unit := Node3D.new()
	unit.name = label
	unit.position = pos
	parent.add_child(unit)
	# The grille is the front surface, within the actual depth; the shell starts 2 mm behind it.
	Kit.box(unit, Vector3(size.x, size.y, size.z - 0.006), Vector3(0, 0, 0.003), cabinet).name = "Cabinet"
	Kit.box(unit, Vector3(size.x - 0.024, size.y - 0.024, 0.004), Vector3(0, 0, -size.z / 2 + 0.002), grille).name = "Grille"
	return unit

# The PA: a K2 hang either side over the stage's front, KS28 subs in a line on the floor in front of it.
func _pa(dark: Kit.Batch) -> void:
	for s in [-1.0, 1.0]: _array(dark, Vector3(s * 16.5, 12.8, FRONT + 0.4), 12, Vector3(1.34, 0.35, 0.56), s * 0.1)
	for i in 12:
		var x := -19.25 + i * 3.5
		for k in 2: dark.add(Kit.block(Vector3(1.34, 0.55, 1.1), Vector3(x, 0.28 + k * 0.56, FRONT + 0.6)))

func _array(dark: Kit.Batch, top: Vector3, n: int, size: Vector3, yaw: float) -> void:
	var y := top.y
	var tilt := 0.0
	var zf := top.z
	dark.add(Kit.block(Vector3(1.5, 0.12, 0.8), Vector3(top.x, y + 0.25, zf)))
	for i in n:
		tilt += 0.012 * i
		var b := Basis(Vector3.UP, yaw) * Basis(Vector3.RIGHT, -tilt)
		dark.add(Transform3D(b * Basis.from_scale(size), Vector3(top.x, y, zf)))
		y -= size.y * cos(tilt)
		zf += size.y * sin(tilt)
