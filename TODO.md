# TODO

## Produit

- Completer les pages detail restantes: CPU, Memory, Network, Battery, Storage, Claude
- Ajouter le suivi d'usage pour Codex (OpenAI Codex CLI) en plus de Claude
- Enrichir `Power detail` avec les frequences et residencies CPU/GPU issues de `powermetrics`
- Ajouter plus de contexte batterie dans la vue detaillee: capacities, sante, tendance de decharge
- Remplir la case vide du layout overview

## Interface

- Ameliorer l'interface globale du repo, surtout les pages detail
- Rendre la page `Power detail` plus lisible et plus coherente visuellement
- Harmoniser overview, detail pages et composants de cartes
- Mieux distinguer valeurs brutes, valeurs interpretees et signaux qualitatifs
- Ajouter des bornes d'affichage au graphe network pour eviter de changer d'echelle a chaque pic

## Lancement / CLI

- Modifier `start.sh` pour demander explicitement si l'utilisateur veut lancer avec ou sans `sudo`
- Gerer proprement les deux modes:
  - avec `sudo` pour `powermetrics`
  - sans `sudo` pour un mode degrade sans donnees power privilegiees
- Ameliorer l'interface CLI au lancement:
  - messages plus clairs
  - etapes affichees proprement
  - erreurs lisibles
  - meilleure indication de ce qui sera disponible ou non selon le mode choisi

## Refactor

- Refactorer le repo de maniere plus propre
- Mieux separer les responsabilites backend:
  - collecte systeme
  - parsing `powermetrics`
  - parsing `ioreg`
  - endpoints HTTP
- Mieux structurer le frontend:
  - pages detail
  - composants de visualisation
  - logique de polling / historique
- Sortir les constantes, mappings et helpers dans des modules dedies
- Nettoyer les fichiers legacy ou ambigus comme le `index.html` racine si non utilises

## Documentation

- Garder le README principal a jour quand une nouvelle source systeme est branchee
- Documenter les interpretations `ioreg` encore inferrees
- Ajouter des notes d'usage pour expliquer ce qui necessite `sudo`
