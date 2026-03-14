"""Status bar widget for MacroEditor."""

import gi

gi.require_version("Gtk", "4.0")

from gi.repository import Gtk


class StatusBar(Gtk.Box):
    """Simple status bar showing cursor, encoding and macro state."""

    def __init__(self) -> None:
        super().__init__(orientation=Gtk.Orientation.HORIZONTAL, spacing=12)
        self.set_margin_top(6)
        self.set_margin_bottom(6)
        self.set_margin_start(12)
        self.set_margin_end(12)

        self.label = Gtk.Label(xalign=0)
        self.append(self.label)
        self.update_status(1, 1, "UTF-8", "Idle")

    def update_status(self, line: int, column: int, encoding: str, macro_state: str) -> None:
        """Update the displayed status text."""
        self.label.set_text(f"Ln {line}, Col {column} | {encoding} | {macro_state}")
