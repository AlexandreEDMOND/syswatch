# syswatch

Dashboard de monitoring système en temps réel pour macOS (Apple Silicon), avec un design terminal phosphore vert.

![syswatch dashboard](https://img.shields.io/badge/platform-macOS-lightgrey) ![stack](https://img.shields.io/badge/stack-Python%20%2B%20React-blue)

## Télécharger pour macOS

La version Mac se télécharge depuis les releases GitHub :

**[Télécharger Syswatch pour macOS](https://github.com/AlexandreEDMOND/syswatch/releases/latest)**

Installation :

1. Télécharger le fichier `.dmg` le plus récent.
2. Ouvrir le `.dmg`.
3. Glisser `Syswatch.app` dans `Applications`.
4. Lancer Syswatch depuis `Applications`.

Note: tant que l'app n'est pas signée et notarized avec un compte Apple Developer, macOS peut afficher une alerte de sécurité au premier lancement.

## Ce que ça monitore

| Panel | Données |
|-------|---------|
| **CPU** | Utilisation globale en % avec graphe temps réel |
| **Memory** | RAM utilisée / totale + graphe temps réel |
| **Network** | Débit entrant (RX) et sortant (TX) en temps réel |
| **Battery** | Pourcentage, statut (en charge / sur batterie), temps restant |
| **Storage** | Macintosh HD et T7 — espace utilisé / libre / total |
| **Power** | Consommation CPU/GPU/ANE via `powermetrics` + signaux thermiques et batterie détaillés via `ioreg` |
| **Claude Code** | Tokens de la session (input / output / cache) + **barres de plan** (session %, semaine %, extra usage) récupérées en direct depuis le CLI Claude Code |

## Stack

- **Backend** : Python 3 (stdlib + `psutil`), lancé via [`uv`](https://github.com/astral-sh/uv)
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

## App macOS

Une transition vers une app macOS Tauri est en cours. Le frontend React est reutilise, et le backend Python est lance automatiquement par l'app.

### Prerequis developpement app

- Node.js + npm
- uv
- Rust via rustup: https://rustup.rs/
- Xcode ou au minimum les Xcode Command Line Tools

### Lancer l'app en developpement

```bash
cd frontend
npm install
npm run app:dev
```

En mode developpement, Tauri lance le frontend Vite et demarre le backend avec `uv run server.py`.

### Construire une app locale

```bash
cd frontend
npm run app:build
```

Le build Tauri execute d'abord `scripts/build-macos-backend.sh`, qui transforme `server.py` en binaire macOS via PyInstaller, puis produit une app `.app` et un `.dmg`.

Notes:

- le backend ecoute toujours `127.0.0.1:8080` en interne, mais ce detail est cache a l'utilisateur;
- les donnees `powermetrics` restent en mode degrade sans autorisation admin;
- pour une distribution GitHub propre, il faudra ensuite ajouter signature Developer ID et notarization Apple.

### Publier une release GitHub

Le workflow GitHub Actions `.github/workflows/release-macos.yml` construit automatiquement les fichiers `.dmg` macOS et les attache a une release quand un tag `v*` est pousse.

Exemple:

```bash
git tag v0.1.0
git push origin v0.1.0
```

GitHub cree ensuite la release `Syswatch v0.1.0` avec les artefacts macOS. Une fois publiee, le lien `releases/latest` pointe automatiquement vers cette version.

## Comment fonctionne le panel Claude Code

Le panel utilise deux sources :

**Tokens bruts** — lus directement depuis `~/.claude/projects/<projet>/<session>.jsonl`. Chaque message assistant contient un champ `usage` avec `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`.

**Barres de plan** — priorité à un export structuré du `statusLine` Claude Code vers `~/.claude/syswatch/plan_usage.json`, relu quasi instantanément par le backend. Si ce cache n’existe pas encore, le backend garde un fallback plus lent via `claude /usage`.

### Activer l’export rapide Claude

```bash
python3 scripts/install-claude-statusline.py
```

Puis redémarrer Claude Code ou envoyer un nouveau message dans une session Claude ouverte.

Le script installé dans `statusLine` écrit un JSON local avec :

- `rate_limits.five_hour.used_percentage`
- `rate_limits.five_hour.resets_at`
- `rate_limits.seven_day.used_percentage`
- `rate_limits.seven_day.resets_at`

## API

Le backend expose ces endpoints sur `localhost:8080` :

```
GET /api/cpu        → { percent, per_core[] }
GET /api/ram        → { total, used, available, percent }
GET /api/network    → { bytes_sent_per_sec, bytes_recv_per_sec }
GET /api/battery    → { percent, plugged, secs_left }
GET /api/battery-details → { temperature_raw, temperature_c, battery_power_mw, voltage_mv, ... }
GET /api/disks      → [{ label, mount, total, used, free }]
GET /api/power      → { cpu_mw, gpu_mw, ane_mw, combined_mw, thermal_pressure, available }
GET /api/claude     → [{ sessionId, cwd, model, input_tokens, output_tokens, ... }]
GET /api/plan       → { session_pct, week_pct, session_resets, week_resets }
```

## Comment les donnees sont recuperees

### CPU

- source: `psutil.cpu_percent()`
- usage:
  - charge CPU globale
  - charge par coeur disponible dans l'API

### Memory

- source: `psutil.virtual_memory()`
- usage:
  - total RAM
  - RAM utilisee
  - RAM disponible
  - pourcentage d'utilisation

### Network

- source: `psutil.net_io_counters()`
- methode:
  - le backend garde le sample precedent en memoire
  - calcule `bytes_sent_per_sec` et `bytes_recv_per_sec` par difference entre deux lectures

### Battery

- source simple: `psutil.sensors_battery()`
- source detaillee: `ioreg -r -n AppleSmartBattery`
- usage:
  - pourcentage
  - etat charge / decharge
  - temps restant
  - temperature batterie brute et interpretee
  - voltage
  - amperage
  - puissance batterie
  - cycle count
  - capacities batterie

### Storage

- source:
  - `shutil.disk_usage("/")`
  - lecture des volumes montes dans `/Volumes`
- usage:
  - espace total / utilise / libre
  - affichage des disques montes utiles

### Power / Thermal

- source principale: `powermetrics`
- commande utilisee:

```sh
powermetrics --samplers cpu_power,gpu_power,ane_power,thermal -i 2000 -n -1 --format text --buffer-size 0
```

- usage:
  - puissance CPU
  - puissance GPU
  - puissance ANE
  - puissance combinee
  - pression thermique qualitative `Nominal / Moderate / Heavy / Tripping`

Important:

- sur ce M5, `powermetrics` ne retourne pas de temperature CPU/GPU en degres de facon exploitable
- la page `Power detail` utilise donc aussi `ioreg` pour enrichir la lecture thermique via la batterie

### Claude Code

- sessions actives:
  - source: `~/.claude/sessions/*.json`
- tokens:
  - source: `~/.claude/projects/<project>/<session>.jsonl`
  - lecture des champs `usage` dans les messages assistant
- plan usage:
  - source principale: `~/.claude/syswatch/plan_usage.json`
  - methode:
    - un script `statusLine` Claude Code reçoit les `rate_limits` sur stdin
    - ecrit un cache JSON local pour `syswatch`
    - `syswatch` le relit toutes les quelques secondes

## Pages detail

Une navigation par panel existe maintenant.

- `Power detail` est implemente et affiche:
  - pression thermique qualitative
  - historique de puissance combinee
  - temperature batterie issue de `ioreg`
  - puissance batterie, courant, voltage, cycles et health proxy
- les autres pages detail restent a construire

## Roadmap / Ce qu'il reste à faire

### Températures composants
Sur Mac17,3 (M5 Air), ni `cpu_power`, ni `smc`, ni `thermal` ne retournent de températures en degrés.
Le sampler `thermal` fournit uniquement un niveau qualitatif (`Nominal / Moderate / Heavy / Tripping`) — c'est ce qui est affiché dans le panel Power.
Si Apple déverrouille l'accès aux températures de die sur une prochaine version de macOS, ajouter les regex correspondantes dans `_powermetrics_worker()` et afficher dans `PowerCard`.

### Pages détail par catégorie
Navigation overview → page dédiée par panel avec plus de métriques :

| Page | Contenu prévu |
|------|---------------|
| **CPU detail** | Utilisation par cœur (E-cluster / S-cluster), fréquences, historique long |
| **Memory detail** | Répartition wired / active / inactive / compressed, swap |
| **Network detail** | Stats par interface, top connexions |
| **Battery detail** | Historique cycles, santé batterie, courbe de charge |
| **Storage detail** | Disques supplémentaires, vitesse lecture/écriture I/O |
| **Power detail** | Deja en place partiellement: pression thermique, conso combinee, signaux batterie `ioreg`. Reste: frequences/residencies CPU-GPU, temperature composants si Apple les expose, fan speed si disponible |
| **Claude Code detail** | Historique sessions, coût cumulé, tokens par projet |

Implémentation : router simple par état React (pas de dépendance externe), clic sur un panel → page détail, bouton retour.

### UI / Layout
- La colonne 3 row 3 (ex-emplacement réseau) est actuellement vide — à combler (météo ? uptime ? infos système ?)
- Continuer à améliorer l’interface des pages détail, surtout la page Power qui est fonctionnelle mais encore perfectible visuellement
- Harmoniser le design entre overview et pages détail
