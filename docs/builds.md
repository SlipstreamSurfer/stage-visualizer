# Builds and GitHub Actions

SV uses the **Godot 4.7.2 stable standard editor**, without .NET, and Python 3.11+.
The two workflows run on `ubuntu-latest`. No personal tokens, Apple certificates
or other repository secrets are required.

## Pull requests and main

`Checks` runs on every pull request and every push to `main`. The existing
`Commit addresses` check still checks both author and committer addresses on all
PR commits. The separate Godot job:

1. Downloads the official Linux x86_64 editor.
2. Verifies the SHA-256 pin of the official `SHA512-SUMS.txt`, then the editor's
   SHA-512 entry, before extracting or running it. Cached archives are rechecked.
3. Bootstraps a fresh import, then repeats `--headless --editor --import`
   strictly. Only the two known initial font-loader diagnostics are allowed in
   the bootstrap; the second import must be clean.
4. Runs all seven headless scripts listed in `AGENTS.md`: `test_app`,
   `test_controls`, `test_show_checks`, `test_choreography`, `test_session`,
   `test_rekordbox` and `test_listen_ear`.

A nonzero exit or a Godot `ERROR:` / `SCRIPT ERROR:` in a log fails the job,
including errors for which Godot returns zero. Logs are retained as Actions
artifacts. The test job has read-only repository permissions and needs no export
templates. To make successful checks mandatory for merging, select them in the
repository's branch protection/ruleset settings.

## Releases

Pushing a tag matching `v*` starts `Release`. The version in the package name is
the tag without its initial `v`, for example `v0.54.0` → `SV-0.54.0-linux.tar.gz`.
Tags use a filename-safe numeric version with optional letters, `.`, `+`, `_` or
`-`. Keep `project.godot`'s version aligned with the release tag; macOS bundle
versions inherit that project value.

The release job verifies the editor and the official standard export templates,
imports, runs the same seven tests, exports all three targets and starts the
Linux export headlessly. Template verification checks both the pinned archive
SHA-256 and its SHA-512 entry in the pinned manifest. Downloads come from the
[official Godot 4.7.2 release](https://github.com/godotengine/godot-builds/releases/tag/4.7.2-stable).
The pinned manifest/archive digests live in `tools/install_export_templates.py`.

| Release asset | Contents |
| --- | --- |
| `SV-<version>-windows.zip` | x86_64 `SV.exe`, with embedded project data |
| `SV-<version>-linux.tar.gz` | Executable x86_64 `SV.x86_64`, with embedded project data |
| `SV-<version>-macos.zip` | Universal macOS app, arm64 + x86_64; macOS 13+ |
| `SHA256SUMS` | SHA-256 checksums of the three packages |

After successful checks and exports, `gh release upload` attaches the packages
using the built-in `GITHUB_TOKEN` (`GH_TOKEN` for the CLI), with `contents: write`
on the release job only. A missing release is created as a draft with
`--verify-tag`, uploaded, then published. No tag is created by the workflow.
An existing release keeps its title, notes and draft status. Reruns replace
assets with the same names via `--clobber`; GitHub release immutability, if
enabled, prevents replacement. Local scripts never upload or publish anything.

## Build locally

Run these commands from a clean checkout on Linux x86_64. This uses the same
installer and commands as Actions and keeps downloads, test data and outputs in
ignored `local/`:

```sh
export XDG_DATA_HOME="$PWD/local/build-data"
export XDG_CONFIG_HOME="$PWD/local/build-config"
python3 tools/install_export_templates.py --editor-only
tools/build.sh --test-only

# For all three packages, also install the verified templates:
python3 tools/install_export_templates.py --editor
tools/build.sh
# Optional package-name override, as used for tags:
BUILD_VERSION=v0.54.0 tools/build.sh
```

The installer defaults to templates only if neither editor flag is given.
`--cache`, `--target` (templates) and `--editor-dir` accept alternate locations.
Templates go to Godot's standard data location, respecting `XDG_DATA_HOME` on
Linux, `~/Library/Application Support/Godot` on macOS or `%APPDATA%/Godot` on
Windows. On another host, supply its standard editor through `GODOT`; automatic
editor installation is specifically for Linux x86_64.

Packages, exported programs and checksums appear in `local/builds/`; each import,
test, export and smoke run has a log in `local/builds/logs/`. `local/.gdignore`
keeps these files and downloads out of Godot's importer. Export presets also
exclude local audio, sessions, docs and tools. Each package is assembled from
explicit outputs, so old downloads or build logs cannot enter it.

## Open a downloaded build

### macOS

The app has Godot's built-in ad-hoc signature, **no Apple Developer ID signature
or notarization**. It needs no paid signing account. Gatekeeper may block the
first launch. For a release you trust:

1. Unzip the macOS package and move the `.app` to Applications.
2. Control-click/right-click the app in Finder, choose **Open**, then confirm
   **Open**. If that option is blocked, try **System Settings → Privacy & Security
   → Open Anyway** after the first attempted launch.
3. If quarantine still prevents opening, open Terminal and run:

   ```sh
   xattr -dr com.apple.quarantine "/Applications/Stage Visualizer.app"
   open "/Applications/Stage Visualizer.app"
   ```

This changes only that app's quarantine attribute, not the system's Gatekeeper
setting. Allow microphone/audio-input access when requested. See the
[Godot macOS opening instructions](https://docs.godotengine.org/en/4.7/tutorials/export/running_on_macos.html)
and [Mac audio setup](mac.md).

### Windows

Unzip the Windows package and open `SV.exe`. The unsigned app has no established
publisher reputation, so SmartScreen may show **Windows protected your PC**.
For a release you trust, choose **More info → Run anyway**. Managed devices may
block this choice; the package does not include a signing certificate.

### Linux

Extract the tarball. Executable permissions are included, but if an extraction
tool drops them:

```sh
chmod +x SV.x86_64
./SV.x86_64
```

## Validation for this change

Locally verified from a fresh tracked snapshot, without an import cache or local
music: official editor/template checksums, bootstrap plus strict import, all
seven tests, all three exports and the Linux smoke start. All three versioned
packages were created and their `SHA256SUMS` entries checked. The extracted Linux
tarball also starts headlessly outside the source tree with exit code zero.

Actionlint 1.7.12, Bash syntax and Python compilation pass. Deliberately corrupted
cached downloads, nonzero test exits and script errors with exit code zero are
rejected. Persistent font errors fail the strict second import. The unchanged
noreply guard was checked with synthetic valid/invalid commits; it does not print
the invalid address. Release creation, reuse and upload-failure behavior were
checked with a local CLI stub, without making GitHub calls.

Windows was checked as PE x86_64. The Mac archive was checked for both Mach-O
architectures, executable permissions, project version, PCK, microphone text and
ad-hoc signature resources. Windows/macOS were **not launched**; these checks do
not validate Gatekeeper, SmartScreen or a macOS signature. Graphics and audio
also remain platform checks.

Actual GitHub event dispatch, hosted runner behavior, cache/artifact services,
release permissions and uploads require a GitHub run. None were exercised or
published locally.
