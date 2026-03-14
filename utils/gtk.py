"""GTK version bootstrap helpers."""

from __future__ import annotations

import gi


def require_gtk_versions() -> None:
    """Require the GTK4 + GtkSourceView 5 stack expected by the project."""
    gi.require_version("Gtk", "4.0")
    try:
        gi.require_version("GtkSource", "5")
    except ValueError as exc:
        raise RuntimeError(
            "MacroEditor requires GtkSourceView 5 for GTK4. "
            "Install the GTK4 bindings for GtkSourceView 5 on this system."
        ) from exc
