# Publishing a release

Releases use reviewed product commits on `main`. Keep the version in
`package.json` and the matching section in `CHANGELOG.md` in the same change.

1. Merge the reviewed pull request, then update a clean local checkout:

   ```sh
   git switch main
   git pull --ff-only
   git status --short
   npm test
   npm run test:browser
   ```

   Resolve failed checks before releasing. The working tree must be clean.

2. Set the tag to the version from `package.json`, and push it:

   ```sh
   git tag -a vX.Y.Z -m "Stage Visualizer X.Y.Z"
   git push origin vX.Y.Z
   ```

3. Copy the matching changelog section to a temporary Markdown file, then
   create the GitHub Release. A pushed tag alone does not appear as a release:

   ```sh
   gh release create vX.Y.Z --verify-tag \
     --title "Stage Visualizer X.Y.Z" --notes-file /path/to/release-notes.md
   gh release view vX.Y.Z --json url,tagName,isDraft,isPrerelease
   ```

4. Confirm that the release is published and the tag points to the reviewed
   commit on `main`. Preserve older releases and tags. Publish only tracked
   product files; local recordings, feedback and generated builds remain private.

GitHub automatically deletes merged pull-request branches. If publication is
interrupted, inspect the remote tag and release before retrying; do not replace
an existing published tag.
