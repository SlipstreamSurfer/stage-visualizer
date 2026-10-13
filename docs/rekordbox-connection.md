# Optional OSC diagnostics

Stage Visualizer can display track and timing data from a compatible external
OSC sender. The receiver does not read audio, install a sender or modify DJ
software. Normal file playback and audio input work without this connection.
The product show follows audio; this data diagnostic does not control it.

## Start

Run `npm run rekordbox` and open
<http://127.0.0.1:8765/rekordbox.html>. HTTP listens on `127.0.0.1:8765` and
OSC on `127.0.0.1:4460`. Run one server per port.

`npm run rekordbox:simulate` sends clearly labelled synthetic data for ten
seconds. Run it separately from a real sender. It checks local reception only;
it does not establish DJ-software compatibility. The page reports connection
loss three seconds after data stops.

## Messages

The receiver accepts rkbx_link-style OSC messages for decks 1–4 and master.
Prefix fields with the deck, for example `/1/track/title`.

| OSC suffix | Value |
| --- | --- |
| `track/title`, `track/artist`, `track/album` | Text |
| `bpm/current`, `bpm/original` | BPM |
| `time` | Seconds |
| `phrase/current`, `phrase/next` | String labels or numeric categories |
| `phrase/countin` | Beats remaining |
| `beat/subdiv/1` | Beat fraction |

Identity, transport and phrase-boundary fields from richer senders can also
appear in the diagnostic data. Track changes and missing analysis clear
preceding phrase fields. Prefer string phrase labels when the sender offers them.

Compatibility depends on the external sender and its DJ-software version.
This product supplies no native reader or application copy.
[rkbx_link](https://github.com/grufkork/rkbx_link) is one protocol source;
check its own compatibility documentation.
