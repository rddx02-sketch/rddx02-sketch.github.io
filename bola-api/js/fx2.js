/* Bola Api Arena — efek serangan berbasis sprite hasil Higgsfield:
   flipbook 4×4 (ledakan, gelombang kejut, petir, cakaran, pusaran, cipratan, api, aura, retakan, ombak api)
   dan lambang jurus (naga, macan, garuda, banteng, keris, meteor, beliung, tinju, tapak, tameng, ombak, sayap, karang, selendang, seribu tangan).
   Semua gambar abu-abu di atas hitam; warnanya diberikan shader dari warna api tendangan/jurus (aditif). */
(function (root) {
  'use strict';
  var BA = root.BA, U = BA.U, R3 = BA.R3, FX = BA.FX;
  var THREE = root.THREE;

  var T = BA.FXTex = { cache: {} };
  T.FLIPS = ['boom', 'shock', 'bolt', 'slash', 'vortex', 'splash', 'flame', 'spark', 'aura', 'crack', 'firewave'];
  T.EMBLEMS = ['naga', 'macan', 'garuda', 'banteng', 'keris', 'meteor', 'beliung', 'tinju', 'palm', 'shield', 'wave', 'wings', 'rock', 'ribbon', 'hands'];
  /* lambang untuk tiap jurus kiper (kunci = D.SKILLS[..].fx) */
  T.SKILL_EMBLEM = { palm: 'palm', claw: '', dome: 'shield', wall: 'rock', water: 'wave', scarf: 'ribbon', vortex: 'beliung', hands: 'hands', wings: 'wings', quake: 'rock' };
  T.url = function (name) { var d = root.BA_FX_DATA; return (d && d[name]) || ('img/fx/' + name + '.jpg'); };
  T.get = function (name) {
    var c = T.cache[name];
    if (c) return c.ok ? c.tex : null;
    c = T.cache[name] = { ok: false, tex: null, fail: false };
    if (!THREE || !THREE.TextureLoader) { c.fail = true; return null; }
    try {
      c.tex = new THREE.TextureLoader().load(T.url(name), function () { c.ok = true; }, undefined, function () { c.fail = true; });
      c.tex.__baShared = true;
      c.tex.generateMipmaps = false; c.tex.minFilter = THREE.LinearFilter; c.tex.magFilter = THREE.LinearFilter;
      c.tex.wrapS = c.tex.wrapT = THREE.ClampToEdgeWrapping;
      c.tex.format = THREE.LuminanceFormat;
    } catch (e) { c.fail = true; }
    return null;
  };
  T.preload = function (list) { (list || []).forEach(function (n) { if (n) T.get(n); }); };
  /* muat di awal laga: efek umum + lambang jurus para pemain yang turun */
  T.preloadFor = function (st) {
    var want = ['f_boom', 'f_shock', 'f_spark', 'f_bolt', 'f_aura', 'f_firewave'], D = BA.D;
    if (st && st.players) st.players.forEach(function (p) {
      if (p.shot && p.shot.id) want.push('e_' + p.shot.id);
      if (p.role === 'GK' && p.style && p.style.map) Object.keys(p.style.map).forEach(function (z) {
        var sk = D.SKILLS[p.style.map[z]], em = sk && T.SKILL_EMBLEM[sk.fx];
        if (em) want.push('e_' + em);
        if (sk && sk.fx === 'claw') want.push('f_slash');
        if (sk && sk.fx === 'water') want.push('f_splash');
        if (sk && sk.fx === 'vortex') want.push('f_vortex');
        if (sk && sk.fx === 'quake') want.push('f_crack');
      });
    });
    T.preload(want);
  };

  var VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  var FS = [
    'uniform sampler2D map; uniform vec3 c0; uniform vec3 c1; uniform float op; uniform vec4 fr; varying vec2 vUv;',
    'void main(){',
    '  float l = texture2D(map, fr.xy + vUv * fr.zw).r;',
    '  l = smoothstep(0.03, 1.0, l);',
    '  vec3 col = mix(c0, c1, smoothstep(0.08, 0.62, l)) * l * 1.3 + vec3(1.0) * pow(l, 4.0) * 0.6;',
    '  gl_FragColor = vec4(col * op, 1.0);',
    '}'
  ].join('\n');
  function rampMat(tex, c0, c1) {
    return new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, c0: { value: new THREE.Color(c0) }, c1: { value: new THREE.Color(c1) }, op: { value: 1 }, fr: { value: new THREE.Vector4(0, 0, 1, 1) } },
      vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false
    });
  }
  var PLANE = null;
  function plane() { if (!PLANE) { PLANE = new THREE.PlaneGeometry(1, 1); PLANE.__baShared = true; } return PLANE; }
  function orient(m, o, t) {
    if (o.flat) { m.rotation.set(-Math.PI / 2, 0, (o.rot || 0) + (o.spin || 0) * t); return; }
    if (o.yaw != null) { m.rotation.set(0, o.yaw, (o.rot || 0) + (o.spin || 0) * t); return; }
    m.quaternion.copy(R3.camera.quaternion);
    var rz = (o.rot || 0) + (o.spin || 0) * t;
    if (rz) m.rotateZ(rz);
  }

  /* flipbook 16 bingkai. o: size, c0, c1, fps, loops, flat (rebah di tanah), yaw, grow, op, follow {x,z}, rise */
  FX.prototype.flip = function (name, x, y, z, o) {
    o = o || {};
    var tex = T.get('f_' + name);
    if (!tex) return null;
    var mat = rampMat(tex, o.c0 || this.fire[0], o.c1 || this.fire[1]);
    var m = new THREE.Mesh(plane(), mat);
    m.position.set(x, y, z); m.renderOrder = 6; m.frustumCulled = false;
    var size = o.size || 3, fps = o.fps || 24, n = 16, loops = o.loops || 1, sy = o.sy || 1;
    var life = n * loops / fps;
    var e = { group: m, life: life + 0.02 };
    e.update = function (dt, t) {
      var f = Math.min(n * loops - 1, Math.floor(t * fps)) % n;
      var col = f % 4, row = (f / 4) | 0;
      mat.uniforms.fr.value.set(col / 4 + 0.0015, 1 - (row + 1) / 4 + 0.0015, 0.247, 0.247);
      var s = size * (1 + (o.grow || 0) * t);
      m.scale.set(s, s * sy, 1);
      if (o.follow) { m.position.x = o.follow.x + (o.ox || 0); m.position.z = o.follow.z + (o.oz || 0); }
      if (o.rise) m.position.y = y + o.rise * t;
      orient(m, o, t);
      var fade = loops > 1 ? Math.min(1, t / 0.12, (life - t) / 0.2) : 1;
      mat.uniforms.op.value = (o.op == null ? 1 : o.op) * Math.max(0, fade);
    };
    e.update(0, 0);
    return this.spawn(e);
  };

  /* lambang jurus: muncul membesar, bertahan, lalu memudar. o: size, c0, c1, life, op, flat, yaw, spin, grow, follow, out */
  FX.prototype.emblem = function (name, x, y, z, o) {
    o = o || {};
    var tex = T.get('e_' + name);
    if (!tex) return null;
    var mat = rampMat(tex, o.c0 || this.fire[0], o.c1 || this.fire[1]);
    var m = new THREE.Mesh(plane(), mat);
    m.position.set(x, y, z); m.renderOrder = 5; m.frustumCulled = false;
    var size = o.size || 5, life = o.life || 1.0, out = o.out || 0.3, grow = o.grow == null ? 0.14 : o.grow;
    var e = { group: m, life: life };
    e.update = function (dt, t) {
      var kin = U.clamp(t / (o.inT || 0.14), 0, 1), kout = U.clamp((life - t) / out, 0, 1);
      var s = size * (0.5 + 0.5 * U.easeOut(kin)) * (1 + grow * t);
      m.scale.set(s, s, 1);
      if (o.follow) { m.position.x = o.follow.x + (o.ox || 0); m.position.z = o.follow.z + (o.oz || 0); }
      orient(m, o, t);
      mat.uniforms.op.value = (o.op == null ? 0.9 : o.op) * kin * kout * (0.93 + 0.07 * Math.sin(t * 38));
    };
    e.fade = function () { life = Math.min(life, e.t + out); e.life = life; };
    e.update(0, 0);
    return this.spawn(e);
  };

  /* ---------- rangkaian siap pakai ---------- */
  /* saat api meledak di kaki penendang: lambang jurus menjulang di belakangnya */
  FX.prototype.shotBurst = function (type, from, dir, c0, c1, ult) {
    var big = ult ? 1.35 : 1;
    this.flip('boom', from.x, 0.9, from.z, { size: 3.6 * big, c0: c0, c1: c1, fps: 26 });
    this.flip('shock', from.x, 0.06, from.z, { size: 7 * big, c0: c0, c1: c1, flat: true, fps: 30 });
    this.flip('spark', from.x, 0.6, from.z, { size: 3 * big, c0: c1, c1: '#ffffff', fps: 30 });
    if (R3.quality > 0) this.flip('firewave', from.x, 1.0, from.z, { size: 7 * big, c0: c0, c1: c1, fps: 22, sy: 0.6 });
    return this.emblem(type, from.x - dir * 1.5, 2.9 * big, from.z, { size: 6.4 * big, c0: c0, c1: c1, life: ult ? 1.5 : 1.15, grow: 0.22 });
  };
  /* aura mengumpul selama ancang-ancang */
  FX.prototype.chargeAura = function (pos, c0, c1, dur) {
    return this.flip('aura', pos.x, 1.15, pos.z, { size: 3.1, c0: c0, c1: c1, fps: 20, loops: Math.max(1, Math.round((dur || 0.7) * 20 / 16)), op: 0.85 });
  };
  /* jurus kiper: lambang di depan gawang + efek khas */
  FX.prototype.skillBurst = function (fxKind, at, face, col) {
    var c0 = col || '#8fd3ff', c1 = '#ffffff';
    var em = T.SKILL_EMBLEM[fxKind];
    var yaw = face > 0 ? Math.PI / 2 : -Math.PI / 2;
    if (em) this.emblem(em, at.x + face * 0.35, Math.max(1.5, at.y + 0.5), at.z, { size: fxKind === 'dome' || fxKind === 'hands' ? 4.6 : 4.2, c0: c0, c1: c1, life: 1.25, yaw: yaw, spin: fxKind === 'dome' || fxKind === 'hands' ? 0.9 : (fxKind === 'vortex' ? 3 : 0), grow: 0.1, op: 0.85 });
    if (fxKind === 'claw') { this.flip('slash', at.x + face * 0.4, at.y + 0.2, at.z, { size: 4.4, c0: c0, c1: c1, yaw: yaw, fps: 24 }); this.flip('slash', at.x + face * 0.6, at.y + 0.1, at.z, { size: 3.4, c0: c1, c1: c1, yaw: yaw, fps: 30, rot: 1.2 }); }
    if (fxKind === 'water') this.flip('splash', at.x + face * 0.3, 1.2, at.z, { size: 5, c0: '#4cc9f0', c1: '#e8fbff', fps: 22 });
    if (fxKind === 'vortex') this.flip('vortex', at.x + face * 0.3, 1.8, at.z, { size: 4.2, c0: c0, c1: c1, fps: 22, loops: 2, op: 0.8 });
    if (fxKind === 'quake') this.flip('crack', at.x + face * 0.8, 0.07, at.z, { size: 7, c0: c0, c1: '#fff2c0', flat: true, fps: 18 });
    if (fxKind === 'dome' || fxKind === 'hands') this.emblem('shield', at.x + face * 0.2, 0.07, at.z, { size: 5.5, c0: c0, c1: c1, life: 1.2, flat: true, spin: 1.4, op: 0.6 });
  };
  /* benturan tenaga di depan kiper */
  FX.prototype.clashBurst = function (at, c0, c1) {
    this.flip('bolt', at.x, at.y, at.z, { size: 4.2, c0: c0, c1: c1, fps: 30 });
    this.flip('spark', at.x, at.y, at.z, { size: 3.2, c0: c1, c1: '#ffffff', fps: 30 });
  };
  /* gol: ledakan besar di mulut gawang */
  FX.prototype.goalBlast = function (x, y, z, dir, c0, c1) {
    this.flip('boom', x, Math.max(1.1, y), z, { size: 6.2, c0: c0, c1: c1, fps: 22 });
    this.flip('shock', x - dir * 0.6, 0.06, z, { size: 11, c0: c0, c1: c1, flat: true, fps: 26 });
    this.flip('firewave', x - dir * 0.4, 1.3, z, { size: 9, c0: c0, c1: c1, fps: 20, sy: 0.6, yaw: dir > 0 ? Math.PI / 2 : -Math.PI / 2 });
    this.flip('spark', x, y, z, { size: 5, c0: c1, c1: '#ffffff', fps: 28 });
  };
  /* tendangan jauh / cungkil di tengah permainan */
  FX.prototype.strikeFx = function (x, z, kind, c0, c1) {
    this.flip('spark', x, 0.4, z, { size: kind === 'jauh' ? 2.6 : 1.9, c0: c1, c1: '#ffffff', fps: 30 });
    this.flip('shock', x, 0.06, z, { size: kind === 'jauh' ? 4.4 : 3, c0: c0, c1: c1, flat: true, fps: 34 });
    if (kind === 'jauh') this.flip('boom', x, 0.6, z, { size: 1.9, c0: c0, c1: c1, fps: 34 });
  };
  FX.prototype.impactFx = function (x, y, z, size, c0, c1) {
    this.flip('spark', x, y, z, { size: size || 2, c0: c0 || '#ffe9b0', c1: c1 || '#ffffff', fps: 32 });
  };
  FX.prototype.boltFx = function (x, z) {
    this.flip('bolt', x, 1.6, z, { size: 6.5, c0: '#8fb8ff', c1: '#ffffff', fps: 26 });
    this.flip('shock', x, 0.06, z, { size: 8, c0: '#8fb8ff', c1: '#ffffff', flat: true, fps: 28 });
  };
  /* ======================================================================
     EFEK FISIK REALISTIS: sentuhan kaki ke bola, jejak udara bola keras, dan tangkapan / tepisan kiper
     ====================================================================== */
  /* cincin tekanan udara tipis yang mengembang tegak lurus arah tendangan (atau arah datangnya bola) */
  function airRing(fx, x, y, z, nx, nz, size, life, col, op) {
    var g = new THREE.RingGeometry(0.42, 0.5, 40);
    var mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(col || '#ffffff'), transparent: true, opacity: op || 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    var m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z); m.renderOrder = 7; m.frustumCulled = false;
    m.rotation.y = Math.atan2(nx, nz);
    var e = { group: m, life: life || 0.32 };
    e.update = function (dt, t) {
      var k = t / e.life, s = size * (0.25 + U.easeOut(Math.min(1, k)) * 1.0);
      m.scale.set(s, s, 1);
      m.position.x = x + nx * k * 0.6; m.position.z = z + nz * k * 0.6;
      mat.opacity = (op || 0.5) * (1 - k) * (1 - k);
    };
    e.update(0, 0);
    return fx.spawn(e);
  }
  /* warna rumput/tanah arena untuk serpihan yang tercungkil kaki */
  FX.prototype.setTurf = function (surf) {
    if (!surf) return;
    this.turf = [surf.a || surf.base || '#4f8a34', surf.worn || surf.b || '#6b5a3a', !!(surf.neat && surf.edge) || !!surf.hard];
  };
  /* sentuhan kaki ke bola. pow 0..1.2, (dx, dz) arah tendangan, kind: 'pass' | 'lob' | 'jauh' | 'cungkil' | 'jurus' */
  FX.prototype.kickFx = function (x, y, z, dx, dz, pow, kind) {
    pow = U.clamp(U.num(pow, 0.6), 0.1, 1.3);
    var l = Math.sqrt(dx * dx + dz * dz) || 1; dx /= l; dz /= l;
    var pm = this.pm || 1, i, n;
    var turf = this.turf || ['#4f8a34', '#6b5a3a', false];
    var hard = turf[2];
    var strong = kind === 'jauh' || kind === 'jurus' || pow > 0.75;
    /* 1. kilat kontak kecil tepat di bola (sepatu menghantam kulit bola) */
    this.flip('spark', x, y + 0.05, z, { size: 0.8 + pow * 0.9, c0: '#fff2d0', c1: '#ffffff', fps: 36, op: 0.9 });
    /* 2. serpihan rumput & tanah tercungkil ke arah tendangan (lantai keras: hanya debu halus) */
    n = Math.round((hard ? 4 : 8 + pow * 16) * pm);
    for (i = 0; i < n; i++) {
      var sp = (1.5 + Math.random() * 3.5) * (0.5 + pow * 0.6), side = (Math.random() - 0.5) * 1.6;
      this.normPS.emit(x - dx * 0.15 + (Math.random() - 0.5) * 0.12, 0.05, z - dz * 0.15 + (Math.random() - 0.5) * 0.12,
        dx * sp - dz * side, 1.8 + Math.random() * 2.6 * (0.4 + pow * 0.5), dz * sp + dx * side,
        0.5 + Math.random() * 0.45, 0.09 + Math.random() * 0.07, 0.06, i % 3 ? turf[0] : turf[1], turf[1], 1, 9.8, 0.985);
    }
    /* 3. kepulan debu rendah di titik tumpu, condong ke belakang kaki */
    n = Math.round((strong ? 7 : 4) * pm);
    for (i = 0; i < n; i++) {
      var a = Math.random() * U.TAU;
      this.normPS.emit(x - dx * 0.3, 0.08, z - dz * 0.3, Math.cos(a) * 0.9 - dx * 0.6, 0.25 + Math.random() * 0.45, Math.sin(a) * 0.9 - dz * 0.6,
        0.55 + Math.random() * 0.5, 0.3, 1.0 + pow * 0.5, this.dustCol || '#cdb48a', this.dustCol2 || '#9c805a', hard ? 0.32 : 0.45, -0.15, 0.95);
    }
    /* 4. cincin tekanan udara saat tendangan keras */
    if (strong) airRing(this, x + dx * 0.25, y + 0.05, z + dz * 0.25, dx, dz, 0.9 + pow * 0.9, 0.3, '#ffffff', 0.38 + pow * 0.2);
    /* 5. jejak udara yang mengikuti bola sesaat (makin keras makin panjang) */
    if (pow > 0.35 || kind === 'cungkil' || kind === 'lob') this.ballStreak(0.25 + pow * 0.45, kind === 'cungkil' || kind === 'lob' ? 0.55 : 1);
  };
  /* jejak udara: garis partikel putih tipis di sepanjang lintasan bola yang baru ditendang */
  FX.prototype.ballStreak = function (dur, w) {
    var fx = this, prev = null, ball = this.ballGroup;
    if (!ball) return;
    if (this.streakE && !this.streakE.dead) { this.streakE.life = Math.max(this.streakE.life, this.streakE.t + dur); return; }
    var e = { life: dur };
    e.update = function (dt, t) {
      var p = ball.position;
      if (!ball.visible) { prev = null; return; }
      if (prev) {
        var ddx = p.x - prev.x, ddy = p.y - prev.y, ddz = p.z - prev.z, d = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz);
        if (d > 0.02 && d < 4) {
          var k = Math.max(1, Math.ceil(d / 0.07)), fade = 1 - t / e.life;
          for (var i = 0; i < k; i++) {
            var f = i / k;
            fx.addPS.emit(prev.x + ddx * f, prev.y + ddy * f, prev.z + ddz * f, 0, 0, 0, 0.18 + 0.1 * fade, 0.17 * (w || 1), 0.02, '#ffffff', '#cfe6ff', 0.32 * fade, 0, 1);
          }
        }
      }
      prev = { x: p.x, y: p.y, z: p.z };
    };
    this.streakE = this.spawn(e);
  };
  /* kiper menangkap / menepis. (x, y, z) titik bola mengenai sarung tangan, face = arah keluar dari gawang (+1/−1 di sumbu x),
     kind: 'catch' | 'parry' | 'smother' | 'punch', pow = kerasnya tendangan 0..1.3 */
  FX.prototype.keeperFx = function (x, y, z, face, kind, pow, col) {
    pow = U.clamp(U.num(pow, 0.7), 0.2, 1.3);
    var pm = this.pm || 1, i, n, fx = this;
    face = face >= 0 ? 1 : -1;
    var catchIt = kind === 'catch' || kind === 'smother';
    /* 1. sentakan di sarung tangan: kilat putih kecil + cincin tekanan menghadap datangnya bola */
    this.flip('spark', x, y, z, { size: catchIt ? 0.7 + pow * 0.5 : 1.1 + pow * 0.9, c0: col || '#e8f6ff', c1: '#ffffff', fps: catchIt ? 44 : 34, op: catchIt ? 0.75 : 1 });
    airRing(this, x, y, z, face, 0, catchIt ? 0.8 + pow * 0.6 : 1.3 + pow * 0.8, catchIt ? 0.26 : 0.34, col || '#dff3ff', catchIt ? 0.45 : 0.6);
    /* 2. serbuk kapur / keringat dari sarung tangan */
    n = Math.round((catchIt ? 9 : 6) * pm);
    for (i = 0; i < n; i++) {
      var a = Math.random() * U.TAU;
      this.normPS.emit(x + face * 0.08, y, z, face * (0.4 + Math.random() * 0.9) + Math.cos(a) * 0.5, Math.random() * 0.9 - 0.1, Math.sin(a) * 0.9,
        0.4 + Math.random() * 0.35, 0.07, 0.38, '#f4f1ea', '#cfc8bb', 0.35, -0.3, 0.93);
    }
    if (catchIt) {
      /* 3. bola diredam: percik kecil berputar lalu padam (sisa putaran bola di pelukan) */
      var t0 = 0, e = { life: 0.35 };
      e.update = function (dt, t) {
        t0 += dt;
        if (Math.random() < 0.7) {
          var ang = t * 22 + Math.random() * 0.5, r = 0.2;
          fx.addPS.emit(x + face * 0.05, y + Math.sin(ang) * r, z + Math.cos(ang) * r, face * 0.4, Math.sin(ang) * 1.2, Math.cos(ang) * 1.2,
            0.22, 0.09 * (1 - t / e.life), 0.02, '#fff3c0', fx.fire[0], 0.8, 0, 0.9);
        }
      };
      this.spawn(e);
    } else {
      /* 3. tepisan: semburan percik ke arah luar gawang + sedikit asap api yang terpecah */
      n = Math.round((10 + pow * 18) * pm);
      for (i = 0; i < n; i++) {
        var s2 = 3 + Math.random() * 6, up = Math.random() * 3.5, sd = (Math.random() - 0.5) * 6;
        this.addPS.emit(x, y, z, face * s2, up, sd, 0.25 + Math.random() * 0.3, 0.12, 0.02, '#ffffff', col || '#bfe9ff', 1, 6, 0.95);
      }
      this.burst(x, y, z, 'smoke', { n: 6 });
    }
    /* 4. kiper terbang menyentuh tanah: debu & rumput terlempar di sisi badan */
    if (y < 1.0 || kind === 'smother') {
      n = Math.round(8 * pm);
      for (i = 0; i < n; i++) {
        var a2 = Math.random() * U.TAU, tf = this.turf || ['#4f8a34', '#6b5a3a'];
        this.normPS.emit(x - face * 0.4, 0.08, z, Math.cos(a2) * 1.6, 0.6 + Math.random() * 1.2, Math.sin(a2) * 1.6, 0.5 + Math.random() * 0.3, 0.06, 0.04, tf[0], tf[1], 1, 9.8, 0.98);
      }
      this.burst(x - face * 0.4, 0.1, z, 'dust', { n: 8 });
    }
  };

  /* ======================================================================
     EFEK EPIK BERLAPIS untuk adegan jurus: lingkaran rajah di tanah, pilar cahaya, pusaran debu,
     gelombang kejut bertingkat, jejak api spiral, benturan bertenaga, perisai pecah / riak perisai.
     ====================================================================== */
  /* jalankan fn setelah `delay` detik waktu efek (ikut hit-stop & jeda) */
  FX.prototype.later = function (delay, fn) {
    var done = false, w = { life: delay + 0.05 };
    w.update = function (dt, t) { if (!done && t >= delay) { done = true; fn(); } };
    return this.spawn(w);
  };
  var runeTexC = null;
  function runeTex() {
    if (runeTexC) return runeTexC;
    var cv = document.createElement('canvas'); cv.width = cv.height = 512;
    var x = cv.getContext('2d'), c = 256, i;
    x.fillStyle = '#000'; x.fillRect(0, 0, 512, 512);
    x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineCap = 'round';
    var ring = function (r, w, a) { x.globalAlpha = a; x.lineWidth = w; x.beginPath(); x.arc(c, c, r, 0, Math.PI * 2); x.stroke(); };
    ring(246, 7, 1); ring(232, 2, 0.8); ring(176, 5, 0.95); ring(164, 2, 0.6); ring(78, 4, 0.9);
    /* rajah: tanda-tanda pendek di antara dua lingkaran luar */
    for (i = 0; i < 48; i++) {
      var a = i / 48 * Math.PI * 2, r0 = 186, r1 = i % 4 === 0 ? 226 : (i % 2 ? 204 : 214);
      x.globalAlpha = 0.9; x.lineWidth = i % 4 === 0 ? 6 : 3;
      x.beginPath(); x.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0); x.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1); x.stroke();
      if (i % 4 === 2) { x.beginPath(); x.arc(c + Math.cos(a) * 214, c + Math.sin(a) * 214, 5, 0, 6.3); x.fill(); }
    }
    /* bintang delapan & segitiga bersilang di dalam */
    x.globalAlpha = 0.85; x.lineWidth = 4;
    for (var k = 0; k < 2; k++) {
      x.beginPath();
      for (i = 0; i <= 4; i++) { var b = (i * 2 / 4 + k / 4) * Math.PI * 2 * 0.5 * 2 / 2, rr = 164; var ang = i / 4 * Math.PI * 2 + k * Math.PI / 4; if (i === 0) x.moveTo(c + Math.cos(ang) * rr, c + Math.sin(ang) * rr); else x.lineTo(c + Math.cos(ang) * rr, c + Math.sin(ang) * rr); void b; }
      x.stroke();
    }
    for (k = 0; k < 2; k++) {
      x.beginPath();
      for (i = 0; i <= 3; i++) { var ang2 = i / 3 * Math.PI * 2 + k * Math.PI / 3 - Math.PI / 2; if (i === 0) x.moveTo(c + Math.cos(ang2) * 150, c + Math.sin(ang2) * 150); else x.lineTo(c + Math.cos(ang2) * 150, c + Math.sin(ang2) * 150); }
      x.stroke();
    }
    var g = x.createRadialGradient(c, c, 0, c, c, 90); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.globalAlpha = 1; x.fillStyle = g; x.fillRect(0, 0, 512, 512);
    runeTexC = new THREE.CanvasTexture(cv); runeTexC.__baShared = true;
    return runeTexC;
  }
  /* lingkaran rajah di tanah: muncul membesar, berputar, berdenyut, lalu memudar */
  FX.prototype.runeCircle = function (x, z, size, c0, c1, life, spin, y) {
    var tex = runeTex();
    var mk = function (sc, col, op) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(col), transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      m.rotation.x = -Math.PI / 2; m.scale.setScalar(sc); m.renderOrder = 6; return m;
    };
    var grp = new THREE.Group(); grp.position.set(x, y || 0.05, z);
    var a = mk(size, c1, 0.9), b = mk(size * 0.72, c0, 0.8); b.position.y = 0.01;
    grp.add(a); grp.add(b);
    var e = { group: grp, life: life || 1.2 };
    e.update = function (dt, t) {
      var k = t / e.life, appear = U.easeOut(Math.min(1, t / 0.22)), fade = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      a.rotation.z += dt * (spin || 1.2); b.rotation.z -= dt * (spin || 1.2) * 1.7;
      var pulse = 1 + Math.sin(t * 14) * 0.03;
      a.scale.setScalar(size * appear * pulse); b.scale.setScalar(size * 0.72 * appear / pulse);
      a.material.opacity = 0.9 * fade; b.material.opacity = 0.8 * fade;
    };
    e.update(0, 0);
    return this.spawn(e);
  };
  /* pilar cahaya tegak (silinder terbuka berpendar) */
  FX.prototype.lightPillar = function (x, z, r, h, col, life, y) {
    var g = new THREE.CylinderGeometry(r, r * 1.15, h, 24, 1, true); g.translate(0, h / 2, 0);
    var cv = document.createElement('canvas'); cv.width = 4; cv.height = 64;
    var cx = cv.getContext('2d'), gr = cx.createLinearGradient(0, 64, 0, 0);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, '#999'); gr.addColorStop(1, '#000');
    cx.fillStyle = gr; cx.fillRect(0, 0, 4, 64);
    var tx = new THREE.CanvasTexture(cv);
    var m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tx, color: new THREE.Color(col), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    m.position.set(x, y || 0, z); m.renderOrder = 6;
    var e = { group: m, life: life || 1 };
    e.update = function (dt, t) {
      var k = t / e.life, a = k < 0.15 ? k / 0.15 : (1 - (k - 0.15) / 0.85);
      m.material.opacity = 0.26 * a * (0.85 + Math.sin(t * 30) * 0.15);
      m.scale.set(1 + k * 0.3, 0.6 + U.easeOut(Math.min(1, k * 3)) * 0.4, 1 + k * 0.3);
      m.rotation.y += dt * 2;
    };
    e.update(0, 0);
    return this.spawn(e);
  };
  /* ancang-ancang jurus: rajah di tanah, pilar cahaya, debu & bara tersedot ke bola, tanah retak */
  FX.prototype.chargeRitual = function (pos, c0, c1, dur, ult) {
    var fx = this, big = ult ? 1.3 : 1, pm = this.pm || 1;
    this.runeCircle(pos.x, pos.z, 4.2 * big, c0, c1, dur + 0.5, 1.6);
    this.lightPillar(pos.x, pos.z, 0.7 * big, 7 * big, c1, dur + 0.25);
    if (ult) this.lightPillar(pos.x, pos.z, 1.3, 11, c0, dur + 0.35);
    var e = { life: dur };
    e.update = function (dt, t) {
      var k = t / e.life, n = Math.round((2 + k * 4) * pm), i;
      for (i = 0; i < n; i++) {
        /* debu & serpih berpusar masuk ke arah bola */
        var a = Math.random() * U.TAU, r = 2.6 + Math.random() * 1.6;
        var px = pos.x + Math.cos(a) * r, pz = pos.z + Math.sin(a) * r;
        var tx = -Math.cos(a) * r * 2.2 - Math.sin(a) * 2.5, tz = -Math.sin(a) * r * 2.2 + Math.cos(a) * 2.5;
        fx.normPS.emit(px, 0.08 + Math.random() * 0.3, pz, tx, 0.6 + Math.random(), tz, 0.45, 0.12, 0.02, fx.dustCol || '#cdb48a', '#8a6f4d', 0.55, -0.4, 0.97);
      }
      for (i = 0; i < Math.round(3 * pm); i++) {
        /* bara naik menyusuri pilar */
        var a2 = Math.random() * U.TAU, r2 = 0.3 + Math.random() * 0.8 * big;
        fx.addPS.emit(pos.x + Math.cos(a2) * r2, 0.1, pos.z + Math.sin(a2) * r2, Math.cos(a2 + 1.5) * 1.2, 3 + Math.random() * 4 * big, Math.sin(a2 + 1.5) * 1.2, 0.7, 0.14, 0.03, c1, c0, 1, -1, 0.97);
      }
      if (Math.random() < dt * 8) fx.normPS.emit(pos.x + (Math.random() - 0.5) * 3, 0.1, pos.z + (Math.random() - 0.5) * 3, 0, 2 + Math.random() * 2, 0, 0.6, 0.12, 0.08, '#5b4b3c', '#3a3029', 1, 6, 0.99);
    };
    this.spawn(e);
  };
  /* saat api meledak dari kaki: gelombang kejut bertingkat, tanah retak, bongkahan terlempar, kilau sinar */
  FX.prototype.launchFx = function (from, to, c0, c1, ult) {
    var fx = this, dx = to.x - from.x, dz = to.z - from.z, l = Math.sqrt(dx * dx + dz * dz) || 1, big = ult ? 1.3 : 1, pm = this.pm || 1, i;
    dx /= l; dz /= l;
    for (i = 0; i < 3; i++) (function (k) {
      fx.later(0.06 * k, function () { airRing(fx, from.x + dx * (0.6 + k * 1.1), 0.75, from.z + dz * (0.6 + k * 1.1), dx, dz, (2.2 + k * 0.9) * big, 0.38, k ? c1 : '#ffffff', 0.7 - k * 0.15); });
    })(i);
    this.flip('crack', from.x, 0.07, from.z, { size: 5.5 * big, c0: c0, c1: '#fff2c0', flat: true, fps: 16 });
    this.flip('shock', from.x, 0.08, from.z, { size: 9 * big, c0: c1, c1: '#ffffff', flat: true, fps: 32, op: 0.8 });
    this.flip('bolt', from.x, 1.0, from.z, { size: 3.2 * big, c0: c1, c1: '#ffffff', fps: 34 });
    /* bongkahan tanah besar terlempar ke belakang & samping */
    for (i = 0; i < Math.round(14 * pm * big); i++) {
      var a = Math.random() * U.TAU, sp = 2 + Math.random() * 5;
      this.normPS.emit(from.x, 0.1, from.z, Math.cos(a) * sp - dx * 2, 3 + Math.random() * 5, Math.sin(a) * sp - dz * 2, 0.9 + Math.random() * 0.5, 0.16 + Math.random() * 0.14, 0.12, '#4a3b2e', '#2c241d', 1, 11, 0.99);
    }
    /* semburan bara memanjang searah tendangan */
    for (i = 0; i < Math.round(40 * pm * big); i++) {
      var s2 = 6 + Math.random() * 14, sd = (Math.random() - 0.5) * 4, up = (Math.random() - 0.3) * 4;
      this.addPS.emit(from.x, 0.5 + Math.random() * 0.6, from.z, dx * s2 - dz * sd, up, dz * s2 + dx * sd, 0.3 + Math.random() * 0.35, 0.22, 0.03, '#ffffff', c1, 1, 2, 0.93);
    }
    if (R3.quality > 0) this.flip('firewave', from.x + dx * 1.2, 0.9, from.z + dz * 1.2, { size: 6 * big, c0: c0, c1: c1, fps: 26, sy: 0.55, yaw: Math.atan2(dx, dz) });
  };
  /* jejak terbang wujud api: pita bara spiral, percik jatuh, kerak gosong di tanah. Dipanggil tiap frame tahap B */
  FX.prototype.flightTrail = function (hp, prev, c0, c1, t, big) {
    if (!prev) return;
    var pm = this.pm || 1, dx = hp.x - prev.x, dy = hp.y - prev.y, dz = hp.z - prev.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < 0.01 || d > 6) return;
    var n = Math.min(14, Math.ceil(d / 0.12) * pm), i;
    for (i = 0; i < n; i++) {
      var f = i / n, ang = (t + f * 0.016) * 26 + i * 0.4, rr = 0.55 * (big || 1);
      var px = prev.x + dx * f, py = prev.y + dy * f, pz = prev.z + dz * f;
      /* dua untai spiral berlawanan */
      this.addPS.emit(px, py + Math.sin(ang) * rr, pz + Math.cos(ang) * rr, 0, 0.3, 0, 0.32, 0.26, 0.04, c1, c0, 0.95, 0, 0.9);
      this.addPS.emit(px, py - Math.sin(ang) * rr, pz - Math.cos(ang) * rr, 0, 0.3, 0, 0.32, 0.2, 0.04, '#ffffff', c1, 0.75, 0, 0.9);
    }
    if (Math.random() < 0.5) this.addPS.emit(hp.x, hp.y, hp.z, (Math.random() - 0.5) * 2, -1, (Math.random() - 0.5) * 2, 0.6, 0.12, 0.02, c1, c0, 1, 9, 0.99);
    if (hp.y < 2.2 && Math.random() < 0.35) this.scorch(hp.x, hp.z, c1, 0.9, 5);
  };
  /* aura kiper saat merapal jurus: rajah di kakinya, pilar, bintik cahaya berputar mengelilingi tubuh */
  FX.prototype.keeperRitual = function (at, face, col, dur, special) {
    var fx = this, pm = this.pm || 1, c1 = '#ffffff', c0 = col || '#8fd3ff';
    var gx = at.x - face * 0.1;
    this.runeCircle(gx, at.z, special ? 4.6 : 3, c0, c1, dur + 0.4, -1.4);
    if (special) this.lightPillar(gx, at.z, 0.9, 6.5, c0, dur + 0.3);
    var e = { life: dur };
    e.update = function (dt, t) {
      var n = Math.round((special ? 4 : 2) * pm), i;
      for (i = 0; i < n; i++) {
        var a = t * 5 + i / n * U.TAU + Math.random() * 0.3, r = 0.9 + Math.sin(t * 7 + i) * 0.2, y = 0.2 + ((t * 1.6 + i * 0.37) % 1) * 2.3;
        fx.addPS.emit(gx + Math.cos(a) * r, y, at.z + Math.sin(a) * r, -Math.sin(a) * 2, 0.8, Math.cos(a) * 2, 0.35, 0.16, 0.03, c1, c0, 1, 0, 0.92);
      }
      /* angin dari kiper meniup debu ke luar */
      if (Math.random() < 0.6) { var a3 = Math.random() * U.TAU; fx.normPS.emit(gx + Math.cos(a3) * 0.5, 0.08, at.z + Math.sin(a3) * 0.5, Math.cos(a3) * 3, 0.3, Math.sin(a3) * 3, 0.5, 0.15, 0.6, fx.dustCol || '#cdb48a', '#9c805a', 0.35, -0.2, 0.94); }
    };
    this.spawn(e);
  };
  /* tiap frame saat adu tenaga: kilat bercabang, gelombang kejut berirama, serpih terangkat dari tanah */
  FX.prototype.clashTick = function (hp, kp, dir, c0, kc, k, dt) {
    var pm = this.pm || 1, i;
    this.clashAcc = (this.clashAcc || 0) + dt;
    if (this.clashAcc > 0.13) {
      this.clashAcc = 0;
      var mx = (hp.x + kp.x) / 2, my = (hp.y + kp.y) / 2, mz = (hp.z + kp.z) / 2;
      airRing(this, mx, my, mz, dir, 0, 1.6 + k * 2.2, 0.3, Math.random() < 0.5 ? c0 : kc, 0.55);
    }
    for (i = 0; i < Math.round(5 * pm); i++) {
      /* percik menyebar di bidang benturan */
      var a = Math.random() * U.TAU, sp = 4 + Math.random() * 7;
      this.addPS.emit(hp.x + dir * 0.3, hp.y, hp.z, (Math.random() - 0.5) * 2, Math.sin(a) * sp, Math.cos(a) * sp, 0.25, 0.14, 0.02, '#ffffff', Math.random() < 0.5 ? c0 : kc, 1, 4, 0.9);
    }
    if (Math.random() < 0.5 * pm) {
      /* kerikil & debu terangkat oleh tekanan tenaga */
      var gx = hp.x + (Math.random() - 0.5) * 3, gz = hp.z + (Math.random() - 0.5) * 3;
      this.normPS.emit(gx, 0.05, gz, 0, 1.5 + Math.random() * 2.5 * (0.5 + k), 0, 0.8, 0.07 + Math.random() * 0.06, 0.05, '#5b4b3c', '#3a3029', 1, -0.6, 0.99);
    }
  };
  /* jurus kiper ditembus: perisai pecah menjadi kepingan */
  FX.prototype.shieldShatter = function (at, face, col) {
    var pm = this.pm || 1, i, c0 = col || '#8fd3ff';
    this.flip('crack', at.x, at.y, at.z, { size: 4.6, c0: c0, c1: '#ffffff', fps: 24, yaw: face > 0 ? Math.PI / 2 : -Math.PI / 2 });
    for (i = 0; i < Math.round(36 * pm); i++) {
      var a = Math.random() * U.TAU, sp = 2 + Math.random() * 6;
      this.addPS.emit(at.x, at.y + (Math.random() - 0.5) * 1.2, at.z + (Math.random() - 0.5) * 1.6, face * (1 + Math.random() * 3) * -1 + Math.cos(a) * 1.5, Math.sin(a) * sp, Math.cos(a) * sp, 0.6 + Math.random() * 0.5, 0.22, 0.05, '#ffffff', c0, 1, 9.8, 0.97);
    }
    airRing(this, at.x, at.y, at.z, face, 0, 4.2, 0.45, c0, 0.7);
  };
  /* jurus kiper bertahan: riak perisai bertingkat + api padam jadi uap */
  FX.prototype.barrierRipple = function (at, face, col, fireCol) {
    var fx = this, pm = this.pm || 1, c0 = col || '#8fd3ff', i;
    for (i = 0; i < 4; i++) (function (k) {
      fx.later(0.09 * k, function () { airRing(fx, at.x - face * 0.05 * k, at.y, at.z, face, 0, 1.4 + k * 1.3, 0.45, k % 2 ? '#ffffff' : c0, 0.75 - k * 0.12); });
    })(i);
    for (i = 0; i < Math.round(26 * pm); i++) {
      var a = Math.random() * U.TAU;
      this.normPS.emit(at.x, at.y, at.z, face * (0.5 + Math.random() * 1.5), 1 + Math.random() * 2, Math.cos(a) * 1.8, 0.9 + Math.random() * 0.6, 0.25, 1.1, '#e8eef2', '#9aa4ab', 0.45, -0.6, 0.95);
    }
    for (i = 0; i < Math.round(18 * pm); i++) {
      var a2 = Math.random() * U.TAU, s2 = 3 + Math.random() * 5;
      this.addPS.emit(at.x, at.y, at.z, -face * (1 + Math.random() * 2), Math.sin(a2) * s2, Math.cos(a2) * s2, 0.4, 0.16, 0.02, fireCol || '#ffb347', '#ff4d1a', 1, 6, 0.93);
    }
  };

  /* ---------- penanda pemain yang dipegang manusia (sampai 8 kursi) ---------- */
  function glow(col, op) { return new THREE.MeshBasicMaterial({ color: new THREE.Color(col), transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); }
  FX.prototype.seatMarker = function (k, p, on, col, arrow) {
    var list = this.seatMk || (this.seatMk = []);
    var m = list[k];
    if (!on || !p) { if (m) m.g.visible = false; return; }
    if (!m || m.col !== col || m.arrowOn !== !!arrow) {
      if (m) R3.dispose(m.g);
      var g = new THREE.Group();
      var r0 = arrow ? 0.5 : 0.44, r1 = arrow ? 0.62 : 0.52;
      var ring = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 36), glow(col, arrow ? 0.9 : 0.7));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
      var ring2 = null, arr = null;
      if (arrow) {
        ring2 = new THREE.Mesh(new THREE.RingGeometry(0.66, 0.7, 36), glow(col, 0.4));
        ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.05; g.add(ring2);
        arr = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(col) }));
        arr.rotation.x = Math.PI; arr.position.y = 2.35; g.add(arr);
      }
      this.scene.add(g);
      m = list[k] = { g: g, ring2: ring2, arr: arr, col: col, arrowOn: !!arrow };
    }
    m.g.visible = true;
    m.g.position.set(p.x, 0, p.z);
    if (m.arr) { m.arr.position.y = 2.35 + Math.sin(this.t * 6) * 0.08; m.arr.rotation.y += 0.05; }
    if (m.ring2) { m.ring2.scale.setScalar(1 + (this.t * 0.8 % 1) * 0.35); m.ring2.material.opacity = 0.45 * (1 - (this.t * 0.8 % 1)); }
  };
  /* ---------- lencana kondisi di atas kepala (tim sendiri): palang merah = cedera, tetes jingga = kehabisan tenaga ---------- */
  function badgeTex(kind) {
    var key = 'badge_' + kind;
    if (R3.tex[key]) return R3.tex[key];
    var t = R3.canvasTex(64, 64, function (x, w, h) {
      x.clearRect(0, 0, w, h);
      x.beginPath(); x.arc(w / 2, h / 2, 27, 0, Math.PI * 2); x.fillStyle = kind === 'inj' ? '#ffffff' : '#2a1608'; x.fill();
      x.lineWidth = 4; x.strokeStyle = kind === 'inj' ? '#e11d2e' : '#ff9f43'; x.stroke();
      if (kind === 'inj') { x.fillStyle = '#e11d2e'; x.fillRect(w / 2 - 6, 14, 12, 36); x.fillRect(14, h / 2 - 6, 36, 12); }
      else { x.fillStyle = '#ff9f43'; x.beginPath(); x.moveTo(w / 2, 12); x.bezierCurveTo(w / 2 + 20, 36, w / 2 + 14, 52, w / 2, 52); x.bezierCurveTo(w / 2 - 14, 52, w / 2 - 20, 36, w / 2, 12); x.fill(); }
    });
    t.__baShared = true; R3.tex[key] = t;
    return t;
  }
  FX.prototype.badges = function (players, my) {
    var pool = this.badgePool || (this.badgePool = []), n = 0;
    if (players) for (var i = 0; i < players.length && n < 6; i++) {
      var p = players[i];
      if (p.team !== my || p.hidden) continue;
      var kind = p.injured ? 'inj' : (p.energy < 22 ? 'low' : '');
      if (!kind) continue;
      var b = pool[n];
      if (!b) { b = pool[n] = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeTex(kind), transparent: true, depthWrite: false, depthTest: false })); b.renderOrder = 8; b._k = kind; this.scene.add(b); }
      if (b._k !== kind) { b.material.map = badgeTex(kind); b.material.needsUpdate = true; b._k = kind; }
      b.visible = true;
      b.position.set(p.x, 2.45 + Math.sin(this.t * 4 + i) * 0.05, p.z);
      b.scale.setScalar(kind === 'inj' ? 0.5 : 0.4);
      n++;
    }
    for (var j = n; j < pool.length; j++) pool[j].visible = false;
  };
  var baseDispose = FX.prototype.dispose;
  FX.prototype.dispose = function () {
    if (this.seatMk) this.seatMk.forEach(function (m) { if (m) R3.dispose(m.g); });
    if (this.badgePool) this.badgePool.forEach(function (b) { if (b.parent) b.parent.remove(b); b.material.dispose(); });
    this.seatMk = null; this.badgePool = null;
    baseDispose.call(this);
  };
})(typeof window !== 'undefined' ? window : globalThis);
