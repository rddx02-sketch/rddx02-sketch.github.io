/* Bola Api Arena — bahasa antarmuka (Indonesia / Inggris).
   Teks sumber game berbahasa Indonesia. Mode Inggris bekerja dengan dua jalur:
   1) BA.t('Teks {0}', nilai) untuk kalimat berisi angka/nama, 2) penerjemah DOM: setiap teks yang masuk ke halaman
   dicocokkan dengan kamus (js/lang_en.js) lalu diganti; teks asal disimpan supaya bisa kembali ke Indonesia tanpa memuat ulang. */
(function (root) {
  'use strict';
  var BA = root.BA = root.BA || {};
  var I = BA.I18n = { lang: 'id', dict: Object.create(null), pats: [], cache: Object.create(null), cacheN: 0, misses: null };
  function fmt(s, args) { return String(s).replace(/\{(\d+)\}/g, function (m, i) { var v = args[Number(i) + 1]; return v == null ? '' : String(v); }); }

  /* tambah kamus: dict = { 'teks Indonesia': 'English text' }, pats = [[RegExp, pengganti], …] untuk teks berisi nama/angka */
  I.add = function (dict, pats) {
    if (dict) Object.keys(dict).forEach(function (k) { I.dict[k] = dict[k]; });
    if (pats) pats.forEach(function (p) { I.pats.push(p); });
    I.cache = Object.create(null); I.cacheN = 0;
  };

  /* terjemahkan satu potong teks yang sudah dirapikan; null = tidak ada padanan */
  function core(s) {
    var d = I.dict[s];
    if (d != null) return d;
    var c = I.cache[s];
    if (c !== undefined) return c;
    var out = null, i, p;
    for (i = 0; i < I.pats.length; i++) {
      p = I.pats[i];
      if (p[0].test(s)) { out = s.replace(p[0], p[1]); break; }
    }
    if (out === null && s.indexOf(' · ') > 0) {
      /* gabungan "A · B · C": tiap bagian diterjemahkan sendiri */
      var any = false;
      var parts = s.split(' · ').map(function (q) { var r = core(q); if (r !== null) any = true; return r === null ? q : r; });
      if (any) out = parts.join(' · ');
    }
    if (I.cacheN > 3000) { I.cache = Object.create(null); I.cacheN = 0; }
    I.cache[s] = out; I.cacheN++;
    if (out === null && I.misses && /[A-Za-z]{3}/.test(s)) I.misses[s] = 1;
    return out;
  }
  /* kata/frasa lepas (dipakai pola): terjemahan bila ada, kalau tidak teks asal */
  I.w = function (s) { var r = core(String(s)); return r === null ? String(s) : r; };
  /* terjemahkan teks bebas; spasi tepi dipertahankan. Bahasa Indonesia: dikembalikan apa adanya */
  I.tr = function (text) {
    if (I.lang !== 'en' || typeof text !== 'string') return text;
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text), body = m[2];
    if (!body || !/[A-Za-z]/.test(body)) return text;
    var r = core(body.replace(/\s+/g, ' '));
    return r === null ? text : m[1] + r + m[3];
  };

  /* BA.t('Teks {0}', nilai): terjemahkan pola kalimat lalu isi {0}, {1}, … (nilai berupa kata ikut diterjemahkan bila ada di kamus) */
  BA.t = function (key) {
    if (I.lang !== 'en' || typeof key !== 'string') return arguments.length > 1 ? fmt(key, arguments) : key;
    var s = I.dict[key];
    if (s == null) { if (arguments.length < 2) { var r = core(key.replace(/\s+/g, ' ').trim()); return r === null ? key : r; } s = key; }
    if (arguments.length < 2) return s;
    var args = [key];
    for (var i = 1; i < arguments.length; i++) { var a = arguments[i]; args.push(typeof a === 'string' && I.dict[a] != null ? I.dict[a] : a); }
    return fmt(s, args);
  };

  /* ---------------- penerjemah DOM ---------------- */
  var ATTRS = ['placeholder', 'title', 'aria-label'];
  var doc = root.document, obs = null;
  function skipEl(el) {
    while (el && el.nodeType === 1) {
      var tg = el.tagName;
      if (tg === 'SCRIPT' || tg === 'STYLE' || tg === 'TEXTAREA' || (el.hasAttribute && el.hasAttribute('data-noi18n'))) return true;
      el = el.parentNode;
    }
    return false;
  }
  function doText(n) {
    var v = n.nodeValue;
    if (I.lang === 'en') {
      if (n.__en === v) return; /* sudah diterjemahkan */
      var t = I.tr(v);
      n.__id = v; n.__en = t;
      if (t !== v) n.nodeValue = t;
    } else if (n.__en != null) {
      if (n.__en === v && n.__id != null && n.__id !== v) n.nodeValue = n.__id;
      n.__en = null; n.__id = null;
    }
  }
  function doAttr(el, a) {
    var v = el.getAttribute(a);
    if (v == null) return;
    var st = el.__i18n || (el.__i18n = {});
    var cur = st[a];
    if (I.lang === 'en') {
      if (cur && cur.en === v) return;
      var t = I.tr(v);
      st[a] = { id: v, en: t };
      if (t !== v) el.setAttribute(a, t);
    } else if (cur) {
      if (cur.en === v && cur.id !== v) el.setAttribute(a, cur.id);
      st[a] = null;
    }
  }
  function walk(rootEl) {
    if (!rootEl) return;
    if (rootEl.nodeType === 3) { if (!skipEl(rootEl.parentNode)) doText(rootEl); return; }
    if (rootEl.nodeType !== 1 || skipEl(rootEl)) return;
    var tw = doc.createTreeWalker(rootEl, 5 /* SHOW_ELEMENT | SHOW_TEXT */, {
      acceptNode: function (n) {
        if (n.nodeType === 1) { var tg = n.tagName; return (tg === 'SCRIPT' || tg === 'STYLE' || tg === 'TEXTAREA' || n.hasAttribute('data-noi18n')) ? 2 /* REJECT */ : 1; }
        return 1;
      }
    });
    var n = rootEl;
    while (n) {
      if (n.nodeType === 3) doText(n);
      else for (var i = 0; i < ATTRS.length; i++) if (n.hasAttribute(ATTRS[i])) doAttr(n, ATTRS[i]);
      n = tw.nextNode();
    }
  }
  function onMut(list) {
    if (I.lang !== 'en') return;
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.type === 'characterData') { if (m.target.nodeType === 3 && !skipEl(m.target.parentNode)) doText(m.target); }
      else if (m.type === 'attributes') { if (!skipEl(m.target)) doAttr(m.target, m.attributeName); }
      else for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
    }
  }
  /* terapkan bahasa sekarang ke seluruh halaman */
  I.apply = function () {
    if (!doc || !doc.body) return;
    try { doc.documentElement.setAttribute('lang', I.lang); } catch (e) { /* abaikan */ }
    if (obs) { obs.disconnect(); }
    walk(doc.body);
    if (I.lang === 'en' && root.MutationObserver) {
      if (!obs) obs = new root.MutationObserver(onMut);
      obs.observe(doc.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    }
  };
  I.set = function (lang) {
    lang = lang === 'en' ? 'en' : 'id';
    if (lang === I.lang && I.applied) return;
    I.lang = lang; I.applied = true;
    I.apply();
  };
  /* bahasa bawaan untuk pemain baru: mengikuti bahasa perangkat (Indonesia/Melayu/Jawa/Sunda → Indonesia, lainnya → Inggris) */
  I.detect = function () {
    var nav = root.navigator || {}, list = (nav.languages && nav.languages.length ? nav.languages : [nav.language || 'id']);
    for (var i = 0; i < list.length; i++) {
      var l = String(list[i] || '').toLowerCase();
      if (/^(id|in|ms|jv|su)\b/.test(l)) return 'id';
      if (/^en\b/.test(l)) return 'en';
    }
    return 'en';
  };
})(typeof window !== 'undefined' ? window : globalThis);
