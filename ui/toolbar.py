"""Toolbar widget for MacroEditor."""

import gi

gi.require_version("Gtk", "4.0")

from gi.repository import Gtk


class Toolbar(Gtk.Box):
    """Primary action toolbar."""

    def __init__(self, on_action) -> None:
        super().__init__(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
        self.set_margin_top(6)
        self.set_margin_bottom(6)
        self.set_margin_start(6)
        self.set_margin_end(6)

        buttons = [
            ("document-new-symbolic", "New", on_action, "new"),
            ("document-open-symbolic", "Open", on_action, "open"),
            ("document-save-symbolic", "Save", on_action, "save"),
            ("media-record-symbolic", "Record", on_action, "start_recording"),
            ("media-playback-stop-symbolic", "Stop", on_action, "stop_recording"),
            ("media-playback-start-symbolic", "Play", on_action, "play_macro"),
        ]
        for icon_name, tooltip, callback, action_name in buttons:
            button = Gtk.Button()
            button.set_tooltip_text(tooltip)
            button.set_child(Gtk.Image.new_from_icon_name(icon_name))
            button.connect("clicked", callback, action_name)
            self.append(button)
