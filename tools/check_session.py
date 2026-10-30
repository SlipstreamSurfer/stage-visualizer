#!/usr/bin/env python3
"""Record simulator + test music; compare every show trace in fast/realtime replay."""
import argparse
import datetime
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--godot", default=os.environ.get("GODOT") or shutil.which("godot") or str(Path.home() / ".local/opt/godot/Godot_v4.7.2-stable_linux.x86_64"))
parser.add_argument("--simulator", type=Path, default=ROOT.parent / "stage-visualizer/tools/rekordbox-simulate.mjs")
parser.add_argument("--track", type=Path, default=ROOT / "local/track.ogg")
args = parser.parse_args()
stamp = datetime.datetime.now().strftime("%Y-%m-%dT%H-%M-%S-%f")
folder = ROOT / "local/session-checks" / stamp
folder.mkdir(parents=True)
session = ROOT / "local/sessions" / (stamp + ".jsonl")
with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
    probe.bind(("127.0.0.1", 0))
    port = probe.getsockname()[1]
env = os.environ.copy()
env.update(XDG_DATA_HOME=str(ROOT / "local/test-home"), XDG_CONFIG_HOME=str(ROOT / "local/test-config"))


def run(name, options, audio=False):
    command = [args.godot, "--headless", "--audio-driver", "PulseAudio" if audio else "Dummy",
               "--max-fps", "60", "--path", str(ROOT), "--",
               "--quality=light", "--trace", *options]
    result = subprocess.run(command, cwd=ROOT, env=env, text=True, capture_output=True, timeout=60)
    text = result.stdout + result.stderr
    (folder / (name + ".log")).write_text(text)
    if result.returncode or "ERROR:" in text:
        raise RuntimeError(f"{name} failed: {text[-2500:]}")
    rows = [json.loads(line) for line in result.stdout.splitlines() if line.startswith('{"beat":')]
    print(next(line for line in result.stdout.splitlines() if line.startswith("session:") and "frames," in line))
    return rows


with (folder / "simulator.log").open("w") as log:
    # Use the supplied simulator unchanged on disk, with its port translated in memory.
    source = args.simulator.read_text().replace("4460", str(port))
    simulator = subprocess.Popen(["node", "--input-type=module", "--eval", source], cwd=args.simulator.parent,
                                 stdout=log, stderr=subprocess.STDOUT)
    try:
        recorded = run("record", ["--record", "--output=" + str(session), "--track=" + str(args.track),
                                  "--osc-port=" + str(port), "--seconds=12"], audio=True)
        simulator.wait(timeout=15)
        assert simulator.returncode == 0
    finally:
        if simulator.poll() is None:
            simulator.terminate()
            simulator.wait()
fast = run("fast", ["--replay=" + str(session), "--fast"])
realtime = run("realtime", ["--replay=" + str(session)])
assert recorded and recorded == fast == realtime, "Show frame traces differ"
rows = [json.loads(line) for line in session.read_text().splitlines()]
frames = [row for row in rows if row["kind"] == "frame"]
assert any(row["rb"]["live"] for row in frames), "No live OSC received"
assert any(row["rb"]["fields"] and not row["rb"]["live"] for row in frames), "OSC timeout not covered"
assert {row["phrase"] for row in recorded} >= {"Up 1", "Chorus 1"}, "Simulator phrase change missing"
assert max(row["listen"]["energy"] for row in frames) > 0.01, "No music captured"
audio = rows[-1]["audio"]
assert audio["frames"] > 0 and not audio["error"] and audio["discarded"] == 0, audio
result = {"frames": len(frames), "seconds": frames[-1]["t"], "trace_match": True,
          "audio": audio, "session": str(session), "logs": str(folder)}
(folder / "result.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result, indent=2))
