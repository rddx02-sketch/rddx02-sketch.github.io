/* Bola Api Arena — lanjutan simulasi: kursi pengendali (sampai 8 manusia), tendangan jauh & cungkil,
   kebugaran & cedera, formasi, pergantian pemain */
(function (root) {
  'use strict';
  var BA = root.BA;
  var U = BA.U, D = BA.D, F = D.FIELD;
  var Sim = BA.Sim, S = Sim.prototype;
  var R = F.ballR;
  Sim.MAX_SEATS = 8;

  /* ======================================================================
     KURSI PENGENDALI
     seats[i] = { team, p, swT } atau null. cfg.seats = [0, 0, 1, -1, ...] (tim tiap kursi; -1 = kosong).
     Bentuk lama tetap didukung: humans [bool, bool] → kursi 0 = tim 0, kursi 1 = tim 1; coop → kursi 0 & 1 di tim 0.
     ====================================================================== */
  S.initSeats = function (cfg) {
    var list;
    if (Array.isArray(cfg.seats)) list = cfg.seats.slice(0, Sim.MAX_SEATS);
    else if (cfg.coop) list = [0, 0];
    else { var hm = cfg.humans || [true, false]; list = [hm[0] ? 0 : -1, hm[1] ? 1 : -1]; }
    while (list.length < 2) list.push(-1);
    this.seats = list.map(function (t) { return (t === 0 || t === 1) ? { team: t, p: null, swT: 0 } : null; });
    this.humans = [false, false];
    this.refreshHumans();
  };
  S.refreshHumans = function () {
    var h = [false, false];
    this.seats.forEach(function (s) { if (s) h[s.team] = true; });
    this.humans[0] = h[0]; this.humans[1] = h[1];
  };
  S.teamSeats = function (team) {
    var out = [];
    for (var i = 0; i < this.seats.length; i++) if (this.seats[i] && this.seats[i].team === team) out.push(i);
    return out;
  };
  S.seatOf = function (p) {
    if (!p) return -1;
    for (var i = 0; i < this.seats.length; i++) if (this.seats[i] && this.seats[i].p === p) return i;
    return -1;
  };
  S.seatP = function (si) { var s = this.seats[si]; return (s && s.p && this.humans[s.team]) ? s.p : null; };
  /* pemain yang sedang dikendalikan manusia? */
  S.isCtl = function (p) { return !!p && this.humans[p.team] && this.seatOf(p) >= 0; };
  /* kosongkan satu kursi (pemain keluar dari laga online): pemainnya kembali dipegang NPC */
  S.clearSeat = function (si) {
    if (!this.seats[si]) return;
    this.seats[si] = null;
    this.refreshHumans();
    this.syncActive();
  };
  /* buka lagi kursi yang sempat kosong (pemain online tersambung kembali di tengah laga) */
  S.openSeat = function (si, team) {
    if (!(si >= 0) || si >= Sim.MAX_SEATS || (team !== 0 && team !== 1)) return false;
    if (this.seats[si]) return this.seats[si].team === team;
    if (this.teamSeats(team).length >= this.n - 1) return false;
    while (this.seats.length <= si) { this.seats.push(null); this.inputs.push(Sim.blankInput()); this.hs.push(Sim.blankHs()); this.inPrimed.push(false); }
    this.seats[si] = { team: team, p: null, swT: 0 };
    this.inputs[si] = Sim.blankInput(); this.hs[si] = Sim.blankHs(); this.inPrimed[si] = false;
    this.refreshHumans();
    return true;
  };
  S.clearSeats = function () { for (var i = 0; i < this.seats.length; i++) this.seats[i] = null; this.refreshHumans(); this.syncActive(); };
  S.dropCtl = function (p) { var si = this.seatOf(p); if (si >= 0) { this.seats[si].p = null; this.syncActive(); } };
  /* bidang lama active[tim] / active2 tetap diisi (dipakai HUD, narator, dan tes) */
  S.syncActive = function () {
    var a0 = null, a1 = null;
    for (var i = 0; i < this.seats.length; i++) {
      var s = this.seats[i];
      if (!s || !s.p || !this.humans[s.team]) continue;
      if (s.team === 0) { if (!a0) a0 = s.p; } else if (!a1) a1 = s.p;
    }
    this.active[0] = a0; this.active[1] = a1;
    var s1 = this.seats[1];
    this.active2 = (this.coop && s1 && s1.team === 0) ? s1.p : null;
  };
  S.predictBall = function (t) {
    var b = this.ball;
    if (b.owner) return { x: b.x + b.owner.vx * t, z: b.z + b.owner.vz * t };
    return { x: b.x + b.vx * t * 0.8, z: b.z + b.vz * t * 0.8 };
  };
  /* pemain bebas (bukan kiper, tidak dipegang manusia) terdekat ke titik */
  S.bestFree = function (team, pt, except) {
    var best = null, bd = 1e9, self = this;
    this.players.forEach(function (p) {
      if (p.team !== team || p.role === 'GK' || p.hidden || p === except || self.seatOf(p) >= 0) return;
      var d = U.dist(p.x, p.z, pt.x, pt.z);
      if (d < bd) { bd = d; best = p; }
    });
    return best;
  };

  S.updateSeats = function (dt) {
    var b = this.ball, self = this, i, s;
    for (i = 0; i < this.seats.length; i++) { s = this.seats[i]; if (s && s.p && (s.p.hidden || s.p.role === 'GK' || s.p.team !== s.team)) s.p = null; }
    for (var t = 0; t < 2; t++) {
      if (!this.humans[t]) continue;
      var list = this.teamSeats(t);
      if (!list.length) continue;
      /* pembawa bola / penerima operan yang belum dipegang → diberikan ke kursi terdekat */
      var tgt = null;
      if (b.owner && b.owner.team === t && b.owner.role !== 'GK') tgt = b.owner;
      else if (b.pass && b.pass.to && b.pass.to.team === t && b.pass.to.role !== 'GK' && !b.pass.to.hidden) tgt = b.pass.to;
      if (tgt && this.seatOf(tgt) < 0) this.claim(tgt, -1);
      var pred = this.predictBall(0.3);
      for (i = 0; i < list.length; i++) { s = this.seats[list[i]]; if (!s.p) { s.p = this.bestFree(t, pred, null); s.swT = 0; } }
      if (tgt) { for (i = 0; i < list.length; i++) this.seats[list[i]].swT = 0; continue; }
      /* pindah otomatis ke pemain bebas yang jauh lebih dekat ke bola — hanya bila tim dipegang satu manusia;
         tim berisi beberapa manusia: tiap orang tetap di pemainnya sampai menekan GANTI atau menerima bola */
      if (list.length > 1) continue;
      var margin = 2.5;
      for (i = 0; i < list.length; i++) {
        s = this.seats[list[i]];
        var cur = s.p;
        if (!cur) continue;
        var best = this.bestFree(t, pred, cur);
        if (!best) { s.swT = 0; continue; }
        var dc = U.dist(cur.x, cur.z, pred.x, pred.z), bd = U.dist(best.x, best.z, pred.x, pred.z);
        if (bd + margin < dc) { s.swT += dt; if (s.swT > 0.22) { s.p = best; s.swT = 0; } } else s.swT = 0;
      }
    }
    this.syncActive();
    void self;
  };

  /* beri kendali pemain p ke satu kursi timnya: pref = indeks kursi yang diutamakan, -1 = yang pemainnya paling dekat */
  S.claim = function (p, pref) {
    if (!p || p.role === 'GK' || p.hidden || !this.humans[p.team]) return;
    if (this.seatOf(p) >= 0) return;
    var list = this.teamSeats(p.team), si = -1, bd = 1e9;
    if (pref != null && pref >= 0 && this.seats[pref] && this.seats[pref].team === p.team) si = pref;
    else for (var k = 0; k < list.length; k++) {
      var s = this.seats[list[k]];
      if (!s.p || s.p.hidden) { si = list[k]; break; }
      var d = U.dist(s.p.x, s.p.z, p.x, p.z);
      if (d < bd) { bd = d; si = list[k]; }
    }
    if (si < 0) return;
    this.seats[si].p = p; this.seats[si].swT = 0;
    this.syncActive();
  };
  /* operan dari pemain terkendali: penerima ikut pengendali si pengoper (kecuali sudah dipegang manusia lain) */
  S.claimFor = function (from, r) {
    if (!r || !from || r.team !== from.team || !this.humans[from.team] || r.role === 'GK') return;
    if (this.seatOf(r) >= 0) return;
    var sf = this.seatOf(from);
    if (sf >= 0) { this.seats[sf].p = r; this.seats[sf].swT = 0; this.syncActive(); }
    else this.claim(r, -1);
  };
  S.switchSeat = function (si) {
    var s = this.seats[si];
    if (!s) return;
    var cur = s.p, pred = this.predictBall(0.3), self = this;
    var list = this.players.filter(function (p) { return p.team === s.team && p.role !== 'GK' && !p.hidden && p !== cur && self.seatOf(p) < 0; });
    list.sort(function (a, b) { return U.dist(a.x, a.z, pred.x, pred.z) - U.dist(b.x, b.z, pred.x, pred.z); });
    if (list[0]) { s.p = list[0]; s.swT = 0; this.syncActive(); this.emit({ k: 'switch', team: s.team, ctl: si }); }
  };
  /* nama lama (dipakai tes): ganti pemain kursi pertama tim */
  S.switchActive = function (team) { var l = this.teamSeats(team); if (l.length) this.switchSeat(l[0]); };

  /* kursi yang menendang penalti: pengendali si penendang, atau bergiliran antar manusia tim itu saat adu penalti */
  S.penSeat = function (pen) {
    if (!pen || !this.humans[pen.team]) return -1;
    if (pen.seat != null && this.seats[pen.seat] && this.seats[pen.seat].team === pen.team) return pen.seat;
    var list = this.teamSeats(pen.team);
    if (!list.length) return -1;
    var si = this.seatOf(pen.shooter);
    if (si < 0 || this.seats[si].team !== pen.team) {
      if (pen.kind === 'shootout' && this.shootout) si = list[this.shootout.n[pen.team] % list.length];
      else si = list[0];
    }
    pen.seat = si;
    return si;
  };

  /* tendangan jurus dari masukan manusia; mode mudah: ketukan singkat = tenaga & arah otomatis */
  S.shootBy = function (p, inp, charge) {
    var c = charge == null ? inp.charge : charge, zc = inp.zc, zr = inp.zr;
    if (inp.easy && c < 0.3) {
      var a = this.aiShotParams(p);
      c = 0.8;
      if (zc === 0 && zr === 1) { zc = a.zc; zr = a.zr; }
    }
    this.doShot(p, c, zc, zr);
  };

  /* si = indeks kursi */
  S.humanControl = function (si, sdt, dt) {
    var seat = this.seats[si];
    if (!seat) return;
    var team = seat.team, inp = this.inputs[si], hs = this.hs[si], b = this.ball;
    var passE = inp.passSeq !== hs.passSeq, gocekE = inp.gocekSeq !== hs.gocekSeq, swE = inp.switchSeq !== hs.switchSeq, lobE = inp.lobSeq !== hs.lobSeq;
    var longE = inp.longSeq !== hs.longSeq, chipE = inp.chipSeq !== hs.chipSeq;
    var relE = inp.shootSeq !== hs.shootSeq, pressE = inp.shootHeld && !hs.shootHeld;
    hs.passSeq = inp.passSeq; hs.gocekSeq = inp.gocekSeq; hs.switchSeq = inp.switchSeq; hs.shootSeq = inp.shootSeq; hs.shootHeld = inp.shootHeld; hs.skipSeq = inp.skipSeq; hs.lobSeq = inp.lobSeq;
    hs.longSeq = inp.longSeq; hs.chipSeq = inp.chipSeq;
    var lob = false, lobRaw = lobE;
    if (!inp.chase) hs.noChase = false;
    if (lobE && !passE) { passE = true; lob = true; }
    inp._lob = lob;
    var gk = this.pl(team, 0);
    if (gk && gk.gkHold && b.owner === gk) {
      if (passE || relE || longE || chipE) this.gkDistribute(gk, inp.mx, inp.mz);
    }
    var p = seat.p;
    if (!p || p.hidden) return;
    var aiming = this.aim && this.aim.p === p;
    var mateHas = b.owner && b.owner.team === team;
    if (swE && b.owner !== p && (!mateHas || this.teamSeats(team).length > 1)) { this.switchSeat(si); p = seat.p; if (!p) return; aiming = false; }
    if (p.stunT > 0 || p.slideT > 0) return;
    // gerak
    if (aiming) { p.dvx = 0; p.dvz = 0; }
    else {
      var spr = inp.sprint && p.stamina > 8 && !p.injured;
      var v = this.maxSpeed(p, spr);
      p.dvx = inp.mx * v; p.dvz = inp.mz * v; p.sprint = spr && (Math.abs(inp.mx) + Math.abs(inp.mz) > 0.2);
    }
    if (b.owner === p && p.throwIn) {
      p.dvx = 0; p.dvz = 0;
      if (Math.abs(inp.mx) + Math.abs(inp.mz) > 0.3) p.facing = U.angLerp(p.facing, Math.atan2(inp.mx, inp.mz), 0.15);
      p.throwT = (p.throwT || 0) + sdt;
      if (passE || relE || pressE || gocekE || longE || chipE || p.throwT > 5) this.doThrowIn(p, inp.mx, inp.mz, lob ? 1 : 0);
      return;
    }
    if (b.owner === p) {
      if (longE) { hs.noChase = true; this.doStrike(p, 'jauh', inp.longCharge, inp.mx, inp.mz); return; }
      if (chipE) { this.doStrike(p, 'cungkil', inp.chipCharge, inp.mx, inp.mz); return; }
      if (aiming) {
        if (relE) { this.shootBy(p, inp); return; }
        if (!inp.shootHeld && this.aim.t > 0.25) { this.shootBy(p, inp, inp.charge || 0.5); return; }
        return;
      }
      if (pressE || (relE && !inp.shootHeld)) {
        if (this.inShotRange(p)) {
          if (relE && !inp.shootHeld) { this.shootBy(p, inp); return; }
          this.startAim(p); return;
        }
        this.doLongKick(p); return;
      }
      if (passE) { if (lob) this.doLob(p, inp.mx, inp.mz, inp.lobCharge); else this.doPass(p, inp.mx, inp.mz, inp.passCharge); return; }
      if (gocekE) {
        var f = this.faceVec(p);
        var lat = -f[1] * inp.mx + f[0] * inp.mz;
        this.doGocek(p, Math.abs(lat) > 0.2 ? lat : 0);
      }
      return;
    }
    // tanpa bola: ketuk = sliding tackle bila lawan dekat; ditahan lama = mengejar bola otomatis & merebut
    var car = b.owner;
    // penerima operan yang stiknya diam: otomatis menjemput bola (seperti rekan NPC), stik digerakkan = kendali penuh pemain
    if (!car && b.pass && b.pass.to === p && Math.abs(inp.mx) + Math.abs(inp.mz) < 0.2 && !aiming) { this.aiReceive(p, sdt); }
    var oppCar = car && car.team !== team;
    /* □ tanpa bola = sapu (sliding tackle); ○ tanpa bola = rebut berdiri (ditahan = kejar bola) */
    if (gocekE || (lobRaw && !(car && car.team === team))) {
      if (Math.abs(inp.mx) + Math.abs(inp.mz) > 0.2) p.facing = Math.atan2(inp.mx, inp.mz);
      if (!car || U.dist(p.x, p.z, car.x, car.z) < 4.5) this.doTackle(p, true);
    }
    if (longE && oppCar && !hs.noChase && p.tackleCD <= 0 && U.dist(p.x, p.z, car.x, car.z) < 2.2) this.doTackle(p, false);
    if (inp.chase && !hs.noChase && !(car && car.team === team) && !aiming) {
      var lead = car ? 0.25 : 0.45;
      var tx = b.x + b.vx * lead, tz = b.z + b.vz * lead;
      if (car) { tx = car.x + car.vx * 0.3; tz = car.z + car.vz * 0.3; }
      var cdx = tx - p.x, cdz = tz - p.z, cd = Math.sqrt(cdx * cdx + cdz * cdz) || 1;
      var cspr = p.stamina > 8 && cd > 2.5 && !p.injured;
      var cv = this.maxSpeed(p, cspr);
      p.dvx = cdx / cd * cv; p.dvz = cdz / cd * cv; p.sprint = cspr;
      p.chasing = true;
      if (car && cd < 1.45 && p.tackleCD <= 0) this.doTackle(p, false);
    } else p.chasing = false;
    void dt;
  };

  /* ======================================================================
     TENDANGAN JAUH & CUNGKIL (tendangan fisik ke gawang tanpa adegan jurus)
     Hasil diundi saat menendang (akurasi, jangkauan kiper), lalu bola terbang mengikuti lintasan ke titik sasaran.
     ====================================================================== */
  S.strikeRange = function (kind) { return kind === 'cungkil' ? Math.min(F.shot * 1.05, 30) : Math.min(F.shot * 1.7, F.L * 0.6, 42); };
  /* pengali tenaga tendangan dari kebugaran */
  S.kickFit = function (p) { return p.injured ? 0.85 : (0.92 + 0.08 * Math.min(1, p.energy / 40)); };

  S.doStrike = function (p, kind, pow, mx, mz) {
    var b = this.ball;
    if (b.owner !== p || p.throwIn || p.gkHold) return;
    this.cancelAim();
    var t = p.team, dir = this.dirOf(t), gx = dir * F.L / 2;
    pow = U.num(pow, 0);
    pow = pow > 0.01 ? U.clamp(pow, 0.25, 1.25) : 0.8; /* ketukan singkat = tenaga otomatis */
    mx = U.num(mx, 0); mz = U.num(mz, 0);
    var d = U.dist(p.x, p.z, gx, 0), f = this.faceVec(p);
    var sl = Math.sqrt(mx * mx + mz * mz);
    var ax = sl > 0.25 ? mx / sl : f[0], az = sl > 0.25 ? mz / sl : f[1];
    var toward = d > 0.01 ? ((gx - p.x) * ax + (0 - p.z) * az) / d : 1;
    var deadAngle = Math.abs(p.x - gx) < 1.4 && Math.abs(p.z) > F.goalW / 2 + 0.8;
    if (d > this.strikeRange(kind) || toward < 0.3 || deadAngle) { this.doClear(p, kind, pow, ax, az); return; }
    var keeper = this.pl(1 - t, 0);
    var hasK = !!keeper && !keeper.hidden && keeper.stunT <= 0.15 && (keeper.x - p.x) * dir > 0.4;
    var half = F.goalW / 2, pressure = this.pressureOn(p);
    var over = pow > 1.02, perfect = pow >= 0.86 && pow <= 1.0;
    var kz = hasK ? keeper.z : 0;
    var side;
    if (sl > 0.25 && Math.abs(az) > 0.42) side = az > 0 ? 1 : -1;
    else if (Math.abs(kz) > 0.25) side = kz > 0 ? -1 : 1;
    else if (Math.abs(p.z) > 1.2) side = p.z > 0 ? -1 : 1;
    else side = this.rng() < 0.5 ? -1 : 1;
    var place = U.clamp((perfect ? 0.84 : 0.7) * (0.9 + (p.st.tendang - 70) / 300), 0.45, 0.9);
    var tz = side * half * place, ty, apex, v;
    var spdMul = D.bv(this.ballDef, 'spd') * (0.94 + 0.06 * p.st.footMul);
    if (kind === 'cungkil') { ty = F.goalH * 0.62; v = (10.5 + pow * 4.5) * spdMul; apex = U.clamp(1.6 + d * 0.16, 2.4, 6); }
    else { ty = F.goalH * (0.18 + 0.5 * U.clamp(pow - 0.35, 0, 0.7)); v = (17 + pow * 13) * spdMul * this.kickFit(p); apex = 0.15 + d * 0.012; }
    var acc = kind === 'cungkil'
      ? 0.92 - Math.max(0, d - 9) * 0.02 - pressure * 0.2 + (p.st.gocek - 70) / 260
      : 0.94 - Math.max(0, d - 12) * 0.015 - pressure * 0.2 + (p.st.tendang - 70) / 220;
    if (over) acc -= 0.28 + (pow - 1.02) * 1.5;
    if (perfect) acc += 0.05;
    if (p.injured) acc -= 0.1;
    acc = U.clamp(acc * D.wv(this.weather, 'shot'), 0.08, 0.97);
    var tx = gx + dir * 0.55;
    var res, pSave = 0;
    if (this.rng() > acc) res = 'miss';
    else {
      if (hasK) {
        var kOff = Math.abs(keeper.x - gx);
        if (kind === 'cungkil') {
          pSave = kOff > 2.2 ? Math.max(0.07, 0.3 - (kOff - 2.2) * 0.06) : U.lerp(0.9, 0.3, U.clamp((kOff - 1) / 1.2, 0, 1));
          pSave += Math.max(0, d - 16) * 0.02;
        } else {
          var T0 = U.dist(p.x, p.z, tx, tz) / v, lat = Math.abs(tz - kz * 0.85);
          var reach = 0.9 + (keeper.st.refleks / 100) * 4.2 * Math.max(0, T0 - 0.2);
          pSave = Math.min(0.86, 0.5 + (reach - lat) * 0.35 + Math.max(0, 14 - d) * 0.05);
        }
        var aiDef = !this.humans[1 - t], aiAtt = !this.humans[t];
        if (aiDef && !aiAtt) pSave += [-0.09, 0, 0.06][this.diffOf(1 - t)];
        if (aiAtt && !aiDef) pSave += [0.08, 0, -0.05][this.diffOf(t)];
        pSave = U.clamp(pSave * D.wv(this.weather, 'keep'), 0.04, 0.93);
      }
      res = this.rng() < pSave ? 'save' : (this.rng() < 0.045 ? 'post' : 'goal');
    }
    if (res === 'miss') {
      if (over || this.rng() < (kind === 'cungkil' ? 0.55 : 0.35)) { ty = F.goalH + this.rng.range(0.5, 2.2); tz = side * half * this.rng.range(0.1, 0.9); }
      else tz = side * (half + this.rng.range(0.5, 2.6));
      tx = gx + dir * 1.2;
    } else if (res === 'post') { tz = side * half; tx = gx; ty = Math.min(ty, F.goalH - 0.3); }
    this.setFacingTo(p, tx, tz);
    this.kickFree(p, 0, 0, 0, null, 'shoot');
    var x0 = b.x, z0 = b.z, y0 = b.y;
    var dd = U.dist(x0, z0, tx, tz);
    var T = Math.max(0.18, dd / Math.max(v, 1) + (kind === 'cungkil' ? 0.2 : 0));
    var sh = { team: t, p: p, kind: kind, res: res, x0: x0, y0: y0, z0: z0, tx: tx, ty: ty, tz: tz, T: T, t: 0, apex: apex, us: 1, sx: tx, sz: tz, blk: {}, v: v, dove: 0 };
    if (res === 'save') {
      var kOff2 = Math.abs(keeper.x - gx);
      var xs = gx - dir * U.clamp(kOff2, 0.55, kind === 'cungkil' ? 0.9 : 3.2);
      sh.us = U.clamp((xs - x0) / ((tx - x0) || 1e-6), 0.3, 0.97);
      sh.sx = x0 + (tx - x0) * sh.us; sh.sz = z0 + (tz - z0) * sh.us;
    }
    b.shot = sh;
    b.vx = (tx - x0) / T; b.vz = (tz - z0) / T; b.vy = 0;
    this.stats[t].shots++;
    if (res !== 'miss') this.stats[t].onTarget++;
    this.addSem(t, 1);
    this.emit({ k: 'strike', p: this.code(p), kind: kind, pow: Math.round(pow * 100), d: Math.round(d) });
  };

  /* di luar jangkauan / membelakangi gawang: JAUH = tendangan panjang ke arah stik, CUNGKIL = bola lambung ke depan */
  S.doClear = function (p, kind, pow, ax, az) {
    if (kind === 'cungkil') { this.doLob(p, ax, az, Math.max(0.5, pow)); return; }
    var b = this.ball, spdMul = D.bv(this.ballDef, 'spd');
    var v = (13 + pow * 12) * spdMul * this.kickFit(p), vy = 4.5 + pow * 3.5;
    p.facing = Math.atan2(ax, az);
    this.kickFree(p, ax * v, vy, az * v, null, 'shoot');
    var tf = 2 * vy / 9.8;
    var lx = U.clamp(b.x + ax * v * tf * 0.82, -F.L / 2 + 0.5, F.L / 2 - 0.5), lz = U.clamp(b.z + az * v * tf * 0.82, -F.W / 2 + 0.5, F.W / 2 - 0.5);
    var m = this.nearestMate(p, lx, lz);
    if (m) {
      b.pass = { to: m, from: p, t: 0, tx: lx, tz: lz, lob: 1, loose: 1 };
      if (this.isOffside(p, m)) b.pass.off = true;
      this.claimFor(p, m);
    }
    this.emit({ k: 'kick', p: this.code(p) });
  };

  S.stepShot = function (dt) {
    var b = this.ball, sh = b.shot;
    if (!sh) return;
    var px = b.x, pz = b.z;
    sh.t += dt;
    var u = Math.min(1, sh.t / sh.T);
    b.x = sh.x0 + (sh.tx - sh.x0) * u; b.z = sh.z0 + (sh.tz - sh.z0) * u;
    b.y = Math.max(R, sh.y0 + (sh.ty - sh.y0) * u + sh.apex * 4 * u * (1 - u));
    b.vx = (sh.tx - sh.x0) / sh.T; b.vz = (sh.tz - sh.z0) / sh.T; b.vy = ((sh.ty - sh.y0) + sh.apex * 4 * (1 - 2 * u)) / sh.T;
    b.pass = null;
    var dir = this.dirOf(sh.team), def = 1 - sh.team;
    /* badan pemain bertahan di jalur bola bisa memblok */
    if (b.y < 1.7 && u < 0.92) {
      for (var i = 0; i < this.players.length; i++) {
        var o = this.players[i];
        if (o.team !== def || o.hidden || o.role === 'GK' || o.stunT > 0 || sh.blk[o.idx]) continue;
        if (this.segDist(o.x, o.z, px, pz, b.x, b.z) > 0.6) continue;
        sh.blk[o.idx] = 1;
        if (this.rng() < (b.y < 1.1 ? 0.6 : 0.3)) {
          b.shot = null; b.last = o;
          var a = this.rng.range(-1.3, 1.3), sp = this.rng.range(3, 7);
          b.vx = -dir * Math.cos(a) * sp; b.vz = Math.sin(a) * sp; b.vy = this.rng.range(1, 3.5);
          b.noTouch = o; b.noTouchT = 0.3;
          this.emit({ k: 'deflect' });
          this.emit({ k: 'block', p: this.code(o), team: def });
          return;
        }
      }
    }
    if (sh.res === 'save' && u >= sh.us) { this.finishSave(sh); return; }
    if (u < 1) return;
    b.shot = null;
    if (sh.res === 'goal') { this.goalSk = sh.kind; this.scoreGoal(sh.team, sh.p, null, true, false); return; }
    if (sh.res === 'post') {
      b.x = sh.tx - dir * 0.25; b.last = sh.p;
      b.vx = -dir * this.rng.range(5, 9); b.vz = -(sh.tz >= 0 ? 1 : -1) * this.rng.range(1.5, 5); b.vy = this.rng.range(0.5, 3);
      this.emit({ k: 'post' });
      return;
    }
    this.emit({ k: 'miss', p: this.code(sh.p), sk: sh.kind });
  };

  S.finishSave = function (sh) {
    var b = this.ball, dir = this.dirOf(sh.team), def = 1 - sh.team, keeper = this.pl(def, 0);
    /* titik bola mengenai sarung tangan & kerasnya tendangan, untuk efek tangkapan di layar */
    var ex = Math.round(b.x * 100) / 100, ey = Math.round(Math.max(0.3, b.y) * 100) / 100, ez = Math.round(b.z * 100) / 100, pw = Math.round(U.clamp(U.num(sh.v, 18) / 28, 0.3, 1.3) * 100);
    b.shot = null;
    if (!keeper || keeper.hidden) { this.goalSk = sh.kind; b.x = sh.tx; b.z = sh.tz; this.scoreGoal(sh.team, sh.p, null, true, false); return; }
    keeper.x = U.lerp(keeper.x, b.x + dir * 0.25, 0.85); keeper.z = U.lerp(keeper.z, b.z, 0.85); keeper.vx = keeper.vz = 0;
    this.stats[def].saves++;
    this.addSem(def, 5);
    var catchP = sh.kind === 'cungkil' ? 0.85 : U.clamp(0.8 - (sh.v - 16) * 0.04, 0.2, 0.85) * D.wv(this.weather, 'keepNormal');
    if (this.rng() < catchP) {
      this.resetBallFree();
      b.last = keeper; b.x = keeper.x; b.z = keeper.z;
      this.givePossession(keeper, true);
      keeper.gkHoldT = -0.3;
      this.emit({ k: 'save', kind: 'catch', team: def, sk: sh.kind, x: ex, y: ey, z: ez, pw: pw });
      return;
    }
    keeper.stunT = Math.max(keeper.stunT, 0.4);
    if (this.rules.bound === 'keluar' && this.rng() < 0.35) {
      this.emit({ k: 'save', kind: 'parry', team: def, sk: sh.kind, x: ex, y: ey, z: ez, pw: pw, out: 1 });
      this.awardCorner(sh.team, dir, b.z >= 0 ? 1 : -1);
      return;
    }
    b.last = keeper; b.pass = null;
    b.vx = -dir * this.rng.range(4, 8); b.vz = (b.z >= 0 ? 1 : -1) * this.rng.range(2, 6) * (this.rng() < 0.3 ? -1 : 1); b.vy = this.rng.range(2, 4.5);
    b.y = Math.max(b.y, 0.5);
    b.noTouch = keeper; b.noTouchT = 0.45;
    this.emit({ k: 'save', kind: 'parry', team: def, sk: sh.kind, x: ex, y: ey, z: ez, pw: pw });
  };

  /* kiper menghadapi tendangan fisik: mengejar titik tangkap (diselamatkan) atau bereaksi terlambat (gol/meleset) */
  S.keeperVsShot = function (k, dt) {
    var b = this.ball, sh = b.shot, dirA = this.dirOf(sh.team), gx = dirA * F.L / 2;
    var saving = sh.res === 'save';
    var left = sh.T * (saving ? sh.us : 1) - sh.t;
    var tx, tz;
    if (saving) { tx = sh.sx + dirA * 0.25; tz = sh.sz; }
    else { tx = gx - dirA * 0.55; tz = U.clamp(sh.tz, -F.goalW / 2 + 0.3, F.goalW / 2 - 0.3); }
    k.faceLock = 1;
    k.facing = U.angLerp(k.facing, Math.atan2(b.x - k.x, b.z - k.z), Math.min(1, dt * 14));
    var dx = tx - k.x, dz = tz - k.z, d = Math.sqrt(dx * dx + dz * dz);
    if (!saving && sh.t < 0.18) { k.dvx = 0; k.dvz = 0; }
    else if (d < 0.08) { k.dvx = 0; k.dvz = 0; }
    else {
      var v = saving ? Math.min(12, d / Math.max(0.05, left)) : this.maxSpeed(k, false) * 0.8;
      k.dvx = dx / d * v; k.dvz = dz / d * v;
    }
    if (!sh.dove && left < 0.34 && sh.res !== 'miss') {
      sh.dove = 1;
      var lx = Math.cos(k.facing), lz = -Math.sin(k.facing);
      var side = dx * lx + dz * lz;
      k.diveSide = Math.abs(side) < 0.45 ? 0 : (side >= 0 ? 1 : -1);
      k.anim = 'gkDive'; k.animT = 0;
    }
  };

  /* NPC sesekali memakai tendangan jauh, dan mencungkil bila kiper maju */
  S.aiStrike = function (p, dGoal, thd) {
    var t = p.team, k = this.pl(1 - t, 0);
    if (!k || p.role === 'GK' || this.mode !== 'match') return false;
    var diff = this.diffOf(t), gx = this.oppGoalX(t);
    var kOff = Math.abs(k.x - gx);
    if (!k.hidden && kOff > 3.2 && dGoal > 5 && dGoal < Math.min(18, this.strikeRange('cungkil')) && this.rng() < [0.1, 0.22, 0.35][diff]) {
      this.doStrike(p, 'cungkil', this.rng.range(0.6, 0.95), 0, 0); return true;
    }
    if (dGoal > F.shot * 0.62 && dGoal < this.strikeRange('jauh') * 0.8 && Math.abs(p.z) < F.boxW / 2 + 4 && thd > 2.2 && this.rng() < [0.004, 0.008, 0.012][diff]) {
      this.doStrike(p, 'jauh', this.rng.range(0.6, 1.0), 0, 0); return true;
    }
    return false;
  };

  /* ======================================================================
     KEBUGARAN & CEDERA
     ====================================================================== */
  S.drainEnergy = function (p, sp, dt) {
    if (this.mode !== 'match' || p.hidden) return;
    var f = Math.min(1, sp / 6.8);
    var d = (0.05 + 0.16 * f * f + (p.sprint && sp > 3 ? 0.45 : 0)) * this.fitK * (1.3 - p.st.stamina / 200) * dt;
    if (p.role === 'GK') d *= 0.3;
    if (p.injured) d *= 1.3;
    p.energy = Math.max(0, p.energy - d);
    /* memaksa sprint saat sudah kehabisan tenaga: risiko cedera otot */
    if (p.energy < 10 && p.sprint && sp > 5 && !p.injured && p.role !== 'GK' && this.rng() < 0.012 * dt) this.injure(p);
  };
  S.maybeInjure = function (p, chance) {
    if (!p || p.injured || p.hidden || p.role === 'GK' || this.mode !== 'match') return;
    var c = chance * (1 + Math.max(0, 50 - p.energy) / 100);
    if (this.rng() < c) this.injure(p);
  };
  S.injure = function (p) {
    p.injured = true;
    p.stunT = Math.max(p.stunT, 0.8);
    this.emit({ k: 'injury', p: this.code(p), team: p.team });
  };

  /* ======================================================================
     FORMASI, TAKTIK, TUKAR POSISI, PERGANTIAN PEMAIN
     ====================================================================== */
  S.initBench = function () {
    var n = this.n, self = this;
    this.subsLeft = [D.MAX_SUBS, D.MAX_SUBS];
    this.bench = [0, 1].map(function (t) {
      var out = [];
      for (var j = 0; j < D.BENCH; j++) if (self.teams[t].players[n + j]) out.push({ i: n + j, used: false });
      return out;
    });
    this.cmdQ = [];
    this.subChk = false;
    this.goalSk = '';
    this.fitK = (240 / Math.max(60, U.num(this.rules.dur, 240))) * D.wv(this.weather, 'stam');
  };
  /* perintah kapten tim (dari layar strategi): {k:'tac', v} | {k:'form', v} | {k:'swap', a, b} | {k:'sub', out, j} | {k:'auto', v}
     dijalankan pada langkah simulasi berikutnya yang aman (bukan saat adegan jurus / penalti) */
  S.teamCmd = function (team, c) {
    if ((team !== 0 && team !== 1) || !c || typeof c !== 'object' || this.cmdQ.length > 24) return false;
    this.cmdQ.push({ team: team, c: c });
    return true;
  };
  S.applyCmds = function () {
    if (this.phase !== 'kickoff' && this.phase !== 'play' && this.phase !== 'restart' && this.phase !== 'goal') return;
    var q = this.cmdQ;
    this.cmdQ = [];
    for (var i = 0; i < q.length; i++) {
      var t = q[i].team, c = q[i].c;
      if (c.k === 'tac') this.setTactic(t, c.v);
      else if (c.k === 'form') this.setForm(t, c.v);
      else if (c.k === 'swap') this.swapSlots(t, c.a | 0, c.b | 0);
      else if (c.k === 'sub') this.doSub(t, c.out | 0, c.j | 0);
      else if (c.k === 'auto') { this.teams[t].autoSub = !!c.v; this.emit({ k: 'teamset', team: t }); }
    }
  };
  S.setTactic = function (t, v) {
    if (!D.TACTICS.some(function (x) { return x.id === v; })) return false;
    this.teams[t].tactic = v;
    this.emit({ k: 'teamset', team: t, tac: v });
    return true;
  };
  S.setForm = function (t, v) {
    var n = this.n, team = this.teams[t];
    if (v && !D.formById(n, v)) return false;
    if (v) team.form = v; else delete team.form;
    /* otomatis: peran mengikuti pemain yang kini menempati tiap slot */
    var bySlot = [];
    this.players.forEach(function (p) { if (p.team === t) bySlot[p.slotIdx] = p.cfg; });
    var slots = D.formSlots(n, team.form, bySlot);
    this.players.forEach(function (p) {
      if (p.team !== t) return;
      var s = slots[p.slotIdx];
      if (!s) return;
      p.slot = s;
      if (p.idx !== 0) p.role = s.role === 'GK' ? 'MF' : s.role;
    });
    this.emit({ k: 'teamset', team: t, form: team.form || '' });
    return true;
  };
  S.swapSlots = function (t, a, b) {
    var pa = this.pl(t, a), pb = this.pl(t, b);
    if (!pa || !pb || pa === pb || a === 0 || b === 0) return false;
    var si = pa.slotIdx, sl = pa.slot, ro = pa.role;
    pa.slotIdx = pb.slotIdx; pa.slot = pb.slot; pa.role = pb.role;
    pb.slotIdx = si; pb.slot = sl; pb.role = ro;
    this.emit({ k: 'teamset', team: t, swap: [a, b] });
    return true;
  };
  /* ganti pemain: pemain lapangan indeks out (bukan kiper) diganti cadangan ke-j */
  S.doSub = function (t, out, j) {
    var team = this.teams[t], p = this.pl(t, out), bn = this.bench[t] && this.bench[t][j];
    if (!p || out === 0 || !bn || bn.used || this.subsLeft[t] <= 0 || p.hidden) return false;
    if (this.aim && this.aim.p === p) this.cancelAim();
    var old = team.players[out], nw = team.players[bn.i];
    if (!nw) return false;
    team.players[out] = nw; team.players[bn.i] = old;
    p.cfg = nw; p.name = nw.name; p.num = nw.num;
    p.st = D.playerStats(nw, team.level);
    p.shot = D.shotById[nw.shot] || D.SHOTS[0]; p.style = D.styleById[nw.style] || D.STYLES[0];
    p.energy = 100; p.stamina = 100; p.injured = false; p.yellow = 0; p.stunT = 0; p.gocekT = 0; p.slideT = 0;
    bn.used = true;
    this.subsLeft[t]--;
    this.emit({ k: 'sub', team: t, idx: out, bi: bn.i, j: j, on: nw.name, off: old.name, left: this.subsLeft[t] });
    return true;
  };
  /* cadangan terbaik untuk menggantikan p: belum terpakai, utamakan peran yang sama */
  S.pickBench = function (t, p) {
    var team = this.teams[t], best = -1, bs = -1;
    for (var j = 0; j < this.bench[t].length; j++) {
      var bn = this.bench[t][j];
      if (bn.used) continue;
      var c = team.players[bn.i], s = (c && c.role === p.role) ? 2 : 1;
      if (s > bs) { bs = s; best = j; }
    }
    return best;
  };
  /* pergantian otomatis saat bola mati: tim NPC, atau tim manusia yang menyalakan "ganti otomatis" */
  S.aiSubs = function () {
    if (this.mode !== 'match' || !this.bench) return;
    for (var t = 0; t < 2; t++) {
      if (this.humans[t] && !this.teams[t].autoSub) continue;
      if (this.subsLeft[t] <= 0) continue;
      var cands = this.players.filter(function (p) { return p.team === t && p.idx !== 0 && !p.hidden && (p.injured || p.energy < 28); });
      cands.sort(function (a, b) { return (a.injured ? -100 : a.energy) - (b.injured ? -100 : b.energy); });
      for (var i = 0; i < cands.length && i < 2; i++) {
        var j = this.pickBench(t, cands[i]);
        if (j < 0) break;
        this.doSub(t, cands[i].idx, j);
      }
    }
  };
  /* data kebugaran & susunan untuk jaringan (dikirim jarang) */
  S.fitSnap = function () {
    var tacIds = D.TACTICS.map(function (x) { return x.id; }), self = this;
    return {
      e: this.players.map(function (p) { return Math.round(p.energy); }),
      s: this.players.map(function (p) { return p.slotIdx; }),
      r: this.players.map(function (p) { return ['GK', 'DF', 'MF', 'FW'].indexOf(p.role); }),
      f: [this.teams[0].form || '', this.teams[1].form || ''],
      tc: [tacIds.indexOf(this.teams[0].tactic), tacIds.indexOf(this.teams[1].tactic)],
      su: [this.subsLeft[0], this.subsLeft[1]],
      bn: [0, 1].map(function (t) { return self.bench[t].map(function (b) { return b.used ? 1 : 0; }); }),
      au: [this.teams[0].autoSub ? 1 : 0, this.teams[1].autoSub ? 1 : 0]
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
