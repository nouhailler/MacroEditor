"""Macro recording logic for semantic editor actions."""

from __future__ import annotations

from contextlib import contextmanager

from editor.command_system import (
    DeleteCharCommand,
    InsertTextCommand,
    MoveCursorCommand,
    NewLineCommand,
    TabCommand,
)
from macros.macro import Macro


class MacroRecorder:
    """Record semantic editor commands while the user edits text."""

    def __init__(self) -> None:
        self.is_recording = False
        self.current_macro_actions = []
        self._ignore_signals = 0

    def start(self) -> None:
        """Begin recording a new macro."""
        self.is_recording = True
        self.current_macro_actions = []

    def stop(self, name: str = "macro") -> Macro:
        """Stop recording and return a Macro object."""
        self.is_recording = False
        return Macro(name=name, actions=list(self.current_macro_actions))

    def record(self, command) -> None:
        """Record a command if recording is active and signals are not suppressed."""
        if self.is_recording and self._ignore_signals == 0:
            self.current_macro_actions.append(command)

    @contextmanager
    def suspend(self):
        """Temporarily ignore buffer-level signals."""
        self._ignore_signals += 1
        try:
            yield
        finally:
            self._ignore_signals -= 1

    def handle_insert_text(self, text: str) -> None:
        """Record semantic insert operations from buffer signals."""
        if text == "\n":
            self.record(NewLineCommand())
            return
        if text == "\t":
            self.record(TabCommand())
            return
        self.record(InsertTextCommand(text))

    def handle_delete(self, deleted_text: str) -> None:
        """Record delete operations based on deleted text length."""
        for _ in deleted_text:
            self.record(DeleteCharCommand())

    def record_cursor_move(self, direction: str) -> None:
        """Record explicit cursor movements."""
        self.record(MoveCursorCommand(direction))
