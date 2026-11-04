# Booth, ronde 2

Per kant drie Kara II op één KS28, naast de tafel op de bestaande riser. De KS28 staat op zijn zijkant; de middelste Kara staat op 1,764 m boven de riser, vrijwel gelijk aan de DJ-oorhoogte van 1,72 m. Beide stapels richten hun voorkant naar de DJ-positie. De statiefmonitors zijn verwijderd.

| Kast | Breedte × hoogte × diepte | Bron |
|---|---|---|
| Kara II | 733 × 252 × 500 mm | [L-Acoustics Kara II](https://www.l-acoustics.com/products/Kara-ii/) |
| KS28 | 1340 × 550 × 719 mm; 90° om zijn vooras gedraaid | [L-Acoustics KS28](https://www.l-acoustics.com/products/KS28/) |

Het model gebruikt deze kastmaten, met losse runners, montageplaat en verbindingen. De grilles liggen binnen de genoemde diepte en vóór de terugliggende kastwand. De kastvormen zijn vereenvoudigde modellen.

De tafelromp eindigt onder het tafelblad. Speler- en mixerrompen eindigen onder hun bovenplaat; knoppen en het meterscherm liggen boven de plaat. De podiumvloer is één volume met één bovenkant op `Hall.DECK`, zonder extra dunne huid. De bestaande Hall-constanten zijn behouden.

Gecontroleerd met de gevraagde headless import/start en twee Forward+-renders vanuit schuin achter de booth. Geen script- of renderfouten. De headless Ogg-starttest meldt bij afsluiten vier vastgehouden Ogg-objecten; dit staat los van de booth.

# Booth, ronde 3b (2026-10-30)

Twee generieke **clubspelers (SV CDX-10)** naast een generieke **vierkanaals clubmixer (SV MX-4)**, op ware schaal (1 Godot-eenheid = 1 meter). Ze volgen de bekende indeling van clubapparatuur, zonder echte merk- of modelnamen. Matzwarte rompen, losse voeten en bovenplaten. De voorranden staan gelijk, met 18 mm vrije ruimte tussen de apparaten. Het tafelblad blijft op `Hall.TABLE = 3,05 m`, dus 1,05 m boven de bestaande riser.

| Onderdeel | Breedte × diepte × maximale hoogte | Model |
|---|---|---|
| Speler, 2× | 344,6 × 490,4 × 130,1 mm | Buitenmaat inclusief voeten en vaste schuine schermbehuizing |
| Touchscreen | 10,1 inch diagonaal | Actief glas 223,6 × 125,8 mm, 16:9; 20° boven horizontaal |
| Mixer | 407,4 × 458,3 × 107,9 mm | Inclusief voeten en hoogste bediening |

Maten en indeling volgen gangbare clubapparatuur: scherm achteraan, acht hotcues onder het scherm, jog centraal met lichtring, cue boven play linksvoor, lange tempofader rechtsvoor. De mixer heeft vier kanaalstroken met trim, drie EQ-banden en color, kanaalfaders en een crossfader; links mic, color FX en koptelefoon A; rechts master, booth EQ, koptelefoon B en beat FX. Hotcues, de jogring, de kanaal-cueknoppen en het beat-FX-scherm lichten zelf op. Een koptelefoon ligt naast de apparaten. Achteraansluitingen, kabels en kleine opschriften zijn vereenvoudigd.

## Livebeelden en deckkoppeling

`Hall` vindt zelf de bestaande `Rekordbox`-sibling en verwerkt diens reeds bijgewerkte velden op 20 Hz (`process_priority = 10`). Geen extra netwerkverbinding en geen main-koppeling nodig. Links, vanuit de DJ gezien, is altijd deck **1**; rechts deck **2**. Geen verwisseling bij een masterwissel en geen kopie van master op beide spelers.

Op ieder scherm staan eigen decknummer, titel (verkort), artiest, BPM, afspeeltijd en transportstatus. De bestaande procedurele SV-golfvorm blijft, met overzichtsstrook en playhead; met rekordbox volgt de golfvorm de beatpositie van het betreffende deck. Bij pauze staat die positie stil. Zonder verbinding blijft de oude audiogestuurde visualisatie beschikbaar, met `NO LINK` en gedoofde speelverlichting. **Dit is geen echte rekordbox-waveform of schermcapture:** de huidige rkbx_link-velden leveren geen golfsamples; de echte trackgegevens en transportstatus zijn wel gekoppeld.

Play-ring en jog-LCD lichten alleen op als dat deck speelt. `transport/playing` heeft voorrang; ontbreekt dat veld, dan geldt recent veranderde tijd/beatpositie als afspeelindicatie (0,6 s). Bij wegvallen van de verbinding gaan beide uit. Cue blijft zacht amber. Mixerstripmeters volgen zoals voorheen de live audio-energie; het zijn geen afzonderlijke audiokanalen. De Beat FX-bediening is een visuele reconstructie.

## Controle en foto’s

Godot 4.7.2, Forward+, GTX 1660 SUPER, 1920 × 1080, kwaliteit High:

- Camera 1, DJ-ogen (lokale foto): beide schermvlakken volledig in beeld en naar de DJ gericht; deck-/trackregels, golfvorm en status zichtbaar. De kleine hardwareopschriften zijn op deze afstand klein.
- Camera 2, over de schouder (lokale foto): beide spelers zichtbaar, mixer deels achter de DJ zoals vanuit dit standpunt verwacht. Camera en DJ-model ongewijzigd.
- De foto’s gebruiken **gesimuleerde rekordbox-velden**: deck 1 `LEFT DECK PAUSED`, 124 BPM; deck 2 `RIGHT DECK PLAYING`, 126 BPM met doorlopende tijd/beat. Controle op deckmapping, onafhankelijke play-/jogstatus, titels en verbindingsverlies geslaagd (`local/booth-linked.log`). Geen echte hardware aangesloten.
- Headless start met 60 frames en de bestaande Ogg-track geslaagd; alleen de eerder bekende vier ObjectDB-objecten bij Ogg-afsluiten. Forward+-runs geven geen script- of shaderfouten. `git diff --check` schoon.

Foto’s en de losse controle-driver staan onder het genegeerde `local/`; productiecode verandert alleen in `scripts/hall.gd` en de nieuwe `shaders/booth.gdshader` (plus Godots shader-UID). Main, show en UI zijn niet gewijzigd. Claude kan deze commit rechtstreeks samenvoegen.

## Festivalvariant: één mixer, vier spelers

Ook beschikbaar: **4 spelers + 1 mixer**, met twee spelers per kant. Dezelfde apparaten en schaal als hierboven; geen uitgerekte modellen. Van links naar rechts vanuit de DJ: **deck 1 · deck 2 · mixer · deck 3 · deck 4**. De totale apparatuurbreedte is 1857,8 mm, met 18 mm ruimte tussen alle buurapparaten. De bestaande tafel is breed genoeg; tafel, riser, monitors en camera’s blijven gelijk.

Start met `./start.sh -- --booth=festival` (ook `--booth=4`). De tweespelerversie blijft standaard, of kies `--booth=club` / `--booth=2`. `Hall.booth_decks` is daarnaast een geëxporteerde eigenschap met de waarden 2 en 4, zodat Claude later een keuze kan aansluiten zonder de booth om te bouwen. De CLI-keuze heeft voorrang. Er is in deze ronde geen UI-keuze of opgeslagen instelling toegevoegd.

Alle vier spelers volgen uitsluitend hun eigen rekordbox-deck. De mapping blijft gelijk bij een masterwissel. Schermen, jog-LCD’s en play-ringen werken onafhankelijk voor decks 1–4. Alleen ontbrekende deckvelden blijven leeg; de master wordt niet naar een ontbrekend deck gekopieerd.

Gecontroleerd met dezelfde Forward+-instellingen en gesimuleerde rekordbox-data: binnenste decks 2 en 3 spelen, buitenste decks 1 en 4 staan stil. Vier eigen titels en transportstatussen, een masterwissel en verbindingsverlies slagen zonder script-/shaderfouten (`local/booth-festival.log`).

- Festival, camera 1 (lokale foto): alle vier schermen volledig zichtbaar, inclusief de buitenste spelers.
- Festival, camera 2 (lokale foto): vier spelers rond de mixer, over de DJ-schouder.

## Flightcase-afwerking

De bestaande tafel heeft metalen randprofielen, hoekbescherming, paneelstijlen, handgrepen en klinknagels.
Vereenvoudigde stekkers achter de spelers en mixer lopen via kabels naar één zijkant van de booth. Het is geen
poortgetrouw aansluitschema. Apparaten, tafelhoogte, 18 mm tussenruimtes en rekordbox-koppeling blijven ongewijzigd;
de afwerking werkt met twee en vier spelers.

De detailgeometrie gebruikt drie statische MultiMesh-batches zonder schaduwen: `BoothTrim`, `BoothHardware` en
`BoothCables`. Er zijn geen extra lampen of updates per frame. `tools/test_stage_detail.gd` controleert de batches,
eindige transformaties, plaatsing, tafelhoogte en tussenruimtes in beide boothvarianten.
