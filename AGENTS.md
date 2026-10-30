# Development guidelines

Stage Visualizer (SV) is for someone who DJs at home and wants to stand behind the decks of a hangar show.
One hall, one full-width stage, one DJ booth. The light follows the music from system audio, rekordbox, or both.
Built with Godot 4.7.2 (Forward+); it runs on Windows, macOS and Linux.

## Rules

- Do not commit music, recordings, personal feedback, machine-specific notes, private experiments or anything that
  names a person, a machine or a home directory. Use generated audio and generic fixtures in tests.
- Every commit uses a GitHub noreply address. Work on a branch and open a pull request against `main`.
- Code and comments in English, short, like the code around them. UI text in English: short sentences, large text
  (Atkinson Hyperlegible, 20 px or more at 1080p), one thing per screen, Escape always goes one step back.
- `local/` is ignored: music, sessions, builds and pictures of your own checks live there.

## Where things are

| Part | Files |
|---|---|
| The show (the lighting designer) | `scripts/show.gd`, `scripts/show/` (director, looks, music, genres), `docs/choreografie.md` |
| The rig and its shaders | `scripts/rig.gd`, `shaders/beam.gdshader`, `batten`, `lens` |
| The hall, booth and crowd | `scripts/hall.gd`, `scripts/crowd.gd`, `shaders/booth`, `person`, `screen` |
| Listening and rekordbox | `scripts/listen*.gd`, `scripts/rekordbox.gd` |
| App screens | `scripts/menu.gd`, `setup.gd`, `settings.gd`, `pause.gd`, `help.gd`, `overlay.gd`, `ui_style.gd`, `display.gd` |
| Sessions and checks | `scripts/session.gd`, `scripts/show_checks.gd`, `tools/` |

## Checks

```sh
GODOT=/path/to/Godot_v4.7.2-stable
"$GODOT" --headless --path . --script tools/test_app.gd
"$GODOT" --headless --path . --script tools/test_controls.gd
"$GODOT" --headless --path . --script tools/test_show_checks.gd
"$GODOT" --headless --path . --script tools/test_choreography.gd
"$GODOT" --headless --path . --script tools/test_session.gd
"$GODOT" --headless --path . --script tools/test_rekordbox.gd
"$GODOT" --headless --path . --script tools/test_listen_ear.gd
```

Replay a recorded session with its checks: `"$GODOT" --headless --path . -- --replay=local/sessions/NAME.jsonl --fast --check`.
Pictures for a change: `./start.sh -- --track=local/track.ogg --wait=10 --shot=/path/to/picture.png`.
