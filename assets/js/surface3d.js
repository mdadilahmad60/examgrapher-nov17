/* ExamGrapher 3D plotter. Explicit surfaces z = f(x, y) (EGEngine.compileSurface, grid mesh) and implicit surfaces
   F(x, y, z) = 0 (EGEngine.compileImplicit3 + EGMarch.tetra, marching tetrahedra). Includes a colour legend.
   Software renderer on a 2D canvas (painter's algorithm), no WebGL needed. */
(function () {
  "use strict";
  var host = document.getElementById("surface3d");
  if (!host) return;

  var PRESETS = [
    ["Paraboloid", "x^2 + y^2"], ["Saddle", "x^2 - y^2"], ["Ripple", "sin(sqrt(x^2 + y^2))"],
    ["Egg carton", "sin(x)*cos(y)"], ["Gaussian", "exp(-(x^2 + y^2)/4)"], ["Cone", "sqrt(x^2 + y^2)"],
    ["Monkey saddle", "x^3 - 3*x*y^2"], ["Sliders", "a*sin(x)*cos(b*y)"],
    ["Sphere", "x^2 + y^2 + z^2 = 9", 4], ["Torus", "(sqrt(x^2 + y^2) - 3)^2 + z^2 = 1", 5],
    ["Hyperboloid", "x^2 + y^2 - z^2 = 1", 4], ["Gyroid", "sin(x)*cos(y) + sin(y)*cos(z) + sin(z)*cos(x) = 0", 6.3]
  ];
  var STOPS = [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]];   // viridis-like
  var D = { f: "sin(sqrt(x^2 + y^2))", xmin: "-6", xmax: "6", ymin: "-6", ymax: "6", zmin: "", zmax: "" };

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function fmt(v) {
    if (!isFinite(v)) return "n/a";
    var a = Math.abs(v);
    if (a !== 0 && (a >= 1e5 || a < 1e-3)) return v.toExponential(2);
    return String(Math.round(v * 1000) / 1000);
  }
  function field(id, label, value) {
    return '<div class="sf"><label for="' + id + '">' + label + '</label><input id="' + id + '" type="text" inputmode="decimal" autocomplete="off" value="' + esc(value) + '"></div>';
  }

  host.innerHTML =
    '<div class="s3d-formula"><label for="s3dF">f</label><input id="s3dF" type="text" autocomplete="off" spellcheck="false" value="' + esc(D.f) + '" aria-label="Formula: z = f(x, y), or an implicit equation in x, y and z"></div>' +
    '<p id="s3dErr" class="s-err" role="alert" hidden></p>' +
    '<div class="s3d-presets" role="group" aria-label="Example surfaces">' + PRESETS.map(function (p, i) { return '<button type="button" class="chip" data-p="' + i + '">' + esc(p[0]) + "</button>"; }).join("") + "</div>" +
    '<div id="s3dSliders" class="s3d-sliders"></div>' +
    '<div class="s3d-canvas-wrap"><canvas id="s3dCanvas" tabindex="0" role="img" aria-label="3D surface plot. Drag to rotate, scroll or pinch to zoom, arrow keys also rotate."></canvas></div>' +
    '<p id="s3dInfo" class="s-cap"></p>' +
    '<div class="s3d-tools">' +
    '<button type="button" class="chip" id="s3dReset">Reset view</button><button type="button" class="chip" id="s3dTop">Top view</button>' +
    '<button type="button" class="chip" id="s3dSpin" aria-pressed="false">Auto-rotate</button><button type="button" class="chip" id="s3dSave">Save PNG</button></div>' +
    '<details class="s3d-opts" open><summary>Ranges and display</summary><div class="stat-form">' +
    field("s3dXmin", "x min", D.xmin) + field("s3dXmax", "x max", D.xmax) + field("s3dYmin", "y min", D.ymin) + field("s3dYmax", "y max", D.ymax) +
    field("s3dZmin", "z min (optional; default -6 for implicit)", D.zmin) + field("s3dZmax", "z max (optional; default 6 for implicit)", D.zmax) +
    '<div class="sf"><label for="s3dRes">Detail</label><select id="s3dRes"><option value="30">Fast</option><option value="50" selected>Standard</option><option value="80">Fine</option></select></div>' +
    '<div class="sf"><label for="s3dColor">Colour</label><select id="s3dColor"><option value="height" selected>By height</option><option value="solid">Single colour</option></select></div>' +
    '<div class="sf wide"><label class="chk"><input type="checkbox" id="s3dMesh" checked> Show mesh lines</label><label class="chk"><input type="checkbox" id="s3dBox" checked> Show axes box</label><label class="chk"><input type="checkbox" id="s3dLegend" checked> Show colour legend</label></div>' +
    "</div></details>";

  var canvas = $("s3dCanvas"), ctx = canvas.getContext("2d");
  var S = { yaw: 0.65, pitch: 0.5, zoom: 1, spin: false, W: 0, H: 0, dpr: 1, cx: 0, data: null, mesh: null, params: {}, compiled: null, mode: "explicit", dragging: false };
  var DEF_VIEW = { yaw: 0.65, pitch: 0.5, zoom: 1 };
  var colors = { text: "#1b2430", muted: "#6b7684", line: "#d5dbe3", bg: "#ffffff" };

  function readColors() {
    var cs = getComputedStyle(host);
    function g(n, d) { var v = cs.getPropertyValue(n).trim(); return v || d; }
    colors = { text: g("--text", "#1b2430"), muted: g("--muted", "#6b7684"), line: g("--border", "#d5dbe3"), bg: g("--surface", "#ffffff") };
  }

  /* ---------- sampling ---------- */
  function num(id) { var s = $(id).value.trim(); return s === "" ? NaN : Number(s); }
  function showErr(msg) { var e = $("s3dErr"); e.hidden = !msg; e.textContent = msg || ""; }

  function rebuildSliders(names) {
    var box = $("s3dSliders");
    names.forEach(function (n) { if (S.params[n] === undefined) S.params[n] = 1; });
    Object.keys(S.params).forEach(function (k) { if (names.indexOf(k) < 0) delete S.params[k]; });
    box.innerHTML = names.map(function (n) {
      return '<div class="s3d-slider"><label for="s3dP_' + n + '">' + n + ' = <output id="s3dO_' + n + '">' + fmt(S.params[n]) + '</output></label>' +
        '<input id="s3dP_' + n + '" type="range" min="-5" max="5" step="0.1" value="' + S.params[n] + '" data-n="' + n + '"></div>';
    }).join("");
  }

  var lastNames = "";
  function compile() {
    var raw = $("s3dF").value, c = EGEngine.compileSurface(raw), mode = "explicit";
    if (c.error && EGEngine.compileImplicit3) {
      var ci = EGEngine.compileImplicit3(raw);
      if (ci.fn) { c = ci; mode = "implicit"; }
      else if (/=|(^|[^a-z])z([^a-z]|$)/i.test(raw)) c = ci;   // the person was writing an equation or used z: show that message
    }
    if (c.empty) { showErr("Type a formula in x and y, for example sin(x)*cos(y), or an equation such as x^2 + y^2 + z^2 = 9."); S.data = null; S.mesh = null; S.compiled = null; draw(); return false; }
    if (c.error) { showErr(c.error); return false; }
    showErr("");
    S.compiled = c; S.mode = mode;
    var key = c.params.join(",");
    if (key !== lastNames) { rebuildSliders(c.params); lastNames = key; }
    return true;
  }

  function sample() {
    if (!S.compiled) return;
    if (S.mode === "implicit") return sampleImplicit();
    var x0 = num("s3dXmin"), x1 = num("s3dXmax"), y0 = num("s3dYmin"), y1 = num("s3dYmax");
    if (![x0, x1, y0, y1].every(isFinite) || x1 <= x0 || y1 <= y0) { showErr("Each maximum must be greater than its minimum."); return; }
    if (!$("s3dF").value.trim()) return;
    var zlo = num("s3dZmin"), zhi = num("s3dZmax"), hasLo = isFinite(zlo), hasHi = isFinite(zhi);
    if (hasLo && hasHi && zhi <= zlo) { showErr("z max must be greater than z min."); return; }
    showErr("");
    var N = Number($("s3dRes").value), n1 = N + 1, f = S.compiled.fn, P = S.params, z = new Float64Array(n1 * n1), i, j, mn = Infinity, mx = -Infinity, bad = 0;
    for (j = 0; j < n1; j++) {
      var y = y0 + (y1 - y0) * j / N;
      for (i = 0; i < n1; i++) {
        var x = x0 + (x1 - x0) * i / N, v = f(x, y, P);
        if (!isFinite(v) || Math.abs(v) > 1e9 || (hasLo && v < zlo) || (hasHi && v > zhi)) { z[j * n1 + i] = NaN; bad++; continue; }
        z[j * n1 + i] = v; if (v < mn) mn = v; if (v > mx) mx = v;
      }
    }
    if (mn === Infinity) { S.data = null; showErr("No real values to plot in this range. Check the formula or widen the z limits."); draw(); return; }
    var lo = hasLo ? zlo : mn, hi = hasHi ? zhi : mx, span = hi - lo;
    if (!(span > 1e-12)) { lo -= 1; hi += 1; span = 2; }
    S.data = { N: N, n1: n1, z: z, x0: x0, x1: x1, y0: y0, y1: y1, lo: lo, hi: hi, mn: mn, mx: mx, cLo: lo, cHi: hi, bad: bad };
    buildMesh(); S.meshLow = null;
    $("s3dInfo").textContent = "Height range in view: " + fmt(mn) + " to " + fmt(mx) + (bad ? ". " + Math.round(100 * bad / (n1 * n1)) + "% of points are undefined or outside the z limits and are left blank." : ".");
    draw();
  }

  /* ---------- implicit surfaces: sample F on a grid, extract F = 0 with marching tetrahedra ---------- */
  var IMPL_N = { "30": 24, "50": 36, "80": 48 };
  function sampleImplicit() {
    var x0 = num("s3dXmin"), x1 = num("s3dXmax"), y0 = num("s3dYmin"), y1 = num("s3dYmax"), z0 = num("s3dZmin"), z1 = num("s3dZmax");
    if (!isFinite(z0)) z0 = -6; if (!isFinite(z1)) z1 = 6;
    if (![x0, x1, y0, y1].every(isFinite) || x1 <= x0 || y1 <= y0 || z1 <= z0) { showErr("Each maximum must be greater than its minimum."); return; }
    if (!window.EGMarch) { showErr("The 3D engine did not load. Please reload the page."); return; }
    showErr("");
    var N = IMPL_N[$("s3dRes").value] || 36, f = S.compiled.fn, P = S.params;
    function sampleField(N) {
      var n1 = N + 1, F = new Float64Array(n1 * n1 * n1), i, j, k, o = 0;
      for (k = 0; k < n1; k++) {
        var z = z0 + (z1 - z0) * k / N;
        for (j = 0; j < n1; j++) {
          var y = y0 + (y1 - y0) * j / N;
          for (i = 0; i < n1; i++, o++) {
            var v = f(x0 + (x1 - x0) * i / N, y, z, P);
            F[o] = (isFinite(v) && Math.abs(v) < 1e9) ? v : NaN;
          }
        }
      }
      return EGMarch.tetra(F, n1, n1, n1, x0, x1, y0, y1, z0, z1, 0);
    }
    var r = sampleField(N);
    if (!r.count) {
      S.data = null; S.mesh = null; S.meshLow = null;
      showErr("No surface crosses this box. Widen the x, y and z ranges, or check the equation.");
      $("s3dInfo").textContent = ""; draw(); return;
    }
    var cLo = Infinity, cHi = -Infinity, q;
    for (q = 2; q < r.pos.length; q += 3) { var pz = r.pos[q]; if (pz < cLo) cLo = pz; if (pz > cHi) cHi = pz; }
    if (!(cHi - cLo > 1e-9)) { cLo -= 1; cHi += 1; }
    S.data = { mode: "implicit", x0: x0, x1: x1, y0: y0, y1: y1, lo: z0, hi: z1, mn: cLo, mx: cHi, cLo: cLo, cHi: cHi, tris: r.count };
    S.mesh = buildMeshImplicit(r);
    // a busy surface (tens of thousands of triangles) is redrawn from a coarser copy while the person drags, then in full on release
    S.meshLow = null;
    if (r.count > 12000) { var rl = sampleField(Math.max(12, Math.round(N / 2.2))); if (rl.count) S.meshLow = buildMeshImplicit(rl); }
    $("s3dInfo").textContent = "Implicit surface drawn with marching tetrahedra (" + r.count + " triangles). Colour shows height z from " + fmt(cLo) + " to " + fmt(cHi) + "." +
      (r.truncated ? " The surface is very detailed, so part of it was left out. Use Fast detail or a smaller range." : "");
    draw();
  }

  /* ---------- mesh: normalised coordinates, per-face colour ---------- */
  var zf = 0.72;   // half-height of the plot box relative to x and y (which span -1..1); 1 for implicit surfaces so the box is a cube
  var LIGHT = (function () { var l = [-0.45, -0.55, 0.7], m = Math.sqrt(l[0] * l[0] + l[1] * l[1] + l[2] * l[2]); return [l[0] / m, l[1] / m, l[2] / m]; })();
  function ramp(t) {
    t = Math.max(0, Math.min(1, t)) * (STOPS.length - 1);
    var i = Math.min(STOPS.length - 2, Math.floor(t)), f = t - i, a = STOPS[i], b = STOPS[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }
  function buildMesh() {
    zf = 0.72;
    var d = S.data, N = d.N, n1 = d.n1, i, j;
    var X = new Float32Array(n1 * n1), Y = new Float32Array(n1 * n1), Z = new Float32Array(n1 * n1);
    var span = d.hi - d.lo, solid = $("s3dColor").value === "solid";
    for (j = 0; j < n1; j++) for (i = 0; i < n1; i++) {
      var k = j * n1 + i, v = d.z[k];
      X[k] = -1 + 2 * i / N; Y[k] = -1 + 2 * j / N;
      Z[k] = isNaN(v) ? NaN : ((Math.max(d.lo, Math.min(d.hi, v)) - d.lo) / span * 2 - 1) * zf;
    }
    var faces = [], fi = 0;
    for (j = 0; j < N; j++) for (i = 0; i < N; i++) {
      var a = j * n1 + i, b = a + 1, c = a + n1 + 1, e = a + n1;
      if (isNaN(Z[a]) || isNaN(Z[b]) || isNaN(Z[c]) || isNaN(Z[e])) continue;
      // normal from the two diagonals
      var ux = X[c] - X[a], uy = Y[c] - Y[a], uz = Z[c] - Z[a], vx = X[e] - X[b], vy = Y[e] - Y[b], vz = Z[e] - Z[b];
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, m = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      var shade = 0.5 + 0.5 * Math.abs((nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / m);
      var tH = ((Z[a] + Z[b] + Z[c] + Z[e]) / 4 / zf + 1) / 2, base = solid ? [37, 99, 235] : ramp(tH);
      var r = Math.round(base[0] * shade), g = Math.round(base[1] * shade), bl = Math.round(base[2] * shade);
      faces.push({ a: a, b: b, c: c, e: e, col: "rgb(" + r + "," + g + "," + bl + ")", depth: 0 });
      fi++;
    }
    S.mesh = { nv: n1 * n1, X: X, Y: Y, Z: Z, faces: faces, sx: new Float32Array(n1 * n1), sy: new Float32Array(n1 * n1), sd: new Float32Array(n1 * n1) };
  }

  function buildMeshImplicit(r) {
    zf = 1;
    var d = S.data, T = r.count, nv = 3 * T, p = r.pos, X = new Float32Array(nv), Y = new Float32Array(nv), Z = new Float32Array(nv), faces = new Array(T), t, v;
    var sx = 2 / (d.x1 - d.x0), sy = 2 / (d.y1 - d.y0), sz = 2 / (d.hi - d.lo), solid = $("s3dColor").value === "solid";
    for (v = 0; v < nv; v++) {
      X[v] = -1 + (p[3 * v] - d.x0) * sx; Y[v] = -1 + (p[3 * v + 1] - d.y0) * sy; Z[v] = (-1 + (p[3 * v + 2] - d.lo) * sz) * zf;
    }
    for (t = 0; t < T; t++) {
      var a = 3 * t, b = a + 1, c = a + 2;
      var ux = X[b] - X[a], uy = Y[b] - Y[a], uz = Z[b] - Z[a], vx = X[c] - X[a], vy = Y[c] - Y[a], vz = Z[c] - Z[a];
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, m = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      var shade = 0.5 + 0.5 * Math.abs((nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / m);
      var zw = d.lo + (((Z[a] + Z[b] + Z[c]) / 3 / zf + 1) / 2) * (d.hi - d.lo), tH = (zw - d.cLo) / (d.cHi - d.cLo), base = solid ? [37, 99, 235] : ramp(tH);
      faces[t] = { a: a, b: b, c: c, e: -1, col: "rgb(" + Math.round(base[0] * shade) + "," + Math.round(base[1] * shade) + "," + Math.round(base[2] * shade) + ")", depth: 0 };
    }
    return { nv: nv, X: X, Y: Y, Z: Z, faces: faces, sx: new Float32Array(nv), sy: new Float32Array(nv), sd: new Float32Array(nv) };
  }

  /* ---------- projection and drawing ---------- */
  var PC = { cy: 1, sy: 0, cp: 1, sp: 0, k: 0, sc: 1 };
  function prep() {   // trig and scale once per frame, not once per vertex
    PC.cy = Math.cos(S.yaw); PC.sy = Math.sin(S.yaw); PC.cp = Math.cos(S.pitch); PC.sp = Math.sin(S.pitch);
    // looking straight down, perspective would make tall parts look bigger and bend the grid: fade to a flat (orthographic) view near the top
    PC.k = Math.max(0, Math.min(1, (S.pitch - 1.1) / (Math.PI / 2 - 1.1)));
    PC.sc = Math.min(S.W, S.H) * 0.27 * S.zoom * (1 + 0.3 * PC.k);   // and use more of the canvas, since a top view needs no room for height
  }
  function project(x, y, z, out) {   // z is up; yaw spins about z; pitch tilts the camera (0 = side, PI/2 = top)
    var x1 = x * PC.cy - y * PC.sy, y1 = x * PC.sy + y * PC.cy;
    var up = z * PC.cp + y1 * PC.sp, depth = y1 * PC.cp - z * PC.sp;
    var persp = 12 / (12 + depth * (1 - PC.k));
    out[0] = S.cx + x1 * PC.sc * persp; out[1] = S.H / 2 - up * PC.sc * persp; out[2] = depth;
  }

  /* ---------- colour legend ---------- */
  var LEG_FONT = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  function legendInfo() {
    var d = S.data;
    if (!d || !$("s3dLegend").checked || $("s3dColor").value === "solid") return null;
    var ticks = [], labels = [], n = 4, i, w = 0;
    ctx.font = LEG_FONT;
    var span = d.cHi - d.cLo;
    for (i = 0; i <= n; i++) {
      var tv = d.cLo + span * i / n; if (Math.abs(tv) < span * 1e-3) tv = 0;   // hide rounding noise such as -7.95e-5
      ticks.push(tv); labels.push(fmt(tv)); w = Math.max(w, ctx.measureText(labels[i]).width);
    }
    var total = 8 + 12 + 6 + w + 8;
    if (total > S.W * 0.4) return null;   // too narrow: skip rather than cover the plot
    return { ticks: ticks, labels: labels, w: total, tw: w };
  }
  function drawLegend(L) {
    var barW = 12, barH = Math.max(80, Math.min(S.H * 0.6, 240)), x = S.W - L.w + 8, y0 = (S.H - barH) / 2 + 8, i;
    var g = ctx.createLinearGradient(0, y0 + barH, 0, y0);
    for (i = 0; i < STOPS.length; i++) g.addColorStop(i / (STOPS.length - 1), "rgb(" + STOPS[i][0] + "," + STOPS[i][1] + "," + STOPS[i][2] + ")");
    ctx.fillStyle = g; ctx.fillRect(x, y0, barW, barH);
    ctx.strokeStyle = colors.muted; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y0 + 0.5, barW - 1, barH - 1);
    ctx.font = LEG_FONT; ctx.fillStyle = colors.text; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    for (i = 0; i < L.ticks.length; i++) {
      var ty = y0 + barH - barH * i / (L.ticks.length - 1);
      ctx.beginPath(); ctx.moveTo(x + barW, ty); ctx.lineTo(x + barW + 3, ty); ctx.stroke();
      ctx.fillText(L.labels[i], x + barW + 6, ty);
    }
    ctx.textAlign = "left"; ctx.font = "bold " + LEG_FONT; ctx.fillText("z", x, y0 - 10);
  }

  function draw() {
    if (!S.W) return;
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    ctx.fillStyle = colors.bg; ctx.fillRect(0, 0, S.W, S.H);
    var leg = legendInfo();
    S.cx = (S.W - (leg ? leg.w : 0)) / 2;
    prep();
    var showBox = $("s3dBox").checked, tmp = [0, 0, 0], d = S.data;
    if (showBox) drawBox(true);
    if (d && S.mesh) {
      var M = (S.busy && S.meshLow) ? S.meshLow : S.mesh, k, F = M.faces, nF = F.length, i;
      for (k = 0; k < M.nv; k++) { if (isNaN(M.Z[k])) continue; project(M.X[k], M.Y[k], M.Z[k], tmp); M.sx[k] = tmp[0]; M.sy[k] = tmp[1]; M.sd[k] = tmp[2]; }
      // painter's order, farthest first: counting sort on depth (O(n)), much faster than Array.sort for tens of thousands of triangles
      if (!M.dep || M.dep.length !== nF) { M.dep = new Float32Array(nF); M.ord = new Int32Array(nF); }
      var dep = M.dep, ord = M.ord, lo = Infinity, hi = -Infinity;
      for (i = 0; i < nF; i++) {
        var f = F[i]; dep[i] = M.sd[f.a] + M.sd[f.b] + M.sd[f.c] + (f.e < 0 ? M.sd[f.c] : M.sd[f.e]);
        if (dep[i] < lo) lo = dep[i]; if (dep[i] > hi) hi = dep[i];
      }
      var B = Math.max(2, Math.min(8192, nF)), cnt = new Int32Array(B + 1), scale = hi > lo ? (B - 1) / (hi - lo) : 0, bk;
      for (i = 0; i < nF; i++) { bk = ((hi - dep[i]) * scale) | 0; cnt[bk + 1]++; }
      for (i = 0; i < B; i++) cnt[i + 1] += cnt[i];
      for (i = 0; i < nF; i++) { bk = ((hi - dep[i]) * scale) | 0; ord[cnt[bk]++] = i; }
      var mesh = $("s3dMesh").checked, tris = nF > 0 && F[0].e < 0, heavy = S.busy && nF > 6000;   // while dragging a very large mesh, skip outlines
      ctx.lineJoin = "round"; ctx.lineWidth = mesh ? (tris ? 0.4 : 0.6) : 0.8;
      for (i = 0; i < nF; i++) {
        var q = F[ord[i]];
        ctx.beginPath(); ctx.moveTo(M.sx[q.a], M.sy[q.a]); ctx.lineTo(M.sx[q.b], M.sy[q.b]); ctx.lineTo(M.sx[q.c], M.sy[q.c]);
        if (q.e >= 0) ctx.lineTo(M.sx[q.e], M.sy[q.e]);
        ctx.closePath();
        ctx.fillStyle = q.col; ctx.fill();
        if (!heavy) { ctx.strokeStyle = mesh ? "rgba(0,0,0,.22)" : q.col; ctx.stroke(); }
      }
    }
    if (showBox) drawBox(false);
    if (leg) drawLegend(leg);
  }

  /* axes box: back edges and floor grid first, front edges and labels after the surface */
  function drawBox(back) {
    var d = S.data, p = [0, 0, 0], q = [0, 0, 0], c, i;
    var cs = [];
    for (c = 0; c < 8; c++) cs.push([c & 1 ? 1 : -1, c & 2 ? 1 : -1, c & 4 ? zf : -zf]);
    var edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    var pr = cs.map(function (v) { var o = [0, 0, 0]; project(v[0], v[1], v[2], o); return o; });
    var maxD = Math.max.apply(null, pr.map(function (o) { return o[2]; })), minD = Math.min.apply(null, pr.map(function (o) { return o[2]; }));
    ctx.lineWidth = 1; ctx.font = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    if (back) {
      ctx.strokeStyle = colors.line;
      for (i = 1; i < 8; i++) {   // floor grid
        var t = -1 + i * 0.25;
        project(t, -1, -zf, p); project(t, 1, -zf, q); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
        project(-1, t, -zf, p); project(1, t, -zf, q); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
        if (i >= 7) break;
      }
    }
    ctx.strokeStyle = back ? colors.line : colors.muted;
    edges.forEach(function (e) {
      var a = pr[e[0]], b = pr[e[1]], mid = (a[2] + b[2]) / 2, isBack = mid > (maxD + minD) / 2;
      if (isBack !== back) return;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    });
    if (!back && d) {
      ctx.fillStyle = colors.text; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      function lab(x, y, z, txt) { project(x, y, z, p); ctx.fillText(txt, p[0], p[1]); }
      function at(x, y, z) { var o = [0, 0, 0]; project(x, y, z, o); return o; }
      // Label edges are chosen from where the box edges land on screen, not from depth: looking straight down every depth ties,
      // which used to put the labels on arbitrary sides and stack the z labels on one spot.
      var lo1 = at(0, -1, -zf), hi1 = at(0, 1, -zf);
      var ey = lo1[1] >= hi1[1] ? -1 : 1;                       // x labels along the floor edge that is lower on screen
      var le = at(-1, 0, -zf), ri = at(1, 0, -zf);
      var ex = Math.abs(le[1] - ri[1]) < 2 ? (le[0] <= ri[0] ? -1 : 1) : (le[1] > ri[1] ? -1 : 1);   // y labels on the lower side edge (left one when level)
      lab(-0.95, ey * 1.16, -zf, fmt(d.x0)); lab(0.95, ey * 1.16, -zf, fmt(d.x1)); lab(0, ey * 1.24, -zf, "x");
      lab(ex * 1.16, -0.95, -zf, fmt(d.y0)); lab(ex * 1.16, 0.95, -zf, fmt(d.y1)); lab(ex * 1.24, 0, -zf, "y");
      // z labels sit on the far corner; with the camera straight above the z axis is a point, so skip them (the legend shows z)
      if (Math.abs(at(0, 0, zf)[1] - at(0, 0, -zf)[1]) > 18) {
        lab(-ex * 1.12, -ey * 1.12, zf, fmt(d.hi)); lab(-ex * 1.12, -ey * 1.12, -zf, fmt(d.lo)); lab(-ex * 1.12, -ey * 1.12, 0, "z");
      }
    }
  }

  /* ---------- sizing ---------- */
  function resize() {
    var w = canvas.parentNode.clientWidth || 320, h = Math.max(300, Math.min(560, Math.round(w * 0.82)));
    S.dpr = Math.min(window.devicePixelRatio || 1, 2.5); S.W = w; S.H = h;
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    canvas.width = Math.round(w * S.dpr); canvas.height = Math.round(h * S.dpr);
    readColors(); draw();
  }

  /* ---------- interaction ---------- */
  var ptrs = {}, lastDist = 0, settle = 0;
  function busyDraw() {   // quick draw now, full-quality draw once the keys or wheel go quiet
    S.busy = true; draw(); clearTimeout(settle);
    settle = setTimeout(function () { if (!nPtrs()) { S.busy = false; draw(); } }, 180);
  }
  function nPtrs() { return Object.keys(ptrs).length; }
  canvas.addEventListener("pointerdown", function (e) {
    canvas.setPointerCapture(e.pointerId); ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; S.busy = true;
    if (nPtrs() === 2) { var k = Object.keys(ptrs), a = ptrs[k[0]], b = ptrs[k[1]]; lastDist = Math.hypot(a.x - b.x, a.y - b.y); }
    stopSpin();
  });
  canvas.addEventListener("pointermove", function (e) {
    var p = ptrs[e.pointerId]; if (!p) return;
    if (nPtrs() === 1) {
      S.yaw += (e.clientX - p.x) * 0.01; S.pitch = Math.max(-0.2, Math.min(Math.PI / 2, S.pitch + (e.clientY - p.y) * 0.01));
      p.x = e.clientX; p.y = e.clientY; draw();
    } else {
      p.x = e.clientX; p.y = e.clientY;
      var k = Object.keys(ptrs), a = ptrs[k[0]], b = ptrs[k[1]], dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (lastDist) { S.zoom = Math.max(0.4, Math.min(4, S.zoom * dist / lastDist)); draw(); }
      lastDist = dist;
    }
  });
  function up(e) { delete ptrs[e.pointerId]; lastDist = 0; if (!nPtrs() && S.busy) { S.busy = false; draw(); } }
  canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", function (e) { e.preventDefault(); S.zoom = Math.max(0.4, Math.min(4, S.zoom * Math.exp(-e.deltaY * 0.0012))); busyDraw(); }, { passive: false });
  canvas.addEventListener("dblclick", function () { reset(); });
  canvas.addEventListener("keydown", function (e) {
    var h = true;
    if (e.key === "ArrowLeft") S.yaw -= 0.08; else if (e.key === "ArrowRight") S.yaw += 0.08;
    else if (e.key === "ArrowUp") S.pitch = Math.min(Math.PI / 2, S.pitch + 0.06); else if (e.key === "ArrowDown") S.pitch = Math.max(-0.2, S.pitch - 0.06);
    else if (e.key === "+" || e.key === "=") S.zoom = Math.min(4, S.zoom * 1.1); else if (e.key === "-") S.zoom = Math.max(0.4, S.zoom / 1.1);
    else h = false;
    if (h) { e.preventDefault(); stopSpin(); busyDraw(); }
  });

  var spinTimer = 0;
  function spinStep() { if (!S.spin) return; S.yaw += 0.012; S.busy = true; draw(); S.busy = false; spinTimer = requestAnimationFrame(spinStep); }
  function stopSpin() { if (S.spin) { S.spin = false; $("s3dSpin").setAttribute("aria-pressed", "false"); $("s3dSpin").classList.remove("on"); cancelAnimationFrame(spinTimer); } }
  function reset() { stopSpin(); S.yaw = DEF_VIEW.yaw; S.pitch = DEF_VIEW.pitch; S.zoom = DEF_VIEW.zoom; draw(); }

  $("s3dReset").addEventListener("click", reset);
  $("s3dTop").addEventListener("click", function () { stopSpin(); S.pitch = Math.PI / 2; S.yaw = 0; draw(); });
  $("s3dSpin").addEventListener("click", function () {
    S.spin = !S.spin; this.setAttribute("aria-pressed", S.spin ? "true" : "false"); this.classList.toggle("on", S.spin);
    if (S.spin) spinTimer = requestAnimationFrame(spinStep); else cancelAnimationFrame(spinTimer);
  });
  $("s3dSave").addEventListener("click", function () {
    canvas.toBlob(function (b) {
      if (!b) return;
      var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "3d-surface.png"; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }, "image/png");
  });

  /* ---------- wiring ---------- */
  var timer = 0;
  function refresh(full) { clearTimeout(timer); timer = setTimeout(function () { if (compile()) sample(); }, full ? 0 : 140); }
  $("s3dF").addEventListener("input", function () { refresh(false); });
  ["s3dXmin", "s3dXmax", "s3dYmin", "s3dYmax", "s3dZmin", "s3dZmax"].forEach(function (id) { $(id).addEventListener("input", function () { refresh(false); }); });
  ["s3dRes", "s3dColor"].forEach(function (id) { $(id).addEventListener("change", function () { refresh(true); }); });
  ["s3dMesh", "s3dBox"].forEach(function (id) { $(id).addEventListener("change", draw); });
  $("s3dSliders").addEventListener("input", function (e) {
    var n = e.target.getAttribute("data-n"); if (!n) return;
    S.params[n] = Number(e.target.value); $("s3dO_" + n).textContent = fmt(S.params[n]); refresh(false);
  });
  host.querySelector(".s3d-presets").addEventListener("click", function (e) {
    var i = e.target.getAttribute && e.target.getAttribute("data-p"); if (i === null || i === undefined) return;
    $("s3dF").value = PRESETS[Number(i)][1];
    ["s3dXmin", "s3dYmin"].forEach(function (id) { $(id).value = "-6"; }); ["s3dXmax", "s3dYmax"].forEach(function (id) { $(id).value = "6"; });
    var R = PRESETS[Number(i)][2];   // implicit presets carry their own box size
    if (R) { ["s3dXmin", "s3dYmin", "s3dZmin"].forEach(function (id) { $(id).value = String(-R); }); ["s3dXmax", "s3dYmax", "s3dZmax"].forEach(function (id) { $(id).value = String(R); }); }
    else { $("s3dZmin").value = ""; $("s3dZmax").value = ""; }
    refresh(true);
  });
  window.addEventListener("resize", resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas.parentNode);
  if (window.matchMedia) { try { window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { readColors(); draw(); }); } catch (e) { /* older browsers */ } }
  new MutationObserver(function () { readColors(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });

  function start() { resize(); if (compile()) sample(); }
  if (window.EGEngine) start(); else window.addEventListener("load", start);
})();
