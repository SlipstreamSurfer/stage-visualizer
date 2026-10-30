# Builds

Godot **4.7.2 stable**, Python **3.11+** en de officiële exportsjablonen zijn nodig.
Alles blijft lokaal; de scripts uploaden niets.

```sh
export GODOT="$HOME/.local/opt/godot/Godot_v4.7.2-stable_linux.x86_64"
# Op de Mac: export GODOT=/Applications/Godot.app/Contents/MacOS/Godot
python3 tools/install_export_templates.py
tools/build.sh
```

De installer downloadt de standaard-TPZ en `SHA512-SUMS.txt` uit de
[officiële Godot-release](https://github.com/godotengine/godot-builds/releases/tag/4.7.2-stable).
Hij controleert de SHA-256 van beide downloads en de SHA-512 van de TPZ vóór uitpakken.
De vastgelegde TPZ-SHA-256 is
`f298490b8d44d934be425a5a65a51bf15f422428b229a06a6e11d9ffea248011`.
Cache: `local/downloads/`; op deze Linux-machine geïnstalleerd in
`~/.local/share/godot/export_templates/4.7.2.stable/`.
Op macOS gebruikt hij `~/Library/Application Support/Godot/export_templates/4.7.2.stable/`,
op Windows `%APPDATA%/Godot/export_templates/4.7.2.stable/`.
`--cache=PAD` en `--target=PAD` zijn optioneel; Godot zoekt standaard in de genoemde map.

Het buildscript controleert de editorversie, importeert resources en maakt drie release-exports:

| Preset | Bestand in `local/builds/` |
|---|---|
| Linux x86_64 | `linux/SV.x86_64` (ingebouwde PCK) |
| Windows x86_64 | `windows/SV.exe` (ingebouwde PCK, ongesigneerd) |
| macOS Universal (Metal) | `SV-macOS.zip` (arm64 + x86_64, ad-hoc gesigneerde app) |

De Mac-preset gebruikt Universal omdat de officiële templates alleen die binary bevatten;
de eerdere losse arm64-preset faalde bij echt exporteren. Zie de
[Godot-exportopties](https://docs.godotengine.org/en/4.7/classes/class_editorexportplatformmacos.html#class-editorexportplatformmacos-property-binary-format-architecture).
Beide Mac-architecturen vragen macOS 13+. Er is geen Developer ID/notarisatie.
De Windows-build gebruikt het standaardicoon (geen extra resource-editor nodig).
De appnaam is de projectnaam `Stage Visualizer`.

`SHA256SUMS` bevat de buildchecksums; `logs/` bewaart import-/exportlogs. Het script
stopt ook bij Godot-scriptfouten met exitcode 0. `local/.gdignore` houdt muziek,
sessies, downloads en builds buiten de importer. Testmuziek, docs en tools worden
niet meegeëxporteerd. `project.godot` is niet gewijzigd.

## Hier gecontroleerd (Linux, 2026-10-26)

Alle drie exports zijn echt gemaakt met `4.7.2.stable.official.ed1daf0bf`, zonder
warnings/errors in de exportlogs. Windows: PE x86_64-header gecontroleerd. Mac:
Universal-binary, uitvoerrechten, PCK, bundel-id, microfoontekst en aanwezigheid van
de ad-hoc-signatuurbestanden gecontroleerd. Dat is geen macOS-handtekeningvalidatie.

De Linux-build is vanuit `/tmp`, buiten de bronmap, headless gestart met:

```sh
/absoluut/pad/local/builds/linux/SV.x86_64 --headless --quit-after 60 -- --track=/absoluut/pad/local/track.ogg
```

Exitcode 0, geen script-/runtimefouten. Bij deze korte Dummy-audiorun meldt Godot bij
afsluiten vier achtergebleven Ogg-playbackobjecten (ObjectDB-waarschuwing); diezelfde
waarschuwing is ook in de editor/headless-bronrun gezien. Log: `logs/linux-smoke.log`.
Dit test geen GPU-rendering of prestaties.

Windows en macOS konden hier **niet worden uitgevoerd**. Nog op echte hardware te
testen: starten, Vulkan/Metal-beeld, geluid, inputrechten, loopback en echte Rekordbox.
Op de Mac ook Gatekeeper en handtekeningvalidatie. Zie [Mac-uitleg](mac.md) voor BlackHole
en rkbx_link. De sessieopties zijn aan main gekoppeld en werken ook in de nieuwe
exports; zie [sessies](sessions.md).

Na samenvoegen opnieuw gebouwd vanuit de hoofdmap op master (`9406925`). Import- en
exportlogs blijven vrij van warnings/errors. De Linux-release is vanuit `/tmp`
gestart met een versie-2-sessie: alle 707 showframes inclusief looks zijn gelijk
aan de opname, de replaycontroles slagen. Zie `logs/linux-replay.log`.
De normale GPU-start en M zijn ook op de GTX getest: een foto plus JSON-toestand
in `local/moments/`, screenshot in `local/integration.png`; geen fouten in
`local/visual-integration.log`. Windows en Mac blijven alleen pakketmatig gecontroleerd.

De choreografie-update (`f8c4e3f`) is opnieuw voor alle drie platformen gebouwd.
De Linux-release speelt de nieuwe opname van 16:09 vanuit `/tmp` af: alle 707
frames inclusief looks zijn identiek en de showcontroles slagen. De normale
headless-bestandsstart slaagt ook. Details van de nieuwe regie: [choreografie](choreografie.md).
