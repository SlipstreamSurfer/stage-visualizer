#!/bin/sh
# Start SV (Godot proof). Extra options go after --, for example: ./start.sh -- --quality=high
# SV can ask to be started again (exit code 42, after local/restart appears): then it starts again with the same options.
cd "$(dirname "$0")"
while :; do
	"${GODOT:-$HOME/.local/opt/godot/Godot_v4.7.2-stable_linux.x86_64}" --path . "$@"
	result=$?
	[ "$result" -eq 42 ] || exit "$result"
done
