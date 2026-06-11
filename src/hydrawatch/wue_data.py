"""Load per-region WUE from generated data file."""

from __future__ import annotations

import json
from pathlib import Path

from hydrawatch.constants import WUE as LEGACY_WUE

_DATA = Path(__file__).resolve().parents[2] / "data" / "wue_by_region.json"
_cache: dict[str, float] | None = None


def load_wue_table() -> dict[str, float]:
    global _cache
    if _cache is not None:
        return _cache
    if _DATA.exists():
        _cache = {**LEGACY_WUE, **json.loads(_DATA.read_text())}
    else:
        _cache = dict(LEGACY_WUE)
    return _cache


def get_wue(region_code: str) -> float:
    return load_wue_table().get(region_code, load_wue_table().get("DEFAULT", 1.8))
