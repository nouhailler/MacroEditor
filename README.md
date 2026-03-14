# MacroEditor

Un editeur de texte graphique sous Linux ecrit en Python dont la fonctionnalite principale est l'enregistrement et la relecture de macros a la volee via l'interface graphique.

## Apercu

`MacroEditor` combine un editeur texte simple avec un systeme de macros en direct :

- 📝 edition de texte classique
- ⏺️ enregistrement de macros semantiques
- ▶️ lecture de macros sans bloquer l'interface
- 💾 sauvegarde des macros en JSON
- 🔎 recherche et remplacement
- 🔁 remplacement global avec compteur d'occurrences

## Fonctionnalites

### Editeur

- 📄 Nouveau fichier
- 📂 Ouvrir un fichier
- 💾 Enregistrer / Enregistrer sous
- ✂️ Copier / Couper / Coller
- ↩️ Undo / Redo
- 🔎 Recherche avec `Ctrl+F`
- ♻️ Remplacement avec `Ctrl+H`
- 🔢 Numeros de ligne via `GtkSourceView`
- 🔤 Encodage UTF-8

### Macros

- ⏺️ Demarrer un enregistrement
- ⏹️ Arreter l'enregistrement
- ▶️ Rejouer une macro
- 🔁 Rejouer une macro plusieurs fois
- 🗂️ Charger automatiquement les macros au demarrage
- 💾 Stocker les macros en JSON dans `~/.config/macroeditor/macros/`

## Philosophie

Les macros enregistrent des actions semantiques plutot que des keycodes clavier.

Exemple :

```json
{
  "name": "example_macro",
  "actions": [
    {"action": "insert_text", "text": "Hello"},
    {"action": "newline"},
    {"action": "insert_text", "text": "World"}
  ]
}
```

## Structure Du Projet

```text
macroeditor/
├── main.py
├── app.py
├── ui/
│   ├── main_window.py
│   ├── toolbar.py
│   └── statusbar.py
├── editor/
│   ├── text_editor.py
│   ├── command_system.py
│   └── macro_recorder.py
├── macros/
│   ├── macro.py
│   ├── macro_player.py
│   └── macro_storage.py
└── utils/
    ├── encoding.py
    └── gtk.py
```

## Prerequis

- 🐍 Python 3.11+
- 🧩 PyGObject
- 🧱 GTK 4
- ✨ GtkSourceView 5
- 🐧 Linux

## Installation

### Debian 13+

```bash
sudo apt-get update
sudo apt-get install -y python3-gi gir1.2-gtk-4.0 gir1.2-gtksource-5
```

### Verification

```bash
python3 -c "import gi; gi.require_version('Gtk', '4.0'); gi.require_version('GtkSource', '5'); from gi.repository import Gtk, GtkSource; print('OK')"
```

## Lancement

Depuis la racine du projet :

```bash
python3 main.py
```

## Utilisation Rapide

### Enregistrer une macro

1. Lance l'application.
2. Ouvre ou cree un document.
3. Va dans `Macros > Start Recording`.
4. Effectue les actions a enregistrer.
5. Va dans `Macros > Stop Recording`.
6. Donne un nom a la macro.

### Rejouer une macro

1. Va dans `Macros > Play Macro`.
2. Saisis le nom de la macro.
3. Choisis un nombre de repetitions.

### Rechercher et remplacer

- `Ctrl+F` : rechercher le texte suivant
- `Ctrl+H` : remplacer l'occurrence suivante ou toutes les occurrences

## Undo / Redo

L'execution complete d'une macro est groupee en une seule action `Undo` grace a `begin_user_action()` / `end_user_action()`.

## Stockage Des Macros

Les macros sont sauvegardees ici :

```text
~/.config/macroeditor/macros/
```

## Etat Du Projet

Version actuelle : MVP fonctionnel.

Points deja presents :

- interface GTK4
- editeur base sur `GtkSourceView`
- systeme de commandes
- enregistrement et lecture de macros
- persistance JSON
- recherche et remplacement global

## Licence

Projet open source. Ajoute la licence de ton choix avant publication, par exemple `MIT`.
