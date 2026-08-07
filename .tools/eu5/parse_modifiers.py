#!/usr/bin/env python3
"""One-off script: parse the saved EU5 wiki 'Modifier types' HTML page into CSVs.

Usage: python3 parse_modifiers.py
Reads:  Modifier_list_eu5.html (same folder)
Writes:
  eu5_modifiers_country.csv                   - everything else (country, unit, etc.)
  eu5_modifiers_local.csv                     - category starts with "location"
  eu5_modifiers_internationalorganization.csv - category starts with "internationalorganization"
  eu5_modifiers_character.csv                 - category starts with "character"

The EU5 wiki page keeps all modifiers in a single big table ("List of all
defined modifier types") with columns: Modifier type, Localization, Category,
Type, Format, Notes. There is also an unrelated "wikitable" earlier on the page
(documenting modifier-type *parameters* like decimals/color/percent) which is
skipped based on its header row not matching the expected columns.
"""
import csv
import html
import re
from html.parser import HTMLParser
from pathlib import Path

SRC = Path(__file__).parent / "Modifier_list_eu5.html"
OUT_DIR = Path(__file__).parent

SPLIT_CATEGORIES = {
    "location": "eu5_modifiers_local.csv",
    "internationalorganization": "eu5_modifiers_internationalorganization.csv",
    "character": "eu5_modifiers_character.csv",
}
MAIN_FILE = "eu5_modifiers_country.csv"

EXPECTED_HEADER_MARKERS = {"Modifier type", "Category"}


def norm(text: str) -> str:
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


class ModifierTypesParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows = []

        # table capture state
        self.table_depth = 0
        self.in_candidate_table = False
        self.table_is_target = False
        self.in_thead = False
        self.in_tbody = False
        self.headers = []
        self.current_row = None
        self.cell_buf = None
        self.in_cell = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "table":
            classes = attrs.get("class", "")
            if "wikitable" in classes.split():
                self.table_depth += 1
                self.in_candidate_table = True
                self.table_is_target = False
                self.headers = []
        elif self.in_candidate_table and tag == "thead":
            self.in_thead = True
        elif self.in_candidate_table and tag == "tbody":
            self.in_tbody = True
        elif self.in_candidate_table and tag == "tr":
            self.current_row = []
        elif self.in_candidate_table and tag in ("td", "th"):
            self.in_cell = True
            self.cell_buf = []
        elif self.in_candidate_table and self.in_cell and tag == "img":
            alt = attrs.get("alt")
            if alt:
                alt = re.sub(r"\.(png|jpg|jpeg|gif|svg)$", "", alt, flags=re.I)
                self.cell_buf.append(alt)

    def handle_endtag(self, tag):
        if tag == "table" and self.in_candidate_table:
            self.table_depth -= 1
            if self.table_depth == 0:
                self.in_candidate_table = False
                self.table_is_target = False
                self.in_thead = False
                self.in_tbody = False
                self.headers = []
        elif tag == "thead":
            self.in_thead = False
        elif tag == "tbody":
            self.in_tbody = False
        elif tag in ("td", "th") and self.in_candidate_table and self.in_cell:
            self.in_cell = False
            text = norm("".join(self.cell_buf))
            if self.current_row is not None:
                self.current_row.append(text)
        elif tag == "tr" and self.in_candidate_table:
            if self.in_thead and self.current_row:
                self.headers = self.current_row
                self.table_is_target = EXPECTED_HEADER_MARKERS.issubset(
                    set(self.headers))
            elif self.in_tbody and self.current_row and self.table_is_target:
                row = dict(zip(self.headers, self.current_row))
                if row.get("Modifier type"):
                    self.rows.append(row)
            self.current_row = None

    def handle_data(self, data):
        if self.in_candidate_table and self.in_cell:
            self.cell_buf.append(data)


def main():
    html_text = SRC.read_text(encoding="utf-8")
    parser = ModifierTypesParser()
    parser.feed(html_text)

    fieldnames = ["modifier", "localization",
                  "category", "type", "format", "notes"]

    rows_by_file = {filename: [] for filename in SPLIT_CATEGORIES.values()}
    rows_by_file[MAIN_FILE] = []
    for row in parser.rows:
        category = row.get("Category", "")
        primary_category = category.split(",")[0].strip()
        filename = SPLIT_CATEGORIES.get(primary_category, MAIN_FILE)
        rows_by_file[filename].append({
            "modifier": row.get("Modifier type", ""),
            "localization": row.get("Localization", ""),
            "category": category,
            "type": row.get("Type", ""),
            "format": row.get("Format", ""),
            "notes": row.get("Notes", ""),
        })

    for filename, out_rows in rows_by_file.items():
        dst = OUT_DIR / filename
        with dst.open("w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(out_rows)
        print(f"Wrote {len(out_rows)} rows -> {dst}")


if __name__ == "__main__":
    main()
