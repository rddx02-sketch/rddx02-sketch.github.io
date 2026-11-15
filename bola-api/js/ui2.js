/* Bola Api Arena — antarmuka tambahan: papan tim lobi online (sampai 8 pemain), layar strategi
   (formasi, taktik, susunan, kebugaran, pergantian), strip kondisi pemain di HUD, dan pilihan bahasa */
(function (root) {
  'use strict';
  var BA = root.BA, U = BA.U, D = BA.D, UI = BA.UI;
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function clear(n) { while (n && n.firstChild) n.removeChild(n.firstChild); }
  function click() { if (BA.Audio) { BA.Audio.init(); BA.Audio.click(); } }
  function T() { return BA.t ? BA.t.apply(null, arguments) : arguments[0]; }
  function crest(t) { var c = el('i', 'crest'); if (t) c.style.background = 'linear-gradient(135deg,' + t.c1 + ' 50%,' + t.c2 + ' 50%)'; return c; }

  /* ======================================================================
     PAPAN TIM LOBI ONLINE
     o: { roster:[{id,n,t,rd}], teamA, teamB, npcB, mySeat, host, cap, onMove(i) (tuan rumah), onPick(tim) (tamu) }
     ====================================================================== */
  UI.rosterBox = function (id, o) {
    var box = $(id); if (!box) return;
    clear(box); box.classList.remove('hidden');
    box.appendChild(el('h3', null, T('Pembagian tim')));
    var board = el('div', 'lobbyBoard');
    [0, 1].forEach(function (t) {
      if (t === 1) board.appendChild(el('div', 'lbVs', 'VS'));
      var team = t === 0 ? o.teamA : o.teamB;
      var col = el('div', 'lbTeam');
      var head = el('div', 'lbHead');
      head.appendChild(crest(team));
      var hb = el('div');
      hb.appendChild(el('b', null, (t === 0 ? 'Tim A' : 'Tim B') + (team ? ' · ' + team.name : '')));
      var humans = o.roster.filter(function (r) { return r.t === t; });
      var sub = humans.length ? T('{0} pemain manusia, sisanya NPC', humans.length) : (t === 1 && o.npcB ? T('Semua dijaga NPC') : T('Belum ada pemain manusia'));
      if (humans.length > o.cap) sub = T('{0} pemain manusia — terlalu banyak (maks. {1})', humans.length, o.cap);
      var sp = el('span', humans.length > o.cap ? 'bad' : null, sub); hb.appendChild(sp);
      head.appendChild(hb); col.appendChild(head);
      var list = el('div', 'lbList');
      o.roster.forEach(function (r, i) {
        if (r.t !== t) return;
        var first = humans[0] === r;
        var row = el(o.host && i > 0 ? 'button' : 'div', 'lbP' + (i === o.mySeat ? ' mine' : '') + (r.rd ? ' rd' : ''));
        if (row.tagName === 'BUTTON') { row.type = 'button'; row.setAttribute('aria-label', T('Pindahkan {0} ke tim lain', r.n)); row.addEventListener('click', function () { click(); o.onMove(i); }); }
        row.appendChild(el('b', null, r.n));
        var tags = [];
        if (i === o.mySeat) tags.push(T('kamu'));
        if (i === 0) tags.push(T('tuan rumah'));
        if (first) tags.push(T('kapten'));
        if (tags.length) row.appendChild(el('span', 'tag', tags.join(' · ')));
        row.appendChild(el('span', 'st', i === 0 ? '' : (r.rd ? '✔ ' + T('siap') : '… ' + T('belum siap'))));
        if (o.host && i > 0) row.appendChild(el('span', 'mv', '⇄'));
        list.appendChild(row);
      });
      if (!humans.length) list.appendChild(el('div', 'lbEmpty', t === 1 ? T('Lawan NPC') : '—'));
      col.appendChild(list); board.appendChild(col);
    });
    box.appendChild(board);
    if (!o.host && o.mySeat >= 0 && o.onPick) {
      var mine = o.roster[o.mySeat], row2 = el('div', 'chips');
      [0, 1].forEach(function (t) {
        var b = el('button', 'chip' + (mine.t === t ? ' on' : ''), t === 0 ? T('Masuk Tim A') : T('Masuk Tim B')); b.type = 'button';
        b.addEventListener('click', function () { click(); o.onPick(t); });
        row2.appendChild(b);
      });
      box.appendChild(row2);
    }
    box.appendChild(el('p', 'hint', o.host ? T('Ketuk nama tamu untuk memindahkannya ke tim lain. Di lapangan ini tiap tim memuat paling banyak {0} pemain manusia; posisi kosong dan kiper dijaga NPC. Kapten tiap tim mengatur formasi dan pergantian pemain.', o.cap)
      : T('Pilih tim, atau biarkan tuan rumah yang mengatur. Di lapangan ini tiap tim memuat paling banyak {0} pemain manusia; posisi kosong dan kiper dijaga NPC.', o.cap)));
  };

  /* ======================================================================
     LAYAR STRATEGI
     ctx 'pre'   : mengatur Tim Saya (tersimpan) untuk satu ukuran lapangan
     ctx 'match' : laga berjalan — kondisi langsung; kapten bisa mengubah formasi, taktik, posisi, dan mengganti pemain
     ====================================================================== */
  var S = UI.strat = { ctx: 'pre', field: 'kampung', sel: null, ret: null };
  UI.openStrategy = function (ctx, fieldId) {
    S.ctx = ctx === 'match' ? 'match' : 'pre';
    if (fieldId && D.fieldById[fieldId]) S.field = fieldId;
    S.sel = null;
    UI.show('scrStrategy');
    UI.renderStrategy();
  };
  UI.strategyRefresh = function () { if (UI.cur === 'scrStrategy') UI.renderStrategy(); };

  function model() {
    var App = BA.App, m = App.match;
    if (S.ctx === 'match' && m) {
      var st = m.state, t = m.my, team = st.teams[t];
      var ps = st.players.filter(function (p) { return p.team === t; }).map(function (p) {
        return { idx: p.idx, slotIdx: p.slotIdx == null ? p.idx : p.slotIdx, slot: p.slot || { fx: 0.4, fz: 0 }, role: p.role, name: p.name, num: p.num, energy: U.num(p.energy, 100), injured: !!p.injured, hidden: !!p.hidden, cfg: p.cfg };
      });
      return { live: true, can: App.isCaptain() && st.phase !== 'end', n: st.n, fieldId: st.field, form: team.form || '', tactic: team.tactic, autoSub: !!team.autoSub, team: team, players: ps,
        bench: (st.bench && st.bench[t] ? st.bench[t] : []).map(function (b, j) { return { j: j, cfg: team.players[b.i], used: !!b.used }; }),
        subsLeft: st.subsLeft ? st.subsLeft[t] : 0, me: App.ctlPlayer(st, m) };
    }
    var Tm = BA.App.myTeam, fid = S.field, n = D.squadOf(fid), su = D.setupOf(Tm, fid);
    var ordered = su.l.map(function (i) { return Tm.players[i]; });
    var slots = D.formSlots(n, su.f, ordered);
    return { live: false, can: true, n: n, fieldId: fid, form: su.f, tactic: Tm.tactic, autoSub: !!Tm.autoSub, team: Tm, order: su.l,
      players: ordered.slice(0, n).map(function (c, i) { return { idx: i, slotIdx: i, slot: slots[i], role: slots[i].role, name: c.name, num: c.num, energy: 100, injured: false, hidden: false, cfg: c }; }),
      bench: ordered.slice(n, n + D.BENCH).map(function (c, j) { return { j: j, cfg: c, used: false }; }), subsLeft: D.MAX_SUBS, me: null };
  }
  function saveSetup(mut) {
    var App = BA.App, Tm = App.myTeam, fid = S.field, su = D.setupOf(Tm, fid);
    mut(su);
    if (!Tm.setup || typeof Tm.setup !== 'object') Tm.setup = {};
    Tm.setup[fid] = { f: su.f || '', l: su.l };
    App.saveTeam();
  }
  var ROLE_N = { GK: 'Kiper', DF: 'Bek', MF: 'Gelandang', FW: 'Penyerang' }, ROLE_S = { GK: 'KP', DF: 'BK', MF: 'GL', FW: 'PY' };
  function fitBar(energy, injured) {
    var f = D.fitOf(energy, injured), w = el('div', 'fit');
    var bar = el('div', 'fitBar'), i = el('i'); i.style.width = Math.max(4, Math.round(energy)) + '%'; i.style.background = f.c; bar.appendChild(i);
    w.appendChild(bar); var lb = el('span', null, (injured ? '✚ ' : '') + T(f.n)); lb.style.color = f.c; w.appendChild(lb);
    return w;
  }

  UI.renderStrategy = function () {
    var box = $('stratBody'); if (!box) return;
    var sy = box.scrollTop;
    clear(box);
    var M = model(), App = BA.App;
    $('stratTitle').textContent = M.live ? T('Strategi & ganti pemain') : T('Strategi & Formasi');
    var wrap = el('div', 'strat');
    var left = el('div', 'stratL'), right = el('div', 'stratR');
    /* ---- kepala ---- */
    if (!M.live) {
      var sf = el('div', 'sect'); sf.appendChild(el('h3', null, T('Ukuran lapangan')));
      var cf = el('div', 'chips'); sf.appendChild(cf);
      D.FIELDS.forEach(function (fd) {
        var b = el('button', 'chip' + (fd.id === S.field ? ' on' : ''), fd.short); b.type = 'button';
        b.addEventListener('click', function () { click(); S.field = fd.id; S.sel = null; UI.renderStrategy(); });
        cf.appendChild(b);
      });
      sf.appendChild(el('p', 'hint', T('Susunan tiap ukuran lapangan disimpan sendiri-sendiri dan dipakai di semua mode, termasuk online.')));
      right.appendChild(sf);
    } else if (!M.can) {
      var info = el('div', 'sect'); info.appendChild(el('p', 'hint warn', T('Hanya kapten tim (pemain pertama di tim ini) yang bisa mengubah strategi dan mengganti pemain. Kamu tetap bisa melihat kondisi pemain.'))); right.appendChild(info);
    }
    /* ---- lapangan mini ---- */
    /* layar lebar & pendek (HP mendatar): lapangan digambar mendatar, gawang sendiri di kiri; selain itu tegak, gawang sendiri di bawah */
    var hz = root.innerWidth > root.innerHeight && root.innerHeight < 620;
    var pitch = el('div', 'pitch' + (hz ? ' hz' : ''));
    pitch.setAttribute('aria-label', T('Susunan pemain di lapangan'));
    ['mid', 'circ', 'box'].forEach(function (c) { pitch.appendChild(el('i', 'ln ' + c)); });
    var doAct = function (a, b) {
      /* a, b: { kind: 'f' (lapangan) | 'b' (cadangan), i } */
      if (!M.can) return;
      if (a.kind === 'f' && b.kind === 'f') {
        if (M.live) App.teamCmd({ k: 'swap', a: a.i, b: b.i });
        else saveSetup(function (su) { var x = su.l[a.i]; su.l[a.i] = su.l[b.i]; su.l[b.i] = x; });
      } else if (a.kind !== b.kind) {
        var f = a.kind === 'f' ? a : b, bn = a.kind === 'b' ? a : b;
        if (M.live) {
          if (M.subsLeft <= 0) { UI.toast(T('Jatah pergantian sudah habis')); return; }
          App.teamCmd({ k: 'sub', out: f.i, j: bn.i });
        } else saveSetup(function (su) { var p1 = f.i, p2 = M.n + bn.i; var x = su.l[p1]; su.l[p1] = su.l[p2]; su.l[p2] = x; });
      } else if (!M.live) {
        saveSetup(function (su) { var p1 = M.n + a.i, p2 = M.n + b.i; var x = su.l[p1]; su.l[p1] = su.l[p2]; su.l[p2] = x; });
      }
    };
    var pick = function (kind, i) {
      if (!M.can) return;
      click();
      var cur = S.sel;
      if (cur && cur.kind === kind && cur.i === i) { S.sel = null; UI.renderStrategy(); return; }
      if (!cur) { S.sel = { kind: kind, i: i }; UI.renderStrategy(); return; }
      S.sel = null;
      doAct(cur, { kind: kind, i: i });
      UI.renderStrategy();
    };
    M.players.forEach(function (p) {
      var gk = p.idx === 0;
      var tk = el(gk || !M.can ? 'div' : 'button', 'tok' + (gk ? ' gk' : '') + (p.hidden ? ' out' : '') + (S.sel && S.sel.kind === 'f' && S.sel.i === p.idx ? ' sel' : '') + (M.me && M.me.idx === p.idx ? ' mine' : ''));
      if (tk.tagName === 'BUTTON') { tk.type = 'button'; if (!p.hidden) tk.addEventListener('click', function () { pick('f', p.idx); }); }
      var f = D.fitOf(p.energy, p.injured);
      if (hz) { tk.style.left = (5 + U.clamp(p.slot.fx, 0, 0.9) * 98) + '%'; tk.style.top = (50 + U.clamp(p.slot.fz, -0.5, 0.5) * 84) + '%'; }
      else { tk.style.left = (50 + U.clamp(p.slot.fz, -0.5, 0.5) * 84) + '%'; tk.style.top = (95 - U.clamp(p.slot.fx, 0, 0.9) * 98) + '%'; }
      var disc = el('i', 'disc', String(p.num)); disc.style.background = gk ? (M.team.gk || M.team.c1) : M.team.c1; disc.style.color = U.lum(gk ? (M.team.gk || M.team.c1) : M.team.c1) > 0.55 ? '#1a1020' : '#ffffff'; disc.style.borderColor = f.c;
      tk.appendChild(disc);
      tk.appendChild(el('b', null, p.name));
      var meta = el('span', null, (p.hidden ? T('kartu merah') : T(ROLE_S[p.role] || 'GL')) + (p.injured ? ' ✚' : ''));
      tk.appendChild(meta);
      if (M.live && !p.hidden) { var eb = el('em'); var ei = el('i'); ei.style.width = Math.max(6, Math.round(p.energy)) + '%'; ei.style.background = f.c; eb.appendChild(ei); tk.appendChild(eb); }
      tk.setAttribute('aria-label', p.name + ', ' + T(ROLE_N[p.role] || 'Gelandang') + (M.live ? ', ' + T(f.n) + ' ' + Math.round(p.energy) + '%' : ''));
      pitch.appendChild(tk);
    });
    left.appendChild(pitch);
    left.appendChild(el('p', 'hint', !M.can ? '' : (M.live ? T('Ketuk dua pemain untuk bertukar posisi. Ketuk pemain lalu cadangan untuk mengganti pemain.') : T('Ketuk dua pemain untuk bertukar posisi, atau pemain lalu cadangan untuk menukar siapa yang turun sejak awal.'))));
    /* ---- formasi ---- */
    var sfo = el('div', 'sect'); sfo.appendChild(el('h3', null, T('Formasi') + ' · ' + (M.form || T('Otomatis'))));
    var cfo = el('div', 'chips'); sfo.appendChild(cfo);
    [{ id: '', n: T('Otomatis') }].concat(D.formsOf(M.n).map(function (f) { return { id: f.id, n: f.id }; })).forEach(function (f) {
      var b = el('button', 'chip' + (f.id === M.form ? ' on' : ''), f.n); b.type = 'button'; b.disabled = !M.can;
      b.addEventListener('click', function () { click(); if (M.live) App.teamCmd({ k: 'form', v: f.id }); else saveSetup(function (su) { su.f = f.id; }); UI.renderStrategy(); });
      cfo.appendChild(b);
    });
    sfo.appendChild(el('p', 'hint', T('Angka formasi dibaca dari belakang: bek – gelandang – penyerang. Otomatis menyusun posisi dari peran asli tiap pemain.')));
    right.appendChild(sfo);
    /* ---- taktik ---- */
    var sta = el('div', 'sect'); sta.appendChild(el('h3', null, T('Taktik')));
    var cta = el('div', 'chips'); sta.appendChild(cta);
    D.TACTICS.forEach(function (tc) {
      var b = el('button', 'chip' + (tc.id === M.tactic ? ' on' : ''), T(tc.n)); b.type = 'button'; b.disabled = !M.can;
      b.addEventListener('click', function () { click(); if (M.live) App.teamCmd({ k: 'tac', v: tc.id }); else { App.myTeam.tactic = tc.id; App.saveTeam(); } UI.renderStrategy(); });
      cta.appendChild(b);
    });
    var tcur = D.TACTICS.filter(function (x) { return x.id === M.tactic; })[0];
    if (tcur) sta.appendChild(el('p', 'hint', T(tcur.desc)));
    right.appendChild(sta);
    /* ---- cadangan ---- */
    var sb = el('div', 'sect');
    sb.appendChild(el('h3', null, T('Cadangan') + (M.live ? ' · ' + T('sisa pergantian {0}', M.subsLeft) : '')));
    var bl = el('div', 'benchList');
    M.bench.forEach(function (b) {
      var c = b.cfg || {};
      var row = el(M.can && !b.used ? 'button' : 'div', 'benchP' + (b.used ? ' used' : '') + (S.sel && S.sel.kind === 'b' && S.sel.i === b.j ? ' sel' : ''));
      if (row.tagName === 'BUTTON') { row.type = 'button'; row.addEventListener('click', function () { pick('b', b.j); }); }
      var disc = el('i', 'disc', String(c.num == null ? '' : c.num)); disc.style.background = M.team.c1; disc.style.color = U.lum(M.team.c1) > 0.55 ? '#1a1020' : '#ffffff';
      row.appendChild(disc);
      var nm = el('div'); nm.appendChild(el('b', null, c.name || '-')); nm.appendChild(el('span', null, T(ROLE_N[c.role] || 'Gelandang') + ' · ' + T((D.shotById[c.shot] || D.SHOTS[0]).name)));
      row.appendChild(nm);
      row.appendChild(el('span', 'st', b.used ? T('sudah keluar') : (M.live ? T('segar') : T('cadangan'))));
      bl.appendChild(row);
    });
    if (!M.bench.length) bl.appendChild(el('p', 'hint', T('Tidak ada pemain cadangan.')));
    sb.appendChild(bl);
    var tg = el('div', 'toggle'); tg.appendChild(el('span', null, T('Ganti otomatis pemain cedera / kehabisan tenaga saat bola mati')));
    var tb = el('button', M.autoSub ? 'on' : ''); tb.type = 'button'; tb.disabled = !M.can; tb.setAttribute('aria-pressed', M.autoSub ? 'true' : 'false'); tb.setAttribute('aria-label', T('Ganti otomatis'));
    tb.addEventListener('click', function () { click(); var v = !M.autoSub; if (M.live) App.teamCmd({ k: 'auto', v: v }); else { App.myTeam.autoSub = v; App.saveTeam(); } UI.renderStrategy(); });
    tg.appendChild(tb); sb.appendChild(tg);
    right.appendChild(sb);
    /* ---- kondisi pemain (saat laga) ---- */
    if (M.live) {
      var sk = el('div', 'sect'); sk.appendChild(el('h3', null, T('Kondisi pemain')));
      var tbl = el('div', 'fitList');
      M.players.slice().sort(function (a, b) { return (a.injured ? -100 : a.energy) - (b.injured ? -100 : b.energy); }).forEach(function (p) {
        if (p.hidden) return;
        var r = el('div', 'fitRow');
        r.appendChild(el('b', null, p.num + ' ' + p.name));
        r.appendChild(el('span', 'ro', T(ROLE_S[p.role] || 'GL')));
        r.appendChild(fitBar(p.energy, p.injured));
        tbl.appendChild(r);
      });
      sk.appendChild(tbl);
      sk.appendChild(el('p', 'hint', T('Bugar = tenaga penuh. Lelah = lari mulai melambat. Lemah = lambat dan mudah cedera. Cedera = pincang dan tidak bisa sprint; segera ganti.')));
      right.appendChild(sk);
    }
    wrap.appendChild(left); wrap.appendChild(right);
    box.appendChild(wrap);
    box.scrollTop = sy;
  };

  /* ======================================================================
     STRIP KONDISI PEMAIN DI HUD (tim sendiri): nomor + warna tenaga; ketuk = buka strategi
     ====================================================================== */
  var fitKey = '', fitAt = 0;
  UI.fitHud = function (st, my, me) {
    var box = $('fitStrip'); if (!box) return;
    var show = !!(BA.App.settings.fitHud && st && st.mode === 'match' && st.phase !== 'pen' && st.phase !== 'end' && st.players);
    if (box.hidden !== !show) box.hidden = !show;
    if (!show) { fitKey = ''; return; }
    var now = Date.now();
    if (now - fitAt < 500) return;
    fitAt = now;
    var key = '', list = [];
    for (var i = 0; i < st.players.length; i++) {
      var p = st.players[i];
      if (p.team !== my) continue;
      var f = D.fitOf(U.num(p.energy, 100), !!p.injured);
      list.push({ p: p, f: f });
      key += p.num + f.id + (p.hidden ? 'x' : '') + (p === me ? 'm' : '') + Math.round(U.num(p.energy, 100) / 10) + ',';
    }
    if (key === fitKey) return;
    fitKey = key;
    clear(box);
    list.forEach(function (o) {
      var t = el('span', 'ft ' + o.f.id + (o.p === me ? ' mine' : '') + (o.p.hidden ? ' out' : ''));
      t.appendChild(el('b', null, o.p.injured ? '✚' : String(o.p.num)));
      var bar = el('i'); bar.style.width = Math.max(8, Math.round(U.num(o.p.energy, 100))) + '%'; bar.style.background = o.f.c;
      var w = el('em'); w.appendChild(bar); t.appendChild(w);
      box.appendChild(t);
    });
  };

  /* ======================================================================
     BAHASA
     ====================================================================== */
  UI.syncLang = function () {
    var cur = BA.I18n ? BA.I18n.lang : 'id';
    document.querySelectorAll('[data-lang]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-lang') === cur); });
  };
  UI.setLang = function (lang) {
    var App = BA.App;
    App.setSetting('lang', lang);
    /* komentator ikut bahasa antarmuka (kecuali sedang dimatikan) */
    if (App.settings.nLang !== 'off') App.setSetting('nLang', lang === 'en' ? 'en' : 'id');
    UI.syncLang();
    if (UI.cur === 'scrSettings') UI.openSettings(true);
    if (UI.cur === 'scrGuide') UI.buildGuide();
    UI.renderRecords(App.records);
    App.applyDevice();
  };

  UI.init2 = function () {
    /* nama & watak narator punya versi Inggris sendiri: daftarkan ke kamus */
    if (BA.I18n && BA.Narr && BA.Narr.PERSONAS) { var pd = {}; BA.Narr.PERSONAS.forEach(function (p) { if (p.en) pd[p.n] = p.en; if (p.descEn) pd[p.desc] = p.descEn; }); BA.I18n.add(pd); }
    document.querySelectorAll('[data-lang]').forEach(function (b) { b.addEventListener('click', function () { click(); UI.setLang(b.getAttribute('data-lang')); }); });
    UI.syncLang();
    var bs = $('btnStrategy'); if (bs) bs.addEventListener('click', function () { click(); UI.openStrategy('match'); });
    var fs = $('fitStrip'); if (fs) fs.addEventListener('click', function () { click(); if (BA.App.match) { BA.App.pause(); UI.openStrategy('match'); } });
    var b1 = $('btnSetupStrategy'); if (b1) b1.addEventListener('click', function () { click(); UI.openStrategy('pre', UI.setupCfg && UI.setupCfg.field); });
    var b2 = $('btnHostStrategy'); if (b2) b2.addEventListener('click', function () { click(); UI.openStrategy('pre', BA.App.onlineCfg().field); });
    var b3 = $('btnGuestStrategy'); if (b3) b3.addEventListener('click', function () { click(); var hc = BA.App.online && BA.App.online.hostCfg; UI.openStrategy('pre', hc ? hc.field : null); });
  };
})(typeof window !== 'undefined' ? window : globalThis);
