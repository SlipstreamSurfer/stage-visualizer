# Audio setup on macOS

## Start Stage Visualizer

Install Node.js 24 or newer and use Chrome or Edge. Download and extract the
repository, then double-click `Start-SV-Mac.command`. Alternatively, open a
terminal in the project folder and run `npm start`.

Open <http://127.0.0.1:8765/>. The show starts with a silent demonstration.
Choose **Audio file** to load a local track, or **Audio input** to connect live
sound from an audio interface or virtual audio device.

## Connect sound from another app

SV can follow music from a player, streaming app or DJ software. Route that
app's output to an audio input available to the browser. An audio interface
with loopback or a virtual audio device can provide this input.

For example, with BlackHole 2ch installed:

1. Open Audio MIDI Setup and create a Multi-Output Device containing your
   speakers or headphones and BlackHole 2ch.
2. Use your speakers or headphones as the primary clock device, enable drift
   correction for BlackHole and use the same sample rate for both devices.
3. Select the Multi-Output Device as the music app's output, or as the system
   output when the app uses the default device.
4. In SV, choose **Audio input**, select BlackHole 2ch and click
   **Connect audio input**. Allow microphone access for the local SV page.
5. Play music and check that SV's input meter responds.

Reconnect the audio input after closing or reloading SV. The virtual device
carries the music into SV; the speakers or headphones let you hear it normally.

## Troubleshooting

- **Node.js is missing:** install Node.js and reopen the terminal.
- **The port is already in use:** stop an earlier SV server with Control-C.
- **Connected, but no audio detected:** check that music is playing and that
  the app's output and SV's input refer to the intended devices.
- **The browser requests permission:** allow access to the intended audio
  input for the local SV page, then select the device explicitly.
- **Audio crackles:** check that device sample rates agree and adjust the audio
  app or interface's buffer size if it exposes that setting.

SV runs locally. Music, recordings and listening notes do not belong in the
public repository.
