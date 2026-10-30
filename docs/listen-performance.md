# Listen: minder werk voor dezelfde herkenning

De FFT verwerkt nu twee reële samples als één complex paar. Een complex transform
van 1024 punten plus conjugaatreconstructie vervangt het eerdere transform van 2048
punten. Blackman-venster, alle frequentiebins, smoothing, RMS, sampleklok en de
60-Hz-analyse blijven gelijk. Er is geen lagere analysefrequentie of native dependency;
dezelfde GDScript-code werkt op Linux, Windows en Mac.

Gemeten op deze Linux-machine (Godot 4.7.2, 2026-10-26): de losse Ear-proef met
12 seconden samples kostte vóór de wijziging **3803,6 ms**, daarna **2210,7 ms**:
ongeveer **42% minder rekentijd**. Dit is een CPU-proef, geen frameratemeting op de Vega.

De volledige drie opnamen zijn opnieuw door de browserreferentie en Godot gehaald.
Alle 41 gebeurtenissen vallen nog steeds op dezelfde tijd, en BPM, delen, kicks,
density en build voldoen aan dezelfde vergelijking. De headless looptijden gingen
van 62,5/64,7/70,7 naar 37,0/38,3/42,0 seconden (parallel gedraaide proeven, dus
afhankelijk van overige systeembelasting). Zie [de volledige vergelijking](listen-vergelijking.md).

`tools/test_listen_ear.gd` controleert de FFT onafhankelijk met een directe DFT op
geselecteerde bins, inclusief DC en hoogfrequent geluid, RMS en verschillende
chunkgrenzen op 44,1 en 48 kHz. Eenmalig is ook de oude FFT naast de nieuwe gedraaid:
bandwaarden binnen 1e-14, dezelfde RMS en analysetijden.

```sh
"$GODOT" --headless --path . --script tools/test_listen_ear.gd
python3 tools/compare_listen.py
```
