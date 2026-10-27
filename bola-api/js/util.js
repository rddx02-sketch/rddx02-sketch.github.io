/* Bola Api Arena — utilitas umum (dipakai juga oleh tes Node) */
(function (root) {
  'use strict';
  var BA = root.BA = root.BA || {};
  var U = BA.U = {};

  U.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.dist2 = function (ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };
  U.dist = function (ax, az, bx, bz) { return Math.sqrt(U.dist2(ax, az, bx, bz)); };
  U.len = function (x, z) { return Math.sqrt(x * x + z * z); };
  U.fin = function (v) { return typeof v === 'number' && isFinite(v); };
  U.num = function (v, def) { return (typeof v === 'number' && isFinite(v)) ? v : def; };
  U.TAU = Math.PI * 2;
  U.wrap = function (a) {
    if (!isFinite(a)) return 0;
    a = (a + Math.PI) % U.TAU;
    if (a < 0) a += U.TAU;
    return a - Math.PI;
  };
  U.angLerp = function (a, b, t) { return a + U.wrap(b - a) * t; };
  U.smooth = function (t) { t = U.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  U.easeOut = function (t) { t = U.clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); };
  U.easeIn = function (t) { t = U.clamp(t, 0, 1); return t * t * t; };
  U.easeInOut = function (t) { t = U.clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  U.easeBack = function (t) { t = U.clamp(t, 0, 1); var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  /* dampening yang tidak tergantung frame-rate */
  U.damp = function (a, b, k, dt) { return U.lerp(a, b, 1 - Math.exp(-k * dt)); };

  /* RNG ber-seed (mulberry32) supaya hasil bisa diulang */
  U.rng = function (seed) {
    var s = (seed >>> 0) || 1;
    var f = function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.range = function (a, b) { return a + (b - a) * f(); };
    f.pick = function (arr) { return arr[Math.floor(f() * arr.length) % arr.length]; };
    f.int = function (a, b) { return a + Math.floor(f() * (b - a + 1)); };
    return f;
  };

  U.fmtTime = function (sec) {
    sec = Math.max(0, Math.ceil(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  };

  U.copy = function (o) { return JSON.parse(JSON.stringify(o)); };

  /* teks dari jaringan/penyimpanan: buang karakter kontrol, batasi panjang */
  U.cleanText = function (s, max) {
    if (typeof s !== 'string') s = String(s == null ? '' : s);
    s = s.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]/g, '');
    s = s.trim();
    if (s.length > (max || 16)) s = s.slice(0, max || 16);
    return s;
  };
  U.cleanColor = function (c, def) {
    return (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c)) ? c.toLowerCase() : def;
  };
  U.idx = function (v, n, def) {
    v = Math.floor(Number(v));
    return (isFinite(v) && v >= 0 && v < n) ? v : (def || 0);
  };

  /* penyimpanan lokal yang aman (bisa gagal di mode privat) */
  U.store = {
    get: function (k, def) {
      try {
        var v = root.localStorage && root.localStorage.getItem('bolaapi_' + k);
        return v ? JSON.parse(v) : def;
      } catch (e) { return def; }
    },
    set: function (k, v) {
      try { if (root.localStorage) root.localStorage.setItem('bolaapi_' + k, JSON.stringify(v)); } catch (e) { /* abaikan */ }
    }
  };

  U.hexToRgb = function (hex) {
    var n = parseInt(String(hex).slice(1), 16);
    if (!isFinite(n)) n = 0xffffff;
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  };
  U.mixHex = function (a, b, t) {
    var x = U.hexToRgb(a), y = U.hexToRgb(b);
    var r = Math.round(U.lerp(x[0], y[0], t) * 255), g = Math.round(U.lerp(x[1], y[1], t) * 255), bl = Math.round(U.lerp(x[2], y[2], t) * 255);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  };
  U.lum = function (hex) { var c = U.hexToRgb(hex); return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; };

  U.code = function (n) {
    var abc = 'abcdefghjkmnpqrstuvwxyz23456789', s = '';
    for (var i = 0; i < (n || 4); i++) s += abc[Math.floor(Math.random() * abc.length)];
    return s;
  };
})(typeof window !== 'undefined' ? window : globalThis);
