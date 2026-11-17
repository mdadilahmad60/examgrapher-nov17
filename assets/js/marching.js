/* ExamGrapher marching tetrahedra: extracts the surface F(x, y, z) = iso from a scalar field sampled on a regular grid.
   Pure maths, no DOM. Each cube is split into 6 tetrahedra (Kuhn split, all sharing the 0-6 diagonal), so neighbouring cubes
   agree on every shared face and the mesh has no cracks. Used by assets/js/surface3d.js; tested by scripts/test-surface.js. */
(function (root) {
  "use strict";

  // cube corners: 0:(0,0,0) 1:(1,0,0) 2:(1,1,0) 3:(0,1,0) 4:(0,0,1) 5:(1,0,1) 6:(1,1,1) 7:(0,1,1)
  var CORNER = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
  var TETS = [[0, 1, 2, 6], [0, 1, 5, 6], [0, 3, 2, 6], [0, 3, 7, 6], [0, 4, 5, 6], [0, 4, 7, 6]];
  var MAX_TRIS = 250000;

  /**
   * F: Float32Array/Float64Array of nx*ny*nz values, index (k * ny + j) * nx + i (i = x, j = y, k = z). NaN marks "no value".
   * Returns { pos: Float32Array (9 numbers per triangle, world coordinates), count: triangles, truncated: bool }.
   * A point is "inside" when F < iso.
   */
  function marchTetra(F, nx, ny, nz, x0, x1, y0, y1, z0, z1, iso) {
    iso = iso || 0;
    var pos = new Float32Array(9 * 4096), n = 0, truncated = false;
    var dx = (x1 - x0) / (nx - 1), dy = (y1 - y0) / (ny - 1), dz = (z1 - z0) / (nz - 1);
    var vi = [0, 0, 0, 0], vv = [0, 0, 0, 0], vx = [0, 0, 0, 0], vy = [0, 0, 0, 0], vz = [0, 0, 0, 0];

    // write one triangle from three edge points (each [x, y, z])
    function tri(p, q, r) {
      if (n >= MAX_TRIS) { truncated = true; return; }
      if ((n + 1) * 9 > pos.length) { var g = new Float32Array(pos.length * 2); g.set(pos); pos = g; }
      var o = n * 9;
      pos[o] = p[0]; pos[o + 1] = p[1]; pos[o + 2] = p[2];
      pos[o + 3] = q[0]; pos[o + 4] = q[1]; pos[o + 5] = q[2];
      pos[o + 6] = r[0]; pos[o + 7] = r[1]; pos[o + 8] = r[2];
      n++;
    }
    // point on the edge between tetra vertices a and b; endpoints are ordered by grid index so both neighbours compute identical numbers
    function edge(a, b) {
      if (vi[a] > vi[b]) { var t = a; a = b; b = t; }
      var fa = vv[a], fb = vv[b], u = (iso - fa) / (fb - fa);
      return [vx[a] + (vx[b] - vx[a]) * u, vy[a] + (vy[b] - vy[a]) * u, vz[a] + (vz[b] - vz[a]) * u];
    }

    var i, j, k, t, c, tet, inside, cnt, a, b, d, e, idx;
    for (k = 0; k < nz - 1; k++) for (j = 0; j < ny - 1; j++) for (i = 0; i < nx - 1; i++) {
      // quick reject: all 8 corners on the same side (or any NaN) cannot cross the surface
      var anyIn = false, anyOut = false, bad = false;
      for (c = 0; c < 8; c++) {
        var f = F[((k + CORNER[c][2]) * ny + (j + CORNER[c][1])) * nx + (i + CORNER[c][0])];
        if (f !== f) { bad = true; break; }
        if (f < iso) anyIn = true; else anyOut = true;
      }
      if (!bad && !(anyIn && anyOut)) continue;
      for (t = 0; t < 6; t++) {
        tet = TETS[t]; inside = 0; cnt = 0; bad = false;
        for (c = 0; c < 4; c++) {
          var cr = CORNER[tet[c]], ci = i + cr[0], cj = j + cr[1], ck = k + cr[2];
          idx = (ck * ny + cj) * nx + ci;
          vi[c] = idx; vv[c] = F[idx];
          if (vv[c] !== vv[c]) { bad = true; break; }
          vx[c] = x0 + ci * dx; vy[c] = y0 + cj * dy; vz[c] = z0 + ck * dz;
          if (vv[c] < iso) { inside |= 1 << c; cnt++; }
        }
        if (bad || cnt === 0 || cnt === 4) continue;
        if (cnt === 1 || cnt === 3) {
          // one vertex alone on its side: a single triangle cut off that corner
          var lone = 0;
          for (c = 0; c < 4; c++) if (((inside >> c) & 1) === (cnt === 1 ? 1 : 0)) lone = c;
          var o1 = [], q = 0;
          for (c = 0; c < 4; c++) if (c !== lone) o1[q++] = c;
          tri(edge(lone, o1[0]), edge(lone, o1[1]), edge(lone, o1[2]));
        } else {
          // two against two: a quad, split into two triangles
          var ins = [], out = [];
          for (c = 0; c < 4; c++) ((inside >> c) & 1 ? ins : out).push(c);
          a = ins[0]; b = ins[1]; d = out[0]; e = out[1];
          var p1 = edge(a, d), p2 = edge(a, e), p3 = edge(b, e), p4 = edge(b, d);
          tri(p1, p2, p3); tri(p1, p3, p4);
        }
      }
    }
    return { pos: pos.subarray(0, n * 9), count: n, truncated: truncated };
  }

  var EGMarch = { tetra: marchTetra, MAX_TRIS: MAX_TRIS };
  root.EGMarch = EGMarch;
  if (typeof module !== "undefined" && module.exports) module.exports = EGMarch;
})(typeof window !== "undefined" ? window : globalThis);
