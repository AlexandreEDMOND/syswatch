#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

case "${TARGET_TRIPLE:-$(uname -m)-apple-darwin}" in
  arm64-apple-darwin|aarch64-apple-darwin)
    TARGET_TRIPLE="aarch64-apple-darwin"
    ;;
  x86_64-apple-darwin)
    TARGET_TRIPLE="x86_64-apple-darwin"
    ;;
  *)
    echo "Unsupported macOS target: ${TARGET_TRIPLE:-unknown}" >&2
    exit 1
    ;;
esac

mkdir -p frontend/src-tauri/binaries .build/pyinstaller

uv run \
  --with pyinstaller \
  --with psutil \
  pyinstaller \
  --onefile \
  --clean \
  --name "syswatch-backend-${TARGET_TRIPLE}" \
  --distpath frontend/src-tauri/binaries \
  --workpath .build/pyinstaller \
  --specpath .build/pyinstaller \
  server.py

