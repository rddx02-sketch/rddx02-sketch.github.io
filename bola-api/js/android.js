/* Bola Api Arena — jembatan aplikasi Android (Play Store).
   Di dalam aplikasi, WebView Android tidak punya Web Speech API, jadi suara komentator diteruskan ke
   mesin Text-to-Speech Android lewat objek window.BAAndroid yang dipasang aplikasi. Di browser biasa berkas ini tidak berbuat apa-apa. */
(function (root) {
  'use strict';
  var A = root.BAAndroid;
  if (!A) return;
  root.BA = root.BA || {};
  root.BA.isAndroidApp = true;

  /* tombol Bagikan: WebView tidak punya navigator.share, jadi diteruskan ke lembar bagikan Android */
  if (typeof A.share === 'function') {
    var shareFn = function (d) {
      d = d || {};
      try { A.share(String(d.title || ''), String(d.text || ''), String(d.url || '')); return Promise.resolve(); }
      catch (e) { return Promise.reject(e); }
    };
    try { Object.defineProperty(root.navigator, 'share', { value: shareFn, configurable: true, writable: true }); }
    catch (e) { try { root.navigator.share = shareFn; } catch (e2) { /* abaikan */ } }
  }
  /* dipanggil aplikasi saat ditinggal ke latar belakang / dibuka lagi */
  root.__baAppPause = function () {
    var B = root.BA;
    try { if (B.Narr) B.Narr.stop(); } catch (e) { /* abaikan */ }
    try { if (B.Audio && B.Audio.ctx && B.Audio.ctx.state === 'running') B.Audio.ctx.suspend(); } catch (e) { /* abaikan */ }
    try { var App = B.App; if (App && App.match && App.match.kind === 'local' && !App.paused && B.UI.cur === 'play') App.pause(); } catch (e) { /* abaikan */ }
  };
  root.__baAppResume = function () {
    try { var Au = root.BA.Audio; if (Au && Au.ctx && Au.ctx.state === 'suspended') Au.ctx.resume(); } catch (e) { /* abaikan */ }
  };
  /* WebView Android punya objek speechSynthesis tetapi tanpa suara (daftar suara kosong), jadi di aplikasi selalu diganti */
  if (typeof A.ttsSpeak !== 'function') return;

  var voices = [], pending = {}, seq = 0, listeners = [];
  function loadVoices() {
    try {
      voices = JSON.parse(A.ttsVoices() || '[]').map(function (v) {
        return { name: String(v.name || ''), lang: String(v.lang || ''), voiceURI: String(v.name || ''), localService: v.local !== false, default: !!v.def };
      });
    } catch (e) { voices = []; }
  }
  function fire(u, type) {
    var h = u && u['on' + type];
    if (typeof h === 'function') { try { h.call(u, { type: type, utterance: u }); } catch (e) { /* abaikan */ } }
  }
  var synth = {
    speaking: false, pending: false, paused: false, onvoiceschanged: null,
    getVoices: function () { if (!voices.length) loadVoices(); return voices.slice(); },
    speak: function (u) {
      if (!u) return;
      var id = 'u' + (++seq);
      pending[id] = u;
      synth.speaking = true;
      try {
        A.ttsSpeak(id, String(u.text || ''), u.voice ? String(u.voice.name || '') : '', String(u.lang || ''),
          Number(u.rate) || 1, Number(u.pitch) || 1, u.volume == null ? 1 : Number(u.volume));
      } catch (e) { delete pending[id]; synth.speaking = Object.keys(pending).length > 0; setTimeout(function () { fire(u, 'error'); }, 0); }
    },
    cancel: function () {
      try { A.ttsStop(); } catch (e) { /* abaikan */ }
      var list = Object.keys(pending).map(function (k) { return pending[k]; });
      pending = {}; synth.speaking = false;
      /* seperti browser: ucapan yang dibatalkan berakhir dengan "error: interrupted" */
      list.forEach(function (u) { setTimeout(function () { fire(u, 'error'); }, 0); });
    },
    pause: function () {}, resume: function () {},
    addEventListener: function (type, fn) { if (type === 'voiceschanged' && typeof fn === 'function') listeners.push(fn); },
    removeEventListener: function (type, fn) { listeners = listeners.filter(function (f) { return f !== fn; }); }
  };
  function Utterance(text) { this.text = text == null ? '' : String(text); this.lang = ''; this.voice = null; this.rate = 1; this.pitch = 1; this.volume = 1; }
  function put(name, val) {
    try { Object.defineProperty(root, name, { value: val, configurable: true, writable: true, enumerable: true }); }
    catch (e) { try { root[name] = val; } catch (e2) { /* abaikan */ } }
  }
  put('SpeechSynthesisUtterance', Utterance);
  put('speechSynthesis', synth);
  /* dipanggil aplikasi: mesin TTS siap / daftar suara berubah, dan kabar mulai/selesai tiap ucapan */
  root.__baTtsVoices = function () {
    loadVoices();
    var ev = { type: 'voiceschanged' };
    if (typeof synth.onvoiceschanged === 'function') { try { synth.onvoiceschanged(ev); } catch (e) { /* abaikan */ } }
    listeners.forEach(function (f) { try { f(ev); } catch (e) { /* abaikan */ } });
  };
  root.__baTtsEvent = function (id, type) {
    var u = pending[id];
    if (!u) return;
    if (type === 'start') { fire(u, 'start'); return; }
    delete pending[id];
    synth.speaking = Object.keys(pending).length > 0;
    fire(u, type === 'error' ? 'error' : 'end');
  };
})(typeof window !== 'undefined' ? window : globalThis);
