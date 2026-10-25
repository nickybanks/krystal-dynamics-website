#!/usr/bin/env python3
"""Generate /versions/*.json from assets/data/plugins.json (single source of truth).

Outputs per plugin:
  <slug>_version.json    legacy schema, read by released plugins (do not change keys)
  <slug>_changelog.json  full history, read by plugins with the new UpdateNotifier

Usage: python3 tools/build_versions.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets" / "data" / "plugins.json"
OUT_DIR = ROOT / "versions"
SITE_URL = "https://krystaldynamics.com"
VERSION_RE = re.compile(r"^\d+\.\d+\.\d+$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def version_key(version):
    return tuple(int(part) for part in version.split("."))


def release_notes(release):
    """Flat list of notes; a group without items contributes its title."""
    notes = []
    for group in release["groups"]:
        notes.extend(group["items"] or [group["title"]])
    return notes


def validate(plugin):
    history = plugin["history"]
    if not history:
        raise ValueError(f"{plugin['id']}: empty history")
    for release in history:
        if not VERSION_RE.match(release["version"]):
            raise ValueError(f"{plugin['id']}: bad version {release['version']!r}")
        if not DATE_RE.match(release["date"]):
            raise ValueError(f"{plugin['id']} {release['version']}: date must be YYYY-MM-DD")
    keys = [version_key(r["version"]) for r in history]
    if keys != sorted(keys, reverse=True) or len(set(keys)) != len(keys):
        raise ValueError(f"{plugin['id']}: history must be unique and newest first")


def build_files(plugin):
    latest = plugin["history"][0]
    release_date = max(latest["date"], plugin.get("publicRelease", ""))
    download_url = SITE_URL + plugin["page"].removesuffix(".html")

    legacy = {
        "version": latest["version"],
        "releaseDate": release_date,
        "releaseNotes": "\n".join(f"- {note}" for note in release_notes(latest)),
        "downloadUrl": download_url,
    }
    changelog = {
        **legacy,
        "releases": [
            {"version": r["version"], "date": r["date"], "notes": release_notes(r)}
            for r in plugin["history"]
        ],
    }

    slug = plugin["downloadSlug"]
    files = {f"{slug}_version.json": legacy, f"{slug}_changelog.json": changelog}
    for alias in plugin.get("versionFileAliases", []):
        files[alias] = legacy
    return files


def write_json(path, data):
    text = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    if path.exists() and path.read_text(encoding="utf-8") == text:
        return False
    path.write_text(text, encoding="utf-8")
    return True


def main():
    plugins = json.loads(SOURCE.read_text(encoding="utf-8"))["plugins"]
    OUT_DIR.mkdir(exist_ok=True)
    for plugin in plugins:
        validate(plugin)
        for name, data in build_files(plugin).items():
            if write_json(OUT_DIR / name, data):
                print(f"updated versions/{name}")


if __name__ == "__main__":
    try:
        main()
    except (KeyError, ValueError) as error:
        sys.exit(f"build_versions: {error}")
