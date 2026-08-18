#!/usr/bin/env python3
"""One-off script: parse the saved EU4 wiki 'Modifier list' HTML page into CSVs.

Usage: python3 parse_modifiers.py
Reads:  Modifier_list_eu4.html (same folder)
Writes: one CSV per top-level section (same folder):
          eu4_modifiers_country.csv
          eu4_modifiers_province.csv
          eu4_modifiers_unique.csv
          eu4_modifiers_removed.csv
"""
import csv
import html
import re
from html.parser import HTMLParser
from pathlib import Path

SRC = Path(__file__).parent / "Modifier_list_eu4.html"
OUT_DIR = Path(__file__).parent

SECTION_FILES = {
    "Country modifiers": "eu4_modifiers_country.csv",
    "Province modifiers": "eu4_modifiers_province.csv",
    "Unique modifiers": "eu4_modifiers_unique.csv",
    "Removed modifiers": "eu4_modifiers_removed.csv",
}


def norm(text: str) -> str:
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


class ModifierListParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.section = ""       # current h2
        self.subsection = ""    # current h3
        self.rows = []

        # heading capture state
        self.in_headline = False
        self.headline_level = None
        self.headline_buf = []

        # table capture state
        self.table_depth = 0
        self.in_wikitable = False
        self.in_thead = False
        self.in_tbody = False
        self.headers = []
        self.current_row = None     # list of cell texts while in a <tr>
        self.cell_buf = None        # text buffer for current <td>/<th>
        self.in_cell = False

    # -- heading handling -------------------------------------------------
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ("h2", "h3"):
            self.headline_level = tag
        if tag == "span" and attrs.get("class") == "mw-headline":
            self.in_headline = True
            self.headline_buf = []
        elif tag == "table":
            classes = attrs.get("class", "")
            if "wikitable" in classes.split():
                self.in_wikitable = True
                self.table_depth += 1
                self.headers = []
        elif self.in_wikitable and tag == "thead":
            self.in_thead = True
        elif self.in_wikitable and tag == "tbody":
            self.in_tbody = True
        elif self.in_wikitable and tag == "tr":
            self.current_row = []
        elif self.in_wikitable and tag in ("td", "th"):
            self.in_cell = True
            self.cell_buf = []
        elif self.in_wikitable and self.in_cell and tag == "img":
            alt = attrs.get("alt")
            if alt:
                alt = re.sub(r"\.(png|jpg|jpeg|gif|svg)$", "", alt, flags=re.I)
                self.cell_buf.append(alt)

    def handle_endtag(self, tag):
        if tag == "span" and self.in_headline:
            self.in_headline = False
            text = norm("".join(self.headline_buf))
            if self.headline_level == "h2":
                self.section = text
                self.subsection = ""
            elif self.headline_level == "h3":
                self.subsection = text
        elif tag == "table" and self.in_wikitable:
            self.table_depth -= 1
            if self.table_depth == 0:
                self.in_wikitable = False
                self.in_thead = False
                self.in_tbody = False
                self.headers = []
        elif tag == "thead":
            self.in_thead = False
        elif tag == "tbody":
            self.in_tbody = False
        elif tag in ("td", "th") and self.in_wikitable and self.in_cell:
            self.in_cell = False
            text = norm("".join(self.cell_buf))
            if self.current_row is not None:
                self.current_row.append(text)
        elif tag == "tr" and self.in_wikitable:
            if self.in_thead and self.current_row:
                self.headers = self.current_row
            elif self.in_tbody and self.current_row:
                row = dict(zip(self.headers, self.current_row))
                row["_section"] = self.section
                row["_subsection"] = self.subsection
                # only keep rows that actually have a modifier key name
                if row.get("Modifier"):
                    self.rows.append(row)
            self.current_row = None

    def handle_data(self, data):
        if self.in_headline:
            self.headline_buf.append(data)
        elif self.in_wikitable and self.in_cell:
            self.cell_buf.append(data)


def main():
    html_text = SRC.read_text(encoding="utf-8")
    parser = ModifierListParser()
    parser.feed(html_text)

    fieldnames = [
        "subsection",
        "modifier",
        "example",
        "description",
        "effect_type",
    ]

    rows_by_section = {name: [] for name in SECTION_FILES}
    for row in parser.rows:
        example = row.get("Example", "")
        # strip the "key = " prefix that duplicates the Modifier column, keep just the value
        example = re.sub(r"^\s*\S+\s*=\s*", "", example).strip()
        section = row.get("_section", "")
        rows_by_section.setdefault(section, []).append({
            "subsection": row.get("_subsection", ""),
            "modifier": row.get("Modifier", ""),
            "example": example,
            "description": row.get("Description", ""),
            "effect_type": row.get("Effect type", ""),
        })

    for section, filename in SECTION_FILES.items():
        out_rows = rows_by_section.get(section, [])
        dst = OUT_DIR / filename
        with dst.open("w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(out_rows)
        print(f"Wrote {len(out_rows)} rows -> {dst}")

    known_sections = set(SECTION_FILES)
    unexpected = set(rows_by_section) - known_sections
    if unexpected:
        print(
            f"Warning: encountered unmapped sections, not written to file: {unexpected}")


if __name__ == "__main__":
    main()
