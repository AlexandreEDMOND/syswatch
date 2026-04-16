#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "Démarrage de syswatch..."

# API Python en arrière-plan (sudo pour powermetrics)
sudo uv run server.py &
API_PID=$!

# Frontend Vite (ouvre le navigateur automatiquement)
cd frontend
npm install --silent
npm run dev -- --open

# Arrête l'API quand Vite se ferme (Ctrl+C)
kill $API_PID 2>/dev/null
