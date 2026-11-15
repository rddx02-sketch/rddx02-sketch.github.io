/* Bola Api Arena — dekorasi 10 arena tambahan (pasar malam, candi, kebun teh, dermaga, kawah, atap kota, hutan bambu, GOR, anjungan, stadion utama).
   Semua ukuran mengikuti lapangan yang sedang dipakai (5 vs 5, 7 vs 7, 11 vs 11). Benda tinggi diletakkan jauh dari garis lapangan
   supaya tidak menutupi kamera samping maupun kamera belakang. */
(function (root) {
  'use strict';
  var BA = root.BA, U = BA.U, D = BA.D, R3 = BA.R3, F = D.FIELD, THREE = root.THREE, Arena = BA.Arena;
  if (!Arena || !Arena.H || !THREE) return;
  var H = Arena.H, tg = H.tg, bar = H.bar, merge = H.merge, DECO = Arena.DECO;
  var PI = Math.PI;

  /* ---------- alat bantu ---------- */
  function box(w, h, d, x, y, z, ry, rx, rz) { return tg(new THREE.BoxGeometry(w, h, d), x, y, z, rx || 0, ry || 0, rz || 0); }
  function cyl(rt, rb, h, x, y, z, seg, rx, rz) { return tg(new THREE.CylinderGeometry(rt, rb, h, seg || 8), x, y, z, rx || 0, 0, rz || 0); }
  function cone(r, h, x, y, z, seg, ry) { return tg(new THREE.ConeGeometry(r, h, seg || 8), x, y, z, 0, ry || 0, 0); }
  /* atap limas persegi panjang (alas w × d, tinggi h) */
  function hip(w, h, d, x, y, z) { var g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4); g.rotateY(PI / 4); return tg(g, x, y + h / 2, z, 0, 0, 0, w, h, d); }
  function ball(r, x, y, z, sx, sy, sz, seg) { var g = new THREE.SphereGeometry(r, seg || 8, Math.max(4, (seg || 8) - 2)); return tg(g, x, y, z, 0, 0, 0, sx == null ? 1 : sx, sy == null ? 1 : sy, sz == null ? 1 : sz); }
  /* gabung daftar geometri jadi satu mesh berbahan warna polos */
  function add(A, list, color, opts) {
    if (!list.length) return null;
    var m = new THREE.Mesh(merge(list), typeof color === 'string' ? R3.mat(color, opts) : color);
    m.castShadow = false; m.receiveShadow = !!(opts && opts.recv);
    A.group.add(m);
    return m;
  }
  /* kumpulan titik bercahaya (lampu hias, jendela jauh, bara) dalam satu draw call; warna per titik */
  function lights(A, pts, size, opts) {
    opts = opts || {};
    var n = pts.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), c = new THREE.Color();
    for (var i = 0; i < n; i++) { pos[i * 3] = pts[i][0]; pos[i * 3 + 1] = pts[i][1]; pos[i * 3 + 2] = pts[i][2]; c.set(pts[i][3] || '#ffd9a0'); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    var m = new THREE.PointsMaterial({ map: R3.tex.glow, size: size || 1, sizeAttenuation: true, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: opts.op == null ? 1 : opts.op, fog: opts.fog !== false });
    var p = new THREE.Points(g, m); p.frustumCulled = false;
    A.group.add(p);
    return p;
  }
  function glow(A, x, y, z, col, sc, op) {
    var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: R3.tex.glow, color: new THREE.Color(col), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: op == null ? 1 : op }));
    s.position.set(x, y, z); s.scale.setScalar(sc || 2); A.group.add(s);
    return s;
  }
  /* laut beriak: dua lapis tekstur gelombang yang bergeser berlawanan arah */
  function sea(A, y, c1, c2, size) {
    size = size || 900;
    var draw = function (x, w, h) {
      x.fillStyle = c1; x.fillRect(0, 0, w, h);
      var r = U.rng(77);
      for (var i = 0; i < 150; i++) {
        var px = r() * w, py = r() * h, l = 14 + r() * 46;
        x.strokeStyle = c2; x.globalAlpha = 0.16 + r() * 0.3; x.lineWidth = 1 + r() * 2.2; x.lineCap = 'round';
        for (var k = -1; k <= 1; k++) { x.beginPath(); x.moveTo(px + k * w, py); x.quadraticCurveTo(px + k * w + l / 2, py - 3 - r() * 4, px + k * w + l, py); x.stroke(); }
      }
      x.globalAlpha = 1;
    };
    var t1 = R3.canvasTex(256, 256, draw, { repeat: [size / 30, size / 30] });
    var t2 = R3.canvasTex(256, 256, draw, { repeat: [size / 19, size / 19] });
    var g = new THREE.PlaneGeometry(size, size);
    var m1 = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: t1 })); m1.rotation.x = -PI / 2; m1.position.y = y; A.group.add(m1);
    var m2 = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: t2, transparent: true, opacity: 0.4, depthWrite: false })); m2.rotation.x = -PI / 2; m2.position.y = y + 0.06; A.group.add(m2);
    A.updaters.push(function (dt) {
      var wv = A.windMag || 1;
      t1.offset.x += dt * 0.012 * wv; t1.offset.y += dt * 0.006 * wv; t2.offset.x -= dt * 0.009 * wv; t2.offset.y += dt * 0.011 * wv;
    });
    return m1;
  }
  /* setengah ukuran area sekitar lapangan (pagar + ruang penonton) */
  function ext(A, margin) { return { x: (A.fenceX || F.L / 2 + 1.5) + margin, z: (A.fenceZ || F.W / 2 + 1.2) + margin }; }
  function big() { return F.n >= 7; }
  /* tekstur dinding berjendela (gedung, GOR, anjungan) */
  function windowTex(A, bg, lit, dark, cols, rows, litP, seed) {
    var r = U.rng(seed || 5);
    var t = R3.canvasTex(128, 128, function (x, w, h) {
      x.fillStyle = bg; x.fillRect(0, 0, w, h);
      var cw = w / cols, ch = h / rows;
      for (var i = 0; i < cols; i++) for (var j = 0; j < rows; j++) { x.fillStyle = r() < litP ? lit[Math.floor(r() * lit.length)] : dark; x.fillRect(i * cw + cw * 0.18, j * ch + ch * 0.22, cw * 0.64, ch * 0.5); }
    }, { repeat: [1, 1] });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  /* kotak yang UV sisi tegaknya mengikuti ukuran (supaya tekstur jendela tidak melar) */
  function boxUV(w, h, d, x, y, z, ru, rv) {
    var g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
    for (var f = 0; f < 6; f++) {
      var su = (f < 2 ? d : w) / (ru || 8), sv = (f === 2 || f === 3) ? 0 : h / (rv || 8);
      for (var k = 0; k < 4; k++) { var i = f * 4 + k; uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); }
    }
    return tg(g, x, y, z);
  }

  /* ======================================================================
     1. PASAR MALAM — bianglala berputar, komidi putar, deretan tenda, lampu hias
     ====================================================================== */
  DECO.pasarmalam = function (A, rnd, q, tk) {
    var e = ext(A, 0), G = A.group, zf = -(e.z + (big() ? 40 : 34));
    /* bianglala */
    var R = 11, hubY = 13.5, fx = -F.L * 0.16;
    var wheel = new THREE.Group(); wheel.position.set(fx, hubY, zf);
    var rim = [];
    [-0.7, 0.7].forEach(function (dz) {
      rim.push(tg(new THREE.TorusGeometry(R, 0.12, 6, 40), 0, 0, dz));
      rim.push(tg(new THREE.TorusGeometry(R * 0.55, 0.07, 5, 28), 0, 0, dz));
      for (var i = 0; i < 12; i++) { var a = i / 12 * PI * 2; rim.push(bar(0, 0, dz, Math.cos(a) * R, Math.sin(a) * R, dz, 0.06, 5)); }
    });
    for (var i2 = 0; i2 < 12; i2++) { var a2 = i2 / 12 * PI * 2; rim.push(bar(Math.cos(a2) * R, Math.sin(a2) * R, -0.7, Math.cos(a2) * R, Math.sin(a2) * R, 0.7, 0.06, 5)); }
    rim.push(cyl(0.5, 0.5, 2, 0, 0, 0, 10, PI / 2));
    var wm = new THREE.Mesh(merge(rim), R3.mat('#d7dbe2')); wheel.add(wm);
    var bulbs = [], cols = ['#ff4d6d', '#ffd60a', '#4cc9f0', '#80ed99', '#ff9e00', '#c77dff'];
    for (var b = 0; b < 48; b++) { var ab = b / 48 * PI * 2; bulbs.push([Math.cos(ab) * R, Math.sin(ab) * R, 0.8, cols[b % cols.length]]); }
    for (b = 0; b < 12; b++) { var as = b / 12 * PI * 2; for (var k = 1; k < 5; k++) bulbs.push([Math.cos(as) * R * k / 5, Math.sin(as) * R * k / 5, 0.8, cols[(b + k) % cols.length]]); }
    var bl = lights({ group: wheel }, bulbs, 1.5);
    G.add(wheel);
    /* gondola: selalu tegak */
    var gond = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 1.3, 1.2), H.imat(A, '#ffffff'), 12), gm = new THREE.Matrix4(), gc = new THREE.Color();
    for (var g2 = 0; g2 < 12; g2++) { gc.set(cols[g2 % cols.length]); gond.setColorAt(g2, gc); }
    if (gond.instanceColor) gond.instanceColor.needsUpdate = true;
    G.add(gond);
    var legs = [];
    [-1.6, 1.6].forEach(function (dz) { [-1, 1].forEach(function (s) { legs.push(bar(fx + s * 7, 0, zf + dz, fx, hubY, zf + dz, 0.22, 6)); }); legs.push(bar(fx - 4, 5.2, zf + dz, fx + 4, 5.2, zf + dz, 0.12, 5)); });
    legs.push(box(18, 0.5, 6, fx, 0.25, zf));
    add(A, legs, '#b23a48');
    var ang = 0;
    A.updaters.push(function (dt, t) {
      ang += dt * 0.16; wheel.rotation.z = ang;
      for (var i = 0; i < 12; i++) { var a = ang + i / 12 * PI * 2; gm.makeTranslation(fx + Math.cos(a) * R, hubY + Math.sin(a) * R - 0.9, zf); gond.setMatrixAt(i, gm); }
      gond.instanceMatrix.needsUpdate = true;
      bl.material.opacity = 0.75 + 0.25 * Math.sin(t * 6);
    });
    /* komidi putar */
    var cx = F.L * 0.3, cz = zf + 6, car = new THREE.Group(); car.position.set(cx, 0, cz);
    var cp = [cyl(5.2, 5.2, 0.4, 0, 0.5, 0, 16), cyl(0.35, 0.35, 5, 0, 3, 0, 8)];
    for (var h2 = 0; h2 < 8; h2++) { var ah = h2 / 8 * PI * 2; cp.push(cyl(0.05, 0.05, 4.2, Math.cos(ah) * 4, 2.8, Math.sin(ah) * 4, 5)); cp.push(box(0.5, 0.8, 1.3, Math.cos(ah) * 4, 1.5 + (h2 % 2) * 0.5, Math.sin(ah) * 4, -ah)); }
    car.add(new THREE.Mesh(merge(cp), R3.mat('#f4e3c1')));
    var roofT = R3.canvasTex(64, 8, function (x, w, h) { for (var i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#fff4e0' : '#e63946'; x.fillRect(i * 8, 0, 8, h); } });
    var roof = new THREE.Mesh(new THREE.ConeGeometry(6, 2.6, 16), new THREE.MeshLambertMaterial({ map: roofT })); roof.position.y = 6.2; car.add(roof);
    var cb = []; for (var c3 = 0; c3 < 20; c3++) { var ac = c3 / 20 * PI * 2; cb.push([Math.cos(ac) * 5.9, 4.9, Math.sin(ac) * 5.9, cols[c3 % cols.length]]); }
    lights({ group: car }, cb, 1.2);
    G.add(car);
    A.updaters.push(function (dt) { car.rotation.y += dt * 0.5; });
    /* deretan tenda jajanan di sisi jauh + dua lapak rendah di sisi dekat */
    var span = F.L + 44, nt = Math.round(span / 7.5), base = [], roofs = [[], [], []], lamp = [];
    for (var t2 = 0; t2 < nt; t2++) {
      var tx = -span / 2 + (t2 + 0.5) * span / nt + (rnd() - 0.5), tz = -(e.z + (big() ? 15 : 11) + rnd() * 3);
      if (Math.abs(tx - fx) < 9 && tz < zf + 12) continue;
      base.push(box(4.6, 1, 2.6, tx, 0.5, tz));
      [[-2.2, -1.2], [2.2, -1.2], [-2.2, 1.2], [2.2, 1.2]].forEach(function (p) { base.push(cyl(0.05, 0.05, 2.6, tx + p[0], 1.3, tz + p[1], 5)); });
      roofs[t2 % 3].push(tg(new THREE.ConeGeometry(3.7, 1.7, 4), tx, 3.45, tz, 0, PI / 4, 0));
      lamp.push([tx, 2.3, tz + 1.4, '#ffd9a0'], [tx - 1.4, 2.3, tz + 1.4, '#ffb36b'], [tx + 1.4, 2.3, tz + 1.4, '#ffb36b']);
    }
    add(A, base, '#8a6a45');
    add(A, roofs[0], '#d62828'); add(A, roofs[1], '#f4d35e'); add(A, roofs[2], '#2a9d8f');
    H.warung(A, -F.L / 2 - 6, e.z + 7, PI + 0.3, 'BAKSO API', rnd);
    H.warung(A, F.L / 2 + 5, e.z + 7.5, PI - 0.25, 'ES TEH', rnd);
    /* lampu hias di tali antar tiang mengelilingi lapangan */
    var poles = [], px0 = e.x + 2.6, pz0 = e.z + (big() ? 6.2 : 2.6), PH = 4.6, nseg = Math.max(4, Math.round(F.L / 9));
    var ring = [];
    for (var s2 = 0; s2 <= nseg; s2++) { ring.push([-px0 + s2 * 2 * px0 / nseg, -pz0]); }
    for (s2 = nseg; s2 >= 0; s2--) { ring.push([-px0 + s2 * 2 * px0 / nseg, pz0]); }
    ring.forEach(function (p, i) {
      poles.push(cyl(0.06, 0.07, PH, p[0], PH / 2, p[1], 5));
      var nx = ring[(i + 1) % ring.length];
      for (var k = 1; k < 7; k++) { var f = k / 7; lamp.push([U.lerp(p[0], nx[0], f), PH - 0.1 - Math.sin(f * PI) * 0.7, U.lerp(p[1], nx[1], f), cols[(i + k) % cols.length]]); }
    });
    add(A, poles, '#c9a463');
    var lp = lights(A, lamp, 1.15);
    A.updaters.push(function (dt, t) { lp.material.opacity = 0.82 + 0.18 * Math.sin(t * 3.1); });
    if (tk === 'malam') { var wl = new THREE.PointLight(0xff9e6b, 0.5, 90, 1.5); wl.position.set(fx, hubY, zf + 6); G.add(wl); }
    H.treeLine(A, rnd, '#1f3320');
  };

  /* ======================================================================
     2. PELATARAN CANDI — candi berundak dengan stupa, dua menara, gapura belah
     ====================================================================== */
  DECO.candi = function (A, rnd, q, tk) {
    var e = ext(A, 0), stone = [], dark = [], zc = -(e.z + (big() ? 52 : 44));
    /* candi utama berundak */
    var tiers = 6, bw = 40, th = 2.3, y = 0;
    var stupas = [];
    for (var i = 0; i < tiers; i++) {
      var w = bw - i * 5.4;
      stone.push(box(w, th, w, 0, y + th / 2, zc));
      dark.push(box(w + 0.5, 0.32, w + 0.5, 0, y + th - 0.02, zc));
      if (i > 0 && i < tiers - 1) {
        var n = Math.max(3, Math.round(w / 3.2));
        for (var k = 0; k < n; k++) { var o = -w / 2 + 1 + k * (w - 2) / (n - 1); stupas.push([o, y + th, zc + w / 2 - 0.9], [o, y + th, zc - w / 2 + 0.9], [-w / 2 + 0.9, y + th, zc + o], [w / 2 - 0.9, y + th, zc + o]); }
      }
      y += th;
    }
    /* tangga tengah & gerbang kala */
    stone.push(tg(new THREE.BoxGeometry(4.2, 0.6, 18), 0, y / 2 - 0.4, zc + bw / 2 - 5.5, Math.atan2(y - 1, 18), 0, 0));
    stone.push(box(1, 4.6, 1.2, -2.9, 2.3, zc + bw / 2 + 2.4), box(1, 4.6, 1.2, 2.9, 2.3, zc + bw / 2 + 2.4), box(7.4, 1.3, 1.4, 0, 5.2, zc + bw / 2 + 2.4), box(4.6, 1, 1.2, 0, 6.3, zc + bw / 2 + 2.4));
    /* stupa induk */
    stone.push(cyl(5.4, 6, 1.4, 0, y + 0.7, zc, 16), ball(5, 0, y + 1.4, zc, 1, 0.95, 1, 14), box(2.4, 1.6, 2.4, 0, y + 6.6, zc), cone(0.9, 6, 0, y + 10.4, zc, 8));
    /* menara pendamping (prasada) */
    [-1, 1].forEach(function (s) {
      var tx = s * (F.L / 2 + 30), tz = -(e.z + 22), yy = 0, ww = 9;
      for (var j = 0; j < 7; j++) { var hh = j === 0 ? 3 : 2.2; stone.push(box(ww, hh, ww, tx, yy + hh / 2, tz)); dark.push(box(ww + 0.5, 0.3, ww + 0.5, tx, yy + hh, tz)); yy += hh; ww *= 0.82; }
      stone.push(cone(ww * 0.75, 4.5, tx, yy + 2.25, tz, 8));
    });
    /* gapura belah di kedua ujung lapangan */
    [-1, 1].forEach(function (s) {
      var gx = s * (e.x + 13);
      [-1, 1].forEach(function (k) {
        for (var j = 0; j < 6; j++) { var d2 = 3.6 - j * 0.5, hh = 1.25; stone.push(box(2.6, hh, d2, gx, j * hh + hh / 2, k * (1.9 + d2 / 2))); }
        dark.push(box(2.9, 0.3, 4, gx, 0.15, k * 3.9));
      });
    });
    /* lentera batu di sepanjang sisi jauh, tembok rendah di sisi dekat */
    var nl = Math.round((F.L + 16) / 8);
    for (var l = 0; l < nl; l++) { var lx = -(F.L + 16) / 2 + (l + 0.5) * (F.L + 16) / nl; stupas.push([lx, 0, -(e.z + (big() ? 8.2 : 4.6))]); }
    for (l = 0; l < nl; l += 2) { var lx2 = -(F.L + 16) / 2 + (l + 0.5) * (F.L + 16) / nl; stone.push(box(5.5, 0.9, 0.7, lx2, 0.45, e.z + (big() ? 8.4 : 5))); }
    add(A, stone, '#857f73'); add(A, dark, '#5f5a52');
    /* stupa kecil (instans): badan lonceng + pucuk */
    var sg = merge([cyl(0.62, 0.7, 0.35, 0, 0.18, 0, 10), ball(0.55, 0, 0.62, 0, 1, 1.05, 1, 10), box(0.26, 0.2, 0.26, 0, 1.25, 0), cone(0.11, 0.7, 0, 1.7, 0, 6)]);
    var sm = new THREE.InstancedMesh(sg, H.imat(A, '#746e64'), stupas.length), m4 = new THREE.Matrix4(), c = new THREE.Color();
    stupas.forEach(function (p, i) { var sc = p[1] > 0.1 ? 1.25 : 1; m4.makeScale(sc, sc, sc); m4.setPosition(p[0], p[1], p[2]); sm.setMatrixAt(i, m4); c.set('#746e64').multiplyScalar(0.85 + rnd() * 0.3); sm.setColorAt(i, c); });
    sm.instanceMatrix.needsUpdate = true; if (sm.instanceColor) sm.instanceColor.needsUpdate = true;
    A.group.add(sm);
    H.mountains(A, rnd, '#7f93a6', 6, 190 + F.L * 0.3);
    var tr = [];
    for (var t = 0; t < 14; t++) { var s3 = t % 2 ? 1 : -1; tr.push({ x: s3 * (F.L / 2 + 14 + rnd() * 30), z: (rnd() < 0.5 ? -1 : 1) * (e.z + 24 + rnd() * 26) }); }
    H.trees(A, tr, 'bulat', rnd);
    H.treeLine(A, rnd, '#4a6b3c');
    void q; void tk;
  };

  /* ======================================================================
     3. KEBUN TEH — lereng berundak penuh perdu teh, pabrik teh, kabut pagi
     ====================================================================== */
  DECO.kebunteh = function (A, rnd, q, tk) {
    var e = ext(A, 0), span = F.L + 150, terr = [], bush = [], z0 = e.z + (big() ? 9 : 6), nT = 7, stepZ = 7.5, stepY = 1.7;
    /* undak di sisi jauh (naik) dan dua undak rendah di sisi dekat */
    for (var i = 0; i < nT; i++) {
      var zz = -(z0 + 6 + i * stepZ), yy = (i + 1) * stepY;
      terr.push(box(span, yy, stepZ, 0, yy / 2, zz));
      for (var r = 0; r < 3; r++) { var bz = zz + stepZ / 2 - 1.2 - r * 2.2; for (var bx = -span / 2 + 1; bx < span / 2; bx += 1.9) bush.push([bx + (rnd() - 0.5) * 0.5, yy + 0.25, bz + (rnd() - 0.5) * 0.3, 0.9 + rnd() * 0.35]); }
    }
    for (i = 0; i < 2; i++) {
      var zn = z0 + 3 + i * 5;
      terr.push(box(span, 0.4 + i * 0.5, 4.6, 0, (0.4 + i * 0.5) / 2, zn));
      for (var bx2 = -span / 2 + 1; bx2 < span / 2; bx2 += 1.9) bush.push([bx2 + (rnd() - 0.5) * 0.5, 0.45 + i * 0.5, zn + (rnd() - 0.5) * 1.6, 0.7 + rnd() * 0.25]);
    }
    /* lereng di belakang kedua gawang */
    [-1, 1].forEach(function (s) {
      for (var j = 0; j < 4; j++) {
        var xx = s * (e.x + 12 + j * 7), y2 = (j + 1) * 1.3, len = F.W + 40;
        terr.push(box(7, y2, len, xx, y2 / 2, 0));
        for (var bz2 = -len / 2 + 1; bz2 < len / 2; bz2 += 1.9) bush.push([xx + (rnd() - 0.5) * 2.4, y2 + 0.25, bz2, 0.85 + rnd() * 0.3]);
      }
    });
    add(A, terr, '#4f7d3a', { recv: 1 });
    var limit = q === 0 ? 900 : 2600;
    if (bush.length > limit) { var keep = [], st = bush.length / limit; for (var b = 0; b < limit; b++) keep.push(bush[Math.floor(b * st)]); bush = keep; }
    var bg = new THREE.IcosahedronGeometry(1, 0); bg.scale(1, 0.62, 0.8);
    var bm = new THREE.InstancedMesh(bg, H.imat(A, '#ffffff'), bush.length), m4 = new THREE.Matrix4(), c = new THREE.Color();
    bush.forEach(function (p, k) { m4.makeScale(p[3], p[3], p[3]); m4.setPosition(p[0], p[1], p[2]); bm.setMatrixAt(k, m4); c.set(k % 3 ? '#2f6f2c' : '#3f8636').multiplyScalar(0.82 + rnd() * 0.36); bm.setColorAt(k, c); });
    bm.instanceMatrix.needsUpdate = true; if (bm.instanceColor) bm.instanceColor.needsUpdate = true;
    A.group.add(bm);
    /* pabrik teh di undak atas + gazebo */
    var topY = nT * stepY, fz = -(z0 + 6 + (nT - 1) * stepZ) - 9, wall = [], roof = [];
    terr = [box(span, topY, 60, 0, topY / 2, fz - 26)];
    add(A, terr, '#4a7636');
    wall.push(box(22, 5, 9, -F.L * 0.2, topY + 2.5, fz), box(3, 9, 3, -F.L * 0.2 + 9, topY + 4.5, fz - 2));
    roof.push(hip(24, 3.2, 10.6, -F.L * 0.2, topY + 5, fz));
    roof.push(cone(2.4, 1.6, -F.L * 0.2 + 9, topY + 9.8, fz - 2, 4, PI / 4));
    wall.push(cyl(0.12, 0.12, 2.6, F.L * 0.24 - 1.6, topY + 1.3, fz + 4, 5), cyl(0.12, 0.12, 2.6, F.L * 0.24 + 1.6, topY + 1.3, fz + 4, 5), cyl(0.12, 0.12, 2.6, F.L * 0.24 - 1.6, topY + 1.3, fz + 7, 5), cyl(0.12, 0.12, 2.6, F.L * 0.24 + 1.6, topY + 1.3, fz + 7, 5));
    roof.push(cone(3.2, 1.6, F.L * 0.24, topY + 3.4, fz + 5.5, 4, PI / 4));
    add(A, wall, '#f1ece0'); add(A, roof, '#a8432f');
    var tr = [];
    for (i = 0; i < 16; i++) tr.push({ x: -span / 2 + rnd() * span, z: fz - 6 - rnd() * 30, y: topY });
    /* pohon peneduh di undak atas: pakai pohon bulat, diangkat lewat grup */
    var before = A.group.children.length;
    H.trees(A, tr.map(function (t) { return { x: t.x, z: t.z }; }), 'bulat', rnd);
    for (i = before; i < A.group.children.length; i++) A.group.children[i].position.y += topY;
    H.mountains(A, rnd, '#8fa5b5', 7, 210 + F.L * 0.3);
    /* kabut tipis melayang di lereng */
    var mist = [];
    for (i = 0; i < 7; i++) {
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: R3.tex.soft, color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false }));
      sp.position.set(-span / 2 + rnd() * span, 3 + rnd() * 9, -(z0 + 14 + rnd() * 40)); sp.scale.set(46 + rnd() * 40, 7 + rnd() * 5, 1);
      A.group.add(sp); mist.push({ s: sp, v: 0.5 + rnd() * 0.9, x0: sp.position.x });
    }
    A.updaters.push(function (dt) { mist.forEach(function (m) { m.s.position.x += m.v * dt; if (m.s.position.x > span / 2 + 30) m.s.position.x = -span / 2 - 30; }); });
    H.treeLine(A, rnd, '#3b6a34');
    void tk;
  };

  /* ======================================================================
     4. DERMAGA NELAYAN — geladak papan di atas laut, perahu bercadik, mercusuar
     ====================================================================== */
  DECO.dermaga = function (A, rnd, q, tk) {
    var e = ext(A, 9), G = A.group, night = tk === 'malam';
    if (A.outer) A.outer.visible = false;
    sea(A, -1.7, night ? '#0d1b33' : (tk === 'senja' ? '#2b4a72' : '#2f7fa3'), night ? '#5f7fb8' : (tk === 'senja' ? '#ffab7a' : '#bfe9f5'));
    /* geladak + balok tepi + tiang pancang */
    var deck = [box(e.x * 2, 0.5, e.z * 2, 0, -0.27, 0)], beam = [], pile = [];
    beam.push(box(e.x * 2 + 0.4, 0.35, 0.4, 0, 0.1, -e.z), box(e.x * 2 + 0.4, 0.35, 0.4, 0, 0.1, e.z), box(0.4, 0.35, e.z * 2 + 0.4, -e.x, 0.1, 0), box(0.4, 0.35, e.z * 2 + 0.4, e.x, 0.1, 0));
    for (var x = -e.x; x <= e.x + 0.1; x += 6) { pile.push([x, -e.z], [x, e.z]); }
    for (var z = -e.z + 6; z < e.z; z += 6) { pile.push([-e.x, z], [e.x, z]); }
    /* jembatan papan ke darat di sisi jauh */
    deck.push(box(5, 0.4, 46, F.L * 0.3, -0.22, -(e.z + 23)));
    for (z = -(e.z + 6); z > -(e.z + 44); z -= 7) pile.push([F.L * 0.3 - 2.3, z], [F.L * 0.3 + 2.3, z]);
    add(A, deck, A.surf ? A.surf.out : '#7a5c3d', { recv: 1 });
    add(A, beam, '#5f4630');
    var pm = new THREE.InstancedMesh(R3.geo.cyl6, H.imat(A, '#4e3a28'), pile.length), m4 = new THREE.Matrix4();
    pile.forEach(function (p, i) { m4.makeScale(0.22, 4.4, 0.22); m4.setPosition(p[0], -1.9, p[1]); pm.setMatrixAt(i, m4); });
    pm.instanceMatrix.needsUpdate = true; G.add(pm);
    /* tiang tambat & gulungan tali di tepi */
    var bol = [];
    for (x = -e.x + 3; x < e.x; x += 9) { bol.push(cyl(0.16, 0.2, 0.7, x, 0.35, -e.z + 0.7, 8), cyl(0.16, 0.2, 0.7, x, 0.35, e.z - 0.7, 8)); }
    add(A, bol, '#3b3f45');
    /* perahu bercadik: lambung, cadik, tiang — bergoyang di ombak */
    var hullG = new THREE.CylinderGeometry(0.2, 1.1, 1, 8, 1); hullG.rotateZ(PI / 2); hullG.scale(6.4, 0.9, 1);
    var hull2 = new THREE.SphereGeometry(1, 10, 6, 0, PI * 2, PI / 2, PI / 2); hull2.scale(4.4, 1.2, 1.15);
    var hg = merge([hull2, box(8.4, 0.12, 2.2, 0, 0.02, 0), box(1.9, 0.9, 1.5, -0.8, 0.5, 0), cyl(0.06, 0.06, 4.2, 0.9, 2.1, 0, 5)]);
    hullG.dispose();
    var og = merge([cyl(0.07, 0.07, 7.6, 0, 0.25, 2.9, 5, 0, PI / 2), cyl(0.07, 0.07, 7.6, 0, 0.25, -2.9, 5, 0, PI / 2), cyl(0.05, 0.05, 6, -1.8, 0.55, 0, 5, PI / 2), cyl(0.05, 0.05, 6, 1.8, 0.55, 0, 5, PI / 2)]);
    var boats = [], nb = 6, hc = ['#2a9d8f', '#e63946', '#f4a261', '#3a86ff', '#ffd166', '#f1faee'];
    for (var i = 0; i < nb; i++) {
      var far = i < 4, bx = far ? -e.x + 8 + i * (2 * e.x - 16) / 3 + (rnd() - 0.5) * 5 : (i === 4 ? -e.x - 9 : e.x + 10);
      var bz = far ? -(e.z + 7 + rnd() * 9) : (rnd() - 0.5) * F.W * 0.5;
      if (far && Math.abs(bx - F.L * 0.3) < 7) bx += 12;
      boats.push({ x: bx, z: bz, r: far ? (rnd() - 0.5) * 0.7 : PI / 2 + (rnd() - 0.5) * 0.4, ph: rnd() * 6 });
    }
    var hm = new THREE.InstancedMesh(hg, H.imat(A, '#ffffff'), nb), om = new THREE.InstancedMesh(og, H.imat(A, '#c9a463'), nb), c = new THREE.Color();
    boats.forEach(function (b, k) { c.set(hc[k % hc.length]); hm.setColorAt(k, c); });
    if (hm.instanceColor) hm.instanceColor.needsUpdate = true;
    G.add(hm); G.add(om);
    var qq = new THREE.Quaternion(), ee = new THREE.Euler(), ps = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    A.updaters.push(function (dt, t) {
      for (var k = 0; k < nb; k++) {
        var b = boats[k];
        ee.set(Math.sin(t * 1.1 + b.ph) * 0.07, b.r, Math.sin(t * 0.8 + b.ph * 1.7) * 0.05); qq.setFromEuler(ee);
        ps.set(b.x, -1.45 + Math.sin(t * 1.3 + b.ph) * 0.12, b.z); m4.compose(ps, qq, one);
        hm.setMatrixAt(k, m4); om.setMatrixAt(k, m4);
      }
      hm.instanceMatrix.needsUpdate = true; om.instanceMatrix.needsUpdate = true;
    });
    /* daratan jauh dengan pohon kelapa & rumah */
    var shoreZ = -(e.z + 62);
    G.add(R3.mesh(R3.geo.box, R3.mat('#d9c48f'), 0, -1.2, shoreZ - 60, 700, 1.6, 150));
    var palms = [];
    for (i = 0; i < 16; i++) palms.push({ x: -150 + rnd() * 300, z: shoreZ - 4 - rnd() * 30 });
    H.trees(A, palms, 'kelapa', rnd);
    H.houses(A, H.houseRow(shoreZ - 14, 9, -70, 16, rnd, 0), rnd, night);
    /* mercusuar di karang */
    var lx = F.L / 2 + 58, lz = -(e.z + 30);
    add(A, [ball(7, lx, -2.2, lz, 1.5, 0.5, 1.2, 8), ball(4, lx + 6, -2.4, lz + 4, 1.3, 0.5, 1, 7)], '#5c5650');
    var lt = R3.canvasTex(8, 64, function (x2, w, h) { for (var j = 0; j < 6; j++) { x2.fillStyle = j % 2 ? '#d62828' : '#f4f1ea'; x2.fillRect(0, j * h / 6, w, h / 6 + 1); } });
    var tower = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.4, 17, 12), new THREE.MeshLambertMaterial({ map: lt })); tower.position.set(lx, 8.5, lz); G.add(tower);
    add(A, [cyl(2, 2, 0.4, lx, 17.2, lz, 12), cyl(1.1, 1.1, 2, lx, 18.4, lz, 8), cone(1.5, 1.4, lx, 20.1, lz, 8)], '#2d3238');
    var lg = glow(A, lx, 18.4, lz, '#fff2c4', 7, 0.9);
    var beamG = new THREE.ConeGeometry(4.5, 60, 10, 1, true); beamG.rotateZ(PI / 2); beamG.translate(30, 0, 0);
    var beamM = new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: night || tk === 'senja' ? 0.1 : 0.03, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beamM.position.set(lx, 18.4, lz); G.add(beamM);
    A.updaters.push(function (dt, t) { beamM.rotation.y = t * 0.6; lg.material.opacity = 0.7 + 0.3 * Math.sin(t * 1.2); });
    /* lampu dermaga di empat sudut */
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (k) { H.lampPost(A, k[0] * (e.x - 0.8), k[1] * (e.z - 0.8), 4.2, '#ffcf8a'); });
    void q;
  };

  /* ======================================================================
     5. KAWAH GENI — bibir kawah berbatu, kolam & sungai lava, gunung api berasap
     ====================================================================== */
  DECO.kawah = function (A, rnd, q, tk) {
    var e = ext(A, 0), G = A.group;
    if (A.hemi) A.hemi.groundColor.set('#6a2e18');
    /* batu-batu bergerigi: cincin luar tinggi, batu kecil di dekat pagar */
    var rocks = [], Rr = Math.hypot(e.x, e.z);
    for (var i = 0; i < 90; i++) {
      var a = rnd() * PI * 2, d = Rr + 26 + rnd() * 60, sc = 3 + rnd() * 9;
      rocks.push([Math.cos(a) * d * 1.15, Math.sin(a) * d, sc, sc * (0.8 + rnd() * 1.6), rnd() * 6]);
    }
    for (i = 0; i < 46; i++) {
      var a2 = rnd() * PI * 2, d2 = Rr + 5 + rnd() * 14, s2 = 0.5 + rnd() * 1.5;
      rocks.push([Math.cos(a2) * d2 * 1.1, Math.sin(a2) * d2 * 0.9, s2, s2 * (0.6 + rnd() * 0.7), rnd() * 6]);
    }
    rocks = rocks.filter(function (r) { return Math.abs(r[0]) > e.x + 3 || Math.abs(r[1]) > e.z + (big() ? 6.5 : 3); });
    var rg = new THREE.DodecahedronGeometry(1, 0);
    var rm = new THREE.InstancedMesh(rg, H.imat(A, '#ffffff'), rocks.length), m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), ee = new THREE.Euler(), ps = new THREE.Vector3(), ss = new THREE.Vector3(), c = new THREE.Color();
    rocks.forEach(function (r, k) { ee.set(r[4], r[4] * 1.7, r[4] * 0.6); qq.setFromEuler(ee); ps.set(r[0], r[3] * 0.25, r[1]); ss.set(r[2], r[3], r[2] * 0.85); m4.compose(ps, qq, ss); rm.setMatrixAt(k, m4); c.set('#3a3532').multiplyScalar(0.7 + rnd() * 0.7); rm.setColorAt(k, c); });
    rm.instanceMatrix.needsUpdate = true; if (rm.instanceColor) rm.instanceColor.needsUpdate = true;
    G.add(rm);
    /* lava: tekstur retak menyala yang bergeser pelan */
    var lt = R3.canvasTex(256, 256, function (x, w, h) {
      x.fillStyle = '#ff7a1a'; x.fillRect(0, 0, w, h);
      var r = U.rng(9);
      for (var j = 0; j < 46; j++) { x.fillStyle = j % 3 ? '#ffb330' : '#fff0a0'; x.globalAlpha = 0.35 + r() * 0.4; x.beginPath(); x.ellipse(r() * w, r() * h, 6 + r() * 26, 3 + r() * 12, r() * 3, 0, 6.3); x.fill(); }
      x.globalAlpha = 1;
      for (j = 0; j < 30; j++) { x.fillStyle = 'rgba(40,14,8,' + (0.55 + r() * 0.35) + ')'; x.beginPath(); x.ellipse(r() * w, r() * h, 8 + r() * 30, 4 + r() * 14, r() * 3, 0, 6.3); x.fill(); }
    }, { repeat: [1, 1] });
    lt.wrapS = lt.wrapT = THREE.RepeatWrapping;
    var lava = [], pools = [];
    var pool = function (x, z, rx, rz, rot) { var g = new THREE.CircleGeometry(1, 14); g.rotateX(-PI / 2); lava.push(tg(g, x, 0.03, z, 0, rot || 0, 0, rx, 1, rz)); pools.push([x, z, Math.max(rx, rz)]); };
    pool(-F.L * 0.3, -(e.z + 16), 13, 5, 0.2); pool(F.L * 0.34, -(e.z + 13), 9, 4, -0.3); pool(e.x + 15, -F.W * 0.1, 5, 10, 0.1); pool(-(e.x + 16), F.W * 0.15, 5, 8, -0.2);
    pool(F.L * 0.1, e.z + (big() ? 14 : 11), 12, 3.4, 0.05); pool(-F.L * 0.42, e.z + (big() ? 17 : 13), 6, 3, 0.4);
    var river = new THREE.PlaneGeometry(260, 7, 26, 1); river.rotateX(-PI / 2);
    var rp = river.attributes.position; for (i = 0; i < rp.count; i++) rp.setZ(i, rp.getZ(i) + Math.sin(rp.getX(i) * 0.05) * 9);
    lava.push(tg(river, 0, 0.03, -(e.z + 40)));
    var lm = new THREE.Mesh(merge(lava), new THREE.MeshBasicMaterial({ map: lt }));
    var luv = lm.geometry.attributes.uv, lpos = lm.geometry.attributes.position;
    for (i = 0; i < luv.count; i++) luv.setXY(i, lpos.getX(i) / 14, lpos.getZ(i) / 14);
    G.add(lm);
    A.updaters.push(function (dt, t) { lt.offset.x += dt * 0.012; lt.offset.y += dt * 0.004; lm.material.color.setScalar(0.85 + 0.15 * Math.sin(t * 2.3)); });
    pools.forEach(function (p) { glow(A, p[0], 0.6, p[1], '#ff6a1a', p[2] * 2.6, 0.35); });
    /* gunung api di kejauhan dengan puncak membara dan asap */
    var vx = -F.L * 0.25, vz = -210, vh = 86;
    var cg = new THREE.CylinderGeometry(22, 130, vh, 18, 4, true), cp = cg.attributes.position, mr = U.rng(4);
    for (i = 0; i < cp.count; i++) { var yy = cp.getY(i); if (yy < vh / 2 - 1) { cp.setX(i, cp.getX(i) * (0.9 + mr() * 0.2)); cp.setZ(i, cp.getZ(i) * (0.9 + mr() * 0.2)); } }
    cg.computeVertexNormals();
    var vol = new THREE.Mesh(cg, R3.mat('#2f2a29')); vol.position.set(vx, vh / 2 - 2, vz); G.add(vol);
    var vg = glow(A, vx, vh + 2, vz, '#ff5a1a', 90, 0.75);
    var smokeN = q === 0 ? 14 : 26, sp = new Float32Array(smokeN * 3), sdat = [];
    for (i = 0; i < smokeN; i++) sdat.push({ t: rnd() * 1, v: 0.05 + rnd() * 0.05, ox: (rnd() - 0.5) * 20, src: i % 3 });
    var sgm = new THREE.BufferGeometry(); sgm.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    var smoke = new THREE.Points(sgm, new THREE.PointsMaterial({ map: R3.tex.soft, color: 0x8a8580, size: 46, sizeAttenuation: true, transparent: true, opacity: 0.32, depthWrite: false })); smoke.frustumCulled = false; G.add(smoke);
    var srcs = [[vx, vh, vz, 70, 1], [-F.L * 0.3, 1, -(e.z + 16), 16, 0.35], [F.L * 0.34, 1, -(e.z + 13), 14, 0.3]];
    /* percik bara dari kolam lava */
    var emN = q === 0 ? 24 : 60, ep = new Float32Array(emN * 3), ed = [];
    for (i = 0; i < emN; i++) { var pl = pools[i % pools.length]; ed.push({ x: pl[0] + (rnd() - 0.5) * pl[2], z: pl[1] + (rnd() - 0.5) * pl[2] * 0.5, t: rnd(), v: 0.25 + rnd() * 0.35, h: 2.5 + rnd() * 5, ph: rnd() * 6 }); }
    var egm = new THREE.BufferGeometry(); egm.setAttribute('position', new THREE.BufferAttribute(ep, 3));
    var emb = new THREE.Points(egm, new THREE.PointsMaterial({ map: R3.tex.glow, color: 0xffa040, size: 0.55, sizeAttenuation: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); emb.frustumCulled = false; G.add(emb);
    A.updaters.push(function (dt, t) {
      var k, o;
      for (k = 0; k < smokeN; k++) { o = sdat[k]; o.t += o.v * dt; if (o.t > 1) o.t -= 1; var s = srcs[o.src]; sp[k * 3] = s[0] + o.ox * s[4] + o.t * 30 * s[4] * (A.windMag || 1); sp[k * 3 + 1] = s[1] + o.t * s[3]; sp[k * 3 + 2] = s[2] + Math.sin(o.t * 5 + k) * 4 * s[4]; }
      sgm.attributes.position.needsUpdate = true;
      for (k = 0; k < emN; k++) { o = ed[k]; o.t += o.v * dt; if (o.t > 1) o.t -= 1; ep[k * 3] = o.x + Math.sin(t * 2 + o.ph) * 0.5; ep[k * 3 + 1] = 0.1 + o.t * o.h; ep[k * 3 + 2] = o.z + Math.cos(t * 1.6 + o.ph) * 0.5; }
      egm.attributes.position.needsUpdate = true;
      vg.material.opacity = 0.6 + 0.2 * Math.sin(t * 1.7);
    });
    H.mountains(A, rnd, '#3a3536', 6, 180 + F.L * 0.3);
    void tk;
  };

  /* dipakai bagian kedua berkas ini */
  Arena.H2 = { box: box, cyl: cyl, cone: cone, ball: ball, hip: hip, add: add, lights: lights, glow: glow, sea: sea, ext: ext, big: big, windowTex: windowTex, boxUV: boxUV };
})(typeof window !== 'undefined' ? window : globalThis);
