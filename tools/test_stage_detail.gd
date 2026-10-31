extends SceneTree
# Static detail must remain batched, connected and independent of show controls.
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
	var rig := Rig.new()
	root.add_child(rig)
	rig.build()
	check(rig.fixtures.size() == 209, "Detail must not add or remove lights")
	for label in ["DelayMounts", "DelaySafeties", "TowerFeet"]:
		check_batch(rig, label)
	var mounts := rig.get_node_or_null("DelayMounts") as MultiMeshInstance3D
	var safeties := rig.get_node_or_null("DelaySafeties") as MultiMeshInstance3D
	if mounts != null:
		check(mounts.multimesh.instance_count == 8 * 66, "Each delay head needs two rails and four sixteen-part clamps")
	if safeties != null:
		check(safeties.multimesh.instance_count == 8 * 8, "Each delay head needs a closed eight-part safety")
	var delay := 0
	for f in rig.fixtures:
		if f.group != "delay": continue
		delay += 1
		check(is_equal_approx(f.mount.y, 9.2) and f.up == Vector3.UP and f.truss == -1, "Delay mounting must not alter the show")
	check(delay == 8, "Keep all eight delay heads")
	rig.free()
	for decks in [2, 4]:
		var hall := Hall.new()
		hall.booth_decks = decks
		root.add_child(hall)
		hall.build()
		hall.set_process(false)
		check_batch(hall, "BoothTrim")
		check_batch(hall, "BoothCables")
		check_batch(hall, "BoothHardware")
		check(hall._deck_faces.size() == decks, "Keep independent linked deck displays")
		var top := hall.get_node("BoothTop") as MeshInstance3D
		check(is_equal_approx(top.position.y + (top.mesh as BoxMesh).size.y / 2.0, Hall.TABLE), "Keep table working height")
		var occupied := []
		for i in decks:
			var player := hall.get_node("CDJ3000X_Deck%d" % (i + 1)) as Node3D
			check(is_equal_approx(player.position.y, Hall.TABLE), "Player feet stay on table")
			check(is_equal_approx(player.position.z, Hall.BOOTH_Z - 0.53), "Do not move players away from DJ")
			occupied.append(Vector2(player.position.x - 0.3446 / 2.0, player.position.x + 0.3446 / 2.0))
		occupied.append(Vector2(-0.4074 / 2.0, 0.4074 / 2.0))
		occupied.sort_custom(func(a, b): return a.x < b.x)
		for i in range(1, occupied.size()):
			check(is_equal_approx(occupied[i].x - occupied[i - 1].y, 0.018), "Retain 18 mm gaps between gear")
		hall.free()
	print("stage detail: %d checks, %d failures" % [checks, failures])
	quit(0 if failures == 0 else 1)

func check_batch(parent: Node, label: String) -> void:
	var node := parent.get_node_or_null(NodePath(label)) as MultiMeshInstance3D
	check(node != null, "Missing batched detail: " + label)
	if node == null: return
	check(node.multimesh.instance_count > 0, "Empty detail: " + label)
	check(node.multimesh.mesh.get_surface_count() == 1, "One surface per detail batch: " + label)
	check(node.cast_shadow == GeometryInstance3D.SHADOW_CASTING_SETTING_OFF, "Small detail must not add shadow draws: " + label)
	for i in node.multimesh.instance_count:
		var t := node.multimesh.get_instance_transform(i)
		check(t.is_finite() and absf(t.basis.determinant()) > 0.0, "Invalid detail transform: " + label)
