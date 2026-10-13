// Sound sources for the page: an input device, the computer's own sound, or an audio file. Whatever the source, the
// page pumps what has come in through the Ear, once per picture frame.
import { Ear } from './ear.js';
const SYSTEM_DEVICE = '(Stage Visualizer)';   // the PipeWire input on Linux that carries what the computer plays
const plain = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
// A tap on the sound: a small program on the browser's audio thread that passes on every block of samples as it is
// played, mixed to one channel. Nothing is lost and nothing comes twice, whatever the picture is doing.
const TAP = URL.createObjectURL(new Blob([`
  registerProcessor('tap', class extends AudioWorkletProcessor {
    process(inputs) {
      const ch = inputs[0];
      if (ch.length) { const n = ch[0].length, mix = new Float32Array(n); for (const c of ch) for (let i = 0; i < n; i++) mix[i] += c[i] / ch.length; this.port.postMessage(mix, [mix.buffer]); }
      return true;
    }
  });`], { type: 'text/javascript' }));

export class Audio {
  constructor(onSource) {
    this.onSource = onSource;   // called with the label of a new source
    this.live = false; this.label = ''; this.message = ''; this.request = 0;
  }
  async context() {
    this.ctx ??= new AudioContext({ latencyHint: 'interactive' });
    await this.ctx.resume();
    if (this.tapped === undefined) { try { await this.ctx.audioWorklet.addModule(TAP); this.tapped = true; } catch { this.tapped = false; } }   // an old browser falls back on the waveform
  }
  listenTo(node, stream, label) {
    this.source?.disconnect(); this.analyser?.disconnect(); this.tap?.disconnect(); this.tap = null;
    this.stream?.getTracks().forEach(t => t.stop());
    if (node !== this.playerNode) this.player?.pause();
    this.stream = stream;
    // only the waveform is taken from the browser, the last two thirds of a second of it, so that a slow or uneven
    // picture loses no sound; the Ear does the rest
    this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = 32768;
    this.source = node; node.connect(this.analyser);
    this.wave = new Float32Array(this.analyser.fftSize); this.ear = new Ear(this.ctx.sampleRate); this.heardTo = this.ctx.currentTime;
    this.blocks = [];
    if (this.tapped) { this.tap = new AudioWorkletNode(this.ctx, 'tap', { numberOfOutputs: 0 }); this.tap.port.onmessage = e => this.blocks.push(e.data); node.connect(this.tap); }
    this.live = true; this.message = ''; this.label = label;
    this.onSource(label);
  }
  async useStream(stream, request, label) {
    try { await this.context(); } catch (e) { stream.getTracks().forEach(t => t.stop()); throw e; }
    if (request !== this.request) { stream.getTracks().forEach(t => t.stop()); return false; }
    const track = stream.getAudioTracks()[0];
    track.onended = () => { this.message = 'Audio connection lost · choose the source again'; };
    this.listenTo(this.ctx.createMediaStreamSource(stream), stream, label || track.label);
    return true;
  }
  // an input such as BlackHole or a microphone
  async input(deviceId) {
    const request = ++this.request;
    return this.useStream(await navigator.mediaDevices.getUserMedia({ audio: { ...plain, deviceId: deviceId ? { exact: deviceId } : undefined } }), request);
  }
  // What the computer plays. On Linux through the PipeWire input when it is set up; elsewhere a browser only hands it
  // over as part of a screen share, so the picture is asked for as small as possible and never used.
  async system() {
    const request = ++this.request;
    let probe = null;
    try { probe = await navigator.mediaDevices.getUserMedia({ audio: plain }); } catch {}
    if (probe) {
      const found = (await navigator.mediaDevices.enumerateDevices()).find(d => d.kind === 'audioinput' && d.label.includes(SYSTEM_DEVICE));
      if (found && probe.getAudioTracks()[0].getSettings().deviceId === found.deviceId) return this.useStream(probe, request, 'System audio');
      probe.getTracks().forEach(t => t.stop());
      if (found) return this.useStream(await navigator.mediaDevices.getUserMedia({ audio: { ...plain, deviceId: { exact: found.deviceId } } }), request, 'System audio');
    }
    if (!navigator.mediaDevices.getDisplayMedia) throw new Error('this browser cannot share system audio');
    const shared = await navigator.mediaDevices.getDisplayMedia({ video: { width: 320, height: 180, frameRate: 1 }, audio: plain, systemAudio: 'include' });
    if (!shared.getAudioTracks().length) { shared.getTracks().forEach(t => t.stop()); throw new Error('no audio was shared · share the whole screen or a tab and turn on audio sharing'); }
    return this.useStream(shared, request, 'System audio');
  }
  // Measure the actual waveform, independent of sensitivity and the demo music.
  signal() {
    if (!this.live) return { state: 'demo', level: 0 };
    const track = this.stream?.getAudioTracks()[0];
    if (track?.readyState === 'ended') return { state: 'lost', level: 0 };
    if (this.ctx.state !== 'running') return { state: 'suspended', level: 0 };
    if (track?.muted || (this.source === this.playerNode && this.player?.paused)) return { state: 'silent', level: 0 };
    this.analyser.getFloatTimeDomainData(this.wave);
    let sum = 0;
    const start = Math.max(0, this.wave.length - 2048);
    for (let i = start; i < this.wave.length; i++) sum += this.wave[i] ** 2;
    const rms = Math.sqrt(sum / (this.wave.length - start));
    return { state: rms > 0.001 ? 'receiving' : 'silent', level: Math.min(1, rms * 4) };
  }
  // an audio file, played by the page itself: you hear it and the show listens to it
  async file(file) {
    const request = ++this.request;
    await this.context();
    if (request !== this.request) return;
    if (!this.player) {
      this.player = new window.Audio();
      this.playerNode = this.ctx.createMediaElementSource(this.player);
      this.player.onended = () => { if (this.source === this.playerNode) this.message = 'The file has ended · play another or choose a source'; };
      this.player.onerror = () => { if (this.source === this.playerNode) this.message = 'No audio: the browser cannot play this file'; };
      this.player.onplay = () => { if (this.source === this.playerNode) this.message = ''; };
      this.player.onseeking = () => {
        if (this.source !== this.playerNode) return;
        // A seek is a new listening segment, not a break or drop in the music.
        this.ear = new Ear(this.ctx.sampleRate); this.blocks = []; this.heardTo = this.ctx.currentTime;
        this.segmentStart = this.player.currentTime;
        this.message = ''; this.onSource(this.label);
      };
    }
    if (this.player.src) URL.revokeObjectURL(this.player.src);
    this.player.src = URL.createObjectURL(file);
    this.fileInfo = { name: file.name, size: file.size, lastModified: file.lastModified };
    this.segmentStart = 0;
    this.listenTo(this.playerNode, null, file.name);
    this.playerNode.connect(this.ctx.destination);
    await this.player.play();
  }
  // Hands the sound that has come in since the last call to the Ear, which calls step(bands, rms) for every step
  // of it. Returns how many seconds were missed, when the page was away for longer than the buffer holds.
  pump(step) {
    const rate = this.ctx.sampleRate;
    if (this.source === this.playerNode && (this.player.paused || this.player.seeking)) {
      this.blocks = []; this.heardTo = this.ctx.currentTime;
      return 0;   // pausing the file must not invent a musical break
    }
    if (this.tap) {   // every block the tap has passed on, in order
      let missed = 0;
      const max = Math.ceil(rate * 2 / 128);   // after more than two seconds away, only the last two are listened to
      if (this.blocks.length > max) { const drop = this.blocks.splice(0, this.blocks.length - max); missed = drop.reduce((n, b) => n + b.length, 0) / rate; }
      for (const b of this.blocks.splice(0)) this.ear.push(b, 0, b.length, step);
      return missed;
    }
    let fresh = Math.round((this.ctx.currentTime - this.heardTo) * rate), missed = 0;
    if (fresh <= 0) return 0;
    this.heardTo += fresh / rate;
    if (fresh > this.wave.length) { missed = (fresh - this.wave.length) / rate; fresh = this.wave.length; }
    this.analyser.getFloatTimeDomainData(this.wave);
    this.ear.push(this.wave, this.wave.length - fresh, this.wave.length, step);
    return missed;
  }
}
