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
	_check_appearance(crowd)
	crowd.free()
	print("crowd detail: %d triangles, %d checks, %d failures" % [indices.size() / 3, checks, failures])
	quit(0 if failures == 0 else 1)

# A mixed crowd: mostly dark clothes, every colour in use, white and neon rare; the stage's light eased and off in a blackout.
func _check_appearance(crowd: Crowd) -> void:
	var cloth := {}
	var hair := {}
	var pants := {}
	var white := 0
	var neon := 0
	var dark := 0
	var n := crowd.people.size()
	check(n == crowd.mm.instance_count, "Every person keeps an appearance")
	for i in n:
		var c := crowd.people[i]
		var k := Crowd.pick(Crowd.CLOTH, Crowd.cloth_key(c))
		cloth[k] = true
		hair[Crowd.pick(Crowd.HAIR, Crowd.hair_key(c))] = true
		pants[Crowd.pick(Crowd.PANTS, Crowd.pants_key(c))] = true
		if k == 10: white += 1
		elif k > 10: neon += 1
		elif k in [0, 1, 3]: dark += 1
	check(cloth.size() == Crowd.CLOTH.size(), "Every shirt colour is worn: %d of %d" % [cloth.size(), Crowd.CLOTH.size()])
	check(hair.size() == Crowd.HAIR.size() and pants.size() == Crowd.PANTS.size(), "Every hair and trouser colour is in use")
	check(white > n * 0.02 and white < n * 0.07, "White shirts stay an accent: %d" % white)
	check(neon > n * 0.01 and neon < n * 0.05, "Neon stays rare: %d" % neon)
	check(dark > n * 0.45, "Most of the crowd stays dark: %d" % dark)
	for table in [Crowd.CLOTH, Crowd.HAIR, Crowd.PANTS]:
		var total := 0.0
		for e in table: total += float(e[1])
		check(absf(total - 1.0) < 0.001, "Shares add up to the whole crowd")
	var mat := crowd.material
	check((crowd.get_child(0) as MultiMeshInstance3D).material_override == mat and (mat.get_shader_parameter("cloth_colours") as PackedVector3Array).size() == Crowd.CLOTH.size(), "The shader gets the shirt colours")
	check((mat.get_shader_parameter("cloth_ends") as PackedFloat32Array)[Crowd.CLOTH.size() - 1] > 1.0, "The last share takes every key")
	for i in 30: crowd.stage_light(Color(1, 0, 0), 40.0, 0.1)
	var on: Vector3 = mat.get_shader_parameter("stage_light")
	check(on.x > 0.9 and on.y == 0.0 and on.z == 0.0, "Stage light takes the show's colour: %s" % on)
	crowd.stage_light(Color(1, 1, 1), 200.0, 0.016)
	var flash: Vector3 = mat.get_shader_parameter("stage_light")
	check(flash.length() <= sqrt(3.0) + 0.001 and flash.y < 0.1, "A strobe frame does not flash the crowd: %s" % flash)
	for i in 60: crowd.stage_light(Color(1, 0, 0), 0.0, 0.1)
	check((mat.get_shader_parameter("stage_light") as Vector3).length() < 0.01, "No stage light in a blackout")
