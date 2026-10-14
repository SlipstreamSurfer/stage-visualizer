# Hangar expansion plan

This plan covers the public Hangar product as of 0.26.5. It distinguishes
released features and proposed work. Priority
and effort below are design estimates, not measured implementation times.

## Current starting point

Hangar already has moving heads and trusses, LED bars and arches, an LED wall,
gobos, lasers, haze, CO2, sparks and flames. The crowd dances, raises hands,
jumps and films. Automatic cameras, manual camera selection, look controls,
light switches and saved/exported show presets already exist. A single local
wall picture or video can already be loaded.

Three coordinated themes were released in 0.26.3: **Industrial**, **Hypnotic**
and **Melodic**. They add wall image families, theme colours, arch patterns and
laser choices, with gradual transitions and preset storage. They preserve the
existing moving-head directions, scene cues, truss targets and audio connection.
See [theme controls](hangar-themes.md). They are included with light choreography in 0.26.3.
A short musical comparison is still needed; automated checks are not musical approval.

The public show uses audio analysis. OSC diagnostics display external data but
do not drive the public show. A detected audio break/drop is not a verified
Rekordbox phrase boundary. Track identity is available for a selected local
audio file; an audio input alone does not supply reliable track identity.

## Delivery order

| Step | Work | Visible result | Relative effort |
| --- | --- | --- | --- |
| 0 | Review the three themes with music; technical release checks have passed | A tested, reviewable base for the next release | Investigation |
| 1 | Released in 0.26.5: musical VJ variants within each theme | Break, build and peak feel different while keeping the same visual identity | Medium |
| 2 | Released in 0.26.3: composed light-group responses | Stage heads, hall heads and arches answer one another instead of changing together every time | Medium |
| 3 | Released in 0.26.5: camera choreography tied to the chosen light composition | A strong light picture remains readable; cuts reveal the next composition | Medium |
| 4 | Crowd zones and subtle DJ reactions | Different parts of the room respond with different enthusiasm and delays | Medium–large |
| 5 | Clip bank and compact scene buttons | More direct creative control without repeatedly opening file dialogs or presets | Medium–large |

Step 0 includes a short comparison of each theme with the same camera and look,
using a break, build and peak from music. Run the fast suite and the single Hangar browser check before publication,
as described in [release instructions](releases.md). The native Mac GPU is
used for the Hangar WebGL check; software rendering remains explicitly selectable.

## Recommended first feature: musical VJ variants

Keep the three image families and develop each through the existing audio
states. Change density, opening, contrast and motion within a family instead
of replacing the whole image at every scene.

| Theme | Quiet / break | Build | Peak |
| --- | --- | --- | --- |
| Industrial | Sparse frames with dark gaps | A scan gradually fills more of the wall | Several clear frame groups with controlled kick accents |
| Hypnotic | Broad, slow concentric waves | Rings narrow and gather towards the centre | Layered waves spread across the wall, retaining slow motion |
| Melodic | One soft ribbon | Ribbons open and warm accents emerge | A fuller ribbon composition without turning into rapid flashes |

Use the existing audio-derived section, build and beat clocks. Do not add a
second scene timer or claim exact external phrase timing. At first, hold the
selected family for the listening session. A future per-track preference can
use known local-file identity; do not infer track identity from live input.

The first change is complete when:

- Quiet, build and peak treatments are recognisably different within each theme.
- Returning from a build or changing theme keeps transitions continuous.
- Choosing a theme or its treatment preserves playback and live input.
- Manual palettes, wall media, switches and blackout retain priority.
- Head directions, truss targets and camera behaviour remain unchanged in this step.
- The fast suite, single Hangar browser check and short musical comparison pass.

## Light and camera development

For step 2, start with three compositions using the existing rig: a stage-led
opening, a wave through the hall banks, and a held light picture with arch
accents. Select a composition at an existing musical cue and keep it stable
between cues. Add recent-choice memory to avoid repeating the same composition.
The original automatic behaviour should remain selectable.

Step 3 was released in 0.26.5 and can be switched off with **Automatic camera follows the light choreography**.
Reuse the existing cameras and manual freeze control. Automatic
drop cuts and section-dependent shots already exist; the addition is to choose
a shot that shows the selected light composition and allow a longer hold when
it is still developing. Manual views must retain control. Do not change camera
and light selection in the same initial implementation: review each separately.

## Later options

| Area | Candidate | Difference from existing functionality |
| --- | --- | --- |
| VJ control | A small local clip playlist with fades | Extends the current single picture/video selection |
| Live control | A few scene buttons and return-to-auto | Extends saved presets with temporary performance choices |
| Live control | MIDI mapping for selected buttons and faders | Adds a control source; does not establish DJ mixer data |
| Audience | Front, middle and rear response zones | Extends individual variation with spatial group behaviour |
| Audience | Rehearsal, half-full and full crowd settings | An artistic occupancy setting separate from rendering quality |
| Performers | Subtle deck and mixer gestures | Refines the existing performer animation |
| Lasers | Alternating banks, gradual opening and rests | Develops the existing fan, sheet and tunnel shapes |
| Effects | Group sequencing and recovery intervals | Develops existing CO2, sparks and flames |
| Light texture | A few selectable gobo treatments | Makes existing gobos more directly controllable |
| Atmosphere | Opening and closing house-light scenes | Develops the existing response to silence |
| Exploration | A bounded walk-through camera | Adds navigation beyond the existing camera views |
| Capture | Short video export | Requires separate verification of image capture, audio and load |
| Visual detail | Local haze and material refinements | Requires a measured benefit and render-cost comparison |
| Rig | Optional LED columns or a mirror ball | Adds equipment to Hangar after regie and performance review |

Extra equipment and heavier haze come later. First compare the existing rig
with better composition; retain a usable Light-quality setting. All work stays
within Hangar. Additional venues and phone-specific development are outside
this plan.

## Source basis and review scope

The inventory comes from the current Hangar rig, director, renderer, people,
camera and controls modules. The priorities and proposed combinations are
design choices, not measured user outcomes.

- [Hangar rig](../src/venues/hangar.js)
- [Show director](../src/director.js)
- [Theme definitions](../src/show-themes.js)
- [LED wall and fixtures](../src/fixtures.js)
- [Camera rules](../src/cameras.js)
- [People rendering](../src/people.js)
- [Audio-file identity and input](../src/audio.js)

Keep verification scoped: `npm test`, one `npm run test:browser` Hangar check,
and one short comparison relevant to the changed behaviour. Broader audio
regression is needed when the listening path itself changes. Synthetic checks
and a rendering screenshot are not musical approval.
