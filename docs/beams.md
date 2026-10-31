# Beams, haze and the room

How SV draws its light, after real fixtures and how haze shows them (R&D, 0.51).

## Beam angles

| Kind in SV | After | Real zoom range | SV core at zoom 1 | With the show's zoom |
|---|---|---|---|---|
| Beam | Robe MegaPointe (beam mode) | 1.8–21° | 5.2° | about 3.6–10° |
| Spot | Robe BMFL | 5–55° | 12° | about 8–24° |
| Wash | Martin MAC Aura XB | 9–59° | 30° | about 20–60° |

For comparison, a Clay Paky Sharpy is 0–3.8°. Before 0.51 every beam in SV was 3.2°: the width of a Sharpy, in a
hall that hangs hybrid heads, which made the beams read as thin lines.

## A beam in haze

- **Core and halo.** Haze scatters light out of the beam, so it shows as a bright core with a soft glow around it,
  wider than the beam angle. The cone mesh is the core's width times `halo`; across it the light falls from a hot
  centre through the core's edge into the halo.
- **Along the beam.** Seen from the side, a beam is as bright as its light is dense over the line of sight:
  flux over width. A narrow beam carries through the hall, a wide one fades with distance. The haze takes a little
  on the way (extinction over about 95 m).
- **Forward scattering.** Haze throws more light on along a beam than sideways or back (Henyey-Greenstein,
  g = 0.3, capped at 4×). A beam aimed towards you glows; from behind the fixtures it is dimmer.
- **The lens.** The front glass is drawn bright enough for bloom to make it flare.

## Haze fader

The light desk (**D**) has a Haze fader from 0 to 200%; 100% preserves the original setting. `tune.haze` scales the
existing global fog density, all five local volumes (including the negative roof density) and the beam shader's
`sv_haze`. Repeated adjustments always use the original densities, so they do not compound. Light levels, ambient
lighting and the fog grid resolution are unchanged; extra haze does not amplify the room's fog-emission term.
At zero, fog density, beam scattering and fog emission are all zero. Visible lenses and light falling on surfaces
remain; this is not blackout.

Low and Light still disable volumetric fog. The fader affects drawn beam haze there, and the desk explicitly shows
**Beams only**. Quality changes update that notice. Values last for the run and are included in session controls;
older controls without `haze` use 100%. `tools/test_haze.gd` checks the real main-loop path, original-density scaling,
input bounds, zero emission, UI values and independence from light-group resets.

## The room

As in SV's browser version (`director.room`): the show's colour and level light the hall's surfaces a little and
make the haze glow (`main.gd` `_room`), capped so a drop does not turn on the house lights. Strobes and blinders
light the room through their own lamps.

## Cost

GTX 1660 SUPER, 1080p, GPU time: Light 2.7 → 3.1 ms, High 13.7 → 15.3 ms. Light is limited by the processor
(the show and the listening), not by the GPU.

## Sources

- Clay Paky Sharpy: [product page](https://claypaky.it/products/sharpy), [datasheet](https://goknight.com/content/documentation/Sharpy_Datasheet_08.2023.pdf)
- Robe MegaPointe: [leaflet](https://www.robe.cz/res/downloads/catalogues/ROBE_MegaPointe_leaflet.pdf)
- Martin MAC Aura XB: [spec sheet](https://media.musson.com/mti/docs/m/a/mac-aura-xb.pdf)
- Godot volumetric fog: [documentation](https://docs.godotengine.org/en/4.3/tutorials/3d/volumetric_fog.html)
- Light shafts in real time: [GPU Gems 3, chapter 13](https://developer.nvidia.com/gpugems/gpugems3/part-ii-light-and-shadows/chapter-13-volumetric-light-scattering-post-process)
