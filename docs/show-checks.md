# Automatische showcontroles

De normale app kan een opgenomen sessie controleren, zonder wachttijd of GPU:

```sh
"$GODOT" --headless --path . -- --replay=local/sessions/NAAM.jsonl --fast --check
# Optioneel een eigen rapportpad:
"$GODOT" --headless --path . -- --replay=local/sessions/NAAM.jsonl --fast --check --check-report=local/checks/proef.json
```

Exitcode 0 betekent dat de uitgevoerde controles slagen, 1 is een invoer-/bestandsfout,
3 betekent een gevonden showfout. Standaard staan rapporten in `local/checks/`.
Een rapport vermeldt ook **coverage**: een opname zonder drop bewijst geen droptiming;
voor variatie zijn minstens drie gekozen looks nodig. Dat wordt niet stilzwijgend als
volledig getest geteld. De controle beoordeelt gedrag, geen GPU-prestaties of muzikale smaak.

Gecontroleerd per frame:

- Een Listen-drop of een rekordbox-Chorus na break/build landt in hetzelfde inputframe.
- A→B→A-deelwissels met een uitstap korter dan acht beats worden gemeld. Track-/bron-/deckwissels resetten die historie.
- Hoogstens twee groepen leiden, hoogstens twee ondersteunen op maximaal halve sterkte.
  Het grotere dropbeeld mag één maat bij techno en twee maten bij andere genres duren.
- Opeenvolgende looks verschillen; bij minstens drie looks moeten er minstens drie verschillende zijn.
- Intensiteiten zijn eindig en niet negatief; richtpunten zijn eindig.
- Bij techno blijft buiten de dropopening minstens de helft van de volledige
  bezetting uit. Het rapport meet ook gemiddelde/maximale bezetting en rustframes.

## Reproduceerbare proeven

```sh
"$GODOT" --headless --path . --script tools/test_show_checks.gd
"$GODOT" --headless --path . --script tools/generate_session.gd -- --mode=listen --output=local/sessions/proef-listen.jsonl
"$GODOT" --headless --path . --script tools/generate_session.gd -- --mode=rekordbox --output=local/sessions/proef-rb.jsonl
# Speel beide bestanden af met --fast --check zoals hierboven.
```

Elke gecontroleerde set duurt 448 seconden (8.960 frames), met twee breaks/builds/drops
en langere stabiele passages. De generator maakt alleen inputs; hij roept Show niet aan.
De unitcontrole voert daarnaast expres een gemiste drop, te veel lichtgroepen,
deelgeflapper en herhaalde looks in en controleert dat elk wordt afgewezen.
`generate_session.gd --jitter --output=...` maakt een negatieve replayproef;
met `--seconds=24 --fast --check` eindigt die met code 3, deelgeflapper op frame 410.

Uitgevoerd op Linux, Godot 4.7.2 (2026-10-26):

| Bron | Frames | Drops verwacht/gezien | Verschillende looks | Fouten |
|---|---:|---:|---:|---:|
| Listen-fixture | 8.960 | 2/2 | 21 | 0 |
| Rekordbox-fixture | 8.960 | 2/2 | 20 | 0 |

De eerste rekordbox-proef vond dat het grote dropbeeld de hele Chorus buiten het
budget bleef staan: de frase-tak sloeg het terugschakelen na acht maten over.
Die afhandeling staat nu vóór de frase-tak. Dezelfde sessie slaagt na de reparatie.
Lokale bewijzen: `local/check-listen.log`, `local/check-rekordbox.log`,
`local/check-jitter.log` en de JSON-rapporten in `local/checks/`.
