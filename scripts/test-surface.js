// Tests EGEngine.compileSurface (the 3D page parser). Run: node scripts/test-surface.js
const E = require("../assets/js/engine.js");
let pass = 0, fail = 0;
function eq(name, got, want) { if (Math.abs(got - want) < 1e-12) pass++; else { fail++; console.log("FAIL", name, got, want); } }
function ev(src, x, y, P) { const c = E.compileSurface(src); if (!c.fn) throw new Error(src + ": " + JSON.stringify(c)); return c.fn(x, y, P || {}); }
eq("paraboloid", ev("z = x^2 + y^2", 2, 3), 13);
eq("implicit multiply", ev("sin(x)cos(y)", 1, 2), Math.sin(1) * Math.cos(2));
eq("xy", ev("xy", 3, 4), 12);
eq("f(x,y) prefix", ev("f(x,y) = exp(-(x^2+y^2)/4)", 1, 1), Math.exp(-0.5));
eq("abs bars", ev("|x| + |y|", -2, 3), 5);
eq("monkey saddle", ev("x^3 - 3*x*y^2", 2, 1), 2);
eq("slider params", ev("a*x^2 + b*y", 2, 3, { a: 2, b: 5 }), 23);
eq("y changes between calls", ev("y - x", 1, 5) + ev("y - x", 1, 7), 4 + 6);
eq("param count", E.compileSurface("a*sin(x)*cos(b*y)").params.length, 2);
["x^2+", "x^2 = y", "z^2 + x"].forEach(function (s) {
  if (E.compileSurface(s).error) pass++; else { fail++; console.log("FAIL expected an error for", s); }
});
if (E.compileSurface("   ").empty) pass++; else { fail++; console.log("FAIL empty input"); }

// ---- implicit surfaces: compileImplicit3 ----
function ev3(src, x, y, z, P) { const c = E.compileImplicit3(src); if (!c.fn) throw new Error(src + ": " + JSON.stringify(c)); return c.fn(x, y, z, P || {}); }
eq("sphere F inside", ev3("x^2 + y^2 + z^2 = 9", 1, 2, 2), 0);
eq("sphere F outside", ev3("x^2 + y^2 + z^2 = 9", 3, 3, 0), 9);
eq("z on the right", ev3("x^2 + y^2 = z", 1, 1, 5), -3);
eq("no relation means F = 0", ev3("x + y + z", 1, 2, 3), 6);
eq("implicit slider", ev3("a*x^2 + z^2 = 1", 1, 0, 0, { a: 3 }), 2);
eq("implicit params exclude z", E.compileImplicit3("a*x + z = 0").params.length, 1);
["x^2 = y", "z > x", "z^2 +", "x^2 + z^2 = 1 = 2"].forEach(function (s) {
  if (E.compileImplicit3(s).error) pass++; else { fail++; console.log("FAIL expected an implicit error for", s); }
});
if (E.compileImplicit3("  ").empty) pass++; else { fail++; console.log("FAIL implicit empty input"); }

// ---- marching tetrahedra on a sphere: radius, area, watertight, plus NaN and empty cases ----
const M = require("../assets/js/marching.js");
(function () {
  const N = 40, n1 = N + 1, R = 3, L = 4.5, F = new Float64Array(n1 * n1 * n1), f = E.compileImplicit3("x^2 + y^2 + z^2 = 9").fn;
  for (let k = 0; k < n1; k++) for (let j = 0; j < n1; j++) for (let i = 0; i < n1; i++) F[(k * n1 + j) * n1 + i] = f(-L + 2 * L * i / N, -L + 2 * L * j / N, -L + 2 * L * k / N, {});
  const r = M.tetra(F, n1, n1, n1, -L, L, -L, L, -L, L, 0), p = r.pos;
  let maxErr = 0, area = 0;
  const key = (o) => Math.round(p[o] * 1e5) + "," + Math.round(p[o + 1] * 1e5) + "," + Math.round(p[o + 2] * 1e5), edges = new Map();
  for (let t = 0; t < r.count; t++) {
    const o = t * 9;
    for (let v = 0; v < 3; v++) maxErr = Math.max(maxErr, Math.abs(Math.hypot(p[o + 3 * v], p[o + 3 * v + 1], p[o + 3 * v + 2]) - R));
    const ux = p[o + 3] - p[o], uy = p[o + 4] - p[o + 1], uz = p[o + 5] - p[o + 2], vx = p[o + 6] - p[o], vy = p[o + 7] - p[o + 1], vz = p[o + 8] - p[o + 2];
    area += 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    const ks = [0, 1, 2].map((v) => key(o + 3 * v));
    for (let v = 0; v < 3; v++) { const a = ks[v], b = ks[(v + 1) % 3]; if (a === b) continue; const e = a < b ? a + "|" + b : b + "|" + a; edges.set(e, (edges.get(e) || 0) + 1); }
  }
  let open = 0; edges.forEach(function (c) { if (c !== 2) open++; });
  if (r.count > 1000) pass++; else { fail++; console.log("FAIL sphere has too few triangles", r.count); }
  if (maxErr < 0.02) pass++; else { fail++; console.log("FAIL sphere vertices off the surface by", maxErr); }
  if (Math.abs(area / (4 * Math.PI * R * R) - 1) < 0.01) pass++; else { fail++; console.log("FAIL sphere area", area); }
  if (open === 0) pass++; else { fail++; console.log("FAIL sphere mesh is not watertight, open edges:", open); }
  // a field that never crosses 0 gives no triangles
  const G = new Float64Array(n1 * n1 * n1).fill(1);
  if (M.tetra(G, n1, n1, n1, 0, 1, 0, 1, 0, 1, 0).count === 0) pass++; else { fail++; console.log("FAIL constant field should be empty"); }
  // NaN regions are skipped without breaking the rest
  const H = F.slice(); for (let k = 0; k < n1; k++) for (let j = 0; j < n1; j++) for (let i = 0; i < n1 / 2; i++) H[(k * n1 + j) * n1 + i] = NaN;
  const rh = M.tetra(H, n1, n1, n1, -L, L, -L, L, -L, L, 0);
  if (rh.count > 0 && rh.count < r.count) pass++; else { fail++; console.log("FAIL NaN handling", rh.count, r.count); }
})();

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
