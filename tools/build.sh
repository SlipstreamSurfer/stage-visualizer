#!/usr/bin/env bash
# Local release exports only; no upload or publication.
set -euo pipefail
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$root"
godot_bin=${GODOT:-$HOME/.local/opt/godot/Godot_v4.7.2-stable_linux.x86_64}
if [[ ! -x "$godot_bin" ]]; then
    godot_bin=$(command -v godot || true)
fi
if [[ -z "$godot_bin" ]]; then
    echo 'Set GODOT to the Godot 4.7.2 editor executable.' >&2
    exit 1
fi
version=$("$godot_bin" --headless --version)
case "$version" in
    4.7.2.stable.*) ;;
    *) echo "Expected Godot 4.7.2 stable, found: $version" >&2; exit 1 ;;
esac
out="$root/local/builds"
mkdir -p "$out/linux" "$out/windows" "$out/logs" "$root/local/build-config"
# Music, recordings, downloads and builds must not enter Godot's import scan.
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
    # Godot can report script errors while still returning exit code zero.
    if grep -Eq '(^ERROR:|SCRIPT ERROR:)' "$out/logs/$name.log"; then
        tail -60 "$out/logs/$name.log" >&2
        return 1
    fi
}

run import "$godot_bin" --headless --path "$root" --editor --import
run linux "$godot_bin" --headless --path "$root" --export-release 'Linux x86_64' "$out/linux/SV.x86_64"
run windows "$godot_bin" --headless --path "$root" --export-release 'Windows x86_64' "$out/windows/SV.exe"
run macos "$godot_bin" --headless --path "$root" --export-release 'macOS Universal (Metal)' "$out/SV-macOS.zip"

python3 - "$out" <<'PY'
import hashlib
from pathlib import Path
import sys
folder = Path(sys.argv[1])
artifacts = [folder / 'linux/SV.x86_64', folder / 'windows/SV.exe', folder / 'SV-macOS.zip']
with (folder / 'SHA256SUMS').open('w') as sums:
    for artifact in artifacts:
        assert artifact.stat().st_size > 0, artifact
        digest = hashlib.file_digest(artifact.open('rb'), 'sha256').hexdigest()
        sums.write(f'{digest}  {artifact.relative_to(folder)}\n')
PY
echo "Builds and SHA256SUMS: $out"
