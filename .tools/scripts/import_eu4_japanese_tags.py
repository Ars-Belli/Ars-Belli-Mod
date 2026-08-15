#!/usr/bin/env python3
"""Import EU4 colors and flags for explicitly selected EU5 country tags."""

import argparse
import codecs
import difflib
import re
import struct
import subprocess
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_EU4_ROOT = Path(
    "/home/zp/Games/SteamLibrary/steamapps/common/Europa Universalis IV"
)
DEFAULT_EU5_ROOT = Path(
    "/home/zp/Games/SteamLibrary/steamapps/common/Europa Universalis V/game"
)

COUNTRIES_DIR = Path("in_game/setup/countries")
NAMED_COLORS_FILE = Path("main_menu/common/named_colors/02_map.txt")
COA_OUTPUT = Path(
    "main_menu/common/coat_of_arms/coat_of_arms/abm_eu4_imported_tags.txt"
)
FLAG_OUTPUT = Path("main_menu/common/flag_definitions/abm_eu4_imported_tags.txt")
EMBLEM_DIR = Path("main_menu/gfx/coat_of_arms/colored_emblems")
TEXTURED_EMBLEM_DIR = Path("main_menu/gfx/coat_of_arms/textured_emblems")

EU4_TAG_PATTERN = re.compile(
    r'^\s*([A-Z0-9]{3})\s*=\s*"(countries/[^"\r\n]+\.txt)"', re.MULTILINE
)
EU4_COLOR_PATTERN = re.compile(
    r"^\s*color\s*=\s*\{\s*(\d+)\s+(\d+)\s+(\d+)\s*\}", re.MULTILINE
)


@dataclass(frozen=True)
class TextFormat:
    bom: bool
    newline: str
    encoding: str = "utf-8"


@dataclass(frozen=True)
class CoaStyle:
    emblem: str
    scale: str | None
    second_emblem_color: str


@dataclass(frozen=True)
class TargetSpec:
    target: str
    source: str


@dataclass(frozen=True)
class ImportedTag:
    target: str
    source: str
    country_color: tuple[int, int, int]
    flag_background: tuple[int, int, int]
    flag_foreground: tuple[int, int, int]
    coa_key: str
    style: CoaStyle | None


STYLE_OVERRIDES = {
    "JAP": CoaStyle("ce_chrysanthemum_japan.dds", None, "color1"),
    "ASK": CoaStyle("ce_mon_ashikaga.dds", "0.85", "color1"),
    "HJO": CoaStyle("ce_mon_hojo.dds", "0.95", "color2"),
    "TKG": CoaStyle("ce_mon_tokugawa.dds", "0.825", "color2"),
}


def read_text(path: Path) -> tuple[str, TextFormat]:
    raw = path.read_bytes()
    bom = raw.startswith(codecs.BOM_UTF8)
    if bom:
        raw = raw[len(codecs.BOM_UTF8) :]
    newline = "\r\n" if b"\r\n" in raw else "\n"
    try:
        text = raw.decode("utf-8")
        encoding = "utf-8"
    except UnicodeDecodeError:
        text = raw.decode("cp1252")
        encoding = "cp1252"
    return text.replace("\r\n", "\n"), TextFormat(
        bom=bom, newline=newline, encoding=encoding
    )


def encode_text(text: str, text_format: TextFormat) -> bytes:
    normalized = text.replace("\r\n", "\n")
    encoded = normalized.replace("\n", text_format.newline).encode(text_format.encoding)
    return (codecs.BOM_UTF8 if text_format.bom else b"") + encoded


def parse_target_specs(values: list[str]) -> list[TargetSpec]:
    specs: list[TargetSpec] = []
    seen_targets: set[str] = set()
    for value in values:
        target, separator, explicit_source = value.upper().partition("=")
        source = explicit_source if separator else target[2:] if len(target) == 5 and target.startswith("AB") else target
        if not re.fullmatch(r"[A-Z0-9]{3,5}", target):
            raise ValueError(f"invalid EU5 target tag: {target}")
        if not re.fullmatch(r"[A-Z0-9]{3}", source):
            raise ValueError(f"invalid EU4 source tag for {target}: {source}")
        if target in seen_targets:
            raise ValueError(f"duplicate EU5 target tag: {target}")
        seen_targets.add(target)
        specs.append(TargetSpec(target=target, source=source))
    return specs


def discover_ab_tags(repo_root: Path) -> list[TargetSpec]:
    """Discover EU5 country tags in ABxxx format from the country files.

    The EU4 source tag is inferred by stripping the AB prefix (ABJAP -> JAP).
    """
    pattern = re.compile(r"(?m)^\s*(?:REPLACE:)?(AB[A-Z0-9]{3})\s*=\s*\{")
    specs: list[TargetSpec] = []
    seen: set[str] = set()
    for country_file in sorted((repo_root / COUNTRIES_DIR).rglob("*.txt")):
        text = country_file.read_text(encoding="utf-8-sig", errors="replace")
        for tag in pattern.findall(text):
            if tag in seen:
                continue
            seen.add(tag)
            specs.append(TargetSpec(target=tag, source=tag[2:]))
    return specs


def find_country_files(repo_root: Path, targets: list[str]) -> dict[str, Path]:
    definitions: dict[str, Path] = {}
    target_pattern = "|".join(re.escape(target) for target in targets)
    definition_pattern = re.compile(
        rf"(?m)^\s*(?:REPLACE:)?({target_pattern})\s*=\s*\{{".encode("ascii")
    )

    for country_file in sorted((repo_root / COUNTRIES_DIR).rglob("*.txt")):
        for target_bytes in definition_pattern.findall(country_file.read_bytes()):
            target = target_bytes.decode("ascii")
            previous = definitions.get(target)
            if previous is not None and previous != country_file:
                raise ValueError(
                    f"multiple country definitions found for {target}: "
                    f"{previous} and {country_file}"
                )
            definitions[target] = country_file

    missing = [target for target in targets if target not in definitions]
    if missing:
        raise ValueError(f"EU5 country definition not found for: {', '.join(missing)}")
    return definitions


def parse_eu4_registry(country_tags_dir: Path) -> dict[str, Path]:
    registry: dict[str, Path] = {}
    for tag_file in sorted(country_tags_dir.glob("*.txt")):
        text, _ = read_text(tag_file)
        for tag, relative_path in EU4_TAG_PATTERN.findall(text):
            registry[tag] = Path(relative_path)
    return registry


def parse_country_color(country_file: Path) -> tuple[int, int, int]:
    text, _ = read_text(country_file)
    match = EU4_COLOR_PATTERN.search(text)
    if not match:
        raise ValueError(f"country color not found in {country_file}")
    red, green, blue = (int(channel) for channel in match.groups())
    return red, green, blue


def load_colors_file(path: Path) -> dict[str, tuple[int, int, int]]:
    """Parse a colors file of 'TAG = rgb { r g b }' lines into a mapping."""
    colors: dict[str, tuple[int, int, int]] = {}
    for raw_line in path.read_text(encoding="utf-8-sig", errors="replace").splitlines():
        line = raw_line.split("#", 1)[0].strip()
        if not line:
            continue
        match = re.fullmatch(
            r"([A-Z0-9]{3,5})\s*=\s*rgb\s*\{\s*(\d+)\s+(\d+)\s+(\d+)\s*\}",
            line,
        )
        if not match:
            raise ValueError(f"invalid colors-file line: {raw_line!r}")
        tag, red, green, blue = match.groups()
        colors[tag] = (int(red), int(green), int(blue))
    return colors


def find_flag_image(flags_dir: Path, source: str) -> Path | None:
    """Locate a flag image for a source tag (TGA or PNG)."""
    for extension in (".tga", ".png"):
        candidate = flags_dir / f"{source}{extension}"
        if candidate.is_file():
            return candidate
    return None


def decode_tga_pixels(path: Path) -> list[tuple[int, int, int]]:
    """Decode the pixels of a TGA file as (r, g, b) tuples."""
    return decode_tga_bytes(path.read_bytes(), str(path))


def decode_tga_bytes(data: bytes, source: str = "<data>") -> list[tuple[int, int, int]]:
    """Decode raw TGA bytes (uncompressed or RLE) into (r, g, b) tuples."""
    if len(data) < 18:
        raise ValueError(f"invalid TGA header: {source}")

    (
        id_length,
        color_map_type,
        image_type,
        _color_map_first,
        color_map_length,
        color_map_depth,
        _x_origin,
        _y_origin,
        width,
        height,
        bits_per_pixel,
        _descriptor,
    ) = struct.unpack_from("<BBBHHBHHHHBB", data)

    if color_map_type != 0 or image_type not in {2, 10}:
        raise ValueError(f"unsupported TGA type {image_type}: {source}")
    if bits_per_pixel not in {24, 32}:
        raise ValueError(f"unsupported TGA depth {bits_per_pixel}: {source}")

    bytes_per_pixel = bits_per_pixel // 8
    color_map_bytes = color_map_length * ((color_map_depth + 7) // 8)
    offset = 18 + id_length + color_map_bytes
    expected_pixels = width * height

    def read_pixel() -> tuple[int, int, int]:
        nonlocal offset
        end = offset + bytes_per_pixel
        if end > len(data):
            raise ValueError(f"truncated TGA pixel data: {source}")
        blue, green, red = data[offset : offset + 3]
        offset = end
        return red, green, blue

    pixels: list[tuple[int, int, int]] = []
    if image_type == 2:
        pixels = [read_pixel() for _ in range(expected_pixels)]
    else:
        while len(pixels) < expected_pixels:
            if offset >= len(data):
                raise ValueError(f"truncated TGA RLE data: {source}")
            packet_header = data[offset]
            offset += 1
            packet_size = (packet_header & 0x7F) + 1
            if packet_header & 0x80:
                pixels.extend([read_pixel()] * packet_size)
            else:
                pixels.extend(read_pixel() for _ in range(packet_size))

    if len(pixels) != expected_pixels:
        raise ValueError(f"invalid TGA pixel count: {source}")
    return pixels


def dominant_flag_colors(flag_file: Path) -> tuple[tuple[int, int, int], ...]:
    if flag_file.suffix.lower() == ".tga":
        pixels = decode_tga_pixels(flag_file)
    else:
        converted = subprocess.run(
            ["magick", str(flag_file), "tga:-"],
            check=True,
            capture_output=True,
        ).stdout
        pixels = decode_tga_bytes(converted, str(flag_file))
    counts = Counter(pixels)
    colors = tuple(color for color, _count in counts.most_common(2))
    if len(colors) < 2:
        raise ValueError(f"flag has fewer than two colors: {flag_file}")
    return colors


def slugify_country_name(country_path: Path) -> str:
    return re.sub(r"[^a-z0-9]+", "_", country_path.stem.lower()).strip("_")


def flag_emblem_name(source: str) -> str:
    """Name for the DDS flag texture derived from the EU4 source tag."""
    return f"ce_eu4_flag_{source.lower()}.dds"


def convert_flag_to_dds(source_tga: Path, dest_dds: Path) -> None:
    """Convert an EU4 TGA flag to an EU5-compatible DXT5 DDS emblem."""
    dest_dds.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "magick",
            str(source_tga),
            "-resize", "384x256",
            "-define", "dds:compression=dxt5",
            str(dest_dds),
        ],
        check=True,
        capture_output=True,
    )


def resolve_style(source: str, country_path: Path, eu5_root: Path) -> CoaStyle | None:
    style = STYLE_OVERRIDES.get(source)
    if style is None:
        mon_name = f"ce_mon_{slugify_country_name(country_path)}.dds"
        style = CoaStyle(
            emblem=mon_name,
            scale="0.95",
            second_emblem_color="color2",
        )

    emblem_path = (
        eu5_root
        / "main_menu"
        / "gfx"
        / "coat_of_arms"
        / "colored_emblems"
        / style.emblem
    )
    if emblem_path.is_file():
        return style

    # No existing mon — auto-generate from EU4 flag for this source tag
    return None


def generate_mon_from_flag(
    flag_tga: Path, background_rgb: tuple[int, int, int], dest_dds: Path
) -> None:
    """Convert EU4 TGA flag to DDS for use as a textured emblem (no tinting)."""
    dest_dds.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "magick",
            str(flag_tga),
            "-resize", "384x256!",
            "-define", "dds:compression=dxt5",
            str(dest_dds),
        ],
        check=True,
        capture_output=True,
    )


def coa_key_for(target: str) -> str:
    """COA block key derived from an EU5 target tag."""
    if target == "JAP":
        return "ABM_JAP_EU4"
    if len(target) == 3:
        return f"ABM_EU4_{target}"
    return target


def find_existing_imports(repo_root: Path) -> set[str]:
    """Return the COA keys already present in the generated coat-of-arms file."""
    coa_path = repo_root / COA_OUTPUT
    if not coa_path.exists():
        return set()
    text, _ = read_text(coa_path)
    return {
        match.group(1)
        for match in re.finditer(r"(?m)^([A-Z0-9_]+)\s*=\s*\{", text)
    }


def collect_imports(
    target_specs: list[TargetSpec],
    eu4_root: Path,
    eu5_root: Path,
    flags_dir: Path | None = None,
    colors: dict[str, tuple[int, int, int]] | None = None,
) -> tuple[list[ImportedTag], list[str]]:
    registry = (
        {}
        if flags_dir is not None
        else parse_eu4_registry(eu4_root / "common" / "country_tags")
    )
    imports: list[ImportedTag] = []
    skipped: list[str] = []

    for spec in target_specs:
        target = spec.target
        source = spec.source

        if flags_dir is not None:
            flag_file = find_flag_image(flags_dir, source)
            relative_country_path = None
        else:
            flag_file = eu4_root / "gfx" / "flags" / f"{source}.tga"
            relative_country_path = registry.get(source)

        if flag_file is None or not flag_file.is_file():
            skipped.append(f"{target}: no flag image for {source}")
            continue

        if colors is not None:
            if source not in colors:
                skipped.append(f"{target}: no color entry for {source}")
                continue
            country_color = colors[source]
        else:
            if relative_country_path is None:
                skipped.append(f"{target}: no EU4 registry entry for {source}")
                continue
            country_file = eu4_root / "common" / relative_country_path
            if not country_file.is_file():
                skipped.append(f"{target}: missing EU4 country file {country_file}")
                continue
            country_color = parse_country_color(country_file)

        flag_background, flag_foreground = dominant_flag_colors(flag_file)
        style_path = (
            Path(f"countries/{source}.txt")
            if relative_country_path is None else relative_country_path
        )
        style = resolve_style(source, style_path, eu5_root)
        if style is None:
            mon_name = flag_emblem_name(source)
            style = CoaStyle(emblem=mon_name, scale="1.0", second_emblem_color="color1")

        imports.append(
            ImportedTag(
                target=target,
                source=source,
                country_color=country_color,
                flag_background=flag_background,
                flag_foreground=flag_foreground,
                coa_key=coa_key_for(target),
                style=style,
            )
        )

    return imports, skipped


def find_keyed_block(text: str, key: str) -> tuple[int, int]:
    match = re.search(rf"(?m)^{re.escape(key)}\s*=\s*\{{", text)
    if not match:
        raise ValueError(f"definition not found: {key}")

    depth = 0
    started = False
    for index in range(match.start(), len(text)):
        character = text[index]
        if character == "{":
            depth += 1
            started = True
        elif character == "}":
            depth -= 1
            if started and depth == 0:
                return match.start(), index + 1
    raise ValueError(f"unterminated definition: {key}")


def update_country_colors(text: str, imports: list[ImportedTag]) -> str:
    for imported in imports:
        block_start, block_end = find_keyed_block(text, imported.target)
        block = text[block_start:block_end]
        replacement = f"color = map_{imported.target}"
        color_pattern = re.compile(
            r"(?m)^(\s*)color\s*=\s*(?:rgb\s*\{[^}\r\n]*\}|[^\r\n#}]+)"
        )
        color_match = color_pattern.search(block)
        if color_match:
            indent = color_match.group(1)
            block = color_pattern.sub(f"{indent}{replacement}", block, count=1)
        else:
            first_newline = block.find("\n")
            block = block[: first_newline + 1] + f"\t{replacement}\n" + block[first_newline + 1 :]
        text = text[:block_start] + block + text[block_end:]
    return text


def update_named_colors(text: str, imports: list[ImportedTag]) -> str:
    missing_lines: list[str] = []
    for imported in imports:
        red, green, blue = imported.country_color
        value = f"map_{imported.target} = rgb {{ {red} {green} {blue} }}"
        pattern = re.compile(
            rf"(?m)^(\s*)map_{re.escape(imported.target)}\s*=\s*rgb\s*\{{[^}}]+\}}"
        )
        match = pattern.search(text)
        if match:
            text = pattern.sub(f"{match.group(1)}{value}", text, count=1)
        else:
            missing_lines.append(f"\t{value}\n")

    if missing_lines:
        closing_brace = text.rfind("}")
        if closing_brace < 0:
            raise ValueError("named colors block has no closing brace")
        text = text[:closing_brace] + "".join(missing_lines) + text[closing_brace:]
    return text


def format_rgb(color: tuple[int, int, int]) -> str:
    return f"rgb {{ {color[0]} {color[1]} {color[2]} }}"


def merge_generated_blocks(
    old_text: str, generated_text: str, keys: list[str]
) -> str:
    if not old_text:
        return generated_text

    output = re.sub(
        r"\A# Generated by [^\n]+\n# EU4-derived [^\n]+\n",
        "\n".join(generated_text.splitlines()[:2]) + "\n",
        old_text,
        count=1,
    )
    for key in keys:
        generated_start, generated_end = find_keyed_block(generated_text, key)
        generated_block = generated_text[generated_start:generated_end]
        try:
            old_start, old_end = find_keyed_block(output, key)
        except ValueError:
            output = output.rstrip() + "\n\n" + generated_block + "\n"
        else:
            output = output[:old_start] + generated_block + output[old_end:]
    return output


def build_coa_output(imports: list[ImportedTag], old_text: str) -> str:
    lines = [
        "# Generated by .tools/import_eu4_tags.py",
        "# EU4-derived country flag colors and emblems.",
        "",
    ]
    for imported in imports:
        style = imported.style
        lines.extend(
            [
                f"{imported.coa_key} = {{ # {imported.target} from EU4 {imported.source}",
                '\tpattern = "pattern_solid.dds"',
                f"\tcolor1 = {format_rgb(imported.flag_background)}",
                f"\tcolor2 = {format_rgb(imported.flag_foreground)}",
            ]
        )
        if style is not None:
            is_textured = style.emblem.startswith("ce_eu4_flag_")
            emblem_type = "textured_emblem" if is_textured else "colored_emblem"
            lines.extend(
                [
                    "",
                    f"\t{emblem_type} = {{",
                    f'\t\ttexture = "{style.emblem}"',
                ]
            )
            if is_textured:
                # textured emblems render as-is, no tinting
                lines.append("\t\tinstance = { position = { 0.5 0.5 } scale = { 1.0 1.0 } }")
            else:
                lines.extend(
                    [
                        "\t\tcolor1 = color2",
                        f"\t\tcolor2 = {style.second_emblem_color}",
                    ]
                )
                if style.scale is not None:
                    lines.append(
                        "\t\tinstance = { position = { 0.5 0.5 } "
                        f"scale = {{ {style.scale} {style.scale} }} }}"
                    )
            lines.extend(["\t}"])
        lines.extend(["}", ""])
    generated_text = "\n".join(lines)
    keys = [imported.coa_key for imported in imports]
    return merge_generated_blocks(old_text, generated_text, keys)


def build_flag_output(imports: list[ImportedTag], old_text: str) -> str:
    lines = [
        "# Generated by .tools/import_eu4_tags.py",
        "# EU4-derived country flag selection.",
        "",
    ]
    definition_keys: list[str] = []
    for imported in imports:
        is_vanilla_sized = len(imported.target) == 3
        definition_key = f"REPLACE:{imported.target}" if is_vanilla_sized else imported.target
        definition_keys.append(definition_key)
        priority = 200 if is_vanilla_sized else 100
        lines.extend(
            [
                f"{definition_key} = {{",
                "\tflag_definition = {",
                f"\t\tcoa = {imported.coa_key}",
                f"\t\tpriority = {priority}",
                "\t\tallow_overlord_canton = no",
                "\t}",
                "}",
                "",
            ]
        )
    generated_text = "\n".join(lines)
    return merge_generated_blocks(old_text, generated_text, definition_keys)


def show_diff(path: Path, old_text: str, new_text: str, repo_root: Path) -> None:
    relative_path = path.relative_to(repo_root)
    sys.stdout.writelines(
        difflib.unified_diff(
            old_text.splitlines(keepends=True),
            new_text.splitlines(keepends=True),
            fromfile=str(relative_path),
            tofile=str(relative_path),
        )
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Import EU4 map colors and flag styling for selected EU5 tags. "
            "Use TARGET=SOURCE when the EU4 source cannot be inferred. "
            "With no tags, defaults to every ABxxx tag found in the EU5 country files."
        )
    )
    parser.add_argument(
        "tags",
        nargs="*",
        metavar="TARGET[=SOURCE]",
        help=(
            "EU5 target tag, optionally followed by its three-character EU4 "
            "source tag. Accepts 3-char vanilla tags, 5-char ABxxx tags, or "
            "TARGET=SOURCE pairs. Defaults to all ABxxx tags."
        ),
    )
    parser.add_argument("--repo-root", type=Path, default=REPO_ROOT)
    parser.add_argument("--eu4-root", type=Path, default=DEFAULT_EU4_ROOT)
    parser.add_argument("--eu5-root", type=Path, default=DEFAULT_EU5_ROOT)
    parser.add_argument(
        "--flags-dir",
        type=Path,
        default=None,
        help=(
            "directory of EU4 flag images (<SRC>.tga or <SRC>.png) used instead "
            "of --eu4-root's gfx/flags; enables standalone (no EU4 install) mode"
        ),
    )
    parser.add_argument(
        "--colors-file",
        type=Path,
        default=None,
        help=(
            "file of 'TAG = rgb { r g b }' lines used instead of EU4 country "
            "files; enables standalone (no EU4 install) mode"
        ),
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="re-import tags even if they are already present in the outputs",
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="fail if outputs are out of date")
    mode.add_argument("--dry-run", action="store_true", help="print changes without writing")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = args.repo_root.resolve()
    eu4_root = args.eu4_root.resolve()
    eu5_root = args.eu5_root.resolve()
    flags_dir = args.flags_dir.resolve() if args.flags_dir else None

    required_directories = [repo_root]
    if flags_dir is None:
        required_directories.extend(
            [
                eu4_root / "common" / "country_tags",
                eu4_root / "common" / "countries",
                eu4_root / "gfx" / "flags",
            ]
        )
    missing = [path for path in required_directories if not path.is_dir()]
    if missing:
        for path in missing:
            print(f"error: required directory not found: {path}", file=sys.stderr)
        return 2

    try:
        if args.tags:
            target_specs = parse_target_specs(args.tags)
        else:
            target_specs = discover_ab_tags(repo_root)
            if not target_specs:
                print("error: no ABxxx tags found in country files", file=sys.stderr)
                return 2

        existing = (
            set()
            if args.check or args.force
            else find_existing_imports(repo_root)
        )
        pending: list[TargetSpec] = []
        for spec in target_specs:
            if coa_key_for(spec.target) in existing:
                print(f"exists: {spec.target} (already imported)", file=sys.stderr)
            else:
                pending.append(spec)
        target_specs = pending
        if not target_specs:
            print("nothing to import: all selected tags already exist")
            return 0

        colors = (
            load_colors_file(args.colors_file.resolve())
            if args.colors_file else None
        )
        country_files = find_country_files(
            repo_root, [spec.target for spec in target_specs]
        )
        imports, skipped = collect_imports(
            target_specs, eu4_root, eu5_root, flags_dir, colors
        )
    except (ValueError, OSError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    if not imports:
        print("error: none of the selected tags has a complete EU4 source", file=sys.stderr)
        return 2

    named_colors_path = repo_root / NAMED_COLORS_FILE
    coa_path = repo_root / COA_OUTPUT
    flag_path = repo_root / FLAG_OUTPUT

    colors_text, colors_format = read_text(named_colors_path)
    old_coa_text, coa_format = (
        read_text(coa_path) if coa_path.exists() else ("", TextFormat(False, "\r\n"))
    )
    old_flag_text, flag_format = (
        read_text(flag_path) if flag_path.exists() else ("", TextFormat(False, "\r\n"))
    )

    outputs = {
        named_colors_path: (colors_text, update_named_colors(colors_text, imports), colors_format),
        coa_path: (old_coa_text, build_coa_output(imports, old_coa_text), coa_format),
        flag_path: (old_flag_text, build_flag_output(imports, old_flag_text), flag_format),
    }
    imports_by_country_file: dict[Path, list[ImportedTag]] = {}
    for imported in imports:
        imports_by_country_file.setdefault(country_files[imported.target], []).append(imported)
    for countries_path, country_imports in imports_by_country_file.items():
        countries_text, countries_format = read_text(countries_path)
        outputs[countries_path] = (
            countries_text,
            update_country_colors(countries_text, country_imports),
            countries_format,
        )
    changed = [path for path, (old, new, _format) in outputs.items() if old != new]

    # Generate textured emblems from EU4 flags for tags without existing EU5 mons
    flag_src_dir = flags_dir if flags_dir is not None else eu4_root / "gfx" / "flags"
    textured_emblem_dir = repo_root / TEXTURED_EMBLEM_DIR
    for imported in imports:
        if imported.style is not None and imported.style.emblem.startswith("ce_eu4_flag_"):
            flag_image = find_flag_image(flag_src_dir, imported.source)
            dds_path = textured_emblem_dir / imported.style.emblem
            if flag_image is not None:
                generate_mon_from_flag(flag_image, imported.flag_background, dds_path)
                print(f"mon: {imported.target} <- {imported.source} ({dds_path.name})")

    for message in skipped:
        print(f"skip: {message}", file=sys.stderr)
    for imported in imports:
        flag_status = "color only" if imported.style is None else f"flag {imported.coa_key}"
        print(f"map: {imported.target} <- {imported.source} ({flag_status})")

    if args.check:
        if changed:
            for path in changed:
                print(f"out of date: {path.relative_to(repo_root)}", file=sys.stderr)
            return 1
        print("EU4 tag imports are up to date")
        return 0

    if args.dry_run:
        for path in changed:
            old_text, new_text, _text_format = outputs[path]
            show_diff(path, old_text, new_text, repo_root)
        return 0

    for path in changed:
        _old_text, new_text, text_format = outputs[path]
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(encode_text(new_text, text_format))

    print(f"updated {len(changed)} file(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())