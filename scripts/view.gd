class_name View
extends Camera3D
# Five views of the same hall. The shoulder property keeps older sessions working.

signal camera_changed(index: int)

const EYES := Vector3(0, Hall.DECK + Hall.RISER + 1.72, Hall.BOOTH_Z - 1.45)

const NAMES := ["DJ eyes", "Over the shoulder", "In the crowd", "FOH", "Stage side"]
var _camera := 1
var _snap := true
var shoulder: bool:
	get: return _camera == 2
	set(value):
		if value: select_camera(2)
		elif _camera == 2: select_camera(1)
var fixed := {}   # for looking at the build from anywhere: eye, at, fov, ortho (set from the command line)
var yaw := 0.0
var pitch := 0.0
var _t := 0.0

func _ready() -> void:
	near = 0.05
	far = 160.0

func update(dt: float, show: Show) -> void:
	_t += dt
	var before_fov := fov
	if fixed:
		position = fixed.eye
		if fixed.has("ortho"):
			projection = PROJECTION_ORTHOGONAL
			size = fixed.ortho
		else: fov = fixed.get("fov", 60.0)
		look_at(fixed.at, Vector3.FORWARD if absf((fixed.at - fixed.eye).normalized().y) > 0.99 else Vector3.UP)
		return
	var pos: Vector3
	var look: Vector3
	if _camera == 2:
		# SV's DJ booth: behind whoever plays, over one shoulder for a while, slowly across to the other
		pos = Vector3(sin(PI / 2 * sin(_t * 0.045)), Hall.DECK + 1.75 + Hall.RISER + 1.1, Hall.BOOTH_Z - 3.05)
		look = Vector3(0, Hall.DECK + 1.75 + Hall.RISER - 1.35, Hall.BOOTH_Z + 10.5)
		fov = 72
	elif _camera >= 3:
		pos = [Vector3(0, 2.1, -8), Vector3(0, 2.8, 25), Vector3(12, 4.6, Hall.BOOTH_Z - 1.0)][_camera - 3]
		look = Vector3(0, Hall.DECK + 3.0, Hall.BOOTH_Z + (5.0 if _camera == 5 else 0.0))
		fov = 72.0 if _camera == 3 else 68.0 if _camera == 5 else 60.0
	else:
		# a person standing: never quite still, a little give in the knees on the beat
		var bob := 0.008 * exp(-show.since_kick * 6.0) if show.section in ["groove", "peak"] else 0.0
		pos = EYES + Vector3(sin(_t * 0.31) * 0.025, -bob + sin(_t * 0.23) * 0.01, 0)
		look = Vector3(sin(_t * 0.07) * 0.6, Hall.DECK + 0.6, -10.0)
		fov = 68
	var before := transform
	position = pos
	look_at(look)
	rotate_y(yaw)
	rotate_object_local(Vector3.RIGHT, pitch)
	if not _snap:
		transform = before.interpolate_with(transform, 1.0 - exp(-dt * 6.0))
		fov = lerpf(before_fov, fov, 1.0 - exp(-dt * 6.0))
	_snap = false

func select_camera(index: int, immediate := false) -> void:
	index = clampi(index, 1, NAMES.size())
	if immediate: _snap = true
	if index == _camera: return
	_camera = index
	yaw = 0.0
	pitch = 0.0
	camera_changed.emit(_camera)

func camera_index() -> int:
	return _camera

func shows_dj() -> bool:
	return _camera != 1

func _unhandled_input(event: InputEvent) -> void:
	if not fixed.is_empty(): return
	if event is InputEventKey and event.pressed and not event.echo and event.keycode >= KEY_1 and event.keycode <= KEY_5:
		select_camera(event.keycode - KEY_1 + 1)
		get_viewport().set_input_as_handled()

func drag(rel: Vector2) -> void:
	yaw = clampf(yaw - rel.x * 0.003, -1.4, 1.4)
	pitch = clampf(pitch - rel.y * 0.003, -0.7, 0.9)
