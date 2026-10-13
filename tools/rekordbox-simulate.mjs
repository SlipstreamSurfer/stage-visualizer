// Local receiver test only. No Rekordbox process, audio or analysis is involved.
import dgram from 'node:dgram';
import { encodeOSC } from './rekordbox-bridge.mjs';

const socket = dgram.createSocket('udp4'), start = Date.now();
console.log('Sending simulated deck data to 127.0.0.1:4460 for 10 seconds. This does not test the Mac sender.');
const send = (field, value) => socket.send(encodeOSC('/1/' + field, value), 4460, '127.0.0.1');
const timer = setInterval(() => {
  const seconds = (Date.now() - start) / 1000, beats = seconds * 124 / 60;
  send('track/title', 'SV receiver test (SIMULATED)'); send('track/artist', 'Stage Visualizer');
  send('bpm/current', 124); send('time', seconds);
  send('phrase/current', seconds < 5 ? 'Up 1' : 'Chorus 1');
  send('phrase/next', seconds < 5 ? 'Chorus 1' : 'Down');
  send('phrase/countin', (seconds < 5 ? 5 - seconds : 10 - seconds) * 124 / 60);
  send('beat/subdiv/1', beats % 1);
  if (seconds >= 9.9) { clearInterval(timer); socket.close(); }
}, 100);
process.once('SIGINT', () => { clearInterval(timer); socket.close(); });
