#!/usr/bin/env python3
"""Install verified official Godot 4.7.2 templates in Godot's standard data folder."""
import argparse
import hashlib
import os
from pathlib import Path
import shutil
import sys
import urllib.request
import zipfile

VERSION = "4.7.2.stable"
ARCHIVE = "Godot_v4.7.2-stable_export_templates.tpz"
BASE = "https://github.com/godotengine/godot-builds/releases/download/4.7.2-stable/"
# Digests published on the official release's asset list.
SHA256 = "f298490b8d44d934be425a5a65a51bf15f422428b229a06a6e11d9ffea248011"
SUMS_SHA256 = "b8bdff6704f833e7a021df16ec08e1478edd5a285c1f894929b91a7f74a5c7c0"
ROOT = Path(__file__).resolve().parents[1]


def data_dir():
    if sys.platform == "darwin":
        return Path.home() / "Library/Application Support/Godot"
    if sys.platform == "win32":
        return Path(os.environ["APPDATA"]) / "Godot"
    return Path(os.environ.get("XDG_DATA_HOME", str(Path.home() / ".local/share"))) / "godot"


def sha(path, algorithm):
    with path.open("rb") as file:
        return hashlib.file_digest(file, algorithm).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=ROOT / "local/downloads")
    parser.add_argument("--target", type=Path, default=data_dir() / "export_templates" / VERSION)
    options = parser.parse_args()
    options.cache.mkdir(parents=True, exist_ok=True)
    # Keep the large cache outside Godot's importer.
    (ROOT / "local").mkdir(exist_ok=True)
    (ROOT / "local/.gdignore").touch()
    for name in [ARCHIVE, "SHA512-SUMS.txt"]:
        path = options.cache / name
        if not path.exists():
            print("Downloading", BASE + name, flush=True)
            temporary = path.with_name(path.name + ".part")
            urllib.request.urlretrieve(BASE + name, temporary)
            temporary.replace(path)
    archive = options.cache / ARCHIVE
    sums = options.cache / "SHA512-SUMS.txt"
    if sha(archive, "sha256") != SHA256 or sha(sums, "sha256") != SUMS_SHA256:
        raise RuntimeError("Official SHA256 mismatch; remove the invalid cached download and retry")
    expected = next(line.split()[0] for line in sums.read_text().splitlines() if line.endswith(ARCHIVE))
    if sha(archive, "sha512") != expected:
        raise RuntimeError("Official SHA512 mismatch")
    with zipfile.ZipFile(archive) as source:
        if source.read("templates/version.txt").decode().strip() != VERSION:
            raise RuntimeError("Wrong template version")
        # Validate every member before writing anything into the target.
        names = [name for name in source.namelist() if not name.endswith("/")]
        for name in names:
            path = Path(name)
            if len(path.parts) != 2 or path.parts[0] != "templates":
                raise RuntimeError("Unexpected archive member: " + name)
        options.target.mkdir(parents=True, exist_ok=True)
        for name in names:
            destination = options.target / Path(name).name
            with source.open(name) as src, destination.open("wb") as dest:
                shutil.copyfileobj(src, dest)
            if ".x86_" in destination.name or ".arm" in destination.name:
                destination.chmod(0o755)
    print("Verified SHA256 + SHA512; installed", options.target)


if __name__ == "__main__":
    main()
