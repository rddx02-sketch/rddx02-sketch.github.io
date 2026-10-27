/* Bola Api Arena — lingkungan: lapangan bergaris tajam, gawang berjaring, rumah kampung, pohon, umbul-umbul,
   penonton, papan iklan warung, langit berawan, cahaya & bayangan nyata, dan cuaca */
(function (root) {
  'use strict';
  var BA = root.BA, U = BA.U, D = BA.D, R3 = BA.R3, F = D.FIELD;
  var THREE = root.THREE;
  var Arena = BA.Arena = {};
  var V3 = THREE.Vector3;

  var TIMES = {
    sore: { top: '#3d6fb8', hor: '#ffb36b', sun: '#ffd7a0', si: 1.0, hs: '#ffd9b0', hg: '#5a4632', hi: 0.62, fog: '#f0b07e', sunPos: [-60, 45, -80], cloud: '#ffe2c4' },
    senja: { top: '#2a2350', hor: '#ff6b4a', sun: '#ff9a6b', si: 0.85, hs: '#ffa585', hg: '#3a2a3a', hi: 0.55, fog: '#d8705a', sunPos: [-90, 18, -70], cloud: '#ffb08a' },
    siang: { top: '#2f86e0', hor: '#d4ecff', sun: '#ffffff', si: 1.05, hs: '#e3f0ff', hg: '#6b5a40', hi: 0.68, fog: '#cfe4f7', sunPos: [30, 90, -40], cloud: '#ffffff' },
    malam: { top: '#03040c', hor: '#1a1c3a', sun: '#9fb4ff', si: 0.28, hs: '#4a5578', hg: '#1a1410', hi: 0.42, fog: '#11132a', sunPos: [40, 60, -60], cloud: '#2a3050' },
    mendung: { top: '#4b5563', hor: '#9aa3ad', sun: '#d7dee8', si: 0.55, hs: '#b0b9c5', hg: '#3d3a35', hi: 0.68, fog: '#8f98a3', sunPos: [10, 70, -50], cloud: '#8a929c' },
    pagi: { top: '#9fb3c8', hor: '#e9eff3', sun: '#fff4e0', si: 0.75, hs: '#e3eaf0', hg: '#5d5a50', hi: 0.7, fog: '#dde5ea', sunPos: [70, 25, -60], cloud: '#f4f6f8' },
    terik: { top: '#5aa6ea', hor: '#ffeac0', sun: '#fff1c9', si: 1.0, hs: '#f4f0e6', hg: '#6a5a40', hi: 0.64, fog: '#efe0bd', sunPos: [10, 95, -20], cloud: '#fffaf0' }
  };

  var SURF = {
    rumput: { base: '#4c8a3a', a: '#5d9c47', b: '#3d7430', worn: '#9a7a50', out: '#3f6e31', line: '#f4f1e6', det: 'grass' },
    sawah: { base: '#a58c5a', a: '#bba068', b: '#8d7548', worn: '#7d6440', out: '#9c8a55', line: '#f6f0dc', det: 'dirt' },
    pasir: { base: '#e2c891', a: '#ecd6a2', b: '#d4b87e', worn: '#c9aa70', out: '#e6cd96', line: '#ffffff', det: 'sand' },
    semen: { base: '#9a9993', a: '#a8a7a0', b: '#8a8984', worn: '#7a7973', out: '#858480', line: '#f2efe3', det: 'concrete' },
    tanahmerah: { base: '#a05a3a', a: '#ad6845', b: '#8c4c30', worn: '#7c4329', out: '#7a5e44', line: '#f6efe4', det: 'dirt' },
    aspal: { base: '#5a5d63', a: '#64676d', b: '#4f5258', worn: '#46484d', out: '#76787c', line: '#f5f1e6', det: 'asphalt' },
    tanah: { base: '#8b6a45', a: '#9b7a52', b: '#7a5c3a', worn: '#6e5234', out: '#6f6a40', line: '#f6f1e3', det: 'dirt' },
    stadion: { base: '#3f8a35', a: '#4d9c41', b: '#357a2d', worn: '#4a8a3a', out: '#2f6a2a', line: '#ffffff', det: 'grass', neat: true }
  };

  function timeOf(arena, weather) {
    if (weather.night) return 'malam';
    if (weather.dusk) return 'senja';
    if (weather.rain) return 'mendung';
    if (weather.fog) return 'pagi';
    if (weather.dust) return 'terik';
    return arena.time || 'sore';
  }

  /* ---------- alat bantu geometri ---------- */
  var tq = new THREE.Quaternion(), te = new THREE.Euler(), tm = new THREE.Matrix4(), tv = new V3(), ts = new V3(), tu = new V3(0, 1, 0);
  function tg(g, x, y, z, rx, ry, rz, sx, sy, sz) {
    te.set(rx || 0, ry || 0, rz || 0); tq.setFromEuler(te);
    tm.compose(tv.set(x || 0, y || 0, z || 0), tq, ts.set(sx == null ? 1 : sx, sy == null ? (sx == null ? 1 : sx) : sy, sz == null ? (sx == null ? 1 : sx) : sz));
    g.applyMatrix4(tm);
    return g;
  }
  /* batang silinder dari titik a ke b */
  function bar(ax, ay, az, bx, by, bz, r, seg) {
    var d = new V3(bx - ax, by - ay, bz - az), len = d.length() || 0.001;
    var g = new THREE.CylinderGeometry(r, r, len, seg || 8, 1);
    tq.setFromUnitVectors(tu, d.normalize());
    tm.compose(tv.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2), tq, ts.set(1, 1, 1));
    g.applyMatrix4(tm);
    return g;
  }
  /* gabung beberapa geometri (sudah ditransformasi) jadi satu draw call */
  function merge(list) {
    var pos = [], nor = [], uv = [], idx = [], off = 0;
    list.forEach(function (g) {
      var p = g.attributes.position, n = g.attributes.normal, t = g.attributes.uv, i;
      for (i = 0; i < p.count; i++) {
        pos.push(p.getX(i), p.getY(i), p.getZ(i));
        if (n) nor.push(n.getX(i), n.getY(i), n.getZ(i)); else nor.push(0, 1, 0);
        if (t) uv.push(t.getX(i), t.getY(i)); else uv.push(0, 0);
      }
      if (g.index) for (i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off);
      else for (i = 0; i < p.count; i++) idx.push(i + off);
      off += p.count;
      g.dispose();
    });
    var out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    out.setIndex(idx);
    return out;
  }
  function shared(t) { t.__baShared = true; return t; }
  /* bahan khusus untuk InstancedMesh: jangan berbagi dengan mesh lain (r128 tidak membedakan ada/tidaknya warna per-instans) */
  function imat(A, color) { var m = new THREE.MeshLambertMaterial({ color: new THREE.Color(color) }); A.disposables.push(m); return m; }
  function ibasic(A, color, op) { var m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: op, depthWrite: false }); A.disposables.push(m); return m; }

  /* ======================================================================
     TEKSTUR
     ====================================================================== */
  /* detail halus yang diulang (helai rumput, butir pasir, kerikil) — abu-abu sekitar 0,5 sebagai pengali warna */
  function detailTex(kind) {
    var key = 'det_' + kind;
    if (R3.tex[key]) return R3.tex[key];
    var N = 256, rnd = U.rng(kind.length * 131 + 7);
    var t = R3.canvasTex(N, N, function (x) {
      x.fillStyle = '#808080'; x.fillRect(0, 0, N, N);
      function wrap(px, py, r, fn) {
        fn(px, py);
        if (px < r) fn(px + N, py); if (px > N - r) fn(px - N, py);
        if (py < r) fn(px, py + N); if (py > N - r) fn(px, py - N);
      }
      var i;
      if (kind === 'grass') {
        for (i = 0; i < 160; i++) { var cx = rnd() * N, cy = rnd() * N, cr = 6 + rnd() * 16, v = 100 + rnd() * 60; x.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',0.35)'; wrap(cx, cy, cr, function (a, b) { x.beginPath(); x.arc(a, b, cr, 0, 6.3); x.fill(); }); }
        for (i = 0; i < 3800; i++) {
          var px = rnd() * N, py = rnd() * N, l = 2 + rnd() * 6, an = -Math.PI / 2 + (rnd() - 0.5) * 1.2, g = Math.round(70 + rnd() * 120);
          x.strokeStyle = 'rgba(' + g + ',' + g + ',' + g + ',0.7)'; x.lineWidth = 0.8 + rnd() * 0.9;
          wrap(px, py, 8, function (a, b) { x.beginPath(); x.moveTo(a, b); x.lineTo(a + Math.cos(an) * l, b + Math.sin(an) * l); x.stroke(); });
        }
      } else if (kind === 'sand') {
        for (i = 0; i < 9000; i++) { var s = Math.round(90 + rnd() * 90); x.fillStyle = 'rgb(' + s + ',' + s + ',' + s + ')'; x.fillRect(rnd() * N, rnd() * N, 1, 1); }
        x.strokeStyle = 'rgba(160,160,160,0.35)'; x.lineWidth = 2;
        for (i = 0; i < 9; i++) { var yy = i * N / 9 + rnd() * 6; x.beginPath(); for (var k = 0; k <= 16; k++) x.lineTo(k * N / 16, yy + Math.sin(k * 0.8 + i) * 4); x.stroke(); }
      } else if (kind === 'concrete' || kind === 'asphalt') {
        var n2 = kind === 'asphalt' ? 7000 : 4500;
        for (i = 0; i < n2; i++) { var c2 = Math.round((kind === 'asphalt' ? 60 : 100) + rnd() * 110); x.fillStyle = 'rgb(' + c2 + ',' + c2 + ',' + c2 + ')'; var sz = kind === 'asphalt' ? 1 + rnd() * 2 : 1; x.fillRect(rnd() * N, rnd() * N, sz, sz); }
        x.strokeStyle = 'rgba(40,40,40,0.5)'; x.lineWidth = 1;
        for (i = 0; i < 5; i++) { var qx = rnd() * N, qy = rnd() * N; x.beginPath(); x.moveTo(qx, qy); for (var k2 = 0; k2 < 5; k2++) { qx += (rnd() - 0.5) * 50; qy += (rnd() - 0.5) * 50; x.lineTo(qx, qy); } x.stroke(); }
      } else {
        for (i = 0; i < 220; i++) { var dx = rnd() * N, dy = rnd() * N, dr = 2 + rnd() * 9, dv = Math.round(80 + rnd() * 80); x.fillStyle = 'rgba(' + dv + ',' + dv + ',' + dv + ',0.55)'; wrap(dx, dy, dr, function (a, b) { x.beginPath(); x.ellipse(a, b, dr, dr * 0.7, 0, 0, 6.3); x.fill(); }); }
        for (i = 0; i < 260; i++) { var pv = Math.round(150 + rnd() * 70); x.fillStyle = 'rgb(' + pv + ',' + pv + ',' + pv + ')'; x.beginPath(); x.arc(rnd() * N, rnd() * N, 0.8 + rnd() * 1.6, 0, 6.3); x.fill(); }
        x.strokeStyle = 'rgba(50,50,50,0.45)'; x.lineWidth = 1.2;
        for (i = 0; i < 8; i++) { var kx = rnd() * N, ky = rnd() * N; x.beginPath(); x.moveTo(kx, ky); for (var k3 = 0; k3 < 4; k3++) { kx += (rnd() - 0.5) * 40; ky += (rnd() - 0.5) * 40; x.lineTo(kx, ky); } x.stroke(); }
      }
    }, { repeat: [1, 1] });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (R3.renderer) t.anisotropy = Math.min(8, R3.renderer.capabilities.getMaxAnisotropy());
    shared(t);
    R3.tex[key] = t;
    return t;
  }

  /* warna dasar lapangan: belang potongan rumput, bercak, area botak di mulut gawang */
  function fieldTex(surfKey, q) {
    var S = SURF[surfKey] || SURF.rumput;
    var LW = F.L + 8, WW = F.W + 8;
    var cw = q === 0 ? 512 : (q === 1 ? 1024 : 2048), ch = Math.max(64, Math.round(cw * WW / LW));
    var s = cw / LW;
    return R3.canvasTex(cw, ch, function (x, w, h) {
      x.fillStyle = S.base; x.fillRect(0, 0, w, h);
      var rnd = U.rng(surfKey.length * 97 + 13 + F.n);
      var i;
      if (surfKey === 'rumput' || surfKey === 'stadion') {
        var stripes = Math.max(8, Math.round(F.L / 5.5)), sw = F.L / stripes;
        for (i = 0; i < stripes; i++) { x.fillStyle = i % 2 ? S.a : S.base; x.fillRect((4 + i * sw) * s, 0, sw * s + 1, h); }
        // potongan melintang samar (pola kotak-kotak)
        x.globalAlpha = 0.18;
        for (i = 0; i < Math.round(F.W / 6); i++) { x.fillStyle = i % 2 ? S.b : S.a; x.fillRect(0, (4 + i * 6) * s, w, 6 * s); }
        x.globalAlpha = 1;
      } else if (surfKey === 'sawah') {
        x.strokeStyle = S.a; x.lineWidth = Math.max(1, s * 0.12);
        for (i = 0; i < h; i += Math.max(3, s * 0.45)) { x.beginPath(); x.moveTo(0, i + rnd() * 2); x.lineTo(w, i + rnd() * 2); x.stroke(); }
      } else if (surfKey === 'pasir') {
        x.strokeStyle = S.a; x.lineWidth = Math.max(1, s * 0.2);
        for (i = 0; i < 70; i++) { var yy = rnd() * h; x.beginPath(); x.moveTo(0, yy); x.bezierCurveTo(w * 0.3, yy + 8, w * 0.6, yy - 8, w, yy + 3); x.stroke(); }
      }
      // bercak warna (stadion: rumput rapi, hampir tanpa bercak & area botak)
      var nb = S.neat ? 20 : Math.round(200 * (F.L / 44));
      for (i = 0; i < nb; i++) {
        x.globalAlpha = 0.12 + rnd() * 0.22;
        x.fillStyle = rnd() < 0.5 ? S.a : S.b;
        var rr = (0.4 + rnd() * 2.2) * s;
        x.beginPath(); x.ellipse(rnd() * w, rnd() * h, rr * (1 + rnd()), rr, rnd() * 3, 0, Math.PI * 2); x.fill();
      }
      // area botak: mulut gawang, titik penalti, lingkaran tengah, jalur sepanjang garis samping
      x.fillStyle = S.worn;
      var spots = S.neat ? [] : [[4 + 1.6, WW / 2, 2.6], [LW - 5.6, WW / 2, 2.6], [4 + F.pen, WW / 2, 1.4], [LW - 4 - F.pen, WW / 2, 1.4], [LW / 2, WW / 2, F.circle * 0.6]];
      spots.forEach(function (c) {
        for (var j = 0; j < 22; j++) {
          x.globalAlpha = 0.1 + rnd() * 0.18;
          x.beginPath(); x.ellipse(c[0] * s + (rnd() - 0.5) * c[2] * 2 * s, c[1] * s + (rnd() - 0.5) * c[2] * 2.4 * s, (0.6 + rnd() * c[2]) * s, (0.5 + rnd() * c[2] * 0.8) * s, rnd() * 3, 0, Math.PI * 2); x.fill();
        }
      });
      x.globalAlpha = S.neat ? 0.03 : 0.12;
      for (i = 0; i < 40; i++) { var tx = (4 + rnd() * F.L) * s; x.beginPath(); x.ellipse(tx, (4 + rnd() * 1.2) * s, 1.2 * s, 0.4 * s, 0, 0, 6.3); x.fill(); x.beginPath(); x.ellipse(tx, (WW - 4 - rnd() * 1.2) * s, 1.2 * s, 0.4 * s, 0, 0, 6.3); x.fill(); }
      if (surfKey === 'semen' || surfKey === 'aspal' || surfKey === 'tanahmerah') {
        x.globalAlpha = 0.35; x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 1.5;
        for (i = 0; i < 26; i++) { var px = rnd() * w, py = rnd() * h; x.beginPath(); x.moveTo(px, py); for (var k2 = 0; k2 < 5; k2++) { px += (rnd() - 0.5) * 40; py += (rnd() - 0.5) * 40; x.lineTo(px, py); } x.stroke(); }
      }
      x.globalAlpha = 1;
    }, { aniso: true });
  }

  function netTex() {
    if (R3.tex.net2) return R3.tex.net2;
    var t = R3.canvasTex(64, 64, function (x, w, h) {
      x.clearRect(0, 0, w, h);
      x.strokeStyle = 'rgba(255,255,255,1)'; x.lineWidth = 3.2; x.lineCap = 'round';
      // jaring belah ketupat
      x.beginPath(); x.moveTo(0, h / 2); x.lineTo(w / 2, 0); x.lineTo(w, h / 2); x.lineTo(w / 2, h); x.closePath(); x.stroke();
      x.lineWidth = 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(2, 2); x.moveTo(w, h); x.lineTo(w - 2, h - 2); x.stroke();
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    shared(t);
    R3.tex.net2 = t;
    return t;
  }

  function textTex(w, h, bg, fg, lines, font) {
    return R3.canvasTex(w, h, function (x) {
      x.fillStyle = bg; x.fillRect(0, 0, w, h);
      x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
      var fs = Math.floor(h / (lines.length + 0.6));
      x.font = (font || 'bold ') + fs + 'px Bungee, Impact, sans-serif';
      lines.forEach(function (l, i) { x.fillText(l, w / 2, h * (i + 1) / (lines.length + 1)); });
    });
  }

  /* dinding rumah: jendela berkusen, gorden, pintu kayu, lubang angin, plin */
  function houseTex() {
    if (R3.tex.house) return R3.tex.house;
    var t = R3.canvasTex(256, 256, function (x, w, h) {
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
      var rnd = U.rng(5);
      for (var i = 0; i < 70; i++) { x.fillStyle = 'rgba(120,110,95,' + (0.03 + rnd() * 0.06) + ')'; x.fillRect(rnd() * w, rnd() * h, 6 + rnd() * 30, 4 + rnd() * 24); }
      x.fillStyle = '#9a948a'; x.fillRect(0, h - 26, w, 26);
      x.fillStyle = 'rgba(0,0,0,0.2)'; x.fillRect(0, h - 28, w, 3);
      // jendela kiri & kanan
      [[22, 92], [178, 92]].forEach(function (p) {
        x.fillStyle = '#5a3a22'; x.fillRect(p[0] - 4, p[1] - 4, 64, 78);
        var g = x.createLinearGradient(0, p[1], 0, p[1] + 70); g.addColorStop(0, '#1d2a3a'); g.addColorStop(1, '#33475e');
        x.fillStyle = g; x.fillRect(p[0], p[1], 56, 70);
        x.fillStyle = '#c84a3a'; x.fillRect(p[0] + 2, p[1] + 2, 14, 66); x.fillRect(p[0] + 40, p[1] + 2, 14, 66);
        x.fillStyle = '#5a3a22'; x.fillRect(p[0] + 26, p[1], 4, 70); x.fillRect(p[0], p[1] + 33, 56, 4);
        x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(p[0] + 18, p[1] + 4, 6, 26);
        // lubang angin (roster)
        for (var r = 0; r < 4; r++) { x.fillStyle = '#7a7268'; x.fillRect(p[0] + 4 + r * 13, p[1] - 30, 10, 14); x.fillStyle = '#3a342e'; x.fillRect(p[0] + 6 + r * 13, p[1] - 28, 6, 10); }
      });
      // pintu
      x.fillStyle = '#4a2c18'; x.fillRect(98, 92, 62, 140);
      x.fillStyle = '#6e4426'; x.fillRect(104, 98, 50, 128);
      x.strokeStyle = '#4a2c18'; x.lineWidth = 3; x.strokeRect(110, 106, 38, 46); x.strokeRect(110, 164, 38, 54);
      x.fillStyle = '#e8c860'; x.beginPath(); x.arc(146, 166, 3, 0, 6.3); x.fill();
      x.fillStyle = '#d8d0c0'; x.fillRect(96, 230, 66, 6);
    });
    shared(t);
    R3.tex.house = t;
    return t;
  }
  /* jendela menyala di malam hari (peta emisi) */
  function houseGlowTex() {
    if (R3.tex.houseGlow) return R3.tex.houseGlow;
    var t = R3.canvasTex(256, 256, function (x, w, h) {
      x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
      [[22, 92], [178, 92]].forEach(function (p) { x.fillStyle = '#ffcf7a'; x.fillRect(p[0] + 16, p[1] + 2, 24, 66); x.fillStyle = '#a0602a'; x.fillRect(p[0] + 2, p[1] + 2, 14, 66); x.fillRect(p[0] + 40, p[1] + 2, 14, 66); });
    });
    shared(t);
    R3.tex.houseGlow = t;
    return t;
  }
  function roofTex() {
    if (R3.tex.roof) return R3.tex.roof;
    var t = R3.canvasTex(128, 128, function (x, w, h) {
      x.fillStyle = '#bdbdbd'; x.fillRect(0, 0, w, h);
      for (var r = 0; r < 8; r++) {
        for (var c = 0; c < 8; c++) {
          var ox = c * 16 + (r % 2) * 8, oy = r * 16;
          var g = x.createLinearGradient(0, oy, 0, oy + 16); g.addColorStop(0, '#f2f2f2'); g.addColorStop(0.7, '#c8c8c8'); g.addColorStop(1, '#7a7a7a');
          x.fillStyle = g; x.beginPath(); x.moveTo(ox, oy); x.lineTo(ox + 16, oy); x.quadraticCurveTo(ox + 16, oy + 16, ox + 8, oy + 16); x.quadraticCurveTo(ox, oy + 16, ox, oy); x.fill();
        }
      }
    }, { repeat: [1, 1] });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    shared(t);
    R3.tex.roof = t;
    return t;
  }
  /* daun kelapa (pelepah dengan anak daun) & daun pisang — kanal alfa */
  function frondTex() {
    if (R3.tex.frond) return R3.tex.frond;
    var t = R3.canvasTex(64, 256, function (x, w, h) {
      x.clearRect(0, 0, w, h);
      x.strokeStyle = '#6e7a3a'; x.lineWidth = 3; x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, h); x.stroke();
      for (var i = 6; i < h - 4; i += 5) {
        var l = (w / 2 - 2) * Math.sin(Math.min(1, i / h * 1.25) * Math.PI * 0.95 + 0.1);
        var gcol = ['#4f8a36', '#5c9a3e', '#43782e', '#6aa848'][i % 4];
        x.strokeStyle = gcol; x.lineWidth = 2.6;
        x.beginPath(); x.moveTo(w / 2, i); x.lineTo(w / 2 - l, i + 9); x.stroke();
        x.beginPath(); x.moveTo(w / 2, i); x.lineTo(w / 2 + l, i + 9); x.stroke();
      }
    });
    shared(t);
    R3.tex.frond = t;
    return t;
  }
  function bananaTex() {
    if (R3.tex.banana) return R3.tex.banana;
    var t = R3.canvasTex(128, 256, function (x, w, h) {
      x.clearRect(0, 0, w, h);
      var g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#3f7a2c'); g.addColorStop(0.5, '#6cae46'); g.addColorStop(1, '#3f7a2c');
      x.fillStyle = g;
      x.beginPath(); x.moveTo(w / 2, 0);
      for (var i = 0; i <= 20; i++) { var yy = i / 20 * h, ww = Math.sin(i / 20 * Math.PI) * (w / 2 - 6); x.lineTo(w / 2 + ww + (i % 3 === 0 ? -6 : 0), yy); }
      for (i = 20; i >= 0; i--) { var y2 = i / 20 * h, w2 = Math.sin(i / 20 * Math.PI) * (w / 2 - 6); x.lineTo(w / 2 - w2 + (i % 4 === 0 ? 7 : 0), y2); }
      x.fill();
      x.strokeStyle = '#d9e8a8'; x.lineWidth = 3; x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, h); x.stroke();
      x.strokeStyle = 'rgba(30,70,20,0.45)'; x.lineWidth = 1;
      for (i = 8; i < h; i += 7) { x.beginPath(); x.moveTo(w / 2, i); x.lineTo(6, i + 16); x.moveTo(w / 2, i); x.lineTo(w - 6, i + 16); x.stroke(); }
    });
    shared(t);
    R3.tex.banana = t;
    return t;
  }
  function cloudTex() {
    if (R3.tex.cloud) return R3.tex.cloud;
    var t = R3.canvasTex(256, 128, function (x, w, h) {
      x.clearRect(0, 0, w, h);
      var rnd = U.rng(77);
      for (var i = 0; i < 26; i++) {
        var cx = 30 + rnd() * (w - 60), cy = h * 0.55 + (rnd() - 0.5) * h * 0.35 - Math.sin((cx / w) * Math.PI) * 18, r = 16 + rnd() * 30;
        var g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, 'rgba(255,255,255,0.75)'); g.addColorStop(0.6, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
    });
    shared(t);
    R3.tex.cloud = t;
    return t;
  }
  var ADS = [
    ['#d62828', '#fff3c4', 'WARUNG BU TINI', 'Nasi pecel · kopi tubruk'], ['#1d3557', '#ffd166', 'BENGKEL JAYA', 'Tambal ban 24 jam'],
    ['#2a9d8f', '#ffffff', 'BAKSO MAS JOKO', 'Pedasnya bikin gol'], ['#ffb703', '#2b1a10', 'ES DAWET AYU', 'Segar sehabis tanding'],
    ['#6a4c93', '#ffffff', 'PULSA MURAH', 'Kuota buat nonton ulang'], ['#e76f51', '#ffffff', 'SATE MADURA CAK MAN', 'Buka sampai larut']
  ];
  function adTex(i) {
    var key = 'ad' + i;
    if (R3.tex[key]) return R3.tex[key];
    var a = ADS[i % ADS.length];
    var t = R3.canvasTex(512, 96, function (x, w, h) {
      var g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, a[0]); g.addColorStop(1, U.mixHex(a[0], '#000000', 0.25));
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = a[1]; x.textAlign = 'left'; x.textBaseline = 'middle';
      x.font = 'bold 44px Bungee, Impact, sans-serif'; x.fillText(a[2], 18, h * 0.42);
      x.font = 'bold 20px Barlow Semi Condensed, Arial Narrow, sans-serif'; x.globalAlpha = 0.85; x.fillText(a[3], 20, h * 0.82); x.globalAlpha = 1;
      x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(0, 0, w, 4);
    });
    shared(t);
    R3.tex[key] = t;
    return t;
  }

  /* ======================================================================
     LAPANGAN: permukaan + garis geometri
     ====================================================================== */
  function buildField(A, S, surfKey, q) {
    var G = A.group;
    var tex = fieldTex(surfKey, q);
    A.disposables.push(tex);
    var mat = new THREE.MeshLambertMaterial({ map: tex });
    if (q > 0) {
      var det = detailTex(S.det), rep = new THREE.Vector2((F.L + 8) / 2.4, (F.W + 8) / 2.4), amt = S.det === 'grass' ? 0.85 : 0.7;
      mat.onBeforeCompile = function (sh) {
        sh.uniforms.detailMap = { value: det }; sh.uniforms.detailRep = { value: rep }; sh.uniforms.detailAmt = { value: amt };
        sh.fragmentShader = 'uniform sampler2D detailMap; uniform vec2 detailRep; uniform float detailAmt;\n' + sh.fragmentShader.replace('#include <map_fragment>',
          '#include <map_fragment>\n  diffuseColor.rgb *= mix(1.0, texture2D(detailMap, vUv * detailRep).r * 2.0, detailAmt);');
      };
      mat.customProgramCacheKey = function () { return 'field-detail'; };
    }
    var field = new THREE.Mesh(new THREE.PlaneGeometry(F.L + 8, F.W + 8), mat);
    field.rotation.x = -Math.PI / 2; field.receiveShadow = true;
    G.add(field);
    A.field = field;
    // garis putih sebagai geometri: tetap tajam di lapangan sebesar apa pun
    var lw = F.n >= 7 ? 0.12 : 0.1, quads = [];
    var seg = function (x0, z0, x1, z1) {
      var dx = x1 - x0, dz = z1 - z0, l = Math.sqrt(dx * dx + dz * dz) || 1, nx = -dz / l * lw / 2, nz = dx / l * lw / 2;
      quads.push([x0 + nx, z0 + nz, x1 + nx, z1 + nz, x1 - nx, z1 - nz, x0 - nx, z0 - nz]);
    };
    var arc = function (cx, cz, r, a0, a1, n) {
      n = n || Math.max(12, Math.round(Math.abs(a1 - a0) * r * 3));
      for (var i = 0; i < n; i++) {
        var t0 = a0 + (a1 - a0) * i / n, t1 = a0 + (a1 - a0) * (i + 1) / n;
        var ri = r - lw / 2, ro = r + lw / 2;
        quads.push([cx + Math.cos(t0) * ro, cz + Math.sin(t0) * ro, cx + Math.cos(t1) * ro, cz + Math.sin(t1) * ro, cx + Math.cos(t1) * ri, cz + Math.sin(t1) * ri, cx + Math.cos(t0) * ri, cz + Math.sin(t0) * ri]);
      }
    };
    var disc = function (cx, cz, r) { arc(cx, cz, r / 2, 0, Math.PI * 2, 16); arc(cx, cz, r / 4, 0, Math.PI * 2, 12); };
    var L2 = F.L / 2, W2 = F.W / 2;
    seg(-L2, -W2, L2, -W2); seg(-L2, W2, L2, W2); seg(-L2, -W2, -L2, W2); seg(L2, -W2, L2, W2);
    seg(0, -W2, 0, W2);
    arc(0, 0, F.circle, 0, Math.PI * 2);
    disc(0, 0, 0.3);
    [-1, 1].forEach(function (s) {
      var gx = s * L2, bx = s * (L2 - F.boxL);
      seg(gx, -F.boxW / 2, bx, -F.boxW / 2); seg(gx, F.boxW / 2, bx, F.boxW / 2); seg(bx, -F.boxW / 2, bx, F.boxW / 2);
      if (F.sixL > 0) { var sx = s * (L2 - F.sixL); seg(gx, -F.sixW / 2, sx, -F.sixW / 2); seg(gx, F.sixW / 2, sx, F.sixW / 2); seg(sx, -F.sixW / 2, sx, F.sixW / 2); }
      var px = s * (L2 - F.pen);
      disc(px, 0, 0.26);
      if (F.arc > 0) {
        var dxb = F.boxL - F.pen; // jarak titik penalti ke garis kotak
        if (dxb < F.arc) { var a = Math.acos(dxb / F.arc); if (s > 0) arc(px, 0, F.arc, Math.PI - a, Math.PI + a); else arc(px, 0, F.arc, -a, a); }
      }
      // busur sudut
      [-1, 1].forEach(function (k) {
        var cx = gx, cz = k * W2, r = F.n >= 7 ? 1 : 0.8;
        var a0 = s > 0 ? (k > 0 ? Math.PI : Math.PI / 2) : (k > 0 ? -Math.PI / 2 : 0);
        arc(cx, cz, r, a0, a0 + Math.PI / 2, 10);
      });
    });
    var pos = new Float32Array(quads.length * 12), idx = [], j = 0;
    quads.forEach(function (qd, i) {
      for (var k = 0; k < 4; k++) { pos[j++] = qd[k * 2]; pos[j++] = 0.012; pos[j++] = qd[k * 2 + 1]; }
      var b = i * 4; idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
    });
    var lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    lg.setIndex(idx);
    lg.computeVertexNormals();
    var lm = new THREE.MeshLambertMaterial({ color: new THREE.Color(S.line), transparent: true, opacity: surfKey === 'pasir' ? 0.75 : 0.93, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide });
    var lines = new THREE.Mesh(lg, lm); lines.receiveShadow = true; lines.renderOrder = 1;
    G.add(lines);
  }

  /* ======================================================================
     GAWANG: rangka berlapis, jaring belakang menggembung, jaring atap & samping
     ====================================================================== */
  function buildGoals(A, arena) {
    A.goals = [];
    var wood = arena.fence === 'bambu' || arena.fence === 'tali';
    var postMat = R3.mat(wood ? '#d9c08a' : '#f4f3ee');
    var ntex = netTex(), cell = 0.13;
    var nmat = new THREE.MeshLambertMaterial({ map: ntex, transparent: true, side: THREE.DoubleSide, depthWrite: false, color: 0xf2f2f0 });
    A.disposables.push(nmat);
    var W = F.goalW, H = F.goalH, Dp = F.goalD, R = 0.055 + (W - 5.2) * 0.004, H2 = H * 0.85;
    for (var s = -1; s <= 1; s += 2) {
      var gx = s * F.L / 2;
      var g = new THREE.Group(); g.position.x = gx; A.group.add(g);
      var parts = [];
      [-1, 1].forEach(function (k) {
        parts.push(tg(new THREE.CylinderGeometry(R, R, H + R, 12), 0, (H + R) / 2, k * W / 2));
        parts.push(tg(new THREE.CylinderGeometry(R * 0.45, R * 0.45, H2, 8), s * Dp, H2 / 2, k * W / 2));
        parts.push(bar(0, H, k * W / 2, s * Dp, H2, k * W / 2, R * 0.4));
        parts.push(bar(0, 0.03, k * W / 2, s * Dp, 0.03, k * W / 2, R * 0.4));
        if (wood) parts.push(tg(new THREE.CylinderGeometry(R * 1.25, R * 1.25, 0.05, 12), 0, H * 0.33, k * W / 2), tg(new THREE.CylinderGeometry(R * 1.25, R * 1.25, 0.05, 12), 0, H * 0.7, k * W / 2));
      });
      parts.push(tg(new THREE.CylinderGeometry(R, R, W + R * 2, 12), 0, H, 0, Math.PI / 2));
      parts.push(tg(new THREE.CylinderGeometry(R * 0.4, R * 0.4, W, 8), s * Dp, H2, 0, Math.PI / 2));
      parts.push(tg(new THREE.CylinderGeometry(R * 0.4, R * 0.4, W, 8), s * Dp, 0.03, 0, Math.PI / 2));
      var frame = new THREE.Mesh(merge(parts), postMat); frame.castShadow = true;
      g.add(frame);
      A.disposables.push(frame.geometry);
      // jaring belakang (dipakai untuk efek menggembung)
      var backGeo = new THREE.PlaneGeometry(W, H2, 20, 10);
      var bu = backGeo.attributes.uv, bp = backGeo.attributes.position, i;
      for (i = 0; i < bu.count; i++) bu.setXY(i, bu.getX(i) * W / cell, bu.getY(i) * H2 / cell);
      for (i = 0; i < bp.count; i++) { var vy = bp.getY(i) / H2 + 0.5, vx = bp.getX(i) / W + 0.5; bp.setZ(i, s * (1 - vy) * 0.18 * Math.sin(vx * Math.PI)); }
      var back = new THREE.Mesh(backGeo, nmat); back.rotation.y = Math.PI / 2; back.position.set(s * Dp, H2 / 2, 0); back.renderOrder = 2;
      g.add(back);
      // atap jaring (miring dari mistar ke rangka belakang)
      var tl = Math.sqrt(Dp * Dp + (H - H2) * (H - H2));
      var topGeo = new THREE.BufferGeometry();
      topGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, H, -W / 2, s * Dp, H2, -W / 2, s * Dp, H2, W / 2, 0, H, W / 2], 3));
      topGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, tl / cell, 0, tl / cell, W / cell, 0, W / cell], 2));
      topGeo.setIndex([0, 1, 2, 0, 2, 3]); topGeo.computeVertexNormals();
      var top = new THREE.Mesh(topGeo, nmat); top.renderOrder = 2;
      g.add(top);
      // jaring samping (trapesium)
      [-1, 1].forEach(function (k) {
        var sg = new THREE.BufferGeometry();
        var p = [0, 0, 0, s * Dp, 0, 0, s * Dp, H2, 0, 0, H, 0];
        var uv = [0, 0, Dp / cell, 0, Dp / cell, H2 / cell, 0, H / cell];
        sg.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
        sg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        sg.setIndex([0, 1, 2, 0, 2, 3]); sg.computeVertexNormals();
        var side = new THREE.Mesh(sg, nmat); side.position.z = k * W / 2; side.renderOrder = 2;
        g.add(side);
      });
      var base = backGeo.attributes.position.array.slice(0);
      A.goals.push({ side: s, back: back, geo: backGeo, base: base, imp: 0, iz: 0, iy: 0 });
    }
  }

  /* ---------- pagar ---------- */
  function buildFence(A, arena, rnd) {
    var G = A.group, style = arena.fence;
    var wz = F.W / 2 + 1.15 + (F.n >= 7 ? 1.4 : 0), wx = F.L / 2 + 1.5 + (F.n >= 7 ? 1.6 : 0);
    var segs = [];
    segs.push([-wx, -wz, wx, -wz], [-wx, wz, wx, wz]);
    [-1, 1].forEach(function (s) { segs.push([s * wx, -wz, s * wx, -F.goalW / 2 - 0.1], [s * wx, F.goalW / 2 + 0.1, s * wx, wz]); });
    A.fenceZ = wz; A.fenceX = wx;
    var col = { bambu: '#c9a463', tali: '#b98f53', besi: '#2f6b4f', tembok: '#a7a49c', jaring: '#9aa3a8' }[style] || '#c9a463';
    var poleH = { bambu: 1.15, tali: 0.7, besi: 1.2, tembok: 1.2, jaring: 2.4 }[style] || 1.1;
    if (style === 'tembok') {
      var wallTex = R3.canvasTex(256, 64, function (x, w, h) {
        x.fillStyle = '#a7a49c'; x.fillRect(0, 0, w, h);
        var cols = ['#ff4d6d', '#ffd60a', '#4cc9f0', '#80ed99', '#ff7b00', '#c77dff'];
        for (var i = 0; i < 14; i++) { x.globalAlpha = 0.85; x.fillStyle = cols[i % cols.length]; x.beginPath(); x.ellipse(rnd() * w, rnd() * h, 8 + rnd() * 26, 5 + rnd() * 14, rnd() * 3, 0, Math.PI * 2); x.fill(); }
        x.globalAlpha = 1; x.font = 'bold 26px Bungee, Impact, sans-serif'; x.fillStyle = '#111'; x.fillText('BOLA API', 60 + rnd() * 60, 42);
      }, { repeat: [1, 1] });
      wallTex.wrapS = THREE.RepeatWrapping;
      A.disposables.push(wallTex);
      segs.forEach(function (sg) {
        var len = Math.hypot(sg[2] - sg[0], sg[3] - sg[1]);
        var t2 = wallTex.clone(); t2.needsUpdate = true; t2.wrapS = THREE.RepeatWrapping; t2.repeat.set(Math.max(1, len / 8), 1);
        var m = new THREE.Mesh(new THREE.BoxGeometry(len, poleH, 0.3), new THREE.MeshLambertMaterial({ map: t2 }));
        m.position.set((sg[0] + sg[2]) / 2, poleH / 2, (sg[1] + sg[3]) / 2);
        m.rotation.y = -Math.atan2(sg[3] - sg[1], sg[2] - sg[0]);
        G.add(m);
      });
      return;
    }
    var poles = [], rails = [];
    segs.forEach(function (sg) {
      var len = Math.hypot(sg[2] - sg[0], sg[3] - sg[1]);
      var n = Math.max(1, Math.round(len / (style === 'tali' ? 3 : 2.2)));
      for (var i = 0; i <= n; i++) poles.push([U.lerp(sg[0], sg[2], i / n), U.lerp(sg[1], sg[3], i / n)]);
      var ry = style === 'tali' ? [0.55] : (style === 'jaring' ? [2.35, 0.1] : [0.45, 1.0]);
      ry.forEach(function (h) { rails.push(bar(sg[0], h, sg[1], sg[2], h, sg[3], style === 'tali' ? 0.015 : 0.035, 6)); });
      if (style === 'jaring') {
        var nt = netTex().clone(); nt.needsUpdate = true; nt.wrapS = nt.wrapT = THREE.RepeatWrapping; nt.repeat.set(len / 0.35, poleH / 0.35);
        A.disposables.push(nt);
        var nm = new THREE.Mesh(new THREE.PlaneGeometry(len, poleH), new THREE.MeshLambertMaterial({ map: nt, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, color: 0x9aa3a8 }));
        nm.position.set((sg[0] + sg[2]) / 2, poleH / 2, (sg[1] + sg[3]) / 2); nm.rotation.y = -Math.atan2(sg[3] - sg[1], sg[2] - sg[0]);
        G.add(nm);
      }
    });
    var rm = new THREE.Mesh(merge(rails), R3.mat(style === 'tali' ? '#e6dcc4' : col)); G.add(rm); A.disposables.push(rm.geometry);
    var inst = new THREE.InstancedMesh(R3.geo.cyl6, imat(A, col), poles.length);
    var m4 = new THREE.Matrix4(), cc = new THREE.Color(col), c2 = new THREE.Color();
    poles.forEach(function (p, i) {
      m4.makeScale(0.05, poleH, 0.05); m4.setPosition(p[0], poleH / 2, p[1]);
      inst.setMatrixAt(i, m4);
      c2.copy(cc).multiplyScalar(0.85 + rnd() * 0.3); inst.setColorAt(i, c2);
    });
    inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    G.add(inst);
  }

  /* ---------- papan iklan warung di lapangan besar ---------- */
  function buildBoards(A, rnd) {
    if (F.n < 7) return;
    var dz = F.W / 2 + 1.75, dx = F.L / 2 + 2.8, BL = 7, BH = 0.9;
    var byAd = {};
    var add = function (x, z, ry, len) {
      var ad = Math.floor(rnd() * ADS.length);
      var list = byAd[ad] || (byAd[ad] = []);
      var pl = new THREE.PlaneGeometry(len, BH);
      list.push(tg(pl, x, BH / 2 + 0.05, z, 0, ry, 0));
    };
    [-1, 1].forEach(function (k) {
      var n = Math.floor(F.L / BL);
      for (var i = 0; i < n; i++) { var x = -F.L / 2 + BL / 2 + i * BL + (F.L - n * BL) / 2; add(x, k * dz, k > 0 ? Math.PI : 0, BL - 0.15); }
      [-1, 1].forEach(function (s) {
        var m = Math.floor((F.W / 2 - F.goalW / 2 - 3) / BL);
        for (var j = 0; j < m; j++) { var z = k * (F.goalW / 2 + 3 + BL / 2 + j * BL); add(s * dx, z, s > 0 ? -Math.PI / 2 : Math.PI / 2, BL - 0.15); }
      });
    });
    Object.keys(byAd).forEach(function (a) {
      var m = new THREE.Mesh(merge(byAd[a]), new THREE.MeshLambertMaterial({ map: adTex(+a), side: THREE.DoubleSide }));
      A.group.add(m); A.disposables.push(m.geometry);
    });
  }

  /* ---------- tali bendera segitiga merah putih ---------- */
  function buildBunting(A, rnd, colors) {
    var z = (A.fenceZ || F.W / 2 + 1.2) + 0.25, x0 = -(A.fenceX || F.L / 2 + 1.5), x1 = -x0;
    var span = F.n >= 7 ? 9 : 7.5, poleH = 3.1, sag = 0.45;
    var tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.13, 0, 0, 0.13, 0, 0, 0, -0.3, 0], 3));
    tri.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    tri.setIndex([0, 1, 2]);
    var flags = [], poles = [], lines = [];
    [-1, 1].forEach(function (k) {
      var n = Math.max(2, Math.round((x1 - x0) / span));
      for (var i = 0; i <= n; i++) poles.push([x0 + (x1 - x0) * i / n, k * z]);
      for (i = 0; i < n; i++) {
        var ax = x0 + (x1 - x0) * i / n, bx = x0 + (x1 - x0) * (i + 1) / n, cnt = Math.round((bx - ax) / 0.36);
        var prev = null;
        for (var f = 0; f <= cnt; f++) {
          var t = f / cnt, x = U.lerp(ax, bx, t), y = poleH - 0.1 - Math.sin(t * Math.PI) * sag;
          if (prev) lines.push(prev[0], prev[1], k * z, x, y, k * z);
          prev = [x, y];
          if (f > 0 && f < cnt) flags.push({ x: x, y: y, z: k * z, c: colors[(f + i) % colors.length], ph: rnd() * 6, k: k });
        }
      }
    });
    var im = new THREE.InstancedMesh(tri, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), flags.length);
    var c = new THREE.Color(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new V3(), sc = new V3(1, 1, 1);
    flags.forEach(function (f, i) { c.set(f.c); im.setColorAt(i, c); });
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    A.group.add(im); A.disposables.push(tri);
    var lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    A.group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x3a3028 })));
    var pi = new THREE.InstancedMesh(R3.geo.cyl6, imat(A, '#c9a463'), poles.length);
    poles.forEach(function (pp, i) { m4.makeScale(0.045, poleH, 0.045); m4.setPosition(pp[0], poleH / 2, pp[1]); pi.setMatrixAt(i, m4); });
    pi.instanceMatrix.needsUpdate = true; A.group.add(pi);
    var acc = 0;
    var place = function (t) {
      var wind = A.windMag || 1;
      for (var i = 0; i < flags.length; i++) {
        var f = flags[i];
        e.set(Math.sin(t * 3.2 * wind + f.ph + f.x * 0.3) * 0.35 * wind * f.k, 0, Math.sin(t * 2.1 + f.ph) * 0.08);
        q.setFromEuler(e); p.set(f.x, f.y, f.z); m4.compose(p, q, sc); im.setMatrixAt(i, m4);
      }
      im.instanceMatrix.needsUpdate = true;
    };
    place(0);
    A.updaters.push(function (dt, t) { acc += dt; if (acc > 1 / 20) { acc = 0; place(t); } });
  }

  /* ======================================================================
     PENONTON: badan, kepala, rambut, kaki, tangan (instanced) + tribun bambu
     ====================================================================== */
  function buildCrowd(A, rnd, q, tk) {
    var base = [36, 72, 110][q], mult = F.n >= 11 ? 1.6 : (F.n >= 7 ? 1.3 : 1);
    var n = Math.round(base * mult);
    var spots = [];
    var wz = (A.fenceZ || F.W / 2 + 1.15);
    var big = F.n >= 7;
    var benches = [];
    var stadium = A.arena && A.arena.id === 'stadion';
    if (stadium) {
      n = Math.round(n * 2.2);
      var SR = 10, z0 = wz + 3.2;
      [-1, 1].forEach(function (k) { for (var r = 0; r < SR; r++) benches.push({ y: 0.55 + r * 0.55, z: k * (z0 + 0.5 + r * 1.0), k: k, L: F.L * 0.92 }); });
      A.standRows = { n: SR, z0: z0, step: 1.0, h: 0.55 };
    } else if (big) {
      // tribun bambu tiga undak di kedua sisi panjang
      var tribL = Math.min(F.L * 0.62, 50), parts = [];
      [-1, 1].forEach(function (k) {
        for (var r = 0; r < 3; r++) {
          var zz = k * (wz + 1.6 + r * 0.9), yy = 0.45 + r * 0.45;
          parts.push(tg(new THREE.BoxGeometry(tribL, 0.08, 0.5), 0, yy, zz));
          for (var px = -tribL / 2; px <= tribL / 2 + 0.01; px += 3) parts.push(tg(new THREE.CylinderGeometry(0.05, 0.05, yy, 6), px, yy / 2, zz + k * 0.15));
          benches.push({ y: yy, z: zz, k: k, L: tribL });
        }
      });
      var trib = new THREE.Mesh(merge(parts), R3.mat('#b8925a')); trib.castShadow = false; A.group.add(trib); A.disposables.push(trib.geometry);
    }
    for (var i = 0; i < n; i++) {
      var side = i % 3 === 0 ? 1 : -1;
      if (i % 9 === 4) {
        var s = rnd() < 0.5 ? -1 : 1;
        spots.push({ x: s * ((A.fenceX || F.L / 2 + 1.5) + 1.5 + rnd() * 2.5), z: (rnd() - 0.5) * (F.W - 6), sit: 0, kid: rnd() < 0.25 });
        continue;
      }
      if (big && benches.length && rnd() < (stadium ? 0.92 : 0.55)) {
        var b = benches[Math.floor(rnd() * benches.length)];
        spots.push({ x: (rnd() - 0.5) * (b.L - 1), z: b.z, sit: b.y, kid: rnd() < 0.15 });
        continue;
      }
      spots.push({ x: (rnd() - 0.5) * (F.L + 4), z: side * (wz + 0.9 + rnd() * (big ? 0.6 : 3.2)), sit: 0, kid: rnd() < 0.2 });
    }
    var shirts = ['#e63946', '#f1faee', '#a8dadc', '#457b9d', '#ffb703', '#fb8500', '#8ecae6', '#90be6d', '#f4a261', '#cdb4db', '#2a9d8f', '#ffffff', '#264653', '#e9c46a', '#d62828', '#3a86ff'];
    var pants = ['#2b2d42', '#3d405b', '#5c4033', '#1d3557', '#6b705c', '#264653'];
    var hairs = ['#1b1410', '#2a1d14', '#3a2a1e', '#888888'];
    var torsoG = new THREE.CylinderGeometry(0.2, 0.17, 0.6, 8); torsoG.translate(0, 0.3, 0);
    var headG = new THREE.SphereGeometry(0.13, 10, 8);
    var hairG = new THREE.SphereGeometry(0.138, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55);
    var legG = new THREE.BoxGeometry(0.3, 0.74, 0.2); legG.translate(0, 0.37, 0);
    var armG = new THREE.BoxGeometry(0.09, 0.56, 0.09); armG.translate(0, -0.26, 0);
    [torsoG, headG, hairG, legG, armG].forEach(function (g) { A.disposables.push(g); });
    var N = spots.length;
    var torso = new THREE.InstancedMesh(torsoG, new THREE.MeshLambertMaterial({ color: 0xffffff }), N);
    var heads = new THREE.InstancedMesh(headG, new THREE.MeshLambertMaterial({ color: 0xffffff }), N);
    var hair = new THREE.InstancedMesh(hairG, new THREE.MeshLambertMaterial({ color: 0xffffff }), N);
    var legs = new THREE.InstancedMesh(legG, new THREE.MeshLambertMaterial({ color: 0xffffff }), N);
    var arms = new THREE.InstancedMesh(armG, new THREE.MeshLambertMaterial({ color: 0xffffff }), N * 2);
    var c = new THREE.Color();
    var data = spots.map(function (sp, i) {
      var shirt = shirts[Math.floor(rnd() * shirts.length)], skin = D.SKINS[Math.floor(rnd() * D.SKINS.length)];
      c.set(shirt); torso.setColorAt(i, c); arms.setColorAt(i * 2, c); arms.setColorAt(i * 2 + 1, c);
      c.set(skin); heads.setColorAt(i, c);
      c.set(rnd() < 0.15 ? shirts[Math.floor(rnd() * shirts.length)] : hairs[Math.floor(rnd() * hairs.length)]); hair.setColorAt(i, c);
      c.set(pants[Math.floor(rnd() * pants.length)]); legs.setColorAt(i, c);
      var face = Math.atan2(-sp.x * 0.15, -sp.z);
      return { x: sp.x, z: sp.z, sit: sp.sit, s: sp.kid ? 0.72 : 0.92 + rnd() * 0.16, ph: rnd() * 6, sp: 0.8 + rnd() * 1.6, face: face, fan: rnd() };
    });
    [torso, heads, hair, legs, arms].forEach(function (im) { if (im.instanceColor) im.instanceColor.needsUpdate = true; im.castShadow = false; A.group.add(im); });
    var m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), qa = new THREE.Quaternion(), e = new THREE.Euler(), sc = new V3(), ps = new V3(), off = new V3();
    function place(t) {
      var cheer = A.cheer, fx = A.focusX || 0;
      for (var i = 0; i < data.length; i++) {
        var d = data[i];
        var near = Math.max(0, 1 - Math.abs(d.x - fx) / 18);
        var jump = cheer > 0.05 ? Math.max(0, Math.sin(t * (6 + d.sp * 2) + d.ph)) * 0.35 * cheer : Math.max(0, Math.sin(t * d.sp + d.ph)) * 0.03;
        var seated = d.sit > 0 && cheer < 0.3;
        var by = seated ? d.sit + 0.04 - 0.74 * d.s : 0;
        if (seated) jump *= 0.3;
        e.set(0, d.face + Math.sin(t * 0.7 + d.ph) * 0.15, 0); qq.setFromEuler(e);
        var s = d.s;
        sc.set(s, s, s);
        ps.set(d.x, by + jump + 0.74 * s, d.z); m4.compose(ps, qq, sc); torso.setMatrixAt(i, m4);
        ps.set(d.x, by + jump + 1.47 * s, d.z); m4.compose(ps, qq, sc); heads.setMatrixAt(i, m4); hair.setMatrixAt(i, m4);
        if (seated) { sc.set(s, s * 0.6, s); ps.set(d.x, d.sit - 0.44 * s, d.z); } else ps.set(d.x, jump, d.z);
        m4.compose(ps, qq, sc); legs.setMatrixAt(i, m4); sc.set(s, s, s);
        // tangan: diangkat saat bersorak, sebagian melambai saat bola dekat
        var up = cheer > 0.05 ? 1 : (d.fan > 0.7 ? near * (0.5 + 0.5 * Math.sin(t * 5 + d.ph)) : 0);
        for (var k = -1; k <= 1; k += 2) {
          off.set(k * 0.24 * s, 1.3 * s, 0).applyQuaternion(qq);
          ps.set(d.x + off.x, by + jump + off.y, d.z + off.z);
          e.set(0, 0, k * (0.12 + up * (2.6 + Math.sin(t * 9 + d.ph + k) * 0.3))); qa.setFromEuler(e); qa.premultiply(qq);
          m4.compose(ps, qa, sc); arms.setMatrixAt(i * 2 + (k > 0 ? 1 : 0), m4);
        }
      }
      [torso, heads, hair, legs, arms].forEach(function (im) { im.instanceMatrix.needsUpdate = true; });
    }
    place(0);
    var acc = 0;
    A.updaters.push(function (dt, t) {
      A.cheer = Math.max(0, A.cheer - dt * 0.25);
      acc += dt;
      if (acc > (A.cheer > 0.05 ? 1 / 30 : 1 / 12)) { acc = 0; place(t); }
    });
    void tk;
  }

  /* ======================================================================
     BENDA SEKITAR: rumah, pohon, gunung, awan, tiang listrik, umbul-umbul
     ====================================================================== */
  function houses(A, list, rnd, night) {
    if (!list.length) return;
    var n = list.length;
    var bodyG = new THREE.BoxGeometry(1, 1, 1); bodyG.translate(0, 0.5, 0);
    var wm = new THREE.MeshLambertMaterial({ map: houseTex() });
    if (night) { wm.emissiveMap = houseGlowTex(); wm.emissive = new THREE.Color('#ffb860'); wm.emissiveIntensity = 0.9; }
    var walls = new THREE.InstancedMesh(bodyG, wm, n);
    var roofG = new THREE.CylinderGeometry(0.62, 0.62, 1, 3, 1); roofG.rotateZ(Math.PI / 2); roofG.rotateX(-Math.PI / 2);
    var ru = roofG.attributes.uv; for (var i = 0; i < ru.count; i++) ru.setXY(i, ru.getX(i) * 6, ru.getY(i) * 3);
    var roofs = new THREE.InstancedMesh(roofG, new THREE.MeshLambertMaterial({ map: roofTex() }), n);
    var porchG = new THREE.BoxGeometry(1, 0.06, 1);
    var porch = new THREE.InstancedMesh(porchG, new THREE.MeshLambertMaterial({ map: roofTex() }), n);
    var postG = new THREE.CylinderGeometry(0.06, 0.06, 1, 6); postG.translate(0, 0.5, 0);
    var posts = new THREE.InstancedMesh(postG, imat(A, '#6e4a2c'), n * 2);
    var stepG = new THREE.BoxGeometry(1, 0.25, 1); stepG.translate(0, 0.125, 0);
    var steps = new THREE.InstancedMesh(stepG, imat(A, '#a29c90'), n);
    [bodyG, roofG, porchG, postG, stepG].forEach(function (g) { A.disposables.push(g); });
    var wc = ['#f1e3c6', '#a8dadc', '#f6bd60', '#bde0fe', '#ffc8dd', '#cdeac0', '#e9edc9', '#ffd6a5', '#f8f9fa', '#ffe5ec'];
    var rc = ['#c0503a', '#b5442c', '#8d8d8d', '#9a5a3a', '#c86a3a', '#6a7c8a'];
    var m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color(), off = new V3(), p = new V3(), s3 = new V3();
    list.forEach(function (h, i) {
      var w = h.w || 5 + rnd() * 2.5, hh = h.h || 2.8 + rnd() * 0.9, d = h.d || 4 + rnd() * 1.5;
      e.set(0, h.r || 0, 0); qq.setFromEuler(e);
      m4.compose(p.set(h.x, 0, h.z), qq, s3.set(w, hh, d)); walls.setMatrixAt(i, m4);
      c.set(wc[Math.floor(rnd() * wc.length)]); walls.setColorAt(i, c);
      m4.compose(p.set(h.x, hh + 0.39, h.z), qq, s3.set(w * 1.12, 1.25, d * 1.04)); roofs.setMatrixAt(i, m4);
      c.set(rc[Math.floor(rnd() * rc.length)]); roofs.setColorAt(i, c); porch.setColorAt(i, c);
      // teras depan (+z lokal)
      off.set(0, 0, d / 2 + 0.75).applyQuaternion(qq);
      m4.compose(p.set(h.x + off.x, hh - 0.25, h.z + off.z), qq, s3.set(w * 0.62, 1, 1.6)); porch.setMatrixAt(i, m4);
      m4.compose(p.set(h.x + off.x, 0, h.z + off.z), qq, s3.set(w * 0.62, 1, 1.5)); steps.setMatrixAt(i, m4);
      for (var k = -1; k <= 1; k += 2) {
        var o2 = new V3(k * w * 0.29, 0, d / 2 + 1.4).applyQuaternion(qq);
        m4.compose(p.set(h.x + o2.x, 0, h.z + o2.z), qq, s3.set(1, hh - 0.25, 1)); posts.setMatrixAt(i * 2 + (k > 0 ? 1 : 0), m4);
      }
    });
    [walls, roofs, porch, posts, steps].forEach(function (im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; A.group.add(im); });
  }

  function trees(A, list, kind, rnd) {
    if (!list.length) return;
    var G = A.group, m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler(), v = new V3(), sc = new V3(), c = new THREE.Color();
    var n = list.length, i;
    if (kind === 'kelapa') {
      // batang melengkung (4 ruas), pelepah melengkung beralfa, buah kelapa
      var trunkG = new THREE.CylinderGeometry(0.15, 0.19, 1, 7); trunkG.translate(0, 0.5, 0);
      var trunks = new THREE.InstancedMesh(trunkG, imat(A, '#8a6a45'), n * 4);
      var fl = 3.6, fg = new THREE.PlaneGeometry(0.85, fl, 1, 8);
      var fp = fg.attributes.position;
      for (i = 0; i < fp.count; i++) { var yy = fp.getY(i) + fl / 2; fp.setY(i, yy); fp.setZ(i, -Math.pow(yy / fl, 2) * 1.6); }
      fg.computeVertexNormals();
      var fronds = new THREE.InstancedMesh(fg, new THREE.MeshLambertMaterial({ map: frondTex(), alphaTest: 0.5, side: THREE.DoubleSide }), n * 9);
      var nutG = new THREE.SphereGeometry(0.16, 8, 6);
      var nuts = new THREE.InstancedMesh(nutG, imat(A, '#6b7a2a'), n * 3);
      [trunkG, fg, nutG].forEach(function (g) { A.disposables.push(g); });
      list.forEach(function (t, j) {
        var h = t.h || 7 + rnd() * 3.5, lean = (rnd() - 0.5) * 0.5, dirA = rnd() * Math.PI * 2;
        var px = t.x, py = 0, pz = t.z, ang = 0;
        for (var s = 0; s < 4; s++) {
          ang = lean * (s + 1) / 4 * 1.3;
          e.set(Math.cos(dirA) * ang, 0, Math.sin(dirA) * ang); qq.setFromEuler(e);
          m4.compose(v.set(px, py, pz), qq, sc.set(1 - s * 0.08, h / 4 + 0.05, 1 - s * 0.08)); trunks.setMatrixAt(j * 4 + s, m4);
          var up = new V3(0, h / 4, 0).applyQuaternion(qq); px += up.x; py += up.y; pz += up.z;
        }
        for (var f = 0; f < 9; f++) {
          e.set(-(0.85 + rnd() * 0.45), f / 9 * Math.PI * 2 + rnd() * 0.3, 0, 'YXZ'); qq.setFromEuler(e);
          var fs = 0.8 + rnd() * 0.35;
          m4.compose(v.set(px, py - 0.1, pz), qq, sc.set(fs, fs, fs)); fronds.setMatrixAt(j * 9 + f, m4);
          c.setHSL(0.24 + rnd() * 0.05, 0.45, 0.4 + rnd() * 0.15); fronds.setColorAt(j * 9 + f, c);
        }
        for (var k = 0; k < 3; k++) { var a = k / 3 * Math.PI * 2; m4.compose(v.set(px + Math.cos(a) * 0.18, py - 0.3, pz + Math.sin(a) * 0.18), qq.identity(), sc.set(1, 1, 1)); nuts.setMatrixAt(j * 3 + k, m4); }
      });
      [trunks, fronds, nuts].forEach(function (im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; G.add(im); });
      return;
    }
    if (kind === 'pisang') {
      var stG = new THREE.CylinderGeometry(0.12, 0.17, 1, 7); stG.translate(0, 0.5, 0);
      var stems = new THREE.InstancedMesh(stG, imat(A, '#7a9a4a'), n);
      var lg = new THREE.PlaneGeometry(0.9, 2.2, 1, 6), lp = lg.attributes.position;
      for (i = 0; i < lp.count; i++) { var ly = lp.getY(i) + 1.1; lp.setY(i, ly); lp.setZ(i, -Math.pow(ly / 2.2, 2) * 1.0); }
      lg.computeVertexNormals();
      var leaves = new THREE.InstancedMesh(lg, new THREE.MeshLambertMaterial({ map: bananaTex(), alphaTest: 0.5, side: THREE.DoubleSide }), n * 6);
      [stG, lg].forEach(function (g) { A.disposables.push(g); });
      list.forEach(function (t, j) {
        var h = t.h || 2.2 + rnd() * 1.4;
        m4.compose(v.set(t.x, 0, t.z), qq.identity(), sc.set(1, h, 1)); stems.setMatrixAt(j, m4);
        for (var f = 0; f < 6; f++) {
          e.set(-(0.45 + rnd() * 0.5), f / 6 * Math.PI * 2 + rnd() * 0.5, 0, 'YXZ'); qq.setFromEuler(e);
          m4.compose(v.set(t.x, h - 0.1, t.z), qq, sc.set(1, 0.9 + rnd() * 0.4, 1)); leaves.setMatrixAt(j * 6 + f, m4);
          c.setHSL(0.25 + rnd() * 0.04, 0.4, 0.42 + rnd() * 0.14); leaves.setColorAt(j * 6 + f, c);
        }
      });
      [stems, leaves].forEach(function (im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; G.add(im); });
      return;
    }
    var trunkG2 = new THREE.CylinderGeometry(0.16, 0.26, 1, 7); trunkG2.translate(0, 0.5, 0);
    var trunks2 = new THREE.InstancedMesh(trunkG2, imat(A, '#5b4331'), n);
    A.disposables.push(trunkG2);
    if (kind === 'cemara') {
      var coneG = new THREE.ConeGeometry(1, 1, 8); coneG.translate(0, 0.5, 0);
      var cones = new THREE.InstancedMesh(coneG, imat(A, '#2f5d3a'), n * 3);
      A.disposables.push(coneG);
      list.forEach(function (t, j) {
        var h = t.h || 4 + rnd() * 3, cr = t.s || 1.5 + rnd() * 0.5;
        m4.compose(v.set(t.x, 0, t.z), qq.identity(), sc.set(0.8, h * 0.35, 0.8)); trunks2.setMatrixAt(j, m4);
        for (var k = 0; k < 3; k++) {
          m4.compose(v.set(t.x, h * (0.25 + k * 0.22), t.z), qq.identity(), sc.set(cr * (1 - k * 0.25), h * 0.42, cr * (1 - k * 0.25)));
          cones.setMatrixAt(j * 3 + k, m4); c.setHSL(0.36 + rnd() * 0.03, 0.4, 0.22 + rnd() * 0.08); cones.setColorAt(j * 3 + k, c);
        }
      });
      [trunks2, cones].forEach(function (im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; G.add(im); });
      return;
    }
    // pohon rindang (mangga, rambutan, beringin): gerombol daun dari ikosahedron bergerigi
    var blobs = kind === 'beringin' ? 7 : 4;
    var blobG = new THREE.IcosahedronGeometry(1, 1), bp = blobG.attributes.position, brnd = U.rng(3), keyMap = {};
    for (i = 0; i < bp.count; i++) {
      v.fromBufferAttribute(bp, i);
      var key = Math.round(v.x * 100) + ',' + Math.round(v.y * 100) + ',' + Math.round(v.z * 100);
      var f2 = keyMap[key] || (keyMap[key] = 0.85 + brnd() * 0.3);
      v.multiplyScalar(f2); bp.setXYZ(i, v.x, v.y, v.z);
    }
    blobG.computeVertexNormals();
    A.disposables.push(blobG);
    var crowns = new THREE.InstancedMesh(blobG, imat(A, '#ffffff'), n * blobs);
    var hue = kind === 'beringin' ? 0.3 : 0.27;
    list.forEach(function (t, j) {
      var big = kind === 'beringin';
      var h = t.h || (big ? 4 : 3 + rnd() * 2.5), cr = t.s || (big ? 4.2 : 1.8 + rnd() * 1.1), tw = big ? 3 : 1;
      m4.compose(v.set(t.x, 0, t.z), qq.identity(), sc.set(tw, h + cr * 0.4, tw)); trunks2.setMatrixAt(j, m4);
      for (var k = 0; k < blobs; k++) {
        var a = k / blobs * Math.PI * 2 + rnd(), r = k === 0 ? 0 : cr * (0.45 + rnd() * 0.3);
        var y = h + cr * 0.5 + (k === 0 ? cr * 0.25 : (rnd() - 0.3) * cr * 0.5);
        var bs = cr * (k === 0 ? 0.85 : 0.55 + rnd() * 0.25);
        e.set(rnd() * 3, rnd() * 3, rnd() * 3); qq.setFromEuler(e);
        m4.compose(v.set(t.x + Math.cos(a) * r, y, t.z + Math.sin(a) * r), qq, sc.set(bs * 1.15, bs * 0.85, bs * 1.15)); crowns.setMatrixAt(j * blobs + k, m4);
        c.setHSL(hue + rnd() * 0.05, 0.42 + rnd() * 0.1, 0.24 + rnd() * 0.1); crowns.setColorAt(j * blobs + k, c);
      }
    });
    [trunks2, crowns].forEach(function (im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; G.add(im); });
    if (kind === 'beringin') {
      // akar gantung
      var rootsN = n * 14, rg = new THREE.CylinderGeometry(0.02, 0.03, 1, 4); rg.translate(0, -0.5, 0);
      var roots = new THREE.InstancedMesh(rg, imat(A, '#6a5240'), rootsN);
      A.disposables.push(rg);
      list.forEach(function (t, j) {
        for (var k = 0; k < 14; k++) {
          var a = rnd() * Math.PI * 2, r = 1.5 + rnd() * 3.2, top = 4.6 + rnd() * 1.2;
          m4.compose(v.set(t.x + Math.cos(a) * r, top, t.z + Math.sin(a) * r), qq.identity(), sc.set(1, top - 0.2 - rnd() * 2.5, 1)); roots.setMatrixAt(j * 14 + k, m4);
        }
      });
      roots.instanceMatrix.needsUpdate = true; G.add(roots);
    }
  }

  function mountains(A, rnd, col, n, dist) {
    var g = new THREE.ConeGeometry(1, 1, 9, 2); g.translate(0, 0.5, 0);
    var p = g.attributes.position, mr = U.rng(11);
    for (var i = 0; i < p.count; i++) { var y = p.getY(i); if (y > 0.05 && y < 0.95) { p.setX(i, p.getX(i) * (0.85 + mr() * 0.3)); p.setZ(i, p.getZ(i) * (0.85 + mr() * 0.3)); } }
    g.computeVertexNormals();
    A.disposables.push(g);
    var m = new THREE.InstancedMesh(g, imat(A, col), n);
    var m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), v = new V3(), sc = new V3();
    for (i = 0; i < n; i++) {
      var a = -Math.PI * 0.9 + (i / Math.max(1, n - 1)) * Math.PI * 0.8 + (rnd() - 0.5) * 0.2;
      var r = dist + rnd() * 60;
      var h = 30 + rnd() * 45;
      m4.compose(v.set(Math.cos(a) * r, -2, Math.sin(a) * r), qq, sc.set(h * 1.6, h, h * 1.6));
      m.setMatrixAt(i, m4);
    }
    m.instanceMatrix.needsUpdate = true;
    A.group.add(m);
  }

  /* barisan pohon jauh di cakrawala */
  function treeLine(A, rnd, col, skipFn) {
    var g = new THREE.IcosahedronGeometry(1, 1), gp = g.attributes.position, km = {}, jr = U.rng(21), jv = new V3();
    for (var gi = 0; gi < gp.count; gi++) {
      jv.fromBufferAttribute(gp, gi);
      var kk = Math.round(jv.x * 100) + ',' + Math.round(jv.y * 100) + ',' + Math.round(jv.z * 100);
      jv.multiplyScalar(km[kk] || (km[kk] = 0.8 + jr() * 0.35)); gp.setXYZ(gi, jv.x, jv.y, jv.z);
    }
    g.computeVertexNormals();
    A.disposables.push(g);
    var list = [];
    var R0 = Math.max(95, F.L * 0.95);
    for (var i = 0; i < 150; i++) {
      var a = i / 150 * Math.PI * 2 + rnd() * 0.04, r = R0 + rnd() * 45;
      var x = Math.cos(a) * r, z = Math.sin(a) * r * 0.85;
      if (skipFn && skipFn(x, z)) continue;
      list.push([x, z, 3.5 + rnd() * 5]);
    }
    var m = new THREE.InstancedMesh(g, imat(A, '#ffffff'), list.length);
    var m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), v = new V3(), sc = new V3(), c = new THREE.Color();
    list.forEach(function (t, i) {
      qq.setFromEuler(new THREE.Euler(0, rnd() * 6, 0));
      m4.compose(v.set(t[0], t[2] * 1.1, t[1]), qq, sc.set(t[2] * 1.1, t[2] * 0.95, t[2] * 1.1)); m.setMatrixAt(i, m4);
      c.set(col); c.offsetHSL((rnd() - 0.5) * 0.04, 0, (rnd() - 0.5) * 0.12); m.setColorAt(i, c);
    });
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    A.group.add(m);
  }

  function clouds(A, rnd, T, tk, w) {
    var n = w.rain ? 12 : (tk === 'malam' ? 5 : 9);
    var col = new THREE.Color(T.cloud || '#ffffff');
    var list = [];
    for (var i = 0; i < n; i++) {
      var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex(), color: col, transparent: true, opacity: w.rain ? 0.85 : (tk === 'malam' ? 0.35 : 0.75), depthWrite: false, fog: false }));
      var a = rnd() * Math.PI * 2, r = 170 + rnd() * 90;
      s.position.set(Math.cos(a) * r, 55 + rnd() * 55, Math.sin(a) * r);
      var sz = 70 + rnd() * 70; s.scale.set(sz, sz * (0.38 + rnd() * 0.15), 1);
      A.group.add(s); list.push({ s: s, a: a, r: r, sp: (0.002 + rnd() * 0.004) * (w.wind ? 3 : 1) });
    }
    A.updaters.push(function (dt) {
      for (var i = 0; i < list.length; i++) { var c = list[i]; c.a += c.sp * dt; c.s.position.x = Math.cos(c.a) * c.r; c.s.position.z = Math.sin(c.a) * c.r; }
    });
  }

  /* tiang listrik kampung dengan kabel menjuntai */
  function powerLine(A, z, x0, x1, step) {
    var pts = [], parts = [];
    for (var x = x0; x <= x1 + 0.01; x += step) {
      pts.push(x);
      parts.push(tg(new THREE.CylinderGeometry(0.1, 0.13, 8, 6), x, 4, z));
      parts.push(tg(new THREE.BoxGeometry(0.1, 0.1, 1.8), x, 7.4, z));
    }
    var m = new THREE.Mesh(merge(parts), R3.mat('#8a8780')); A.group.add(m); A.disposables.push(m.geometry);
    var lines = [];
    [-0.8, 0, 0.8].forEach(function (oz) {
      for (var i = 0; i < pts.length - 1; i++) {
        var prev = null;
        for (var k = 0; k <= 10; k++) {
          var t = k / 10, xx = U.lerp(pts[i], pts[i + 1], t), yy = 7.5 - Math.sin(t * Math.PI) * 0.9;
          if (prev) lines.push(prev[0], prev[1], z + oz, xx, yy, z + oz);
          prev = [xx, yy];
        }
      }
    });
    var lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    A.group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x222222 })));
  }

  function flags(A, list, rnd) {
    // umbul-umbul: tiang bambu tinggi melengkung dengan kain panjang berkibar
    var G = A.group, items = [];
    list.forEach(function (f) {
      var pole = R3.mesh(R3.geo.cyl6, R3.mat('#d7bd84'), f.x, 4.5, f.z, 0.06, 9, 0.06); G.add(pole);
      var geo = new THREE.PlaneGeometry(0.7, 4.2, 1, 12); geo.translate(0.36, -2.1, 0);
      var col = f.c || ['#e63946', '#ffbe0b', '#3a86ff', '#06d6a0', '#ff006e'][Math.floor(rnd() * 5)];
      var tex = R3.canvasTex(16, 128, function (x, w, h) { x.fillStyle = col; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,0.85)'; for (var i = 0; i < 4; i++) x.fillRect(0, 18 + i * 28, w, 6); x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 0, 2, h); });
      A.disposables.push(tex);
      var cloth = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
      cloth.position.set(f.x, 8.8, f.z); G.add(cloth);
      items.push({ geo: geo, base: geo.attributes.position.array.slice(0), ph: rnd() * 6 });
    });
    A.updaters.push(function (dt, t) {
      var wind = A.windMag || 1;
      items.forEach(function (it) {
        var p = it.geo.attributes.position.array, b = it.base;
        for (var i = 0; i < p.length; i += 3) {
          var down = -b[i + 1] / 4.2;
          p[i + 2] = b[i + 2] + Math.sin(t * 3 * wind + it.ph + down * 4) * 0.25 * down * wind;
          p[i] = b[i] + Math.sin(t * 2 + it.ph + down * 3) * 0.08 * down;
        }
        it.geo.attributes.position.needsUpdate = true;
      });
    });
  }

  function banner(A, x, y, z, ry, w, h, bg, fg, lines) {
    var tex = textTex(512, Math.round(512 * h / w), bg, fg, lines);
    A.disposables.push(tex);
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = ry || 0;
    A.group.add(m);
    [-1, 1].forEach(function (k) { A.group.add(R3.mesh(R3.geo.cyl6, R3.mat('#d7bd84'), x + Math.cos(ry || 0) * k * w / 2, y / 2 + h / 4, z - Math.sin(ry || 0) * k * w / 2, 0.05, y + h / 2, 0.05)); });
    return m;
  }

  function motor(A, x, z, r, col) {
    var g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = r;
    g.add(R3.mesh(R3.geo.box, R3.mat(col), 0, 0.55, 0, 0.32, 0.35, 1.2));
    g.add(R3.mesh(R3.geo.box, R3.mat('#1b1b1b'), 0, 0.78, -0.15, 0.3, 0.1, 0.6));
    g.add(R3.mesh(R3.geo.cyl6, R3.mat('#999999'), 0, 0.95, 0.45, 0.025, 0.5, 0.025));
    var hb = R3.mesh(R3.geo.cyl6, R3.mat('#333333'), 0, 1.15, 0.45, 0.02, 0.7, 0.02); hb.rotation.z = Math.PI / 2; g.add(hb);
    g.add(R3.mesh(R3.geo.box, R3.mat('#ffe8a0'), 0, 0.98, 0.62, 0.16, 0.1, 0.04));
    var wg = new THREE.TorusGeometry(0.26, 0.07, 6, 12);
    A.disposables.push(wg);
    [-0.5, 0.5].forEach(function (k) { var w = new THREE.Mesh(wg, R3.mat('#1a1a1a')); w.rotation.y = Math.PI / 2; w.position.set(0, 0.28, k); g.add(w); });
    A.group.add(g);
  }

  /* warung kopi: lapak dengan atap terpal belang dan papan nama */
  function warung(A, x, z, r, name, rnd) {
    var g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = r;
    g.add(R3.mesh(R3.geo.box, R3.mat('#8a6a45'), 0, 0.5, 0, 3.2, 1.0, 1.2));
    g.add(R3.mesh(R3.geo.box, R3.mat('#e9dcc2'), 0, 1.02, 0, 3.3, 0.05, 1.3));
    var stex = R3.canvasTex(64, 16, function (x2, w, h) { for (var i = 0; i < 8; i++) { x2.fillStyle = i % 2 ? '#ffffff' : (rnd() < 0.5 ? '#2a9d8f' : '#d62828'); x2.fillRect(i * 8, 0, 8, h); } });
    A.disposables.push(stex);
    var aw = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.06, 2.0), new THREE.MeshLambertMaterial({ map: stex }));
    aw.position.set(0, 2.35, 0.3); aw.rotation.x = 0.12; g.add(aw);
    [[-1.8, -0.6], [1.8, -0.6], [-1.8, 1.2], [1.8, 1.2]].forEach(function (p) { g.add(R3.mesh(R3.geo.cyl6, R3.mat('#6e4a2c'), p[0], 1.2, p[1], 0.05, 2.4, 0.05)); });
    var sign = textTex(256, 64, '#ffd60a', '#1b1b1b', [name]);
    A.disposables.push(sign);
    var sm = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.55), new THREE.MeshLambertMaterial({ map: sign }));
    sm.position.set(0, 2.75, 1.25); g.add(sm);
    for (var i = 0; i < 5; i++) g.add(R3.mesh(R3.geo.cyl, R3.mat(['#e63946', '#ffb703', '#2a9d8f', '#f1faee'][i % 4]), -1.2 + i * 0.6, 1.17, -0.2, 0.08, 0.26, 0.08));
    g.add(R3.mesh(R3.geo.box, R3.mat('#2a7fc0'), -1.0, 0.25, 1.2, 0.9, 0.5, 0.4));
    A.group.add(g);
  }

  function lampPost(A, x, z, h, col) {
    A.group.add(R3.mesh(R3.geo.cyl6, R3.mat('#3a3a3a'), x, h / 2, z, 0.07, h, 0.07));
    var glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: R3.tex.glow, color: new THREE.Color(col || '#ffb35c'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.position.set(x, h + 0.1, z); glow.scale.setScalar(2.2); A.group.add(glow);
    A.group.add(R3.mesh(R3.geo.sphereLo, R3.basic(col || '#ffd08a'), x, h, z, 0.18));
    return glow;
  }

  /* ======================================================================
     DEKORASI TIAP ARENA
     ====================================================================== */
  var DECO = {};
  function houseRow(z, n, x0, step, rnd, r) { var hs = []; for (var i = 0; i < n; i++) hs.push({ x: x0 + i * step + rnd() * 3, z: z + (rnd() - 0.5) * 4, r: r + (rnd() - 0.5) * 0.2 }); return hs; }
  DECO.kampung = function (A, rnd, q, tk) {
    var zb = -(F.W / 2 + 13 + (F.n >= 7 ? 4 : 0)), zf = F.W / 2 + 17 + (F.n >= 7 ? 4 : 0);
    var span = F.L + 50, nb = Math.round(span / 10);
    var hs = houseRow(zb, nb, -span / 2, 10, rnd, 0).concat(houseRow(zf, Math.round(nb * 0.55), -span / 2 + 4, 18, rnd, Math.PI));
    hs.push({ x: -F.L / 2 - 16, z: -6, r: Math.PI / 2 }, { x: F.L / 2 + 16, z: 5, r: -Math.PI / 2 });
    houses(A, hs, rnd, tk === 'malam');
    var bt = [];
    for (var i = 0; i < Math.round(span / 7); i++) bt.push({ x: -span / 2 + rnd() * span, z: zb + 6 + rnd() * 2 });
    trees(A, bt, 'pisang', rnd);
    trees(A, [{ x: -F.L / 2 - 9, z: -14 }, { x: F.L / 2 + 10, z: -15 }, { x: -F.L / 2 - 10, z: 16 }, { x: F.L / 2 + 9, z: 17 }, { x: -F.L / 2 - 20, z: 2 }, { x: F.L / 2 + 22, z: -3 }], 'bulat', rnd);
    trees(A, [{ x: -F.L / 2 - 6, z: zf - 7 }, { x: F.L / 2 + 5, z: zf - 6 }, { x: 0, z: zf - 5 }], 'kelapa', rnd);
    var fz = -((A.fenceZ || F.W / 2 + 1.2) + (F.n >= 7 ? 5.6 : 1.3));
    flags(A, [-16, -8, 0, 8, 16].map(function (x) { return { x: x * (F.L / 44), z: fz }; }), rnd);
    banner(A, 0, 3.2, fz - 1.8, 0, 9, 1.3, '#b5121b', '#ffffff', ['TURNAMEN TARKAM BOLA API']);
    warung(A, -F.L / 2 - 7, -F.W / 2 - 6, 0.4, 'WARUNG KOPI', rnd);
    var mx = F.n >= 7 ? F.L / 2 - 1 : 14;
    motor(A, mx, F.W / 2 + 3.2 + (F.n >= 7 ? 3 : 0), 0.4, '#d62828'); motor(A, mx + 1.4, F.W / 2 + 3.4 + (F.n >= 7 ? 3 : 0), 0.3, '#1d3557'); motor(A, -mx - 6, -(F.W / 2 + 3 + (F.n >= 7 ? 3 : 0)), -0.3, '#2a9d8f');
    powerLine(A, zb - 5, -span / 2, span / 2, 26);
    treeLine(A, rnd, '#3e6b34');
  };
  DECO.sawah = function (A, rnd, q, tk) {
    mountains(A, rnd, '#5a7a8c', 7, 170 + F.L * 0.3);
    var palms = [];
    for (var i = 0; i < 12; i++) palms.push({ x: -80 + rnd() * 160, z: -(F.W / 2 + 22 + rnd() * 30) });
    trees(A, palms, 'kelapa', rnd);
    for (i = 0; i < 6; i++) {
      var p = R3.mesh(R3.geo.box, R3.mat('#7d6a40'), 0, 0.12, -(F.W / 2 + 6 + i * 7), 200, 0.25, 0.6); A.group.add(p);
      var p2 = R3.mesh(R3.geo.box, R3.mat('#7d6a40'), 0, 0.12, F.W / 2 + 8 + i * 7, 200, 0.25, 0.6); A.group.add(p2);
    }
    // jerami bekas panen
    var hayG = new THREE.ConeGeometry(0.6, 1.1, 8); hayG.translate(0, 0.55, 0); A.disposables.push(hayG);
    var hay = new THREE.InstancedMesh(hayG, imat(A, '#c9a85a'), 24), m4 = new THREE.Matrix4();
    for (i = 0; i < 24; i++) { m4.makeTranslation(-60 + rnd() * 120, 0, (rnd() < 0.5 ? -1 : 1) * (F.W / 2 + 6 + rnd() * 30)); hay.setMatrixAt(i, m4); }
    hay.instanceMatrix.needsUpdate = true; A.group.add(hay);
    var gb = new THREE.Group(); gb.position.set(-F.L / 2 - 9, 0, -F.W / 2 - 6);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) { gb.add(R3.mesh(R3.geo.cyl6, R3.mat('#8a6a45'), c[0] * 1.3, 1.1, c[1] * 1.0, 0.07, 2.2, 0.07)); });
    gb.add(R3.mesh(R3.geo.box, R3.mat('#a5814f'), 0, 1.0, 0, 2.9, 0.12, 2.3));
    var rf = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.4, 4), R3.mat('#c9a463')); rf.position.y = 2.9; rf.rotation.y = Math.PI / 4; gb.add(rf);
    A.group.add(gb);
    var sc = new THREE.Group(); sc.position.set(F.L / 2 + 8, 0, -F.W / 2 - 9);
    sc.add(R3.mesh(R3.geo.cyl6, R3.mat('#8a6a45'), 0, 1.1, 0, 0.05, 2.2, 0.05));
    var arm = R3.mesh(R3.geo.cyl6, R3.mat('#8a6a45'), 0, 1.6, 0, 0.04, 1.6, 0.04); arm.rotation.z = Math.PI / 2; sc.add(arm);
    sc.add(R3.mesh(R3.geo.box, R3.mat('#d62828'), 0, 1.45, 0, 0.5, 0.6, 0.25));
    sc.add(R3.mesh(new THREE.ConeGeometry(0.42, 0.25, 12), R3.mat('#d9b56c'), 0, 2.2, 0, 1));
    sc.add(R3.mesh(R3.geo.sphereLo, R3.mat('#e8d9b0'), 0, 1.95, 0, 0.17));
    A.group.add(sc);
    // kerbau
    var kb = new THREE.Group(); kb.position.set(-F.L / 2 - 14, 0, F.W / 2 + 10); kb.rotation.y = 0.8;
    kb.add(R3.mesh(R3.geo.sphere, R3.mat('#4a4440'), 0, 1.05, 0, 0.7, 0.55, 1.1));
    kb.add(R3.mesh(R3.geo.sphere, R3.mat('#4a4440'), 0, 1.15, 1.15, 0.35, 0.32, 0.42));
    [-1, 1].forEach(function (k) { kb.add(R3.mesh(R3.geo.cyl6, R3.mat('#3a3430'), k * 0.4, 0.4, 0.6, 0.1, 0.8, 0.1)); kb.add(R3.mesh(R3.geo.cyl6, R3.mat('#3a3430'), k * 0.4, 0.4, -0.6, 0.1, 0.8, 0.1)); var hn = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 5, 10, Math.PI * 0.7), R3.mat('#d8ccb8')); hn.position.set(k * 0.3, 1.4, 1.15); hn.rotation.set(0, k > 0 ? 0 : Math.PI, 0.3); kb.add(hn); });
    A.group.add(kb);
    houses(A, [{ x: 40 + F.L * 0.3, z: 40 + F.W * 0.3, r: 2.5 }, { x: -50 - F.L * 0.3, z: 38 + F.W * 0.3, r: 3.3 }], rnd, tk === 'malam');
  };
  DECO.pantai = function (A, rnd) {
    var seaMat = new THREE.MeshLambertMaterial({ color: new THREE.Color('#2a6f97'), transparent: true, opacity: 0.92 });
    var seaG = new THREE.PlaneGeometry(500, 180, 50, 18);
    var sea = new THREE.Mesh(seaG, seaMat); sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.15, -(F.W / 2 + 105));
    A.group.add(sea);
    var base = seaG.attributes.position.array.slice(0);
    A.updaters.push(function (dt, t) {
      var p = seaG.attributes.position.array;
      for (var i = 0; i < p.length; i += 3) p[i + 2] = base[i + 2] + Math.sin(base[i] * 0.08 + t * 1.4) * 0.25 + Math.cos(base[i + 1] * 0.1 + t) * 0.2;
      seaG.attributes.position.needsUpdate = true;
    });
    var foam = R3.mesh(R3.geo.box, R3.basic('#f7f3e8', { op: 0.7 }), 0, 0.02, -(F.W / 2 + 15.2), 500, 0.02, 0.7); A.group.add(foam);
    A.updaters.push(function (dt, t) { foam.position.z = -(F.W / 2 + 15.2) + Math.sin(t * 0.8) * 1.2; foam.material.opacity = 0.45 + Math.sin(t * 0.8) * 0.25; });
    var palms = [];
    for (var i = 0; i < 14; i++) palms.push({ x: -F.L / 2 - 30 + i * (F.L + 60) / 14 + rnd() * 4, z: F.W / 2 + 8 + rnd() * 10 });
    for (i = 0; i < 6; i++) palms.push({ x: (rnd() < 0.5 ? -1 : 1) * (F.L / 2 + 6 + rnd() * 8), z: -10 + rnd() * 20 });
    trees(A, palms, 'kelapa', rnd);
    for (i = 0; i < 5; i++) {
      var b = new THREE.Group(); b.position.set(-34 + i * 17 + rnd() * 5, 0.2, -(F.W / 2 + 9 + rnd() * 3)); b.rotation.y = (rnd() - 0.5) * 0.6;
      var hull = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 4.6, 10, 1, false, 0, Math.PI), R3.mat(['#e63946', '#2a9d8f', '#ffb703', '#457b9d', '#f1faee'][i]));
      hull.rotation.set(0, 0, Math.PI / 2); hull.rotation.order = 'ZXY'; hull.rotation.x = Math.PI; hull.position.y = 0.42; b.add(hull);
      A.disposables.push(hull.geometry);
      [-1, 1].forEach(function (k) { var cad = R3.mesh(R3.geo.cyl6, R3.mat('#d7bd84'), 0, 0.5, k * 1.4, 0.05, 3.4, 0.05); cad.rotation.z = Math.PI / 2; b.add(cad); });
      A.group.add(b);
    }
    mountains(A, rnd, '#7d6a8c', 5, 240);
    warung(A, F.L / 2 + 8, F.W / 2 + 7, -2.6, 'ES KELAPA MUDA', rnd);
  };
  DECO.alun = function (A, rnd, q, tk) {
    trees(A, [{ x: -F.L / 2 - 15, z: -9, s: 6 }, { x: F.L / 2 + 15, z: 8, s: 6 }], 'beringin', rnd);
    var tl = [];
    for (var i = 0; i < 12; i++) tl.push({ x: -F.L / 2 - 10 + i * (F.L + 20) / 11, z: -(F.W / 2 + 15 + rnd() * 3) });
    trees(A, tl, 'bulat', rnd);
    var cols = ['#e63946', '#f4a261', '#2a9d8f', '#457b9d', '#ffb703'];
    var ncart = Math.round(F.L / 7);
    for (i = 0; i < ncart; i++) {
      var g = new THREE.Group(); g.position.set(-F.L / 2 + 3 + i * (F.L - 6) / Math.max(1, ncart - 1), 0, F.W / 2 + 6.5 + (F.n >= 7 ? 4 : 0) + rnd()); g.rotation.y = Math.PI;
      g.add(R3.mesh(R3.geo.box, R3.mat(cols[i % 5]), 0, 0.9, 0, 1.6, 0.8, 0.8));
      g.add(R3.mesh(R3.geo.box, R3.mat('#f1e3c6'), 0, 1.9, 0, 1.8, 0.06, 1.0));
      [-0.7, 0.7].forEach(function (k) { g.add(R3.mesh(R3.geo.cyl6, R3.mat('#666666'), k, 1.45, 0.38, 0.03, 0.9, 0.03)); });
      var wl = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 6, 12), R3.mat('#222222')); wl.position.set(-0.5, 0.3, 0.42); g.add(wl); A.disposables.push(wl.geometry);
      var lg = new THREE.Sprite(new THREE.SpriteMaterial({ map: R3.tex.glow, color: new THREE.Color('#ffd08a'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      lg.position.set(0, 1.7, 0); lg.scale.setScalar(1.4); g.add(lg);
      A.group.add(g);
    }
    for (i = 0; i < 7; i++) lampPost(A, -F.L / 2 + 3 + i * (F.L - 6) / 6, -((A.fenceZ || F.W / 2 + 1.2) + (F.n >= 7 ? 5.4 : 2)), 4.2);
    var pd = new THREE.Group(); pd.position.set(0, 0, -(F.W / 2 + 28));
    [[-5, -3], [5, -3], [-5, 3], [5, 3], [-2, -3], [2, -3], [-2, 3], [2, 3]].forEach(function (c) { pd.add(R3.mesh(R3.geo.cyl6, R3.mat('#7a4a2a'), c[0], 2, c[1], 0.2, 4, 0.2)); });
    var rf = new THREE.Mesh(new THREE.ConeGeometry(9, 3, 4), R3.mat('#6d3b26')); rf.position.y = 5.4; rf.rotation.y = Math.PI / 4; pd.add(rf);
    var rf2 = new THREE.Mesh(new THREE.ConeGeometry(4.5, 2.2, 4), R3.mat('#5d2f1e')); rf2.position.y = 7.3; rf2.rotation.y = Math.PI / 4; pd.add(rf2);
    A.disposables.push(rf.geometry, rf2.geometry);
    A.group.add(pd);
    houses(A, [{ x: -40 - F.L * 0.2, z: 34 + F.W * 0.3, r: Math.PI }, { x: 40 + F.L * 0.2, z: 33 + F.W * 0.3, r: Math.PI }], rnd, tk === 'malam');
    treeLine(A, rnd, '#3a6230');
  };
  DECO.tol = function (A, rnd, q, tk) {
    var deckTex = R3.canvasTex(256, 128, function (x, w, h) {
      x.fillStyle = '#7d7b75'; x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 3;
      for (var i = 0; i < w; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); }
      for (i = 0; i < 40; i++) { x.fillStyle = 'rgba(40,40,40,' + (0.1 + Math.random() * 0.2) + ')'; x.fillRect(Math.random() * w, Math.random() * h, 20, 6); }
    }, { repeat: [6, 2] });
    A.disposables.push(deckTex);
    var dl = F.L + 120;
    var deck = new THREE.Mesh(new THREE.BoxGeometry(dl, 1.4, F.W + 4), new THREE.MeshLambertMaterial({ map: deckTex }));
    deck.position.set(0, 15.5 + (F.n >= 7 ? 4 : 0), -4); A.group.add(deck);
    var rail = R3.mesh(R3.geo.box, R3.mat('#9a9890'), 0, deck.position.y + 1.1, deck.position.z + (F.W + 4) / 2 - 0.2, dl, 1, 0.4); A.group.add(rail);
    var graf = R3.canvasTex(128, 256, function (x, w, h) {
      x.fillStyle = '#a19e96'; x.fillRect(0, 0, w, h);
      var cols = ['#ff4d6d', '#ffd60a', '#4cc9f0', '#80ed99', '#ff7b00', '#c77dff'];
      for (var i = 0; i < 9; i++) { x.fillStyle = cols[i % 6]; x.globalAlpha = 0.9; x.beginPath(); x.ellipse(Math.random() * w, 60 + Math.random() * 160, 14 + Math.random() * 30, 10 + Math.random() * 22, Math.random() * 3, 0, Math.PI * 2); x.fill(); }
      x.globalAlpha = 1; x.fillStyle = '#111'; x.font = 'bold 22px Bungee, Impact, sans-serif'; x.save(); x.translate(w / 2, h * 0.6); x.rotate(-0.2); x.textAlign = 'center'; x.fillText('KAMPUNG', 0, 0); x.fillText('JAYA', 0, 26); x.restore();
    });
    A.disposables.push(graf);
    var pm = new THREE.MeshLambertMaterial({ map: graf });
    var ph = deck.position.y;
    var pg = new THREE.BoxGeometry(1.6, ph, 1.6); A.disposables.push(pg);
    for (var px = -F.L / 2 + 4; px <= F.L / 2 - 4; px += 18) {
      [-(F.W / 2 + (F.n >= 7 ? 7.6 : 3.5)), F.W / 2 + (F.n >= 7 ? 7.6 : 3.5)].forEach(function (z) {
        var p = new THREE.Mesh(pg, pm); p.position.set(px, ph / 2, z); p.castShadow = true; A.group.add(p);
      });
    }
    for (var i = 0; i < 6; i++) lampPost(A, -F.L / 2 + 4 + i * (F.L - 8) / 5, -((A.fenceZ || F.W / 2 + 1.2) + 1), 5, '#ff9e3d');
    var cars = [];
    for (i = 0; i < 4; i++) {
      var cl = new THREE.Sprite(new THREE.SpriteMaterial({ map: R3.tex.glow, color: new THREE.Color(i % 2 ? '#ff5d5d' : '#fff2c8'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      cl.scale.setScalar(2.5); cl.position.set(-80 + i * 45, ph + 1.5, deck.position.z + (F.W + 4) / 2 - 0.4); A.group.add(cl);
      cars.push({ s: cl, v: (i % 2 ? -1 : 1) * (20 + rnd() * 10) });
    }
    A.updaters.push(function (dt) {
      cars.forEach(function (c) { c.s.position.x += c.v * dt; if (c.s.position.x > dl / 2) c.s.position.x = -dl / 2; if (c.s.position.x < -dl / 2) c.s.position.x = dl / 2; });
    });
    houses(A, [{ x: -45 - F.L * 0.2, z: -32 - F.W * 0.3, r: 0 }, { x: -30 - F.L * 0.2, z: -34 - F.W * 0.3, r: 0 }, { x: 35 + F.L * 0.2, z: -33 - F.W * 0.3, r: 0 }, { x: 50 + F.L * 0.2, z: -31 - F.W * 0.3, r: 0 }], rnd, tk === 'malam');
    warung(A, F.L / 2 + 6, F.W / 2 + 6 + (F.n >= 7 ? 3 : 0), -2.4, 'MIE AYAM', rnd);
  };
  DECO.bukit = function (A, rnd, q, tk) {
    var rr = Math.max(70, F.L * 0.8);
    var hill = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr * 2, 30, 28, 1, true), R3.mat('#6f8a4a'));
    hill.position.y = -15.05; A.group.add(hill); A.disposables.push(hill.geometry);
    mountains(A, rnd, '#4a6a7c', 9, 200 + F.L * 0.3);
    var pines = [];
    for (var i = 0; i < 28; i++) { var a = rnd() * Math.PI * 2, r = Math.min(rr - 4, F.L * 0.62 + 12 + rnd() * 26); pines.push({ x: Math.cos(a) * r, z: Math.sin(a) * r * 0.8 - 6 }); }
    trees(A, pines.filter(function (p) { return Math.abs(p.z) > F.W / 2 + 5 || Math.abs(p.x) > F.L / 2 + 6; }), 'cemara', rnd);
    houses(A, [{ x: -F.L / 2 - 12, z: -12, r: 0.6 }], rnd, tk === 'malam');
    flags(A, [{ x: -F.L / 2 - 3, z: -F.W / 2 - 2.5, c: '#e63946' }, { x: F.L / 2 + 3, z: -F.W / 2 - 2.5, c: '#ffffff' }], rnd);
    A.windMag = 1.8;
  };
  DECO.sekolah = function (A, rnd, q, tk) {
    var winTex = R3.canvasTex(256, 64, function (x, w, h) {
      x.fillStyle = '#f2ead3'; x.fillRect(0, 0, w, h);
      for (var i = 0; i < 8; i++) { x.fillStyle = '#5a3a22'; x.fillRect(6 + i * 31, 12, 24, 30); x.fillStyle = '#3d5a80'; x.fillRect(8 + i * 31, 14, 20, 26); x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(10 + i * 31, 16, 4, 12); }
      x.fillStyle = '#c8b88a'; x.fillRect(0, h - 8, w, 8);
    }, { repeat: [3, 1] });
    A.disposables.push(winTex);
    var bw = Math.max(60, F.L + 16);
    var bld = new THREE.Mesh(new THREE.BoxGeometry(bw, 6, 9), new THREE.MeshLambertMaterial({ map: winTex }));
    bld.position.set(0, 3, -(F.W / 2 + 12 + (F.n >= 7 ? 3 : 0))); A.group.add(bld);
    var rfg = new THREE.CylinderGeometry(6, 6, bw + 1, 3, 1); rfg.rotateZ(Math.PI / 2); rfg.rotateX(-Math.PI / 2);
    var rf = new THREE.Mesh(rfg, R3.mat('#b5361f'));
    rf.position.set(0, 8.1, bld.position.z); rf.scale.set(1, 0.7, 0.85); A.group.add(rf); A.disposables.push(rfg);
    banner(A, 0, 4.4, bld.position.z + 4.6, 0, 12, 1.4, '#1d3557', '#ffffff', ['SD NEGERI KAMPUNG API']);
    A.group.add(R3.mesh(R3.geo.cyl6, R3.mat('#dddddd'), F.L / 2 + 5, 5, F.W / 2 + 4, 0.06, 10, 0.06));
    var fg = new THREE.PlaneGeometry(1.8, 1.2, 8, 2); fg.translate(0.9, 0, 0);
    var ftex = R3.canvasTex(32, 32, function (x, w, h) { x.fillStyle = '#e11d2e'; x.fillRect(0, 0, w, h / 2); x.fillStyle = '#ffffff'; x.fillRect(0, h / 2, w, h / 2); });
    A.disposables.push(ftex);
    var flag = new THREE.Mesh(fg, new THREE.MeshLambertMaterial({ map: ftex, side: THREE.DoubleSide }));
    flag.position.set(F.L / 2 + 5, 9.3, F.W / 2 + 4); A.group.add(flag);
    var fb = fg.attributes.position.array.slice(0);
    A.updaters.push(function (dt, t) {
      var p = fg.attributes.position.array;
      for (var i = 0; i < p.length; i += 3) p[i + 2] = fb[i + 2] + Math.sin(t * 5 + fb[i] * 3) * 0.12 * (fb[i] / 1.8);
      fg.attributes.position.needsUpdate = true;
    });
    var tl = [];
    for (var i = 0; i < 7; i++) tl.push({ x: -F.L / 2 - 6 - rnd() * 4, z: -F.W / 2 + i * F.W / 6 });
    for (i = 0; i < 7; i++) tl.push({ x: F.L / 2 + 6 + rnd() * 4, z: -F.W / 2 + i * F.W / 6 });
    trees(A, tl, 'bulat', rnd);
    var hoop = new THREE.Group(); hoop.position.set(-F.L / 2 - 3.5, 0, F.W / 2 + 4);
    hoop.add(R3.mesh(R3.geo.cyl6, R3.mat('#555555'), 0, 1.6, 0, 0.06, 3.2, 0.06));
    hoop.add(R3.mesh(R3.geo.box, R3.mat('#ffffff'), 0, 3.3, 0.2, 1.2, 0.8, 0.05));
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.02, 6, 16), R3.mat('#ff6a1a')); ring.rotation.x = Math.PI / 2; ring.position.set(0, 3.05, 0.45); hoop.add(ring); A.disposables.push(ring.geometry);
    A.group.add(hoop);
    powerLine(A, F.W / 2 + 14, -F.L / 2 - 20, F.L / 2 + 20, 24);
    treeLine(A, rnd, '#45703a');
  };
  DECO.stadion = function (A, rnd, q, tk) {
    var wz = (A.fenceZ || F.W / 2 + 1.15), wx = (A.fenceX || F.L / 2 + 1.5);
    var SR = (A.standRows && A.standRows.n) || 10, z0 = (A.standRows && A.standRows.z0) || wz + 3.2, step = 1.0, h = 0.55;
    var con = [], seatA = [], seatB = [];
    var LL = F.L * 0.92 + 8, LW = F.W * 0.9 + 8, x0 = wx + 3.2;
    // tribun beton bertingkat di empat sisi (kursi dua warna berselang)
    [-1, 1].forEach(function (k) {
      for (var r = 0; r < SR; r++) {
        var zz = k * (z0 + 0.5 + r * step), yy = h * (r + 1);
        con.push(tg(new THREE.BoxGeometry(LL, yy, step), 0, yy / 2, zz));
        (r % 2 ? seatA : seatB).push(tg(new THREE.BoxGeometry(LL - 0.4, 0.12, 0.42), 0, yy + 0.06, zz + k * 0.2));
        var xx = k * (x0 + 0.5 + r * step);
        con.push(tg(new THREE.BoxGeometry(step, yy, LW), xx, yy / 2, 0));
        (r % 2 ? seatA : seatB).push(tg(new THREE.BoxGeometry(0.42, 0.12, LW - 0.4), xx + k * 0.2, yy + 0.06, 0));
      }
      // dinding belakang & atap sisi panjang
      var zb = k * (z0 + SR * step + 1), yb = h * SR + 2.5;
      con.push(tg(new THREE.BoxGeometry(LL + 2, yb, 0.6), 0, yb / 2, zb));
      var roof = tg(new THREE.BoxGeometry(LL + 4, 0.35, SR * step + 4), 0, yb + 0.2, k * (z0 + SR * step / 2 + 0.5));
      con.push(roof);
      for (var c2 = -3; c2 <= 3; c2++) con.push(tg(new THREE.CylinderGeometry(0.22, 0.22, yb, 8), c2 * (LL / 6), yb / 2, k * (z0 + SR * step + 0.6)));
      var xb = k * (x0 + SR * step + 1);
      con.push(tg(new THREE.BoxGeometry(0.6, yb * 0.8, LW + 2), xb, yb * 0.4, 0));
    });
    var cm = new THREE.Mesh(merge(con), R3.mat('#8e8a84')); cm.castShadow = false; cm.receiveShadow = true; A.group.add(cm); A.disposables.push(cm.geometry);
    var sa = new THREE.Mesh(merge(seatA), R3.mat('#d62828')); A.group.add(sa); A.disposables.push(sa.geometry);
    var sb = new THREE.Mesh(merge(seatB), R3.mat('#1d3557')); A.group.add(sb); A.disposables.push(sb.geometry);
    // lorong pemain
    A.group.add(R3.mesh(R3.geo.box, R3.mat('#2b2b33'), 0, 1.3, -(wz + 1.2), 4, 2.6, 2.4));
    // papan skor besar di belakang gawang
    var sbd = new THREE.Group(); sbd.position.set(x0 + SR * step - 2, h * SR + 5.5, 0); sbd.rotation.y = -Math.PI / 2;
    sbd.add(R3.mesh(R3.geo.box, R3.mat('#111115'), 0, 0, 0, 16, 5, 0.5));
    var sbt = textTex(512, 160, '#111115', '#ffd23f', ['BOLA API ARENA', 'LIGA PRO']); A.disposables.push(sbt);
    var sbp = new THREE.Mesh(new THREE.PlaneGeometry(15, 4.4), new THREE.MeshBasicMaterial({ map: sbt })); sbp.position.z = 0.3; sbd.add(sbp); A.disposables.push(sbp.geometry, sbp.material);
    A.group.add(sbd);
    // empat menara lampu sorot
    var tw = SR * step + 6;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
      var x = c[0] * (x0 + tw), z = c[1] * (z0 + tw), H = 26;
      A.group.add(R3.mesh(R3.geo.cyl6, R3.mat('#5a5f66'), x, H / 2, z, 0.5, H, 0.5));
      var panel = R3.mesh(R3.geo.box, R3.mat('#2a2d33'), x, H + 1.5, z, 5, 3, 0.6); panel.lookAt(0, 0, 0); A.group.add(panel);
      for (var i = 0; i < 6; i++) {
        var lamp = R3.mesh(R3.geo.sphereLo, R3.basic(tk === 'malam' ? '#fff6dd' : '#aab0b8'), x - c[0] * 0.4, H + 0.6 + (i % 2) * 1.2, z - c[1] * 0.4 + (i - 2.5) * 0.7, 0.3); A.group.add(lamp);
      }
      if (tk === 'malam') {
        var g = new THREE.Sprite(new THREE.SpriteMaterial({ map: R3.tex.glow, color: new THREE.Color('#fff2cc'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        g.position.set(x, H + 1.5, z); g.scale.setScalar(14); A.group.add(g);
        var sl = new THREE.SpotLight(0xfff4e0, 0.9, 170, 0.55, 0.5, 1.2); sl.position.set(x, H + 1, z); sl.target.position.set(c[0] * F.L / 4, 0, c[1] * F.W / 4); A.group.add(sl); A.group.add(sl.target);
      }
    });
    treeLine(A, rnd, '#2f5a2b');
  };
  DECO.rel = function (A, rnd, q, tk) {
    var rz = -(F.W / 2 + 7 + (F.n >= 7 ? 3 : 0));
    A.group.add(R3.mesh(R3.geo.box, R3.mat('#6b6660'), 0, 0.15, rz, 400, 0.3, 4.2));
    [-0.75, 0.75].forEach(function (k) { A.group.add(R3.mesh(R3.geo.box, R3.mat('#9aa0a6'), 0, 0.42, rz + k, 400, 0.12, 0.1)); });
    var sl = new THREE.InstancedMesh(R3.geo.box, imat(A, '#5a4a3a'), 160);
    var m4 = new THREE.Matrix4();
    for (var i = 0; i < 160; i++) { m4.makeScale(0.25, 0.1, 2.4); m4.setPosition(-200 + i * 2.5, 0.33, rz); sl.setMatrixAt(i, m4); }
    sl.instanceMatrix.needsUpdate = true; A.group.add(sl);
    var train = new THREE.Group();
    var carTex = R3.canvasTex(256, 64, function (x, w, h) {
      x.fillStyle = '#f2f2f2'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#d62828'; x.fillRect(0, h * 0.62, w, h * 0.14);
      x.fillStyle = '#2b3a4a'; for (var i = 0; i < 6; i++) x.fillRect(12 + i * 41, 10, 28, 20);
    });
    A.disposables.push(carTex);
    var cg = new THREE.BoxGeometry(19, 3.6, 3); A.disposables.push(cg);
    var cm = new THREE.MeshLambertMaterial({ map: carTex });
    for (i = 0; i < 6; i++) { var car = new THREE.Mesh(cg, cm); car.position.set(i * 20, 2.3, 0); train.add(car); }
    train.position.set(-400, 0, rz); A.group.add(train);
    var tState = { x: -400, wait: 8 + rnd() * 10, v: 0, dir: 1 };
    A.updaters.push(function (dt) {
      if (tState.v === 0) {
        tState.wait -= dt;
        if (tState.wait <= 0) { tState.dir = rnd() < 0.5 ? 1 : -1; tState.v = 22 * tState.dir; tState.x = tState.dir > 0 ? -260 : 160; if (A.onTrain) A.onTrain(); }
      } else {
        tState.x += tState.v * dt;
        if ((tState.dir > 0 && tState.x > 160) || (tState.dir < 0 && tState.x < -260)) { tState.v = 0; tState.wait = 35 + rnd() * 25; tState.x = -400; }
      }
      train.position.x = tState.x;
    });
    var span = F.L + 40;
    houses(A, houseRow(rz - 11, Math.round(span / 12), -span / 2, 12, rnd, 0).concat(houseRow(F.W / 2 + 15 + (F.n >= 7 ? 3 : 0), 4, -36, 22, rnd, Math.PI)), rnd, tk === 'malam');
    A.group.add(R3.mesh(R3.geo.cyl6, R3.mat('#eeeeee'), F.L / 2 + 6, 1.6, rz + 3, 0.07, 3.2, 0.07));
    var sig = new THREE.Sprite(new THREE.SpriteMaterial({ map: R3.tex.glow, color: new THREE.Color('#ff3030'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    sig.position.set(F.L / 2 + 6, 3.3, rz + 3); sig.scale.setScalar(0.9); A.group.add(sig);
    A.updaters.push(function (dt, t) { sig.material.opacity = tState.v !== 0 ? (Math.sin(t * 10) > 0 ? 1 : 0.15) : 0.15; });
    trees(A, [{ x: -F.L / 2 - 8, z: 14 }, { x: F.L / 2 + 8, z: 15 }, { x: 0, z: F.W / 2 + 9 + (F.n >= 7 ? 3 : 0) }], 'bulat', rnd);
    powerLine(A, rz - 3, -span / 2, span / 2, 28);
    treeLine(A, rnd, '#41683a');
  };

  /* ---------- lampu malam: petromak, obor, menara sorot untuk lapangan besar ---------- */
  function buildNightLights(A, rnd) {
    var big = F.n >= 7;
    var cx = F.L / 2 + 2 + (big ? 2 : 0), cz = F.W / 2 + 2 + (big ? 2 : 0);
    var spots = [[-cx, -cz], [cx, -cz], [-cx, cz], [cx, cz]];
    spots.forEach(function (s) {
      var pl = new THREE.PointLight(0xffdcae, big ? 0.7 : 0.95, big ? 70 : 46, 1.4);
      pl.position.set(s[0], big ? 14 : 6, s[1]); A.group.add(pl);
      if (big) {
        A.group.add(R3.mesh(R3.geo.cyl6, R3.mat('#5a5a5a'), s[0], 7, s[1], 0.18, 14, 0.18));
        var panel = R3.mesh(R3.geo.box, R3.basic('#fff6dc'), s[0], 14.2, s[1], 2.2, 1.2, 0.3); panel.lookAt(0, 0, 0); A.group.add(panel);
        var gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: R3.tex.glow, color: new THREE.Color('#fff2d0'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        gl.position.set(s[0], 14.2, s[1]); gl.scale.setScalar(9); A.group.add(gl);
      } else lampPost(A, s[0], s[1], 6, '#ffcf8a');
    });
    if (big) { A.flood = new THREE.HemisphereLight(0xfff2dd, 0x2a2420, 0.35); A.group.add(A.flood); }
    var torches = [];
    var nt = big ? 14 : 8;
    for (var i = 0; i < nt; i++) {
      var x = -F.L / 2 + 4 + i * (F.L - 8) / (nt - 1), z = (i % 2 ? 1 : -1) * ((A.fenceZ || F.W / 2 + 1.2) + 0.45);
      A.group.add(R3.mesh(R3.geo.cyl6, R3.mat('#6b4b2a'), x, 0.8, z, 0.05, 1.6, 0.05));
      var fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: R3.tex.glow, color: new THREE.Color('#ff8a2a'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      fl.position.set(x, 1.8, z); fl.scale.setScalar(1.2); A.group.add(fl);
      torches.push({ s: fl, ph: rnd() * 6 });
    }
    A.updaters.push(function (dt, t) {
      torches.forEach(function (o) { var k = 1 + Math.sin(t * 13 + o.ph) * 0.12 + Math.sin(t * 7.3 + o.ph) * 0.1; o.s.scale.set(1.2 * k, 1.6 * k, 1); });
    });
  }

  /* ---------- cuaca ---------- */
  function buildWeather(A, w, q, tk, rnd) {
    A.windMag = A.windMag || (w.wind ? 2.4 : 1);
    var G = A.group;
    if (w.rain) {
      var n = Math.round([260, 550, 900][q] * (w.rain < 1 ? 0.45 : 1));
      var pos = new Float32Array(n * 6), vel = new Float32Array(n);
      for (var i = 0; i < n; i++) {
        var x = (rnd() - 0.5) * 60, y = rnd() * 22, z = (rnd() - 0.5) * 50;
        pos[i * 6] = x; pos[i * 6 + 1] = y; pos[i * 6 + 2] = z; pos[i * 6 + 3] = x + 0.12; pos[i * 6 + 4] = y + 0.7; pos[i * 6 + 5] = z;
        vel[i] = 16 + rnd() * 8;
      }
      var rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      var rl = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: tk === 'malam' ? 0x8899cc : 0xc6d4e6, transparent: true, opacity: w.rain < 1 ? 0.35 : 0.55 }));
      rl.frustumCulled = false; G.add(rl);
      // percikan air di tanah
      var nsp = q === 0 ? 0 : (q === 1 ? 26 : 44);
      var spl = null, spd = [];
      if (nsp) {
        var splM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }); A.disposables.push(splM);
        spl = new THREE.InstancedMesh(new THREE.RingGeometry(0.05, 0.062, 12), splM, nsp);
        A.disposables.push(spl.geometry);
        for (i = 0; i < nsp; i++) spd.push({ t: rnd(), x: 0, z: 0 });
        spl.frustumCulled = false; G.add(spl);
      }
      var m4s = new THREE.Matrix4(), qs = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), vs = new V3(), ss = new V3(), splC = new THREE.Color();
      if (spl) for (i = 0; i < nsp; i++) spl.setColorAt(i, splC.setScalar(0));
      A.updaters.push(function (dt) {
        var p = rg.attributes.position.array, cx = A.focusX || 0, cz = A.focusZ || 0;
        for (var i = 0; i < n; i++) {
          var j = i * 6, dy = vel[i] * dt;
          p[j + 1] -= dy; p[j + 4] -= dy; p[j] += dt * 1.5; p[j + 3] += dt * 1.5;
          if (p[j + 1] < 0) {
            var nx = cx + (Math.random() - 0.5) * 60, nz = cz * 0.6 + (Math.random() - 0.5) * 50, ny = 20 + Math.random() * 4;
            p[j] = nx; p[j + 1] = ny; p[j + 2] = nz; p[j + 3] = nx + 0.12; p[j + 4] = ny + 0.7; p[j + 5] = nz;
          }
        }
        rg.attributes.position.needsUpdate = true;
        if (spl) {
          for (i = 0; i < spd.length; i++) {
            var s = spd[i]; s.t += dt * 2.6;
            if (s.t >= 1) { s.t = 0; s.x = cx + (Math.random() - 0.5) * 26; s.z = cz * 0.6 + (Math.random() - 0.5) * 18; }
            var k = 1 + s.t * 3.5;
            m4s.compose(vs.set(s.x, 0.03, s.z), qs, ss.set(k, k, k)); spl.setMatrixAt(i, m4s);
            splC.setScalar((1 - s.t) * 0.35); spl.setColorAt(i, splC);
          }
          spl.instanceMatrix.needsUpdate = true; if (spl.instanceColor) spl.instanceColor.needsUpdate = true;
        }
      });
      var np = Math.round(14 * (F.L / 44));
      var pudM = new THREE.MeshBasicMaterial({ map: R3.tex.soft, color: new THREE.Color(tk === 'malam' ? '#3a4a66' : '#8a9cb4'), transparent: true, opacity: 0.32, depthWrite: false }); A.disposables.push(pudM);
      var pud = new THREE.InstancedMesh(R3.geo.circle, pudM, np);
      var m4 = new THREE.Matrix4(), qq = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
      for (i = 0; i < np; i++) { m4.compose(new V3((rnd() - 0.5) * F.L, 0.02, (rnd() - 0.5) * F.W), qq, new V3(1 + rnd() * 2, 0.6 + rnd(), 1)); pud.setMatrixAt(i, m4); }
      pud.instanceMatrix.needsUpdate = true; G.add(pud);
    }
    if (w.dust || w.wind) {
      var dn = [60, 120, 200][q];
      var dp = new Float32Array(dn * 3), dv = [];
      for (var k = 0; k < dn; k++) { dp[k * 3] = (rnd() - 0.5) * 70; dp[k * 3 + 1] = rnd() * (w.dust ? 3 : 6); dp[k * 3 + 2] = (rnd() - 0.5) * 50; dv.push(rnd()); }
      var dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
      var dm = new THREE.PointsMaterial({ color: w.dust ? 0xd9b98a : 0x9bbf5a, size: w.dust ? 0.5 : 0.22, map: R3.tex.soft, transparent: true, opacity: w.dust ? 0.45 : 0.85, depthWrite: false });
      var dpts = new THREE.Points(dg, dm); dpts.frustumCulled = false; G.add(dpts);
      A.updaters.push(function (dt, t) {
        var p = dg.attributes.position.array, cx = A.focusX || 0;
        for (var i = 0; i < dn; i++) {
          var j = i * 3;
          p[j] += (w.dust ? 1.2 : 4.5) * dt * (0.5 + dv[i]); p[j + 1] += Math.sin(t * 2 + dv[i] * 9) * dt * 0.6; p[j + 2] += Math.cos(t + dv[i] * 5) * dt * 0.8;
          if (p[j] > cx + 35) { p[j] = cx - 35; p[j + 2] = (A.focusZ || 0) * 0.6 + (Math.random() - 0.5) * 50; }
          if (p[j] < cx - 40) p[j] = cx - 35 + Math.random() * 70;
          if (p[j + 1] < 0.1) p[j + 1] = 0.1;
        }
        dg.attributes.position.needsUpdate = true;
      });
    }
    if (w.lightning) {
      var bg = new THREE.BufferGeometry();
      var bp = new Float32Array(16 * 6); bg.setAttribute('position', new THREE.BufferAttribute(bp, 3));
      var bolt = new THREE.LineSegments(bg, new THREE.LineBasicMaterial({ color: 0xe8f0ff, transparent: true, opacity: 0 }));
      bolt.frustumCulled = false; G.add(bolt);
      A.bolt = function (x, z) {
        var px = x + (Math.random() - 0.5) * 6, py = 40, pz = z + (Math.random() - 0.5) * 6;
        for (var i = 0; i < 16; i++) {
          var ny = 40 - (i + 1) * 2.5, nx = U.lerp(px, x, 0.25) + (Math.random() - 0.5) * 2.2, nz = U.lerp(pz, z, 0.25) + (Math.random() - 0.5) * 2.2;
          if (i === 15) { nx = x; ny = 0.2; nz = z; }
          bp[i * 6] = px; bp[i * 6 + 1] = py; bp[i * 6 + 2] = pz; bp[i * 6 + 3] = nx; bp[i * 6 + 4] = ny; bp[i * 6 + 5] = nz;
          px = nx; py = ny; pz = nz;
        }
        bg.attributes.position.needsUpdate = true;
        bolt.material.opacity = 1;
      };
      A.updaters.push(function (dt) { if (bolt.material.opacity > 0) bolt.material.opacity = Math.max(0, bolt.material.opacity - dt * 2.5); });
      var nextFlash = 6 + rnd() * 8;
      A.updaters.push(function (dt) { nextFlash -= dt; if (nextFlash <= 0) { nextFlash = 7 + Math.random() * 12; A.flash = Math.max(A.flash, 0.5); if (A.onThunder) A.onThunder(); } });
    }
  }

  /* ======================================================================
     PEMBANGUN UTAMA
     ====================================================================== */
  Arena.build = function (scene, opts) {
    var arena = D.arenaById[opts.arena] || D.ARENAS[0];
    var weather = D.weatherById[opts.weather] || D.WEATHERS[0];
    var q = R3.quality;
    var A = { arena: arena, weather: weather, group: new THREE.Group(), updaters: [], disposables: [], t: 0, cheer: 0, flash: 0 };
    var G = A.group;
    scene.add(G);
    var tk = timeOf(arena, weather);
    var T = TIMES[tk];
    A.timeKey = tk;
    var rnd = U.rng(arena.id.length * 1013 + weather.id.length * 7 + F.n);

    // ---- langit ----
    var skyMat = new THREE.ShaderMaterial({
      uniforms: { top: { value: new THREE.Color(T.top) }, hor: { value: new THREE.Color(T.hor) }, bot: { value: new THREE.Color(U.mixHex(T.hor, '#000000', 0.5)) }, sunDir: { value: new V3(T.sunPos[0], T.sunPos[1], T.sunPos[2]).normalize() }, sunCol: { value: new THREE.Color(T.sun) }, glow: { value: (weather.rain || weather.fog) ? 0.0 : (tk === 'malam' ? 0.15 : 0.55) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 bot; uniform vec3 sunDir; uniform vec3 sunCol; uniform float glow; varying vec3 vP;' +
        'void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(hor, top, pow(clamp(h,0.0,1.0), 0.55)) : mix(hor, bot, clamp(-h*4.0,0.0,1.0));' +
        ' float s = max(0.0, dot(normalize(vP), sunDir)); c += sunCol * (pow(s, 8.0) * 0.35 + pow(s, 64.0) * 0.6) * glow; gl_FragColor = vec4(c,1.0); }',
      side: THREE.BackSide, depthWrite: false, fog: false
    });
    var sky = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 16), skyMat);
    sky.renderOrder = -10;
    G.add(sky); A.sky = sky;
    var sunDir = new V3(T.sunPos[0], T.sunPos[1], T.sunPos[2]).normalize();
    var sunSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: R3.tex.glow, color: new THREE.Color(tk === 'malam' ? '#dfe6ff' : T.sun), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    sunSpr.position.copy(sunDir).multiplyScalar(280); sunSpr.scale.setScalar(tk === 'malam' ? 18 : (tk === 'senja' ? 70 : 46));
    if (!weather.rain && !weather.fog) G.add(sunSpr);
    if (tk === 'malam') {
      var sn = q === 0 ? 150 : 400, sp = new Float32Array(sn * 3);
      for (var i = 0; i < sn; i++) { var th = rnd() * Math.PI * 2, ph = 0.08 + rnd() * 1.3; sp[i * 3] = Math.cos(th) * Math.cos(ph) * 300; sp[i * 3 + 1] = Math.sin(ph) * 300; sp[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * 300; }
      var sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
      G.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false })));
    }
    clouds(A, rnd, T, tk, weather);

    // ---- cahaya & bayangan ----
    A.hemi = new THREE.HemisphereLight(new THREE.Color(T.hs), new THREE.Color(T.hg), T.hi); G.add(A.hemi);
    A.sun = new THREE.DirectionalLight(new THREE.Color(T.sun), T.si);
    A.sunDir = sunDir;
    A.sun.position.copy(sunDir).multiplyScalar(60); G.add(A.sun); G.add(A.sun.target);
    A.baseHemi = T.hi; A.baseSun = T.si;
    if (tk === 'malam') { A.hemi.intensity = 0.5; }
    if (R3.shadows) {
      var sh = A.sun.shadow, ext = q >= 2 ? 30 : 24;
      A.sun.castShadow = true;
      sh.mapSize.set(q >= 2 ? 2048 : 1024, q >= 2 ? 2048 : 1024);
      sh.camera.left = -ext; sh.camera.right = ext; sh.camera.top = ext; sh.camera.bottom = -ext; sh.camera.near = 5; sh.camera.far = 140;
      sh.camera.updateProjectionMatrix();
      sh.bias = -0.0006; sh.normalBias = 0.025;
      A.shadowExt = ext;
    }

    // ---- kabut ----
    var fogFar = Math.max(1, F.L / 44);
    if (weather.fog) scene.fog = new THREE.FogExp2(new THREE.Color(T.fog), weather.fog * 0.9 / Math.sqrt(fogFar));
    else if (weather.rain) scene.fog = new THREE.Fog(new THREE.Color(T.fog), 25 * fogFar, 150 + 40 * fogFar);
    else if (tk === 'malam') scene.fog = new THREE.Fog(new THREE.Color(T.fog), 45 * fogFar, 220 + 30 * fogFar);
    else scene.fog = new THREE.Fog(new THREE.Color(T.fog), 90 + 20 * fogFar, 330);

    // ---- tanah & lapangan ----
    var S = SURF[arena.surface] || SURF.rumput;
    var outer = R3.mesh(arena.id === 'bukit' ? new THREE.CircleGeometry(Math.max(70, F.L * 0.8), 48) : new THREE.PlaneGeometry(800, 800), R3.mat(S.out), 0, -0.02, 0);
    outer.rotation.x = -Math.PI / 2; outer.receiveShadow = true; G.add(outer);
    buildField(A, S, arena.surface, q);
    buildGoals(A, arena);
    buildFence(A, arena, rnd);
    buildBoards(A, rnd);
    if (arena.id === 'kampung' || arena.id === 'rel' || arena.id === 'sawah' || arena.id === 'sekolah' || arena.id === 'alun') buildBunting(A, rnd, arena.id === 'sekolah' || arena.id === 'kampung' ? ['#e11d2e', '#ffffff'] : ['#e63946', '#ffbe0b', '#3a86ff', '#06d6a0', '#ffffff']);
    buildCrowd(A, rnd, q, tk);
    var deco = DECO[arena.id];
    if (deco) deco(A, rnd, q, tk);
    if (tk === 'malam') buildNightLights(A, rnd);
    buildWeather(A, weather, q, tk, rnd);

    var shadowC = new V3();
    A.update = function (dt, t, info) {
      A.t += dt;
      info = info || {};
      A.focusX = info.fx || 0; A.focusZ = info.fz || 0;
      for (var i = 0; i < A.updaters.length; i++) A.updaters[i](dt, A.t, info);
      // bayangan mengikuti bola (dibulatkan ke ukuran texel supaya tidak berkedip)
      if (A.sun.castShadow) {
        var step = (A.shadowExt * 2) / A.sun.shadow.mapSize.x * 4;
        shadowC.set(Math.round(U.clamp(A.focusX, -F.L / 2, F.L / 2) / step) * step, 0, Math.round(U.clamp(A.focusZ, -F.W / 2, F.W / 2) * 0.6 / step) * step);
        A.sun.target.position.copy(shadowC);
        A.sun.position.copy(A.sunDir).multiplyScalar(70).add(shadowC);
      }
      // jaring menggembung
      A.goals.forEach(function (g) {
        if (g.imp <= 0.001) return;
        g.imp *= Math.exp(-4 * dt);
        var pos = g.geo.attributes.position.array, b = g.base;
        for (var j = 0; j < pos.length; j += 3) {
          var dz = b[j] - g.iz, dy = b[j + 1] - (g.iy - F.goalH * 0.425);
          var f = Math.exp(-(dz * dz + dy * dy) * 0.9) * g.imp;
          pos[j + 2] = b[j + 2] + g.side * (f * 0.18 * Math.sin(A.t * 18) + f * 0.9);
        }
        g.geo.attributes.position.needsUpdate = true;
      });
      if (A.flash > 0) {
        A.flash = Math.max(0, A.flash - dt * 3);
        A.hemi.intensity = A.baseHemi + A.flash * 2.2;
      }
    };
    A.bulge = function (side, z, y) {
      A.goals.forEach(function (g) { if (g.side === side) { g.imp = 1; g.iz = -z; g.iy = y; } });
    };
    A.lightning = function (x, z) { A.flash = 1; if (A.bolt) A.bolt(x, z); };
    A.dispose = function () {
      R3.dispose(G);
      A.disposables.forEach(function (d) { if (d && d.dispose && !d.__baShared) d.dispose(); });
      A.disposables = [];
      if (scene.fog) scene.fog = null;
    };
    return A;
  };

  Arena.timeOf = timeOf;
  Arena.TIMES = TIMES;
})(typeof window !== 'undefined' ? window : globalThis);
