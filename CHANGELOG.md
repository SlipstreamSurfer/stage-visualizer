# Changelog

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
