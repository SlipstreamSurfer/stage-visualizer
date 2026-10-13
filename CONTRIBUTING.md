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

Hangar is the only public venue and the main development stage. Improve its
lighting, motion, cameras and musical response before adding product scope.
Other venue experiments belong in private development.

Use `npm test` for the short daily check, `npm run test:audio` for audio-engine changes and `npm run test:browser` for a real
Hangar page check. Run `npm run test:extended` only when broader application
changes require it. Do not tour unrelated venues for a Hangar change.
