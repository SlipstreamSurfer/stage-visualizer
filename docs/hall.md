# Hangar — 0.53

## References and design

The building is a rectangular industrial hall converted for a festival, rather
than a second lighting rig. Public sources checked for the design:

| Source | Observation and use in SV |
| --- | --- |
| [NDSM Loods — Underskate](https://www.ndsmloods.nl/verhuur/underskate/) | A former shipbuilding venue with large sliding doors, rigging provisions and exit signage. Borrowed the working-building details and restrained finishes. |
| [NDSM Producties — venue brochure](https://www.ndsmproducties.nl/wp-content/uploads/2025/10/Brochure-Winterkathedraal.pdf), pp. 9–12 | Hall plans, concrete floors and production infrastructure. The temporary Winterkathedraal inside the hall is distinct from the permanent building; SV models the latter. |
| [NDSM Noordstrook — interior photograph](https://app.thefeedfactory.nl/api/assets/67a46b05fd9b737c8b170115/Noordstrook_SetVexy__2_.webp) | Studied the visible roof lattice, repeated columns, high windows and service runs. Adapted to SV's smaller fixed envelope; no copied image assets. |
| [Drumsheds — The Spaces](https://drumshedslondon.com/venue/the-spaces/), with the public empty-hall photograph below | Exposed industrial structure and production systems remain legible around the temporary show. Used a separate layer of heavy building steel above the existing light trusses. |
| [Drumsheds — empty interior photograph](https://thegroovecartel.com/featured/london-drumsheds/) | Inspected roof liners, purlins, diagonal webs and longitudinal ventilation. SV keeps its clear floor span instead of adding the reference's internal columns. |
| [Awakenings — Gashouder description and show photograph](https://www.awakenings.com/en/about/) | The permanent roof reads through coloured haze above the temporary festival trusses. Borrowed that contrast; the circular radial roof is not appropriate to SV's rectangular plan. |
| [Steel Construction Info — single-storey industrial buildings](https://steelconstruction.info/sectors/single-storey-industrial-buildings) | Distinguishes primary steel, secondary purlins/rails and the envelope; explains flat lattice roofs and service integration. These are separate visible layers in SV. |
| [Steel Construction Info — trusses](https://steelconstruction.info/topics/design/trusses/) | Triangulated chords and webs, with services in the web space. SV uses shallow flat girders to preserve the existing roof and rig clearances; dimensions are a visual adaptation. |
| [Steel Construction Info — braced frames](https://steelconstruction.info/topics/design/braced-frames/) | Roof-plane and wall bracing form connected longitudinal stability bays. Added matching X bracing in the first and last bays. |
| [Cladco — Z purlin profiles](https://www.cladco.co.uk/media/pdf/z_purlins_datasheet.pdf) | Thin webs and opposing flanges, not heavy solid beams. Used simplified 200 mm profiles under the roof liner. |

## Construction and lighting

Nine transverse steel girders on I-section columns, at the existing 9.5 m bay
spacing, support Z purlins and a closed profiled roof. Base plates, girder seats,
wall rails, end-bay wind bracing and attachment clevises give the structure a
consistent scale. Rectangular ventilation trunks pass through the upper web
space; wall drops, grilles and cable trays stay at the perimeter.

The walls have jointed concrete plinths, coated liners, closed high windows and
eight exit doors with panic bars and dim green signs. The rear has six closed
sliding leaves and a small production deck beyond the crowd. Rooflights have
opaque backing; they admit no daylight. All Hall constants are unchanged, as
are the floor, booth, PA, haze volumes, show and rig implementations.

Dark coated steel, rough concrete and dull galvanised services retain their
colour under direct show light. Corrugation, seams and finish variation are
baked into small mipmapped maps; the liner uses metre-based UVs instead of
triplanar sampling. `hall_surface.gdshader` also approximates diffuse returned
show light from the rig's existing `room_color` and `room_level`. It adds no
lights, independent colour cycle or fixed illumination. The return becomes
zero immediately when the show level is zero. This is a visual approximation,
not a spatial GI solution; it cannot reproduce individual bounced shadows.
The ten former hall lights are removed; the existing booth spotlight remains.

Repeated details share MultiMeshes. Walls and roof share one 52-triangle
surface; all eight signs share one draw. The hall's potential mesh surfaces,
including unchanged booth/PA geometry but excluding labels, fall from 134 to
110. This is a geometry audit, not a count of shadow/SSR passes or visible draws.

## PA direction

The main arrays and floor subs have visible grilles facing the audience (+Z). The arrays toe towards the centre
rather than the walls, and their increasing inter-box angle bends the lower cabinets down. The original hang
positions, cabinet counts and angle magnitudes are retained; these are simplified visual models, not an acoustic
coverage calculation. Booth monitors retain their independent orientation towards the DJ.

All 48 PA grilles share one static, single-surface MultiMesh without shadows. They sit inside the original cabinet
depth, with the casing recessed behind them. `tools/test_pa.gd` reads the actual generated batch transforms to check
downward aiming, inward toe, cabinet counts and the unchanged front-head row with its deliberate PA gaps.

## Measurements and checks

Godot 4.7.2 Forward+, 1920×1080, same local track, sequential GPU runs without
other previews. Built-in benchmark: three rounds, median samples averaged,
DJ eyes and over the shoulder, alternating preset order, no frame limit:

```sh
./start.sh -- --track=local/track.ogg --bench --presets=light,normal,high
```

| GPU ms, before → after | DJ eyes | Over the shoulder |
| --- | ---: | ---: |
| Light | 3.1 → 2.9 | 3.3 → 3.0 |
| Normal | 5.4 → 5.5 | 5.4 → 5.4 |
| High | 10.6 → 10.6 | 10.7 → 10.7 |

Whole-scene values vary with live audio analysis and the musical moment.
Ultra is outside this timing comparison.

Before/after pictures and raw logs stay in ignored `local/`:
`hall-{before,after}-camera{1,3,4}.png` and `hall-{before,after}-roof.png`.
Pictures use High, `--section=peak --seed=53 --wait=10`; the camera helper selects
the actual numbered view. The roof view uses `--eye=0,3,30 --at=0,10,-30`.

All seven checks listed in `AGENTS.md` pass. High/Ultra captures verify zero
material return in the dark and separate red/blue responses. The geometry audit
checks inward liner winding,
eight exit signs, closed window backing, unchanged constants/floor/booth, and
that the hall contains only the existing booth spotlight.
