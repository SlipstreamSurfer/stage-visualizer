# Prepared shows

Live, Stage Visualizer has to guess what the music does: it hears a break only once the kick has gone, and a drop
only once it is back. For a track you play from a local file you can prepare the show instead. A prepared show is a
cue list in bars of the track's own tempo; while that file plays, the show follows it: the parts of the track, the
drops on their exact beat, and the looks, colours, effects and camera cuts you chose. The levels (energy, bass, the
highs) still come from listening, so the light keeps breathing with the sound. Seeking, pausing and playing again
are followed; nothing fires for a passage you skip. After the last part, or for any other file, the show listens as
usual.

## Where it goes

Put the file in `shows/` next to `index.html`, named after the audio file with `.json` added:
`shows/My Track.mp3.json` for `My Track.mp3`. The folder is not part of the repository; your shows stay on your
computer. Choose the audio file under **Sound connection → Audio file** as usual. While a prepared show runs, the
status line names it and shows the bar.

## The file

```json
{
  "name": "My Track",
  "bpm": 124,
  "offset": 0.36,
  "parts": [
    { "bar": 1, "section": "intro" },
    { "bar": 33, "section": "groove" },
    { "bar": 49, "section": "peak" },
    { "bar": 64, "section": "peak", "kick": false },
    { "bar": 65, "section": "peak" },
    { "bar": 81, "section": "break", "build": [0, 1] },
    { "bar": 97, "section": "peak", "drop": true },
    { "bar": 129, "end": true }
  ],
  "cues": [
    { "bar": 1, "heads": "pillars", "trusses": "Canopy", "theme": "industrial", "colors": ["#e8efff", "#3a6bff"], "camera": 2 },
    { "bar": 49, "heads": "circles", "choreography": "solo", "trusses": "High" },
    { "bar": 96, "strobe": 4 },
    { "bar": 97, "heads": "converge", "fire": ["co2", "spark"], "blinder": 1, "camera": 0, "cut": "hard" }
  ]
}
```

- **bpm** and **offset**: the tempo and the time of the first downbeat in seconds. Bar 1 starts at the offset; a bar
  has four beats (`beatsPerBar` changes that).
- **parts** describe the music. `section` is `intro`, `groove`, `peak`, `low` (a quiet part) or `break`. `kick` is
  on except in a break; set it to `false` for a fill without kick. `build` rises from its first to its second value
  through the part, for the tension of a break. `drop: true` drops on the part's first beat. `end` hands back to
  listening.
- **cues** take effect on their bar (`beat` 1–4 for a later beat). A cue keeps its looks until a later cue changes
  them:
  - `heads`: a hall head look, or `auto` (see [Hangar themes](hangar-themes.md) for the looks; the key is the one in
    `src/hangar-looks.js`, such as `converge` or `ballyhoo`);
  - `trusses`: a formation by name, such as `High` or `Twin valleys`, or `auto`;
  - `choreography`: `original`, `composed` or one of the nine compositions;
  - `theme`: `industrial`, `hypnotic`, `melodic` or `auto`;
  - `colors`: one to four `#rrggbb` colours.
  
  And once, on their beat: `fire` (`co2`, `spark`, `flame`, `firework`, `confetti`; switched-off effects stay off),
  `strobe` and `blinder` for a number of beats, and `camera` (a shot number from 0, or `auto`) with `cut: "hard"` or
  the usual dip through black. A camera you choose yourself keeps priority.

A file with a mistake is not used; the status line says what is wrong.

## Finding the bars

Use a DJ program's beat grid or `npm run listen -- "My Track.mp3"`, which prints the tempo and where the kick
leaves and returns. A 124 BPM bar lasts 60 / 124 × 4 = 1.935 seconds.
