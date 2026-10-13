# Stage Visualizer

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/logo-dark.svg">
    <img src="docs/logo-light.svg" alt="Stage Visualizer" width="520">
  </picture>
</p>

A browser show engine: lights, cameras and a crowd that follow the music you play.
**Hangar** is the single public venue and the main stage for developing SV.
Choose from **48 moods** to shape its show. WebGPU renders the show when available; WebGL provides a fallback.

## Start

Install **Node.js 24 LTS or newer** and use a current Chrome or Edge browser.
No build step or npm dependencies are needed; three.js is included.

```sh
git clone https://github.com/SlipstreamSurfer/stage-visualizer.git
cd stage-visualizer
npm start
```

Open <http://127.0.0.1:8765/>. The show starts with a silent demonstration.
On macOS you can also double-click `Start-SV-Mac.command` after installing Node.js.

## Connect music

Choose a **Sound source** and use its connection button:

- **Audio file:** select or drag in a local track. Playback includes pause, seek
  and restart, with optional Good/Wrong marks and CSV export.
- **Audio input:** connect a microphone, audio interface or virtual input.
  Select an input and click **Connect audio input**. Allow the expected browser
  microphone permission; device names appear after permission is granted.
- **System audio:** use the browser's supported system-audio sharing option.
  On Linux, a PipeWire input can carry system sound; see [Linux audio](linux/stage-visualizer.conf).

For DJ software on macOS, a multi-output device can send music to headphones
and BlackHole 2ch. Select BlackHole as SV's audio input. See the
[Dutch Mac audio guide](LEES-MIJ-MAC.md). Reconnect the audio input after
closing or reloading the page. A connected input with no detected audio is silent.

## Control the show

Venue, mood, look and camera are the main controls. Show, Lights, Effects and
Settings tabs contain finer controls. Venue and quality changes preserve the
active audio stream. Automatic quality reduces detail after sustained slow
rendering; explicit Light, Normal and High choices are remembered.

Look presets include Standard, Calm, Cinematic and Energetic. Adjust light,
glow, haze and hall sliders for a custom look. Light groups, palettes, beam
width and camera speed have their own controls. Browser presets save your
preferred settings. **Restore a balanced starting point** resets the show.

Hold **Space** for strobe and **B** for blinders. **K** triggers confetti,
**C** CO2 and **V** pyro where enabled. **H** hides the panel; **F** toggles
fullscreen; **1–9** select cameras and **0** selects automatic cameras.
Effects unavailable in a venue are marked. Releasing a hold or leaving the
window releases held effects.

Optional file-playback feedback is saved locally under `rec/feedback/` by the
local server. Music is processed locally; feedback and presets are not uploaded
to a remote service. Keep local music and feedback out of source control.

## Optional OSC diagnostics

`npm run rekordbox` enables a local OSC receiver on UDP 4460, with a diagnostic
page at <http://127.0.0.1:8765/rekordbox.html>. A compatible external sender is
required. This product does not install or modify DJ software. The diagnostics
display track and timing data; the public show follows its audio input.
See [OSC diagnostics](docs/rekordbox-connection.md).

## Development

```sh
npm test
npm run listen -- track.mp3
npm run check -- track.mp3
```

`npm test` runs the fast Hangar and audio-engine checks. Use `npm run test:browser`
for one real Hangar render, generated audio, camera controls and quality changes.
`npm run test:audio` adds the longer listening and mix regressions.
`npm run test:extended` runs the longer regression checks when audio, rendering
or playback changes warrant them. Every browser check uses Hangar.

Browser checks require Chrome, Edge or Chromium; `BROWSER_PATH` selects an
executable. Tests use generated audio and synthetic fixtures. Audio-analysis
commands need ffmpeg. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE). Bundled three.js is also MIT-licensed; see
[vendor/three/LICENSE](vendor/three/LICENSE).
