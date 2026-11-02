class_name ShowFeedback
extends RefCounted
# A bounded diagnostic history, kept in memory until an explicit rating. No audio is recorded.
const HISTORY := 60.0
var folder := "user://feedback"
var clock := 0.0
var error := ""
var samples: Array = []
var _next := 0.0

func observe(dt: float, light: Show, rig: Rig, camera: int) -> void:
	clock += maxf(dt, 0.0)
	if clock < _next: return
	_next = clock + 0.1
	var groups := {}
	for f in rig.fixtures:
		if not groups.has(f.group): groups[f.group] = {"on": 0, "total": 0, "level_sum": 0.0}
		groups[f.group].total += 1
		groups[f.group].on += 1 if f.level > 0.01 else 0
		groups[f.group].level_sum += f.level
	var colours: Array = light.colours_in_use.map(func(c: Color): return c.to_html())
	samples.append({"t": snappedf(clock, 0.001), "beat": light.beat, "bpm": light.bpm,
		"section": light.section, "phrase": light.phrase, "build": light.build, "energy": light.energy, "genre": light.genre,
		"track": light.title, "source": light.source, "scene": light.scene_text(), "scene_id": light._scene,
		"figure": light._head_look, "stack": light.stack_name, "trusses": light.truss_name, "row": light.row_look,
		"composition": ShowPhrasing.NAMES[light.phrasing.cue], "gesture": light.gestures.name,
		"gesture_mix": light.gestures.mix, "gesture_elapsed": light.gestures.elapsed,
		"gesture_scope": light.gestures.scope, "gesture_route_seed": light.gestures.route_seed,
		"gesture_path": light.gestures.path.map(func(v: Vector3): return [v.x, v.z]) if light.gestures.mix > 0.0 else [],
		"sequence_block": light._blk_index, "palette_index": light._palette, "motion": light._motion,
		"gesture_variants": light.gestures.variants.duplicate(), "colours": colours,
		"safe": light.safe, "camera": camera, "controls": light.tune.duplicate(true),
		"blackout": light.manual.blackout, "strobe": rig.strobe, "blinder": rig.blinder, "groups": groups})
	while not samples.is_empty() and float(samples[0].t) < clock - HISTORY: samples.pop_front()

func freeze() -> Dictionary:
	return {"end": snappedf(clock, 0.001), "created": Time.get_datetime_string_from_system(), "samples": samples.duplicate(true)}

func save_rating(verdict: String, seconds: int, note: String, frozen: Dictionary, existing := "") -> String:
	error = ""
	if verdict not in ["good", "needs_work"] or seconds not in [5, 15, 30, 60]:
		error = "Invalid feedback selection."
		return ""
	var end: float = frozen.get("end", clock)
	var rows: Array = frozen.get("samples", []).filter(func(row): return float(row.t) >= end - seconds and float(row.t) <= end)
	var captured := 0.0 if rows.is_empty() else maxf(0.0, end - float(rows[0].t))
	var document := {"kind": "sv_show_feedback", "schema": 1, "created": frozen.get("created", Time.get_datetime_string_from_system()),
		"version": BuildInfo.version(), "build": BuildInfo.label(), "engine": Engine.get_version_info().string,
		"rating": verdict, "requested_seconds": seconds, "captured_seconds": snappedf(captured, 0.001),
		"note": note.left(4000), "audio_recorded": false, "history_end": end, "samples": rows}
	var directory := ProjectSettings.globalize_path(folder)
	if DirAccess.make_dir_recursive_absolute(directory) != OK:
		error = "Could not create the feedback folder."
		return ""
	var path := existing
	if path == "":
		var stamp := Time.get_datetime_string_from_system().replace(":", "-")
		path = directory.path_join("%s-%d.json" % [stamp, Time.get_ticks_usec()])
	var temporary := path + ".tmp"
	var file := FileAccess.open(temporary, FileAccess.WRITE)
	if file == null:
		error = "Could not write feedback."
		return ""
	file.store_string(JSON.stringify(document, "\t"))
	var result := file.get_error()
	file.close()
	if result != OK or DirAccess.rename_absolute(temporary, path) != OK:
		DirAccess.remove_absolute(temporary)
		error = "Could not save feedback."
		return ""
	return path
