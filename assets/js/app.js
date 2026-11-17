/*!
 * ExamGrapher app v3 - UI layer on top of engine.js
 * bottom sheet, math keyboard, menus, dark mode, share links (?eq=...), fullscreen.
 */
(function () {
  "use strict";

  var CFG = window.EG_CONFIG || { exprs: [], exam: false, category: "" };
  var E = window.EGEngine;
  function $(id) { return document.getElementById(id); }
  function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function isMobile() { return window.matchMedia("(max-width: 899px)").matches; }
  function coarse() { return window.matchMedia("(pointer: coarse)").matches; }
  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  };

  var S = {
    eqs: [], active: null, menu: null,
    kbOpen: false, kbTab: "123", nativeKb: false,
    snap: "peek", full: false, exam: false, deg: false, dirty: false, theme: "auto"
  };
  var graph = null;

  var toastTimer = 0;
  function toast(msg) {
    var t = $("toast"); if (!t) return;
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2400);
  }

  function dec(s) { try { return decodeURIComponent(s.replace(/%(?![0-9a-fA-F]{2})/g, "%25")); } catch (e) { return s; } }
  function readURL() {
    var out = { eq: [], params: {}, deg: null, exam: null, title: null };
    var q = window.location.search.replace(/^\?/, "");
    if (!q) return out;
    q.split("&").forEach(function (pair) {
      if (!pair) return;
      var i = pair.indexOf("="), k = dec(i < 0 ? pair : pair.slice(0, i)), v = dec(i < 0 ? "" : pair.slice(i + 1));
      if (k === "eq") { if (v.trim()) out.eq.push(v.slice(0, 2000)); }
      else if (k === "angle") out.deg = v.toLowerCase() === "deg";
      else if (k === "exam") out.exam = v === "1" || v === "true";
      else if (k === "title") out.title = v.slice(0, 80);
      else if (/^[a-df-wzA-Z]$/.test(k)) { var n = parseFloat(v); if (isFinite(n)) out.params[k] = n; }
    });
    out.eq = out.eq.slice(0, 12);
    return out;
  }
  function encQ(t) {
    return encodeURIComponent(t).replace(/%5E/g, "^").replace(/%2F/g, "/").replace(/%2C/g, ",").replace(/%3A/g, ":");
  }
  function buildQuery() {
    var parts = [], used = {};
    S.eqs.forEach(function (eq) {
      var t = eq.text.trim();
      if (!t) return;
      parts.push("eq=" + encQ(t.replace(/\s*([+\-*\/^=(),<>?:])\s*/g, "$1")));
      eq.params.forEach(function (n) { used[n] = true; });
    });
    if (S.deg) parts.push("angle=deg");
    if (S.exam !== !!CFG.exam) parts.push("exam=" + (S.exam ? 1 : 0));
    if (S.graphTitle && S.graphTitle !== "Untitled Graph") parts.push("title=" + encodeURIComponent(S.graphTitle));
    var P = graph.getParams();
    Object.keys(used).forEach(function (n) {
      var v = P[n];
      if (v !== undefined && Math.abs(v - 1) > 1e-9) parts.push(encodeURIComponent(n) + "=" + parseFloat(v.toFixed(3)));
    });
    return parts.join("&");
  }
  function baseURL() { return window.location.href.split("#")[0].split("?")[0]; }
  function shareURL() { var q = buildQuery(); return baseURL() + (q ? "?" + q : ""); }
  var urlTimer = 0;
  function touchURL() {
    S.dirty = true;
    clearTimeout(urlTimer);
    urlTimer = setTimeout(function () {
      try { window.history.replaceState(null, "", shareURL()); } catch (e) { }
    }, 350);
  }
  function fallbackCopy(url) {
    var ta = document.createElement("textarea");
    ta.value = url; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(ta); ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove();
    toast(ok ? "Link copied" : "Copy this link: " + url);
  }
  function copyLink(url) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(function () { toast("Link copied"); }, function () { fallbackCopy(url); });
    } else fallbackCopy(url);
  }
  function share() {
    var url = shareURL();
    try { window.history.replaceState(null, "", url); } catch (e) { }
    if (navigator.share && coarse()) {
      navigator.share({ title: document.title, url: url }).catch(function (e) { if (!e || e.name !== "AbortError") copyLink(url); });
    } else copyLink(url);
  }

  function applyTheme(mode, silent) {
    S.theme = mode;
    var r = document.documentElement;
    if (mode === "auto") r.removeAttribute("data-theme"); else r.setAttribute("data-theme", mode);
    if (!silent) store.set("eg-theme", mode);
    [["thAuto", "auto"], ["thLight", "light"], ["thDark", "dark"]].forEach(function (p) {
      var b = $(p[0]); if (b) b.setAttribute("aria-pressed", String(p[1] === mode));
    });
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", getComputedStyle(r).getPropertyValue("--surface").trim() || "#ffffff");
    if (graph) graph.refreshTheme();
  }
  function isDarkNow() {
    var t = document.documentElement.getAttribute("data-theme");
    return t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  var MENUS = {};
  function initMenus() {
    MENUS = {
      tools: { btn: $("toolsBtn"), el: $("toolsPanel"), kind: "pop" },
      settings: { btn: $("settingsBtn"), el: $("settingsPanel"), kind: "pop" },
      drawer: { btn: $("menuBtn"), el: $("drawer"), kind: "drawer" }
    };
    Object.keys(MENUS).forEach(function (name) {
      var m = MENUS[name];
      if (!m.btn || !m.el) return;
      m.btn.addEventListener("click", function () { S.menu === name ? closeMenus(true) : openMenu(name); });
    });
    $("drawerClose").addEventListener("click", function () { closeMenus(true); });
    $("scrim").addEventListener("click", function () { closeMenus(true); });
    document.addEventListener("pointerdown", function (e) {
      if (!S.menu || S.menu === "drawer") return;
      var m = MENUS[S.menu];
      if (m.el.contains(e.target) || m.btn.contains(e.target)) return;
      closeMenus(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (S.menu) { closeMenus(true); e.preventDefault(); }
      else if (S.full) setFull(false);
    });
    var dt = $("drawerTheme");
    if (dt) dt.addEventListener("click", function () { applyTheme(isDarkNow() ? "light" : "dark"); });
    buildDrawerTools();
  }
  function openMenu(name) {
    closeMenus(false);
    var m = MENUS[name];
    S.menu = name;
    m.btn.setAttribute("aria-expanded", "true");
    if (m.kind === "drawer") {
      m.el.classList.add("open"); $("scrim").classList.add("open");
      document.documentElement.classList.add("no-scroll");
      setTimeout(function () { var s = $("toolSearch"); if (s && !coarse()) s.focus(); else $("drawerClose").focus(); }, 60);
    } else m.el.hidden = false;
  }
  function closeMenus(returnFocus) {
    if (!S.menu) return;
    var m = MENUS[S.menu];
    m.btn.setAttribute("aria-expanded", "false");
    if (m.kind === "drawer") {
      m.el.classList.remove("open"); $("scrim").classList.remove("open");
      if (!S.full) document.documentElement.classList.remove("no-scroll");
    } else m.el.hidden = true;
    if (returnFocus) m.btn.focus();
    S.menu = null;
  }

  var drawerGroups = [];
  function buildDrawerTools() {
    var host = $("drawerTools"), src = $("toolsPanel");
    if (!host || !src) return;
    qa(".tg", src).forEach(function (sec) {
      var clone = sec.cloneNode(true);
      var h = clone.querySelector(".tg-title"), list = clone.querySelector(".tg-list");
      var label = h.textContent, btn = document.createElement("button");
      btn.type = "button";
      btn.innerHTML = "<span></span><svg class='i'><use href='#i-chevron-down'/></svg>";
      btn.firstChild.textContent = label;
      h.textContent = ""; h.appendChild(btn);
      var hasCurrent = !!clone.querySelector('[aria-current="page"]') || (CFG.category && clone.getAttribute("data-cat") === CFG.category);
      var g = { sec: clone, list: list, btn: btn, defaultOpen: hasCurrent, items: qa("li", list) };
      g.setOpen = function (on) { list.hidden = !on; btn.setAttribute("aria-expanded", String(on)); };
      btn.addEventListener("click", function () { g.setOpen(list.hidden); });
      g.setOpen(hasCurrent);
      drawerGroups.push(g);
      host.appendChild(clone);
    });
    var input = $("toolSearch");
    input.addEventListener("input", function () {
      var q = input.value.trim().toLowerCase(), any = false;
      drawerGroups.forEach(function (g) {
        var vis = 0;
        g.items.forEach(function (li) {
          var show = !q || li.textContent.toLowerCase().indexOf(q) >= 0;
          li.hidden = !show; if (show) vis++;
        });
        g.sec.hidden = vis === 0;
        g.setOpen(q ? true : g.defaultOpen);
        if (vis) any = true;
      });
      $("drawerEmpty").hidden = any;
    });
  }

  function setAngle(deg, silent) {
    S.deg = !!deg;
    graph.setAngle(S.deg);
    var chip = $("angleChip"); if (chip) { chip.textContent = S.deg ? "DEG" : "RAD"; chip.setAttribute("aria-label", "Angle mode " + (S.deg ? "degrees" : "radians") + ". Tap to switch"); }
    $("angRad").setAttribute("aria-pressed", String(!S.deg));
    $("angDeg").setAttribute("aria-pressed", String(S.deg));
    if (S.kbTab === "trig") renderKeys("trig");
    if (!silent) touchURL();
  }
  function setExam(on, silent) {
    S.exam = !!on;
    graph.setExam(S.exam);
    $("examSwitch").setAttribute("aria-checked", String(S.exam));
    $("examPill").hidden = !S.exam;
    if (!silent) touchURL();
  }
  function bindSettings() {
    $("angleChip").addEventListener("click", function () { setAngle(!S.deg); });
    $("angRad").addEventListener("click", function () { setAngle(false); });
    $("angDeg").addEventListener("click", function () { setAngle(true); });
    $("examSwitch").addEventListener("click", function () { setExam(!S.exam); });
    $("thAuto").addEventListener("click", function () { applyTheme("auto"); });
    $("thLight").addEventListener("click", function () { applyTheme("light"); });
    $("thDark").addEventListener("click", function () { applyTheme("dark"); });
    $("themeBtn").addEventListener("click", function () { applyTheme(isDarkNow() ? "light" : "dark"); });
    $("shareBtn").addEventListener("click", share);
    function safeFileName() {
      return (S.graphTitle || "Untitled Graph").trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "graph";
    }
    function downloadGraph(type) {
      graph.toBlob(function (blob) {
        if (!blob) { toast("Could not export graph"); return; }
        var a = document.createElement("a"), ext = type === "image/jpeg" ? "jpg" : "png";
        a.href = URL.createObjectURL(blob); a.download = safeFileName() + "." + ext;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
        toast("Saved " + a.download);
      }, type, type === "image/jpeg" ? 0.94 : undefined);
      closeMenus(false);
    }
    $("pngBtn").addEventListener("click", function () { downloadGraph("image/png"); });
    $("jpgBtn").addEventListener("click", function () { downloadGraph("image/jpeg"); });
    $("pdfBtn").addEventListener("click", function () {
      graph.toBlob(function (blob) {
        if (!blob) { toast("Could not prepare PDF"); return; }
        var reader = new FileReader();
        reader.onload = function () {
          var w = window.open("", "_blank");
          if (!w) { toast("Allow pop-ups to print the PDF"); return; }
          var title = (S.graphTitle || "Untitled Graph").replace(/[&<>"']/g, function (c) { return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]; });
          w.document.write(`<!doctype html><html><head><title>${title}</title><style>body{font:16px Arial;margin:24px;color:#111}h1{font-size:20px}img{display:block;width:100%;max-height:85vh;object-fit:contain}@page{size:landscape;margin:12mm}</style></head><body><h1>${title}</h1><img src="${reader.result}"><script>window.onload=function(){setTimeout(function(){window.print()},250)};<\/script></body></html>`);
          w.document.close();
        };
        reader.readAsDataURL(blob);
      });
      closeMenus(false);
    });
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var onScheme = function () { if (S.theme === "auto") applyTheme("auto", true); };
    if (mq.addEventListener) mq.addEventListener("change", onScheme); else if (mq.addListener) mq.addListener(onScheme);
  }

  function newEq(text) {
    var used = {};
    S.eqs.forEach(function (e) { used[e.ci] = true; });
    var ci = 0; while (used[ci]) ci++;
    var eq = { ci: ci, num: 0, text: text || "", visible: true, fn: null, kind: "", op: "", params: [], error: null, sig: "", el: {} };
    S.eqs.push(eq);
    return eq;
  }

  function sliderRow(name) {
    var P = graph.getParams();
    var wrap = document.createElement("label"); wrap.className = "slider-row";
    var cap = document.createElement("span"); cap.className = "slider-cap";
    var rng = document.createElement("input"); rng.type = "range";
    var v = P[name] === undefined ? 1 : P[name], lim = Math.max(10, Math.ceil(Math.abs(v) * 1.5));
    rng.min = String(-lim); rng.max = String(lim); rng.step = "0.1"; rng.value = String(v);
    rng.setAttribute("aria-label", "Value of " + name);
    function show() { cap.textContent = name + " = " + Number(P[name]).toFixed(1); }
    show();
    rng.addEventListener("input", function () {
      graph.setParam(name, parseFloat(rng.value)); show(); touchURL();
    });
    wrap.appendChild(cap); wrap.appendChild(rng);
    return wrap;
  }

  function renderSliders() {
    var seen = {};
    S.eqs.forEach(function (eq) {
      var mine = eq.params.filter(function (n) { if (seen[n]) return false; seen[n] = true; return true; });
      var sig = mine.join(",");
      if (sig === eq.sig) return;
      eq.sig = sig;
      eq.el.sliders.textContent = "";
      mine.forEach(function (n) { eq.el.sliders.appendChild(sliderRow(n)); });
    });
  }

  function showErr(eq) {
    clearTimeout(eq._errT);
    eq.el.err.textContent = eq.error || "";
    eq.el.row.classList.toggle("has-error", !!eq.error);
    eq.el.input.setAttribute("aria-invalid", eq.error ? "true" : "false");
  }
  function fmtResult(v) {
    if (v !== v) return "undefined";
    if (v === Infinity) return "\u221e";
    if (v === -Infinity) return "\u2212\u221e";
    return E.fmt(v);
  }
  var INCOMPLETE = /unfinished|missing|closing/i;
  function refresh(eq, typing) {
    var r = E.compileExpr(eq.text);
    eq.calc = false; eq.result = "";
    if (r.fn) {
      eq.fn = r.fn; eq.params = r.params; eq.error = null;
      eq.kind = r.kind || ""; eq.op = r.op || "";
      var P = graph.getParams();
      r.params.forEach(function (n) { if (P[n] === undefined) graph.setParam(n, 1); });
      /* a plain number sum such as 7+5 is a calculation: show "= 12" instead of plotting a flat line */
      if (!r.kind && !r.usesX && !r.params.length && !/^\s*(?:y|f\s*\(\s*x\s*\))\s*=(?!=)/i.test(eq.text)) {
        var v; try { v = r.fn(0, {}); } catch (err) { v = NaN; }
        eq.calc = true; eq.result = "= " + fmtResult(typeof v === "number" ? v : NaN);
      }
    } else if (r.error) {
      eq.fn = null; eq.error = r.error;
    } else { eq.fn = null; eq.error = null; eq.params = []; eq.kind = ""; eq.op = ""; }
    eq.el.res.textContent = eq.result;
    eq.el.row.classList.toggle("is-calc", eq.calc);
    clearTimeout(eq._errT);
    if (typing && eq.error) {
      /* do not nag while the person is still typing (Desmos does the same) */
      eq.el.err.textContent = ""; eq.el.row.classList.remove("has-error"); eq.el.input.setAttribute("aria-invalid", "false");
      if (!INCOMPLETE.test(eq.error)) eq._errT = setTimeout(function () { showErr(eq); }, 900);
    } else showErr(eq);
    renderSliders();
  }

  function renumber() {
    S.eqs.forEach(function (eq, i) {
      eq.num = i + 1;
      eq.el.dot.firstChild.textContent = String(eq.num);
      eq.el.dot.setAttribute("aria-label", "Show or hide equation " + eq.num);
      eq.el.del.setAttribute("aria-label", "Delete equation " + eq.num);
      eq.el.input.setAttribute("aria-label", "Equation " + eq.num);
    });
  }

  function addRow(eq) {
    var row = document.createElement("div"); row.className = "eq";
    row.innerHTML =
      '<div class="eq-main">' +
      '<button type="button" class="eq-dot" aria-pressed="true"><span></span></button>' +
      '<input class="eq-input" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="next" placeholder="e.g. x^2 - 4  or  x^2+y^2=9">' +
      '<button type="button" class="eq-del"><svg class="i"><use href="#i-close"/></svg></button>' +
      '</div><div class="eq-res" aria-live="polite"></div><div class="eq-err" role="alert"></div><div class="eq-sliders"></div>';
    var el = eq.el;
    el.row = row; el.dot = row.querySelector(".eq-dot"); el.input = row.querySelector(".eq-input");
    el.del = row.querySelector(".eq-del"); el.res = row.querySelector(".eq-res"); el.err = row.querySelector(".eq-err"); el.sliders = row.querySelector(".eq-sliders");
    el.dot.style.setProperty("--c", "var(--eq" + (eq.ci % 8 + 1) + ")");
    el.dot.firstChild.textContent = "1";
    el.input.value = eq.text;
    el.input._sel = [eq.text.length, eq.text.length];
    $("equationList").appendChild(row);

    var input = el.input;
    function saveSel() { input._sel = [input.selectionStart, input.selectionEnd]; }
    ["keyup", "mouseup", "touchend", "select", "click", "blur"].forEach(function (ev) { input.addEventListener(ev, saveSel); });
    input.addEventListener("blur", function () { if (eq.error) showErr(eq); });
    input.addEventListener("focus", function () {
      S.active = eq; saveSel();
      S.eqs.forEach(function (q) { q.el.row.classList.toggle("is-active", q === eq); });
      applyInputMode();
      if (coarse() && !S.nativeKb && !S.kbOpen) setKb(true);
    });
    input.addEventListener("input", function () {
      eq.text = input.value; saveSel(); refresh(eq, true); graph.redraw(); touchURL(); labelPlot();
      if (S.snap === "peek") layoutPanel();
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); focusNext(eq); }
      else if (e.key === "Backspace" && input.value === "" && S.eqs.length > 1) { e.preventDefault(); removeEq(eq, true); }
    });
    el.dot.addEventListener("click", function () {
      eq.visible = !eq.visible; el.dot.setAttribute("aria-pressed", String(eq.visible)); graph.redraw();
    });
    el.del.addEventListener("click", function () { removeEq(eq, false); });

    refresh(eq);
    renumber();
    applyInputMode();
    return input;
  }

  function removeEq(eq, focusPrev) {
    var i = S.eqs.indexOf(eq);
    if (i < 0) return;
    S.eqs.splice(i, 1);
    eq.el.row.remove();
    if (S.active === eq) S.active = null;
    if (!S.eqs.length) addRow(newEq(""));
    renumber(); renderSliders(); graph.redraw(); touchURL(); labelPlot();
    if (focusPrev) { var t = S.eqs[Math.max(0, i - 1)]; t.el.input.focus(); var n = t.el.input.value.length; t.el.input.setSelectionRange(n, n); }
    layoutPanel();
  }

  function focusNext(eq) {
    var i = S.eqs.indexOf(eq), next = S.eqs[i + 1];
    if (next) { next.el.input.focus(); return; }
    if (eq.text.trim()) { addEquation(); return; }
    eq.el.input.blur();
    if (coarse()) setKb(false);
  }


  /* ---------------------------------------------------------------- add-item menu */
  function closeAddMenu() {
    var menu = $("addItemMenu");
    if (menu) menu.hidden = true;
    var btn = $("addEqBtn");
    if (btn) btn.setAttribute("aria-expanded", "false");
  }
  function addCustomItem(type) {
    var list = $("equationList");
    var card = document.createElement("div");
    card.className = "workspace-item workspace-" + type;
    card.dataset.itemType = type;
    var title = document.createElement("div");
    title.className = "workspace-item-title";
    var label = document.createElement("strong");
    label.textContent = ({note:"Note",table:"Table",inference:"Inference",folder:"Folder",image:"Image"}[type] || type);
    var remove = document.createElement("button");
    remove.type = "button"; remove.className = "workspace-remove";
    remove.textContent = "×"; remove.setAttribute("aria-label", "Remove " + type);
    remove.addEventListener("click", function(){ card.remove(); });
    title.appendChild(label); title.appendChild(remove); card.appendChild(title);

    if (type === "note") {
      var note = document.createElement("textarea");
      note.className = "workspace-note"; note.placeholder = "Type your note…";
      note.rows = 3; card.appendChild(note);
    } else if (type === "table") {
      var table = document.createElement("table"); table.className = "workspace-data-table";
      table.innerHTML = '<thead><tr><th>#</th><th>x₁</th><th>y₁</th></tr></thead><tbody><tr><td>1</td><td><input aria-label="x value 1" value="1"></td><td><input aria-label="y value 1" value="1"></td></tr><tr><td>2</td><td><input aria-label="x value 2" value="2"></td><td><input aria-label="y value 2" value="2"></td></tr></tbody>';
      var add = document.createElement("button"); add.type="button"; add.className="workspace-action"; add.textContent="+ Add row";
      add.addEventListener("click", function(){
        var n=table.tBodies[0].rows.length+1, tr=table.tBodies[0].insertRow();
        tr.insertCell().textContent=n;
        ["x value "+n,"y value "+n].forEach(function(a){var td=tr.insertCell(), input=document.createElement("input");input.setAttribute("aria-label",a);td.appendChild(input);});
      });
      card.appendChild(table); card.appendChild(add);
      var hint=document.createElement("small");hint.textContent="Enter paired x and y values in this table.";card.appendChild(hint);
    } else if (type === "inference") {
      var desc=document.createElement("p");desc.textContent="Statistical inference workspace";card.appendChild(desc);
      var select=document.createElement("select");select.setAttribute("aria-label","Inference method");
      ["Choose a method…","One-proportion z test","Two-proportion z test","One-sample t test","Two-sample t test","Chi-square test","Confidence interval"].forEach(function(v){var o=document.createElement("option");o.textContent=v;select.appendChild(o);});
      card.appendChild(select);
      var fields=document.createElement("textarea");fields.rows=2;fields.placeholder="Add hypotheses, sample data, or working notes…";card.appendChild(fields);
    } else if (type === "folder") {
      var name=document.createElement("input");name.className="workspace-folder-name";name.value="Untitled folder";name.setAttribute("aria-label","Folder name");
      var contents=document.createElement("div");contents.className="workspace-folder-content";contents.textContent="Drag or add expressions here (folder organization).";
      card.appendChild(name);card.appendChild(contents);
    } else if (type === "image") {
      var file=document.createElement("input");file.type="file";file.accept="image/*";file.setAttribute("aria-label","Choose an image");
      var preview=document.createElement("img");preview.className="workspace-image-preview";preview.alt="Uploaded image preview";preview.hidden=true;
      file.addEventListener("change",function(){
        var f=file.files && file.files[0]; if(!f)return;
        if(!/^image\//.test(f.type))return;
        var reader=new FileReader();reader.onload=function(){preview.src=reader.result;preview.hidden=false;};reader.readAsDataURL(f);
      });
      card.appendChild(file);card.appendChild(preview);
    }
    list.appendChild(card);
    card.scrollIntoView({block:"nearest"});
    if (type === "note") card.querySelector("textarea").focus();
  }
  function initAddItemMenu() {
    var btn=$("addEqBtn"); if(!btn || $("addItemMenu")) return;
    btn.setAttribute("aria-haspopup","menu");btn.setAttribute("aria-expanded","false");
    var menu=document.createElement("div");menu.id="addItemMenu";menu.className="add-item-menu";menu.setAttribute("role","menu");menu.hidden=true;
    var items=[["expression","ƒ(x)","Expression"],["note","❝","Note"],["table","▦","Table"],["inference","∩","Inference"],["folder","▰","Folder"],["image","▧","Image"]];
    items.forEach(function(item){
      var b=document.createElement("button");b.type="button";b.className="add-item-option";b.setAttribute("role","menuitem");
      var icon=document.createElement("span");icon.className="add-item-icon";icon.textContent=item[1];
      var text=document.createElement("span");text.textContent=item[2];b.appendChild(icon);b.appendChild(text);
      b.addEventListener("click",function(){closeAddMenu();if(item[0]==="expression")addEquation();else addCustomItem(item[0]);});
      menu.appendChild(b);
    });
    btn.parentNode.style.position="relative";btn.parentNode.appendChild(menu);
    btn.addEventListener("click",function(e){e.preventDefault();var open=menu.hidden;menu.hidden=!open;btn.setAttribute("aria-expanded",String(open));});
    document.addEventListener("click",function(e){if(!menu.contains(e.target)&&e.target!==btn&&!btn.contains(e.target))closeAddMenu();});
    document.addEventListener("keydown",function(e){if(e.key==="Escape")closeAddMenu();});
  }

  function addEquation() {
    var eq = newEq(""), input = addRow(eq);
    graph.redraw();
    if (S.snap === "peek" && isMobile()) S.snap = "half";
    layoutPanel();
    input.focus();
    eq.el.row.scrollIntoView({ block: "nearest" });
  }

  var labelTimer = 0;
  function labelPlot() {
    clearTimeout(labelTimer);
    labelTimer = setTimeout(function () {
      var txt = S.eqs.filter(function (e) { return e.fn && !e.calc; }).map(function (e) {
        return (e.kind === "polar" || e.kind === "parametric") ? e.text : e.kind ? e.text : "y = " + e.text.replace(/^\s*(y|f\(x\))\s*=\s*/i, "");
      }).join(", ");
      $("plotCanvas").setAttribute("aria-label", txt ? "Graph of " + txt + ". Arrow keys pan, plus and minus zoom." : "Empty graph. Type an equation to plot it.");
    }, 300);
  }

  /* ---------------------------------------------------------------- data & regression */
  var FIT = { pts: null, line: null };
  function setEqText(eq, text) {
    eq.text = text; eq.el.input.value = text; refresh(eq); 
  }
  function ensureEq(ref, text) {
    if (ref && S.eqs.indexOf(ref) >= 0) { setEqText(ref, text); return ref; }
    var blank = S.eqs.filter(function (e) { return !e.text.trim() && e !== FIT.pts && e !== FIT.line; })[0];
    if (blank) { setEqText(blank, text); return blank; }
    var eq = newEq(text); addRow(eq); return eq;
  }
  function fitStat(label, value) {
    var d = document.createElement("div"); d.className = "fit-stat";
    var a = document.createElement("span"); a.textContent = label;
    var b = document.createElement("b"); b.textContent = value;
    d.appendChild(a); d.appendChild(b); return d;
  }
  function runFit(quiet) {
    var box = $("fitOut"); if (!box) return;
    var data = E.parseData($("fitData").value), model = $("fitModel").value;
    box.textContent = "";
    if (!data.points.length) { if (!quiet) { var m0 = document.createElement("p"); m0.className = "fit-err"; m0.textContent = "Paste at least two x, y pairs, one per line."; box.appendChild(m0); } return; }
    var r = E.regress(data.points, model);
    var ptsText = data.points.map(function (p) { return "(" + p[0] + ", " + p[1] + ")"; }).join(", ");
    FIT.pts = ensureEq(FIT.pts, ptsText);
    if (r.error) {
      if (FIT.line && S.eqs.indexOf(FIT.line) >= 0) removeEq(FIT.line, false);
      FIT.line = null;
      var m1 = document.createElement("p"); m1.className = "fit-err"; m1.textContent = r.error; box.appendChild(m1);
    } else {
      FIT.line = ensureEq(FIT.line, "y = " + r.expr);
      var eqLine = document.createElement("p"); eqLine.className = "fit-eq"; eqLine.textContent = "y = " + r.expr; box.appendChild(eqLine);
      var grid = document.createElement("div"); grid.className = "fit-stats";
      Object.keys(r.coef).forEach(function (k) { grid.appendChild(fitStat(k, E.fmt(r.coef[k]))); });
      grid.appendChild(fitStat("R\u00b2", r.r2.toFixed(4)));
      if (r.r !== undefined) grid.appendChild(fitStat("r", r.r.toFixed(4)));
      grid.appendChild(fitStat("n", String(r.n)));
      box.appendChild(grid);
      var pr = document.createElement("div"); pr.className = "fit-predict";
      pr.innerHTML = '<label>Predict y at x = <input type="number" step="any" inputmode="decimal" aria-label="x value to predict"></label><output></output>';
      var pin = pr.querySelector("input"), pout = pr.querySelector("output");
      pin.addEventListener("input", function () { var x = parseFloat(pin.value); pout.textContent = isFinite(x) ? "y \u2248 " + E.fmt(r.f(x)) : ""; });
      box.appendChild(pr);
    }
    if (data.skipped) { var m2 = document.createElement("p"); m2.className = "fit-note"; m2.textContent = data.skipped + " line(s) skipped because they were not two numbers."; box.appendChild(m2); }
    renumber(); renderSliders(); graph.redraw(); touchURL(); labelPlot(); layoutPanel();
    if (!quiet) fitView(data.points);
  }
  function fitView(points) {
    if (!points.length || !graph.fitTo) return;
    var xs = points.map(function (p) { return p[0]; }), ys = points.map(function (p) { return p[1]; });
    graph.fitTo(Math.min.apply(null, xs), Math.max.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, ys));
  }
  function bindFit() {
    if (!$("fitBtn")) return;
    var sel = $("fitModel");
    Object.keys(E.MODELS).forEach(function (k) { var o = document.createElement("option"); o.value = k; o.textContent = E.MODELS[k].label; sel.appendChild(o); });
    $("fitBtn").addEventListener("click", function () { runFit(false); });
    sel.addEventListener("change", function () { if ($("fitData").value.trim()) runFit(false); });
    $("fitClear").addEventListener("click", function () {
      $("fitData").value = ""; $("fitOut").textContent = "";
      [FIT.line, FIT.pts].forEach(function (e) { if (e && S.eqs.indexOf(e) >= 0) removeEq(e, false); });
      FIT.pts = FIT.line = null;
    });
    var f = CFG.fit;
    if (f) {
      if (f.data) $("fitData").value = f.data;
      if (f.model && E.MODELS[f.model]) sel.value = f.model;
      $("fitBox").open = true;
    }
  }

  var lastPtsKey = "";
  function renderPoints(pts, exam) {
    var key = exam ? "exam" : pts.map(function (p) { return p.label + p.x.toFixed(5) + p.y.toFixed(5); }).join("|");
    if (key === lastPtsKey) return;
    lastPtsKey = key;
    var box = $("analysisOutput"); box.textContent = "";
    var count = $("ptsCount");
    if (exam) {
      var n1 = document.createElement("p"); n1.className = "analysis-note"; n1.textContent = "Hints are locked in US Exam Mode."; box.appendChild(n1);
      count.textContent = ""; return;
    }
    count.textContent = pts.length ? "(" + Math.min(pts.length, 24) + ")" : "";
    if (!pts.length) {
      var n2 = document.createElement("p"); n2.className = "analysis-note"; n2.textContent = "No key points in view. Zoom out or add an equation."; box.appendChild(n2); return;
    }
    pts.slice(0, 24).forEach(function (p) {
      var b = document.createElement("button"); b.type = "button"; b.className = "pt";
      var dot = document.createElement("i"); dot.style.setProperty("--c", p.ci >= 0 ? "var(--eq" + (p.ci % 8 + 1) + ")" : "var(--g-axis)");
      var tx = document.createElement("span"); tx.textContent = p.label + ": (" + E.fmt(p.x) + ", " + E.fmt(p.y) + ")";
      b.appendChild(dot); b.appendChild(tx);
      b.addEventListener("click", function () {
        if (isMobile() && S.snap === "full") { S.snap = "half"; layoutPanel(); }
        graph.focusPoint(p);
      });
      box.appendChild(b);
    });
  }

  function ic(id) { return '<svg class="i" aria-hidden="true"><use href="#i-' + id + '"/></svg>'; }
  function N(d) { return { l: d, i: d }; }
  var OP = function (l, i) { return { l: l, i: i, c: "act", aria: null }; };
  var BK = { l: ic("backspace"), a: "bksp", c: "act", rep: true, aria: "Backspace" };
  var LF = { l: ic("left"), a: "left", c: "act", rep: true, aria: "Move cursor left" };
  var RT = { l: ic("right"), a: "right", c: "act", rep: true, aria: "Move cursor right" };
  var GO = { l: ic("enter"), a: "enter", c: "go", aria: "Next equation" };
  function F(l, i, w, aria) { return { l: l, i: i, w: w, c: "fn", aria: aria }; }
  var IT = function (c) { return { l: '<span class="it">' + c + "</span>", i: c }; };

  var TABS = [
    { id: "123", label: "123", keys: [
      IT("x"), N("7"), N("8"), N("9"), OP("÷", "/"), BK,
      F("(", "("), N("4"), N("5"), N("6"), OP("×", "*"), LF,
      F(")", ")"), N("1"), N("2"), N("3"), OP("−", "-"), RT,
      F("x<sup>2</sup>", "^2", null, "x squared"), N("0"), N("."), F("=", "=", null, "equals"), OP("+", "+"), GO
    ] },
    { id: "fx", label: "f(x)", keys: [
      F("x<sup>2</sup>", "^2", null, "x squared"), F("x<sup>y</sup>", "^(|)", null, "power"), F("√", "sqrt(|)", "sqrt($)", "square root"),
      F("∛", "cbrt(|)", "cbrt($)", "cube root"), F("|x|", "abs(|)", "abs($)", "absolute value"), BK,
      F("<span style='font-size:.9em'>a⁄b</span>", "(|)/()", "($)/(|)", "fraction"), F("e<sup>x</sup>", "e^(|)", null, "e to the x"), F("10<sup>x</sup>", "10^(|)", null, "ten to the x"),
      F("ln", "ln(|)", "ln($)", "natural log"), F("log", "log(|)", "log($)", "log base 10"), LF,
      IT("y"), F("π", "pi", null, "pi"), F("=", "=", null, "equals"), F("(", "("), F(")", ")"), RT,
      F("&lt;", "<", null, "less than"), F("&gt;", ">", null, "greater than"), F("≤", "<=", null, "less or equal"), F("≥", ">=", null, "greater or equal"),
      F("?:", "? | : ", null, "if then else, for piecewise functions"), GO
    ] },
    { id: "trig", label: "trig", keys: [
      F("sin", "sin(|)", "sin($)"), F("cos", "cos(|)", "cos($)"), F("tan", "tan(|)", "tan($)"), F("π", "pi", null, "pi"), IT("x"), BK,
      F("csc", "csc(|)", "csc($)"), F("sec", "sec(|)", "sec($)"), F("cot", "cot(|)", "cot($)"), F("(", "("), F(")", ")"), LF,
      F("sin<sup>−1</sup>", "asin(|)", "asin($)", "inverse sine"), F("cos<sup>−1</sup>", "acos(|)", "acos($)", "inverse cosine"), F("tan<sup>−1</sup>", "atan(|)", "atan($)", "inverse tangent"),
      F("sinh", "sinh(|)", "sinh($)"), F("cosh", "cosh(|)", "cosh($)"), RT,
      F("π/2", "pi/2", null, "pi over two"), F("2π", "2pi", null, "two pi"), F("°", "°", null, "degrees"), F(",", ","),
      { l: "RAD", a: "angle", c: "act", aria: "Switch between radians and degrees", angle: true }, GO
    ] },
    { id: "abc", label: "abc", keys: [
      IT("a"), IT("b"), IT("c"), IT("d"), IT("m"), BK,
      IT("n"), IT("k"), IT("h"), IT("p"), IT("q"), LF,
      IT("r"), IT("s"), IT("t"), IT("u"), IT("v"), RT,
      IT("x"), IT("y"), F("(", "("), F(")", ")"), F(",", ","), GO
    ] }
  ];

  function buildKeyboard() {
    var tabs = $("kbdTabs");
    TABS.forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "kbd-tab"; b.setAttribute("role", "tab"); b.textContent = t.label; b.dataset.tab = t.id;
      b.addEventListener("click", function () { renderKeys(t.id); });
      tabs.appendChild(b);
    });
    renderKeys("123");

    var kbd = $("kbd");
    kbd.addEventListener("mousedown", function (e) { e.preventDefault(); });
    $("kbdHide").addEventListener("click", function () { setKb(false); });
    $("kbdNative").addEventListener("click", function () {
      S.nativeKb = true; setKb(false);
      var inp = S.active ? S.active.el.input : null;
      if (inp) { applyInputMode(); inp.focus(); }
    });
    $("kbToggle").addEventListener("click", function () {
      if (S.kbOpen) { setKb(false); return; }
      S.nativeKb = false; setKb(true);
      var eq = S.active || S.eqs[S.eqs.length - 1];
      if (eq && document.activeElement !== eq.el.input) eq.el.input.focus();
    });

    var grid = $("kbdGrid"), holdT = 0, holdI = 0;
    function stop() { clearTimeout(holdT); clearInterval(holdI); }
    grid.addEventListener("pointerdown", function (e) {
      var b = e.target.closest(".key"); if (!b || !b._key) return;
      b.classList.add("pressed");
      if (b._key.rep) {
        b._ptr = true; press(b._key);
        stop(); holdT = setTimeout(function () { holdI = setInterval(function () { press(b._key); }, 65); }, 380);
      }
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) {
      grid.addEventListener(ev, function (e) { stop(); var b = e.target.closest && e.target.closest(".key"); if (b) b.classList.remove("pressed"); });
    });
    grid.addEventListener("click", function (e) {
      var b = e.target.closest(".key"); if (!b || !b._key) return;
      if (b._key.rep && b._ptr) { b._ptr = false; return; }
      press(b._key);
    });
  }

  function renderKeys(id) {
    S.kbTab = id;
    var tab = TABS.filter(function (t) { return t.id === id; })[0];
    qa(".kbd-tab").forEach(function (b) { b.setAttribute("aria-selected", String(b.dataset.tab === id)); });
    var grid = $("kbdGrid"); grid.textContent = "";
    tab.keys.forEach(function (k) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "key" + (k.c ? " " + k.c : "") + (k.angle ? " angle" : "");
      b.innerHTML = '<span class="kl">' + (k.angle ? (S.deg ? "DEG" : "RAD") : k.l) + "</span>";
      if (k.aria) b.setAttribute("aria-label", k.aria);
      b._key = k;
      grid.appendChild(b);
    });
  }

  function currentInput() {
    if (S.active && document.body.contains(S.active.el.input)) return S.active.el.input;
    var eq = S.eqs[S.eqs.length - 1];
    S.active = eq;
    return eq.el.input;
  }

  function setValue(inp, value, caret) {
    inp.value = value;
    inp.focus({ preventScroll: true });
    inp.setSelectionRange(caret, caret);
    inp._sel = [caret, caret];
    inp.dispatchEvent(new Event("input", { bubbles: true }));
  }

  var FN_BEFORE = /(sin|cos|tan|sec|csc|cot|asin|acos|atan|sinh|cosh|tanh|sqrt|cbrt|abs|exp|ln|log10|log2|log|floor|ceil|round|sign|min|max|pow|mod)\($/i;

  function press(k) {
    var inp = currentInput(), sel = inp._sel || [inp.value.length, inp.value.length];
    var s = Math.min(sel[0], inp.value.length), e = Math.min(sel[1], inp.value.length), v = inp.value;
    if (k.a === "bksp") {
      if (s !== e) return setValue(inp, v.slice(0, s) + v.slice(e), s);
      if (s === 0) { if (v === "" && S.eqs.length > 1) removeEq(S.active, true); return; }
      var before = v.slice(0, s), after = v.slice(s), m = FN_BEFORE.exec(before);
      if (m) { var cut = before.length - m[0].length; return setValue(inp, v.slice(0, cut) + (after.charAt(0) === ")" ? after.slice(1) : after), cut); }
      if (before.slice(-1) === "(" && after.charAt(0) === ")") return setValue(inp, before.slice(0, -1) + after.slice(1), s - 1);
      return setValue(inp, before.slice(0, -1) + after, s - 1);
    }
    if (k.a === "left") { inp.focus({ preventScroll: true }); var l = s !== e ? s : Math.max(0, s - 1); inp.setSelectionRange(l, l); inp._sel = [l, l]; return; }
    if (k.a === "right") { inp.focus({ preventScroll: true }); var r = s !== e ? e : (v.slice(s, s + 3) === ")/(" ? s + 3 : Math.min(v.length, s + 1)); inp.setSelectionRange(r, r); inp._sel = [r, r]; return; }
    if (k.a === "enter") { focusNext(S.active || S.eqs[0]); return; }
    if (k.a === "angle") { setAngle(!S.deg); return; }

    var selected = v.slice(s, e), tpl = (selected && k.w) ? k.w : k.i;
    var parts = tpl.split("|");
    var pre = parts[0].replace("$", selected), post = (parts[1] || "").replace("$", selected);
    var text = pre + post, caret = s + pre.length;
    setValue(inp, v.slice(0, s) + text + v.slice(e), caret);
  }

  function applyInputMode() {
    var mode = (S.kbOpen && coarse()) ? "none" : "text";
    S.eqs.forEach(function (eq) { eq.el.input.setAttribute("inputmode", mode); });
  }

  function setKb(on) {
    if (S.kbOpen === on) return;
    S.kbOpen = on;
    $("kbd").hidden = !on;
    $("kbToggle").setAttribute("aria-pressed", String(on));
    applyInputMode();
    layoutPanel();
  }

  function peekHeight() {
    var head = $("panelHead"), grip = $("grip"), first = S.eqs[0] && S.eqs[0].el.row;
    var rowH = first ? Math.min(first.offsetHeight, 150) : 56;
    return grip.offsetHeight + head.offsetHeight + rowH + 6;
  }
  function kbHeight() { return (S.kbOpen && !$("kbd").hidden) ? $("kbd").offsetHeight : 0; }

  function updateInset() {
    if (!graph) return;
    if (!isMobile() || S.full) { graph.setInset(0); return; }
    var a = $("app").getBoundingClientRect(), p = $("panel").getBoundingClientRect();
    graph.setInset(Math.max(0, a.bottom - p.top));
  }
  var trackUntil = 0, tracking = false;
  function trackInset(ms) {
    trackUntil = performance.now() + ms;
    if (tracking) return;
    tracking = true;
    (function loop() {
      updateInset();
      if (performance.now() < trackUntil) requestAnimationFrame(loop); else tracking = false;
    })();
  }

  function layoutPanel() {
    var app = $("app");
    if (!isMobile()) {
      app.style.removeProperty("--panel-h"); app.style.removeProperty("--kb-h");
      updateInset(); return;
    }
    var H = app.clientHeight, kb = kbHeight();
    app.style.setProperty("--kb-h", kb + "px");
    var maxH = Math.max(110, H - kb - 76);
    var want = S.snap === "peek" ? peekHeight() : S.snap === "half" ? Math.round(H * 0.5) : H - 76;
    app.style.setProperty("--panel-h", Math.max(110, Math.min(want, maxH)) + "px");
    trackInset(320);
  }

  function bindSheet() {
    var panel = $("panel"), app = $("app"), st = null;
    function down(e) {
      if (!isMobile() || e.target.closest("button, input, a, label")) return;
      st = { id: e.pointerId, y0: e.clientY, h0: panel.offsetHeight, moved: false, lastY: e.clientY, lastT: performance.now(), v: 0, h: panel.offsetHeight };
      panel.classList.add("dragging");
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { }
    }
    function move(e) {
      if (!st || e.pointerId !== st.id) return;
      var dy = e.clientY - st.y0;
      if (Math.abs(dy) > 4) st.moved = true;
      var H = app.clientHeight, kb = kbHeight(), maxH = Math.max(110, H - kb - 76), minH = Math.max(110, peekHeight() - 20);
      st.h = Math.max(minH, Math.min(maxH, st.h0 - dy));
      app.style.setProperty("--panel-h", st.h + "px");
      var now = performance.now();
      st.v = (e.clientY - st.lastY) / Math.max(1, now - st.lastT); st.lastY = e.clientY; st.lastT = now;
      updateInset();
    }
    function up(e) {
      if (!st || e.pointerId !== st.id) return;
      panel.classList.remove("dragging");
      if (!st.moved) S.snap = S.snap === "peek" ? "half" : "peek";
      else {
        var H = app.clientHeight, kb = kbHeight(), maxH = Math.max(110, H - kb - 76);
        var target = st.h - st.v * 180;
        var opts = { peek: Math.min(peekHeight(), maxH), half: Math.min(Math.round(H * 0.5), maxH), full: Math.min(H - 76, maxH) };
        var best = "peek", bd = 1e9;
        Object.keys(opts).forEach(function (k) { var d = Math.abs(opts[k] - target); if (d < bd) { bd = d; best = k; } });
        S.snap = best;
      }
      st = null;
      layoutPanel();
    }
    [$("grip"), $("panelHead")].forEach(function (h) {
      h.addEventListener("pointerdown", down); h.addEventListener("pointermove", move);
      h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up);
    });
    $("sheetToggle").addEventListener("click", function () { S.snap = S.snap === "full" ? "half" : "full"; layoutPanel(); });
    panel.setAttribute("data-snap", S.snap);
    var orig = layoutPanel;
    layoutPanel = function () { panel.setAttribute("data-snap", S.snap); orig(); };
  }

  function setFull(on) {
    if (S.full === on) return;
    S.full = on;
    var app = $("app");
    app.classList.toggle("is-full", on);
    document.documentElement.classList.toggle("no-scroll", on || !!S.menu);
    var b = $("fullBtn");
    b.setAttribute("aria-pressed", String(on));
    b.setAttribute("aria-label", on ? "Exit full screen" : "Full screen graph");
    if (on) {
      closeMenus(false);
      var req = app.requestFullscreen || app.webkitRequestFullscreen;
      if (req) { try { var p = req.call(app); if (p && p.catch) p.catch(function () { }); } catch (err) { } }
    } else if (document.fullscreenElement || document.webkitFullscreenElement) {
      var ex = document.exitFullscreen || document.webkitExitFullscreen;
      if (ex) { try { var q = ex.call(document); if (q && q.catch) q.catch(function () { }); } catch (err2) { } }
    }
    graph.resize(); layoutPanel();
  }
  function bindGraphTools() {
    $("zoomInBtn").addEventListener("click", function () { graph.zoomIn(); });
    $("zoomOutBtn").addEventListener("click", function () { graph.zoomOut(); });
    $("homeBtn").addEventListener("click", function () { graph.home(); });
    $("fullBtn").addEventListener("click", function () { setFull(!S.full); });
    document.addEventListener("fullscreenchange", function () { if (!document.fullscreenElement && S.full) setFull(false); });
    document.addEventListener("webkitfullscreenchange", function () { if (!document.webkitFullscreenElement && S.full) setFull(false); });
    initAddItemMenu();
  }

  function onViewport() {
    var vv = window.visualViewport, root = document.documentElement;
    if (vv && vv.height < window.innerHeight - 120) root.style.setProperty("--vh", vv.height + "px"); else root.style.removeProperty("--vh");
    layoutPanel();
  }

  function init() {
    var titleInput = $("graphTitle"), initialTitle = readURL().title || store.get("eg-graph-title:" + location.pathname) || "Untitled Graph";
    S.graphTitle = initialTitle;
    if (titleInput) {
      titleInput.value = initialTitle;
      titleInput.addEventListener("input", function () {
        S.graphTitle = titleInput.value.slice(0, 80) || "Untitled Graph";
        store.set("eg-graph-title:" + location.pathname, S.graphTitle);
        document.title = S.graphTitle + " | ExamGrapher";
        touchURL();
      });
      titleInput.addEventListener("change", function () { titleInput.value = S.graphTitle; });
    }
    if (!E) return;
    if (!$("plotCanvas")) {
      initMenus();
      $("themeBtn").addEventListener("click", function () { applyTheme(isDarkNow() ? "light" : "dark"); });
      applyTheme(store.get("eg-theme") || "auto", true);
      return;
    }
    var url = readURL();
    S.exam = url.exam !== null ? url.exam : !!CFG.exam;
    var exprs = url.eq.length ? url.eq : (CFG.exprs || []);

    initMenus();
    buildKeyboard();
    graph = E.createGraph($("plotCanvas"), {
      exam: S.exam,
      onAnalysis: renderPoints,
      onInteract: function () { if (S.menu) closeMenus(false); }
    });
    if (!url.eq.length && CFG.params) Object.keys(CFG.params).forEach(function (k) { graph.setParam(k, CFG.params[k]); });
    Object.keys(url.params).forEach(function (k) { graph.setParam(k, url.params[k]); });
    bindSettings();
    bindSheet();
    bindGraphTools();
    applyTheme(store.get("eg-theme") || "auto", true);

    exprs.forEach(function (t) { addRow(newEq(t)); });
    if (!S.eqs.length) addRow(newEq(""));
    graph.setEquations(S.eqs);
    bindFit();
    if (CFG.fit && CFG.fit.data && !url.eq.length) { runFit(true); setTimeout(function () { fitView(E.parseData(CFG.fit.data).points); }, 60); }
    setAngle(url.deg === true, true);
    setExam(S.exam, true);
    labelPlot();

    layoutPanel();
    window.addEventListener("resize", onViewport);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", onViewport);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutPanel);
    window.EGApp = { share: share, shareURL: shareURL, state: S, fit: runFit };
    if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol) && !/^(localhost|127\.)/.test(location.hostname)) {
      window.addEventListener("load", function () { navigator.serviceWorker.register(SW_URL).catch(function () { }); });
    }
  }

  /* tag email sign-ups with the page they came from (helps see which tools convert) */
  document.addEventListener("DOMContentLoaded", function () {
    qa('form[name="cheatsheet"] input[name="source"]').forEach(function (i) { i.value = location.pathname; });
  });
  var SW_URL = (function () { var sc = document.querySelector('script[src*="assets/js/app.js"]'); return sc ? sc.getAttribute("src").replace(/assets\/js\/app\.js.*$/, "sw.js") : "/sw.js"; })();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

  // Multilingual UI: Google Translate provides on-page translations for the selected language.
  function initLanguagePicker() {
    var header = document.querySelector(".app-header");
    if (!header || $("egLanguage")) return;
    var wrap = document.createElement("div");
    wrap.className = "eg-language-wrap";
    var select = document.createElement("select");
    select.id = "egLanguage";
    select.className = "eg-language";
    select.setAttribute("aria-label", "Select website language");
    select.title = "Select website language";
    select.innerHTML = '<option value="">Language</option><option value="en">English (US)</option><option value="es">Español (LATAM)</option><option value="et">Eesti</option><option value="ru">Русский</option><option value="da">Dansk</option><option value="de">Deutsch</option><option value="pt">Português (Brasil)</option><option value="pt">Português (Portugal)</option><option value="ca">Català</option><option value="fr">Français</option><option value="fr">Français (Canada)</option><option value="it">Italiano</option><option value="is">Íslenska</option><option value="nl">Nederlands</option><option value="no">Norsk</option><option value="sv">Svenska</option><option value="hu">Magyar</option><option value="cs">Čeština</option><option value="pl">Polski</option><option value="id">Bahasa Indonesia</option><option value="vi">Tiếng Việt</option><option value="el">Ελληνικά</option><option value="uk">Українська</option><option value="ka">ქართული</option><option value="th">ภาษาไทย</option><option value="tr">Türkçe</option><option value="zh-CN">简体中文</option><option value="zh-TW">繁體中文</option><option value="ko">한국어</option><option value="ja">日本語</option></select>';
    wrap.appendChild(select);
    var settings = $("settingsBtn");
    if (settings && settings.parentNode === header) header.insertBefore(wrap, settings);
    else header.appendChild(wrap);
    var hidden = document.createElement("div");
    hidden.id = "google_translate_element";
    hidden.style.display = "none";
    document.body.appendChild(hidden);
    select.addEventListener("change", function () {
      var target = document.querySelector(".goog-te-combo");
      if (!target) {
        window.__egPendingLanguage = select.value;
        return;
      }
      target.value = select.value;
      target.dispatchEvent(new Event("change", { bubbles: true }));
    });
    if (window.__egPendingLanguage) {
      var pending = window.__egPendingLanguage;
      var timer = setInterval(function () {
        var target = document.querySelector(".goog-te-combo");
        if (target) {
          clearInterval(timer);
          target.value = pending;
          target.dispatchEvent(new Event("change", { bubbles: true }));
          window.__egPendingLanguage = "";
        }
      }, 300);
      setTimeout(function(){ clearInterval(timer); }, 12000);
    }
  }
  window.googleTranslateElementInit = function () {
    if (window.google && google.translate && google.translate.TranslateElement) {
      new google.translate.TranslateElement({
        pageLanguage: "en",
        includedLanguages: "es,et,ru,da,de,pt,ca,fr,it,is,nl,no,sv,hu,cs,pl,id,vi,el,uk,ka,th,tr,zh-CN,zh-TW,ko,ja",
        autoDisplay: false
      }, "google_translate_element");
    }
  };
  function loadGoogleTranslate() {
    if (document.querySelector('script[data-eg-translate]')) return;
    var script = document.createElement("script");
    script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    script.async = true;
    script.setAttribute("data-eg-translate", "true");
    document.head.appendChild(script);
  }
  initLanguagePicker();
  loadGoogleTranslate();

})();
