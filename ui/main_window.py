"""Main application window for MacroEditor."""

from __future__ import annotations

from pathlib import Path

import gi

gi.require_version("Gtk", "4.0")

from gi.repository import Gio, GLib, Gtk

from editor.macro_recorder import MacroRecorder
from editor.text_editor import EditorError, TextEditor
from macros.macro_player import MacroPlayer
from ui.statusbar import StatusBar
from ui.toolbar import Toolbar


class EntryDialog(Gtk.Dialog):
    """Small dialog used for one or more text inputs."""

    def __init__(self, parent, title: str, fields: list[tuple[str, str]]) -> None:
        super().__init__(title=title, transient_for=parent, modal=True)
        self.values = {}
        self.entries = {}
        self.add_button("Cancel", Gtk.ResponseType.CANCEL)
        self.add_button("OK", Gtk.ResponseType.OK)
        box = self.get_content_area()
        box.set_margin_top(12)
        box.set_margin_bottom(12)
        box.set_margin_start(12)
        box.set_margin_end(12)
        box.set_spacing(12)
        for label_text, default in fields:
            row = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
            label = Gtk.Label(label=label_text, xalign=0)
            entry = Gtk.Entry()
            entry.set_text(default)
            row.append(label)
            row.append(entry)
            box.append(row)
            self.entries[label_text] = entry

    def read_values(self) -> dict[str, str]:
        """Return current field values."""
        return {label: entry.get_text().strip() for label, entry in self.entries.items()}

    def add_extra_button(self, label: str, response: int) -> None:
        """Add an extra action button to the dialog."""
        self.add_button(label, response)


class MessageDialog(Gtk.Dialog):
    """Simple GTK4-compatible message dialog."""

    def __init__(self, parent, title: str, message: str) -> None:
        super().__init__(title=title, transient_for=parent, modal=True)
        self.add_button("OK", Gtk.ResponseType.OK)
        box = self.get_content_area()
        box.set_margin_top(12)
        box.set_margin_bottom(12)
        box.set_margin_start(12)
        box.set_margin_end(12)
        label = Gtk.Label(label=message, wrap=True, xalign=0)
        box.append(label)


class MainWindow(Gtk.ApplicationWindow):
    """Main GTK window composing the editor UI and macro features."""

    def __init__(self, application, storage) -> None:
        super().__init__(application=application, title="MacroEditor")
        self.storage = storage
        self.recorder = MacroRecorder()
        self.macros = self.storage.load_all()
        self.current_macro = None
        self.current_encoding = "UTF-8"

        self.set_default_size(1000, 700)

        layout = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self.set_child(layout)

        self.menu_bar = Gtk.PopoverMenuBar.new_from_model(self._build_menu_model())
        layout.append(self.menu_bar)

        self.toolbar = Toolbar(self._on_toolbar_clicked)
        layout.append(self.toolbar)

        self.statusbar = StatusBar()
        self.player = None
        self.editor = TextEditor(
            recorder=self.recorder,
            on_status_changed=self._on_editor_status_changed,
            on_error=self.show_error,
        )
        self.player = MacroPlayer(
            editor=self.editor,
            on_error=self.show_error,
            on_finished=self._on_macro_finished,
        )
        layout.append(self.editor)
        layout.append(self.statusbar)

        self._create_actions()
        self._update_macro_menu()
        self._refresh_status()

    def open_gfile(self, gfile) -> None:
        """Open a Gio.File selected by the application or dialog."""
        path = gfile.get_path()
        if path:
            self._safe_editor_call(self.editor.open_path, Path(path))

    def _create_actions(self) -> None:
        action_map = {
            "new": self._action_new,
            "open": self._action_open,
            "save": self._action_save,
            "save_as": self._action_save_as,
            "quit": self._action_quit,
            "undo": self._action_undo,
            "redo": self._action_redo,
            "copy": self._action_copy,
            "cut": self._action_cut,
            "paste": self._action_paste,
            "find": self._action_find,
            "replace": self._action_replace,
            "start_recording": self._action_start_recording,
            "stop_recording": self._action_stop_recording,
            "play_macro": self._action_play_macro,
            "save_macro": self._action_save_macro,
            "load_macro": self._action_load_macro,
            "about": self._action_about,
        }
        for name, callback in action_map.items():
            action = Gio.SimpleAction.new(name, None)
            action.connect("activate", callback)
            self.get_application().add_action(action)
        initial_name = self.current_macro.name if self.current_macro else ""
        select_macro = Gio.SimpleAction.new_stateful(
            "select_macro",
            GLib.VariantType.new("s"),
            GLib.Variant("s", initial_name),
        )
        select_macro.connect("activate", self._action_select_macro)
        self.add_action(select_macro)

    def _build_menu_model(self) -> Gio.Menu:
        menu = Gio.Menu()

        file_menu = Gio.Menu()
        file_menu.append("New", "app.new")
        file_menu.append("Open", "app.open")
        file_menu.append("Save", "app.save")
        file_menu.append("Save As", "app.save_as")
        file_menu.append("Quit", "app.quit")

        edit_menu = Gio.Menu()
        edit_menu.append("Undo", "app.undo")
        edit_menu.append("Redo", "app.redo")
        edit_menu.append("Copy", "app.copy")
        edit_menu.append("Cut", "app.cut")
        edit_menu.append("Paste", "app.paste")
        edit_menu.append("Find", "app.find")
        edit_menu.append("Replace", "app.replace")

        self.macros_menu = Gio.Menu()
        self.macros_menu.append("Start Recording", "app.start_recording")
        self.macros_menu.append("Stop Recording", "app.stop_recording")
        self.macros_menu.append("Play Macro", "app.play_macro")
        self.macros_menu.append("Save Macro", "app.save_macro")
        self.macros_menu.append("Load Macro", "app.load_macro")

        help_menu = Gio.Menu()
        help_menu.append("About", "app.about")

        menu.append_submenu("File", file_menu)
        menu.append_submenu("Edit", edit_menu)
        menu.append_submenu("Macros", self.macros_menu)
        menu.append_submenu("Help", help_menu)
        return menu

    def _update_macro_menu(self) -> None:
        while self.macros_menu.get_n_items() > 5:
            self.macros_menu.remove(5)
        if not self.macros:
            return
        section = Gio.Menu()
        self.macros_menu.append_section("Saved Macros", section)
        for name in sorted(self.macros):
            item = Gio.MenuItem.new(name, None)
            item.set_action_and_target_value("win.select_macro", GLib.Variant("s", name))
            section.append_item(item)

    def _on_toolbar_clicked(self, _button, action_name: str) -> None:
        action = self.get_application().lookup_action(action_name)
        if action:
            action.activate(None)

    def _on_editor_status_changed(self, line: int, column: int) -> None:
        self._refresh_status(line, column)

    def _refresh_status(self, line: int = 1, column: int = 1) -> None:
        state = "Recording" if self.recorder.is_recording else "Idle"
        if self.player is not None and self.player.is_running:
            state = "Playing"
        if hasattr(self, "editor"):
            self.current_encoding = self.editor.encoding
        self.statusbar.update_status(line, column, self.current_encoding, state)

    def _action_new(self, *_args) -> None:
        self.editor.new_file()

    def _action_open(self, *_args) -> None:
        dialog = Gtk.FileChooserNative(
            title="Open File",
            transient_for=self,
            action=Gtk.FileChooserAction.OPEN,
            accept_label="Open",
            cancel_label="Cancel",
        )
        dialog.connect("response", self._on_open_response)
        dialog.show()

    def _on_open_response(self, dialog, response) -> None:
        if response == Gtk.ResponseType.ACCEPT:
            file_ = dialog.get_file()
            if file_:
                self.open_gfile(file_)
        dialog.destroy()

    def _action_save(self, *_args) -> None:
        if self.editor.file_path is None:
            self._action_save_as()
            return
        self._safe_editor_call(self.editor.save)

    def _action_save_as(self, *_args) -> None:
        dialog = Gtk.FileChooserNative(
            title="Save File As",
            transient_for=self,
            action=Gtk.FileChooserAction.SAVE,
            accept_label="Save",
            cancel_label="Cancel",
        )
        dialog.connect("response", self._on_save_as_response)
        dialog.show()

    def _on_save_as_response(self, dialog, response) -> None:
        if response == Gtk.ResponseType.ACCEPT:
            file_ = dialog.get_file()
            path = file_.get_path() if file_ else None
            if path:
                self._safe_editor_call(self.editor.save_as, Path(path))
        dialog.destroy()

    def _action_quit(self, *_args) -> None:
        self.get_application().quit()

    def _action_undo(self, *_args) -> None:
        self.editor.undo()

    def _action_redo(self, *_args) -> None:
        self.editor.redo()

    def _action_copy(self, *_args) -> None:
        self.editor.copy_clipboard()

    def _action_cut(self, *_args) -> None:
        self.editor.cut_clipboard()

    def _action_paste(self, *_args) -> None:
        self.editor.paste_clipboard()

    def _action_find(self, *_args) -> None:
        dialog = EntryDialog(self, "Find Text", [("Find", self.editor.last_search)])
        dialog.connect("response", self._on_find_response)
        dialog.present()

    def _on_find_response(self, dialog, response) -> None:
        if response == Gtk.ResponseType.OK:
            values = dialog.read_values()
            if not self.editor.find_next(values["Find"]):
                self.show_error("Text not found.")
        dialog.destroy()

    def _action_replace(self, *_args) -> None:
        dialog = EntryDialog(self, "Replace Text", [("Find", self.editor.last_search), ("Replace", "")])
        dialog.add_extra_button("Replace All", Gtk.ResponseType.APPLY)
        dialog.connect("response", self._on_replace_response)
        dialog.present()

    def _on_replace_response(self, dialog, response) -> None:
        if response == Gtk.ResponseType.OK:
            values = dialog.read_values()
            if not self.editor.replace_next(values["Find"], values["Replace"]):
                self.show_error("Text not found.")
        elif response == Gtk.ResponseType.APPLY:
            values = dialog.read_values()
            replaced = self.editor.replace_all(values["Find"], values["Replace"])
            if replaced == 0:
                self.show_error("Text not found.")
            else:
                suffix = "occurrence" if replaced == 1 else "occurrences"
                self.show_info(f"{replaced} {suffix} replaced.")
        dialog.destroy()

    def _action_start_recording(self, *_args) -> None:
        if self.player.is_running:
            self.show_error("Cannot record while a macro is playing.")
            return
        self.recorder.start()
        self.current_macro = None
        self._refresh_status()

    def _action_stop_recording(self, *_args) -> None:
        if not self.recorder.is_recording:
            self.show_error("No recording is currently active.")
            return
        dialog = EntryDialog(self, "Save Recording", [("Macro Name", "macro")])
        dialog.connect("response", self._on_stop_recording_response)
        dialog.present()

    def _on_stop_recording_response(self, dialog, response) -> None:
        if response == Gtk.ResponseType.OK:
            values = dialog.read_values()
            name = values["Macro Name"] or "macro"
            self.current_macro = self.recorder.stop(name)
            self.macros[self.current_macro.name] = self.current_macro
            self.lookup_action("select_macro").set_state(GLib.Variant("s", name))
            self._refresh_status()
        else:
            self.recorder.stop("discarded")
            self.current_macro = None
            self._refresh_status()
        self._update_macro_menu()
        dialog.destroy()

    def _action_play_macro(self, *_args) -> None:
        if not self.macros:
            self.show_error("No macro is available.")
            return
        default_name = self.current_macro.name if self.current_macro else next(iter(sorted(self.macros)))
        defaults = [("Macro Name", default_name), ("Repeat Count", "1")]
        dialog = EntryDialog(self, "Play Macro", defaults)
        dialog.connect("response", self._on_play_macro_response)
        dialog.present()

    def _on_play_macro_response(self, dialog, response) -> None:
        if response == Gtk.ResponseType.OK:
            values = dialog.read_values()
            name = values["Macro Name"]
            macro = self.macros.get(name)
            if not macro:
                self.show_error(f"Unknown macro: {name}")
            else:
                try:
                    repeat_count = int(values["Repeat Count"] or "1")
                except ValueError:
                    self.show_error("Repeat count must be an integer.")
                else:
                    self.current_macro = macro
                    self.lookup_action("select_macro").set_state(GLib.Variant("s", name))
                    self.player.play_macro(macro, repeat_count)
                    self._refresh_status()
        dialog.destroy()

    def _action_save_macro(self, *_args) -> None:
        macro = self.current_macro
        if macro is None:
            self.show_error("No macro selected to save.")
            return
        self.storage.save_macro(macro)
        self.macros[macro.name] = macro
        self._update_macro_menu()

    def _action_load_macro(self, *_args) -> None:
        self.macros = self.storage.load_all()
        if self.macros and self.current_macro is None:
            name = next(iter(sorted(self.macros)))
            self.current_macro = self.macros[name]
            self.lookup_action("select_macro").set_state(GLib.Variant("s", name))
        self._update_macro_menu()

    def _action_about(self, *_args) -> None:
        dialog = Gtk.AboutDialog(
            transient_for=self,
            modal=True,
            program_name="MacroEditor",
            comments="Minimal GTK4 text editor with semantic macro recording.",
        )
        dialog.present()

    def _action_select_macro(self, action, parameter) -> None:
        if parameter is None:
            return
        name = parameter.get_string()
        macro = self.macros.get(name)
        if macro is None:
            self.show_error(f"Unknown macro: {name}")
            return
        self.current_macro = macro
        action.set_state(parameter)

    def _on_macro_finished(self) -> None:
        self._refresh_status()

    def _safe_editor_call(self, callback, *args) -> None:
        try:
            callback(*args)
        except EditorError as exc:
            self.show_error(str(exc))
        except OSError as exc:
            self.show_error(str(exc))

    def show_error(self, message: str) -> None:
        """Display a non-fatal error dialog."""
        dialog = MessageDialog(self, "MacroEditor Error", message)
        dialog.connect("response", lambda dlg, _response: dlg.destroy())
        dialog.present()

    def show_info(self, message: str) -> None:
        """Display an informational dialog."""
        dialog = MessageDialog(self, "MacroEditor", message)
        dialog.connect("response", lambda dlg, _response: dlg.destroy())
        dialog.present()
