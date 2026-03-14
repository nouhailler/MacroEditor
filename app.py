"""GTK application bootstrap for MacroEditor."""

import gi

from utils.gtk import require_gtk_versions

require_gtk_versions()

from gi.repository import Gio, Gtk

from macros.macro_storage import MacroStorage
from ui.main_window import MainWindow


class MacroEditorApplication(Gtk.Application):
    """Main GTK application class."""

    def __init__(self) -> None:
        super().__init__(
            application_id="org.example.macroeditor",
            flags=Gio.ApplicationFlags.HANDLES_OPEN,
        )
        self.storage = MacroStorage()
        self.window: MainWindow | None = None
        self._register_accels()

    def do_activate(self) -> None:
        """Create the main window if needed and present it."""
        if self.window is None:
            self.window = MainWindow(application=self, storage=self.storage)
        self.window.present()

    def do_open(self, files, _n_files, _hint) -> None:
        """Open files passed by the desktop shell."""
        self.do_activate()
        if files:
            self.window.open_gfile(files[0])

    def _register_accels(self) -> None:
        """Install application-level keyboard shortcuts."""
        accelerators = {
            "app.new": ["<Primary>n"],
            "app.open": ["<Primary>o"],
            "app.save": ["<Primary>s"],
            "app.save_as": ["<Primary><Shift>s"],
            "app.quit": ["<Primary>q"],
            "app.undo": ["<Primary>z"],
            "app.redo": ["<Primary><Shift>z", "<Primary>y"],
            "app.copy": ["<Primary>c"],
            "app.cut": ["<Primary>x"],
            "app.paste": ["<Primary>v"],
            "app.find": ["<Primary>f"],
            "app.replace": ["<Primary>h"],
            "app.start_recording": ["<Primary><Shift>r"],
            "app.stop_recording": ["<Primary><Shift>t"],
            "app.play_macro": ["<Primary><Shift>p"],
            "app.save_macro": ["<Primary><Shift>m"],
            "app.load_macro": ["<Primary><Shift>l"],
        }
        for action, accels in accelerators.items():
            self.set_accels_for_action(action, accels)
