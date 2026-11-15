/* Bola Api Arena — tampilan pertandingan: sinkron model 3D, kamera, event, HUD */
(function (root) {
  'use strict';
  var BA = root.BA, U = BA.U, D = BA.D, R3 = BA.R3, F = D.FIELD;
  var THREE = root.THREE;

  var View = BA.View = function (st, opts) {
    var self = this;
    this.st = st;
    this.opts = opts || {};
    this.scene = new THREE.Scene();
    R3.applyShadows();
    this.arena = BA.Arena.build(this.scene, { arena: st.arena.id, weather: st.weather.id });
    this.chars = st.players.map(function (p) {
      var c = BA.Chars.build(p.cfg, st.teams[p.team]);
      c.root.position.set(p.x, 0, p.z);
      c.root.rotation.y = p.facing || 0;
      self.scene.add(c.root);
      return c;
    });
    this.fx = new BA.FX(this.scene, st.ballDef);
    if (st.weather.snowGround) { this.fx.dustCol = '#f4f7fa'; this.fx.dustCol2 = '#c8d2dc'; } /* debu lari jadi serbuk salju */
    this.fx.prewarm();
    if (BA.FXTex) BA.FXTex.preloadFor(st);
    this.rig = new BA.CamRig(R3.camera);
    this.rig.side = opts.side || 1;
    this.rig.mode = (BA.App && BA.App.settings.cam) || 'auto';
    this.cine = new BA.Cine({
      fx: this.fx, arena: this.arena, ui: BA.UI, audio: BA.Audio, rig: this.rig,
      chars: function () { return self.chars; },
      onDone: function (id) { if (self.opts.onCineDone) self.opts.onCineDone(id); }
    });
    this.arena.onTrain = function () { if (BA.Audio) BA.Audio.train(); if (self.opts.trainSay && BA.Narr) BA.Narr.train(); };
    this.arena.onThunder = function () { if (BA.Audio) BA.Audio.thunder(); };
    this.firstCam = true;
  };

  View.prototype.sync = function (dt, st, my) {
    var cine = this.cine.active ? this.cine : null;
    var shooter = cine ? cine.shooter : null, keeper = cine ? cine.keeper : null;
    var b = st.ball, o = this.charOpts || (this.charOpts = {});
    for (var i = 0; i < st.players.length; i++) {
      var p = st.players[i], c = this.chars[i];
      if (!c) continue;
      c.root.visible = !p.hidden && (!cine || c === shooter || c === keeper);
      if (c === shooter || c === keeper) continue;
      if (p.hidden) continue;
      c.root.position.y = 0;
      var anim = p.anim;
      o.owner = b.owner === p && (st.phase === 'play' || st.phase === 'kickoff') && !p.gkHold && !p.throwIn;
      o.sprint = !!p.sprint; o.slide = false; o.forward = false; o.dive = 0;
      o.release = p.throwIn ? 0 : (p.animT || 0) + 0.01;
      if (anim === 'kick') anim = 'shoot';
      else if (anim === 'slide') { anim = 'tackle'; o.slide = true; }
      else if (anim === 'gkDive') { if (p.diveSide) o.dive = p.diveSide; else o.forward = true; }
      c.update(dt, p.x, p.z, p.facing, anim, p.animT, o);
      if (p.sprint && !cine && c.speed > 5 && Math.random() < dt * 9) this.fx.burst(p.x - Math.sin(p.facing) * 0.3, 0.05, p.z - Math.cos(p.facing) * 0.3, 'dust', { n: 2 });
    }
    if (!cine) {
      var heat = 0;
      if (st.rules && st.rules.bolaPanas && b.owner && !b.owner.gkHold && b.holdT > 3) heat = U.clamp((b.holdT - 3) / 3, 0, 1);
      this.fx.updateBall(dt, this.displayBall(dt, st), { petir: b.petirT > 0, heat: heat, owner: b.owner, hide: st.phase === 'cine' });
    }
    // penanda pemain yang dipegang manusia: kuning + panah = saya, biru = rekan setim, merah muda = lawan
    var seats = st.seats || [], mm = BA.App && BA.App.match, mySeat = mm ? (mm.seat || 0) : 0, nSeat = 0, k;
    for (k = 0; k < seats.length; k++) if (seats[k]) nSeat++;
    var hideMk = !!cine || st.phase === 'pen' || st.phase === 'goal' || st.phase === 'end';
    for (k = 0; k < 8; k++) {
      var se = seats[k], sp = se && st.seatP ? st.seatP(k) : null;
      var on = !hideMk && !!sp && !sp.hidden && (k === mySeat || nSeat > 1);
      this.fx.seatMarker(k, sp, on, k === mySeat ? '#ffd23f' : (se && se.team === my ? '#4cc9f0' : '#ff6b8a'), k === mySeat);
    }
    // lencana di atas kepala pemain tim sendiri: cedera (palang merah) / kehabisan tenaga
    if (this.fx.badges) this.fx.badges(hideMk ? null : st.players, my);
    this.fx.update(dt);
    this.arena.update(dt, 0, { fx: b.x, fz: b.z });
  };

  /* posisi bola yang digambar: di kaki penggiring (mengikuti sentuhan), di tangan kiper / pelempar, atau bebas */
  View.prototype.displayBall = function (dt, st) {
    var b = st.ball, d = this.dball || (this.dball = { x: 0, y: 0.13, z: 0, mode: 'free' });
    var ow = b.owner, mode = 'free', tx = b.x, ty = b.y, tz = b.z;
    var idx = ow ? st.players.indexOf(ow) : -1, c = idx >= 0 ? this.chars[idx] : null;
    var v3 = this.tmpV || (this.tmpV = new THREE.Vector3());
    if (c && !ow.hidden) {
      if (ow.gkHold || ow.throwIn) { c.handsBall(v3); tx = v3.x; ty = v3.y; tz = v3.z; mode = 'hand'; }
      else if (st.phase === 'play' || st.phase === 'restart' || st.phase === 'kickoff') { c.dribbleBall(v3); tx = v3.x; tz = v3.z; ty = D.FIELD.ballR; mode = 'foot'; }
    }
    if (mode === 'free') { d.x = tx; d.y = ty; d.z = tz; }
    else {
      var k = d.mode === mode ? 1 - Math.exp(-40 * dt) : 1 - Math.exp(-18 * dt);
      d.x += (tx - d.x) * k; d.y += (ty - d.y) * k; d.z += (tz - d.z) * k;
    }
    d.mode = mode; d.petirT = b.petirT;
    return d;
  };

  View.prototype.camera = function (dt, st, my) {
    var rig = this.rig;
    rig.mode = (BA.App && BA.App.settings.cam) || 'auto';
    rig.userZoom = (BA.App && BA.App.settings.camZoom) || 1;
    if (this.cine.active) {
      var o = this.cine.update(dt);
      if (o) rig.update(dt, 0, 0, { override: { px: o.px, py: o.py, pz: o.pz, lx: o.lx, ly: o.ly, lz: o.lz }, k: 9, snap: !this.wasCine || !!o.cut });
      this.wasCine = true;
      this.firstCam = false;
      return;
    }
    if (this.wasCine) { this.wasCine = false; this.firstCam = true; }
    var b = st.ball, fx = b.x, fz = b.z;
    var opt = { snap: this.firstCam };
    this.firstCam = false;
    if (st.phase === 'pen' && st.pen) {
      var pen = st.pen, dir = st.dirOf ? st.dirOf(pen.team) : (pen.team === 0 ? 1 : -1);
      var gx = dir * F.L / 2;
      var sx = b.x, sz = b.z;
      opt.override = { px: sx - dir * 7, py: 3.2, pz: sz * 0.6 + (sz >= 0 ? 1.6 : -1.6), lx: gx, ly: 1.1, lz: sz * 0.2 };
      opt.k = 5;
    } else if (st.phase === 'goal') {
      opt.zoom = 0.82;
    } else if (st.phase === 'end') {
      opt.zoom = 1.15;
    }
    if (st.aim && st.aim.team === my) opt.zoom = 0.86;
    rig.update(dt, fx, fz, opt);
  };

  View.prototype.render = function () { R3.render(this.scene); };

  /* peta mini: titik pemain & bola, mengikuti arah kamera */
  View.prototype.minimap = function (dt, st, my, setting) {
    var cv = this.mmEl || (this.mmEl = document.getElementById('minimap'));
    if (!cv) return;
    var F = D.FIELD;
    var show = (setting === 'on' || (setting !== 'off' && F.n >= 7)) && !this.cine.active && st.mode === 'match' && st.phase !== 'pen';
    if (cv.hidden !== !show) cv.hidden = !show;
    if (!show) return;
    this.mmT = (this.mmT || 0) + dt;
    if (this.mmT < 1 / 15 && this.mmDrawn) return;
    this.mmT = 0; this.mmDrawn = true;
    var fw = this.rig.fwd, alongX = Math.abs(fw.x) > Math.abs(fw.z);
    var fx = alongX ? (fw.x >= 0 ? 1 : -1) : 0, fz = alongX ? 0 : (fw.z >= 0 ? 1 : -1);
    var rx = -fz, rz = fx;
    var W = alongX ? 84 : 132, H = alongX ? 132 : 84;
    var pr = Math.min(2, root.devicePixelRatio || 1);
    if (this.mmW !== W) { this.mmW = W; cv.width = Math.round(W * pr); cv.height = Math.round(H * pr); cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
    var g = cv.getContext('2d');
    if (!g) return;
    g.setTransform(pr, 0, 0, pr, 0, 0);
    g.clearRect(0, 0, W, H);
    var mg = 5, iw = W - mg * 2, ih = H - mg * 2;
    var halfR = alongX ? F.W / 2 : F.L / 2, halfU = alongX ? F.L / 2 : F.W / 2;
    var sx = iw / (2 * halfR), sy = ih / (2 * halfU);
    var P = function (x, z) { var u = x * rx + z * rz, v = -(x * fx + z * fz); return [mg + iw / 2 + u * sx, mg + ih / 2 + v * sy]; };
    g.fillStyle = 'rgba(28,74,40,0.82)'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1;
    var rect = function (x0, z0, x1, z1) { var a = P(x0, z0), b = P(x1, z1); g.strokeRect(Math.min(a[0], b[0]) + 0.5, Math.min(a[1], b[1]) + 0.5, Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); };
    rect(-F.L / 2, -F.W / 2, F.L / 2, F.W / 2);
    var h1 = P(0, -F.W / 2), h2 = P(0, F.W / 2);
    g.beginPath(); g.moveTo(h1[0], h1[1]); g.lineTo(h2[0], h2[1]); g.stroke();
    var cc = P(0, 0); g.beginPath(); g.arc(cc[0], cc[1], F.circle * Math.min(sx, sy), 0, Math.PI * 2); g.stroke();
    rect(-F.L / 2, -F.boxW / 2, -F.L / 2 + F.boxL, F.boxW / 2);
    rect(F.L / 2 - F.boxL, -F.boxW / 2, F.L / 2, F.boxW / 2);
    var mm = BA.App && BA.App.match, act = st.active ? (mm && mm.ctl === 2 ? st.active2 : st.active[my]) : null;
    for (var i = 0; i < st.players.length; i++) {
      var p = st.players[i];
      if (!p || p.hidden) continue;
      var q = P(p.x, p.z), T = st.teams[p.team];
      g.beginPath(); g.arc(q[0], q[1], p.role === 'GK' ? 2.4 : 2.8, 0, Math.PI * 2);
      g.fillStyle = p.role === 'GK' ? (T.gk || T.c1) : T.c1; g.fill();
      g.lineWidth = p.team === my ? 1.4 : 1; g.strokeStyle = p.team === my ? '#ffffff' : 'rgba(0,0,0,0.75)'; g.stroke();
      if (p === act) { g.beginPath(); g.arc(q[0], q[1], 5, 0, Math.PI * 2); g.strokeStyle = my === 0 ? '#ffd23f' : '#4cc9f0'; g.lineWidth = 1.6; g.stroke(); }
    }
    var b = st.ball, qb = P(U.num(b.x, 0), U.num(b.z, 0));
    g.beginPath(); g.arc(qb[0], qb[1], 2.4, 0, Math.PI * 2); g.fillStyle = '#ffcc33'; g.fill();
    g.lineWidth = 1; g.strokeStyle = '#7a1d00'; g.stroke();
  };

  /* ganti model 3D seorang pemain (pergantian pemain) */
  View.prototype.replaceChar = function (code) {
    var st = this.st, p = st.players[code], old = this.chars[code];
    if (!p) return;
    var c = BA.Chars.build(p.cfg, st.teams[p.team]);
    c.root.position.set(p.x, 0, p.z); c.root.rotation.y = p.facing || 0;
    this.scene.add(c.root);
    this.chars[code] = c;
    if (old) { try { old.dispose(); } catch (e) { /* abaikan */ } }
    if (BA.FXTex && p.shot) BA.FXTex.preload(['e_' + p.shot.id]);
    this.fx.burst(p.x, 0.9, p.z, 'glow', { n: 16, r: 0.6, h: 1.6, c0: st.teams[p.team].c1 });
  };

  View.prototype.dispose = function () {
    if (this.cine.active) { this.cine.active = false; BA.UI.cineEnd(); }
    this.fx.dispose();
    this.chars.forEach(function (c) { c.dispose(); });
    this.arena.dispose();
    R3.dispose(this.scene);
    this.scene = null;
  };

  /* data adegan dari jaringan dianggap tidak tepercaya: saring ke nilai yang dikenal */
  function own(o, k) { return typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k); }
  function cleanCine(d) {
    if (!d || typeof d !== 'object') return null;
    var n = function (v, lo, hi, def) { return U.clamp(U.num(v, def), lo, hi); };
    var LX = D.FIELD.L / 2 + 3, LZ = D.FIELD.W / 2 + 3; /* batas mengikuti ukuran lapangan yang dipakai */
    return {
      id: Math.round(n(d.id, 0, 1e9, 0)), team: d.team === 1 ? 1 : 0, si: Math.round(n(d.si, 0, (D.FIELD.n || 5) - 1, 4)), ki: 0,
      type: own(D.shotById, d.type) ? d.type : D.SHOTS[0].id, zone: own(D.zoneById, d.zone) ? d.zone : 'C',
      c: Math.round(n(d.c, 0, 130, 80)), ult: d.ult ? 1 : 0, combo: d.combo ? 1 : 0, perfect: d.perfect ? 1 : 0,
      sp: Math.round(n(d.sp, 0, 9999, 0)), kp: Math.round(n(d.kp, 0, 9999, 0)),
      res: ['goal', 'catch', 'parry', 'post'].indexOf(d.res) >= 0 ? d.res : 'catch', skill: own(D.SKILLS, d.skill) ? d.skill : '',
      fx: n(d.fx, -LX, LX, 0), fz: n(d.fz, -LZ, LZ, 0), bx: n(d.bx, -LX, LX, n(d.fx, -LX, LX, 0)), bz: n(d.bz, -LZ, LZ, n(d.fz, -LZ, LZ, 0)),
      kx: n(d.kx, -LX, LX, 0), kz: n(d.kz, -LZ, LZ, 0), pen: d.pen ? 1 : 0, sandal: d.sandal ? 1 : 0, dir: d.dir === 1 || d.dir === -1 ? d.dir : 0
    };
  }
  BA.cleanCine = cleanCine;
  function cleanSum(s) {
    if (!s || typeof s !== 'object') return null;
    var arr = function (a) { return Array.isArray(a) ? a : []; };
    var kicks = function (k) { return String(k == null ? '' : k).replace(/[^01]/g, '').slice(0, 30); };
    var sc = arr(s.sc);
    return {
      sc: [U.clamp(sc[0] | 0, 0, 99), U.clamp(sc[1] | 0, 0, 99)], wn: s.wn === 0 || s.wn === 1 ? s.wn : -1,
      so: Array.isArray(s.so) ? [kicks(s.so[0]), kicks(s.so[1])] : null,
      goals: arr(s.goals).slice(0, 20).map(function (g) { g = arr(g); return [g[0] === 1 ? 1 : 0, U.cleanText(String(g[1] == null ? '' : g[1]), 14), U.cleanText(String(g[2] == null ? '' : g[2]), 20), g[3] ? 1 : 0, U.clamp(g[4] | 0, 0, 5999)]; }),
      st: [0, 1].map(function (t) { var r = arr(arr(s.st)[t]); var o = []; for (var i = 0; i < 8; i++) o.push(U.clamp(r[i] | 0, 0, 99999)); return o; }),
      best: Array.isArray(s.best) ? [U.clamp(s.best[0] | 0, 0, 99999), U.cleanText(String(s.best[1] == null ? '' : s.best[1]), 14), U.cleanText(String(s.best[2] == null ? '' : s.best[2]), 20), s.best[3] === 1 ? 1 : 0] : null
    };
  }
  BA.cleanSum = cleanSum;

  /* ---------- penangan event (lokal, tuan rumah, tamu) ---------- */
  BA.handleEvents = function (evs, m) {
    var v = m.view, st = m.state, A = BA.Audio, UI = BA.UI, S = BA.App.settings, In = BA.Input;
    var vib = function (ms) { if (S.vibrate && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* abaikan */ } } };
    var mine = function (code) { var p = code >= 0 ? st.players[code] : null; return !!(p && p.team === m.my); };
    var T = function () { return BA.t ? BA.t.apply(null, arguments) : arguments[0]; };
    var fire = (st.ballDef && st.ballDef.fire) || ['#ff4d1a', '#ffcc33'];
    if (BA.Narr) BA.Narr.onEvents(evs, st);
    evs.forEach(function (e) {
      // getar stik
      if (In && In.device === 'pad') {
        if ((e.k === 'kick' || e.k === 'miss') && mine(e.p)) In.rumble(0.15, 0.45, 70);
        else if (e.k === 'tackle' && e.ok) { if (mine(e.on)) In.rumble(0.7, 0.25, 160); else if (mine(e.p)) In.rumble(0.35, 0.4, 110); }
        else if (e.k === 'goal') In.rumble(e.team === m.my ? 0.9 : 0.5, e.team === m.my ? 0.9 : 0.2, e.team === m.my ? 450 : 260);
        else if (e.k === 'cine') In.rumble(0.3, 0.6, 180);
        else if (e.k === 'post' && !e.soft) In.rumble(0.6, 0.3, 200);
        else if (e.k === 'save' && !e.small) In.rumble(0.4, 0.4, 150);
      }
      var kv = function (idx) { var pl = idx >= 0 ? st.players[idx] : null; var tm = pl ? st.teams[pl.team] : null; return tm ? [tm.kind || 'manusia', pl.cfg && pl.cfg.variant || ''] : null; };
      var tv = function (team) { var tm = st.teams[team]; var pl = tm && st.players.filter(function (q) { return q.team === team; })[0]; return tm ? [tm.kind || 'manusia', pl && pl.cfg && pl.cfg.variant || ''] : null; };
      var say = function (kk, ev) { if (kk && A.voice) A.voice(kk[0], kk[1], ev); };
      switch (e.k) {
        case 'kickoffFirst': A.crowdLevel(0.06); A.cheer(1.2); break;
        case 'whistle': A.whistle(!!e.short); break;
        case 'kick': A.kick(e.soft ? 0.6 : 1); if (!e.soft) say(kv(e.p), 'kick'); break;
        case 'pass': A.pass(e.pow, e.lob); break;
        case 'bounce': A.bounce(e.v); break;
        case 'wall': A.bounce(0.6); break;
        case 'tackle':
          A.tackle();
          if (e.ok) { say(kv(e.p), 'tackle'); say(kv(e.on), 'hurt'); } else say(kv(e.p), 'gocek');
          var tp = st.players[e.p]; if (tp) v.fx.burst(tp.x, 0.1, tp.z, 'dust', { n: 8 });
          if (e.ok && tp && v.fx.impactFx) v.fx.impactFx(tp.x, 0.5, tp.z, 1.5);
          if (e.ok && e.p >= 0 && st.players[e.p] && st.players[e.p].team === m.my) vib(25);
          break;
        case 'slide': var sp = st.players[e.p]; if (sp) v.fx.burst(sp.x, 0.1, sp.z, 'dust', { n: 10 }); A.whoosh(0.4); break;
        case 'gocek': A.whoosh(0.35); say(kv(e.p), 'gocek'); break;
        case 'cine':
          var cd = cleanCine(e.d);
          if (cd) { v.cine.start(cd, st.players); A.crowdLevel(0.16); vib(30); say(tv(cd.team), 'roar'); }
          break;
        case 'goal':
          A.crowdLevel(0.1);
          v.arena.cheer = 1;
          say(tv(e.team), 'goal'); say(tv(1 - e.team), 'sad');
          if (e.pen && e.practice) { UI.toast(T('GOL! Latihan berhasil')); break; }
          if (e.pen) { UI.toast(T('{0} mencetak penalti!', st.teams[e.team] ? st.teams[e.team].short : '')); break; }
          if (e.free) {
            var gdir = st.dirOf ? st.dirOf(e.team) : (e.team === 0 ? 1 : -1);
            var gx = gdir * F.L / 2;
            v.fx.burst(gx, 1, st.ball.z, 'confetti', { n: 100 });
            if (v.fx.goalBlast && !e.own) { v.fx.goalBlast(gx + gdir * 0.3, 1.1, st.ball.z, gdir, fire[0], fire[1]); if (UI.impact) UI.impact(220); }
            v.arena.bulge(st.dirOf ? st.dirOf(e.team) : (e.team === 0 ? 1 : -1), st.ball.z, 0.8);
            A.goalBlast();
            v.rig.kick(0.6);
          }
          var gs = Array.isArray(e.sc) ? e.sc : st.score;
          UI.banner(e.own ? T('GOL BUNUH DIRI') : T('GOOOL!'), (st.teams[0].short + ' ' + (gs[0] | 0) + ' – ' + (gs[1] | 0) + ' ' + st.teams[1].short), 2200);
          vib([40, 60, 80]);
          break;
        case 'save':
          if (!v.cine.active) { if (e.kind === 'smother' || e.kind === 'catch') A.catchBall(); else A.parry(); }
          if (e.sk && v.fx.impactFx) { v.fx.impactFx(st.ball.x, Math.max(0.5, st.ball.y), st.ball.z, 2.6, '#bfe9ff', '#ffffff'); v.rig.kick(0.2); }
          say(tv(e.team), 'save'); break;
        case 'strike': {
          var kp = st.players[e.p];
          A.kick(e.kind === 'jauh' ? 1.3 : 0.8);
          if (e.kind === 'jauh') { say(kv(e.p), 'kick'); v.rig.kick(0.22); }
          if (kp && v.fx.strikeFx) v.fx.strikeFx(kp.x + Math.sin(kp.facing) * 0.5, kp.z + Math.cos(kp.facing) * 0.5, e.kind, fire[0], fire[1]);
          if (mine(e.p)) vib(20);
          break;
        }
        case 'block': { var bp = st.players[e.p]; A.tackle(); if (bp && v.fx.impactFx) v.fx.impactFx(bp.x, 0.9, bp.z, 1.9); break; }
        case 'injury': {
          var ip = st.players[e.p];
          if (ip) { say(kv(e.p), 'hurt'); UI.toast('✚ ' + T('{0} cedera!', ip.name) + (ip.team === m.my ? ' ' + T('Ganti lewat Jeda → Strategi.') : '')); }
          break;
        }
        case 'sub': {
          var sc2 = (e.team | 0) * st.n + (e.idx | 0);
          if (st.players[sc2]) v.replaceChar(sc2);
          UI.toast('↔ ' + (st.teams[e.team] ? st.teams[e.team].short + ': ' : '') + T('{0} masuk, {1} keluar', U.cleanText(String(e.on || ''), 12), U.cleanText(String(e.off || ''), 12)));
          if (UI.strategyRefresh) UI.strategyRefresh();
          break;
        }
        case 'teamset': if (UI.strategyRefresh) UI.strategyRefresh(); break;
        case 'post': if (!v.cine.active) A.post(); break;
        case 'miss': A.groan(); break;
        case 'hot': A.sizzle(); var hp = st.ball; v.fx.burst(hp.x, 0.4, hp.z, 'fire', { n: 25, s: 4 }); UI.toast(T('Bola panas!')); break;
        case 'petir': v.arena.lightning(U.num(e.x, 0), U.num(e.z, 0)); A.petir(); v.fx.burst(U.num(e.x, 0), 0.3, U.num(e.z, 0), 'spark', { n: 60, c0: '#7fb2ff' }); if (v.fx.boltFx) v.fx.boltFx(U.num(e.x, 0), U.num(e.z, 0)); v.rig.kick(0.5); UI.toast(T('BOLA PETIR!')); break;
        case 'corner': if (!(st.rules.tigaPojok && e.n >= 3)) UI.toast(T('Sepak pojok {0}', st.teams[e.team] ? st.teams[e.team].short : '') + (st.rules.tigaPojok ? ' (' + e.n + '/3)' : '')); break;
        case 'penalty': UI.banner(T('PENALTI!'), st.teams[e.team] ? T('untuk {0}', st.teams[e.team].name) : '', 1800); A.whistle(false); break;
        case 'shootout': UI.banner(T('ADU PENALTI'), T('Api siapa paling panas?'), 2000); A.whistle(false); break;
        case 'golden': UI.banner(T('GOL EMAS!'), T('Gol berikutnya menang'), 2200); A.whistle(false); break;
        case 'half': UI.banner(T('TURUN MINUM'), T('Babak 2: tim bertukar sisi lapangan'), 2600); break;
        case 'backpass': UI.banner(T('BACK-PASS'), T('Kiper harus main pakai kaki'), 1200); break;
        case 'restart': if (e.kind === 'freekick') UI.toast(T('Tendangan bebas {0}', st.teams[e.team] ? st.teams[e.team].short : '')); break;
        case 'offside': { var op = st.players[e.p]; A.whistle(true); UI.banner(T('OFFSIDE'), op ? T('{0} terjebak offside', op.name) : '', 1500); break; }
        case 'foul': { var fp = st.players[e.p], fv = st.players[e.on]; A.whistle(true); A.tackle(); UI.banner(e.box ? T('PENALTI!') : T('PELANGGARAN'), fp && fv ? T('{0} melanggar {1}', fp.name, fv.name) : (fp ? fp.name : ''), 1500); if (fv) v.fx.burst(fv.x, 0.2, fv.z, 'dust', { n: 10 }); break; }
        case 'card': { var cp = st.players[e.p]; UI.banner(e.card === 'merah' ? T('KARTU MERAH') : T('KARTU KUNING'), cp ? (e.card === 'merah' ? T('{0} diusir keluar!', cp.name) : cp.name) : '', 1800); A.whistle(false); break; }
        case 'end':
          A.whistle(false); A.whistle(false, 0.45); A.cheer(2.5);
          var sum = cleanSum(e.sum);
          if (BA.App.onMatchEnd) setTimeout(function () { try { BA.App.onMatchEnd(sum, m); } catch (err) { if (root.console) root.console.error(err); BA.App.fatal(err); } }, 2300);
          break;
        default: break;
      }
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
