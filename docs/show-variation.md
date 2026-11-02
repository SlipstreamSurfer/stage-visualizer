# Show variation

The director keeps a figure stable for a musical scene. It chooses geometry, movement, gating, beam width and colour distribution separately. Authored figures remain the base; raw techno can vary their movement stacks between scenes. Changing colour alone does not make a pattern new. Calm sections use a smaller set of movements and gates. Four figures per energy tier are available per track for most genres, six for Raw / Deep / Hypnotic Techno, shuffled with memory of recent figures.

Nine spatial compositions give the stage, centre and sides different roles. They last musical multiples of four bars, with variable durations and no return to the previous three compositions. Travelling layers vary in direction, period and offset. Local islands replace a fixed left/right switch. Drops reopen every bank and alternate the front-row figure; breaks settle the travelling layers. The faders still scale the final output.

The techno sequencer chooses rhythms and block lengths from the track identity, palette and block. Dense eighths and sixteenths are occasional choices rather than a fixed six-block rotation. Gentle strobes retain quarter-note gates. Mono blocks have irregular spacing and do not run back to back.

Lightning is an accent layer: it preserves the running scene's colours, aims, dark fixtures and other effects. Depth chases last sixteen to thirty-two bars and develop through aligned waves, staggered columns, echo pulses and breathing columns. Variations dissolve over two beats without restarting the main chase. Rain has been removed. Gentle mode omits lightning and softens depth chases.

The raw-techno spatial sequencer runs only as an occasional episode, confined to one rig region while other regions keep the base show. It selects whole fixtures by spatial station: across, depth, diagonals, centre-out and staggered routes. Non-selected fixtures are off. Internal pixel movement is a separate detail. Sparse spatial sequences are measured by coverage and continued presence rather than requiring most of the rig to stay on.

Stage-row programming uses fewer simultaneous heads and lower output, leaving sightlines to the booth and rear rig. Light-desk group levels persist in a local lighting profile; All on remains available.

The screen has six procedural scenes, with crossfades, variable phrase durations and memory of recent scenes. It follows the director's colours, including mono looks. Breaks settle into an orbit. Motion uses the show clock instead of shader TIME, and blackout closes the screen immediately. Pixel chases reuse the existing batten shader and draw calls.

All choices use private deterministic seeds: equal track inputs and control history replay equally. This reduces visible short loops; it does not make every moment unique or infer creative intent from audio. Long listening sessions remain the final artistic check.

Validation includes eighty scene changes with no recent spatial-combination repeats, different sequencer patterns for different track seeds, nine room compositions, all six screen scenes, blackout, frame-rate-independent motion, faders and the seven-genre choreography test.

Balance checks simulate twenty-minute sets: most time stays with ordinary choreography, and every episode reserves a substantial gap before another can begin. Gentle mode disables automatic strobes and rapid sequencer episodes and softens gate/kick modulation. Debug feedback is explicitly enabled with `--debug-feedback`; see `choreography-blueprint.md`.
