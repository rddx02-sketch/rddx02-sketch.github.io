/* Bola Api Arena — kecerdasan buatan pemain (NPC) */
(function (root) {
  'use strict';
  var BA = root.BA;
  var U = BA.U, D = BA.D, F = D.FIELD;
  var S = BA.Sim.prototype;

  S.moveTo = function (p, x, z, frac, sprint) {
    x = U.clamp(x, -F.L / 2 - 0.5, F.L / 2 + 0.5); z = U.clamp(z, -F.W / 2 - 0.5, F.W / 2 + 0.5);
    var dx = x - p.x, dz = z - p.z, d = Math.sqrt(dx * dx + dz * dz);
    if (d < 0.2) { p.dvx = 0; p.dvz = 0; return d; }
    var spr = !!sprint && p.stamina > 25 && d > 3;
    var v = this.maxSpeed(p, spr) * (frac == null ? 1 : frac);
    if (d < 1.8) v *= Math.max(0.25, d / 1.8);
    p.dvx = dx / d * v; p.dvz = dz / d * v; p.sprint = spr;
    return d;
  };

  S.findChaser = function (team, pred) {
    var best = null, bt = 1e9, self = this;
    this.players.forEach(function (p) {
      if (p.team !== team || p.hidden || p.role === 'GK') return;
      var t = U.dist(p.x, p.z, pred.x, pred.z) / self.maxSpeed(p, true) + (p.stunT > 0 ? p.stunT + 0.3 : 0);
      if (t < bt) { bt = t; best = p; }
    });
    return best;
  };

  S.assignDefense = function (team, car) {
    var self = this;
    var human = this.humans[team] ? this.active[team] : null;
    var defs = this.players.filter(function (p) { return p.team === team && p.role !== 'GK' && !p.hidden && p !== human; });
    defs.forEach(function (p) { p.markTarget = null; });
    defs.sort(function (a, b) { return U.dist(a.x, a.z, car.x, car.z) - U.dist(b.x, b.z, car.x, car.z); });
    var humanPress = human && U.dist(human.x, human.z, car.x, car.z) < 3.2;
    this.presser[team] = humanPress ? null : (defs[0] || null);
    var start = humanPress ? 0 : 1;
    this.cover[team] = defs[start] || null;
    var rest = defs.slice(start + 1);
    var opps = this.players.filter(function (o) { return o.team !== team && o !== car && o.role !== 'GK' && !o.hidden; });
    rest.forEach(function (p) {
      var bo = null, bd = 1e9;
      opps.forEach(function (o) {
        if (o.markedBy === team && o._markT === self.t) return;
        var d = U.dist(p.x, p.z, o.x, o.z);
        if (d < bd) { bd = d; bo = o; }
      });
      if (bo) { p.markTarget = bo; bo.markedBy = team; bo._markT = self.t; }
    });
  };

  S.aiUpdate = function (dt) {
    var b = this.ball, self = this;
    var poss = b.owner ? b.owner.team : (b.pass && b.pass.from ? b.pass.from.team : -1);
    var pred = this.predictBall(0.35);
    this.chaser[0] = this.findChaser(0, pred);
    this.chaser[1] = this.findChaser(1, pred);
    for (var t = 0; t < 2; t++) {
      if (b.owner && b.owner.team === 1 - t) this.assignDefense(t, b.owner);
      else { this.presser[t] = null; this.cover[t] = null; }
    }
    this.players.forEach(function (p) {
      if (p.hidden) return;
      if (self.humans[p.team] && self.active[p.team] === p) return;
      if (p.stunT > 0 || p.slideT > 0) { p.dvx = 0; p.dvz = 0; return; }
      if (p.role === 'GK') { self.aiKeeper(p, dt); return; }
      if (b.owner === p) { self.aiCarrier(p, dt); return; }
      if (b.pass && b.pass.to === p) { self.aiReceive(p, dt); return; }
      if (poss === p.team) self.aiSupport(p, dt);
      else if (poss === -1) self.aiLoose(p, dt, pred);
      else self.aiDefend(p, dt, pred);
    });
  };

  S.aiCarrier = function (p, dt) {
    var b = this.ball, dir = this.dirOf(p.team), gx = dir * F.L / 2;
    if (p.throwIn) {
      p.dvx = 0; p.dvz = 0;
      p.throwT = (p.throwT || 0) + dt;
      if (p.throwT > 0.75 + (p.idx % 3) * 0.2) this.doThrowIn(p, dir, -Math.sign(p.z) * 0.5);
      return;
    }
    var diff = this.diffOf(p.team);
    var f = this.faceVec(p), th = null, thd = 99;
    this.players.forEach(function (o) {
      if (o.team === p.team || o.hidden || o.stunT > 0) return;
      var dx = o.x - p.x, dz = o.z - p.z, d = Math.sqrt(dx * dx + dz * dz);
      var front = (dx * f[0] + dz * f[1]) / (d || 1);
      if (front > -0.35 && d < thd) { thd = d; th = o; }
    });
    var tx = gx - dir * 2.5, tz = U.clamp(p.z * 0.5, -5, 5);
    if (th && thd < 4.5) {
      var side = th.z > p.z ? -1 : 1;
      if (Math.abs(p.z) > F.W / 2 - 3) side = -Math.sign(p.z);
      tz = p.z + side * 4; tx = p.x + dir * 4;
    }
    tz = U.clamp(tz, -F.W / 2 + 1.5, F.W / 2 - 1.5);
    var open = thd > 5;
    this.moveTo(p, tx, tz, open ? 1 : 0.92, open && p.stamina > 40);
    p.aiT -= dt;
    if (p.aiT > 0) return;
    p.aiT = this.rng.range(0.16, 0.3) * [1.3, 1, 0.85][diff];
    var dGoal = U.dist(p.x, p.z, gx, 0);
    var range = [13, 15, 17][diff] + (p.role === 'FW' ? 2 : 0) - (p.role === 'DF' ? 3 : 0) + (F.ss - 1) * 6;
    var hot = this.rules.bolaPanas && b.holdT > 4.4;
    // sepak pojok / dekat garis akhir: umpan ke kotak
    if (Math.abs(p.x - gx) < 4 && Math.abs(p.z) > F.goalW / 2 + 3) {
      if (this.aiTryPass(p, true)) return;
    }
    var lane = 9, self = this;
    if (dGoal < range) this.players.forEach(function (o) { if (o.team !== p.team && !o.hidden && o.role !== 'GK') lane = Math.min(lane, self.segDist(o.x, o.z, p.x, p.z, gx, 0)); });
    var clear = lane > 1.3 || dGoal < 8;
    var sweet = 10 + (F.ss - 1) * 6;
    if (dGoal < range && Math.abs(p.z) < Math.max(10, F.boxW / 2 + 1) && this.inShotRange(p) && (clear || hot || this.rng() < 0.15)) {
      var pr = 0.015 + 0.14 * Math.exp(-Math.pow((dGoal - sweet) / (5 * F.ss), 2)) + (dGoal < 6 ? 0.15 : 0) + (thd < 2 ? 0.1 : 0) + (hot ? 0.5 : 0);
      if (thd > 4 && dGoal > 13 * F.ss) pr *= 0.5;
      if (this.rng() < pr) { var a = this.aiShotParams(p); this.doShot(p, a.charge, a.zc, a.zr); return; }
    }
    if (thd < 2.4 || hot) {
      if (this.rng() < (hot ? 0.95 : 0.45) && this.aiTryPass(p, true)) return;
      if (p.gocekCD <= 0 && this.rng() < 0.2) { this.doGocek(p, 0); return; }
      if (thd < 1.6 && (p.x * dir) < -F.L * 0.25 && this.rng() < 0.3) { this.doLongKick(p); return; }
      if (hot) { this.doLongKick(p); return; }
    } else if (this.rng() < 0.06) { this.aiTryPass(p, false); }
  };

  S.aiTryPass = function (p, pressured) {
    var dir = this.dirOf(p.team), self = this;
    var r = this.pickReceiver(p, dir, (this.rng() - 0.5) * 0.8);
    if (!r) return false;
    var open = 9;
    this.players.forEach(function (o) { if (o.team !== p.team && !o.hidden) open = Math.min(open, U.dist(o.x, o.z, r.x, r.z)); });
    var progress = (r.x - p.x) * dir;
    if (!pressured && (open < 3 || progress < -2)) return false;
    if (pressured && open < 1.2) return false;
    this.doPass(p, r.x - p.x, r.z - p.z);
    void self;
    return true;
  };

  S.aiShotParams = function (p) {
    var t = p.team, diff = this.diffOf(t), shot = p.shot, self = this;
    var k = this.pl(1 - t, 0), rev = this.revealed[1 - t];
    var best = D.ZONES[4], bs = -1e9;
    var cheat = diff === 2 ? 0.6 : (diff === 1 ? 0.25 : 0);
    D.ZONES.forEach(function (z) {
      var m = D.shotMult(shot, z.id);
      var special = k && k.style && k.style.map[z.id];
      var known = rev[z.id] || (special && self.rng() < cheat);
      var s = m + (known && special ? -0.55 : 0) + self.rng() * 0.35;
      if (s > bs) { bs = s; best = z; }
    });
    var lo = [0.42, 0.55, 0.65][diff], hi = [0.8, 0.84, 0.85][diff];
    var charge = this.rng.range(lo, hi), r = this.rng();
    var pPerfect = [0.06, 0.15, 0.3][diff], pOver = [0.12, 0.08, 0.05][diff];
    if (r < pPerfect) charge = this.rng.range(0.86, 0.99);
    else if (r < pPerfect + pOver) charge = this.rng.range(1.02, 1.15);
    return { charge: charge, zc: best.c, zr: best.r };
  };

  S.aiReceive = function (p, dt) {
    var b = this.ball;
    var sp = Math.sqrt(b.vx * b.vx + b.vz * b.vz);
    if (sp < 0.6) { this.moveTo(p, b.x, b.z, 1, true); return; }
    var wx = p.x - b.x, wz = p.z - b.z;
    var tt = (wx * b.vx + wz * b.vz) / (sp * sp);
    tt = U.clamp(tt, 0.05, 1.6);
    var ix = b.x + b.vx * tt * 0.85, iz = b.z + b.vz * tt * 0.85;
    this.moveTo(p, ix, iz, 1, U.dist(p.x, p.z, ix, iz) > 3);
    void dt;
  };

  S.aiSupport = function (p, dt) {
    var b = this.ball, dir = this.dirOf(p.team), self = this;
    var h = this.homePos(p, 1), tx = h.x, tz = h.z;
    var ss = F.ss;
    if (p.role === 'FW') {
      tx = U.clamp(b.x + dir * 8 * ss, -F.L / 2 + 6, F.L / 2 - 6);
      if ((tx - this.oppGoalX(p.team)) * dir > -4 * ss) tx = this.oppGoalX(p.team) - dir * 4 * ss;
      tz = h.z * 0.5 + (p.slot.fz >= 0 ? 3 : -3) * ss;
    } else if (p.role === 'MF') {
      tx = U.lerp(h.x, b.x - dir, 0.35);
      tz = U.lerp(h.z, b.z + (p.slot.fz >= 0 ? 6 : -6) * ss, 0.4);
    }
    var gap = 4 * ss;
    this.players.forEach(function (q) {
      if (q === p || q.team !== p.team || q.hidden) return;
      var dx = tx - q.x, dz = tz - q.z, d = Math.sqrt(dx * dx + dz * dz);
      if (d < gap && d > 0.01) { tx += dx / d * (gap - d) * 0.6; tz += dz / d * (gap - d) * 0.6; }
    });
    tz = U.clamp(tz, -F.W / 2 + 1, F.W / 2 - 1);
    var far = U.dist(p.x, p.z, tx, tz) > 8 * ss;
    this.moveTo(p, tx, tz, 0.85, far);
    void dt; void self;
  };

  S.aiLoose = function (p, dt, pred) {
    if (this.chaser[p.team] === p) { this.moveTo(p, pred.x, pred.z, 1, true); return; }
    var h = this.homePos(p, 0);
    this.moveTo(p, h.x, h.z, 0.75, false);
    void dt;
  };

  S.aiDefend = function (p, dt, pred) {
    var b = this.ball, car = b.owner, dir = this.dirOf(p.team), ownGX = -dir * F.L / 2;
    if (!car) {
      if (this.chaser[p.team] === p) { this.moveTo(p, pred.x, pred.z, 1, true); return; }
      var h0 = this.homePos(p, -1);
      this.moveTo(p, h0.x, h0.z, 0.85, false);
      return;
    }
    var diff = this.diffOf(p.team);
    if (this.presser[p.team] === p) {
      var gdx = ownGX - car.x, gdz = -car.z, gd = Math.sqrt(gdx * gdx + gdz * gdz) || 1;
      var tx = car.x + gdx / gd * 0.9, tz = car.z + gdz / gd * 0.9;
      this.moveTo(p, tx, tz, 1, true);
      var dc = U.dist(p.x, p.z, car.x, car.z);
      p.aiT -= dt;
      if (dc < 1.45 && p.tackleCD <= 0 && p.aiT <= 0 && !car.throwIn) {
        p.aiT = this.rng.range(0.18, 0.3);
        if (this.rng() < [0.24, 0.38, 0.5][diff]) this.doTackle(p, this.rng() < 0.3);
      }
      return;
    }
    if (this.cover[p.team] === p) {
      this.moveTo(p, U.lerp(car.x, ownGX, 0.45), car.z * 0.5, 0.9, false);
      return;
    }
    var m = p.markTarget;
    if (m && !m.hidden) {
      var mdx = ownGX - m.x, mdz = -m.z, md = Math.sqrt(mdx * mdx + mdz * mdz) || 1;
      this.moveTo(p, m.x + mdx / md * 1.5, m.z + mdz / md * 1.5, 0.9, U.dist(p.x, p.z, m.x, m.z) > 6);
      return;
    }
    var h = this.homePos(p, -1);
    this.moveTo(p, h.x, h.z, 0.85, false);
  };

  /* kiper menyergap penyerang yang terlalu dekat */
  S.keeperSmother = function (gk, car) {
    gk.tackleCD = 1.3;
    var diff = this.diffOf(gk.team);
    var pr = U.clamp(0.36 + (gk.st.refleks - car.st.gocek) / 150 + (car.gocekT > 0 ? -0.2 : 0) + (this.humans[gk.team] ? 0 : [-0.08, 0, 0.06][diff]), 0.12, 0.7);
    gk.anim = 'gkDive'; gk.animT = 0;
    if (this.rng() < pr) {
      car.stunT = 0.3;
      this.givePossession(gk, true);
      this.addSem(gk.team, 4);
      this.emit({ k: 'save', kind: 'smother', team: gk.team });
      this.emit({ k: 'say', text: gk.name + ' menyergap bola!' });
    } else {
      gk.stunT = 0.7;
      this.emit({ k: 'tackle', ok: 0, p: this.code(gk), on: this.code(car) });
      if (this.rng() < 0.5) this.emit({ k: 'say', text: gk.name + ' terkecoh! Gawang terbuka!' });
    }
  };

  S.aiKeeper = function (p, dt) {
    var b = this.ball, dir = this.dirOf(p.team), gx = -dir * F.L / 2;
    if (b.owner === p) {
      if (p.gkHold) {
        p.dvx = 0; p.dvz = 0;
        p.gkHoldT += dt;
        if (p.gkHoldT > 1.2) this.gkDistribute(p, 0, 0);
        return;
      }
      if (!this.aiTryPass(p, true)) this.doLongKick(p);
      return;
    }
    var ballInBox = Math.abs(b.x - gx) < F.boxL + 0.5 && Math.abs(b.z) < F.boxW / 2 + 0.5;
    var dB = U.dist(p.x, p.z, b.x, b.z);
    var free = !b.owner;
    var heading = free && (b.vx * -dir) > 3;
    if (free && ballInBox && (dB < 7 || heading) && b.y < 2.3) {
      var pr = this.predictBall(0.2);
      this.moveTo(p, pr.x, pr.z, 1, true);
      return;
    }
    if (b.owner && b.owner.team !== p.team && !b.owner.throwIn && ballInBox && dB < 4) {
      this.moveTo(p, U.lerp(p.x, b.x, 0.6), U.lerp(p.z, b.z, 0.6), 1, true);
      if (dB < 1.5 && p.tackleCD <= 0) this.keeperSmother(p, b.owner);
      return;
    }
    var bdx = b.x - gx, bdz = b.z, bl = Math.sqrt(bdx * bdx + bdz * bdz) || 1;
    var depth = U.clamp(bl * 0.1, 0.4, 2.0);
    var tx = gx + bdx / bl * depth;
    var tz = U.clamp(bdz / bl * depth * 1.5 + b.z * 0.12, -F.goalW / 2 + 0.35, F.goalW / 2 - 0.35);
    if ((tx - gx) * dir < 0.3) tx = gx + dir * 0.3;
    this.moveTo(p, tx, tz, 1, false);
  };
})(typeof window !== 'undefined' ? window : globalThis);
