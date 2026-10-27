/* Bola Api Arena — simulasi pertandingan (tanpa grafis; dipakai tuan rumah & mode solo) */
(function (root) {
  'use strict';
  var BA = root.BA = root.BA || {};
  var U = BA.U, D = BA.D, F = D.FIELD;
  var DT = 1 / 60;
  var R = F.ballR;

  var ANIMS = ['idle', 'run', 'kick', 'tackle', 'stun', 'celebrate', 'gkReady', 'gkHold', 'gkDive', 'aim', 'throw', 'sad', 'shoot', 'pass', 'slide', 'throwin', 'punt', 'cheer'];
  /* lama animasi aksi ditahan sebelum kembali ke lari/diam */
  var HOLD = { kick: 0.32, shoot: 0.45, pass: 0.3, throw: 0.42, punt: 0.5, throwin: 0.42, tackle: 0.36 };
  var PHASES = ['kickoff', 'play', 'cine', 'goal', 'restart', 'pen', 'end'];
  var PEN_STATES = ['setup', 'aim', 'cine', 'after', 'done'];

  function blankInput() {
    return { mx: 0, mz: 0, sprint: false, passSeq: 0, gocekSeq: 0, switchSeq: 0, shootHeld: false, shootSeq: 0, charge: 0, zc: 0, zr: 1, skipSeq: 0, chase: false };
  }

  var Sim = BA.Sim = function (cfg) {
    cfg = cfg || {};
    this.cfg = cfg;
    // ukuran lapangan diatur paling awal: semua modul membaca D.FIELD
    D.useField(cfg.field);
    this.field = F.id; this.n = F.n;
    this.mode = cfg.mode || 'match';
    this.rules = D.applyRuleset(Object.assign(D.defaultRules(), cfg.rules || {}));
    this.cards = [];
    this.rng = U.rng(cfg.seed || (Date.now() & 0xffffff));
    this.arena = D.arenaById[cfg.arena] || D.ARENAS[0];
    this.weather = D.weatherById[cfg.weather] || D.WEATHERS[0];
    this.ballDef = D.ballById[cfg.ball] || D.BALLS[0];
    this.humans = cfg.humans || [true, false];
    this.teams = D.resolveKits(D.sanitizeTeam(cfg.teams && cfg.teams[0]), D.sanitizeTeam(cfg.teams && cfg.teams[1]));
    this.t = 0; this.realT = 0; this.acc = 0;
    this.clock = this.rules.dur;
    this.score = [0, 0];
    this.sem = [20, 20];
    this.events = [];
    this.evId = 0;
    this.phase = 'kickoff'; this.phaseT = 0;
    this.timeScale = 1; this.tsTarget = 1;
    this.players = [];
    this.ball = { x: 0, y: R, z: 0, vx: 0, vy: 0, vz: 0, owner: null, last: null, holdT: 0, petirT: 0, pass: null, noTouch: null, noTouchT: 0, stuckT: 0, inNet: 0 };
    this.inputs = [blankInput(), blankInput()];
    this.hs = [{ passSeq: 0, gocekSeq: 0, switchSeq: 0, shootSeq: 0, shootHeld: false, skipSeq: 0 }, { passSeq: 0, gocekSeq: 0, switchSeq: 0, shootSeq: 0, shootHeld: false, skipSeq: 0 }];
    this.active = [null, null];
    this.swT = [0, 0];
    this.aim = null;
    this.cine = null; this.cineId = 0; this.cineWait = 0; this.cineDone = false;
    this.revealed = [{}, {}];
    this.corners = [0, 0];
    this.golden = false; this.goldenT = 0;
    this.pen = null;
    this.shootout = null;
    this.winner = -1;
    this.chaser = [null, null]; this.presser = [null, null]; this.cover = [null, null];
    this.petirTimer = this.rng.range(25, 45);
    this.wind = { x: 0, z: 0 };
    var wmag = D.wv(this.weather, 'wind', 0) + (this.arena.windBias || 0) * (this.weather.id === 'angin' ? 0.3 : 0.35);
    var wa = this.rng() * U.TAU;
    this.wind.x = Math.cos(wa) * wmag; this.wind.z = Math.sin(wa) * wmag * 0.6;
    this.stats = [this.blankStats(), this.blankStats()];
    this.goals = [];
    this.bestShot = null;
    this.sanityFails = 0;
    this.restartDelay = 0.9;
    this.buildPlayers();
    if (this.mode === 'match') { this.setupKickoff(this.rng() < 0.5 ? 0 : 1, true); }
    else if (this.mode === 'penalty') { this.startShootout(true); }
    else if (this.mode === 'practice') { this.startPractice(); }
  };
  Sim.DT = DT;
  Sim.ANIMS = ANIMS;
  Sim.PHASES = PHASES;
  Sim.PEN_STATES = PEN_STATES;
  Sim.HOLD = HOLD;
  Sim.blankInput = blankInput;
  var S = Sim.prototype;

  S.blankStats = function () { return { shots: 0, onTarget: 0, goals: 0, saves: 0, special: 0, tackles: 0, passes: 0, best: 0, offsides: 0, fouls: 0 }; };
  S.dirOf = function (team) { return team === 0 ? 1 : -1; };
  S.oppGoalX = function (team) { return this.dirOf(team) * F.L / 2; };
  S.ownGoalX = function (team) { return -this.dirOf(team) * F.L / 2; };
  S.emit = function (e) { e.id = ++this.evId; this.events.push(e); if (this.events.length > 200) this.events.splice(0, 100); };
  S.drainEvents = function () { var e = this.events; this.events = []; return e; };
  /* komentar kini dibuat narator di sisi klien dari event terstruktur (bahasa pilihan masing-masing pemain) */
  S.say = function () { };
  S.diffOf = function (team) { return this.humans[team] ? 1 : U.clamp(U.num(this.rules.diff, 1), 0, 2); };
  S.semMul = function () { return D.bv(this.ballDef, 'spirit'); };
  S.addSem = function (team, v) { this.sem[team] = U.clamp(this.sem[team] + v * this.semMul(), 0, 100); };
  S.pl = function (team, idx) { return (idx >= 0 && idx < this.n) ? (this.players[team * this.n + idx] || null) : null; };
  S.code = function (p) { return p ? p.team * this.n + p.idx : -1; };
  S.fromCode = function (c) { return (c >= 0 && c < this.n * 2) ? this.players[c] : null; };

  /* ---------------- pemain ---------------- */
  S.buildPlayers = function () {
    var self = this;
    var n = this.n;
    for (var t = 0; t < 2; t++) {
      var team = this.teams[t];
      var slots = D.formation(team.players.slice(0, n));
      for (var i = 0; i < n; i++) {
        var c = team.players[i];
        var p = {
          team: t, idx: i, cfg: c, role: c.role, name: c.name, num: c.num,
          st: D.playerStats(c, team.level), shot: D.shotById[c.shot] || D.SHOTS[0], style: D.styleById[c.style] || D.STYLES[0],
          x: 0, z: 0, vx: 0, vz: 0, dvx: 0, dvz: 0, facing: t === 0 ? Math.PI / 2 : -Math.PI / 2,
          anim: 'idle', animT: 0, stunT: 0, kickCD: 0, tackleCD: 0, gocekT: 0, gocekCD: 0, slideT: 0, slid: false,
          stamina: 100, sprint: false, aiT: this.rng() * 0.2, recvAt: -9, fromPass: false, gkHold: false, gkHoldT: 0,
          hidden: false, slot: slots[i] || { fx: 0.4, fz: 0 }, celebrate: false, tackled: null, wantSprint: false
        };
        if (t === 1 && this.mode === 'practice' && this.cfg.practiceStyle && i === 0) p.style = D.styleById[this.cfg.practiceStyle] || p.style;
        this.players.push(p);
      }
    }
    this.players.forEach(function (p) { var h = self.homePos(p, 0); p.x = h.x; p.z = h.z; });
  };

  S.maxSpeed = function (p, sprint) {
    var v = (4.85 + (p.st.lari - 50) * 0.05) * (1 + (F.ss - 1) * 0.25);
    if (sprint && p.stamina > 8) v *= 1.4;
    if (this.ball.owner === p) v *= 0.9 * (0.9 + 0.1 * D.bv(this.ballDef, 'ctrl'));
    if (p.stamina < 12) v *= 0.86;
    if (p.gocekT > 0.2) v *= 1.22;
    if (p.role === 'GK') v = Math.max(v, 5.6);
    return v;
  };

  /* posisi formasi; mode: 1 menyerang, -1 bertahan, 0 netral */
  S.homePos = function (p, mode) {
    var dir = this.dirOf(p.team), b = this.ball;
    var tac = this.teams[p.team].tactic;
    var shift = mode > 0 ? 0.11 : (mode < 0 ? -0.07 : 0);
    if (tac === 'serang') shift += 0.06; else if (tac === 'bertahan') shift -= 0.07;
    var ballProg = (b.x * dir + F.L / 2) / F.L;
    var fx = p.role === 'GK' ? 0.02 : U.clamp(p.slot.fx + shift + (ballProg - 0.5) * 0.36, 0.06, 0.9);
    var x = -dir * F.L / 2 + dir * fx * F.L;
    var baseZ = p.slot.fz * F.W * dir;
    var z = baseZ + (b.z - baseZ) * 0.22;
    return { x: x, z: U.clamp(z, -F.W / 2 + 1, F.W / 2 - 1) };
  };

  S.setFacingTo = function (p, x, z) {
    var dx = x - p.x, dz = z - p.z;
    if (dx * dx + dz * dz > 1e-4) p.facing = Math.atan2(dx, dz);
  };
  S.faceVec = function (p) { return [Math.sin(p.facing), Math.cos(p.facing)]; };

  /* ---------------- tahap: kickoff ---------------- */
  S.setupKickoff = function (team, first) {
    var self = this, b = this.ball;
    this.phase = 'kickoff'; this.phaseT = 0; this.kickTeam = team;
    this.aim = null; this.tsTarget = 1; this.timeScale = 1;
    b.x = 0; b.z = 0; b.y = R; b.vx = b.vy = b.vz = 0; b.owner = null; b.pass = null; b.holdT = 0; b.inNet = 0; b.noTouch = null; b.stuckT = 0; b.last = null;
    var kicker = null;
    this.players.forEach(function (p) {
      p.vx = p.vz = p.dvx = p.dvz = 0; p.stunT = 0; p.slideT = 0; p.gkHold = false; p.celebrate = false; p.anim = 'idle'; p.kickCD = 0; p.throwIn = false;
      if (p.hidden) return;
      var dir = self.dirOf(p.team);
      var fx = Math.min(p.slot.fx, 0.42);
      var x = -dir * F.L / 2 + dir * fx * F.L;
      var z = p.slot.fz * F.W * dir;
      if (p.team !== team && Math.abs(x) < F.circle + 0.5) x = -dir * (F.circle + 0.8);
      p.x = x; p.z = z; p.facing = Math.atan2(dir, 0);
    });
    var cands = this.players.filter(function (p) { return p.team === team && p.role !== 'GK' && !p.hidden; });
    cands.sort(function (a, c) { return c.slot.fx - a.slot.fx; });
    kicker = cands[0] || this.pl(team, 1);
    var dir = this.dirOf(team);
    kicker.x = -dir * 0.55; kicker.z = 0; kicker.facing = Math.atan2(dir, 0);
    if (cands[1]) { cands[1].x = -dir * 3.5 * F.ss; cands[1].z = (cands[1].slot.fz >= 0 ? 4 : -4) * F.ss; }
    this.kicker = kicker;
    if (this.humans[team]) this.active[team] = kicker;
    if (first) this.emit({ k: 'kickoffFirst' });
  };

  /* ---------------- update utama ---------------- */
  S.update = function (dtReal) {
    if (!(dtReal > 0)) return;
    this.acc += Math.min(dtReal, 0.1);
    var n = 0;
    while (this.acc >= DT && n < 6) { this.step(DT); this.acc -= DT; n++; }
    if (n >= 6) this.acc = 0;
  };

  S.step = function (dt) {
    this.realT += dt;
    this.timeScale = U.damp(this.timeScale, this.tsTarget, 10, dt);
    if (Math.abs(this.timeScale - this.tsTarget) < 0.01) this.timeScale = this.tsTarget;
    var sdt = dt * this.timeScale;
    this.t += sdt;
    this.phaseT += dt;
    switch (this.phase) {
      case 'kickoff':
        this.animIdle(dt);
        if (this.phaseT >= 1.25) {
          this.phase = 'play'; this.phaseT = 0;
          this.emit({ k: 'whistle' });
          if (this.kicker) this.givePossession(this.kicker, true);
        }
        break;
      case 'play': this.stepPlay(sdt, dt); break;
      case 'cine':
        this.cineWait += dt;
        if (this.cfg.autoCine || this.cineDone || this.cineWait > 9) this.applyDuelResult();
        break;
      case 'goal': this.stepGoal(dt); break;
      case 'restart':
        this.animIdle(dt);
        if (this.phaseT >= this.restartDelay) { this.phase = 'play'; this.phaseT = 0; this.emit({ k: 'whistle', short: 1 }); }
        break;
      case 'pen': this.stepPen(dt); break;
      default: break;
    }
    this.sanity();
  };

  S.finishCine = function (id) { if (this.phase === 'cine' && this.cine && (id == null || id === this.cine.id)) this.cineDone = true; };

  S.animIdle = function (dt) {
    var self = this;
    this.players.forEach(function (p) {
      p.vx = U.damp(p.vx, 0, 8, dt); p.vz = U.damp(p.vz, 0, 8, dt);
      if (p.throwIn) p.anim = 'throwin';
      else if (!p.celebrate && p.anim !== 'gkHold') p.anim = p.role === 'GK' && !p.gkHold ? 'gkReady' : (p.gkHold ? 'gkHold' : 'idle');
      if (p.gkHold) self.holdBallAt(p);
    });
  };

  S.stepPlay = function (sdt, dt) {
    var self = this, b = this.ball;
    this.players.forEach(function (p) {
      p.animT += sdt;
      if (p.stunT > 0) p.stunT -= sdt;
      if (p.kickCD > 0) p.kickCD -= sdt;
      if (p.tackleCD > 0) p.tackleCD -= sdt;
      if (p.gocekT > 0) p.gocekT -= sdt;
      if (p.gocekCD > 0) p.gocekCD -= sdt;
      p.dvx = 0; p.dvz = 0; p.sprint = false;
    });
    if (b.noTouchT > 0) { b.noTouchT -= sdt; if (b.noTouchT <= 0) b.noTouch = null; }

    for (var t = 0; t < 2; t++) if (this.humans[t]) this.updateActive(t, sdt);
    this.aiUpdate(sdt);
    for (t = 0; t < 2; t++) if (this.humans[t]) this.humanControl(t, sdt, dt);
    if (this.phase !== 'play') return; // aksi pemain bisa memicu sinematik
    this.movePlayers(sdt);
    this.updateBall(sdt);
    if (this.phase !== 'play') return;
    this.rulesTick(sdt, dt);
  };

  /* ---------------- gerak pemain ---------------- */
  S.movePlayers = function (dt) {
    var ps = this.players, i, j, p, q;
    var stamDrain = 14 * D.wv(this.weather, 'stam');
    for (i = 0; i < ps.length; i++) {
      p = ps[i];
      if (p.hidden) continue;
      if (p.slideT > 0) {
        p.slideT -= dt;
        var car = this.ball.owner;
        if (!p.slid && car && car.team !== p.team && !car.gkHold && !car.throwIn && U.dist(p.x, p.z, car.x, car.z) < 1.05) {
          p.slid = true;
          this.resolveTackle(p, car, true);
        }
        p.vx *= Math.pow(0.18, dt); p.vz *= Math.pow(0.18, dt);
        if (p.slideT <= 0 && !p.slid) { p.stunT = Math.max(p.stunT, 0.25); }
      } else if (p.stunT > 0 || p.gkHold || p.throwIn) {
        p.vx = U.damp(p.vx, 0, 10, dt); p.vz = U.damp(p.vz, 0, 10, dt);
      } else {
        var acc = (p.role === 'GK' ? 26 : 19) * dt;
        var ex = p.dvx - p.vx, ez = p.dvz - p.vz, el = Math.sqrt(ex * ex + ez * ez);
        if (el > acc) { ex = ex / el * acc; ez = ez / el * acc; }
        p.vx += ex; p.vz += ez;
      }
      p.x += p.vx * dt; p.z += p.vz * dt;
      var sp = Math.sqrt(p.vx * p.vx + p.vz * p.vz);
      if (p.sprint && sp > 3) p.stamina = Math.max(0, p.stamina - stamDrain * dt);
      else p.stamina = Math.min(100, p.stamina + 7 * dt);
      // arah hadap
      if (p.slideT <= 0 && p.stunT <= 0 && !p.throwIn) {
        if (sp > 0.6) p.facing = U.angLerp(p.facing, Math.atan2(p.vx, p.vz), Math.min(1, dt * 12));
        else if (!p.gkHold && this.ball.owner !== p) {
          var want = Math.atan2(this.ball.x - p.x, this.ball.z - p.z);
          p.facing = U.angLerp(p.facing, want, Math.min(1, dt * 5));
        }
      }
      // animasi dasar
      if (p.slideT > 0) p.anim = 'slide';
      else if (p.throwIn) p.anim = 'throwin';
      else if (HOLD[p.anim] && p.animT < HOLD[p.anim]) { /* tahan animasi aksi (tendang, umpan, lempar, tekel) */ }
      else if (p.stunT > 0) p.anim = 'stun';
      else if (p.gkHold) p.anim = 'gkHold';
      else if (this.aim && this.aim.p === p) p.anim = 'aim';
      else if (sp > 0.7) p.anim = 'run';
      else p.anim = p.role === 'GK' ? 'gkReady' : 'idle';
    }
    // pemisahan antar pemain
    for (i = 0; i < ps.length; i++) {
      p = ps[i]; if (p.hidden) continue;
      for (j = i + 1; j < ps.length; j++) {
        q = ps[j]; if (q.hidden) continue;
        var dx = q.x - p.x, dz = q.z - p.z, d2 = dx * dx + dz * dz;
        if (d2 < 0.56 && d2 > 1e-6) {
          var d = Math.sqrt(d2), push = (0.75 - d) * 0.5;
          dx /= d; dz /= d;
          p.x -= dx * push; p.z -= dz * push; q.x += dx * push; q.z += dz * push;
        } else if (d2 <= 1e-6) { p.x += 0.05; }
      }
    }
    // batas lapangan
    for (i = 0; i < ps.length; i++) {
      p = ps[i]; if (p.hidden) continue;
      p.x = U.clamp(p.x, -F.L / 2 - 0.7, F.L / 2 + 0.7);
      p.z = U.clamp(p.z, -F.W / 2 - 0.7, F.W / 2 + 0.7);
      if (Math.abs(p.z) < F.goalW / 2 + 0.35 && Math.abs(p.x) > F.L / 2 - 0.25) p.x = Math.sign(p.x) * (F.L / 2 - 0.25);
    }
  };

  /* ---------------- bola ---------------- */
  S.holdBallAt = function (p) {
    var b = this.ball, f = this.faceVec(p);
    b.x = p.x + f[0] * 0.32; b.z = p.z + f[1] * 0.32; b.y = 1.05;
    b.vx = p.vx; b.vz = p.vz; b.vy = 0;
  };

  S.updateBall = function (dt) {
    var b = this.ball, o = b.owner;
    if (b.petirT > 0) b.petirT -= dt;
    if (o) {
      b.holdT += dt;
      if (o.gkHold) { this.holdBallAt(o); return; }
      if (o.throwIn) { var tf = this.faceVec(o); b.x = o.x + tf[0] * 0.05; b.z = o.z + tf[1] * 0.05; b.y = 2.05; b.vx = b.vy = b.vz = 0; return; }
      var f = this.faceVec(o), sp = Math.sqrt(o.vx * o.vx + o.vz * o.vz);
      var off = 0.5 + Math.min(0.25, sp * 0.03) + Math.sin(this.t * (6 + sp)) * 0.05 / D.bv(this.ballDef, 'ctrl');
      var tx = o.x + f[0] * off, tz = o.z + f[1] * off;
      b.vx = (tx - b.x) / Math.max(dt, 1e-3) * 0.6; b.vz = (tz - b.z) / Math.max(dt, 1e-3) * 0.6;
      b.x = U.lerp(b.x, tx, 0.6); b.z = U.lerp(b.z, tz, 0.6); b.y = R; b.vy = 0;
      if (Math.abs(b.x) > F.L / 2 + R * 0.5 && Math.abs(b.z) < F.goalW / 2 - R && this.phase === 'play') {
        this.freeGoal(b.x > 0 ? 0 : 1);
        return;
      }
      this.checkBounds(dt, true);
      return;
    }
    var px = b.x, pz = b.z, py = b.y;
    var bounceK = this.arena.bounce * D.bv(this.ballDef, 'bounce') * D.wv(this.weather, 'bounceMul');
    if (b.y > R + 0.001 || b.vy > 0) b.vy -= 9.8 * dt;
    if (b.y > 0.35) {
      var ws = D.bv(this.ballDef, 'wind') * 0.55;
      b.vx += this.wind.x * ws * dt; b.vz += this.wind.z * ws * dt;
      var drag = Math.pow(0.985, dt * 60); b.vx *= drag; b.vz *= drag;
    }
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    if (b.y <= R) {
      b.y = R;
      if (b.vy < -1.5) {
        b.vy = -b.vy * bounceK;
        if (D.bv(this.ballDef, 'erratic', 0)) { var a = this.rng.range(-0.5, 0.5); var c = Math.cos(a), s = Math.sin(a); var nx = b.vx * c - b.vz * s; b.vz = b.vx * s + b.vz * c; b.vx = nx; }
        this.emit({ k: 'bounce', v: Math.min(1, -b.vy / 8) });
      } else b.vy = 0;
    }
    if (b.y <= R + 0.02) {
      var spd = Math.sqrt(b.vx * b.vx + b.vz * b.vz);
      var dec = this.arena.fric * D.wv(this.weather, 'fric') * dt;
      if (spd <= dec) { b.vx = 0; b.vz = 0; } else { b.vx *= (spd - dec) / spd; b.vz *= (spd - dec) / spd; }
    }
    if (b.pass) { b.pass.t += dt; if (b.pass.t > 3) b.pass = null; }
    this.collideGoals(px, py, pz);
    if (this.phase !== 'play') return;
    this.checkBounds(dt, false);
    if (this.phase !== 'play') return;
    this.captureBall();
  };

  S.collideGoals = function (px, py, pz) {
    var b = this.ball, rp = 0.07;
    for (var s = -1; s <= 1; s += 2) {
      var gx = s * F.L / 2;
      // tiang
      for (var k = -1; k <= 1; k += 2) {
        var gz = k * F.goalW / 2;
        var dx = b.x - gx, dz = b.z - gz, d = Math.sqrt(dx * dx + dz * dz);
        if (d < R + rp && b.y < F.goalH + R && d > 1e-5) {
          var nx = dx / d, nz = dz / d, vn = b.vx * nx + b.vz * nz;
          if (vn < 0) { b.vx -= 1.7 * vn * nx; b.vz -= 1.7 * vn * nz; this.emit({ k: 'post', soft: 1 }); }
          b.x = gx + nx * (R + rp + 0.01); b.z = gz + nz * (R + rp + 0.01);
        }
      }
      // mistar
      if (Math.abs(b.z) < F.goalW / 2 && Math.abs(b.x - gx) < R + rp && Math.abs(b.y - F.goalH) < R + rp) {
        if (py < F.goalH) { b.vy = -Math.abs(b.vy) * 0.6; b.y = F.goalH - R - rp; } else { b.vy = Math.abs(b.vy) * 0.6; b.y = F.goalH + R + rp; }
        b.vx *= -0.5;
        this.emit({ k: 'post', soft: 1 });
      }
      // gol saat main (bola liar, pantulan, tendangan lemah)
      var inside = s * b.x > F.L / 2 + R * 0.5;
      var was = s * px <= F.L / 2 + R * 0.5;
      if (inside && was && this.phase === 'play') {
        var tt = (s * F.L / 2 - px) / ((b.x - px) || 1e-6);
        var cz = pz + (b.z - pz) * U.clamp(tt, 0, 1), cy = py + (b.y - py) * U.clamp(tt, 0, 1);
        if (Math.abs(cz) < F.goalW / 2 - R * 0.5 && cy < F.goalH - R * 0.3) {
          var scorer = s === 1 ? 0 : 1;
          this.freeGoal(scorer);
          return;
        }
      }
      // jaring dari luar (samping/belakang)
      var inNetBox = s * b.x > F.L / 2 && s * b.x < F.L / 2 + F.goalD && Math.abs(b.z) < F.goalW / 2 + 0.05 && b.y < F.goalH;
      if (inNetBox && this.phase === 'play' && !b.inNet) {
        if (Math.abs(pz) >= F.goalW / 2) { b.z = Math.sign(pz) * (F.goalW / 2 + 0.06); b.vz = -b.vz * 0.4; }
        else if (s * px >= F.L / 2 + F.goalD) { b.x = s * (F.L / 2 + F.goalD + 0.06); b.vx = -b.vx * 0.4; }
        else { b.x = s * (F.L / 2 - 0.02); b.vx = -s * Math.abs(b.vx) * 0.3; }
      }
    }
  };

  S.checkBounds = function (dt, owned) {
    var b = this.ball;
    if (this.rules.bound === 'keluar') {
      var outZ = Math.abs(b.z) > F.W / 2 + R;
      var outX = Math.abs(b.x) > F.L / 2 + R && !(Math.abs(b.z) < F.goalW / 2 && b.y < F.goalH);
      if (owned && (outZ || outX)) {
        // pembawa bola tertahan di garis
        b.z = U.clamp(b.z, -F.W / 2 + 0.05, F.W / 2 - 0.05);
        b.x = U.clamp(b.x, -F.L / 2 + 0.05, F.L / 2 - 0.05);
        return;
      }
      if (outZ) { this.outBall('side'); return; }
      if (outX) { this.outBall('end'); return; }
      return;
    }
    // pagar pantul
    var wz = F.W / 2 + 1.15, wx = F.L / 2 + 1.5;
    if (Math.abs(b.z) > wz - R) { b.z = Math.sign(b.z) * (wz - R); b.vz = -b.vz * 0.7; b.vx *= 0.9; if (!owned) this.emit({ k: 'wall' }); }
    if (Math.abs(b.z) > F.goalW / 2 + 0.05) {
      if (Math.abs(b.x) > wx - R) { b.x = Math.sign(b.x) * (wx - R); b.vx = -b.vx * 0.7; b.vz *= 0.9; if (!owned) this.emit({ k: 'wall' }); }
    } else if (Math.abs(b.x) > F.L / 2 + F.goalD - R) {
      // di belakang gawang: dinding jaring bagian belakang
      b.x = Math.sign(b.x) * (F.L / 2 + F.goalD - R); b.vx = -b.vx * 0.5;
    }
    // atap jaring gawang: bola dari atas memantul lalu turun ke arah lapangan
    if (!owned && Math.abs(b.z) < F.goalW / 2 && Math.abs(b.x) > F.L / 2 && Math.abs(b.x) < F.L / 2 + F.goalD + 0.05 && b.y < F.goalH + R && b.y > F.goalH - 0.25 && b.vy <= 0) {
      b.y = F.goalH + R; b.vy = Math.abs(b.vy) * 0.3 + 0.8; b.vx = -Math.sign(b.x) * 2.5;
    }
    if (b.y > 6.5 && !owned) { b.vy = Math.min(b.vy, 0); }
  };

  S.outBall = function (kind) {
    var b = this.ball, last = b.last;
    var lastTeam = last ? last.team : 0;
    if (kind === 'side') {
      var team = 1 - lastTeam;
      var sx = U.clamp(b.x, -F.L / 2 + 1, F.L / 2 - 1), sz = Math.sign(b.z) * (F.W / 2 - 0.25);
      this.restartWith(team, sx, sz, 'throw');
    } else {
      var side = Math.sign(b.x);           // gawang di sisi ini
      var defTeam = side === 1 ? 1 : 0;    // tim yang mempertahankan gawang ini
      var attTeam = 1 - defTeam;
      if (lastTeam === defTeam) {
        this.awardCorner(attTeam, side, Math.sign(b.z || 1));
      } else {
        var gk = this.pl(defTeam, 0);
        this.resetBallFree();
        gk.x = side * (F.L / 2 - 1.2); gk.z = 0;
        this.givePossession(gk, true);
        this.phase = 'restart'; this.phaseT = 0; this.restartDelay = 0.8;
        this.emit({ k: 'whistle', short: 1 });
        this.emit({ k: 'restart', kind: 'goalkick', team: defTeam });
      }
    }
  };

  S.awardCorner = function (attTeam, side, zs) {
    this.corners[attTeam]++;
    this.emit({ k: 'corner', team: attTeam, n: this.corners[attTeam] });
    if (this.rules.tigaPojok && this.corners[attTeam] >= 3) {
      this.corners[attTeam] = 0;
      this.startPenaltyKick(attTeam);
      return;
    }
    this.restartWith(attTeam, side * (F.L / 2 - 0.3), (zs || 1) * (F.W / 2 - 0.3), 'corner');
  };

  /* lemparan ke dalam: bola dilempar dari atas kepala ke kawan */
  S.doThrowIn = function (p, dx, dz) {
    if (this.ball.owner !== p || !p.throwIn) return;
    var self = this, best = null, bs = -1e9;
    var hint = Math.sqrt((dx || 0) * (dx || 0) + (dz || 0) * (dz || 0));
    this.players.forEach(function (q) {
      if (q.team !== p.team || q === p || q.hidden || q.role === 'GK') return;
      var d = U.dist(p.x, p.z, q.x, q.z);
      if (d > 24 || d < 2) return;
      var open = 9;
      self.players.forEach(function (o) { if (o.team !== p.team && !o.hidden) open = Math.min(open, U.dist(o.x, o.z, q.x, q.z)); });
      var s = open * 0.5 - Math.abs(d - 9) * 0.1 + self.rng() * 0.6;
      if (hint > 0.2) s += ((q.x - p.x) * dx + (q.z - p.z) * dz) / (d * hint) * 3;
      if (s > bs) { bs = s; best = q; }
    });
    var tx, tz;
    if (best) { tx = best.x + best.vx * 0.5; tz = best.z + best.vz * 0.5; }
    else { tx = p.x + this.dirOf(p.team) * 6; tz = p.z - Math.sign(p.z) * 7; }
    var ddx = tx - p.x, ddz = tz - p.z, d2 = Math.sqrt(ddx * ddx + ddz * ddz) || 1;
    var v = U.clamp(5 + d2 * 0.55, 7, 15);
    this.setFacingTo(p, tx, tz);
    this.kickFree(p, ddx / d2 * v, 2.6 + d2 * 0.06, ddz / d2 * v, best, 'throwin');
    this.emit({ k: 'pass', p: this.code(p), to: this.code(best), throwin: 1 });
    if (best && this.humans[p.team]) this.active[p.team] = best;
  };

  S.resetBallFree = function () {
    var b = this.ball;
    b.owner = null; b.pass = null; b.vx = b.vy = b.vz = 0; b.y = R; b.holdT = 0; b.noTouch = null;
    if (this.aim) { this.aim = null; this.tsTarget = 1; }
  };

  S.restartWith = function (team, x, z, kind) {
    var b = this.ball;
    this.players.forEach(function (p) { p.throwIn = false; });
    this.resetBallFree();
    b.x = x; b.z = z;
    var best = null, bd = 1e9;
    this.players.forEach(function (p) {
      if (p.team !== team || p.role === 'GK' || p.hidden) return;
      var d = U.dist2(p.x, p.z, x, z);
      if (d < bd) { bd = d; best = p; }
    });
    if (!best) best = this.pl(team, 1);
    var cx = -Math.sign(x) * 0.4, cz = -Math.sign(z) * 0.4;
    best.x = x + (kind === 'corner' ? cx : 0); best.z = z + cz;
    best.vx = best.vz = 0;
    this.setFacingTo(best, 0, 0);
    if (kind === 'throw') {
      best.z = Math.sign(z) * (F.W / 2 + 0.25);
      best.facing = Math.atan2(0, -Math.sign(z) || 1);
      best.throwIn = true; best.throwT = 0;
    }
    var self = this;
    if (kind === 'freekick') {
      // lawan mundur 9,15 m (pagar betis) ke arah gawangnya sendiri
      var wall = Math.min(9.15, F.circle + 1), gx = this.oppGoalX(team);
      this.players.forEach(function (p) {
        if (p.team === team || p.hidden || p.role === 'GK') return;
        var d = U.dist(p.x, p.z, x, z);
        if (d < wall) { var ax = gx - x, az = -z * 0.3, al = Math.sqrt(ax * ax + az * az) || 1; p.x = U.clamp(x + ax / al * wall + (self.rng() - 0.5) * 2, -F.L / 2 + 0.5, F.L / 2 - 0.5); p.z = U.clamp(z + az / al * wall + (self.rng() - 0.5) * 4, -F.W / 2 + 0.5, F.W / 2 - 0.5); p.vx = p.vz = 0; }
      });
    }
    this.players.forEach(function (p) { if (p !== best && U.dist(p.x, p.z, x, z) < 2.5) { p.x -= Math.sign(x) * 1.5; p.z -= Math.sign(z) * 2.6; } });
    this.givePossession(best, true);
    this.phase = 'restart'; this.phaseT = 0; this.restartDelay = kind === 'freekick' ? 1.1 : 0.85;
    this.emit({ k: 'restart', kind: kind, team: team });
  };

  S.captureBall = function () {
    var b = this.ball, ps = this.players, best = null, bestScore = -1e9;
    if (b.y > 2.5) return;
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      if (p.hidden || p.stunT > 0 || p.kickCD > 0) continue;
      if (b.noTouch === p) continue;
      var gkBox = p.role === 'GK' && this.inOwnBox(p, 0.3);
      var reach = gkBox ? 1.2 : ((b.pass && b.pass.to === p) ? 0.95 : 0.7);
      if (p.slideT > 0) reach = 0.9;
      var hmax = gkBox ? 2.45 : 0.95;
      if (b.y > hmax) continue;
      var d = U.dist(p.x, p.z, b.x, b.z);
      if (d > reach) continue;
      var sc = -d + (b.pass && b.pass.to === p ? 1 : 0) + (gkBox ? 0.6 : 0);
      if (sc > bestScore) { bestScore = sc; best = p; }
    }
    if (!best) return;
    var spd = Math.sqrt(b.vx * b.vx + b.vz * b.vz);
    var last = b.last;
    if (best.role !== 'GK' && spd > 14 && last && last.team !== best.team && this.rng() < 0.45) {
      // gagal dikontrol: bola memantul
      var a = this.rng.range(-1.2, 1.2), c = Math.cos(a), s = Math.sin(a);
      var nx = b.vx * c - b.vz * s, nz = b.vx * s + b.vz * c;
      b.vx = nx * 0.45; b.vz = nz * 0.45; b.vy = Math.max(b.vy, 1.5);
      b.noTouch = best; b.noTouchT = 0.35; b.last = best;
      this.emit({ k: 'deflect' });
      return;
    }
    if (best.role === 'GK' && spd > 19 && this.rng() < 0.35) {
      var kdir = this.dirOf(best.team);
      b.vx = kdir * this.rng.range(5, 8); b.vz = this.rng.range(-6, 6); b.vy = 2.5;
      b.noTouch = best; b.noTouchT = 0.4; b.last = best;
      this.emit({ k: 'save', kind: 'parry', team: best.team, small: 1 });
      return;
    }
    this.givePossession(best, false);
  };

  S.inOwnBox = function (p, extra) {
    var gx = this.ownGoalX(p.team);
    extra = extra || 0;
    return Math.abs(p.x - gx) < F.boxL + extra && Math.abs(p.z) < F.boxW / 2 + extra;
  };

  S.givePossession = function (p, silent) {
    var b = this.ball, prev = b.last;
    var fromMatePass = b.pass && b.pass.from && b.pass.from.team === p.team && b.pass.from !== p;
    if (fromMatePass && b.pass.off && b.pass.to === p && this.phase === 'play') { b.pass = null; this.offsideCall(p); return; }
    b.owner = p; b.vx = b.vy = b.vz = 0; b.pass = null; b.holdT = 0; b.noTouch = null; b.stuckT = 0;
    b.last = p;
    if (p.role === 'GK' && this.inOwnBox(p, 0.5)) {
      p.gkHold = true; p.gkHoldT = 0; p.anim = 'gkHold'; this.holdBallAt(p);
    } else { b.y = R; }
    if (fromMatePass) { p.recvAt = this.t; p.fromPass = true; this.addSem(p.team, 2); this.stats[p.team].passes++; }
    else { p.fromPass = false; }
    if (!silent && prev && prev.team !== p.team && p.role !== 'GK') this.emit({ k: 'steal', team: p.team });
    if (this.humans[p.team] && p.role !== 'GK') this.active[p.team] = p;
    if (this.aim && this.aim.p !== p) { this.aim = null; this.tsTarget = 1; }
  };

  S.kickFree = function (p, vx, vy, vz, target, anim) {
    var b = this.ball;
    b.owner = null; b.last = p; b.holdT = 0;
    var f = this.faceVec(p);
    if (p.throwIn) { b.x = p.x + f[0] * 0.25; b.z = p.z + f[1] * 0.25; b.y = 2.1; }
    else if (!p.gkHold) { b.x = p.x + f[0] * 0.45; b.z = p.z + f[1] * 0.45; b.y = R + 0.01; }
    p.gkHold = false; p.throwIn = false;
    b.vx = vx; b.vy = vy; b.vz = vz;
    b.pass = target ? { to: target, from: p, t: 0 } : null;
    b.noTouch = p; b.noTouchT = 0.3;
    p.kickCD = 0.28; p.anim = anim || 'shoot'; p.animT = 0;
    if (this.aim && this.aim.p === p) { this.aim = null; this.tsTarget = 1; }
  };

  /* ---------------- aksi ---------------- */
  S.pickReceiver = function (p, dx, dz) {
    var dl = Math.sqrt(dx * dx + dz * dz);
    if (dl < 0.2) { var f = this.faceVec(p); dx = f[0]; dz = f[1]; dl = 1; }
    dx /= dl; dz /= dl;
    var best = null, bestS = -1e9, self = this, dir = this.dirOf(p.team);
    this.players.forEach(function (q) {
      if (q.team !== p.team || q === p || q.hidden || q.stunT > 0) return;
      var vx = q.x - p.x, vz = q.z - p.z, d = Math.sqrt(vx * vx + vz * vz);
      if (d < 2) return;
      var cos = (vx * dx + vz * dz) / d;
      var open = 8, lane = 4;
      self.players.forEach(function (o) {
        if (o.team === p.team || o.hidden) return;
        open = Math.min(open, U.dist(o.x, o.z, q.x, q.z));
        lane = Math.min(lane, self.segDist(o.x, o.z, p.x, p.z, q.x, q.z));
      });
      var s = cos * 3 + Math.min(open, 6) * 0.25 + Math.min(lane, 3) * 0.45 - Math.abs(d - 11) * 0.05 + (vx * dir) * 0.03;
      if (q.role === 'GK') s -= 3;
      if (cos < -0.1) s -= 2.5;
      if (self.rules.pro && self.isOffside(p, q)) s -= 4;
      if (s > bestS) { bestS = s; best = q; }
    });
    return best;
  };

  S.segDist = function (px, pz, ax, az, bx, bz) {
    var vx = bx - ax, vz = bz - az, wx = px - ax, wz = pz - az;
    var l2 = vx * vx + vz * vz, t = l2 > 0 ? U.clamp((wx * vx + wz * vz) / l2, 0, 1) : 0;
    return U.dist(px, pz, ax + vx * t, az + vz * t);
  };

  /* offside (aturan resmi): penerima di separuh lawan, di depan bola, dan kurang dari 2 lawan lebih dekat ke garis gawang */
  S.isOffside = function (p, r) {
    if (!this.rules.pro || !r || r.team !== p.team) return false;
    var dir = this.dirOf(p.team), b = this.ball;
    if (r.x * dir <= 0.3) return false;
    if (r.x * dir <= b.x * dir + 0.15) return false;
    var n = 0;
    for (var i = 0; i < this.players.length; i++) { var o = this.players[i]; if (o.team !== p.team && !o.hidden && o.x * dir >= r.x * dir) n++; }
    return n < 2;
  };
  S.offsideCall = function (p) {
    var b = this.ball;
    this.emit({ k: 'whistle', short: 1 });
    this.emit({ k: 'offside', p: this.code(p), team: p.team });
    this.stats[p.team].offsides = (this.stats[p.team].offsides || 0) + 1;
    this.restartWith(1 - p.team, U.clamp(p.x, -F.L / 2 + 2, F.L / 2 - 2), U.clamp(p.z, -F.W / 2 + 1, F.W / 2 - 1), 'freekick');
    void b;
  };
  /* pelanggaran: tendangan bebas / penalti + kartu */
  S.foul = function (def, car, slide) {
    var inBox = this.inOwnBox(def, 0) && Math.abs(car.x - this.ownGoalX(def.team)) < F.boxL && Math.abs(car.z) < F.boxW / 2;
    var card = '';
    var r = this.rng();
    if (slide && r < 0.04) card = 'merah'; else if ((slide && r < 0.3) || (!slide && r < 0.08)) card = 'kuning';
    def.yellow = def.yellow || 0;
    if (card === 'kuning') { def.yellow++; if (def.yellow >= 2) card = 'merah'; }
    this.stats[def.team].fouls = (this.stats[def.team].fouls || 0) + 1;
    this.emit({ k: 'foul', p: this.code(def), on: this.code(car), team: car.team, box: inBox ? 1 : 0, slide: slide ? 1 : 0 });
    if (card) {
      this.cards.push({ p: this.code(def), card: card, t: this.t });
      this.emit({ k: 'card', p: this.code(def), card: card, team: def.team });
      if (card === 'merah') { def.hidden = true; def.x = -this.dirOf(def.team) * (F.L / 2 + 6); def.z = F.W / 2 + 5; if (this.active[def.team] === def) this.active[def.team] = this.pl(def.team, 1); }
    }
    car.stunT = Math.max(car.stunT, 0.4);
    def.stunT = Math.max(def.stunT, 0.5);
    this.cancelAim();
    if (inBox) { this.startPenaltyKick(car.team); return; }
    this.restartWith(car.team, U.clamp(car.x, -F.L / 2 + 1, F.L / 2 - 1), U.clamp(car.z, -F.W / 2 + 1, F.W / 2 - 1), 'freekick');
  };

  S.doPass = function (p, dx, dz) {
    if (this.ball.owner !== p) return;
    var r = this.pickReceiver(p, dx, dz);
    var spdMul = D.bv(this.ballDef, 'spd');
    if (!r) {
      var f = this.faceVec(p);
      this.kickFree(p, f[0] * 13 * spdMul, 1, f[1] * 13 * spdMul, null, 'pass');
      this.emit({ k: 'kick', p: this.code(p), soft: 1 });
      return;
    }
    var d = U.dist(p.x, p.z, r.x, r.z);
    var v = U.clamp(7 + d * 0.7, 9, 19 + (F.ss - 1) * 8) * spdMul;
    var lead = d / v * 0.75;
    var tx = r.x + r.vx * lead, tz = r.z + r.vz * lead;
    var lane = 9, self = this;
    this.players.forEach(function (o) { if (o.team !== p.team && !o.hidden) lane = Math.min(lane, self.segDist(o.x, o.z, p.x, p.z, tx, tz)); });
    var ddx = tx - p.x, ddz = tz - p.z, dd = Math.sqrt(ddx * ddx + ddz * ddz) || 1;
    var vy = 0.4;
    if (lane < 1.1 && dd > 5) { v *= 0.82; vy = 3.2 + dd * 0.13; }
    this.setFacingTo(p, tx, tz);
    var off = this.isOffside(p, r);
    this.kickFree(p, ddx / dd * v, vy, ddz / dd * v, r, vy > 2 ? 'shoot' : 'pass');
    if (off && this.ball.pass) this.ball.pass.off = true;
    this.emit({ k: 'pass', p: this.code(p), to: this.code(r), lob: vy > 2 ? 1 : 0 });
    if (this.humans[p.team]) this.active[p.team] = r;
  };

  S.doLongKick = function (p) {
    if (this.ball.owner !== p) return;
    var dir = this.dirOf(p.team);
    var tx = dir * (F.L / 2 - 7), tz = this.rng.range(-6, 6) * F.ss;
    if ((tx - p.x) * dir > 34) tx = p.x + dir * 34; // lapangan besar: tendangan jauh ke depan, bukan langsung ke gawang
    var dx = tx - p.x, dz = tz - p.z, d = Math.sqrt(dx * dx + dz * dz) || 1;
    var v = U.clamp(d * 0.75, 12, 20 + (F.ss - 1) * 6) * D.bv(this.ballDef, 'spd');
    this.setFacingTo(p, tx, tz);
    this.kickFree(p, dx / d * v, 7, dz / d * v, null);
    this.emit({ k: 'kick', p: this.code(p) });
  };

  S.doGocek = function (p, lat) {
    if (this.ball.owner !== p || p.gocekCD > 0) return;
    p.gocekT = 0.55; p.gocekCD = 1.4;
    var f = this.faceVec(p);
    var side = (lat == null || lat === 0) ? (this.rng() < 0.5 ? -1 : 1) : Math.sign(lat);
    p.vx += -f[1] * side * 3.2; p.vz += f[0] * side * 3.2;
    this.emit({ k: 'gocek', p: this.code(p) });
  };

  S.doTackle = function (p, slide) {
    if (p.tackleCD > 0 || p.stunT > 0 || p.slideT > 0) return;
    var b = this.ball, carrier = b.owner;
    p.tackleCD = 0.95;
    if (slide) {
      var f = this.faceVec(p);
      if (carrier && carrier.team !== p.team && U.dist(p.x, p.z, carrier.x, carrier.z) < 4) {
        this.setFacingTo(p, carrier.x, carrier.z); f = this.faceVec(p);
      }
      p.slideT = 0.42; p.slid = false; p.vx = f[0] * 8; p.vz = f[1] * 8; p.anim = 'slide'; p.animT = 0;
      this.emit({ k: 'slide', p: this.code(p) });
      return;
    }
    if (!carrier || carrier.team === p.team || carrier.throwIn) return;
    if (U.dist(p.x, p.z, carrier.x, carrier.z) > 1.5) return;
    p.anim = 'tackle'; p.animT = 0;
    this.resolveTackle(p, carrier, false);
  };

  S.resolveTackle = function (def, car, slide) {
    var b = this.ball;
    var f = this.faceVec(car), toDef = [def.x - car.x, def.z - car.z];
    var dl = Math.sqrt(toDef[0] * toDef[0] + toDef[1] * toDef[1]) || 1;
    var behind = (f[0] * toDef[0] + f[1] * toDef[1]) / dl < -0.3;
    var diff = this.diffOf(def.team), dmod = this.humans[def.team] ? 0 : [-0.1, 0, 0.07][diff];
    var pr = 0.4 + (def.st.tekel - car.st.gocek) / 120 + (car.gocekT > 0 ? -0.2 : 0) + (behind ? -0.12 : 0) + (slide ? 0.08 : 0) + dmod;
    pr = U.clamp(pr, 0.1, 0.85);
    if (this.rng() < pr) {
      car.stunT = 0.35;
      if (this.rng() < 0.55 && !slide) {
        this.givePossession(def, true);
      } else {
        var df = this.faceVec(def);
        b.owner = null; b.last = def; b.pass = null;
        b.vx = df[0] * this.rng.range(4, 6.5); b.vz = df[1] * this.rng.range(4, 6.5); b.vy = 0.5;
        b.noTouch = car; b.noTouchT = 0.5;
        if (this.aim) { this.aim = null; this.tsTarget = 1; }
      }
      this.addSem(def.team, 4);
      this.stats[def.team].tackles++;
      this.emit({ k: 'tackle', ok: 1, p: this.code(def), on: this.code(car) });
    } else {
      if (this.rules.pro && this.phase === 'play' && this.rng() < (slide ? 0.38 : 0.16)) { this.foul(def, car, slide); return; }
      def.stunT = Math.max(def.stunT, slide ? 0.6 : 0.5);
      this.addSem(car.team, 1.5);
      this.emit({ k: 'tackle', ok: 0, p: this.code(def), on: this.code(car) });
    }
  };

  S.gkDistribute = function (gk, dx, dz) {
    if (this.ball.owner !== gk) return;
    var dir = this.dirOf(gk.team), self = this;
    var best = null, bestS = -1e9;
    var hint = (dx || dz) ? Math.sqrt(dx * dx + dz * dz) : 0;
    this.players.forEach(function (q) {
      if (q.team !== gk.team || q === gk || q.hidden) return;
      var open = 9;
      self.players.forEach(function (o) { if (o.team !== gk.team && !o.hidden) open = Math.min(open, U.dist(o.x, o.z, q.x, q.z)); });
      var d = U.dist(gk.x, gk.z, q.x, q.z);
      var s = open * 0.6 - Math.abs(d - 13) * 0.08 + (q.x - gk.x) * dir * 0.04 + self.rng() * 0.5;
      if (hint > 0.2) s += ((q.x - gk.x) * dx + (q.z - gk.z) * dz) / (Math.max(d, 1) * hint) * 3;
      if (s > bestS) { bestS = s; best = q; }
    });
    var b = this.ball;
    b.x = gk.x + dir * 0.6; b.y = 1.1; b.z = gk.z;
    if (best) {
      var tdx = best.x - b.x, tdz = best.z - b.z, d = Math.sqrt(tdx * tdx + tdz * tdz) || 1;
      var far = d > 24;
      var v = far ? U.clamp(10 + d * 0.45, 14, 24) : U.clamp(8 + d * 0.55, 10, 18);
      this.setFacingTo(gk, best.x, best.z);
      this.kickFree(gk, tdx / d * v, far ? 6 + d * 0.06 : 2.2 + d * 0.05, tdz / d * v, best, far ? 'punt' : 'throw');
      if (this.humans[gk.team]) this.active[gk.team] = best;
    } else {
      this.kickFree(gk, dir * 17, 7, this.rng.range(-4, 4), null, 'punt');
    }
    this.emit({ k: 'kick', p: this.code(gk), soft: 1 });
  };

  /* ---------------- tendangan ke gawang & duel jurus ---------------- */
  S.inShotRange = function (p) {
    var gx = this.oppGoalX(p.team);
    return U.dist(p.x, p.z, gx, 0) < F.shot && Math.abs(p.z) < Math.max(12.5, F.boxW / 2 + 4);
  };

  S.pressureOn = function (p) {
    var pr = 0, f = this.faceVec(p);
    this.players.forEach(function (o) {
      if (o.team === p.team || o.hidden || o.role === 'GK' || o.stunT > 0) return;
      var dx = o.x - p.x, dz = o.z - p.z, d = Math.sqrt(dx * dx + dz * dz);
      if (d > 2.6) return;
      var front = (dx * f[0] + dz * f[1]) / (d || 1);
      pr = Math.max(pr, (1 - d / 2.6) * (front > -0.2 ? 1 : 0.5));
    });
    return U.clamp(pr, 0, 1);
  };

  S.startAim = function (p) {
    if (this.ball.owner !== p || this.aim) return;
    this.aim = { p: p, team: p.team, t: 0 };
    this.tsTarget = this.mode === 'match' ? 0.32 : 1;
    p.anim = 'aim';
    this.emit({ k: 'aim', p: this.code(p) });
  };

  S.cancelAim = function () { this.aim = null; this.tsTarget = 1; };

  S.doShot = function (p, charge, zc, zr, opts) {
    opts = opts || {};
    var b = this.ball;
    if (b.owner !== p) { this.cancelAim(); return; }
    this.cancelAim();
    var t = p.team, dir = this.dirOf(t), gx = dir * F.L / 2;
    charge = U.clamp(U.num(charge, 0.7), 0, 1.25);
    var zone = D.zoneOf(zc, zr);
    var d = opts.pen ? U.dist(b.x, b.z, gx, 0) : U.dist(p.x, p.z, gx, 0);
    this.stats[t].shots++;
    this.addSem(t, 1);
    p.anim = 'shoot'; p.animT = 0;
    this.setFacingTo(p, gx, 0);
    if (charge < 0.3 && !opts.pen) { this.weakShot(p, zone); return; }
    var pressure = opts.pen ? 0 : this.pressureOn(p);
    var over = charge > 1.0, perfect = charge >= 0.85 && charge <= 1.0;
    var c = perfect ? 1.1 : (over ? 1.0 : charge);
    var ult = this.sem[t] >= 100 && charge >= 0.6;
    var miss = 0.02 + Math.max(0, d - 16) * 0.025 + (over ? 0.3 + (charge - 1) * 1.6 : 0) + pressure * 0.12 - (p.st.tendang - 60) / 500;
    if (perfect) miss *= 0.5;
    if (opts.pen) miss = over ? 0.25 + (charge - 1) * 1.5 : 0.015;
    miss = U.clamp(miss, 0.005, 0.85);
    if (!ult && this.rng() < miss) { this.missShot(p, zone, over, opts.pen); return; }
    if (ult) this.sem[t] = 0;
    var combo = !opts.pen && p.fromPass && (this.t - p.recvAt) < 1.1;
    var keeper = this.pl(1 - t, 0);
    var r = this.resolveDuel(p, keeper, zone, c, d, pressure, ult, combo, !!opts.pen);
    this.stats[t].onTarget++;
    this.stats[t].best = Math.max(this.stats[t].best, r.sp);
    if (!this.bestShot || r.sp > this.bestShot.sp) this.bestShot = { sp: r.sp, name: p.name, type: p.shot.name, team: t };
    this.cineId++;
    this.cine = {
      id: this.cineId, team: t, si: p.idx, ki: 0, type: p.shot.id, zone: zone.id, c: Math.round(charge * 100), ult: ult ? 1 : 0, combo: combo ? 1 : 0,
      perfect: perfect ? 1 : 0, sp: r.sp, kp: r.kp, res: r.res, skill: r.skill, fx: Math.round(p.x * 100) / 100, fz: Math.round(p.z * 100) / 100,
      pen: opts.pen ? 1 : 0, sandal: (p.cfg.foot === 'sandal' && charge > 0.8 && this.rng() < 0.4) ? 1 : 0, kx: Math.round(keeper.x * 100) / 100, kz: Math.round(keeper.z * 100) / 100,
      bx: Math.round(b.x * 100) / 100, bz: Math.round(b.z * 100) / 100
    };
    b.owner = null; b.pass = null; b.vx = b.vy = b.vz = 0; b.last = p;
    this.phase = 'cine'; this.phaseT = 0; this.cineWait = 0; this.cineDone = false;
    this.emit({ k: 'cine', d: this.cine });
  };

  S.resolveDuel = function (p, k, zone, c, d, pressure, ult, combo, pen) {
    var shot = p.shot, w = this.weather, bd = this.ballDef;
    var att = p.team, aiAtt = !this.humans[att], aiDef = !this.humans[1 - att];
    var dAtt = this.diffOf(att), dDef = this.diffOf(1 - att);
    var sp = p.st.tendang * 3 * c * D.shotMult(shot, zone.id) * U.clamp(1.3 - d / 30, 0.5, 1.05) * (1 - 0.25 * pressure) *
      D.bv(bd, 'pow') * D.wv(w, 'shot') * (ult ? 1.28 : 1) * (combo ? 1.1 : 1) * p.st.footMul * (this.ball.petirT > 0 ? 1.25 : 1);
    if (aiAtt && this.humans[1 - att]) sp *= [0.9, 1, 1.05][dAtt];
    var skillId = (k && k.style && k.style.map[zone.id]) || '';
    var mult = skillId ? (D.SKILLS[skillId].mult - (shot.pierce || 0)) : 0.95 * D.wv(w, 'keepNormal');
    // jarak ideal 8-12 m: terlalu dekat kiper menutup sudut, terlalu jauh kiper sempat bereaksi
    var react = (d < 6 ? 1.03 + (6 - d) * 0.045 : U.clamp(0.9 + d / 45, 0.9, 1.3)) * (shot.react || 1) * D.bv(bd, 'react') * D.wv(w, 'keep');
    var kst = k ? k.st : { tenaga: 70, refleks: 70 };
    var kp = (kst.tenaga * 2 + kst.refleks) * mult * react * this.rng.range(0.93, 1.07);
    if (aiDef && this.humans[att]) kp *= [0.9, 1, 1.06][dDef];
    if (pen) kp *= 0.85; // penalti: kiper harus menebak arah
    var ratio = sp / Math.max(kp, 1);
    var res = ratio >= 1 ? ((ratio < 1.04 && this.rng() < 0.25) ? 'post' : 'goal') : (ratio >= 0.88 ? 'parry' : 'catch');
    return { sp: Math.round(sp), kp: Math.round(kp), res: res, skill: skillId };
  };

  S.weakShot = function (p, zone) {
    var dir = this.dirOf(p.team), gx = dir * F.L / 2;
    var tz = zone.c * D.ZONE_DZ * dir * 0.8;
    var dx = gx - p.x, dz = tz - p.z, d = Math.sqrt(dx * dx + dz * dz) || 1;
    var v = 11 * D.bv(this.ballDef, 'spd');
    this.kickFree(p, dx / d * v, 1.2, dz / d * v, null);
    this.emit({ k: 'kick', p: this.code(p) });
  };

  S.missShot = function (p, zone, over, pen) {
    var dir = this.dirOf(p.team), gx = dir * F.L / 2;
    var tz, vy;
    if (over || zone.r === 0) { tz = zone.c * 2.4 * dir; vy = 9; }
    else { tz = (zone.c === 0 ? (this.rng() < 0.5 ? -1 : 1) : zone.c) * dir * (F.goalW / 2 + this.rng.range(0.6, 2.2)); vy = 2.5; }
    var dx = gx + dir * 2 - p.x, dz = tz - p.z, d = Math.sqrt(dx * dx + dz * dz) || 1;
    var v = 22 * D.bv(this.ballDef, 'spd');
    this.kickFree(p, dx / d * v, vy, dz / d * v, null);
    this.emit({ k: 'miss', p: this.code(p) });
    if (pen && this.pen) { this.pen.missFlight = 0; this.pen.state = 'after'; this.pen.t = 0; this.pen.lastRes = 'miss'; this.penRecord('miss'); }
  };

  S.applyDuelResult = function () {
    var c = this.cine;
    if (!c) { this.phase = 'play'; return; }
    this.cine = null;
    var att = c.team, def = 1 - att;
    var shooter = this.pl(att, c.si), keeper = this.pl(def, 0), b = this.ball;
    var dir = this.dirOf(att), gx = dir * F.L / 2;
    if (c.skill) { this.revealed[def][c.zone] = c.skill; }
    var zone = D.zoneById[c.zone] || D.zoneById.C;
    var penCtx = this.pen && this.pen.state === 'cine';
    keeper.x = gx - dir * 0.5; keeper.z = U.clamp(zone.c * D.ZONE_DZ * dir * 0.8, -2, 2);
    keeper.vx = keeper.vz = 0;
    if (c.res === 'goal') {
      b.x = gx + dir * 1.1; b.z = zone.c * D.ZONE_DZ * dir * 0.9; b.y = D.ZONE_Y[zone.r] * 0.6;
      b.owner = null; b.vx = b.vy = b.vz = 0;
      if (penCtx && this.pen.kind !== 'single') { this.penRecord('goal'); return; }
      this.scoreGoal(att, shooter, c.type, false, false);
      if (penCtx) this.pen = null;
      return;
    }
    this.stats[def].saves++;
    if (c.skill) this.stats[def].special++;
    this.addSem(def, c.res === 'catch' ? 8 : 5);
    if (c.res === 'catch') {
      this.emit({ k: 'save', kind: 'catch', team: def, skill: c.skill });
      if (penCtx && this.pen.kind !== 'single') { this.penRecord('save'); return; }
      this.resetBallFree();
      b.last = keeper;
      this.givePossession(keeper, true);
      keeper.gkHoldT = -0.4;
      this.endPenSingle();
      this.phase = 'play'; this.phaseT = 0;
      return;
    }
    // ditepis atau kena tiang: bola liar
    this.resetBallFree();
    b.last = keeper;
    if (c.res === 'post') {
      var pz = (zone.c === 0 ? (this.rng() < 0.5 ? -1 : 1) : zone.c * dir) * F.goalW / 2;
      b.x = gx - dir * 0.3; b.z = pz * 0.95; b.y = Math.min(D.ZONE_Y[zone.r], 1.6);
      b.vx = -dir * this.rng.range(6, 10); b.vz = -Math.sign(pz) * this.rng.range(1.5, 4.5); b.vy = this.rng.range(1, 3);
      b.last = shooter;
      this.emit({ k: 'post' });
    } else {
      if (this.rules.bound === 'keluar' && !penCtx && this.rng() < 0.42) {
        // ditepis keluar lapangan: sepak pojok
        keeper.stunT = 0.3;
        this.emit({ k: 'save', kind: 'parry', team: def, skill: c.skill, out: 1 });
        this.phase = 'play';
        this.awardCorner(att, dir, this.rng() < 0.5 ? -1 : 1);
        return;
      }
      b.x = keeper.x - dir * 0.6; b.z = keeper.z; b.y = 1.0;
      var vz = this.rng.range(-6, 6);
      if (D.shotById[c.type] && D.shotById[c.type].rebound) {
        var mate = null, md = 1e9;
        this.players.forEach(function (q) { if (q.team === att && q.role !== 'GK' && !q.hidden) { var dd = U.dist(q.x, q.z, b.x, b.z); if (dd < md) { md = dd; mate = q; } } });
        if (mate) vz = U.clamp((mate.z - b.z) * 0.7, -7, 7);
      }
      b.vx = -dir * this.rng.range(5, 9); b.vz = vz; b.vy = this.rng.range(2, 4);
      keeper.stunT = 0.45;
      this.emit({ k: 'save', kind: 'parry', team: def, skill: c.skill });
    }
    b.noTouch = keeper; b.noTouchT = 0.45;
    if (penCtx && this.pen.kind !== 'single') { this.penRecord(c.res === 'post' ? 'post' : 'save'); return; }
    this.endPenSingle();
    this.phase = 'play'; this.phaseT = 0;
  };

  S.scoreGoal = function (team, scorer, typeId, free, own) {
    var b = this.ball, dir = this.dirOf(team);
    this.score[team]++;
    this.stats[team].goals++;
    var tname = typeId ? (D.shotById[typeId] ? D.shotById[typeId].name : '') : '';
    this.goals.push({ team: team, name: scorer ? scorer.name : '?', type: tname, own: own ? 1 : 0, t: Math.round((this.rules.dur - Math.max(0, this.clock))) });
    this.addSem(1 - team, 18);
    this.phase = 'goal'; this.phaseT = 0; this.goalTeam = team;
    this.cancelAim();
    b.owner = null; b.pass = null; b.inNet = 1;
    var self = this;
    var cel = scorer && scorer.team === team ? scorer : null;
    this.players.forEach(function (p) {
      p.dvx = p.dvz = 0; p.slideT = 0; p.stunT = 0; p.gkHold = false; p.throwIn = false;
      p.celebrate = p.team === team; p.anim = p.team === team ? (p === cel ? 'celebrate' : 'cheer') : 'sad'; p.animT = 0;
    });
    this.emit({ k: 'goal', team: team, p: this.code(scorer), type: typeId || '', free: free ? 1 : 0, own: own ? 1 : 0, sc: [this.score[0], this.score[1]] });
    this.celebrator = scorer && scorer.team === team ? scorer : null;
    if (this.golden) this.endAfterGoal = true;
    void dir; void self;
  };

  S.freeGoal = function (team) {
    var b = this.ball, last = b.last;
    var own = !!(last && last.team !== team);
    var scorer = last || this.pl(team, 4);
    this.scoreGoal(team, scorer, null, true, own);
  };

  S.stepGoal = function (dt) {
    var b = this.ball, self = this;
    var dir = this.dirOf(this.goalTeam);
    // bola diam di jaring
    b.x = U.damp(b.x, dir * (F.L / 2 + F.goalD - 0.3), 6, dt); b.y = U.damp(b.y, R, 4, dt);
    var cel = this.celebrator;
    this.players.forEach(function (p) {
      if (p.hidden) return;
      if (p === cel) {
        var tx = dir * (F.L / 2 - 4), tz = (p.z >= 0 ? 1 : -1) * (F.W / 2 - 2);
        var dx = tx - p.x, dz = tz - p.z, d = Math.sqrt(dx * dx + dz * dz);
        if (d > 0.5) { p.vx = dx / d * 6; p.vz = dz / d * 6; p.facing = Math.atan2(dx, dz); } else { p.vx = p.vz = 0; }
        p.x += p.vx * dt; p.z += p.vz * dt;
      } else { p.vx = U.damp(p.vx, 0, 6, dt); p.vz = U.damp(p.vz, 0, 6, dt); }
      p.animT += dt;
    });
    if (this.phaseT > 2.7) {
      if (this.endAfterGoal || (this.mode === 'match' && this.clock <= 0 && !this.golden && this.score[0] !== this.score[1])) { this.endMatch(); return; }
      if (this.mode === 'match' && this.clock <= 0 && !this.golden) { this.timeUp(); if (this.phase !== 'goal') return; }
      this.setupKickoff(1 - this.goalTeam, false);
    }
    void self;
  };

  /* ---------------- aturan berjalan ---------------- */
  S.rulesTick = function (sdt, dt) {
    var b = this.ball;
    // bola panas
    if (this.rules.bolaPanas && b.owner && !b.owner.gkHold && !b.owner.throwIn && b.holdT > 6 && !(this.aim && this.aim.p === b.owner)) {
      var o = b.owner;
      b.owner = null; b.last = o; b.pass = null;
      var a = this.rng() * U.TAU;
      b.vx = Math.cos(a) * 5; b.vz = Math.sin(a) * 5; b.vy = 2.5;
      b.noTouch = o; b.noTouchT = 0.6;
      o.stunT = 0.5;
      this.emit({ k: 'hot', p: this.code(o) });
    }
    // petir
    if (this.weather.lightning) {
      this.petirTimer -= sdt;
      if (this.petirTimer <= 0) {
        this.petirTimer = this.rng.range(30, 55);
        b.petirT = 10;
        this.emit({ k: 'petir', x: b.x, z: b.z });
      }
    }
    // bola macet
    var spd = Math.sqrt(b.vx * b.vx + b.vz * b.vz);
    if (!b.owner && spd < 0.15 && b.y < R + 0.05) {
      b.stuckT += sdt;
      if (b.stuckT > 5) {
        var best = null, bd = 1e9;
        this.players.forEach(function (p) { if (!p.hidden && p.role !== 'GK') { var d = U.dist2(p.x, p.z, b.x, b.z); if (d < bd) { bd = d; best = p; } } });
        if (best) { best.x = b.x - 0.4; best.z = b.z; this.givePossession(best, true); }
        b.stuckT = 0;
      }
    } else b.stuckT = 0;
    // bidikan
    if (this.aim) {
      this.aim.t += dt;
      var ap = this.aim.p;
      if (b.owner !== ap) this.cancelAim();
      else if (this.aim.t > 2.4) {
        var inp = this.inputs[ap.team];
        this.doShot(ap, 0.9, inp.zc, inp.zr);
        return;
      }
    }
    // jam
    if (this.mode === 'match') {
      if (this.golden) {
        this.goldenT -= sdt;
        if (this.goldenT <= 0) { this.golden = false; this.startShootout(false); }
      } else {
        this.clock -= sdt;
        if (this.clock <= 0) { this.clock = 0; this.timeUp(); }
      }
    }
  };

  S.timeUp = function () {
    if (this.score[0] !== this.score[1]) { this.endMatch(); return; }
    var tie = this.rules.tie;
    if (tie === 'emas' && !this.goldenUsed) {
      this.golden = true; this.goldenUsed = true; this.goldenT = 75;
      this.emit({ k: 'golden' });
      if (this.phase !== 'play' && this.phase !== 'goal') this.phase = 'play';
      return;
    }
    if (tie === 'seri') { this.endMatch(); return; }
    this.startShootout(false);
  };

  S.endMatch = function () {
    this.cancelAim();
    this.phase = 'end'; this.phaseT = 0;
    if (this.shootout && this.shootout.done) this.winner = this.shootout.winner;
    else this.winner = this.score[0] > this.score[1] ? 0 : (this.score[1] > this.score[0] ? 1 : -1);
    this.players.forEach(function (p) { p.dvx = p.dvz = 0; p.vx = p.vz = 0; });
    this.emit({ k: 'end', winner: this.winner, sum: this.summary() });
  };

  S.summary = function () {
    var so = this.shootout;
    return {
      sc: [this.score[0], this.score[1]], wn: this.winner,
      so: so ? [so.kicks[0].join(''), so.kicks[1].join('')] : null,
      goals: this.goals.slice(-14).map(function (g) { return [g.team, g.name, g.type, g.own, g.t]; }),
      st: this.stats.map(function (s) { return [s.shots, s.onTarget, s.goals, s.saves, s.special, s.tackles, s.passes, s.best]; }),
      best: this.bestShot ? [this.bestShot.sp, this.bestShot.name, this.bestShot.type, this.bestShot.team] : null
    };
  };

  /* ---------------- penalti (tiga pojok, adu penalti, latihan) ---------------- */
  S.penShooterOrder = function (team) {
    var ps = this.players.filter(function (p) { return p.team === team && !p.hidden; });
    ps.sort(function (a, b) { return (b.role === 'GK' ? -100 : b.st.tendang) - (a.role === 'GK' ? -100 : a.st.tendang); });
    return ps;
  };

  S.placeForPen = function (team, shooter) {
    var dir = this.dirOf(team), gx = dir * F.L / 2, self = this;
    var keeper = this.pl(1 - team, 0);
    var spot = this.pen && this.pen.spot ? this.pen.spot : { x: gx - dir * F.pen, z: 0 };
    var k = 0, kt = [0, 0];
    this.players.forEach(function (p) {
      p.vx = p.vz = p.dvx = p.dvz = 0; p.stunT = 0; p.slideT = 0; p.gkHold = false; p.celebrate = false; p.throwIn = false;
      if (p.hidden) return;
      if (p === shooter) { p.x = spot.x - dir * 1.4; p.z = spot.z; self.setFacingTo(p, gx, 0); p.anim = 'idle'; return; }
      if (p === keeper) { p.x = gx - dir * 0.4; p.z = 0; p.facing = Math.atan2(-dir, 0); p.anim = 'gkReady'; return; }
      if (self.pen && self.pen.kind === 'single') {
        var side = (k % 2 === 0 ? 1 : -1);
        p.x = gx - dir * (F.boxL + 2.5 + (k % 3)); p.z = U.clamp(side * (2 + k * 1.3), -F.W / 2 + 1, F.W / 2 - 1); k++;
      } else {
        // adu penalti: pemain berkumpul di lingkaran tengah, berbaris per tim
        var kk = kt[p.team]++;
        p.x = (p.team === 0 ? -1 : 1) * (1 + (kk % 5) * 1.05); p.z = -2.4 + Math.floor(kk / 5) * 1.3 + (p.team === 0 ? 0 : 0.6);
      }
      self.setFacingTo(p, spot.x, spot.z);
    });
    var b = this.ball;
    b.owner = null; b.pass = null; b.x = spot.x; b.z = spot.z; b.y = R; b.vx = b.vy = b.vz = 0; b.holdT = 0; b.inNet = 0;
  };

  S.startPenaltyKick = function (team) {
    var order = this.penShooterOrder(team);
    var shooter = order[0];
    if (this.humans[team] && this.active[team] && this.active[team].role !== 'GK') shooter = this.active[team];
    this.cancelAim();
    this.pen = { kind: 'single', team: team, shooter: shooter, state: 'setup', t: 0 };
    this.phase = 'pen'; this.phaseT = 0;
    this.placeForPen(team, shooter);
    this.emit({ k: 'penalty', team: team });
  };

  S.startShootout = function (fromMode) {
    this.cancelAim();
    var first = this.rng() < 0.5 ? 0 : 1;
    this.shootout = { kicks: [[], []], first: first, order: [this.penShooterOrder(0), this.penShooterOrder(1)], n: [0, 0], done: false, winner: -1, turn: first };
    this.phase = 'pen'; this.phaseT = 0;
    this.emit({ k: 'shootout' });
    this.nextShootoutKick();
    void fromMode;
  };

  S.nextShootoutKick = function () {
    var so = this.shootout, t = so.turn;
    var order = so.order[t];
    var shooter = order[so.n[t] % order.length];
    this.pen = { kind: 'shootout', team: t, shooter: shooter, state: 'setup', t: 0 };
    this.placeForPen(t, shooter);
  };

  S.startPractice = function () {
    var self = this;
    var sIdx = U.clamp(U.num(this.cfg.practiceShooter, 4), 1, this.n - 1);
    this.players.forEach(function (p) {
      p.hidden = !((p.team === 0 && p.idx === sIdx) || (p.team === 1 && p.idx === 0));
      if (p.hidden) { p.x = 0; p.z = -F.W / 2 - 20; }
    });
    this.revealAll = true;
    for (var z in this.pl(1, 0).style.map) this.revealed[1][z] = this.pl(1, 0).style.map[z];
    this.practice = { n: 0, goals: 0, spots: [[F.pen, 0], [11, -5], [11, 5], [15, 0], [13, -8], [13, 8]] };
    this.nextPracticeKick();
    void self;
  };

  S.nextPracticeKick = function () {
    var pr = this.practice, sp = pr.spots[pr.n % pr.spots.length];
    var shooter = this.players.filter(function (p) { return p.team === 0 && !p.hidden; })[0];
    var dir = 1, gx = F.L / 2;
    this.pen = { kind: 'practice', team: 0, shooter: shooter, state: 'setup', t: 0, spot: { x: gx - dir * sp[0], z: sp[1] } };
    this.phase = 'pen'; this.phaseT = 0;
    this.placeForPen(0, shooter);
  };

  S.setPracticeStyle = function (styleId) {
    var k = this.pl(1, 0), st = D.styleById[styleId];
    if (!st || this.mode !== 'practice') return;
    k.style = st; k.cfg = Object.assign({}, k.cfg, { style: styleId });
    this.revealed[1] = {};
    for (var z in st.map) this.revealed[1][z] = st.map[z];
  };

  S.stepPen = function (dt) {
    var pen = this.pen;
    if (!pen) { this.phase = 'play'; return; }
    pen.t += dt;
    var b = this.ball, self = this;
    this.players.forEach(function (p) { p.animT += dt; if (HOLD[p.anim] && p.animT > HOLD[p.anim]) p.anim = p.role === 'GK' ? 'gkReady' : 'idle'; });
    if (pen.state === 'setup') {
      this.resetInputSeqs(0); this.resetInputSeqs(1);
      if (pen.t > 1.1) { pen.state = 'aim'; pen.t = 0; this.emit({ k: 'whistle', short: 1 }); }
      return;
    }
    if (pen.state === 'aim') {
      var sh = pen.shooter;
      b.owner = sh; // bola menempel untuk logika aksi
      var spot = pen.spot || { x: this.oppGoalX(pen.team) - this.dirOf(pen.team) * F.pen, z: 0 };
      b.x = spot.x; b.z = spot.z; b.y = R;
      if (this.humans[pen.team]) {
        var inp = this.inputs[pen.team], hs = this.hs[pen.team];
        if (inp.shootSeq !== hs.shootSeq) {
          hs.shootSeq = inp.shootSeq; hs.shootHeld = inp.shootHeld;
          this.penShoot(sh, inp.charge, inp.zc, inp.zr);
          return;
        }
        hs.shootHeld = inp.shootHeld;
        if (pen.t > 12) { this.penShoot(sh, 0.8, 0, 1); }
      } else if (pen.t > 1.2) {
        var a = this.aiShotParams(sh);
        this.penShoot(sh, a.charge, a.zc, a.zr);
      }
      return;
    }
    if (pen.state === 'after') {
      // bola meleset sedang terbang
      this.updateFreeBallSimple(dt);
      if (pen.t > 1.6) this.penAdvance();
    }
  };

  S.updateFreeBallSimple = function (dt) {
    var b = this.ball;
    b.vy -= 9.8 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy) * 0.4; b.vx *= 0.8; b.vz *= 0.8; }
    var mx = F.L / 2 + F.goalD + 0.6, mz = F.W / 2 + 1.1;
    if (Math.abs(b.x) > mx) { b.x = Math.sign(b.x) * mx; b.vx = -b.vx * 0.3; }
    if (Math.abs(b.z) > mz) { b.z = Math.sign(b.z) * mz; b.vz = -b.vz * 0.3; }
    if (b.y > 8) { b.y = 8; b.vy = Math.min(0, b.vy); }
  };

  S.penShoot = function (sh, charge, zc, zr) {
    var pen = this.pen;
    this.ball.owner = sh;
    pen.state = 'cine'; pen.t = 0;
    this.doShot(sh, charge, zc, zr, { pen: true });
    if (this.phase === 'cine') { this.phase = 'cine'; }
    else if (pen.state === 'cine') { pen.state = 'after'; pen.t = 0; }
  };

  S.penRecord = function (res) {
    var pen = this.pen;
    if (!pen) return;
    var scored = res === 'goal';
    if (pen.kind === 'shootout') {
      this.shootout.kicks[pen.team].push(scored ? 1 : 0);
      this.emit({ k: 'penres', team: pen.team, ok: scored ? 1 : 0 });
      if (scored) this.emit({ k: 'goal', team: pen.team, p: this.code(pen.shooter), type: pen.shooter.shot.id, pen: 1, sc: [this.score[0], this.score[1]] });
    } else if (pen.kind === 'practice') {
      this.practice.n++;
      if (scored) { this.practice.goals++; this.emit({ k: 'goal', team: 0, p: this.code(pen.shooter), type: pen.shooter.shot.id, pen: 1, practice: 1 }); }
    }
    pen.state = 'after'; pen.t = res === 'miss' ? 0 : 0.6;
    this.phase = 'pen';
  };

  S.endPenSingle = function () {
    if (this.pen && this.pen.kind === 'single') this.pen = null;
  };

  S.penAdvance = function () {
    var pen = this.pen;
    if (!pen) return;
    if (pen.kind === 'practice') { this.nextPracticeKick(); return; }
    if (pen.kind === 'single') {
      // penalti tunggal meleset: tendangan gawang untuk tim bertahan
      var defT = 1 - pen.team, gk = this.pl(defT, 0);
      this.pen = null;
      this.resetBallFree();
      gk.x = this.ownGoalX(defT) + this.dirOf(defT) * 1.2; gk.z = 0;
      this.givePossession(gk, true);
      this.phase = 'restart'; this.phaseT = 0; this.restartDelay = 0.6;
      return;
    }
    var so = this.shootout;
    so.n[pen.team]++;
    var k0 = so.kicks[0], k1 = so.kicks[1];
    var s0 = k0.reduce(function (a, v) { return a + v; }, 0), s1 = k1.reduce(function (a, v) { return a + v; }, 0);
    var r0 = Math.max(0, 5 - k0.length), r1 = Math.max(0, 5 - k1.length);
    var decided = false;
    if (k0.length <= 5 && k1.length <= 5) {
      if (s0 + r0 < s1 || s1 + r1 < s0) decided = true;
      if (k0.length === 5 && k1.length === 5 && s0 !== s1) decided = true;
    } else if (k0.length === k1.length && s0 !== s1) decided = true;
    // pengaman: adu penalti tak berujung diputus undian koin
    var coin = !decided && k0.length === k1.length && k0.length >= 20;
    if (decided || coin) {
      so.done = true; so.winner = coin ? (this.rng() < 0.5 ? 0 : 1) : (s0 > s1 ? 0 : 1);
      this.pen = null;
      this.endMatch();
      return;
    }
    so.turn = 1 - pen.team;
    this.nextShootoutKick();
  };

  /* ---------------- pengaman ---------------- */
  S.sanity = function () {
    var b = this.ball, bad = !(U.fin(b.x) && U.fin(b.y) && U.fin(b.z) && U.fin(b.vx) && U.fin(b.vy) && U.fin(b.vz));
    for (var i = 0; i < this.players.length && !bad; i++) {
      var p = this.players[i];
      if (!(U.fin(p.x) && U.fin(p.z) && U.fin(p.vx) && U.fin(p.vz) && U.fin(p.facing))) bad = true;
    }
    if (!bad) return;
    this.sanityFails++;
    if (root.console) root.console.warn('BolaApi: posisi tidak valid, diatur ulang');
    var self = this;
    this.players.forEach(function (p) { if (!U.fin(p.facing)) p.facing = 0; if (!U.fin(p.x) || !U.fin(p.z)) { var h = self.homePos(p, 0); p.x = U.fin(h.x) ? h.x : 0; p.z = U.fin(h.z) ? h.z : 0; } if (!U.fin(p.vx)) p.vx = 0; if (!U.fin(p.vz)) p.vz = 0; });
    if (!(U.fin(b.x) && U.fin(b.z) && U.fin(b.y))) { b.x = 0; b.z = 0; b.y = R; b.owner = null; }
    b.vx = U.fin(b.vx) ? b.vx : 0; b.vy = U.fin(b.vy) ? b.vy : 0; b.vz = U.fin(b.vz) ? b.vz : 0;
    if (this.phase === 'play' && this.sanityFails > 3) { this.sanityFails = 0; this.setupKickoff(0, false); }
  };

  /* ---------------- masukan pemain ---------------- */
  S.setInput = function (team, inp) {
    if (!inp || team < 0 || team > 1) return;
    var cur = this.inputs[team];
    var mx = U.clamp(U.num(inp.mx, 0), -1, 1), mz = U.clamp(U.num(inp.mz, 0), -1, 1);
    var l = Math.sqrt(mx * mx + mz * mz); if (l > 1) { mx /= l; mz /= l; }
    cur.mx = mx; cur.mz = mz; cur.sprint = !!inp.sprint;
    cur.passSeq = U.num(inp.passSeq, cur.passSeq) | 0;
    cur.gocekSeq = U.num(inp.gocekSeq, cur.gocekSeq) | 0;
    cur.switchSeq = U.num(inp.switchSeq, cur.switchSeq) | 0;
    cur.shootSeq = U.num(inp.shootSeq, cur.shootSeq) | 0;
    cur.skipSeq = U.num(inp.skipSeq, cur.skipSeq) | 0;
    cur.shootHeld = !!inp.shootHeld;
    cur.charge = U.clamp(U.num(inp.charge, 0), 0, 1.25);
    cur.zc = U.clamp(Math.round(U.num(inp.zc, 0)), -1, 1);
    cur.zr = U.clamp(Math.round(U.num(inp.zr, 1)), 0, 2);
    cur.chase = !!inp.chase;
  };

  S.resetInputSeqs = function (team) {
    var inp = this.inputs[team], hs = this.hs[team];
    hs.passSeq = inp.passSeq; hs.gocekSeq = inp.gocekSeq; hs.switchSeq = inp.switchSeq; hs.shootSeq = inp.shootSeq; hs.skipSeq = inp.skipSeq; hs.shootHeld = inp.shootHeld;
  };

  S.updateActive = function (team, dt) {
    var b = this.ball, cur = this.active[team];
    if (b.owner && b.owner.team === team && b.owner.role !== 'GK') { this.active[team] = b.owner; this.swT[team] = 0; return; }
    if (b.pass && b.pass.to && b.pass.to.team === team && b.pass.to.role !== 'GK') { this.active[team] = b.pass.to; return; }
    var pred = this.predictBall(0.3), best = null, bd = 1e9;
    this.players.forEach(function (p) {
      if (p.team !== team || p.role === 'GK' || p.hidden) return;
      var d = U.dist(p.x, p.z, pred.x, pred.z);
      if (d < bd) { bd = d; best = p; }
    });
    if (!cur || cur.hidden || cur.role === 'GK') { this.active[team] = best; return; }
    if (best && best !== cur) {
      var dc = U.dist(cur.x, cur.z, pred.x, pred.z);
      if (bd + 2.5 < dc) { this.swT[team] += dt; if (this.swT[team] > 0.22) { this.active[team] = best; this.swT[team] = 0; } }
      else this.swT[team] = 0;
    }
  };

  S.switchActive = function (team) {
    var cur = this.active[team], pred = this.predictBall(0.3);
    var list = this.players.filter(function (p) { return p.team === team && p.role !== 'GK' && !p.hidden && p !== cur; });
    list.sort(function (a, b) { return U.dist(a.x, a.z, pred.x, pred.z) - U.dist(b.x, b.z, pred.x, pred.z); });
    if (list[0]) { this.active[team] = list[0]; this.swT[team] = 0; this.emit({ k: 'switch', team: team }); }
  };

  S.predictBall = function (t) {
    var b = this.ball;
    if (b.owner) return { x: b.x + b.owner.vx * t, z: b.z + b.owner.vz * t };
    return { x: b.x + b.vx * t * 0.8, z: b.z + b.vz * t * 0.8 };
  };

  S.humanControl = function (team, sdt, dt) {
    var inp = this.inputs[team], hs = this.hs[team], b = this.ball;
    var passE = inp.passSeq !== hs.passSeq, gocekE = inp.gocekSeq !== hs.gocekSeq, swE = inp.switchSeq !== hs.switchSeq;
    var relE = inp.shootSeq !== hs.shootSeq, pressE = inp.shootHeld && !hs.shootHeld;
    hs.passSeq = inp.passSeq; hs.gocekSeq = inp.gocekSeq; hs.switchSeq = inp.switchSeq; hs.shootSeq = inp.shootSeq; hs.shootHeld = inp.shootHeld; hs.skipSeq = inp.skipSeq;
    var gk = this.pl(team, 0);
    if (gk.gkHold && b.owner === gk) {
      if (passE || relE) this.gkDistribute(gk, inp.mx, inp.mz);
    }
    var p = this.active[team];
    if (!p || p.hidden) return;
    var aiming = this.aim && this.aim.p === p;
    if (swE && !(b.owner && b.owner.team === team)) { this.switchActive(team); p = this.active[team]; if (!p) return; aiming = false; }
    if (p.stunT > 0 || p.slideT > 0) return;
    // gerak
    if (aiming) { p.dvx = 0; p.dvz = 0; }
    else {
      var spr = inp.sprint && p.stamina > 8;
      var v = this.maxSpeed(p, spr);
      p.dvx = inp.mx * v; p.dvz = inp.mz * v; p.sprint = spr && (Math.abs(inp.mx) + Math.abs(inp.mz) > 0.2);
    }
    if (b.owner === p && p.throwIn) {
      p.dvx = 0; p.dvz = 0;
      if (Math.abs(inp.mx) + Math.abs(inp.mz) > 0.3) p.facing = U.angLerp(p.facing, Math.atan2(inp.mx, inp.mz), 0.15);
      p.throwT = (p.throwT || 0) + sdt;
      if (passE || relE || pressE || gocekE || p.throwT > 5) this.doThrowIn(p, inp.mx, inp.mz);
      return;
    }
    if (b.owner === p) {
      if (aiming) {
        if (relE) { this.doShot(p, inp.charge, inp.zc, inp.zr); return; }
        if (!inp.shootHeld && this.aim.t > 0.25) { this.doShot(p, inp.charge || 0.5, inp.zc, inp.zr); return; }
        return;
      }
      if (pressE || (relE && !inp.shootHeld)) {
        if (this.inShotRange(p)) {
          if (relE && !inp.shootHeld) { this.doShot(p, inp.charge, inp.zc, inp.zr); return; }
          this.startAim(p); return;
        }
        this.doLongKick(p); return;
      }
      if (passE) { this.doPass(p, inp.mx, inp.mz); return; }
      if (gocekE) {
        var f = this.faceVec(p);
        var lat = -f[1] * inp.mx + f[0] * inp.mz;
        this.doGocek(p, Math.abs(lat) > 0.2 ? lat : 0);
      }
      return;
    }
    // tanpa bola: ketuk = sliding tackle bila lawan dekat; ditahan lama = mengejar bola otomatis & merebut
    var car = b.owner;
    if (gocekE) {
      if (Math.abs(inp.mx) + Math.abs(inp.mz) > 0.2) p.facing = Math.atan2(inp.mx, inp.mz);
      if (!car || U.dist(p.x, p.z, car.x, car.z) < 4.5) this.doTackle(p, true);
    }
    if (inp.chase && !(car && car.team === team) && !aiming) {
      var lead = car ? 0.25 : 0.45;
      var tx = b.x + b.vx * lead, tz = b.z + b.vz * lead;
      if (car) { tx = car.x + car.vx * 0.3; tz = car.z + car.vz * 0.3; }
      var cdx = tx - p.x, cdz = tz - p.z, cd = Math.sqrt(cdx * cdx + cdz * cdz) || 1;
      var cspr = p.stamina > 8 && cd > 2.5;
      var cv = this.maxSpeed(p, cspr);
      p.dvx = cdx / cd * cv; p.dvz = cdz / cd * cv; p.sprint = cspr;
      p.chasing = true;
      if (car && cd < 1.45 && p.tackleCD <= 0) this.doTackle(p, false);
    } else p.chasing = false;
    void sdt; void dt;
  };

  /* ---------------- snapshot untuk jaringan ---------------- */
  S.snapshot = function () {
    var b = this.ball, self = this;
    var ps = [];
    this.players.forEach(function (p) {
      ps.push(Math.round(p.x * 100), Math.round(p.z * 100), Math.round(U.wrap(p.facing) * 100), Math.max(0, ANIMS.indexOf(p.anim)), (p.hidden ? 1 : 0) | (p.gkHold ? 2 : 0) | (p.celebrate ? 4 : 0) | (p.throwIn ? 8 : 0) | (p.sprint ? 16 : 0));
    });
    var pen = this.pen, so = this.shootout;
    return {
      v: 1, ht: Math.round(this.t * 1000), ph: PHASES.indexOf(this.phase), ts: Math.round(this.timeScale * 100), ck: Math.round(this.clock * 10),
      sc: [this.score[0], this.score[1]], se: [Math.round(this.sem[0]), Math.round(this.sem[1])],
      ac: [this.active[0] ? this.active[0].idx : -1, this.active[1] ? this.active[1].idx : -1],
      b: [Math.round(b.x * 100), Math.round(b.y * 100), Math.round(b.z * 100), this.code(b.owner), b.petirT > 0 ? 1 : 0, Math.round(b.holdT * 10)],
      p: ps, cn: [this.corners[0], this.corners[1]], gg: this.golden ? 1 : 0, am: this.aim ? this.code(this.aim.p) : -1,
      pn: pen ? [PEN_STATES.indexOf(pen.state), pen.team, ['single', 'shootout', 'practice'].indexOf(pen.kind), pen.shooter ? pen.shooter.idx : 0] : 0,
      so: so ? [so.kicks[0].join(''), so.kicks[1].join(''), so.done ? 1 : 0, so.winner] : 0,
      rv: [Object.keys(this.revealed[0]).join(','), Object.keys(this.revealed[1]).join(',')],
      wn: this.winner, gt: this.goalTeam == null ? -1 : this.goalTeam
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
