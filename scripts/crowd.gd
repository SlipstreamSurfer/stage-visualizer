class_name Crowd
extends Node3D
# The crowd: up to 3,000 people from the barrier to the back, densest at the front, all facing the stage.
# And the DJ, shown only when the camera is over the DJ's shoulder; from the DJ's own eyes, the DJ is you.
# One mesh, drawn as a MultiMesh; the shader moves them (person.gdshader).

var mm: MultiMesh
var dj: MultiMesh
var dj_node: MultiMeshInstance3D

func build(count: int) -> void:
	var mesh := person_mesh()
	var mat := Kit.shader("res://shaders/person.gdshader")
	mm = MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_custom_data = true
	mm.mesh = mesh
	mm.instance_count = count
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var placed := 0
	while placed < count:
		var z := rng.randf_range(Hall.BARRIER + 0.45, 30.0)
		var x := rng.randf_range(-20.6, 20.6)
		if not _clear_of_towers(x, z): continue
		if rng.randf() > exp(-(z - Hall.BARRIER) / 30.0): continue   # fewer further back
		var size := Vector3(rng.randf_range(0.86, 1.18), rng.randf_range(0.89, 1.12), rng.randf_range(0.9, 1.15))
		var t := Transform3D(Basis(Vector3.UP, PI + rng.randf_range(-0.65, 0.65)).scaled(size), Vector3(x, 0, z))
		mm.set_instance_transform(placed, t)
		# the front moves more and raises their arms sooner
		var keen := clampf(1.0 - (z - Hall.BARRIER) / 45.0, 0.0, 1.0)
		mm.set_instance_custom_data(placed, Color(rng.randf(), rng.randf_range(0.3, 1.0) * (0.5 + keen * 0.5), rng.randf_range(0.0, 0.7) * (1.2 - keen), rng.randf()))
		placed += 1
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	mi.material_override = mat
	mi.extra_cull_margin = 0.6
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

# A single surface: tapered clothes, shoes, neck, head, hair and jointed arms.
# Colour: r = upper/lower arm, g = side, b = clothing region (0.35 phone, 0.625 screen).
static func person_mesh() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var parts := []
	for side in [-1.0, 1.0]:
		parts.append([_capsule(0.095, 0.83), Transform3D(Basis.IDENTITY, Vector3(side * 0.105, 0.49, 0)), Color(0, 0, 0.25)])
		parts.append([_sphere(0.1), Transform3D(Basis.IDENTITY.scaled(Vector3(0.95, 0.65, 1.55)), Vector3(side * 0.105, 0.075, 0.05)), Color(0, 0, 0.75)])
	parts.append([_torso(), Transform3D.IDENTITY, Color(0, 0, 0)])
	parts.append([_capsule(0.065, 0.16), Transform3D(Basis.IDENTITY, Vector3(0, 1.47, 0)), Color(0, 0, 1)])
	parts.append([_sphere(0.115), Transform3D(Basis.IDENTITY.scaled(Vector3(0.94, 1.1, 0.95)), Vector3(0, 1.62, 0)), Color(0, 0, 1)])
	parts.append([_sphere(0.116), Transform3D(Basis.IDENTITY.scaled(Vector3(1.0, 0.7, 1.0)), Vector3(0, 1.69, -0.015)), Color(0, 0, 0.5)])
	for side in [-1.0, 1.0]:
		var g := 0.0 if side < 0.0 else 1.0
		parts.append([_capsule(0.073, 0.36), Transform3D(Basis(Vector3.BACK, side * 0.1), Vector3(side * 0.255, 1.27, 0)), Color(1, g, 0)])
		parts.append([_capsule(0.059, 0.31), Transform3D(Basis.IDENTITY, Vector3(side * 0.275, 0.99, 0)), Color(0.5, g, 1)])
		parts.append([_sphere(0.064), Transform3D(Basis.IDENTITY, Vector3(side * 0.275, 0.82, 0)), Color(0.5, g, 1)])
	# The phone follows the right wrist through the same elbow/shoulder transforms.
	# The shader collapses it for the other 96%, keeping one opaque surface/draw.
	var phone := BoxMesh.new()
	phone.size = Vector3(0.085, 0.16, 0.014)
	parts.append([phone, Transform3D(Basis.IDENTITY, Vector3(0.275, 0.735, 0.0)), Color(0.5, 1, 0.35)])
	var screen := BoxMesh.new()
	screen.size = Vector3(0.071, 0.133, 0.002)
	parts.append([screen, Transform3D(Basis.IDENTITY, Vector3(0.275, 0.735, -0.008)), Color(0.5, 1, 0.625)])
	for part in parts:
		var arrays: Array = part[0].get_mesh_arrays() if part[0] is PrimitiveMesh else part[0].surface_get_arrays(0)
		var t: Transform3D = part[1]
		var nb := t.basis.inverse().transposed()
		var verts: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
		var norms: PackedVector3Array = arrays[Mesh.ARRAY_NORMAL]
		var idx := PackedInt32Array()
		if arrays[Mesh.ARRAY_INDEX] != null: idx = arrays[Mesh.ARRAY_INDEX]
		if idx.is_empty():
			for i in verts.size(): idx.append(i)
		for i in idx:
			st.set_color(part[2])
			st.set_normal((nb * norms[i]).normalized())
			st.add_vertex(t * verts[i])
	st.index()
	return st.commit()

static func _torso() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rings := [Vector3(0.18, 0.85, 0.115), Vector3(0.20, 1.08, 0.13), Vector3(0.23, 1.35, 0.125), Vector3(0.15, 1.45, 0.09)]
	for j in range(rings.size() - 1):
		for i in 8:
			var a := i * TAU / 8.0
			var b := (i + 1) * TAU / 8.0
			var lower: Vector3 = rings[j]
			var upper: Vector3 = rings[j + 1]
			var v0 := Vector3(cos(a) * lower.x, lower.y, sin(a) * lower.z)
			var v1 := Vector3(cos(a) * upper.x, upper.y, sin(a) * upper.z)
			var v2 := Vector3(cos(b) * upper.x, upper.y, sin(b) * upper.z)
			var v3 := Vector3(cos(b) * lower.x, lower.y, sin(b) * lower.z)
			for v in [v0, v2, v1, v0, v3, v2]: st.add_vertex(v)
	st.generate_normals()
	return st.commit()

static func _capsule(r: float, h: float) -> CapsuleMesh:
	var c := CapsuleMesh.new()
	c.radius = r
	c.height = h
	c.radial_segments = 8
	c.rings = 2
	return c

static func _sphere(r: float) -> SphereMesh:
	var s := SphereMesh.new()
	s.radius = r
	s.height = r * 2
	s.radial_segments = 10
	s.rings = 6
	return s
