#!/usr/bin/env bash
# Import, test and package locally. Only the release workflow publishes files.
set -euo pipefail
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$root"
case "${1:-}" in
    '') test_only=false ;;
    --test-only) test_only=true ;;
    *) echo 'Usage: tools/build.sh [--test-only]' >&2; exit 1 ;;
esac
if (( $# > 1 )); then
    echo 'Usage: tools/build.sh [--test-only]' >&2
    exit 1
fi
godot_bin=${GODOT:-$root/local/godot/Godot_v4.7.2-stable_linux.x86_64}
if [[ -z "${GODOT:-}" && ! -x "$godot_bin" ]]; then
    godot_bin=$(command -v godot || true)
fi
if [[ -z "$godot_bin" ]] || ! command -v "$godot_bin" >/dev/null; then
    echo 'Set GODOT to the Godot 4.7.2 standard editor executable.' >&2
    exit 1
fi
version=$("$godot_bin" --headless --version)
case "$version" in
    4.7.2.stable.*) ;;
    *) echo "Expected Godot 4.7.2 stable, found: $version" >&2; exit 1 ;;
esac
if [[ "$version" == *mono* ]]; then
    echo 'Use the standard editor, without .NET.' >&2
    exit 1
fi
release_version=${BUILD_VERSION:-$(python3 - <<'PY'
import re
from pathlib import Path
print(re.search(r'^config/version="([^"]+)"', Path('project.godot').read_text(), re.M)[1])
PY
)}
release_version=${release_version#v}
if [[ ! "$release_version" =~ ^[0-9][A-Za-z0-9.+_-]*$ ]]; then
    echo 'BUILD_VERSION must be a filename-safe version, optionally prefixed with v.' >&2
    exit 1
fi
out="$root/local/builds"
mkdir -p "$out/logs" "$root/local/build-config" "$root/local/build-data"
# Keep music, test fixtures, downloads and exports outside the importer.
touch "$root/local/.gdignore"
export XDG_CONFIG_HOME=${XDG_CONFIG_HOME:-$root/local/build-config}

run() {
    local name=$1
    shift
    echo "$name ($version)"
    if ! "$@" >"$out/logs/$name.log" 2>&1; then
        tail -60 "$out/logs/$name.log" >&2
        return 1
    fi
    # Godot may report script/engine errors while returning exit code zero.
    if grep -Eq '(^ERROR:|SCRIPT ERROR:)' "$out/logs/$name.log"; then
        tail -60 "$out/logs/$name.log" >&2
        return 1
    fi
}

# On a fresh checkout, Godot looks up the project font before importing it.
# Permit only those two startup diagnostics, then require a clean second import.
if [[ ! -d "$root/.godot" ]]; then
    echo "import-bootstrap ($version)"
    if ! "$godot_bin" --headless --path "$root" --editor --import >"$out/logs/import-bootstrap.log" 2>&1; then
        tail -60 "$out/logs/import-bootstrap.log" >&2
        exit 1
    fi
    if grep -E '(^ERROR:|SCRIPT ERROR:)' "$out/logs/import-bootstrap.log" | grep -Fvx \
        -e "ERROR: No loader found for resource: res://fonts/AtkinsonHyperlegible-Regular.otf (expected type: unknown)" \
        -e "ERROR: Error loading custom project font 'res://fonts/AtkinsonHyperlegible-Regular.otf'"; then
        tail -60 "$out/logs/import-bootstrap.log" >&2
        exit 1
    fi
fi
run import "$godot_bin" --headless --path "$root" --editor --import
for check in test_app test_controls test_light_desk test_show_checks test_choreography test_sequencer test_stage_detail test_crowd_detail test_pa test_session test_rekordbox test_listen_ear; do
    run "$check" "$godot_bin" --headless --path "$root" --script "tools/$check.gd"
done
if "$test_only"; then
    echo 'Import and all twelve checks passed.'
    exit 0
fi
mkdir -p "$out/linux" "$out/windows"
run linux "$godot_bin" --headless --path "$root" --export-release 'Linux x86_64' "$out/linux/SV.x86_64"
run windows "$godot_bin" --headless --path "$root" --export-release 'Windows x86_64' "$out/windows/SV.exe"
run macos "$godot_bin" --headless --path "$root" --export-release 'macOS Universal (Metal)' "$out/SV-$release_version-macos.zip"
chmod +x "$out/linux/SV.x86_64"
# Start the exported Linux program independently of the source tree.
(
    cd "$out/linux"
    run linux-smoke ./SV.x86_64 --headless --quit-after 60 -- --quality=light --seconds=1 --osc-port=0
)

python3 - "$out" "$release_version" <<'PY'
import hashlib
from pathlib import Path
import sys
import tarfile
import zipfile
folder, version = Path(sys.argv[1]), sys.argv[2]
linux = folder / 'linux/SV.x86_64'
windows = folder / 'windows/SV.exe'
macos_zip = folder / f'SV-{version}-macos.zip'
for artifact in (linux, windows, macos_zip):
    if not artifact.is_file() or artifact.stat().st_size == 0:
        raise RuntimeError(f'Missing or empty export: {artifact.name}')
linux_tar = folder / f'SV-{version}-linux.tar.gz'
with tarfile.open(linux_tar, 'w:gz') as archive:
    archive.add(linux, arcname='SV.x86_64')
windows_zip = folder / f'SV-{version}-windows.zip'
with zipfile.ZipFile(windows_zip, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    archive.write(windows, arcname='SV.exe')
with (folder / 'SHA256SUMS').open('w') as sums:
    for artifact in (windows_zip, linux_tar, macos_zip):
        with artifact.open('rb') as file:
            digest = hashlib.file_digest(file, 'sha256').hexdigest()
        sums.write(f'{digest}  {artifact.name}\n')
PY
echo "Packages and SHA256SUMS: $out"
