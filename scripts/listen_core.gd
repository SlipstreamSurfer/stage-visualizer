class_name SVListenCore
extends RefCounted
# Faithful port of stage-visualizer/src/listen.js (2026-10-26).
# All times are seconds on the sample clock. No scene/rendering dependencies.

static func follow(v: float, target: float, dt: float, seconds: float) -> float:
	return v + (target - v) * (1.0 - exp(-dt / seconds))

static func log2v(v: float) -> float:
	return log(v) / log(2.0)

class MusicResponse:
	var refs = [0.018, 0.006, 0.002]
	var floors = refs.duplicate()
	var fast = [0.0, 0.0, 0.0]
	var slow = [0.0, 0.0, 0.0]
	var levels = [0.0, 0.0, 0.0]
	var bed = [0.0, 0.0, 0.0]
	var near = [0.0, 0.0, 0.0]
	var far = [0.0, 0.0, 0.0]
	var armed = true
	var high_armed = true
	var last_kick = -10.0
	var last_accent = -10.0
	var level = 0.0

	func update(raw: Array, rms: float, t: float, delta: float, sens: float) -> Dictionary:
		var dt = clampf(delta, 0.001, 0.1)
		var gate = clampf((rms - 0.0025) / 0.0075, 0.0, 1.0)
		var transients = []
		for i in 3:
			var x = raw[i]
			refs[i] = maxf(floors[i], SVListenCore.follow(refs[i], x, dt, 0.025 if x > refs[i] else 8.0))
			fast[i] = SVListenCore.follow(fast[i], x, dt, 0.012)
			slow[i] = SVListenCore.follow(slow[i], x, dt, 0.22)
			bed[i] = SVListenCore.follow(bed[i], x, dt, 1.5)
			transients.append(maxf(0.0, (fast[i] - slow[i]) / refs[i]) * gate)
			var target = clampf(pow(x / refs[i], 0.75) * 0.85 * sens, 0.0, 1.0) * gate
			levels[i] = SVListenCore.follow(levels[i], target, dt, 0.018 if target > levels[i] else 0.12)
		var step = 0.0
		var steady = true
		for spec in [[0, 0.05, 0.12], [2, 0.03, 0.035]]:
			var i = spec[0]
			near[i] = SVListenCore.follow(near[i], levels[i], dt, 1.0)
			far[i] = SVListenCore.follow(far[i], levels[i], dt, 8.0)
			var ratio = near[i] / maxf(far[i], spec[1])
			if ratio > 1.2: steady = false
			if near[i] - far[i] > spec[2]: step = maxf(step, ratio)
		var threshold = 0.105 / sqrt(sens)
		if transients[0] < threshold * 0.4 or gate == 0: armed = true
		var kick = armed and gate > 0.2 and transients[0] > threshold and raw[0] > refs[0] * 0.2 and t - last_kick > 0.22
		if kick:
			armed = false
			last_kick = t
		var high_threshold = 0.12 / sqrt(sens)
		if transients[2] < high_threshold * 0.4 or gate == 0: high_armed = true
		var accent = high_armed and transients[2] > high_threshold and t - last_accent > 0.09
		if accent:
			high_armed = false
			last_accent = t
		level = SVListenCore.follow(level, gate, dt, 0.025 if gate > level else 0.18)
		return {"bass": levels[0], "mid": levels[1], "high": levels[2],
			"raw_bass": raw[0], "raw_mid": raw[1], "raw_high": raw[2],
			"bass_onset": transients[0], "bass_rise": maxf(0.0, fast[0] - slow[0]) * gate,
			"kick": kick, "kick_strength": clampf(0.45 + transients[0] * 1.5, 0.0, 1.0),
			"accent": clampf(transients[2] * 1.6, 0.0, 1.0) if accent else 0.0, "level": level,
			"bed_mid": maxf(bed[1], floors[1] * 0.01), "bed_high": maxf(bed[2], floors[2] * 0.01),
			"step": step, "steady": steady}

class TempoTracker:
	const COMB = 4
	const HOME = 20
	const AWAY = 30
	var env := PackedFloat32Array()
	var at = 0
	var filled = 0
	var clock = 0.0
	var peak = 0.0
	var since_estimate = 0.0
	var bpm = 0.0
	var confidence = 0.0
	var held_for = 0
	var rival = 0.0
	var rival_for = 0
	var home = 0.0
	var home_for = 0
	var kicks = 0.0
	var hold = false
	var ac := PackedFloat32Array()

	func _init() -> void:
		env.resize(1200)

	func update(dt: float, onset: float, kick_tempo: float, held: bool) -> void:
		kicks = kick_tempo
		hold = held
		peak = maxf(peak, onset)
		clock += dt
		var wrote = false
		while clock >= 0.01:
			clock -= 0.01
			env[at] = peak
			wrote = true
			at = (at + 1) % env.size()
			filled = mini(filled + 1, env.size())
		if wrote: peak = 0.0
		since_estimate += dt
		if since_estimate >= 1.0 and filled >= 600:
			since_estimate = 0.0
			estimate()

	func _ac_at(lag: float) -> float:
		var i = floori(lag)
		var f = lag - i
		return ac[i] * (1.0 - f) + ac[i + 1] * f if i + 1 < ac.size() else 0.0

	func _fit(length: float) -> float:
		var sum: float = 0.0
		for k in range(1, COMB + 1): sum += _ac_at(length * k)
		return sum / COMB

	func _keep() -> void:
		held_for += 1
		rival_for = 0
		if absf(bpm - home) <= 2: home_for += 1
		elif held_for > home_for:
			home = bpm
			home_for = held_for

	func estimate() -> void:
		var n: int = filled
		var x := PackedFloat32Array()
		x.resize(n)
		var mean: float = 0.0
		for i: int in n:
			x[i] = minf(env[(at - n + i + env.size()) % env.size()], 2.0)
			mean += x[i]
		mean /= n
		var energy: float = 0.0
		for i: int in n:
			x[i] -= mean
			energy += x[i] * x[i]
		if energy < 1e-4:
			confidence = 0.0
			return
		var max_lag: int = mini(n - 100, ceili(COMB * 60.0 / 100.0 * 100.0) + 2)
		ac.resize(max_lag + 1)
		for lag: int in range(1, max_lag + 1):
			var sum: float = 0.0
			for i: int in range(lag, n): sum += x[i] * x[i - lag]
			ac[lag] = sum / energy * n / (n - lag)
		var best: float = 0.0
		var best_score: float = -1.0
		var total: float = 0.0
		var count: int = 0
		for q: int in 321:
			var candidate: float = 100.0 + q * 0.25
			var score: float = _fit(60.0 / candidate * 100.0)
			total += maxf(0.0, score)
			count += 1
			if score > best_score:
				best_score = score
				best = candidate
		confidence = clampf(best_score * 1.6, 0.0, 1.0) * clampf((best_score - total / count) * 6.0, 0.0, 1.0)
		if not bpm:
			if confidence > 0.4:
				bpm = best
				held_for = 0
			return
		if absf(best - bpm) <= 1.5:
			if confidence > 0.25: bpm += (best - bpm) * 0.3
			_keep()
			return
		if hold: return
		if _fit(60.0 / bpm * 100.0) > best_score * 0.85:
			_keep()
			return
		if confidence <= 0.25: return
		var ratio = best / bpm
		if kicks and absf(kicks - bpm) / bpm < 0.04 and not absf(kicks - best) / best < 0.04:
			rival_for = 0
			return
		rival_for = rival_for + 1 if absf(best - rival) <= 1.5 else 1
		rival = best
		var simple = false
		for q in [0.5, 2.0 / 3, 0.75, 0.8, 1.25, 4.0 / 3, 1.5, 2.0]:
			if absf(ratio / q - 1.0) < 0.03: simple = true
		var settled = home_for >= HOME and absf(best - home) > 2.0
		var patience = AWAY if settled else 2 if held_for < 15 or absf(best - home) <= 2 else 24 if simple else 5 if kicks and absf(kicks - best) / best < 0.04 else 12
		if rival_for >= patience:
			bpm = best
			held_for = 0
			rival_for = 0

class SectionTracker:
	var bed = [0.0, 0.0, 0.0]
	var ref = [0.0, 0.0]
	var density = 0.0
	var near = 0.0
	var far = 0.0
	var section = "intro"
	var was_full = false
	var full_for = 0.0
	var pending = ""
	var pending_for = 0.0
	var hold = 0.0
	var kick_for = 0.0
	var lifted = 100.0

	func update(dt: float, raw: Array, kicking: bool, dropped: bool) -> Dictionary:
		for i in 3: bed[i] = SVListenCore.follow(bed[i], raw[i], dt, 1.0 if kick_for < 3 and kicking else 3.0)
		kick_for = kick_for + dt if kicking else 0.0
		lifted += dt
		var floors = [bed[0] * 0.04, bed[0] * 0.012]
		for i in 2:
			var held = ref[i] * exp(-dt / 400.0)
			ref[i] = maxf(1e-9, maxf(maxf(floors[i], bed[i + 1]), held) if kicking and kick_for > 3 else maxf(held, floors[i] if kicking else 0.0))
		var fullness_mid = clampf(1.0 + SVListenCore.log2v(maxf(bed[1], 1e-9) / ref[0]) / 2.5, 0.0, 1.0)
		var fullness_high = clampf(1.0 + SVListenCore.log2v(maxf(bed[2], 1e-9) / ref[1]) / 5.0, 0.0, 1.0)
		var now_density = 0.4 * fullness_mid + 0.6 * fullness_high
		density = now_density if kicking else SVListenCore.follow(density, 0.0, dt, 4.0)
		var lift = false
		if not kicking:
			section = "break"
			pending = ""
			near = 0.0
			far = 0.0
			return {"section": section, "density": density, "lift": lift}
		if section == "break":
			section = "peak" if dropped else "groove" if was_full else "intro"
			hold = 7.0 if dropped else 3.0
			near = now_density
			far = now_density
		near = SVListenCore.follow(near, now_density, dt, 2.0)
		far = SVListenCore.follow(far, now_density, dt, 10.0)
		if near - far > 0.1 and kick_for > 12 and lifted > 12:
			lift = true
			lifted = 0.0
		full_for = full_for + dt if now_density >= 0.7 else 0.0
		if full_for > 8: was_full = true
		hold -= dt
		var is_peak = now_density >= 0.85 + (-0.04 if section == "peak" else 0.04)
		var is_open = now_density >= 0.55 + (-0.04 if section in ["peak", "groove"] else 0.04)
		var want = "peak" if is_peak else "groove" if is_open else "low" if was_full else "intro"
		if want == section or hold > 0: pending = ""
		else:
			if pending != want:
				pending = want
				pending_for = 0.0
			pending_for += dt
			var rank = {"intro": 0, "low": 0, "groove": 1, "peak": 2}
			if pending_for > (2.0 if rank[want] > rank[section] else 5.0):
				section = want
				pending = ""
				hold = 6.0
		return {"section": section, "density": density, "lift": lift}

class Listener:
	const PAUSE_BEATS = 10.5
	const DROP_BEATS = 14.5
	var music = MusicResponse.new()
	var sections = SectionTracker.new()
	var tempo = TempoTracker.new()
	var s = {"density": 0.0, "break_at": 0.0, "riser": 0.0, "min_mid": INF, "min_high": INF, "activity": 1.0,
		"phase": "break", "out": false, "out_at": 0.0, "last_kick": -10.0, "bpm": 0.0, "kick_bpm": 0.0,
		"gaps": [], "has_grooved": false, "silent_for": 0.0, "section": "intro", "build": 0.0,
		"groove_at": 1e9, "lift_at": -100.0, "lift_armed": true}
	var kicks = 0
	var dropped = false
	var part = {"section": "intro", "density": 0.0, "lift": false}
	var kick_ref = 0.0
	var weak_run = 0
	var last_weak = -10.0
	var last_peak = 0.0
	var measuring = false
	var hit = {}
	var recent = []
	var grid = {}
	var kick_at = 0.0
	var hit_at = 0.0

	func new_track() -> void:
		tempo = TempoTracker.new()
		sections = SectionTracker.new()
		part = {"section": "intro", "density": 0.0, "lift": false}
		kicks = 0
		dropped = false
		kick_ref = 0.0
		weak_run = 0
		hit = {}
		recent = []
		grid = {}
		s.gaps.clear()
		s.has_grooved = false
		s.build = 0.0

	func lay_grid() -> void:
		var n: int = recent.size()
		grid = {}
		if n < 12: return
		var gaps = []
		for i: int in range(1, n): gaps.append(recent[i] - recent[i - 1])
		gaps.sort()
		var b0 = gaps[gaps.size() >> 1]
		var sk = 0.0
		var st = 0.0
		var skk = 0.0
		var skt = 0.0
		for i: int in n:
			var k = roundf((recent[i] - recent[0]) / b0)
			sk += k
			st += recent[i]
			skk += k * k
			skt += k * recent[i]
		var b = (n * skt - sk * st) / (n * skk - sk * sk)
		var a = (st - b * sk) / n
		if absf(b / b0 - 1) < 0.03: grid = {"a": a, "b": b}

	func kick_beat(usual: float) -> float:
		var first = recent.size() - 1
		while first > 0 and absf((recent[first] - recent[first - 1]) / usual - 1) < 0.12: first -= 1
		var n: int = recent.size() - first
		if n < 8: return 0.0
		var sk = 0.0
		var st = 0.0
		var skk = 0.0
		var skt = 0.0
		for i: int in range(first, recent.size()):
			var k = i - first
			sk += k
			st += recent[i]
			skk += k * k
			skt += k * recent[i]
		return (n * skt - sk * st) / (n * skk - sk * sk)

	func off_grid(t: float) -> float:
		if grid.is_empty(): return 0.5
		var k = (t - grid.a) / grid.b
		return absf(k - roundf(k))

	func heard_kick(a: Dictionary, t: float) -> String:
		var rise = a.bass_rise
		if measuring:
			last_peak = maxf(last_peak, rise)
			if t - kick_at > 0.05:
				measuring = false
				kick_ref = kick_ref + (last_peak - kick_ref) * (0.25 if last_peak > kick_ref else 0.03) if kick_ref else last_peak
		if a.kick: hit = {"at": t, "peak": 0.0, "since": t - s.last_kick, "before": last_peak}
		if hit.is_empty(): return ""
		hit.peak = maxf(hit.peak, rise)
		var beat = 60.0 / tempo.bpm if tempo.bpm and tempo.confidence > 0.4 else 0.0
		var away = s.out or s.phase == "break"
		var weak = away and kick_ref > 0 and (hit.peak < kick_ref * 0.5 or (not grid.is_empty() and hit.at - s.out_at < 30 and off_grid(hit.at) > 0.2))
		var between = not away and beat > 0 and hit.since < beat * 0.7 and hit.peak < hit.before * 1.5
		if (weak or between) and t - hit.at < 0.04: return ""
		var judged = hit
		hit = {}
		if between: return ""
		if weak:
			var gap = judged.at - last_weak
			var on_beat = absf(gap / beat - 1) < 0.2 if beat else gap > 0.26 and gap < 1.1
			weak_run = weak_run + 1 if on_beat else 1
			last_weak = judged.at
			if weak_run < 16: return ""
			kick_ref = judged.peak
		weak_run = 0
		measuring = true
		kick_at = judged.at
		last_peak = judged.peak
		hit_at = judged.at
		return "soft" if weak else "kick"

	func update(a: Dictionary, t: float, dt: float) -> Dictionary:
		var ev = {"kick": 0.0, "kick_gap": 0.0, "drop": false, "break_length": 0.0, "broke": false,
			"back": 0.0, "silent": false, "track_ended": false, "from": "", "lift": false}
		var beat_now = 60.0 / s.bpm if s.bpm else 0.5
		var break_after = beat_now * PAUSE_BEATS
		var drop_after = beat_now * DROP_BEATS
		var heard = heard_kick(a, t)
		var at = hit_at if heard != "" else t
		var since = at - s.last_kick
		if heard != "":
			if since > 0.26 and since < 1.1:
				s.gaps.append(since)
				if s.gaps.size() > 8: s.gaps.pop_front()
				var mid = s.gaps.duplicate()
				mid.sort()
				mid = mid.slice(s.gaps.size() >> 2, s.gaps.size() - (s.gaps.size() >> 2))
				if s.gaps.size() >= 3 and mid[-1] < mid[0] * 1.08:
					var sum: float = 0.0
					for v in mid: sum += v
					s.kick_bpm = roundf(60.0 * mid.size() / sum)
			if s.phase == "break":
				s.phase = "groove"
				s.groove_at = t
				if since > drop_after and s.has_grooved and heard == "kick":
					ev.drop = true
					ev.break_length = t - s.break_at
					dropped = true
					s.section = "peak"
					s.build = 0.0
			elif s.out:
				ev.back = since
				s.lift_armed = false
			s.out = false
			ev.kick = a.kick_strength
			ev.kick_gap = since
			kicks += 1
			if kicks >= 4: s.has_grooved = true
			s.last_kick = at
			recent.append(at)
			if recent.size() > 24: recent.pop_front()
			if since > 1.1: recent = [at]
		var sorted = s.gaps.duplicate()
		sorted.sort()
		var usual = sorted[sorted.size() >> 1] if sorted.size() >= 6 else 0.0
		var agreed = 0
		if usual:
			for g in s.gaps:
				if absf(g / usual - 1) < 0.06: agreed += 1
		var steady = 0.0
		if usual and agreed >= s.gaps.size() - 2:
			var length = kick_beat(usual)
			steady = 60.0 / (length if length else usual)
		tempo.update(dt, a.bass_onset, steady, s.out or s.phase == "break")
		s.bpm = roundf(tempo.bpm) if roundf(tempo.bpm) else s.kick_bpm
		var beat_length = 60.0 / s.bpm if s.bpm else 0.5
		if s.phase == "groove" and not s.out and t - s.last_kick > maxf(1.3, beat_length * 2.6):
			s.out = true
			s.out_at = t
			s.min_mid = INF
			s.min_high = INF
			lay_grid()
		if s.phase == "groove" and s.out and t - s.last_kick > break_after:
			s.phase = "break"
			s.break_at = s.out_at
			ev.broke = true
		s.silent_for = s.silent_for + dt if a.level < 0.03 else 0.0
		if s.silent_for > 2.5:
			ev.silent = true
			ev.track_ended = s.has_grooved
			s.has_grooved = false
			s.out = false
			s.build = 0.0
			kicks = 0
			kick_ref = 0.0
			weak_run = 0
			hit = {}
			recent = []
			grid = {}
			s.bpm = 0.0
			s.kick_bpm = 0.0
			s.gaps.clear()
			if tempo.bpm: tempo = TempoTracker.new()
			sections = SectionTracker.new()
		var brk = s.phase == "break"
		var paused = s.out and not brk
		if not paused: part = sections.update(dt, [a.raw_bass, a.raw_mid, a.raw_high], not brk, dropped)
		else: part.lift = false
		dropped = false
		s.density = part.density
		if part.section != s.section:
			ev.from = s.section
			s.section = part.section
		if part.lift and t - s.lift_at > 12: _lift(ev, t)
		if a.steady: s.lift_armed = true
		if not brk and not s.out and s.lift_armed and a.step > 1.4 and t - s.groove_at > 14 and t - s.lift_at > 12: _lift(ev, t)
		s.activity += (a.level - s.activity) * minf(1.0, dt * 8.0)
		if s.out and t - s.out_at > 2:
			s.min_mid = minf(s.min_mid, a.bed_mid)
			s.min_high = minf(s.min_high, a.bed_high)
		if not brk:
			s.build *= exp(-dt * 6.0)
			s.riser *= exp(-dt * 6.0)
		elif s.has_grooved and s.activity > 0.3:
			var elapsed = t - s.break_at
			var swell = maxf(SVListenCore.log2v(a.bed_high / s.min_high), SVListenCore.log2v(a.bed_mid / s.min_mid)) if elapsed > 2 else 0.0
			var riser = clampf(swell / 3.0, 0.0, 1.0)
			var target = minf(1.0, 0.35 * (1.0 - exp(-elapsed / 18.0)) + riser)
			s.build = SVListenCore.follow(s.build, target, dt, 1.0 if target > s.build else 8.0)
			s.riser = SVListenCore.follow(s.riser, riser, dt, 0.5 if riser > s.riser else 2.0)
		else:
			s.build *= exp(-dt * 2.0)
			s.riser *= exp(-dt * 2.0)
		return ev

	func _lift(ev: Dictionary, t: float) -> void:
		ev.lift = true
		s.lift_at = t
		s.lift_armed = false
