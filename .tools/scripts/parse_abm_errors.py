#!/usr/bin/env python3
"""Parse mod-related (abm*) error blocks from the EU5 error.log into a CSV.

Each error is a "block": a timestamped line plus its continuation lines
(e.g. "Script location: ...", multi-line messages). A block is included
when any of its lines mentions "abm" (the mod's prefix / file names).

Output: .tools/tmp/parsed_errors.csv
Columns: timestamp, source, category, file, line, message
"""

import csv
import re
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent.parent
LOG = Path(
    "/home/zp/Games/SteamLibrary/steamapps/compatdata/3450310/pfx/"
    "drive_c/users/steamuser/My Documents/Paradox Interactive/"
    "Europa Universalis V/logs/error.log"
)
OUT_DIR = BASE / ".tools" / "tmp"
OUT = OUT_DIR / "parsed_errors.csv"

CATEGORY = {
    "pdx_persistent_reader.cpp:289": "unknown_modifier",
    "advance_definition.cpp:1391": "advance_leaf_requirement",
    "advance_definition.cpp:1447": "advance_age_mismatch",
    "jomini_trigger.cpp:803": "trigger_scope_mismatch",
    "jomini_script_system.cpp:252": "script_system_error",
    "government.cpp:3535": "invalid_law",
    "government.cpp:3544": "invalid_policy",
    "government.cpp:3612": "invalid_reform",
    "government.cpp:3662": "invalid_estate_privilege",
    "estate_privilege.cpp:470": "privilege_no_power",
    "subunit_definition.cpp:1105": "unit_upgrade_target",
    "building_type.cpp:2302": "building_balance",
    "initialize_from_bookmark.cpp:522": "religious_school",
    "localization_util.cpp:103": "localization_todo",
}

PRIMARY_RE = re.compile(r"^\[(\d{2}:\d{2}:\d{2})\]\[([a-z_]+\.cpp:\d+)\]: (.*)$")
FILE_NEAR_RE = re.compile(r'in file: "([^"]+)" near line: (\d+)')
AT_RE = re.compile(r"([a-zA-Z_/.\-]+\.(?:txt|gui|info)):(\d+)")
ABM_FILE_RE = re.compile(r"([a-zA-Z_/.\-]*abm[a-zA-Z_/.\-]*\.(?:txt|gui|info)):(\d+)")


def blocks(path: Path):
    current = None
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        m = PRIMARY_RE.match(raw)
        if m:
            if current:
                yield current
            current = {
                "ts": m.group(1),
                "source": m.group(2),
                "primary": m.group(3),
                "cont": [],
            }
        elif current is not None and raw.strip():
            current["cont"].append(raw.strip())
        elif current is not None:
            yield current
            current = None
    if current:
        yield current


def extract_file_line(text: str):
    """Prefer a file:line where the path mentions the mod (abm)."""
    fm = ABM_FILE_RE.search(text)
    if fm:
        return fm.group(1), fm.group(2)
    fm = FILE_NEAR_RE.search(text)
    if fm:
        return fm.group(1), fm.group(2)
    am = AT_RE.search(text)
    if am:
        return am.group(1), am.group(2)
    return "", ""


def main() -> None:
    rows = []
    for b in blocks(LOG):
        full = b["primary"] + "\n" + "\n".join(b["cont"])
        if "abm" not in full.lower():
            continue
        file_, line_ = extract_file_line(full)
        rows.append({
            "timestamp": b["ts"],
            "source": b["source"],
            "category": CATEGORY.get(b["source"], b["source"]),
            "file": file_,
            "line": line_,
            "message": full.replace("\n", " | "),
        })

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["timestamp", "source", "category", "file", "line", "message"])
        w.writeheader()
        w.writerows(rows)

    print(f"Wrote {len(rows)} rows -> {OUT}")


if __name__ == "__main__":
    main()
