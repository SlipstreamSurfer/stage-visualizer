# Rekordbox-ontvangst controleren

De ontvanger controleert OSC-berichten voordat hij de bronwaarden bijwerkt. Een
afgebroken floatbericht veroorzaakte eerder een scriptfout en kon alsnog `0 BPM`
opslaan. Een string werd ook als BPM opgeslagen. Beide gevallen worden nu genegeerd.
Alleen een pakket met ten minste één herkend, geldig rekordbox-veld vernieuwt de
live-status en telt mee in `packets`. Ongeldige of onbekende berichten kunnen de
terugval naar audioanalyse na 1,5 seconde dus niet meer tegenhouden.

De bestaande enkelvoudige OSC-types blijven ondersteund: float32 (`f`), int32 (`i`)
en string (`s`). Integerfrases blijven integers; stringfrases en UTF-8-tracktitels
blijven intact. Getallen moeten eindig zijn en bij het veld passen. Negatieve
trackposities en de `-1`-sentinel voor ontbrekende phrase-countin blijven toegestaan.
Bundles worden in volgorde gelezen. Een structureel beschadigde bundle wordt
helemaal overgeslagen, zonder de eerder gelezen velden uit die bundle toe te passen.
De limieten zijn acht bundle-niveaus en 256 berichten per pakket.

Het pakketformaat volgt de [OSC 1.0-specificatie](https://opensoundcontrol.stanford.edu/spec-1_0.html);
de gebruikte adressen en frasetypes komen uit de
[rkbx_link-documentatie](https://github.com/grufkork/rkbx_link#all-osc-messagesaddresses).
De veldselectie sluit aan op `stage-visualizer/tools/rekordbox-bridge.mjs`.

## Uitvoeren

Vanuit de projectmap, met Godot 4.7.2:

```sh
GODOT="$HOME/.local/opt/godot/Godot_v4.7.2-stable_linux.x86_64"
# Pakketdecoder: normale berichten, bundles, corrupte invoer en willekeurige bytes.
"$GODOT" --headless --path . --script tools/test_rekordbox.gd
# Ook echte UDP-ontvangst op een vrije lokale poort, time-out en opnieuw verbinden.
"$GODOT" --headless --path . --script tools/test_rekordbox.gd -- --udp
# Bestaande controles voor opname/replay en audioanalyse.
"$GODOT" --headless --path . --script tools/test_session.gd
"$GODOT" --headless --path . --script tools/test_listen_ear.gd
# Volledige proef met de bestaande lokale simulator en een eigen testtrack.
python3 tools/check_session.py --godot "$GODOT" --track=/absoluut/pad/track.ogg
```

De UDP-proef gebruikt alleen loopback en vraagt geen draaiende Rekordbox of rkbx_link.
De laatste proef vereist lokale UDP en PulseAudio; hij vergelijkt iedere showframe
van de opname met realtime en snelle replay. Gebruikersinstellingen blijven daarbij
gescheiden via `local/test-home/` en `local/test-config/`.

## Getest op Linux (2026-10-30)

In de afzonderlijke Codex-worktree, gebaseerd op `70c702e`:

- Pakketdecoder en UDP: **4.159 controles, nul fouten**, inclusief 2.000 willekeurige
  datagrams, foutieve UTF-8, niet-eindige floats, corrupte bundles en opnieuw verbinden.
- Bestaande sessie-roundtrip: **nul fouten**; OSC-inttypes blijven exact bewaard.
- Bestaande FFT-proef: **nul verschil** met de directe DFT en tussen audioblokken.
- Volledige simulatorproef: **707 frames / 12,001 seconde**; alle showtraces zijn
  gelijk in de opname, realtime replay en snelle replay. WAV: 531.456 stereoframes
  op 44.100 Hz, geen gemelde captureverliezen of audiofouten.

De headless realtime-replay geeft bij afsluiten wel een Godot-waarschuwing over twee
achtergebleven ObjectDB-objecten. De proef eindigt met code 0 en identieke traces;
de overige genoemde tests en de script-import melden geen warnings of errors.
De oorzaak van die afsluitwaarschuwing is in deze wijziging niet onderzocht.

Bewijs staat lokaal in `local/rekordbox-before.log`, `local/rekordbox-after.log`,
`local/rekordbox-udp.log`, `local/session-unit.log` en `local/listen-unit.log`.
De volledige simulatorproef staat in
`local/session-checks/2026-10-30T12-41-32-620102/` met opname in `local/sessions/`.
Dit controleert de ontvanger en simulator op Linux; echte Rekordbox en de ontvangst
op Windows en macOS zijn hiermee niet getest.

Voor samenvoegen is alleen `scripts/rekordbox.gd` bestaande productiecode gewijzigd;
de regressietest en dit document zijn nieuw. Claudes lichtregie en de gedeelde
`main.gd` zijn hierbij niet aangepast.
