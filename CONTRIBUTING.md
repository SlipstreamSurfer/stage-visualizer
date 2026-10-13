# Contributing

Use Node.js 24 or newer and Chrome, Edge or Chromium. There is no build step
or dependency installation. Start with `npm start` and run `npm test` before
submitting changes that affect application behavior.

Create a branch for a focused change and open a pull request against `main`.
Describe the user-visible behavior, relevant validation and any remaining limits.
Releases are made from reviewed product commits on `main`.

Use generated audio and generic rigs for reproducible tests. Local feedback,
recordings, reference tracks, machine-specific notes and private experiments
belong outside this repository. Ignored files are not release inputs. A public
branch is not a private storage location.

Venues are fictional descriptions in `src/venues/`. Add a venue by registering
its descriptor in `src/venues/index.js`. Shared fixtures and lighting behavior
belong in the corresponding source modules, not duplicated venue code.
