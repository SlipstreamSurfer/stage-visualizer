#!/usr/bin/env python3
"""Install verified official Godot 4.7.2 templates and optionally the Linux editor."""
import argparse
import hashlib
import os
from pathlib import Path
import re
import shutil
import sys
import urllib.request
import zipfile

VERSION = "4.7.2.stable"
ARCHIVE = "Godot_v4.7.2-stable_export_templates.tpz"
EDITOR = "Godot_v4.7.2-stable_linux.x86_64"
BASE = "https://github.com/godotengine/godot-builds/releases/download/4.7.2-stable/"
# Digests published on the official release's asset list. Pin the manifest too.
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


def download(cache, name):
    path = cache / name
    if not path.exists():
        print("Downloading", BASE + name, flush=True)
        temporary = path.with_name(path.name + ".part")
        try:
            with urllib.request.urlopen(BASE + name, timeout=120) as src, temporary.open("wb") as dest:
                shutil.copyfileobj(src, dest)
            temporary.replace(path)
        finally:
            temporary.unlink(missing_ok=True)
    return path


def verified(cache, name, sums):
    matches = []
    for line in sums.read_text().splitlines():
        fields = line.split()
        if len(fields) == 2 and fields[1].lstrip("*") == name:
            matches.append(fields[0])
    if len(matches) != 1 or not re.fullmatch(r"[0-9a-fA-F]{128}", matches[0]):
        raise RuntimeError("Missing or ambiguous official SHA512 for " + name)
    path = download(cache, name)
    if sha(path, "sha512") != matches[0].lower():
        raise RuntimeError("Official SHA512 mismatch for " + name + "; remove the invalid cached download")
    return path


def install_editor(archive, target):
    with zipfile.ZipFile(archive) as source:
        if source.namelist() != [EDITOR]:
            raise RuntimeError("Unexpected editor archive contents")
        target.mkdir(parents=True, exist_ok=True)
        destination = target / EDITOR
        with source.open(EDITOR) as src, destination.open("wb") as dest:
            shutil.copyfileobj(src, dest)
        destination.chmod(0o755)
    print("Verified SHA512; installed", destination)


def install_templates(archive, target):
    if sha(archive, "sha256") != SHA256:
        raise RuntimeError("Official template SHA256 mismatch; remove the invalid cached download")
    with zipfile.ZipFile(archive) as source:
        if source.read("templates/version.txt").decode().strip() != VERSION:
            raise RuntimeError("Wrong template version")
        # Validate every member before writing anything into the target.
        names = [name for name in source.namelist() if not name.endswith("/")]
        for name in names:
            path = Path(name)
            if len(path.parts) != 2 or path.parts[0] != "templates" or path.name in (".", "..") or "\\" in name:
                raise RuntimeError("Unexpected archive member: " + name)
        target.mkdir(parents=True, exist_ok=True)
        for name in names:
            destination = target / Path(name).name
            with source.open(name) as src, destination.open("wb") as dest:
                shutil.copyfileobj(src, dest)
            if ".x86_" in destination.name or ".arm" in destination.name:
                destination.chmod(0o755)
    print("Verified SHA256 + SHA512; installed", target)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=ROOT / "local/downloads")
    parser.add_argument("--target", type=Path, default=data_dir() / "export_templates" / VERSION)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--editor", action="store_true", help="also install the standard Linux x86_64 editor")
    mode.add_argument("--editor-only", action="store_true", help="install the standard Linux editor, without templates")
    parser.add_argument("--editor-dir", type=Path, default=ROOT / "local/godot")
    options = parser.parse_args()
    options.cache.mkdir(parents=True, exist_ok=True)
    (ROOT / "local").mkdir(exist_ok=True)
    (ROOT / "local/.gdignore").touch()
    sums = download(options.cache, "SHA512-SUMS.txt")
    if sha(sums, "sha256") != SUMS_SHA256:
        raise RuntimeError("Official manifest SHA256 mismatch; remove the invalid cached download")
    # Verify every requested download before extracting either archive.
    editor = verified(options.cache, EDITOR + ".zip", sums) if options.editor or options.editor_only else None
    templates = verified(options.cache, ARCHIVE, sums) if not options.editor_only else None
    if editor:
        install_editor(editor, options.editor_dir)
    if templates:
        install_templates(templates, options.target)


if __name__ == "__main__":
    main()
