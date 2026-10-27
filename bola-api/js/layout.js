/* Bola Api Arena — pengatur posisi tombol layar (buka kunci → seret → kunci & simpan) */
(function (root) {
  'use strict';
  var BA = root.BA, U = BA.U;
  var $ = function (id) { return document.getElementById(id); };
  var L = BA.Layout = {};
  var IDS = ['bShoot', 'bPass', 'bGocek', 'bSwitch', 'bSprint', 'joyZone'];
  var NAMES = { bShoot: 'Tendang', bPass: 'Oper', bGocek: 'Gocek', bSwitch: 'Ganti', bSprint: 'Sprint', joyZone: 'Area joystick' };
  var JOY_W = 0.46, JOY_H = 0.68; // ukuran bawaan area joystick (bagian layar)
  L.IDS = IDS;
  L.editing = false;

  L.orient = function () { return root.innerWidth >= root.innerHeight ? 'land' : 'port'; };
  L.orientName = function (o) { return o === 'port' ? 'potret' : 'lanskap'; };

  /* bersihkan data dari penyimpanan: hanya orientasi yang punya SEMUA tombol yang dipakai */
  L.sanitize = function (lay) {
    if (!lay || typeof lay !== 'object') return null;
    var out = {}, any = false;
    ['land', 'port'].forEach(function (o) {
      var m = lay[o];
      if (!m || typeof m !== 'object') return;
      var mm = {}, ok = true;
      IDS.forEach(function (id) {
        var e = m[id];
        if (!e || typeof e !== 'object') { ok = false; return; }
        mm[id] = { x: U.clamp(U.num(e.x, 0.5), 0, 1), y: U.clamp(U.num(e.y, 0.5), 0, 1), s: U.clamp(U.num(e.s, 1), 0.6, 1.5) };
      });
      if (ok) { out[o] = mm; any = true; }
    });
    return any ? out : null;
  };

  /* terapkan tata letak: map eksplisit, atau dari pengaturan; null = bawaan CSS */
  L.apply = function (map) {
    var c = $('controls'); if (!c) return;
    if (map === undefined) { var lay = BA.App && BA.App.settings.layout; map = lay ? lay[L.orient()] || null : null; }
    if (!map) {
      c.classList.remove('custom');
      IDS.forEach(function (id) {
        var e = $(id); if (!e) return;
        e.style.removeProperty('--lx'); e.style.removeProperty('--ly'); e.style.removeProperty('--ls');
        e.style.left = ''; e.style.top = ''; e.style.width = ''; e.style.height = '';
      });
      return;
    }
    c.classList.add('custom');
    IDS.forEach(function (id) {
      var e = $(id), p = map[id]; if (!e || !p) return;
      if (id === 'joyZone') {
        var w = Math.min(1, JOY_W * p.s), h = Math.min(1, JOY_H * p.s);
        e.style.width = (w * 100).toFixed(2) + '%'; e.style.height = (h * 100).toFixed(2) + '%';
        e.style.left = (U.clamp(p.x - w / 2, 0, 1 - w) * 100).toFixed(2) + '%';
        e.style.top = (U.clamp(p.y - h / 2, 0, 1 - h) * 100).toFixed(2) + '%';
      } else {
        e.style.setProperty('--lx', (p.x * 100).toFixed(2) + '%');
        e.style.setProperty('--ly', (p.y * 100).toFixed(2) + '%');
        e.style.setProperty('--ls', String(p.s));
      }
    });
  };

  /* baca posisi yang sedang tampak (bagian layar) — dipakai saat mulai mengedit & atur ulang */
  function capture(ov) {
    var r = ov.getBoundingClientRect(), m = {};
    if (!(r.width > 0 && r.height > 0)) return null;
    IDS.forEach(function (id) {
      var e = $(id), b = e.getBoundingClientRect(), s = 1;
      if (id === 'joyZone') s = U.clamp((b.width / r.width) / JOY_W, 0.6, 1.5);
      else if (e.offsetWidth > 0) s = U.clamp(b.width / e.offsetWidth, 0.6, 1.5);
      m[id] = { x: U.clamp((b.left + b.width / 2 - r.left) / r.width, 0, 1), y: U.clamp((b.top + b.height / 2 - r.top) / r.height, 0, 1), s: Math.round(s * 100) / 100 };
    });
    return m;
  }

  var drag = null, home = null;

  L.start = function () {
    if (L.editing) return;
    var c = $('controls'), ov = $('layoutEdit');
    if (!c || !ov) return;
    L.editing = true;
    home = { parent: c.parentNode, next: c.nextSibling };
    ov.appendChild(c);
    ov.hidden = false;
    document.body.classList.add('layoutEdit');
    BA.Input.editing = true;
    BA.Input.releaseAll();
    L.pending = {};
    L.orientCur = L.orient();
    L.work = L.loadWork(ov);
    L.sel = null;
    L.select('bShoot');
    L.apply(L.work);
    L.updateBar();
    BA.UI.toast('Seret tombol & area joystick ke posisi yang kamu mau, lalu Kunci & simpan');
  };
  /* tata letak awal untuk orientasi sekarang: yang tersimpan, atau posisi bawaan yang sedang tampak */
  L.loadWork = function (ov) {
    var lay = BA.App.settings.layout, cur = lay && lay[L.orientCur];
    if (cur) return U.copy(cur);
    L.apply(null);
    return capture(ov) || defaultMap();
  };
  function defaultMap() {
    return { bShoot: { x: 0.9, y: 0.82, s: 1 }, bPass: { x: 0.74, y: 0.88, s: 1 }, bGocek: { x: 0.74, y: 0.66, s: 1 }, bSwitch: { x: 0.9, y: 0.58, s: 1 }, bSprint: { x: 0.58, y: 0.7, s: 1 }, joyZone: { x: 0.23, y: 0.66, s: 1 } };
  }

  L.select = function (id) {
    if (L.sel) { var o = $(L.sel); if (o) o.classList.remove('leSel'); }
    L.sel = id;
    var e = $(id); if (e) e.classList.add('leSel');
    L.updateBar();
  };
  L.updateBar = function () {
    var sl = $('leSize'), nm = $('leSel'), tt = $('leOrient');
    if (nm) nm.textContent = 'Ukuran ' + (NAMES[L.sel] || '').toLowerCase();
    if (sl && L.sel && L.work[L.sel]) sl.value = String(L.work[L.sel].s);
    if (tt) tt.textContent = 'Tata letak ' + L.orientName(L.orientCur) + ' — putar HP untuk mengatur yang satunya';
  };

  function onDown(e) {
    if (!L.editing) return;
    var t = e.target && e.target.closest ? e.target.closest('.pbtn, #joyZone') : null;
    if (!t || !L.work[t.id]) return;
    e.preventDefault();
    var ov = $('layoutEdit');
    L.select(t.id);
    drag = { id: t.id, px: e.clientX, py: e.clientY, x0: L.work[t.id].x, y0: L.work[t.id].y, pid: e.pointerId, moved: false };
    try { ov.setPointerCapture(e.pointerId); } catch (er) { /* abaikan */ }
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    e.preventDefault();
    var ov = $('layoutEdit'), r = ov.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return;
    var p = L.work[drag.id];
    var nx = U.clamp(drag.x0 + (e.clientX - drag.px) / r.width, 0.04, 0.96);
    var ny = U.clamp(drag.y0 + (e.clientY - drag.py) / r.height, 0.1, 0.96);
    if (Math.abs(nx - p.x) > 0.002 || Math.abs(ny - p.y) > 0.002) drag.moved = true;
    p.x = nx; p.y = ny;
    L.apply(L.work);
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    drag = null;
  }
  L.onSize = function (v) {
    if (!L.editing || !L.sel || !L.work[L.sel]) return;
    L.work[L.sel].s = U.clamp(U.num(parseFloat(v), 1), 0.6, 1.5);
    L.apply(L.work);
  };
  L.reset = function () {
    if (!L.editing) return;
    var ov = $('layoutEdit');
    L.apply(null);
    L.work = capture(ov) || defaultMap();
    L.apply(L.work);
    L.updateBar();
    BA.UI.toast('Posisi bawaan dikembalikan (belum disimpan)');
  };
  L.lock = function () {
    if (!L.editing) return;
    var lay = L.sanitize(U.copy(BA.App.settings.layout || null)) || {};
    L.pending[L.orientCur] = L.work;
    Object.keys(L.pending).forEach(function (o) { lay[o] = L.pending[o]; });
    lay = L.sanitize(lay);
    BA.App.setSetting('layout', lay);
    L.end();
    BA.UI.toast('Posisi tombol disimpan & dikunci');
  };
  L.cancel = function () {
    if (!L.editing) return;
    L.end();
    BA.UI.toast('Perubahan posisi tombol dibatalkan');
  };
  L.end = function () {
    var c = $('controls'), ov = $('layoutEdit');
    drag = null;
    if (L.sel) { var o = $(L.sel); if (o) o.classList.remove('leSel'); }
    L.sel = null;
    if (home && c) { if (home.next && home.next.parentNode === home.parent) home.parent.insertBefore(c, home.next); else home.parent.appendChild(c); }
    home = null;
    ov.hidden = true;
    document.body.classList.remove('layoutEdit');
    BA.Input.editing = false;
    L.editing = false;
    L.apply();
    if (BA.UI.cur === 'scrSettings') BA.UI.openSettings(true);
  };
  /* orientasi berubah saat mengedit: simpan kerjaan orientasi lama, muat yang baru */
  L.onResize = function () {
    if (!L.editing) { L.apply(); return; }
    var o = L.orient();
    if (o === L.orientCur) { L.apply(L.work); return; }
    L.pending[L.orientCur] = L.work;
    L.orientCur = o;
    L.work = L.pending[o] || L.loadWork($('layoutEdit'));
    L.apply(L.work);
    L.updateBar();
  };

  L.init = function () {
    var ov = $('layoutEdit'); if (!ov) return;
    ov.addEventListener('pointerdown', onDown, { passive: false });
    ov.addEventListener('pointermove', onMove, { passive: false });
    ov.addEventListener('pointerup', onUp);
    ov.addEventListener('pointercancel', onUp);
    var sl = $('leSize');
    if (sl) sl.addEventListener('input', function () { L.onSize(sl.value); });
    var on = function (id, fn) { var b = $(id); if (b) b.addEventListener('click', function () { if (BA.Audio) BA.Audio.click(); fn(); }); };
    on('leReset', L.reset); on('leCancel', L.cancel); on('leLock', L.lock);
    root.addEventListener('resize', function () { setTimeout(L.onResize, 60); });
    L.apply();
  };
})(typeof window !== 'undefined' ? window : globalThis);
