# Graphics quality

SV runs on anything from weak integrated graphics to a fast gaming card. Five presets and Automatic, plus every
option on its own (`Quality.apply_options`), for a settings screen later.

| Preset | Scale | Haze volume | Lamps on surfaces | Shadows | Screen effects | Crowd | GPU (GTX 1660 SUPER, 1080p) |
|---|---|---|---|---|---|---|---|
| Low | 50 % | off | washes only | off | FXAA | 600 | ~2.7 ms* |
| Light | 60 % | off | 15 % | off | SSAO, FXAA | 1,200 | 3.2 ms* |
| Normal | 80 % | 64 | 50 % | 4 | SSAO, FXAA | 2,400 | 5.6 ms |
| High | 100 % | 96 | all | 8 | SSAO, SSR, TAA | 3,000 | 10.5 ms |
| Ultra | 100 % | 128 | all | 12 | SSAO, SSR, SSIL, SDFGI, TAA | 3,000 | 16 ms |

\* At this little work a fast card clocks itself down, so Low and Light measure about the same on it; Low's
gain (a quarter of the pixels, a fifth of the crowd) shows on weak graphics.

**Automatic** starts at Low and steps up while the frames keep the screen's rate (or the frame limit, when lower).
The **steady picture** lowers the render scale when frames are too slow, but only when that makes them faster.

## What each effect costs

Measured with `./start.sh -- --track=local/track.ogg --section=peak --seed=55 --costs` (from Ultra; add
`--costs-from=NAME` for another preset). Each change is measured between Ultra just before and just after, so the
show moving on with the music cancels out. GPU ms saved, DJ's eyes / front of house:

| Change | Saves |
|---|---|
| Render scale 70 % / 50 % | 4.7–5.4 / 7.1–7.7 ms |
| Global illumination (SDFGI) off | 2.6–3.9 ms |
| Beams off | 1.9–2.4 ms (the show; never off in a preset) |
| Haze volume off | 1.9–2.2 ms |
| Crowd 0 / 1,200 | 2.1–2.3 / 1.1–1.2 ms |
| Reflections (SSR) off | 1.6–2.0 ms |
| Indirect light (SSIL) off | 1.7–1.8 ms |
| TAA off (FXAA) | 0.7–1.6 ms |
| Glow off | 0.4–0.9 ms |
| Lamps on surfaces off | 0.5–0.9 ms |
| Shadows off | 0.2 ms |
| Ambient occlusion off | about 0 |

So shadows and ambient occlusion now start lower down (Normal, Light), where they cost next to nothing; SDFGI and
SSIL stay on Ultra only. Run `--costs` on your own computer to see its prices.
