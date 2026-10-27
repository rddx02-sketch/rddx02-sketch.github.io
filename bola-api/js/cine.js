/* Bola Api Arena — sutradara adegan singkat: jurus serangan vs jurus bertahan */
(function (root) {
  'use strict';
  var BA = root.BA, U = BA.U, D = BA.D, F = D.FIELD;
  var THREE = root.THREE;

  var POSE_OF = { palm: 'silat_palm', claw: 'silat_claw', dome: 'silat_both', wall: 'silat_stance', water: 'silat_both', scarf: 'silat_wings', vortex: 'silat_palm', hands: 'silat_wings', wings: 'silat_wings', quake: 'silat_stomp' };

  var Cine = BA.Cine = function (ctx) {
    this.ctx = ctx; // { fx, arena, chars(), ui, audio, rig }
    this.active = false;
  };

  Cine.prototype.start = function (c, players) {
    this.c = c;
    this.active = true;
    this.t = 0;
    this.fired = {};
    this.done = false;
    var att = c.team, dir = att === 0 ? 1 : -1;
    this.dir = dir;
    var gx = dir * F.L / 2;
    var zone = D.zoneById[c.zone] || D.zoneById.C;
    this.zone = zone;
    var shot = D.shotById[c.type] || D.SHOTS[0];
    this.shot = shot;
    this.skill = c.skill ? D.SKILLS[c.skill] : null;
    var bx = U.num(c.bx, c.fx), bz = U.num(c.bz, c.fz);
    this.from = { x: bx, y: 0.4, z: bz };
    this.target = { x: gx + dir * 0.15, y: D.ZONE_Y[zone.r], z: zone.c * D.ZONE_DZ * dir };
    this.keepAt = { x: gx - dir * 0.55, y: D.ZONE_Y[zone.r], z: U.clamp(this.target.z * 0.85, -2.2, 2.2) };
    var ult = !!c.ult;
    this.ult = ult;
    this.T = { a: ult ? 0.95 : 0.65 };
    this.T.b = this.T.a + (shot.id === 'meteor' ? 1.25 : 0.95);
    this.T.c = this.T.b + 0.7;
    this.T.end = this.T.c + (c.res === 'goal' ? 0.95 : 0.75);
    var chars = this.ctx.chars();
    var n = (players && players.length) ? players.length / 2 : chars.length / 2;
    this.shooter = chars[att * n + c.si];
    this.keeper = chars[(1 - att) * n];
    this.sp = players ? players[att * n + c.si] : null;
    this.kp = players ? players[(1 - att) * n] : null;
    // tempatkan penendang di belakang bola
    if (this.shooter) {
      var ang = Math.atan2(this.target.x - bx, this.target.z - bz);
      this.shooterPos = { x: bx - Math.sin(ang) * 0.55, z: bz - Math.cos(ang) * 0.55, f: ang };
    }
    this.keeperStart = { x: gx - dir * 0.4, z: 0 };
    // kamera selalu di satu sisi garis tembakan (tidak menyeberang menembus wujud api)
    this.camSide = bz >= 0 ? -1 : 1;
    this.stage = '';
    var fx = this.ctx.fx;
    fx.updateBall(0, { x: bx, y: 0.17, z: bz }, { big: 1.4 });
    this.shape = null; this.skillFx = null; this.arcFx = null;
    this.ballFly = null;
    this.sandal = null;
    var ui = this.ctx.ui;
    var tName = this.sp ? this.sp.name : '';
    ui.cineStart({ att: att, shooter: tName, shot: shot.name, ult: ult, perfect: !!c.perfect, combo: !!c.combo, pen: !!c.pen });
    var au = this.ctx.audio;
    if (au) au.whoosh(ult ? 1.4 : 1);
  };

  Cine.prototype.skip = function () {
    if (!this.active) return;
    if (this.t < this.T.c) { this.t = this.T.c - 0.02; this.skipped = true; }
    else this.t = Math.max(this.t, this.T.end - 0.25);
  };

  Cine.prototype.finish = function () {
    if (!this.active) return;
    this.active = false;
    if (this.shape) { this.shape.dead = true; }
    if (this.skillFx) { this.skillFx.dead = true; }
    if (this.arcFx) { this.arcFx.dead = true; this.arcFx = null; }
    if (this.sandal) { BA.R3.dispose(this.sandal); this.sandal = null; }
    this.ctx.ui.cineEnd();
    if (this.ctx.onDone) this.ctx.onDone(this.c.id);
  };

  /* dipanggil tiap frame; mengembalikan posisi kamera */
  /* perlambatan sesaat (hit-stop) saat api meledak dan saat hasil adu ditentukan */
  Cine.prototype.timeScale = function () {
    var t = this.t, T = this.T;
    var b0 = T.a - 0.18, r0 = T.c;
    if (t > b0 && t < b0 + 0.14) return 0.3;
    if (t > r0 && t < r0 + 0.16) return 0.25;
    if (t > T.b - 0.08 && t < T.b + 0.06) return 0.55;
    return 1;
  };
  Cine.prototype.update = function (dt) {
    if (!this.active) return null;
    this.realDt = dt;
    dt *= this.timeScale();
    this.t += dt;
    var t = this.t, T = this.T, c = this.c, dir = this.dir, fx = this.ctx.fx, ui = this.ctx.ui, au = this.ctx.audio;
    var from = this.from, tgt = this.target;
    var cam = { px: 0, py: 0, pz: 0, lx: 0, ly: 0, lz: 0 };
    var stage = t < T.a ? 'a' : t < T.b ? 'b' : t < T.c ? 'c' : 'd';
    if (stage !== this.stage) { if (stage === 'c' || stage === 'd') cam.cut = true; this.stage = stage; }
    // ---- penendang: ancang-ancang lalu tendangan; kaki menyentuh bola tepat saat api meledak ----
    if (this.shooter && this.shooterPos) {
      var tBurst = T.a - 0.18, C = BA.Chars.CONTACT || 0.1;
      var kickT = t - tBurst + C;
      var anim = kickT < 0 ? 'aim' : 'shoot';
      this.shooter.update(dt, this.shooterPos.x, this.shooterPos.z, this.shooterPos.f, anim, Math.max(0, kickT), {});
    }
    // ---- kiper ----
    if (this.keeper) {
      var kp = this.keeperStart, ka = this.keepAt;
      var kt = U.clamp((t - T.b + 0.15) / 0.35, 0, 1);
      var kx = U.lerp(kp.x, ka.x, U.easeOut(kt)), kz = U.lerp(kp.z, ka.z, U.easeOut(kt));
      var kf = Math.atan2(-dir, 0);
      // sisi kiri kiper (dilihat dari kiper): untuk arah terbang
      var leftX = Math.cos(kf), leftZ = -Math.sin(kf);
      var side = (tgt.x - kx) * leftX + (tgt.z - kz) * leftZ;
      var ko = this.kOpts || (this.kOpts = {});
      ko.dive = side >= 0 ? 1 : -1; ko.forward = false;
      var kanim = 'gkReady', kaT = t - (T.b - 0.15);
      if (t > T.b - 0.15) {
        if (this.skill) kanim = POSE_OF[this.skill.fx] || 'silat_palm';
        else if (this.zone.c !== 0) kanim = 'gkDive';
        else kanim = this.zone.r === 0 ? 'gkCatchHigh' : (this.zone.r === 2 ? 'gkCatchLow' : 'gkHold');
      }
      if (t > T.c && c.res === 'catch') { kanim = 'gkHold'; kaT = 0; }
      if (t > T.c && c.res === 'goal' && kanim !== 'gkDive') kanim = 'sad';
      var jump = (this.zone.r === 0 && t > T.b - 0.1 && kanim !== 'sad') ? Math.sin(U.clamp((t - T.b + 0.1) / 0.8, 0, 1) * Math.PI) * 0.6 : 0;
      this.keeper.update(dt, kx, kz, kf, kanim, kaT, ko);
      this.keeper.root.position.y = jump;
    }
    // ---- tahap A: ancang-ancang ----
    if (t < T.a) {
      var k = t / T.a;
      var bk = -dir;
      var sz = from.z >= 0 ? -1 : 1;
      cam.px = from.x + bk * (2.6 - k * 0.6); cam.py = 1.5 + k * 0.2; cam.pz = from.z + sz * (3.4 - k * 0.4);
      cam.lx = from.x + dir * 2.2; cam.ly = 0.8; cam.lz = U.lerp(from.z, tgt.z, 0.25);
      fx.updateBall(dt, { x: from.x, y: 0.17, z: from.z }, { big: 1 + k * 1.4 });
      // api mengumpul di bola selama ancang-ancang
      if (Math.random() < 0.8) { var ca = Math.random() * Math.PI * 2, cr = 1.4 - k; fx.addPS.emit(from.x + Math.cos(ca) * cr, 0.3 + Math.random() * 0.8, from.z + Math.sin(ca) * cr, -Math.cos(ca) * cr * 2.4, 0.4, -Math.sin(ca) * cr * 2.4, 0.42, 0.28, 0.06, this.shot.fire[1], this.shot.fire[0], 0.9, 0, 0.98); }
      var ult = this.ult;
      if (!this.fired.burst && t > T.a - 0.18) {
        this.fired.burst = 1;
        fx.burst(from.x, 0.4, from.z, 'fire', { n: 70, s: 5.5, c0: this.shot.fire[0], c1: this.shot.fire[1], size: 1.15 });
        fx.shockRing(from.x, 0.12, from.z, this.shot.fire[1]);
        fx.burst(from.x, 0.1, from.z, 'dust', { n: 14 });
        fx.burst(from.x, 0.15, from.z, 'debris', { n: 16 });
        fx.scorch(from.x, from.z, this.shot.fire[1], ult ? 2.2 : 1.6, 7);
        fx.emberRain(from.x, 1.2, from.z, this.shot.fire[1], 30, 2.2);
        if (fx.cineLight) { fx.cineLight.position.set(from.x, 1.2, from.z); fx.cineLight.color.set(this.shot.fire[1]); fx.cineLight.intensity = 5; }
        ui.flash(this.shot.fire[1], 160, 0.45);
        this.ctx.rig.kick(0.55);
        if (au) { au.kick(1.3); au.roar(c.type); }
        if (c.sandal && this.sp) this.launchSandal();
      }
    } else if (t < T.b) {
      // ---- tahap B: api berubah wujud dan melesat ----
      if (!this.shape) {
        this.shape = fx.shotShape(c.type, { from: from, to: tgt, ult: !!c.ult, life: 9 });
        ui.cineStage('serang');
      }
      var p = U.easeInOut((t - T.a) / (T.b - T.a)) * 0.84;
      this.shape.setP(p, dt, t);
      var hp = this.shape.headPos();
      fx.updateBall(dt, hp, { hide: true });
      if (hp.y < 2.6 && Math.random() < 0.6) fx.groundFire(hp.x - dir * 0.8, hp.z + (Math.random() - 0.5) * 0.8, this.shot.fire[0], this.shot.fire[1]);
      if (Math.random() < 0.3) fx.emberRain(hp.x, hp.y + 0.5, hp.z, this.shot.fire[1], 3, 1.2);
      this.ctx.rig.kick(0.012);
      var sideSign = this.camSide;
      // kamera menyamping, sedikit di depan wujud api, melihat ke belakang agar tubuhnya terlihat
      cam.px = hp.x + dir * 1.6; cam.py = Math.max(1.3, hp.y + 0.6); cam.pz = hp.z + sideSign * 5.6;
      if (c.type === 'meteor') { cam.px = hp.x + dir * 2.5; cam.py = Math.max(2, hp.y * 0.55 + 1); cam.pz = hp.z + sideSign * 9.5; }
      if (c.type === 'garuda') { cam.pz = hp.z + sideSign * 7; cam.py = hp.y + 1.2; }
      cam.lx = hp.x - dir * 1.2; cam.ly = hp.y * 0.95; cam.lz = hp.z;
    } else if (t < T.c) {
      // ---- tahap C: jurus kiper & adu tenaga ----
      if (!this.fired.skill) {
        this.fired.skill = 1;
        var at = { x: this.keepAt.x + dir * 0.2, y: this.keepAt.y, z: this.keepAt.z };
        if (this.skill) this.skillFx = fx.skillFx(c.skill, at, -dir, { life: 9 });
        else this.skillFx = fx.skillFx('', at, -dir, { life: 9 });
        ui.cineAttFade();
        ui.cineDefend({ keeper: this.kp ? this.kp.name : 'Kiper', skill: this.skill ? this.skill.name : 'Tangkapan Biasa', special: !!this.skill, sp: c.sp, kp: c.kp });
        if (au) { au.clash(); if (this.skill) au.skill(this.skill.fx); }
        if (BA.Narr && !c.pen) BA.Narr.cineClash(this.kp ? this.kp.name : '', c.skill);
        this.ctx.rig.kick(0.3);
      }
      var kk = (t - T.b) / (T.c - T.b);
      var p2 = 0.84 + kk * 0.08 + Math.sin(t * 50) * 0.004;
      if (this.shape) this.shape.setP(p2, dt, t);
      var hp2 = this.shape ? this.shape.headPos() : tgt;
      fx.updateBall(dt, hp2, { hide: true });
      if (Math.random() < 0.7) fx.burst(hp2.x + dir * 0.4, hp2.y, hp2.z, 'spark', { n: 3, c0: this.skill ? this.skill.col : '#bfe9ff' });
      if (Math.random() < 0.4) fx.emberRain(hp2.x, hp2.y + 0.4, hp2.z, this.shot.fire[1], 4, 1.6);
      this.ctx.rig.kick(0.02 + kk * 0.03);
      ui.cineClash(U.clamp(kk * 1.3, 0, 1));
      // kilat tenaga di titik benturan
      if (!this.arcFx && fx.arc) this.arcFx = fx.arc(this.skill ? this.skill.col : '#dff4ff');
      if (this.arcFx) this.arcFx.set({ x: hp2.x, y: hp2.y, z: hp2.z }, { x: this.keepAt.x + dir * 0.2, y: this.keepAt.y, z: this.keepAt.z }, dt);
      var sideS = this.camSide;
      // sudut 3/4 dari samping: wujud api dan jurus kiper beradu dalam satu bingkai
      var midx = U.lerp(hp2.x, this.keepAt.x, 0.5), midz = U.lerp(hp2.z, this.keepAt.z, 0.5);
      cam.px = midx - dir * (3.4 + kk * 0.5); cam.py = 2.1 + kk * 0.2; cam.pz = midz + sideS * 5.4;
      cam.lx = midx; cam.ly = 1.15; cam.lz = midz;
    } else {
      // ---- tahap D: hasil ----
      var kd = (t - T.c) / (T.end - T.c);
      if (!this.fired.res) { this.fired.res = 1; if (this.arcFx) { this.arcFx.dead = true; this.arcFx = null; } this.resolve(); }
      if (c.res === 'goal') {
        if (this.shape) { this.shape.setP(Math.min(1.08, 0.92 + kd * 0.4), dt, t); this.shape.fade(Math.max(0, 1 - kd * 5)); }
        var bp = { x: tgt.x + dir * U.lerp(0.2, 0.95, U.easeOut(kd)), y: U.lerp(tgt.y, 0.35, kd * kd), z: tgt.z * 0.95 };
        fx.updateBall(dt, bp, { big: 1.3 });
        // kamera garis gawang: dari luar tiang, melihat bola menembus garis dan menggetarkan jaring
        var gxl = dir * F.L / 2;
        cam.px = gxl - dir * (1.6 - kd * 0.4); cam.py = 1.25 + kd * 0.2; cam.pz = this.camSide * (F.goalW / 2 + 3.6 - kd * 0.5);
        cam.lx = gxl + dir * 0.5; cam.ly = 0.95; cam.lz = tgt.z * 0.4;
      } else {
        if (this.shape) this.shape.fade(Math.max(0, 1 - kd * 3));
        if (this.ballFly) {
          var bf = this.ballFly, tt = U.clamp(kd, 0, 1);
          fx.updateBall(dt, { x: bf.x + bf.vx * tt, y: Math.max(0.17, bf.y + bf.vy * tt - 4.9 * tt * tt), z: bf.z + bf.vz * tt }, {});
        } else if (this.keeper && this.keeper.handsBall) {
          var hb = this.keeper.handsBall(this.tmpHB || (this.tmpHB = new THREE.Vector3()));
          fx.updateBall(dt, { x: hb.x, y: hb.y, z: hb.z }, {});
        } else {
          var hold = this.keeper ? this.keeper.root.position : this.keepAt;
          fx.updateBall(dt, { x: hold.x + dir * -0.35, y: 1.0, z: hold.z }, {});
        }
        cam.px = tgt.x - dir * 5.5; cam.py = 2.2; cam.pz = this.keepAt.z + this.camSide * 4.8;
        cam.lx = this.keepAt.x; cam.ly = 1.1; cam.lz = this.keepAt.z;
      }
    }
    this.updateSandal(dt);
    if (t >= T.end && !this.done) { this.done = true; this.finish(); }
    return cam;
  };

  Cine.prototype.resolve = function () {
    var c = this.c, fx = this.ctx.fx, ui = this.ctx.ui, au = this.ctx.audio, dir = this.dir, tgt = this.target;
    if (BA.Narr) BA.Narr.cineResult(c.res, { shooter: this.sp ? this.sp.name : '', keeper: this.kp ? this.kp.name : '', skill: c.skill, type: c.type, pen: !!c.pen });
    var hp = this.shape ? this.shape.headPos() : tgt;
    if (c.res === 'goal') {
      if (this.skillFx && this.skillFx.shatter) this.skillFx.shatter();
      fx.burst(tgt.x + dir * 0.2, tgt.y, tgt.z, 'fire', { n: 90, s: 7, c0: this.shot.fire[0], c1: this.shot.fire[1], size: 1.0 });
      fx.burst(tgt.x + dir * 0.1, tgt.y, tgt.z, 'spark', { n: 50 });
      fx.burst(tgt.x - dir * 1, 2.5, tgt.z, 'confetti', { n: 110 });
      fx.burst(tgt.x + dir * 0.4, tgt.y, tgt.z, 'smoke', { n: 16, col: '#5a4a44', col2: '#2a2422' });
      fx.shockRing(tgt.x, tgt.y, tgt.z, this.shot.fire[1], -dir);
      fx.shockRing(tgt.x, 0.12, tgt.z, this.shot.fire[0]);
      fx.scorch(tgt.x - dir * 0.6, tgt.z, this.shot.fire[1], 2.4, 8);
      fx.emberRain(tgt.x, 2.2, tgt.z, this.shot.fire[1], 60, 3);
      fx.burst(tgt.x, 0.3, tgt.z, 'debris', { n: 20 });
      if (fx.cineLight) { fx.cineLightOwner = null; fx.cineLight.position.set(tgt.x, tgt.y + 0.5, tgt.z); fx.cineLight.color.set(this.shot.fire[1]); fx.cineLight.intensity = 7; }
      ui.flash('#ffffff', 220, 0.75);
      if (this.ctx.arena) this.ctx.arena.bulge(dir, tgt.z, tgt.y);
      this.ctx.rig.kick(1.1);
      if (au) au.goalBlast();
      ui.cineResult('goal');
    } else {
      if (this.shape) this.shape.fade(0.6);
      ui.flash(this.skill ? this.skill.col : '#dff4ff', 140, 0.4);
      fx.emberRain(hp.x, hp.y + 0.3, hp.z, this.shot.fire[1], 24, 2);
      if (c.res === 'catch') {
        fx.burst(hp.x, hp.y, hp.z, 'smoke', { n: 18 });
        if (this.skillFx && this.skillFx.hold) this.skillFx.hold(); else fx.burst(hp.x, hp.y, hp.z, 'steam', { n: 26 });
        if (this.skill && this.skill.fx === 'water') fx.burst(hp.x, hp.y, hp.z, 'water', { n: 40 });
        if (au) au.catchBall();
        ui.cineResult('catch');
      } else if (c.res === 'parry') {
        fx.burst(hp.x, hp.y, hp.z, 'spark', { n: 45, c0: this.skill ? this.skill.col : '#ffffff' });
        fx.burst(hp.x, hp.y, hp.z, 'smoke', { n: 10 });
        this.ballFly = { x: hp.x, y: hp.y, z: hp.z, vx: -dir * 5, vy: 4, vz: (hp.z >= 0 ? 1 : -1) * 4 };
        if (au) au.parry();
        ui.cineResult('parry');
      } else {
        var pz = (tgt.z >= 0 ? 1 : -1) * F.goalW / 2;
        fx.burst(tgt.x, Math.min(1.8, tgt.y), pz, 'spark', { n: 50, c0: '#ffffff' });
        this.ballFly = { x: tgt.x, y: Math.min(1.8, tgt.y), z: pz, vx: -dir * 6, vy: 3, vz: -Math.sign(pz || 1) * 3 };
        if (au) au.post();
        ui.cineResult('post');
      }
      this.ctx.rig.kick(0.4);
    }
  };

  Cine.prototype.launchSandal = function () {
    var R3 = BA.R3;
    var m = R3.mesh(R3.geo.box, R3.mat('#2b6cb0'), this.from.x, 0.3, this.from.z, 0.1, 0.02, 0.24);
    this.ctx.fx.scene.add(m);
    this.sandal = m;
    this.sandalV = { x: this.dir * 3 + (Math.random() - 0.5) * 3, y: 9, z: (Math.random() - 0.5) * 4 };
    this.ctx.ui.toast('Sandal terbang!');
  };
  Cine.prototype.updateSandal = function (dt) {
    if (!this.sandal) return;
    var v = this.sandalV;
    v.y -= 9.8 * dt;
    this.sandal.position.x += v.x * dt; this.sandal.position.y += v.y * dt; this.sandal.position.z += v.z * dt;
    this.sandal.rotation.x += dt * 12; this.sandal.rotation.z += dt * 9;
    if (this.sandal.position.y < 0.05) { this.sandal.position.y = 0.05; v.x *= 0.5; v.z *= 0.5; v.y = 0; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
