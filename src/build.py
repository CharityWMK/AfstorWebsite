"""Build the static Afstor site.

Pages live in src/pages/*.html. Each page starts with a metadata comment:

    <!--
    title: Page title
    description: Meta description
    nav: home | solutions | serve | impact | about | news | contact
    whatsapp: Prefilled WhatsApp message for this page
    robots: noindex          (optional)
    -->

The build wraps every page with src/partials/{head,header,footer}.html and writes
the finished file to the site root (one level above src/), which is what cPanel deploys.

Template tokens:
    {{title}} {{description}} {{whatsapp}} {{robots}} {{page}}  - page metadata
    {{current:<nav>}}   - adds aria-current="page" to the active nav item
    {{i:<name>}}        - inline icon from the sprite in partials/icons.svg
    <!-- @include name -->  - pulls in src/partials/<name>.html

Run:  python src/build.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import quote

SRC = Path(__file__).resolve().parent
ROOT = SRC.parent
PAGES = SRC / "pages"
PARTIALS = SRC / "partials"

META_RE = re.compile(r"\A\s*<!--(.*?)-->\s*", re.S)
INCLUDE_RE = re.compile(r"<!--\s*@include\s+([\w-]+)\s*-->")
ICON_RE = re.compile(r"\{\{i:([\w-]+)\}\}")
CURRENT_RE = re.compile(r"\{\{current:([\w-]+)\}\}")


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def parse_meta(text: str) -> tuple[dict[str, str], str]:
    match = META_RE.match(text)
    if not match:
        raise ValueError("page is missing its metadata comment")
    meta = {}
    for line in match.group(1).strip().splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            meta[key.strip()] = value.strip()
    return meta, text[match.end():]


def expand_includes(text: str, depth: int = 0) -> str:
    if depth > 5:
        raise RecursionError("include depth exceeded")

    def repl(m: re.Match) -> str:
        return expand_includes(read(PARTIALS / f"{m.group(1)}.html"), depth + 1)

    return INCLUDE_RE.sub(repl, text)


def icon(name: str) -> str:
    return f'<svg class="icon" aria-hidden="true" focusable="false"><use href="#i-{name}"></use></svg>'


def build_page(path: Path, sprite_ids: set[str]) -> str:
    meta, body = parse_meta(read(path))
    for key in ("title", "description", "nav"):
        if key not in meta:
            raise ValueError(f"{path.name}: missing '{key}' in metadata")

    html = "\n".join([
        read(PARTIALS / "head.html"),
        read(PARTIALS / "icons.svg"),
        read(PARTIALS / "header.html"),
        body.rstrip(),
        read(PARTIALS / "footer.html"),
    ])
    html = expand_includes(html)

    whatsapp = meta.get("whatsapp", "Hi Afstor, I'd like to know more about your clean cooking solutions.")
    robots = meta.get("robots", "index, follow")
    replacements = {
        "{{title}}": meta["title"],
        "{{description}}": meta["description"],
        "{{whatsapp}}": quote(whatsapp),
        "{{robots}}": robots,
        "{{page}}": path.name,
    }
    for token, value in replacements.items():
        html = html.replace(token, value)

    html = CURRENT_RE.sub(lambda m: ' aria-current="page"' if m.group(1) == meta["nav"] else "", html)

    missing = sorted({n for n in ICON_RE.findall(html) if n not in sprite_ids})
    if missing:
        raise ValueError(f"{path.name}: unknown icons {missing}")
    html = ICON_RE.sub(lambda m: icon(m.group(1)), html)

    leftover = re.findall(r"\{\{[^}]+\}\}", html)
    if leftover:
        raise ValueError(f"{path.name}: unresolved tokens {sorted(set(leftover))}")
    return html


def main() -> int:
    sprite_ids = set(re.findall(r'<symbol id="i-([\w-]+)"', read(PARTIALS / "icons.svg")))
    pages = sorted(PAGES.glob("*.html"))
    if not pages:
        print("No pages found in", PAGES)
        return 1
    for page in pages:
        out = ROOT / page.name
        out.write_text(build_page(page, sprite_ids), encoding="utf-8", newline="\n")
        print(f"built {out.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
