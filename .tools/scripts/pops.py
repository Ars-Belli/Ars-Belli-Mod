#!/usr/bin/env python3
"""EU5 starting-pop toolbox: count and rescale pops in the 1337 setup.

Data sources (all paths overridable, see --help):
  pops      <mod>/main_menu/setup/1337/06_pops.txt
  ownership <mod>/main_menu/setup/1337/10_countries*.txt
  groups    <game>/in_game/common/cultures/*.txt      (culture -> culture_group)
            <game>/in_game/common/religions/*.txt     (religion -> religion group)
            <game>/in_game/map_data/definitions.txt   (location -> province / area / region)
            $EU5_GAME/in_game/map_data/location_templates.txt (numeric location ids)

Pop sizes are stored in thousands of people (3.178 == 3,178 people).

Count examples
  pops.py count --tag HSA
  pops.py count --tag HSA --group-by pop_type
  pops.py count --tag FLA --group-by culture
  pops.py count --province schwarzwald --group-by religion
  pops.py count --tag HSA --culture-group german_group --group-by location
  pops.py count --location 847,1020 --group-by culture --format csv
  pops.py count --area upper_rhine_area --pop-type peasants,soldiers

Edit examples (dry run first; a backup is written with --backup)
  pops.py scale --tag HSA --target 379 --dry-run
  pops.py scale --tag FLA --target 773
  pops.py scale --province schwarzwald --multiplier 1.5
  pops.py scale --location lubeck --target 40
  pops.py scale --tag HSA --culture-group german_group --multiplier 2
  pops.py scale --tag HSA --target 379000 --target-unit people

Audit
  pops.py check
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from collections import defaultdict
from pathlib import Path

DEFAULT_GAME = Path(
    "/home/zp/Games/SteamLibrary/steamapps/common/Europa Universalis V/game"
)

# Location ownership keys of the setup country blocks (see the commented list at
# the top of vanilla main_menu/setup/1337/10_countries.txt).
OWN_KEYS = {
    "own_control_core",
    "own_control_integrated",
    "own_control_conquered",
    "own_control_colony",
    "own_core",
    "own_conquered",
    "own_integrated",
    "own_colony",
}
CONTROL_KEYS = {"control", "control_core"}
CLAIM_KEYS = {"our_cores_conquered_by_others"}

DECIMALS = 3


# --------------------------------------------------------------------------- #
# Paradox script tokenizer / block parser
# --------------------------------------------------------------------------- #
def tokenize(text: str):
    """Yield (kind, value, line_no); kind is 'word', '{', '}' or '='.

    Literal braces inside comments are therefore never seen, which is why every
    structural walk in this file goes through the token stream and not through
    brace counting on raw lines.
    """
    i, n, line = 0, len(text), 1
    while i < n:
        ch = text[i]
        if ch == "\n":
            line += 1
            i += 1
        elif ch in " \t\r":
            i += 1
        elif ch == "#":
            while i < n and text[i] != "\n":
                i += 1
        elif ch == '"':
            start_line = line
            i += 1
            buf = []
            while i < n:
                if text[i] == "\\" and i + 1 < n:
                    buf.append(text[i : i + 2])
                    i += 2
                elif text[i] == '"':
                    i += 1
                    break
                else:
                    if text[i] == "\n":
                        line += 1
                    buf.append(text[i])
                    i += 1
            yield ("word", "".join(buf), start_line)
        elif ch in "{}=":
            yield (ch, ch, line)
            i += 1
        else:
            j = i
            while j < n and text[j] not in ' \t\r\n{}="#':
                j += 1
            if j == i:  # stray character, keep it out of the way
                j += 1
            yield ("word", text[i:j], line)
            i = j


class Node(list):
    """A parsed block: an ordered list of (key, value) pairs.

    `value` is either a str (scalar) or a Node (nested block). Bare words inside
    a block (EU5 lists such as `culture_groups = { german_group }`) are stored
    with an empty key.
    """

    def get_all(self, key):
        return [v for k, v in self if k == key]

    def get(self, key, default=None):
        for k, v in self:
            if k == key:
                return v
        return default


def parse_script(tokens) -> Node:
    root = Node()
    stack = [root]
    key = None
    expect_value = False
    for kind, value, _line in tokens:
        if kind == "{":
            node = Node()
            stack[-1].append((key if key is not None else "", node))
            stack.append(node)
            key, expect_value = None, False
        elif kind == "}":
            if key is not None:  # last bare word of a list before the closing brace
                stack[-1].append(("", key))
            if len(stack) > 1:
                stack.pop()
            key, expect_value = None, False
        elif kind == "=":
            expect_value = True
        elif key is None:
            key = value
        elif expect_value:
            stack[-1].append((key, value))
            key, expect_value = None, False
        else:  # bare list word
            stack[-1].append(("", key))
            key = value
    if key is not None:
        stack[-1].append(("", key))
    return root


def read_script(path: Path) -> Node:
    return parse_script(tokenize(path.read_text(encoding="utf-8-sig")))


def bare_words(node: Node):
    return [v for k, v in node if k == "" and isinstance(v, str)]


def keyed_blocks(node: Node):
    for key, value in node:
        if key and isinstance(value, Node):
            yield key, value


# --------------------------------------------------------------------------- #
# Reference databases
# --------------------------------------------------------------------------- #
def load_culture_groups(game: Path) -> dict[str, set[str]]:
    """culture -> set of culture groups (a culture may belong to several)."""
    out: dict[str, set[str]] = {}
    for path in sorted((game / "in_game/common/cultures").glob("*.txt")):
        for culture, block in keyed_blocks(read_script(path)):
            groups: set[str] = set()
            for group_block in block.get_all("culture_groups"):
                if isinstance(group_block, Node):
                    groups.update(bare_words(group_block))
            out.setdefault(culture, set()).update(groups)
    return out


def load_religion_groups(game: Path) -> dict[str, str | None]:
    out: dict[str, str | None] = {}
    for path in sorted((game / "in_game/common/religions").glob("*.txt")):
        for religion, block in keyed_blocks(read_script(path)):
            group = block.get("group")
            out[religion] = group if isinstance(group, str) else None
    return out


def load_location_templates(game: Path) -> list[str]:
    """Location names in id order: the in-game location id is the 1-based line."""
    path = game / "in_game/map_data/location_templates.txt"
    if not path.exists():
        return []
    names = []
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        match = re.match(r"^([A-Za-z0-9_]+) = \{", line)
        names.append(match.group(1) if match else "")
    return names


def load_map_hierarchy(game: Path) -> dict[str, dict[str, str]]:
    """location -> {'province': ..., 'area': ..., 'region': ...}."""
    path = game / "in_game/map_data/definitions.txt"
    out: dict[str, dict[str, str]] = {}
    if not path.exists():
        return out

    def kind_of(key: str):
        for suffix in ("region", "area", "province"):
            if key.endswith("_" + suffix):
                return suffix
        return None

    def walk(node: Node, ctx: dict[str, str]):
        for key, value in node:
            if not isinstance(value, Node):
                continue
            kind = kind_of(key)
            sub = ctx
            if kind:
                sub = dict(ctx)
                sub[kind] = key
            if kind == "province":
                for location in bare_words(value):
                    out.setdefault(location, {}).update(sub)
            walk(value, sub)

    walk(read_script(path), {})
    return out


def load_ownership(setup_dir: Path):
    """tag -> (owned, controlled, claimed) location sets."""
    owned: dict[str, set[str]] = defaultdict(set)
    controlled: dict[str, set[str]] = defaultdict(set)
    claimed: dict[str, set[str]] = defaultdict(set)
    for path in sorted(setup_dir.glob("10_countries*.txt")):
        node = read_script(path)
        for tag, block in _tag_blocks(node):
            for key, value in block:
                if not isinstance(value, Node):
                    continue
                locations = set(bare_words(value))
                if key in OWN_KEYS:
                    owned[tag] |= locations
                elif key in CONTROL_KEYS:
                    controlled[tag] |= locations
                elif key in CLAIM_KEYS:
                    claimed[tag] |= locations
    return owned, controlled, claimed


def _tag_blocks(node: Node):
    """Yield (tag, block) for every country block, honouring the
    `countries = { countries = { TAG = { ... } } }` nesting.
    """
    for key, value in node:
        if not isinstance(value, Node):
            continue
        if key == "countries":
            yield from _tag_blocks(value)
        elif re.fullmatch(r"[A-Z][A-Z0-9]{1,3}", key):
            yield key, value


# --------------------------------------------------------------------------- #
# Pop file
# --------------------------------------------------------------------------- #
POP_RE = re.compile(
    r"^(?P<pre>\t+define_pop = \{[ \t]*type = (?P<type>[a-z_0-9]+)"
    r"[ \t]+size = )(?P<size>\d+(?:\.\d+)?)(?P<post>.*)$"
)
LOCATION_RE = re.compile(r"^([A-Za-z0-9_]+) = \{$")
CULTURE_RE = re.compile(r"\bculture = ([A-Za-z0-9_]+)")
RELIGION_RE = re.compile(r"\breligion = ([A-Za-z0-9_]+)")


class Pop:
    __slots__ = ("line", "location", "type", "size", "culture", "religion",
                 "pre", "size_text", "post")

    def __init__(self, line, location, type_, size, culture, religion,
                 pre, size_text, post):
        self.line = line
        self.location = location
        self.type = type_
        self.size = size
        self.culture = culture
        self.religion = religion
        self.pre = pre
        self.size_text = size_text
        self.post = post

    def render(self, value: float, decimals: int | None = None) -> str:
        decimals = _decimals_of(self.size_text) if decimals is None else decimals
        return self.pre + f"{value:.{decimals}f}" + self.post


def _decimals_of(text: str) -> int:
    return len(text.split(".", 1)[1]) if "." in text else 0


class PopFile:
    def __init__(self, path: Path):
        self.path = path
        self.raw = path.read_bytes()
        self.newline = b"\r\n" if b"\r\n" in self.raw else b"\n"
        self.trailing_newline = self.raw.endswith(self.newline)
        text = self.raw.decode("utf-8-sig")
        self.lines = text.split("\n")
        self.pops: list[Pop] = []
        self.other_pop_lines: list[int] = []
        self._parse()

    def _location_headers(self) -> dict[int, str]:
        """line number -> location name, for `\t<location> = {` blocks."""
        headers: dict[int, str] = {}
        stack: list[str] = []
        pending: str | None = None
        expect_value = False
        for kind, value, line in tokenize(self.raw.decode("utf-8-sig")):
            if kind == "{":
                stack.append(pending or "")
                if len(stack) == 1:
                    if stack[0] != "locations":
                        raise SystemExit(
                            f"{self.path}: expected a top level 'locations = {{' "
                            f"block, found '{stack[0]}'"
                        )
                elif len(stack) == 2:
                    headers[line] = stack[1]
                pending, expect_value = None, False
            elif kind == "}":
                if stack:
                    stack.pop()
                pending, expect_value = None, False
            elif kind == "=":
                expect_value = True
            else:
                if not expect_value and pending is None:
                    pending = value
                else:
                    pending, expect_value = None, False
        return headers

    def _parse(self):
        headers = self._location_headers()
        current = None
        for index, line in enumerate(self.lines, start=1):
            if index in headers:
                current = headers[index]
                continue
            if "pop" in line and ("define_pop" in line or "generate_pop" in line):
                match = POP_RE.match(line)
                if not match or current is None:
                    self.other_pop_lines.append(index)
                    continue
                post = match.group("post")
                culture = CULTURE_RE.search(post)
                religion = RELIGION_RE.search(post)
                size_text = match.group("size")
                self.pops.append(
                    Pop(
                        line=index,
                        location=current,
                        type_=match.group("type"),
                        size=float(size_text),
                        culture=culture.group(1) if culture else "",
                        religion=religion.group(1) if religion else "",
                        pre=match.group("pre"),
                        size_text=size_text,
                        post=post,
                    )
                )

    def write(self, new_values: dict[int, float], decimals: int | None = DECIMALS):
        lines = list(self.lines)
        by_line = {pop.line: pop for pop in self.pops}
        for line_no, value in new_values.items():
            pop = by_line[line_no]
            if abs(value - pop.size) < 1e-12:
                continue  # unchanged: keep the original text byte for byte
            lines[line_no - 1] = pop.render(value, decimals)
        text = "\n".join(lines)
        data = text.encode("utf-8")
        if self.trailing_newline and not data.endswith(self.newline):
            data += self.newline
        self.path.write_bytes(data)


# --------------------------------------------------------------------------- #
# Selection
# --------------------------------------------------------------------------- #
class Tables:
    def __init__(self, args):
        self.args = args
        root = Path(args.mod).resolve()
        self.mod = root
        game = Path(args.game or DEFAULT_GAME)
        if not (game / "in_game").is_dir():
            raise SystemExit(
                f"game folder not found: {game}\npass --game or set EU5_GAME"
            )
        self.game = game
        setup = Path(args.setup) if args.setup else root / "main_menu/setup/1337"
        self.pops_path = Path(args.pops) if args.pops else setup / "06_pops.txt"

        self.owned, self.controlled, self.claimed = load_ownership(setup)
        self.culture_groups = load_culture_groups(game)
        self.religion_groups = load_religion_groups(game)
        self.hierarchy = load_map_hierarchy(game)
        self._template_names = None

    # -- name resolution ---------------------------------------------------- #
    def location_name(self, token: str) -> str:
        token = token.strip()
        if token.isdigit():
            if self._template_names is None:
                self._template_names = load_location_templates(self.game)
            index = int(token)
            if not 1 <= index <= len(self._template_names):
                raise SystemExit(f"location id {token} is out of range")
            name = self._template_names[index - 1]
            if not name:
                raise SystemExit(f"location id {token} is not a location line")
            return name
        return token

    def known_tags(self) -> set[str]:
        return set(self.owned) | set(self.controlled)

    def resolve_tags(self, tokens: list[str]) -> set[str] | None:
        tags: set[str] = set()
        for token in tokens:
            if token.lower() == "all":
                return None
            tag = token.upper()
            if tag not in self.known_tags():
                raise SystemExit(
                    f"unknown tag '{token}' (not owned by any country in the setup)"
                )
            tags.add(tag)
        return tags

    def resolve_values(self, tokens: list[str], known: set[str], what: str):
        values = set()
        for token in tokens:
            if token not in known:
                raise SystemExit(
                    f"unknown {what} '{token}'"
                    + _did_you_mean(token, sorted(known))
                )
            values.add(token)
        return values

    def filter_locations(self, args) -> set[str] | None:
        """Union of the location-name based filters, or None when unfiltered."""
        selected: set[str] | None = None

        def restrict(names: set[str]):
            nonlocal selected
            selected = names if selected is None else selected & names

        if args.tag:
            tags = self.resolve_tags(args.tag)
            if tags is not None:
                names: set[str] = set()
                for tag in tags:
                    names |= self.owned.get(tag, set())
                    if args.ownership in ("controlled", "any"):
                        names |= self.controlled.get(tag, set())
                restrict(names)
        if args.location:
            restrict({self.location_name(token) for token in args.location})

        for field in ("province", "area", "region"):
            tokens = getattr(args, field)
            if not tokens:
                continue
            wanted = {_strip_suffix(token, field) for token in tokens}
            known = {
                _strip_suffix(info[field], field)
                for info in self.hierarchy.values()
                if field in info
            }
            for token in wanted:
                if token not in known:
                    raise SystemExit(
                        f"unknown {field} '{token}'" + _did_you_mean(token, sorted(known))
                    )
            restrict(
                {
                    location
                    for location, info in self.hierarchy.items()
                    if field in info and _strip_suffix(info[field], field) in wanted
                }
            )
        return selected

    def entries(self, pops, args) -> list[Pop]:
        """Filter an already parsed pop list with the selection arguments."""
        locations = self.filter_locations(args)

        cultures = set(args.culture or [])
        culture_groups = set(args.culture_group or [])
        religions = set(args.religion or [])
        religion_groups = set(args.religion_group or [])
        pop_types = set(args.pop_type or [])

        if cultures:
            self.resolve_values(cultures, set(self.culture_groups), "culture")
        if culture_groups:
            known_groups = {g for groups in self.culture_groups.values() for g in groups}
            self.resolve_values(culture_groups, known_groups, "culture group")
        if religions:
            self.resolve_values(religions, set(self.religion_groups), "religion")
        if religion_groups:
            known = {g for g in self.religion_groups.values() if g}
            self.resolve_values(religion_groups, known, "religion group")
        if pop_types:
            self.resolve_values(pop_types, {pop.type for pop in pops}, "pop type")

        selected = []
        for pop in pops:
            if locations is not None and pop.location not in locations:
                continue
            if cultures and pop.culture not in cultures:
                continue
            if culture_groups and not (self.culture_groups.get(pop.culture, set())
                                       & culture_groups):
                continue
            if religions and pop.religion not in religions:
                continue
            if religion_groups and self.religion_groups.get(pop.religion) not in religion_groups:
                continue
            if pop_types and pop.type not in pop_types:
                continue
            selected.append(pop)
        return selected

    def select(self, args) -> list[Pop]:
        return self.entries(PopFile(self.pops_path).pops, args)


def _strip_suffix(name: str, suffix: str) -> str:
    return name[: -len(suffix) - 1] if name.endswith("_" + suffix) else name


def _did_you_mean(token: str, candidates: list[str]) -> str:
    import difflib

    close = difflib.get_close_matches(token, candidates, n=5, cutoff=0.6)
    return f"\n  did you mean: {', '.join(close)}" if close else ""


# --------------------------------------------------------------------------- #
# Reporting helpers
# --------------------------------------------------------------------------- #
def group_key(pop: Pop, group_by: str, tables: Tables, args) -> str:
    if group_by in ("", "none"):
        return "total"
    if group_by == "location":
        return pop.location
    if group_by in ("province", "area", "region"):
        return tables.hierarchy.get(pop.location, {}).get(group_by, "(unmapped)")
    if group_by == "tag":
        tags = sorted(t for t, locs in tables.owned.items() if pop.location in locs)
        return tags[0] if tags else "(unowned)"
    if group_by == "culture":
        return pop.culture or "(unknown)"
    if group_by == "culture_group":
        groups = tables.culture_groups.get(pop.culture, set())
        return "+".join(sorted(groups)) if groups else "(none)"
    if group_by == "religion":
        return pop.religion or "(unknown)"
    if group_by == "religion_group":
        return tables.religion_groups.get(pop.religion) or "(none)"
    if group_by == "pop_type":
        return pop.type
    raise SystemExit(f"unsupported --group-by '{group_by}'")


GROUP_BYS = ("none", "location", "province", "area", "region", "tag", "culture",
             "culture_group", "religion", "religion_group", "pop_type")


def table_rows(pops: list[Pop], group_by: str, tables: Tables, args):
    sums: dict[str, float] = defaultdict(float)
    counts: dict[str, int] = defaultdict(int)
    locations: dict[str, set[str]] = defaultdict(set)
    for pop in pops:
        key = group_key(pop, group_by, tables, args)
        sums[key] += pop.size
        counts[key] += 1
        locations[key].add(pop.location)
    rows = [(key, sums[key], counts[key], len(locations[key])) for key in sums]
    if args.sort == "name":
        rows.sort(key=lambda row: row[0])
    else:
        rows.sort(key=lambda row: (-row[1], row[0]))
    if args.top:
        rows = rows[: args.top]
    return rows


def render_table(rows, args, total: float, selection: str = "") -> str:
    if args.format == "json":
        return json.dumps(
            {
                "selection": selection,
                "group_by": args.group_by,
                "total_k": round(total, 3),
                "total_people": int(round(total * 1000)),
                "rows": [
                    {
                        args.group_by: key,
                        "size_k": round(value, 3),
                        "people": int(round(value * 1000)),
                        "entries": entries,
                        "locations": locations,
                        "share": round(value / total, 6) if total else 0.0,
                    }
                    for key, value, entries, locations in rows
                ],
            },
            indent=2,
        )
    if args.format in ("csv", "tsv"):
        sep = "," if args.format == "csv" else "\t"
        header = sep.join((args.group_by, "size_k", "people", "entries",
                           "locations", "share"))
        out = [header]
        for key, value, entries, locations in rows:
            share = f"{value / total * 100:.2f}%" if total else "n/a"
            out.append(
                sep.join((key, f"{value:.3f}", str(int(round(value * 1000))),
                          str(entries), str(locations), share))
            )
        return "\n".join(out)

    name_width = max([len(row[0]) for row in rows] + [len(args.group_by), 8])
    lines = [
        f"  {args.group_by:<{name_width}}  {'size':>12}  {'people':>11}  "
        f"{'share':>7}  {'entries':>7}  {'locs':>5}"
    ]
    for key, value, entries, locations in rows:
        share = f"{value / total * 100:6.1f}%" if total else "   n/a"
        lines.append(
            f"  {key:<{name_width}}  {value:>11.3f}k  {int(round(value * 1000)):>11,}  "
            f"{share:>7}  {entries:>7}  {locations:>5}"
        )
    return "\n".join(lines)


def describe_selection(args, pops: list[Pop]) -> str:
    parts = []
    if args.tag:
        parts.append("tag " + ",".join(t.upper() for t in args.tag))
    if args.location:
        parts.append("location " + ",".join(args.location))
    for field in ("province", "area", "region"):
        values = getattr(args, field)
        if values:
            parts.append(field + " " + ",".join(values))
    if args.culture:
        parts.append("culture " + ",".join(args.culture))
    if args.culture_group:
        parts.append("culture_group " + ",".join(args.culture_group))
    if args.religion:
        parts.append("religion " + ",".join(args.religion))
    if args.religion_group:
        parts.append("religion_group " + ",".join(args.religion_group))
    if args.pop_type:
        parts.append("pop_type " + ",".join(args.pop_type))
    locations = {pop.location for pop in pops}
    summary = f"{len(pops)} pop entries in {len(locations)} locations"
    return ("; ".join(parts) + " | " if parts else "") + summary


# --------------------------------------------------------------------------- #
# Commands
# --------------------------------------------------------------------------- #
def cmd_count(args, tables: Tables):
    pops = tables.select(args)
    total = sum(pop.size for pop in pops)
    selection = describe_selection(args, pops)
    if args.format != "table":  # keep csv/tsv/json machine readable
        rows = table_rows(pops, args.group_by, tables, args) if pops else []
        print(render_table(rows, args, total, selection))
        return 0
    print(selection)
    print(f"Total: {total:.3f}k  ({int(round(total * 1000)):,} people)")
    if not pops:
        return 0
    rows = table_rows(pops, args.group_by, tables, args)
    print(render_table(rows, args, total, selection))
    return 0


def cmd_list(args, tables: Tables):
    """Locations behind the selection, with their per-location pop totals."""
    args.group_by = "location"
    return cmd_count(args, tables)


def cmd_scale(args, tables: Tables):
    pops_file = PopFile(tables.pops_path)
    if not args.all and tables.filter_locations(args) is None:
        raise SystemExit(
            "scale needs a scope: pass --tag, --location, --province, --area or "
            "--region (or --all to rescale every pop in the file)"
        )
    pops = tables.entries(pops_file.pops, args)

    if not pops:
        raise SystemExit("selection matches no pop entries - nothing to do")

    current = sum(pop.size for pop in pops)
    if current <= 0:
        raise SystemExit("selection has a zero total - cannot scale proportionally")

    if args.target is not None:
        target = args.target / 1000.0 if args.target_unit == "people" else args.target
        if target <= 0:
            raise SystemExit("--target must be greater than zero")
        factor = target / current
        expected = target
    else:
        if args.multiplier is None:
            raise SystemExit("pass either --multiplier or --target")
        if args.multiplier <= 0:
            raise SystemExit("--multiplier must be greater than zero")
        factor = args.multiplier
        expected = None

    new_values = {pop.line: round(pop.size * factor, args.decimals) for pop in pops}
    scaled_total = sum(new_values.values())
    if args.residual == "largest" and expected is not None:
        residual = round(expected - scaled_total, args.decimals)
        if residual:
            biggest = max(pops, key=lambda pop: new_values[pop.line])
            new_values[biggest.line] = round(new_values[biggest.line] + residual,
                                             args.decimals)
            scaled_total += residual
            print(f"Residual {residual:+.{args.decimals}f}k absorbed by "
                  f"{biggest.location}/{biggest.type} (line {biggest.line})")

    if any(value < 0 for value in new_values.values()):
        bad = ", ".join(
            f"{pop.location}:{pop.line}" for pop in pops if new_values[pop.line] < 0
        )
        raise SystemExit(f"refusing to write negative pop sizes: {bad}")
    zeroed = [pop for pop in pops if new_values[pop.line] == 0 < pop.size]
    if zeroed:
        examples = ", ".join(f"{pop.location}:{pop.type}" for pop in zeroed[:5])
        print(f"  note     : {len(zeroed)} entries round to 0.000k ({examples}); "
              f"vanilla has 0.000k entries too, so this is allowed")

    print(describe_selection(args, pops))
    print(f"  factor   : {factor:.9f}"
          + (f"  (target {expected:.3f}k)" if expected is not None else ""))
    print(f"  before   : {current:.3f}k  ({int(round(current * 1000)):,} people)")
    note = ""
    if expected is not None:
        note = "  [exact]" if abs(scaled_total - expected) < 1e-9 else "  [rounded]"
    print(f"  after    : {scaled_total:.3f}k  ({int(round(scaled_total * 1000)):,} people){note}")

    if args.verbose:
        changes = sorted(
            ((pop, new_values[pop.line]) for pop in pops),
            key=lambda item: -abs(item[1] - item[0].size),
        )
        for pop, value in changes:
            if abs(value - pop.size) >= 0.0005:
                print(f"    {pop.location:<18} {pop.type:<10} "
                      f"{pop.size:>8.3f} -> {value:>8.3f}  (line {pop.line})")

    if args.dry_run:
        print("dry run: nothing written")
        return 0

    if args.backup:
        backup = pops_file.path.with_suffix(pops_file.path.suffix + ".bak")
        shutil.copy2(pops_file.path, backup)
        print(f"  backup   : {backup}")

    pops_file.write(new_values, args.decimals)

    # verify by re-reading what is now on disk
    check = PopFile(pops_file.path)
    written = sum(pop.size for pop in check.pops if pop.line in new_values)
    if abs(written - scaled_total) > 0.002 * max(1, len(new_values)) / 1000 + 0.0005:
        raise SystemExit(
            f"verification failed: expected {scaled_total:.3f}k on disk, found {written:.3f}k"
        )
    print(f"  written  : {pops_file.path}  ({len(new_values)} entries, verified "
          f"{written:.3f}k)")
    return 0


def cmd_check(args, tables: Tables):
    pops_file = PopFile(tables.pops_path)
    problems = 0

    if pops_file.other_pop_lines:
        problems += 1
        print(f"[!] {len(pops_file.other_pop_lines)} pop lines are not in the "
              f"canonical 'define_pop = {{ type = x size = n culture = c religion = r }}' "
              f"shape (lines {pops_file.other_pop_lines[:10]})")

    unknown_cultures = {pop.culture for pop in pops_file.pops} - set(tables.culture_groups)
    if unknown_cultures:
        problems += 1
        print(f"[!] cultures missing from common/cultures: "
              f"{', '.join(sorted(unknown_cultures))}")
    no_group = sorted(
        culture for culture, groups in tables.culture_groups.items() if not groups
    )
    if no_group:
        print(f"[i] cultures without a culture group: {', '.join(no_group[:10])}")

    unknown_religions = {pop.religion for pop in pops_file.pops} - set(tables.religion_groups)
    if unknown_religions:
        problems += 1
        print(f"[!] religions missing from common/religions: "
              f"{', '.join(sorted(unknown_religions))}")

    pop_locations = {pop.location for pop in pops_file.pops}
    owned_pairs = [(tag, loc) for tag, locs in tables.owned.items() for loc in locs]
    missing = sorted({loc for _tag, loc in owned_pairs} - pop_locations)
    if missing:
        problems += 1
        print(f"[!] {len(missing)} owned locations have no pop entries: "
              f"{', '.join(missing[:10])}")

    duplicated = defaultdict(list)
    for tag, locs in tables.owned.items():
        for loc in locs:
            duplicated[loc].append(tag)
    shared = {loc: tags for loc, tags in duplicated.items() if len(tags) > 1}
    if shared:
        problems += 1
        for loc, tags in sorted(shared.items())[:10]:
            print(f"[!] {loc} is owned by several tags: {', '.join(sorted(tags))}")

    no_owner = sorted(pop_locations - {loc for _tag, loc in owned_pairs})
    print(f"[i] {len(pop_locations)} locations with pops, "
          f"{len(no_owner)} of them unowned (wasteland / uncolonised)")
    print(f"[i] {len(tables.owned)} tags own locations; "
          f"{sum(len(v) for v in tables.owned.values())} owned locations")
    print(f"[i] {len(pops_file.pops)} pop entries, total "
          f"{sum(pop.size for pop in pops_file.pops):.3f}k")
    print("OK" if problems == 0 else f"{problems} problem group(s) reported")
    return 0 if problems == 0 else 1


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def add_selection_args(parser: argparse.ArgumentParser):
    parser.add_argument("--tag", nargs="+", metavar="TAG",
                        help="country tag(s); 'all' for every country")
    parser.add_argument("--location", nargs="+", metavar="LOC",
                        help="location name(s) or numeric in-game id(s)")
    parser.add_argument("--province", nargs="+", metavar="NAME")
    parser.add_argument("--area", nargs="+", metavar="NAME")
    parser.add_argument("--region", nargs="+", metavar="NAME")
    parser.add_argument("--culture", nargs="+", metavar="CULTURE")
    parser.add_argument("--culture-group", nargs="+", metavar="GROUP")
    parser.add_argument("--religion", nargs="+", metavar="RELIGION")
    parser.add_argument("--religion-group", nargs="+", metavar="GROUP")
    parser.add_argument("--pop-type", nargs="+", metavar="TYPE",
                        help="nobles, clergy, burghers, laborers, soldiers, "
                             "peasants, tribesmen, slaves")
    parser.add_argument("--ownership", choices=("owned", "controlled", "any"),
                        default="owned",
                        help="which setup keys --tag counts (default: owned)")


def build_parser() -> argparse.ArgumentParser:
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--mod", default=str(Path(__file__).resolve().parents[2]),
                        help="mod root (default: this repository)")
    common.add_argument("--game", default=None, help="EU5 game root")
    common.add_argument("--setup", default=None,
                        help="setup folder (default: <mod>/main_menu/setup/1337)")
    common.add_argument("--pops", default=None,
                        help="pops file (default: <setup>/06_pops.txt)")

    parser = argparse.ArgumentParser(
        prog="pops.py",
        description="Count and rescale EU5 starting pops (1337 setup).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    subs = parser.add_subparsers(dest="command", required=True)

    count = subs.add_parser("count", parents=[common],
                            help="count pops for a selection")
    add_selection_args(count)
    count.add_argument("--group-by", choices=GROUP_BYS, default="none")
    count.add_argument("--sort", choices=("size", "name"), default="size")
    count.add_argument("--top", type=int, default=0, help="only the first N rows")
    count.add_argument("--format", choices=("table", "csv", "tsv", "json"),
                       default="table")
    count.set_defaults(func=cmd_count)

    listing = subs.add_parser("list", parents=[common],
                              help="per-location totals for a selection")
    add_selection_args(listing)
    listing.add_argument("--sort", choices=("size", "name"), default="size")
    listing.add_argument("--top", type=int, default=0)
    listing.add_argument("--format", choices=("table", "csv", "tsv", "json"),
                         default="table")
    listing.set_defaults(func=cmd_list, group_by="location")

    scale = subs.add_parser("scale", parents=[common],
                            help="rescale pops of a selection proportionally")
    add_selection_args(scale)
    scale.add_argument("--multiplier", type=float,
                       help="multiply every selected pop by this factor")
    scale.add_argument("--target", type=float,
                       help="set the selection total to this value (proportional)")
    scale.add_argument("--target-unit", choices=("k", "people"), default="k")
    scale.add_argument("--residual", choices=("largest", "none"), default="largest",
                       help="where rounding leftovers go (default: largest entry)")
    scale.add_argument("--decimals", type=int, default=DECIMALS)
    scale.add_argument("--dry-run", action="store_true")
    scale.add_argument("--backup", action="store_true",
                       help="keep a .bak copy next to the pops file")
    scale.add_argument("--verbose", action="store_true")
    scale.add_argument("--all", action="store_true",
                       help="explicitly allow rescaling the whole pops file")
    scale.set_defaults(func=cmd_scale)

    check = subs.add_parser("check", parents=[common],
                            help="audit pops file, ownership and reference data")
    check.set_defaults(func=cmd_check)
    return parser


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    _split_comma_lists(args)
    tables = Tables(args)
    return args.func(args, tables)


LIST_ARGUMENTS = ("tag", "location", "province", "area", "region", "culture",
                  "culture_group", "religion", "religion_group", "pop_type")


def _split_comma_lists(args):
    """Allow `--tag HSA,FLA`, `--location 847,1020` as well as separate arguments."""
    for name in LIST_ARGUMENTS:
        values = getattr(args, name, None)
        if not values:
            continue
        flattened = []
        for value in values:
            flattened.extend(part for part in value.split(",") if part)
        setattr(args, name, flattened or None)


if __name__ == "__main__":
    sys.exit(main())
