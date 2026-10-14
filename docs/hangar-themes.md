# Hangar show themes

Choose **Show → Show theme** to give the LED wall, arch patterns, laser
shapes and light colours a shared visual identity:

- **Industrial:** geometric frames and moving lines, white and amber accents.
- **Hypnotic:** slow concentric motion, blue and violet, a wave through the arches.
- **Melodic:** flowing ribbons, warm accents, arches answering the stage.

**Follow the mood** uses the existing show. Themes blend gradually when
changed and are saved with show presets. Existing presets default to
Follow the mood. Themes keep the existing scene cues, moving-head directions,
truss targets and audio connection. They do not change the selected mood.

A manual colour palette takes priority over theme colours. Choose
**Lights → Colour palette → Follow the show** to use the theme palette.
Faders, blackout and light switches keep their usual priority. Choosing a
theme enables the LED wall; it can then be switched off again. Your own
wall picture or video keeps priority over generated visuals.

These additions are based on the public 0.26.2 Hangar product source.

## Quiet, build and peak

Since 0.26.5 the LED wall also develops within the chosen theme. It does not switch to another theme:

| Theme | Quiet / break | Build | Peak |
| --- | --- | --- | --- |
| Industrial | A few frames breathing in the dark | A scan opens the wall from the middle and leaves lit frames behind it | Three groups of frames take turns every four beats, with a small kick accent |
| Hypnotic | Broad, slow rings | Rings narrow and gather towards the middle | Three layers of rings across the wall, still slow |
| Melodic | One soft ribbon | Ribbons open and warm accents come in | A fuller set of ribbons, without fast flashes |

The treatments use the existing audio-derived section, build and beat clocks and blend gradually.
A drop opens the wall within about a second; the shape of the build is held while it fades out.
Your own wall picture or video, the wall switch and blackout keep priority.

## Light choreography

Choose **Show → Light choreography → Composed show** for automatic variations
between Stage opening, Hall wave and Held picture. Each composition lasts
until an existing scene cue. Stage opening brings in the hall after the
stage; Hall wave uses a slow 32-beat wave shared by heads and arches; Held
picture holds requested head directions for four beats before resuming the
existing movement. Beat-driven moods use beats; moods without a beat use the
existing slow flow clock. Directions remain subject to the fixture's motor smoothing.

Individual compositions can also be selected directly. **Original show**
restores the previous bank and arch patterns. Older presets use Original show.
Choreography uses the existing audio-derived music clock and scene selection.
It does not change truss targets or theme colours; for the camera, see below. Light switches,
group faders and blackout retain priority.

## Camera and choreography

With **Automatic camera follows the light choreography** switched on (the default) and a light choreography
playing, the automatic camera shows the composition. When a new composition starts it cuts to a shot that suits
it: the stage and front of house for a Stage opening, the side and high views for a Hall wave, the room for a
Held picture. It then holds that shot while the light develops (20, 32 and 6 beats). A Stage opening is revealed
in a wide shot once the light reaches the hall. A drop still cuts to the whole room, a break keeps its close
shots, and a camera you choose yourself keeps priority. Switch the option off for the previous camera rules.

## Head looks and truss formations

The heads on the hall trusses have eight looks: **Floor scan** (beams moving through the depth of the hall),
**Curtains** (a fan of beams across each truss), **Circles** (every beam draws a slow circle on the floor),
**Fans** (opening towards the walls), **Pillars** (straight down, with a band of light running along the trusses),
**Crossfire** (left and right beams crossing over the crowd), **Converge** (all beams meet over the booth) and
**Sky** (up into the roof). Calm parts use the calm looks, peaks the big ones. Each track gets three looks; a new
track, or a long break that brings new colours, starts three others. Within a track the next look comes at a
scene cue after about 40 seconds. A break keeps its own aim.

The five hall trusses take a formation (High, Rising to the back, Valley, Low, Tilted, Arch, Zigzag, Falling to
the back) and hold it for about two minutes; a new track brings a new formation sooner. A break lowers them with
the build in a measured wave; the drop takes them back to their formation. This works the same in every mood.
