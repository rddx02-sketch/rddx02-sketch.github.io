/* Bola Api Arena — antarmuka: menu, editor tim, setup, online, HUD, bidikan, adegan */
(function (root) {
  'use strict';
  var BA = root.BA, U = BA.U, D = BA.D;
  var UI = BA.UI = { stack: [], cur: null };
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function clear(n) { while (n && n.firstChild) n.removeChild(n.firstChild); }
  function click() { if (BA.Audio) { BA.Audio.init(); BA.Audio.click(); } }

  var SCREENS = ['scrMenu', 'scrTeam', 'scrSetup', 'scrOnline', 'scrGuide', 'scrSettings', 'scrResult', 'scrBracket', 'scrPause'];

  UI.show = function (name, push) {
    SCREENS.forEach(function (s) { var n = $(s); if (n) n.hidden = s !== name; });
    $('play').hidden = name !== 'play' && name !== 'scrPause';
    if (push !== false && UI.cur && UI.cur !== name) UI.stack.push(UI.cur);
    var prev = UI.cur;
    UI.cur = name;
    if (BA.Input && BA.Input.cap) BA.Input.cancelCapture();
    // jangan biarkan tombol menu tetap fokus saat bermain (Spasi/Enter bisa memicunya)
    if (name === 'play' && document.activeElement && document.activeElement.blur) document.activeElement.blur();
    else if (name !== prev && document.body.classList.contains('kbnav')) setTimeout(function () { if (UI.cur === name) UI.navFirst(); }, 30);
    if (BA.App && BA.App.onScreen) BA.App.onScreen(name);
  };
  UI.back = function () {
    var prev = UI.stack.pop() || 'scrMenu';
    if (BA.App && BA.App.onBack && BA.App.onBack(UI.cur, prev) === false) return;
    UI.show(prev, false);
  };
  UI.home = function () { UI.stack = []; UI.show('scrMenu', false); };

  UI.init = function () {
    document.querySelectorAll('[data-back]').forEach(function (b) { b.addEventListener('click', function () { click(); UI.back(); }); });
    document.querySelectorAll('[data-go]').forEach(function (b) {
      b.addEventListener('click', function () { click(); BA.App.menu(b.getAttribute('data-go')); });
    });
    document.querySelectorAll('#scrTeam .tab').forEach(function (b) {
      b.addEventListener('click', function () { click(); UI.teamTab(b.getAttribute('data-tab')); });
    });
    $('btnRandomLook').addEventListener('click', function () { click(); BA.App.randomLook(UI.teamSel); UI.renderTeam(); });
    $('btnStart').addEventListener('click', function () { click(); BA.App.startFromSetup(UI.setupMode, UI.setupCfg); });
    $('btnPause').addEventListener('click', function () { click(); BA.App.pause(); });
    $('btnResume').addEventListener('click', function () { click(); BA.App.resume(); });
    $('btnRestart').addEventListener('click', function () { click(); BA.App.restart(); });
    $('btnQuit').addEventListener('click', function () { click(); BA.App.quit(); });
    $('btnPauseSettings').addEventListener('click', function () { click(); UI.openSettings(); });
    UI.initFullscreen();
    UI.buildGuide();
  };

  /* ---------- layar penuh ---------- */
  var FS = UI.FS = {};
  FS.ua = function () {
    var ua = navigator.userAgent || '';
    var iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1; // iPad yang menyamar sebagai Mac
    return { ios: /iPhone|iPod/.test(ua), ipad: /iPad/.test(ua) || iPadOS, android: /Android/.test(ua), mobile: /Mobi|Android/i.test(ua) || iPadOS,
      standalone: !!(navigator.standalone || (root.matchMedia && root.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches)),
      framed: (function () { try { return root.self !== root.top; } catch (e) { return true; } })() };
  };
  FS.api = function () {
    var d = document, el = d.documentElement;
    var req = el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    var exit = d.exitFullscreen || d.webkitExitFullscreen || d.webkitCancelFullScreen || d.mozCancelFullScreen || d.msExitFullscreen;
    var enabled = d.fullscreenEnabled; if (enabled === undefined) enabled = d.webkitFullscreenEnabled; if (enabled === undefined) enabled = d.mozFullScreenEnabled; if (enabled === undefined) enabled = d.msFullscreenEnabled;
    return { req: req, exit: exit, enabled: enabled !== false && !!req };
  };
  UI.fsSupported = function () { return FS.api().enabled; };
  UI.isFullscreen = function () {
    var d = document;
    return !!(d.fullscreenElement || d.webkitFullscreenElement || d.webkitCurrentFullScreenElement || d.mozFullScreenElement || d.msFullscreenElement);
  };
  /* minta layar penuh; janji selesai true bila berhasil */
  FS.request = function () {
    var d = document, el = d.documentElement, api = FS.api(), u = FS.ua();
    return new Promise(function (resolve) {
      if (!api.enabled) { resolve(false); return; }
      var done = false, finish = function (ok) { if (done) return; done = true; resolve(ok); };
      var onChange = function () { d.removeEventListener('fullscreenchange', onChange); d.removeEventListener('webkitfullscreenchange', onChange); finish(UI.isFullscreen()); };
      d.addEventListener('fullscreenchange', onChange); d.addEventListener('webkitfullscreenchange', onChange);
      // coba beberapa elemen: dokumen → body → kanvas (Safari iPhone kadang hanya mengizinkan elemen tertentu)
      var targets = [el, d.body, d.getElementById('game')].filter(Boolean), ti = 0;
      function tryEl() {
        if (done) return;
        if (ti >= targets.length) { finish(false); return; }
        var t = targets[ti++], p = null;
        var fn = t.requestFullscreen || t.webkitRequestFullscreen || t.webkitRequestFullScreen || t.mozRequestFullScreen || t.msRequestFullscreen;
        if (!fn) { tryEl(); return; }
        try { p = t.requestFullscreen ? t.requestFullscreen({ navigationUI: 'hide' }) : fn.call(t); } catch (e) { tryEl(); return; }
        if (p && p.then) p.then(function () { setTimeout(function () { if (UI.isFullscreen()) finish(true); else tryEl(); }, 80); }, function () { tryEl(); });
        else setTimeout(function () { if (UI.isFullscreen()) finish(true); else tryEl(); }, 400);
      }
      tryEl();
      setTimeout(function () { finish(UI.isFullscreen()); }, 3000);
    }).then(function (ok) {
      // HP/tablet: kunci lanskap bila diizinkan (hanya berhasil saat layar penuh)
      if (ok && u.mobile && screen.orientation && screen.orientation.lock) {
        try { var r = screen.orientation.lock('landscape'); if (r && r.catch) r.catch(function () { /* abaikan */ }); } catch (e) { /* abaikan */ }
      }
      return ok;
    });
  };
  FS.exit = function () {
    var d = document, api = FS.api();
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { /* abaikan */ }
    try { var p = api.exit && api.exit.call(d); if (p && p.catch) p.catch(function () { /* abaikan */ }); } catch (e2) { /* abaikan */ }
  };
  UI.toggleFullscreen = function () {
    if (UI.isFullscreen()) { FS.exit(); setTimeout(UI.syncFullscreen, 150); return; }
    var u = FS.ua();
    if (u.standalone) { UI.toast('Sudah tampil layar penuh (mode aplikasi)'); return; }
    if (!UI.fsSupported()) { UI.fsHelp(); return; }
    FS.request().then(function (ok) { if (!ok) UI.fsHelp(true); UI.syncFullscreen(); });
  };
  /* otomatis saat mulai main di HP/tablet (dipanggil dari gerakan sentuh/klik pengguna) */
  UI.autoFullscreen = function () {
    var S = BA.App && BA.App.settings;
    if (!S || !S.autoFs) return;
    if (UI.isFullscreen() || !UI.fsSupported()) return;
    var dev = BA.Input && BA.Input.device, u = FS.ua();
    if (dev !== 'touch' && !u.mobile) return;
    FS.request().then(function () { UI.syncFullscreen(); });
  };
  /* penjelasan bila layar penuh tidak bisa dari sini */
  UI.fsHelp = function (failed) {
    var u = FS.ua(), lines = [], btns = [];
    var selfUrl = (function () { try { return String(location.href); } catch (e) { return ''; } })();
    if (u.ios || u.ipad) {
      var iosV = (function () { var m = (navigator.userAgent || '').match(/OS (\d+)[._](\d+)/); return m ? parseFloat(m[1] + '.' + m[2]) : 0; })();
      if (iosV && iosV < 16.4) lines.push('iPhone dengan iOS ' + iosV + ' belum mendukung layar penuh untuk halaman web (butuh iOS 16.4 ke atas).');
      else lines.push(failed ? 'Safari menolak permintaan layar penuh di jendela ini.' : 'Safari di iPhone hanya mengizinkan layar penuh bila halaman dibuka langsung, bukan di dalam jendela lain.');
      lines.push('Cara paling pasti: ketuk "Buka di tab sendiri", lalu di Safari tekan tombol ⛶ lagi. Atau tekan Bagikan (kotak dengan panah) → "Tambah ke Layar Utama", lalu buka game dari ikon itu: tampil penuh tanpa bilah alamat. Putar HP ke posisi lanskap agar bilah Safari ikut menyusut.');
    } else if (u.framed) {
      lines.push(failed ? 'Layar penuh ditolak di jendela ini.' : 'Layar penuh tidak diizinkan di dalam jendela ini.');
      lines.push('Buka game di tab sendiri, lalu tekan tombol layar penuh lagi' + (u.android ? '. Di Android, menu browser → "Tambahkan ke layar utama" juga membuat game tampil penuh.' : ' (atau F11 di PC).'));
    } else {
      lines.push(failed ? 'Browser menolak permintaan layar penuh. Coba lagi lewat tombol, atau tekan F11 di PC.' : 'Browser ini tidak mendukung layar penuh dari halaman web. Tekan F11 di PC, atau pakai menu browser "Tambahkan ke layar utama" di HP.');
    }
    if (selfUrl && /^https?:/.test(selfUrl) && (u.framed || u.ios || u.ipad)) {
      btns.push({ label: 'Buka di tab sendiri', main: true, fn: function () {
        var a = document.createElement('a'); a.href = selfUrl; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
      } });
    }
    btns.push({ label: 'Tutup' });
    UI.confirm('Layar penuh', lines.join(' '), btns);
  };
  UI.syncFullscreen = function () {
    var b = $('btnFs'); if (!b) return;
    var on = UI.isFullscreen();
    document.body.classList.toggle('fsOn', on);
    b.classList.toggle('on', on);
    b.innerHTML = on
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
    b.setAttribute('aria-label', on ? 'Keluar layar penuh' : 'Layar penuh');
    b.title = on ? 'Keluar layar penuh' : 'Layar penuh (F11)';
    if (BA.R3 && BA.R3.resize) setTimeout(BA.R3.resize, 60);
  };
  UI.initFullscreen = function () {
    var b = $('btnFs'); if (!b) return;
    var u = FS.ua();
    // dalam mode aplikasi layar utama sudah penuh: tombol tak perlu
    b.hidden = u.standalone;
    b.addEventListener('click', function () { click(); UI.toggleFullscreen(); });
    ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(function (ev) { document.addEventListener(ev, UI.syncFullscreen); });
    ['fullscreenerror', 'webkitfullscreenerror'].forEach(function (ev) { document.addEventListener(ev, function () { UI.syncFullscreen(); }); });
    // otomatis masuk layar penuh saat pemain menekan tombol mulai/lanjut (harus dari gerakan pengguna)
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('#btnStart, #btnHostStart, #btnGuestReady, #bracketActions .btn.main, #btnResume, #btnRestart, [data-go="quick"], [data-go="tour"], [data-go="pen"], [data-go="practice"], [data-go="online"]') : null;
      if (t) UI.autoFullscreen();
    }, true);
    if (root.visualViewport) root.visualViewport.addEventListener('resize', function () { if (BA.R3 && BA.R3.resize) BA.R3.resize(); });
    UI.syncFullscreen();
  };

  /* ---------- pembuat kontrol ---------- */
  function chips(box, items, cur, pick, opt) {
    clear(box);
    opt = opt || {};
    items.forEach(function (it) {
      var b = el('button', 'chip' + (String(it.id) === String(cur) ? ' on' : ''));
      if (it.dot) { var d = el('i', 'dot'); d.style.background = it.dot; b.appendChild(d); }
      b.appendChild(document.createTextNode(it.n));
      b.type = 'button';
      if (opt.disabled) b.disabled = true;
      b.addEventListener('click', function () { click(); pick(it.id); });
      box.appendChild(b);
    });
  }
  function cardList(box, items, cur, pick) {
    clear(box);
    items.forEach(function (it) {
      var b = el('button', 'card' + (String(it.id) === String(cur) ? ' on' : ''));
      b.type = 'button';
      b.appendChild(el('b', null, it.n));
      if (it.d) b.appendChild(el('span', null, it.d));
      if (it.extra) b.appendChild(it.extra);
      b.addEventListener('click', function () { click(); pick(it.id); });
      box.appendChild(b);
    });
  }
  function swatches(box, colors, cur, pick) {
    clear(box);
    colors.forEach(function (c) {
      var b = el('button', 'sw' + (c === cur ? ' on' : ''));
      b.type = 'button'; b.style.background = c; b.setAttribute('aria-label', 'Warna ' + c);
      b.addEventListener('click', function () { click(); pick(c); });
      box.appendChild(b);
    });
  }
  function sect(parent, title, hint) {
    var s = el('div', 'sect');
    if (title) s.appendChild(el('h3', null, title));
    parent.appendChild(s);
    if (hint) { var h = el('p', 'hint', hint); s._hint = h; }
    return s;
  }
  function toggle(parent, label, on, set) {
    var row = el('div', 'toggle');
    row.appendChild(el('span', null, label));
    var b = el('button', on ? 'on' : '');
    b.type = 'button'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.setAttribute('aria-label', label);
    b.addEventListener('click', function () { click(); var v = !b.classList.contains('on'); b.classList.toggle('on', v); b.setAttribute('aria-pressed', v ? 'true' : 'false'); set(v); });
    row.appendChild(b);
    parent.appendChild(row);
    return b;
  }
  function zoneGrid(style) {
    var g = el('div', 'zgrid');
    D.ZONES.forEach(function (z) {
      var sk = style && style.map[z.id];
      var i = el('i', sk ? 'sp' : '', sk ? D.SKILLS[sk].name : 'biasa');
      g.appendChild(i);
    });
    return g;
  }
  UI.zoneGrid = zoneGrid;

  /* ---------- menu ---------- */
  UI.renderRecords = function (r) {
    var box = $('records'); clear(box);
    if (!r || !(r.played > 0)) { box.appendChild(el('span', null, 'Belum ada pertandingan. Ayo turun ke lapangan!')); return; }
    var add = function (lbl, v) { var s = el('span'); s.appendChild(document.createTextNode(lbl + ' ')); s.appendChild(el('b', null, String(v))); box.appendChild(s); };
    add('Main', r.played); add('Menang', r.wins); add('Gol', r.goals); add('Piala', r.cups || 0);
    if (r.best) add('Tendangan terkeras', r.best);
  };

  /* ---------- editor tim ---------- */
  UI.teamSel = 4;
  UI.openTeam = function () {
    UI.show('scrTeam');
    UI.teamTab(UI.teamTabCur || 'tim');
    UI.renderTeam();
  };
  UI.teamTab = function (t) {
    UI.teamTabCur = t;
    document.querySelectorAll('#scrTeam .tab').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === t); });
    $('teamTabTim').classList.toggle('hidden', t !== 'tim');
    $('teamTabPemain').classList.toggle('hidden', t !== 'pemain');
    UI.renderTeam();
  };
  UI.renderTeam = function () {
    var T = BA.App.myTeam, save = function () { BA.App.saveTeam(); UI.renderTeam(); };
    var nm = $('inTeamName'), sh = $('inTeamShort');
    if (document.activeElement !== nm) nm.value = T.name;
    if (document.activeElement !== sh) sh.value = T.short;
    if (!nm._bound) {
      nm._bound = true;
      nm.addEventListener('input', function () { BA.App.myTeam.name = U.cleanText(nm.value, 20) || 'Tim Kampung'; BA.App.saveTeam(true); });
      sh.addEventListener('input', function () { BA.App.myTeam.short = (U.cleanText(sh.value, 3) || 'TIM').toUpperCase(); BA.App.saveTeam(true); });
    }
    swatches($('swC1'), D.TEAM_COLORS, T.c1, function (c) { T.c1 = c; save(); });
    swatches($('swC2'), D.TEAM_COLORS, T.c2, function (c) { T.c2 = c; save(); });
    swatches($('swGK'), D.TEAM_COLORS, T.gk, function (c) { T.gk = c; save(); });
    chips($('chKind'), D.KINDS.map(function (k) { return { id: k.id, n: k.n }; }), T.kind || 'manusia', function (v) { T.kind = v; save(); UI.toast('Tim jadi ' + (D.kindById[v] || D.KINDS[0]).n); });
    var kd = D.kindById[T.kind || 'manusia'] || D.KINDS[0];
    $('kindHint').textContent = kd.desc + (kd.variants.length ? ' Wujud tiap pemain dipilih di tab Pemain.' : '');
    $('sectPpe').hidden = kd.id !== 'migas';
    if (kd.id === 'migas') chips($('chPpe'), D.PPE.map(function (q) { return { id: q.id, n: q.n }; }), T.ppe || 'helm', function (v) { T.ppe = v; save(); });
    var plainOutfit = kd.id === 'manusia' || kd.id === 'siluman' || kd.id === 'mamalia';
    chips($('chOutfit'), D.OUTFITS, T.outfit, function (v) { T.outfit = v; save(); }, { disabled: !plainOutfit });
    chips($('chPattern'), D.PATTERNS, T.pattern, function (v) { T.pattern = v; save(); }, { disabled: T.outfit !== 'jersey' || !plainOutfit });
    chips($('chBottom'), D.BOTTOMS, T.bottom, function (v) { T.bottom = v; save(); });
    chips($('chTactic'), D.TACTICS, T.tactic, function (v) { T.tactic = v; save(); });
    var tac = D.TACTICS.filter(function (t) { return t.id === T.tactic; })[0];
    $('tacticHint').textContent = tac ? tac.desc : '';
    // daftar pemain
    var ro = $('roster'); clear(ro);
    T.players.forEach(function (p, i) {
      D.SQUAD_GROUPS.forEach(function (g) { if (g.from === i) ro.appendChild(el('div', 'rgroup', g.n)); });
      var b = el('button', 'pcard' + (i === UI.teamSel ? ' on' : ''));
      b.type = 'button';
      b.appendChild(el('span', 'num', String(p.num)));
      var mid = el('div'); mid.style.minWidth = '0';
      mid.appendChild(el('div', 'nm', p.name));
      mid.appendChild(el('div', 'sub', p.role === 'GK' ? (D.styleById[p.style] || D.STYLES[0]).name : (D.shotById[p.shot] || D.SHOTS[0]).name));
      b.appendChild(mid);
      b.appendChild(el('span', 'role', (D.ROLES.filter(function (r) { return r.id === p.role; })[0] || D.ROLES[1]).n));
      b.addEventListener('click', function () { click(); UI.teamSel = i; UI.renderTeam(); });
      ro.appendChild(b);
    });
    UI.renderPlayerEdit();
    var p = T.players[UI.teamSel];
    $('pvName').textContent = p.name + ' · ' + p.num;
    $('pvSub').textContent = p.role === 'GK' ? (D.styleById[p.style] || D.STYLES[0]).name : (D.shotById[p.shot] || D.SHOTS[0]).name;
    BA.App.previewPlayer(UI.teamSel);
  };

  UI.renderPlayerEdit = function () {
    var box = $('pEdit'); clear(box);
    var T = BA.App.myTeam, i = UI.teamSel, p = T.players[i];
    var save = function () { BA.App.saveTeam(); UI.renderTeam(); };
    var s1 = sect(box, 'Identitas');
    var r = el('div', 'row2');
    var f1 = el('div', 'field'); f1.appendChild(el('label', null, 'Nama pemain')); var inN = el('input'); inN.type = 'text'; inN.id = 'inPName'; inN.maxLength = 12; inN.value = p.name; inN.autocomplete = 'off'; f1.appendChild(inN); f1.querySelector('label').htmlFor = 'inPName';
    var f2 = el('div', 'field'); f2.appendChild(el('label', null, 'Nomor')); var inNum = el('input'); inNum.type = 'number'; inNum.id = 'inPNum'; inNum.min = 0; inNum.max = 99; inNum.value = p.num; f2.appendChild(inNum); f2.querySelector('label').htmlFor = 'inPNum';
    r.appendChild(f1); r.appendChild(f2); s1.appendChild(r);
    inN.addEventListener('input', function () { p.name = U.cleanText(inN.value, 12) || 'Warga'; BA.App.saveTeam(true); $('pvName').textContent = p.name + ' · ' + p.num; });
    inN.addEventListener('change', function () { UI.renderTeam(); });
    inNum.addEventListener('change', function () { p.num = U.clamp(Math.round(U.num(Number(inNum.value), p.num)), 0, 99); save(); });
    if (i > 0) {
      var s2 = sect(box, 'Posisi'); var c2 = el('div', 'chips'); s2.appendChild(c2);
      chips(c2, D.ROLES.filter(function (x) { return x.id !== 'GK'; }), p.role, function (v) { p.role = v; save(); });
      var s3 = sect(box, 'Tipe tendangan'); s3.appendChild(el('p', 'hint', 'Api di bola berubah wujud sesuai tipe ini saat menendang ke gawang.'));
      var c3 = el('div', 'cards'); s3.appendChild(c3);
      cardList(c3, D.SHOTS.map(function (s) { return { id: s.id, n: s.name, d: s.desc }; }), p.shot, function (v) { p.shot = v; save(); });
    } else {
      var s4 = sect(box, 'Perguruan silat kiper');
      s4.appendChild(el('p', 'hint', 'Tiap perguruan punya 5 jurus untuk 5 arah gawang. Arah lain hanya tangkapan biasa.'));
      var c4 = el('div', 'cards'); s4.appendChild(c4);
      cardList(c4, D.STYLES.map(function (s) {
        var ex = el('div', 'styleRow'); ex.appendChild(zoneGrid(s));
        return { id: s.id, n: s.name, d: s.desc, extra: ex };
      }), p.style, function (v) { p.style = v; save(); });
    }
    var kdef = D.kindById[T.kind || 'manusia'] || D.KINDS[0];
    if (kdef.variants.length) {
      var sv = sect(box, 'Wujud ' + kdef.n.toLowerCase()); var cv = el('div', 'chips'); sv.appendChild(cv);
      chips(cv, kdef.variants.map(function (v) { return { id: v.id, n: v.n }; }), D.variantOf(T, p, i), function (v) { p.variant = v; save(); });
    }
    var s5 = sect(box, 'Alas kaki'); var c5 = el('div', 'chips'); s5.appendChild(c5);
    chips(c5, D.FEET, p.foot, function (v) { p.foot = v; save(); });
    var ft = D.FEET.filter(function (f) { return f.id === p.foot; })[0];
    s5.appendChild(el('p', 'hint', ft ? ft.desc : ''));
    var s6 = sect(box, 'Warna kulit'); var c6 = el('div', 'swatches'); s6.appendChild(c6);
    swatches(c6, D.SKINS, D.SKINS[p.skin], function (c) { p.skin = D.SKINS.indexOf(c); save(); });
    var s7 = sect(box, 'Rambut'); var c7 = el('div', 'chips'); s7.appendChild(c7);
    chips(c7, D.HAIRS, p.hair, function (v) { p.hair = v; save(); });
    var c7b = el('div', 'swatches'); s7.appendChild(c7b);
    swatches(c7b, D.HAIR_COLORS.map(function (h) { return h.c; }), (D.HAIR_COLORS[p.hairC] || D.HAIR_COLORS[0]).c, function (c) { p.hairC = D.HAIR_COLORS.map(function (h) { return h.c; }).indexOf(c); save(); });
    var s7f = sect(box, 'Wajah'); var c7f = el('div', 'chips'); s7f.appendChild(c7f);
    chips(c7f, D.FACES, p.face || 'polos', function (v) { p.face = v; save(); });
    var s8 = sect(box, 'Tutup kepala'); var c8 = el('div', 'chips'); s8.appendChild(c8);
    chips(c8, D.HEADS, p.head, function (v) { p.head = v; save(); });
    var s9 = sect(box, 'Badan & tinggi'); var c9 = el('div', 'chips'); s9.appendChild(c9);
    chips(c9, D.BODIES, p.body, function (v) { p.body = v; save(); });
    var c9b = el('div', 'chips'); s9.appendChild(c9b);
    chips(c9b, D.HEIGHTS, p.height, function (v) { p.height = v; save(); });
    // statistik
    var st = D.playerStats(p, T.level);
    var s10 = sect(box, 'Kemampuan'); var grid = el('div', 'stats'); s10.appendChild(grid);
    var rows = p.role === 'GK' ? [['Refleks', st.refleks], ['Tenaga', st.tenaga], ['Lari', st.lari]] : [['Tendang', st.tendang], ['Lari', st.lari], ['Gocek', st.gocek], ['Tekel', st.tekel], ['Stamina', st.stamina]];
    rows.forEach(function (rw) {
      grid.appendChild(el('span', null, rw[0]));
      var b = el('div', 'bar'), ii = el('i'); ii.style.width = rw[1] + '%'; b.appendChild(ii); grid.appendChild(b);
      grid.appendChild(el('b', null, String(rw[1])));
    });
  };

  /* ---------- setup pertandingan ---------- */
  var MODE_TITLE = { quick: 'Tanding Cepat', tour: 'Turnamen Tarkam', pen: 'Adu Penalti Api', practice: 'Latihan Tendangan', host: 'Aturan Main Online' };
  UI.openSetup = function (mode, cfg) {
    UI.setupMode = mode; UI.setupCfg = cfg;
    $('setupTitle').textContent = MODE_TITLE[mode] || 'Atur Pertandingan';
    $('btnStart').textContent = mode === 'host' ? 'Simpan aturan' : (mode === 'tour' ? 'Mulai Turnamen' : (mode === 'practice' ? 'Mulai Latihan' : 'Mulai Tanding'));
    UI.renderSetup();
    UI.show('scrSetup');
  };
  UI.renderSetup = function () {
    var box = $('setupBody'); clear(box);
    var mode = UI.setupMode, cfg = UI.setupCfg, R = cfg.rules;
    var re = function () { BA.App.saveSetup(cfg); UI.renderSetup(); };
    if (!D.fieldById[cfg.field]) cfg.field = 'kampung';
    var sf = sect(box, 'Ukuran lapangan'); var cf = el('div', 'cards'); sf.appendChild(cf);
    cardList(cf, D.FIELDS.map(function (f) { return { id: f.id, n: f.name + ' · ' + f.short, d: f.desc }; }), cfg.field, function (v) {
      cfg.field = v;
      var nMax = D.squadOf(v) - 1;
      if (cfg.practiceShooter > nMax) cfg.practiceShooter = Math.min(4, nMax);
      re();
    });
    if (mode === 'quick' || mode === 'pen') {
      var s0 = sect(box, 'Lawan'); var c0 = el('div', 'chips'); s0.appendChild(c0);
      var opts = D.TEAMS.map(function (t, i) { var kn = t.kind && t.kind !== 'manusia' ? ' · ' + (D.kindById[t.kind] || {}).n : ''; return { id: i, n: t.name + kn + ' ' + '★'.repeat(t.level + 1), dot: t.c1 }; });
      opts.push({ id: -1, n: 'Acak' });
      chips(c0, opts, cfg.opp, function (v) { cfg.opp = v; re(); });
    }
    if (mode === 'practice') {
      var sp = sect(box, 'Penendang'); var cp = el('div', 'chips'); sp.appendChild(cp);
      chips(cp, BA.App.myTeam.players.slice(1, D.squadOf(cfg.field)).map(function (p, i) { return { id: i + 1, n: p.name + ' · ' + (D.shotById[p.shot] || D.SHOTS[0]).name }; }), cfg.practiceShooter, function (v) { cfg.practiceShooter = v; re(); });
      var sk = sect(box, 'Kiper lawan (perguruan)'); var ck = el('div', 'cards'); sk.appendChild(ck);
      cardList(ck, D.STYLES.map(function (s) { var ex = el('div', 'styleRow'); ex.appendChild(zoneGrid(s)); return { id: s.id, n: s.name, d: s.desc, extra: ex }; }), cfg.practiceStyle, function (v) { cfg.practiceStyle = v; re(); });
    }
    var s1 = sect(box, 'Arena'); var c1 = el('div', 'cards'); s1.appendChild(c1);
    cardList(c1, D.ARENAS.map(function (a) { return { id: a.id, n: a.name, d: a.desc }; }), cfg.arena, function (v) { cfg.arena = v; re(); });
    var s2 = sect(box, 'Cuaca'); var c2 = el('div', 'chips'); s2.appendChild(c2);
    var wl = D.WEATHERS.map(function (w) { return { id: w.id, n: w.name }; }); wl.push({ id: 'acak', n: 'Acak' });
    chips(c2, wl, cfg.weather, function (v) { cfg.weather = v; re(); });
    var wd = D.weatherById[cfg.weather];
    s2.appendChild(el('p', 'hint', wd ? wd.desc : 'Cuaca dipilih acak saat pertandingan dimulai.'));
    var s3 = sect(box, 'Jenis bola'); var c3 = el('div', 'chips'); s3.appendChild(c3);
    chips(c3, D.BALLS.map(function (b) { return { id: b.id, n: b.name, dot: b.fire[0] }; }), cfg.ball, function (v) { cfg.ball = v; re(); });
    var bd = D.ballById[cfg.ball];
    s3.appendChild(el('p', 'hint', bd ? bd.desc : ''));
    if (mode === 'quick' || mode === 'tour' || mode === 'host') {
      var s4 = sect(box, 'Lama pertandingan'); var c4 = el('div', 'chips'); s4.appendChild(c4);
      chips(c4, D.DURATIONS.map(function (d) { return { id: d.v, n: d.n }; }), R.dur, function (v) { R.dur = Number(v); re(); });
      if (mode !== 'tour') {
        var s5 = sect(box, 'Jika skor sama'); var c5 = el('div', 'chips'); s5.appendChild(c5);
        chips(c5, D.TIES, R.tie, function (v) { R.tie = v; re(); });
      }
      var sR = sect(box, 'Aturan main'); var cR = el('div', 'chips'); sR.appendChild(cR);
      chips(cR, D.RULESETS.map(function (x) { return { id: x.id, n: x.n }; }), R.pro ? 'pro' : 'tarkam', function (v) { R.pro = v === 'pro'; D.applyRuleset(R); if (R.pro && cfg.field === 'kampung') { cfg.field = 'asli'; cfg.arena = 'stadion'; } re(); });
      var rsd = D.RULESETS.filter(function (x) { return x.id === (R.pro ? 'pro' : 'tarkam'); })[0];
      sR.appendChild(el('p', 'hint', rsd ? rsd.desc : ''));
      if (!R.pro) {
        var s6 = sect(box, 'Batas lapangan'); var c6 = el('div', 'chips'); s6.appendChild(c6);
        chips(c6, D.BOUNDS, R.bound, function (v) { R.bound = v; re(); });
        var bnd = D.BOUNDS.filter(function (b) { return b.id === R.bound; })[0];
        s6.appendChild(el('p', 'hint', bnd ? bnd.desc : ''));
        var s7 = sect(box, 'Aturan kampung');
        toggle(s7, '3 kali sepak pojok = penalti', !!R.tigaPojok, function (v) { R.tigaPojok = v; BA.App.saveSetup(cfg); });
        s7.appendChild(el('p', 'hint', 'Berlaku saat batas lapangan "Bola Keluar". Bola yang ditepis keluar kiper jadi sepak pojok.'));
        toggle(s7, 'Bola panas: pegang bola > 6 detik, bola lepas', !!R.bolaPanas, function (v) { R.bolaPanas = v; BA.App.saveSetup(cfg); });
      }
    }
    if (mode !== 'host') {
      var s8 = sect(box, 'Kesulitan NPC'); var c8 = el('div', 'chips'); s8.appendChild(c8);
      chips(c8, D.DIFFS, R.diff, function (v) { R.diff = Number(v); re(); });
    }
  };

  /* ---------- online ---------- */
  UI.onlineMode = function (m, lan) {
    document.querySelectorAll('[data-onl]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-onl') === (lan ? 'lan' : m)); });
    $('onHost').classList.toggle('hidden', m !== 'host');
    $('onGuest').classList.toggle('hidden', m !== 'guest');
    var ol = $('onLan'); if (ol) ol.hidden = m !== 'lan';
    var hq = $('hostQrSect'), gs = $('guestScanSect');
    if (hq) hq.classList.toggle('hidden', !!lan); if (gs) gs.classList.toggle('hidden', !!lan);
  };
  UI.lanRole = function (r) {
    document.querySelectorAll('[data-lan]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-lan') === r); });
    $('lanHost').hidden = r !== 'host'; $('lanGuest').hidden = r !== 'guest';
  };
  UI.status = function (id, cls, text) {
    var s = $(id); if (!s) return;
    s.className = 'status ' + (cls || '');
    s.querySelector('span').textContent = text;
  };
  UI.vsBox = function (id, a, b) {
    var box = $(id); clear(box); box.classList.remove('hidden');
    var vs = el('div', 'vs');
    [a, null, b].forEach(function (t) {
      if (!t) { vs.appendChild(el('div', 'x', 'VS')); return; }
      var d = el('div', 't'); var c = el('div', 'crest'); c.style.background = 'linear-gradient(135deg,' + t.c1 + ' 50%,' + t.c2 + ' 50%)';
      d.appendChild(c); d.appendChild(el('b', null, t.name)); vs.appendChild(d);
    });
    box.appendChild(vs);
  };
  UI.cfgSummary = function (cfg) {
    var a = D.arenaById[cfg.arena], w = D.weatherById[cfg.weather], b = D.ballById[cfg.ball], R = cfg.rules, fd = D.fieldById[cfg.field] || D.FIELDS[0];
    var parts = [fd.name + ' ' + fd.short, (a ? a.name : '-'), (w ? w.name : 'Cuaca acak'), (b ? b.name : '-'), D.DURATIONS.filter(function (d) { return d.v === R.dur; }).map(function (d) { return d.n; })[0] || '',
      (D.TIES.filter(function (t) { return t.id === R.tie; })[0] || {}).n || '', (D.BOUNDS.filter(function (t) { return t.id === R.bound; })[0] || {}).n || ''];
    if (R.pro) parts.push('Liga Pro (offside, tendangan bebas, kartu)');
    if (R.tigaPojok && R.bound === 'keluar' && !R.pro) parts.push('3 pojok = penalti');
    if (R.bolaPanas && !R.pro) parts.push('Bola panas');
    return parts.filter(Boolean).join(' · ');
  };

  /* ---------- panduan ---------- */
  UI.buildGuide = function () {
    var box = $('guideBody'); clear(box);
    function para(s, html) { var p = el('p'); html.forEach(function (h) { if (typeof h === 'string') p.appendChild(document.createTextNode(h)); else p.appendChild(el('b', null, h.b)); }); s.appendChild(p); }
    var In = BA.Input;
    var s1 = sect(box, 'Kontrol layar sentuh');
    var k = el('div', 'keys');
    [['Joystick kiri', 'Lari. Dorong penuh untuk sprint otomatis.'], ['SPRINT', 'Tahan untuk lari kencang (stamina berkurang).'], ['TENDANG', 'Tahan untuk mengisi tenaga, lepas untuk menendang. Saat membidik, joystick memilih arah gawang.'], ['OPER', 'Umpan ke kawan di arah joystick. Saat kiper memegang bola: lempar.'], ['GOCEK / REBUT', 'Saat pegang bola: gocek mengecoh lawan. Tanpa bola: ketuk = tekel sapuan; TAHAN LAMA = pemain aktif otomatis mengejar bola sambil sprint dan merebut saat dekat.'], ['GANTI', 'Pindah ke pemain terdekat dengan bola.']].forEach(function (r) {
      k.appendChild(el('kbd', null, r[0])); k.appendChild(el('span', null, r[1]));
    });
    s1.appendChild(k);
    var kn = function (a) { return In.keys[a].filter(Boolean).map(In.keyName).join(' / ') || '—'; };
    var pn = function (a) { return In.pad[a].filter(function (b) { return b >= 0; }).map(function (b) { return In.padName(b); }).join(' / ') || '—'; };
    var sK = sect(box, 'Keyboard & stik PS');
    var tbl = el('div', 'keys keys3');
    tbl.appendChild(el('b', null, 'Aksi')); tbl.appendChild(el('b', null, 'Keyboard')); tbl.appendChild(el('b', null, 'Stik PS'));
    [['Gerak', kn('up') + ' ' + kn('left') + ' ' + kn('down') + ' ' + kn('right'), 'Analog kiri / D-pad']].concat(In.ACTIONS.filter(function (a) { return ['up', 'down', 'left', 'right'].indexOf(a.id) < 0; }).map(function (a) { return [a.n, kn(a.id), pn(a.id)]; })).forEach(function (r) {
      tbl.appendChild(el('span', null, r[0])); tbl.appendChild(el('kbd', null, r[1])); tbl.appendChild(el('kbd', null, r[2]));
    });
    sK.appendChild(tbl);
    sK.appendChild(el('p', 'hint', 'Semua tombol bisa diubah di Pengaturan. Stik Xbox juga bisa: ✕=A, ○=B, □=X, △=Y, L1/R1=LB/RB.'));
    var sN = sect(box, 'Narator & lapangan');
    para(sN, ['Komentator pertandingan bisa berbahasa ', { b: 'Indonesia' }, ' atau ', { b: 'English' }, ', lengkap dengan suara dan teks. Ada enam narator berlogat: ', { b: 'Koh Ahong' }, ' (Cina), ', { b: 'Mas Bejo' }, ' (Jawa), ', { b: 'Bang Togar' }, ' (Batak), ', { b: 'Kang Asep' }, ' (Sunda), ', { b: 'Encik Zul' }, ' (Melayu), dan ', { b: 'Mbak Rere' }, ' (wanita, Jakarta). Logat mengubah kata & sisipan khas di komentar dan suara. Atur di Pengaturan → Narator.']);
    var sW = sect(box, 'Main berdua lewat WiFi / hotspot (tanpa internet)');
    para(sW, ['Di ', { b: 'Main Online → 📶 WiFi lokal' }, ': kedua HP di WiFi yang sama (atau satu HP menyalakan hotspot). Tuan rumah menekan ', { b: 'Buat kode undangan' }, ' lalu mengirim kodenya (QR, Bagikan ke WhatsApp/Bluetooth, atau salin). Tamu menempel/memindai kode itu, menekan ', { b: 'Buat kode balasan' }, ', dan mengirim balik. Tuan rumah menempel balasan → ', { b: 'Sambungkan' }, '. Setelah itu lobi, Saya siap, dan pertandingan berjalan langsung antar HP tanpa server. Mode ini juga bekerja di file game mandiri (HTML) di luar claude.ai. Bluetooth sendiri tidak bisa dipakai browser untuk bermain, hanya untuk mengirim kodenya.']);
    var sP = sect(box, 'Mode Liga Pro');
    para(sP, ['Di pengaturan laga pilih ', { b: 'Aturan main → Liga Pro' }, ': lapangan Ukuran Asli 11 vs 11 di ', { b: 'Stadion Kabupaten' }, ' dengan aturan sepak bola resmi — ', { b: 'offside' }, ' (umpan ke kawan yang berdiri di depan bek terakhir), ', { b: 'pelanggaran = tendangan bebas' }, ' (lawan mundur 9,15 m), ', { b: 'pelanggaran di kotak = penalti' }, ', ', { b: 'kartu kuning & merah' }, ' (dua kuning = diusir, tim main dengan sepuluh orang), lemparan ke dalam, sepak pojok, dan tendangan gawang. Aturan kampung (3 pojok = penalti, bola panas) otomatis mati.']);
    var sJ = sect(box, 'Jenis tim');
    para(sJ, ['Di ', { b: 'Tim Saya' }, ' kamu bisa memilih jenis anggota tim: ', { b: 'Warga Kampung' }, ', ', { b: 'Siluman' }, ' (genderuwo, buto ijo, siluman ular, babi, tuyul), ', { b: 'Hantu' }, ' (kuntilanak, pocong, sundel bolong, wewe, jin), ', { b: 'Binatang Mamalia' }, ', ', { b: 'Robot Mekanik' }, ', ', { b: 'Pekerja Migas' }, ' bercoverall dengan pilihan helm/kacamata safety, dan ', { b: 'Orang Partai' }, '. Tiap jenis punya suara khas saat menendang, menekel, dan mencetak gol. Lawan NPC baru: Siluman Alas Roban, Hantu Rumah Kosong, Satwa Rimba Raya, Robot Pabrik Baja, Rig Lepas Pantai, dan Partai Bola Rakyat.']);
    para(sN, ['Pilih ukuran lapangan sebelum bertanding: ', { b: 'Kampung 5 vs 5' }, ', ', { b: 'Desa 7 vs 7' }, ', atau ', { b: 'Ukuran Asli 11 vs 11' }, ' (105×68 m). Di lapangan besar muncul peta mini di kiri atas.']);
    var s2 = sect(box, 'Kekuatan tendangan');
    para(s2, ['Menang kalah ditentukan ', { b: 'kerasnya tendangan striker' }, ' melawan tenaga jurus kiper. Isi meter sampai zona hijau ', { b: 'PAS!' }, ' (85–100%) untuk bonus tenaga. Lewat 100% bola bisa melambung.']);
    para(s2, ['Jarak ideal 8–12 meter. Terlalu dekat kiper menutup sudut, terlalu jauh kiper sempat bereaksi. Lawan yang menempel saat kamu menendang mengurangi tenaga.']);
    para(s2, ['Tendangan langsung setelah menerima umpan memberi bonus ', { b: 'Kombinasi' }, ' +10%.']);
    var s3 = sect(box, 'Jurus silat kiper');
    para(s3, ['Kiper lawan otomatis memakai ilmu silat. Tiap kiper punya ', { b: '5 jurus untuk 5 arah' }, ' gawang; arah lain hanya tangkapan biasa yang lebih lemah. Jurus yang sudah terlihat akan tercatat di kotak bidikan, jadi kamu tahu arah yang lemah.']);
    var s4 = sect(box, 'Semangat & Jurus Pamungkas');
    para(s4, ['Bar ', { b: 'SEMANGAT' }, ' terisi dari umpan, rebutan, penyelamatan, dan saat kebobolan. Saat penuh, tendangan berikutnya jadi ', { b: 'Jurus Pamungkas' }, ': api lebih besar dan tenaga +28%.']);
    var s5 = sect(box, 'Aturan kampung');
    var ul = el('ul');
    ['3 kali sepak pojok = penalti (mode Bola Keluar).', 'Bola panas: memegang bola lebih dari 6 detik membuat bola terlepas.', 'Gol Emas: bila skor sama, gol berikutnya menang.', 'Adu Penalti Api: 5 penendang per tim, lalu sudden death.'].forEach(function (t) { ul.appendChild(el('li', null, t)); });
    s5.appendChild(ul);
    var s6 = sect(box, 'Cuaca & bola');
    var ul2 = el('ul');
    D.WEATHERS.forEach(function (w) { var li = el('li'); li.appendChild(el('b', null, w.name + ': ')); li.appendChild(document.createTextNode(w.desc)); ul2.appendChild(li); });
    D.BALLS.forEach(function (b) { var li = el('li'); li.appendChild(el('b', null, b.name + ': ')); li.appendChild(document.createTextNode(b.desc)); ul2.appendChild(li); });
    s6.appendChild(ul2);
    var s7 = sect(box, 'Main online');
    var ol = el('ol', 'steps');
    ['Pemilik game membagikan game ini ke akun Claude lawan (menu Bagikan → undang).', 'Kedua pemain membuka game dalam keadaan masuk akun dan online (WiFi sama atau berbeda).', 'Tuan rumah: Main Online → Buat Room. Muncul QR dan kode.', 'Lawan: Main Online → Gabung Room → foto QR (atau ketik kode) → Saya siap.', 'Tuan rumah menekan Mulai.'].forEach(function (t) { ol.appendChild(el('li', null, t)); });
    s7.appendChild(ol);
  };

  /* ---------- pengaturan ---------- */
  function chipRow(parent, items, cur, pick) { var c = el('div', 'chips'); parent.appendChild(c); var draw = function (v) { chips(c, items, v, function (x) { pick(x); draw(x); }); }; draw(cur); return c; }
  UI.openSettings = function (keepScroll) {
    var box = $('settingsBody');
    var sy = keepScroll ? box.scrollTop : 0;
    var fIdx = -1;
    if (keepScroll && document.activeElement && box.contains(document.activeElement)) fIdx = focusables(box).indexOf(document.activeElement);
    clear(box);
    var S = BA.App.settings, App = BA.App, In = BA.Input, N = BA.Narr;
    // --- narator ---
    var sn = sect(box, 'Narator pertandingan');
    sn.appendChild(el('p', 'hint', 'Komentator ikut mengomentari laga dengan seru dan sedikit kocak. Suara memakai mesin suara bawaan perangkat.'));
    chipRow(sn, [{ id: 'id', n: 'Bahasa Indonesia' }, { id: 'en', n: 'English' }, { id: 'off', n: 'Mati' }], S.nLang, function (v) { App.setSetting('nLang', v); UI.openSettings(true); });
    if (S.nLang !== 'off') {
      var hp = el('h3', null, S.nLang === 'en' ? 'Commentator (5 male accents + 1 female)' : 'Pilih narator (5 pria berlogat + 1 wanita)'); hp.style.marginTop = '6px'; sn.appendChild(hp);
      chipRow(sn, N.PERSONAS.map(function (p) { return { id: p.id, n: S.nLang === 'en' ? (p.en || p.n) : p.n }; }), S.nPersona || 'bung', function (v) { App.setSetting('nPersona', v); UI.openSettings(true); });
      var pcur = N.personaById[S.nPersona] || N.PERSONAS[0];
      sn.appendChild(el('p', 'hint', S.nLang === 'en' ? pcur.descEn : pcur.desc));
      toggle(sn, 'Suara narator', S.nVoice, function (v) { App.setSetting('nVoice', v); UI.openSettings(true); });
      toggle(sn, 'Teks komentar di layar', S.nSubs, function (v) { App.setSetting('nSubs', v); });
      if (S.nVoice) {
        var vl = N.rankVoices(S.nLang);
        if (!N.ttsOk) sn.appendChild(el('p', 'hint warn', 'Perangkat ini tidak mendukung suara narator. Komentar tetap tampil sebagai teks.'));
        else if (!vl.length) {
          sn.appendChild(el('p', 'hint warn', S.nLang === 'id' ? 'Suara Bahasa Indonesia belum tersedia di perangkat ini, jadi komentar tampil sebagai teks.' : 'No English voice found on this device. Commentary will show as text.'));
          sn.appendChild(el('p', 'hint', N.voiceHelp(S.nLang)));
          if (!N.unlocked) sn.appendChild(el('p', 'hint', 'Ketuk layar sekali lalu buka pengaturan ini lagi: daftar suara baru muncul setelah sentuhan pertama.'));
          var rb = el('button', 'btn', 'Periksa suara lagi'); rb.type = 'button'; rb.style.maxWidth = '320px';
          rb.addEventListener('click', function () { click(); N.unlocked = false; N.unlock(); setTimeout(function () { if (UI.cur === 'scrSettings') UI.openSettings(true); }, 900); });
          sn.appendChild(rb);
        } else {
          var hv = el('h3', null, 'Suara mesin bicara perangkat'); hv.style.marginTop = '6px'; sn.appendChild(hv);
          sn.appendChild(el('p', 'hint', 'Dipakai sekarang: ' + (N.voiceLabel() || '—') + '. Nada & tempo diubah mengikuti narator yang dipilih. Suara berlabel Natural/Enhanced/Google terdengar paling alami.'));
          var vitems = [{ id: '', n: 'Otomatis (cocokkan narator)' }].concat(vl.slice(0, 10).map(function (v) { return { id: v.voiceURI, n: String(v.name || v.lang).replace(/^(Microsoft|Google)\s+/i, '').slice(0, 30) }; }));
          chipRow(sn, vitems, S.nVoiceURI || '', function (v) { App.setSetting('nVoiceURI', v); UI.openSettings(true); });
          if (vl.length < 2) sn.appendChild(el('p', 'hint', 'Ingin suara lebih alami atau beda tiap narator? ' + N.voiceHelp(S.nLang)));
        }
        var hvol = el('h3', null, 'Volume & kecepatan'); hvol.style.marginTop = '6px'; sn.appendChild(hvol);
        chipRow(sn, [{ id: 0.5, n: 'Pelan' }, { id: 0.8, n: 'Sedang' }, { id: 1, n: 'Keras' }], S.nVol, function (v) { App.setSetting('nVol', Number(v)); });
        chipRow(sn, [{ id: 0.9, n: 'Santai' }, { id: 1, n: 'Normal' }, { id: 1.15, n: 'Cepat' }], S.nRate, function (v) { App.setSetting('nRate', Number(v)); });
      }
      var tb = el('button', 'btn', S.nLang === 'en' ? 'Test the commentator' : 'Coba suara narator'); tb.type = 'button'; tb.style.maxWidth = '320px'; tb.style.marginTop = '6px';
      tb.addEventListener('click', function () { click(); N.test(); });
      sn.appendChild(tb);
    }
    // --- kontrol layar & tampilan ---
    var sc = sect(box, 'Kontrol');
    sc.appendChild(el('p', 'hint', 'Main dengan layar sentuh, keyboard, atau stik PS/gamepad. Tombol layar otomatis tersembunyi saat kamu memakai keyboard atau stik.'));
    var hf = el('h3', null, 'Layar penuh'); sc.appendChild(hf);
    toggle(sc, 'Otomatis layar penuh saat mulai main (HP/tablet)', S.autoFs, function (v) { App.setSetting('autoFs', v); });
    var frow = el('div', 'actions'); frow.style.justifyContent = 'flex-start';
    var fb = el('button', 'btn', UI.isFullscreen() ? 'Keluar layar penuh' : '⛶ Masuk layar penuh sekarang'); fb.type = 'button';
    fb.addEventListener('click', function () { click(); UI.toggleFullscreen(); setTimeout(function () { if (UI.cur === 'scrSettings') UI.openSettings(true); }, 400); });
    frow.appendChild(fb); sc.appendChild(frow);
    if (UI.FS.ua().standalone) sc.appendChild(el('p', 'hint ok', 'Game berjalan sebagai aplikasi layar utama: sudah tampil penuh.'));
    else if (!UI.fsSupported()) sc.appendChild(el('p', 'hint warn', (UI.FS.ua().ios || UI.FS.ua().ipad) ? 'iPhone/iPad: buka game di tab sendiri lalu "Tambah ke Layar Utama" agar tampil penuh tanpa bilah alamat.' : 'Layar penuh tidak diizinkan di jendela ini. Buka game di tab sendiri (tombol ⛶ di pojok menjelaskan caranya) atau tekan F11 di PC.'));
    var hk = el('h3', null, 'Tombol di layar'); hk.style.marginTop = '6px'; sc.appendChild(hk);
    chipRow(sc, [{ id: 'auto', n: 'Otomatis' }, { id: 'on', n: 'Selalu tampil' }, { id: 'off', n: 'Sembunyikan' }], S.touchUi, function (v) { App.setSetting('touchUi', v); });
    toggle(sc, 'Sprint otomatis saat joystick layar didorong penuh', S.autoSprint, function (v) { App.setSetting('autoSprint', v); });
    var lrow = el('div', 'actions'); lrow.style.justifyContent = 'flex-start'; lrow.style.marginTop = '6px';
    var ub = el('button', 'btn', '🔓 Buka kunci & atur posisi tombol'); ub.type = 'button';
    ub.addEventListener('click', function () { click(); BA.Layout.start(); });
    lrow.appendChild(ub);
    if (S.layout) {
      var lb = el('button', 'btn', 'Kembalikan posisi bawaan'); lb.type = 'button';
      lb.addEventListener('click', function () { click(); App.setSetting('layout', null); UI.openSettings(true); UI.toast('Posisi tombol dikembalikan ke bawaan'); });
      lrow.appendChild(lb);
    }
    sc.appendChild(lrow);
    sc.appendChild(el('p', 'hint', S.layout ? 'Posisi tombol sudah kamu atur sendiri (' + Object.keys(S.layout).map(BA.Layout.orientName).join(' & ') + '). Buka kunci untuk menggeser lagi.' : 'Buka kunci untuk menggeser tombol tendang, oper, gocek, ganti, sprint, dan area joystick, lalu kunci lagi agar tersimpan. Potret dan lanskap diatur terpisah.'));
    toggle(sc, 'Petunjuk tombol keyboard/stik di layar', S.legend, function (v) { App.setSetting('legend', v); });
    var hm = el('h3', null, 'Peta mini'); hm.style.marginTop = '6px'; sc.appendChild(hm);
    chipRow(sc, [{ id: 'auto', n: 'Lapangan besar saja' }, { id: 'on', n: 'Selalu' }, { id: 'off', n: 'Mati' }], S.minimap, function (v) { App.setSetting('minimap', v); });
    // --- keyboard ---
    var sk = sect(box, 'Tombol keyboard');
    sk.appendChild(el('p', 'hint', 'Klik kotak tombol lalu tekan tombol baru. Esc membatalkan, Backspace mengosongkan. Tiap aksi bisa punya dua tombol.'));
    bindTable(sk, 'key');
    var rk = el('button', 'btn', 'Kembalikan tombol keyboard bawaan'); rk.type = 'button'; rk.style.maxWidth = '360px';
    rk.addEventListener('click', function () { click(); App.setSetting('keys', null); UI.openSettings(true); UI.toast('Tombol keyboard dikembalikan'); });
    sk.appendChild(rk);
    // --- stik ---
    var sp = sect(box, 'Stik PS / gamepad');
    var info = In.padId ? 'Terhubung: ' + U.cleanText(In.padId, 60) : (In.padErr ? 'Stik tidak bisa dibaca di tampilan ini. Coba buka game di tab penuh.' : 'Belum ada stik. Sambungkan stik PS (kabel USB atau Bluetooth) lalu tekan salah satu tombolnya.');
    sp.appendChild(el('p', 'hint' + (In.padId ? ' ok' : ''), info));
    sp.appendChild(el('p', 'hint', 'Stik analog kiri selalu untuk bergerak. Di menu: D-pad/analog untuk pindah, ✕ pilih, ○ kembali, OPTIONS jeda.'));
    bindTable(sp, 'pad');
    var hd = el('h3', null, 'Zona mati analog'); hd.style.marginTop = '6px'; sp.appendChild(hd);
    chipRow(sp, [{ id: 0.12, n: 'Kecil' }, { id: 0.2, n: 'Sedang' }, { id: 0.3, n: 'Besar' }], S.deadzone, function (v) { App.setSetting('deadzone', Number(v)); });
    toggle(sp, 'Getar stik & HP', S.vibrate, function (v) { App.setSetting('vibrate', v); });
    var rp = el('button', 'btn', 'Kembalikan tombol stik bawaan'); rp.type = 'button'; rp.style.maxWidth = '360px';
    rp.addEventListener('click', function () { click(); App.setSetting('pad', null); UI.openSettings(true); UI.toast('Tombol stik dikembalikan'); });
    sp.appendChild(rp);
    // --- suara ---
    var s1 = sect(box, 'Suara');
    toggle(s1, 'Efek suara', S.sound, function (v) { App.setSetting('sound', v); });
    var hc = el('h3', null, 'Riuh penonton latar'); hc.style.marginTop = '6px'; s1.appendChild(hc);
    chipRow(s1, [{ id: 0, n: 'Mati' }, { id: 0.4, n: 'Pelan' }, { id: 0.7, n: 'Sedang' }, { id: 1, n: 'Ramai' }], S.crowd, function (v) { App.setSetting('crowd', Number(v)); });
    s1.appendChild(el('p', 'hint', 'Gumaman penonton di latar. Matikan bila terdengar seperti desis di speaker HP.'));
    // --- grafis ---
    var s2 = sect(box, 'Grafis'); var c2 = el('div', 'chips'); s2.appendChild(c2);
    var drawQ = function () { chips(c2, BA.R3.QUALITY.map(function (q, i) { return { id: i, n: q.n }; }), S.quality, function (v) { App.setSetting('quality', Number(v)); drawQ(); }); };
    drawQ();
    s2.appendChild(el('p', 'hint', 'Normal: bayangan nyata & efek api ber-shader. Tinggi: bayangan lebih halus, tekstur lapangan & partikel paling detail. Hemat: tanpa bayangan nyata, untuk HP yang panas atau patah-patah. Perubahan berlaku penuh di pertandingan berikutnya.'));
    var s3 = sect(box, 'Kamera');
    chipRow(s3, [{ id: 'auto', n: 'Otomatis' }, { id: 'samping', n: 'Samping (TV)' }, { id: 'belakang', n: 'Belakang (HP tegak)' }], S.cam, function (v) { App.setSetting('cam', v); });
    chipRow(s3, [{ id: 0.85, n: 'Dekat' }, { id: 1, n: 'Normal' }, { id: 1.2, n: 'Jauh' }], S.camZoom, function (v) { App.setSetting('camZoom', Number(v)); });
    var s4 = sect(box, 'Permainan');
    toggle(s4, 'Tampilkan angka tenaga saat duel', S.showPower, function (v) { App.setSetting('showPower', v); });
    var s5 = sect(box, 'Data');
    var b = el('button', 'btn', 'Hapus rekor & tim'); b.type = 'button'; b.style.maxWidth = '320px';
    b.addEventListener('click', function () {
      UI.confirm('Hapus semua data?', 'Rekor pertandingan dan tim buatanmu akan kembali ke awal.', [
        { label: 'Batal' }, { label: 'Hapus', main: true, fn: function () { BA.App.resetData(); UI.openSettings(); } }]);
    });
    s5.appendChild(b);
    if (UI.cur !== 'scrSettings') UI.show('scrSettings');
    if (keepScroll) {
      box.scrollTop = sy;
      if (fIdx >= 0) { var fl = focusables(box); if (fl[fIdx]) { try { fl[fIdx].focus({ preventScroll: true }); } catch (e) { fl[fIdx].focus(); } } }
    }
  };

  /* tabel atur tombol (keyboard / stik) */
  function bindTable(parent, kind) {
    var In = BA.Input, App = BA.App;
    var g = el('div', 'binds'); parent.appendChild(g);
    In.ACTIONS.forEach(function (a) {
      g.appendChild(el('span', 'bl', a.n));
      [0, 1].forEach(function (slot) {
        var cur = kind === 'key' ? In.keys[a.id][slot] : In.pad[a.id][slot];
        var name = kind === 'key' ? In.keyName(cur) : In.padName(cur);
        var b = el('button', 'bk' + ((kind === 'key' ? !cur : cur < 0) ? ' empty' : ''), name);
        b.type = 'button';
        b.setAttribute('aria-label', a.n + ' tombol ' + (slot + 1) + ': ' + name);
        b.addEventListener('click', function () {
          click();
          if (In.cap && In.cap.action === a.id && In.cap.slot === slot && In.cap.kind === kind) { In.cancelCapture(); return; }
          b.textContent = kind === 'key' ? 'Tekan tombol…' : 'Tekan tombol stik…';
          b.classList.add('wait');
          In.capture(kind, a.id, slot, function (res) {
            if (res) {
              App.setSetting(kind === 'key' ? 'keys' : 'pad', kind === 'key' ? In.keys : In.pad);
              if (res.moved) { var mv = In.ACTIONS.filter(function (x) { return x.id === res.moved; })[0]; UI.toast('Tombol dipindah dari "' + (mv ? mv.n : res.moved) + '"'); }
            }
            if (UI.cur === 'scrSettings') UI.openSettings(true);
          });
        });
        g.appendChild(b);
      });
    });
  }

  /* ---------- navigasi menu dengan stik / panah keyboard ---------- */
  UI.navScope = function () {
    var md = $('modal'); if (md && !md.hidden) return md;
    if (UI.cur && UI.cur !== 'play') return $(UI.cur);
    return null;
  };
  function focusables(scope) {
    var list = scope.querySelectorAll('button, input:not([type=hidden]):not([type=file]), select, textarea, label.btn');
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.disabled || e.closest('[hidden]') || e.closest('.hidden')) continue;
      var r = e.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (e.tagName === 'LABEL' && !e.hasAttribute('tabindex')) e.tabIndex = 0;
      out.push(e);
    }
    return out;
  }
  function focusEl(e) {
    if (!e) return;
    try { e.focus({ preventScroll: true }); } catch (er) { e.focus(); }
    try { e.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (er2) { /* abaikan */ }
  }
  UI.navFirst = function () {
    var scope = UI.navScope(); if (!scope) return;
    var items = focusables(scope);
    var pick = items.filter(function (e) { return e.classList.contains('main') || e.classList.contains('hot'); })[0] || items.filter(function (e) { return !e.hasAttribute('data-back'); })[0] || items[0];
    focusEl(pick);
  };
  UI.nav = function (dir) {
    var scope = UI.navScope(); if (!scope) return;
    document.body.classList.add('kbnav');
    var items = focusables(scope); if (!items.length) return;
    var cur = document.activeElement;
    if (!cur || items.indexOf(cur) < 0) { UI.navFirst(); return; }
    var r0 = cur.getBoundingClientRect(), cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
    var best = null, bs = 1e9;
    items.forEach(function (e) {
      if (e === cur) return;
      var r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      var along, across;
      if (dir === 'up') { along = r0.top - r.bottom + (cy - y) * 0.01; across = Math.max(0, Math.max(r.left - r0.right, r0.left - r.right)); if (y >= cy - 2) return; }
      else if (dir === 'down') { along = r.top - r0.bottom + (y - cy) * 0.01; across = Math.max(0, Math.max(r.left - r0.right, r0.left - r.right)); if (y <= cy + 2) return; }
      else if (dir === 'left') { along = r0.left - r.right + (cx - x) * 0.01; across = Math.max(0, Math.max(r.top - r0.bottom, r0.top - r.bottom)); if (x >= cx - 2) return; }
      else { along = r.left - r0.right + (x - cx) * 0.01; across = Math.max(0, Math.max(r.top - r0.bottom, r0.top - r.bottom)); if (x <= cx + 2) return; }
      var sc = Math.max(0, along) + across * 3 + Math.abs(dir === 'up' || dir === 'down' ? x - cx : y - cy) * 0.15;
      if (sc < bs) { bs = sc; best = e; }
    });
    if (best) focusEl(best);
  };
  UI.navOk = function () {
    var scope = UI.navScope(); if (!scope) return;
    document.body.classList.add('kbnav');
    var e = document.activeElement;
    if (!e || !scope.contains(e) || e === document.body) { UI.navFirst(); return; }
    if (e.tagName === 'INPUT' || e.tagName === 'TEXTAREA') { e.focus(); return; }
    e.click();
  };
  UI.navBack = function () {
    var md = $('modal');
    if (md && !md.hidden) { var bs = md.querySelectorAll('#modalActions .btn'); if (bs.length > 1) bs[0].click(); return; }
    if (BA.Input && BA.Input.cap) { BA.Input.cancelCapture(); return; }
    if (UI.cur === 'scrPause') { BA.App.resume(); return; }
    var sc = UI.cur ? $(UI.cur) : null;
    var b = sc && sc.querySelector('[data-back]');
    if (b && !b.closest('[hidden]')) b.click();
  };

  /* petunjuk tombol saat main dengan keyboard / stik */
  UI.legend = function (dev) {
    var box = $('keyLegend'); if (!box) return;
    var In = BA.Input, key = dev + '|' + JSON.stringify(In.keys) + JSON.stringify(In.pad) + In.padStyleCur;
    if (box._k === key) return;
    box._k = key; clear(box);
    if (dev !== 'kb' && dev !== 'pad') return;
    [['pass', 'Oper'], ['shoot', 'Tendang'], ['gocek', 'Gocek / rebut'], ['switch', 'Ganti'], ['sprint', 'Sprint'], ['skip', 'Lewati']].forEach(function (r) {
      var v = dev === 'kb' ? In.keys[r[0]][0] || In.keys[r[0]][1] : (In.pad[r[0]][0] >= 0 ? In.pad[r[0]][0] : In.pad[r[0]][1]);
      var nm = dev === 'kb' ? In.keyName(v) : In.padName(v);
      if (!v && v !== 0 || nm === '—') return;
      var s = el('span'); s.appendChild(el('kbd', null, nm)); s.appendChild(document.createTextNode(r[1])); box.appendChild(s);
    });
  };

  /* ---------- hasil ---------- */
  UI.showResult = function (sum, teams, my, actions, title) {
    var box = $('resultBody'); clear(box);
    var fin = el('div', 'final');
    var w = sum.wn;
    var whoTxt = w < 0 ? 'Seri!' : (teams[w].name + (w === my ? ' menang!' : ' menang'));
    if (title) whoTxt = title;
    fin.appendChild(el('div', 'who', whoTxt));
    fin.appendChild(el('div', 'score', sum.sc[0] + ' – ' + sum.sc[1]));
    var line = el('div', 'pen', teams[0].name + '  vs  ' + teams[1].name);
    fin.appendChild(line);
    if (sum.so) fin.appendChild(el('div', 'pen', 'Adu penalti: ' + sum.so[0].split('').reduce(function (a, v) { return a + Number(v); }, 0) + ' – ' + sum.so[1].split('').reduce(function (a, v) { return a + Number(v); }, 0)));
    box.appendChild(fin);
    if (sum.goals && sum.goals.length) {
      var sg = sect(box, 'Pencetak gol'); var gl = el('div', 'goalList'); sg.appendChild(gl);
      sum.goals.forEach(function (g) {
        var r = el('div'); var who = el('b', null, U.cleanText(String(g[1]), 14) + (g[3] ? ' (bunuh diri)' : ''));
        who.style.color = teams[g[0] | 0] ? teams[g[0] | 0].c1 : '';
        if (U.lum(who.style.color || '#ffffff') < 0.25) who.style.color = '';
        r.appendChild(who);
        r.appendChild(el('span', null, (g[2] ? U.cleanText(String(g[2]), 20) : 'Bola liar') + ' · ' + U.fmtTime(g[4] | 0)));
        gl.appendChild(r);
      });
    }
    var ss = sect(box, 'Statistik'); var tbl = el('table', 'statsTbl'); ss.appendChild(tbl);
    var lbl = ['Tendangan', 'Tepat sasaran', 'Gol', 'Penyelamatan', 'Jurus kiper', 'Rebutan bola', 'Umpan sukses', 'Tendangan terkeras'];
    lbl.forEach(function (l, i) {
      var tr = el('tr');
      tr.appendChild(el('td', null, String(sum.st[0][i] | 0)));
      tr.appendChild(el('td', null, l));
      tr.appendChild(el('td', null, String(sum.st[1][i] | 0)));
      tbl.appendChild(tr);
    });
    if (sum.best) {
      var sb = sect(box, 'Tendangan terkeras');
      sb.appendChild(el('p', 'hint', U.cleanText(String(sum.best[1]), 14) + ' · ' + U.cleanText(String(sum.best[2]), 20) + ' · tenaga ' + (sum.best[0] | 0)));
    }
    var act = $('resultActions'); clear(act);
    actions.forEach(function (a) { var b = el('button', 'btn' + (a.main ? ' main' : ''), a.label); b.type = 'button'; b.addEventListener('click', function () { click(); a.fn(); }); act.appendChild(b); });
    UI.stack = [];
    UI.show('scrResult', false);
  };

  /* ---------- bagan turnamen ---------- */
  UI.showBracket = function (tour, actions) {
    var box = $('bracketBody'); clear(box);
    var s = sect(box, null);
    s.appendChild(el('p', 'hint', tour.note || ''));
    var grid = el('div', 'bracket'); s.appendChild(grid);
    function match(lbl, m) {
      var d = el('div', 'match' + (m && (m.a === 0 || m.b === 0) ? ' mine' : ''));
      d.appendChild(el('div', 'lbl', lbl));
      if (!m) { d.appendChild(el('div', null, 'Menunggu pemenang')); return d; }
      [['a', 0], ['b', 1]].forEach(function (k) {
        var t = tour.teams[m[k[0]]];
        var row = el('div', m.done && m.w === m[k[0]] ? 'w' : '');
        row.appendChild(el('span', null, t ? t.name : '?'));
        row.appendChild(el('span', null, m.done ? String(m.sc[k[1]]) + (m.pen ? ' (' + m.pen[k[1]] + ')' : '') : '-'));
        d.appendChild(row);
      });
      return d;
    }
    grid.appendChild(match('Semifinal 1', tour.sf[0]));
    grid.appendChild(match('Semifinal 2', tour.sf[1]));
    var fbox = el('div'); fbox.style.gridColumn = '1 / -1';
    fbox.appendChild(match('Final', tour.fin)); grid.appendChild(fbox);
    var act = $('bracketActions'); clear(act);
    actions.forEach(function (a) { var b = el('button', 'btn' + (a.main ? ' main' : ''), a.label); b.type = 'button'; b.addEventListener('click', function () { click(); a.fn(); }); act.appendChild(b); });
    UI.show('scrBracket');
  };

  /* ---------- modal ---------- */
  UI.confirm = function (title, text, btns) {
    $('modalTitle').textContent = title; $('modalText').textContent = text;
    var act = $('modalActions'); clear(act);
    btns.forEach(function (bt) {
      var b = el('button', 'btn' + (bt.main ? ' main' : ''), bt.label); b.type = 'button';
      b.addEventListener('click', function () { click(); $('modal').hidden = true; if (bt.fn) bt.fn(); });
      act.appendChild(b);
    });
    $('modal').hidden = false;
    if (document.body.classList.contains('kbnav')) setTimeout(UI.navFirst, 30);
  };

  /* ---------- HUD ---------- */
  var hudCache = {};
  function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; var n = $(id); if (n) n.textContent = v; } }
  function setStyle(id, prop, v) { var key = id + prop; if (hudCache[key] !== v) { hudCache[key] = v; var n = $(id); if (n) n.style[prop] = v; } }
  function setClass(id, cls, on) { var key = id + '.' + cls; if (hudCache[key] !== on) { hudCache[key] = on; var n = $(id); if (n) n.classList.toggle(cls, on); } }
  UI.resetHud = function () { hudCache = {}; };
  UI.hud = function (st, my, opts) {
    opts = opts || {};
    var T = st.teams;
    setText('hudNA', T[0].short); setText('hudNB', T[1].short);
    setStyle('hudCA', 'background', T[0].c1); setStyle('hudCB', 'background', T[1].c1);
    setText('hudSA', String(st.score[0])); setText('hudSB', String(st.score[1]));
    var ck = st.mode === 'match' ? (st.golden ? 'GOL EMAS' : U.fmtTime(st.clock)) : (st.mode === 'practice' ? 'LATIHAN' : 'PENALTI');
    if (st.mode === 'match' && st.shootout) ck = 'PENALTI';
    setText('hudClock', ck);
    setClass('hudClock', 'gold', !!st.golden || (st.mode === 'match' && st.clock <= 15 && st.clock > 0));
    setStyle('semBarA', 'width', Math.round(st.sem[0]) + '%'); setStyle('semBarB', 'width', Math.round(st.sem[1]) + '%');
    setClass('semA', 'full', st.sem[0] >= 100); setClass('semB', 'full', st.sem[1] >= 100);
    var lA = st.sem[0] >= 100 ? 'PAMUNGKAS SIAP!' : 'SEMANGAT', lB = st.sem[1] >= 100 ? 'PAMUNGKAS SIAP!' : 'SEMANGAT';
    var sa = $('semA').querySelector('label'), sb = $('semB').querySelector('label');
    if (sa.textContent !== lA) sa.textContent = lA; if (sb.textContent !== lB) sb.textContent = lB;
    $('sems').style.visibility = st.mode === 'practice' ? 'hidden' : 'visible';
    // info kanan atas
    var info = (st.weather ? st.weather.name : '') + ' · ' + (st.ballDef ? st.ballDef.name : '');
    if (st.rules && st.rules.bound === 'keluar' && st.rules.tigaPojok && st.mode === 'match') info += ' · Pojok ' + st.corners[0] + '–' + st.corners[1];
    if (st.mode === 'practice' && st.practice) info = 'Tendangan ' + st.practice.n + ' · Gol ' + st.practice.goals;
    setText('hudInfo', info);
    // pemain aktif
    var me = my >= 0 ? st.active[my] : null;
    if (st.pen && st.pen.shooter && st.pen.team === my) me = st.pen.shooter;
    if (me) {
      setText('meName', me.name + ' · ' + me.num);
      setText('meShot', me.shot ? me.shot.name : '');
      setStyle('meStam', 'width', Math.round(U.num(me.stamina, 100)) + '%');
      setStyle('me', 'visibility', 'visible');
    } else setStyle('me', 'visibility', 'hidden');
    // tali adu penalti
    var so = st.shootout;
    var tl = $('tally');
    if (so && (st.phase === 'pen' || st.phase === 'cine' || st.mode === 'penalty')) {
      tl.classList.remove('hidden');
      var key = so.kicks[0].join('') + '|' + so.kicks[1].join('');
      if (hudCache.tally !== key) {
        hudCache.tally = key; clear(tl);
        [0, 1].forEach(function (t) {
          var row = el('div'); row.appendChild(el('b', null, T[t].short));
          for (var i = 0; i < Math.max(5, so.kicks[t].length); i++) { var v = so.kicks[t][i]; row.appendChild(el('i', v === 1 ? 'g' : (v === 0 ? 'x' : ''))); }
          tl.appendChild(row);
        });
      }
    } else tl.classList.add('hidden');
    // label tombol konteks
    var hasBall = me && st.ball && st.ball.owner === me;
    setText('bGocek', hasBall || (st.pen && st.pen.team === my) ? 'GOCEK' : 'REBUT');
    setText('bShoot', opts.canShoot === false ? 'SAPU' : 'TENDANG');
    var penNow = st.phase === 'pen' || st.mode === 'penalty' || st.mode === 'practice';
    setClass('controls', 'penMode', st.phase === 'pen' || st.mode === 'penalty');
    setClass('bShoot', 'off', penNow && !!st.pen && st.pen.team !== my);
  };

  var commentT = null;
  UI.comment = function (text, ms) {
    var c = $('comment'); if (!c) return;
    c.textContent = text; c.style.opacity = '1';
    clearTimeout(commentT);
    commentT = setTimeout(function () { c.style.opacity = '0'; }, ms || 2600);
  };
  /* kilatan layar singkat (ledakan api, gol) */
  UI.flash = function (col, ms, peak) {
    var f = $('flash'); if (!f) return;
    try { if (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) { /* abaikan */ }
    f.style.transition = 'none'; f.style.background = col || '#ffffff'; f.style.opacity = String(peak == null ? 0.5 : peak);
    f.hidden = false;
    if (UI._flashT) clearTimeout(UI._flashT);
    UI._flashT = setTimeout(function () { f.style.transition = 'opacity ' + (ms || 180) + 'ms ease-out'; f.style.opacity = '0'; UI._flashT = setTimeout(function () { f.hidden = true; }, (ms || 180) + 40); }, 16);
  };
  UI.toast = function (text) {
    var host = $('toastHost'); if (!host) return;
    clear(host);
    var t = el('div', 'toast', text); host.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 1800);
  };
  UI.banner = function (big, small, ms) {
    var host = $('bannerHost'); if (!host) return;
    clear(host);
    var b = el('div', 'banner', big);
    if (small) b.appendChild(el('small', null, small));
    host.appendChild(b);
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, ms || 1800);
  };

  /* ---------- bidikan ---------- */
  var aimBuilt = false, aimCells = [];
  UI.aim = function (show, d) {
    var a = $('aim');
    if (!show) { if (!a.hidden) a.hidden = true; return; }
    if (a.hidden) a.hidden = false;
    if (!aimBuilt) {
      var g = $('aimGrid'); clear(g);
      D.ZONES.forEach(function () { var z = el('div', 'z'); g.appendChild(z); aimCells.push(z); });
      aimBuilt = true;
    }
    D.ZONES.forEach(function (z, i) {
      var sk = d.revealed[z.id];
      var txt = sk ? D.SKILLS[sk].name : (d.mult ? '×' + D.shotMult(d.shot, z.id).toFixed(2) : '');
      var cls = 'z' + (sk ? ' sp' : '') + (z.c === d.zc && z.r === d.zr ? ' sel' : '');
      if (aimCells[i].className !== cls) aimCells[i].className = cls;
      if (aimCells[i].textContent !== txt) aimCells[i].textContent = txt;
    });
    var zone = D.zoneOf(d.zc, d.zr);
    setText('aimInfo', (d.shot ? d.shot.name : '') + ' → ' + zone.name);
    setStyle('meterFill', 'height', Math.round(U.clamp(d.charge / 1.2, 0, 1) * 100) + '%');
  };

  /* ---------- adegan ---------- */
  UI.cineStart = function (o) {
    $('cine').hidden = false;
    $('play').classList.add('cine-on');
    clear($('cineAtt')); clear($('cineDef')); clear($('cineClash')); clear($('cineRes'));
    var a = el('div', 'cAtt');
    var w = el('div', 'who');
    if (o.ult) w.appendChild(el('span', 'badge', 'PAMUNGKAS'));
    if (o.perfect) w.appendChild(el('span', 'badge p', 'PAS!'));
    if (o.combo) w.appendChild(el('span', 'badge c', 'KOMBINASI'));
    w.appendChild(document.createTextNode(o.shooter + (o.pen ? ' · penalti' : '')));
    a.appendChild(w);
    a.appendChild(el('div', 'what', o.shot + '!'));
    $('cineAtt').appendChild(a);
    UI.flash(0.25);
  };
  UI.cineStage = function () { /* ruang untuk efek tahap */ };
  UI.cineDefend = function (o) {
    var d = el('div', 'cDef');
    d.appendChild(el('div', 'who', o.keeper));
    d.appendChild(el('div', 'what' + (o.special ? '' : ' normal'), o.skill + (o.special ? '!' : '')));
    clear($('cineDef')); $('cineDef').appendChild(d);
    if (BA.App.settings.showPower) {
      var c = el('div', 'clash');
      c.appendChild(el('div', 'n a', String(o.sp)));
      var tr = el('div', 'track'), fa = el('i', 'fa'), fd = el('i', 'fd');
      fa.style.width = '0%'; fd.style.width = '0%';
      tr.appendChild(fa); tr.appendChild(fd); c.appendChild(tr);
      c.appendChild(el('div', 'n d', String(o.kp)));
      clear($('cineClash')); $('cineClash').appendChild(c);
      UI._clash = { fa: fa, fd: fd, sp: o.sp, kp: o.kp };
    }
  };
  UI.cineClash = function (k) {
    var c = UI._clash; if (!c) return;
    var tot = Math.max(1, c.sp + c.kp);
    c.fa.style.width = (k * 100 * c.sp / tot) + '%';
    c.fd.style.width = (k * 100 * c.kp / tot) + '%';
  };
  UI.cineResult = function (res) {
    clear($('cineClash')); UI._clash = null;
    var map = { goal: ['GOOOL!', 'goal'], catch: ['DITANGKAP!', 'save'], parry: ['DITEPIS!', 'save'], post: ['KENA TIANG!', 'save'] };
    var m = map[res] || map.catch;
    clear($('cineRes')); $('cineRes').appendChild(el('div', 'result ' + m[1], m[0]));
    if (res === 'goal') UI.flash(0.45);
  };
  UI.cineEnd = function () { $('cine').hidden = true; $('play').classList.remove('cine-on'); clear($('cineRes')); clear($('cineClash')); UI._clash = null; };
  UI.cineAttFade = function () { var a = $('cineAtt').firstChild; if (a) a.classList.add('fade'); };
  UI.flash = function (v) {
    var f = $('flash'); if (!f) return;
    f.style.transition = 'none'; f.style.opacity = String(v);
    requestAnimationFrame(function () { f.style.transition = 'opacity 0.35s'; f.style.opacity = '0'; });
  };

  UI.loading = function (msg, show) {
    var l = $('loading'); if (!l) return;
    if (msg) $('loadMsg').textContent = msg;
    l.hidden = !show;
  };
})(typeof window !== 'undefined' ? window : globalThis);
