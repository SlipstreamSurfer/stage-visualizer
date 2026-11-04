# Changelog

## 0.61.0-test4 — Every move on the beat

- Heads no longer turn, drift or circle on a clock of their own. Every head moves in steps on the beat: a step
  lands on the kick and holds until the next one. Each passage picks a motion: scissors (odd and even cross),
  a nod of the whole rig, a fan that opens and closes, a ladder that travels along and up, or a wave.
- Two beats a step, every beat in the second half of a peak; in a break a step a bar, growing with the build.
  A clap nods the rig a little. Gobos turn with the tempo.
- Beam rain is removed.
- More rhythm in the light, in every genre: besides the chases the lead can fill up beat by beat, pump with the
  kick, sparkle on the sixteenths, bounce between the edges and the middle, or split left and right. The supporting
  groups pump with the kick under it (not with gentle strobes).

## 0.61.0-test3 — Rings, dots and beam rain

- LED rings under the rear truss and on the back towers: a full circle that swells on every kick.
- A grid of dots on the far wall that flashes on the melody in quiet moments and breaks.
- Beam rain (Techno and Hard): the rear truss and the delay towers' beams each fall from 45° up to 45° down in
  about two and a half seconds, every beam on its own moment, and go back up in the dark. The hall steps back.

## 0.61.0-test2 — A generic club booth

- The players and the mixer are generic club gear in the familiar layout, without real brand or model names.
- Lit hot-cue pads in eight colours, a lit ring round each jog, lit channel cue buttons, a lit Beat FX screen.
- Headphones lie on the table beside the gear.
- The light sequencer no longer computes a lane gain that no light used.

## 0.61.0-test1 — Passages: one idea at a time

- The show plays in passages of 16 or 32 bars. Each passage has one spatial idea: one group leads it, others
  support it, the rest hold a quiet figure. A passage begins, develops and ends; it does not restart every few bars.
- Scenes, room compositions, single-colour blocks and bar figures change with the passage instead of on their own
  clocks. Raw / Deep / Hypnotic no longer changes look, movement, gate, colour spread and beam every eight bars.
- Five stage figures that read with the hall beams and the stage row off: crossing planes and a held asymmetric
  rake from the back towers, columns that slowly open and lean into the hall, and a diagonal cross and a widening
  fan from the roof spots. With the hall fader down, the stage carries every passage.
- Fewer whole-rig brightness steps with the strobes off: only the leading group pulses with the kick, holding
  groups keep their light, the stage no longer switches halves every two beats, and the foreground accent moves
  every four bars instead of every two beats. The screen dims while the stage leads.
- Episodes (lightning, depth chase, spatial sequence) only enter at the start of a passage. A depth chase starts as
  an aligned wave, develops two variants and returns to the wave.
- Repetition memory looks at figure, lean and roles; a colour change is not a new passage.
- Listening hears six parts of the track from the spectrum (kick, bass, body, lead, clap, hats): how loud each
  is, when it hits and when it comes in as a new layer. A new lead or body opens the figure, the bass widens it.
- Groove: the bars tick with the hats, and without part data the beat grid plays hats on the off-beat.
- Techno and Hard: the heads stand still. Each passage holds a position for a quarter of its length and moves only
  in the dark. The rhythm is in the light: the leading group plays a beat-locked chase (across, from the centre
  out, bottom to top, odd/even, ping-pong), quarters, and eighths late in a peak. The passage opens and closes
  with everything on.
- The roof spots weave instead of crossing on one line, and the support figures keep each beam in its own lane,
  so beams no longer pile up into one knot from the DJ's view.
- Depth chases and lightning come by more often in Raw / Deep / Hypnotic.
- `tools/measure_show.gd` measures a sixteen-minute generated set: changes per minute, changes at once, light
  jumps with the strobes off, stage-head level and quick returns.

## 0.60.0-test3 — Roof bars and upper back-tower spots

- Adds eight individually addressable LED bars along the stage roof, evenly placed between the existing washes.
- Adds one spot above the beam row on each of the eight mirrored back towers.
- Carries forward test2's individual bar-cell dimmers and colours, plus the balanced show and local debug feedback.

## 0.60.0-test2 — Independently programmed LED bars

- Every batten has twelve independently set dimmer and colour cells, still rendered in one batch.
- Phrase-held bar figures include solid, 50/50, odd/even, centre, end and travelling-window states.
- Alternating LED colours follow the active show palette; monochrome cues keep all cells in one colour.
- Carries forward the symmetric back towers, saved source continuity, calmer stage row and the test1 show design.
- New roof bars and a second head row on the back towers remain follow-up work.

## 0.60.0-test1 — Symmetric stage towers and show source continuity

- Back towers now use eight mirrored positions at an even 6 m spacing, centred around the LED screen.
- Launching with a saved audio device no longer silently changes the saved source to System + rekordbox.
- Carries forward the current candidate's calmer stage row, preserved light-desk levels, integrated scene accents,
  longer evolving depth chase, screen visuals and optional local debug feedback.

## Unreleased — Show balance, spatial patterns and debug feedback

- Authored light figures form the base show, with shuffled per-track figures and varied phrase durations.
  Sequencers are occasional episodes in one rig region, with long gaps between episodes. New figures include ceiling ribbons, diamond lattices, wings and mirrored orbits.
- Lightning accents the current scene without changing its colours or aims. Extended depth chases develop through
  aligned waves, staggered columns and echoes. Light rain has been removed.
- The spatial sequencer switches whole fixtures on and off in order. The stage row uses fewer simultaneous heads
  and lower output, and light-desk group levels are remembered between runs.
- Six screen scenes follow the actual show colours and dissolve between musical cues. Pixel chases add detail to
  the existing LED bars, while blackout and the master also control the screen and batten flashes.
- Gentle mode omits automatic strobes and rapid sequence episodes, with softer transitions and kick modulation.
- Optional debug feedback rates a recent 5/15/30/60-second window with F7/F8 and optional notes via F6.
  Diagnostic context is saved locally without audio or video.
- A model-independent choreography blueprint lives in `docs/choreography-blueprint.md`.

## 0.58.0 — Stage screen

- A central LED screen above the booth shows animated patterns in the show's colour, with quieter visuals during breaks.
- The screen can be switched on or off in Settings > Show. The central rear tower sits beside the screen.

## 0.57.1 — Techno heads

- Front-row heads no longer stay dark because of the fixed fixture selection; programmed chases still alternate them.
- Raw / Deep / Hypnotic Techno adds occasional eighth- and sixteenth-note stage patterns and single-colour blocks
  in blue, red, green, white or warm white. Gentle strobes keep the slower quarter-note patterns.
- Moving-head beams fall off a little more naturally with distance.

## 0.57.0 — Light that belongs to the room

- Reflected light follows the active heads and their aim, falling off across the hall. A single lamp contributes
  only a small amount to the room's overall glow. Crowd stage light also fades towards the back.
- The rekordbox connection shows whether beat and phrase data arrive, with a direct link to rkbx_link and clearer
  setup steps. The info screen shows the timing fallback when the connection drops.
- The README starts with the downloadable builds and platform opening instructions.

## 0.56.0 — A livelier crowd, a haze fader and a PA that faces the hall

- The crowd wears mixed clothes: mostly dark, with a rare white or neon shirt that catches the show's colour; hair from
  black through blond to grey, and a mix of builds. The stage's light gives hair and shoulders a soft edge in the
  show's colour, eased so a kick or a strobe does not flash the crowd, and off in a blackout. See [crowd](docs/crowd.md).
- Six ways to dance: jumpers, stompers, arm pumpers, groovers, hip swayers and watchers, wilder at the barrier and
  calmer at the back. Still one draw for up to 3,000 people.
- Light desk (**D**): a haze fader from 0 to 200 %. It scales how strongly the beams show and the existing fog; on
  Low and Light, which have no fog volume, the desk says "Beams only". See [beams](docs/beams.md).
- The PA hangs aim down into the hall and slightly inwards, with visible front grilles on the hangs and the subs.
  See [hall](docs/hall.md).
- Strobe (**Space**) and blinders (**N**) no longer stay on when the key or pad is released while a panel is open,
  the window loses focus, or the keyboard and a MIDI pad overlap.

## 0.55.2 — A light sequencer, richer techno shows and visual polish

- Techno (Raw / Deep / Hypnotic) has a light sequencer on the beat grid: blocks of 4, 8, 16 or 32 bars, patterns of
  16 steps per bar, a fill at the end of each block, and a new scene on the bar line. See [choreografie](docs/choreografie.md).
  Lighting direction for other genres is unchanged.
- More to look at in this genre: twenty-four head looks (six new) with their own movement, gate, colour spread and
  beam, sixteen palettes of three or four colours, and washes that swell instead of lighting the room all the time.
- Light desk (**D**): responsive group cards with large on / off switches, percentage faders and level restoration.
  **W** switches the washes at once. The settings last for the run.
- The info screen (**I**) shows the version, branch and commit.
- The delay towers are box trusses with a head bar, mounting rails, clamps, safety loops, outriggers and ballast detail.
- Flightcase edging, corner protection, handles and routed cables finish the booth; the decks stand closer to the DJ.
- Rounded crowd heads and shoulders, small ears and subtler skin shading keep the existing single-surface batching,
  phones and movement. No change to the crowd counts in the graphics presets.

## 0.55.1 — Rekordbox track changes

- Clear the previous track's phrase and countdown when a deck loads a different track or reports that phrase analysis
  is unavailable. Until a current phrase is available, the show uses a neutral groove without a predicted blackout.
- Keep phrase data on the other decks and retain valid builds and drops.

## 0.55.0 — Rekordbox from another computer, good on every computer

- Rekordbox can run on another computer: Settings → Rekordbox (or Source → Rekordbox connection…) shows the
  address SV listens on, writes the lines for rkbx_link's config to copy or save, shows live what arrives, and
  helps with the firewall on Linux, macOS and Windows. See [rekordbox](docs/rekordbox.md).
- A new Low preset for weak and built-in graphics: a quarter of the pixels and a smaller crowd, but the beams and
  the glow stay, because they are the show.
- The presets are rebuilt from what each effect costs (`--costs` measures it on your own computer): shadows and
  ambient occlusion are almost free and now start at Light and Normal. See [quality](docs/quality.md).
- Automatic starts at Low and steps up while the frames keep up with the screen.

## 0.54.0 — Downloads, built on GitHub

- Every change is tested on GitHub: Godot 4.7.2 (checked against its official checksums) runs all checks
  headless.
- Every release builds the app for Windows, macOS (Universal) and Linux with Godot's official export templates,
  tests it, and attaches the packages with their SHA-256 sums. See [builds](docs/builds.md) for how to open an
  unsigned app on macOS and Windows.
- README: pictures of the hangar, the booth and the drop as they are now.

## 0.53.0 — The hangar itself

- An industrial hangar around the show, after festival halls such as Drumsheds and the Gashouder and the steel of
  single-storey industrial buildings: nine steel roof girders on I-section columns, Z purlins under a closed
  profiled roof, end-bay wind bracing, ventilation trunks and cable trays. See [hall](docs/hall.md).
- Walls of cladding on a concrete plinth, closed windows, doors and exits with their green signs.
- Dark, real materials that only light up with the show: the roof and the columns read through the haze.
- No extra cost: Light 3.1 → 2.9 ms, Normal and High unchanged.

## 0.52.0 — A real crowd

- People instead of round figures: jaw, neck, shoulders, sleeves, hands, trousers and shoes, with height, build,
  hair and dark clothing varying per person. Mostly silhouettes against the light, with rim light on the lit side.
- Moving to the music: nods and knee dips on the beat, jumps and raised arms with the energy and the hype, each
  person in their own time; one in thirteen lifts a phone in a break. See [crowd](docs/crowd.md).
- A concrete floor, with a thin wet sheen on High and Ultra in which the beams and washes reflect.
- Lighter on the GPU: a person is 686 triangles instead of 1,920 (Normal 6.7 → 5.4 ms, High 13.3 → 10.6 ms).

## 0.51.0 — Wider beams, real haze

- Beams, spots and washes take the zoom of real fixtures (Robe MegaPointe, BMFL, Martin MAC Aura XB): beams were
  as thin as a Sharpy; now about 3.5–10° with the show's zoom. See [beams](docs/beams.md).
- A beam shows as in haze: a bright core with a scattered halo, as bright along its length as its light is dense,
  glowing more when it is aimed towards you. Lenses flare.
- The room takes the show's light: the haze glows in the show's colour and lifts on a kick, capped so a drop does
  not turn on the house lights. A strobe flash in the hall is white, not flat grey.
- Steady picture: it measured against the screen instead of the frame limit, and kept lowering the scale when that
  did not help (on Ultra down to 40 %). It now only lowers the scale when frames get faster.

## 0.50.0 — SV in Godot

Stage Visualizer moves from the browser to Godot 4.7 and runs as an app on Windows, macOS and Linux.

- The Hangar rebuilt: one hall, a full-width stage, five hall trusses in a V on chain hoists, a rear truss,
  towers behind the DJ, delay and side towers; 182 moving heads, strobe battens, blinders, haze and a crowd.
- The browser's lighting director, ported: a mood for each of Beatport's 36 electronic genres, one palette per
  track, programs and scenes held for a phrase, 25 head looks, 15 truss formations, 9 looks for the stage row.
- Listening ported from the browser (same events on the same recordings); rekordbox through rkbx_link with deck
  following, phrases and a drop on the Chorus.
- The DJ booth: two CDJ-3000X players and a DJM-A9 at true scale, with live deck screens (or four players with
  `--booth=festival`).
- The app: first-run setup, start screen, pause menu, help, a show bar, five cameras, display choice, the DJ's own
  buttons (blackout, strobe, blinders, next look) and a DJ controller over MIDI.
- Sessions: record and replay a show frame by frame, with automatic checks.

The browser version's history and changes up to 0.40.1 stay in this repository's history and tags.
