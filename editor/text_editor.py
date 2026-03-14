"""GtkSourceView-backed text editor widget."""

from __future__ import annotations

import gi

from utils.gtk import require_gtk_versions

require_gtk_versions()

from gi.repository import Gdk, Gtk, GtkSource

from editor.command_system import CopyCommand, CutCommand, PasteCommand
from utils.encoding import read_text_file, write_text_file


class EditorError(RuntimeError):
    """Raised for invalid editor operations."""


class TextEditor(Gtk.Box):
    """Composite widget wrapping GtkSourceView."""

    def __init__(self, recorder, on_status_changed, on_error) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL)
        self.recorder = recorder
        self.on_status_changed = on_status_changed
        self.on_error = on_error
        self.file_path = None
        self.encoding = "UTF-8"
        self.last_search = ""

        self.buffer = GtkSource.Buffer()
        self.buffer.set_highlight_syntax(False)
        self.buffer.set_highlight_matching_brackets(True)
        self.buffer.connect("insert-text", self._on_insert_text)
        self.buffer.connect("delete-range", self._on_delete_range)
        self.buffer.connect("notify::cursor-position", self._on_cursor_position_changed)

        self.view = GtkSource.View.new_with_buffer(self.buffer)
        self.view.set_show_line_numbers(True)
        self.view.set_monospace(True)
        self.view.set_tab_width(4)
        self.view.set_insert_spaces_instead_of_tabs(False)
        self.view.set_hexpand(True)
        self.view.set_vexpand(True)
        self.view.connect("move-cursor", self._on_move_cursor)

        scrolled = Gtk.ScrolledWindow()
        scrolled.set_hexpand(True)
        scrolled.set_vexpand(True)
        scrolled.set_child(self.view)
        self.append(scrolled)
        self._notify_status()

    def new_file(self) -> None:
        """Reset the editor to a blank document."""
        self.buffer.set_text("")
        self.file_path = None
        self.encoding = "UTF-8"
        self.buffer.set_modified(False)
        self._notify_status()

    def open_path(self, path) -> None:
        """Load text from a file path."""
        text, encoding = read_text_file(path)
        self.buffer.set_text(text)
        self.file_path = path
        self.encoding = encoding
        self.buffer.set_modified(False)
        self._notify_status()

    def save(self) -> None:
        """Save to the current file path."""
        if self.file_path is None:
            raise EditorError("No file selected for saving.")
        write_text_file(self.file_path, self.get_text(), self.encoding)
        self.buffer.set_modified(False)

    def save_as(self, path) -> None:
        """Save to a new file path."""
        self.file_path = path
        self.save()

    def get_text(self) -> str:
        """Return the full buffer content."""
        start = self.buffer.get_start_iter()
        end = self.buffer.get_end_iter()
        return self.buffer.get_text(start, end, True)

    def insert_text_at_cursor(self, text: str) -> None:
        """Insert text at the cursor."""
        self.buffer.insert_at_cursor(text)

    def delete_char(self) -> None:
        """Delete one character before the cursor."""
        insert_mark = self.buffer.get_insert()
        end_iter = self.buffer.get_iter_at_mark(insert_mark)
        if end_iter.starts_line() and end_iter.get_offset() == 0:
            raise EditorError("Nothing to delete at the current cursor position.")
        start_iter = end_iter.copy()
        if not start_iter.backward_char():
            raise EditorError("Nothing to delete at the current cursor position.")
        self.buffer.delete(start_iter, end_iter)

    def move_cursor(self, direction: str) -> None:
        """Move the cursor left or right."""
        current = self.buffer.get_iter_at_mark(self.buffer.get_insert())
        moved = current.backward_char() if direction == "left" else current.forward_char()
        if not moved:
            raise EditorError(f"Cannot move cursor {direction}.")
        self.buffer.place_cursor(current)
        self.view.scroll_to_iter(current, 0.2, False, 0.0, 0.0)
        self._notify_status()

    def copy_clipboard(self) -> None:
        """Copy selection to the clipboard."""
        clipboard = self._clipboard()
        self.buffer.copy_clipboard(clipboard)
        self.recorder.record(CopyCommand())

    def cut_clipboard(self) -> None:
        """Cut selection to the clipboard and record it semantically."""
        clipboard = self._clipboard()
        with self.recorder.suspend():
            self.buffer.cut_clipboard(clipboard, True)
        self.recorder.record(CutCommand())

    def paste_clipboard(self) -> None:
        """Paste clipboard contents and record it semantically."""
        clipboard = self._clipboard()
        with self.recorder.suspend():
            self.buffer.paste_clipboard(clipboard, None, True)
        self.recorder.record(PasteCommand())

    def undo(self) -> None:
        """Undo the last user action."""
        if self.buffer.can_undo():
            self.buffer.undo()

    def redo(self) -> None:
        """Redo the last undone user action."""
        if self.buffer.can_redo():
            self.buffer.redo()

    def find_next(self, needle: str) -> bool:
        """Find the next occurrence of text in the buffer."""
        if not needle:
            return False
        self.last_search = needle
        content = self.get_text()
        current_offset = self.buffer.get_iter_at_mark(self.buffer.get_insert()).get_offset()
        position = content.find(needle, current_offset)
        if position == -1 and current_offset > 0:
            position = content.find(needle, 0)
        if position == -1:
            return False
        start = self.buffer.get_iter_at_offset(position)
        end = self.buffer.get_iter_at_offset(position + len(needle))
        self.buffer.select_range(start, end)
        self.view.scroll_to_iter(start, 0.2, False, 0.0, 0.0)
        self._notify_status()
        return True

    def replace_next(self, needle: str, replacement: str) -> bool:
        """Replace the currently selected occurrence or the next match."""
        if not self.find_next(needle):
            return False
        bounds = self.buffer.get_selection_bounds()
        if not bounds:
            return False
        start, end = bounds
        with self.recorder.suspend():
            self.buffer.delete(start, end)
            self.buffer.insert(start, replacement)
        return True

    def replace_all(self, needle: str, replacement: str) -> int:
        """Replace all occurrences of text in the buffer."""
        if not needle:
            return 0
        content = self.get_text()
        count = content.count(needle)
        if count == 0:
            return 0
        updated = content.replace(needle, replacement)
        cursor_offset = self.buffer.get_iter_at_mark(self.buffer.get_insert()).get_offset()
        with self.recorder.suspend():
            self.buffer.begin_user_action()
            self.buffer.set_text(updated)
            new_offset = min(cursor_offset, self.buffer.get_char_count())
            self.buffer.place_cursor(self.buffer.get_iter_at_offset(new_offset))
            self.buffer.end_user_action()
        self._notify_status()
        return count

    def _clipboard(self):
        display = Gdk.Display.get_default()
        return display.get_clipboard()

    def _on_insert_text(self, _buffer, _iter, text, length) -> None:
        if length > 0:
            self.recorder.handle_insert_text(text[:length])

    def _on_delete_range(self, _buffer, start_iter, end_iter) -> None:
        deleted_text = self.buffer.get_text(start_iter, end_iter, True)
        if deleted_text:
            self.recorder.handle_delete(deleted_text)

    def _on_move_cursor(self, _view, step, count, extend_selection) -> None:
        if extend_selection or count == 0:
            return
        if step == Gtk.MovementStep.LOGICAL_POSITIONS:
            direction = "right" if count > 0 else "left"
            for _ in range(abs(count)):
                self.recorder.record_cursor_move(direction)

    def _on_cursor_position_changed(self, *_args) -> None:
        self._notify_status()

    def _notify_status(self) -> None:
        insert = self.buffer.get_iter_at_mark(self.buffer.get_insert())
        self.on_status_changed(insert.get_line() + 1, insert.get_line_offset() + 1)
