# Changelog

## 0.26.5

- Hangar's hall heads have eight looks: Floor scan, Curtains, Circles, Fans, Pillars, Crossfire, Converge and Sky.
  Each track gets three of them; a new track (or a long break that brings new colours) starts three others, and
  within a track the show moves to the next look at a scene cue after about 40 seconds. This applies to every mood.
- The five hall trusses take formations (High, Rising or Falling to the back, Valley, Arch, Low, Zigzag, Tilted) and
  hold each for about two minutes, changing sooner for a new track. A break still lowers them with the build; the
  drop takes them back to their formation. Tilting trusses move at the pace of their hoists.
- The status line names the current head look.
- The LED wall develops within each Hangar theme: quiet passages, builds and peaks each have their own treatment.
  Industrial goes from a few breathing frames to a scan that opens the wall to frame groups taking turns; Hypnotic
  from broad slow rings to rings gathering in the middle to layered rings across the wall; Melodic from one soft
  ribbon to opening ribbons with warm accents to a fuller set of ribbons.
- These treatments blend gradually; a drop opens the wall within about a second, and the build's shape is held while it fades.
- With a light choreography playing, the automatic camera cuts to a shot that shows the new composition, holds it
  while the light develops and reveals the hall in a wide shot when a stage opening reaches it. Drops still cut to
  the whole room, and breaks keep their close shots.
- **Automatic camera follows the light choreography** (on by default) restores the previous camera rules when switched off.
  The setting is saved with presets; manual camera choices keep priority.

## 0.26.4

- Checkpoint release of the completed Hangar themes and light choreography.
- Show behaviour is unchanged from 0.26.3; no unfinished camera changes are included.
- Updated expansion-plan status to distinguish released features from future proposals.

## 0.26.3

- Three coordinated Hangar themes: Industrial, Hypnotic and Melodic.
- Stage openings, hall waves and held light pictures connect heads and LED arches.
- Composed show chooses at existing scene cues and avoids immediate repetition.
- Theme and choreography choices are saved with presets; older presets retain the original show.
- The Mac Hangar browser check uses native WebGL by default, with an explicit software-renderer option.
- Browser checks close their control connection before terminating the test browser.

## 0.26.2

- Smoother Hangar rig movement and more coherent scene transitions.
- Clearer Hangar layout with visible FOH, delay speakers, barrier and walking lanes.
- More detailed flown PA arrays and improved crowd edge anti-aliasing.
- Subtle speaker grilles, DJ booth monitors and clearer FOH display details.
- Show controls and presets are easier to inspect, recover and use.

## 0.26.1

- Hangar is the only public venue and the main stage for improving SV.
- Fast daily tests and a separate Hangar browser check replace routine venue tours.
- Broader Hangar regression checks remain available when needed.

## 0.26.0

- Browser show engine with 33 fictional venues and 48 music moods.
- File playback, audio input selection, live input level and track feedback.
- Lighting controls, camera controls and presets saved in the browser.
- Automatic rendering quality and WebGL fallback for browsers without WebGPU.
- Optional local OSC receiver and data diagnostics.

This product distribution contains application source, general documentation
and synthetic tests. It includes no personal recordings, reference-track
observations, machine-specific handoffs or prepared third-party applications.
