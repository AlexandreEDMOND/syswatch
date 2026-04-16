# Hardware Access Notes

Date de capture: 2026-04-16  
Machine testee: MacBook Air `Mac17,3` / Apple M5 / macOS `25E246`

Ce document sert de reference locale pour eviter de refaire la meme recherche.

Etat du projet apres integration:

- ces signaux sont maintenant branches dans la page detail `Power`
- il reste a ameliorer l'interface et la lisibilite de cette vue

## Resume

Ce qui est clairement accessible aujourd'hui sur cette machine:

- via `powermetrics`: puissance estimee CPU/GPU/ANE, puissance combinee, pression thermique qualitative, frequences et residencies CPU/GPU
- via `ioreg -r -n AppleSmartBattery`: temperature batterie brute, voltage, amperage, puissance batterie brute, temps restant, cycle count, capacities

Ce qui n'a pas ete trouve de facon exploitable:

- temperature CPU en degres C
- temperature GPU en degres C
- temperature SoC/die en degres C exposee clairement par `powermetrics`

## Commandes utiles

```sh
system_profiler SPHardwareDataType
powermetrics --samplers cpu_power,gpu_power,ane_power,thermal -i 1000 -n 1 --format text --buffer-size 0
powermetrics --samplers cpu_power,gpu_power,ane_power,thermal -i 1000 -n 1 --show-extra-power-info --format text --buffer-size 0
powermetrics --samplers thermal -i 1000 -n 1 --format plist
powermetrics --samplers battery -i 1000 -n 1 --format text --buffer-size 0
pmset -g batt
ioreg -r -n AppleSmartBattery
ioreg -lw0 | rg -i 'smctempsensor|TemperatureSensor|thermalmonitord|AppleSMCSensorDispatcher|PMU tdev'
```

## 1. `powermetrics`

### Donnees confirmees

Exemples observes:

```text
CPU Power: 169 mW
GPU Power: 15 mW
ANE Power: 0 mW
Combined Power (CPU + GPU + ANE): 184 mW
Current pressure level: Nominal
```

Puis sur un autre sample:

```text
CPU Power: 1236 mW
GPU Power: 21 mW
ANE Power: 0 mW
Combined Power (CPU + GPU + ANE): 1257 mW
Current pressure level: Nominal
```

Autres donnees disponibles dans la sortie:

- frequence active E-cluster
- frequence active S-cluster
- active residency / idle residency par cluster
- frequence par coeur
- active residency / idle residency par coeur
- frequence GPU
- GPU active residency / idle residency

### Limite constatee

Meme avec:

- `thermal`
- `--show-extra-power-info`
- sortie `plist`

`powermetrics` ne retourne pas de temperature CPU/GPU/SoC en degres.  
La seule information thermique exploitable confirmee est:

- `Nominal`
- `Moderate`
- `Heavy`
- `Tripping`

## 2. `ioreg -r -n AppleSmartBattery`

Cette source expose beaucoup plus d'information batterie que le repo n'en utilise actuellement.

### Champs observes

Extrait pertinent:

```text
"CurrentCapacity" = 100
"TimeRemaining" = 859
"Amperage" = 18446744073709551391
"NominalChargeCapacity" = 4793
"FullyCharged" = Yes
"Temperature" = 2982
"IsCharging" = No
"DesignCapacity" = 4629
"Voltage" = 13147
"CycleCount" = 2
"VirtualTemperature" = 2500
"BatteryPower" = 18446744073709548658
```

### Decodage utile

Certains champs sont exposes comme entiers non signes alors qu'ils representent des valeurs negatives. En les reinterpretant en signe sur 64 bits:

- `Amperage = -225`
- `InstantAmperage = -225`
- `BatteryPower = -2958`

Interpretation probable:

- `Amperage` en mA
- `BatteryPower` en mW
- signe negatif = batterie en decharge

Exemple plausible au moment de la capture:

- courant batterie d'environ `225 mA`
- puissance batterie d'environ `2.958 W`

### Temperature batterie

`ioreg` expose au moins:

- `Temperature = 2982`
- `VirtualTemperature = 2500`

Interpretation la plus probable:

- valeur en centiemes de degre C
- donc environ `29.82 C` et `25.00 C`

Cette interpretation est plausible mais non confirmee ici par une documentation Apple lue dans cette session. Il faut donc la traiter comme une inference forte, pas comme une certitude contractuelle.

### Autres champs potentiellement utiles

- `TimeRemaining`
- `CycleCount`
- `DesignCycleCount9C`
- `CurrentCapacity`
- `NominalChargeCapacity`
- `DesignCapacity`
- `Voltage`
- `ExternalConnected`
- `IsCharging`
- `FullyCharged`
- `ChargerData`
- `PowerTelemetryData`

## 3. `pmset`

`pmset -g batt` donne une vue simple et fiable pour l'etat utilisateur:

```text
Now drawing from 'Battery Power'
-InternalBattery-0 (...) 100%; discharging; 13:27 remaining present: true
```

Utile pour:

- pourcentage
- charge/decharge
- estimation temps restant

Moins utile que `ioreg` pour les details techniques.

## 4. Ce que `ioreg` montre sur les capteurs

La registry montre l'existence de composants lies aux capteurs et au monitoring thermique:

- `smctempsensor0`
- `AppleSMCSensorDispatcher`
- `AppleSMCSensorDispatcherUserClient`
- `AppleEmbeddedNVMeTemperatureSensor`
- table `TemperatureSensor` pointant vers des `PMU tdev1..8`
- references a `thermalmonitord`

Exemples vus:

```text
smctempsensor0
AppleSMCSensorDispatcher
AppleSMCSensorDispatcherUserClient
TemperatureSensor = {"J416s"="PMU tdev2", ...}
Product = "PMU tdev1"
...
Product = "PMU tdev8"
```

Conclusion pratique:

- l'infrastructure capteur existe bien
- mais on n'a pas trouve, via `ioreg` brut, une lecture directe et simple des temperatures CPU/GPU en degres
- les objets visibles ressemblent surtout a des descripteurs, mappings ou services internes

## 5. Impact pour ce repo

Ce qui est maintenant deja exploite dans le repo:

- temperature batterie depuis `ioreg`
- voltage batterie
- amperage batterie
- puissance batterie
- cycle count
- capacities batterie utiles
- pression thermique `powermetrics`
- puissance combinee et rails CPU/GPU/ANE

Ce que le backend pourrait encore ajouter sans refaire de recherche:

- design capacity / nominal capacity / current capacity avec plus de contexte visuel
- temps restant plus detaille si besoin
- details frequence/residency CPU/GPU depuis `powermetrics`

Ce qui reste a ameliorer cote frontend:

- presentation plus claire des signaux thermiques
- meilleure hierarchie visuelle sur la page detail `Power`
- distinction plus nette entre valeurs brutes, inferees et qualifiatives

Ce qui reste non confirme:

- temperature CPU/GPU en degres
- temperature die SoC en degres

## 6. Position actuelle

Position prudente a conserver dans le code et la doc:

- `powermetrics` donne bien la consommation et la pression thermique
- `ioreg` donne bien des metriques batterie detaillees
- aucune source testee ici ne donne de temperature CPU/GPU en degres de facon claire et robuste sur ce Mac M5
