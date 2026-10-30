extends SceneTree
# Compatibility launcher. The normal app now owns recording and replay.
func _initialize() -> void:
	call_deferred("_start")
func _start() -> void:
	var main: Node = load("res://main.tscn").instantiate()
	root.add_child(main)
	current_scene = main
