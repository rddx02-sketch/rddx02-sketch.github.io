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
