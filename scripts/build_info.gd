class_name BuildInfo
extends RefCounted
# Which SV this is. A release shows its version; a run from the source folder also shows the branch and commit (and
# whether files have changed since), so a test version is never mistaken for a release.

static var _label := ""

static func version() -> String:
	return str(ProjectSettings.get_setting("application/config/version", "?"))

static func label() -> String:
	if _label != "": return _label
	_label = version()
	if OS.has_feature("editor"):
		var branch := _git(["branch", "--show-current"])
		var commit := _git(["rev-parse", "--short", "HEAD"])
		if commit == "":
			_label += " · from source"
		else:
			var changed := _git(["status", "--porcelain"]) != ""
			_label += " · %s · %s%s" % [branch if branch != "" else "detached", commit, " + changes" if changed else ""]
	return _label

static func _git(args: Array) -> String:
	var out := []
	var all := ["-C", ProjectSettings.globalize_path("res://")]
	all.append_array(args)
	if OS.execute("git", all, out, false) != 0 or out.is_empty(): return ""
	return str(out[0]).strip_edges()
