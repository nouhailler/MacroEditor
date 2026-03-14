"""Macro model definition."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(slots=True)
class Macro:
    """A named list of editor commands."""

    name: str
    actions: list = field(default_factory=list)
