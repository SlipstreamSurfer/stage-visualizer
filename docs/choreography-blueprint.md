# Blauwdruk voor ieder AI-model dat aan SV-choreografie werkt

Lees dit document vóór het ontwerpen of wijzigen van patronen. Lees daarnaast `AGENTS.md`, `docs/pattern-design.md`, `docs/show-variation.md` en de actuele code. Dit document is onafhankelijk van een model of leverancier. De lokale gebruikersinstellingen en nieuwe expliciete opdrachten gaan voor op aannames in oudere documentatie.

## Actueel herstelvoorstel

Lees ook [het volledige voorgestelde herstelplan voor SV](sv-recovery-plan.md). Dit behandelt bronkeuze, regie, comfort, geometrie, roof spots, pixelbars, scherm, UI, prestaties en acceptatie. Het is een voorstel voor beoordeling, geen toestemming om alle fasen direct uit te voeren.

## Doel: een samenhangende show

SV is een lichtshow in één zaal. De basis bestaat uit leesbare ruimtelijke figuren, bewegingen, muziekgebonden opbouw, rust en contrast. Nieuwe effecten vergroten het vocabulaire van de show. Ze horen niet automatisch op iedere scène of ieder armatuur te worden toegepast.

Beoordeel steeds de hele zaal en meerdere minuten muziek. Een losse mooie chase maakt een doorlopende serie chases nog geen goede show. Het vervangen van de gewone choreografie door voortdurend sequencen is een regressie, ook als de afzonderlijke patronen technisch correct zijn.

De huidige programmeerrichting is een ruime meerderheid gewone choreografie, afgewisseld met beperkte episodes. De meetbare ondergrens is 75% basis in langere testscenario's; de huidige voorbeelden zitten rond 80–90%. Deze percentages zijn ontwikkelcontroles, geen artistieke garantie en geen toestemming om de overige tijd voortdurend te flitsen. Een langere speciale passage kan goed werken, mits er voldoende gewone choreografie en rust omheen staat.

## Samenhang en comfort

- Behoud de lopende kleuren, muzikale sfeer en ruimtelijke intentie wanneer een accent binnenkomt. Introduceer niet ongemerkt een eigen witte/ijskleur of een plotselinge donkere zaal.
- Laat ondersteunende delen hun rol behouden. Een sequencer mag één deel van de rig bespelen terwijl de andere delen hun figuur voortzetten.
- Gebruik aan/uit-selectie doelgericht. De basis hoeft niet op iedere kick grote groepen hard te schakelen.
- Geef rust, aangehouden figuren en langzame ontwikkelingen voldoende tijd. Variatie is geen opdracht om alles tegelijk te veranderen.
- Bewaak het zicht naar booth, achterrig en andere figuren. Een permanent gordijn van podiumbundels kan het overige ontwerp onzichtbaar maken.
- Respecteer de lokale lichttafelstanden. Een beoordeling bij weinig washlicht en een uitgeschakelde podiumrij mag niet worden geïnterpreteerd alsof die groepen vol aanstonden.
- De rustige stand start geen automatische strobes of snelle sequencer-episodes. Gebruik zachte overgangen, beperk kickmodulatie en houd LED-balken rustiger. Dit is een comfortinstelling, geen medische veiligheidsclaim.

## Ontwerpkaart voor ieder nieuw patroon

Beschrijf vóór implementatie:

1. Het ruimtelijke idee en de muzikale functie in één zin.
2. Welke groepen dragen het idee, welke ondersteunen het en welke blijven hun bestaande choreografie doen.
3. Begin, ontwikkeling, eventuele varianten en einde.
4. Duur in maten en seconden, minimale tussenruimte en beoogd aandeel in een langere show.
5. Welke muzikale omstandigheden het toelaten of juist onderbreken.
6. Hoe kleur, richting en intensiteit aansluiten op de lopende scène.
7. Wat echt nieuw is wanneer alle uitvoeringen dezelfde kleur krijgen.
8. Hoe de rustige stand, blackout, groepsfaders, master en een trackwissel werken.
9. Welke bestaande figuren en zichtlijnen beschermd moeten blijven.
10. Hoe het patroon afzonderlijk én als deel van een langere show wordt beoordeeld.

## Concrete richtingen en grenzen

**Bliksem:** een zwervend lokaal accent op de actieve scène. Behoud kleuren en richtingen. Donkere armaturen hoeven niet plotseling te worden aangezet. Laat de bestaande groove niet verdwijnen voor een losstaande demonstratie.

**Depth chase:** een leesbare reis van podium naar achteren waarbij hele armaturen of rijen elkaar opvolgen. De passage mag meerdere frases duren en intern ontwikkelen: gelijklopende golf, versprongen kolommen, echo's en variërende pulsverdelingen. Verander het hoofdidee daarbij niet voortdurend. Zet dit incidenteel in, met ruime tussenstukken gewone choreografie.

**Sequencer:** het primaire begrip is armaturen die ruimtelijk in een bepaalde volgorde aan en uit gaan. Pulsjes of pixels binnen steeds dezelfde bundel zijn een afzonderlijk detail. Zo'n detail vervangt de volgorde tussen lampen niet. Laat een nieuwe sequencer niet standaard over de volledige bestaande show lopen.

**Light rain:** verwijderd uit de actuele show. Niet opnieuw invoeren als automatische variant of vervanging voor de rustige stand zonder een nieuwe opdracht.

## Leren van debugfeedback

De debugfunctie wordt expliciet aangezet met `--debug-feedback`. Zonder die optie worden de bediening en het geschiedenisbuffer niet aangemaakt.

- F7: markeer goed.
- F8: markeer kan beter.
- F6: wijzig de laatste markering, kies 5/15/30/60 seconden en voeg optioneel tekst toe.
- De markering slaat meteen op; de toelichting blijft aan het oorspronkelijke tijdvenster gekoppeld.
- Bestanden staan lokaal in `user://feedback`, in Godots appgegevensmap voor Stage Visualizer. Kopieer materiaal voor onderzoek alleen naar genegeerde lokale werkbestanden.

Een JSON-bestand heeft `kind: sv_show_feedback`, `schema: 1`, een versie/build, waardering, gevraagd en werkelijk beschikbaar tijdvenster, optionele toelichting en diagnostische samples. De samples bevatten onder meer scène en figuur, bewegingsstack, zaalcompositie, actief accent, kleuren, muziekfase, BPM, energie, camera, rustige stand en lichttafelstanden. Ze worden ongeveer tienmaal per seconde genomen. Er wordt geen audio of video opgenomen. Dit is context voor onderzoek, geen exacte sessiereplay of volledige weergave van iedere snelle lichtstap.

Behandel feedback als observaties:

1. Lees eerst de toelichting en de volledige geselecteerde context.
2. Maak onderscheid tussen het patroon zelf, frequentie, duur, overgang, kleur, helderheid en samenhang.
3. Een positieve markering zegt zonder toelichting niet welk onderdeel goed was. Een negatieve markering betekent niet automatisch dat ieder patroon in dat venster moet verdwijnen.
4. Vergelijk meerdere markeringen, versies, muziekfasen en lichttafelstanden. Geef aan wat je niet uit de gegevens kunt afleiden.
5. Pas gericht iets aan. Verander niet alle scènes omdat één effect als mooi werd gemarkeerd, en vergroot niet automatisch het tijdsaandeel van dat effect.
6. Bewaar ook wat goed werkt. Beoordeel of een correctie elders regressies veroorzaakt.

Feedback is privé, blijft lokaal en wordt niet automatisch verzonden, gecommit of als trainingsdata verwerkt. De bestaande projectregel tegen persoonlijke feedback in commits blijft gelden.

## Werkvolgorde en overdracht

1. Controleer de branch, de lokale wijzigingen, de laatst beoordeelde versie en de bestaande lokale feedback. Draai niet blind terug en overschrijf geen gebruikersinstellingen.
2. Vat de concrete verandering en de onderdelen die behouden moeten blijven samen.
3. Implementeer een beperkte samenhangende wijziging. Meet het effectaandeel over langere tijd en voorkom gestapelde effecten zonder gezamenlijke regie.
4. Draai de relevante controles en de releasecontroles. Gebruik meerdere genres en muziekfasen, plus de rustige stand en de ingestelde groepen. Verlaag geen kwaliteitsgrens om een ongewenste dominantie van effecten te accepteren.
5. Bekijk het resultaat vanuit booth en publiek. Losse screenshots en slagen van tests bewijzen geen aangename choreografie; beoordeel ook overgangen en verloop in de tijd.
6. Zet een gewone lokale kandidaatversie klaar om te beoordelen. Debugfeedback is optioneel; voeg niet voor elk nieuw patroon standaard een aparte testknop aan de normale app toe.
7. Publiceer pas na expliciete goedkeuring. Beschrijf wat gebouwd en getest is, wat nog een menselijke beoordeling vraagt en waar de lokale kandidaat staat.
8. Werk deze blauwdruk en de gerichte patroondocumentatie bij met generieke ontwerpbeslissingen. Houd persoonlijke observaties en markeringen buiten openbare commits.

Huidige ingangen: `scripts/show/director.gd` voor de basis, `scripts/show/gestures.gd` voor incidentele episodes, `scripts/show/sequencer.gd` voor ruimtelijke selectie, `scripts/show/phrasing.gd` voor de zaalverdeling en `scripts/show_feedback.gd` plus `scripts/feedback_panel.gd` voor debugfeedback. `tools/build.sh --test-only` draait de volledige set controles.
