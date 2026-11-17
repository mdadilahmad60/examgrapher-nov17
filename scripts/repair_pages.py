
#!/usr/bin/env python3
"""
Repairs scripts/pages.json when some pages lost keys (for example "exam").
Run from the project folder:   python scripts/repair_pages.py
- Missing "exam" / "exprs" / "category" are restored from the page that was already generated
  (the EG_CONFIG line inside that page's index.html). If that page does not exist yet,
  "exam" is set to true for the SAT, ACT, DeltaMath, AP Calculus and NC pages and false for the rest.
- A backup is saved as scripts/pages.json.bak before anything is changed.
"""
import json
import os
import re
import shutil

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PATH = os.path.join(ROOT, "scripts", "pages.json")
NEED = ["path", "category", "category_name", "card", "title", "desc", "h1", "exprs", "exam"]
EXAM_TRUE = {
    "exam-prep/sat-graphing-calculator/",
    "exam-prep/act-graphing-calculator/",
    "exam-prep/deltamath-graphing-calculator/",
    "exam-prep/ap-calculus-graphing-calculator/",
    "exam-prep/nc-graphing-calculator/",
}

def old_config(page):
    """EG_CONFIG of the already generated page, or None."""
    full = os.path.join(ROOT, page.get("path", ""), "index.html")
    if not page.get("path") or not os.path.isfile(full):
        return None
    with open(full, encoding="utf8") as f:
        m = re.search(r"window\.EG_CONFIG=(\{.*?\});</script>", f.read(), re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except ValueError:
        return None

with open(PATH, encoding="utf8") as f:
    data = json.load(f)

shutil.copyfile(PATH, PATH + ".bak")
restored, still_missing = 0, []
for page in data["pages"]:
    cfg = old_config(page) or {}
    for key in ("exam", "exprs", "category"):
        if key not in page:
            if key in cfg:
                page[key] = cfg[key]
                restored += 1
            elif key == "exam":
                page["exam"] = page.get("path") in EXAM_TRUE
                restored += 1
    miss = [k for k in NEED if k not in page]
    if miss:
        still_missing.append((page.get("path"), miss))

with open(PATH, "w", encoding="utf8", newline="\n") as f:
    json.dump(data, f, indent=1, ensure_ascii=False)
    f.write("\n")

print("pages:", len(data["pages"]), "| keys restored:", restored)
if still_missing:
    print("STILL MISSING (send me this list):")
    for path, miss in still_missing:
        print("  ", path, miss)
else:
    print("All pages have every required key. Now run: python scripts/build.py")
    