extends SceneTree
# Crowd detail stays one indexed opaque surface with the existing animation tags.
var failures := 0
var checks := 0

func check(ok: bool, message: String) -> void:
	checks += 1
	if not ok:
		failures += 1
		printerr(message)

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var mesh := Crowd.person_mesh()
	check(mesh.get_surface_count() == 1, "People must stay one surface")
	var arrays := mesh.surface_get_arrays(0)
	var verts: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
	var normals: PackedVector3Array = arrays[Mesh.ARRAY_NORMAL]
	var colours: PackedColorArray = arrays[Mesh.ARRAY_COLOR]
	var indices: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
	check(not indices.is_empty(), "Keep indexed geometry")
	check(indices.size() / 3 <= 1050, "Crowd detail exceeds the 1050 triangle budget per person")
	check(verts.size() == normals.size() and verts.size() == colours.size(), "Every vertex needs a normal and animation tags")
	var head_normals := {}
	var ear_width := 0.0
	var tags := {}
	for i in verts.size():
		var p := verts[i]
		var n := normals[i]
		check(p.is_finite() and n.is_finite(), "Nonfinite crowd geometry")
		check(is_equal_approx(n.length(), 1.0), "Crowd normals must be unit length")
		check(p.y >= 0.0 and p.y <= 1.8 and absf(p.x) < 0.4, "Keep the crowd's scale and shoulder clearance")
		var c := colours[i]
		tags[c] = true
		if c == Color(0, 0, 1) and p.y > 1.545 and p.y < 1.70 and absf(n.y) < 0.999:
			ear_width = maxf(ear_width, absf(p.x))
			var key := p.snapped(Vector3.ONE * 0.00001)
			if not head_normals.has(key): head_normals[key] = n
			else: check(head_normals[key].distance_to(n) < 0.001, "Head lighting has a hard seam at " + str(p))
	check(ear_width > 0.118, "Heads need an ear silhouette, not just a faceted oval")
	for tag in [Color(0, 0, 0), Color(0, 0, 0.25), Color(0, 0, 0.5), Color(0, 0, 0.75), Color(0, 0, 1), Color(0.5, 1, 0.35), Color(0.5, 1, 0.625)]:
		var found := false
		for colour: Color in tags:
			if Vector3(colour.r, colour.g, colour.b).distance_to(Vector3(tag.r, tag.g, tag.b)) < 0.004: found = true
		check(found, "Keep material and joint tag " + str(tag))
	for i in range(0, indices.size(), 3):
		var a := verts[indices[i]]
		var b := verts[indices[i + 1]]
		var c := verts[indices[i + 2]]
		check((b - a).cross(c - a).length_squared() > 1e-18, "Degenerate crowd triangle")
	var crowd := Crowd.new()
	root.add_child(crowd)
	crowd.build(3000)
	check(crowd.mm.instance_count == 3000 and crowd.mm.mesh.get_surface_count() == 1, "Keep 3000 people in one MultiMesh")
	check(crowd.get_child_count() == 2, "Keep one crowd draw plus the separate DJ")
	crowd.shown(1200)
	check(crowd.mm.visible_instance_count == 1200, "Light preset crowd count")
	check(crowd.dj.mesh == crowd.mm.mesh and not crowd.dj_node.visible, "DJ shares geometry and stays hidden from own eyes")
	crowd.free()
	print("crowd detail: %d triangles, %d checks, %d failures" % [indices.size() / 3, checks, failures])
	quit(0 if failures == 0 else 1)
