# Choreografie: de regie van SV in de browser

Besluit (2026-10-30): de browserversie van SV is het fundament. De sobere
choreografie van 26 oktober (4,6% van de lampen aan bij techno) voelde als een lege zaal.
De regie is daarom één-op-één overgezet uit de browserversie (`src/` van v0.40.1):

| browser | Godot |
|---|---|
| `director.js` (moods, programma's, scènes, kleuren, washes, bars, strobes, blinders) | `scripts/show/director.gd` |
| `hangar-looks.js` (25 head-looks, 15 truss-formaties, 9 podiumrij-looks, stijl per genre) | `scripts/show/looks.gd` |
| `signals.js` (kick, accent, drop, lift, hype, energie) | `ShowDirector._signals()` |
| `rig-motion.js` (takels) | `Rig._winch()` |

## Hoe de Godot-rig de browserrollen speelt

- **overhead** (hall-heads): de vijf hall-trussen (rij 0–4), de truss achterin (rij 5), de zijtorens (rij 6).
- **stage**: de torens achter de DJ, de delay-torens en de spots in het podiumdak (programma-aim).
- **row** (podiumrij): de beams langs de voorrand van het podium.
- **wash**: alle washes. **bars**: alle battens; ze flitsen ook als strobe.
- Trussen: elke hall-truss heeft een eigen takel (omhoog 1,1 m/s, omlaag 0,42 m/s, nooit lager dan 5,5 m).
- Genres: de 36 Beatport-genres wijzen naar SV's moods (`MOOD_OF`). Raw/Deep/Hypnotic techno → `raw`.

## Wat bewust anders is

- Helderheid: de browser rendert `dim` met een eigen belichting; hier gaat het door een zachte knik
  (`1 − e^(−3,5·I)`), zodat groove-niveaus als licht lezen en de volgorde rustig < groove < drop blijft.
- Met alleen rekordbox zijn er geen banden: bas en kick worden gemaakt uit de beat. In een break telt
  rekordbox geen kicks (een break heeft geen kick), zodat scènes niet halverwege een break wisselen.
- Niet overgenomen (bestaat niet in deze zaal): LED-wand, ringen, bogen, dak-LED, lasers (staan uit), effecten.

## Controle

- `tools/test_choreography.gd`: zeven genres, twee drops. Eis: gemiddeld ≥ 30% van de rig aan,
  geen zwarte zaal buiten een break, minstens drie looks. Gemeten: 53–84%, 17–19 looks.
- `--replay=… --fast --check`: droptiming, deelgeflapper, variatie, geldige waarden, en "dark":
  vier seconden zwart in een groove of piek is een fout. Beide sessies slagen.

## Lichtsequencer (alleen Techno Raw / Deep / Hypnotic)

`scripts/show/sequencer.gd` is een stap-sequencer op het maatraster. Een maat heeft 4 slagen en 16 stappen.
De show speelt in **blokken van 4, 8, 16 of 32 maten** (de lengte hangt af van het deel van het nummer; de blokken van
een deel wisselen elkaar af). Een blok houdt één patroon per baan vast en wisselt alleen op de eigen maatlijn; het
laatste kwart van een blok is een *fill*: hetzelfde patroon met extra hits.

| Baan | Wat |
|---|---|
| 0 | hall-heads in het midden |
| 1 | hall-heads aan de zijkanten |
| 2 | stage-heads (torens, podiumrij) |
| 3 | de balken (battens) |

Een hit zet de baan even op vol licht; tussen de hits zakt ze naar 55% (diepte 45%). Met zachte strobes (`S`) zijn het
alleen kwartnoten en is de diepte 20%. Nooit twee hits op naastliggende stappen: de snelste baan speelt achtste noten.
Alles volgt uit getallen (baan, blok, maat), niet uit toeval, dus een replay speelt hetzelfde. Een nieuw blok is een
nieuwe scène; een blok van 16 of 32 maten wisselt look en stack elke 8 maten, het patroon pas aan het eind.
Het raster is `show.beat`: exact met rekordbox, bij systeemaudio zo goed als de maatlijn (`bar_offset`, toets `T`).

Daarnaast heeft dit genre: zes extra head-looks (Lanes, Horizon, Cathedral, Searchlights, Pendulum, Stairs; een 8e
element in `HEAD_LOOKS` houdt ze buiten elke andere stijl en terugvallijst), twaalf bewegingen, twaalf gates, tien
kleurverdelingen, zes beams en zestien paletten van drie of vier kleuren. Het mikpunt blijft binnen de hal.
Controle: `tools/test_sequencer.gd` (patronen, looks, gates, kleuren) en `tools/test_choreography.gd`.
