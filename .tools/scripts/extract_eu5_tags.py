#!/usr/bin/env python3
"""Extract country tags from EU5 country setup files."""

import argparse
import csv
import io
import re
import sys
from pathlib import Path


DEFAULT_COUNTRIES_DIR = (
    Path(__file__).resolve().parents[1] / "in_game" / "setup" / "countries"
)
COUNTRY_PATTERN = re.compile(
    r"^(?P<comment>#\s*)?(?P<tag>[A-Z][A-Z0-9_]*)\s*=\s*\{"
    r"\s*(?:#\s*(?P<name>.*?))?\s*$"
)
DEFINITION_PATTERN = re.compile(
    r"^(?P<comment>\s*#)?\s*(?P<field>culture_definition|religion_definition)"
    r"\s*=\s*(?P<value>[^\s#}]+)"
)
NAME_THEN_TAG_PATTERN = re.compile(
    r"^##\s*(?P<name>.+?)\s+-\s+(?P<tag>[A-Z][A-Z0-9_]*)(?:\s|$)"
)
TAG_THEN_NAME_PATTERN = re.compile(
    r"^##\s*(?P<tag>[A-Z][A-Z0-9_]*)\s+-\s+(?P<name>.+?)\s*$"
)


def clean_name(name: str) -> str:
    """Remove annotations from a name-bearing country comment."""
    name = re.sub(r"^NEW\s*-\s*", "", name, flags=re.IGNORECASE)
    name = re.split(r"\s+(?:-\s*)?https?://", name, maxsplit=1)[0]

    previous_tag_name = re.fullmatch(r"Was\s+[A-Z0-9_]+\s+\((.+)\)", name)
    if previous_tag_name:
        return previous_tag_name.group(1).strip()
    if name.lower().startswith("changed "):
        return ""

    return name.strip(" -")


def parse_heading_names(lines: list[str]) -> dict[str, str]:
    """Return names stored in separate '##Name - TAG' heading comments."""
    names: dict[str, str] = {}
    for line in lines:
        match = NAME_THEN_TAG_PATTERN.match(line) or TAG_THEN_NAME_PATTERN.match(line)
        if match:
            names[match.group("tag")] = clean_name(match.group("name"))
    return names


def parse_tags(countries_dir: Path) -> list[tuple[str, str, str, str, str]]:
    """Return country tags with name, source filename, culture, and religion."""
    tags: list[tuple[str, str, str, str, str]] = []

    for country_file in sorted(countries_dir.glob("*.txt")):
        with country_file.open(encoding="utf-8-sig") as source:
            lines = source.readlines()
            heading_names = parse_heading_names(lines)
            current_tag = ""
            current_name = ""
            current_commented = False
            definitions: dict[str, str] = {}

            def append_current_tag() -> None:
                if not current_tag:
                    return
                tag = f"#{current_tag}" if current_commented else current_tag
                tags.append(
                    (
                        tag,
                        current_name,
                        country_file.name,
                        definitions.get("culture_definition", ""),
                        definitions.get("religion_definition", ""),
                    )
                )

            for line in lines:
                country_match = COUNTRY_PATTERN.match(line)
                if country_match:
                    append_current_tag()
                    current_tag = country_match.group("tag")
                    current_name = clean_name(country_match.group("name") or "")
                    if not current_name:
                        current_name = heading_names.get(current_tag, "")
                    current_commented = country_match.group("comment") is not None
                    definitions = {}
                    continue

                definition_match = DEFINITION_PATTERN.match(line)
                if not current_tag or not definition_match:
                    continue

                definition_commented = definition_match.group("comment") is not None
                if definition_commented == current_commented:
                    definitions[definition_match.group("field")] = definition_match.group(
                        "value"
                    )

            append_current_tag()

    return tags


def format_tags(tags: list[tuple[str, str, str, str, str]]) -> str:
    """Format tags and their metadata as CSV."""
    output = io.StringIO(newline="")
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(("tag", "name", "file", "culture", "religion"))
    writer.writerows(tags)
    return output.getvalue()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Extract EU5 country tags, names, source files, cultures, and religions "
            "as CSV. Commented definitions are emitted as commented tags."
        )
    )
    parser.add_argument(
        "--countries-dir",
        type=Path,
        default=DEFAULT_COUNTRIES_DIR,
        help=f"country setup directory (default: {DEFAULT_COUNTRIES_DIR})",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="write the CSV to this file instead of stdout",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    countries_dir = args.countries_dir

    if not countries_dir.is_dir():
        print(f"error: country setup directory not found: {countries_dir}", file=sys.stderr)
        return 1

    output = format_tags(parse_tags(countries_dir))

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output, encoding="utf-8")
    else:
        sys.stdout.write(output)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())