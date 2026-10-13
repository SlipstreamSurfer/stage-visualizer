# Stage Visualizer op macOS

1. Installeer Node.js 24 LTS of nieuwer en gebruik Chrome of Edge.
2. Download de repo, pak hem uit en dubbelklik op **Start-SV-Mac.command**.
   Via Terminal kan ook: ga naar de map en voer `npm start` uit.
3. Open <http://127.0.0.1:8765/>. De show begint met een stille demo.
4. Kies **Audio file** en laad een track, of kies **Audio input** voor live-audio.

## DJ-audio met BlackHole

Installeer BlackHole 2ch. Maak in Audio/MIDI-configuratie een multi-output-
apparaat met je koptelefoon en BlackHole. Gebruik de koptelefoon als primaire
klok en zet driftcorrectie op BlackHole aan. Gebruik voor beide dezelfde
samplefrequentie als in je muzieksoftware.

Kies dit multi-output-apparaat als audio-uitvoer in je muzieksoftware. Selecteer
in SV **Audio input → BlackHole 2ch** en klik **Connect audio input**. Geef de
lokale SV-pagina de gevraagde microfoontoestemming. De invoermeter hoort op de
muziek te reageren. Verbind de audio opnieuw na sluiten of herladen van SV.

Bij gekraak kan een grotere buffer in de muzieksoftware helpen; de passende
instelling hangt af van je audioapparaat en gewenste vertraging. De app bevat
geen persoonlijke apparaatconfiguratie of voorbereide DJ-softwarekopie.

## Als starten niet lukt

- **Node.js ontbreekt:** installeer Node.js en open de Terminal opnieuw.
- **Poort bezet:** stop een eerdere SV-server met Control-C en probeer opnieuw.
- **Connected · no audio detected:** controleer of de muziek speelt en of de
  juiste audio-uitvoer en invoer zijn geselecteerd.
- **Browser vraagt toestemming:** sta de gewenste audio-invoer toe voor je
  lokale SV-pagina; kies daarna expliciet het juiste apparaat.

De app draait lokaal. Muziek, opnames en afspeelnotities horen niet in de repo.
