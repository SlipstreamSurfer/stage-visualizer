class_name ShowGenres
extends ShowBase
# Genres: Beatport's 36 electronic genres in families, their colours and character.


# Genres: Beatport's electronic genres, each played the way a lighting designer would play it. A genre belongs to a
# family that brings scenes for some parts of the track (the rest come from SCENES), and has its own colours, how fast
# things move (pace), how hard the kick hits the rig (hit), how much strobe (0: the drop only, 1: as techno, 2: everywhere),
# how strong the washes are, how white a drop goes, how many hands go up and how dark the room is (dark).
const FAMILIES := {
	"techno": {
		"intro": [
			{"back": ["up", 0.5]}, {"hall": ["", 0.45]}, {"batten": ["glow", 0.5], "hall": ["", 0.2]},
		],
		"groove": [
			{"front": ["cross", 1.0]}, {"hall": ["", 1.0]}, {"side": ["across", 1.0]},
			{"back": ["up", 1.0]}, {"rear": ["over", 1.0]}, {"batten": ["kick", 1.0], "back": ["up", 0.2]},
			{"hall": ["", 1.0], "spot": ["walls", 0.2]}, {"delay": ["cross", 1.0]},
		],
		"build": [
			{"front": ["parallel", 1.0], "batten": ["chase", 0.25]},
			{"back": ["up", 1.0]}, {"hall": ["", 1.0], "batten": ["kick", 0.2]},
		],
		"break": [
			{"spot": ["walls", 0.45]}, {"back": ["up", 0.45]}, {"hall": ["", 0.4]},
			{"batten": ["glow", 0.5]}, {"wash": ["fill", 0.35]},
		],
		"peak": [
			{"front": ["fan", 1.0], "back": ["cross", 1.0], "hall": ["", 0.5], "batten": ["kick", 0.5]},
			{"hall": ["", 1.0]}, {"front": ["cross", 1.0]}, {"back": ["over", 1.0], "batten": ["kick", 0.2]},
			{"side": ["across", 1.0], "delay": ["up", 0.25]}, {"rear": ["over", 1.0]},
			{"batten": ["kick", 1.0], "side": ["up", 0.25]}, {"front": ["fan", 1.0], "back": ["up", 0.25]},
			{"hall": ["", 1.0], "spot": ["sky", 0.2]}, {"delay": ["cross", 1.0]},
		],
	},
	"house": {
		"groove": [
			{"wash": ["split", 1.0], "front": ["vee", 0.6], "spot": ["carpet", 0.6], "batten": ["glow", 0.6]},
			{"hall": ["", 0.7], "wash": ["fill", 0.9], "batten": ["wave", 0.6]},
			{"side": ["across", 0.7], "wash": ["pulse", 0.8], "spot": ["sweep", 0.6], "batten": ["glow", 0.5]},
		],
		"peak": [
			{"hall": ["", 0.9], "front": ["fan", 0.9], "wash": ["pulse", 1.0], "rear": ["stage", 0.5], "batten": ["kick", 0.8]},
			{"wash": ["split", 1.0], "back": ["over", 0.8], "spot": ["carpet", 0.7], "front": ["crowd", 0.6], "batten": ["wave", 0.8]},
		],
	},
	"melodic": {
		"groove": [
			{"hall": ["", 0.8], "spot": ["carpet", 0.8], "wash": ["fill", 0.7]},
			{"back": ["over", 0.8], "spot": ["walls", 0.7], "wash": ["fill", 0.6], "batten": ["glow", 0.3]},
			{"side": ["across", 0.8], "spot": ["sweep", 0.6], "wash": ["split", 0.6]},
		],
		"peak": [
			{"hall": ["", 1.0], "back": ["over", 0.9], "front": ["fan", 0.8], "spot": ["carpet", 0.6], "wash": ["fill", 0.6], "batten": ["wave", 0.5]},
			{"front": ["wave", 0.9], "side": ["across", 0.8], "spot": ["sweep", 0.7], "wash": ["split", 0.7]},
		],
	},
	"trance": {
		"peak": [
			{"hall": ["", 1.0], "front": ["fan", 1.0], "back": ["over", 1.0], "rear": ["stage", 0.8], "side": ["across", 0.7], "delay": ["cross", 0.7], "spot": ["carpet", 0.5], "wash": ["pulse", 0.7], "batten": ["kick", 1.0]},
			{"front": ["fan", 1.0], "back": ["converge", 1.0], "rear": ["over", 0.8], "hall": ["", 0.7], "wash": ["split", 0.5], "batten": ["chase", 0.8]},
			{"hall": ["", 1.0], "side": ["up", 0.9], "delay": ["up", 0.9], "front": ["parallel", 0.8], "batten": ["wave", 0.8]},
		],
	},
	"hard": {
		"groove": [
			{"hall": ["", 1.0], "front": ["crowd", 0.8], "batten": ["kick", 1.0]},
			{"back": ["sweep", 1.0], "side": ["across", 0.8], "batten": ["chase", 1.0]},
		],
		"peak": [
			{"hall": ["", 1.0], "front": ["cross", 1.0], "back": ["sweep", 1.0], "rear": ["stage", 1.0], "side": ["across", 1.0], "delay": ["cross", 1.0], "batten": ["kick", 1.0], "wash": ["pulse", 0.5]},
			{"front": ["crowd", 1.0], "back": ["crowd", 1.0], "rear": ["crowd", 0.9], "hall": ["", 0.8], "batten": ["chase", 1.0]},
		],
	},
	"bass": {
		"groove": [
			{"front": ["crowd", 0.8], "hall": ["", 0.6], "batten": ["kick", 0.8]},
			{"side": ["across", 0.9], "back": ["sweep", 0.7], "batten": ["glow", 0.5]},
		],
		"peak": [
			{"hall": ["", 1.0], "front": ["cross", 1.0], "back": ["sweep", 1.0], "rear": ["stage", 0.8], "batten": ["kick", 1.0], "wash": ["pulse", 0.6]},
			{"front": ["wave", 1.0], "side": ["across", 1.0], "delay": ["cross", 1.0], "batten": ["chase", 1.0]},
		],
	},
	"chill": {
		"intro": [{"wash": ["fill", 0.8], "spot": ["carpet", 0.35]}],
		"groove": [
			{"wash": ["fill", 1.0], "spot": ["carpet", 0.45]},
			{"wash": ["split", 0.9], "spot": ["walls", 0.4], "hall": ["", 0.25]},
		],
		"build": [{"wash": ["fill", 0.9], "spot": ["carpet", 0.5], "back": ["up", 0.3]}],
		"peak": [
			{"wash": ["fill", 1.0], "spot": ["carpet", 0.5], "back": ["up", 0.3], "hall": ["", 0.3]},
			{"wash": ["split", 1.0], "spot": ["walls", 0.5], "front": ["parallel", 0.3]},
		],
	},
}

const GENRES := {
	"140-deep-dubstep-grime": {"name": "140 / Deep Dubstep / Grime", "family": "bass", "pace": 0.7, "hit": 0.4, "strobe": 1.0, "wash": 0.7, "white": 0.7, "hands": 0.8, "dark": 0.9,
		"palettes": [[Color(1.0, 1.0, 1.0), Color(0.15, 0.3, 1.0)], [Color(0.8, 0.02, 0.05), Color(1.0, 1.0, 1.0)], [Color(0.4, 0.1, 1.0), Color(0.0, 0.7, 0.6)]]},
	"afro-house": {"name": "Afro House", "family": "house", "pace": 0.85, "hit": 0.25, "strobe": 0.0, "wash": 1.5, "white": 0.4, "hands": 0.9, "dark": 1.0,
		"palettes": [[Color(1.0, 0.55, 0.08), Color(0.2, 0.8, 0.25)], [Color(1.0, 0.35, 0.05), Color(0.9, 0.08, 0.05)], [Color(1.0, 0.8, 0.15), Color(0.0, 0.6, 0.6)]]},
	"amapiano": {"name": "Amapiano", "family": "house", "pace": 0.8, "hit": 0.3, "strobe": 0.0, "wash": 1.6, "white": 0.4, "hands": 1.0, "dark": 1.0,
		"palettes": [[Color(1.0, 0.75, 0.15), Color(0.5, 0.1, 1.0)], [Color(1.0, 0.45, 0.08), Color(0.0, 0.7, 0.7)], [Color(1.0, 0.9, 0.75), Color(1.0, 0.15, 0.6)]]},
	"ambient-experimental": {"name": "Ambient / Experimental", "family": "chill", "pace": 0.45, "hit": 0.0, "strobe": 0.0, "wash": 1.4, "white": 0.2, "hands": 0.3, "dark": 0.8,
		"palettes": [[Color(0.05, 0.2, 0.8), Color(0.0, 0.6, 0.6)], [Color(1.0, 0.85, 0.65), Color(1.0, 0.5, 0.15)], [Color(0.35, 0.1, 0.8), Color(0.8, 0.85, 1.0)]]},
	"bass-club": {"name": "Bass / Club", "family": "bass", "pace": 1.0, "hit": 0.4, "strobe": 1.2, "wash": 0.8, "white": 0.8, "hands": 1.0, "dark": 1.0,
		"palettes": [[Color(1.0, 0.05, 0.1), Color(0.1, 0.3, 1.0)], [Color(1.0, 0.1, 0.7), Color(1.0, 1.0, 1.0)], [Color(0.0, 0.9, 0.8), Color(0.6, 0.1, 1.0)]]},
	"bass-house": {"name": "Bass House", "family": "house", "pace": 1.05, "hit": 0.35, "strobe": 0.8, "wash": 1.0, "white": 0.7, "hands": 1.0, "dark": 1.0,
		"palettes": [[Color(0.2, 1.0, 0.25), Color(0.6, 0.1, 1.0)], [Color(0.0, 0.85, 1.0), Color(1.0, 0.1, 0.7)], [Color(1.0, 0.05, 0.05), Color(1.0, 1.0, 1.0)]]},
	"brazilian-funk": {"name": "Brazilian Funk", "family": "house", "pace": 1.0, "hit": 0.4, "strobe": 0.6, "wash": 1.3, "white": 0.6, "hands": 1.0, "dark": 1.0,
		"palettes": [[Color(0.1, 0.9, 0.25), Color(1.0, 0.85, 0.05)], [Color(1.0, 0.1, 0.6), Color(1.0, 0.5, 0.05)]]},
	"breaks-breakbeat-uk-bass": {"name": "Breaks / Breakbeat / UK Bass", "family": "bass", "pace": 0.95, "hit": 0.35, "strobe": 1.0, "wash": 0.9, "white": 0.8, "hands": 1.0, "dark": 1.0,
		"palettes": [[Color(1.0, 0.45, 0.05), Color(0.1, 0.35, 1.0)], [Color(0.2, 1.0, 0.3), Color(1.0, 1.0, 1.0)], [Color(1.0, 0.1, 0.4), Color(0.0, 0.8, 1.0)]]},
	"dance-pop": {"name": "Dance / Pop", "family": "trance", "pace": 1.0, "hit": 0.2, "strobe": 0.6, "wash": 1.3, "white": 0.7, "hands": 1.2, "dark": 1.0,
		"palettes": [[Color(1.0, 0.2, 0.7), Color(0.0, 0.85, 1.0)], [Color(0.15, 0.3, 1.0), Color(1.0, 0.85, 0.1)], [Color(0.6, 0.15, 1.0), Color(1.0, 1.0, 1.0)]]},
	"deep-house": {"name": "Deep House", "family": "house", "pace": 0.75, "hit": 0.2, "strobe": 0.0, "wash": 1.6, "white": 0.3, "hands": 0.8, "dark": 0.9,
		"palettes": [[Color(0.1, 0.2, 0.9), Color(1.0, 0.55, 0.15)], [Color(0.45, 0.1, 0.9), Color(0.0, 0.65, 0.65)], [Color(0.8, 0.1, 0.15), Color(0.15, 0.35, 1.0)]]},
	"dj-tools": {"name": "DJ Tools", "family": "techno", "pace": 1.0, "hit": 0.15, "strobe": 1.0, "wash": 1.0, "white": 1.0, "hands": 1.0, "dark": 1.0,
		"palettes": [[Color(1.0, 1.0, 1.0), Color(0.15, 0.35, 1.0)], [Color(1.0, 0.5, 0.08), Color(1.0, 1.0, 1.0)]]},
	"downtempo": {"name": "Downtempo", "family": "chill", "pace": 0.5, "hit": 0.05, "strobe": 0.0, "wash": 1.4, "white": 0.3, "hands": 0.4, "dark": 0.85,
		"palettes": [[Color(1.0, 0.55, 0.1), Color(0.45, 0.1, 0.8)], [Color(0.0, 0.6, 0.6), Color(1.0, 0.8, 0.55)], [Color(0.8, 0.15, 0.2), Color(0.1, 0.25, 0.8)]]},
	"drum-and-bass": {"name": "Drum & Bass", "family": "bass", "pace": 0.6, "hit": 0.4, "strobe": 1.5, "wash": 0.8, "white": 0.8, "hands": 1.1, "dark": 1.0,
		"palettes": [[Color(0.2, 1.0, 0.3), Color(1.0, 1.0, 1.0)], [Color(0.0, 0.85, 1.0), Color(0.6, 0.1, 1.0)], [Color(1.0, 0.05, 0.05), Color(1.0, 1.0, 1.0)]]},
	"dubstep": {"name": "Dubstep", "family": "bass", "pace": 0.7, "hit": 0.5, "strobe": 1.5, "wash": 0.7, "white": 0.8, "hands": 1.0, "dark": 1.0,
		"palettes": [[Color(0.3, 1.0, 0.1), Color(0.6, 0.05, 1.0)], [Color(1.0, 0.05, 0.05), Color(1.0, 1.0, 1.0)], [Color(0.0, 0.8, 1.0), Color(1.0, 0.1, 0.6)]]},
	"electro": {"name": "Electro (Classic / Detroit / Modern)", "family": "techno", "pace": 1.0, "hit": 0.25, "strobe": 0.8, "wash": 0.9, "white": 0.8, "hands": 0.9, "dark": 0.95,
		"palettes": [[Color(0.0, 0.85, 1.0), Color(1.0, 0.08, 0.1)], [Color(1.0, 1.0, 1.0), Color(0.15, 0.3, 1.0)], [Color(0.6, 0.1, 1.0), Color(0.0, 1.0, 0.6)]]},
	"electronica": {"name": "Electronica", "family": "melodic", "pace": 0.75, "hit": 0.1, "strobe": 0.0, "wash": 1.2, "white": 0.5, "hands": 0.8, "dark": 0.95,
		"palettes": [[Color(0.0, 0.7, 0.7), Color(1.0, 0.5, 0.1)], [Color(0.5, 0.15, 1.0), Color(1.0, 1.0, 1.0)], [Color(0.15, 0.35, 1.0), Color(1.0, 0.75, 0.4)]]},
	"funky-house": {"name": "Funky House", "family": "house", "pace": 0.9, "hit": 0.3, "strobe": 0.0, "wash": 1.5, "white": 0.5, "hands": 1.0, "dark": 1.0,
		"palettes": [[Color(1.0, 0.75, 0.1), Color(1.0, 0.15, 0.6)], [Color(1.0, 0.45, 0.05), Color(0.0, 0.8, 1.0)], [Color(1.0, 0.2, 0.7), Color(1.0, 0.9, 0.2)]]},
	"hard-dance-hardcore-neo-rave": {"name": "Hard Dance / Hardcore / Neo Rave", "family": "hard", "pace": 1.5, "hit": 0.5, "strobe": 2.0, "wash": 0.6, "white": 1.0, "hands": 1.2, "dark": 1.0,
		"palettes": [[Color(1.0, 0.03, 0.02), Color(1.0, 1.0, 1.0)], [Color(0.0, 0.85, 1.0), Color(1.0, 1.0, 1.0)], [Color(1.0, 0.1, 0.8), Color(1.0, 1.0, 1.0)]]},
	"hard-techno": {"name": "Hard Techno", "family": "hard", "pace": 1.4, "hit": 0.45, "strobe": 2.0, "wash": 0.6, "white": 1.0, "hands": 1.1, "dark": 1.0,
		"palettes": [[Color(1.0, 0.03, 0.02), Color(1.0, 1.0, 1.0)], [Color(1.0, 1.0, 1.0), Color(1.0, 0.03, 0.02)], [Color(1.0, 0.35, 0.0), Color(1.0, 1.0, 1.0)]]},
	"house": {"name": "House", "family": "house", "pace": 0.85, "hit": 0.25, "strobe": 0.0, "wash": 1.5, "white": 0.4, "hands": 0.9, "dark": 1.0,
		"palettes": [[Color(1.0, 0.15, 0.6), Color(1.0, 0.6, 0.1)], [Color(0.2, 0.25, 1.0), Color(1.0, 0.3, 0.6)], [Color(1.0, 0.45, 0.1), Color(0.1, 0.85, 1.0)], [Color(0.6, 0.15, 1.0), Color(1.0, 0.8, 0.3)]]},
	"indie-dance": {"name": "Indie Dance", "family": "house", "pace": 0.85, "hit": 0.25, "strobe": 0.3, "wash": 1.3, "white": 0.5, "hands": 0.9, "dark": 0.95,
		"palettes": [[Color(1.0, 0.1, 0.6), Color(0.2, 1.0, 0.4)], [Color(1.0, 0.08, 0.08), Color(0.0, 0.85, 1.0)], [Color(0.55, 0.1, 1.0), Color(1.0, 0.5, 0.05)]]},
	"jackin-house": {"name": "Jackin House", "family": "house", "pace": 0.95, "hit": 0.35, "strobe": 0.3, "wash": 1.4, "white": 0.5, "hands": 1.0, "dark": 1.0,
		"palettes": [[Color(1.0, 0.2, 0.7), Color(1.0, 0.9, 0.15)], [Color(0.0, 0.85, 1.0), Color(1.0, 0.45, 0.05)]]},
	"mainstage": {"name": "Mainstage", "family": "trance", "pace": 1.15, "hit": 0.25, "strobe": 1.5, "wash": 1.0, "white": 1.0, "hands": 1.4, "dark": 1.0,
		"palettes": [[Color(1.0, 1.0, 1.0), Color(0.15, 0.35, 1.0)], [Color(1.0, 0.05, 0.05), Color(1.0, 1.0, 1.0)], [Color(0.0, 0.85, 1.0), Color(1.0, 0.1, 0.7)], [Color(1.0, 0.75, 0.2), Color(1.0, 1.0, 1.0)]]},
	"melodic-house-techno": {"name": "Melodic House & Techno", "family": "melodic", "pace": 0.65, "hit": 0.05, "strobe": 0.0, "wash": 1.3, "white": 0.5, "hands": 0.8, "dark": 0.9,
		"palettes": [[Color(0.05, 0.25, 1.0), Color(0.0, 0.8, 0.75)], [Color(0.5, 0.1, 1.0), Color(0.9, 0.9, 1.0)], [Color(1.0, 0.45, 0.05), Color(0.7, 0.05, 0.1)], [Color(0.0, 0.5, 0.6), Color(1.0, 0.85, 0.6)]]},
	"minimal-deep-tech": {"name": "Minimal / Deep Tech", "family": "techno", "pace": 0.8, "hit": 0.25, "strobe": 0.3, "wash": 1.0, "white": 0.6, "hands": 0.8, "dark": 0.85,
		"palettes": [[Color(1.0, 0.55, 0.15), Color(1.0, 1.0, 1.0)], [Color(0.1, 0.2, 0.9), Color(0.0, 0.6, 0.6)], [Color(1.0, 0.9, 0.75), Color(0.8, 0.1, 0.15)]]},
	"nu-disco-disco": {"name": "Nu Disco / Disco", "family": "house", "pace": 0.85, "hit": 0.25, "strobe": 0.0, "wash": 1.6, "white": 0.4, "hands": 1.0, "dark": 1.0,
		"palettes": [[Color(1.0, 0.25, 0.65), Color(1.0, 0.75, 0.15)], [Color(0.0, 0.85, 1.0), Color(1.0, 0.15, 0.7)], [Color(1.0, 0.5, 0.05), Color(0.55, 0.1, 1.0)]]},
	"organic-house": {"name": "Organic House", "family": "melodic", "pace": 0.65, "hit": 0.1, "strobe": 0.0, "wash": 1.5, "white": 0.3, "hands": 0.7, "dark": 0.9,
		"palettes": [[Color(1.0, 0.6, 0.15), Color(0.3, 0.75, 0.25)], [Color(1.0, 0.85, 0.65), Color(0.8, 0.3, 0.1)], [Color(0.0, 0.6, 0.6), Color(1.0, 0.6, 0.2)]]},
	"progressive-house": {"name": "Progressive House", "family": "melodic", "pace": 0.8, "hit": 0.15, "strobe": 0.5, "wash": 1.1, "white": 0.8, "hands": 1.0, "dark": 1.0,
		"palettes": [[Color(0.15, 0.35, 1.0), Color(1.0, 1.0, 1.0)], [Color(1.0, 0.1, 0.7), Color(0.1, 0.3, 1.0)], [Color(0.0, 0.7, 0.7), Color(0.55, 0.1, 1.0)]]},
	"psy-trance": {"name": "Psy-Trance", "family": "trance", "pace": 1.2, "hit": 0.3, "strobe": 1.0, "wash": 1.0, "white": 0.8, "hands": 1.1, "dark": 1.0,
		"palettes": [[Color(0.5, 0.0, 1.0), Color(0.2, 1.0, 0.1)], [Color(1.0, 0.45, 0.0), Color(0.6, 0.0, 1.0)], [Color(0.0, 0.9, 1.0), Color(1.0, 0.0, 0.7)]]},
	"tech-house": {"name": "Tech House", "family": "house", "pace": 0.95, "hit": 0.3, "strobe": 0.4, "wash": 1.1, "white": 0.6, "hands": 1.0, "dark": 1.0,
		"palettes": [[Color(0.0, 0.85, 1.0), Color(1.0, 0.1, 0.7)], [Color(1.0, 1.0, 1.0), Color(1.0, 0.45, 0.05)], [Color(0.2, 1.0, 0.3), Color(1.0, 1.0, 1.0)]]},
	"techno-peak-time-driving": {"name": "Techno (Peak Time / Driving)", "family": "techno", "pace": 1.0, "hit": 0.15, "strobe": 1.0, "wash": 1.0, "white": 1.0, "hands": 1.0, "dark": 1.0,
		"palettes": [[Color(1.0, 1.0, 1.0), Color(0.15, 0.35, 1.0)], [Color(1.0, 0.06, 0.04), Color(1.0, 0.95, 0.9)], [Color(1.0, 0.5, 0.08), Color(1.0, 0.95, 0.85)], [Color(0.05, 0.6, 1.0), Color(1.0, 1.0, 1.0)]]},
	"techno-raw-deep-hypnotic": {"name": "Techno (Raw / Deep / Hypnotic)", "family": "techno", "pace": 0.85, "hit": 0.2, "strobe": 0.5, "wash": 0.8, "white": 0.7, "hands": 0.8, "dark": 0.8,
		"palettes": [[Color(0.8, 0.05, 0.05), Color(1.0, 0.45, 0.08)], [Color(1.0, 1.0, 1.0), Color(0.08, 0.15, 0.8)], [Color(0.45, 0.0, 1.0), Color(1.0, 1.0, 1.0)]]},
	"trance-main-floor": {"name": "Trance (Main Floor)", "family": "trance", "pace": 1.1, "hit": 0.15, "strobe": 1.5, "wash": 1.0, "white": 1.0, "hands": 1.3, "dark": 1.0,
		"palettes": [[Color(0.0, 0.85, 1.0), Color(1.0, 1.0, 1.0)], [Color(0.9, 0.1, 1.0), Color(0.1, 0.4, 1.0)], [Color(0.15, 0.3, 1.0), Color(1.0, 1.0, 1.0)], [Color(1.0, 0.1, 0.5), Color(0.0, 0.9, 1.0)]]},
	"trance-raw-deep-hypnotic": {"name": "Trance (Raw / Deep / Hypnotic)", "family": "melodic", "pace": 0.9, "hit": 0.2, "strobe": 0.8, "wash": 1.0, "white": 0.7, "hands": 1.0, "dark": 0.85,
		"palettes": [[Color(0.1, 0.15, 0.9), Color(0.5, 0.05, 1.0)], [Color(1.0, 1.0, 1.0), Color(0.0, 0.6, 0.6)], [Color(0.7, 0.05, 0.2), Color(0.15, 0.2, 0.9)]]},
	"trap-future-bass": {"name": "Trap / Future Bass", "family": "bass", "pace": 0.8, "hit": 0.45, "strobe": 1.2, "wash": 1.1, "white": 0.8, "hands": 1.1, "dark": 1.0,
		"palettes": [[Color(1.0, 0.25, 0.7), Color(0.0, 0.85, 1.0)], [Color(0.6, 0.15, 1.0), Color(1.0, 0.85, 0.15)], [Color(1.0, 0.5, 0.4), Color(0.4, 0.2, 1.0)]]},
	"uk-garage-bassline": {"name": "UK Garage / Bassline", "family": "house", "pace": 0.95, "hit": 0.35, "strobe": 0.5, "wash": 1.2, "white": 0.6, "hands": 1.0, "dark": 1.0,
		"palettes": [[Color(0.55, 0.1, 1.0), Color(0.15, 0.35, 1.0)], [Color(1.0, 0.2, 0.7), Color(1.0, 1.0, 1.0)], [Color(0.2, 1.0, 0.35), Color(0.1, 0.3, 1.0)]]},
}

const GENRE_ORDER := ["auto", "140-deep-dubstep-grime", "afro-house", "amapiano", "ambient-experimental", "bass-club", "bass-house", "brazilian-funk", "breaks-breakbeat-uk-bass", "dance-pop", "deep-house", "dj-tools", "downtempo", "drum-and-bass", "dubstep", "electro", "electronica", "funky-house", "hard-dance-hardcore-neo-rave", "hard-techno", "house", "indie-dance", "jackin-house", "mainstage", "melodic-house-techno", "minimal-deep-tech", "nu-disco-disco", "organic-house", "progressive-house", "psy-trance", "tech-house", "techno-peak-time-driving", "techno-raw-deep-hypnotic", "trance-main-floor", "trance-raw-deep-hypnotic", "trap-future-bass", "uk-garage-bassline"]

func _palette_for(t: String) -> Array:
	var pool: Array = _g().palettes
	return pool[absi(hash(t)) % pool.size()]

# The genre now: chosen, or by the tempo when it is "auto".
func _g() -> Dictionary:
	if GENRES.has(genre): return GENRES[genre]
	if bpm > 160.0: return GENRES["drum-and-bass"]
	if bpm > 145.0: return GENRES["hard-dance-hardcore-neo-rave"]
	return GENRES["techno-peak-time-driving"]

func restrained() -> bool:
	return _g().family == "techno" or genre == "hard-techno"

func drop_open_beats() -> float:
	return 4.0 if restrained() else 8.0

# The genre playing now, for the screen: by its name, or "Auto: <the genre the tempo chose>".
func genre_now() -> String:
	return ("Auto: " if genre == "auto" else "") + str(_g().name)

# The name of a genre as Beatport writes it, for the settings screen.
static func genre_name(id: String) -> String:
	return "Automatic (by tempo)" if id == "auto" else GENRES.get(id, {}).get("name", id)
