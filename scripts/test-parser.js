/* Run:  node scripts/test-parser.js   -> unit tests for the expression parser */
const E = require("../assets/js/engine.js");
const pages = require("./pages.json");
let pass = 0, fail = 0;
const near = (a, b) => (Number.isNaN(a) && Number.isNaN(b)) || Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b));
function val(text, x, P) { const r = E.compileExpr(text); if (!r.fn) throw new Error("compile failed: " + text + " -> " + JSON.stringify(r)); return r.fn(x, P || {}); }
function t(text, x, expected, P) {
  let got; try { got = val(text, x, P); } catch (e) { got = "ERR " + e.message; }
  if (near(got, expected)) pass++; else { fail++; console.log("FAIL", JSON.stringify(text), "x=" + x, "got", got, "expected", expected); }
}
function err(text, contains) {
  const r = E.compileExpr(text);
  if (r.error && (!contains || r.error.indexOf(contains) >= 0)) pass++; else { fail++; console.log("FAIL expected error", JSON.stringify(text), "->", JSON.stringify(r)); }
}
// basics + precedence
t("x^2 - 4", 3, 5); t("2*x + 1", 2, 5); t("-x^2", 3, -9); t("2^3^2", 0, 512); t("2^-1", 0, 0.5);
t("1/2x", 4, 2); t("10/2*5", 0, 25); t("-2^2", 0, -4); t("(-2)^2", 0, 4);
// implicit multiplication
t("2x", 3, 6); t("3(x+1)", 1, 6); t("(x+1)(x-1)", 3, 8); t("x(x+1)", 2, 6); t("2x^2", 3, 18); t("2pi", 0, 2 * Math.PI);
t("xsin(x)", Math.PI / 2, Math.PI / 2); t("2sin(x)cos(x)", Math.PI / 4, 1); t("xe", 2, 2 * Math.E);
// parameters (sliders)
t("ax^2+bx+c", 2, 4 * 2 + 3 * 2 + 5 - 0 - 0 + 0, { a: 2, b: 3, c: 5 }); // 2*4+3*2+5 = 19
t("a*x", 5, 15, { a: 3 });
// unicode / symbols
t("x²", 3, 9); t("x³", 2, 8); t("√x", 9, 3); t("√(x+7)", 9, 4); t("π", 0, Math.PI); t("2π", 0, 2 * Math.PI);
t("3×x", 2, 6); t("6÷x", 2, 3); t("x−1", 5, 4); t("30°", 0, Math.PI / 6); t("|x|", -3, 3); t("|x-2|-3", 0, -1); t("2|x|", -2, 4);
// constants and functions
t("e^x", 1, Math.E); t("exp(1)", 0, Math.E); t("ln(e)", 0, 1); t("log(100)", 0, 2); t("log10(1000)", 0, 3); t("log2(8)", 0, 3); t("log(8,2)", 0, 3);
t("cbrt(-8)", 0, -2); t("(-8)^(1/3)", 0, -2); t("(-8)^(2/3)", 0, 4); t("x^(1/3)", -27, -3); t("abs(-4)", 0, 4); t("sqrt(16)", 0, 4);
t("max(1,5,3)", 0, 5); t("min(4,2)", 0, 2); t("mod(-1,3)", 0, 2); t("floor(2.7)", 0, 2); t("round(2.567,1)", 0, 2.6); t("5!", 0, 120);
t("arcsin(1)", 0, Math.PI / 2); t("atan(1)", 0, Math.PI / 4); t("sinh(0)", 0, 0); t("sec(0)", 0, 1); t("cot(pi/4)", 0, 1);
// piecewise / conditionals
t("x < 0 ? -x : x^2", -3, 3); t("x < 0 ? -x : x^2", 3, 9); t("x > -2 ? 0 : NaN", -3, NaN); t("x > -2 ? 0 : NaN", 0, 0);
t("x<0 ? 1 : x<5 ? 2 : 3", 7, 3); t("x>=0 && x<=2 ? 1 : 0", 1, 1); t("x<0 || x>2 ? 1 : 0", 1, 0);
// y= / f(x)= prefixes
t("y = x+1", 1, 2); t("f(x)=x+1", 1, 2); t("Y=2x", 3, 6);
// angle modes
E.setAngleDegrees(true); t("sin(30)", 0, 0.5); t("cos(60)", 0, 0.5); t("asin(0.5)", 0, 30); t("tan(45)", 0, 1); E.setAngleDegrees(false); t("sin(pi/6)", 0, 0.5);
// errors (friendly messages)
err("sin x", "parentheses"); err("sinx", "parentheses"); err("y^2", "y = f(x)"); err("(x+1", "closing"); err("x+1)", "Unexpected )");
err("2x+", "Unfinished"); err("3 $ 4", "Unexpected"); err("sqrt()", "needs"); err("abc*def*ghi*jkl*mno*pqr*stu", "Too many"); err("x ? 1", ":");
if (E.compileExpr("").empty && E.compileExpr("   ").empty && E.compileExpr("y=").empty) pass++; else { fail++; console.log("FAIL empty"); }

// relations with y: implicit curves and inequalities
const rel = (text) => { const r = E.compileExpr(text); if (!r.fn) throw new Error("compile failed: " + text + " -> " + JSON.stringify(r)); return r; };
const kindOf = (text, kind, op) => { let r; try { r = rel(text); } catch (e) { fail++; console.log("FAIL", e.message); return; } if (r.kind === kind && (op === undefined || r.op === op)) pass++; else { fail++; console.log("FAIL kind", JSON.stringify(text), JSON.stringify({ kind: r.kind, op: r.op })); } };
kindOf("y = x^2", undefined); kindOf("y=2x+1", undefined); kindOf("x^2+y^2=9", "implicit", "="); kindOf("x=3", "implicit", "=");
kindOf("xy=1", "implicit", "="); kindOf("x^2/4+y^2/9=1", "implicit", "="); kindOf("y > 2x", "ineq", ">"); kindOf("y<=x^2", "ineq", "<=");
kindOf("y\u2265x", "ineq", ">="); kindOf("x^2+y^2<9", "ineq", "<"); kindOf("x > 2", undefined); kindOf("x<0 ? -x : x^2", undefined); kindOf("y = 2y + x", "implicit", "=");
err("1<y<3", "only one"); err("y>", "both sides"); err("=3", "both sides"); err("y^2", "y = f(x)");
(function () {
  const r = rel("x^2 + 1 = 10");
  if (Math.abs(r.fn(3, {})) < 1e-12 && r.kind === "implicit") pass++; else { fail++; console.log("FAIL x^2+1=10"); }
  const q = rel("y > x");
  if (q.kind === "ineq" && Math.abs(q.fn(2, {}) - (-2)) < 1e-12) pass++; else { fail++; console.log("FAIL y>x at yv=0"); }
})();

// polar equations
(function () {
  const p1 = E.compileExpr("r = 2*sin(3*t)");
  const p2 = E.compileExpr("r = 1 + cos(t)");
  if (p1.kind === "polar" && p1.params.length === 0 && near(p1.fn(Math.PI / 6, {}), 2)) pass++;
  else { fail++; console.log("FAIL polar rose", p1); }
  if (p2.kind === "polar" && near(p2.fn(0, {}), 2) && near(p2.fn(Math.PI, {}), 0)) pass++;
  else { fail++; console.log("FAIL polar cardioid", p2); }
})();

// parametric equations
(function () {
  const p3 = E.compileExpr("(cos(t), sin(t))");
  if (p3.kind === "parametric" && near(p3.fn(0, {})[0], 1) && near(p3.fn(0, {})[1], 0)) pass++;
  else { fail++; console.log("FAIL parametric circle", p3); }
})();

// every page default
let n = 0;
[pages.home].concat(pages.pages).forEach(p => p.exprs.forEach(x => { n++; const r = E.compileExpr(x); if (r.fn) { const v = r.fn(1.5, {a:1,b:1,c:1}); if (typeof v !== "number" && !Array.isArray(v)) { fail++; console.log("FAIL bad eval", x); } else pass++; } else { fail++; console.log("FAIL page expr", p.path || "home", x, JSON.stringify(r)); } }));
// every worked example on every page must compile too
pages.pages.forEach(p => (p.examples || []).forEach(ex => { n++; const r = E.compileExpr(ex.e); if (r.fn) pass++; else { fail++; console.log("FAIL example", p.path, ex.e, JSON.stringify(r)); } }));
console.log(`${pass} passed, ${fail} failed (${n} page equations checked)`);
process.exit(fail ? 1 : 0);