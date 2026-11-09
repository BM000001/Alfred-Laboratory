#!/usr/bin/env python3
"""Validate Alfred's Codex profile definitions without network or model calls.

Run: python3 scripts/check-agent-profiles.py
Requires Python 3.11+ (stdlib tomllib).
"""

from __future__ import annotations

import re
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROFILES = ROOT / ".codex" / "agents"
CONFIG = ROOT / ".codex" / "config.toml"
REQUIRED = {
    "docs_researcher",
    "explorer",
    "implementer",
    "planner",
    "qa",
    "reviewer",
    "security_reviewer",
    "ux_reviewer",
}
REQUIRED_KEYS = ("name", "description", "developer_instructions")


def check() -> list[str]:
    errors: list[str] = []
    if not CONFIG.is_file():
        return [f"Missing Codex config: {CONFIG.relative_to(ROOT)}"]
    if not PROFILES.is_dir():
        return [f"Missing agent directory: {PROFILES.relative_to(ROOT)}"]

    try:
        config = tomllib.loads(CONFIG.read_text(encoding="utf-8"))
        settings = config["agents"]
        if settings.get("enabled") is not True:
            errors.append(".codex/config.toml: agents.enabled must be true")
        limit = settings.get("max_concurrent_threads_per_session")
        if type(limit) is not int or not 1 <= limit <= 3:
            errors.append(".codex/config.toml: agent concurrency must be an integer from 1 to 3")
    except (tomllib.TOMLDecodeError, OSError, KeyError, TypeError) as exc:
        errors.append(f".codex/config.toml: {exc}")

    seen: set[str] = set()
    for profile in sorted(PROFILES.glob("*.toml")):
        try:
            data = tomllib.loads(profile.read_text(encoding="utf-8"))
        except (tomllib.TOMLDecodeError, OSError) as exc:
            errors.append(f"{profile.name}: invalid TOML: {exc}")
            continue

        for key in REQUIRED_KEYS:
            value = data.get(key)
            if not isinstance(value, str) or not value.strip():
                errors.append(f"{profile.name}: missing nonempty {key}")
        name = data.get("name")
        if not isinstance(name, str):
            continue
        if not re.fullmatch(r"[a-z][a-z0-9_]*", name):
            errors.append(f"{profile.name}: invalid agent name {name!r}")
        if name != profile.stem.replace("-", "_"):
            errors.append(f"{profile.name}: filename/name mismatch ({name})")
        if name in seen:
            errors.append(f"{profile.name}: duplicate agent name {name!r}")
        seen.add(name)

    for name in sorted(REQUIRED - seen):
        errors.append(f"Missing required profile: {name}")
    return errors


if __name__ == "__main__":
    if sys.version_info < (3, 11):
        sys.exit("Python 3.11+ is required for tomllib")
    failures = check()
    if failures:
        for failure in failures:
            print(f"ERROR: {failure}", file=sys.stderr)
        sys.exit(1)
    print(f"Agent profile validation passed ({len(list(PROFILES.glob('*.toml')))} profiles, concurrency <= 3).")
