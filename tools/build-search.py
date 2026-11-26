#!/usr/bin/env python3
"""Bygger data/search.json, indexet som sökningen i menyn använder (js/search.js).

Läser alla undersidor (*/index.html) och plockar ut sidtitel (h1), rubriker (h2 med id)
och frågor (<details id> i FAQ). Kör efter att du ändrat i sidorna:

    python3 tools/build-search.py

Behövs inte i WordPress, där används WP:s egen sökning.
"""
import json
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.entries, self.stack, self.title = [], [], ""
        self.capture = None  # (nivå, id, text)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "details" and a.get("id"):
            self.stack.append(a["id"])
        if tag == "h1" and "page__title" in (a.get("class") or ""):
            self.capture = [1, "", ""]
        elif tag == "h2" and a.get("id"):
            self.capture = [2, a["id"], ""]
        elif tag == "summary" and self.stack:
            self.capture = [3, self.stack[-1], ""]

    def handle_endtag(self, tag):
        if tag == "details" and self.stack:
            self.stack.pop()
        if self.capture and tag in ("h1", "h2", "summary"):
            level, anchor, text = self.capture
            self.capture = None
            text = " ".join(text.split())
            if level == 1:
                self.title = text
            self.entries.append((level, anchor, text))

    def handle_data(self, data):
        if self.capture:
            self.capture[2] += data


def main():
    index = []
    for path in sorted(ROOT.glob("**/index.html")):
        rel = path.parent.relative_to(ROOT).as_posix()
        if rel == "." or rel.startswith(("vendor", "tools", "node_modules")):
            continue  # startsidan är turen, den indexeras inte
        page = Page()
        page.feed(path.read_text(encoding="utf-8"))
        for level, anchor, text in page.entries:
            index.append({
                "t": text,
                "p": page.title,
                "u": f"{rel}/" + (f"#{anchor}" if anchor else ""),
                "level": level,
            })
    out = ROOT / "data" / "search.json"
    out.write_text(json.dumps(index, ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
    print(f"{len(index)} poster → {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
