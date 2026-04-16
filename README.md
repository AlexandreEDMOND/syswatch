# syswatch

Dashboard de monitoring système en temps réel pour macOS (Apple Silicon), avec un design terminal phosphore vert.

![syswatch dashboard](https://img.shields.io/badge/platform-macOS-lightgrey) ![stack](https://img.shields.io/badge/stack-Python%20%2B%20React-blue)

## Ce que ça monitore

| Panel | Données |
|-------|---------|
| **CPU** | Utilisation globale en % avec graphe temps réel |
| **Memory** | RAM utilisée / totale + graphe temps réel |
| **Network** | Débit entrant (RX) et sortant (TX) en temps réel |
| **Battery** | Pourcentage, statut (en charge / sur batterie), temps restant |
| **Storage** | Macintosh HD et T7 — espace utilisé / libre / total |
| **Power** | Consommation CPU, GPU et ANE en mW/W via `powermetrics` |
| **Claude Code** | Tokens de la session (input / output / cache) + **barres de plan** (session %, semaine %, extra usage) récupérées en direct depuis le CLI Claude Code |

## Stack

- **Backend** : Python 3 (stdlib + `psutil` + `pexpect`), lancé via [`uv`](https://github.com/astral-sh/uv)
- **Frontend** : React + Vite, Chart.js pour les graphes
- **Design** : Phosphor terminal — Syncopate + Share Tech Mono, overlay scanlines CRT, grille fixe sans scroll

## Prérequis

- macOS (Apple Silicon recommandé)
- [uv](https://github.com/astral-sh/uv) — `brew install uv`
- Node.js + npm
- Claude Code installé (pour le panel plan usage)

## Lancer

```bash
./start.sh
```

Le script :
1. Demande le mot de passe sudo (nécessaire pour `powermetrics`)
2. Tue tout process existant sur le port 8080
3. Lance le backend Python en arrière-plan avec sudo
4. Lance le frontend Vite et ouvre le navigateur

L'interface est accessible sur **http://localhost:5173**

## Comment fonctionne le panel Claude Code

Le panel utilise deux sources :

**Tokens bruts** — lus directement depuis `~/.claude/projects/<projet>/<session>.jsonl`. Chaque message assistant contient un champ `usage` avec `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`.

**Barres de plan** — un thread de fond spawne un process `claude --dangerously-skip-permissions` via `pexpect`, envoie la commande `/usage`, capture la sortie terminal, et parse les pourcentages + reset times. Se rafraîchit toutes les 60 secondes.

## API

Le backend expose ces endpoints sur `localhost:8080` :

```
GET /api/cpu        → { percent, per_core[] }
GET /api/ram        → { total, used, available, percent }
GET /api/network    → { bytes_sent_per_sec, bytes_recv_per_sec }
GET /api/battery    → { percent, plugged, secs_left }
GET /api/disks      → [{ label, mount, total, used, free }]
GET /api/power      → { cpu_mw, gpu_mw, ane_mw, combined_mw, available }
GET /api/claude     → [{ sessionId, cwd, model, input_tokens, output_tokens, ... }]
GET /api/plan       → { session_pct, week_pct, extra_pct, session_resets, week_resets, spent, budget }
```
