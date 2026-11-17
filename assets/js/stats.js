/* ExamGrapher statistics tools: z-score, standard deviation, confidence interval, t-test.
   UMD: the maths (window.EGStats) is testable in Node; the UI mounts on #statsTool when present. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EGStats = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------- special functions ---------- */
  var LG = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  function lgamma(x) {
    var y = x, tmp = x + 5.5, ser = 1.000000000190015;
    tmp -= (x + 0.5) * Math.log(tmp);
    for (var j = 0; j < 6; j++) ser += LG[j] / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  }
  var EPS = 3e-16, FPMIN = 1e-300;

  /* regularised lower/upper incomplete gamma: returns [P, Q] */
  function gammaPQ(a, x) {
    if (x <= 0) return [0, 1];
    var gln = lgamma(a), i;
    if (x < a + 1) {
      var ap = a, sum = 1 / a, del = sum;
      for (i = 0; i < 1000; i++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * EPS) break; }
      var P = sum * Math.exp(-x + a * Math.log(x) - gln);
      return [P, 1 - P];
    }
    var b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d, an;
    for (i = 1; i < 1000; i++) {
      an = -i * (i - a); b += 2;
      d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; var del2 = d * c; h *= del2;
      if (Math.abs(del2 - 1) < EPS) break;
    }
    var Q = Math.exp(-x + a * Math.log(x) - gln) * h;
    return [1 - Q, Q];
  }

  function betacf(a, b, x) {
    var qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap, m, aa, del;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d; var h = d;
    for (m = 1; m <= 1000; m++) {
      var m2 = 2 * m;
      aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; del = d * c; h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }
  /* regularised incomplete beta I_x(a, b) */
  function betai(a, b, x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    var bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) return bt * betacf(a, b, x) / a;
    return 1 - bt * betacf(b, a, 1 - x) / b;
  }

  /* ---------- normal ---------- */
  function normPdf(z) { return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI); }
  function normCdf(z) {
    if (z === 0) return 0.5;
    var pq = gammaPQ(0.5, z * z / 2);          // P = erf(|z|/sqrt2)
    return z > 0 ? 0.5 * (1 + pq[0]) : 0.5 * pq[1];
  }
  function normInv(p) {
    if (!(p > 0 && p < 1)) return p === 0 ? -Infinity : p === 1 ? Infinity : NaN;
    var a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    var b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    var c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    var d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    var pl = 0.02425, q, r, x;
    if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    else if (p <= 1 - pl) { q = p - 0.5; r = q * q; x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
    else { q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    for (var i = 0; i < 3; i++) {              // Halley refinement
      var e = normCdf(x) - p, u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
      x = x - u / (1 + x * u / 2);
    }
    return x;
  }

  /* ---------- Student t ---------- */
  function tPdf(t, df) {
    return Math.exp(lgamma((df + 1) / 2) - lgamma(df / 2)) / Math.sqrt(df * Math.PI) * Math.pow(1 + t * t / df, -(df + 1) / 2);
  }
  function tCdf(t, df) {
    if (!isFinite(t)) return t > 0 ? 1 : 0;
    var tail = 0.5 * betai(df / 2, 0.5, df / (df + t * t));
    return t > 0 ? 1 - tail : tail;
  }
  function tInv(p, df) {
    if (!(p > 0 && p < 1)) return p === 0 ? -Infinity : p === 1 ? Infinity : NaN;
    if (p === 0.5) return 0;
    var lo = -1, hi = 1;
    while (tCdf(lo, df) > p) lo *= 2;
    while (tCdf(hi, df) < p) hi *= 2;
    for (var i = 0; i < 200; i++) {
      var mid = (lo + hi) / 2;
      if (tCdf(mid, df) < p) lo = mid; else hi = mid;
      if (hi - lo < 1e-13 * Math.max(1, Math.abs(mid))) break;
    }
    return (lo + hi) / 2;
  }

  /* ---------- data helpers ---------- */
  function parseNumbers(text) {
    var parts = String(text || "").split(/[\s,;]+/), nums = [], bad = [];
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      var v = Number(parts[i].replace(/^\+/, ""));
      if (isFinite(v)) nums.push(v); else bad.push(parts[i]);
    }
    return { nums: nums, bad: bad };
  }
  function describe(a) {
    var n = a.length, sum = 0, i;
    for (i = 0; i < n; i++) sum += a[i];
    var mean = n ? sum / n : NaN, ss = 0;
    for (i = 0; i < n; i++) ss += (a[i] - mean) * (a[i] - mean);
    var s = a.slice().sort(function (x, y) { return x - y; });
    var median = !n ? NaN : n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
    var sd = n > 1 ? Math.sqrt(ss / (n - 1)) : NaN;
    return { n: n, sum: sum, mean: mean, ss: ss, varSample: n > 1 ? ss / (n - 1) : NaN, varPop: n ? ss / n : NaN,
      sdSample: sd, sdPop: n ? Math.sqrt(ss / n) : NaN, sem: n > 1 ? sd / Math.sqrt(n) : NaN,
      min: s[0], max: s[n - 1], range: n ? s[n - 1] - s[0] : NaN, median: median };
  }

  /* ---------- tests ---------- */
  function pFromT(t, df, alt) {
    if (alt === "less") return tCdf(t, df);
    if (alt === "greater") return 1 - tCdf(t, df);
    return 2 * Math.min(tCdf(t, df), 1 - tCdf(t, df));
  }
  /* o: {type:"one"|"welch"|"pooled"|"paired", alt, alpha, mu0, a:{n,mean,sd}, b:{n,mean,sd}} (summary stats) */
  function tTest(o) {
    var a = o.a, b = o.b, alt = o.alt || "two", alpha = o.alpha || 0.05, res = { type: o.type, alt: alt, alpha: alpha };
    var diff, se, df, d;
    if (o.type === "one" || o.type === "paired") {
      var mu0 = o.type === "one" ? (o.mu0 || 0) : 0;
      diff = a.mean - mu0; se = a.sd / Math.sqrt(a.n); df = a.n - 1; d = diff / a.sd;
      res.mean = a.mean; res.n = a.n; res.mu0 = mu0;
    } else if (o.type === "pooled") {
      df = a.n + b.n - 2;
      var sp2 = ((a.n - 1) * a.sd * a.sd + (b.n - 1) * b.sd * b.sd) / df, sp = Math.sqrt(sp2);
      diff = a.mean - b.mean; se = sp * Math.sqrt(1 / a.n + 1 / b.n); d = diff / sp;
    } else {
      var v1 = a.sd * a.sd / a.n, v2 = b.sd * b.sd / b.n;
      diff = a.mean - b.mean; se = Math.sqrt(v1 + v2);
      df = (v1 + v2) * (v1 + v2) / (v1 * v1 / (a.n - 1) + v2 * v2 / (b.n - 1));
      d = diff / Math.sqrt((a.sd * a.sd + b.sd * b.sd) / 2);
    }
    var t = diff / se, tc = tInv(1 - alpha / 2, df);
    res.diff = diff; res.se = se; res.df = df; res.t = t; res.d = d;
    res.p = pFromT(t, df, alt); res.tcrit = tc; res.ciLo = diff - tc * se; res.ciHi = diff + tc * se;
    res.reject = res.p < alpha;
    return res;
  }
  function ciMean(o) {            // {mean, sd, n, level, known}
    var alpha = 1 - o.level, se = o.sd / Math.sqrt(o.n), df = o.n - 1;
    var crit = o.known ? normInv(1 - alpha / 2) : tInv(1 - alpha / 2, df);
    var moe = crit * se;
    return { se: se, df: df, crit: crit, moe: moe, lo: o.mean - moe, hi: o.mean + moe, dist: o.known ? "z" : "t" };
  }
  function ciProp(o) {            // {x, n, level}
    var p = o.x / o.n, z = normInv(1 - (1 - o.level) / 2), n = o.n;
    var se = Math.sqrt(p * (1 - p) / n), moe = z * se;
    var den = 1 + z * z / n, centre = (p + z * z / (2 * n)) / den;
    var half = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den;
    return { p: p, z: z, se: se, moe: moe, waldLo: Math.max(0, p - moe), waldHi: Math.min(1, p + moe),
      wilsonLo: Math.max(0, centre - half), wilsonHi: Math.min(1, centre + half) };
  }

  /* ---------- chi-square ---------- */
  function chiPdf(x, df) {
    if (x < 0) return 0;
    if (x === 0) return df < 2 ? Infinity : df === 2 ? 0.5 : 0;
    return Math.exp((df / 2 - 1) * Math.log(x) - x / 2 - (df / 2) * Math.LN2 - lgamma(df / 2));
  }
  function chiUpper(x, df) { return x <= 0 ? 1 : gammaPQ(df / 2, x / 2)[1]; }    // P(X >= x)
  /* goodness of fit: obs and exp are arrays of counts with equal totals */
  function chiGof(obs, exp) {
    var chi = 0, contrib = [], i;
    for (i = 0; i < obs.length; i++) { var c = (obs[i] - exp[i]) * (obs[i] - exp[i]) / exp[i]; contrib.push(c); chi += c; }
    var df = obs.length - 1;
    return { chi: chi, df: df, p: chiUpper(chi, df), contrib: contrib };
  }
  /* independence: table is an array of equal-length rows of counts (no continuity correction) */
  function chiIndep(t) {
    var r = t.length, c = t[0].length, rt = [], ct = [], n = 0, i, j;
    for (i = 0; i < r; i++) rt.push(0);
    for (j = 0; j < c; j++) ct.push(0);
    for (i = 0; i < r; i++) for (j = 0; j < c; j++) { rt[i] += t[i][j]; ct[j] += t[i][j]; n += t[i][j]; }
    var exp = [], contrib = [], chi = 0;
    for (i = 0; i < r; i++) {
      exp.push([]); contrib.push([]);
      for (j = 0; j < c; j++) {
        var e = rt[i] * ct[j] / n, k = (t[i][j] - e) * (t[i][j] - e) / e;
        exp[i].push(e); contrib[i].push(k); chi += k;
      }
    }
    var df = (r - 1) * (c - 1);
    return { chi: chi, df: df, p: chiUpper(chi, df), n: n, expected: exp, contrib: contrib, rowTotals: rt, colTotals: ct,
      v: Math.sqrt(chi / (n * Math.min(r - 1, c - 1))) };
  }

  var api = { lgamma: lgamma, betai: betai, gammaPQ: gammaPQ, normPdf: normPdf, normCdf: normCdf, normInv: normInv,
    tPdf: tPdf, tCdf: tCdf, tInv: tInv, parseNumbers: parseNumbers, describe: describe, tTest: tTest, chiPdf: chiPdf, chiUpper: chiUpper, chiGof: chiGof, chiIndep: chiIndep, ciMean: ciMean, ciProp: ciProp, pFromT: pFromT };

  /* =====================================================================  UI  */
  if (typeof document === "undefined") return api;

  function fmt(x, dp) {
    if (x === null || x === undefined || !isFinite(x)) return "n/a";
    dp = dp === undefined ? 4 : dp;
    if (x !== 0 && Math.abs(x) < Math.pow(10, -dp)) return x.toExponential(3);
    var s = x.toFixed(dp);
    return s.indexOf(".") >= 0 ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
  }
  function pct(x) { return fmt(x * 100, 2) + "%"; }
  function pfmt(p) { return p < 0.0001 ? "< 0.0001" : fmt(p, 4); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function val(id) { var el = $(id); return el ? el.value : ""; }
  function num(id) { var s = val(id).trim(); return s === "" ? NaN : Number(s); }

  function field(id, label, value, opts) {
    opts = opts || {};
    return '<div class="sf"><label for="' + id + '">' + label + '</label><input id="' + id + '" type="text" inputmode="decimal" autocomplete="off" value="' + esc(value) + '"' + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : "") + "></div>";
  }
  function select(id, label, options, selected) {
    return '<div class="sf"><label for="' + id + '">' + label + '</label><select id="' + id + '">' + options.map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === selected ? " selected" : "") + ">" + esc(o[1]) + "</option>";
    }).join("") + "</select></div>";
  }
  function area(id, label, value, rows) {
    return '<div class="sf wide"><label for="' + id + '">' + label + '</label><textarea id="' + id + '" rows="' + (rows || 4) + '" spellcheck="false" autocomplete="off">' + esc(value) + "</textarea></div>";
  }
  function stat(label, value, big) {
    return '<div class="stat' + (big ? " big" : "") + '"><span>' + label + "</span><strong>" + value + "</strong></div>";
  }
  function err(msg) { return '<p class="s-err" role="alert">' + esc(msg) + "</p>"; }

  /* SVG density plot. pdf: function; shade: [[lo,hi],...]; marks: [{x,label}] */
  function plot(pdf, xmin, xmax, shade, marks, xlabel, ycap) {
    var W = 640, H = 230, L = 14, R = 14, T = 18, B = 34, N = 240, i, ymax = 0, pts = [];
    for (i = 0; i <= N; i++) { var x = xmin + (xmax - xmin) * i / N, y = pdf(x); if (ycap && y > ycap) y = ycap; pts.push([x, y]); if (y > ymax) ymax = y; }
    function sx(x) { return L + (x - xmin) / (xmax - xmin) * (W - L - R); }
    function sy(y) { return H - B - y / (ymax * 1.08) * (H - B - T); }
    var out = '<svg viewBox="0 0 ' + W + " " + H + '" class="dplot" role="img" aria-label="' + esc(xlabel || "Distribution") + '">';
    shade.forEach(function (r) {
      var lo = Math.max(r[0], xmin), hi = Math.min(r[1], xmax);
      if (!(hi > lo)) return;
      var d = "M" + sx(lo) + "," + sy(0);
      for (i = 0; i <= N; i++) { var p = pts[i]; if (p[0] >= lo && p[0] <= hi) d += " L" + sx(p[0]).toFixed(1) + "," + sy(p[1]).toFixed(1); }
      d += " L" + sx(hi) + "," + sy(0) + " Z";
      out += '<path d="' + d + '" class="d-fill"/>';
    });
    var line = pts.map(function (p, k) { return (k ? "L" : "M") + sx(p[0]).toFixed(1) + "," + sy(p[1]).toFixed(1); }).join(" ");
    out += '<path d="' + line + '" class="d-line"/>';
    out += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + sy(0) + '" y2="' + sy(0) + '" class="d-axis"/>';
    var steps = [0.5, 1, 2, 5, 10, 20, 50, 100], step = steps[steps.length - 1];
    for (i = 0; i < steps.length; i++) { if ((xmax - xmin) / steps[i] <= 10.5) { step = steps[i]; break; } }
    for (var t = Math.ceil(xmin / step) * step; t <= xmax + 1e-9; t += step) {
      out += '<line x1="' + sx(t) + '" x2="' + sx(t) + '" y1="' + sy(0) + '" y2="' + (sy(0) + 5) + '" class="d-axis"/><text x="' + sx(t) + '" y="' + (sy(0) + 19) + '" class="d-tick" text-anchor="middle">' + fmt(t, 2) + "</text>";
    }
    (marks || []).forEach(function (m) {
      if (m.x < xmin || m.x > xmax) return;
      out += '<line x1="' + sx(m.x) + '" x2="' + sx(m.x) + '" y1="' + sy(0) + '" y2="' + (T - 4) + '" class="d-mark"/><text x="' + sx(m.x) + '" y="' + (T - 6) + '" class="d-lab" text-anchor="middle">' + esc(m.label) + "</text>";
    });
    return out + "</svg>";
  }

  function mount(host) {
    var tool = host.getAttribute("data-stats-tool"), out;
    function render(html) { out.innerHTML = html; }
    function run(fn) { return function () { try { fn(); } catch (e) { render(err("Something went wrong. Check the numbers and try again.")); } }; }
    function wire(ids, fn) {
      var go = run(fn);
      ids.forEach(function (id) { var el = $(id); if (el) { el.addEventListener("input", go); el.addEventListener("change", go); } });
      go();
    }
    var shell = '<div class="stat-form" id="sForm">%FORM%</div><div id="sOut" class="stat-out" aria-live="polite"></div>';

    /* ----- z-score ----- */
    if (tool === "zscore") {
      host.innerHTML = shell.replace("%FORM%",
        select("zMode", "What do you want to find?", [["z", "Z-score from a value"], ["x", "Value from a z-score"], ["pctl", "Z-score and value from a percentile"], ["p", "Probability (area under the curve)"]], "z") +
        '<div id="zFields"></div>');
      out = $("sOut");
      var zDefaults = { x: "85", mu: "70", sd: "10", z: "1.5", pc: "90", a: "60", b: "85", area: "between" };
      var zFields = function () {
        var m = val("zMode"), h = "";
        function keep(id, k) { return field(id, k[0], $(id) ? val(id) : zDefaults[k[1]]); }
        if (m === "z") h = keep("zx", ["Value (x)", "x"]) + keep("zmu", ["Mean (μ)", "mu"]) + keep("zsd", ["Standard deviation (σ)", "sd"]);
        else if (m === "x") h = keep("zz", ["Z-score", "z"]) + keep("zmu", ["Mean (μ)", "mu"]) + keep("zsd", ["Standard deviation (σ)", "sd"]);
        else if (m === "pctl") h = keep("zpc", ["Percentile (0 to 100)", "pc"]) + keep("zmu", ["Mean (μ)", "mu"]) + keep("zsd", ["Standard deviation (σ)", "sd"]);
        else h = select("zArea", "Area", [["left", "Left tail: P(X < a)"], ["right", "Right tail: P(X > a)"], ["between", "Between a and b"], ["outside", "Outside a and b (two tails)"]], $("zArea") ? val("zArea") : zDefaults.area) +
          keep("za", ["Value a", "a"]) + (($("zArea") ? val("zArea") : zDefaults.area) === "between" || ($("zArea") ? val("zArea") : zDefaults.area) === "outside" ? keep("zb", ["Value b", "b"]) : "") +
          keep("zmu", ["Mean (μ)", "mu"]) + keep("zsd", ["Standard deviation (σ)", "sd"]);
        $("zFields").innerHTML = h;
      };
      var zCompute = function () {
        var m = val("zMode"), mu = num("zmu"), sd = num("zsd"), h = "", marks = [], shade = [];
        if (!isFinite(mu) || !isFinite(sd)) return render(err("Enter the mean and the standard deviation."));
        if (sd <= 0) return render(err("The standard deviation must be greater than 0."));
        if (m === "z") {
          var x = num("zx"); if (!isFinite(x)) return render(err("Enter a value for x."));
          var z = (x - mu) / sd, left = normCdf(z);
          h = '<div class="stat-grid">' + stat("Z-score", fmt(z, 4), true) + stat("P(X &lt; x)", fmt(left, 6)) + stat("P(X &gt; x)", fmt(1 - left, 6)) + stat("Percentile", fmt(left * 100, 2) + "th") + "</div>" +
            "<p class=\"s-note\">z = (x &minus; μ) / σ = (" + fmt(x) + " &minus; " + fmt(mu) + ") / " + fmt(sd) + " = <strong>" + fmt(z, 4) + "</strong>. The value is " + fmt(Math.abs(z), 2) + " standard deviation" + (Math.abs(z) === 1 ? "" : "s") + (z === 0 ? " from (equal to) the mean." : z > 0 ? " above the mean." : " below the mean.") + "</p>";
          marks = [{ x: z, label: "z = " + fmt(z, 2) }]; shade = [[-8, z]];
        } else if (m === "pctl") {
          var pc = num("zpc"); if (!isFinite(pc) || pc <= 0 || pc >= 100) return render(err("Enter a percentile greater than 0 and less than 100."));
          var zp = normInv(pc / 100), xp = mu + zp * sd;
          h = '<div class="stat-grid">' + stat("Z-score", fmt(zp, 4), true) + stat("Value (x)", fmt(xp, 4), true) + stat("Area to the left", fmt(pc / 100, 4)) + stat("Area to the right", fmt(1 - pc / 100, 4)) + "</div>" +
            "<p class=\"s-note\">The " + fmt(pc, 2) + "th percentile is z = <strong>" + fmt(zp, 4) + "</strong>, so x = μ + zσ = " + fmt(mu) + " + (" + fmt(zp, 4) + " &times; " + fmt(sd) + ") = <strong>" + fmt(xp, 4) + "</strong>.</p>";
          marks = [{ x: zp, label: "z = " + fmt(zp, 2) }]; shade = [[-8, zp]];
        } else if (m === "x") {
          var zz = num("zz"); if (!isFinite(zz)) return render(err("Enter a z-score."));
          var xv = mu + zz * sd;
          h = '<div class="stat-grid">' + stat("Value (x)", fmt(xv, 4), true) + stat("P(X &lt; x)", fmt(normCdf(zz), 6)) + stat("P(X &gt; x)", fmt(1 - normCdf(zz), 6)) + "</div>" +
            "<p class=\"s-note\">x = μ + zσ = " + fmt(mu) + " + (" + fmt(zz) + " &times; " + fmt(sd) + ") = <strong>" + fmt(xv, 4) + "</strong>.</p>";
          marks = [{ x: zz, label: "z = " + fmt(zz, 2) }]; shade = [[-8, zz]];
        } else {
          var kind = val("zArea"), a = num("za"), b = num("zb");
          if (!isFinite(a)) return render(err("Enter value a."));
          var za = (a - mu) / sd, zb = (b - mu) / sd, pr, lab;
          if (kind === "left") { pr = normCdf(za); shade = [[-8, za]]; marks = [{ x: za, label: "z = " + fmt(za, 2) }]; lab = "P(X < " + fmt(a) + ")"; }
          else if (kind === "right") { pr = 1 - normCdf(za); shade = [[za, 8]]; marks = [{ x: za, label: "z = " + fmt(za, 2) }]; lab = "P(X > " + fmt(a) + ")"; }
          else {
            if (!isFinite(b)) return render(err("Enter value b."));
            var lo = Math.min(za, zb), hi = Math.max(za, zb), plo = Math.min(a, b), phi = Math.max(a, b);
            if (kind === "between") { pr = normCdf(hi) - normCdf(lo); shade = [[lo, hi]]; lab = "P(" + fmt(plo) + " < X < " + fmt(phi) + ")"; }
            else { pr = 1 - (normCdf(hi) - normCdf(lo)); shade = [[-8, lo], [hi, 8]]; lab = "P(X < " + fmt(plo) + " or X > " + fmt(phi) + ")"; }
            marks = [{ x: lo, label: fmt(lo, 2) }, { x: hi, label: fmt(hi, 2) }];
          }
          h = '<div class="stat-grid">' + stat(lab, fmt(pr, 6), true) + stat("As a percentage", pct(pr)) + stat("Z-score of a", fmt(za, 4)) + (isFinite(zb) && (kind === "between" || kind === "outside") ? stat("Z-score of b", fmt(zb, 4)) : "") + "</div>";
        }
        render(h + plot(normPdf, -4, 4, shade, marks, "Standard normal curve with the selected area shaded") + '<p class="s-cap">Standard normal curve (mean 0, standard deviation 1). Shaded area = the probability above.</p>');
      };
      zFields();
      host.addEventListener("change", function (e) { if (e.target.id === "zMode" || e.target.id === "zArea") zFields(); run(zCompute)(); });
      host.addEventListener("input", function (e) { if (e.target.tagName === "INPUT") run(zCompute)(); });
      run(zCompute)();
    }

    /* ----- standard deviation ----- */
    if (tool === "stddev") {
      host.innerHTML = shell.replace("%FORM%",
        area("sdData", "Enter your numbers (separate with commas, spaces or new lines)", "4, 8, 6, 5, 3, 7, 9, 5", 4) +
        select("sdType", "Data type", [["sample", "Sample (divide by n \u2212 1)"], ["pop", "Population (divide by n)"]], "sample"));
      out = $("sOut");
      wire(["sdData", "sdType"], function () {
        var pn = parseNumbers(val("sdData")), a = pn.nums, h = "";
        if (pn.bad.length) h += err("Ignored " + pn.bad.length + " item" + (pn.bad.length > 1 ? "s" : "") + " that are not numbers: " + pn.bad.slice(0, 5).join(", ") + (pn.bad.length > 5 ? "…" : ""));
        if (a.length < 2) return render(h + err("Enter at least 2 numbers."));
        var d = describe(a), isPop = val("sdType") === "pop", sd = isPop ? d.sdPop : d.sdSample, v = isPop ? d.varPop : d.varSample;
        h += '<div class="stat-grid">' + stat(isPop ? "Population SD (σ)" : "Sample SD (s)", fmt(sd, 6), true) + stat(isPop ? "Population variance (σ²)" : "Sample variance (s²)", fmt(v, 6)) +
          stat("Mean", fmt(d.mean, 6)) + stat("Count (n)", d.n) + stat("Sum", fmt(d.sum, 6)) + stat("Standard error of the mean", fmt(d.sem, 6)) +
          stat("Median", fmt(d.median, 6)) + stat("Min / Max", fmt(d.min) + " / " + fmt(d.max)) + stat("Range", fmt(d.range, 6)) +
          stat(isPop ? "Sample SD (for comparison)" : "Population SD (for comparison)", fmt(isPop ? d.sdSample : d.sdPop, 6)) + "</div>";
        var rows = a.slice(0, 30).map(function (x) { var dv = x - d.mean; return "<tr><td>" + fmt(x, 4) + "</td><td>" + fmt(dv, 4) + "</td><td>" + fmt(dv * dv, 4) + "</td></tr>"; }).join("");
        h += '<h3 class="s-h">Step by step</h3><ol class="s-steps"><li>Mean: ' + fmt(d.sum) + " / " + d.n + " = <strong>" + fmt(d.mean, 6) + "</strong></li>" +
          "<li>Sum of squared deviations: <strong>" + fmt(d.ss, 6) + "</strong></li>" +
          "<li>Variance: " + fmt(d.ss, 6) + " / " + (isPop ? d.n : d.n - 1) + " = <strong>" + fmt(v, 6) + "</strong></li>" +
          "<li>Standard deviation: &radic;" + fmt(v, 6) + " = <strong>" + fmt(sd, 6) + "</strong></li></ol>" +
          '<div class="s-scroll"><table class="s-table"><thead><tr><th>x</th><th>x &minus; mean</th><th>(x &minus; mean)&sup2;</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
          (a.length > 30 ? '<p class="s-cap">Showing the first 30 of ' + a.length + " values.</p>" : "");
        render(h);
      });
    }

    /* ----- confidence interval ----- */
    if (tool === "ci") {
      host.innerHTML = shell.replace("%FORM%",
        select("ciMode", "Estimate a", [["mean", "Population mean"], ["prop", "Proportion"]], "mean") + '<div id="ciFields"></div>' +
        select("ciLevel", "Confidence level", [["0.90", "90%"], ["0.95", "95%"], ["0.99", "99%"], ["custom", "Custom"]], "0.95") + '<div id="ciCustom"></div>');
      out = $("sOut");
      var ciSet = { mean: "52.4", sd: "6.8", n: "36", x: "58", nn: "120" };
      var ciFields = function () {
        function k(id, key, label) { return field(id, label, $(id) ? val(id) : ciSet[key]); }
        var h = val("ciMode") === "mean" ?
          k("ciMean", "mean", "Sample mean (x\u0304)") + k("ciSd", "sd", "Sample standard deviation (s)") + k("ciN", "n", "Sample size (n)") +
          '<div class="sf wide"><label class="chk"><input type="checkbox" id="ciKnown"' + ($("ciKnown") && $("ciKnown").checked ? " checked" : "") + '> Population standard deviation is known (use z instead of t)</label></div>' :
          k("ciX", "x", "Successes (x)") + k("ciNn", "nn", "Sample size (n)");
        $("ciFields").innerHTML = h;
        $("ciCustom").innerHTML = val("ciLevel") === "custom" ? field("ciCustomVal", "Custom level (%)", $("ciCustomVal") ? val("ciCustomVal") : "97") : "";
      };
      var ciRun = function () {
        var lv = val("ciLevel") === "custom" ? num("ciCustomVal") / 100 : Number(val("ciLevel"));
        if (!(lv > 0 && lv < 1)) return render(err("Enter a confidence level between 0 and 100 (exclusive)."));
        var h, shade, marks, pdf, lo, hi;
        if (val("ciMode") === "mean") {
          var m = num("ciMean"), s = num("ciSd"), n = num("ciN");
          if (!isFinite(m) || !isFinite(s) || !isFinite(n)) return render(err("Fill in the sample mean, standard deviation and sample size."));
          if (s < 0 || n < 2 || Math.floor(n) !== n) return render(err("Sample size must be a whole number of at least 2, and the standard deviation cannot be negative."));
          var known = $("ciKnown") && $("ciKnown").checked, r = ciMean({ mean: m, sd: s, n: n, level: lv, known: known });
          h = '<div class="stat-grid">' + stat(pct(lv) + " confidence interval", "(" + fmt(r.lo, 4) + ", " + fmt(r.hi, 4) + ")", true) + stat("Margin of error", fmt(r.moe, 4)) +
            stat(r.dist === "z" ? "Critical value (z*)" : "Critical value (t*)", fmt(r.crit, 4)) + stat("Standard error", fmt(r.se, 4)) + (r.dist === "t" ? stat("Degrees of freedom", r.df) : "") + "</div>" +
            '<p class="s-note">' + fmt(m) + " &plusmn; " + fmt(r.crit, 4) + " &times; (" + fmt(s) + " / &radic;" + n + ") = " + fmt(m) + " &plusmn; " + fmt(r.moe, 4) + ".</p>";
          pdf = r.dist === "z" ? normPdf : function (x) { return tPdf(x, r.df); };
          shade = [[-r.crit, r.crit]]; marks = [{ x: -r.crit, label: fmt(-r.crit, 2) }, { x: r.crit, label: fmt(r.crit, 2) }];
          render(h + plot(pdf, -4.5, 4.5, shade, marks, "Sampling distribution with the middle " + pct(lv) + " shaded") + '<p class="s-cap">The shaded middle area is the confidence level. The critical values mark where it ends.</p>');
        } else {
          var x = num("ciX"), nn = num("ciNn");
          if (!isFinite(x) || !isFinite(nn)) return render(err("Enter the number of successes and the sample size."));
          if (nn < 1 || x < 0 || x > nn || Math.floor(x) !== x || Math.floor(nn) !== nn) return render(err("Successes must be a whole number from 0 to n."));
          var p = ciProp({ x: x, n: nn, level: lv });
          h = '<div class="stat-grid">' + stat("Sample proportion (p\u0302)", fmt(p.p, 4), true) + stat(pct(lv) + " Wilson interval", "(" + fmt(p.wilsonLo, 4) + ", " + fmt(p.wilsonHi, 4) + ")") +
            stat(pct(lv) + " normal (Wald) interval", "(" + fmt(p.waldLo, 4) + ", " + fmt(p.waldHi, 4) + ")") + stat("Margin of error (Wald)", fmt(p.moe, 4)) + stat("Critical value (z*)", fmt(p.z, 4)) + "</div>" +
            '<p class="s-note">Wald: p\u0302 &plusmn; z*&radic;(p\u0302(1 &minus; p\u0302)/n) = ' + fmt(p.p, 4) + " &plusmn; " + fmt(p.moe, 4) + ". The Wilson interval is more reliable for small samples or proportions near 0 or 1.</p>";
          render(h + plot(normPdf, -4.5, 4.5, [[-p.z, p.z]], [{ x: -p.z, label: fmt(-p.z, 2) }, { x: p.z, label: fmt(p.z, 2) }], "Normal curve with the middle " + pct(lv) + " shaded") + '<p class="s-cap">Shaded middle area = confidence level.</p>');
        }
      };
      ciFields();
      host.addEventListener("change", function (e) { if (e.target.id === "ciMode" || e.target.id === "ciLevel") ciFields(); run(ciRun)(); });
      host.addEventListener("input", function (e) { if (e.target.id !== "ciMode" && e.target.id !== "ciLevel") run(ciRun)(); });
      run(ciRun)();
    }

    /* ----- t-test ----- */
    if (tool === "ttest") {
      host.innerHTML = shell.replace("%FORM%",
        select("ttType", "Test type", [["one", "One-sample t-test"], ["welch", "Two-sample t-test (Welch, unequal variances)"], ["pooled", "Two-sample t-test (pooled, equal variances)"], ["paired", "Paired t-test"]], "welch") +
        select("ttMode", "Input", [["raw", "Raw data"], ["sum", "Summary statistics"]], "raw") + '<div id="ttFields"></div>' +
        select("ttAlt", "Alternative hypothesis", [["two", "Two-sided (\u2260)"], ["greater", "Right-tailed (>)"], ["less", "Left-tailed (<)"]], "two") +
        select("ttAlpha", "Significance level (\u03b1)", [["0.10", "0.10"], ["0.05", "0.05"], ["0.01", "0.01"]], "0.05"));
      out = $("sOut");
      var ttDef = { r1: "23, 25, 28, 30, 26, 27, 24, 29", r2: "20, 22, 25, 24, 21, 23, 26, 22", n1: "8", m1: "26.5", s1: "2.449", n2: "8", m2: "22.875", s2: "2.031", mu0: "25" };
      var ttFields = function () {
        var type = val("ttType"), mode = type === "paired" ? "raw" : val("ttMode"), h = "", two = type !== "one";
        if (type === "paired") { $("ttMode").value = "raw"; $("ttMode").disabled = true; } else $("ttMode").disabled = false;
        function k(id, key, label) { return field(id, label, $(id) ? val(id) : ttDef[key]); }
        function a(id, key, label) { return area(id, label, $(id) ? val(id) : ttDef[key], 3); }
        if (type === "one") h += k("ttMu0", "mu0", "Hypothesised mean (\u03bc\u2080)");
        if (mode === "raw") {
          h += a("ttR1", "r1", type === "paired" ? "Before / first measurement" : two ? "Sample 1 values" : "Sample values");
          if (two) h += a("ttR2", "r2", type === "paired" ? "After / second measurement (same order)" : "Sample 2 values");
        } else {
          h += k("ttN1", "n1", two ? "Sample 1 size (n\u2081)" : "Sample size (n)") + k("ttM1", "m1", two ? "Sample 1 mean" : "Sample mean") + k("ttS1", "s1", two ? "Sample 1 SD" : "Sample SD");
          if (two) h += k("ttN2", "n2", "Sample 2 size (n\u2082)") + k("ttM2", "m2", "Sample 2 mean") + k("ttS2", "s2", "Sample 2 SD");
        }
        $("ttFields").innerHTML = h;
      };
      var ttRun = function () {
        var type = val("ttType"), mode = type === "paired" ? "raw" : val("ttMode"), alt = val("ttAlt"), alpha = Number(val("ttAlpha")), A, B, o, notes = "";
        if (mode === "raw") {
          var p1 = parseNumbers(val("ttR1")), p2 = type === "one" ? null : parseNumbers(val("ttR2"));
          if (p1.bad.length || (p2 && p2.bad.length)) notes += err("Some entries are not numbers and were ignored.");
          if (type === "paired") {
            if (p1.nums.length !== p2.nums.length) return render(err("A paired test needs the same number of values in both lists (" + p1.nums.length + " vs " + p2.nums.length + ")."));
            var diffs = p1.nums.map(function (v, i) { return v - p2.nums[i]; });
            if (diffs.length < 2) return render(err("Enter at least 2 pairs."));
            var dd = describe(diffs); A = { n: dd.n, mean: dd.mean, sd: dd.sdSample };
          } else {
            if (p1.nums.length < 2) return render(notes + err("Sample 1 needs at least 2 values."));
            var d1 = describe(p1.nums); A = { n: d1.n, mean: d1.mean, sd: d1.sdSample };
            if (p2) { if (p2.nums.length < 2) return render(notes + err("Sample 2 needs at least 2 values.")); var d2 = describe(p2.nums); B = { n: d2.n, mean: d2.mean, sd: d2.sdSample }; }
          }
        } else {
          A = { n: num("ttN1"), mean: num("ttM1"), sd: num("ttS1") };
          if (type !== "one") B = { n: num("ttN2"), mean: num("ttM2"), sd: num("ttS2") };
          var all = [A.n, A.mean, A.sd].concat(B ? [B.n, B.mean, B.sd] : []);
          if (all.some(function (v) { return !isFinite(v); })) return render(err("Fill in every field."));
          if (A.n < 2 || (B && B.n < 2)) return render(err("Each sample size must be at least 2."));
          if (A.sd <= 0 || (B && B.sd <= 0)) return render(err("Standard deviations must be greater than 0."));
        }
        if (A.sd === 0 || (B && B.sd === 0)) return render(notes + err("A sample with no variation (all values equal) cannot be tested."));
        o = { type: type, alt: alt, alpha: alpha, mu0: num("ttMu0") || 0, a: A, b: B };
        if (type === "one" && !isFinite(num("ttMu0"))) return render(err("Enter the hypothesised mean."));
        var r = tTest(o), what = type === "one" ? "mean" : type === "paired" ? "mean difference" : "difference in means";
        var altTxt = alt === "two" ? "\u2260" : alt === "greater" ? ">" : "<";
        var h = notes + '<div class="stat-grid">' + stat("t statistic", fmt(r.t, 4), true) + stat("Degrees of freedom", fmt(r.df, type === "welch" ? 3 : 0)) + stat("p-value", pfmt(r.p), true) +
          stat(type === "one" ? "Sample mean" : "Observed " + what, fmt(type === "one" ? A.mean : r.diff, 4)) + stat("Standard error", fmt(r.se, 4)) + stat((1 - alpha) * 100 + "% CI for the " + what + (type === "one" ? "" : ""), "(" + fmt(type === "one" ? r.ciLo + o.mu0 : r.ciLo, 4) + ", " + fmt(type === "one" ? r.ciHi + o.mu0 : r.ciHi, 4) + ")") +
          stat("Cohen\u2019s d", fmt(r.d, 3)) + "</div>" +
          '<p class="s-verdict ' + (r.reject ? "rej" : "keep") + '">' + (r.reject ? "Reject H\u2080" : "Fail to reject H\u2080") + " at \u03b1 = " + alpha + ": p = " + pfmt(r.p) + (r.reject ? " is below " : " is not below ") + alpha + ".</p>" +
          '<p class="s-note">H\u2080: ' + (type === "one" ? "\u03bc = " + fmt(o.mu0) : type === "paired" ? "mean difference = 0" : "\u03bc\u2081 = \u03bc\u2082") + ". H\u2081: " + (type === "one" ? "\u03bc " + altTxt + " " + fmt(o.mu0) : type === "paired" ? "mean difference " + altTxt + " 0" : "\u03bc\u2081 " + altTxt + " \u03bc\u2082") + ".</p>";
        var tAbs = Math.abs(r.t), shade = alt === "two" ? [[-12, -tAbs], [tAbs, 12]] : alt === "greater" ? [[r.t, 12]] : [[-12, r.t]];
        var lim = Math.max(4.5, tAbs + 1);
        render(h + plot(function (x) { return tPdf(x, r.df); }, -lim, lim, shade, [{ x: r.t, label: "t = " + fmt(r.t, 2) }], "t distribution with the p-value area shaded") + '<p class="s-cap">Shaded tail area = the p-value under H\u2080.</p>');
      };
      ttFields();
      host.addEventListener("change", function (e) { if (e.target.id === "ttType" || e.target.id === "ttMode") ttFields(); run(ttRun)(); });
      host.addEventListener("input", function (e) { run(ttRun)(); });
      run(ttRun)();
    }
    /* ----- chi-square ----- */
    if (tool === "chisq") {
      var csDef = { obs: "5, 8, 9, 8, 10, 20", exp: "10, 10, 10, 10, 10, 10", prop: "1, 1, 1, 1, 1, 1", tbl: "30, 20\n20, 30" };
      host.innerHTML = shell.replace("%FORM%",
        select("csType", "Test type", [["gof", "Goodness of fit"], ["ind", "Test of independence (contingency table)"]], "gof") + '<div id="csFields"></div>' +
        select("csAlpha", "Significance level (\u03b1)", [["0.10", "0.10"], ["0.05", "0.05"], ["0.01", "0.01"]], "0.05"));
      out = $("sOut");
      var csFields = function () {
        var type = val("csType"), h = "";
        function a(id, key, label, rows) { return area(id, label, $(id) ? val(id) : csDef[key], rows); }
        if (type === "gof") {
          var ex = $("csExpMode") ? val("csExpMode") : "equal";
          h += a("csObs", "obs", "Observed counts (one per category)", 3) +
            select("csExpMode", "Expected values", [["equal", "Equal in every category"], ["prop", "Custom proportions"], ["count", "Custom expected counts"]], ex);
          if (ex === "prop") h += a("csProp", "prop", "Expected proportions (any scale, e.g. 1, 2, 1 or 25, 50, 25)", 2);
          if (ex === "count") h += a("csExp", "exp", "Expected counts (must add up to the observed total)", 2);
        } else {
          h += a("csTbl", "tbl", "Observed counts: one row per line, values separated by commas, spaces or tabs", 5);
        }
        $("csFields").innerHTML = h;
      };
      function csTables(head, rows) {
        return '<div class="s-scroll"><table class="s-table"><thead><tr>' + head.map(function (x) { return "<th>" + x + "</th>"; }).join("") + "</tr></thead><tbody>" +
          rows.map(function (r) { return "<tr>" + r.map(function (x) { return "<td>" + x + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>";
      }
      var csRun = function () {
        var type = val("csType"), alpha = Number(val("csAlpha")), r, lowE = 0, cells = 0, h, tbls = "";
        if (type === "gof") {
          var po = parseNumbers(val("csObs")), obs = po.nums;
          if (po.bad.length) return render(err("These entries are not numbers: " + po.bad.slice(0, 5).join(", ")));
          if (obs.length < 2) return render(err("Enter at least 2 observed counts."));
          if (obs.some(function (v) { return v < 0; })) return render(err("Counts cannot be negative."));
          var tot = obs.reduce(function (x, y) { return x + y; }, 0);
          if (!(tot > 0)) return render(err("The observed counts must add up to more than 0."));
          var mode = val("csExpMode") || "equal", exp;
          if (mode === "equal") exp = obs.map(function () { return tot / obs.length; });
          else {
            var pe = parseNumbers(val(mode === "prop" ? "csProp" : "csExp"));
            if (pe.bad.length) return render(err("These expected values are not numbers: " + pe.bad.slice(0, 5).join(", ")));
            if (pe.nums.length !== obs.length) return render(err("You entered " + obs.length + " observed counts but " + pe.nums.length + " expected values. They must match."));
            if (pe.nums.some(function (v) { return !(v > 0); })) return render(err("Expected values must be greater than 0."));
            var se = pe.nums.reduce(function (x, y) { return x + y; }, 0);
            if (mode === "prop") exp = pe.nums.map(function (v) { return tot * v / se; });
            else {
              if (Math.abs(se - tot) > Math.max(0.5, 0.001 * tot)) return render(err("Expected counts add up to " + fmt(se, 2) + " but observed counts add up to " + fmt(tot, 2) + ". The totals must match."));
              exp = pe.nums;
            }
          }
          r = chiGof(obs, exp);
          exp.forEach(function (e) { cells++; if (e < 5) lowE++; });
          tbls = '<h3 class="s-h">Observed, expected and contribution</h3>' + csTables(["Category", "Observed", "Expected", "(O \u2212 E)\u00b2 / E"],
            obs.map(function (o, i) { return [i + 1, fmt(o, 4), fmt(exp[i], 4), fmt(r.contrib[i], 4)]; }));
          h = '<div class="stat-grid">' + stat("Chi-square (\u03c7\u00b2)", fmt(r.chi, 4), true) + stat("Degrees of freedom", r.df) + stat("p-value", pfmt(r.p), true) + stat("Total count (n)", fmt(tot, 4)) + "</div>";
        } else {
          var rows = val("csTbl").split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return l; }), tb = [], bad = false;
          rows.forEach(function (l) { var pr = parseNumbers(l); if (pr.bad.length) bad = true; tb.push(pr.nums); });
          if (bad) return render(err("The table contains entries that are not numbers."));
          if (tb.length < 2 || tb[0].length < 2) return render(err("Enter at least 2 rows and 2 columns."));
          if (tb.some(function (row) { return row.length !== tb[0].length; })) return render(err("Every row needs the same number of values."));
          if (tb.some(function (row) { return row.some(function (v) { return v < 0; }); })) return render(err("Counts cannot be negative."));
          var rt = tb.map(function (row) { return row.reduce(function (x, y) { return x + y; }, 0); });
          var ct = tb[0].map(function (_, j) { return tb.reduce(function (x, row) { return x + row[j]; }, 0); });
          if (rt.some(function (v) { return v === 0; }) || ct.some(function (v) { return v === 0; })) return render(err("Every row and column needs a total above 0."));
          r = chiIndep(tb);
          r.expected.forEach(function (row) { row.forEach(function (e) { cells++; if (e < 5) lowE++; }); });
          var head = [""].concat(tb[0].map(function (_, j) { return "Col " + (j + 1); }));
          tbls = '<h3 class="s-h">Expected counts</h3>' + csTables(head, r.expected.map(function (row, i) { return ["Row " + (i + 1)].concat(row.map(function (x) { return fmt(x, 3); })); })) +
            '<h3 class="s-h">Contribution to \u03c7\u00b2, (O \u2212 E)\u00b2 / E</h3>' + csTables(head, r.contrib.map(function (row, i) { return ["Row " + (i + 1)].concat(row.map(function (x) { return fmt(x, 3); })); }));
          h = '<div class="stat-grid">' + stat("Chi-square (\u03c7\u00b2)", fmt(r.chi, 4), true) + stat("Degrees of freedom", r.df) + stat("p-value", pfmt(r.p), true) + stat("Total count (n)", fmt(r.n, 4)) + stat("Cram\u00e9r\u2019s V", fmt(r.v, 3)) + "</div>";
        }
        var rej = r.p < alpha;
        h += '<p class="s-verdict ' + (rej ? "rej" : "keep") + '">' + (rej ? "Reject H\u2080" : "Fail to reject H\u2080") + " at \u03b1 = " + alpha + ": p = " + pfmt(r.p) + (rej ? " is below " : " is not below ") + alpha + ".</p>" +
          '<p class="s-note">H\u2080: ' + (type === "gof" ? "the observed counts follow the expected distribution." : "the two variables are independent.") + " H\u2081: " + (type === "gof" ? "they do not." : "they are associated.") + "</p>";
        if (lowE) h += '<p class="s-warn">' + lowE + " of " + cells + " expected counts are below 5, so the chi-square approximation may be unreliable. Consider combining categories or using an exact test.</p>";
        var crit = chiInvUpper(alpha, r.df), xmax = Math.max(r.chi * 1.3, crit * 1.3, r.df + 4 * Math.sqrt(2 * r.df), 6);
        render(h + plot(function (x) { return chiPdf(x, r.df); }, 0, xmax, [[r.chi, xmax * 2]], [{ x: r.chi, label: "\u03c7\u00b2 = " + fmt(r.chi, 2) }], "Chi-square distribution with the p-value area shaded", r.df === 1 ? chiPdf(xmax * 0.012, 1) : 0) +
          '<p class="s-cap">Shaded right tail = the p-value under H\u2080. Critical value at \u03b1 = ' + alpha + ": " + fmt(crit, 4) + ".</p>" + tbls);
      };
      function chiInvUpper(alpha, df) {
        var lo = 0, hi = Math.max(10, df * 4);
        while (chiUpper(hi, df) > alpha) hi *= 2;
        for (var i = 0; i < 200; i++) { var m = (lo + hi) / 2; if (chiUpper(m, df) > alpha) lo = m; else hi = m; }
        return (lo + hi) / 2;
      }
      csFields();
      host.addEventListener("change", function (e) { if (e.target.id === "csType" || e.target.id === "csExpMode") csFields(); run(csRun)(); });
      host.addEventListener("input", function () { run(csRun)(); });
      run(csRun)();
    }
  }

  var host = document.getElementById("statsTool");
  if (host) mount(host);
  return api;
});
