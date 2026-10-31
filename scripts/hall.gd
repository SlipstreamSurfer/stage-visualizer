class_name Hall
extends Node3D
# The hall: a hangar of 44 by 76 metres and 15 high, braced steel roof trusses every 9.5 metres on a concrete base.
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
var _hall_materials: Array[ShaderMaterial] = []
var _hall_rig: Rig
var _return_level := 0.0
var _pa_fronts: Kit.Batch

func build() -> void:
	var black := Kit.mat(Color(0.018, 0.018, 0.02), 0.8)
	var frame := _hall_material(Color(0.17, 0.20, 0.19), 0.73, 0.12, 0.3)
	var boxes := Kit.Batch.new(Kit.unit_box(), frame)
	var dark := Kit.Batch.new(Kit.unit_box(), black)

	# floor, walls on a concrete base, roof, the hangar door at the far end
	var ground := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(W, D)
	ground.mesh = pm
	ground.material_override = _concrete()
	add_child(ground)
	var metal := Kit.Batch.new(Kit.unit_box(), _hall_material(Color(0.12, 0.15, 0.16), 0.6, 0.3, 0.35))
	var trim := Kit.Batch.new(Kit.unit_box(), _hall_material(Color(0.23, 0.25, 0.24), 0.58, 0.35, 0.25))
	var glass := Kit.Batch.new(Kit.unit_box(), Kit.mat(Color(0.018, 0.027, 0.031), 0.38))
	var concrete := Kit.Batch.new(Kit.unit_box(), _hall_material(Color(0.21, 0.20, 0.18), 0.96, 0.0, 0.35))
	for side: float in [-1.0, 1.0]:
		for bay in 8:
			concrete.add(Kit.block(Vector3(0.2, 2.9, 9.47), Vector3(side * 21.9, 1.45, -33.25 + bay * 9.5)))
		concrete.add(Kit.block(Vector3(W, 2.9, 0.2), Vector3(0, 1.45, side * 37.9)))
		for bay in 9:
			concrete.add(Kit.block(Vector3(0.85, 0.5, 0.9), Vector3(side * 21.55, 0.25, -38.0 + bay * 9.5)))
	_envelope()
	_structure(boxes, trim)
	_windows(boxes, glass)
	_services(metal, trim, dark)
	_openings(boxes, dark, metal, glass)
	_production_deck(boxes, dark)
	concrete.build(self).name = "ConcretePlinth"
	metal.build(self).name = "HallServices"
	trim.build(self).name = "HallSecondarySteel"
	glass.build(self).name = "ClosedRooflightsAndWindows"

	# the stage across the full width, its black skirt, the booth's riser
	dark.add(Kit.block(Vector3(6, RISER, 3.2), Vector3(0, DECK + RISER / 2, BOOTH_Z - 0.6)))
	var deck_top := Kit.mat(Color(0.03, 0.03, 0.03), 0.55)
	# One solid deck: no second skin crossing the riser or sharing the stage's faces.
	Kit.box(self, Vector3(W - 0.4, DECK, FRONT - BACK), Vector3(0, DECK / 2, (FRONT + BACK) / 2), deck_top).name = "StageDeck"
	_curtain()
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

# The building is independent of the show trusses: nine braced, clear-span roof girders.
func _structure(frame: Kit.Batch, trim: Kit.Batch) -> void:
	for bay in 9:
		var z := -D / 2.0 + bay * 9.5
		for side: float in [-1.0, 1.0]:
			var x := side * 21.55
			# I-section columns, base plates and the girder seats.
			frame.add(Kit.block(Vector3(0.42, 14.65, 0.045), Vector3(x, 7.325, z)))
			for dx in [-0.24, 0.24]:
				frame.add(Kit.block(Vector3(0.045, 14.65, 0.48), Vector3(x + dx, 7.325, z)))
			trim.add(Kit.block(Vector3(0.75, 0.08, 0.8), Vector3(x, 0.04, z)))
			frame.add(Kit.block(Vector3(0.9, 0.18, 0.65), Vector3(side * 21.25, 12.16, z)))
		for y in [12.3, 14.65]:
			frame.add(Kit.block(Vector3(42.5, 0.22, 0.24), Vector3(0, y, z)))
		for panel in 12:
			var x0 := -21.0 + panel * 3.5
			var x1 := x0 + 3.5
			var low := Vector3(x0, 12.41, z)
			var high := Vector3(x1, 14.54, z)
			if panel % 2 == 1:
				low.x = x1
				high.x = x0
			_member(frame, low, high, 0.13, 0.15)
			if panel % 2 == 0:
				frame.add(Kit.block(Vector3(0.12, 2.13, 0.15), Vector3(x0, 13.475, z)))
		# Attachment plates and open clevises on the bottom chord, above the lighting grid.
		for x in [-14.0, -7.0, 0.0, 7.0, 14.0]:
			trim.add(Kit.block(Vector3(0.32, 0.06, 0.38), Vector3(x, 12.16, z)))
			for dx in [-0.10, 0.10]:
				trim.add(Kit.block(Vector3(0.045, 0.20, 0.08), Vector3(x + dx, 12.03, z)))
			trim.add(Kit.block(Vector3(0.24, 0.04, 0.08), Vector3(x, 11.94, z)))
	# Z purlins: web and opposite flanges, running between the transverse frames.
	for i in 23:
		var x := -20.9 + i * 1.9
		trim.add(Kit.block(Vector3(0.018, 0.20, D), Vector3(x, 14.87, 0)))
		for side: float in [-1.0, 1.0]:
			trim.add(Kit.block(Vector3(0.085, 0.018, D), Vector3(x + side * 0.038, 14.87 + side * 0.09, 0)))
	# Roof-plane X bracing and matching wall bracing in the end bays.
	for z0 in [-38.0, 28.5]:
		for side: float in [-1.0, 1.0]:
			_member(trim, Vector3(0, 14.52, z0), Vector3(side * 21.0, 14.52, z0 + 9.5), 0.045, 0.045)
			_member(trim, Vector3(side * 21.0, 14.52, z0), Vector3(0, 14.52, z0 + 9.5), 0.045, 0.045)
			_member(frame, Vector3(side * 21.72, 3.1, z0), Vector3(side * 21.72, 12.2, z0 + 9.5), 0.075, 0.075)
			_member(frame, Vector3(side * 21.72, 12.2, z0), Vector3(side * 21.72, 3.1, z0 + 9.5), 0.075, 0.075)
	for side: float in [-1.0, 1.0]:
		for y in [3.0, 6.1, 9.2, 12.0]:
			trim.add(Kit.block(Vector3(0.10, 0.16, D), Vector3(side * 21.85, y, 0)))

# A rectangular steel member, with its local Y along the load path.
func _member(batch: Kit.Batch, a: Vector3, b: Vector3, width: float, depth: float) -> void:
	var t := Kit.tube(a, b, 1.0)
	t.basis.x *= width
	t.basis.z *= depth
	batch.add(t)

# One inward-facing surface for the coated wall and roof liners, with metre-based UVs.
func _envelope() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for bay in 8:
		var z0 := -D / 2.0 + bay * 9.5
		var z1 := z0 + 9.5
		var shade := 0.94 + 0.02 * (bay % 4)
		for side: float in [-1.0, 1.0]:
			var x := side * W / 2.0
			_hall_quad(st, [Vector3(x, 2.9, z0), Vector3(x, H, z0), Vector3(x, H, z1), Vector3(x, 2.9, z1)], Vector3(-side, 0, 0), [Vector2(z0, 2.9), Vector2(z0, H), Vector2(z1, H), Vector2(z1, 2.9)], Color(shade, shade, shade))
		_hall_quad(st, [Vector3(-W / 2, H, z0), Vector3(W / 2, H, z0), Vector3(W / 2, H, z1), Vector3(-W / 2, H, z1)], Vector3.DOWN, [Vector2(z0, -W / 2), Vector2(z0, W / 2), Vector2(z1, W / 2), Vector2(z1, -W / 2)], Color(0.82, 0.85, 0.88))
	for side: float in [-1.0, 1.0]:
		var z := side * D / 2.0
		_hall_quad(st, [Vector3(-W / 2, 2.9, z), Vector3(W / 2, 2.9, z), Vector3(W / 2, H, z), Vector3(-W / 2, H, z)], Vector3(0, 0, -side), [Vector2(-W / 2, 2.9), Vector2(W / 2, 2.9), Vector2(W / 2, H), Vector2(-W / 2, H)], Color.WHITE)
	st.index()
	st.generate_tangents()
	var shell := MeshInstance3D.new()
	shell.name = "HallLiner"
	shell.mesh = st.commit()
	shell.material_override = _cladding()
	add_child(shell)

func _hall_quad(st: SurfaceTool, corners: Array, normal: Vector3, uv: Array, color: Color) -> void:
	var order := [0, 1, 2, 0, 2, 3]
	if (corners[2] - corners[0]).cross(corners[1] - corners[0]).dot(normal) < 0:
		order = [0, 2, 1, 0, 3, 2]
	for i in order:
		st.set_color(color)
		st.set_normal(normal)
		st.set_uv(uv[i] / Vector2(1.2, 6.0))
		st.add_vertex(corners[i])

# Closed rooflights and clerestory windows: opaque black backing, no exterior light.
func _windows(frame: Kit.Batch, glass: Kit.Batch) -> void:
	for bay in 8:
		var z := -33.25 + bay * 9.5
		for x in [-8.0, 8.0]:
			glass.add(Kit.block(Vector3(2.3, 0.035, 6.0), Vector3(x, 14.97, z)))
			for dx in [-1.18, 1.18]:
				frame.add(Kit.block(Vector3(0.08, 0.10, 6.15), Vector3(x + dx, 14.91, z)))
			for dz in [-3.0, -1.0, 1.0, 3.0]:
				frame.add(Kit.block(Vector3(2.3, 0.10, 0.075), Vector3(x, 14.91, z + dz)))
		if bay % 2 == 0:
			for side: float in [-1.0, 1.0]:
				var t := Transform3D(Basis(Vector3.UP, -side * PI / 2.0), Vector3(side * 21.94, 9.9, z))
				glass.add(t * Kit.block(Vector3(6.2, 1.6, 0.04), Vector3.ZERO))
				for y in [-0.84, 0.84]: frame.add(t * Kit.block(Vector3(6.35, 0.07, 0.12), Vector3(0, y, 0.08)))
				for x in [-3.14, -1.05, 1.05, 3.14]: frame.add(t * Kit.block(Vector3(0.07, 1.6, 0.12), Vector3(x, 0, 0.08)))

# Ducts sit in the upper web space; trays are along the walls, clear of the show trusses.
func _services(metal: Kit.Batch, trim: Kit.Batch, dark: Kit.Batch) -> void:
	for side: float in [-1.0, 1.0]:
		for bay in 8:
			var z := -33.25 + bay * 9.5
			metal.add(Kit.block(Vector3(0.9, 0.55, 9.35), Vector3(side * 16.0, 14.15, z)))
			trim.add(Kit.block(Vector3(1.0, 0.64, 0.08), Vector3(side * 16.0, 14.15, z - 4.68)))
			# The vertical drop stays against the wall, beyond the rig's footprint.
			if bay in [1, 6]:
				metal.add(Kit.block(Vector3(0.65, 3.6, 0.7), Vector3(side * 21.35, 11.8, z)))
				metal.add(Kit.block(Vector3(5.35, 0.55, 0.7), Vector3(side * 18.675, 13.8, z)))
				for i in 6:
					dark.add(Kit.block(Vector3(0.03, 0.035, 0.55), Vector3(side * 20.99, 10.15 + i * 0.13, z)))
		# Two longitudinal cable trays, with raised lips and repeated hanger rods.
		for y in [7.1, 10.8]:
			metal.add(Kit.block(Vector3(0.46, 0.045, D - 1.0), Vector3(side * 21.4, y, 0)))
			for x in [21.15, 21.65]: trim.add(Kit.block(Vector3(0.025, 0.16, D - 1.0), Vector3(side * x, y + 0.07, 0)))
		for bay in 9:
			var z := -38.0 + bay * 9.5
			trim.add(Kit.block(Vector3(0.03, 3.5, 0.03), Vector3(side * 21.4, 12.7, z)))

# Exit fittings share one draw; no house lights, only dim green signs.
func _openings(frame: Kit.Batch, dark: Kit.Batch, metal: Kit.Batch, glass: Kit.Batch) -> void:
	var signs := StandardMaterial3D.new()
	signs.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	signs.albedo_color = Color(0.55, 0.55, 0.55)
	signs.albedo_texture = _exit_texture()
	var quad := QuadMesh.new()
	quad.size = Vector2(0.8, 0.4)
	var sign_batch := Kit.Batch.new(quad, signs, false)
	for side: float in [-1.0, 1.0]:
		for z in [-16.0, 16.0, 31.0]:
			var t := Transform3D(Basis(Vector3.UP, -side * PI / 2.0), Vector3(side * 21.72, 0, z))
			_door(t, frame, dark, metal, glass)
			sign_batch.add(t * Transform3D(Basis.IDENTITY, Vector3(0, 2.65, 0.10)))
		var rear := Transform3D(Basis(Vector3.UP, PI), Vector3(side * 17.0, 0, 37.83))
		_door(rear, frame, dark, metal, glass)
		sign_batch.add(rear * Transform3D(Basis.IDENTITY, Vector3(0, 2.65, 0.10)))
	# Six shut sliding leaves, with jambs and the overhead running rail.
	for i in 6:
		var x := -13.5 + (i + 0.5) * 4.5
		metal.add(Kit.block(Vector3(4.44, 10.6, 0.12), Vector3(x, 5.3, 37.9)))
		for y in [0.15, 3.5, 7.0, 10.5]: frame.add(Kit.block(Vector3(4.44, 0.07, 0.08), Vector3(x, y, 37.79)))
	frame.add(Kit.block(Vector3(28, 0.35, 0.35), Vector3(0, 10.95, 37.7)))
	for x in [-13.7, 13.7]: frame.add(Kit.block(Vector3(0.22, 10.8, 0.35), Vector3(x, 5.4, 37.7)))
	sign_batch.build(self).name = "ExitSigns"

func _door(t: Transform3D, frame: Kit.Batch, dark: Kit.Batch, metal: Kit.Batch, glass: Kit.Batch) -> void:
	dark.add(t * Kit.block(Vector3(1.2, 2.3, 0.07), Vector3(0, 1.15, 0)))
	for x in [-0.65, 0.65]: frame.add(t * Kit.block(Vector3(0.06, 2.4, 0.12), Vector3(x, 1.2, 0.035)))
	frame.add(t * Kit.block(Vector3(1.36, 0.06, 0.12), Vector3(0, 2.4, 0.035)))
	glass.add(t * Kit.block(Vector3(0.28, 0.5, 0.025), Vector3(0, 1.8, 0.05)))
	metal.add(t * Kit.block(Vector3(0.9, 0.045, 0.06), Vector3(0, 1.05, 0.09)))

# A small rear production deck, beyond the crowd and all camera positions.
func _production_deck(frame: Kit.Batch, dark: Kit.Batch) -> void:
	dark.add(Kit.block(Vector3(7.0, 0.6, 3.0), Vector3(0, 0.3, 34.0)))
	for side: float in [-1.0, 1.0]:
		for z in [32.6, 34.0, 35.4]: frame.add(Kit.block(Vector3(0.045, 1.1, 0.045), Vector3(side * 3.45, 1.15, z)))
		for y in [1.15, 1.7]: frame.add(Kit.block(Vector3(0.045, 0.045, 2.9), Vector3(side * 3.45, y, 34.0)))
		for i in 3: dark.add(Kit.block(Vector3(0.8, 0.2 * (i + 1), 0.3), Vector3(side * 3.0, 0.1 * (i + 1), 32.1 - i * 0.3)))
	# An unlit console and equipment cases, without another screen or light source.
	for x in [-1.5, 1.5]:
		dark.add(Kit.block(Vector3(1.8, 0.85, 0.9), Vector3(x, 1.025, 34.0)))
		frame.add(Kit.block(Vector3(1.8, 0.08, 0.95), Vector3(x, 1.49, 34.0)))

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

# Baked corrugation, panel seams and finish variation. Plain UVs need one sample per map.
func _cladding() -> ShaderMaterial:
	var albedo := Image.create(192, 128, true, Image.FORMAT_RGB8)
	var normals := Image.create(192, 128, true, Image.FORMAT_RGB8)
	for y in 128:
		for x in 192:
			var phase := float(x) / 192.0 * TAU * 6.0
			var grain := sin(x * 12.9898 + y * 78.233) * 43758.5453
			grain -= floorf(grain)
			var wear := 0.83 + 0.10 * grain + 0.035 * sin(y * 0.11)
			if x < 2 or y < 2: wear *= 0.65
			albedo.set_pixel(x, y, Color(wear, wear, wear))
			var n := Vector3(-cos(phase) * 0.42, 0, 1).normalized()
			normals.set_pixel(x, y, Color(n.x * 0.5 + 0.5, 0.5, n.z * 0.5 + 0.5))
	albedo.generate_mipmaps()
	normals.generate_mipmaps()
	var m := _hall_material(Color(0.18, 0.205, 0.20), 0.82, 0.04, 1.0)
	m.set_shader_parameter("profiled", true)
	m.set_shader_parameter("panel_color", ImageTexture.create_from_image(albedo))
	m.set_shader_parameter("panel_normal", ImageTexture.create_from_image(normals))
	return m

func _hall_material(color: Color, rough: float, metal: float, gain: float) -> ShaderMaterial:
	var material := Kit.shader("res://shaders/hall_surface.gdshader", {"surface_color": color, "surface_roughness": rough, "surface_metallic": metal, "return_gain": gain})
	_hall_materials.append(material)
	return material

# Read the existing show output after main updates it. No new lights or changes to the rig.
func _update_return(dt: float) -> void:
	if not is_instance_valid(_hall_rig):
		for sibling in get_parent().get_children():
			if sibling is Rig: _hall_rig = sibling
	if not is_instance_valid(_hall_rig): return
	var level := minf(_hall_rig.room_level, 16.0)
	_return_level = maxf(level, lerpf(_return_level, level, 1.0 - exp(-dt * 8.0))) if level > 0.01 else 0.0
	var reflected := Vector3(_hall_rig.room_color.r, _hall_rig.room_color.g, _hall_rig.room_color.b) * _return_level * 0.12
	for material in _hall_materials: material.set_shader_parameter("show_return", reflected)

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
		_cdj_3000x(Vector3(positions[i], TABLE, zt - 0.08), i + 1)   # 0.2 m nearer the DJ than before: the gear sits close to the table edge the DJ stands at
	_djm_a9(Vector3(0, TABLE, zt - 0.09605))
	_booth_detail(base, zt, positions)
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

# Flightcase edging, recessed handles and a tidy cable loom. Three static batches, no extra lights.
func _booth_detail(base: float, zt: float, players: Array) -> void:
	var metal := Kit.mat(Color(0.22, 0.24, 0.26), 0.52, 0.72)
	var trim := Kit.Batch.new(Kit.unit_box(), metal, false)
	var hardware := Kit.Batch.new(Kit.unit_tube(), metal, false)
	var cables := Kit.Batch.new(Kit.unit_tube(), Kit.mat(Color(0.014, 0.016, 0.019), 0.92), false)
	# A cap round the tabletop; the centre remains the existing matte working surface.
	for side in [-1.0, 1.0]:
		trim.add(Kit.block(Vector3(3.24, 0.028, 0.018), Vector3(0, TABLE - 0.014, zt + side * 0.461)))
		trim.add(Kit.block(Vector3(0.018, 0.028, 0.94), Vector3(side * 1.611, TABLE - 0.014, zt)))
		for y in [base + 0.045, base + 0.96]:
			trim.add(Kit.block(Vector3(3.2, 0.025, 0.016), Vector3(0, y, zt + side * 0.454)))
			for i in 15:
				var p := Vector3(-1.54 + i * 0.22, y, zt + side * 0.466)
				hardware.add(Kit.tube(p, p + Vector3(0, 0, side * 0.003), 0.0045))
		for x in [-1.59, -0.55, 0.55, 1.59]:
			trim.add(Kit.block(Vector3(0.025, 0.94, 0.016), Vector3(x, base + 0.5, zt + side * 0.454)))
		# Four small recessed-style handles, set against dark carcass panels.
		for x in [-1.05, 1.05]:
			var at := Vector3(x, base + 0.61, zt + side * 0.462)
			for dx in [-0.095, 0.095]:
				trim.add(Kit.block(Vector3(0.012, 0.10, 0.009), at + Vector3(dx, 0, 0)))
			for dy in [-0.05, 0.05]:
				trim.add(Kit.block(Vector3(0.20, 0.012, 0.009), at + Vector3(0, dy, 0)))
			hardware.add(Kit.tube(at + Vector3(-0.075, 0, side * 0.012), at + Vector3(0.075, 0, side * 0.012), 0.009))
		# Reinforced top corners, below the gear and outside the working surface.
		for x in [-1.58, 1.58]:
			trim.add(Kit.block(Vector3(0.075, 0.09, 0.026), Vector3(x, TABLE - 0.065, zt + side * 0.455)))
	# Simplified rear connections: not a port-accurate wiring diagram.
	for i in players.size():
		var x: float = players[i]
		for wire in 2:
			var socket := Vector3(x - 0.06 + wire * 0.045, TABLE + 0.043, zt + 0.166)
			hardware.add(Kit.tube(socket, socket + Vector3(0, 0, 0.027), 0.007))
			var lane := zt + 0.31 + wire * 0.014 + i * 0.014
			Kit.cable(cables, [socket + Vector3(0, 0, 0.027), Vector3(socket.x, TABLE + 0.018, zt + 0.25),
				Vector3(socket.x + 0.035, TABLE + 0.008, lane), Vector3(1.30 + wire * 0.015, TABLE + 0.008, lane),
				Vector3(1.43 + wire * 0.015, TABLE + 0.008, zt + 0.43), Vector3(1.48 + wire * 0.015, TABLE - 0.05, zt + 0.49),
				Vector3(1.48 + wire * 0.015, base + 0.15, zt + 0.49)], 0.0035)
	for wire in 3:
		var socket := Vector3(-0.09 + wire * 0.06, TABLE + 0.044, zt + 0.134)
		hardware.add(Kit.tube(socket, socket + Vector3(0, 0, 0.03), 0.008))
		Kit.cable(cables, [socket + Vector3(0, 0, 0.03), Vector3(socket.x, TABLE + 0.012, zt + 0.27),
			Vector3(1.27 + wire * 0.015, TABLE + 0.008, zt + 0.27), Vector3(1.43 + wire * 0.015, TABLE + 0.008, zt + 0.43),
			Vector3(1.48 + wire * 0.015, TABLE - 0.05, zt + 0.49), Vector3(1.48 + wire * 0.015, base + 0.15, zt + 0.49)], 0.004)
	trim.build(self).name = "BoothTrim"
	hardware.build(self).name = "BoothHardware"
	cables.build(self).name = "BoothCables"

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
	_update_return(dt)
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

# The PA: +Z is the visible grille, towards the audience. The hangs toe in and curve down, not up.
func _pa(dark: Kit.Batch) -> void:
	var grille := Kit.mat(Color(0.075, 0.08, 0.085), 0.82, 0.25)
	var image := Image.create(64, 64, true, Image.FORMAT_RGB8)
	for y in 64:
		for x in 64:
			var hole := Vector2((x % 8) - 3.5, (y % 8) - 3.5).length() < 2.6
			image.set_pixel(x, y, Color(0.17, 0.17, 0.17) if hole else Color(0.65, 0.65, 0.65))
	image.generate_mipmaps()
	grille.albedo_texture = ImageTexture.create_from_image(image)
	grille.uv1_scale = Vector3(8, 3, 1)
	grille.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	_pa_fronts = Kit.Batch.new(Kit.unit_box(), grille, false)
	for s in [-1.0, 1.0]: _array(dark, Vector3(s * 16.5, 12.8, FRONT + 0.4), 12, Vector3(1.34, 0.35, 0.56), -s * 0.1)
	for i in 12:
		var x := -19.25 + i * 3.5
		for k in 2: _pa_box(dark, Vector3(1.34, 0.55, 1.1), Transform3D(Basis.IDENTITY, Vector3(x, 0.28 + k * 0.56, FRONT + 0.6)))
	_pa_fronts.build(self).name = "PAFronts"
	_pa_fronts = null

# Keep the published envelope: casing recessed behind the grille, which ends at the original front face.
func _pa_box(dark: Kit.Batch, size: Vector3, at: Transform3D) -> void:
	dark.add(at * Kit.block(Vector3(size.x, size.y, size.z - 0.006), Vector3(0, 0, -0.003)))
	_pa_fronts.add(at * Kit.block(Vector3(size.x - 0.04, size.y - 0.02, 0.004), Vector3(0, 0, size.z / 2 - 0.002)))

func _array(dark: Kit.Batch, top: Vector3, n: int, size: Vector3, yaw: float) -> void:
	var y := top.y
	var tilt := 0.0
	var zf := top.z
	dark.add(Kit.block(Vector3(1.5, 0.12, 0.8), Vector3(top.x, y + 0.25, zf)))
	for i in n:
		tilt += 0.012 * i
		var b := Basis(Vector3.UP, yaw) * Basis(Vector3.RIGHT, tilt)
		_pa_box(dark, size, Transform3D(b, Vector3(top.x, y, zf)))
		y -= size.y * cos(tilt)
		zf -= size.y * sin(tilt)
