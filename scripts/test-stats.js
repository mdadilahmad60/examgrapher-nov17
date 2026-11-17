// Checks assets/js/stats.js against reference values computed with SciPy 1.18. Run: node scripts/test-stats.js
const S = require("../assets/js/stats.js");
let pass = 0, fail = 0;
function near(name, got, want, tol) {
  tol = tol || 1e-9;
  const err = Math.abs(got - want) / Math.max(1, Math.abs(want));
  if (err <= tol) pass++; else { fail++; console.log("FAIL", name, "got", got, "want", want); }
}
[[-8, 6.220960574271785e-16], [-1.96, 0.024997895148220435], [0, 0.5], [1.5, 0.9331927987311419], [2.576, 0.995002467684273]].forEach(r => near("normCdf " + r[0], S.normCdf(r[0]), r[1], 1e-12));
[[0.025, -1.959963984540054], [0.9, 1.2815515655446004], [0.975, 1.959963984540054], [0.995, 2.5758293035489004]].forEach(r => near("normInv " + r[0], S.normInv(r[0]), r[1], 1e-9));
near("t crit 35 df", S.tInv(0.975, 35), 2.030107928250343, 1e-9);
near("t crit 5 df", S.tInv(0.975, 5), 2.5705818366147395, 1e-9);
const a = [23, 25, 28, 30, 26, 27, 24, 29], b = [20, 22, 25, 24, 21, 23, 26, 22];
const da = S.describe(a), db = S.describe(b), A = { n: 8, mean: da.mean, sd: da.sdSample }, B = { n: 8, mean: db.mean, sd: db.sdSample };
const w = S.tTest({ type: "welch", alt: "two", alpha: 0.05, a: A, b: B });
near("welch t", w.t, 3.2222222222222223); near("welch p", w.p, 0.006377859865768154); near("welch df", w.df, 13.535809018567637);
const p = S.tTest({ type: "paired", alt: "two", alpha: 0.05, a: (() => { const d = S.describe(a.map((v, i) => v - b[i])); return { n: d.n, mean: d.mean, sd: d.sdSample }; })() });
near("paired t", p.t, 3.7663698927050033); near("paired p", p.p, 0.007016160029697741);
const c = S.ciMean({ mean: 52.4, sd: 6.8, n: 36, level: 0.95, known: false });
near("ci lo", c.lo, 50.09921101464961); near("ci hi", c.hi, 54.700788985350385);
const sd = S.describe([4, 8, 6, 5, 3, 7, 9, 5]);
near("sample sd", sd.sdSample, 2.03100960115899); near("pop sd", sd.sdPop, 1.899835519196333);
// chi-square (SciPy: chisquare, chi2_contingency with correction=False, chi2.sf/pdf)
const g = S.chiGof([5, 8, 9, 8, 10, 20], [10, 10, 10, 10, 10, 10]);
near("gof chi", g.chi, 13.4); near("gof p", g.p, 0.01990522033477438); near("gof df", g.df, 5);
const g2 = S.chiGof([18, 22, 10], [20, 20, 10]); near("gof custom chi", g2.chi, 0.4); near("gof custom p", g2.p, 0.8187307530779818);
const i2 = S.chiIndep([[30, 20], [20, 30]]); near("2x2 chi", i2.chi, 4); near("2x2 p", i2.p, 0.04550026389635857); near("2x2 df", i2.df, 1);
const i3 = S.chiIndep([[12, 18, 25], [20, 15, 10]]); near("2x3 chi", i3.chi, 7.779089597271417); near("2x3 p", i3.p, 0.020454654905891503); near("2x3 V", i3.v, 0.27891019338259077);
near("chi sf 0.5,1", S.chiUpper(0.5, 1), 0.47950012218695337); near("chi sf 30,12", S.chiUpper(30, 12), 0.0027924293327009145);
near("chi pdf 3,4", S.chiPdf(3, 4), 0.1673476201113224); near("chi pdf 0.5,1", S.chiPdf(0.5, 1), 0.43939128946772243);
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
