#!/usr/bin/env python3
"""Parse the EU5 error.log into a CSV, with keyword and severity filtering.

Each error is a "block": a timestamped line plus its continuation lines
(e.g. "Script location: ...", multi-line messages).

Usage:
  parse_abm_errors.py                        # mod (abm*) errors only (default)
  parse_abm_errors.py modifier               # any entry containing "modifier"
  parse_abm_errors.py china --field file     # entries whose file path contains "china"
  parse_abm_errors.py --severity warning     # warnings only
  parse_abm_errors.py invalid --severity error
  parse_abm_errors.py --mod-only --severity error
  parse_abm_errors.py --all --no-dedupe      # every entry, no mod filter, no dedupe
  parse_abm_errors.py --log /path/error.log --out /tmp/out.csv

Output columns: timestamp, source, category, severity, file, line, count, message
"""

# ---------------------------------------------------------------------------
# MANUAL FOR LLMs (commented out; not executed).
# Read this before driving the script so you call it correctly.
#
# WHAT IT DOES
#   Parses the game's error.log (Proton path below) into a CSV. Each entry is
#   a "block": a `[HH:MM:SS][source.cpp:line]: message` line plus any
#   continuation lines. The block is flattened into one row.
#
# IMPORTANT BEHAVIOUR / GOTCHAS
#   * DEFAULT FILTER IS MOD-ONLY: with no keyword and no --severity, the script
#     silently keeps only entries whose text contains "abm". To see EVERYTHING,
#     pass `--all` (or `--severity error|warning`, or any keyword).
#   * DEDUPE IS ON BY DEFAULT: identical `message` values are collapsed into one
#     row with a `count` column. Use `--no-dedupe` for one row per occurrence.
#     Dedupe ignores (blanks) the timestamp, since merged rows span many times.
#   * SEVERITY is derived: "might want to look into this" -> warning, else error.
#   * CSV has a UTF-8 BOM (utf-8-sig) and quoted fields; messages may contain
#     commas, so parse with a CSV reader, not `cut -d,`.
#   * Output columns: timestamp, source, category, severity, file, line, count,
#     message. `category` maps source.cpp:line -> friendly name (see CATEGORY).
#   * `file`/`line` are best-effort regex extraction; often empty for pure text
#     errors (e.g. pdx_text_formatter.cpp:807 "Unknown formatting tag 'l'").
#
# EXAMPLES (run from repo root, python3 .tools/scripts/parse_abm_errors.py ...)
#   <no args>                                   # abm entries only, deduped
#   --all --no-dedupe                           # every log entry, one row each
#   "Unknown formatting tag" --out fmt.csv      # find/group the text-format bug
#   modifier                                     # any entry containing "modifier"
#   china --field file                           # keyword searched in file path
#   --severity warning                           # warnings only (NOT mod-only)
#   invalid --severity error                     # keyword + severity
#   --no-dedupe --log /path/error.log --out out.csv
#
# FIELD NAMES for --field: all, timestamp, source, category, severity, file,
#   line, count, message.
#
# WORKFLOW TIPS
#   * error.log is RESET on each game launch; parse it right after a run.
#   * For a dedupe demo of one repeated message, pass the message as keyword and
#     compare `--no-dedupe` row counts.
# ---------------------------------------------------------------------------

import argparse
import csv
import re
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent.parent
DEFAULT_LOG = Path(
    "/home/zp/Games/SteamLibrary/steamapps/compatdata/3450310/pfx/"
    "drive_c/users/steamuser/My Documents/Paradox Interactive/"
    "Europa Universalis V/logs/error.log"
)
DEFAULT_OUT = BASE / ".tools" / "tmp" / "parsed_errors.csv"

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

FIELDS = ["timestamp", "source", "category", "severity", "file", "line", "count", "message"]

PRIMARY_RE = re.compile(r"^\[(\d{2}:\d{2}:\d{2})\]\[([a-z_]+\.cpp:\d+)\]: (.*)$")
FILE_NEAR_RE = re.compile(r'in file: "([^"]+)" near line: (\d+)')
AT_RE = re.compile(r"([a-zA-Z0-9_/.\-]+\.(?:txt|gui|info)):(\d+)")
ABM_FILE_RE = re.compile(r"([a-zA-Z0-9_/.\-]*abm[a-zA-Z0-9_/.\-]*\.(?:txt|gui|info)):(\d+)")


def severity_of(message: str) -> str:
    if "might want to look into this" in message:
        return "warning"
    return "error"


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


def build_rows(log: Path):
    for b in blocks(log):
        parts = [b["primary"]] + b["cont"]
        full = "\n".join(parts)
        file_, line_ = extract_file_line(full)
        yield {
            "timestamp": b["ts"],
            "source": b["source"],
            "category": CATEGORY.get(b["source"], b["source"]),
            "severity": severity_of(full),
            "file": file_,
            "line": line_,
            "message": " | ".join(parts),
            "_raw": full.lower(),
        }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("keyword", nargs="?", help="filter by keyword (case-insensitive substring)")
    ap.add_argument("--field", default="all", choices=["all"] + FIELDS,
                    help="which field the keyword is searched in (default: all)")
    ap.add_argument("--severity", choices=["error", "warning"], help="filter by severity")
    ap.add_argument("--mod-only", action="store_true",
                    help="only include entries mentioning the mod (abm)")
    ap.add_argument("--all", action="store_true",
                    help="include ALL entries (disable the default mod-only filter)")
    ap.add_argument("--no-dedupe", action="store_true",
                    help="list every occurrence instead of collapsing identical messages")
    ap.add_argument("--log", default=str(DEFAULT_LOG), help="path to error.log")
    ap.add_argument("--out", default=str(DEFAULT_OUT), help="output CSV path")
    args = ap.parse_args()

    # Default to mod-only when no explicit filter is requested; --all opts out.
    use_mod_filter = (not args.all) and (args.mod_only or (not args.keyword and not args.severity))

    rows = []
    for row in build_rows(Path(args.log)):
        if use_mod_filter and "abm" not in row["_raw"]:
            continue
        if args.severity and row["severity"] != args.severity:
            continue
        if args.keyword:
            haystack = row["_raw"] if args.field == "all" else row[args.field].lower()
            if args.keyword.lower() not in haystack:
                continue
        row.pop("_raw")
        rows.append(row)

    if args.no_dedupe:
        for row in rows:
            row["count"] = 1
    else:
        deduped = {}
        order = []
        for row in rows:
            # Dedupe key is the message only; timestamp is ignored (blanked).
            key = row["message"]
            if key not in deduped:
                row["count"] = 1
                row["timestamp"] = ""  # merged rows span many timestamps
                deduped[key] = row
                order.append(key)
            else:
                deduped[key]["count"] += 1
        rows = [deduped[k] for k in order]

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)

    print(f"Wrote {len(rows)} rows -> {out}")


if __name__ == "__main__":
    main()
