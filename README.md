# MacroEditor

MacroEditor est un éditeur de texte orienté macros sémantiques.
Le dépôt contient aujourd'hui deux applications :

- une application desktop GTK4 en Python
- une application web avec frontend React et backend Express

L'objectif du projet est de permettre l'édition de texte, l'enregistrement de macros métier, leur persistance JSON et leur relecture avec un comportement prévisible.

## Fonctionnalités

### Éditeur

- nouveau document, ouverture, sauvegarde et suppression
- copier, couper, coller, undo, redo
- numéros de ligne
- barre d'état avec ligne, colonne, état d'enregistrement et état du document
- import/export de fichiers locaux dans la version web

### Mode colonne

- activation/désactivation dédiée
- sélection rectangulaire à la souris
- extension verticale au clavier
- copier/couper/coller sur bloc
- restauration complète via undo/redo

### Macros

- enregistrement de macros sémantiques
- mémorisation du texte saisi et des suppressions
- mémorisation des déplacements du curseur
- mémorisation des clics de repositionnement de curseur à la souris
- lecture de macro avec répétitions
- stockage JSON des macros

### Recherche

- recherche standard
- remplacement simple et global
- assistant regex
- mode regex manuel avancé avec flags
- copie de la regex générée

### Interface web

- thème sombre ou clair
- aide intégrée décrivant les principales possibilités de MacroEditor
- backend pour les documents et les macros

## Structure

```text
macroeditor/
├── app.py
├── main.py
├── editor/
├── macros/
├── ui/
├── utils/
├── debian/
├── server/
└── web/
```

## Version Desktop GTK

### Pré-requis

- Python 3.11+
- PyGObject
- GTK 4
- GtkSourceView 5
- Linux

### Installation des dépendances

```bash
sudo apt-get update
sudo apt-get install -y python3-gi gir1.2-gtk-4.0 gir1.2-gtksource-5
```

### Lancement

```bash
python3 main.py
```

## Version Web React + Backend

### Pré-requis

- Node.js 20+
- npm 10+

### Installation

```bash
npm install
```

### Développement

Lancer le backend :

```bash
npm run start:server
```

Lancer le frontend dans un second terminal :

```bash
npm run dev:web
```

Ouvrir ensuite `http://localhost:5173`.

### Build frontend

```bash
npm run build:web
```

## Données de la version web

- les documents sont stockés dans `server/data/documents/`
- les macros sont stockées dans `server/data/macros/`

Ces répertoires servent aux données runtime et ne sont pas destinés à être versionnés, hors fichiers `.gitkeep`.

## Packaging Debian

Le dépôt contient une structure Debian pour produire un paquet `.deb` de l'application desktop GTK.

### Génération du paquet

```bash
./debian/build.sh 0.3.0
```

Le fichier généré est :

```text
dist/macroeditor_0.3.0_all.deb
```

## Raccourcis principaux

- `Ctrl/Cmd + S` : enregistrer
- `Ctrl/Cmd + Z` : undo
- `Ctrl/Cmd + Y` : redo
- `Ctrl/Cmd + F` : rechercher
- `Ctrl/Cmd + H` : remplacer
- `Ctrl/Cmd + Shift + R` : démarrer/arrêter l'enregistrement de macro
- `Ctrl/Cmd + Shift + P` : jouer la macro
- `Ctrl/Cmd + Alt + C` : activer/désactiver le mode colonne

## Release

Le tag recommandé pour cet état du projet est `v0.3.0`.
Il couvre la base GTK existante, l'ajout de la version web React/Express et les améliorations du moteur de macros et du mode colonne.

## Licence

MIT.
