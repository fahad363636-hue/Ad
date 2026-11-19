#!/usr/bin/env python3
"""Render the public catalog from Sileo depiction JSON, not shortened summaries."""
import html
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

root = Path(sys.argv[1] if len(sys.argv) > 1 else "dist")
page_file = root / "index.html"
depictions = root / "depictions"

def esc(s):
    return html.escape(str(s), quote=True)

def safe_url(s):
    u = urlparse(str(s))
    return str(s) if (u.scheme == "https" and u.netloc in ("mjrepo.pages.dev", "t.me", "fahadventure034.gumroad.com")) or u.scheme == "mailto" else ""

def inline(s):
    s = esc(s)
    def link(m):
        u = safe_url(html.unescape(m.group(2)))
        return '<a href="' + esc(u) + '" rel="noopener noreferrer">' + m.group(1) + '</a>' if u else m.group(1)
    s = re.sub(r"\[([^\]\n]+)\]\(([^)\s]+)\)", link, s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<!\*)\*([^*\n]+)\*(?!\*)", r"<em>\1</em>", s)
    return s

def md(s):
    out, paragraph, items = [], [], []
    def flush():
        if paragraph:
            out.append("<p>" + "<br>".join(inline(t) for t in paragraph) + "</p>")
            paragraph.clear()
        if items:
            out.append("<ul>" + "".join("<li>" + inline(t) + "</li>" for t in items) + "</ul>")
            items.clear()
    for text in str(s).replace("\r", "").split("\n"):
        line = text.strip()
        if not line:
            flush()
        else:
            match = re.match(r"^(?:[-•]|\d+[.)])\s+(.+)$", line)
            if match:
                if paragraph:
                    flush()
                items.append(match.group(1))
            else:
                if items:
                    flush()
                paragraph.append(line)
    flush()
    return "\n".join(out)

def views(data):
    return [v for tab in data["tabs"] for v in tab.get("views", [])] if data.get("tabs") else data.get("views", [])

def content_for(slug, name):
    src = depictions / slug / "depiction.json"
    if not src.exists():
        raise RuntimeError("Sileo depiction missing: " + slug)
    blocks = views(json.loads(src.read_text(encoding="utf-8")))
    text, shots, heading = [], [], ""
    for v in blocks:
        kind = v.get("class", "")
        if kind == "DepictionHeaderView":
            heading = v.get("title", "")
            if heading.casefold().strip() != name.casefold().strip():
                text.append("<h4>" + esc(heading) + "</h4>")
        elif kind == "DepictionMarkdownView":
            text.append(md(v.get("markdown", "")))
        elif kind == "DepictionTableTextView":
            text.append('<p class="sileo-meta"><strong>' + esc(v.get("title", "")) +
                        ":</strong> " + esc(v.get("text", "")) + "</p>")
        elif kind == "DepictionButtonView":
            u = safe_url(v.get("action", ""))
            if u:
                text.append('<p><a href="' + esc(u) + '">' + esc(v.get("text", "Open")) + "</a></p>")
        elif kind == "DepictionImageView":
            u = safe_url(v.get("URL", ""))
            if u and urlparse(u).path.startswith("/depictions/"):
                caption = v.get("caption") or (heading if "before" in heading.lower() or "after" in heading.lower() else "Screenshot " + str(len(shots)+1))
                shots.append('<figure class="sileo-shot"><img loading="lazy" decoding="async" src="' + esc(u) +
                             '" alt="' + esc(name + " — " + caption) + '"><figcaption>' + esc(caption) +
                             "</figcaption></figure>")
    first = next((v.get("markdown", "").strip().split("\n\n", 1)[0]
                  for v in blocks if v.get("class")=="DepictionMarkdownView" and len(v.get("markdown", ""))>=50), "")
    first = re.sub(r"[\*_]", "", first)
    first = re.sub(r"\s+", " ", first)
    if len(first) > 210:
        first = first[:207].rstrip() + "…"
    if not shots or not text:
        raise RuntimeError("No Sileo screenshots / description for " + slug)
    return first, "".join(text), "".join(shots), len(shots)

pattern = re.compile(
    r'<div class="pkg"><div class="glyph">(?P<glyph>[^<]*)</div><div><div class="name">'
    r'<a href="depictions/(?P<slug>[^/]+)/">(?P<name>[^<]*)</a></div>'
    r'<div class="description">(?P<summary>[^<]*)</div></div></div>'
)
page = page_file.read_text(encoding="utf-8")
assert "sileo-catalog-v1" not in page, "Catalog rendered twice"
stats = []
def replace(m):
    slug = m.group("slug")
    name = html.unescape(m.group("name"))
    summary, details, gallery, count = content_for(slug, name)
    stats.append((slug, count))
    url = "depictions/" + slug + "/"
    return ('<article class="pkg pkg-rich"><div class="pkg-head"><div class="glyph">' + m.group("glyph") +
            '</div><div><div class="name"><a href="' + esc(url) + '">' + esc(name) +
            '</a></div><div class="description">' + esc(summary or html.unescape(m.group("summary"))) +
            '</div></div></div><div class="sileo-preview">' + gallery +
            '</div><details class="sileo-more"><summary>الوصف الكامل والمميزات · Full description &amp; features</summary>'
            '<div class="sileo-text">' + details + '</div>'
            '<p class="sileo-open"><a href="' + esc(url) + '">صفحة الأداة · Full tool page</a></p>'
            '</details></article>')

page, n = pattern.subn(replace, page)
assert n == 16, "Expected 16 tools; found " + str(n)
style = """
<style id="sileo-catalog-v1">
.grid{align-items:start}.pkg-rich{display:block}.pkg-head{display:flex;gap:14px;align-items:start}
.pkg-head>.glyph{flex:none}.pkg-rich .description{font-size:13px;line-height:1.55;margin-top:7px}
.sileo-preview{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x proximity;padding:4px 2px 13px;margin-top:12px}
.sileo-shot{flex:none;margin:0;scroll-snap-align:start}
.sileo-shot img{display:block;height:165px;width:auto;max-width:160px;border-radius:12px;border:1px solid #ffffff35;object-fit:contain;background:#ffffff10}
.sileo-shot figcaption{text-align:center;font-size:11px;color:#bdc8ec;margin-top:5px}
.sileo-more{border-top:1px solid #ffffff28;padding-top:12px;margin-top:8px}
.sileo-more summary{cursor:pointer;font-size:13px;color:#e3eaff;font-weight:700;outline-offset:5px}
.sileo-text{font-size:14px;line-height:1.75;color:#e1e9ff;overflow-wrap:anywhere}
.sileo-text p{color:inherit;margin:10px 0}.sileo-text h4{margin:16px 0 7px;font-size:16px;color:white}
.sileo-text ul{padding-inline-start:23px;margin:9px 0}.sileo-text li{margin:5px 0}
.sileo-text a,.sileo-open a{color:#b9d5ff;overflow-wrap:anywhere}
.sileo-meta{padding-bottom:7px;border-bottom:1px solid #ffffff15}
.sileo-open{margin-top:17px}
@media(max-width:650px){.pkg-rich{padding:17px}.sileo-shot img{height:180px}}
</style>
"""
assert "</head>" in page
page_file.write_text(page.replace("</head>", style + "</head>", 1), encoding="utf-8")
print("SILEO_MATCHED_CATALOG", n, "TOOLS")
for slug,count in stats:
    print(slug, "screenshots", count)
