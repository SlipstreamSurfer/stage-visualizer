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

The heads on the hall trusses are programmed the way a lighting desk does it. A look combines:

- a **position**: on the floor, straight down, fans towards the walls, crossing over the crowd, meeting over the
  booth, long beams under the roof, leaning towards the stage or the back, onto the walls, a tunnel to the stage,
  or spread over the crowd;
- a **movement**: still, a slow sway, circles, figures of eight, a ripple along each truss, a pan wave, a fan that
  opens and closes, a snake down the hall, or the whole picture turning;
- which heads are **lit**: all, the six figures, a band along the trusses, a band across or down the hall, out
  from the middle, alternate heads, a different handful every beat, or one truss at a time;
- how the **colours** are spread: the sides swapping, one colour, alternate heads, alternate trusses, from the
  stage to the back, or white in the middle;
- the **beam**: normal, narrow, wide or with a gobo.

There are 25 looks, each suited to calm parts, the groove or peaks. Every track gets two of each; a new track, or a
long break that brings new colours, gets others. Within a track the next look comes at a scene cue. A break keeps
its own aim.

The five hall trusses take one of 15 formations (High, Rising and Falling to the back, Valley, Low, Tilted, Arch,
Zigzag, Front low, Twin valleys, Ramp tilted, Canopy, Middle low, Twisted, Back low) and hold it for minutes; low
formations come in calm parts, high ones in peaks. A break lowers them with the build, never below 7 metres; the
drop takes them back to their formation.

In the Show panel, **Hall heads** and **Truss formation** pin one look or formation, and **Changes** sets the pace:
Calm (looks about every 80 seconds, formations every four minutes), Normal (40 seconds, two minutes) or Lively
(20 seconds, one minute). These settings are saved with presets. All of this works the same in every mood.

## More light choreographies

Besides Stage opening, Hall wave and Held picture: **Towards the stage** (a band of light runs from the back to the
stage every two bars), **Left and right** (the halves answer each other every bar), **Truss by truss** (one hall
truss leads at a time), **From the middle** (light opens towards the walls), **Breathing room** (the rig swells
and settles over two bars) and **Call and response** (the stage plays a bar, the hall answers). Composed show takes
turns through all nine.
