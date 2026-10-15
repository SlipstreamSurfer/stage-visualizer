# Changelog

## 0.32.0

- Time of day, in Settings → Show: Night, Day or Sunset (`src/daylight.js`). By day the hall is lit from above and
  shafts of sunlight fall through the skylights into the haze; at sunset the light is warm and low, and long golden
  shafts reach towards the stage. The shafts are light in haze: each pixel works out how far the line of sight runs
  through them, thinning to nothing at their sides. The skylights are frosted glass, a soft light rather than a view.
  A change of time goes over in seconds, without rebuilding the venue.
- The hangar door can open, by night and by day: its six leaves slide slowly to the ends of the opening in the back
  wall, and outside lies the airfield, with hangars, a tower and trees against the sky, the town's glow and red roof
  lights at night, and at sunset the low sun shining in through the door. Seen best from the DJ view and the DJ booth.
- Time of day and the door are saved with presets. For a picture: `?time=sunset&door`.

## 0.31.0

- One choice says how you play: System audio, Rekordbox, Audio file or Other input, in the controls and on the start
  screen. System audio is the first choice.
- Settings → Sound shows the setup for that choice on this computer, recognised as macOS, Windows or Linux and
  changeable, in the names those systems use: BlackHole 2ch with a Multi-Output (or, for rekordbox with a controller,
  an Aggregate) Device on a Mac; screen sharing with system audio or VB-Cable on Windows; the PipeWire input on Linux,
  and for rekordbox on a laptop how its sound and data reach the Linux computer. Each step that SV can see for itself
  is ticked off: the device found, sound coming in, the rekordbox receiver running, deck data arriving.
- The connect button takes the right device: BlackHole 2ch on a Mac for system audio and rekordbox, CABLE Output on
  Windows for rekordbox; each way of playing remembers its own input.
- The rekordbox data receiver starts with the server (this computer only; `--rekordbox-lan` for the network,
  `--no-rekordbox` to leave it off). With Rekordbox chosen, the status line shows which deck plays. The data does not
  steer the show yet.

## 0.30.0

- The crowd dances the way the music asks. Five ways, chosen by the mood: peak, raw and hard techno, trance and bass
  stomp (knees, fists, jumping when the room goes off); deep and hypnotic techno drive (a steady bounce, now and then
  a hand); house and open format groove (bouncy, the arms along); organic, afro, melodic, progressive and deep house
  sway (from foot to foot in half time, hands in front of the chest on the beat or one arm up to the vibe, nobody
  jumping on a drop); concert and ambient stand and listen. A change of mood changes the dancing over a few seconds.
- Where someone stands says how they dance: in the middle up front the most and the first hands in the air, along
  the walls and at the back calmer. Along the walls the crowd is thinner, and some stand turned to each other,
  talking.

## 0.29.0

- DJ view, the second camera (key 2), in place of Dance floor: through the eyes of whoever plays, with the hands on
  the gear at the bottom of the picture and the crowd beyond. It moves when the DJ steps aside, and the DJ's own head
  is not in the picture. The automatic camera uses it in peaks and in a few light choreographies.
- The DJ booth: the work lamp over the gear is a soft glow instead of a spotlight. The DJ's monitors stand beside the
  booth instead of on it, a bass cabinet on the floor with the mid/high box on a pole at ear height, turned to the
  DJ. Two bottles of water, a towel and a phone lie on the table.
- Front of house is set up like at a real show: a sound desk with two rows of faders, knobs, meters and three
  screens; a lighting desk with its screens, two monitors on a bar and a wing; a video desk with a laptop; two racks
  full of status lights; a measurement microphone towards the stage; small lamps on goosenecks; four crew.
- The skylights show the night: small stars and a thin veil of cloud, seen from wherever the camera is.
- The hall trusses come down to 5.5 m, a little more than half way, in the low formations (Canopy, Valley, Low,
  Front low, Back low, Twin valleys and more) and as a break builds. The Front of house camera flies lower, under
  them, and a test keeps every camera clear of the trusses and their lamps at their lowest.
- In a breakdown the phones in the air have their torches on: from the stage a field of small lights.

## 0.28.0

Tighter on the beat:
- A kick counts from the moment it hit, not from when the show accepted it (up to three frames later), and the tempo
  the kicks keep comes from a line through their times instead of one gap rounded to a frame, which at 128 BPM is a
  step of 4 %. The beat grid that runs on through a break is laid on the same exact times.
- A tempo the track has kept for twenty seconds holds through a stretch whose bass hits line up a few percent faster
  or slower (a rolling bass line or a percussion loop, in the recordings 128 against 131 or 134), even when the show
  takes those hits for kicks; only half a minute of the other tempo is believed. Over 40 recordings the tempo shown
  is right 92 % of the time (was 91 %) and jumps 0.4 times a minute (was 0.5); in Adam Beyer's Love Within 73 % of
  the time instead of 44 %.
- Looks change on the first beat of a phrase. The director counts beats instead of kicks, from the drop or from where
  the track came in, so a missed kick or a pause of up to four bars keeps the count; before, a scene changed on the
  last beat of a phrase and the count slipped with every missed kick. A new part of the track or a layer coming in
  changes the look on the first beat of the next pair of bars.
- `tools/tempo.mjs` measures how well the show holds the tempo of recordings, against the tempo of each whole
  recording.

A smoother picture:
- Everything a venue can show is compiled before it is shown, also what stays hidden until it is used (CO2, sparks,
  flames, lasers). Measured, the picture stopped for a fifth of a second on the first drop and at the first break.
- When frames take longer than the screen allows, the show draws fewer pixels, a step a second down to 70 %, and
  sharpens again when there is room; a resolution that did not hold is not tried again for a minute. Automatic
  quality only rebuilds the venue lighter when even that is not enough. It learns the screen's own pace (a 75 Hz
  screen is kept at 75). Settings → Picture → Keep the picture smooth switches it off.
- One show at a time: a newer tab or window with the show pauses the older ones until they are clicked, as two shows
  drawing at once halve the pace of both.

## 0.27.2

- Clearer headers: each part of the console has its own small icon and a fine line after its name; the settings
  pages mark their sections in orange, and the settings title sits beside the logo light.

## 0.27.1

- The page code is split: the console, settings and start screen (`src/ui.js`), connecting the sound
  (`src/sound-ui.js`), the live effects (`src/effects-ui.js`) and saved presets (`src/presets-ui.js`) each have their
  own file, and `src/main.js` keeps the show itself. Nothing changes in what you see or can do.
- GitHub checks every pull request: `npm test` runs, and every commit must carry a GitHub noreply address.
- The camera and full-page browser checks draw on the graphics card where there is one, like the other page checks,
  instead of failing in software rendering.

## 0.27.0

- One console along the bottom of the screen holds every control you use during the show, always in the same place
  and without scrolling: Sound, Track (while a file plays), Show, Levels, Fixtures and Effects. The look sliders,
  beam width, sound sensitivity and camera speed are faders side by side; theme and pace of changes are buttons
  instead of lists; every light group and effect is a switch. On a narrower screen the console folds onto two rows,
  on a phone it becomes a sheet.
- Settings (the gear, or S) hold what you set once, in six short pages: Show, Lights, Picture, Presets, Sound and
  Keys. The level per light group moved there from the quick lights tray, which is gone. Escape closes them.
- A start screen covers the venue while it builds. Choose the sound source and the picture quality, then start the
  show: that click connects the sound. A reload in the same tab, a test browser and `?hide` skip it.
- The Stage Visualizer logo on the start screen, its light in the settings and as the tab icon.
- New screenshots in the README: the Hangar, the DJ booth, the console, the start screen and the settings.

## 0.26.6

- The hall heads are programmed like a lighting desk: a look combines a position, a movement, which heads are lit,
  how the colours are spread and the beam. There are now 25 looks, among them Tunnel, Ballyhoo, Figures of eight,
  Ripple, Snake, Scatter, Pan wave, Turning fans, On the walls and Crossfire or Converge truss by truss.
- Every track gets two looks for its calm parts, two for the groove and two for the peaks; the next track gets others.
- Six more light choreographies: Towards the stage, Left and right, Truss by truss, From the middle, Breathing room
  and Call and response. Composed show takes turns through all nine; the camera knows each of them.
- Fifteen truss formations instead of eight, among them Canopy, Twin valleys, Front low, Back low and Twisted.
  Low formations come in calm parts, high ones in peaks. A break never lowers a truss below 7 metres.
- **Hall heads**, **Truss formation** and **Changes** (calm, normal or lively) in the Show panel pin a look or a
  formation and set how often they change. They are saved with presets.

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
