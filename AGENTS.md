# Development guidelines

This repository contains the distributable Stage Visualizer product.
Keep changes focused and run checks appropriate to changed behavior.
Preserve the audio stream when changing visual controls or venues.

Do not commit local music, recordings, personal feedback, machine-specific
handoffs, prepared application copies, generated runtimes or private venues.
Use synthetic test inputs and generic fixtures. Keep the README and setup
instructions usable from a fresh checkout.

# Hangar focus

Hangar is the main stage for SV development and the only public product venue.
Keep daily checks scoped: `npm test` is the fast Hangar/audio-engine suite;
`npm run test:browser` is a single real Hangar page check. Use broader regression
checks only for relevant shared behavior changes; do not run a venue tour for a
small Hangar change. Retain private experiments outside the public product.
