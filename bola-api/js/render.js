/* Bola Api Arena — inti render 3D (three.js r128): renderer, cache material, tekstur, kamera */
(function (root) {
  'use strict';
  var BA = root.BA, U = BA.U;
  var R3 = BA.R3 = {};
  var THREE = root.THREE;

  R3.ok = false;
  R3.quality = 1;
  R3.QUALITY = [
    { n: 'Hemat', pr: 1, parts: 0.4, aa: false },
    { n: 'Normal', pr: 1.5, parts: 0.75, aa: true },
    { n: 'Tinggi', pr: 2, parts: 1, aa: true }
  ];

  R3.init = function (canvas, quality) {
    if (!THREE) return false;
    R3.quality = U.clamp(U.num(quality, 1), 0, 2);
    var q = R3.QUALITY[R3.quality];
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: q.aa, powerPreference: 'high-performance', alpha: false, stencil: false });
    } catch (e) {
      try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false }); } catch (e2) { return false; }
    }
    R3.renderer = renderer;
    R3.canvas = canvas;
    renderer.setClearColor(0x140d1c, 1);
    R3.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 600);
    R3.lost = false;
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); R3.lost = true; if (R3.onLost) R3.onLost(); }, false);
    canvas.addEventListener('webglcontextrestored', function () { R3.lost = false; if (R3.onRestored) R3.onRestored(); }, false);
    R3.resize();
    R3.initShared();
    R3.ok = true;
    return true;
  };

  R3.setQuality = function (q) {
    R3.quality = U.clamp(U.num(q, 1), 0, 2);
    R3.resize();
  };
  /* bayangan nyata (Normal & Tinggi). Dipasang saat adegan baru dibangun supaya bahan dikompilasi sesuai */
  R3.applyShadows = function () {
    if (!R3.renderer) return;
    R3.shadows = R3.quality >= 1;
    R3.renderer.shadowMap.enabled = R3.shadows;
    R3.renderer.shadowMap.type = R3.quality >= 2 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    R3.renderer.shadowMap.autoUpdate = true;
  };
  R3.parts = function () { return R3.QUALITY[R3.quality].parts; };

  R3.resize = function () {
    if (!R3.renderer) return;
    var w = Math.max(1, root.innerWidth || 800), h = Math.max(1, root.innerHeight || 600);
    var pr = Math.min(root.devicePixelRatio || 1, R3.QUALITY[R3.quality].pr);
    R3.renderer.setPixelRatio(pr);
    R3.renderer.setSize(w, h, false);
    R3.w = w; R3.h = h; R3.aspect = w / h;
    R3.camera.aspect = R3.aspect;
    R3.camera.updateProjectionMatrix();
  };

  R3.render = function (scene, cam) {
    if (!R3.ok || R3.lost) return;
    R3.renderer.render(scene, cam || R3.camera);
  };

  /* ---------- geometri & material bersama ---------- */
  R3.initShared = function () {
    var g = R3.geo = {};
    g.box = new THREE.BoxGeometry(1, 1, 1);
    g.cyl = new THREE.CylinderGeometry(1, 1, 1, 10, 1);
    g.cyl6 = new THREE.CylinderGeometry(1, 1, 1, 6, 1);
    g.limb = new THREE.CylinderGeometry(1, 0.85, 1, 8, 1); g.limb.translate(0, -0.5, 0);
    g.sphere = new THREE.SphereGeometry(1, 14, 10);
    g.sphereLo = new THREE.SphereGeometry(1, 8, 6);
    g.cone = new THREE.ConeGeometry(1, 1, 10);
    g.plane = new THREE.PlaneGeometry(1, 1);
    g.circle = new THREE.CircleGeometry(1, 20);
    Object.keys(g).forEach(function (k) { g[k].__baShared = true; });
    R3.matCache = {};
    R3.tex = {};
    R3.tex.blob = R3.radialTex(64, [[0, 'rgba(0,0,0,0.55)'], [0.6, 'rgba(0,0,0,0.25)'], [1, 'rgba(0,0,0,0)']]);
    R3.tex.glow = R3.radialTex(64, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']]);
    R3.tex.soft = R3.radialTex(32, [[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]);
    Object.keys(R3.tex).forEach(function (k) { R3.tex[k].__baShared = true; });
  };

  R3.radialTex = function (size, stops) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var x = c.getContext('2d');
    var gr = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); });
    x.fillStyle = gr; x.fillRect(0, 0, size, size);
    var t = new THREE.CanvasTexture(c);
    return t;
  };

  R3.canvasTex = function (w, h, draw, opts) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var x = c.getContext('2d');
    draw(x, w, h);
    var t = new THREE.CanvasTexture(c);
    opts = opts || {};
    if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
    if (opts.aniso && R3.renderer) t.anisotropy = Math.min(4, R3.renderer.capabilities.getMaxAnisotropy());
    return t;
  };

  /* material Lambert yang dipakai ulang (jangan di-dispose per objek) */
  R3.mat = function (color, opts) {
    opts = opts || {};
    var key = 'L' + color + (opts.emissive || '') + (opts.ei || '') + (opts.flat ? 'f' : '') + (opts.side || '') + (opts.op || '');
    var m = R3.matCache[key];
    if (m) return m;
    m = new THREE.MeshLambertMaterial({ color: new THREE.Color(color) });
    if (opts.emissive) { m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = opts.ei || 1; }
    if (opts.side) m.side = THREE.DoubleSide;
    if (opts.op) { m.transparent = true; m.opacity = opts.op; }
    m.__baShared = true;
    R3.matCache[key] = m;
    return m;
  };
  R3.basic = function (color, opts) {
    opts = opts || {};
    var key = 'B' + color + (opts.add ? 'a' : '') + (opts.op || '') + (opts.side ? 'd' : '') + (opts.nofog ? 'n' : '');
    var m = R3.matCache[key];
    if (m) return m;
    m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color) });
    if (opts.add) { m.blending = THREE.AdditiveBlending; m.transparent = true; m.depthWrite = false; }
    if (opts.op) { m.transparent = true; m.opacity = opts.op; m.depthWrite = false; }
    if (opts.side) m.side = THREE.DoubleSide;
    if (opts.nofog) m.fog = false;
    m.__baShared = true;
    R3.matCache[key] = m;
    return m;
  };

  R3.mesh = function (geo, mat, x, y, z, sx, sy, sz) {
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    if (sx != null) m.scale.set(sx, sy == null ? sx : sy, sz == null ? sx : sz);
    return m;
  };

  /* buang objek beserta isinya kecuali yang ditandai bersama */
  R3.dispose = function (obj) {
    if (!obj) return;
    if (obj.parent) obj.parent.remove(obj);
    obj.traverse(function (o) {
      if (o.geometry && !o.geometry.__baShared) o.geometry.dispose();
      var mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      mats.forEach(function (m) {
        if (m.__baShared) return;
        ['map', 'alphaMap', 'emissiveMap'].forEach(function (k) { if (m[k] && !m[k].__baShared) m[k].dispose(); });
        if (m.uniforms) Object.keys(m.uniforms).forEach(function (k) { var v = m.uniforms[k].value; if (v && v.isTexture && !v.__baShared) v.dispose(); });
        m.dispose();
      });
    });
  };

  /* ---------- kamera pertandingan ---------- */
  var CamRig = BA.CamRig = function (cam) {
    this.cam = cam;
    this.pos = new THREE.Vector3(0, 18, 26);
    this.look = new THREE.Vector3(0, 0, 0);
    this.shake = 0;
    this.side = 1;           // 1: kamera di sisi +Z (tim 0 menyerang ke kanan layar), -1: sebaliknya
    this.mode = 'auto';
    this.fwd = { x: 0, z: -1 }; this.right = { x: 1, z: 0 };
    this.tmp = new THREE.Vector3();
  };
  CamRig.prototype.effMode = function () {
    if (this.mode === 'samping' || this.mode === 'belakang') return this.mode;
    return R3.aspect >= 1.05 ? 'samping' : 'belakang';
  };
  /* fx,fz: titik fokus (bola), lead: arah serangan tim pemain (+1/-1) */
  CamRig.prototype.update = function (dt, fx, fz, opts) {
    opts = opts || {};
    var F = BA.D.FIELD;
    var mode = this.effMode();
    var cam = this.cam, px, py, pz, lx, ly, lz;
    var side = this.side;
    fx = U.clamp(U.num(fx, 0), -F.L / 2 - 2, F.L / 2 + 2); fz = U.clamp(U.num(fz, 0), -F.W / 2 - 2, F.W / 2 + 2);
    // lapangan besar: kamera sedikit lebih jauh; ditambah pilihan jarak kamera pemain
    var zoom = (opts.zoom || 1) * (this.userZoom || 1) * (1 + ((F.ss || 1) - 1) * 0.35);
    if (mode === 'samping') {
      var wide = R3.aspect >= 1.6;
      var cx = U.clamp(fx * 0.9, -F.L / 2 + 8, F.L / 2 - 8);
      var tz = U.clamp(fz * 0.85, -F.W / 2 + 1, F.W / 2 - 1);
      var dist = (wide ? 14.5 : 17.5) * zoom, hh = (wide ? 10 : 12) * zoom;
      px = cx; py = hh; pz = tz + side * dist;
      lx = cx; ly = 0.4; lz = tz - side * 0.6;
      cam.fov = wide ? 44 : 50;
    } else {
      var dir = side; // pemain lokal menyerang ke atas layar
      var bx = U.clamp(fx, -F.L / 2 - 1, F.L / 2 + 1);
      px = bx - dir * 12 * zoom; py = 11 * zoom; pz = fz * 0.7;
      lx = bx + dir * 5; ly = 0; lz = fz * 0.75;
      cam.fov = R3.aspect < 0.7 ? 60 : 54;
    }
    if (opts.override) { px = opts.override.px; py = opts.override.py; pz = opts.override.pz; lx = opts.override.lx; ly = opts.override.ly; lz = opts.override.lz; }
    var k = opts.snap ? 1 : 1 - Math.exp(-(opts.k || 4.5) * dt);
    this.pos.x += (px - this.pos.x) * k; this.pos.y += (py - this.pos.y) * k; this.pos.z += (pz - this.pos.z) * k;
    this.look.x += (lx - this.look.x) * k; this.look.y += (ly - this.look.y) * k; this.look.z += (lz - this.look.z) * k;
    cam.position.copy(this.pos);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.2);
      var s = this.shake * this.shake * 0.6;
      cam.position.x += (Math.random() - 0.5) * s; cam.position.y += (Math.random() - 0.5) * s; cam.position.z += (Math.random() - 0.5) * s;
    }
    cam.lookAt(this.look);
    cam.updateProjectionMatrix();
    // arah layar ke tanah untuk joystick
    var fxv = this.look.x - this.pos.x, fzv = this.look.z - this.pos.z, fl = Math.sqrt(fxv * fxv + fzv * fzv) || 1;
    this.fwd.x = fxv / fl; this.fwd.z = fzv / fl;
    this.right.x = -this.fwd.z; this.right.z = this.fwd.x;
  };
  /* ubah joystick layar (jx kanan+, jy bawah+) jadi arah dunia */
  CamRig.prototype.toWorld = function (jx, jy) {
    var x = this.right.x * jx - this.fwd.x * jy, z = this.right.z * jx - this.fwd.z * jy;
    return { x: x, z: z };
  };
  CamRig.prototype.kick = function (v) { this.shake = Math.min(1.2, this.shake + v); };
})(typeof window !== 'undefined' ? window : globalThis);
