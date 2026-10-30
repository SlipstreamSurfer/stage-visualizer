# Sessies opnemen en afspelen

`Session` bewaart vlak vóór `Show.update()` één compacte JSON-regel per beeldframe.
Elke regel bevat tijd, frame-duur, alle Listen-velden uit AGENTS.md (plus de andere
publieke waarden die Show/HUD gebruiken), ruwe `rb.fields`, `rb.live()` en de publieke
receiverstatus/deckkeuze. Er is een versieheader en een afsluitregel met aantallen en audio-info.
De IEEE-floatkopie `f64` voorkomt afrondingsverschillen door Godots JSON-parser;
OSC-integers krijgen hun oorspronkelijke type terug. De leesbare getallen blijven erbij.
Er wordt gestreamd naar schijf; geheugenverbruik groeit niet met de sessieduur.

## Nu gebruiken

Opname en replay zijn gekoppeld aan de normale app (`main.gd`, ook via `start.sh`).
Gebruik Godot 4.7.2; vul bij `GODOT` zo nodig de volledige padnaam in.

```sh
GODOT="$HOME/.local/opt/godot/Godot_v4.7.2-stable_linux.x86_64"
# Live bronnen uit P / bewaarde instellingen, 60 s opnemen; Escape stopt ook netjes.
"$GODOT" --path . -- --record --seconds=60
# Muziekbestand + OSC (de driver kan beide voor deze proef combineren).
"$GODOT" --path . -- --record --track=local/track.ogg --osc-port=4460 --seconds=12
# Kijken, met de WAV-kopie als die bestaat.
"$GODOT" --path . -- --replay=local/sessions/NAAM.jsonl
# Controles, zonder wachten of audioweergave; --trace schrijft elke showtoestand.
"$GODOT" --headless --path . -- --replay=local/sessions/NAAM.jsonl --fast --trace
```

Standaard: `local/sessions/<datum-tijd>-<uniek>.jsonl`; `--output=PAD` kiest een eigen
pad. Bestaande bestanden worden geweigerd. `--no-audio` slaat WAV-opname/weergave over.
Gebruik desgewenst een expliciet schrijfbaar absoluut outputpad. In exports ligt de
standaardmap naast de executable, op de Mac naast de `.app` (buiten de gesigneerde bundle).

Replay sluit live bronnen af en herstelt elk frame beide inputs. Gebruik de opgeslagen
`session.frame_dt` voor **alle** show-/rig-/camera-updates, ook bij snelle replay.
Realtime wacht op die duren; bij achterstand worden alle tussenliggende frames verwerkt.
Fast verwerkt precies diezelfde frames zonder wachten. Opnamen bewaren de seed
(standaard 1, instelbaar met `--seed=N`) en begininstellingen. Ook genre, safe,
showfaders en camerabediening worden per frame vastgelegd en bij replay hersteld.
Versie 2 bewaart ook de numerieke showinstellingen bitexact; versie 1 blijft leesbaar.
Zo beïnvloedt `local/live.json` een replay niet. Andere showversies kunnen andere looks kiezen.
De invoer wordt exact hersteld, geen nieuwe audioanalyse of OSC-interpretatie.
`R` stopt een opname; Escape en het sluiten van het venster sluiten JSONL en WAV af.
Begin een nieuwe volledige opname met `--record`. `tools/session.gd` blijft beschikbaar
als compatibele launcher; hij gebruikt nu dezelfde main in plaats van een eigen framelus.
Voeg bij replay `--check` toe voor automatische controles; zie [showcontroles](show-checks.md).

## Audio

Listen biedt dezelfde stereosamples aan recorder en analyse aan, vóór het dempen van
de input. De optionele sidecar is een gestreamde float32-stereo-WAV op de originele
mixfrequentie. Zonder binnenkomende samples ontstaat geen WAV (bijvoorbeeld alleen OSC).
Een audiofout stopt de statusopname niet. De afsluitregel meldt starttijd, sampleaantal,
samplefrequentie, verloren captures en fouten. Bij een samplefrequentiewissel of de
RIFF-limiet van circa 4 GB stopt alleen de audiokopie. Een geforceerd afgebroken proces
kan een onvolledig JSONL/WAV achterlaten; replay wijst onvolledige JSONL af.
Dit is de audio die Godot heeft ontvangen, zonder compensatie voor input-/outputlatency.

## Controle

```sh
"$GODOT" --headless --path . --script tools/test_session.gd
python3 tools/check_session.py --godot "$GODOT"
```

De eerste controle vergelijkt alle inputvelden bitexact, wisselende frame-duren,
eenmalige events, Unicode, deckwissels, OSC-inttypes, WAV-samples en corrupte invoer.
De tweede gebruikt de bestaande `stage-visualizer/tools/rekordbox-simulate.mjs`
met de testtrack, op een vrij gekozen lokale UDP-poort. Alleen in het geheugen wordt
zijn poort vervangen; de browserversie wordt niet gewijzigd. Hij neemt 12 seconden
op, speelt realtime en snel terug en vergelijkt elk showframe (beat, dt, tijd, deel,
frase, drop, titel en alle gekozen looks). Hij controleert ook audio, Up→Chorus en het verlopen van `live()`.
Deze proef heeft lokale UDP en PulseAudio nodig. Bewijs/logs staan in
`local/session-checks/`; de opname en WAV staan in `local/sessions/`.

Uitgevoerd op Linux met Godot 4.7.2 op 2026-10-26: **664 frames / 12,008 s**,
alle showtraces gelijk. Fast: 3,952 s; realtime: 12,061 s. WAV: 529.920 stereo-frames
op 44.100 Hz, geen gemelde verliezen/fouten. Logmap:
`local/session-checks/2026-10-26T15-05-17-800225/`. De normale headless-start en
`tools/test_session.gd` slagen ook. De normale zeer korte Dummy-audiostart kan bij
afsluiten een Godot ObjectDB-waarschuwing over vier Ogg-playbackobjecten geven;
in deze opname/replayproef waren er geen warnings of errors.

Na integratie in main opnieuw getest: 705 frames / 12,006 s, identieke traces inclusief
looks voor opname, realtime en fast. WAV: 529.408 frames op 44.100 Hz, geen verliezen.
Bewijs: `local/session-checks/2026-10-26T15-23-33-656244/` in de hoofdmap.

Laatste geïntegreerde proef (versie 2): **707 frames / 12,001 s**, identieke traces
in opname, realtime, fast én de nieuwe Linux-release vanuit `/tmp`. WAV: 528.384
frames, geen gemelde captureverliezen. Bewijs:
`local/session-checks/2026-10-26T15-35-57-405421/` en `local/builds/logs/linux-replay.log`.
