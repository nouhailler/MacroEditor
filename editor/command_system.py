"""Command pattern implementation for editor and macros."""

from __future__ import annotations

from dataclasses import dataclass


class EditorCommand:
    """Base command for editor actions."""

    action_name = "base"

    def execute(self, editor) -> None:
        """Execute the command against the editor."""
        raise NotImplementedError

    def to_dict(self) -> dict:
        """Serialize the command to a JSON-compatible dictionary."""
        return {"action": self.action_name}


@dataclass(slots=True)
class InsertTextCommand(EditorCommand):
    """Insert text at the current cursor position."""

    text: str
    action_name = "insert_text"

    def execute(self, editor) -> None:
        editor.insert_text_at_cursor(self.text)

    def to_dict(self) -> dict:
        return {"action": self.action_name, "text": self.text}


class DeleteCharCommand(EditorCommand):
    """Delete one character before the cursor."""

    action_name = "delete_char"

    def execute(self, editor) -> None:
        editor.delete_char()


class NewLineCommand(EditorCommand):
    """Insert a newline."""

    action_name = "newline"

    def execute(self, editor) -> None:
        editor.insert_text_at_cursor("\n")


class TabCommand(EditorCommand):
    """Insert a tab."""

    action_name = "tab"

    def execute(self, editor) -> None:
        editor.insert_text_at_cursor("\t")


@dataclass(slots=True)
class MoveCursorCommand(EditorCommand):
    """Move the cursor left or right."""

    direction: str
    action_name = "move_cursor"

    def execute(self, editor) -> None:
        editor.move_cursor(self.direction)

    def to_dict(self) -> dict:
        action = "move_cursor_left" if self.direction == "left" else "move_cursor_right"
        return {"action": action}


class CopyCommand(EditorCommand):
    """Copy the current selection."""

    action_name = "copy"

    def execute(self, editor) -> None:
        editor.copy_clipboard()


class PasteCommand(EditorCommand):
    """Paste the clipboard contents."""

    action_name = "paste"

    def execute(self, editor) -> None:
        editor.paste_clipboard()


class CutCommand(EditorCommand):
    """Cut the current selection."""

    action_name = "cut"

    def execute(self, editor) -> None:
        editor.cut_clipboard()


def command_from_dict(data: dict) -> EditorCommand:
    """Build a command instance from serialized JSON data."""
    action = data.get("action")
    if action == "insert_text":
        return InsertTextCommand(data.get("text", ""))
    if action == "delete_char":
        return DeleteCharCommand()
    if action == "newline":
        return NewLineCommand()
    if action == "tab":
        return TabCommand()
    if action == "move_cursor_left":
        return MoveCursorCommand("left")
    if action == "move_cursor_right":
        return MoveCursorCommand("right")
    if action == "copy":
        return CopyCommand()
    if action == "paste":
        return PasteCommand()
    if action == "cut":
        return CutCommand()
    raise ValueError(f"Unsupported macro action: {action}")
