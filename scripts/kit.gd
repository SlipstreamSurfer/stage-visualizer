class_name Kit
extends RefCounted
# What the hall is built from: materials, boxes, tubes and trusses. Many small parts of one kind go into one
# MultiMesh (a Batch), so the hall stays a few hundred draw calls.

static func mat(color: Color, rough := 0.6, metal := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = rough
	m.metallic = metal
	return m

static func glowing(color: Color, gain: float) -> StandardMaterial3D:
	var m := mat(Color.BLACK, 0.5)
	m.emission_enabled = true
	m.emission = color
	m.emission_energy_multiplier = gain
	return m

static func shader(path: String, params := {}) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = load(path)
	for k in params: m.set_shader_parameter(k, params[k])
	return m

static func box(parent: Node3D, size: Vector3, pos: Vector3, material: Material, shadows := true) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var b := BoxMesh.new()
	b.size = size
	mi.mesh = b
	mi.material_override = material
	mi.position = pos
	if not shadows: mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	return mi

# A unit tube from a to b with radius r: a Transform3D for a cylinder of height 1 and radius 1.
static func tube(a: Vector3, b: Vector3, r: float) -> Transform3D:
	var d := b - a
	var l := d.length()
	var y := d / l
	var x := y.cross(Vector3.UP if absf(y.y) < 0.99 else Vector3.RIGHT).normalized()
	var z := x.cross(y)
	return Transform3D(Basis(x * r, y * l, z * r), (a + b) * 0.5)

# A box of a given size, centre and turn around Y: a Transform3D for a box of size 1.
static func block(size: Vector3, pos: Vector3, yaw := 0.0) -> Transform3D:
	return Transform3D(Basis(Vector3.UP, yaw) * Basis.from_scale(size), pos)

# Many copies of one mesh in one material.
class Batch:
	var mesh: Mesh
	var material: Material
	var xforms: Array[Transform3D] = []
	var shadows := true

	func _init(m: Mesh, mt: Material, cast := true) -> void:
		mesh = m
		material = mt
		shadows = cast

	func add(t: Transform3D) -> void:
		xforms.append(t)

	func build(parent: Node3D) -> MultiMeshInstance3D:
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = mesh
		mm.instance_count = xforms.size()
		for i in xforms.size(): mm.set_instance_transform(i, xforms[i])
		var mi := MultiMeshInstance3D.new()
		mi.multimesh = mm
		mi.material_override = material
		if not shadows: mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		parent.add_child(mi)
		return mi

static func unit_tube() -> CylinderMesh:
	var c := CylinderMesh.new()
	c.top_radius = 1.0
	c.bottom_radius = 1.0
	c.height = 1.0
	c.radial_segments = 8
	c.rings = 1
	return c

static func unit_box() -> BoxMesh:
	var b := BoxMesh.new()
	b.size = Vector3.ONE
	return b

# A routed cable, built once into a shared tube batch.
static func cable(batch: Batch, points: Array[Vector3], radius := 0.004) -> void:
	for i in range(1, points.size()):
		if points[i - 1].distance_squared_to(points[i]) > 1e-10:
			batch.add(tube(points[i - 1], points[i], radius))

# A 40 cm box truss from a to b (local to whatever it is built into): four chords and the zigzag between them.
static func truss(chords: Batch, braces: Batch, a: Vector3, b: Vector3, w := 0.4) -> void:
	var d := (b - a).normalized()
	var p := d.cross(Vector3.UP if absf(d.y) < 0.9 else Vector3.FORWARD).normalized() * (w * 0.5)
	var q := d.cross(p).normalized() * (w * 0.5)
	var corners := [p + q, p - q, -p - q, -p + q]
	for c in corners: chords.add(tube(a + c, b + c, 0.024))
	var l := (b - a).length()
	var n := maxi(1, int(l / w))
	for i in n:
		var s0 := a + (b - a) * (float(i) / n)
		var s1 := a + (b - a) * (float(i + 1) / n)
		for k in 4:
			var c0: Vector3 = corners[k]
			var c1: Vector3 = corners[(k + 1) % 4]
			if i % 2 == 0: braces.add(tube(s0 + c0, s1 + c1, 0.012))
			else: braces.add(tube(s0 + c1, s1 + c0, 0.012))
