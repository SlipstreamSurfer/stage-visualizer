// How sound gets into SV on this computer: the steps for each way of playing (System audio, Rekordbox, a file or
// another input) on macOS, Windows and Linux, with the names those systems use, and which input device to take.
// Plain data, so the settings page (sound-ui.js) and the tests read the same.
//   step: { text, check? }   check: what SV can see for itself
//     'device'    an input whose name matches the source's device on this system (after access to inputs is allowed)
//     'sound'     sound is coming in
//     'receiver'  the rekordbox data receiver runs (the server starts it)
//     'decks'     deck data is arriving from rkbx_link

export const PLATFORMS = { macos: 'macOS', windows: 'Windows', linux: 'Linux' };

export function platformOf(nav = globalThis.navigator) {
  const name = `${nav?.userAgentData?.platform || ''} ${nav?.platform || ''} ${nav?.userAgent || ''}`.toLowerCase();
  return /mac/.test(name) ? 'macos' : /win/.test(name) ? 'windows' : 'linux';
}

// the input device that carries this source on this system, by its name
const DEVICES = {
  system: { macos: /blackhole/i, linux: /\(Stage Visualizer\)/ },
  rekordbox: { macos: /blackhole/i, windows: /cable output|voicemeeter|vb-audio/i },
};
export const deviceOf = (source, platform) => DEVICES[source]?.[platform] || null;
// of the inputs the browser lists, the one for this source and system, or null
export function pickDevice(source, platform, devices) {
  const name = deviceOf(source, platform);
  return name && devices.find(d => d.kind === 'audioinput' && name.test(d.label || '')) || null;
}

const RKBX = 'For track, tempo and phrase data, run rkbx_link next to rekordbox and let it send OSC to 127.0.0.1:4460. SV receives it by itself.';
export const GUIDES = {
  system: {
    macos: [
      { text: 'Install BlackHole 2ch, a free virtual audio cable for the Mac.', check: 'device' },
      { text: 'In Audio MIDI Setup, make a Multi-Output Device of your speakers or headphones and BlackHole 2ch. Take the speakers as the clock source and turn on drift correction for BlackHole.' },
      { text: 'In System Settings → Sound, choose the Multi-Output Device as the output. You still hear everything; SV hears it too.' },
      { text: 'Play music in any app and click Connect system audio. SV takes BlackHole 2ch by itself.', check: 'sound' },
    ],
    windows: [
      { text: 'Play music in any app and click Connect system audio.' },
      { text: 'In the window that opens, choose Entire screen and switch on Also share system audio, then Share. SV only listens; it does not keep the picture.', check: 'sound' },
      { text: 'Or, without sharing: install VB-Cable, choose CABLE Input as the output in Windows and switch on Listen to this device for your speakers, and connect Other input → CABLE Output.' },
    ],
    linux: [
      { text: 'Install the PipeWire input once: copy linux/stage-visualizer.conf to ~/.config/pipewire/pipewire.conf.d/ and run systemctl --user restart pipewire.', check: 'device' },
      { text: 'Play music in any app (Spotify, a browser) and click Connect system audio.', check: 'sound' },
      { text: 'No sound? Check that the input is not muted: pactl get-source-mute stage-visualizer.' },
    ],
  },
  rekordbox: {
    macos: [
      { text: 'Install BlackHole 2ch, a free virtual audio cable for the Mac.', check: 'device' },
      { text: 'Let rekordbox play to BlackHole 2ch as well as to what you listen on. With a controller: in Audio MIDI Setup make an Aggregate Device of the controller and BlackHole 2ch, choose it in rekordbox → Preferences → Audio, keep Master on the controller and send Booth (or Rec) to BlackHole 1/2. Without a controller: a Multi-Output Device of your speakers and BlackHole 2ch. Names can differ per rekordbox version.' },
      { text: 'Choose Rekordbox here and click Connect rekordbox. SV takes BlackHole 2ch by itself.', check: 'sound' },
      { text: RKBX, check: 'decks' },
    ],
    windows: [
      { text: 'Install VB-Cable, a free virtual audio cable.', check: 'device' },
      { text: 'In rekordbox → Preferences → Audio, keep Master on your controller and send Booth (or a second output) to CABLE Input. Names can differ per rekordbox version.' },
      { text: 'Choose Rekordbox here and click Connect rekordbox. SV takes CABLE Output by itself.', check: 'sound' },
      { text: RKBX, check: 'decks' },
    ],
    linux: [
      { text: 'Rekordbox runs on a Mac or Windows laptop, not on Linux. Bring its sound into this computer: the controller\'s booth output or the laptop\'s line out into this computer\'s line in or audio interface.' },
      { text: 'Choose Rekordbox here, pick that line in or interface below, and click Connect rekordbox.', check: 'sound' },
      { text: 'For track, tempo and phrase data: start SV here with npm run rekordbox -- --rekordbox-lan, and let rkbx_link on the laptop send OSC to this computer\'s address on port 4460.', check: 'decks' },
    ],
  },
  file: {
    any: [
      { text: 'Click Choose an audio file, or drag a track onto the picture. Good for trying SV out, and for marking moments that go right or wrong.', check: 'sound' },
    ],
  },
  input: {
    any: [
      { text: 'An audio interface, a microphone or any virtual input: pick it below and click Connect audio input. Names appear once the browser may use inputs.', check: 'sound' },
    ],
  },
};
export const guideOf = (source, platform) => GUIDES[source]?.[platform] || GUIDES[source]?.any || [];
