#!/bin/bash
set -e
cd "$(dirname "$0")"
if [ "$(uname -s)" != Darwin ]; then
  echo 'This launcher is for macOS.'
  exit 1
fi
if command -v node >/dev/null 2>&1; then
  sv_node=$(command -v node)
else
  echo 'Install Node.js 24 LTS or newer, then try again. See README.md.'
  exit 1
fi
echo 'Stage Visualizer starts on this computer. Leave this terminal open.'
echo 'Stop the server with Control-C.'
exec "$sv_node" tools/serve.mjs --open
