#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "Démarrage de syswatch..."

# Mise en cache du mot de passe sudo (pour powermetrics + kill)
sudo -v

# Tuer les anciens process sur le port 8080 (nécessite sudo car lancé en root)
sudo lsof -ti :8080 | xargs sudo kill -9 2>/dev/null || true
sleep 1

# API Python en arrière-plan (-n = utilise les credentials mis en cache)
sudo -n uv run server.py &
API_PID=$!

# Frontend Vite (ouvre le navigateur automatiquement)
cd frontend
npm install --silent
npm run dev -- --open

# Arrête l'API quand Vite se ferme (Ctrl+C)
kill $API_PID 2>/dev/null
