#!/usr/bin/env python3
"""
ExamGrapher static site generator.
    python scripts/build.py
"""
import html
import json
import os
from datetime import date

TODAY = date.today().isoformat()

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA = json.load(open(os.path.join(ROOT, "scripts", "pages.json"), encoding="utf8"))
SITE = DATA["site"]
OG_IMAGE = SITE["domain"] + "/assets/img/og-default.png"   # default 1200x630 share image
ASSET_V = "11"          # bump after every css/js change so browsers reload

DISCLAIMERS = {
    "exam-prep/sat-graphing-calculator/": (
        "Disclaimer: ExamGrapher is an independent educational practice tool and is not affiliated with, "
        "endorsed by, or sponsored by the College Board. SAT\u00ae is a registered trademark of the College Board."
    ),
    "exam-prep/act-graphing-calculator/": (
        "Disclaimer: ExamGrapher is an independent educational practice tool and is not affiliated with, "
        "endorsed by, or sponsored by ACT, Inc. ACT\u00ae is a registered trademark of ACT, Inc."
    ),
    "exam-prep/deltamath-graphing-calculator/": (
        "Disclaimer: ExamGrapher is an independent educational tool and is not affiliated with, "
        "endorsed by, or sponsored by DeltaMath or the College Board (AP\u00ae)."
    ),
    "exam-prep/ap-calculus-graphing-calculator/": (
        "Disclaimer: ExamGrapher is an independent educational practice tool and is not affiliated with, "
        "endorsed by, or sponsored by the College Board. AP\u00ae is a registered trademark of the College Board."
    ),
    "exam-prep/nc-graphing-calculator/": (
        "Disclaimer: ExamGrapher is an independent educational practice tool and is not affiliated with, "
        "endorsed by, or sponsored by the North Carolina Department of Public Instruction (NCDPI)."
    ),
    "exam-prep/georgia-milestones-calculator/": (
        "Disclaimer: ExamGrapher is an independent educational practice tool and is not affiliated with, "
        "endorsed by, or sponsored by the Georgia Department of Education (GaDOE)."
    ),
    "exam-prep/virginia-sol-graphing-calculator/": (
        "Disclaimer: ExamGrapher is an independent educational practice tool and is not affiliated with, "
        "endorsed by, or sponsored by the Virginia Department of Education (VDOE)."
    ),
    "compare/ti-83-plus-vs-ti-84-plus/": (
        "Disclaimer: ExamGrapher is an independent educational resource and is not affiliated with, "
        "endorsed by, or sponsored by Texas Instruments Incorporated. TI-83 Plus and TI-84 Plus are trademarks of Texas Instruments."
    ),
}

def esc(s):
    return html.escape(s, quote=True)

def depth_prefix(path):
    """'' for the home page, '../../' for tool pages, '../' for legal pages"""
    return "../" * path.count("/") if path else ""

# --------------------------------------------------------------------------- icons
ICONS = {
    "menu": "M4 6h16M4 12h16M4 18h16",
    "close": "M6 6l12 12M18 6L6 18",
    "share": "M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13",
    "sliders": "M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4",
    "moon": "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
    "sun": "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
    "plus": "M12 5v14M5 12h14",
    "minus": "M5 12h14",
    "home": "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
    "expand": "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
    "collapse": "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5",
    "keyboard": "M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6",
    "chevron-down": "M6 9l6 6 6-6",
    "chevron-up": "M6 15l6-6 6 6",
    "backspace": "M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7 6-7zM13 9.5l5 5M18 9.5l-5 5",
    "left": "M15 5l-7 7 7 7",
    "right": "M9 5l7 7-7 7",
    "enter": "M20 5v7a2 2 0 0 1-2 2H5M9 10l-4 4 4 4",
    "download": "M12 4v11M7 11l5 5 5-5M5 20h14",
    "search": "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
}

def sprite():
    out = ['<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">']
    for k, d in ICONS.items():
        out.append('<symbol id="i-%s" viewBox="0 0 24 24"><path d="%s"/></symbol>' % (k, d))
    out.append("</svg>")
    return "".join(out)

def icon(name, cls="i"):
    return '<svg class="%s" aria-hidden="true"><use href="#i-%s"/></svg>' % (cls, name)

LOGO = ('<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="var(--accent)"/>'
        '<path d="M5 8v16h22" fill="none" stroke="var(--accent-ink)" stroke-width="2" stroke-linecap="round" opacity=".55"/>'
        '<path d="M7 9c3 12 5 14 8 9s5-2 10-9" fill="none" stroke="var(--accent-ink)" stroke-width="2.6" stroke-linecap="round"/></svg>')

# --------------------------------------------------------------------------- shared chrome
def tool_groups(root, current=None):
    out = []
    for cat in DATA["categories"]:
        items = [p for p in DATA["pages"] if p["category"] == cat["id"]]
        lis = []
        for p in items:
            cur = ' aria-current="page"' if p["path"] == current else ""
            lis.append('<li><a href="%s%s"%s>%s</a></li>' % (root, p["path"], cur, esc(p["h1"])))
        out.append('<section class="tg" data-cat="%s"><h3 class="tg-title">%s</h3><ul class="tg-list">%s</ul></section>'
                   % (cat["id"], esc(cat["name"]), "".join(lis)))
    return "".join(out)

SEARCH_HINTS = ["graphing calculator", "Digital SAT graphing calculator", "linear regression calculator", "quadratic graphing calculator",
                "Desmos alternative", "line of best fit", "AP Precalculus calculator", "Texas STAAR calculator", "unit circle calculator",
                "derivative graphing calculator", "TI-84 online", "polar graph calculator", "compound interest grapher",
                "z-score calculator", "standard deviation calculator", "t-test calculator", "chi-square calculator"]

def search_box():
    return (
        '<div id="hsearch" class="hsearch" role="search"><span class="hs-ic">%s</span>'
        '<input id="siteSearch" class="hs-input" type="search" role="combobox" aria-expanded="false" aria-controls="searchList" aria-autocomplete="list" '
        'aria-label="Search graphing calculators, exams and topics" autocomplete="off" spellcheck="false" enterkeyhint="search" '
        'placeholder="Search for graphing calculator" data-hints="%s">'
        '<button id="searchClose" class="icon-btn hs-close" type="button" aria-label="Close search">%s</button>'
        '<div id="searchList" class="search-list" role="listbox" aria-label="Search results" hidden></div></div>'
        % (icon("search"), esc("|".join(SEARCH_HINTS)), icon("close")))

def search_tag(root):
    return '<script src="%sassets/js/search.js?v=%s" defer></script>\n' % (root, ASSET_V)

def header(root, title_html, current, tool_page):
    share = ('<button id="shareBtn" class="icon-btn" type="button" aria-label="Share link to this graph">%s</button>' % icon("share")) if tool_page else ""
    gear = ('<button id="settingsBtn" class="icon-btn" type="button" aria-label="Settings" aria-haspopup="true" aria-expanded="false" aria-controls="settingsPanel">%s</button>' % icon("sliders")) if tool_page else ""
    settings = ""
    if tool_page:
        settings = (
            '<div id="settingsPanel" class="popover" role="dialog" aria-label="Settings" hidden>'
            '<div class="pop-row"><span>Angle mode</span><div class="seg" role="group" aria-label="Angle mode">'
            '<button id="angRad" type="button" aria-pressed="true">RAD</button><button id="angDeg" type="button" aria-pressed="false">DEG</button></div></div>'
            '<div class="pop-row"><span>US Exam Mode<small>Locks hints, key points and tooltips</small></span>'
            '<button id="examSwitch" class="switch" type="button" role="switch" aria-checked="false" aria-label="US Exam Mode"></button></div>'
            '<div class="pop-row"><span>Theme</span><div class="seg" role="group" aria-label="Theme">'
            '<button id="thAuto" type="button" aria-pressed="true">Auto</button><button id="thLight" type="button" aria-pressed="false">Light</button>'
            '<button id="thDark" type="button" aria-pressed="false">Dark</button></div></div>'
            '<button id="pngBtn" class="pop-action" type="button">%s Download PNG</button>'
            '<button id="jpgBtn" class="pop-action" type="button">%s Download JPG</button>'
            '<button id="pdfBtn" class="pop-action" type="button">%s Save as PDF</button></div>' % (icon("download"), icon("download"), icon("download")))
    return (
        '<header class="app-header">'
        '<button id="menuBtn" class="icon-btn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="drawer">%s</button>'
        '<a class="logo" href="%sindex.html" aria-label="ExamGrapher home">%s<b>Exam<span>Grapher</span></b></a>'
        '<%s class="tool-title">%s</%s>@@SEARCH@@'
        '<div class="tools-wrap"><button id="toolsBtn" class="hdr-btn" type="button" aria-expanded="false" aria-haspopup="true" aria-controls="toolsPanel">Tools %s</button>'
        '<nav id="toolsPanel" class="tools-panel" aria-label="All graphing tools" hidden>%s</nav></div>'
        '@@SEARCHBTN@@%s%s'
        '<button id="themeBtn" class="icon-btn only-wide" type="button" aria-label="Toggle dark mode"><span class="ic-moon">%s</span><span class="ic-sun">%s</span></button>'
        '</header>%s'
        % (icon("menu"), root, LOGO, "h1" if tool_page else "p", title_html, "h1" if tool_page else "p", icon("chevron-down"), tool_groups(root, current),
           share, gear, icon("moon"), icon("sun"), settings)
    ).replace("@@SEARCH@@", search_box()).replace("@@SEARCHBTN@@",
        '<button id="searchBtn" class="icon-btn hs-open" type="button" aria-label="Search tools" aria-expanded="false" aria-controls="hsearch">%s</button>' % icon("search"))

def drawer(root):
    return (
        '<div id="scrim" class="scrim"></div>'
        '<aside id="drawer" class="drawer" aria-label="Menu">'
        '<div class="drawer-head"><a class="logo" href="%sindex.html" aria-label="ExamGrapher home">%s<b style="display:inline">Exam<span>Grapher</span></b></a>'
        '<button id="drawerClose" class="icon-btn" type="button" aria-label="Close menu">%s</button></div>'
        '<div class="drawer-search"><input id="toolSearch" type="search" placeholder="Search %d tools" aria-label="Search tools" autocomplete="off"></div>'
        '<div id="drawerTools" class="drawer-body"><p id="drawerEmpty" class="drawer-empty" hidden>No tools match your search.</p></div>'
        '<div class="drawer-links"><button id="drawerTheme" class="chip" type="button" style="margin:0 8px 6px 6px">Dark / light</button>'
        '<a href="%slegal/about.html">About</a><a href="%slegal/contact.html">Contact</a>'
        '<a href="%slegal/privacy-policy.html">Privacy</a><a href="%slegal/terms.html">Terms</a></div></aside>'
        '<div id="toast" class="toast" role="status" aria-live="polite"></div>'
        % (root, LOGO, icon("close"), len(DATA["pages"]), root, root, root, root))

def footer(root):
    return (
        '<footer class="site-footer"><div class="footer-inner">'
        '<div>&copy; %d ExamGrapher &middot; Free online graphing calculator for students.</div>'
        '<nav aria-label="Footer"><a href="%slegal/about.html">About</a><a href="%slegal/contact.html">Contact</a>'
        '<a href="%slegal/privacy-policy.html">Privacy Policy</a><a href="%slegal/terms.html">Terms</a></nav>'
        '</div></footer>' % (SITE["year"], root, root, root, root))

def ad(slot):
    return '<div class="ad-slot" data-slot="%s" aria-hidden="true"></div>' % slot

def head(title, desc, canonical, root, extra=""):
    theme_boot = ("(function(){try{var t=localStorage.getItem('eg-theme');"
                  "if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();")
    favicon = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='9' fill='%232457d6'/%3E"
               "%3Cpath d='M7 9c3 12 5 14 8 9s5-2 10-9' fill='none' stroke='white' stroke-width='2.6' stroke-linecap='round'/%3E%3C/svg%3E")
    return (
        '<!DOCTYPE html>\n<html lang="en">\n<head>\n'
        '  <meta charset="UTF-8">\n'
        '  <meta name="viewport" content="width=device-width, initial-scale=1">\n'
        '  <meta name="color-scheme" content="light dark">\n'
        '  <meta name="theme-color" content="#ffffff">\n'
        '  <title>%s</title>\n'
        '  <meta name="description" content="%s">\n'
        '  <link rel="canonical" href="%s">\n'
        '  <meta property="og:type" content="website">\n'
        '  <meta property="og:site_name" content="ExamGrapher">\n'
        '  <meta property="og:title" content="%s">\n'
        '  <meta property="og:description" content="%s">\n'
        '  <meta property="og:url" content="%s">\n'
        '  <meta property="og:image" content="%s">\n'
        '  <meta property="og:image:width" content="1200">\n'
        '  <meta property="og:image:height" content="630">\n'
        '  <meta property="og:image:alt" content="ExamGrapher: free online graphing calculator">\n'
        '  <meta name="twitter:card" content="summary_large_image">\n'
        '  <meta name="twitter:image" content="%s">\n'
        '  <link rel="icon" href="%s">\n'
        '  <link rel="manifest" href="%smanifest.webmanifest">\n'
        '  <link rel="apple-touch-icon" href="%sassets/img/apple-touch-icon.png">\n'
        '  <meta name="apple-mobile-web-app-capable" content="yes">\n'
        '  <script>%s</script>\n'
        '  <link rel="stylesheet" href="%sassets/css/style.css?v=%s">\n%s'
        '</head>\n'
        % (esc(title), esc(desc), esc(canonical), esc(title), esc(desc), esc(canonical), OG_IMAGE, OG_IMAGE, favicon, root, root, theme_boot, root, ASSET_V, extra))

# --------------------------------------------------------------------------- calculator shell
def app_shell():
    return (
        '<main id="app" class="app" aria-label="Graphing calculator">'
        '<section class="graph-wrap" aria-label="Graph">'
        '<div class="graph-titlebar"><label for="graphTitle">GRAPH TITLE</label><input id="graphTitle" type="text" value="Untitled Graph" maxlength="80" aria-label="Graph title"><span class="graph-title-hint">Saved on this device</span></div>'
        '<div id="plotCanvas" class="plot" role="img" aria-label="Interactive graph" tabindex="0"><noscript><p class="plot-msg">The graphing calculator needs JavaScript. Please enable it and reload.</p></noscript></div>'
        '<div id="examPill" class="exam-pill" hidden>US Exam Mode is on. Hints and tooltips are locked.</div>'
        '<div class="graph-tools" role="group" aria-label="Graph tools">'
        '<div class="gt-group"><button id="zoomInBtn" type="button" aria-label="Zoom in">%s</button>'
        '<button id="zoomOutBtn" type="button" aria-label="Zoom out">%s</button></div>'
        '<button id="homeBtn" class="gt-btn" type="button" aria-label="Reset view">%s</button>'
        '<button id="fullBtn" class="gt-btn" type="button" aria-label="Full screen graph" aria-pressed="false"><span class="ic-enter">%s</span><span class="ic-exit">%s</span></button>'
        '</div></section>'
        '<section id="panel" class="panel" aria-label="Equations" data-snap="peek">'
        '<div id="grip" class="grip" role="separator" aria-label="Drag to resize the equation panel"></div>'
        '<div id="panelHead" class="panel-head"><h2 class="panel-title">Equations</h2>'
        '<button id="addEqBtn" class="chip chip-primary" type="button" aria-label="Add equation">%s</button>'
        '<button id="angleChip" class="chip" type="button">RAD</button>'
        '<button id="kbToggle" class="icon-btn" type="button" aria-label="Math keyboard" aria-pressed="false">%s</button>'
        '<button id="sheetToggle" class="icon-btn sheet-toggle" type="button" aria-label="Expand or collapse equations">%s</button></div>'
        '<div class="panel-body"><div id="equationList"></div>'
        '<details id="fitBox" class="analysis fit"><summary>Data table &amp; regression</summary><div class="fit-body">'
        '<label class="fit-label" for="fitData">Paste x, y data, one pair per line (from a spreadsheet works too)</label>'
        '<textarea id="fitData" rows="5" spellcheck="false" autocomplete="off" placeholder="1, 2.1&#10;2, 3.9&#10;3, 6.2&#10;4, 7.8"></textarea>'
        '<div class="fit-row"><select id="fitModel" aria-label="Regression model"></select>'
        '<button id="fitBtn" class="chip chip-primary fit-go" type="button">Fit &amp; graph</button>'
        '<button id="fitClear" class="chip" type="button">Clear</button></div>'
        '<div id="fitOut" aria-live="polite"></div></div></details>'
        '<details class="analysis" open><summary>Key points<span id="ptsCount"></span></summary><div id="analysisOutput"></div></details></div>'
        '</section>'
        '<section id="kbd" class="kbd" aria-label="Math keyboard" hidden>'
        '<div class="kbd-top"><div id="kbdTabs" class="kbd-tabs" role="tablist"></div>'
        '<button id="kbdNative" class="kbd-aux" type="button" aria-label="Use the phone keyboard">ABC</button>'
        '<button id="kbdHide" class="kbd-aux" type="button" aria-label="Hide math keyboard">%s</button></div>'
        '<div id="kbdGrid" class="kbd-grid"></div></section>'
        '</main>'
        % (icon("plus"), icon("minus"), icon("home"), icon("expand"), icon("collapse"),
           icon("plus"), icon("keyboard"), icon("chevron-up"), icon("chevron-down")))

def faq(p):
    """Optional FAQ block. Add a "faq": [{"q": "...", "a": "..."}] list to a page in pages.json."""
    items = p.get("faq")
    if not items:
        return ""
    rows = "".join('<details><summary>%s</summary><p>%s</p></details>' % (esc(i["q"]), esc(i["a"])) for i in items)
    return '<section class="doc" id="faq"><h2>Frequently asked questions</h2>%s</section>' % rows

def schema_tags(p, canonical):
    """JSON-LD: WebApplication for every tool page, plus FAQPage when the page has FAQs (same text as shown on the page)."""
    def tag(obj):
        return '  <script type="application/ld+json">%s</script>\n' % json.dumps(obj, ensure_ascii=False).replace("</", "<\\/")
    out = tag({
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": p["title"].split("|")[0].strip(),
        "description": p["desc"],
        "url": canonical,
        "applicationCategory": "EducationalApplication",
        "operatingSystem": "Any",
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
    })
    items = p.get("faq")
    if items:
        out += tag({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
                {"@type": "Question", "name": i["q"], "acceptedAnswer": {"@type": "Answer", "text": i["a"]}}
                for i in items
            ],
        })
    return out

def howto(name):
    return (
        '<section class="doc" id="guide"><h2>How to use the %s</h2><ul>'
        '<li><strong>Type an equation.</strong> Write it in terms of <code>x</code>, for example <code>x^2 - 4</code> or <code>2x + 1</code>. '
        'Circles, ellipses and inequalities work too: try <code>x^2 + y^2 = 9</code> or <code>y &gt; 2x + 1</code> (shaded). '
        'On a phone, tap the equation box and use the built-in math keyboard for powers, roots, fractions and trig.</li>'
        '<li><strong>Compare curves.</strong> Tap <em>+</em> to add more equations. Intersections, roots, intercepts and turning points are marked automatically, and you can tap any entry under <em>Key points</em> to jump to it.</li>'
        '<li><strong>Use sliders.</strong> Any extra letter becomes a slider, so <code>a*x^2 + b*x + c</code> lets you drag <code>a</code>, <code>b</code> and <code>c</code>.</li>'
        '<li><strong>Move around.</strong> Drag to pan, pinch or scroll to zoom, or use the + / &minus; buttons. The home button resets the view and the corner button opens a full-screen graph.</li>'
        '<li><strong>Plot points and fit a regression.</strong> Type a point such as <code>(2, 5)</code> or a list like <code>(1, 2), (2, 4), (3, 5)</code>. '
        'For real data, open <em>Data table &amp; regression</em>, paste x, y pairs and pick linear, quadratic, cubic, exponential, power or logarithmic: the best-fit equation, R\u00b2 and a prediction box appear instantly.</li>'
        '<li><strong>Degrees or radians.</strong> Tap <em>RAD</em> / <em>DEG</em> beside the equations to switch angle mode.</li>'
        '<li><strong>Name, share or save.</strong> Edit the graph title above the plot. Settings lets you download a PNG or JPG, or open a print-ready page to save as PDF. The share button copies a link that reopens your equations and graph title.</li>'
        '<li><strong>Practice for tests.</strong> Turn on <em>US Exam Mode</em> in Settings to lock key-point hints and tooltips, like a real testing calculator.</li>'
        '</ul></section>' % esc(name))

def related(page, root):
    items = [p for p in DATA["pages"] if p["category"] == page["category"] and p["path"] != page["path"]][:6]
    if len(items) < 6:
        for p in DATA["pages"]:
            if p not in items and p["path"] != page["path"] and p["category"] != page["category"]:
                items.append(p)
            if len(items) >= 6:
                break
    cards = "".join('<a class="tool-card" href="%s%s"><strong>%s</strong><span>%s</span></a>' % (root, p["path"], esc(p["h1"]), esc(p["desc"])) for p in items)
    return '<section class="doc"><h2>More graphing tools</h2><div class="tools-grid">%s</div></section>' % cards

def scripts(root, exprs, exam, category, fit=None, params=None):
    c = {"exprs": exprs, "exam": exam, "category": category}
    if fit:
        c["fit"] = fit
    if params:
        c["params"] = params
    cfg = json.dumps(c).replace("</", "<\\/")
    return ('<script>window.EG_CONFIG=%s;</script>\n'
            '<script src="%sassets/js/engine.js?v=%s" defer></script>\n'
            '<script src="%sassets/js/app.js?v=%s" defer></script>\n' % (cfg, root, ASSET_V, root, ASSET_V) + search_tag(root))

def ex_link(e):
    from urllib.parse import quote
    return "?eq=" + quote(e, safe="()^*/,.")

def intro(p):
    """Unique long-form copy: "intro" paragraphs plus optional "points" bullet list."""
    paras = "".join("<p>%s</p>" % esc(t) for t in p.get("intro", []))
    bullets = p.get("points")
    if bullets:
        paras += "<ul>%s</ul>" % "".join("<li>%s</li>" % esc(b) for b in bullets)
    return paras

def examples(p):
    """Worked examples - each opens the calculator pre-loaded via ?eq= (crawlable links, no JS needed)."""
    items = p.get("examples")
    if not items:
        return ""
    rows = "".join('<li><a class="ex-link" href="%s"><code>%s</code></a><span>%s</span></li>' % (esc(ex_link(i["e"])), esc(i["e"]), esc(i["l"]))
                   for i in items)
    return '<section class="doc" id="examples"><h2>Try these examples</h2><ul class="ex-list">%s</ul></section>' % rows

def updated_badge(p):
    return ('<p class="updated">Updated %s &middot; %s</p>' % (esc(p["updated"]), esc(p.get("badge", "Free, no sign-up")))) if p.get("updated") else ""

def signup(root):
    """Email capture (Netlify Forms). Detected at deploy time from the static HTML."""
    return (
        '<section class="doc signup" id="cheat-sheet"><div><h2>Free 2026 test-day calculator cheat sheet</h2>'
        '<p>One printable page of the graphing moves that save the most time on the Digital SAT, ACT and state tests: '
        'solving systems by intersection, regressions, vertex form and more. Join the list for instant access, plus an occasional email when new tools launch. Unsubscribe any time.</p></div>'
        '<form name="cheatsheet" method="POST" action="%sthanks/" data-netlify="true" netlify-honeypot="company" class="signup-form">'
        '<p class="hp"><label>Company <input name="company" tabindex="-1" autocomplete="off"></label></p>'
        '<label class="sr" for="su-email">Email address</label>'
        '<input id="su-email" type="email" name="email" required placeholder="you@example.com" autocomplete="email">'
        '<select name="role" aria-label="I am a"><option value="student">I am a student</option><option value="parent">I am a parent</option><option value="teacher">I am a teacher / tutor</option></select>'
        '<input type="hidden" name="source" value="">'
        '<button class="chip chip-primary" type="submit">Email me the cheat sheet</button></form></section>' % root)

def breadcrumbs_ld(p, canonical):
    cat = next((c for c in DATA["categories"] if c["id"] == p["category"]), None)
    items = [{"@type": "ListItem", "position": 1, "name": "Home", "item": SITE["domain"] + "/"}]
    if cat:
        items.append({"@type": "ListItem", "position": 2, "name": cat["name"], "item": SITE["domain"] + "/#" + cat["id"]})
    items.append({"@type": "ListItem", "position": len(items) + 1, "name": p["h1"], "item": canonical})
    return '  <script type="application/ld+json">%s</script>\n' % json.dumps(
        {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": items}, ensure_ascii=False).replace("</", "<\\/")

# --------------------------------------------------------------------------- pages
def sections_html(p):
    """Optional long-form blocks: "sections": [{"h": "...", "p": ["..."], "ul": ["..."]}]."""
    out = []
    for sec in p.get("sections", []):
        body = "".join("<p>%s</p>" % esc(t) for t in sec.get("p", []))
        if sec.get("ul"):
            body += "<ul>%s</ul>" % "".join("<li>%s</li>" % esc(i) for i in sec["ul"])
        out.append('<section class="doc"><h2>%s</h2>%s</section>' % (esc(sec["h"]), body))
    return "".join(out)

def page_stats(p):
    """Statistics calculators (z-score, standard deviation, confidence interval, t-test): form + results rendered by assets/js/stats.js."""
    root = depth_prefix(p["path"])
    canonical = "%s/%s" % (SITE["domain"], p["path"])
    disc = p.get("disclaimer") or DISCLAIMERS.get(p["path"])
    disc_html = ('<p class="brand-disclaimer">%s</p>' % esc(disc)) if disc else ""
    body = (
        header(root, esc(p["h1"]), p["path"], False) +
        '<main class="page stats-page"><nav class="crumbs" aria-label="Breadcrumb"><a href="%sindex.html">Home</a> &rsaquo; %s</nav>'
        '<section class="doc stat-card"><h1>%s</h1><div id="statsTool" data-stats-tool="%s">'
        '<noscript><p class="s-err">This calculator needs JavaScript. Please enable it and reload.</p></noscript></div></section>%s'
        '<section class="doc" id="about"><h2>About this calculator</h2>%s%s%s</section>%s%s%s</main>%s'
        % (root, esc(p["h1"]), esc(p["h1"]), esc(p["stats"]), ad("below-calculator"), updated_badge(p), intro(p), disc_html,
           sections_html(p), faq(p), related(p, root), ad("below-content")) +
        footer(root) + drawer(root) + sprite() +
        '<script src="%sassets/js/engine.js?v=%s" defer></script>\n<script src="%sassets/js/app.js?v=%s" defer></script>\n<script src="%sassets/js/stats.js?v=%s" defer></script>\n'
        % (root, ASSET_V, root, ASSET_V, root, ASSET_V) + search_tag(root))
    return head(p["title"], p["desc"], canonical, root, schema_tags(p, canonical) + breadcrumbs_ld(p, canonical)) + "<body>\n" + body + "\n</body>\n</html>\n"

def page_surface(p):
    """3D plotter: z = f(x, y) and implicit F(x, y, z) = 0, rendered by assets/js/surface3d.js (EGEngine.compileSurface / compileImplicit3, EGMarch)."""
    root = depth_prefix(p["path"])
    canonical = "%s/%s" % (SITE["domain"], p["path"])
    body = (
        header(root, esc(p["h1"]), p["path"], False) +
        '<main class="page stats-page"><nav class="crumbs" aria-label="Breadcrumb"><a href="%sindex.html">Home</a> &rsaquo; %s</nav>'
        '<section class="doc stat-card"><h1>%s</h1><div id="surface3d">'
        '<noscript><p class="s-err">This calculator needs JavaScript. Please enable it and reload.</p></noscript></div></section>%s'
        '<section class="doc" id="about"><h2>About this calculator</h2>%s%s</section>%s%s%s</main>%s'
        % (root, esc(p["h1"]), esc(p["h1"]), ad("below-calculator"), updated_badge(p), intro(p),
           sections_html(p), faq(p), related(p, root), ad("below-content")) +
        footer(root) + drawer(root) + sprite() +
        '<script src="%sassets/js/engine.js?v=%s" defer></script>\n<script src="%sassets/js/app.js?v=%s" defer></script>\n<script src="%sassets/js/marching.js?v=%s" defer></script>\n<script src="%sassets/js/surface3d.js?v=%s" defer></script>\n'
        % (root, ASSET_V, root, ASSET_V, root, ASSET_V, root, ASSET_V) + search_tag(root))
    return head(p["title"], p["desc"], canonical, root, schema_tags(p, canonical) + breadcrumbs_ld(p, canonical)) + "<body>\n" + body + "\n</body>\n</html>\n"

def page_tool(p):
    if p.get("surface"):
        return page_surface(p)
    if p.get("stats"):
        return page_stats(p)
    root = depth_prefix(p["path"])
    canonical = "%s/%s" % (SITE["domain"], p["path"])
    disc = p.get("disclaimer") or DISCLAIMERS.get(p["path"])
    disc_html = ('<p class="brand-disclaimer">%s</p>' % esc(disc)) if disc else ""
    body = (
        header(root, esc(p["h1"]), p["path"], True) + app_shell() + ad("below-calculator") +
        '<div class="page"><nav class="crumbs" aria-label="Breadcrumb"><a href="%sindex.html">Home</a> &rsaquo; %s</nav>'
        '<section class="doc"><h2>About this tool</h2>%s<p>%s</p>%s%s</section>%s%s%s%s%s</div>%s'
        % (root, esc(p["h1"]), updated_badge(p), esc(p["desc"]), intro(p), disc_html, examples(p), howto(p["h1"]), faq(p),
           signup(root), related(p, root), ad("below-content")) +
        footer(root) + drawer(root) + sprite() + scripts(root, p["exprs"], p["exam"], p["category"], p.get("fit"), p.get("params")))
    return head(p["title"], p["desc"], canonical, root, schema_tags(p, canonical) + breadcrumbs_ld(p, canonical)) + "<body>\n" + body + "\n</body>\n</html>\n"

def page_home():
    h = DATA["home"]
    root = ""
    groups = []
    for cat in DATA["categories"]:
        cards = "".join('<a class="tool-card" href="%s"><strong>%s</strong><span>%s</span></a>' % (p["path"], esc(p["h1"]), esc(p["desc"]))
                        for p in DATA["pages"] if p["category"] == cat["id"])
        groups.append('<h3 class="cat-title" id="%s">%s</h3><div class="tools-grid">%s</div>' % (cat["id"], esc(cat["name"]), cards))
    fresh = [p for p in DATA["pages"] if p.get("trend")]
    trend_html = ""
    if fresh:
        cards = "".join('<a class="tool-card is-new" href="%s"><em class="new-tag">%s</em><strong>%s</strong><span>%s</span></a>'
                        % (p["path"], esc(p["trend"]), esc(p["h1"]), esc(p["desc"])) for p in fresh)
        trend_html = ('<section class="doc" id="new-for-2026"><h2>New for the 2025&ndash;2026 school year</h2>'
                      '<p>%s</p><div class="tools-grid">%s</div></section>' % (esc(h.get("trend_intro", "")), cards))
    site_ld = ('  <script type="application/ld+json">%s</script>\n' % json.dumps({
        "@context": "https://schema.org", "@type": "WebSite", "name": SITE["name"], "url": SITE["domain"] + "/",
        "description": h["desc"]}, ensure_ascii=False).replace("</", "<\\/"))
    body = (
        header(root, esc(h["h1"]), None, True) + app_shell() + ad("below-calculator") +
        '<div class="page"><section class="doc"><h2>Free online graphing calculator</h2><p>%s</p></section>%s%s%s'
        '<section class="doc" id="all-tools"><h2>All graphing tools</h2>%s</section></div>%s' % (esc(h["sub"]), trend_html, howto("graphing calculator"), signup(root), "".join(groups), ad("below-content")) +
        footer(root) + drawer(root) + sprite() + scripts(root, h["exprs"], False, "") )
    return head(h["title"], h["desc"], SITE["domain"] + "/", root, site_ld) + "<body>\n" + body + "\n</body>\n</html>\n"

def page_legal(l):
    root = "../"
    paras = "".join("<p>%s</p>" % esc(t) for t in l["body"])
    body = (header(root, "ExamGrapher", None, False) +
            '<main class="page narrow"><section class="doc"><h1>%s</h1>%s<p><a href="%sindex.html">&larr; Back to the graphing calculator</a></p></section></main>' % (esc(l["h1"]), paras, root) +
            footer(root) + drawer(root) + sprite() +
            '<script src="%sassets/js/engine.js?v=%s" defer></script>\n<script src="%sassets/js/app.js?v=%s" defer></script>\n' % (root, ASSET_V, root, ASSET_V) + search_tag(root))
    return head(l["title"], l["h1"] + " - ExamGrapher", "%s/legal/%s.html" % (SITE["domain"], l["slug"]), root) + "<body>\n" + body + "\n</body>\n</html>\n"

def page_simple(slug, title, desc, inner, noindex=False, root="../"):
    extra = '  <meta name="robots" content="noindex">\n' if noindex else ""
    body = (header(root, "ExamGrapher", None, False) +
            '<main class="page narrow"><section class="doc">%s<p><a href="%sindex.html">&larr; Back to the graphing calculator</a></p></section></main>' % (inner, root) +
            footer(root) + drawer(root) + sprite() +
            '<script src="%sassets/js/engine.js?v=%s" defer></script>\n<script src="%sassets/js/app.js?v=%s" defer></script>\n' % (root, ASSET_V, root, ASSET_V) + search_tag(root))
    canonical = "%s/%s" % (SITE["domain"], slug) if slug else SITE["domain"] + "/404"
    return head(title, desc, canonical, root, extra) + "<body>\n" + body + "\n</body>\n</html>\n"

def extra_pages():
    cs = DATA.get("cheatsheet")
    out = []
    if cs:
        rows = "".join('<h2>%s</h2><ul>%s</ul>' % (esc(sec["h"]), "".join("<li>%s</li>" % esc(i) for i in sec["items"])) for sec in cs["sections"])
        out.append(("cheat-sheet/index.html", page_simple("cheat-sheet/", cs["title"], cs["desc"],
                    '<h1>%s</h1><p>%s</p>%s<p><button class="chip chip-primary" type="button" onclick="window.print()">Print this page</button></p>' % (esc(cs["h1"]), esc(cs["desc"]), rows), noindex=True)))
    out.append(("thanks/index.html", page_simple("thanks/", "Thanks for subscribing | ExamGrapher", "You're on the list.",
                '<h1>You&rsquo;re on the list</h1><p>Thanks for joining. Your printable cheat sheet is ready now:</p>'
                '<p><a class="chip chip-primary" href="../cheat-sheet/">Open the 2026 test-day cheat sheet</a></p>', noindex=True)))
    out.append(("404.html", page_simple("", "Page not found | ExamGrapher", "This page does not exist.",
                '<h1>That page moved or never existed</h1><p>Try the full list of graphing tools from the home page, or search with the menu.</p>', noindex=True, root="/")))
    return out

def search_index():
    """Tool index used by the header search box: [title, path, category, description, keywords, popular]."""
    rows = []
    for p in DATA["pages"]:
        name = p["title"].split("|")[0].strip()
        kw = " ".join([p.get("card", ""), name, p["path"].split("/")[1].replace("-", " "), p.get("category_name", "")])
        desc = p["desc"] if len(p["desc"]) <= 110 else p["desc"][:107].rstrip() + "..."
        rows.append([p["h1"], p["path"], p.get("category_name", ""), desc, kw, 1 if p.get("trend") else 0])
    return "/* generated by scripts/build.py - do not edit */\nwindow.EG_INDEX=%s;\n" % json.dumps(rows, ensure_ascii=False, separators=(",", ":"))

def service_worker():
    """Offline support: network-first pages (fresh content for SEO and ads), cache-first versioned assets."""
    core = ["/", "/assets/css/style.css?v=%s" % ASSET_V, "/assets/js/engine.js?v=%s" % ASSET_V,
            "/assets/js/app.js?v=%s" % ASSET_V, "/assets/js/search.js?v=%s" % ASSET_V, "/manifest.webmanifest", "/assets/img/icon-192.png"]
    return """/* ExamGrapher service worker - generated by scripts/build.py */
var VERSION = "eg-%s";
var CORE = %s;
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.indexOf("/.netlify/") === 0) return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone();
      if (res.ok) caches.open(VERSION).then(function (c) { c.put(url.pathname, copy); });
      return res;
    }).catch(function () {
      return caches.match(url.pathname).then(function (hit) { return hit || caches.match("/"); });
    }));
    return;
  }
  if (url.pathname.indexOf("/assets/") === 0 || url.pathname === "/manifest.webmanifest") {
    e.respondWith(caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        var copy = res.clone();
        if (res.ok) caches.open(VERSION).then(function (c) { c.put(req, copy); });
        return res;
      });
    }));
  }
});
""" % (ASSET_V, json.dumps(core))

def write(rel, text):
    full = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf8", newline="\n") as f:
        f.write(text)

def sitemap():
    urls = [SITE["domain"] + "/"] + ["%s/%s" % (SITE["domain"], p["path"]) for p in DATA["pages"]]
    rows = "\n".join("  <url><loc>%s</loc><lastmod>%s</lastmod></url>" % (u, TODAY) for u in urls)
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s\n</urlset>\n' % rows

def main():
    write("index.html", page_home())
    for p in DATA["pages"]:
        write(p["path"] + "index.html", page_tool(p))
    for l in DATA["legal"]:
        write("legal/%s.html" % l["slug"], page_legal(l))
    for rel, text in extra_pages():
        write(rel, text)
    write("sitemap.xml", sitemap())
    write("sw.js", service_worker())
    write("assets/js/search-data.js", search_index())
    write("robots.txt", "User-agent: *\nAllow: /\nDisallow: /scripts/\nDisallow: /thanks/\n\nSitemap: %s/sitemap.xml\n" % SITE["domain"])
    print("built: 1 home + %d tool pages + %d legal pages + sitemap" % (len(DATA["pages"]), len(DATA["legal"])))

if __name__ == "__main__":
    main()