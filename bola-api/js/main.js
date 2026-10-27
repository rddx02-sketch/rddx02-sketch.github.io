/* Bola Api Arena — pengendali utama: menu, pertandingan, turnamen, online */
(function (root) {
  'use strict';
  var BA = root.BA, U = BA.U, D = BA.D, R3 = BA.R3, UI = BA.UI, Net = BA.Net, Input = BA.Input, Audio = BA.Audio;
  var THREE = root.THREE;
  var ARTIFACT_URL = 'https://claude.ai/artifact/Dyx33WcqPZfWT1gDEt4Uin';
  /* Supabase Realtime (room online di luar claude.ai). Kunci ini kunci publik (publishable), aman dibagikan di sisi klien. */
  var SB_URL = 'https://mtgccjyfknzxdubjcecq.supabase.co';
  var SB_KEY = 'sb_publishable_lwGRYNK6yPSdWzrALUlt5Q_wJQb4WQe';
  var App = BA.App = {};

  /* ---------- data tersimpan ---------- */
  function lowEnd() {
    var mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
    return mem <= 3 || cores <= 4;
  }
  App.settings = Object.assign({
    sound: true, quality: lowEnd() ? 0 : 1, cam: 'auto', camZoom: 1, autoSprint: true, showPower: true, vibrate: true,
    keys: null, pad: null, deadzone: 0.2, touchUi: 'auto', legend: true, minimap: 'auto',
    nLang: 'id', nVoice: true, nSubs: true, nVol: 1, nRate: 1, nVoiceURI: '', nPersona: 'bejo', layout: null, autoFs: true, crowd: 0.7
  }, U.store.get('settings', {}));
  (function (S) {
    if (['auto', 'samping', 'belakang'].indexOf(S.cam) < 0) S.cam = 'auto';
    S.camZoom = U.clamp(U.num(S.camZoom, 1), 0.8, 1.3);
    if (['auto', 'on', 'off'].indexOf(S.touchUi) < 0) S.touchUi = 'auto';
    if (['auto', 'on', 'off'].indexOf(S.minimap) < 0) S.minimap = 'auto';
    if (['id', 'en', 'off'].indexOf(S.nLang) < 0) S.nLang = 'id';
    S.deadzone = U.clamp(U.num(S.deadzone, 0.2), 0.05, 0.5);
    S.nVol = U.clamp(U.num(S.nVol, 1), 0, 1); S.nRate = U.clamp(U.num(S.nRate, 1), 0.7, 1.4);
    if (typeof S.nVoiceURI !== 'string') S.nVoiceURI = '';
    S.quality = U.clamp(Math.round(U.num(S.quality, 1)), 0, 2);
    S.layout = BA.Layout ? BA.Layout.sanitize(S.layout) : null;
    S.autoFs = S.autoFs !== false;
    S.crowd = U.clamp(U.num(S.crowd, 0.7), 0, 1);
    if (!BA.Narr.personaById[S.nPersona]) S.nPersona = 'bejo';
  })(App.settings);
  App.myTeam = D.sanitizeTeam(U.store.get('team', D.defaultMyTeam()));
  App.records = Object.assign({ played: 0, wins: 0, draws: 0, losses: 0, goals: 0, best: 0, cups: 0 }, U.store.get('records', {}));
  function defaultSetup() {
    return { opp: 0, field: 'kampung', arena: 'kampung', weather: 'cerah', ball: 'merah', rules: D.defaultRules(), practiceShooter: 4, practiceStyle: 'elang' };
  }
  App.setups = U.store.get('setups', {});

  App.saveTeam = function (quiet) {
    // bersihkan di tempat: objek tim & pemain tetap sama supaya editor yang sedang terbuka tidak memegang salinan basi
    var T = App.myTeam, c = D.sanitizeTeam(T);
    Object.keys(c).forEach(function (k) { if (k !== 'players') T[k] = c[k]; });
    if (!Array.isArray(T.players)) T.players = [];
    c.players.forEach(function (cp, i) {
      var tp = T.players[i];
      if (!tp || typeof tp !== 'object') { T.players[i] = cp; return; }
      Object.keys(cp).forEach(function (k) { tp[k] = cp[k]; });
    });
    T.players.length = c.players.length;
    U.store.set('team', T);
    App.showcaseChars = true;
    if (quiet) App.previewPlayer(UI.teamSel);
  };
  App.saveSetup = function () { U.store.set('setups', App.setups); };
  App.setSetting = function (k, v) {
    App.settings[k] = v;
    if (k === 'keys' || k === 'pad') {
      Input.setBindings(App.settings.keys, App.settings.pad);
      App.settings.keys = U.copy(Input.keys); App.settings.pad = U.copy(Input.pad);
    }
    U.store.set('settings', App.settings);
    if (k === 'sound') Audio.setOn(v);
    if (k === 'crowd') Audio.setCrowdMul(U.num(v, 0.7));
    if (k === 'quality') R3.setQuality(v);
    if (k === 'autoSprint') Input.autoSprint = !!v;
    if (k === 'vibrate') Input.rumbleOn = !!v;
    if (k === 'deadzone') Input.deadzone = U.num(v, 0.2);
    if (/^n[A-Z]/.test(k)) BA.Narr.setup(App.settings);
    if (k === 'touchUi' || k === 'legend' || k === 'keys' || k === 'pad') App.applyDevice();
    if (k === 'layout') BA.Layout.apply();
  };
  /* tampilan sesuai perangkat aktif: tombol layar, petunjuk tombol, teks lewati */
  App.applyDevice = function () {
    var S = App.settings, dev = Input.device, b = document.body;
    var hide = S.touchUi === 'off' || (S.touchUi === 'auto' && dev !== 'touch');
    b.classList.toggle('hidepad', hide);
    b.classList.toggle('showlegend', !!S.legend && (dev === 'kb' || dev === 'pad'));
    UI.legend(dev);
    var sh = $('skipHint');
    if (sh) {
      var t = 'Ketuk layar untuk lewati';
      if (dev === 'pad') t = 'Tekan ' + Input.padName(Input.pad.pass[0] >= 0 ? Input.pad.pass[0] : 0) + ' untuk lewati';
      else if (dev === 'kb') t = 'Tekan ' + Input.keyName(Input.keys.skip[0] || Input.keys.skip[1] || 'Space') + ' untuk lewati';
      if (sh.textContent !== t) sh.textContent = t;
    }
  };
  App.cycleCam = function () {
    var order = ['auto', 'samping', 'belakang'], i = order.indexOf(App.settings.cam);
    var v = order[(i + 1) % order.length];
    App.setSetting('cam', v);
    UI.toast('Kamera: ' + { auto: 'Otomatis', samping: 'Samping (TV)', belakang: 'Belakang' }[v]);
  };
  App.resetData = function () {
    App.records = { played: 0, wins: 0, draws: 0, losses: 0, goals: 0, best: 0, cups: 0 };
    App.myTeam = D.defaultMyTeam();
    App.setups = {};
    U.store.set('records', App.records); U.store.set('team', App.myTeam); U.store.set('setups', App.setups);
    App.showcaseChars = true;
    UI.renderRecords(App.records);
  };
  App.randomLook = function (i) {
    var p = App.myTeam.players[i], r = Math.random;
    p.skin = Math.floor(r() * D.SKINS.length);
    p.hair = D.HAIRS[Math.floor(r() * D.HAIRS.length)].id;
    p.hairC = Math.floor(r() * D.HAIR_COLORS.length);
    p.head = D.HEADS[Math.floor(r() * D.HEADS.length)].id;
    p.body = D.BODIES[Math.floor(r() * D.BODIES.length)].id;
    p.height = D.HEIGHTS[Math.floor(r() * D.HEIGHTS.length)].id;
    p.foot = D.FEET[Math.floor(r() * D.FEET.length)].id;
    p.face = r() < 0.45 ? 'polos' : D.FACES[Math.floor(r() * D.FACES.length)].id;
    App.saveTeam();
  };

  /* ---------- panggung menu & pratinjau ---------- */
  App.buildShowcase = function () {
    App.disposeShowcase();
    D.useField('kampung');
    R3.applyShadows();
    var sc = { scene: new THREE.Scene(), t: 0 };
    sc.arena = BA.Arena.build(sc.scene, { arena: 'kampung', weather: 'malam' });
    sc.chars = App.myTeam.players.map(function (p, i) {
      var c = BA.Chars.build(p, App.myTeam);
      c.root.position.set(-4 + i * 2, 0, -1.5 - Math.abs(i - 2) * 0.4);
      c.root.rotation.y = 0;
      sc.scene.add(c.root);
      return c;
    });
    sc.fx = new BA.FX(sc.scene, D.BALLS[0]);
    sc.rig = new BA.CamRig(R3.camera);
    App.showcase = sc;
    App.showcaseDirty = false;
    App.showcaseChars = false;
  };
  App.rebuildShowcaseChars = function () {
    var sc = App.showcase;
    if (!sc) return;
    sc.chars.forEach(function (c, i) {
      var pos = c.root.position.clone(), rot = c.root.rotation.y;
      c.dispose();
      var n = BA.Chars.build(App.myTeam.players[i], App.myTeam);
      n.root.position.copy(pos); n.root.rotation.y = rot; sc.scene.add(n.root);
      sc.chars[i] = n;
    });
    App.showcaseChars = false;
  };
  App.disposeShowcase = function () {
    var sc = App.showcase;
    if (!sc) return;
    sc.fx.dispose(); sc.chars.forEach(function (c) { c.dispose(); }); sc.arena.dispose(); R3.dispose(sc.scene);
    App.showcase = null;
  };
  App.previewPlayer = function (i) {
    var sc = App.showcase;
    if (!sc) return;
    var old = sc.chars[i];
    if (old) { var pos = old.root.position.clone(), rot = old.root.rotation.y; old.dispose(); var c = BA.Chars.build(App.myTeam.players[i], App.myTeam); c.root.position.copy(pos); c.root.rotation.y = rot; sc.scene.add(c.root); sc.chars[i] = c; }
  };
  App.updateMenu = function (dt) {
    if (!App.showcase || App.showcaseDirty) App.buildShowcase();
    else if (App.showcaseChars) App.rebuildShowcaseChars();
    var sc = App.showcase;
    sc.t += dt;
    var t = sc.t, editing = UI.cur === 'scrTeam';
    var sel = UI.teamSel;
    sc.chars.forEach(function (c, i) {
      var x = -4 + i * 2, z = -1.5 - Math.abs(i - 2) * 0.4, f = 0, anim = i === 0 ? 'gkReady' : 'idle';
      if (i >= 5) { x = -9 + (i - 5) * 3.6; z = -9 - (i % 2) * 1.2; }
      if (editing) {
        if (i === sel) { x = 0; z = 2.2; f = t * 0.6; anim = 'idle'; }
        else { x = -15 + i * 3; z = -5 - (i % 2) * 1.5; }
      } else if (i === 2) anim = 'celebrate';
      c.root.position.x = U.damp(c.root.position.x, x, 6, dt);
      c.root.position.z = U.damp(c.root.position.z, z, 6, dt);
      c.root.position.y = 0;
      c.update(dt, c.root.position.x, c.root.position.z, f, anim, (t * 0.6) % 1);
    });
    // bola api juggling
    var bp = sc.chars[editing ? sel : 4].root.position;
    var hop = Math.abs(Math.sin(t * 3.2));
    sc.fx.updateBall(dt, { x: bp.x + (editing ? 0.7 : 0.5), y: 0.17 + hop * 1.3, z: bp.z + 0.5 }, { big: 1.1 });
    sc.fx.setMarker(0, null, false); sc.fx.setMarker(1, null, false);
    sc.fx.update(dt);
    sc.arena.update(dt, t, { fx: 0, fz: 0 });
    var cam = R3.camera;
    if (editing) {
      var land = R3.aspect >= 1.05;
      var o = land ? { px: 2.2, py: 1.5, pz: 7.6, lx: 1.95, ly: 0.95, lz: 2.2 } : { px: 0, py: 1.5, pz: 8.6, lx: 0, ly: 0.2, lz: 2.2 };
      sc.rig.update(dt, 0, 0, { override: o, k: 6 });
      cam.fov = land ? 34 : 42;
    } else {
      var a = t * 0.12;
      var r = R3.aspect >= 1.05 ? 11 : 13.5;
      var lx = R3.aspect >= 1.05 ? -2.8 : 0;
      sc.rig.update(dt, 0, 0, { override: { px: Math.sin(a) * 3 + lx, py: 3.2, pz: r + Math.cos(a) * 1.5, lx: lx * 0.9, ly: 1.2, lz: -1 }, k: 3 });
      cam.fov = R3.aspect >= 1.05 ? 46 : 58;
    }
    cam.updateProjectionMatrix();
    R3.render(sc.scene);
  };

  /* ---------- navigasi menu ---------- */
  App.menu = function (go) {
    Audio.init();
    if (go === 'team') UI.openTeam();
    else if (go === 'guide') { UI.buildGuide(); UI.show('scrGuide'); }
    else if (go === 'settings') UI.openSettings();
    else if (go === 'online') App.openOnline();
    else {
      var mode = go;
      var cfg = App.setups[mode] || (App.setups[mode] = defaultSetup());
      cfg.rules = Object.assign(D.defaultRules(), cfg.rules || {});
      UI.openSetup(mode, cfg);
    }
  };
  App.onScreen = function (name) {
    Input.setEnabled(name === 'play');
    if (name === 'scrMenu') UI.renderRecords(App.records);
  };
  App.onBack = function (cur, prev) {
    if (cur === 'scrOnline') { App.leaveOnline(); }
    if (cur === 'scrSettings' && App.match) { UI.show('scrPause', false); return false; }
    if (cur === 'scrSetup' && UI.setupMode === 'host') { UI.show('scrOnline', false); App.refreshHostCfg(); return false; }
    if (cur === 'scrBracket') { App.tour = null; UI.home(); return false; }
    return true;
  };

  /* ---------- mulai dari setup ---------- */
  function pickWeather(w) { return w === 'acak' ? D.WEATHERS[Math.floor(Math.random() * D.WEATHERS.length)].id : w; }
  function oppTeam(idx) {
    if (idx === -1 || idx == null || !D.TEAMS[idx]) idx = Math.floor(Math.random() * D.TEAMS.length);
    return U.copy(D.TEAMS[idx]);
  }
  App.startFromSetup = function (mode, cfg) {
    App.saveSetup();
    if (mode === 'host') { UI.show('scrOnline', false); App.refreshHostCfg(); return; }
    if (mode === 'tour') { App.startTour(cfg); return; }
    var simMode = mode === 'pen' ? 'penalty' : (mode === 'practice' ? 'practice' : 'match');
    var opp = mode === 'practice' ? U.copy(D.TEAMS[Math.floor(Math.random() * D.TEAMS.length)]) : oppTeam(cfg.opp);
    var simCfg = {
      mode: simMode, field: D.fieldById[cfg.field] ? cfg.field : 'kampung', teams: [App.myTeam, opp], arena: cfg.arena, weather: pickWeather(cfg.weather), ball: cfg.ball,
      rules: U.copy(cfg.rules), humans: [true, false], seed: (Math.random() * 1e9) | 0,
      practiceShooter: cfg.practiceShooter, practiceStyle: cfg.practiceStyle
    };
    App.startLocal(simCfg, { label: mode });
  };

  App.startLocal = function (simCfg, meta) {
    var sim = new BA.Sim(simCfg);
    App.beginMatch({ kind: 'local', sim: sim, state: sim, my: 0, simCfg: simCfg, meta: meta || {} });
  };

  App.beginMatch = function (m) {
    App.endMatchView();
    App.disposeShowcase();
    UI.loading('Menyiapkan lapangan…', true);
    try {
      m.view = new BA.View(m.state, {
        side: m.my === 1 ? -1 : 1,
        trainSay: true,
        onCineDone: function (id) { if (m.sim) m.sim.finishCine(id); }
      });
    } catch (e) {
      UI.loading('', false);
      App.fatal(e);
      return;
    }
    m.lastSkip = Input.skipSeq; m.lastGuestSkip = 0; m.lastSend = 0; m.slowT = 0; m.slowN = 0;
    App.match = m;
    BA.Narr.start(m.state, m.kind);
    App.applyDevice();
    App.paused = false;
    UI.resetHud();
    UI.cineEnd();
    UI.aim(false);
    UI.stack = [];
    UI.show('play', false);
    Input.releaseAll();
    Audio.init(); Audio.crowdStart(); Audio.crowdLevel(0.05);
    $('joyHint').style.display = App.records.played > 2 ? 'none' : '';
    $('btnPause').textContent = m.kind === 'local' ? '❚❚' : '☰';
    setTimeout(function () { UI.loading('', false); }, 60);
  };
  function $(id) { return document.getElementById(id); }

  App.endMatchView = function () {
    var m = App.match;
    if (!m) return;
    if (m.view) { try { m.view.dispose(); } catch (e) { /* abaikan */ } }
    App.match = null;
    BA.Narr.end();
    Input.setCine(false);
    Audio.crowdStop();
    UI.aim(false);
  };

  /* ---------- loop ---------- */
  var last = 0, errCount = 0;
  App.frame = function (t) {
    root.requestAnimationFrame(App.frame);
    var dt = last ? Math.min(0.1, Math.max(0, (t - last) / 1000)) : 0.016; // sampai 10 fps simulasi tetap waktu nyata (bukan gerak lambat)
    last = t;
    if (R3.lost) return;
    try {
      Input.update();
      if (App.match) App.updateMatch(dt, t);
      else App.updateMenu(dt);
    } catch (e) {
      errCount++;
      if (root.console) root.console.error(e);
      if (errCount === 25) App.fatal(e);
    }
  };

  App.updateMatch = function (dt, nowMs) {
    var m = App.match, v = m.view, st = m.state;
    Input.setCine(!!(v.cine && v.cine.active));
    if (m.kind !== 'guest') {
      var sim = m.sim;
      if (!App.paused) {
        var w = v.rig.toWorld(Input.sx, Input.sy);
        sim.setInput(m.my, Input.toSim(w.x, w.z));
        if (m.kind === 'host') {
          var gi = m.link.readGuest(Net.other);
          if (gi) {
            sim.setInput(1, gi);
            if (gi.skipSeq !== m.lastGuestSkip) { m.lastGuestSkip = gi.skipSeq; if (v.cine.active) v.cine.skip(); }
          }
        }
        if (Input.skipSeq !== m.lastSkip) { m.lastSkip = Input.skipSeq; if (v.cine.active) v.cine.skip(); }
        sim.update(dt);
        var evs = sim.drainEvents();
        BA.handleEvents(evs, m);
        if (m.kind === 'host') { m.link.feed(evs); m.link.tick(nowMs); }
      }
    } else {
      m.rv.update(dt, nowMs);
      if (Input.skipSeq !== m.lastSkip) { m.lastSkip = Input.skipSeq; if (v.cine.active) v.cine.skip(); }
      if (v.cine.active && m.rv.phase !== 'cine') { m.cineOut = (m.cineOut || 0) + dt; if (m.cineOut > 0.4) v.cine.skip(); } else m.cineOut = 0;
      if (nowMs - m.lastSend > (Net.transport === 'sb' ? 80 : 50)) {
        m.lastSend = nowMs;
        var w2 = v.rig.toWorld(Input.sx, Input.sy);
        Net.send({ i: Net.packInput(Input.toSim(w2.x, w2.z)), ack: [m.mid, m.rv.lastEv] });
      }
      if (Net.lastOtherAt && Date.now() - Net.lastOtherAt > 7000 && !m.warnedLag) { m.warnedLag = true; UI.toast('Menunggu tuan rumah…'); }
    }
    if (!App.paused || m.kind !== 'local') {
      v.sync(dt, st, m.my);
      v.camera(dt, st, m.my);
    }
    BA.Narr.update(dt, st, App.paused && m.kind === 'local');
    v.minimap(dt, st, m.my, App.settings.minimap);
    UI.hud(st, m.my, { canShoot: st.active && st.active[m.my] ? st.inShotRange(st.active[m.my]) || st.phase === 'pen' : true });
    App.aimUi(st, m);
    v.render();
    // jaga kelancaran
    if (dt > 0.042) m.slowT += dt; else m.slowT = Math.max(0, m.slowT - dt * 0.5);
    if (m.slowT > 3 && App.settings.quality > 0) { m.slowT = 0; App.setSetting('quality', App.settings.quality - 1); UI.toast('Grafis diturunkan agar lancar'); }
  };

  App.aimUi = function (st, m) {
    var my = m.my, p = null;
    if (st.aim && st.aim.team === my && st.aim.p) p = st.aim.p;
    if (st.phase === 'pen' && st.pen && st.pen.state === 'aim' && st.pen.team === my) p = st.pen.shooter;
    if (!p || (m.view && m.view.cine.active)) { UI.aim(false); return; }
    UI.aim(true, { revealed: st.revealed[1 - my] || {}, shot: p.shot, zc: Input.zc, zr: Input.zr, charge: Input.chargeNow(), mult: true });
  };

  /* ---------- jeda & selesai ---------- */
  App.pause = function () {
    var m = App.match;
    if (!m) return;
    if (m.kind === 'local') { App.paused = true; Input.releaseAll(); BA.Narr.stop(); }
    $('pauseHint').textContent = m.kind === 'local' ? 'Pertandingan dijeda.' : 'Pertandingan online tetap berjalan.';
    $('btnRestart').style.display = m.kind === 'local' ? '' : 'none';
    $('btnResume').textContent = m.kind === 'local' ? 'Lanjut main' : 'Kembali ke lapangan';
    UI.show('scrPause', false);
  };
  App.resume = function () { App.paused = false; UI.show('play', false); };
  App.restart = function () {
    var m = App.match;
    if (!m || m.kind !== 'local') return;
    var cfg = Object.assign({}, m.simCfg, { seed: (Math.random() * 1e9) | 0 });
    var meta = m.meta;
    App.startLocal(cfg, meta);
  };
  App.quit = function () {
    var m = App.match;
    var online = m && m.kind !== 'local';
    App.endMatchView();
    App.paused = false;
    if (online) { App.leaveOnline(); }
    if (App.tour && m && m.meta && m.meta.tour) App.tour = null;
    UI.home();
  };

  App.onMatchEnd = function (sum, m) {
    if (App.match !== m) return;
    var st = m.state;
    if (!sum && m.sim) sum = m.sim.summary();
    if (!sum) sum = { sc: st.score, wn: st.winner, so: null, goals: [], st: [[0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0]], best: null };
    var teams = st.teams, my = m.my;
    if (m.kind === 'local' && m.sim.mode !== 'practice') {
      var r = App.records;
      r.played++;
      if (sum.wn === my) r.wins++; else if (sum.wn < 0) r.draws++; else r.losses++;
      r.goals += sum.sc[my] | 0;
      var myBest = sum.st && sum.st[my] ? sum.st[my][7] | 0 : 0;
      r.best = Math.max(r.best || 0, myBest);
      U.store.set('records', r);
    }
    var acts = [];
    if (m.meta && m.meta.tour && App.tour) {
      App.tourResult(sum, m);
      acts.push({ label: 'Lihat bagan', main: true, fn: function () { App.endMatchView(); App.showTour(); } });
    } else if (m.kind === 'local') {
      acts.push({ label: 'Main lagi', main: true, fn: function () { App.restart(); } });
      acts.push({ label: 'Menu', fn: function () { App.endMatchView(); UI.home(); } });
    } else if (m.kind === 'host') {
      acts.push({ label: 'Kembali ke room', main: true, fn: function () { App.endMatchView(); App.hostBackToLobby(); } });
      acts.push({ label: 'Keluar', fn: function () { App.endMatchView(); App.leaveOnline(); UI.home(); } });
    } else {
      acts.push({ label: 'Kembali ke room', main: true, fn: function () { App.endMatchView(); App.guestBackToLobby(); } });
      acts.push({ label: 'Keluar', fn: function () { App.endMatchView(); App.leaveOnline(); UI.home(); } });
    }
    Input.setEnabled(false);
    UI.showResult(sum, teams, my, acts);
  };

  App.fatal = function (e) {
    if (root.console) root.console.error('BolaApi fatal', e);
    App.endMatchView();
    UI.confirm('Ada yang tidak beres', 'Permainan dikembalikan ke menu agar aman. Coba lagi, dan pilih grafis Hemat bila HP terasa berat.', [{ label: 'Kembali ke menu', main: true, fn: function () { UI.home(); } }]);
  };

  /* ---------- turnamen ---------- */
  App.startTour = function (cfg) {
    var idx = D.TEAMS.map(function (t, i) { return i; });
    for (var i = idx.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp; }
    var teams = [U.copy(App.myTeam), U.copy(D.TEAMS[idx[0]]), U.copy(D.TEAMS[idx[1]]), U.copy(D.TEAMS[idx[2]])];
    App.tour = { cfg: U.copy(cfg), teams: teams, sf: [{ a: 0, b: 1 }, { a: 2, b: 3 }], fin: null, stage: 'sf', note: 'Menangkan semifinal dan final untuk membawa pulang piala Tarkam.' };
    App.tour.cfg.rules.tie = 'penalti';
    App.showTour();
  };
  App.showTour = function () {
    var T = App.tour;
    if (!T) { UI.home(); return; }
    var acts = [];
    if (T.stage === 'sf') acts.push({ label: 'Main Semifinal', main: true, fn: function () { App.playTour(T.sf[0]); } });
    else if (T.stage === 'final') acts.push({ label: 'Main Final', main: true, fn: function () { App.playTour(T.fin); } });
    else acts.push({ label: 'Selesai', main: true, fn: function () { App.tour = null; UI.home(); } });
    UI.showBracket(T, acts);
  };
  App.playTour = function (match) {
    var T = App.tour, cfg = T.cfg;
    var oppIdx = match.a === 0 ? match.b : match.a;
    var simCfg = { mode: 'match', field: D.fieldById[cfg.field] ? cfg.field : 'kampung', teams: [App.myTeam, T.teams[oppIdx]], arena: cfg.arena, weather: pickWeather(cfg.weather), ball: cfg.ball, rules: U.copy(cfg.rules), humans: [true, false], seed: (Math.random() * 1e9) | 0 };
    App.startLocal(simCfg, { label: 'tour', tour: true, match: match });
  };
  function quickSim(ta, tb, cfg) {
    var sim = new BA.Sim({ mode: 'match', field: cfg.field, teams: [ta, tb], arena: cfg.arena, weather: 'cerah', ball: cfg.ball, rules: Object.assign({}, cfg.rules, { dur: 120, tie: 'penalti' }), humans: [false, false], seed: (Math.random() * 1e9) | 0, autoCine: true });
    var n = 0;
    while (sim.phase !== 'end' && n < 60 * 60 * 6) { sim.step(1 / 60); n++; if (n % 600 === 0) sim.drainEvents(); }
    if (sim.phase !== 'end') sim.winner = Math.random() < 0.5 ? 0 : 1;
    var so = sim.shootout;
    return { sc: [sim.score[0], sim.score[1]], w: sim.winner, pen: so && so.done ? [so.kicks[0].reduce(function (a, v) { return a + v; }, 0), so.kicks[1].reduce(function (a, v) { return a + v; }, 0)] : null };
  }
  App.tourResult = function (sum, m) {
    var T = App.tour, match = m.meta.match;
    var oppIdx = match.a === 0 ? match.b : match.a;
    match.done = true;
    // pertandingan dimainkan dengan tim kita sebagai sisi 0
    var meScore = sum.sc[0], oppScore = sum.sc[1];
    match.sc = match.a === 0 ? [meScore, oppScore] : [oppScore, meScore];
    var won = sum.wn === 0;
    match.w = won ? 0 : oppIdx;
    if (sum.so) { var p0 = sum.so[0].split('').reduce(function (a, v) { return a + Number(v); }, 0), p1 = sum.so[1].split('').reduce(function (a, v) { return a + Number(v); }, 0); match.pen = match.a === 0 ? [p0, p1] : [p1, p0]; }
    if (T.stage === 'sf') {
      var sf2 = T.sf[1];
      var r = quickSim(T.teams[sf2.a], T.teams[sf2.b], T.cfg);
      sf2.done = true; sf2.sc = r.sc; sf2.w = r.w === 0 ? sf2.a : sf2.b; sf2.pen = r.pen;
      T.fin = { a: match.w, b: sf2.w };
      if (won) { T.stage = 'final'; T.note = 'Kamu lolos ke final! Lawanmu: ' + T.teams[T.fin.b].name + '.'; }
      else {
        var rf = quickSim(T.teams[T.fin.a], T.teams[T.fin.b], T.cfg);
        T.fin.done = true; T.fin.sc = rf.sc; T.fin.w = rf.w === 0 ? T.fin.a : T.fin.b; T.fin.pen = rf.pen;
        T.stage = 'done'; T.note = 'Tersingkir di semifinal. Juara: ' + T.teams[T.fin.w].name + '.';
      }
    } else if (T.stage === 'final') {
      T.stage = 'done';
      if (won) { T.note = 'JUARA TARKAM! Piala dibawa pulang ke kampung.'; App.records.cups = (App.records.cups || 0) + 1; U.store.set('records', App.records); }
      else T.note = 'Kalah di final. Tahun depan balas dendam!';
    }
  };

  /* ---------- online ---------- */
  App.onlineCfg = function () {
    var cfg = App.setups.online || (App.setups.online = defaultSetup());
    cfg.rules = Object.assign(D.defaultRules(), cfg.rules || {});
    return cfg;
  };
  function packCfg(cfg, weather) {
    return { m: 'match', f: D.fieldById[cfg.field] ? cfg.field : 'kampung', a: cfg.arena, w: weather || pickWeather(cfg.weather), b: cfg.ball, r: { d: cfg.rules.dur, t: cfg.rules.tie, bo: cfg.rules.bound, tp: cfg.rules.tigaPojok ? 1 : 0, bp: cfg.rules.bolaPanas ? 1 : 0, pr: cfg.rules.pro ? 1 : 0 } };
  }
  function unpackCfg(c) {
    c = c || {};
    var r = c.r || {};
    return {
      mode: 'match', field: D.fieldById[c.f] ? c.f : 'kampung', arena: D.arenaById[c.a] ? c.a : 'kampung', weather: D.weatherById[c.w] ? c.w : 'cerah', ball: D.ballById[c.b] ? c.b : 'merah',
      rules: D.applyRuleset({ dur: [120, 240, 360].indexOf(r.d) >= 0 ? r.d : 240, tie: ['penalti', 'emas', 'seri'].indexOf(r.t) >= 0 ? r.t : 'penalti', bound: r.bo === 'keluar' ? 'keluar' : 'pantul', tigaPojok: !!r.tp, bolaPanas: !!r.bp, diff: 1, pro: !!r.pr })
    };
  }
  App.online = { state: 'idle', guestTeam: null, guestReady: false, hostTeam: null, hostCfg: null, mid: 0 };

  App.openOnline = function () {
    UI.show('scrOnline');
    $('onChecking').classList.remove('hidden'); $('onNo').classList.add('hidden'); $('onYes').classList.add('hidden');
    Net.check().then(function (ok) {
      $('onChecking').classList.add('hidden');
      // WiFi lokal (WebRTC) tidak tersedia di dalam halaman claude.ai; hanya di file mandiri / aplikasi
      var lanAvail = Net.lanOk() && !root.claude;
      var ol = $('onLan'); if (ol && !lanAvail) ol.hidden = true;
      var lc0 = document.querySelector('[data-onl="lan"]'); if (lc0) lc0.hidden = !lanAvail;
      var gl = $('btnGoLan'); if (gl) gl.hidden = !lanAvail;
      if (!ok) {
        $('onNo').classList.remove('hidden');
        if (lanAvail) { ol.hidden = false; UI.lanRole('host'); }
        var why = $('onNoWhy');
        if (why) why.textContent = Net.inAppBrowser() ? 'Sepertinya game dibuka di jendela dalam aplikasi (WhatsApp/Instagram). Jendela ini biasanya memblokir sambungan room dan kamera. Buka tautannya di Chrome atau Safari.'
          : (!root.claude ? (Net.SB.url ? 'Layanan room online tidak terjangkau. Periksa koneksi internet lalu tekan Coba periksa lagi.' : 'Halaman game tidak dimuat lewat claude.ai, jadi layanan room tidak tersedia.') : 'Layanan room tidak merespons. Periksa internet lalu coba lagi.');
        return;
      }
      $('onYes').classList.remove('hidden'); $('onChoose').classList.remove('hidden');
      var auto = App.pendingCode;
      App.pendingCode = null;
      App.setOnlineRole(auto ? 'guest' : 'host');
      if (auto) { $('inCode').value = auto.toUpperCase(); App.guestJoin(auto); }
    });
  };
  App.setOnlineRole = function (role) {
    Net.stopCamera(); var csb = $('camScan'); if (csb) csb.hidden = true; var lc = $('lanCam'); if (lc) lc.hidden = true;
    if (role === 'lan') { Net.leave(); App.online = { state: 'idle', guestTeam: null, guestReady: false, hostTeam: null, hostCfg: null, mid: 0 }; UI.onlineMode('lan'); UI.lanRole(App.lanRole || 'host'); return; }
    if (Net.lan) Net.leave();
    UI.onlineMode(role);
    if (role === 'host') { if (Net.role !== 'host') App.hostCreate(); else App.refreshHostCfg(); }
    else { if (Net.role === 'host') Net.leave(); App.online.state = 'idle'; UI.status('guestStatus', '', 'Belum tersambung.'); $('guestVs').classList.add('hidden'); $('guestReady').classList.add('hidden'); }
  };
  App.leaveOnline = function () { Net.stopCamera(); var cs = $('camScan'); if (cs) cs.hidden = true; Net.leave(); App.online = { state: 'idle', guestTeam: null, guestReady: false, hostTeam: null, hostCfg: null, mid: 0 }; };

  App.hostCreate = function () {
    var code = U.code(4);
    App.online = { state: 'lobby', guestTeam: null, guestReady: false, mid: 0 };
    $('roomCode').textContent = code.toUpperCase();
    UI.status('hostStatus', 'wait', 'Membuka room…');
    $('hostVs').classList.add('hidden');
    $('btnHostStart').disabled = true;
    App.refreshHostCfg();
    Net.drawQR($('qr'), Net.qrText(code));
    Net.join(code, 'host', { st: 'lobby', t: D.packTeam(App.myTeam), c: packCfg(App.onlineCfg()) }).then(function () {
      UI.status('hostStatus', 'wait', 'Menunggu lawan memindai QR…');
    }, function (e) {
      UI.status('hostStatus', 'bad', 'Room gagal dibuka (' + ((e && e.code) || 'galat') + '). Coba lagi sebentar.');
    });
  };
  App.refreshHostCfg = function () {
    var cfg = App.onlineCfg();
    $('hostCfgSummary').textContent = UI.cfgSummary(cfg);
    if (Net.role === 'host') Net.send({ c: packCfg(cfg) });
  };
  App.hostStart = function () {
    var o = App.online;
    if (!o.guestTeam || !o.guestReady || Net.role !== 'host') return;
    var cfg = App.onlineCfg(), pc = packCfg(cfg), uc = unpackCfg(pc);
    var seed = (Math.random() * 1e9) | 0;
    o.mid = (Date.now() % 1000000) + 1;
    var simCfg = { mode: 'match', field: uc.field, teams: [App.myTeam, o.guestTeam], arena: uc.arena, weather: uc.weather, ball: uc.ball, rules: uc.rules, humans: [true, true], seed: seed };
    var sim = new BA.Sim(simCfg);
    Net.send({ st: 'play', mid: o.mid, c: pc, t: D.packTeam(App.myTeam), e: [], s: sim.snapshot() });
    o.state = 'play';
    App.beginMatch({ kind: 'host', sim: sim, state: sim, my: 0, simCfg: simCfg, link: new Net.HostLink(sim, o.mid), meta: { label: 'online' } });
  };
  App.hostBackToLobby = function () {
    var o = App.online, gp = Net.other;
    o.state = 'lobby';
    // tamu mungkin sudah lebih dulu kembali dan menekan siap
    o.guestReady = !!(gp && gp.rd && gp.st === 'lobby');
    Net.send({ st: 'lobby', s: null, e: null, t: D.packTeam(App.myTeam), c: packCfg(App.onlineCfg()) });
    UI.show('scrOnline', false);
    UI.onlineMode('host');
    if (gp && o.guestTeam) UI.vsBox('hostVs', App.myTeam, o.guestTeam); else $('hostVs').classList.add('hidden');
    $('btnHostStart').disabled = !(o.guestReady && o.guestTeam && gp);
    if (!gp) UI.status('hostStatus', 'wait', 'Menunggu lawan…');
    else if (o.guestReady) UI.status('hostStatus', 'ok', (o.guestTeam ? o.guestTeam.name : 'Lawan') + ' siap. Tekan Mulai!');
    else UI.status('hostStatus', 'ok', 'Lawan masih di room. Tunggu dia menekan Saya siap.');
  };

  App.guestJoin = function (raw) {
    var code = Net.cleanCode(raw);
    if (!code) { UI.status('guestStatus', 'bad', 'Kode harus 4 huruf/angka.'); return; }
    UI.status('guestStatus', 'wait', 'Menyambung ke room ' + code.toUpperCase() + '…');
    App.online = { state: 'joining', guestTeam: null, guestReady: false, hostTeam: null, hostCfg: null, mid: 0, code: code };
    Net.join(code, 'guest', { st: 'lobby', t: D.packTeam(App.myTeam), rd: 0 }).then(function () {
      App.online.state = 'lobby';
      UI.status('guestStatus', 'wait', 'Masuk room. Mencari tuan rumah…');
      setTimeout(function () { if (!Net.other && App.online.state === 'lobby' && Net.role === 'guest') UI.status('guestStatus', 'bad', 'Tuan rumah belum terlihat. Pastikan kodenya benar dan tuan rumah membuka layar QR.'); }, 6000);
    }, function (e) {
      UI.status('guestStatus', 'bad', 'Gagal masuk room (' + ((e && e.code) || 'galat') + ').');
    });
  };
  App.guestBackToLobby = function () {
    var o = App.online;
    o.endedMid = o.mid; // jangan masuk lagi ke laga yang sudah selesai
    o.state = 'lobby'; o.guestReady = false;
    Net.send({ st: 'lobby', i: null, rd: 0, t: D.packTeam(App.myTeam) });
    UI.show('scrOnline', false);
    UI.onlineMode('guest');
    $('btnGuestReady').textContent = 'Saya siap'; $('btnGuestReady').disabled = false;
    if (Net.other) {
      if (o.hostTeam) UI.vsBox('guestVs', o.hostTeam, App.myTeam);
      $('guestReady').classList.remove('hidden');
      UI.status('guestStatus', 'ok', 'Kembali di room. Tekan Saya siap.');
    } else {
      $('guestReady').classList.add('hidden');
      UI.status('guestStatus', 'bad', 'Tuan rumah sudah tidak ada di room.');
    }
  };

  App.guestBeginMatch = function (pres) {
    var o = App.online;
    var cfg = unpackCfg(pres.c);
    var hostTeam = D.unpackTeam(pres.t || o.hostTeamPacked);
    var rv = new BA.RemoteView({ mode: 'match', field: cfg.field, teams: [hostTeam, App.myTeam], arena: cfg.arena, weather: cfg.weather, ball: cfg.ball, rules: cfg.rules });
    o.state = 'play'; o.mid = pres.mid; o.guestReady = false;
    Net.send({ rd: 0 });
    App.beginMatch({ kind: 'guest', rv: rv, state: rv, my: 1, mid: pres.mid, meta: { label: 'online' } });
    if (pres.s) rv.push(pres.s, performance.now());
  };

  Net.on('joined', function () {
    if (Net.lan) {
      // sambungan WiFi lokal jadi: pindah ke lobi biasa (tanpa bagian QR/pindai)
      var lc = $('lanCam'); if (lc) lc.hidden = true; Net.stopCamera();
      $('onNo').classList.add('hidden'); $('onYes').classList.remove('hidden'); $('onChoose').classList.toggle('hidden', !Net.avail);
      if (Net.role === 'host') { App.online.state = 'lobby'; UI.onlineMode('host', true); App.refreshHostCfg(); UI.status('hostStatus', 'ok', 'Tersambung lewat WiFi lokal! Menunggu tamu menekan Saya siap…'); }
      else { App.online.state = 'lobby'; UI.onlineMode('guest', true); UI.status('guestStatus', 'ok', 'Tersambung lewat WiFi lokal dengan tuan rumah.'); }
      UI.toast('Sambungan WiFi lokal terhubung');
      return;
    }
    if (Net.role === 'host' && App.online.state === 'lobby') UI.status('hostStatus', 'ok', 'Lawan masuk room!');
  });
  /* ---------- WiFi lokal (WebRTC) ---------- */
  App.lanRole = 'host';
  App.lanInit = function () {
    var lanStat = function (id, cls, t) { UI.status(id, cls, t); };
    var shareTxt = function (label, code) {
      var text = label + ' Bola Api Arena (WiFi lokal):\n' + code;
      if (navigator.share) { try { navigator.share({ title: 'Bola Api Arena', text: text }).then(function () { UI.toast('Kode dibagikan'); }, function () { /* batal */ }); return; } catch (e) { /* lanjut */ } }
      try { navigator.clipboard.writeText(code).then(function () { UI.toast('Kode disalin'); }, function () { UI.toast('Salin manual dari kotak kode'); }); } catch (e2) { UI.toast('Salin manual dari kotak kode'); }
    };
    var copyTxt = function (code) { try { navigator.clipboard.writeText(code).then(function () { UI.toast('Kode disalin'); }, function () { UI.toast('Salin manual dari kotak kode'); }); } catch (e) { UI.toast('Salin manual dari kotak kode'); } };
    document.querySelectorAll('[data-lan]').forEach(function (b) { b.addEventListener('click', function () { Audio.init(); App.lanRole = b.getAttribute('data-lan'); Net.leave(); App.online = { state: 'idle', guestTeam: null, guestReady: false, hostTeam: null, hostCfg: null, mid: 0 }; UI.lanRole(App.lanRole); $('lanOfferBox').hidden = true; $('lanAnswerBox').hidden = true; lanStat('lanHostStatus', '', 'Belum ada sambungan.'); lanStat('lanGuestStatus', '', 'Belum ada sambungan.'); }); });
    $('btnGoLan').addEventListener('click', function () { Audio.init(); App.setOnlineRole('lan'); $('onLan').scrollIntoView({ behavior: 'smooth' }); });
    $('btnLanOffer').addEventListener('click', function () {
      Audio.init();
      lanStat('lanHostStatus', 'wait', 'Membuat kode undangan…');
      App.online = { state: 'lobby', guestTeam: null, guestReady: false, mid: 0 };
      Net.lanOffer().then(function (code) {
        Net.send({ r: 'h', v: 1, st: 'lobby', t: D.packTeam(App.myTeam), c: packCfg(App.onlineCfg()) });
        $('lanOfferTxt').value = code; $('lanOfferBox').hidden = false;
        Net.drawQR($('lanQr'), code, true);
        lanStat('lanHostStatus', 'wait', 'Kode siap (' + code.length + ' karakter). Kirim ke tamu, lalu tempel/pindai kode balasannya.');
      }, function (e) { lanStat('lanHostStatus', 'bad', 'Gagal membuat kode (' + ((e && e.code) || (e && e.message) || 'galat') + '). Browser mungkin tidak mendukung WebRTC.'); });
    });
    $('btnLanOfferCopy').addEventListener('click', function () { copyTxt($('lanOfferTxt').value); });
    $('btnLanOfferShare').addEventListener('click', function () { shareTxt('Kode undangan', $('lanOfferTxt').value); });
    $('btnLanAccept').addEventListener('click', function () {
      Audio.init();
      var v = $('lanAnswerTxt').value;
      if (!Net.lanParse(v)) { lanStat('lanHostStatus', 'bad', 'Kode balasan tidak dikenali. Harus diawali BAL1:a:'); return; }
      lanStat('lanHostStatus', 'wait', 'Menyambungkan ke tamu…');
      Net.lanAccept(v).then(function () { setTimeout(function () { if (Net.lan && !Net.lan.open) lanStat('lanHostStatus', 'bad', 'Belum tersambung. Pastikan kedua HP di WiFi/hotspot yang sama, lalu buat kode baru.'); }, 12000); }, function (e) { lanStat('lanHostStatus', 'bad', 'Kode balasan ditolak (' + ((e && e.code) || 'galat') + ').'); });
    });
    $('btnLanAnswer').addEventListener('click', function () {
      Audio.init();
      var v = $('lanOfferIn').value;
      if (!Net.lanParse(v)) { lanStat('lanGuestStatus', 'bad', 'Kode undangan tidak dikenali. Harus diawali BAL1:o:'); return; }
      lanStat('lanGuestStatus', 'wait', 'Membuat kode balasan…');
      App.online = { state: 'lobby', guestTeam: null, guestReady: false, hostTeam: null, hostCfg: null, mid: 0 };
      Net.lanAnswer(v).then(function (code) {
        Net.send({ r: 'g', v: 1, st: 'lobby', t: D.packTeam(App.myTeam), rd: 0 });
        $('lanAnswerOut').value = code; $('lanAnswerBox').hidden = false;
        Net.drawQR($('lanQr2'), code, true);
        lanStat('lanGuestStatus', 'wait', 'Kirim kode balasan ke tuan rumah. Begitu dia menekan Sambungkan, kalian terhubung.');
      }, function (e) { lanStat('lanGuestStatus', 'bad', 'Gagal membaca kode (' + ((e && e.code) || (e && e.message) || 'galat') + ').'); });
    });
    $('btnLanAnswerCopy').addEventListener('click', function () { copyTxt($('lanAnswerOut').value); });
    $('btnLanAnswerShare').addEventListener('click', function () { shareTxt('Kode balasan', $('lanAnswerOut').value); });
    var scanTo = function (target, statusId) {
      return function () {
        Audio.init();
        var box = $('lanCam'); box.hidden = false; $('lanCamStatus').textContent = 'Membuka kamera…';
        Net.scanCamera($('lanVideo'), function (code) { box.hidden = true; $(target).value = code; UI.toast('QR terbaca'); }, function (err) {
          box.hidden = true; lanStat(statusId, 'bad', 'Kamera tidak bisa dipakai (' + ((err && err.name === 'NotAllowedError') ? 'izin ditolak' : 'tidak tersedia') + '). Pakai Foto QR atau tempel kode.');
        }, function (msg) { $('lanCamStatus').textContent = msg; }, true);
      };
    };
    $('btnLanScanA').addEventListener('click', scanTo('lanAnswerTxt', 'lanHostStatus'));
    $('btnLanScanO').addEventListener('click', scanTo('lanOfferIn', 'lanGuestStatus'));
    $('btnLanCamStop').addEventListener('click', function () { Net.stopCamera(); $('lanCam').hidden = true; });
    var fileTo = function (inputId, target, statusId) {
      $(inputId).addEventListener('change', function () {
        var f = $(inputId).files && $(inputId).files[0];
        lanStat(statusId, 'wait', 'Membaca QR…');
        Net.scanFile(f, true).then(function (code) { $(target).value = code; lanStat(statusId, 'ok', 'QR terbaca, kode sudah diisi.'); }, function (err) { lanStat(statusId, 'bad', (err && err.message) || 'QR tidak terbaca.'); });
        $(inputId).value = '';
      });
    };
    fileTo('inLanScanA', 'lanAnswerTxt', 'lanHostStatus'); fileTo('inLanScanO', 'lanOfferIn', 'lanGuestStatus');
  };
  Net.on('presence', function (pres) {
    var o = App.online;
    if (!pres) return;
    if (Net.role === 'host') {
      if (pres.t) { o.guestTeam = D.unpackTeam(pres.t); }
      o.guestReady = !!pres.rd;
      if (o.state === 'lobby') {
        if (o.guestTeam) UI.vsBox('hostVs', App.myTeam, o.guestTeam);
        UI.status('hostStatus', o.guestReady ? 'ok' : 'wait', o.guestReady ? (o.guestTeam ? o.guestTeam.name : 'Lawan') + ' siap. Tekan Mulai!' : 'Lawan tersambung. Menunggu dia menekan Saya siap…');
        $('btnHostStart').disabled = !(o.guestReady && o.guestTeam);
      }
      return;
    }
    if (Net.role === 'guest') {
      if (pres.t) { o.hostTeamPacked = pres.t; o.hostTeam = D.unpackTeam(pres.t); }
      if (pres.c) o.hostCfg = unpackCfg(pres.c);
      var m = App.match;
      if (pres.st === 'play' && pres.mid && pres.mid !== o.endedMid && (!m || m.kind !== 'guest' || m.mid !== pres.mid) && o.state !== 'play') {
        App.guestBeginMatch(pres);
        m = App.match;
      }
      if (m && m.kind === 'guest' && pres.st === 'play' && pres.mid === m.mid) {
        if (pres.s) m.rv.push(pres.s, performance.now());
        var evs = m.rv.newEvents(pres.e);
        if (evs.length) BA.handleEvents(evs, m);
        return;
      }
      if (o.state === 'lobby' || o.state === 'joining') {
        if (o.hostTeam) { UI.vsBox('guestVs', o.hostTeam, App.myTeam); }
        $('guestReady').classList.remove('hidden');
        $('guestCfgSummary').textContent = o.hostCfg ? 'Aturan dari tuan rumah: ' + UI.cfgSummary(o.hostCfg) : '';
        if (!o.guestReady) UI.status('guestStatus', 'ok', 'Tersambung dengan tuan rumah. Tekan Saya siap.');
      }
    }
  });
  Net.on('left', function () {
    var m = App.match;
    if (m && m.kind === 'host') {
      UI.confirm('Lawan terputus', 'Lawan keluar atau sinyalnya hilang.', [
        { label: 'Lanjut lawan NPC', main: true, fn: function () { if (App.match && App.match.sim) { App.match.sim.humans[1] = false; App.match.kind = 'local'; Net.leave(); } } },
        { label: 'Keluar', fn: function () { App.quit(); } }]);
    } else if (m && m.kind === 'guest') {
      UI.confirm('Tuan rumah terputus', 'Pertandingan online berhenti.', [{ label: 'Kembali ke menu', main: true, fn: function () { App.quit(); } }]);
    } else if (Net.lan) {
      UI.status(Net.role === 'host' ? 'hostStatus' : 'guestStatus', 'bad', 'Sambungan WiFi lokal terputus. Buat kode baru untuk menyambung lagi.');
    } else if (Net.role === 'host') {
      App.online.guestTeam = null; App.online.guestReady = false;
      $('hostVs').classList.add('hidden'); $('btnHostStart').disabled = true;
      UI.status('hostStatus', 'wait', 'Lawan keluar. Menunggu lawan lain…');
    } else if (Net.role === 'guest') {
      UI.status('guestStatus', 'bad', 'Tuan rumah keluar dari room.');
      $('guestReady').classList.add('hidden');
    }
  });
  Net.on('error', function (e) {
    if (Net.lan) { UI.status(Net.role === 'host' ? 'lanHostStatus' : 'lanGuestStatus', 'bad', 'Sambungan WiFi lokal gagal (' + ((e && e.code) || 'galat') + '). Pastikan satu WiFi/hotspot, lalu ulangi.'); return; }
    if (Net.role === 'host') UI.status('hostStatus', 'bad', 'Sambungan room terputus (' + ((e && e.code) || 'galat') + ').');
    else if (Net.role === 'guest') UI.status('guestStatus', 'bad', 'Sambungan room terputus (' + ((e && e.code) || 'galat') + ').');
  });

  /* ---------- boot ---------- */
  App.boot = function () {
    if (!THREE) {
      UI.loading('Gagal memuat mesin 3D. Periksa koneksi internet lalu muat ulang.', true);
      return;
    }
    UI.init();
    // tautan undangan: di claude.ai pakai tautan artifact; di hosting sendiri (Vercel/GitHub) pakai alamat halaman ini; file mandiri pakai kode polos
    var loc = root.location || {};
    Net.artifactUrl = root.claude ? ARTIFACT_URL : (/^https?:/.test(loc.protocol || '') ? loc.origin + loc.pathname : '');
    Net.SB.url = SB_URL; Net.SB.key = SB_KEY;
    Input.autoSprint = !!App.settings.autoSprint;
    Audio.on = !!App.settings.sound;
    Audio.crowdMul = App.settings.crowd;
    var ok = R3.init(document.getElementById('game'), App.settings.quality);
    if (!ok) { UI.loading('Perangkat ini tidak mendukung WebGL untuk grafis 3D.', true); return; }
    R3.onLost = function () { UI.loading('Memulihkan grafis…', true); };
    R3.onRestored = function () { UI.loading('', false); };
    Input.setBindings(App.settings.keys, App.settings.pad);
    Input.rumbleOn = !!App.settings.vibrate;
    Input.deadzone = App.settings.deadzone;
    BA.Narr.setup(App.settings);
    BA.Narr.onVoices = function () { if (UI.cur === 'scrSettings') UI.openSettings(true); };
    Input.init({
      joyZone: $('joyZone'), joyBase: $('joyBase'), joyKnob: $('joyKnob'),
      shoot: $('bShoot'), pass: $('bPass'), gocek: $('bGocek'), sw: $('bSwitch'), sprint: $('bSprint'), skip: $('cine')
    });
    App.defaultDevice = Input.device;
    BA.Layout.init();
    Input.onPause = function () {
      if (!App.match || (UI.cur !== 'play' && UI.cur !== 'scrPause')) return;
      if (UI.cur === 'scrPause') App.resume(); else App.pause();
    };
    Input.onCam = function () { App.cycleCam(); };
    Input.onNav = function (d) { UI.nav(d); };
    Input.onOk = function () { UI.navOk(); };
    Input.onBack = function () { UI.navBack(); };
    Input.onDevice = function () { App.applyDevice(); };
    Input.onPadChange = function (on, fresh) {
      if (on && fresh) UI.toast('Stik terhubung');
      if (!on) { UI.toast('Stik terputus'); if (Input.device === 'pad') Input.setDevice(App.defaultDevice === 'pad' ? 'kb' : App.defaultDevice); }
      App.applyDevice();
      if (UI.cur === 'scrSettings') UI.openSettings(true);
    };
    App.applyDevice();
    // tombol online
    document.querySelectorAll('[data-onl]').forEach(function (b) { b.addEventListener('click', function () { Audio.init(); App.setOnlineRole(b.getAttribute('data-onl')); }); });
    $('btnHostCfg').addEventListener('click', function () { UI.openSetup('host', App.onlineCfg()); });
    $('btnHostStart').addEventListener('click', function () { Audio.init(); App.hostStart(); });
    $('btnJoin').addEventListener('click', function () { Audio.init(); App.guestJoin($('inCode').value); });
    $('inCode').addEventListener('keydown', function (e) { if (e.key === 'Enter') App.guestJoin($('inCode').value); });
    $('btnOnRetry').addEventListener('click', function () { Net.avail = null; App.openOnline(); });
    App.lanInit();
    $('btnShareLink').addEventListener('click', function () {
      var code = String($('roomCode').textContent || '').trim();
      if (!/^[A-Z0-9]{4,6}$/i.test(code)) return;
      var lb = $('roomLink'); lb.hidden = false; lb.textContent = Net.qrText(code);
      Net.shareLink(code).then(function (how) { UI.toast(how === 'shared' ? 'Tautan dibagikan' : (how === 'copied' ? 'Tautan disalin, tempel di WhatsApp' : 'Salin tautan di bawah lalu kirim ke lawan')); });
    });
    $('btnCamScan').addEventListener('click', function () {
      Audio.init();
      var box = $('camScan'); box.hidden = false;
      $('camStatus').textContent = 'Membuka kamera…';
      Net.scanCamera($('camVideo'), function (code) {
        box.hidden = true; $('inCode').value = code.toUpperCase(); App.guestJoin(code);
      }, function (err) {
        box.hidden = true;
        UI.status('guestStatus', 'bad', 'Kamera langsung tidak bisa dipakai di sini (' + ((err && err.name === 'NotAllowedError') ? 'izin ditolak' : 'tidak tersedia') + '). Pakai tombol Foto QR.');
        try { $('inScan').click(); } catch (e) { /* abaikan */ }
      }, function (msg) { $('camStatus').textContent = msg; });
    });
    $('btnCamStop').addEventListener('click', function () { Net.stopCamera(); $('camScan').hidden = true; });
    $('inScan').addEventListener('change', function () {
      var f = $('inScan').files && $('inScan').files[0];
      UI.status('guestStatus', 'wait', 'Membaca QR…');
      Net.scanFile(f).then(function (code) { $('inCode').value = code.toUpperCase(); App.guestJoin(code); }, function (err) { UI.status('guestStatus', 'bad', (err && err.message) || 'QR tidak terbaca.'); });
      $('inScan').value = '';
    });
    $('btnGuestReady').addEventListener('click', function () {
      Audio.init();
      App.online.guestReady = !App.online.guestReady;
      Net.send({ rd: App.online.guestReady ? 1 : 0, t: D.packTeam(App.myTeam) });
      $('btnGuestReady').textContent = App.online.guestReady ? 'Batal siap' : 'Saya siap';
      UI.status('guestStatus', 'ok', App.online.guestReady ? 'Siap! Menunggu tuan rumah menekan Mulai…' : 'Tekan Saya siap bila sudah.');
    });
    root.addEventListener('resize', function () { R3.resize(); });
    root.addEventListener('orientationchange', function () { setTimeout(R3.resize, 250); setTimeout(R3.resize, 800); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) BA.Narr.stop();
      if (document.hidden && App.match && App.match.kind === 'local' && !App.paused && UI.cur === 'play') App.pause();
      if (!document.hidden) { last = 0; }
    });
    var unlock = function () { Audio.init(); if (BA.Narr) BA.Narr.unlock(); };
    root.addEventListener('pointerdown', unlock, { passive: true });
    root.addEventListener('keydown', unlock, { passive: true });
    // kode room dari QR yang dipindai kamera HP
    var loc = root.location || {};
    var qm = String(loc.search || '').match(/[?&]r(?:oom)?=([a-z0-9]{4,6})(?:&|$)/i);
    var hm = String(loc.hash || '').match(/^#bola-([a-z0-9]{4,6})$/i);
    if (qm) App.pendingCode = qm[1].toLowerCase(); else if (hm) App.pendingCode = hm[1].toLowerCase();
    UI.renderRecords(App.records);
    App.buildShowcase();
    UI.show('scrMenu', false);
    UI.loading('', false);
    if (App.pendingCode) App.openOnline();
    root.requestAnimationFrame(App.frame);
    // gambar ulang tekstur bertulisan setelah font termuat
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { BA.Chars.clearCache(); BA.Chars.clearMats(); App.showcaseChars = true; });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', App.boot);
  else App.boot();
})(typeof window !== 'undefined' ? window : globalThis);
