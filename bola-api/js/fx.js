/* Bola Api Arena — efek: bola api ber-shader, partikel (api, bara, asap), wujud tendangan api, jurus silat kiper */
(function (root) {
  'use strict';
  var BA = root.BA, U = BA.U, D = BA.D, R3 = BA.R3, F = D.FIELD;
  var THREE = root.THREE;

  /* ======================================================================
     SISTEM PARTIKEL (titik bertekstur, satu draw call)
     ====================================================================== */
  var PS = function (scene, max, additive) {
    this.max = max;
    var g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: R3.tex.soft }, uScale: { value: 400 } },
      vertexShader: 'attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float uScale;' +
        'void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = clamp(size * uScale / max(0.1, -mv.z), 0.0, 260.0); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform sampler2D map; varying vec3 vC; varying float vA; void main(){ vec4 t = texture2D(map, gl_PointCoord); float a = vA * t.a; if (a < 0.01) discard; gl_FragColor = vec4(vC, a); }',
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 5 : 4;
    scene.add(this.points);
    this.d = { vx: new Float32Array(max), vy: new Float32Array(max), vz: new Float32Array(max), life: new Float32Array(max), mx: new Float32Array(max),
      s0: new Float32Array(max), s1: new Float32Array(max), c0: new Float32Array(max * 3), c1: new Float32Array(max * 3), a0: new Float32Array(max), gr: new Float32Array(max), dr: new Float32Array(max) };
    this.i = 0;
    this.live = 0;
  };
  var tmpC = new THREE.Color(), tmpC2 = new THREE.Color();
  PS.prototype.emit = function (x, y, z, vx, vy, vz, life, s0, s1, c0, c1, a0, grav, drag) {
    var i = this.i; this.i = (this.i + 1) % this.max;
    var d = this.d;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    d.vx[i] = vx; d.vy[i] = vy; d.vz[i] = vz; d.life[i] = life; d.mx[i] = life;
    d.s0[i] = s0; d.s1[i] = s1;
    tmpC.set(c0); tmpC2.set(c1 || c0);
    d.c0[i * 3] = tmpC.r; d.c0[i * 3 + 1] = tmpC.g; d.c0[i * 3 + 2] = tmpC.b;
    d.c1[i * 3] = tmpC2.r; d.c1[i * 3 + 1] = tmpC2.g; d.c1[i * 3 + 2] = tmpC2.b;
    d.a0[i] = a0 == null ? 1 : a0; d.gr[i] = grav || 0; d.dr[i] = drag == null ? 1 : drag;
  };
  PS.prototype.update = function (dt, scale) {
    var d = this.d, n = this.max, live = 0;
    this.mat.uniforms.uScale.value = scale;
    for (var i = 0; i < n; i++) {
      if (d.life[i] <= 0) { if (this.alpha[i] !== 0) this.alpha[i] = 0; continue; }
      live++;
      d.life[i] -= dt;
      var k = 1 - Math.max(0, d.life[i]) / d.mx[i];
      d.vy[i] -= d.gr[i] * dt;
      var dr = Math.pow(d.dr[i], dt * 60);
      d.vx[i] *= dr; d.vy[i] *= dr; d.vz[i] *= dr;
      this.pos[i * 3] += d.vx[i] * dt; this.pos[i * 3 + 1] += d.vy[i] * dt; this.pos[i * 3 + 2] += d.vz[i] * dt;
      if (this.pos[i * 3 + 1] < 0.02 && d.vy[i] < 0) { this.pos[i * 3 + 1] = 0.02; d.vy[i] *= -0.25; d.vx[i] *= 0.6; d.vz[i] *= 0.6; }
      this.size[i] = d.s0[i] + (d.s1[i] - d.s0[i]) * k;
      this.alpha[i] = d.life[i] > 0 ? d.a0[i] * (1 - k * k) : 0;
      this.col[i * 3] = d.c0[i * 3] + (d.c1[i * 3] - d.c0[i * 3]) * k;
      this.col[i * 3 + 1] = d.c0[i * 3 + 1] + (d.c1[i * 3 + 1] - d.c0[i * 3 + 1]) * k;
      this.col[i * 3 + 2] = d.c0[i * 3 + 2] + (d.c1[i * 3 + 2] - d.c0[i * 3 + 2]) * k;
    }
    this.live = live;
    var a = this.geo.attributes;
    a.position.needsUpdate = true; a.color.needsUpdate = true; a.size.needsUpdate = true; a.alpha.needsUpdate = true;
  };
  PS.prototype.clear = function () { for (var i = 0; i < this.max; i++) { this.d.life[i] = 0; this.alpha[i] = 0; } };
  PS.prototype.dispose = function () { if (this.points.parent) this.points.parent.remove(this.points); this.geo.dispose(); this.mat.dispose(); };

  /* ======================================================================
     SHADER: API, ENERGI, BATU LAVA
     ====================================================================== */
  var NOISE = [
    'float hash3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }',
    'float vnoise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(mix(hash3(i), hash3(i + vec3(1.0,0.0,0.0)), f.x), mix(hash3(i + vec3(0.0,1.0,0.0)), hash3(i + vec3(1.0,1.0,0.0)), f.x), f.y),',
    '             mix(mix(hash3(i + vec3(0.0,0.0,1.0)), hash3(i + vec3(1.0,0.0,1.0)), f.x), mix(hash3(i + vec3(0.0,1.0,1.0)), hash3(i + vec3(1.0,1.0,1.0)), f.x), f.y), f.z); }',
    'float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < OCT; i++) { s += a * vnoise(p); p = p * 2.03 + vec3(1.7, 9.2, 4.1); a *= 0.5; } return s / (1.0 - pow(0.5, float(OCT))); }'
  ].join('\n');
  var VS = [
    'varying vec3 vP; varying vec3 vN; varying vec3 vV; varying vec2 vUv;',
    'void main(){',
    '  vec4 lp = vec4(position, 1.0); vec3 nn = normal;',
    '  #ifdef USE_INSTANCING',
    '    lp = instanceMatrix * lp; nn = (instanceMatrix * vec4(normal, 0.0)).xyz;',
    '  #endif',
    '  vP = lp.xyz; vUv = uv;',
    '  vN = normalize(normalMatrix * nn);',
    '  vec4 mv = modelViewMatrix * lp;',
    '  vV = normalize(-mv.xyz);',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');
  var FS_FIRE = [
    'uniform float uTime; uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform float uOp; uniform vec3 uFlow; uniform float uScale; uniform float uHeat; uniform float uRim;',
    'varying vec3 vP; varying vec3 vN; varying vec3 vV; varying vec2 vUv;',
    NOISE,
    'void main(){',
    '  float ndv = abs(dot(normalize(vN), normalize(vV)));',
    '  float fres = pow(1.0 - ndv, 2.0);',
    '  vec3 q = vP * uScale;',
    '  #if SWIRL == 1',
    '    float ang = atan(vP.y, vP.x);',
    '    q = vec3(ang * 1.6 + uTime * 6.0, vP.z * uScale * 0.8 - uTime * 3.0, length(vP.xy) * 2.0);',
    '    float spiral = sin(ang * 3.0 + vP.z * 3.2 - uTime * 14.0);',
    '  #else',
    '    q -= uFlow * uTime * 2.6;',
    '  #endif',
    '  float n = fbm(q);',
    '  float n2 = vnoise(q * 2.3 + vec3(0.0, uTime * 4.0, 0.0));',
    '  float heat = n * 1.15 + n2 * 0.22 - 0.3 + uHeat - fres * 0.5 * uRim;',
    '  #if SWIRL == 1',
    '    heat += spiral * 0.3;',
    '  #endif',
    '  #if TAIL == 1',
    '    heat -= pow(vUv.y, 0.8) * 1.05;',
    '  #endif',
    '  #if STRIPE == 1',
    '    float sp = smoothstep(0.55, 0.72, fract(vP.z * 1.7 + vP.y * 0.9 + n * 0.55));',
    '    heat -= sp * 0.38;',
    '  #endif',
    '  heat = clamp(heat, 0.0, 1.0);',
    '  vec3 col = mix(uC2, uC0, smoothstep(0.1, 0.42, heat));',
    '  col = mix(col, uC1, smoothstep(0.42, 0.76, heat));',
    '  col = mix(col, vec3(1.0, 0.97, 0.86), smoothstep(0.8, 1.0, heat));',
    '  #if ADD == 1',
    '    float a = smoothstep(0.16, 0.6, heat) * uOp;',
    '  #else',
    '    float lit = clamp(dot(normalize(vN), normalize(vec3(0.35, 0.65, 0.68))) * 0.5 + 0.5, 0.0, 1.0);',
    '    col *= 0.5 + lit * 0.62 + fres * 0.25 * uRim;',
    '    float a = clamp(smoothstep(-0.05, 0.22, heat) * (1.0 - fres * 0.45 * uRim) * uOp, 0.0, 1.0);',
    '  #endif',
    '  gl_FragColor = vec4(col, a);',
    '}'
  ].join('\n');
  var FS_ENERGY = [
    'uniform vec3 uCol; uniform float uTime; uniform float uOp; uniform float uStripe; uniform float uFres;',
    'varying vec3 vP; varying vec3 vN; varying vec3 vV; varying vec2 vUv;',
    NOISE,
    'void main(){',
    '  float ndv = abs(dot(normalize(vN), normalize(vV)));',
    '  float fres = pow(1.0 - ndv, 2.0);',
    '  float n = vnoise(vP * 3.0 + vec3(0.0, -uTime * 2.5, uTime));',
    '  float st = 0.5 + 0.5 * sin(vP.y * 9.0 - uTime * 7.0);',
    '  float a = 0.16 + fres * uFres + n * 0.32 + st * 0.22 * uStripe;',
    '  #if FADEV == 1',
    '    a *= smoothstep(1.0, 0.4, vUv.y) * smoothstep(0.0, 0.12, vUv.y);',
    '  #endif',
    '  vec3 col = mix(uCol, vec3(1.0), clamp(fres * 0.7 + n * 0.3 - 0.12, 0.0, 1.0));',
    '  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * uOp);',
    '}'
  ].join('\n');
  var FS_ROCK = [
    'uniform float uTime; uniform vec3 uC0; uniform vec3 uC1; uniform float uOp;',
    'varying vec3 vP; varying vec3 vN; varying vec3 vV; varying vec2 vUv;',
    NOISE,
    'void main(){',
    '  float n = fbm(vP * 2.1);',
    '  float crack = 1.0 - smoothstep(0.0, 0.065, abs(n - 0.5));',
    '  float n2 = vnoise(vP * 7.0 + uTime * 0.8);',
    '  vec3 rock = mix(vec3(0.08, 0.055, 0.045), vec3(0.24, 0.16, 0.11), n2);',
    '  float lit = clamp(dot(normalize(vN), normalize(vec3(0.35, 0.8, 0.5))) * 0.55 + 0.5, 0.0, 1.0);',
    '  vec3 glow = mix(uC0, uC1, n2) * (1.4 + 0.5 * sin(uTime * 7.0 + n * 12.0));',
    '  float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5);',
    '  vec3 col = rock * (0.35 + lit * 0.85) + glow * crack + uC0 * rim * 0.9;',
    '  gl_FragColor = vec4(col, uOp);',
    '}'
  ].join('\n');
  function oct() { return R3.quality === 0 ? 2 : (R3.quality === 1 ? 3 : 4); }
  /* api: o.add (aditif/menyala), o.tail (memudar ke ujung kerucut), o.swirl, o.stripe, o.side, o.op, o.scale, o.heat, o.rim */
  function fireMat(c0, c1, o) {
    o = o || {};
    var m = new THREE.ShaderMaterial({
      defines: { OCT: oct(), ADD: o.add ? 1 : 0, TAIL: o.tail ? 1 : 0, SWIRL: o.swirl ? 1 : 0, STRIPE: o.stripe ? 1 : 0 },
      uniforms: {
        uTime: { value: 0 }, uC0: { value: new THREE.Color(c0) }, uC1: { value: new THREE.Color(c1) }, uC2: { value: new THREE.Color(o.dark || U.mixHex(c0, '#1e0300', 0.78)) },
        uOp: { value: o.op == null ? 1 : o.op }, uFlow: { value: new THREE.Vector3(0, o.flowY == null ? 1 : o.flowY, o.flowZ || 0) }, uScale: { value: o.scale || 2.2 },
        uHeat: { value: o.heat == null ? 0.12 : o.heat }, uRim: { value: o.rim == null ? 1 : o.rim }
      },
      vertexShader: VS, fragmentShader: FS_FIRE,
      transparent: true, depthWrite: !o.add && !o.noDepth, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending,
      side: o.side ? THREE.DoubleSide : THREE.FrontSide
    });
    m.baseOp = m.uniforms.uOp.value;
    return m;
  }
  function energyMat(col, o) {
    o = o || {};
    var m = new THREE.ShaderMaterial({
      defines: { OCT: 2, FADEV: o.fadeV ? 1 : 0 },
      uniforms: { uCol: { value: new THREE.Color(col) }, uTime: { value: 0 }, uOp: { value: o.op == null ? 1 : o.op }, uStripe: { value: o.stripe == null ? 1 : o.stripe }, uFres: { value: o.fres == null ? 1.1 : o.fres } },
      vertexShader: VS, fragmentShader: FS_ENERGY,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: o.side === false ? THREE.FrontSide : THREE.DoubleSide
    });
    m.baseOp = m.uniforms.uOp.value;
    return m;
  }
  function rockMat(c0, c1) {
    var m = new THREE.ShaderMaterial({
      defines: { OCT: oct() },
      uniforms: { uTime: { value: 0 }, uC0: { value: new THREE.Color(c0) }, uC1: { value: new THREE.Color(c1) }, uOp: { value: 1 } },
      vertexShader: VS, fragmentShader: FS_ROCK, transparent: true
    });
    m.baseOp = 1;
    return m;
  }
  function glowMat(color, op) {
    return new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: op == null ? 0.85 : op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  }
  function basicMat(color, op) {
    var m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: op == null ? 1 : op });
    m.baseOp = m.opacity;
    return m;
  }
  function sprite(color, size, tex) {
    var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex || R3.tex.glow, color: new THREE.Color(color), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.setScalar(size);
    return s;
  }
  /* waktu & pudar semua bahan dalam satu efek */
  function tickMats(list, t) { for (var i = 0; i < list.length; i++) { var u = list[i].uniforms; if (u && u.uTime) u.uTime.value = t % 200; } }
  function fadeMats(list, k) {
    for (var i = 0; i < list.length; i++) {
      var m = list[i], b = m.baseOp == null ? 1 : m.baseOp;
      if (m.uniforms && m.uniforms.uOp) m.uniforms.uOp.value = b * k;
      else if (m.opacity != null) m.opacity = b * k;
      if (k < 0.95) m.depthWrite = false;
    }
  }

  /* geometri bersama (tidak dibuang per efek) */
  var GEO = null;
  function geo() {
    if (GEO) return GEO;
    GEO = {
      sph: new THREE.SphereGeometry(1, 22, 16), sphLo: new THREE.SphereGeometry(1, 12, 9), cone: new THREE.ConeGeometry(1, 1, 14, 1),
      tail: (function () { var g = new THREE.ConeGeometry(1, 1, 18, 8, true); g.translate(0, 0.5, 0); return g; })(),
      cyl: new THREE.CylinderGeometry(1, 1, 1, 14, 1), ring: new THREE.RingGeometry(0.82, 1, 48), disc: new THREE.CircleGeometry(1, 40),
      plane: new THREE.PlaneGeometry(1, 1), box: new THREE.BoxGeometry(1, 1, 1)
    };
    Object.keys(GEO).forEach(function (k) { GEO[k].__baShared = true; });
    return GEO;
  }

  /* ---------- tekstur bola per jenis ---------- */
  function ballTextures(kind) {
    var key = 'ball_' + kind;
    if (R3.tex[key]) return R3.tex[key];
    var rnd = U.rng(kind.length * 31 + 7);
    var W = 256, H = 128;
    var map = R3.canvasTex(W, H, function (x) {
      var i;
      if (kind === 'plastik') {
        x.fillStyle = '#e8e2d2'; x.fillRect(0, 0, W, H);
        for (i = 0; i < 6; i++) { x.fillStyle = i % 2 ? '#d62828' : '#1d4ed8'; x.fillRect(0, i * H / 6 + 4, W, H / 12); }
        x.globalAlpha = 0.25; x.fillStyle = '#000'; for (i = 0; i < 40; i++) x.fillRect(rnd() * W, rnd() * H, 6, 1); x.globalAlpha = 1;
      } else if (kind === 'takraw') {
        x.fillStyle = '#3a2412'; x.fillRect(0, 0, W, H);
        x.lineWidth = 7; x.strokeStyle = '#c99a58';
        for (i = -10; i < 20; i++) { x.beginPath(); x.moveTo(i * 22, 0); x.lineTo(i * 22 + 64, H); x.stroke(); x.beginPath(); x.moveTo(i * 22 + 64, 0); x.lineTo(i * 22, H); x.stroke(); }
        x.lineWidth = 2; x.strokeStyle = '#8a6232';
        for (i = -10; i < 20; i++) { x.beginPath(); x.moveTo(i * 22 + 2, 0); x.lineTo(i * 22 + 66, H); x.stroke(); }
      } else if (kind === 'kulit') {
        x.fillStyle = '#7a4a26'; x.fillRect(0, 0, W, H);
        for (i = 0; i < 8; i++) for (var j = 0; j < 4; j++) {
          x.fillStyle = (i + j) % 2 ? '#8a5530' : '#6a3c1e'; x.fillRect(i * 32 + 2, j * 32 + 2, 28, 28);
          x.strokeStyle = '#e8d2a8'; x.setLineDash([3, 3]); x.lineWidth = 1.5; x.strokeRect(i * 32 + 4, j * 32 + 4, 24, 24); x.setLineDash([]);
        }
      } else {
        // sabut kelapa direndam minyak: serat coklat gelap
        x.fillStyle = '#2a170c'; x.fillRect(0, 0, W, H);
        for (i = 0; i < 900; i++) {
          var px = rnd() * W, py = rnd() * H, l = 6 + rnd() * 18, a = (rnd() - 0.5) * 0.9 + Math.PI / 2;
          x.strokeStyle = ['#4a2a14', '#5e3a1c', '#1a0d06', '#6e4622'][Math.floor(rnd() * 4)];
          x.lineWidth = 0.6 + rnd() * 1.4; x.globalAlpha = 0.5 + rnd() * 0.5;
          x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
        }
        x.globalAlpha = 1;
      }
    });
    var emi = R3.canvasTex(W, H, function (x) {
      x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
      var n = kind === 'plastik' ? 6 : (kind === 'kulit' ? 14 : 34);
      for (var i = 0; i < n; i++) {
        var px = rnd() * W, py = rnd() * H;
        var g = x.createRadialGradient(px, py, 0, px, py, 6 + rnd() * 14);
        g.addColorStop(0, 'rgba(255,240,200,0.95)'); g.addColorStop(0.4, 'rgba(255,150,60,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.fillRect(px - 22, py - 22, 44, 44);
      }
      x.strokeStyle = 'rgba(255,190,110,0.85)'; x.lineWidth = 1.4;
      for (i = 0; i < n * 0.6; i++) { var cx = rnd() * W, cy = rnd() * H; x.beginPath(); x.moveTo(cx, cy); for (var k = 0; k < 4; k++) { cx += (rnd() - 0.5) * 22; cy += (rnd() - 0.5) * 14; x.lineTo(cx, cy); } x.stroke(); }
    });
    map.__baShared = true; emi.__baShared = true;
    R3.tex[key] = { map: map, emi: emi };
    return R3.tex[key];
  }
  function ballKind(bd) { var id = bd && bd.id; return id === 'plastik' || id === 'takraw' || id === 'kulit' ? id : 'kelapa'; }

  /* ---------- pita jejak (menghadap kamera) ---------- */
  var Ribbon = function (scene, n, width, c0, c1) {
    this.n = n; this.w = width; this.pts = []; this.op = 1;
    var g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 6); this.col = new Float32Array(n * 6);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    var idx = [];
    for (var i = 0; i < n - 1; i++) { var a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    this.geo = g;
    this.mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 6;
    this.c0 = new THREE.Color(c0); this.c1 = new THREE.Color(c1);
    scene.add(this.mesh);
  };
  var rA = new THREE.Vector3(), rB = new THREE.Vector3(), rC = new THREE.Vector3();
  Ribbon.prototype.push = function (x, y, z) {
    var p = this.pts[0];
    if (p && (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y) + (p.z - z) * (p.z - z) < 0.0025) { p.set(x, y, z); return; }
    this.pts.unshift(new THREE.Vector3(x, y, z));
    if (this.pts.length > this.n) this.pts.length = this.n;
  };
  Ribbon.prototype.update = function () {
    var cam = R3.camera, pts = this.pts, n = pts.length, N = this.n;
    for (var i = 0; i < N; i++) {
      var j = i * 6;
      if (i >= n || n < 2) { var q = pts[n - 1] || rA.set(0, -50, 0); this.pos[j] = this.pos[j + 3] = q.x; this.pos[j + 1] = this.pos[j + 4] = q.y; this.pos[j + 2] = this.pos[j + 5] = q.z; for (var c = 0; c < 6; c++) this.col[j + c] = 0; continue; }
      var p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      rA.subVectors(a, b); rB.subVectors(cam.position, p);
      rC.crossVectors(rA, rB); var l = rC.length() || 1;
      var k = i / (N - 1), w = this.w * Math.pow(1 - k, 0.7);
      rC.multiplyScalar(w / l);
      this.pos[j] = p.x + rC.x; this.pos[j + 1] = p.y + rC.y; this.pos[j + 2] = p.z + rC.z;
      this.pos[j + 3] = p.x - rC.x; this.pos[j + 4] = p.y - rC.y; this.pos[j + 5] = p.z - rC.z;
      var f = (1 - k) * (1 - k) * this.op * 0.6;
      var r = (this.c1.r + (this.c0.r - this.c1.r) * k) * f, g = (this.c1.g + (this.c0.g - this.c1.g) * k) * f, bb = (this.c1.b + (this.c0.b - this.c1.b) * k) * f;
      this.col[j] = this.col[j + 3] = r; this.col[j + 1] = this.col[j + 4] = g; this.col[j + 2] = this.col[j + 5] = bb;
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true;
  };
  Ribbon.prototype.dispose = function () { if (this.mesh.parent) this.mesh.parent.remove(this.mesh); this.geo.dispose(); this.mat.dispose(); };

  /* ======================================================================
     PENGELOLA EFEK
     ====================================================================== */
  var FX = BA.FX = function (scene, ballDef) {
    this.scene = scene;
    var pm = R3.parts();
    this.pm = pm;
    this.addPS = new PS(scene, Math.round(2200 * pm) + 260, true);
    this.normPS = new PS(scene, Math.round(1100 * pm) + 160, false);
    this.list = [];
    this.ribbons = [];
    var G = geo();
    this.fireMats = [];
    // bola
    var bg = new THREE.Group();
    this.ballGroup = bg;
    this.ballMesh = new THREE.Mesh(G.sph, new THREE.MeshLambertMaterial({ color: 0xffffff }));
    this.ballMesh.scale.setScalar(0.17);
    this.ballMesh.castShadow = true;
    bg.add(this.ballMesh);
    this.shell = new THREE.Mesh(G.sph, null); this.shell.scale.setScalar(0.25); bg.add(this.shell);
    this.tail = new THREE.Mesh(G.tail, null); bg.add(this.tail);
    this.ballGlow = sprite('#ff6a1a', 1.5); this.ballGlow.material.opacity = 0.55; bg.add(this.ballGlow);
    this.ballCore = sprite('#ffd27a', 0.55); bg.add(this.ballCore);
    scene.add(bg);
    this.ballShadow = new THREE.Mesh(R3.geo.circle, BA.Chars.shadowMat());
    this.ballShadow.rotation.x = -Math.PI / 2; this.ballShadow.scale.set(0.25, 0.25, 1); scene.add(this.ballShadow);
    this.groundGlow = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: R3.tex.glow, color: 0xff6a1a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.groundGlow.rotation.x = -Math.PI / 2; this.groundGlow.position.y = 0.03; scene.add(this.groundGlow);
    // cahaya api (tetap di adegan supaya shader tidak dikompilasi ulang)
    this.lights = R3.quality > 0;
    if (this.lights) {
      this.ballLight = new THREE.PointLight(0xff7a2a, 0, 7, 2); scene.add(this.ballLight);
      this.cineLight = new THREE.PointLight(0xff7a2a, 0, 14, 2); scene.add(this.cineLight);
    }
    this.setBallDef(ballDef || D.BALLS[0]);
    // cincin bola panas
    this.heatRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 32), glowMat('#ff3b1f', 0));
    this.heatRing.rotation.x = -Math.PI / 2; this.heatRing.position.y = 0.04; scene.add(this.heatRing);
    // penanda pemain aktif
    this.markers = [0, 1].map(function (k) {
      var g = new THREE.Group();
      var col = k === 0 ? '#ffd23f' : '#4cc9f0';
      var ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 36), glowMat(col, 0.9));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
      var ring2 = new THREE.Mesh(new THREE.RingGeometry(0.66, 0.7, 36), glowMat(col, 0.4));
      ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.05; g.add(ring2);
      var arr = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(col) }));
      arr.rotation.x = Math.PI; arr.position.y = 2.35; g.add(arr);
      g.visible = false; scene.add(g);
      return { g: g, ring: ring, ring2: ring2, arr: arr };
    });
    this.t = 0;
    this.prevBall = null;
    this.vel = new THREE.Vector3();
  };
  FX.prototype.setBallDef = function (bd) {
    this.ballDef = bd;
    this.fire = (bd && bd.fire) || ['#ff4d1a', '#ffcc33'];
    var tx = ballTextures(ballKind(bd));
    var bm = this.ballMesh.material;
    bm.map = tx.map; bm.emissiveMap = tx.emi; bm.emissive = new THREE.Color(this.fire[0]); bm.emissiveIntensity = 1.2; bm.needsUpdate = true;
    if (this.shellMat) this.shellMat.dispose();
    if (this.tailMat) this.tailMat.dispose();
    this.shellMat = fireMat(this.fire[0], this.fire[1], { add: true, scale: 5.5, heat: 0.45, op: 0.95 });
    this.tailMat = fireMat(this.fire[0], this.fire[1], { add: true, tail: true, scale: 3.2, heat: 0.62, op: 0.9 });
    this.shell.material = this.shellMat; this.tail.material = this.tailMat;
    this.ballGlow.material.color.set(this.fire[0]); this.ballCore.material.color.set(this.fire[1]);
    this.groundGlow.material.color.set(this.fire[0]);
    if (this.ballLight) this.ballLight.color.set(this.fire[0]);
  };

  FX.prototype.scaleFactor = function () {
    var cam = R3.camera;
    var pr = R3.renderer ? R3.renderer.getPixelRatio() : 1;
    return (R3.h || 600) * pr / (2 * Math.tan(cam.fov * Math.PI / 360));
  };

  /* ---------- bola api: posisi, nyala, partikel ---------- */
  var UP = new THREE.Vector3(0, 1, 0), tmpV = new THREE.Vector3();
  FX.prototype.updateBall = function (dt, b, opts) {
    opts = opts || {};
    var g = this.ballGroup;
    var x = U.num(b.x, 0), y = U.num(b.y, 0.13), z = U.num(b.z, 0);
    var hide = !!opts.hide;
    g.visible = !hide;
    this.ballShadow.visible = !hide && !R3.shadows;
    this.groundGlow.visible = !hide;
    g.position.set(x, y + 0.04, z);
    var vx = 0, vy = 0, vz = 0;
    if (this.prevBall && dt > 0) {
      vx = (x - this.prevBall.x) / dt; vy = (y - this.prevBall.y) / dt; vz = (z - this.prevBall.z) / dt;
      if (Math.abs(vx) > 60 || Math.abs(vz) > 60 || Math.abs(vy) > 60) { vx = vy = vz = 0; }
    }
    this.prevBall = { x: x, y: y, z: z };
    // halus: kecepatan untuk arah ekor api
    var k = dt > 0 ? 1 - Math.exp(-10 * dt) : 1;
    this.vel.x += (vx - this.vel.x) * k; this.vel.y += (vy - this.vel.y) * k; this.vel.z += (vz - this.vel.z) * k;
    var v = this.vel, sp = Math.sqrt(v.x * v.x + v.z * v.z + v.y * v.y * 0.3);
    if (sp > 0.05) { this.ballMesh.rotation.x += vz * dt / 0.17; this.ballMesh.rotation.z -= vx * dt / 0.17; }
    this.ballShadow.position.set(x, 0.025, z);
    var petir = !!opts.petir, big = opts.big || 1;
    var c0 = petir ? '#7fb2ff' : this.fire[0], c1 = petir ? '#ffffff' : this.fire[1];
    this.ballGlow.material.color.set(c0); this.ballCore.material.color.set(c1);
    this.shellMat.uniforms.uC0.value.set(c0); this.shellMat.uniforms.uC1.value.set(c1);
    this.tailMat.uniforms.uC0.value.set(c0); this.tailMat.uniforms.uC1.value.set(c1);
    this.ballMesh.material.emissive.set(c0);
    this.ballMesh.material.emissiveIntensity = 0.9 + Math.sin(this.t * 13) * 0.25 + Math.sin(this.t * 31) * 0.12;
    var pulse = 1 + Math.sin(this.t * 22) * 0.07;
    this.ballGlow.scale.setScalar((1.25 + Math.min(1, sp / 15) * 0.5) * pulse * big);
    this.ballCore.scale.setScalar(0.5 * big * pulse);
    // cangkang api & ekor: api naik saat diam, mengekor ke belakang saat melaju
    this.shell.scale.setScalar(0.25 * big * (1 + Math.sin(this.t * 17) * 0.04));
    tmpV.set(-v.x * 0.11, 1.15 + Math.max(0, -v.y) * 0.05, -v.z * 0.11);
    var tl = tmpV.length();
    tmpV.multiplyScalar(1 / (tl || 1));
    this.tail.quaternion.setFromUnitVectors(UP, tmpV);
    var len = (0.42 + Math.min(1.9, sp * 0.085)) * big;
    this.tail.scale.set(0.19 * big, len * (1 + Math.sin(this.t * 19) * 0.08), 0.19 * big);
    this.shellMat.uniforms.uFlow.value.set(-v.x * 0.06, 1, -v.z * 0.06);
    tickMats([this.shellMat, this.tailMat], this.t);
    // cahaya & pendar tanah
    var hh = U.clamp(1 - y / 3, 0, 1);
    this.groundGlow.position.set(x, 0.03, z);
    this.groundGlow.scale.setScalar((1.5 + Math.sin(this.t * 15) * 0.1) * big);
    this.groundGlow.material.opacity = 0.42 * hh;
    if (this.ballLight) {
      // jangan ubah .visible lampu: jumlah lampu berubah = semua shader dikompilasi ulang
      this.ballLight.position.set(x, y + 0.35, z);
      this.ballLight.color.set(c0);
      this.ballLight.intensity = hide ? 0 : (1.25 + Math.sin(this.t * 21) * 0.2 + Math.sin(this.t * 9.3) * 0.15) * big;
    }
    if (hide) return;
    // lidah api
    var n = (1.1 + Math.min(3, sp / 5)) * this.pm * big * dt * 60;
    while (n > 0) {
      if (n < 1 && Math.random() > n) break;
      n -= 1;
      var r = 0.12;
      this.addPS.emit(x + (Math.random() - 0.5) * r, y + (Math.random() - 0.3) * r, z + (Math.random() - 0.5) * r,
        -v.x * 0.18 + (Math.random() - 0.5) * 0.6, 1.3 + Math.random() * 1.6, -v.z * 0.18 + (Math.random() - 0.5) * 0.6,
        0.3 + Math.random() * 0.3, 0.5, 0.05, c1, c0, 0.85, -1.5, 0.96);
    }
    // bara terpercik
    if (Math.random() < (0.12 + sp * 0.035) * this.pm * dt * 60) {
      this.addPS.emit(x, y, z, (Math.random() - 0.5) * 3 - v.x * 0.15, 1 + Math.random() * 2.5, (Math.random() - 0.5) * 3 - v.z * 0.15,
        0.6 + Math.random() * 0.6, 0.09, 0.04, '#fff3c0', c0, 1, 5, 0.985);
    }
    // asap tipis saat melesat
    if (R3.quality > 0 && sp > 9 && Math.random() < 0.35 * this.pm) {
      this.normPS.emit(x - v.x * 0.03, y + 0.1, z - v.z * 0.03, (Math.random() - 0.5) * 0.6, 0.6 + Math.random() * 0.6, (Math.random() - 0.5) * 0.6,
        0.9 + Math.random() * 0.6, 0.3, 1.3, '#5a4a44', '#2a2422', 0.22, -0.2, 0.97);
    }
    if (petir && Math.random() < 0.4) {
      this.addPS.emit(x, y, z, (Math.random() - 0.5) * 9, (Math.random()) * 6, (Math.random() - 0.5) * 9, 0.15, 0.18, 0.02, '#ffffff', '#7fb2ff', 1, 0, 0.9);
    }
    // cincin bola panas
    var heat = opts.heat || 0;
    this.heatRing.visible = heat > 0.01;
    if (heat > 0.01 && opts.owner) {
      this.heatRing.position.x = opts.owner.x; this.heatRing.position.z = opts.owner.z;
      this.heatRing.material.opacity = heat * (0.55 + Math.sin(this.t * (8 + heat * 20)) * 0.35);
      this.heatRing.scale.setScalar(1 + heat * 0.4);
    }
  };

  FX.prototype.setMarker = function (k, p, on) {
    var m = this.markers[k];
    if (!m) return;
    m.g.visible = !!on && !!p;
    if (!m.g.visible) return;
    m.g.position.set(p.x, 0, p.z);
    m.arr.position.y = 2.35 + Math.sin(this.t * 6) * 0.08;
    m.arr.rotation.y += 0.05;
    m.ring2.scale.setScalar(1 + (this.t * 0.8 % 1) * 0.35);
    m.ring2.material.opacity = 0.45 * (1 - (this.t * 0.8 % 1));
  };

  /* ---------- ledakan & semburan ---------- */
  FX.prototype.burst = function (x, y, z, kind, o) {
    o = o || {};
    var pm = this.pm, i, n, c0 = o.c0 || this.fire[0], c1 = o.c1 || this.fire[1];
    if (kind === 'fire') {
      n = Math.round((o.n || 40) * pm);
      for (i = 0; i < n; i++) { var a = Math.random() * U.TAU, e = Math.random() * Math.PI - Math.PI / 2, s = (o.s || 6) * (0.4 + Math.random()); this.addPS.emit(x, y, z, Math.cos(a) * Math.cos(e) * s, Math.abs(Math.sin(e)) * s + 1, Math.sin(a) * Math.cos(e) * s, 0.4 + Math.random() * 0.5, (o.size || 0.9), 0.1, c1, c0, 1, 2, 0.93); }
      for (i = 0; i < n * 0.4; i++) { var a1 = Math.random() * U.TAU, s1 = (o.s || 6) * (0.6 + Math.random() * 0.8); this.addPS.emit(x, y, z, Math.cos(a1) * s1, Math.random() * s1 * 0.7 + 1.5, Math.sin(a1) * s1, 0.7 + Math.random() * 0.7, 0.1, 0.04, '#fff6d0', c0, 1, 7, 0.97); }
    } else if (kind === 'spark') {
      n = Math.round((o.n || 30) * pm);
      for (i = 0; i < n; i++) { var a2 = Math.random() * U.TAU, s2 = (o.s || 9) * (0.3 + Math.random()); this.addPS.emit(x, y, z, Math.cos(a2) * s2, Math.random() * s2 * 0.8, Math.sin(a2) * s2, 0.25 + Math.random() * 0.35, 0.22, 0.02, '#ffffff', c0, 1, 9, 0.95); }
    } else if (kind === 'smoke') {
      n = Math.round((o.n || 20) * pm);
      for (i = 0; i < n; i++) this.normPS.emit(x + (Math.random() - 0.5) * 0.6, y + Math.random() * 0.4, z + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 1.6, 0.8 + Math.random() * 1.4, (Math.random() - 0.5) * 1.6, 0.8 + Math.random() * 0.7, 0.6, 1.8, o.col || '#d9d9d9', o.col2 || '#8a8a8a', 0.55, -0.3, 0.97);
    } else if (kind === 'steam') {
      n = Math.round((o.n || 30) * pm);
      for (i = 0; i < n; i++) this.normPS.emit(x + (Math.random() - 0.5) * 0.8, y + (Math.random() - 0.5) * 0.6, z + (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 2.4, 1 + Math.random() * 2.2, (Math.random() - 0.5) * 2.4, 1 + Math.random() * 0.9, 0.5, 2.4, '#f4f7fa', '#b8c2cc', 0.5, -0.6, 0.96);
    } else if (kind === 'dust') {
      n = Math.round((o.n || 14) * pm);
      for (i = 0; i < n; i++) { var a3 = Math.random() * U.TAU; this.normPS.emit(x, 0.15, z, Math.cos(a3) * 2.5, 0.4 + Math.random() * 0.8, Math.sin(a3) * 2.5, 0.6 + Math.random() * 0.5, 0.5, 1.4, o.col || '#c9a978', o.col2 || '#9c805a', 0.5, 0.4, 0.94); }
    } else if (kind === 'debris') {
      n = Math.round((o.n || 24) * pm);
      for (i = 0; i < n; i++) { var a6 = Math.random() * U.TAU, s6 = 2 + Math.random() * 5; this.normPS.emit(x + (Math.random() - 0.5), y, z + (Math.random() - 0.5), Math.cos(a6) * s6 * 0.6, 3 + Math.random() * 5, Math.sin(a6) * s6 * 0.6, 0.8 + Math.random() * 0.6, 0.22, 0.16, o.col || '#6e5440', o.col2 || '#3e2e22', 1, 14, 0.99); }
    } else if (kind === 'confetti') {
      n = Math.round((o.n || 90) * pm);
      var cols = o.cols || ['#ffd23f', '#ff6b35', '#ffffff', '#3ec1d3', '#ff3d6e'];
      for (i = 0; i < n; i++) { var a4 = Math.random() * U.TAU, s4 = 3 + Math.random() * 7; this.normPS.emit(x, y, z, Math.cos(a4) * s4, 4 + Math.random() * 7, Math.sin(a4) * s4, 1.6 + Math.random() * 1.2, 0.2, 0.18, cols[i % cols.length], cols[(i + 1) % cols.length], 1, 6, 0.96); }
    } else if (kind === 'water') {
      n = Math.round((o.n || 40) * pm);
      for (i = 0; i < n; i++) { var a5 = Math.random() * U.TAU, s5 = 3 + Math.random() * 5; this.normPS.emit(x, y, z, Math.cos(a5) * s5, Math.random() * 5, Math.sin(a5) * s5, 0.6 + Math.random() * 0.4, 0.22, 0.08, '#bfe9ff', '#4cc9f0', 0.9, 9, 0.97); }
    } else if (kind === 'glow') {
      n = Math.round((o.n || 20) * pm);
      for (i = 0; i < n; i++) { var a7 = Math.random() * U.TAU, r7 = Math.random() * (o.r || 1); this.addPS.emit(x + Math.cos(a7) * r7, y + (Math.random() - 0.5) * (o.h || 0.5), z + Math.sin(a7) * r7, (Math.random() - 0.5) * 0.6, 0.8 + Math.random() * 1.6, (Math.random() - 0.5) * 0.6, 0.6 + Math.random() * 0.7, o.size || 0.25, 0.02, '#ffffff', c0, 0.9, -0.4, 0.97); }
    }
  };

  FX.prototype.update = function (dt) {
    this.t += dt;
    var sc = this.scaleFactor();
    for (var i = this.list.length - 1; i >= 0; i--) {
      var e = this.list[i];
      e.t += dt;
      if (e.update) e.update(dt, e.t);
      if (e.mats) tickMats(e.mats, e.t);
      if (e.ribbons) for (var r = 0; r < e.ribbons.length; r++) e.ribbons[r].update();
      if (e.dead || (e.life && e.t > e.life)) { this.kill(e); this.list.splice(i, 1); }
    }
    if (this.cineLight && !this.cineLightOwner) this.cineLight.intensity = Math.max(0, this.cineLight.intensity - dt * 8);
    this.addPS.update(dt, sc);
    this.normPS.update(dt, sc);
  };
  FX.prototype.kill = function (e) {
    if (e.group) R3.dispose(e.group);
    if (e.mats) e.mats.forEach(function (m) { if (m.dispose) m.dispose(); });
    if (e.ribbons) e.ribbons.forEach(function (r) { r.dispose(); });
    if (this.cineLightOwner === e) this.cineLightOwner = null;
    e.dead = true;
  };
  FX.prototype.clearEffects = function () { var self = this; this.list.forEach(function (e) { self.kill(e); }); this.list = []; };
  FX.prototype.spawn = function (e) { e.t = 0; if (e.group) this.scene.add(e.group); this.list.push(e); return e; };

  /* kompilasi shader efek di awal laga supaya adegan pertama tidak tersendat */
  FX.prototype.prewarm = function () {
    if (!R3.renderer || this.warm) return;
    var GG = geo(), self = this, list = [], g = new THREE.Group();
    var c0 = this.fire[0], c1 = this.fire[1];
    var add = function (mat, inst, geom) { list.push(mat); var m = inst ? new THREE.InstancedMesh(geom || GG.sphLo, mat, 1) : new THREE.Mesh(geom || GG.sphLo, mat); if (inst) m.setMatrixAt(0, new THREE.Matrix4()); m.frustumCulled = false; m.scale.setScalar(0.001); g.add(m); };
    [{}, { stripe: true }, { add: true }, { add: true, tail: true }, { add: true, swirl: true, side: true }, { swirl: true, side: true, noDepth: true }, { side: true, rim: 0 }, { add: true, side: true, rim: 0 }]
      .forEach(function (o) { add(fireMat(c0, c1, o)); });
    add(fireMat(c0, c1, {}), true); add(fireMat(c0, c1, { add: true }), true);
    add(energyMat('#ffffff', {})); add(energyMat('#ffffff', { fadeV: true }));
    add(rockMat(c0, c1));
    add(glowMat('#ffffff', 0.5)); add(basicMat('#ffffff', 1));
    g.position.set(0, -50, 0);
    this.scene.add(g);
    try { R3.renderer.compile(this.scene, R3.camera); } catch (e) { /* abaikan */ }
    g.visible = false;
    this.warm = { g: g, mats: list };
    void self;
  };

  FX.prototype.dispose = function () {
    if (this.warm) { R3.dispose(this.warm.g); this.warm.mats.forEach(function (m) { m.dispose(); }); this.warm = null; }
    this.clearEffects();
    this.addPS.dispose(); this.normPS.dispose();
    R3.dispose(this.ballGroup); R3.dispose(this.heatRing); R3.dispose(this.ballShadow); R3.dispose(this.groundGlow);
    if (this.shellMat) this.shellMat.dispose();
    if (this.tailMat) this.tailMat.dispose();
    if (this.ballMesh.material) this.ballMesh.material.dispose();
    if (this.ballLight && this.ballLight.parent) this.ballLight.parent.remove(this.ballLight);
    if (this.cineLight && this.cineLight.parent) this.cineLight.parent.remove(this.cineLight);
    this.markers.forEach(function (m) { R3.dispose(m.g); });
  };

  /* ======================================================================
     PEMBENTUK GEOMETRI
     ====================================================================== */
  function wingGeo(span, flip, feathers) {
    var sh = new THREE.Shape();
    var s = flip ? -1 : 1, nf = feathers || 7;
    sh.moveTo(0, 0.12);
    sh.bezierCurveTo(s * span * 0.3, span * 0.42, s * span * 0.7, span * 0.42, s * span, span * 0.2);
    for (var i = 0; i < nf; i++) {
      var t0 = i / nf, t1 = (i + 1) / nf;
      var x0 = s * span * (1 - t0 * 0.92), x1 = s * span * (1 - t1 * 0.92);
      var yb = span * 0.2 * (1 - t0) - 0.05;
      var tipY = yb - (0.55 + Math.sin(t0 * Math.PI) * 0.35) * span * 0.3;
      sh.quadraticCurveTo(x0 - s * 0.05, tipY + 0.1, (x0 + x1) / 2, tipY);
      sh.quadraticCurveTo(x1 + s * 0.02, tipY + 0.15, x1, span * 0.2 * (1 - t1) - 0.05);
    }
    sh.lineTo(0, -0.12);
    return new THREE.ShapeGeometry(sh, 6);
  }
  function featherGeo(len, w) {
    var sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.quadraticCurveTo(w, len * 0.4, 0, len);
    sh.quadraticCurveTo(-w, len * 0.4, 0, 0);
    return new THREE.ShapeGeometry(sh, 5);
  }
  function kerisGeo(len) {
    var sh = new THREE.Shape();
    var luk = 7, pts = 40, i;
    var wAt = function (t) { return 0.13 * (1 - t * 0.82) + (t > 0.92 ? -(t - 0.92) * 1.1 : 0); };
    var wave = function (t) { return Math.sin(t * luk * Math.PI) * 0.06 * (1 - t * 0.7); };
    sh.moveTo(0, -0.15);
    for (i = 0; i <= pts; i++) { var t = i / pts; sh.lineTo(t * len, wave(t) - Math.max(0.005, wAt(t))); }
    sh.lineTo(len * 1.06, wave(1));
    for (i = pts; i >= 0; i--) { var t2 = i / pts; sh.lineTo(t2 * len, wave(t2) + Math.max(0.005, wAt(t2))); }
    sh.lineTo(0, 0.15);
    var g = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1 });
    g.translate(0, 0, -0.02);
    return g;
  }
  function rockGeo(r, seed) {
    var g = new THREE.IcosahedronGeometry(r, 1);
    var p = g.attributes.position, rnd = U.rng(seed || 7), v = new THREE.Vector3();
    // geser titik yang sama secara konsisten (geometri non-indeks)
    var map = {};
    for (var i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      var key = Math.round(v.x * 100) + ',' + Math.round(v.y * 100) + ',' + Math.round(v.z * 100);
      var f = map[key] || (map[key] = 0.78 + rnd() * 0.42);
      v.multiplyScalar(f); p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }
  function handGroup(mat, scale) {
    var g = new THREE.Group(), G = geo();
    g.add(R3.mesh(G.sph, mat, 0, 0, 0, 0.48, 0.55, 0.16));
    for (var i = 0; i < 4; i++) {
      var f = R3.mesh(G.sph, mat, -0.33 + i * 0.22, 0.72 + (i === 1 || i === 2 ? 0.08 : 0), 0, 0.095, 0.36 + (i === 1 || i === 2 ? 0.05 : 0), 0.09);
      f.rotation.z = (i - 1.5) * -0.08; g.add(f);
    }
    var th = R3.mesh(G.sph, mat, 0.55, 0.05, 0, 0.1, 0.3, 0.09); th.rotation.z = -0.8; g.add(th);
    g.scale.setScalar(scale || 1);
    return g;
  }
  /* rajah lingkaran silat di tanah */
  function runeTex() {
    if (R3.tex.rune) return R3.tex.rune;
    var t = R3.canvasTex(512, 512, function (x, w, h) {
      x.clearRect(0, 0, w, h);
      x.translate(w / 2, h / 2);
      x.strokeStyle = '#ffffff'; x.fillStyle = '#ffffff';
      [246, 232, 170, 150, 92].forEach(function (r, i) { x.lineWidth = i === 0 ? 7 : (i === 1 ? 2 : 3); x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.stroke(); });
      for (var i = 0; i < 48; i++) { var a = i / 48 * Math.PI * 2; x.lineWidth = i % 4 === 0 ? 4 : 2; x.beginPath(); x.moveTo(Math.cos(a) * 170, Math.sin(a) * 170); x.lineTo(Math.cos(a) * (i % 4 === 0 ? 228 : 205), Math.sin(a) * (i % 4 === 0 ? 228 : 205)); x.stroke(); }
      // motif kawung: empat daun mengelilingi pusat, diulang delapan kali
      for (i = 0; i < 8; i++) {
        x.save(); x.rotate(i / 8 * Math.PI * 2); x.translate(0, -121);
        for (var k = 0; k < 4; k++) { x.save(); x.rotate(k * Math.PI / 2); x.beginPath(); x.ellipse(0, -13, 7, 13, 0, 0, Math.PI * 2); x.lineWidth = 2.5; x.stroke(); x.restore(); }
        x.restore();
      }
      // bintang delapan sudut di tengah
      x.lineWidth = 3; x.beginPath();
      for (i = 0; i <= 16; i++) { var a2 = i / 16 * Math.PI * 2, r2 = i % 2 ? 40 : 86; x.lineTo(Math.cos(a2) * r2, Math.sin(a2) * r2); }
      x.stroke();
      x.beginPath(); x.arc(0, 0, 20, 0, Math.PI * 2); x.fill();
    });
    t.__baShared = true;
    R3.tex.rune = t;
    return t;
  }
  function crackTex() {
    if (R3.tex.crack) return R3.tex.crack;
    var rnd = U.rng(99);
    var t = R3.canvasTex(512, 512, function (x, w, h) {
      x.clearRect(0, 0, w, h);
      x.translate(w / 2, h / 2);
      x.strokeStyle = '#ffffff'; x.lineCap = 'round';
      for (var i = 0; i < 14; i++) {
        var a = i / 14 * Math.PI * 2 + rnd() * 0.3, r = 10, px = 0, py = 0;
        x.lineWidth = 6; x.beginPath(); x.moveTo(0, 0);
        while (r < 240) { r += 18 + rnd() * 26; a += (rnd() - 0.5) * 0.45; px = Math.cos(a) * r; py = Math.sin(a) * r; x.lineTo(px, py); x.lineWidth = Math.max(1.5, 6 - r / 50); }
        x.stroke();
        if (rnd() < 0.6) { x.lineWidth = 2; x.beginPath(); x.moveTo(px * 0.5, py * 0.5); x.lineTo(px * 0.5 + (rnd() - 0.5) * 80, py * 0.5 + (rnd() - 0.5) * 80); x.stroke(); }
      }
    });
    t.__baShared = true;
    R3.tex.crack = t;
    return t;
  }
  function stripeTex() {
    if (R3.tex.stripe) return R3.tex.stripe;
    var t = R3.canvasTex(64, 256, function (x, w, h) {
      x.clearRect(0, 0, w, h);
      for (var i = 0; i < 26; i++) { var px = Math.random() * w, ww = 1 + Math.random() * 3, a = 0.3 + Math.random() * 0.7; x.fillStyle = 'rgba(255,255,255,' + a + ')'; x.fillRect(px, 0, ww, h); }
    }, { repeat: [1, 1] });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.__baShared = true;
    R3.tex.stripe = t;
    return t;
  }

  /* ======================================================================
     WUJUD TENDANGAN API
     opts: from{x,y,z}, to{x,y,z}, ult, life ; mengembalikan efek dengan setP(p, dt, t), headPos(), fade(k)
     ====================================================================== */
  FX.prototype.shotShape = function (type, opts) {
    var self = this, def = D.shotById[type] || D.SHOTS[0], fire = def.fire;
    var c0 = fire[0], c1 = fire[1];
    var ult = !!opts.ult, sc = ult ? 1.45 : 1;
    var G = new THREE.Group(), GG = geo();
    var from = opts.from, to = opts.to;
    var dir = new THREE.Vector3(to.x - from.x, 0, to.z - from.z).normalize();
    var side = new THREE.Vector3(-dir.z, 0, dir.x);
    var e = { group: G, life: opts.life || 3.5, p: 0, type: type, mats: [], ribbons: [] };
    var mats = e.mats;
    function M(o) { var m = fireMat(c0, c1, o); mats.push(m); return m; }
    function BM(c, op) { var m = basicMat(c, op); mats.push(m); return m; }
    var MB = M({ scale: 2.6, heat: 0.1, stripe: type === 'macan' });      // tubuh api padat
    var MS = M({ add: true, scale: 2.0, heat: 0.05, op: 0.3 });           // pendar luar
    var MD = BM(U.mixHex(c0, '#1a0200', 0.82), 1);  // bayangan/mulut
    var MW = BM('#fff6d8', 1);                        // mata/taring
    var MH = BM(type === 'banteng' ? '#fff0d0' : '#ffe8b0', 1); // tanduk/paruh
    var MX = M({ add: true, scale: 1.4, heat: 0.4, op: 0.85 });           // aksen menyala
    var core = sprite(c1, 0.8 * sc); core.material.opacity = 0.6; G.add(core);
    var halo = sprite(c0, 2.4 * sc); halo.material.opacity = 0.2; G.add(halo);
    var wc = null;
    if (ult) { wc = sprite('#ffffff', 1.5); G.add(wc); }
    var body = new THREE.Group(); G.add(body);
    var parts = {};
    /* bagian tubuh + kembaran pendar */
    function part(parent, g, mat, x, y, z, sx, sy, sz, rx, ry, rz, shell) {
      var o = R3.mesh(g, mat, x, y, z, sx, sy, sz);
      if (rx) o.rotation.x = rx; if (ry) o.rotation.y = ry; if (rz) o.rotation.z = rz;
      parent.add(o);
      if (shell !== false && mat === MB) {
        var s = R3.mesh(g, MS, x, y, z, sx * 1.16, (sy == null ? sx : sy) * 1.16, (sz == null ? sx : sz) * 1.16);
        s.rotation.copy(o.rotation); parent.add(s);
      }
      return o;
    }
    function path(p) {
      var x = U.lerp(from.x, to.x, p), y = U.lerp(from.y, to.y, p), z = U.lerp(from.z, to.z, p);
      var lat = 0;
      switch (type) {
        case 'naga': lat = Math.sin(p * Math.PI * 3) * 1.4 * (1 - p); y += Math.sin(p * Math.PI) * 1.3; break;
        case 'macan': y += Math.sin(p * Math.PI) * 2.0; break;
        case 'garuda': y += Math.sin(p * Math.PI) * 3.2; break;
        case 'banteng': y = U.lerp(0.75, to.y, p * p); break;
        case 'keris': break;
        case 'meteor': var up = p < 0.45 ? U.easeOut(p / 0.45) : 1 - U.easeIn((p - 0.45) / 0.55); y = U.lerp(from.y, to.y, p) + up * 11; break;
        case 'beliung': lat = Math.sin(p * Math.PI * 4) * 0.9 * (1 - p); y += Math.sin(p * Math.PI) * 0.8; break;
        case 'tinju': y += Math.sin(p * Math.PI) * 0.6; break;
      }
      return { x: x + side.x * lat, y: Math.max(0.35, y), z: z + side.z * lat };
    }
    e.pos = path;

    if (type === 'naga') {
      // badan ular naga: segmen bola (instanced) mengikuti jejak kepala, sirip punggung, kepala bertanduk
      var NS = R3.quality === 0 ? 20 : 30;
      // bahan terpisah untuk mesh instans (program shader berbeda)
      var MBi = M({ scale: 2.6, heat: 0.1 }), MSi = M({ add: true, scale: 2.0, heat: 0.05, op: 0.3 }), MXi = M({ add: true, scale: 1.4, heat: 0.4, op: 0.85 });
      var segB = new THREE.InstancedMesh(GG.sph, MBi, NS), segS = new THREE.InstancedMesh(GG.sphLo, MSi, NS);
      var spk = new THREE.InstancedMesh(GG.cone, MXi, NS);
      [segB, segS, spk].forEach(function (im) { im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); G.add(im); });
      parts.segB = segB; parts.segS = segS; parts.spk = spk; parts.NS = NS;
      parts.hist = []; parts.histStep = 0.17;
      var hd = new THREE.Group();
      part(hd, GG.sph, MB, 0, 0.06, 0, 0.5, 0.42, 0.62);
      part(hd, GG.sph, MB, 0, -0.02, 0.58, 0.32, 0.22, 0.5);
      var jaw = new THREE.Group(); jaw.position.set(0, -0.14, 0.12); hd.add(jaw);
      part(jaw, GG.sph, MB, 0, -0.04, 0.4, 0.27, 0.09, 0.48);
      part(jaw, GG.sph, MD, 0, 0.03, 0.42, 0.22, 0.05, 0.4, 0, 0, 0, false);
      for (var tq = 0; tq < 4; tq++) [-1, 1].forEach(function (k) {
        part(hd, GG.cone, MW, k * 0.16, -0.12, 0.56 + tq * 0.1, 0.025, 0.09, 0.025, Math.PI, 0, 0, false);
        part(jaw, GG.cone, MW, k * 0.15, 0.02, 0.44 + tq * 0.1, 0.022, 0.08, 0.022, 0, 0, 0, false);
      });
      [-1, 1].forEach(function (k) {
        part(hd, GG.sph, MW, k * 0.25, 0.2, 0.42, 0.09, 0.065, 0.07, 0, 0, 0, false);
        part(hd, GG.sph, MD, k * 0.27, 0.2, 0.47, 0.02, 0.055, 0.02, 0, 0, 0, false);
        part(hd, GG.cone, MB, k * 0.24, 0.3, 0.33, 0.08, 0.22, 0.06, -0.9, 0, k * -0.3);
        var horn = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.055, 6, 14, Math.PI * 0.62), MH);
        horn.position.set(k * 0.18, 0.32, -0.12); horn.rotation.set(0, k > 0 ? Math.PI / 2 + 0.25 : Math.PI / 2 - 0.25, Math.PI * 0.55); hd.add(horn);
        part(hd, GG.sph, MD, k * 0.08, 0.06, 1.05, 0.035, 0.025, 0.02, 0, 0, 0, false);
        for (var mn = 0; mn < 4; mn++) part(hd, GG.cone, MX, k * (0.18 + mn * 0.04), 0.1 + mn * 0.06, -0.3 - mn * 0.14, 0.06, 0.42, 0.05, -1.9, 0, k * 0.5, false);
      });
      parts.jaw = jaw;
      hd.scale.setScalar(sc * 1.4);
      body.add(hd); parts.head = hd;
      // kumis naga
      e.ribbons.push(new Ribbon(G, 14, 0.035 * sc, c0, '#fff2c0'), new Ribbon(G, 14, 0.035 * sc, c0, '#fff2c0'));
      parts.whisk = true;
    } else if (type === 'macan') {
      var bd = new THREE.Group();
      part(bd, GG.sph, MB, 0, 0, -0.85, 0.55, 0.48, 1.1);
      part(bd, GG.sph, MB, 0, 0.05, -0.12, 0.6, 0.58, 0.62);
      part(bd, GG.sph, MB, 0, 0.3, 0.45, 0.5, 0.46, 0.48);
      part(bd, GG.sph, MB, 0, 0.12, 0.86, 0.3, 0.22, 0.28);
      part(bd, GG.sph, MD, 0, 0.2, 1.1, 0.07, 0.05, 0.04, 0, 0, 0, false);
      part(bd, GG.sph, MD, 0, -0.04, 0.84, 0.22, 0.1, 0.24, 0.3, 0, 0, false);
      [-1, 1].forEach(function (k) {
        part(bd, GG.cone, MB, k * 0.32, 0.72, 0.36, 0.15, 0.26, 0.1);
        part(bd, GG.sph, BM('#d8ff7a'), k * 0.2, 0.42, 0.86, 0.085, 0.055, 0.04, 0, 0, 0, false);
        part(bd, GG.cone, MW, k * 0.12, 0.0, 1.0, 0.035, 0.18, 0.035, Math.PI, 0, 0, false);
        part(bd, GG.cone, MW, k * 0.11, -0.13, 0.97, 0.03, 0.14, 0.03, 0, 0, 0, false);
        var leg = new THREE.Group(); leg.position.set(k * 0.36, -0.2, 0.2); bd.add(leg);
        part(leg, GG.sph, MB, 0, -0.3, 0.2, 0.15, 0.42, 0.15, 0.9);
        part(leg, GG.sph, MB, 0, -0.55, 0.62, 0.16, 0.12, 0.2);
        for (var cl = -1; cl <= 1; cl++) part(leg, GG.cone, MW, cl * 0.07, -0.58, 0.82, 0.025, 0.16, 0.025, Math.PI / 2, 0, 0, false);
        var hl = new THREE.Group(); hl.position.set(k * 0.36, -0.2, -1.45); bd.add(hl);
        part(hl, GG.sph, MB, 0, -0.15, -0.3, 0.17, 0.42, 0.17, -1.0);
        parts['leg' + k] = leg; parts['hl' + k] = hl;
      });
      parts.tail = [];
      for (var ti = 0; ti < 7; ti++) { var ts = part(bd, GG.sphLo, MB, 0, 0.3 + ti * 0.12, -1.95 - ti * 0.2, 0.09 - ti * 0.007, 0.09 - ti * 0.007, 0.14); parts.tail.push(ts); }
      parts.claws = [];
      for (var c = 0; c < 3; c++) {
        var clw = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.06, 4, 24, 1.5), MX);
        clw.position.set(-0.32 + c * 0.32, 0.2, 1.0); clw.rotation.set(0, Math.PI / 2, 2.2); clw.visible = false;
        bd.add(clw); parts.claws.push(clw);
      }
      bd.scale.setScalar(sc * 1.25);
      body.add(bd); parts.head = bd;
    } else if (type === 'garuda') {
      var gb = new THREE.Group();
      var MBw = M({ scale: 2.2, heat: 0.04, side: true, rim: 0 });
      var MSw = M({ add: true, scale: 1.8, heat: 0.1, side: true, op: 0.35, rim: 0 });
      var wl = new THREE.Group(), wr = new THREE.Group();
      [[wl, false], [wr, true]].forEach(function (wp) {
        var w1 = new THREE.Mesh(wingGeo(2.7, wp[1], 8), MBw), w2 = new THREE.Mesh(wingGeo(3.0, wp[1], 8), MSw), w3 = new THREE.Mesh(wingGeo(1.9, wp[1], 6), MX);
        [w1, w2, w3].forEach(function (w) { w.rotation.x = -Math.PI / 2; });
        w2.position.y = -0.03; w3.position.y = 0.03;
        wp[0].add(w2); wp[0].add(w1); wp[0].add(w3); gb.add(wp[0]);
      });
      part(gb, GG.sph, MB, 0, 0, -0.1, 0.34, 0.3, 0.82);
      part(gb, GG.sph, MB, 0, 0.16, 0.62, 0.25, 0.25, 0.28);
      var beakM = BM('#ffd25a');
      part(gb, GG.cone, beakM, 0, 0.12, 0.95, 0.075, 0.32, 0.075, Math.PI / 2, 0, 0, false);
      part(gb, GG.cone, beakM, 0, 0.04, 1.08, 0.03, 0.12, 0.03, Math.PI * 0.9, 0, 0, false);
      [-1, 1].forEach(function (k) {
        part(gb, GG.sph, MW, k * 0.13, 0.23, 0.78, 0.045, 0.04, 0.035, 0, 0, 0, false);
        part(gb, GG.sph, MD, k * 0.14, 0.23, 0.81, 0.02, 0.025, 0.015, 0, 0, 0, false);
      });
      for (var cr = 0; cr < 3; cr++) part(gb, GG.cone, MX, (cr - 1) * 0.08, 0.38, 0.48 - cr * 0.06, 0.05, 0.42, 0.05, -1.1 - cr * 0.15, 0, (cr - 1) * 0.3, false);
      for (var tf = 0; tf < 7; tf++) { var fth = new THREE.Mesh(featherGeo(1.3, 0.18), MBw); fth.rotation.set(-Math.PI / 2, 0, Math.PI + (tf - 3) * 0.2); fth.position.set((tf - 3) * 0.06, -0.02, -0.75); gb.add(fth); }
      gb.scale.setScalar(sc * 1.2);
      body.add(gb); parts.wl = wl; parts.wr = wr; parts.head = gb;
      e.ribbons.push(new Ribbon(G, 18, 0.12 * sc, c0, c1), new Ribbon(G, 18, 0.12 * sc, c0, c1));
      parts.wingTrail = true;
    } else if (type === 'banteng') {
      var bh = new THREE.Group();
      part(bh, GG.sph, MB, 0, 0, -0.8, 0.66, 0.6, 1.05);
      part(bh, GG.sph, MB, 0, 0.44, -0.35, 0.5, 0.42, 0.5);
      var hdb = new THREE.Group(); hdb.position.set(0, 0.0, 0.25); hdb.rotation.x = 0.35; bh.add(hdb);
      part(hdb, GG.sph, MB, 0, 0.05, 0.25, 0.42, 0.38, 0.5);
      part(hdb, GG.sph, MB, 0, -0.14, 0.66, 0.3, 0.24, 0.25);
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 14), BM('#ffe08a')); ring.position.set(0, -0.3, 0.86); hdb.add(ring);
      [-1, 1].forEach(function (k) {
        var hn = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.07, 6, 16, Math.PI * 0.72), MH);
        hn.position.set(k * 0.36, 0.34, 0.16); hn.rotation.set(0, k > 0 ? 0 : Math.PI, 0.45); hdb.add(hn);
        part(hdb, GG.sph, BM('#ff2a1a'), k * 0.25, 0.14, 0.62, 0.07, 0.05, 0.04, 0, 0, 0, false);
        part(hdb, GG.sph, MD, k * 0.1, -0.16, 0.9, 0.04, 0.035, 0.02, 0, 0, 0, false);
        [0.0, -1.4].forEach(function (zz, li) {
          var lg = new THREE.Group(); lg.position.set(k * 0.36, -0.35, zz); bh.add(lg);
          part(lg, GG.sph, MB, 0, -0.3, 0, 0.16, 0.42, 0.18);
          part(lg, GG.box, MD, 0, -0.72, 0.02, 0.2, 0.12, 0.24, 0, 0, 0, false);
          parts['leg' + k + li] = lg;
        });
      });
      parts.hdb = hdb;
      bh.scale.setScalar(sc * 1.25);
      body.add(bh); parts.head = bh;
    } else if (type === 'keris') {
      var kg = new THREE.Group();
      var bladeG = kerisGeo(2.3);
      var steel = new THREE.MeshBasicMaterial({ color: 0x7c8088, transparent: true }); steel.baseOp = 1; mats.push(steel);
      var bl = new THREE.Mesh(bladeG, steel); bl.rotation.y = -Math.PI / 2; kg.add(bl);
      var edgeM = M({ add: true, scale: 3.2, heat: 0.22, op: 0.6, side: true });
      var edge = new THREE.Mesh(bladeG, edgeM); edge.rotation.y = -Math.PI / 2; edge.scale.set(1.06, 1.35, 2.2); kg.add(edge);
      var star = sprite('#ffffff', 0.9); star.position.set(0, 0, 2.45); star.material.opacity = 0.9; kg.add(star); parts.star = star;
      var pamor = M({ add: true, scale: 6, heat: 0.6, side: true });
      for (var pm2 = 0; pm2 < 7; pm2++) { var pl = R3.mesh(GG.box, pamor, 0, (pm2 % 2 ? 0.025 : -0.025), 0.22 + pm2 * 0.3, 0.07, 0.022, 0.26); pl.rotation.x = pm2 % 2 ? 0.35 : -0.35; kg.add(pl); }
      var gold = BM('#ffd25a');
      var wood = BM('#5a3418');
      kg.add(R3.mesh(GG.box, gold, 0, 0.0, -0.04, 0.09, 0.46, 0.22));
      kg.add(R3.mesh(GG.cyl, gold, 0, 0, -0.18, 0.07, 0.1, 0.07)); kg.children[kg.children.length - 1].rotation.x = Math.PI / 2;
      var hilt = R3.mesh(GG.sph, wood, 0, 0.04, -0.48, 0.1, 0.13, 0.3); kg.add(hilt);
      kg.add(R3.mesh(GG.sph, gold, 0, 0.1, -0.76, 0.12, 0.14, 0.12));
      kg.scale.setScalar(sc * 1.55);
      body.add(kg); parts.head = kg; parts.spinZ = kg;
      e.ribbons.push(new Ribbon(G, 22, 0.16 * sc, c0, '#ffffff'));
      parts.tipTrail = true;
    } else if (type === 'meteor') {
      var mg = new THREE.Group();
      var rm = rockMat(c0, c1); mats.push(rm);
      var rock = new THREE.Mesh(rockGeo(0.85, 13), rm); mg.add(rock);
      var t1 = M({ add: true, tail: true, scale: 1.6, heat: 0.65, op: 0.95 }), t2 = M({ add: true, tail: true, scale: 2.4, heat: 0.8 });
      var tail1 = new THREE.Mesh(GG.tail, t1); tail1.rotation.x = -Math.PI / 2; tail1.scale.set(1.25, 6.5, 1.25); mg.add(tail1);
      var tail2 = new THREE.Mesh(GG.tail, t2); tail2.rotation.x = -Math.PI / 2; tail2.scale.set(0.8, 4.2, 0.8); mg.add(tail2);
      part(mg, GG.sph, MS, 0, 0, 0.1, 1.15, 1.15, 1.3, 0, 0, 0, false);
      mg.scale.setScalar(sc * 1.15);
      body.add(mg); parts.head = mg; parts.rock = rock; parts.tails = [tail1, tail2];
    } else if (type === 'beliung') {
      var fg = new THREE.CylinderGeometry(1.35, 0.12, 3.4, 28, 10, true); fg.rotateX(-Math.PI / 2); fg.translate(0, 0, -1.2);
      var fA = M({ add: true, swirl: true, scale: 1.4, heat: 0.35, side: true, op: 0.85, rim: 0.4 });
      var fB = M({ swirl: true, scale: 1.1, heat: 0.15, side: true, op: 0.55, rim: 0.2, noDepth: true });
      var funnel = new THREE.Mesh(fg, fA), funnel2 = new THREE.Mesh(fg, fB);
      funnel2.scale.set(0.72, 0.72, 0.95);
      body.add(funnel2); body.add(funnel);
      parts.funnel = funnel; parts.funnel2 = funnel2; parts.head = body;
      body.userData.fgeo = fg;
      parts.debris = true;
    } else if (type === 'tinju') {
      var fist = new THREE.Group();
      part(fist, GG.sph, MB, 0, 0, 0, 0.55, 0.5, 0.42);
      for (var f = 0; f < 4; f++) {
        part(fist, GG.sph, MB, -0.36 + f * 0.24, 0.16, 0.36, 0.13, 0.3, 0.16);
        part(fist, GG.sph, MB, -0.36 + f * 0.24, -0.1, 0.42, 0.12, 0.16, 0.14);
        part(fist, GG.sph, MX, -0.36 + f * 0.24, 0.3, 0.42, 0.1, 0.07, 0.1, 0, 0, 0, false);
      }
      part(fist, GG.sph, MB, 0.5, -0.18, 0.22, 0.14, 0.26, 0.14, 0.4, 0, 0.6);
      var armM = M({ add: true, tail: true, scale: 1.8, heat: 0.7, op: 0.95 });
      var arm = new THREE.Mesh(GG.tail, armM); arm.rotation.x = -Math.PI / 2; arm.position.z = -0.25; arm.scale.set(0.42, 2.6, 0.42); fist.add(arm);
      fist.scale.setScalar(sc * 1.25);
      body.add(fist); parts.head = fist;
      parts.rings = []; parts.nextRing = 0;
    }
    // jejak api utama di belakang wujud
    var trail = new Ribbon(G, 26, ({ keris: 0.3, naga: 0.22, macan: 0.35, banteng: 0.35, garuda: 0.3 }[type] || 0.6) * sc, c0, c1);
    e.ribbons.push(trail);
    var lastPos = path(0);
    var tq4 = new THREE.Quaternion(), tm4 = new THREE.Matrix4(), tv = new THREE.Vector3(), tv2 = new THREE.Vector3(), ts3 = new THREE.Vector3();
    var Z3 = new THREE.Vector3(0, 0, 1), qTilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.6);
    var light = self.cineLight;
    if (light) { self.cineLightOwner = e; light.color.set(c0); }
    e.setP = function (p, dt, t) {
      e.p = p;
      var pos = path(U.clamp(p, 0, 1));
      var nxt = path(U.clamp(p + 0.02, 0, 1));
      var grow = U.easeBack(U.clamp(p / 0.15, 0, 1));
      body.position.set(pos.x, pos.y, pos.z);
      body.lookAt(nxt.x, nxt.y, nxt.z);
      if (type !== 'beliung') body.scale.setScalar(Math.max(0.01, grow));
      else body.scale.setScalar(sc * 1.15 * Math.max(0.01, grow));
      core.position.set(pos.x, pos.y, pos.z); halo.position.copy(core.position);
      halo.scale.setScalar(2.4 * sc * (0.9 + Math.sin(t * 25) * 0.1) * Math.max(0.2, grow));
      if (wc) { wc.position.copy(core.position); wc.scale.setScalar(1.7 + Math.sin(t * 40) * 0.4); }
      if (light && self.cineLightOwner === e) { light.position.set(pos.x, pos.y + 0.6, pos.z); light.intensity = (ult ? 3.6 : 2.6) * Math.max(0.2, grow) * (0.9 + Math.sin(t * 23) * 0.1); }
      trail.push(pos.x, pos.y, pos.z);
      if (type === 'naga') {
        // jejak kepala dengan jarak tetap (tidak bergantung fps)
        var hist = parts.hist, step = parts.histStep;
        if (!hist.length) hist.unshift({ x: pos.x, y: pos.y, z: pos.z });
        var h0 = hist[0], dd = Math.sqrt((pos.x - h0.x) * (pos.x - h0.x) + (pos.y - h0.y) * (pos.y - h0.y) + (pos.z - h0.z) * (pos.z - h0.z));
        if (dd >= step) {
          var nAdd = Math.min(40, Math.floor(dd / step));
          for (var a = 1; a <= nAdd; a++) { var f2 = a * step / dd; hist.unshift({ x: h0.x + (pos.x - h0.x) * f2, y: h0.y + (pos.y - h0.y) * f2, z: h0.z + (pos.z - h0.z) * f2 }); }
        }
        if (hist.length > 140) hist.length = 140;
        var NS = parts.NS;
        for (var i = 0; i < NS; i++) {
          var hi = Math.min(hist.length - 1, 2 + i * 2), hb = hist[hi], hn2 = hist[Math.min(hist.length - 1, hi + 2)];
          var r = Math.max(0.14, (0.5 - i * 0.012)) * sc * Math.max(0.01, grow);
          var vis = hi < hist.length - 1 || i === 0;
          tv.set(hb.x, hb.y + Math.sin(t * 9 + i * 0.6) * 0.14, hb.z);
          tv2.set(hn2.x - hb.x, hn2.y - hb.y, hn2.z - hb.z);
          if (tv2.lengthSq() < 1e-6) tv2.set(-dir.x, 0, -dir.z);
          tv2.normalize().negate();
          tq4.setFromUnitVectors(Z3, tv2);
          ts3.set(r, r * 0.94, r * 1.5);
          if (!vis) ts3.set(0.0001, 0.0001, 0.0001);
          tm4.compose(tv, tq4, ts3); segB.setMatrixAt(i, tm4);
          ts3.multiplyScalar(1.22); tm4.compose(tv, tq4, ts3); segS.setMatrixAt(i, tm4);
          var sr = vis && i % 2 === 0 ? r * 0.9 : 0.0001;
          tv.y += r * 0.95;
          tq4.multiply(qTilt);
          ts3.set(sr * 0.35, sr * 1.0, sr * 0.3); tm4.compose(tv, tq4, ts3); spk.setMatrixAt(i, tm4);
        }
        segB.instanceMatrix.needsUpdate = true; segS.instanceMatrix.needsUpdate = true; spk.instanceMatrix.needsUpdate = true;
        if (parts.jaw) parts.jaw.rotation.x = 0.25 + Math.sin(t * 7) * 0.18;
        if (parts.whisk) {
          [-1, 1].forEach(function (k, wi) {
            tv.set(k * 0.3, -0.02, 0.9).multiplyScalar(sc * 1.4 * Math.max(0.01, grow)); tv.applyQuaternion(body.quaternion).add(body.position);
            tv.y += Math.sin(t * 12 + wi) * 0.05;
            e.ribbons[wi].push(tv.x, tv.y, tv.z);
          });
        }
      }
      if (type === 'macan') {
        if (parts.claws) parts.claws.forEach(function (cl, i) { cl.visible = p > 0.7; cl.rotation.z = 2.2 - (p - 0.7) * 6 - i * 0.1; });
        var pounce = Math.sin(t * 9);
        [-1, 1].forEach(function (k) { parts['leg' + k].rotation.x = -0.4 + pounce * 0.35; parts['hl' + k].rotation.x = 0.3 - pounce * 0.4; });
        parts.tail.forEach(function (s, i) { s.position.x = Math.sin(t * 8 - i * 0.6) * 0.08 * i; });
      }
      if (type === 'garuda') {
        var fl = Math.sin(t * 14) * 0.62;
        parts.wl.rotation.z = fl; parts.wr.rotation.z = -fl;
        if (parts.wingTrail) {
          [-1, 1].forEach(function (k, wi) {
            tv.set(k * 2.6, Math.sin(-k * fl) * 2.6 * 0.6, -0.2).multiplyScalar(sc * 1.2 * Math.max(0.01, grow));
            tv.applyQuaternion(body.quaternion).add(body.position);
            e.ribbons[wi].push(tv.x, tv.y, tv.z);
          });
        }
      }
      if (type === 'banteng') {
        body.position.y += Math.abs(Math.sin(t * 14)) * 0.22;
        [-1, 1].forEach(function (k) { [0, 1].forEach(function (li) { var lg = parts['leg' + k + li]; if (lg) lg.rotation.x = Math.sin(t * 14 + (li ? Math.PI : 0) + (k > 0 ? 0.5 : 0)) * 0.75; }); });
        if (Math.random() < 0.5) self.burst(pos.x, 0.1, pos.z, 'dust', { n: 3 });
        if (Math.random() < 0.3) { tv.set(0, -0.2, 1.2).multiplyScalar(sc * 1.25); tv.applyQuaternion(body.quaternion).add(body.position); self.normPS.emit(tv.x, tv.y, tv.z, (Math.random() - 0.5), 0.6, (Math.random() - 0.5), 0.6, 0.15, 0.5, '#fff4e6', '#b8b0a8', 0.5, -0.5, 0.96); }
      }
      if (parts.spinZ) parts.spinZ.rotation.z += dt * 9;
      if (parts.star) { parts.star.scale.setScalar(0.7 + Math.abs(Math.sin(t * 13)) * 0.6); parts.star.material.rotation = t * 3; }
      if (parts.tipTrail) { tv.set(0, 0, 2.5).multiplyScalar(sc * 1.55 * Math.max(0.01, grow)); tv.applyQuaternion(parts.spinZ.quaternion).applyQuaternion(body.quaternion).add(body.position); e.ribbons[0].push(tv.x, tv.y, tv.z); }
      if (parts.rock) { parts.rock.rotation.x += dt * 5; parts.rock.rotation.y += dt * 3; parts.tails.forEach(function (tl, i) { tl.scale.y = (i ? 4.2 : 6.5) * (0.92 + Math.sin(t * 17 + i) * 0.08); }); if (Math.random() < 0.6) self.normPS.emit(pos.x - dir.x * 1.5, pos.y + 0.5, pos.z - dir.z * 1.5, (Math.random() - 0.5), 0.8, (Math.random() - 0.5), 1.4, 0.8, 2.6, '#4a3c36', '#1e1816', 0.35, -0.3, 0.98); }
      if (parts.funnel) {
        parts.funnel.rotation.z += dt * 10; parts.funnel2.rotation.z -= dt * 7;
        if (Math.random() < 0.8) { var aa = Math.random() * U.TAU, rr = 0.6 + Math.random() * 1.2; self.addPS.emit(pos.x + Math.cos(aa) * rr * Math.abs(dir.z), pos.y + Math.sin(aa) * rr, pos.z + Math.cos(aa) * rr * Math.abs(dir.x), -Math.sin(aa) * 4 * Math.abs(dir.z), Math.cos(aa) * 4, -Math.sin(aa) * 4 * Math.abs(dir.x), 0.4, 0.14, 0.04, '#fff0c8', c0, 1, 0, 0.95); }
      }
      if (parts.rings) {
        parts.nextRing -= dt;
        if (parts.nextRing <= 0 && grow > 0.5) {
          parts.nextRing = 0.18;
          var rgm = glowMat(c1, 0.8); mats.push(rgm);
          var rg = new THREE.Mesh(GG.ring, rgm); rg.position.copy(body.position); rg.quaternion.copy(body.quaternion); rg.scale.setScalar(0.6 * sc); G.add(rg);
          parts.rings.push({ m: rg, t: 0 });
        }
        for (var ri = parts.rings.length - 1; ri >= 0; ri--) {
          var R = parts.rings[ri]; R.t += dt; R.m.scale.setScalar((0.6 + R.t * 6) * sc); R.m.material.opacity = Math.max(0, 0.8 - R.t * 2.2);
          if (R.t > 0.4) { G.remove(R.m); R.m.material.dispose(); var mi = mats.indexOf(R.m.material); if (mi >= 0) mats.splice(mi, 1); parts.rings.splice(ri, 1); }
        }
      }
      // percikan & bara di sekitar wujud
      var n = Math.round((ult ? 4 : 2) * self.pm * Math.max(1, dt * 60));
      for (var j = 0; j < n; j++) {
        var spd = 1.5;
        self.addPS.emit(pos.x + (Math.random() - 0.5) * 1.0 * sc, pos.y + (Math.random() - 0.5) * 0.9 * sc, pos.z + (Math.random() - 0.5) * 1.0 * sc,
          (Math.random() - 0.5) * spd, Math.random() * spd + 0.5, (Math.random() - 0.5) * spd, 0.3 + Math.random() * 0.35, (ult ? 0.75 : 0.55), 0.05, c0, U.mixHex(c0, '#200400', 0.7), 0.6, -1, 0.95);
      }
      if (Math.random() < 0.5 * self.pm) self.addPS.emit(pos.x, pos.y, pos.z, (Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 5, 0.7 + Math.random() * 0.5, 0.1, 0.04, '#fff6d0', c0, 1, 6, 0.98);
      lastPos = pos;
    };
    e.headPos = function () { return lastPos; };
    e.fade = function (k) {
      fadeMats(mats, k);
      core.material.opacity = 0.6 * k; halo.material.opacity = 0.2 * k; if (wc) wc.material.opacity = k;
      e.ribbons.forEach(function (r) { r.op = k; });
      if (light && self.cineLightOwner === e) light.intensity *= k;
    };
    e.setP(0, 0, 0);
    return this.spawn(e);
  };

  /* ======================================================================
     JURUS SILAT KIPER
     at: titik tangkap, face: arah hadap ke lapangan (x)
     ====================================================================== */
  FX.prototype.skillFx = function (skillId, at, face, opts) {
    opts = opts || {};
    var self = this, GG = geo();
    var sk = D.SKILLS[skillId];
    var col = sk ? sk.col : '#cfe8ff';
    var G = new THREE.Group();
    G.position.set(at.x, 0, at.z);
    G.rotation.y = face > 0 ? Math.PI / 2 : -Math.PI / 2; // +Z lokal menghadap lapangan
    var e = { group: G, life: opts.life || 2.6, t: 0, mats: [] };
    var mats = e.mats;
    function EM(o) { var m = energyMat(col, o); mats.push(m); return m; }
    function GM(c, op) { var m = glowMat(c, op); m.baseOp = op == null ? 0.85 : op; mats.push(m); return m; }
    var y = at.y;
    var fxk = sk ? sk.fx : 'normal';
    var parts = {};
    var special = !!sk;
    // ---- unsur bersama: rajah di tanah, tiang cahaya, kilau tangkap ----
    if (special) {
      var rm = new THREE.MeshBasicMaterial({ map: runeTex(), color: new THREE.Color(col), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
      rm.baseOp = 0.9; mats.push(rm);
      var rune = new THREE.Mesh(GG.plane, rm); rune.rotation.x = -Math.PI / 2; rune.position.set(0, 0.05, -0.2); rune.scale.setScalar(0.01); G.add(rune); parts.rune = rune;
      var pil = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 4.2, 28, 1, true), EM({ fadeV: true, stripe: 1.2, op: 0.28, fres: 0.9 }));
      pil.position.set(0, 2.1, -0.2); G.add(pil); parts.pil = pil;
    }
    var flash = sprite(col, 0.1); flash.position.set(0, y, 0.55); G.add(flash); parts.flash = flash;
    if (fxk === 'palm') {
      // telapak besi raksasa + gelombang dorong
      var pm = EM({ stripe: 0.4, fres: 1.4 });
      var h = handGroup(pm, 1.7); h.position.set(0, y - 0.35, 0.65); G.add(h); parts.h = h;
      var pm2 = EM({ stripe: 0, fres: 0.6, op: 0.45 });
      var h2 = handGroup(pm2, 2.3); h2.position.set(0, y - 0.45, 0.45); G.add(h2); parts.h2 = h2;
      parts.waves = [];
      for (var wv = 0; wv < 3; wv++) { var ring = new THREE.Mesh(GG.ring, GM('#ffffff', 0.6)); ring.position.set(0, y, 0.9 + wv * 0.1); ring.scale.setScalar(0.01); G.add(ring); parts.waves.push(ring); }
    } else if (fxk === 'claw') {
      parts.cl = [];
      for (var i = 0; i < 4; i++) {
        var c = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.06 + (i === 1 || i === 2 ? 0.02 : 0), 5, 30, 1.7), i % 2 ? GM('#ffffff', 0.85) : EM({ fres: 0.4, stripe: 0, op: 1 }));
        c.position.set(-0.55 + i * 0.36, y + 0.1, 0.75); c.rotation.set(0, 0, 0.8); G.add(c); parts.cl.push(c);
      }
    } else if (fxk === 'dome') {
      var tex = R3.canvasTex(256, 128, function (x, w, hh) {
        x.clearRect(0, 0, w, hh); x.strokeStyle = 'rgba(255,255,255,0.95)'; x.lineWidth = 2.5;
        for (var r = 0; r < 7; r++) for (var q = 0; q < 14; q++) { var cx = q * 19 + (r % 2) * 9.5, cy = r * 17; x.beginPath(); for (var k = 0; k < 6; k++) { var a = k / 6 * Math.PI * 2; x.lineTo(cx + Math.cos(a) * 9.5, cy + Math.sin(a) * 9.5); } x.closePath(); x.stroke(); }
      });
      var dm = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(col), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      dm.baseOp = 0.8; mats.push(dm);
      var dome = new THREE.Mesh(new THREE.SphereGeometry(2.9, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), dm);
      dome.rotation.x = Math.PI / 2; dome.position.set(0, 1.3, 0.35); G.add(dome); parts.dome = dome;
      var dome2 = new THREE.Mesh(new THREE.SphereGeometry(2.95, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), EM({ stripe: 0, fres: 1.6, op: 0.6 }));
      dome2.rotation.x = Math.PI / 2; dome2.position.set(0, 1.3, 0.35); G.add(dome2); parts.dome2 = dome2;
      var rip = new THREE.Mesh(GG.ring, GM('#ffffff', 0.9)); rip.position.set(0, y, 0.95 + 2.2); rip.scale.setScalar(0.01); G.add(rip); parts.rip = rip;
    } else if (fxk === 'wall') {
      parts.rocks = [];
      var rmat = new THREE.MeshLambertMaterial({ color: 0x8a6f58, transparent: true }); rmat.baseOp = 1; mats.push(rmat);
      for (var r2 = 0; r2 < 9; r2++) {
        var rk = new THREE.Mesh(rockGeo(0.62 + (r2 % 3) * 0.12, 30 + r2), rmat);
        rk.position.set(-2.6 + r2 * 0.65, -1.4, 0.9 + (r2 % 2) * 0.25); rk.scale.set(1, 1.6 + (r2 % 3) * 0.35, 0.85); rk.rotation.y = r2 * 1.3; G.add(rk); parts.rocks.push(rk);
      }
      var glowR = new THREE.Mesh(GG.plane, GM(col, 0.5)); glowR.position.set(0, 1.1, 0.6); glowR.scale.set(5.6, 2.4, 1); G.add(glowR); parts.glowR = glowR;
    } else if (fxk === 'water') {
      var wg = new THREE.PlaneGeometry(5.2, 3.4, 26, 12);
      var wm = new THREE.ShaderMaterial({
        defines: { OCT: 2 },
        uniforms: { uTime: { value: 0 }, uOp: { value: 0.85 } },
        vertexShader: VS,
        fragmentShader: ['uniform float uTime; uniform float uOp; varying vec3 vP; varying vec3 vN; varying vec3 vV; varying vec2 vUv;', NOISE,
          'void main(){ float n = vnoise(vec3(vUv.x * 6.0, vUv.y * 4.0 - uTime * 2.2, uTime * 0.5)); float n2 = vnoise(vec3(vUv.x * 18.0, vUv.y * 10.0 - uTime * 4.0, 1.0));',
          '  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.5);',
          '  vec3 col = mix(vec3(0.05, 0.35, 0.6), vec3(0.55, 0.9, 1.0), n * 0.7 + fres * 0.5); col += vec3(1.0) * smoothstep(0.72, 0.9, n2) * 0.6;',
          '  float a = (0.45 + n * 0.35 + fres * 0.3) * smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.85, vUv.y) * smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);',
          '  gl_FragColor = vec4(col, a * uOp); }'].join('\n'),
        transparent: true, depthWrite: false, side: THREE.DoubleSide
      });
      wm.baseOp = 0.85; mats.push(wm);
      var wt = new THREE.Mesh(wg, wm); wt.position.set(0, 1.7, 0.9); G.add(wt);
      parts.wg = wg; parts.wb = wg.attributes.position.array.slice(0); parts.wt = wt;
    } else if (fxk === 'scarf') {
      var sg = new THREE.PlaneGeometry(0.5, 10, 2, 60);
      var stex = stripeTex();
      var smat = new THREE.MeshBasicMaterial({ map: stex, color: new THREE.Color(col), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      smat.baseOp = 0.95; mats.push(smat);
      var sc2 = new THREE.Mesh(sg, smat); G.add(sc2);
      var sg2 = new THREE.PlaneGeometry(0.3, 10, 1, 60);
      var sc3 = new THREE.Mesh(sg2, GM('#ffffff', 0.35)); G.add(sc3);
      parts.sg = sg; parts.sb = sg.attributes.position.array.slice(0); parts.sg2 = sg2; parts.sb2 = sg2.attributes.position.array.slice(0);
    } else if (fxk === 'vortex') {
      var vg = new THREE.CylinderGeometry(1.7, 0.35, 3.8, 32, 6, true);
      var vt = new THREE.Mesh(vg, EM({ stripe: 2.2, fres: 1.2, op: 0.75 })); vt.position.set(0, 1.9, 0.6); G.add(vt); parts.vt = vt;
      parts.vr = [];
      for (var v = 0; v < 6; v++) { var vtr = new THREE.Mesh(new THREE.TorusGeometry(0.5 + v * 0.28, 0.04, 4, 28, 4.6), v % 2 ? GM('#ffffff', 0.6) : EM({ stripe: 0, fres: 0.5 })); vtr.position.set(0, y, 0.6 + v * 0.15); G.add(vtr); parts.vr.push(vtr); }
      parts.leaves = true;
    } else if (fxk === 'hands') {
      parts.hs = [];
      for (var hn = 0; hn < 10; hn++) {
        var a = -Math.PI * 0.95 + hn / 9 * Math.PI * 0.9 + Math.PI / 2;
        var hg = handGroup(hn % 2 ? EM({ stripe: 0, fres: 1.4, op: 0.9 }) : GM(U.mixHex(col, '#1b2a6a', 0.35), 0.75), 0.62);
        hg.position.set(Math.cos(a) * 1.7, y + Math.sin(a) * 1.1, 0.7); hg.rotation.z = a - Math.PI / 2; G.add(hg); parts.hs.push({ g: hg, a: a });
      }
    } else if (fxk === 'wings') {
      var wl = new THREE.Group(), wr = new THREE.Group();
      [[wl, false], [wr, true]].forEach(function (wp) {
        var w1 = new THREE.Mesh(wingGeo(2.9, wp[1], 9), EM({ stripe: 0.3, fres: 0.6, op: 0.9 }));
        var w2 = new THREE.Mesh(wingGeo(3.3, wp[1], 9), GM('#ffffff', 0.22));
        w2.position.z = -0.05; wp[0].add(w2); wp[0].add(w1);
      });
      wl.position.set(0, 1.45, 0.15); wr.position.set(0, 1.45, 0.15);
      G.add(wl); G.add(wr); parts.wl = wl; parts.wr = wr;
      parts.feathers = true;
    } else if (fxk === 'quake') {
      var cm = new THREE.MeshBasicMaterial({ map: crackTex(), color: new THREE.Color(col), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
      cm.baseOp = 0.95; mats.push(cm);
      var crack = new THREE.Mesh(GG.plane, cm); crack.rotation.x = -Math.PI / 2; crack.position.set(0, 0.06, 0.4); crack.scale.setScalar(0.01); G.add(crack); parts.crack = crack;
      var qr = new THREE.Mesh(GG.ring, GM(col, 0.85)); qr.rotation.x = -Math.PI / 2; qr.position.y = 0.07; G.add(qr); parts.qr = qr;
      parts.sp = [];
      var rmat2 = new THREE.MeshLambertMaterial({ color: 0x9c7a55, transparent: true }); rmat2.baseOp = 1; mats.push(rmat2);
      for (var q2 = 0; q2 < 10; q2++) { var an = q2 / 10 * Math.PI * 2; var spk = new THREE.Mesh(GG.cone, rmat2); spk.position.set(Math.cos(an) * 2.0, -1, Math.sin(an) * 1.3 + 0.7); spk.scale.set(0.32, 1.5, 0.32); spk.rotation.set(Math.sin(an) * 0.3, 0, -Math.cos(an) * 0.3); G.add(spk); parts.sp.push(spk); }
    } else {
      // tangkapan biasa: kilau tangan & cincin kecil
      var gl = sprite('#dff4ff', 1.6); gl.position.set(0, y, 0.4); G.add(gl); parts.gl = gl;
      var nr = new THREE.Mesh(GG.ring, GM('#ffffff', 0.7)); nr.position.set(0, y, 0.5); nr.scale.setScalar(0.01); G.add(nr); parts.nr = nr;
    }
    var light = self.cineLight;
    if (light && special) self.cineLightOwner = e; // jurus kiper mengambil alih cahaya adegan
    e.update = function (dt, t) {
      var k = U.easeBack(U.clamp(t / 0.3, 0, 1));
      // unsur bersama
      if (parts.rune) { parts.rune.scale.setScalar(4.6 * U.easeOut(U.clamp(t / 0.35, 0, 1))); parts.rune.rotation.z = t * 0.9; }
      if (parts.pil) { parts.pil.scale.set(1 + Math.sin(t * 9) * 0.03, U.easeOut(U.clamp(t / 0.3, 0, 1)), 1 + Math.sin(t * 9) * 0.03); }
      if (parts.flash) { var fk = U.clamp(t / 0.12, 0, 1) * Math.max(0, 1 - (t - 0.12) * 2.2); parts.flash.scale.setScalar(0.1 + fk * 5.5); parts.flash.material.opacity = fk; }
      if (special && Math.random() < 0.6 * self.pm) self.burst(at.x, 0.2, at.z, 'glow', { c0: col, n: 2, r: 0.9, h: 0.3, size: 0.22 });
      if (light && special && self.cineLightOwner === e) { light.color.set(col); light.position.set(at.x, 1.6, at.z); light.intensity = 2.2 * k * (0.9 + Math.sin(t * 19) * 0.1); }
      // tiap jurus
      if (parts.h) {
        parts.h.scale.setScalar(1.7 * k); parts.h.position.z = 0.65 + Math.sin(t * 9) * 0.08;
        parts.h2.scale.setScalar(2.3 * k * (1 + Math.sin(t * 6) * 0.04));
        parts.waves.forEach(function (w, i) { var tt = (t * 1.6 + i / 3) % 1; w.scale.setScalar(0.4 + tt * 2.6); w.material.opacity = 0.6 * (1 - tt) * Math.min(1, t * 4); });
        if (Math.random() < 0.5 * self.pm) self.addPS.emit(at.x, y, at.z, (Math.random() - 0.5) * 6, (Math.random() - 0.3) * 5, (Math.random() - 0.5) * 6, 0.3, 0.12, 0.02, '#ffffff', col, 1, 6, 0.95);
      }
      if (parts.cl) parts.cl.forEach(function (c, i) { var tt = U.clamp((t - i * 0.05) / 0.32, 0, 1); c.rotation.z = 0.8 - U.easeOut(tt) * 2.6; c.scale.setScalar(k); c.visible = t > i * 0.05; });
      if (parts.dome) {
        parts.dome.scale.setScalar(k * (1 + Math.sin(t * 12) * 0.025)); parts.dome2.scale.copy(parts.dome.scale);
        parts.dome.material.opacity = 0.8 * (0.75 + Math.sin(t * 18) * 0.25);
        var rt = (t * 1.4) % 1; parts.rip.scale.setScalar(0.2 + rt * 1.6); parts.rip.material.opacity = 0.9 * (1 - rt);
      }
      if (parts.rocks) {
        parts.rocks.forEach(function (r, i) { r.position.y = U.lerp(-1.6, 0.75 + (i % 2) * 0.35, U.easeOut(U.clamp((t - i * 0.03) / 0.3, 0, 1))); });
        parts.glowR.material.opacity = 0.5 * k * (0.7 + Math.sin(t * 15) * 0.3);
        if (t < 0.35 && Math.random() < 0.7) self.burst(at.x + (Math.random() - 0.5) * 4 * Math.abs(Math.cos(G.rotation.y)), 0.1, at.z + (Math.random() - 0.5) * 4, 'debris', { n: 3 });
      }
      if (parts.wg) {
        var p = parts.wg.attributes.position.array, b = parts.wb;
        for (var j = 0; j < p.length; j += 3) p[j + 2] = b[j + 2] + Math.sin(b[j] * 2 + t * 9) * 0.18 + Math.sin(b[j + 1] * 3 + t * 6) * 0.12;
        parts.wg.attributes.position.needsUpdate = true;
        parts.wt.scale.set(1, k, 1);
        if (Math.random() < 0.6) self.normPS.emit(at.x + (Math.random() - 0.5) * 0.4, 3.3 * Math.random(), at.z + (Math.random() - 0.5) * 4.5, 0, -2.5, (Math.random() - 0.5), 0.5, 0.15, 0.05, '#e8f8ff', '#4cc9f0', 0.8, 6, 0.98);
      }
      if (parts.sg) {
        [[parts.sg, parts.sb, 1.7], [parts.sg2, parts.sb2, 1.65]].forEach(function (sx) {
          var sp = sx[0].attributes.position.array, sb = sx[1];
          for (var m = 0; m < sp.length; m += 3) {
            var u = (sb[m + 1] + 5) / 10;
            var ang = u * Math.PI * 5.2 + t * 6, rad = sx[2] - u * 1.25 * U.clamp(t / 0.8, 0, 1);
            sp[m] = Math.cos(ang) * rad + sb[m] * Math.cos(ang); sp[m + 1] = y + Math.sin(ang) * rad * 0.8; sp[m + 2] = 0.8 + u * 0.5 + sb[m] * Math.sin(ang);
          }
          sx[0].attributes.position.needsUpdate = true;
        });
      }
      if (parts.vt) {
        parts.vt.rotation.y += dt * 9; parts.vt.scale.setScalar(k);
        parts.vr.forEach(function (v, i) { v.rotation.z += dt * (10 + i * 3); v.scale.setScalar(k); });
        if (Math.random() < 0.7) { var aa = Math.random() * U.TAU; self.normPS.emit(at.x + Math.cos(aa) * 1.4, 0.3 + Math.random() * 2.5, at.z + Math.sin(aa) * 1.4, -Math.sin(aa) * 5, 1.2, Math.cos(aa) * 5, 0.7, 0.16, 0.12, ['#8fbf4a', '#c7d96a', '#e8d27a'][Math.floor(Math.random() * 3)], '#5a7a2a', 1, 0, 0.97); }
      }
      if (parts.hs) parts.hs.forEach(function (h, i) { var tt = U.clamp((t - i * 0.025) / 0.3, 0, 1); h.g.scale.setScalar(0.62 * U.easeBack(tt)); h.g.position.z = 0.7 + Math.sin(t * 10 + i) * 0.15; h.g.position.x = Math.cos(h.a) * (1.7 - tt * 0.25); });
      if (parts.wl) {
        var fl = U.easeOut(U.clamp(t / 0.4, 0, 1)) * 0.9 + Math.sin(t * 8) * 0.1;
        parts.wl.rotation.z = -0.9 + fl; parts.wr.rotation.z = 0.9 - fl; parts.wl.scale.setScalar(k); parts.wr.scale.setScalar(k);
        if (Math.random() < 0.5 * self.pm) self.addPS.emit(at.x + (Math.random() - 0.5) * 5 * Math.abs(Math.sin(G.rotation.y)), 1 + Math.random() * 2.5, at.z + (Math.random() - 0.5) * 5 * Math.abs(Math.cos(G.rotation.y)), (Math.random() - 0.5) * 0.6, -0.6, (Math.random() - 0.5) * 0.6, 1.2, 0.2, 0.12, '#ffffff', col, 0.9, 0.3, 0.98);
      }
      if (parts.qr) {
        parts.crack.scale.setScalar(5.4 * U.easeOut(U.clamp(t / 0.2, 0, 1))); parts.crack.material.opacity = 0.95 * (0.7 + Math.sin(t * 20) * 0.3);
        parts.qr.scale.setScalar(1 + t * 7); parts.qr.material.opacity = Math.max(0, 0.85 - t * 0.7);
        parts.sp.forEach(function (s, i) { s.position.y = U.lerp(-1, 0.45, U.easeOut(U.clamp((t - 0.05 - i * 0.02) / 0.3, 0, 1))); });
        if (t < 0.3 && Math.random() < 0.8) self.burst(at.x, 0.1, at.z, 'dust', { n: 4, col: '#b08a5e' });
      }
      if (parts.gl) { parts.gl.scale.setScalar(1.6 * k); parts.nr.scale.setScalar(0.3 + (t % 0.6) * 2); parts.nr.material.opacity = 0.7 * (1 - (t % 0.6) / 0.6); }
    };
    e.shatter = function () {
      // jurus jebol oleh bola
      self.burst(at.x, y, at.z, 'spark', { n: 70, c0: col });
      self.burst(at.x, y, at.z, 'glow', { c0: col, n: 30, r: 1.4, h: 1.5, size: 0.3 });
      e.life = e.t + 0.4;
      var orig = e.update;
      e.update = function (dt, t) { orig(dt, t); G.scale.multiplyScalar(1 + dt * 3); fadeMats(mats, Math.max(0, 1 - (e.t - (e.life - 0.4)) / 0.4)); };
    };
    e.hold = function () {
      // jurus berhasil: api padam jadi uap
      self.burst(at.x, y, at.z + 0, 'steam', { n: 34 });
    };
    return this.spawn(e);
  };

  /* kilat tenaga antara wujud api dan jurus kiper */
  FX.prototype.arc = function (col) {
    var self = this, segs = 14, lines = 3;
    var pos = new Float32Array(segs * lines * 6), g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var m = new THREE.LineBasicMaterial({ color: new THREE.Color(col || '#ffffff'), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    m.baseOp = 0.9;
    var L = new THREE.LineSegments(g, m); L.frustumCulled = false;
    var e = { group: L, life: 30, mats: [m], ax: 0 };
    var A = new THREE.Vector3(), B = new THREE.Vector3(), regen = 0;
    e.set = function (a, b, dt) {
      A.set(a.x, a.y, a.z); B.set(b.x, b.y, b.z);
      regen -= dt || 0.016;
      if (regen > 0) return;
      regen = 0.05;
      var j = 0, len = A.distanceTo(B);
      for (var l = 0; l < lines; l++) {
        var px = A.x, py = A.y, pz = A.z;
        for (var s = 0; s < segs; s++) {
          var tt = (s + 1) / segs, amp = Math.sin(tt * Math.PI) * len * 0.12;
          var nx = A.x + (B.x - A.x) * tt + (Math.random() - 0.5) * amp, ny = A.y + (B.y - A.y) * tt + (Math.random() - 0.5) * amp, nz = A.z + (B.z - A.z) * tt + (Math.random() - 0.5) * amp;
          if (s === segs - 1) { nx = B.x; ny = B.y; nz = B.z; }
          pos[j++] = px; pos[j++] = py; pos[j++] = pz; pos[j++] = nx; pos[j++] = ny; pos[j++] = nz;
          px = nx; py = ny; pz = nz;
        }
      }
      g.attributes.position.needsUpdate = true;
      m.opacity = 0.6 + Math.random() * 0.4;
    };
    e.end = function () { e.dead = true; };
    void self;
    return this.spawn(e);
  };

  function ringTex() {
    if (R3.tex.ringSoft) return R3.tex.ringSoft;
    var t = R3.radialTex(128, [[0, 'rgba(255,255,255,0)'], [0.55, 'rgba(255,255,255,0)'], [0.8, 'rgba(255,255,255,0.9)'], [0.9, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']]);
    t.__baShared = true; R3.tex.ringSoft = t; return t;
  }
  FX.prototype.shockRing = function (x, y, z, col, face) {
    var mt = new THREE.MeshBasicMaterial({ map: ringTex(), color: new THREE.Color(col || '#ffffff'), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    var m = new THREE.Mesh(geo().plane, mt);
    m.position.set(x, y, z);
    if (face != null) m.rotation.y = face > 0 ? Math.PI / 2 : -Math.PI / 2; else m.rotation.x = -Math.PI / 2;
    var e = { group: m, life: 0.6 };
    e.update = function (dt, t) { m.scale.setScalar(1.2 + t * 14); m.material.opacity = Math.max(0, 0.9 - t * 1.6); };
    return this.spawn(e);
  };

  /* bekas hangus & retakan tanah bercahaya yang perlahan padam (titik tendangan / benturan) */
  FX.prototype.scorch = function (x, z, col, r, life) {
    r = r || 1.6; life = life || 7;
    var g = new THREE.Group();
    var dark = new THREE.Mesh(geo().plane, new THREE.MeshBasicMaterial({ map: R3.tex.blob, color: new THREE.Color('#0d0806'), transparent: true, opacity: 0.0, depthWrite: false }));
    dark.rotation.x = -Math.PI / 2; dark.position.y = 0.025; dark.scale.setScalar(r * 2.2); g.add(dark);
    var crack = new THREE.Mesh(geo().plane, new THREE.MeshBasicMaterial({ map: crackTex(), color: new THREE.Color(col || '#ff7a2a'), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
    crack.rotation.x = -Math.PI / 2; crack.rotation.z = Math.random() * U.TAU; crack.position.y = 0.03; crack.scale.setScalar(r * 2); g.add(crack);
    g.position.set(x, 0, z);
    var e = { group: g, life: life }, self = this;
    e.update = function (dt, t) {
      var k = U.clamp(t / 0.25, 0, 1);
      crack.scale.setScalar(r * 2 * (0.4 + 0.6 * U.easeOut(k)));
      crack.material.opacity = Math.max(0, (t < 0.6 ? 1 : 1 - (t - 0.6) / (life - 0.8))) * (0.75 + Math.sin(t * 17) * 0.25);
      dark.material.opacity = 0.55 * k * Math.max(0, 1 - t / life);
      if (t < 2.5 && Math.random() < 0.35) { var a = Math.random() * U.TAU, rr = Math.random() * r * 0.8; self.addPS.emit(x + Math.cos(a) * rr, 0.05, z + Math.sin(a) * rr, 0, 0.6 + Math.random() * 1.2, 0, 0.5 + Math.random() * 0.6, 0.08, 0.02, '#fff0c0', col || '#ff7a2a', 1, -0.4, 0.98); }
    };
    e.kill = function () { dark.material.dispose(); crack.material.dispose(); };
    return this.spawn(e);
  };
  /* hujan bara: percikan panas jatuh pelan di sekitar titik */
  FX.prototype.emberRain = function (x, y, z, col, n, r) {
    n = Math.round((n || 24) * this.pm); r = r || 2;
    for (var i = 0; i < n; i++) { var a = Math.random() * U.TAU, rr = Math.random() * r; this.addPS.emit(x + Math.cos(a) * rr, y + Math.random() * 1.5, z + Math.sin(a) * rr, (Math.random() - 0.5) * 1.2, -0.3 - Math.random() * 1.2, (Math.random() - 0.5) * 1.2, 1.2 + Math.random() * 1.4, 0.07, 0.01, '#fff3c4', col || '#ff7a2a', 1, 1.5, 0.985); }
  };
  /* kobaran kecil di rumput yang dilewati wujud api */
  FX.prototype.groundFire = function (x, z, c0, c1) {
    for (var i = 0; i < 3; i++) this.addPS.emit(x + (Math.random() - 0.5) * 0.5, 0.08, z + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.3, 0.9 + Math.random() * 0.8, (Math.random() - 0.5) * 0.3, 0.45 + Math.random() * 0.5, 0.42, 0.08, c1 || this.fire[1], c0 || this.fire[0], 0.9, -0.6, 0.95);
    if (Math.random() < 0.5) this.normPS.emit(x, 0.2, z, 0, 0.8, 0, 0.9, 0.5, 1.2, '#4a3a32', '#1e1a18', 0.35, -0.3, 0.97);
  };

  BA.FX.PS = PS;
  BA.FX.fireMat = fireMat;
  BA.FX.energyMat = energyMat;
})(typeof window !== 'undefined' ? window : globalThis);
