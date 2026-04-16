#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "Démarrage de syswatch..."

# Mise en cache du mot de passe sudo (pour powermetrics)
sudo -v

# API Python en arrière-plan (-n = utilise les credentials mis en cache)
sudo -n uv run server.py &
API_PID=$!

# Frontend Vite (ouvre le navigateur automatiquement)
cd frontend
npm install --silent
npm run dev -- --open

# Arrête l'API quand Vite se ferme (Ctrl+C)
kill $API_PID 2>/dev/null
