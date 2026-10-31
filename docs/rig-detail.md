# Fixed delay-tower detail

The delay towers retain their existing box-truss diagonals, dimensions and fixture positions. Each of their eight
heads has two mounting rails, four clamps round the upper crossbar chords and an independent closed safety loop.
The base plates have visible outriggers, feet, levelling screws and ballast blocks. These are simplified visual
models, not load-rated structures or instructions for building a real tower.

The new small parts use three static, single-surface MultiMesh batches with shadows disabled: `DelayMounts`,
`DelaySafeties` and `TowerFeet`. Outrigger arms and screws join the existing truss batches. No extra lights,
per-frame transforms or changes to show direction are introduced. Other fixture groups are unchanged.

`tools/test_stage_detail.gd` checks fixture count, delay mounting positions, clamps and safety-loop segment counts,
non-empty single-surface batches and finite, non-degenerate transforms. The same test covers the booth finishing
in both its two- and four-player configurations; see [booth](booth.md).
