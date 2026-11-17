import json, os
p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pages.json")
d = json.load(open(p, encoding="utf8"))
need = ["path", "category", "category_name", "card", "title", "desc", "h1", "exprs", "exam"]
for i, pg in enumerate(d["pages"]):
    miss = [k for k in need if k not in pg]
    if miss:
        print(i, pg.get("path"), "missing:", miss)
print("pages:", len(d["pages"]))