"""JSON persistence for user macros."""

from __future__ import annotations

import json
from pathlib import Path

from editor.command_system import command_from_dict
from macros.macro import Macro


class MacroStorage:
    """Load and save macros under the user configuration directory."""

    def __init__(self) -> None:
        self.directory = Path.home() / ".config" / "macroeditor" / "macros"
        self.directory.mkdir(parents=True, exist_ok=True)

    def save_macro(self, macro: Macro) -> Path:
        """Persist one macro as JSON."""
        target = self.directory / f"{macro.name}.json"
        payload = {
            "name": macro.name,
            "actions": [action.to_dict() for action in macro.actions],
        }
        target.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return target

    def load_macro(self, path: Path) -> Macro:
        """Load a macro from a JSON file."""
        payload = json.loads(path.read_text(encoding="utf-8"))
        actions = [command_from_dict(item) for item in payload.get("actions", [])]
        return Macro(name=payload.get("name", path.stem), actions=actions)

    def load_all(self) -> dict[str, Macro]:
        """Load all macros stored on disk."""
        macros = {}
        for path in sorted(self.directory.glob("*.json")):
            try:
                macro = self.load_macro(path)
            except Exception:  # noqa: BLE001
                continue
            macros[macro.name] = macro
        return macros
