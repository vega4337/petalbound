#!/usr/bin/env sh
cd -- "$(dirname -- "$0")" || exit 1
echo "Open http://127.0.0.1:8000 in your browser. Ctrl+C stops the server."
python3 -m http.server 8000 --bind 127.0.0.1
