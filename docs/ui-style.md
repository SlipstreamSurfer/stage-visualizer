# Gedeelde schermstijl

`UiStyle.theme() -> Theme` is de ene stijl voor alle schermen. Zet hem op de buitenste
`Control`; kinderen erven het thema. Ook `CanvasLayer`-schermen krijgen een `Control`
als buitenste element. Geen globale projectwijziging nodig.

```gdscript
root_control.theme = UiStyle.theme()
heading.theme_type_variation = "Title"
subtitle.theme_type_variation = "Subtitle"
hint.theme_type_variation = "Hint"
start_button.theme_type_variation = "PrimaryButton"
```

Atkinson Hyperlegible: gewone tekst en knoppen 24 px, korte hulptekst 20 px,
tussenkop 30 px, schermtitel 44 px. Maten gelden voor een 1920×1080-viewport;
schaal de hele UI mee op andere resoluties via `UiStyle.configure_window(window)`.
Die schaalt op hoogte en houdt minimaal 960 logische pixels breed, zodat tekst ook
in een smal venster groot blijft. Geen individuele tekst kleiner maken.
Focus krijgt een zichtbare mintkleurige rand. Knoppen zijn minimaal 60 px hoog.
Tekst blijft kort en in het Engels. Escape gaat één scherm terug.

Optionele helpers:

- `UiStyle.label(text, variant = "") -> Label`
- `UiStyle.button(text, primary = false) -> Button`
- `UiStyle.screen(canvas_layer, opacity = 0.78) -> Control`: schermvullende root met
  het thema en een donkere achtergrond boven de doorlopende zaal.
- `UiStyle.box(color, border = Color.TRANSPARENT, padding = 16, width = 1) -> StyleBoxFlat`

Kleuren zijn beschikbaar als `UiStyle.TEXT`, `MUTED`, `ACCENT`, `WARNING`, `PANEL`,
`SURFACE` en `BORDER`. Gebruik tekst naast een kleur voor succes of een probleem.
