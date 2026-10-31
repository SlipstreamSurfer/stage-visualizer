class_name Crowd
extends Node3D
# The crowd: up to 3,000 people from the barrier to the back, densest at the front, all facing the stage.
# And the DJ, shown only when the camera is over the DJ's shoulder; from the DJ's own eyes, the DJ is you.
# One indexed surface and MultiMesh draw; all movement stays in person.gdshader.

var mm: MultiMesh
var dj: MultiMesh
var dj_node: MultiMeshInstance3D
var material: ShaderMaterial
var people := PackedColorArray()   # each person's INSTANCE_CUSTOM, as built (a headless renderer cannot read it back)
var places := PackedVector2Array()  # and where they stand (x, z)
var _stage := Vector3.ZERO

# What people wear, as linear colours and the share of the crowd in each. Mostly dark, as at a techno night, with a
# rare white or neon shirt that catches the show's colour. person.gdshader picks one per person from its hashes.
const CLOTH := [
	[Color(0.018, 0.020, 0.024), 0.32], [Color(0.040, 0.042, 0.046), 0.14], [Color(0.12, 0.12, 0.125), 0.08],
	[Color(0.020, 0.035, 0.075), 0.08], [Color(0.07, 0.10, 0.15), 0.06], [Color(0.06, 0.07, 0.035), 0.06],
	[Color(0.10, 0.025, 0.03), 0.06], [Color(0.30, 0.24, 0.16), 0.05], [Color(0.22, 0.07, 0.03), 0.04],
	[Color(0.03, 0.12, 0.12), 0.04], [Color(0.62, 0.62, 0.60), 0.04],   # white
	[Color(0.30, 0.75, 0.02), 0.01], [Color(0.80, 0.04, 0.28), 0.01], [Color(0.85, 0.22, 0.01), 0.01],   # neon
]
const HAIR := [
	[Color(0.009, 0.006, 0.004), 0.30], [Color(0.03, 0.016, 0.008), 0.25], [Color(0.08, 0.045, 0.02), 0.17],
	[Color(0.16, 0.05, 0.02), 0.06], [Color(0.22, 0.15, 0.07), 0.08], [Color(0.45, 0.35, 0.18), 0.07],
	[Color(0.25, 0.25, 0.25), 0.05], [Color(0.35, 0.06, 0.25), 0.02],
]
const PANTS := [
	[Color(0.012, 0.014, 0.018), 0.40], [Color(0.03, 0.045, 0.08), 0.25], [Color(0.12, 0.17, 0.26), 0.10],
	[Color(0.06, 0.06, 0.065), 0.10], [Color(0.20, 0.16, 0.09), 0.08], [Color(0.06, 0.07, 0.035), 0.07],
]

# How people dance (person.gdshader moves each style its own way), and the mix in each part of the hall: the shares
# of the six styles, in this order, from the barrier to FRONT_ZONE metres back, then to MIDDLE_ZONE, then the rest.
const STYLES := ["jumper", "stomper", "arm pumper", "groover", "hip swayer", "watcher"]
const FRONT_ZONE := 12.0
const MIDDLE_ZONE := 30.0
const FRONT_MIX := [0.30, 0.25, 0.20, 0.15, 0.05, 0.05]
const MIDDLE_MIX := [0.10, 0.15, 0.15, 0.30, 0.20, 0.10]
const BACK_MIX := [0.05, 0.05, 0.10, 0.30, 0.20, 0.30]

static func zone_mix(z: float) -> Array:
	var back := z - Hall.BARRIER
	return FRONT_MIX if back < FRONT_ZONE else MIDDLE_MIX if back < MIDDLE_ZONE else BACK_MIX

# A share list as a table for pick().
static func _shares(mix: Array) -> Array:
	return mix.map(func(v): return [null, v])

static func style_of(c: Color) -> int: return clampi(int(c.r), 0, STYLES.size() - 1)

# The shader's keys, from the appearance (w) and timing (x) hashes in INSTANCE_CUSTOM.
static func cloth_key(c: Color) -> float: return fposmod(c.a * 7.31, 1.0)
static func hair_key(c: Color) -> float: return fposmod(c.a * 23.8, 1.0)
static func pants_key(c: Color) -> float: return fposmod(fposmod(c.r, 1.0) * 5.3, 1.0)

# Which entry of a table a key picks: the shares run end to end from 0 to 1.
static func pick(table: Array, key: float) -> int:
	var at := 0.0
	for i in table.size():
		at += float(table[i][1])
		if key < at: return i
	return table.size() - 1

static func _colours(table: Array) -> PackedVector3Array:
	var out := PackedVector3Array()
	for e in table: out.append(Vector3(e[0].r, e[0].g, e[0].b))
	return out

static func _ends(table: Array) -> PackedFloat32Array:
	var out := PackedFloat32Array()
	var at := 0.0
	for e in table:
		at += float(e[1])
		out.append(at)
	out[out.size() - 1] = 1.01   # rounding never leaves a key without an entry
	return out

func build(count: int) -> void:
	var mesh := person_mesh()
	var mat := Kit.shader("res://shaders/person.gdshader", {"barrier_z": Hall.BARRIER,
		"cloth_colours": _colours(CLOTH), "cloth_ends": _ends(CLOTH), "hair_colours": _colours(HAIR), "hair_ends": _ends(HAIR),
		"pants_colours": _colours(PANTS), "pants_ends": _ends(PANTS)})
	material = mat
	mm = MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_custom_data = true
	mm.mesh = mesh
	mm.instance_count = count
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var dance := RandomNumberGenerator.new()   # its own numbers, so the crowd stands where it always stood
	dance.seed = 11
	var occupied := {}
	var placed := 0
	while placed < count:
		var z := rng.randf_range(Hall.BARRIER + 0.45, 30.0)
		var x := rng.randf_range(-20.6, 20.6)
		if not _clear_of_towers(x, z): continue
		if rng.randf() > exp(-(z - Hall.BARRIER) / 30.0): continue   # fewer further back
		# Leave shoulder room, so heads and torsos do not merge into the same silhouette.
		var cell := Vector2i(floori(x / 0.6), floori(z / 0.6))
		var pos := Vector2(x, z)
		var clear := true
		for dx in range(-1, 2):
			for dz in range(-1, 2):
				for other: Vector2 in occupied.get(cell + Vector2i(dx, dz), []):
					if pos.distance_squared_to(other) < 0.58 * 0.58: clear = false
		if not clear: continue
		if not occupied.has(cell): occupied[cell] = []
		occupied[cell].append(pos)
		var size := Vector3(rng.randf_range(0.86, 1.18), rng.randf_range(0.89, 1.12), rng.randf_range(0.9, 1.15))
		var t := Transform3D(Basis(Vector3.UP, PI + rng.randf_range(-0.65, 0.65)).scaled(size), Vector3(x, 0, z))
		mm.set_instance_transform(placed, t)
		# the front moves more and raises their arms sooner
		var keen := clampf(1.0 - (z - Hall.BARRIER) / 45.0, 0.0, 1.0)
		var style := pick(_shares(zone_mix(z)), dance.randf())
		var custom := Color(style + minf(rng.randf(), 0.9999), rng.randf_range(0.3, 1.0) * (0.5 + keen * 0.5), rng.randf_range(0.0, 0.7) * (1.2 - keen), rng.randf())
		mm.set_instance_custom_data(placed, custom)
		people.append(custom)
		places.append(pos)
		placed += 1
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	mi.material_override = mat
	mi.extra_cull_margin = 1.0
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	# the DJ, behind the decks, facing the crowd
	dj = MultiMesh.new()
	dj.transform_format = MultiMesh.TRANSFORM_3D
	dj.use_custom_data = true
	dj.mesh = mesh
	dj.instance_count = 1
	dj.set_instance_transform(0, Transform3D(Basis.IDENTITY, Vector3(0, Hall.DECK + Hall.RISER, Hall.BOOTH_Z - 1.2)))
	dj.set_instance_custom_data(0, Color(0.0, 0.8, 1.5, 0.05))
	dj_node = MultiMeshInstance3D.new()
	dj_node.multimesh = dj
	dj_node.material_override = mat
	dj_node.visible = false
	add_child(dj_node)

# Footprints plus a metre of space, including room for raised arms and sway.
static func _clear_of_towers(x: float, z: float) -> bool:
	var body := 1.0
	if absf(absf(x) - 15.5) < 0.6 + 1.0 + body and absf(z - 4.0) < 0.6 + 1.0 + body:
		return false
	for tower_z in [-19.0, -9.0, 11.0, 21.0]:
		if absf(absf(x) - 20.6) < 0.6 + 1.0 + body and absf(z - tower_z) < 0.6 + 1.0 + body:
			return false
	return true

func shown(n: int) -> void:
	mm.visible_instance_count = mini(n, mm.instance_count)

# The light from the stage behind and above the DJ on the people facing it: edges of hair and shoulders seen from
# the back, a little colour on their fronts. Eased, so a kick or a strobe does not flash the whole crowd; 0 in a blackout.
func stage_light(colour: Color, level: float, dt: float) -> void:
	var want := Vector3(colour.r, colour.g, colour.b) * clampf(level / 16.0, 0.0, 1.0)
	_stage += (want - _stage) * (1.0 - exp(-dt * 3.0))
	material.set_shader_parameter("stage_light", _stage)

# One indexed surface for every person, including clothes, hands and phone.
# Colour: r = arm joint, g = side, b = material (0.35 phone, 0.625 screen).
static func person_mesh() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var parts := []
	for side in [-1.0, 1.0]:
		parts.append([_loft([Vector3(0.065, 0.12, 0.065), Vector3(0.083, 0.48, 0.085), Vector3(0.105, 0.87, 0.105)]), Vector3(side * 0.108, 0, 0), Color(0, 0, 0.25)])
		parts.append([_loft([Vector3(0.075, 0.025, 0.135), Vector3(0.078, 0.09, 0.14), Vector3(0.06, 0.14, 0.08)]), Vector3(side * 0.108, 0, 0.035), Color(0, 0, 0.75)])
	parts.append([_loft([Vector3(0.18, 0.84, 0.115), Vector3(0.185, 1.04, 0.12), Vector3(0.23, 1.29, 0.125), Vector3(0.245, 1.35, 0.12), Vector3(0.205, 1.40, 0.105), Vector3(0.085, 1.46, 0.075)], 10, true), Vector3.ZERO, Color(0, 0, 0)])
	parts.append([_loft([Vector3(0.06, 1.43, 0.06), Vector3(0.058, 1.54, 0.058)], 12, true), Vector3.ZERO, Color(0, 0, 1)])
	# Cheeks, brow and crown keep a rounded silhouette close to the camera.
	parts.append([_loft([Vector3(0.055, 1.50, 0.065), Vector3(0.087, 1.54, 0.082), Vector3(0.106, 1.61, 0.098), Vector3(0.103, 1.67, 0.095), Vector3(0.077, 1.73, 0.073), Vector3(0.025, 1.755, 0.025)], 12, true), Vector3.ZERO, Color(0, 0, 1)])
	parts.append([_loft([Vector3(0.109, 1.665, 0.101), Vector3(0.085, 1.735, 0.08), Vector3(0.025, 1.765, 0.025)], 12, true), Vector3(0, 0, -0.008), Color(0, 0, 0.5)])
	parts.append([_loft([Vector3(0.023, 1.58, 0.015), Vector3(0.018, 1.62, 0.035), Vector3(0.012, 1.65, 0.008)], 6, true), Vector3(0, 0, 0.09), Color(0, 0, 1)])
	for side in [-1.0, 1.0]:
		parts.append([_loft([Vector3(0.012, 1.575, 0.013), Vector3(0.018, 1.60, 0.022), Vector3(0.015, 1.63, 0.019), Vector3(0.008, 1.65, 0.008)], 6, true), Vector3(side * 0.106, 0, -0.009), Color(0, 0, 1)])
	for side in [-1.0, 1.0]:
		var g := 0.0 if side < 0.0 else 1.0
		parts.append([_loft([Vector3(0.063, 1.12, 0.063), Vector3(0.079, 1.30, 0.08), Vector3(0.075, 1.39, 0.075)], 6), Vector3(side * 0.255, 0, 0), Color(1, g, 0)])
		parts.append([_loft([Vector3(0.04, 0.85, 0.04), Vector3(0.058, 1.06, 0.06), Vector3(0.063, 1.12, 0.063)], 6), Vector3(side * 0.255, 0, 0), Color(0.5, g, 1)])
		parts.append([_loft([Vector3(0.034, 0.77, 0.025), Vector3(0.047, 0.81, 0.036), Vector3(0.04, 0.87, 0.03)], 6), Vector3(side * 0.255, 0, 0), Color(0.5, g, 1)])
	var phone := BoxMesh.new()
	phone.size = Vector3(0.075, 0.145, 0.012)
	parts.append([phone, Vector3(0.255, 0.745, 0), Color(0.5, 1, 0.35)])
	var screen := QuadMesh.new()
	screen.size = Vector2(0.063, 0.125)
	# A single front-facing screen on the back of the hand, visible from the crowd.
	screen.orientation = PlaneMesh.FACE_Z
	parts.append([screen, Vector3(0.255, 0.745, -0.007), Color(0.5, 1, 0.625)])
	for part in parts:
		var arrays: Array = part[0].get_mesh_arrays() if part[0] is PrimitiveMesh else part[0].surface_get_arrays(0)
		var verts: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
		var norms: PackedVector3Array = arrays[Mesh.ARRAY_NORMAL]
		var idx: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
		for i in idx:
			st.set_color(part[2])
			# QuadMesh faces +Z by default; the phone screen faces the audience (+world Z).
			var v := verts[i]
			var n := norms[i]
			if part[0] == screen:
				v.x = -v.x
				v.z = -v.z
				n.z = -n.z
			st.set_normal(n)
			st.add_vertex(v + part[1])
	st.index()
	return st.commit()

# Normal of an elliptical ring, including how its width and depth change through the neighbouring rings.
static func _loft_normal(rings: Array, j: int, angle: float) -> Vector3:
	var ring: Vector3 = rings[j]
	var before: Vector3 = rings[maxi(0, j - 1)]
	var after: Vector3 = rings[mini(rings.size() - 1, j + 1)]
	var slope := (after - before) / (after.y - before.y)
	var c := cos(angle)
	var s := sin(angle)
	return Vector3(c / ring.x, -c * c * slope.x / ring.x - s * s * slope.z / ring.z, s / ring.z).normalized()

# Elliptical rings with flat end caps: fewer triangles than capsules, and a clothed outline.
static func _loft(rings: Array, sides := 8, smooth := false) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for j in range(rings.size() - 1):
		var lower: Vector3 = rings[j]
		var upper: Vector3 = rings[j + 1]
		for i in sides:
			var a := (i + 0.5) * TAU / sides
			var b := (i + 1.5) * TAU / sides
			var v0 := Vector3(cos(a) * lower.x, lower.y, sin(a) * lower.z)
			var v1 := Vector3(cos(a) * upper.x, upper.y, sin(a) * upper.z)
			var v2 := Vector3(cos(b) * upper.x, upper.y, sin(b) * upper.z)
			var v3 := Vector3(cos(b) * lower.x, lower.y, sin(b) * lower.z)
			var vertices := [v0, v2, v1, v0, v3, v2]
			var directions := [_loft_normal(rings, j, a), _loft_normal(rings, j + 1, b), _loft_normal(rings, j + 1, a),
				_loft_normal(rings, j, a), _loft_normal(rings, j, b), _loft_normal(rings, j + 1, b)] if smooth else []
			for k in vertices.size():
				if smooth: st.set_normal(directions[k])
				st.add_vertex(vertices[k])
	if not smooth: st.generate_normals()
	# Keep the soles, collar and cuffs flat, without rounding their side normals.
	for end in [0, rings.size() - 1]:
		var ring: Vector3 = rings[end]
		for i in sides:
			var a := (i + 0.5) * TAU / sides
			var b := (i + 1.5) * TAU / sides
			var v0 := Vector3(cos(a) * ring.x, ring.y, sin(a) * ring.z)
			var v1 := Vector3(cos(b) * ring.x, ring.y, sin(b) * ring.z)
			for v in [Vector3(0, ring.y, 0), v1 if end == 0 else v0, v0 if end == 0 else v1]:
				st.set_normal(Vector3.DOWN if end == 0 else Vector3.UP)
				st.add_vertex(v)
	st.index()
	return st.commit()
