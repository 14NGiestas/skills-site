#!/usr/bin/env python3
"""Build a static catalog site from Markdown SKILL.md files.

Usage:
    python3 build_site.py \
        --source . \
        --assets ../site \
        --output _site \
        --title "My Skills" \
        --repository owner/repo \
        --ref main

Requires PyYAML:
    pip install pyyaml
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

try:
    import yaml
except ModuleNotFoundError:
    sys.exit("error: PyYAML is required. Install it with: pip install pyyaml")

SKIP_DIRS = {".git", ".github", ".opencode", "node_modules", "docs", "site", "_site"}
LANGUAGE_DIRS = {"en", "pt", "pt-br", "es", "fr", "de"}
LANGUAGE_ALIASES = {"pt-br": "pt", "pt_br": "pt", "en-us": "en", "en_us": "en"}
LANGUAGE_LABELS = {"en": "English", "pt": "Português", "es": "Español", "fr": "Français", "de": "Deutsch"}
SWITCHER_RE = re.compile(r"^> .*SKILL\.md\).*$\n?", re.MULTILINE)

KNOWN_CATEGORIES = {
    "content-analysis-bardin": {
        "key": "bardin",
        "labels": {"en": "Bardin Content Analysis", "pt": "Análise de Conteúdo (Bardin)"},
    },
    "analise-de-conteudo-bardin": {
        "key": "bardin",
        "labels": {"en": "Bardin Content Analysis", "pt": "Análise de Conteúdo (Bardin)"},
    },
    "literature-review": {
        "key": "literature",
        "labels": {"en": "Literature Review", "pt": "Revisão de Literatura"},
    },
    "revisao-bibliografica": {
        "key": "literature",
        "labels": {"en": "Literature Review", "pt": "Revisão de Literatura"},
    },
}

KNOWN_GROUPS = [
    ("pre-anal", "bardin-pre-analysis", 1),
    ("coding", "bardin-coding", 2),
    ("codificacao", "bardin-coding", 2),
    ("categoriz", "bardin-categorization", 3),
    ("interpret", "bardin-interpretation", 4),
    ("annotated-bibliography", "annotated-bibliography", 1),
    ("fichamento-academico", "annotated-bibliography", 1),
]


def split_frontmatter(text: str) -> tuple[str | None, str]:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return None, text
    for index in range(1, len(lines)):
        if lines[index].strip() == "---":
            return "\n".join(lines[1:index]), "\n".join(lines[index + 1:])
    return None, text


def first_heading(body: str) -> str:
    for line in body.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return ""


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "skills"


def humanize(value: str) -> str:
    return re.sub(r"[-_]+", " ", value).strip().title()


def resolve_language(rel: Path) -> str:
    first = rel.parts[0].lower()
    if first in LANGUAGE_ALIASES:
        return LANGUAGE_ALIASES[first]
    if first in LANGUAGE_DIRS:
        return first
    return "en"


def resolve_category(rel: Path, metadata: dict, language: str) -> tuple[str, dict[str, str]]:
    category = metadata.get("category")
    if isinstance(category, dict) and category:
        labels = {str(key): str(value) for key, value in category.items()}
        return slugify(labels.get("en") or next(iter(labels.values()))), labels
    if isinstance(category, str) and category.strip():
        value = category.strip()
        return slugify(value), {"en": value, "pt": value}

    for part in rel.parts:
        if part in KNOWN_CATEGORIES:
            info = KNOWN_CATEGORIES[part]
            return info["key"], info["labels"]

    if len(rel.parts) > 2 and rel.parts[0].lower() in LANGUAGE_DIRS:
        folder = rel.parts[1]
    else:
        folder = rel.parts[0] if len(rel.parts) > 1 else "skills"
    label = humanize(folder)
    return slugify(folder), {"en": label, "pt": label}


def resolve_group(name: str, metadata: dict) -> tuple[str, int]:
    group = metadata.get("group")
    if group:
        try:
            order = int(metadata.get("order", 0))
        except (TypeError, ValueError):
            order = 0
        return str(group), order

    for needle, known_group, known_order in KNOWN_GROUPS:
        if needle in name:
            return known_group, known_order
    return name, 0


def skill_paths(source: Path, output: Path) -> list[Path]:
    paths = []
    for path in sorted(source.rglob("SKILL.md")):
        rel = path.relative_to(source)
        if any(part in SKIP_DIRS for part in rel.parts[:-1]):
            continue
        if output in path.parents:
            continue
        paths.append(path)
    return paths


def main() -> int:
    parser = argparse.ArgumentParser(description="Build a static skills catalog.")
    parser.add_argument("--source", default=".", help="Repository containing SKILL.md files.")
    parser.add_argument("--assets", required=True, help="Directory with the static site assets.")
    parser.add_argument("--output", default="_site", help="Directory for the generated site.")
    parser.add_argument("--title", default="AI Skills", help="Site title.")
    parser.add_argument("--repository", default="", help="owner/repo used for GitHub links.")
    parser.add_argument("--ref", default="main", help="Git ref used for raw links.")
    args = parser.parse_args()

    source = Path(args.source).resolve()
    assets = Path(args.assets).resolve()
    output = Path(args.output).resolve()

    if not source.is_dir():
        sys.exit(f"error: source directory not found: {source}")
    if not assets.is_dir():
        sys.exit(f"error: assets directory not found: {assets}")
    if output == Path(output.anchor):
        sys.exit("error: refusing to write the site to the filesystem root")
    if output == source:
        sys.exit("error: output directory must differ from the source directory")

    paths = skill_paths(source, output)
    if not paths:
        sys.exit(f"error: no SKILL.md files found under {source}")

    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)
    shutil.copytree(assets, output, dirs_exist_ok=True)

    skills_dir = output / "skills"
    skills_dir.mkdir()

    entries = []
    for path in paths:
        rel = path.relative_to(source)
        text = path.read_text(encoding="utf-8")
        raw, body = split_frontmatter(text)
        if raw is None:
            sys.exit(f"error: {rel.as_posix()} has no YAML frontmatter")

        data = yaml.safe_load(raw)
        if not isinstance(data, dict):
            sys.exit(f"error: {rel.as_posix()} frontmatter must be a mapping")

        name = str(data.get("name") or path.parent.name)
        description = str(data.get("description") or "").strip()
        if not description:
            sys.exit(f"error: {rel.as_posix()} has no description")

        metadata = data.get("metadata") or {}
        if not isinstance(metadata, dict):
            metadata = {}

        language = resolve_language(rel)
        category, category_labels = resolve_category(rel, metadata, language)
        group, order = resolve_group(name, metadata)
        title = first_heading(body) or name

        target = skills_dir / name / "SKILL.md"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(SWITCHER_RE.sub("", text), encoding="utf-8")

        references = path.parent / "references"
        if references.is_dir():
            shutil.copytree(references, target.parent / "references", dirs_exist_ok=True)

        entries.append({
            "name": name,
            "title": title,
            "description": description,
            "language": language,
            "category": category,
            "categoryLabel": category_labels,
            "group": group,
            "order": order,
            "path": f"skills/{name}/SKILL.md",
            "source": rel.as_posix(),
        })

    entries.sort(key=lambda entry: (entry["category"], entry["order"], entry["language"], entry["name"]))
    payload = {
        "repository": args.repository,
        "ref": args.ref,
        "title": args.title,
        "skills": entries,
    }
    (output / "skills.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    groups: dict[str, list[dict]] = {}
    for entry in entries:
        groups.setdefault(entry["language"], []).append(entry)

    catalog_lines = [
        f"# {args.title}",
        "",
        "> Agent-friendly catalog. Each entry links directly to a Markdown `SKILL.md`.",
        "",
    ]
    if args.repository:
        catalog_lines.append(f"Repository: https://github.com/{args.repository}")
    catalog_lines.extend(["JSON data: skills.json", "", "## Skills", ""])
    for language, items in groups.items():
        catalog_lines.append(f"### {LANGUAGE_LABELS.get(language, language.upper())}")
        catalog_lines.append("")
        for entry in items:
            catalog_lines.append(
                f"- [{entry['title']}]({entry['path']}): {entry['description']}"
            )
        catalog_lines.append("")
    (output / "catalog.md").write_text("\n".join(catalog_lines), encoding="utf-8")

    manifest_lines = [
        f"# {args.title}",
        "",
        "> Agent-friendly catalog. Each skill links directly to its Markdown source.",
        "",
    ]
    if args.repository:
        owner, repo_name = args.repository.split("/", 1)
        owner_slug = owner.lower()
        repo_slug = repo_name.lower()
        website = (
            f"https://{owner_slug}.github.io/"
            if repo_slug == f"{owner_slug}.github.io"
            else f"https://{owner_slug}.github.io/{repo_name}/"
        )
        manifest_lines.extend([
            f"Repository: https://github.com/{args.repository}",
            f"Website: {website}",
            f"Full file tree: https://api.github.com/repos/{args.repository}/git/trees/{args.ref}?recursive=1",
        ])
    manifest_lines.extend(["JSON data: skills.json", ""])
    for language, items in groups.items():
        manifest_lines.append(f"## {LANGUAGE_LABELS.get(language, language.upper())}")
        manifest_lines.append("")
        for entry in items:
            if args.repository:
                link = f"https://raw.githubusercontent.com/{args.repository}/{args.ref}/{entry['source']}"
            else:
                link = entry["path"]
            manifest_lines.append(f"- [{entry['name']}]({link}): {entry['description']}")
        manifest_lines.append("")
    (output / "llms.txt").write_text("\n".join(manifest_lines), encoding="utf-8")

    print(f"Built {len(entries)} skill entries in {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
