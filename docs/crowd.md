# Crowd — 0.52

The crowd has a jaw and crown, a visible neck, sloping shoulders, tapered sleeves,
forearms, hands, trousers and shoes. Height, shoulder width, depth, hair and dark
clothing vary per person. Minimum shoulder spacing keeps bodies from merging.
All parts share one opaque indexed surface: one MultiMesh draw for up to 3,000
people, plus the existing separate DJ. Geometry falls from 1,920 to 686 triangles
per person. The existing quality counts remain 1,200 / 2,400 / 3,000 / 3,000.

`sv_beat` drives head nods and knee dips. Strong `sv_energy` and `sv_hands` drive
jumps and raised arms; timing, enthusiasm, elbow bend and alternate-beat jumps
vary per person. `sv_phones` lifts a phone for one in thirteen people during breaks.
Phones suppress jumping; the DJ stays at the decks. Joint and body normals follow
the deformation. Dark clothing and light-dependent rim shading leave the unlit
side dark; only phone screens emit light.

Concrete uses subtle roughness and normal maps with plane UVs. The existing SSR
switch enables a thin wet sheen on High/Ultra; Light/Normal stay matte. Quality
changes update the material without an extra reflection pass or floor draw.

## Validation

GPU milliseconds, before → after, at 1920×1080. The built-in benchmark averages
three median samples for each preset and viewpoint, reversing preset order in the
middle round. Same local track, sequential runs, warm shaders, no frame limit:

```sh
./start.sh -- --track=local/track.ogg --bench --presets=light,normal,high
```

| Preset | DJ eyes | Over the shoulder |
| --- | ---: | ---: |
| Light | 3.0 → 2.8 | 3.1 → 2.7 |
| Normal | 6.7 → 5.4 | 6.8 → 5.4 |
| High | 13.3 → 10.6 | 13.5 → 10.7 |

These are whole-scene measurements with live audio analysis, not isolated crowd
timings. Results vary with the musical moment. Ultra wetness was checked;
GPU timing covers the requested three presets.

Before/after images are in ignored `local/crowd-{before,after}-camera{3,4}.png`.
They use actual cameras 3 and 4, High, `--section=peak --seed=52 --wait=10`.
Additional frozen-global captures check rest, nod, drop, landing and phones.
Quality-switch checks confirm that wetness is enabled only on High/Ultra.
All seven checks listed in `AGENTS.md` pass; the mesh has one surface and the
3,000-instance build and Light visibility count were checked separately.

## Rounded heads and shoulders

The close-up model now has twelve-sided head, hair and neck rings, a cheek and brow profile, small ears and a
rounder nose. The torso has a softer shoulder transition. Analytic normals follow the changing elliptical rings;
end caps stay flat. Subtle socket and brow shading is anchored to the undeformed face, so it follows nods and sway.
Skin tones are less orange, with a rougher finish and a weaker rim than cloth. Skin does not emit light.

The mesh has 938 triangles per person (previously 686), below the 1,050-triangle detail budget. It remains one
indexed opaque surface, one MultiMesh for up to 3,000 people and the separate DJ. Placement, quality counts,
arm-joint tags, phones, nods and jumps are unchanged. No textures or CPU animation are added.

`tools/test_crowd_detail.gd` checks the triangle budget, scale, normals, ear silhouette, non-degenerate triangles,
material/joint tags, single-surface instancing and the Light visibility count. Frozen-pose Forward+ comparisons
cover close-up faces, raised arms and phones under identical inspection lighting; they are not live-show footage.

## A mixed crowd and the stage's light

Shirts, trousers and hair come from tables in `Crowd` (`CLOTH`, `HAIR`, `PANTS`): linear colours with the share of
the crowd that wears each. Most of the crowd stays dark, as at a techno night; about 4 % wear white and 3 % neon, so a
few shirts catch the show's colour. Hair runs from black through brown and blond to grey, with a rare dyed colour.
The shader picks an entry from the existing appearance and timing hashes, so there is no extra instance data.
Narrower shoulders tend to wider hips and legs, for a mixed impression of builds.

`Crowd.stage_light()` takes the show's room colour and level (from `main._room`) and eases it over about a third of
a second, so a kick or a strobe frame does not flash the whole crowd; in a blackout it fades to nothing. The shader
uses it for an edge on hair and shoulders facing the stage (what the audience sees from behind) and a little colour
on the fronts, strongest at the barrier and fading towards the back. It is emission, so it is not shadowed by the
people in front.

Still one surface and one MultiMesh draw, no textures; 938 triangles per person. `tools/test_crowd_detail.gd` checks
the shares (every colour worn, white and neon rare, most of the crowd dark) and the eased, blackout-safe stage light.
Measured on the GTX 1660 SUPER, Normal, 1080p, the same synthetic scene, three runs alternating before and after
(median): front of house 5.71 → 5.89 ms, DJ eyes 7.45 → 7.68 ms GPU.

## Six ways to dance

Every person has one of six styles: jumper, stomper, arm pumper, groover, hip swayer and watcher. `Crowd` picks it at
build time from the mix for their part of the hall (`FRONT_MIX`, `MIDDLE_MIX`, `BACK_MIX`, split at `FRONT_ZONE` and
`MIDDLE_ZONE` metres behind the barrier): wilder at the barrier, calmer at the back. Change those constants to change
the mix; a separate random stream keeps everyone standing where they stood.

The style is the whole part of INSTANCE_CUSTOM.x (the timing stays its fraction), so there is no extra instance data.
`person.gdshader` gives each style its own weights (`NOD`, `DIP`, `JUMP`, `STOMP`, `PUMP`, `HIPS`, `TWIST`, `HANDS`):
the jumper jumps from a medium energy on, the stomper stamps a foot down on each beat and leans in, the arm pumper
punches a fist above the head on the kick, the groover dips deep and turns the upper body, the hip swayer moves the
hips over two beats with feet planted, and the watcher barely moves. Phones and the DJ behave as before.

`tools/test_crowd_detail.gd` checks every zone's mix against its constants (within 6 points), that every style dances
in every zone, that the front has more jumpers and stompers than the back, and that the shader moves each style.
GPU, Normal, 1080p, GTX 1660 SUPER, same synthetic scene, three alternating runs (median): front of house
5.89 → 6.17 ms, DJ eyes 7.76 → 8.03 ms.
