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
  App.returning = U.store.get('settings', null) !== null || U.store.get('records', null) !== null || U.store.get('team', null) !== null;
  App.settings = Object.assign({
    sound: true, quality: lowEnd() ? 0 : 1, cam: 'auto', camZoom: 1, autoSprint: true, showPower: true, vibrate: true,
    keys: null, pad: null, deadzone: 0.2, touchUi: 'auto', legend: true, minimap: 'auto',
    nLang: 'id', nVoice: true, nSubs: true, nVol: 1, nRate: 1, nVoiceURI: '', nPersona: 'bejo', layout: null, autoFs: true, crowd: 0.7,
    easy: true, padSet: 'full', lang: '', nick: '', fitHud: true
  }, U.store.get('settings', {}));
  (function (S) {
    if (['auto', 'samping', 'belakang'].indexOf(S.cam) < 0) S.cam = 'auto';
    S.camZoom = U.clamp(U.num(S.camZoom, 1), 0.8, 1.3);
    if (['auto', 'on', 'off'].indexOf(S.touchUi) < 0) S.touchUi = 'auto';
    if (['auto', 'on', 'off'].indexOf(S.minimap) < 0) S.minimap = 'auto';
    if (['id', 'en', 'off'].indexOf(S.nLang) < 0) S.nLang = 'id';
    if (['id', 'en'].indexOf(S.lang) < 0) S.lang = '';
    if (['full', 'simple'].indexOf(S.padSet) < 0) S.padSet = 'full';
    S.easy = S.easy !== false; S.fitHud = S.fitHud !== false;
    S.nick = U.cleanText(S.nick, 12) || '';
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
    if (k === 'easy') Input.easy = !!v;
    if (k === 'padSet') App.applyDevice();
    if (k === 'lang' && BA.I18n) BA.I18n.set(v);
    if (/^n[A-Z]/.test(k)) BA.Narr.setup(App.settings);
    if (k === 'touchUi' || k === 'legend' || k === 'keys' || k === 'pad') App.applyDevice();
    if (k === 'layout') BA.Layout.apply();
  };
  /* tampilan sesuai perangkat aktif: tombol layar, petunjuk tombol, teks lewati */
  App.applyDevice = function () {
    var S = App.settings, dev = Input.device, b = document.body;
    var hide = S.touchUi === 'off' || (S.touchUi === 'auto' && dev !== 'touch');
    b.classList.toggle('hidepad', hide);
    var ctl = $('controls'); if (ctl) ctl.classList.toggle('simple', S.padSet === 'simple');
    b.classList.toggle('showlegend', !!S.legend && (dev === 'kb' || dev === 'pad'));
    UI.legend(dev);
    var sh = $('skipHint');
    if (sh) {
      var t = 'Ketuk layar untuk lewati';
      if (dev === 'pad') t = T('Tekan {0} untuk lewati', Input.padName(Input.pad.pass[0] >= 0 ? Input.pad.pass[0] : 0));
      else if (dev === 'kb') t = T('Tekan {0} untuk lewati', T(Input.keyName(Input.keys.skip[0] || Input.keys.skip[1] || 'Space')));
      if (sh.textContent !== t) sh.textContent = t;
    }
  };
  App.cycleCam = function () {
    var order = ['auto', 'samping', 'belakang'], i = order.indexOf(App.settings.cam);
    var v = order[(i + 1) % order.length];
    App.setSetting('cam', v);
    UI.toast(T('Kamera: {0}', { auto: 'Otomatis', samping: 'Samping (TV)', belakang: 'Belakang' }[v]));
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
    else if (go === 'strategy') UI.openStrategy('pre');
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
    /* kembali ke lobi (mis. dari layar strategi): siarkan lagi tim saya yang mungkin berubah */
    if (name === 'scrOnline' && App.online && App.online.state === 'lobby') {
      if (Net.role === 'host') App.hostRefresh();
      else if (Net.role === 'guest') { Net.send({ t: D.packTeam(App.myTeam), n: App.nick() }); App.guestRefresh(); }
    }
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

  /* pemain yang dikendalikan di perangkat ini (co-op tamu: pemain kedua tim 0) */
  App.ctlPlayer = function (st, m) {
    if (!st) return null;
    if (st.seatP) return st.seatP(m.seat || 0);
    return st.active ? (st.active[m.my] || null) : null;
  };
  App.updateMatch = function (dt, nowMs) {
    var m = App.match, v = m.view, st = m.state;
    Input.setCine(!!(v.cine && v.cine.active));
    if (m.kind !== 'guest') {
      var sim = m.sim;
      if (!App.paused) {
        var w = v.rig.toWorld(Input.sx, Input.sy);
        sim.setInput(m.seat || 0, Input.toSim(w.x, w.z));
        if (m.kind === 'host') {
          /* masukan tiap tamu masuk ke kursinya masing-masing.
             Tamu dianggap sudah di dalam laga begitu mengirim ack ber-id laga ini; selama masih ada tamu terdaftar yang belum masuk
             (baru mulai, layar belum selesai dimuat, atau tersambung lagi setelah sinyal putus) data kedua tim ikut disiarkan. */
          var gps = Net.guestPeers(), oo = App.online, nowD = Date.now(), need = false;
          for (var gk = 0; gk < gps.length; gk++) {
            var gp = gps[gk], gseat = seatOfId(m.roster, gp.id);
            if (gseat <= 0) continue;
            var gak = gp.pres && gp.pres.ack;
            if (!(Array.isArray(gak) && gak[0] === oo.mid)) {
              need = true;
              if (!m.waitFrom[gp.id]) m.waitFrom[gp.id] = nowD;
              else if (sim.seats[gseat] && nowD - m.waitFrom[gp.id] > 15000) { /* terlalu lama belum masuk: pemainnya dipegang NPC dulu */
                sim.clearSeat(gseat);
                UI.toast(T('{0} belum masuk laga — pemainnya dipegang NPC dulu', m.roster[gseat].n));
              }
              continue;
            }
            m.waitFrom[gp.id] = 0;
            if (!sim.seats[gseat]) {
              if (!sim.openSeat(gseat, m.roster[gseat].t)) continue;
              UI.toast(T('{0} masuk lagi ke laga', m.roster[gseat].n));
            }
            var gi = m.link.readGuest(gp.pres, gp.id);
            if (!gi) continue;
            sim.setInput(gseat, gi);
            var gsk = m.guestSkip[gp.id];
            if (gsk !== undefined && gi.skipSeq !== gsk && v.cine.active) v.cine.skip();
            m.guestSkip[gp.id] = gi.skipSeq;
          }
          if (need !== !!oo.teamsOn && (need || nowD > oo.teamsUntil)) {
            oo.teamsOn = need;
            Net.send(need ? { t: D.packTeam(sim.teams[0]), tb: D.packTeam(sim.teams[1]) } : { t: null, tb: null });
          }
          /* semua pemain lain hilang dari room: tunggu sebentar (sinyal bisa kembali) sebelum menawarkan lanjut lawan NPC */
          if (m.aloneAt) {
            if (gps.length) m.aloneAt = 0;
            else if (nowD - m.aloneAt > 12000) { m.aloneAt = 0; App.hostAlone(); }
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
      var gap = Net.lan ? 40 : (Net.transport === 'sb' ? ((m.roster && m.roster.length > 3) ? 100 : 80) : 50);
      if (nowMs - m.lastSend > gap) {
        var w2 = v.rig.toWorld(Input.sx, Input.sy);
        var pk = Net.packInput(Input.toSim(w2.x, w2.z));
        /* perintah kapten dibawa beberapa kali (±2,5 dtk) supaya pasti sampai */
        if (m.cmds && m.cmds.length) m.cmds = m.cmds.filter(function (c) { return nowMs - c.at < 2500; });
        var key = pk.join(',') + '|' + m.rv.lastEv + '|' + (m.cmds ? m.cmds.length + ':' + m.cmdSeq : '');
        if (key !== m.lastKey || nowMs - m.lastSend > 300) { /* kirim saat ada perubahan, atau paling lama tiap 0,3 dtk */
          m.lastSend = nowMs; m.lastKey = key;
          var msg = { i: pk, ack: [m.mid, m.rv.lastEv] };
          if (m.cmds && m.cmds.length) msg.cmd = [m.mid, m.cmdSeq, m.cmds.map(function (c) { return [c.n, c.c]; })];
          else if (m.hadCmd) { m.hadCmd = false; msg.cmd = null; }
          Net.sendFast(msg);
        }
      }
      if (Net.lastOtherAt && Date.now() - Net.lastOtherAt > 7000 && !m.warnedLag) { m.warnedLag = true; UI.toast(T('Menunggu tuan rumah…')); }
      /* tuan rumah hilang dari room: tunggu sebentar (sinyal bisa kembali) sebelum menyatakan laga berhenti */
      if (m.hostLostAt) {
        if (Net.hostPeer()) { m.hostLostAt = 0; m.warnedLag = false; UI.toast(T('Tersambung lagi dengan tuan rumah')); }
        else if (Date.now() - m.hostLostAt > 12000) { m.hostLostAt = 0; App.guestHostGone(); }
      }
    }
    if (!App.paused || m.kind !== 'local') {
      v.sync(dt, st, m.my);
      v.camera(dt, st, m.my);
    }
    BA.Narr.update(dt, st, App.paused && m.kind === 'local');
    v.minimap(dt, st, m.my, App.settings.minimap);
    var mePl = App.ctlPlayer(st, m);
    UI.hud(st, m.my, { me: mePl, canShoot: mePl ? st.inShotRange(mePl) || st.phase === 'pen' : true });
    if (UI.fitHud) UI.fitHud(st, m.my, mePl);
    App.aimUi(st, m);
    v.render();
    // jaga kelancaran
    if (dt > 0.042) m.slowT += dt; else m.slowT = Math.max(0, m.slowT - dt * 0.5);
    if (m.slowT > 3 && App.settings.quality > 0) { m.slowT = 0; App.setSetting('quality', App.settings.quality - 1); UI.toast('Grafis diturunkan agar lancar'); }
  };

  App.aimUi = function (st, m) {
    var my = m.my, p = null, me = App.ctlPlayer(st, m);
    if (st.aim && st.aim.team === my && st.aim.p && st.aim.p === me) p = st.aim.p;
    if (st.phase === 'pen' && st.pen && st.pen.state === 'aim' && st.pen.team === my && App.penMine(st, m)) p = st.pen.shooter;
    if (!p || (m.view && m.view.cine.active)) { UI.aim(false); return; }
    UI.aim(true, { revealed: st.revealed[1 - my] || {}, shot: p.shot, zc: Input.zc, zr: Input.zr, charge: Input.chargeNow(), mult: true });
  };

  /* penalti ini giliran saya? (tim berisi beberapa manusia: bergiliran) */
  App.penMine = function (st, m) {
    if (!st.pen || st.pen.team !== m.my) return false;
    var ps = st.penSeat ? st.penSeat(st.pen) : -1;
    return ps < 0 || ps === (m.seat || 0);
  };
  /* kapten = pengendali pertama di timnya: hanya dia yang mengatur formasi & pergantian */
  App.isCaptain = function () {
    var m = App.match;
    if (!m) return false;
    if (m.kind === 'local') return true;
    var l = m.state.teamSeats ? m.state.teamSeats(m.my) : [];
    return l.length > 0 && l[0] === (m.seat || 0);
  };
  /* perintah strategi (formasi, taktik, tukar posisi, ganti pemain) dari layar strategi */
  App.teamCmd = function (c) {
    var m = App.match;
    if (!m || !App.isCaptain()) return false;
    if (m.kind === 'guest') {
      m.cmdSeq = (m.cmdSeq || 0) + 1;
      (m.cmds || (m.cmds = [])).push({ n: m.cmdSeq, c: c, at: performance.now() });
      if (m.cmds.length > 6) m.cmds.shift();
      m.hadCmd = true; m.lastKey = '';
      return true;
    }
    m.sim.teamCmd(m.my, c);
    if (App.paused) { m.sim.applyCmds(); BA.handleEvents(m.sim.drainEvents(), m); }
    return true;
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

  /* ---------- online: sampai 8 pemain (1 tuan rumah + 7 tamu), pembagian tim bebas, sisa diisi NPC ---------- */
  function T(s) { return BA.t ? BA.t.apply(null, arguments) : s; }
  App.onlineCfg = function () {
    var cfg = App.setups.online || (App.setups.online = defaultSetup());
    cfg.rules = Object.assign(D.defaultRules(), cfg.rules || {});
    return cfg;
  };
  function packCfg(cfg, weather) {
    return { m: 'match', f: D.fieldById[cfg.field] ? cfg.field : 'kampung', a: cfg.arena, w: weather || pickWeather(cfg.weather), b: cfg.ball, co: cfg.coop ? 1 : 0, r: { d: cfg.rules.dur, t: cfg.rules.tie, bo: cfg.rules.bound, tp: cfg.rules.tigaPojok ? 1 : 0, bp: cfg.rules.bolaPanas ? 1 : 0, pr: cfg.rules.pro ? 1 : 0 } };
  }
  function unpackCfg(c) {
    c = c || {};
    var r = c.r || {};
    return {
      mode: 'match', field: D.fieldById[c.f] ? c.f : 'kampung', arena: D.arenaById[c.a] ? c.a : 'kampung', weather: D.weatherById[c.w] ? c.w : 'cerah', ball: D.ballById[c.b] ? c.b : 'merah',
      coop: !!c.co,
      rules: D.applyRuleset({ dur: [120, 240, 360].indexOf(r.d) >= 0 ? r.d : 240, tie: ['penalti', 'emas', 'seri'].indexOf(r.t) >= 0 ? r.t : 'penalti', bound: r.bo === 'keluar' ? 'keluar' : 'pantul', tigaPojok: !!r.tp, bolaPanas: !!r.bp, diff: 1, pro: !!r.pr })
    };
  }
  function blankOnline() { return { state: 'idle', mid: 0, endedMid: 0, roster: [], force: {}, hostTeam: null, hostCfg: null, tb: null, code: '', sent: '' }; }
  App.online = blankOnline();
  App.nick = function () { return U.cleanText(App.settings.nick, 12) || 'Pemain'; };
  /* daftar pemain: [{ id, n: nama, t: tim 0/1, rd: siap }] — urutan = nomor kursi di simulasi; kursi 0 selalu tuan rumah (tim A) */
  function packRo(ro) { return ro.map(function (r) { return [r.id, r.n, r.t, r.rd ? 1 : 0]; }); }
  function unpackRo(a) {
    if (!Array.isArray(a)) return [];
    return a.slice(0, 8).map(function (x) { x = Array.isArray(x) ? x : []; return { id: String(x[0] || ''), n: U.cleanText(String(x[1] || ''), 12) || 'Pemain', t: x[2] === 1 ? 1 : 0, rd: !!x[3] }; });
  }
  function seatOfId(ro, id) { for (var i = 0; i < ro.length; i++) if (ro[i].id === id) return i; return -1; }
  App.hostRoster = function () {
    var o = App.online, def = App.onlineCfg().coop ? 0 : 1;
    var ro = [{ id: 'H', n: App.nick(), t: 0, rd: true }];
    Net.guestPeers().forEach(function (p, k) {
      var pr = p.pres || {}, w = (pr.w === 0 || pr.w === 1) ? pr.w : null;
      if (pr.st === 'bye') return; /* sedang pamit keluar */
      var team = w === null ? def : w;
      var f = o.force[p.id];
      if (f) { if (f.w === w) team = f.t; else delete o.force[p.id]; } /* tamu mengubah pilihannya sendiri: pengaturan tuan rumah gugur */
      ro.push({ id: p.id, n: U.cleanText(String(pr.n || ''), 12) || (T('Tamu') + ' ' + (k + 1)), t: team, rd: !!pr.rd });
    });
    return ro.slice(0, 8);
  };
  /* tim B: tim milik tamu pertama di tim B (kapten); kalau tim B tanpa manusia, tim NPC pilihan tuan rumah */
  App.hostTeamB = function (ro) {
    var cfg = App.onlineCfg();
    for (var i = 1; i < ro.length; i++) if (ro[i].t === 1) { var p = Net.peers[ro[i].id]; if (p && p.pres && p.pres.t) return { team: D.unpackTeam(p.pres.t), by: ro[i].id }; }
    var oi = (cfg.opp >= 0 && D.TEAMS[cfg.opp]) ? cfg.opp : ((cfg._oi != null && D.TEAMS[cfg._oi]) ? cfg._oi : (cfg._oi = Math.floor(Math.random() * D.TEAMS.length)));
    return { team: U.copy(D.TEAMS[oi]), npc: oi };
  };
  App.rosterProblem = function (ro, fieldId) {
    var fd = D.fieldById[fieldId] || D.FIELDS[0], cap = fd.n - 1, c = [0, 0];
    ro.forEach(function (r) { c[r.t]++; });
    for (var t = 0; t < 2; t++) if (c[t] > cap) return T('Tim {0} berisi {1} pemain manusia, padahal lapangan {2} hanya memuat {3} per tim (kiper dijaga NPC). Pindahkan pemain ke tim lain atau pilih lapangan yang lebih besar.', t ? 'B' : 'A', c[t], fd.short, cap);
    return '';
  };

  App.openOnline = function () {
    UI.show('scrOnline');
    var nk = $('inNick'); if (nk) nk.value = U.cleanText(App.settings.nick, 12) || '';
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
        if (why) why.textContent = Net.inAppBrowser() ? T('Sepertinya game dibuka di jendela dalam aplikasi (WhatsApp/Instagram). Jendela ini biasanya memblokir sambungan room dan kamera. Buka tautannya di Chrome atau Safari.')
          : (!root.claude ? (Net.SB.url ? T('Layanan room online tidak terjangkau. Periksa koneksi internet lalu tekan Coba periksa lagi.') : T('Halaman game tidak dimuat lewat claude.ai, jadi layanan room tidak tersedia.')) : T('Layanan room tidak merespons. Periksa internet lalu coba lagi.'));
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
    if (role === 'lan') { Net.leave(); App.online = blankOnline(); UI.onlineMode('lan'); UI.lanRole(App.lanRole || 'host'); return; }
    if (Net.lan) Net.leave();
    UI.onlineMode(role);
    if (role === 'host') { if (Net.role !== 'host') App.hostCreate(); else App.refreshHostCfg(); }
    else { if (Net.role === 'host') Net.leave(); App.online.state = 'idle'; UI.status('guestStatus', '', T('Belum tersambung.')); $('guestVs').classList.add('hidden'); $('guestReady').classList.add('hidden'); }
  };
  App.leaveOnline = function () { Net.stopCamera(); var cs = $('camScan'); if (cs) cs.hidden = true; Net.leave(); App.online = blankOnline(); };

  /* keadaan lobi tuan rumah yang disiarkan: nama, tim A, aturan, daftar pemain, tim B */
  function hostLobbyPatch(ro) {
    var tb = App.hostTeamB(ro);
    return { st: 'lobby', n: App.nick(), t: D.packTeam(App.myTeam), c: packCfg(App.onlineCfg()), ro: packRo(ro), tb: tb.npc != null ? { npc: tb.npc } : D.packTeam(tb.team) };
  }
  App.hostCreate = function () {
    var code = U.code(4);
    App.online = blankOnline();
    App.online.state = 'lobby'; App.online.code = code;
    $('roomCode').textContent = code.toUpperCase();
    UI.status('hostStatus', 'wait', T('Membuka room…'));
    $('hostVs').classList.add('hidden');
    $('btnHostStart').disabled = true;
    $('hostCfgSummary').textContent = UI.cfgSummary(App.onlineCfg());
    Net.drawQR($('qr'), Net.qrText(code));
    Net.join(code, 'host', hostLobbyPatch(App.hostRoster())).then(function () {
      App.hostRefresh();
    }, function (e) {
      UI.status('hostStatus', 'bad', T('Room gagal dibuka ({0}). Coba lagi sebentar.', (e && e.code) || 'galat'));
    });
  };
  /* hitung ulang daftar pemain, siarkan bila berubah, dan gambar papan tim */
  App.hostRefresh = function () {
    var o = App.online;
    if (Net.role !== 'host' || o.state !== 'lobby') return;
    var cfg = App.onlineCfg(), ro = App.hostRoster(), tb = App.hostTeamB(ro);
    o.roster = ro;
    var patch = hostLobbyPatch(ro), key = JSON.stringify(patch);
    if (key !== o.sent) { o.sent = key; Net.send(Object.assign({ s: null, e: null, mid: null }, patch)); }
    $('hostCfgSummary').textContent = UI.cfgSummary(cfg);
    var rdy = ro.filter(function (r) { return r.rd; });
    var prob = App.rosterProblem(ro, cfg.field), guests = ro.length - 1, ready = rdy.length === ro.length;
    UI.rosterBox('hostVs', { roster: ro, teamA: App.myTeam, teamB: tb.team, npcB: tb.npc != null, mySeat: 0, host: true, cap: D.squadOf(cfg.field) - 1,
      onMove: function (i) { var r = ro[i], p = Net.peers[r.id], w = p && (p.pres.w === 0 || p.pres.w === 1) ? p.pres.w : null; o.force[r.id] = { t: r.t ? 0 : 1, w: w }; App.hostRefresh(); } });
    $('btnHostStart').disabled = !(rdy.length > 1 && !App.rosterProblem(rdy, cfg.field));
    if (prob) UI.status('hostStatus', 'bad', prob);
    else if (!guests) UI.status('hostStatus', 'wait', Net.lan ? T('Menunggu tamu tersambung…') : T('Menunggu pemain lain memindai QR…'));
    else if (ready) UI.status('hostStatus', 'ok', T('{0} pemain siap. Tekan Mulai!', ro.length));
    else if (rdy.length > 1) UI.status('hostStatus', 'wait', T('{0} dari {1} pemain siap. Tunggu yang lain, atau tekan Mulai untuk bermain tanpa mereka.', rdy.length, ro.length));
    else UI.status('hostStatus', 'wait', T('{0} pemain di room. Menunggu semua menekan Saya siap…', ro.length));
  };
  App.refreshHostCfg = function () {
    $('hostCfgSummary').textContent = UI.cfgSummary(App.onlineCfg());
    App.hostRefresh();
  };
  App.hostStart = function (force) {
    var o = App.online;
    if (Net.role !== 'host' || o.state !== 'lobby') return;
    var cfg = App.onlineCfg(), pc = packCfg(cfg), uc = unpackCfg(pc);
    /* yang ikut laga hanya pemain yang sudah siap; urutannya = nomor kursi */
    var all = App.hostRoster(), ro = all.filter(function (r) { return r.rd; });
    if (ro.length < 2) return;
    var late = all.filter(function (r) { return !r.rd; });
    if (late.length && force !== true) {
      UI.confirm(T('Belum semua siap'), T('{0} belum menekan Saya siap. Mulai tanpa mereka? Mereka bisa ikut di laga berikutnya.', late.map(function (r) { return r.n; }).join(', ')), [
        { label: T('Mulai sekarang'), main: true, fn: function () { App.hostStart(true); } },
        { label: T('Tunggu dulu') }]);
      return;
    }
    var prob = App.rosterProblem(ro, uc.field);
    if (prob) { UI.status('hostStatus', 'bad', prob); return; }
    var tb = App.hostTeamB(ro);
    var tA = D.matchTeam(App.myTeam, uc.field), tB = D.matchTeam(tb.team, uc.field);
    o.mid = (Date.now() % 1000000) + 1;
    var simCfg = { mode: 'match', field: uc.field, teams: [tA, tB], arena: uc.arena, weather: uc.weather, ball: uc.ball, rules: uc.rules, seats: ro.map(function (r) { return r.t; }), seed: (Math.random() * 1e9) | 0 };
    var sim = new BA.Sim(simCfg);
    var link = new Net.HostLink(sim, o.mid);
    link.onCmd = function (peerId, c) { App.hostGuestCmd(peerId, c); };
    o.roster = ro; o.state = 'play'; o.sent = ''; o.teamsUntil = Date.now() + 1500; o.teamsOn = true;
    Net.send({ st: 'play', mid: o.mid, c: pc, ro: packRo(ro), t: D.packTeam(tA), tb: tb.npc != null ? { npc: tb.npc } : D.packTeam(tB), e: [], s: sim.snapshot(true) });
    App.beginMatch({ kind: 'host', sim: sim, state: sim, my: 0, seat: 0, simCfg: simCfg, link: link, roster: ro, guestSkip: {}, waitFrom: {}, aloneAt: 0, meta: { label: 'online' } });
  };
  /* perintah strategi dari tamu: hanya kapten (kursi pertama di timnya) yang boleh */
  App.hostGuestCmd = function (peerId, c) {
    var m = App.match;
    if (!m || m.kind !== 'host' || !m.roster) return;
    var seat = seatOfId(m.roster, peerId);
    if (seat < 0 || !m.sim.seats[seat]) return;
    var team = m.sim.seats[seat].team, l = m.sim.teamSeats(team);
    if (!l.length || l[0] !== seat) return;
    m.sim.teamCmd(team, c);
  };
  App.hostBackToLobby = function () {
    var o = App.online;
    o.state = 'lobby'; o.sent = '';
    UI.show('scrOnline', false);
    UI.onlineMode('host', !!Net.lan);
    App.hostRefresh();
  };

  App.guestJoin = function (raw) {
    var code = Net.cleanCode(raw);
    if (!code) { UI.status('guestStatus', 'bad', T('Kode harus 4 huruf/angka.')); return; }
    UI.status('guestStatus', 'wait', T('Menyambung ke room {0}…', code.toUpperCase()));
    App.online = blankOnline();
    App.online.state = 'joining'; App.online.code = code;
    Net.join(code, 'guest', { st: 'lobby', n: App.nick(), t: D.packTeam(App.myTeam), rd: 0 }).then(function () {
      App.online.state = 'lobby';
      UI.status('guestStatus', 'wait', T('Masuk room. Mencari tuan rumah…'));
      setTimeout(function () { if (!Net.hostPeer() && App.online.state === 'lobby' && Net.role === 'guest') UI.status('guestStatus', 'bad', T('Tuan rumah belum terlihat. Pastikan kodenya benar dan tuan rumah membuka layar QR.')); }, 6000);
    }, function (e) {
      UI.status('guestStatus', 'bad', T('Gagal masuk room ({0}).', (e && e.code) || 'galat'));
    });
  };
  /* gambar lobi tamu dari kabar terakhir tuan rumah */
  App.guestRefresh = function () {
    var o = App.online, hp = Net.hostPeer();
    if (Net.role !== 'guest' || (o.state !== 'lobby' && o.state !== 'joining')) return;
    if (!hp) { $('guestVs').classList.add('hidden'); $('guestReady').classList.add('hidden'); return; }
    var ro = o.roster || [], seat = seatOfId(ro, Net.selfId), cfg = o.hostCfg;
    var tB = o.tb && typeof o.tb.npc === 'number' ? D.TEAMS[o.tb.npc] : (o.tb ? D.unpackTeam(o.tb) : null);
    if (o.hostTeam && ro.length) {
      UI.rosterBox('guestVs', { roster: ro, teamA: o.hostTeam, teamB: tB, npcB: !!(o.tb && typeof o.tb.npc === 'number'), mySeat: seat, host: false, cap: cfg ? D.squadOf(cfg.field) - 1 : 4,
        onPick: function (t) { Net.send({ w: t }); } });
    }
    $('guestReady').classList.remove('hidden');
    $('guestCfgSummary').textContent = cfg ? T('Aturan dari tuan rumah:') + ' ' + UI.tr(UI.cfgSummary(cfg)) : '';
    var hpres = hp.pres || {};
    if (hpres.st === 'play' && o.state !== 'play') UI.status('guestStatus', 'wait', T('Laga sedang berjalan. Tunggu sampai selesai, lalu kamu ikut laga berikutnya.'));
    else if (seat < 0 && ro.length) UI.status('guestStatus', 'wait', ro.length >= 8 ? T('Room penuh (8 pemain).') : T('Tersambung. Menunggu tuan rumah memasukkanmu ke daftar pemain…'));
    else if (!(Net.mine && Net.mine.rd)) UI.status('guestStatus', 'ok', T('Tersambung dengan tuan rumah. Pilih tim lalu tekan Saya siap.'));
    else UI.status('guestStatus', 'ok', T('Siap! Menunggu tuan rumah memulai…'));
  };
  App.guestBackToLobby = function () {
    var o = App.online;
    o.endedMid = o.mid; // jangan masuk lagi ke laga yang sudah selesai
    o.state = 'lobby';
    Net.send({ st: 'lobby', i: null, ack: null, cmd: null, rd: 0, n: App.nick(), t: D.packTeam(App.myTeam) });
    UI.show('scrOnline', false);
    UI.onlineMode('guest', !!Net.lan);
    $('btnGuestReady').textContent = T('Saya siap'); $('btnGuestReady').disabled = false;
    if (Net.hostPeer()) App.guestRefresh();
    else { $('guestReady').classList.add('hidden'); $('guestVs').classList.add('hidden'); UI.status('guestStatus', 'bad', T('Tuan rumah sudah tidak ada di room.')); }
  };

  App.guestBeginMatch = function (pres) {
    var o = App.online;
    var cfg = unpackCfg(pres.c), ro = unpackRo(pres.ro), seat = seatOfId(ro, Net.selfId);
    if (seat < 0 || !pres.t || !pres.tb) return false; /* masuk saat laga sudah jalan: tunggu laga berikutnya */
    var tA = D.unpackTeam(pres.t);
    var tB = typeof pres.tb.npc === 'number' ? U.copy(D.TEAMS[pres.tb.npc] || D.TEAMS[0]) : D.unpackTeam(pres.tb);
    var rv = new BA.RemoteView({ mode: 'match', field: cfg.field, teams: [tA, tB], arena: cfg.arena, weather: cfg.weather, ball: cfg.ball, rules: cfg.rules, seats: ro.map(function (r) { return r.t; }) });
    o.state = 'play'; o.mid = pres.mid; o.roster = ro;
    Net.send({ st: 'play', rd: 0 });
    App.beginMatch({ kind: 'guest', rv: rv, state: rv, my: ro[seat].t, seat: seat, mid: pres.mid, roster: ro, cmds: [], cmdSeq: 0, meta: { label: 'online' } });
    if (pres.s) rv.push(pres.s, performance.now());
    return true;
  };

  Net.on('joined', function (p) {
    if (Net.lan) {
      // sambungan WiFi lokal jadi: tampilkan lobi (bagian undangan tetap terbuka di sisi tuan rumah untuk tamu berikutnya)
      var lc = $('lanCam'); if (lc) lc.hidden = true; Net.stopCamera();
      $('onNo').classList.add('hidden'); $('onYes').classList.remove('hidden'); $('onChoose').classList.toggle('hidden', !Net.avail);
      if (Net.role === 'host') {
        if (App.online.state !== 'play') App.online.state = 'lobby';
        UI.onlineMode('host', true);
        $('lanOfferBox').hidden = true; $('lanAnswerTxt').value = '';
        UI.status('lanHostStatus', 'ok', T('Tersambung: {0} tamu. Tekan "Buat kode undangan" lagi untuk mengundang tamu berikutnya.', Net.guestPeers().length));
        App.hostRefresh();
      } else { App.online.state = 'lobby'; UI.onlineMode('guest', true); UI.status('guestStatus', 'ok', T('Tersambung lewat WiFi lokal dengan tuan rumah.')); }
      UI.toast(T('Sambungan WiFi lokal terhubung'));
      return;
    }
    void p;
  });
  /* ---------- WiFi lokal (WebRTC) ---------- */
  App.lanRole = 'host';
  App.lanInit = function () {
    var lanStat = function (id, cls, t) { UI.status(id, cls, t); };
    var shareTxt = function (label, code) {
      var text = label + ' ' + T('Bola Api Arena (WiFi lokal)') + ':\n' + code;
      if (navigator.share) { try { navigator.share({ title: 'Bola Api Arena', text: text }).then(function () { UI.toast(T('Kode dibagikan')); }, function () { /* batal */ }); return; } catch (e) { /* lanjut */ } }
      try { navigator.clipboard.writeText(code).then(function () { UI.toast(T('Kode disalin')); }, function () { UI.toast(T('Salin manual dari kotak kode')); }); } catch (e2) { UI.toast(T('Salin manual dari kotak kode')); }
    };
    var copyTxt = function (code) { try { navigator.clipboard.writeText(code).then(function () { UI.toast(T('Kode disalin')); }, function () { UI.toast(T('Salin manual dari kotak kode')); }); } catch (e) { UI.toast(T('Salin manual dari kotak kode')); } };
    document.querySelectorAll('[data-lan]').forEach(function (b) { b.addEventListener('click', function () { Audio.init(); App.lanRole = b.getAttribute('data-lan'); Net.leave(); App.online = blankOnline(); UI.lanRole(App.lanRole); $('lanOfferBox').hidden = true; $('lanAnswerBox').hidden = true; lanStat('lanHostStatus', '', T('Belum ada sambungan.')); lanStat('lanGuestStatus', '', T('Belum ada sambungan.')); }); });
    $('btnGoLan').addEventListener('click', function () { Audio.init(); App.setOnlineRole('lan'); $('onLan').scrollIntoView({ behavior: 'smooth' }); });
    $('btnLanOffer').addEventListener('click', function () {
      Audio.init();
      lanStat('lanHostStatus', 'wait', T('Membuat kode undangan…'));
      var fresh = !(Net.lan && Net.lan.role === 'host');
      if (fresh) { App.online = blankOnline(); App.online.state = 'lobby'; }
      Net.lanOffer().then(function (code) {
        if (fresh) Net.send(Object.assign({ r: 'h', v: Net.V }, hostLobbyPatch(App.hostRoster())));
        $('lanOfferTxt').value = code; $('lanOfferBox').hidden = false; $('lanAnswerTxt').value = '';
        Net.drawQR($('lanQr'), code, true);
        lanStat('lanHostStatus', 'wait', T('Kode siap ({0} karakter). Kirim ke tamu, lalu tempel/pindai kode balasannya.', code.length));
      }, function (e) { lanStat('lanHostStatus', 'bad', (e && e.code) === 'penuh' ? T('Room penuh (8 pemain).') : T('Gagal membuat kode ({0}). Browser mungkin tidak mendukung WebRTC.', (e && e.code) || (e && e.message) || 'galat')); });
    });
    $('btnLanOfferCopy').addEventListener('click', function () { copyTxt($('lanOfferTxt').value); });
    $('btnLanOfferShare').addEventListener('click', function () { shareTxt(T('Kode undangan'), $('lanOfferTxt').value); });
    $('btnLanAccept').addEventListener('click', function () {
      Audio.init();
      var v = $('lanAnswerTxt').value;
      if (!Net.lanParse(v)) { lanStat('lanHostStatus', 'bad', T('Kode balasan tidak dikenali. Harus diawali BAL1:a:')); return; }
      lanStat('lanHostStatus', 'wait', T('Menyambungkan ke tamu…'));
      var before = Net.lanOpenCount();
      Net.lanAccept(v).then(function () { setTimeout(function () { if (Net.lan && Net.lanOpenCount() <= before) lanStat('lanHostStatus', 'bad', T('Belum tersambung. Pastikan kedua HP di WiFi/hotspot yang sama, lalu buat kode baru.')); }, 12000); }, function (e) { lanStat('lanHostStatus', 'bad', T('Kode balasan ditolak ({0}).', (e && e.code) || 'galat')); });
    });
    $('btnLanAnswer').addEventListener('click', function () {
      Audio.init();
      var v = $('lanOfferIn').value;
      if (!Net.lanParse(v)) { lanStat('lanGuestStatus', 'bad', T('Kode undangan tidak dikenali. Harus diawali BAL1:o:')); return; }
      lanStat('lanGuestStatus', 'wait', T('Membuat kode balasan…'));
      App.online = blankOnline(); App.online.state = 'lobby';
      Net.lanAnswer(v).then(function (code) {
        Net.send({ r: 'g', v: Net.V, st: 'lobby', n: App.nick(), t: D.packTeam(App.myTeam), rd: 0 });
        $('lanAnswerOut').value = code; $('lanAnswerBox').hidden = false;
        Net.drawQR($('lanQr2'), code, true);
        lanStat('lanGuestStatus', 'wait', T('Kirim kode balasan ke tuan rumah. Begitu dia menekan Sambungkan, kalian terhubung.'));
      }, function (e) { lanStat('lanGuestStatus', 'bad', T('Gagal membaca kode ({0}).', (e && e.code) || (e && e.message) || 'galat')); });
    });
    $('btnLanAnswerCopy').addEventListener('click', function () { copyTxt($('lanAnswerOut').value); });
    $('btnLanAnswerShare').addEventListener('click', function () { shareTxt(T('Kode balasan'), $('lanAnswerOut').value); });
    var scanTo = function (target, statusId) {
      return function () {
        Audio.init();
        var box = $('lanCam'); box.hidden = false; $('lanCamStatus').textContent = T('Membuka kamera…');
        Net.scanCamera($('lanVideo'), function (code) { box.hidden = true; $(target).value = code; UI.toast(T('QR terbaca')); }, function (err) {
          box.hidden = true; lanStat(statusId, 'bad', T('Kamera tidak bisa dipakai ({0}). Pakai Foto QR atau tempel kode.', (err && err.name === 'NotAllowedError') ? T('izin ditolak') : T('tidak tersedia')));
        }, function (msg) { $('lanCamStatus').textContent = T(msg); }, true);
      };
    };
    $('btnLanScanA').addEventListener('click', scanTo('lanAnswerTxt', 'lanHostStatus'));
    $('btnLanScanO').addEventListener('click', scanTo('lanOfferIn', 'lanGuestStatus'));
    $('btnLanCamStop').addEventListener('click', function () { Net.stopCamera(); $('lanCam').hidden = true; });
    var fileTo = function (inputId, target, statusId) {
      $(inputId).addEventListener('change', function () {
        var f = $(inputId).files && $(inputId).files[0];
        lanStat(statusId, 'wait', T('Membaca QR…'));
        Net.scanFile(f, true).then(function (code) { $(target).value = code; lanStat(statusId, 'ok', T('QR terbaca, kode sudah diisi.')); }, function (err) { lanStat(statusId, 'bad', T((err && err.message) || 'QR tidak terbaca.')); });
        $(inputId).value = '';
      });
    };
    fileTo('inLanScanA', 'lanAnswerTxt', 'lanHostStatus'); fileTo('inLanScanO', 'lanOfferIn', 'lanGuestStatus');
  };
  Net.on('presence', function (peer) {
    var o = App.online, pres = peer && peer.pres;
    if (!pres) return;
    if (Net.role === 'host') {
      if (o.state === 'lobby') App.hostRefresh();
      return;
    }
    if (Net.role === 'guest') {
      if (pres.t) { o.hostTeam = D.unpackTeam(pres.t); }
      if (pres.c) o.hostCfg = unpackCfg(pres.c);
      if (pres.ro) o.roster = unpackRo(pres.ro);
      if (pres.tb) o.tb = pres.tb;
      var m = App.match;
      if (pres.st === 'play' && pres.mid && pres.mid !== o.endedMid && (!m || m.kind !== 'guest' || m.mid !== pres.mid) && o.state !== 'play') {
        App.guestBeginMatch(pres);
        m = App.match;
      }
      if (m && m.kind === 'guest' && pres.st === 'play' && pres.mid === m.mid) {
        if (pres.s) m.rv.push(pres.s, performance.now());
        var evs = m.rv.newEvents(pres.e);
        if (evs.length) {
          evs.forEach(function (e) { if (e.k === 'sub') m.rv.applySub(e); });
          BA.handleEvents(evs, m);
        }
        return;
      }
      if (o.state === 'lobby' || o.state === 'joining') App.guestRefresh();
    }
  });
  /* tombol Kembali di aplikasi Android: saat laga = jeda/lanjut, di layar lain = kembali satu layar.
     Mengembalikan true bila sudah ditangani; false = sudah di menu utama (aplikasi boleh keluar) */
  App.androidBack = function () {
    try {
      var modal = document.getElementById('modal');
      if (modal && !modal.hidden) { UI.navBack(); return true; }
      if (BA.Layout && BA.Layout.editing) { BA.Layout.cancel(); return true; }
      if (App.match && (UI.cur === 'play' || UI.cur === 'scrPause' || UI.cur === 'scrStrategy')) {
        if (UI.cur === 'play') App.pause(); else if (UI.cur === 'scrStrategy') UI.show('scrPause', false); else App.resume();
        return true;
      }
      if (UI.cur && UI.cur !== 'scrMenu') { UI.navBack(); return true; }
    } catch (e) { /* abaikan */ }
    return false;
  };
  App.hostAlone = function () {
    var m0 = App.match;
    if (!m0 || m0.kind !== 'host') return;
    UI.confirm(T('Semua pemain lain terputus'), T('Pemain lain keluar atau sinyalnya hilang.'), [
      { label: T('Lanjut lawan NPC'), main: true, fn: function () { if (App.match && App.match.sim) { App.match.kind = 'local'; Net.leave(); } } },
      { label: T('Keluar'), fn: function () { App.quit(); } }]);
  };
  App.guestHostGone = function () {
    var m0 = App.match;
    if (!m0 || m0.kind !== 'guest') return;
    UI.confirm(T('Tuan rumah terputus'), T('Pertandingan online berhenti.'), [{ label: T('Kembali ke menu'), main: true, fn: function () { App.quit(); } }]);
  };
  Net.on('left', function (peer) {
    var m = App.match, id = peer && peer.id;
    var bye = !!(peer && peer.pres && peer.pres.st === 'bye'); /* pamit = sengaja keluar; selain itu bisa jadi sinyal putus sebentar */
    if (m && m.kind === 'host') {
      var seat = m.roster ? seatOfId(m.roster, id) : -1;
      if (seat > 0 && m.sim.seats[seat]) {
        m.sim.clearSeat(seat);
        UI.toast(T('{0} keluar — pemainnya diambil alih NPC', m.roster[seat].n));
      }
      if (!Net.guestPeers().length) {
        /* WiFi lokal tidak bisa menyambung sendiri; jalur internet diberi waktu untuk tersambung lagi */
        if (Net.lan || bye) App.hostAlone();
        else if (!m.aloneAt) { m.aloneAt = Date.now(); UI.toast(T('Pemain lain terputus — menunggu tersambung lagi…')); }
      }
    } else if (m && m.kind === 'guest') {
      if (Net.lan || bye) App.guestHostGone();
      else if (!m.hostLostAt) { m.hostLostAt = Date.now(); UI.toast(T('Tuan rumah terputus — menunggu tersambung lagi…')); }
    } else if (Net.role === 'host') {
      if (App.online.force) delete App.online.force[id];
      if (Net.lan) UI.status('lanHostStatus', 'wait', T('Seorang tamu terputus. Tersambung: {0} tamu.', Net.guestPeers().length));
      App.hostRefresh();
    } else if (Net.role === 'guest') {
      UI.status('guestStatus', 'bad', Net.lan ? T('Sambungan WiFi lokal terputus. Buat kode baru untuk menyambung lagi.') : T('Tuan rumah keluar dari room.'));
      $('guestReady').classList.add('hidden'); $('guestVs').classList.add('hidden');
    }
  });
  Net.on('error', function (e) {
    if (Net.lan) { UI.status(Net.role === 'host' ? 'lanHostStatus' : 'lanGuestStatus', 'bad', T('Sambungan WiFi lokal gagal ({0}). Pastikan satu WiFi/hotspot, lalu ulangi.', (e && e.code) || 'galat')); return; }
    if (Net.role === 'host') UI.status('hostStatus', 'bad', T('Sambungan room terputus ({0}).', (e && e.code) || 'galat'));
    else if (Net.role === 'guest') UI.status('guestStatus', 'bad', T('Sambungan room terputus ({0}).', (e && e.code) || 'galat'));
  });

  /* ---------- boot ---------- */
  App.boot = function () {
    if (!THREE) {
      UI.loading('Gagal memuat mesin 3D. Periksa koneksi internet lalu muat ulang.', true);
      return;
    }
    /* bahasa: pilihan tersimpan; pemain lama tetap Indonesia; pemain baru mengikuti bahasa perangkat */
    var lang0 = App.settings.lang || (App.returning ? 'id' : BA.I18n.detect());
    if (!App.settings.lang && !App.returning && lang0 === 'en') App.settings.nLang = 'en';
    BA.I18n.set(lang0);
    UI.init();
    if (UI.init2) UI.init2();
    // tautan undangan: di claude.ai pakai tautan artifact; di hosting sendiri (Vercel/GitHub) pakai alamat halaman ini; file mandiri pakai kode polos
    var loc = root.location || {};
    Net.artifactUrl = root.claude ? ARTIFACT_URL : (/^https?:/.test(loc.protocol || '') ? loc.origin + loc.pathname : '');
    Net.SB.url = SB_URL; Net.SB.key = SB_KEY;
    Input.autoSprint = !!App.settings.autoSprint;
    Input.easy = !!App.settings.easy;
    Audio.on = !!App.settings.sound;
    Audio.crowdMul = App.settings.crowd;
    var ok = R3.init(document.getElementById('game'), App.settings.quality);
    if (!ok) { UI.loading('Perangkat ini tidak mendukung WebGL untuk grafis 3D.', true); return; }
    R3.onLost = function () { UI.loading('Memulihkan grafis…', true); };
    R3.onRestored = function () { UI.loading('', false); };
    /* tata tombol stik ala PS4 (✕ oper, ○ tendang, □ lambung, △ cungkil, R2 jurus): simpanan lama dikembalikan ke bawaan baru sekali saja */
    if (App.settings.padV !== 2) { App.settings.pad = null; App.settings.padV = 2; U.store.set('settings', App.settings); }
    Input.setBindings(App.settings.keys, App.settings.pad);
    Input.rumbleOn = !!App.settings.vibrate;
    Input.deadzone = App.settings.deadzone;
    BA.Narr.setup(App.settings);
    BA.Narr.onVoices = function () { if (UI.cur === 'scrSettings') UI.openSettings(true); };
    Input.init({
      joyZone: $('joyZone'), joyBase: $('joyBase'), joyKnob: $('joyKnob'),
      shoot: $('bShoot'), pass: $('bPass'), lob: $('bLob'), long: $('bLong'), chip: $('bChip'), gocek: $('bGocek'), sw: $('bSwitch'), sprint: $('bSprint'), skip: $('cine')
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
        UI.status('guestStatus', 'bad', T('Kamera langsung tidak bisa dipakai di sini ({0}). Pakai tombol Foto QR.', (err && err.name === 'NotAllowedError') ? 'izin ditolak' : 'tidak tersedia'));
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
      var rd = !(Net.mine && Net.mine.rd);
      Net.send({ rd: rd ? 1 : 0, n: App.nick(), t: D.packTeam(App.myTeam) });
      $('btnGuestReady').textContent = rd ? T('Batal siap') : T('Saya siap');
      App.guestRefresh();
    });
    var nk = $('inNick');
    if (nk) nk.addEventListener('change', function () {
      App.setSetting('nick', U.cleanText(nk.value, 12) || '');
      nk.value = App.settings.nick;
      if (Net.role === 'guest') Net.send({ n: App.nick() }); else if (Net.role === 'host') App.hostRefresh();
    });
    root.addEventListener('resize', function () { R3.resize(); });
    root.addEventListener('orientationchange', function () { setTimeout(R3.resize, 250); setTimeout(R3.resize, 800); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) BA.Narr.stop();
      /* suara penonton & efek ikut diam saat game ditinggal; nyala lagi saat kembali */
      try { if (document.hidden && Audio.ctx && Audio.ctx.state === 'running') Audio.ctx.suspend(); else if (!document.hidden && Audio.ctx && Audio.ctx.state === 'suspended') Audio.ctx.resume(); } catch (e) { /* abaikan */ }
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
