extends SceneTree
# Read the actual batch transforms, not dummy-renderer MultiMesh readbacks.
class AuditHall extends Hall:
	var cabinets: Array = []
	func _array(dark: Kit.Batch, top: Vector3, n: int, size: Vector3, yaw: float) -> void:
		var first := dark.xforms.size()
		super._array(dark, top, n, size, yaw)
		cabinets.append(dark.xforms.slice(first + 1))

var failed: Array[String] = []

func _initialize() -> void:
	call_deferred("_run")

func check(ok: bool, message: String) -> void:
	if not ok: failed.append(message)

func _run() -> void:
	var hall := AuditHall.new()
	root.add_child(hall)
	hall.build()
	hall.set_process(false)
	check(hall.cabinets.size() == 2, "Keep the two PA hangs")
	for hang: Array in hall.cabinets:
		check(hang.size() == 12, "Keep twelve boxes per hang")
		var previous := Vector3.ZERO
		for i in hang.size():
			var t: Transform3D = hang[i]
			var forward := t.basis.orthonormalized().z
			check(forward.z > 0.0, "PA fronts must face the audience (+Z)")
			check(forward.y <= 0.0001, "PA box %d points upwards" % i)
			check(t.origin.x * forward.x < 0.0, "PA must toe towards the hall, not the walls")
			if i > 0:
				check(t.origin.y < previous.y, "PA boxes must descend")
				check(t.origin.z <= previous.z + 0.0001, "PA curve must follow downward-facing fronts")
			previous = t.origin
		var lowest: Transform3D = hang[-1]
		check(is_equal_approx(rad_to_deg(asin(lowest.basis.orthonormalized().z.y)), -45.37826), "Keep the intended splay magnitude, aimed down")
	var fronts := hall.get_node_or_null("PAFronts") as MultiMeshInstance3D
	check(fronts != null, "PA and subs need recognisable grilles")
	if fronts != null:
		check(fronts.multimesh.instance_count == 48, "Grilles for 24 flown cabinets and 24 subs")
		check(fronts.multimesh.mesh.get_surface_count() == 1, "All PA grilles share one surface")
		check(fronts.cast_shadow == GeometryInstance3D.SHADOW_CASTING_SETTING_OFF, "Thin grilles must not add shadow passes")
	var rig := Rig.new()
	root.add_child(rig)
	rig.build()
	var slots := []
	for f in rig.fixtures:
		if f.group == "front":
			check(is_equal_approx(f.mount.y, Hall.DECK) and is_equal_approx(f.mount.z, Hall.FRONT - 0.8), "Front-head bases must stay in their row")
			slots.append(roundi((f.mount.x + 20.3) / 1.4))
	check(slots.size() == 26, "Keep 26 front heads and the intended PA gaps")
	for slot in [2, 3, 26, 27]: check(not slots.has(slot), "Keep the PA clearance at slot " + str(slot))
	rig.free()
	hall.free()
	print("PA geometry: ", "passed" if failed.is_empty() else failed)
	quit(0 if failed.is_empty() else 1)
