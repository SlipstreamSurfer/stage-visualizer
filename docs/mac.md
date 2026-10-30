# SV op de Mac

## Bouwen en starten

Gebruik Godot **4.7.2** met de bijbehorende exporttemplates (Editor → Manage Export Templates).
De preset **macOS Universal (Metal)** exporteert `arm64` én `x86_64`, met een lokale
ad-hoc-handtekening en toestemmingstekst voor audio-input. De officiële templates bevatten
alleen Universal; de eerdere arm64-preset bleek bij echt exporteren niet bruikbaar.
Hij gebruikt Forward+; Godot 4.7 kiest op macOS standaard Metal. Zie de
[Godot-driverinstellingen](https://docs.godotengine.org/en/4.7/classes/class_projectsettings.html#class-projectsettings-property-rendering-rendering-device-driver-macos)
en [macOS-export](https://docs.godotengine.org/en/4.7/tutorials/export/exporting_for_macos.html).

**Import ETC2 ASTC** staat inmiddels aan in `project.godot`. Laat Godot vóór export
de assets opnieuw importeren. Bouwinstructies voor alle platformen staan in [builds.md](builds.md).

Voer vanuit de projectmap uit, op de Mac:

```sh
GODOT=/Applications/Godot.app/Contents/MacOS/Godot
export GODOT
python3 tools/install_export_templates.py
tools/build.sh
cd local/builds
unzip -o SV-macOS.zip
```

Open de uitgepakte `.app`. Of ga terug naar de projectmap en start vanuit de bron, met Metal expliciet gekozen:

```sh
cd /pad/naar/sv-godot
GODOT=/Applications/Godot.app/Contents/MacOS/Godot
"$GODOT" --path . --rendering-driver metal -- --quality=normal
```

Opties voor de uitgepakte app kunnen ook via `open -n /pad/naar/SV.app --args -- --quality=normal`.
Gebruik de werkelijk uitgepakte appnaam. `P` opent instellingen; `--genre=house` gaat bij starten
voor op de bewaarde genrekeuze. Testmuziek wordt niet meegeleverd: gebruik een absoluut pad
bij `--track=/pad/naar/track.ogg`.

## Systeemaudio via BlackHole

Installeer [BlackHole 2ch](https://github.com/ExistentialAudio/BlackHole).
Maak in Audio MIDI Setup een **Multi-Output Device** met je speakers/interface en BlackHole.
Gebruik de fysieke uitgang als klok en zet driftcorrectie aan voor de andere uitgang;
geef beide dezelfde samplefrequentie. Kies dit apparaat als systeemuitgang, zodat de muziek
hoorbaar blijft en ook naar BlackHole gaat. Volg zo nodig de
[BlackHole-handleiding](https://github.com/ExistentialAudio/BlackHole/wiki/Multi-Output-Device).

Kies in SV bij `P` **System audio** of **System audio + rekordbox**, met **BlackHole 2ch** als
Audio input. Automatische detectie zoekt ook naar BlackHole. Geef Godot/SV microfoontoegang
wanneer macOS dat vraagt; controleer anders Privacy & Security → Microphone. BlackHole is de
input, het Multi-Output Device de output. Begin met 80 ms Audio delay en stel op gehoor/beeld bij.

## Rekordbox via rkbx_link

Download de Apple Silicon-versie van [rkbx_link](https://github.com/grufkork/rkbx_link).
Mac-ondersteuning is experimenteel; controleer daar of jouw exacte Rekordbox-versie wordt
ondersteund. Open in SV **Settings → Rekordbox**, of kies **Rekordbox connection…** in Source.
Kies **This computer** voor dezelfde Mac (`127.0.0.1`), of **Another computer**
voor rekordbox op een ander apparaat. SV toont zijn netwerkadres en maakt de OSC-regels.
Kopieer ze of sla ze op, en voeg ze samen met het bestaande `config` naast rkbx_link.
Kies daarin zelf de juiste `keeper.rekordbox_version` en `keeper.decks`; start rkbx_link opnieuw.
Zie [Rekordbox stap voor stap](rekordbox.md).

SV vraagt string-uitvoer voor frases en schakelt timing en frases voor master en losse decks in.
Kies **System audio + rekordbox** voor BlackHole plus timing/frases, of **Rekordbox** voor
alleen OSC. rkbx_link stuurt geen audiostream. Laat inkomende verbindingen voor SV toe
wanneer macOS dat vraagt; controleer anders **Systeeminstellingen → Netwerk → Firewall → Opties**.
Gebruik op dezelfde Mac één SV-instantie per UDP-poort.

## Nog op de Mac controleren

Hier beschikbaar: Linux, geen Mac. De officiële templates zijn nu geïnstalleerd en de
Universal-macOS-export is op Linux gebouwd en op pakketstructuur gecontroleerd. Gatekeeper,
de handtekeningcontrole op macOS, audio-toestemmingsdialoog, BlackHole-routing, rkbx_link
met echte Rekordbox en de Metal-rendering/prestaties zijn nog niet op hardware getest.
De lokale preset is voor eigen gebruik; distributie met Developer ID/notarisatie vraagt een
aparte configuratie. Controleer na export vooral haze op Normal/High, telefoons in een break,
en een langere sessie met audio en OSC.
