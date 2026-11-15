/* Bola Api Arena — dekorasi arena tambahan, bagian kedua: atap kota, hutan bambu, GOR futsal, anjungan lepas pantai, stadion utama. */
(function (root) {
  'use strict';
  var BA = root.BA, U = BA.U, D = BA.D, R3 = BA.R3, F = D.FIELD, THREE = root.THREE, Arena = BA.Arena;
  if (!Arena || !Arena.H || !Arena.H2 || !THREE) return;
  var H = Arena.H, K = Arena.H2, tg = H.tg, bar = H.bar, merge = H.merge, DECO = Arena.DECO;
  var box = K.box, cyl = K.cyl, cone = K.cone, ball = K.ball, hip = K.hip, add = K.add, lights = K.lights, glow = K.glow, sea = K.sea, ext = K.ext, big = K.big, windowTex = K.windowTex, boxUV = K.boxUV;
  var PI = Math.PI;

  /* segi empat dari empat titik (urutan berlawanan jarum jam dilihat dari sisi depan); UV mengikuti ukuran bila ru/rv diisi */
  function quad(a, b, c, d, ru, rv) {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]], 3));
    var w = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), h = Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
    var u = ru ? w / ru : 1, v = rv ? h / rv : 1;
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, v], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals();
    return g;
  }
  /* gabung geometri dengan warna per bagian (dipakai rumpun bambu) */
  function mergeC(list) {
    var pos = [], nor = [], col = [], idx = [], off = 0, c = new THREE.Color();
    list.forEach(function (it) {
      var g = it[0]; c.set(it[1]);
      var p = g.attributes.position, n = g.attributes.normal, i;
      for (i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(c.r, c.g, c.b); }
      if (g.index) for (i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off); else for (i = 0; i < p.count; i++) idx.push(i + off);
      off += p.count; g.dispose();
    });
    var out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    out.setIndex(idx);
    return out;
  }
  /* tribun bertingkat di kedua sisi panjang (dan ujung bila ends) + kursi dua warna */
  function tiers(A, o) {
    var con = [], sa = [], sb = [];
    [-1, 1].forEach(function (k) {
      for (var r = 0; r < o.rows; r++) {
        var yy = o.y0 + o.h * (r + 1), zz = k * (o.z0 + 0.5 + r * o.step);
        con.push(box(o.LL, o.h * (r + 1), o.step, 0, o.y0 + o.h * (r + 1) / 2, zz));
        (r % 2 ? sa : sb).push(box(o.LL - 0.4, 0.12, 0.42, 0, yy + 0.06, zz + k * 0.2));
        if (o.ends) {
          var xx = k * (o.x0 + 0.5 + r * o.step);
          con.push(box(o.step, o.h * (r + 1), o.LW, xx, o.y0 + o.h * (r + 1) / 2, 0));
          (r % 2 ? sa : sb).push(box(0.42, 0.12, o.LW - 0.4, xx + k * 0.2, yy + 0.06, 0));
        }
      }
    });
    add(A, con, o.con || '#8e8a84', { recv: 1 }); add(A, sa, o.ca || '#d62828'); add(A, sb, o.cb || '#1d3557');
  }

  /* ======================================================================
     6. ATAP KOTA — lapangan di atap gedung, dikelilingi pencakar langit & reklame
     ====================================================================== */
  DECO.atap = function (A, rnd, q, tk) {
    var e = ext(A, 9), G = A.group, night = tk === 'malam', dusk = tk === 'senja' || night;
    if (A.outer) A.outer.visible = false;
    var GY = -90;
    /* pelat atap, tembok tepi, badan gedung */
    add(A, [box(e.x * 2, 1.2, e.z * 2, 0, -0.62, 0)], A.surf ? A.surf.out : '#4a4d54', { recv: 1 });
    var par = [box(e.x * 2 + 0.6, 1.15, 0.45, 0, 0.55, -e.z), box(e.x * 2 + 0.6, 1.15, 0.45, 0, 0.55, e.z), box(0.45, 1.15, e.z * 2, -e.x, 0.55, 0), box(0.45, 1.15, e.z * 2, e.x, 0.55, 0)];
    add(A, par, '#7b7f87');
    var lit = night ? ['#ffe9a8', '#ffd27a', '#fff6d8', '#bfe3ff'] : (dusk ? ['#ffd9a0', '#ffc070'] : ['#9cc4e6', '#b9d8f0']);
    var texs = [0, 1, 2].map(function (i) { return windowTex(A, night ? ['#151a26', '#1b2130', '#10141e'][i] : ['#6c7885', '#7f8a94', '#5b6672'][i], lit, night ? '#0a0d14' : '#33414f', 6, 8, night ? [0.42, 0.3, 0.5][i] : (dusk ? 0.25 : 0.55), 11 + i * 7); });
    var Mat = night ? THREE.MeshBasicMaterial : THREE.MeshLambertMaterial;
    var own = new THREE.Mesh(boxUV(e.x * 2 - 0.5, -GY, e.z * 2 - 0.5, 0, GY / 2 - 1.2, 0, 9, 9), new Mat({ map: texs[0] })); G.add(own);
    /* kota di bawah */
    var ct = R3.canvasTex(256, 256, function (x, w, h) {
      x.fillStyle = night ? '#080a12' : '#59616b'; x.fillRect(0, 0, w, h);
      var r = U.rng(31), i;
      x.strokeStyle = night ? 'rgba(255,190,110,0.5)' : 'rgba(40,44,50,0.6)'; x.lineWidth = 3;
      for (i = 0; i < 5; i++) { x.beginPath(); x.moveTo(0, i * 52 + 20); x.lineTo(w, i * 52 + 20); x.stroke(); x.beginPath(); x.moveTo(i * 52 + 30, 0); x.lineTo(i * 52 + 30, h); x.stroke(); }
      for (i = 0; i < 700; i++) { x.fillStyle = night ? ['#ffd27a', '#fff3c9', '#ff8a5c', '#9fd0ff'][i % 4] : ['#8b949e', '#a3adb7', '#6f7a85'][i % 3]; x.globalAlpha = 0.4 + r() * 0.6; var sz = night ? 1 + r() * 1.6 : 4 + r() * 10; x.fillRect(r() * w, r() * h, sz, sz); }
      x.globalAlpha = 1;
    }, { repeat: [9, 9] });
    var city = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500), new THREE.MeshBasicMaterial({ map: ct })); city.rotation.x = -PI / 2; city.position.y = GY; G.add(city);
    /* pencakar langit: cincin gedung dengan tinggi beragam */
    var lists = [[], [], []], tops = [], N = q === 0 ? 22 : 34;
    for (var i = 0; i < N; i++) {
      var a = i / N * PI * 2 + (rnd() - 0.5) * 0.12, w = 16 + rnd() * 20, d = 16 + rnd() * 20;
      var dist = Math.max(e.x, e.z) + 34 + rnd() * 110, x = Math.cos(a) * dist * 1.25, z = Math.sin(a) * dist;
      var top = -22 + rnd() * rnd() * 120;
      if (Math.abs(z) < e.z + 40 && Math.abs(x) < e.x + 30) continue;
      if (z > 0 && z < e.z + 60) top = Math.min(top, 6);
      var hh = top - GY;
      lists[i % 3].push(boxUV(w, hh, d, x, GY + hh / 2, z, 8, 8));
      if (top > 34) tops.push([x, top + 3.2, z, '#ff3b30']);
    }
    lists.forEach(function (l, k) { if (l.length) { var m = new THREE.Mesh(merge(l), new Mat({ map: texs[k] })); G.add(m); } });
    if (tops.length) { var tl = lights(A, tops, 3.2); A.updaters.push(function (dt, t) { tl.material.opacity = Math.sin(t * 2.4) > 0 ? 1 : 0.15; }); }
    /* papan reklame di atas gedung tetangga (sisi jauh & ujung) */
    var bbs = [[-F.L * 0.3, 9, -(e.z + 44), 0], [F.L * 0.36, 14, -(e.z + 52), 0], [e.x + 46, 8, -F.W * 0.1, -PI / 2]];
    var frame = [], under = [];
    bbs.forEach(function (b, k) {
      var pl = new THREE.Mesh(new THREE.PlaneGeometry(18, 7), new THREE.MeshBasicMaterial({ map: H.adTex(k * 2 + 1) }));
      pl.position.set(b[0], b[1] + 5, b[2]); pl.rotation.y = b[3]; G.add(pl);
      var dx = Math.cos(b[3]), dz = -Math.sin(b[3]);
      frame.push(tg(new THREE.BoxGeometry(18.6, 7.6, 0.3), b[0] - Math.sin(b[3]) * 0.2, b[1] + 5, b[2] - Math.cos(b[3]) * 0.2, 0, b[3], 0));
      [-6, 6].forEach(function (o) { frame.push(cyl(0.18, 0.18, 2, b[0] + dx * o, b[1] + 0.9, b[2] + dz * o, 6)); });
      under.push(boxUV(24, b[1] - GY, 16, b[0] - Math.sin(b[3]) * 4, GY + (b[1] - GY) / 2, b[2] - Math.cos(b[3]) * 4, 8, 8));
      if (dusk) glow(A, b[0], b[1] + 5, b[2], ['#ff7ad9', '#7ad7ff', '#ffe27a'][k], 26, 0.22);
    });
    add(A, frame, '#22262c');
    G.add(new THREE.Mesh(merge(under), new Mat({ map: texs[1] })));
    /* perlengkapan atap: tandon air, unit AC, rumah tangga, antena */
    var fz = -(e.z - 2.2), prop = [], dark = [], tank = [];
    [-1, 1].forEach(function (s) { tank.push(cyl(1.1, 1.1, 2, s * (e.x - 3), 2.4, fz, 12), cone(1.1, 0.5, s * (e.x - 3), 3.65, fz, 12)); prop.push(box(2.4, 0.2, 2.4, s * (e.x - 3), 1.35, fz)); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (p) { prop.push(cyl(0.07, 0.07, 1.3, s * (e.x - 3) + p[0], 0.65, fz + p[1], 5)); }); });
    for (var c2 = -3; c2 <= 3; c2++) { if (c2 === 0) continue; var ax = c2 * (F.L / 9); prop.push(box(1.5, 1, 0.8, ax, 0.5, fz)); dark.push(cyl(0.34, 0.34, 0.06, ax, 0.5, fz + 0.42, 10, PI / 2)); }
    prop.push(box(3.6, 2.7, 3.2, -e.x + 3.2, 1.35, e.z - 3)); dark.push(box(1, 2, 0.1, -e.x + 3.2, 1, e.z - 4.65));
    var mx = e.x - 2.5, mz = e.z - 2.5;
    for (var k2 = 0; k2 < 5; k2++) { dark.push(bar(mx - 0.5, k2 * 2, mz, mx + 0.5, k2 * 2 + 2, mz, 0.04, 4), bar(mx + 0.5, k2 * 2, mz, mx - 0.5, k2 * 2 + 2, mz, 0.04, 4)); }
    dark.push(cyl(0.06, 0.06, 10, mx - 0.5, 5, mz, 5), cyl(0.06, 0.06, 10, mx + 0.5, 5, mz, 5), cyl(0.03, 0.03, 3, mx, 11.5, mz, 4));
    add(A, prop, '#b9bec6'); add(A, dark, '#2a2e35'); add(A, tank, '#e8792a');
    var bl = lights(A, [[mx, 13.1, mz, '#ff2d2d']], 2.2); A.updaters.push(function (dt, t) { bl.material.opacity = Math.sin(t * 3) > 0.2 ? 1 : 0.1; });
    if (night) glow(A, 0, GY + 30, -420, '#ff9a5c', 520, 0.18);
  };

  /* ======================================================================
     7. HUTAN BAMBU — rumpun bambu tinggi bergoyang, saung, daun berguguran
     ====================================================================== */
  DECO.bambu = function (A, rnd, q, tk) {
    var e = ext(A, 0), G = A.group, uT = { value: 0 };
    function clump(h, seed) {
      var r = U.rng(seed), parts = [], n = 3;
      for (var i = 0; i < n; i++) {
        var ox = (r() - 0.5) * 1.1, oz = (r() - 0.5) * 1.1, hh = h * (0.75 + r() * 0.3), lean = (r() - 0.5) * 0.09;
        var cg = new THREE.CylinderGeometry(0.055, 0.1, hh, 5, 3); cg.translate(0, hh / 2, 0); cg.rotateZ(lean); cg.translate(ox, 0, oz);
        parts.push([cg, i % 2 ? '#a9b862' : '#8fa650']);
        for (var l = 0; l < 3; l++) {
          var ly = hh * (0.55 + l * 0.17), lg = new THREE.IcosahedronGeometry(1, 0);
          lg.scale(0.9 + r() * 0.7, 0.42, 0.7 + r() * 0.5); lg.rotateZ((r() - 0.5) * 0.8); lg.translate(ox - Math.sin(lean) * ly + (r() - 0.5) * 1.3, ly, oz + (r() - 0.5) * 1.3);
          parts.push([lg, l % 2 ? '#4e8a33' : '#62a03e']);
        }
      }
      return mergeC(parts);
    }
    var mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.uTime = uT;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n#ifdef USE_INSTANCING\n  float bph = instanceMatrix[3][0] * 0.31 + instanceMatrix[3][2] * 0.23;\n  float bsw = (sin(uTime * 1.3 + bph) + 0.5 * sin(uTime * 2.9 + bph * 1.7)) * 0.0035 * transformed.y * transformed.y;\n  transformed.x += bsw; transformed.z += bsw * 0.5;\n#endif');
    };
    mat.customProgramCacheKey = function () { return 'bamboo-sway'; };
    A.disposables.push(mat);
    var total = [150, 300, 420][q] * (big() ? 1.3 : 1), spots = [[], [], []], tries = 0;
    var X = e.x + 70, Z = e.z + 70;
    while (spots[0].length + spots[1].length + spots[2].length < total && tries++ < total * 30) {
      var x = (rnd() * 2 - 1) * X, z = (rnd() * 2 - 1) * Z;
      var ax = Math.abs(x) - e.x, az = Math.abs(z) - e.z, out = Math.max(ax, az);
      if (out < (big() ? 9.5 : 6)) continue;
      /* dekat lapangan hanya rumpun jarang; makin jauh makin rapat (kamera tetap lega) */
      var dense = az >= 30 || ax >= 24;
      if (!dense && rnd() > 0.1) continue;
      spots[Math.floor(rnd() * 3)].push([x, z, rnd() * PI * 2, 0.8 + rnd() * 0.5]);
    }
    var m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), ee = new THREE.Euler(), ps = new THREE.Vector3(), ss = new THREE.Vector3();
    [11, 13.5, 16].forEach(function (h, k) {
      if (!spots[k].length) return;
      var im = new THREE.InstancedMesh(clump(h, 40 + k * 9), mat, spots[k].length);
      spots[k].forEach(function (s, i) { ee.set(0, s[2], 0); qq.setFromEuler(ee); ps.set(s[0], 0, s[1]); ss.set(s[3], s[3], s[3]); m4.compose(ps, qq, ss); im.setMatrixAt(i, m4); });
      im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; G.add(im);
    });
    /* saung beratap rumbia + batu-batu */
    var sx = -F.L / 2 - 5, sz = -(e.z + (big() ? 9 : 6));
    var wood = [box(4.2, 0.18, 3.2, sx, 0.9, sz)], th = [hip(5.4, 1.9, 4.4, sx, 3.1, sz)];
    [[-1.9, -1.4], [1.9, -1.4], [-1.9, 1.4], [1.9, 1.4]].forEach(function (p) { wood.push(cyl(0.08, 0.08, 3.1, sx + p[0], 1.55, sz + p[1], 5)); });
    wood.push(box(4.2, 0.08, 0.08, sx, 1.6, sz - 1.4), box(0.08, 0.08, 3.2, sx - 1.9, 1.6, sz));
    add(A, wood, '#b89a5e'); add(A, th, '#8a7a48');
    var rocks = [];
    for (var i = 0; i < 16; i++) { var s2 = i % 2 ? 1 : -1, rs = 0.4 + rnd() * 0.9; rocks.push(tg(new THREE.DodecahedronGeometry(1, 0), s2 * (e.x + 3 + rnd() * 14), rs * 0.3, (rnd() - 0.5) * (F.W + 30), rnd() * 3, rnd() * 3, 0, rs, rs * 0.6, rs)); }
    add(A, rocks, '#77736a');
    /* daun bambu berguguran */
    var n = q === 0 ? 30 : 70, lp = new Float32Array(n * 3), ld = [];
    for (i = 0; i < n; i++) ld.push({ x: (rnd() - 0.5) * (F.L + 30), z: (rnd() - 0.5) * (F.W + 30), t: rnd(), v: 0.05 + rnd() * 0.05, ph: rnd() * 6 });
    var lg2 = new THREE.BufferGeometry(); lg2.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    var leaves = new THREE.Points(lg2, new THREE.PointsMaterial({ color: 0xb7c86a, size: 0.16, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false })); leaves.frustumCulled = false; G.add(leaves);
    A.updaters.push(function (dt, t) {
      var wv = A.windMag || 1;
      uT.value = t * (0.8 + 0.4 * wv);
      for (var k = 0; k < n; k++) { var o = ld[k]; o.t += o.v * dt; if (o.t > 1) o.t -= 1; lp[k * 3] = o.x + Math.sin(t * 0.9 + o.ph) * 1.5 + o.t * 4 * wv; lp[k * 3 + 1] = 12 * (1 - o.t); lp[k * 3 + 2] = o.z + Math.cos(t * 0.7 + o.ph) * 1.2; }
      lg2.attributes.position.needsUpdate = true;
    });
    H.treeLine(A, rnd, '#3d6a33');
    void tk;
  };

  /* ======================================================================
     8. GOR FUTSAL — gedung dalam ruangan: dinding, rangka atap, lampu gantung, tribun
     ====================================================================== */
  DECO.gor = function (A, rnd, q, tk) {
    var G = A.group, wz = A.fenceZ || F.W / 2 + 1.2, wx = A.fenceX || F.L / 2 + 1.5;
    var SR = (A.standRows && A.standRows.n) || 10, z0 = (A.standRows && A.standRows.z0) || wz + 3.2, step = 1, h = 0.55;
    var hx = wx + 19, hz = z0 + SR * step + 9, WH = 15.5, RH = 19.5;
    /* cahaya dalam ruangan: lampu dari atas, bayangan tepat di bawah pemain */
    if (A.sunDir) { A.sunDir.set(0.12, 1, 0.22).normalize(); A.sun.position.copy(A.sunDir).multiplyScalar(60); }
    if (A.hemi) { A.hemi.color.set('#f6f8fb'); A.hemi.groundColor.set('#8a7458'); A.hemi.intensity = 0.42; A.baseHemi = 0.42; }
    if (A.sun) { A.sun.intensity = 0.62; A.baseSun = 0.62; }
    /* dinding: bagian bawah berwarna, atas terang, deretan jendela tinggi */
    var wt = R3.canvasTex(512, 256, function (x, w, hh) {
      x.fillStyle = '#e4e8eb'; x.fillRect(0, 0, w, hh);
      x.fillStyle = '#2d5f8a'; x.fillRect(0, hh * 0.62, w, hh * 0.38);
      x.fillStyle = '#f2a23a'; x.fillRect(0, hh * 0.6, w, hh * 0.035);
      for (var i = 0; i < 8; i++) { x.fillStyle = '#f7fcff'; x.fillRect(i * 64 + 12, hh * 0.07, 40, hh * 0.2); x.strokeStyle = '#9aa7b3'; x.lineWidth = 3; x.strokeRect(i * 64 + 12, hh * 0.07, 40, hh * 0.2); x.beginPath(); x.moveTo(i * 64 + 32, hh * 0.07); x.lineTo(i * 64 + 32, hh * 0.27); x.stroke(); }
      x.fillStyle = 'rgba(0,0,0,0.08)'; for (i = 0; i < 16; i++) x.fillRect(i * 32, hh * 0.32, 2, hh * 0.28);
    }, { repeat: [1, 1] });
    wt.wrapS = THREE.RepeatWrapping;
    var wall = [quad([-hx, 0, -hz], [hx, 0, -hz], [hx, WH, -hz], [-hx, WH, -hz], 26, 0), quad([hx, 0, hz], [-hx, 0, hz], [-hx, WH, hz], [hx, WH, hz], 26, 0),
      quad([-hx, 0, hz], [-hx, 0, -hz], [-hx, WH, -hz], [-hx, WH, hz], 26, 0), quad([hx, 0, -hz], [hx, 0, hz], [hx, WH, hz], [hx, WH, -hz], 26, 0)];
    G.add(new THREE.Mesh(merge(wall), new THREE.MeshLambertMaterial({ map: wt })));
    /* atap pelana (sisi dalam) + segitiga dinding ujung */
    var roof = [quad([-hx, WH, -hz], [hx, WH, -hz], [hx, RH, 0], [-hx, RH, 0]), quad([hx, WH, hz], [-hx, WH, hz], [-hx, RH, 0], [hx, RH, 0])];
    [-1, 1].forEach(function (s) {
      var tgm = new THREE.BufferGeometry(), pts = s < 0 ? [-hx, WH, hz, -hx, WH, -hz, -hx, RH, 0] : [hx, WH, -hz, hx, WH, hz, hx, RH, 0];
      tgm.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); tgm.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2)); tgm.computeVertexNormals();
      roof.push(tgm);
    });
    add(A, roof, '#c3cad1');
    /* rangka baja atap + lampu gantung */
    var truss = [], lampG = [], lampP = [], nx = Math.max(4, Math.round(hx * 2 / 8));
    for (var i = 0; i <= nx; i++) {
      var x = -hx + i * 2 * hx / nx;
      truss.push(bar(x, WH - 0.5, -hz, x, RH - 0.5, 0, 0.11, 5), bar(x, RH - 0.5, 0, x, WH - 0.5, hz, 0.11, 5), bar(x, WH - 1.6, -hz, x, WH - 1.6, hz, 0.09, 5));
      for (var j = -3; j <= 3; j++) { var zz = j * hz / 3.5, yt = WH - 0.5 + (RH - WH) * (1 - Math.abs(zz) / hz); truss.push(bar(x, WH - 1.6, zz, x, yt, zz + (j % 2 ? 1.6 : -1.6), 0.06, 4)); }
      if (i > 0 && i < nx) [-0.62, -0.22, 0.22, 0.62].forEach(function (f) { lampG.push(box(1.7, 0.16, 0.6, x, WH - 2.1, f * hz)); lampP.push([x, WH - 2.3, f * hz, '#ffffff']); });
    }
    [-hz * 0.5, 0, hz * 0.5].forEach(function (zz) { truss.push(bar(-hx, WH - 1.6, zz, hx, WH - 1.6, zz, 0.08, 5)); });
    add(A, truss, '#6f7883');
    G.add(new THREE.Mesh(merge(lampG), R3.basic('#fffdf2')));
    lights(A, lampP, 5.5, { op: 0.55 });
    /* tribun beton di kedua sisi panjang + pagar depan */
    var LL = F.L * 0.92;
    tiers(A, { rows: SR, y0: 0, h: h, step: step, z0: z0, LL: LL, con: '#a39e96', ca: '#e2572b', cb: '#2b6fb0' });
    var rail = [];
    [-1, 1].forEach(function (k) { rail.push(bar(-LL / 2, 1.0, k * (z0 - 0.15), LL / 2, 1.0, k * (z0 - 0.15), 0.04, 5)); for (var px = -LL / 2; px <= LL / 2 + 0.01; px += 3) rail.push(cyl(0.035, 0.035, 1, px, 0.5, k * (z0 - 0.15), 5)); rail.push(box(LL, 3.4, 0.4, 0, h * SR + 1.7, k * (z0 + SR * step + 0.4))); });
    add(A, rail, '#d7dbe0');
    /* papan skor di dinding ujung & spanduk */
    var st = H.textTex(512, 192, '#10131a', '#ffcf3a', ['BOLA API ARENA', 'GOR FUTSAL']);
    var sp = new THREE.Mesh(new THREE.PlaneGeometry(13, 4.8), new THREE.MeshBasicMaterial({ map: st })); sp.position.set(hx - 0.3, 9.5, 0); sp.rotation.y = -PI / 2; G.add(sp);
    add(A, [box(0.3, 5.4, 13.8, hx - 0.15, 9.5, 0)], '#20242c');
    var bt = H.textTex(1024, 96, '#b5121b', '#ffffff', ['SPORTIVITAS  •  SEMANGAT  •  FAIR PLAY']);
    [-1, 1].forEach(function (k) { var b = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(46, hx * 1.2), 2), new THREE.MeshLambertMaterial({ map: bt })); b.position.set(0, 9.2, k * (hz - 0.15)); b.rotation.y = k > 0 ? PI : 0; G.add(b); });
    /* ring basket dilipat di kedua ujung */
    var bb = [], rim = [];
    [-1, 1].forEach(function (s) { var bx = s * (hx - 3.5); bb.push(box(0.08, 1.1, 1.8, bx, 11.5, 0), bar(bx, 12, 0, s * (hx - 0.3), 14.5, 0, 0.08, 5), bar(bx, 11.2, 0, s * (hx - 0.3), 9.8, 0, 0.06, 5)); rim.push(tg(new THREE.TorusGeometry(0.23, 0.025, 5, 12), bx - s * 0.3, 11.15, 0, PI / 2)); });
    add(A, bb, '#f1f3f5'); add(A, rim, '#e8590c');
    void rnd; void q; void tk;
  };

  /* ======================================================================
     9. ANJUNGAN LEPAS PANTAI — geladak baja di tengah laut: menara bor, suar, helipad, derek
     ====================================================================== */
  DECO.anjungan = function (A, rnd, q, tk) {
    var e = ext(A, 9), G = A.group, night = tk === 'malam', SEA = -24;
    if (A.outer) A.outer.visible = false;
    sea(A, SEA, night ? '#0a1a2e' : (tk === 'senja' ? '#27486e' : '#1f5f86'), night ? '#4d73a6' : (tk === 'senja' ? '#ffb07e' : '#a9dcef'), 1300);
    var steel = [], darkS = [], yel = [], red = [], white = [];
    /* geladak utama + geladak bawah + kaki */
    steel.push(box(e.x * 2, 1.4, e.z * 2, 0, -0.72, 0), box(e.x * 2 - 6, 0.8, e.z * 2 - 6, 0, -8, 0));
    [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]].forEach(function (c) {
      var lx = c[0] * (e.x - 4), lz = c[1] * (e.z - 4);
      darkS.push(cyl(2, 2.3, -SEA + 2, lx, (SEA - 2) / 2, lz, 12));
      if (c[0] !== 0) darkS.push(bar(lx, -1.4, lz, lx, -8, lz * 0.2, 0.3, 6), bar(lx, -8, lz, lx * 0.15, -16, lz, 0.35, 6), bar(lx, -16, lz, lx, SEA, lz * 0.3, 0.35, 6));
    });
    [-1, 1].forEach(function (k) { darkS.push(bar(-(e.x - 4), -12, k * (e.z - 4), e.x - 4, -12, k * (e.z - 4), 0.4, 6), bar(k * (e.x - 4), -12, -(e.z - 4), k * (e.x - 4), -12, e.z - 4, 0.4, 6)); });
    /* pagar kuning keliling geladak */
    var rz = e.z - 0.3, rx = e.x - 0.3;
    [[-rx, -rz, rx, -rz], [-rx, rz, rx, rz], [-rx, -rz, -rx, rz], [rx, -rz, rx, rz]].forEach(function (s) {
      [0.55, 1.1].forEach(function (y) { yel.push(bar(s[0], y, s[1], s[2], y, s[3], 0.035, 5)); });
      var len = Math.hypot(s[2] - s[0], s[3] - s[1]), n = Math.round(len / 3);
      for (var i = 0; i <= n; i++) yel.push(cyl(0.04, 0.04, 1.1, U.lerp(s[0], s[2], i / n), 0.55, U.lerp(s[1], s[3], i / n), 5));
    });
    /* modul sisi jauh: menara bor (kiri) & rumah tinggal (kanan) */
    var mz = -(e.z + 8), dxk = -F.L * 0.24, qx = F.L * 0.2;
    steel.push(box(18, 1.4, 16, dxk, -0.72, mz), box(24, 1.4, 14, qx, -0.72, mz - 1));
    darkS.push(cyl(1.6, 1.8, -SEA, dxk, SEA / 2, mz - 4, 10), cyl(1.6, 1.8, -SEA, qx, SEA / 2, mz - 4, 10));
    var TH = 36, b0 = 5.2, b1 = 1.3, lv = 8;
    var cor = function (lvl, c) { var f = lvl / lv, w = U.lerp(b0, b1, f); return [dxk + c[0] * w, f * TH, mz + c[1] * w]; };
    var C4 = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    C4.forEach(function (c) { var p0 = cor(0, c), p1 = cor(lv, c); red.push(bar(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], 0.16, 5)); });
    for (var l = 0; l < lv; l++) for (var s = 0; s < 4; s++) {
      var a0 = cor(l, C4[s]), a1 = cor(l, C4[(s + 1) % 4]), c1 = cor(l + 1, C4[s]), c2 = cor(l + 1, C4[(s + 1) % 4]);
      (l % 2 ? white : red).push(bar(a0[0], a0[1], a0[2], a1[0], a1[1], a1[2], 0.07, 4), bar(a0[0], a0[1], a0[2], c2[0], c2[1], c2[2], 0.06, 4));
      if (q > 0) (l % 2 ? white : red).push(bar(a1[0], a1[1], a1[2], c1[0], c1[1], c1[2], 0.06, 4));
    }
    darkS.push(box(3.4, 1.6, 3.4, dxk, TH + 0.8, mz), cyl(0.12, 0.12, TH - 4, dxk, TH / 2 - 1, mz, 6), box(6, 3, 5, dxk, 1.5, mz + 3));
    var beacon = lights(A, [[dxk, TH + 2.2, mz, '#ff2d2d'], [qx + 13, 12.2, mz - 1, '#ff2d2d']], 3);
    /* rumah tinggal bertingkat + sekoci */
    var qt = windowTex(A, '#eef0f1', night ? ['#ffe9a8', '#fff6d8'] : ['#6f8aa3', '#88a2b8'], '#3b4a59', 8, 4, night ? 0.6 : 0.9, 21);
    var qm = new THREE.Mesh(boxUV(22, 7.6, 9, qx, 3.8, mz - 1.5, 11, 3.8), new THREE.MeshLambertMaterial({ map: qt })); G.add(qm);
    white.push(box(23, 0.3, 10, qx, 7.75, mz - 1.5), cyl(0.05, 0.05, 4.4, qx + 13, 9.9, mz - 1, 5));
    var boatO = [ball(1.15, qx - 12.6, 3.4, mz + 1, 2.4, 1, 1, 8), ball(1.15, qx - 12.6, 3.4, mz - 3.4, 2.4, 1, 1, 8)];
    add(A, boatO, '#ff7a1a');
    /* lengan suar dengan api di ujung */
    var fb0 = [e.x - 1, 0.4, -(e.z - 3)], fb1 = [e.x + 34, 17, -(e.z + 12)];
    [[0, 0.9, 0], [0, -0.5, 0.8], [0, -0.5, -0.8]].forEach(function (o) { steel.push(bar(fb0[0] + o[0], fb0[1] + o[1], fb0[2] + o[2], fb1[0] + o[0], fb1[1] + o[1], fb1[2] + o[2], 0.1, 5)); });
    for (var i2 = 0; i2 < 10; i2++) { var f0 = i2 / 10, f1 = (i2 + 1) / 10, P = function (f, o) { return [U.lerp(fb0[0], fb1[0], f), U.lerp(fb0[1], fb1[1], f) + o[0], U.lerp(fb0[2], fb1[2], f) + o[1]]; }; var u0 = P(f0, [0.9, 0]), d1 = P(f1, [-0.5, i2 % 2 ? 0.8 : -0.8]); steel.push(bar(u0[0], u0[1], u0[2], d1[0], d1[1], d1[2], 0.06, 4)); }
    var flame = [glow(A, fb1[0], fb1[1] + 1.4, fb1[2], '#ff7a1a', 9, 0.95), glow(A, fb1[0], fb1[1] + 2.8, fb1[2], '#ffd27a', 5.5, 0.9), glow(A, fb1[0], fb1[1] + 1.2, fb1[2], '#ff4a1a', 24, 0.3)];
    if (tk === 'malam' || tk === 'senja') { var fl = new THREE.PointLight(0xff8a3a, 0.55, 150, 1.4); fl.position.set(fb1[0], fb1[1] + 2, fb1[2]); G.add(fl); }
    /* helipad di ujung kiri + helikopter */
    var hx2 = -(e.x + 10.5), hy = 1.8;
    var ht = R3.canvasTex(256, 256, function (x, w, h) {
      x.fillStyle = '#2f6b55'; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#ffe14d'; x.lineWidth = 12; x.beginPath(); x.arc(w / 2, h / 2, w * 0.36, 0, 6.3); x.stroke();
      x.strokeStyle = '#ffffff'; x.lineWidth = 6; x.beginPath(); x.arc(w / 2, h / 2, w * 0.46, 0, 6.3); x.stroke();
      x.fillStyle = '#ffffff'; x.font = 'bold 130px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('H', w / 2, h / 2 + 6);
    });
    var pad = new THREE.Mesh(new THREE.CircleGeometry(9.5, 8), new THREE.MeshLambertMaterial({ map: ht })); pad.rotation.x = -PI / 2; pad.rotation.z = PI / 8; pad.position.set(hx2, hy + 0.01, 0); G.add(pad);
    steel.push(cyl(9.5, 9.2, 0.6, hx2, hy - 0.3, 0, 8), bar(hx2, hy - 0.5, -5, -(e.x - 3), -1, -7, 0.3, 6), bar(hx2, hy - 0.5, 5, -(e.x - 3), -1, 7, 0.3, 6), bar(hx2 - 3, hy - 0.5, 0, -(e.x - 4), -8, 0, 0.35, 6), box(4, 0.3, 2.4, -(e.x + 0.6), hy - 0.3, 0));
    var heli = new THREE.Group(); heli.position.set(hx2 - 0.5, hy, 0.5); heli.rotation.y = 0.6;
    heli.add(new THREE.Mesh(merge([ball(1, 0, 1.5, 0, 2.3, 1.15, 1.2, 10), cyl(0.16, 0.34, 4.4, -3.6, 1.7, 0, 6, 0, PI / 2), box(0.1, 1.3, 0.7, -5.6, 2.3, 0)]), R3.mat('#f3f3ee')));
    heli.add(new THREE.Mesh(merge([ball(0.85, 1.25, 1.55, 0, 1.2, 0.95, 1.05, 8), bar(-1.4, 0.2, 0.9, 1.6, 0.2, 0.9, 0.06, 5), bar(-1.4, 0.2, -0.9, 1.6, 0.2, -0.9, 0.06, 5), bar(-0.6, 0.2, 0.9, -0.5, 0.9, 0.5, 0.04, 4), bar(0.8, 0.2, 0.9, 0.7, 0.9, 0.5, 0.04, 4), bar(-0.6, 0.2, -0.9, -0.5, 0.9, -0.5, 0.04, 4), bar(0.8, 0.2, -0.9, 0.7, 0.9, -0.5, 0.04, 4), cyl(0.09, 0.09, 0.5, 0, 2.8, 0, 6)]), R3.mat('#22262b')));
    heli.add(new THREE.Mesh(merge([box(4.7, 0.16, 0.5, 0, 1.25, 0)]), R3.mat('#d62828')));
    var rotor = new THREE.Mesh(merge([box(8.6, 0.05, 0.32, 0, 0, 0), box(0.32, 0.05, 8.6, 0, 0, 0)]), R3.mat('#2b2f35')); rotor.position.y = 3.05; heli.add(rotor);
    G.add(heli);
    /* derek di tepi jauh kanan */
    var kx = F.L * 0.4, kz = -(e.z - 2.5);
    yel.push(cyl(0.9, 1, 9, kx, 4.5, kz, 10), box(3, 2.4, 3.2, kx, 10.2, kz));
    var bm0 = [kx, 10.6, kz - 1.2], bm1 = [kx + 9, 23, kz - 19];
    [[0.5, 0], [-0.5, 0]].forEach(function (o) { yel.push(bar(bm0[0] + o[0], bm0[1], bm0[2], bm1[0] + o[0] * 0.3, bm1[1], bm1[2], 0.12, 5)); });
    for (i2 = 0; i2 < 8; i2++) { var g0 = i2 / 8, g1 = (i2 + 1) / 8; yel.push(bar(U.lerp(bm0[0], bm1[0], g0) + 0.5 * (1 - g0 * 0.7), U.lerp(bm0[1], bm1[1], g0), U.lerp(bm0[2], bm1[2], g0), U.lerp(bm0[0], bm1[0], g1) - 0.5 * (1 - g1 * 0.7), U.lerp(bm0[1], bm1[1], g1), U.lerp(bm0[2], bm1[2], g1), 0.05, 4)); }
    darkS.push(cyl(0.03, 0.03, 9, bm1[0], bm1[1] - 4.5, bm1[2], 4), box(0.5, 0.7, 0.5, bm1[0], bm1[1] - 9.2, bm1[2]));
    /* kontainer & drum di sudut geladak (rendah) */
    var cont = [[], [], []];
    [[-(e.x - 5), -(e.z - 3), 0], [-(e.x - 5), e.z - 3, 0], [e.x - 5, e.z - 3, 0], [e.x - 6, -(e.z - 8), PI / 2], [-(e.x - 12), e.z - 3, 0]].forEach(function (p, k) { cont[k % 3].push(box(6, 2.5, 2.4, p[0], 1.25, p[1], p[2])); });
    add(A, cont[0], '#1f6aa5'); add(A, cont[1], '#b5442e'); add(A, cont[2], '#2f8f5b');
    for (i2 = 0; i2 < 6; i2++) red.push(cyl(0.3, 0.3, 0.9, e.x - 2.2 - (i2 % 3) * 0.7, 0.45, e.z - 9 - Math.floor(i2 / 3) * 0.7, 8));
    /* kantong angin di tepi helipad */
    yel.push(cyl(0.05, 0.05, 4, -(e.x - 1.2), 2, e.z - 1.2, 5));
    var sock = new THREE.Mesh(new THREE.ConeGeometry(0.4, 2.2, 8, 1, true), R3.mat('#ff6a1a', { side: 1 })); sock.geometry.rotateZ(PI / 2); sock.geometry.translate(-1.1, 0, 0); sock.position.set(-(e.x - 1.2), 4, e.z - 1.2); G.add(sock);
    add(A, steel, '#77828c', { recv: 1 }); add(A, darkS, '#3b434b'); add(A, yel, '#f2c41b'); add(A, red, '#c0392b'); add(A, white, '#eef1f3');
    /* kapal pasokan & anjungan lain di kejauhan */
    var ship = [box(46, 5, 11, 150, SEA + 2.4, -190), box(12, 9, 9, 164, SEA + 9.4, -190), box(20, 2.4, 9, 140, SEA + 6, -190)];
    add(A, ship, '#c94f3a');
    add(A, [box(30, 3, 22, -290, SEA + 18, -230), cyl(2, 2, 18, -300, SEA + 9, -238, 6), cyl(2, 2, 18, -280, SEA + 9, -222, 6), cone(5, 34, -292, SEA + 36, -230, 4)], '#56606a');
    A.updaters.push(function (dt, t) {
      rotor.rotation.y += dt * 1.4;
      var wv = A.windMag || 1, k = 1 + Math.sin(t * 17) * 0.14 + Math.sin(t * 9.3) * 0.12;
      flame[0].scale.set(9 * k, 12 * k, 1); flame[1].scale.set(5.5 * k, 8 * k, 1); flame[0].position.x = fb1[0] + Math.sin(t * 5) * 0.4 * wv; flame[1].position.x = fb1[0] + Math.sin(t * 6.1) * 0.7 * wv;
      flame[2].material.opacity = 0.24 + 0.08 * Math.sin(t * 11);
      sock.rotation.y = PI + Math.sin(t * 1.7) * 0.25; sock.rotation.z = -0.25 + Math.sin(t * 6) * 0.06 * wv;
      beacon.material.opacity = Math.sin(t * 2.6) > 0 ? 1 : 0.12;
    });
    void rnd;
  };

  /* ======================================================================
     10. STADION UTAMA — lintasan atletik, tribun dua tingkat, atap melingkar, layar raksasa
     ====================================================================== */
  DECO.gbk = function (A, rnd, q, tk) {
    var G = A.group, wz = A.fenceZ || F.W / 2 + 1.2, wx = A.fenceX || F.L / 2 + 1.5, night = tk === 'malam';
    var gap = (A.arena && A.arena.standGap) || 0;
    var SR = (A.standRows && A.standRows.n) || 10, z0 = (A.standRows && A.standRows.z0) || wz + 3.2 + gap, x0 = wx + 3.2 + gap, step = 1, h = 0.55;
    var LL = F.L * 0.92 + 8, LW = F.W * 0.9 + 8;
    /* lintasan atletik merah bata dengan garis lajur */
    var ix = F.L / 2 + 4.3, iz = F.W / 2 + 4.3, ox = x0 - 0.7, oz = z0 - 0.7, ri = 5, ro = ri + Math.min(ox - ix, oz - iz);
    var rr = function (hx, hz, r, hole) {
      var s = hole ? new THREE.Path() : new THREE.Shape();
      s.moveTo(-hx + r, -hz); s.lineTo(hx - r, -hz); s.absarc(hx - r, -hz + r, r, -PI / 2, 0, false); s.lineTo(hx, hz - r); s.absarc(hx - r, hz - r, r, 0, PI / 2, false);
      s.lineTo(-hx + r, hz); s.absarc(-hx + r, hz - r, r, PI / 2, PI, false); s.lineTo(-hx, -hz + r); s.absarc(-hx + r, -hz + r, r, PI, PI * 1.5, false);
      return s;
    };
    var shp = rr(ox, oz, ro, false); shp.holes.push(rr(ix, iz, ri, true));
    var tgeo = new THREE.ShapeGeometry(shp, 10); tgeo.rotateX(-PI / 2);
    var track = new THREE.Mesh(tgeo, R3.mat('#a8432e')); track.position.y = 0.006; track.receiveShadow = true; G.add(track);
    var lp = [], lanes = 7;
    for (var l = 1; l < lanes; l++) {
      var f = l / lanes, pts = rr(U.lerp(ix, ox, f), U.lerp(iz, oz, f), U.lerp(ri, ro, f), false).getPoints(8);
      for (var i = 0; i < pts.length; i++) { var a = pts[i], b = pts[(i + 1) % pts.length]; lp.push(a.x, 0.02, a.y, b.x, 0.02, b.y); }
    }
    var lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    G.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })));
    /* tribun bawah di empat sisi */
    tiers(A, { rows: SR, y0: 0, h: h, step: step, z0: z0, x0: x0, LL: LL, LW: LW, ends: true, con: '#8b8781', ca: '#c81e2b', cb: '#f4f4f1' });
    /* tribun atas: berundak lebih curam, mundur di belakang tribun bawah */
    var UR = 12, uh = 0.72, us = 1.1, uy = h * SR + 3.3, uz = z0 + SR * step + 1.6, ux = x0 + SR * step + 1.6, con = [], dark = [];
    [-1, 1].forEach(function (k) {
      for (var r = 0; r < UR; r++) {
        con.push(box(LL + 26, uh, us, 0, uy + uh * r + uh / 2, k * (uz + 0.55 + r * us)));
        con.push(box(us, uh, LW + 26, k * (ux + 0.55 + r * us), uy + uh * r + uh / 2, 0));
      }
      /* penyangga miring, dinding belakang, lorong */
      con.push(tg(new THREE.BoxGeometry(LL + 26, 0.5, UR * us * 1.25), 0, uy + UR * uh / 2 - 0.9, k * (uz + UR * us / 2), -k * Math.atan2(uh, us), 0, 0));
      con.push(tg(new THREE.BoxGeometry(UR * us * 1.25, 0.5, LW + 26), k * (ux + UR * us / 2), uy + UR * uh / 2 - 0.9, 0, 0, 0, k * Math.atan2(uh, us)));
      dark.push(box(LL + 30, uy + UR * uh + 5, 1, 0, (uy + UR * uh + 5) / 2, k * (uz + UR * us + 1.2)), box(1, uy + UR * uh + 5, LW + 30, k * (ux + UR * us + 1.2), (uy + UR * uh + 5) / 2, 0));
      dark.push(box(LL + 26, uy - h * SR - 0.4, 0.5, 0, h * SR + (uy - h * SR) / 2, k * (uz - 0.2)), box(0.5, uy - h * SR - 0.4, LW + 26, k * (ux - 0.2), h * SR + (uy - h * SR) / 2, 0));
    });
    add(A, con, '#8b8781'); add(A, dark, '#2a2d34');
    /* lautan penonton: tekstur titik warna di tribun atas & tribun bawah di belakang gawang */
    var crowdT = R3.canvasTex(256, 128, function (x, w, hh) {
      x.fillStyle = '#3a3d45'; x.fillRect(0, 0, w, hh);
      var r = U.rng(53), cols = ['#e63946', '#f1faee', '#ffb703', '#457b9d', '#fb8500', '#8ecae6', '#ffffff', '#d62828', '#e9c46a', '#2a9d8f'];
      for (var j = 0; j < 12; j++) for (var i = 0; i < 64; i++) { if (r() < 0.12) continue; x.fillStyle = cols[Math.floor(r() * cols.length)]; x.fillRect(i * 4 + 0.6, j * 10.6 + 2.5, 2.8, 4.2); x.fillStyle = ['#c98c55', '#e3b07c', '#8a5129'][Math.floor(r() * 3)]; x.fillRect(i * 4 + 1.1, j * 10.6 + 0.6, 1.8, 1.9); }
    }, { repeat: [1, 1] });
    crowdT.wrapS = crowdT.wrapT = THREE.RepeatWrapping;
    var cq = [], sl = Math.hypot(UR * us, UR * uh), y1 = uy + uh * 0.9, y2 = uy + UR * uh + 0.2;
    cq.push(quad([-(LL + 26) / 2, y1, -(uz + 0.3)], [(LL + 26) / 2, y1, -(uz + 0.3)], [(LL + 26) / 2, y2, -(uz + UR * us)], [-(LL + 26) / 2, y2, -(uz + UR * us)], 16, sl));
    cq.push(quad([(LL + 26) / 2, y1, uz + 0.3], [-(LL + 26) / 2, y1, uz + 0.3], [-(LL + 26) / 2, y2, uz + UR * us], [(LL + 26) / 2, y2, uz + UR * us], 16, sl));
    cq.push(quad([-(ux + 0.3), y1, (LW + 26) / 2], [-(ux + 0.3), y1, -(LW + 26) / 2], [-(ux + UR * us), y2, -(LW + 26) / 2], [-(ux + UR * us), y2, (LW + 26) / 2], 16, sl));
    cq.push(quad([ux + 0.3, y1, -(LW + 26) / 2], [ux + 0.3, y1, (LW + 26) / 2], [ux + UR * us, y2, (LW + 26) / 2], [ux + UR * us, y2, -(LW + 26) / 2], 16, sl));
    var le = Math.hypot(SR * step, SR * h);
    cq.push(quad([-(x0 + 0.3), h + 0.75, LW / 2], [-(x0 + 0.3), h + 0.75, -LW / 2], [-(x0 + SR * step), h * SR + 0.9, -LW / 2], [-(x0 + SR * step), h * SR + 0.9, LW / 2], 16, le));
    cq.push(quad([x0 + 0.3, h + 0.75, -LW / 2], [x0 + 0.3, h + 0.75, LW / 2], [x0 + SR * step, h * SR + 0.9, LW / 2], [x0 + SR * step, h * SR + 0.9, -LW / 2], 16, le));
    var cm = new THREE.Mesh(merge(cq), new THREE.MeshLambertMaterial({ map: crowdT })); G.add(cm);
    /* pita LED bergulir di bibir tribun atas */
    var ledT = H.textTex(1024, 48, '#0b3d91', '#ffffff', ['BOLA API ARENA   ★   STADION UTAMA   ★   SEPAK BOLA API   ★']);
    ledT.wrapS = THREE.RepeatWrapping;
    var lq = [quad([-(LL + 26) / 2, uy - 0.9, -(uz - 0.5)], [(LL + 26) / 2, uy - 0.9, -(uz - 0.5)], [(LL + 26) / 2, uy + 0.5, -(uz - 0.5)], [-(LL + 26) / 2, uy + 0.5, -(uz - 0.5)], 42, 0),
      quad([(LL + 26) / 2, uy - 0.9, uz - 0.5], [-(LL + 26) / 2, uy - 0.9, uz - 0.5], [-(LL + 26) / 2, uy + 0.5, uz - 0.5], [(LL + 26) / 2, uy + 0.5, uz - 0.5], 42, 0),
      quad([-(ux - 0.5), uy - 0.9, (LW + 26) / 2], [-(ux - 0.5), uy - 0.9, -(LW + 26) / 2], [-(ux - 0.5), uy + 0.5, -(LW + 26) / 2], [-(ux - 0.5), uy + 0.5, (LW + 26) / 2], 42, 0),
      quad([ux - 0.5, uy - 0.9, -(LW + 26) / 2], [ux - 0.5, uy - 0.9, (LW + 26) / 2], [ux - 0.5, uy + 0.5, (LW + 26) / 2], [ux - 0.5, uy + 0.5, -(LW + 26) / 2], 42, 0)];
    G.add(new THREE.Mesh(merge(lq), new THREE.MeshBasicMaterial({ map: ledT })));
    A.updaters.push(function (dt) { ledT.offset.x += dt * 0.035; });
    /* atap melingkar putih + tiang + deretan lampu sorot di bibir atap */
    var ry = uy + UR * uh + 5.2, rw = UR * us + 9, roof = [], lampG = [], lampP = [];
    [-1, 1].forEach(function (k) {
      roof.push(box(LL + 30 + rw * 2, 0.7, rw, 0, ry, k * (uz - 4 + rw / 2)), box(rw, 0.7, LW + 30, k * (ux - 4 + rw / 2), ry, 0));
      for (var c = -4; c <= 4; c++) { dark.length = 0; }
      for (var i = -5; i <= 5; i++) { lampG.push(box(4.4, 0.5, 0.8, i * (LL + 20) / 11, ry - 0.6, k * (uz - 3.4))); lampP.push([i * (LL + 20) / 11, ry - 0.9, k * (uz - 3.4), '#fff6dc']); }
      for (i = -3; i <= 3; i++) { lampG.push(box(0.8, 0.5, 4.4, k * (ux - 3.4), ry - 0.6, i * (LW + 16) / 7)); lampP.push([k * (ux - 3.4), ry - 0.9, i * (LW + 16) / 7, '#fff6dc']); }
    });
    add(A, roof, '#e8ecf1');
    G.add(new THREE.Mesh(merge(lampG), R3.basic(night ? '#fffbe8' : '#c9ced6')));
    if (night) lights(A, lampP, 9, { op: 0.8 });
    /* dua layar raksasa di belakang gawang */
    var scT = H.textTex(512, 192, '#0a0d14', '#ffd23f', ['BOLA API ARENA', 'STADION UTAMA']);
    var frame = [];
    [-1, 1].forEach(function (s) {
      var sx = s * (ux + UR * us - 1.5), sy = uy + UR * uh + 0.4;
      var pl = new THREE.Mesh(new THREE.PlaneGeometry(24, 8.6), new THREE.MeshBasicMaterial({ map: scT })); pl.position.set(sx - s * 0.5, sy, 0); pl.rotation.y = s > 0 ? -PI / 2 : PI / 2; G.add(pl);
      frame.push(box(0.6, 9.6, 25.2, sx, sy, 0));
    });
    add(A, frame, '#15181e');
    /* penerangan stadion */
    /* lampu malam umum (buildNightLights) sudah menerangi lapangan: tanpa tambahan supaya rumput tidak silau */
    void rnd; void q;
  };
})(typeof window !== 'undefined' ? window : globalThis);
