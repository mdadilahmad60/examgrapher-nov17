#!/usr/bin/env python3
"""
Rebuilds scripts/pages.json from the pages that were already generated in this folder
(index.html, every tool page, legal pages and sitemap.xml). Use it ONLY when pages.json is lost.

    python scripts/rebuild_pages_json.py

Then:  python scripts/add_faq.py      (puts the FAQ back)
       python scripts/build.py
If scripts/pages.json already exists, nothing is overwritten (the old file is kept; delete it first if you want to rebuild).
"""
import html
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "scripts", "pages.json")

def read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf8") as f:
        return f.read()

def one(pattern, text, what):
    m = re.search(pattern, text, re.S)
    if not m:
        sys.exit("Could not find %s" % what)
    return html.unescape(m.group(1))

def config(text, what):
    m = re.search(r"window\.EG_CONFIG=(\{.*?\});</script>", text, re.S)
    if not m:
        sys.exit("Could not find the equation settings in %s" % what)
    return json.loads(m.group(1))

if os.path.exists(OUT):
    sys.exit("scripts/pages.json already exists. Rename or delete it first if you really want to rebuild it.")

home_html = read("index.html")
domain = one(r'<link rel="canonical" href="([^"]*?)/?">', home_html, "the domain in index.html")
year = int(one(r"&copy; (\d{4})", home_html, "the year in the footer"))

categories = [
    {"id": cid, "name": html.unescape(name)}
    for cid, name in re.findall(r'<h3 class="cat-title" id="([^"]+)">(.*?)</h3>', home_html)
]
cat_name = {c["id"]: c["name"] for c in categories}

home = {
    "title": one(r"<title>(.*?)</title>", home_html, "home title"),
    "desc": one(r'<meta name="description" content="(.*?)">', home_html, "home description"),
    "h1": one(r'<h1 class="tool-title">(.*?)</h1>', home_html, "home h1"),
    "sub": one(r"<h2>Free online graphing calculator</h2><p>(.*?)</p>", home_html, "home intro text"),
    "exprs": config(home_html, "index.html")["exprs"],
}

# the sitemap lists the pages in the same order as pages.json
urls = re.findall(r"<loc>(.*?)</loc>", read("sitemap.xml"))
paths = [u[len(domain):].lstrip("/") for u in urls if u.rstrip("/") != domain]

pages = []
for path in paths:
    t = read(path + "index.html")
    cfg = config(t, path)
    h1 = one(r'<h1 class="tool-title">(.*?)</h1>', t, "h1 of " + path)
    pages.append({
        "path": path,
        "category": cfg["category"],
        "category_name": cat_name.get(cfg["category"], ""),
        "card": h1,
        "title": one(r"<title>(.*?)</title>", t, "title of " + path),
        "desc": one(r'<meta name="description" content="(.*?)">', t, "description of " + path),
        "h1": h1,
        "exprs": cfg["exprs"],
        "exam": bool(cfg["exam"]),
    })

legal = []
for slug in ["about", "contact", "terms", "privacy-policy"]:
    t = read("legal/%s.html" % slug)
    block = one(r"</h1>(.*?)<p><a href=\"\.\./index\.html\">", t, "text of legal/" + slug)
    legal.append({
        "slug": slug,
        "title": one(r"<title>(.*?)</title>", t, "title of legal/" + slug),
        "h1": one(r"<h1>(.*?)</h1>", t, "h1 of legal/" + slug),
        "body": [html.unescape(x) for x in re.findall(r"<p>(.*?)</p>", block, re.S)],
    })

data = {"site": {"name": "ExamGrapher", "domain": domain, "year": year},
        "home": home, "categories": categories, "pages": pages, "legal": legal}
with open(OUT, "w", encoding="utf8", newline="\n") as f:
    json.dump(data, f, indent=1, ensure_ascii=False)
    f.write("\n")
print("pages.json rebuilt: %d tool pages, %d legal pages, %d categories" % (len(pages), len(legal), len(categories)))
print("Next: python scripts/add_faq.py   then   python scripts/build.py")
