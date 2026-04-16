#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "Démarrage de syswatch..."
open "http://localhost:8080"
uv run server.py
